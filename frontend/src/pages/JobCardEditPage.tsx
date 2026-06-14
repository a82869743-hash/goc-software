import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsAPI, JobCard } from '../api/jobs';
import toast from 'react-hot-toast';

export default function JobCardEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: jobRes, isLoading } = useQuery({
    queryKey: ['job-detail', id],
    queryFn: () => jobsAPI.getById(Number(id)),
    enabled: !!id,
  });
  const job = jobRes?.data as JobCard | undefined;

  const [form, setForm] = useState({
    expected_out: '',
    internal_notes: '',
    qc_notes: '',
    delivery_notes: '',
    customer_name: '',
    customer_phone: '',
    vehicle_make: '',
    vehicle_model: '',
    reg_number: '',
    vehicle_color: '',
    vehicle_fuel_type: 'petrol',
    km_reading: '',
    insurance_company: '',
    insurance_expiry: '',
  });

  useEffect(() => {
    if (job) {
      setForm({
        expected_out: job.expected_out ? job.expected_out.split('T')[0] : '',
        internal_notes: job.internal_notes || '',
        qc_notes: job.qc_notes || '',
        delivery_notes: job.delivery_notes || '',
        customer_name: job.customer_name || '',
        customer_phone: job.customer_phone || '',
        vehicle_make: (job as any).vehicle_make || '',
        vehicle_model: (job as any).vehicle_model || '',
        reg_number: job.reg_number || '',
        vehicle_color: (job as any).vehicle_color || '',
        vehicle_fuel_type: (job as any).vehicle_fuel_type || 'petrol',
        km_reading: job.km_reading !== undefined && job.km_reading !== null ? String(job.km_reading) : '',
        insurance_company: job.insurance_company || '',
        insurance_expiry: job.insurance_expiry ? job.insurance_expiry.split('T')[0] : '',
      });
    }
  }, [job]);

  const updateMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, any> = {};
      if (form.expected_out) payload.expected_out = form.expected_out;
      payload.internal_notes = form.internal_notes;
      payload.qc_notes = form.qc_notes;
      payload.delivery_notes = form.delivery_notes;
      payload.customer_name = form.customer_name;
      payload.customer_phone = form.customer_phone;
      payload.vehicle_make = form.vehicle_make;
      payload.vehicle_model = form.vehicle_model;
      payload.reg_number = form.reg_number;
      payload.vehicle_color = form.vehicle_color;
      payload.vehicle_fuel_type = form.vehicle_fuel_type;
      payload.km_reading = form.km_reading === '' ? null : Number(form.km_reading);
      payload.insurance_company = form.insurance_company;
      payload.insurance_expiry = form.insurance_expiry || null;
      return jobsAPI.update(Number(id), payload);
    },
    onSuccess: () => {
      toast.success('Job card updated!');
      queryClient.invalidateQueries({ queryKey: ['job-detail', id] });
      navigate(`/jobs/${id}`);
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to update.'),
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <span className="material-symbols-outlined text-4xl animate-spin text-performance-red block mb-3">sync</span>
          <p className="font-label-caps text-xs text-on-surface-variant/40 tracking-widest">LOADING...</p>
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

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(`/jobs/${id}`)} className="p-2 rounded-lg hover:bg-white/5 text-on-surface-variant/60 hover:text-white transition-colors">
          <span className="material-symbols-outlined text-[22px]">arrow_back</span>
        </button>
        <div>
          <h1 className="font-display-hero text-display-hero text-on-surface">EDIT {job.job_code}</h1>
          <p className="font-label-caps text-[10px] text-on-surface-variant/50 tracking-widest uppercase mt-1">
            Status: {(job.status || '').toUpperCase()} • Code: {job.job_code}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Card 1: Client Credentials */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#0c0c0c]/40 backdrop-blur-2xl">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-performance-red shadow-[0_0_8px_#FF2B2B]"></span>
            01. Client Credentials
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Client Name *</label>
              <input
                type="text"
                required
                value={form.customer_name}
                onChange={(e) => setForm(prev => ({ ...prev, customer_name: e.target.value }))}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-performance-red/50"
              />
            </div>

            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Contact Mobile *</label>
              <input
                type="text"
                required
                value={form.customer_phone}
                onChange={(e) => setForm(prev => ({ ...prev, customer_phone: e.target.value }))}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-performance-red/50 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Vehicle Credentials */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#0c0c0c]/40 backdrop-blur-2xl">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-performance-red shadow-[0_0_8px_#FF2B2B]"></span>
            02. Vehicle Credentials
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Car Make</label>
              <input
                type="text"
                value={form.vehicle_make}
                onChange={(e) => setForm(prev => ({ ...prev, vehicle_make: e.target.value }))}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-performance-red/50"
              />
            </div>

            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Car Model</label>
              <input
                type="text"
                value={form.vehicle_model}
                onChange={(e) => setForm(prev => ({ ...prev, vehicle_model: e.target.value }))}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-performance-red/50"
              />
            </div>

            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">License Plate (Reg No) *</label>
              <input
                type="text"
                required
                value={form.reg_number}
                onChange={(e) => setForm(prev => ({ ...prev, reg_number: e.target.value.toUpperCase() }))}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-performance-red/50 font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Car Color</label>
              <input
                type="text"
                value={form.vehicle_color}
                onChange={(e) => setForm(prev => ({ ...prev, vehicle_color: e.target.value }))}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-performance-red/50"
              />
            </div>

            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Fuel Type</label>
              <select
                value={form.vehicle_fuel_type}
                onChange={(e) => setForm(prev => ({ ...prev, vehicle_fuel_type: e.target.value }))}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none bg-black font-label-caps"
              >
                <option value="petrol" className="bg-[#0c0c0e]">Petrol</option>
                <option value="diesel" className="bg-[#0c0c0e]">Diesel</option>
                <option value="electric" className="bg-[#0c0c0e]">Electric (EV)</option>
                <option value="cng" className="bg-[#0c0c0e]">CNG</option>
              </select>
            </div>
          </div>
        </div>

        {/* Card 3: Job Specifications & Insurance */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#0c0c0c]/40 backdrop-blur-2xl">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-performance-red shadow-[0_0_8px_#FF2B2B]"></span>
            03. Job Details &amp; Insurance
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">KM Reading</label>
              <input
                type="number"
                value={form.km_reading}
                onChange={(e) => setForm(prev => ({ ...prev, km_reading: e.target.value }))}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-performance-red/50 font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Expected Completion Date</label>
              <input
                type="date"
                value={form.expected_out}
                onChange={(e) => setForm(prev => ({ ...prev, expected_out: e.target.value }))}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-performance-red/50 font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Insurance Company</label>
              <input
                type="text"
                value={form.insurance_company}
                onChange={(e) => setForm(prev => ({ ...prev, insurance_company: e.target.value }))}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-performance-red/50"
              />
            </div>

            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Insurance Expiry Date</label>
              <input
                type="date"
                value={form.insurance_expiry}
                onChange={(e) => setForm(prev => ({ ...prev, insurance_expiry: e.target.value }))}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-performance-red/50 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Card 4: Comments & Notes */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#0c0c0c]/40 backdrop-blur-2xl space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-performance-red shadow-[0_0_8px_#FF2B2B]"></span>
            04. Workflow Notes
          </h3>

          <div>
            <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Internal Notes</label>
            <textarea
              value={form.internal_notes}
              onChange={e => setForm(p => ({ ...p, internal_notes: e.target.value }))}
              rows={3}
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 resize-none"
              placeholder="Internal team notes…"
            />
          </div>

          <div>
            <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">QC Notes</label>
            <textarea
              value={form.qc_notes}
              onChange={e => setForm(p => ({ ...p, qc_notes: e.target.value }))}
              rows={2}
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 resize-none"
              placeholder="Quality check notes…"
            />
          </div>

          <div>
            <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Delivery Notes</label>
            <textarea
              value={form.delivery_notes}
              onChange={e => setForm(p => ({ ...p, delivery_notes: e.target.value }))}
              rows={2}
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 resize-none"
              placeholder="Notes for delivery…"
            />
          </div>
        </div>
      </div>

      {/* ── Action Buttons ── */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-4">
        <button
          onClick={() => navigate(`/jobs/${id}`)}
          className="w-full sm:w-auto px-6 py-3 border border-white/10 rounded-xl text-xs text-gray-300 hover:bg-white/[0.06] transition-all font-label-caps tracking-widest uppercase"
        >
          Cancel
        </button>
        <button
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
          className="w-full sm:w-auto justify-center performance-gradient text-white font-label-caps text-xs px-8 py-3 rounded-xl border border-white/10 disabled:opacity-50 transition-all hover:shadow-[0_0_20px_rgba(255,43,43,0.3)] flex items-center gap-2 tracking-widest uppercase font-bold"
        >
          {updateMutation.isPending ? (
            <><span className="material-symbols-outlined text-[18px] animate-spin">sync</span> Saving Changes...</>
          ) : (
            <><span className="material-symbols-outlined text-[18px]">save</span> Save Changes</>
          )}
        </button>
      </div>
    </div>
  );
}
