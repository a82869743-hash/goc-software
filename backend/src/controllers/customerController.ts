import { Request, Response } from 'express';
import pool from '../utils/db';
import { generateCode } from '../utils/codes';
import { ERROR_CODES } from '../utils/constants';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/** GET /customers — List with search + pagination */
export const getCustomers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query as any;
    const conds: string[] = ['c.deleted_at IS NULL'];
    const params: any[] = [];

    if (status) { conds.push('c.status = ?'); params.push(status); }
    if (search) {
      conds.push('(c.full_name LIKE ? OR c.phone LIKE ? OR c.customer_code LIKE ? OR c.email LIKE ? OR EXISTS (SELECT 1 FROM vehicles v WHERE v.customer_id = c.id AND v.reg_number LIKE ?))');
      const t = `%${search}%`; params.push(t, t, t, t, t);
    }

    const where = conds.join(' AND ');
    const offset = (Number(page) - 1) * Number(limit);

    const [countR] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM customers c WHERE ${where}`, params);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.*, 
              (SELECT COUNT(*) FROM vehicles v WHERE v.customer_id = c.id) as vehicle_count,
              (SELECT GROUP_CONCAT(CONCAT_WS(':', l.lead_code, l.status, COALESCE(l.requirement, '')) SEPARATOR ';') 
               FROM leads l WHERE (l.customer_id = c.id OR l.phone = c.phone) AND l.deleted_at IS NULL) as lead_tags
       FROM customers c WHERE ${where} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    res.json({ success: true, data: rows, meta: { total: countR[0].total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(countR[0].total / Number(limit)) } });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch customers.' } });
  }
};

/** GET /customers/:id — Single customer with vehicles */
export const getCustomerById = async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.*,
              con.full_name as connector_name,
              con.phone as connector_phone,
              (SELECT GROUP_CONCAT(CONCAT_WS(':', l.lead_code, l.status, COALESCE(l.requirement, '')) SEPARATOR ';') 
               FROM leads l WHERE (l.customer_id = c.id OR l.phone = c.phone) AND l.deleted_at IS NULL) as lead_tags
       FROM customers c 
       LEFT JOIN connectors con ON c.connector_id = con.id
       WHERE c.id = ? AND c.deleted_at IS NULL`, [req.params.id]);
    if (rows.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Customer not found.' } }); return; }

    const [vehicles] = await pool.query<RowDataPacket[]>('SELECT * FROM vehicles WHERE customer_id = ? ORDER BY is_primary DESC, created_at DESC', [req.params.id]);

    res.json({ success: true, data: { ...rows[0], vehicles } });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch customer.' } });
  }
};

/** POST /customers — Create */
export const createCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = await generateCode('customer');
    const d = req.body;
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO customers (customer_code, full_name, phone, alt_phone, email, address, city, lead_source, connector_id, dob, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, d.full_name, d.phone, d.alt_phone || null, d.email || null, d.address || null, d.city || 'Vadodara', d.lead_source || 'walkin', d.connector_id || null, d.dob || null, d.notes || null]
    );
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM customers WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') { res.status(409).json({ success: false, error: { code: ERROR_CODES.CONFLICT, message: 'Customer with this phone already exists.' } }); return; }
    console.error('Create customer error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to create customer.' } });
  }
};

/** PUT /customers/:id — Update */
export const updateCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (existing.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Customer not found.' } }); return; }

    const d = req.body;
    const fields: string[] = []; const vals: any[] = [];
    const allowed = ['full_name', 'phone', 'alt_phone', 'email', 'address', 'city', 'lead_source', 'connector_id', 'dob', 'status', 'notes'];
    for (const f of allowed) { if (d[f] !== undefined) { fields.push(`${f} = ?`); vals.push(d[f]); } }
    if (fields.length === 0) { res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No fields to update.' } }); return; }

    vals.push(req.params.id);
    await pool.query(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`, vals);
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to update customer.' } });
  }
};

/** DELETE /customers/:id — Soft delete */
export const deleteCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (existing.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Customer not found.' } }); return; }
    await pool.query('UPDATE customers SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: { message: 'Customer deleted.' } });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to delete customer.' } });
  }
};

/** GET /customers/search — Quick search for autocomplete */
export const searchCustomers = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = req.query.q as string || '';
    if (q.length < 2) { res.json({ success: true, data: [] }); return; }
    const term = `%${q}%`;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.id, c.customer_code, c.full_name, c.phone,
              v.id AS vehicle_id, v.reg_number AS car_number, v.make AS car_make, v.model AS car_model
       FROM customers c
       LEFT JOIN vehicles v ON v.customer_id = c.id AND v.deleted_at IS NULL
       WHERE c.deleted_at IS NULL AND (c.full_name LIKE ? OR c.phone LIKE ? OR v.reg_number LIKE ?)
       LIMIT 10`,
      [term, term, term]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Search customers error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Search failed.' } });
  }
};
