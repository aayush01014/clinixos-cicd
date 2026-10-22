import { Router, Response } from 'express';
import { queryAll, queryOne, runQuery } from '../database/db';
import { authenticateToken, AuthRequest, requireRoles } from '../middleware/auth';

const router = Router();

// GET /api/feedback (List feedback records)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { doctor_id } = req.query;

  try {
    let sql = `
      SELECT f.*,
             p.pid as patient_pid, p.first_name, p.last_name,
             d.specialization, d.department
      FROM feedback f
      JOIN patients p ON f.patient_id = p.id
      JOIN doctors d ON f.doctor_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (doctor_id) {
      sql += ' AND f.doctor_id = ?';
      params.push(doctor_id);
    }

    sql += ' ORDER BY f.created_at DESC';
    const feedbackList = await queryAll(sql, params);

    // Compute average rating
    const avgRecord = await queryOne<any>(
      `SELECT AVG(rating) as avgRating, COUNT(*) as totalFeedback FROM feedback ${doctor_id ? 'WHERE doctor_id = ?' : ''}`,
      doctor_id ? [doctor_id] : []
    );

    return res.json({
      success: true,
      stats: {
        averageRating: Number(avgRecord?.avgRating || 5).toFixed(1),
        totalReviews: avgRecord?.totalFeedback || 0
      },
      data: feedbackList
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve feedback.' });
  }
});

// POST /api/feedback (Patient submits rating & feedback - FR-01.5)
router.post('/', authenticateToken, requireRoles(['Patient', 'Admin']), async (req: AuthRequest, res: Response) => {
  const { doctor_id, rating, comments, patient_id } = req.body;

  if (!doctor_id || !rating || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, error: 'Doctor ID and a rating between 1 and 5 stars are required.' });
  }

  try {
    let targetPatientId = patient_id;
    if (req.user?.role === 'Patient') {
      const patient = await queryOne<any>('SELECT id FROM patients WHERE user_id = ?', [req.user.id]);
      if (patient) targetPatientId = patient.id;
    }

    if (!targetPatientId) {
      return res.status(400).json({ success: false, error: 'Valid Patient ID required to submit feedback.' });
    }

    const result = await runQuery(
      `INSERT INTO feedback (patient_id, doctor_id, rating, comments) VALUES (?, ?, ?, ?)`,
      [targetPatientId, doctor_id, rating, comments || '']
    );

    return res.status(201).json({
      success: true,
      message: 'Thank you! Your feedback has been securely registered.',
      feedbackId: result.lastID
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Error recording consultation feedback.' });
  }
});

export default router;
