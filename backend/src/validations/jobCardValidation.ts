import { z } from 'zod';

const JOB_STATUSES = ['scheduled', 'car_in', 'washing', 'in_progress', 'qc', 'rework', 'ready', 'delivered', 'cancelled', 'estimate'] as const;
const JOB_TYPES = ['booked', 'walkin', 'quick'] as const;
const SERVICE_TYPES = ['ppf', 'ceramic', 'polish', 'detailing', 'other'] as const;

export const createJobCardSchema = z.object({
  booking_id: z.number().int().positive().optional().nullable(),
  customer_id: z.number().int().positive(),
  vehicle_id: z.number().int().positive(),
  job_type: z.enum(JOB_TYPES).default('walkin'),
  expected_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  assigned_staff: z.array(z.number().int().positive()).optional(),
  internal_notes: z.string().max(2000).optional().nullable(),
});

export const updateJobCardSchema = z.object({
  expected_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  assigned_staff: z.array(z.number().int().positive()).optional(),
  qc_notes: z.string().max(2000).optional().nullable(),
  delivery_notes: z.string().max(2000).optional().nullable(),
  internal_notes: z.string().max(2000).optional().nullable(),
});

export const updateJobStatusSchema = z.object({
  new_status: z.enum(JOB_STATUSES),
  notes: z.string().max(1000).optional(),
});

export const addJobServiceSchema = z.object({
  service_name: z.string().min(1).max(100),
  service_type: z.enum(SERVICE_TYPES).default('other'),
  package_tier: z.enum(['basic', 'premium', 'elite']).default('basic'),
  description: z.string().max(500).optional().nullable(),
  sqft_used: z.number().min(0).default(0),
  ml_used: z.number().min(0).default(0),
  unit_price: z.number().min(0),
  quantity: z.number().min(0.01).default(1),
  tax_pct: z.number().min(0).max(100).default(18),
  item_type: z.string().optional().default('labor'),
});

export const jobFiltersSchema = z.object({
  status: z.enum(JOB_STATUSES).optional(),
  job_type: z.enum(JOB_TYPES).optional(),
  search: z.string().max(100).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
