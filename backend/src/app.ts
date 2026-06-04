import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Import routes
import authRoutes from './routes/auth';
import leadsRoutes from './routes/leads';
import customersRoutes from './routes/customers';
import vehiclesRoutes from './routes/vehicles';
import bookingsRoutes from './routes/bookings';
import jobsRoutes from './routes/jobs';
import quotationsRoutes from './routes/quotations';
import invoicesRoutes from './routes/invoices';
import inventoryRoutes from './routes/inventory';
import staffRoutes from './routes/staff';
import dashboardRoutes from './routes/dashboard';
import reportsRoutes from './routes/reports';
import settingsRoutes from './routes/settings';
import commissionsRoutes from './routes/commissions';
import marketingRoutes from './routes/marketing';
import notificationsRoutes from './routes/notifications';
import paymentsRoutes from './routes/payments';
import { initCronJobs } from './services/cronJobs';
import quickJobCardsRoutes from './routes/quickJobCards';
import advanceBookingsRoutes from './routes/advanceBookings';
import publicTrackingRoutes from './routes/publicTracking';
import webhooksRoutes from './routes/webhooks';
import smsAdminRoutes from './routes/smsAdmin';
import integrationsRoutes from './routes/integrations';

const app = express();

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://godofceramic.in']
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

// ============================================================
// BODY PARSING
// ============================================================
// Raw body needed for Meta webhook signature verification
app.use('/api/v1/webhooks/meta', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================
// LOGGING
// ============================================================
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ============================================================
// STATIC FILES — Serve uploads
// ============================================================
app.use('/uploads', express.static(path.resolve(__dirname, '../../uploads')));
app.use('/uploads/quotation-pdfs', express.static(path.resolve(__dirname, '../../uploads/quotation-pdfs')));

// ============================================================
// API ROUTES — v1
// ============================================================
const API_PREFIX = '/api/v1';

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/leads`, leadsRoutes);
app.use(`${API_PREFIX}/customers`, customersRoutes);
app.use(`${API_PREFIX}/vehicles`, vehiclesRoutes);
app.use(`${API_PREFIX}/bookings`, bookingsRoutes);
app.use(`${API_PREFIX}/jobs`, jobsRoutes);
app.use(`${API_PREFIX}/quotations`, quotationsRoutes);
app.use(`${API_PREFIX}/invoices`, invoicesRoutes);
app.use(`${API_PREFIX}/inventory`, inventoryRoutes);
app.use(`${API_PREFIX}/staff`, staffRoutes);
app.use(`${API_PREFIX}/dashboard`, dashboardRoutes);
app.use(`${API_PREFIX}/reports`, reportsRoutes);
app.use(`${API_PREFIX}/settings`, settingsRoutes);
app.use(`${API_PREFIX}/commissions`, commissionsRoutes);
app.use(`${API_PREFIX}/marketing`, marketingRoutes);
app.use(`${API_PREFIX}/notifications`, notificationsRoutes);
app.use(`${API_PREFIX}/payments`, paymentsRoutes);
app.use(`${API_PREFIX}/quick-job-cards`, quickJobCardsRoutes);
app.use(`${API_PREFIX}/advance-bookings`, advanceBookingsRoutes);
app.use(`${API_PREFIX}/webhooks`, webhooksRoutes);
app.use(`${API_PREFIX}/sms`, smsAdminRoutes);
app.use(`${API_PREFIX}/integrations`, integrationsRoutes);
app.use(`/public`, publicTrackingRoutes);
// ── Initialize Cron Jobs ────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  initCronJobs();
}

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      service: 'GOC Studio API',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
    },
  });
});

// ============================================================
// 404 HANDLER
// ============================================================
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested endpoint does not exist.',
    },
  });
});

// ============================================================
// ERROR HANDLER
// ============================================================
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('❌ Unhandled Error:', err.message);
  console.error(err.stack);

  res.status(500).json({
    success: false,
    error: {
      code: 'SERVER_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An internal server error occurred.'
        : err.message,
    },
  });
});

export default app;
