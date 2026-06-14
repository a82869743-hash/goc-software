import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuthStore } from '../../stores/authStore';
import apiClient from '../../api/client';

/**
 * AppShell — Obsidian Apex Elite Layout
 * Wraps all authenticated pages with Sidebar + Topbar
 * Fully responsive: desktop sidebar always visible, mobile overlay sidebar
 */
const AppShell: React.FC = () => {
  const { updateProfile } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    // Fetch latest user details on shell load to sync any name/profile changes immediately
    apiClient.get('/auth/me')
      .then(res => {
        if (res.data && res.data.success && res.data.data) {
          updateProfile(res.data.data);
        }
      })
      .catch(err => console.error('Failed to sync user profile:', err));
  }, [updateProfile]);

  return (
    <div className="min-h-screen bg-void-black text-on-background relative overflow-hidden">
      {/* Ambient Background Glow */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-60 -right-60 w-[600px] h-[600px] rounded-full bg-performance-red/[0.03] blur-[180px]" />
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-performance-red/[0.02] blur-[160px]" />
      </div>

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Topbar onMenuToggle={() => setSidebarOpen(prev => !prev)} />

      {/* Main Content Area */}
      <main className="md:ml-64 pt-16 md:pt-20 min-h-screen relative z-10">
        <div className="p-3 sm:p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppShell;
