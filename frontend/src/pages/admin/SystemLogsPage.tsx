import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { systemLogsAPI, GetLogsParams } from '../../api/systemLogs';
import { staffManagementAPI } from '../../api/staffManagement';
import { usePermissions } from '../../utils/usePermissions';
import { StaffMember } from '../../types';

const ACTION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  login: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  logout: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  login_failed: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  create_staff: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  update_staff: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
  reset_staff_password: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  toggle_staff_status: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20' },
  delete_staff: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
  create_job_card: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20' },
  update_job_card: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
  update_job_status: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  complete_job_card: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  delete_job_card: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
};

const ACTION_LABELS: Record<string, string> = {
  login: 'LOGIN SUCCESS',
  logout: 'LOGOUT',
  login_failed: 'LOGIN FAILED',
  create_staff: 'CREATE STAFF',
  update_staff: 'UPDATE STAFF',
  reset_staff_password: 'RESET PASSWORD',
  toggle_staff_status: 'TOGGLE STATUS',
  delete_staff: 'DELETE STAFF',
  create_job_card: 'CREATE JOB CARD',
  update_job_card: 'UPDATE JOB CARD',
  update_job_status: 'TRANSITION STATUS',
  complete_job_card: 'COMPLETE JOB',
  delete_job_card: 'DELETE JOB CARD',
};

export default function SystemLogsPage() {
  const navigate = useNavigate();
  const { isAdminRole } = usePermissions();

  // Filter States
  const [page, setPage] = useState(1);
  const [staffId, setStaffId] = useState('');
  const [actionType, setActionType] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const limit = 20;

  // Debounced/Buffered Search trigger is done by queryKey dependencies
  const filterParams: GetLogsParams = {
    page,
    limit,
    staff_id: staffId || undefined,
    action_type: actionType || undefined,
    search: search || undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
  };

  // Queries
  const { data: logsRes, isLoading: logsLoading } = useQuery({
    queryKey: ['systemLogs', filterParams],
    queryFn: () => systemLogsAPI.getLogs(filterParams),
    enabled: isAdminRole,
  });

  const { data: staffRes } = useQuery({
    queryKey: ['adminStaffList'],
    queryFn: () => staffManagementAPI.listAll(),
    enabled: isAdminRole,
  });

  const logs = logsRes?.data?.data?.logs || [];
  const pagination = logsRes?.data?.data?.pagination || { total: 0, totalPages: 1 };
  const staffList = (staffRes?.data?.data || []) as StaffMember[];

  // Access check
  if (!isAdminRole) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6 text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
          <span className="material-symbols-outlined text-[32px]">gpp_bad</span>
        </div>
        <h1 className="font-display-hero text-headline-md text-white mb-2 uppercase tracking-wide">
          Access Denied
        </h1>
        <p className="text-tertiary max-w-sm mb-6 text-sm font-medium">
          You do not have the required clearance to access the Audit Logs control panel.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-6 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-white transition-all font-label-caps text-xs tracking-wider font-bold uppercase active:scale-95"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const handleResetFilters = () => {
    setPage(1);
    setStaffId('');
    setActionType('');
    setSearch('');
    setStartDate('');
    setEndDate('');
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPage(newPage);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-[2px] bg-performance-red" />
            <span className="font-label-caps text-[10px] tracking-[0.2em] text-performance-red uppercase font-bold">
              SYSTEM SECURITY &amp; COMPLIANCE
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase">
            Audit logs
          </h1>
          <p className="text-sm text-tertiary mt-1">
            Browse staff login sessions, record updates, password resets, and details on who performed specific job card actions.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search Input */}
          <div className="space-y-1.5 col-span-1 sm:col-span-2">
            <label className="text-[10px] uppercase font-bold text-tertiary font-label-caps">Search Description</label>
            <div className="relative">
              <input
                type="text"
                className="w-full bg-white/5 border border-white/5 focus:border-performance-red/50 rounded-xl p-3 pl-10 text-xs text-white placeholder-tertiary/30 focus:outline-none focus:ring-0 font-bold"
                placeholder="Search description, job code, etc..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              <span className="material-symbols-outlined absolute left-3 top-3 text-tertiary/40 text-[18px]">search</span>
            </div>
          </div>

          {/* Action Filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-tertiary font-label-caps">Action Type</label>
            <select
              className="w-full bg-[#0c0c0c] border border-white/5 focus:border-performance-red/50 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-0 font-bold cursor-pointer"
              value={actionType}
              onChange={(e) => {
                setActionType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Actions</option>
              {Object.entries(ACTION_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {/* Staff Filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-tertiary font-label-caps">Staff Member</label>
            <select
              className="w-full bg-[#0c0c0c] border border-white/5 focus:border-performance-red/50 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-0 font-bold cursor-pointer"
              value={staffId}
              onChange={(e) => {
                setStaffId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Staff</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name} ({s.staff_code})</option>
              ))}
            </select>
          </div>

          {/* Date range filters */}
          <div className="grid grid-cols-2 gap-2 col-span-1">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-tertiary font-label-caps">From</label>
              <input
                type="date"
                className="w-full bg-white/5 border border-white/5 focus:border-performance-red/50 rounded-xl p-3 text-[10px] text-white focus:outline-none focus:ring-0 font-bold cursor-pointer"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-tertiary font-label-caps">To</label>
              <input
                type="date"
                className="w-full bg-white/5 border border-white/5 focus:border-performance-red/50 rounded-xl p-3 text-[10px] text-white focus:outline-none focus:ring-0 font-bold cursor-pointer"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 border border-white/10 hover:bg-white/5 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Main Logs Table */}
      {logsLoading ? (
        <div className="py-20 text-center text-tertiary/50 italic font-bold">
          Retrieving system logs history...
        </div>
      ) : (
        <div className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl space-y-4">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-black/35 text-tertiary/75 text-[10px] font-label-caps border-b border-white/5 uppercase tracking-widest font-bold">
                  <th className="py-4 px-6">Timestamp</th>
                  <th className="py-4 px-6">Action Category</th>
                  <th className="py-4 px-6">Actor</th>
                  <th className="py-4 px-6">Activity Description</th>
                  <th className="py-4 px-6">Connection Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-on-surface font-semibold font-data-sm">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-tertiary/40 italic font-bold">
                      No system logs found matching the selected criteria.
                    </td>
                  </tr>
                ) : (
                  logs.map((log: any) => {
                    const statusCfg = ACTION_COLORS[log.action_type] || {
                      bg: 'bg-gray-500/10',
                      text: 'text-gray-400',
                      border: 'border-gray-500/20',
                    };
                    const dateStr = new Date(log.created_at).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true,
                    });
                    
                    return (
                      <tr key={log.id} className="hover:bg-white/[0.01] transition-colors">
                        <td className="py-4 px-6 text-tertiary/70 font-mono text-[10px]">
                          {dateStr}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg ${statusCfg.bg} border ${statusCfg.border} ${statusCfg.text} text-[8px] font-label-caps uppercase tracking-wider`}>
                            {ACTION_LABELS[log.action_type] || log.action_type}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          {log.staff_id ? (
                            <div>
                              <p className="text-white font-extrabold">{log.staff_name}</p>
                              <p className="text-[9px] text-tertiary/40 uppercase font-label-caps mt-0.5">{log.staff_role}</p>
                            </div>
                          ) : (
                            <span className="text-tertiary/40 italic font-bold uppercase tracking-wider text-[10px]">System / Guest</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-white font-bold leading-normal max-w-sm">
                          {log.description}
                        </td>
                        <td className="py-4 px-6 text-tertiary/50 font-mono text-[10px]">
                          <p className="text-[9px] tracking-tight">{log.ip_address || 'No IP'}</p>
                          <p className="text-[8px] truncate max-w-[150px] mt-0.5" title={log.user_agent}>
                            {log.user_agent || 'Unknown UA'}
                          </p>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-between items-center px-6 py-4 border-t border-white/5 bg-black/15">
              <span className="text-[10px] text-tertiary font-bold">
                Showing Page {pagination.page} of {pagination.totalPages} (Total Logs: {pagination.total})
              </span>

              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1.5 bg-white/5 border border-white/5 text-white hover:bg-white/10 rounded-lg text-[10px] uppercase font-bold disabled:opacity-30 disabled:hover:bg-white/5 cursor-pointer transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === pagination.totalPages}
                  className="px-3 py-1.5 bg-white/5 border border-white/5 text-white hover:bg-white/10 rounded-lg text-[10px] uppercase font-bold disabled:opacity-30 disabled:hover:bg-white/5 cursor-pointer transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
