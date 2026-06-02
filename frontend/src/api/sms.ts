import apiClient from './client';
import type { ApiResponse } from '../types';

export interface SMSTemplate {
  id: number;
  event_key: string;
  template_name: string;
  dlt_template_id: string | null;
  msg91_flow_id: string | null;
  is_active: number;
  created_at: string;
}

export interface SMSStats {
  pending: number;
  sent: number;
  failed: number;
  total_today: number;
}

export interface SMSLog {
  id: number;
  mobile: string;
  event_key: string;
  msg91_request_id: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export const smsAPI = {
  getTemplates: async (): Promise<ApiResponse<SMSTemplate[]>> => {
    const { data } = await apiClient.get('/sms/templates');
    return data;
  },

  updateTemplate: async (
    id: number,
    payload: { dlt_template_id?: string; msg91_flow_id?: string; is_active?: boolean }
  ): Promise<ApiResponse<SMSTemplate>> => {
    const { data } = await apiClient.put(`/sms/templates/${id}`, payload);
    return data;
  },

  getStats: async (): Promise<ApiResponse<SMSStats>> => {
    const { data } = await apiClient.get('/sms/stats');
    return data;
  },

  getLogs: async (filters?: { event_key?: string; status?: string; page?: number }): Promise<ApiResponse<SMSLog[]>> => {
    const params = new URLSearchParams();
    if (filters?.event_key) params.append('event_key', filters.event_key);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.page) params.append('page', String(filters.page));
    const { data } = await apiClient.get(`/sms/logs?${params.toString()}`);
    return data;
  },

  retryFailed: async (id: number): Promise<ApiResponse<{ message: string }>> => {
    const { data } = await apiClient.post(`/sms/retry/${id}`);
    return data;
  },
};
