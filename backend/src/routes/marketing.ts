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
  getPromotionalMaterials,
  uploadPromotionalMaterial,
  deletePromotionalMaterial,
} from '../controllers/marketingController';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Promotional materials upload directory
const materialsUploadDir = path.resolve(__dirname, '../../../uploads/materials');
if (!fs.existsSync(materialsUploadDir)) {
  fs.mkdirSync(materialsUploadDir, { recursive: true });
}

const materialsStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, materialsUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `material-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});

const materialsUpload = multer({
  storage: materialsStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max (for videos)
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|webp|gif|mp4|mov|avi|mkv|pdf|doc|docx|xls|xlsx/;
    cb(null, ok.test(path.extname(file.originalname).toLowerCase()));
  }
});

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

// ── Promotional Materials ──────────────────────────────────
router.get('/materials', getPromotionalMaterials);
router.post('/materials', rbac('admin', 'manager'), materialsUpload.single('file'), uploadPromotionalMaterial);
router.delete('/materials/:id', rbac('admin', 'manager'), deletePromotionalMaterial);

export default router;
