import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesAPI, Invoice } from '../api/invoices';
import { paymentsApi } from '../api/payments';
import type { InvoiceStatus } from '../types';
import toast from 'react-hot-toast';

const STATUS_CFG: Record<InvoiceStatus, { label: string; color: string; bg: string; border: string }> = {
  draft: { label: 'Draft', color: 'text-tertiary/70', bg: 'bg-white/5 border-white/5', border: 'border-white/5' },
  sent: { label: 'Sent', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/25', border: 'border-blue-500/20' },
  partially_paid: { label: 'Partial', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25 shadow-[0_0_10px_rgba(245,158,11,0.15)]', border: 'border-amber-500/20' },
  paid: { label: 'Paid ✓', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25 shadow-[0_0_10px_rgba(16,185,129,0.15)]', border: 'border-emerald-500/20' },
  cancelled: { label: 'Cancelled', color: 'text-performance-red', bg: 'bg-performance-red/10 border-performance-red/25', border: 'border-performance-red/20' },
};

interface SplitPaymentLine {
  mode: string;
  amount: number;
  refNum: string;
}

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'directory' | 'aging'>('directory');

  // Directory filter states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');

  // Selected Invoice inspect details
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);

  // Split Payment Modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [splitLines, setSplitLines] = useState<SplitPaymentLine[]>([
    { mode: 'upi', amount: 0, refNum: '' },
  ]);
  const [paymentNotes, setPaymentNotes] = useState('');

  // GST Toggle State in Detail Inspector
  const [taxState, setTaxState] = useState<'intra' | 'inter'>('intra'); // intra = CGST+SGST, inter = IGST

  // API QUERIES
  const { data: invoicesRes, isLoading: isInvoiceLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesAPI.list(),
  });
  const invoices = invoicesRes?.data || [];

  const { data: outstandingRes } = useQuery({
    queryKey: ['outstandingAgeing'],
    queryFn: () => invoicesAPI.outstanding(),
    enabled: activeTab === 'aging',
  });
  const outstandingAgeing = outstandingRes?.data || { summary: {}, invoices: [] };

  const { data: invoiceDetailRes } = useQuery({
    queryKey: ['invoiceDetails', selectedInvoiceId],
    queryFn: () => invoicesAPI.getById(selectedInvoiceId!),
    enabled: !!selectedInvoiceId,
  });
  const activeInvoice = invoiceDetailRes?.data;

  // MUTATIONS
  const paymentMutation = useMutation({
    mutationFn: async (payloads: any[]) => {
      // Execute split payment transactions
      const promises = payloads.map((payload) => paymentsApi.recordPayment(payload));
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast.success('Split payments recorded successfully!');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['outstandingAgeing'] });
      queryClient.invalidateQueries({ queryKey: ['invoiceDetails', selectedInvoiceId] });
      setShowPaymentModal(false);
      setPaymentInvoice(null);
      setSplitLines([{ mode: 'upi', amount: 0, refNum: '' }]);
      setPaymentNotes('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to record split payments');
    },
  });

  const sendWhatsAppMutation = useMutation({
    mutationFn: (id: number) => invoicesAPI.sendWhatsApp(id),
    onSuccess: () => {
      toast.success('Tax invoice link dispatched via WhatsApp successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to dispatch WhatsApp broadcast');
    },
  });

  const generatePdfMutation = useMutation({
    mutationFn: (id: number) => invoicesAPI.generatePdf(id),
    onSuccess: (res) => {
      toast.success('Tax Invoice compiled successfully!');
      if (res.data?.pdf_url) {
        window.open(`http://localhost:4000${res.data.pdf_url}`, '_blank');
      }
      queryClient.invalidateQueries({ queryKey: ['invoiceDetails', selectedInvoiceId] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to compile tax invoice PDF');
    },
  });

  const updateInvoiceStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      invoicesAPI.update(id, { status }),
    onSuccess: () => {
      toast.success('Invoice status updated!');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoiceDetails', selectedInvoiceId] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to update invoice state');
    },
  });

  // Split payment helpers
  const addSplitLine = () => {
    setSplitLines([...splitLines, { mode: 'upi', amount: 0, refNum: '' }]);
  };

  const removeSplitLine = (idx: number) => {
    setSplitLines(splitLines.filter((_, i) => i !== idx));
  };

  const updateSplitLine = (idx: number, field: keyof SplitPaymentLine, val: any) => {
    const updated = [...splitLines];
    updated[idx] = { ...updated[idx], [field]: val };
    setSplitLines(updated);
  };

  const totalSplitAmount = splitLines.reduce((sum, l) => sum + Number(l.amount), 0);

  const handleRecordSplitPayment = (inv: Invoice) => {
    setPaymentInvoice(inv);
    setSplitLines([{ mode: 'upi', amount: Number(inv.balance_due), refNum: '' }]);
    setShowPaymentModal(true);
  };

  const handleCommitSplitPayments = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentInvoice) return;

    if (totalSplitAmount <= 0) {
      toast.error('Payment splits total must be greater than zero');
      return;
    }

    if (totalSplitAmount > Number(paymentInvoice.balance_due)) {
      toast.error(
        `Payments total (₹${totalSplitAmount.toLocaleString()}) exceeds invoice balance due (₹${Number(
          paymentInvoice.balance_due
        ).toLocaleString()})`
      );
      return;
    }

    const payloads = splitLines
      .filter((l) => l.amount > 0)
      .map((l) => ({
        invoice_id: paymentInvoice.id,
        amount: l.amount,
        payment_mode: l.mode,
        reference_number: l.refNum,
        notes: paymentNotes,
      }));

    paymentMutation.mutate(payloads);
  };

  // Filters calculation
  const filtered = invoices.filter((inv) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (inv.customer_name || '').toLowerCase().includes(q) ||
      inv.invoice_code.toLowerCase().includes(q) ||
      (inv.job_code || '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalBilled = invoices.reduce((s, i) => s + Number(i.total_amount || 0), 0);
  const totalCollected = invoices.reduce((s, i) => s + Number(i.amount_paid || 0), 0);
  const totalPending = invoices.reduce((s, i) => s + Number(i.balance_due || 0), 0);

  return (
    <div className="space-y-8 relative z-10 font-body-lg">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-[2px] bg-performance-red"></div>
            <span className="font-label-caps text-label-caps text-performance-red tracking-[0.3em] uppercase">
              Financial &amp; Ledger Control
            </span>
          </div>
          <h1 className="font-display-hero text-headline-lg text-white tracking-tight">
            Payments &amp; Billings
          </h1>
          <p className="font-body-lg text-body-lg text-tertiary mt-1.5 max-w-2xl">
            Compile professional tax invoices, monitor aging outstanding accounts, and balance ledger transactions.
          </p>
        </div>
      </div>

      {/* BENCHMARK KPI NUMBERS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Invoiced', value: `₹${(totalBilled / 1000).toFixed(1)}K`, icon: 'receipt_long', color: 'text-white' },
          { label: 'Revenue Collected', value: `₹${(totalCollected / 1000).toFixed(1)}K`, icon: 'payments', color: 'text-emerald-400' },
          { label: 'Outstanding Dues', value: `₹${(totalPending / 1000).toFixed(1)}K`, icon: 'pending_actions', color: 'text-amber-400' },
          {
            label: 'Collection Velocity',
            value: `${totalBilled > 0 ? ((totalCollected / totalBilled) * 100).toFixed(0) : '0'}%`,
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

      {/* Collection Gauge Indicator */}
      <div className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex justify-between items-center mb-2.5">
          <p className="text-[10px] font-label-caps text-tertiary/60 uppercase tracking-widest">
            Revenue Collection Velocity
          </p>
          <span className="text-xs font-data-sm text-white font-bold tabular-nums">
            {totalBilled > 0 ? ((totalCollected / totalBilled) * 100).toFixed(0) : 0}% Secured
          </span>
        </div>
        <div className="h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
          <div
            className="h-full bg-gradient-to-r from-performance-red to-emerald-400 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
            style={{ width: `${totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0}%` }}
          ></div>
        </div>
        <div className="flex justify-between mt-3 text-[10px] font-data-sm text-tertiary/50">
          <span>₹{totalCollected.toLocaleString('en-IN')} collected</span>
          <span>₹{totalPending.toLocaleString('en-IN')} pending reconciliation</span>
        </div>
      </div>

      {/* TABS CONTROLLER */}
      <div className="flex border-b border-white/5 gap-8 mb-4">
        <button
          onClick={() => setActiveTab('directory')}
          className={`pb-4 font-label-caps text-label-caps tracking-widest transition-all duration-300 relative ${
            activeTab === 'directory'
              ? 'text-performance-red border-b-2 border-performance-red shadow-[0_4px_12px_rgba(255,43,43,0.15)] font-bold'
              : 'text-tertiary hover:text-white'
          }`}
        >
          INVOICE DIRECTORY
        </button>
        <button
          onClick={() => setActiveTab('aging')}
          className={`pb-4 font-label-caps text-label-caps tracking-widest transition-all duration-300 relative ${
            activeTab === 'aging'
              ? 'text-performance-red border-b-2 border-performance-red shadow-[0_4px_12px_rgba(255,43,43,0.15)] font-bold'
              : 'text-tertiary hover:text-white'
          }`}
        >
          OUTSTANDING AGING JOURNAL
        </button>
      </div>

      {/* TAB 1: INVOICE DIRECTORY */}
      {activeTab === 'directory' && (
        <div className="grid grid-cols-12 gap-6 items-start">
          {/* LEFT: Invoices manifest list (Col span 5) */}
          <section className="col-span-12 lg:col-span-5 bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            {/* Searching Filters Toolbar */}
            <div className="p-4 md:p-5 border-b border-white/5 space-y-4 bg-black/25">
              <div className="flex items-center bg-white/5 border border-white/10 focus-within:border-performance-red/50 rounded-xl px-4 py-2.5 transition-all">
                <span className="material-symbols-outlined text-tertiary mr-2 text-[20px]">search</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search code, client name, GOC job..."
                  className="bg-transparent text-white w-full focus:outline-none text-sm font-body-lg placeholder:text-tertiary/40"
                />
              </div>

              {/* Status categories badges */}
              <div className="flex space-x-1 overflow-x-auto custom-scrollbar pb-1">
                {['all', 'draft', 'sent', 'partially_paid', 'paid', 'cancelled'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStatusFilter(tab as any)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-label-caps tracking-widest transition-all duration-300 uppercase whitespace-nowrap ${
                      statusFilter === tab
                        ? 'bg-performance-red/10 border border-performance-red/35 text-performance-red shadow-[0_0_10px_rgba(255,43,43,0.15)] font-bold'
                        : 'bg-white/5 border border-white/10 text-tertiary hover:text-white'
                    }`}
                  >
                    {tab === 'partially_paid' ? 'PARTIAL' : tab}
                  </button>
                ))}
              </div>
            </div>

            {/* List scrolling entries */}
            <div className="flex-1 overflow-y-auto max-h-[660px] min-h-[420px] custom-scrollbar divide-y divide-white/5">
              {isInvoiceLoading ? (
                <div className="p-8 text-center text-tertiary/50 italic font-body-lg">
                  Acquiring ledger invoices...
                </div>
              ) : filtered.length > 0 ? (
                filtered.map((inv) => {
                  const cfg = STATUS_CFG[inv.status] || STATUS_CFG.draft;
                  return (
                    <div
                      key={inv.id}
                      onClick={() => setSelectedInvoiceId(inv.id)}
                      className={`p-5 hover:bg-performance-red/[0.02] cursor-pointer transition-all duration-300 flex justify-between items-start border-l-4 ${
                        selectedInvoiceId === inv.id
                          ? 'bg-performance-red/[0.04] border-l-performance-red shadow-inner'
                          : 'border-l-transparent hover:border-l-white/10'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <p className="font-data-sm text-[12px] text-tertiary/60 font-bold">
                          {inv.invoice_code}
                        </p>
                        <p className="text-white text-sm font-semibold font-body-lg">
                          {inv.customer_name}
                        </p>
                        <p className="text-xs text-tertiary/50 font-data-sm">
                          Job Card: {inv.job_code || 'No Job linked'}
                        </p>
                      </div>
                      <div className="text-right space-y-2 flex flex-col items-end">
                        <p className="font-data-lg text-sm text-white font-bold">
                          ₹{inv.total_amount.toLocaleString('en-IN')}
                        </p>
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-[9px] font-label-caps font-bold tracking-wider ${cfg.color} ${cfg.bg} border ${cfg.border}`}
                        >
                          {cfg.label.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-tertiary/30 italic font-body-lg">
                  No invoices currently logged under directory filters.
                </div>
              )}
            </div>
          </section>

          {/* RIGHT: Detail View / Active Invoice Inspector (Col span 7) */}
          <section className="col-span-12 lg:col-span-7 bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl flex flex-col overflow-hidden min-h-[500px] shadow-2xl">
            {activeInvoice ? (
              <div className="flex-1 flex flex-col relative">
                <div className="absolute -top-32 -right-32 w-64 h-64 bg-performance-red/[0.03] blur-[120px] pointer-events-none" />

                {/* Details Header */}
                <div className="p-6 border-b border-white/5 bg-black/25 flex flex-wrap justify-between items-center gap-4 relative z-10">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-data-lg text-base text-performance-red font-bold">
                        {activeInvoice.invoice_code}
                      </span>
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[9px] font-label-caps font-bold uppercase tracking-wider ${
                          STATUS_CFG[activeInvoice.status]?.color
                        } ${STATUS_CFG[activeInvoice.status]?.bg}`}
                      >
                        {activeInvoice.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-tertiary/60 font-data-sm mt-1.5">
                      Invoice Compile Date: {new Date(activeInvoice.invoice_date).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {/* Status mutations */}
                    {activeInvoice.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() =>
                          updateInvoiceStatusMutation.mutate({ id: activeInvoice.id, status: 'sent' })
                        }
                        className="bg-amber-600 hover:bg-amber-700 hover:shadow-amber-600/10 text-white px-4 py-2 rounded-xl text-xs font-label-caps transition-all"
                      >
                        Mark as Sent
                      </button>
                    )}

                    {Number(activeInvoice.balance_due) > 0 && (
                      <button
                        type="button"
                        onClick={() => handleRecordSplitPayment(activeInvoice)}
                        className="bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-600/10 text-white px-4 py-2 rounded-xl text-xs font-label-caps flex items-center gap-1.5 transition-all"
                      >
                        <span className="material-symbols-outlined text-[16px]">payments</span>
                        <span>Record Payment</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => generatePdfMutation.mutate(activeInvoice.id)}
                      disabled={generatePdfMutation.isPending}
                      className="bg-white/5 border border-white/10 hover:bg-white/10 text-white px-3.5 py-2 rounded-xl text-xs font-label-caps flex items-center gap-1.5 transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                      <span>{generatePdfMutation.isPending ? 'COMPILING...' : 'PDF'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => sendWhatsAppMutation.mutate(activeInvoice.id)}
                      disabled={sendWhatsAppMutation.isPending}
                      className="bg-[#075E54]/15 border border-[#075E54]/30 hover:bg-[#075E54]/25 text-emerald-400 px-3.5 py-2 rounded-xl text-xs font-label-caps flex items-center gap-1.5 transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">chat</span>
                      <span>{sendWhatsAppMutation.isPending ? 'DISPATCHING...' : 'WHATSAPP'}</span>
                    </button>
                  </div>
                </div>

                {/* Detail Information Body scroll */}
                <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[580px] custom-scrollbar relative z-10">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/[0.01] border border-white/5 p-4 rounded-xl shadow-inner">
                      <h4 className="text-[10px] text-tertiary font-label-caps uppercase mb-2 tracking-wider">
                        Client Profile
                      </h4>
                      <p className="text-white text-sm font-semibold font-body-lg">
                        {activeInvoice.customer_name}
                      </p>
                      <p className="text-xs text-tertiary/60 font-data-sm mt-1">
                        Phone: {activeInvoice.customer_phone}
                      </p>
                      {activeInvoice.customer_gstin && (
                        <p className="text-xs text-performance-red font-data-sm mt-1">
                          GSTIN: {activeInvoice.customer_gstin}
                        </p>
                      )}
                    </div>

                    <div className="bg-white/[0.01] border border-white/5 p-4 rounded-xl shadow-inner">
                      <h4 className="text-[10px] text-tertiary font-label-caps uppercase mb-2 tracking-wider">
                        Active Job Card Asset
                      </h4>
                      <p className="text-white text-sm font-semibold font-data-sm">
                        #{activeInvoice.job_code || 'N/A'}
                      </p>
                      <p className="text-xs text-tertiary/60 font-data-sm mt-1.5">
                        Due Date:{' '}
                        {activeInvoice.due_date
                          ? new Date(activeInvoice.due_date).toLocaleDateString()
                          : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* GST Split Selector switcher */}
                  <div className="flex items-center justify-between p-3.5 bg-black/35 border border-white/5 rounded-xl shadow-inner">
                    <div className="text-xs">
                      <p className="text-white font-semibold font-body-lg">Taxes Mode Selector</p>
                      <p className="text-tertiary/40 text-[10px] font-body-lg">Toggling CGST+SGST vs Inter-state IGST</p>
                    </div>
                    <div className="flex bg-black/50 p-1 border border-white/10 rounded-xl shadow-inner">
                      <button
                        type="button"
                        onClick={() => setTaxState('intra')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-body-lg transition-all duration-300 ${
                          taxState === 'intra'
                            ? 'bg-performance-red text-white font-bold shadow-lg'
                            : 'text-tertiary/50 hover:text-white'
                        }`}
                      >
                        CGST + SGST (Intra-state)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaxState('inter')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-body-lg transition-all duration-300 ${
                          taxState === 'inter'
                            ? 'bg-performance-red text-white font-bold shadow-lg'
                            : 'text-tertiary/50 hover:text-white'
                        }`}
                      >
                        IGST (Inter-state)
                      </button>
                    </div>
                  </div>

                  {/* Billed line items table */}
                  <div className="space-y-3">
                    <h3 className="font-label-caps text-xs text-tertiary tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-performance-red rounded-full"></span>
                      Billed Line Items
                    </h3>

                    <div className="border border-white/5 rounded-xl overflow-hidden shadow-2xl bg-black/10">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-black/30 border-b border-white/10 font-label-caps text-tertiary/80 text-[10px] tracking-wider">
                            <th className="p-4">Item Description</th>
                            <th className="p-4">HSN/SAC</th>
                            <th className="p-4 text-right">Qty</th>
                            <th className="p-4 text-right">Rate</th>
                            <th className="p-4 text-right">Line Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-data-sm text-on-surface">
                          {activeInvoice.items &&
                            activeInvoice.items.map((item: any, idx: number) => (
                              <tr key={item.id || idx} className="hover:bg-white/[0.01]">
                                <td className="p-4 text-white font-medium font-body-lg">
                                  {item.description}
                                </td>
                                <td className="p-4 text-tertiary/60 font-data-sm">
                                  {item.hsn_sac || '998714'}
                                </td>
                                <td className="p-4 text-right text-tertiary/60 font-data-sm">
                                  {item.qty}
                                </td>
                                <td className="p-4 text-right text-tertiary/60 font-data-sm">
                                  ₹{item.rate.toLocaleString('en-IN')}
                                </td>
                                <td className="p-4 text-right text-white font-bold font-data-lg">
                                  ₹{item.amount.toLocaleString('en-IN')}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Calculations and payment reconciliation details */}
                  <div className="bg-black/35 border border-white/5 rounded-xl p-4 max-w-sm ml-auto space-y-2.5 text-xs font-data-sm shadow-inner">
                    <div className="flex justify-between text-tertiary/60">
                      <span>Billed Subtotal</span>
                      <span className="text-white">₹{activeInvoice.subtotal.toLocaleString('en-IN')}</span>
                    </div>
                    {activeInvoice.discount_amount > 0 && (
                      <div className="flex justify-between text-emerald-400">
                        <span>Coupon Discounts</span>
                        <span>-₹{activeInvoice.discount_amount.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-tertiary/60">
                      <span>Taxable Value outlay</span>
                      <span className="text-white">₹{activeInvoice.taxable_amount.toLocaleString('en-IN')}</span>
                    </div>

                    {taxState === 'intra' ? (
                      <>
                        <div className="flex justify-between text-tertiary/60">
                          <span>Central CGST (9%)</span>
                          <span className="text-white">
                            ₹{activeInvoice.cgst_amount.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="flex justify-between text-tertiary/60">
                          <span>State SGST (9%)</span>
                          <span className="text-white">
                            ₹{activeInvoice.sgst_amount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between text-tertiary/60">
                        <span>Integrated IGST (18%)</span>
                        <span className="text-white">
                          ₹{(activeInvoice.cgst_amount + activeInvoice.sgst_amount).toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}

                    <div className="h-px bg-white/10 my-3"></div>
                    <div className="flex justify-between items-end">
                      <span className="text-tertiary font-label-caps">GRAND TOTAL</span>
                      <span className="text-lg font-black text-white font-data-lg">
                        ₹{activeInvoice.total_amount.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex justify-between text-emerald-400 pt-1.5 font-bold">
                      <span>Reconciled Paid</span>
                      <span>₹{activeInvoice.amount_paid.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-amber-400 font-bold pt-1.5 border-t border-white/5">
                      <span>Balance Due</span>
                      <span>₹{activeInvoice.balance_due.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-tertiary/20">
                <span className="material-symbols-outlined text-[54px] mb-2">payments</span>
                <h3 className="text-base font-bold text-white font-body-lg">No Invoice Selected</h3>
                <p className="text-sm max-w-xs mt-1.5 font-body-lg">
                  Select any invoice from the manifest directory to inspect billed items, check local tax splits, or log split payments.
                </p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: AGING ACCOUNTS OUTSTANDING */}
      {activeTab === 'aging' && (
        <div className="space-y-6">
          {/* Overdue buckets card strip */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            {[
              { val: outstandingAgeing.summary?.current || 0, label: 'Current (Undue)', text: 'text-white bg-white/[0.01]' },
              { val: outstandingAgeing.summary?.overdue_1_30 || 0, label: '1 - 30 Days Late', text: 'text-amber-400 bg-amber-500/5' },
              { val: outstandingAgeing.summary?.overdue_31_60 || 0, label: '31 - 60 Days Late', text: 'text-orange-400 bg-orange-500/5' },
              { val: outstandingAgeing.summary?.overdue_61_90 || 0, label: '61 - 90 Days Late', text: 'text-performance-red bg-performance-red/5' },
              { val: outstandingAgeing.summary?.overdue_90_plus || 0, label: '90+ Days Critical', text: 'text-red-500 bg-red-600/5 border border-red-500/10' },
            ].map(({ val, label, text }) => (
              <div key={label} className={`border border-white/5 rounded-2xl p-5 text-center shadow-2xl ${text}`}>
                <span className="text-lg font-bold font-data-lg">
                  ₹{Number(val).toLocaleString('en-IN')}
                </span>
                <span className="text-tertiary/50 text-[10px] block font-label-caps uppercase tracking-wider mt-1.5">
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Ageing manifest table */}
          <div className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-white/5 bg-black/25">
              <h3 className="font-label-caps text-xs text-tertiary tracking-wider uppercase">
                Outstanding Accounts Aging Manifest
              </h3>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs font-data-sm text-on-surface">
                <thead>
                  <tr className="bg-black/35 border-b border-white/5 text-tertiary/75 uppercase tracking-widest font-label-caps font-bold">
                    <th className="p-4.5 px-6">Invoice</th>
                    <th className="p-4.5 px-6">Customer Profile</th>
                    <th className="p-4.5 px-6 text-right">Total Outlay</th>
                    <th className="p-4.5 px-6 text-right">Amount Paid</th>
                    <th className="p-4.5 px-6 text-right">Balance Due</th>
                    <th className="p-4.5 px-6">Days Overdue</th>
                    <th className="p-4.5 px-6 text-center">Reconcile Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {outstandingAgeing.invoices && outstandingAgeing.invoices.length > 0 ? (
                    outstandingAgeing.invoices.map((inv: any) => (
                      <tr key={inv.id} className="hover:bg-performance-red/[0.01]">
                        <td className="p-4.5 px-6 text-white font-bold font-data-sm">
                          {inv.invoice_code}
                        </td>
                        <td className="p-4.5 px-6">
                          <span className="text-white font-medium font-body-lg">
                            {inv.customer_name}
                          </span>
                          <p className="text-[10px] text-tertiary/50 mt-1 font-data-sm">
                            {inv.customer_phone}
                          </p>
                        </td>
                        <td className="p-4.5 px-6 text-right text-tertiary font-data-sm">
                          ₹{Number(inv.total_amount).toLocaleString('en-IN')}
                        </td>
                        <td className="p-4.5 px-6 text-right text-emerald-400 font-data-sm">
                          ₹{Number(inv.amount_paid).toLocaleString('en-IN')}
                        </td>
                        <td className="p-4.5 px-6 text-right text-amber-400 font-bold font-data-lg">
                          ₹{Number(inv.balance_due).toLocaleString('en-IN')}
                        </td>
                        <td className="p-4.5 px-6">
                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-[9px] font-label-caps font-bold uppercase border ${
                              inv.days_overdue > 60
                                ? 'bg-performance-red/10 text-performance-red border-performance-red/25 animate-pulse'
                                : inv.days_overdue > 30
                                ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}
                          >
                            {inv.days_overdue} days overdue
                          </span>
                        </td>
                        <td className="p-4.5 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleRecordSplitPayment(inv)}
                            className="px-3 py-1.5 bg-gradient-to-r from-performance-red to-[#93000a] text-white rounded-lg text-[9px] font-label-caps tracking-wider active:scale-95 transition-all hover:shadow-[0_0_12px_rgba(255,43,43,0.3)]"
                          >
                            RECORD PAY
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-tertiary/30 italic font-body-lg">
                        No outstanding aging accounts identified in manifest checks.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SPLIT PAYMENT LEDGER RECONCILIATION */}
      {showPaymentModal && paymentInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md">
          <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl p-6 max-w-lg w-full relative shadow-2xl overflow-hidden animate-zoomIn">
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-performance-red/[0.04] blur-[60px] pointer-events-none" />
            <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
              <h3 className="font-display-hero text-lg font-black text-white uppercase tracking-wider">
                Log Split Payment
              </h3>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="text-tertiary hover:text-white p-1 hover:bg-white/5 rounded-lg transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCommitSplitPayments} className="space-y-4">
              <div className="bg-white/[0.01] border border-white/5 rounded-xl p-4 shadow-inner space-y-1 text-xs">
                <p className="text-[9px] text-tertiary font-label-caps mb-1 uppercase tracking-widest">
                  Invoice Code Reference
                </p>
                <p className="text-sm font-data-sm font-bold text-white">
                  {paymentInvoice.invoice_code}
                </p>
                <p className="text-xs text-tertiary mt-1.5 font-body-lg">
                  Balance Outstanding:{' '}
                  <span className="text-amber-400 font-bold font-data-sm">
                    ₹{Number(paymentInvoice.balance_due).toLocaleString()}
                  </span>
                </p>
              </div>

              {/* Dynamic split lines list */}
              <div className="space-y-2.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                <label className="block text-[10px] text-tertiary font-label-caps uppercase tracking-wider">
                  Payment Split Ledgers
                </label>
                {splitLines.map((line, idx) => (
                  <div
                    key={idx}
                    className="flex gap-2 items-center bg-black/35 p-2.5 border border-white/5 rounded-xl shadow-inner"
                  >
                    <select
                      value={line.mode}
                      onChange={(e) => updateSplitLine(idx, 'mode', e.target.value)}
                      className="bg-black border border-white/10 rounded-lg p-1.5 text-xs text-white w-28 focus:outline-none focus:border-performance-red/40 font-body-lg"
                    >
                      <option value="upi" className="bg-[#0c0c0c]">UPI / GPay</option>
                      <option value="cash" className="bg-[#0c0c0c]">Cash</option>
                      <option value="card" className="bg-[#0c0c0c]">Card Reader</option>
                      <option value="bank_transfer" className="bg-[#0c0c0c]">Bank Transfer</option>
                      <option value="cheque" className="bg-[#0c0c0c]">Voucher Cheque</option>
                    </select>

                    <input
                      type="number"
                      required
                      placeholder="Amount"
                      value={line.amount || ''}
                      onChange={(e) => updateSplitLine(idx, 'amount', Number(e.target.value))}
                      className="bg-black border border-white/10 rounded-lg p-1.5 text-xs text-white text-right font-data-sm w-24 focus:outline-none focus:border-performance-red/40"
                    />

                    <input
                      type="text"
                      placeholder="Transaction Ref/Tx."
                      value={line.refNum}
                      onChange={(e) => updateSplitLine(idx, 'refNum', e.target.value)}
                      className="bg-black border border-white/10 rounded-lg p-1.5 text-xs text-white w-28 focus:outline-none focus:border-performance-red/40 font-data-sm placeholder:text-tertiary/20"
                    />

                    {splitLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSplitLine(idx)}
                        className="text-tertiary/40 hover:text-performance-red p-1 rounded-lg hover:bg-white/5"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addSplitLine}
                className="text-xs text-performance-red hover:underline font-semibold flex items-center gap-1 font-body-lg"
              >
                <span className="material-symbols-outlined text-sm">add_circle</span>
                <span>Add split payment mode line</span>
              </button>

              <div className="grid grid-cols-2 gap-4 text-xs font-data-sm border-t border-white/5 pt-4">
                <div>
                  <label className="block text-[9px] text-tertiary font-label-caps uppercase tracking-wider mb-1">
                    Split Ledger Total
                  </label>
                  <p className="text-white font-bold text-base font-data-lg">
                    ₹{totalSplitAmount.toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <label className="block text-[9px] text-tertiary font-label-caps uppercase tracking-wider mb-1">
                    Reconciliation Notes
                  </label>
                  <input
                    type="text"
                    placeholder="Voucher details..."
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-2.5 text-white text-xs font-body-lg"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 bg-white/5 border border-white/10 py-2.5 rounded-xl text-xs font-label-caps text-tertiary hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentMutation.isPending || totalSplitAmount <= 0}
                  className="flex-1 bg-gradient-to-r from-performance-red to-[#93000a] py-2.5 rounded-xl text-xs font-label-caps text-white hover:shadow-[0_0_20px_rgba(255,43,43,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {paymentMutation.isPending ? 'Logging splits...' : 'Confirm Reconciliation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
