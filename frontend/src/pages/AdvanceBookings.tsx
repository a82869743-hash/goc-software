import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { advanceBookingsAPI, AdvanceBooking } from '../api/advanceBookings';
import { customersAPI } from '../api/customers';
import { carDataset } from '../utils/carDataset';
import toast from 'react-hot-toast';

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  pending: { label: 'Pending Approval', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', dot: 'bg-yellow-400' },
  confirmed: { label: 'Confirmed Slot', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', dot: 'bg-green-400' },
  arrived: { label: 'Arrived at Studio', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', dot: 'bg-blue-400 animate-pulse' },
  cancelled: { label: 'Cancelled Slot', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', dot: 'bg-red-500' },
  converted: { label: 'Converted to Job', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', dot: 'bg-purple-400' },
};

const TIMING_SLOTS = ['09:00', '11:00', '14:00', '16:00', '18:00'];

export default function AdvanceBookings() {
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Modals & Action selection
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<AdvanceBooking | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Lookup state
  const [lookupQuery, setLookupQuery] = useState('');
  const [activeField, setActiveField] = useState<'customer_name' | 'mobile' | 'car_number' | null>(null);
  const { data: lookupRes } = useQuery({
    queryKey: ['customer-lookup-advance', lookupQuery],
    queryFn: () => customersAPI.search(lookupQuery),
    enabled: lookupQuery.length >= 2,
  });
  const lookupResults = lookupRes?.data || [];

  const renderAutocomplete = (fieldName: 'customer_name' | 'mobile' | 'car_number') => {
    if (activeField !== fieldName || lookupQuery.length < 2 || lookupResults.length === 0) return null;
    return (
      <div className="absolute left-0 right-0 top-full mt-1 bg-[#111111] border border-white/10 rounded-xl overflow-hidden max-h-48 overflow-y-auto z-50 shadow-2xl font-data-sm text-left">
        {lookupResults.map((c: any) => (
          <div
            key={`${c.id}-${c.vehicle_id}`}
            onMouseDown={(e) => {
              e.preventDefault(); // prevents blur
              setBookingForm(prev => ({
                ...prev,
                customer_name: c.full_name,
                mobile: c.phone || '',
                car_number: c.car_number || '',
                car_make: c.car_make || '',
                car_model: c.car_model || '',
              }));
              setLookupQuery('');
              setActiveField(null);
            }}
            className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 text-xs text-white cursor-pointer flex flex-col"
          >
            <span className="font-bold text-white">{c.full_name} ({c.phone})</span>
            {c.car_number && (
              <span className="text-[10px] text-performance-red mt-0.5 font-mono">{c.car_number} • {c.car_make} {c.car_model}</span>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Booking Create Form
  const [bookingForm, setBookingForm] = useState({
    customer_name: '',
    mobile: '',
    car_number: '',
    car_make: '',
    car_model: '',
    booking_date: new Date().toISOString().split('T')[0],
    booking_time: '09:00',
    concerns: '',
    notes: '',
    advance_amount: '',
    advance_mode: 'upi',
  });

  const navigate = useNavigate();

  const selectedBrandDataBooking = carDataset.find(
    item => item.brand.toLowerCase() === bookingForm.car_make.toLowerCase()
  );
  const modelSuggestions = selectedBrandDataBooking
    ? selectedBrandDataBooking.models
    : Array.from(new Set(carDataset.flatMap(item => item.models))).sort();

  // Queries
  const { data: bookingsRes, isLoading } = useQuery({
    queryKey: ['advanceBookings', search, statusFilter, selectedDate],
    queryFn: () =>
      advanceBookingsAPI.list({
        search: search || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        date: selectedDate || undefined,
      }),
  });
  const bookings = bookingsRes?.data || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: Partial<AdvanceBooking>) => advanceBookingsAPI.create(payload),
    onSuccess: () => {
      toast.success('Advance Booking confirmed! SMS dispatched.');
      queryClient.invalidateQueries({ queryKey: ['advanceBookings'] });
      setShowScheduleModal(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Booking slot reservation failed');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => advanceBookingsAPI.updateStatus(id, status),
    onSuccess: () => {
      toast.success('Booking status updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['advanceBookings'] });
      setSelectedBooking(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to update status');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id }: { id: number }) => advanceBookingsAPI.updateStatus(id, 'cancelled'),
    onSuccess: () => {
      toast.success('Booking cancelled. Cancellation alert SMS dispatched.');
      queryClient.invalidateQueries({ queryKey: ['advanceBookings'] });
      setShowCancelModal(false);
      setCancelReason('');
      setSelectedBooking(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to cancel booking');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => advanceBookingsAPI.delete(id),
    onSuccess: () => {
      toast.success('Booking deleted.');
      queryClient.invalidateQueries({ queryKey: ['advanceBookings'] });
      setSelectedBooking(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to delete booking');
    },
  });

  // Helpers
  const resetForm = () => {
    setLookupQuery('');
    setActiveField(null);
    setBookingForm({
      customer_name: '',
      mobile: '',
      car_number: '',
      car_make: '',
      car_model: '',
      booking_date: selectedDate,
      booking_time: '09:00',
      concerns: '',
      notes: '',
      advance_amount: '',
      advance_mode: 'upi',
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingForm.customer_name || !bookingForm.mobile || !bookingForm.car_number || !bookingForm.booking_date || !bookingForm.booking_time) {
      toast.error('All fields marked with * are required.');
      return;
    }
    createMutation.mutate(bookingForm);
  };

  const getSlotBooking = (timeSlot: string) => {
    return bookings.find(b => b.booking_time.substring(0, 5) === timeSlot && b.status !== 'cancelled') || null;
  };

  const activeCount = bookings.filter(b => b.status === 'confirmed' || b.status === 'pending').length;

  return (
    <div className="space-y-6 relative flex flex-col h-[calc(100vh-8rem)]">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h2 className="font-display-hero text-headline-lg text-white mb-1 tracking-tight italic">
            ADVANCE <span className="text-performance-red not-italic font-light">SCHEDULER</span>
          </h2>
          <p className="font-label-caps text-label-caps text-on-surface-variant/80 tracking-widest uppercase">
            Schedule slots calendar — God of Ceramic Studio Management
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowScheduleModal(true);
          }}
          className="performance-gradient text-white px-5 py-3 rounded-xl font-label-caps text-[10px] flex items-center gap-1.5 transition-all group tracking-widest border border-white/10 uppercase"
        >
          <span className="material-symbols-outlined text-[18px]">calendar_today</span>
          Reserve Advance Slot
        </button>
      </div>

      {/* ── Filter & Date Bar ──────────────────────────────── */}
      <div className="flex flex-wrap gap-4 items-center bg-[#111111]/40 border border-white/5 rounded-2xl p-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs font-label-caps uppercase tracking-wider font-bold">Select Date</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-white/[0.03] border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-performance-red/40"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search booking ref, customer, mobile, car plate..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-performance-red/40"
          />
        </div>
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white/[0.03] border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-performance-red/40 font-label-caps bg-black"
          >
            <option value="all" className="bg-[#0c0c0e]">All Statuses</option>
            <option value="pending" className="bg-[#0c0c0e]">Pending</option>
            <option value="confirmed" className="bg-[#0c0c0e]">Confirmed</option>
            <option value="arrived" className="bg-[#0c0c0e]">Arrived</option>
            <option value="cancelled" className="bg-[#0c0c0e]">Cancelled</option>
          </select>
        </div>
      </div>

      {/* ── Main Scheduler Grid ────────────────────────────── */}
      <div className="flex-grow min-h-0 flex flex-col gap-6 items-start w-full">
        {/* Full scheduling manifest table list */}
        <section className="w-full flex flex-col glass-panel rounded-2xl h-auto lg:h-full lg:max-h-full overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-carbon-border/50 flex justify-between items-center bg-white/[0.01] shrink-0">
            <h2 className="font-label-caps text-label-caps text-white tracking-widest">SCHEDULING MANIFEST</h2>
          </div>

          <div className="flex-grow min-h-0 overflow-y-auto custom-scrollbar p-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left border-collapse text-xs font-data-sm">
              <thead>
                <tr className="border-b border-white/5 text-gray-500 uppercase tracking-widest text-[8px] font-label-caps pb-2">
                  <th className="pb-3 font-normal">Booking ID</th>
                  <th className="pb-3 font-normal">Customer</th>
                  <th className="pb-3 font-normal">Appointment</th>
                  <th className="pb-3 font-normal">Advance</th>
                  <th className="pb-3 font-normal">Status</th>
                  <th className="pb-3 font-normal text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-600 italic">No bookings match the current query.</td>
                  </tr>
                ) : (
                  bookings.map((b) => {
                    const cfg = STATUS_CFG[b.status] || STATUS_CFG.pending;
                    return (
                      <tr key={b.id} className="hover:bg-white/[0.01]">
                        <td className="py-3 font-bold text-white">
                          <p>{b.booking_ref}</p>
                          <span className="text-[10px] text-gray-500 font-mono">{b.car_number}</span>
                        </td>
                        <td className="py-3">
                          <p className="text-white font-medium">{b.customer_name}</p>
                          <p className="text-[10px] text-gray-500 font-mono">{b.mobile}</p>
                        </td>
                        <td className="py-3 font-mono text-[10px] text-white">
                          <p>{b.booking_date}</p>
                          <p className="text-gray-500">{b.booking_time.substring(0, 5)}</p>
                        </td>
                        <td className="py-3">
                          {b.advance_amount && Number(b.advance_amount) > 0 ? (
                            <div>
                              <p className="text-white font-medium">₹{Number(b.advance_amount).toLocaleString('en-IN')}</p>
                              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-mono">{b.advance_mode}</p>
                            </div>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="py-3">
                          <span className={`font-label-caps text-[7px] px-1.5 py-0.5 rounded border uppercase tracking-wider ${cfg.bg} ${cfg.border} ${cfg.color} inline-flex items-center gap-1 font-bold`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="py-3 text-right font-medium">
                          {b.status !== 'converted' && b.status !== 'cancelled' && (
                            <button
                              onClick={() => navigate(`/jobs/new?advance_booking_id=${b.id}`)}
                              className="mr-3 px-2 py-1 bg-green-500/10 border border-green-500/20 text-green-400 rounded text-[9px] font-label-caps tracking-widest uppercase hover:bg-green-500 hover:text-white transition-all inline-flex items-center gap-1 font-bold"
                              title="Create Job Card"
                            >
                              <span className="material-symbols-outlined text-[10px]">precision_manufacturing</span>
                              Create Job
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (window.confirm('Delete this booking record permanently?')) {
                                deleteMutation.mutate(b.id);
                              }
                            }}
                            className="text-gray-600 hover:text-performance-red transition-colors inline-flex items-center"
                            title="Delete booking"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>
          </div>
        </section>
      </div>

      {/* ── SCHEDULING FORM MODAL ─────────────────────────── */}
      {showScheduleModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto p-4"
          onClick={() => setShowScheduleModal(false)}
        >
          <div
            className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-black/20 shrink-0">
              <h3 className="text-sm font-label-caps font-bold text-white flex items-center gap-2 tracking-wide">
                <span className="material-symbols-outlined text-[20px] text-performance-red">calendar_today</span>
                INITIALIZE SERVICE APPOINTMENT
              </h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
                type="button"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Customer Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Patel"
                    value={bookingForm.customer_name}
                    onChange={(e) => {
                      setBookingForm(prev => ({ ...prev, customer_name: e.target.value }));
                      setLookupQuery(e.target.value);
                    }}
                    onFocus={() => {
                      setActiveField('customer_name');
                      setLookupQuery(bookingForm.customer_name);
                    }}
                    onBlur={() => setActiveField(null)}
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2 px-3.5 text-xs text-white focus:outline-none"
                  />
                  {renderAutocomplete('customer_name')}
                </div>
                <div className="relative">
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Mobile Contact *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 9876543210"
                    value={bookingForm.mobile}
                    onChange={(e) => {
                      setBookingForm(prev => ({ ...prev, mobile: e.target.value }));
                      setLookupQuery(e.target.value);
                    }}
                    onFocus={() => {
                      setActiveField('mobile');
                      setLookupQuery(bookingForm.mobile);
                    }}
                    onBlur={() => setActiveField(null)}
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2 px-3.5 text-xs text-white focus:outline-none"
                  />
                  {renderAutocomplete('mobile')}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="relative">
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">License Plate *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GJ-01-AB-1234"
                    value={bookingForm.car_number}
                    onChange={(e) => {
                      setBookingForm(prev => ({ ...prev, car_number: e.target.value.toUpperCase() }));
                      setLookupQuery(e.target.value);
                    }}
                    onFocus={() => {
                      setActiveField('car_number');
                      setLookupQuery(bookingForm.car_number);
                    }}
                    onBlur={() => setActiveField(null)}
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2 px-3.5 text-xs text-white focus:outline-none font-mono"
                  />
                  {renderAutocomplete('car_number')}
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Car Make</label>
                  <input
                    type="text"
                    list="brands-datalist-booking"
                    placeholder="e.g. Maruti"
                    value={bookingForm.car_make}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, car_make: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2 px-3.5 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Car Model</label>
                  <input
                    type="text"
                    list="models-datalist-booking"
                    placeholder="e.g. Swift"
                    value={bookingForm.car_model}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, car_model: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2 px-3.5 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Induction Date *</label>
                  <input
                    type="date"
                    required
                    value={bookingForm.booking_date}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, booking_date: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2 px-3.5 text-xs text-white focus:outline-none text-left"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Induction Slot *</label>
                  <select
                    value={bookingForm.booking_time}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, booking_time: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none bg-black font-mono"
                  >
                    {TIMING_SLOTS.map(slot => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Customer Concerns / Requests</label>
                <input
                  type="text"
                  placeholder="e.g. Paint swirl marks, dashboard polish requested..."
                  value={bookingForm.concerns}
                  onChange={(e) => setBookingForm(prev => ({ ...prev, concerns: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2 px-3.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Advance Amount (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 5000"
                    value={bookingForm.advance_amount}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, advance_amount: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2 px-3.5 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Advance Payment Mode</label>
                  <select
                    value={bookingForm.advance_mode}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, advance_mode: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none bg-black"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Internal Remarks</label>
                <textarea
                  placeholder="Insert any detailed notes or remarks..."
                  value={bookingForm.notes}
                  onChange={(e) => setBookingForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-3 px-4 text-xs text-white focus:outline-none h-20 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 border border-white/10 rounded-lg text-xs text-gray-300 hover:bg-white/[0.06] transition-all font-label-caps tracking-widest"
                >
                  DISCARD
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-5 py-2.5 bg-gradient-to-r from-performance-red to-[#93000a] text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:shadow-[0_0_16px_rgba(255,43,43,0.4)] active:scale-[0.97] transition-all disabled:opacity-50 font-label-caps"
                >
                  {createMutation.isPending ? 'RESERVING...' : 'RESERVE SLOT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CANCELLATION modal ────────────────────────────── */}
      {showCancelModal && selectedBooking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowCancelModal(false)}
        >
          <div
            className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-[#111111] bg-black/20 shrink-0">
              <h3 className="text-sm font-label-caps font-bold text-performance-red flex items-center gap-2 tracking-wide">
                <span className="material-symbols-outlined text-[20px]">block</span>
                CANCEL SERVICE APPOINTMENT
              </h3>
              <button
                onClick={() => setShowCancelModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="bg-performance-red/5 border border-performance-red/10 rounded-lg p-3.5 text-xs text-performance-red leading-relaxed">
                Cancelling advance booking <span className="font-bold text-white">{selectedBooking.booking_ref}</span> for {selectedBooking.customer_name}. An alert SMS will be dispatched automatically.
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Cancellation Reason</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl py-3 px-4 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-performance-red/50 h-24 resize-none"
                  placeholder="e.g. Schedule conflict, client request..."
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
                onClick={() => cancelMutation.mutate({ id: selectedBooking.id })}
                disabled={cancelMutation.isPending}
                className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-800 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:shadow-[0_0_16px_rgba(239,68,68,0.4)] active:scale-[0.97] transition-all disabled:opacity-50 font-label-caps"
              >
                {cancelMutation.isPending ? 'CANCELLING...' : 'CONFIRM CANCEL'}
              </button>
            </div>
          </div>
        </div>
      )}
      <datalist id="brands-datalist-booking">
        {carDataset.map(item => (
          <option key={item.brand} value={item.brand} />
        ))}
      </datalist>

      <datalist id="models-datalist-booking">
        {modelSuggestions.map(model => (
          <option key={model} value={model} />
        ))}
      </datalist>
    </div>
  );
}
