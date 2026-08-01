import apiClient from './client';
import type { ApiResponse } from '../types';

export interface StaffMember {
  id: number;
  staff_code: string;
  full_name: string;
  phone: string;
  email?: string | null;
  role: 'admin' | 'technician' | 'receptionist' | 'manager' | 'staff' | 'hr';
  salary_type: 'monthly' | 'daily';
  salary_amount: number;
  join_date: string;
  status: 'active' | 'on_leave' | 'resigned';
  profile_picture?: string | null;
  attendance?: AttendanceRecord[];
}

export interface AttendanceRecord {
  id: number; staff_id: number; date: string; check_in_time?: string; check_out_time?: string;
  status: 'present' | 'late' | 'absent' | 'half_day' | 'leave';
  working_hours?: number; notes?: string;
}

export interface TodayAttendanceRow {
  staff_id: number; staff_code: string; full_name: string; role: string;
  attendance_id: number | null; att_status: string | null; check_in_time?: string; check_out_time?: string; notes?: string;
}

export interface PaymentRequest {
  id: number;
  staff_id: number;
  staff_name?: string;
  staff_role?: string;
  staff_code?: string;
  amount: number;
  request_type: 'advance' | 'salary' | 'incentive' | 'reimbursement';
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by: number | null;
  approved_by_name?: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const staffAPI = {
  list: async (filters: Record<string, any> = {}): Promise<ApiResponse<StaffMember[]>> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '' && v !== null) params.append(k, String(v)); });
    const { data } = await apiClient.get(`/staff?${params.toString()}`);
    return data;
  },
  getById: async (id: number): Promise<ApiResponse<StaffMember>> => {
    const { data } = await apiClient.get(`/staff/${id}`);
    return data;
  },
  create: async (payload: any): Promise<ApiResponse<StaffMember>> => {
    const { data } = await apiClient.post('/staff', payload);
    return data;
  },
  update: async (id: number, payload: any): Promise<ApiResponse<StaffMember>> => {
    const { data } = await apiClient.put(`/staff/${id}`, payload);
    return data;
  },
  delete: async (id: number): Promise<ApiResponse<{ message: string }>> => {
    const { data } = await apiClient.delete(`/staff/${id}`);
    return data;
  },
  markAttendance: async (payload: { staff_id: number; status: string; notes?: string; check_in_time?: string | null; check_out_time?: string | null }): Promise<ApiResponse<{ message: string }>> => {
    const { data } = await apiClient.post('/staff/attendance', payload);
    return data;
  },
  todayAttendance: async (date?: string): Promise<ApiResponse<TodayAttendanceRow[]>> => {
    const { data } = await apiClient.get('/staff/attendance/today', { params: date ? { date } : {} });
    return data;
  },
  checkIn: async (payload: { latitude: number; longitude: number; selfie_url?: string; notes?: string }): Promise<ApiResponse<{ message: string }>> => {
    const { data } = await apiClient.post('/staff/check-in', payload);
    return data;
  },
  checkOut: async (payload: { latitude: number; longitude: number; notes?: string }): Promise<ApiResponse<{ message: string }>> => {
    const { data } = await apiClient.post('/staff/check-out', payload);
    return data;
  },
  getAttendanceHistory: async (params?: { date_from?: string; date_to?: string; staff_id?: number | string; search?: string }): Promise<ApiResponse<any[]>> => {
    const { data } = await apiClient.get('/staff/attendance/history', { params });
    return data;
  },
  getAdvances: async (id: number): Promise<ApiResponse<any[]>> => {
    const { data } = await apiClient.get(`/staff/${id}/advances`);
    return data;
  },
  createAdvance: async (payload: { staff_id: number; amount: number; notes?: string; advance_date?: string }): Promise<ApiResponse<{ message: string }>> => {
    const { data } = await apiClient.post('/staff/advances', payload);
    return data;
  },
  settleAdvance: async (id: number, status: 'unpaid' | 'deducted'): Promise<ApiResponse<{ message: string }>> => {
    const { data } = await apiClient.patch(`/staff/advances/${id}/settle`, { status });
    return data;
  },
  kioskAttendance: async (payload: { staff_id: number; type: 'check-in' | 'check-out'; photo: string }): Promise<ApiResponse<{ message: string; status?: string; is_late?: boolean; working_hours?: number }>> => {
    const { data } = await apiClient.post('/staff/kiosk-attendance', payload);
    return data;
  },
  getPaymentRequests: async (params?: { staff_id?: number; status?: string }): Promise<ApiResponse<PaymentRequest[]>> => {
    const { data } = await apiClient.get('/staff/payment-requests', { params });
    return data;
  },
  createPaymentRequest: async (payload: { amount: number; request_type: string; reason: string; notes?: string }): Promise<ApiResponse<{ message: string }>> => {
    const { data } = await apiClient.post('/staff/payment-requests', payload);
    return data;
  },
  approvePaymentRequest: async (id: number, payload: { status: 'approved' | 'rejected'; notes?: string }): Promise<ApiResponse<{ message: string }>> => {
    const { data } = await apiClient.patch(`/staff/payment-requests/${id}`, payload);
    return data;
  },
  uploadProfilePicture: async (staffId: number, file: File): Promise<ApiResponse<{ profile_picture: string }>> => {
    const formData = new FormData();
    formData.append('photo', file);
    const { data } = await apiClient.post(`/staff/${staffId}/profile-picture`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  updatePassword: async (staffId: number, newPassword: string): Promise<ApiResponse<{ message: string }>> => {
    const { data } = await apiClient.put(`/staff/${staffId}/password`, { new_password: newPassword });
    return data;
  },
};
