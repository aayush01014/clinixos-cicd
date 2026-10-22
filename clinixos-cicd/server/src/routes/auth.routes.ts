import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { queryOne, runQuery } from '../database/db';
import { JWT_SECRET, authenticateToken, AuthRequest, logAuditEvent } from '../middleware/auth';

const router = Router();

// In-memory failed attempts counter for BR-04 (Brute-force account lock)
const failedAttempts: Record<string, { count: number; lockedUntil: number }> = {};

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  // Check brute-force lock (BR-04: > 5 consecutive failures = 15 min lock)
  const attemptRecord = failedAttempts[email];
  const now = Date.now();
  if (attemptRecord && attemptRecord.lockedUntil > now) {
    const minutesRemaining = Math.ceil((attemptRecord.lockedUntil - now) / 60000);
    return res.status(403).json({
      success: false,
      error: `Account temporarily locked due to repeated failed login attempts. Please retry in ${minutesRemaining} minute(s).`
    });
  }

  try {
    const user = await queryOne<any>('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      recordFailedAttempt(email);
      return res.status(401).json({ success: false, error: 'Invalid credentials provided.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      recordFailedAttempt(email);
      return res.status(401).json({ success: false, error: 'Invalid credentials provided.' });
    }

    // Reset failed attempts on success
    delete failedAttempts[email];

    // Sign JWT with role claims and activity timestamp
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        lastActivity: Date.now()
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Fetch related profile info if doctor or patient
    let doctorProfile = null;
    let patientProfile = null;

    if (user.role === 'Doctor') {
      doctorProfile = await queryOne('SELECT * FROM doctors WHERE user_id = ?', [user.id]);
    } else if (user.role === 'Patient') {
      patientProfile = await queryOne('SELECT * FROM patients WHERE user_id = ?', [user.id]);
    }

    await logAuditEvent(user.id, 'USER_LOGIN', `User ${user.email} (${user.role}) logged in successfully`, req.ip);

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        doctor: doctorProfile,
        patient: patientProfile
      }
    });
  } catch (err: any) {
    console.error('[ClinixOS Auth] Login error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error during authentication.' });
  }
});

// POST /api/auth/register (Patient self-registration)
router.post('/register', async (req: Request, res: Response) => {
  const { email, password, first_name, last_name, dob, gender, contact_number, emergency_contact, blood_group } = req.body;

  if (!email || !password || !first_name || !last_name || !dob || !gender || !contact_number || !emergency_contact) {
    return res.status(400).json({ success: false, error: 'All mandatory registration fields must be provided.' });
  }

  try {
    const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ success: false, error: 'An account with this email address already exists.' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const userResult = await runQuery(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
      [email, password_hash, 'Patient']
    );

    // Generate unique sequential PID (FR-01.1)
    const countResult = await queryOne<any>('SELECT COUNT(*) as count FROM patients');
    const seqNum = (countResult?.count || 0) + 1;
    const pid = `PT-2026-${String(seqNum).padStart(4, '0')}`;

    const patientResult = await runQuery(
      `INSERT INTO patients (user_id, pid, first_name, last_name, dob, gender, contact_number, emergency_contact, blood_group)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userResult.lastID, pid, first_name, last_name, dob, gender, contact_number, emergency_contact, blood_group || null]
    );

    const token = jwt.sign(
      { id: userResult.lastID, email, role: 'Patient', lastActivity: Date.now() },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    await logAuditEvent(userResult.lastID, 'PATIENT_REGISTER', `New patient registered with PID: ${pid}`, req.ip);

    return res.json({
      success: true,
      token,
      user: {
        id: userResult.lastID,
        email,
        role: 'Patient',
        patient: {
          id: patientResult.lastID,
          pid,
          first_name,
          last_name,
          dob,
          gender,
          contact_number
        }
      }
    });
  } catch (err: any) {
    console.error('[ClinixOS Auth] Registration error:', err);
    return res.status(500).json({ success: false, error: 'Error during patient registration.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await queryOne<any>('SELECT id, email, role, created_at FROM users WHERE id = ?', [req.user?.id]);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User profile not found.' });
    }

    let doctor = null;
    let patient = null;
    if (user.role === 'Doctor') {
      doctor = await queryOne('SELECT * FROM doctors WHERE user_id = ?', [user.id]);
    } else if (user.role === 'Patient') {
      patient = await queryOne('SELECT * FROM patients WHERE user_id = ?', [user.id]);
    }

    return res.json({
      success: true,
      user: {
        ...user,
        doctor,
        patient
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Error retrieving profile.' });
  }
});

function recordFailedAttempt(email: string) {
  const record = failedAttempts[email] || { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= 5) {
    record.lockedUntil = Date.now() + 15 * 60 * 1000; // 15 min lock
  }
  failedAttempts[email] = record;
}

export default router;
