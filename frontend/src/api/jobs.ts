import apiClient from './client';
import type { ApiResponse } from '../types';

export interface JobService {
  id: number;
  job_card_id: number;
  service_name: string;
  service_type: 'ppf' | 'ceramic' | 'polish' | 'detailing' | 'other';
  package_tier: 'basic' | 'premium' | 'elite';
  description?: string | null;
  sqft_used: number;
  ml_used: number;
  unit_price: number;
  quantity: number;
  line_total: number;
  tax_pct?: number;
  item_type?: string;
  inventory_item_id?: number | null;
}

export interface StatusLogEntry {
  id: number;
  old_status: string | null;
  new_status: string;
  changed_by: number;
  staff_name?: string;
  notes?: string | null;
  created_at: string;
}

export interface JobCard {
  id: number;
  job_code: string;
  booking_id?: number | null;
  customer_id: number;
  vehicle_id: number;
  job_type: 'booked' | 'walkin' | 'quick';
  status: 'scheduled' | 'car_in' | 'washing' | 'in_progress' | 'qc' | 'rework' | 'ready' | 'delivered' | 'cancelled' | 'estimate';
  date_in?: string | null;
  expected_out?: string | null;
  date_out?: string | null;
  assigned_staff?: number[] | null;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  qc_passed: number;
  qc_notes?: string | null;
  delivery_notes?: string | null;
  certificate_url?: string | null;
  internal_notes?: string | null;
  created_by: number;
  completion_type?: 'invoice' | 'estimate' | null;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string | null;
  customer_alt_phone?: string | null;
  customer_dob?: string | null;
  customer_address?: string | null;
  customer_city?: string | null;
  customer_notes?: string | null;
  insurance_company?: string | null;
  insurance_expiry?: string | null;
  km_reading?: number | null;
  vehicle_name?: string;
  reg_number?: string;
  vehicle_year?: number | null;
  vehicle_fuel_type?: string | null;
  vehicle_color?: string | null;
  vehicle_notes?: string | null;
  created_by_name?: string;
  services?: JobService[];
  statusLog?: StatusLogEntry[];
  photos?: { id: number; stage: string; file_url: string; created_at: string }[];
  created_at: string;
}

interface JobFilters {
  status?: string;
  job_type?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export const jobsAPI = {
  list: async (filters: JobFilters = {}): Promise<ApiResponse<JobCard[]>> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '' && v !== null) params.append(k, String(v)); });
    const { data } = await apiClient.get(`/jobs?${params.toString()}`);
    return data;
  },

  pipeline: async (): Promise<ApiResponse<Record<string, number>>> => {
    const { data } = await apiClient.get('/jobs/pipeline');
    return data;
  },

  getById: async (id: number): Promise<ApiResponse<JobCard>> => {
    const { data } = await apiClient.get(`/jobs/${id}`);
    return data;
  },

  getInvoiceData: async (id: number): Promise<ApiResponse<any>> => {
    const { data } = await apiClient.get(`/jobs/${id}/invoice-data`);
    return data;
  },

  concernPresets: async (): Promise<ApiResponse<any[]>> => {
    const { data } = await apiClient.get('/jobs/concern-presets');
    return data;
  },

  create: async (payload: Partial<JobCard>): Promise<ApiResponse<JobCard>> => {
    const { data } = await apiClient.post('/jobs', payload);
    return data;
  },

  update: async (id: number, payload: Partial<JobCard>): Promise<ApiResponse<JobCard>> => {
    const { data } = await apiClient.put(`/jobs/${id}`, payload);
    return data;
  },

  updateStatus: async (id: number, new_status: string, notes?: string): Promise<ApiResponse<JobCard>> => {
    const { data } = await apiClient.patch(`/jobs/${id}/status`, { new_status, notes });
    return data;
  },

  addService: async (jobId: number, service: Partial<JobService>): Promise<ApiResponse<JobService[]>> => {
    const { data } = await apiClient.post(`/jobs/${jobId}/services`, service);
    return data;
  },

  deleteService: async (jobId: number, serviceId: number): Promise<ApiResponse<{ message: string }>> => {
    const { data } = await apiClient.delete(`/jobs/${jobId}/services/${serviceId}`);
    return data;
  },

  delete: async (id: number): Promise<ApiResponse<{ message: string }>> => {
    const { data } = await apiClient.delete(`/jobs/${id}`);
    return data;
  },

  uploadPhotos: async (id: number, stage: string, files: File[]): Promise<ApiResponse<any[]>> => {
    const formData = new FormData();
    formData.append('stage', stage);
    files.forEach(f => formData.append('photos', f));
    const { data } = await apiClient.post(`/jobs/${id}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  searchServiceCatalog: async (q?: string, category?: string, service_type?: string): Promise<ApiResponse<any[]>> => {
    const params = new URLSearchParams();
    if (q) params.append('q', q);
    if (category) params.append('category', category);
    if (service_type) params.append('service_type', service_type);
    const { data } = await apiClient.get(`/jobs/service-catalog?${params.toString()}`);
    return data;
  },

  getServiceCatalogCategories: async (): Promise<ApiResponse<any[]>> => {
    const { data } = await apiClient.get('/jobs/service-catalog/categories');
    return data;
  },

  completeJob: async (id: number, payload: {
    completion_type: 'invoice' | 'estimate';
    gst_applicable: boolean;
    payment_mode?: string;
    notes?: string;
    gst_pct?: number | '';
  }): Promise<ApiResponse<any>> => {
    const { data } = await apiClient.post(`/jobs/${id}/complete`, payload);
    return data;
  },

  updateService: async (jobId: number, serviceId: number, service: Partial<JobService>): Promise<ApiResponse<JobService[]>> => {
    const { data } = await apiClient.put(`/jobs/${jobId}/services/${serviceId}`, service);
    return data;
  },

  dispatch: async (id: number, dispatch_type: 'whatsapp' | 'sms'): Promise<ApiResponse<any>> => {
    const { data } = await apiClient.post(`/jobs/${id}/dispatch`, { dispatch_type });
    return data;
  },

  getInvoicePdf: async (id: number): Promise<ApiResponse<{ pdf_url: string }>> => {
    const { data } = await apiClient.get(`/jobs/${id}/invoice-html`, { timeout: 60000 });
    return data;
  },

  uploadCertificate: async (id: number, file: File): Promise<ApiResponse<{ certificate_url: string }>> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiClient.post(`/jobs/${id}/certificate`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  },
};

