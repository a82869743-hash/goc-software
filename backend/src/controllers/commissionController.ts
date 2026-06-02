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
