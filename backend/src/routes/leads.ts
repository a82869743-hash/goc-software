import { Router } from 'express';
import { getLeads, getLeadById, createLead, updateLead, deleteLead, getLeadStats, bulkReassignLeads } from '../controllers/leadController';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { validate, validateQuery } from '../middleware/validate';
import { createLeadSchema, updateLeadSchema, leadFiltersSchema, bulkReassignSchema } from '../validations/leadValidation';

const router = Router();

// All lead routes require authentication
router.use(authMiddleware);

// GET /leads/stats — Pipeline stats (must come before /:id)
router.get('/stats', rbac('admin', 'manager', 'receptionist'), getLeadStats);

// PATCH /leads/bulk-reassign — Bulk reassign leads
router.patch('/bulk-reassign', rbac('admin', 'manager', 'receptionist'), validate(bulkReassignSchema), bulkReassignLeads);

// GET /leads — List with filters
router.get('/', rbac('admin', 'manager', 'receptionist'), validateQuery(leadFiltersSchema), getLeads);

// GET /leads/:id — Single lead
router.get('/:id', rbac('admin', 'manager', 'receptionist'), getLeadById);

// POST /leads — Create
router.post('/', rbac('admin', 'manager', 'receptionist'), validate(createLeadSchema), createLead);

// PUT /leads/:id — Update
router.put('/:id', rbac('admin', 'manager', 'receptionist'), validate(updateLeadSchema), updateLead);

// DELETE /leads/:id — Soft delete (admin/manager only)
router.delete('/:id', rbac('admin', 'manager'), deleteLead);

export default router;

