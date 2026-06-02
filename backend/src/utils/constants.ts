/** GOC Studio — Shared Constants */

export const JOB_STATUS = {
  IN_PROGRESS: 'in_progress',
  READY: 'ready',
  ESTIMATE: 'estimate',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  // Keep older statuses for backward compatibility referencing
  SCHEDULED: 'scheduled',
  CAR_IN: 'car_in',
  WASHING: 'washing',
  QC: 'qc',
  REWORK: 'rework',
} as const;

export const JOB_STATUS_FLOW: Record<string, string[]> = {
  in_progress: ['ready', 'cancelled'],
  ready: ['estimate', 'cancelled'],
  estimate: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
  // Keep transitions for older statuses to move them forward or cancel
  scheduled: ['in_progress', 'cancelled'],
  car_in: ['in_progress', 'cancelled'],
  washing: ['in_progress', 'cancelled'],
  qc: ['ready', 'cancelled'],
  rework: ['in_progress', 'cancelled'],
};

export const LEAD_STATUS = {
  NEW: 'new',
  CONTACTED: 'contacted',
  INTERESTED: 'interested',
  QUOTATION_SENT: 'quotation_sent',
  BOOKED: 'booked',
  LOST: 'lost',
} as const;

export const LEAD_STATUS_FLOW: Record<string, string[]> = {
  new: ['contacted', 'lost'],
  contacted: ['interested', 'lost'],
  interested: ['quotation_sent', 'booked', 'lost'],
  quotation_sent: ['booked', 'lost'],
  booked: [],
  lost: [],
};

export const BOOKING_STATUS = {
  SCHEDULED: 'scheduled',
  CANCELLED: 'cancelled',
  CONVERTED: 'converted',
} as const;

export const INVOICE_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
  CANCELLED: 'cancelled',
} as const;

export const PAYMENT_MODES = ['cash', 'upi', 'card', 'bank_transfer', 'cheque'] as const;

export const PAYMENT_TYPES = ['advance', 'milestone', 'final', 'partial', 'refund'] as const;

export const SERVICE_TYPES = ['ppf', 'ceramic', 'polish', 'detailing', 'other'] as const;

export const LEAD_SOURCES = ['facebook', 'instagram', 'whatsapp', 'walkin', 'reference', 'other'] as const;

export const STAFF_ROLES = ['admin', 'technician', 'receptionist', 'manager', 'staff'] as const;

export const TIME_SLOTS = ['09:00', '11:00', '14:00', '16:00'] as const;

export const GST_RATE = 18;
export const CGST_RATE = 9;
export const SGST_RATE = 9;

export const ERROR_CODES = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  SERVER_ERROR: 'SERVER_ERROR',
} as const;
