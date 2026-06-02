import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import pool from '../utils/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { ERROR_CODES } from '../utils/constants';
import { generateInvoicePDF } from '../services/pdfService';
import { sendQuickWhatsApp } from '../services/whatsappService';
import { smsPaymentReceived } from '../services/events/paymentEvents';

/**
 * Standalone Payments route — provides a payment ledger view
 * across all invoices and job cards.
 */
const router = Router();
router.use(authMiddleware);

// ─── LIST PAYMENTS ────────────────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { invoice_id, payment_mode, date_from, date_to, page = 1, limit = 20 } = req.query as any;
    const conds: string[] = ['1=1'];
    const params: any[] = [];

    if (invoice_id) { conds.push('p.invoice_id = ?'); params.push(invoice_id); }
    if (payment_mode) { conds.push('p.payment_mode = ?'); params.push(payment_mode); }
    if (date_from) { conds.push('p.payment_date >= ?'); params.push(date_from); }
    if (date_to) { conds.push('p.payment_date <= ?'); params.push(`${date_to} 23:59:59`); }

    const where = conds.join(' AND ');
    const offset = (Number(page) - 1) * Number(limit);

    const [countR] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM payments p WHERE ${where}`, params
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.*, i.invoice_code, c.full_name as customer_name, c.phone as customer_phone,
              s.full_name as received_by_name
       FROM payments p
       LEFT JOIN invoices i ON p.invoice_id = i.id
       LEFT JOIN customers c ON i.customer_id = c.id
       LEFT JOIN staff s ON p.received_by = s.id
       WHERE ${where}
       ORDER BY p.payment_date DESC, p.id DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    res.json({
      success: true,
      data: rows,
      meta: {
        total: countR[0].total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(countR[0].total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch payments.' } });
  }
});

// ─── RECORD PAYMENT ───────────────────────────────
router.post('/', rbac('admin', 'manager', 'receptionist'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { invoice_id, amount, payment_mode, reference_number, notes } = req.body;
    const staffId = (req as any).staff?.id;

    if (!invoice_id || !amount) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'invoice_id and amount are required.' } });
      return;
    }

    // Verify invoice exists
    const [inv] = await pool.query<RowDataPacket[]>(
      `SELECT i.id, i.total_amount, i.amount_paid, i.balance_due, i.invoice_code,
              c.full_name as customer_name, c.phone as customer_phone
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.id
       WHERE i.id = ? AND i.deleted_at IS NULL`, [invoice_id]
    );
    if (inv.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Invoice not found.' } });
      return;
    }

    // Insert payment
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO payments (invoice_id, amount, payment_mode, reference_number, notes, received_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [invoice_id, amount, payment_mode || 'cash', reference_number || null, notes || null, staffId]
    );

    // ── SMS: Payment Received ────────────────────────
    try {
      if (inv[0]?.customer_phone) {
        await smsPaymentReceived({
          phone: inv[0].customer_phone,
          customer_name: inv[0].customer_name || 'Customer',
          amount: amount,
          invoice_code: inv[0].invoice_code || '',
        });
      }
    } catch (smsErr) {
      console.error('[Payment] SMS payment received error (non-blocking):', smsErr);
    }
    // ─────────────────────────────────────────────────────

    // Update invoice amount_paid and balance_due
    await pool.query(
      `UPDATE invoices SET 
         amount_paid = amount_paid + ?,
         balance_due = total_amount - (amount_paid + ?),
         status = CASE WHEN total_amount <= (amount_paid + ?) THEN 'paid' ELSE status END
       WHERE id = ?`,
      [amount, amount, amount, invoice_id]
    );

    // Also update job_card if linked
    await pool.query(
      `UPDATE job_cards jc
       JOIN invoices i ON i.job_card_id = jc.id
       SET jc.amount_paid = jc.amount_paid + ?,
           jc.balance_due = jc.total_amount - (jc.amount_paid + ?)
       WHERE i.id = ?`,
      [amount, amount, invoice_id]
    );

    // Check if invoice is now fully paid
    const [updatedInvRows] = await pool.query<RowDataPacket[]>(
      'SELECT status FROM invoices WHERE id = ?', [invoice_id]
    );
    const updatedInv = updatedInvRows[0];

    if (updatedInv && updatedInv.status === 'paid') {
      try {
        const pdfPath = await generateInvoicePDF(invoice_id);
        const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
        const pdfUrl = `${baseUrl}${pdfPath}`;
        const phone = inv[0].customer_phone;
        const displayName = inv[0].customer_name || 'Customer';

        if (phone) {
          const msg = `Dear ${displayName}, thank you for your payment. Your Tax Invoice ${inv[0].invoice_code} has been generated. You can view or download it here: ${pdfUrl}`;
          await sendQuickWhatsApp(phone, msg);
          console.log(`✅ Invoice PDF link sent to customer phone: ${phone}`);
        }
      } catch (pdfErr) {
        console.error('Error generating/sending invoice PDF via SMS:', pdfErr);
      }
    }

    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM payments WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to record payment.' } });
  }
});

// ─── GET PAYMENT BY ID ────────────────────────────
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.*, i.invoice_code, c.full_name as customer_name
       FROM payments p
       LEFT JOIN invoices i ON p.invoice_id = i.id
       LEFT JOIN customers c ON i.customer_id = c.id
       WHERE p.id = ?`, [req.params.id]
    );
    if (rows.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Payment not found.' } });
      return;
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch payment.' } });
  }
});

// ─── PAYMENT SUMMARY ─────────────────────────────
router.get('/summary/overview', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT 
        payment_mode,
        COUNT(*) as count,
        SUM(amount) as total
      FROM payments
      GROUP BY payment_mode
    `);
    const [totals] = await pool.query<RowDataPacket[]>(`
      SELECT 
        COUNT(*) as total_payments,
        COALESCE(SUM(amount), 0) as total_collected,
        COALESCE(SUM(CASE WHEN DATE(payment_date) = CURDATE() THEN amount ELSE 0 END), 0) as today_collected
      FROM payments
    `);
    res.json({ success: true, data: { by_mode: rows, summary: totals[0] } });
  } catch (error) {
    console.error('Payment summary error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } });
  }
});

export default router;
