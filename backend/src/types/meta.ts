/**
 * GOC Studio — Meta Lead Ads Types
 */

export interface MetaWebhookEntry {
  id: string;
  changes: MetaWebhookChange[];
  time?: number;
}

export interface MetaWebhookChange {
  field: string;
  value: MetaWebhookLeadgenValue;
}

export interface MetaWebhookLeadgenValue {
  leadgen_id: string;
  form_id: string;
  page_id: string;
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  created_time?: number;
}

export interface MetaWebhookPayload {
  object: string;
  entry: MetaWebhookEntry[];
}

export interface MetaFieldData {
  name: string;
  values: string[];
}

export interface MetaLeadGenResponse {
  id: string;
  created_time: string;
  ad_id?: string;
  ad_name?: string;
  form_id?: string;
  is_organic?: boolean;
  platform?: string;
  field_data: MetaFieldData[];
}

export interface NormalizedMetaLead {
  fullName: string;
  phone: string;
  email: string | null;
  city: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  requirement: string | null;
  source: 'facebook' | 'instagram';
  notes: string | null;
  formId: string;
  pageId: string;
  leadgenId: string;
  isOrganic: boolean;
  campaignName: string | null;
  adName: string | null;
}
