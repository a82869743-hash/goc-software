import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { usePermissionsStore } from '../stores/permissionsStore';
import apiClient from '../api/client';
import toast from 'react-hot-toast';
import type { ApiResponse, LoginResponse } from '../types';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) {
      toast.error('Please enter phone and password');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const { data } = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', {
        phone,
        password,
      });

      if (data.success) {
        setAuth(data.data.token, data.data.staff);
        await usePermissionsStore.getState().fetchPermissions();
        toast.success(`Welcome back, ${data.data.staff.full_name}!`);
        navigate('/dashboard');
      }
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Authentication failed. Invalid security sequence.';
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-void-black min-h-screen flex items-center justify-center relative overflow-hidden font-body-lg text-body-lg text-on-surface selection:bg-performance-red selection:text-white">
      {/* Subtle Ambient Glow */}
      <div className="ambient-glow" />

      {/* Telemetry Accents */}
      <div className="telemetry-line-h top-[25%] opacity-40" />
      <div className="telemetry-line-h bottom-[25%] opacity-40" />
      <div className="telemetry-line-v left-[20%] opacity-40" />
      <div className="telemetry-line-v right-[20%] opacity-40" />

      {/* Login Panel */}
      <main className="w-full max-w-[480px] px-6 relative z-10">
        {/* Glass Container */}
        <div className="glass-panel rounded-xl shadow-[0_0_80px_rgba(0,0,0,0.5),0_0_40px_rgba(255,43,43,0.05)] relative overflow-hidden transition-all duration-700">
          {/* Inner Red Accent Ring */}
          <div className="absolute inset-0 pointer-events-none rounded-xl border border-performance-red/10" />
          {/* Metallic Top Edge */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <div className="p-6 sm:p-10">
            {/* Brand Header */}
            <header className="text-center mb-8 sm:mb-12 flex flex-col items-center">
              <div className="relative group mb-6">
                <span
                  className="material-symbols-outlined text-performance-red text-[42px] drop-shadow-[0_0_12px_rgba(255,43,43,0.4)]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  diamond
                </span>
                <div className="absolute inset-0 bg-performance-red/20 blur-xl scale-150 rounded-full opacity-50" />
              </div>
              <h1 className="font-display-hero text-display-hero text-white uppercase tracking-[-0.04em] drop-shadow-[0_0_20px_rgba(255,43,43,0.15)]">
                GOC
              </h1>
              <h2 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-[0.3em] mt-3 opacity-80">
                Studio Management
              </h2>
            </header>

            {/* Form */}
            <form className="space-y-6" onSubmit={handleLogin}>
              {/* Error Message */}
              {errorMsg && (
                <div className="bg-performance-red/10 border border-performance-red/30 rounded-lg p-3 flex items-center gap-3 animate-pulse">
                  <span
                    className="material-symbols-outlined text-performance-red text-sm"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    error
                  </span>
                  <p className="font-data-sm text-data-sm text-performance-red">{errorMsg}</p>
                </div>
              )}

              {/* Operator ID Input */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <label
                    className="font-label-caps text-label-caps text-on-surface-variant flex items-center gap-2 group cursor-pointer"
                    htmlFor="login-phone"
                  >
                    <span className="w-1 h-1 rounded-full bg-performance-red shadow-[0_0_5px_#FF2B2B]" />
                    <span className="group-hover:text-performance-red transition-colors duration-300">
                      Operator ID
                    </span>
                  </label>
                </div>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-performance-red transition-all duration-300">
                    terminal
                  </span>
                  <input
                    id="login-phone"
                    type="text"
                    className="w-full bg-surface-container-low/30 border border-white/5 rounded-lg py-4 pl-12 pr-4 font-data-lg text-data-lg text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-performance-red/60 focus:bg-surface-container-low/50 focus:ring-0 transition-all duration-500 shadow-inner"
                    placeholder="Enter Access Code"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.slice(0, 15))}
                    maxLength={15}
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              {/* Security Key Input */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <label
                    className="font-label-caps text-label-caps text-on-surface-variant flex items-center gap-2 group cursor-pointer"
                    htmlFor="login-password"
                  >
                    <span className="w-1 h-1 rounded-full bg-performance-red shadow-[0_0_5px_#FF2B2B]" />
                    <span className="group-hover:text-performance-red transition-colors duration-300">
                      Security Key
                    </span>
                  </label>
                  <a
                    href="#"
                    className="font-data-sm text-data-sm text-performance-red/80 hover:text-performance-red hover:underline decoration-1 underline-offset-4 transition-all duration-300"
                  >
                    Recover?
                  </a>
                </div>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-performance-red transition-all duration-300">
                    lock
                  </span>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="w-full bg-surface-container-low/30 border border-white/5 rounded-lg py-4 pl-12 pr-12 font-data-lg text-data-lg text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-performance-red/60 focus:bg-surface-container-low/50 focus:ring-0 transition-all duration-500 shadow-inner tracking-widest"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 hover:text-performance-red transition-colors focus:outline-none"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full relative overflow-hidden group performance-gradient text-white font-headline-md text-headline-md rounded-lg py-5 flex justify-center items-center gap-3 transition-all duration-500 hover:shadow-[0_0_40px_rgba(255,43,43,0.35)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed border border-white/10"
                >
                  {/* Shimmer Effect */}
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer_2s_infinite] skew-x-12" />
                  {loading ? (
                    <div className="relative z-10 flex items-center gap-3">
                      <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span className="tracking-tight font-bold">AUTHENTICATING...</span>
                    </div>
                  ) : (
                    <>
                      <span className="relative z-10 tracking-tight font-bold">ENTER DETAILING HANGAR</span>
                      <span
                        className="material-symbols-outlined relative z-10 transition-transform duration-500 group-hover:translate-x-2"
                        style={{ fontVariationSettings: "'wght' 600" }}
                      >
                        arrow_forward
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Footer Telemetry Data */}
            <div className="mt-10 pt-6 border-t border-white/5 flex justify-between items-center opacity-40">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-performance-red animate-pulse shadow-[0_0_8px_#FF2B2B]" />
                <span className="font-data-sm text-data-sm text-on-surface-variant uppercase">
                  Secure_Link: Active
                </span>
              </div>
              <span className="font-data-sm text-data-sm text-on-surface-variant">REL_2.4.01</span>
            </div>
          </div>
        </div>

        {/* External HUD Elements */}
        <div className="absolute -top-16 -left-16 font-data-sm text-data-sm text-performance-red/20 rotate-[-90deg] tracking-[0.3em] font-medium pointer-events-none">
          NODE_01_SECURED
        </div>
        <div className="absolute -bottom-16 -right-16 font-data-sm text-data-sm text-performance-red/20 rotate-[-90deg] tracking-[0.3em] font-medium pointer-events-none">
          AWAITING_PROTOCOLS
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
