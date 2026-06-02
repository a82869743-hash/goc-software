import { z } from 'zod';

export const createInventoryItemSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(['ppf_roll', 'ceramic', 'primer', 'car_care', 'consumable']),
  brand: z.string().max(50).optional().nullable(),
  unit: z.enum(['sqft', 'ml', 'litre', 'units', 'rolls']),
  current_stock: z.number().min(0).default(0),
  min_threshold: z.number().min(0).default(10),
  purchase_price: z.number().min(0).default(0),
  selling_price: z.number().min(0).default(0),
  location: z.string().max(50).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateInventoryItemSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.enum(['ppf_roll', 'ceramic', 'primer', 'car_care', 'consumable']).optional(),
  brand: z.string().max(50).optional().nullable(),
  unit: z.enum(['sqft', 'ml', 'litre', 'units', 'rolls']).optional(),
  current_stock: z.number().min(0).optional(),
  min_threshold: z.number().min(0).optional(),
  purchase_price: z.number().min(0).optional(),
  selling_price: z.number().min(0).optional(),
  location: z.string().max(50).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const inventoryFiltersSchema = z.object({
  category: z.enum(['ppf_roll', 'ceramic', 'primer', 'car_care', 'consumable']).optional(),
  low_stock: z.coerce.boolean().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const logUsageSchema = z.object({
  inventory_item_id: z.number().int().positive(),
  job_card_id: z.number().int().positive().optional().nullable(),
  qty_used: z.number().positive(),
  wastage_qty: z.number().min(0).default(0),
  notes: z.string().max(500).optional().nullable(),
});
