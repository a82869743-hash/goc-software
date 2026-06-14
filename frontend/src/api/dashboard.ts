import apiClient from './client';

export interface DashboardKPIs {
  today_revenue: number;
  active_jobs: number;
  new_leads_today: number;
  pending_deliveries: number;
  low_stock_count: number;
  staff_present: number;
  total_staff: number;
  month_revenue: number;
  total_outstanding: number;
}

export interface ExtendedStats {
  monthly_comparison: {
    this_month: number;
    last_month: number;
    two_months_ago: number;
  };
  service_mix: Array<{
    service_type: string;
    revenue: number;
  }>;
}

export interface LeadPipelineData {
  pipeline: Array<{ status: string; count: number }>;
  sources: Array<{ source: string; count: number }>;
  total: number;
}

export const dashboardApi = {
  getKPIs: async () => {
    const res = await apiClient.get('/dashboard/kpis');
    return res.data.data as DashboardKPIs;
  },
  getRecentJobs: async () => {
    const res = await apiClient.get('/dashboard/recent-jobs');
    return res.data.data;
  },
  getExtendedStats: async () => {
    const res = await apiClient.get('/dashboard/extended-stats');
    return res.data.data as ExtendedStats;
  },
  getRevenueChart: async () => {
    const res = await apiClient.get('/dashboard/revenue-chart');
    return res.data.data as Array<{ date: string; revenue: number }>;
  },
  getLeadPipeline: async () => {
    const res = await apiClient.get('/dashboard/lead-pipeline');
    return res.data.data as LeadPipelineData;
  },
  getLowStock: async () => {
    const res = await apiClient.get('/dashboard/low-stock');
    return res.data.data;
  }
};
