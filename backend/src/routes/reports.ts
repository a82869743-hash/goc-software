import { Router } from 'express';
import {
  getMonthlyRevenue,
  getServiceBreakdown,
  getLeadFunnel,
  getJobStatusDistribution,
  getStaffPerformance,
  getAttendanceSummary,
  getRevenueReport,
  getInventoryReport,
  getCommissionReport,
  getGSTReport,
  getJobCardsReportDetail,
  getStaffSalaryReport,
  getAccountsReport
} from '../controllers/reportsController';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';

const router = Router();
router.use(authMiddleware);
router.use(rbac('admin', 'manager'));

router.get('/revenue', getRevenueReport);
router.get('/monthly-revenue', getMonthlyRevenue);
router.get('/service-breakdown', getServiceBreakdown);
router.get('/lead-funnel', getLeadFunnel);
router.get('/job-status', getJobStatusDistribution);
router.get('/staff-performance', getStaffPerformance);
router.get('/attendance-summary', getAttendanceSummary);
router.get('/inventory', getInventoryReport);
router.get('/commission', getCommissionReport);
router.get('/gst', getGSTReport);

router.get('/job-cards-detail', getJobCardsReportDetail);
router.get('/staff-salary', getStaffSalaryReport);
router.get('/accounts', getAccountsReport);

export default router;
