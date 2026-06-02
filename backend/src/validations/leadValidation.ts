import { z } from 'zod';

export const createLeadSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().regex(/^\d{10,15}$/, 'Phone must be 10-15 digits'),
  vehicle_make: z.string().max(50).optional().nullable(),
  vehicle_model: z.string().max(50).optional().nullable(),
  requirement: z.string().max(500).optional().nullable(),
  source: z.enum(['facebook', 'instagram', 'whatsapp', 'walkin', 'reference', 'other']),
  connector_id: z.number().int().positive().optional().nullable(),
  assigned_to: z.number().int().positive().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateLeadSchema = createLeadSchema.partial().extend({
  status: z.enum(['new', 'contacted', 'interested', 'quotation_sent', 'booked', 'lost']).optional(),
  lost_reason: z.string().max(500).optional().nullable(),
}).refine(data => {
  if (data.status === 'lost' && (!data.lost_reason || data.lost_reason.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: "lost_reason is required when status is 'lost'",
  path: ["lost_reason"]
});

export const bulkReassignSchema = z.object({
  lead_ids: z.array(z.number().int().positive()).min(1, 'At least one lead ID must be provided'),
  assigned_to: z.number().int().positive(),
});

export const leadFiltersSchema = z.object({
  status: z.enum(['new', 'contacted', 'interested', 'quotation_sent', 'booked', 'lost']).optional(),
  source: z.enum(['facebook', 'instagram', 'whatsapp', 'walkin', 'reference', 'other']).optional(),
  assigned_to: z.coerce.number().int().positive().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type LeadFiltersInput = z.infer<typeof leadFiltersSchema>;
export type BulkReassignInput = z.infer<typeof bulkReassignSchema>;
