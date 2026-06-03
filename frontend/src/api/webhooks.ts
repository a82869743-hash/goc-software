import apiClient from './client';
import type { ApiResponse } from '../types';

export interface WebhookStatus {
  webhookConfigured: boolean;
  pageConnected: boolean;
  facebookLeadSyncEnabled: boolean;
  instagramLeadSyncEnabled: boolean;
  appIdConfigured: boolean;
  webhookUrl: string;
  recentEvents: WebhookLogEntry[];
  stats: { total: number; success: number; failed: number; duplicate: number };
  configs?: any[];
}

export interface WebhookLogEntry {
  id: number;
  event_type: string;
  leadgen_id: string | null;
  form_id: string | null;
  page_id: string | null;
  raw_payload: string | null;
  processing_status: string;
  created_lead_id: number | null;
  error_message: string | null;
  created_at: string;
}

export const webhooksAPI = {
  getStatus: async (): Promise<ApiResponse<WebhookStatus>> => {
    const { data } = await apiClient.get('/webhooks/status');
    return data;
  },

  updateConfig: async (payload: {
    platform: 'facebook' | 'instagram' | 'whatsapp';
    verify_token?: string;
    default_assignee?: number | null;
    is_active?: boolean;
    page_id?: string;
  }): Promise<ApiResponse<any>> => {
    const { data } = await apiClient.patch('/webhooks/config', payload);
    return data;
  },

  getEvents: async (params?: { platform?: string; page?: number; limit?: number }): Promise<ApiResponse<any>> => {
    const { data } = await apiClient.get('/webhooks/events', { params });
    return data;
  },

  getLogs: async (filters?: { status?: string; page?: number }): Promise<ApiResponse<WebhookLogEntry[]>> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.page) params.append('page', String(filters.page));
    const { data } = await apiClient.get(`/webhooks/logs?${params.toString()}`);
    return data;
  },
};
