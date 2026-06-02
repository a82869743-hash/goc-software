import React, { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tldraw, useEditor, getSnapshot } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { quotationsAPI, WhiteboardQuotation, CreateQuotationPayload } from '../api/quotations';
import { customersAPI, vehiclesAPI } from '../api/customers';
import type { Customer, Vehicle } from '../types';
import toast from 'react-hot-toast';
import { formatINR, formatDate } from '../utils/helpers';
import { useAuthStore } from '../stores/authStore';

// ── Status badge config ───────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  draft:    { label: 'Draft',    color: 'text-gray-400',   bg: 'bg-gray-500/10',   border: 'border-gray-500/20',   dot: 'bg-gray-500' },
  sent:     { label: 'Sent',     color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   dot: 'bg-blue-400 animate-pulse' },
  accepted: { label: 'Accepted', color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  dot: 'bg-green-400' },
  rejected: { label: 'Rejected', color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    dot: 'bg-red-500' },
  expired:  { label: 'Expired',  color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', dot: 'bg-orange-400' },
};

// ── Inner canvas toolbar — inside Tldraw context ──────────
function CanvasToolbar({
  onSave,
  isSaving,
}: {
  onSave: (canvasData: string, snapshotBase64: string) => void;
  isSaving: boolean;
}) {
  const editor = useEditor();

  const handleSave = useCallback(async () => {
    if (!editor) return;
    const snapshot = getSnapshot(editor.store);
    const canvasData = JSON.stringify(snapshot);
    try {
      const shapeIds = Array.from(editor.getCurrentPageShapeIds());
      let snapshotBase64 = '';
      if (shapeIds.length > 0) {
        const result = await editor.toImageDataUrl(shapeIds, {
          format: 'png',
          background: true,
          scale: 1.5,
        });
        snapshotBase64 = typeof result === 'string' ? result : (result as any).url || '';
      }
      onSave(canvasData, snapshotBase64);
    } catch (err) {
      console.error('Canvas export error:', err);
      onSave(canvasData, '');
    }
  }, [editor, onSave]);

  return (
    <div className="absolute bottom-4 right-4 z-50 flex gap-2">
      <button
        onClick={() => editor?.selectAll()}
        className="px-3 py-2 bg-black/80 border border-white/20 rounded-lg text-xs text-white font-label-caps hover:bg-white/10 transition-all flex items-center gap-1.5"
        title="Select All"
      >
        <span className="material-symbols-outlined text-sm">select_all</span>
      </button>
      <button
        onClick={() => editor?.undo()}
        className="px-3 py-2 bg-black/80 border border-white/20 rounded-lg text-xs text-white font-label-caps hover:bg-white/10 transition-all"
        title="Undo"
      >
        <span className="material-symbols-outlined text-sm">undo</span>
      </button>
      <button
        onClick={() => editor?.redo()}
        className="px-3 py-2 bg-black/80 border border-white/20 rounded-lg text-xs text-white font-label-caps hover:bg-white/10 transition-all"
        title="Redo"
      >
        <span className="material-symbols-outlined text-sm">redo</span>
      </button>
      <button
        onClick={() => {
          if (window.confirm('Are you sure you want to clear the canvas?')) {
            const shapes = editor?.getCurrentPageShapes() || [];
            editor?.deleteShapes(shapes.map(s => s.id));
          }
        }}
        className="px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-xs text-red-400 font-label-caps hover:bg-red-500/30 transition-all"
        title="Clear Canvas"
      >
        <span className="material-symbols-outlined text-sm">delete_sweep</span>
      </button>
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="px-4 py-2 performance-gradient border border-white/10 rounded-lg text-xs text-white font-label-caps hover:shadow-[0_0_15px_rgba(255,43,43,0.3)] transition-all flex items-center gap-1.5 disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-sm">{isSaving ? 'hourglass_top' : 'save'}</span>
        {isSaving ? 'Saving…' : 'Save Canvas'}
      </button>
    </div>
  );
}

// ── Whiteboard Editor Modal ───────────────────────────────
interface WhiteboardModalProps {
  editingId: number | null;
  initialCanvasData: string | null;
  customerHeader: {
    customerName: string;
    customerPhone: string;
    vehicleDescription: string;
    validUntil: string;
    notes: string;
    grandTotal: string;
  };
  onCanvasSaved: (canvasData: string, snapshotBase64: string) => void;
  onDiscard: () => void;
  onClose: () => void;
  isSaving: boolean;
}

function WhiteboardModal({
  editingId,
  initialCanvasData,
  customerHeader,
  onCanvasSaved,
  onDiscard,
  onClose,
  isSaving,
}: WhiteboardModalProps) {
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const editorRef = useRef<any>(null);

  let initialSnapshot: any = undefined;
  if (initialCanvasData) {
    try { initialSnapshot = JSON.parse(initialCanvasData); } catch { /* ignore */ }
  }

  const handleConfirmSave = async () => {
    const editor = editorRef.current;
    if (!editor) {
      onClose();
      return;
    }
    const snapshot = getSnapshot(editor.store);
    const canvasData = JSON.stringify(snapshot);
    try {
      const shapeIds = Array.from(editor.getCurrentPageShapeIds());
      let snapshotBase64 = '';
      if (shapeIds.length > 0) {
        const result = await editor.toImageDataUrl(shapeIds, {
          format: 'png',
          background: true,
          scale: 1.5,
        });
        snapshotBase64 = typeof result === 'string' ? result : (result as any).url || '';
      }
      onCanvasSaved(canvasData, snapshotBase64);
    } catch (err) {
      console.error('Canvas export error:', err);
      onCanvasSaved(canvasData, '');
    }
    onClose();
  };

  const handleConfirmDiscard = () => {
    onDiscard();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#050505]">
      {/* Modal Header Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-black/80 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowConfirmClose(true)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-on-surface-variant/60 hover:text-white transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span className="font-label-caps text-xs text-white/80 hidden sm:inline">Back</span>
          </button>
          <div>
            <h2 className="font-display-hero text-base text-white font-bold tracking-tight italic">
              WHITEBOARD <span className="text-performance-red not-italic font-light">QUOTATION</span>
            </h2>
            <p className="font-label-caps text-[9px] text-on-surface-variant/50 tracking-widest">
              {customerHeader.customerName || 'New Quotation'} · {customerHeader.vehicleDescription || 'Vehicle N/A'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-data-sm text-on-surface-variant/50">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-performance-red">stylus</span>
            Use stylus or touch to draw details
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            Auto-saves on "Save Canvas"
          </span>
        </div>
      </div>

      {/* Tldraw Canvas */}
      <div className="flex-1 relative overflow-hidden bg-white">
        <Tldraw
          snapshot={initialSnapshot}
          onMount={(editor) => {
            editorRef.current = editor;
            editor.updateInstanceState({ isDebugMode: false });
            editor.setCurrentTool('draw');
          }}
        >
          <CanvasToolbar onSave={onCanvasSaved} isSaving={isSaving} />
        </Tldraw>
      </div>

      {/* ── Save or Discard Confirmation Overlay ── */}
      {showConfirmClose && (
        <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 text-center">
            <span className="material-symbols-outlined text-amber-400 text-4xl">warning</span>
            <div>
              <h3 className="font-label-caps text-sm text-white tracking-widest">SAVE OR DISCARD CHANGES?</h3>
              <p className="text-xs text-on-surface-variant/60 font-data-sm mt-1.5">
                Do you want to save your drawings to this quotation docket, or discard and delete the quotation?
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleConfirmSave}
                disabled={isSaving}
                className="w-full py-2.5 bg-performance-red hover:bg-performance-red/90 text-white rounded-xl text-xs font-label-caps tracking-widest transition-all uppercase"
              >
                Save Drawing
              </button>
              <button
                onClick={handleConfirmDiscard}
                className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 rounded-xl text-xs font-label-caps tracking-widest transition-colors uppercase"
              >
                Discard &amp; Delete
              </button>
              <button
                onClick={() => setShowConfirmClose(false)}
                className="w-full py-2.5 border border-white/10 text-on-surface-variant/80 hover:text-white rounded-xl text-xs font-label-caps tracking-widest hover:bg-white/5 transition-colors uppercase"
              >
                Cancel / Keep Drawing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main QuotationsPage ───────────────────────────────────
export default function QuotationsPage() {
  const queryClient = useQueryClient();
  const staff = useAuthStore(s => s.staff);
  const isPowerUser = staff?.role === 'admin' || staff?.role === 'manager';

  // Tab filter and list paging
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Form modals state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingCanvasData, setEditingCanvasData] = useState<string | null>(null);

  // Customer search & linking state
  const [custSearch, setCustSearch] = useState('');
  const [showCustResults, setShowCustResults] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  // Form input fields
  const [headerForm, setHeaderForm] = useState({
    customerName: '',
    customerPhone: '',
    vehicleDescription: '',
    validUntil: (() => { const d = new Date(); d.setDate(d.getDate() + 15); return d.toISOString().split('T')[0]; })(),
    notes: '',
    grandTotal: '',
  });

  // Whiteboard overlay modal state
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [pendingQuotationId, setPendingQuotationId] = useState<number | null>(null);

  // ── Queries ──
  const { data: quotationsRes, isLoading } = useQuery({
    queryKey: ['quotations', activeTab, search, page],
    queryFn: () => quotationsAPI.list({
      status: activeTab === 'all' ? undefined : activeTab,
      search: search || undefined,
      page,
      limit: 20,
    }),
  });
  const quotations = (quotationsRes?.data || []) as WhiteboardQuotation[];
  const meta = quotationsRes?.meta;

  const { data: custSearchRes } = useQuery({
    queryKey: ['custSearch', custSearch],
    queryFn: () => customersAPI.search(custSearch),
    enabled: custSearch.length >= 2,
  });
  const custResults = (custSearchRes?.data || []) as Customer[];

  const { data: vehiclesRes } = useQuery({
    queryKey: ['custVehicles', selectedCustomer?.id],
    queryFn: () => vehiclesAPI.list(selectedCustomer!.id),
    enabled: !!selectedCustomer?.id,
  });
  const customerVehicles = (vehiclesRes?.data || []) as Vehicle[];

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (payload: CreateQuotationPayload) => quotationsAPI.create(payload),
    onSuccess: (res) => {
      toast.success(`Draft Quotation ${res.data.quotation_code} created! Opening whiteboard…`);
      setPendingQuotationId(res.data.id);
      setEditingCanvasData(null);
      setShowWhiteboard(true);
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
    onError: () => toast.error('Failed to create quotation.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => quotationsAPI.update(id, payload),
    onSuccess: () => {
      toast.success('Whiteboard drawing saved successfully!');
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
    onError: () => toast.error('Failed to save whiteboard.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => quotationsAPI.delete(id),
    onSuccess: () => {
      toast.success('Quotation deleted successfully.');
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
    onError: () => toast.error('Failed to delete.'),
  });

  const generatePDFMutation = useMutation({
    mutationFn: (id: number) => quotationsAPI.generatePDF(id),
    onSuccess: (res) => {
      toast.success('PDF generated successfully!');
      window.open(`http://localhost:4000${res.data.pdf_url}`, '_blank');
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
    onError: () => toast.error('Failed to generate PDF.'),
  });

  const sendWhatsAppMutation = useMutation({
    mutationFn: (id: number) => quotationsAPI.sendWhatsApp(id),
    onSuccess: (res) => {
      toast.success(`WhatsApp notification dispatched to customer!`);
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to dispatch WhatsApp message.');
    },
  });

  // ── Handlers ──
  const handleCreateNew = () => {
    setEditingId(null);
    setPendingQuotationId(null);
    setEditingCanvasData(null);
    setSelectedCustomer(null);
    setSelectedVehicle(null);
    setCustSearch('');
    setHeaderForm({
      customerName: '',
      customerPhone: '',
      vehicleDescription: '',
      validUntil: (() => { const d = new Date(); d.setDate(d.getDate() + 15); return d.toISOString().split('T')[0]; })(),
      notes: '',
      grandTotal: '',
    });
    setShowForm(true);
  };

  const handleOpenWhiteboardForExisting = (qt: WhiteboardQuotation) => {
    setEditingId(qt.id);
    setPendingQuotationId(qt.id);
    setEditingCanvasData(qt.canvas_data);
    setHeaderForm({
      customerName: qt.customer_name || qt.customer_name_override || '',
      customerPhone: qt.customer_phone || qt.customer_phone_override || '',
      vehicleDescription: qt.vehicle_name || qt.vehicle_description || '',
      validUntil: qt.valid_until?.split('T')[0] || '',
      notes: qt.notes || '',
      grandTotal: qt.grand_total ? String(qt.grand_total) : '',
    });
    setShowWhiteboard(true);
  };

  const handleProceedToWhiteboard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer && (!headerForm.customerName || !headerForm.customerPhone)) {
      toast.error('Please input customer name and phone contact details.');
      return;
    }
    const payload: CreateQuotationPayload = {
      customer_id: selectedCustomer?.id || undefined,
      vehicle_id: selectedVehicle?.id || undefined,
      customer_name_override: !selectedCustomer ? headerForm.customerName : undefined,
      customer_phone_override: !selectedCustomer ? headerForm.customerPhone : undefined,
      vehicle_description: headerForm.vehicleDescription || 'Freetext Vehicle',
      valid_until: headerForm.validUntil,
      notes: headerForm.notes || undefined,
      grand_total: headerForm.grandTotal ? Number(headerForm.grandTotal) : 0,
    };
    createMutation.mutate(payload);
    setShowForm(false);
  };

  const handleCanvasSaved = useCallback((canvasData: string, snapshotBase64: string) => {
    const id = pendingQuotationId || editingId;
    if (!id) {
      toast.error('Failed to resolve quotation ID context.');
      return;
    }
    updateMutation.mutate({
      id,
      payload: {
        canvas_data: canvasData,
        canvas_snapshot: snapshotBase64,
      }
    });
  }, [pendingQuotationId, editingId, updateMutation]);

  const handleCloseWhiteboard = () => {
    setShowWhiteboard(false);
    setPendingQuotationId(null);
    setEditingId(null);
  };

  return (
    <div className="p-6 space-y-6">
      {/* ── Whiteboard full-screen canvas modal ── */}
      {showWhiteboard && (
        <WhiteboardModal
          editingId={pendingQuotationId || editingId}
          initialCanvasData={editingCanvasData}
          customerHeader={headerForm}
          onCanvasSaved={handleCanvasSaved}
          onDiscard={() => {
            const id = pendingQuotationId || editingId;
            if (id) deleteMutation.mutate(id);
            handleCloseWhiteboard();
          }}
          onClose={handleCloseWhiteboard}
          isSaving={updateMutation.isPending}
        />
      )}

      {/* ── New Quotation customer header modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-label-caps text-sm text-white tracking-widest">NEW WHITEBOARD QUOTATION</h3>
                <p className="text-xs text-on-surface-variant/50 font-data-sm">Set customer context first, then draw details</p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="text-on-surface-variant/40 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleProceedToWhiteboard} className="space-y-4">
              {/* Dynamic Customer Search */}
              <div>
                <label className="block font-label-caps text-[10px] text-on-surface-variant/60 uppercase tracking-wider mb-1">
                  Search CRM Customer
                </label>
                {selectedCustomer ? (
                  <div className="flex items-center justify-between p-3 rounded-xl border border-performance-red/30 bg-performance-red/5">
                    <div>
                      <p className="text-sm text-white font-medium">{selectedCustomer.full_name}</p>
                      <p className="text-xs text-on-surface-variant/50 font-data-sm">{selectedCustomer.phone}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedCustomer(null); setSelectedVehicle(null); }}
                      className="text-xs text-performance-red/80 hover:text-performance-red border border-performance-red/20 px-2 py-1 rounded-lg font-label-caps"
                    >
                      Clear Link
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      value={custSearch}
                      onChange={e => { setCustSearch(e.target.value); setShowCustResults(true); }}
                      placeholder="Type name or phone number…"
                      className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-performance-red/40 placeholder-on-surface-variant/40"
                    />
                    {showCustResults && custSearch.length >= 2 && custResults.length > 0 && (
                      <div className="absolute top-full mt-1 left-0 right-0 bg-[#111111] border border-white/10 rounded-xl z-20 overflow-hidden max-h-40 overflow-y-auto">
                        {custResults.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedCustomer(c);
                              setHeaderForm(prev => ({
                                ...prev,
                                customerName: c.full_name,
                                customerPhone: c.phone || '',
                              }));
                              setShowCustResults(false);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
                          >
                            <p className="text-sm text-white font-bold">{c.full_name}</p>
                            <p className="text-xs text-on-surface-variant/50 font-data-sm">{c.phone}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Linked customer vehicles */}
              {selectedCustomer && customerVehicles && customerVehicles.length > 0 && (
                <div>
                  <label className="block font-label-caps text-[10px] text-on-surface-variant/60 uppercase tracking-wider mb-1.5">Select Customer Vehicle</label>
                  <select
                    value={selectedVehicle?.id || ''}
                    onChange={e => {
                      const v = customerVehicles.find(v => v.id === Number(e.target.value)) || null;
                      setSelectedVehicle(v);
                      if (v) {
                        setHeaderForm(prev => ({
                          ...prev,
                          vehicleDescription: `${v.make} ${v.model} ${v.reg_number ? `[${v.reg_number}]` : ''}`.trim(),
                        }));
                      }
                    }}
                    className="w-full bg-[#0a0a0a] border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40"
                  >
                    <option value="" className="bg-[#111111]">Choose Registered Car…</option>
                    {customerVehicles.map(v => (
                      <option key={v.id} value={v.id} className="bg-[#111111]">
                        {v.make} {v.model} — {v.reg_number || 'No Plate'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Override / Manual fields */}
              <div className="grid grid-cols-2 gap-4">
                {!selectedCustomer && (
                  <>
                    <div>
                      <label className="block font-label-caps text-[10px] text-on-surface-variant/60 uppercase tracking-wider mb-1">Customer Name *</label>
                      <input
                        required
                        value={headerForm.customerName}
                        onChange={e => setHeaderForm(prev => ({ ...prev, customerName: e.target.value }))}
                        placeholder="e.g. Anand Vyas"
                        className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
                      />
                    </div>
                    <div>
                      <label className="block font-label-caps text-[10px] text-on-surface-variant/60 uppercase tracking-wider mb-1">WhatsApp Number *</label>
                      <input
                        required
                        value={headerForm.customerPhone}
                        onChange={e => setHeaderForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                        placeholder="e.g. 9876543210"
                        className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
                      />
                    </div>
                  </>
                )}
                <div className="col-span-2">
                  <label className="block font-label-caps text-[10px] text-on-surface-variant/60 uppercase tracking-wider mb-1">Vehicle Description</label>
                  <input
                    value={headerForm.vehicleDescription}
                    onChange={e => setHeaderForm(prev => ({ ...prev, vehicleDescription: e.target.value }))}
                    placeholder="e.g. Fortuner Black GJ-06-XX-8888"
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-performance-red/40"
                  />
                </div>
                <div>
                  <label className="block font-label-caps text-[10px] text-on-surface-variant/60 uppercase tracking-wider mb-1">Valid Until</label>
                  <input
                    type="date"
                    value={headerForm.validUntil}
                    onChange={e => setHeaderForm(prev => ({ ...prev, validUntil: e.target.value }))}
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
                  />
                </div>
                <div>
                  <label className="block font-label-caps text-[10px] text-on-surface-variant/60 uppercase tracking-wider mb-1">Estimated Total (₹)</label>
                  <input
                    type="number"
                    value={headerForm.grandTotal}
                    onChange={e => setHeaderForm(prev => ({ ...prev, grandTotal: e.target.value }))}
                    placeholder="e.g. 75000"
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
                  />
                </div>
              </div>

              <div>
                <label className="block font-label-caps text-[10px] text-on-surface-variant/60 uppercase tracking-wider mb-1">Internal Notes</label>
                <textarea
                  value={headerForm.notes}
                  onChange={e => setHeaderForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. PPF with 5-year warranty, gloss finish details…"
                  className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40 h-20 resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-white/10 rounded-xl text-xs text-on-surface font-label-caps hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-5 py-2 performance-gradient text-white rounded-xl text-xs font-label-caps tracking-widest hover:shadow-[0_0_15px_rgba(255,43,43,0.3)] disabled:opacity-50 transition-all uppercase"
                >
                  {createMutation.isPending ? 'Proceeding…' : 'Proceed to Whiteboard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="font-display-hero text-display-hero text-on-surface flex items-center gap-3">
            <span className="material-symbols-outlined text-performance-red text-3xl">request_quote</span>
            WHITEBOARD QUOTATIONS
          </h1>
          <p className="font-label-caps text-[10px] text-on-surface-variant/50 tracking-widest uppercase mt-1">
            Handwritten Stylus Docket Tool — GOC Premium Auto Detailing
          </p>
        </div>
        <button
          onClick={handleCreateNew}
          className="performance-gradient text-white font-label-caps text-label-caps px-6 py-3 rounded-xl flex items-center gap-2 hover:shadow-[0_0_25px_rgba(255,43,43,0.35)] transition-all border border-white/10 uppercase tracking-widest"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Whiteboard Quotation
        </button>
      </div>

      {/* ── Tabs & Search Filter ── */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="flex gap-1.5 bg-white/[0.02] border border-white/5 p-1 rounded-xl">
          {['all', 'draft', 'sent', 'accepted', 'rejected'].map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setPage(1); }}
              className={`px-4 py-2 text-[10px] font-label-caps tracking-wider rounded-lg uppercase transition-all ${
                activeTab === tab
                  ? 'bg-performance-red text-white shadow-[0_0_10px_rgba(255,43,43,0.3)]'
                  : 'text-on-surface-variant/50 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2 flex-grow max-w-sm">
          <span className="material-symbols-outlined text-on-surface-variant/40 text-[18px]">search</span>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by quote #, name, or phone…"
            className="bg-transparent border-none outline-none text-white text-sm flex-grow placeholder-on-surface-variant/40 font-data-sm"
          />
        </div>
      </div>

      {/* ── Quotation Grid List ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-panel h-64 rounded-2xl animate-pulse bg-white/[0.01] border-white/5"></div>
          ))}
        </div>
      ) : quotations.length === 0 ? (
        <div className="glass-panel py-16 text-center rounded-2xl flex flex-col items-center justify-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/20 mb-3">draw_abstract</span>
          <p className="text-on-surface-variant/60 font-label-caps text-sm tracking-wider">No whiteboard dockets found</p>
          <p className="text-on-surface-variant/30 text-xs mt-1 font-data-sm">Create a new whiteboard quote to begin stylus illustration</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {quotations.map(qt => {
            const statusCfg = STATUS_CONFIG[qt.status] || STATUS_CONFIG.draft;
            const customerName = qt.customer_name || qt.customer_name_override || 'Walk-in Client';
            const customerPhone = qt.customer_phone || qt.customer_phone_override || '';
            const vehicleDesc = qt.vehicle_name || qt.vehicle_description || 'Other Vehicle';

            return (
              <div key={qt.id} className="glass-panel rounded-2xl flex flex-col overflow-hidden border border-white/5 bg-white/[0.01] hover:border-white/10 transition-all group">
                {/* Visual Snapshot Preview */}
                <div className="relative h-36 bg-[#161616] flex items-center justify-center border-b border-white/5 overflow-hidden">
                  {qt.canvas_snapshot ? (
                    <img
                      src={qt.canvas_snapshot}
                      alt="Canvas Snapshot"
                      className="w-full h-full object-contain bg-white transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex flex-col items-center text-on-surface-variant/30 text-xs uppercase tracking-widest font-label-caps">
                      <span className="material-symbols-outlined text-3xl mb-1 text-on-surface-variant/20">draw</span>
                      Canvas Empty
                    </div>
                  )}
                  {/* Status Indicator */}
                  <span className={`absolute top-3 right-3 text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-lg border font-label-caps flex items-center gap-1.5 ${statusCfg.bg} ${statusCfg.border} ${statusCfg.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`}></span>
                    {statusCfg.label}
                  </span>
                </div>

                {/* Details Section */}
                <div className="p-4 flex-grow space-y-3.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-label-caps text-performance-red tracking-wider font-bold">
                        {qt.quotation_code}
                      </p>
                      <h3 className="text-sm font-bold text-white truncate mt-0.5" title={customerName}>
                        {customerName}
                      </h3>
                      {customerPhone && (
                        <p className="text-xs text-on-surface-variant/50 font-data-sm mt-0.5">{customerPhone}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-label-caps text-on-surface-variant/40 tracking-wider">Estimated Total</p>
                      <p className="text-sm font-bold text-white font-data-sm mt-0.5">
                        {formatINR(qt.grand_total)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-on-surface-variant/70 border-t border-white/5 pt-3">
                    <span className="material-symbols-outlined text-sm shrink-0">directions_car</span>
                    <span className="truncate" title={vehicleDesc}>{vehicleDesc}</span>
                    {qt.reg_number && <span className="font-mono text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-white shrink-0">{qt.reg_number}</span>}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] text-on-surface-variant/40 font-label-caps tracking-wider border-t border-white/5 pt-3">
                    <div>
                      <p>Created</p>
                      <p className="text-white/60 font-data-sm mt-0.5">{formatDate(qt.created_at)}</p>
                    </div>
                    <div>
                      <p>Valid Until</p>
                      <p className="text-white/60 font-data-sm mt-0.5">
                        {qt.valid_until ? formatDate(qt.valid_until) : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="p-3 bg-black/30 border-t border-white/5 flex gap-2">
                  <button
                    onClick={() => handleOpenWhiteboardForExisting(qt)}
                    className="flex-grow flex items-center justify-center gap-1 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl text-xs text-white font-label-caps tracking-widest transition-all"
                    title="Edit Whiteboard Drawing"
                  >
                    <span className="material-symbols-outlined text-sm">stylus</span>
                    Draw
                  </button>

                  <button
                    onClick={() => generatePDFMutation.mutate(qt.id)}
                    disabled={generatePDFMutation.isPending}
                    className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-on-surface-variant/80 hover:text-white transition-colors"
                    title="Generate PDF Report"
                  >
                    <span className="material-symbols-outlined text-base">receipt_long</span>
                  </button>

                  <button
                    onClick={() => sendWhatsAppMutation.mutate(qt.id)}
                    disabled={sendWhatsAppMutation.isPending}
                    className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-green-400 hover:text-green-300 transition-colors"
                    title="Send Quote via WhatsApp"
                  >
                    <span className="material-symbols-outlined text-base">chat</span>
                  </button>

                  {isPowerUser && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to delete quotation ${qt.quotation_code}?`)) {
                          deleteMutation.mutate(qt.id);
                        }
                      }}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-400 hover:text-red-300 transition-colors animate-all"
                      title="Delete Quotation"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination controls ── */}
      {meta && meta.totalPages > 1 && (
        <div className="flex justify-between items-center bg-white/[0.01] border border-white/5 p-4 rounded-xl">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="px-4 py-2 border border-white/10 rounded-lg text-xs text-white hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            Prev
          </button>
          <span className="text-xs text-on-surface-variant/60 font-data-sm">
            Page {page} of {meta.totalPages} ({meta.total} Total)
          </span>
          <button
            disabled={page === meta.totalPages}
            onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
            className="px-4 py-2 border border-white/10 rounded-lg text-xs text-white hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
