/**
 * GOC Studio — Utility Functions
 */

/**
 * Format currency in Indian Rupee notation (₹1,23,456)
 */
export const formatINR = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format date to DD MMM YYYY (e.g., 15 Apr 2026)
 */
export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Format date-time to DD MMM YYYY, HH:mm
 */
export const formatDateTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Format time to 12-hour format (e.g., 2:30 PM)
 */
export const formatTime = (timeStr: string): string => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`;
};

/**
 * Status label & color mapping for display
 */
export const getStatusConfig = (status: string): { label: string; color: string; bg: string } => {
  const configs: Record<string, { label: string; color: string; bg: string }> = {
    // Lead statuses
    new: { label: 'New', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
    contacted: { label: 'Contacted', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
    interested: { label: 'Interested', color: '#F97316', bg: 'rgba(249,115,22,0.15)' },
    quotation_sent: { label: 'Quotation Sent', color: '#A855F7', bg: 'rgba(168,85,247,0.15)' },
    booked: { label: 'Booked', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
    lost: { label: 'Lost', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },

    // Job statuses
    scheduled: { label: 'Scheduled', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
    car_in: { label: 'Car In', color: '#06B6D4', bg: 'rgba(6,182,212,0.15)' },
    washing: { label: 'Washing', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
    in_progress: { label: 'In Progress', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
    qc: { label: 'Quality Check', color: '#A855F7', bg: 'rgba(168,85,247,0.15)' },
    rework: { label: 'Rework', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
    ready: { label: 'Ready', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
    delivered: { label: 'Delivered', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
    cancelled: { label: 'Cancelled', color: '#6B7280', bg: 'rgba(107,114,128,0.15)' },

    // Payment
    paid: { label: 'Paid', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
    partially_paid: { label: 'Partially Paid', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
    draft: { label: 'Draft', color: '#6B7280', bg: 'rgba(107,114,128,0.15)' },
    sent: { label: 'Sent', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
    accepted: { label: 'Accepted', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
    rejected: { label: 'Rejected', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
    expired: { label: 'Expired', color: '#6B7280', bg: 'rgba(107,114,128,0.15)' },

    // Staff
    active: { label: 'Active', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
    inactive: { label: 'Inactive', color: '#6B7280', bg: 'rgba(107,114,128,0.15)' },
    on_leave: { label: 'On Leave', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
    resigned: { label: 'Resigned', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },

    // Attendance
    present: { label: 'Present', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
    late: { label: 'Late', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
    absent: { label: 'Absent', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
    half_day: { label: 'Half Day', color: '#F97316', bg: 'rgba(249,115,22,0.15)' },
    leave: { label: 'Leave', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },

    // Inventory
    available: { label: 'Available', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
    partial: { label: 'Partial', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
    exhausted: { label: 'Exhausted', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },

    // Booking
    confirmed: { label: 'Confirmed', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
    pending: { label: 'Pending', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
    completed: { label: 'Completed', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
    converted: { label: 'Converted', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },

    // VIP
    vip: { label: 'VIP', color: '#FBBF24', bg: 'rgba(251,191,36,0.15)' },
  };

  return configs[status] || { label: status, color: '#6B7280', bg: 'rgba(107,114,128,0.15)' };
};

/**
 * Debounce function for search inputs
 */
export const debounce = <T extends (...args: unknown[]) => unknown>(fn: T, delay: number) => {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
};

/**
 * Calculate GST breakdown
 */
export const calculateGST = (amount: number, gstRate: number = 18) => {
  const halfRate = gstRate / 2;
  const gstAmount = (amount * gstRate) / 100;
  const cgst = (amount * halfRate) / 100;
  const sgst = (amount * halfRate) / 100;
  return {
    subtotal: amount,
    cgst_rate: halfRate,
    cgst_amount: cgst,
    sgst_rate: halfRate,
    sgst_amount: sgst,
    gst_amount: gstAmount,
    total: amount + gstAmount,
  };
};

/**
 * Truncate text with ellipsis
 */
export const truncate = (str: string, maxLen: number = 50): string => {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '…';
};
