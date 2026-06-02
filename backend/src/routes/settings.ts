import { Router } from 'express';
import { getSettings, updateSetting, batchUpdateSettings } from '../controllers/settingsController';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';

const router = Router();
router.use(authMiddleware);

router.get('/', getSettings);
router.put('/', rbac('admin', 'manager'), updateSetting);
router.put('/batch', rbac('admin'), batchUpdateSettings);

export default router;
