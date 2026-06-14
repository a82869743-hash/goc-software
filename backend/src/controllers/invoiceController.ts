import { Request, Response } from 'express';
import pool from '../utils/db';
import { generateInvoiceCode } from '../utils/codes';
import { ERROR_CODES, CGST_RATE, SGST_RATE } from '../utils/constants';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { smsInvoiceGenerated } from '../services/events/invoiceEvents';

// ─── LIST ─────────────────────────────────────────
export const getInvoices = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, search, invoice_type, date_from, date_to, page = 1, limit = 20 } = req.query as any;
    const conds: string[] = ['i.deleted_at IS NULL'];
    const params: any[] = [];
    if (status) { conds.push('i.status = ?'); params.push(status); }
    if (invoice_type) { conds.push('i.invoice_type = ?'); params.push(invoice_type); }
    if (date_from) { conds.push('i.invoice_date >= ?'); params.push(date_from); }
    if (date_to) { conds.push('i.invoice_date <= ?'); params.push(date_to); }
    if (search) {
      conds.push('(c.full_name LIKE ? OR c.phone LIKE ? OR v.reg_number LIKE ? OR i.invoice_code LIKE ? OR j.job_code LIKE ?)');
      const t = `%${search}%`;
      params.push(t, t, t, t, t);
    }
    const where = conds.join(' AND ');
    const offset = (Number(page) - 1) * Number(limit);

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM invoices i 
      LEFT JOIN customers c ON i.customer_id = c.id 
      LEFT JOIN job_cards j ON i.job_card_id = j.id
      LEFT JOIN vehicles v ON j.vehicle_id = v.id
      WHERE ${where}
    `;
    const [countR] = await pool.query<RowDataPacket[]>(countQuery, params);

    const selectQuery = `
      SELECT i.*, c.full_name as customer_name, c.phone as customer_phone, j.job_code, v.reg_number as vehicle_reg_number
      FROM invoices i 
      LEFT JOIN customers c ON i.customer_id = c.id 
      LEFT JOIN job_cards j ON i.job_card_id = j.id
      LEFT JOIN vehicles v ON j.vehicle_id = v.id
      WHERE ${where} 
      ORDER BY i.id DESC 
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query<RowDataPacket[]>(selectQuery, [...params, Number(limit), offset]);

    res.json({ success: true, data: rows, meta: { total: countR[0].total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(countR[0].total / Number(limit)) } });
  } catch (error) { 
    console.error('Get invoices error:', error); 
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch invoices.' } }); 
  }
};

// ─── GET BY ID ────────────────────────────────────
export const getInvoiceById = async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT i.*, c.full_name as customer_name, c.phone as customer_phone, c.email as customer_email, c.address as customer_address, c.city as customer_city,
              j.job_code
       FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id LEFT JOIN job_cards j ON i.job_card_id = j.id
       WHERE i.id = ? AND i.deleted_at IS NULL`, [req.params.id]);
    if (rows.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Invoice not found.' } }); return; }
    const [items] = await pool.query<RowDataPacket[]>('SELECT * FROM invoice_items WHERE invoice_id = ?', [req.params.id]);
    res.json({ success: true, data: { ...rows[0], items } });
  } catch (error) { console.error('Get invoice error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch invoice.' } }); }
};

// ─── CREATE ───────────────────────────────────────
export const createInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = await generateInvoiceCode();
    const d = req.body;
    const staffId = (req as any).staff?.id;

    const subtotal = d.items.reduce((sum: number, it: any) => sum + it.rate * it.qty, 0);
    const discountAmt = d.discount_amount || 0;
    const taxable = subtotal - discountAmt;
    const applyGst = d.apply_gst !== false;
    const isInterstate = d.is_interstate === true;

    let cgstRate = 0;
    let cgstAmount = 0;
    let sgstRate = 0;
    let sgstAmount = 0;
    let igstRate = 0;
    let igstAmount = 0;

    if (applyGst) {
      if (isInterstate) {
        igstRate = 18;
        igstAmount = +(taxable * 0.18).toFixed(2);
      } else {
        cgstRate = 9;
        cgstAmount = +(taxable * 0.09).toFixed(2);
        sgstRate = 9;
        sgstAmount = +(taxable * 0.09).toFixed(2);
      }
    }

    const total = +(taxable + cgstAmount + sgstAmount + igstAmount).toFixed(2);

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO invoices (invoice_code, job_card_id, customer_id, invoice_type, invoice_date, due_date,
        subtotal, discount_amount, taxable_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount, apply_gst,
        total_amount, amount_paid, balance_due, customer_gstin, notes, created_by)
       VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        code, d.job_card_id, d.customer_id, d.invoice_type || 'tax_invoice', d.due_date || null,
        +subtotal.toFixed(2), discountAmt, +taxable.toFixed(2),
        cgstRate, cgstAmount, sgstRate, sgstAmount, igstRate, igstAmount,
        applyGst ? 1 : 0, total, total, d.customer_gstin || null, d.notes || null, staffId
      ]
    );

    for (const it of d.items) {
      const amount = +(it.rate * it.qty).toFixed(2);
      await pool.query('INSERT INTO invoice_items (invoice_id, description, hsn_sac, qty, unit, rate, amount) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [result.insertId, it.description, it.hsn_sac || '998714', it.qty || 1, it.unit || 'job', it.rate, amount]);
    }

    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM invoices WHERE id = ?', [result.insertId]);

    // ── SMS: Invoice Generated ────────────────────────
    try {
      const [invCust] = await pool.query<RowDataPacket[]>(
        `SELECT c.full_name, c.phone FROM invoices inv
         LEFT JOIN customers c ON inv.customer_id = c.id
         WHERE inv.id = ?`,
        [result.insertId]
      );
      if (invCust.length > 0 && invCust[0].phone) {
        await smsInvoiceGenerated({
          phone: invCust[0].phone,
          customer_name: invCust[0].full_name || 'Customer',
          invoice_code: code,
          total_amount: total,
        });
      }
    } catch (smsErr) {
      console.error('[Invoice] SMS invoice generated error (non-blocking):', smsErr);
    }
    // ─────────────────────────────────────────────────────

    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) { console.error('Create invoice error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to create invoice.' } }); }
};

// ─── UPDATE STATUS ────────────────────────────────
export const updateInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>('SELECT * FROM invoices WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (existing.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Invoice not found.' } }); return; }
    const d = req.body;
    const fields: string[] = []; const vals: any[] = [];
    if (d.status) { fields.push('status = ?'); vals.push(d.status); }
    if (d.notes !== undefined) { fields.push('notes = ?'); vals.push(d.notes); }
    if (fields.length === 0) { res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No fields.' } }); return; }
    vals.push(req.params.id);
    await pool.query(`UPDATE invoices SET ${fields.join(', ')} WHERE id = ?`, vals);
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: rows[0] });
  } catch (error) { console.error('Update invoice error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to update invoice.' } }); }
};

// ─── DELETE ───────────────────────────────────────
export const deleteInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM invoices WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (existing.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Invoice not found.' } }); return; }
    await pool.query('UPDATE invoices SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: { message: 'Invoice deleted.' } });
  } catch (error) { console.error('Delete invoice error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to delete invoice.' } }); }
};

// ─── SUMMARY ──────────────────────────────────────
export const getInvoiceSummary = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT status, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total, COALESCE(SUM(balance_due), 0) as outstanding
       FROM invoices WHERE deleted_at IS NULL GROUP BY status`);
    res.json({ success: true, data: rows });
  } catch (error) { console.error('Invoice summary error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

/** GET /invoices/outstanding — List outstanding payments with ageing breakdown */
export const getOutstandingPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT i.id, i.invoice_code, i.invoice_date, i.due_date, i.total_amount, i.amount_paid, i.balance_due,
              c.full_name as customer_name, c.phone as customer_phone,
              DATEDIFF(CURDATE(), i.due_date) as days_overdue
       FROM invoices i
       JOIN customers c ON i.customer_id = c.id
       WHERE i.balance_due > 0 AND i.deleted_at IS NULL AND i.status != 'cancelled'
       ORDER BY days_overdue DESC`
    );

    const ageing = {
      current: 0,
      overdue_1_30: 0,
      overdue_31_60: 0,
      overdue_61_90: 0,
      overdue_90_plus: 0,
      total_outstanding: 0,
    };

    const details = rows.map((r) => {
      const days = Number(r.days_overdue || 0);
      const balance = Number(r.balance_due);
      ageing.total_outstanding += balance;

      let bucket = 'current';
      if (days > 90) {
        bucket = '90_plus';
        ageing.overdue_90_plus += balance;
      } else if (days > 60) {
        bucket = '61_90';
        ageing.overdue_61_90 += balance;
      } else if (days > 30) {
        bucket = '31_60';
        ageing.overdue_31_60 += balance;
      } else if (days > 0) {
        bucket = '1_30';
        ageing.overdue_1_30 += balance;
      } else {
        ageing.current += balance;
      }

      return {
        ...r,
        ageing_bucket: bucket,
      };
    });

    res.json({
      success: true,
      data: {
        summary: ageing,
        invoices: details,
      }
    });
  } catch (error) {
    console.error('Get outstanding ageing error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch outstanding ageing.' } });
  }
};
