import { Request, Response } from 'express';
import pool from '../utils/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { encrypt, decrypt } from '../utils/encryption';
import { getMetaSettings } from '../services/metaLeadService';
import axios from 'axios';

/**
 * GET /api/v1/integrations/meta/settings
 */
export const getMetaSettingsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await getMetaSettings();
    if (!settings) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Meta settings not found' } });
      return;
    }
    res.json({ success: true, data: settings });
  } catch (error: any) {
    console.error('[IntegrationsController] getMetaSettingsHandler error:', error.message);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to retrieve Meta settings' } });
  }
};

/**
 * PATCH /api/v1/integrations/meta/settings
 */
export const updateMetaSettingsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      facebookEnabled,
      instagramEnabled,
      appId,
      appSecret,
      pageAccessToken,
      verifyToken,
      autoAssignStaffId,
      allowedFormIds
    } = req.body;

    const [rows] = await pool.query<RowDataPacket[]>('SELECT app_secret, page_access_token FROM meta_integration_settings WHERE id = 1 LIMIT 1');
    const existing = rows[0] || {};

    let encryptedSecret = existing.app_secret || null;
    if (appSecret !== undefined && appSecret !== '••••••••••••••••' && appSecret !== '') {
      encryptedSecret = encrypt(appSecret);
    }

    let encryptedToken = existing.page_access_token || null;
    if (pageAccessToken !== undefined && pageAccessToken !== '') {
      // Check if it's already encrypted or starts with EAA
      if (pageAccessToken.includes(':') && !pageAccessToken.startsWith('EAA')) {
        // keep existing if it looks encrypted and wasn't changed
        encryptedToken = pageAccessToken;
      } else {
        encryptedToken = encrypt(pageAccessToken);
      }
    }

    await pool.query(`
      UPDATE meta_integration_settings
      SET
        facebook_enabled = ?,
        instagram_enabled = ?,
        app_id = ?,
        app_secret = ?,
        page_access_token = ?,
        verify_token = ?,
        auto_assign_staff_id = ?,
        allowed_form_ids = ?
      WHERE id = 1
    `, [
      facebookEnabled ? 1 : 0,
      instagramEnabled ? 1 : 0,
      appId || null,
      encryptedSecret,
      encryptedToken,
      verifyToken || 'GOC_META_WEBHOOK_2024',
      autoAssignStaffId ? Number(autoAssignStaffId) : null,
      allowedFormIds || null
    ]);

    // Also sync the verify token and active state to the webhook_configs table
    await pool.query(`
      UPDATE webhook_configs
      SET verify_token = ?, is_active = ?, default_assignee = ?
      WHERE platform = 'facebook'
    `, [verifyToken || 'GOC_META_WEBHOOK_2024', facebookEnabled ? 1 : 0, autoAssignStaffId ? Number(autoAssignStaffId) : null]);

    await pool.query(`
      UPDATE webhook_configs
      SET verify_token = ?, is_active = ?, default_assignee = ?
      WHERE platform = 'instagram'
    `, [verifyToken || 'GOC_META_WEBHOOK_2024', instagramEnabled ? 1 : 0, autoAssignStaffId ? Number(autoAssignStaffId) : null]);

    res.json({ success: true, message: 'Meta settings updated successfully' });
  } catch (error: any) {
    console.error('[IntegrationsController] updateMetaSettingsHandler error:', error.message);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update Meta settings' } });
  }
};

/**
 * POST /api/v1/integrations/meta/validate
 */
export const validateMetaConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await getMetaSettings();
    if (!settings || !settings.pageAccessToken) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Page Access Token is not configured' } });
      return;
    }

    const token = settings.pageAccessToken;
    
    // 1. Check Page Details using /me
    let pageId = '';
    let pageName = '';
    try {
      const meRes = await axios.get(`https://graph.facebook.com/v23.0/me`, {
        params: { access_token: token }
      });
      pageId = meRes.data.id;
      pageName = meRes.data.name;
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || err.message;
      res.json({
        success: true,
        webhookVerified: true,
        pageConnected: false,
        leadSyncEnabled: false,
        error: `Page Connection Failed: ${errMsg}`
      });
      return;
    }

    // 2. Check permissions via /me/permissions
    let hasLeadsRetrieval = false;
    let hasPagesRead = false;
    try {
      const permRes = await axios.get(`https://graph.facebook.com/v23.0/me/permissions`, {
        params: { access_token: token }
      });
      const perms = permRes.data.data || [];
      hasLeadsRetrieval = perms.some((p: any) => p.permission === 'leads_retrieval' && p.status === 'granted');
      hasPagesRead = perms.some((p: any) => p.permission === 'pages_read_engagement' && p.status === 'granted');
    } catch (err: any) {
      console.error('[Validate] Failed to fetch permissions:', err.message);
    }

    // 3. Check page subscription via /{page_id}/subscribed_apps
    let isSubscribed = false;
    try {
      const subRes = await axios.get(`https://graph.facebook.com/v23.0/${pageId}/subscribed_apps`, {
        params: { access_token: token }
      });
      const apps = subRes.data.data || [];
      isSubscribed = apps.some((app: any) => String(app.id) === settings.appId || String(app.app_id) === settings.appId);
      
      // Auto-subscribe if not present and permissions are granted
      if (!isSubscribed && settings.appId && hasLeadsRetrieval) {
        console.log(`[Validate] App is not subscribed to Page ${pageId}. Trying to auto-subscribe...`);
        const subPost = await axios.post(`https://graph.facebook.com/v23.0/${pageId}/subscribed_apps`, null, {
          params: { access_token: token, subscribed_fields: 'leadgen' }
        });
        if (subPost.data.success) {
          isSubscribed = true;
          console.log('[Validate] Auto-subscription succeeded.');
        }
      }
    } catch (err: any) {
      console.error('[Validate] Page subscription check/post failed:', err.message);
    }

    res.json({
      success: true,
      webhookVerified: true,
      pageConnected: true,
      leadSyncEnabled: isSubscribed,
      data: {
        pageId,
        pageName,
        permissions: {
          leads_retrieval: hasLeadsRetrieval,
          pages_read_engagement: hasPagesRead
        },
        appSubscribed: isSubscribed
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
};

/**
 * POST /api/v1/integrations/meta/test
 */
export const runMetaTest = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await getMetaSettings();
    if (!settings || !settings.pageAccessToken) {
      res.json({
        success: true,
        data: {
          tokenValid: false,
          pageConnected: false,
          permissions: {},
          appSubscribed: false,
          logs: ['Error: Page Access Token not configured.']
        }
      });
      return;
    }

    const token = settings.pageAccessToken;
    const logs: string[] = ['Initiating connection diagnostic tests...'];

    // 1. Verify token validity and Page connection
    let pageId = '';
    try {
      logs.push('Step 1: Connecting to Meta Graph API /me...');
      const meRes = await axios.get(`https://graph.facebook.com/v23.0/me`, {
        params: { access_token: token }
      });
      pageId = meRes.data.id;
      logs.push(`✅ Connection successful. Connected to Page: "${meRes.data.name}" (ID: ${pageId})`);
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || err.message;
      logs.push(`❌ Connection failed: ${errMsg}`);
      res.json({
        success: true,
        data: {
          tokenValid: false,
          pageConnected: false,
          permissions: {},
          appSubscribed: false,
          logs
        }
      });
      return;
    }

    // 2. Verify permissions
    logs.push('Step 2: Checking Page Access Token permission scope...');
    let hasLeadsRetrieval = false;
    let hasPagesRead = false;
    const permMap: Record<string, boolean> = {};
    try {
      const permRes = await axios.get(`https://graph.facebook.com/v23.0/me/permissions`, {
        params: { access_token: token }
      });
      const perms = permRes.data.data || [];
      perms.forEach((p: any) => {
        permMap[p.permission] = p.status === 'granted';
      });
      hasLeadsRetrieval = permMap['leads_retrieval'] === true;
      hasPagesRead = permMap['pages_read_engagement'] === true;
      logs.push(`🔍 Granted Permissions: ${Object.keys(permMap).filter(k => permMap[k]).join(', ') || 'None'}`);
      if (hasLeadsRetrieval && hasPagesRead) {
        logs.push('✅ Required permissions (leads_retrieval, pages_read_engagement) are present.');
      } else {
        logs.push(`⚠️ Missing permissions. leads_retrieval: ${hasLeadsRetrieval ? '✅' : '❌'}, pages_read_engagement: ${hasPagesRead ? '✅' : '❌'}`);
      }
    } catch (err: any) {
      logs.push(`❌ Failed to verify permissions: ${err.message}`);
    }

    // 3. Verify Page Subscription
    logs.push('Step 3: Checking App webhook subscription to page leadgen events...');
    let isSubscribed = false;
    try {
      const subRes = await axios.get(`https://graph.facebook.com/v23.0/${pageId}/subscribed_apps`, {
        params: { access_token: token }
      });
      const apps = subRes.data.data || [];
      isSubscribed = apps.some((app: any) => String(app.id) === settings.appId || String(app.app_id) === settings.appId);
      if (isSubscribed) {
        logs.push(`✅ App ID ${settings.appId} is successfully subscribed to Page ${pageId}.`);
      } else {
        logs.push(`⚠️ App ID ${settings.appId} is not subscribed to Page.`);
      }
    } catch (err: any) {
      logs.push(`❌ Failed to check page subscription: ${err.message}`);
    }

    res.json({
      success: true,
      data: {
        tokenValid: true,
        pageConnected: true,
        permissions: permMap,
        appSubscribed: isSubscribed,
        logs
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
};
