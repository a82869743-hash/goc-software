import React from 'react';
import type { Lead } from '../../types';

interface LeadStatsHeaderProps {
  leads: Lead[];
  onNewLeadClick: () => void;
  viewMode: 'kanban' | 'list';
  onViewModeChange: (mode: 'kanban' | 'list') => void;
}

export const LeadStatsHeader: React.FC<LeadStatsHeaderProps> = ({
  leads,
  onNewLeadClick,
  viewMode,
  onViewModeChange,
}) => {
  const totalLeads = leads.length;

  const todayStr = new Date().toDateString();
  const newToday = leads.filter(
    (l) => new Date(l.created_at).toDateString() === todayStr
  ).length;

  const autoCapturedToday = leads.filter(
    (l: any) =>
      l.auto_captured === 1 &&
      new Date(l.created_at).toDateString() === todayStr
  ).length;

  const convertedCount = leads.filter((l) => l.status === 'booked').length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedCount / totalLeads) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 shrink-0">
      {/* Header Title & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Leads Pipeline
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-normal">
            Real-time customer acquisition feed &amp; stage tracking
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Segmented View Mode Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              onClick={() => onViewModeChange('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'kanban'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">view_kanban</span>
              Kanban
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">format_list_bulleted</span>
              List
            </button>
          </div>

          {/* Brand Red Primary Action */}
          <button
            onClick={onNewLeadClick}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#E31E24] hover:bg-[#c8191e] text-white font-semibold text-xs rounded-xl shadow-sm transition-all active:scale-95 shrink-0"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            New Lead
          </button>
        </div>
      </div>

      {/* Clean KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Leads</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">{totalLeads}</p>
          </div>
          <span className="material-symbols-outlined text-slate-400 text-2xl">groups</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Acquired Today</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">{newToday}</p>
          </div>
          <span className="material-symbols-outlined text-slate-400 text-2xl">person_add</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Meta Auto-Captured</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xl sm:text-2xl font-bold text-slate-900">{autoCapturedToday}</p>
              {autoCapturedToday > 0 && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                  Live Sync
                </span>
              )}
            </div>
          </div>
          <span className="material-symbols-outlined text-slate-400 text-2xl">hub</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Conversion Rate</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">{conversionRate}%</p>
          </div>
          <span className="material-symbols-outlined text-slate-400 text-2xl">trending_up</span>
        </div>
      </div>
    </div>
  );
};
