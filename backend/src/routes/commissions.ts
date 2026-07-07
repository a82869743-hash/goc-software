import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { getCommissions, updateCommissionStatus, getCommissionStats, getConnectors, createConnector, deleteConnector } from '../controllers/commissionController';

const router = Router();

router.use(authMiddleware);

// Connectors management
router.get('/connectors', getConnectors);
router.post('/connectors', rbac('admin', 'manager'), createConnector);
router.delete('/connectors/:id', rbac('admin', 'manager'), deleteConnector);

// Commissions management
router.get('/stats', getCommissionStats);
router.get('/', getCommissions);

router.put('/:id/status', rbac('admin', 'manager'), updateCommissionStatus);

export default router;
