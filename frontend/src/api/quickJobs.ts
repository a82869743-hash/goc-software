import apiClient from './client';
import type { ApiResponse } from '../types';

export interface QuickService {
  id: number;
  service_name: string;
  default_rate: number;
  is_active: number;
  sort_order: number;
  created_at: string;
}

export interface QuickJobCard {
  id: number;
  job_no: string;
  reg_no: string;
  owner_name: string;
  mobile: string;
  car_name?: string | null;
  car_make?: string | null;
  car_model?: string | null;
  fuel_type?: string | null;
  insurance_company?: string | null;
  insurance_expiry?: string | null;
  status: string;
  completion_type?: 'invoice' | 'estimate' | null;
  public_token?: string | null;
  km_reading?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  invoice_no?: string | null;
  invoice_total?: number | null;
  invoice_date?: string | null;
  estimate_no?: string | null;
  estimate_total?: number | null;
  estimate_date?: string | null;
}

export interface QuickServiceLineItem {
  id: number;
  job_card_id: number;
  service_name: string;
  item_type: string;
  qty: number;
  rate: number;
  amount: number;
  tax_pct: number;
  hsn_sac?: string | null;
  inventory_item_id?: number | null;
  sqft_used?: number | null;
}

export interface QuickConcern {
  id: number;
  job_card_id: number;
  concern_text: string;
}

export interface QuickJobCardDetails {
  jobCard: QuickJobCard;
  services: QuickServiceLineItem[];
  concerns: QuickConcern[];
  invoice: any | null;
  estimate: any | null;
  media: any[];
}

interface QuickJobFilters {
  status?: string;
  search?: string;
  from?: string;
  to?: string;
}

export const quickJobsAPI = {
  listServices: async (): Promise<ApiResponse<QuickService[]>> => {
    const { data } = await apiClient.get('/quick-job-cards/quick-services');
    return data;
  },

  list: async (filters: QuickJobFilters = {}): Promise<ApiResponse<QuickJobCard[]>> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) params.append(k, String(v));
    });
    const { data } = await apiClient.get(`/quick-job-cards?${params.toString()}`);
    return data;
  },

  getById: async (id: number): Promise<ApiResponse<QuickJobCardDetails>> => {
    const { data } = await apiClient.get(`/quick-job-cards/${id}`);
    return data;
  },

  create: async (payload: any): Promise<ApiResponse<{ id: number; job_no: string; public_token: string; tracking_url: string; message: string }>> => {
    const { data } = await apiClient.post('/quick-job-cards', payload);
    return data;
  },

  update: async (id: number, payload: Partial<QuickJobCard>): Promise<ApiResponse<QuickJobCard>> => {
    const { data } = await apiClient.put(`/quick-job-cards/${id}`, payload);
    return data;
  },

  updateStatus: async (id: number, new_status: string): Promise<ApiResponse<any>> => {
    const { data } = await apiClient.patch(`/quick-job-cards/${id}/status`, { new_status });
    return data;
  },

  addService: async (jobId: number, service: Partial<QuickServiceLineItem>): Promise<ApiResponse<any>> => {
    const { data } = await apiClient.post(`/quick-job-cards/${jobId}/services`, service);
    return data;
  },

  updateService: async (jobId: number, serviceId: number, service: Partial<QuickServiceLineItem>): Promise<ApiResponse<any>> => {
    const { data } = await apiClient.put(`/quick-job-cards/${jobId}/services/${serviceId}`, service);
    return data;
  },

  deleteService: async (jobId: number, serviceId: number): Promise<ApiResponse<{ message: string }>> => {
    const { data } = await apiClient.delete(`/quick-job-cards/${jobId}/services/${serviceId}`);
    return data;
  },

  addConcern: async (jobId: number, concern_text: string): Promise<ApiResponse<any>> => {
    const { data } = await apiClient.post(`/quick-job-cards/${jobId}/concerns`, { concern_text });
    return data;
  },

  deleteConcern: async (jobId: number, concernId: number): Promise<ApiResponse<{ message: string }>> => {
    const { data } = await apiClient.delete(`/quick-job-cards/${jobId}/concerns/${concernId}`);
    return data;
  },

  complete: async (id: number, payload: { completion_type: 'invoice' | 'estimate'; payment_mode: string; gst_pct?: number }): Promise<ApiResponse<any>> => {
    const { data } = await apiClient.post(`/quick-job-cards/${id}/complete`, payload);
    return data;
  },

  getInvoiceData: async (id: number): Promise<ApiResponse<QuickJobCardDetails>> => {
    const { data } = await apiClient.get(`/quick-job-cards/${id}/invoice-data`);
    return data;
  },

  sendTrackingSms: async (jobCardId: number): Promise<ApiResponse<{ message: string }>> => {
    const { data } = await apiClient.post('/quick-job-cards/send-tracking-sms', { job_card_id: jobCardId });
    return data;
  },
};
