import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { usePermissions } from '../../utils/usePermissions';
import { usePermissionsStore } from '../../stores/permissionsStore';

interface NavItem {
  to: string;
  icon: string;
  label: string;
  permKey: string;
  badge?: number;
}

const mainItems: NavItem[] = [
  { to: '/advance-bookings', icon: 'book_online', label: 'ADVANCE BOOKING', permKey: 'perm_advance_bookings' },
  { to: '/jobs/new', icon: 'precision_manufacturing', label: 'JOB CARD CREATING', permKey: 'perm_job_cards' },
  { to: '/quick-jobs', icon: 'bolt', label: 'QUICK SERVICE OR WASH', permKey: 'perm_quick_jobs' },
  { to: '/jobs', icon: 'list_alt', label: 'ALL JOB CARDS', permKey: 'perm_job_cards' },
];

const otherItems: NavItem[] = [
  { to: '/dashboard', icon: 'dashboard', label: 'DASHBOARD', permKey: 'perm_dashboard' },
  { to: '/leads', icon: 'leaderboard', label: 'LEADS', permKey: 'perm_leads' },
  { to: '/customers', icon: 'person', label: 'CUSTOMERS', permKey: 'perm_customers' },
  { to: '/kiosk-attendance', icon: 'screenshot_monitor', label: 'ATTENDANCE KIOSK', permKey: 'perm_dashboard' },
  { to: '/quotations', icon: 'request_quote', label: 'QUOTATIONS', permKey: 'perm_quotations' },
  { to: '/invoices', icon: 'receipt_long', label: 'INVOICES', permKey: 'perm_invoices' },
  { to: '/warranties', icon: 'verified', label: 'WARRANTIES', permKey: 'perm_job_cards' },
  { to: '/inventory', icon: 'inventory_2', label: 'INVENTORY', permKey: 'perm_inventory' },
  { to: '/staff', icon: 'group', label: 'STAFF', permKey: 'perm_staff_management' },
  { to: '/staff/attendance-payments', icon: 'payments', label: 'STAFF PAYMENTS & ATTENDANCE', permKey: 'perm_staff_management' },
  { to: '/marketing', icon: 'campaign', label: 'MARKETING', permKey: 'perm_marketing' },
  { to: '/commissions', icon: 'payments', label: 'COMMISSIONS', permKey: 'perm_commissions' },
  { to: '/reports', icon: 'bar_chart', label: 'REPORTS', permKey: 'perm_reports' },
  { to: '/admin/staff', icon: 'admin_panel_settings', label: 'STAFF & PERMISSIONS', permKey: 'perm_staff_management' },
  { to: '/admin/logs', icon: 'history', label: 'SYSTEM LOGS', permKey: 'perm_staff_management' },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const { staff, logout } = useAuthStore();
  const { can } = usePermissions();

  const handleLogout = () => {
    logout();
    usePermissionsStore.getState().clearPermissions();
    navigate('/login');
  };

  const handleNavClick = () => {
    // Close sidebar on mobile after navigation
    if (onClose) onClose();
  };

  const visibleMainItems = mainItems.filter((item) => can(item.permKey));
  const visibleOtherItems = otherItems.filter((item) => can(item.permKey));

  return (
    <nav
      className={`
        fixed left-0 top-0 h-full flex flex-col z-50
        bg-black/60 backdrop-blur-3xl w-64 border-r border-white/5
        shadow-[20px_0_40px_rgba(0,0,0,0.8)]
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}
    >
      {/* ── Brand Header ─────────────────────────────── */}
      <div className="px-6 py-5 border-b border-white/5 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="font-display-hero text-headline-sm tracking-tighter text-white">
            GOC <span className="text-performance-red">STUDIO</span>
          </h1>
          <p className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-[0.2em] uppercase mt-0.5">
            Elite Management
          </p>
        </div>
        {/* Close button - mobile only */}
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
      </div>

      {/* ── Main Features (Top Section - Fixed/Stationary) ──────────────── */}
      <div className="py-3 px-3.5 space-y-1 shrink-0 border-b border-white/5 bg-white/[0.01]">
        <p className="font-label-caps text-[8.5px] text-performance-red/60 tracking-wider mb-1 px-3 uppercase font-bold">MAIN MODULES</p>
        {visibleMainItems.map(({ to, icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            onClick={handleNavClick}
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
        {visibleOtherItems.map(({ to, icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            onClick={handleNavClick}
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
        {can('perm_settings') && (
          <NavLink
            to="/settings"
            onClick={handleNavClick}
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
        )}

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
