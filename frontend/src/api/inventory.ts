import apiClient from './client';
import type { ApiResponse } from '../types';

export interface InventoryItem {
  id: number;
  item_code: string;
  name: string;
  category: 'ppf_roll' | 'ceramic' | 'primer' | 'car_care' | 'consumable';
  brand?: string | null;
  unit: 'sqft' | 'ml' | 'litre' | 'units' | 'rolls';
  current_stock: number;
  min_threshold: number;
  purchase_price: number;
  selling_price: number;
  location?: string | null;
  is_low_stock?: boolean;
  notes?: string | null;
  usage?: InventoryUsage[];
}

export interface InventoryUsage {
  id: number; qty_used: number; wastage_qty: number; total_deducted: number;
  staff_name?: string; job_code?: string; created_at: string; notes?: string;
}

export interface InventorySummary { categories: { category: string; count: number; value: number }[]; low_stock_count: number; }

export const inventoryAPI = {
  list: async (filters: Record<string, any> = {}): Promise<ApiResponse<InventoryItem[]>> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '' && v !== null) params.append(k, String(v)); });
    const { data } = await apiClient.get(`/inventory?${params.toString()}`);
    return data;
  },
  summary: async (): Promise<ApiResponse<InventorySummary>> => {
    const { data } = await apiClient.get('/inventory/summary');
    return data;
  },
  getById: async (id: number): Promise<ApiResponse<InventoryItem>> => {
    const { data } = await apiClient.get(`/inventory/${id}`);
    return data;
  },
  create: async (payload: any): Promise<ApiResponse<InventoryItem>> => {
    const { data } = await apiClient.post('/inventory', payload);
    return data;
  },
  update: async (id: number, payload: any): Promise<ApiResponse<InventoryItem>> => {
    const { data } = await apiClient.put(`/inventory/${id}`, payload);
    return data;
  },
  delete: async (id: number): Promise<ApiResponse<{ message: string }>> => {
    const { data } = await apiClient.delete(`/inventory/${id}`);
    return data;
  },
  logUsage: async (payload: any): Promise<ApiResponse<InventoryItem>> => {
    const { data } = await apiClient.post('/inventory/usage', payload);
    return data;
  },
  reorderSuggestions: async (): Promise<ApiResponse<any[]>> => {
    const { data } = await apiClient.get('/inventory/reorder-suggestions');
    return data;
  },
  purchases: async (itemId?: number): Promise<ApiResponse<any[]>> => {
    const url = itemId ? `/inventory/purchases?item_id=${itemId}` : '/inventory/purchases';
    const { data } = await apiClient.get(url);
    return data;
  },
  recordPurchase: async (payload: any): Promise<ApiResponse<InventoryItem>> => {
    const { data } = await apiClient.post('/inventory/purchase', payload);
    return data;
  },
};

