import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { rbac as requireRole } from '../middleware/rbac';
import { getSystemLogs } from '../controllers/systemLogsController';

const router = Router();

// Retrieve system logs (admin authorization only)
router.get('/', authMiddleware, requireRole('admin'), getSystemLogs);

export default router;
