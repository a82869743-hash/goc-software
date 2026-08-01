import apiClient from './client';

export interface Commission {
  id: number;
  connector_id: number;
  job_card_id: number;
  customer_id: number;
  job_amount: number;
  commission_pct: number | null;
  commission_amount: number;
  status: 'pending' | 'approved' | 'paid';
  paid_date: string | null;
  payment_mode: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined fields
  connector_name?: string;
  connector_phone?: string;
  customer_name?: string;
  job_code?: string;
}

export interface CommissionStats {
  total_pending: number;
  total_paid: number;
  pending_count: number;
}

export interface Connector {
  id: number;
  full_name: string;
  phone: string;
  email: string | null;
  commission_type: 'percentage' | 'fixed';
  commission_value: number;
  created_at: string;
  updated_at: string;
}

export const commissionsAPI = {
  list: async (params?: { status?: string; connector_id?: number; page?: number; limit?: number }) => {
    const { data } = await apiClient.get('/commissions', { params });
    return data as { data: Commission[]; meta: { total: number; page: number; limit: number; totalPages: number } };
  },

  getStats: async () => {
    const { data } = await apiClient.get('/commissions/stats');
    return data as { data: CommissionStats };
  },

  updateStatus: async (id: number, payload: { status: 'pending' | 'approved' | 'paid'; payment_mode?: string; notes?: string }) => {
    const { data } = await apiClient.put(`/commissions/${id}/status`, payload);
    return data as { data: Commission };
  },

  listConnectors: async () => {
    const { data } = await apiClient.get('/commissions/connectors');
    return data as { data: Connector[] };
  },

  createConnector: async (payload: { full_name: string; phone: string; email?: string; commission_type: 'percentage' | 'fixed'; commission_value: number }) => {
    const { data } = await apiClient.post('/commissions/connectors', payload);
    return data as { data: Connector };
  },

  createCommission: async (payload: {
    connector_id: number;
    job_card_id: number;
    customer_id: number;
    job_amount?: number;
    commission_pct?: number;
    commission_amount: number;
    notes?: string;
  }) => {
    const { data } = await apiClient.post('/commissions', payload);
    return data as { data: Commission };
  },

  deleteConnector: async (id: number) => {
    const { data } = await apiClient.delete(`/commissions/connectors/${id}`);
    return data;
  }
};
