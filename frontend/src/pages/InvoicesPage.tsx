import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesAPI, Invoice } from '../api/invoices';
import toast from 'react-hot-toast';
import { getBackendURL } from '../utils/helpers';

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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

  // PDF Generation Mutation
  const generatePdfMutation = useMutation({
    mutationFn: (id: number) => invoicesAPI.generatePdf(id),
    onSuccess: (res) => {
      toast.success('Tax Invoice compiled successfully!');
      if (res.data?.pdf_url) {
        window.open(getBackendURL(`${res.data.pdf_url}?t=${Date.now()}`), '_blank');
      }
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to compile tax invoice PDF');
    },
  });

  return (
    <div className="space-y-6 relative z-10">
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
            Download and search tax invoices for completed job cards.
          </p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="glass-panel rounded-2xl p-5 bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 shadow-xl space-y-4 md:space-y-0 md:flex md:items-center md:gap-4">
        {/* Search */}
        <div className="flex-1 flex items-center bg-white/5 border border-white/10 focus-within:border-performance-red/50 rounded-xl px-3 py-2 transition-all">
          <span className="material-symbols-outlined text-on-surface-variant/40 mr-2 text-[18px]">search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Name, Mobile, or Car Number..."
            className="bg-transparent text-white w-full focus:outline-none text-xs placeholder:text-on-surface-variant/30"
          />
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
              <tr className="bg-black/30 border-b border-white/10 text-on-surface-variant/60 font-label-caps tracking-widest text-[9px] font-bold">
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
                    Loading invoices...
                  </td>
                </tr>
              ) : invoices.length > 0 ? (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="p-4 font-bold text-performance-red font-data-sm">
                      {inv.invoice_code}
                    </td>
                    <td className="p-4 text-on-surface-variant/80">
                      {new Date(inv.invoice_date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="p-4 font-semibold">{inv.customer_name}</td>
                    <td className="p-4 text-on-surface-variant/80">{inv.customer_phone || '—'}</td>
                    <td className="p-4 font-mono text-on-surface-variant">{inv.vehicle_reg_number || '—'}</td>
                    <td className="p-4 text-right font-bold font-data-lg text-white">
                      ₹{Number(inv.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        type="button"
                        onClick={() => generatePdfMutation.mutate(inv.id)}
                        disabled={generatePdfMutation.isPending}
                        className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white text-[10px] font-label-caps tracking-widest flex items-center gap-1.5 mx-auto disabled:opacity-50 transition-all"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {generatePdfMutation.isPending ? 'sync' : 'picture_as_pdf'}
                        </span>
                        {generatePdfMutation.isPending ? 'COMPILING...' : 'DOWNLOAD'}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-on-surface-variant/30 italic">
                    No completed invoices found matching the filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
