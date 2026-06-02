import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../utils/jwt';
import { ERROR_CODES } from '../utils/constants';

// Extend Express Request to include staff info
declare global {
  namespace Express {
    interface Request {
      staff?: JWTPayload;
    }
  }
}

/**
 * JWT Authentication Middleware
 * Verifies Bearer token and attaches staff info to request
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
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
