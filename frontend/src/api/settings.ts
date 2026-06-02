import apiClient from './client';

export interface AppSetting {
  value: string;
  description: string;
}

export const settingsApi = {
  getAll: async () => {
    const res = await apiClient.get('/settings');
    return res.data.data as Record<string, AppSetting>;
  },
  update: async (key: string, value: string, description?: string) => {
    const res = await apiClient.put('/settings', { key, value, description });
    return res.data.data;
  },
  batchUpdate: async (settings: { key: string; value: string; description?: string }[]) => {
    const res = await apiClient.put('/settings/batch', { settings });
    return res.data.data;
  },
};
