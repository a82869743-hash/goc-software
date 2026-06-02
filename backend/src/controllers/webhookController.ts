import { Request, Response } from 'express';
import pool from '../utils/db';
import { generateCode } from '../utils/codes';
import { WhatsAppTemplates } from '../services/whatsappService';
import { notifyByRole } from '../services/notificationService';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

// ──────────────────────────────────────────────────────────────
// HELPER: Get default assignee from webhook_configs
// ──────────────────────────────────────────────────────────────
async function getDefaultAssignee(platform: string): Promise<number | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT default_assignee FROM webhook_configs WHERE platform = ? AND is_active = 1',
    [platform]
  );
  return rows.length > 0 ? rows[0].default_assignee : null;
}

// ──────────────────────────────────────────────────────────────
// HELPER: Log webhook event for debugging
// ──────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────
// HELPER: Mark webhook event as processed
// ──────────────────────────────────────────────────────────────
async function markWebhookProcessed(eventId: number, leadId: number | null, error?: string): Promise<void> {
  await pool.query(
    `UPDATE webhook_events SET processed = 1, lead_id_created = ?, error_message = ?, processed_at = NOW() WHERE id = ?`,
    [leadId, error || null, eventId]
  );
}

// ──────────────────────────────────────────────────────────────
// HELPER: Update webhook stats
// ──────────────────────────────────────────────────────────────
async function updateWebhookStats(platform: string): Promise<void> {
  await pool.query(
    `UPDATE webhook_configs SET last_received = NOW(), total_received = total_received + 1 WHERE platform = ?`,
    [platform]
  );
}

// ──────────────────────────────────────────────────────────────
// HELPER: Create lead from webhook data
// ──────────────────────────────────────────────────────────────
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
  
  // ── Deduplication Check ──────────────────────────────────────
  if (data.fb_lead_id) {
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id, lead_code FROM leads WHERE fb_lead_id = ? LIMIT 1',
      [data.fb_lead_id]
    );
    if (existing.length > 0) {
      return { leadId: existing[0].id, leadCode: existing[0].lead_code, isNew: false };
    }
  }

  if (data.ig_lead_id) {
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id, lead_code FROM leads WHERE ig_lead_id = ? LIMIT 1',
      [data.ig_lead_id]
    );
    if (existing.length > 0) {
      return { leadId: existing[0].id, leadCode: existing[0].lead_code, isNew: false };
    }
  }

  if (data.source === 'whatsapp' && data.phone) {
    // For WhatsApp: check if this phone already has a recent open lead
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

  // ── Create New Lead ──────────────────────────────────────────
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

  // ── Log activity ─────────────────────────────────────────────
  await pool.query(
    `INSERT INTO lead_activity_log (lead_id, staff_id, action, new_value, notes) 
     VALUES (?, NULL, 'auto_captured', 'new', ?)`,
    [leadId, `Auto-captured from ${data.source}`]
  );

  return { leadId, leadCode, isNew: true };
}

// ══════════════════════════════════════════════════════════════
// META WEBHOOK (Facebook + Instagram)
// ══════════════════════════════════════════════════════════════

/**
 * GET /api/v1/webhooks/meta
 * Meta verification handshake — called once when you set up the webhook in Meta dashboard
 */
export const verifyMetaWebhook = async (req: Request, res: Response): Promise<void> => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode !== 'subscribe') {
    res.status(400).send('Invalid mode');
    return;
  }

  // Check token against DB config
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT verify_token FROM webhook_configs 
     WHERE platform IN ('facebook', 'instagram') AND is_active = 1 LIMIT 1`
  );

  const configuredToken = rows.length > 0 ? rows[0].verify_token : process.env.META_VERIFY_TOKEN;

  if (token === configuredToken) {
    console.log('✅ Meta webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.warn('❌ Meta webhook token mismatch. Got:', token, 'Expected:', configuredToken);
    res.status(403).send('Forbidden');
  }
};

/**
 * POST /api/v1/webhooks/meta
 * Receives Facebook Lead Ads and Instagram Lead Form submissions
 * 
 * Meta payload structure:
 * {
 *   object: 'page',
 *   entry: [{
 *     id: 'PAGE_ID',
 *     changes: [{
 *       field: 'leadgen',
 *       value: {
 *         leadgen_id: 'LEAD_ID',
 *         page_id: 'PAGE_ID',
 *         form_id: 'FORM_ID',
 *         ad_id: 'AD_ID',
 *         created_time: 1234567890
 *       }
 *     }]
 *   }]
 * }
 * 
 * After getting leadgen_id, you call Graph API to get field_data:
 * GET /{leadgen_id}?fields=field_data&access_token={PAGE_ACCESS_TOKEN}
 */
export const receiveMetaWebhook = async (req: Request, res: Response): Promise<void> => {
  // Always respond 200 immediately — Meta will retry if it doesn't get a fast response
  res.status(200).json({ success: true });

  try {
    const payload = req.body;
    
    if (!payload || payload.object !== 'page') {
      console.log('Meta webhook: non-page event, skipping');
      return;
    }

    const entries = payload.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        if (change.field !== 'leadgen') continue;

        const leadgenId = change.value?.leadgen_id;
        if (!leadgenId) continue;

        // Log the raw event
        const eventLogId = await logWebhookEvent('facebook', leadgenId, payload);
        await updateWebhookStats('facebook');

        try {
          // Fetch full lead data from Meta Graph API
          const leadData = await fetchMetaLeadData(leadgenId);
          if (!leadData) {
            await markWebhookProcessed(eventLogId, null, 'Could not fetch lead data from Meta Graph API');
            continue;
          }

          const defaultAssignee = await getDefaultAssignee('facebook');

          const { leadId, leadCode, isNew } = await createLeadFromWebhook({
            full_name: leadData.full_name || 'Facebook Lead',
            phone: leadData.phone_number || leadData.phone || '',
            vehicle_make: leadData.vehicle_make || undefined,
            vehicle_model: leadData.vehicle_model || undefined,
            requirement: leadData.requirement || leadData.services_interested || undefined,
            source: 'facebook',
            fb_lead_id: leadgenId,
            notes: `Auto-captured from Facebook Lead Ad. Form ID: ${change.value?.form_id || 'unknown'}`,
            assigned_to: defaultAssignee,
            raw_payload: payload,
          });

          await markWebhookProcessed(eventLogId, leadId);

          if (isNew) {
            console.log(`✅ Facebook lead created: ${leadCode} — ${leadData.full_name}`);

            // Send welcome WhatsApp if phone available
            if (leadData.phone_number || leadData.phone) {
              const phone = (leadData.phone_number || leadData.phone).replace(/\D/g, '');
              if (phone.length >= 10) {
                await WhatsAppTemplates.leadWelcome(phone, leadData.full_name || 'there');
              }
            }

            // Notify sales staff
            await notifyByRole(
              ['admin', 'manager', 'receptionist'],
              'new_lead',
              `New Facebook Lead: ${leadData.full_name || 'Unknown'}`,
              `Phone: ${leadData.phone_number || leadData.phone || 'N/A'} | Lead: ${leadCode}`,
              'lead',
              leadId
            );
          } else {
            console.log(`ℹ️ Facebook lead duplicate skipped: ${leadgenId}`);
          }

        } catch (innerError: any) {
          console.error('Error processing Meta leadgen change:', innerError);
          await markWebhookProcessed(eventLogId, null, innerError.message);
        }
      }
    }
  } catch (error: any) {
    console.error('❌ Meta webhook processing error:', error);
  }
};

/**
 * Fetch lead field data from Meta Graph API
 * Calls: GET /{leadgen_id}?fields=field_data&access_token={PAGE_ACCESS_TOKEN}
 */
async function fetchMetaLeadData(leadgenId: string): Promise<Record<string, string> | null> {
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
  if (!accessToken) {
    console.warn('⚠️ META_PAGE_ACCESS_TOKEN not set — cannot fetch lead field data from Graph API');
    return null;
  }

  try {
    const axios = require('axios');
    const response = await axios.get(`https://graph.facebook.com/v18.0/${leadgenId}`, {
      params: {
        fields: 'field_data,created_time,ad_name,form_id',
        access_token: accessToken,
      },
      timeout: 10000,
    });

    const fieldData: Array<{ name: string; values: string[] }> = response.data?.field_data || [];
    
    // Normalize field data to a flat object
    // Facebook form field names vary — we map common variations
    const FIELD_MAP: Record<string, string> = {
      'full_name': 'full_name',
      'full name': 'full_name',
      'name': 'full_name',
      'first_name': 'first_name',
      'last_name': 'last_name',
      'phone_number': 'phone_number',
      'phone': 'phone_number',
      'mobile': 'phone_number',
      'mobile_number': 'phone_number',
      'email': 'email',
      'email_address': 'email',
      'car_model': 'vehicle_model',
      'vehicle_model': 'vehicle_model',
      'car_make': 'vehicle_make',
      'vehicle_make': 'vehicle_make',
      'service': 'requirement',
      'services': 'requirement',
      'requirement': 'requirement',
      'services_interested': 'requirement',
    };

    const result: Record<string, string> = {};
    
    for (const field of fieldData) {
      const normalizedKey = FIELD_MAP[field.name.toLowerCase()] || field.name.toLowerCase();
      result[normalizedKey] = field.values?.[0] || '';
    }

    // Build full_name from first_name + last_name if full_name not present
    if (!result.full_name && (result.first_name || result.last_name)) {
      result.full_name = `${result.first_name || ''} ${result.last_name || ''}`.trim();
    }

    return result;
  } catch (error: any) {
    console.error(`Failed to fetch Meta lead data for ${leadgenId}:`, error.message);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// INSTAGRAM WEBHOOK (Same endpoint as Meta, separate handler for clarity)
// ══════════════════════════════════════════════════════════════

/**
 * POST /api/v1/webhooks/instagram
 * Instagram Lead Forms — same Meta Graph API, separate route for tracking
 * Delegates to receiveMetaWebhook after logging as instagram source
 */
export const receiveInstagramWebhook = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true });

  try {
    const payload = req.body;
    const entries = payload.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'leadgen') continue;

        const leadgenId = change.value?.leadgen_id;
        if (!leadgenId) continue;

        const eventLogId = await logWebhookEvent('instagram', leadgenId, payload);
        await updateWebhookStats('instagram');

        try {
          const leadData = await fetchMetaLeadData(leadgenId);
          if (!leadData) {
            await markWebhookProcessed(eventLogId, null, 'Could not fetch Instagram lead data');
            continue;
          }

          const defaultAssignee = await getDefaultAssignee('instagram');

          const { leadId, leadCode, isNew } = await createLeadFromWebhook({
            full_name: leadData.full_name || 'Instagram Lead',
            phone: leadData.phone_number || '',
            vehicle_make: leadData.vehicle_make || undefined,
            vehicle_model: leadData.vehicle_model || undefined,
            requirement: leadData.requirement || undefined,
            source: 'instagram',
            ig_lead_id: leadgenId,
            notes: `Auto-captured from Instagram Lead Form`,
            assigned_to: defaultAssignee,
            raw_payload: payload,
          });

          await markWebhookProcessed(eventLogId, leadId);

          if (isNew) {
            console.log(`✅ Instagram lead created: ${leadCode}`);

            if (leadData.phone_number) {
              const phone = leadData.phone_number.replace(/\D/g, '');
              if (phone.length >= 10) {
                await WhatsAppTemplates.leadWelcome(phone, leadData.full_name || 'there');
              }
            }

            await notifyByRole(
              ['admin', 'manager', 'receptionist'],
              'new_lead',
              `New Instagram Lead: ${leadData.full_name || 'Unknown'}`,
              `Phone: ${leadData.phone_number || 'N/A'} | Lead: ${leadCode}`,
              'lead',
              leadId
            );
          }
        } catch (err: any) {
          await markWebhookProcessed(eventLogId, null, err.message);
        }
      }
    }
  } catch (error) {
    console.error('Instagram webhook error:', error);
  }
};

// ══════════════════════════════════════════════════════════════
// WHATSAPP INBOUND WEBHOOK (MSG91)
// ══════════════════════════════════════════════════════════════

/**
 * POST /api/v1/webhooks/whatsapp
 * MSG91 fires this when a customer sends a WhatsApp message to the studio number.
 * 
 * MSG91 inbound payload:
 * {
 *   type: "message",
 *   from: "919876543210",
 *   to: "919999999999",
 *   message_id: "wamid.xxxxx",
 *   timestamp: "1234567890",
 *   text: { body: "Hello, I want PPF for my car" },
 *   contact: { name: "Amit Shah" }
 * }
 */
export const receiveWhatsAppWebhook = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true });

  try {
    const payload = req.body;

    // Support both MSG91 and Meta WhatsApp Business API format
    // MSG91 format
    let fromPhone = payload.from || payload.sender || '';
    let messageId = payload.message_id || payload.id || '';
    let messageText = payload.text?.body || payload.message || payload.text || '';
    let contactName = payload.contact?.name || payload.sender_name || '';
    let messageType = payload.type || 'text';

    // Meta WhatsApp Business API format (alternative)
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

    // Only process text messages (ignore images, docs, etc. for lead capture)
    if (!fromPhone) {
      console.log('WhatsApp webhook: no sender phone, skipping');
      return;
    }

    // Normalize phone — remove country code prefix for storage
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

      // Send auto-reply welcome message
      await WhatsAppTemplates.leadWelcome(normalizedPhone, displayName);

      // Notify sales staff
      await notifyByRole(
        ['admin', 'manager', 'receptionist'],
        'new_lead',
        `New WhatsApp Lead: ${displayName}`,
        `Phone: ${normalizedPhone} | Message: "${(messageText || '').slice(0, 80)}" | Lead: ${leadCode}`,
        'lead',
        leadId
      );
    } else {
      // Existing lead — update notes with latest message
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

// ══════════════════════════════════════════════════════════════
// WEBHOOK ADMIN ROUTES (for Settings page)
// ══════════════════════════════════════════════════════════════

/**
 * GET /api/v1/webhooks/status
 * Returns the current status and stats for all webhook integrations
 */
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

    res.json({ success: true, data: { configs, recentEvents } });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to get webhook status' } });
  }
};

/**
 * PATCH /api/v1/webhooks/config
 * Update webhook configuration (tokens, assignees, active status)
 */
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

/**
 * GET /api/v1/webhooks/events
 * Returns recent webhook events for debugging
 */
export const getWebhookEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const { platform, page = 1, limit = 20 } = req.query as any;
    const offset = (Number(page) - 1) * Number(limit);
    const conditions = platform ? `WHERE platform = '${platform}'` : '';

    const [events] = await pool.query<RowDataPacket[]>(
      `SELECT id, platform, event_id, processed, lead_id_created, error_message, received_at, processed_at
       FROM webhook_events ${conditions}
       ORDER BY received_at DESC
       LIMIT ? OFFSET ?`,
      [Number(limit), offset]
    );

    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch events' } });
  }
};
