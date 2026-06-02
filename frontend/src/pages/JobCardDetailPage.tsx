import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsAPI, JobCard, JobService } from '../api/jobs';
import toast from 'react-hot-toast';

const STATUS_PIPELINE = ['in_progress', 'ready', 'estimate', 'delivered'] as const;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  in_progress: { label: 'Work in Progress', color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  icon: 'precision_manufacturing' },
  ready:       { label: 'Ready',       color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  icon: 'check_circle' },
  estimate:    { label: 'Estimate',    color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   icon: 'receipt_long' },
  delivered:   { label: 'Final Delivered', color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20', icon: 'local_shipping' },
  cancelled:   { label: 'Cancelled',   color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    icon: 'cancel' },
  // Keep older ones mapped so if they exist in the DB they don't break/crash the page
  scheduled:   { label: 'Scheduled',   color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   icon: 'schedule' },
  car_in:      { label: 'Car In',      color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20',   icon: 'login' },
  washing:     { label: 'Washing',     color: 'text-sky-400',    bg: 'bg-sky-500/10',    border: 'border-sky-500/20',    icon: 'water_drop' },
  qc:          { label: 'QC Check',    color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: 'verified' },
  rework:      { label: 'Rework',      color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: 'replay' },
};

const JOB_STATUS_FLOW: Record<string, string[]> = {
  in_progress: ['ready', 'cancelled'],
  ready: ['estimate', 'cancelled'],
  estimate: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
  // Keep transitions for older statuses to move them forward or cancel
  scheduled: ['in_progress', 'cancelled'],
  car_in: ['in_progress', 'cancelled'],
  washing: ['in_progress', 'cancelled'],
  qc: ['ready', 'cancelled'],
  rework: ['in_progress', 'cancelled'],
};

export default function JobCardDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusNotes, setStatusNotes] = useState('');
  const [showAddService, setShowAddService] = useState(false);
  const [newSvc, setNewSvc] = useState({
    service_name: '',
    service_type: 'other' as 'other' | 'ppf' | 'ceramic' | 'polish' | 'detailing',
    package_tier: 'premium' as 'basic' | 'premium' | 'elite',
    unit_price: 0,
    quantity: 1,
    sqft_used: 0,
    ml_used: 0,
    description: '',
    item_type: 'labor' as 'labor' | 'part',
    tax_pct: 18
  });
  const [svcSearch, setSvcSearch] = useState('');
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeForm, setCompleteForm] = useState({ completion_type: 'invoice' as 'invoice' | 'estimate', gst_applicable: true, payment_mode: 'cash', notes: '' });
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  const handleDownloadInvoice = async () => {
    if (!id) return;
    try {
      setDownloadingInvoice(true);
      const res = await jobsAPI.getInvoicePdf(Number(id));
      if (res.data?.pdf_url) {
        window.open(`http://localhost:4000${res.data.pdf_url}`, '_blank');
        toast.success('Document downloaded successfully!');
      } else {
        toast.error('Failed to obtain invoice URL.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error?.message || 'Failed to download document.');
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const { data: jobRes, isLoading } = useQuery({
    queryKey: ['job-detail', id],
    queryFn: () => jobsAPI.getById(Number(id)),
    enabled: !!id,
  });
  const job = jobRes?.data as (JobCard & { services?: JobService[]; statusLog?: any[]; concerns?: any[] }) | undefined;

  const { data: svcCatalogRes } = useQuery({
    queryKey: ['svcCatalog-detail', svcSearch],
    queryFn: () => jobsAPI.searchServiceCatalog(svcSearch),
    enabled: svcSearch.length >= 1,
  });

  const statusMutation = useMutation({
    mutationFn: ({ new_status, notes }: { new_status: string; notes?: string }) =>
      jobsAPI.updateStatus(Number(id), new_status, notes),
    onSuccess: (res) => {
      toast.success(`Status updated to ${res.data?.status?.toUpperCase()}`);
      setStatusNotes('');
      queryClient.invalidateQueries({ queryKey: ['job-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['jobs-pipeline'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to update status.'),
  });

  const addServiceMutation = useMutation({
    mutationFn: (svc: Partial<JobService>) => jobsAPI.addService(Number(id), svc),
    onSuccess: () => {
      toast.success('Service added.');
      setShowAddService(false);
      setNewSvc({
        service_name: '',
        service_type: 'other' as 'other' | 'ppf' | 'ceramic' | 'polish' | 'detailing',
        package_tier: 'premium' as 'basic' | 'premium' | 'elite',
        unit_price: 0,
        quantity: 1,
        sqft_used: 0,
        ml_used: 0,
        description: '',
        item_type: 'labor' as 'labor' | 'part',
        tax_pct: 18
      });
      queryClient.invalidateQueries({ queryKey: ['job-detail', id] });
    },
    onError: () => toast.error('Failed to add service.'),
  });

  const deleteServiceMutation = useMutation({
    mutationFn: (serviceId: number) => jobsAPI.deleteService(Number(id), serviceId),
    onSuccess: () => {
      toast.success('Service removed.');
      queryClient.invalidateQueries({ queryKey: ['job-detail', id] });
    },
    onError: () => toast.error('Failed to remove service.'),
  });

  const completeMutation = useMutation({
    mutationFn: () => jobsAPI.completeJob(Number(id), completeForm),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Job completed!');
      setShowCompleteModal(false);
      queryClient.invalidateQueries({ queryKey: ['job-detail', id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to complete job.'),
  });

  const dispatchMutation = useMutation({
    mutationFn: () => jobsAPI.dispatch(Number(id), 'whatsapp'),
    onSuccess: () => toast.success('Dispatched via WhatsApp!'),
    onError: () => toast.error('Failed to dispatch.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => jobsAPI.delete(Number(id)),
    onSuccess: () => { toast.success('Job card deleted.'); navigate('/jobs'); },
    onError: () => toast.error('Failed to delete.'),
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <span className="material-symbols-outlined text-4xl animate-spin text-performance-red block mb-3">sync</span>
          <p className="font-label-caps text-xs text-on-surface-variant/40 tracking-widest">LOADING JOB CARD...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-6 text-center py-20">
        <span className="material-symbols-outlined text-5xl text-red-400 block mb-3">error</span>
        <p className="text-on-surface-variant text-sm">Job card not found.</p>
        <button onClick={() => navigate('/jobs')} className="mt-4 text-performance-red font-label-caps text-xs hover:underline">← Back to Jobs</button>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.scheduled;
  const allowedNext = JOB_STATUS_FLOW[job.status] || [];
  const currentIdx = STATUS_PIPELINE.indexOf(job.status as any);

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/jobs')} className="p-2 rounded-lg hover:bg-white/5 text-on-surface-variant/60 hover:text-white transition-colors">
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display-hero text-display-hero text-on-surface">{job.job_code}</h1>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border ${cfg.bg} ${cfg.border} ${cfg.color} text-[10px] font-label-caps uppercase tracking-wider`}>
                <span className="material-symbols-outlined text-[14px]">{cfg.icon}</span>
                {cfg.label}
              </span>
            </div>
            <p className="font-label-caps text-[10px] text-on-surface-variant/50 tracking-widest mt-1 uppercase">
              {job.customer_name} • {job.vehicle_name} {job.reg_number ? `[${job.reg_number}]` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {job.completion_type && (
            <button
              onClick={handleDownloadInvoice}
              disabled={downloadingInvoice}
              className="px-4 py-2 rounded-lg border border-white/10 text-on-surface-variant/60 hover:text-white font-label-caps text-xs tracking-widest transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">
                {downloadingInvoice ? 'sync' : 'picture_as_pdf'}
              </span>
              {downloadingInvoice ? 'COMPILING...' : `DOWNLOAD ${job.completion_type.toUpperCase()}`}
            </button>
          )}
          <Link to={`/jobs/${id}/edit`} className="px-4 py-2 rounded-lg border border-white/10 text-on-surface-variant/60 hover:text-white font-label-caps text-xs tracking-widest transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">edit</span> Edit
          </Link>
          <button onClick={() => dispatchMutation.mutate()} disabled={dispatchMutation.isPending} className="px-4 py-2 rounded-lg border border-green-500/20 text-green-400 hover:bg-green-500/10 font-label-caps text-xs tracking-widest transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">send</span> WhatsApp
          </button>
          {!['delivered', 'cancelled'].includes(job.status) && (
            <button
              onClick={() => { if (window.confirm('Delete this job card?')) deleteMutation.mutate(); }}
              className="px-4 py-2 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 font-label-caps text-xs tracking-widest transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span> Delete
            </button>
          )}
        </div>
      </div>

      {/* ── Status Pipeline ── */}
      <div className="glass-panel rounded-2xl p-6">
        <h2 className="font-label-caps text-[10px] text-on-surface-variant/50 tracking-widest mb-4">STATUS PIPELINE</h2>
        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-2">
          {STATUS_PIPELINE.map((status, idx) => {
            const sCfg = STATUS_CONFIG[status];
            const isPast = idx < currentIdx;
            const isCurrent = idx === currentIdx;
            return (
              <div key={status} className="flex items-center">
                <div className={`px-3 py-2 rounded-lg text-[9px] font-label-caps uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isCurrent ? `${sCfg.bg} ${sCfg.border} ${sCfg.color} border shadow-lg` : isPast ? 'bg-white/5 text-white/40' : 'text-on-surface-variant/20'
                }`}>
                  <span className="material-symbols-outlined text-[14px]">{isPast ? 'check_circle' : sCfg.icon}</span>
                  {sCfg.label}
                </div>
                {idx < STATUS_PIPELINE.length - 1 && (
                  <span className={`material-symbols-outlined text-[14px] mx-1 ${isPast ? 'text-white/20' : 'text-on-surface-variant/10'}`}>chevron_right</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Status Transition Actions */}
        {allowedNext.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="flex items-center gap-3 flex-wrap">
              <input
                value={statusNotes}
                onChange={e => setStatusNotes(e.target.value)}
                placeholder="Notes for status change (optional)…"
                className="flex-1 min-w-[200px] bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40 font-data-sm"
              />
              {allowedNext.map(nextStatus => {
                const nCfg = STATUS_CONFIG[nextStatus];
                return (
                  <button
                    key={nextStatus}
                    onClick={() => statusMutation.mutate({ new_status: nextStatus, notes: statusNotes || undefined })}
                    disabled={statusMutation.isPending}
                    className={`px-4 py-2 rounded-lg border ${nCfg.border} ${nCfg.color} hover:${nCfg.bg} font-label-caps text-xs tracking-widest transition-all flex items-center gap-2 disabled:opacity-50`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{nCfg.icon}</span>
                    → {nCfg.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left Column (2/3) ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Services */}
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-label-caps text-[10px] text-on-surface-variant/50 tracking-widest">SERVICES</h2>
              {!['delivered', 'cancelled'].includes(job.status) && (
                <button onClick={() => setShowAddService(!showAddService)} className="text-performance-red font-label-caps text-[10px] flex items-center gap-1 hover:underline">
                  <span className="material-symbols-outlined text-[14px]">add</span> Add Service
                </button>
              )}
            </div>

            {showAddService && (
              <div className="mb-4 p-4 bg-white/[0.02] border border-white/[0.07] rounded-xl space-y-4">
                <div className="relative">
                  <input
                    value={svcSearch}
                    onChange={e => setSvcSearch(e.target.value)}
                    placeholder="Search catalog or type service name…"
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
                  />
                  {svcSearch.length >= 1 && svcCatalogRes?.data && svcCatalogRes.data.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden max-h-40 overflow-y-auto z-20">
                      {svcCatalogRes.data.map((item: any) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setNewSvc(prev => ({
                              ...prev,
                              service_name: item.name,
                              service_type: item.service_type,
                              unit_price: item.default_rate,
                              tax_pct: item.tax_pct !== undefined ? Number(item.tax_pct) : 18
                            }));
                            setSvcSearch('');
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 text-sm text-white flex justify-between"
                        >
                          <span>{item.name}</span>
                          <span className="text-performance-red">₹{Number(item.default_rate).toLocaleString('en-IN')}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <div className="col-span-2">
                    <label className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest block mb-1">Service Name / Description</label>
                    <input
                      value={newSvc.service_name}
                      onChange={e => setNewSvc(p => ({ ...p, service_name: e.target.value }))}
                      placeholder="Service Name"
                      className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
                    />
                  </div>
                  <div>
                    <label className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest block mb-1">Type</label>
                    <select
                      value={newSvc.item_type}
                      onChange={e => setNewSvc(p => ({ ...p, item_type: e.target.value as 'labor' | 'part' }))}
                      className="w-full bg-black border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
                    >
                      <option value="labor">Labor</option>
                      <option value="part">Part</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest block mb-1">Price</label>
                    <input
                      type="number"
                      value={newSvc.unit_price === 0 ? '' : newSvc.unit_price}
                      onChange={e => setNewSvc(p => ({ ...p, unit_price: e.target.value === '' ? 0 : Number(e.target.value) }))}
                      placeholder="Price"
                      className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
                    />
                  </div>
                  <div>
                    <label className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest block mb-1">GST (%)</label>
                    <input
                      type="number"
                      value={newSvc.tax_pct === 0 ? '' : newSvc.tax_pct}
                      onChange={e => setNewSvc(p => ({ ...p, tax_pct: e.target.value === '' ? 0 : Number(e.target.value) }))}
                      placeholder="18"
                      className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
                    />
                  </div>
                  <div>
                    <label className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest block mb-1">Qty</label>
                    <input
                      type="number"
                      value={newSvc.quantity === 0 ? '' : newSvc.quantity}
                      min={1}
                      onChange={e => setNewSvc(p => ({ ...p, quantity: e.target.value === '' ? 0 : Number(e.target.value) }))}
                      placeholder="Qty"
                      className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowAddService(false)} className="px-3 py-1.5 text-xs text-on-surface-variant/50 hover:text-white transition-colors font-label-caps">Cancel</button>
                  <button
                    onClick={() => addServiceMutation.mutate(newSvc)}
                    disabled={!newSvc.service_name || newSvc.unit_price <= 0 || addServiceMutation.isPending}
                    className="performance-gradient text-white font-label-caps text-xs px-4 py-1.5 rounded-lg border border-white/10 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {(job.services && job.services.length > 0) ? (
              <div className="space-y-2">
                {job.services.map((svc) => (
                  <div key={svc.id} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl group">
                    <div className="flex-1">
                      <p className="text-sm text-white font-bold">{svc.service_name}</p>
                      <p className="text-[10px] text-on-surface-variant/50 mt-0.5">
                        {svc.item_type?.toUpperCase() || 'LABOR'} • GST: {svc.tax_pct !== undefined ? svc.tax_pct : 18}% • Qty: {svc.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-data-sm text-white font-bold">₹{Number(svc.line_total).toLocaleString('en-IN')}</p>
                      {!['delivered', 'cancelled'].includes(job.status) && (
                        <button
                          onClick={() => { if (window.confirm('Remove this service?')) deleteServiceMutation.mutate(svc.id); }}
                          className="p-1 rounded hover:bg-red-500/10 text-on-surface-variant/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pt-3 border-t border-white/10">
                  <span className="font-label-caps text-xs text-on-surface-variant/50">Total Amount</span>
                  <span className="font-data-lg text-lg text-performance-red font-bold">₹{Number(job.total_amount).toLocaleString('en-IN')}</span>
                </div>
              </div>
            ) : (
              <p className="text-on-surface-variant/30 text-sm text-center py-6">No services added yet.</p>
            )}
          </div>

          {/* Status Timeline */}
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="font-label-caps text-[10px] text-on-surface-variant/50 tracking-widest mb-4">STATUS HISTORY</h2>
            {(job as any).statusLog && (job as any).statusLog.length > 0 ? (
              <div className="space-y-3">
                {(job as any).statusLog.map((log: any) => {
                  const lCfg = STATUS_CONFIG[log.new_status] || STATUS_CONFIG.scheduled;
                  return (
                    <div key={log.id} className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${lCfg.bg} ${lCfg.border} border shrink-0 mt-0.5`}>
                        <span className={`material-symbols-outlined text-[14px] ${lCfg.color}`}>{lCfg.icon}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-label-caps text-[9px] ${lCfg.color} uppercase tracking-wider`}>{lCfg.label}</span>
                          <span className="text-on-surface-variant/20">•</span>
                          <span className="text-[10px] text-on-surface-variant/40">{log.staff_name || 'System'}</span>
                        </div>
                        {log.notes && <p className="text-xs text-on-surface-variant/50 mt-0.5">{log.notes}</p>}
                        <p className="text-[10px] text-on-surface-variant/30 mt-0.5">{new Date(log.created_at).toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-on-surface-variant/30 text-sm text-center py-4">No status history.</p>
            )}
          </div>
        </div>

        {/* ── Right Column (1/3) ── */}
        <div className="space-y-6">

          {/* Job Info */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h2 className="font-label-caps text-[10px] text-on-surface-variant/50 tracking-widest">JOB INFO</h2>
            {[
              { label: 'Customer', value: job.customer_name, icon: 'person' },
              { label: 'Phone', value: job.customer_phone, icon: 'phone' },
              job.customer_alt_phone ? { label: 'Alt Phone', value: job.customer_alt_phone, icon: 'phone' } : null,
              job.customer_email ? { label: 'Email', value: job.customer_email, icon: 'mail' } : null,
              job.customer_dob ? { label: 'DOB', value: new Date(job.customer_dob).toLocaleDateString('en-IN'), icon: 'calendar_month' } : null,
              job.customer_address ? { label: 'Address', value: `${job.customer_address}${job.customer_city ? `, ${job.customer_city}` : ''}`, icon: 'location_on' } : null,
              job.customer_notes ? { label: 'Customer Notes', value: job.customer_notes, icon: 'description' } : null,
              { label: 'Vehicle', value: `${job.vehicle_name || '—'}`, icon: 'directions_car' },
              job.vehicle_year ? { label: 'Vehicle Year', value: job.vehicle_year.toString(), icon: 'calendar_today' } : null,
              job.vehicle_fuel_type ? { label: 'Fuel Type', value: job.vehicle_fuel_type.toUpperCase(), icon: 'local_gas_station' } : null,
              job.vehicle_color ? { label: 'Color', value: job.vehicle_color, icon: 'palette' } : null,
              job.vehicle_notes ? { label: 'Vehicle Notes', value: job.vehicle_notes, icon: 'note' } : null,
              { label: 'Reg No.', value: job.reg_number || '—', icon: 'pin' },
              { label: 'Job Type', value: (job.job_type || 'walkin').toUpperCase(), icon: 'category' },
              { label: 'Date In', value: job.date_in ? new Date(job.date_in).toLocaleDateString('en-IN') : '—', icon: 'login' },
              { label: 'Expected Out', value: job.expected_out ? new Date(job.expected_out).toLocaleDateString('en-IN') : '—', icon: 'event' },
              { label: 'Date Out', value: job.date_out ? new Date(job.date_out).toLocaleDateString('en-IN') : '—', icon: 'logout' },
              { label: 'Created By', value: job.created_by_name || '—', icon: 'badge' },
            ].filter(Boolean).map((item: any) => (
              <div key={item.label} className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant/30 mt-0.5">{item.icon}</span>
                <div className="flex-1">
                  <p className="font-label-caps text-[8px] text-on-surface-variant/40 tracking-widest">{item.label}</p>
                  <p className="text-sm text-white">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Financial */}
          <div className="glass-panel rounded-2xl p-6 space-y-3">
            <h2 className="font-label-caps text-[10px] text-on-surface-variant/50 tracking-widest">FINANCIAL</h2>
            <div className="flex justify-between">
              <span className="text-on-surface-variant/50 text-sm">Total</span>
              <span className="text-white font-bold">₹{Number(job.total_amount).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant/50 text-sm">Paid</span>
              <span className="text-green-400 font-bold">₹{Number(job.amount_paid).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-2">
              <span className="text-on-surface-variant/50 text-sm">Balance Due</span>
              <span className={`font-bold ${Number(job.balance_due) > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                ₹{Number(job.balance_due).toLocaleString('en-IN')}
              </span>
            </div>
            {['ready', 'estimate', 'delivered'].includes(job.status) && (
              <button
                onClick={() => setShowCompleteModal(true)}
                className="w-full mt-3 performance-gradient text-white font-label-caps text-xs py-2.5 rounded-lg border border-white/10 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                Generate Invoice / Estimate
              </button>
            )}
          </div>

          {/* Concerns */}
          {(job as any).concerns && (job as any).concerns.length > 0 && (
            <div className="glass-panel rounded-2xl p-6 space-y-3">
              <h2 className="font-label-caps text-[10px] text-on-surface-variant/50 tracking-widest">CUSTOMER CONCERNS</h2>
              {(job as any).concerns.map((c: any) => (
                <div key={c.id} className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[14px] text-performance-red mt-0.5">warning</span>
                  <p className="text-sm text-on-surface-variant">{c.concern_text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          {job.internal_notes && (
            <div className="glass-panel rounded-2xl p-6 space-y-3">
              <h2 className="font-label-caps text-[10px] text-on-surface-variant/50 tracking-widest">INTERNAL NOTES</h2>
              <p className="text-sm text-on-surface-variant/70">{job.internal_notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Complete Job Modal ── */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-8 w-full max-w-md space-y-6">
            <h2 className="font-display-hero text-lg text-on-surface">Complete Job — Generate Document</h2>
            <div>
              <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Document Type</label>
              <select
                value={completeForm.completion_type}
                onChange={e => setCompleteForm(p => ({ ...p, completion_type: e.target.value as any }))}
                className="w-full bg-black border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none"
              >
                <option value="invoice">Tax Invoice</option>
                <option value="estimate">Estimate</option>
              </select>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={completeForm.gst_applicable}
                onChange={e => setCompleteForm(p => ({ ...p, gst_applicable: e.target.checked }))}
                className="w-4 h-4 accent-performance-red"
              />
              <span className="text-sm text-white">Apply GST (18%)</span>
            </label>
            <div>
              <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Payment Mode</label>
              <select
                value={completeForm.payment_mode}
                onChange={e => setCompleteForm(p => ({ ...p, payment_mode: e.target.value }))}
                className="w-full bg-black border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none"
              >
                {['cash', 'upi', 'card', 'bank_transfer', 'cheque'].map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowCompleteModal(false)} className="px-4 py-2 text-on-surface-variant/50 hover:text-white text-xs font-label-caps transition-colors">Cancel</button>
              <button
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                className="performance-gradient text-white font-label-caps text-xs px-5 py-2.5 rounded-lg border border-white/10 disabled:opacity-50"
              >
                {completeMutation.isPending ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
