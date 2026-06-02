import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { getCommissions, updateCommissionStatus, getCommissionStats } from '../controllers/commissionController';

const router = Router();

router.use(authMiddleware);

// All staff can view stats and lists, maybe only managers/owners can update
router.get('/stats', getCommissionStats);
router.get('/', getCommissions);

router.put('/:id/status', rbac('admin', 'manager'), updateCommissionStatus);

export default router;
