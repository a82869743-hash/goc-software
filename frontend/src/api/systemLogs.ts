import apiClient from './client';

export interface GetLogsParams {
  page?: number;
  limit?: number;
  staff_id?: number | string;
  action_type?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
}

export const systemLogsAPI = {
  getLogs: (params: GetLogsParams) => apiClient.get('/system-logs', { params }),
};
