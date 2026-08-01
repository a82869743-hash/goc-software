import { Router } from 'express';
import { getCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer, searchCustomers } from '../controllers/customerController';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { validate, validateQuery } from '../middleware/validate';
import { createCustomerSchema, updateCustomerSchema, customerFiltersSchema } from '../validations/customerValidation';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Search (must be before /:id to avoid conflict)
router.get('/search', searchCustomers);

// List
router.get('/', validateQuery(customerFiltersSchema), getCustomers);

// Get by ID
router.get('/:id', getCustomerById);

// Create — any authenticated staff
router.post('/', validate(createCustomerSchema), createCustomer);

// Update — any authenticated staff
router.put('/:id', validate(updateCustomerSchema), updateCustomer);

// Delete — admin only
router.delete('/:id', rbac('admin'), deleteCustomer);

export default router;
