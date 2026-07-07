import { Request, Response } from 'express';
import pool from '../utils/db';
import { generateCode } from '../utils/codes';
import { ERROR_CODES } from '../utils/constants';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

// ─── LIST STAFF ───────────────────────────────────
export const getStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, status, search, page = 1, limit = 20 } = req.query as any;
    const conds: string[] = ['s.deleted_at IS NULL'];
    const params: any[] = [];
    if (role) { conds.push('s.role = ?'); params.push(role); }
    if (status) { conds.push('s.status = ?'); params.push(status); }
    if (search) { conds.push('(s.full_name LIKE ? OR s.phone LIKE ? OR s.staff_code LIKE ?)'); const t = `%${search}%`; params.push(t, t, t); }
    const where = conds.join(' AND ');
    const offset = (Number(page) - 1) * Number(limit);

    const [countR] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM staff s WHERE ${where}`, params);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.id, s.staff_code, s.full_name, s.phone, s.email, s.role, s.salary_type, s.salary_amount, s.join_date, s.status, s.created_at
       FROM staff s WHERE ${where} ORDER BY s.id DESC LIMIT ? OFFSET ?`, [...params, Number(limit), offset]);

    res.json({ success: true, data: rows, meta: { total: countR[0].total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(countR[0].total / Number(limit)) } });
  } catch (error) { console.error('Get staff error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

// ─── GET BY ID ────────────────────────────────────
export const getStaffById = async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.id, s.staff_code, s.full_name, s.phone, s.email, s.role, s.salary_type, s.salary_amount, s.join_date, s.status, s.created_at
       FROM staff s WHERE s.id = ? AND s.deleted_at IS NULL`, [req.params.id]);
    if (rows.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Staff not found.' } }); return; }
    // Recent attendance
    const [attendance] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM attendance WHERE staff_id = ? ORDER BY date DESC LIMIT 30', [req.params.id]);
    res.json({ success: true, data: { ...rows[0], attendance } });
  } catch (error) { console.error('Get staff error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

// ─── CREATE ───────────────────────────────────────
export const createStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = await generateCode('staff');
    const d = req.body;
    const hashedPassword = await bcrypt.hash(d.password, 10);

    // Check unique phone
    const [dup] = await pool.query<RowDataPacket[]>('SELECT id FROM staff WHERE phone = ? AND deleted_at IS NULL', [d.phone]);
    if (dup.length > 0) { res.status(409).json({ success: false, error: { code: ERROR_CODES.CONFLICT, message: 'Phone already registered.' } }); return; }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO staff (staff_code, full_name, phone, email, role, salary_type, salary_amount, join_date, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, d.full_name, d.phone, d.email || null, d.role, d.salary_type || 'monthly', d.salary_amount || 0, d.join_date, hashedPassword]);

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, staff_code, full_name, phone, email, role, salary_type, salary_amount, join_date, status FROM staff WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) { console.error('Create staff error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

// ─── UPDATE ───────────────────────────────────────
export const updateStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM staff WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (existing.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Staff not found.' } }); return; }
    const d = req.body;
    const fields: string[] = []; const vals: any[] = [];
    const simple = ['full_name', 'phone', 'email', 'role', 'salary_type', 'salary_amount', 'status'];
    for (const f of simple) { if (d[f] !== undefined) { fields.push(`${f} = ?`); vals.push(d[f]); } }
    if (fields.length === 0) { res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No fields.' } }); return; }
    vals.push(req.params.id);
    await pool.query(`UPDATE staff SET ${fields.join(', ')} WHERE id = ?`, vals);
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, staff_code, full_name, phone, email, role, salary_type, salary_amount, join_date, status FROM staff WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: rows[0] });
  } catch (error) { console.error('Update staff error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

// ─── DELETE ───────────────────────────────────────
export const deleteStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM staff WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (existing.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Staff not found.' } }); return; }
    await pool.query('UPDATE staff SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: { message: 'Staff member removed.' } });
  } catch (error) { console.error('Delete staff error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

// ─── MARK ATTENDANCE ──────────────────────────────
export const markAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const d = req.body;
    const today = new Date().toISOString().split('T')[0];

    let checkInVal = null;
    let checkOutVal = null;
    let workingHours = null;

    if (d.status !== 'absent' && d.status !== 'leave') {
      if (d.check_in_time) {
        checkInVal = d.check_in_time.includes(':') && d.check_in_time.length <= 8 ? `${today} ${d.check_in_time}` : d.check_in_time;
      } else {
        checkInVal = `${today} 09:00:00`;
      }

      if (d.check_out_time) {
        checkOutVal = d.check_out_time.includes(':') && d.check_out_time.length <= 8 ? `${today} ${d.check_out_time}` : d.check_out_time;
      } else {
        checkOutVal = `${today} 18:00:00`;
      }

      if (checkInVal && checkOutVal) {
        const inTime = new Date(checkInVal).getTime();
        const outTime = new Date(checkOutVal).getTime();
        if (!isNaN(inTime) && !isNaN(outTime) && outTime > inTime) {
          workingHours = +((outTime - inTime) / (1000 * 60 * 60)).toFixed(2);
        }
      }
    }

    // Upsert: if already exists for today, update
    const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM attendance WHERE staff_id = ? AND date = ?', [d.staff_id, today]);
    if (existing.length > 0) {
      await pool.query(
        'UPDATE attendance SET status = ?, notes = ?, check_in_time = ?, check_out_time = ?, working_hours = ? WHERE id = ?',
        [d.status, d.notes || null, checkInVal, checkOutVal, workingHours, existing[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO attendance (staff_id, date, check_in_time, check_out_time, status, working_hours, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [d.staff_id, today, checkInVal, checkOutVal, d.status, workingHours, d.notes || null]
      );
    }
    res.json({ success: true, data: { message: 'Attendance marked.' } });
  } catch (error) { console.error('Mark attendance error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

// ─── TODAY'S ATTENDANCE ───────────────────────────
export const getTodayAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const today = (req.query.date as string) || getISTDate();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.id as staff_id, s.staff_code, s.full_name, s.role, a.id as attendance_id, a.status as att_status, a.check_in_time, a.check_out_time, a.notes
       FROM staff s LEFT JOIN attendance a ON s.id = a.staff_id AND a.date = ?
       WHERE s.deleted_at IS NULL AND s.status = 'active' ORDER BY s.full_name`, [today]);
    res.json({ success: true, data: rows });
  } catch (error) { console.error('Today attendance error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

/** POST /staff/check-in — Selfie + GPS check-in */
export const staffCheckIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const staffId = (req as any).staff?.id;
    const { lat, lng, selfie_url, notes } = req.body;

    if (!lat || !lng) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'GPS coordinates (lat, lng) are required.' } });
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM attendance WHERE staff_id = ? AND date = ?',
      [staffId, today]
    );

    if (existing.length > 0) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Already checked in today.' } });
      return;
    }

    const now = new Date();
    const cutoffHour = 9;
    const cutoffMinute = 30;
    
    let status = 'present';
    let isLate = 0;

    if (now.getHours() > cutoffHour || (now.getHours() === cutoffHour && now.getMinutes() > cutoffMinute)) {
      status = 'late';
      isLate = 1;
    }

    await pool.query(
      `INSERT INTO attendance (staff_id, date, check_in_time, check_in_lat, check_in_lng, check_in_photo, status, is_late, notes)
       VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?)`,
      [staffId, today, lat, lng, selfie_url || null, status, isLate, notes || null]
    );

    res.json({
      success: true,
      data: { message: 'Checked in successfully.', status, is_late: !!isLate },
    });
  } catch (error) {
    console.error('Check in error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to check in.' } });
  }
};

/** POST /staff/check-out — Selfie + GPS check-out */
export const staffCheckOut = async (req: Request, res: Response): Promise<void> => {
  try {
    const staffId = (req as any).staff?.id;
    const { lat, lng, selfie_url, notes } = req.body;

    if (!lat || !lng) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'GPS coordinates (lat, lng) are required.' } });
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id, check_in_time FROM attendance WHERE staff_id = ? AND date = ?',
      [staffId, today]
    );

    if (existing.length === 0) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'You have not checked in today yet.' } });
      return;
    }

    const att = existing[0];
    const now = new Date();
    const checkIn = new Date(att.check_in_time);
    const workingHours = +((now.getTime() - checkIn.getTime()) / (1000 * 60 * 60)).toFixed(2);

    await pool.query(
      `UPDATE attendance
       SET check_out_time = NOW(), check_out_lat = ?, check_out_lng = ?, check_out_photo = ?, working_hours = ?, notes = COALESCE(?, notes)
       WHERE id = ?`,
      [lat, lng, selfie_url || null, workingHours, notes || null, att.id]
    );

    res.json({
      success: true,
      data: { message: 'Checked out successfully.', working_hours: workingHours },
    });
  } catch (error) {
    console.error('Check out error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to check out.' } });
  }
};

/** POST /staff/leaves — Request leave */
export const requestLeave = async (req: Request, res: Response): Promise<void> => {
  try {
    const staffId = (req as any).staff?.id;
    const { start_date, end_date, reason } = req.body;

    if (!start_date || !end_date || !reason) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'start_date, end_date, and reason are required.' } });
      return;
    }

    await pool.query(
      `INSERT INTO leave_requests (staff_id, start_date, end_date, reason, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [staffId, start_date, end_date, reason]
    );

    res.status(201).json({ success: true, data: { message: 'Leave request submitted successfully.' } });
  } catch (error) {
    console.error('Request leave error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to submit leave request.' } });
  }
};

/** PATCH /staff/leaves/:id — Approve or reject leave */
export const approveLeave = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const approvedBy = (req as any).staff?.id;

    if (!status || !['approved', 'rejected'].includes(status)) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'status must be either approved or rejected.' } });
      return;
    }

    const [leave] = await pool.query<RowDataPacket[]>('SELECT * FROM leave_requests WHERE id = ?', [id]);
    if (leave.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Leave request not found.' } });
      return;
    }

    await pool.query(
      'UPDATE leave_requests SET status = ?, approved_by = ?, notes = ? WHERE id = ?',
      [status, approvedBy, notes || null, id]
    );

    if (status === 'approved') {
      const lr = leave[0];
      const start = new Date(lr.start_date);
      const end = new Date(lr.end_date);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const formattedDate = d.toISOString().split('T')[0];
        await pool.query(
          `INSERT INTO attendance (staff_id, date, status, notes)
           VALUES (?, ?, 'leave', 'Approved leave request')
           ON DUPLICATE KEY UPDATE status = 'leave', notes = 'Approved leave request'`,
          [lr.staff_id, formattedDate]
        );
      }
    }

    res.json({ success: true, data: { message: `Leave request successfully ${status}.` } });
  } catch (error) {
    console.error('Approve leave error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to update leave request.' } });
  }
};

/** GET /staff/leaves — List all leaves */
export const getLeaves = async (req: Request, res: Response): Promise<void> => {
  try {
    const { staff_id, status } = req.query as any;
    const conds: string[] = ['1=1'];
    const params: any[] = [];

    if (staff_id) { conds.push('lr.staff_id = ?'); params.push(staff_id); }
    if (status) { conds.push('lr.status = ?'); params.push(status); }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT lr.*, s.full_name as staff_name, s.role, ap.full_name as approved_by_name
       FROM leave_requests lr
       JOIN staff s ON lr.staff_id = s.id
       LEFT JOIN staff ap ON lr.approved_by = ap.id
       WHERE ${conds.join(' AND ')}
       ORDER BY lr.created_at DESC`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get leaves error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch leaves.' } });
  }
};

/** GET /staff/:id/performance — Calculate staff performance metrics */
export const getStaffPerformance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const [staff] = await pool.query<RowDataPacket[]>(
      'SELECT id, full_name, role FROM staff WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (staff.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Staff member not found.' } });
      return;
    }

    const [stats] = await pool.query<RowDataPacket[]>(
      `SELECT
         COUNT(*) as total_jobs,
         COALESCE(SUM(total_amount), 0) as total_revenue,
         COALESCE(SUM(CASE WHEN qc_passed = 1 THEN 1 ELSE 0 END), 0) as qc_passes
       FROM job_cards
       WHERE status = 'delivered'
         AND JSON_CONTAINS(assigned_staff, CAST(? as JSON))
         AND deleted_at IS NULL`,
      [id]
    );

    const s = stats[0];
    const totalJobs = Number(s.total_jobs);
    const qcPassRate = totalJobs > 0 ? (Number(s.qc_passes) / totalJobs) * 100 : 100;

    res.json({
      success: true,
      data: {
        staff_id: id,
        full_name: staff[0].full_name,
        role: staff[0].role,
        metrics: {
          jobs_completed: totalJobs,
          revenue_generated: Number(s.total_revenue),
          qc_pass_rate: +qcPassRate.toFixed(1),
          qc_passes: Number(s.qc_passes)
        }
      }
    });
  } catch (error) {
    console.error('Get staff performance error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch performance metrics.' } });
  }
};

/** GET /staff/attendance/report — Attendance report per month */
export const getAttendanceReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { month } = req.query as any;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'month in YYYY-MM format is required.' } });
      return;
    }

    const [staff] = await pool.query<RowDataPacket[]>(
      'SELECT id, full_name, role FROM staff WHERE deleted_at IS NULL AND status = "active"'
    );

    const [attendance] = await pool.query<RowDataPacket[]>(
      `SELECT staff_id, date, status, check_in_time, check_out_time, is_late, working_hours
       FROM attendance
       WHERE DATE_FORMAT(date, '%Y-%m') = ?`,
      [month]
    );

    res.json({
      success: true,
      data: {
        month,
        staff,
        attendance
      }
    });
  } catch (error) {
    console.error('Get attendance report error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch attendance report.' } });
  }
};

/** GET /staff/attendance/history — Full attendance logs history */
export const getAttendanceHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date_from, date_to, staff_id, search } = req.query as any;
    const conds: string[] = ['1=1'];
    const params: any[] = [];

    if (date_from) {
      conds.push('a.date >= ?');
      params.push(date_from);
    }
    if (date_to) {
      conds.push('a.date <= ?');
      params.push(date_to);
    }
    if (staff_id) {
      conds.push('a.staff_id = ?');
      params.push(Number(staff_id));
    }
    if (search) {
      conds.push('(s.full_name LIKE ? OR s.staff_code LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term);
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT a.id, a.staff_id, a.date, a.check_in_time, a.check_out_time, a.status, a.working_hours, a.notes,
              s.full_name as staff_name, s.staff_code, s.role
       FROM attendance a
       JOIN staff s ON a.staff_id = s.id
       WHERE ${conds.join(' AND ')}
       ORDER BY a.date DESC, s.full_name ASC`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get attendance history error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch attendance history.' } });
  }
};

/** GET /staff/:id/advances — Get advances for a staff member */
export const getStaffAdvances = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, staff_id, amount, notes, advance_date, status, deducted_at, created_at
       FROM staff_advances WHERE staff_id = ? ORDER BY advance_date DESC`,
      [Number(id)]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get staff advances error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch advance records.' } });
  }
};

/** POST /staff/advances — Record new staff advance */
export const createStaffAdvance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { staff_id, amount, notes, advance_date } = req.body;
    if (!staff_id || !amount) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Staff ID and amount are required.' } });
      return;
    }

    const dateVal = advance_date || new Date().toISOString().slice(0, 19).replace('T', ' ');

    await pool.query(
      `INSERT INTO staff_advances (staff_id, amount, notes, advance_date, status)
       VALUES (?, ?, ?, ?, 'unpaid')`,
      [Number(staff_id), Number(amount), notes || null, dateVal]
    );

    res.status(201).json({ success: true, data: { message: 'Advance payment recorded successfully.' } });
  } catch (error) {
    console.error('Create staff advance error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to record advance payment.' } });
  }
};

/** PATCH /staff/advances/:id/settle — Mark advance as settled */
export const settleStaffAdvance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status = 'deducted' } = req.body;

    const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM staff_advances WHERE id = ?', [Number(id)]);
    if (existing.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Advance record not found.' } });
      return;
    }

    const deductedAt = status === 'deducted' ? new Date() : null;

    await pool.query(
      `UPDATE staff_advances SET status = ?, deducted_at = ? WHERE id = ?`,
      [status, deductedAt, Number(id)]
    );

    res.json({ success: true, data: { message: `Advance payment marked as ${status}.` } });
  } catch (error) {
    console.error('Settle staff advance error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to settle advance payment.' } });
  }
};

// Helper to save base64 image from kiosk camera
const saveBase64Image = (base64Data: string, staffId: number, prefix: string): string => {
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid base64 image data');
  }

  const mimeType = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');

  let extension = 'jpg';
  if (mimeType === 'image/png') extension = 'png';
  else if (mimeType === 'image/webp') extension = 'webp';

  const dirPath = path.resolve(__dirname, '../../../uploads/attendance');
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const filename = `${prefix}_${staffId}_${Date.now()}.${extension}`;
  const filePath = path.join(dirPath, filename);
  fs.writeFileSync(filePath, buffer);

  return `/uploads/attendance/${filename}`;
};

// Timezone-independent IST helper functions
const getISTDateTime = (): string => {
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istDate = new Date(utcTime + 19800000); // UTC + 5.5 hours
  const yyyy = istDate.getFullYear();
  const mm = String(istDate.getMonth() + 1).padStart(2, '0');
  const dd = String(istDate.getDate()).padStart(2, '0');
  const hh = String(istDate.getHours()).padStart(2, '0');
  const min = String(istDate.getMinutes()).padStart(2, '0');
  const ss = String(istDate.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
};

const getISTDate = (): string => {
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istDate = new Date(utcTime + 19800000); // UTC + 5.5 hours
  const yyyy = istDate.getFullYear();
  const mm = String(istDate.getMonth() + 1).padStart(2, '0');
  const dd = String(istDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/** POST /staff/kiosk-attendance — Check-in/out with photo capture */
export const kioskAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { staff_id, type, photo } = req.body;

    if (!staff_id || !type || !photo) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'staff_id, type (check-in/check-out), and photo (base64) are required.' } });
      return;
    }

    const today = getISTDate();

    // Check if staff member exists and is active
    const [staffRows] = await pool.query<RowDataPacket[]>(
      'SELECT id, full_name, status FROM staff WHERE id = ? AND deleted_at IS NULL',
      [staff_id]
    );
    if (staffRows.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Staff member not found.' } });
      return;
    }
    if (staffRows[0].status !== 'active') {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Staff member is not active.' } });
      return;
    }

    const staffName = staffRows[0].full_name;

    // Save base64 photo to file
    let photoUrl: string;
    try {
      photoUrl = saveBase64Image(photo, staff_id, type);
    } catch (e: any) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: e.message || 'Failed to process base64 photo.' } });
      return;
    }

    if (type === 'check-in') {
      const [existing] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM attendance WHERE staff_id = ? AND date = ?',
        [staff_id, today]
      );
      if (existing.length > 0) {
        res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Staff member already checked in today.' } });
        return;
      }

      const nowIST = new Date(new Date().getTime() + (new Date().getTimezoneOffset() * 60000) + 19800000);
      const cutoffHour = 9;
      const cutoffMinute = 30;
      let status = 'present';
      let isLate = 0;

      if (nowIST.getHours() > cutoffHour || (nowIST.getHours() === cutoffHour && nowIST.getMinutes() > cutoffMinute)) {
        status = 'late';
        isLate = 1;
      }

      const checkInTime = getISTDateTime();

      await pool.query(
        `INSERT INTO attendance (staff_id, date, check_in_time, check_in_photo, status, is_late, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [staff_id, today, checkInTime, photoUrl, status, isLate, 'Kiosk Check-In']
      );

      res.json({
        success: true,
        data: { message: `Checked in ${staffName} successfully.`, status, is_late: !!isLate },
      });
    } else if (type === 'check-out') {
      const [existing] = await pool.query<RowDataPacket[]>(
        'SELECT id, check_in_time, check_out_time FROM attendance WHERE staff_id = ? AND date = ?',
        [staff_id, today]
      );

      if (existing.length === 0) {
        res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No check-in record found for today.' } });
        return;
      }

      const att = existing[0];
      if (att.check_out_time) {
        res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Already checked out today.' } });
        return;
      }

      const checkIn = new Date(att.check_in_time.replace(' ', 'T') + '+05:30');
      const nowISTTime = new Date().getTime() + (new Date().getTimezoneOffset() * 60000) + 19800000;
      const workingHours = +((nowISTTime - checkIn.getTime()) / (1000 * 60 * 60)).toFixed(2);
      const checkOutTime = getISTDateTime();

      await pool.query(
        `UPDATE attendance
         SET check_out_time = ?, check_out_photo = ?, working_hours = ?, notes = COALESCE(notes, 'Kiosk Check-Out')
         WHERE id = ?`,
        [checkOutTime, photoUrl, workingHours, att.id]
      );

      res.json({
        success: true,
        data: { message: `Checked out ${staffName} successfully.`, working_hours: workingHours },
      });
    } else {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid type. Use check-in or check-out.' } });
    }
  } catch (error) {
    console.error('Kiosk attendance error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to record kiosk attendance.' } });
  }
};

/** GET /staff/payment-requests — List all payment requests */
export const getPaymentRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { staff_id, status } = req.query;
    const conds = [];
    const params = [];
    
    if (staff_id) {
      conds.push('pr.staff_id = ?');
      params.push(Number(staff_id));
    }
    if (status) {
      conds.push('pr.status = ?');
      params.push(status);
    }
    
    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT pr.*, s.full_name as staff_name, s.role as staff_role, s.staff_code,
              app.full_name as approved_by_name
       FROM staff_payment_requests pr
       JOIN staff s ON pr.staff_id = s.id
       LEFT JOIN staff app ON pr.approved_by = app.id
       ${where}
       ORDER BY pr.created_at DESC`,
      params
    );
    
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get payment requests error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch payment requests.' } });
  }
};

/** POST /staff/payment-requests — Create new payment request */
export const createPaymentRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, request_type, reason, notes } = req.body;
    const staffId = req.staff?.id;
    
    if (!staffId) {
      res.status(401).json({ success: false, error: { code: ERROR_CODES.AUTH_REQUIRED, message: 'Unauthorized.' } });
      return;
    }
    
    if (!amount || !reason) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Amount and reason are required.' } });
      return;
    }
    
    await pool.query(
      `INSERT INTO staff_payment_requests (staff_id, amount, request_type, reason, notes, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [staffId, Number(amount), request_type || 'advance', reason, notes || null]
    );
    
    res.status(201).json({ success: true, data: { message: 'Payment request submitted successfully.' } });
  } catch (error) {
    console.error('Create payment request error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to submit payment request.' } });
  }
};

/** PATCH /staff/payment-requests/:id — Approve/Reject payment request (HR, Manager, Admin) */
export const approvePaymentRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const approvedBy = req.staff?.id;
    const userRole = req.staff?.role;
    
    if (!approvedBy || !['hr', 'manager', 'admin'].includes(userRole || '')) {
      res.status(403).json({ success: false, error: { code: ERROR_CODES.FORBIDDEN, message: 'Only HR, Manager, or Admin can approve payment requests.' } });
      return;
    }
    
    if (!['approved', 'rejected'].includes(status)) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Status must be approved or rejected.' } });
      return;
    }
    
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM staff_payment_requests WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Payment request not found.' } });
      return;
    }
    
    const request = existing[0];
    const conn = await pool.getConnection();
    
    try {
      await conn.beginTransaction();
      
      await conn.query(
        `UPDATE staff_payment_requests
         SET status = ?, approved_by = ?, notes = ?
         WHERE id = ?`,
         [status, approvedBy, notes || null, id]
      );
      
      if (status === 'approved' && request.request_type === 'advance') {
        await conn.query(
          `INSERT INTO staff_advances (staff_id, amount, notes, advance_date, status)
           VALUES (?, ?, ?, NOW(), 'unpaid')`,
          [request.staff_id, request.amount, `Approved Request: ${request.reason}`]
        );
      }
      
      await conn.commit();
      res.json({ success: true, data: { message: `Payment request successfully ${status}.` } });
    } catch (err: any) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Approve payment request error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to process payment request.' } });
  }
};
