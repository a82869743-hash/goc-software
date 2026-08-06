import React from 'react';
import type { LeadSource, Lead } from '../../types';

interface LeadFilterBarProps {
  search: string;
  onSearchChange: (val: string) => void;
  sourceFilter: LeadSource | 'all';
  onSourceFilterChange: (source: LeadSource | 'all') => void;
  leads: Lead[];
  selectedCount: number;
  onBulkReassignClick: () => void;
  onClearSelection: () => void;
}

const SOURCES: { id: LeadSource | 'all'; label: string }[] = [
  { id: 'all', label: 'All Sources' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'walkin', label: 'Walk-in' },
  { id: 'reference', label: 'Referral' },
  { id: 'other', label: 'Other' },
];

export const LeadFilterBar: React.FC<LeadFilterBarProps> = ({
  search,
  onSearchChange,
  sourceFilter,
  onSourceFilterChange,
  leads,
  selectedCount,
  onBulkReassignClick,
  onClearSelection,
}) => {
  const getSourceCount = (src: LeadSource | 'all') => {
    if (src === 'all') return leads.length;
    return leads.filter((l) => l.source === src).length;
  };

  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white border border-slate-200 p-3 rounded-xl shadow-sm shrink-0">
      {/* Left: Search + Segmented Control Pills */}
      <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
        {/* Search Input */}
        <div className="relative w-full sm:w-64 shrink-0">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search leads..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-9 pr-8 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white transition-all font-sans"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>

        {/* Segmented Source Controls */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200/80 overflow-x-auto custom-scrollbar max-w-full">
          {SOURCES.map((src) => {
            const isActive = sourceFilter === src.id;
            const count = getSourceCount(src.id);

            return (
              <button
                key={src.id}
                onClick={() => onSourceFilterChange(src.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#E31E24] text-white shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <span>{src.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Bulk Selection Banner */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-2.5 px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg shrink-0">
          <span className="text-xs font-bold text-slate-800">
            {selectedCount} Selected
          </span>
          <button
            onClick={onBulkReassignClick}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#E31E24] text-white rounded text-xs font-semibold hover:bg-[#c8191e] transition-all"
          >
            <span className="material-symbols-outlined text-[14px]">assignment_ind</span>
            Bulk Reassign
          </button>
          <button
            onClick={onClearSelection}
            className="p-0.5 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}
    </div>
  );
};
