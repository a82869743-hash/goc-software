import apiClient from './client';

export const webhooksAPI = {
  getStatus: async () => {
    const { data } = await apiClient.get('/webhooks/status');
    return data;
  },

  updateConfig: async (payload: {
    platform: 'facebook' | 'instagram' | 'whatsapp';
    verify_token?: string;
    default_assignee?: number | null;
    is_active?: boolean;
    page_id?: string;
  }) => {
    const { data } = await apiClient.patch('/webhooks/config', payload);
    return data;
  },

  getEvents: async (params?: { platform?: string; page?: number; limit?: number }) => {
    const { data } = await apiClient.get('/webhooks/events', { params });
    return data;
  },
};
