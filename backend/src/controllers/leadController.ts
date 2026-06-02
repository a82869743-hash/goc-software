import { Request, Response } from 'express';
import pool from '../utils/db';
import { generateCode } from '../utils/codes';
import { ERROR_CODES, LEAD_STATUS_FLOW } from '../utils/constants';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/**
 * GET /leads — List leads with filters, search, pagination
 */
export const getLeads = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, source, assigned_to, search, page = 1, limit = 20, date_from, date_to } = req.query as any;

    const conditions: string[] = ['l.deleted_at IS NULL'];
    const params: any[] = [];

    if (status) { conditions.push('l.status = ?'); params.push(status); }
    if (source) { conditions.push('l.source = ?'); params.push(source); }
    if (assigned_to) { conditions.push('l.assigned_to = ?'); params.push(assigned_to); }
    if (search) {
      conditions.push('(l.full_name LIKE ? OR l.phone LIKE ? OR l.lead_code LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    if (date_from) { conditions.push('l.created_at >= ?'); params.push(date_from); }
    if (date_to) { conditions.push('l.created_at <= ?'); params.push(`${date_to} 23:59:59`); }

    const whereClause = conditions.join(' AND ');
    const offset = (Number(page) - 1) * Number(limit);

    // Count total
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM leads l WHERE ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    // Fetch leads
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT l.*, s.full_name as assigned_staff_name
       FROM leads l
       LEFT JOIN staff s ON l.assigned_to = s.id
       WHERE ${whereClause}
       ORDER BY l.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    res.json({
      success: true,
      data: rows,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({
      success: false,
      error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch leads.' },
    });
  }
};

/**
 * GET /leads/:id — Get single lead with activity log
 */
export const getLeadById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT l.*, s.full_name as assigned_staff_name
       FROM leads l
       LEFT JOIN staff s ON l.assigned_to = s.id
       WHERE l.id = ? AND l.deleted_at IS NULL`,
      [id]
    );

    if (rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Lead not found.' },
      });
      return;
    }

    // Fetch activity log
    const [activities] = await pool.query<RowDataPacket[]>(
      `SELECT la.*, s.full_name as staff_name
       FROM lead_activity_log la
       LEFT JOIN staff s ON la.staff_id = s.id
       WHERE la.lead_id = ?
       ORDER BY la.created_at DESC`,
      [id]
    );

    res.json({
      success: true,
      data: { ...rows[0], activities },
    });
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({
      success: false,
      error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch lead.' },
    });
  }
};

/**
 * POST /leads — Create new lead
 */
export const createLead = async (req: Request, res: Response): Promise<void> => {
  try {
    const leadCode = await generateCode('lead');
    const data = req.body;

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO leads (lead_code, full_name, phone, vehicle_make, vehicle_model, requirement, source, connector_id, assigned_to, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        leadCode, data.full_name, data.phone,
        data.vehicle_make || null, data.vehicle_model || null,
        data.requirement || null, data.source,
        data.connector_id || null, data.assigned_to || null,
        data.notes || null,
      ]
    );

    // Log activity
    await pool.query(
      `INSERT INTO lead_activity_log (lead_id, staff_id, action, new_value, notes) VALUES (?, ?, 'created', 'new', 'Lead created')`,
      [result.insertId, req.staff?.id]
    );

    // Fetch created lead
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM leads WHERE id = ?', [result.insertId]
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({
        success: false,
        error: { code: ERROR_CODES.CONFLICT, message: 'A lead with this phone number already exists.' },
      });
      return;
    }
    console.error('Create lead error:', error);
    res.status(500).json({
      success: false,
      error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to create lead.' },
    });
  }
};

/**
 * PUT /leads/:id — Update lead
 */
export const updateLead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = req.body;

    // Verify lead exists
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM leads WHERE id = ? AND deleted_at IS NULL', [id]
    );
    if (existing.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Lead not found.' },
      });
      return;
    }

    const lead = existing[0];

    // Validate status transition if status is being changed
    if (data.status && data.status !== lead.status) {
      const allowed = LEAD_STATUS_FLOW[lead.status] || [];
      if (!allowed.includes(data.status)) {
        res.status(422).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: `Cannot change status from "${lead.status}" to "${data.status}". Allowed: ${allowed.join(', ')}`,
          },
        });
        return;
      }
    }

    // Ensure lost_reason is required when status = lost
    const currentStatus = data.status || lead.status;
    const currentLostReason = data.lost_reason !== undefined ? data.lost_reason : lead.lost_reason;
    if (currentStatus === 'lost' && (!currentLostReason || currentLostReason.trim() === '')) {
      res.status(422).json({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'lost_reason is required when lead status is "lost".',
        },
      });
      return;
    }

    // Build dynamic update query
    const fields: string[] = [];
    const values: any[] = [];

    const updateableFields = ['full_name', 'phone', 'vehicle_make', 'vehicle_model', 'requirement', 'source', 'connector_id', 'assigned_to', 'status', 'lost_reason', 'notes'];
    for (const field of updateableFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (fields.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No fields to update.' },
      });
      return;
    }

    values.push(id);
    await pool.query(`UPDATE leads SET ${fields.join(', ')} WHERE id = ?`, values);

    // Log status change activity
    if (data.status && data.status !== lead.status) {
      await pool.query(
        `INSERT INTO lead_activity_log (lead_id, staff_id, action, old_value, new_value, notes) VALUES (?, ?, 'status_change', ?, ?, ?)`,
        [id, req.staff?.id, lead.status, data.status, data.notes || null]
      );
    }

    const [updated] = await pool.query<RowDataPacket[]>('SELECT * FROM leads WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({
      success: false,
      error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to update lead.' },
    });
  }
};

/**
 * DELETE /leads/:id — Soft delete lead
 */
export const deleteLead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM leads WHERE id = ? AND deleted_at IS NULL', [id]
    );
    if (existing.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Lead not found.' },
      });
      return;
    }

    await pool.query('UPDATE leads SET deleted_at = NOW() WHERE id = ?', [id]);

    res.json({ success: true, data: { message: 'Lead deleted successfully.' } });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({
      success: false,
      error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to delete lead.' },
    });
  }
};

/**
 * GET /leads/stats — Lead pipeline stats
 */
export const getLeadStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT status, COUNT(*) as count
       FROM leads
       WHERE deleted_at IS NULL
       GROUP BY status`
    );

    const stats: Record<string, number> = {
      new: 0, contacted: 0, interested: 0, quotation_sent: 0, booked: 0, lost: 0,
    };
    for (const row of rows) {
      stats[row.status] = row.count;
    }

    const total = Object.values(stats).reduce((a, b) => a + b, 0);

    res.json({
      success: true,
      data: { ...stats, total },
    });
  } catch (error) {
    console.error('Lead stats error:', error);
    res.status(500).json({
      success: false,
      error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch lead stats.' },
    });
  }
};

/**
 * PATCH /leads/bulk-reassign — Bulk reassign leads
 */
export const bulkReassignLeads = async (req: Request, res: Response): Promise<void> => {
  try {
    const { lead_ids, assigned_to } = req.body;

    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'lead_ids must be a non-empty array.' },
      });
      return;
    }

    // Verify staff exists and is active
    const [staffExists] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM staff WHERE id = ? AND deleted_at IS NULL',
      [assigned_to]
    );
    if (staffExists.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Staff member not found.' },
      });
      return;
    }

    const placeholders = lead_ids.map(() => '?').join(', ');
    await pool.query(
      `UPDATE leads SET assigned_to = ? WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
      [assigned_to, ...lead_ids]
    );

    // Create activity logs for all leads in bulk
    for (const lead_id of lead_ids) {
      await pool.query(
        `INSERT INTO lead_activity_log (lead_id, staff_id, action, new_value, notes) VALUES (?, ?, 'reassign', ?, ?)`,
        [lead_id, req.staff?.id, String(assigned_to), 'Lead bulk reassigned']
      );
    }

    res.json({
      success: true,
      data: { message: `Successfully reassigned ${lead_ids.length} leads.` },
    });
  } catch (error) {
    console.error('Bulk reassign leads error:', error);
    res.status(500).json({
      success: false,
      error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to bulk reassign leads.' },
    });
  }
};
