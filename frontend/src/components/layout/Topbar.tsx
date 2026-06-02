import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsAPI } from '../../api/notifications';
import toast from 'react-hot-toast';

export default function Topbar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { staff, logout } = useAuthStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Live Query for notifications
  const { data: notifsRes } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsAPI.list(),
    refetchInterval: 30000, // Poll every 30 seconds
  });

  const notifications = notifsRes?.data || [];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Mutations
  const markAsReadMut = useMutation({
    mutationFn: (id: number) => notificationsAPI.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const clearAllMut = useMutation({
    mutationFn: () => notificationsAPI.clearAll(),
    onSuccess: () => {
      toast.success('Notifications cleared');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to clear notifications');
    },
  });

  const handleNotificationClick = (id: number, refType: string | null, refId: number | null) => {
    markAsReadMut.mutate(id);
    setNotifOpen(false);
    
    // Smart redirect based on notification reference type!
    if (refType === 'lead' && refId) {
      navigate('/leads');
    } else if (refType === 'job_card' && refId) {
      navigate('/jobs');
    } else if (refType === 'inventory') {
      navigate('/inventory');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="fixed top-0 right-0 w-[calc(100%-16rem)] z-40 bg-void-black/80 backdrop-blur-xl border-b border-white/5 flex justify-between items-center px-gutter-md h-20">
      {/* ── Left: System Status + Search ─────────────── */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-performance-red animate-pulse box-glow-red" />
          <span className="font-label-caps text-[10px] tracking-widest text-on-surface-variant/60 uppercase">
            System Live
          </span>
        </div>
        <div className="relative group hidden lg:block">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-tertiary/40 text-[18px] group-focus-within:text-performance-red transition-colors">
            search
          </span>
          <input
            type="text"
            placeholder="Search plates, customers, jobs…"
            className="input-glass rounded-full py-2.5 pl-11 pr-6 text-sm font-body-lg w-80"
          />
        </div>
      </div>

      {/* ── Right: Actions ────────────────────────────── */}
      <div className="flex items-center gap-6">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
            className="text-on-surface-variant hover:text-performance-red transition-all relative flex items-center"
          >
            <span className="material-symbols-outlined">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-performance-red box-glow-red" />
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-50" onClick={() => setNotifOpen(false)} />
              <div className="absolute top-[calc(100%+12px)] right-0 w-[380px] deep-glass rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.8)] z-[60] overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-performance-red" />
                    <span className="font-label-caps text-[10px] text-white tracking-widest font-bold">NOTIFICATIONS</span>
                  </div>
                  {notifications.length > 0 && (
                    <button 
                      onClick={() => clearAllMut.mutate()} 
                      disabled={clearAllMut.isPending}
                      className="font-data-sm text-[11px] text-performance-red hover:text-white transition-colors uppercase tracking-wider font-bold"
                    >
                      {clearAllMut.isPending ? 'Clearing...' : 'Clear All'}
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto max-h-[360px] custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="py-12 text-center text-on-surface-variant/30 italic text-xs uppercase tracking-wider font-bold">
                      No notifications logged
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const timeAgo = n.created_at 
                        ? new Date(n.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                        : '';
                      return (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n.id, n.reference_type, n.reference_id)}
                          className={`flex items-start gap-4 px-6 py-4 border-b border-white/5 cursor-pointer hover:bg-performance-red/5 transition-all ${
                            !n.is_read ? 'bg-performance-red/[0.02]' : ''
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                            !n.is_read ? 'bg-performance-red shadow-[0_0_8px_#FF2B2B]' : 'bg-white/10'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-data-sm text-[13px] font-medium text-white leading-tight">{n.title}</p>
                            <p className="font-data-sm text-[12px] text-on-surface-variant/50 mt-0.5">{n.body}</p>
                          </div>
                          <span className="font-data-sm text-[10px] text-performance-red/60 flex-shrink-0 mt-0.5">{timeAgo}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="text-on-surface-variant hover:text-performance-red transition-all flex items-center justify-center p-1 rounded-lg hover:bg-white/5"
        >
          <span className="material-symbols-outlined">
            {theme === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        <button className="text-on-surface-variant hover:text-performance-red transition-all">
          <span className="material-symbols-outlined">diamond</span>
        </button>

        {/* Separator */}
        <div className="h-6 w-[1px] bg-white/5" />

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
            className="flex items-center gap-3 text-on-surface-variant hover:text-white transition-all group"
          >
            <div className="text-right hidden sm:block">
              <p className="font-label-caps text-[10px] text-white tracking-widest">
                {staff?.full_name ?? 'ELITE MEMBER'}
              </p>
              <p className="font-data-sm text-[9px] text-performance-red/80 uppercase">
                {staff?.role ?? 'STUDIO OWNER'}
              </p>
            </div>
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-surface-variant border border-white/10 flex items-center justify-center group-hover:border-performance-red/50 transition-all">
                <span className="material-symbols-outlined text-performance-red group-hover:text-white transition-colors">
                  account_circle
                </span>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-void-black" />
            </div>
          </button>

          {profileOpen && (
            <>
              <div className="fixed inset-0 z-50" onClick={() => setProfileOpen(false)} />
              <div className="absolute top-[calc(100%+12px)] right-0 w-56 deep-glass rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.8)] z-[60] overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5">
                  <p className="font-headline-md text-sm font-bold text-white">{staff?.full_name ?? 'Owner'}</p>
                  <p className="font-data-sm text-xs text-on-surface-variant/50 mt-0.5">{staff?.phone ?? ''}</p>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => { navigate('/settings'); setProfileOpen(false); }}
                    className="flex items-center gap-3 w-full px-5 py-3 font-label-caps text-[10px] text-on-surface-variant/60 hover:text-white hover:bg-white/5 transition-all tracking-widest"
                  >
                    <span className="material-symbols-outlined text-[18px]">settings</span>
                    SETTINGS
                  </button>
                </div>
                <div className="border-t border-white/5 py-1">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-5 py-3 font-label-caps text-[10px] text-performance-red hover:text-white hover:bg-performance-red/10 transition-all tracking-widest"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    SIGN OUT
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
