import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../api/reports';
import { formatINR, formatDate, getStatusConfig } from '../utils/helpers';

const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'job_cards' | 'inventory' | 'staff_salary' | 'accounts'>('overview');

  // Job card filters
  const [jcSearch, setJcSearch] = useState('');
  const [jcStatus, setJcStatus] = useState('');
  const [jcDateFrom, setJcDateFrom] = useState('');
  const [jcDateTo, setJcDateTo] = useState('');

  // Inventory filters
  const [invSearch, setInvSearch] = useState('');
  const [invShowLowStock, setInvShowLowStock] = useState(false);

  // Staff Salary filters
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  const [salaryDateFrom, setSalaryDateFrom] = useState(defaultFrom);
  const [salaryDateTo, setSalaryDateTo] = useState(defaultTo);

  // Accounts filters
  const defaultAccFrom = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
  const defaultAccTo = now.toISOString().split('T')[0];
  const [accDateFrom, setAccDateFrom] = useState(defaultAccFrom);
  const [accDateTo, setAccDateTo] = useState(defaultAccTo);
  const [accPaymentMode, setAccPaymentMode] = useState('');

  // --- QUERY HOOKS ---

  // Overview Data (always fetched for dashboard)
  const { data: revData, isLoading: revLoading } = useQuery({
    queryKey: ['reports', 'monthly-revenue'],
    queryFn: reportsApi.getMonthlyRevenue,
  });
  const { data: svcData, isLoading: svcLoading } = useQuery({
    queryKey: ['reports', 'service-breakdown'],
    queryFn: reportsApi.getServiceBreakdown,
  });
  const { data: funnelData, isLoading: funnelLoading } = useQuery({
    queryKey: ['reports', 'lead-funnel'],
    queryFn: reportsApi.getLeadFunnel,
  });
  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['reports', 'staff-performance'],
    queryFn: reportsApi.getStaffPerformance,
  });
  const { data: attData, isLoading: attLoading } = useQuery({
    queryKey: ['reports', 'attendance-summary'],
    queryFn: reportsApi.getAttendanceSummary,
  });

  // Detailed Job Cards Ledger
  const { data: jcReportData, isLoading: jcLoading } = useQuery({
    queryKey: ['reports', 'job-cards-detail', { date_from: jcDateFrom, date_to: jcDateTo, status: jcStatus, search: jcSearch }],
    queryFn: () => reportsApi.getJobCardsReportDetail({ date_from: jcDateFrom, date_to: jcDateTo, status: jcStatus, search: jcSearch }),
    enabled: activeTab === 'job_cards',
  });

  // Inventory Ledger
  const { data: invReportData, isLoading: invLoading } = useQuery({
    queryKey: ['reports', 'inventory'],
    queryFn: reportsApi.getInventoryReport,
    enabled: activeTab === 'inventory',
  });

  // Staff Salary Ledger
  const { data: salaryReportData, isLoading: salaryLoading } = useQuery({
    queryKey: ['reports', 'staff-salary', { date_from: salaryDateFrom, date_to: salaryDateTo }],
    queryFn: () => reportsApi.getStaffSalaryReport({ date_from: salaryDateFrom, date_to: salaryDateTo }),
    enabled: activeTab === 'staff_salary',
  });

  // Accounts/Cash Flow Ledger
  const { data: accReportData, isLoading: accLoading } = useQuery({
    queryKey: ['reports', 'accounts', { date_from: accDateFrom, date_to: accDateTo, payment_mode: accPaymentMode }],
    queryFn: () => reportsApi.getAccountsReport({ date_from: accDateFrom, date_to: accDateTo, payment_mode: accPaymentMode }),
    enabled: activeTab === 'accounts',
  });

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

  const handleJCDownload = () => {
    if (!jcReportData) return;
    const headers = [
      'Job Code', 'Customer Name', 'Phone', 'Vehicle Make', 'Vehicle Model',
      'Reg Number', 'Status', 'Job Type', 'Completion Type', 'Date In', 'Date Out',
      'Total Amount (INR)', 'Amount Paid (INR)', 'Balance Due (INR)'
    ];
    const rows = jcReportData.map((j: any) => [
      j.job_code || '',
      j.customer_name || '',
      j.customer_phone || '',
      j.vehicle_make || '',
      j.vehicle_model || '',
      j.reg_number || '',
      j.status || '',
      j.job_type || '',
      j.completion_type || '',
      j.date_in ? formatDate(j.date_in) : '',
      j.date_out ? formatDate(j.date_out) : '',
      String(j.total_amount || 0),
      String(j.amount_paid || 0),
      String(j.balance_due || 0)
    ]);
    downloadCSV(`Job_Cards_Report_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  const handleInventoryItemsDownload = () => {
    if (!invReportData?.items) return;
    const headers = ['Item Code', 'Item Name', 'Category', 'Current Stock', 'Min Threshold', 'Low Stock Warning'];
    const rows = invReportData.items.map((i: any) => [
      i.item_code || '',
      i.name || '',
      i.category || '',
      String(i.current_stock || 0),
      String(i.min_threshold || 0),
      i.is_low_stock ? 'LOW STOCK' : 'Healthy'
    ]);
    downloadCSV(`Inventory_Stock_Report_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  const handleInventoryRollsDownload = () => {
    if (!invReportData?.rolls) return;
    const headers = ['Roll Code', 'Inventory Item Name', 'Balance (Sqft)', 'Status'];
    const rows = invReportData.rolls.map((r: any) => [
      r.roll_code || '',
      r.item_name || '',
      String(r.balance_sqft || 0),
      r.status || ''
    ]);
    downloadCSV(`Inventory_Rolls_Report_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  const handleSalaryDownload = () => {
    if (!salaryReportData) return;
    const headers = [
      'Staff Code', 'Full Name', 'Role', 'Salary Type', 'Base Amount (INR)',
      'Present Days', 'Late Days', 'Half Days', 'Absent Days', 'Leave Days',
      'Calculated Earnings (Gross INR)', 'Advance Deductions (INR)', 'Net Payable (INR)'
    ];
    const rows = salaryReportData.map((s: any) => [
      s.staff_code || '',
      s.full_name || '',
      s.role || '',
      s.salary_type || '',
      String(s.salary_amount || 0),
      String(s.attendance?.present || 0),
      String(s.attendance?.late || 0),
      String(s.attendance?.half_day || 0),
      String(s.attendance?.absent || 0),
      String(s.attendance?.leave || 0),
      String(s.calculated_salary || 0),
      String(s.unpaid_advance || 0),
      String(s.net_salary || 0)
    ]);
    downloadCSV(`Staff_Payroll_Report_${salaryDateFrom}_to_${salaryDateTo}.csv`, headers, rows);
  };

  const handleAccountsCashInDownload = () => {
    if (!accReportData?.cash_in) return;
    const headers = ['Payment Date', 'Invoice Code', 'Job Code', 'Customer Name', 'Amount (INR)', 'Payment Mode', 'Payment Type', 'Reference No', 'Notes'];
    const rows = accReportData.cash_in.map((c: any) => [
      c.payment_date ? formatDate(c.payment_date) : '',
      c.invoice_code || '',
      c.job_code || '',
      c.customer_name || '',
      String(c.amount || 0),
      c.payment_mode || '',
      c.payment_type || '',
      c.reference_no || '',
      c.notes || ''
    ]);
    downloadCSV(`Accounts_Cash_In_${accDateFrom}_to_${accDateTo}.csv`, headers, rows);
  };

  const handleAccountsCashOutDownload = () => {
    if (!accReportData?.cash_out) return;
    const headers = ['Date', 'Expense Type', 'Description', 'Amount (INR)', 'Payment Mode', 'Supplier', 'Notes'];
    const rows = accReportData.cash_out.map((c: any) => [
      c.date ? formatDate(c.date) : '',
      c.expense_type || '',
      c.description || '',
      String(c.amount || 0),
      c.payment_mode || '',
      c.supplier || '',
      c.notes || ''
    ]);
    downloadCSV(`Accounts_Cash_Out_${accDateFrom}_to_${accDateTo}.csv`, headers, rows);
  };

  // --- FILTERS & HANDLERS ---

  // Inventory filtering client-side
  const filteredInvItems = invReportData?.items?.filter((i: any) => {
    const matchesSearch = i.name?.toLowerCase().includes(invSearch.toLowerCase()) || i.item_code?.toLowerCase().includes(invSearch.toLowerCase());
    const matchesLowStock = !invShowLowStock || i.is_low_stock;
    return matchesSearch && matchesLowStock;
  }) || [];

  const filteredInvRolls = invReportData?.rolls?.filter((r: any) => {
    return r.item_name?.toLowerCase().includes(invSearch.toLowerCase()) || r.roll_code?.toLowerCase().includes(invSearch.toLowerCase());
  }) || [];

  return (
    <div className="space-y-8 relative z-10 font-body-lg pb-10 font-medium">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-[2px] bg-performance-red"></div>
            <span className="font-label-caps text-label-caps text-performance-red tracking-[0.3em] uppercase">
              Business Intelligence Array
            </span>
          </div>
          <h1 className="font-display-hero text-headline-lg text-white tracking-tight font-extrabold">
            Studio Analytics
          </h1>
          <p className="font-body-lg text-body-lg text-tertiary mt-1.5 font-bold">
            Operational dashboard reports, detailed Job Cards, stock metrics, staff payroll summaries, and accounts ledger statements.
          </p>
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div className="flex border-b border-white/5 pb-1">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-black/30 border border-white/5 rounded-xl">
          {([
            { id: 'overview', icon: 'dashboard', label: 'Overview' },
            { id: 'job_cards', icon: 'description', label: 'Job Cards Ledger' },
            { id: 'inventory', icon: 'inventory', label: 'Inventory Ledger' },
            { id: 'staff_salary', icon: 'engineering', label: 'Staff Salaries (Payroll)' },
            { id: 'accounts', icon: 'payments', label: 'Accounts & Cash Flow' }
          ] as const).map((tab) => (
            <button
              key={tab.id}
              className={`px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all hover:cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-performance-red/10 text-performance-red border border-performance-red/20 shadow-[0_0_15px_rgba(255,43,43,0.15)] font-extrabold'
                  : 'text-tertiary/60 hover:text-white font-bold'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* --- TAB CONTENT AREA --- */}

      {/* 1. OVERVIEW DASHBOARD */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: 6-Month Revenue */}
          <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 relative overflow-hidden group shadow-2xl flex flex-col min-h-[340px]">
            <div className="absolute top-0 right-0 w-36 h-36 bg-performance-red/[0.02] blur-[60px] rounded-full pointer-events-none" />
            <h3 className="font-label-caps text-label-caps text-white flex items-center gap-2 mb-6 border-b border-white/5 pb-4 uppercase tracking-wider font-bold">
              <span className="material-symbols-outlined text-performance-red text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                payments
              </span>
              6-Month Revenue Telemetry
            </h3>
            {revLoading ? (
              <div className="flex-1 flex items-center justify-center py-6 text-tertiary/50 italic">
                Loading revenue metrics...
              </div>
            ) : (
              <ul className="flex-1 space-y-3 font-data-sm text-xs">
                {revData?.map((r: any) => (
                  <li
                    key={r.month}
                    className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0 hover:bg-white/[0.01] rounded px-1 transition-colors"
                  >
                    <span className="text-tertiary font-bold">
                      {r.month} <span className="text-[10px] text-tertiary/40">({r.payment_count} transactions)</span>
                    </span>
                    <span className="text-white font-extrabold font-data-lg text-sm">
                      {formatINR(Number(r.total_collected))}
                    </span>
                  </li>
                ))}
                {!revData?.length && (
                  <div className="text-tertiary/30 italic text-center py-12">No data recorded</div>
                )}
              </ul>
            )}
          </div>

          {/* Card 2: Top Services by Revenue */}
          <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 relative overflow-hidden group shadow-2xl flex flex-col min-h-[340px]">
            <div className="absolute top-0 right-0 w-36 h-36 bg-performance-red/[0.02] blur-[60px] rounded-full pointer-events-none" />
            <h3 className="font-label-caps text-label-caps text-white flex items-center gap-2 mb-6 border-b border-white/5 pb-4 uppercase tracking-wider font-bold">
              <span className="material-symbols-outlined text-performance-red text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                pie_chart
              </span>
              Top Services Breakdown
            </h3>
            {svcLoading ? (
              <div className="flex-1 flex items-center justify-center py-6 text-tertiary/50 italic">
                Loading service breakdown...
              </div>
            ) : (
              <ul className="flex-1 space-y-3 font-data-sm text-xs">
                {svcData?.map((s: any) => (
                  <li
                    key={s.service_type}
                    className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0 hover:bg-white/[0.01] rounded px-1 transition-colors"
                  >
                    <span className="text-tertiary font-bold">
                      {s.service_type} <span className="text-[10px] text-tertiary/40">({s.count})</span>
                    </span>
                    <span className="text-white font-extrabold font-data-lg text-sm">
                      {formatINR(Number(s.revenue))}
                    </span>
                  </li>
                ))}
                {!svcData?.length && (
                  <div className="text-tertiary/30 italic text-center py-12">No data recorded</div>
                )}
              </ul>
            )}
          </div>

          {/* Card 3: Staff Performance */}
          <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 relative overflow-hidden group shadow-2xl flex flex-col min-h-[340px]">
            <div className="absolute top-0 right-0 w-36 h-36 bg-performance-red/[0.02] blur-[60px] rounded-full pointer-events-none" />
            <h3 className="font-label-caps text-label-caps text-white flex items-center gap-2 mb-6 border-b border-white/5 pb-4 uppercase tracking-wider font-bold">
              <span className="material-symbols-outlined text-performance-red text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                engineering
              </span>
              Staff Performance (30 Days)
            </h3>
            {staffLoading ? (
              <div className="flex-1 flex items-center justify-center py-6 text-tertiary/50 italic">
                Loading performance metrics...
              </div>
            ) : (
              <ul className="flex-1 space-y-3 font-data-sm text-xs custom-scrollbar overflow-y-auto max-h-[220px]">
                {staffData?.map((s: any) => (
                  <li
                    key={s.id}
                    className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0 hover:bg-white/[0.01] rounded px-1 transition-colors"
                  >
                    <span className="text-tertiary font-bold">
                      {s.full_name} <span className="text-[10px] text-tertiary/40">({s.role})</span>
                    </span>
                    <div className="text-right font-bold">
                      <div className="text-white font-extrabold font-data-sm">{s.jobs_completed} jobs</div>
                      <div className="text-[10px] text-tertiary/50 mt-0.5">{formatINR(Number(s.revenue_generated))}</div>
                    </div>
                  </li>
                ))}
                {!staffData?.length && (
                  <div className="text-tertiary/30 italic text-center py-12">No data recorded</div>
                )}
              </ul>
            )}
          </div>

          {/* Card 4: Lead Funnel Velocity */}
          <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 relative overflow-hidden group shadow-2xl flex flex-col min-h-[340px]">
            <div className="absolute top-0 right-0 w-36 h-36 bg-performance-red/[0.02] blur-[60px] rounded-full pointer-events-none" />
            <h3 className="font-label-caps text-label-caps text-white flex items-center gap-2 mb-6 border-b border-white/5 pb-4 uppercase tracking-wider font-bold">
              <span className="material-symbols-outlined text-performance-red text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                filter_alt
              </span>
              Lead Pipeline Funnel
            </h3>
            {funnelLoading ? (
              <div className="flex-1 flex items-center justify-center py-6 text-tertiary/50 italic">
                Loading pipeline metrics...
              </div>
            ) : (
              <ul className="flex-1 space-y-3 font-data-sm text-xs">
                {funnelData?.funnel?.map((f: any) => (
                  <li
                    key={f.status}
                    className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0 hover:bg-white/[0.01] rounded px-1 transition-colors"
                  >
                    <span className="text-tertiary capitalize font-bold">
                      {f.status}
                    </span>
                    <span className="text-white font-extrabold font-data-lg text-sm">
                      {f.count} leads
                    </span>
                  </li>
                ))}
                {!funnelData?.funnel?.length && (
                  <div className="text-tertiary/30 italic text-center py-12">No data recorded</div>
                )}
              </ul>
            )}
          </div>

          {/* Card 5: Attendance Summary */}
          <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 relative overflow-hidden group shadow-2xl flex flex-col min-h-[340px]">
            <div className="absolute top-0 right-0 w-36 h-36 bg-performance-red/[0.02] blur-[60px] rounded-full pointer-events-none" />
            <h3 className="font-label-caps text-label-caps text-white flex items-center gap-2 mb-6 border-b border-white/5 pb-4 uppercase tracking-wider font-bold">
              <span className="material-symbols-outlined text-performance-red text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                calendar_today
              </span>
              Attendance Summary (7D)
            </h3>
            {attLoading ? (
              <div className="flex-1 flex items-center justify-center py-6 text-tertiary/50 italic">
                Loading attendance logs...
              </div>
            ) : (
              <ul className="flex-1 space-y-3 font-data-sm text-xs custom-scrollbar overflow-y-auto max-h-[220px]">
                {attData?.map((a: any) => {
                  const total =
                    Number(a.present_count) +
                    Number(a.late_count) +
                    Number(a.absent_count) +
                    Number(a.half_day_count) +
                    Number(a.leave_count);
                  const present =
                    Number(a.present_count) +
                    Number(a.late_count) +
                    Number(a.half_day_count);
                  return (
                    <li
                      key={a.date}
                      className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0 hover:bg-white/[0.01] rounded px-1 transition-colors"
                    >
                      <span className="text-tertiary font-bold">
                        {new Date(a.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                      </span>
                      <span
                        className={`font-bold font-data-sm ${
                          present === total && total > 0
                            ? 'text-emerald-400 font-extrabold'
                            : 'text-white'
                        }`}
                      >
                        {present} / {total} Present
                      </span>
                    </li>
                  );
                })}
                {!attData?.length && (
                  <div className="text-tertiary/30 italic text-center py-12">No data recorded</div>
                )}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* 2. JOB CARDS DETAIL LEDGER */}
      {activeTab === 'job_cards' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-end gap-4 bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 p-5 rounded-2xl">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <label className="text-[10px] font-extrabold text-tertiary uppercase tracking-wider">Search Key</label>
              <input
                type="text"
                placeholder="Job Code, Customer Name, Phone, Reg..."
                className="bg-black/30 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-performance-red w-full font-bold"
                value={jcSearch}
                onChange={e => setJcSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 w-40">
              <label className="text-[10px] font-extrabold text-tertiary uppercase tracking-wider">Status</label>
              <select
                className="bg-black/30 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-performance-red w-full font-bold"
                value={jcStatus}
                onChange={e => setJcStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="car_in">Car In</option>
                <option value="washing">Washing</option>
                <option value="in_progress">In Progress</option>
                <option value="qc">QC</option>
                <option value="rework">Rework</option>
                <option value="ready">Ready</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5 w-44">
              <label className="text-[10px] font-extrabold text-tertiary uppercase tracking-wider">Date From</label>
              <input
                type="date"
                className="bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-performance-red w-full font-bold"
                value={jcDateFrom}
                onChange={e => setJcDateFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 w-44">
              <label className="text-[10px] font-extrabold text-tertiary uppercase tracking-wider">Date To</label>
              <input
                type="date"
                className="bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-performance-red w-full font-bold"
                value={jcDateTo}
                onChange={e => setJcDateTo(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleJCDownload}
                disabled={!jcReportData?.length}
                className="bg-emerald-600/15 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/25 px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-all hover:cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed h-10 shadow-[0_0_10px_rgba(16,185,129,0.05)]"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Export Excel
              </button>
            </div>
          </div>

          {/* Table Ledger */}
          <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
            {jcLoading ? (
              <div className="py-20 text-center text-tertiary/50 italic flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-performance-red border-t-transparent rounded-full animate-spin" />
                Querying Job Cards Ledger...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black/45 text-on-surface-variant/50 text-[9px] font-label-caps uppercase tracking-widest border-b border-white/[0.06] font-bold">
                      {['Job Code', 'Customer', 'Vehicle', 'Job/Comp Type', 'Dates', 'Status', 'Amounts'].map(h => (
                        <th key={h} className="py-3.5 px-5 font-normal">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="font-data-sm text-xs divide-y divide-white/[0.02]">
                    {jcReportData?.map((j: any) => {
                      const cfg = getStatusConfig(j.status);
                      return (
                        <tr key={j.id} className="hover:bg-white/[0.01] transition-colors group">
                          <td className="py-3.5 px-5 font-extrabold text-performance-red font-data-lg text-xs">
                            {j.job_code}
                          </td>
                          <td className="py-3.5 px-5">
                            <p className="font-extrabold text-white font-body-lg">{j.customer_name || 'N/A'}</p>
                            <p className="text-[10px] text-tertiary mt-0.5 font-bold">{j.customer_phone || ''}</p>
                          </td>
                          <td className="py-3.5 px-5">
                            <p className="text-white font-extrabold font-body-lg">{j.vehicle_make} {j.vehicle_model}</p>
                            <p className="text-[10px] text-tertiary mt-0.5 font-bold">{j.reg_number || 'N/A'}</p>
                          </td>
                          <td className="py-3.5 px-5">
                            <p className="text-white capitalize font-bold">{j.job_type || '—'}</p>
                            <p className="text-[10px] text-tertiary mt-0.5 capitalize font-bold">{j.completion_type || '—'}</p>
                          </td>
                          <td className="py-3.5 px-5">
                            <p className="text-white font-bold">In: {j.date_in ? formatDate(j.date_in) : '—'}</p>
                            <p className="text-[10px] text-tertiary mt-0.5 font-bold">Out: {j.date_out ? formatDate(j.date_out) : '—'}</p>
                          </td>
                          <td className="py-3.5 px-5">
                            <span
                              style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: `${cfg.color}25` }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-[9px] font-extrabold uppercase tracking-wider"
                            >
                              <span style={{ backgroundColor: cfg.color }} className="w-1.5 h-1.5 rounded-full" />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 font-data-sm text-xs font-bold">
                            <div className="font-extrabold text-white">Total: {formatINR(Number(j.total_amount))}</div>
                            <div className="text-[10px] text-emerald-400 mt-0.5 font-extrabold">Paid: {formatINR(Number(j.amount_paid))}</div>
                            {Number(j.balance_due) > 0 && (
                              <div className="text-[10px] text-orange-400 mt-0.5 font-extrabold">Due: {formatINR(Number(j.balance_due))}</div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {!jcReportData?.length && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-tertiary/40 italic">
                          No matching job cards found for selection.
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

      {/* 3. INVENTORY LEDGER */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-end justify-between gap-4 bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 p-5 rounded-2xl">
            <div className="flex flex-wrap items-center gap-4 flex-1">
              <div className="flex flex-col gap-1.5 w-72">
                <label className="text-[10px] font-extrabold text-tertiary uppercase tracking-wider">Filter Items</label>
                <input
                  type="text"
                  placeholder="Item Name, Code or Category..."
                  className="bg-black/30 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-performance-red w-full font-bold"
                  value={invSearch}
                  onChange={e => setInvSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 mt-5 select-none hover:cursor-pointer">
                <input
                  type="checkbox"
                  id="lowStockToggle"
                  className="accent-performance-red rounded w-3.5 h-3.5 border-white/10"
                  checked={invShowLowStock}
                  onChange={e => setInvShowLowStock(e.target.checked)}
                />
                <label htmlFor="lowStockToggle" className="text-xs font-bold text-tertiary hover:text-white cursor-pointer select-none">
                  Show Low Stock Warnings Only
                </label>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleInventoryItemsDownload}
                disabled={!invReportData?.items?.length}
                className="bg-emerald-600/15 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/25 px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-all hover:cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed h-10 shadow-[0_0_10px_rgba(16,185,129,0.05)]"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Export Items Stock
              </button>
              <button
                onClick={handleInventoryRollsDownload}
                disabled={!invReportData?.rolls?.length}
                className="bg-emerald-600/15 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/25 px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-all hover:cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed h-10 shadow-[0_0_10px_rgba(16,185,129,0.05)]"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Export PPF Rolls
              </button>
            </div>
          </div>

          {invLoading ? (
            <div className="py-20 text-center text-tertiary/50 italic flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-2 border-performance-red border-t-transparent rounded-full animate-spin" />
              Syncing Inventory Telemetry...
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Side: Stock Items Ledger (2/3 width) */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2 pl-1">
                  <span className="material-symbols-outlined text-performance-red text-[18px]">widgets</span>
                  Stock Items Ledger
                </h3>
                <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-black/45 text-on-surface-variant/50 text-[9px] font-label-caps uppercase tracking-widest border-b border-white/[0.06] font-bold">
                          {['Item Code', 'Item Name', 'Category', 'Threshold', 'Stock Level', 'Status'].map(h => (
                            <th key={h} className="py-3.5 px-5 font-normal">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="font-data-sm text-xs divide-y divide-white/[0.02]">
                        {filteredInvItems.map((i: any) => (
                          <tr key={i.id} className="hover:bg-white/[0.01] transition-colors">
                            <td className="py-3.5 px-5 font-extrabold text-performance-red font-data-lg text-xs">
                              {i.item_code}
                            </td>
                            <td className="py-3.5 px-5 font-extrabold text-white font-body-lg">
                              {i.name}
                            </td>
                            <td className="py-3.5 px-5 text-tertiary font-bold font-body-lg">
                              {i.category}
                            </td>
                            <td className="py-3.5 px-5 font-data-sm text-xs text-white font-bold">
                              {i.min_threshold} {i.unit || 'units'}
                            </td>
                            <td className="py-3.5 px-5 font-extrabold font-data-lg text-xs text-white">
                              {i.current_stock} {i.unit || 'units'}
                            </td>
                            <td className="py-3.5 px-5">
                              {i.is_low_stock ? (
                                <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                                  LOW STOCK
                                </span>
                              ) : (
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  HEALTHY
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {!filteredInvItems.length && (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-tertiary/40 italic">
                              No inventory stock items matching selection.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right Side: PPF Rolls Ledger (1/3 width) */}
              <div className="space-y-4">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2 pl-1">
                  <span className="material-symbols-outlined text-performance-red text-[18px]">adjust</span>
                  PPF Rolls Ledger
                </h3>
                <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-black/45 text-on-surface-variant/50 text-[9px] font-label-caps uppercase tracking-widest border-b border-white/[0.06] font-bold">
                          {['Roll Code', 'Roll Name', 'Balance'].map(h => (
                            <th key={h} className="py-3.5 px-5 font-normal">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="font-data-sm text-xs divide-y divide-white/[0.02]">
                        {filteredInvRolls.map((r: any) => {
                          const statusCfg = getStatusConfig(r.status);
                          return (
                            <tr key={r.id} className="hover:bg-white/[0.01] transition-colors">
                              <td className="py-3.5 px-5 font-extrabold text-performance-red font-data-sm text-xs">
                                {r.roll_code}
                              </td>
                              <td className="py-3.5 px-5 text-white font-body-lg">
                                <p className="font-extrabold">{r.item_name || 'N/A'}</p>
                                <span
                                  style={{ color: statusCfg.color, backgroundColor: statusCfg.bg, borderColor: `${statusCfg.color}15` }}
                                  className="inline-block px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider mt-1 border"
                                >
                                  {statusCfg.label}
                                </span>
                              </td>
                              <td className="py-3.5 px-5 font-extrabold font-data-lg text-xs text-white">
                                {r.balance_sqft} sqft
                              </td>
                            </tr>
                          );
                        })}
                        {!filteredInvRolls.length && (
                          <tr>
                            <td colSpan={3} className="py-12 text-center text-tertiary/40 italic">
                              No PPF rolls matching selection.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. STAFF SALARIES (PAYROLL) */}
      {activeTab === 'staff_salary' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-end gap-4 bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 p-5 rounded-2xl">
            <div className="flex flex-col gap-1.5 w-52">
              <label className="text-[10px] font-extrabold text-tertiary uppercase tracking-wider">Payroll Period From</label>
              <input
                type="date"
                className="bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-performance-red w-full font-bold"
                value={salaryDateFrom}
                onChange={e => setSalaryDateFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 w-52">
              <label className="text-[10px] font-extrabold text-tertiary uppercase tracking-wider">Payroll Period To</label>
              <input
                type="date"
                className="bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-performance-red w-full font-bold"
                value={salaryDateTo}
                onChange={e => setSalaryDateTo(e.target.value)}
              />
            </div>
            <div className="flex-1 flex justify-end self-end">
              <button
                onClick={handleSalaryDownload}
                disabled={!salaryReportData?.length}
                className="bg-emerald-600/15 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/25 px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-all hover:cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed h-10 shadow-[0_0_10px_rgba(16,185,129,0.05)]"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Export Payroll Ledger
              </button>
            </div>
          </div>

          {/* Table Ledger */}
          <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
            {salaryLoading ? (
              <div className="py-20 text-center text-tertiary/50 italic flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-performance-red border-t-transparent rounded-full animate-spin" />
                Calculating Staff Attendance & Salary Ledger...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black/45 text-on-surface-variant/50 text-[9px] font-label-caps uppercase tracking-widest border-b border-white/[0.06] font-bold">
                      {['Staff Code', 'Staff Member', 'Role', 'Salary Scheme', 'Attendance Tallies', 'Gross Salary', 'Advances Deductions', 'Net Salary'].map(h => (
                        <th key={h} className="py-3.5 px-5 font-normal">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="font-data-sm text-xs divide-y divide-white/[0.02]">
                    {salaryReportData?.map((s: any) => {
                      const present = s.attendance?.present || 0;
                      const late = s.attendance?.late || 0;
                      const absent = s.attendance?.absent || 0;
                      const half = s.attendance?.half_day || 0;
                      const leave = s.attendance?.leave || 0;
                      return (
                        <tr key={s.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="py-4 px-5 font-extrabold text-performance-red font-data-sm text-xs">
                            {s.staff_code}
                          </td>
                          <td className="py-4 px-5 font-extrabold text-white font-body-lg">
                            {s.full_name}
                            <span className="text-[10px] text-tertiary font-bold ml-2 lowercase tracking-wider bg-white/5 border border-white/10 px-1.5 py-0.5 rounded capitalize">
                              {s.status}
                            </span>
                          </td>
                          <td className="py-4 px-5 text-tertiary font-bold font-body-lg">
                            {s.role}
                          </td>
                          <td className="py-4 px-5 font-bold font-body-lg">
                            <p className="text-white">{formatINR(Number(s.salary_amount))}</p>
                            <p className="text-[10px] text-tertiary capitalize mt-0.5 font-bold">Scheme: {s.salary_type}</p>
                          </td>
                          <td className="py-4 px-5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                                {present} Pres
                              </span>
                              {late > 0 && (
                                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                                  {late} Late
                                </span>
                              )}
                              {half > 0 && (
                                <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                                  {half} Half
                                </span>
                              )}
                              {absent > 0 && (
                                <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                                  {absent} Abs
                                </span>
                              )}
                              {leave > 0 && (
                                <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                                  {leave} Leave
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-5 font-bold font-data-sm text-white">
                            {formatINR(s.calculated_salary)}
                          </td>
                          <td className="py-4 px-5 font-bold font-data-sm text-orange-450">
                            {s.unpaid_advance > 0 ? `- ${formatINR(s.unpaid_advance)}` : '—'}
                          </td>
                          <td className="py-4 px-5 font-extrabold font-data-lg text-sm text-emerald-400">
                            {formatINR(s.net_salary)}
                          </td>
                        </tr>
                      );
                    })}
                    {!salaryReportData?.length && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-tertiary/40 italic">
                          No active staff registry found.
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

      {/* 5. ACCOUNTS & CASH FLOW */}
      {activeTab === 'accounts' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-end gap-4 bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 p-5 rounded-2xl">
            <div className="flex flex-col gap-1.5 w-44">
              <label className="text-[10px] font-extrabold text-tertiary uppercase tracking-wider">Date From</label>
              <input
                type="date"
                className="bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-performance-red w-full font-bold"
                value={accDateFrom}
                onChange={e => setAccDateFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 w-44">
              <label className="text-[10px] font-extrabold text-tertiary uppercase tracking-wider">Date To</label>
              <input
                type="date"
                className="bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-performance-red w-full font-bold"
                value={accDateTo}
                onChange={e => setAccDateTo(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 w-40">
              <label className="text-[10px] font-extrabold text-tertiary uppercase tracking-wider">Payment Mode</label>
              <select
                className="bg-black/30 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-performance-red w-full font-bold"
                value={accPaymentMode}
                onChange={e => setAccPaymentMode(e.target.value)}
              >
                <option value="">All Modes</option>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div className="flex-1 flex justify-end gap-3 self-end">
              <button
                onClick={handleAccountsCashInDownload}
                disabled={!accReportData?.cash_in?.length}
                className="bg-emerald-600/15 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/25 px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-all hover:cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed h-10 shadow-[0_0_10px_rgba(16,185,129,0.05)]"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Export Cash In
              </button>
              <button
                onClick={handleAccountsCashOutDownload}
                disabled={!accReportData?.cash_out?.length}
                className="bg-emerald-600/15 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/25 px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-all hover:cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed h-10 shadow-[0_0_10px_rgba(16,185,129,0.05)]"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Export Cash Out
              </button>
            </div>
          </div>

          {accLoading ? (
            <div className="py-20 text-center text-tertiary/50 italic flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-2 border-performance-red border-t-transparent rounded-full animate-spin" />
              Auditing Financial Ledger...
            </div>
          ) : (
            <div className="space-y-6">
              {/* Financial KPI Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-bold">
                <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl p-5 relative overflow-hidden group shadow-lg">
                  <span className="text-[10px] font-extrabold text-tertiary uppercase tracking-wider">Total Cash Inflow</span>
                  <div className="text-2xl font-extrabold font-data-lg text-emerald-400 mt-1">
                    {formatINR(Number(accReportData?.summary?.total_cash_in || 0))}
                  </div>
                  <p className="text-[10px] text-tertiary/60 mt-1 font-bold">Customer collections & sales receipts</p>
                </div>
                <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl p-5 relative overflow-hidden group shadow-lg">
                  <span className="text-[10px] font-extrabold text-tertiary uppercase tracking-wider">Total Cash Outflow</span>
                  <div className="text-2xl font-extrabold font-data-lg text-red-400 mt-1">
                    {formatINR(Number(accReportData?.summary?.total_cash_out || 0))}
                  </div>
                  <p className="text-[10px] text-tertiary/60 mt-1 font-bold">Material costs & payouts</p>
                </div>
                <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl p-5 relative overflow-hidden group shadow-lg">
                  <span className="text-[10px] font-extrabold text-tertiary uppercase tracking-wider">Net Cash Flow Balance</span>
                  <div className={`text-2xl font-extrabold font-data-lg mt-1 ${
                    (accReportData?.summary?.net_flow || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {formatINR(Number(accReportData?.summary?.net_flow || 0))}
                  </div>
                  <p className="text-[10px] text-tertiary/60 mt-1 font-bold">Net earnings in selected timeline</p>
                </div>
              </div>

              {/* Cash In vs Cash Out Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cash In Table */}
                <div className="space-y-4">
                  <h3 className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-2 pl-1">
                    <span className="material-symbols-outlined text-emerald-400 text-[18px]">arrow_downward</span>
                    Cash Inflow (Payments Received)
                  </h3>
                  <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-black/45 text-on-surface-variant/50 text-[9px] font-label-caps uppercase tracking-widest border-b border-white/[0.06] font-bold">
                            {['Date', 'Origin/Customer', 'Payment Details', 'Amount'].map(h => (
                              <th key={h} className="py-3.5 px-4 font-normal">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="font-data-sm text-xs divide-y divide-white/[0.02]">
                          {accReportData?.cash_in?.map((c: any) => (
                            <tr key={c.id} className="hover:bg-white/[0.01] transition-colors">
                              <td className="py-3.5 px-4 text-tertiary font-bold font-body-lg">
                                {c.payment_date ? formatDate(c.payment_date) : '—'}
                              </td>
                              <td className="py-3.5 px-4 font-body-lg">
                                <p className="font-extrabold text-white">{c.customer_name || 'N/A'}</p>
                                <p className="text-[9px] text-tertiary mt-0.5 font-bold">
                                  {c.invoice_code ? `Inv: ${c.invoice_code}` : c.job_code ? `Job: ${c.job_code}` : ''}
                                </p>
                              </td>
                              <td className="py-3.5 px-4 font-body-lg">
                                <p className="text-white capitalize font-bold">{c.payment_mode || 'UPI'} · {c.payment_type || 'Custom'}</p>
                                {c.reference_no && <p className="text-[9px] text-tertiary mt-0.5 font-bold">Ref: {c.reference_no}</p>}
                              </td>
                              <td className="py-3.5 px-4 font-extrabold text-emerald-400 font-data-lg text-xs">
                                + {formatINR(Number(c.amount))}
                              </td>
                            </tr>
                          ))}
                          {!accReportData?.cash_in?.length && (
                            <tr>
                              <td colSpan={4} className="py-12 text-center text-tertiary/40 italic">
                                No cash inflow registered.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Cash Out Table */}
                <div className="space-y-4">
                  <h3 className="text-xs font-extrabold text-red-400 uppercase tracking-wider flex items-center gap-2 pl-1">
                    <span className="material-symbols-outlined text-red-400 text-[18px]">arrow_upward</span>
                    Cash Outflow (Expenses & Payouts)
                  </h3>
                  <div className="bg-[#0c0c0c]/45 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-black/45 text-on-surface-variant/50 text-[9px] font-label-caps uppercase tracking-widest border-b border-white/[0.06] font-bold">
                            {['Date', 'Expense Description', 'Details', 'Amount'].map(h => (
                              <th key={h} className="py-3.5 px-4 font-normal">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="font-data-sm text-xs divide-y divide-white/[0.02]">
                          {accReportData?.cash_out?.map((c: any) => (
                            <tr key={c.id} className="hover:bg-white/[0.01] transition-colors">
                              <td className="py-3.5 px-4 text-tertiary font-bold font-body-lg">
                                {c.date ? formatDate(c.date) : '—'}
                              </td>
                              <td className="py-3.5 px-4 font-body-lg">
                                <p className="font-extrabold text-white">{c.description || 'N/A'}</p>
                                <p className="text-[9px] text-tertiary mt-0.5 capitalize font-bold">{c.expense_type?.replace('_', ' ')}</p>
                              </td>
                              <td className="py-3.5 px-4 font-body-lg">
                                <p className="text-white capitalize font-bold">{c.payment_mode?.replace('_', ' ') || 'UPI'}</p>
                                <p className="text-[9px] text-tertiary mt-0.5 font-bold">Vendor/Supplier: {c.supplier || 'N/A'}</p>
                              </td>
                              <td className="py-3.5 px-4 font-extrabold text-red-400 font-data-lg text-xs">
                                - {formatINR(Number(c.amount))}
                              </td>
                            </tr>
                          ))}
                          {!accReportData?.cash_out?.length && (
                            <tr>
                              <td colSpan={4} className="py-12 text-center text-tertiary/40 italic">
                                No cash outflow registered.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
