import apiClient from './client';
import type { ApiResponse } from '../types';

export interface WhatsAppLog {
  id: number;
  customer_id: number | null;
  phone: string;
  template_name: string;
  message_body: string | null;
  variables: Record<string, string> | null;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  msg91_message_id: string | null;
  error_message: string | null;
  triggered_by: number | null;
  customer_name?: string;
  sent_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppStats {
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  queued: number;
  today: number;
  this_week: number;
  total: number;
}

export interface Campaign {
  id: number;
  name: string;
  template_name: string;
  segment_type: 'all' | 'vip' | 'recent' | 'custom';
  segment_filter: Record<string, any> | null;
  scheduled_at: string | null;
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'cancelled';
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: number;
  created_by_name?: string;
  created_at: string;
}

export interface PromotionalMaterial {
  id: number;
  title: string;
  description: string | null;
  file_type: 'image' | 'video' | 'document' | 'other';
  file_url: string;
  file_size: number;
  created_at: string;
  updated_at: string;
}

export const marketingAPI = {
  // WhatsApp logs
  getLogs: async (filters: Record<string, any> = {}): Promise<ApiResponse<WhatsAppLog[]>> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '' && v !== null) params.append(k, String(v)); });
    const { data } = await apiClient.get(`/marketing/whatsapp/logs?${params.toString()}`);
    return data;
  },

  getStats: async (): Promise<ApiResponse<WhatsAppStats>> => {
    const { data } = await apiClient.get('/marketing/whatsapp/stats');
    return data;
  },

  quickSend: async (payload: { phone: string; message: string; customer_id?: number }) => {
    const { data } = await apiClient.post('/marketing/whatsapp/quick-send', payload);
    return data;
  },

  // Campaigns
  getCampaigns: async (filters: Record<string, any> = {}): Promise<ApiResponse<Campaign[]>> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '' && v !== null) params.append(k, String(v)); });
    const { data } = await apiClient.get(`/marketing/campaigns?${params.toString()}`);
    return data;
  },

  createCampaign: async (payload: any) => {
    const { data } = await apiClient.post('/marketing/campaigns', payload);
    return data;
  },

  updateCampaign: async (id: number, payload: any) => {
    const { data } = await apiClient.put(`/marketing/campaigns/${id}`, payload);
    return data;
  },

  deleteCampaign: async (id: number) => {
    const { data } = await apiClient.delete(`/marketing/campaigns/${id}`);
    return data;
  },

  executeCampaign: async (id: number) => {
    const { data } = await apiClient.post(`/marketing/campaigns/${id}/execute`);
    return data;
  },

  // Promotional Materials
  getMaterials: async (): Promise<ApiResponse<PromotionalMaterial[]>> => {
    const { data } = await apiClient.get('/marketing/materials');
    return data;
  },

  uploadMaterial: async (formData: FormData): Promise<ApiResponse<PromotionalMaterial>> => {
    const { data } = await apiClient.post('/marketing/materials', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  },

  deleteMaterial: async (id: number): Promise<ApiResponse<{ message: string }>> => {
    const { data } = await apiClient.delete(`/marketing/materials/${id}`);
    return data;
  },
};
