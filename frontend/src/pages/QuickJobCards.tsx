import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quickJobsAPI, QuickJobCard } from '../api/quickJobs';
import { jobsAPI } from '../api/jobs';
import { customersAPI } from '../api/customers';
import toast from 'react-hot-toast';
import JobCardMediaSection from '../components/ui/JobCardMediaSection';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  scheduled: { label: 'Scheduled', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', dot: 'bg-blue-400' },
  car_in: { label: 'Car In', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', dot: 'bg-cyan-400' },
  washing: { label: 'Washing', color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20', dot: 'bg-sky-400 animate-pulse' },
  in_progress: { label: 'In Progress', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', dot: 'bg-amber-400 animate-pulse' },
  qc: { label: 'QC Check', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', dot: 'bg-purple-400' },
  rework: { label: 'Rework', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', dot: 'bg-orange-400 animate-pulse' },
  ready: { label: 'Ready', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', dot: 'bg-green-400' },
  delivered: { label: 'Delivered', color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20', dot: 'bg-gray-500' },
  cancelled: { label: 'Cancelled', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', dot: 'bg-red-500' },
  invoiced: { label: 'Invoiced', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', dot: 'bg-green-400' },
};

const ALL_STATUSES = ['scheduled', 'car_in', 'washing', 'in_progress', 'qc', 'rework', 'ready', 'delivered', 'cancelled', 'invoiced'];

export default function QuickJobCards() {
  const queryClient = useQueryClient();

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Selection & Modal States
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);

  // Lookup state
  const [lookupQuery, setLookupQuery] = useState('');
  const { data: lookupRes } = useQuery({
    queryKey: ['customer-lookup-quick', lookupQuery],
    queryFn: () => customersAPI.search(lookupQuery),
    enabled: lookupQuery.length >= 2,
  });
  const lookupResults = lookupRes?.data || [];

  // Quick Service Create Form State
  const [createForm, setCreateForm] = useState({
    reg_no: '',
    owner_name: '',
    mobile: '',
    car_name: '',
    car_make: '',
    car_model: '',
    fuel_type: 'petrol',
    insurance_company: '',
    insurance_expiry: '',
    km_reading: '',
    notes: '',
  });

  const [wizardConcerns, setWizardConcerns] = useState<string[]>([]);
  const [wizardCustomConcern, setWizardCustomConcern] = useState('');
  const [wizardServices, setWizardServices] = useState<{ service_name: string; qty: number; rate: number }[]>([]);

  // Inline Ledger Add Forms
  const [showAddSvc, setShowAddSvc] = useState(false);
  const [inlineSvc, setInlineSvc] = useState({ service_name: '', rate: 0, qty: 1 });
  const [showAddConcern, setShowAddConcern] = useState(false);
  const [inlineConcern, setInlineConcern] = useState('');

  // Complete Billing Form State
  const [billingForm, setBillingForm] = useState({
    completion_type: 'invoice' as 'invoice' | 'estimate',
    payment_mode: 'cash',
    gst_pct: 18,
  });

  // Queries
  const { data: jobsRes, isLoading } = useQuery({
    queryKey: ['quickJobs', search, statusFilter, dateFrom, dateTo],
    queryFn: () =>
      quickJobsAPI.list({
        search: search || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        from: dateFrom || undefined,
        to: dateTo || undefined,
      }),
  });
  const jobs = jobsRes?.data || [];

  const { data: detailRes, isLoading: isDetailLoading } = useQuery({
    queryKey: ['quickJobDetail', selectedJobId],
    queryFn: () => quickJobsAPI.getById(selectedJobId!),
    enabled: selectedJobId !== null,
  });
  const detail = detailRes?.data;

  const { data: presetsRes } = useQuery({
    queryKey: ['concernPresetsQuick'],
    queryFn: () => jobsAPI.concernPresets(),
  });
  const presets = presetsRes?.data || [];

  const { data: quickSvcsRes } = useQuery({
    queryKey: ['quickServicesCatalog'],
    queryFn: () => quickJobsAPI.listServices(),
  });
  const catalogServices = quickSvcsRes?.data || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: any) => quickJobsAPI.create(payload),
    onSuccess: (res) => {
      toast.success('Quick Job Card created successfully!');
      queryClient.invalidateQueries({ queryKey: ['quickJobs'] });
      setSelectedJobId(res.data.id);
      setShowCreateModal(false);
      resetWizard();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to create Quick Job Card');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => quickJobsAPI.updateStatus(id, status),
    onSuccess: () => {
      toast.success('Status updated. SMS notification dispatched.');
      queryClient.invalidateQueries({ queryKey: ['quickJobs'] });
      queryClient.invalidateQueries({ queryKey: ['quickJobDetail', selectedJobId] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to transition status');
    },
  });

  const addServiceMutation = useMutation({
    mutationFn: ({ jobId, service }: { jobId: number; service: any }) => quickJobsAPI.addService(jobId, service),
    onSuccess: () => {
      toast.success('Service logged.');
      queryClient.invalidateQueries({ queryKey: ['quickJobDetail', selectedJobId] });
      queryClient.invalidateQueries({ queryKey: ['quickJobs'] });
      setShowAddSvc(false);
      setInlineSvc({ service_name: '', rate: 0, qty: 1 });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to add service');
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: ({ jobId, serviceId }: { jobId: number; serviceId: number }) => quickJobsAPI.deleteService(jobId, serviceId),
    onSuccess: () => {
      toast.success('Service removed.');
      queryClient.invalidateQueries({ queryKey: ['quickJobDetail', selectedJobId] });
      queryClient.invalidateQueries({ queryKey: ['quickJobs'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to remove service');
    },
  });

  const addConcernMutation = useMutation({
    mutationFn: ({ jobId, text }: { jobId: number; text: string }) => quickJobsAPI.addConcern(jobId, text),
    onSuccess: () => {
      toast.success('Concern logged.');
      queryClient.invalidateQueries({ queryKey: ['quickJobDetail', selectedJobId] });
      setShowAddConcern(false);
      setInlineConcern('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to add concern');
    },
  });

  const deleteConcernMutation = useMutation({
    mutationFn: ({ jobId, concernId }: { jobId: number; concernId: number }) => quickJobsAPI.deleteConcern(jobId, concernId),
    onSuccess: () => {
      toast.success('Concern removed.');
      queryClient.invalidateQueries({ queryKey: ['quickJobDetail', selectedJobId] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to remove concern');
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => quickJobsAPI.complete(id, payload),
    onSuccess: (res) => {
      toast.success('Billing finalized.');
      queryClient.invalidateQueries({ queryKey: ['quickJobs'] });
      queryClient.invalidateQueries({ queryKey: ['quickJobDetail', selectedJobId] });
      setShowBillingModal(false);
      window.open(`/invoice/quick/${selectedJobId}`, '_blank');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to finalize billing');
    },
  });

  const trackingSmsMutation = useMutation({
    mutationFn: (id: number) => quickJobsAPI.sendTrackingSms(id),
    onSuccess: () => {
      toast.success('Docket tracking SMS dispatched successfully.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to dispatch tracking link');
    },
  });

  // Wizard Helpers
  const resetWizard = () => {
    setLookupQuery('');
    setCreateForm({
      reg_no: '',
      owner_name: '',
      mobile: '',
      car_name: '',
      car_make: '',
      car_model: '',
      fuel_type: 'petrol',
      insurance_company: '',
      insurance_expiry: '',
      km_reading: '',
      notes: '',
    });
    setWizardConcerns([]);
    setWizardCustomConcern('');
    setWizardServices([]);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.reg_no || !createForm.owner_name || !createForm.mobile) {
      toast.error('License Plate, Client Name, and Contact Mobile are required.');
      return;
    }
    const payload = {
      ...createForm,
      km_reading: createForm.km_reading ? Number(createForm.km_reading) : null,
      concerns: wizardConcerns,
      services: wizardServices,
    };
    createMutation.mutate(payload);
  };

  const handleCompleteBilling = () => {
    if (!selectedJobId) return;
    completeMutation.mutate({ id: selectedJobId, payload: billingForm });
  };

  return (
    <div className="space-y-6 relative flex flex-col h-[calc(100vh-8rem)]">
      {/* ── Page Header ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h2 className="font-display-hero text-headline-lg text-white mb-1 tracking-tight italic">
            QUICK SERVICE <span className="text-performance-red not-italic font-light">BAY</span>
          </h2>
          <p className="font-label-caps text-label-caps text-on-surface-variant/80 tracking-widest uppercase">
            Walk-in ticket manager — God of Ceramic Premium Auto Studio
          </p>
        </div>
        <button
          onClick={() => {
            resetWizard();
            setShowCreateModal(true);
          }}
          className="performance-gradient text-white px-5 py-3 rounded-xl font-label-caps text-[10px] flex items-center gap-1.5 transition-all group tracking-widest border border-white/10 uppercase"
        >
          <span className="material-symbols-outlined text-[18px]">bolt</span>
          New Quick Job
        </button>
      </div>

      {/* ── Filter Bar ────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 items-center bg-[#111111]/40 border border-white/5 rounded-2xl p-4 shrink-0">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search by job no, customer, license plate..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-performance-red/40"
          />
        </div>
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white/[0.03] border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-performance-red/40 font-label-caps bg-black"
          >
            <option value="all" className="bg-[#0c0c0e]">All Statuses</option>
            {ALL_STATUSES.map(st => (
              <option key={st} value={st} className="bg-[#0c0c0e]">
                {st.replace('_', ' ').toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-white/[0.03] border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-performance-red/40"
          />
          <span className="text-gray-600 text-xs">-</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-white/[0.03] border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-performance-red/40"
          />
        </div>
        {(search || statusFilter !== 'all' || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
              setDateFrom('');
              setDateTo('');
            }}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* ── Main Layout ───────────────────────────────────── */}
      <div className="flex-grow min-h-0 flex gap-6 items-start">
        {/* Left Column: List Ledger */}
        <section className="w-1/3 min-w-[320px] max-w-[400px] flex flex-col glass-panel rounded-2xl h-full max-h-full overflow-hidden shrink-0 shadow-2xl">
          <div className="p-5 border-b border-carbon-border/50 flex justify-between items-center bg-white/[0.01] shrink-0">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-performance-red animate-pulse shadow-[0_0_8px_#FF2B2B]"></span>
              <h2 className="font-label-caps text-label-caps text-white tracking-widest">QUICK LEDGER</h2>
            </div>
            <span className="font-data-sm text-[10px] text-performance-red bg-performance-red/10 border border-performance-red/20 px-3 py-1 rounded-full font-bold">
              {jobs.length} DOCKETS
            </span>
          </div>

          <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-3 custom-scrollbar select-none">
            {isLoading ? (
              <p className="text-center text-xs text-on-surface-variant/40 italic py-10">RETRIEVING FEED...</p>
            ) : jobs.length === 0 ? (
              <p className="text-center text-xs text-on-surface-variant/40 italic py-10">NO QUICK TICKETS LOGGED</p>
            ) : (
              jobs.map((job) => {
                const isSelected = selectedJobId === job.id;
                const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.scheduled;
                const billTotal = job.invoice_total || job.estimate_total || 0;
                return (
                  <div
                    key={job.id}
                    onClick={() => setSelectedJobId(job.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col gap-2 relative overflow-hidden ${
                      isSelected
                        ? 'border-performance-red/40 bg-performance-red/[0.03] shadow-[inset_0_0_20px_rgba(255,43,43,0.05)]'
                        : 'border-white/[0.06] bg-white/[0.01] hover:border-performance-red/20 hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-performance-red opacity-40"></div>
                    <div className="flex justify-between items-start mb-0.5">
                      <span className="font-data-sm text-[10px] text-white/50 font-medium tracking-wider">
                        {job.job_no}
                      </span>
                      <span className={`font-label-caps text-[7.5px] px-1.5 py-0.5 rounded border uppercase tracking-wider ${cfg.bg} ${cfg.border} ${cfg.color} flex items-center gap-1 font-bold`}>
                        <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <h3 className="font-display-hero text-sm text-white font-bold truncate max-w-[160px]">
                          {job.car_name || `${job.car_make || ''} ${job.car_model || ''}`.trim() || 'Quick Vehicle'}
                        </h3>
                        <p className="text-[10px] text-gray-500 mt-0.5 font-mono">{job.reg_no}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-600 font-bold uppercase">{job.owner_name}</p>
                        {billTotal > 0 && (
                          <p className="text-green-400 font-bold text-xs mt-0.5">₹{Number(billTotal).toLocaleString('en-IN')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Right Column: Docket details workspace */}
        <section className="flex-grow flex flex-col gap-6 h-full max-h-full overflow-y-auto pr-2 custom-scrollbar">
          {selectedJobId === null ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-on-surface-variant/40 glass-panel rounded-2xl h-full border border-dashed border-white/10 select-none">
              <span className="material-symbols-outlined text-5xl mb-3 opacity-30 text-performance-red">
                bolt
              </span>
              <p className="font-headline-md text-base text-white tracking-wider uppercase font-bold">
                Select a Quick Docket
              </p>
              <p className="text-xs text-on-surface-variant/60 mt-2 max-w-sm">
                Retrieve a quick walkthrough ticket from the ledger to view services, add concerns, record before/after shots, or finalize billing invoices.
              </p>
            </div>
          ) : isDetailLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-on-surface-variant/40 glass-panel rounded-2xl h-full">
              <span className="material-symbols-outlined text-4xl animate-spin mb-3 text-performance-red">sync</span>
              <p className="text-xs font-label-caps tracking-widest uppercase">Retrieving quick docket telemetry...</p>
            </div>
          ) : detail ? (
            <div className="space-y-6">
              {/* Telemetry Header Card */}
              <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] performance-gradient opacity-40"></div>
                <div className="flex justify-between items-start flex-wrap gap-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 flex-wrap">
                      <h1 className="font-display-hero text-xl md:text-2xl text-white font-bold tracking-tight uppercase italic">
                        {detail.jobCard.car_name || `${detail.jobCard.car_make || ''} ${detail.jobCard.car_model || ''}`.trim() || 'Walkin Vehicle'}
                      </h1>
                      <span className="font-label-caps text-[9px] tracking-widest text-green-400 border border-green-500/20 px-3 py-1 rounded-full bg-green-500/5 uppercase font-bold">
                        {detail.jobCard.job_no}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-8 text-xs">
                      <div>
                        <span className="font-label-caps text-[9px] text-gray-500 block mb-1">REGISTRATION</span>
                        <span className="font-mono text-white font-bold">{detail.jobCard.reg_no}</span>
                      </div>
                      <div>
                        <span className="font-label-caps text-[9px] text-gray-500 block mb-1">CLIENT OWNER</span>
                        <span className="text-white font-bold uppercase">{detail.jobCard.owner_name} ({detail.jobCard.mobile})</span>
                      </div>
                      {detail.jobCard.km_reading && (
                        <div>
                          <span className="font-label-caps text-[9px] text-gray-500 block mb-1">KM READING</span>
                          <span className="text-white font-bold">{detail.jobCard.km_reading.toLocaleString()} km</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    {/* Send tracking SMS button */}
                    <button
                      onClick={() => trackingSmsMutation.mutate(detail.jobCard.id)}
                      className="px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-lg text-xs font-label-caps uppercase tracking-wider transition-all flex items-center gap-1.5"
                      title="Send tracking URL to customer mobile"
                    >
                      <span className="material-symbols-outlined text-sm">share</span>
                      Send link
                    </button>

                    {/* Status change Select */}
                    <select
                      value={detail.jobCard.status}
                      onChange={(e) => updateStatusMutation.mutate({ id: detail.jobCard.id, status: e.target.value })}
                      className="bg-white/[0.04] border border-white/[0.07] rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-[#CC0000]/50 bg-black font-label-caps"
                    >
                      {ALL_STATUSES.map(st => (
                        <option key={st} value={st} className="bg-[#0c0c0e] text-xs">
                          {st.replace('_', ' ').toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Ledger ledger grid */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Services Ledger Card */}
                <div className="glass-panel rounded-2xl p-5 border border-white/5 bg-[#0c0c0c]/40 flex flex-col justify-between min-h-[300px]">
                  <div>
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
                      <h3 className="font-label-caps text-xs text-white tracking-wider flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-performance-red">table_rows</span>
                        SERVICES LEDGER
                      </h3>
                      {!showAddSvc && (
                        <button
                          onClick={() => setShowAddSvc(true)}
                          className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] rounded text-white font-label-caps tracking-wider"
                        >
                          + ADD SERVICE
                        </button>
                      )}
                    </div>

                    {showAddSvc && (
                      <div className="bg-[#181818]/60 border border-white/5 rounded-xl p-3.5 mb-4 space-y-3">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider border-b border-white/5 pb-1">LOG QUICK SERVICE ITEM</p>
                        
                        {/* Preset Quick Services Select */}
                        <div>
                          <label className="block text-[8px] text-gray-600 uppercase mb-1">Catalog Preset</label>
                          <select
                            onChange={(e) => {
                              const found = catalogServices.find(s => s.service_name === e.target.value);
                              if (found) {
                                setInlineSvc({ service_name: found.service_name, rate: found.default_rate, qty: 1 });
                              } else {
                                setInlineSvc(prev => ({ ...prev, service_name: e.target.value }));
                              }
                            }}
                            className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg py-1.5 px-2 text-xs text-white focus:outline-none focus:border-performance-red/50 bg-black"
                          >
                            <option value="">-- Custom Quick Service --</option>
                            {catalogServices.map(cs => (
                              <option key={cs.id} value={cs.service_name}>
                                {cs.service_name} (₹{cs.default_rate})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="sm:col-span-2">
                            <label className="block text-[8px] text-gray-600 uppercase mb-1">Custom Name</label>
                            <input
                              type="text"
                              placeholder="e.g. Claying treatment"
                              value={inlineSvc.service_name}
                              onChange={(e) => setInlineSvc(prev => ({ ...prev, service_name: e.target.value }))}
                              className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg py-1.5 px-2 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50"
                            />
                          </div>
                          <div>
                            <label className="block text-[8px] text-gray-600 uppercase mb-1">Rate (INR)</label>
                            <input
                              type="number"
                              value={inlineSvc.rate}
                              onChange={(e) => setInlineSvc(prev => ({ ...prev, rate: Number(e.target.value) }))}
                              className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg py-1.5 px-2 text-xs text-white focus:outline-none"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1.5">
                          <button
                            onClick={() => setShowAddSvc(false)}
                            className="px-2.5 py-1 text-[9px] text-gray-400 hover:text-white"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => addServiceMutation.mutate({ jobId: detail.jobCard.id, service: inlineSvc })}
                            disabled={!inlineSvc.service_name || addServiceMutation.isPending}
                            className="px-3 py-1 bg-performance-red text-white text-[9px] font-bold uppercase rounded hover:bg-performance-red/90"
                          >
                            Add Service
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="overflow-y-auto max-h-[160px] custom-scrollbar pr-1">
                      <table className="w-full text-left font-data-sm text-[11px] border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 text-gray-500 uppercase tracking-widest text-[8px] font-label-caps">
                            <th className="pb-2 font-normal">Service Item</th>
                            <th className="pb-2 font-normal text-center">Qty x Rate</th>
                            <th className="pb-2 font-normal text-right">Amount</th>
                            <th className="pb-2 text-right"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {detail.services.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-6 text-center text-gray-600 italic">
                                No services logged to quick docket.
                              </td>
                            </tr>
                          ) : (
                            detail.services.map((srv) => (
                              <tr key={srv.id} className="hover:bg-white/[0.01]">
                                <td className="py-2.5 text-white font-bold">{srv.service_name}</td>
                                <td className="py-2.5 text-center text-gray-400 font-mono-data">
                                  {srv.qty} x ₹{Number(srv.rate).toLocaleString('en-IN')}
                                </td>
                                <td className="py-2.5 text-right text-white font-bold">
                                  ₹{Number(srv.amount).toLocaleString('en-IN')}
                                </td>
                                <td className="py-2.5 text-right">
                                  <button
                                    onClick={() => deleteServiceMutation.mutate({ jobId: detail.jobCard.id, serviceId: srv.id })}
                                    className="text-gray-600 hover:text-performance-red transition-colors flex items-center ml-auto"
                                    title="Remove Service"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">close</span>
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Calculations & Billing trigger */}
                  <div className="pt-4 mt-4 border-t border-white/5 flex justify-between items-end bg-black/10 p-3 rounded-xl">
                    <div>
                      <span className="font-label-caps text-[9px] text-gray-500 block mb-1">Docket Summary</span>
                      {detail.jobCard.status === 'invoiced' ? (
                        <button
                          onClick={() => window.open(`/invoice/quick/${detail.jobCard.id}`, '_blank')}
                          className="px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-lg text-[9px] font-label-caps uppercase tracking-widest transition-all flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-xs">print</span>
                          Print {detail.jobCard.completion_type?.toUpperCase() || 'INVOICE'}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setBillingForm({ completion_type: 'invoice', payment_mode: 'cash', gst_pct: 18 });
                            setShowBillingModal(true);
                          }}
                          className="px-3 py-1.5 bg-performance-red/10 border border-performance-red/20 text-performance-red hover:bg-performance-red hover:text-white rounded-lg text-[9px] font-label-caps uppercase tracking-widest transition-all"
                        >
                          Complete &amp; Bill
                        </button>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-white/50 block font-label-caps uppercase tracking-wider">Subtotal Value</span>
                      <span className="font-data-lg text-lg text-performance-red font-bold text-glow">
                        ₹{detail.services.reduce((sum, s) => sum + Number(s.amount), 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Concerns Ledger Card */}
                <div className="glass-panel rounded-2xl p-5 border border-white/5 bg-[#0c0c0c]/40 flex flex-col justify-between min-h-[300px]">
                  <div>
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
                      <h3 className="font-label-caps text-xs text-white tracking-wider flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-performance-red">assignment_late</span>
                        CLIENT CONCERNS ({detail.concerns.length})
                      </h3>
                      {!showAddConcern && (
                        <button
                          onClick={() => setShowAddConcern(true)}
                          className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] rounded text-white font-label-caps tracking-wider"
                        >
                          + ADD CONCERN
                        </button>
                      )}
                    </div>

                    {showAddConcern && (
                      <div className="bg-[#181818]/60 border border-white/5 rounded-xl p-3.5 mb-4 space-y-2">
                        <label className="block text-[8px] text-gray-600 uppercase">Concern description</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="e.g. Scratch on front panel"
                            value={inlineConcern}
                            onChange={(e) => setInlineConcern(e.target.value)}
                            className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-lg py-1.5 px-2 text-xs text-white placeholder-gray-700 focus:outline-none"
                          />
                          <button
                            onClick={() => addConcernMutation.mutate({ jobId: detail.jobCard.id, text: inlineConcern })}
                            disabled={!inlineConcern || addConcernMutation.isPending}
                            className="px-3 py-1.5 bg-performance-red text-white text-[9px] font-bold uppercase rounded"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 overflow-y-auto max-h-[160px] custom-scrollbar pr-1">
                      {detail.concerns.length === 0 ? (
                        <p className="text-xs text-gray-600 italic py-4 pl-2 w-full text-center">No concerns reported.</p>
                      ) : (
                        detail.concerns.map(c => (
                          <span
                            key={c.id}
                            className="bg-white/5 border border-white/10 text-white pl-2.5 pr-1 py-1 rounded-lg text-xs flex items-center gap-1 font-medium select-none"
                          >
                            {c.concern_text}
                            <button
                              onClick={() => deleteConcernMutation.mutate({ jobId: detail.jobCard.id, concernId: c.id })}
                              className="w-4 h-4 rounded-full hover:bg-red-500/10 hover:text-red-400 flex items-center justify-center transition-colors"
                              title="Delete concern"
                            >
                              <span className="material-symbols-outlined text-[12px]">close</span>
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Preset Pills to quickly add */}
                  <div className="pt-3 border-t border-white/5 mt-4">
                    <p className="text-[8px] text-gray-500 uppercase tracking-widest font-label-caps mb-2">Preset Suggestions</p>
                    <div className="flex flex-wrap gap-1 max-h-[60px] overflow-y-auto custom-scrollbar">
                      {presets.slice(0, 8).map((preset: any) => {
                        const alreadyLogged = detail.concerns.some(c => c.concern_text === preset.concern_text);
                        if (alreadyLogged) return null;
                        return (
                          <button
                            key={preset.id}
                            onClick={() => addConcernMutation.mutate({ jobId: detail.jobCard.id, text: preset.concern_text })}
                            className="px-2 py-1 rounded border border-white/5 bg-white/[0.01] hover:border-performance-red/40 hover:bg-performance-red/[0.02] text-[8.5px] text-gray-400 hover:text-white transition-all font-label-caps"
                          >
                            {preset.concern_text}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* MEDIA ATTACHMENTS */}
              <div className="glass-panel rounded-2xl p-6 relative">
                <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-performance-red shadow-[0_0_8px_#FF2B2B]"></span>
                  <h2 className="font-label-caps text-label-caps text-white tracking-[0.15em]">JOB CARD MEDIA</h2>
                </div>
                <JobCardMediaSection jobCardId={detail.jobCard.id} jobType="quick" />
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {/* ── CREATE MODAL ──────────────────────────────────── */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-black/20">
              <h3 className="text-sm font-label-caps font-bold text-white flex items-center gap-1.5 tracking-wide">
                <span className="material-symbols-outlined text-[20px] text-performance-red">bolt</span>
                INITIALIZE QUICK DETAILED JOB TICKET
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="max-h-[70vh] overflow-y-auto custom-scrollbar p-6 space-y-6">
              {/* Client Info */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-performance-red"></span>
                  01. Client Credentials
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Client Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Amit Patel"
                      value={createForm.owner_name}
                      onChange={(e) => {
                        setCreateForm(prev => ({ ...prev, owner_name: e.target.value }));
                        setLookupQuery(e.target.value);
                      }}
                      className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Contact Mobile *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 9876543210"
                      value={createForm.mobile}
                      onChange={(e) => {
                        setCreateForm(prev => ({ ...prev, mobile: e.target.value }));
                        setLookupQuery(e.target.value);
                      }}
                      className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">License Plate (Reg No) *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. GJ-01-AB-1234"
                      value={createForm.reg_no}
                      onChange={(e) => {
                        setCreateForm(prev => ({ ...prev, reg_no: e.target.value.toUpperCase() }));
                        setLookupQuery(e.target.value);
                      }}
                      className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50 font-mono"
                    />
                  </div>
                </div>
              </div>

              {lookupQuery.length >= 2 && lookupResults.length > 0 && (
                <div className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden max-h-40 overflow-y-auto z-50 relative font-data-sm">
                  {lookupResults.map((c: any) => (
                    <button
                      key={`${c.id}-${c.vehicle_id}`}
                      type="button"
                      onClick={() => {
                        setCreateForm(prev => ({
                          ...prev,
                          owner_name: c.full_name,
                          mobile: c.phone || '',
                          reg_no: c.car_number || '',
                          car_make: c.car_make || '',
                          car_model: c.car_model || '',
                          car_name: c.car_number ? `${c.car_make || ''} ${c.car_model || ''}`.trim() : prev.car_name,
                        }));
                        setLookupQuery('');
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 text-xs text-white flex flex-col"
                    >
                      <span className="font-bold text-white">{c.full_name} ({c.phone})</span>
                      {c.car_number && (
                        <span className="text-[10px] text-performance-red mt-0.5 font-mono">{c.car_number} • {c.car_make} {c.car_model}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Vehicle Specifications */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-performance-red"></span>
                  02. Vehicle Description &amp; Stats
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Car Brand / Make</label>
                    <input
                      type="text"
                      placeholder="e.g. Hyundai"
                      value={createForm.car_make}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, car_make: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Car Model</label>
                    <input
                      type="text"
                      placeholder="e.g. Creta"
                      value={createForm.car_model}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, car_model: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Car Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Creta (White)"
                      value={createForm.car_name}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, car_name: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Mileage (km)</label>
                    <input
                      type="number"
                      placeholder="e.g. 24000"
                      value={createForm.km_reading}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, km_reading: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-700 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Fuel Type</label>
                    <select
                      value={createForm.fuel_type}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, fuel_type: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-performance-red/50 bg-black"
                    >
                      <option value="petrol" className="bg-[#0c0c0e]">Petrol</option>
                      <option value="diesel" className="bg-[#0c0c0e]">Diesel</option>
                      <option value="cng" className="bg-[#0c0c0e]">CNG</option>
                      <option value="ev" className="bg-[#0c0c0e]">Electric (EV)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Insurance */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-performance-red"></span>
                  03. Insurance details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Insurance Provider</label>
                    <input
                      type="text"
                      placeholder="e.g. Tata AIG"
                      value={createForm.insurance_company}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, insurance_company: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-700 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Policy Expiry</label>
                    <input
                      type="date"
                      value={createForm.insurance_expiry}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, insurance_expiry: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Concerns Select */}
              <div className="space-y-3.5 pt-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-performance-red"></span>
                  04. Concerns selection
                </h4>
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto custom-scrollbar border border-white/5 bg-white/[0.01] p-3.5 rounded-xl">
                  {presets.map((p: any) => {
                    const active = wizardConcerns.includes(p.concern_text);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          if (active) {
                            setWizardConcerns(prev => prev.filter(c => c !== p.concern_text));
                          } else {
                            setWizardConcerns(prev => [...prev, p.concern_text]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full border text-[9.5px] font-label-caps transition-all ${
                          active
                            ? 'bg-performance-red/15 border-performance-red/40 text-performance-red font-bold'
                            : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                        }`}
                      >
                        {p.concern_text}
                      </button>
                    );
                  })}
                </div>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Write custom client concern..."
                    value={wizardCustomConcern}
                    onChange={(e) => setWizardCustomConcern(e.target.value)}
                    className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-xl py-2 px-4 text-xs text-white placeholder-gray-700 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (wizardCustomConcern.trim()) {
                        setWizardConcerns(prev => [...prev, wizardCustomConcern.trim()]);
                        setWizardCustomConcern('');
                      }
                    }}
                    className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white border border-white/10 rounded-xl text-xs uppercase font-bold font-label-caps"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Services Select */}
              <div className="space-y-3.5 pt-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-performance-red"></span>
                  05. Service protocol selection
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Preset quick services list */}
                  <div className="border border-white/5 bg-white/[0.01] p-3 rounded-xl space-y-2">
                    <p className="text-[9px] text-gray-500 uppercase tracking-widest font-label-caps border-b border-white/5 pb-1">Catalog Quick Services</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                      {catalogServices.map(cs => {
                        const alreadyAdded = wizardServices.some(s => s.service_name === cs.service_name);
                        return (
                          <div key={cs.id} className="flex justify-between items-center bg-black/25 p-2 rounded-lg text-xs border border-white/[0.03]">
                            <div>
                              <p className="text-white font-bold">{cs.service_name}</p>
                              <p className="text-gray-500 text-[10px]">₹{Number(cs.default_rate).toLocaleString('en-IN')}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (alreadyAdded) {
                                  setWizardServices(prev => prev.filter(s => s.service_name !== cs.service_name));
                                } else {
                                  setWizardServices(prev => [...prev, { service_name: cs.service_name, qty: 1, rate: cs.default_rate }]);
                                }
                              }}
                              className={`px-3 py-1 rounded text-[9px] font-label-caps uppercase tracking-wider border transition-all ${
                                alreadyAdded
                                  ? 'bg-performance-red/10 border-performance-red/20 text-performance-red'
                                  : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                              }`}
                            >
                              {alreadyAdded ? 'Added' : 'Add'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected summary & custom services */}
                  <div className="border border-white/5 bg-white/[0.01] p-3 rounded-xl flex flex-col justify-between">
                    <div>
                      <p className="text-[9px] text-gray-500 uppercase tracking-widest font-label-caps border-b border-white/5 pb-1 mb-2">Selected Services ({wizardServices.length})</p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                        {wizardServices.length === 0 ? (
                          <p className="text-xs text-gray-600 italic py-4 text-center">No services selected yet.</p>
                        ) : (
                          wizardServices.map((srv, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs bg-[#111] p-2 rounded border border-white/5">
                              <span className="text-white font-medium truncate max-w-[120px]">{srv.service_name}</span>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  value={srv.rate}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setWizardServices(prev => prev.map((s, i) => i === idx ? { ...s, rate: val } : s));
                                  }}
                                  className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-right font-mono text-[10px] text-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => setWizardServices(prev => prev.filter((_, i) => i !== idx))}
                                  className="text-gray-500 hover:text-red-400 transition-colors"
                                >
                                  <span className="material-symbols-outlined text-xs">close</span>
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    
                    <div className="pt-3 border-t border-white/5 flex justify-between items-center mt-2">
                      <span className="text-[9px] text-gray-500 uppercase font-label-caps">Estimated Total</span>
                      <span className="text-sm font-bold text-performance-red">
                        ₹{wizardServices.reduce((sum, s) => sum + s.qty * s.rate, 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Text Area Notes */}
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Internal Remarks</label>
                <textarea
                  placeholder="Insert any detailed induction parameters, pre-work inspections, or remarks..."
                  value={createForm.notes}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-3 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50 h-20 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-white/10 rounded-lg text-xs text-gray-300 hover:bg-white/[0.06] transition-all font-label-caps tracking-widest"
                >
                  DISCARD
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-5 py-2.5 bg-gradient-to-r from-performance-red to-[#93000a] text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:shadow-[0_0_16px_rgba(255,43,43,0.4)] active:scale-[0.97] transition-all disabled:opacity-50 font-label-caps"
                >
                  {createMutation.isPending ? 'CREATING...' : 'INITIALIZE JOB CARD'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── BILLING COMPLETION MODAL ───────────────────────── */}
      {showBillingModal && (
        <div
          className="fixed inset-0 z-55 flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => setShowBillingModal(false)}
        >
          <div
            className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-black/20">
              <h3 className="text-sm font-label-caps font-bold text-white flex items-center gap-2 tracking-wide">
                <span className="material-symbols-outlined text-[20px] text-green-400 font-bold">receipt_long</span>
                FINALIZE DOCKET BILLING
              </h3>
              <button
                onClick={() => setShowBillingModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2">Billing Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBillingForm(prev => ({ ...prev, completion_type: 'invoice' }))}
                    className={`py-2 px-3 rounded-xl border text-xs font-label-caps uppercase transition-all ${
                      billingForm.completion_type === 'invoice'
                        ? 'bg-performance-red/10 border-performance-red/40 text-performance-red font-bold'
                        : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    Tax Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingForm(prev => ({ ...prev, completion_type: 'estimate' }))}
                    className={`py-2 px-3 rounded-xl border text-xs font-label-caps uppercase transition-all ${
                      billingForm.completion_type === 'estimate'
                        ? 'bg-performance-red/10 border-performance-red/40 text-performance-red font-bold'
                        : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    Estimate Code
                  </button>
                </div>
              </div>

              {billingForm.completion_type === 'invoice' && (
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">GST Rate Percentage (%)</label>
                  <input
                    type="number"
                    value={billingForm.gst_pct}
                    onChange={(e) => setBillingForm(prev => ({ ...prev, gst_pct: Number(e.target.value) }))}
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2 px-4 text-xs text-white focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Settlement Mode</label>
                <select
                  value={billingForm.payment_mode}
                  onChange={(e) => setBillingForm(prev => ({ ...prev, payment_mode: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none bg-black font-label-caps"
                >
                  <option value="cash" className="bg-[#0c0c0e]">Cash</option>
                  <option value="upi" className="bg-[#0c0c0e]">UPI / QR Scan</option>
                  <option value="card" className="bg-[#0c0c0e]">Card Swipe</option>
                  <option value="netbanking" className="bg-[#0c0c0e]">Net Banking</option>
                </select>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3 bg-black/20">
              <button
                type="button"
                onClick={() => setShowBillingModal(false)}
                className="px-4 py-2 border border-white/10 rounded-lg text-xs text-gray-300 hover:bg-white/[0.06] transition-all font-label-caps tracking-widest"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCompleteBilling}
                disabled={completeMutation.isPending}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:shadow-[0_0_16px_rgba(34,197,94,0.4)] active:scale-[0.97] transition-all disabled:opacity-50 font-label-caps"
              >
                {completeMutation.isPending ? 'FINALIZING...' : 'FINALIZE & PRINT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
