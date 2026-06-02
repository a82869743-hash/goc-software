import apiClient from './client';
import type { ApiResponse } from '../types';

export interface WhiteboardQuotation {
  id: number;
  quotation_code: string;
  customer_id: number | null;
  vehicle_id: number | null;
  lead_id: number | null;
  customer_name_override: string | null;
  customer_phone_override: string | null;
  vehicle_description: string | null;
  canvas_data: string | null;        // tldraw JSON snapshot string
  canvas_snapshot: string | null;    // base64 PNG for preview
  subtotal: number;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  discount_amount: number;
  apply_gst: boolean;
  gst_amount: number;
  grand_total: number;
  valid_until: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  pdf_url: string | null;
  notes: string | null;
  customer_name?: string;
  customer_phone?: string;
  vehicle_name?: string;
  reg_number?: string;
  created_at: string;
}

export interface CreateQuotationPayload {
  customer_id?: number | null;
  vehicle_id?: number | null;
  lead_id?: number | null;
  customer_name_override?: string;
  customer_phone_override?: string;
  vehicle_description?: string;
  canvas_data?: string;
  canvas_snapshot?: string;
  subtotal?: number;
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
  discount_amount?: number;
  apply_gst?: boolean;
  gst_amount?: number;
  grand_total?: number;
  valid_until?: string;
  notes?: string;
}

export const quotationsAPI = {
  list: async (filters: { status?: string; search?: string; page?: number; limit?: number } = {}): Promise<ApiResponse<WhiteboardQuotation[]>> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '') params.append(k, String(v)); });
    const { data } = await apiClient.get(`/quotations?${params.toString()}`);
    return data;
  },

  getById: async (id: number): Promise<ApiResponse<WhiteboardQuotation>> => {
    const { data } = await apiClient.get(`/quotations/${id}`);
    return data;
  },

  create: async (payload: CreateQuotationPayload): Promise<ApiResponse<WhiteboardQuotation>> => {
    const { data } = await apiClient.post('/quotations', payload);
    return data;
  },

  update: async (id: number, payload: Partial<CreateQuotationPayload> & { status?: string; pdf_url?: string }): Promise<ApiResponse<WhiteboardQuotation>> => {
    const { data } = await apiClient.put(`/quotations/${id}`, payload);
    return data;
  },

  delete: async (id: number): Promise<ApiResponse<{ message: string }>> => {
    const { data } = await apiClient.delete(`/quotations/${id}`);
    return data;
  },

  sendWhatsApp: async (id: number): Promise<ApiResponse<{ message: string; phone: string }>> => {
    const { data } = await apiClient.post(`/quotations/${id}/send-whatsapp`);
    return data;
  },

  generatePDF: async (id: number): Promise<ApiResponse<{ pdf_url: string; quotation_code: string }>> => {
    const { data } = await apiClient.post(`/quotations/${id}/generate-pdf`, null, { timeout: 60000 });
    return data;
  },
};
