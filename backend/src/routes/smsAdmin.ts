import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import {
  getSMSTemplates,
  updateSMSTemplate,
  getSMSStats,
  getSMSLogs,
  retryFailedSMS,
} from '../controllers/smsAdminController';

const router = Router();
router.use(authMiddleware);

router.get('/templates', getSMSTemplates);
router.put('/templates/:id', rbac('admin', 'manager'), updateSMSTemplate);
router.get('/stats', getSMSStats);
router.get('/logs', getSMSLogs);
router.post('/retry/:id', rbac('admin', 'manager'), retryFailedSMS);

export default router;
