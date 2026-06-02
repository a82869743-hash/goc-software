import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

interface NavItem {
  to: string;
  icon: string;
  label: string;
  badge?: number;
}

const mainItems: NavItem[] = [
  { to: '/advance-bookings', icon: 'book_online', label: 'ADVANCE BOOKING' },
  { to: '/jobs/new', icon: 'precision_manufacturing', label: 'JOB CARD CREATING' },
  { to: '/quick-jobs', icon: 'bolt', label: 'QUICK SERVICE OR WASH' },
  { to: '/jobs', icon: 'list_alt', label: 'ALL JOB CARDS' },
];

const otherItems: NavItem[] = [
  { to: '/dashboard', icon: 'dashboard', label: 'DASHBOARD' },
  { to: '/leads', icon: 'leaderboard', label: 'LEADS' },
  { to: '/customers', icon: 'person', label: 'CUSTOMERS' },
  { to: '/bookings', icon: 'calendar_month', label: 'SCHEDULE' },
  { to: '/quotations', icon: 'request_quote', label: 'QUOTATIONS' },
  { to: '/invoices', icon: 'receipt_long', label: 'INVOICES' },
  { to: '/inventory', icon: 'inventory_2', label: 'INVENTORY' },
  { to: '/staff', icon: 'group', label: 'STAFF' },
  { to: '/marketing', icon: 'campaign', label: 'MARKETING' },
  { to: '/commissions', icon: 'payments', label: 'COMMISSIONS' },
  { to: '/reports', icon: 'bar_chart', label: 'REPORTS' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const { staff, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="hidden md:flex fixed left-0 top-0 h-full flex-col z-50 bg-black/60 backdrop-blur-3xl w-64 border-r border-white/5 shadow-[20px_0_40px_rgba(0,0,0,0.8)]">
      {/* ── Brand Header ─────────────────────────────── */}
      <div className="px-6 py-5 border-b border-white/5 shrink-0">
        <h1 className="font-display-hero text-headline-sm tracking-tighter text-white">
          GOC <span className="text-performance-red">STUDIO</span>
        </h1>
        <p className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-[0.2em] uppercase mt-0.5">
          Elite Management
        </p>
      </div>

      {/* ── Main Features (Top Section - Fixed/Stationary) ──────────────── */}
      <div className="py-3 px-3.5 space-y-1 shrink-0 border-b border-white/5 bg-white/[0.01]">
        <p className="font-label-caps text-[8.5px] text-performance-red/60 tracking-wider mb-1 px-3 uppercase font-bold">MAIN MODULES</p>
        {mainItems.map(({ to, icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              isActive
                ? 'flex items-center gap-3 px-3 py-2 rounded-lg bg-performance-red/15 text-performance-red border border-performance-red/30 transition-all duration-300 relative overflow-hidden'
                : 'flex items-center gap-3 px-3 py-2 rounded-lg text-performance-red/80 hover:text-white hover:bg-performance-red/10 border border-performance-red/20 transition-all duration-300 group'
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-performance-red/5 to-transparent pointer-events-none" />
                )}
                <span
                  className={`material-symbols-outlined text-[18px] relative z-10 ${
                    isActive ? 'text-performance-red' : 'text-performance-red/80 group-hover:text-white transition-colors'
                  }`}
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {icon}
                </span>
                <span className={`font-label-caps text-[10px] relative z-10 tracking-widest ${isActive ? '' : 'text-performance-red/90 group-hover:text-white transition-colors'}`}>
                  {label}
                </span>
                {badge !== undefined && (
                  <span className="ml-auto font-data-sm text-[10px] bg-performance-red/10 text-performance-red px-2 py-0.5 rounded border border-performance-red/20 relative z-10">
                    {badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* ── All Other Modules (Scrolling Section) ──────────────── */}
      <div className="flex-grow py-3 px-3.5 space-y-0.5 overflow-y-auto custom-scrollbar">
        <p className="font-label-caps text-[8.5px] text-gray-600 tracking-wider mb-1.5 px-3 uppercase font-bold">OTHER MODULES</p>
        {otherItems.map(({ to, icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              isActive
                ? 'flex items-center gap-3 px-3 py-1.5 rounded-lg bg-performance-red/10 text-performance-red border-r-2 border-performance-red transition-all duration-300 relative overflow-hidden'
                : 'flex items-center gap-3 px-3 py-1.5 rounded-lg text-tertiary hover:text-white hover:bg-white/5 transition-all duration-300 group'
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-performance-red/5 to-transparent pointer-events-none" />
                )}
                <span
                  className={`material-symbols-outlined text-[18px] relative z-10 ${
                    isActive ? 'text-performance-red' : 'group-hover:text-performance-red transition-colors'
                  }`}
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {icon}
                </span>
                <span className="font-label-caps text-[10px] relative z-10 tracking-widest">
                  {label}
                </span>
                {badge !== undefined && (
                  <span className="ml-auto font-data-sm text-[10px] bg-performance-red/10 text-performance-red px-2 py-0.5 rounded border border-performance-red/20 relative z-10">
                    {badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* ── Footer ────────────────────────────────────── */}
      <div className="px-3 py-3 border-t border-white/5 space-y-0.5 shrink-0 bg-black/10">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-1.5 rounded-lg transition-all duration-300 ${
              isActive
                ? 'text-performance-red bg-performance-red/10'
                : 'text-tertiary hover:text-white hover:bg-white/5'
            }`
          }
        >
          <span className="material-symbols-outlined text-[18px]">settings</span>
          <span className="font-label-caps text-[10px] tracking-widest">SETTINGS</span>
        </NavLink>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-tertiary hover:text-performance-red hover:bg-white/5 transition-all duration-300 w-full text-left"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          <span className="font-label-caps text-[10px] tracking-widest">LOGOUT</span>
        </button>

        {/* User Profile */}
        {staff && (
          <div className="flex items-center gap-2.5 mt-2 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/5">
            <div className="w-8 h-8 rounded-lg bg-surface-container-highest border border-white/10 flex items-center justify-center text-performance-red shrink-0">
              <span className="material-symbols-outlined text-base">account_circle</span>
            </div>
            <div className="min-w-0">
              <p className="text-on-surface text-xs font-bold truncate">{staff.full_name}</p>
              <p className="text-tertiary/40 text-[9px] uppercase font-label-caps tracking-wider">
                {staff.role}
              </p>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
