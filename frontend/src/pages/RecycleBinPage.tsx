import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import toast from 'react-hot-toast';
import { usePermissions } from '../utils/usePermissions';

interface DeletedItem {
  id: number;
  record_type: string;
  type_label: string;
  code: string;
  name: string;
  extra_info: string;
  deleted_at: string;
}

const TYPE_CFG: Record<string, { icon: string; color: string; bg: string }> = {
  customers: { icon: 'person', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  job_cards: { icon: 'build', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  quotations: { icon: 'request_quote', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  invoices: { icon: 'receipt_long', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  leads: { icon: 'leaderboard', color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20' },
};

const recycleBinAPI = {
  list: async (type?: string) => {
    const params = type ? `?type=${type}` : '';
    const { data } = await apiClient.get(`/recycle-bin${params}`);
    return data;
  },
  restore: async (type: string, id: number) => {
    const { data } = await apiClient.post(`/recycle-bin/${type}/${id}/restore`);
    return data;
  },
  permanentDelete: async (type: string, id: number) => {
    const { data } = await apiClient.delete(`/recycle-bin/${type}/${id}`);
    return data;
  },
};

export default function RecycleBinPage() {
  const queryClient = useQueryClient();
  const { canDelete } = usePermissions();
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data: response, isLoading } = useQuery({
    queryKey: ['recycleBin', typeFilter],
    queryFn: () => recycleBinAPI.list(typeFilter === 'all' ? undefined : typeFilter),
  });

  const items: DeletedItem[] = response?.data || [];

  const restoreMutation = useMutation({
    mutationFn: ({ type, id }: { type: string; id: number }) => recycleBinAPI.restore(type, id),
    onSuccess: (_, vars) => {
      toast.success(`${vars.type.replace('_', ' ')} restored successfully`);
      queryClient.invalidateQueries({ queryKey: ['recycleBin'] });
      // Also invalidate the original list queries
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['jobCards'] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to restore');
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: ({ type, id }: { type: string; id: number }) => recycleBinAPI.permanentDelete(type, id),
    onSuccess: () => {
      toast.success('Permanently deleted');
      queryClient.invalidateQueries({ queryKey: ['recycleBin'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to delete permanently');
    },
  });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + 
           ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const typeCounts: Record<string, number> = {};
  items.forEach(item => {
    typeCounts[item.record_type] = (typeCounts[item.record_type] || 0) + 1;
  });

  return (
    <div className="space-y-8 relative z-10 font-body-lg">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-[2px] bg-performance-red"></div>
            <span className="font-label-caps text-label-caps text-performance-red tracking-[0.3em] uppercase">
              Data Recovery
            </span>
          </div>
          <h1 className="font-display-hero text-headline-lg text-white tracking-tight">
            Recycle Bin
          </h1>
          <p className="font-body-lg text-body-lg text-tertiary mt-1.5 max-w-2xl">
            Recover deleted records or permanently remove them. All soft-deleted job cards, customers, quotations, invoices, and leads appear here.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-4 flex items-center gap-3">
            <span className="material-symbols-outlined text-[28px] text-performance-red opacity-80">delete_sweep</span>
            <div>
              <p className="text-[10px] text-tertiary/50 uppercase tracking-widest font-label-caps">Total Deleted</p>
              <p className="text-xl font-bold font-data-lg text-white tabular-nums">{items.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'ALL RECORDS', icon: 'select_all' },
          { key: 'customers', label: 'CUSTOMERS', icon: 'person' },
          { key: 'job_cards', label: 'JOB CARDS', icon: 'build' },
          { key: 'quotations', label: 'QUOTATIONS', icon: 'request_quote' },
          { key: 'invoices', label: 'INVOICES', icon: 'receipt_long' },
          { key: 'leads', label: 'LEADS', icon: 'leaderboard' },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTypeFilter(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-label-caps uppercase tracking-widest transition-all duration-300 border ${
              typeFilter === key
                ? 'bg-performance-red/10 border-performance-red/35 text-performance-red shadow-[0_0_10px_rgba(255,43,43,0.15)] font-bold'
                : 'bg-white/5 border-white/10 text-tertiary hover:text-white hover:border-white/20'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* TABLE */}
      <div className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-black/35 text-tertiary/75 text-[10px] font-label-caps border-b border-white/5 uppercase tracking-widest">
                <th className="py-4 px-6 font-normal">Type</th>
                <th className="py-4 px-6 font-normal">Code / Name</th>
                <th className="py-4 px-6 font-normal">Details</th>
                <th className="py-4 px-6 font-normal">Deleted On</th>
                <th className="py-4 px-6 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-data-sm text-on-surface">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-tertiary/50 italic font-body-lg">
                    <span className="material-symbols-outlined animate-spin text-[24px] text-performance-red mb-2 block">sync</span>
                    Loading deleted records...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-tertiary/30 italic font-body-lg">
                    <span className="material-symbols-outlined text-4xl block mb-2 opacity-50">
                      delete_forever
                    </span>
                    RECYCLE BIN IS EMPTY — NO DELETED RECORDS
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const cfg = TYPE_CFG[item.record_type] || TYPE_CFG.customers;
                  return (
                    <tr key={`${item.record_type}-${item.id}`} className="hover:bg-white/[0.02] transition-all duration-300 group">
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-label-caps uppercase tracking-wider ${cfg.bg}`}>
                          <span className={`material-symbols-outlined text-[12px] ${cfg.color}`}>{cfg.icon}</span>
                          <span className={cfg.color}>{item.type_label}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-sm font-semibold text-white font-body-lg">{item.name}</p>
                        <p className="text-[10px] font-data-sm text-tertiary/40 mt-0.5">{item.code}</p>
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-xs text-tertiary font-body-lg">{item.extra_info || '—'}</p>
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-xs text-tertiary/60 font-data-sm">{formatDate(item.deleted_at)}</p>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => restoreMutation.mutate({ type: item.record_type, id: item.id })}
                            disabled={restoreMutation.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 transition-all duration-300 text-[10px] font-label-caps uppercase tracking-wider"
                          >
                            <span className="material-symbols-outlined text-[14px]">restore</span>
                            Restore
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => {
                                if (window.confirm(`PERMANENTLY delete this ${item.type_label}? This action cannot be undone.`)) {
                                  permanentDeleteMutation.mutate({ type: item.record_type, id: item.id });
                                }
                              }}
                              disabled={permanentDeleteMutation.isPending}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all duration-300 text-[10px] font-label-caps uppercase tracking-wider"
                            >
                              <span className="material-symbols-outlined text-[14px]">delete_forever</span>
                              Delete
                            </button>
                          )}
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
    </div>
  );
}
