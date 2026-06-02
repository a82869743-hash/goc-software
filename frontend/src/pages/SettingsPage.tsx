import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../api/settings';
import { webhooksAPI } from '../api/webhooks';
import { staffAPI } from '../api/staff';
import toast from 'react-hot-toast';
import SMSSettingsPage from './SMSSettingsPage';

function IntegrationStatusPanel() {
  const queryClient = useQueryClient();
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null);
  const [configForm, setConfigForm] = useState({ verify_token: '', default_assignee: '', is_active: true, page_id: '' });

  const { data: statusData, isLoading } = useQuery({
    queryKey: ['webhooks', 'status'],
    queryFn: webhooksAPI.getStatus,
    refetchInterval: 30000,
  });

  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffAPI.list({ status: 'active' }),
  });

  const updateConfig = useMutation({
    mutationFn: (payload: any) => webhooksAPI.updateConfig(payload),
    onSuccess: () => {
      toast.success('Integration settings saved!');
      setEditingPlatform(null);
      queryClient.invalidateQueries({ queryKey: ['webhooks', 'status'] });
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const configs: any[] = statusData?.data?.configs || [];
  const staffList: any[] = staffData?.data || [];

  const PLATFORM_INFO: Record<string, { label: string; icon: string; color: string; description: string; setupUrl: string }> = {
    facebook: {
      label: 'Facebook Lead Ads',
      icon: 'thumb_up',
      color: 'text-blue-400',
      description: 'Automatically capture leads from Facebook Lead Ad forms',
      setupUrl: 'https://developers.facebook.com/apps',
    },
    instagram: {
      label: 'Instagram Lead Forms',
      icon: 'photo_camera',
      color: 'text-pink-400',
      description: 'Automatically capture leads from Instagram Lead Form ads',
      setupUrl: 'https://developers.facebook.com/apps',
    },
    whatsapp: {
      label: 'WhatsApp Inbound',
      icon: 'chat_bubble',
      color: 'text-emerald-400',
      description: 'Auto-create leads when customers message the studio WhatsApp',
      setupUrl: 'https://control.msg91.com',
    },
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-white font-bold text-base mb-1">Lead Capture Integrations</h3>
        <p className="text-tertiary text-sm">Configure automatic lead capture from social media and WhatsApp</p>
      </div>

      {/* Webhook URL Info Box */}
      <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl rounded-xl p-4 border border-white/[0.06]">
        <p className="text-xs font-bold text-tertiary uppercase tracking-wider mb-3">Your Webhook URLs</p>
        <div className="flex flex-col gap-2">
          {[
            { label: 'Facebook / Instagram', url: `${window.location.origin.replace('5173', '4000')}/api/v1/webhooks/meta` },
            { label: 'WhatsApp (MSG91)', url: `${window.location.origin.replace('5173', '4000')}/api/v1/webhooks/whatsapp` },
          ].map(({ label, url }) => (
            <div key={label} className="flex items-center justify-between gap-3 bg-black/30 rounded-lg px-3 py-2">
              <div>
                <p className="text-xs text-tertiary">{label}</p>
                <p className="text-xs font-mono text-white mt-0.5 break-all">{url}</p>
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(url); toast.success('URL copied!'); }}
                className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center text-tertiary hover:text-white hover:bg-white/10 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Platform Cards */}
      {isLoading ? (
        <div className="text-tertiary text-sm">Loading integration status...</div>
      ) : (
        configs.map((config: any) => {
          const info = PLATFORM_INFO[config.platform];
          if (!info) return null;

          return (
            <div key={config.platform} className="bg-[#0c0c0c]/45 backdrop-blur-2xl rounded-xl border border-white/[0.06] overflow-hidden">
              <div className="p-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center ${info.color}`}>
                    <span className="material-symbols-outlined text-[20px]">{info.icon}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-white font-bold text-sm">{info.label}</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        config.is_active
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          : 'bg-white/5 text-tertiary border border-white/10'
                      }`}>
                        {config.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                    <p className="text-tertiary text-xs">{info.description}</p>
                    {config.last_received && (
                      <p className="text-tertiary/60 text-[11px] mt-1">
                        Last received: {new Date(config.last_received).toLocaleString('en-IN')} · Total: {config.total_received}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={info.setupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded flex items-center justify-center text-tertiary hover:text-white hover:bg-white/10 transition-all"
                    title="Open platform dashboard"
                  >
                    <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  </a>
                  <button
                    onClick={() => {
                      setEditingPlatform(config.platform);
                      setConfigForm({
                        verify_token: config.verify_token || '',
                        default_assignee: config.default_assignee || '',
                        is_active: config.is_active === 1,
                        page_id: config.page_id || '',
                      });
                    }}
                    className="w-8 h-8 rounded flex items-center justify-center text-tertiary hover:text-white hover:bg-white/10 transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">settings</span>
                  </button>
                </div>
              </div>

              {/* Edit Config Panel */}
              {editingPlatform === config.platform && (
                <div className="border-t border-white/[0.06] p-5 bg-black/20 flex flex-col gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-tertiary uppercase tracking-wider mb-1.5 block">Verify Token</label>
                      <input
                        className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder-tertiary/40 focus:outline-none focus:border-performance-red/50"
                        placeholder="e.g. GOC_FB_TOKEN_2026"
                        value={configForm.verify_token}
                        onChange={e => setConfigForm(p => ({ ...p, verify_token: e.target.value }))}
                      />
                      <p className="text-[10px] text-tertiary/50 mt-1">Must match the token entered in {info.label} settings</p>
                    </div>
                    {config.platform !== 'whatsapp' && (
                      <div>
                        <label className="text-[11px] font-bold text-tertiary uppercase tracking-wider mb-1.5 block">Page ID (Optional)</label>
                        <input
                          className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder-tertiary/40 focus:outline-none focus:border-performance-red/50"
                          placeholder="Your Facebook Page ID"
                          value={configForm.page_id}
                          onChange={e => setConfigForm(p => ({ ...p, page_id: e.target.value }))}
                        />
                      </div>
                    )}
                    <div>
                      <label className="text-[11px] font-bold text-tertiary uppercase tracking-wider mb-1.5 block">Auto-Assign To</label>
                      <select
                        className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-performance-red/50"
                        value={configForm.default_assignee}
                        onChange={e => setConfigForm(p => ({ ...p, default_assignee: e.target.value }))}
                      >
                        <option value="">No auto-assignment</option>
                        {staffList.map((s: any) => (
                          <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-[11px] font-bold text-tertiary uppercase tracking-wider">Integration Active</label>
                      <button
                        onClick={() => setConfigForm(p => ({ ...p, is_active: !p.is_active }))}
                        className={`relative w-10 h-5 rounded-full transition-colors ${configForm.is_active ? 'bg-performance-red' : 'bg-white/10'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${configForm.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setEditingPlatform(null)}
                      className="flex-1 py-2 rounded-lg border border-white/10 text-tertiary text-sm hover:border-white/20 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => updateConfig.mutate({
                        platform: config.platform,
                        verify_token: configForm.verify_token || undefined,
                        default_assignee: configForm.default_assignee ? Number(configForm.default_assignee) : null,
                        is_active: configForm.is_active,
                        page_id: configForm.page_id || undefined,
                      })}
                      disabled={updateConfig.isPending}
                      className="flex-1 py-2 rounded-lg bg-gradient-to-r from-performance-red to-deep-crimson text-white font-bold text-sm disabled:opacity-50"
                    >
                      {updateConfig.isPending ? 'Saving...' : 'Save Configuration'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'studio' | 'integrations' | 'sms'>('studio');
  
  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getAll,
  });

  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settingsData) {
      const initial: Record<string, string> = {};
      Object.keys(settingsData).forEach((key) => {
        initial[key] = settingsData[key].value;
      });
      // Fallbacks if not set
      if (!initial['studio_name']) initial['studio_name'] = 'God of Ceramic';
      if (!initial['gst_number']) initial['gst_number'] = '';
      if (!initial['address']) initial['address'] = '';
      if (!initial['contact_phone']) initial['contact_phone'] = '';
      if (!initial['contact_email']) initial['contact_email'] = '';
      if (!initial['invoice_prefix']) initial['invoice_prefix'] = 'GOC-INV';
      
      setForm(initial);
    }
  }, [settingsData]);

  const updateMutation = useMutation({
    mutationFn: (settingsArray: { key: string; value: string; description?: string }[]) => 
      settingsApi.batchUpdate(settingsArray),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Settings updated successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to update settings');
    }
  });

  const handleSave = () => {
    const arr = Object.keys(form).map(key => ({ key, value: form[key] }));
    updateMutation.mutate(arr);
  };

  const handleChange = (key: string, val: string) => {
    setForm(prev => ({ ...prev, [key]: val }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-performance-red border-t-transparent rounded-full animate-spin" />
          <span className="font-label-caps text-xs text-tertiary/50 uppercase tracking-widest">
            Loading telemetry...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative z-10 font-body-lg max-w-4xl mx-auto animate-fade-in">
      {/* HEADER SECTION */}
      {activeTab !== 'sms' && (
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-white/5 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-[2px] bg-performance-red"></div>
              <span className="font-label-caps text-label-caps text-performance-red tracking-[0.3em] uppercase">
                System Control Console
              </span>
            </div>
            <h1 className="font-display-hero text-headline-lg text-white tracking-tight">
              App Settings
            </h1>
            <p className="font-body-lg text-body-lg text-tertiary mt-1.5">
              Manage studio configuration, billing parameters, and telemetry credentials.
            </p>
          </div>
        </div>
      )}

      {/* TABS CONTAINER */}
      <div className="flex border-b border-white/5 pb-1">
        <div className="flex items-center gap-1.5 p-1 bg-black/30 border border-white/5 rounded-xl">
          {([
            { id: 'studio', icon: 'storefront', label: 'Studio Profile' },
            { id: 'integrations', icon: 'hub', label: 'Integrations' },
            { id: 'sms', icon: 'sms', label: 'SMS Integration' }
          ] as const).map((tab) => (
            <button
              key={tab.id}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all hover:cursor-pointer ${
                activeTab === tab.id 
                  ? 'bg-performance-red/10 text-performance-red border border-performance-red/20 shadow-[0_0_15px_rgba(255,43,43,0.15)]' 
                  : 'text-tertiary/60 hover:text-white'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {activeTab === 'studio' && (
          <>
        {/* Studio Profile Card */}
        <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 relative overflow-hidden group shadow-2xl flex flex-col">
          <div className="absolute top-0 right-0 w-36 h-36 bg-performance-red/[0.02] blur-[60px] rounded-full pointer-events-none" />
          <h3 className="font-label-caps text-label-caps text-white flex items-center gap-2 mb-6 border-b border-white/5 pb-4 uppercase tracking-wider">
            <span className="material-symbols-outlined text-performance-red text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              storefront
            </span>
            Studio Profile
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-xs text-tertiary/75 uppercase tracking-widest">
                Studio Name
              </label>
              <input 
                type="text" 
                className="input-glass px-4 py-3 rounded-lg border border-white/10 bg-white/2 focus:border-performance-red focus:bg-white/4 focus:ring-1 focus:ring-performance-red/30 transition-all font-body-lg text-white w-full"
                value={form['studio_name'] || ''} 
                onChange={(e) => handleChange('studio_name', e.target.value)} 
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-xs text-tertiary/75 uppercase tracking-widest">
                GST Number
              </label>
              <input 
                type="text" 
                className="input-glass px-4 py-3 rounded-lg border border-white/10 bg-white/2 focus:border-performance-red focus:bg-white/4 focus:ring-1 focus:ring-performance-red/30 transition-all font-data-sm text-white w-full placeholder-white/25"
                value={form['gst_number'] || ''} 
                onChange={(e) => handleChange('gst_number', e.target.value)} 
                placeholder="e.g. 24XXXXX1234X1ZX"
              />
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="font-label-caps text-xs text-tertiary/75 uppercase tracking-widest">
                Studio Address
              </label>
              <input 
                type="text" 
                className="input-glass px-4 py-3 rounded-lg border border-white/10 bg-white/2 focus:border-performance-red focus:bg-white/4 focus:ring-1 focus:ring-performance-red/30 transition-all font-body-lg text-white w-full"
                value={form['address'] || ''} 
                onChange={(e) => handleChange('address', e.target.value)} 
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-xs text-tertiary/75 uppercase tracking-widest">
                Contact Phone
              </label>
              <input 
                type="text" 
                className="input-glass px-4 py-3 rounded-lg border border-white/10 bg-white/2 focus:border-performance-red focus:bg-white/4 focus:ring-1 focus:ring-performance-red/30 transition-all font-data-sm text-white w-full"
                value={form['contact_phone'] || ''} 
                onChange={(e) => handleChange('contact_phone', e.target.value)} 
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-xs text-tertiary/75 uppercase tracking-widest">
                Contact Email
              </label>
              <input 
                type="email" 
                className="input-glass px-4 py-3 rounded-lg border border-white/10 bg-white/2 focus:border-performance-red focus:bg-white/4 focus:ring-1 focus:ring-performance-red/30 transition-all font-data-sm text-white w-full"
                value={form['contact_email'] || ''} 
                onChange={(e) => handleChange('contact_email', e.target.value)} 
              />
            </div>
          </div>
        </div>

        {/* System Configuration Card */}
        <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 relative overflow-hidden group shadow-2xl flex flex-col">
          <div className="absolute top-0 right-0 w-36 h-36 bg-performance-red/[0.02] blur-[60px] rounded-full pointer-events-none" />
          <h3 className="font-label-caps text-label-caps text-white flex items-center gap-2 mb-6 border-b border-white/5 pb-4 uppercase tracking-wider">
            <span className="material-symbols-outlined text-performance-red text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              settings_suggest
            </span>
            System Configuration
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="font-label-caps text-xs text-tertiary/75 uppercase tracking-widest">
                Invoice Prefix
              </label>
              <input 
                type="text" 
                className="input-glass px-4 py-3 rounded-lg border border-white/10 bg-white/2 focus:border-performance-red focus:bg-white/4 focus:ring-1 focus:ring-performance-red/30 transition-all font-data-sm text-white w-full"
                value={form['invoice_prefix'] || ''} 
                onChange={(e) => handleChange('invoice_prefix', e.target.value)} 
              />
              <span className="font-data-sm text-[10px] text-tertiary/50 mt-1 block">
                Will format as: <code className="text-performance-red bg-performance-red/5 px-1.5 py-0.5 rounded font-mono">{form['invoice_prefix'] || 'GOC-INV'}-2526-0001</code>
              </span>
            </div>

            {/* Premium Invoice Preview Simulation Box */}
            <div className="bg-black/30 border border-white/5 rounded-xl p-4 flex flex-col gap-3 font-mono text-[10px] text-tertiary/70 h-full relative justify-between overflow-hidden">
              <div className="absolute top-0 right-0 text-[8px] bg-performance-red/10 border-l border-b border-white/5 px-2 py-0.5 text-performance-red font-bold uppercase tracking-wider rounded-bl">
                Preview
              </div>
              <div className="space-y-1.5">
                <div className="text-white font-bold text-xs border-b border-white/5 pb-1 uppercase tracking-wide">
                  {form['studio_name'] || 'Studio Name'}
                </div>
                <div>GST: {form['gst_number'] || 'N/A'}</div>
                <div>INV NO: {form['invoice_prefix'] || 'GOC-INV'}-XXXX</div>
              </div>
              <div className="border-t border-white/5 pt-2 flex justify-between items-center text-white/50 text-[9px]">
                <span>STATUS: DRAFT</span>
                <span>TOTAL: ₹0.00</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
            <button 
              className="btn btn-primary px-6 py-3 rounded-xl font-bold uppercase tracking-wider text-xs flex items-center gap-2 hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              onClick={handleSave}
              disabled={updateMutation.isPending}
            >
              <span className="material-symbols-outlined text-[16px]">
                {updateMutation.isPending ? 'sync' : 'save'}
              </span>
              {updateMutation.isPending ? 'Saving Settings...' : 'Save Configuration'}
            </button>
          </div>
        </div>
        </>
      )}

        {activeTab === 'integrations' && (
          <div className="flex flex-col gap-6">
            <IntegrationStatusPanel />
          </div>
        )}

        {activeTab === 'sms' && (
          <div className="flex flex-col gap-6">
            <SMSSettingsPage />
          </div>
        )}

      </div>
    </div>
  );
};

export default SettingsPage;
