import { Request, Response } from 'express';
import pool from '../utils/db';
import { ERROR_CODES } from '../utils/constants';
import { RowDataPacket } from 'mysql2';

// ─── GET STAFF PERMISSIONS (ADMIN ONLY) ───────────
export const getPermissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if staff exists
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

    // Retrieve or insert default permissions
    let [perms] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM staff_permissions WHERE staff_id = ?',
      [id]
    );

    if (perms.length === 0) {
      await pool.query(
        'INSERT INTO staff_permissions (staff_id, perm_dashboard) VALUES (?, 1)',
        [id]
      );
      [perms] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM staff_permissions WHERE staff_id = ?',
        [id]
      );
    }

    res.json({ success: true, data: perms[0] });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({
      success: false,
      error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to retrieve permissions.' },
    });
  }
};

// ─── UPDATE STAFF PERMISSIONS (ADMIN ONLY) ────────
export const updatePermissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const body = req.body;

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

    // Admin always has full access
    if (staff[0].role === 'admin') {
      res.status(403).json({
        success: false,
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Permissions for admin account cannot be modified.' },
      });
      return;
    }

    const permKeys = [
      'perm_dashboard', 'perm_leads', 'perm_customers', 'perm_bookings', 'perm_advance_bookings',
      'perm_job_cards', 'perm_quick_jobs', 'perm_quotations', 'perm_invoices', 'perm_payments',
      'perm_inventory', 'perm_reports', 'perm_marketing', 'perm_commissions', 'perm_settings',
      'perm_staff_management',
      'perm_job_cards_edit', 'perm_job_cards_delete', 'perm_job_cards_complete',
      'perm_invoices_create', 'perm_payments_record',
      'perm_leads_delete', 'perm_leads_assign',
      'perm_customers_delete', 'perm_inventory_edit',
      'perm_reports_revenue', 'perm_reports_accounts', 'perm_reports_salary',
      'perm_delete_all'
    ];

    const updateFields: string[] = [];
    const insertFields: string[] = ['staff_id'];
    const insertPlaceholders: string[] = ['?'];
    const insertVals: any[] = [id];

    for (const key of permKeys) {
      if (body[key] !== undefined) {
        const val = body[key] === 1 || body[key] === true ? 1 : 0;
        insertFields.push(`\`${key}\``);
        insertPlaceholders.push('?');
        insertVals.push(val);
        updateFields.push(`\`${key}\` = VALUES(\`${key}\`)`);
      }
    }

    if (updateFields.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No permission values provided.' },
      });
      return;
    }

    const sql = `
      INSERT INTO staff_permissions (${insertFields.join(', ')})
      VALUES (${insertPlaceholders.join(', ')})
      ON DUPLICATE KEY UPDATE ${updateFields.join(', ')}
    `;
    await pool.query(sql, insertVals);

    const [perms] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM staff_permissions WHERE staff_id = ?',
      [id]
    );

    res.json({ success: true, data: perms[0] });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({
      success: false,
      error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to update permissions.' },
    });
  }
};

// ─── GET MY PERMISSIONS (ANY LOGGED-IN STAFF) ─────
export const getMyPermissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const staffId = req.staff?.id;
    const staffRole = req.staff?.role;

    if (!staffId) {
      res.status(401).json({
        success: false,
        error: { code: ERROR_CODES.AUTH_REQUIRED, message: 'Authentication required.' },
      });
      return;
    }

    // Admin role bypasses DB checks and returns all permissions as 1
    if (staffRole === 'admin') {
      res.json({
        success: true,
        data: {
          _isAdmin: true,
          perm_dashboard: 1,
          perm_leads: 1,
          perm_customers: 1,
          perm_bookings: 1,
          perm_advance_bookings: 1,
          perm_job_cards: 1,
          perm_quick_jobs: 1,
          perm_quotations: 1,
          perm_invoices: 1,
          perm_payments: 1,
          perm_inventory: 1,
          perm_reports: 1,
          perm_marketing: 1,
          perm_commissions: 1,
          perm_settings: 1,
          perm_staff_management: 1,
          perm_job_cards_edit: 1,
          perm_job_cards_delete: 1,
          perm_job_cards_complete: 1,
          perm_invoices_create: 1,
          perm_payments_record: 1,
          perm_leads_delete: 1,
          perm_leads_assign: 1,
          perm_customers_delete: 1,
          perm_inventory_edit: 1,
          perm_reports_revenue: 1,
          perm_reports_accounts: 1,
          perm_reports_salary: 1,
          perm_delete_all: 1
        }
      });
      return;
    }

    // Retrieve or insert default permissions for staff
    let [perms] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM staff_permissions WHERE staff_id = ?',
      [staffId]
    );

    if (perms.length === 0) {
      await pool.query(
        'INSERT INTO staff_permissions (staff_id, perm_dashboard) VALUES (?, 1)',
        [staffId]
      );
      [perms] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM staff_permissions WHERE staff_id = ?',
        [staffId]
      );
    }

    res.json({ success: true, data: perms[0] });
  } catch (error) {
    console.error('Get my permissions error:', error);
    res.status(500).json({
      success: false,
      error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to retrieve your permissions.' },
    });
  }
};
