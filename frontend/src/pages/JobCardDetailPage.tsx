import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsAPI, JobCard, JobService } from '../api/jobs';
import { inventoryAPI, InventoryItem } from '../api/inventory';
import toast from 'react-hot-toast';
import { getBackendURL } from '../utils/helpers';
import { useAuthStore } from '../stores/authStore';
import JobCardMediaSection from '../components/ui/JobCardMediaSection';


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
  estimate: ['delivered', 'cancelled', 'ready'],
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
  const staff = useAuthStore((s) => s.staff);
  const [statusNotes, setStatusNotes] = useState('');
  const [showAddService, setShowAddService] = useState(false);
  const [newSvc, setNewSvc] = useState<{
    service_name: string;
    service_type: 'other' | 'ppf' | 'ceramic' | 'polish' | 'detailing';
    package_tier: 'basic' | 'premium' | 'elite';
    unit_price: number | '';
    quantity: number | '';
    sqft_used: number | '';
    ml_used: number | '';
    description: string;
    item_type: 'labor' | 'part';
    tax_pct: number | '';
    inventory_item_id: number | null;
  }>({
    service_name: '',
    service_type: 'other',
    package_tier: 'premium',
    unit_price: '',
    quantity: 1,
    sqft_used: '',
    ml_used: '',
    description: '',
    item_type: 'labor',
    tax_pct: 18,
    inventory_item_id: null
  });
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null);
  const [editSvcForm, setEditSvcForm] = useState<{
    service_name: string;
    service_type: 'other' | 'ppf' | 'ceramic' | 'polish' | 'detailing';
    package_tier: 'basic' | 'premium' | 'elite';
    unit_price: number | '';
    quantity: number | '';
    sqft_used: number | '';
    ml_used: number | '';
    description: string;
    item_type: 'labor' | 'part';
    tax_pct: number | '';
    inventory_item_id: number | null;
  }>({
    service_name: '',
    service_type: 'other',
    package_tier: 'premium',
    unit_price: '',
    quantity: 1,
    sqft_used: '',
    ml_used: '',
    description: '',
    item_type: 'labor',
    tax_pct: 18,
    inventory_item_id: null
  });

  // Fetch active inventory items
  const { data: inventoryRes } = useQuery({
    queryKey: ['active-inventory'],
    queryFn: () => inventoryAPI.list({ limit: 100 }),
  });
  const inventoryItems = inventoryRes?.data || [];

  const startEditing = (svc: JobService) => {
    setEditingServiceId(svc.id);
    setEditSvcForm({
      service_name: svc.service_name,
      service_type: svc.service_type || 'other',
      package_tier: svc.package_tier || 'premium',
      unit_price: svc.unit_price,
      quantity: svc.quantity || 1,
      sqft_used: svc.sqft_used || '',
      ml_used: svc.ml_used || '',
      description: svc.description || '',
      item_type: (svc.item_type as any) || 'labor',
      tax_pct: svc.tax_pct !== undefined ? svc.tax_pct : 18,
      inventory_item_id: svc.inventory_item_id || null
    });
  };

  const [showDeliveredConfirm, setShowDeliveredConfirm] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ new_status: string; notes?: string } | null>(null);

  const handleStatusTransition = (nextStatus: string) => {
    if (nextStatus === 'delivered') {
      setPendingStatusChange({ new_status: nextStatus, notes: statusNotes || undefined });
      setShowDeliveredConfirm(true);
    } else {
      statusMutation.mutate({ new_status: nextStatus, notes: statusNotes || undefined });
    }
  };

  const [svcSearch, setSvcSearch] = useState('');
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeForm, setCompleteForm] = useState({ completion_type: 'invoice' as 'invoice' | 'estimate', gst_applicable: true, payment_mode: 'cash', notes: '', gst_pct: 18 as number | '' });
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  const handleDownloadInvoice = async () => {
    if (!id) return;
    try {
      setDownloadingInvoice(true);
      const res = await jobsAPI.getInvoicePdf(Number(id));
      if (res.data?.pdf_url) {
        window.open(getBackendURL(res.data.pdf_url), '_blank');
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
    mutationFn: (svc: Partial<JobService>) => jobsAPI.addService(Number(id), {
      ...svc,
      unit_price: Number(svc.unit_price) || 0
    }),
    onSuccess: () => {
      toast.success('Service added.');
      setShowAddService(false);
      setNewSvc({
        service_name: '',
        service_type: 'other' as 'other' | 'ppf' | 'ceramic' | 'polish' | 'detailing',
        package_tier: 'premium' as 'basic' | 'premium' | 'elite',
        unit_price: '',
        quantity: 1,
        sqft_used: 0,
        ml_used: 0,
        description: '',
        item_type: 'labor' as 'labor' | 'part',
        tax_pct: 18,
        inventory_item_id: null
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

  const updateServiceMutation = useMutation({
    mutationFn: ({ serviceId, payload }: { serviceId: number; payload: Partial<JobService> }) =>
      jobsAPI.updateService(Number(id), serviceId, {
        ...payload,
        unit_price: Number(payload.unit_price) || 0
      }),
    onSuccess: () => {
      toast.success('Service updated.');
      setEditingServiceId(null);
      queryClient.invalidateQueries({ queryKey: ['job-detail', id] });
    },
    onError: () => toast.error('Failed to update service.'),
  });

  const completeMutation = useMutation({
    mutationFn: () => jobsAPI.completeJob(Number(id), completeForm),
    onSuccess: async (res) => {
      toast.success(res.data?.message || 'Job completed!');
      setShowCompleteModal(false);
      queryClient.invalidateQueries({ queryKey: ['job-detail', id] });
      if (id) {
        try {
          const pdfRes = await jobsAPI.getInvoicePdf(Number(id));
          if (pdfRes.data?.pdf_url) {
            window.open(getBackendURL(pdfRes.data.pdf_url), '_blank');
          }
        } catch (pdfErr) {
          console.error('Auto open PDF error:', pdfErr);
        }
      }
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to complete job.'),
  });

  const dispatchMutation = useMutation({
    mutationFn: () => jobsAPI.dispatch(Number(id), 'whatsapp'),
    onSuccess: () => toast.success('Dispatched via WhatsApp!'),
    onError: () => toast.error('Failed to dispatch.'),
  });

  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  const { data: invoiceDataRes } = useQuery({
    queryKey: ['job-invoice-data', id],
    queryFn: () => jobsAPI.getInvoiceData(Number(id)),
    enabled: !!id,
  });
  const invoiceData = invoiceDataRes?.data;

  const getWhatsAppNumber = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    return clean.length === 10 ? `91${clean}` : clean;
  };

  const sendWhatsAppMessage = (message: string) => {
    if (!job) return;
    const phone = getWhatsAppNumber(job.customer_phone || '');
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const shareJobCardLink = async () => {
    if (!job) return;
    const vehicleStr = `${job.vehicle_name || ''}`.trim() || 'your vehicle';
    let jobCardPdfUrl = '';
    try {
      const res = await jobsAPI.getJobCardPdf(Number(id));
      if (res.data?.pdf_url) {
        jobCardPdfUrl = getBackendURL(res.data.pdf_url);
      }
    } catch (err) {
      console.error(err);
    }
    if (!jobCardPdfUrl) {
      toast.error('Failed to generate Job Card PDF.');
      return;
    }
    const msg = `🙏 Greetings from *God of Ceramic Studio*!\n\nDear *${job.customer_name}*,\n\nThis is your Job Card for *${vehicleStr}* (${job.reg_number || ''}).\n\n📋 *Job Code:* ${job.job_code}\n📄 *Download Job Card PDF:*\n${jobCardPdfUrl}\n\nFor any queries, feel free to contact us.\nThank you for choosing God of Ceramic! 🚗✨`;
    sendWhatsAppMessage(msg);
  };

  const shareEstimateLink = async () => {
    if (!job) return;
    const vehicleStr = `${job.vehicle_name || ''}`.trim() || 'your vehicle';
    let estimateUrl = invoiceData?.estimate?.pdf_url ? getBackendURL(invoiceData.estimate.pdf_url) : '';
    if (!estimateUrl) {
      // Try to generate the PDF on the fly
      try {
        const pdfRes = await jobsAPI.getInvoicePdf(Number(id));
        if (pdfRes.data?.pdf_url) {
          estimateUrl = getBackendURL(pdfRes.data.pdf_url);
        }
      } catch {}
    }
    if (!estimateUrl) {
      toast.error('Please generate an estimate first by completing the job.');
      return;
    }
    const msg = `🙏 Greetings from *God of Ceramic Studio*!\n\nDear *${job.customer_name}*,\n\nPlease find the detailing estimate for your vehicle *${vehicleStr}* (${job.reg_number || ''}).\n\n📄 *Download Estimate PDF:*\n${estimateUrl}\n\nKindly review and let us know if you'd like to proceed.\nThank you! 🚗✨`;
    sendWhatsAppMessage(msg);
  };

  const shareInvoiceLink = async () => {
    if (!job) return;
    const vehicleStr = `${job.vehicle_name || ''}`.trim() || 'your vehicle';
    let invoiceUrl = invoiceData?.invoice?.pdf_url ? getBackendURL(invoiceData.invoice.pdf_url) : '';
    if (!invoiceUrl) {
      try {
        const pdfRes = await jobsAPI.getInvoicePdf(Number(id));
        if (pdfRes.data?.pdf_url) {
          invoiceUrl = getBackendURL(pdfRes.data.pdf_url);
        }
      } catch {}
    }
    if (!invoiceUrl) {
      toast.error('Please complete the job and generate a tax invoice first.');
      return;
    }
    const msg = `🙏 Greetings from *God of Ceramic Studio*!\n\nDear *${job.customer_name}*,\n\nThank you for choosing God of Ceramic for your vehicle *${vehicleStr}* (${job.reg_number || ''}).\n\n🧾 *Download Tax Invoice PDF:*\n${invoiceUrl}\n\nWe appreciate your trust in us. See you again! 🚗✨`;
    sendWhatsAppMessage(msg);
  };

  const openWhatsApp = () => {
    setShowWhatsAppModal(true);
  };

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
          <button onClick={openWhatsApp} className="px-4 py-2 rounded-lg border border-green-500/20 text-green-400 hover:bg-green-500/10 font-label-caps text-xs tracking-widest transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">send</span> WhatsApp
          </button>
          {!['delivered', 'cancelled'].includes(job.status) && staff?.role === 'admin' && (
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
              {(() => {
                let nextStatus: string | null = null;
                if (currentIdx !== -1 && currentIdx < STATUS_PIPELINE.length - 1) {
                  nextStatus = STATUS_PIPELINE[currentIdx + 1];
                } else if (currentIdx === -1) {
                  nextStatus = allowedNext.find(s => (STATUS_PIPELINE as readonly string[]).includes(s)) || (allowedNext.length > 0 ? allowedNext[0] : null);
                }
                const nCfg = nextStatus ? STATUS_CONFIG[nextStatus] : null;
                const canGoBack = job.status === 'estimate' && allowedNext.includes('ready');

                return (
                  <div className="flex items-center gap-2">
                    {nextStatus && nCfg && allowedNext.includes(nextStatus) && (
                      <button
                        onClick={() => handleStatusTransition(nextStatus!)}
                        disabled={statusMutation.isPending}
                        className={`px-4 py-2 rounded-lg border ${nCfg.border} ${nCfg.color} hover:${nCfg.bg} font-label-caps text-xs tracking-widest transition-all flex items-center gap-2 disabled:opacity-50`}
                      >
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                        Next: {nCfg.label}
                      </button>
                    )}
                    {canGoBack && (
                      <button
                        onClick={() => handleStatusTransition('ready')}
                        disabled={statusMutation.isPending}
                        className="px-4 py-2 rounded-lg border border-orange-500/20 text-orange-400 hover:bg-orange-500/10 font-label-caps text-xs tracking-widest transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                        Back to Ready
                      </button>
                    )}
                  </div>
                );
              })()}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="relative">
                    <label className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest block mb-1">Catalog Search</label>
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
                  <div>
                    <label className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest block mb-1">Link Inventory Product</label>
                    <select
                      value={newSvc.inventory_item_id || ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (!val) {
                          setNewSvc(p => ({ ...p, inventory_item_id: null }));
                        } else {
                          const item = inventoryItems.find(i => i.id === Number(val));
                          if (item) {
                            setNewSvc(p => ({
                              ...p,
                              inventory_item_id: item.id,
                              service_name: item.name,
                              unit_price: item.selling_price || item.purchase_price || 0,
                              item_type: 'part',
                              service_type: item.category === 'ppf_roll' ? 'ppf' : item.category === 'ceramic' ? 'ceramic' : 'other',
                              sqft_used: item.category === 'ppf_roll' ? 50 : 0
                            }));
                          }
                        }
                      }}
                      className="w-full bg-black border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
                    >
                      <option value="">-- No linked product --</option>
                      {inventoryItems.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.category.replace('_', ' ')} • Stock: {item.current_stock})
                        </option>
                      ))}
                    </select>
                  </div>
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
                      value={newSvc.unit_price}
                      onChange={e => setNewSvc(p => ({ ...p, unit_price: e.target.value === '' ? '' : Number(e.target.value) }))}
                      placeholder="Price"
                      className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
                    />
                  </div>
                  <div>
                    <label className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest block mb-1">GST (%)</label>
                    <input
                      type="number"
                      value={newSvc.tax_pct}
                      onChange={e => setNewSvc(p => ({ ...p, tax_pct: e.target.value === '' ? '' : Number(e.target.value) }))}
                      placeholder="18"
                      className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
                    />
                  </div>
                  <div>
                    <label className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest block mb-1">Qty</label>
                    <input
                      type="number"
                      value={newSvc.quantity}
                      min={1}
                      onChange={e => setNewSvc(p => ({ ...p, quantity: e.target.value === '' ? '' : Number(e.target.value) }))}
                      placeholder="Qty"
                      className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
                    />
                  </div>
                </div>

                {/* Conditionally show manual PPF square feet entry */}
                {(newSvc.service_type === 'ppf' || newSvc.service_name.toLowerCase().includes('ppf') || inventoryItems.find(i => i.id === newSvc.inventory_item_id)?.category === 'ppf_roll') && (
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    <div className="col-span-3">
                      <label className="font-label-caps text-[9px] text-orange-400 tracking-widest block mb-1">Manual PPF Sq feet to Deduct *</label>
                      <input
                        type="number"
                        value={newSvc.sqft_used}
                        onChange={e => setNewSvc(p => ({ ...p, sqft_used: e.target.value === '' ? '' : Number(e.target.value) }))}
                        placeholder="Enter square feet (e.g. 25)"
                        className="w-full bg-white/[0.03] border border-orange-500/30 rounded-lg px-3 py-2 text-sm text-orange-400 outline-none focus:border-orange-500/50 font-bold"
                      />
                      <p className="text-[9px] text-on-surface-variant/40 mt-1">This square feet amount will deduct from the matched PPF roll automatically on completion/delivery (+5% wastage).</p>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowAddService(false)} className="px-3 py-1.5 text-xs text-on-surface-variant/50 hover:text-white transition-colors font-label-caps">Cancel</button>
                  <button
                    onClick={() => addServiceMutation.mutate(newSvc as any)}
                    disabled={!newSvc.service_name || newSvc.unit_price === '' || Number(newSvc.unit_price) <= 0 || addServiceMutation.isPending}
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
                  editingServiceId === svc.id ? (
                    <div key={svc.id} className="p-4 bg-white/[0.03] border border-performance-red/30 rounded-xl space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest block mb-1">Link Inventory Product</label>
                          <select
                            value={editSvcForm.inventory_item_id || ''}
                            onChange={e => {
                              const val = e.target.value;
                              if (!val) {
                                setEditSvcForm(p => ({ ...p, inventory_item_id: null }));
                              } else {
                                const item = inventoryItems.find(i => i.id === Number(val));
                                if (item) {
                                  setEditSvcForm(p => ({
                                    ...p,
                                    inventory_item_id: item.id,
                                    service_name: item.name,
                                    unit_price: item.selling_price || item.purchase_price || '',
                                    item_type: 'part',
                                    service_type: item.category === 'ppf_roll' ? 'ppf' : item.category === 'ceramic' ? 'ceramic' : 'other',
                                    sqft_used: item.category === 'ppf_roll' ? 50 : ''
                                  }));
                                }
                              }
                            }}
                            className="w-full bg-black border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
                          >
                            <option value="">-- No linked product --</option>
                            {inventoryItems.map(item => (
                              <option key={item.id} value={item.id}>
                                {item.name} ({item.category.replace('_', ' ')} • Stock: {item.current_stock})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                        <div className="md:col-span-2">
                          <label className="font-label-caps text-[9px] text-on-surface-variant/40 block mb-1">Service Name</label>
                          <input
                            value={editSvcForm.service_name}
                            onChange={e => setEditSvcForm(p => ({ ...p, service_name: e.target.value }))}
                            className="w-full bg-black border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-performance-red/40"
                          />
                        </div>
                        <div>
                          <label className="font-label-caps text-[9px] text-on-surface-variant/40 block mb-1">Type</label>
                          <select
                            value={editSvcForm.item_type}
                            onChange={e => setEditSvcForm(p => ({ ...p, item_type: e.target.value as 'labor' | 'part' }))}
                            className="w-full bg-black border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-performance-red/40"
                          >
                            <option value="labor">Labor</option>
                            <option value="part">Part</option>
                          </select>
                        </div>
                        <div>
                          <label className="font-label-caps text-[9px] text-on-surface-variant/40 block mb-1">Price</label>
                          <input
                            type="number"
                            value={editSvcForm.unit_price}
                            onChange={e => setEditSvcForm(p => ({ ...p, unit_price: e.target.value === '' ? '' : Number(e.target.value) }))}
                            className="w-full bg-black border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-performance-red/40"
                          />
                        </div>
                        <div>
                          <label className="font-label-caps text-[9px] text-on-surface-variant/40 block mb-1">GST (%)</label>
                          <input
                            type="number"
                            value={editSvcForm.tax_pct}
                            onChange={e => setEditSvcForm(p => ({ ...p, tax_pct: e.target.value === '' ? '' : Number(e.target.value) }))}
                            className="w-full bg-black border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-performance-red/40"
                          />
                        </div>
                        <div>
                          <label className="font-label-caps text-[9px] text-on-surface-variant/40 block mb-1">Qty</label>
                          <input
                            type="number"
                            value={editSvcForm.quantity}
                            min={1}
                            onChange={e => setEditSvcForm(p => ({ ...p, quantity: e.target.value === '' ? '' : Number(e.target.value) }))}
                            className="w-full bg-black border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-performance-red/40"
                          />
                        </div>
                      </div>

                      {/* Conditionally show manual PPF square feet entry for editing */}
                      {(editSvcForm.service_type === 'ppf' || editSvcForm.service_name.toLowerCase().includes('ppf') || inventoryItems.find(i => i.id === editSvcForm.inventory_item_id)?.category === 'ppf_roll') && (
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                          <div className="col-span-3">
                            <label className="font-label-caps text-[9px] text-orange-400 tracking-widest block mb-1">Manual PPF Sq feet to Deduct *</label>
                            <input
                              type="number"
                              value={editSvcForm.sqft_used}
                              onChange={e => setEditSvcForm(p => ({ ...p, sqft_used: e.target.value === '' ? '' : Number(e.target.value) }))}
                              placeholder="Enter square feet (e.g. 25)"
                              className="w-full bg-black border border-orange-500/30 rounded-lg px-3 py-2 text-sm text-orange-400 outline-none focus:border-orange-500/50 font-bold"
                            />
                            <p className="text-[9px] text-on-surface-variant/40 mt-1">This square feet amount will deduct from the matched PPF roll automatically on completion/delivery (+5% wastage).</p>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingServiceId(null)} className="px-3 py-1 text-xs text-on-surface-variant/50 hover:text-white transition-colors font-label-caps">Cancel</button>
                        <button
                          onClick={() => updateServiceMutation.mutate({ serviceId: svc.id, payload: editSvcForm as any })}
                          disabled={!editSvcForm.service_name || editSvcForm.unit_price === '' || Number(editSvcForm.unit_price) < 0 || updateServiceMutation.isPending}
                          className="performance-gradient text-white font-label-caps text-[10px] px-3 py-1.5 rounded-lg border border-white/10 disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={svc.id} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl group">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-white font-bold">{svc.service_name}</p>
                          {svc.inventory_item_id && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[8px] font-label-caps uppercase tracking-wider font-bold">
                              <span className="material-symbols-outlined text-[10px]">inventory_2</span>
                              Linked Stock
                            </span>
                          )}
                          {svc.sqft_used > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[8px] font-label-caps uppercase tracking-wider font-bold">
                              <span className="material-symbols-outlined text-[10px]">square_foot</span>
                              {svc.sqft_used} Sq feet
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-on-surface-variant/50 mt-0.5">
                          {svc.item_type?.toUpperCase() || 'LABOR'} • GST: {svc.tax_pct !== undefined ? svc.tax_pct : 18}% • Qty: {svc.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-data-sm text-white font-bold">₹{Number(svc.line_total).toLocaleString('en-IN')}</p>
                        {!['delivered', 'cancelled'].includes(job.status) && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startEditing(svc)}
                              className="p-1 rounded hover:bg-white/5 text-on-surface-variant/30 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                            </button>
                            <button
                              onClick={() => { if (window.confirm('Remove this service?')) deleteServiceMutation.mutate(svc.id); }}
                              className="p-1 rounded hover:bg-red-500/10 text-on-surface-variant/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
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

          {/* Job Card Photos & Videos */}
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="font-label-caps text-[10px] text-on-surface-variant/50 tracking-widest mb-4">JOB CARD MEDIA</h2>
            <JobCardMediaSection jobCardId={Number(id)} jobType={job.job_type === 'quick' ? 'quick' : 'regular'} />
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

          {/* Owner Image */}
          <div className="glass-panel rounded-2xl p-6 space-y-3">
            <h2 className="font-label-caps text-[10px] text-on-surface-variant/50 tracking-widest">OWNER IDENTIFICATION</h2>
            {job.owner_image_url ? (
              <div className="space-y-2">
                <div className="w-full h-48 rounded-xl overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center">
                  <img
                    src={getBackendURL(job.owner_image_url)}
                    alt="Owner avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-on-surface-variant/50 font-label-caps">Owner Image Saved</span>
                  <label className="text-xs text-performance-red hover:underline font-label-caps cursor-pointer">
                    Change Image
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const res = await jobsAPI.uploadOwnerImage(Number(id), file);
                          if (res.success) {
                            toast.success('Owner image updated successfully!');
                            queryClient.invalidateQueries({ queryKey: ['job-detail', id] });
                          }
                        } catch (err: any) {
                          toast.error(err.response?.data?.error?.message || 'Failed to update owner image');
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-full h-24 rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center text-on-surface-variant/40 hover:bg-white/[0.02] transition-all">
                  <span className="material-symbols-outlined text-[24px]">account_box</span>
                  <span className="text-[10px] font-label-caps mt-1">No owner image added</span>
                </div>
                <label className="block text-center py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold font-label-caps uppercase tracking-wider cursor-pointer transition-all">
                  Upload Owner Image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const res = await jobsAPI.uploadOwnerImage(Number(id), file);
                        if (res.success) {
                          toast.success('Owner image uploaded successfully!');
                          queryClient.invalidateQueries({ queryKey: ['job-detail', id] });
                        }
                      } catch (err: any) {
                        toast.error(err.response?.data?.error?.message || 'Failed to upload owner image');
                      }
                    }}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Certificate */}
          <div className="glass-panel rounded-2xl p-6 space-y-3">
            <h2 className="font-label-caps text-[10px] text-on-surface-variant/50 tracking-widest">CERTIFICATE</h2>
            {job.certificate_url ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  Certificate Uploaded
                </div>
                <a
                  href={getBackendURL(job.certificate_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs text-performance-red hover:underline font-label-caps"
                >
                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  View Certificate
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-400 text-sm">
                  <span className="material-symbols-outlined text-[16px]">warning</span>
                  No certificate uploaded
                </div>
                <p className="text-[10px] text-on-surface-variant/50">Required before final delivery</p>
              </div>
            )}
            {!['delivered', 'cancelled'].includes(job.status) && (
              <label className="block cursor-pointer">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const res = await jobsAPI.uploadCertificate(Number(id), file);
                      if (res.success) {
                        toast.success('Certificate uploaded!');
                        queryClient.invalidateQueries({ queryKey: ['job-detail', id] });
                      }
                    } catch (err: any) {
                      toast.error(err.response?.data?.error?.message || 'Failed to upload certificate');
                    }
                  }}
                />
                <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-on-surface-variant/60 hover:text-white font-label-caps text-[10px] tracking-widest transition-all cursor-pointer">
                  <span className="material-symbols-outlined text-[14px]">upload</span>
                  {job.certificate_url ? 'Replace Certificate' : 'Upload Certificate'}
                </span>
              </label>
            )}
          </div>

          {/* Financial */}
          <div className="glass-panel rounded-2xl p-6 space-y-3">
            <h2 className="font-label-caps text-[10px] text-on-surface-variant/50 tracking-widest">FINANCIAL</h2>
            {Number((job as any).card_charges) > 0 && (
              <>
                <div className="flex justify-between text-xs text-on-surface-variant/70">
                  <span>Base Amount</span>
                  <span>₹{(Number(job.total_amount) - Number((job as any).card_charges)).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-xs text-on-surface-variant/70">
                  <span>Card Charges (2.5%)</span>
                  <span>₹{Number((job as any).card_charges).toLocaleString('en-IN')}</span>
                </div>
              </>
            )}
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
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 sm:p-8 w-[95vw] sm:max-w-md space-y-6 mx-auto">
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
            {completeForm.completion_type === 'invoice' && (
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={completeForm.gst_applicable}
                    onChange={e => setCompleteForm(p => ({ ...p, gst_applicable: e.target.checked }))}
                    className="w-4 h-4 accent-performance-red"
                  />
                  <span className="text-sm text-white">Apply GST</span>
                </label>

                {completeForm.gst_applicable && (
                  <div>
                    <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">GST Rate Percentage (%)</label>
                    <input
                      type="number"
                      value={completeForm.gst_pct}
                      onChange={e => setCompleteForm(p => ({ ...p, gst_pct: e.target.value === '' ? '' : Number(e.target.value) }))}
                      className="w-full bg-black border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
                    />
                  </div>
                )}
              </div>
            )}
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

      {/* ── Delivered Confirmation Modal ── */}
      {showDeliveredConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 sm:p-8 w-[95vw] sm:max-w-sm space-y-6 mx-auto">
            <div className="text-center space-y-3">
              <span className="material-symbols-outlined text-4xl text-amber-400">warning</span>
              <h2 className="font-display-hero text-lg text-on-surface">Confirm Final Delivery</h2>
              <p className="text-sm text-on-surface-variant/70">
                You will not be able to edit or make changes to services after setting the status to Final Delivered. Do you want to proceed?
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setShowDeliveredConfirm(false);
                  setPendingStatusChange(null);
                }}
                className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-label-caps rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (pendingStatusChange) {
                    statusMutation.mutate(pendingStatusChange);
                  }
                  setShowDeliveredConfirm(false);
                  setPendingStatusChange(null);
                }}
                className="performance-gradient text-white font-label-caps text-xs px-5 py-2.5 rounded-lg border border-white/10"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── WhatsApp Sharing Options Modal ── */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl relative space-y-4 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-display-hero text-lg font-black text-white tracking-tight italic uppercase">
                  Share Details via WhatsApp
                </h3>
                <p className="text-[10px] text-tertiary/50 font-label-caps tracking-widest uppercase">
                  Direct client-side redirection
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowWhatsAppModal(false)}
                className="text-tertiary hover:text-white p-1 hover:bg-white/5 rounded-lg transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={() => {
                  shareJobCardLink();
                  setShowWhatsAppModal(false);
                }}
                className="w-full text-left p-4 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.06] hover:border-performance-red/30 transition-all flex items-center gap-3 group"
              >
                <span className="material-symbols-outlined text-[24px] text-cyan-400 group-hover:scale-110 transition-transform">description</span>
                <div className="flex-1">
                  <p className="text-xs font-bold text-white uppercase tracking-wider">Send Job Card</p>
                  <p className="text-[10px] text-tertiary/60 mt-0.5">Opens WhatsApp with job card details and view link.</p>
                </div>
              </button>

              <button
                onClick={() => {
                  shareEstimateLink();
                  setShowWhatsAppModal(false);
                }}
                className="w-full text-left p-4 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.06] hover:border-performance-red/30 transition-all flex items-center gap-3 group"
              >
                <span className="material-symbols-outlined text-[24px] text-amber-400 group-hover:scale-110 transition-transform">receipt_long</span>
                <div className="flex-1">
                  <p className="text-xs font-bold text-white uppercase tracking-wider">Send Estimate</p>
                  <p className="text-[10px] text-tertiary/60 mt-0.5">Opens WhatsApp with estimate PDF download link.</p>
                </div>
              </button>

              <button
                onClick={() => {
                  shareInvoiceLink();
                  setShowWhatsAppModal(false);
                }}
                className="w-full text-left p-4 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.06] hover:border-performance-red/30 transition-all flex items-center gap-3 group"
              >
                <span className="material-symbols-outlined text-[24px] text-emerald-400 group-hover:scale-110 transition-transform">payments</span>
                <div className="flex-1">
                  <p className="text-xs font-bold text-white uppercase tracking-wider">Send Invoice</p>
                  <p className="text-[10px] text-tertiary/60 mt-0.5">Opens WhatsApp with tax invoice PDF download link.</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
