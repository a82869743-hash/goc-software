/**
 * GOC Studio — Meta Lead Service
 * Calls Meta Graph API to fetch lead details and normalizes the data.
 */
import axios from 'axios';
import pool from '../utils/db';
import { RowDataPacket } from 'mysql2';
import { decrypt } from '../utils/encryption';
import {
  MetaLeadGenResponse,
  MetaWebhookLeadgenValue,
  NormalizedMetaLead
} from '../types/meta';

const META_GRAPH_VERSION = 'v23.0';
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export interface MetaSettings {
  facebookEnabled: boolean;
  instagramEnabled: boolean;
  appId: string;
  appSecret: string;
  pageAccessToken: string;
  verifyToken: string;
  autoAssignStaffId: number | null;
  allowedFormIds: string;
}

/**
 * Fetch Meta Lead Ads configuration settings
 */
export async function getMetaSettings(): Promise<MetaSettings | null> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM meta_integration_settings WHERE id = 1 LIMIT 1'
    );
    if (rows.length === 0) return null;
    const s = rows[0];
    return {
      facebookEnabled: s.facebook_enabled === 1,
      instagramEnabled: s.instagram_enabled === 1,
      appId: s.app_id || '',
      appSecret: s.app_secret ? decrypt(s.app_secret) : '',
      pageAccessToken: s.page_access_token ? decrypt(s.page_access_token) : '',
      verifyToken: s.verify_token || 'GOC_META_WEBHOOK_2024',
      autoAssignStaffId: s.auto_assign_staff_id,
      allowedFormIds: s.allowed_form_ids || ''
    };
  } catch (err: any) {
    console.error('[MetaLeadService] getMetaSettings error:', err.message);
    return null;
  }
}

/**
 * Normalize Indian mobile number to 10-digit
 */
function normalizePhone(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('91') && cleaned.length === 12) return cleaned.slice(2);
  if (cleaned.startsWith('0') && cleaned.length === 11) return cleaned.slice(1);
  return cleaned.slice(-10);
}

/**
 * Fetch lead details from Meta Graph API
 */
export async function fetchMetaLeadFromGraph(
  leadgenId: string,
  pageAccessToken?: string
): Promise<MetaLeadGenResponse | null> {
  try {
    let token = pageAccessToken;
    if (!token) {
      const settings = await getMetaSettings();
      token = settings?.pageAccessToken || '';
    }
    
    if (!token) {
      console.error('[MetaLeadService] META_PAGE_ACCESS_TOKEN not configured.');
      return null;
    }

    const url = `${META_GRAPH_BASE}/${leadgenId}`;
    const response = await axios.get<MetaLeadGenResponse>(url, {
      params: { access_token: token },
      timeout: 15000,
    });

    return response.data;
  } catch (error: any) {
    const msg = error?.response?.data?.error?.message || error.message;
    console.error(`[MetaLeadService] Graph API error for leadgen ${leadgenId}:`, msg);
    return null;
  }
}

/**
 * Normalize Meta field_data array into GOC lead structure
 */
export function normalizeMetaLead(
  graphData: MetaLeadGenResponse,
  webhookValue: MetaWebhookLeadgenValue
): NormalizedMetaLead {
  const fields: Record<string, string> = {};
  const unknownFields: Record<string, string> = {};

  // Known Meta field name mappings → GOC field
  const KNOWN_FIELDS = new Set([
    'full_name', 'first_name', 'last_name', 'name',
    'phone_number', 'phone', 'mobile',
    'email', 'email_address',
    'city', 'location',
    'vehicle', 'vehicle_type', 'car_model', 'car_type',
    'service_interested', 'service', 'service_type', 'services_interested',
    'vehicle_make', 'vehicle_model', 'vehicle_brand',
    'message', 'requirement', 'query', 'description',
  ]);

  for (const fd of graphData.field_data || []) {
    const key = fd.name?.toLowerCase().replace(/\s+/g, '_') || '';
    const val = fd.values?.[0] || '';
    if (!val) continue;

    if (KNOWN_FIELDS.has(key)) {
      fields[key] = val;
    } else {
      unknownFields[key] = val;
    }
  }

  // Resolve full name
  let fullName = fields['full_name'] || fields['name'] || '';
  if (!fullName && (fields['first_name'] || fields['last_name'])) {
    fullName = `${fields['first_name'] || ''} ${fields['last_name'] || ''}`.trim();
  }
  if (!fullName) fullName = 'Meta Lead';

  // Resolve phone
  const rawPhone = fields['phone_number'] || fields['phone'] || fields['mobile'] || '';
  const phone = normalizePhone(rawPhone);

  // Resolve requirement
  const requirement =
    fields['service_interested'] || fields['service'] ||
    fields['service_type'] || fields['services_interested'] ||
    fields['requirement'] || fields['query'] || fields['description'] || null;

  // Resolve vehicle
  const vehicleMake = fields['vehicle_make'] || fields['vehicle_brand'] || null;
  const vehicleModel =
    fields['vehicle_model'] || fields['vehicle'] || fields['vehicle_type'] ||
    fields['car_model'] || fields['car_type'] || null;

  // Detect source: Instagram if is_organic or platform hint
  const isInstagram =
    graphData.is_organic === true ||
    (graphData.platform || '').toLowerCase().includes('instagram');
  const source: 'facebook' | 'instagram' = isInstagram ? 'instagram' : 'facebook';

  // Build extra notes from unknown fields
  const noteParts: string[] = [];
  for (const [k, v] of Object.entries(unknownFields)) {
    noteParts.push(`${k}: ${v}`);
  }
  const notes = noteParts.length > 0
    ? `Meta Extra Fields — ${noteParts.join(' | ')}`
    : null;

  return {
    fullName,
    phone,
    email: fields['email'] || fields['email_address'] || null,
    city: fields['city'] || fields['location'] || null,
    vehicleMake,
    vehicleModel,
    requirement,
    source,
    notes,
    formId: webhookValue.form_id,
    pageId: webhookValue.page_id,
    leadgenId: webhookValue.leadgen_id,
    isOrganic: graphData.is_organic === true,
    campaignName: webhookValue.campaign_name || null,
    adName: webhookValue.ad_name || null,
  };
}

/**
 * Check if a form ID is in the allowed filter list
 * Empty setting = accept all forms
 */
export async function isFormAllowed(formId: string): Promise<boolean> {
  const settings = await getMetaSettings();
  const allowedStr = settings?.allowedFormIds || '';
  if (!allowedStr || !allowedStr.trim()) return true; // accept all
  const allowedIds = allowedStr.split(',').map(s => s.trim()).filter(Boolean);
  return allowedIds.includes(formId);
}
