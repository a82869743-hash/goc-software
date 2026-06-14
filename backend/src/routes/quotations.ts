import { Router } from 'express';
import {
  getQuotations,
  getQuotationById,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  restoreQuotation,
  permanentlyDeleteQuotation,
  sendQuotationWhatsApp,
  generateQuotationPDF
} from '../controllers/quotationController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/', getQuotations);
router.get('/:id', getQuotationById);
router.post('/', createQuotation);
router.put('/:id', updateQuotation);
router.delete('/:id', deleteQuotation);
router.put('/:id/restore', restoreQuotation);
router.delete('/:id/permanent', permanentlyDeleteQuotation);
router.post('/:id/send-whatsapp', sendQuotationWhatsApp);
router.post('/:id/generate-pdf', generateQuotationPDF);

export default router;
