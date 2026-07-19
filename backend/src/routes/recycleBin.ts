import { Router } from 'express';
import { getDeletedItems, restoreItem, permanentlyDeleteItem } from '../controllers/recycleBinController';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';

const router = Router();

// All recycle bin routes require authentication + admin/manager role
router.use(authMiddleware);
router.use(rbac('admin', 'manager'));

// List all deleted items
router.get('/', getDeletedItems);

// Restore a deleted item
router.post('/:type/:id/restore', restoreItem);

// Permanently delete an item
router.delete('/:type/:id', permanentlyDeleteItem);

export default router;
