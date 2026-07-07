import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import toast from 'react-hot-toast';
import { customersAPI } from '../api/customers';
import { useNavigate } from 'react-router-dom';

interface Warranty {
  id: number;
  customer_name: string;
  customer_phone: string;
  vehicle_name: string;
  reg_number: string;
  service_name: string;
  warranty_card_no: string;
  duration_months: number;
  start_date: string;
  expiry_date: string;
  status: 'active' | 'expired' | 'void';
  job_code: string;
}

interface Claim {
  id: number;
  warranty_id: number;
  claim_code: string;
  issue_description: string;
  status: 'pending' | 'approved' | 'rejected' | 'in_progress' | 'completed';
  created_at: string;
  customer_name: string;
  customer_phone: string;
  vehicle_name: string;
  reg_number: string;
  service_name: string;
  warranty_card_no: string;
  expiry_date: string;
}

export default function WarrantiesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'list' | 'claims' | 'register'>('list');
  const [search, setSearch] = useState('');

  // ─── QUERIES ───────────────────────────────────────
  const { data: warrantiesRes } = useQuery({
    queryKey: ['warranties', search],
    queryFn: async () => {
      const res = await apiClient.get(`/warranties?search=${search}`);
      return res.data.data as Warranty[];
    }
  });

  const { data: claimsRes } = useQuery({
    queryKey: ['warranty-claims'],
    queryFn: async () => {
      const res = await apiClient.get('/warranties/claims');
      return res.data.data as Claim[];
    }
  });

  // ─── MUTATIONS ─────────────────────────────────────
  const registerMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post('/warranties', payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Warranty registered successfully!');
      queryClient.invalidateQueries({ queryKey: ['warranties'] });
      setActiveTab('list');
      // Reset form
      setRegForm({
        customer_id: '',
        vehicle_id: '',
        job_card_id: '',
        service_name: '',
        warranty_card_no: '',
        duration_months: 12,
        start_date: new Date().toISOString().split('T')[0]
      });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Registration failed');
    }
  });

  const updateClaimStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiClient.put(`/warranties/claims/${id}`, { status });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Claim status updated!');
      queryClient.invalidateQueries({ queryKey: ['warranty-claims'] });
    },
    onError: () => toast.error('Failed to update status')
  });

  const convertToJobMutation = useMutation({
    mutationFn: async (claimId: number) => {
      const res = await apiClient.post(`/warranties/claims/${claimId}/convert-job`);
      return res.data;
    },
    onSuccess: (res) => {
      toast.success('Converted to Warranty Job Card!');
      queryClient.invalidateQueries({ queryKey: ['warranty-claims'] });
      if (res.data?.jobId) {
        navigate(`/jobs/${res.data.jobId}`);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Conversion failed');
    }
  });

  // ─── REGISTRATION FORM STATE ───────────────────────
  const [regForm, setRegForm] = useState({
    customer_id: '',
    vehicle_id: '',
    job_card_id: '',
    service_name: '',
    warranty_card_no: '',
    duration_months: 12,
    start_date: new Date().toISOString().split('T')[0]
  });

  // Customer search lookup inside manual registration
  const [custQuery, setCustQuery] = useState('');
  const { data: custLookupRes } = useQuery({
    queryKey: ['cust-lookup-warranty', custQuery],
    queryFn: () => customersAPI.search(custQuery),
    enabled: custQuery.length >= 2
  });
  const custResults = custLookupRes?.data || [];

  const [selectedCustDetails, setSelectedCustDetails] = useState<any>(null);

  const handleSelectCustomer = async (cust: any) => {
    setSelectedCustDetails(cust);
    setCustQuery('');
    setRegForm(prev => ({
      ...prev,
      customer_id: String(cust.id),
      vehicle_id: cust.vehicle_id ? String(cust.vehicle_id) : ''
    }));

    // Fetch customer's delivered job cards to link
    try {
      const res = await apiClient.get(`/jobs?search=${cust.phone}`);
      if (res.data && res.data.success) {
        // Look for delivered or ready job cards
        const jobs = res.data.data || [];
        if (jobs.length > 0) {
          setRegForm(prev => ({ ...prev, job_card_id: String(jobs[0].id) }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.customer_id || !regForm.vehicle_id || !regForm.job_card_id || !regForm.service_name || !regForm.warranty_card_no) {
      toast.error('Please complete all required fields.');
      return;
    }
    registerMutation.mutate(regForm);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="font-display-hero text-display-hero text-on-surface">WARRANTY MANAGEMENT</h1>
        <p className="font-label-caps text-[10px] text-on-surface-variant/50 tracking-widest mt-1">
          MANAGE CERAMIC &amp; PPF SHIELDING DURATIONS AND LOG WORK CLAIMS
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-px">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 font-label-caps text-xs tracking-wider transition-all border-b-2 ${
            activeTab === 'list' ? 'border-performance-red text-white' : 'border-transparent text-on-surface-variant/40 hover:text-white'
          }`}
        >
          Active Warranties
        </button>
        <button
          onClick={() => setActiveTab('claims')}
          className={`px-4 py-2 font-label-caps text-xs tracking-wider transition-all border-b-2 ${
            activeTab === 'claims' ? 'border-performance-red text-white' : 'border-transparent text-on-surface-variant/40 hover:text-white'
          }`}
        >
          Warranty Claims
        </button>
        <button
          onClick={() => setActiveTab('register')}
          className={`px-4 py-2 font-label-caps text-xs tracking-wider transition-all border-b-2 ${
            activeTab === 'register' ? 'border-performance-red text-white' : 'border-transparent text-on-surface-variant/40 hover:text-white'
          }`}
        >
          Register Warranty Card
        </button>
      </div>

      {/* TAB CONTENT: ACTIVE WARRANTIES LIST */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          <div className="flex gap-3 items-center">
            <input
              type="text"
              placeholder="Search by client name, reg no or card number..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 max-w-md bg-white/[0.03] border border-white/[0.07] rounded-lg px-4 py-2 text-sm text-white outline-none focus:border-performance-red/40"
            />
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden border border-white/5 bg-[#0a0a0a]/30">
            <table className="w-full text-left text-xs uppercase tracking-wider font-mono-data border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02] text-on-surface-variant/50">
                  <th className="p-4 font-bold text-[10px] font-label-caps">Client / Vehicle</th>
                  <th className="p-4 font-bold text-[10px] font-label-caps">Service Layer</th>
                  <th className="p-4 font-bold text-[10px] font-label-caps">Warranty Card #</th>
                  <th className="p-4 font-bold text-[10px] font-label-caps">Duration</th>
                  <th className="p-4 font-bold text-[10px] font-label-caps">Validity</th>
                  <th className="p-4 font-bold text-[10px] font-label-caps">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/80">
                {warrantiesRes && warrantiesRes.length > 0 ? (
                  warrantiesRes.map((w) => (
                    <tr key={w.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-white uppercase font-sans text-xs">{w.customer_name}</p>
                        <p className="text-[10px] text-on-surface-variant/40 mt-0.5">{w.vehicle_name} [{w.reg_number}]</p>
                      </td>
                      <td className="p-4 font-bold text-performance-red">{w.service_name}</td>
                      <td className="p-4">{w.warranty_card_no}</td>
                      <td className="p-4 font-sans">{w.duration_months} Months</td>
                      <td className="p-4">
                        {new Date(w.start_date).toLocaleDateString('en-IN')} - {new Date(w.expiry_date).toLocaleDateString('en-IN')}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-bold ${
                          w.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                        }`}>
                          {w.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-on-surface-variant/30 text-sm uppercase tracking-widest font-label-caps">
                      No registered warranties found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: CLAIMS RECEIVED */}
      {activeTab === 'claims' && (
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl overflow-hidden border border-white/5 bg-[#0a0a0a]/30">
            <table className="w-full text-left text-xs uppercase tracking-wider font-mono-data border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02] text-on-surface-variant/50">
                  <th className="p-4 font-bold text-[10px] font-label-caps">Claim Code</th>
                  <th className="p-4 font-bold text-[10px] font-label-caps">Client Details</th>
                  <th className="p-4 font-bold text-[10px] font-label-caps">Shielding Details</th>
                  <th className="p-4 font-bold text-[10px] font-label-caps">Issue Reported</th>
                  <th className="p-4 font-bold text-[10px] font-label-caps">Status</th>
                  <th className="p-4 font-bold text-[10px] font-label-caps text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/80">
                {claimsRes && claimsRes.length > 0 ? (
                  claimsRes.map((c) => (
                    <tr key={c.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="p-4 font-bold text-performance-red">{c.claim_code}</td>
                      <td className="p-4">
                        <p className="font-bold text-white uppercase font-sans text-xs">{c.customer_name}</p>
                        <p className="text-[10px] text-on-surface-variant/40 mt-0.5">{c.customer_phone}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-white font-bold">{c.service_name}</p>
                        <p className="text-[10px] text-on-surface-variant/40 mt-0.5">{c.vehicle_name} [{c.reg_number}]</p>
                      </td>
                      <td className="p-4 font-sans normal-case text-on-surface-variant/80 max-w-xs truncate" title={c.issue_description}>
                        {c.issue_description}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-bold ${
                          c.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          c.status === 'approved' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                          c.status === 'in_progress' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                          'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex gap-2 justify-end">
                          {c.status === 'pending' && (
                            <>
                              <button
                                onClick={() => updateClaimStatusMutation.mutate({ id: c.id, status: 'approved' })}
                                className="px-2 py-1 rounded bg-green-500/10 hover:bg-green-500/20 text-green-400 text-[10px] font-label-caps border border-green-500/20"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => updateClaimStatusMutation.mutate({ id: c.id, status: 'rejected' })}
                                className="px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-performance-red text-[10px] font-label-caps border border-red-500/20"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {c.status === 'approved' && (
                            <button
                              onClick={() => convertToJobMutation.mutate(c.id)}
                              className="px-2.5 py-1 rounded performance-gradient text-white text-[10px] font-label-caps flex items-center gap-1 border border-white/10"
                            >
                              <span className="material-symbols-outlined text-[10px]">build</span>
                              Create Job Card
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-on-surface-variant/30 text-sm uppercase tracking-widest font-label-caps">
                      No repair claims logged
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: MANUAL REGISTER FORM */}
      {activeTab === 'register' && (
        <form onSubmit={handleRegisterSubmit} className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#0a0a0a]/30 max-w-xl space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-performance-red shadow-[0_0_8px_#FF2B2B]"></span>
            Register Warranty
          </h3>

          {/* Client Search */}
          <div className="relative">
            <label className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest block mb-1 uppercase font-bold">Client Lookup *</label>
            <input
              type="text"
              placeholder="Search client by phone or name..."
              value={custQuery}
              onChange={e => setCustQuery(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
            />

            {custQuery.length >= 2 && custResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-[#111] border border-white/10 rounded-xl overflow-hidden max-h-48 overflow-y-auto z-30">
                {custResults.map((c: any) => (
                  <button
                    key={`${c.id}-${c.vehicle_id}`}
                    type="button"
                    onClick={() => handleSelectCustomer(c)}
                    className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 text-xs text-white flex justify-between"
                  >
                    <span>{c.full_name} ({c.phone})</span>
                    <span className="text-performance-red font-mono">{c.car_number}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedCustDetails && (
            <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl text-xs space-y-1">
              <p className="text-on-surface-variant"><span className="text-white font-bold">Customer:</span> {selectedCustDetails.full_name}</p>
              <p className="text-on-surface-variant"><span className="text-white font-bold">Vehicle:</span> {selectedCustDetails.car_make} {selectedCustDetails.car_model} [{selectedCustDetails.car_number}]</p>
            </div>
          )}

          {/* Service Name */}
          <div>
            <label className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest block mb-1 uppercase font-bold">Service / Protective Layer *</label>
            <input
              type="text"
              required
              placeholder="e.g. PPF Full Car, Graphene Coating"
              value={regForm.service_name}
              onChange={e => setRegForm(prev => ({ ...prev, service_name: e.target.value }))}
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
            />
          </div>

          {/* Warranty card no */}
          <div>
            <label className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest block mb-1 uppercase font-bold">Warranty Certificate / Card No. *</label>
            <input
              type="text"
              required
              placeholder="e.g. GOC-WARR-2026-991"
              value={regForm.warranty_card_no}
              onChange={e => setRegForm(prev => ({ ...prev, warranty_card_no: e.target.value }))}
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
            />
          </div>

          {/* Duration & Start Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest block mb-1 uppercase font-bold">Duration (Months) *</label>
              <input
                type="number"
                required
                min={1}
                value={regForm.duration_months}
                onChange={e => setRegForm(prev => ({ ...prev, duration_months: Number(e.target.value) }))}
                className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
              />
            </div>
            <div>
              <label className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest block mb-1 uppercase font-bold">Start Date *</label>
              <input
                type="date"
                required
                value={regForm.start_date}
                onChange={e => setRegForm(prev => ({ ...prev, start_date: e.target.value }))}
                className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
              />
            </div>
          </div>

          {/* Hidden fields autofilled */}
          <input type="hidden" value={regForm.customer_id} />
          <input type="hidden" value={regForm.vehicle_id} />
          <input type="hidden" value={regForm.job_card_id} />

          <button
            type="submit"
            disabled={registerMutation.isPending}
            className="w-full py-3 rounded-lg performance-gradient text-white font-label-caps text-xs tracking-widest uppercase font-bold transition-all disabled:opacity-50 border border-white/10"
          >
            {registerMutation.isPending ? 'Registering...' : 'Register Warranty'}
          </button>
        </form>
      )}
    </div>
  );
}
