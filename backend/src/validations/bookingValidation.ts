import { z } from 'zod';

export const createBookingSchema = z.object({
  customer_id: z.number().int().positive(),
  vehicle_id: z.number().int().positive(),
  lead_id: z.number().int().positive().optional().nullable(),
  booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format: YYYY-MM-DD'),
  time_slot: z.enum(['09:00', '11:00', '14:00', '16:00']),
  service_type: z.string().min(2).max(100),
  package_tier: z.enum(['basic', 'premium', 'elite']).default('basic'),
  est_duration_hrs: z.number().min(0.5).max(72).default(4),
  advance_amount: z.number().min(0).default(0),
  advance_mode: z.enum(['cash', 'upi', 'card', 'bank_transfer', 'cheque']).optional().nullable(),
  assigned_staff: z.array(z.number().int().positive()).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateBookingSchema = createBookingSchema.partial().extend({
  status: z.enum(['scheduled', 'cancelled', 'converted']).optional(),
});

export const bookingFiltersSchema = z.object({
  status: z.enum(['scheduled', 'cancelled', 'converted']).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
