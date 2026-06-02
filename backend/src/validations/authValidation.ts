import { z } from 'zod';

export const loginSchema = z.object({
  phone: z.string()
    .min(3, 'ID must be at least 3 characters')
    .max(15, 'ID cannot exceed 15 characters'),
  password: z.string()
    .min(1, 'Password is required')
    .max(100, 'Password is too long'),
});

export type LoginInput = z.infer<typeof loginSchema>;
