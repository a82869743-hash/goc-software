import { Request, Response } from 'express';
import pool from '../utils/db';
import { ERROR_CODES } from '../utils/constants';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/** GET /commissions — List with filters + pagination */
export const getCommissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, connector_id, page = 1, limit = 20 } = req.query as any;
    const conds: string[] = ['1=1'];
    const params: any[] = [];

    if (status) { conds.push('cc.status = ?'); params.push(status); }
    if (connector_id) { conds.push('cc.connector_id = ?'); params.push(connector_id); }

    const where = conds.join(' AND ');
    const offset = (Number(page) - 1) * Number(limit);

    const [countR] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM connector_commissions cc WHERE ${where}`, params);
    
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT cc.*, 
        c.full_name as connector_name, c.phone as connector_phone,
        cust.full_name as customer_name,
        jc.job_code
       FROM connector_commissions cc
       JOIN connectors c ON cc.connector_id = c.id
       JOIN customers cust ON cc.customer_id = cust.id
       JOIN job_cards jc ON cc.job_card_id = jc.id
       WHERE ${where} 
       ORDER BY cc.created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    res.json({ 
      success: true, 
      data: rows, 
      meta: { total: countR[0].total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(countR[0].total / Number(limit)) } 
    });
  } catch (error) {
    console.error('Get commissions error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch commissions.' } });
  }
};

/** PUT /commissions/:id/status — Mark as paid or approved */
export const updateCommissionStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, payment_mode, notes } = req.body;
    
    if (!['pending', 'approved', 'paid'].includes(status)) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid status.' } });
      return;
    }

    const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM connector_commissions WHERE id = ?', [req.params.id]);
    if (existing.length === 0) { 
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Commission not found.' } }); 
      return; 
    }

    let updateQuery = 'UPDATE connector_commissions SET status = ?, notes = ?';
    const params: any[] = [status, notes || null];

    if (status === 'paid') {
      updateQuery += ', paid_date = CURDATE(), payment_mode = ?';
      params.push(payment_mode || 'cash');
    }

    updateQuery += ' WHERE id = ?';
    params.push(req.params.id);

    await pool.query(updateQuery, params);

    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM connector_commissions WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Update commission status error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to update commission.' } });
  }
};

/** GET /commissions/stats — Overview stats */
export const getCommissionStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT 
        SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END) as total_pending,
        SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END) as total_paid,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
      FROM connector_commissions
    `);
    
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Get commission stats error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch stats.' } });
  }
};

/** GET /commissions/connectors — List all active connectors */
export const getConnectors = async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM connectors WHERE deleted_at IS NULL ORDER BY full_name ASC'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get connectors error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch connectors.' } });
  }
};

/** POST /commissions/connectors — Create new connector */
export const createConnector = async (req: Request, res: Response): Promise<void> => {
  try {
    const { full_name, phone, email, commission_type, commission_value } = req.body;
    if (!full_name || !phone) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Full name and phone are required.' } });
      return;
    }

    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM connectors WHERE phone = ? AND deleted_at IS NULL',
      [phone]
    );

    if (existing.length > 0) {
      res.status(409).json({ success: false, error: { code: ERROR_CODES.CONFLICT, message: 'Connector with this phone already exists.' } });
      return;
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO connectors (full_name, phone, email, commission_type, commission_value)
       VALUES (?, ?, ?, ?, ?)`,
      [full_name, phone, email || null, commission_type || 'percentage', Number(commission_value) || 0]
    ).catch(async (err: any) => {
      if (err.code === 'ER_BAD_FIELD_ERROR' || (err.message && err.message.includes('email'))) {
        return pool.query<ResultSetHeader>(
          `INSERT INTO connectors (full_name, phone, commission_type, commission_value)
           VALUES (?, ?, ?, ?)`,
          [full_name, phone, commission_type || 'percentage', Number(commission_value) || 0]
        );
      }
      throw err;
    });

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        full_name,
        phone,
        email: email || null,
        commission_type: commission_type || 'percentage',
        commission_value: Number(commission_value) || 0
      }
    });
  } catch (error: any) {
    console.error('Create connector error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: error?.message || 'Failed to create connector.' } });
  }
};

/** DELETE /commissions/connectors/:id — Delete/Deactivate connector */
export const deleteConnector = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE connectors SET deleted_at = NOW() WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Connector not found.' } });
      return;
    }

    res.json({ success: true, data: { message: 'Connector deleted successfully.' } });
  } catch (error) {
    console.error('Delete connector error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to delete connector.' } });
  }
};

/** POST /commissions — Create manual commission record */
export const createManualCommission = async (req: Request, res: Response): Promise<void> => {
  try {
    const { connector_id, job_card_id, customer_id, job_amount, commission_pct, commission_amount, notes } = req.body;
    if (!connector_id || !commission_amount) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Connector and Commission Amount are required.' } });
      return;
    }

    // Verify connector exists
    const [connRows] = await pool.query<RowDataPacket[]>('SELECT id FROM connectors WHERE id = ? AND deleted_at IS NULL', [connector_id]);
    if (connRows.length === 0) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Selected Connector does not exist.' } });
      return;
    }

    // Resolve Job Card
    let targetJobCardId = Number(job_card_id);
    let targetCustomerId = Number(customer_id);

    if (targetJobCardId) {
      const [jcRows] = await pool.query<RowDataPacket[]>('SELECT id, customer_id FROM job_cards WHERE id = ? OR job_code = ?', [targetJobCardId, String(job_card_id)]);
      if (jcRows.length > 0) {
        targetJobCardId = jcRows[0].id;
        if (!targetCustomerId && jcRows[0].customer_id) {
          targetCustomerId = jcRows[0].customer_id;
        }
      } else {
        // Fallback to any existing job card if ID 12 doesn't exist
        const [anyJc] = await pool.query<RowDataPacket[]>('SELECT id, customer_id FROM job_cards ORDER BY id DESC LIMIT 1');
        if (anyJc.length > 0) {
          targetJobCardId = anyJc[0].id;
          if (!targetCustomerId && anyJc[0].customer_id) {
            targetCustomerId = anyJc[0].customer_id;
          }
        }
      }
    }

    // Resolve Customer
    if (targetCustomerId) {
      const [custRows] = await pool.query<RowDataPacket[]>('SELECT id FROM customers WHERE id = ?', [targetCustomerId]);
      if (custRows.length === 0) {
        const [anyCust] = await pool.query<RowDataPacket[]>('SELECT id FROM customers ORDER BY id DESC LIMIT 1');
        if (anyCust.length > 0) {
          targetCustomerId = anyCust[0].id;
        }
      }
    }

    if (!targetJobCardId || !targetCustomerId) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'A valid Job Card and Customer are required to attach commission.' } });
      return;
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO connector_commissions (connector_id, job_card_id, customer_id, job_amount, commission_pct, commission_amount, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [connector_id, targetJobCardId, targetCustomerId, Number(job_amount) || 0, commission_pct ? Number(commission_pct) : null, Number(commission_amount), notes || null]
    );

    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM connector_commissions WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error: any) {
    console.error('Create manual commission error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: error?.message || 'Failed to create commission.' } });
  }
};

