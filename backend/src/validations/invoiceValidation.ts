import { z } from 'zod';

const invoiceItemSchema = z.object({
  description: z.string().min(1).max(200),
  hsn_sac: z.string().max(20).default('998714'),
  qty: z.number().min(0.01).default(1),
  unit: z.string().max(20).default('job'),
  rate: z.number().min(0),
});

export const createInvoiceSchema = z.object({
  job_card_id: z.number().int().positive(),
  customer_id: z.number().int().positive(),
  invoice_type: z.enum(['estimate', 'proforma', 'tax_invoice']).default('tax_invoice'),
  items: z.array(invoiceItemSchema).min(1, 'At least one item required'),
  discount_amount: z.number().min(0).default(0),
  apply_gst: z.boolean().default(true),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  customer_gstin: z.string().max(20).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateInvoiceSchema = z.object({
  status: z.enum(['draft', 'sent', 'partially_paid', 'paid', 'cancelled']).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

export const invoiceFiltersSchema = z.object({
  status: z.enum(['draft', 'sent', 'partially_paid', 'paid', 'cancelled']).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
