import { Request, Response } from 'express';
import pool from '../utils/db';
import { ERROR_CODES } from '../utils/constants';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { sendQuickWhatsApp, WhatsAppTemplates } from '../services/whatsappService';
import fs from 'fs';
import path from 'path';

/**
 * GOC Studio — Marketing Controller
 * Handles WhatsApp logs, quick send, campaigns CRUD
 */

// ─── GET WHATSAPP LOGS ────────────────────────────────────
export const getWhatsAppLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, search, template_name, page = 1, limit = 20 } = req.query as any;
    const conds: string[] = [];
    const params: any[] = [];

    if (status) { conds.push('w.status = ?'); params.push(status); }
    if (template_name) { conds.push('w.template_name = ?'); params.push(template_name); }
    if (search) {
      conds.push('(w.phone LIKE ? OR c.full_name LIKE ? OR w.template_name LIKE ?)');
      const t = `%${search}%`;
      params.push(t, t, t);
    }

    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    const [countR] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM whatsapp_logs w LEFT JOIN customers c ON w.customer_id = c.id ${where}`,
      params
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT w.*, c.full_name as customer_name, s.full_name as sent_by_name
       FROM whatsapp_logs w
       LEFT JOIN customers c ON w.customer_id = c.id
       LEFT JOIN staff s ON w.triggered_by = s.id
       ${where}
       ORDER BY w.created_at DESC LIMIT ? OFFSET ?`,
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
    console.error('Get WhatsApp logs error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch WhatsApp logs.' } });
  }
};

// ─── WHATSAPP STATS ────────────────────────────────────────
export const getWhatsAppStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT status, COUNT(*) as count FROM whatsapp_logs GROUP BY status`
    );
    const [todayCount] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM whatsapp_logs WHERE DATE(created_at) = CURDATE()`
    );
    const [weekCount] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM whatsapp_logs WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`
    );

    const stats: Record<string, number> = { sent: 0, delivered: 0, read: 0, failed: 0, queued: 0 };
    for (const row of rows) {
      stats[row.status] = row.count;
    }

    res.json({
      success: true,
      data: {
        ...stats,
        today: todayCount[0].count,
        this_week: weekCount[0].count,
        total: Object.values(stats).reduce((a, b) => a + b, 0),
      },
    });
  } catch (error) {
    console.error('WhatsApp stats error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch stats.' } });
  }
};

// ─── QUICK SEND ────────────────────────────────────────────
export const quickSend = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, message, customer_id } = req.body;
    const staffId = (req as any).staff?.id;

    if (!phone || !message) {
      res.status(400).json({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Phone and message are required.' },
      });
      return;
    }

    const result = await sendQuickWhatsApp(phone, message, staffId);

    res.json({
      success: result.success,
      data: {
        message: result.success ? 'Message sent successfully' : 'Message failed to send',
        error: result.error || null,
        messageId: result.messageId || null,
      },
    });
  } catch (error) {
    console.error('Quick send error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to send message.' } });
  }
};

// ─── CAMPAIGNS CRUD ────────────────────────────────────────
export const getCampaigns = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, page = 1, limit = 20 } = req.query as any;
    const conds: string[] = [];
    const params: any[] = [];

    if (status) { conds.push('status = ?'); params.push(status); }
    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    const [countR] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM campaigns ${where}`, params
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.*, s.full_name as created_by_name
       FROM campaigns c
       LEFT JOIN staff s ON c.created_by = s.id
       ${where}
       ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
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
    console.error('Get campaigns error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch campaigns.' } });
  }
};

export const createCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    const d = req.body;
    const staffId = (req as any).staff?.id;

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO campaigns (name, template_name, segment_type, segment_filter, scheduled_at, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [d.name, d.template_name, d.segment_type || 'all', JSON.stringify(d.segment_filter || {}), d.scheduled_at || null, d.notes || null, staffId]
    );

    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to create campaign.' } });
  }
};

export const updateCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Campaign not found.' } });
      return;
    }

    const d = req.body;
    const fields: string[] = [];
    const vals: any[] = [];

    const allowed = ['name', 'template_name', 'segment_type', 'scheduled_at', 'status', 'notes'];
    for (const f of allowed) {
      if (d[f] !== undefined) { fields.push(`${f} = ?`); vals.push(d[f]); }
    }
    if (d.segment_filter) { fields.push('segment_filter = ?'); vals.push(JSON.stringify(d.segment_filter)); }
    if (fields.length === 0) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No fields.' } });
      return;
    }

    vals.push(req.params.id);
    await pool.query(`UPDATE campaigns SET ${fields.join(', ')} WHERE id = ?`, vals);
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Update campaign error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to update campaign.' } });
  }
};

export const deleteCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM campaigns WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Campaign not found.' } });
      return;
    }
    await pool.query('DELETE FROM campaigns WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: { message: 'Campaign deleted.' } });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to delete campaign.' } });
  }
};

// ─── EXECUTE CAMPAIGN (Bulk Send) ──────────────────────────
export const executeCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const [campaigns] = await pool.query<RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ?', [id]);
    if (campaigns.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Campaign not found.' } });
      return;
    }

    const campaign = campaigns[0];
    if (campaign.status === 'completed') {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Campaign already executed.' } });
      return;
    }

    // Determine audience based on segment
    let query = `SELECT id, full_name, phone FROM customers WHERE deleted_at IS NULL AND status != 'inactive'`;
    const params: any[] = [];

    if (campaign.segment_type === 'vip') {
      query += ` AND status = 'vip'`;
    } else if (campaign.segment_type === 'recent') {
      query += ` AND last_visit >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)`;
    }

    const [customers] = await pool.query<RowDataPacket[]>(query, params);

    // Update campaign status
    await pool.query(
      `UPDATE campaigns SET status = 'running', total_recipients = ?, started_at = NOW() WHERE id = ?`,
      [customers.length, id]
    );

    // Send messages (async, non-blocking)
    let successCount = 0;
    let failCount = 0;

    for (const cust of customers) {
      try {
        const result = await WhatsAppTemplates.leadWelcome(cust.phone, cust.full_name);
        if (result.success) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    // Finalize campaign
    await pool.query(
      `UPDATE campaigns SET status = 'completed', sent_count = ?, failed_count = ?, completed_at = NOW() WHERE id = ?`,
      [successCount, failCount, id]
    );

    res.json({
      success: true,
      data: {
        message: 'Campaign executed',
        total: customers.length,
        sent: successCount,
        failed: failCount,
      },
    });
  } catch (error) {
    console.error('Execute campaign error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to execute campaign.' } });
  }
};

/** GET /marketing/materials — List all promotional materials */
export const getPromotionalMaterials = async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM promotional_materials ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get promotional materials error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch materials.' } });
  }
};

/** POST /marketing/materials — Upload promotional material */
export const uploadPromotionalMaterial = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No file uploaded.' } });
      return;
    }

    const { title, description } = req.body;
    if (!title) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Title is required.' } });
      return;
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    let fileType: 'image' | 'video' | 'document' | 'other' = 'other';
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
      fileType = 'image';
    } else if (['.mp4', '.mov', '.avi', '.mkv'].includes(ext)) {
      fileType = 'video';
    } else if (['.pdf', '.doc', '.docx', '.xls', '.xlsx'].includes(ext)) {
      fileType = 'document';
    }

    const fileUrl = `/uploads/materials/${req.file.filename}`;

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO promotional_materials (title, description, file_type, file_url, file_size)
       VALUES (?, ?, ?, ?, ?)`,
      [title, description || null, fileType, fileUrl, req.file.size]
    );

    const [newRow] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM promotional_materials WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({ success: true, data: newRow[0] });
  } catch (error) {
    console.error('Upload promotional material error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to upload material.' } });
  }
};

/** DELETE /marketing/materials/:id — Delete promotional material */
export const deletePromotionalMaterial = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM promotional_materials WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Material not found.' } });
      return;
    }

    const material = existing[0];

    const filePath = path.resolve(__dirname, '../../../', material.file_url.replace(/^\//, ''));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await pool.query('DELETE FROM promotional_materials WHERE id = ?', [id]);

    res.json({ success: true, data: { message: 'Promotional material deleted.' } });
  } catch (error) {
    console.error('Delete promotional material error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to delete material.' } });
  }
};
