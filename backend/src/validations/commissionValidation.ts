import { z } from 'zod';

export const updateCommissionStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'paid']),
  payment_mode: z.enum(['cash', 'upi', 'card', 'bank_transfer', 'cheque']).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

export const commissionFiltersSchema = z.object({
  status: z.enum(['pending', 'approved', 'paid']).optional(),
  connector_id: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
