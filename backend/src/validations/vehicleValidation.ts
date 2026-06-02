import { z } from 'zod';

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
