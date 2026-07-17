import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

interface TrackStep {
  key: string;
  label: string;
  done: boolean;
  current: boolean;
}

interface TrackData {
  job_no: string;
  owner_name: string;
  reg_no: string;
  car_name: string;
  status: string;
  status_label: string;
  created_at: string;
  updated_at: string;
  services: Array<{ service_name: string; qty: number; rate: number; amount: number }>;
  invoice?: { invoice_no: string; subtotal: number; gst_amount: number; total_amount: number } | null;
  estimate?: { estimate_no: string; subtotal: number; total_amount: number } | null;
  status_steps: TrackStep[];
  source: 'regular' | 'quick';
}

const STEP_ICONS: Record<string, string> = {
  scheduled: 'calendar_month',
  car_in: 'directions_car',
  washing: 'local_car_wash',
  in_progress: 'engineering',
  qc: 'fact_check',
  ready: 'thumb_up',
  delivered: 'workspace_premium'
};

export default function PublicTrackingPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<TrackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTracking = async () => {
      try {
        setLoading(true);
        const baseApiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? 'http://localhost:4000/api/v1'
          : `${window.location.origin}/api/v1`;
        const res = await axios.get(`${baseApiUrl}/public/job-card/${token}`);
        if (res.data && res.data.success) {
          setData(res.data.data);
        } else {
          setError(res.data?.error?.message || 'Failed to fetch status details');
        }
      } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.error?.message || 'Docket status not found or link has expired.');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchTracking();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-void-black flex flex-col items-center justify-center p-6 text-on-surface-variant/40">
        <span className="material-symbols-outlined text-5xl animate-spin mb-4 text-performance-red">sync</span>
        <p className="text-sm font-label-caps tracking-widest uppercase text-white">Retrieving Live Docket Telemetry...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-void-black flex flex-col items-center justify-center p-6 text-center text-on-surface-variant/40">
        <span className="material-symbols-outlined text-6xl mb-4 text-performance-red">warning</span>
        <h2 className="text-xl font-bold text-white uppercase tracking-wider mb-2">TRACKING TELEMETRY OFFLINE</h2>
        <p className="text-xs max-w-sm text-gray-500">{error || 'Docket status not found.'}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 px-5 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl text-xs font-label-caps uppercase tracking-wider transition-all"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const billTotal = data.invoice?.total_amount || data.estimate?.total_amount || data.services.reduce((s, x) => s + Number(x.amount), 0);

  return (
    <div className="min-h-screen bg-void-black text-on-background relative overflow-hidden py-12 px-4 sm:px-6">
      {/* Ambient Glows */}
      <div className="absolute -top-60 -right-60 w-[600px] h-[600px] rounded-full bg-performance-red/[0.03] blur-[180px] pointer-events-none z-0" />
      <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-performance-red/[0.02] blur-[160px] pointer-events-none z-0" />

      <div className="max-w-4xl mx-auto space-y-8 relative z-10">
        {/* Branded Header */}
        <div className="flex justify-between items-center border-b border-white/5 pb-6">
          <div>
            <h1 className="font-display-hero text-2xl md:text-3xl text-white mb-1 tracking-tight italic">
              GOD OF CERAMIC <span className="text-performance-red not-italic font-light">TRACKING</span>
            </h1>
            <p className="font-label-caps text-[9px] text-on-surface-variant/60 tracking-widest uppercase">
              Live Service Bay Status Monitor
            </p>
          </div>
          <div className="px-3 py-1 bg-green-500/10 rounded-full border border-green-500/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_#4ade80]"></span>
            <span className="text-[9px] font-bold text-green-400 uppercase tracking-widest">LIVE STREAM</span>
          </div>
        </div>

        {/* Status Stepper Timeline */}
        <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/5 bg-[#0c0c0c]/40 backdrop-blur-2xl">
          <h2 className="font-label-caps text-xs text-white tracking-widest mb-8 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-performance-red">route</span>
            SERVICE MILESTONES
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-7 gap-4 relative">
            {data.status_steps.map((step, idx) => {
              const icon = STEP_ICONS[step.key] || 'settings';
              return (
                <div key={step.key} className="flex flex-col items-center gap-2 text-center group">
                  <div
                    className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all duration-300 ${
                      step.current
                        ? 'bg-void-black border-performance-red text-performance-red shadow-[0_0_20px_rgba(255,43,43,0.6)] font-bold scale-110'
                        : step.done
                        ? 'bg-performance-red border-performance-red text-white'
                        : 'bg-void-black border-white/10 text-gray-600'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">{icon}</span>
                  </div>
                  <span
                    className={`font-label-caps text-[8.5px] tracking-wider uppercase font-bold ${
                      step.current ? 'text-performance-red' : step.done ? 'text-white' : 'text-gray-600'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Split Details & Invoice */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Details Column */}
          <div className="md:col-span-2 space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#0c0c0c]/40 backdrop-blur-2xl space-y-4">
              <h3 className="font-label-caps text-xs text-white tracking-widest border-b border-white/5 pb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-performance-red">garage</span>
                VEHICLE &amp; TICKET DATA
              </h3>
              <div className="grid grid-cols-2 gap-4 text-xs font-data-sm">
                <div>
                  <span className="text-gray-500 block">Docket ID Ref</span>
                  <span className="text-white font-bold text-sm">{data.job_no}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">License Plate</span>
                  <span className="text-white font-bold text-sm font-mono">{data.reg_no}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Vehicle Model</span>
                  <span className="text-white font-bold text-sm">{data.car_name}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Client Owner</span>
                  <span className="text-white font-bold text-sm uppercase">{data.owner_name}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-white/5">
                  <span className="text-gray-500 block">Last Update Synchronized</span>
                  <span className="text-white font-mono text-[10px]">{new Date(data.updated_at).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Services table */}
            <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#0c0c0c]/40 backdrop-blur-2xl space-y-4">
              <h3 className="font-label-caps text-xs text-white tracking-widest border-b border-white/5 pb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-performance-red">view_list</span>
                SERVICE LEDGER RECORD
              </h3>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs font-data-sm border-collapse min-w-[500px]">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-500 font-label-caps text-[8px] tracking-widest">
                      <th className="pb-2">LOGGED SERVICE</th>
                      <th className="pb-2 text-center">QTY</th>
                      <th className="pb-2 text-right">RATE</th>
                      <th className="pb-2 text-right">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.services.map((s, i) => (
                      <tr key={i} className="hover:bg-white/[0.01]">
                        <td className="py-2.5 text-white font-bold">{s.service_name}</td>
                        <td className="py-2.5 text-center text-gray-400 font-mono-data">{s.qty}</td>
                        <td className="py-2.5 text-right text-gray-400 font-mono-data">₹{Number(s.rate).toLocaleString('en-IN')}</td>
                        <td className="py-2.5 text-right text-white font-bold font-mono-data">₹{Number(s.amount).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Billing Column */}
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#0c0c0c]/40 backdrop-blur-2xl space-y-4 text-center">
              <h3 className="font-label-caps text-xs text-white tracking-widest border-b border-white/5 pb-2 uppercase">
                BILLING SUMMARY
              </h3>
              
              <div className="space-y-1">
                <span className="text-[10px] text-gray-500 font-label-caps uppercase tracking-wider block">Est. Settlement Total</span>
                <span className="text-3xl font-bold text-performance-red font-data-lg text-glow">₹{Number(billTotal).toLocaleString('en-IN')}</span>
              </div>

              {data.invoice ? (
                <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-3.5 space-y-2 text-xs text-left">
                  <span className="text-[10px] text-green-400 font-bold font-label-caps uppercase block tracking-wider">Tax Invoice Generated</span>
                  <p className="text-white font-mono text-[11px]">{data.invoice.invoice_no}</p>
                  <p className="text-gray-500 text-[10px]">CGST + SGST (18%): ₹{Number(data.invoice.gst_amount).toLocaleString('en-IN')}</p>
                </div>
              ) : data.estimate ? (
                <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-3.5 space-y-2 text-xs text-left">
                  <span className="text-[10px] text-yellow-400 font-bold font-label-caps uppercase block tracking-wider">Estimate Code Generated</span>
                  <p className="text-white font-mono text-[11px]">{data.estimate.estimate_no}</p>
                </div>
              ) : (
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-gray-500 italic">
                  Job card billing is not yet finalized by studio accounts department.
                </div>
              )}

              {/* Print invoice shortcut */}
              {(data.invoice || data.estimate) && (
                <button
                  onClick={() => window.open(`/invoice/${data.source}/${data.job_no}`, '_blank')}
                  className="w-full py-3 performance-gradient text-white rounded-xl font-label-caps text-[10px] uppercase font-bold tracking-widest flex items-center justify-center gap-1.5 hover:shadow-[0_0_15px_rgba(255,43,43,0.3)] active:scale-[0.98] transition-all border border-white/10"
                >
                  <span className="material-symbols-outlined text-sm">print</span>
                  Print Settlement
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
