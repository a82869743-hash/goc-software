import apiClient from './client';
import type { ApiResponse, Customer, Vehicle } from '../types';


interface CustomerFilters {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const customersAPI = {
  list: async (filters: CustomerFilters = {}): Promise<ApiResponse<Customer[]>> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '' && v !== null) params.append(k, String(v)); });
    const { data } = await apiClient.get(`/customers?${params.toString()}`);
    return data;
  },

  getById: async (id: number): Promise<ApiResponse<Customer & { vehicles: Vehicle[] }>> => {
    const { data } = await apiClient.get(`/customers/${id}`);
    return data;
  },

  create: async (payload: Partial<Customer>): Promise<ApiResponse<Customer>> => {
    const { data } = await apiClient.post('/customers', payload);
    return data;
  },

  update: async (id: number, payload: Partial<Customer>): Promise<ApiResponse<Customer>> => {
    const { data } = await apiClient.put(`/customers/${id}`, payload);
    return data;
  },

  delete: async (id: number): Promise<ApiResponse<{ message: string }>> => {
    const { data } = await apiClient.delete(`/customers/${id}`);
    return data;
  },

  search: async (q: string): Promise<ApiResponse<any[]>> => {
    const { data } = await apiClient.get(`/customers/search?q=${encodeURIComponent(q)}`);
    return data;
  },
};

export const vehiclesAPI = {
  list: async (customerId: number): Promise<ApiResponse<Vehicle[]>> => {
    const { data } = await apiClient.get(`/vehicles?customer_id=${customerId}`);
    return data;
  },

  create: async (payload: Partial<Vehicle> & { customer_id: number }): Promise<ApiResponse<Vehicle>> => {
    const { data } = await apiClient.post('/vehicles', payload);
    return data;
  },

  update: async (id: number, payload: Partial<Vehicle>): Promise<ApiResponse<Vehicle>> => {
    const { data } = await apiClient.put(`/vehicles/${id}`, payload);
    return data;
  },

  delete: async (id: number): Promise<ApiResponse<{ message: string }>> => {
    const { data } = await apiClient.delete(`/vehicles/${id}`);
    return data;
  },

  getHistory: async (id: number): Promise<ApiResponse<any[]>> => {
    const { data } = await apiClient.get(`/vehicles/${id}/history`);
    return data;
  },
};

