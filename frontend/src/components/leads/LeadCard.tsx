import React, { useState } from 'react';
import type { Lead, LeadStatus } from '../../types';
import { useNavigate } from 'react-router-dom';

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
  selected: boolean;
  onSelectToggle: (e: React.MouseEvent) => void;
  onStatusChange: (leadId: number, targetStatus: LeadStatus) => void;
}

const STAGES: { status: LeadStatus; label: string }[] = [
  { status: 'new', label: 'New' },
  { status: 'contacted', label: 'Contacted' },
  { status: 'interested', label: 'Qualified' },
  { status: 'lost', label: 'Lost' },
];

export const LeadCard: React.FC<LeadCardProps> = React.memo(({
  lead,
  onClick,
  selected,
  onSelectToggle,
  onStatusChange,
}) => {
  const navigate = useNavigate();
  const [showQuickStageMenu, setShowQuickStageMenu] = useState(false);

  const vehicle = [lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(' ');

  const timeAgo = lead.created_at
    ? new Date(lead.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    : '';

  const cleanPhone = lead.phone ? lead.phone.replace(/\D/g, '') : '';
  const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(lead.id));
      }}
      onClick={onClick}
      className={`group relative rounded-xl p-3.5 border transition-all duration-200 cursor-grab active:cursor-grabbing flex flex-col gap-2.5 shadow-xs ${
        selected
          ? 'bg-red-50/40 border-[#E31E24]'
          : 'bg-white hover:bg-slate-50/80 border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Header: Checkbox, Customer Name, Code */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          {/* Checkbox */}
          <div
            onClick={onSelectToggle}
            className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center cursor-pointer transition-all shrink-0 ${
              selected
                ? 'bg-[#E31E24] border-[#E31E24] text-white'
                : 'border-slate-300 bg-white hover:border-slate-400'
            }`}
          >
            {selected && <span className="material-symbols-outlined text-[10px] font-bold">check</span>}
          </div>

          {/* Customer Name & Code */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <h3 className="text-xs font-bold text-slate-900 group-hover:text-[#E31E24] transition-colors leading-snug break-words">
                {lead.full_name}
              </h3>
              <span className="text-[10px] font-mono text-slate-400 font-semibold shrink-0">
                #{lead.lead_code}
              </span>
            </div>
            <a
              href={`tel:${lead.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs font-mono text-slate-600 hover:text-slate-900 font-semibold transition-colors block mt-0.5"
            >
              {lead.phone}
            </a>
          </div>
        </div>

        <span className="material-symbols-outlined text-slate-300 group-hover:text-slate-400 text-sm shrink-0">
          drag_indicator
        </span>
      </div>

      {/* Vehicle Specs */}
      {vehicle && (
        <div className="text-xs text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/80 font-medium">
          {vehicle}
        </div>
      )}

      {/* Source, Created Time & Auto Badge */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
        <div className="flex items-center gap-1.5">
          <span className="capitalize font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60 text-[11px]">
            {lead.source}
          </span>
          {(lead as any).auto_captured === 1 && (
            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded uppercase tracking-wider">
              Auto
            </span>
          )}
        </div>
        <span className="font-mono text-slate-400 text-[11px]">{timeAgo}</span>
      </div>

      {/* Assigned Staff */}
      {lead.assigned_staff_name && (
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <span className="material-symbols-outlined text-[13px] text-slate-400">account_circle</span>
          <span className="font-medium text-slate-600">{lead.assigned_staff_name}</span>
        </div>
      )}

      {/* Quick Action Icon Buttons */}
      <div
        className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5">
          {/* Call */}
          <a
            href={`tel:${lead.phone}`}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all border border-slate-200/60"
            title="Call Phone"
          >
            <span className="material-symbols-outlined text-[16px]">call</span>
          </a>

          {/* WhatsApp */}
          <a
            href={`https://wa.me/${waPhone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all border border-slate-200/60"
            title="WhatsApp Direct"
          >
            <span className="material-symbols-outlined text-[16px]">chat</span>
          </a>

          {/* Create Quote */}
          <button
            onClick={() => navigate('/quotations')}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all border border-slate-200/60"
            title="Create Quote"
          >
            <span className="material-symbols-outlined text-[16px]">description</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 relative">
          {/* Move Stage Quick Button & Popover */}
          <button
            onClick={() => setShowQuickStageMenu(!showQuickStageMenu)}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all border border-slate-200/60"
            title="Change Stage"
          >
            <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
          </button>

          {/* POPOVER CLICK-OUTSIDE BACKDROP */}
          {showQuickStageMenu && (
            <>
              <div
                className="fixed inset-0 z-40 bg-transparent"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowQuickStageMenu(false);
                }}
              />
              <div
                className="absolute right-0 bottom-10 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 min-w-[140px] flex flex-col gap-0.5 animate-fade-in"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                  Change Stage
                </span>
                {STAGES.map((st) => (
                  <button
                    key={st.status}
                    onClick={() => {
                      onStatusChange(lead.id, st.status);
                      setShowQuickStageMenu(false);
                    }}
                    className={`text-xs text-left px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 font-medium transition-colors flex items-center justify-between ${
                      lead.status === st.status ? 'bg-slate-100 font-bold text-slate-900' : ''
                    }`}
                  >
                    <span>{st.label}</span>
                    {lead.status === st.status && (
                      <span className="material-symbols-outlined text-xs text-[#E31E24] font-bold">check</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Eye View Details Button */}
          <button
            onClick={onClick}
            className="w-8 h-8 rounded-lg bg-[#E31E24] text-white hover:bg-[#c8191e] flex items-center justify-center transition-all shadow-xs border border-red-600 shrink-0"
            title="View Details"
          >
            <span className="material-symbols-outlined text-[18px] font-bold">visibility</span>
          </button>
        </div>
      </div>
    </div>
  );
});
