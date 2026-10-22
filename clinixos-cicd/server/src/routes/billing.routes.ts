import { Router, Response } from 'express';
import { queryAll, queryOne, runQuery } from '../database/db';
import { authenticateToken, AuthRequest, requireRoles, logAuditEvent } from '../middleware/auth';
import { broadcastMessage } from '../websocket';

const router = Router();

// GET /api/billing (List bills - FR-09.1)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { patient_id, status } = req.query;

  try {
    let sql = `
      SELECT b.*,
             p.pid as patient_pid, p.first_name as patient_first, p.last_name as patient_last, p.contact_number as patient_phone,
             a.appointment_date, a.time_slot,
             d.specialization as doctor_spec, d.department as doctor_dept
      FROM bills b
      JOIN patients p ON b.patient_id = p.id
      LEFT JOIN appointments a ON b.appointment_id = a.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // If patient role, restrict to their own bills
    if (req.user?.role === 'Patient') {
      const patient = await queryOne<any>('SELECT id FROM patients WHERE user_id = ?', [req.user.id]);
      if (patient) {
        sql += ' AND b.patient_id = ?';
        params.push(patient.id);
      } else {
        return res.json({ success: true, count: 0, data: [] });
      }
    } else if (patient_id) {
      sql += ' AND b.patient_id = ?';
      params.push(patient_id);
    }

    if (status) {
      sql += ' AND b.payment_status = ?';
      params.push(status);
    }

    sql += ' ORDER BY b.created_at DESC';
    const bills = await queryAll(sql, params);

    return res.json({ success: true, count: bills.length, data: bills });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve bills registry.' });
  }
});

// GET /api/billing/:id (Single bill with line-item breakdown - FR-09.1, FR-09.4)
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const billId = req.params.id;

  try {
    const bill = await queryOne<any>(
      `SELECT b.*,
              p.pid as patient_pid, p.first_name, p.last_name, p.dob, p.gender, p.contact_number,
              a.appointment_date, a.time_slot,
              d.specialization as doctor_spec, d.department, d.consultation_fee, d.room_number
       FROM bills b
       JOIN patients p ON b.patient_id = p.id
       LEFT JOIN appointments a ON b.appointment_id = a.id
       LEFT JOIN doctors d ON a.doctor_id = d.id
       WHERE b.id = ?`,
      [billId]
    );

    if (!bill) {
      return res.status(404).json({ success: false, error: 'Bill record not found.' });
    }

    // Line items: Doctor consultation fee
    const lineItems: any[] = [
      {
        item_type: 'Doctor Consultation',
        description: `${bill.doctor_spec || 'General'} Specialist Clinical Review`,
        amount: bill.consultation_fee || 50.0
      }
    ];

    // Check if bed charges apply
    const bed = await queryOne<any>('SELECT * FROM beds WHERE current_patient_id = ?', [bill.patient_id]);
    if (bed) {
      const bedRate = bed.ward_type === 'ICU' ? 250.0 : bed.ward_type === 'Semi-Private' ? 120.0 : 60.0;
      lineItems.push({
        item_type: 'Ward Inpatient Care',
        description: `${bed.ward_type} Bed (${bed.bed_label}) Hospitalization`,
        amount: bedRate
      });
    }

    // Check if dispensed prescriptions apply
    if (bill.appointment_id) {
      const rx = await queryOne<any>('SELECT id FROM prescriptions WHERE appointment_id = ? AND status = "Dispensed"', [bill.appointment_id]);
      if (rx) {
        const items = await queryAll<any>(
          `SELECT pi.quantity, m.name, m.unit_price, (pi.quantity * m.unit_price) as subtotal
           FROM prescription_items pi
           JOIN medications m ON pi.medication_id = m.id
           WHERE pi.prescription_id = ?`,
          [rx.id]
        );
        for (const item of items) {
          lineItems.push({
            item_type: 'Pharmacy Dispense',
            description: `${item.name} (Qty: ${item.quantity})`,
            amount: item.subtotal
          });
        }
      }
    }

    return res.json({
      success: true,
      data: {
        bill,
        lineItems
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve invoice details.' });
  }
});

// POST /api/billing/:id/pay (Payment processing & Insurance recording - FR-09.2, FR-09.3)
router.post('/:id/pay', authenticateToken, requireRoles(['Receptionist', 'Admin', 'Patient']), async (req: AuthRequest, res: Response) => {
  const billId = req.params.id;
  const { paid_amount, payment_method, insurance_provider, insurance_policy_no, insurance_claim_amount } = req.body;

  const validMethods = ['Cash', 'Card', 'Online'];
  if (!validMethods.includes(payment_method)) {
    return res.status(400).json({ success: false, error: 'Valid payment method required (Cash, Card, Online).' });
  }

  try {
    const bill = await queryOne<any>('SELECT * FROM bills WHERE id = ?', [billId]);
    if (!bill) {
      return res.status(404).json({ success: false, error: 'Invoice does not exist.' });
    }

    const newPaid = Number(bill.paid_amount || 0) + Number(paid_amount || 0);
    const claimAmount = Number(insurance_claim_amount || 0);
    const effectiveTotal = bill.total_amount - claimAmount;

    let newStatus: 'Paid' | 'Partially Paid' | 'Pending' = 'Pending';
    if (newPaid >= effectiveTotal) {
      newStatus = 'Paid';
    } else if (newPaid > 0) {
      newStatus = 'Partially Paid';
    }

    await runQuery(
      `UPDATE bills
       SET paid_amount = ?,
           payment_status = ?,
           payment_method = ?,
           insurance_provider = ?,
           insurance_policy_no = ?,
           insurance_claim_amount = ?
       WHERE id = ?`,
      [
        newPaid,
        newStatus,
        payment_method,
        insurance_provider || bill.insurance_provider || null,
        insurance_policy_no || bill.insurance_policy_no || null,
        claimAmount,
        billId
      ]
    );

    await logAuditEvent(
      req.user?.id || null,
      'PAYMENT_RECORDED',
      `Payment of $${paid_amount} logged for Bill INV-${billId} via ${payment_method}. New status: ${newStatus}`,
      req.ip
    );

    broadcastMessage('BILL_GENERATED', {
      billId: Number(billId),
      patient_id: bill.patient_id,
      payment_status: newStatus,
      paid_amount: newPaid
    });

    return res.json({
      success: true,
      message: 'Payment and insurance reconciliation processed successfully.',
      receipt: {
        billId: Number(billId),
        total_amount: bill.total_amount,
        paid_amount: newPaid,
        payment_status: newStatus,
        payment_method,
        insurance_claim_amount: claimAmount,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err: any) {
    console.error('[ClinixOS Billing] Payment error:', err);
    return res.status(500).json({ success: false, error: 'Failed to process transaction.' });
  }
});

export default router;
