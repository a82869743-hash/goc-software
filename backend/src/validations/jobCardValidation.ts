import { z } from 'zod';

const JOB_STATUSES = ['scheduled', 'car_in', 'washing', 'in_progress', 'qc', 'rework', 'ready', 'delivered', 'cancelled', 'estimate'] as const;
const JOB_TYPES = ['booked', 'walkin', 'quick'] as const;
const SERVICE_TYPES = ['ppf', 'ceramic', 'polish', 'detailing', 'other'] as const;

export const createJobCardSchema = z.object({
  booking_id: z.coerce.number().int().positive().optional().nullable(),
  advance_booking_id: z.coerce.number().int().positive().optional().nullable(),
  advance_amount: z.coerce.number().min(0).optional().nullable(),
  advance_payment_mode: z.string().optional().nullable(),
  advance_payment_ref: z.string().optional().nullable(),
  customer_id: z.coerce.number().int().positive(),
  vehicle_id: z.coerce.number().int().positive(),
  job_type: z.enum(JOB_TYPES).default('walkin'),
  expected_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  assigned_staff: z.array(z.coerce.number().int().positive()).optional(),
  internal_notes: z.string().max(2000).optional().nullable(),
  services: z.array(
    z.object({
      service_name: z.string().min(1).max(100),
      service_type: z.enum(SERVICE_TYPES).default('other'),
      package_tier: z.enum(['basic', 'premium', 'elite']).default('basic'),
      description: z.string().max(500).optional().nullable(),
      sqft_used: z.coerce.number().min(0).default(0),
      ml_used: z.coerce.number().min(0).default(0),
      unit_price: z.coerce.number().min(0),
      quantity: z.coerce.number().min(0.01).default(1),
      tax_pct: z.coerce.number().min(0).max(100).default(18),
      item_type: z.string().optional().default('labor'),
      inventory_item_id: z.coerce.number().int().positive().optional().nullable(),
    })
  ).optional(),
});

export const updateJobCardSchema = z.object({
  expected_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  assigned_staff: z.array(z.number().int().positive()).optional(),
  qc_notes: z.string().max(2000).optional().nullable(),
  delivery_notes: z.string().max(2000).optional().nullable(),
  internal_notes: z.string().max(2000).optional().nullable(),
  km_reading: z.coerce.number().min(0).optional().nullable(),
  insurance_company: z.string().optional().nullable(),
  insurance_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.string().length(0)).optional().nullable(),
  customer_name: z.string().min(1).optional(),
  customer_phone: z.string().min(1).optional(),
  vehicle_make: z.string().optional(),
  vehicle_model: z.string().optional(),
  reg_number: z.string().optional(),
  vehicle_color: z.string().optional().nullable(),
  vehicle_fuel_type: z.string().optional(),
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
  sqft_used: z.coerce.number().min(0).default(0),
  ml_used: z.coerce.number().min(0).default(0),
  unit_price: z.coerce.number().min(0),
  quantity: z.coerce.number().min(0.01).default(1),
  tax_pct: z.coerce.number().min(0).max(100).default(18),
  item_type: z.string().optional().default('labor'),
  inventory_item_id: z.coerce.number().int().positive().optional().nullable(),
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
