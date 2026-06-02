import apiClient from './client';
import type { ApiResponse, Notification } from '../types';

export interface NotificationUnread {
  unread: number;
}

export const notificationsAPI = {
  list: async (filters: Record<string, any> = {}): Promise<ApiResponse<Notification[]>> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '' && v !== null) params.append(k, String(v)); });
    const { data } = await apiClient.get(`/notifications?${params.toString()}`);
    return data;
  },

  getUnreadCount: async (): Promise<ApiResponse<NotificationUnread>> => {
    const { data } = await apiClient.get('/notifications/unread-count');
    return data;
  },

  markAsRead: async (id: number) => {
    const { data } = await apiClient.put(`/notifications/${id}/read`);
    return data;
  },

  markAllAsRead: async () => {
    const { data } = await apiClient.put('/notifications/read-all');
    return data;
  },

  delete: async (id: number) => {
    const { data } = await apiClient.delete(`/notifications/${id}`);
    return data;
  },

  clearAll: async () => {
    const { data } = await apiClient.delete('/notifications/clear');
    return data;
  },
};
