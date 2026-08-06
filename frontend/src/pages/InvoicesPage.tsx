import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invoicesAPI, Invoice } from '../api/invoices';
import toast from 'react-hot-toast';
import { getBackendURL, formatDate } from '../utils/helpers';

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Per-row action loading states
  const [compilingId, setCompilingId] = useState<number | null>(null);
  const [sendingWaId, setSendingWaId] = useState<number | null>(null);

  // Modal View state
  const [viewingInvoiceId, setViewingInvoiceId] = useState<number | null>(null);

  // Fetch completed invoices with filters
  const { data: invoicesRes, isLoading } = useQuery({
    queryKey: ['invoices', search, dateFrom, dateTo],
    queryFn: () =>
      invoicesAPI.list({
        invoice_type: 'tax_invoice',
        search,
        date_from: dateFrom,
        date_to: dateTo,
        limit: 100,
      }),
  });
  const invoices = invoicesRes?.data || [];

  // Fetch invoice details for View modal
  const { data: activeInvoiceRes, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['invoice-detail', viewingInvoiceId],
    queryFn: () => invoicesAPI.getById(viewingInvoiceId!),
    enabled: !!viewingInvoiceId,
  });
  const activeInvoice = activeInvoiceRes?.data;

  // PDF Download Handler (Isolated to single row)
  const handleDownloadPdf = async (inv: Invoice) => {
    try {
      setCompilingId(inv.id);
      const res = await invoicesAPI.generatePdf(inv.id);
      if (res.data?.pdf_url) {
        const pdfUrl = getBackendURL(`${res.data.pdf_url}?t=${Date.now()}`);
        
        // Trigger direct file download
        const a = document.createElement('a');
        a.href = pdfUrl;
        a.target = '_blank';
        a.download = `Tax_Invoice_${inv.invoice_code.replace(/\//g, '-')}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        toast.success('Tax Invoice compiled & downloaded!');
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      } else {
        toast.error('Failed to obtain invoice PDF URL.');
      }
    } catch (err: any) {
      console.error('PDF download error:', err);
      toast.error(err.response?.data?.error?.message || 'Failed to compile tax invoice PDF');
    } finally {
      setCompilingId(null);
    }
  };

  // WhatsApp Share Handler
  const handleSendWhatsApp = async (inv: Invoice) => {
    if (!inv.customer_phone) {
      toast.error('Customer phone number is missing.');
      return;
    }
    try {
      setSendingWaId(inv.id);
      const pdfRes = await invoicesAPI.generatePdf(inv.id);
      const pdfUrl = pdfRes.data?.pdf_url ? getBackendURL(pdfRes.data.pdf_url) : '';

      try {
        await invoicesAPI.sendWhatsApp(inv.id);
      } catch (e) {
        console.log('WhatsApp API call fallback to direct wa.me link', e);
      }

      const cleanPhone = inv.customer_phone.replace(/\D/g, '');
      const targetPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      const vehicleStr = inv.vehicle_reg_number ? `(${inv.vehicle_reg_number})` : '';
      const msg = `🙏 Greetings from *God of Ceramic Studio*!\n\nDear *${inv.customer_name || 'Customer'}*,\n\nHere is your Tax Invoice *${inv.invoice_code}* for vehicle ${vehicleStr}.\n\n💰 *Total Amount:* ₹${Number(inv.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\n🧾 *Download Tax Invoice PDF:* ${pdfUrl}\n\nThank you for choosing GOC Studio! 🚗✨`;

      window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`, '_blank');
      toast.success('WhatsApp link opened!');
    } catch (err: any) {
      console.error('WhatsApp error:', err);
      toast.error('Failed to generate WhatsApp share link.');
    } finally {
      setSendingWaId(null);
    }
  };

  return (
    <div className="space-y-6 relative z-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-6 h-[2px] bg-performance-red"></div>
            <span className="font-label-caps text-[10px] text-performance-red tracking-[0.3em] uppercase">
              Financial Control
            </span>
          </div>
          <h1 className="font-display-hero text-2xl text-white tracking-tight">
            Completed Invoices
          </h1>
          <p className="text-xs text-on-surface-variant/60">
            View, download, and search final tax invoices for completed job cards.
          </p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="glass-panel rounded-2xl p-5 bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 shadow-xl space-y-4 md:space-y-0 md:flex md:items-center md:gap-4">
        {/* Search Input (Mobile, Name, Car Number, Invoice Code) */}
        <div className="flex-1 flex items-center bg-white/5 border border-white/10 focus-within:border-performance-red/50 rounded-xl px-3.5 py-2.5 transition-all shadow-inner">
          <span className="material-symbols-outlined text-performance-red/80 mr-2.5 text-[20px]">search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Name, Mobile (e.g. 99099...), Car Number (e.g. GJ06...), or Invoice Code..."
            className="bg-transparent text-white w-full focus:outline-none text-xs placeholder:text-on-surface-variant/40"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-tertiary hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">cancel</span>
            </button>
          )}
        </div>

        {/* Date From */}
        <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-2">
          <span className="text-[10px] font-label-caps text-on-surface-variant/50 mr-2 uppercase tracking-wider">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-transparent text-white text-xs outline-none focus:outline-none font-data-sm"
          />
        </div>

        {/* Date To */}
        <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-2">
          <span className="text-[10px] font-label-caps text-on-surface-variant/50 mr-2 uppercase tracking-wider">To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-transparent text-white text-xs outline-none focus:outline-none font-data-sm"
          />
        </div>

        {/* Clear Filters */}
        {(search || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setSearch('');
              setDateFrom('');
              setDateTo('');
            }}
            className="px-4 py-2 text-xs font-label-caps text-performance-red hover:underline whitespace-nowrap"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Invoices List Table */}
      <div className="glass-panel rounded-2xl overflow-hidden bg-[#0c0c0c]/40 border border-white/5 shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-black/40 border-b border-white/10 text-on-surface-variant/60 font-label-caps tracking-widest text-[9px] font-bold uppercase">
                <th className="p-4">Invoice No.</th>
                <th className="p-4">Date</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Phone</th>
                <th className="p-4">Car Number</th>
                <th className="p-4 text-right">Total Amount</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-data-sm text-white">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-on-surface-variant/40 italic">
                    <div className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-performance-red">sync</span>
                      Loading completed invoices...
                    </div>
                  </td>
                </tr>
              ) : invoices.length > 0 ? (
                invoices.map((inv) => {
                  const isCompilingThisRow = compilingId === inv.id;
                  const isSendingWaThisRow = sendingWaId === inv.id;

                  return (
                    <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 font-bold text-performance-red font-data-sm">
                        {inv.invoice_code}
                      </td>
                      <td className="p-4 text-on-surface-variant/80">
                        {formatDate(inv.invoice_date)}
                      </td>
                      <td className="p-4 font-semibold">{inv.customer_name || '—'}</td>
                      <td className="p-4 text-on-surface-variant/80 font-mono">{inv.customer_phone || '—'}</td>
                      <td className="p-4 font-mono font-bold text-amber-400/90">{inv.vehicle_reg_number || '—'}</td>
                      <td className="p-4 text-right font-bold font-data-lg text-white">
                        ₹{Number(inv.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* VIEW BUTTON */}
                          <button
                            type="button"
                            onClick={() => setViewingInvoiceId(inv.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 text-blue-400 text-[10px] font-label-caps tracking-wider flex items-center gap-1 transition-all"
                            title="View Full Invoice Details"
                          >
                            <span className="material-symbols-outlined text-[14px]">visibility</span>
                            VIEW
                          </button>

                          {/* DOWNLOAD BUTTON */}
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(inv)}
                            disabled={isCompilingThisRow}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-label-caps tracking-wider flex items-center gap-1 disabled:opacity-50 transition-all"
                            title="Download PDF"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {isCompilingThisRow ? 'sync' : 'download'}
                            </span>
                            {isCompilingThisRow ? 'COMPILING...' : 'DOWNLOAD'}
                          </button>

                          {/* WHATSAPP SHARE BUTTON */}
                          <button
                            type="button"
                            onClick={() => handleSendWhatsApp(inv)}
                            disabled={isSendingWaThisRow}
                            className="px-2 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 text-green-400 text-[10px] font-label-caps tracking-wider flex items-center gap-1 disabled:opacity-50 transition-all"
                            title="Share Invoice via WhatsApp"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {isSendingWaThisRow ? 'sync' : 'chat'}
                            </span>
                            WHATSAPP
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-on-surface-variant/40 italic">
                    No completed invoices found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── INVOICE VIEW MODAL ────────────────────────────────────────── */}
      {viewingInvoiceId && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[70] flex items-center justify-center p-4 pt-20 sm:pt-4 animate-fade-in"
          onClick={() => setViewingInvoiceId(null)}
        >
          <div
            className="bg-[#0e0e0e] border border-white/10 rounded-3xl w-full max-w-3xl p-6 relative overflow-hidden shadow-2xl space-y-6 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar Indicator */}
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-performance-red via-amber-500 to-emerald-500" />

            {/* Header */}
            <div className="flex justify-between items-start border-b border-white/10 pb-4 shrink-0">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-performance-red/20 text-performance-red text-[9px] font-mono font-bold px-2 py-0.5 rounded border border-performance-red/30 uppercase">
                    TAX INVOICE
                  </span>
                  <span className="text-xs text-tertiary/70 font-mono">
                    {activeInvoice?.invoice_code}
                  </span>
                </div>
                <h2 className="font-display-hero text-xl text-white font-bold tracking-wide">
                  Invoice Details
                </h2>
                <p className="text-[11px] text-tertiary/60 font-data-sm">
                  Issued on: {activeInvoice?.invoice_date ? formatDate(activeInvoice.invoice_date) : '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingInvoiceId(null)}
                className="text-tertiary hover:text-white p-1 hover:bg-white/5 rounded-lg transition-all"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            {/* Body Content */}
            <div className="overflow-y-auto custom-scrollbar flex-1 space-y-5 pr-1 text-xs text-white">
              {isLoadingDetail ? (
                <div className="py-16 text-center text-tertiary/50 italic flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined animate-spin text-performance-red text-2xl">sync</span>
                  Loading invoice details...
                </div>
              ) : activeInvoice ? (
                <>
                  {/* Customer & Vehicle Info Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Customer Card */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-2">
                      <span className="text-[9px] font-label-caps text-performance-red tracking-widest block uppercase font-bold">
                        CUSTOMER DETAILS
                      </span>
                      <h3 className="font-bold text-sm text-white">{activeInvoice.customer_name || '—'}</h3>
                      <div className="space-y-1 text-tertiary/80 text-[11px]">
                        <p className="flex items-center gap-2 font-mono">
                          <span className="material-symbols-outlined text-[14px] text-tertiary">call</span>
                          {activeInvoice.customer_phone || '—'}
                        </p>
                        {activeInvoice.customer_gstin && (
                          <p className="flex items-center gap-2 font-mono text-amber-400/90">
                            <span className="material-symbols-outlined text-[14px]">badge</span>
                            GSTIN: {activeInvoice.customer_gstin}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Vehicle Card */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-2">
                      <span className="text-[9px] font-label-caps text-amber-400 tracking-widest block uppercase font-bold">
                        VEHICLE & JOB REFERENCE
                      </span>
                      <h3 className="font-bold text-sm font-mono text-amber-400">{activeInvoice.vehicle_reg_number || '—'}</h3>
                      <div className="space-y-1 text-tertiary/80 text-[11px]">
                        <p className="flex items-center gap-2 font-mono">
                          <span className="material-symbols-outlined text-[14px] text-tertiary">tag</span>
                          Job Code: {activeInvoice.job_code || '—'}
                        </p>
                        <p className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[14px] text-tertiary">payments</span>
                          Status: <span className="uppercase font-bold text-emerald-400">{activeInvoice.status}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-label-caps text-tertiary/60 tracking-widest block uppercase font-bold">
                      BILLABLE SERVICES & PRODUCTS
                    </span>
                    <div className="border border-white/5 rounded-xl overflow-hidden bg-black/30">
                      <table className="w-full text-left text-[11px]">
                        <thead>
                          <tr className="bg-white/5 text-tertiary/70 font-label-caps text-[9px] uppercase border-b border-white/5">
                            <th className="p-3">#</th>
                            <th className="p-3">Description</th>
                            <th className="p-3 text-center">HSN/SAC</th>
                            <th className="p-3 text-center">Qty</th>
                            <th className="p-3 text-right">Rate</th>
                            <th className="p-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {activeInvoice.items && activeInvoice.items.length > 0 ? (
                            activeInvoice.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-white/[0.01]">
                                <td className="p-3 text-tertiary/50 font-mono">{idx + 1}</td>
                                <td className="p-3 font-semibold text-white">{item.description}</td>
                                <td className="p-3 text-center font-mono text-tertiary/70">{item.hsn_sac || '998714'}</td>
                                <td className="p-3 text-center font-mono">{item.qty}</td>
                                <td className="p-3 text-right font-mono">₹{Number(item.rate).toLocaleString('en-IN')}</td>
                                <td className="p-3 text-right font-mono font-bold text-white">
                                  ₹{Number(item.amount).toLocaleString('en-IN')}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="p-4 text-center text-tertiary/40 italic">
                                No line items specified.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Financial Breakdown Summary */}
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-2 max-w-xs ml-auto text-[11px]">
                    <div className="flex justify-between text-tertiary/80">
                      <span>Subtotal:</span>
                      <span className="font-mono">₹{Number(activeInvoice.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {Number(activeInvoice.discount_amount) > 0 && (
                      <div className="flex justify-between text-performance-red font-semibold">
                        <span>Discount:</span>
                        <span className="font-mono">-₹{Number(activeInvoice.discount_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {activeInvoice.apply_gst && (
                      <>
                        <div className="flex justify-between text-tertiary/80">
                          <span>CGST (9%):</span>
                          <span className="font-mono">₹{Number(activeInvoice.cgst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-tertiary/80">
                          <span>SGST (9%):</span>
                          <span className="font-mono">₹{Number(activeInvoice.sgst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </>
                    )}
                    <div className="border-t border-white/10 pt-2 flex justify-between font-bold text-sm text-white">
                      <span>Grand Total:</span>
                      <span className="font-mono text-emerald-400">
                        ₹{Number(activeInvoice.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Footer Action Buttons */}
            {activeInvoice && (
              <div className="flex flex-wrap gap-2 justify-end border-t border-white/10 pt-4 shrink-0">
                {/* Print/Preview */}
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(activeInvoice)}
                  className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl text-xs font-label-caps tracking-wider flex items-center gap-1.5 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  Print PDF
                </button>

                {/* WhatsApp */}
                <button
                  type="button"
                  onClick={() => handleSendWhatsApp(activeInvoice)}
                  className="px-4 py-2 bg-green-500/20 border border-green-500/30 hover:bg-green-500/30 text-green-400 rounded-xl text-xs font-label-caps tracking-wider flex items-center gap-1.5 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">chat</span>
                  Send WhatsApp
                </button>

                {/* Download PDF */}
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(activeInvoice)}
                  disabled={compilingId === activeInvoice.id}
                  className="px-5 py-2 performance-gradient text-white font-bold rounded-xl text-xs font-label-caps tracking-wider flex items-center gap-1.5 border border-white/10 transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  {compilingId === activeInvoice.id ? 'Compiling...' : 'Download Invoice'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
