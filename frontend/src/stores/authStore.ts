import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StaffProfile } from '../types';

interface AuthState {
  token: string | null;
  staff: StaffProfile | null;
  isAuthenticated: boolean;

  // Actions
  setAuth: (token: string, staff: StaffProfile) => void;
  logout: () => void;
  updateProfile: (updates: Partial<StaffProfile>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      staff: null,
      isAuthenticated: false,

      setAuth: (token, staff) =>
        set({
          token,
          staff,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          token: null,
          staff: null,
          isAuthenticated: false,
        }),

      updateProfile: (updates) =>
        set((state) => ({
          staff: state.staff ? { ...state.staff, ...updates } : null,
        })),
    }),
    {
      name: 'goc-auth',
      partialize: (state) => ({
        token: state.token,
        staff: state.staff,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
