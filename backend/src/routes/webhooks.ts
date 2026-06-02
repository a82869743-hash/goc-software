import { Router } from 'express';
import {
  verifyMetaWebhook,
  receiveMetaWebhook,
  receiveInstagramWebhook,
  receiveWhatsAppWebhook,
  getWebhookStatus,
  updateWebhookConfig,
  getWebhookEvents,
} from '../controllers/webhookController';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';

const router = Router();

// ── PUBLIC WEBHOOK ENDPOINTS (NO auth — called by Meta/MSG91 servers) ──────
// These MUST be public — external servers cannot pass JWT tokens

// Meta (Facebook + Instagram) webhook verification (GET) and receiver (POST)
router.get('/meta', verifyMetaWebhook);
router.post('/meta', receiveMetaWebhook);

// Instagram can also send to a separate endpoint
router.get('/instagram', verifyMetaWebhook);
router.post('/instagram', receiveInstagramWebhook);

// WhatsApp inbound (MSG91 or Meta WhatsApp Business)
router.post('/whatsapp', receiveWhatsAppWebhook);

// ── PROTECTED ADMIN ENDPOINTS (require auth) ────────────────────────────────
router.use(authMiddleware);

// Get webhook integration status and stats
router.get('/status', rbac('admin', 'manager'), getWebhookStatus);

// Update webhook config (tokens, default assignee, active toggle)
router.patch('/config', rbac('admin'), updateWebhookConfig);

// View recent webhook events (for debugging)
router.get('/events', rbac('admin', 'manager'), getWebhookEvents);

export default router;
