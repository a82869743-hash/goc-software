import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';
import { useAuthStore } from '../stores/authStore';
import { formatINR } from '../utils/helpers';
import { useNavigate } from 'react-router-dom';

interface TooltipState {
  x: number;
  y: number;
  label: string;
  value: string;
  extra?: string;
  visible: boolean;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { staff } = useAuthStore();
  const isOwnerOrAdmin = staff?.role === 'admin' || staff?.role === 'manager';

  // ── API Telemetry Feeds ──────────────────────────────────────────
  const { data: kpis } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: dashboardApi.getKPIs,
    refetchInterval: 30000,
  });

  const { data: recentJobs } = useQuery({
    queryKey: ['dashboard-recent-jobs'],
    queryFn: dashboardApi.getRecentJobs,
  });

  const { data: extendedStats } = useQuery({
    queryKey: ['dashboard-extended-stats'],
    queryFn: dashboardApi.getExtendedStats,
    enabled: isOwnerOrAdmin,
  });

  const { data: revenueChart } = useQuery({
    queryKey: ['dashboard-revenue-chart'],
    queryFn: dashboardApi.getRevenueChart,
    enabled: isOwnerOrAdmin,
  });

  const { data: leadPipeline } = useQuery({
    queryKey: ['dashboard-lead-pipeline'],
    queryFn: dashboardApi.getLeadPipeline,
    enabled: isOwnerOrAdmin,
  });

  const { data: lowStock } = useQuery({
    queryKey: ['dashboard-low-stock'],
    queryFn: dashboardApi.getLowStock,
  });

  // ── Tooltip Interactivity ───────────────────────────────────────
  const [tooltip, setTooltip] = useState<TooltipState>({
    x: 0,
    y: 0,
    label: '',
    value: '',
    extra: '',
    visible: false,
  });

  const showTooltip = (e: React.MouseEvent, label: string, value: string, extra = '') => {
    const x = e.clientX + 20;
    const y = e.clientY + 20;
    setTooltip({ x, y, label, value, extra, visible: true });
  };

  const updateTooltipPosition = (e: React.MouseEvent) => {
    const x = e.clientX + 20;
    const y = e.clientY + 20;
    setTooltip((prev) => ({ ...prev, x, y }));
  };

  const hideTooltip = () => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  };

  // ── Presets & Helper Assets ───────────────────────────────────────
  const carImages: Record<string, string> = {
    porsche: 'https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&w=600&q=80',
    bmw: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=600&q=80',
    mercedes: 'https://images.unsplash.com/photo-1520050206274-a1ae446cb3cc?auto=format&fit=crop&w=600&q=80',
    audi: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80',
  };

  const getCarImage = (make = '', model = '') => {
    const combined = `${make} ${model}`.toLowerCase();
    if (combined.includes('porsche') || combined.includes('911')) return carImages.porsche;
    if (combined.includes('bmw') || combined.includes('m4') || combined.includes('m3')) return carImages.bmw;
    if (combined.includes('mercedes') || combined.includes('g63') || combined.includes('amg')) return carImages.mercedes;
    if (combined.includes('audi') || combined.includes('rs6') || combined.includes('e-tron')) return carImages.audi;
    return 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80';
  };

  const getJobProgress = (status: string) => {
    switch (status) {
      case 'in_progress': return 25;
      case 'ready': return 50;
      case 'estimate': return 75;
      case 'delivered': return 100;
      // Keep old statuses for backward compatibility mapping
      case 'scheduled': return 10;
      case 'car_in': return 15;
      case 'washing': return 20;
      case 'qc': return 60;
      case 'rework': return 40;
      default: return 0;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'in_progress': return 'WORK IN PROGRESS';
      case 'ready': return 'READY';
      case 'estimate': return 'ESTIMATE';
      case 'delivered': return 'FINAL DELIVERED';
      // Keep old statuses for backward compatibility mapping
      case 'scheduled': return 'SCHEDULED';
      case 'car_in': return 'VEHICLE ARRIVED';
      case 'washing': return 'HYDRAULIC WASH';
      case 'qc': return 'QC VERIFICATION';
      case 'rework': return 'RE-WORK PROTOCOL';
      default: return status.toUpperCase();
    }
  };

  // ── Render Views ──────────────────────────────────────────────────
  return (
    <div className="relative w-full">
      {/* Dynamic Floating Tooltip */}
      {tooltip.visible && (
        <div
          className="fixed pointer-events-none z-[100] bg-[#050505]/95 backdrop-blur-md border border-performance-red/30 px-3.5 py-2.5 rounded-xl shadow-2xl transition-all duration-75"
          style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
        >
          <p className="font-label-caps text-[10px] text-on-surface-variant uppercase mb-1">{tooltip.label}</p>
          <p className="font-data-lg text-sm text-performance-red font-bold">{tooltip.value}</p>
          {tooltip.extra && <p className="font-data-sm text-[10px] text-on-surface/60 mt-0.5">{tooltip.extra}</p>}
        </div>
      )}

      {isOwnerOrAdmin ? (
        // ═════════════════════════════════════════════════════════════
        // COMMAND CENTER ELITE — OWNER / MANAGER VIEW
        // ═════════════════════════════════════════════════════════════
        <div className="space-y-8">
          {/* Header Row */}
          <div className="flex justify-between items-end">
            <div>
              <h2 className="font-display-hero text-headline-lg text-white mb-2 tracking-tight">COMMAND CENTER</h2>
              <p className="font-label-caps text-label-caps text-on-surface-variant/80 tracking-widest uppercase">
                PERFORMANCE TELEMETRY &amp; OPERATIONAL VELOCITY
              </p>
            </div>
            <div className="hidden md:flex text-xs font-label-caps text-on-surface-variant flex items-center gap-3 bg-white/5 border border-white/5 px-4 py-2.5 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-performance-red opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-performance-red shadow-[0_0_8px_rgba(255,43,43,0.8)]"></span>
              </span>
              TELEMETRY FEED ACTIVE
            </div>
          </div>

          {/* KPI Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Today's Revenue */}
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
              <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <span className="material-symbols-outlined text-8xl text-white">payments</span>
              </div>
              <p className="font-label-caps text-[10px] text-on-surface-variant tracking-[0.2em] mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-performance-red rounded-full shadow-[0_0_8px_#FF2B2B]"></span>
                TODAY'S REVENUE
              </p>
              <h3 className="font-data-lg text-3xl font-bold text-white tracking-tight">
                {kpis ? formatINR(kpis.today_revenue) : '₹0'}
              </h3>
              <p className="font-data-sm text-[12px] text-performance-red mt-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">trending_up</span> MTD:{' '}
                {kpis ? formatINR(kpis.month_revenue) : '₹0'}
              </p>
            </div>

            {/* Active Job Cards */}
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
              <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <span className="material-symbols-outlined text-8xl text-white">garage</span>
              </div>
              <p className="font-label-caps text-[10px] text-on-surface-variant tracking-[0.2em] mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-performance-red rounded-full"></span>
                ACTIVE JOB CARDS
              </p>
              <h3 className="font-data-lg text-3xl font-bold text-white tracking-tight">
                {kpis?.active_jobs ?? 0}{' '}
                <span className="text-sm font-normal text-on-surface-variant">ACTIVE</span>
              </h3>
              <p className="font-data-sm text-[12px] text-on-surface-variant mt-4">
                Bay Utilization: <span className="text-white font-bold">{kpis && kpis.active_jobs > 0 ? `${Math.min(100, Math.round((kpis.active_jobs / 8) * 100))}%` : '0%'}</span>
              </p>
            </div>

            {/* New Leads */}
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
              <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <span className="material-symbols-outlined text-8xl text-white">ads_click</span>
              </div>
              <p className="font-label-caps text-[10px] text-on-surface-variant tracking-[0.2em] mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-performance-red rounded-full"></span>
                NEW LEADS
              </p>
              <h3 className="font-data-lg text-3xl font-bold text-white tracking-tight">
                {String(kpis?.new_leads_today ?? 0).padStart(2, '0')}
              </h3>
              <p className="font-data-sm text-[12px] text-on-surface-variant mt-4">
                Active Lead Pipeline Tracking
              </p>
            </div>

            {/* Stock Alerts */}
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 border border-performance-red/10">
              <div className="absolute -top-4 -right-4 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-symbols-outlined text-8xl text-performance-red">warning</span>
              </div>
              <p className="font-label-caps text-[10px] text-performance-red tracking-[0.2em] mb-4 flex items-center gap-2 font-bold">
                <span className="w-1.5 h-1.5 bg-performance-red rounded-full animate-pulse shadow-[0_0_8px_#FF2B2B]"></span>
                STOCK ALERTS
              </p>
              <h3 className="font-data-lg text-3xl font-bold text-white tracking-tight">
                {String(kpis?.low_stock_count ?? 0).padStart(2, '0')}
              </h3>
              <p className="font-data-sm text-[12px] text-on-surface-variant mt-4 uppercase tracking-tighter truncate">
                {lowStock?.[0] ? `Reorder: ${lowStock[0].name}` : 'All materials optimal'}
              </p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Revenue Telemetry (SVG Chart) */}
            <div className="lg:col-span-8 glass-panel p-6 rounded-2xl h-[420px] flex flex-col relative overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>
              
              <div className="flex justify-between items-start mb-6 z-10">
                <div>
                  <p className="font-label-caps text-[10px] text-on-surface-variant tracking-[0.2em] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-performance-red rounded-full"></span>
                    REVENUE TELEMETRY
                  </p>
                  <h4 className="font-headline-md text-base text-white mt-1">Live Inflow Analysis</h4>
                </div>
                <div className="flex gap-3">
                  <div className="flex items-center gap-2 bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl">
                    <span className="w-1.5 h-1.5 rounded-full bg-performance-red animate-pulse"></span>
                    <span className="font-data-sm text-[10px] text-white">
                      MTD:{' '}
                      {revenueChart && revenueChart.length > 0
                        ? formatINR(revenueChart.reduce((acc, c) => acc + c.revenue, 0))
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Area SVG Chart */}
              <div className="flex-1 relative z-10 w-full">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 220" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                      <stop offset="0%" style={{ stopColor: 'rgba(255, 43, 43, 0.3)', stopOpacity: 1 }}></stop>
                      <stop offset="100%" style={{ stopColor: 'rgba(255, 43, 43, 0)', stopOpacity: 1 }}></stop>
                    </linearGradient>
                    <filter id="lineGlow">
                      <feGaussianBlur stdDeviation="4" result="blur"></feGaussianBlur>
                      <feComposite in="SourceGraphic" in2="blur" operator="over"></feComposite>
                    </filter>
                  </defs>

                  {/* Horizontal Gridlines */}
                  <g className="opacity-5">
                    <line stroke="white" strokeWidth="0.5" x1="0" x2="1000" y1="55" y2="55"></line>
                    <line stroke="white" strokeWidth="0.5" x1="0" x2="1000" y1="110" y2="110"></line>
                    <line stroke="white" strokeWidth="0.5" x1="0" x2="1000" y1="165" y2="165"></line>
                  </g>

                  {/* SVG Paths */}
                  {revenueChart && revenueChart.length > 0 ? (
                    (() => {
                      const maxRevenue = Math.max(...revenueChart.map((d) => d.revenue), 10000);
                      const points = revenueChart.map((d, index) => {
                        const x = (index / (revenueChart.length - 1)) * 1000;
                        const y = 190 - (d.revenue / maxRevenue) * 150;
                        return { x, y, val: d.revenue, date: d.date };
                      });

                      const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
                      const areaD = `${pathD} L${points[points.length - 1].x},200 L${points[0].x},200 Z`;

                      return (
                        <>
                          <path d={areaD} fill="url(#chartGradient)"></path>
                          <path d={pathD} fill="none" filter="url(#lineGlow)" stroke="#FF2B2B" strokeWidth="3" strokeLinecap="round"></path>
                          
                          {/* Interactive Hotbox Circles */}
                          {points.map((p, i) => (
                            <circle
                              key={i}
                              cx={p.x}
                              cy={p.y}
                              r="5"
                              fill="#FF2B2B"
                              stroke="white"
                              strokeWidth="1.5"
                              className="cursor-pointer hover:r-7 transition-all duration-100"
                              onMouseEnter={(e) =>
                                showTooltip(
                                  e,
                                  new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
                                  formatINR(p.val),
                                  'Daily Telemetry Inflow'
                                )
                              }
                              onMouseMove={updateTooltipPosition}
                              onMouseLeave={hideTooltip}
                            ></circle>
                          ))}
                        </>
                      );
                    })()
                  ) : (
                    // Default fallback line path representing empty telemetry
                    <>
                      <path d="M0,180 C200,170 400,160 600,165 C800,150 900,120 1000,110 L1000,200 L0,200 Z" fill="url(#chartGradient)"></path>
                      <path d="M0,180 C200,170 400,160 600,165 C800,150 900,120 1000,110" fill="none" filter="url(#lineGlow)" stroke="#FF2B2B" strokeWidth="3" strokeLinecap="round"></path>
                    </>
                  )}
                </svg>
              </div>

              {/* X-Axis labels */}
              <div className="flex justify-between border-t border-white/5 pt-4 mt-2 font-data-sm text-[10px] text-on-surface-variant/60 uppercase tracking-widest">
                <span>Month Start</span>
                <span>Telemetry Midpoint</span>
                <span>Active Ledger Today</span>
              </div>
            </div>

            {/* Composition Matrix (Donut Chart) */}
            <div className="lg:col-span-4 glass-panel p-6 rounded-2xl flex flex-col items-center justify-between">
              <p className="font-label-caps text-[10px] text-on-surface-variant self-start tracking-[0.2em] mb-4">
                <span className="w-1.5 h-1.5 bg-performance-red rounded-full"></span>
                COMPOSITION MATRIX
              </p>

              <div className="relative w-48 h-48 flex items-center justify-center my-4">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" fill="none" r="16" stroke="rgba(255,255,255,0.03)" strokeWidth="3.5"></circle>
                  {extendedStats?.service_mix && extendedStats.service_mix.length > 0 ? (
                    (() => {
                      const total = extendedStats.service_mix.reduce((acc, c) => acc + Number(c.revenue), 0);
                      let accumulatedPercent = 0;
                      const colors = ['#FF2B2B', '#930100', '#c8c6c7', '#ff8a7a', '#555555'];

                      return extendedStats.service_mix.map((item, index) => {
                        const percent = (Number(item.revenue) / (total || 1)) * 100;
                        const dashArray = `${percent}, 100`;
                        const dashOffset = -accumulatedPercent;
                        accumulatedPercent += percent;

                        return (
                          <circle
                            key={index}
                            className="donut-segment transition-all duration-300"
                            cx="18"
                            cy="18"
                            r="16"
                            fill="none"
                            stroke={colors[index % colors.length]}
                            strokeWidth="3.5"
                            strokeDasharray={dashArray}
                            strokeDashoffset={dashOffset}
                            strokeLinecap="round"
                            onMouseEnter={(e) =>
                              showTooltip(
                                e,
                                item.service_type.toUpperCase(),
                                formatINR(Number(item.revenue)),
                                `${Math.round(percent)}% Share`
                              )
                            }
                            onMouseMove={updateTooltipPosition}
                            onMouseLeave={hideTooltip}
                          ></circle>
                        );
                      });
                    })()
                  ) : (
                    // Default fallback segments
                    <>
                      <circle cx="18" cy="18" r="16" fill="none" stroke="#FF2B2B" strokeWidth="3.5" strokeDasharray="65, 100" strokeLinecap="round"></circle>
                      <circle cx="18" cy="18" r="16" fill="none" stroke="#930100" strokeWidth="3.5" strokeDasharray="25, 100" strokeDashoffset="-65"></circle>
                      <circle cx="18" cy="18" r="16" fill="none" stroke="#444444" strokeWidth="3.5" strokeDasharray="10, 100" strokeDashoffset="-90" strokeLinecap="round"></circle>
                    </>
                  )}
                </svg>
                <div className="absolute text-center">
                  <p className="font-data-lg text-2xl font-bold text-white tracking-tight">
                    {kpis ? formatINR(kpis.month_revenue) : '₹0'}
                  </p>
                  <p className="font-label-caps text-[8px] text-on-surface-variant tracking-[0.2em] mt-1">MTD TOTAL</p>
                </div>
              </div>

              {/* Legend List */}
              <div className="w-full space-y-2 mt-4 max-h-[120px] overflow-y-auto custom-scrollbar">
                {extendedStats?.service_mix && extendedStats.service_mix.length > 0 ? (
                  extendedStats.service_mix.map((item, index) => {
                    const colors = ['bg-[#FF2B2B]', 'bg-[#930100]', 'bg-[#c8c6c7]', 'bg-[#ff8a7a]', 'bg-[#555555]'];
                    return (
                      <div key={index} className="flex justify-between items-center px-3 py-2 rounded-xl bg-white/5 border border-white/5 group hover:border-performance-red/40 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className={`w-2.5 h-2.5 rounded-full ${colors[index % colors.length]} shadow-[0_0_6px_rgba(255,43,43,0.3)]`}></span>
                          <span className="font-label-caps text-[9px] tracking-wider text-white truncate max-w-[120px]">
                            {item.service_type.toUpperCase()}
                          </span>
                        </div>
                        <span className="font-data-sm text-xs font-bold text-performance-red">
                          {formatINR(Number(item.revenue))}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <>
                    <div className="flex justify-between items-center px-3 py-2 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-performance-red"></span>
                        <span className="font-label-caps text-[9px] tracking-wider text-white">PPF INSTALLS</span>
                      </div>
                      <span className="font-data-sm text-xs font-bold text-performance-red">65%</span>
                    </div>
                    <div className="flex justify-between items-center px-3 py-2 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-deep-crimson"></span>
                        <span className="font-label-caps text-[9px] tracking-wider text-white">CERAMIC PRO</span>
                      </div>
                      <span className="font-data-sm text-xs font-bold text-on-surface">25%</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Lower Bento Grid Row: Funnel and Operators */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Lead Funnel */}
            <div className="lg:col-span-8 glass-panel p-6 rounded-2xl flex flex-col relative overflow-hidden">
              <div className="flex justify-between items-center mb-8">
                <p className="font-label-caps text-[10px] text-on-surface-variant tracking-[0.2em] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-performance-red rounded-full"></span>
                  PIPELINE CONVERSION VELOCITY
                </p>
                <div className="flex items-center gap-2 text-performance-red">
                  <span className="material-symbols-outlined text-sm">speed</span>
                  <span className="font-data-sm text-[10px] tracking-widest">LIVE TRACKING</span>
                </div>
              </div>

              {/* Render high-tech funnel stages */}
              <div className="flex-1 flex flex-col justify-center gap-2.5">
                {leadPipeline ? (
                  (() => {
                    const getCount = (statusList: string[]) =>
                      leadPipeline.pipeline
                        .filter((item) => statusList.includes(item.status))
                        .reduce((sum, item) => sum + item.count, 0);

                    const acquisition = getCount(['new']);
                    const contacted = getCount(['contacted']);
                    const qualified = getCount(['interested', 'quotation_sent']);
                    const converted = getCount(['booked']);

                    const funnelStages = [
                      { label: 'NEW ACQUISITION', val: acquisition, width: 'w-full', bg: 'bg-white/5 border-white/10 text-on-surface-variant' },
                      { label: 'CONTACTED LEADS', val: contacted, width: 'w-[85%]', bg: 'bg-performance-red/10 border-performance-red/20 text-on-surface' },
                      { label: 'QUALIFIED OPPORTUNITIES', val: qualified, width: 'w-[70%]', bg: 'bg-performance-red/35 border-performance-red/45 text-white' },
                      { label: 'CONVERTED BOOKINGS', val: converted, width: 'w-[55%]', bg: 'performance-gradient text-white font-bold shadow-[0_10px_30px_rgba(255,43,43,0.15)] border-white/10' },
                    ];

                    return funnelStages.map((stage, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-col items-center group relative h-14 funnel-stage cursor-pointer`}
                        onMouseEnter={(e) =>
                          showTooltip(
                            e,
                            stage.label,
                            `${stage.val} Leads`,
                            idx > 0 && funnelStages[idx - 1].val > 0
                              ? `${Math.round((stage.val / funnelStages[idx - 1].val) * 100)}% Conversion from last stage`
                              : 'Acquisition Baseline'
                          )
                        }
                        onMouseMove={updateTooltipPosition}
                        onMouseLeave={hideTooltip}
                      >
                        <div className={`funnel-tier ${stage.width} h-full border flex items-center justify-between px-4 sm:px-10 ${stage.bg}`}>
                          <span className="font-label-caps text-[10px] tracking-wider">{stage.label}</span>
                          <span className="font-data-lg text-lg font-bold">{stage.val}</span>
                        </div>
                      </div>
                    ));
                  })()
                ) : (
                  // Static fallback bento funnel layout
                  <>
                    <div className="funnel-tier w-full h-14 bg-white/5 border border-white/10 flex items-center justify-between px-4 sm:px-10">
                      <span className="font-label-caps text-[10px] text-on-surface-variant">NEW ACQUISITION</span>
                      <span className="font-data-lg text-lg text-white">—</span>
                    </div>
                    <div className="funnel-tier w-[85%] h-14 bg-performance-red/20 border border-performance-red/30 flex items-center justify-between px-4 sm:px-10">
                      <span className="font-label-caps text-[10px] text-on-surface">CONTACTED</span>
                      <span className="font-data-lg text-lg text-white">—</span>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-8 flex justify-between items-center text-[10px] font-label-caps border-t border-white/5 pt-4">
                <span className="text-on-surface-variant">
                  TOTAL FUNNEL REACH: <span className="text-performance-red font-bold">{leadPipeline?.total ?? 0}</span>
                </span>
                <button
                  onClick={() => navigate('/leads')}
                  className="text-performance-red hover:scale-105 transition-all flex items-center gap-1 uppercase tracking-widest font-bold text-[9px]"
                >
                  PIPELINE DEPLOYMENT <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </button>
              </div>
            </div>

            {/* Elite Operators Section */}
            <div className="lg:col-span-4 glass-panel p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <p className="font-label-caps text-[10px] text-on-surface-variant tracking-[0.2em] mb-8">
                  <span className="w-1.5 h-1.5 bg-performance-red rounded-full"></span>
                  ELITE OPERATORS
                </p>

                <div className="space-y-4">
                  {/* Operator 1 */}
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5 group hover:border-performance-red/40 transition-all cursor-pointer">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-lg bg-surface-container-highest border border-white/10 flex items-center justify-center text-performance-red">
                        <span className="material-symbols-outlined text-2xl">construction</span>
                      </div>
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-performance-red rounded-full flex items-center justify-center border border-surface">
                        <span className="material-symbols-outlined text-[8px] text-white">star</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-white">SYSTEM OPERATOR</p>
                      <p className="text-[8px] text-on-surface-variant font-label-caps tracking-widest mt-0.5">
                        MASTER CERTIFIED
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-data-sm text-xs text-performance-red font-bold">100% ACTIVE</p>
                      <div className="w-12 h-1 bg-white/10 rounded-full mt-1.5 overflow-hidden">
                        <div className="w-[100%] h-full performance-gradient rounded-full"></div>
                      </div>
                    </div>
                  </div>

                  {/* Operator 2 */}
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5 group hover:border-performance-red/40 transition-all cursor-pointer">
                    <div className="w-12 h-12 rounded-lg bg-surface-container-highest border border-white/10 flex items-center justify-center text-performance-red">
                      <span className="material-symbols-outlined text-2xl">badge</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-white">STAFF CREW</p>
                      <p className="text-[8px] text-on-surface-variant font-label-caps tracking-widest mt-0.5">
                        ON-SITE AGENTS
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-data-sm text-xs text-white font-bold">
                        {kpis?.staff_present ?? 0} PRESENT
                      </p>
                      <div className="w-12 h-1 bg-white/10 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="h-full performance-gradient rounded-full"
                          style={{
                            width: kpis ? `${Math.round((kpis.staff_present / (kpis.total_staff || 1)) * 100)}%` : '0%',
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => navigate('/staff')}
                className="w-full mt-6 py-3 border border-white/5 hover:border-performance-red/40 text-[9px] font-label-caps text-on-surface-variant tracking-widest uppercase rounded-xl transition-all"
              >
                MANAGE PERSONNEL LEDGER
              </button>
            </div>
          </div>

          {/* Bottom Table Section: Live status feed */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-12 glass-panel p-0 rounded-2xl overflow-hidden flex flex-col relative">
              <div className="px-8 py-5 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
                <p className="font-label-caps text-[10px] text-on-surface-variant tracking-[0.2em] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-performance-red rounded-full animate-pulse shadow-[0_0_8px_#FF2B2B]"></span>
                  LIVE STATUS STREAM
                </p>
                <button
                  onClick={() => navigate('/jobs')}
                  className="font-data-sm text-[9px] text-performance-red tracking-widest uppercase hover:underline"
                >
                  OPERATIONAL RUNTIME
                </button>
              </div>

              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                  <thead>
                    <tr className="bg-black/30 text-on-surface-variant/60 font-label-caps text-[9px] uppercase tracking-widest border-b border-white/5">
                      <th className="px-8 py-3.5 font-normal">OPERATIONS VEHICLE</th>
                      <th className="px-8 py-3.5 font-normal">TELEMETRY CODE</th>
                      <th className="px-8 py-3.5 font-normal">CURRENT PHASE</th>
                      <th className="px-8 py-3.5 font-normal text-right">LEDGER VAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {recentJobs && recentJobs.length > 0 ? (
                      recentJobs.slice(0, 5).map((job: any) => (
                        <tr
                          key={job.id}
                          className="hover:bg-performance-red/[0.01] transition-colors group cursor-default"
                        >
                          <td className="px-8 py-4">
                            <div className="flex items-center gap-3">
                              <span className="w-1.5 h-1.5 rounded-full bg-performance-red shadow-[0_0_6px_#FF2B2B]"></span>
                              <span className="font-data-sm text-xs text-white">
                                {job.make} {job.model}
                              </span>
                            </div>
                          </td>
                          <td className="px-8 py-4 font-data-sm text-xs text-on-surface-variant/80">
                            #{job.job_code}
                          </td>
                          <td className="px-8 py-4 font-label-caps text-[10px] text-on-surface-variant tracking-wider">
                            {getStatusLabel(job.status)}
                          </td>
                          <td className="px-8 py-4 font-data-sm text-xs text-right text-performance-red">
                            {formatINR(job.total_amount)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-8 py-10 text-center text-xs text-on-surface-variant/40">
                          NO ACTIVE OPERATIONS TELEMETRY DETECTED
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // ═════════════════════════════════════════════════════════════
        // CONTROL CENTER ELITE — TECHNICIAN / STAFF OPERATIONS VIEW
        // ═════════════════════════════════════════════════════════════
        <div className="space-y-8">
          {/* Header Row */}
          <div className="flex justify-between items-end">
            <div>
              <h2 className="font-display-hero text-headline-lg text-white mb-2 tracking-tight">OPERATIONS TELEMETRY</h2>
              <p className="font-label-caps text-label-caps text-on-surface-variant/80 tracking-widest uppercase">
                Active Detail Bay Operations &amp; Material Tracking
              </p>
            </div>
            <div className="hidden md:flex text-xs font-label-caps text-on-surface-variant flex items-center gap-3 bg-white/5 border border-white/5 px-4 py-2.5 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-performance-red opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-performance-red shadow-[0_0_8px_rgba(255,43,43,0.8)]"></span>
              </span>
              SYSTEM LIVE
            </div>
          </div>

          {/* Operations KPI Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* KPI 1: Inflow */}
            <div className="glass-panel p-6 rounded-xl relative overflow-hidden group">
              <div className="flex justify-between items-start mb-6">
                <span className="font-label-caps text-[10px] text-on-surface-variant tracking-widest uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-performance-red shadow-[0_0_8px_rgba(255,43,43,0.5)]"></span>
                  Today's Inflow
                </span>
                <span className="material-symbols-outlined text-performance-red/40 group-hover:text-performance-red transition-colors">
                  payments
                </span>
              </div>
              <div className="font-data-lg text-3xl font-bold text-white text-glow-red tracking-tight">
                {kpis ? formatINR(kpis.today_revenue) : '₹0'}
              </div>
              <div className="mt-3 font-data-sm text-[11px] flex items-center gap-1 text-emerald-400">
                <span className="material-symbols-outlined text-[14px]">trending_up</span> Live operational ledger
              </div>
            </div>

            {/* KPI 2: Active Bays */}
            <div className="glass-panel p-6 rounded-xl group">
              <div className="flex justify-between items-start mb-6">
                <span className="font-label-caps text-[10px] text-on-surface-variant tracking-widest uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-performance-red"></span>
                  Active Operations
                </span>
                <span className="material-symbols-outlined text-on-surface-variant group-hover:text-performance-red transition-colors">
                  handyman
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="font-data-lg text-3xl font-bold text-white">
                  {kpis?.active_jobs ?? 0}
                </span>
                <span className="font-data-sm text-[11px] text-on-surface-variant">Bays Engaged</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full performance-gradient shadow-[0_0_10px_rgba(255,43,43,0.3)] rounded-full"
                  style={{
                    width: kpis ? `${Math.min(100, Math.round((kpis.active_jobs / 8) * 100))}%` : '0%',
                  }}
                ></div>
              </div>
            </div>

            {/* KPI 3: Staff Presence */}
            <div className="glass-panel p-6 rounded-xl group">
              <div className="flex justify-between items-start mb-6">
                <span className="font-label-caps text-[10px] text-on-surface-variant tracking-widest uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-performance-red"></span>
                  Attendance
                </span>
                <span className="material-symbols-outlined text-on-surface-variant group-hover:text-performance-red transition-colors">
                  group
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="font-data-lg text-3xl font-bold text-white">
                  {kpis?.staff_present ?? 0}
                </span>
                <span className="font-data-sm text-[11px] text-on-surface-variant">
                  / {kpis?.total_staff ?? 0} On-Site
                </span>
              </div>
              <div className="flex gap-1.5">
                {Array.from({ length: 8 }).map((_, idx) => {
                  const presentCount = kpis?.staff_present ?? 0;
                  const totalCount = kpis?.total_staff ?? 8;
                  const isActive = idx < presentCount;
                  const isTotal = idx < totalCount;

                  return (
                    <div
                      key={idx}
                      className={`flex-1 h-2 rounded-sm ${
                        isActive
                          ? 'bg-performance-red shadow-[0_0_6px_rgba(255,43,43,0.4)]'
                          : isTotal
                          ? 'bg-white/10'
                          : 'bg-white/5'
                      }`}
                    ></div>
                  );
                })}
              </div>
            </div>

            {/* KPI 4: Supply Chain */}
            <div className="glass-panel p-6 rounded-xl border-l-[3px] border-l-performance-red bg-performance-red/[0.02]">
              <div className="flex justify-between items-start mb-6">
                <span className="font-label-caps text-[10px] text-performance-red tracking-widest uppercase flex items-center gap-2 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-performance-red animate-ping"></span>
                  Supply Alert
                </span>
                <span className="material-symbols-outlined text-performance-red">warning</span>
              </div>
              <div className="font-data-lg text-3xl font-bold text-white">{kpis?.low_stock_count ?? 0}</div>
              <div className="font-label-caps text-[9px] text-on-surface-variant mt-2 tracking-widest uppercase">
                Items below critical threshold
              </div>
            </div>
          </div>

          {/* Lower layout: Operations & Supply Chain lists */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Active Service Bays List */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-headline-md text-lg text-white">Active Bay Operations</h3>
                <button
                  onClick={() => navigate('/jobs')}
                  className="text-performance-red font-label-caps text-[10px] hover:text-white transition-colors flex items-center gap-1 group tracking-widest"
                >
                  MONITOR ALL WORKPLACE{' '}
                  <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">
                    arrow_right_alt
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {recentJobs && recentJobs.length > 0 ? (
                  recentJobs.slice(0, 3).map((job: any, index: number) => (
                    <div
                      key={job.id}
                      className="glass-panel rounded-2xl overflow-hidden group hover:border-performance-red/30 transition-all duration-500"
                    >
                      <div className="h-40 bg-void-black relative overflow-hidden">
                        <img
                          alt={job.make}
                          className="w-full h-full object-cover opacity-40 mix-blend-luminosity group-hover:scale-105 group-hover:opacity-75 group-hover:mix-blend-normal transition-all duration-700"
                          src={getCarImage(job.make, job.model)}
                        />
                        <div className="absolute top-4 left-4 bg-void-black/90 backdrop-blur-md px-3 py-1 rounded text-performance-red font-data-sm text-[10px] border border-performance-red/30 tracking-widest uppercase font-bold">
                          BAY 0{index + 1}
                        </div>
                        <div className="absolute bottom-4 left-4 right-4 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[10px] font-label-caps text-performance-red uppercase font-bold">
                            Live Detailing Telemetry
                          </span>
                        </div>
                      </div>
                      <div className="p-6">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-headline-md text-base text-white">
                            {job.make} {job.model}
                          </h4>
                          <span className="font-data-sm text-performance-red text-sm font-bold">
                            {getJobProgress(job.status)}%
                          </span>
                        </div>
                        <p className="font-data-sm text-[11px] text-on-surface-variant mb-4 uppercase tracking-wider">
                          {getStatusLabel(job.status)}
                        </p>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-performance-red rounded-full relative shadow-[0_0_8px_rgba(255,43,43,0.5)]"
                            style={{ width: `${getJobProgress(job.status)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 py-10 text-center text-xs text-on-surface-variant/40 glass-panel rounded-2xl">
                    No active operations registered. All detailing bays ready for assignment.
                  </div>
                )}

                {/* Always show at least one Assign bay option */}
                <div
                  onClick={() => navigate('/jobs/new')}
                  className="glass-panel rounded-2xl flex items-center justify-center border-dashed border-2 border-white/5 bg-white/[0.01] hover:bg-performance-red/[0.02] hover:border-performance-red/30 transition-all duration-300 cursor-pointer min-h-[220px] group"
                >
                  <div className="text-center p-6">
                    <div className="w-14 h-14 rounded-full bg-void-black flex items-center justify-center mb-3 border border-white/5 group-hover:scale-110 group-hover:border-performance-red/50 transition-all shadow-xl">
                      <span className="material-symbols-outlined text-2xl text-performance-red">add</span>
                    </div>
                    <p className="font-label-caps text-[10px] tracking-[0.2em] text-on-surface-variant group-hover:text-white transition-colors uppercase font-bold">
                      CREATE NEW JOB CARD
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Supply Chain Alerts Column */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-headline-md text-lg text-white">Supply Telemetry</h3>
                <span className="material-symbols-outlined text-on-surface-variant">inventory_2</span>
              </div>

              <div className="space-y-4">
                {lowStock && lowStock.length > 0 ? (
                  lowStock.slice(0, 3).map((item: any) => (
                    <div
                      key={item.id}
                      className="glass-panel p-5 border-l-[3px] border-l-performance-red bg-performance-red/[0.01] relative group overflow-hidden"
                    >
                      <div className="flex items-start gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-lg bg-performance-red/10 flex items-center justify-center border border-performance-red/20 shrink-0 group-hover:bg-performance-red/20 transition-colors">
                          <span className="material-symbols-outlined text-performance-red">science</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <h4 className="font-data-sm text-xs font-bold text-white truncate max-w-[120px]">
                              {item.name}
                            </h4>
                            <span className="font-data-sm text-performance-red font-bold text-xs">
                              {item.current_stock} {item.unit}
                            </span>
                          </div>
                          <p className="font-label-caps text-[8px] text-on-surface-variant tracking-wider uppercase">
                            Threshold: {item.min_threshold} {item.unit}
                          </p>
                          <button
                            onClick={() => navigate('/inventory')}
                            className="mt-3 w-full text-[9px] font-label-caps tracking-widest text-white bg-performance-red rounded py-2 hover:brightness-110 transition-all uppercase font-bold"
                          >
                            Restock Item
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-10 text-center text-xs text-on-surface-variant/40 glass-panel rounded-xl">
                    All inventory items at optimal operational volume.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
