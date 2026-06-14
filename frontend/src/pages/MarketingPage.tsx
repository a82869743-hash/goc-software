import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketingAPI, WhatsAppLog, WhatsAppStats, Campaign } from '../api/marketing';
import toast from 'react-hot-toast';

type Tab = 'overview' | 'logs' | 'campaigns';

const MarketingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [logFilter, setLogFilter] = useState<{ status?: string; search?: string; page: number }>({ page: 1 });
  const [showQuickSend, setShowQuickSend] = useState(false);
  const [quickPhone, setQuickPhone] = useState('');
  const [quickMsg, setQuickMsg] = useState('');
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [campaignForm, setCampaignForm] = useState({ name: '', template_name: '', segment_type: 'all', notes: '' });

  // Queries
  const { data: statsData } = useQuery({ queryKey: ['whatsapp-stats'], queryFn: () => marketingAPI.getStats() });
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['whatsapp-logs', logFilter],
    queryFn: () => marketingAPI.getLogs(logFilter),
  });
  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => marketingAPI.getCampaigns(),
  });

  const stats: WhatsAppStats = statsData?.data || { sent: 0, delivered: 0, read: 0, failed: 0, queued: 0, today: 0, this_week: 0, total: 0 };
  const logs: WhatsAppLog[] = logsData?.data || [];
  const campaigns: Campaign[] = campaignsData?.data || [];

  // Mutations
  const quickSendMut = useMutation({
    mutationFn: () => marketingAPI.quickSend({ phone: quickPhone, message: quickMsg }),
    onSuccess: () => {
      setShowQuickSend(false);
      setQuickPhone('');
      setQuickMsg('');
      toast.success('Message queued successfully');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-logs'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-stats'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to send message');
    }
  });

  const createCampaignMut = useMutation({
    mutationFn: () => marketingAPI.createCampaign(campaignForm),
    onSuccess: () => {
      setShowCampaignModal(false);
      setCampaignForm({ name: '', template_name: '', segment_type: 'all', notes: '' });
      toast.success('Campaign created successfully');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to create campaign');
    }
  });

  const executeCampaignMut = useMutation({
    mutationFn: (id: number) => marketingAPI.executeCampaign(id),
    onSuccess: () => {
      toast.success('Campaign execution initialized');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to execute campaign');
    }
  });

  const deleteCampaignMut = useMutation({
    mutationFn: (id: number) => marketingAPI.deleteCampaign(id),
    onSuccess: () => {
      toast.success('Campaign deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to delete campaign');
    }
  });

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'sent': 
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'delivered': 
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'read': 
        return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20';
      case 'failed': 
        return 'bg-performance-red/10 text-[#ffb4a8] border border-performance-red/20';
      case 'queued': 
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      default: 
        return 'bg-neutral-500/10 text-neutral-400 border border-neutral-500/20';
    }
  };

  const getCampaignStatusBadge = (s: string) => {
    switch (s) {
      case 'draft': 
        return 'bg-neutral-500/10 text-neutral-400 border border-neutral-500/20';
      case 'scheduled': 
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'running': 
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse';
      case 'completed': 
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'cancelled': 
        return 'bg-performance-red/10 text-[#ffb4a8] border border-performance-red/20';
      default: 
        return 'bg-neutral-500/10 text-neutral-400 border border-neutral-500/20';
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-8 relative z-10 font-body-lg animate-fade-in">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-[2px] bg-performance-red"></div>
            <span className="font-label-caps text-label-caps text-performance-red tracking-[0.3em] uppercase">
              Outreach & Marketing Hub
            </span>
          </div>
          <h1 className="font-display-hero text-headline-lg text-white tracking-tight">
            Marketing & Broadcasts
          </h1>
          <p className="font-body-lg text-body-lg text-tertiary mt-1.5">
            WhatsApp campaign parameters, quick outreach templates, and analytics pipelines.
          </p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full md:w-auto">
          <button className="btn-secondary px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:cursor-pointer flex-1 sm:flex-none justify-center" onClick={() => setShowQuickSend(true)}>
            <span className="material-symbols-outlined text-[18px]">send</span>Quick Send
          </button>
          <button className="btn-primary px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:cursor-pointer flex-1 sm:flex-none justify-center" onClick={() => setShowCampaignModal(true)}>
            <span className="material-symbols-outlined text-[18px]">campaign</span>New Campaign
          </button>
        </div>
      </div>

      {/* TABS CONTAINER */}
      <div className="flex border-b border-white/5 pb-1 overflow-x-auto custom-scrollbar whitespace-nowrap min-w-full">
        <div className="flex items-center gap-1.5 p-1 bg-black/30 border border-white/5 rounded-xl">
          {([
            { id: 'overview', icon: 'monitoring', label: 'Overview' },
            { id: 'logs', icon: 'sms', label: 'Message Logs' },
            { id: 'campaigns', icon: 'campaign', label: 'Campaigns' }
          ] as const).map((tab) => (
            <button
              key={tab.id}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all hover:cursor-pointer shrink-0 ${
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

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label:'Sent Today', value: stats.today, icon:'chat', color:'text-white', glowColor: 'rgba(255,255,255,0.03)' },
              { label:'Sent This Week', value: stats.this_week, icon:'query_stats', color:'text-cyan-400', glowColor: 'rgba(6,182,212,0.03)' },
              { label:'Delivered', value: stats.delivered, icon:'check_circle', color:'text-emerald-400', glowColor: 'rgba(52,211,153,0.03)' },
              { label:'Delivery Failures', value: stats.failed, icon:'error', color:'text-performance-red', glowColor: 'rgba(255,43,43,0.03)' },
            ].map(({label,value,icon,color,glowColor})=>(
              <div key={label} className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 relative overflow-hidden group shadow-2xl flex items-center gap-4">
                <div className="absolute top-0 right-0 w-24 h-24 blur-[40px] rounded-full pointer-events-none" style={{ backgroundColor: glowColor }} />
                <span className={`material-symbols-outlined text-[32px] ${color} opacity-85`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                <div>
                  <p className="font-label-caps text-[10px] text-tertiary uppercase tracking-wider">{label}</p>
                  <p className={`text-2xl font-bold font-data-lg ${color} mt-1`}>{value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Delivery Progress Chart */}
            <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-36 h-36 bg-performance-red/[0.02] blur-[60px] rounded-full pointer-events-none" />
              <h3 className="font-label-caps text-label-caps text-white flex items-center gap-2 mb-6 border-b border-white/5 pb-4 uppercase tracking-wider">
                <span className="material-symbols-outlined text-performance-red text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  donut_large
                </span>
                Message Status Breakdown
              </h3>
              
              <div className="space-y-5">
                {[
                  { label: 'Queued', value: stats.queued, color: 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.25)]' },
                  { label: 'Sent', value: stats.sent, color: 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.25)]' },
                  { label: 'Delivered', value: stats.delivered, color: 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.25)]' },
                  { label: 'Read', value: stats.read, color: 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.25)]' },
                  { label: 'Failed', value: stats.failed, color: 'bg-performance-red shadow-[0_0_10px_rgba(255,43,43,0.25)]' },
                ].map((m) => {
                  const percentage = stats.total > 0 ? (m.value / stats.total * 100) : 0;
                  return (
                    <div key={m.label} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-label-caps uppercase tracking-wider text-tertiary">
                        <span>{m.label}</span>
                        <span className="font-data-sm text-white font-bold">{m.value} ({percentage.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-white/5 border border-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${m.color}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mini Campaigns View */}
            <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 relative overflow-hidden shadow-2xl flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-36 h-36 bg-performance-red/[0.02] blur-[60px] rounded-full pointer-events-none" />
              <div>
                <h3 className="font-label-caps text-label-caps text-white flex items-center gap-2 mb-6 border-b border-white/5 pb-4 uppercase tracking-wider">
                  <span className="material-symbols-outlined text-performance-red text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    campaign
                  </span>
                  Active Campaigns
                </h3>
                <div className="space-y-3 max-h-[220px] overflow-y-auto custom-scrollbar">
                  {campaigns.length === 0 ? (
                    <div className="py-12 text-center text-tertiary/30 italic text-sm">No campaigns built yet</div>
                  ) : (
                    campaigns.slice(0, 5).map((c) => (
                      <div key={c.id} className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0 hover:bg-white/[0.01] px-2 rounded-lg transition-colors font-body-lg text-sm">
                        <span className="text-white font-semibold">{c.name}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider font-label-caps ${getCampaignStatusBadge(c.status)}`}>
                          {c.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              <div className="pt-4 border-t border-white/5 flex justify-end">
                <button className="btn-secondary px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 hover:cursor-pointer" onClick={() => setActiveTab('campaigns')}>
                  View All Campaigns
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LOGS TAB ── */}
      {activeTab === 'logs' && (
        <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl flex flex-col relative">
          <div className="absolute top-0 right-0 w-36 h-36 bg-performance-red/[0.02] blur-[60px] rounded-full pointer-events-none" />
          
          <div className="px-6 py-4 border-b border-white/5 flex flex-col sm:flex-row gap-4 bg-black/10 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search phone, recipient name..."
                className="input-glass px-4 py-2 rounded-lg border border-white/10 bg-white/2 focus:border-performance-red focus:bg-white/4 focus:ring-1 focus:ring-performance-red/30 transition-all font-body-lg text-white text-xs w-full sm:w-64"
                value={logFilter.search || ''}
                onChange={(e) => setLogFilter({ ...logFilter, search: e.target.value, page: 1 })}
              />
              <select
                className="input-glass px-4 py-2 rounded-lg border border-white/10 bg-black focus:border-performance-red focus:bg-white/4 focus:ring-1 focus:ring-performance-red/30 transition-all font-label-caps text-tertiary text-xs w-full sm:w-auto"
                value={logFilter.status || ''}
                onChange={(e) => setLogFilter({ ...logFilter, status: e.target.value || undefined, page: 1 })}
              >
                <option value="" className="bg-[#0c0f0f] text-white">All Status</option>
                <option value="sent" className="bg-[#0c0f0f] text-white">Sent</option>
                <option value="delivered" className="bg-[#0c0f0f] text-white">Delivered</option>
                <option value="read" className="bg-[#0c0f0f] text-white">Read</option>
                <option value="failed" className="bg-[#0c0f0f] text-white">Failed</option>
                <option value="queued" className="bg-[#0c0f0f] text-white">Queued</option>
              </select>
            </div>
            
            <div className="text-xs text-tertiary/55 font-mono">{logs.length} messages logged</div>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-black/25 text-tertiary text-[10px] font-label-caps uppercase tracking-wider border-b border-white/5">
                  <th className="py-4 px-6 font-normal">Time</th>
                  <th className="py-4 px-6 font-normal">Recipient Phone</th>
                  <th className="py-4 px-6 font-normal">Customer</th>
                  <th className="py-4 px-6 font-normal">Template</th>
                  <th className="py-4 px-6 font-normal">Status</th>
                  <th className="py-4 px-6 font-normal">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02] font-body-lg">
                {logsLoading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-tertiary/40 italic text-sm">
                      Loading broadcast archives...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-tertiary/30 italic text-sm">
                      No broadcast histories logged
                    </td>
                  </tr>
                ) : logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="py-4 px-6 font-mono text-[10px] text-tertiary/60">{formatDate(log.created_at)}</td>
                    <td className="py-4 px-6 font-mono text-xs text-white">{log.phone}</td>
                    <td className="py-4 px-6 text-sm text-white font-semibold">{log.customer_name || '—'}</td>
                    <td className="py-4 px-6"><span className="font-mono text-[10px] bg-white/5 border border-white/5 text-tertiary px-2 py-1 rounded-md">{log.template_name}</span></td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider font-label-caps ${getStatusBadge(log.status)}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-xs text-tertiary/75">{log.sent_by_name || 'System Auto'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CAMPAIGNS TAB ── */}
      {activeTab === 'campaigns' && (
        <div className="space-y-6">
          {campaignsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-tertiary/40 italic font-body-lg text-sm">Loading campaign rosters...</div>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl p-12 text-center shadow-2xl flex flex-col items-center gap-4">
              <span className="material-symbols-outlined text-[48px] text-performance-red opacity-80" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
              <h3 className="font-display-hero text-lg text-white font-bold">No Outreach Campaigns Configured</h3>
              <p className="text-sm text-tertiary max-w-sm">Broadcast custom detailer campaigns, discount matrices, or VIP referral templates.</p>
              <button className="btn-primary px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:cursor-pointer" onClick={() => setShowCampaignModal(true)}>
                Build First Campaign
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {campaigns.map((c) => (
                <div key={c.id} className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 relative overflow-hidden shadow-2xl flex flex-col justify-between group">
                  <div className="absolute top-0 right-0 w-36 h-36 bg-performance-red/[0.02] blur-[60px] rounded-full pointer-events-none" />
                  
                  <div>
                    <div className="flex justify-between items-start border-b border-white/5 pb-4 mb-4">
                      <h3 className="text-base font-bold text-white tracking-tight group-hover:text-performance-red transition-colors">{c.name}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider font-label-caps ${getCampaignStatusBadge(c.status)}`}>
                        {c.status}
                      </span>
                    </div>

                    <div className="space-y-3 font-mono text-[10px] text-tertiary/80 pb-4">
                      <div className="flex justify-between">
                        <span className="uppercase text-tertiary/40">Template</span>
                        <span className="text-white">{c.template_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="uppercase text-tertiary/40">Audience</span>
                        <span className="text-white capitalize">{c.segment_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="uppercase text-tertiary/40">Recipients</span>
                        <span className="text-white font-bold font-data-sm">{c.total_recipients}</span>
                      </div>
                      {c.status === 'completed' && (
                        <div className="flex justify-between">
                          <span className="uppercase text-tertiary/40">Delivery Velocity</span>
                          <span className="text-emerald-400 font-bold">{c.sent_count}/{c.total_recipients} sent</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-white/[0.03] pt-2 mt-2">
                        <span className="uppercase text-tertiary/40">Registered At</span>
                        <span>{formatDate(c.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-4 flex gap-2 justify-end">
                    {c.status === 'draft' && (
                      <>
                        <button 
                          className="btn-primary px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 hover:cursor-pointer" 
                          onClick={() => {
                            if (confirm(`Execute campaign "${c.name}"? This will broadcast messages to all recipients.`)) {
                              executeCampaignMut.mutate(c.id);
                            }
                          }}
                        >
                          <span className="material-symbols-outlined text-[12px]">play_arrow</span>Execute
                        </button>
                        <button 
                          className="bg-performance-red/10 border border-performance-red/20 text-performance-red hover:bg-performance-red/20 px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 hover:cursor-pointer" 
                          onClick={() => {
                            if (confirm(`Delete campaign "${c.name}"?`)) {
                              deleteCampaignMut.mutate(c.id);
                            }
                          }}
                        >
                          <span className="material-symbols-outlined text-[12px]">delete</span>Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── QUICK SEND MODAL ── */}
      {showQuickSend && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={() => setShowQuickSend(false)}>
          <div className="bg-[#0c0c0c]/90 backdrop-blur-2xl border border-white/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto relative shadow-2xl animate-fade-in flex flex-col p-6" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-performance-red/[0.03] blur-[50px] rounded-full pointer-events-none" />
            
            <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-6">
              <h2 className="font-display-hero text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span className="material-symbols-outlined text-performance-red text-[20px]">sms</span>
                Quick WhatsApp Message
              </h2>
              <button className="text-tertiary/60 hover:text-white hover:cursor-pointer font-bold transition-colors" onClick={() => setShowQuickSend(false)}>✕</button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex flex-col gap-2">
                <label className="font-label-caps text-xs text-tertiary/75 uppercase tracking-widest">Phone Number</label>
                <input type="text" placeholder="+91 99999 99999" className="input-glass px-4 py-3 rounded-lg border border-white/10 bg-white/2 focus:border-performance-red focus:bg-white/4 focus:ring-1 focus:ring-performance-red/30 transition-all font-data-sm text-white w-full" value={quickPhone} onChange={(e) => setQuickPhone(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-label-caps text-xs text-tertiary/75 uppercase tracking-widest">Message</label>
                <textarea rows={4} placeholder="Type your outreach message..." className="input-glass px-4 py-3 rounded-lg border border-white/10 bg-white/2 focus:border-performance-red focus:bg-white/4 focus:ring-1 focus:ring-performance-red/30 transition-all font-body-lg text-white w-full resize-none" value={quickMsg} onChange={(e) => setQuickMsg(e.target.value)} />
              </div>
            </div>

            <div className="border-t border-white/5 pt-4 flex gap-2 justify-end">
              <button className="btn-secondary px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:cursor-pointer" onClick={() => setShowQuickSend(false)}>Cancel</button>
              <button className="btn-primary px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed hover:cursor-pointer" onClick={() => quickSendMut.mutate()} disabled={!quickPhone || !quickMsg || quickSendMut.isPending}>
                {quickSendMut.isPending ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NEW CAMPAIGN MODAL ── */}
      {showCampaignModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={() => setShowCampaignModal(false)}>
          <div className="bg-[#0c0c0c]/90 backdrop-blur-2xl border border-white/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto relative shadow-2xl animate-fade-in flex flex-col p-6" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-performance-red/[0.03] blur-[50px] rounded-full pointer-events-none" />
            
            <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-6">
              <h2 className="font-display-hero text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span className="material-symbols-outlined text-performance-red text-[20px]">campaign</span>
                Configure Broadcast Campaign
              </h2>
              <button className="text-tertiary/60 hover:text-white hover:cursor-pointer font-bold transition-colors" onClick={() => setShowCampaignModal(false)}>✕</button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex flex-col gap-2">
                <label className="font-label-caps text-xs text-tertiary/75 uppercase tracking-widest">Campaign Name</label>
                <input type="text" placeholder="e.g. Monsoon Waxing Special" className="input-glass px-4 py-3 rounded-lg border border-white/10 bg-white/2 focus:border-performance-red focus:bg-white/4 focus:ring-1 focus:ring-performance-red/30 transition-all font-body-lg text-white w-full" value={campaignForm.name} onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-label-caps text-xs text-tertiary/75 uppercase tracking-widest">MSG91 Template Name</label>
                <input type="text" placeholder="e.g. monsoon_offer_v2" className="input-glass px-4 py-3 rounded-lg border border-white/10 bg-white/2 focus:border-performance-red focus:bg-white/4 focus:ring-1 focus:ring-performance-red/30 transition-all font-data-sm text-white w-full" value={campaignForm.template_name} onChange={(e) => setCampaignForm({ ...campaignForm, template_name: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-label-caps text-xs text-tertiary/75 uppercase tracking-widest">Audience Segment</label>
                <select className="input-glass px-4 py-3 rounded-lg border border-white/10 bg-black focus:border-performance-red focus:bg-white/4 focus:ring-1 focus:ring-performance-red/30 transition-all font-label-caps text-tertiary w-full" value={campaignForm.segment_type} onChange={(e) => setCampaignForm({ ...campaignForm, segment_type: e.target.value })}>
                  <option value="all" className="bg-[#0c0f0f] text-white">All Active Registrants</option>
                  <option value="vip" className="bg-[#0c0f0f] text-white">VIP Tier Detailing Clients</option>
                  <option value="recent" className="bg-[#0c0f0f] text-white">Recent Accounts (90D)</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-label-caps text-xs text-tertiary/75 uppercase tracking-widest">Operator Notes</label>
                <textarea rows={3} placeholder="Campaign log details..." className="input-glass px-4 py-3 rounded-lg border border-white/10 bg-white/2 focus:border-performance-red focus:bg-white/4 focus:ring-1 focus:ring-performance-red/30 transition-all font-body-lg text-white w-full resize-none" value={campaignForm.notes} onChange={(e) => setCampaignForm({ ...campaignForm, notes: e.target.value })} />
              </div>
            </div>

            <div className="border-t border-white/5 pt-4 flex gap-2 justify-end">
              <button className="btn-secondary px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:cursor-pointer" onClick={() => setShowCampaignModal(false)}>Cancel</button>
              <button className="btn-primary px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed hover:cursor-pointer" onClick={() => createCampaignMut.mutate()} disabled={!campaignForm.name || !campaignForm.template_name || createCampaignMut.isPending}>
                {createCampaignMut.isPending ? 'Registering...' : 'Build Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketingPage;
