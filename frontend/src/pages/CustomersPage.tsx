import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersAPI, vehiclesAPI } from '../api/customers';
import { jobsAPI } from '../api/jobs';
import type { CustomerStatus, LeadSource, Customer, Vehicle } from '../types';
import toast from 'react-hot-toast';

const STATUS_CFG: Record<CustomerStatus, { label: string; color: string; bg: string; border: string }> = {
  vip: { label: 'VIP', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25 shadow-[0_0_10px_rgba(245,158,11,0.15)]', border: 'border-amber-500/20' },
  active: { label: 'Active', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25', border: 'border-emerald-500/20' },
  inactive: { label: 'Inactive', color: 'text-tertiary/40', bg: 'bg-white/5 border-white/5', border: 'border-white/5' },
};

const SOURCE_ICON: Record<LeadSource, string> = {
  instagram: 'photo_camera',
  facebook: 'thumb_up',
  whatsapp: 'chat_bubble',
  walkin: 'store',
  reference: 'group',
  other: 'more_horiz',
};

const JC_STAGE_CFG: Record<string, { label: string; bg: string; color: string }> = {
  scheduled: { label: 'Scheduled', bg: 'bg-blue-500/10 border border-blue-500/20', color: 'text-blue-400' },
  car_in: { label: 'Car In', bg: 'bg-indigo-500/10 border border-indigo-500/20', color: 'text-indigo-400' },
  washing: { label: 'Washing', bg: 'bg-purple-500/10 border border-purple-500/20', color: 'text-purple-400' },
  in_progress: { label: 'In Progress', bg: 'bg-amber-500/10 border border-amber-500/20', color: 'text-amber-400 animate-pulse' },
  qc: { label: 'QC Check', bg: 'bg-pink-500/10 border border-pink-500/20', color: 'text-pink-400' },
  ready: { label: 'Ready', bg: 'bg-emerald-500/10 border border-emerald-500/20', color: 'text-emerald-400 font-bold' },
  delivered: { label: 'Delivered', bg: 'bg-cyan-500/10 border border-cyan-500/20', color: 'text-cyan-400' },
};

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<number | null>(null);

  const handleDownloadInvoice = async (jobId: number) => {
    try {
      setDownloadingInvoiceId(jobId);
      const res = await jobsAPI.getInvoicePdf(jobId);
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
      setDownloadingInvoiceId(null);
    }
  };

  // Form states
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    alt_phone: '',
    email: '',
    dob: '',
    address: '',
    city: 'Vadodara',
    lead_source: 'walkin' as LeadSource,
    notes: '',
  });

  const [vehicleForm, setVehicleForm] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    fuel_type: 'petrol',
    color: '',
    reg_number: '',
    vin: '',
    is_primary: false,
    notes: '',
  });

  // Query customers with server search & status filter
  const { data: customersRes, isLoading } = useQuery({
    queryKey: ['customers', search, statusFilter],
    queryFn: () =>
      customersAPI.list({
        search: search || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
  });

  const customers = customersRes?.data || [];

  // Query single customer details (vehicles list)
  const { data: customerDetailRes, isLoading: isDetailLoading } = useQuery({
    queryKey: ['customerDetail', selectedCustomerId],
    queryFn: () => customersAPI.getById(selectedCustomerId!),
    enabled: selectedCustomerId !== null,
  });

  const customerDetail = customerDetailRes?.data;
  const vehicles = customerDetail?.vehicles || [];

  // Query vehicle service history
  const { data: vehicleHistoryRes, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['vehicleHistory', selectedVehicleId],
    queryFn: () => vehiclesAPI.getHistory(selectedVehicleId!),
    enabled: selectedVehicleId !== null,
  });

  const serviceHistory = vehicleHistoryRes?.data || [];

  // Create customer mutation
  const createMutation = useMutation({
    mutationFn: (payload: typeof form) => customersAPI.create(payload as any),
    onSuccess: () => {
      toast.success('Customer added successfully');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowAddModal(false);
      setForm({
        full_name: '',
        phone: '',
        alt_phone: '',
        email: '',
        dob: '',
        address: '',
        city: 'Vadodara',
        lead_source: 'walkin',
        notes: '',
      });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to add customer');
    },
  });

  // Create vehicle mutation
  const addVehicleMutation = useMutation({
    mutationFn: (payload: typeof vehicleForm) =>
      vehiclesAPI.create({
        ...payload,
        fuel_type: payload.fuel_type as any,
        customer_id: selectedCustomerId!,
      }),
    onSuccess: () => {
      toast.success('Vehicle added successfully');
      queryClient.invalidateQueries({ queryKey: ['customerDetail', selectedCustomerId] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowAddVehicle(false);
      setVehicleForm({
        make: '',
        model: '',
        year: new Date().getFullYear(),
        fuel_type: 'petrol',
        color: '',
        reg_number: '',
        vin: '',
        is_primary: false,
        notes: '',
      });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to add vehicle');
    },
  });

  // Update customer status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: CustomerStatus }) =>
      customersAPI.update(id, { status }),
    onSuccess: () => {
      toast.success('Customer status updated');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customerDetail', selectedCustomerId] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to update status');
    },
  });

  const totalRevenue = customers.reduce((s, c) => s + (Number(c.total_revenue) || 0), 0);
  const vipCount = customers.filter((c) => c.status === 'vip').length;

  const handleCustomerClick = (customerId: number) => {
    setSelectedCustomerId(customerId);
    setSelectedVehicleId(null); // Reset vehicle history when customer changes
    setShowAddVehicle(false);
  };

  const handleVehicleClick = (vehicleId: number) => {
    setSelectedVehicleId(vehicleId);
  };

  return (
    <div className="space-y-8 relative z-10 font-body-lg">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-[2px] bg-performance-red"></div>
            <span className="font-label-caps text-label-caps text-performance-red tracking-[0.3em] uppercase">
              CRM Engine v2.0
            </span>
          </div>
          <h1 className="font-display-hero text-headline-lg text-white tracking-tight">
            Client Registry
          </h1>
          <p className="font-body-lg text-body-lg text-tertiary mt-1.5 max-w-2xl">
            Active telemetry directory of GOC premium clients, vehicle logs, CRM history, and VIP segments.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-performance-red to-[#93000a] text-white hover:shadow-[0_0_25px_rgba(255,43,43,0.4)] transition-all font-label-caps text-label-caps tracking-wider flex items-center gap-2 active:scale-95 duration-300"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span>Add Premium Client</span>
          </button>
        </div>
      </div>

      {/* BENCHMARK KPI NUMBERS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Clients', value: customers.length, icon: 'group', color: 'text-white' },
          { label: 'VIP Status', value: `${vipCount} VIP`, icon: 'star', color: 'text-amber-400' },
          {
            label: 'Total Revenue Outlay',
            value: `₹${(totalRevenue / 100000).toFixed(1)}L`,
            icon: 'payments',
            color: 'text-emerald-400',
          },
          {
            label: 'Average Telemetry Outlay',
            value:
              customers.length > 0
                ? `₹${((totalRevenue / customers.length) / 1000).toFixed(0)}K`
                : '₹0K',
            icon: 'trending_up',
            color: 'text-blue-400',
          },
        ].map(({ label, value, icon, color }) => (
          <div
            key={label}
            className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-5 shadow-2xl flex items-center gap-4 group hover:border-white/10 transition-all duration-300"
          >
            <span className={`material-symbols-outlined text-[30px] ${color} opacity-80 group-hover:scale-105 transition-transform duration-300`}>
              {icon}
            </span>
            <div>
              <p className="text-[10px] text-tertiary/50 uppercase tracking-widest font-label-caps">{label}</p>
              <p className={`text-xl font-bold font-data-lg mt-0.5 ${color} tabular-nums`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* MASTER-DETAIL CRM GRID */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* LEFT PANEL: Customer Manifest Registry (Col span 7) */}
        <section className="col-span-12 lg:col-span-7 bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
          {/* Searching and Filter tabs */}
          <div className="px-5 py-4 border-b border-white/5 flex items-center gap-4 bg-black/25 flex-wrap">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-tertiary/45 text-[18px]">
                search
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, phone, GJ plate..."
                className="w-64 bg-white/5 border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-tertiary/40 font-body-lg"
              />
            </div>

            <div className="flex flex-wrap gap-1">
              {(['all', 'vip', 'active', 'inactive'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-label-caps uppercase tracking-widest transition-all duration-300 ${
                    statusFilter === s
                      ? 'bg-performance-red/10 border border-performance-red/35 text-performance-red shadow-[0_0_10px_rgba(255,43,43,0.15)] font-bold'
                      : 'bg-white/5 border border-white/10 text-tertiary hover:text-white'
                  }`}
                >
                  {s === 'all' ? 'ALL REGISTRY' : s}
                </button>
              ))}
            </div>

            <div className="ml-auto text-xs text-tertiary/40 font-data-sm">
              {customers.length} listings
            </div>
          </div>

          {/* Table manifest */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/35 text-tertiary/75 text-[10px] font-label-caps border-b border-white/5 uppercase tracking-widest">
                  <th className="py-4.5 px-6 font-normal">Customer Info</th>
                  <th className="py-4.5 px-6 font-normal">Contact Details</th>
                  <th className="py-4.5 px-6 font-normal">Linked Assets</th>
                  <th className="py-4.5 px-6 font-normal">Segment Status</th>
                  <th className="py-4.5 px-6 text-right font-normal">Total Revenue</th>
                  <th className="py-4.5 px-6 text-center font-normal">visits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-data-sm text-on-surface">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-tertiary/50 italic font-body-lg">
                      Acquiring CRM registry database...
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-tertiary/30 italic font-body-lg">
                      <span className="material-symbols-outlined text-4xl block mb-2 opacity-50">
                        group
                      </span>
                      NO CUSTOMER RECORDS MATCHING SEARCH PARAMETERS
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => {
                    const cfg = STATUS_CFG[c.status] || STATUS_CFG.active;
                    const isSelected = selectedCustomerId === c.id;
                    return (
                      <tr
                        key={c.id}
                        onClick={() => handleCustomerClick(c.id)}
                        className={`hover:bg-performance-red/[0.02] border-l-2 transition-all cursor-pointer group duration-300 ${
                          isSelected ? 'bg-performance-red/[0.04] border-l-performance-red shadow-inner' : 'border-l-transparent'
                        }`}
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-performance-red/40 to-[#690000] flex items-center justify-center text-[10px] font-bold text-white shadow-inner flex-shrink-0">
                              {c.full_name
                                .split(' ')
                                .map((w) => w[0])
                                .join('')
                                .slice(0, 2)}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-white group-hover:text-performance-red transition-colors font-body-lg">
                                {c.full_name}
                              </p>
                              <p className="text-[10px] font-data-sm text-tertiary/40 mt-0.5">
                                {c.customer_code}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-xs font-data-sm text-white font-bold">{c.phone}</p>
                          <p className="text-[10px] text-tertiary/50 mt-0.5 font-body-lg">{c.city}</p>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-[10px] text-tertiary bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg font-data-sm">
                            {c.vehicle_count || 0} Assets
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border text-[9px] font-label-caps uppercase tracking-wider ${cfg.bg}`}
                          >
                            {c.status === 'vip' && (
                              <span className="material-symbols-outlined text-[10px] text-amber-400">
                                star
                              </span>
                            )}
                            {cfg.label}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className="font-data-lg text-sm text-white font-bold">
                            ₹{Number(c.total_revenue || 0).toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center font-data-sm text-tertiary/60">
                          {c.total_visits || 0}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* RIGHT PANEL: Client Blueprint Dossier Viewer (Col span 5) */}
        <section className="col-span-12 lg:col-span-5 bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl flex flex-col overflow-hidden min-h-[500px] shadow-2xl">
          {selectedCustomerId === null ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-tertiary/20 h-full min-h-[460px]">
              <span className="material-symbols-outlined text-[54px] mb-2">badge</span>
              <h3 className="text-base font-bold text-white font-body-lg">No Client Selected</h3>
              <p className="text-sm max-w-xs mt-1.5 font-body-lg">
                Select any customer from the registry manifest to inspect linked assets, service history timeline, and manage CRM segments.
              </p>
            </div>
          ) : isDetailLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-tertiary/40 h-full min-h-[400px]">
              <span className="material-symbols-outlined animate-spin text-[32px] text-performance-red mb-2">
                sync
              </span>
              <p className="text-sm font-body-lg">Retrieving detailed customer dossier...</p>
            </div>
          ) : customerDetail ? (
            <div className="flex flex-col p-6 gap-6 overflow-y-auto max-h-[820px] custom-scrollbar relative">
              {/* Background glow inside dossier */}
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-performance-red/[0.03] blur-[120px] pointer-events-none" />

              {/* Dossier Header */}
              <div className="flex justify-between items-start border-b border-white/5 pb-5 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-performance-red/40 to-[#690000] border border-white/10 flex items-center justify-center text-sm font-bold text-white shadow-md shadow-performance-red/10">
                    {customerDetail.full_name
                      .split(' ')
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white leading-tight font-display-hero">
                      {customerDetail.full_name}
                    </h4>
                    <p className="text-xs font-data-sm text-tertiary/40 mt-1">
                      {customerDetail.customer_code}
                    </p>
                  </div>
                </div>

                {/* Status selector */}
                <div className="flex gap-0.5 bg-black/40 border border-white/10 p-0.5 rounded-lg shadow-inner">
                  {(['active', 'vip', 'inactive'] as CustomerStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => updateStatusMutation.mutate({ id: customerDetail.id, status: st })}
                      className={`px-2 py-1 rounded text-[9px] font-label-caps uppercase tracking-wider transition-all duration-300 ${
                        customerDetail.status === st
                          ? 'bg-white/10 text-white font-bold'
                          : 'text-tertiary/50 hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* CRM Info fields */}
              <div className="grid grid-cols-2 gap-4 bg-black/25 border border-white/5 rounded-2xl p-5 shadow-inner relative z-10">
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-tertiary/40 font-bold font-label-caps mb-1">
                    Phone Trace
                  </span>
                  <span className="text-xs font-data-sm text-white font-bold">
                    {customerDetail.phone || '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-tertiary/40 font-bold font-label-caps mb-1">
                    Secondary Phone
                  </span>
                  <span className="text-xs font-data-sm text-tertiary">
                    {customerDetail.alt_phone || '—'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="block text-[9px] uppercase tracking-wider text-tertiary/40 font-bold font-label-caps mb-1">
                    Email address
                  </span>
                  <span className="text-xs text-white break-all font-data-sm">
                    {customerDetail.email || '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-tertiary/40 font-bold font-label-caps mb-1">
                    Date of Birth
                  </span>
                  <span className="text-xs text-tertiary font-data-sm">
                    {customerDetail.dob
                      ? new Date(customerDetail.dob).toLocaleDateString('en-IN')
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-tertiary/40 font-bold font-label-caps mb-1">
                    Region City
                  </span>
                  <span className="text-xs text-tertiary font-body-lg">
                    {customerDetail.city || 'Vadodara'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="block text-[9px] uppercase tracking-wider text-tertiary/40 font-bold font-label-caps mb-1">
                    Full Address
                  </span>
                  <span className="text-xs text-tertiary/75 font-body-lg">
                    {customerDetail.address || '—'}
                  </span>
                </div>
                <div className="col-span-2 border-t border-white/5 pt-3.5 mt-1.5">
                  <span className="block text-[9px] uppercase tracking-wider text-tertiary/40 font-bold font-label-caps mb-1">
                    CRM Dossier Notes
                  </span>
                  <span className="text-xs text-tertiary/80 italic font-body-lg leading-relaxed">
                    "{customerDetail.notes || 'No detailing instructions logged for this customer.'}"
                  </span>
                </div>
              </div>

              {/* Linked Vehicles Sub-Section */}
              <div className="space-y-3 relative z-10">
                <div className="flex justify-between items-center">
                  <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-label-caps">
                    <span className="material-symbols-outlined text-[18px] text-performance-red">
                      directions_car
                    </span>
                    Assets ({vehicles.length})
                  </h5>
                  <button
                    type="button"
                    onClick={() => setShowAddVehicle(!showAddVehicle)}
                    className="text-[10px] px-3 py-1.5 rounded-lg bg-performance-red/10 border border-performance-red/25 text-performance-red hover:bg-performance-red hover:text-white transition-all font-semibold flex items-center gap-1 font-label-caps"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {showAddVehicle ? 'close' : 'add'}
                    </span>
                    {showAddVehicle ? 'CANCEL' : 'LINK VEHICLE'}
                  </button>
                </div>

                {/* Add Vehicle Inline Drawer */}
                {showAddVehicle && (
                  <div className="bg-black/35 border border-white/10 rounded-2xl p-4 flex flex-col gap-3 shadow-inner">
                    <p className="text-[10px] font-label-caps text-white border-b border-white/5 pb-1.5 tracking-wider uppercase font-bold">
                      Register Asset Configuration
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[9px] text-tertiary font-label-caps mb-1">Make *</label>
                        <input
                          type="text"
                          placeholder="e.g. BMW, Porsche"
                          value={vehicleForm.make}
                          onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })}
                          className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white font-body-lg placeholder:text-tertiary/20"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-tertiary font-label-caps mb-1">Model *</label>
                        <input
                          type="text"
                          placeholder="e.g. M3, 911"
                          value={vehicleForm.model}
                          onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                          className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white font-body-lg placeholder:text-tertiary/20"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-tertiary font-label-caps mb-1">Year</label>
                        <input
                          type="number"
                          value={vehicleForm.year}
                          onChange={(e) =>
                            setVehicleForm({
                              ...vehicleForm,
                              year: parseInt(e.target.value) || new Date().getFullYear(),
                            })
                          }
                          className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white font-data-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-tertiary font-label-caps mb-1">Fuel Type</label>
                        <select
                          value={vehicleForm.fuel_type}
                          onChange={(e) => setVehicleForm({ ...vehicleForm, fuel_type: e.target.value })}
                          className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-lg p-1.5 text-xs text-white font-body-lg"
                        >
                          <option value="petrol" className="bg-[#050505]">Petrol</option>
                          <option value="diesel" className="bg-[#050505]">Diesel</option>
                          <option value="ev" className="bg-[#050505]">EV</option>
                          <option value="hybrid" className="bg-[#050505]">Hybrid</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] text-tertiary font-label-caps mb-1">Body Color</label>
                        <input
                          type="text"
                          placeholder="e.g. Chalk Grey"
                          value={vehicleForm.color}
                          onChange={(e) => setVehicleForm({ ...vehicleForm, color: e.target.value })}
                          className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white font-body-lg placeholder:text-tertiary/20"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-tertiary font-label-caps mb-1">Plate Number *</label>
                        <input
                          type="text"
                          placeholder="GJ-06-XX-XXXX"
                          value={vehicleForm.reg_number}
                          onChange={(e) =>
                            setVehicleForm({ ...vehicleForm, reg_number: e.target.value.toUpperCase() })
                          }
                          className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white font-data-sm placeholder:text-tertiary/20"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[9px] text-tertiary font-label-caps mb-1">VIN (Chassis Number)</label>
                        <input
                          type="text"
                          placeholder="17-digit Chassis Number"
                          value={vehicleForm.vin}
                          onChange={(e) =>
                            setVehicleForm({ ...vehicleForm, vin: e.target.value.toUpperCase() })
                          }
                          className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white font-data-sm placeholder:text-tertiary/20"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[9px] text-tertiary font-label-caps mb-1">Notes</label>
                        <textarea
                          placeholder="e.g. Needs interior ceramic, minor panel scratches..."
                          value={vehicleForm.notes}
                          onChange={(e) => setVehicleForm({ ...vehicleForm, notes: e.target.value })}
                          className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl px-2.5 py-1.5 text-xs text-white font-body-lg placeholder:text-tertiary/20 h-16 resize-none"
                        />
                      </div>
                      <div className="col-span-2 flex items-center gap-2 mt-1 select-none">
                        <input
                          type="checkbox"
                          id="is_primary"
                          checked={vehicleForm.is_primary}
                          onChange={(e) => setVehicleForm({ ...vehicleForm, is_primary: e.target.checked })}
                          className="w-3.5 h-3.5 rounded bg-black border-white/10 text-performance-red focus:ring-0 accent-performance-red cursor-pointer"
                        />
                        <label
                          htmlFor="is_primary"
                          className="text-xs text-tertiary/75 cursor-pointer font-body-lg"
                        >
                          Set as primary vehicle for this client
                        </label>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t border-white/5 pt-3.5 mt-2">
                      <button
                        type="button"
                        onClick={() => addVehicleMutation.mutate(vehicleForm)}
                        disabled={
                          !vehicleForm.make ||
                          !vehicleForm.model ||
                          !vehicleForm.reg_number ||
                          addVehicleMutation.isPending
                        }
                        className="px-4 py-2 bg-gradient-to-r from-performance-red to-[#93000a] text-white rounded-xl text-xs font-label-caps tracking-wider uppercase hover:shadow-[0_0_15px_rgba(255,43,43,0.35)] disabled:opacity-40 transition-all"
                      >
                        {addVehicleMutation.isPending ? 'REGISTERING...' : 'REGISTER ASSET'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Renders customer vehicles cards */}
                {vehicles.length === 0 ? (
                  <div className="p-6 text-center text-tertiary/30 bg-black/15 border border-dashed border-white/5 rounded-2xl">
                    <span className="material-symbols-outlined text-[32px] opacity-35 mb-2 block">
                      no_cars
                    </span>
                    <p className="text-xs font-semibold text-tertiary/70 font-body-lg">
                      No vehicles linked
                    </p>
                    <p className="text-[10px] text-tertiary/40 mt-1 font-body-lg">
                      Register a vehicle to schedule detailing logs and check-ins.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {vehicles.map((v: Vehicle) => {
                      const isSelectedVeh = selectedVehicleId === v.id;
                      return (
                        <div
                          key={v.id}
                          onClick={() => handleVehicleClick(v.id)}
                          className={`flex justify-between items-center p-4 rounded-xl border cursor-pointer transition-all duration-300 ${
                            isSelectedVeh
                              ? 'bg-performance-red/5 border-performance-red/35 shadow-[0_0_15px_rgba(255,43,43,0.15)] shadow-inner'
                              : 'bg-white/[0.01] border-white/5 hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-[20px] text-tertiary/50">
                              directions_car
                            </span>
                            <div>
                              <p className="text-sm font-bold text-white font-body-lg">
                                {v.make} {v.model}
                              </p>
                              <p className="text-[10px] text-tertiary/60 font-data-sm mt-0.5">
                                {v.reg_number} · <span className="text-tertiary/40">{v.color || 'No Color'}</span>
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {v.is_primary && (
                              <span className="text-[8px] uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-label-caps font-bold">
                                PRIMARY
                              </span>
                            )}
                            <span className="text-[10px] font-data-sm text-tertiary/50">
                              {v.fuel_type} · {v.year}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Service Logs History */}
              {selectedVehicleId !== null && (
                <div className="border-t border-white/5 pt-5 relative z-10">
                  <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 mb-4 font-label-caps">
                    <span className="material-symbols-outlined text-[18px] text-performance-red">
                      history
                    </span>
                    Detailing Operations History
                  </h5>

                  {isHistoryLoading ? (
                    <div className="py-8 text-center text-tertiary/50 text-xs flex items-center justify-center gap-2 font-body-lg">
                      <span className="material-symbols-outlined animate-spin text-[16px] text-performance-red">
                        sync
                      </span>
                      Retrieving operational visit registers...
                    </div>
                  ) : serviceHistory.length === 0 ? (
                    <div className="p-6 text-center text-tertiary/30 bg-black/15 border border-white/5 rounded-2xl text-xs font-body-lg">
                      <span className="material-symbols-outlined text-2xl opacity-20 mb-1.5 block">
                        history_edu
                      </span>
                      No service visit history recorded for this asset.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {serviceHistory.map((jc: any) => {
                        const stage = JC_STAGE_CFG[jc.status] || {
                          label: jc.status,
                          bg: 'bg-white/5 border border-white/5',
                          color: 'text-tertiary',
                        };
                        return (
                          <div
                            key={jc.id}
                            className="bg-black/35 border border-white/5 rounded-2xl p-4 flex flex-col gap-3 shadow-inner"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-xs font-data-sm font-bold text-white">
                                  {jc.job_card_code}
                                </p>
                                <p className="text-[9px] text-tertiary/40 font-data-sm mt-1">
                                  {new Date(jc.created_at).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                              </div>
                              <span
                                className={`text-[8px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-lg ${stage.bg} ${stage.color}`}
                              >
                                {stage.label}
                              </span>
                            </div>

                            {/* Service Details items list */}
                            {jc.services && jc.services.length > 0 && (
                              <div className="border-y border-white/5 py-2 my-1 text-[11px] space-y-1 bg-black/10 rounded-lg p-2">
                                {jc.services.map((srv: any) => (
                                  <div key={srv.id} className="flex justify-between text-tertiary/75 font-body-lg">
                                    <span>· {srv.service_name}</span>
                                    <span className="font-data-sm text-tertiary/90">
                                      ₹{Number(srv.price || 0).toLocaleString('en-IN')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex justify-between items-center text-xs mt-1">
                              <div>
                                <p className="text-[9px] text-tertiary/40 uppercase font-label-caps tracking-wider">Assigned Specialist</p>
                                <p className="text-xs font-semibold text-tertiary mt-0.5 font-body-lg">
                                  {jc.technician_name || 'Not Allocated'}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-[11px] font-data-lg text-white font-bold">
                                  Total: ₹{Number(jc.total_amount || 0).toLocaleString('en-IN')}
                                </p>
                                {Number(jc.balance_due) > 0 && (
                                  <p className="text-[10px] font-data-sm text-performance-red font-bold animate-pulse mt-0.5">
                                    Due: ₹{Number(jc.balance_due).toLocaleString('en-IN')}
                                  </p>
                                )}
                              </div>
                            </div>
                            {jc.completion_type && (
                              <div className="flex justify-end pt-2 border-t border-white/5">
                                <button
                                  type="button"
                                  onClick={() => handleDownloadInvoice(jc.id)}
                                  disabled={downloadingInvoiceId === jc.id}
                                  className="text-[9px] font-label-caps tracking-wider text-performance-red hover:underline flex items-center gap-1 disabled:opacity-50"
                                >
                                  <span className="material-symbols-outlined text-[12px]">
                                    {downloadingInvoiceId === jc.id ? 'sync' : 'download'}
                                  </span>
                                  {downloadingInvoiceId === jc.id ? 'DOWNLOADING...' : `DOWNLOAD ${jc.completion_type.toUpperCase()}`}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </section>
      </div>

      {/* MODAL: CLIENT PROFILE REGISTRATION */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-[#0c0c0c] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Background glow inside modal */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-performance-red/[0.04] blur-[60px] pointer-events-none" />

            <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-black/25">
              <h3 className="text-lg font-black text-white flex items-center gap-2 font-display-hero uppercase tracking-wider">
                <span className="material-symbols-outlined text-performance-red">person_add</span>
                Client Profiling
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-tertiary hover:text-white p-1 hover:bg-white/5 rounded-lg transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="px-6 py-5 max-h-[480px] overflow-y-auto space-y-4 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[9px] text-tertiary font-label-caps uppercase tracking-wider mb-1.5">
                    Full Registered Name *
                  </label>
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl px-3.5 py-2.5 text-xs text-white font-body-lg placeholder:text-tertiary/20"
                    placeholder="e.g. Rahul Sharma"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-tertiary font-label-caps uppercase tracking-wider mb-1.5">
                    Primary Phone Number *
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl px-3.5 py-2.5 text-xs text-white font-data-sm placeholder:text-tertiary/20"
                    placeholder="10-digit mobile number"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-tertiary font-label-caps uppercase tracking-wider mb-1.5">
                    Secondary Phone Number
                  </label>
                  <input
                    type="text"
                    value={form.alt_phone}
                    onChange={(e) => setForm({ ...form, alt_phone: e.target.value })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl px-3.5 py-2.5 text-xs text-white font-data-sm placeholder:text-tertiary/20"
                    placeholder="Alternate contact"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[9px] text-tertiary font-label-caps uppercase tracking-wider mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl px-3.5 py-2.5 text-xs text-white font-data-sm placeholder:text-tertiary/20"
                    placeholder="clientname@example.com"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-tertiary font-label-caps uppercase tracking-wider mb-1.5">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={form.dob}
                    onChange={(e) => setForm({ ...form, dob: e.target.value })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-2 text-xs text-white font-data-sm"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-tertiary font-label-caps uppercase tracking-wider mb-1.5">
                    Region City
                  </label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl px-3.5 py-2.5 text-xs text-white font-body-lg"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[9px] text-tertiary font-label-caps uppercase tracking-wider mb-1.5">
                    Full Address Details
                  </label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl px-3.5 py-2.5 text-xs text-white font-body-lg placeholder:text-tertiary/20"
                    placeholder="House No, Society, Road details..."
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-tertiary font-label-caps uppercase tracking-wider mb-1.5">
                    CRM Lead Source
                  </label>
                  <select
                    value={form.lead_source}
                    onChange={(e) => setForm({ ...form, lead_source: e.target.value as LeadSource })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-2.5 text-xs text-white font-body-lg"
                  >
                    <option value="walkin" className="bg-[#0c0c0c]">Walk-in Depot</option>
                    <option value="instagram" className="bg-[#0c0c0c]">Instagram</option>
                    <option value="facebook" className="bg-[#0c0c0c]">Facebook</option>
                    <option value="whatsapp" className="bg-[#0c0c0c]">WhatsApp</option>
                    <option value="reference" className="bg-[#0c0c0c]">Reference</option>
                    <option value="other" className="bg-[#0c0c0c]">Other Channels</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[9px] text-tertiary font-label-caps uppercase tracking-wider mb-1.5">
                    CRM Requirements Notes
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-2xl px-3.5 py-2.5 text-xs text-white font-body-lg placeholder:text-tertiary/20 h-20 resize-none"
                    placeholder="Any detailing special requests, ceramic or PPF options prefer..."
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3 bg-black/20">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-white/10 rounded-xl text-sm text-tertiary hover:text-white hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createMutation.mutate(form)}
                disabled={!form.full_name || !form.phone || createMutation.isPending}
                className="px-5 py-2 bg-gradient-to-r from-performance-red to-[#93000a] text-white rounded-xl text-sm font-label-caps tracking-widest uppercase hover:shadow-[0_0_20px_rgba(255,43,43,0.35)] disabled:opacity-50 transition-all active:scale-95 duration-300"
              >
                {createMutation.isPending ? 'CREATING...' : 'SAVE PROFILE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
