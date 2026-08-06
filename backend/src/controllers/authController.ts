import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../utils/db';
import { signToken } from '../utils/jwt';
import { ERROR_CODES } from '../utils/constants';
import { RowDataPacket } from 'mysql2';
import { logActivity } from '../utils/auditLogger';

interface StaffRow extends RowDataPacket {
  id: number;
  staff_code: string;
  full_name: string;
  phone: string;
  email: string | null;
  profile_picture: string | null;
  role: 'admin' | 'manager' | 'salesman' | 'staff';
  status: string;
  password_hash: string;
  token_version: number;
}

/**
 * POST /auth/login
 * Authenticates staff by phone + password, returns JWT token
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, password } = req.body;

    // Find staff by phone
    const [rows] = await pool.query<StaffRow[]>(
      `SELECT id, staff_code, full_name, phone, email, profile_picture, role, status, password_hash, token_version 
       FROM staff 
       WHERE phone = ? AND deleted_at IS NULL`,
      [phone]
    );

    if (rows.length === 0) {
      await logActivity(
        null,
        'login_failed',
        'staff',
        null,
        `Failed login attempt: phone number ${phone} not registered.`,
        req.ip,
        req.headers['user-agent']
      );
      res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_INVALID,
          message: 'Invalid phone number or password.',
        },
      });
      return;
    }

    const staff = rows[0];

    // Check if staff is active
    if (staff.status !== 'active') {
      res.status(403).json({
        success: false,
        error: {
          code: ERROR_CODES.FORBIDDEN,
          message: 'Your account is currently inactive. Please contact the owner.',
        },
      });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, staff.password_hash);
    if (!isValidPassword) {
      await logActivity(
        null,
        'login_failed',
        'staff',
        staff.id,
        `Failed login attempt for registered staff ${staff.full_name} (phone: ${phone}): invalid password.`,
        req.ip,
        req.headers['user-agent']
      );
      res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_INVALID,
          message: 'Invalid phone number or password.',
        },
      });
      return;
    }

    // Generate JWT token
    const token = signToken({
      id: staff.id,
      staff_code: staff.staff_code,
      role: staff.role,
      full_name: staff.full_name,
      token_version: staff.token_version ?? 1,
    });

    await logActivity(
      staff.id,
      'login',
      'staff',
      staff.id,
      `Staff member ${staff.full_name} logged in successfully`,
      req.ip,
      req.headers['user-agent']
    );

    res.json({
      success: true,
      data: {
        token,
        staff: {
          id: staff.id,
          staff_code: staff.staff_code,
          full_name: staff.full_name,
          role: staff.role,
          phone: staff.phone,
          email: staff.email,
          profile_picture: staff.profile_picture || null,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: ERROR_CODES.SERVER_ERROR,
        message: 'An error occurred during login.',
      },
    });
  }
};

/**
 * POST /auth/logout
 * Logs out the current user (client-side token removal)
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  // DECISION: Server-side token blacklisting not implemented in v2.0
  // Client is responsible for removing the token from storage
  if (req.staff) {
    await logActivity(
      req.staff.id,
      'logout',
      'staff',
      req.staff.id,
      `Staff member ${req.staff.full_name} logged out`,
      req.ip,
      req.headers['user-agent']
    );
  }
  
  res.json({
    success: true,
    data: { message: 'Logged out successfully.' },
  });
};

/**
 * GET /auth/me
 * Returns the current staff profile from the JWT token
 */
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.staff) {
      res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_REQUIRED,
          message: 'Authentication required.',
        },
      });
      return;
    }

    // Fetch fresh data from DB
    const [rows] = await pool.query<StaffRow[]>(
      `SELECT id, staff_code, full_name, phone, email, profile_picture, role, status, salary_type, join_date
       FROM staff 
       WHERE id = ? AND deleted_at IS NULL`,
      [req.staff.id]
    );

    if (rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: ERROR_CODES.NOT_FOUND,
          message: 'Staff account not found.',
        },
      });
      return;
    }

    const staff = rows[0];
    res.json({
      success: true,
      data: {
        id: staff.id,
        staff_code: staff.staff_code,
        full_name: staff.full_name,
        phone: staff.phone,
        email: staff.email,
        profile_picture: staff.profile_picture || null,
        role: staff.role,
        status: staff.status,
      },
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: ERROR_CODES.SERVER_ERROR,
        message: 'An error occurred while fetching profile.',
      },
    });
  }
};
