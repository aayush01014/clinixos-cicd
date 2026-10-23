import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { runQuery } from '../database/db';

export const JWT_SECRET = process.env.JWT_SECRET || 'clinixos-super-secure-production-jwt-key-2026';

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: 'Patient' | 'Receptionist' | 'Doctor' | 'Nurse' | 'Pharmacist' | 'Admin';
  lastActivity?: number;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(401).json({ success: false, error: 'Invalid or expired session token.' });
    }

    // Check 15-minute inactivity timeout (FR-07.4)
    const now = Date.now();
    if (decoded.lastActivity && now - decoded.lastActivity > 15 * 60 * 1000) {
      return res.status(401).json({ success: false, error: 'Session expired due to 15 minutes of inactivity.' });
    }

    req.user = decoded as AuthenticatedUser;
    next();
  });
};

export const requireRoles = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized. Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      // Audit security denial
      logAuditEvent(req.user.id, 'ACCESS_DENIED', `Attempted unauthorized access to ${req.originalUrl}`, req.ip);
      return res.status(403).json({
        success: false,
        error: `Access Denied. Role '${req.user.role}' lacks permission for this resource.`
      });
    }

    next();
  };
};

export const logAuditEvent = async (userId: number | null, action: string, details: string, ip?: string) => {
  try {
    await runQuery(
      `INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)`,
      [userId, action, details, ip || '127.0.0.1']
    );
  } catch (err) {
    console.error('[ClinixOS Audit Log] Error writing audit record:', err);
  }
};
