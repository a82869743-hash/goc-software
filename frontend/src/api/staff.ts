import apiClient from './client';
import type { ApiResponse } from '../types';

export interface StaffMember {
  id: number;
  staff_code: string;
  full_name: string;
  phone: string;
  email?: string | null;
  role: 'admin' | 'technician' | 'receptionist' | 'manager' | 'staff';
  salary_type: 'monthly' | 'daily';
  salary_amount: number;
  join_date: string;
  status: 'active' | 'on_leave' | 'resigned';
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
  todayAttendance: async (): Promise<ApiResponse<TodayAttendanceRow[]>> => {
    const { data } = await apiClient.get('/staff/attendance/today');
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
};
