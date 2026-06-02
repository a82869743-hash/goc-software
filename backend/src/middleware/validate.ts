import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ERROR_CODES } from '../utils/constants';

/**
 * Zod Validation Middleware Factory
 * Validates request body against a Zod schema
 * Usage: validate(createLeadSchema)
 */
export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.body);
      req.body = parsed; // Replace body with parsed (coerced/transformed) data
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        res.status(422).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Validation failed. Check the details for specific field errors.',
            details: fieldErrors,
          },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.SERVER_ERROR,
          message: 'An unexpected error occurred during validation.',
        },
      });
    }
  };
};

/**
 * Validates query parameters against a Zod schema
 */
export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.query);
      req.query = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        res.status(422).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Invalid query parameters.',
            details: fieldErrors,
          },
        });
        return;
      }

      next(error);
    }
  };
};
