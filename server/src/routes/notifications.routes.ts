import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { queryAll, queryOne, runQuery } from '../database/db';

const router = Router();

// Ensure notifications table exists
async function ensureNotificationsTable() {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS system_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      target_role TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info', -- 'info' | 'warning' | 'critical' | 'success'
      is_read INTEGER DEFAULT 0,
      link TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
ensureNotificationsTable();

// ─── GET /api/notifications ──────────────────────────────────
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    const notifications = await queryAll(`
      SELECT * FROM system_notifications
      WHERE (user_id = ? OR user_id IS NULL)
         OR (target_role = ? OR target_role = 'ALL' OR target_role IS NULL)
      ORDER BY created_at DESC
      LIMIT 50
    `, [userId, role]);

    const unreadCountRow = await queryOne(`
      SELECT COUNT(*) as unread_count FROM system_notifications
      WHERE ((user_id = ? OR user_id IS NULL) OR (target_role = ? OR target_role = 'ALL' OR target_role IS NULL))
        AND is_read = 0
    `, [userId, role]);

    res.json({
      success: true,
      data: notifications,
      unread_count: unreadCountRow?.unread_count || 0
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/notifications ─────────────────────────────────
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { user_id, target_role, title, message, type, link } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, error: 'Title and message are required.' });
    }

    const result = await runQuery(`
      INSERT INTO system_notifications (user_id, target_role, title, message, type, link, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))
    `, [user_id || null, target_role || 'ALL', title, message, type || 'info', link || null]);

    res.status(201).json({ success: true, id: result.lastID });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PATCH /api/notifications/:id/read ───────────────────────
router.patch('/:id/read', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await runQuery(`
      UPDATE system_notifications
      SET is_read = 1
      WHERE id = ?
    `, [req.params.id]);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PATCH /api/notifications/read-all ──────────────────────
router.patch('/read-all', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    await runQuery(`
      UPDATE system_notifications
      SET is_read = 1
      WHERE ((user_id = ? OR user_id IS NULL) OR (target_role = ? OR target_role = 'ALL' OR target_role IS NULL))
    `, [userId, role]);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
