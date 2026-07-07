import { z } from 'zod';

export const createStaffSchema = z.object({
  full_name: z.string().min(2).max(100),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Valid 10-digit Indian mobile number'),
  email: z.string().email().max(100).optional().nullable(),
  role: z.enum(['admin', 'technician', 'receptionist', 'manager', 'staff', 'hr']),
  salary_type: z.enum(['monthly', 'daily']).default('monthly'),
  salary_amount: z.number().min(0).default(0),
  join_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  password: z.string().min(6).max(50),
});

export const updateStaffSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/).optional(),
  email: z.string().email().max(100).optional().nullable(),
  role: z.enum(['admin', 'technician', 'receptionist', 'manager', 'staff', 'hr']).optional(),
  salary_type: z.enum(['monthly', 'daily']).optional(),
  salary_amount: z.number().min(0).optional(),
  status: z.enum(['active', 'on_leave', 'resigned']).optional(),
});

export const staffFiltersSchema = z.object({
  role: z.enum(['admin', 'technician', 'receptionist', 'manager', 'staff', 'hr']).optional(),
  status: z.enum(['active', 'on_leave', 'resigned']).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const markAttendanceSchema = z.object({
  staff_id: z.number().int().positive(),
  status: z.enum(['present', 'late', 'absent', 'half_day', 'leave']),
  notes: z.string().max(500).optional().nullable(),
  check_in_time: z.string().optional().nullable(),
  check_out_time: z.string().optional().nullable(),
});
