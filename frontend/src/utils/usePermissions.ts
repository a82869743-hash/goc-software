import { usePermissionsStore } from '../stores/permissionsStore';
import { useAuthStore } from '../stores/authStore';

export function usePermissions() {
  const { permissions, isAdmin } = usePermissionsStore();
  const { staff } = useAuthStore();

  const isAdminRole = staff?.role === 'admin';

  const can = (permKey: string): boolean => {
    if (isAdminRole || isAdmin) return true;
    if (!permissions) return false;
    return permissions[permKey] === 1;
  };

  return { can, isAdminRole, permissions };
}
