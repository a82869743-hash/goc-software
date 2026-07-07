import { Request, Response } from 'express';
import pool from '../utils/db';
import { ERROR_CODES } from '../utils/constants';
import { RowDataPacket } from 'mysql2';

/**
 * GET /system-logs
 * Retrieves paginated audit logs from system_logs, supporting filters for action_type, staff_id, and search terms.
 */
export const getSystemLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const { staff_id, action_type, search, start_date, end_date } = req.query;

    let query = `
      SELECT l.id, l.staff_id, s.full_name as staff_name, s.role as staff_role,
             l.action_type, l.entity_type, l.entity_id, l.description,
             l.ip_address, l.user_agent, l.created_at
      FROM system_logs l
      LEFT JOIN staff s ON s.id = l.staff_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (staff_id) {
      query += ` AND l.staff_id = ?`;
      params.push(parseInt(staff_id as string));
    }

    if (action_type) {
      query += ` AND l.action_type = ?`;
      params.push(action_type);
    }

    if (search) {
      query += ` AND l.description LIKE ?`;
      params.push(`%${search}%`);
    }

    if (start_date) {
      query += ` AND l.created_at >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND l.created_at <= ?`;
      params.push(`${end_date} 23:59:59`);
    }

    query += ` ORDER BY l.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    // Get count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM system_logs l WHERE 1=1`;
    const countParams: any[] = [];

    if (staff_id) {
      countQuery += ` AND l.staff_id = ?`;
      countParams.push(parseInt(staff_id as string));
    }

    if (action_type) {
      countQuery += ` AND l.action_type = ?`;
      countParams.push(action_type);
    }

    if (search) {
      countQuery += ` AND l.description LIKE ?`;
      countParams.push(`%${search}%`);
    }

    if (start_date) {
      countQuery += ` AND l.created_at >= ?`;
      countParams.push(start_date);
    }

    if (end_date) {
      countQuery += ` AND l.created_at <= ?`;
      countParams.push(`${end_date} 23:59:59`);
    }

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    const [countRows] = await pool.query<RowDataPacket[]>(countQuery, countParams);

    const total = countRows[0].total;

    res.json({
      success: true,
      data: {
        logs: rows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        }
      }
    });
  } catch (error) {
    console.error('❌ Get system logs error:', error);
    res.status(500).json({
      success: false,
      error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to retrieve system logs.' },
    });
  }
};
