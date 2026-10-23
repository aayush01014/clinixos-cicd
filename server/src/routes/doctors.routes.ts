import { Router, Response } from 'express';
import { queryAll, queryOne, runQuery } from '../database/db';
import { authenticateToken, AuthRequest, requireRoles } from '../middleware/auth';

const router = Router();

// GET /api/doctors (List all active doctors with department info)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const doctors = await queryAll(`
      SELECT d.*, u.email
      FROM doctors d
      JOIN users u ON d.user_id = u.id
      ORDER BY d.department ASC, d.id ASC
    `);

    return res.json({ success: true, count: doctors.length, data: doctors });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve doctors directory.' });
  }
});

// PATCH /api/doctors/:id/leave (Toggle doctor on-leave status - FR-02.3)
router.patch('/:id/leave', authenticateToken, requireRoles(['Doctor', 'Admin']), async (req: AuthRequest, res: Response) => {
  const doctorId = req.params.id;
  const { is_on_leave } = req.body;

  try {
    const doctor = await queryOne('SELECT * FROM doctors WHERE id = ?', [doctorId]);
    if (!doctor) {
      return res.status(404).json({ success: false, error: 'Doctor not found.' });
    }

    const leaveStatus = is_on_leave ? 1 : 0;
    await runQuery('UPDATE doctors SET is_on_leave = ? WHERE id = ?', [leaveStatus, doctorId]);

    return res.json({
      success: true,
      message: `Doctor leave status updated to ${leaveStatus === 1 ? 'On Leave' : 'Active'}.`,
      doctor: { id: Number(doctorId), is_on_leave: leaveStatus === 1 }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to update leave status.' });
  }
});

export default router;
