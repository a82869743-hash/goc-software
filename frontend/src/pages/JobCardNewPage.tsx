import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersAPI, vehiclesAPI } from '../api/customers';
import { jobsAPI } from '../api/jobs';
import { advanceBookingsAPI } from '../api/advanceBookings';
import { inventoryAPI } from '../api/inventory';
import type { Customer, Vehicle } from '../types';
import toast from 'react-hot-toast';
import { carDataset, basicColors } from '../utils/carDataset';

const STEPS = [
  { id: 1, label: 'Customer & Vehicle', icon: 'person' },
  { id: 2, label: 'Services', icon: 'build' },
  { id: 3, label: 'Confirm', icon: 'check_circle' },
];

interface ServiceLine {
  service_name: string;
  service_type: string;
  package_tier: string;
  unit_price: number | '';
  quantity: number | '';
  sqft_used: number | '';
  ml_used: number | '';
  description: string;
  item_type?: 'labor' | 'part';
  inventory_item_id?: number | null;
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

  const selectedBrandData = carDataset.find(
    item => item.brand.toLowerCase() === detailsForm.make.toLowerCase()
  );
  const modelSuggestions = selectedBrandData 
    ? selectedBrandData.models 
    : Array.from(new Set(carDataset.flatMap(item => item.models))).sort();

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [lookupQuery, setLookupQuery] = useState('');
  const [activeField, setActiveField] = useState<'full_name' | 'phone' | 'reg_number' | null>(null);

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
  const advanceBookingId = searchParams.get('advance_booking_id') ? Number(searchParams.get('advance_booking_id')) : null;

  // Fetch advance booking details if advance_booking_id is provided
  const { data: advBookingRes } = useQuery({
    queryKey: ['advance-booking-detail', advanceBookingId],
    queryFn: () => advanceBookingsAPI.getById(advanceBookingId!),
    enabled: !!advanceBookingId,
  });
  const advBooking = advBookingRes?.data;

  const [prefilled, setPrefilled] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState<number | ''>('');
  const [advanceMode, setAdvanceMode] = useState<string>('cash');
  const [advanceRef, setAdvanceRef] = useState<string>('');

  // Fetch active inventory items
  const { data: inventoryRes } = useQuery({
    queryKey: ['active-inventory-new'],
    queryFn: () => inventoryAPI.list({ limit: 100 }),
  });
  const inventoryItems = inventoryRes?.data || [];

  useEffect(() => {
    if (advBooking && !prefilled) {
      setDetailsForm({
        full_name: advBooking.customer_name || '',
        phone: advBooking.mobile || '',
        reg_number: advBooking.car_number || '',
        make: advBooking.car_make || '',
        model: advBooking.car_model || '',
        color: '',
      });
      if (advBooking.concerns) {
        setConcerns([advBooking.concerns]);
      }
      if (advBooking.advance_amount) {
        setAdvanceAmount(Number(advBooking.advance_amount));
      }
      if (advBooking.advance_mode) {
        setAdvanceMode(advBooking.advance_mode);
      }
      setPrefilled(true);
    }
  }, [advBooking, prefilled]);

  // Autocomplete search
  const { data: lookupRes } = useQuery({
    queryKey: ['customer-lookup-job', lookupQuery],
    queryFn: () => customersAPI.search(lookupQuery),
    enabled: lookupQuery.length >= 2,
  });
  const lookupResults = lookupRes?.data || [];

  const renderAutocomplete = (fieldName: 'full_name' | 'phone' | 'reg_number') => {
    if (activeField !== fieldName || lookupQuery.length < 2 || lookupResults.length === 0) return null;
    return (
      <div className="absolute left-0 right-0 top-full mt-1 bg-[#111111] border border-white/10 rounded-xl overflow-hidden max-h-48 overflow-y-auto z-50 shadow-2xl font-data-sm text-left">
        {lookupResults.map((c: any) => (
          <div
            key={`${c.id}-${c.vehicle_id}`}
            onMouseDown={(e) => {
              e.preventDefault(); // prevents blur
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
              setActiveField(null);
            }}
            className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 text-xs text-white cursor-pointer flex flex-col"
          >
            <span className="font-bold text-white">{c.full_name} ({c.phone})</span>
            {c.car_number && (
              <span className="text-[10px] text-performance-red mt-0.5 font-mono">{c.car_number} • {c.car_make} {c.car_model}</span>
            )}
          </div>
        ))}
      </div>
    );
  };

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

      // 3. Create Job Card with Services atomically
      const jobRes = await jobsAPI.create({
        customer_id: customerId,
        vehicle_id: vehicleId,
        job_type: jobType as any,
        expected_out: expectedOut || null,
        internal_notes: internalNotes || null,
        booking_id: bookingId,
        advance_booking_id: advanceBookingId,
        advance_amount: advanceAmount === '' ? 0 : Number(advanceAmount),
        advance_payment_mode: advanceMode,
        advance_payment_ref: advanceRef || null,
        concerns,
        services: services.map(svc => ({
          service_name: svc.service_name,
          service_type: svc.service_type || 'other',
          package_tier: svc.package_tier || 'basic',
          description: svc.description || null,
          unit_price: Number(svc.unit_price) || 0,
          quantity: Number(svc.quantity) || 1,
          sqft_used: svc.sqft_used === '' ? 0 : Number(svc.sqft_used),
          ml_used: svc.ml_used === '' ? 0 : Number(svc.ml_used),
          item_type: svc.item_type || 'labor',
          inventory_item_id: svc.inventory_item_id || null,
        })),
      } as any);

      return jobRes.data;
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

  const subtotal = services.reduce((s, sv) => s + (Number(sv.unit_price) || 0) * (Number(sv.quantity) || 0), 0);
  const gstAmount = subtotal * 0.18;
  const totalAmount = subtotal + gstAmount;

  const addServiceFromCatalog = (item: any) => {
    setServices(prev => [...prev, {
      service_name: item.name,
      service_type: item.service_type,
      package_tier: 'premium',
      unit_price: item.default_rate,
      quantity: 1,
      sqft_used: '',
      ml_used: '',
      description: '',
      item_type: 'labor',
      inventory_item_id: null,
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
      unit_price: '',
      quantity: 1,
      sqft_used: '',
      ml_used: '',
      description: '',
      item_type: 'labor',
      inventory_item_id: null,
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
    if (step === 2) return services.length > 0 && services.every(s => s.service_name && s.unit_price !== '' && Number(s.unit_price) >= 0);
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
              <div className="relative">
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
                  onFocus={() => {
                    setActiveField('full_name');
                    setLookupQuery(detailsForm.full_name);
                  }}
                  onBlur={() => setActiveField(null)}
                  className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 font-data-sm"
                />
                {renderAutocomplete('full_name')}
              </div>

              <div className="relative">
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
                  onFocus={() => {
                    setActiveField('phone');
                    setLookupQuery(detailsForm.phone);
                  }}
                  onBlur={() => setActiveField(null)}
                  className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 font-data-sm"
                />
                {renderAutocomplete('phone')}
              </div>

              <div className="relative">
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
                  onFocus={() => {
                    setActiveField('reg_number');
                    setLookupQuery(detailsForm.reg_number);
                  }}
                  onBlur={() => setActiveField(null)}
                  className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 font-mono"
                />
                {renderAutocomplete('reg_number')}
              </div>

              <div>
                <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Car Brand / Make *</label>
                <input
                  type="text"
                  required
                  list="brands-datalist"
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
                  list="models-datalist"
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
                  list="colors-datalist"
                  placeholder="e.g. Red"
                  value={detailsForm.color}
                  onChange={e => setDetailsForm(prev => ({ ...prev, color: e.target.value }))}
                  className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 font-data-sm"
                />
              </div>
            </div>
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
                  <div key={idx} className="bg-white/[0.02] border border-white/[0.07] rounded-xl p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest block mb-1">Link Inventory Product (Optional)</label>
                        <select
                          value={svc.inventory_item_id || ''}
                          onChange={e => {
                            const val = e.target.value;
                            if (!val) {
                              updateService(idx, 'inventory_item_id', null);
                            } else {
                              const item = inventoryItems.find(i => i.id === Number(val));
                              if (item) {
                                updateService(idx, 'inventory_item_id', item.id);
                                updateService(idx, 'service_name', item.name);
                                updateService(idx, 'unit_price', item.selling_price || item.purchase_price || 0);
                                updateService(idx, 'item_type', 'part');
                                updateService(idx, 'service_type', item.category === 'ppf_roll' ? 'ppf' : item.category === 'ceramic' ? 'ceramic' : 'other');
                                updateService(idx, 'sqft_used', item.category === 'ppf_roll' ? 50 : 0);
                              }
                            }
                          }}
                          className="w-full bg-black border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40 font-data-sm"
                        >
                          <option value="">-- No linked product --</option>
                          {inventoryItems.map(item => (
                            <option key={item.id} value={item.id}>
                              {item.name} ({item.category.replace('_', ' ')} • Stock: {item.current_stock})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest block mb-1">Type</label>
                        <select
                          value={svc.item_type || 'labor'}
                          onChange={e => updateService(idx, 'item_type', e.target.value)}
                          className="w-full bg-black border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40 font-data-sm"
                        >
                          <option value="labor">Labor</option>
                          <option value="part">Part</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-4">
                        <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Service Name / Part Description</label>
                        <input
                          value={svc.service_name}
                          onChange={e => updateService(idx, 'service_name', e.target.value)}
                          className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40 font-data-sm"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Category Type</label>
                        <select
                          value={svc.service_type}
                          onChange={e => updateService(idx, 'service_type', e.target.value)}
                          className="w-full bg-black border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none font-data-sm"
                        >
                          {['ppf', 'ceramic', 'polish', 'detailing', 'other'].map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Unit Price</label>
                        <input
                          type="number"
                          value={svc.unit_price}
                          placeholder="Amount"
                          onChange={e => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            updateService(idx, 'unit_price', val);
                          }}
                          className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40 font-data-sm"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Qty</label>
                        <input
                          type="number"
                          value={svc.quantity}
                          min={1}
                          onChange={e => updateService(idx, 'quantity', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40 font-data-sm"
                        />
                      </div>
                      <div className="md:col-span-2 text-left md:text-right font-data-sm text-[11px] text-on-surface-variant/60">
                        <p>Sub: ₹{((Number(svc.unit_price) || 0) * (Number(svc.quantity) || 0)).toLocaleString('en-IN')}</p>
                        <p>GST (18%): ₹{(((Number(svc.unit_price) || 0) * (Number(svc.quantity) || 0)) * 0.18).toLocaleString('en-IN')}</p>
                        <p className="font-data-lg text-white font-bold text-sm">Total: ₹{(((Number(svc.unit_price) || 0) * (Number(svc.quantity) || 0)) * 1.18).toLocaleString('en-IN')}</p>
                      </div>
                      <div className="md:col-span-1 text-left md:text-right">
                        <button onClick={() => removeService(idx)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-on-surface-variant/30 hover:text-red-400 transition-colors">
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                      </div>
                    </div>

                    {/* Conditionally show manual PPF square feet entry */}
                    {(svc.service_type === 'ppf' || svc.service_name.toLowerCase().includes('ppf') || inventoryItems.find(i => i.id === svc.inventory_item_id)?.category === 'ppf_roll') && (
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        <div className="col-span-3">
                          <label className="font-label-caps text-[9px] text-orange-400 tracking-widest block mb-1">Manual PPF Sq feet to Deduct *</label>
                          <input
                            type="number"
                            value={svc.sqft_used}
                            onChange={e => updateService(idx, 'sqft_used', e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="Enter square feet (e.g. 25)"
                            className="w-full bg-black border border-orange-500/30 rounded-lg px-3 py-2 text-sm text-orange-400 outline-none focus:border-orange-500/50 font-bold"
                          />
                          <p className="text-[9px] text-on-surface-variant/40 mt-1">This square feet amount will deduct from the matched PPF roll automatically on completion/delivery (+5% wastage).</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div className="flex flex-col items-end border-t border-white/10 pt-4 space-y-1">
                  <p className="font-data-sm text-sm text-on-surface-variant/70">
                    Subtotal: <span>₹{subtotal.toLocaleString('en-IN')}</span>
                  </p>
                  <p className="font-data-sm text-sm text-on-surface-variant/70">
                    GST (18%): <span>₹{gstAmount.toLocaleString('en-IN')}</span>
                  </p>
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
                  {services.map((s, i) => {
                    const price = Number(s.unit_price) || 0;
                    const lineSub = price * (Number(s.quantity) || 0);
                    return (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">{s.service_name} (x{s.quantity})</span>
                        <span className="text-white font-bold">₹{lineSub.toLocaleString('en-IN')}</span>
                      </div>
                    );
                  })}
                  <div className="border-t border-white/10 pt-2 space-y-1">
                    <div className="flex justify-between text-xs text-on-surface-variant/60">
                      <span>Subtotal</span>
                      <span>₹{subtotal.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-xs text-on-surface-variant/60">
                      <span>GST (18%)</span>
                      <span>₹{gstAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t border-white/5 pt-1">
                      <span className="text-on-surface-variant/80">Total</span>
                      <span className="text-performance-red">₹{totalAmount.toLocaleString('en-IN')}</span>
                    </div>
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
                  <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Advance Payment Amount (Optional)</label>
                  <input
                    type="number"
                    value={advanceAmount}
                    onChange={e => setAdvanceAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 1000"
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 font-data-sm"
                  />
                </div>
                {Number(advanceAmount) > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Payment Mode</label>
                      <select
                        value={advanceMode}
                        onChange={e => setAdvanceMode(e.target.value)}
                        className="w-full bg-black border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none"
                      >
                        {['cash', 'upi', 'card', 'bank_transfer', 'cheque'].map(m => (
                          <option key={m} value={m}>{m.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest block mb-1">Reference No.</label>
                      <input
                        type="text"
                        value={advanceRef}
                        onChange={e => setAdvanceRef(e.target.value)}
                        placeholder="Txn ID / Ref"
                        className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 font-data-sm"
                      />
                    </div>
                  </div>
                )}
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

      {/* Autocomplete Datalists */}
      <datalist id="brands-datalist">
        {carDataset.map(item => (
          <option key={item.brand} value={item.brand} />
        ))}
      </datalist>

      <datalist id="models-datalist">
        {modelSuggestions.map(model => (
          <option key={model} value={model} />
        ))}
      </datalist>

      <datalist id="colors-datalist">
        {basicColors.map(color => (
          <option key={color} value={color} />
        ))}
      </datalist>
    </div>
  );
}
