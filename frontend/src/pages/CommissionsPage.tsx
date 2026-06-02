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

  const { data: commissionsRes, isLoading } = useQuery({
    queryKey: ['commissions'],
    queryFn: () => commissionsAPI.list(),
  });

  const commissions = (commissionsRes?.data || []) as Commission[];

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

  const filtered = commissions.filter(c => filter==='all' || c.status===filter);
  const totalPaid    = commissions.filter(c=>c.status==='paid').reduce((s,c)=>s+Number(c.commission_amount),0);
  const totalPending = commissions.filter(c=>c.status!=='paid').reduce((s,c)=>s+Number(c.commission_amount),0);

  // Group connectors
  const connectors = [...new Map(commissions.map(c=>[c.connector_name || c.connector_id,{
    name: c.connector_name || `Connector ${c.connector_id}`, phone: c.connector_phone || '—',
    jobs: commissions.filter(x=>(x.connector_name || x.connector_id)===(c.connector_name || c.connector_id)).length,
    total: commissions.filter(x=>(x.connector_name || x.connector_id)===(c.connector_name || c.connector_id)).reduce((s,x)=>s+Number(x.commission_amount),0),
    paid: commissions.filter(x=>(x.connector_name || x.connector_id)===(c.connector_name || c.connector_id)&&x.status==='paid').reduce((s,x)=>s+Number(x.commission_amount),0),
  }])).values()];

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
        <div>
          <button className="btn btn-primary px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">add</span>Add Referral
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label:'Total Commissions', value:`₹${((totalPaid+totalPending)/1000).toFixed(1)}K`, icon:'handshake',  color:'text-white', glowColor: 'rgba(255,255,255,0.03)'        },
          { label:'Paid Out',          value:`₹${(totalPaid/1000).toFixed(1)}K`,                icon:'payments',   color:'text-emerald-400', glowColor: 'rgba(52,211,153,0.03)'    },
          { label:'Pending',           value:`₹${(totalPending/1000).toFixed(1)}K`,             icon:'schedule',   color:'text-amber-400', glowColor: 'rgba(251,191,36,0.03)'   },
          { label:'Connectors',        value:connectors.length,                                  icon:'group',      color:'text-performance-red', glowColor: 'rgba(255,43,43,0.03)'   },
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
            ) : connectors.length === 0 ? (
              <div className="py-12 text-center text-tertiary/30 italic text-sm">No connectors registered</div>
            ) : connectors.sort((a,b)=>b.total-a.total).map((c,i)=>(
              <div key={c.name} className="px-6 py-4 hover:bg-white/[0.01] transition-colors flex items-center gap-4">
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
            <div className="flex items-center gap-1.5 p-1 bg-black/30 border border-white/5 rounded-xl">
              {(['all','pending','approved','paid'] as const).map(s=>{
                const cfg = s!=='all' ? STATUS_CFG[s] : null;
                return (
                  <button 
                    key={s} 
                    onClick={()=>setFilter(s)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all hover:cursor-pointer ${
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
            <table className="w-full text-left border-collapse">
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
    </div>
  );
}
