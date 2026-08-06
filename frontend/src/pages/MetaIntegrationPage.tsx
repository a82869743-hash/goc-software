import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { webhooksAPI, WebhookLogEntry } from '../api/webhooks';
import { integrationsAPI, MetaIntegrationSettings } from '../api/integrations';
import { staffAPI } from '../api/staff';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  success:             { label: 'Lead Created',    color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20' },
  failed:              { label: 'Failed',          color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20' },
  duplicate:           { label: 'Duplicate',       color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20' },
  processing:          { label: 'Processing',      color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20' },
  received:            { label: 'Received',        color: 'text-gray-400',   bg: 'bg-gray-500/10',   border: 'border-gray-500/20' },
  skipped_disabled:    { label: 'Skipped (Disabled)', color: 'text-gray-400', bg: 'bg-gray-500/10',   border: 'border-gray-500/20' },
  skipped_form_filter: { label: 'Form Filtered',   color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
};

function renderDiagnosticCard(log: WebhookLogEntry) {
  if (!log.error_message) return null;
  
  let parsedErr: any = null;
  try {
    if (log.error_message.startsWith('{')) {
      parsedErr = JSON.parse(log.error_message);
    }
  } catch (e) {}

  if (parsedErr) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-3 font-sans text-xs text-white animate-fade-in">
        <div className="flex items-center justify-between border-b border-red-500/20 pb-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-red-400 text-sm">warning</span>
            <span className="font-bold text-red-400 uppercase tracking-wider text-[11px] font-mono">
              {parsedErr.provider || 'META GRAPH API'} ERROR (HTTP {parsedErr.httpStatus || 400})
            </span>
          </div>
          <span className="text-[10px] text-red-300/60 font-mono">
            ErrorCode: {parsedErr.errorCode || 'N/A'} {parsedErr.errorSubcode !== null && parsedErr.errorSubcode !== undefined ? `(Subcode: ${parsedErr.errorSubcode})` : ''}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] font-mono">
          <div>
            <span className="text-on-surface-variant/50 text-[9px] uppercase tracking-wider block">Error Type</span>
            <span className="text-red-300 font-bold">{parsedErr.errorType || 'OAuthException'}</span>
          </div>
          <div>
            <span className="text-on-surface-variant/50 text-[9px] uppercase tracking-wider block">FB Trace ID</span>
            <span className="text-white/80">{parsedErr.fbTraceId || 'N/A'}</span>
          </div>
          <div>
            <span className="text-on-surface-variant/50 text-[9px] uppercase tracking-wider block">Leadgen ID</span>
            <span className="text-white/80">{log.leadgen_id || parsedErr.leadgenId || 'N/A'}</span>
          </div>
          <div>
            <span className="text-on-surface-variant/50 text-[9px] uppercase tracking-wider block">Page ID / Form ID</span>
            <span className="text-white/80">{log.page_id || 'N/A'} / {log.form_id || 'N/A'}</span>
          </div>
          <div className="sm:col-span-2">
            <span className="text-on-surface-variant/50 text-[9px] uppercase tracking-wider block">Message</span>
            <span className="text-red-200">{parsedErr.message || 'Error occurred during Graph API call'}</span>
          </div>
          <div className="sm:col-span-2">
            <span className="text-on-surface-variant/50 text-[9px] uppercase tracking-wider block">Request URL</span>
            <span className="text-white/60 break-all">{parsedErr.requestUrl || 'https://graph.facebook.com/v26.0/...'}</span>
          </div>
        </div>

        {parsedErr.recommendation && (
          <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-amber-200 text-[11px] space-y-1">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-amber-400">
              <span className="material-symbols-outlined text-xs">build</span>
              Actionable Fix Recommendation
            </div>
            <p>{parsedErr.recommendation}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-3 bg-red-500/5 border border-red-500/15 rounded-lg text-red-400 font-mono text-[11px]">
      <span className="font-bold text-[9px] uppercase tracking-wider block mb-1 font-sans">Error Details:</span>
      <p className="whitespace-pre-wrap break-words">{log.error_message}</p>
    </div>
  );
}

function formatRawPayload(rawPayload: string | undefined | null): string {
  if (!rawPayload) return 'No raw payload recorded.';
  try {
    const parsed = JSON.parse(rawPayload);
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    return rawPayload;
  }
}

export default function MetaIntegrationPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'setup' | 'settings' | 'logs'>('setup');
  const [logFilter, setLogFilter] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  // Password / Secret masking states
  const [showAppSecret, setShowAppSecret] = useState(false);
  const [showPageAccessToken, setShowPageAccessToken] = useState(false);

  // Validation Action states
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);

  // Connection Test Diagnostics states
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [showTestModal, setShowTestModal] = useState(false);

  // Load active staff members for assignment dropdown
  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffAPI.list({ status: 'active' }),
  });
  const staffList = staffData?.data || [];

  // Settings form query & state targeting `/api/v1/integrations/meta/settings`
  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ['metaSettings'],
    queryFn: integrationsAPI.getMetaSettings,
  });

  const [form, setForm] = useState<MetaIntegrationSettings>({
    facebookEnabled: false,
    instagramEnabled: false,
    appId: '',
    appSecret: '',
    pageId: '',
    pageAccessToken: '',
    verifyToken: 'GOC_META_WEBHOOK_2024',
    autoAssignStaffId: null,
    allowedFormIds: '',
  });
  
  React.useEffect(() => {
    if (settingsData?.data) {
      setForm({
        facebookEnabled: !!settingsData.data.facebookEnabled,
        instagramEnabled: !!settingsData.data.instagramEnabled,
        appId: settingsData.data.appId || '',
        appSecret: settingsData.data.appSecret || '',
        pageId: settingsData.data.pageId || '',
        pageAccessToken: settingsData.data.pageAccessToken || '',
        verifyToken: settingsData.data.verifyToken || 'GOC_META_WEBHOOK_2024',
        autoAssignStaffId: settingsData.data.autoAssignStaffId,
        allowedFormIds: settingsData.data.allowedFormIds || '',
      });
    }
  }, [settingsData]);

  const saveSettingsMutation = useMutation({
    mutationFn: (payload: Partial<MetaIntegrationSettings>) => integrationsAPI.updateMetaSettings(payload),
    onSuccess: () => { 
      toast.success('Meta configuration saved successfully!'); 
      queryClient.invalidateQueries({ queryKey: ['metaSettings'] });
      queryClient.invalidateQueries({ queryKey: ['webhookStatus'] });
    },
    onError: () => toast.error('Failed to save configuration settings.'),
  });

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate({
      facebookEnabled: form.facebookEnabled,
      instagramEnabled: form.instagramEnabled,
      appId: form.appId,
      appSecret: form.appSecret,
      pageId: form.pageId,
      pageAccessToken: form.pageAccessToken,
      verifyToken: form.verifyToken,
      autoAssignStaffId: form.autoAssignStaffId ? Number(form.autoAssignStaffId) : null,
      allowedFormIds: form.allowedFormIds,
    });
  };

  // Webhook status
  const { data: statusRes, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ['webhookStatus'],
    queryFn: webhooksAPI.getStatus,
    refetchInterval: 30000,
  });
  const status = statusRes?.data;

  // Logs
  const { data: logsRes, isLoading: logsLoading } = useQuery({
    queryKey: ['webhookLogs', logFilter],
    queryFn: () => webhooksAPI.getLogs({ status: logFilter || undefined }),
    enabled: activeTab === 'logs',
  });
  const logs = logsRes?.data || [];

  // Compute webhook URL for display
  const webhookUrl = `${window.location.origin.replace('5173', '4000')}/api/v1/webhooks/meta`;

  // Subscription state
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Subscribe Meta Page App Handler
  const handleSubscribe = async () => {
    setIsSubscribing(true);
    try {
      const res = await integrationsAPI.subscribeMetaPageApp();
      if (res.success) {
        toast.success((res as any).message || 'Page leadgen webhooks subscribed successfully!');
        queryClient.invalidateQueries({ queryKey: ['webhookStatus'] });
      } else {
        toast.error((res as any).error?.message || 'Page subscription failed.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to subscribe Page webhooks');
    } finally {
      setIsSubscribing(false);
    }
  };

  // Validate Meta Connection Action Handler
  const handleValidate = async () => {
    setIsValidating(true);
    setValidationResult(null);
    try {
      const res = await integrationsAPI.validateMetaConnection();
      if (res.success && res.data) {
        setValidationResult(res.data);
        if (res.data.pageConnected && res.data.webhookVerified && res.data.leadSyncEnabled) {
          toast.success(`Connected! Verified for Page: "${res.data.data?.pageName || 'Connected Page'}"`);
        } else if (res.data.error) {
          toast.error(`Validation Error: ${res.data.error}`);
        } else {
          toast.error('Validation completed. Warning: check missing subscription status.');
        }
        queryClient.invalidateQueries({ queryKey: ['webhookStatus'] });
      } else {
        toast.error((res as any).error?.message || 'Connection validation failed');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error?.message || 'Failed to validate Meta connection');
    } finally {
      setIsValidating(false);
    }
  };

  // Run Detailed Test Diagnostics Action Handler
  const handleRunTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    setShowTestModal(true);
    try {
      const res = await integrationsAPI.runMetaTest();
      if (res.success && res.data) {
        setTestResult(res.data);
      } else {
        setTestResult({
          tokenValid: false,
          pageConnected: false,
          permissions: {},
          appSubscribed: false,
          logs: ['Error: Failed to obtain response from test diagnostics.']
        });
      }
    } catch (err: any) {
      console.error(err);
      setTestResult({
        tokenValid: false,
        pageConnected: false,
        permissions: {},
        appSubscribed: false,
        logs: [`Error: Diagnostics request failed — ${err.response?.data?.error?.message || err.message}`]
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="font-display-hero text-headline-lg text-white tracking-tight italic">
          META <span className="text-performance-red not-italic font-light">LEAD INTEGRATION</span>
        </h1>
        <p className="font-label-caps text-label-caps text-on-surface-variant/70 tracking-widest mt-1">
          FACEBOOK + INSTAGRAM → GOC CRM — AUTOMATIC LEAD IMPORT
        </p>
      </div>

      {/* Status Bar */}
      {status && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-in">
          {[
            { label: 'Total Events', value: Number(status.stats?.total || 0), color: 'text-white', icon: 'webhook' },
            { label: 'Leads Created', value: Number(status.stats?.success || 0), color: 'text-green-400', icon: 'person_add' },
            { label: 'Duplicates', value: Number(status.stats?.duplicate || 0), color: 'text-amber-400', icon: 'content_copy' },
            { label: 'Failed', value: Number(status.stats?.failed || 0), color: 'text-red-400', icon: 'error' },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="bg-[#0c0c0c]/45 backdrop-blur-2xl rounded-xl p-4 border border-white/5 shadow-md hover:border-white/10 transition-all">
              <div className="flex items-center gap-2 mb-1">
                <span className={`material-symbols-outlined text-sm ${color}`}>{icon}</span>
                <p className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest">{label}</p>
              </div>
              <p className={`font-data-sm text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Connection Status Banner (Subscription Status) */}
      <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl rounded-xl p-4 border border-white/5 shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Webhook Verified', ok: status?.webhookConfigured, icon: 'webhook' },
            { label: 'Page Connected', ok: status?.pageConnected, icon: 'link' },
            { label: 'Lead Sync Enabled', ok: status?.facebookLeadSyncEnabled || status?.instagramLeadSyncEnabled, icon: 'thumb_up' },
          ].map(({ label, ok, icon }) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${ok ? 'bg-green-500/10' : 'bg-amber-500/10'}`}>
                  <span className={`material-symbols-outlined text-lg ${ok ? 'text-green-400' : 'text-amber-400'}`}>{icon}</span>
                </div>
                <div>
                  <p className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest">{label}</p>
                  <p className={`text-xs font-bold ${ok ? 'text-green-400' : 'text-amber-400'}`}>{ok ? 'Active' : 'Not Configured'}</p>
                </div>
              </div>
              <div className="text-sm select-none">{ok ? '✅' : '❌'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1.5 p-1 bg-black/30 border border-white/5 rounded-xl w-fit max-w-full overflow-x-auto custom-scrollbar">
        {([
          { key: 'setup', label: 'Setup Guide', icon: 'menu_book' },
          { key: 'settings', label: 'Configuration', icon: 'settings' },
          { key: 'logs', label: 'Event Logs', icon: 'history' },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 hover:cursor-pointer ${
              activeTab === tab.key
                ? 'bg-performance-red/10 border border-performance-red/20 text-performance-red shadow-[0_0_15px_rgba(255,43,43,0.15)]'
                : 'text-on-surface-variant/50 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-sm">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
        <button onClick={() => { refetchStatus(); toast.success('Status refreshed'); }}
          className="px-2.5 py-1.5 border border-white/10 rounded-lg text-on-surface-variant/50 hover:text-white transition-all hover:cursor-pointer flex items-center justify-center">
          <span className="material-symbols-outlined text-sm">refresh</span>
        </button>
      </div>

      {/* SETUP GUIDE TAB */}
      {activeTab === 'setup' && (
        <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 space-y-6 animate-fade-in">
          <p className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest">QUICK SETUP GUIDE</p>

          {/* Webhook URL */}
          <div className="p-4 rounded-xl border border-performance-red/25 bg-performance-red/5">
            <p className="font-label-caps text-[9px] text-performance-red tracking-widest mb-2 font-bold">YOUR WEBHOOK URL (copy this to Meta)</p>
            <div className="flex items-center gap-3">
              <code className="flex-1 text-xs text-white font-mono bg-black/40 px-3 py-2.5 rounded-lg break-all border border-white/5 select-all">
                {webhookUrl}
              </code>
              <button
                onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('Webhook URL copied!'); }}
                className="p-2.5 rounded-lg border border-white/10 hover:border-performance-red/30 text-on-surface-variant/50 hover:text-performance-red hover:bg-performance-red/5 transition-all hover:cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">content_copy</span>
              </button>
            </div>
          </div>

          {/* Verify Token */}
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 flex items-center justify-between">
            <div>
              <p className="font-label-caps text-[9px] text-blue-400 tracking-widest mb-1 font-bold">YOUR VERIFY TOKEN (enter in Meta webhook setup)</p>
              <code className="text-sm text-white font-mono">{form.verifyToken || 'GOC_META_WEBHOOK_2024'}</code>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(form.verifyToken || 'GOC_META_WEBHOOK_2024'); toast.success('Verify Token copied!'); }}
              className="p-2.5 rounded-lg border border-white/10 hover:border-blue-400/30 text-on-surface-variant/50 hover:text-blue-400 hover:bg-blue-400/5 transition-all hover:cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">content_copy</span>
            </button>
          </div>

          {/* Steps */}
          <div className="space-y-4 pt-2">
            {[
              { step: '01', title: 'Open Meta App Dashboard', desc: 'Go to developers.facebook.com → Your App → Add Product → Webhooks' },
              { step: '02', title: 'Configure Webhook Callback', desc: `Select Page webhook from the dropdown, click Subscribe and paste the Callback URL and Verify Token shown above` },
              { step: '03', title: 'Subscribe to leadgen events', desc: 'In Webhooks → Page subscription fields, locate "leadgen" and click Subscribe' },
              { step: '04', title: 'Generate Page Access Token', desc: 'Go to Meta Business Suite → settings, or use Graph API Explorer to generate a permanent Page Access Token with leads_retrieval and pages_read_engagement permissions' },
              { step: '05', title: 'Configure GOC Settings', desc: 'Go to the Configuration tab here and paste the App ID, App Secret, and Page Access Token' },
              { step: '06', title: 'Test Lead Ads Integration', desc: 'Use the Meta Lead Ads Testing Tool (developers.facebook.com/tools/lead-ads-testing) to submit a test form. Verify that details are captured inside Event Logs and appear as a new lead.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-4 items-start border-l-2 border-white/5 pl-4 ml-2 hover:border-performance-red/35 transition-all py-1">
                <div className="w-6 h-6 rounded bg-performance-red/10 border border-performance-red/20 flex items-center justify-center shrink-0">
                  <span className="font-label-caps text-[10px] text-performance-red font-bold">{step}</span>
                </div>
                <div>
                  <p className="text-sm text-white font-bold">{title}</p>
                  <p className="text-xs text-on-surface-variant/60 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONFIGURATION TAB */}
      {activeTab === 'settings' && (
        <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 space-y-6 animate-fade-in">
          <div className="flex justify-between items-center border-b border-white/5 pb-4">
            <p className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest">META INTEGRATION CONFIGURATION</p>
            {saveSettingsMutation.isPending && (
              <span className="text-xs text-performance-red animate-pulse flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-performance-red inline-block"></span>
                Saving settings...
              </span>
            )}
          </div>

          {/* Validation Banner results */}
          {validationResult && (
            <div className={`p-4 rounded-xl border ${
              (validationResult.pageConnected && validationResult.leadSyncEnabled) 
                ? 'border-green-500/20 bg-green-500/5 text-green-400' 
                : 'border-red-500/20 bg-red-500/5 text-red-400'
            } space-y-2 animate-fade-in`}>
              <div className="flex items-center justify-between">
                <p className="font-label-caps text-[9px] tracking-widest uppercase font-bold text-white">Connection Verification Result</p>
                <button 
                  onClick={() => setValidationResult(null)} 
                  className="text-on-surface-variant/40 hover:text-white text-xs font-bold transition-all hover:cursor-pointer"
                >
                  Clear
                </button>
              </div>
              <div className="text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-white/80">Connection Status:</span>
                  <span className="font-bold">
                    {(validationResult.pageConnected && validationResult.leadSyncEnabled) ? 'Connected' : 'Error / Incomplete'}
                  </span>
                </div>
                {validationResult.error && (
                  <p className="text-red-400 bg-red-950/20 p-2 rounded border border-red-500/10 text-[11px] font-mono leading-relaxed mt-2">
                    {validationResult.error}
                  </p>
                )}
                {validationResult.data && (
                  <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                    <p className="text-white/60">Page: <span className="text-white font-bold">{validationResult.data.pageName}</span> (ID: {validationResult.data.pageId})</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] bg-black/40 p-2 rounded mt-1.5 text-white/80">
                      <div>Permission leads_retrieval: {validationResult.data.permissions?.leads_retrieval ? '✅ Granted' : '❌ Missing'}</div>
                      <div>Permission pages_read_engagement: {validationResult.data.permissions?.pages_read_engagement ? '✅ Granted' : '❌ Missing'}</div>
                      <div className="sm:col-span-2">Webhook App Subscription: {validationResult.data.appSubscribed ? '✅ Subscribed' : '❌ Not Subscribed'}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sync Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'facebookEnabled', label: 'Enable Facebook Lead Import', icon: 'thumb_up', color: 'text-blue-400' },
              { key: 'instagramEnabled', label: 'Enable Instagram Lead Import', icon: 'photo_camera', color: 'text-pink-400' },
            ].map(({ key, label, icon, color }) => {
              const isActive = !!(form as any)[key];
              return (
                <div key={key} className="flex items-center justify-between p-4 rounded-xl border border-white/[0.05] bg-white/[0.01] hover:border-white/10 transition-all">
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined text-lg ${color}`}>{icon}</span>
                    <p className="text-sm font-bold text-white">{label}</p>
                  </div>
                  <button
                    onClick={() => setForm(prev => ({ ...prev, [key]: !prev[key as keyof MetaIntegrationSettings] }))}
                    className={`relative w-11 h-6 rounded-full transition-colors hover:cursor-pointer ${isActive ? 'bg-performance-red' : 'bg-white/10'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Credentials Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-xs text-on-surface-variant/80 uppercase tracking-widest font-bold">Meta App ID *</label>
              <input
                type="text"
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-performance-red/50 transition-all placeholder-white/20"
                placeholder="Enter App ID"
                value={form.appId || ''}
                onChange={e => setForm(p => ({ ...p, appId: e.target.value }))}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-xs text-on-surface-variant/80 uppercase tracking-widest font-bold">Meta App Secret *</label>
              <div className="relative">
                <input
                  type={showAppSecret ? 'text' : 'password'}
                  className="w-full bg-black border border-white/10 rounded-lg pl-3 pr-10 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-performance-red/50 transition-all placeholder-white/20"
                  placeholder="••••••••••••••••"
                  value={form.appSecret || ''}
                  onChange={e => setForm(p => ({ ...p, appSecret: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowAppSecret(!showAppSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-white select-none hover:cursor-pointer flex items-center"
                >
                  <span className="material-symbols-outlined text-lg">
                    {showAppSecret ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-xs text-on-surface-variant/80 uppercase tracking-widest font-bold">Facebook Page ID (Optional / Auto-detect)</label>
              <input
                type="text"
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-performance-red/50 transition-all placeholder-white/20"
                placeholder="e.g. 109283749201"
                value={form.pageId || ''}
                onChange={e => setForm(p => ({ ...p, pageId: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="font-label-caps text-xs text-on-surface-variant/80 uppercase tracking-widest font-bold">Page Access Token *</label>
              <div className="relative">
                <textarea
                  rows={3}
                  className="w-full bg-black border border-white/10 rounded-lg pl-3 pr-10 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-performance-red/50 transition-all placeholder-white/20"
                  style={{ WebkitTextSecurity: showPageAccessToken ? 'none' : 'disc' } as React.CSSProperties}
                  placeholder="EAAW..."
                  value={form.pageAccessToken || ''}
                  onChange={e => setForm(p => ({ ...p, pageAccessToken: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPageAccessToken(!showPageAccessToken)}
                  className="absolute right-3 top-4 text-on-surface-variant/50 hover:text-white select-none hover:cursor-pointer flex items-center"
                >
                  <span className="material-symbols-outlined text-lg">
                    {showPageAccessToken ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              <p className="text-[10px] text-on-surface-variant/50">Provide a long-lived page access token (or system user token) from the Meta App Console.</p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-xs text-on-surface-variant/80 uppercase tracking-widest font-bold">Verify Token</label>
              <input
                type="text"
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-performance-red/50 transition-all placeholder-white/20"
                placeholder="GOC_META_WEBHOOK_2024"
                value={form.verifyToken || ''}
                onChange={e => setForm(p => ({ ...p, verifyToken: e.target.value }))}
              />
              <p className="text-[10px] text-on-surface-variant/50">Change this token to secure your endpoints.</p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-xs text-on-surface-variant/80 uppercase tracking-widest font-bold">Auto-Assign To Staff</label>
              <select
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-performance-red/50 transition-all"
                value={form.autoAssignStaffId || ''}
                onChange={e => setForm(p => ({ ...p, autoAssignStaffId: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">No auto-assignment</option>
                {staffList.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>
                ))}
              </select>
              <p className="text-[10px] text-on-surface-variant/50">Select a manager or sales member to auto-assign incoming leads.</p>
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="font-label-caps text-xs text-on-surface-variant/80 uppercase tracking-widest font-bold">Allowed Form IDs (Optional)</label>
              <textarea
                rows={2}
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-performance-red/50 transition-all placeholder-white/20"
                placeholder="Enter form IDs separated by commas or newlines, e.g. 129038290382, 129382938292"
                value={form.allowedFormIds || ''}
                onChange={e => setForm(p => ({ ...p, allowedFormIds: e.target.value }))}
              />
              <p className="text-[10px] text-on-surface-variant/50">Leave empty to accept leads from all forms. Specify form IDs to filter and sync only those campaigns.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex flex-wrap justify-between items-center gap-3">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleValidate}
                disabled={isValidating || settingsLoading}
                className="px-4 py-2.5 bg-black border border-white/10 hover:border-white/20 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 hover:cursor-pointer flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">{isValidating ? 'sync' : 'verified'}</span>
                {isValidating ? 'Validating...' : 'Validate Connection'}
              </button>
              
              <button
                type="button"
                onClick={handleSubscribe}
                disabled={isSubscribing || settingsLoading}
                className="px-4 py-2.5 bg-black border border-white/10 hover:border-white/20 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 hover:cursor-pointer flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">{isSubscribing ? 'sync' : 'notifications_active'}</span>
                {isSubscribing ? 'Subscribing...' : 'Subscribe Page Webhooks'}
              </button>

              <button
                type="button"
                onClick={handleRunTest}
                disabled={isTesting || settingsLoading}
                className="px-4 py-2.5 bg-black border border-white/10 hover:border-white/20 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 hover:cursor-pointer flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">{isTesting ? 'sync' : 'diagnostics'}</span>
                {isTesting ? 'Testing...' : 'Run Diagnostics'}
              </button>
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={saveSettingsMutation.isPending || settingsLoading}
              className="px-6 py-3 bg-gradient-to-r from-performance-red to-deep-crimson text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:cursor-pointer disabled:opacity-50 transition-all shadow-md flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              Save Configuration
            </button>
          </div>
        </div>
      )}

      {/* EVENT LOGS TAB */}
      {activeTab === 'logs' && (
        <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border-b border-white/5 pb-4">
            <p className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest font-bold">WEBHOOK AUDIT & STATUS LOGS</p>
            
            <div className="flex gap-2">
              {['', 'success', 'duplicate', 'failed'].map(st => (
                <button
                  key={st}
                  onClick={() => setLogFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all hover:cursor-pointer border ${
                    logFilter === st
                      ? 'bg-white/10 border-white/20 text-white font-bold'
                      : 'border-transparent text-on-surface-variant/45 hover:text-white'
                  }`}
                >
                  {st || 'All'}
                </button>
              ))}
            </div>
          </div>

          {logsLoading ? (
            <div className="text-center py-10">
              <div className="w-8 h-8 border-2 border-performance-red border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-on-surface-variant/40 font-label-caps">Loading audit entries...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-white/5 rounded-xl">
              <span className="material-symbols-outlined text-3xl text-on-surface-variant/20 mb-2">history</span>
              <p className="text-xs text-on-surface-variant/50 font-bold">No webhook audit events found matching the filter.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log: WebhookLogEntry) => {
                const conf = STATUS_CONFIG[log.processing_status] || { label: log.processing_status, color: 'text-white', bg: 'bg-white/5', border: 'border-white/10' };
                const isExpanded = expandedLogId === log.id;
                
                return (
                  <div key={log.id} className="border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-all bg-white/[0.005]">
                    <div
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:cursor-pointer hover:bg-white/[0.01]"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${conf.bg} ${conf.color} border ${conf.border}`}>
                          {conf.label}
                        </div>
                        <div>
                          <p className="text-xs text-white font-mono font-bold">
                            leadgen_id: {log.leadgen_id || 'N/A'}
                          </p>
                          <p className="text-[10px] text-on-surface-variant/40 mt-0.5">
                            {new Date(log.created_at).toLocaleString('en-IN')} | Form: {log.form_id || 'N/A'} | Page: {log.page_id || 'N/A'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        {log.created_lead_id && (
                          <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
                            Lead #{log.created_lead_id}
                          </span>
                        )}
                        <span className="material-symbols-outlined text-sm text-on-surface-variant/40 transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                          expand_more
                        </span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-white/5 p-4 bg-black/40 space-y-3 font-mono text-[11px] text-on-surface-variant/80">
                        {log.error_message && (
                          <div className="space-y-2">
                            <span className="font-bold text-[9px] uppercase tracking-wider block text-on-surface-variant/50 font-sans">
                              Developer Diagnostics & Error Card
                            </span>
                            {renderDiagnosticCard(log)}
                          </div>
                        )}
                        <div>
                          <span className="font-bold text-[9px] uppercase tracking-wider block mb-1 text-on-surface-variant/50 font-sans">
                            Raw Callback Payload & Execution Trace
                          </span>
                          <pre className="p-3 bg-black border border-white/5 rounded-lg text-white overflow-x-auto max-h-60 leading-relaxed scrollbar-thin scrollbar-thumb-white/10 whitespace-pre-wrap break-all">
                            {formatRawPayload(log.raw_payload)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Test Diagnostics Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pt-20 sm:pt-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-scale-in">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-black/40">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-performance-red">diagnostics</span>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Meta Connection Diagnostics</h3>
              </div>
              <button
                onClick={() => setShowTestModal(false)}
                className="text-on-surface-variant/50 hover:text-white transition-colors hover:cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
              {isTesting ? (
                <div className="text-center py-12 flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-performance-red border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-on-surface-variant/60 font-label-caps tracking-wider">Running Graph API Telemetry Checks...</p>
                </div>
              ) : testResult ? (
                <div className="space-y-4">
                  {/* Status Checklist Card */}
                  <div className="p-4 rounded-xl bg-black border border-white/5 space-y-3">
                    <p className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest font-bold">Diagnostic Checklist</p>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-white/70">Page Connection (me)</span>
                        <span className="font-bold">{testResult.pageConnected ? '✅ Valid' : '❌ Failed'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/70">Token Validity (OAuth)</span>
                        <span className="font-bold">{testResult.tokenValid ? '✅ Active' : '❌ Expired/Invalid'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/70">leads_retrieval permission</span>
                        <span className="font-bold">{testResult.permissions?.leads_retrieval ? '✅ Granted' : '❌ Missing'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/70">pages_read_engagement permission</span>
                        <span className="font-bold">{testResult.permissions?.pages_read_engagement ? '✅ Granted' : '❌ Missing'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/70">App Page Subscription</span>
                        <span className="font-bold">{testResult.appSubscribed ? '✅ Subscribed' : '❌ Unsubscribed'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Logs Terminal */}
                  <div className="space-y-1.5">
                    <p className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest font-bold">Execution Logs</p>
                    <div className="bg-black/90 p-4 rounded-lg font-mono text-[10px] leading-relaxed text-green-400 border border-white/5 max-h-60 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-white/10">
                      {testResult.logs?.map((log: string, idx: number) => (
                        <div key={idx} className={log.startsWith('❌') ? 'text-red-400' : log.startsWith('⚠️') ? 'text-amber-400' : 'text-green-400'}>
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-on-surface-variant/50">No diagnostics run yet.</p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-white/5 bg-black/40 flex justify-end">
              <button
                onClick={() => setShowTestModal(false)}
                className="px-4 py-2 border border-white/10 rounded-lg text-white text-xs font-bold uppercase tracking-wider hover:border-white/20 transition-all hover:cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
