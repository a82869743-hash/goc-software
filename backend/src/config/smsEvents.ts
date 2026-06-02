/**
 * GOC Studio — SMS Event Keys
 * All 7 events that trigger SMS notifications.
 * These keys map to sms_templates.event_key in the database.
 */
export const SMS_EVENTS = {
  BOOKING_CONFIRMATION: 'BOOKING_CONFIRMATION',
  BOOKING_REMINDER:     'BOOKING_REMINDER',
  JOB_CREATED:          'JOB_CREATED',
  VEHICLE_READY:        'VEHICLE_READY',
  INVOICE_GENERATED:    'INVOICE_GENERATED',
  PAYMENT_RECEIVED:     'PAYMENT_RECEIVED',
  SERVICE_FOLLOWUP_30D: 'SERVICE_FOLLOWUP_30D',
} as const;

export type SmsEventKey = typeof SMS_EVENTS[keyof typeof SMS_EVENTS];

/**
 * Variables expected for each event (for documentation and template building)
 */
export const SMS_EVENT_VARIABLES: Record<SmsEventKey, string[]> = {
  BOOKING_CONFIRMATION: ['customerName', 'bookingDate', 'timeSlot', 'vehicle'],
  BOOKING_REMINDER:     ['customerName', 'bookingDate', 'timeSlot'],
  JOB_CREATED:          ['customerName', 'jobCode', 'vehicle'],
  VEHICLE_READY:        ['customerName', 'jobCode', 'vehicle'],
  INVOICE_GENERATED:    ['customerName', 'invoiceNo', 'amount'],
  PAYMENT_RECEIVED:     ['customerName', 'amount', 'invoiceNo'],
  SERVICE_FOLLOWUP_30D: ['customerName'],
};
