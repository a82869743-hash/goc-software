import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { bookingsAPI, Booking } from '../api/bookings';
import { jobsAPI } from '../api/jobs';
import toast from 'react-hot-toast';

type BookingStatus = 'scheduled' | 'cancelled' | 'converted';

const STATUS_CFG: Record<BookingStatus, { label: string; color: string; bg: string; border: string }> = {
  scheduled: { label: 'Scheduled', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  cancelled: { label: 'Cancelled', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  converted: { label: 'Converted', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
};

export default function BookingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [filter, setFilter] = useState<'all' | BookingStatus>('all');
  const [search, setSearch] = useState('');
  
  // Selected date for calendar view (defaults to today's date in local YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const local = new Date();
    const offset = local.getTimezoneOffset();
    const adjusted = new Date(local.getTime() - offset * 60 * 1000);
    return adjusted.toISOString().split('T')[0];
  });

  // Action states
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newSlot, setNewSlot] = useState('');

  // Check-In Wizard Modal States
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [insuranceCompany, setInsuranceCompany] = useState('');
  const [insuranceExpiry, setInsuranceExpiry] = useState('');
  const [selectedConcerns, setSelectedConcerns] = useState<string[]>([]);
  const [customConcern, setCustomConcern] = useState('');

  // Main Bookings Query
  const { data: bookingsRes, isLoading } = useQuery({
    queryKey: ['bookings', search, filter],
    queryFn: () =>
      bookingsAPI.list({
        search: search || undefined,
        status: filter === 'all' ? undefined : filter,
      }),
  });

  const bookings = (bookingsRes?.data || []) as Booking[];
  const upcoming = bookings.filter((b) => b.status === 'scheduled').length;

  // Slots availability query for Rescheduling
  const { data: slotsRes, isLoading: isSlotsLoading } = useQuery({
    queryKey: ['bookingSlots', newDate],
    queryFn: () => bookingsAPI.slots(newDate),
    enabled: showRescheduleModal && !!newDate,
  });

  const availableSlots = slotsRes?.data || [];

  // Query concern presets
  const { data: presetsRes } = useQuery({
    queryKey: ['concernPresets'],
    queryFn: () => jobsAPI.concernPresets(),
    enabled: showCheckInModal,
  });

  const presets = presetsRes?.data || [];

  // Convert to Job Card Mutation
  const convertMutation = useMutation({
    mutationFn: ({ id, insurance_company, insurance_expiry, concerns }: { id: number; insurance_company?: string; insurance_expiry?: string; concerns?: string[] }) =>
      bookingsAPI.convertToJob(id, { insurance_company, insurance_expiry, concerns }),
    onSuccess: () => {
      toast.success('Converted to Active Job Card successfully!');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setSelectedBooking(null);
      setShowCheckInModal(false);
      navigate('/jobs');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to convert to Job Card');
    },
  });

  // Reschedule Mutation
  const rescheduleMutation = useMutation({
    mutationFn: ({ id, date, slot }: { id: number; date: string; slot: string }) =>
      bookingsAPI.reschedule(id, { booking_date: date, time_slot: slot }),
    onSuccess: () => {
      toast.success('Booking rescheduled successfully!');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setShowRescheduleModal(false);
      setSelectedBooking(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to reschedule booking');
    },
  });

  // Cancel Mutation
  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      bookingsAPI.cancel(id, { cancel_reason: reason }),
    onSuccess: () => {
      toast.success('Booking cancelled successfully');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setShowCancelModal(false);
      setCancelReason('');
      setSelectedBooking(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to cancel booking');
    },
  });

  const handleConvert = (b: Booking) => {
    setSelectedBooking(b);
    setInsuranceCompany('');
    setInsuranceExpiry('');
    setSelectedConcerns([]);
    setCustomConcern('');
    setShowCheckInModal(true);
  };

  const handleOpenReschedule = (b: Booking) => {
    setSelectedBooking(b);
    setNewDate(b.booking_date);
    setNewSlot(b.time_slot);
    setShowRescheduleModal(true);
  };

  const handleOpenCancel = (b: Booking) => {
    setSelectedBooking(b);
    setCancelReason('');
    setShowCancelModal(true);
  };

  // Mini calendar generator helper
  const getDaysInMonth = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const date = new Date(year, month, 1);
    const days = [];
    
    // Pad front matching start of week (Sunday start)
    const firstDayIndex = date.getDay();
    for (let i = firstDayIndex; i > 0; i--) {
      const prevDate = new Date(year, month, 1 - i);
      days.push({ day: prevDate, currentMonth: false });
    }

    while (date.getMonth() === month) {
      days.push({ day: new Date(date), currentMonth: true });
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  // Weekly load calculator
  const getWeeklyLoad = () => {
    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 1)); // Mon
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const count = bookings.filter((b) => b.booking_date === dateStr && b.status !== 'cancelled').length;
      days.push({ dayName: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i], count });
    }
    return days;
  };

  const weeklyLoad = getWeeklyLoad();
  const maxLoad = Math.max(...weeklyLoad.map((w) => w.count), 1);

  // Dynamic slot booking filters
  const selectedDateBookings = bookings.filter(
    (b) => b.booking_date === selectedDate && b.status !== 'cancelled'
  );

  const getSlotBooking = (slot: string) => {
    return selectedDateBookings.find((b) => b.time_slot === slot) || null;
  };

  return (
    <div className="space-y-8 relative">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h2 className="font-display-hero text-headline-lg text-white mb-2 tracking-tight">Schedule Management</h2>
          <p className="font-label-caps text-label-caps text-on-surface-variant/80 tracking-widest uppercase">
            <span className="text-white font-mono">{upcoming}</span> active bookings ·{' '}
            <span className="text-green-400 font-mono">
              {bookings.filter((b) => b.status === 'scheduled').length}
            </span>{' '}
            scheduled
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 bg-white/5 border border-white/5 rounded-xl">
            {(['calendar', 'list'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-2 rounded-lg text-xs font-label-caps uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  view === v ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {v === 'calendar' ? 'calendar_month' : 'view_list'}
                </span>
                {v}
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate(`/bookings/new?date=${selectedDate}`)}
            className="performance-gradient text-white font-label-caps text-label-caps px-6 py-3.5 rounded-xl flex items-center justify-center gap-2 hover:shadow-[0_0_25px_rgba(255,43,43,0.35)] active:scale-[0.97] transition-all uppercase tracking-widest border border-white/10"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            NEW BOOKING
          </button>
        </div>
      </div>

      {view === 'calendar' ? (
        // ═════════════════════════════════════════════════════════════
        // CALENDAR / BAYS TIMING VIEW
        // ═════════════════════════════════════════════════════════════
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Calendar Widget + Weekly Load */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* Monthly Calendar */}
            <div className="obsidian-panel rounded-2xl p-6 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-label-caps text-label-caps text-performance-red flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-performance-red shadow-[0_0_8px_#FF2B2B]"></span>
                  {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}
                </h3>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center font-label-caps text-[9px] text-on-surface-variant/40 mb-3 tracking-widest">
                <span>SUN</span>
                <span>MON</span>
                <span>TUE</span>
                <span>WED</span>
                <span>THU</span>
                <span>FRI</span>
                <span>SAT</span>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {getDaysInMonth().map(({ day, currentMonth }, idx) => {
                  const dateStr = day.toISOString().split('T')[0];
                  const dayBookings = bookings.filter(
                    (b) => b.booking_date === dateStr && b.status !== 'cancelled'
                  );
                  const count = dayBookings.length;
                  const isSelected = selectedDate === dateStr;
                  const isToday = day.toDateString() === new Date().toDateString();

                  return (
                    <div
                      key={idx}
                      onClick={() => currentMonth && setSelectedDate(dateStr)}
                      className={`aspect-square flex flex-col items-center justify-center rounded-lg relative transition-all duration-200 ${
                        !currentMonth
                          ? 'text-on-surface-variant/10 cursor-default'
                          : isSelected
                          ? 'bg-performance-red text-white font-bold glow-red shadow-lg border border-white/20 cursor-pointer'
                          : isToday
                          ? 'bg-white/5 text-performance-red font-bold border border-performance-red/20 cursor-pointer'
                          : 'text-on-surface-variant hover:bg-white/5 cursor-pointer'
                      }`}
                    >
                      <span className="font-data-sm text-xs">{day.getDate()}</span>
                      {currentMonth && count > 0 && !isSelected && (
                        <span className="absolute bottom-1 w-1 h-1 rounded-full bg-performance-red/80"></span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Weekly Load */}
            <div className="obsidian-panel rounded-2xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">WEEKLY LOAD</h3>
                <span className="font-data-sm text-performance-red text-xs">Induction Volume</span>
              </div>
              <div className="flex items-end gap-3 h-28 px-2 justify-between">
                {weeklyLoad.map((w, idx) => {
                  const heightPercent = Math.max(10, Math.round((w.count / maxLoad) * 100));
                  return (
                    <div key={idx} className="flex-1 bg-white/5 rounded-t-md relative group h-full">
                      <div
                        className={`absolute bottom-0 w-full rounded-t-md transition-all duration-500 cursor-pointer ${
                          w.count > 0
                            ? 'bg-performance-red glow-red shadow-[0_0_12px_rgba(255,43,43,0.3)] hover:brightness-110'
                            : 'bg-white/10'
                        }`}
                        style={{ height: `${heightPercent}%` }}
                        title={`${w.count} Bookings`}
                      ></div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-3 font-data-sm text-[9px] text-on-surface-variant/50 px-2 tracking-widest uppercase">
                {weeklyLoad.map((w, idx) => (
                  <span key={idx}>{w.dayName}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Bay Slots Grid */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="flex justify-between items-end border-b border-white/5 pb-4 mb-2">
              <div>
                <h2 className="font-display-hero text-2xl text-white tracking-tight">
                  {new Date(selectedDate).toLocaleDateString('en-IN', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'short',
                  })}
                </h2>
                <p className="font-body-lg text-on-surface-variant/60 text-xs">
                  {selectedDateBookings.length} active service bay allocations scheduled
                </p>
              </div>
            </div>

            {/* Bays Slots Container */}
            <div className="space-y-6 max-h-[640px] overflow-y-auto pr-2 custom-scrollbar">
              {/* DETAILING BAY ALPHA */}
              <div className="obsidian-panel rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-label-caps text-label-caps text-on-surface flex items-center gap-2 tracking-wider">
                    <span className="material-symbols-outlined text-performance-red text-[20px]">local_car_wash</span>
                    DETAILING BAY ALPHA
                  </h3>
                  <span className="px-2.5 py-0.5 bg-green-500/10 text-green-400 font-label-caps text-[9px] rounded border border-green-500/20">
                    OPERATIONAL
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Slot 1: 09:00 */}
                  {(() => {
                    const b = getSlotBooking('09:00');
                    if (b) {
                      const cfg = STATUS_CFG[b.status as BookingStatus] || STATUS_CFG.scheduled;
                      return (
                        <div className="bg-void-black/80 border border-white/5 rounded-xl p-5 relative overflow-hidden group">
                          <div className="absolute top-0 left-0 w-1 h-full bg-performance-red/60"></div>
                          <div className="flex justify-between items-start mb-3">
                            <span className="font-data-lg text-data-lg text-white">09:00 - 11:00</span>
                            <span className={`font-label-caps text-[8px] px-2 py-0.5 rounded border uppercase tracking-wider ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </div>
                          <p className="font-headline-md text-sm text-white truncate">{b.service_type}</p>
                          <p className="font-data-sm text-[11px] text-on-surface-variant/60 mt-1">
                            {b.vehicle_name || 'Asset'} <span className="text-white/20 mx-1">|</span> {b.customer_name}
                          </p>
                          <div className="absolute inset-0 bg-[#050505]/95 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3">
                            {b.status === 'scheduled' && (
                              <button
                                onClick={() => handleConvert(b)}
                                className="performance-gradient text-white px-4 py-2 rounded-lg font-label-caps text-[9px] tracking-widest border border-white/10 uppercase"
                              >
                                CHECK IN
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenReschedule(b)}
                              className="w-9 h-9 rounded bg-white/5 border border-white/10 text-yellow-400 hover:bg-yellow-400 hover:text-black flex items-center justify-center transition-all"
                            >
                              <span className="material-symbols-outlined text-[18px]">schedule</span>
                            </button>
                            <button
                              onClick={() => handleOpenCancel(b)}
                              className="w-9 h-9 rounded bg-white/5 border border-white/10 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all"
                            >
                              <span className="material-symbols-outlined text-[18px]">block</span>
                            </button>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div
                          onClick={() => navigate(`/bookings/new?date=${selectedDate}&slot=09:00&bay=ALPHA`)}
                          className="bg-performance-red/[0.01] border border-performance-red/10 rounded-xl p-5 relative cursor-pointer hover:bg-performance-red/[0.04] hover:border-performance-red/30 transition-all group"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <span className="font-data-lg text-data-lg text-performance-red/70 group-hover:text-performance-red transition-colors">09:00 - 11:00</span>
                            <span className="font-label-caps text-[8px] px-2 py-0.5 bg-performance-red/10 text-performance-red rounded flex items-center gap-1 tracking-widest font-bold">
                              <span className="material-symbols-outlined text-[10px] animate-pulse">bolt</span> AVAILABLE
                            </span>
                          </div>
                          <div className="h-10 flex items-center justify-center border border-dashed border-performance-red/20 rounded-lg group-hover:border-performance-red/40 transition-all bg-void-black/20">
                            <span className="font-label-caps text-[9px] text-performance-red/60 tracking-widest group-hover:scale-105 transition-transform uppercase font-bold">
                              CLICK TO RESERVE
                            </span>
                          </div>
                        </div>
                      );
                    }
                  })()}

                  {/* Slot 2: 14:00 */}
                  {(() => {
                    const b = getSlotBooking('14:00');
                    if (b) {
                      const cfg = STATUS_CFG[b.status as BookingStatus] || STATUS_CFG.scheduled;
                      return (
                        <div className="bg-void-black/80 border border-white/5 rounded-xl p-5 relative overflow-hidden group">
                          <div className="absolute top-0 left-0 w-1 h-full bg-performance-red/60"></div>
                          <div className="flex justify-between items-start mb-3">
                            <span className="font-data-lg text-data-lg text-white">14:00 - 16:00</span>
                            <span className={`font-label-caps text-[8px] px-2 py-0.5 rounded border uppercase tracking-wider ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </div>
                          <p className="font-headline-md text-sm text-white truncate">{b.service_type}</p>
                          <p className="font-data-sm text-[11px] text-on-surface-variant/60 mt-1">
                            {b.vehicle_name || 'Asset'} <span className="text-white/20 mx-1">|</span> {b.customer_name}
                          </p>
                          <div className="absolute inset-0 bg-[#050505]/95 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3">
                            {b.status === 'scheduled' && (
                              <button
                                onClick={() => handleConvert(b)}
                                className="performance-gradient text-white px-4 py-2 rounded-lg font-label-caps text-[9px] tracking-widest border border-white/10 uppercase"
                              >
                                CHECK IN
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenReschedule(b)}
                              className="w-9 h-9 rounded bg-white/5 border border-white/10 text-yellow-400 hover:bg-yellow-400 hover:text-black flex items-center justify-center transition-all"
                            >
                              <span className="material-symbols-outlined text-[18px]">schedule</span>
                            </button>
                            <button
                              onClick={() => handleOpenCancel(b)}
                              className="w-9 h-9 rounded bg-white/5 border border-white/10 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all"
                            >
                              <span className="material-symbols-outlined text-[18px]">block</span>
                            </button>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div
                          onClick={() => navigate(`/bookings/new?date=${selectedDate}&slot=14:00&bay=ALPHA`)}
                          className="bg-performance-red/[0.01] border border-performance-red/10 rounded-xl p-5 relative cursor-pointer hover:bg-performance-red/[0.04] hover:border-performance-red/30 transition-all group"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <span className="font-data-lg text-data-lg text-performance-red/70 group-hover:text-performance-red transition-colors">14:00 - 16:00</span>
                            <span className="font-label-caps text-[8px] px-2 py-0.5 bg-performance-red/10 text-performance-red rounded flex items-center gap-1 tracking-widest font-bold">
                              <span className="material-symbols-outlined text-[10px] animate-pulse">bolt</span> AVAILABLE
                            </span>
                          </div>
                          <div className="h-10 flex items-center justify-center border border-dashed border-performance-red/20 rounded-lg group-hover:border-performance-red/40 transition-all bg-void-black/20">
                            <span className="font-label-caps text-[9px] text-performance-red/60 tracking-widest group-hover:scale-105 transition-transform uppercase font-bold">
                              CLICK TO RESERVE
                            </span>
                          </div>
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>

              {/* DETAILING BAY OMEGA */}
              <div className="obsidian-panel rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-label-caps text-label-caps text-on-surface flex items-center gap-2 tracking-wider">
                    <span className="material-symbols-outlined text-performance-red text-[20px]">local_car_wash</span>
                    DETAILING BAY OMEGA
                  </h3>
                  <span className="px-2.5 py-0.5 bg-green-500/10 text-green-400 font-label-caps text-[9px] rounded border border-green-500/20">
                    OPERATIONAL
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Slot 3: 11:00 */}
                  {(() => {
                    const b = getSlotBooking('11:00');
                    if (b) {
                      const cfg = STATUS_CFG[b.status as BookingStatus] || STATUS_CFG.scheduled;
                      return (
                        <div className="bg-void-black/80 border border-white/5 rounded-xl p-5 relative overflow-hidden group">
                          <div className="absolute top-0 left-0 w-1 h-full bg-performance-red/60"></div>
                          <div className="flex justify-between items-start mb-3">
                            <span className="font-data-lg text-data-lg text-white">11:00 - 13:00</span>
                            <span className={`font-label-caps text-[8px] px-2 py-0.5 rounded border uppercase tracking-wider ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </div>
                          <p className="font-headline-md text-sm text-white truncate">{b.service_type}</p>
                          <p className="font-data-sm text-[11px] text-on-surface-variant/60 mt-1">
                            {b.vehicle_name || 'Asset'} <span className="text-white/20 mx-1">|</span> {b.customer_name}
                          </p>
                          <div className="absolute inset-0 bg-[#050505]/95 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3">
                            {b.status === 'scheduled' && (
                              <button
                                onClick={() => handleConvert(b)}
                                className="performance-gradient text-white px-4 py-2 rounded-lg font-label-caps text-[9px] tracking-widest border border-white/10 uppercase"
                              >
                                CHECK IN
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenReschedule(b)}
                              className="w-9 h-9 rounded bg-white/5 border border-white/10 text-yellow-400 hover:bg-yellow-400 hover:text-black flex items-center justify-center transition-all"
                            >
                              <span className="material-symbols-outlined text-[18px]">schedule</span>
                            </button>
                            <button
                              onClick={() => handleOpenCancel(b)}
                              className="w-9 h-9 rounded bg-white/5 border border-white/10 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all"
                            >
                              <span className="material-symbols-outlined text-[18px]">block</span>
                            </button>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div
                          onClick={() => navigate(`/bookings/new?date=${selectedDate}&slot=11:00&bay=OMEGA`)}
                          className="bg-performance-red/[0.01] border border-performance-red/10 rounded-xl p-5 relative cursor-pointer hover:bg-performance-red/[0.04] hover:border-performance-red/30 transition-all group"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <span className="font-data-lg text-data-lg text-performance-red/70 group-hover:text-performance-red transition-colors">11:00 - 13:00</span>
                            <span className="font-label-caps text-[8px] px-2 py-0.5 bg-performance-red/10 text-performance-red rounded flex items-center gap-1 tracking-widest font-bold">
                              <span className="material-symbols-outlined text-[10px] animate-pulse">bolt</span> AVAILABLE
                            </span>
                          </div>
                          <div className="h-10 flex items-center justify-center border border-dashed border-performance-red/20 rounded-lg group-hover:border-performance-red/40 transition-all bg-void-black/20">
                            <span className="font-label-caps text-[9px] text-performance-red/60 tracking-widest group-hover:scale-105 transition-transform uppercase font-bold">
                              CLICK TO RESERVE
                            </span>
                          </div>
                        </div>
                      );
                    }
                  })()}

                  {/* Slot 4: 16:00 */}
                  {(() => {
                    const b = getSlotBooking('16:00');
                    if (b) {
                      const cfg = STATUS_CFG[b.status as BookingStatus] || STATUS_CFG.scheduled;
                      return (
                        <div className="bg-void-black/80 border border-white/5 rounded-xl p-5 relative overflow-hidden group">
                          <div className="absolute top-0 left-0 w-1 h-full bg-performance-red/60"></div>
                          <div className="flex justify-between items-start mb-3">
                            <span className="font-data-lg text-data-lg text-white">16:00 - 18:00</span>
                            <span className={`font-label-caps text-[8px] px-2 py-0.5 rounded border uppercase tracking-wider ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </div>
                          <p className="font-headline-md text-sm text-white truncate">{b.service_type}</p>
                          <p className="font-data-sm text-[11px] text-on-surface-variant/60 mt-1">
                            {b.vehicle_name || 'Asset'} <span className="text-white/20 mx-1">|</span> {b.customer_name}
                          </p>
                          <div className="absolute inset-0 bg-[#050505]/95 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3">
                            {b.status === 'scheduled' && (
                              <button
                                onClick={() => handleConvert(b)}
                                className="performance-gradient text-white px-4 py-2 rounded-lg font-label-caps text-[9px] tracking-widest border border-white/10 uppercase"
                              >
                                CHECK IN
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenReschedule(b)}
                              className="w-9 h-9 rounded bg-white/5 border border-white/10 text-yellow-400 hover:bg-yellow-400 hover:text-black flex items-center justify-center transition-all"
                            >
                              <span className="material-symbols-outlined text-[18px]">schedule</span>
                            </button>
                            <button
                              onClick={() => handleOpenCancel(b)}
                              className="w-9 h-9 rounded bg-white/5 border border-white/10 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all"
                            >
                              <span className="material-symbols-outlined text-[18px]">block</span>
                            </button>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div
                          onClick={() => navigate(`/bookings/new?date=${selectedDate}&slot=16:00&bay=OMEGA`)}
                          className="bg-performance-red/[0.01] border border-performance-red/10 rounded-xl p-5 relative cursor-pointer hover:bg-performance-red/[0.04] hover:border-performance-red/30 transition-all group"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <span className="font-data-lg text-data-lg text-performance-red/70 group-hover:text-performance-red transition-colors">16:00 - 18:00</span>
                            <span className="font-label-caps text-[8px] px-2 py-0.5 bg-performance-red/10 text-performance-red rounded flex items-center gap-1 tracking-widest font-bold">
                              <span className="material-symbols-outlined text-[10px] animate-pulse">bolt</span> AVAILABLE
                            </span>
                          </div>
                          <div className="h-10 flex items-center justify-center border border-dashed border-performance-red/20 rounded-lg group-hover:border-performance-red/40 transition-all bg-void-black/20">
                            <span className="font-label-caps text-[9px] text-performance-red/60 tracking-widest group-hover:scale-105 transition-transform uppercase font-bold">
                              CLICK TO RESERVE
                            </span>
                          </div>
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // ═════════════════════════════════════════════════════════════
        // LIST VIEW (RECORDS LEDGER)
        // ═════════════════════════════════════════════════════════════
        <div className="bg-[#111111] border border-white/[0.06] rounded-xl overflow-hidden shadow-2xl flex flex-col">
          {/* Filters Topbar */}
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-4 bg-black/30 flex-wrap">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-[18px]">
                search
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search code, name, phone..."
                className="w-60 bg-white/[0.04] border border-white/[0.07] rounded-lg py-2.5 pl-10 pr-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-performance-red/50 transition-all"
              />
            </div>
            <div className="flex items-center gap-1 p-1 bg-black/40 border border-white/[0.06] rounded-lg overflow-x-auto custom-scrollbar">
              {(['all', 'scheduled', 'cancelled', 'converted'] as const).map((s) => {
                const cfg = s !== 'all' ? STATUS_CFG[s] : null;
                return (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    className={`px-3 py-1.5 rounded text-[9px] font-label-caps uppercase tracking-wider transition-all whitespace-nowrap ${
                      filter === s
                        ? cfg
                          ? `${cfg.bg} ${cfg.color}`
                          : 'bg-white/10 text-white'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {s === 'all' ? `All` : STATUS_CFG[s].label}
                  </button>
                );
              })}
            </div>
            <div className="ml-auto text-[10px] text-on-surface-variant/40 font-data-sm">
              {bookings.length} RECORDS TELEMETERED
            </div>
          </div>

          {/* Bookings Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/45 text-on-surface-variant/50 text-[9px] font-label-caps uppercase tracking-widest border-b border-white/[0.06]">
                  <th className="py-3.5 px-5 font-normal">Booking</th>
                  <th className="py-3.5 px-5 font-normal">Customer</th>
                  <th className="py-3.5 px-5 font-normal hidden md:table-cell">Service</th>
                  <th className="py-3.5 px-5 font-normal">Date &amp; Time</th>
                  <th className="py-3.5 px-5 font-normal">Status</th>
                  <th className="py-3.5 px-5 font-normal text-right">Advance</th>
                  <th className="py-3.5 px-5 font-normal text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="font-data-sm text-xs divide-y divide-white/[0.02]">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-on-surface-variant/40 text-xs italic">
                      QUERYING SCHEDULER MATRIX DATA...
                    </td>
                  </tr>
                ) : bookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-on-surface-variant/40 text-xs italic">
                      <span className="material-symbols-outlined text-4xl block mb-2 opacity-30 text-performance-red">
                        calendar_month
                      </span>
                      NO BOOKING RECORDS DETECTED IN WORKSPACE
                    </td>
                  </tr>
                ) : (
                  bookings.map((b, idx) => {
                    const cfg = STATUS_CFG[b.status as BookingStatus] || STATUS_CFG.scheduled;
                    return (
                      <tr
                        key={b.id}
                        className={`hover:bg-white/[0.015] transition-colors group ${
                          idx % 2 === 1 ? 'bg-black/20' : ''
                        }`}
                      >
                        <td className="py-3.5 px-5">
                          <p className="font-data-lg text-xs font-bold text-white">#{b.booking_code}</p>
                          <p className="text-[9px] text-on-surface-variant/50 font-label-caps tracking-widest mt-0.5 uppercase">
                            {b.package_tier || 'basic'}
                          </p>
                        </td>
                        <td className="py-3.5 px-5">
                          <p className="text-xs font-bold text-white">{b.customer_name || '—'}</p>
                          <p className="text-[10px] text-on-surface-variant/60 font-data-sm mt-0.5">
                            {b.vehicle_name || '—'}{' '}
                            {b.reg_number ? `[${b.reg_number}]` : ''}
                          </p>
                        </td>
                        <td className="py-3.5 px-5 hidden md:table-cell">
                          <p className="text-[11px] text-on-surface-variant truncate max-w-[160px]">
                            {b.service_type}
                          </p>
                        </td>
                        <td className="py-3.5 px-5">
                          <p className="font-data-sm text-xs text-white">
                            {new Date(b.booking_date).toLocaleDateString('en-IN')}
                          </p>
                          <p className="font-label-caps text-[9px] text-on-surface-variant/40 mt-0.5">
                            {b.time_slot} HRS
                          </p>
                        </td>
                        <td className="py-3.5 px-5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded border ${cfg.bg} ${cfg.border} ${cfg.color} text-[8px] font-label-caps uppercase tracking-wider`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <span className="font-data-sm text-xs font-bold text-white">
                            ₹{Number(b.advance_amount || 0).toLocaleString('en-IN')}
                          </span>
                          <span className="block text-[8px] text-on-surface-variant/40 uppercase tracking-widest">
                            {b.advance_mode || '—'}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {b.status === 'scheduled' && (
                              <button
                                onClick={() => handleConvert(b)}
                                title="Check In / Convert to Job"
                                className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 flex items-center justify-center transition-all"
                              >
                                <span className="material-symbols-outlined text-[16px]">build</span>
                              </button>
                            )}
                            {b.status === 'scheduled' && (
                              <>
                                <button
                                  onClick={() => handleOpenReschedule(b)}
                                  title="Reschedule Booking"
                                  className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 hover:bg-yellow-500 hover:text-black flex items-center justify-center transition-all"
                                >
                                  <span className="material-symbols-outlined text-[16px]">schedule</span>
                                </button>
                                <button
                                  onClick={() => handleOpenCancel(b)}
                                  title="Cancel Booking"
                                  className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all"
                                >
                                  <span className="material-symbols-outlined text-[16px]">block</span>
                                </button>
                              </>
                            )}
                            {b.status === 'cancelled' && (
                              <span
                                className="text-[10px] text-on-surface-variant/40 font-data-sm italic max-w-[120px] truncate"
                                title={b.notes || ''}
                              >
                                {b.notes || 'Cancelled'}
                              </span>
                            )}
                            {b.status === 'converted' && (
                              <span className="text-[9px] font-label-caps text-green-400 flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-xs">check_circle</span> CONVERTED
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Cancellation Reason Modal ──────────────────────── */}
      {showCancelModal && selectedBooking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
          onClick={() => setShowCancelModal(false)}
        >
          <div
            className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-black/20">
              <h3 className="text-sm font-label-caps font-bold text-performance-red flex items-center gap-2 tracking-wide">
                <span className="material-symbols-outlined text-[20px]">block</span>
                CANCEL SERVICE INDUCTION
              </h3>
              <button
                onClick={() => setShowCancelModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-performance-red/5 border border-performance-red/10 rounded-lg p-3.5 text-xs text-performance-red leading-relaxed">
                Cancelling booking{' '}
                <span className="font-bold text-white">{selectedBooking.booking_code}</span> for{' '}
                {selectedBooking.customer_name}. Any advances collected will need manual adjustment.
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">
                  Specify Reason for Cancellation *
                </label>
                <textarea
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-3 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50 h-24 resize-none"
                  placeholder="e.g. Customer cancelled plans, Slot conflict, Rescheduled manually..."
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3 bg-black/20">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 border border-white/10 rounded-lg text-xs text-gray-300 hover:bg-white/[0.06] transition-all font-label-caps tracking-widest"
              >
                DISCARD
              </button>
              <button
                onClick={() => cancelMutation.mutate({ id: selectedBooking.id, reason: cancelReason })}
                disabled={!cancelReason || cancelMutation.isPending}
                className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-800 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:shadow-[0_0_16px_rgba(239,68,68,0.4)] active:scale-[0.97] transition-all disabled:opacity-50 font-label-caps"
              >
                {cancelMutation.isPending ? 'PROCESSING...' : 'CONFIRM SLOT CANCEL'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rescheduling Modal ─────────────────────────────── */}
      {showRescheduleModal && selectedBooking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
          onClick={() => setShowRescheduleModal(false)}
        >
          <div
            className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-black/20">
              <h3 className="text-sm font-label-caps font-bold text-white flex items-center gap-2 tracking-wide">
                <span className="material-symbols-outlined text-[20px] text-yellow-500">schedule</span>
                RESCHEDULE INDUCTION SLOT
              </h3>
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-xs text-on-surface-variant/60">
                Modify date and bay timing allocations for{' '}
                <span className="font-bold text-white">{selectedBooking.customer_name}</span>.
              </p>

              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">
                  Select New Date *
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-yellow-500/50"
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2.5">
                  Available Timing Slots
                </label>
                {isSlotsLoading ? (
                  <p className="text-xs text-gray-500 italic animate-pulse">Loading bay status queries...</p>
                ) : availableSlots.length === 0 ? (
                  <p className="text-xs text-gray-600 italic">Select a date to fetch slot lists.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {availableSlots.map((s: any) => {
                      const isOccupied = s.booked && s.slot !== selectedBooking.time_slot;
                      return (
                        <button
                          key={s.slot}
                          disabled={isOccupied}
                          onClick={() => setNewSlot(s.slot)}
                          className={`py-2 px-3 rounded-xl border text-xs font-mono text-center transition-all ${
                            newSlot === s.slot
                              ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400 font-bold'
                              : isOccupied
                              ? 'bg-red-500/5 border-red-500/10 text-red-500/20 cursor-not-allowed'
                              : 'bg-green-500/5 border-green-500/10 text-green-400 hover:bg-green-500/10'
                          }`}
                        >
                          <span>{s.slot}</span>
                          <span className="block text-[8px] uppercase tracking-wider opacity-60 mt-0.5">
                            {isOccupied
                              ? 'Booked'
                              : s.slot === selectedBooking.time_slot
                              ? 'Current'
                              : 'Free'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3 bg-black/20">
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="px-4 py-2 border border-white/10 rounded-lg text-xs text-gray-300 hover:bg-white/[0.06] transition-all font-label-caps tracking-widest"
              >
                DISCARD
              </button>
              <button
                onClick={() => rescheduleMutation.mutate({ id: selectedBooking.id, date: newDate, slot: newSlot })}
                disabled={!newDate || !newSlot || rescheduleMutation.isPending}
                className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black rounded-lg text-xs font-bold uppercase tracking-widest hover:shadow-[0_0_16px_rgba(234,179,8,0.4)] active:scale-[0.97] transition-all disabled:opacity-50 font-label-caps"
              >
                {rescheduleMutation.isPending ? 'SAVING...' : 'CONFIRM RESCHEDULE'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Check-In Wizard Modal ─────────────────────────── */}
      {showCheckInModal && selectedBooking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm overflow-y-auto"
          onClick={() => setShowCheckInModal(false)}
        >
          <div
            className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-black/20">
              <h3 className="text-sm font-label-caps font-bold text-white flex items-center gap-2 tracking-wide">
                <span className="material-symbols-outlined text-[20px] text-performance-red">precision_manufacturing</span>
                CHECK IN &amp; INITIALIZE JOB CARD
              </h3>
              <button
                onClick={() => setShowCheckInModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="bg-[#181818]/60 border border-white/5 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-white uppercase tracking-wider">Vehicle Registry Asset</p>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-gray-500 block">Vehicle Description</span>
                    <span className="text-white font-medium">{selectedBooking.vehicle_name || 'Asset'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Registration Number</span>
                    <span className="text-white font-medium">{selectedBooking.reg_number || 'UNLICENSED'}</span>
                  </div>
                </div>
              </div>

              {/* SECTION 1: Insurance Details */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-performance-red"></span>
                  01. Vehicle Insurance Profile
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">
                      Insurance Company
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. HDFC Ergo, ICICI Lombard"
                      value={insuranceCompany}
                      onChange={(e) => setInsuranceCompany(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">
                      Insurance Expiry Date
                    </label>
                    <input
                      type="date"
                      value={insuranceExpiry}
                      onChange={(e) => setInsuranceExpiry(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-performance-red/50 text-left"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Customer Concerns */}
              <div className="space-y-3.5 pt-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-performance-red"></span>
                  02. Customer Concerns
                </h4>
                
                {/* Part A: Preset Concerns */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                    Select Standard Concern Presets
                  </label>
                  {presets.length === 0 ? (
                    <p className="text-[11px] text-gray-600 italic">Retrieving presets ledger...</p>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {presets.map((preset: any) => {
                        const isSelected = selectedConcerns.includes(preset.concern_text);
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedConcerns(prev => prev.filter(c => c !== preset.concern_text));
                              } else {
                                setSelectedConcerns(prev => [...prev, preset.concern_text]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-full border text-[10px] font-label-caps transition-all flex items-center gap-1 ${
                              isSelected
                                ? 'bg-performance-red/15 border-performance-red/40 text-performance-red font-bold'
                                : 'bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            {isSelected && <span className="material-symbols-outlined text-xs font-bold">check</span>}
                            {preset.concern_text}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Part B: Custom Concern */}
                <div className="space-y-1.5 pt-1.5">
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                    Record Custom Concern / Request
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Specify custom issue reported by client..."
                      value={customConcern}
                      onChange={(e) => setCustomConcern(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (customConcern.trim()) {
                            setSelectedConcerns(prev => [...prev, customConcern.trim()]);
                            setCustomConcern('');
                          }
                        }
                      }}
                      className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customConcern.trim()) {
                          setSelectedConcerns(prev => [...prev, customConcern.trim()]);
                          setCustomConcern('');
                        }
                      }}
                      className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white border border-white/10 rounded-xl text-xs font-bold font-label-caps uppercase transition-all"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Part C: Summary Tags */}
                {selectedConcerns.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                      Selected Concerns Ledger ({selectedConcerns.length})
                    </label>
                    <div className="flex flex-wrap gap-2 bg-black/40 border border-white/5 rounded-xl p-3">
                      {selectedConcerns.map((c) => (
                        <span
                          key={c}
                          className="bg-white/5 border border-white/10 text-white pl-3 pr-1.5 py-1 rounded-lg text-xs flex items-center gap-1 font-medium"
                        >
                          {c}
                          <button
                            type="button"
                            onClick={() => setSelectedConcerns(prev => prev.filter(item => item !== c))}
                            className="w-5 h-5 rounded-full hover:bg-red-500/10 hover:text-red-400 flex items-center justify-center transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3 bg-black/20">
              <button
                type="button"
                onClick={() => setShowCheckInModal(false)}
                className="px-4 py-2 border border-white/10 rounded-lg text-xs text-gray-300 hover:bg-white/[0.06] transition-all font-label-caps tracking-widest"
              >
                DISCARD
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedBooking) {
                    convertMutation.mutate({
                      id: selectedBooking.id,
                      insurance_company: insuranceCompany,
                      insurance_expiry: insuranceExpiry,
                      concerns: selectedConcerns
                    });
                  }
                }}
                disabled={convertMutation.isPending}
                className="px-5 py-2.5 bg-gradient-to-r from-performance-red to-[#93000a] text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:shadow-[0_0_16px_rgba(255,43,43,0.4)] active:scale-[0.97] transition-all disabled:opacity-50 font-label-caps"
              >
                {convertMutation.isPending ? 'CHECKING IN...' : 'CONFIRM CHECK-IN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
