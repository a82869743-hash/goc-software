import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { getCommissions, updateCommissionStatus, getCommissionStats, getConnectors, createConnector, deleteConnector, createManualCommission } from '../controllers/commissionController';

const router = Router();

router.use(authMiddleware);

// Connectors management
router.get('/connectors', getConnectors);
router.post('/connectors', rbac('admin', 'manager'), createConnector);
router.delete('/connectors/:id', rbac('admin'), deleteConnector);

// Commissions management
router.get('/stats', getCommissionStats);
router.get('/', getCommissions);
router.post('/', rbac('admin', 'manager'), createManualCommission);

router.put('/:id/status', rbac('admin', 'manager'), updateCommissionStatus);

export default router;
