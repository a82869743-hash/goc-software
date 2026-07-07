import { useState } from 'react';
import apiClient from '../api/client';
import toast from 'react-hot-toast';

interface Warranty {
  id: number;
  customer_name: string;
  vehicle_name: string;
  reg_number: string;
  service_name: string;
  warranty_card_no: string;
  duration_months: number;
  start_date: string;
  expiry_date: string;
  status: 'active' | 'expired' | 'void';
  job_code: string;
}

export default function PublicWarrantyCheck() {
  const [regNo, setRegNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [warranties, setWarranties] = useState<Warranty[] | null>(null);

  // Claim Filing State
  const [selectedWarranty, setSelectedWarranty] = useState<Warranty | null>(null);
  const [issueDescription, setIssueDescription] = useState('');
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [claimSuccessDetails, setClaimSuccessDetails] = useState<{ claim_code: string } | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNo.trim()) return;

    try {
      setLoading(true);
      setWarranties(null);
      setSelectedWarranty(null);
      setClaimSuccessDetails(null);

      const res = await apiClient.get(`/warranties/public/check?reg_number=${encodeURIComponent(regNo.trim())}`);
      if (res.data && res.data.success) {
        setWarranties(res.data.data);
        if (res.data.data.length === 0) {
          toast.error('No warranty records found for this registration number.');
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to query warranty records. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarranty || !issueDescription.trim()) return;

    try {
      setSubmittingClaim(true);
      const res = await apiClient.post('/warranties/public/claim', {
        warranty_id: selectedWarranty.id,
        issue_description: issueDescription.trim()
      });

      if (res.data && res.data.success) {
        setClaimSuccessDetails(res.data.data);
        toast.success('Warranty claim submitted successfully!');
        setIssueDescription('');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error?.message || 'Failed to submit claim.');
    } finally {
      setSubmittingClaim(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060606] text-white flex flex-col justify-between selection:bg-performance-red selection:text-white">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-display font-black text-2xl tracking-tighter text-performance-red">GOC</span>
          <span className="font-label-caps text-xs tracking-widest text-on-surface-variant/60 uppercase">STUDIO</span>
        </div>
        <div className="font-label-caps text-[10px] text-on-surface-variant/40 tracking-widest uppercase">
          OFFICIAL WARRANTY INTEGRATION
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12 space-y-8">
        <div className="text-center space-y-3">
          <h1 className="font-display-hero text-4xl sm:text-5xl text-white tracking-tight italic uppercase">
            WARRANTY <span className="text-performance-red not-italic font-light">VERIFICATION</span>
          </h1>
          <p className="max-w-md mx-auto text-xs text-on-surface-variant/60 font-label-caps tracking-widest uppercase">
            Enter your vehicle details below to check active ceramic or PPF shielding status and file repair claims.
          </p>
        </div>

        {/* Search Panel */}
        <form onSubmit={handleSearch} className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#0c0c0c]/40 backdrop-blur-2xl max-w-lg mx-auto flex items-end gap-3">
          <div className="flex-1">
            <label className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest block mb-1.5 uppercase font-bold">
              License Plate (Registration No.)
            </label>
            <input
              type="text"
              required
              placeholder="e.g. GJ-01-AB-1234"
              value={regNo}
              onChange={(e) => setRegNo(e.target.value.toUpperCase())}
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-700 outline-none focus:border-performance-red/40 font-mono tracking-widest"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-performance-red hover:bg-performance-red/80 text-white font-label-caps text-xs tracking-widest font-bold transition-all disabled:opacity-50 h-10 flex items-center justify-center gap-2 border border-white/10"
          >
            {loading ? <span className="material-symbols-outlined text-[16px] animate-spin">sync</span> : 'CHECK'}
          </button>
        </form>

        {/* Search Results */}
        {warranties && warranties.length > 0 && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="font-label-caps text-xs text-on-surface-variant/60 tracking-widest uppercase border-b border-white/5 pb-2">
              ACTIVE SHIELDING RECORDS ({warranties.length})
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {warranties.map((w) => {
                const isActive = w.status === 'active';
                const isExpired = w.status === 'expired';
                return (
                  <div key={w.id} className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#0e0e0e]/60 relative flex flex-col justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-bold text-white">{w.service_name}</h3>
                          <p className="text-[10px] text-on-surface-variant/40 font-mono tracking-wider">{w.warranty_card_no}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-label-caps tracking-widest uppercase font-bold ${
                          isActive ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                          isExpired ? 'bg-gray-500/10 text-gray-400 border border-gray-500/20' :
                          'bg-red-500/10 text-performance-red border border-red-500/20'
                        }`}>
                          <span className="w-1 h-1 rounded-full bg-current"></span>
                          {w.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/5 font-mono text-xs text-on-surface-variant/80">
                        <div>
                          <p className="text-[9px] text-on-surface-variant/40 font-label-caps uppercase tracking-wider">Start Date</p>
                          <p>{new Date(w.start_date).toLocaleDateString('en-IN')}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-on-surface-variant/40 font-label-caps uppercase tracking-wider">Expiry Date</p>
                          <p>{new Date(w.expiry_date).toLocaleDateString('en-IN')}</p>
                        </div>
                      </div>
                    </div>

                    {isActive && (
                      <button
                        onClick={() => {
                          setSelectedWarranty(w);
                          setClaimSuccessDetails(null);
                        }}
                        className="w-full text-center py-2 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:bg-white/5 font-label-caps text-[10px] tracking-widest uppercase transition-all"
                      >
                        REQUEST WARRANTY REPAIR
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Claim filing panel */}
        {selectedWarranty && (
          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#0a0a0a]/80 max-w-xl mx-auto space-y-4 animate-fade-in">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="font-label-caps text-xs tracking-widest text-white uppercase flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-performance-red">shield</span>
                FILE WARRANTY CLAIM
              </h3>
              <button
                onClick={() => setSelectedWarranty(null)}
                className="text-xs text-on-surface-variant/40 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-1">
              <p className="text-xs text-white font-bold">{selectedWarranty.service_name}</p>
              <p className="text-[10px] text-on-surface-variant/40 font-mono">{selectedWarranty.vehicle_name} • {selectedWarranty.reg_number}</p>
            </div>

            {claimSuccessDetails ? (
              <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-xl text-center space-y-3">
                <span className="material-symbols-outlined text-3xl text-green-400">verified</span>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Claim Logged Successfully</h4>
                <p className="text-xs text-on-surface-variant/80">
                  Your claim has been submitted to GOC Studio staff. Please quote your claim code for references:
                </p>
                <div className="p-2.5 bg-black rounded-lg inline-block font-mono text-sm text-green-400 font-bold border border-green-500/10">
                  {claimSuccessDetails.claim_code}
                </div>
              </div>
            ) : (
              <form onSubmit={handleFileClaim} className="space-y-4">
                <div>
                  <label className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-widest block mb-1.5 uppercase font-bold">
                    Describe the Issue / Damage details
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Provide details about the issue (e.g. PPF peeling from front bumper, ceramic gloss patch fading)…"
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-700 outline-none focus:border-performance-red/40"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submittingClaim}
                  className="w-full py-3 rounded-xl bg-performance-red hover:bg-performance-red/80 font-label-caps text-xs tracking-widest uppercase font-bold transition-all disabled:opacity-50 border border-white/10"
                >
                  {submittingClaim ? 'SUBMITTING...' : 'SUBMIT CLAIM REQUEST'}
                </button>
              </form>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-black/20 py-6 text-center text-[10px] text-on-surface-variant/30 font-label-caps tracking-widest">
        © {new Date().getFullYear()} GOD OF CERAMIC AUTOMOTIVE STUDIO. ALL RIGHTS RESERVED.
      </footer>
    </div>
  );
}
