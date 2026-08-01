import { Router } from 'express';
import { getInventoryItems, getInventoryItemById, createInventoryItem, updateInventoryItem, deleteInventoryItem, logUsage, getInventorySummary, getReorderSuggestions, recordPurchase, getPurchaseHistory, getInventoryUsage, scanPurchaseBill } from '../controllers/inventoryController';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { validate, validateQuery } from '../middleware/validate';
import { createInventoryItemSchema, updateInventoryItemSchema, inventoryFiltersSchema, logUsageSchema } from '../validations/inventoryValidation';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Scanned bill upload setup
const billUploadDir = path.resolve(__dirname, '../../../uploads/bills');
if (!fs.existsSync(billUploadDir)) {
  fs.mkdirSync(billUploadDir, { recursive: true });
}

const billStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, billUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `bill-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});

const billUpload = multer({
  storage: billStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|webp|pdf/;
    cb(null, ok.test(path.extname(file.originalname).toLowerCase()));
  }
});

const router = Router();
router.use(authMiddleware);

router.get('/summary', getInventorySummary);
router.get('/reorder-suggestions', getReorderSuggestions);
router.get('/purchases', getPurchaseHistory);
router.get('/usages', getInventoryUsage);
router.post('/purchase', rbac('admin', 'manager'), recordPurchase);
router.post('/scan-bill', rbac('admin', 'manager'), billUpload.single('file'), scanPurchaseBill);
router.post('/usage', validate(logUsageSchema), logUsage);


router.get('/', validateQuery(inventoryFiltersSchema), getInventoryItems);
router.get('/:id', getInventoryItemById);
router.post('/', rbac('admin', 'manager'), validate(createInventoryItemSchema), createInventoryItem);
router.put('/:id', rbac('admin', 'manager'), validate(updateInventoryItemSchema), updateInventoryItem);
router.delete('/:id', rbac('admin'), deleteInventoryItem);

export default router;
