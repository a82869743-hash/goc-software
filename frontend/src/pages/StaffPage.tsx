import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffAPI, StaffMember, TodayAttendanceRow } from '../api/staff';
import toast from 'react-hot-toast';

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
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<StaffRole | 'all'>('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'roster' | 'today' | 'attendance_history' | 'clockin'>('roster');

  // Attendance history filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyStaffId, setHistoryStaffId] = useState<string | number>('');
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  const [historyDateFrom, setHistoryDateFrom] = useState(defaultFrom);
  const [historyDateTo, setHistoryDateTo] = useState(defaultTo);

  // Advances local states
  const [newAdvanceAmount, setNewAdvanceAmount] = useState('');
  const [newAdvanceNotes, setNewAdvanceNotes] = useState('');
  const [newAdvanceDate, setNewAdvanceDate] = useState(new Date().toISOString().slice(0, 16));

  // Running clock for biometric terminal simulator
  const [currentTime, setCurrentTime] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Biometric interaction state
  const [biometricStatus, setBiometricStatus] = useState('Scanning for Token...');
  const [biometricState, setBiometricState] = useState<'idle' | 'scanning' | 'success'>('idle');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [showAttEditModal, setShowAttEditModal] = useState(false);

  // Form states
  const [newStaffForm, setNewStaffForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    role: 'technician' as StaffRole,
    salary_type: 'monthly' as 'monthly' | 'daily',
    salary_amount: 15000,
    join_date: new Date().toISOString().split('T')[0],
    status: 'active' as 'active' | 'on_leave' | 'resigned',
    password: '',
  });

  const [attEditForm, setAttEditForm] = useState({
    staff_id: 0,
    staff_name: '',
    status: 'present',
    check_in_time: '09:00',
    check_out_time: '18:00',
    notes: '',
  });

  // Simulated GPS Self Check-in State
  const [gpsSimulated, setGpsSimulated] = useState({
    latitude: '22.3072',
    longitude: '73.1812',
    selfieAttached: false,
    notes: '',
  });

  // API QUERIES
  const { data: staffRes, isLoading: isStaffLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffAPI.list(),
  });
  const staffMembers = (staffRes?.data || []) as StaffMember[];

  const { data: todayAttendanceRes } = useQuery({
    queryKey: ['todayAttendance'],
    queryFn: () => staffAPI.todayAttendance(),
    enabled: activeTab === 'today',
  });
  const todayAttendance = (todayAttendanceRes?.data || []) as TodayAttendanceRow[];

  const { data: selectedStaffDetailRes, refetch: refetchStaffDetail } = useQuery({
    queryKey: ['staffDetails', selectedStaffId],
    queryFn: () => staffAPI.getById(selectedStaffId!),
    enabled: !!selectedStaffId,
  });
  const activeStaffDetail = selectedStaffDetailRes?.data;

  // Advances query
  const { data: advancesRes, refetch: refetchAdvances } = useQuery({
    queryKey: ['staffAdvances', selectedStaffId],
    queryFn: () => staffAPI.getAdvances(selectedStaffId!),
    enabled: !!selectedStaffId,
  });
  const advances = advancesRes?.data || [];

  // Attendance history query
  const { data: attendanceHistoryRes, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['attendanceHistory', { date_from: historyDateFrom, date_to: historyDateTo, staff_id: historyStaffId, search: historySearch }],
    queryFn: () => staffAPI.getAttendanceHistory({ date_from: historyDateFrom, date_to: historyDateTo, staff_id: historyStaffId, search: historySearch }),
    enabled: activeTab === 'attendance_history',
  });
  const attendanceHistory = attendanceHistoryRes?.data || [];

  // MUTATIONS
  const createStaffMutation = useMutation({
    mutationFn: (payload: any) => staffAPI.create(payload),
    onSuccess: () => {
      toast.success('Staff profile registered successfully!');
      setShowAddModal(false);
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setNewStaffForm({
        full_name: '',
        phone: '',
        email: '',
        role: 'technician',
        salary_type: 'monthly',
        salary_amount: 15000,
        join_date: new Date().toISOString().split('T')[0],
        status: 'active',
        password: '',
      });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to register staff profile');
    },
  });

  const markAttendanceMutation = useMutation({
    mutationFn: (payload: { staff_id: number; status: string; notes?: string; check_in_time?: string | null; check_out_time?: string | null }) =>
      staffAPI.markAttendance(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todayAttendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceHistory'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to update attendance');
    },
  });

  const updateStaffMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => staffAPI.update(id, payload),
    onSuccess: () => {
      toast.success('Staff profile updated!');
      refetchStaffDetail();
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to update staff profile');
    },
  });

  // Advance Payment Mutations
  const createAdvanceMutation = useMutation({
    mutationFn: (payload: { staff_id: number; amount: number; notes?: string; advance_date?: string }) =>
      staffAPI.createAdvance(payload),
    onSuccess: () => {
      toast.success('Advance payment logged!');
      refetchAdvances();
      setNewAdvanceAmount('');
      setNewAdvanceNotes('');
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to log advance payment');
    }
  });

  const settleAdvanceMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'deducted' | 'unpaid' }) =>
      staffAPI.settleAdvance(id, status),
    onSuccess: () => {
      toast.success('Advance status updated!');
      refetchAdvances();
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to update status');
    }
  });

  // Clock-in simulated action
  const handleSimulatedClockin = (status: 'present' | 'late') => {
    if (!gpsSimulated.selfieAttached) {
      toast.error('Please snap selfie verification to satisfy biometric check-in');
      return;
    }

    setBiometricState('scanning');
    setBiometricStatus('VERIFYING BIOMETRICS...');

    setTimeout(() => {
      const activeTech = staffMembers.find((s) => s.status === 'active');
      if (!activeTech) {
        toast.error('No active technician registered in database');
        setBiometricState('idle');
        setBiometricStatus('Scanning for Token...');
        return;
      }

      markAttendanceMutation.mutate({
        staff_id: activeTech.id,
        status: status,
        notes: `GPS Coordinate: ${gpsSimulated.latitude}, ${gpsSimulated.longitude}. Selfie verified. ${gpsSimulated.notes}`,
      });

      setBiometricState('success');
      setBiometricStatus(`GRANTED: ${activeTech.full_name.toUpperCase()}`);

      toast.success(`Biometric match verified! Registered as ${status.toUpperCase()}`);

      setTimeout(() => {
        setBiometricState('idle');
        setBiometricStatus('Scanning for Token...');
        setActiveTab('today');
      }, 2000);
    }, 1200);
  };

  const filtered = staffMembers.filter((s) => {
    const q = search.toLowerCase();
    const ms = !q || s.full_name.toLowerCase().includes(q) || s.staff_code.toLowerCase().includes(q);
    const mr = roleFilter === 'all' || s.role === roleFilter;
    return ms && mr;
  });

  const activeCount = staffMembers.filter((s) => s.status === 'active').length;

  // --- CSV DOWNLOAD EXPORTERS ---

  const downloadCSV = (filename: string, headers: string[], rows: string[][]) => {
    const BOM = '\uFEFF';
    const csvContent = BOM + [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map(r => r.map(cell => {
        const val = cell === null || cell === undefined ? '' : String(cell);
        return `"${val.replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAttendanceHistoryDownload = () => {
    const headers = [
      'Date', 'Staff Code', 'Staff Name', 'Role', 'Status',
      'Entry Time (Check-In)', 'Leaving Time (Check-Out)', 'Working Hours', 'Notes'
    ];
    const rows = attendanceHistory.map((att: any) => [
      att.date || '',
      att.staff_code || '',
      att.staff_name || '',
      att.role || '',
      att.status || '',
      att.check_in_time ? new Date(att.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      att.check_out_time ? new Date(att.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      String(att.working_hours || ''),
      att.notes || ''
    ]);
    downloadCSV(`Attendance_History_${historyDateFrom}_to_${historyDateTo}.csv`, headers, rows);
  };

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
            Manage roles, compensation, real-time biometric GPS logs, advances borrowing, and daily attendance tracking.
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

          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-performance-red to-[#93000a] text-white hover:shadow-[0_0_25px_rgba(255,43,43,0.4)] transition-all font-label-caps text-label-caps tracking-wider flex items-center gap-2 active:scale-95 duration-300 font-bold"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span>Register Staff Member</span>
          </button>
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

      {/* TABS CONTROLLER */}
      <div className="flex border-b border-white/5 gap-8 mb-4">
        <button
          onClick={() => setActiveTab('roster')}
          className={`pb-4 font-label-caps text-label-caps tracking-widest transition-all duration-300 relative ${
            activeTab === 'roster'
              ? 'text-performance-red border-b-2 border-performance-red shadow-[0_4px_12px_rgba(255,43,43,0.15)] font-extrabold'
              : 'text-tertiary hover:text-white font-bold'
          }`}
        >
          STAFF MANIFEST
        </button>
        <button
          onClick={() => setActiveTab('today')}
          className={`pb-4 font-label-caps text-label-caps tracking-widest transition-all duration-300 relative ${
            activeTab === 'today'
              ? 'text-performance-red border-b-2 border-performance-red shadow-[0_4px_12px_rgba(255,43,43,0.15)] font-extrabold'
              : 'text-tertiary hover:text-white font-bold'
          }`}
        >
          DAILY ATTENDANCE LOGS
        </button>
        <button
          onClick={() => setActiveTab('attendance_history')}
          className={`pb-4 font-label-caps text-label-caps tracking-widest transition-all duration-300 relative ${
            activeTab === 'attendance_history'
              ? 'text-performance-red border-b-2 border-performance-red shadow-[0_4px_12px_rgba(255,43,43,0.15)] font-extrabold'
              : 'text-tertiary hover:text-white font-bold'
          }`}
        >
          ATTENDANCE HISTORY
        </button>
        <button
          onClick={() => setActiveTab('clockin')}
          className={`pb-4 font-label-caps text-label-caps tracking-widest transition-all duration-300 relative ${
            activeTab === 'clockin'
              ? 'text-performance-red border-b-2 border-performance-red shadow-[0_4px_12px_rgba(255,43,43,0.15)] font-extrabold'
              : 'text-tertiary hover:text-white font-bold'
          }`}
        >
          SIMULATE BIOMETRICS
        </button>
      </div>

      {/* TAB 1: ROSTER DIRECTORY */}
      {activeTab === 'roster' && (
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
                    onClick={() => {
                      setSelectedStaffId(s.id);
                      setNewAdvanceAmount('');
                      setNewAdvanceNotes('');
                    }}
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
              <table className="w-full text-left border-collapse">
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
                        onClick={() => {
                          setSelectedStaffId(s.id);
                          setNewAdvanceAmount('');
                          setNewAdvanceNotes('');
                        }}
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
          )}
        </div>
      )}

      {/* TAB 2: DAILY ATTENDANCE ROSTER */}
      {activeTab === 'today' && (
        <div className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-black/25">
            <div className="flex items-center gap-2">
              <span className="w-1 h-5 bg-gradient-to-b from-performance-red to-[#930100] rounded-full shadow-[0_0_10px_rgba(255,43,43,0.5)]"></span>
              <h3 className="font-label-caps text-label-caps tracking-wider text-white/90 uppercase font-bold">
                Daily attendance logs ({new Date().toLocaleDateString()})
              </h3>
            </div>
            <span className="text-[10px] text-tertiary/50 font-label-caps uppercase tracking-wider font-bold">
              Shift Gate limit: 09:30 AM
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/35 text-tertiary/75 text-[10px] font-label-caps border-b border-white/5 uppercase tracking-widest font-bold">
                  <th className="py-4.5 px-6 font-normal">Personnel Operator</th>
                  <th className="py-4.5 px-6 font-normal">Active Role</th>
                  <th className="py-4.5 px-6 font-normal">Attendance Status</th>
                  <th className="py-4.5 px-6 font-normal">Entry Time (In)</th>
                  <th className="py-4.5 px-6 font-normal">Leaving Time (Out)</th>
                  <th className="py-4.5 px-6 font-normal">Biometric GPS Telemetry</th>
                  <th className="py-4.5 px-6 text-center font-normal">Manual Log Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-data-sm text-on-surface font-bold text-xs">
                {todayAttendance.map((row) => (
                  <tr
                    key={row.staff_id}
                    className="hover:bg-performance-red/[0.01] transition-colors"
                  >
                    <td className="py-4 px-6">
                      <p className="text-sm font-extrabold text-white font-body-lg">{row.full_name}</p>
                      <p className="font-data-sm text-[10px] text-tertiary/40 mt-1">Code: {row.staff_code}</p>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-label-caps text-[10px] text-tertiary/80 uppercase">
                        {row.role}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {row.att_status ? (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-label-caps border font-bold uppercase tracking-wider ${
                            row.att_status === 'present'
                              ? 'bg-green-500/10 text-green-400 border-green-500/20'
                              : row.att_status === 'late'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-performance-red/10 text-performance-red border-performance-red/20'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${row.att_status === 'present' ? 'bg-green-400 animate-pulse' : row.att_status === 'late' ? 'bg-amber-400' : 'bg-performance-red'}`} />
                          {row.att_status}
                        </span>
                      ) : (
                        <span className="text-tertiary/30 italic font-body-lg">No Shift Records</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-white font-data-sm">
                      {row.check_in_time ? new Date(row.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="py-4 px-6 text-white font-data-sm">
                      {row.check_out_time ? new Date(row.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="py-4 px-6 max-w-xs truncate text-tertiary/60 font-data-sm">
                      {row.notes ? (
                        <div className="flex items-center gap-2 text-emerald-400/80">
                          <span className="material-symbols-outlined text-[16px]">verified_user</span>
                          <span>{row.notes}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-tertiary/30">
                          <span className="material-symbols-outlined text-[16px]">public_off</span>
                          <span>Pending verification</span>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setAttEditForm({
                              staff_id: row.staff_id,
                              staff_name: row.full_name,
                              status: row.att_status || 'present',
                              check_in_time: row.check_in_time ? new Date(row.check_in_time).toTimeString().split(' ')[0].slice(0, 5) : '09:00',
                              check_out_time: row.check_out_time ? new Date(row.check_out_time).toTimeString().split(' ')[0].slice(0, 5) : '18:00',
                              notes: row.notes || '',
                            });
                            setShowAttEditModal(true);
                          }}
                          className="bg-performance-red/10 border border-performance-red/25 text-performance-red hover:bg-performance-red hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-label-caps transition-all font-bold cursor-pointer"
                        >
                          Adjust Log
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ATTENDANCE HISTORY LOGS */}
      {activeTab === 'attendance_history' && (
        <div className="space-y-6">
          {/* History Filters */}
          <div className="flex flex-wrap items-end gap-4 bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 p-5 rounded-2xl">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <label className="text-[10px] font-extrabold text-tertiary uppercase tracking-wider">Search logs</label>
              <input
                type="text"
                placeholder="Search staff name or code ID..."
                className="bg-black/30 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-performance-red w-full font-bold"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 w-48">
              <label className="text-[10px] font-extrabold text-tertiary uppercase tracking-wider">Staff Member</label>
              <select
                className="bg-black/30 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-performance-red w-full font-bold"
                value={historyStaffId}
                onChange={e => setHistoryStaffId(e.target.value)}
              >
                <option value="">All Staff</option>
                {staffMembers.map(s => (
                  <option key={s.id} value={s.id} className="bg-[#0c0c0c]">{s.full_name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 w-44">
              <label className="text-[10px] font-extrabold text-tertiary uppercase tracking-wider">Date From</label>
              <input
                type="date"
                className="bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-performance-red w-full font-bold"
                value={historyDateFrom}
                onChange={e => setHistoryDateFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 w-44">
              <label className="text-[10px] font-extrabold text-tertiary uppercase tracking-wider">Date To</label>
              <input
                type="date"
                className="bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-performance-red w-full font-bold"
                value={historyDateTo}
                onChange={e => setHistoryDateTo(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAttendanceHistoryDownload}
                disabled={!attendanceHistory?.length}
                className="bg-emerald-600/15 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/25 px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-all hover:cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed h-10 shadow-[0_0_10px_rgba(16,185,129,0.05)]"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Export Excel
              </button>
            </div>
          </div>

          {/* History Ledger Table */}
          <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
            {isHistoryLoading ? (
              <div className="py-20 text-center text-tertiary/50 italic flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-performance-red border-t-transparent rounded-full animate-spin" />
                Querying Attendance History...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black/45 text-on-surface-variant/50 text-[9px] font-label-caps uppercase tracking-widest border-b border-white/[0.06] font-bold">
                      {['Date', 'Staff Code', 'Staff Member', 'Role', 'Status', 'Entry Time (In)', 'Leaving Time (Out)', 'Hours', 'Notes'].map(h => (
                        <th key={h} className="py-3.5 px-5 font-normal">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="font-data-sm text-xs divide-y divide-white/[0.02] font-bold">
                    {attendanceHistory.map((att: any) => {
                      return (
                        <tr key={att.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="py-3.5 px-5 text-white font-extrabold font-body-lg">
                            {new Date(att.date).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-5 text-performance-red font-bold font-data-sm">
                            {att.staff_code}
                          </td>
                          <td className="py-3.5 px-5 text-white font-extrabold font-body-lg">
                            {att.staff_name}
                          </td>
                          <td className="py-3.5 px-5 text-tertiary capitalize">
                            {att.role}
                          </td>
                          <td className="py-3.5 px-5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                              att.status === 'present' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                              att.status === 'late' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                              att.status === 'half_day' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                              att.status === 'leave' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                              'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                              {att.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-white font-data-sm">
                            {att.check_in_time ? new Date(att.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="py-3.5 px-5 text-white font-data-sm">
                            {att.check_out_time ? new Date(att.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="py-3.5 px-5 text-white font-bold font-data-sm">
                            {att.working_hours ? `${att.working_hours} hrs` : '—'}
                          </td>
                          <td className="py-3.5 px-5 text-tertiary max-w-xs truncate">
                            {att.notes || '—'}
                          </td>
                        </tr>
                      );
                    })}
                    {!attendanceHistory.length && (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-tertiary/40 italic">
                          No logged attendance history found for selection.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SIMULATE BIOMETRICS */}
      {activeTab === 'clockin' && (
        <div className="grid grid-cols-12 gap-6 items-start">
          {/* Biometric Terminal UI (Col span 7) */}
          <section className="col-span-12 lg:col-span-7 bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 md:p-8 flex flex-col relative min-h-[480px] overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none group-hover:opacity-10 transition-opacity">
              <span className="material-symbols-outlined text-8xl text-performance-red">fingerprint</span>
            </div>

            <div className="flex items-center gap-2 mb-6 relative z-10 font-bold">
              <div className="w-2.5 h-2.5 bg-performance-red rounded-full animate-pulse shadow-[0_0_8px_rgba(255,43,43,0.8)]"></div>
              <h3 className="font-label-caps text-label-caps text-tertiary uppercase tracking-widest">
                Biometric Gateway Terminal Alpha
              </h3>
            </div>

            <div className="flex flex-col md:flex-row gap-6 relative z-10">
              {/* Webcam simulator screen */}
              <div className="w-full md:w-1/2 aspect-video bg-black/80 rounded-xl border border-white/5 overflow-hidden relative shadow-2xl min-h-[200px]">
                <img
                  alt="Biometric Capture Camera feed"
                  className="w-full h-full object-cover opacity-50 grayscale hover:grayscale-0 transition-all duration-1000"
                  src="https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&q=80&w=600"
                />
                <div className="absolute inset-0 flex flex-col justify-between p-4 bg-gradient-to-t from-black/95 via-transparent to-transparent">
                  <div className="flex justify-between items-start font-bold">
                    <span className="font-data-sm text-[9px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25 tracking-widest uppercase">
                      LIVE CAMERA FEED
                    </span>
                    <span className="font-data-sm text-[9px] text-tertiary/40">
                      CH: 01_BIOMETRIC
                    </span>
                  </div>
                  <div className="space-y-0.5 font-bold">
                    <p className="font-data-sm text-[9px] text-performance-red/60">LAT: 22.3072° N</p>
                    <p className="font-data-sm text-[9px] text-performance-red/60">LONG: 73.1812° E</p>
                  </div>
                </div>
                {/* Tech Scanning Line Overlay Animation */}
                <div
                  className={`absolute left-0 w-full h-[2px] bg-performance-red/70 shadow-[0_0_15px_rgba(255,43,43,1)] transition-all duration-300`}
                  style={{
                    animation: biometricState === 'scanning' ? 'scan 0.3s infinite linear' : 'scan 3s infinite linear',
                    position: 'absolute',
                  }}
                />
              </div>

              {/* Biometric trigger controls */}
              <div className="w-full md:w-1/2 flex flex-col justify-between min-h-[220px]">
                <div className="space-y-4">
                  <div className="bg-black/40 border border-white/5 rounded-xl p-4 border-l-2 border-l-performance-red shadow-inner font-bold">
                    <p className="font-label-caps text-[9px] text-tertiary/45 mb-1.5 tracking-wider">
                      GATEWAY IDENTITY ACCESS
                    </p>
                    <p
                      className={`font-headline-md text-base font-bold ${
                        biometricState === 'success'
                          ? 'text-emerald-400 animate-none'
                          : biometricState === 'scanning'
                          ? 'text-performance-red animate-pulse'
                          : 'text-white'
                      }`}
                    >
                      {biometricStatus}
                    </p>
                  </div>

                  <div className="bg-black/40 border border-white/5 rounded-xl p-4 border-l-2 border-l-white/10 shadow-inner font-bold">
                    <p className="font-label-caps text-[9px] text-tertiary/45 mb-1.5 tracking-wider">
                      SECURED TIME MATRIX
                    </p>
                    <p className="font-data-lg text-lg text-white font-semibold">
                      {currentTime || 'Syncing...'}
                    </p>
                  </div>
                </div>

                <div className="h-16 flex items-center justify-center text-center font-label-caps text-xs text-tertiary bg-white/[0.02] border border-white/5 rounded-xl p-3 shadow-inner font-bold">
                  Simulate verification telemetry details on the right card panel.
                </div>
              </div>
            </div>
          </section>

          {/* Biometric Telemetry coordinates config (Col span 5) */}
          <section className="col-span-12 lg:col-span-5 bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 md:p-8 flex flex-col gap-5 shadow-2xl relative font-bold">
            <h3 className="font-label-caps text-label-caps text-tertiary tracking-wider uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-performance-red animate-pulse"></span>
              Verification Parameters Config
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 font-data-sm text-xs">
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps uppercase mb-1.5 tracking-wider">
                    GPS LATITUDE
                  </label>
                  <input
                    type="text"
                    value={gpsSimulated.latitude}
                    onChange={(e) => setGpsSimulated({ ...gpsSimulated, latitude: e.target.value })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-3 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps uppercase mb-1.5 tracking-wider">
                    GPS LONGITUDE
                  </label>
                  <input
                    type="text"
                    value={gpsSimulated.longitude}
                    onChange={(e) => setGpsSimulated({ ...gpsSimulated, longitude: e.target.value })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-3 text-white"
                  />
                </div>
              </div>

              {/* Snap selfie verification simulator */}
              <div className="bg-black/35 border border-white/5 rounded-2xl p-4 flex items-center justify-between shadow-inner group">
                <div className="flex items-center gap-3 text-xs">
                  <span className="material-symbols-outlined text-tertiary/50 group-hover:text-performance-red transition-colors duration-300">
                    photo_camera
                  </span>
                  <div>
                    <p className="text-white font-semibold font-body-lg">
                      Snap Selfie verification
                    </p>
                    <p className="text-tertiary/40 font-data-sm text-[10px] mt-0.5">
                      {gpsSimulated.selfieAttached ? 'Selfie verification secured.' : 'Click to snap live biometric selfie'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setGpsSimulated({ ...gpsSimulated, selfieAttached: true });
                    toast.success('Selfie upload trace successfully logged!');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-label-caps transition-all duration-300 active:scale-95 cursor-pointer font-bold ${
                    gpsSimulated.selfieAttached
                      ? 'bg-emerald-600/10 border border-emerald-500/25 text-emerald-400'
                      : 'bg-performance-red text-white hover:shadow-[0_0_15px_rgba(255,43,43,0.3)]'
                  }`}
                >
                  {gpsSimulated.selfieAttached ? 'VERIFIED' : 'SNAP'}
                </button>
              </div>

              <div>
                <label className="block text-[10px] text-tertiary font-label-caps uppercase mb-1.5 tracking-wider">
                  Self Reporting Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Report any shifts exceptions or reason details..."
                  value={gpsSimulated.notes}
                  onChange={(e) => setGpsSimulated({ ...gpsSimulated, notes: e.target.value })}
                  className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-2xl p-3 text-xs text-white resize-none font-body-lg"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleSimulatedClockin('present')}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-800 text-white py-3.5 rounded-xl font-label-caps text-label-caps tracking-widest text-center active:scale-95 transition-all shadow-lg font-bold cursor-pointer"
                >
                  CLOCK IN ON TIME
                </button>
                <button
                  type="button"
                  onClick={() => handleSimulatedClockin('late')}
                  className="flex-1 bg-gradient-to-r from-amber-600 to-amber-800 text-white py-3.5 rounded-xl font-label-caps text-label-caps tracking-widest text-center active:scale-95 transition-all shadow-lg font-bold cursor-pointer"
                >
                  CLOCK IN LATE
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ROSTER PROFILE DRAWER SHEET */}
      {selectedStaffId && activeStaffDetail && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/75 backdrop-blur-md">
          <div className="absolute inset-0 z-0 bg-transparent" onClick={() => setSelectedStaffId(null)} />
          <div className="bg-[#050505] border-l border-white/5 w-full max-w-xl h-full flex flex-col p-8 overflow-y-auto relative z-10 shadow-2xl custom-scrollbar font-bold text-xs">
            <div className="absolute -top-32 -right-32 w-64 h-64 bg-performance-red/[0.03] blur-[120px] pointer-events-none" />

            <div className="flex justify-between items-start mb-8 border-b border-white/5 pb-5">
              <div>
                <span className="bg-performance-red/10 border border-performance-red/25 text-performance-red font-label-caps text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-widest">
                  Staff Telemetry Dossier
                </span>
                <h3 className="text-xl font-bold text-white mt-3 uppercase tracking-wide font-display-hero">
                  {activeStaffDetail.full_name}
                </h3>
                <p className="font-data-sm text-xs text-tertiary/40 mt-1">Staff code: {activeStaffDetail.staff_code}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStaffId(null)}
                className="text-tertiary hover:text-white p-2 hover:bg-white/5 rounded-xl transition-all duration-300 cursor-pointer"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {/* Operational form configurations */}
            <div className="space-y-6">
              <h4 className="font-label-caps text-xs text-tertiary tracking-wider uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-performance-red rounded-full" />
                Operational Configurations
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Roster Status
                  </label>
                  <select
                    value={activeStaffDetail.status}
                    onChange={(e) =>
                      updateStaffMutation.mutate({
                        id: activeStaffDetail.id,
                        payload: { status: e.target.value },
                      })
                    }
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-3 text-xs text-white font-body-lg"
                  >
                    <option value="active" className="bg-[#050505]">Active</option>
                    <option value="on_leave" className="bg-[#050505]">On Leave</option>
                    <option value="resigned" className="bg-[#050505]">Resigned</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Hangar Role
                  </label>
                  <select
                    value={activeStaffDetail.role}
                    onChange={(e) =>
                      updateStaffMutation.mutate({
                        id: activeStaffDetail.id,
                        payload: { role: e.target.value },
                      })
                    }
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-3 text-xs text-white font-body-lg"
                  >
                    <option value="admin" className="bg-[#050505]">Admin</option>
                    <option value="technician" className="bg-[#050505]">Technician</option>
                    <option value="receptionist" className="bg-[#050505]">Receptionist</option>
                    <option value="manager" className="bg-[#050505]">Manager</option>
                    <option value="staff" className="bg-[#050505]">Staff</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 font-data-sm text-xs">
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Salary Compensation (₹)
                  </label>
                  <input
                    type="number"
                    defaultValue={activeStaffDetail.salary_amount}
                    onBlur={(e) =>
                      updateStaffMutation.mutate({
                        id: activeStaffDetail.id,
                        payload: { salary_amount: Number(e.target.value) },
                      })
                    }
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-3 text-white text-right font-data-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Mobile Trace
                  </label>
                  <input
                    type="text"
                    defaultValue={activeStaffDetail.phone}
                    onBlur={(e) =>
                      updateStaffMutation.mutate({
                        id: activeStaffDetail.id,
                        payload: { phone: e.target.value },
                      })
                    }
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-3 text-white text-right font-data-sm"
                  />
                </div>
              </div>
            </div>

            {/* Advances Log Section */}
            <div className="mt-8 border-t border-white/5 pt-6">
              <h4 className="font-label-caps text-xs text-tertiary tracking-wider mb-4 uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-performance-red rounded-full" />
                Advances & Borrowed Cash
              </h4>

              {/* Record Advance Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newAdvanceAmount || isNaN(Number(newAdvanceAmount))) {
                    toast.error('Please enter a valid amount');
                    return;
                  }
                  createAdvanceMutation.mutate({
                    staff_id: activeStaffDetail.id,
                    amount: Number(newAdvanceAmount),
                    notes: newAdvanceNotes,
                    advance_date: newAdvanceDate.replace('T', ' ') + ':00'
                  });
                }}
                className="bg-white/[0.02] border border-white/5 p-4 rounded-xl space-y-3 mb-4 shadow-inner"
              >
                <p className="text-[10px] font-bold text-tertiary uppercase tracking-wider">Log New Advance Payment</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[8px] text-tertiary font-label-caps mb-1 uppercase tracking-wider">Amount (₹)</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 5000"
                      className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-lg p-2 text-xs text-white"
                      value={newAdvanceAmount}
                      onChange={e => setNewAdvanceAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] text-tertiary font-label-caps mb-1 uppercase tracking-wider">Date & Time</label>
                    <input
                      type="datetime-local"
                      required
                      className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-lg p-2 text-xs text-white"
                      value={newAdvanceDate}
                      onChange={e => setNewAdvanceDate(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[8px] text-tertiary font-label-caps mb-1 uppercase tracking-wider">Notes / Purpose</label>
                  <input
                    type="text"
                    placeholder="e.g. Festival advance, emergency correction..."
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-lg p-2 text-xs text-white"
                    value={newAdvanceNotes}
                    onChange={e => setNewAdvanceNotes(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={createAdvanceMutation.isPending}
                  className="w-full bg-emerald-600/10 hover:bg-emerald-600/25 border border-emerald-500/25 text-emerald-400 py-2 rounded-lg text-[10px] font-label-caps transition-all font-bold cursor-pointer"
                >
                  {createAdvanceMutation.isPending ? 'Logging Payout...' : 'Record Advance Payout'}
                </button>
              </form>

              {/* Advances History List */}
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                {advances && advances.length > 0 ? (
                  advances.map((adv: any) => (
                    <div
                      key={adv.id}
                      className="bg-white/[0.01] border border-white/5 p-3 rounded-xl flex justify-between items-center text-xs font-data-sm hover:border-white/10 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-white font-extrabold text-sm">₹{Number(adv.amount).toLocaleString('en-IN')}</p>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider ${
                            adv.status === 'unpaid' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'
                          }`}>
                            {adv.status === 'unpaid' ? 'Unpaid' : 'Deducted'}
                          </span>
                        </div>
                        <p className="text-[10px] text-tertiary/60 mt-1 font-bold">
                          {new Date(adv.advance_date).toLocaleString('en-IN')}
                        </p>
                        {adv.notes && <p className="text-[10px] text-tertiary mt-1 italic font-normal">"{adv.notes}"</p>}
                      </div>
                      
                      {adv.status === 'unpaid' && (
                        <button
                          type="button"
                          onClick={() => settleAdvanceMutation.mutate({ id: adv.id, status: 'deducted' })}
                          className="bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 hover:bg-emerald-500 hover:text-white px-2 py-1 rounded text-[8px] font-label-caps transition-all font-bold cursor-pointer"
                        >
                          Settle/Deduct
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-tertiary/30 italic font-bold">
                    No logged cash advance records.
                  </div>
                )}
              </div>
            </div>

            {/* Attendance logs lists */}
            <div className="mt-8 border-t border-white/5 pt-6">
              <h4 className="font-label-caps text-xs text-tertiary tracking-wider mb-4 uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-white/20 rounded-full" />
                Recent Roster Logs (30 Shifts)
              </h4>

              <div className="space-y-2">
                {activeStaffDetail.attendance && activeStaffDetail.attendance.length > 0 ? (
                  activeStaffDetail.attendance.map((att: any) => (
                    <div
                      key={att.id}
                      className="bg-white/[0.01] border border-white/5 p-4 rounded-xl flex justify-between items-center text-xs font-data-sm hover:border-white/10 transition-colors"
                    >
                      <div>
                        <p className="text-white font-semibold font-body-lg">
                          {new Date(att.date).toLocaleDateString()}
                        </p>
                        <p className="text-[10px] text-tertiary/40 mt-1 font-data-sm">
                          CheckIn: {att.check_in_time ? new Date(att.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'} · CheckOut: {att.check_out_time ? new Date(att.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[9px] font-label-caps font-bold border uppercase tracking-wider ${
                          att.status === 'present'
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : att.status === 'late'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : att.status === 'half_day'
                            ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                            : att.status === 'leave'
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                            : 'bg-performance-red/10 text-performance-red border-performance-red/20'
                        }`}
                      >
                        {att.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-tertiary/30 italic font-body-lg">
                    No logged attendance records detected.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MANUAL ATTENDANCE ADJUSTMENT LOG */}
      {showAttEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md">
          <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl p-6 max-w-md w-full relative shadow-2xl overflow-hidden font-bold text-xs">
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-performance-red/[0.04] blur-[60px] pointer-events-none" />
            <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
              <h3 className="font-display-hero text-base font-black text-white uppercase tracking-wider">
                Adjust Attendance Log
              </h3>
              <button
                type="button"
                onClick={() => setShowAttEditModal(false)}
                className="text-tertiary hover:text-white p-1 hover:bg-white/5 rounded-lg transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                markAttendanceMutation.mutate({
                  staff_id: attEditForm.staff_id,
                  status: attEditForm.status,
                  notes: attEditForm.notes,
                  check_in_time: attEditForm.status === 'absent' || attEditForm.status === 'leave' ? null : attEditForm.check_in_time + ':00',
                  check_out_time: attEditForm.status === 'absent' || attEditForm.status === 'leave' ? null : attEditForm.check_out_time + ':00',
                }, {
                  onSuccess: () => {
                    toast.success('Attendance updated!');
                    setShowAttEditModal(false);
                    queryClient.invalidateQueries({ queryKey: ['todayAttendance'] });
                    queryClient.invalidateQueries({ queryKey: ['attendanceHistory'] });
                  }
                });
              }}
              className="space-y-4"
            >
              <div className="bg-white/[0.02] p-3 rounded-lg border border-white/5 mb-3">
                <p className="text-tertiary text-[10px] uppercase font-bold tracking-wider">Operator</p>
                <p className="text-white text-sm font-extrabold mt-1 font-body-lg">{attEditForm.staff_name}</p>
              </div>

              <div>
                <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                  Attendance Status
                </label>
                <select
                  value={attEditForm.status}
                  onChange={(e) => setAttEditForm({ ...attEditForm, status: e.target.value })}
                  className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-2.5 text-xs text-white"
                >
                  <option value="present" className="bg-[#0c0c0c]">Present</option>
                  <option value="late" className="bg-[#0c0c0c]">Late</option>
                  <option value="half_day" className="bg-[#0c0c0c]">Half Day</option>
                  <option value="absent" className="bg-[#0c0c0c]">Absent</option>
                  <option value="leave" className="bg-[#0c0c0c]">Approved Leave</option>
                </select>
              </div>

              {attEditForm.status !== 'absent' && attEditForm.status !== 'leave' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                      Entry Time (Check-In)
                    </label>
                    <input
                      type="time"
                      required
                      value={attEditForm.check_in_time}
                      onChange={(e) => setAttEditForm({ ...attEditForm, check_in_time: e.target.value })}
                      className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-2.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                      Leaving Time (Check-Out)
                    </label>
                    <input
                      type="time"
                      required
                      value={attEditForm.check_out_time}
                      onChange={(e) => setAttEditForm({ ...attEditForm, check_out_time: e.target.value })}
                      className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-2.5 text-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                  Operational Notes / Reason
                </label>
                <textarea
                  rows={2}
                  placeholder="Reason for adjustment, manual timing logs overrides..."
                  value={attEditForm.notes}
                  onChange={(e) => setAttEditForm({ ...attEditForm, notes: e.target.value })}
                  className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-2xl p-3 text-xs text-white resize-none font-body-lg"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAttEditModal(false)}
                  className="flex-1 bg-white/5 border border-white/10 py-2.5 rounded-xl text-xs font-label-caps text-tertiary hover:text-white transition-all cursor-pointer font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={markAttendanceMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-performance-red to-[#93000a] py-2.5 rounded-xl text-xs font-label-caps text-white hover:shadow-[0_0_20px_rgba(255,43,43,0.3)] transition-all font-bold cursor-pointer"
                >
                  {markAttendanceMutation.isPending ? 'Saving...' : 'Save Shift Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW CREW PROFILE REGISTRATION */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md">
          <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl p-6 max-w-lg w-full relative shadow-2xl overflow-hidden font-bold text-xs">
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-performance-red/[0.04] blur-[60px] pointer-events-none" />
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-display-hero text-lg font-black text-white uppercase tracking-wider">
                Roster Profile Registration
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-tertiary hover:text-white p-1 hover:bg-white/5 rounded-lg transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createStaffMutation.mutate(newStaffForm);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Full Roster Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Parth Patel"
                    value={newStaffForm.full_name}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, full_name: e.target.value })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-white font-body-lg"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Mobile Contact
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="10-digit phone"
                    value={newStaffForm.phone}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, phone: e.target.value })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-white font-data-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Email address
                  </label>
                  <input
                    type="email"
                    placeholder="name@gocstudio.com"
                    value={newStaffForm.email}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-white font-body-lg"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Hangar Roster Role
                  </label>
                  <select
                    value={newStaffForm.role}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, role: e.target.value as StaffRole })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-2.5 text-xs text-white font-body-lg"
                  >
                    <option value="admin" className="bg-[#0c0c0c]">Admin</option>
                    <option value="technician" className="bg-[#0c0c0c]">Technician</option>
                    <option value="receptionist" className="bg-[#0c0c0c]">Receptionist</option>
                    <option value="manager" className="bg-[#0c0c0c]">Manager</option>
                    <option value="staff" className="bg-[#0c0c0c]">Staff</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 font-data-sm text-xs">
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Salary Compensation Type
                  </label>
                  <select
                    value={newStaffForm.salary_type}
                    onChange={(e) =>
                      setNewStaffForm({ ...newStaffForm, salary_type: e.target.value as any })
                    }
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-2.5 text-xs text-white font-body-lg"
                  >
                    <option value="monthly" className="bg-[#0c0c0c]">Monthly Salary</option>
                    <option value="daily" className="bg-[#0c0c0c]">Daily Wages</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Compensation Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={newStaffForm.salary_amount}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, salary_amount: Number(e.target.value) })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-2.5 text-white text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Joining Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newStaffForm.join_date}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, join_date: e.target.value })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-2.5 text-white font-data-sm focus:border-performance-red/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                    Roster Status
                  </label>
                  <select
                    value={newStaffForm.status}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, status: e.target.value as any })}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-2.5 text-xs text-white font-body-lg"
                  >
                    <option value="active" className="bg-[#0c0c0c]">Active</option>
                    <option value="on_leave" className="bg-[#0c0c0c]">On Leave</option>
                    <option value="resigned" className="bg-[#0c0c0c]">Resigned</option>
                  </select>
                </div>
              </div>

              {/* Added required password input */}
              <div>
                <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider">
                  Default Login Password
                </label>
                <input
                  type="text"
                  required
                  placeholder="Choose login password (min 6 characters)"
                  value={newStaffForm.password}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, password: e.target.value })}
                  className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-white"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-white/5 border border-white/10 py-2.5 rounded-xl text-xs font-label-caps text-tertiary hover:text-white transition-all cursor-pointer font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createStaffMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-performance-red to-[#93000a] py-2.5 rounded-xl text-xs font-label-caps text-white hover:shadow-[0_0_20px_rgba(255,43,43,0.3)] transition-all font-bold cursor-pointer"
                >
                  {createStaffMutation.isPending ? 'Registering...' : 'Confirm Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
