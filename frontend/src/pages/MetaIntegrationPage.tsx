import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { webhooksAPI, WebhookLogEntry } from '../api/webhooks';
import { settingsApi } from '../api/settings';
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

export default function MetaIntegrationPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'setup' | 'settings' | 'logs'>('setup');
  const [logFilter, setLogFilter] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  // Load active staff members for assignment dropdown
  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffAPI.list({ status: 'active' }),
  });
  const staffList = staffData?.data || [];

  // Settings form query & state
  const { data: settingsData } = useQuery({ queryKey: ['settings'], queryFn: settingsApi.getAll });
  const [form, setForm] = useState<Record<string, string>>({});
  
  React.useEffect(() => {
    if (settingsData) {
      const f: Record<string, string> = {};
      [
        'META_FB_LEADS_ENABLED', 'META_IG_LEADS_ENABLED',
        'META_APP_ID', 'META_APP_SECRET', 'META_VERIFY_TOKEN',
        'META_PAGE_ACCESS_TOKEN', 'META_DEFAULT_ASSIGNED_STAFF',
        'META_LEAD_FORM_IDS',
      ].forEach(k => { f[k] = settingsData[k]?.value || ''; });
      if (!f['META_VERIFY_TOKEN']) f['META_VERIFY_TOKEN'] = 'GOC_META_WEBHOOK_2024';
      setForm(f);
    }
  }, [settingsData]);

  const saveSettingsMutation = useMutation({
    mutationFn: () => settingsApi.batchUpdate(
      Object.entries(form).map(([key, value]) => ({ key, value }))
    ),
    onSuccess: () => { 
      toast.success('Settings saved!'); 
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['webhookStatus'] });
    },
    onError: () => toast.error('Failed to save settings.'),
  });

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

      {/* Connection Status Banner */}
      <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl rounded-xl p-4 border border-white/5 shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Webhook Configured', ok: status?.webhookConfigured, icon: 'webhook' },
            { label: 'Page Token Connected', ok: status?.pageConnected, icon: 'link' },
            { label: 'Facebook/Instagram Sync', ok: status?.facebookLeadSyncEnabled || status?.instagramLeadSyncEnabled, icon: 'thumb_up' },
          ].map(({ label, ok, icon }) => (
            <div key={label} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${ok ? 'bg-green-500/10' : 'bg-amber-500/10'}`}>
                <span className={`material-symbols-outlined text-lg ${ok ? 'text-green-400' : 'text-amber-400'}`}>{icon}</span>
              </div>
              <div>
                <p className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest">{label}</p>
                <p className={`text-xs font-bold ${ok ? 'text-green-400' : 'text-amber-400'}`}>{ok ? 'Active' : 'Not Configured'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1.5 p-1 bg-black/30 border border-white/5 rounded-xl w-fit">
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
              <code className="text-sm text-white font-mono">{form['META_VERIFY_TOKEN'] || 'GOC_META_WEBHOOK_2024'}</code>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(form['META_VERIFY_TOKEN'] || 'GOC_META_WEBHOOK_2024'); toast.success('Verify Token copied!'); }}
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

      {/* SETTINGS TAB */}
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

          {/* Sync Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'META_FB_LEADS_ENABLED', label: 'Enable Facebook Lead Import', icon: 'thumb_up', color: 'text-blue-400' },
              { key: 'META_IG_LEADS_ENABLED', label: 'Enable Instagram Lead Import', icon: 'photo_camera', color: 'text-pink-400' },
            ].map(({ key, label, icon, color }) => {
              const isActive = form[key] === 'true';
              return (
                <div key={key} className="flex items-center justify-between p-4 rounded-xl border border-white/[0.05] bg-white/[0.01] hover:border-white/10 transition-all">
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined text-lg ${color}`}>{icon}</span>
                    <p className="text-sm font-bold text-white">{label}</p>
                  </div>
                  <button
                    onClick={() => setForm(prev => ({ ...prev, [key]: prev[key] === 'true' ? 'false' : 'true' }))}
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
              <label className="font-label-caps text-xs text-on-surface-variant/80 uppercase tracking-widest font-bold">Meta App ID</label>
              <input
                type="text"
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-performance-red/50 transition-all placeholder-white/20"
                placeholder="Enter App ID"
                value={form['META_APP_ID'] || ''}
                onChange={e => setForm(p => ({ ...p, META_APP_ID: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-xs text-on-surface-variant/80 uppercase tracking-widest font-bold">Meta App Secret</label>
              <input
                type="password"
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-performance-red/50 transition-all placeholder-white/20"
                placeholder="••••••••••••••••"
                value={form['META_APP_SECRET'] || ''}
                onChange={e => setForm(p => ({ ...p, META_APP_SECRET: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="font-label-caps text-xs text-on-surface-variant/80 uppercase tracking-widest font-bold">Page Access Token</label>
              <textarea
                rows={3}
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-performance-red/50 transition-all placeholder-white/20"
                placeholder="EAAE..."
                value={form['META_PAGE_ACCESS_TOKEN'] || ''}
                onChange={e => setForm(p => ({ ...p, META_PAGE_ACCESS_TOKEN: e.target.value }))}
              />
              <p className="text-[10px] text-on-surface-variant/50">Provide a long-lived page access token (or system user token) from the Meta App Console.</p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-xs text-on-surface-variant/80 uppercase tracking-widest font-bold">Verify Token</label>
              <input
                type="text"
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-performance-red/50 transition-all placeholder-white/20"
                placeholder="GOC_META_WEBHOOK_2024"
                value={form['META_VERIFY_TOKEN'] || ''}
                onChange={e => setForm(p => ({ ...p, META_VERIFY_TOKEN: e.target.value }))}
              />
              <p className="text-[10px] text-on-surface-variant/50">Change this token to secure your endpoints.</p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-xs text-on-surface-variant/80 uppercase tracking-widest font-bold">Auto-Assign To Staff</label>
              <select
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-performance-red/50 transition-all"
                value={form['META_DEFAULT_ASSIGNED_STAFF'] || ''}
                onChange={e => setForm(p => ({ ...p, META_DEFAULT_ASSIGNED_STAFF: e.target.value }))}
              >
                <option value="">No auto-assignment</option>
                {staffList.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>
                ))}
              </select>
              <p className="text-[10px] text-on-surface-variant/50">Select a manager or sales member to auto-assign incoming leads.</p>
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="font-label-caps text-xs text-on-surface-variant/80 uppercase tracking-widest font-bold font-bold">Allowed Lead Form IDs (Optional)</label>
              <input
                type="text"
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-performance-red/50 transition-all placeholder-white/20"
                placeholder="Comma separated Form IDs e.g. 129038290382,129382938292"
                value={form['META_LEAD_FORM_IDS'] || ''}
                onChange={e => setForm(p => ({ ...p, META_LEAD_FORM_IDS: e.target.value }))}
              />
              <p className="text-[10px] text-on-surface-variant/50">Leave empty to accept leads from all forms. Specify form IDs to filter and sync only those campaigns.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex justify-end">
            <button
              onClick={() => saveSettingsMutation.mutate()}
              disabled={saveSettingsMutation.isPending}
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
            <p className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest">WEBHOOK AUDIT & STATUS LOGS</p>
            
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
              <p className="text-xs text-on-surface-variant/50">No webhook audit events found matching the filter.</p>
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
                          <div className="p-3 bg-red-500/5 border border-red-500/15 rounded-lg text-red-400">
                            <span className="font-bold text-[9px] uppercase tracking-wider block mb-1">Error Log:</span>
                            {log.error_message}
                          </div>
                        )}
                        <div>
                          <span className="font-bold text-[9px] uppercase tracking-wider block mb-1">Raw Callback Payload:</span>
                          <pre className="p-3 bg-black border border-white/5 rounded-lg text-white overflow-x-auto max-h-60 leading-relaxed scrollbar-thin scrollbar-thumb-white/10">
                            {JSON.stringify(JSON.parse(log.raw_payload || '{}'), null, 2)}
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
    </div>
  );
}
