import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffAPI, StaffMember, TodayAttendanceRow, PaymentRequest } from '../api/staff';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';

type StaffRole = 'admin' | 'manager' | 'salesman' | 'staff';

const ROLE_CFG: Record<StaffRole, { label: string; color: string; bg: string; border: string }> = {
  admin: { label: 'Admin', color: 'text-performance-red', bg: 'bg-performance-red/10', border: 'border-performance-red/25' },
  manager: { label: 'Manager', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  salesman: { label: 'Salesman', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  staff: { label: 'Staff', color: 'text-tertiary', bg: 'bg-white/5', border: 'border-white/10' },
};

export default function StaffAttendancePaymentsPage() {
  const queryClient = useQueryClient();
  const { staff: currentStaff } = useAuthStore();
  const currentRole = currentStaff?.role;
  const isManagerOrAdmin = ['manager', 'admin'].includes(currentRole || '');

  // Sub Tab: attendance vs requests
  const [subTab, setSubTab] = useState<'attendance' | 'requests'>('attendance');

  // Tab 1: Daily Attendance Manifest states
  const [attendanceDate, setAttendanceDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Tab 2: Salary & Payments states
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  });

  // Log new advance states
  const [advanceAmount, setAdvanceAmount] = useState<string>('');
  const [advanceNotes, setAdvanceNotes] = useState<string>('');
  const [advanceDate, setAdvanceDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );

  // Payment requests states
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [filterRequestStatus, setFilterRequestStatus] = useState<string>('all');
  const [requestForm, setRequestForm] = useState({
    amount: '',
    request_type: 'advance' as 'advance' | 'salary' | 'incentive' | 'reimbursement',
    reason: '',
    notes: ''
  });

  // 1. Fetch all staff members (for selection dropdown and labels)
  const { data: staffRes } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffAPI.list(),
  });
  const staffMembers = (staffRes?.data || []) as StaffMember[];
  const activeStaffMembers = staffMembers.filter(s => s.status === 'active');

  // 2. Fetch daily attendance list for the selected date
  const { data: todayAttendanceRes, isLoading: isAttendanceLoading } = useQuery({
    queryKey: ['attendanceByDate', attendanceDate],
    queryFn: () => staffAPI.todayAttendance(attendanceDate),
  });
  const attendanceList = (todayAttendanceRes?.data || []) as TodayAttendanceRow[];

  // 3. Fetch advances for selected staff member
  const { data: advancesRes, refetch: refetchAdvances } = useQuery({
    queryKey: ['staffAdvances', selectedStaffId],
    queryFn: () => staffAPI.getAdvances(Number(selectedStaffId)),
    enabled: !!selectedStaffId,
  });
  const advances = advancesRes?.data || [];
  const unpaidAdvances = advances.filter((adv: any) => adv.status === 'unpaid');
  const unpaidAdvancesSum = unpaidAdvances.reduce((acc: number, adv: any) => acc + Number(adv.amount), 0);

  // 4. Calculate month boundaries & fetch monthly attendance history for selected staff
  const getMonthDateRange = (monthStr: string) => {
    if (!monthStr) return { date_from: '', date_to: '', totalDays: 30 };
    const [year, month] = monthStr.split('-').map(Number);
    const totalDays = new Date(year, month, 0).getDate();
    const mm = String(month).padStart(2, '0');
    return {
      date_from: `${year}-${mm}-01`,
      date_to: `${year}-${mm}-${String(totalDays).padStart(2, '0')}`,
      totalDays,
    };
  };

  const { date_from, date_to, totalDays } = getMonthDateRange(selectedMonth);

  const { data: monthlyAttendanceRes, isLoading: isMonthlyAttendanceLoading, refetch: refetchMonthlyAttendance } = useQuery({
    queryKey: ['staffMonthlyAttendance', selectedStaffId, selectedMonth],
    queryFn: () =>
      staffAPI.getAttendanceHistory({
        date_from,
        date_to,
        staff_id: Number(selectedStaffId),
      }),
    enabled: !!selectedStaffId && !!selectedMonth,
  });
  const monthlyAttendance = monthlyAttendanceRes?.data || [];

  // Mutations
  const createAdvanceMutation = useMutation({
    mutationFn: (payload: { staff_id: number; amount: number; notes?: string; advance_date?: string }) =>
      staffAPI.createAdvance(payload),
    onSuccess: () => {
      toast.success('Advance/borrow payment recorded!');
      refetchAdvances();
      setAdvanceAmount('');
      setAdvanceNotes('');
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to record advance payment.');
    },
  });

  const settleAdvanceMutation = useMutation({
    mutationFn: (id: number) => staffAPI.settleAdvance(id, 'deducted'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  // Payment Requests queries & mutations
  const { data: requestsRes, refetch: refetchRequests } = useQuery({
    queryKey: ['paymentRequests', filterRequestStatus],
    queryFn: () => staffAPI.getPaymentRequests(filterRequestStatus === 'all' ? undefined : { status: filterRequestStatus }),
  });
  const paymentRequests = requestsRes?.data || [];

  const createRequestMutation = useMutation({
    mutationFn: (payload: any) => staffAPI.createPaymentRequest(payload),
    onSuccess: () => {
      toast.success('Payment request submitted successfully!');
      setShowRequestModal(false);
      setRequestForm({ amount: '', request_type: 'advance', reason: '', notes: '' });
      refetchRequests();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Submission failed');
    }
  });

  const approveRequestMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { status: 'approved' | 'rejected'; notes?: string } }) =>
      staffAPI.approvePaymentRequest(id, payload),
    onSuccess: () => {
      toast.success('Payment request processed successfully!');
      refetchRequests();
      refetchAdvances();
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Processing failed');
    }
  });

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestForm.amount || Number(requestForm.amount) <= 0 || !requestForm.reason) {
      toast.error('Please fill in amount and reason.');
      return;
    }
    createRequestMutation.mutate({
      amount: Number(requestForm.amount),
      request_type: requestForm.request_type,
      reason: requestForm.reason,
      notes: requestForm.notes || undefined
    });
  };

  const handleSettleAllAdvances = async () => {
    if (unpaidAdvances.length === 0) {
      toast.success('No outstanding advances to settle.');
      return;
    }
    const settlePromises = unpaidAdvances.map((adv: any) => settleAdvanceMutation.mutateAsync(adv.id));
    try {
      await Promise.all(settlePromises);
      toast.success('All outstanding advances settled successfully!');
      refetchAdvances();
    } catch (error) {
      toast.error('Failed to settle some advances.');
    }
  };

  // Salary Calculations
  const selectedStaffObj = staffMembers.find(s => s.id === Number(selectedStaffId));
  const baseSalary = selectedStaffObj ? Number(selectedStaffObj.salary_amount) : 0;
  const dailyRate = totalDays > 0 ? baseSalary / totalDays : 0;

  // Compute attendance counts
  let presentCount = 0;
  let lateCount = 0;
  let leaveCount = 0;
  let halfDayCount = 0;
  let absentCount = 0;

  monthlyAttendance.forEach((att: any) => {
    if (att.status === 'present') presentCount++;
    else if (att.status === 'late') lateCount++;
    else if (att.status === 'leave') leaveCount++;
    else if (att.status === 'half_day') halfDayCount++;
    else if (att.status === 'absent') absentCount++;
  });

  const paidDays = presentCount + lateCount + leaveCount + halfDayCount * 0.5;
  const calculatedSalary = dailyRate * paidDays;
  const netSalary = calculatedSalary - unpaidAdvancesSum;

  // CSV Exporter
  const downloadCSV = (filename: string, headers: string[], rows: string[][]) => {
    const BOM = '\uFEFF';
    const csvContent =
      BOM +
      [
        headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
        ...rows.map(r =>
          r
            .map(cell => {
              const val = cell === null || cell === undefined ? '' : String(cell);
              return `"${val.replace(/"/g, '""')}"`;
            })
            .join(',')
        ),
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

  const handleExportAttendance = () => {
    const headers = [
      'Staff Code',
      'Staff Name',
      'Role',
      'Status',
      'Check-In Time',
      'Check-Out Time',
      'Notes',
    ];
    const rows = attendanceList.map(att => [
      att.staff_code || '',
      att.full_name || '',
      att.role || '',
      att.att_status || 'Absent',
      att.check_in_time
        ? new Date(att.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '',
      att.check_out_time
        ? new Date(att.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '',
      att.notes || '',
    ]);
    downloadCSV(`Staff_Attendance_${attendanceDate}.csv`, headers, rows);
  };

  return (
    <div className="space-y-8 relative z-10 font-medium pb-10 max-w-7xl mx-auto">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-[2px] bg-performance-red"></div>
            <span className="font-label-caps text-label-caps text-performance-red tracking-[0.3em] uppercase">
              Financials &amp; Attendance
            </span>
          </div>
          <h1 className="font-display-hero text-headline-lg text-white tracking-tight font-extrabold">
            Attendance &amp; Payments Roster
          </h1>
          <p className="font-body-lg text-body-lg text-tertiary mt-1.5 max-w-2xl font-bold">
            Inspect daily attendance, download reports, calculate monthly salaries with dynamic days division, and log advances.
          </p>
        </div>
      </div>

      {/* TWO SECTIONS: BENTO STYLE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT 2 COLUMNS: DAILY ATTENDANCE LEDGER */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4 border-b border-white/5 pb-5">
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setSubTab('attendance')}
                  className={`pb-2 font-label-caps text-xs uppercase tracking-wider font-extrabold transition-all border-b-2 ${
                    subTab === 'attendance'
                      ? 'text-performance-red border-performance-red'
                      : 'text-tertiary border-transparent hover:text-white'
                  }`}
                >
                  Daily Attendance
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab('requests')}
                  className={`pb-2 font-label-caps text-xs uppercase tracking-wider font-extrabold transition-all border-b-2 ${
                    subTab === 'requests'
                      ? 'text-performance-red border-performance-red'
                      : 'text-tertiary border-transparent hover:text-white'
                  }`}
                >
                  Payment Requests
                </button>
              </div>

              {subTab === 'attendance' && (
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={e => setAttendanceDate(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-performance-red font-bold font-data-sm"
                  />
                  <button
                    onClick={handleExportAttendance}
                    disabled={!attendanceList.length}
                    className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 px-3 py-2 rounded-xl text-[10px] font-label-caps uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed font-bold"
                  >
                    <span className="material-symbols-outlined text-[15px]">download</span>
                    Export Excel
                  </button>
                </div>
              )}

              {subTab === 'requests' && (
                <div className="flex items-center gap-3">
                  <select
                    value={filterRequestStatus}
                    onChange={e => setFilterRequestStatus(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-performance-red font-bold font-body-lg"
                  >
                    <option value="all">ALL STATUSES</option>
                    <option value="pending">PENDING</option>
                    <option value="approved">APPROVED</option>
                    <option value="rejected">REJECTED</option>
                  </select>
                  <button
                    onClick={() => setShowRequestModal(true)}
                    className="bg-gradient-to-r from-performance-red to-[#93000a] text-white border border-white/10 px-3 py-2 rounded-xl text-[10px] font-label-caps uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer font-bold"
                  >
                    <span className="material-symbols-outlined text-[15px]">add_circle</span>
                    New Request
                  </button>
                </div>
              )}
            </div>

            {/* Sub-Tab 1: Daily Attendance Manifest */}
            {subTab === 'attendance' && (
              isAttendanceLoading ? (
                <div className="py-20 text-center text-tertiary/50 italic flex flex-col items-center justify-center gap-3 font-bold">
                  <div className="w-8 h-8 border-2 border-performance-red border-t-transparent rounded-full animate-spin" />
                  Fetching Daily Attendance...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-black/35 text-tertiary/75 text-[10px] font-label-caps border-b border-white/5 uppercase tracking-widest font-extrabold">
                        <th className="py-3 px-4 font-normal">Personnel</th>
                        <th className="py-3 px-4 font-normal">Role</th>
                        <th className="py-3 px-4 font-normal">Status</th>
                        <th className="py-3 px-4 font-normal">In</th>
                        <th className="py-3 px-4 font-normal">Out</th>
                        <th className="py-3 px-4 font-normal">Verification Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-data-sm text-xs font-bold text-on-surface">
                      {attendanceList.map(att => (
                        <tr key={att.staff_id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="py-3.5 px-4">
                            <p className="text-white font-extrabold font-body-lg">{att.full_name}</p>
                            <p className="text-[10px] text-tertiary/40 font-bold mt-0.5">{att.staff_code}</p>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-tertiary font-label-caps text-[9px] uppercase tracking-wider">
                              {att.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-label-caps border font-bold uppercase tracking-wider ${
                                att.att_status === 'present'
                                  ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                  : att.att_status === 'late'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : att.att_status === 'half_day'
                                  ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                  : att.att_status === 'leave'
                                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                  : 'bg-performance-red/10 text-performance-red border-performance-red/20'
                              }`}
                            >
                              {att.att_status || 'absent'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-white font-data-sm">
                            {att.check_in_time
                              ? new Date(att.check_in_time).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-white font-data-sm">
                            {att.check_out_time
                              ? new Date(att.check_out_time).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-tertiary/60 font-normal truncate max-w-[150px]">
                            {att.notes || '—'}
                          </td>
                        </tr>
                      ))}
                      {!attendanceList.length && (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-tertiary/30 italic font-body-lg">
                            No personnel records on this date.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* Sub-Tab 2: Payment Requests Queue */}
            {subTab === 'requests' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black/35 text-tertiary/75 text-[10px] font-label-caps border-b border-white/5 uppercase tracking-widest font-extrabold">
                      <th className="py-3 px-4 font-normal">Personnel</th>
                      <th className="py-3 px-4 font-normal">Amount / Type</th>
                      <th className="py-3 px-4 font-normal">Reason / Note</th>
                      <th className="py-3 px-4 font-normal">Status</th>
                      <th className="py-3 px-4 font-normal">HR Approved By</th>
                      <th className="py-3 px-4 font-normal text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-data-sm text-xs font-bold text-on-surface">
                    {paymentRequests.map((req: any) => (
                      <tr key={req.id} className="hover:bg-white/[0.01] transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="text-white font-extrabold font-body-lg">{req.staff_name}</p>
                          <p className="text-[10px] text-tertiary/40 font-bold mt-0.5">{req.staff_code} ({req.staff_role?.toUpperCase()})</p>
                        </td>
                        <td className="py-3.5 px-4 text-white">
                          <p className="font-extrabold text-sm">₹{Number(req.amount).toLocaleString('en-IN')}</p>
                          <span className="text-[9px] uppercase tracking-wider text-tertiary/50 font-label-caps">{req.request_type}</span>
                        </td>
                        <td className="py-3.5 px-4 max-w-[200px] truncate">
                          <p className="text-white">{req.reason}</p>
                          {req.notes && <p className="text-tertiary/40 italic font-normal">"{req.notes}"</p>}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-label-caps border font-bold uppercase tracking-wider ${
                            req.status === 'approved'
                              ? 'bg-green-500/10 text-green-400 border-green-500/20'
                              : req.status === 'rejected'
                              ? 'bg-performance-red/10 text-performance-red border-performance-red/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-tertiary/60 font-body-lg">
                          {req.approved_by_name || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {req.status === 'pending' && isManagerOrAdmin ? (
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => approveRequestMutation.mutate({ id: req.id, payload: { status: 'approved' } })}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[9px] font-label-caps font-bold transition-all uppercase"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  const notes = prompt('Enter rejection reason:') || undefined;
                                  approveRequestMutation.mutate({ id: req.id, payload: { status: 'rejected', notes } });
                                }}
                                className="px-2.5 py-1.5 bg-performance-red hover:bg-red-500 text-white rounded-lg text-[9px] font-label-caps font-bold transition-all uppercase"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-tertiary/30 uppercase tracking-widest font-label-caps">LOCKED</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!paymentRequests.length && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-tertiary/30 italic font-body-lg">
                          No payment requests found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: PAYMENT SYSTEM & DEDUCTIONS */}
        <div className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 shadow-2xl space-y-6 relative h-fit">
          <div className="absolute top-0 right-0 w-32 h-32 bg-performance-red/[0.02] blur-[50px] pointer-events-none" />
          
          <div className="flex items-center gap-2 border-b border-white/5 pb-4">
            <span className="w-1.5 h-4 bg-performance-red rounded-full" />
            <h3 className="font-label-caps text-xs text-white uppercase tracking-wider font-extrabold">
              Salary & Advances Settlement
            </h3>
          </div>

          {/* Configuration Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider font-bold">
                Select Staff Member
              </label>
              <select
                value={selectedStaffId}
                onChange={e => setSelectedStaffId(e.target.value)}
                className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-3 text-xs text-white font-bold font-body-lg"
              >
                <option value="" className="bg-[#0c0c0c]">-- Select Active Staff --</option>
                {activeStaffMembers.map(s => (
                  <option key={s.id} value={s.id} className="bg-[#0c0c0c]">
                    {s.full_name} ({ROLE_CFG[s.role as StaffRole]?.label || s.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider font-bold">
                Select Month Cycle
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-3 text-xs text-white font-bold font-data-sm"
              />
            </div>
          </div>

          {/* Calculator Output */}
          {selectedStaffId ? (
            <div className="space-y-6 pt-2">
              <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-center text-xs font-bold font-body-lg">
                  <span className="text-tertiary/60">Base Salary:</span>
                  <span className="text-white">₹{baseSalary.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold font-body-lg">
                  <span className="text-tertiary/60">Days in Month:</span>
                  <span className="text-white">{totalDays} days</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold font-body-lg">
                  <span className="text-tertiary/60">Calculated Daily Rate:</span>
                  <span className="text-white">₹{dailyRate.toFixed(2)}</span>
                </div>

                <div className="border-t border-white/5 my-2"></div>

                {/* Attendance Summary */}
                {isMonthlyAttendanceLoading ? (
                  <div className="text-[10px] text-tertiary/40 italic py-1">Analyzing monthly sheets...</div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-tertiary uppercase tracking-wider font-label-caps font-bold">Attendance Summary:</p>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-tertiary/80 font-semibold font-body-lg">
                      <div>Present: <span className="text-green-400 font-bold">{presentCount}</span></div>
                      <div>Late Check-ins: <span className="text-amber-400 font-bold">{lateCount}</span></div>
                      <div>Paid Leaves: <span className="text-purple-400 font-bold">{leaveCount}</span></div>
                      <div>Half Days: <span className="text-orange-400 font-bold">{halfDayCount}</span></div>
                      <div>Absent days: <span className="text-performance-red font-bold">{absentCount}</span></div>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold font-body-lg mt-2 pt-1 border-t border-white/5">
                      <span className="text-tertiary/60">Total Paid Days:</span>
                      <span className="text-emerald-400">{paidDays} days</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold font-body-lg">
                      <span className="text-tertiary/60">Calculated Salary:</span>
                      <span className="text-white font-data-sm">₹{calculatedSalary.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Outstanding Advances */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-bold font-body-lg">
                  <span className="text-tertiary/60">Outstanding Advances:</span>
                  <span className="text-performance-red font-data-sm">₹{unpaidAdvancesSum.toLocaleString('en-IN')}</span>
                </div>

                {unpaidAdvances.length > 0 ? (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                    {unpaidAdvances.map((adv: any) => (
                      <div key={adv.id} className="bg-white/[0.01] border border-white/5 rounded-lg p-2.5 flex justify-between items-center text-[10px] font-bold">
                        <div>
                          <p className="text-white">₹{Number(adv.amount).toLocaleString('en-IN')}</p>
                          <p className="text-tertiary/40 font-data-sm mt-0.5">
                            {new Date(adv.advance_date).toLocaleDateString()}
                          </p>
                          {adv.notes && <p className="text-tertiary/50 italic font-normal">"{adv.notes}"</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-tertiary/30 italic">No borrow advances recorded for this staff.</p>
                )}
              </div>

              {/* Final Net Calculation */}
              <div className="bg-performance-red/10 border border-performance-red/25 p-4 rounded-xl space-y-1">
                <p className="text-[9px] text-performance-red uppercase font-label-caps tracking-widest font-extrabold">
                  Calculated Net salary (Payout)
                </p>
                <p className="text-[10px] text-tertiary/60 font-body-lg">Formula: calculated salary - outstanding advances</p>
                <p className="text-xl font-bold text-white font-data-lg pt-1">
                  ₹{netSalary.toFixed(2)}
                </p>
              </div>

              {/* Settle Action Button */}
              {unpaidAdvances.length > 0 && (
                <button
                  onClick={handleSettleAllAdvances}
                  disabled={settleAdvanceMutation.isPending}
                  className="w-full bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/25 text-emerald-400 py-2.5 rounded-xl text-[10px] font-label-caps transition-all font-bold cursor-pointer"
                >
                  {settleAdvanceMutation.isPending ? 'Settling Advances...' : 'Deduct & Settle Advances'}
                </button>
              )}

              {/* Log new manual advance field */}
              <div className="border-t border-white/5 pt-4 space-y-3">
                <p className="text-[10px] font-bold text-tertiary uppercase tracking-wider font-label-caps">Log Advance / Borrow Payment</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[8px] text-tertiary font-label-caps mb-1 uppercase tracking-wider">Amount (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 5000"
                      value={advanceAmount}
                      onChange={e => setAdvanceAmount(e.target.value)}
                      className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-lg p-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] text-tertiary font-label-caps mb-1 uppercase tracking-wider">Date</label>
                    <input
                      type="datetime-local"
                      value={advanceDate}
                      onChange={e => setAdvanceDate(e.target.value)}
                      className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-lg p-2 text-xs text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[8px] text-tertiary font-label-caps mb-1 uppercase tracking-wider">Notes / Purpose</label>
                  <input
                    type="text"
                    placeholder="e.g. Loan advance, emergency payout..."
                    value={advanceNotes}
                    onChange={e => setAdvanceNotes(e.target.value)}
                    className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-lg p-2 text-xs text-white"
                  />
                </div>
                <button
                  onClick={() => {
                    if (!advanceAmount || isNaN(Number(advanceAmount)) || Number(advanceAmount) <= 0) {
                      toast.error('Please input a valid advance amount');
                      return;
                    }
                    createAdvanceMutation.mutate({
                      staff_id: Number(selectedStaffId),
                      amount: Number(advanceAmount),
                      notes: advanceNotes,
                      advance_date: advanceDate.replace('T', ' ') + ':00',
                    });
                  }}
                  disabled={createAdvanceMutation.isPending}
                  className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white py-2 rounded-lg text-[10px] font-label-caps transition-all font-bold cursor-pointer"
                >
                  {createAdvanceMutation.isPending ? 'Recording...' : 'Record Advance Payout'}
                </button>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-tertiary/30 italic font-body-lg font-bold">
              Select a staff member to compute monthly compensation telemetry.
            </div>
          )}
        </div>
      </div>
      {/* NEW PAYMENT REQUEST MODAL */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[70] p-4 pt-20 sm:pt-4 animate-fade-in">
          <div className="bg-[#0e0e0e] border border-white/10 rounded-3xl w-full max-w-md p-6 relative overflow-hidden shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-performance-red"></div>

            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-display-hero text-lg font-black text-white tracking-tight italic uppercase font-extrabold">
                  SUBMIT PAYMENT REQUEST
                </h3>
                <p className="text-[10px] text-tertiary/50 font-label-caps tracking-widest uppercase">
                  Advance / Salary / Incentive Claim
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRequestModal(false)}
                className="text-tertiary hover:text-white p-1 hover:bg-white/5 rounded-lg transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div>
                <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider font-bold">
                  Request Type *
                </label>
                <select
                  value={requestForm.request_type}
                  onChange={e => setRequestForm({ ...requestForm, request_type: e.target.value as any })}
                  className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-3 text-xs text-white font-bold font-body-lg"
                >
                  <option value="advance">Salary Advance</option>
                  <option value="salary">Regular Salary Payout</option>
                  <option value="incentive">Incentive / Bonus Claim</option>
                  <option value="reimbursement">Expense Reimbursement</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider font-bold">
                  Amount Requested (₹) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 5000"
                  value={requestForm.amount}
                  onChange={e => setRequestForm({ ...requestForm, amount: e.target.value })}
                  className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl p-3 text-xs text-white font-bold font-data-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider font-bold">
                  Reason for Request *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Medical emergency, Fuel expenses..."
                  value={requestForm.reason}
                  onChange={e => setRequestForm({ ...requestForm, reason: e.target.value })}
                  className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-white font-body-lg"
                />
              </div>

              <div>
                <label className="block text-[10px] text-tertiary font-label-caps mb-1.5 uppercase tracking-wider font-bold">
                  Additional Notes
                </label>
                <textarea
                  placeholder="Any supporting information..."
                  rows={2}
                  value={requestForm.notes}
                  onChange={e => setRequestForm({ ...requestForm, notes: e.target.value })}
                  className="w-full bg-black border border-white/10 focus:border-performance-red/50 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-white font-body-lg resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="flex-1 bg-white/5 border border-white/10 py-2.5 rounded-xl text-xs font-label-caps text-tertiary hover:text-white transition-all font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRequestMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-performance-red to-[#93000a] py-2.5 rounded-xl text-xs font-label-caps text-white hover:shadow-[0_0_20px_rgba(255,43,43,0.3)] transition-all font-bold uppercase tracking-wider"
                >
                  {createRequestMutation.isPending ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
