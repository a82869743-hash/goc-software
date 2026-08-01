import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryAPI, InventoryItem, InventoryUsage } from '../api/inventory';
import toast from 'react-hot-toast';
import apiClient from '../api/client';
import { usePermissions } from '../utils/usePermissions';

// Premium Stock Level Indicator
function StockBar({ qty, min, unit }: { qty: number; min: number; unit?: string }) {
  const pct = Math.min((qty / (min * 3)) * 100, 100);
  const isLow = qty <= min;
  const barColor = isLow 
    ? 'bg-gradient-to-r from-performance-red to-[#930000] shadow-[0_0_10px_rgba(255,43,43,0.5)]' 
    : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]';
  const txtColor = isLow 
    ? 'text-performance-red font-bold animate-pulse' 
    : 'text-emerald-400';
  const unitLabel = unit === 'sqft' ? 'sq ft' : unit === 'ml' ? 'ml' : unit === 'litre' ? 'L' : unit === 'rolls' ? 'rolls' : 'pcs';

  return (
    <div className="flex items-center gap-3 w-full max-w-[200px]">
      <div className="flex-1 h-2 bg-black/40 rounded-full border border-white/5 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`font-data-sm text-xs tabular-nums ${txtColor}`}>{qty} {unitLabel}</span>
    </div>
  );
}

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const { canDelete } = usePermissions();

  const [activeTab, setActiveTab] = useState<'ppf' | 'usages'>('ppf');

  // Search states
  const [search, setSearch] = useState('');

  // Scanning States
  const [showScanModal, setShowScanModal] = useState(false);
  const [extractedItems, setExtractedItems] = useState<any[] | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const handleScanBill = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsScanning(true);
      setExtractedItems(null);
      
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiClient.post('/inventory/scan-bill', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data && res.data.success) {
        toast.success('Purchase bill scanned successfully!');
        setExtractedItems(res.data.data.extracted_items);
        setShowScanModal(true);
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error?.message || 'Scanning failed');
    } finally {
      setIsScanning(false);
      e.target.value = '';
    }
  };

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Form states
  const [newBrandForm, setNewBrandForm] = useState<{
    name: string;
    category: InventoryItem['category'];
    unit: InventoryItem['unit'];
    current_stock: number | '';
    min_threshold: number | '';
    purchase_price: number | '';
  }>({
    name: '',
    category: 'ppf_roll',
    unit: 'sqft',
    current_stock: '',
    min_threshold: '',
    purchase_price: '',
  });

  const [usageForm, setUsageForm] = useState<{
    qty_used: number | '';
    manual_amount: number | '';
    deduction_mode: 'qty' | 'amount';
    notes: string;
  }>({
    qty_used: '',
    manual_amount: '',
    deduction_mode: 'qty',
    notes: '',
  });

  const [purchaseForm, setPurchaseForm] = useState<{
    qty_added: number | '';
  }>({
    qty_added: '',
  });

  // API Queries
  const { data: inventoryRes, isLoading: isInventoryLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => inventoryAPI.list(),
  });
  const items = (inventoryRes?.data || []) as InventoryItem[];

  // Show all categories in the table
  const ppfRolls = items;

  const { data: usagesRes, isLoading: isUsagesLoading } = useQuery({
    queryKey: ['usagesHistory'],
    queryFn: () => inventoryAPI.usages(),
  });
  const usagesList = usagesRes?.data || [];

  // Filtered PPF list based on search
  const filteredPPF = ppfRolls.filter((i) => {
    const q = search.toLowerCase();
    return !q || i.name.toLowerCase().includes(q) || i.item_code.toLowerCase().includes(q);
  });

  // Calculations
  const totalSqFeet = ppfRolls.reduce((sum, item) => sum + Number(item.current_stock), 0);
  const lowStockCount = ppfRolls.filter((item) => item.current_stock <= item.min_threshold).length;

  // Mutations
  const createBrandMutation = useMutation({
    mutationFn: (payload: any) => inventoryAPI.create(payload),
    onSuccess: () => {
      toast.success('PPF Brand registered successfully!');
      setShowAddModal(false);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setNewBrandForm({
        name: '',
        category: 'ppf_roll',
        unit: 'sqft',
        current_stock: '',
        min_threshold: '',
        purchase_price: '',
      });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to add PPF brand');
    },
  });

  const recordUsageMutation = useMutation({
    mutationFn: (payload: any) => inventoryAPI.logUsage(payload),
    onSuccess: () => {
      toast.success('Deduction logged successfully!');
      setShowUsageModal(false);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['usagesHistory'] });
      setUsageForm({ qty_used: '', manual_amount: '', deduction_mode: 'qty', notes: '' });
      setSelectedItem(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to register stock deduction');
    },
  });

  const recordPurchaseMutation = useMutation({
    mutationFn: (payload: any) => inventoryAPI.recordPurchase(payload),
    onSuccess: () => {
      toast.success('Stock addition logged successfully!');
      setShowPurchaseModal(false);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['usagesHistory'] });
      setPurchaseForm({ qty_added: '' });
      setSelectedItem(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to add stock');
    },
  });

  const handleCommitNewBrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandForm.name) {
      toast.error('Item Name is required.');
      return;
    }
    const payload = {
      name: newBrandForm.name,
      category: newBrandForm.category,
      brand: newBrandForm.name,
      unit: newBrandForm.unit,
      current_stock: newBrandForm.current_stock === '' ? 0 : Number(newBrandForm.current_stock),
      min_threshold: newBrandForm.min_threshold === '' ? 10 : Number(newBrandForm.min_threshold),
      purchase_price: newBrandForm.purchase_price === '' ? 0 : Number(newBrandForm.purchase_price),
      selling_price: 0,
      location: 'Main Hangar',
      notes: 'Added via inventory manager',
    };
    createBrandMutation.mutate(payload);
  };

  const handleCommitUsage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    let qty: number;
    if (usageForm.deduction_mode === 'amount') {
      const price = Number(selectedItem.purchase_price) || 1;
      if (usageForm.manual_amount === '' || Number(usageForm.manual_amount) <= 0) {
        toast.error('Please input a valid amount to deduct.');
        return;
      }
      qty = Number(usageForm.manual_amount) / price;
    } else {
      if (usageForm.qty_used === '' || Number(usageForm.qty_used) <= 0) {
        toast.error('Please input a valid quantity to deduct.');
        return;
      }
      qty = Number(usageForm.qty_used);
    }

    const payload = {
      inventory_item_id: selectedItem.id,
      qty_used: qty,
      manual_amount: usageForm.deduction_mode === 'amount' ? Number(usageForm.manual_amount) : undefined,
      wastage_qty: 0,
      notes: usageForm.notes || (usageForm.deduction_mode === 'amount' ? `Manual amount deduction: ₹${usageForm.manual_amount}` : 'Manual stock deduction'),
    };
    recordUsageMutation.mutate(payload);
  };

  const handleCommitPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (purchaseForm.qty_added === '' || Number(purchaseForm.qty_added) <= 0) {
      toast.error('Please input a valid quantity to add.');
      return;
    }
    const payload = {
      inventory_item_id: selectedItem.id,
      qty_added: Number(purchaseForm.qty_added),
      purchase_price: 0,
      supplier: 'Manual Stock In',
      purchase_date: new Date().toISOString().split('T')[0],
      notes: 'Manually added stock to brand rolls',
    };
    recordPurchaseMutation.mutate(payload);
  };

  return (
    <div className="space-y-8 relative z-10">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-[2px] bg-performance-red"></div>
            <span className="font-label-caps text-label-caps text-performance-red tracking-[0.3em] uppercase">
              PPF Inventory Manager
            </span>
          </div>
          <h1 className="font-display-hero text-headline-lg text-white tracking-tight">
            PPF Stock Ledger
          </h1>
          <p className="font-body-lg text-body-lg text-tertiary mt-1.5 max-w-2xl">
            Streamlined tracking of PPF film rolls in square feet with direct deductions and automated low-stock warnings.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="px-6 py-3 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] transition-all font-label-caps text-label-caps tracking-wider flex items-center gap-2 active:scale-95 duration-300 uppercase cursor-pointer select-none">
            <span className={`material-symbols-outlined text-[18px] ${isScanning ? 'animate-spin text-performance-red' : ''}`}>
              {isScanning ? 'sync' : 'document_scanner'}
            </span>
            <span>{isScanning ? 'SCANNING BILL...' : 'SCAN PURCHASE BILL'}</span>
            <input
              type="file"
              accept="image/*,.pdf"
              disabled={isScanning}
              onChange={handleScanBill}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-performance-red to-[#93000a] text-white hover:shadow-[0_0_25px_rgba(255,43,43,0.4)] transition-all font-label-caps text-label-caps tracking-wider flex items-center gap-2 active:scale-95 duration-300 border border-white/10 uppercase"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Add PPF Brand</span>
          </button>
        </div>
      </div>

      {/* OVERVIEW telemetry widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between min-h-[110px] shadow-lg">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-performance-red/30"></div>
          <p className="font-label-caps text-[10px] text-tertiary/60 tracking-widest uppercase">
            Total Film Available
          </p>
          <p className="font-display-hero text-3xl font-black text-white tracking-tight mt-2 italic">
            {totalSqFeet.toLocaleString()} <span className="text-xs not-italic font-normal text-tertiary/60">sq feet</span>
          </p>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between min-h-[110px] shadow-lg">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-performance-red/30"></div>
          <p className="font-label-caps text-[10px] text-tertiary/60 tracking-widest uppercase">
            Low Stock Brands
          </p>
          <p className="font-display-hero text-3xl font-black text-white tracking-tight mt-2 italic flex items-baseline gap-2">
            <span className={lowStockCount > 0 ? 'text-performance-red animate-pulse' : 'text-white'}>
              {lowStockCount}
            </span>
            <span className="text-xs not-italic font-normal text-tertiary/60">alerts active</span>
          </p>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between min-h-[110px] shadow-lg sm:col-span-2 lg:col-span-1">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-performance-red/30"></div>
          <p className="font-label-caps text-[10px] text-tertiary/60 tracking-widest uppercase">
            Tracked Brand Rolls
          </p>
          <p className="font-display-hero text-3xl font-black text-white tracking-tight mt-2 italic">
            {ppfRolls.length} <span className="text-xs not-italic font-normal text-tertiary/60">brands configured</span>
          </p>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex gap-6 border-b border-white/5 shrink-0 select-none mt-2">
        <button
          type="button"
          onClick={() => setActiveTab('ppf')}
          className={`pb-4 font-label-caps text-label-caps tracking-widest transition-all duration-300 relative shrink-0 ${
            activeTab === 'ppf'
              ? 'text-performance-red border-b-2 border-performance-red shadow-[0_4px_12px_rgba(255,43,43,0.15)] font-bold'
              : 'text-tertiary hover:text-white'
          }`}
        >
          PPF BRAND ROLLS
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('usages')}
          className={`pb-4 font-label-caps text-label-caps tracking-widest transition-all duration-300 relative shrink-0 ${
            activeTab === 'usages'
              ? 'text-performance-red border-b-2 border-performance-red shadow-[0_4px_12px_rgba(255,43,43,0.15)] font-bold'
              : 'text-tertiary hover:text-white'
          }`}
        >
          DEDUCTION LOGS
        </button>
      </div>

      {/* TAB 1: PPF BRAND ROLLS */}
      {activeTab === 'ppf' && (
        <div className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
          {/* Search bar */}
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between bg-black/25 flex-wrap gap-4">
            <div className="relative w-full sm:w-auto">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-tertiary/45 text-[18px]">
                search
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search PPF Brand or roll code..."
                className="w-full sm:w-64 bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder-tertiary/40 focus:outline-none focus:border-performance-red/50 transition-all font-body-lg"
              />
            </div>
            <div className="text-xs text-tertiary/40 font-data-sm">
              Showing {filteredPPF.length} of {ppfRolls.length} brands
            </div>
          </div>

          {/* Table list */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-black/35 text-tertiary/70 text-[10px] font-label-caps border-b border-white/5 uppercase tracking-widest">
                  <th className="py-4.5 px-6 font-normal">Roll Code</th>
                  <th className="py-4.5 px-6 font-normal">PPF Brand Name</th>
                  <th className="py-4.5 px-6 font-normal">Available Length</th>
                  <th className="py-4.5 px-6 font-normal">Low Stock Threshold</th>
                  <th className="py-4.5 px-6 font-normal">Date Registered</th>
                  <th className="py-4.5 px-6 font-normal text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-data-sm text-on-surface">
                {isInventoryLoading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-tertiary/60 font-body-lg italic">
                      Acquiring database telemetry...
                    </td>
                  </tr>
                ) : filteredPPF.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-tertiary/30 font-body-lg italic">
                      <span className="material-symbols-outlined text-4xl block mb-2 opacity-50">
                        layers
                      </span>
                      NO PPF BRAND ROLLS CONFIGURED
                    </td>
                  </tr>
                ) : (
                  filteredPPF.map((item) => {
                    const isLow = item.current_stock <= item.min_threshold;
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-performance-red/[0.01] border-l-2 transition-all group duration-300 ${
                          isLow ? 'bg-performance-red/[0.005] border-l-performance-red/60' : 'border-l-transparent'
                        }`}
                      >
                        <td className="py-4.5 px-6 text-tertiary/50 font-bold font-data-sm">
                          {item.item_code}
                        </td>
                        <td className="py-4.5 px-6">
                          <p className="text-sm font-semibold text-white font-body-lg">
                            {item.name}
                          </p>
                        </td>
                        <td className="py-4.5 px-6">
                          <StockBar qty={item.current_stock} min={item.min_threshold} />
                          {isLow && (
                            <span className="inline-block px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-performance-red/10 border border-performance-red/20 text-performance-red mt-1 animate-pulse">
                              ⚠ LOW STOCK WARNING
                            </span>
                          )}
                        </td>
                        <td className="py-4.5 px-6 font-data-sm text-xs text-white">
                          {item.min_threshold} sq feet
                        </td>
                        <td className="py-4.5 px-6 text-xs text-tertiary/60 font-data-sm">
                          {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-4.5 px-6">
                          <div className="flex justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedItem(item);
                                setShowUsageMutationDialog();
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-performance-red hover:border-transparent text-white text-[9px] font-label-caps transition-all active:scale-95 font-bold uppercase tracking-wider"
                            >
                              Deduct
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedItem(item);
                                setShowPurchaseMutationDialog();
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-performance-red/10 border border-performance-red/35 hover:bg-performance-red hover:border-transparent text-white text-[9px] font-label-caps transition-all active:scale-95 font-bold uppercase tracking-wider"
                            >
                              Add Stock
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: DEDUCTION LOGS */}
      {activeTab === 'usages' && (
        <div className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-white/5 bg-black/25">
            <h2 className="font-label-caps text-xs text-tertiary tracking-wider uppercase">
              PPF Material Deduction Journal
            </h2>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs font-data-sm text-on-surface min-w-[700px]">
              <thead>
                <tr className="bg-black/35 border-b border-white/5 text-tertiary/75 uppercase tracking-widest font-label-caps font-bold">
                  <th className="p-4.5 px-6 font-normal">Deduction Date</th>
                  <th className="p-4.5 px-6 font-normal">PPF Brand</th>
                  <th className="p-4.5 px-6 font-normal">Deducted Qty</th>
                  <th className="p-4.5 px-6 font-normal">Reference Event</th>
                  <th className="p-4.5 px-6 font-normal">Technician Name</th>
                  <th className="p-4.5 px-6 font-normal">Journal Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isUsagesLoading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-tertiary/60 font-body-lg italic">
                      Retrieving stock deduction telemetry...
                    </td>
                  </tr>
                ) : usagesList.length > 0 ? (
                  usagesList.map((u: any) => (
                    <tr key={u.id} className="hover:bg-white/[0.01]">
                      <td className="p-4.5 px-6 text-tertiary/80">
                        {new Date(u.created_at).toLocaleString()}
                      </td>
                      <td className="p-4.5 px-6">
                        <span className="text-white font-bold font-body-lg">{u.item_name || 'Generic PPF Roll'}</span>
                      </td>
                      <td className="p-4.5 px-6 text-performance-red font-bold font-data-lg text-sm">
                        -{u.total_deducted || u.qty_used} sq feet
                      </td>
                      <td className="p-4.5 px-6">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[8px] font-label-caps font-bold tracking-widest uppercase bg-white/5 border border-white/10 text-white">
                          {u.job_code || 'Manual Deduction'}
                        </span>
                      </td>
                      <td className="p-4.5 px-6 text-tertiary/70 font-body-lg">
                        {u.staff_name || 'Hangar Crew'}
                      </td>
                      <td className="p-4.5 px-6 text-tertiary/60 max-w-[200px] truncate font-body-lg">
                        {u.notes || '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-tertiary/30 italic font-body-lg">
                      No stock deductions currently logged.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD INVENTORY ITEM */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl p-6 max-w-md w-full relative shadow-2xl space-y-4">
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-performance-red/[0.04] blur-[60px] pointer-events-none" />
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-display-hero text-lg font-black text-white uppercase tracking-wider">
                Register Inventory Item
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-tertiary hover:text-white p-1 hover:bg-white/5 rounded-lg transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCommitNewBrand} className="space-y-4">
              <div>
                <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider font-bold">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. XPEL Ultimate Plus / Meguiar Ceramic Wax"
                  value={newBrandForm.name}
                  onChange={(e) => setNewBrandForm({ ...newBrandForm, name: e.target.value })}
                  className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-white font-body-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 font-data-sm text-xs">
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider font-bold">Category *</label>
                  <select
                    value={newBrandForm.category}
                    onChange={(e) => setNewBrandForm({ ...newBrandForm, category: e.target.value as InventoryItem['category'] })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                  >
                    <option value="ppf_roll">PPF Roll</option>
                    <option value="ceramic">Ceramic Coating</option>
                    <option value="primer">Primer / Prep</option>
                    <option value="car_care">Car Care Product</option>
                    <option value="consumable">Consumable</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider font-bold">Unit of Measurement *</label>
                  <select
                    value={newBrandForm.unit}
                    onChange={(e) => setNewBrandForm({ ...newBrandForm, unit: e.target.value as InventoryItem['unit'] })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                  >
                    <option value="sqft">Square Feet (sq ft)</option>
                    <option value="ml">Millilitres (ml)</option>
                    <option value="litre">Litres (L)</option>
                    <option value="units">Units / Pieces (pcs)</option>
                    <option value="rolls">Rolls</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 font-data-sm text-xs">
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider font-bold">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newBrandForm.current_stock}
                    onChange={(e) => setNewBrandForm({ ...newBrandForm, current_stock: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-2.5 text-white text-right"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider font-bold">
                    Low Stock Alert
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newBrandForm.min_threshold}
                    onChange={(e) => setNewBrandForm({ ...newBrandForm, min_threshold: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-2.5 text-white text-right"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider font-bold">
                    Unit Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newBrandForm.purchase_price}
                    onChange={(e) => setNewBrandForm({ ...newBrandForm, purchase_price: e.target.value === '' ? '' : Number(e.target.value) })}
                    placeholder="0"
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-2.5 text-white text-right"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-white/5 border border-white/10 py-2.5 rounded-xl text-xs font-label-caps text-tertiary hover:text-white transition-all font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBrandMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-performance-red to-[#93000a] py-2.5 rounded-xl text-xs font-label-caps text-white hover:shadow-[0_0_20px_rgba(255,43,43,0.3)] transition-all font-bold uppercase tracking-wider"
                >
                  {createBrandMutation.isPending ? 'Registering...' : 'Register Brand'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STOCK IN ADJUSTMENT */}
      {showPurchaseModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl p-6 max-w-sm w-full relative shadow-2xl">
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-performance-red/[0.04] blur-[60px] pointer-events-none" />
            <div className="flex justify-between items-center mb-6">
              <div className="space-y-1">
                <h3 className="font-display-hero text-lg font-black text-white uppercase tracking-wider">
                  Add Stock
                </h3>
                <p className="text-[10px] text-tertiary/50 font-body-lg">Brand: {selectedItem.name}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPurchaseModal(false);
                  setSelectedItem(null);
                }}
                className="text-tertiary hover:text-white p-1 hover:bg-white/5 rounded-lg transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCommitPurchase} className="space-y-4">
              <div>
                <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider font-bold">
                  Square Feet to Add *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={purchaseForm.qty_added}
                  onChange={(e) => setPurchaseForm({ qty_added: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-3 text-xs text-white text-right font-data-sm"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowPurchaseModal(false);
                    setSelectedItem(null);
                  }}
                  className="flex-1 bg-white/5 border border-white/10 py-2.5 rounded-xl text-xs font-label-caps text-tertiary hover:text-white transition-all font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordPurchaseMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-performance-red to-[#93000a] py-2.5 rounded-xl text-xs font-label-caps text-white hover:shadow-[0_0_20px_rgba(255,43,43,0.3)] transition-all font-bold uppercase tracking-wider"
                >
                  {recordPurchaseMutation.isPending ? 'Adding...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANUAL DEDUCTION ADJUSTMENT */}
      {showUsageModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl p-6 max-w-sm w-full relative shadow-2xl">
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-performance-red/[0.04] blur-[60px] pointer-events-none" />
            <div className="flex justify-between items-center mb-6">
              <div className="space-y-1">
                <h3 className="font-display-hero text-lg font-black text-white uppercase tracking-wider">
                  Deduct Stock
                </h3>
                <p className="text-[10px] text-tertiary/50 font-body-lg">Brand: {selectedItem.name}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUsageModal(false);
                  setSelectedItem(null);
                }}
                className="text-tertiary hover:text-white p-1 hover:bg-white/5 rounded-lg transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCommitUsage} className="space-y-4">
              {/* Mode toggle */}
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setUsageForm({ ...usageForm, deduction_mode: 'qty' })}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    usageForm.deduction_mode === 'qty'
                      ? 'bg-performance-red/20 border border-performance-red/40 text-performance-red'
                      : 'bg-white/5 border border-white/10 text-tertiary'
                  }`}
                >
                  By Quantity
                </button>
                <button
                  type="button"
                  onClick={() => setUsageForm({ ...usageForm, deduction_mode: 'amount' })}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    usageForm.deduction_mode === 'amount'
                      ? 'bg-performance-red/20 border border-performance-red/40 text-performance-red'
                      : 'bg-white/5 border border-white/10 text-tertiary'
                  }`}
                >
                  By Amount (₹)
                </button>
              </div>

              {usageForm.deduction_mode === 'qty' ? (
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider font-bold">
                    Quantity Used ({selectedItem?.unit || 'units'}) *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    value={usageForm.qty_used}
                    onChange={(e) => setUsageForm({ ...usageForm, qty_used: e.target.value === '' ? '' : Number(e.target.value) })}
                    placeholder={`Amount in ${selectedItem?.unit || 'units'}`}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-3 text-xs text-white text-right font-data-sm"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider font-bold">
                    Manual Deduction Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={usageForm.manual_amount}
                    onChange={(e) => setUsageForm({ ...usageForm, manual_amount: e.target.value === '' ? '' : Number(e.target.value) })}
                    placeholder="Enter rupee value used"
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-3 text-xs text-white text-right font-data-sm"
                  />
                  <p className="text-[10px] text-tertiary/40 mt-1">
                    {selectedItem?.purchase_price && usageForm.manual_amount
                      ? `≈ ${(Number(usageForm.manual_amount) / selectedItem.purchase_price).toFixed(2)} ${selectedItem.unit} @ ₹${selectedItem.purchase_price}/${selectedItem.unit}`
                      : 'Quantity calculated using item unit purchase price'}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider font-bold">
                  Deduction Notes / Event *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Job Card GOC-QJ-XXXX"
                  value={usageForm.notes}
                  onChange={(e) => setUsageForm({ ...usageForm, notes: e.target.value })}
                  className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-white font-body-lg"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowUsageModal(false);
                    setSelectedItem(null);
                  }}
                  className="flex-1 bg-white/5 border border-white/10 py-2.5 rounded-xl text-xs font-label-caps text-tertiary hover:text-white transition-all font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordUsageMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-performance-red to-[#93000a] py-2.5 rounded-xl text-xs font-label-caps text-white hover:shadow-[0_0_20px_rgba(255,43,43,0.3)] transition-all font-bold uppercase tracking-wider"
                >
                  {recordUsageMutation.isPending ? 'Deducting...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCAN BILL RESULT MODAL */}
      {showScanModal && extractedItems && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-[#0e0e0e] border border-white/10 rounded-3xl w-full max-w-lg p-6 relative overflow-hidden shadow-2xl space-y-4">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-performance-red"></div>
            
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-display-hero text-lg font-black text-white tracking-tight italic uppercase">
                  BILL SCANNER EXTRACTOR
                </h3>
                <p className="text-[10px] text-tertiary/50 font-label-caps tracking-widest uppercase">
                  AUTO-IMPORTED PURCHASE TELEMETRY
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowScanModal(false);
                  setExtractedItems(null);
                }}
                className="text-tertiary hover:text-white p-1 hover:bg-white/5 rounded-lg transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-on-surface-variant/80">
                The scanner successfully extracted the following items and updated the active inventory:
              </p>

              <div className="space-y-2.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                {extractedItems.map((item, idx) => (
                  <div key={idx} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-1 text-xs">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-white uppercase">{item.name}</span>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 font-label-caps">
                        {item.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 font-mono text-[10px] text-tertiary/60 pt-1">
                      <div>
                        <span className="block text-[8px] font-label-caps uppercase text-tertiary/40">ITEM CODE</span>
                        <span>{item.item_code}</span>
                      </div>
                      <div>
                        <span className="block text-[8px] font-label-caps uppercase text-tertiary/40">QTY ADDED</span>
                        <span>{item.qty_added} pcs</span>
                      </div>
                      <div>
                        <span className="block text-[8px] font-label-caps uppercase text-tertiary/40">PRICE</span>
                        <span>₹{Number(item.purchase_price).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                    <div className="text-[9px] text-tertiary/40 font-mono mt-1">
                      Supplier: {item.supplier}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowScanModal(false);
                setExtractedItems(null);
              }}
              className="w-full py-2.5 bg-gradient-to-r from-performance-red to-[#93000a] text-white rounded-xl text-xs font-label-caps tracking-widest font-bold border border-white/10 uppercase transition-all"
            >
              DONE
            </button>
          </div>
        </div>
      )}
    </div>
  );

  function setShowUsageMutationDialog() {
    setUsageForm({ qty_used: '', manual_amount: '', deduction_mode: 'qty', notes: '' });
    setShowUsageModal(true);
  }

  function setShowPurchaseMutationDialog() {
    setPurchaseForm({ qty_added: '' });
    setShowPurchaseModal(true);
  }
}
