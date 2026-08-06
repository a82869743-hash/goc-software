import React, { useState, useCallback, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { quotationsAPI, WhiteboardQuotation, CreateQuotationPayload } from '../api/quotations';
import { customersAPI, vehiclesAPI } from '../api/customers';
import type { Customer, Vehicle } from '../types';
import toast from 'react-hot-toast';
import { formatINR, formatDate, getBackendURL } from '../utils/helpers';
import { useAuthStore } from '../stores/authStore';
import { carDataset } from '../utils/carDataset';
import { usePermissions } from '../utils/usePermissions';

const getVehicleDetails = (qt: WhiteboardQuotation) => {
  if (qt.vehicle_name) {
    return {
      description: qt.vehicle_name,
      regNumber: qt.reg_number || ''
    };
  }
  if (!qt.vehicle_description) {
    return { description: 'Other Vehicle', regNumber: '' };
  }
  try {
    if (qt.vehicle_description.trim().startsWith('{')) {
      const parsed = JSON.parse(qt.vehicle_description);
      return {
        description: `${parsed.brand || ''} ${parsed.model || ''}`.trim() || 'Other Vehicle',
        regNumber: parsed.reg_number || ''
      };
    }
  } catch (e) {
    // ignore
  }
  return {
    description: qt.vehicle_description,
    regNumber: ''
  };
};

// ── Status badge config ───────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  draft:    { label: 'Draft',    color: 'text-gray-400',   bg: 'bg-gray-500/10',   border: 'border-gray-500/20',   dot: 'bg-gray-500' },
  sent:     { label: 'Sent',     color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   dot: 'bg-blue-400 animate-pulse' },
  accepted: { label: 'Accepted', color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  dot: 'bg-green-400' },
  rejected: { label: 'Rejected', color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    dot: 'bg-red-500' },
  expired:  { label: 'Expired',  color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', dot: 'bg-orange-400' },
};

// ── Inner canvas toolbar — uses Excalidraw API ref ──────────
function CanvasToolbar({
  excalidrawAPI,
  onSave,
  onUndo,
  onRedo,
  onClear,
  onExit,
  isSaving,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onSave: (canvasData: string, snapshotBase64: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExit: () => void;
  isSaving: boolean;
}) {
  const handleSave = useCallback(async () => {
    if (!excalidrawAPI) return;
    const elements = excalidrawAPI.getSceneElements();
    const appState = excalidrawAPI.getAppState();
    const files = excalidrawAPI.getFiles();
    const canvasData = JSON.stringify({ elements, appState: { viewBackgroundColor: appState.viewBackgroundColor }, files });
    try {
      let snapshotBase64 = '';
      if (elements.length > 0) {
        const blob = await exportToBlob({
          elements,
          appState: { ...appState, exportWithDarkMode: false },
          files,
          mimeType: 'image/png',
          exportPadding: 20,
        });
        snapshotBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
      onSave(canvasData, snapshotBase64);
    } catch (err) {
      console.error('Canvas export error:', err);
      onSave(canvasData, '');
    }
  }, [excalidrawAPI, onSave]);

  return (
    <div className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4 z-50 flex flex-wrap gap-1.5 sm:gap-2 max-w-[calc(100%-1.5rem)]">
      <button
        type="button"
        onClick={onExit}
        className="p-2 sm:px-3 sm:py-2 bg-[#222222] hover:bg-[#333333] border border-red-500/30 rounded-lg text-xs font-label-caps transition-all shadow-sm flex items-center justify-center cursor-pointer gap-1.5 hover:shadow-[0_0_10px_rgba(255,43,43,0.2)]"
        title="Exit / Go Back"
        style={{ color: '#ff2b2b' }}
      >
        <span className="material-symbols-outlined text-sm" style={{ color: '#ff2b2b' }}>arrow_back</span>
        <span style={{ color: '#ff2b2b' }}>Exit</span>
      </button>
      <button
        type="button"
        onClick={onClear}
        className="p-2 sm:px-3 sm:py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-label-caps hover:bg-red-100 transition-all shadow-sm flex items-center justify-center cursor-pointer"
        title="Clear Canvas"
      >
        <span className="material-symbols-outlined text-sm">delete_sweep</span>
      </button>
      <button
        type="button"
        onClick={onUndo}
        className="p-2 sm:px-3 sm:py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-xs text-white font-label-caps transition-all shadow-sm flex items-center justify-center cursor-pointer"
        title="Undo (Ctrl+Z)"
      >
        <span className="material-symbols-outlined text-sm">undo</span>
      </button>
      <button
        type="button"
        onClick={onRedo}
        className="p-2 sm:px-3 sm:py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-xs text-white font-label-caps transition-all shadow-sm flex items-center justify-center cursor-pointer"
        title="Redo (Ctrl+Y)"
      >
        <span className="material-symbols-outlined text-sm">redo</span>
      </button>
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="px-3 sm:px-4 py-2 performance-gradient border border-red-600/30 rounded-lg text-xs text-white font-label-caps hover:shadow-[0_0_15px_rgba(255,43,43,0.3)] transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
      >
        <span className="material-symbols-outlined text-sm">{isSaving ? 'hourglass_top' : 'save'}</span>
        <span className="hidden sm:inline">{isSaving ? 'Saving…' : 'Save Canvas'}</span>
      </button>
    </div>
  );
}

// ── Manual Quotation Items Editor Modal ───────────────────
interface ManualEditorModalProps {
  editingId: number | null;
  initialItems: any[];
  initialGST: boolean;
  initialDiscountType: 'fixed' | 'percentage';
  initialDiscountValue: number;
  customerHeader: {
    customerName: string;
    customerPhone: string;
    vehicleDescription: string;
    validUntil: string;
    notes: string;
  };
  onSave: (payload: any) => void;
  onDiscard: () => void;
  onClose: () => void;
  isSaving: boolean;
}

function ManualEditorModal({
  initialItems,
  initialGST,
  initialDiscountType,
  initialDiscountValue,
  customerHeader,
  onSave,
  onDiscard,
  onClose,
  isSaving,
}: ManualEditorModalProps) {
  const [items, setItems] = useState<Array<{ description: string; qty: number; rate: number; amount: number }>>(
    initialItems && initialItems.length > 0 ? initialItems : [{ description: '', qty: 1, rate: 0, amount: 0 }]
  );
  const [applyGST, setApplyGST] = useState(initialGST);
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>(initialDiscountType);
  const [discountValue, setDiscountValue] = useState(initialDiscountValue);

  const addItemRow = () => {
    setItems([...items, { description: '', qty: 1, rate: 0, amount: 0 }]);
  };

  const removeItemRow = (index: number) => {
    const next = [...items];
    next.splice(index, 1);
    setItems(next.length === 0 ? [{ description: '', qty: 1, rate: 0, amount: 0 }] : next);
  };

  const handleItemChange = (index: number, field: string, val: any) => {
    const next = [...items];
    const item = { ...next[index], [field]: val };
    if (field === 'qty' || field === 'rate') {
      const q = field === 'qty' ? Number(val) : Number(item.qty);
      const r = field === 'rate' ? Number(val) : Number(item.rate);
      item.amount = Math.round(q * r * 100) / 100;
    }
    next[index] = item;
    setItems(next);
  };

  // Calculations
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [items]);

  const discountAmount = useMemo(() => {
    if (discountType === 'percentage') {
      return Math.round((subtotal * (Number(discountValue) / 100)) * 100) / 100;
    }
    return Number(discountValue) || 0;
  }, [subtotal, discountType, discountValue]);

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const gstAmount = applyGST ? Math.round((taxableAmount * 0.18) * 100) / 100 : 0;
  const grandTotal = taxableAmount + gstAmount;

  const handleConfirmSave = () => {
    const validItems = items.filter(it => it.description.trim() !== '');
    if (validItems.length === 0) {
      toast.error('Please add at least one item with description.');
      return;
    }
    onSave({
      is_manual: 1,
      manual_items: JSON.stringify(validItems),
      subtotal,
      discount_type: discountType,
      discount_value: discountValue,
      discount_amount: discountAmount,
      apply_gst: applyGST ? 1 : 0,
      gst_amount: gstAmount,
      grand_total: grandTotal,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#111111] border border-white/10 rounded-2xl p-6 w-full max-w-4xl shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col my-auto relative animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center pb-2 border-b border-white/5">
          <div>
            <h3 className="font-label-caps text-sm text-white tracking-widest">EDIT MANUAL QUOTATION ITEMS</h3>
            <p className="text-xs text-on-surface-variant/50 font-data-sm">
              Customer: {customerHeader.customerName} | Vehicle: {customerHeader.vehicleDescription}
            </p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant/40 hover:text-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Form fields */}
        <div className="flex-grow overflow-x-auto min-h-[200px] py-2">
          <table className="w-full text-left border-collapse min-w-[600px] text-xs">
            <thead>
              <tr className="bg-black/30 text-on-surface-variant/60 font-label-caps uppercase tracking-wider border-b border-white/5">
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 w-20 text-center">Qty</th>
                <th className="py-2.5 px-3 w-32 text-right">Rate (₹)</th>
                <th className="py-2.5 px-3 w-36 text-right">Amount (₹)</th>
                <th className="py-2.5 px-3 w-16 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02] text-white">
              {items.map((item, index) => (
                <tr key={index} className="hover:bg-white/[0.01]">
                  <td className="py-2 px-2">
                    <input
                      value={item.description}
                      onChange={e => handleItemChange(index, 'description', e.target.value)}
                      placeholder="e.g. PPF wrap bonnet"
                      className="w-full bg-white/[0.02] border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-performance-red/40"
                    />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <input
                      type="number"
                      value={item.qty}
                      onChange={e => handleItemChange(index, 'qty', e.target.value)}
                      min="0.01"
                      step="any"
                      className="w-full bg-white/[0.02] border border-white/[0.07] rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-performance-red/40 text-center"
                    />
                  </td>
                  <td className="py-2 px-2 text-right">
                    <input
                      type="number"
                      value={item.rate}
                      onChange={e => handleItemChange(index, 'rate', e.target.value)}
                      min="0"
                      step="any"
                      className="w-full bg-white/[0.02] border border-white/[0.07] rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-performance-red/40 text-right font-mono"
                    />
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-medium pr-4">
                    ₹{Number(item.amount).toLocaleString('en-IN')}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeItemRow(index)}
                      className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                      title="Remove Row"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={addItemRow}
            className="px-4 py-2 border border-dashed border-white/10 rounded-xl text-xs text-on-surface hover:text-white hover:border-white/20 transition-all flex items-center gap-1.5 font-label-caps"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Add Item Row
          </button>
        </div>

        {/* Calculations / Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
          {/* Discount & GST Controls */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-label-caps text-[9px] text-on-surface-variant/60 uppercase tracking-wider mb-1">
                  Discount Type
                </label>
                <select
                  value={discountType}
                  onChange={e => { setDiscountType(e.target.value as any); setDiscountValue(0); }}
                  className="w-full bg-[#0a0a0a] border border-white/[0.07] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-performance-red/40"
                >
                  <option value="fixed">Fixed Amount (₹)</option>
                  <option value="percentage">Percentage (%)</option>
                </select>
              </div>
              <div>
                <label className="block font-label-caps text-[9px] text-on-surface-variant/60 uppercase tracking-wider mb-1">
                  Discount Value
                </label>
                <input
                  type="number"
                  value={discountValue}
                  onChange={e => setDiscountValue(Number(e.target.value))}
                  min="0"
                  className="w-full bg-white/[0.02] border border-white/[0.07] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-performance-red/40 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="apply-gst-checkbox"
                checked={applyGST}
                onChange={e => setApplyGST(e.target.checked)}
                className="w-4 h-4 rounded border-white/10 bg-white/5 text-performance-red focus:ring-0 focus:ring-offset-0"
              />
              <label htmlFor="apply-gst-checkbox" className="text-xs text-on-surface-variant/80 select-none cursor-pointer">
                Apply GST (18% CGST/SGST)
              </label>
            </div>
          </div>

          {/* Pricing Totals */}
          <div className="bg-[#151515] p-4 rounded-xl space-y-2 border border-white/5 text-xs">
            <div className="flex justify-between text-on-surface-variant">
              <span>Subtotal:</span>
              <span className="font-mono text-white">₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-red-400">
                <span>Discount:</span>
                <span className="font-mono">-₹{discountAmount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between text-on-surface-variant border-t border-white/5 pt-2">
              <span>Taxable Value:</span>
              <span className="font-mono text-white">₹{taxableAmount.toLocaleString('en-IN')}</span>
            </div>
            {applyGST && (
              <div className="flex justify-between text-on-surface-variant">
                <span>GST (18%):</span>
                <span className="font-mono text-white">₹{gstAmount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-white/10 pt-2 text-sm font-bold">
              <span className="text-performance-red">Grand Total:</span>
              <span className="font-mono text-performance-red">₹{grandTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end pt-2 border-t border-white/5 animate-fade-in">
          <button
            type="button"
            onClick={onDiscard}
            className="px-4 py-2 border border-white/10 rounded-xl text-xs text-on-surface font-label-caps hover:bg-white/5 transition-colors"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleConfirmSave}
            disabled={isSaving}
            className="px-5 py-2 performance-gradient text-white rounded-xl text-xs font-label-caps tracking-widest hover:shadow-[0_0_15px_rgba(255,43,43,0.3)] disabled:opacity-50 transition-all uppercase"
          >
            {isSaving ? 'Saving…' : 'Save Quotation'}
          </button>
        </div>
      </div>
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
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);

  const handleExcalidrawAPI = useCallback((api: ExcalidrawImperativeAPI) => {
    setExcalidrawAPI(api);
  }, []);

  const dispatchKeyCombination = useCallback((key: string, code: string) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const event = new KeyboardEvent('keydown', {
      key,
      code,
      ctrlKey: !isMac,
      metaKey: isMac,
      bubbles: true,
      cancelable: true,
    });
    const target = document.querySelector('.excalidraw') || document.querySelector('.excalidraw-canvas') || window;
    target.dispatchEvent(event);
  }, []);

  const handleUndo = useCallback(() => {
    dispatchKeyCombination('z', 'KeyZ');
  }, [dispatchKeyCombination]);

  const handleRedo = useCallback(() => {
    dispatchKeyCombination('y', 'KeyY');
  }, [dispatchKeyCombination]);

  // Parse initial data for Excalidraw initialData prop
  const parsedInitialData = useMemo(() => {
    if (!initialCanvasData) return undefined;
    try {
      const parsed = JSON.parse(initialCanvasData);
      if (parsed && Array.isArray(parsed.elements)) {
        return {
          elements: parsed.elements,
          appState: parsed.appState || {},
          files: parsed.files || undefined,
        };
      }
      console.warn('Initial canvas data is not in Excalidraw format, starting with empty canvas');
      return undefined;
    } catch (err) {
      console.error('Failed to parse initial canvas data:', err);
      return undefined;
    }
  }, [initialCanvasData]);

  const handleConfirmSave = async () => {
    if (!excalidrawAPI) {
      onClose();
      return;
    }
    const elements = excalidrawAPI.getSceneElements();
    const appState = excalidrawAPI.getAppState();
    const files = excalidrawAPI.getFiles();
    const canvasData = JSON.stringify({ elements, appState: { viewBackgroundColor: appState.viewBackgroundColor }, files });
    try {
      let snapshotBase64 = '';
      if (elements.length > 0) {
        const blob = await exportToBlob({
          elements,
          appState: { ...appState, exportWithDarkMode: false },
          files,
          mimeType: 'image/png',
          exportPadding: 20,
        });
        snapshotBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
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
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">
      {/* Modal Header Bar */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-3 bg-white border-b border-gray-200 shrink-0 shadow-sm relative z-50">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => setShowConfirmClose(true)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-black transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span className="font-label-caps text-xs text-gray-800">Back</span>
          </button>
          <div>
            <h2 className="font-display-hero text-sm sm:text-base text-gray-900 font-bold tracking-tight italic">
              WHITEBOARD <span className="text-performance-red not-italic font-light">QUOTATION</span>
            </h2>
            <p className="font-label-caps text-[8px] sm:text-[9px] text-gray-500 tracking-widest mt-0.5 truncate max-w-[150px] sm:max-w-none">
              {customerHeader.customerName || 'New Quotation'} · {customerHeader.vehicleDescription || 'Vehicle N/A'}
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-xs font-data-sm text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-performance-red">stylus</span>
            Use stylus or touch to draw details
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Auto-saves on "Save Canvas"
          </span>
        </div>
      </div>

      {/* Excalidraw Canvas */}
      <div className="flex-1 relative overflow-hidden bg-white" style={{ touchAction: 'none' }}>
        <Excalidraw
          key={editingId ?? 'new'}
          excalidrawAPI={handleExcalidrawAPI}
          initialData={parsedInitialData}
          handleKeyboardGlobally={true}
          UIOptions={{
            canvasActions: {
              saveToActiveFile: false,
              loadScene: false,
              export: false,
            },
          }}
        />
        <CanvasToolbar
          excalidrawAPI={excalidrawAPI}
          onSave={onCanvasSaved}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClear={() => setShowConfirmClear(true)}
          onExit={() => setShowConfirmClose(true)}
          isSaving={isSaving}
        />
      </div>

      {/* ── Save or Discard Confirmation Overlay ── */}
      {showConfirmClose && (
        <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 text-center">
            <span className="material-symbols-outlined text-amber-500 text-4xl">warning</span>
            <div>
              <h3 className="font-label-caps text-sm text-white font-bold tracking-widest">SAVE AND EXIT DRAWING?</h3>
              <p className="text-xs text-on-surface-variant/70 font-data-sm mt-1.5">
                Do you want to save your drawings before exiting, or discard your unsaved edits?
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleConfirmSave}
                disabled={isSaving}
                className="w-full py-2.5 bg-performance-red hover:bg-performance-red/90 text-white rounded-xl text-xs font-label-caps tracking-widest transition-all uppercase cursor-pointer"
              >
                Save &amp; Exit
              </button>
              <button
                onClick={handleConfirmDiscard}
                className="w-full py-2.5 bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 rounded-xl text-xs font-label-caps tracking-widest transition-colors uppercase cursor-pointer"
              >
                Discard &amp; Exit
              </button>
              <button
                onClick={() => setShowConfirmClose(false)}
                className="w-full py-2.5 border border-white/10 text-on-surface hover:text-white rounded-xl text-xs font-label-caps tracking-widest hover:bg-white/5 transition-colors uppercase cursor-pointer"
              >
                Cancel / Keep Drawing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Clear Canvas Confirmation Overlay ── */}
      {showConfirmClear && (
        <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 text-center">
            <span className="material-symbols-outlined text-red-500 text-4xl animate-bounce">delete_sweep</span>
            <div>
              <h3 className="font-label-caps text-sm text-white font-bold tracking-widest">CLEAR WHITEBOARD?</h3>
              <p className="text-xs text-on-surface-variant/70 font-data-sm mt-1.5">
                This will erase all drawings on the canvas. This action cannot be undone.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => {
                  excalidrawAPI?.resetScene();
                  setShowConfirmClear(false);
                }}
                className="w-full py-2.5 bg-performance-red hover:bg-performance-red/90 text-white rounded-xl text-xs font-label-caps tracking-widest transition-all uppercase cursor-pointer"
              >
                Yes, Clear All
              </button>
              <button
                onClick={() => setShowConfirmClear(false)}
                className="w-full py-2.5 border border-white/10 text-on-surface hover:text-white rounded-xl text-xs font-label-caps tracking-widest hover:bg-white/5 transition-colors uppercase cursor-pointer"
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
  const { canDelete } = usePermissions();
  const staff = useAuthStore(s => s.staff);
  const isPowerUser = staff?.role === 'admin' || staff?.role === 'manager';

  // Tab filter and list paging
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showRecycleBin, setShowRecycleBin] = useState(false);

  // Custom Delete target states
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleteTargetCode, setDeleteTargetCode] = useState<string | null>(null);
  const [isPermanentDelete, setIsPermanentDelete] = useState(false);

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
    carBrand: '',
    carModel: '',
    carNumber: '',
    validUntil: (() => { const d = new Date(); d.setDate(d.getDate() + 15); return d.toISOString().split('T')[0]; })(),
    notes: '',
    grandTotal: '',
  });

  // Whiteboard overlay modal state
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [pendingQuotationId, setPendingQuotationId] = useState<number | null>(null);

  // Manual Quotation States
  const [quotationMode, setQuotationMode] = useState<'whiteboard' | 'manual'>('whiteboard');
  const [showManualEditor, setShowManualEditor] = useState(false);
  const [manualItems, setManualItems] = useState<Array<{ description: string; qty: number; rate: number; amount: number }>>([]);
  const [manualGST, setManualGST] = useState(true);
  const [manualDiscountType, setManualDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [manualDiscountValue, setManualDiscountValue] = useState(0);

  // ── Queries ──
  const { data: quotationsRes, isLoading } = useQuery({
    queryKey: ['quotations', activeTab, search, page, showRecycleBin],
    queryFn: () => quotationsAPI.list({
      status: showRecycleBin ? undefined : (activeTab === 'all' ? undefined : activeTab),
      search: search || undefined,
      page,
      limit: 20,
      trash: showRecycleBin,
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
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      setPendingQuotationId(res.data.id);
      setEditingId(res.data.id);
      if (res.data.is_manual === 1) {
        toast.success(`Draft Quotation ${res.data.quotation_code} created! Opening items editor…`);
        setManualItems([]);
        setManualGST(true);
        setManualDiscountType('fixed');
        setManualDiscountValue(0);
        setShowManualEditor(true);
      } else {
        toast.success(`Draft Quotation ${res.data.quotation_code} created! Opening whiteboard…`);
        setEditingCanvasData(null);
        setShowWhiteboard(true);
      }
    },
    onError: () => toast.error('Failed to create quotation.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => quotationsAPI.update(id, payload),
    onSuccess: (res, variables) => {
      toast.success('Quotation updated successfully!');
      setShowManualEditor(false);
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      if (variables.id) {
        generatePDFMutation.mutate(variables.id);
      }
    },
    onError: () => toast.error('Failed to save quotation.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => quotationsAPI.delete(id),
    onSuccess: () => {
      toast.success('Quotation deleted successfully.');
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
    onError: () => toast.error('Failed to delete.'),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => quotationsAPI.restore(id),
    onSuccess: () => {
      toast.success('Quotation restored successfully.');
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
    onError: () => toast.error('Failed to restore quotation.'),
  });

  const deletePermanentMutation = useMutation({
    mutationFn: (id: number) => quotationsAPI.deletePermanent(id),
    onSuccess: () => {
      toast.success('Quotation permanently deleted.');
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
    onError: () => toast.error('Failed to delete permanently.'),
  });

  const generatePDFMutation = useMutation({
    mutationFn: (id: number) => quotationsAPI.generatePDF(id),
    onSuccess: (res) => {
      toast.success('PDF generated successfully!');
      window.open(getBackendURL(`${res.data.pdf_url}?t=${Date.now()}`), '_blank');
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
  const handleCreateNew = (defaultMode: 'whiteboard' | 'manual' = 'whiteboard') => {
    setEditingId(null);
    setPendingQuotationId(null);
    setEditingCanvasData(null);
    setSelectedCustomer(null);
    setSelectedVehicle(null);
    setCustSearch('');
    setQuotationMode(defaultMode);
    setShowManualEditor(false);
    setManualItems([]);
    setManualGST(true);
    setManualDiscountType('fixed');
    setManualDiscountValue(0);
    setHeaderForm({
      customerName: '',
      customerPhone: '',
      carBrand: '',
      carModel: '',
      carNumber: '',
      validUntil: (() => { const d = new Date(); d.setDate(d.getDate() + 15); return d.toISOString().split('T')[0]; })(),
      notes: '',
      grandTotal: '',
    });
    setShowForm(true);
  };

  const handleEditHeader = (qt: WhiteboardQuotation) => {
    setEditingId(qt.id);
    setPendingQuotationId(null);
    setEditingCanvasData(qt.canvas_data);
    setSelectedCustomer(qt.customer_id ? { id: qt.customer_id, full_name: qt.customer_name || '', phone: qt.customer_phone || '' } as any : null);
    setSelectedVehicle(qt.vehicle_id ? { id: qt.vehicle_id, make: qt.vehicle_make || '', model: qt.vehicle_model || '', reg_number: qt.reg_number || '' } as any : null);
    setCustSearch('');
    setQuotationMode(qt.is_manual === 1 ? 'manual' : 'whiteboard');
    
    let brand = qt.vehicle_make || '';
    let model = qt.vehicle_model || '';
    let regNum = qt.reg_number || '';

    if (!qt.vehicle_id && qt.vehicle_description) {
      try {
        if (qt.vehicle_description.trim().startsWith('{')) {
          const parsed = JSON.parse(qt.vehicle_description);
          brand = parsed.brand || '';
          model = parsed.model || '';
          regNum = parsed.reg_number || '';
        } else {
          brand = qt.vehicle_description;
        }
      } catch (e) {
        brand = qt.vehicle_description;
      }
    }

    setHeaderForm({
      customerName: qt.customer_name || qt.customer_name_override || '',
      customerPhone: qt.customer_phone || qt.customer_phone_override || '',
      carBrand: brand,
      carModel: model,
      carNumber: regNum,
      validUntil: qt.valid_until?.split('T')[0] || '',
      notes: qt.notes || '',
      grandTotal: qt.grand_total ? String(qt.grand_total) : '',
    });
    setShowForm(true);
  };

  const handleOpenWhiteboardForExisting = (qt: WhiteboardQuotation) => {
    setEditingId(qt.id);
    setPendingQuotationId(qt.id);
    setEditingCanvasData(qt.canvas_data);

    let brand = qt.vehicle_make || '';
    let model = qt.vehicle_model || '';
    let regNum = qt.reg_number || '';

    if (!qt.vehicle_id && qt.vehicle_description) {
      try {
        if (qt.vehicle_description.trim().startsWith('{')) {
          const parsed = JSON.parse(qt.vehicle_description);
          brand = parsed.brand || '';
          model = parsed.model || '';
          regNum = parsed.reg_number || '';
        } else {
          brand = qt.vehicle_description;
        }
      } catch (e) {
        brand = qt.vehicle_description;
      }
    }

    setHeaderForm({
      customerName: qt.customer_name || qt.customer_name_override || '',
      customerPhone: qt.customer_phone || qt.customer_phone_override || '',
      carBrand: brand,
      carModel: model,
      carNumber: regNum,
      validUntil: qt.valid_until?.split('T')[0] || '',
      notes: qt.notes || '',
      grandTotal: qt.grand_total ? String(qt.grand_total) : '',
    });
    setShowWhiteboard(true);
  };

  const handleOpenManualEditorForExisting = (qt: WhiteboardQuotation) => {
    setEditingId(qt.id);
    setPendingQuotationId(qt.id);
    
    let items = [];
    try {
      items = typeof qt.manual_items === 'string' ? JSON.parse(qt.manual_items) : (qt.manual_items || []);
    } catch (e) {
      items = [];
    }
    setManualItems(items);
    setManualGST(qt.apply_gst);
    setManualDiscountType(qt.discount_type || 'fixed');
    setManualDiscountValue(qt.discount_value || 0);

    let brand = qt.vehicle_make || '';
    let model = qt.vehicle_model || '';
    let regNum = qt.reg_number || '';

    if (!qt.vehicle_id && qt.vehicle_description) {
      try {
        if (qt.vehicle_description.trim().startsWith('{')) {
          const parsed = JSON.parse(qt.vehicle_description);
          brand = parsed.brand || '';
          model = parsed.model || '';
          regNum = parsed.reg_number || '';
        } else {
          brand = qt.vehicle_description;
        }
      } catch (e) {
        brand = qt.vehicle_description;
      }
    }

    setHeaderForm({
      customerName: qt.customer_name || qt.customer_name_override || '',
      customerPhone: qt.customer_phone || qt.customer_phone_override || '',
      carBrand: brand,
      carModel: model,
      carNumber: regNum,
      validUntil: qt.valid_until?.split('T')[0] || '',
      notes: qt.notes || '',
      grandTotal: qt.grand_total ? String(qt.grand_total) : '',
    });
    
    setShowManualEditor(true);
  };

  const handleSaveHeader = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer && (!headerForm.customerName || !headerForm.customerPhone)) {
      toast.error('Please input customer name and phone contact details.');
      return;
    }
    if (!headerForm.carBrand || !headerForm.carModel || !headerForm.carNumber) {
      toast.error('Please input Car Brand, Car Model, and Car Number.');
      return;
    }

    const isEdit = !!editingId;

    const payload: any = {
      customer_id: selectedCustomer?.id || null,
      vehicle_id: selectedVehicle?.id || null,
      customer_name_override: !selectedCustomer ? headerForm.customerName : null,
      customer_phone_override: !selectedCustomer ? headerForm.customerPhone : null,
      vehicle_description: JSON.stringify({
        brand: headerForm.carBrand,
        model: headerForm.carModel,
        reg_number: headerForm.carNumber
      }),
      valid_until: headerForm.validUntil,
      notes: headerForm.notes || null,
      is_manual: quotationMode === 'manual' ? 1 : 0,
    };

    if (!isEdit) {
      payload.grand_total = quotationMode === 'whiteboard' ? (headerForm.grandTotal ? Number(headerForm.grandTotal) : 0) : 0;
      payload.manual_items = quotationMode === 'manual' ? '[]' : null;
      createMutation.mutate(payload);
    } else {
      if (quotationMode === 'whiteboard') {
        payload.grand_total = headerForm.grandTotal ? Number(headerForm.grandTotal) : 0;
      }
      updateMutation.mutate({ id: editingId, payload });
    }
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
          customerHeader={{
            customerName: headerForm.customerName,
            customerPhone: headerForm.customerPhone,
            vehicleDescription: `${headerForm.carBrand} ${headerForm.carModel} ${headerForm.carNumber ? `[${headerForm.carNumber}]` : ''}`.trim(),
            validUntil: headerForm.validUntil,
            notes: headerForm.notes,
            grandTotal: headerForm.grandTotal,
          }}
          onCanvasSaved={handleCanvasSaved}
          onDiscard={() => {
            const isNew = !editingId;
            const id = pendingQuotationId || editingId;
            if (isNew && id) deleteMutation.mutate(id);
            handleCloseWhiteboard();
          }}
          onClose={handleCloseWhiteboard}
          isSaving={updateMutation.isPending}
        />
      )}

      {/* ── Manual items editor modal ── */}
      {showManualEditor && (
        <ManualEditorModal
          editingId={pendingQuotationId || editingId}
          initialItems={manualItems}
          initialGST={manualGST}
          initialDiscountType={manualDiscountType}
          initialDiscountValue={manualDiscountValue}
          customerHeader={{
            customerName: headerForm.customerName,
            customerPhone: headerForm.customerPhone,
            vehicleDescription: `${headerForm.carBrand} ${headerForm.carModel} ${headerForm.carNumber ? `[${headerForm.carNumber}]` : ''}`.trim(),
            validUntil: headerForm.validUntil,
            notes: headerForm.notes,
          }}
          onSave={(payload) => {
            const id = pendingQuotationId || editingId;
            if (id) {
              updateMutation.mutate({ id, payload });
            }
          }}
          onDiscard={() => {
            const isNew = !editingId;
            const id = pendingQuotationId || editingId;
            if (isNew && id) deleteMutation.mutate(id);
            setShowManualEditor(false);
            setPendingQuotationId(null);
            setEditingId(null);
          }}
          onClose={() => {
            setShowManualEditor(false);
            setPendingQuotationId(null);
            setEditingId(null);
          }}
          isSaving={updateMutation.isPending}
        />
      )}

      {/* ── New Quotation customer header modal ── */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 sm:p-6 overflow-y-auto"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-[#111111] border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar my-auto relative animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-label-caps text-sm text-white tracking-widest">
                  {editingId ? 'EDIT QUOTATION DETAILS' : 'NEW QUOTATION'}
                </h3>
                <p className="text-xs text-on-surface-variant/50 font-data-sm">Set customer context first, then input details</p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="text-on-surface-variant/40 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveHeader} className="space-y-4">
              {/* Quotation Mode Selection */}
              <div className="space-y-1">
                <label className="block font-label-caps text-[10px] text-on-surface-variant/60 uppercase tracking-wider mb-1">
                  Quotation Mode
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setQuotationMode('whiteboard')}
                    className={`flex-1 py-2 rounded-xl text-xs font-label-caps border transition-all ${
                      quotationMode === 'whiteboard'
                        ? 'bg-performance-red border-performance-red text-white'
                        : 'bg-white/5 border-white/10 text-on-surface-variant/70 hover:text-white'
                    }`}
                  >
                    Whiteboard (Draw)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuotationMode('manual')}
                    className={`flex-1 py-2 rounded-xl text-xs font-label-caps border transition-all ${
                      quotationMode === 'manual'
                        ? 'bg-performance-red border-performance-red text-white'
                        : 'bg-white/5 border-white/10 text-on-surface-variant/70 hover:text-white'
                    }`}
                  >
                    Manual (Add Items)
                  </button>
                </div>
              </div>
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
                          carBrand: v.make || '',
                          carModel: v.model || '',
                          carNumber: v.reg_number || '',
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div>
                  <label className="block font-label-caps text-[10px] text-on-surface-variant/60 uppercase tracking-wider mb-1">Car Brand *</label>
                  <input
                    required
                    list="car-brands-list"
                    value={headerForm.carBrand}
                    onChange={e => setHeaderForm(prev => ({ ...prev, carBrand: e.target.value, carModel: '' }))}
                    placeholder="e.g. Tata, Hyundai"
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
                  />
                  <datalist id="car-brands-list">
                    {carDataset.map(item => (
                      <option key={item.brand} value={item.brand} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block font-label-caps text-[10px] text-on-surface-variant/60 uppercase tracking-wider mb-1">Car Model *</label>
                  <input
                    required
                    list="car-models-list"
                    value={headerForm.carModel}
                    onChange={e => setHeaderForm(prev => ({ ...prev, carModel: e.target.value }))}
                    placeholder="e.g. Nexon, Creta"
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-performance-red/40"
                  />
                  <datalist id="car-models-list">
                    {(() => {
                      const brandData = carDataset.find(
                        c => c.brand.toLowerCase() === headerForm.carBrand.toLowerCase()
                      );
                      return brandData ? brandData.models.map(m => (
                        <option key={m} value={m} />
                      )) : [];
                    })()}
                  </datalist>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-label-caps text-[10px] text-on-surface-variant/60 uppercase tracking-wider mb-1">Car Number *</label>
                  <input
                    required
                    value={headerForm.carNumber}
                    onChange={e => setHeaderForm(prev => ({ ...prev, carNumber: e.target.value }))}
                    placeholder="e.g. GJ-06-XX-8888"
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
                {quotationMode === 'whiteboard' && (
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
                )}
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
                  {createMutation.isPending ? 'Proceeding…' : (quotationMode === 'manual' ? 'Proceed to Items Editor' : 'Proceed to Whiteboard')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="font-display-hero text-lg sm:text-display-hero text-on-surface flex items-center gap-2 sm:gap-3">
            <span className="material-symbols-outlined text-performance-red text-2xl sm:text-3xl">request_quote</span>
            <span className="hidden sm:inline">WHITEBOARD QUOTATIONS</span>
            <span className="sm:hidden">QUOTATIONS</span>
          </h1>
          <p className="font-label-caps text-[9px] sm:text-[10px] text-on-surface-variant/50 tracking-widest uppercase mt-1 hidden sm:block">
            Handwritten Stylus Docket Tool — GOC Premium Auto Detailing
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              setShowRecycleBin(!showRecycleBin);
              setPage(1);
            }}
            className={`px-4 py-2.5 sm:py-3 rounded-xl border flex items-center gap-2 font-label-caps text-[10px] sm:text-xs tracking-widest uppercase transition-all shrink-0 cursor-pointer ${
              showRecycleBin
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {showRecycleBin ? 'assignment' : 'delete_outline'}
            </span>
            {showRecycleBin ? 'Active Quotes' : 'Recycle Bin'}
          </button>
          {!showRecycleBin && (
            <div className="flex gap-2 flex-grow sm:flex-grow-0">
              <button
                onClick={() => handleCreateNew('whiteboard')}
                className="bg-white/5 border border-white/10 text-white font-label-caps text-xs px-4 py-2.5 sm:py-3 rounded-xl flex items-center gap-2 hover:bg-white/10 active:scale-[0.98] transition-all uppercase tracking-widest text-[10px] sm:text-xs justify-center cursor-pointer font-bold"
              >
                <span className="material-symbols-outlined text-[18px]">stylus</span>
                Whiteboard
              </button>
              <button
                onClick={() => handleCreateNew('manual')}
                className="performance-gradient text-white font-label-caps text-xs px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl flex items-center gap-2 hover:shadow-[0_0_25px_rgba(255,43,43,0.35)] active:scale-[0.98] transition-all border border-white/10 uppercase tracking-widest text-[10px] sm:text-xs justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">list_alt</span>
                Manual Quote
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Recycle Bin Alert Banner ── */}
      {showRecycleBin && (
        <div className="glass-panel border-amber-500/20 bg-amber-500/5 p-4 rounded-xl flex items-center gap-3 text-amber-400">
          <span className="material-symbols-outlined">delete_outline</span>
          <div>
            <p className="text-xs font-label-caps font-bold tracking-wider">Recycle Bin</p>
            <p className="text-[11px] text-amber-400/70 font-data-sm mt-0.5">Showing deleted quotations. You can restore them or permanently delete them.</p>
          </div>
        </div>
      )}

      {/* ── Tabs & Search Filter ── */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
        {!showRecycleBin && (
          <div className="flex gap-1 sm:gap-1.5 bg-white/[0.02] border border-white/5 p-1 rounded-xl overflow-x-auto">
            {['all', 'draft', 'sent', 'accepted', 'rejected'].map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setPage(1); }}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 text-[9px] sm:text-[10px] font-label-caps tracking-wider rounded-lg uppercase transition-all whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-performance-red text-white shadow-[0_0_10px_rgba(255,43,43,0.3)]'
                    : 'text-on-surface-variant/50 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2 flex-grow sm:max-w-sm">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-panel h-64 rounded-2xl animate-pulse bg-white/[0.01] border-white/5"></div>
          ))}
        </div>
      ) : quotations.length === 0 ? (
        <div className="glass-panel py-12 sm:py-16 text-center rounded-2xl flex flex-col items-center justify-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/20 mb-3">draw_abstract</span>
          <p className="text-on-surface-variant/60 font-label-caps text-sm tracking-wider">No whiteboard dockets found</p>
          <p className="text-on-surface-variant/30 text-xs mt-1 font-data-sm">Create a new whiteboard quote to begin stylus illustration</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {quotations.map(qt => {
            const statusCfg = STATUS_CONFIG[qt.status] || STATUS_CONFIG.draft;
            const customerName = qt.customer_name || qt.customer_name_override || 'Walk-in Client';
            const customerPhone = qt.customer_phone || qt.customer_phone_override || '';
            const { description: vehicleDesc, regNumber } = getVehicleDetails(qt);

            return (
              <div key={qt.id} className="glass-panel rounded-2xl flex flex-col overflow-hidden border border-white/5 bg-white/[0.01] hover:border-white/10 transition-all group">
                {/* Visual Snapshot Preview */}
                <div className="relative h-36 bg-[#161616] flex flex-col justify-between border-b border-white/5 overflow-hidden p-3.5">
                  {qt.is_manual === 1 ? (
                    <div className="space-y-1 overflow-hidden h-full flex flex-col justify-center">
                      <div className="flex items-center gap-1 text-[9px] font-label-caps text-on-surface-variant/60 tracking-wider mb-1">
                        <span className="material-symbols-outlined text-xs">list_alt</span>
                        Manual Quotation Items
                      </div>
                      {(() => {
                        let items = [];
                        try {
                          items = typeof qt.manual_items === 'string' ? JSON.parse(qt.manual_items) : (qt.manual_items || []);
                        } catch(e) {}
                        if (!Array.isArray(items) || items.length === 0) {
                          return <p className="text-[10px] text-on-surface-variant/40 italic">No items added yet.</p>;
                        }
                        return (
                          <div className="space-y-1 overflow-hidden">
                            {items.slice(0, 2).map((item: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center text-[11px] text-white/80 font-data-sm">
                                <span className="truncate pr-2">{item.description}</span>
                                <span className="shrink-0 font-mono text-[10px] text-on-surface-variant">₹{Number(item.amount).toLocaleString('en-IN')}</span>
                              </div>
                            ))}
                            {items.length > 2 && (
                              <p className="text-[9px] text-performance-red font-label-caps uppercase tracking-wider mt-1">
                                + {items.length - 2} more item(s)
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ) : qt.canvas_snapshot ? (
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
                    {regNumber && <span className="font-mono text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-white shrink-0">{regNumber}</span>}
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
                {showRecycleBin ? (
                  <div className="p-3 bg-black/30 border-t border-white/5 flex gap-2">
                    <button
                      onClick={() => restoreMutation.mutate(qt.id)}
                      disabled={restoreMutation.isPending}
                      className="flex-grow flex items-center justify-center gap-1.5 px-3 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/25 rounded-xl text-xs text-green-400 font-label-caps tracking-widest transition-all cursor-pointer"
                      title="Restore Quotation"
                    >
                      <span className="material-symbols-outlined text-sm">settings_backup_restore</span>
                      Restore
                    </button>
                    <button
                      onClick={() => {
                        setDeleteTargetId(qt.id);
                        setDeleteTargetCode(qt.quotation_code);
                        setIsPermanentDelete(true);
                      }}
                      disabled={deletePermanentMutation.isPending}
                      className="p-2 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 rounded-xl text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                      title="Permanently Delete"
                    >
                      <span className="material-symbols-outlined text-base">delete_forever</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-black/30 border-t border-white/5 flex gap-2">
                    {qt.is_manual === 1 ? (
                      <button
                        onClick={() => handleOpenManualEditorForExisting(qt)}
                        className="flex-grow flex items-center justify-center gap-1 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl text-xs text-white font-label-caps tracking-widest transition-all cursor-pointer"
                        title="Edit Quotation Items"
                      >
                        <span className="material-symbols-outlined text-sm">list_alt</span>
                        Items
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenWhiteboardForExisting(qt)}
                        className="flex-grow flex items-center justify-center gap-1 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl text-xs text-white font-label-caps tracking-widest transition-all cursor-pointer"
                        title="Edit Whiteboard Drawing"
                      >
                        <span className="material-symbols-outlined text-sm">stylus</span>
                        Draw
                      </button>
                    )}

                    <button
                      onClick={() => handleEditHeader(qt)}
                      className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-on-surface-variant/80 hover:text-white transition-colors cursor-pointer"
                      title="Edit Details / Mode"
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                    </button>

                    <button
                      onClick={() => generatePDFMutation.mutate(qt.id)}
                      disabled={generatePDFMutation.isPending}
                      className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-on-surface-variant/80 hover:text-white transition-colors cursor-pointer"
                      title="Generate PDF Report"
                    >
                      <span className="material-symbols-outlined text-base">receipt_long</span>
                    </button>

                    <button
                      onClick={() => {
                        const waPhone = customerPhone.replace(/\D/g, '');
                        const cleanPhone = waPhone.startsWith('91') && waPhone.length > 10 ? waPhone : `91${waPhone}`;
                        const pdfUrl = qt.pdf_url ? (qt.pdf_url.startsWith('http') ? qt.pdf_url : `${window.location.origin.replace('5173', '4000')}${qt.pdf_url}`) : '';
                        const msg = `🙏 Greetings from *God of Ceramic Studio*!\n\nDear *${customerName}*,\n\nPlease find your quotation *${qt.quotation_code}* for ${vehicleDesc}${regNumber ? ` (${regNumber})` : ''}.\n\n💰 *Estimated Total:* ₹${Number(qt.grand_total).toLocaleString('en-IN')}${pdfUrl ? `\n\n📄 *View Quotation PDF:*\n${pdfUrl}` : ''}\n\nKindly review and let us know if you'd like to proceed.\nThank you! 🚗✨`;
                        const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
                        window.open(url, '_blank');
                      }}
                      disabled={!customerPhone}
                      className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-green-400 hover:text-green-300 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Send Quote via WhatsApp"
                    >
                      <span className="material-symbols-outlined text-base">chat</span>
                    </button>

                    {canDelete && (
                      <button
                        onClick={() => {
                          setDeleteTargetId(qt.id);
                          setDeleteTargetCode(qt.quotation_code);
                          setIsPermanentDelete(false);
                        }}
                        disabled={deleteMutation.isPending}
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                        title="Delete Quotation"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    )}
                  </div>
                )}
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
      {/* ── Quotation Delete Confirmation Overlay ── */}
      {deleteTargetId !== null && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 text-center">
            <span className="material-symbols-outlined text-red-500 text-4xl">
              {isPermanentDelete ? 'delete_forever' : 'delete'}
            </span>
            <div>
              <h3 className="font-label-caps text-sm text-white font-bold tracking-widest">
                {isPermanentDelete ? 'PERMANENTLY DELETE QUOTE?' : 'DELETE QUOTATION?'}
              </h3>
              <p className="text-xs text-on-surface-variant/70 font-data-sm mt-1.5">
                {isPermanentDelete
                  ? `Are you sure you want to permanently delete quotation ${deleteTargetCode}? This action cannot be undone.`
                  : `Are you sure you want to send quotation ${deleteTargetCode} to the Recycle Bin?`}
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => {
                  if (isPermanentDelete) {
                    deletePermanentMutation.mutate(deleteTargetId);
                  } else {
                    deleteMutation.mutate(deleteTargetId);
                  }
                  setDeleteTargetId(null);
                  setDeleteTargetCode(null);
                }}
                className="w-full py-2.5 bg-performance-red hover:bg-performance-red/90 text-white rounded-xl text-xs font-label-caps tracking-widest transition-all uppercase cursor-pointer"
              >
                Yes, Delete
              </button>
              <button
                onClick={() => {
                  setDeleteTargetId(null);
                  setDeleteTargetCode(null);
                }}
                className="w-full py-2.5 border border-white/10 text-on-surface hover:text-white rounded-xl text-xs font-label-caps tracking-widest hover:bg-white/5 transition-colors uppercase cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
