import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { staffManagementAPI } from '../api/staffManagement';

interface PermissionsState {
  permissions: Record<string, number> | null;
  isAdmin: boolean;
  fetchPermissions: () => Promise<void>;
  clearPermissions: () => void;
}

export const usePermissionsStore = create<PermissionsState>()(
  persist(
    (set) => ({
      permissions: null,
      isAdmin: false,
      fetchPermissions: async () => {
        try {
          const res = await staffManagementAPI.getMyPermissions();
          const data = res.data.data;
          set({ permissions: data, isAdmin: data._isAdmin === true });
        } catch (e) {
          console.error('Failed to fetch permissions', e);
        }
      },
      clearPermissions: () => set({ permissions: null, isAdmin: false }),
    }),
    { name: 'goc-permissions' }
  )
);
