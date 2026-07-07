import apiClient from './client';

export const staffManagementAPI = {
  listAll: () => apiClient.get('/staff-management/list'),
  create: (data: any) => apiClient.post('/staff-management/create', data),
  update: (id: number, data: any) => apiClient.put(`/staff-management/${id}`, data),
  resetPassword: (id: number, payload?: { password?: string }) => apiClient.post(`/staff-management/${id}/reset-password`, payload),
  toggleStatus: (id: number, status: string) => apiClient.patch(`/staff-management/${id}/status`, { status }),
  delete: (id: number) => apiClient.delete(`/staff-management/${id}`),
  getPermissions: (id: number) => apiClient.get(`/staff-management/${id}/permissions`),
  updatePermissions: (id: number, data: any) => apiClient.put(`/staff-management/${id}/permissions`, data),
  getMyPermissions: () => apiClient.get('/staff-management/my-permissions'),
};
