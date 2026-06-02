import { Request, Response } from 'express';
import pool from '../utils/db';
import { ERROR_CODES } from '../utils/constants';
import { RowDataPacket } from 'mysql2';

/**
 * Revenue Report — daily/monthly with date range
 */
export const getRevenueReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date_from, date_to, group_by = 'day' } = req.query as any;
    const from = date_from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const to = date_to || new Date().toISOString().split('T')[0];

    const dateFormat = group_by === 'month' ? '%Y-%m' : '%Y-%m-%d';

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(p.payment_date, '${dateFormat}') as period,
              COUNT(*) as payment_count,
              COALESCE(SUM(p.amount), 0) as total_collected,
              GROUP_CONCAT(DISTINCT p.payment_mode) as modes
       FROM payments p
       WHERE DATE(p.payment_date) BETWEEN ? AND ?
       GROUP BY period ORDER BY period ASC`,
      [from, to]
    );

    // Summary
    const [summary] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(amount), 0) as total_revenue,
              COUNT(*) as total_payments,
              COUNT(DISTINCT customer_id) as unique_customers
       FROM payments WHERE DATE(payment_date) BETWEEN ? AND ?`,
      [from, to]
    );

    res.json({ success: true, data: { rows, summary: summary[0] } });
  } catch (error) { console.error('Revenue report error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

/**
 * Monthly Revenue Breakdown — last 12 months
 */
export const getMonthlyRevenue = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(payment_date, '%Y-%m') as month,
              COALESCE(SUM(amount), 0) as revenue,
              COUNT(*) as payment_count
       FROM payments WHERE payment_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY month ORDER BY month ASC`);
    res.json({ success: true, data: rows });
  } catch (error) { console.error('Monthly revenue error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

/**
 * Service Type Breakdown — revenue by service type
 */
export const getServiceBreakdown = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT js.service_type, COUNT(*) as count, COALESCE(SUM(js.line_total), 0) as revenue
       FROM job_services js INNER JOIN job_cards j ON js.job_card_id = j.id
       WHERE j.deleted_at IS NULL
       GROUP BY js.service_type ORDER BY revenue DESC`);
    res.json({ success: true, data: rows });
  } catch (error) { console.error('Service breakdown error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

/**
 * Lead Conversion Funnel — count by status
 */
export const getLeadFunnel = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT status, COUNT(*) as count FROM leads WHERE deleted_at IS NULL GROUP BY status
       ORDER BY FIELD(status, 'new','contacted','interested','quotation_sent','booked','lost')`);

    const [sources] = await pool.query<RowDataPacket[]>(
      `SELECT source, COUNT(*) as count FROM leads WHERE deleted_at IS NULL GROUP BY source ORDER BY count DESC`);

    const [convQ] = await pool.query<RowDataPacket[]>(
      `SELECT
         (SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL) as total,
         (SELECT COUNT(*) FROM leads WHERE status = 'booked' AND deleted_at IS NULL) as converted`);
    const convRate = convQ[0].total > 0 ? ((convQ[0].converted / convQ[0].total) * 100).toFixed(1) : '0';

    res.json({ success: true, data: { funnel: rows, sources, conversion_rate: convRate } });
  } catch (error) { console.error('Lead funnel error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

/**
 * Job Status Distribution
 */
export const getJobStatusDistribution = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT status, COUNT(*) as count FROM job_cards WHERE deleted_at IS NULL GROUP BY status`);
    res.json({ success: true, data: rows });
  } catch (error) { console.error('Job status error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

/**
 * Staff Performance — jobs handled, revenue generated per staff
 */
export const getStaffPerformance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date_from, date_to } = req.query as any;
    const from = date_from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const to = date_to || new Date().toISOString().split('T')[0];

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.id, s.full_name, s.role, s.staff_code,
              (SELECT COUNT(*) FROM job_cards j WHERE JSON_CONTAINS(j.assigned_staff, CAST(s.id AS JSON)) AND j.status = 'delivered' AND j.deleted_at IS NULL AND DATE(j.date_out) BETWEEN ? AND ?) as jobs_completed,
              (SELECT COALESCE(SUM(j2.total_amount), 0) FROM job_cards j2 WHERE JSON_CONTAINS(j2.assigned_staff, CAST(s.id AS JSON)) AND j2.status = 'delivered' AND j2.deleted_at IS NULL AND DATE(j2.date_out) BETWEEN ? AND ?) as revenue_generated,
              (SELECT COUNT(*) FROM attendance a WHERE a.staff_id = s.id AND a.status IN ('present','late') AND a.date BETWEEN ? AND ?) as days_present,
              (SELECT COUNT(*) FROM attendance a2 WHERE a2.staff_id = s.id AND a2.status = 'late' AND a2.date BETWEEN ? AND ?) as late_count
       FROM staff s
       WHERE s.deleted_at IS NULL AND s.status = 'active'
       ORDER BY jobs_completed DESC`,
      [from, to, from, to, from, to, from, to]);
    res.json({ success: true, data: rows });
  } catch (error) { console.error('Staff perf error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

/**
 * Attendance Summary — by date range
 */
export const getAttendanceSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date_from, date_to } = req.query as any;
    const from = date_from || new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const to = date_to || new Date().toISOString().split('T')[0];

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT a.date,
              SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
              SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
              SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
              SUM(CASE WHEN a.status = 'half_day' THEN 1 ELSE 0 END) as half_day_count,
              SUM(CASE WHEN a.status = 'leave' THEN 1 ELSE 0 END) as leave_count
       FROM attendance a WHERE a.date BETWEEN ? AND ?
       GROUP BY a.date ORDER BY a.date DESC`,
      [from, to]);
    res.json({ success: true, data: rows });
  } catch (error) { console.error('Attendance summary error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

/**
 * Inventory Usage Report
 */
export const getInventoryReport = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [items] = await pool.query<RowDataPacket[]>(
      `SELECT i.*, 
              (CASE WHEN i.current_stock <= i.min_threshold THEN 1 ELSE 0 END) as is_low_stock
       FROM inventory_items i WHERE i.deleted_at IS NULL ORDER BY is_low_stock DESC, i.name ASC`
    );

    const [rolls] = await pool.query<RowDataPacket[]>(
      `SELECT r.*, i.name as item_name
       FROM ppf_rolls r LEFT JOIN inventory_items i ON r.inventory_item_id = i.id
       WHERE r.status != 'exhausted' ORDER BY r.balance_sqft ASC`
    );

    res.json({ success: true, data: { items, rolls } });
  } catch (error) { console.error('Inventory report error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

/**
 * Commission Report
 */
export const getCommissionReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date_from, date_to, status } = req.query as any;
    const conds: string[] = [];
    const params: any[] = [];
    if (date_from) { conds.push('DATE(cc.created_at) >= ?'); params.push(date_from); }
    if (date_to) { conds.push('DATE(cc.created_at) <= ?'); params.push(date_to); }
    if (status) { conds.push('cc.status = ?'); params.push(status); }
    const where = conds.length > 0 ? 'AND ' + conds.join(' AND ') : '';

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT cc.*, con.full_name as connector_name, con.phone as connector_phone,
              c.full_name as customer_name, j.job_code
       FROM connector_commissions cc
       LEFT JOIN connectors con ON cc.connector_id = con.id
       LEFT JOIN customers c ON cc.customer_id = c.id
       LEFT JOIN job_cards j ON cc.job_card_id = j.id
       WHERE 1=1 ${where}
       ORDER BY cc.created_at DESC`, params
    );

    const [summary] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(commission_amount), 0) as total_commission,
              SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END) as pending_amount,
              SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END) as paid_amount,
              COUNT(*) as total_entries
       FROM connector_commissions WHERE 1=1 ${where}`, params
    );

    res.json({ success: true, data: { rows, summary: summary[0] } });
  } catch (error) { console.error('Commission report error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

/**
 * GST Report
 */
export const getGSTReport = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({ success: true, data: [] });
  } catch (error) { console.error('GST report error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

/**
 * Detailed Job Cards List Report
 */
export const getJobCardsReportDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date_from, date_to, status, search } = req.query as any;
    const conds: string[] = [];
    const params: any[] = [];

    if (date_from) { conds.push('DATE(j.created_at) >= ?'); params.push(date_from); }
    if (date_to) { conds.push('DATE(j.created_at) <= ?'); params.push(date_to); }
    if (status) { conds.push('j.status = ?'); params.push(status); }
    if (search) {
      conds.push('(j.job_code LIKE ? OR c.full_name LIKE ? OR c.phone LIKE ? OR v.reg_number LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    const where = conds.length > 0 ? 'AND ' + conds.join(' AND ') : '';

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT j.id, j.job_code, j.status, j.job_type, j.date_in, j.date_out, j.created_at,
              j.total_amount, j.amount_paid, j.balance_due, j.completion_type,
              c.full_name as customer_name, c.phone as customer_phone,
              v.make as vehicle_make, v.model as vehicle_model, v.reg_number
       FROM job_cards j
       LEFT JOIN customers c ON j.customer_id = c.id
       LEFT JOIN vehicles v ON j.vehicle_id = v.id
       WHERE j.deleted_at IS NULL ${where}
       ORDER BY j.created_at DESC`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Job cards detail report error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch job card details.' } });
  }
};

/**
 * Staff Salary & Attendance Summary Report
 */
export const getStaffSalaryReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date_from, date_to } = req.query as any;
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const from = date_from || defaultFrom;
    const to = date_to || defaultTo;

    const [staffRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, staff_code, full_name, role, salary_type, salary_amount, status
       FROM staff
       WHERE deleted_at IS NULL`
    );

    const data = [];
    for (const staff of staffRows) {
      const [attRows] = await pool.query<RowDataPacket[]>(
        `SELECT status, COUNT(*) as count
         FROM attendance
         WHERE staff_id = ? AND date BETWEEN ? AND ?
         GROUP BY status`,
        [staff.id, from, to]
      );

      const tallies = { present: 0, late: 0, absent: 0, half_day: 0, leave: 0 };
      for (const att of attRows) {
        if (att.status === 'present') tallies.present = att.count;
        else if (att.status === 'late') tallies.late = att.count;
        else if (att.status === 'absent') tallies.absent = att.count;
        else if (att.status === 'half_day') tallies.half_day = att.count;
        else if (att.status === 'leave') tallies.leave = att.count;
      }

      const rate = Number(staff.salary_amount);
      const workingDays = tallies.present + tallies.late;
      const halfDays = tallies.half_day;
      const totalPaidDays = workingDays + (halfDays * 0.5);
      let calculatedSalary = 0;

      if (staff.salary_type === 'daily') {
        calculatedSalary = totalPaidDays * rate;
      } else {
        calculatedSalary = Math.max(0, rate - (tallies.absent * (rate / 30)));
      }

      const [advRows] = await pool.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(amount), 0) as total_unpaid FROM staff_advances WHERE staff_id = ? AND status = 'unpaid'`,
        [staff.id]
      );
      const unpaidAdvance = Number(advRows[0].total_unpaid || 0);
      const netSalary = Math.max(0, calculatedSalary - unpaidAdvance);

      data.push({
        id: staff.id,
        staff_code: staff.staff_code,
        full_name: staff.full_name,
        role: staff.role,
        salary_type: staff.salary_type,
        salary_amount: staff.salary_amount,
        status: staff.status,
        attendance: tallies,
        calculated_salary: calculatedSalary,
        unpaid_advance: unpaidAdvance,
        net_salary: netSalary
      });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Staff salary report error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch staff salary details.' } });
  }
};

/**
 * Accounts Report (Cash Flow: Cash In vs Cash Out)
 */
export const getAccountsReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date_from, date_to, payment_mode } = req.query as any;
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
    const defaultTo = now.toISOString().split('T')[0];
    const from = date_from || defaultFrom;
    const to = date_to || defaultTo;

    // Cash In
    const payConds: string[] = ['DATE(p.payment_date) BETWEEN ? AND ?'];
    const payParams: any[] = [from, to];
    if (payment_mode) {
      payConds.push('p.payment_mode = ?');
      payParams.push(payment_mode);
    }
    const payWhere = payConds.join(' AND ');

    const [cashInRows] = await pool.query<RowDataPacket[]>(
      `SELECT p.id, p.payment_date, p.amount, p.payment_mode, p.payment_type, p.reference_no, p.notes,
              c.full_name as customer_name, j.job_code, inv.invoice_code
       FROM payments p
       LEFT JOIN customers c ON p.customer_id = c.id
       LEFT JOIN job_cards j ON p.job_card_id = j.id
       LEFT JOIN invoices inv ON p.invoice_id = inv.id
       WHERE ${payWhere}
       ORDER BY p.payment_date DESC`,
      payParams
    );

    // Cash Out - Inventory Purchases
    const purchConds: string[] = ['DATE(ip.purchase_date) BETWEEN ? AND ?'];
    const purchParams: any[] = [from, to];
    const purchWhere = purchConds.join(' AND ');

    const [purchRows] = await pool.query<RowDataPacket[]>(
      `SELECT ip.id, ip.purchase_date, (ip.qty_added * ip.purchase_price) as amount, ip.qty_added, ip.purchase_price, ip.supplier, ip.notes,
              i.name as item_name, i.item_code, i.category
       FROM inventory_purchases ip
       LEFT JOIN inventory_items i ON ip.inventory_item_id = i.id
       WHERE ${purchWhere}
       ORDER BY ip.purchase_date DESC`,
      purchParams
    );

    // Cash Out - Referral Commissions
    const commConds: string[] = ['DATE(cc.paid_date) BETWEEN ? AND ?', "cc.status = 'paid'"];
    const commParams: any[] = [from, to];
    if (payment_mode) {
      commConds.push('cc.payment_mode = ?');
      commParams.push(payment_mode);
    }
    const commWhere = commConds.join(' AND ');

    const [commRows] = await pool.query<RowDataPacket[]>(
      `SELECT cc.id, cc.paid_date, cc.commission_amount as amount, cc.payment_mode, cc.notes,
              con.full_name as connector_name, j.job_code
       FROM connector_commissions cc
       LEFT JOIN connectors con ON cc.connector_id = con.id
       LEFT JOIN job_cards j ON cc.job_card_id = j.id
       WHERE ${commWhere}
       ORDER BY cc.paid_date DESC`,
      commParams
    );

    const cashOutRows = [
      ...purchRows.map(p => ({
        id: `purch-${p.id}`,
        date: p.purchase_date,
        amount: Number(p.amount),
        payment_mode: 'bank_transfer',
        expense_type: 'material_purchase',
        description: `Material: ${p.item_name} (Qty ${p.qty_added})`,
        supplier: p.supplier || 'N/A',
        notes: p.notes || ''
      })),
      ...commRows.map(c => ({
        id: `comm-${c.id}`,
        date: c.paid_date,
        amount: Number(c.amount),
        payment_mode: c.payment_mode || 'upi',
        expense_type: 'commission',
        description: `Commission to ${c.connector_name} (Job: ${c.job_code})`,
        supplier: 'N/A',
        notes: c.notes || ''
      }))
    ];

    cashOutRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalCashIn = cashInRows.reduce((sum, row) => sum + Number(row.amount), 0);
    const totalCashOut = cashOutRows.reduce((sum, row) => sum + Number(row.amount), 0);
    const netFlow = totalCashIn - totalCashOut;

    const modeBreakdown: Record<string, number> = { cash: 0, upi: 0, card: 0, bank_transfer: 0, cheque: 0 };
    for (const row of cashInRows) {
      const mode = row.payment_mode || 'cash';
      if (modeBreakdown[mode] !== undefined) {
        modeBreakdown[mode] += Number(row.amount);
      }
    }

    res.json({
      success: true,
      data: {
        cash_in: cashInRows,
        cash_out: cashOutRows,
        summary: {
          total_cash_in: totalCashIn,
          total_cash_out: totalCashOut,
          net_flow: netFlow,
          mode_breakdown: modeBreakdown
        }
      }
    });
  } catch (error) {
    console.error('Accounts report error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch accounts details.' } });
  }
};
