import axios from 'axios';
import pool from '../utils/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

/**
 * GOC Studio — WhatsApp Service (MSG91 Integration)
 * Sends WhatsApp messages via MSG91 API and logs all attempts.
 */

const MSG91_BASE_URL = 'https://control.msg91.com/api/v5';

interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a WhatsApp message via MSG91
 */
export async function sendWhatsApp(
  phone: string,
  templateName: string,
  variables: Record<string, string>,
  options?: {
    customerId?: number;
    triggeredBy?: number;
    messageBody?: string;
  }
): Promise<WhatsAppResult> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const sender = process.env.MSG91_WHATSAPP_SENDER;

  // Log the attempt in DB first
  const [logResult] = await pool.query<ResultSetHeader>(
    `INSERT INTO whatsapp_logs (customer_id, phone, template_name, message_body, variables, status, triggered_by)
     VALUES (?, ?, ?, ?, ?, 'queued', ?)`,
    [
      options?.customerId || null,
      phone,
      templateName,
      options?.messageBody || `Template: ${templateName}`,
      JSON.stringify(variables),
      options?.triggeredBy || null,
    ]
  );
  const logId = logResult.insertId;

  // If MSG91 not configured, mark as failed gracefully
  if (!authKey || !sender) {
    console.warn('⚠️ MSG91 not configured. WhatsApp message logged but not sent.');
    await pool.query(
      'UPDATE whatsapp_logs SET status = ?, error_message = ? WHERE id = ?',
      ['failed', 'MSG91 API keys not configured', logId]
    );
    return { success: false, error: 'MSG91 not configured' };
  }

  try {
    // Normalize phone number
    const normalizedPhone = phone.replace(/[^0-9]/g, '').replace(/^0+/, '');
    const fullPhone = normalizedPhone.startsWith('91') ? normalizedPhone : `91${normalizedPhone}`;

    const payload = {
      integrated_number: sender,
      content_type: 'template',
      payload: {
        messaging_product: 'whatsapp',
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en', policy: 'deterministic' },
          namespace: process.env.MSG91_TEMPLATE_NAMESPACE || '',
          to_and_components: [
            {
              to: [fullPhone],
              components: {
                body: Object.entries(variables).map(([, value], index) => ({
                  type: 'text',
                  value,
                  index: index + 1,
                })),
              },
            },
          ],
        },
      },
    };

    const response = await axios.post(`${MSG91_BASE_URL}/whatsapp/whatsapp/template/msg`, payload, {
      headers: {
        authkey: authKey,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    const messageId = response.data?.data?.request_id || response.data?.request_id || '';

    await pool.query(
      'UPDATE whatsapp_logs SET status = ?, msg91_message_id = ? WHERE id = ?',
      ['sent', messageId, logId]
    );

    return { success: true, messageId };
  } catch (error: any) {
    const errMsg = error?.response?.data?.message || error.message || 'Unknown error';
    await pool.query(
      'UPDATE whatsapp_logs SET status = ?, error_message = ? WHERE id = ?',
      ['failed', errMsg, logId]
    );
    console.error('WhatsApp send error:', errMsg);
    return { success: false, error: errMsg };
  }
}

/**
 * Send a quick manual WhatsApp message (non-template, plain text concept)
 * MSG91 requires templates, so we send a predefined "quick_message" template.
 */
export async function sendQuickWhatsApp(
  phone: string,
  message: string,
  triggeredBy?: number
): Promise<WhatsAppResult> {
  return sendWhatsApp(phone, 'quick_message', { message }, {
    triggeredBy,
    messageBody: message,
  });
}

/**
 * Predefined template senders
 */
export const WhatsAppTemplates = {
  // Lead welcome
  leadWelcome: async (phone: string, name: string, triggeredBy?: number) =>
    sendWhatsApp(phone, 'lead_welcome', { name }, {
      triggeredBy,
      messageBody: `Welcome ${name}! Thank you for your interest in God of Ceramic.`,
    }),

  // Quotation sent
  quotationSent: async (phone: string, name: string, quotationCode: string, total: string, triggeredBy?: number) =>
    sendWhatsApp(phone, 'quotation_sent', { name, quotation_code: quotationCode, total }, {
      triggeredBy,
      messageBody: `Dear ${name}, your quotation ${quotationCode} for ₹${total} has been sent.`,
    }),

  // Booking confirmation
  bookingConfirmed: async (phone: string, name: string, date: string, time: string, triggeredBy?: number) =>
    sendWhatsApp(phone, 'booking_confirmed', { name, date, time }, {
      triggeredBy,
      messageBody: `Dear ${name}, your booking is confirmed for ${date} at ${time}.`,
    }),

  // Car ready for delivery
  carReady: async (phone: string, name: string, vehicle: string, triggeredBy?: number) =>
    sendWhatsApp(phone, 'car_ready', { name, vehicle }, {
      triggeredBy,
      messageBody: `Dear ${name}, your ${vehicle} is ready for pickup!`,
    }),

  // Birthday wish
  birthdayWish: async (phone: string, name: string) =>
    sendWhatsApp(phone, 'birthday_wish', { name }, {
      messageBody: `Happy Birthday ${name}! Wishing you a wonderful day from God of Ceramic.`,
    }),

  // Follow-up (1 day / 3 day)
  leadFollowUp: async (phone: string, name: string, dayCount: string) =>
    sendWhatsApp(phone, 'lead_followup', { name, days: dayCount }, {
      messageBody: `Hi ${name}, following up on your inquiry at God of Ceramic. We'd love to help!`,
    }),

  // Invoice sent
  invoiceSent: async (phone: string, name: string, invoiceCode: string, total: string, triggeredBy?: number) =>
    sendWhatsApp(phone, 'invoice_sent', { name, invoice_code: invoiceCode, total }, {
      triggeredBy,
      messageBody: `Dear ${name}, your invoice ${invoiceCode} for ₹${total} has been generated.`,
    }),
};

/**
 * Get all customers with birthdays today
 */
export async function getTodayBirthdays(): Promise<RowDataPacket[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, full_name, phone, dob FROM customers
     WHERE dob IS NOT NULL
       AND DATE_FORMAT(dob, '%m-%d') = DATE_FORMAT(CURDATE(), '%m-%d')
       AND deleted_at IS NULL
       AND status != 'inactive'`
  );
  return rows;
}

/**
 * Get leads requiring follow-up (created N days ago, still in 'new' or 'contacted')
 */
export async function getLeadsForFollowUp(daysAgo: number): Promise<RowDataPacket[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, full_name, phone, status FROM leads
     WHERE status IN ('new', 'contacted')
       AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL ? DAY)
       AND deleted_at IS NULL`,
    [daysAgo]
  );
  return rows;
}
