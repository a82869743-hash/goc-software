import apiClient from './client';
import type { ApiResponse } from '../types';

export interface AdvanceBooking {
  id: number;
  booking_ref: string;
  customer_name: string;
  mobile: string;
  car_number: string;
  car_make?: string | null;
  car_model?: string | null;
  concerns?: string | null;
  booking_date: string;
  booking_time: string;
  status: 'pending' | 'confirmed' | 'arrived' | 'cancelled' | 'converted';
  advance_amount?: number | string;
  advance_mode?: string | null;
  reminder_sent: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

interface BookingFilters {
  status?: string;
  date?: string;
  from?: string;
  to?: string;
  search?: string;
}

export const advanceBookingsAPI = {
  list: async (filters: BookingFilters = {}): Promise<ApiResponse<AdvanceBooking[]>> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) params.append(k, String(v));
    });
    const { data } = await apiClient.get(`/advance-bookings?${params.toString()}`);
    return data;
  },

  today: async (): Promise<ApiResponse<AdvanceBooking[]>> => {
    const { data } = await apiClient.get('/advance-bookings/today');
    return data;
  },

  getById: async (id: number): Promise<ApiResponse<AdvanceBooking>> => {
    const { data } = await apiClient.get(`/advance-bookings/${id}`);
    return data;
  },

  create: async (payload: Partial<AdvanceBooking>): Promise<ApiResponse<{ id: number; booking_ref: string; message: string }>> => {
    const { data } = await apiClient.post('/advance-bookings', payload);
    return data;
  },

  update: async (id: number, payload: Partial<AdvanceBooking>): Promise<ApiResponse<AdvanceBooking>> => {
    const { data } = await apiClient.put(`/advance-bookings/${id}`, payload);
    return data;
  },

  updateStatus: async (id: number, status: string): Promise<ApiResponse<any>> => {
    const { data } = await apiClient.patch(`/advance-bookings/${id}/status`, { status });
    return data;
  },

  delete: async (id: number): Promise<ApiResponse<{ message: string }>> => {
    const { data } = await apiClient.delete(`/advance-bookings/${id}`);
    return data;
  },
};
