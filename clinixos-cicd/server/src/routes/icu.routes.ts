import { Router, Response } from 'express';
import { queryAll, queryOne, runQuery } from '../database/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

const ensureTables = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS icu_patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      bed_number TEXT NOT NULL,
      diagnosis TEXT NOT NULL,
      attending_doctor TEXT,
      admitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      discharged_at TEXT,
      consciousness_level TEXT NOT NULL DEFAULT 'Alert',
      ventilator INTEGER NOT NULL DEFAULT 0,
      isolation INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    )
  `, []);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS icu_vitals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      icu_patient_id INTEGER NOT NULL,
      heart_rate REAL,
      systolic_bp REAL,
      diastolic_bp REAL,
      spo2 REAL,
      temperature REAL,
      respiratory_rate REAL,
      recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
      recorded_by INTEGER
    )
  `, []);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS icu_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      icu_patient_id INTEGER NOT NULL,
      alert_message TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'Warning',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT,
      is_resolved INTEGER NOT NULL DEFAULT 0
    )
  `, []);
};

// ─── GET /api/icu/status ─────────────────────────────────────
router.get('/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTables();

    const patients = await queryAll(`
      SELECT
        ip.id,
        ip.bed_number,
        ip.patient_id,
        p.first_name || ' ' || p.last_name AS patient_name,
        p.dob,
        COALESCE(p.mrn, CAST(p.id AS TEXT)) AS patient_mrn,
        ip.diagnosis,
        ip.admitted_at,
        ip.attending_doctor,
        ip.consciousness_level,
        ip.ventilator,
        ip.isolation
      FROM icu_patients ip
      JOIN patients p ON ip.patient_id = p.id
      WHERE ip.is_active = 1
      ORDER BY ip.admitted_at DESC
    `, []);

    // Enrich each patient with age, vitals, and alerts
    const enriched = await Promise.all(patients.map(async (p: any) => {
      const age = p.dob
        ? Math.floor((Date.now() - new Date(p.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
        : null;

      const vitals = await queryOne(`
        SELECT heart_rate, systolic_bp, diastolic_bp, spo2, temperature, respiratory_rate,
          recorded_at AS last_updated
        FROM icu_vitals
        WHERE icu_patient_id = ?
        ORDER BY recorded_at DESC
        LIMIT 1
      `, [p.id]);

      const alerts = await queryAll(`
        SELECT alert_message FROM icu_alerts
        WHERE icu_patient_id = ? AND is_resolved = 0
        ORDER BY created_at DESC
      `, [p.id]);

      return {
        ...p,
        patient_age: age,
        vitals: vitals || null,
        alerts: alerts.map((a: any) => a.alert_message),
        ventilator: !!p.ventilator,
        isolation: !!p.isolation
      };
    }));

    const totalBeds = 20;
    const occupied = enriched.length;
    const onVentilator = enriched.filter(p => p.ventilator).length;
    const isolationCount = enriched.filter(p => p.isolation).length;

    res.json({
      success: true,
      patients: enriched,
      stats: {
        total_icu_beds: totalBeds,
        occupied,
        vacant: Math.max(totalBeds - occupied, 0),
        critical_count: enriched.filter(p => p.alerts.length > 0).length,
        on_ventilator: onVentilator,
        isolation_count: isolationCount
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/icu/admit ──────────────────────────────────────
router.post('/admit', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTables();
    const {
      patient_id, bed_number, diagnosis, attending_doctor,
      ventilator = false, isolation = false, consciousness_level = 'Alert'
    } = req.body;

    if (!patient_id || !bed_number || !diagnosis) {
      return res.status(400).json({ success: false, error: 'patient_id, bed_number, and diagnosis are required.' });
    }

    const existing = await queryOne('SELECT id FROM icu_patients WHERE bed_number = ? AND is_active = 1', [bed_number]);
    if (existing) {
      return res.status(400).json({ success: false, error: `ICU Bed ${bed_number} is already occupied.` });
    }

    const result = await runQuery(`
      INSERT INTO icu_patients (patient_id, bed_number, diagnosis, attending_doctor,
        consciousness_level, ventilator, isolation, admitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [patient_id, bed_number, diagnosis, attending_doctor || null,
       consciousness_level, ventilator ? 1 : 0, isolation ? 1 : 0]);

    res.json({ success: true, icuPatientId: result.lastID });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/icu/discharge ──────────────────────────────────
router.post('/discharge', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTables();
    const { icu_patient_id } = req.body;

    await runQuery(`UPDATE icu_patients SET is_active = 0, discharged_at = datetime('now') WHERE id = ?`, [icu_patient_id]);
    await runQuery(`UPDATE icu_alerts SET is_resolved = 1, resolved_at = datetime('now') WHERE icu_patient_id = ? AND is_resolved = 0`, [icu_patient_id]);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/icu/vitals ─────────────────────────────────────
router.post('/vitals', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTables();
    const {
      icu_patient_id, heart_rate, systolic_bp, diastolic_bp,
      spo2, temperature, respiratory_rate
    } = req.body;

    if (!icu_patient_id) {
      return res.status(400).json({ success: false, error: 'icu_patient_id is required.' });
    }

    await runQuery(`
      INSERT INTO icu_vitals (icu_patient_id, heart_rate, systolic_bp, diastolic_bp,
        spo2, temperature, respiratory_rate, recorded_at, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `, [icu_patient_id, heart_rate ?? null, systolic_bp ?? null, diastolic_bp ?? null,
       spo2 ?? null, temperature ?? null, respiratory_rate ?? null, req.user?.id]);

    // Auto-generate critical alerts
    const criticalAlerts: string[] = [];
    if (spo2 !== undefined && Number(spo2) < 90) {
      const msg = `CRITICAL SpO₂: ${spo2}% — Immediate intervention required`;
      criticalAlerts.push(msg);
      await runQuery(`INSERT INTO icu_alerts (icu_patient_id, alert_message, severity, created_at) VALUES (?, ?, 'Critical', datetime('now'))`, [icu_patient_id, msg]);
    }
    if (heart_rate !== undefined && (Number(heart_rate) < 50 || Number(heart_rate) > 130)) {
      const msg = `CRITICAL Heart Rate: ${heart_rate} bpm`;
      criticalAlerts.push(msg);
      await runQuery(`INSERT INTO icu_alerts (icu_patient_id, alert_message, severity, created_at) VALUES (?, ?, 'Critical', datetime('now'))`, [icu_patient_id, msg]);
    }
    if (temperature !== undefined && (Number(temperature) < 35 || Number(temperature) > 39)) {
      const msg = `CRITICAL Temperature: ${temperature}°C`;
      criticalAlerts.push(msg);
      await runQuery(`INSERT INTO icu_alerts (icu_patient_id, alert_message, severity, created_at) VALUES (?, ?, 'Critical', datetime('now'))`, [icu_patient_id, msg]);
    }
    if (systolic_bp !== undefined && Number(systolic_bp) < 80) {
      const msg = `CRITICAL Systolic BP: ${systolic_bp} mmHg`;
      criticalAlerts.push(msg);
      await runQuery(`INSERT INTO icu_alerts (icu_patient_id, alert_message, severity, created_at) VALUES (?, ?, 'Critical', datetime('now'))`, [icu_patient_id, msg]);
    }

    res.json({ success: true, criticalAlerts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/icu/vitals/:id/history ─────────────────────────
router.get('/vitals/:id/history', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTables();
    const history = await queryAll(`SELECT * FROM icu_vitals WHERE icu_patient_id = ? ORDER BY recorded_at DESC LIMIT 48`, [req.params.id]);
    res.json({ success: true, data: history });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/icu/alerts ────────────────────────────────────
router.post('/alerts', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTables();
    const { icu_patient_id, alert_message, severity = 'Warning' } = req.body;
    const result = await runQuery(`INSERT INTO icu_alerts (icu_patient_id, alert_message, severity, created_at) VALUES (?, ?, ?, datetime('now'))`, [icu_patient_id, alert_message, severity]);
    res.json({ success: true, alertId: result.lastID });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PATCH /api/icu/alerts/:id/resolve ──────────────────────
router.patch('/alerts/:id/resolve', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTables();
    await runQuery(`UPDATE icu_alerts SET is_resolved = 1, resolved_at = datetime('now') WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
