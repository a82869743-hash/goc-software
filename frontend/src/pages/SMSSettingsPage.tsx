import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { smsAPI, SMSTemplate } from '../api/sms';
import { settingsApi } from '../api/settings';
import toast from 'react-hot-toast';

const EVENT_DESCRIPTIONS: Record<string, { icon: string; desc: string; trigger: string }> = {
  BOOKING_CONFIRMATION: { icon: 'calendar_add_on', desc: 'Sent when a new advance booking is confirmed', trigger: 'Booking creation' },
  BOOKING_REMINDER:     { icon: 'alarm', desc: 'Sent one day before the booked appointment', trigger: 'Daily cron at 8:00 AM' },
  JOB_CREATED:          { icon: 'precision_manufacturing', desc: 'Sent when a new job card is created', trigger: 'Job card creation' },
  VEHICLE_READY:        { icon: 'directions_car', desc: 'Sent when job status changes to Ready for pickup', trigger: 'Job status = ready' },
  INVOICE_GENERATED:    { icon: 'receipt', desc: 'Sent when an invoice or estimate is generated', trigger: 'Invoice creation' },
  PAYMENT_RECEIVED:     { icon: 'payments', desc: 'Sent when a payment is recorded against a job', trigger: 'Payment record' },
  SERVICE_FOLLOWUP_30D: { icon: 'history', desc: 'Sent 30 days after job delivery for re-engagement', trigger: 'Daily cron at 10:30 AM' },
};

export default function SMSSettingsPage() {
  const queryClient = useQueryClient();

  // ── Settings (SMS_ENABLED, auth key, sender ID etc.) ──
  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getAll,
  });

  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});
  React.useEffect(() => {
    if (settingsData) {
      const f: Record<string, string> = {};
      ['SMS_ENABLED', 'MSG91_SMS_AUTH_KEY', 'MSG91_SENDER_ID', 'MSG91_ENTITY_ID', 'MSG91_COUNTRY_CODE', 'MSG91_BASE_URL'].forEach(k => {
        f[k] = settingsData[k]?.value || '';
      });
      if (!f['SMS_ENABLED']) f['SMS_ENABLED'] = 'false';
      if (!f['MSG91_COUNTRY_CODE']) f['MSG91_COUNTRY_CODE'] = '91';
      if (!f['MSG91_SENDER_ID']) f['MSG91_SENDER_ID'] = 'GOCER';
      if (!f['MSG91_BASE_URL']) f['MSG91_BASE_URL'] = 'https://control.msg91.com';
      setSettingsForm(f);
    }
  }, [settingsData]);

  const saveSettingsMutation = useMutation({
    mutationFn: () => settingsApi.batchUpdate(
      Object.entries(settingsForm).map(([key, value]) => ({ key, value }))
    ),
    onSuccess: () => { 
      toast.success('SMS settings saved successfully.'); 
      queryClient.invalidateQueries({ queryKey: ['settings'] }); 
    },
    onError: () => toast.error('Failed to save settings.'),
  });

  // ── Templates ──────────────────────────────────────────
  const { data: templatesRes } = useQuery({
    queryKey: ['smsTemplates'],
    queryFn: smsAPI.getTemplates,
  });
  const templates = (templatesRes?.data || []) as SMSTemplate[];
  
  // Local state to keep track of edited inputs for templates
  const [templateEdits, setTemplateEdits] = useState<Record<number, { dlt_template_id: string; msg91_flow_id: string }>>({});

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, dlt, flowId, active }: { id: number; dlt: string; flowId: string; active?: boolean }) =>
      smsAPI.updateTemplate(id, { dlt_template_id: dlt, msg91_flow_id: flowId, is_active: active }),
    onSuccess: () => { 
      toast.success('Template updated successfully.'); 
      queryClient.invalidateQueries({ queryKey: ['smsTemplates'] }); 
    },
    onError: () => toast.error('Failed to update template.'),
  });

  // ── Stats ──────────────────────────────────────────────
  const { data: statsRes } = useQuery({
    queryKey: ['smsStats'],
    queryFn: smsAPI.getStats,
    refetchInterval: 15000,
  });
  const stats = statsRes?.data || { pending: 0, sent: 0, failed: 0, total_today: 0 };

  // ── Logs ───────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'settings' | 'templates' | 'logs'>('settings');
  const [logFilter, setLogFilter] = useState('');
  const [logPage, setLogPage] = useState(1);
  const { data: logsRes, isPlaceholderData } = useQuery({
    queryKey: ['smsLogs', logFilter, logPage],
    queryFn: () => smsAPI.getLogs({ status: logFilter || undefined, page: logPage }),
    enabled: activeTab === 'logs',
  });
  
  const logs = logsRes?.data || [];
  const meta = logsRes?.meta || { total: 0, page: 1, limit: 50, totalPages: 1 };

  const retryMutation = useMutation({
    mutationFn: (id: number) => smsAPI.retryFailed(id),
    onSuccess: () => { 
      toast.success('SMS queued for retry.'); 
      queryClient.invalidateQueries({ queryKey: ['smsLogs'] }); 
      queryClient.invalidateQueries({ queryKey: ['smsStats'] }); 
    },
    onError: () => toast.error('Failed to retry SMS.'),
  });

  const smsEnabled = settingsForm['SMS_ENABLED'] === 'true';

  const handleTemplateInputChange = (id: number, field: 'dlt_template_id' | 'msg91_flow_id', val: string) => {
    const original = templates.find(t => t.id === id);
    const existingEdits = templateEdits[id] || {
      dlt_template_id: original?.dlt_template_id || '',
      msg91_flow_id: original?.msg91_flow_id || '',
    };
    setTemplateEdits(prev => ({
      ...prev,
      [id]: {
        ...existingEdits,
        [field]: val
      }
    }));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div>
        <h1 className="font-display-hero text-headline-lg text-white tracking-tight italic">
          SMS <span className="text-performance-red not-italic font-light">INTEGRATION</span>
        </h1>
        <p className="font-label-caps text-label-caps text-on-surface-variant/70 tracking-widest mt-1">
          MSG91 — 7 EVENT TRIGGERS — QUEUE-BASED ARCHITECTURE
        </p>
      </div>

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pending Queue', value: stats.pending, color: 'text-amber-400', icon: 'hourglass_top' },
          { label: 'Sent Today', value: stats.total_today, color: 'text-green-400', icon: 'check_circle' },
          { label: 'All Sent Logs', value: stats.sent, color: 'text-blue-400', icon: 'send' },
          { label: 'Failed Logs', value: stats.failed, color: 'text-red-400', icon: 'error' },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-1">
              <span className={`material-symbols-outlined text-[16px] ${color}`}>{icon}</span>
              <p className="font-label-caps text-[9px] text-tertiary/40 tracking-widest uppercase">{label}</p>
            </div>
            <p className={`font-mono text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Status Banner ── */}
      <div className={`bg-[#0c0c0c]/45 backdrop-blur-2xl rounded-xl p-4 border flex items-center gap-4 ${smsEnabled ? 'border-green-500/20 bg-green-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
        <div className={`w-3 h-3 rounded-full ${smsEnabled ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'bg-amber-400'} animate-pulse`} />
        <div>
          <p className={`font-label-caps text-xs tracking-widest ${smsEnabled ? 'text-green-400' : 'text-amber-400'}`}>
            SMS SYSTEM STATUS: {smsEnabled ? 'ACTIVE — MESSAGES ARE BEING SENT' : 'DISABLED — MESSAGES QUEUE SILENTLY'}
          </p>
          {!smsEnabled && (
            <p className="text-[11px] text-tertiary/50 mt-0.5">Enable SMS after registering templates on the DLT portal and filling MSG91 Flow IDs below.</p>
          )}
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="flex border-b border-white/5 pb-1">
        <div className="flex items-center gap-1.5 p-1 bg-black/30 border border-white/5 rounded-xl">
          {([
            { key: 'settings', label: 'MSG91 Config', icon: 'settings' },
            { key: 'templates', label: 'Templates & Flow IDs', icon: 'sms' },
            { key: 'logs', label: 'SMS logs', icon: 'history' },
          ] as { key: typeof activeTab; label: string; icon: string }[]).map(tab => (
            <button key={tab.key} onClick={() => { setActiveTab(tab.key); setLogPage(1); }}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all hover:cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-performance-red/10 border border-performance-red/20 text-performance-red shadow-[0_0_15px_rgba(255,43,43,0.15)]'
                  : 'text-tertiary/60 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── SETTINGS TAB ── */}
      {activeTab === 'settings' && (
        <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 space-y-6">
          <div>
            <h3 className="text-white font-bold text-base mb-1 uppercase font-label-caps tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-performance-red text-[20px]">tune</span>
              MSG91 Authentication Configuration
            </h3>
            <p className="text-tertiary text-xs">Configure your primary SMS gateway parameters. These settings are stored in the database key-value store.</p>
          </div>

          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-white/[0.05] bg-white/[0.01]">
            <div>
              <p className="text-sm text-white font-bold">Enable Transactional SMS Sending</p>
              <p className="text-xs text-tertiary/50 mt-0.5">Toggle to enable or mock SMS sending via the queue worker.</p>
            </div>
            <button
              onClick={() => setSettingsForm(prev => ({ ...prev, SMS_ENABLED: prev['SMS_ENABLED'] === 'true' ? 'false' : 'true' }))}
              className={`relative w-12 h-6 rounded-full transition-all duration-300 ${settingsForm['SMS_ENABLED'] === 'true' ? 'bg-performance-red' : 'bg-white/10'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${settingsForm['SMS_ENABLED'] === 'true' ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-xs text-tertiary/75 uppercase tracking-widest">MSG91 Auth Key</label>
              <input
                type="password"
                className="input-glass px-4 py-3 rounded-lg border border-white/10 bg-white/2 focus:border-performance-red focus:bg-white/4 focus:ring-1 focus:ring-performance-red/30 transition-all font-mono text-white w-full"
                placeholder="Enter MSG91 API auth key..."
                value={settingsForm['MSG91_SMS_AUTH_KEY'] || ''}
                onChange={e => setSettingsForm(p => ({ ...p, MSG91_SMS_AUTH_KEY: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-xs text-tertiary/75 uppercase tracking-widest">Sender ID / Header (DLT approved)</label>
              <input
                type="text"
                maxLength={6}
                className="input-glass px-4 py-3 rounded-lg border border-white/10 bg-white/2 focus:border-performance-red focus:bg-white/4 focus:ring-1 focus:ring-performance-red/30 transition-all font-mono text-white w-full"
                placeholder="e.g. GOCER"
                value={settingsForm['MSG91_SENDER_ID'] || ''}
                onChange={e => setSettingsForm(p => ({ ...p, MSG91_SENDER_ID: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-xs text-tertiary/75 uppercase tracking-widest">Principal Entity ID (DLT approved)</label>
              <input
                type="text"
                className="input-glass px-4 py-3 rounded-lg border border-white/10 bg-white/2 focus:border-performance-red focus:bg-white/4 focus:ring-1 focus:ring-performance-red/30 transition-all font-mono text-white w-full"
                placeholder="14-digit DLT Principal Entity ID"
                value={settingsForm['MSG91_ENTITY_ID'] || ''}
                onChange={e => setSettingsForm(p => ({ ...p, MSG91_ENTITY_ID: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-xs text-tertiary/75 uppercase tracking-widest">Default Country Code</label>
              <input
                type="text"
                className="input-glass px-4 py-3 rounded-lg border border-white/10 bg-white/2 focus:border-performance-red focus:bg-white/4 focus:ring-1 focus:ring-performance-red/30 transition-all font-mono text-white w-full"
                placeholder="e.g. 91"
                value={settingsForm['MSG91_COUNTRY_CODE'] || ''}
                onChange={e => setSettingsForm(p => ({ ...p, MSG91_COUNTRY_CODE: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="font-label-caps text-xs text-tertiary/75 uppercase tracking-widest">MSG91 Base API Url</label>
              <input
                type="text"
                className="input-glass px-4 py-3 rounded-lg border border-white/10 bg-white/2 focus:border-performance-red focus:bg-white/4 focus:ring-1 focus:ring-performance-red/30 transition-all font-mono text-white w-full"
                value={settingsForm['MSG91_BASE_URL'] || ''}
                onChange={e => setSettingsForm(p => ({ ...p, MSG91_BASE_URL: e.target.value }))}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex justify-end">
            <button
              onClick={() => saveSettingsMutation.mutate()}
              disabled={saveSettingsMutation.isPending}
              className="btn btn-primary px-6 py-3 rounded-xl font-bold uppercase tracking-wider text-xs flex items-center gap-2 hover:cursor-pointer transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">
                {saveSettingsMutation.isPending ? 'sync' : 'save'}
              </span>
              {saveSettingsMutation.isPending ? 'Saving settings...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      )}

      {/* ── TEMPLATES TAB ── */}
      {activeTab === 'templates' && (
        <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 space-y-6">
          <div>
            <h3 className="text-white font-bold text-base mb-1 uppercase font-label-caps tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-performance-red text-[20px]">sms</span>
              SMS Templates & flow IDs
            </h3>
            <p className="text-tertiary text-xs">Register DLT Template IDs and MSG91 Flow IDs for each of the 7 system events. Turn active toggle ON to enable queue processing for each event.</p>
          </div>

          <div className="space-y-4">
            {templates.map(t => {
              const info = EVENT_DESCRIPTIONS[t.event_key] || { icon: 'sms', desc: 'Custom template', trigger: 'Unknown trigger' };
              const edits = templateEdits[t.id] || {
                dlt_template_id: t.dlt_template_id || '',
                msg91_flow_id: t.msg91_flow_id || '',
              };

              const hasChanged = edits.dlt_template_id !== (t.dlt_template_id || '') ||
                                edits.msg91_flow_id !== (t.msg91_flow_id || '');

              return (
                <div key={t.id} className="p-5 rounded-xl border border-white/[0.05] bg-white/[0.01] flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-performance-red">
                        <span className="material-symbols-outlined text-lg">{info.icon}</span>
                      </div>
                      <div>
                        <h4 className="text-white font-bold text-sm">{t.template_name}</h4>
                        <p className="text-[10px] text-tertiary/60 font-mono uppercase tracking-wider">{t.event_key} · Trigger: {info.trigger}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-tertiary/50 uppercase tracking-widest font-bold">Active</span>
                      <button
                        onClick={() => updateTemplateMutation.mutate({ id: t.id, dlt: edits.dlt_template_id, flowId: edits.msg91_flow_id, active: t.is_active === 0 })}
                        className={`relative w-10 h-5 rounded-full transition-all duration-300 ${t.is_active ? 'bg-performance-red' : 'bg-white/10'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${t.is_active ? 'left-5' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-tertiary">{info.desc}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-tertiary/70 uppercase tracking-widest">DLT Template ID</label>
                      <input
                        type="text"
                        className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono placeholder-tertiary/30 focus:outline-none focus:border-performance-red"
                        placeholder="e.g. 12071618..."
                        value={edits.dlt_template_id}
                        onChange={e => handleTemplateInputChange(t.id, 'dlt_template_id', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-tertiary/70 uppercase tracking-widest">MSG91 Flow ID</label>
                      <input
                        type="text"
                        className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono placeholder-tertiary/30 focus:outline-none focus:border-performance-red"
                        placeholder="e.g. 64b34b12..."
                        value={edits.msg91_flow_id}
                        onChange={e => handleTemplateInputChange(t.id, 'msg91_flow_id', e.target.value)}
                      />
                    </div>
                  </div>

                  {hasChanged && (
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => updateTemplateMutation.mutate({ id: t.id, dlt: edits.dlt_template_id, flowId: edits.msg91_flow_id })}
                        disabled={updateTemplateMutation.isPending}
                        className="px-4 py-1.5 bg-performance-red/10 border border-performance-red/30 rounded-lg text-performance-red text-[10px] font-bold uppercase tracking-wider hover:bg-performance-red/20 transition-all flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-xs">save</span>
                        Save template values
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── LOGS TAB ── */}
      {activeTab === 'logs' && (
        <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-white font-bold text-base mb-1 uppercase font-label-caps tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-performance-red text-[20px]">history</span>
                SMS delivery logs
              </h3>
              <p className="text-tertiary text-xs">Track every SMS notification enqueued or sent from the system.</p>
            </div>
            
            <div className="flex gap-2">
              <select
                className="bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-performance-red"
                value={logFilter}
                onChange={e => { setLogFilter(e.target.value); setLogPage(1); }}
              >
                <option value="">All statuses</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="mock_sent">Mock Sent</option>
                <option value="skipped_no_flow_id">Skipped (No Flow ID)</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-tertiary">
              <thead className="bg-white/[0.02] text-white/50 uppercase tracking-widest text-[9px] font-bold border-b border-white/5">
                <tr>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4">Event Key</th>
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-tertiary/40">No SMS logs recorded.</td>
                  </tr>
                ) : (
                  logs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-white/[0.01]">
                      <td className="py-3 px-4 text-white font-medium">{log.mobile}</td>
                      <td className="py-3 px-4">{log.event_key}</td>
                      <td className="py-3 px-4 font-mono text-[10px] text-tertiary/60">{log.msg91_request_id || 'N/A'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          log.status === 'sent' ? 'bg-green-500/10 text-green-400 border border-green-500/15' :
                          log.status === 'mock_sent' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/15' :
                          log.status === 'failed' ? 'bg-red-500/10 text-red-400 border border-red-500/15' :
                          'bg-amber-500/10 text-amber-400 border border-amber-500/15'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-[200px] truncate text-[10px]" title={log.error_message || ''}>
                        {log.error_message || <span className="text-tertiary/40">—</span>}
                      </td>
                      <td className="py-3 px-4 text-tertiary/50 text-[10px] font-sans">
                        {new Date(log.created_at).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        {log.status === 'failed' && (
                          <button
                            onClick={() => retryMutation.mutate(log.id)}
                            disabled={retryMutation.isPending}
                            className="text-performance-red hover:underline font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 ml-auto"
                          >
                            <span className="material-symbols-outlined text-xs">replay</span>
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-white/5 pt-4">
              <span className="text-[11px] text-tertiary/50">
                Page {meta.page} of {meta.totalPages} (Total {meta.total} logs)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setLogPage(p => Math.max(1, p - 1))}
                  disabled={logPage === 1 || isPlaceholderData}
                  className="px-3 py-1.5 border border-white/10 hover:border-white/20 rounded text-xs uppercase font-bold text-tertiary hover:text-white disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  onClick={() => setLogPage(p => Math.min(meta.totalPages, p + 1))}
                  disabled={logPage === meta.totalPages || isPlaceholderData}
                  className="px-3 py-1.5 border border-white/10 hover:border-white/20 rounded text-xs uppercase font-bold text-tertiary hover:text-white disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
