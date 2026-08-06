import React from 'react';
import type { Lead } from '../../types';

interface LeadListViewProps {
  filteredLeads: Lead[];
  onLeadClick: (leadId: number) => void;
  selectedLeadIds: number[];
  onSelectAll: (checked: boolean) => void;
  onSelectToggle: (leadId: number) => void;
}

export const LeadListView: React.FC<LeadListViewProps> = ({
  filteredLeads,
  onLeadClick,
  selectedLeadIds,
  onSelectAll,
  onSelectToggle,
}) => {
  const allSelected =
    filteredLeads.length > 0 && selectedLeadIds.length === filteredLeads.length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col w-full">
      <div className="overflow-x-auto flex-1 custom-scrollbar">
        <table className="w-full min-w-[850px] text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <th className="p-3.5 w-12 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="rounded border-slate-300 text-[#E31E24] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
              </th>
              <th className="p-3.5">Lead Code</th>
              <th className="p-3.5">Customer Name</th>
              <th className="p-3.5">Phone</th>
              <th className="p-3.5">Vehicle Specs</th>
              <th className="p-3.5">Source</th>
              <th className="p-3.5">Staff Agent</th>
              <th className="p-3.5">Stage</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-sans text-slate-800">
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-12 text-center italic text-slate-400">
                  No lead records match your criteria.
                </td>
              </tr>
            ) : (
              filteredLeads.map((lead, idx) => {
                const vehicle = [lead.vehicle_make, lead.vehicle_model]
                  .filter(Boolean)
                  .join(' ');
                const isSelected = selectedLeadIds.includes(lead.id);

                return (
                  <tr
                    key={lead.id}
                    onClick={() => onLeadClick(lead.id)}
                    className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                      idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'
                    } ${isSelected ? 'bg-red-50/30' : ''}`}
                  >
                    <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onSelectToggle(lead.id)}
                        className="rounded border-slate-300 text-[#E31E24] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                    </td>

                    <td className="p-3.5 font-mono text-xs font-bold text-slate-500">
                      #{lead.lead_code}
                    </td>

                    <td className="p-3.5 font-bold text-slate-900">
                      {lead.full_name}
                    </td>

                    <td className="p-3.5 font-mono text-slate-600 font-semibold">
                      <a
                        href={`tel:${lead.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-slate-900 transition-colors"
                      >
                        {lead.phone}
                      </a>
                    </td>

                    <td className="p-3.5 text-slate-700 font-medium">
                      {vehicle || '—'}
                    </td>

                    <td className="p-3.5 capitalize font-semibold text-slate-700">
                      {lead.source}
                    </td>

                    <td className="p-3.5 text-slate-600">
                      {lead.assigned_staff_name || 'Unassigned'}
                    </td>

                    <td className="p-3.5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                        {lead.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={`tel:${lead.phone}`}
                          className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all border border-slate-200/60"
                          title="Call"
                        >
                          <span className="material-symbols-outlined text-[16px]">call</span>
                        </a>
                        <button
                          onClick={() => onLeadClick(lead.id)}
                          className="w-8 h-8 rounded-lg bg-[#E31E24] hover:bg-[#c8191e] text-white flex items-center justify-center transition-all shadow-xs border border-red-600 shrink-0"
                          title="View Details"
                        >
                          <span className="material-symbols-outlined text-[18px] font-bold">visibility</span>
                        </button>
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
  );
};
