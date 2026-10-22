import { Router, Response } from 'express';
import { queryAll, queryOne, runQuery } from '../database/db';
import { authenticateToken, AuthRequest, requireRoles, logAuditEvent } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const router = Router();

// ─── GET /api/users ──────────────────────────────────────────
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { search, role, is_active } = req.query;

    let query = `
      SELECT id, full_name, email, role, department, created_at,
             last_login, is_active, employee_id, specialization
      FROM users
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (full_name LIKE ? OR email LIKE ? OR COALESCE(employee_id, '') LIKE ?)`;
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (role) { query += ` AND role = ?`; params.push(role); }
    if (is_active !== undefined && is_active !== '') {
      query += ` AND is_active = ?`;
      params.push(is_active === 'true' ? 1 : 0);
    }
    query += ` ORDER BY created_at DESC`;

    const users = await queryAll(query, params);
    const safeUsers = users.map((u: any) => ({ ...u, is_active: !!u.is_active }));

    // Stats
    const statsRaw: any = await queryOne(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS inactive,
        SUM(CASE WHEN role = 'Admin' THEN 1 ELSE 0 END) AS admin_count,
        SUM(CASE WHEN role = 'Doctor' THEN 1 ELSE 0 END) AS doctor_count,
        SUM(CASE WHEN role = 'Nurse' THEN 1 ELSE 0 END) AS nurse_count,
        SUM(CASE WHEN role = 'Receptionist' THEN 1 ELSE 0 END) AS receptionist_count,
        SUM(CASE WHEN role = 'Pharmacist' THEN 1 ELSE 0 END) AS pharmacist_count,
        SUM(CASE WHEN role = 'Patient' THEN 1 ELSE 0 END) AS patient_count
      FROM users
    `, []);

    const stats = {
      total: statsRaw?.total ?? 0,
      active: statsRaw?.active ?? 0,
      inactive: statsRaw?.inactive ?? 0,
      by_role: {
        Admin: statsRaw?.admin_count ?? 0,
        Doctor: statsRaw?.doctor_count ?? 0,
        Nurse: statsRaw?.nurse_count ?? 0,
        Receptionist: statsRaw?.receptionist_count ?? 0,
        Pharmacist: statsRaw?.pharmacist_count ?? 0,
        Patient: statsRaw?.patient_count ?? 0,
      }
    };

    res.json({ success: true, data: safeUsers, stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/users ─────────────────────────────────────────
router.post('/', authenticateToken, requireRoles(['Admin']), async (req: AuthRequest, res: Response) => {
  try {
    const {
      full_name, email, password, role,
      department, specialization, employee_id
    } = req.body;

    if (!full_name || !email || !password || !role) {
      return res.status(400).json({ success: false, error: 'full_name, email, password, and role are required.' });
    }

    const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ success: false, error: 'A user with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await runQuery(`
      INSERT INTO users (full_name, email, password_hash, role, department, specialization, employee_id, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
    `, [full_name, email, hashedPassword, role, department || null, specialization || null, employee_id || null]);

    await logAuditEvent(req.user?.id ?? null, 'USER_CREATED', `Created user: ${email} (${role})`, req.ip);

    res.json({ success: true, userId: result.lastID });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PATCH /api/users/:id ────────────────────────────────────
router.patch('/:id', authenticateToken, requireRoles(['Admin']), async (req: AuthRequest, res: Response) => {
  try {
    const {
      full_name, email, password, role,
      department, specialization, employee_id
    } = req.body;
    const { id } = req.params;

    const fields: string[] = [];
    const params: any[] = [];

    if (full_name) { fields.push('full_name = ?'); params.push(full_name); }
    if (email) { fields.push('email = ?'); params.push(email); }
    if (role) { fields.push('role = ?'); params.push(role); }
    if (department !== undefined) { fields.push('department = ?'); params.push(department || null); }
    if (specialization !== undefined) { fields.push('specialization = ?'); params.push(specialization || null); }
    if (employee_id !== undefined) { fields.push('employee_id = ?'); params.push(employee_id || null); }
    if (password && password.trim()) {
      const hash = await bcrypt.hash(password, 12);
      fields.push('password_hash = ?');
      params.push(hash);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update.' });
    }

    await runQuery(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
    await logAuditEvent(req.user?.id ?? null, 'USER_UPDATED', `Updated user ID: ${id}`, req.ip);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PATCH /api/users/:id/toggle-active ─────────────────────
router.patch('/:id/toggle-active', authenticateToken, requireRoles(['Admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { is_active } = req.body;
    const { id } = req.params;

    if (String(req.user?.id) === id && !is_active) {
      return res.status(400).json({ success: false, error: 'You cannot deactivate your own account.' });
    }

    await runQuery('UPDATE users SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PATCH /api/users/:id/reset-password ─────────────────────
router.patch('/:id/reset-password', authenticateToken, requireRoles(['Admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
    }

    const hash = await bcrypt.hash(password, 12);
    await runQuery('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.params.id]);
    await logAuditEvent(req.user?.id ?? null, 'PASSWORD_RESET', `Reset password for user ID: ${req.params.id}`, req.ip);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /api/users/:id ────────────────────────────────────
router.delete('/:id', authenticateToken, requireRoles(['Admin']), async (req: AuthRequest, res: Response) => {
  try {
    if (String(req.user?.id) === req.params.id) {
      return res.status(400).json({ success: false, error: 'You cannot delete your own account.' });
    }
    // Soft delete – deactivate only
    await runQuery('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id]);
    await logAuditEvent(req.user?.id ?? null, 'USER_DEACTIVATED', `Soft-deleted user ID: ${req.params.id}`, req.ip);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
