import { z } from 'zod';

export const createCustomerSchema = z.object({
  full_name: z.string().min(2).max(100),
  phone: z.string().regex(/^\d{10,15}$/, 'Phone must be 10-15 digits'),
  alt_phone: z.string().regex(/^\d{10,15}$/).optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(50).default('Vadodara'),
  lead_source: z.enum(['facebook', 'instagram', 'whatsapp', 'walkin', 'reference', 'other']).default('walkin'),
  connector_id: z.number().int().positive().optional().nullable(),
  dob: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  status: z.enum(['active', 'inactive', 'vip']).optional(),
});

export const customerFiltersSchema = z.object({
  status: z.enum(['active', 'inactive', 'vip']).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createVehicleSchema = z.object({
  customer_id: z.number().int().positive(),
  make: z.string().min(1).max(50),
  model: z.string().min(1).max(50),
  year: z.number().int().min(1990).max(2030),
  fuel_type: z.enum(['petrol', 'diesel', 'electric', 'cng', 'hybrid']).default('petrol'),
  color: z.string().max(30).optional().nullable(),
  reg_number: z.string().max(20).optional().nullable(),
  vin: z.string().max(30).optional().nullable(),
  is_primary: z.boolean().default(false),
  notes: z.string().max(500).optional().nullable(),
});

export const updateVehicleSchema = createVehicleSchema.partial().omit({ customer_id: true });
