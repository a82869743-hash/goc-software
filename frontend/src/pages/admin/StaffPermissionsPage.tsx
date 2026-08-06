import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffManagementAPI } from '../../api/staffManagement';
import { staffAPI } from '../../api/staff';
import { usePermissions } from '../../utils/usePermissions';
import toast from 'react-hot-toast';

interface PermissionDefinition {
  label: string;
  permKey: string;
  description: string;
}

interface PermissionGroup {
  title: string;
  keys: string[];
  items: PermissionDefinition[];
}

const GROUPS: PermissionGroup[] = [
  {
    title: 'Core Module Access',
    keys: [
      'perm_dashboard', 'perm_leads', 'perm_customers', 'perm_bookings', 'perm_advance_bookings',
      'perm_job_cards', 'perm_quick_jobs', 'perm_quotations', 'perm_invoices', 'perm_payments',
      'perm_inventory', 'perm_reports', 'perm_marketing', 'perm_commissions', 'perm_settings',
      'perm_staff_management'
    ],
    items: [
      { label: 'Dashboard', permKey: 'perm_dashboard', description: 'View studio KPIs, real-time telemetry, and charts.' },
      { label: 'Leads', permKey: 'perm_leads', description: 'Access lead management and CRM sales pipeline.' },
      { label: 'Customers', permKey: 'perm_customers', description: 'View and manage customer base profiles.' },
      { label: 'Bookings', permKey: 'perm_bookings', description: 'Access calendar bookings scheduling.' },
      { label: 'Advance Bookings', permKey: 'perm_advance_bookings', description: 'Manage advance bookings schedule.' },
      { label: 'Job Cards', permKey: 'perm_job_cards', description: 'Access full detailing job card management.' },
      { label: 'Quick Jobs', permKey: 'perm_quick_jobs', description: 'Access quick service, washing, and detailing logs.' },
      { label: 'Quotations', permKey: 'perm_quotations', description: 'Create and manage whiteboard canvas quotes.' },
      { label: 'Invoices', permKey: 'perm_invoices', description: 'View generated invoices and bills.' },
      { label: 'Payments', permKey: 'perm_payments', description: 'View payments transaction logs.' },
      { label: 'Inventory', permKey: 'perm_inventory', description: 'Access inventory lists, materials, and rolls.' },
      { label: 'Reports', permKey: 'perm_reports', description: 'View high level analytics and performance reports.' },
      { label: 'Marketing', permKey: 'perm_marketing', description: 'Access campaign senders, custom segments.' },
      { label: 'Commissions', permKey: 'perm_commissions', description: 'View referrals and connector commissions.' },
      { label: 'Settings', permKey: 'perm_settings', description: 'Access application properties settings.' },
      { label: 'Staff & Permissions', permKey: 'perm_staff_management', description: 'Access staff catalog and toggle controls.' }
    ]
  },
  {
    title: 'Job Card Actions',
    keys: ['perm_job_cards_edit', 'perm_job_cards_delete', 'perm_job_cards_complete'],
    items: [
      { label: 'Edit Job Cards', permKey: 'perm_job_cards_edit', description: 'Allows modification of service logs, rates, HSN codes.' },
      { label: 'Delete Job Cards', permKey: 'perm_job_cards_delete', description: 'Permission to permanently remove job card logs.' },
      { label: 'Complete / Invoice Job', permKey: 'perm_job_cards_complete', description: 'Permission to close job cards and dispatch invoices.' }
    ]
  },
  {
    title: 'Financial Controls',
    keys: ['perm_invoices_create', 'perm_payments_record'],
    items: [
      { label: 'Create Invoices', permKey: 'perm_invoices_create', description: 'Generate fresh bills of supply, tax invoices.' },
      { label: 'Record Payments', permKey: 'perm_payments_record', description: 'Log incoming UPI, cash, bank transactions.' }
    ]
  },
  {
    title: 'Lead Controls',
    keys: ['perm_leads_delete', 'perm_leads_assign'],
    items: [
      { label: 'Delete Leads', permKey: 'perm_leads_delete', description: 'Allows removing cold/invalid leads from pipeline.' },
      { label: 'Assign Leads', permKey: 'perm_leads_assign', description: 'Reassign leads to other operations personnel.' }
    ]
  },
  {
    title: 'Data Controls',
    keys: ['perm_customers_delete', 'perm_inventory_edit'],
    items: [
      { label: 'Delete Customers', permKey: 'perm_customers_delete', description: 'Delete profile records from CRM.' },
      { label: 'Edit Inventory', permKey: 'perm_inventory_edit', description: 'Modify material codes, adjust stock counts, add rolls.' }
    ]
  },
  {
    title: 'Report Access',
    keys: ['perm_reports_revenue', 'perm_reports_accounts', 'perm_reports_salary'],
    items: [
      { label: 'Revenue Reports', permKey: 'perm_reports_revenue', description: 'View net/gross revenue charts and metrics.' },
      { label: 'Accounts / Cash Flow', permKey: 'perm_reports_accounts', description: 'View cash drawer ledgers, balances.' },
      { label: 'Salary Reports', permKey: 'perm_reports_salary', description: 'View staff wage metrics and advances logs.' }
    ]
  }
];

export default function StaffPermissionsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdminRole } = usePermissions();

  const [localPerms, setLocalPerms] = useState<Record<string, number>>({});

  // Queries
  const { data: staffRes, isLoading: isStaffLoading } = useQuery({
    queryKey: ['adminStaffDetail', id],
    queryFn: () => staffAPI.getById(Number(id)),
    enabled: !!id && isAdminRole,
  });

  const { data: permsRes, isLoading: isPermsLoading } = useQuery({
    queryKey: ['adminStaffPermissions', id],
    queryFn: () => staffManagementAPI.getPermissions(Number(id)),
    enabled: !!id && isAdminRole,
  });

  const staff = staffRes?.data;
  const dbPerms = permsRes?.data?.data;

  // Initialize permissions
  useEffect(() => {
    if (dbPerms) {
      setLocalPerms(dbPerms);
    }
  }, [dbPerms]);

  // Mutation
  const saveMutation = useMutation({
    mutationFn: (payload: any) => staffManagementAPI.updatePermissions(Number(id), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminStaffPermissions', id] });
      toast.success('Permissions successfully updated!');
      navigate('/admin/staff');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to update permissions.');
    },
  });

  // Access check
  if (!isAdminRole) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6 text-red-500">
          <span className="material-symbols-outlined text-[32px]">gpp_bad</span>
        </div>
        <h1 className="font-display-hero text-headline-md text-white mb-2 uppercase tracking-wide">
          Access Denied
        </h1>
        <p className="text-tertiary max-w-sm mb-6 text-sm font-bold">
          Permissions configuration can only be performed by administrators.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-6 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-white transition-all font-label-caps text-xs font-bold uppercase tracking-wider active:scale-95"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const handleToggle = (key: string, checked: boolean) => {
    setLocalPerms(prev => ({
      ...prev,
      [key]: checked ? 1 : 0
    }));
  };

  const handleSelectGroup = (keys: string[], state: number) => {
    setLocalPerms(prev => {
      const next = { ...prev };
      keys.forEach(k => {
        next[k] = state;
      });
      return next;
    });
  };

  const handleSave = () => {
    saveMutation.mutate(localPerms);
  };

  if (isStaffLoading || isPermsLoading) {
    return (
      <div className="py-20 text-center text-tertiary/50 italic font-bold">
        Acquiring system access configuration data...
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="p-6 text-center text-red-400 font-bold">
        Error: Staff member not found in catalog.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <button
            onClick={() => navigate('/admin/staff')}
            className="flex items-center gap-2 text-tertiary hover:text-white transition-colors mb-3 font-label-caps text-[10px] tracking-wider font-bold uppercase cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Directory
          </button>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase">
            Permissions for {staff.full_name}
          </h1>
          <p className="text-xs text-tertiary mt-1 font-medium font-data-sm">
            Role: <strong className="text-white uppercase">{staff.role}</strong> • Code: <strong className="text-white font-bold">{staff.staff_code}</strong>
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 tracking-wider uppercase transition-all duration-300 hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] disabled:opacity-50 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">save</span>
          <span>{saveMutation.isPending ? 'Saving...' : 'Save Permissions'}</span>
        </button>
      </div>

      {/* Grid of groups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
        {GROUPS.map((group) => (
          <div
            key={group.title}
            className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-5 shadow-2xl flex flex-col h-full"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                {group.title}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSelectGroup(group.keys, 1)}
                  className="text-[9px] font-label-caps uppercase text-emerald-400 hover:text-white transition-colors font-bold tracking-wider cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-white/10 text-xs">|</span>
                <button
                  onClick={() => handleSelectGroup(group.keys, 0)}
                  className="text-[9px] font-label-caps uppercase text-performance-red hover:text-white transition-colors font-bold tracking-wider cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="space-y-3 flex-1">
              {group.items.map((item) => (
                <PermissionToggle
                  key={item.permKey}
                  label={item.label}
                  description={item.description}
                  checked={localPerms[item.permKey] === 1}
                  onChange={(val) => handleToggle(item.permKey, val)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PermissionToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}

function PermissionToggle({ label, description, checked, onChange }: PermissionToggleProps) {
  return (
    <div className="flex items-center justify-between p-3.5 bg-white/[0.01] border border-white/5 rounded-xl hover:border-white/10 transition-colors">
      <div className="flex-1 pr-4">
        <p className="text-xs font-bold text-white font-body-lg">{label}</p>
        {description && (
          <p className="text-[10px] text-tertiary/50 mt-0.5 leading-relaxed font-medium">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-300 relative focus:outline-none cursor-pointer shrink-0 ${
          checked ? 'bg-green-600' : 'bg-gray-800'
        }`}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white shadow-md transform duration-300 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
