import apiClient from './client';
import type { ApiResponse } from '../types';

export interface InvoiceItem {
  id?: number;
  description: string;
  hsn_sac: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
}

export interface Invoice {
  id: number;
  invoice_code: string;
  job_card_id: number;
  customer_id: number;
  invoice_type: 'estimate' | 'proforma' | 'tax_invoice';
  invoice_date: string;
  due_date?: string | null;
  subtotal: number;
  discount_amount: number;
  taxable_amount: number;
  cgst_rate: number; cgst_amount: number;
  sgst_rate: number; sgst_amount: number;
  apply_gst: boolean;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  customer_gstin?: string | null;
  status: 'draft' | 'sent' | 'partially_paid' | 'paid' | 'cancelled';
  notes?: string | null;
  customer_name?: string;
  customer_phone?: string;
  job_code?: string;
  vehicle_reg_number?: string;
  items?: InvoiceItem[];
  created_at: string;
}

export interface InvoiceSummary { status: string; count: number; total: number; outstanding: number; }

export const invoicesAPI = {
  list: async (filters: Record<string, any> = {}): Promise<ApiResponse<Invoice[]>> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '' && v !== null) params.append(k, String(v)); });
    const { data } = await apiClient.get(`/invoices?${params.toString()}`);
    return data;
  },
  summary: async (): Promise<ApiResponse<InvoiceSummary[]>> => {
    const { data } = await apiClient.get('/invoices/summary');
    return data;
  },
  getById: async (id: number): Promise<ApiResponse<Invoice>> => {
    const { data } = await apiClient.get(`/invoices/${id}`);
    return data;
  },
  create: async (payload: any): Promise<ApiResponse<Invoice>> => {
    const { data } = await apiClient.post('/invoices', payload);
    return data;
  },
  update: async (id: number, payload: any): Promise<ApiResponse<Invoice>> => {
    const { data } = await apiClient.put(`/invoices/${id}`, payload);
    return data;
  },
  delete: async (id: number): Promise<ApiResponse<{ message: string }>> => {
    const { data } = await apiClient.delete(`/invoices/${id}`);
    return data;
  },
  outstanding: async (): Promise<ApiResponse<{ summary: any; invoices: any[] }>> => {
    const { data } = await apiClient.get('/invoices/outstanding');
    return data;
  },
  generatePdf: async (id: number): Promise<ApiResponse<{ pdf_url: string }>> => {
    const { data } = await apiClient.post(`/invoices/${id}/generate-pdf`, {}, { timeout: 60000 });
    return data;
  },
  sendWhatsApp: async (id: number): Promise<ApiResponse<any>> => {
    const { data } = await apiClient.post(`/invoices/${id}/send-whatsapp`);
    return data;
  },
};

