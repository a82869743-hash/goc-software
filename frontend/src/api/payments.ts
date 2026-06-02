import api from './client';

export const paymentsApi = {
  getAll: async (params?: Record<string, any>) => {
    const { data } = await api.get('/payments', { params });
    return data;
  },

  getById: async (id: number) => {
    const { data } = await api.get(`/payments/${id}`);
    return data.data;
  },

  recordPayment: async (payload: {
    invoice_id: number;
    amount: number;
    payment_mode?: string;
    reference_number?: string;
    notes?: string;
  }) => {
    const { data } = await api.post('/payments', payload);
    return data.data;
  },

  getSummary: async () => {
    const { data } = await api.get('/payments/summary/overview');
    return data.data;
  },
};
