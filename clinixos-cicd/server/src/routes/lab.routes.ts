import { Router, Response } from 'express';
import { queryAll, queryOne, runQuery } from '../database/db';
import { authenticateToken, AuthRequest, requireRoles } from '../middleware/auth';

const router = Router();

// ─── GET /api/lab/orders ──────────────────────────────────────
router.get('/orders', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { search, status, category, priority } = req.query;

    let query = `
      SELECT
        lo.id,
        lo.patient_id,
        p.first_name || ' ' || p.last_name AS patient_name,
        COALESCE(p.mrn, CAST(p.id AS TEXT)) AS patient_mrn,
        COALESCE(u.full_name, 'System') AS doctor_name,
        lo.test_name,
        lo.test_code,
        lo.category,
        lo.priority,
        lo.status,
        lo.ordered_at,
        lo.collected_at,
        lo.resulted_at,
        lo.result_value,
        lo.result_unit,
        lo.reference_range,
        lo.is_abnormal,
        lo.notes,
        lo.technician_name
      FROM lab_orders lo
      JOIN patients p ON lo.patient_id = p.id
      LEFT JOIN users u ON lo.ordered_by_user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (p.first_name || ' ' || p.last_name LIKE ? OR p.mrn LIKE ? OR lo.test_name LIKE ? OR lo.test_code LIKE ?)`;
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (status) { query += ` AND lo.status = ?`; params.push(status); }
    if (category) { query += ` AND lo.category = ?`; params.push(category); }
    if (priority) { query += ` AND lo.priority = ?`; params.push(priority); }

    query += ` ORDER BY
      CASE lo.priority WHEN 'STAT' THEN 1 WHEN 'Urgent' THEN 2 ELSE 3 END,
      lo.ordered_at DESC`;

    const orders = await queryAll(query, params);

    // Stats
    const stats = await queryOne(`
      SELECT
        COUNT(*) AS total_ordered,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN status = 'Completed' AND DATE(resulted_at) = DATE('now') THEN 1 ELSE 0 END) AS completed_today,
        SUM(CASE WHEN is_abnormal = 1 AND DATE(resulted_at) = DATE('now') THEN 1 ELSE 0 END) AS abnormal_today,
        ROUND(AVG(CASE WHEN resulted_at IS NOT NULL AND collected_at IS NOT NULL
          THEN (julianday(resulted_at) - julianday(collected_at)) * 24 END), 1) AS avg_turnaround_hours
      FROM lab_orders
    `);

    res.json({ success: true, data: orders, stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/lab/orders ─────────────────────────────────────
router.post('/orders', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const {
      patient_id, test_code, test_name, category,
      priority = 'Routine', notes, reference_range, result_unit
    } = req.body;

    if (!patient_id || !test_code || !test_name) {
      return res.status(400).json({ success: false, error: 'patient_id, test_code, and test_name are required.' });
    }

    // Ensure lab_orders table exists
    await runQuery(`
      CREATE TABLE IF NOT EXISTS lab_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        ordered_by_user_id INTEGER,
        test_code TEXT NOT NULL,
        test_name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'General',
        priority TEXT NOT NULL DEFAULT 'Routine',
        status TEXT NOT NULL DEFAULT 'Pending',
        ordered_at TEXT NOT NULL DEFAULT (datetime('now')),
        collected_at TEXT,
        resulted_at TEXT,
        result_value TEXT,
        result_unit TEXT,
        reference_range TEXT,
        is_abnormal INTEGER,
        notes TEXT,
        technician_name TEXT
      )
    `, []);

    const result = await runQuery(`
      INSERT INTO lab_orders (patient_id, ordered_by_user_id, test_code, test_name, category,
        priority, notes, reference_range, result_unit, status, ordered_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', datetime('now'))
    `, [patient_id, req.user?.id, test_code, test_name, category || 'General', priority,
       notes || null, reference_range || null, result_unit || null]);

    res.json({ success: true, orderId: result.lastID });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PATCH /api/lab/orders/status ────────────────────────────
router.patch('/orders/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { order_id, status } = req.body;
    const validStatuses = ['Pending', 'In Progress', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status.' });
    }

    if (status === 'In Progress') {
      await runQuery(`UPDATE lab_orders SET status = ?, collected_at = datetime('now') WHERE id = ?`, [status, order_id]);
    } else {
      await runQuery(`UPDATE lab_orders SET status = ? WHERE id = ?`, [status, order_id]);
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/lab/results ────────────────────────────────────
router.post('/results', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { order_id, result_value, is_abnormal, notes, technician_name } = req.body;

    if (!order_id || !result_value) {
      return res.status(400).json({ success: false, error: 'order_id and result_value are required.' });
    }

    await runQuery(`
      UPDATE lab_orders
      SET status = 'Completed',
          result_value = ?,
          is_abnormal = ?,
          notes = ?,
          technician_name = ?,
          resulted_at = datetime('now')
      WHERE id = ?
    `, [result_value, is_abnormal ? 1 : 0, notes || null, technician_name || null, order_id]);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/lab/orders/:id ─────────────────────────────────
router.get('/orders/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const order = await queryOne(`
      SELECT lo.*, p.first_name || ' ' || p.last_name AS patient_name,
        COALESCE(p.mrn, CAST(p.id AS TEXT)) AS patient_mrn
      FROM lab_orders lo
      JOIN patients p ON lo.patient_id = p.id
      WHERE lo.id = ?
    `, [req.params.id]);

    if (!order) return res.status(404).json({ success: false, error: 'Order not found.' });
    res.json({ success: true, data: order });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
