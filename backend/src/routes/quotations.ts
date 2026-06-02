import { Router } from 'express';
import {
  getQuotations,
  getQuotationById,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  sendQuotationWhatsApp,
  generateQuotationPDF
} from '../controllers/quotationController';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';

const router = Router();
router.use(authMiddleware);

router.get('/', getQuotations);
router.get('/:id', getQuotationById);
router.post('/', createQuotation);
router.put('/:id', updateQuotation);
router.delete('/:id', rbac('admin', 'manager'), deleteQuotation);
router.post('/:id/send-whatsapp', sendQuotationWhatsApp);
router.post('/:id/generate-pdf', generateQuotationPDF);

export default router;
