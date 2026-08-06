import React from 'react';
import type { Lead, LeadStatus } from '../../types';
import { LeadCard } from './LeadCard';

interface LeadKanbanBoardProps {
  filteredLeads: Lead[];
  onLeadClick: (leadId: number) => void;
  selectedLeadIds: number[];
  onSelectToggle: (leadId: number, e: React.MouseEvent) => void;
  onStatusChange: (leadId: number, targetStatus: LeadStatus) => void;
}

// 4 Active Categories (QUOTED and CONVERTED removed per user directive)
export const KANBAN_STAGES: {
  status: LeadStatus;
  label: string;
  dotColor: string;
}[] = [
  { status: 'new', label: 'New', dotColor: 'bg-blue-500' },
  { status: 'contacted', label: 'Contacted', dotColor: 'bg-amber-500' },
  { status: 'interested', label: 'Qualified', dotColor: 'bg-purple-500' },
  { status: 'lost', label: 'Lost', dotColor: 'bg-slate-400' },
];

export const LeadKanbanBoard: React.FC<LeadKanbanBoardProps> = ({
  filteredLeads,
  onLeadClick,
  selectedLeadIds,
  onSelectToggle,
  onStatusChange,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 pb-6 select-none items-start w-full">
      {KANBAN_STAGES.map((stage) => {
        const stageLeads = filteredLeads.filter((l) => l.status === stage.status);

        return (
          <div
            key={stage.status}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const leadId = Number(e.dataTransfer.getData('text/plain'));
              if (leadId) {
                onStatusChange(leadId, stage.status);
              }
            }}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl flex flex-col shadow-xs min-h-[850px]"
          >
            {/* Header: Clean & Spacious */}
            <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center shrink-0 rounded-t-2xl">
              <div className="flex items-center gap-2.5">
                <span className={`w-2.5 h-2.5 rounded-full ${stage.dotColor}`} />
                <h2 className="text-xs font-bold text-slate-900 font-sans tracking-tight uppercase">
                  {stage.label}
                </h2>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                {stageLeads.length}
              </span>
            </div>

            {/* Cards Stack — Expanded height to easily show 6+ leads per category */}
            <div className="p-3.5 flex-1 flex flex-col gap-3 custom-scrollbar min-h-[750px] max-h-[1100px] overflow-y-auto">
              {stageLeads.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
                  <span className="material-symbols-outlined text-3xl mb-1.5 opacity-40">inbox</span>
                  <p className="text-xs font-medium uppercase tracking-wider">No Leads</p>
                </div>
              ) : (
                stageLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onClick={() => onLeadClick(lead.id)}
                    selected={selectedLeadIds.includes(lead.id)}
                    onSelectToggle={(e) => onSelectToggle(lead.id, e)}
                    onStatusChange={onStatusChange}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
