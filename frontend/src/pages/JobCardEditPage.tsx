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
  });

  useEffect(() => {
    if (job) {
      setForm({
        expected_out: job.expected_out ? job.expected_out.split('T')[0] : '',
        internal_notes: job.internal_notes || '',
        qc_notes: job.qc_notes || '',
        delivery_notes: job.delivery_notes || '',
      });
    }
  }, [job]);

  const updateMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, any> = {};
      if (form.expected_out) payload.expected_out = form.expected_out;
      if (form.internal_notes !== (job?.internal_notes || '')) payload.internal_notes = form.internal_notes;
      if (form.qc_notes !== (job?.qc_notes || '')) payload.qc_notes = form.qc_notes;
      if (form.delivery_notes !== (job?.delivery_notes || '')) payload.delivery_notes = form.delivery_notes;
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
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(`/jobs/${id}`)} className="p-2 rounded-lg hover:bg-white/5 text-on-surface-variant/60 hover:text-white transition-colors">
          <span className="material-symbols-outlined text-[22px]">arrow_back</span>
        </button>
        <div>
          <h1 className="font-display-hero text-display-hero text-on-surface">EDIT {job.job_code}</h1>
          <p className="font-label-caps text-[10px] text-on-surface-variant/50 tracking-widest uppercase">
            {job.customer_name} • {job.vehicle_name}
          </p>
        </div>
      </div>

      {/* ── Info Card (Read-only) ── */}
      <div className="glass-panel rounded-2xl p-6">
        <h2 className="font-label-caps text-[10px] text-on-surface-variant/50 tracking-widest mb-4">JOB INFORMATION (READ ONLY)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Customer', value: job.customer_name },
            { label: 'Phone', value: job.customer_phone },
            { label: 'Vehicle', value: job.vehicle_name },
            { label: 'Reg No.', value: job.reg_number },
            { label: 'Status', value: (job.status || '').toUpperCase() },
            { label: 'Total Amount', value: `₹${Number(job.total_amount).toLocaleString('en-IN')}` },
            { label: 'Created', value: job.created_at ? new Date(job.created_at).toLocaleDateString('en-IN') : '—' },
            { label: 'Job Type', value: (job.job_type || 'walkin').toUpperCase() },
          ].map(item => (
            <div key={item.label}>
              <p className="font-label-caps text-[8px] text-on-surface-variant/40 tracking-widest">{item.label}</p>
              <p className="text-sm text-white mt-0.5">{item.value || '—'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Editable Fields ── */}
      <div className="glass-panel rounded-2xl p-6 space-y-5">
        <h2 className="font-label-caps text-[10px] text-on-surface-variant/50 tracking-widest">EDITABLE FIELDS</h2>

        <div>
          <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Expected Completion Date</label>
          <input
            type="date"
            value={form.expected_out}
            onChange={e => setForm(p => ({ ...p, expected_out: e.target.value }))}
            className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 font-data-sm"
          />
        </div>

        <div>
          <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Internal Notes</label>
          <textarea
            value={form.internal_notes}
            onChange={e => setForm(p => ({ ...p, internal_notes: e.target.value }))}
            rows={4}
            className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 font-data-sm resize-none"
            placeholder="Internal team notes…"
          />
        </div>

        <div>
          <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">QC Notes</label>
          <textarea
            value={form.qc_notes}
            onChange={e => setForm(p => ({ ...p, qc_notes: e.target.value }))}
            rows={3}
            className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 font-data-sm resize-none"
            placeholder="Quality check notes…"
          />
        </div>

        <div>
          <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Delivery Notes</label>
          <textarea
            value={form.delivery_notes}
            onChange={e => setForm(p => ({ ...p, delivery_notes: e.target.value }))}
            rows={3}
            className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 font-data-sm resize-none"
            placeholder="Notes for delivery…"
          />
        </div>
      </div>

      {/* ── Action Buttons ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/jobs/${id}`)}
          className="px-5 py-2.5 rounded-xl border border-white/10 text-on-surface-variant/60 hover:text-white font-label-caps text-xs tracking-widest transition-all"
        >
          Cancel
        </button>
        <button
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
          className="performance-gradient text-white font-label-caps text-xs px-6 py-2.5 rounded-xl border border-white/10 disabled:opacity-50 transition-all hover:shadow-[0_0_20px_rgba(255,43,43,0.3)] flex items-center gap-2"
        >
          {updateMutation.isPending ? (
            <><span className="material-symbols-outlined text-[16px] animate-spin">sync</span> Saving...</>
          ) : (
            <><span className="material-symbols-outlined text-[16px]">save</span> Save Changes</>
          )}
        </button>
      </div>
    </div>
  );
}
