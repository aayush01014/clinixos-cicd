import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { queryAll, queryOne, runQuery } from '../database/db';
import { authenticateToken, AuthRequest, requireRoles, logAuditEvent } from '../middleware/auth';

const router = Router();

// Multer storage for Clinical Document Archives (FR-01.4: PDF up to 5MB)
const uploadsDir = process.env.UPLOADS_DIR || path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `doc-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF documents up to 5MB are permitted for clinical archival.'));
    }
  }
});

// GET /api/patients (Search patients by PID, Name, or Contact - FR-01.2)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { q } = req.query;

  try {
    let sql = 'SELECT * FROM patients';
    let params: any[] = [];

    if (q && typeof q === 'string') {
      const searchTerm = `%${q.trim()}%`;
      sql += ` WHERE pid LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR contact_number LIKE ?`;
      params = [searchTerm, searchTerm, searchTerm, searchTerm];
    }

    sql += ' ORDER BY id DESC LIMIT 50';
    const patients = await queryAll(sql, params);
    return res.json({ success: true, count: patients.length, data: patients });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve patient registry.' });
  }
});

// GET /api/patients/:id (Full Clinical Timeline & Records - FR-01.2)
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const patientId = req.params.id;

  try {
    const patient = await queryOne('SELECT * FROM patients WHERE id = ? OR pid = ?', [patientId, patientId]);
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient record not found.' });
    }

    // Historical Appointments
    const appointments = await queryAll(
      `SELECT a.*, d.specialization, d.department, d.room_number, d.consultation_fee
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.id
       WHERE a.patient_id = ?
       ORDER BY a.appointment_date DESC, a.time_slot DESC`,
      [patient.id]
    );

    // Historical Prescriptions
    const prescriptions = await queryAll(
      `SELECT pr.*, d.specialization, d.license_number
       FROM prescriptions pr
       JOIN doctors d ON pr.doctor_id = d.id
       WHERE pr.patient_id = ?
       ORDER BY pr.created_at DESC`,
      [patient.id]
    );

    // Historical Invoices & Bills
    const bills = await queryAll(
      `SELECT * FROM bills WHERE patient_id = ? ORDER BY created_at DESC`,
      [patient.id]
    );

    // Current Bed Assignment if admitted
    const currentBed = await queryOne(
      `SELECT * FROM beds WHERE current_patient_id = ?`,
      [patient.id]
    );

    // Archived Clinical Documents
    const documents = await queryAll(
      `SELECT id, file_name, file_size, uploaded_at FROM clinical_documents WHERE patient_id = ? ORDER BY uploaded_at DESC`,
      [patient.id]
    );

    return res.json({
      success: true,
      data: {
        patient,
        currentBed,
        appointments,
        prescriptions,
        bills,
        documents
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Error fetching patient clinical timeline.' });
  }
});

// POST /api/patients (Receptionist / Staff Patient Intake - FR-01.1, FR-01.3)
router.post('/', authenticateToken, requireRoles(['Receptionist', 'Nurse', 'Admin']), async (req: AuthRequest, res: Response) => {
  const { first_name, last_name, dob, gender, contact_number, emergency_contact, blood_group } = req.body;

  // Mandatory fields validation (FR-01.3)
  if (!first_name || !last_name || !dob || !gender || !contact_number || !emergency_contact) {
    return res.status(400).json({
      success: false,
      error: 'Mandatory fields missing: Full Name, Date of Birth, Gender, Emergency Contact, and Contact Number are required.'
    });
  }

  try {
    // Generate sequential unique PID (FR-01.1)
    const countResult = await queryOne<any>('SELECT COUNT(*) as count FROM patients');
    const seqNum = (countResult?.count || 0) + 1;
    const pid = `PT-2026-${String(seqNum).padStart(4, '0')}`;

    const result = await runQuery(
      `INSERT INTO patients (pid, first_name, last_name, dob, gender, contact_number, emergency_contact, blood_group)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [pid, first_name, last_name, dob, gender, contact_number, emergency_contact, blood_group || null]
    );

    await logAuditEvent(req.user?.id || null, 'PATIENT_INTAKE', `Walk-in patient registered with PID ${pid}`, req.ip);

    return res.status(201).json({
      success: true,
      message: 'Patient registered successfully in centralized index.',
      patient: {
        id: result.lastID,
        pid,
        first_name,
        last_name,
        dob,
        gender,
        contact_number,
        emergency_contact
      }
    });
  } catch (err: any) {
    console.error('[ClinixOS Patients] Intake error:', err);
    return res.status(500).json({ success: false, error: 'Failed to record patient registration.' });
  }
});

// POST /api/patients/:id/documents (Upload clinical documents - FR-01.4)
router.post('/:id/documents', authenticateToken, upload.single('document'), async (req: AuthRequest, res: Response) => {
  const patientId = req.params.id;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ success: false, error: 'No file uploaded or file did not meet PDF criteria.' });
  }

  try {
    const patient = await queryOne('SELECT id FROM patients WHERE id = ?', [patientId]);
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient does not exist.' });
    }

    const result = await runQuery(
      `INSERT INTO clinical_documents (patient_id, file_name, file_path, file_size) VALUES (?, ?, ?, ?)`,
      [patient.id, file.originalname, file.filename, file.size]
    );

    return res.status(201).json({
      success: true,
      message: 'Historical clinical document archived securely.',
      document: {
        id: result.lastID,
        file_name: file.originalname,
        file_size: file.size
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Error uploading clinical record.' });
  }
});

export default router;
