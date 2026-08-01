import { Router, Request, Response } from 'express';
import { getInvoices, getInvoiceById, createInvoice, updateInvoice, deleteInvoice, getInvoiceSummary, getOutstandingPayments } from '../controllers/invoiceController';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { validate, validateQuery } from '../middleware/validate';
import { createInvoiceSchema, updateInvoiceSchema, invoiceFiltersSchema } from '../validations/invoiceValidation';
import { generateInvoicePDF } from '../services/pdfService';
import { WhatsAppTemplates } from '../services/whatsappService';
import pool from '../utils/db';
import { RowDataPacket } from 'mysql2';
import { ERROR_CODES } from '../utils/constants';

const router = Router();
router.use(authMiddleware);

router.get('/summary', getInvoiceSummary);
router.get('/outstanding', getOutstandingPayments);

router.get('/', validateQuery(invoiceFiltersSchema), getInvoices);
router.get('/:id', getInvoiceById);
router.post('/', validate(createInvoiceSchema), createInvoice);
router.put('/:id', validate(updateInvoiceSchema), updateInvoice);
router.delete('/:id', rbac('admin'), deleteInvoice);

// ─── Generate PDF ─────────────────────────────────
router.post('/:id/generate-pdf', async (req: Request, res: Response): Promise<void> => {
  try {
    const pdfUrl = await generateInvoicePDF(Number(req.params.id));
    res.json({ success: true, data: { pdf_url: pdfUrl } });
  } catch (error: any) {
    console.error('Generate invoice PDF error:', error);
    const status = error.message === 'Invoice not found' ? 404 : 500;
    res.status(status).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: error.message || 'Failed to generate PDF.' } });
  }
});

// ─── Send via WhatsApp ────────────────────────────
router.post('/:id/send-whatsapp', async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT i.*, c.full_name as customer_name, c.phone as customer_phone
       FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id
       WHERE i.id = ? AND i.deleted_at IS NULL`, [req.params.id]
    );
    if (rows.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Invoice not found.' } }); return; }
    const inv = rows[0];
    const staffId = (req as any).staff?.id;

    const result = await WhatsAppTemplates.invoiceSent(
      inv.customer_phone,
      inv.customer_name,
      inv.invoice_code,
      String(inv.total_amount),
      staffId
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Send invoice WhatsApp error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to send WhatsApp.' } });
  }
});

export default router;

