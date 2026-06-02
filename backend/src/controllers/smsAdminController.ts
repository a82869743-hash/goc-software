/**
 * GOC Studio — SMS Admin Controller
 * Endpoints for the Settings > SMS page.
 */
import { Request, Response } from 'express';
import pool from '../utils/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { ERROR_CODES } from '../utils/constants';
import { getSMSQueueStats } from '../services/smsService';

// ─── GET all SMS templates ─────────────────────────────
export const getSMSTemplates = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM sms_templates ORDER BY id ASC'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get SMS templates error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch SMS templates.' } });
  }
};

// ─── UPDATE a single SMS template (flow_id, dlt_id, is_active) ─────
export const updateSMSTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { dlt_template_id, msg91_flow_id, is_active } = req.body;

    const fields: string[] = [];
    const vals: any[] = [];

    if (dlt_template_id !== undefined) { fields.push('dlt_template_id = ?'); vals.push(dlt_template_id || null); }
    if (msg91_flow_id !== undefined) { fields.push('msg91_flow_id = ?'); vals.push(msg91_flow_id || null); }
    if (is_active !== undefined) { fields.push('is_active = ?'); vals.push(is_active ? 1 : 0); }

    if (fields.length === 0) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No fields to update.' } });
      return;
    }

    vals.push(id);
    await pool.query(`UPDATE sms_templates SET ${fields.join(', ')} WHERE id = ?`, vals);

    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM sms_templates WHERE id = ?', [id]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Update SMS template error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to update SMS template.' } });
  }
};

// ─── GET SMS Queue stats ────────────────────────────────
export const getSMSStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getSMSQueueStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Get SMS stats error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch SMS stats.' } });
  }
};

// ─── GET SMS Logs ───────────────────────────────────────
export const getSMSLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 50, event_key, status } = req.query as any;
    const conds: string[] = [];
    const params: any[] = [];

    if (event_key) { conds.push('event_key = ?'); params.push(event_key); }
    if (status) { conds.push('status = ?'); params.push(status); }

    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, mobile, event_key, msg91_request_id, status, error_message, created_at
       FROM sms_logs ${where}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    const [countR] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM sms_logs ${where}`, params
    );

    res.json({
      success: true,
      data: rows,
      meta: {
        total: countR[0].total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(countR[0].total / Number(limit)),
      }
    });
  } catch (error) {
    console.error('Get SMS logs error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch SMS logs.' } });
  }
};

// ─── Retry failed SMS ───────────────────────────────────
export const retryFailedSMS = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE sms_queue SET status = 'pending', attempts = 0, error_msg = NULL WHERE id = ? AND status = 'failed'`,
      [id]
    );
    res.json({ success: true, data: { message: 'SMS retry queued.' } });
  } catch (error) {
    console.error('Retry SMS error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to retry SMS.' } });
  }
};
