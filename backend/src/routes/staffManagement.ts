import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { rbac as requireRole } from '../middleware/rbac';
import * as staffMgmt from '../controllers/staffManagementController';
import * as staffPerms from '../controllers/staffPermissionsController';

const router = Router();

// My permissions (any staff)
router.get('/my-permissions', authMiddleware, staffPerms.getMyPermissions);

// Staff list & CRUD (admin only)
router.get('/list', authMiddleware, requireRole('admin'), staffMgmt.listAllStaff);
router.post('/create', authMiddleware, requireRole('admin'), staffMgmt.createStaff);
router.put('/:id', authMiddleware, requireRole('admin'), staffMgmt.updateStaff);
router.post('/:id/reset-password', authMiddleware, requireRole('admin'), staffMgmt.resetPassword);
router.patch('/:id/status', authMiddleware, requireRole('admin'), staffMgmt.toggleStaffStatus);
router.delete('/:id', authMiddleware, requireRole('admin'), staffMgmt.deleteStaff);

// Permissions (admin only)
router.get('/:id/permissions', authMiddleware, requireRole('admin'), staffPerms.getPermissions);
router.put('/:id/permissions', authMiddleware, requireRole('admin'), staffPerms.updatePermissions);

export default router;
