import { Router } from 'express';
import {
  getWhatsAppLogs,
  getWhatsAppStats,
  quickSend,
  getCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  executeCampaign,
} from '../controllers/marketingController';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';

const router = Router();
router.use(authMiddleware);

// ── WhatsApp Logs & Stats ──────────────────────────────────
router.get('/whatsapp/logs', getWhatsAppLogs);
router.get('/whatsapp/stats', getWhatsAppStats);
router.post('/whatsapp/quick-send', rbac('admin', 'manager', 'receptionist'), quickSend);

// ── Campaigns ──────────────────────────────────────────────
router.get('/campaigns', getCampaigns);
router.post('/campaigns', rbac('admin', 'manager'), createCampaign);
router.put('/campaigns/:id', rbac('admin', 'manager'), updateCampaign);
router.delete('/campaigns/:id', rbac('admin', 'manager'), deleteCampaign);
router.post('/campaigns/:id/execute', rbac('admin', 'manager'), executeCampaign);

export default router;
