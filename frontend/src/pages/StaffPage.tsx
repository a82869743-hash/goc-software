import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { staffAPI, StaffMember } from '../api/staff';

type StaffRole = 'admin' | 'technician' | 'receptionist' | 'manager' | 'staff';

const ROLE_CFG: Record<StaffRole, { label: string; color: string; bg: string; border: string }> = {
  admin: { label: 'Admin', color: 'text-performance-red', bg: 'bg-performance-red/10', border: 'border-performance-red/25' },
  technician: { label: 'Technician', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  receptionist: { label: 'Receptionist', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  manager: { label: 'Manager', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  staff: { label: 'Staff', color: 'text-tertiary', bg: 'bg-white/5', border: 'border-white/10' },
};

const STATUS_CFG: Record<string, { label: string; dot: string; text: string }> = {
  active: { label: 'Active', dot: 'bg-emerald-400 shadow-[0_0_8px_#10B981]', text: 'text-emerald-400 font-bold' },
  on_leave: { label: 'On Leave', dot: 'bg-amber-400 animate-pulse', text: 'text-amber-400' },
  resigned: { label: 'Resigned', dot: 'bg-tertiary/40', text: 'text-tertiary/40' },
  inactive: { label: 'Inactive', dot: 'bg-tertiary/40', text: 'text-tertiary/40' },
};

const AVATAR_COLORS = [
  'from-performance-red/40 to-[#690000]',
  'from-blue-600/40 to-blue-900/60',
  'from-purple-600/40 to-purple-900/60',
  'from-emerald-600/40 to-emerald-900/60',
  'from-amber-600/40 to-amber-900/60',
  'from-pink-600/40 to-pink-900/60',
  'from-indigo-600/40 to-indigo-900/60',
];

export default function StaffPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<StaffRole | 'all'>('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  // API QUERIES
  const { data: staffRes, isLoading: isStaffLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffAPI.list(),
  });
  const staffMembers = (staffRes?.data || []) as StaffMember[];

  const filtered = staffMembers.filter((s) => {
    const q = search.toLowerCase();
    const ms = !q || s.full_name.toLowerCase().includes(q) || s.staff_code.toLowerCase().includes(q);
    const mr = roleFilter === 'all' || s.role === roleFilter;
    return ms && mr;
  });

  const activeCount = staffMembers.filter((s) => s.status === 'active').length;

  return (
    <div className="space-y-8 relative z-10 font-medium pb-10">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-[2px] bg-performance-red"></div>
            <span className="font-label-caps text-label-caps text-performance-red tracking-[0.3em] uppercase">
              Operations &amp; Roster Control
            </span>
          </div>
          <h1 className="font-display-hero text-headline-lg text-white tracking-tight font-extrabold">
            Personnel Manifest
          </h1>
          <p className="font-body-lg text-body-lg text-tertiary mt-1.5 max-w-2xl font-bold">
            View active roster details, roles, rates, and detailed biometrics telemetry profiles.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 bg-[#0c0c0c]/60 border border-white/5 rounded-xl">
            {(['grid', 'list'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`w-9 h-8 rounded-lg flex items-center justify-center transition-all ${
                  view === v 
                    ? 'bg-white/10 text-white shadow-xl' 
                    : 'text-tertiary/40 hover:text-tertiary'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {v === 'grid' ? 'grid_view' : 'view_list'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* QUICK BENTO KPI NUMBERS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-5 flex items-center gap-4 shadow-2xl">
          <div className="w-12 h-12 bg-white/5 rounded-xl border border-white/5 flex items-center justify-center text-white">
            <span className="material-symbols-outlined">group</span>
          </div>
          <div>
            <p className="text-[10px] text-tertiary/50 uppercase tracking-widest font-label-caps font-bold">Roster size</p>
            <p className="text-2xl font-bold text-white font-data-lg mt-0.5">{staffMembers.length}</p>
          </div>
        </div>

        <div className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-5 flex items-center gap-4 shadow-2xl">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-xl border border-emerald-500/10 flex items-center justify-center text-emerald-400">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <div>
            <p className="text-[10px] text-tertiary/50 uppercase tracking-widest font-label-caps font-bold">Active Techs</p>
            <p className="text-2xl font-bold text-emerald-400 font-data-lg mt-0.5">{activeCount}</p>
          </div>
        </div>

        <div className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-5 flex items-center gap-4 shadow-2xl">
          <div className="w-12 h-12 bg-amber-500/10 rounded-xl border border-amber-500/10 flex items-center justify-center text-amber-400">
            <span className="material-symbols-outlined">event_busy</span>
          </div>
          <div>
            <p className="text-[10px] text-tertiary/50 uppercase tracking-widest font-label-caps font-bold">On Leaves</p>
            <p className="text-2xl font-bold text-amber-400 font-data-lg mt-0.5">
              {staffMembers.filter((s) => s.status === 'on_leave').length}
            </p>
          </div>
        </div>

        <div className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-5 flex items-center gap-4 shadow-2xl">
          <div className="w-12 h-12 bg-blue-500/10 rounded-xl border border-blue-500/10 flex items-center justify-center text-blue-400">
            <span className="material-symbols-outlined">engineering</span>
          </div>
          <div>
            <p className="text-[10px] text-tertiary/50 uppercase tracking-widest font-label-caps font-bold">Tech Crew</p>
            <p className="text-2xl font-bold text-blue-400 font-data-lg mt-0.5">
              {staffMembers.filter((s) => s.role === 'technician').length}
            </p>
          </div>
        </div>
      </div>

      {/* ROSTER DIRECTORY */}
      <div className="space-y-6">
        {/* Filters Bar */}
        <div className="flex justify-between items-center flex-wrap gap-4 bg-[#0c0c0c]/40 border border-white/5 rounded-2xl px-5 py-4 backdrop-blur-2xl">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-tertiary/45 text-[18px]">
              search
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff name or code ID..."
              className="w-64 bg-white/5 border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-tertiary/40 font-bold"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', 'admin', 'technician', 'receptionist', 'manager', 'staff'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3.5 py-2 rounded-xl text-[10px] font-label-caps uppercase tracking-widest transition-all duration-300 font-bold ${
                  roleFilter === r
                    ? 'bg-performance-red/10 border border-performance-red/35 text-performance-red shadow-[0_0_12px_rgba(255,43,43,0.15)]'
                    : 'bg-white/5 border border-white/10 text-tertiary hover:text-white hover:bg-white/10'
                }`}
              >
                {r === 'all' ? 'All Roles' : ROLE_CFG[r as StaffRole]?.label ?? r}
              </button>
            ))}
          </div>
        </div>

        {/* Directory Rendering (Grid/List) */}
        {isStaffLoading ? (
          <div className="py-20 text-center text-tertiary/50 italic font-bold">
            Acquiring crew roster data...
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filtered.map((s, idx) => {
              const roleCfg = ROLE_CFG[s.role as StaffRole] || ROLE_CFG.staff;
              const statusCfg = STATUS_CFG[s.status] || STATUS_CFG.active;
              const grad = AVATAR_COLORS[idx % AVATAR_COLORS.length];
              return (
                <div
                  key={s.id}
                  onClick={() => navigate(`/staff/${s.id}`)}
                  className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 hover:border-performance-red/20 hover:bg-performance-red/[0.01] rounded-2xl p-6 flex flex-col gap-4 shadow-2xl relative overflow-hidden group transition-all duration-300 active:scale-[0.98] cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${grad} border border-white/10 flex items-center justify-center text-sm font-bold text-white shadow-inner`}
                    >
                      {s.full_name
                        .split(' ')
                        .map((w) => w[0])
                        .join('')
                        .slice(0, 2)}
                    </div>
                    <div className={`flex items-center gap-1.5 text-[9px] font-label-caps font-bold uppercase ${statusCfg.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                      {statusCfg.label}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-extrabold text-white group-hover:text-performance-red transition-colors font-body-lg">
                      {s.full_name}
                    </p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg ${roleCfg.bg} border ${roleCfg.border} ${roleCfg.color} text-[8px] font-label-caps uppercase tracking-wider`}>
                      {roleCfg.label}
                    </span>
                    <p className="font-data-sm text-[10px] text-tertiary/40 pt-1.5 font-bold">
                      ID: {s.staff_code}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5 font-data-sm text-xs font-bold">
                    <div>
                      <p className="text-[9px] text-tertiary/50 uppercase font-label-caps tracking-wider">Salary Cycle</p>
                      <p className="font-bold text-white mt-1 capitalize font-body-lg">{s.salary_type}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-tertiary/50 uppercase font-label-caps tracking-wider">Amount</p>
                      <p className="font-bold text-performance-red mt-1 font-data-lg">₹{Number(s.salary_amount).toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  <p className="font-data-sm text-[10px] text-tertiary/60 font-bold">{s.phone}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left border-collapse">
                <thead>
                  <tr className="bg-black/35 text-tertiary/75 text-[10px] font-label-caps border-b border-white/5 uppercase tracking-widest font-bold">
                    <th className="py-4.5 px-6 font-normal">Staff Member</th>
                    <th className="py-4.5 px-6 font-normal">Active Role</th>
                    <th className="py-4.5 px-6 font-normal">Manifest Status</th>
                    <th className="py-4.5 px-6 text-right font-normal">Compensation Rate</th>
                    <th className="py-4.5 px-6 font-normal">Registration Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-data-sm text-on-surface">
                  {filtered.map((s, idx) => {
                    const roleCfg = ROLE_CFG[s.role as StaffRole] || ROLE_CFG.staff;
                    const statusCfg = STATUS_CFG[s.status] || STATUS_CFG.active;
                    const grad = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                    return (
                      <tr
                        key={s.id}
                        onClick={() => navigate(`/staff/${s.id}`)}
                        className="hover:bg-performance-red/[0.02] border-l-2 border-l-transparent hover:border-l-performance-red/60 transition-all cursor-pointer group duration-300"
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-lg bg-gradient-to-br ${grad} border border-white/10 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0`}
                            >
                              {s.full_name
                                .split(' ')
                                .map((w) => w[0])
                                .join('')
                                .slice(0, 2)}
                            </div>
                            <div>
                              <p className="text-sm font-extrabold text-white group-hover:text-performance-red transition-colors font-body-lg">
                                {s.full_name}
                              </p>
                              <p className="text-[10px] font-data-sm text-tertiary/40 font-bold">
                                {s.phone}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg ${roleCfg.bg} border ${roleCfg.border} ${roleCfg.color} text-[8px] font-label-caps uppercase tracking-wider`}>
                            {roleCfg.label}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-data-sm">
                          <div className={`flex items-center gap-1.5 font-bold ${statusCfg.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                            {statusCfg.label}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right font-data-lg text-white font-extrabold">
                          ₹{Number(s.salary_amount).toLocaleString('en-IN')}{' '}
                          <span className="text-xs text-tertiary/60 font-body-lg capitalize">
                            ({s.salary_type})
                          </span>
                        </td>
                        <td className="py-4 px-6 font-data-sm text-tertiary/60 font-bold">
                          {new Date(s.join_date).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
