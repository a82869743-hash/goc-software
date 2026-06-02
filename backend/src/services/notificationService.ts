import pool from '../utils/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

/**
 * GOC Studio — Notification Service
 * Helpers to create and manage in-app notifications.
 */

interface CreateNotificationInput {
  staffId: number;
  type: string;
  title: string;
  body?: string;
  referenceType?: string;
  referenceId?: number;
}

/**
 * Create a new notification for a staff member
 */
export async function createNotification(input: CreateNotificationInput): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO notifications (staff_id, type, title, body, reference_type, reference_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.staffId, input.type, input.title, input.body || null, input.referenceType || null, input.referenceId || null]
  );
  return result.insertId;
}

/**
 * Notify all staff with specific roles
 */
export async function notifyByRole(
  roles: string[],
  type: string,
  title: string,
  body?: string,
  referenceType?: string,
  referenceId?: number
): Promise<void> {
  const placeholders = roles.map(() => '?').join(',');
  const [staff] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM staff WHERE role IN (${placeholders}) AND status = 'active' AND deleted_at IS NULL`,
    roles
  );

  for (const s of staff) {
    await createNotification({
      staffId: s.id,
      type,
      title,
      body,
      referenceType,
      referenceId,
    });
  }
}

/**
 * Predefined notification triggers
 */
export const NotificationTriggers = {
  newLead: async (leadId: number, leadName: string) => {
    await notifyByRole(
      ['admin', 'manager', 'receptionist'],
      'new_lead',
      `🔔 New Lead: ${leadName}`,
      `A new lead "${leadName}" has been added to the pipeline.`,
      'lead',
      leadId
    );
  },

  leadAssigned: async (staffId: number, leadName: string, leadId: number) => {
    await createNotification({
      staffId,
      type: 'lead_assigned',
      title: `📋 Lead Assigned: ${leadName}`,
      body: `You have been assigned a new lead: ${leadName}`,
      referenceType: 'lead',
      referenceId: leadId,
    });
  },

  jobStatusChanged: async (jobId: number, jobCode: string, newStatus: string) => {
    await notifyByRole(
      ['admin', 'manager'],
      'job_status',
      `🔧 Job ${jobCode} → ${newStatus.replace('_', ' ').toUpperCase()}`,
      `Job card ${jobCode} status changed to ${newStatus}.`,
      'job_card',
      jobId
    );
  },

  customerArrived: async (customerName: string, jobId: number, jobCode: string) => {
    await notifyByRole(
      ['admin', 'manager', 'technician'],
      'customer_arrived',
      `🚗 Customer Arrived: ${customerName}`,
      `${customerName} has arrived for job ${jobCode}.`,
      'job_card',
      jobId
    );
  },

  lowStockAlert: async (itemName: string, currentStock: number, threshold: number) => {
    await notifyByRole(
      ['admin', 'manager'],
      'low_stock',
      `⚠️ Low Stock: ${itemName}`,
      `${itemName} is low on stock (${currentStock}/${threshold}).`,
      'inventory'
    );
  },

  paymentReceived: async (jobCode: string, amount: number, customerName: string, jobId: number) => {
    await notifyByRole(
      ['admin', 'manager'],
      'payment_received',
      `💰 Payment: ₹${amount.toLocaleString('en-IN')} from ${customerName}`,
      `Payment of ₹${amount.toLocaleString('en-IN')} received for job ${jobCode}.`,
      'job_card',
      jobId
    );
  },

  bookingCreated: async (bookingId: number, customerName: string, date: string) => {
    await notifyByRole(
      ['admin', 'manager'],
      'new_booking',
      `📅 New Booking: ${customerName}`,
      `${customerName} booked for ${date}.`,
      'booking',
      bookingId
    );
  },
};
