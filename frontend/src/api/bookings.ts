import apiClient from './client';
import type { ApiResponse } from '../types';

export interface Booking {
  id: number;
  booking_code: string;
  customer_id: number;
  vehicle_id: number;
  lead_id?: number | null;
  booking_date: string;
  time_slot: '09:00' | '11:00' | '14:00' | '16:00';
  service_type: string;
  package_tier: 'basic' | 'premium' | 'elite';
  est_duration_hrs: number;
  advance_amount: number;
  advance_mode?: string | null;
  assigned_staff?: number[] | null;
  status: 'scheduled' | 'cancelled' | 'converted';
  notes?: string | null;
  created_by: number;
  customer_name?: string;
  customer_phone?: string;
  vehicle_name?: string;
  reg_number?: string;
  created_at: string;
}

export interface SlotInfo { slot: string; booked: boolean; }

interface BookingFilters {
  status?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const bookingsAPI = {
  list: async (filters: BookingFilters = {}): Promise<ApiResponse<Booking[]>> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '' && v !== null) params.append(k, String(v)); });
    const { data } = await apiClient.get(`/bookings?${params.toString()}`);
    return data;
  },

  getById: async (id: number): Promise<ApiResponse<Booking>> => {
    const { data } = await apiClient.get(`/bookings/${id}`);
    return data;
  },

  calendar: async (dateFrom: string, dateTo: string): Promise<ApiResponse<Booking[]>> => {
    const { data } = await apiClient.get(`/bookings/calendar?date_from=${dateFrom}&date_to=${dateTo}`);
    return data;
  },

  slots: async (date: string): Promise<ApiResponse<SlotInfo[]>> => {
    const { data } = await apiClient.get(`/bookings/slots?date=${date}`);
    return data;
  },

  create: async (payload: Partial<Booking>): Promise<ApiResponse<Booking>> => {
    const { data } = await apiClient.post('/bookings', payload);
    return data;
  },

  update: async (id: number, payload: Partial<Booking>): Promise<ApiResponse<Booking>> => {
    const { data } = await apiClient.put(`/bookings/${id}`, payload);
    return data;
  },

  delete: async (id: number): Promise<ApiResponse<{ message: string }>> => {
    const { data } = await apiClient.delete(`/bookings/${id}`);
    return data;
  },

  convertToJob: async (id: number, payload?: { insurance_company?: string; insurance_expiry?: string; concerns?: string[] }): Promise<ApiResponse<any>> => {
    const { data } = await apiClient.post(`/bookings/${id}/convert-to-job`, payload);
    return data;
  },

  reschedule: async (id: number, payload: { booking_date: string; time_slot: string }): Promise<ApiResponse<any>> => {
    const { data } = await apiClient.put(`/bookings/${id}/reschedule`, payload);
    return data;
  },

  cancel: async (id: number, payload: { cancel_reason: string }): Promise<ApiResponse<any>> => {
    const { data } = await apiClient.put(`/bookings/${id}/cancel`, payload);
    return data;
  },
};

