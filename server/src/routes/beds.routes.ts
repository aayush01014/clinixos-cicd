import { Router, Response } from 'express';
import { queryAll, queryOne, runQuery } from '../database/db';
import { authenticateToken, AuthRequest, requireRoles, logAuditEvent } from '../middleware/auth';
import { broadcastMessage } from '../websocket';

const router = Router();

// GET /api/beds (Live Ward Bed Status & Layout - FR-03.1)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const beds = await queryAll(`
      SELECT b.*, p.pid as patient_pid, p.first_name, p.last_name, p.gender
      FROM beds b
      LEFT JOIN patients p ON b.current_patient_id = p.id
      ORDER BY b.ward_number ASC, b.bed_label ASC
    `);

    // Calculate Occupancy Summary & ICU Vacancy Rate (FR-03.4)
    const totalBeds = beds.length;
    const occupied = beds.filter((b) => b.status === 'Occupied').length;
    const vacant = beds.filter((b) => b.status === 'Vacant').length;
    const cleaning = beds.filter((b) => b.status === 'Cleaning').length;
    const maintenance = beds.filter((b) => b.status === 'Maintenance').length;

    const icuBeds = beds.filter((b) => b.ward_type === 'ICU');
    const icuTotal = icuBeds.length;
    const icuVacant = icuBeds.filter((b) => b.status === 'Vacant').length;
    const icuVacancyRate = icuTotal > 0 ? (icuVacant / icuTotal) * 100 : 100;

    return res.json({
      success: true,
      stats: {
        totalBeds,
        occupied,
        vacant,
        cleaning,
        maintenance,
        occupancyRate: totalBeds > 0 ? Math.round((occupied / totalBeds) * 100) : 0,
        icuTotal,
        icuVacant,
        icuVacancyRate: Math.round(icuVacancyRate)
      },
      data: beds
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve ward bed mapping data.' });
  }
});

// PATCH /api/beds/:id/status (Bed status update - FR-03.2, FR-03.3, BR-03, FR-03.4)
router.patch('/:id/status', authenticateToken, requireRoles(['Nurse', 'Admin']), async (req: AuthRequest, res: Response) => {
  const bedId = req.params.id;
  const { status, patient_id } = req.body;

  const validStatuses = ['Vacant', 'Occupied', 'Cleaning', 'Maintenance'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid bed status specified.' });
  }

  try {
    const bed = await queryOne('SELECT * FROM beds WHERE id = ?', [bedId]);
    if (!bed) {
      return res.status(404).json({ success: false, error: 'Bed unit not found.' });
    }

    // BR-03: Bed cannot be assigned if cleaning or maintenance
    if (patient_id && (status === 'Cleaning' || status === 'Maintenance')) {
      return res.status(400).json({
        success: false,
        error: 'A ward bed cannot be assigned to a patient while marked as Cleaning Needed or Under Maintenance.'
      });
    }

    let assignedPatientId = bed.current_patient_id;
    let checkInTime = bed.check_in_time;

    if (status === 'Occupied') {
      if (!patient_id && !assignedPatientId) {
        return res.status(400).json({ success: false, error: 'Patient ID is required to mark a bed as Occupied.' });
      }
      assignedPatientId = patient_id || assignedPatientId;
      checkInTime = new Date().toISOString();
    } else if (status === 'Vacant' || status === 'Cleaning') {
      assignedPatientId = null;
      checkInTime = null;
    }

    await runQuery(
      `UPDATE beds SET status = ?, current_patient_id = ?, check_in_time = ? WHERE id = ?`,
      [status, assignedPatientId, checkInTime, bedId]
    );

    // Audit log (FR-03.3)
    await logAuditEvent(
      req.user?.id || null,
      'BED_STATUS_CHANGED',
      `Bed ${bed.bed_label} in ${bed.ward_number} updated from ${bed.status} to ${status}`,
      req.ip
    );

    // Re-check ICU bed vacancy rate for emergency banner (FR-03.4)
    const icuBeds = await queryAll('SELECT * FROM beds WHERE ward_type = "ICU"');
    const icuVacantCount = icuBeds.filter((b) => b.status === 'Vacant').length;
    const icuVacancyRate = icuBeds.length > 0 ? (icuVacantCount / icuBeds.length) * 100 : 100;

    if (icuVacancyRate < 10) {
      broadcastMessage('ICU_WARNING', {
        warning: 'CRITICAL ALERT: Hospital ICU bed vacancy has dropped below 10% threshold!',
        icuTotal: icuBeds.length,
        icuVacant: icuVacantCount,
        icuVacancyRate: Math.round(icuVacancyRate)
      });
    }

    // Broadcast live bed update to all active web consoles
    broadcastMessage('BED_STATUS_UPDATE', {
      bedId: Number(bedId),
      bed_label: bed.bed_label,
      ward_number: bed.ward_number,
      status,
      current_patient_id: assignedPatientId
    });

    return res.json({
      success: true,
      message: `Bed ${bed.bed_label} status updated to ${status}.`,
      bed: {
        id: Number(bedId),
        bed_label: bed.bed_label,
        status,
        current_patient_id: assignedPatientId
      }
    });
  } catch (err: any) {
    console.error('[ClinixOS Beds] Status update error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update bed status.' });
  }
});

// POST /api/beds (Dynamically add a new hospital bed)
router.post('/', authenticateToken, requireRoles(['Nurse', 'Admin']), async (req: AuthRequest, res: Response) => {
  const { ward_number, ward_type = 'General', bed_label, status = 'Vacant' } = req.body;
  if (!ward_number || !bed_label) {
    return res.status(400).json({ success: false, error: 'Ward name/number and Bed label are mandatory.' });
  }

  try {
    const existing = await queryOne('SELECT id FROM beds WHERE bed_label = ?', [bed_label.trim()]);
    if (existing) {
      return res.status(409).json({ success: false, error: `Bed label "${bed_label}" already exists in the hospital inventory.` });
    }

    const result = await runQuery(
      `INSERT INTO beds (ward_number, ward_type, bed_label, status) VALUES (?, ?, ?, ?)`,
      [ward_number.trim(), ward_type, bed_label.trim(), status]
    );

    broadcastMessage('BED_STATUS_UPDATE', { action: 'CREATED' });
    return res.status(201).json({ success: true, id: result.lastID, message: `Bed ${bed_label} added to ${ward_number}.` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/beds/:id (Decommission hospital bed)
router.delete('/:id', authenticateToken, requireRoles(['Admin', 'Nurse']), async (req: AuthRequest, res: Response) => {
  const bedId = req.params.id;
  try {
    const bed = await queryOne<any>('SELECT * FROM beds WHERE id = ?', [bedId]);
    if (!bed) return res.status(404).json({ success: false, error: 'Bed unit not found.' });

    if (bed.status === 'Occupied') {
      return res.status(400).json({ success: false, error: 'Cannot decommission an occupied bed. Discharge or transfer patient first.' });
    }

    await runQuery('DELETE FROM beds WHERE id = ?', [bedId]);
    broadcastMessage('BED_STATUS_UPDATE', { action: 'DELETED' });
    return res.json({ success: true, message: `Bed ${bed.bed_label} removed from system.` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
