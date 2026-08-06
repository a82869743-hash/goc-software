import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffAPI, StaffMember } from '../api/staff';
import { usePermissions } from '../utils/usePermissions';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

type StaffRole = 'admin' | 'manager' | 'salesman' | 'staff';

const ROLE_CFG: Record<StaffRole, { label: string; color: string; bg: string; border: string }> = {
  admin: { label: 'Admin', color: 'text-performance-red', bg: 'bg-performance-red/10', border: 'border-performance-red/25' },
  manager: { label: 'Manager', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  salesman: { label: 'Salesman', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  staff: { label: 'Staff', color: 'text-tertiary', bg: 'bg-white/5', border: 'border-white/10' },
};

const STATUS_CFG: Record<string, { label: string; dot: string; text: string }> = {
  active: { label: 'Active', dot: 'bg-emerald-400 shadow-[0_0_8px_#10B981]', text: 'text-emerald-400 font-bold' },
  on_leave: { label: 'On Leave', dot: 'bg-amber-400 animate-pulse', text: 'text-amber-400' },
  resigned: { label: 'Resigned', dot: 'bg-tertiary/40', text: 'text-tertiary/40' },
  inactive: { label: 'Inactive', dot: 'bg-tertiary/40', text: 'text-tertiary/40' },
};

const AVATAR_COLORS = [
  'from-performance-red/40 to-[#690000]',
  'from-blue-600/40 to-blue-900/60',
  'from-purple-600/40 to-purple-900/60',
  'from-emerald-600/40 to-emerald-900/60',
  'from-amber-600/40 to-amber-900/60',
  'from-pink-600/40 to-pink-900/60',
  'from-indigo-600/40 to-indigo-900/60',
];

export default function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdminRole } = usePermissions();
  const { staff: currentUser, updateProfile } = useAuthStore();
  const isAdmin = isAdminRole;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { data: staffDetailRes, isLoading } = useQuery({
    queryKey: ['staffDetails', id],
    queryFn: () => staffAPI.getById(Number(id)),
    enabled: !!id,
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: (file: File) => staffAPI.uploadProfilePicture(Number(id), file),
    onSuccess: (res) => {
      toast.success('Profile picture updated successfully');
      queryClient.invalidateQueries({ queryKey: ['staffDetails', id] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      // Sync auth store if current user uploaded their own photo
      if (currentUser && currentUser.id === Number(id)) {
        updateProfile({ profile_picture: res.data.profile_picture });
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to upload photo');
    }
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (password: string) => staffAPI.updatePassword(Number(id), password),
    onSuccess: () => {
      toast.success('Staff password reset successfully');
      setShowPasswordReset(false);
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to reset password');
    }
  });

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadPhotoMutation.mutate(file);
    }
    e.target.value = '';
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    resetPasswordMutation.mutate(newPassword);
  };

  const staff = staffDetailRes?.data;

  // Timezone-independent helper to get current IST date string (YYYY-MM-DD)
  const getISTDateString = (): string => {
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istDate = new Date(utcTime + 19800000); // UTC + 5.5 hours
    const yyyy = istDate.getFullYear();
    const mm = String(istDate.getMonth() + 1).padStart(2, '0');
    const dd = String(istDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getTodayCheckInTime = () => {
    if (!staff?.attendance || staff.attendance.length === 0) return 'Not Checked In';
    
    const todayStr = getISTDateString();
    const todayRecord = staff.attendance.find((att: any) => {
      // Clean up both dates to YYYY-MM-DD
      const attDateOnly = att.date ? new Date(att.date).toISOString().split('T')[0] : '';
      return attDateOnly === todayStr || (att.date && att.date.startsWith(todayStr));
    });

    if (!todayRecord) return 'Not Checked In';
    if (todayRecord.status === 'absent') return 'Absent';
    if (todayRecord.status === 'leave') return 'On Approved Leave';
    
    if (todayRecord.check_in_time) {
      try {
        const dt = new Date(todayRecord.check_in_time);
        if (isNaN(dt.getTime())) return todayRecord.check_in_time;
        return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch {
        return todayRecord.check_in_time;
      }
    }
    
    return 'Checked In (No Time Recorded)';
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center text-tertiary/50 italic flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-performance-red border-t-transparent rounded-full animate-spin" />
        Acquiring Personnel Dossier...
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-tertiary/60 italic font-bold">Staff member not found or manifest deleted.</p>
        <button
          onClick={() => navigate('/staff')}
          className="bg-white/5 border border-white/10 hover:bg-white/10 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
        >
          Return to Staff Page
        </button>
      </div>
    );
  }

  const roleCfg = ROLE_CFG[staff.role as StaffRole] || ROLE_CFG.staff;
  const statusCfg = STATUS_CFG[staff.status] || STATUS_CFG.active;
  const idx = staff.id || 0;
  const avatarGrad = AVATAR_COLORS[idx % AVATAR_COLORS.length];
  const todayCheckIn = getTodayCheckInTime();

  return (
    <div className="space-y-8 relative z-10 font-medium pb-10 max-w-6xl mx-auto">
      {/* HEADER WITH BACK BUTTON */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <button
            onClick={() => navigate('/staff')}
            className="flex items-center gap-2 text-tertiary hover:text-white mb-4 transition-all group font-bold text-xs bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] group-hover:-translate-x-0.5 transition-transform">
              arrow_back
            </span>
            Back to Staff Page
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-[2px] bg-performance-red"></div>
            <span className="font-label-caps text-label-caps text-performance-red tracking-[0.3em] uppercase">
              Staff Manifest Record
            </span>
          </div>
          <h1 className="font-display-hero text-headline-lg text-white tracking-tight font-extrabold uppercase">
            {staff.full_name}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 border border-white/5 text-xs uppercase tracking-wider font-bold ${statusCfg.text}`}>
            <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
            {statusCfg.label}
          </div>
        </div>
      </div>

      {/* BENTO GRID DETAILS LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Avatar Card */}
        <div className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-performance-red/[0.02] blur-[50px] pointer-events-none" />
          
          {staff.profile_picture ? (
            <img
              src={(import.meta.env.VITE_API_BASE_URL ? import.meta.env.VITE_API_BASE_URL.replace('/api/v1', '') : 'http://localhost:4000') + staff.profile_picture}
              alt={staff.full_name}
              className="w-28 h-28 rounded-3xl object-cover border border-white/10 shadow-2xl mb-4"
            />
          ) : (
            <div
              className={`w-28 h-28 rounded-3xl bg-gradient-to-br ${avatarGrad} border border-white/10 flex items-center justify-center text-3xl font-extrabold text-white shadow-2xl mb-4`}
            >
              {staff.full_name
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)}
            </div>
          )}

          {isAdmin && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelect}
              />
              <button
                type="button"
                disabled={uploadPhotoMutation.isPending}
                onClick={() => fileInputRef.current?.click()}
                className="mb-4 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-tertiary hover:text-white text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                {uploadPhotoMutation.isPending ? 'Uploading...' : 'Change Photo'}
              </button>
            </>
          )}

          <h2 className="text-xl font-extrabold text-white uppercase tracking-wide">
            {staff.full_name}
          </h2>
          <span className={`inline-flex items-center mt-3 px-3 py-1 rounded-xl ${roleCfg.bg} border ${roleCfg.border} ${roleCfg.color} text-[10px] font-label-caps uppercase tracking-wider`}>
            {roleCfg.label}
          </span>
          <p className="font-data-sm text-xs text-tertiary/40 mt-3 font-bold">
            CODE ID: {staff.staff_code}
          </p>

          {isAdmin && (
            <div className="mt-6 w-full pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowPasswordReset(!showPasswordReset)}
                className="w-full py-2 rounded-xl bg-performance-red/10 border border-performance-red/20 hover:bg-performance-red/20 text-performance-red text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">lock_reset</span>
                {showPasswordReset ? 'Cancel Reset' : 'Reset Password'}
              </button>

              {showPasswordReset && (
                <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-3 text-left animate-fade-in">
                  <div>
                    <label className="text-[9px] font-label-caps text-tertiary/60 block mb-1 uppercase">New Password *</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-performance-red/40"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-label-caps text-tertiary/60 block mb-1 uppercase">Confirm Password *</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-performance-red/40"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={resetPasswordMutation.isPending}
                    className="w-full py-2 bg-gradient-to-r from-performance-red to-[#93000a] text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                  >
                    {resetPasswordMutation.isPending ? 'Updating...' : 'Set New Password'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Middle Column: Details Card */}
        <div className="md:col-span-2 bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6 relative">
          <h3 className="font-label-caps text-xs text-tertiary tracking-wider uppercase flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-performance-red rounded-full" />
            Personnel Telemetry Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            {/* Phone */}
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl">
              <p className="text-[10px] text-tertiary/50 uppercase font-label-caps tracking-wider font-bold">Contact Number</p>
              <p className="font-extrabold text-white mt-1.5 text-sm font-data-sm">{staff.phone}</p>
            </div>

            {/* Email */}
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl">
              <p className="text-[10px] text-tertiary/50 uppercase font-label-caps tracking-wider font-bold">Email Address</p>
              <p className="font-extrabold text-white mt-1.5 text-sm font-body-lg truncate">
                {staff.email || <span className="text-tertiary/20 italic">Not Registered</span>}
              </p>
            </div>

            {/* Salary */}
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl">
              <p className="text-[10px] text-tertiary/50 uppercase font-label-caps tracking-wider font-bold">Compensation Rate</p>
              <p className="font-extrabold text-performance-red mt-1.5 text-sm font-data-lg">
                ₹{Number(staff.salary_amount).toLocaleString('en-IN')}{' '}
                <span className="text-xs text-tertiary/50 capitalize font-normal font-body-lg">
                  ({staff.salary_type})
                </span>
              </p>
            </div>

            {/* Join Date */}
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl">
              <p className="text-[10px] text-tertiary/50 uppercase font-label-caps tracking-wider font-bold">Enlistment Date</p>
              <p className="font-extrabold text-white mt-1.5 text-sm font-data-sm">
                {new Date(staff.join_date).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>

            {/* Today's Entry Time */}
            <div className="sm:col-span-2 bg-gradient-to-r from-performance-red/10 to-transparent border border-performance-red/20 p-5 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] text-performance-red uppercase font-label-caps tracking-widest font-extrabold">
                  Today's Attendance entry
                </p>
                <p className="text-[10px] text-tertiary/60 mt-0.5">Real-time biometric shift entry check-in log</p>
              </div>
              <div className="text-right">
                <p className={`font-extrabold text-base font-data-lg ${todayCheckIn === 'Not Checked In' ? 'text-tertiary/40' : todayCheckIn === 'Absent' ? 'text-performance-red' : 'text-emerald-400'}`}>
                  {todayCheckIn}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RECENT ATTENDANCE LIST (READ-ONLY) */}
      <div className="bg-[#0c0c0c]/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 md:p-8 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-label-caps text-xs text-tertiary tracking-wider uppercase flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-performance-red rounded-full" />
            Recent shift activity (Last 30 Days)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left border-collapse">
            <thead>
              <tr className="bg-black/35 text-tertiary/75 text-[10px] font-label-caps border-b border-white/5 uppercase tracking-widest font-bold">
                <th className="py-4 px-5 font-normal">Shift Date</th>
                <th className="py-4 px-5 font-normal">Status</th>
                <th className="py-4 px-5 font-normal">Check-In</th>
                <th className="py-4 px-5 font-normal">Check-Out</th>
                <th className="py-4 px-5 font-normal">Hours Worked</th>
                <th className="py-4 px-5 font-normal">Biometric Verification / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-data-sm text-xs font-bold">
              {staff.attendance && staff.attendance.length > 0 ? (
                staff.attendance.map((att: any) => (
                  <tr key={att.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="py-3.5 px-5 text-white font-extrabold font-body-lg">
                      {new Date(att.date).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider ${
                        att.status === 'present'
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : att.status === 'late'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : att.status === 'half_day'
                          ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                          : att.status === 'leave'
                          ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                          : 'bg-performance-red/10 text-performance-red border-performance-red/20'
                      }`}>
                        {att.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-white font-data-sm">
                      {att.check_in_time ? new Date(att.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="py-3.5 px-5 text-white font-data-sm">
                      {att.check_out_time ? new Date(att.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="py-3.5 px-5 text-white font-data-sm">
                      {att.working_hours ? `${att.working_hours} hrs` : '—'}
                    </td>
                    <td className="py-3.5 px-5 text-tertiary max-w-xs truncate font-normal">
                      {att.notes || '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-tertiary/40 italic font-body-lg font-bold">
                    No logged shifts found in database history.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
