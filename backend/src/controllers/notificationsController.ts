import { Request, Response } from 'express';
import pool from '../utils/db';
import { ERROR_CODES } from '../utils/constants';
import { RowDataPacket } from 'mysql2';

/**
 * GOC Studio — Notifications Controller
 * Handles CRUD operations for in-app notifications
 */

// ─── LIST NOTIFICATIONS (for logged-in staff) ─────────────
export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const staffId = (req as any).staff?.id;
    const { is_read, page = 1, limit = 30 } = req.query as any;
    const conds: string[] = ['n.staff_id = ?'];
    const params: any[] = [staffId];

    if (is_read !== undefined) {
      conds.push('n.is_read = ?');
      params.push(is_read === 'true' || is_read === '1' ? 1 : 0);
    }

    const where = conds.join(' AND ');
    const offset = (Number(page) - 1) * Number(limit);

    const [countR] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM notifications n WHERE ${where}`, params
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT n.* FROM notifications n WHERE ${where} ORDER BY n.created_at DESC LIMIT ? OFFSET ?`,
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
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch notifications.' } });
  }
};

// ─── UNREAD COUNT ──────────────────────────────────────────
export const getUnreadCount = async (req: Request, res: Response): Promise<void> => {
  try {
    const staffId = (req as any).staff?.id;
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM notifications WHERE staff_id = ? AND is_read = 0', [staffId]
    );
    res.json({ success: true, data: { unread: rows[0].count } });
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } });
  }
};

// ─── MARK AS READ (single) ────────────────────────────────
export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const staffId = (req as any).staff?.id;
    const { id } = req.params;

    await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND staff_id = ?',
      [id, staffId]
    );

    res.json({ success: true, data: { message: 'Marked as read.' } });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } });
  }
};

// ─── MARK ALL AS READ ──────────────────────────────────────
export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const staffId = (req as any).staff?.id;

    await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE staff_id = ? AND is_read = 0',
      [staffId]
    );

    res.json({ success: true, data: { message: 'All notifications marked as read.' } });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } });
  }
};

// ─── DELETE NOTIFICATION ───────────────────────────────────
export const deleteNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const staffId = (req as any).staff?.id;
    const { id } = req.params;

    await pool.query(
      'DELETE FROM notifications WHERE id = ? AND staff_id = ?',
      [id, staffId]
    );

    res.json({ success: true, data: { message: 'Notification deleted.' } });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } });
  }
};

// ─── CLEAR ALL ─────────────────────────────────────────────
export const clearAll = async (req: Request, res: Response): Promise<void> => {
  try {
    const staffId = (req as any).staff?.id;
    await pool.query('DELETE FROM notifications WHERE staff_id = ?', [staffId]);
    res.json({ success: true, data: { message: 'All notifications cleared.' } });
  } catch (error) {
    console.error('Clear all error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } });
  }
};
