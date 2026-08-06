import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commissionsAPI, Commission } from '../api/commissions';
import toast from 'react-hot-toast';

const STATUS_CFG = {
  pending:  { label:'Pending',  color:'text-amber-400', bg:'bg-amber-500/10', border:'border-amber-500/20', icon:'schedule'           },
  approved: { label:'Approved', color:'text-cyan-400',   bg:'bg-cyan-500/10',   border:'border-cyan-500/20',   icon:'thumb_up'           },
  paid:     { label:'Paid ✓',   color:'text-emerald-400',  bg:'bg-emerald-500/10',  border:'border-emerald-500/20',  icon:'payments'           },
};

export default function CommissionsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all'|'pending'|'approved'|'paid'>('all');

  // Add Connector Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    commission_type: 'percentage' as 'percentage' | 'fixed',
    commission_value: 10
  });

  // Add Manual Commission Modal State
  const [showAddCommModal, setShowAddCommModal] = useState(false);
  const [addCommForm, setAddCommForm] = useState({
    connector_id: '' as number | '',
    job_card_id: '' as number | '',
    customer_id: '' as number | '',
    job_amount: '' as number | '',
    commission_pct: '' as number | '',
    commission_amount: '' as number | '',
    notes: '',
  });

  const { data: commissionsRes, isLoading: isCommissionsLoading } = useQuery({
    queryKey: ['commissions'],
    queryFn: () => commissionsAPI.list(),
  });

  const { data: connectorsRes, isLoading: isConnectorsLoading } = useQuery({
    queryKey: ['connectors'],
    queryFn: () => commissionsAPI.listConnectors(),
  });

  const commissions = (commissionsRes?.data || []) as Commission[];
  const dbConnectors = connectorsRes?.data || [];

  const addConnectorMutation = useMutation({
    mutationFn: (payload: typeof addForm) => commissionsAPI.createConnector(payload),
    onSuccess: () => {
      toast.success('Referral partner registered successfully!');
      setShowAddModal(false);
      setAddForm({ full_name: '', phone: '', email: '', commission_type: 'percentage', commission_value: 10 });
      queryClient.invalidateQueries({ queryKey: ['connectors'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to register partner');
    }
  });

  const addCommissionMutation = useMutation({
    mutationFn: () => commissionsAPI.createCommission({
      connector_id: Number(addCommForm.connector_id),
      job_card_id: Number(addCommForm.job_card_id),
      customer_id: Number(addCommForm.customer_id),
      job_amount: addCommForm.job_amount !== '' ? Number(addCommForm.job_amount) : undefined,
      commission_pct: addCommForm.commission_pct !== '' ? Number(addCommForm.commission_pct) : undefined,
      commission_amount: Number(addCommForm.commission_amount),
      notes: addCommForm.notes || undefined,
    }),
    onSuccess: () => {
      toast.success('Commission record created successfully!');
      setShowAddCommModal(false);
      setAddCommForm({ connector_id: '', job_card_id: '', customer_id: '', job_amount: '', commission_pct: '', commission_amount: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to create commission');
    }
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: number) => commissionsAPI.updateStatus(id, { status: 'paid', payment_mode: 'bank_transfer' }),
    onSuccess: () => {
      toast.success('Commission marked as paid');
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to update status');
    },
  });

  const isLoading = isCommissionsLoading || isConnectorsLoading;
  const filtered = commissions.filter(c => filter==='all' || c.status===filter);
  const totalPaid    = commissions.filter(c=>c.status==='paid').reduce((s,c)=>s+Number(c.commission_amount),0);
  const totalPending = commissions.filter(c=>c.status!=='paid').reduce((s,c)=>s+Number(c.commission_amount),0);

  // Merge registered connectors with commission statistics
  const connectorsList = dbConnectors.map((c: any) => {
    const connComm = commissions.filter(x => x.connector_id === c.id);
    return {
      id: c.id,
      name: c.full_name,
      phone: c.phone,
      jobs: connComm.length,
      total: connComm.reduce((s, x) => s + Number(x.commission_amount), 0),
      paid: connComm.filter(x => x.status === 'paid').reduce((s, x) => s + Number(x.commission_amount), 0),
    };
  });

  return (
    <div className="space-y-8 relative z-10 font-body-lg animate-fade-in">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-[2px] bg-performance-red"></div>
            <span className="font-label-caps text-label-caps text-performance-red tracking-[0.3em] uppercase">
              Connector Payout Array
            </span>
          </div>
          <h1 className="font-display-hero text-headline-lg text-white tracking-tight">
            Commissions & Referrals
          </h1>
          <p className="font-body-lg text-body-lg text-tertiary mt-1.5">
            Monitor connector ledgers, manage referral incentives, and authorize payout batches.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>Add Referral Partner
          </button>
          <button 
            onClick={() => setShowAddCommModal(true)}
            className="px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:cursor-pointer bg-white/10 text-white hover:bg-white/20 border border-white/10 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">payments</span>Add Commission
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label:'Total Commissions', value:`₹${((totalPaid+totalPending)/1000).toFixed(1)}K`, icon:'handshake',  color:'text-white', glowColor: 'rgba(255,255,255,0.03)'        },
          { label:'Paid Out',          value:`₹${(totalPaid/1000).toFixed(1)}K`,                icon:'payments',   color:'text-emerald-400', glowColor: 'rgba(52,211,153,0.03)'    },
          { label:'Pending',           value:`₹${(totalPending/1000).toFixed(1)}K`,             icon:'schedule',   color:'text-amber-400', glowColor: 'rgba(251,191,36,0.03)'   },
          { label:'Connectors',        value:connectorsList.length,                              icon:'group',      color:'text-performance-red', glowColor: 'rgba(255,43,43,0.03)'   },
        ].map(({label,value,icon,color,glowColor})=>(
          <div key={label} className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 relative overflow-hidden group shadow-2xl flex items-center gap-4">
            <div className="absolute top-0 right-0 w-24 h-24 blur-[40px] rounded-full pointer-events-none" style={{ backgroundColor: glowColor }} />
            <span className={`material-symbols-outlined text-[32px] ${color} opacity-85`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
            <div>
              <p className="font-label-caps text-[10px] text-tertiary uppercase tracking-wider">{label}</p>
              <p className={`text-2xl font-bold font-data-lg ${color} mt-1 tabular-nums`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* Connectors leaderboard */}
        <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl flex flex-col relative">
          <div className="absolute top-0 right-0 w-36 h-36 bg-performance-red/[0.02] blur-[60px] rounded-full pointer-events-none" />
          <div className="px-6 py-4 border-b border-white/5 bg-black/10">
            <h3 className="font-label-caps text-label-caps text-white flex items-center gap-2 uppercase tracking-wider">
              <span className="material-symbols-outlined text-performance-red text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                military_tech
              </span>
              Top Connectors
            </h3>
          </div>
          <div className="divide-y divide-white/5 max-h-[480px] overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="py-12 text-center text-tertiary/40 italic font-body-lg text-sm">Loading connectors...</div>
            ) : connectorsList.length === 0 ? (
              <div className="py-12 text-center text-tertiary/30 italic text-sm">No connectors registered</div>
            ) : connectorsList.sort((a,b)=>b.total-a.total).map((c,i)=>(
              <div key={c.id} className="px-6 py-4 hover:bg-white/[0.01] transition-colors flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-data-sm ${
                  i===0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25' : 
                  i===1 ? 'bg-slate-300/10 text-slate-300 border border-slate-300/20' : 
                  'bg-performance-red/10 text-[#ffb4a8] border border-performance-red/15'
                }`}>
                  {i+1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate font-body-lg">{c.name}</p>
                  <p className="text-[10px] font-mono text-tertiary/50 mt-0.5">{c.phone} · {c.jobs} jobs</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold text-white tabular-nums">₹{c.total.toLocaleString('en-IN')}</p>
                  <p className="text-[10px] text-emerald-400 font-mono mt-0.5">₹{c.paid.toLocaleString('en-IN')} paid</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Commission records table */}
        <div className="lg:col-span-2 bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl flex flex-col relative h-full">
          <div className="absolute top-0 right-0 w-36 h-36 bg-performance-red/[0.02] blur-[60px] rounded-full pointer-events-none" />
          <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3 bg-black/10 flex-wrap justify-between">
            <div className="flex items-center gap-1.5 p-1 bg-black/30 border border-white/5 rounded-xl overflow-x-auto custom-scrollbar whitespace-nowrap max-w-full">
              {(['all','pending','approved','paid'] as const).map(s=>{
                const cfg = s!=='all' ? STATUS_CFG[s] : null;
                return (
                  <button 
                    key={s} 
                    onClick={()=>setFilter(s)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all hover:cursor-pointer shrink-0 ${
                      filter===s ? (cfg ? `${cfg.bg} ${cfg.color} border border-white/5` : 'bg-white/10 text-white') : 'text-tertiary/60 hover:text-white'
                    }`}
                  >
                    {s==='all'?'All':STATUS_CFG[s].label}
                  </button>
                );
              })}
            </div>
            <div className="text-xs text-tertiary/55 font-mono">{filtered.length} records found</div>
          </div>
          
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-black/25 text-tertiary text-[10px] font-label-caps uppercase tracking-wider border-b border-white/5">
                  <th className="py-4 px-6 font-normal">Connector</th>
                  <th className="py-4 px-6 font-normal hidden md:table-cell">Customer / Job</th>
                  <th className="py-4 px-6 font-normal text-right hidden md:table-cell">Job Value</th>
                  <th className="py-4 px-6 font-normal text-right">Commission</th>
                  <th className="py-4 px-6 font-normal">Status</th>
                  <th className="py-4 px-4 font-normal"/>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-tertiary/40 italic font-body-lg text-sm">
                      Loading referral records...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-tertiary/30 italic font-body-lg text-sm">
                      No referral records found
                    </td>
                  </tr>
                ) : filtered.map((c, idx)=>{
                  const cfg = STATUS_CFG[c.status];
                  return (
                    <tr key={c.id} className="hover:bg-white/[0.015] transition-colors group">
                      <td className="py-4 px-6">
                        <p className="text-sm font-semibold text-white group-hover:text-performance-red transition-colors font-body-lg">{c.connector_name || '—'}</p>
                        <p className="text-[10px] font-mono text-tertiary/40 mt-0.5">{c.connector_phone || '—'} · {c.commission_pct || 0}%</p>
                      </td>
                      <td className="py-4 px-6 hidden md:table-cell">
                        <p className="text-xs text-tertiary font-body-lg">{c.customer_name || '—'}</p>
                        <p className="font-mono text-[10px] text-tertiary/40 mt-0.5">#{c.job_code || '—'}</p>
                      </td>
                      <td className="py-4 px-6 text-right hidden md:table-cell font-mono text-xs text-tertiary/80 tabular-nums">
                        ₹{Number(c.job_amount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-4 px-6 text-right font-mono text-sm font-bold text-white tabular-nums">
                        ₹{Number(c.commission_amount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border ${cfg.bg} ${cfg.border} ${cfg.color} text-[9px] font-bold uppercase tracking-wider font-label-caps`}>
                          <span className="material-symbols-outlined text-[12px]">{cfg.icon}</span>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        {c.status==='approved' && (
                          <button 
                            onClick={() => markPaidMutation.mutate(c.id)} 
                            className="opacity-0 group-hover:opacity-100 transition-all px-2.5 py-1.5 rounded-lg text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 whitespace-nowrap hover:cursor-pointer"
                          >
                            Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ADD CONNECTOR MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 pt-20 sm:pt-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl relative space-y-4 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-display-hero text-lg font-black text-white tracking-tight italic uppercase">
                  Add Referral Partner
                </h3>
                <p className="text-[10px] text-tertiary/50 font-label-caps tracking-widest uppercase">
                  Register new connector details
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-tertiary hover:text-white p-1 hover:bg-white/5 rounded-lg transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="font-label-caps text-[9px] text-tertiary/60 tracking-widest block mb-1">Full Name *</label>
                <input
                  type="text"
                  value={addForm.full_name}
                  onChange={e => setAddForm(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="Partner Name"
                  className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40"
                />
              </div>

              <div>
                <label className="font-label-caps text-[9px] text-tertiary/60 tracking-widest block mb-1">Phone Number *</label>
                <input
                  type="text"
                  value={addForm.phone}
                  onChange={e => setAddForm(p => ({ ...p, phone: e.target.value.replace(/\D/g, '') }))}
                  placeholder="10-digit Phone"
                  className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40"
                />
              </div>

              <div>
                <label className="font-label-caps text-[9px] text-tertiary/60 tracking-widest block mb-1">Email (Optional)</label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="partner@example.com"
                  className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-label-caps text-[9px] text-tertiary/60 tracking-widest block mb-1">Commission Type</label>
                  <select
                    value={addForm.commission_type}
                    onChange={e => setAddForm(p => ({ ...p, commission_type: e.target.value as 'percentage' | 'fixed' }))}
                    className="w-full bg-[#0a0a0a] border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Flat Rate (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="font-label-caps text-[9px] text-tertiary/60 tracking-widest block mb-1">
                    Value {addForm.commission_type === 'percentage' ? '(%)' : '(₹)'}
                  </label>
                  <input
                    type="number"
                    value={addForm.commission_value}
                    onChange={e => setAddForm(p => ({ ...p, commission_value: e.target.value === '' ? 0 : Number(e.target.value) }))}
                    placeholder="10"
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40"
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={!addForm.full_name || !addForm.phone || addConnectorMutation.isPending}
              onClick={() => addConnectorMutation.mutate(addForm)}
              className="w-full py-3 bg-gradient-to-r from-performance-red to-[#93000a] text-white rounded-xl text-xs font-label-caps tracking-widest font-bold border border-white/10 uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(255,43,43,0.3)]"
            >
              {addConnectorMutation.isPending ? 'REGISTERING...' : 'REGISTER CONNECTOR'}
            </button>
          </div>
        </div>
      )}
      {/* ADD MANUAL COMMISSION MODAL */}
      {showAddCommModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 pt-20 sm:pt-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl relative space-y-4 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-display-hero text-lg font-black text-white tracking-tight italic uppercase">
                  Add Manual Commission
                </h3>
                <p className="text-[10px] text-tertiary/50 font-label-caps tracking-widest uppercase">
                  Record commission ledger entry
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCommModal(false)}
                className="text-tertiary hover:text-white p-1 hover:bg-white/5 rounded-lg transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-label-caps text-[9px] text-tertiary/60 tracking-widest block mb-1">Connector / Referral Partner *</label>
                <select
                  value={addCommForm.connector_id}
                  onChange={e => setAddCommForm(p => ({ ...p, connector_id: e.target.value === '' ? '' : Number(e.target.value) }))}
                  className="w-full bg-[#0a0a0a] border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40"
                >
                  <option value="">Select Referral Partner...</option>
                  {dbConnectors.map((conn: any) => (
                    <option key={conn.id} value={conn.id}>{conn.full_name} ({conn.phone})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-label-caps text-[9px] text-tertiary/60 tracking-widest block mb-1">Job Card ID *</label>
                  <input
                    type="number"
                    value={addCommForm.job_card_id}
                    onChange={e => setAddCommForm(p => ({ ...p, job_card_id: e.target.value === '' ? '' : Number(e.target.value) }))}
                    placeholder="e.g. 12"
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 font-mono"
                  />
                </div>
                <div>
                  <label className="font-label-caps text-[9px] text-tertiary/60 tracking-widest block mb-1">Customer ID *</label>
                  <input
                    type="number"
                    value={addCommForm.customer_id}
                    onChange={e => setAddCommForm(p => ({ ...p, customer_id: e.target.value === '' ? '' : Number(e.target.value) }))}
                    placeholder="e.g. 5"
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-label-caps text-[9px] text-tertiary/60 tracking-widest block mb-1">Job Total Amount (₹)</label>
                  <input
                    type="number"
                    value={addCommForm.job_amount}
                    onChange={e => setAddCommForm(p => ({ ...p, job_amount: e.target.value === '' ? '' : Number(e.target.value) }))}
                    placeholder="50000"
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 font-mono"
                  />
                </div>
                <div>
                  <label className="font-label-caps text-[9px] text-tertiary/60 tracking-widest block mb-1">Commission (₹) *</label>
                  <input
                    type="number"
                    value={addCommForm.commission_amount}
                    onChange={e => setAddCommForm(p => ({ ...p, commission_amount: e.target.value === '' ? '' : Number(e.target.value) }))}
                    placeholder="5000"
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 font-mono text-emerald-400 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-label-caps text-[9px] text-tertiary/60 tracking-widest block mb-1">Notes / Description</label>
                <textarea
                  rows={2}
                  value={addCommForm.notes}
                  onChange={e => setAddCommForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Optional details or terms"
                  className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-performance-red/40"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={!addCommForm.connector_id || !addCommForm.job_card_id || !addCommForm.customer_id || !addCommForm.commission_amount || addCommissionMutation.isPending}
              onClick={() => addCommissionMutation.mutate()}
              className="w-full py-3 bg-gradient-to-r from-performance-red to-[#93000a] text-white rounded-xl text-xs font-label-caps tracking-widest font-bold border border-white/10 uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(255,43,43,0.3)]"
            >
              {addCommissionMutation.isPending ? 'CREATING...' : 'CREATE COMMISSION RECORD'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
