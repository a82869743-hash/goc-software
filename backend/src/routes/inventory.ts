import { Router } from 'express';
import { getInventoryItems, getInventoryItemById, createInventoryItem, updateInventoryItem, deleteInventoryItem, logUsage, getInventorySummary, getReorderSuggestions, recordPurchase, getPurchaseHistory, getInventoryUsage } from '../controllers/inventoryController';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { validate, validateQuery } from '../middleware/validate';
import { createInventoryItemSchema, updateInventoryItemSchema, inventoryFiltersSchema, logUsageSchema } from '../validations/inventoryValidation';

const router = Router();
router.use(authMiddleware);

router.get('/summary', getInventorySummary);
router.get('/reorder-suggestions', getReorderSuggestions);
router.get('/purchases', getPurchaseHistory);
router.get('/usages', getInventoryUsage);
router.post('/purchase', rbac('admin', 'manager'), recordPurchase);
router.post('/usage', validate(logUsageSchema), logUsage);


router.get('/', validateQuery(inventoryFiltersSchema), getInventoryItems);
router.get('/:id', getInventoryItemById);
router.post('/', rbac('admin', 'manager'), validate(createInventoryItemSchema), createInventoryItem);
router.put('/:id', rbac('admin', 'manager'), validate(updateInventoryItemSchema), updateInventoryItem);
router.delete('/:id', rbac('admin', 'manager'), deleteInventoryItem);

export default router;
