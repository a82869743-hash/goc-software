import { Request, Response, NextFunction } from 'express';
import { ERROR_CODES, STAFF_ROLES } from '../utils/constants';

type StaffRole = typeof STAFF_ROLES[number];

/**
 * Role-Based Access Control Middleware Factory
 * Usage: rbac('admin', 'manager') — only admin and manager can access
 */
export const rbac = (...allowedRoles: StaffRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
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

    if (!allowedRoles.includes(req.staff.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: ERROR_CODES.FORBIDDEN,
          message: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.staff.role}`,
        },
      });
      return;
    }

    next();
  };
};
