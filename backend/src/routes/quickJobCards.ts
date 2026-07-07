import { Router, Request, Response } from 'express';
import pool, { saveCustomerAndVehicleFromJobDetails } from '../utils/db';
import { authMiddleware } from '../middleware/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { ERROR_CODES } from '../utils/constants';
import { sendQuickWhatsApp } from '../services/whatsappService';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { deductInventoryForJobCard } from '../controllers/jobCardController';

const router = Router();

// Apply auth middleware to all quick job card routes
router.use(authMiddleware);

// ─── GET /quick-services ──────────────────────────
router.get('/quick-services', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM quick_services WHERE is_active=1 ORDER BY sort_order'
    );
    res.json({ success: true, data: rows });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

// ─── GET / ─────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, search, from, to } = req.query;
    const conds: string[] = [];
    const params: any[] = [];

    if (status) {
      conds.push('q.status = ?');
      params.push(status);
    }
    if (from) {
      conds.push('q.created_at >= ?');
      params.push(from);
    }
    if (to) {
      conds.push('q.created_at <= ?');
      params.push(`${to} 23:59:59`);
    }
    if (search) {
      conds.push('(q.owner_name LIKE ? OR q.reg_no LIKE ? OR q.job_no LIKE ?)');
      const t = `%${search}%`;
      params.push(t, t, t);
    }

    const whereClause = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    const query = `
      SELECT q.*,
             qi.invoice_no, qi.total_amount as invoice_total, qi.created_at as invoice_date,
             qe.estimate_no, qe.total_amount as estimate_total, qe.created_at as estimate_date
      FROM quick_job_cards q
      LEFT JOIN quick_job_card_invoices qi ON q.id = qi.job_card_id
      LEFT JOIN quick_job_card_estimates qe ON q.id = qe.job_card_id
      ${whereClause}
      ORDER BY q.created_at DESC
    `;

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    res.json({ success: true, data: rows });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

// ─── GET /:id ──────────────────────────────────────
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const [jcRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM quick_job_cards WHERE id = ?',
      [id]
    );
    if (jcRows.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Quick Job Card not found' } });
      return;
    }

    const [services] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM quick_job_card_services WHERE job_card_id = ?',
      [id]
    );
    const [concerns] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM quick_job_card_concerns WHERE job_card_id = ?',
      [id]
    );
    const [invoices] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM quick_job_card_invoices WHERE job_card_id = ?',
      [id]
    );
    const [estimates] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM quick_job_card_estimates WHERE job_card_id = ?',
      [id]
    );
    const [media] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM job_card_media WHERE job_card_id = ? AND job_type = 'quick'",
      [id]
    );

    res.json({
      success: true,
      data: {
        jobCard: jcRows[0],
        services,
        concerns,
        invoice: invoices[0] || null,
        estimate: estimates[0] || null,
        media
      }
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

// ─── POST / ────────────────────────────────────────
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const {
      reg_no, owner_name, mobile, car_name, car_make, car_model,
      fuel_type, insurance_company, insurance_expiry, km_reading, notes,
      services = [], concerns = []
    } = req.body;

    if (!reg_no || !owner_name || !mobile) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'reg_no, owner_name, and mobile are required.' } });
      return;
    }

    // Autosave customer and vehicle profiles
    await saveCustomerAndVehicleFromJobDetails(connection, {
      customer_name: owner_name,
      mobile,
      car_number: reg_no,
      car_make,
      car_model
    });

    // Generate unique job_no
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    const [cnt] = await connection.query<RowDataPacket[]>(
      'SELECT COUNT(*) as c FROM quick_job_cards WHERE DATE(created_at) = CURDATE()'
    );
    const seq = String(cnt[0].c + 1).padStart(3, '0');
    const job_no = `GOC-QJ${yy}${mm}${dd}-${seq}`;
    const public_token = uuidv4();

    // Insert quick job card
    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO quick_job_cards
       (job_no, reg_no, owner_name, mobile, car_name, car_make, car_model, fuel_type,
        insurance_company, insurance_expiry, km_reading, notes, status, public_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
      [job_no, reg_no, owner_name, mobile, car_name || null, car_make || null, car_model || null, fuel_type || null,
       insurance_company || null, insurance_expiry || null, km_reading || null, notes || null, public_token]
    );
    const jobCardId = result.insertId;

    // Insert inline services
    if (services && Array.isArray(services) && services.length > 0) {
      for (const svc of services) {
        const amount = Number(svc.qty || 1) * Number(svc.rate || 0);
        await connection.query(
          `INSERT INTO quick_job_card_services (job_card_id, service_name, item_type, qty, rate, amount, tax_pct, hsn_sac)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [jobCardId, svc.service_name, svc.item_type || 'service', svc.qty || 1, svc.rate || 0, amount, svc.tax_pct || 0, svc.hsn_sac || null]
        );
      }
    }

    // Insert customer concerns
    if (concerns && Array.isArray(concerns) && concerns.length > 0) {
      for (const concern of concerns) {
        await connection.query(
          'INSERT INTO quick_job_card_concerns (job_card_id, concern_text) VALUES (?, ?)',
          [jobCardId, concern]
        );
      }
    }

    await connection.commit();

    const tracking_url = `${process.env.BASE_URL || 'http://localhost:4000'}/track/${public_token}`;
    
    // Non-blocking welcome SMS
    const msg = `Dear ${owner_name}, your vehicle ${reg_no} has been received for quick service. Track status: ${tracking_url} Ref: ${job_no}`;
    sendQuickWhatsApp(mobile, msg).catch(e => console.error('SMS sending err:', e));

    res.status(201).json({
      success: true,
      data: {
        id: jobCardId,
        job_no,
        public_token,
        tracking_url,
        message: 'Quick Job Card created'
      }
    });
  } catch (e: any) {
    await connection.rollback();
    console.error(e);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  } finally {
    connection.release();
  }
});

// ─── PUT /:id ──────────────────────────────────────
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM quick_job_cards WHERE id = ?', [id]);
    if (existing.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Not found' } });
      return;
    }

    const d = req.body;
    const fields: string[] = [];
    const vals: any[] = [];
    const allowed = [
      'reg_no', 'owner_name', 'mobile', 'car_name', 'car_make', 'car_model',
      'fuel_type', 'insurance_company', 'insurance_expiry', 'km_reading', 'notes'
    ];

    for (const f of allowed) {
      if (d[f] !== undefined) {
        fields.push(`${f} = ?`);
        vals.push(d[f]);
      }
    }

    if (fields.length === 0) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No fields to update.' } });
      return;
    }

    vals.push(id);
    await pool.query(`UPDATE quick_job_cards SET ${fields.join(', ')} WHERE id = ?`, vals);
    const [updated] = await pool.query<RowDataPacket[]>('SELECT * FROM quick_job_cards WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

// ─── PATCH /:id/status ──────────────────────────────
router.patch('/:id/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { new_status } = req.body;
    if (!new_status) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'new_status is required' } });
      return;
    }

    const [existing] = await pool.query<RowDataPacket[]>('SELECT * FROM quick_job_cards WHERE id = ?', [id]);
    if (existing.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Not found' } });
      return;
    }

    const extras = ['status = ?'];
    const params = [new_status];

    if (['delivered', 'invoiced'].includes(new_status)) {
      extras.push('closed_at = NOW()');
    }

    params.push(id);
    await pool.query(`UPDATE quick_job_cards SET ${extras.join(', ')} WHERE id = ?`, params);

    // Deduct stock if transitioning to ready/delivered/invoiced
    const staffId = req.staff?.id;
    if (['ready', 'delivered', 'invoiced'].includes(new_status)) {
      await deductInventoryForJobCard(pool, id, true, staffId);
    }

    // SMS Status Notification
    const jc = existing[0];
    const tracking_url = `${process.env.BASE_URL || 'http://localhost:4000'}/track/${jc.public_token}`;
    const statusLabels: Record<string, string> = {
      scheduled: 'Scheduled',
      car_in: 'Received / Car In',
      washing: 'Washing Stage',
      in_progress: 'Work in Progress',
      qc: 'Quality Check',
      rework: 'Reworking Stage',
      ready: 'Ready for Delivery',
      delivered: 'Delivered',
      invoiced: 'Invoice Generated'
    };
    const label = statusLabels[new_status] || new_status;
    const msg = `Dear ${jc.owner_name}, your car ${jc.reg_no} status at God of Ceramic: ${label}. Track: ${tracking_url} Ref: ${jc.job_no}`;
    
    sendQuickWhatsApp(jc.mobile, msg).catch(e => console.error('SMS sending err:', e));

    res.json({ success: true, data: { status: new_status, message: 'Status updated' } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

// ─── POST /:id/services ─────────────────────────────
router.post('/:id/services', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { service_name, item_type, qty, rate, tax_pct, hsn_sac, inventory_item_id, sqft_used } = req.body;
    if (!service_name) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'service_name is required' } });
      return;
    }

    const qtyNum = qty === '' || qty === undefined || qty === null ? 1 : Number(qty);
    const rateNum = rate === '' || rate === undefined || rate === null ? 0 : Number(rate);
    const taxPctNum = tax_pct === '' || tax_pct === undefined || tax_pct === null ? 0 : Number(tax_pct);
    const sqftUsedNum = sqft_used === '' || sqft_used === undefined || sqft_used === null ? null : Number(sqft_used);
    const inventoryItemIdNum = inventory_item_id === '' || inventory_item_id === undefined || inventory_item_id === null ? null : Number(inventory_item_id);

    const amount = qtyNum * rateNum;
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO quick_job_card_services (job_card_id, service_name, item_type, qty, rate, amount, tax_pct, hsn_sac, inventory_item_id, sqft_used)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, service_name, item_type || 'service', qtyNum, rateNum, amount, taxPctNum, hsn_sac || null, inventoryItemIdNum, sqftUsedNum]
    );

    res.json({ success: true, data: { id: result.insertId, message: 'Service added' } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

// ─── PUT /:id/services/:sid ─────────────────────────
router.put('/:id/services/:sid', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, sid } = req.params;
    const d = req.body;

    const fields: string[] = [];
    const params: any[] = [];
    const allowed = ['service_name', 'item_type', 'qty', 'rate', 'tax_pct', 'hsn_sac', 'inventory_item_id', 'sqft_used'];

    for (const f of allowed) {
      if (d[f] !== undefined) {
        fields.push(`${f} = ?`);
        let val = d[f];
        if (f === 'qty') {
          val = val === '' || val === null ? 1 : Number(val);
        } else if (f === 'rate') {
          val = val === '' || val === null ? 0 : Number(val);
        } else if (f === 'tax_pct') {
          val = val === '' || val === null ? 0 : Number(val);
        } else if (f === 'sqft_used' || f === 'inventory_item_id') {
          val = val === '' || val === null ? null : Number(val);
        }
        params.push(val);
      }
    }

    if (fields.length === 0) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No fields to update' } });
      return;
    }

    // If quantity or rate is updated, recalculate amount
    const [existing] = await pool.query<RowDataPacket[]>('SELECT qty, rate FROM quick_job_card_services WHERE id=? AND job_card_id=?', [sid, id]);
    if (existing.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Service not found' } });
      return;
    }

    const finalQty = d.qty !== undefined ? Number(d.qty) : Number(existing[0].qty);
    const finalRate = d.rate !== undefined ? Number(d.rate) : Number(existing[0].rate);
    const amount = finalQty * finalRate;

    fields.push('amount = ?');
    params.push(amount);

    params.push(sid, id);
    await pool.query(`UPDATE quick_job_card_services SET ${fields.join(', ')} WHERE id=? AND job_card_id=?`, params);
    res.json({ success: true, data: { message: 'Service updated' } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

// ─── DELETE /:id/services/:sid ──────────────────────
router.delete('/:id/services/:sid', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, sid } = req.params;
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM quick_job_card_services WHERE id=? AND job_card_id=?',
      [sid, id]
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Service not found' } });
      return;
    }
    res.json({ success: true, data: { message: 'Service removed' } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

// ─── POST /:id/concerns ──────────────────────────────
router.post('/:id/concerns', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { concern_text } = req.body;
    if (!concern_text) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'concern_text is required' } });
      return;
    }

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO quick_job_card_concerns (job_card_id, concern_text) VALUES (?, ?)',
      [id, concern_text]
    );

    res.json({ success: true, data: { id: result.insertId, message: 'Concern added' } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

// ─── DELETE /:id/concerns/:cid ──────────────────────
router.delete('/:id/concerns/:cid', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, cid } = req.params;
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM quick_job_card_concerns WHERE id=? AND job_card_id=?',
      [cid, id]
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Concern not found' } });
      return;
    }
    res.json({ success: true, data: { message: 'Concern removed' } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

// ─── POST /:id/complete ─────────────────────────────
router.post('/:id/complete', async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { completion_type, payment_mode, gst_pct = 18 } = req.body;

    if (!['invoice', 'estimate'].includes(completion_type)) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid completion_type' } });
      return;
    }

    // 1. Calculate subtotal
    const [totalRow] = await connection.query<RowDataPacket[]>(
      'SELECT COALESCE(SUM(amount), 0) as subtotal FROM quick_job_card_services WHERE job_card_id = ?',
      [id]
    );
    const subtotal = Number(totalRow[0].subtotal);

    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    let documentNo = '';
    let total_amount = subtotal;

    if (completion_type === 'invoice') {
      const gst = subtotal * (Number(gst_pct) / 100);
      total_amount = subtotal + gst;

      // Count invoices generated today for sequential number
      const [ic] = await connection.query<RowDataPacket[]>(
        'SELECT COUNT(*) as c FROM quick_job_card_invoices WHERE DATE(created_at) = CURDATE()'
      );
      documentNo = `INV-Q-${yy}${mm}${dd}-${String(ic[0].c + 1).padStart(3, '0')}`;

      // Insert invoice
      await connection.query(
        `INSERT INTO quick_job_card_invoices (job_card_id, invoice_no, subtotal, gst_amount, total_amount, payment_mode)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, documentNo, subtotal, gst, total_amount, payment_mode || 'cash']
      );
    } else {
      // Estimate
      const [ec] = await connection.query<RowDataPacket[]>(
        'SELECT COUNT(*) as c FROM quick_job_card_estimates WHERE DATE(created_at) = CURDATE()'
      );
      documentNo = `EST-Q-${yy}${mm}${dd}-${String(ec[0].c + 1).padStart(3, '0')}`;

      // Insert estimate
      await connection.query(
        `INSERT INTO quick_job_card_estimates (job_card_id, estimate_no, subtotal, total_amount, payment_mode)
         VALUES (?, ?, ?, ?, ?)`,
        [id, documentNo, subtotal, total_amount, payment_mode || 'cash']
      );
    }

    // 4. Update Quick Job Card status to invoiced and save completion type
    await connection.query(
      `UPDATE quick_job_cards SET completion_type = ?, status = 'invoiced' WHERE id = ?`,
      [completion_type, id]
    );

    // Deduct stock if completion_type is invoice
    const staffId = req.staff?.id;
    if (completion_type === 'invoice') {
      await deductInventoryForJobCard(connection, id, true, staffId);
    }

    await connection.commit();

    res.json({
      success: true,
      data: {
        id,
        document_no: documentNo,
        total_amount,
        message: `${completion_type === 'invoice' ? 'Invoice' : 'Estimate'} generated successfully`
      }
    });
  } catch (e: any) {
    await connection.rollback();
    console.error(e);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  } finally {
    connection.release();
  }
});

// ─── GET /:id/invoice-data ──────────────────────────
router.get('/:id/invoice-data', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const [jcRows] = await pool.query<RowDataPacket[]>('SELECT * FROM quick_job_cards WHERE id = ?', [id]);
    if (jcRows.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Not found' } });
      return;
    }

    const [services] = await pool.query<RowDataPacket[]>('SELECT * FROM quick_job_card_services WHERE job_card_id = ?', [id]);
    const [concerns] = await pool.query<RowDataPacket[]>('SELECT * FROM quick_job_card_concerns WHERE job_card_id = ?', [id]);
    const [invoices] = await pool.query<RowDataPacket[]>('SELECT * FROM quick_job_card_invoices WHERE job_card_id = ?', [id]);
    const [estimates] = await pool.query<RowDataPacket[]>('SELECT * FROM quick_job_card_estimates WHERE job_card_id = ?', [id]);

    res.json({
      success: true,
      data: {
        jobCard: jcRows[0],
        services,
        concerns,
        invoice: invoices[0] || null,
        estimate: estimates[0] || null
      }
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

// ─── MEDIA ENDPOINTS ────────────────────────────────
const quickUploadDir = path.resolve(__dirname, '../../../uploads/job-media');
if (!fs.existsSync(quickUploadDir)) {
  fs.mkdirSync(quickUploadDir, { recursive: true });
}

const quickStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, quickUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});

const quickUpload = multer({
  storage: quickStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|webp|mp4|mov|avi|mkv/;
    cb(null, ok.test(path.extname(file.originalname).toLowerCase()));
  }
});

router.post('/:id/media', quickUpload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { media_type } = req.body;
    if (!['before_image', 'during_image', 'after_image', 'qc_image', 'video'].includes(media_type)) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid media_type' } });
      return;
    }
    if (!req.file) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No file uploaded' } });
      return;
    }
    const file_path = `/uploads/job-media/${req.file.filename}`;
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO job_card_media (job_card_id, job_type, media_type, file_path, original_name, file_size)
       VALUES (?, 'quick', ?, ?, ?, ?)`,
      [id, media_type, file_path, req.file.originalname, req.file.size]
    );
    res.json({ success: true, data: { id: result.insertId, file_path, message: 'Uploaded' } });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

router.post('/:id/media/:mediaId/rotate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, mediaId } = req.params;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT rotation FROM job_card_media WHERE id=? AND job_card_id=? AND job_type='quick'`,
      [mediaId, id]
    );
    if (rows.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Media item not found' } });
      return;
    }
    const newRotation = ((rows[0].rotation || 0) + 90) % 360;
    await pool.query(
      `UPDATE job_card_media SET rotation=? WHERE id=? AND job_card_id=? AND job_type='quick'`,
      [newRotation, mediaId, id]
    );
    res.json({ success: true, data: { rotation: newRotation, message: 'Rotated successfully' } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Rotation failed' } });
  }
});

router.get('/:id/media', async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM job_card_media WHERE job_card_id=? AND job_type='quick' ORDER BY uploaded_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

router.delete('/:id/media/:mediaId', async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM job_card_media WHERE id=? AND job_card_id=? AND job_type='quick'`,
      [req.params.mediaId, req.params.id]
    );
    if (rows.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Not found' } });
      return;
    }
    const full = path.resolve(__dirname, '../../../', rows[0].file_path.substring(1));
    if (fs.existsSync(full)) fs.unlinkSync(full);
    await pool.query(`DELETE FROM job_card_media WHERE id=?`, [req.params.mediaId]);
    res.json({ success: true, data: { message: 'Deleted' } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

// ─── POST /send-tracking-sms ────────────────────────
router.post('/send-tracking-sms', async (req: Request, res: Response): Promise<void> => {
  try {
    const { job_card_id } = req.body;
    if (!job_card_id) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'job_card_id is required' } });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM quick_job_cards WHERE id = ?',
      [job_card_id]
    );
    if (rows.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Quick job card not found' } });
      return;
    }

    const jc = rows[0];
    const tracking_url = `${process.env.BASE_URL || 'http://localhost:4000'}/track/${jc.public_token}`;
    const msg = `Dear ${jc.owner_name}, track your quick job card status: ${tracking_url} Ref: ${jc.job_no}`;
    
    await sendQuickWhatsApp(jc.mobile, msg);
    res.json({ success: true, data: { message: 'SMS sent' } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

export default router;
