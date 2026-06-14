import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../utils/jwt';
import { ERROR_CODES } from '../utils/constants';
import pool from '../utils/db';
import { RowDataPacket } from 'mysql2';

// Extend Express Request to include staff info
declare global {
  namespace Express {
    interface Request {
      staff?: JWTPayload;
    }
  }
}

interface StaffVersionRow extends RowDataPacket {
  token_version: number;
  status: string;
}

/**
 * JWT Authentication Middleware
 * Verifies Bearer token, validates token_version against DB,
 * and attaches staff info to request.
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_REQUIRED,
          message: 'Authentication required. Please provide a valid token.',
        },
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_REQUIRED,
          message: 'Authentication token is missing.',
        },
      });
      return;
    }

    const decoded = verifyToken(token);

    // Validate token_version against DB to enforce session invalidation
    if (decoded.token_version !== undefined) {
      const [rows] = await pool.query<StaffVersionRow[]>(
        'SELECT token_version, status FROM staff WHERE id = ? AND deleted_at IS NULL',
        [decoded.id]
      );

      if (rows.length === 0) {
        res.status(401).json({
          success: false,
          error: {
            code: ERROR_CODES.AUTH_INVALID,
            message: 'Account not found or has been removed.',
          },
        });
        return;
      }

      const dbStaff = rows[0];

      // Check if account is still active
      if (dbStaff.status !== 'active') {
        res.status(403).json({
          success: false,
          error: {
            code: ERROR_CODES.FORBIDDEN,
            message: 'Your account is currently inactive. Please contact the administrator.',
          },
        });
        return;
      }

      // Token version mismatch means password was changed — force re-login
      if (dbStaff.token_version !== decoded.token_version) {
        res.status(401).json({
          success: false,
          error: {
            code: ERROR_CODES.AUTH_INVALID,
            message: 'Your session has been invalidated. Please log in again with your new credentials.',
          },
        });
        return;
      }
    }

    req.staff = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        code: ERROR_CODES.AUTH_INVALID,
        message: 'Invalid or expired authentication token.',
      },
    });
  }
};
