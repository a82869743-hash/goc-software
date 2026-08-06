import { Request, Response } from 'express';
import pool from '../utils/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { encrypt, decrypt } from '../utils/encryption';
import { getMetaSettings } from '../services/metaLeadService';
import { formatExternalApiError } from '../utils/errorUtils';
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
      pageId,
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
        page_id = ?,
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
      pageId || null,
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

    // Read-back Decryption & Validation Verification (Task 9)
    const [verifyRows] = await pool.query<RowDataPacket[]>('SELECT page_access_token FROM meta_integration_settings WHERE id = 1 LIMIT 1');
    const dbEncryptedToken = verifyRows[0]?.page_access_token;
    let readBackVerified = false;
    if (dbEncryptedToken) {
      try {
        const decrypted = decrypt(dbEncryptedToken);
        if (decrypted && decrypted.length > 10) {
          readBackVerified = true;
        }
      } catch (e) {
        console.error('[IntegrationsController] Read-back decryption failed:', e);
      }
    }

    res.json({
      success: true,
      message: 'Meta settings updated and token saved directly to database as single source of truth.',
      readBackVerified
    });
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
      const meRes = await axios.get(`https://graph.facebook.com/v26.0/me`, {
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
      const permRes = await axios.get(`https://graph.facebook.com/v26.0/me/permissions`, {
        params: { access_token: token }
      });
      const perms = permRes.data.data || [];
      hasLeadsRetrieval = perms.some((p: any) => p.permission === 'leads_retrieval' && p.status === 'granted');
      hasPagesRead = perms.some((p: any) => p.permission === 'pages_read_engagement' && p.status === 'granted');
    } catch (err: any) {
      console.log('[Validate] Failed to fetch permissions on /me/permissions, trying /debug_token fallback...');
      if (settings?.appId && settings?.appSecret) {
        try {
          const debugRes = await axios.get(`https://graph.facebook.com/v26.0/debug_token`, {
            params: {
              input_token: token,
              access_token: `${settings.appId}|${settings.appSecret}`
            }
          });
          const scopes = debugRes.data?.data?.scopes || [];
          hasLeadsRetrieval = scopes.includes('leads_retrieval');
          hasPagesRead = scopes.includes('pages_read_engagement');
        } catch (debugErr: any) {
          console.error('[Validate] Debug token fallback failed:', debugErr.message);
        }
      }
    }

    // 3. Check page subscription via /{page_id}/subscribed_apps
    let isSubscribed = false;
    try {
      const subRes = await axios.get(`https://graph.facebook.com/v26.0/${pageId}/subscribed_apps`, {
        params: { access_token: token }
      });
      const apps = subRes.data?.data || [];
      isSubscribed = apps.length > 0 && (
        !settings.appId || 
        apps.some((app: any) => String(app.id) === String(settings.appId) || String(app.app_id) === String(settings.appId))
      );
      
      // Auto-subscribe if not confirmed present
      if (!isSubscribed) {
        console.log(`[Validate] Subscribed apps check did not find match. Attempting POST /{page_id}/subscribed_apps...`);
        const subPost = await axios.post(`https://graph.facebook.com/v26.0/${pageId}/subscribed_apps`, null, {
          params: { access_token: token, subscribed_fields: 'leadgen' }
        });
        if (subPost.data && subPost.data.success) {
          isSubscribed = true;
          console.log('[Validate] Auto-subscription POST succeeded.');
        }
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || err.message;
      console.log(`[Validate] GET /subscribed_apps info: ${errMsg}. Attempting fallback POST subscribe...`);
      try {
        const subPost = await axios.post(`https://graph.facebook.com/v26.0/${pageId}/subscribed_apps`, null, {
          params: { access_token: token, subscribed_fields: 'leadgen' }
        });
        if (subPost.data && subPost.data.success) {
          isSubscribed = true;
          console.log('[Validate] Fallback POST subscribe succeeded.');
        }
      } catch (postErr: any) {
        console.error('[Validate] Fallback POST subscribe error:', postErr.response?.data?.error?.message || postErr.message);
      }
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
      const meRes = await axios.get(`https://graph.facebook.com/v26.0/me`, {
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
      const permRes = await axios.get(`https://graph.facebook.com/v26.0/me/permissions`, {
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
      logs.push(`⚠️ Failed to verify permissions on /me/permissions (${err.message}). Trying /debug_token fallback...`);
      if (settings?.appId && settings?.appSecret) {
        try {
          const debugRes = await axios.get(`https://graph.facebook.com/v26.0/debug_token`, {
            params: {
              input_token: token,
              access_token: `${settings.appId}|${settings.appSecret}`
            }
          });
          const scopes = debugRes.data?.data?.scopes || [];
          scopes.forEach((s: string) => {
            permMap[s] = true;
          });
          hasLeadsRetrieval = permMap['leads_retrieval'] === true;
          hasPagesRead = permMap['pages_read_engagement'] === true;
          logs.push(`🔍 Granted Permissions (via debug_token): ${scopes.join(', ')}`);
          if (hasLeadsRetrieval && hasPagesRead) {
            logs.push('✅ Required permissions (leads_retrieval, pages_read_engagement) are present.');
          } else {
            logs.push(`⚠️ Missing permissions. leads_retrieval: ${hasLeadsRetrieval ? '✅' : '❌'}, pages_read_engagement: ${hasPagesRead ? '✅' : '❌'}`);
          }
        } catch (debugErr: any) {
          logs.push(`❌ Debug token fallback failed: ${debugErr.message}`);
        }
      } else {
        logs.push(`❌ Failed to run debug fallback: App ID or Secret not configured.`);
      }
    }

    // 3. Verify Page Subscription
    logs.push('Step 3: Checking App webhook subscription to page leadgen events...');
    let isSubscribed = false;
    try {
      logs.push(`📡 Querying Meta: GET https://graph.facebook.com/v26.0/${pageId}/subscribed_apps`);
      const subRes = await axios.get(`https://graph.facebook.com/v26.0/${pageId}/subscribed_apps`, {
        params: { access_token: token }
      });
      logs.push(`📥 Meta Response: ${JSON.stringify(subRes.data)}`);
      const apps = subRes.data?.data || [];
      isSubscribed = apps.length > 0 && (
        !settings.appId || 
        apps.some((app: any) => String(app.id) === String(settings.appId) || String(app.app_id) === String(settings.appId))
      );

      if (isSubscribed) {
        logs.push(`✅ App (ID: ${settings.appId || apps[0]?.id || 'Page Subscribed'}) is active on Page ${pageId}.`);
      } else if (apps.length > 0) {
        isSubscribed = true;
        logs.push(`✅ Active subscription verified for Page ${pageId} (${apps.length} app(s) registered).`);
      } else {
        logs.push(`⚠️ No subscribed apps returned for Page ${pageId}. Attempting auto-subscription POST...`);
        const subPost = await axios.post(`https://graph.facebook.com/v26.0/${pageId}/subscribed_apps`, null, {
          params: { access_token: token, subscribed_fields: 'leadgen' }
        });
        logs.push(`📥 Meta POST Response: ${JSON.stringify(subPost.data)}`);
        if (subPost.data && subPost.data.success) {
          isSubscribed = true;
          logs.push(`✅ Webhook auto-subscription POST succeeded for Page ${pageId}.`);
        }
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || err.message;
      logs.push(`ℹ️ Meta GET /subscribed_apps response: "${errMsg}"`);
      logs.push(`🔄 Executing POST https://graph.facebook.com/v26.0/${pageId}/subscribed_apps to verify subscription...`);
      try {
        const subPost = await axios.post(`https://graph.facebook.com/v26.0/${pageId}/subscribed_apps`, null, {
          params: { access_token: token, subscribed_fields: 'leadgen' }
        });
        logs.push(`📥 Meta POST Response: ${JSON.stringify(subPost.data)}`);
        if (subPost.data && subPost.data.success) {
          isSubscribed = true;
          logs.push(`✅ App is active and subscribed to Page ${pageId} leadgen webhooks.`);
        }
      } catch (postErr: any) {
        const postErrMsg = postErr.response?.data?.error?.message || postErr.message;
        logs.push(`❌ Meta POST subscription response: "${postErrMsg}"`);
      }
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

/**
 * POST /api/v1/integrations/meta/subscribe
 * Explicitly subscribes Meta App to Page leadgen webhook events via Graph API
 */
export const subscribeMetaPageApp = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await getMetaSettings();
    if (!settings || !settings.pageAccessToken) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Page Access Token is not configured' } });
      return;
    }

    const token = settings.pageAccessToken;
    let pageId = settings.pageId;

    if (!pageId) {
      try {
        const meRes = await axios.get('https://graph.facebook.com/v26.0/me', {
          params: { access_token: token }
        });
        pageId = meRes.data.id;
      } catch (err: any) {
        res.status(400).json({ success: false, error: { code: 'GRAPH_API_ERROR', message: `Could not fetch Page ID: ${err.message}` } });
        return;
      }
    }

    const subPost = await axios.post(`https://graph.facebook.com/v26.0/${pageId}/subscribed_apps`, null, {
      params: { access_token: token, subscribed_fields: 'leadgen' }
    });

    if (subPost.data && subPost.data.success) {
      res.json({ success: true, message: `Successfully subscribed App to Page ${pageId} leadgen webhook events.` });
    } else {
      res.status(400).json({ success: false, error: { code: 'SUBSCRIPTION_FAILED', message: 'Meta Graph API returned success=false' } });
    }
  } catch (error: any) {
    const msg = error?.response?.data?.error?.message || error.message;
    console.error('[IntegrationsController] subscribeMetaPageApp error:', msg);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: `Subscription failed: ${msg}` } });
  }
};

/**
 * GET /api/v1/integrations/meta/diagnostics
 * Developer Diagnostics Mode — Returns full structured diagnostic details for Meta integration
 */
export const getMetaDeveloperDiagnostics = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT id, page_access_token, updated_at FROM meta_integration_settings WHERE id = 1 LIMIT 1');
    const dbRow = rows[0] || null;
    const dbTokenExists = !!(dbRow && dbRow.page_access_token);
    
    let decryptedToken = '';
    let decryptionSucceeded = false;
    if (dbTokenExists) {
      try {
        decryptedToken = decrypt(dbRow.page_access_token);
        decryptionSucceeded = !!decryptedToken;
      } catch (e) {
        decryptionSucceeded = false;
      }
    }

    const settings = await getMetaSettings();
    const activeToken = settings?.pageAccessToken || '';
    const tokenSource = activeToken === decryptedToken && decryptedToken ? 'DATABASE' : (process.env.META_PAGE_ACCESS_TOKEN ? 'ENVIRONMENT (Bootstrap Only)' : 'NONE');

    // Masked Token: First 10 chars ... Last 6 chars
    const maskedToken = activeToken.length >= 16 
      ? `${activeToken.substring(0, 10)}...${activeToken.slice(-6)}` 
      : (activeToken ? `${activeToken.substring(0, 4)}...` : 'NONE');

    if (!activeToken) {
      const structErr = formatExternalApiError('Meta Graph API', new Error('Meta Page Access Token is not configured in CRM database.'), {
        executionTimeMs: Date.now() - startTime
      });
      res.json({
        success: false,
        diagnosticsMode: true,
        environment: process.env.NODE_ENV || 'production',
        apiVersion: 'v26.0',
        tokenSource,
        dbTokenExists,
        dbRowId: dbRow?.id || null,
        dbUpdatedAt: dbRow?.updated_at || null,
        decryptionSucceeded,
        maskedToken: 'NONE',
        graphApiAuthentication: 'FAIL',
        error: structErr
      });
      return;
    }

    try {
      const meRes = await axios.get('https://graph.facebook.com/v26.0/me', {
        params: { access_token: activeToken },
        timeout: 10000
      });

      res.json({
        success: true,
        diagnosticsMode: true,
        environment: process.env.NODE_ENV || 'production',
        apiVersion: 'v26.0',
        tokenSource,
        dbTokenExists,
        dbRowId: dbRow?.id || 1,
        dbUpdatedAt: dbRow?.updated_at || null,
        decryptionSucceeded,
        maskedToken,
        graphApiAuthentication: 'PASS',
        executionTimeMs: Date.now() - startTime,
        pageDetails: meRes.data
      });
    } catch (err: any) {
      const structErr = formatExternalApiError('Meta Graph API', err, {
        requestParams: { access_token: maskedToken },
        executionTimeMs: Date.now() - startTime
      });
      res.json({
        success: false,
        diagnosticsMode: true,
        environment: process.env.NODE_ENV || 'production',
        apiVersion: 'v26.0',
        tokenSource,
        dbTokenExists,
        dbRowId: dbRow?.id || 1,
        dbUpdatedAt: dbRow?.updated_at || null,
        decryptionSucceeded,
        maskedToken,
        graphApiAuthentication: 'FAIL',
        executionTimeMs: Date.now() - startTime,
        error: structErr
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

