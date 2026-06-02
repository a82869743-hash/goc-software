import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsAPI, JobCard } from '../api/jobs';
import toast from 'react-hot-toast';

type JobStatus = 'scheduled' | 'car_in' | 'washing' | 'in_progress' | 'qc' | 'rework' | 'ready' | 'delivered' | 'cancelled' | 'estimate';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  in_progress: { label: 'Work in Progress', color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  dot: 'bg-amber-400 animate-pulse' },
  ready:       { label: 'Ready',       color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  dot: 'bg-green-400' },
  estimate:    { label: 'Estimate',    color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   dot: 'bg-blue-400 animate-pulse' },
  delivered:   { label: 'Final Delivered', color: 'text-gray-400',   bg: 'bg-gray-500/10',   border: 'border-gray-500/20',   dot: 'bg-gray-500' },
  cancelled:   { label: 'Cancelled',   color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    dot: 'bg-red-500' },
  // Keep older ones mapped so if they exist in the DB they don't break/crash the page
  scheduled:   { label: 'Scheduled',   color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   dot: 'bg-blue-400' },
  car_in:      { label: 'Car In',      color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20',   dot: 'bg-cyan-400' },
  washing:     { label: 'Washing',     color: 'text-sky-400',    bg: 'bg-sky-500/10',    border: 'border-sky-500/20',    dot: 'bg-sky-400 animate-pulse' },
  qc:          { label: 'QC Check',    color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', dot: 'bg-purple-400' },
  rework:      { label: 'Rework',      color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', dot: 'bg-orange-400 animate-pulse' },
};

const PIPELINE_TABS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All Jobs' },
  { value: 'in_progress', label: 'Work in Progress' },
  { value: 'ready', label: 'Ready' },
  { value: 'estimate', label: 'Estimate' },
  { value: 'delivered', label: 'Final Delivered' },
];

export default function JobCardsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const { data: pipelineRes } = useQuery({
    queryKey: ['jobs-pipeline'],
    queryFn: () => jobsAPI.pipeline(),
    refetchInterval: 30000,
  });
  const pipeline = (pipelineRes?.data || {}) as Record<string, number>;

  const { data: jobsRes, isLoading } = useQuery({
    queryKey: ['jobs', activeTab, search, dateFrom, dateTo, page],
    queryFn: () => jobsAPI.list({
      status: activeTab === 'all' ? undefined : activeTab as JobStatus,
      search: search || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page,
      limit: 20,
    }),
  });

  const jobs = (jobsRes?.data || []) as JobCard[];
  const meta = jobsRes?.meta;

  const deleteMutation = useMutation({
    mutationFn: (id: number) => jobsAPI.delete(id),
    onSuccess: () => {
      toast.success('Job card deleted.');
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs-pipeline'] });
    },
    onError: () => toast.error('Failed to delete job card.'),
  });

  const activeCount = Object.entries(pipeline)
    .filter(([s]) => !['delivered', 'cancelled'].includes(s))
    .reduce((sum, [, c]) => sum + Number(c), 0);

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display-hero text-display-hero text-on-surface flex items-center gap-3">
            <span className="material-symbols-outlined text-performance-red text-3xl">precision_manufacturing</span>
            JOB CARDS
          </h1>
          <p className="font-label-caps text-[10px] text-on-surface-variant/50 tracking-widest mt-1 uppercase">
            {activeCount} ACTIVE IN STUDIO — GOC PREMIUM AUTO DETAILING
          </p>
        </div>
        <button
          onClick={() => navigate('/jobs/new')}
          className="performance-gradient text-white font-label-caps text-label-caps px-6 py-3 rounded-xl flex items-center gap-2 hover:shadow-[0_0_25px_rgba(255,43,43,0.35)] active:scale-[0.97] transition-all border border-white/10 uppercase tracking-widest shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Job Card
        </button>
      </div>

      {/* ── Pipeline Count Badges ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
        {['in_progress', 'ready', 'estimate', 'delivered'].map((status) => {
            const count = pipeline[status] || 0;
            const cfg = STATUS_CONFIG[status];
            if (!cfg) return null;
            return (
              <button
                key={status}
                onClick={() => setActiveTab(activeTab === status ? 'all' : status)}
                className={`glass-panel rounded-xl p-3 text-center border transition-all cursor-pointer ${
                  activeTab === status ? `${cfg.border} ${cfg.bg}` : 'border-white/5 hover:border-white/10'
                }`}
              >
                <p className={`font-data-lg text-xl font-bold ${activeTab === status ? cfg.color : 'text-white'}`}>{count}</p>
                <p className={`font-label-caps text-[9px] mt-1 uppercase tracking-wider ${activeTab === status ? cfg.color : 'text-on-surface-variant/50'}`}>
                  {cfg.label}
                </p>
              </button>
            );
          })}
      </div>

      {/* ── Filters Bar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 flex-1 min-w-[200px] max-w-[400px]">
          <span className="material-symbols-outlined text-on-surface-variant/40 text-[18px]">search</span>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, phone, job code…"
            className="bg-transparent border-none outline-none text-white text-sm flex-1 placeholder-on-surface-variant/40 font-data-sm"
          />
        </div>
        <input
          type="date"
          value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setPage(1); }}
          className="bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white font-data-sm outline-none focus:border-performance-red/40"
        />
        <input
          type="date"
          value={dateTo}
          onChange={e => { setDateTo(e.target.value); setPage(1); }}
          className="bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white font-data-sm outline-none focus:border-performance-red/40"
        />
        {(search || dateFrom || dateTo || activeTab !== 'all') && (
          <button
            onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setActiveTab('all'); setPage(1); }}
            className="px-3 py-2 text-xs text-on-surface-variant/60 hover:text-white border border-white/5 rounded-lg transition-all font-label-caps"
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Pipeline Tabs ── */}
      <div className="flex items-center gap-1 p-1 bg-black/40 border border-white/[0.06] rounded-lg overflow-x-auto custom-scrollbar">
        {PIPELINE_TABS.map(tab => {
          const cfg = STATUS_CONFIG[tab.value];
          return (
            <button
              key={tab.value}
              onClick={() => { setActiveTab(tab.value); setPage(1); }}
              className={`px-4 py-2 rounded-lg font-label-caps text-[10px] uppercase tracking-wider whitespace-nowrap transition-all border ${
                activeTab === tab.value
                  ? (cfg ? `${cfg.bg} ${cfg.border} ${cfg.color}` : 'bg-white/10 border-white/20 text-white')
                  : 'bg-transparent border-transparent text-on-surface-variant/50 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Jobs Table ── */}
      <div className="bg-[#111111] border border-white/[0.06] rounded-xl overflow-hidden shadow-2xl">
        {isLoading ? (
          <div className="py-20 text-center text-on-surface-variant/40">
            <span className="material-symbols-outlined text-3xl animate-spin block mb-3 text-performance-red">sync</span>
            <p className="font-label-caps text-xs tracking-widest">LOADING JOB CARDS...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-20 text-center text-on-surface-variant/40">
            <span className="material-symbols-outlined text-5xl block mb-3 opacity-30 text-performance-red">precision_manufacturing</span>
            <p className="font-label-caps text-xs tracking-widest">NO JOB CARDS FOUND</p>
            <button onClick={() => navigate('/jobs/new')} className="mt-4 performance-gradient text-white px-5 py-2.5 rounded-xl font-label-caps text-xs tracking-widest border border-white/10">
              + Create First Job Card
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/45 text-on-surface-variant/50 text-[9px] font-label-caps uppercase tracking-widest border-b border-white/[0.06]">
                  {['Job Code', 'Customer', 'Vehicle', 'Services', 'Status', 'Total', 'Date In', 'Actions'].map(h => (
                    <th key={h} className="py-3.5 px-5 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-data-sm text-xs divide-y divide-white/[0.02]">
                {jobs.map((job) => {
                  const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.scheduled;
                  return (
                    <tr
                      key={job.id}
                      className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                      onClick={() => navigate(`/jobs/${job.id}`)}
                    >
                      <td className="py-3.5 px-5">
                        <p className="font-data-lg text-xs font-bold text-performance-red">{job.job_code}</p>
                      </td>
                      <td className="py-3.5 px-5">
                        <p className="text-xs font-bold text-white">{job.customer_name || '—'}</p>
                        <p className="text-[10px] text-on-surface-variant/50 mt-0.5">{job.customer_phone || ''}</p>
                      </td>
                      <td className="py-3.5 px-5">
                        <p className="text-xs text-on-surface-variant">{job.vehicle_name || '—'}</p>
                        <p className="text-[10px] text-on-surface-variant/40 mt-0.5">{job.reg_number || 'No Reg'}</p>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="text-on-surface-variant/60">{(job.services?.length ?? 0)} item(s)</span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border ${cfg.bg} ${cfg.border} ${cfg.color} text-[8px] font-label-caps uppercase tracking-wider`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <p className="font-data-sm text-xs font-bold text-white">₹{Number(job.total_amount).toLocaleString('en-IN')}</p>
                        {Number(job.balance_due) > 0 && (
                          <p className="text-[9px] text-orange-400 mt-0.5">₹{Number(job.balance_due).toLocaleString('en-IN')} due</p>
                        )}
                      </td>
                      <td className="py-3.5 px-5">
                        <p className="text-on-surface-variant/60">
                          {job.date_in ? new Date(job.date_in).toLocaleDateString('en-IN') : job.created_at ? new Date(job.created_at).toLocaleDateString('en-IN') : '—'}
                        </p>
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <Link to={`/jobs/${job.id}`} className="p-1.5 rounded-lg hover:bg-white/5 text-on-surface-variant/30 hover:text-white transition-colors" title="View">
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                          </Link>
                          <Link to={`/jobs/${job.id}/edit`} className="p-1.5 rounded-lg hover:bg-white/5 text-on-surface-variant/30 hover:text-white transition-colors" title="Edit">
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </Link>
                          {!['delivered', 'cancelled'].includes(job.status) && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Delete job card ${job.job_code}? This cannot be undone.`)) {
                                  deleteMutation.mutate(job.id);
                                }
                              }}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-on-surface-variant/30 hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-lg border border-white/10 text-xs font-label-caps text-on-surface-variant/60 hover:text-white disabled:opacity-30 transition-all"
          >
            Previous
          </button>
          <span className="font-data-sm text-xs text-on-surface-variant/50">
            Page {page} of {meta.totalPages}
          </span>
          <button
            disabled={page === meta.totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-lg border border-white/10 text-xs font-label-caps text-on-surface-variant/60 hover:text-white disabled:opacity-30 transition-all"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
