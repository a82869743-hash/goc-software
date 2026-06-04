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

router.get('/status', getWebhookStatus);
router.get('/events', getWebhookEvents);

// ── PROTECTED — Configuration and logs (authenticated) ─────────
router.use(authMiddleware);

router.patch('/config', rbac('admin'), updateWebhookConfig);
router.get('/logs', rbac('admin', 'manager'), getWebhookLogs);

export default router;
