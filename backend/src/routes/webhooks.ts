/**
 * GOC Studio — Webhook Routes
 * PUBLIC ROUTES — No authMiddleware here for external callbacks.
 * Meta/MSG91 must call these without authentication.
 */
import { Router } from 'express';
import {
  verifyMetaWebhook,
  receiveMetaWebhook,
  receiveInstagramWebhook,
  receiveWhatsAppWebhook,
  getWebhookStatus,
  updateWebhookConfig,
  getWebhookEvents,
  getWebhookLogs,
} from '../controllers/webhookController';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';

const router = Router();

// ── PUBLIC — Webhook endpoints (NO auth) ────────
router.get('/meta', verifyMetaWebhook);
router.post('/meta', receiveMetaWebhook);

router.get('/instagram', verifyMetaWebhook);
router.post('/instagram', receiveInstagramWebhook);

router.post('/whatsapp', receiveWhatsAppWebhook);

// ── PROTECTED — Configuration and logs (authenticated) ─────────
router.use(authMiddleware);

router.get('/status', rbac('admin', 'manager'), getWebhookStatus);
router.patch('/config', rbac('admin'), updateWebhookConfig);
router.get('/events', rbac('admin', 'manager'), getWebhookEvents);
router.get('/logs', rbac('admin', 'manager'), getWebhookLogs);

export default router;
