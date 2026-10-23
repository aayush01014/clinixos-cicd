import { Router, Response } from 'express';
import { queryAll, queryOne, runQuery } from '../database/db';
import { authenticateToken, AuthRequest, logAuditEvent } from '../middleware/auth';
import { broadcastMessage } from '../websocket';

const router = Router();

// Standard 30-minute hospital slots between 8:00 AM and 8:00 PM (BR-01)
const STANDARD_SLOTS = [
  '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '02:00 PM', '02:30 PM',
  '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM',
  '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM'
];

// GET /api/appointments
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { date, doctor_id, patient_id, status } = req.query;

  try {
    let sql = `
      SELECT a.*,
             p.pid as patient_pid, p.first_name as patient_first, p.last_name as patient_last, p.contact_number as patient_phone,
             d.specialization as doctor_spec, d.department as doctor_dept, d.room_number, d.consultation_fee
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN doctors d ON a.doctor_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (date) {
      sql += ' AND a.appointment_date = ?';
      params.push(date);
    }
    if (doctor_id) {
      sql += ' AND a.doctor_id = ?';
      params.push(doctor_id);
    }
    if (patient_id) {
      sql += ' AND a.patient_id = ?';
      params.push(patient_id);
    }
    if (status) {
      sql += ' AND a.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY a.appointment_date ASC, a.time_slot ASC';
    const appointments = await queryAll(sql, params);

    return res.json({ success: true, count: appointments.length, data: appointments });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve appointments.' });
  }
});

// GET /api/appointments/availability (Check doctor availability slots - FR-02.1 & BR-01)
router.get('/availability', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { doctor_id, date } = req.query;

  if (!doctor_id || !date) {
    return res.status(400).json({ success: false, error: 'Doctor ID and appointment date are required.' });
  }

  try {
    const doctor = await queryOne<any>('SELECT * FROM doctors WHERE id = ?', [doctor_id]);
    if (!doctor) {
      return res.status(404).json({ success: false, error: 'Doctor not found.' });
    }

    // FR-02.3: Check if doctor is on leave
    if (doctor.is_on_leave) {
      return res.json({
        success: true,
        isOnLeave: true,
        message: 'Doctor is currently marked as On Leave on the system calendar.',
        availableSlots: []
      });
    }

    // Query existing scheduled or in-progress bookings for the day (FR-02.1)
    const booked = await queryAll<any>(
      `SELECT time_slot FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND status IN ('Scheduled', 'In-Progress')`,
      [doctor_id, date]
    );

    const bookedSlots = booked.map((b) => b.time_slot);
    const availableSlots = STANDARD_SLOTS.filter((slot) => !bookedSlots.includes(slot));

    return res.json({
      success: true,
      isOnLeave: false,
      date,
      availableSlots,
      bookedSlots
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Error checking doctor availability.' });
  }
});

// POST /api/appointments (Automated 10-step Appointment Scheduling - FR-02.1, FR-02.4)
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { patient_id, doctor_id, appointment_date, time_slot, notes } = req.body;

  if (!patient_id || !doctor_id || !appointment_date || !time_slot) {
    return res.status(400).json({ success: false, error: 'Missing mandatory appointment parameters.' });
  }

  try {
    // 1. Verify Patient & Check Anti-Hoarding Restriction (FR-02.4: Max 2 active pending appointments)
    const activeCount = await queryOne<any>(
      `SELECT COUNT(*) as count FROM appointments WHERE patient_id = ? AND status = 'Scheduled'`,
      [patient_id]
    );

    if (activeCount && activeCount.count >= 2) {
      return res.status(400).json({
        success: false,
        error: 'Patients are restricted to a maximum of two active pending appointments to prevent slot hoarding.'
      });
    }

    // 2. Query Doctor Availability & Leave (FR-02.3)
    const doctor = await queryOne<any>('SELECT * FROM doctors WHERE id = ?', [doctor_id]);
    if (!doctor) {
      return res.status(404).json({ success: false, error: 'Selected doctor does not exist.' });
    }
    if (doctor.is_on_leave) {
      return res.status(400).json({ success: false, error: 'Doctor is on approved leave for the requested duration.' });
    }

    // 3. Conflict Validation (FR-02.1)
    const conflict = await queryOne(
      `SELECT id FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND time_slot = ? AND status IN ('Scheduled', 'In-Progress')`,
      [doctor_id, appointment_date, time_slot]
    );

    if (conflict) {
      return res.status(409).json({
        success: false,
        error: 'Conflict detected: The selected doctor slot has already been booked. Please choose another time slot.'
      });
    }

    // 4. Store Booking
    const result = await runQuery(
      `INSERT INTO appointments (patient_id, doctor_id, appointment_date, time_slot, status, notes)
       VALUES (?, ?, ?, ?, 'Scheduled', ?)`,
      [patient_id, doctor_id, appointment_date, time_slot, notes || '']
    );

    // 5. Emit automated mock notification (FR-04.2)
    const patient = await queryOne<any>('SELECT * FROM patients WHERE id = ?', [patient_id]);
    if (patient) {
      await runQuery(
        `INSERT INTO notifications (recipient, channel, subject, message) VALUES (?, ?, ?, ?)`,
        [
          patient.contact_number,
          'SMS',
          'Appointment Confirmation',
          `Your appointment with ${doctor.specialization} specialist is confirmed on ${appointment_date} at ${time_slot}. Ref ID: AP-${result.lastID}`
        ]
      );
    }

    // 6. Broadcast live booking to dashboards
    broadcastMessage('NEW_APPOINTMENT', {
      appointmentId: result.lastID,
      patient_id,
      doctor_id,
      appointment_date,
      time_slot
    });

    await logAuditEvent(req.user?.id || null, 'APPOINTMENT_BOOKED', `Appointment AP-${result.lastID} booked for Patient ID ${patient_id}`, req.ip);

    return res.status(201).json({
      success: true,
      message: 'Appointment scheduled and confirmed successfully.',
      appointment: {
        id: result.lastID,
        patient_id,
        doctor_id,
        appointment_date,
        time_slot,
        status: 'Scheduled'
      }
    });
  } catch (err: any) {
    console.error('[ClinixOS Appointments] Booking error:', err);
    return res.status(500).json({ success: false, error: 'Failed to process appointment booking.' });
  }
});

// PATCH /api/appointments/:id/status (Status tags: Scheduled, In-Progress, Completed, Cancelled - FR-02.2)
router.patch('/:id/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  const appointmentId = req.params.id;
  const { status } = req.body;

  const valid = ['Scheduled', 'In-Progress', 'Completed', 'Cancelled'];
  if (!valid.includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid appointment status.' });
  }

  try {
    const appointment = await queryOne<any>('SELECT * FROM appointments WHERE id = ?', [appointmentId]);
    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Appointment not found.' });
    }

    await runQuery('UPDATE appointments SET status = ? WHERE id = ?', [status, appointmentId]);

    // If cancelled, trigger immediate cancellation alert to patient & doctor (FR-04.2)
    if (status === 'Cancelled') {
      const patient = await queryOne<any>('SELECT * FROM patients WHERE id = ?', [appointment.patient_id]);
      if (patient) {
        await runQuery(
          `INSERT INTO notifications (recipient, channel, subject, message) VALUES (?, ?, ?, ?)`,
          [
            patient.contact_number,
            'SMS',
            'Appointment Cancellation',
            `Your scheduled appointment on ${appointment.appointment_date} at ${appointment.time_slot} has been cancelled.`
          ]
        );
      }
    }

    // If marked Completed, auto-generate initial bill itemization if not already existing (FR-09.1)
    if (status === 'Completed') {
      const existingBill = await queryOne('SELECT id FROM bills WHERE appointment_id = ?', [appointmentId]);
      if (!existingBill) {
        const doctor = await queryOne<any>('SELECT consultation_fee FROM doctors WHERE id = ?', [appointment.doctor_id]);
        const fee = doctor?.consultation_fee || 50.0;
        await runQuery(
          `INSERT INTO bills (appointment_id, patient_id, total_amount, paid_amount, payment_status) VALUES (?, ?, ?, 0, 'Pending')`,
          [appointmentId, appointment.patient_id, fee]
        );
      }
    }

    await logAuditEvent(req.user?.id || null, 'APPOINTMENT_STATUS_UPDATE', `Appointment AP-${appointmentId} transitioned to ${status}`, req.ip);

    return res.json({
      success: true,
      message: `Appointment status updated to ${status}.`,
      appointment: { id: Number(appointmentId), status }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Error updating appointment status.' });
  }
});

export default router;
