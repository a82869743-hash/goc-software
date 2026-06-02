import { Router } from 'express';
import { getDashboardKPIs, getRecentJobs, getTodayBookings, getRevenueChart, getLeadPipeline, getLowStockItems, getExtendedDashboardStats } from '../controllers/dashboardController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/kpis', getDashboardKPIs);
router.get('/extended-stats', getExtendedDashboardStats);
router.get('/recent-jobs', getRecentJobs);
router.get('/today-bookings', getTodayBookings);
router.get('/revenue-chart', getRevenueChart);
router.get('/lead-pipeline', getLeadPipeline);
router.get('/low-stock', getLowStockItems);

export default router;
