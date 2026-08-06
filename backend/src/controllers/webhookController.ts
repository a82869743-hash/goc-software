/**
 * GOC Studio — Webhook Controller
 * Handles Meta (Facebook / Instagram) Lead Ads webhooks, and WhatsApp inbound webhooks.
 *
 * IMPORTANT: Webhook routes are PUBLIC — no auth middleware.
 * Meta must always receive HTTP 200. All processing is async.
 */
import { Request, Response } from 'express';
import axios from 'axios';
import pool from '../utils/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { generateCode } from '../utils/codes';
import { WhatsAppTemplates } from '../services/whatsappService';
import { notifyByRole } from '../services/notificationService';
import {
  fetchMetaLeadFromGraph,
  normalizeMetaLead,
  isFormAllowed,
  getMetaSettings,
} from '../services/metaLeadService';
import { MetaWebhookPayload, NormalizedMetaLead } from '../types/meta';

// ─── Helper: log webhook event ───────────────────────────────────────────
async function logWebhook(data: {
  event_type: string;
  leadgen_id?: string;
  form_id?: string;
  page_id?: string;
  raw_payload?: string;
  processing_status: string;
  created_lead_id?: number | null;
  error_message?: string | null;
}): Promise<number> {
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO webhook_logs
         (source, event_type, leadgen_id, form_id, page_id,
          raw_payload, processing_status, created_lead_id, error_message)
       VALUES ('meta', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.event_type,
        data.leadgen_id || null,
        data.form_id || null,
        data.page_id || null,
        data.raw_payload || null,
        data.processing_status,
        data.created_lead_id || null,
        data.error_message || null,
      ]
    );
    console.log(`[Webhook Log] Created audit log entry #${result.insertId} with status ${data.processing_status}`);
    return result.insertId;
  } catch (err) {
    console.error('[Webhook] Failed to write webhook log:', err);
    return 0;
  }
}

// ─── Helper: update webhook log status ───────────────────────────────────
async function updateWebhookLog(
  logId: number,
  status: string,
  createdLeadId?: number,
  errorMessage?: string,
  fullPayload?: string
): Promise<void> {
  try {
    await pool.query(
      `UPDATE webhook_logs
       SET processing_status = ?, created_lead_id = ?, error_message = ?, raw_payload = COALESCE(?, raw_payload)
       WHERE id = ?`,
      [status, createdLeadId || null, errorMessage || null, fullPayload || null, logId]
    );
    console.log(`[Webhook Log Update] Log entry #${logId} updated to status: ${status} (Lead: ${createdLeadId || 'N/A'})`);
  } catch (err) {
    console.error('[Webhook] Failed to update webhook log:', err);
  }
}

// ──────────────────────────────────────────────────────────────
// HELPERS FOR WHATSAPP INBOUND
// ──────────────────────────────────────────────────────────────
async function getDefaultAssignee(platform: string): Promise<number | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT default_assignee FROM webhook_configs WHERE platform = ? AND is_active = 1',
    [platform]
  );
  return rows.length > 0 ? rows[0].default_assignee : null;
}

async function logWebhookEvent(
  platform: 'facebook' | 'instagram' | 'whatsapp',
  eventId: string | null,
  rawPayload: object
): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO webhook_events (platform, event_id, raw_payload) VALUES (?, ?, ?)`,
    [platform, eventId, JSON.stringify(rawPayload)]
  );
  return result.insertId;
}

async function markWebhookProcessed(eventId: number, leadId: number | null, error?: string): Promise<void> {
  await pool.query(
    `UPDATE webhook_events SET processed = 1, lead_id_created = ?, error_message = ?, processed_at = NOW() WHERE id = ?`,
    [leadId, error || null, eventId]
  );
}

async function updateWebhookStats(platform: string): Promise<void> {
  await pool.query(
    `UPDATE webhook_configs SET last_received = NOW(), total_received = total_received + 1 WHERE platform = ?`,
    [platform]
  );
}

async function createLeadFromWebhook(data: {
  full_name: string;
  phone: string;
  vehicle_make?: string;
  vehicle_model?: string;
  requirement?: string;
  source: 'facebook' | 'instagram' | 'whatsapp';
  fb_lead_id?: string;
  ig_lead_id?: string;
  wa_message_id?: string;
  notes?: string;
  assigned_to?: number | null;
  raw_payload?: object;
}): Promise<{ leadId: number; leadCode: string; isNew: boolean }> {
  
  if (data.fb_lead_id) {
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id, lead_code FROM leads WHERE fb_lead_id = ? AND deleted_at IS NULL LIMIT 1',
      [data.fb_lead_id]
    );
    if (existing.length > 0) {
      return { leadId: existing[0].id, leadCode: existing[0].lead_code, isNew: false };
    }
  }

  if (data.ig_lead_id) {
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id, lead_code FROM leads WHERE ig_lead_id = ? AND deleted_at IS NULL LIMIT 1',
      [data.ig_lead_id]
    );
    if (existing.length > 0) {
      return { leadId: existing[0].id, leadCode: existing[0].lead_code, isNew: false };
    }
  }

  if (data.source === 'whatsapp' && data.phone) {
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id, lead_code FROM leads 
       WHERE phone = ? AND source = 'whatsapp' 
         AND status NOT IN ('booked', 'lost') 
         AND deleted_at IS NULL
         AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
       LIMIT 1`,
      [data.phone]
    );
    if (existing.length > 0) {
      return { leadId: existing[0].id, leadCode: existing[0].lead_code, isNew: false };
    }
  }

  const leadCode = await generateCode('lead');
  
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO leads (
      lead_code, full_name, phone, vehicle_make, vehicle_model, 
      requirement, source, assigned_to, notes,
      fb_lead_id, ig_lead_id, wa_message_id,
      auto_captured, raw_payload, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'new')`,
    [
      leadCode,
      data.full_name,
      data.phone,
      data.vehicle_make || null,
      data.vehicle_model || null,
      data.requirement || null,
      data.source,
      data.assigned_to || null,
      data.notes || `Auto-captured from ${data.source}`,
      data.fb_lead_id || null,
      data.ig_lead_id || null,
      data.wa_message_id || null,
      data.raw_payload ? JSON.stringify(data.raw_payload) : null,
    ]
  );

  const leadId = result.insertId;

  await pool.query(
    `INSERT INTO lead_activity_log (lead_id, staff_id, action, new_value, notes) 
     VALUES (?, NULL, 'auto_captured', 'new', ?)`,
    [leadId, `Auto-captured from ${data.source}`]
  );

  return { leadId, leadCode, isNew: true };
}

// ═══════════════════════════════════════════════════════════════════════
// GET /api/v1/webhooks/meta — Meta Webhook Verification
// ═══════════════════════════════════════════════════════════════════════
export const verifyMetaWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const mode      = req.query['hub.mode'] as string;
    const token     = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    console.log(`[Webhook Verification] Attempted. Mode: ${mode}, Token received: ${token}`);

    const settings = await getMetaSettings();
    const expectedToken = settings?.verifyToken || process.env.META_VERIFY_TOKEN || '';

    if (mode === 'subscribe' && token === expectedToken) {
      console.log('[Webhook Verification] Success. Verification token matched.');
      res.status(200).send(challenge);
      return;
    }

    console.warn(`[Webhook Verification] Failed. Token mismatch. Expected: "${expectedToken}", Received: "${token}"`);
    res.status(403).send('Forbidden');
  } catch (error) {
    console.error('[Webhook Verification] Handshake error:', error);
    res.status(403).send('Error');
  }
};

// ═══════════════════════════════════════════════════════════════════════
// POST /api/v1/webhooks/meta — Receive Meta Lead Events
// ═══════════════════════════════════════════════════════════════════════
export const receiveMetaWebhook = async (req: Request, res: Response): Promise<void> => {
  const timestamp = new Date().toISOString();
  const rawBody = Buffer.isBuffer(req.body) 
    ? req.body.toString('utf8') 
    : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  
  let body: any = null;
  try {
    body = typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? req.body : JSON.parse(rawBody);
  } catch (e) {
    body = req.body;
  }

  console.log(`
==================================================
WEBHOOK RECEIVED
==================================================
Timestamp: ${timestamp}
Headers: ${JSON.stringify(req.headers, null, 2)}
Query Parameters: ${JSON.stringify(req.query, null, 2)}
Request Body: ${JSON.stringify(body, null, 2)}
Raw Body: ${rawBody}
==================================================
`);
  
  // ⚠️ ALWAYS respond 200 immediately — Meta retries if it doesn't get 200
  res.status(200).json({ received: true });

  try {
    processMetaWebhookAsync(req, rawBody, body).catch(err => {
      console.error(`
==================================================
Webhook failed: ${err.message}
Stack Trace:
${err.stack}
==================================================
`);
    });
  } catch (err: any) {
    console.error(`
==================================================
Webhook failed: ${err.message}
Stack Trace:
${err.stack}
==================================================
`);
  }
};

// ═══════════════════════════════════════════════════════════════════════
// GET /api/v1/webhooks/instagram / POST /api/v1/webhooks/instagram
// ═══════════════════════════════════════════════════════════════════════
export const receiveInstagramWebhook = async (req: Request, res: Response): Promise<void> => {
  await receiveMetaWebhook(req, res);
};

// ═══════════════════════════════════════════════════════════════════════
// Async Lead Processing Pipeline
// ═══════════════════════════════════════════════════════════════════════
async function processMetaWebhookAsync(req: Request, rawBody: string, body: MetaWebhookPayload): Promise<void> {
  const fullLogAccumulator: string[] = [];

  const initialLogBlock = `==================================================
WEBHOOK RECEIVED
==================================================
Timestamp: ${new Date().toISOString()}
Headers: ${JSON.stringify(req.headers, null, 2)}
Query Parameters: ${JSON.stringify(req.query, null, 2)}
Request Body: ${JSON.stringify(body, null, 2)}
Raw Body: ${rawBody}
==================================================`;
  fullLogAccumulator.push(initialLogBlock);

  if (!body || body.object !== 'page') {
    console.log('[Webhook Async] Event object is not "page", skipping.');
    return;
  }

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'leadgen') {
        console.log(`[Webhook Async] Skipping non-leadgen field: ${change.field}`);
        continue;
      }

      const value = change.value || {};
      const { leadgen_id, form_id, page_id } = value;

      const verificationBlock = `==================================================
Webhook verification passed
Leadgen ID: ${leadgen_id || 'N/A'}
Page ID: ${page_id || 'N/A'}
Form ID: ${form_id || 'N/A'}
==================================================`;
      console.log(verificationBlock);
      fullLogAccumulator.push(verificationBlock);

      // Log the incoming event immediately
      const logId = await logWebhook({
        event_type: 'leadgen',
        leadgen_id,
        form_id,
        page_id,
        raw_payload: fullLogAccumulator.join('\n\n'),
        processing_status: 'processing',
      });

      try {
        // Check if specific form filter is configured
        const formAllowed = await isFormAllowed(form_id);
        if (!formAllowed) {
          const filterMsg = `[Webhook Async] Form ${form_id} not in allowed list — skipping.`;
          console.log(filterMsg);
          fullLogAccumulator.push(filterMsg);
          await updateWebhookLog(logId, 'skipped_form_filter', undefined, filterMsg, fullLogAccumulator.join('\n\n'));
          continue;
        }

        // Fetch from Meta Graph API
        let graphData: any = null;
        try {
          graphData = await fetchMetaLeadFromGraph(leadgen_id);
        } catch (fetchErr: any) {
          const structErr = fetchErr.structuredError || null;
          let logErrorMsg = fetchErr.message || 'Meta Graph API error';
          
          if (structErr) {
            logErrorMsg = JSON.stringify(structErr);
          }
          
          const failBlock = `==================================================
Webhook failed: ${structErr ? structErr.message : fetchErr.message}
Recommendation: ${structErr ? structErr.recommendation : 'Check Page Access Token and permissions'}
==================================================`;
          console.error(failBlock);
          fullLogAccumulator.push(failBlock);
          await updateWebhookLog(logId, 'failed', undefined, logErrorMsg, fullLogAccumulator.join('\n\n'));
          continue;
        }

        if (!graphData) {
          const failBlock = `==================================================
Webhook failed: Meta Graph API returned null data
==================================================`;
          console.error(failBlock);
          fullLogAccumulator.push(failBlock);
          await updateWebhookLog(logId, 'failed', undefined, 'Meta Graph API returned null data', fullLogAccumulator.join('\n\n'));
          continue;
        }

        // Normalize lead
        const lead = normalizeMetaLead(graphData, value);

        // Duplicate check
        let dupStatus = 'passed';
        const isDuplicate = await checkDuplicateLead(lead.phone, leadgen_id);
        if (isDuplicate) {
          dupStatus = 'duplicate (leadgen_id or phone matched existing record)';
        }

        let dbInsertStatus = 'skipped';
        let newLeadId: number | null = null;

        if (!isDuplicate) {
          newLeadId = await createMetaLeadInCRM(lead);
          dbInsertStatus = newLeadId ? `inserted (Lead ID #${newLeadId})` : 'failed';
        }

        const normBlock = `==================================================
Lead normalized: ${JSON.stringify(lead, null, 2)}
Duplicate check: ${dupStatus}
Database insert: ${dbInsertStatus}
Lead ID: ${newLeadId || 'N/A'}
==================================================`;
        console.log(normBlock);
        fullLogAccumulator.push(normBlock);

        if (isDuplicate) {
          const dupComplete = `==================================================
Webhook completed successfully (Duplicate Skipped)
==================================================`;
          console.log(dupComplete);
          fullLogAccumulator.push(dupComplete);
          await updateWebhookLog(logId, 'duplicate', undefined, undefined, fullLogAccumulator.join('\n\n'));
          continue;
        }

        if (!newLeadId) {
          const insertFail = `==================================================
Webhook failed: Database insertion failed
==================================================`;
          console.error(insertFail);
          fullLogAccumulator.push(insertFail);
          await updateWebhookLog(logId, 'failed', undefined, 'DB insertion failed', fullLogAccumulator.join('\n\n'));
          continue;
        }

        const successBlock = `==================================================
Webhook completed successfully
==================================================`;
        console.log(successBlock);
        fullLogAccumulator.push(successBlock);

        await updateWebhookLog(logId, 'success', newLeadId, undefined, fullLogAccumulator.join('\n\n'));

        // Fire notifications and WhatsApp (non-blocking)
        fireLeadNotifications(lead, newLeadId).catch(err =>
          console.error('[Webhook Async] Notification error:', err)
        );

      } catch (err: any) {
        const errBlock = `==================================================
Webhook failed: ${err?.message || 'Unknown processing error'}
Stack Trace:
${err.stack || 'No stack trace'}
==================================================`;
        console.error(errBlock);
        fullLogAccumulator.push(errBlock);
        await updateWebhookLog(logId, 'failed', undefined, err.message, fullLogAccumulator.join('\n\n'));
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Duplicate Check
// ═══════════════════════════════════════════════════════════════════════
async function checkDuplicateLead(phone: string, leadgenId: string): Promise<boolean> {
  // Check by leadgen_id first (most precise)
  const [byId] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM leads WHERE fb_lead_id = ? AND deleted_at IS NULL LIMIT 1',
    [leadgenId]
  );
  if (byId.length > 0) {
    console.log(`[Duplicate Check] Duplicate by fb_lead_id: ${leadgenId} → lead #${byId[0].id}`);
    await pool.query(
      `INSERT INTO lead_activity_log (lead_id, staff_id, action, notes)
       VALUES (?, NULL, 'meta_duplicate', ?)`,
      [byId[0].id, `Duplicate Meta webhook received. leadgen_id: ${leadgenId}`]
    );
    return true;
  }

  // Check by phone (if phone is valid)
  if (phone && phone.length === 10) {
    const [byPhone] = await pool.query<RowDataPacket[]>(
      'SELECT id, lead_code FROM leads WHERE phone = ? AND deleted_at IS NULL LIMIT 1',
      [phone]
    );
    if (byPhone.length > 0) {
      console.log(`[Duplicate Check] Lead with phone ${phone} already exists — adding activity.`);
      await pool.query(
        `INSERT INTO lead_activity_log (lead_id, staff_id, action, notes)
         VALUES (?, NULL, 'meta_duplicate_phone', ?)`,
        [
          byPhone[0].id,
          `Duplicate Meta lead (same phone). leadgen_id: ${leadgenId}`
        ]
      );
      return true;
    }
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════════════
// Create Lead in CRM
// ═══════════════════════════════════════════════════════════════════════
async function createMetaLeadInCRM(lead: NormalizedMetaLead): Promise<number | null> {
  try {
    const leadCode    = await generateCode('lead');
    const settings = await getMetaSettings();
    const defaultStaff = settings?.autoAssignStaffId || null;

    // Build notes: combine extra fields + campaign info
    const noteParts: string[] = [];
    if (lead.notes) noteParts.push(lead.notes);
    if (lead.campaignName) noteParts.push(`Campaign: ${lead.campaignName}`);
    if (lead.adName) noteParts.push(`Ad: ${lead.adName}`);
    if (lead.email) noteParts.push(`Email: ${lead.email}`);
    if (lead.city) noteParts.push(`City: ${lead.city}`);
    noteParts.push(`Form ID: ${lead.formId}`);
    noteParts.push(`Imported via Meta Lead Form`);
    const combinedNotes = noteParts.join(' | ');

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO leads
         (lead_code, full_name, phone, vehicle_make, vehicle_model,
          requirement, source, assigned_to, notes, fb_lead_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
      [
        leadCode,
        lead.fullName,
        lead.phone || '0000000000', // fallback if phone missing
        lead.vehicleMake || null,
        lead.vehicleModel || null,
        lead.requirement || null,
        lead.source,
        defaultStaff,
        combinedNotes,
        lead.leadgenId,
      ]
    );

    const newLeadId = result.insertId;
    console.log(`[CRM Insert] Created lead #${newLeadId} (${leadCode}) from Meta: ${lead.fullName}`);

    // Lead activity log
    await pool.query(
      `INSERT INTO lead_activity_log (lead_id, staff_id, action, new_value, notes)
       VALUES (?, NULL, 'imported', 'new', ?)`,
      [
        newLeadId,
        JSON.stringify({
          via: 'Meta Lead Form',
          source: lead.source,
          form_id: lead.formId,
          page_id: lead.pageId,
          leadgen_id: lead.leadgenId,
          campaign: lead.campaignName,
          ad: lead.adName,
        })
      ]
    );

    return newLeadId;
  } catch (err: any) {
    console.error('[Webhook] createMetaLeadInCRM error:', err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Fire Notifications and WhatsApp (always non-blocking)
// ═══════════════════════════════════════════════════════════════════════
async function fireLeadNotifications(
  lead: NormalizedMetaLead,
  leadId: number
): Promise<void> {
  const sourceName = lead.source === 'instagram' ? 'Instagram' : 'Facebook';

  // In-app notification to admin/manager
  try {
    await notifyByRole(
      ['admin', 'manager', 'salesman'],
      'new_lead',
      `📱 New ${sourceName} Lead: ${lead.fullName}`,
      `Phone: ${lead.phone || 'N/A'} | Vehicle: ${[lead.vehicleMake, lead.vehicleModel].filter(Boolean).join(' ') || 'N/A'} | ${lead.requirement || 'No requirement specified'}`,
      'lead',
      leadId
    );
    console.log(`[Notification] In-app notification sent for lead #${leadId}`);
  } catch (err) {
    console.error('[Webhook] Notification error (non-blocking):', err);
  }

  // Assigned staff notification
  try {
    const settings = await getMetaSettings();
    if (settings?.autoAssignStaffId) {
      const staffId = settings.autoAssignStaffId;
      const { createNotification } = await import('../services/notificationService');
      await createNotification({
        staffId,
        type: 'lead_assigned',
        title: `📋 Meta Lead Assigned: ${lead.fullName}`,
        body: `A new ${sourceName} lead has been assigned to you. Phone: ${lead.phone || 'N/A'}`,
        referenceType: 'lead',
        referenceId: leadId,
      });
      console.log(`[Notification] Staff alert dispatched to ID: ${staffId}`);
    }
  } catch (err) {
    console.error('[Webhook] Staff assignment notification error:', err);
  }

  // WhatsApp welcome message
  if (lead.phone && lead.phone.length === 10) {
    try {
      await WhatsAppTemplates.leadWelcome(lead.phone, lead.fullName);
      console.log(`[WhatsApp] Welcome message sent successfully to: ${lead.phone}`);
    } catch (err) {
      console.error('[Webhook] WhatsApp error (non-blocking):', err);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// GET /api/v1/webhooks/whatsapp — WhatsApp webhook (MSG91 inbound message)
// ═══════════════════════════════════════════════════════════════════════
export const receiveWhatsAppWebhook = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true });

  try {
    const payload = req.body;

    let fromPhone = payload.from || payload.sender || '';
    let messageId = payload.message_id || payload.id || '';
    let messageText = payload.text?.body || payload.message || payload.text || '';
    let contactName = payload.contact?.name || payload.sender_name || '';
    let messageType = payload.type || 'text';

    if (payload.entry && payload.entry[0]?.changes) {
      const change = payload.entry[0].changes[0];
      const messages = change.value?.messages;
      if (messages && messages.length > 0) {
        const msg = messages[0];
        fromPhone = msg.from || '';
        messageId = msg.id || '';
        messageText = msg.text?.body || '';
        messageType = msg.type || 'text';
        const contacts = change.value?.contacts;
        if (contacts && contacts.length > 0) {
          contactName = contacts[0].profile?.name || '';
        }
      }
    }

    if (!fromPhone) {
      console.log('WhatsApp webhook: no sender phone, skipping');
      return;
    }

    const normalizedPhone = fromPhone.replace(/^91/, '').replace(/\D/g, '').slice(-10);
    if (normalizedPhone.length !== 10) {
      console.log('WhatsApp webhook: invalid phone format:', fromPhone);
      return;
    }

    const eventLogId = await logWebhookEvent('whatsapp', messageId || null, payload);
    await updateWebhookStats('whatsapp');

    const defaultAssignee = await getDefaultAssignee('whatsapp');
    const displayName = contactName || `WhatsApp User`;

    const { leadId, leadCode, isNew } = await createLeadFromWebhook({
      full_name: displayName,
      phone: normalizedPhone,
      source: 'whatsapp',
      wa_message_id: messageId || undefined,
      notes: messageText
        ? `First message: "${messageText.slice(0, 200)}"`
        : 'Customer initiated WhatsApp conversation',
      assigned_to: defaultAssignee,
      raw_payload: payload,
    });

    await markWebhookProcessed(eventLogId, leadId);

    if (isNew) {
      console.log(`✅ WhatsApp lead created: ${leadCode} — ${normalizedPhone}`);

      // Welcome WhatsApp
      try {
        await WhatsAppTemplates.leadWelcome(normalizedPhone, displayName);
      } catch (waErr) {
        console.error('[WhatsApp Webhook] welcome message failed:', waErr);
      }

      await notifyByRole(
        ['admin', 'manager', 'salesman'],
        'new_lead',
        `New WhatsApp Lead: ${displayName}`,
        `Phone: ${normalizedPhone} | Message: "${(messageText || '').slice(0, 80)}" | Lead: ${leadCode}`,
        'lead',
        leadId
      );
    } else {
      if (messageText) {
        await pool.query(
          `UPDATE leads SET updated_at = NOW() WHERE id = ?`,
          [leadId]
        );
        await pool.query(
          `INSERT INTO lead_activity_log (lead_id, staff_id, action, notes) VALUES (?, NULL, 'whatsapp_message', ?)`,
          [leadId, `New WA message: "${messageText.slice(0, 200)}"`]
        );
      }
      console.log(`ℹ️ WhatsApp: existing lead ${leadCode} — activity logged`);
    }

  } catch (error: any) {
    console.error('❌ WhatsApp webhook error:', error);
  }
};

// ═══════════════════════════════════════════════════════════════════════
// GET /api/v1/webhooks/status — Configuration Status Check (PUBLIC)
// ═══════════════════════════════════════════════════════════════════════
export const getWebhookStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [configs] = await pool.query<RowDataPacket[]>(
      'SELECT platform, is_active, last_received, total_received, default_assignee, page_id, verify_token FROM webhook_configs'
    );

    const [recentEvents] = await pool.query<RowDataPacket[]>(
      `SELECT platform, COUNT(*) as count, 
              SUM(CASE WHEN processed = 1 THEN 1 ELSE 0 END) as processed,
              SUM(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END) as errors
       FROM webhook_events 
       WHERE received_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY platform`
    );

    const settings    = await getMetaSettings();
    const token       = settings?.pageAccessToken;
    const verifyToken = settings?.verifyToken;
    const fbEnabled   = settings?.facebookEnabled ? 'true' : 'false';
    const igEnabled   = settings?.instagramEnabled ? 'true' : 'false';
    const appId       = settings?.appId;

    const [recentLogs] = await pool.query<RowDataPacket[]>(
      `SELECT id, event_type, leadgen_id, processing_status, created_lead_id, created_at
       FROM webhook_logs ORDER BY id DESC LIMIT 5`
    );

    const [totalStats] = await pool.query<RowDataPacket[]>(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN processing_status='success' THEN 1 ELSE 0 END) as success,
         SUM(CASE WHEN processing_status='failed' THEN 1 ELSE 0 END) as failed,
         SUM(CASE WHEN processing_status='duplicate' THEN 1 ELSE 0 END) as duplicate
       FROM webhook_logs WHERE source='meta'`
    );

    const webhookConfigured = !!(token && verifyToken);
    const leadSyncEnabled = fbEnabled === 'true' || igEnabled === 'true';
    const verifyTokenConfigured = !!verifyToken;

    res.json({
      success: true,
      webhookConfigured,
      metaWebhookPublic: true,
      leadSyncEnabled,
      verifyTokenConfigured,
      data: {
        configs,
        webhookConfigured,
        pageConnected: !!token,
        facebookLeadSyncEnabled: fbEnabled === 'true',
        instagramLeadSyncEnabled: igEnabled === 'true',
        appIdConfigured: !!appId,
        webhookUrl: '/api/v1/webhooks/meta',
        recentEvents: recentLogs,
        stats: totalStats[0] || {},
        whatsappRecentEvents: recentEvents
      }
    });
  } catch (error) {
    console.error('[Webhook] Status check error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to get webhook status.' } });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// PATCH /api/v1/webhooks/config
// ═══════════════════════════════════════════════════════════════════════
export const updateWebhookConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { platform, verify_token, default_assignee, is_active, page_id } = req.body;

    if (!['facebook', 'instagram', 'whatsapp'].includes(platform)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid platform' } });
      return;
    }

    await pool.query(
      `UPDATE webhook_configs 
       SET verify_token = COALESCE(?, verify_token),
           default_assignee = ?,
           is_active = COALESCE(?, is_active),
           page_id = COALESCE(?, page_id),
           updated_at = NOW()
       WHERE platform = ?`,
      [verify_token || null, default_assignee || null, is_active !== undefined ? is_active : null, page_id || null, platform]
    );

    res.json({ success: true, data: { message: `Webhook config updated for ${platform}` } });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update webhook config' } });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// GET /api/v1/webhooks/events — Debugging Endpoint (Latest 50 events, PUBLIC)
// ═══════════════════════════════════════════════════════════════════════
export const getWebhookEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const [events] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM webhook_logs ORDER BY id DESC LIMIT 50`
    );
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch events' } });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// GET /api/v1/webhooks/logs — Webhook Event Logs (Protected list query)
// ═══════════════════════════════════════════════════════════════════════
export const getWebhookLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 30, status } = req.query as any;
    const offset = (Number(page) - 1) * Number(limit);
    const conds: string[] = ['source = ?'];
    const params: any[] = ['meta'];

    if (status) { conds.push('processing_status = ?'); params.push(status); }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM webhook_logs WHERE ${conds.join(' AND ')}
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );
    const [countR] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM webhook_logs WHERE ${conds.join(' AND ')}`,
      params
    );
    res.json({
      success: true,
      data: rows,
      meta: { total: countR[0].total, page: Number(page), limit: Number(limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch logs.' } });
  }
};
