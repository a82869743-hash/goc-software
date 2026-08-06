import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsAPI } from '../api/leads';
import { staffAPI } from '../api/staff';
import { commissionsAPI } from '../api/commissions';
import type { LeadStatus, LeadSource, Lead } from '../types';
import toast from 'react-hot-toast';

import { LeadStatsHeader } from '../components/leads/LeadStatsHeader';
import { LeadFilterBar } from '../components/leads/LeadFilterBar';
import { LeadKanbanBoard } from '../components/leads/LeadKanbanBoard';
import { LeadListView } from '../components/leads/LeadListView';
import { LeadDetailDrawer } from '../components/leads/LeadDetailDrawer';

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<LeadSource | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Detail Modal / Drawer state
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);

  // Lost Reason Modal State
  const [showLostModal, setShowLostModal] = useState(false);
  const [lostReasonLeadId, setLostReasonLeadId] = useState<number | null>(null);
  const [lostReasonText, setLostReasonText] = useState('');
  const [lostTargetStatus, setLostTargetStatus] = useState<LeadStatus>('lost');

  // Multi-Selection for Bulk Reassign
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [showBulkReassignModal, setShowBulkReassignModal] = useState(false);
  const [bulkAssigneeId, setBulkAssigneeId] = useState<number | null>(null);

  // Form State for New Lead
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    vehicle_make: '',
    vehicle_model: '',
    requirement: '',
    source: 'walkin' as LeadSource,
    connector_id: null as number | null,
    notes: '',
  });

  // Queries & Mutations (UNTOUCHED BUSINESS LOGIC)
  const { data: leadsRes, isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => leadsAPI.list(),
  });

  const { data: staffRes } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffAPI.list({ status: 'active' }),
  });

  const { data: connectorsRes } = useQuery({
    queryKey: ['connectors'],
    queryFn: () => commissionsAPI.listConnectors(),
  });

  const { data: leadDetailRes } = useQuery({
    queryKey: ['leads', selectedLeadId],
    queryFn: () => (selectedLeadId ? leadsAPI.getById(selectedLeadId) : null),
    enabled: !!selectedLeadId,
  });

  const leads = (leadsRes?.data || []) as Lead[];
  const staffMembers = staffRes?.data || [];
  const connectors = connectorsRes?.data || [];

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) => leadsAPI.create(payload as any),
    onSuccess: () => {
      toast.success('Lead created successfully');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setShowAddModal(false);
      setForm({
        full_name: '',
        phone: '',
        vehicle_make: '',
        vehicle_model: '',
        requirement: '',
        source: 'walkin',
        connector_id: null,
        notes: '',
      });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to add lead');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Lead> }) =>
      leadsAPI.update(id, payload),
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

  const toggleSelectLead = (leadId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
      l.phone.includes(q) ||
      (l.lead_code || '').toLowerCase().includes(q);
    const matchSource = sourceFilter === 'all' || l.source === sourceFilter;
    return matchSearch && matchSource;
  });

  return (
    <div className="w-full flex flex-col space-y-6 pb-12 font-sans text-slate-900">
      {/* ── KPI Stats Header ────────────────────────────── */}
      <LeadStatsHeader
        leads={leads}
        onNewLeadClick={() => setShowAddModal(true)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* ── Search & Filter Controls ──────────────────────── */}
      <LeadFilterBar
        search={search}
        onSearchChange={setSearch}
        sourceFilter={sourceFilter}
        onSourceFilterChange={setSourceFilter}
        leads={leads}
        selectedCount={selectedLeadIds.length}
        onBulkReassignClick={() => setShowBulkReassignModal(true)}
        onClearSelection={() => setSelectedLeadIds([])}
      />

      {/* ── Main Pipeline Container (Kanban vs List) ────── */}
      <div className="w-full min-h-[600px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-2">
            <span className="w-7 h-7 rounded-full border-2 border-[#E31E24] border-t-transparent animate-spin" />
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Loading Telemetry...</p>
          </div>
        ) : viewMode === 'kanban' ? (
          <LeadKanbanBoard
            filteredLeads={filtered}
            onLeadClick={(id) => setSelectedLeadId(id)}
            selectedLeadIds={selectedLeadIds}
            onSelectToggle={(id, e) => toggleSelectLead(id, e)}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <LeadListView
            filteredLeads={filtered}
            onLeadClick={(id) => setSelectedLeadId(id)}
            selectedLeadIds={selectedLeadIds}
            onSelectAll={(checked) =>
              setSelectedLeadIds(checked ? filtered.map((l) => l.id) : [])
            }
            onSelectToggle={(id) => toggleSelectLead(id)}
          />
        )}
      </div>

      {/* ── Lead Detail Slide-Over Drawer ───────────────── */}
      {selectedLeadId && leadDetailRes?.data && (
        <LeadDetailDrawer
          lead={leadDetailRes.data}
          onClose={() => setSelectedLeadId(null)}
          onStatusChange={handleStatusChange}
          staffMembers={staffMembers}
          onAssignStaff={(leadId, staffId) =>
            updateMutation.mutate({ id: leadId, payload: { assigned_to: staffId } })
          }
          onUpdateNotes={(leadId, notes) =>
            updateMutation.mutate({ id: leadId, payload: { notes } })
          }
        />
      )}

      {/* ── Lost Reason Prompt Modal ───────────────────── */}
      {showLostModal && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => {
            setShowLostModal(false);
            setLostReasonLeadId(null);
            setLostReasonText('');
          }}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 my-auto relative animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-slate-900 font-bold">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-[#E31E24] shrink-0">
                <span className="material-symbols-outlined text-xl">warning</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-sans">Mark Lead as Lost</h3>
                <p className="text-[11px] text-slate-500 font-normal">This will update the lead status to Lost</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 font-medium">
              Specify the reason why this lead was lost (budget, competitor, non-responsive, etc.):
            </p>
            <textarea
              value={lostReasonText}
              onChange={(e) => setLostReasonText(e.target.value)}
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 focus:border-red-400 focus:bg-white rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none font-sans resize-none transition-all"
              placeholder="e.g. Price too high, chosen local vendor..."
              autoFocus
            />
            <div className="flex justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowLostModal(false);
                  setLostReasonLeadId(null);
                  setLostReasonText('');
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLostSubmit}
                className="px-5 py-2.5 bg-[#E31E24] hover:bg-[#c8191e] text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-red-500/20"
              >
                Confirm Lost
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Reassign Modal ───────────────────────── */}
      {showBulkReassignModal && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setShowBulkReassignModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 my-auto relative animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Bulk Reassign {selectedLeadIds.length} Leads
            </h3>
            <p className="text-xs text-slate-600">
              Select the staff representative or manager to reassign these leads to:
            </p>
            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                Staff Representative
              </label>
              <select
                value={bulkAssigneeId || ''}
                onChange={(e) => setBulkAssigneeId(e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-slate-400"
              >
                <option value="">Select Staff Representative...</option>
                {staffMembers.map((sm) => (
                  <option key={sm.id} value={sm.id}>
                    {sm.full_name} ({sm.role.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowBulkReassignModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkReassign}
                disabled={!bulkAssigneeId}
                className="px-4 py-2 bg-[#E31E24] hover:bg-[#c8191e] text-white rounded-lg text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
              >
                Reassign Leads
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Lead Modal ────────────────────────────── */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Add New Lead
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 max-h-[65vh] overflow-y-auto custom-scrollbar">
              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400"
                  placeholder="e.g. Rahul Sharma"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Phone Number *
                </label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 font-mono"
                  placeholder="e.g. 9876543210"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Make
                  </label>
                  <input
                    type="text"
                    value={form.vehicle_make}
                    onChange={(e) => setForm({ ...form, vehicle_make: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400"
                    placeholder="e.g. Porsche"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Model
                  </label>
                  <input
                    type="text"
                    value={form.vehicle_model}
                    onChange={(e) => setForm({ ...form, vehicle_model: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400"
                    placeholder="e.g. 911 GT3"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Requirement
                </label>
                <input
                  type="text"
                  value={form.requirement}
                  onChange={(e) => setForm({ ...form, requirement: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400"
                  placeholder="e.g. Full Ceramic Coating"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Source Channel
                </label>
                <select
                  value={form.source}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      source: e.target.value as LeadSource,
                      connector_id: e.target.value === 'reference' ? form.connector_id : null,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-slate-400"
                >
                  <option value="walkin">Walk-in</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="reference">Referral</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {form.source === 'reference' && (
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Referral Partner (Connector) *
                  </label>
                  <select
                    value={form.connector_id || ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        connector_id: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-slate-400"
                  >
                    <option value="">Select Referral Partner...</option>
                    {connectors.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} ({c.phone})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Internal Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 font-sans resize-none"
                  placeholder="Acquisition profile notes..."
                />
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.full_name || !form.phone || createMutation.isPending}
                className="px-4 py-2 bg-[#E31E24] hover:bg-[#c8191e] text-white rounded-lg text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
              >
                {createMutation.isPending ? 'Saving...' : 'Create Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
