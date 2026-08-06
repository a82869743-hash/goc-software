import { Request, Response } from 'express';
import pool from '../utils/db';
import { ERROR_CODES } from '../utils/constants';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/**
 * Recycle Bin Controller
 * Manages soft-deleted records across all tables.
 */

const ALLOWED_TYPES: Record<string, { table: string; label: string; codeCol: string; nameCol: string }> = {
  customers: { table: 'customers', label: 'Customer', codeCol: 'customer_code', nameCol: 'full_name' },
  job_cards: { table: 'job_cards', label: 'Job Card', codeCol: 'job_code', nameCol: 'job_code' },
  quotations: { table: 'quotations', label: 'Quotation', codeCol: 'quotation_code', nameCol: 'quotation_code' },
  invoices: { table: 'invoices', label: 'Invoice', codeCol: 'invoice_code', nameCol: 'invoice_code' },
  leads: { table: 'leads', label: 'Lead', codeCol: 'lead_code', nameCol: 'full_name' },
};

/** GET /recycle-bin — List all soft-deleted records */
export const getDeletedItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.query as any;
    const results: any[] = [];

    const typesToQuery = type && ALLOWED_TYPES[type] ? [type] : Object.keys(ALLOWED_TYPES);

    for (const key of typesToQuery) {
      const cfg = ALLOWED_TYPES[key];

      let query = '';
      if (key === 'customers') {
        query = `SELECT id, '${key}' as record_type, '${cfg.label}' as type_label, 
                 ${cfg.codeCol} as code, ${cfg.nameCol} as name, 
                 phone as extra_info, deleted_at 
                 FROM ${cfg.table} WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`;
      } else if (key === 'job_cards') {
        query = `SELECT j.id, '${key}' as record_type, '${cfg.label}' as type_label,
                 j.${cfg.codeCol} as code, j.${cfg.codeCol} as name,
                 CONCAT(c.full_name, ' - ', IFNULL(v.reg_number, '')) as extra_info, j.deleted_at
                 FROM ${cfg.table} j
                 LEFT JOIN customers c ON j.customer_id = c.id
                 LEFT JOIN vehicles v ON j.vehicle_id = v.id
                 WHERE j.deleted_at IS NOT NULL ORDER BY j.deleted_at DESC`;
      } else if (key === 'quotations') {
        query = `SELECT q.id, '${key}' as record_type, '${cfg.label}' as type_label,
                 q.${cfg.codeCol} as code, q.${cfg.codeCol} as name,
                 CONCAT(c.full_name, ' - ₹', q.grand_total) as extra_info, q.deleted_at
                 FROM ${cfg.table} q
                 LEFT JOIN customers c ON q.customer_id = c.id
                 WHERE q.deleted_at IS NOT NULL ORDER BY q.deleted_at DESC`;
      } else if (key === 'invoices') {
        query = `SELECT i.id, '${key}' as record_type, '${cfg.label}' as type_label,
                 i.${cfg.codeCol} as code, i.${cfg.codeCol} as name,
                 CONCAT(c.full_name, ' - ₹', i.total_amount) as extra_info, i.deleted_at
                 FROM ${cfg.table} i
                 LEFT JOIN customers c ON i.customer_id = c.id
                 WHERE i.deleted_at IS NOT NULL ORDER BY i.deleted_at DESC`;
      } else if (key === 'leads') {
        query = `SELECT id, '${key}' as record_type, '${cfg.label}' as type_label,
                 ${cfg.codeCol} as code, ${cfg.nameCol} as name,
                 phone as extra_info, deleted_at
                 FROM ${cfg.table} WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`;
      }

      if (query) {
        const [rows] = await pool.query<RowDataPacket[]>(query);
        results.push(...rows);
      }
    }

    // Sort all results by deleted_at descending
    results.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());

    res.json({ success: true, data: results, meta: { total: results.length } });
  } catch (error) {
    console.error('Get recycle bin error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch deleted items.' } });
  }
};

/** POST /recycle-bin/:type/:id/restore — Restore a soft-deleted record */
export const restoreItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, id } = req.params;

    if (!ALLOWED_TYPES[type]) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: `Invalid type: ${type}` } });
      return;
    }

    const cfg = ALLOWED_TYPES[type];

    // Verify it's actually deleted
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM ${cfg.table} WHERE id = ? AND deleted_at IS NOT NULL`, [id]
    );
    if (existing.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: `${cfg.label} not found in recycle bin.` } });
      return;
    }

    if (type === 'staff') {
      const [staffRow] = await pool.query<RowDataPacket[]>(
        `SELECT id, phone, email, staff_code FROM staff WHERE id = ?`, [id]
      );
      if (staffRow.length > 0) {
        const origPhone = staffRow[0].phone.replace(new RegExp(`_del_${id}$`), '');
        // Check if phone is in use by an active staff
        const [activeDup] = await pool.query<RowDataPacket[]>(
          `SELECT id FROM staff WHERE phone = ? AND deleted_at IS NULL AND id != ?`, [origPhone, id]
        );
        if (activeDup.length > 0) {
          res.status(409).json({
            success: false,
            error: { code: ERROR_CODES.CONFLICT, message: 'Cannot restore: phone number is currently assigned to another active staff member.' },
          });
          return;
        }

        const origEmail = staffRow[0].email ? staffRow[0].email.replace(new RegExp(`_del_${id}$`), '') : null;
        const origCode = staffRow[0].staff_code.replace(new RegExp(`_del_${id}$`), '');

        await pool.query(
          `UPDATE staff 
           SET deleted_at = NULL, 
               status = 'active', 
               phone = ?, 
               email = ?, 
               staff_code = ? 
           WHERE id = ?`,
          [origPhone, origEmail, origCode, id]
        );
      }
    } else {
      await pool.query(`UPDATE ${cfg.table} SET deleted_at = NULL WHERE id = ?`, [id]);
    }

    res.json({ success: true, data: { message: `${cfg.label} restored successfully.` } });
  } catch (error) {
    console.error('Restore item error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to restore item.' } });
  }
};

/** DELETE /recycle-bin/:type/:id — Permanently delete */
export const permanentlyDeleteItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, id } = req.params;

    if (!ALLOWED_TYPES[type]) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: `Invalid type: ${type}` } });
      return;
    }

    const cfg = ALLOWED_TYPES[type];

    // Verify it's actually deleted
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM ${cfg.table} WHERE id = ? AND deleted_at IS NOT NULL`, [id]
    );
    if (existing.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: `${cfg.label} not found in recycle bin.` } });
      return;
    }

    await pool.query(`DELETE FROM ${cfg.table} WHERE id = ?`, [id]);

    res.json({ success: true, data: { message: `${cfg.label} permanently deleted.` } });
  } catch (error: any) {
    // Foreign key constraint errors
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      res.status(409).json({ success: false, error: { code: ERROR_CODES.CONFLICT, message: 'Cannot permanently delete: this record is referenced by other data. Try restoring it instead.' } });
      return;
    }
    console.error('Permanent delete error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to permanently delete item.' } });
  }
};
