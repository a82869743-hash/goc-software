import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { jobsAPI } from '../api/jobs';
import { customersAPI, vehiclesAPI } from '../api/customers';
import toast from 'react-hot-toast';
import { carDataset, basicColors } from '../utils/carDataset';

export default function QuickJobCards() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Lookup state
  const [lookupQuery, setLookupQuery] = useState('');
  const [activeField, setActiveField] = useState<'owner_name' | 'mobile' | 'reg_no' | null>(null);
  
  const { data: lookupRes } = useQuery({
    queryKey: ['customer-lookup-quick', lookupQuery],
    queryFn: () => customersAPI.search(lookupQuery),
    enabled: lookupQuery.length >= 2,
  });
  const lookupResults = lookupRes?.data || [];

  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);

  const renderAutocomplete = (fieldName: 'owner_name' | 'mobile' | 'reg_no') => {
    if (activeField !== fieldName || lookupQuery.length < 2 || lookupResults.length === 0) return null;
    return (
      <div className="absolute left-0 right-0 top-full mt-1 bg-[#111111] border border-white/10 rounded-xl overflow-hidden max-h-48 overflow-y-auto z-55 shadow-2xl font-data-sm text-left">
        {lookupResults.map((c: any) => (
          <div
            key={`${c.id}-${c.vehicle_id}`}
            onMouseDown={(e) => {
              e.preventDefault(); // prevents blur
              setCreateForm(prev => ({
                ...prev,
                owner_name: c.full_name,
                mobile: c.phone || '',
                reg_no: c.car_number || '',
                car_make: c.car_make || '',
                car_model: c.car_model || '',
                car_color: c.car_color || '',
                fuel_type: c.car_fuel_type || 'petrol',
                car_name: c.car_number ? `${c.car_make || ''} ${c.car_model || ''}`.trim() : prev.car_name,
              }));
              setSelectedCustomer({ id: c.id, full_name: c.full_name, phone: c.phone });
              if (c.vehicle_id) {
                setSelectedVehicle({ id: c.vehicle_id, make: c.car_make, model: c.car_model, reg_number: c.car_number });
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

  // Quick Service Create Form State
  const [createForm, setCreateForm] = useState({
    reg_no: '',
    owner_name: '',
    mobile: '',
    car_name: '',
    car_make: '',
    car_model: '',
    car_color: '',
    fuel_type: 'petrol',
    insurance_company: '',
    insurance_expiry: '',
    km_reading: '',
    notes: '',
  });

  const selectedBrandData = carDataset.find(
    item => item.brand.toLowerCase() === createForm.car_make.toLowerCase()
  );
  const modelSuggestions = selectedBrandData 
    ? selectedBrandData.models 
    : Array.from(new Set(carDataset.flatMap(item => item.models))).sort();

  const [servicePreset, setServicePreset] = useState<string>('Foam Wash');
  const [serviceName, setServiceName] = useState<string>('Foam Wash');
  const [serviceRate, setServiceRate] = useState<number | ''>(500);
  const [advanceAmount, setAdvanceAmount] = useState<number | ''>('');
  const [advanceMode, setAdvanceMode] = useState<string>('cash');
  const [advanceRef, setAdvanceRef] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleCreateQuickJobCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.mobile || !createForm.owner_name || !createForm.reg_no) {
      toast.error('Mobile, Owner Name, and Registration Number are required.');
      return;
    }
    if (!serviceName.trim()) {
      toast.error('Washing Service Name is required.');
      return;
    }
    if (serviceRate === '' || Number(serviceRate) < 0) {
      toast.error('Please enter a valid rate/amount.');
      return;
    }

    try {
      setSubmitting(true);
      let customerId = selectedCustomer?.id;
      let vehicleId = selectedVehicle?.id;

      // 1. Ensure customer is resolved
      if (!customerId) {
        const existingCustSearch = await customersAPI.list({ search: createForm.mobile });
        const matchedCust = existingCustSearch.data?.find((c: any) => c.phone === createForm.mobile);
        if (matchedCust) {
          customerId = matchedCust.id;
        } else {
          const newCust = await customersAPI.create({
            full_name: createForm.owner_name,
            phone: createForm.mobile,
            city: 'Vadodara',
            lead_source: 'walkin',
          });
          customerId = newCust.data.id;
        }
      }

      // 2. Ensure vehicle is resolved
      if (!vehicleId && createForm.reg_no) {
        const existingVehicles = await vehiclesAPI.list(customerId);
        const matchedVeh = existingVehicles.data?.find((v: any) => v.reg_number === createForm.reg_no);
        if (matchedVeh) {
          vehicleId = matchedVeh.id;
        } else {
          const newVeh = await vehiclesAPI.create({
            customer_id: customerId,
            make: createForm.car_make || 'Other',
            model: createForm.car_model || 'Other',
            reg_number: createForm.reg_no,
            year: new Date().getFullYear(),
            fuel_type: (createForm.fuel_type || 'petrol') as any,
            color: createForm.car_color || 'N/A',
            is_primary: true,
          });
          vehicleId = newVeh.data.id;
        }
      }

      // 3. Create standard job card with 'quick' type
      const jobRes = await jobsAPI.create({
        customer_id: customerId,
        vehicle_id: vehicleId,
        job_type: 'quick',
        advance_amount: advanceAmount === '' ? 0 : Number(advanceAmount),
        advance_payment_mode: advanceMode,
        advance_payment_ref: advanceRef || null,
        services: [{
          service_name: serviceName.trim(),
          service_type: 'other',
          package_tier: 'basic',
          unit_price: Number(serviceRate),
          quantity: 1,
          line_total: Number(serviceRate),
          tax_pct: 18,
          item_type: 'labor'
        }]
      } as any);

      if (jobRes.success) {
        toast.success('Quick Job Card created successfully!');
        queryClient.invalidateQueries({ queryKey: ['jobs'] });
        queryClient.invalidateQueries({ queryKey: ['jobs-pipeline'] });
        navigate(`/jobs/${jobRes.data.id}`);
      } else {
        toast.error('Failed to create Quick Job Card.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error?.message || 'Error occurred while creating Quick Job Card');
    } finally {
      setSubmitting(false);
    }
  };

  const WASH_PRESETS = [
    { service_name: 'Foam Wash', rate: 500 },
    { service_name: 'Ceramic Wash', rate: 800 },
    { service_name: 'Interior Cleaning', rate: 1500 },
    { service_name: 'Exterior Detailing', rate: 2500 },
    { service_name: 'Full Detailing', rate: 4000 },
    { service_name: 'Rubbing & Polish', rate: 3000 },
    { service_name: 'Engine Bay Cleaning', rate: 1000 },
    { service_name: 'AC Vent Sanitization', rate: 800 },
    { service_name: 'Headlight Restoration', rate: 1500 },
    { service_name: 'Ceramic Coating (Basic)', rate: 8000 },
    { service_name: 'Custom Service', rate: '' },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="font-display-hero text-headline-lg text-white mb-1 tracking-tight italic">
          QUICK SERVICE <span className="text-performance-red not-italic font-light">CREATOR</span>
        </h2>
        <p className="font-label-caps text-label-caps text-on-surface-variant/80 tracking-widest uppercase">
          Initialize foam wash or quick service ticket — God of Ceramic Premium Auto Studio
        </p>
      </div>

      <form onSubmit={handleCreateQuickJobCard} className="space-y-6">
        {/* Card 1: Client & Vehicle Credentials */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#0c0c0c]/40 backdrop-blur-2xl space-y-4 relative">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-performance-red shadow-[0_0_8px_#FF2B2B]"></span>
            01. Client &amp; Vehicle Credentials
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Contact Mobile *</label>
              <input
                type="text"
                required
                placeholder="e.g. 9876543210"
                value={createForm.mobile}
                onChange={(e) => {
                  setCreateForm(prev => ({ ...prev, mobile: e.target.value }));
                  setSelectedCustomer(null);
                  setSelectedVehicle(null);
                  setLookupQuery(e.target.value);
                }}
                onFocus={() => {
                  setActiveField('mobile');
                  setLookupQuery(createForm.mobile);
                }}
                onBlur={() => setTimeout(() => setActiveField(null), 200)}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50 font-mono"
              />
              {renderAutocomplete('mobile')}
            </div>

            <div className="relative">
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Client Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Amit Patel"
                value={createForm.owner_name}
                onChange={(e) => {
                  setCreateForm(prev => ({ ...prev, owner_name: e.target.value }));
                  setSelectedCustomer(null);
                  setLookupQuery(e.target.value);
                }}
                onFocus={() => {
                  setActiveField('owner_name');
                  setLookupQuery(createForm.owner_name);
                }}
                onBlur={() => setTimeout(() => setActiveField(null), 200)}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50"
              />
              {renderAutocomplete('owner_name')}
            </div>

            <div className="relative">
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">License Plate (Reg No) *</label>
              <input
                type="text"
                required
                placeholder="e.g. GJ-01-AB-1234"
                value={createForm.reg_no}
                onChange={(e) => {
                  const up = e.target.value.toUpperCase();
                  setCreateForm(prev => ({ ...prev, reg_no: up }));
                  setSelectedVehicle(null);
                  setLookupQuery(up);
                }}
                onFocus={() => {
                  setActiveField('reg_no');
                  setLookupQuery(createForm.reg_no);
                }}
                onBlur={() => setTimeout(() => setActiveField(null), 200)}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50 font-mono"
              />
              {renderAutocomplete('reg_no')}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Car Make</label>
                <input
                  type="text"
                  list="brands-datalist"
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
                  list="models-datalist"
                  placeholder="e.g. i20"
                  value={createForm.car_model}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, car_model: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Car Color</label>
              <input
                type="text"
                list="colors-datalist"
                placeholder="e.g. Black"
                value={createForm.car_color}
                onChange={(e) => setCreateForm(prev => ({ ...prev, car_color: e.target.value }))}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50"
              />
            </div>

            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Fuel Type</label>
              <select
                value={createForm.fuel_type}
                onChange={(e) => setCreateForm(prev => ({ ...prev, fuel_type: e.target.value }))}
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

        {/* Card 2: Washing Service Details */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#0c0c0c]/40 backdrop-blur-2xl space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-performance-red shadow-[0_0_8px_#FF2B2B]"></span>
            02. Washing Service Protocol
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Wash Preset</label>
              <select
                value={servicePreset}
                onChange={(e) => {
                  const presetName = e.target.value;
                  setServicePreset(presetName);
                  const preset = WASH_PRESETS.find(p => p.service_name === presetName);
                  if (preset) {
                    setServiceName(preset.service_name === 'Custom Wash' ? '' : preset.service_name);
                    setServiceRate(preset.rate as number | '');
                  }
                }}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none bg-black font-label-caps"
              >
                {WASH_PRESETS.map((p) => (
                  <option key={p.service_name} value={p.service_name} className="bg-[#0c0c0e]">
                    {p.service_name} {p.rate ? `(₹${p.rate})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Service Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Foam Wash"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50"
              />
            </div>

            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Washing Rate (INR) *</label>
              <input
                type="number"
                required
                placeholder="e.g. 500"
                value={serviceRate}
                onChange={(e) => setServiceRate(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Card 3: Advance Payment */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#0c0c0c]/40 backdrop-blur-2xl space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-performance-red shadow-[0_0_8px_#FF2B2B]"></span>
            03. Advance Payment (Optional)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Advance Amount Paid</label>
              <input
                type="number"
                placeholder="e.g. 1000 (leave empty if none)"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50 font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Payment Mode</label>
              <select
                value={advanceMode}
                onChange={(e) => setAdvanceMode(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none bg-black font-label-caps"
              >
                <option value="cash" className="bg-[#0c0c0e]">Cash</option>
                <option value="upi" className="bg-[#0c0c0e]">UPI / QR Scan</option>
                <option value="card" className="bg-[#0c0c0e]">Card Swipe</option>
                <option value="netbanking" className="bg-[#0c0c0e]">Net Banking</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Ref No. / Receipt ID</label>
              <input
                type="text"
                placeholder="e.g. Txn-12345"
                value={advanceRef}
                onChange={(e) => setAdvanceRef(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50"
              />
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="px-6 py-3 border border-white/10 rounded-xl text-xs text-gray-300 hover:bg-white/[0.06] transition-all font-label-caps tracking-widest uppercase"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="performance-gradient text-white px-8 py-3 rounded-xl font-label-caps text-xs flex items-center gap-1.5 transition-all group tracking-widest border border-white/10 uppercase font-bold disabled:opacity-40"
          >
            {submitting ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                Initializing...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">bolt</span>
                Initialize Quick Job Ticket
              </>
            )}
          </button>
        </div>
      </form>

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
