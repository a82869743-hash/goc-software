import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffManagementAPI } from '../../api/staffManagement';
import { usePermissions } from '../../utils/usePermissions';
import toast from 'react-hot-toast';
import { StaffMember, CreateStaffResponse } from '../../types';

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  admin: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  manager: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  salesman: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  staff: { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' },
};

export default function StaffManagementPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdminRole } = usePermissions();

  // Dialog / Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTargetStaff, setResetTargetStaff] = useState<StaffMember | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState<CreateStaffResponse | null>(null);
  const [resetCredentials, setResetCredentials] = useState<{ new_password: string; name: string } | null>(null);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  // Form States
  const [addForm, setAddForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    role: 'staff',
    salary: '',
    salary_type: 'monthly',
    password: '',
  });

  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    role: 'staff',
    salary: '',
    salary_type: 'monthly',
    status: 'active',
  });

  // Queries
  const { data: staffRes, isLoading } = useQuery({
    queryKey: ['adminStaffList'],
    queryFn: () => staffManagementAPI.listAll(),
    enabled: isAdminRole,
  });

  const staffList = (staffRes?.data?.data || []) as StaffMember[];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: any) => staffManagementAPI.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminStaffList'] });
      setShowAddModal(false);
      setAddForm({
        full_name: '',
        phone: '',
        email: '',
        role: 'staff',
        salary: '',
        salary_type: 'monthly',
        password: '',
      });
      toast.success('Staff member registered successfully! Phone and password saved for login.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to create staff member.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => staffManagementAPI.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminStaffList'] });
      setShowEditModal(false);
      setEditingStaff(null);
      toast.success('Staff details updated!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to update staff.');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password?: string }) => staffManagementAPI.resetPassword(id, { password }),
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to reset password.');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => staffManagementAPI.toggleStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminStaffList'] });
      toast.success('Staff status updated.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to update status.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => staffManagementAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminStaffList'] });
      toast.success('Staff member deleted and logged out successfully.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to delete staff member.');
    },
  });

  // Access check
  if (!isAdminRole) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6 text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
          <span className="material-symbols-outlined text-[32px]">gpp_bad</span>
        </div>
        <h1 className="font-display-hero text-headline-md text-white mb-2 uppercase tracking-wide">
          Access Denied
        </h1>
        <p className="text-tertiary max-w-sm mb-6 text-sm font-medium">
          You do not have the required clearance to access the Staff &amp; Permissions control panel.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-6 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-white transition-all font-label-caps text-xs tracking-wider font-bold uppercase active:scale-95"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // Handlers
  const handleAddSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!addForm.full_name || !addForm.phone || !addForm.role || !addForm.password || !addForm.salary) {
      toast.error('Please fill in all fields (Full Name, Phone Number, Role, Password, Salary).');
      return;
    }
    if (addForm.password.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }
    createMutation.mutate({
      full_name: addForm.full_name,
      phone: addForm.phone,
      role: addForm.role,
      salary: parseFloat(addForm.salary),
      salary_type: addForm.salary_type,
      password: addForm.password,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    updateMutation.mutate({
      id: editingStaff.id,
      payload: {
        full_name: editForm.full_name,
        phone: editForm.phone,
        email: editForm.email || undefined,
        role: editForm.role,
        salary: parseFloat(editForm.salary),
        salary_type: editForm.salary_type,
        status: editForm.status,
      },
    });
  };

  const handleResetPassword = (staff: StaffMember) => {
    setResetTargetStaff(staff);
    setResetPasswordInput('');
    setShowResetModal(true);
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetStaff) return;
    if (resetPasswordInput && resetPasswordInput.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    resetPasswordMutation.mutate({
      id: resetTargetStaff.id,
      password: resetPasswordInput || undefined,
    }, {
      onSuccess: (res) => {
        setShowResetModal(false);
        setResetCredentials({
          new_password: res.data.data.new_password,
          name: resetTargetStaff.full_name,
        });
        toast.success('Password successfully reset.');
      },
    });
  };

  const handleToggleStatus = (staff: StaffMember) => {
    const nextStatus = staff.status === 'active' ? 'inactive' : 'active';
    const ok = window.confirm(`Are you sure you want to mark ${staff.full_name} as ${nextStatus.toUpperCase()}?`);
    if (!ok) return;

    toggleStatusMutation.mutate({ id: staff.id, status: nextStatus });
  };

  const handleDeleteStaff = (staff: StaffMember) => {
    const ok = window.confirm(`Are you sure you want to PERMANENTLY delete ${staff.full_name}? This will immediately log them out of all devices and revoke all system access.`);
    if (!ok) return;

    deleteMutation.mutate(staff.id);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const openEditModal = (staff: StaffMember) => {
    setEditingStaff(staff);
    setEditForm({
      full_name: staff.full_name,
      phone: staff.phone,
      email: staff.email || '',
      role: staff.role,
      salary: String(staff.salary),
      salary_type: staff.salary_type,
      status: staff.status,
    });
    setShowEditModal(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-[2px] bg-performance-red" />
            <span className="font-label-caps text-[10px] tracking-[0.2em] text-performance-red uppercase font-bold">
              Access Control Hub
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase">
            Staff &amp; Permissions
          </h1>
          <p className="text-sm text-tertiary mt-1">
            Register new operators, manage roles, adjust compensation, and toggle granular system access toggles.
          </p>
        </div>

        <button
          onClick={() => {
            setCreatedCredentials(null);
            setShowAddModal(true);
          }}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 tracking-wider uppercase transition-all duration-300 hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          <span>Register New Staff</span>
        </button>
      </div>

      {/* Main Staff Directory List */}
      {isLoading ? (
        <div className="py-20 text-center text-tertiary/50 italic font-bold">
          Acquiring staff manifest data...
        </div>
      ) : (
        <div className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          {/* Table view for desktop / tablet */}
          <div className="hidden md:block overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-black/35 text-tertiary/75 text-[10px] font-label-caps border-b border-white/5 uppercase tracking-widest font-bold">
                  <th className="py-4.5 px-6">Staff Details</th>
                  <th className="py-4.5 px-6">Operator Code</th>
                  <th className="py-4.5 px-6">System Role</th>
                  <th className="py-4.5 px-6">Manifest Status</th>
                  <th className="py-4.5 px-6 text-right">Compensation</th>
                  <th className="py-4.5 px-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-on-surface font-semibold font-data-sm">
                {staffList.map((s) => {
                  const roleCfg = ROLE_COLORS[s.role] || ROLE_COLORS.staff;
                  const isAdmin = s.role === 'admin';
                  return (
                    <tr key={s.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-4 px-6">
                        <p className="text-sm font-extrabold text-white font-body-lg">{s.full_name}</p>
                        <p className="text-[10px] text-tertiary/40 font-bold mt-0.5">{s.phone} {s.email ? `• ${s.email}` : ''}</p>
                      </td>
                      <td className="py-4 px-6 text-white font-extrabold">
                        {s.staff_code}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg ${roleCfg.bg} border ${roleCfg.border} ${roleCfg.text} text-[8px] font-label-caps uppercase tracking-wider`}>
                          {s.role}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${s.status === 'active' ? 'text-emerald-400' : 'text-red-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'active' ? 'bg-emerald-400 shadow-[0_0_6px_#10B981]' : 'bg-red-400'}`} />
                          {s.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right text-white font-bold font-data-lg">
                        ₹{Number(s.salary).toLocaleString('en-IN')} <span className="text-[10px] text-tertiary/60 font-normal">/ {s.salary_type}</span>
                      </td>
                      <td className="py-4 px-6">
                        {isAdmin ? (
                          <div className="flex justify-center">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-950/20 border border-red-500/20 text-[9px] font-label-caps uppercase tracking-wider text-red-400">
                              <span className="material-symbols-outlined text-[14px]">lock</span>
                              Protected Account
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => navigate(`/admin/staff/${s.id}/permissions`)}
                              className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-white hover:border-performance-red/35 hover:text-performance-red flex items-center justify-center transition-colors cursor-pointer"
                              title="Manage Permissions"
                            >
                              <span className="material-symbols-outlined text-[16px]">tune</span>
                            </button>
                            <button
                              onClick={() => handleResetPassword(s)}
                              className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-white hover:border-amber-500/30 hover:text-amber-400 flex items-center justify-center transition-colors cursor-pointer"
                              title="Reset Password"
                            >
                              <span className="material-symbols-outlined text-[16px]">lock_reset</span>
                            </button>
                            <button
                              onClick={() => openEditModal(s)}
                              className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-white hover:border-blue-500/30 hover:text-blue-400 flex items-center justify-center transition-colors cursor-pointer"
                              title="Edit Staff"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                            </button>
                            <button
                              onClick={() => handleToggleStatus(s)}
                              className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                                s.status === 'active'
                                  ? 'bg-red-500/10 border-red-500/10 text-red-400 hover:bg-red-500 hover:text-white'
                                  : 'bg-emerald-500/10 border-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white'
                              }`}
                              title={s.status === 'active' ? 'Deactivate Operator' : 'Activate Operator'}
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                {s.status === 'active' ? 'block' : 'check'}
                              </span>
                            </button>
                            <button
                              onClick={() => handleDeleteStaff(s)}
                              className="w-8 h-8 rounded-lg bg-red-950/20 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                              title="Delete Staff"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Card view for mobile layouts */}
          <div className="md:hidden divide-y divide-white/5">
            {staffList.map((s) => {
              const roleCfg = ROLE_COLORS[s.role] || ROLE_COLORS.staff;
              const isAdmin = s.role === 'admin';
              return (
                <div key={s.id} className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-extrabold text-white font-body-lg">{s.full_name}</p>
                      <p className="text-[10px] text-tertiary/50 mt-0.5">{s.phone} {s.email ? `• ${s.email}` : ''}</p>
                      <p className="text-[10px] text-tertiary/40 font-bold mt-1">Code: {s.staff_code}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg ${roleCfg.bg} border ${roleCfg.border} ${roleCfg.text} text-[8px] font-label-caps uppercase tracking-wider`}>
                        {s.role}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase ${s.status === 'active' ? 'text-emerald-400' : 'text-red-400'}`}>
                        <span className={`w-1 h-1 rounded-full ${s.status === 'active' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        {s.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-white/5">
                    <div>
                      <p className="text-[9px] text-tertiary/40 uppercase font-label-caps">Compensation</p>
                      <p className="text-xs font-bold text-white font-data-md mt-0.5">
                        ₹{Number(s.salary).toLocaleString('en-IN')} <span className="text-[9px] text-tertiary/60">/ {s.salary_type}</span>
                      </p>
                    </div>

                    <div>
                      {isAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-950/20 border border-red-500/20 text-[8px] font-label-caps uppercase tracking-wider text-red-400">
                          <span className="material-symbols-outlined text-[12px]">lock</span>
                          Protected
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => navigate(`/admin/staff/${s.id}/permissions`)}
                            className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-white flex items-center justify-center cursor-pointer"
                            title="Manage Permissions"
                          >
                            <span className="material-symbols-outlined text-[15px]">tune</span>
                          </button>
                          <button
                            onClick={() => handleResetPassword(s)}
                            className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-white flex items-center justify-center cursor-pointer"
                            title="Reset Password"
                          >
                            <span className="material-symbols-outlined text-[15px]">lock_reset</span>
                          </button>
                          <button
                            onClick={() => openEditModal(s)}
                            className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-white flex items-center justify-center cursor-pointer"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined text-[15px]">edit</span>
                          </button>
                          <button
                             onClick={() => handleToggleStatus(s)}
                             className={`w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer ${
                               s.status === 'active'
                                 ? 'bg-red-500/10 border-red-500/10 text-red-400'
                                 : 'bg-emerald-500/10 border-emerald-500/10 text-emerald-400'
                             }`}
                             title={s.status === 'active' ? 'Deactivate' : 'Activate'}
                           >
                             <span className="material-symbols-outlined text-[15px]">
                               {s.status === 'active' ? 'block' : 'check'}
                             </span>
                           </button>
                           <button
                             onClick={() => handleDeleteStaff(s)}
                             className="w-8 h-8 rounded-lg bg-red-950/20 border border-red-500/20 text-red-400 flex items-center justify-center cursor-pointer"
                             title="Delete"
                           >
                             <span className="material-symbols-outlined text-[15px]">delete</span>
                           </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* REGISTRATION MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-void-black border border-white/10 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 relative transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-green-500/50 to-transparent" />
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-bold text-white uppercase tracking-wider">Register Operator</h3>
                <p className="text-xs text-tertiary">Create new staff account login credentials</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-tertiary hover:text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-tertiary font-label-caps">Full Name *</label>
                <input
                  type="text"
                  readOnly
                  onFocus={(e) => e.target.removeAttribute('readonly')}
                  autoComplete="off"
                  className="w-full bg-white/5 border border-white/5 focus:border-green-500/50 rounded-xl p-3 text-xs text-white placeholder-tertiary/30 focus:outline-none focus:ring-0 font-bold"
                  placeholder="Enter staff full name"
                  value={addForm.full_name}
                  onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-tertiary font-label-caps">Phone Number (Login ID) *</label>
                  <input
                    type="text"
                    maxLength={10}
                    readOnly
                    onFocus={(e) => e.target.removeAttribute('readonly')}
                    autoComplete="off"
                    className="w-full bg-white/5 border border-white/5 focus:border-green-500/50 rounded-xl p-3 text-xs text-white placeholder-tertiary/30 focus:outline-none focus:ring-0 font-bold font-mono"
                    placeholder="10 digit phone number"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value.replace(/\D/g, '') })}
                  />
                </div>
 
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-tertiary font-label-caps">System Role *</label>
                  <select
                    className="w-full bg-[#0c0c0c] border border-white/5 focus:border-green-500/50 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-0 font-bold"
                    value={addForm.role}
                    onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="salesman">Salesman</option>
                    <option value="staff">General Staff</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-tertiary font-label-caps">Login Password *</label>
                <input
                  type="text"
                  readOnly
                  onFocus={(e) => e.target.removeAttribute('readonly')}
                  style={{ WebkitTextSecurity: 'disc' } as any}
                  autoComplete="off"
                  className="w-full bg-white/5 border border-white/5 focus:border-green-500/50 rounded-xl p-3 text-xs text-white placeholder-tertiary/30 focus:outline-none focus:ring-0 font-bold"
                  placeholder="Set password for staff login (min 6 chars)"
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-tertiary font-label-caps">Salary Cycle *</label>
                  <select
                    className="w-full bg-[#0c0c0c] border border-white/5 focus:border-green-500/50 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-0 font-bold"
                    value={addForm.salary_type}
                    onChange={(e) => setAddForm({ ...addForm, salary_type: e.target.value })}
                  >
                    <option value="monthly">Monthly Cycle</option>
                    <option value="daily">Daily Wage</option>
                  </select>
                </div>
 
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-tertiary font-label-caps font-mono">Salary Amount (INR) *</label>
                  <input
                    type="number"
                    min={0}
                    readOnly
                    onFocus={(e) => e.target.removeAttribute('readonly')}
                    className="w-full bg-white/5 border border-white/5 focus:border-green-500/50 rounded-xl p-3 text-xs text-white placeholder-tertiary/30 focus:outline-none focus:ring-0 font-bold"
                    placeholder="18000"
                    value={addForm.salary}
                    onChange={(e) => setAddForm({ ...addForm, salary: e.target.value })}
                  />
                </div>
              </div>

              <button
                onClick={() => handleAddSubmit()}
                disabled={createMutation.isPending}
                className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 disabled:opacity-50 mt-4 cursor-pointer"
              >
                {createMutation.isPending ? 'Registering Staff...' : 'Register Operator'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && editingStaff && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-void-black border border-white/10 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 relative transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-bold text-white uppercase tracking-wider">Edit Operator Details</h3>
                <p className="text-xs text-tertiary">Modify staff properties for: {editingStaff.staff_code}</p>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingStaff(null);
                }}
                className="text-tertiary hover:text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-tertiary font-label-caps">Full Name *</label>
                <input
                  type="text"
                  className="w-full bg-white/5 border border-white/5 focus:border-blue-500/50 rounded-xl p-3 text-xs text-white placeholder-tertiary/30 focus:outline-none focus:ring-0 font-bold"
                  placeholder="Enter full name"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-tertiary font-label-caps">Phone (10 digits) *</label>
                  <input
                    type="text"
                    maxLength={10}
                    className="w-full bg-white/5 border border-white/5 focus:border-blue-500/50 rounded-xl p-3 text-xs text-white placeholder-tertiary/30 focus:outline-none focus:ring-0 font-bold font-mono"
                    placeholder="9998887770"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value.replace(/\D/g, '') })}
                  />
                </div>
 
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-tertiary font-label-caps">System Role *</label>
                  <select
                    className="w-full bg-[#0c0c0c] border border-white/5 focus:border-blue-500/50 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-0 font-bold"
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="salesman">Salesman</option>
                    <option value="staff">General Staff</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-tertiary font-label-caps">Salary Cycle *</label>
                  <select
                    className="w-full bg-[#0c0c0c] border border-white/5 focus:border-blue-500/50 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-0 font-bold"
                    value={editForm.salary_type}
                    onChange={(e) => setEditForm({ ...editForm, salary_type: e.target.value })}
                  >
                    <option value="monthly">Monthly Cycle</option>
                    <option value="daily">Daily Wage</option>
                  </select>
                </div>
 
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-tertiary font-label-caps">Amount (INR) *</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full bg-white/5 border border-white/5 focus:border-blue-500/50 rounded-xl p-3 text-xs text-white placeholder-tertiary/30 focus:outline-none focus:ring-0 font-bold"
                    placeholder="18000"
                    value={editForm.salary}
                    onChange={(e) => setEditForm({ ...editForm, salary: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-tertiary font-label-caps">Status *</label>
                <select
                  className="w-full bg-[#0c0c0c] border border-white/5 focus:border-blue-500/50 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-0 font-bold"
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <button
                onClick={() => handleEditSubmit({ preventDefault: () => {} } as any)}
                disabled={updateMutation.isPending}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 disabled:opacity-50 mt-4 cursor-pointer"
              >
                {updateMutation.isPending ? 'Updating record...' : 'Save Operations Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM PASSWORD RESET MODAL */}
      {showResetModal && resetTargetStaff && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-void-black border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-bold text-white uppercase tracking-wider">Reset Operator Password</h3>
                <p className="text-xs text-tertiary">Configure new password credentials for {resetTargetStaff.full_name}</p>
              </div>
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setResetTargetStaff(null);
                }}
                className="text-tertiary hover:text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase font-bold text-tertiary font-label-caps">New Password (Optional)</label>
                  <span className="text-[9px] text-tertiary/60">Leave blank to auto-generate</span>
                </div>
                <input
                  type="password"
                  className="w-full bg-white/5 border border-white/5 focus:border-amber-500/50 rounded-xl p-3 text-xs text-white placeholder-tertiary/30 focus:outline-none focus:ring-0 font-bold"
                  placeholder="Set custom password (min 6 chars)"
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setResetTargetStaff(null);
                  }}
                  className="flex-1 py-3 border border-white/10 hover:bg-white/5 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetPasswordMutation.isPending}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
                >
                  {resetPasswordMutation.isPending ? 'Resetting...' : 'Confirm Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PASSWORD RESET CONFIRMATION DIALOG / MODAL */}
      {resetCredentials && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-void-black border border-white/10 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 relative text-center">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
            
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 text-amber-500">
              <span className="material-symbols-outlined text-[24px]">vpn_key</span>
            </div>

            <h3 className="text-base font-bold text-white uppercase tracking-wider mb-1">
              Security Key Reset
            </h3>
            <p className="text-xs text-tertiary mb-6">
              New password generated successfully for <strong className="text-white">{resetCredentials.name}</strong>
            </p>

            <div className="space-y-4 mb-6">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex justify-between items-center font-mono text-lg text-amber-400 font-bold">
                <span>{resetCredentials.new_password}</span>
                <button
                  onClick={() => handleCopy(resetCredentials.new_password)}
                  className="text-amber-400 hover:text-white transition-colors cursor-pointer"
                  title="Copy password"
                >
                  <span className="material-symbols-outlined text-[20px]">content_copy</span>
                </button>
              </div>

              <div className="bg-white/5 rounded-xl p-3 flex items-start gap-2.5 text-left border border-white/5">
                <span className="material-symbols-outlined text-amber-400 text-xs mt-0.5">info</span>
                <p className="text-[10px] text-tertiary/60 leading-normal font-bold">
                  Ensure you share these credentials immediately. For security integrity, this key cannot be retrieved once dismissed.
                </p>
              </div>
            </div>

            <button
              onClick={() => setResetCredentials(null)}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Close &amp; Complete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
