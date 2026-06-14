import { Request, Response } from 'express';
import pool from '../utils/db';
import { ERROR_CODES } from '../utils/constants';
import { RowDataPacket } from 'mysql2';

/**
 * Dashboard KPIs — live summary data for the main dashboard.
 * Aggregates across leads, jobs, invoices, inventory, and attendance.
 */
export const getDashboardKPIs = async (_req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Today's revenue (payments received today)
    const [revQ] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(amount), 0) as today_revenue
       FROM payments WHERE DATE(payment_date) = ?`, [today]);

    // Active jobs (not delivered/cancelled)
    const [jobsQ] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as active_jobs FROM job_cards
       WHERE status NOT IN ('delivered', 'cancelled') AND deleted_at IS NULL`);

    // New leads today
    const [leadsQ] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as new_leads FROM leads WHERE DATE(created_at) = ? AND deleted_at IS NULL`, [today]);

    // Pending deliveries (status = 'ready')
    const [delivQ] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as pending_deliveries FROM job_cards WHERE status = 'ready' AND deleted_at IS NULL`);

    // Low stock items
    const [stockQ] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as low_stock FROM inventory_items WHERE current_stock <= min_threshold AND deleted_at IS NULL`);

    // Staff attendance today
    const [attQ] = await pool.query<RowDataPacket[]>(
      `SELECT
         (SELECT COUNT(*) FROM staff WHERE status = 'active' AND deleted_at IS NULL) as total_staff,
         (SELECT COUNT(*) FROM attendance WHERE date = ? AND status IN ('present', 'late', 'half_day')) as staff_present`, [today]);

    // Monthly revenue (current month)
    const monthStart = `${today.substring(0, 7)}-01`;
    const [monthRevQ] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(amount), 0) as month_revenue
       FROM payments WHERE DATE(payment_date) >= ?`, [monthStart]);

    // Total outstanding
    const [outstandQ] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(balance_due), 0) as total_outstanding
       FROM invoices WHERE status IN ('sent', 'partially_paid') AND deleted_at IS NULL`);

    // Today's bookings count
    const [todayBookQ] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as today_bookings FROM bookings WHERE booking_date = ? AND status != 'cancelled' AND deleted_at IS NULL`, [today]);

    res.json({
      success: true,
      data: {
        today_revenue: Number(revQ[0].today_revenue),
        active_jobs: Number(jobsQ[0].active_jobs),
        new_leads_today: Number(leadsQ[0].new_leads),
        pending_deliveries: Number(delivQ[0].pending_deliveries),
        low_stock_count: Number(stockQ[0].low_stock),
        staff_present: Number(attQ[0].staff_present),
        total_staff: Number(attQ[0].total_staff),
        month_revenue: Number(monthRevQ[0].month_revenue),
        total_outstanding: Number(outstandQ[0].total_outstanding),
        today_bookings: Number(todayBookQ[0].today_bookings),
      },
    });
  } catch (error) { console.error('Dashboard KPIs error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

/**
 * Recent jobs — last 10 active jobs for dashboard widget
 */
export const getRecentJobs = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT j.id, j.job_code, j.status, j.total_amount, j.expected_out,
              c.full_name as customer_name, v.make, v.model
       FROM job_cards j
       LEFT JOIN customers c ON j.customer_id = c.id
       LEFT JOIN vehicles v ON j.vehicle_id = v.id
       WHERE j.deleted_at IS NULL AND j.status NOT IN ('delivered', 'cancelled')
       ORDER BY j.updated_at DESC LIMIT 10`);
    res.json({ success: true, data: rows });
  } catch (error) { console.error('Recent jobs error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

/**
 * Revenue chart — daily revenue for the current month
 */
export const getRevenueChart = async (_req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = `${today.substring(0, 7)}-01`;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE(payment_date) as date, COALESCE(SUM(amount), 0) as revenue
       FROM payments
       WHERE DATE(payment_date) >= ? AND DATE(payment_date) <= ?
       GROUP BY DATE(payment_date) ORDER BY date ASC`,
      [monthStart, today]
    );

    res.json({ success: true, data: rows });
  } catch (error) { console.error('Revenue chart error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

/**
 * Lead pipeline — live funnel stats
 */
export const getLeadPipeline = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT status, COUNT(*) as count FROM leads
       WHERE deleted_at IS NULL
       GROUP BY status
       ORDER BY FIELD(status, 'new', 'contacted', 'interested', 'quotation_sent', 'booked', 'lost')`
    );

    // Also get lead source breakdown
    const [sources] = await pool.query<RowDataPacket[]>(
      `SELECT source, COUNT(*) as count FROM leads
       WHERE deleted_at IS NULL
       GROUP BY source ORDER BY count DESC`
    );

    // Total leads
    const total = rows.reduce((sum: number, r: any) => sum + Number(r.count), 0);

    res.json({
      success: true,
      data: { pipeline: rows, sources, total },
    });
  } catch (error) { console.error('Lead pipeline error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

/**
 * Low stock items list for dashboard
 */
export const getLowStockItems = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, item_code, name, category, brand, unit, current_stock, min_threshold, location
       FROM inventory_items
       WHERE current_stock <= min_threshold AND deleted_at IS NULL
       ORDER BY (current_stock / GREATEST(min_threshold, 1)) ASC LIMIT 10`
    );
    res.json({ success: true, data: rows });
  } catch (error) { console.error('Low stock error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

/** GET /dashboard/extended-stats — Extended analytics for charts */
export const getExtendedDashboardStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.substring(0, 7);
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonth = lastMonthDate.toISOString().substring(0, 7);
    const twoMonthsDate = new Date();
    twoMonthsDate.setMonth(twoMonthsDate.getMonth() - 2);
    const twoMonthsAgo = twoMonthsDate.toISOString().substring(0, 7);

    // 1. Monthly revenue comparison
    const [monthlyRev] = await pool.query<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN DATE_FORMAT(payment_date, '%Y-%m') = ? THEN amount ELSE 0 END), 0) as this_month,
         COALESCE(SUM(CASE WHEN DATE_FORMAT(payment_date, '%Y-%m') = ? THEN amount ELSE 0 END), 0) as last_month,
         COALESCE(SUM(CASE WHEN DATE_FORMAT(payment_date, '%Y-%m') = ? THEN amount ELSE 0 END), 0) as two_months_ago
       FROM payments
       WHERE payment_type != 'refund'`,
      [thisMonth, lastMonth, twoMonthsAgo]
    );

    // 2. Service mix revenue breakdown
    const [serviceMix] = await pool.query<RowDataPacket[]>(
      `SELECT js.service_type, COALESCE(SUM(js.line_total), 0) as revenue
       FROM job_services js
       JOIN job_cards jc ON js.job_card_id = jc.id
       WHERE jc.status = 'delivered' AND jc.deleted_at IS NULL
       GROUP BY js.service_type`
    );

    res.json({
      success: true,
      data: {
        monthly_comparison: monthlyRev[0],
        service_mix: serviceMix,
      }
    });
  } catch (error) {
    console.error('Extended stats error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch extended stats.' } });
  }
};
