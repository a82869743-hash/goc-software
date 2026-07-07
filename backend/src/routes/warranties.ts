import { Router, Request, Response } from 'express';
import pool from '../utils/db';
import { authMiddleware } from '../middleware/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { ERROR_CODES } from '../utils/constants';
import { generateCode } from '../utils/codes';

const router = Router();

// ─── PUBLIC ENDPOINTS ──────────────────────────────

// Check vehicle warranties by registration number
router.get('/public/check', async (req: Request, res: Response): Promise<void> => {
  try {
    const { reg_number } = req.query;
    if (!reg_number) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'reg_number is required' } });
      return;
    }

    const [warranties] = await pool.query<RowDataPacket[]>(
      `SELECT w.*, c.full_name as customer_name, CONCAT(v.make, ' ', v.model) as vehicle_name, v.reg_number, j.job_code
       FROM warranties w
       LEFT JOIN customers c ON w.customer_id = c.id
       LEFT JOIN vehicles v ON w.vehicle_id = v.id
       LEFT JOIN job_cards j ON w.job_card_id = j.id
       WHERE v.reg_number = ? OR REPLACE(v.reg_number, '-', '') = REPLACE(?, '-', '')`,
      [reg_number, reg_number]
    );

    res.json({ success: true, data: warranties });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

// Submit a claim request from public page
router.post('/public/claim', async (req: Request, res: Response): Promise<void> => {
  try {
    const { warranty_id, issue_description } = req.body;
    if (!warranty_id || !issue_description) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'warranty_id and issue_description are required' } });
      return;
    }

    const [wRows] = await pool.query<RowDataPacket[]>('SELECT id FROM warranties WHERE id = ?', [warranty_id]);
    if (wRows.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Warranty not found' } });
      return;
    }

    const claimCode = `WCL-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO warranty_claims (warranty_id, claim_code, issue_description, status) VALUES (?, ?, ?, 'pending')`,
      [warranty_id, claimCode, issue_description]
    );

    res.json({ success: true, data: { id: result.insertId, claim_code: claimCode, message: 'Warranty claim submitted successfully' } });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

// ─── AUTHENTICATED STAFF ENDPOINTS ─────────────────
router.use(authMiddleware);

// List all warranties
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, status } = req.query;
    const conds: string[] = [];
    const params: any[] = [];

    if (status) {
      conds.push('w.status = ?');
      params.push(status);
    }
    if (search) {
      conds.push('(c.full_name LIKE ? OR v.reg_number LIKE ? OR w.warranty_card_no LIKE ?)');
      const t = `%${search}%`;
      params.push(t, t, t);
    }

    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    const query = `
      SELECT w.*, c.full_name as customer_name, c.phone as customer_phone,
             CONCAT(v.make, ' ', v.model) as vehicle_name, v.reg_number, j.job_code
      FROM warranties w
      LEFT JOIN customers c ON w.customer_id = c.id
      LEFT JOIN vehicles v ON w.vehicle_id = v.id
      LEFT JOIN job_cards j ON w.job_card_id = j.id
      ${where}
      ORDER BY w.created_at DESC
    `;

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    res.json({ success: true, data: rows });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

// Manually register a warranty
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { customer_id, vehicle_id, job_card_id, service_name, duration_months, warranty_card_no, start_date } = req.body;
    if (!customer_id || !vehicle_id || !job_card_id || !service_name || !duration_months || !warranty_card_no || !start_date) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'All fields are required' } });
      return;
    }

    const startDate = new Date(start_date);
    const expiryDate = new Date(startDate);
    expiryDate.setMonth(expiryDate.getMonth() + Number(duration_months));

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO warranties (customer_id, vehicle_id, job_card_id, service_name, warranty_card_no, duration_months, start_date, expiry_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [customer_id, vehicle_id, job_card_id, service_name, warranty_card_no, duration_months, startDate, expiryDate]
    );

    res.status(201).json({ success: true, data: { id: result.insertId, message: 'Warranty registered successfully' } });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

// List all claims
router.get('/claims', async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT wc.*, w.service_name, w.warranty_card_no, w.expiry_date,
              c.full_name as customer_name, c.phone as customer_phone,
              CONCAT(v.make, ' ', v.model) as vehicle_name, v.reg_number
       FROM warranty_claims wc
       LEFT JOIN warranties w ON wc.warranty_id = w.id
       LEFT JOIN customers c ON w.customer_id = c.id
       LEFT JOIN vehicles v ON w.vehicle_id = v.id
       ORDER BY wc.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

// Update claim status
router.put('/claims/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected', 'in_progress', 'completed'].includes(status)) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid claim status' } });
      return;
    }

    await pool.query('UPDATE warranty_claims SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, message: 'Claim status updated' });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

// Convert claim to a warranty job card
router.post('/claims/:id/convert-job', async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [claims] = await connection.query<RowDataPacket[]>(
      `SELECT wc.*, w.customer_id, w.vehicle_id, w.service_name
       FROM warranty_claims wc
       LEFT JOIN warranties w ON wc.warranty_id = w.id
       WHERE wc.id = ?`,
      [req.params.id]
    );

    if (claims.length === 0) {
      connection.release();
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Claim not found' } });
      return;
    }
    const claim = claims[0];

    const staffId = (req as any).staff?.id || 1;
    const code = await generateCode('job');

    // Create job card with type regular but service type warranty
    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO job_cards (job_code, customer_id, vehicle_id, job_type, status, created_by)
       VALUES (?, ?, ?, 'walkin', 'in_progress', ?)`,
      [code, claim.customer_id, claim.vehicle_id, staffId]
    );

    const jobId = result.insertId;

    // Add warranty claim service line item (₹0 cost since it's warranty!)
    await connection.query(
      `INSERT INTO job_services (job_card_id, service_name, service_type, package_tier, description, unit_price, quantity, line_total, tax_pct, item_type)
       VALUES (?, ?, 'other', 'basic', ?, 0, 1, 0, 18, 'labor')`,
      [jobId, `Warranty Repair: ${claim.service_name}`, claim.issue_description]
    );

    // Update claim status to in_progress
    await connection.query('UPDATE warranty_claims SET status = "in_progress" WHERE id = ?', [req.params.id]);

    await connection.commit();
    res.json({ success: true, data: { jobId, job_code: code, message: 'Claim successfully converted to Warranty Job Card' } });
  } catch (e: any) {
    await connection.rollback();
    console.error(e);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  } finally {
    connection.release();
  }
});

export default router;
