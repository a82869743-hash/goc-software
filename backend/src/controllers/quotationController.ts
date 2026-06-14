import { Request, Response } from 'express';
import pool from '../utils/db';
import { generateCode } from '../utils/codes';
import { ERROR_CODES } from '../utils/constants';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { sendQuickWhatsApp } from '../services/whatsappService';

// ─── LIST ────────────────────────────────────────────────
export const getQuotations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, search, page = 1, limit = 20, trash } = req.query as any;
    const conds: string[] = [];
    if (trash === 'true') {
      conds.push('q.deleted_at IS NOT NULL');
    } else {
      conds.push('q.deleted_at IS NULL');
    }
    const params: any[] = [];

    if (status && status !== 'all') { conds.push('q.status = ?'); params.push(status); }
    if (search) {
      conds.push('(q.quotation_code LIKE ? OR c.full_name LIKE ? OR c.phone LIKE ? OR q.customer_name_override LIKE ?)');
      const t = `%${search}%`;
      params.push(t, t, t, t);
    }

    const where = conds.join(' AND ');
    const offset = (Number(page) - 1) * Number(limit);

    const [countR] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM quotations q LEFT JOIN customers c ON q.customer_id = c.id WHERE ${where}`,
      params
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT q.id, q.quotation_code, q.status, q.grand_total, q.valid_until,
              q.canvas_snapshot, q.customer_name_override, q.customer_phone_override,
              q.vehicle_description, q.notes, q.created_at,
              c.full_name as customer_name, c.phone as customer_phone,
              v.make as vehicle_make, v.model as vehicle_model, v.reg_number,
              CONCAT(v.make, ' ', v.model) as vehicle_name,
              s.full_name as created_by_name
       FROM quotations q
       LEFT JOIN customers c ON q.customer_id = c.id
       LEFT JOIN vehicles v ON q.vehicle_id = v.id
       LEFT JOIN staff s ON q.created_by = s.id
       WHERE ${where}
       ORDER BY q.id DESC
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
        totalPages: Math.ceil(countR[0].total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get quotations error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch quotations.' } });
  }
};

// ─── GET BY ID ───────────────────────────────────────────
export const getQuotationById = async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT q.*, c.full_name as customer_name, c.phone as customer_phone,
              v.make as vehicle_make, v.model as vehicle_model, v.reg_number,
              CONCAT(v.make, ' ', v.model) as vehicle_name
       FROM quotations q
       LEFT JOIN customers c ON q.customer_id = c.id
       LEFT JOIN vehicles v ON q.vehicle_id = v.id
       WHERE q.id = ? AND q.deleted_at IS NULL`,
      [req.params.id]
    );
    if (rows.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Quotation not found.' } });
      return;
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Get quotation error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch quotation.' } });
  }
};

// ─── CREATE ──────────────────────────────────────────────
export const createQuotation = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = await generateCode('quotation');
    const d = req.body;
    const staffId = (req as any).staff?.id;

    // valid_until: default 15 days from today if not provided
    const validUntil = d.valid_until || (() => {
      const d2 = new Date();
      d2.setDate(d2.getDate() + 15);
      return d2.toISOString().split('T')[0];
    })();

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO quotations
        (quotation_code, customer_id, vehicle_id, lead_id,
         customer_name_override, customer_phone_override, vehicle_description,
         canvas_data, canvas_snapshot,
         subtotal, discount_type, discount_value, discount_amount,
         apply_gst, gst_amount, grand_total,
         valid_until, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
      [
        code,
        d.customer_id || null,
        d.vehicle_id || null,
        d.lead_id || null,
        d.customer_name_override || null,
        d.customer_phone_override || null,
        d.vehicle_description || null,
        d.canvas_data || null,
        d.canvas_snapshot || null,
        d.subtotal || 0,
        d.discount_type || 'fixed',
        d.discount_value || 0,
        d.discount_amount || 0,
        d.apply_gst ? 1 : 0,
        d.gst_amount || 0,
        d.grand_total || 0,
        validUntil,
        d.notes || null,
        staffId
      ]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM quotations WHERE id = ?', [result.insertId]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Create quotation error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to create quotation.' } });
  }
};

// ─── UPDATE (Save canvas state) ──────────────────────────
export const updateQuotation = async (req: Request, res: Response): Promise<void> => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM quotations WHERE id = ? AND deleted_at IS NULL', [req.params.id]
    );
    if (existing.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Quotation not found.' } });
      return;
    }

    const d = req.body;
    const fields: string[] = [];
    const vals: any[] = [];

    const allowed: Record<string, any> = {
      canvas_data: d.canvas_data,
      canvas_snapshot: d.canvas_snapshot,
      customer_name_override: d.customer_name_override,
      customer_phone_override: d.customer_phone_override,
      vehicle_description: d.vehicle_description,
      customer_id: d.customer_id,
      vehicle_id: d.vehicle_id,
      subtotal: d.subtotal,
      discount_type: d.discount_type,
      discount_value: d.discount_value,
      discount_amount: d.discount_amount,
      apply_gst: d.apply_gst !== undefined ? (d.apply_gst ? 1 : 0) : undefined,
      gst_amount: d.gst_amount,
      grand_total: d.grand_total,
      valid_until: d.valid_until,
      status: d.status,
      notes: d.notes,
      pdf_url: d.pdf_url,
    };

    for (const [key, val] of Object.entries(allowed)) {
      if (val !== undefined) { fields.push(`${key} = ?`); vals.push(val); }
    }

    if (fields.length === 0) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No fields to update.' } });
      return;
    }

    vals.push(req.params.id);
    await pool.query(`UPDATE quotations SET ${fields.join(', ')} WHERE id = ?`, vals);

    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM quotations WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Update quotation error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to update quotation.' } });
  }
};

// ─── SOFT DELETE ─────────────────────────────────────────
export const deleteQuotation = async (req: Request, res: Response): Promise<void> => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM quotations WHERE id = ? AND deleted_at IS NULL', [req.params.id]
    );
    if (existing.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Quotation not found.' } });
      return;
    }
    await pool.query('UPDATE quotations SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: { message: 'Quotation deleted.' } });
  } catch (error) {
    console.error('Delete quotation error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to delete quotation.' } });
  }
};

export const restoreQuotation = async (req: Request, res: Response): Promise<void> => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM quotations WHERE id = ? AND deleted_at IS NOT NULL', [req.params.id]
    );
    if (existing.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Quotation not found or not in trash.' } });
      return;
    }
    await pool.query('UPDATE quotations SET deleted_at = NULL WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: { message: 'Quotation restored.' } });
  } catch (error) {
    console.error('Restore quotation error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to restore quotation.' } });
  }
};

export const permanentlyDeleteQuotation = async (req: Request, res: Response): Promise<void> => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM quotations WHERE id = ? AND deleted_at IS NOT NULL', [req.params.id]
    );
    if (existing.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Quotation not found in trash.' } });
      return;
    }
    await pool.query('DELETE FROM quotations WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: { message: 'Quotation permanently deleted.' } });
  } catch (error) {
    console.error('Permanent delete quotation error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to permanently delete quotation.' } });
  }
};

// ─── SEND VIA WHATSAPP ───────────────────────────────────
export const sendQuotationWhatsApp = async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT q.*, c.full_name as customer_name, c.phone as customer_phone
       FROM quotations q
       LEFT JOIN customers c ON q.customer_id = c.id
       WHERE q.id = ? AND q.deleted_at IS NULL`,
      [req.params.id]
    );
    if (rows.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Quotation not found.' } });
      return;
    }

    const qt = rows[0];
    const phone = qt.customer_phone || qt.customer_phone_override;
    const name = qt.customer_name || qt.customer_name_override || 'Valued Customer';

    if (!phone) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No phone number available for this customer.' } });
      return;
    }

    const totalStr = qt.grand_total ? `₹${Number(qt.grand_total).toLocaleString('en-IN')}` : 'as per attached';
    const msg = `Dear ${name}, please find your quotation from GOD OF CERAMIC Studio.\n\nQuotation No: ${qt.quotation_code}\nValid Until: ${qt.valid_until ? new Date(qt.valid_until).toLocaleDateString('en-IN') : 'N/A'}\nEstimated Amount: ${totalStr}\n\nFor queries, please contact GOC Studio. Thank you!`;

    await sendQuickWhatsApp(phone, msg);

    // Mark status as sent
    await pool.query(`UPDATE quotations SET status = 'sent' WHERE id = ?`, [req.params.id]);

    res.json({ success: true, data: { message: 'WhatsApp sent successfully.', phone } });
  } catch (error) {
    console.error('Send quotation WhatsApp error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to send WhatsApp.' } });
  }
};

// ─── GENERATE PDF (Puppeteer renders snapshot image) ─────
export const generateQuotationPDF = async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT q.*, c.full_name as customer_name, c.phone as customer_phone,
              v.make as vehicle_make, v.model as vehicle_model, v.reg_number,
              CONCAT(v.make, ' ', v.model) as vehicle_name
       FROM quotations q
       LEFT JOIN customers c ON q.customer_id = c.id
       LEFT JOIN vehicles v ON q.vehicle_id = v.id
       WHERE q.id = ? AND q.deleted_at IS NULL`,
      [req.params.id]
    );
    if (rows.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Quotation not found.' } });
      return;
    }
    const qt = rows[0];

    const customerName = qt.customer_name || qt.customer_name_override || 'Customer';
    const customerPhone = qt.customer_phone || qt.customer_phone_override || '';
    
    let brand = qt.vehicle_make || '';
    let model = qt.vehicle_model || '';
    let regNumber = qt.reg_number || '';

    if (!qt.vehicle_id && qt.vehicle_description) {
      try {
        if (qt.vehicle_description.trim().startsWith('{')) {
          const parsed = JSON.parse(qt.vehicle_description);
          brand = parsed.brand || '';
          model = parsed.model || '';
          regNumber = parsed.reg_number || '';
        } else {
          brand = qt.vehicle_description;
        }
      } catch (e) {
        brand = qt.vehicle_description;
      }
    }

    // Build the canvas snapshot image src (base64 PNG stored in DB)
    const snapshotSrc = qt.canvas_snapshot
      ? (qt.canvas_snapshot.startsWith('data:') ? qt.canvas_snapshot : `data:image/png;base64,${qt.canvas_snapshot}`)
      : '';

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; background: #fff; color: #111; }
  .header { background: #111; color: #fff; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; }
  .brand { font-size: 26px; font-weight: 900; letter-spacing: 2px; }
  .brand span { color: #CC0000; }
  .brand sub { font-size: 11px; color: #aaa; display: block; letter-spacing: 3px; font-weight: 400; margin-top: 2px; }
  .qt-badge { text-align: right; }
  .qt-badge .code { font-size: 18px; font-weight: 700; color: #CC0000; }
  .qt-badge .date { font-size: 11px; color: #aaa; margin-top: 4px; }
  .customer-bar { background: #f4f4f4; border-left: 4px solid #CC0000; padding: 16px 32px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
  .info-item label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #888; display: block; margin-bottom: 3px; }
  .info-item span { font-size: 14px; font-weight: 600; color: #111; }
  .canvas-section { padding: 24px 32px; }
  .canvas-section h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #888; margin-bottom: 12px; }
  .canvas-img { width: 100%; border: 1px solid #e0e0e0; border-radius: 4px; display: block; background: #fff; }
  .canvas-blank { width: 100%; height: 400px; border: 2px dashed #ddd; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #bbb; font-size: 13px; }
  .footer { margin-top: 24px; padding: 16px 32px; border-top: 1px solid #e0e0e0; display: flex; justify-content: space-between; font-size: 10px; color: #aaa; }
  .footer strong { color: #CC0000; }
</style>
</head>
<body>
<div class="header">
  <div class="brand">GOD OF <span>CERAMIC</span><sub>PREMIUM AUTO DETAILING — VADODARA</sub></div>
  <div class="qt-badge">
    <div class="code">${qt.quotation_code}</div>
    <div class="date">Valid until: ${qt.valid_until ? new Date(qt.valid_until).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : 'N/A'}</div>
  </div>
</div>

<div class="customer-bar">
  <div class="info-item"><label>Customer</label><span>${customerName}</span></div>
  <div class="info-item"><label>Phone</label><span>${customerPhone || '—'}</span></div>
  <div class="info-item"><label>Car Brand</label><span>${brand || '—'}</span></div>
  <div class="info-item"><label>Car Model</label><span>${model || '—'}</span></div>
  <div class="info-item"><label>Car Number</label><span>${regNumber || '—'}</span></div>
</div>

<div class="canvas-section">
  <h3>Quotation Details (Handwritten)</h3>
  ${snapshotSrc
    ? `<img class="canvas-img" src="${snapshotSrc}" alt="Quotation Canvas"/>`
    : `<div class="canvas-blank">No canvas drawing saved for this quotation.</div>`
  }
</div>

${qt.notes ? `<div style="padding:0 32px 16px;font-size:13px;color:#555;"><strong>Notes:</strong> ${qt.notes}</div>` : ''}

<div class="footer">
  <span>God of Ceramic Auto Detailing Studio, Vadodara, Gujarat</span>
  <span>Generated: ${new Date().toLocaleDateString('en-IN')} | <strong>${qt.quotation_code}</strong></span>
</div>
</body>
</html>`;

    // Detect system chrome/edge paths on Windows
    const fs = require('fs');
    const path = require('path');
    const possiblePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env.USERPROFILE}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`
    ];

    let executablePath = '';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        executablePath = p;
        break;
      }
    }

    try {
      let puppeteer: any;
      try {
        puppeteer = require('puppeteer');
      } catch (err) {
        throw new Error('Puppeteer package not found');
      }

      const launchOptions: any = {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      };
      if (executablePath) {
        launchOptions.executablePath = executablePath;
      }

      const launchFn = puppeteer.default?.launch || puppeteer.launch;
      if (!launchFn) {
        throw new Error('Puppeteer launch function not found');
      }

      const browser = await launchFn(launchOptions);
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
      await browser.close();

      // Save PDF file
      const pdfDir = path.resolve(__dirname, '../../../uploads/quotation-pdfs');
      if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
      const filename = `${qt.quotation_code}-${Date.now()}.pdf`;
      const pdfPath = path.join(pdfDir, filename);
      fs.writeFileSync(pdfPath, pdfBuffer);
      const pdfUrl = `/uploads/quotation-pdfs/${filename}`;

      await pool.query('UPDATE quotations SET pdf_url = ? WHERE id = ?', [pdfUrl, req.params.id]);

      res.json({ success: true, data: { pdf_url: pdfUrl, quotation_code: qt.quotation_code } });
    } catch (error) {
      console.warn('Puppeteer not available or failed to generate PDF. Saving HTML fallback instead:', error);
      
      const pdfDir = path.resolve(__dirname, '../../../uploads/quotation-pdfs');
      if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
      const filename = `${qt.quotation_code}-${Date.now()}.html`;
      const htmlPath = path.join(pdfDir, filename);
      fs.writeFileSync(htmlPath, html, 'utf-8');
      const pdfUrl = `/uploads/quotation-pdfs/${filename}`;

      await pool.query('UPDATE quotations SET pdf_url = ? WHERE id = ?', [pdfUrl, req.params.id]);
      res.json({ success: true, data: { pdf_url: pdfUrl, quotation_code: qt.quotation_code, is_html_fallback: true } });
    }
  } catch (error: any) {
    console.error('Generate PDF outer error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: error.message || 'Failed to generate PDF.' } });
  }
};
