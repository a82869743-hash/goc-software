import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Lead, LeadStatus } from '../../types';
import type { StaffMember } from '../../api/staff';
import { useNavigate } from 'react-router-dom';
import { parseMetaLeadFields } from '../../utils/metaLeadParser';

interface LeadDetailDrawerProps {
  lead: Lead;
  onClose: () => void;
  onStatusChange: (leadId: number, targetStatus: LeadStatus) => void;
  staffMembers: StaffMember[];
  onAssignStaff: (leadId: number, staffId: number | null) => void;
  onUpdateNotes: (leadId: number, notes: string) => void;
}

const STAGES: {
  status: LeadStatus;
  label: string;
  activeBg: string;
  activeBorder: string;
  badgeBg: string;
}[] = [
  {
    status: 'new',
    label: 'New',
    activeBg: 'bg-blue-600 text-white',
    activeBorder: 'border-blue-600',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    status: 'contacted',
    label: 'Contacted',
    activeBg: 'bg-indigo-600 text-white',
    activeBorder: 'border-indigo-600',
    badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    status: 'interested',
    label: 'Qualified',
    activeBg: 'bg-purple-600 text-white',
    activeBorder: 'border-purple-600',
    badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    status: 'quotation_sent',
    label: 'Quoted',
    activeBg: 'bg-amber-600 text-white',
    activeBorder: 'border-amber-600',
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    status: 'booked',
    label: 'Converted',
    activeBg: 'bg-emerald-600 text-white',
    activeBorder: 'border-emerald-600',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    status: 'lost',
    label: 'Lost',
    activeBg: 'bg-rose-600 text-white',
    activeBorder: 'border-rose-600',
    badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
  },
];

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({
  lead,
  onClose,
  onStatusChange,
  staffMembers,
  onAssignStaff,
  onUpdateNotes,
}) => {
  const navigate = useNavigate();
  const [noteInput, setNoteInput] = useState(lead.notes || '');
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'notes'>('overview');
  const [isSaved, setIsSaved] = useState(false);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const cleanPhone = lead.phone ? lead.phone.replace(/\D/g, '') : '';
  const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const vehicle = [lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(' ');

  // Dynamic Meta Lead Form Fields parsing
  const metaFields = parseMetaLeadFields(lead.notes);

  const currentStageConfig = STAGES.find((s) => s.status === lead.status) || STAGES[0];

  const handleSaveNotes = () => {
    onUpdateNotes(lead.id, noteInput);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center p-3 pt-20 sm:p-4 sm:pt-22 md:p-6 md:pt-24 bg-slate-950/80 backdrop-blur-md transition-all animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      {/* Centered Premium Lead Details Modal Container */}
      <div
        className="w-full max-w-4xl bg-white border border-slate-200/90 rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-88px)] sm:max-h-[calc(100vh-100px)] overflow-hidden text-slate-900 relative animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-white shrink-0 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              {/* Customer Avatar Initial Badge */}
              <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-[#E31E24] font-bold text-lg shrink-0 shadow-xs">
                {lead.full_name ? lead.full_name.charAt(0).toUpperCase() : 'L'}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 truncate font-sans tracking-tight">
                    {lead.full_name}
                  </h2>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${currentStageConfig.badgeBg}`}>
                    {currentStageConfig.label}
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                  <span className="font-mono font-semibold text-slate-700">
                    Lead Code: #{lead.lead_code}
                  </span>
                  <span>•</span>
                  <a
                    href={`tel:${lead.phone}`}
                    className="font-mono text-slate-800 hover:text-[#E31E24] transition-colors font-semibold"
                  >
                    {lead.phone}
                  </a>
                  {lead.created_at && (
                    <>
                      <span>•</span>
                      <span className="text-slate-500">
                        Added {new Date(lead.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Close Button */}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 flex items-center justify-center transition-all shrink-0 active:scale-95"
              title="Close Modal (Esc)"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Quick Action Header Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap pt-2 border-t border-slate-100">
            <a
              href={`tel:${lead.phone}`}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-all border border-slate-200/80 active:scale-95 shadow-xs"
            >
              <span className="material-symbols-outlined text-base text-emerald-600">call</span>
              Call Customer
            </a>

            <a
              href={`https://wa.me/${waPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold transition-all border border-emerald-200 active:scale-95 shadow-xs"
            >
              <span className="material-symbols-outlined text-base text-emerald-600">chat</span>
              WhatsApp Direct
            </a>

            <button
              onClick={() => {
                onClose();
                navigate('/quotations');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[#E31E24] hover:bg-[#c8191e] text-white rounded-xl text-xs font-semibold transition-all shadow-xs active:scale-95 ml-auto sm:ml-0"
            >
              <span className="material-symbols-outlined text-base">description</span>
              Create Quote
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-4 sm:px-6 shrink-0 overflow-x-auto custom-scrollbar gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-[#E31E24] text-[#E31E24]'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <span className="material-symbols-outlined text-base">dashboard</span>
            Overview & Profile
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'timeline'
                ? 'border-[#E31E24] text-[#E31E24]'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <span className="material-symbols-outlined text-base">history</span>
            Activity Feed ({lead.activities?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab('notes')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'notes'
                ? 'border-[#E31E24] text-[#E31E24]'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <span className="material-symbols-outlined text-base">sticky_note_2</span>
            Acquisition Notes
          </button>
        </div>

        {/* Scrollable Centered Modal Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
          {activeTab === 'overview' && (
            <>
              {/* Pipeline Stage Selector Grid */}
              <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-[#E31E24]">alt_route</span>
                    Update Lead Stage
                  </p>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Current Status: <strong className="text-slate-800 uppercase">{lead.status}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                  {STAGES.map((st) => {
                    const isCurrent = lead.status === st.status;

                    return (
                      <button
                        key={st.status}
                        onClick={() => onStatusChange(lead.id, st.status)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition-all border flex items-center justify-between shadow-xs ${
                          isCurrent
                            ? `${st.activeBg} ${st.activeBorder} shadow-sm ring-2 ring-red-500/20`
                            : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-100/80 hover:border-slate-300'
                        }`}
                      >
                        <span className="truncate">{st.label}</span>
                        {isCurrent && (
                          <span className="material-symbols-outlined text-base font-bold shrink-0">
                            check_circle
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* META LEAD FORM QUESTIONNAIRE RESPONSES */}
              {metaFields.length > 0 && (
                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#E31E24] text-lg">assignment</span>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Customer Form Responses (Meta Lead Form)
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      Structured Answers
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                    {metaFields.map((field, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 flex items-start gap-3 transition-all hover:bg-slate-50"
                      >
                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 shrink-0 shadow-xs mt-0.5">
                          <span className="material-symbols-outlined text-[18px]">{field.icon}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[11px] font-semibold text-slate-500 block leading-tight break-words">
                            {field.label}
                          </span>
                          <span className="text-xs font-bold text-slate-900 block mt-1 break-words">
                            {field.value}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Customer & Vehicle Profile Card */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#E31E24] text-base">person</span>
                    Customer &amp; Vehicle Profile
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/60 space-y-1">
                    <span className="text-slate-500 text-[11px] font-semibold block">Primary Phone</span>
                    <a
                      href={`tel:${lead.phone}`}
                      className="text-slate-900 font-mono font-bold hover:text-[#E31E24] transition-colors block text-sm"
                    >
                      {lead.phone}
                    </a>
                  </div>

                  <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/60 space-y-1">
                    <span className="text-slate-500 text-[11px] font-semibold block">Source Channel</span>
                    <span className="text-slate-900 font-bold capitalize block text-sm">
                      {lead.source}
                    </span>
                  </div>

                  <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/60 space-y-1">
                    <span className="text-slate-500 text-[11px] font-semibold block">Vehicle Specs</span>
                    <span className="text-slate-900 font-bold block text-sm">
                      {vehicle || '—'}
                    </span>
                  </div>

                  <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/60 space-y-1">
                    <span className="text-slate-500 text-[11px] font-semibold block">Auto-Captured</span>
                    <span className="text-emerald-700 font-bold block text-sm">
                      {(lead as any).auto_captured === 1 ? 'YES (Meta Webhook)' : 'NO (Manual Entry)'}
                    </span>
                  </div>
                </div>

                {lead.requirement && (
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-slate-500 block text-[11px] font-semibold mb-1">
                      Customer Requirement
                    </span>
                    <div className="text-xs text-slate-800 font-medium bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 leading-relaxed">
                      {lead.requirement}
                    </div>
                  </div>
                )}
              </div>

              {/* Staff Representative Assignment */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
                <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#E31E24] text-base">badge</span>
                  Assigned Staff Representative
                </label>
                <select
                  value={lead.assigned_to || ''}
                  onChange={(e) =>
                    onAssignStaff(lead.id, e.target.value ? Number(e.target.value) : null)
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-slate-400 focus:bg-white transition-all"
                >
                  <option value="">Unassigned (General Pool)</option>
                  {staffMembers.map((sm) => (
                    <option key={sm.id} value={sm.id}>
                      {sm.full_name} ({sm.role.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {activeTab === 'timeline' && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#E31E24] text-base">history</span>
                Activity Log History
              </h4>

              <div className="relative border-l-2 border-slate-200 pl-4 ml-2 space-y-5">
                {lead.activities && lead.activities.length > 0 ? (
                  lead.activities.map((act) => (
                    <div key={act.id} className="relative group">
                      <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-slate-800 ring-4 ring-white" />
                      <div className="text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
                        <p className="text-slate-900 font-semibold leading-relaxed">
                          {act.notes || `${act.action} event logged`}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-1.5">
                          <span>{new Date(act.created_at).toLocaleString('en-IN')}</span>
                          <span>•</span>
                          <span className="font-sans font-medium text-slate-700">
                            {act.staff_name || 'System Auto'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-slate-400 italic text-xs">
                    No activity logs recorded yet for this lead.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#E31E24] text-base">notes</span>
                  Acquisition Conversation Notes
                </label>
                {isSaved && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 animate-fade-in flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">check</span> Saved
                  </span>
                )}
              </div>

              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                rows={8}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white transition-all font-sans leading-relaxed resize-none"
                placeholder="Log internal notes, discussion highlights, call outcomes, custom preferences..."
              />

              <div className="flex justify-end pt-1">
                <button
                  onClick={handleSaveNotes}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xs flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  Save Notes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
