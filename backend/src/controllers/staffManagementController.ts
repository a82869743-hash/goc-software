import { Request, Response } from 'express';
import pool from '../utils/db';
import { generateCode } from '../utils/codes';
import { ERROR_CODES } from '../utils/constants';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { logActivity } from '../utils/auditLogger';

// ─── LIST ALL STAFF ────────────────────────────────
export const listAllStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.id, s.staff_code, s.full_name, s.phone, s.email, s.role, s.status, s.salary_amount as salary, s.salary_type, s.created_at,
              sp.perm_dashboard, sp.perm_leads, sp.perm_customers, sp.perm_bookings, sp.perm_advance_bookings,
              sp.perm_job_cards, sp.perm_quick_jobs, sp.perm_quotations, sp.perm_invoices, sp.perm_payments,
              sp.perm_inventory, sp.perm_reports, sp.perm_marketing, sp.perm_commissions, sp.perm_settings, sp.perm_staff_management
       FROM staff s
       LEFT JOIN staff_permissions sp ON sp.staff_id = s.id
       WHERE s.deleted_at IS NULL
       ORDER BY s.id ASC`
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('List all staff error:', error);
    res.status(500).json({
      success: false,
      error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to retrieve staff list.' },
    });
  }
};

// ─── CREATE STAFF ──────────────────────────────────
export const createStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const { full_name, phone, email, role, salary, salary_type, password } = req.body;

    // Validation
    if (!full_name || !phone || !role || salary === undefined || !salary_type) {
      res.status(400).json({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'All required fields must be provided.' },
      });
      return;
    }

    if (password !== undefined && (typeof password !== 'string' || password.trim().length < 6)) {
      res.status(400).json({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Password must be at least 6 characters long.' },
      });
      return;
    }

    if (phone.length !== 10 || !/^\d{10}$/.test(phone)) {
      res.status(400).json({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Phone must be exactly 10 digits.' },
      });
      return;
    }

    const validRoles = ['manager', 'receptionist', 'technician', 'staff'];
    if (!validRoles.includes(role)) {
      res.status(400).json({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid role for registration.' },
      });
      return;
    }

    // Check unique phone
    const [dup] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM staff WHERE phone = ? AND deleted_at IS NULL',
      [phone]
    );
    if (dup.length > 0) {
      res.status(409).json({
        success: false,
        error: { code: ERROR_CODES.CONFLICT, message: 'Phone number already registered.' },
      });
      return;
    }

    // Generate staff code
    const staffCode = await generateCode('staff');

    // Determine plain password
    let plainPassword = password;
    if (!plainPassword || typeof plainPassword !== 'string' || plainPassword.trim() === '') {
      // Generate random alphanumeric password format GOC@XXXX
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let randomPart = '';
      for (let i = 0; i < 4; i++) {
        const idx = crypto.randomInt(chars.length);
        randomPart += chars[idx];
      }
      plainPassword = `GOC@${randomPart}`;
    } else {
      plainPassword = plainPassword.trim();
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    // Insert staff record
    const joinDate = new Date().toISOString().split('T')[0];
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO staff (staff_code, full_name, phone, email, role, salary_type, salary_amount, join_date, status, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [staffCode, full_name, phone, email || null, role, salary_type, Number(salary), joinDate, hashedPassword]
    );

    const staffId = result.insertId;

    // Insert default staff permissions (perm_dashboard = 1, all else 0)
    await pool.query(
      `INSERT INTO staff_permissions (staff_id, perm_dashboard) VALUES (?, 1)`,
      [staffId]
    );

    const actorId = (req as any).staff?.id || null;
    await logActivity(
      actorId,
      'create_staff',
      'staff',
      staffId,
      `Created staff member ${full_name} with role ${role} (Code: ${staffCode})`,
      req.ip,
      req.headers['user-agent']
    );

    res.status(201).json({
      success: true,
      data: {
        staff_code: staffCode,
        full_name,
        phone,
        role,
        plain_password: plainPassword,
      },
    });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({
      success: false,
      error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to create staff record.' },
    });
  }
};

// ─── UPDATE STAFF ──────────────────────────────────
export const updateStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { full_name, phone, email, role, salary, salary_type, status } = req.body;

    // Check staff existence
    const [staff] = await pool.query<RowDataPacket[]>(
      'SELECT id, role FROM staff WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (staff.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Staff member not found.' },
      });
      return;
    }

    // Protect the admin account
    if (staff[0].role === 'admin') {
      res.status(403).json({
        success: false,
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Protected admin account cannot be modified.' },
      });
      return;
    }

    if (role === 'admin') {
      res.status(400).json({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Cannot assign admin role.' },
      });
      return;
    }

    if (phone) {
      if (phone.length !== 10 || !/^\d{10}$/.test(phone)) {
        res.status(400).json({
          success: false,
          error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Phone must be exactly 10 digits.' },
        });
        return;
      }
      
      // Check unique phone duplicate
      const [dup] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM staff WHERE phone = ? AND id != ? AND deleted_at IS NULL',
        [phone, id]
      );
      if (dup.length > 0) {
        res.status(409).json({
          success: false,
          error: { code: ERROR_CODES.CONFLICT, message: 'Phone number already registered by another staff.' },
        });
        return;
      }
    }

    const fields: string[] = [];
    const vals: any[] = [];

    if (full_name !== undefined) { fields.push('full_name = ?'); vals.push(full_name); }
    if (phone !== undefined) { fields.push('phone = ?'); vals.push(phone); }
    if (email !== undefined) { fields.push('email = ?'); vals.push(email || null); }
    if (role !== undefined) { fields.push('role = ?'); vals.push(role); }
    if (salary !== undefined) { fields.push('salary_amount = ?'); vals.push(Number(salary)); }
    if (salary_type !== undefined) { fields.push('salary_type = ?'); vals.push(salary_type); }
    if (status !== undefined) { fields.push('status = ?'); vals.push(status); }

    if (fields.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No fields provided for update.' },
      });
      return;
    }

    vals.push(id);
    await pool.query(`UPDATE staff SET ${fields.join(', ')} WHERE id = ?`, vals);

    const [updated] = await pool.query<RowDataPacket[]>(
      `SELECT id, staff_code, full_name, phone, email, role, status, salary_amount as salary, salary_type, created_at
       FROM staff WHERE id = ?`,
      [id]
    );

    const actorId = (req as any).staff?.id || null;
    await logActivity(
      actorId,
      'update_staff',
      'staff',
      Number(id),
      `Updated staff member ${updated[0].full_name} (Code: ${updated[0].staff_code}) details: ${fields.map(f => f.split(' ')[0]).join(', ')}`,
      req.ip,
      req.headers['user-agent']
    );

    res.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({
      success: false,
      error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to update staff record.' },
    });
  }
};

// ─── RESET PASSWORD ────────────────────────────────
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    // Check staff existence
    const [staff] = await pool.query<RowDataPacket[]>(
      'SELECT id, role FROM staff WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (staff.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Staff member not found.' },
      });
      return;
    }

    // Protect the admin account
    if (staff[0].role === 'admin') {
      res.status(403).json({
        success: false,
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Protected admin account password cannot be reset.' },
      });
      return;
    }

    if (password !== undefined && (typeof password !== 'string' || password.trim().length < 6)) {
      res.status(400).json({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Password must be at least 6 characters long.' },
      });
      return;
    }

    // Determine plain password
    let plainPassword = password;
    if (!plainPassword || typeof plainPassword !== 'string' || plainPassword.trim() === '') {
      // Generate random alphanumeric password format GOC@XXXX
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let randomPart = '';
      for (let i = 0; i < 4; i++) {
        const idx = crypto.randomInt(chars.length);
        randomPart += chars[idx];
      }
      plainPassword = `GOC@${randomPart}`;
    } else {
      plainPassword = plainPassword.trim();
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    // Update DB — also bump token_version to invalidate all existing sessions
    await pool.query('UPDATE staff SET password_hash = ?, token_version = token_version + 1 WHERE id = ?', [hashedPassword, id]);

    const actorId = (req as any).staff?.id || null;
    await logActivity(
      actorId,
      'reset_staff_password',
      'staff',
      Number(id),
      `Reset password for staff member ${staff[0].full_name} and forced logout`,
      req.ip,
      req.headers['user-agent']
    );

    res.json({
      success: true,
      data: { new_password: plainPassword },
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to reset staff password.' },
    });
  }
};

// ─── TOGGLE STAFF STATUS ───────────────────────────
export const toggleStaffStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'inactive'].includes(status)) {
      res.status(400).json({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Valid status ("active" or "inactive") is required.' },
      });
      return;
    }

    // Check staff existence
    const [staff] = await pool.query<RowDataPacket[]>(
      'SELECT id, role FROM staff WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (staff.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Staff member not found.' },
      });
      return;
    }

    // Protect the admin account
    if (staff[0].role === 'admin') {
      res.status(403).json({
        success: false,
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Protected admin account status cannot be changed.' },
      });
      return;
    }

    await pool.query('UPDATE staff SET status = ? WHERE id = ?', [status, id]);

    const actorId = (req as any).staff?.id || null;
    await logActivity(
      actorId,
      'toggle_staff_status',
      'staff',
      Number(id),
      `Changed staff ${staff[0].full_name} status to ${status.toUpperCase()}`,
      req.ip,
      req.headers['user-agent']
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Toggle status error:', error);
    res.status(500).json({
      success: false,
      error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to toggle staff status.' },
    });
  }
};

// ─── DELETE STAFF ──────────────────────────────────
export const deleteStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check staff existence
    const [staff] = await pool.query<RowDataPacket[]>(
      'SELECT id, role, full_name, staff_code FROM staff WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (staff.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Staff member not found.' },
      });
      return;
    }

    const target = staff[0];

    // Protect the admin account
    if (target.role === 'admin') {
      res.status(403).json({
        success: false,
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Protected admin account cannot be deleted.' },
      });
      return;
    }

    // Soft delete, mark as resigned, and increment token_version to force logout immediately
    await pool.query(
      "UPDATE staff SET deleted_at = CURRENT_TIMESTAMP, status = 'resigned', token_version = token_version + 1 WHERE id = ?",
      [id]
    );

    // Log the activity
    const actorId = (req as any).staff?.id || null;
    await logActivity(
      actorId,
      'delete_staff',
      'staff',
      Number(id),
      `Deleted staff member ${target.full_name} (Code: ${target.staff_code}) and revoked access`,
      req.ip,
      req.headers['user-agent']
    );

    res.json({ success: true, message: 'Staff member deleted and logged out successfully.' });
  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({
      success: false,
      error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to delete staff member.' },
    });
  }
};
