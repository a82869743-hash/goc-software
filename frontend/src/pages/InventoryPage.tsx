import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryAPI, InventoryItem, InventoryUsage } from '../api/inventory';
import toast from 'react-hot-toast';

const CATS = ['All', 'ppf_roll', 'ceramic', 'primer', 'car_care', 'consumable'];
const CAT_LABELS: Record<string, string> = {
  ppf_roll: 'PPF',
  ceramic: 'Ceramic',
  primer: 'Primer',
  car_care: 'Car Care',
  consumable: 'Consumables',
};

// Premium Stock Level Indicator
function StockBar({ qty, min }: { qty: number; min: number }) {
  const pct = Math.min((qty / (min * 3)) * 100, 100);
  const isLow = qty <= min;
  const isWrn = !isLow && qty < min * 1.5;
  const barColor = isLow 
    ? 'bg-gradient-to-r from-performance-red to-[#930000] shadow-[0_0_10px_rgba(255,43,43,0.5)]' 
    : isWrn 
    ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]' 
    : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]';
  const txtColor = isLow 
    ? 'text-performance-red font-bold animate-pulse' 
    : isWrn 
    ? 'text-amber-400' 
    : 'text-emerald-400';

  return (
    <div className="flex items-center gap-3 w-full max-w-[200px]">
      <div className="flex-1 h-2 bg-black/40 rounded-full border border-white/5 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`font-data-sm text-xs tabular-nums ${txtColor}`}>{qty}</span>
    </div>
  );
}

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'ledger' | 'ppf' | 'suggestions' | 'purchases'>('ledger');

  // Search and filter states
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('All');
  const [lowOnly, setLowOnly] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  // Form states
  const [newItemForm, setNewItemForm] = useState({
    name: '',
    category: 'ppf_roll' as any,
    brand: '',
    unit: 'sqft' as any,
    current_stock: 0,
    min_threshold: 10,
    purchase_price: 0,
    selling_price: 0,
    location: '',
    notes: '',
  });

  const [usageForm, setUsageForm] = useState({
    inventory_item_id: 0,
    qty_used: 0,
    wastage_qty: 0,
    notes: '',
  });

  const [purchaseForm, setPurchaseForm] = useState({
    inventory_item_id: 0,
    qty_added: 0,
    purchase_price: 0,
    supplier: '',
    purchase_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // API Queries
  const { data: inventoryRes, isLoading: isInventoryLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => inventoryAPI.list(),
  });
  const items = (inventoryRes?.data || []) as InventoryItem[];

  const { data: summaryRes } = useQuery({
    queryKey: ['inventorySummary'],
    queryFn: () => inventoryAPI.summary(),
  });
  const summary = summaryRes?.data;

  const { data: suggestionsRes } = useQuery({
    queryKey: ['reorderSuggestions'],
    queryFn: () => inventoryAPI.reorderSuggestions(),
    enabled: activeTab === 'suggestions',
  });
  const suggestions = suggestionsRes?.data || [];

  const { data: purchasesRes } = useQuery({
    queryKey: ['purchaseHistory'],
    queryFn: () => inventoryAPI.purchases(),
    enabled: activeTab === 'purchases',
  });
  const purchaseHistory = purchasesRes?.data || [];

  // Selected item details query
  const { data: selectedItemDetailRes } = useQuery({
    queryKey: ['inventoryItemDetail', selectedItemId],
    queryFn: () => inventoryAPI.getById(selectedItemId!),
    enabled: !!selectedItemId,
  });
  const activeDetailItem = selectedItemDetailRes?.data;

  // Mutations
  const createItemMutation = useMutation({
    mutationFn: (payload: any) => inventoryAPI.create(payload),
    onSuccess: () => {
      toast.success('Inventory SKU added successfully!');
      setShowAddModal(false);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventorySummary'] });
      setNewItemForm({
        name: '',
        category: 'ppf_roll',
        brand: '',
        unit: 'sqft',
        current_stock: 0,
        min_threshold: 10,
        purchase_price: 0,
        selling_price: 0,
        location: '',
        notes: '',
      });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to add inventory SKU');
    },
  });

  const recordUsageMutation = useMutation({
    mutationFn: (payload: any) => inventoryAPI.logUsage(payload),
    onSuccess: () => {
      toast.success('Stock usage registered successfully!');
      setShowUsageModal(false);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventorySummary'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryItemDetail', selectedItemId] });
      setUsageForm({ inventory_item_id: 0, qty_used: 0, wastage_qty: 0, notes: '' });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to register stock usage');
    },
  });

  const recordPurchaseMutation = useMutation({
    mutationFn: (payload: any) => inventoryAPI.recordPurchase(payload),
    onSuccess: () => {
      toast.success('Inward stock purchase logged successfully!');
      setShowPurchaseModal(false);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventorySummary'] });
      queryClient.invalidateQueries({ queryKey: ['purchaseHistory'] });
      setPurchaseForm({
        inventory_item_id: 0,
        qty_added: 0,
        purchase_price: 0,
        supplier: '',
        purchase_date: new Date().toISOString().split('T')[0],
        notes: '',
      });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to log inward stock');
    },
  });

  // Filter application
  const filtered = items.filter((i) => {
    const q = search.toLowerCase();
    const ms = !q || i.name.toLowerCase().includes(q) || i.item_code.toLowerCase().includes(q);
    const mc = cat === 'All' || i.category === cat;
    const ml = !lowOnly || i.current_stock <= i.min_threshold;
    return ms && mc && ml;
  });

  const lowCount = items.filter((i) => i.current_stock <= i.min_threshold).length;
  const stockVal = items.reduce((s, i) => s + i.current_stock * i.purchase_price, 0);

  const handleCommitNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    createItemMutation.mutate(newItemForm);
  };

  const handleCommitUsage = (e: React.FormEvent) => {
    e.preventDefault();
    if (usageForm.qty_used <= 0) {
      toast.error('Please input a valid quantity consumed');
      return;
    }
    recordUsageMutation.mutate(usageForm);
  };

  const handleCommitPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseForm.qty_added <= 0 || purchaseForm.purchase_price <= 0) {
      toast.error('Please input valid stock quantity and purchase price');
      return;
    }
    recordPurchaseMutation.mutate(purchaseForm);
  };

  return (
    <div className="space-y-8 relative z-10">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-[2px] bg-performance-red"></div>
            <span className="font-label-caps text-label-caps text-performance-red tracking-[0.3em] uppercase">
              Supply Telemetry System
            </span>
          </div>
          <h1 className="font-display-hero text-headline-lg text-white tracking-tight">
            Supply Telemetry
          </h1>
          <p className="font-body-lg text-body-lg text-tertiary mt-1.5 max-w-2xl">
            Real-time tracking of detailing consumables, roll lengths, and performance-critical safety thresholds.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-performance-red to-[#93000a] text-white hover:shadow-[0_0_25px_rgba(255,43,43,0.4)] transition-all font-label-caps text-label-caps tracking-wider flex items-center gap-2 active:scale-95 duration-300"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Register New SKU</span>
          </button>
        </div>
      </div>

      {/* OVERVIEW WIDGETS & PPF CHART ROW */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* KPI: Critical alerts (Col span 4) */}
        <div className="col-span-12 md:col-span-4 grid grid-cols-1 gap-6 h-full">
          <div className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 relative overflow-hidden group shadow-2xl flex flex-col justify-between min-h-[175px]">
            <div className="absolute top-0 right-0 w-48 h-48 bg-performance-red/[0.04] blur-[80px] rounded-full translate-x-1/4 -translate-y-1/4 transition-all duration-500 group-hover:bg-performance-red/[0.08]" />
            <div className="flex justify-between items-start">
              <h3 className="font-label-caps text-label-caps text-tertiary flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${lowCount > 0 ? 'bg-performance-red animate-ping' : 'bg-emerald-400 shadow-[0_0_8px_#10B981]'}`} />
                CRITICAL SHORTAGES
              </h3>
              <span className={`material-symbols-outlined ${lowCount > 0 ? 'text-performance-red animate-bounce' : 'text-emerald-400'}`}>
                {lowCount > 0 ? 'warning' : 'check_circle'}
              </span>
            </div>
            <div className="my-3 flex items-baseline gap-2">
              <span className={`font-display-hero text-[58px] font-black leading-none ${lowCount > 0 ? 'text-performance-red' : 'text-white'}`}>
                {String(lowCount).padStart(2, '0')}
              </span>
            </div>
            <p className="font-data-sm text-[10px] text-tertiary/60 uppercase tracking-widest">
              Active Depletion Alerts
            </p>
          </div>

          <div className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 relative overflow-hidden group shadow-2xl flex flex-col justify-between min-h-[175px]">
            <div className="flex justify-between items-start">
              <h3 className="font-label-caps text-label-caps text-tertiary flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10B981]" />
                ASSET VALUATION
              </h3>
              <span className="material-symbols-outlined text-emerald-400">payments</span>
            </div>
            <div className="my-3">
              <span className="font-display-hero text-[46px] font-black leading-none text-emerald-400 font-data-lg">
                ₹{(stockVal / 1000).toFixed(1)}K
              </span>
            </div>
            <p className="font-data-sm text-[10px] text-tertiary/60 uppercase tracking-widest">
              Total In-Stock Outlay
            </p>
          </div>
        </div>

        {/* PPF Usage Velocity Chart Widget (Col span 8) */}
        <div className="col-span-12 md:col-span-8 bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-8 relative overflow-hidden group shadow-2xl flex flex-col justify-between min-h-[374px]">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="font-label-caps text-label-caps text-tertiary flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-performance-red shadow-[0_0_8px_rgba(255,43,43,0.6)]"></span>
                PPF Usage Velocity (7D)
              </h3>
            </div>
            <div className="px-3 py-1 bg-performance-red/10 border border-performance-red/20 rounded-lg">
              <span className="font-data-sm text-performance-red text-[11px] font-bold tracking-wider">
                +14% HANGER EFFICIENCY
              </span>
            </div>
          </div>

          {/* Graphical Bars */}
          <div className="h-36 w-full flex items-end gap-4 px-2 relative">
            <div className="flex-1 bg-white/5 hover:bg-performance-red/25 border-t border-white/10 rounded-t-lg h-[30%] transition-all duration-500 cursor-pointer" title="Monday: 30%" />
            <div className="flex-1 bg-white/5 hover:bg-performance-red/25 border-t border-white/10 rounded-t-lg h-[45%] transition-all duration-500 cursor-pointer" title="Tuesday: 45%" />
            <div className="flex-1 bg-white/5 hover:bg-performance-red/25 border-t border-white/10 rounded-t-lg h-[25%] transition-all duration-500 cursor-pointer" title="Wednesday: 25%" />
            <div className="flex-1 bg-white/5 hover:bg-performance-red/25 border-t border-white/10 rounded-t-lg h-[60%] transition-all duration-500 cursor-pointer" title="Thursday: 60%" />
            <div className="flex-1 bg-performance-red/10 border-x border-t border-performance-red/30 rounded-t-lg h-[80%] relative group" title="Friday (Today): 80%">
              <div className="absolute inset-0 bg-gradient-to-t from-performance-red/5 to-performance-red/35 rounded-t-lg" />
            </div>
            <div className="flex-1 bg-white/5 hover:bg-performance-red/25 border-t border-white/10 rounded-t-lg h-[50%] transition-all duration-500 cursor-pointer" title="Saturday: 50%" />
            <div className="flex-1 bg-performance-red/35 border-x border-t border-performance-red/60 rounded-t-lg h-[95%] relative" title="Sunday Peak: 95%">
              <div className="absolute inset-0 bg-gradient-to-t from-performance-red/20 to-performance-red/60 rounded-t-lg animate-pulse" />
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 font-data-sm text-[9px] text-performance-red tracking-widest font-bold whitespace-nowrap">
                PEAK
              </div>
            </div>
          </div>

          <div className="flex justify-between mt-4 px-2 text-tertiary/40 font-data-sm text-[10px] tracking-[0.2em]">
            <span>MON</span>
            <span>TUE</span>
            <span>WED</span>
            <span>THU</span>
            <span>FRI</span>
            <span>SAT</span>
            <span>SUN</span>
          </div>
        </div>
      </div>

      {/* Critical Stock Alert banner */}
      {lowCount > 0 && (
        <div className="bg-performance-red/5 border border-performance-red/20 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xl">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-performance-red text-2xl animate-bounce">
              notification_important
            </span>
            <p className="text-sm font-body-lg text-tertiary">
              <span className="font-bold text-white uppercase tracking-wider">{lowCount} Detailing Supplies</span> have dropped below safe safety margins. Replenish immediately to avoid technician bottlenecking.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setLowOnly(true);
              setActiveTab('ledger');
            }}
            className="px-4 py-2 rounded-xl bg-performance-red/10 border border-performance-red/30 hover:bg-performance-red/20 text-performance-red transition-all font-label-caps text-xs tracking-wider"
          >
            Review Restocks
          </button>
        </div>
      )}

      {/* TABS SELECTOR */}
      <div className="flex border-b border-white/5 gap-8 mb-4">
        <button
          onClick={() => {
            setActiveTab('ledger');
            setLowOnly(false);
          }}
          className={`pb-4 font-label-caps text-label-caps tracking-widest transition-all duration-300 relative ${
            activeTab === 'ledger'
              ? 'text-performance-red border-b-2 border-performance-red shadow-[0_4px_12px_rgba(255,43,43,0.15)] font-bold'
              : 'text-tertiary hover:text-white'
          }`}
        >
          STOCK LEDGER
        </button>
        <button
          onClick={() => setActiveTab('ppf')}
          className={`pb-4 font-label-caps text-label-caps tracking-widest transition-all duration-300 relative ${
            activeTab === 'ppf'
              ? 'text-performance-red border-b-2 border-performance-red shadow-[0_4px_12px_rgba(255,43,43,0.15)] font-bold'
              : 'text-tertiary hover:text-white'
          }`}
        >
          VISUAL PPF ROLLS
        </button>
        <button
          onClick={() => setActiveTab('suggestions')}
          className={`pb-4 font-label-caps text-label-caps tracking-widest transition-all duration-300 relative ${
            activeTab === 'suggestions'
              ? 'text-performance-red border-b-2 border-performance-red shadow-[0_4px_12px_rgba(255,43,43,0.15)] font-bold'
              : 'text-tertiary hover:text-white'
          }`}
        >
          REORDER RECOMMENDATIONS
        </button>
        <button
          onClick={() => setActiveTab('purchases')}
          className={`pb-4 font-label-caps text-label-caps tracking-widest transition-all duration-300 relative ${
            activeTab === 'purchases'
              ? 'text-performance-red border-b-2 border-performance-red shadow-[0_4px_12px_rgba(255,43,43,0.15)] font-bold'
              : 'text-tertiary hover:text-white'
          }`}
        >
          PURCHASE HISTORIES
        </button>
      </div>

      {/* TAB 1: LEDGER LIST */}
      {activeTab === 'ledger' && (
        <div className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
          {/* Filtering bar */}
          <div className="px-5 py-4 border-b border-white/5 flex items-center gap-4 bg-black/25 flex-wrap">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-tertiary/45 text-[18px]">
                search
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search description, bar code SKU..."
                className="w-64 bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-tertiary/40 focus:outline-none focus:border-performance-red/50 transition-all font-body-lg"
              />
            </div>

            {/* Cat chips list */}
            <div className="flex flex-wrap gap-1.5">
              {CATS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`px-3.5 py-2 rounded-xl text-[10px] font-label-caps uppercase tracking-widest transition-all duration-300 ${
                    cat === c
                      ? 'bg-performance-red/10 border border-performance-red/35 text-performance-red shadow-[0_0_12px_rgba(255,43,43,0.15)]'
                      : 'bg-white/5 border border-white/10 text-tertiary hover:text-white hover:bg-white/10'
                  }`}
                >
                  {c === 'All' ? 'All SKU Categories' : CAT_LABELS[c] || c}
                </button>
              ))}
            </div>

            <button
              onClick={() => setLowOnly(!lowOnly)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[10px] font-label-caps tracking-widest transition-all duration-300 ${
                lowOnly
                  ? 'bg-performance-red/10 border-performance-red/30 text-performance-red'
                  : 'border-white/10 text-tertiary hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">warning</span>
              <span>Low Stocks</span>
            </button>

            <div className="ml-auto text-xs text-tertiary/40 font-data-sm">
              {filtered.length} active assets tracked
            </div>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/35 text-tertiary/70 text-[10px] font-label-caps border-b border-white/5 uppercase tracking-widest">
                  <th className="py-4.5 px-6 font-normal">Reference ID</th>
                  <th className="py-4.5 px-6 font-normal">SKU Category</th>
                  <th className="py-4.5 px-6 font-normal">Asset Details</th>
                  <th className="py-4.5 px-6 font-normal">Current Telemetry Level</th>
                  <th className="py-4.5 px-6 font-normal text-right">Supplier Price</th>
                  <th className="py-4.5 px-6 font-normal text-right">Retail Rate</th>
                  <th className="py-4.5 px-6 font-normal">Hangar Location</th>
                  <th className="py-4.5 px-6 font-normal text-center">Quick Log Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-data-sm text-on-surface">
                {isInventoryLoading ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-tertiary/60 font-body-lg italic">
                      Acquiring database telemetry...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-tertiary/30 font-body-lg italic">
                      <span className="material-symbols-outlined text-4xl block mb-2 opacity-50">
                        inventory_2
                      </span>
                      NO INVENTORY SKUS REGISTERED UNDER SELECTIONS
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => {
                    const isLow = item.current_stock <= item.min_threshold;
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedItemId(item.id)}
                        className={`hover:bg-performance-red/[0.02] border-l-2 transition-all cursor-pointer group duration-300 ${
                          isLow ? 'bg-performance-red/[0.01] border-l-performance-red/60' : 'border-l-transparent'
                        }`}
                      >
                        <td className="py-4.5 px-6 text-tertiary/50 font-bold font-data-sm">
                          {item.item_code}
                        </td>
                        <td className="py-4.5 px-6">
                          <span className="px-2.5 py-0.5 rounded-lg bg-white/5 border border-white/5 text-[9px] text-tertiary font-label-caps uppercase tracking-wider font-bold">
                            {CAT_LABELS[item.category] || item.category}
                          </span>
                        </td>
                        <td className="py-4.5 px-6">
                          <p className="text-sm font-semibold text-white group-hover:text-performance-red transition-colors font-body-lg">
                            {item.name}
                          </p>
                          <p className="text-[10px] text-tertiary/50 mt-1 font-body-lg">
                            Metric unit: {item.unit}
                          </p>
                        </td>
                        <td className="py-4.5 px-6">
                          <StockBar qty={item.current_stock} min={item.min_threshold} />
                          {isLow && (
                            <p className="text-[9px] text-performance-red font-bold mt-1 uppercase tracking-wider animate-pulse font-data-sm">
                              ⚠ Below Safety Threshold ({item.min_threshold})
                            </p>
                          )}
                        </td>
                        <td className="py-4.5 px-6 text-right font-data-sm text-xs text-tertiary/60">
                          ₹{Number(item.purchase_price).toLocaleString('en-IN')}
                        </td>
                        <td className="py-4.5 px-6 text-right font-data-lg text-xs text-white font-bold">
                          ₹{Number(item.selling_price).toLocaleString('en-IN')}
                        </td>
                        <td className="py-4.5 px-6">
                          <p className="text-xs text-white font-medium font-body-lg">
                            {item.brand || 'No Brand Linked'}
                          </p>
                          <p className="text-[10px] text-tertiary/50 mt-1 font-body-lg">
                            {item.location || 'Unassigned Depot'}
                          </p>
                        </td>
                        <td className="py-4.5 px-6" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <button
                              type="button"
                              onClick={() => {
                                setUsageForm({ ...usageForm, inventory_item_id: item.id });
                                setShowUsageModal(true);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-performance-red hover:border-transparent text-white text-[10px] font-label-caps transition-all active:scale-95"
                            >
                              LOG DEDUCT
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPurchaseForm({
                                  ...purchaseForm,
                                  inventory_item_id: item.id,
                                  purchase_price: item.purchase_price,
                                });
                                setShowPurchaseModal(true);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-performance-red/10 border border-performance-red/35 hover:bg-performance-red hover:border-transparent text-white text-[10px] font-label-caps transition-all active:scale-95"
                            >
                              STOCK IN
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

      {/* TAB 2: VISUAL PPF ROLLS */}
      {activeTab === 'ppf' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items
            .filter((i) => i.category === 'ppf_roll')
            .map((roll) => {
              const pct = Math.min((roll.current_stock / (roll.min_threshold * 2)) * 100, 100);
              const isLow = roll.current_stock <= roll.min_threshold;
              return (
                <div
                  key={roll.id}
                  onClick={() => setSelectedItemId(roll.id)}
                  className={`bg-[#0c0c0c]/40 backdrop-blur-2xl border rounded-2xl p-6 hover:shadow-2xl transition-all duration-300 cursor-pointer relative overflow-hidden group ${
                    isLow ? 'border-performance-red/20' : 'border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-performance-red/[0.01] rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform duration-500"></div>

                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="px-2 py-0.5 rounded bg-performance-red/10 border border-performance-red/20 text-[9px] text-performance-red font-label-caps font-bold uppercase tracking-widest">
                        PPF ROLL SECURED
                      </span>
                      <h3 className="text-base font-bold text-white mt-2 group-hover:text-performance-red transition-colors font-body-lg">
                        {roll.name}
                      </h3>
                      <p className="font-data-sm text-[10px] text-tertiary/40 mt-1">{roll.item_code}</p>
                    </div>
                    <span className="material-symbols-outlined text-tertiary/40 text-2xl group-hover:text-performance-red transition-colors duration-300">
                      layers
                    </span>
                  </div>

                  {/* Progress remaining bar */}
                  <div className="space-y-2 mb-6">
                    <div className="flex justify-between text-[11px] font-data-sm text-tertiary/70">
                      <span>Remaining Roll Length</span>
                      <span className={isLow ? 'text-performance-red font-bold' : 'text-emerald-400 font-bold'}>
                        {roll.current_stock} / {roll.min_threshold * 2} sqft
                      </span>
                    </div>
                    <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isLow 
                            ? 'bg-gradient-to-r from-performance-red to-[#930000] shadow-[0_0_8px_rgba(255,43,43,0.5)]' 
                            : 'bg-emerald-400'
                        }`}
                        style={{ width: `${Math.max(5, pct)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5 font-data-sm text-xs">
                    <div>
                      <p className="text-tertiary/50">Retail Cost</p>
                      <p className="text-white font-bold mt-1 font-data-sm">₹{Number(roll.selling_price).toLocaleString('en-IN')}/sqft</p>
                    </div>
                    <div>
                      <p className="text-tertiary/50">Brand Maker</p>
                      <p className="text-white font-bold mt-1 font-body-lg">{roll.brand || 'No Brand'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* TAB 3: REORDER RECOMMENDATIONS */}
      {activeTab === 'suggestions' && (
        <div className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 md:p-8 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-label-caps text-sm text-tertiary tracking-wider uppercase">
              AI Projected Consumable Replenishments
            </h2>
            <span className="text-xs text-tertiary/50 font-data-sm">
              30-day projection calculation array
            </span>
          </div>

          {suggestions.length > 0 ? (
            <div className="space-y-4">
              {suggestions.map((s: any) => (
                <div
                  key={s.id}
                  className="bg-black/35 border border-white/5 hover:border-white/10 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300"
                >
                  <div className="space-y-1">
                    <span className="bg-performance-red/10 border border-performance-red/30 text-performance-red font-label-caps text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-widest animate-pulse">
                      CRITICAL MARGIN
                    </span>
                    <h3 className="text-white text-sm font-semibold mt-1.5 font-body-lg">{s.name}</h3>
                    <p className="text-xs text-tertiary/50 font-data-sm">
                      Code: {s.item_code} · Category: {CAT_LABELS[s.category] || s.category}
                    </p>
                    <p className="text-xs text-amber-400 font-medium mt-1 font-body-lg">
                      Reason: {s.reason}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-6 font-data-sm text-right text-xs">
                    <div>
                      <p className="text-tertiary/50">Current Stock</p>
                      <p className="text-white font-bold mt-1">{s.current_stock}</p>
                    </div>
                    <div>
                      <p className="text-tertiary/50">Suggested Qty</p>
                      <p className="text-emerald-400 font-bold mt-1">+{s.suggested_qty}</p>
                    </div>
                    <div>
                      <p className="text-tertiary/50">Est Qty Price</p>
                      <p className="text-white font-bold mt-1">₹{Number(s.estimated_cost).toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => {
                        setPurchaseForm({
                          ...purchaseForm,
                          inventory_item_id: s.id,
                          qty_added: s.suggested_qty,
                          purchase_price: s.estimated_cost / s.suggested_qty || 0,
                        });
                        setShowPurchaseModal(true);
                      }}
                      className="bg-gradient-to-r from-performance-red to-[#93000a] text-white hover:shadow-[0_0_20px_rgba(255,43,43,0.35)] px-4 py-2.5 rounded-xl text-xs font-label-caps flex items-center gap-1.5 active:scale-95 transition-all duration-300"
                    >
                      <span className="material-symbols-outlined text-sm">shopping_cart</span>
                      <span>Order Supply</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-tertiary/40 text-sm font-data-sm">
              <span className="material-symbols-outlined text-4xl block mb-2 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                check_circle
              </span>
              ALL STOCKS SECURED STABLE ABOVE MINIMUM SAFETY THRESHOLDS
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PURCHASE HISTORY INWARDS */}
      {activeTab === 'purchases' && (
        <div className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-white/5 bg-black/25">
            <h2 className="font-label-caps text-xs text-tertiary tracking-wider uppercase">
              Supplies Inward Journal Ledger
            </h2>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs font-data-sm text-on-surface">
              <thead>
                <tr className="bg-black/35 border-b border-white/5 text-tertiary/75 uppercase tracking-widest font-label-caps font-bold">
                  <th className="p-4.5 px-6">Purchase Inward Date</th>
                  <th className="p-4.5 px-6">Supply / SKU code</th>
                  <th className="p-4.5 px-6">Supplier Account</th>
                  <th className="p-4.5 px-6 text-right">Inward Qty</th>
                  <th className="p-4.5 px-6 text-right">Price per unit</th>
                  <th className="p-4.5 px-6 text-right">Outflow outlay</th>
                  <th className="p-4.5 px-6">Journal Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {purchaseHistory.length > 0 ? (
                  purchaseHistory.map((p: any) => (
                    <tr key={p.id} className="hover:bg-white/[0.01]">
                      <td className="p-4.5 px-6 text-tertiary/80">
                        {new Date(p.purchase_date).toLocaleDateString()}
                      </td>
                      <td className="p-4.5 px-6">
                        <span className="text-white font-bold font-body-lg">{p.item_name}</span>
                        <p className="text-[10px] text-tertiary/40 mt-1">{p.item_code}</p>
                      </td>
                      <td className="p-4.5 px-6 text-tertiary/70 font-body-lg">
                        {p.supplier || 'Generic Supplier'}
                      </td>
                      <td className="p-4.5 px-6 text-right text-emerald-400 font-bold">
                        +{p.qty_added}
                      </td>
                      <td className="p-4.5 px-6 text-right text-tertiary">
                        ₹{Number(p.purchase_price).toLocaleString('en-IN')}
                      </td>
                      <td className="p-4.5 px-6 text-right text-white font-bold font-data-lg">
                        ₹{(p.qty_added * p.purchase_price).toLocaleString('en-IN')}
                      </td>
                      <td className="p-4.5 px-6 text-tertiary/60 max-w-[200px] truncate font-body-lg">
                        {p.notes || '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-tertiary/30 italic font-body-lg">
                      No inward stock logs currently archived.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DETAIL LEDGER DRAWER SIDE PANEL */}
      {selectedItemId && activeDetailItem && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/75 backdrop-blur-md">
          <div className="absolute inset-0 z-0 bg-transparent" onClick={() => setSelectedItemId(null)} />
          <div className="bg-[#050505] border-l border-white/5 w-full max-w-xl h-full flex flex-col p-8 overflow-y-auto relative z-10 shadow-2xl custom-scrollbar">
            {/* Ambient background glow inside drawer */}
            <div className="absolute -top-32 -right-32 w-64 h-64 bg-performance-red/[0.03] blur-[120px] pointer-events-none"></div>

            <div className="flex justify-between items-start mb-8 border-b border-white/5 pb-5">
              <div>
                <span className="bg-performance-red/10 border border-performance-red/25 text-performance-red font-label-caps text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-widest">
                  SKU Telemetry Dossier
                </span>
                <h3 className="text-xl font-bold text-white mt-3 uppercase tracking-wide font-display-hero">
                  {activeDetailItem.name}
                </h3>
                <p className="font-data-sm text-xs text-tertiary/40 mt-1">SKU code: {activeDetailItem.item_code}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemId(null)}
                className="text-tertiary hover:text-white p-2 hover:bg-white/5 rounded-xl transition-all duration-300"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {/* Quick dashboard metrics */}
            <div className="grid grid-cols-3 gap-4 mb-8 text-xs font-data-sm">
              <div className="bg-white/[0.01] p-4 rounded-xl border border-white/5 shadow-inner">
                <span className="text-tertiary/60 block uppercase text-[9px] font-label-caps tracking-wider">ON HAND STOCK</span>
                <span className="text-white text-lg font-bold mt-1.5 block">
                  {activeDetailItem.current_stock} {activeDetailItem.unit}
                </span>
              </div>
              <div className="bg-white/[0.01] p-4 rounded-xl border border-white/5 shadow-inner">
                <span className="text-tertiary/60 block uppercase text-[9px] font-label-caps tracking-wider">MIN THRESHOLD</span>
                <span className="text-white text-lg font-bold mt-1.5 block">
                  {activeDetailItem.min_threshold} {activeDetailItem.unit}
                </span>
              </div>
              <div className="bg-white/[0.01] p-4 rounded-xl border border-white/5 shadow-inner">
                <span className="text-tertiary/60 block uppercase text-[9px] font-label-caps tracking-wider">STATUS STATUS</span>
                <span
                  className={`text-sm font-bold mt-1.5 block font-label-caps tracking-widest ${
                    activeDetailItem.current_stock <= activeDetailItem.min_threshold
                      ? 'text-performance-red animate-pulse font-extrabold'
                      : 'text-emerald-400'
                  }`}
                >
                  {activeDetailItem.current_stock <= activeDetailItem.min_threshold ? 'DEPLETED' : 'OPTIMAL'}
                </span>
              </div>
            </div>

            {/* Consumption detailed logs */}
            <div className="space-y-4 flex-1">
              <h4 className="font-label-caps text-xs text-tertiary tracking-wider uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-performance-red rounded-full"></span>
                Asset Consumption Logs
              </h4>

              <div className="space-y-3">
                {activeDetailItem.usage && activeDetailItem.usage.length > 0 ? (
                  activeDetailItem.usage.map((u: InventoryUsage) => (
                    <div
                      key={u.id}
                      className="bg-white/[0.01] border border-white/5 hover:border-white/10 p-4 rounded-xl flex justify-between items-center text-xs font-data-sm transition-all"
                    >
                      <div className="space-y-1">
                        <span className="text-performance-red font-bold font-data-lg text-sm">
                          -{u.qty_used} {activeDetailItem.unit}
                        </span>
                        {u.wastage_qty > 0 && (
                          <span className="text-xs text-amber-500 ml-2 font-data-sm">
                            (wastage: {u.wastage_qty})
                          </span>
                        )}
                        <p className="text-[10px] text-tertiary/50 font-body-lg mt-1">
                          Technician: {u.staff_name || 'Hangar Crew'} · {new Date(u.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1.5">
                        <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[9px] font-label-caps text-white font-bold tracking-widest uppercase">
                          {u.job_code || 'Manual deduction'}
                        </span>
                        <p className="text-[10px] text-tertiary/40 max-w-[160px] truncate font-body-lg">
                          {u.notes || 'No description logged'}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-tertiary/30 italic font-body-lg">
                    No active consumption logged against SKU record.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER NEW SKU */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md">
          <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl p-6 max-w-lg w-full relative shadow-2xl overflow-hidden">
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-performance-red/[0.04] blur-[60px] pointer-events-none" />
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-display-hero text-lg font-black text-white uppercase tracking-wider">
                Supply SKU Registration
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-tertiary hover:text-white p-1 hover:bg-white/5 rounded-lg transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCommitNewItem} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    SKU Description
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 3M Gloss PPF Roll"
                    value={newItemForm.name}
                    onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-white font-body-lg"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Category Group
                  </label>
                  <select
                    value={newItemForm.category}
                    onChange={(e) => setNewItemForm({ ...newItemForm, category: e.target.value as any })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-2.5 text-xs text-white font-body-lg"
                  >
                    {CATS.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c} className="bg-[#0c0c0c]">
                        {CAT_LABELS[c] || c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Brand Manufacturer
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 3M, XPEL"
                    value={newItemForm.brand}
                    onChange={(e) => setNewItemForm({ ...newItemForm, brand: e.target.value })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-white font-body-lg"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Telemetry Metric Unit
                  </label>
                  <select
                    value={newItemForm.unit}
                    onChange={(e) => setNewItemForm({ ...newItemForm, unit: e.target.value as any })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-2.5 text-xs text-white font-body-lg"
                  >
                    <option value="sqft" className="bg-[#0c0c0c]">Square Feet (sqft)</option>
                    <option value="ml" className="bg-[#0c0c0c]">Millilitres (ml)</option>
                    <option value="litre" className="bg-[#0c0c0c]">Litres</option>
                    <option value="units" className="bg-[#0c0c0c]">Units / Boxes</option>
                    <option value="rolls" className="bg-[#0c0c0c]">Rolls</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 font-data-sm text-xs">
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Initial Stock Level
                  </label>
                  <input
                    type="number"
                    value={newItemForm.current_stock}
                    onChange={(e) => setNewItemForm({ ...newItemForm, current_stock: Number(e.target.value) })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-2.5 text-white text-right"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Safety Warning Threshold
                  </label>
                  <input
                    type="number"
                    value={newItemForm.min_threshold}
                    onChange={(e) => setNewItemForm({ ...newItemForm, min_threshold: Number(e.target.value) })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-2.5 text-white text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 font-data-sm text-xs">
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Purchase price per unit (₹)
                  </label>
                  <input
                    type="number"
                    value={newItemForm.purchase_price}
                    onChange={(e) => setNewItemForm({ ...newItemForm, purchase_price: Number(e.target.value) })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-2.5 text-white text-right"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Retail Selling Price (₹)
                  </label>
                  <input
                    type="number"
                    value={newItemForm.selling_price}
                    onChange={(e) => setNewItemForm({ ...newItemForm, selling_price: Number(e.target.value) })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-2.5 text-white text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Warehouse Depot Loc
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Shelf A-3"
                    value={newItemForm.location}
                    onChange={(e) => setNewItemForm({ ...newItemForm, location: e.target.value })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-white font-body-lg"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Journal Reference Links
                  </label>
                  <input
                    type="text"
                    placeholder="External tracking URL..."
                    value={newItemForm.notes}
                    onChange={(e) => setNewItemForm({ ...newItemForm, notes: e.target.value })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-white font-body-lg"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-white/5 border border-white/10 py-2.5 rounded-xl text-xs font-label-caps text-tertiary hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createItemMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-performance-red to-[#93000a] py-2.5 rounded-xl text-xs font-label-caps text-white hover:shadow-[0_0_20px_rgba(255,43,43,0.3)] transition-all"
                >
                  {createItemMutation.isPending ? 'Registering SKU...' : 'Confirm Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LOG MANUAL CONSUMPTION USAGE */}
      {showUsageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md">
          <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl p-6 max-w-md w-full relative shadow-2xl overflow-hidden">
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-performance-red/[0.04] blur-[60px] pointer-events-none" />
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-display-hero text-lg font-black text-white uppercase tracking-wider">
                Log Stock Consumption
              </h3>
              <button
                type="button"
                onClick={() => setShowUsageModal(false)}
                className="text-tertiary hover:text-white p-1 hover:bg-white/5 rounded-lg transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCommitUsage} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 font-data-sm text-xs">
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Quantity Consumed
                  </label>
                  <input
                    type="number"
                    required
                    value={usageForm.qty_used}
                    onChange={(e) => setUsageForm({ ...usageForm, qty_used: Number(e.target.value) })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-3 text-xs text-white text-right font-data-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Scrap / Wastage Qty
                  </label>
                  <input
                    type="number"
                    value={usageForm.wastage_qty}
                    onChange={(e) => setUsageForm({ ...usageForm, wastage_qty: Number(e.target.value) })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-3 text-xs text-white text-right font-data-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                  Reference Project Notes
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Job Card GOC-JC-XXXX or monthly audit wastage"
                  value={usageForm.notes}
                  onChange={(e) => setUsageForm({ ...usageForm, notes: e.target.value })}
                  className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-white font-body-lg"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowUsageModal(false)}
                  className="flex-1 bg-white/5 border border-white/10 py-2.5 rounded-xl text-xs font-label-caps text-tertiary hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordUsageMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-performance-red to-[#93000a] py-2.5 rounded-xl text-xs font-label-caps text-white hover:shadow-[0_0_20px_rgba(255,43,43,0.3)] transition-all"
                >
                  {recordUsageMutation.isPending ? 'DEDUCTING...' : 'CONFIRM DEDUCTION'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INWARD STOCK PURCHASE JOURNAL */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md">
          <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl p-6 max-w-md w-full relative shadow-2xl overflow-hidden">
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-performance-red/[0.04] blur-[60px] pointer-events-none" />
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-display-hero text-lg font-black text-white uppercase tracking-wider">
                Log Inward Supply Stock
              </h3>
              <button
                type="button"
                onClick={() => setShowPurchaseModal(false)}
                className="text-tertiary hover:text-white p-1 hover:bg-white/5 rounded-lg transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCommitPurchase} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 font-data-sm text-xs">
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Inward Qty Added
                  </label>
                  <input
                    type="number"
                    required
                    value={purchaseForm.qty_added}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, qty_added: Number(e.target.value) })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-3 text-xs text-white text-right font-data-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Unit Purchase Price (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={purchaseForm.purchase_price}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, purchase_price: Number(e.target.value) })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-3 text-xs text-white text-right font-data-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Supplier Account Make
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 3M Vadodara Hub"
                    value={purchaseForm.supplier}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier: e.target.value })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-white font-body-lg"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Purchase Inward Date
                  </label>
                  <input
                    type="date"
                    required
                    value={purchaseForm.purchase_date}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, purchase_date: e.target.value })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-2.5 text-xs text-white font-data-sm focus:border-performance-red/50 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                  Reference Inward Notes
                </label>
                <input
                  type="text"
                  placeholder="Receipt voucher, invoice no..."
                  value={purchaseForm.notes}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                  className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-white font-body-lg"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowPurchaseModal(false)}
                  className="flex-1 bg-white/5 border border-white/10 py-2.5 rounded-xl text-xs font-label-caps text-tertiary hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordPurchaseMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-performance-red to-[#93000a] py-2.5 rounded-xl text-xs font-label-caps text-white hover:shadow-[0_0_20px_rgba(255,43,43,0.3)] transition-all"
                >
                  {recordPurchaseMutation.isPending ? 'LOGGING STOCK...' : 'CONFIRM STOCK IN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
