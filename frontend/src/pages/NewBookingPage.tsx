import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { customersAPI, vehiclesAPI } from '../api/customers';
import { bookingsAPI } from '../api/bookings';
import type { LeadSource, Customer, Vehicle, TimeSlot, PackageTier, PaymentMode } from '../types';
import toast from 'react-hot-toast';
import { carDataset, basicColors } from '../utils/carDataset';

export default function NewBookingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Search customer states
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustResults, setShowCustResults] = useState(false);

  // Quick register states
  const [showAddCustomerInline, setShowAddCustomerInline] = useState(false);
  const [custForm, setCustForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    city: 'Vadodara',
    lead_source: 'walkin' as LeadSource,
  });

  const [showAddVehicleInline, setShowAddVehicleInline] = useState(false);
  const [vehForm, setVehForm] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    fuel_type: 'petrol',
    color: '',
    reg_number: '',
    is_primary: true,
  });

  const selectedBrandDataBooking = carDataset.find(
    item => item.brand.toLowerCase() === vehForm.make.toLowerCase()
  );
  const modelSuggestionsBooking = selectedBrandDataBooking 
    ? selectedBrandDataBooking.models 
    : Array.from(new Set(carDataset.flatMap(item => item.models))).sort();

  // Selected vehicle state
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  // Booking states
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | ''>('');
  const [serviceType, setServiceType] = useState('Ceramic Coating');
  const [packageTier, setPackageTier] = useState<PackageTier>('premium');
  const [estDuration, setEstDuration] = useState(4);
  const [advanceAmount, setAdvanceAmount] = useState(2000);
  const [advanceMode, setAdvanceMode] = useState<PaymentMode>('upi');
  const [notes, setNotes] = useState('');
  const [sendWhatsApp, setSendWhatsApp] = useState(true);

  // Autocomplete customer search query
  const { data: searchRes } = useQuery({
    queryKey: ['custSearch', customerSearch],
    queryFn: () => customersAPI.search(customerSearch),
    enabled: customerSearch.length >= 2,
  });

  const searchResults = searchRes?.data || [];

  // Query vehicles for selected customer
  const { data: vehiclesRes, isLoading: isVehLoading } = useQuery({
    queryKey: ['custVehicles', selectedCustomer?.id],
    queryFn: () => vehiclesAPI.list(selectedCustomer!.id),
    enabled: !!selectedCustomer,
  });

  const customerVehicles = vehiclesRes?.data || [];

  // Query slot availability check
  const { data: slotsRes, isLoading: isSlotsLoading } = useQuery({
    queryKey: ['bookingSlotsCheck', bookingDate],
    queryFn: () => bookingsAPI.slots(bookingDate),
    enabled: !!bookingDate,
  });

  const timingSlots = slotsRes?.data || [];

  // Create customer mutation
  const quickCustMutation = useMutation({
    mutationFn: (payload: typeof custForm) => customersAPI.create(payload as any),
    onSuccess: (res) => {
      toast.success('Customer registered successfully!');
      setSelectedCustomer(res.data);
      setShowAddCustomerInline(false);
      setCustomerSearch('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to create customer');
    },
  });

  // Create vehicle mutation
  const quickVehMutation = useMutation({
    mutationFn: (payload: typeof vehForm) =>
      vehiclesAPI.create({ ...payload, fuel_type: payload.fuel_type as any, customer_id: selectedCustomer!.id }),
    onSuccess: (res) => {
      toast.success('Vehicle registered successfully!');
      setSelectedVehicle(res.data);
      setShowAddVehicleInline(false);
      queryClient.invalidateQueries({ queryKey: ['custVehicles', selectedCustomer?.id] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to add vehicle');
    },
  });

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: (payload: any) => bookingsAPI.create(payload),
    onSuccess: () => {
      toast.success('Service booking logged and scheduled!');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      navigate('/bookings');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to register service booking');
    },
  });

  const handleSelectCustomer = async (item: Pick<Customer, 'id' | 'customer_code' | 'full_name' | 'phone'>) => {
    setSelectedCustomer(item as Customer);
    setSelectedVehicle(null); // Reset
    setShowCustResults(false);
    setCustomerSearch('');
  };

  const handleCommitBooking = () => {
    if (!selectedCustomer) {
      toast.error('Please select or create a customer profile');
      return;
    }
    if (!selectedVehicle) {
      toast.error('Please select or register a vehicle asset');
      return;
    }
    if (!bookingDate) {
      toast.error('Please specify the scheduling date');
      return;
    }
    if (!selectedSlot) {
      toast.error('Please select an available timing slot');
      return;
    }

    const payload = {
      customer_id: selectedCustomer.id,
      vehicle_id: selectedVehicle.id,
      booking_date: bookingDate,
      time_slot: selectedSlot,
      service_type: serviceType,
      package_tier: packageTier,
      est_duration_hrs: estDuration,
      advance_amount: advanceAmount,
      advance_mode: advanceAmount > 0 ? advanceMode : null,
      notes: notes || null,
    };

    createBookingMutation.mutate(payload);
  };

  return (
    <main className="ml-64 mt-16 min-h-screen p-6 flex flex-col gap-6">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Initiate New Service Booking</h2>
          <p className="text-gray-500 text-xs mt-0.5">Complete the scheduling sequence to book a detailing induction slot.</p>
        </div>
        <div className="px-3 py-1 bg-[#111111] rounded-full border border-white/10 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">SYSTEM ONLINE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Input sequencing */}
        <div className="lg:col-span-8 space-y-6">
          {/* Step 1: Customer Profile selector */}
          <section className="bg-[#111111] border border-white/[0.06] rounded-xl p-5 relative overflow-hidden flex flex-col gap-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[#CC0000]">person</span>
              01. Client Profile &amp; Asset
            </h3>

            {/* Search inputs */}
            {!selectedCustomer ? (
              <div className="flex flex-col gap-3 relative">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Search Existing Customers</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">search</span>
                  <input type="text" placeholder="Type client name or contact number..." value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustResults(true);
                    }}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-[#CC0000]/50" />
                </div>

                {/* Autocomplete popover */}
                {showCustResults && customerSearch.length >= 2 && (
                  <div className="absolute top-[68px] left-0 right-0 bg-[#181818] border border-white/[0.08] rounded-lg shadow-2xl z-40 max-h-48 overflow-y-auto">
                    {searchResults.length === 0 ? (
                      <div className="p-4 text-xs text-gray-600 italic">No customers matched your search query.</div>
                    ) : (
                      searchResults.map((item) => (
                        <div key={item.id} onClick={() => handleSelectCustomer(item)}
                          className="px-4 py-2.5 hover:bg-white/[0.04] cursor-pointer flex justify-between items-center border-b border-white/[0.03] transition-colors">
                          <div>
                            <p className="text-sm font-semibold text-white">{item.full_name}</p>
                            <p className="text-xs text-gray-500 font-mono">{item.phone}</p>
                          </div>
                          <span className="text-[10px] text-[#CC0000] font-mono font-bold uppercase">{item.customer_code}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.04]">
                  <span className="text-xs text-gray-600">First-time visitor client?</span>
                  <button onClick={() => setShowAddCustomerInline(true)}
                    className="text-xs px-3 py-1.5 rounded bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 active:scale-[0.98] transition-all">
                    Register Customer Profile
                  </button>
                </div>
              </div>
            ) : (
              /* Selected Customer Profile summary */
              <div className="bg-black/35 border border-white/[0.04] p-4 rounded-lg flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#CC0000]/20 border border-[#CC0000]/30 text-white flex items-center justify-center font-bold text-sm">
                    {selectedCustomer.full_name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{selectedCustomer.full_name}</h4>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{selectedCustomer.phone}</p>
                  </div>
                </div>
                <button onClick={() => {
                  setSelectedCustomer(null);
                  setSelectedVehicle(null);
                }} className="text-xs px-2.5 py-1 text-gray-400 hover:text-white bg-white/5 border border-white/10 rounded font-semibold transition-all">
                  Change
                </button>
              </div>
            )}

            {/* Quick register Customer Modal */}
            {showAddCustomerInline && (
              <div className="bg-[#181818] border border-white/5 rounded-lg p-4 flex flex-col gap-3">
                <p className="text-xs font-bold text-gray-300 uppercase tracking-wide border-b border-white/5 pb-1">Register New Customer Profile</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[10px] text-gray-500 mb-1">Full Name *</label>
                    <input type="text" placeholder="Rahul Sharma" value={custForm.full_name} onChange={(e) => setCustForm({ ...custForm, full_name: e.target.value })}
                      className="w-full bg-white/[0.03] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-[#CC0000]/40" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Primary Phone *</label>
                    <input type="text" placeholder="9876543210" value={custForm.phone} onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
                      className="w-full bg-white/[0.03] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-[#CC0000]/40" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Email</label>
                    <input type="email" placeholder="rahul@example.com" value={custForm.email} onChange={(e) => setCustForm({ ...custForm, email: e.target.value })}
                      className="w-full bg-white/[0.03] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-[#CC0000]/40" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-white/5 pt-2 mt-1">
                  <button onClick={() => setShowAddCustomerInline(false)} className="px-3 py-1 border border-white/10 text-xs rounded text-gray-400 hover:text-white">Cancel</button>
                  <button onClick={() => quickCustMutation.mutate(custForm)} disabled={!custForm.full_name || !custForm.phone || quickCustMutation.isPending}
                    className="px-3 py-1 bg-[#CC0000] text-white text-xs font-bold uppercase rounded hover:bg-[#a80000] disabled:opacity-40">
                    {quickCustMutation.isPending ? 'Registering...' : 'Register'}
                  </button>
                </div>
              </div>
            )}

            {/* Vehicle Selector (only shown if customer is selected) */}
            {selectedCustomer && (
              <div className="border-t border-white/[0.04] pt-4 mt-2">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Select Client Asset (Vehicle)</label>
                  <button onClick={() => setShowAddVehicleInline(!showAddVehicleInline)}
                    className="text-xs px-2.5 py-1 rounded bg-[#CC0000]/10 border border-[#CC0000]/30 text-[#ff4d4d] hover:bg-[#CC0000]/20 active:scale-[0.98] transition-all font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">{showAddVehicleInline ? 'close' : 'add'}</span>
                    {showAddVehicleInline ? 'Cancel' : 'New Vehicle'}
                  </button>
                </div>

                {/* Quick Add Vehicle Inline Form */}
                {showAddVehicleInline && (
                  <div className="bg-[#181818] border border-white/5 rounded-lg p-4 mb-4 flex flex-col gap-3">
                    <p className="text-xs font-bold text-gray-300 uppercase tracking-wide border-b border-white/5 pb-1">Register New Vehicle Asset</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Make *</label>
                        <input
                          type="text"
                          list="brands-datalist-booking"
                          placeholder="e.g. Porsche, BMW"
                          value={vehForm.make}
                          onChange={(e) => setVehForm({ ...vehForm, make: e.target.value })}
                          className="w-full bg-white/[0.03] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-[#CC0000]/40"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Model *</label>
                        <input
                          type="text"
                          list="models-datalist-booking"
                          placeholder="e.g. 911 GT3, Swift"
                          value={vehForm.model}
                          onChange={(e) => setVehForm({ ...vehForm, model: e.target.value })}
                          className="w-full bg-white/[0.03] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-[#CC0000]/40"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Reg Plate *</label>
                        <input
                          type="text"
                          placeholder="e.g. GJ-06-XX-XXXX"
                          value={vehForm.reg_number}
                          onChange={(e) => setVehForm({ ...vehForm, reg_number: e.target.value.toUpperCase() })}
                          className="w-full bg-white/[0.03] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-[#CC0000]/40"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Color</label>
                        <input
                          type="text"
                          list="colors-datalist-booking"
                          placeholder="e.g. Black"
                          value={vehForm.color}
                          onChange={(e) => setVehForm({ ...vehForm, color: e.target.value })}
                          className="w-full bg-white/[0.03] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-[#CC0000]/40"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t border-white/5 pt-2.5 mt-1">
                      <button onClick={() => setShowAddVehicleInline(false)} className="px-3 py-1.5 border border-white/10 text-xs rounded text-gray-400 hover:text-white">Cancel</button>
                      <button onClick={() => quickVehMutation.mutate(vehForm)} disabled={!vehForm.make || !vehForm.model || !vehForm.reg_number || quickVehMutation.isPending}
                        className="px-3.5 py-1.5 bg-[#CC0000] text-white text-xs font-bold uppercase rounded hover:bg-[#a80000] disabled:opacity-40">
                        {quickVehMutation.isPending ? 'Registering...' : 'Register'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Vehicles list render */}
                {isVehLoading ? (
                  <p className="text-xs text-gray-500 italic animate-pulse">Loading registered client vehicles...</p>
                ) : customerVehicles.length === 0 ? (
                  <div className="p-4 text-center text-xs bg-black/10 border border-white/5 rounded-lg text-gray-600 italic">No vehicles registered. Click New Vehicle to add one.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {customerVehicles.map((v) => {
                      const isSelected = selectedVehicle?.id === v.id;
                      return (
                        <div key={v.id} onClick={() => setSelectedVehicle(v)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-3 ${isSelected ? 'bg-[#CC0000]/5 border-[#CC0000]/30 shadow-md shadow-[#CC0000]/5 text-white' : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] text-gray-300'}`}>
                          <span className={`material-symbols-outlined text-[20px] ${isSelected ? 'text-[#CC0000]' : 'text-gray-600'}`}>directions_car</span>
                          <div>
                            <p className="text-xs font-bold">{v.make} {v.model}</p>
                            <p className="text-[10px] font-mono text-gray-500 mt-0.5">{v.reg_number}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Step 2: Date & Timing Scheduler */}
          <section className="bg-[#111111] border border-white/[0.06] rounded-xl p-5 relative overflow-hidden flex flex-col gap-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[#CC0000]">calendar_month</span>
              02. Service Scheduling &amp; Bay Slots
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Date Input */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Select Date *</label>
                <input type="date" value={bookingDate} onChange={(e) => {
                  setBookingDate(e.target.value);
                  setSelectedSlot('');
                }}
                  className="bg-white/[0.04] border border-white/[0.07] rounded-lg py-2.5 px-3.5 text-sm text-white focus:outline-none focus:border-[#CC0000]/50" />
              </div>

              {/* Slot Picker */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Available Bay timing Slots</label>
                {isSlotsLoading ? (
                  <p className="text-xs text-gray-500 italic animate-pulse py-3">Querying studio bay telemetry...</p>
                ) : timingSlots.length === 0 ? (
                  <p className="text-xs text-gray-600 italic py-3">Select a date to fetch slot lists.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {timingSlots.map((s) => {
                      const isOccupied = s.booked;
                      const isSelected = selectedSlot === s.slot;
                      return (
                        <button key={s.slot} disabled={isOccupied} onClick={() => setSelectedSlot(s.slot as TimeSlot)}
                          className={`py-2.5 px-3 rounded-lg border text-xs font-mono transition-all flex flex-col items-center justify-center leading-normal ${isSelected ? 'bg-[#CC0000]/10 border-[#CC0000]/50 text-white font-bold' : isOccupied ? 'bg-red-500/5 border-red-500/10 text-red-500/30 cursor-not-allowed' : 'bg-green-500/5 border-green-500/10 text-green-400 hover:bg-green-500/10'}`}>
                          <span>{s.slot}</span>
                          <span className="text-[8px] uppercase tracking-widest mt-0.5 opacity-70">{isOccupied ? 'Occupied' : 'Available'}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Step 3: Detailing Protocol / Package selection */}
          <section className="bg-[#111111] border border-white/[0.06] rounded-xl p-5 relative overflow-hidden flex flex-col gap-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[#CC0000]">local_car_wash</span>
              03. Service Protocol Selection
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Service Type</label>
                <select value={serviceType} onChange={(e) => setServiceType(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none focus:border-[#CC0000]/50">
                  <option value="Ceramic Coating">Ceramic Coating</option>
                  <option value="PPF Roll Installation">Paint Protection Film (PPF)</option>
                  <option value="Multi-Step Polish">Multi-Step Paint Polish</option>
                  <option value="Interior Deep Cleaning">Interior Deep Cleaning</option>
                  <option value="Premium Wash & Wax">Premium Wash &amp; Wax</option>
                  <option value="Glass Coating & Treatment">Glass Coating &amp; Treatment</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Estimated Duration (Hours)</label>
                <input type="number" min={1} value={estDuration} onChange={(e) => setEstDuration(parseInt(e.target.value) || 1)}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none focus:border-[#CC0000]/50 font-mono" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2">Package Tier Options</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'basic', title: 'Basic Wash', desc: 'EXTERIOR RESTORATION', points: ['Standard Foam Wash', 'Wheel Detailing', 'Tire Dressing'] },
                  { id: 'premium', title: 'Premium Detail', desc: 'IN/OUT RESTORATION', points: ['Full Standard Wash', 'Vacuum & Leather Conditioning', 'Paint Clay Bar Treatment', 'Spray Ceramic Sealant'] },
                  { id: 'elite', title: 'Elite Shield', desc: 'PAINT CORRECT & COAT', points: ['Premium Detail Included', 'Multi-Step Paint Correction', 'GOC Ceramic Coating (1Yr)', 'Glass Rain Repellent'] },
                ].map((tier) => {
                  const isSel = packageTier === tier.id;
                  return (
                    <div key={tier.id} onClick={() => setPackageTier(tier.id as PackageTier)}
                      className={`p-4 rounded-xl border cursor-pointer flex flex-col justify-between transition-all ${isSel ? 'bg-[#CC0000]/5 border-[#CC0000]/30 shadow-md shadow-[#CC0000]/5' : 'bg-white/[0.01] border-white/[0.05] hover:bg-white/[0.03]'}`}>
                      <div>
                        <h4 className={`text-xs font-bold ${isSel ? 'text-[#CC0000]' : 'text-white'}`}>{tier.title}</h4>
                        <p className="text-[8px] font-bold text-gray-500 tracking-wider mt-0.5">{tier.desc}</p>
                        <ul className="mt-3.5 space-y-1.5 text-[10px] text-gray-400">
                          {tier.points.map((p, i) => (
                            <li key={i} className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[10px] text-gray-500">check</span>
                              {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex justify-end mt-4 pt-2 border-t border-white/[0.03]">
                        <span className={`material-symbols-outlined text-[16px] ${isSel ? 'text-[#CC0000]' : 'text-gray-700'}`}>
                          {isSel ? 'radio_button_checked' : 'radio_button_unchecked'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Step 4: Advance Payments Ledger */}
          <section className="bg-[#111111] border border-white/[0.06] rounded-xl p-5 relative overflow-hidden flex flex-col gap-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[#CC0000]">payments</span>
              04. Deposit Authorization
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1.5">Advance Deposit (₹)</label>
                <input type="number" min={0} value={advanceAmount} onChange={(e) => setAdvanceAmount(parseInt(e.target.value) || 0)}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none focus:border-[#CC0000]/50 font-mono" />
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-2">Transaction Mode</label>
                <div className="flex gap-2">
                  {(['upi', 'cash', 'card', 'bank_transfer'] as const).map((mode) => {
                    const isSel = advanceMode === mode;
                    return (
                      <button key={mode} onClick={() => setAdvanceMode(mode)}
                        className={`flex-grow py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${isSel ? 'bg-[#CC0000]/10 border-[#CC0000]/30 text-[#ff4d4d]' : 'bg-white/[0.02] border-white/[0.06] text-gray-500 hover:text-gray-300'}`}>
                        {mode.replace('_', ' ')}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Special Booking Notes</label>
              <textarea placeholder="e.g. Paint defects detected on hood, needs extra clay bar correction, customer requested pickup..." value={notes} onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg py-2 px-3 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-[#CC0000]/50 h-20 resize-none" />
            </div>
          </section>
        </div>

        {/* Right Column (4 cols): Manifest Summary Recap */}
        <aside className="lg:col-span-4 sticky top-24">
          <div className="bg-[#111111] rounded-xl border border-white/5 shadow-2xl overflow-hidden flex flex-col relative before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/5 before:to-transparent before:pointer-events-none">
            {/* Header Image */}
            <div className="h-32 bg-[#0c0f0f] relative overflow-hidden border-b border-white/5">
              <div className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-luminosity" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBvzcW-mOB0xrNElfcq91dfW4rqyQCTKfEV3EThSc3Dbw_jXKud--jXhOQKGpz6V1oVnrgZvs1IgllFejvoekyvS5TKzMTj6VV7hQoIN01Whwf2DbAPns_uHq3qQnExG1rXryc0PF9vAJwl_x-zWTeTIqRmj34zBemLeDfbawaT-6LzynXWe6JIj3zaUcahYq7v7ckXoJstFgyDpKQpGOArAfcPYI5cYEYLNEReuVrS2e-y-1G-VPedHGDuRgSTuJYITLHzIOAi_SE0")' }}></div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#111111] to-transparent"></div>
              <div className="absolute bottom-4 left-4">
                <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">JOB MANIFEST</span>
              </div>
            </div>

            <div className="p-5 space-y-4 flex-1">
              {/* Client Asset Summary */}
              <div className="pb-4 border-b border-white/[0.04]">
                <p className="text-[9px] font-mono text-gray-500">ASSET REF: {selectedVehicle ? selectedVehicle.vehicle_code : 'AWAITING'}</p>
                <h4 className="text-sm font-bold text-white mt-0.5">{selectedVehicle ? `${selectedVehicle.make} ${selectedVehicle.model}` : 'Porsche 911 GT3 RS 2023'}</h4>
                <p className="text-xs text-gray-400 mt-0.5">Client: {selectedCustomer ? selectedCustomer.full_name : 'John Doe'}</p>
              </div>

              {/* Date slots summary */}
              <div className="pb-4 border-b border-white/[0.04] flex justify-between items-center">
                <div>
                  <p className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">Scheduled Date</p>
                  <p className="text-xs text-white font-medium flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-sm text-[#CC0000]">event</span>
                    {bookingDate ? new Date(bookingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Select Date'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">Timing Code</p>
                  <p className="text-xs font-mono text-white bg-white/5 px-2 py-0.5 rounded border border-white/5 mt-0.5 inline-block">
                    {selectedSlot ? `${selectedSlot} HRS` : 'AWAITING'}
                  </p>
                </div>
              </div>

              {/* Invoice lines */}
              <div className="space-y-2 pt-1.5 text-xs text-gray-400">
                <div className="flex justify-between items-center">
                  <span>Detaliing Pkg Tier:</span>
                  <span className="font-mono text-white capitalize">{packageTier}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Est Duration:</span>
                  <span className="font-mono text-white">{estDuration} Hours</span>
                </div>
                <div className="flex justify-between items-center text-sm pt-2 border-t border-white/[0.03]">
                  <span className="text-white font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-green-400">payments</span>
                    Advance Deposit paid
                  </span>
                  <span className="font-mono font-bold text-green-400">₹{advanceAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="pt-2 flex items-center gap-2">
                <input type="checkbox" id="send_whatsapp" checked={sendWhatsApp} onChange={(e) => setSendWhatsApp(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#CC0000]" />
                <label htmlFor="send_whatsapp" className="text-[10px] text-gray-400 uppercase tracking-wider cursor-pointer font-bold">Transmit WhatsApp Dispatch</label>
              </div>
            </div>

            {/* Commit Booking Action */}
            <div className="p-5 bg-[#181818] border-t border-white/5">
              <button onClick={handleCommitBooking} disabled={createBookingMutation.isPending}
                className="w-full bg-gradient-to-r from-[#CC0000] to-[#800000] text-white font-bold text-xs uppercase tracking-wider py-3 px-4 rounded-lg hover:shadow-[0_0_20px_rgba(204,0,0,0.3)] transition-all duration-300 flex justify-center items-center gap-2 group border border-[#CC0000]/50 active:scale-[0.98] disabled:opacity-40">
                <span className="material-symbols-outlined text-base group-hover:scale-110 transition-transform">bolt</span>
                {createBookingMutation.isPending ? 'COMMITTING TELEMETRY...' : 'COMMIT SCHEDULING'}
              </button>
              <p className="text-center text-[8px] text-gray-500 mt-3 font-mono uppercase tracking-widest">Awaiting Induction Authorization</p>
            </div>
          </div>
        </aside>
      </div>

      {/* Autocomplete Datalists */}
      <datalist id="brands-datalist-booking">
        {carDataset.map(item => (
          <option key={item.brand} value={item.brand} />
        ))}
      </datalist>

      <datalist id="models-datalist-booking">
        {modelSuggestionsBooking.map(model => (
          <option key={model} value={model} />
        ))}
      </datalist>

      <datalist id="colors-datalist-booking">
        {basicColors.map(color => (
          <option key={color} value={color} />
        ))}
      </datalist>
    </main>
  );
}
