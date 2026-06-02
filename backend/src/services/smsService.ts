/**
 * GOC Studio — SMS Service (MSG91 Integration)
 * Reads from sms_queue, looks up flow_id from sms_templates,
 * calls MSG91 Flow API, logs result in sms_logs.
 *
 * Called by the SMS cron worker every minute.
 * NEVER called directly by controllers.
 */
import axios from 'axios';
import pool from '../utils/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const MSG91_FLOW_URL = 'https://control.msg91.com/api/v5/flow';

/**
 * Get a setting value from app_settings table
 */
async function getSetting(key: string): Promise<string> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
    [key]
  );
  return rows.length > 0 ? (rows[0].setting_value || '') : '';
}

/**
 * Process one pending SMS from the queue
 */
async function processOneSMS(queueRow: RowDataPacket): Promise<void> {
  const logData: {
    mobile: string;
    event_key: string;
    request_payload: any;
    response_payload: any;
    status: string;
    error_message: string | null;
    msg91_request_id: string | null;
  } = {
    mobile: queueRow.mobile,
    event_key: queueRow.event_key,
    request_payload: null,
    response_payload: null,
    status: 'failed',
    error_message: null,
    msg91_request_id: null,
  };

  try {
    // Mark as processing
    await pool.query(
      `UPDATE sms_queue SET status = 'processing', attempts = attempts + 1, last_attempt = NOW() WHERE id = ?`,
      [queueRow.id]
    );

    // Check SMS enabled
    const smsEnabled = await getSetting('SMS_ENABLED');
    if (smsEnabled !== 'true') {
      console.log(`[SMS Service] SMS_ENABLED=false — mock sent for ${queueRow.event_key} → ${queueRow.mobile}`);
      await pool.query(`UPDATE sms_queue SET status = 'sent' WHERE id = ?`, [queueRow.id]);
      logData.status = 'mock_sent';
      logData.response_payload = { mock: true, message: 'SMS_ENABLED is false — logged only' };
      await insertSMSLog(logData);
      return;
    }

    // Get credentials
    const authKey = await getSetting('MSG91_SMS_AUTH_KEY');
    if (!authKey) {
      throw new Error('MSG91_SMS_AUTH_KEY not configured in settings.');
    }

    // Get template flow ID
    const [tmplRows] = await pool.query<RowDataPacket[]>(
      'SELECT msg91_flow_id, dlt_template_id, is_active FROM sms_templates WHERE event_key = ? LIMIT 1',
      [queueRow.event_key]
    );

    if (tmplRows.length === 0 || !tmplRows[0].is_active) {
      console.warn(`[SMS Service] Template not found or inactive: ${queueRow.event_key}`);
      await pool.query(`UPDATE sms_queue SET status = 'failed', error_msg = ? WHERE id = ?`,
        ['Template not found or inactive', queueRow.id]);
      return;
    }

    const flowId = tmplRows[0].msg91_flow_id;
    if (!flowId) {
      // Flow ID not yet configured — happens before DLT. Queue silently skipped.
      console.warn(`[SMS Service] Flow ID not set for ${queueRow.event_key} — skipping (DLT pending)`);
      await pool.query(`UPDATE sms_queue SET status = 'failed', error_msg = ? WHERE id = ?`,
        ['MSG91 Flow ID not configured. Awaiting DLT approval.', queueRow.id]);
      logData.status = 'skipped_no_flow_id';
      logData.error_message = 'MSG91 Flow ID not configured. Awaiting DLT approval.';
      await insertSMSLog(logData);
      return;
    }

    const senderId = await getSetting('MSG91_SENDER_ID') || 'GOCER';
    const countryCode = await getSetting('MSG91_COUNTRY_CODE') || '91';
    const payload = typeof queueRow.payload === 'string' ? JSON.parse(queueRow.payload) : queueRow.payload;

    // Build MSG91 Flow API request
    const requestBody = {
      flow_id: flowId,
      sender: senderId,
      mobiles: `${countryCode}${queueRow.mobile}`,
      ...payload, // spread variables — MSG91 Flow API uses flat object for variables
    };

    logData.request_payload = requestBody;

    const response = await axios.post(MSG91_FLOW_URL, requestBody, {
      headers: {
        authkey: authKey,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    logData.response_payload = response.data;

    if (response.data?.type === 'success' || response.status === 200) {
      logData.status = 'sent';
      logData.msg91_request_id = response.data?.request_id || null;
      await pool.query(`UPDATE sms_queue SET status = 'sent' WHERE id = ?`, [queueRow.id]);
      console.log(`[SMS Service] ✅ Sent: ${queueRow.event_key} → ${queueRow.mobile}`);
    } else {
      throw new Error(response.data?.message || 'MSG91 returned non-success response');
    }
  } catch (error: any) {
    const errMsg = error?.response?.data?.message || error?.message || 'Unknown error';
    logData.status = 'failed';
    logData.error_message = errMsg;

    // If 3+ attempts, mark as permanently failed
    const newStatus = (queueRow.attempts + 1) >= 3 ? 'failed' : 'pending';
    await pool.query(
      `UPDATE sms_queue SET status = ?, error_msg = ? WHERE id = ?`,
      [newStatus, errMsg, queueRow.id]
    );

    console.error(`[SMS Service] ❌ Failed: ${queueRow.event_key} → ${queueRow.mobile}: ${errMsg}`);
  } finally {
    await insertSMSLog(logData);
  }
}

/**
 * Insert a log record
 */
async function insertSMSLog(data: {
  mobile: string;
  event_key: string;
  msg91_request_id: string | null;
  request_payload: any;
  response_payload: any;
  status: string;
  error_message: string | null;
}): Promise<void> {
  try {
    await pool.query<ResultSetHeader>(
      `INSERT INTO sms_logs (mobile, event_key, msg91_request_id, request_payload, response_payload, status, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.mobile,
        data.event_key,
        data.msg91_request_id,
        data.request_payload ? JSON.stringify(data.request_payload) : null,
        data.response_payload ? JSON.stringify(data.response_payload) : null,
        data.status,
        data.error_message || null,
      ]
    );
  } catch (err) {
    console.error('[SMS Service] Failed to insert SMS log:', err);
  }
}

/**
 * Process all pending SMS queue items (called by cron every minute)
 */
export async function processPendingSMS(): Promise<void> {
  try {
    const [pending] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM sms_queue
       WHERE status = 'pending'
         AND attempts < 3
       ORDER BY created_at ASC
       LIMIT 10`
    );

    if (pending.length === 0) return;

    console.log(`[SMS Service] Processing ${pending.length} queued SMS...`);
    for (const row of pending) {
      await processOneSMS(row);
    }
  } catch (error) {
    console.error('[SMS Service] processPendingSMS error:', error);
  }
}

/**
 * Get SMS queue stats (for admin UI)
 */
export async function getSMSQueueStats(): Promise<{
  pending: number;
  sent: number;
  failed: number;
  total_today: number;
}> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending,
       COALESCE(SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END), 0) as sent,
       COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) as failed,
       COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END), 0) as total_today
     FROM sms_queue`
  );
  const r = rows[0] || {};
  return {
    pending: Number(r.pending) || 0,
    sent: Number(r.sent) || 0,
    failed: Number(r.failed) || 0,
    total_today: Number(r.total_today) || 0,
  };
}
