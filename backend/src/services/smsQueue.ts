/**
 * GOC Studio — SMS Queue Service
 * Adds SMS jobs to the queue. Never sends directly.
 * All controllers/events call queueSMS() — never send SMS inline.
 */
import pool from '../utils/db';
import { ResultSetHeader } from 'mysql2';
import { SmsEventKey } from '../config/smsEvents';

interface QueueSMSInput {
  phone: string;
  eventKey: SmsEventKey;
  payload: Record<string, any>;
}

/**
 * Normalize Indian mobile number to 10-digit format
 */
export function normalizeMobile(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('91') && cleaned.length === 12) return cleaned.slice(2);
  if (cleaned.startsWith('0') && cleaned.length === 11) return cleaned.slice(1);
  return cleaned.slice(-10);
}

/**
 * Add an SMS job to the queue
 * This is the ONLY function controllers/event services should call.
 */
export async function queueSMS(input: QueueSMSInput): Promise<void> {
  try {
    const mobile = normalizeMobile(input.phone);
    if (!mobile || mobile.length !== 10) {
      console.warn(`[SMS Queue] Invalid mobile number skipped: "${input.phone}" (event: ${input.eventKey})`);
      return;
    }

    await pool.query<ResultSetHeader>(
      `INSERT INTO sms_queue (mobile, event_key, payload, status, attempts)
       VALUES (?, ?, ?, 'pending', 0)`,
      [mobile, input.eventKey, JSON.stringify(input.payload)]
    );

    console.log(`[SMS Queue] Queued: ${input.eventKey} → ${mobile}`);
  } catch (error) {
    // Never crash the caller — just log
    console.error('[SMS Queue] Failed to queue SMS:', error);
  }
}
