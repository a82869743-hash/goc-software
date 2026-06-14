import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsAPI } from '../api/leads';
import { staffAPI } from '../api/staff';
import type { LeadStatus, LeadSource, Lead } from '../types';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

// ── Obsidian Apex Kanban Config ──────────────────────────────────────
const STAGES: { status: LeadStatus; label: string; color: string; dot: string; headerBg: string }[] = [
  { status: 'new', label: 'NEW', color: 'text-white', dot: 'bg-performance-red shadow-[0_0_8px_#FF2B2B] animate-pulse', headerBg: 'from-performance-red/10' },
  { status: 'contacted', label: 'CONTACTED', color: 'text-on-surface', dot: 'bg-white/30', headerBg: 'from-white/5' },
  { status: 'interested', label: 'QUALIFIED', color: 'text-white', dot: 'bg-performance-red/60', headerBg: 'from-performance-red/5' },
  { status: 'quotation_sent', label: 'QUOTED', color: 'text-white', dot: 'bg-performance-red shadow-[0_0_8px_#FF2B2B]', headerBg: 'from-performance-red/10' },
  { status: 'booked', label: 'CONVERTED', color: 'text-performance-red font-bold', dot: 'bg-performance-red shadow-[0_0_10px_#FF2B2B]', headerBg: 'from-performance-red/20' },
  { status: 'lost', label: 'LOST SECTOR', color: 'text-gray-500', dot: 'bg-gray-700', headerBg: 'from-white/[0.02]' },
];

const SOURCE_ICON: Record<LeadSource, string> = {
  instagram: 'photo_camera',
  facebook: 'thumb_up',
  whatsapp: 'chat_bubble',
  walkin: 'store',
  reference: 'group',
  other: 'more_horiz',
};

const SOURCE_LABEL: Record<LeadSource, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  walkin: 'Walk-in',
  reference: 'Referral',
  other: 'Other',
};

const SOURCE_COLOR: Record<LeadSource, string> = {
  instagram: 'text-pink-400',
  facebook: 'text-blue-400',
  whatsapp: 'text-emerald-400',
  walkin: 'text-amber-400',
  reference: 'text-purple-400',
  other: 'text-gray-400',
};

interface LeadKanbanCardProps {
  lead: Lead;
  onClick: () => void;
  selected: boolean;
  onSelectToggle: (e: React.MouseEvent) => void;
}

function LeadKanbanCard({ lead, onClick, selected, onSelectToggle }: LeadKanbanCardProps) {
  const vehicle = [lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(' ');
  const timeAgo = lead.created_at
    ? new Date(lead.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    : '';

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(lead.id));
      }}
      onClick={onClick}
      className={`deep-glass rounded-xl p-5 cursor-grab active:cursor-grabbing group hover:border-performance-red/45 transition-all duration-300 relative overflow-hidden flex flex-col gap-3.5 ${
        selected ? 'border-performance-red/80 shadow-[0_0_20px_rgba(255,43,43,0.15)] bg-performance-red/[0.02]' : 'border-white/[0.06] bg-white/[0.01]'
      }`}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 performance-gradient opacity-40 group-hover:opacity-100 transition-opacity"></div>
      
      {/* Selector Checkbox & Header */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            onClick={onSelectToggle}
            className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-all ${
              selected
                ? 'bg-performance-red border-performance-red'
                : 'border-white/20 bg-white/[0.02] hover:border-white/40'
            }`}
          >
            {selected && <span className="material-symbols-outlined text-[10px] text-white font-bold">check</span>}
          </div>
          <div className="min-w-0">
            <h3 className="font-data-lg text-sm font-bold text-white truncate group-hover:text-performance-red transition-colors">
              {lead.full_name}
            </h3>
            <p className="font-data-sm text-[11px] text-on-surface-variant/50 mt-0.5">{lead.phone}</p>
          </div>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant/40 group-hover:text-performance-red transition-colors text-sm">
          drag_indicator
        </span>
      </div>

      {/* Vehicle specs */}
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[14px] text-performance-red/70">directions_car</span>
        <p className="font-data-sm text-xs text-on-surface-variant group-hover:text-white transition-colors truncate">
          {vehicle || 'Untracked Vehicle Spec'}
        </p>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center mt-1 pt-3 border-t border-white/5 font-data-sm text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="bg-white/5 border border-carbon-border text-on-surface-variant/70 px-2 py-0.5 rounded font-label-caps uppercase text-[8px] tracking-widest">
            {SOURCE_LABEL[lead.source as LeadSource] || lead.source}
          </span>
          {/* After source icon — add auto badge */}
          {(lead as any).auto_captured === 1 && (
            <span className="text-[9px] font-bold text-performance-red/70 uppercase tracking-wider">AUTO</span>
          )}
        </div>
        <span className="text-on-surface-variant/50">{timeAgo}</span>
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<LeadSource | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Detail Modal & Update flow state
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [showLostModal, setShowLostModal] = useState(false);
  const [lostReasonLeadId, setLostReasonLeadId] = useState<number | null>(null);
  const [lostReasonText, setLostReasonText] = useState('');
  const [lostTargetStatus, setLostTargetStatus] = useState<LeadStatus>('lost');

  // Multi-Selection for Bulk Reassign
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [showBulkReassignModal, setShowBulkReassignModal] = useState(false);
  const [bulkAssigneeId, setBulkAssigneeId] = useState<number | null>(null);

  // Form State
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    vehicle_make: '',
    vehicle_model: '',
    requirement: '',
    source: 'walkin' as LeadSource,
    notes: '',
  });

  // Queries & Mutations
  const { data: leadsRes, isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => leadsAPI.list(),
  });

  const { data: staffRes } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffAPI.list({ status: 'active' }),
  });

  const { data: leadDetailRes } = useQuery({
    queryKey: ['leads', selectedLeadId],
    queryFn: () => (selectedLeadId ? leadsAPI.getById(selectedLeadId) : null),
    enabled: !!selectedLeadId,
  });

  const leads = (leadsRes?.data || []) as Lead[];
  const staffMembers = staffRes?.data || [];

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) => leadsAPI.create(payload as any),
    onSuccess: () => {
      toast.success('Lead telemetered successfully');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setShowAddModal(false);
      setForm({
        full_name: '',
        phone: '',
        vehicle_make: '',
        vehicle_model: '',
        requirement: '',
        source: 'walkin',
        notes: '',
      });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to add lead');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Lead> }) => leadsAPI.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      if (selectedLeadId) {
        queryClient.invalidateQueries({ queryKey: ['leads', selectedLeadId] });
      }
      toast.success('Lead profile updated successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to update lead');
    },
  });

  const bulkReassignMutation = useMutation({
    mutationFn: ({ leadIds, assignedTo }: { leadIds: number[]; assignedTo: number }) =>
      leadsAPI.bulkReassign(leadIds, assignedTo),
    onSuccess: () => {
      toast.success('Bulk leads reassigned successfully');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setSelectedLeadIds([]);
      setShowBulkReassignModal(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Reassignment failed');
    },
  });

  const handleStatusChange = (leadId: number, targetStatus: LeadStatus) => {
    if (targetStatus === 'lost') {
      setLostReasonLeadId(leadId);
      setLostTargetStatus(targetStatus);
      setLostReasonText('');
      setShowLostModal(true);
    } else {
      updateMutation.mutate({ id: leadId, payload: { status: targetStatus } });
    }
  };

  const handleLostSubmit = () => {
    if (!lostReasonText.trim()) {
      toast.error('Please enter a reason for losing this lead.');
      return;
    }
    if (lostReasonLeadId) {
      updateMutation.mutate({
        id: lostReasonLeadId,
        payload: { status: lostTargetStatus, lost_reason: lostReasonText },
      });
      setShowLostModal(false);
      setLostReasonLeadId(null);
    }
  };

  const toggleSelectLead = (leadId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLeadIds((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]
    );
  };

  const handleBulkReassign = () => {
    if (!bulkAssigneeId) {
      toast.error('Select a staff representative first');
      return;
    }
    bulkReassignMutation.mutate({ leadIds: selectedLeadIds, assignedTo: bulkAssigneeId });
  };

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      l.full_name.toLowerCase().includes(q) ||
      (l.vehicle_make || '').toLowerCase().includes(q) ||
      (l.vehicle_model || '').toLowerCase().includes(q) ||
      l.phone.includes(q);
    const matchSource = sourceFilter === 'all' || l.source === sourceFilter;
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchSource && matchStatus;
  });

  return (
    <div className="space-y-6 relative flex flex-col h-[calc(100vh-8rem)]">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h2 className="font-display-hero text-headline-lg text-white mb-1 tracking-tight">Leads Pipeline</h2>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="font-label-caps text-label-caps text-on-surface-variant/80 tracking-widest uppercase">
              Real-time CRM telemetry &amp; acquisition feed
            </p>
            {/* Add after existing stats — auto-captured count badge */}
            {(() => {
              const autoCount = leads.filter((l: any) => l.auto_captured === 1 && 
                new Date(l.created_at).toDateString() === new Date().toDateString()).length;
              return autoCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-performance-red/10 border border-performance-red/20 text-performance-red text-[11px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-performance-red animate-pulse" />
                  {autoCount} AUTO-CAPTURED TODAY
                </span>
              ) : null;
            })()}
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex bg-white/5 border border-white/5 rounded-xl p-1 shrink-0">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-label-caps uppercase tracking-wider transition-all ${
                viewMode === 'kanban' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">dashboard</span>
              KANBAN
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-label-caps uppercase tracking-wider transition-all ${
                viewMode === 'list' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">table_rows</span>
              LIST VIEW
            </button>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="performance-gradient text-white font-label-caps text-label-caps px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:shadow-[0_0_25px_rgba(255,43,43,0.35)] active:scale-[0.97] transition-all uppercase tracking-widest border border-white/10 shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Lead
          </button>
        </div>
      </div>

      {/* ── Filter Bar ────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-[#111111] border border-white/5 p-4 rounded-2xl shrink-0">
        <div className="flex items-center gap-4 flex-wrap flex-1">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 text-[18px]">
              search
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads..."
              className="w-64 bg-black/40 border border-white/[0.07] rounded-xl py-2 pl-10 pr-4 text-xs font-data-sm text-white placeholder-gray-600 focus:outline-none focus:border-performance-red/50 transition-all"
            />
          </div>
          <div className="flex items-center gap-1 p-1 bg-black/40 border border-white/5 rounded-xl overflow-x-auto custom-scrollbar max-w-full">
            <button
              onClick={() => setSourceFilter('all')}
              className={`px-4 py-2 rounded-lg text-[9px] font-label-caps uppercase tracking-wider transition-all whitespace-nowrap ${
                sourceFilter === 'all' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              All Sources
            </button>
            {(['instagram', 'facebook', 'whatsapp', 'walkin', 'reference'] as LeadSource[]).map((s) => (
              <button
                key={s}
                onClick={() => setSourceFilter(sourceFilter === s ? 'all' : s)}
                className={`px-4 py-2 rounded-lg text-[9px] font-label-caps uppercase tracking-wider transition-all whitespace-nowrap ${
                  sourceFilter === s ? 'bg-performance-red/10 text-performance-red border border-performance-red/20 font-bold' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {s === 'walkin' ? 'Walk-in' : s === 'reference' ? 'Referral' : s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {selectedLeadIds.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 bg-[#CC0000]/10 border border-[#CC0000]/25 rounded-xl animate-fade-in shrink-0">
            <span className="text-[10px] font-data-sm text-performance-red font-bold tabular-nums">
              {selectedLeadIds.length} SELECTED
            </span>
            <button
              onClick={() => setShowBulkReassignModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-performance-red text-white rounded-lg text-[9px] font-label-caps uppercase tracking-widest hover:brightness-110 active:scale-[0.97] transition-all font-bold"
            >
              <span className="material-symbols-outlined text-[14px]">assignment_ind</span>
              Bulk Reassign
            </button>
          </div>
        )}
      </div>

      {/* ── Viewport rendering ────────────────────────────── */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-on-surface-variant/40 text-xs italic">
            QUERYING CRM PIPELINE FEED...
          </div>
        ) : viewMode === 'kanban' ? (
          /* Kanban Board layout */
          <div className="flex gap-5 h-full overflow-x-auto pb-4 custom-scrollbar select-none">
            {STAGES.map((stage) => {
              const stageLeads = filtered.filter((l) => l.status === stage.status);

              return (
                <div
                  key={stage.status}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const leadId = Number(e.dataTransfer.getData('text/plain'));
                    if (leadId) {
                      handleStatusChange(leadId, stage.status);
                    }
                  }}
                  className="w-[300px] shrink-0 kanban-col rounded-2xl flex flex-col h-full max-h-full shadow-2xl relative"
                >
                  {/* Column Header */}
                  <div className={`p-4 border-b border-carbon-border flex justify-between items-center bg-gradient-to-r ${stage.headerBg} to-transparent rounded-t-2xl shrink-0`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${stage.dot}`}></div>
                      <span className={`font-label-caps text-[10px] tracking-widest ${stage.color}`}>
                        {stage.label}
                      </span>
                    </div>
                    <span className="font-data-sm bg-white/5 text-on-surface-variant/60 px-2 py-0.5 rounded border border-carbon-border text-[10px]">
                      {stageLeads.length}
                    </span>
                  </div>

                  {/* Cards stack */}
                  <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-4 custom-scrollbar">
                    {stageLeads.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center py-20 text-on-surface-variant/20">
                        <span className="material-symbols-outlined text-4xl mb-2 opacity-50">inventory_2</span>
                        <p className="font-data-sm text-[10px] uppercase tracking-widest">Sector Empty</p>
                      </div>
                    ) : (
                      stageLeads.map((lead) => (
                        <LeadKanbanCard
                          key={lead.id}
                          lead={lead}
                          onClick={() => setSelectedLeadId(lead.id)}
                          selected={selectedLeadIds.includes(lead.id)}
                          onSelectToggle={(e) => toggleSelectLead(lead.id, e)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Ledger List View */
          <div className="bg-[#111111] border border-white/5 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full">
            <div className="overflow-x-auto flex-1 custom-scrollbar">
              <table className="w-full min-w-[800px] text-left border-collapse">
                <thead>
                  <tr className="bg-black/35 border-b border-white/5 text-[9px] font-label-caps uppercase tracking-widest text-on-surface-variant/60">
                    <th className="px-6 py-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && selectedLeadIds.length === filtered.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLeadIds(filtered.map((l) => l.id));
                          } else {
                            setSelectedLeadIds([]);
                          }
                        }}
                        className="rounded bg-black border-white/20 focus:ring-0 focus:ring-offset-0 text-performance-red"
                      />
                    </th>
                    <th className="px-6 py-4 font-normal">Lead Code</th>
                    <th className="px-6 py-4 font-normal">Customer Name</th>
                    <th className="px-6 py-4 font-normal">Phone</th>
                    <th className="px-6 py-4 font-normal">Vehicle specs</th>
                    <th className="px-6 py-4 font-normal">Source</th>
                    <th className="px-6 py-4 font-normal">Staff Agent</th>
                    <th className="px-6 py-4 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02] text-xs font-data-sm text-on-surface-variant">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center italic text-on-surface-variant/40">
                        NO ACTIVE RECORDS LOGGED IN FILTER MATRIX.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((lead, idx) => (
                      <tr
                        key={lead.id}
                        onClick={() => setSelectedLeadId(lead.id)}
                        className={`hover:bg-white/[0.015] cursor-pointer transition-colors group ${
                          idx % 2 === 1 ? 'bg-black/20' : ''
                        }`}
                      >
                        <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.includes(lead.id)}
                            onChange={() =>
                              setSelectedLeadIds((prev) =>
                                prev.includes(lead.id) ? prev.filter((id) => id !== lead.id) : [...prev, lead.id]
                              )
                            }
                            className="rounded bg-black border-white/20 focus:ring-0 focus:ring-offset-0 text-performance-red"
                          />
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-[#ffb4a8]">#{lead.lead_code}</td>
                        <td className="px-6 py-4 font-bold text-white">{lead.full_name}</td>
                        <td className="px-6 py-4 font-mono text-xs">{lead.phone}</td>
                        <td className="px-6 py-4 text-white">
                          {[lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(' ') || '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 capitalize text-[10px] ${SOURCE_COLOR[lead.source as LeadSource] || 'text-gray-400'}`}>
                            <span className="material-symbols-outlined text-sm">
                              {SOURCE_ICON[lead.source as LeadSource] || 'more_horiz'}
                            </span>
                            {lead.source}
                          </span>
                        </td>
                        <td className="px-6 py-4">{lead.assigned_staff_name || 'Unassigned'}</td>
                        <td className="px-6 py-4 font-bold uppercase font-label-caps">
                          {lead.status}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Lead Detail Modal Panel ───────────────────────── */}
      {selectedLeadId && leadDetailRes?.data && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
          id="drawer-overlay"
          onClick={() => setSelectedLeadId(null)}
        >
          <div className="absolute inset-0 z-0 bg-transparent" />
          <div
            className="w-full max-w-lg bg-[#0a0a0c] border border-white/10 rounded-2xl z-[70] flex flex-col p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar"
            id="lead-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-carbon-border bg-white/[0.01] flex justify-between items-center shrink-0">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-performance-red shadow-[0_0_8px_#FF2B2B] animate-pulse"></span>
                  <span className="font-label-caps text-[9px] text-performance-red tracking-[0.25em] uppercase">
                    Active Telemetry
                  </span>
                </div>
                <h2 className="font-display-hero text-xl font-bold text-white">{leadDetailRes.data.full_name}</h2>
              </div>
              <button
                className="text-on-surface-variant hover:text-performance-red transition-colors w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5"
                onClick={() => setSelectedLeadId(null)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-grow overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar">
              {/* Kanban Stage Selector */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-5 flex flex-col gap-3">
                <p className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-wider uppercase mb-1">
                  Update Lead pipeline Status
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {STAGES.map((st) => (
                    <button
                      key={st.status}
                      onClick={() => handleStatusChange(leadDetailRes.data.id, st.status)}
                      className={`py-2 px-3 rounded-xl text-[10px] font-label-caps uppercase transition-all flex items-center gap-2 border ${
                        leadDetailRes.data.status === st.status
                          ? 'bg-performance-red/10 border-performance-red/40 text-performance-red font-bold shadow-lg shadow-performance-red/5'
                          : 'border-white/10 text-on-surface-variant hover:bg-white/5'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${st.status === leadDetailRes.data.status ? 'bg-performance-red' : st.dot}`} />
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Technical Config details */}
              <div className="deep-glass rounded-2xl p-5 border border-white/5">
                <h4 className="font-label-caps text-[9px] text-on-surface-variant/40 mb-4 uppercase tracking-widest border-b border-white/5 pb-2">
                  Telemetry Profile
                </h4>
                <div className="space-y-3.5 font-data-sm text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant/50">Lead Code</span>
                    <span className="text-white font-bold">#{leadDetailRes.data.lead_code}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant/50">Primary phone</span>
                    <span className="text-white">{leadDetailRes.data.phone}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant/50">Vehicle model</span>
                    <span className="text-white font-bold">
                      {[leadDetailRes.data.vehicle_make, leadDetailRes.data.vehicle_model].filter(Boolean).join(' ') || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-white/5 text-sm">
                    <span className="text-on-surface-variant/50">Source Channels</span>
                    <span className="text-performance-red font-bold uppercase tracking-wide">
                      {leadDetailRes.data.source}
                    </span>
                  </div>
                </div>
              </div>

              {/* Assignment selector */}
              <div>
                <label className="block font-label-caps text-[9px] text-on-surface-variant/40 mb-2.5 uppercase tracking-widest">
                  Assign Staff Representative
                </label>
                <select
                  value={leadDetailRes.data.assigned_to || ''}
                  onChange={(e) =>
                    updateMutation.mutate({
                      id: leadDetailRes.data.id,
                      payload: { assigned_to: e.target.value ? Number(e.target.value) : null },
                    })
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-xs text-white focus:outline-none focus:border-performance-red/50 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23FF2B2B%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_1.5rem_center] bg-[length:1.2em]"
                >
                  <option value="" className="bg-[#121414]">Unassigned</option>
                  {staffMembers.map((sm) => (
                    <option key={sm.id} value={sm.id} className="bg-[#121414]">
                      {sm.full_name} ({sm.role.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Requirement Notes */}
              <div>
                <label className="block font-label-caps text-[9px] text-on-surface-variant/40 mb-2.5 uppercase tracking-widest">
                  Acquisition Notes
                </label>
                <textarea
                  value={leadDetailRes.data.notes || ''}
                  onChange={(e) => updateMutation.mutate({ id: leadDetailRes.data.id, payload: { notes: e.target.value } })}
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 text-xs text-white focus:outline-none focus:border-performance-red/50 resize-none h-24"
                  placeholder="Additional conversation logs..."
                />
              </div>

              {/* Timeline Log Feed */}
              <div className="space-y-4">
                <h4 className="font-label-caps text-[9px] text-on-surface-variant/40 uppercase tracking-widest px-1">
                  Log Feed
                </h4>
                <div className="relative border-l border-white/10 pl-4 ml-2 space-y-5">
                  {leadDetailRes.data.activities && leadDetailRes.data.activities.length > 0 ? (
                    leadDetailRes.data.activities.map((act: any) => (
                      <div key={act.id} className="relative group">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full performance-gradient shadow-[0_0_8px_#FF2B2B] ring-4 ring-[#0a0a0c]" />
                        <div className="text-xs">
                          <p className="text-white font-medium">{act.notes || `${act.action} event`}</p>
                          <p className="text-[10px] text-on-surface-variant/40 font-mono mt-0.5">
                            {new Date(act.created_at).toLocaleString('en-IN')} · {act.staff_name || 'System'}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-on-surface-variant/30 italic pl-1">No transmission telemetry recorded.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-6 border-t border-carbon-border bg-white/[0.01] shrink-0 flex gap-4 mt-auto">
              <button
                onClick={() => {
                  toast.success('Note Logged Successfully');
                  setSelectedLeadId(null);
                }}
                className="flex-1 border border-performance-red/30 text-performance-red hover:bg-performance-red/10 transition-all font-label-caps text-label-caps py-3 rounded-lg uppercase tracking-widest"
              >
                Log Note
              </button>
              <button
                onClick={() => {
                  setSelectedLeadId(null);
                  navigate('/quotations');
                }}
                className="flex-1 performance-gradient text-white font-bold font-label-caps text-label-caps py-3 rounded-lg red-glow hover:red-glow-strong transition-all uppercase tracking-widest border border-white/10"
              >
                Create Quote
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lost Reason Prompt Modal ───────────────────────── */}
      {showLostModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowLostModal(false)}
        >
          <div
            className="bg-[#111111] border border-white/10 rounded-2xl w-[95vw] sm:max-w-md shadow-2xl p-6 mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-label-caps font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-red-500">warning</span>
              LOST SECTOR REASON
            </h3>
            <p className="text-xs text-on-surface-variant/60 mt-1.5">
              Specify reason why this lead has been cataloged as lost. This transaction is un-deletable.
            </p>
            <textarea
              value={lostReasonText}
              onChange={(e) => setLostReasonText(e.target.value)}
              rows={3}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-red-500 mt-4 resize-none"
              placeholder="e.g. Budget constraints, moved to competitor..."
            />
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowLostModal(false);
                  setLostReasonLeadId(null);
                }}
                className="px-4 py-2 border border-white/10 rounded-lg text-xs text-gray-300 hover:bg-white/[0.06] transition-all font-label-caps tracking-widest"
              >
                DISCARD
              </button>
              <button
                onClick={handleLostSubmit}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-red-500 active:scale-[0.97] transition-all font-label-caps"
              >
                Confirm Lost
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Reassign Representative Modal ─────────────── */}
      {showBulkReassignModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowBulkReassignModal(false)}
        >
          <div
            className="bg-[#111111] border border-white/10 rounded-2xl w-[95vw] sm:max-w-md shadow-2xl p-6 mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-label-caps font-bold text-white uppercase tracking-wider">
              Reassign Leads
            </h3>
            <p className="text-xs text-on-surface-variant/60 mt-1.5">
              Select the sales representative or manager to assign to the selected {selectedLeadIds.length} leads.
            </p>
            <div className="mt-4">
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">
                Staff Agent
              </label>
              <select
                value={bulkAssigneeId || ''}
                onChange={(e) => setBulkAssigneeId(e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-performance-red/50"
              >
                <option value="">Select Assignee...</option>
                {staffMembers.map((sm) => (
                  <option key={sm.id} value={sm.id}>
                    {sm.full_name} ({sm.role.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowBulkReassignModal(false)}
                className="px-4 py-2 border border-white/10 rounded-lg text-xs text-gray-300 hover:bg-white/[0.06] transition-all font-label-caps tracking-widest"
              >
                DISCARD
              </button>
              <button
                onClick={handleBulkReassign}
                disabled={!bulkAssigneeId}
                className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-800 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:shadow-[0_0_16px_rgba(239,68,68,0.4)] active:scale-[0.97] transition-all disabled:opacity-50 font-label-caps"
              >
                Reassign Leads
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Lead Modal ─────────────────────────────────── */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-[#111111] border border-white/10 rounded-2xl w-[95vw] sm:max-w-md shadow-2xl overflow-hidden mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-black/20">
              <h3 className="text-sm font-label-caps font-bold text-white uppercase tracking-wider">
                Create New Lead Telemetry
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50"
                  placeholder="e.g. Rahul Sharma"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">
                  Phone *
                </label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50"
                  placeholder="e.g. 9876543210"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">
                    Make
                  </label>
                  <input
                    type="text"
                    value={form.vehicle_make}
                    onChange={(e) => setForm({ ...form, vehicle_make: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50"
                    placeholder="e.g. Porsche"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">
                    Model
                  </label>
                  <input
                    type="text"
                    value={form.vehicle_model}
                    onChange={(e) => setForm({ ...form, vehicle_model: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50"
                    placeholder="e.g. 911 GT3"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">
                  Requirement
                </label>
                <input
                  type="text"
                  value={form.requirement}
                  onChange={(e) => setForm({ ...form, requirement: e.target.value })}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50"
                  placeholder="e.g. Full Ceramic Coat"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">
                  Source Channel
                </label>
                <select
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value as LeadSource })}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-performance-red/50"
                >
                  <option value="walkin" className="bg-[#121414]">Walk-in</option>
                  <option value="instagram" className="bg-[#121414]">Instagram</option>
                  <option value="facebook" className="bg-[#121414]">Facebook</option>
                  <option value="whatsapp" className="bg-[#121414]">WhatsApp</option>
                  <option value="reference" className="bg-[#121414]">Referral</option>
                  <option value="other" className="bg-[#121414]">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">
                  Internal Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-3 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50 resize-none h-20"
                  placeholder="Acquisition profile notes..."
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3 bg-black/20">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-white/10 rounded-lg text-xs text-gray-300 hover:bg-white/[0.06] transition-all font-label-caps tracking-widest"
              >
                DISCARD
              </button>
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.full_name || !form.phone || createMutation.isPending}
                className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-800 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:shadow-[0_0_16px_rgba(239,68,68,0.4)] active:scale-[0.97] transition-all disabled:opacity-50 font-label-caps"
              >
                {createMutation.isPending ? 'PROCESSING...' : 'COMMIT LEAD'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
