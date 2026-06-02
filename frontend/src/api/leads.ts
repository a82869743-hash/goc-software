import apiClient from './client';
import type { Lead, ApiResponse } from '../types';

interface LeadFilters {
  status?: string;
  source?: string;
  assigned_to?: number;
  search?: string;
  page?: number;
  limit?: number;
  date_from?: string;
  date_to?: string;
}

interface LeadStats {
  new: number;
  contacted: number;
  interested: number;
  quotation_sent: number;
  booked: number;
  lost: number;
  total: number;
}

export const leadsAPI = {
  list: async (filters: LeadFilters = {}): Promise<ApiResponse<Lead[]>> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== '' && val !== null) {
        params.append(key, String(val));
      }
    });
    const { data } = await apiClient.get(`/leads?${params.toString()}`);
    return data;
  },

  getById: async (id: number): Promise<ApiResponse<Lead>> => {
    const { data } = await apiClient.get(`/leads/${id}`);
    return data;
  },

  create: async (payload: Partial<Lead>): Promise<ApiResponse<Lead>> => {
    const { data } = await apiClient.post('/leads', payload);
    return data;
  },

  update: async (id: number, payload: Partial<Lead>): Promise<ApiResponse<Lead>> => {
    const { data } = await apiClient.put(`/leads/${id}`, payload);
    return data;
  },

  delete: async (id: number): Promise<ApiResponse<{ message: string }>> => {
    const { data } = await apiClient.delete(`/leads/${id}`);
    return data;
  },

  bulkReassign: async (leadIds: number[], assignedTo: number): Promise<ApiResponse<{ message: string }>> => {
    const { data } = await apiClient.patch('/leads/bulk-reassign', { lead_ids: leadIds, assigned_to: assignedTo });
    return data;
  },

  stats: async (): Promise<ApiResponse<LeadStats>> => {
    const { data } = await apiClient.get('/leads/stats');
    return data;
  },
};
