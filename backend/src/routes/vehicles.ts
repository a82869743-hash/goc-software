import { Router } from 'express';
import { getVehicles, getVehicleById, createVehicle, updateVehicle, deleteVehicle, getVehicleHistory } from '../controllers/vehicleController';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { createVehicleSchema, updateVehicleSchema } from '../validations/customerValidation';

const router = Router();

router.use(authMiddleware);

// List by customer
router.get('/', getVehicles);

// Get vehicle history — must come before /:id
router.get('/:id/history', getVehicleHistory);

// Get by ID
router.get('/:id', getVehicleById);

// Create
router.post('/', validate(createVehicleSchema), createVehicle);

// Update
router.put('/:id', validate(updateVehicleSchema), updateVehicle);

// Delete — owner/manager only
router.delete('/:id', rbac('admin', 'manager'), deleteVehicle);

export default router;
