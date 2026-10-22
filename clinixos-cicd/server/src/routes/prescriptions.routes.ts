import { Router, Response } from 'express';
import { queryAll, queryOne, runQuery } from '../database/db';
import { authenticateToken, AuthRequest, requireRoles, logAuditEvent } from '../middleware/auth';
import { ICD10_CATALOG } from '../database/catalogs/icd10';

const router = Router();

// GET /api/prescriptions/icd10 (Search ICD-10 Diagnostic catalog)
router.get('/icd10', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { q } = req.query;

  if (!q || typeof q !== 'string') {
    return res.json({ success: true, data: ICD10_CATALOG.slice(0, 30) });
  }

  const queryLower = q.toLowerCase();
  const filtered = ICD10_CATALOG.filter(
    (item) =>
      item.code.toLowerCase().includes(queryLower) ||
      item.description.toLowerCase().includes(queryLower) ||
      item.category.toLowerCase().includes(queryLower)
  );

  return res.json({ success: true, count: filtered.length, data: filtered.slice(0, 40) });
});

// GET /api/prescriptions (List prescriptions)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { patient_id, doctor_id, status } = req.query;

  try {
    let sql = `
      SELECT pr.*,
             p.pid as patient_pid, p.first_name as patient_first, p.last_name as patient_last,
             d.specialization, d.department, d.license_number
      FROM prescriptions pr
      JOIN patients p ON pr.patient_id = p.id
      JOIN doctors d ON pr.doctor_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (patient_id) {
      sql += ' AND pr.patient_id = ?';
      params.push(patient_id);
    }
    if (doctor_id) {
      sql += ' AND pr.doctor_id = ?';
      params.push(doctor_id);
    }
    if (status) {
      sql += ' AND pr.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY pr.created_at DESC';
    const prescriptions = await queryAll(sql, params);

    // Fetch items for each prescription
    for (const pr of prescriptions) {
      const items = await queryAll(
        `SELECT pi.*, m.name as medication_name, m.barcode, m.unit_price, m.dosage_form, m.strength
         FROM prescription_items pi
         JOIN medications m ON pi.medication_id = m.id
         WHERE pi.prescription_id = ?`,
        [pr.id]
      );
      pr.items = items;
    }

    return res.json({ success: true, count: prescriptions.length, data: prescriptions });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve prescriptions.' });
  }
});

// POST /api/prescriptions (Doctor issues digital prescription - BR-02)
router.post('/', authenticateToken, requireRoles(['Doctor', 'Admin']), async (req: AuthRequest, res: Response) => {
  const { appointment_id, patient_id, doctor_id, diagnosis, icd10_code, doctor_signature, items } = req.body;

  if (!patient_id || !doctor_id || !diagnosis || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Patient, Doctor, Diagnosis, and at least one medication item are required to issue a prescription.'
    });
  }

  try {
    // Verify Doctor License (BR-02: active license required)
    const doctor = await queryOne<any>('SELECT license_number FROM doctors WHERE id = ?', [doctor_id]);
    if (!doctor || !doctor.license_number) {
      return res.status(400).json({
        success: false,
        error: 'Business Rule Violation (BR-02): Doctor must possess an active verified license to sign and issue digital prescriptions.'
      });
    }

    const signature = doctor_signature || `Signed by Lic. #${doctor.license_number} at ${new Date().toISOString()}`;

    const rxResult = await runQuery(
      `INSERT INTO prescriptions (appointment_id, patient_id, doctor_id, diagnosis, icd10_code, status, doctor_signature)
       VALUES (?, ?, ?, ?, ?, 'Issued', ?)`,
      [appointment_id || null, patient_id, doctor_id, diagnosis, icd10_code || null, signature]
    );

    const prescriptionId = rxResult.lastID;

    // Insert prescription items
    for (const item of items) {
      await runQuery(
        `INSERT INTO prescription_items (prescription_id, medication_id, dosage, frequency, duration_days, quantity)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [prescriptionId, item.medication_id, item.dosage, item.frequency, item.duration_days, item.quantity]
      );
    }

    await logAuditEvent(
      req.user?.id || null,
      'PRESCRIPTION_ISSUED',
      `Prescription RX-${prescriptionId} issued for Patient ID ${patient_id}`,
      req.ip
    );

    return res.status(201).json({
      success: true,
      message: 'Digital prescription issued and routed to pharmacy queue.',
      prescriptionId
    });
  } catch (err: any) {
    console.error('[ClinixOS Prescriptions] Error creating prescription:', err);
    return res.status(500).json({ success: false, error: 'Failed to record prescription.' });
  }
});

export default router;
