import apiClient from './client';

export const reportsApi = {
  getMonthlyRevenue: async () => {
    const res = await apiClient.get('/reports/monthly-revenue');
    return res.data.data;
  },
  getServiceBreakdown: async () => {
    const res = await apiClient.get('/reports/service-breakdown');
    return res.data.data;
  },
  getLeadFunnel: async () => {
    const res = await apiClient.get('/reports/lead-funnel');
    return res.data.data;
  },
  getJobStatusDistribution: async () => {
    const res = await apiClient.get('/reports/job-status');
    return res.data.data;
  },
  getStaffPerformance: async () => {
    const res = await apiClient.get('/reports/staff-performance');
    return res.data.data;
  },
  getAttendanceSummary: async () => {
    const res = await apiClient.get('/reports/attendance-summary');
    return res.data.data;
  },
  getInventoryReport: async () => {
    const res = await apiClient.get('/reports/inventory');
    return res.data.data;
  },
  getJobCardsReportDetail: async (params?: { date_from?: string; date_to?: string; status?: string; search?: string }) => {
    const res = await apiClient.get('/reports/job-cards-detail', { params });
    return res.data.data;
  },
  getStaffSalaryReport: async (params?: { date_from?: string; date_to?: string }) => {
    const res = await apiClient.get('/reports/staff-salary', { params });
    return res.data.data;
  },
  getAccountsReport: async (params?: { date_from?: string; date_to?: string; payment_mode?: string }) => {
    const res = await apiClient.get('/reports/accounts', { params });
    return res.data.data;
  },
};
