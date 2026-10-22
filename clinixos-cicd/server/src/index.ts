import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { initializeSchema } from './database/schema';
import { seedDatabase } from './database/seed';
import { initializeWebSocket } from './websocket';

// Route handlers
import authRoutes from './routes/auth.routes';
import patientsRoutes from './routes/patients.routes';
import bedsRoutes from './routes/beds.routes';
import appointmentsRoutes from './routes/appointments.routes';
import doctorsRoutes from './routes/doctors.routes';
import prescriptionsRoutes from './routes/prescriptions.routes';
import pharmacyRoutes from './routes/pharmacy.routes';
import billingRoutes from './routes/billing.routes';
import reportsRoutes from './routes/reports.routes';
import feedbackRoutes from './routes/feedback.routes';
import labRoutes from './routes/lab.routes';
import icuRoutes from './routes/icu.routes';
import userManagementRoutes from './routes/users.routes';
import notificationsRoutes from './routes/notifications.routes';

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(process.env.UPLOADS_DIR || path.resolve(__dirname, '../uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'ClinixOS Intelligent Hospital Operations Platform',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/beds', bedsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/doctors', doctorsRoutes);
app.use('/api/prescriptions', prescriptionsRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/icu', icuRoutes);
app.use('/api/users', userManagementRoutes);
app.use('/api/notifications', notificationsRoutes);

// Serve the built React application from the same origin as the API.
const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[ClinixOS Server Error]', err.stack);
  res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
});

// Start Server & WebSocket
async function start() {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required in production');
  }
  await initializeSchema();
  if (process.env.SEED_DEMO === 'true') await seedDatabase();
  initializeWebSocket(server);

  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` ClinixOS Hospital Management Server Active`);
    console.log(` REST API: http://localhost:${PORT}/api`);
    console.log(` Real-time Telemetry WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`=======================================================`);
  });
}

start().catch((err) => {
  console.error('[ClinixOS Fatal Error]', err);
  process.exit(1);
});
