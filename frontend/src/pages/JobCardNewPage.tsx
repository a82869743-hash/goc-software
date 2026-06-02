import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersAPI, vehiclesAPI } from '../api/customers';
import { jobsAPI } from '../api/jobs';
import type { Customer, Vehicle } from '../types';
import toast from 'react-hot-toast';

const STEPS = [
  { id: 1, label: 'Customer & Vehicle', icon: 'person' },
  { id: 2, label: 'Services', icon: 'build' },
  { id: 3, label: 'Confirm', icon: 'check_circle' },
];

interface ServiceLine {
  service_name: string;
  service_type: string;
  package_tier: string;
  unit_price: number;
  quantity: number;
  sqft_used: number;
  ml_used: number;
  description: string;
}

export default function JobCardNewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);

  // Consolidated Step 1 details
  const [detailsForm, setDetailsForm] = useState({
    full_name: '',
    phone: '',
    reg_number: '',
    make: '',
    model: '',
    color: '',
  });

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [lookupQuery, setLookupQuery] = useState('');

  // Step 2: Services
  const [services, setServices] = useState<ServiceLine[]>([]);
  const [svcSearch, setSvcSearch] = useState('');
  const [showSvcResults, setShowSvcResults] = useState(false);

  // Step 3: Job details
  const [jobType, setJobType] = useState('walkin');
  const [expectedOut, setExpectedOut] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [concerns, setConcerns] = useState<string[]>([]);
  const [concernInput, setConcernInput] = useState('');

  const bookingId = searchParams.get('booking_id') ? Number(searchParams.get('booking_id')) : null;

  // Autocomplete search
  const { data: lookupRes } = useQuery({
    queryKey: ['customer-lookup-job', lookupQuery],
    queryFn: () => customersAPI.search(lookupQuery),
    enabled: lookupQuery.length >= 2,
  });
  const lookupResults = lookupRes?.data || [];

  // Service catalog search
  const { data: svcCatalogRes } = useQuery({
    queryKey: ['svcCatalog', svcSearch],
    queryFn: () => jobsAPI.searchServiceCatalog(svcSearch),
    enabled: svcSearch.length >= 1,
  });
  const catalogResults = svcCatalogRes?.data || [];

  // Create job card mutation
  const createJobMutation = useMutation({
    mutationFn: async () => {
      let customerId = selectedCustomer?.id;
      let vehicleId = selectedVehicle?.id;

      // 1. Ensure customer is created/retrieved
      if (!customerId) {
        // Double check by phone
        const existingCustSearch = await customersAPI.list({ search: detailsForm.phone });
        const matchedCust = existingCustSearch.data?.find(c => c.phone === detailsForm.phone);
        
        if (matchedCust) {
          customerId = matchedCust.id;
        } else {
          // Create new customer
          const newCust = await customersAPI.create({
            full_name: detailsForm.full_name,
            phone: detailsForm.phone,
            city: 'Vadodara',
            lead_source: 'walkin',
          });
          customerId = newCust.data.id;
        }
      }

      // 2. Ensure vehicle is created/retrieved
      if (!vehicleId && detailsForm.reg_number) {
        // Double check if vehicle exists
        const existingVehicles = await vehiclesAPI.list(customerId);
        const matchedVeh = existingVehicles.data?.find(v => v.reg_number === detailsForm.reg_number);

        if (matchedVeh) {
          vehicleId = matchedVeh.id;
        } else {
          // Create new vehicle
          const newVeh = await vehiclesAPI.create({
            customer_id: customerId,
            make: detailsForm.make || 'Other',
            model: detailsForm.model || 'Other',
            reg_number: detailsForm.reg_number,
            year: new Date().getFullYear(),
            fuel_type: 'petrol',
            color: detailsForm.color || 'N/A',
            is_primary: true,
          });
          vehicleId = newVeh.data.id;
        }
      }

      if (!customerId || !vehicleId) {
        throw new Error('Failed to resolve customer or vehicle details.');
      }

      // 3. Create Job Card
      const jobRes = await jobsAPI.create({
        customer_id: customerId,
        vehicle_id: vehicleId,
        job_type: jobType as any,
        expected_out: expectedOut || null,
        internal_notes: internalNotes || null,
        booking_id: bookingId,
        concerns,
      } as any);

      const newJob = jobRes.data;

      // 4. Add Services
      for (const svc of services) {
        await jobsAPI.addService(newJob.id, svc as any);
      }
      return newJob;
    },
    onSuccess: (job) => {
      toast.success(`Job card ${job.job_code} created successfully!`);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs-pipeline'] });
      navigate(`/jobs/${job.id}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || err.message || 'Failed to create job card.');
    },
  });

  const totalAmount = services.reduce((s, sv) => s + sv.unit_price * sv.quantity, 0);

  const addServiceFromCatalog = (item: any) => {
    setServices(prev => [...prev, {
      service_name: item.name,
      service_type: item.service_type,
      package_tier: 'premium',
      unit_price: item.default_rate,
      quantity: 1,
      sqft_used: 0,
      ml_used: 0,
      description: '',
    }]);
    setSvcSearch('');
    setShowSvcResults(false);
    toast.success(`${item.name} added.`);
  };

  const addBlankService = () => {
    setServices(prev => [...prev, {
      service_name: '',
      service_type: 'other',
      package_tier: 'basic',
      unit_price: 0,
      quantity: 1,
      sqft_used: 0,
      ml_used: 0,
      description: '',
    }]);
  };

  const updateService = (index: number, field: string, value: any) => {
    setServices(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const removeService = (index: number) => {
    setServices(prev => prev.filter((_, i) => i !== index));
  };

  const canProceed = () => {
    if (step === 1) return !!(detailsForm.full_name && detailsForm.phone && detailsForm.reg_number && detailsForm.make && detailsForm.model);
    if (step === 2) return services.length > 0 && services.every(s => s.service_name && s.unit_price > 0);
    return true;
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/jobs')} className="p-2 rounded-lg hover:bg-white/5 text-on-surface-variant/60 hover:text-white transition-colors">
          <span className="material-symbols-outlined text-[22px]">arrow_back</span>
        </button>
        <div>
          <h1 className="font-display-hero text-display-hero text-on-surface">NEW JOB CARD</h1>
          <p className="font-label-caps text-[10px] text-on-surface-variant/50 tracking-widest uppercase">GOC STUDIO — CREATE DETAILING DOCKET</p>
        </div>
      </div>

      {/* ── Stepper ── */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-5 h-0.5 bg-white/5 z-0" style={{ left: '10%', right: '10%' }}></div>
          {step > 1 && (
            <div
              className="absolute top-5 h-0.5 bg-performance-red shadow-[0_0_10px_rgba(255,43,43,0.6)] z-0 transition-all duration-500"
              style={{ left: '10%', width: `${((step - 1) / (STEPS.length - 1)) * 80}%` }}
            />
          )}
          {STEPS.map((s) => {
            const isPast = s.id < step;
            const isCurrent = s.id === step;
            return (
              <div key={s.id} className="flex flex-col items-center gap-2 z-10">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  isCurrent ? 'bg-void-black border-performance-red text-performance-red shadow-[0_0_20px_rgba(255,43,43,0.6)] scale-110'
                  : isPast ? 'bg-performance-red border-performance-red text-white'
                  : 'bg-void-black border-white/10 text-on-surface-variant/40'
                }`}>
                  {isPast ? <span className="material-symbols-outlined text-[18px]">check</span> : <span className="material-symbols-outlined text-[18px]">{s.icon}</span>}
                </div>
                <span className={`font-label-caps text-[9px] uppercase tracking-wider ${isCurrent ? 'text-performance-red' : isPast ? 'text-white/60' : 'text-on-surface-variant/30'}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Step Content ── */}
      <div className="glass-panel rounded-2xl p-8">

        {/* STEP 1: Customer & Vehicle Details */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="font-label-caps text-label-caps text-on-surface tracking-widest">STEP 1 — CUSTOMER &amp; VEHICLE DETAILS</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Patel"
                  value={detailsForm.full_name}
                  onChange={e => {
                    setDetailsForm(prev => ({ ...prev, full_name: e.target.value }));
                    setLookupQuery(e.target.value);
                    setSelectedCustomer(null);
                  }}
                  className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 font-data-sm"
                />
              </div>

              <div>
                <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Mobile Contact *</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={detailsForm.phone}
                  onChange={e => {
                    setDetailsForm(prev => ({ ...prev, phone: e.target.value }));
                    setLookupQuery(e.target.value);
                    setSelectedCustomer(null);
                  }}
                  className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 font-data-sm"
                />
              </div>

              <div>
                <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">License Plate (Car Number) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GJ-01-AB-1234"
                  value={detailsForm.reg_number}
                  onChange={e => {
                    setDetailsForm(prev => ({ ...prev, reg_number: e.target.value.toUpperCase() }));
                    setLookupQuery(e.target.value);
                    setSelectedVehicle(null);
                  }}
                  className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 font-mono"
                />
              </div>

              <div>
                <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Car Brand / Make *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maruti Suzuki"
                  value={detailsForm.make}
                  onChange={e => setDetailsForm(prev => ({ ...prev, make: e.target.value }))}
                  className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 font-data-sm"
                />
              </div>

              <div>
                <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Car Model *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Swift"
                  value={detailsForm.model}
                  onChange={e => setDetailsForm(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 font-data-sm"
                />
              </div>

              <div>
                <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Color</label>
                <input
                  type="text"
                  placeholder="e.g. Red"
                  value={detailsForm.color}
                  onChange={e => setDetailsForm(prev => ({ ...prev, color: e.target.value }))}
                  className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 font-data-sm"
                />
              </div>
            </div>

            {lookupQuery.length >= 2 && lookupResults.length > 0 && (
              <div className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                {lookupResults.map((c: any) => (
                  <button
                    key={`${c.id}-${c.vehicle_id}`}
                    type="button"
                    onClick={() => {
                      setDetailsForm({
                        full_name: c.full_name,
                        phone: c.phone || '',
                        reg_number: c.car_number || '',
                        make: c.car_make || '',
                        model: c.car_model || '',
                        color: c.car_color || '',
                      });
                      setSelectedCustomer({ id: c.id, full_name: c.full_name, phone: c.phone } as any);
                      if (c.vehicle_id) {
                        setSelectedVehicle({ id: c.vehicle_id, make: c.car_make, model: c.car_model, reg_number: c.car_number } as any);
                      } else {
                        setSelectedVehicle(null);
                      }
                      setLookupQuery('');
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                  >
                    <p className="text-sm text-white font-bold">{c.full_name} ({c.phone})</p>
                    {c.car_number && (
                      <p className="text-xs text-performance-red mt-0.5 font-mono">{c.car_number} • {c.car_make} {c.car_model}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Services */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="font-label-caps text-label-caps text-on-surface tracking-widest">STEP 2 — ADD SERVICES</h2>

            {/* Service Catalog Search */}
            <div className="relative">
              <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5">
                <span className="material-symbols-outlined text-on-surface-variant/40 text-[18px]">search</span>
                <input
                  value={svcSearch}
                  onChange={e => { setSvcSearch(e.target.value); setShowSvcResults(true); }}
                  onFocus={() => setShowSvcResults(true)}
                  placeholder="Search service catalog (e.g. PPF, Ceramic, Polish)…"
                  className="bg-transparent border-none outline-none text-white text-sm flex-1 placeholder-on-surface-variant/40"
                />
              </div>
              {showSvcResults && svcSearch.length >= 1 && catalogResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden max-h-60 overflow-y-auto z-20">
                  {catalogResults.map((item: any) => (
                    <button
                      key={item.id}
                      onClick={() => addServiceFromCatalog(item)}
                      className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm text-white">{item.name}</p>
                        <p className="text-[10px] text-on-surface-variant/50">{item.category} • {item.service_type}</p>
                      </div>
                      <span className="font-data-sm text-performance-red font-bold">₹{Number(item.default_rate).toLocaleString('en-IN')}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={addBlankService} className="text-performance-red font-label-caps text-xs flex items-center gap-2 hover:underline">
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add Custom Service
            </button>

            {/* Service Lines */}
            {services.length > 0 && (
              <div className="space-y-3">
                {services.map((svc, idx) => (
                  <div key={idx} className="bg-white/[0.02] border border-white/[0.07] rounded-xl p-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-4">
                        <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Service Name</label>
                        <input
                          value={svc.service_name}
                          onChange={e => updateService(idx, 'service_name', e.target.value)}
                          className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Type</label>
                        <select
                          value={svc.service_type}
                          onChange={e => updateService(idx, 'service_type', e.target.value)}
                          className="w-full bg-black border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none"
                        >
                          {['ppf', 'ceramic', 'polish', 'detailing', 'other'].map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Unit Price</label>
                        <input
                          type="number"
                          value={svc.unit_price}
                          onChange={e => updateService(idx, 'unit_price', Number(e.target.value))}
                          className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Qty</label>
                        <input
                          type="number"
                          value={svc.quantity}
                          min={1}
                          onChange={e => updateService(idx, 'quantity', Number(e.target.value))}
                          className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
                        />
                      </div>
                      <div className="md:col-span-2 text-right">
                        <p className="font-data-lg text-white font-bold">₹{(svc.unit_price * svc.quantity).toLocaleString('en-IN')}</p>
                      </div>
                      <div className="md:col-span-1 text-right">
                        <button onClick={() => removeService(idx)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-on-surface-variant/30 hover:text-red-400 transition-colors">
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex justify-end border-t border-white/10 pt-4">
                  <p className="font-data-lg text-xl text-white font-bold">
                    Total: <span className="text-performance-red">₹{totalAmount.toLocaleString('en-IN')}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Confirm */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="font-label-caps text-label-caps text-on-surface tracking-widest">STEP 3 — CONFIRM &amp; CREATE</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Summary */}
              <div className="space-y-4">
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-3">
                  <h3 className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest">CUSTOMER</h3>
                  <p className="text-white font-bold">{detailsForm.full_name}</p>
                  <p className="text-on-surface-variant/60 text-sm">{detailsForm.phone}</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-3">
                  <h3 className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest">VEHICLE</h3>
                  <p className="text-white font-bold">{detailsForm.make} {detailsForm.model}</p>
                  <p className="text-on-surface-variant/60 text-sm">{detailsForm.reg_number || 'No Reg'} {detailsForm.color ? `• ${detailsForm.color}` : ''}</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-3">
                  <h3 className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest">SERVICES ({services.length})</h3>
                  {services.map((s, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-on-surface-variant">{s.service_name}</span>
                      <span className="text-white font-bold">₹{(s.unit_price * s.quantity).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  <div className="border-t border-white/10 pt-2 flex justify-between">
                    <span className="font-label-caps text-xs text-on-surface-variant/60">Total</span>
                    <span className="text-performance-red font-bold text-lg">₹{totalAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Right: Job Details */}
              <div className="space-y-4">
                <div>
                  <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Job Type</label>
                  <select
                    value={jobType}
                    onChange={e => setJobType(e.target.value)}
                    className="w-full bg-black border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40"
                  >
                    <option value="walkin">Walk-in</option>
                    <option value="booked">Booked</option>
                  </select>
                </div>
                <div>
                  <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Expected Completion</label>
                  <input
                    type="date"
                    value={expectedOut}
                    onChange={e => setExpectedOut(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 font-data-sm"
                  />
                </div>
                <div>
                  <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Internal Notes</label>
                  <textarea
                    value={internalNotes}
                    onChange={e => setInternalNotes(e.target.value)}
                    rows={3}
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 font-data-sm resize-none"
                  />
                </div>
                <div>
                  <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Customer Concerns</label>
                  <div className="flex gap-2">
                    <input
                      value={concernInput}
                      onChange={e => setConcernInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && concernInput.trim()) { setConcerns(prev => [...prev, concernInput.trim()]); setConcernInput(''); } }}
                      placeholder="Type a concern and press Enter"
                      className="flex-1 bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40"
                    />
                  </div>
                  {concerns.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {concerns.map((c, i) => (
                        <span key={i} className="px-2 py-1 bg-performance-red/10 border border-performance-red/20 rounded text-xs text-performance-red flex items-center gap-1">
                          {c}
                          <button onClick={() => setConcerns(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-white">
                            <span className="material-symbols-outlined text-[12px]">close</span>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation Buttons ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => step > 1 ? setStep(step - 1) : navigate('/jobs')}
          className="px-5 py-2.5 rounded-xl border border-white/10 text-on-surface-variant/60 hover:text-white font-label-caps text-xs tracking-widest transition-all"
        >
          {step === 1 ? 'Cancel' : 'Back'}
        </button>
        {step < 3 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className="performance-gradient text-white font-label-caps text-xs px-6 py-2.5 rounded-xl border border-white/10 disabled:opacity-30 transition-all hover:shadow-[0_0_20px_rgba(255,43,43,0.3)]"
          >
            Next Step
          </button>
        ) : (
          <button
            onClick={() => createJobMutation.mutate()}
            disabled={createJobMutation.isPending}
            className="performance-gradient text-white font-label-caps text-xs px-6 py-2.5 rounded-xl border border-white/10 disabled:opacity-50 transition-all hover:shadow-[0_0_20px_rgba(255,43,43,0.3)] flex items-center gap-2"
          >
            {createJobMutation.isPending ? (
              <><span className="material-symbols-outlined text-[16px] animate-spin">sync</span> Creating...</>
            ) : (
              <><span className="material-symbols-outlined text-[16px]">check_circle</span> Create Job Card</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
