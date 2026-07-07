import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { staffAPI, StaffMember } from '../api/staff';
import { settingsApi } from '../api/settings';
import toast from 'react-hot-toast';

export default function KioskAttendancePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Search & Navigation States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [actionType, setActionType] = useState<'check-in' | 'check-out' | null>(null);
  
  // Webcam states
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);

  // Callback ref to bind DOM video element when it mounts (averts React rendering race condition)
  const setVideoRef = (node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && cameraStream) {
      node.srcObject = cameraStream;
    }
  };

  // Assign stream as soon as it becomes available
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // Kiosk Lock states
  const [isLocked, setIsLocked] = useState(() => {
    const saved = localStorage.getItem('goc_kiosk_locked');
    return saved !== 'false'; // Defaults to true
  });
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');

  // Clock state
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  // Success message state
  const [successMsg, setSuccessMsg] = useState<{ name: string; time: string; type: string } | null>(null);

  // Fetch passcode from settings
  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getAll,
  });

  const getPasscode = () => {
    return settingsData?.['attendance_kiosk_passcode']?.value || '1234';
  };

  // Fetch active staff
  const { data: staffRes, isLoading: isStaffLoading } = useQuery({
    queryKey: ['activeStaff'],
    queryFn: () => staffAPI.list({ status: 'active' }),
  });
  const staffList = (staffRes?.data || []) as StaffMember[];

  // Running clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
      setDateStr(
        now.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle Lock persistence
  useEffect(() => {
    localStorage.setItem('goc_kiosk_locked', String(isLocked));
  }, [isLocked]);

  // Webcam control
  const startCamera = async () => {
    setIsCameraLoading(true);
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      const constraints = {
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error starting camera:', err);
      toast.error('Unable to access camera. Please allow camera permissions.');
    } finally {
      setIsCameraLoading(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setCapturedPhoto(null);
  };

  // Trigger camera start when action is chosen
  useEffect(() => {
    if (actionType) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [actionType]);

  const handleSnapPhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedPhoto(dataUrl);
      }
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
  };

  // Submit attendance to backend
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = async () => {
    if (!selectedStaff || !actionType || !capturedPhoto) return;
    setIsSubmitting(true);
    try {
      const res = await staffAPI.kioskAttendance({
        staff_id: selectedStaff.id,
        type: actionType,
        photo: capturedPhoto,
      });

      if (res.success) {
        const timeNow = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        setSuccessMsg({
          name: selectedStaff.full_name,
          time: timeNow,
          type: actionType === 'check-in' ? 'Checked In' : 'Checked Out',
        });
        
        // Refresh queries in background
        queryClient.invalidateQueries({ queryKey: ['todayAttendance'] });
        queryClient.invalidateQueries({ queryKey: ['activeStaff'] });

        // Reset state after 3 seconds
        setTimeout(() => {
          setSuccessMsg(null);
          setSelectedStaff(null);
          setActionType(null);
          setSearchQuery('');
        }, 3000);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to submit attendance';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Kiosk lockout passcode entry
  const handleKeypadPress = (val: string) => {
    if (val === 'C') {
      setPasscodeInput('');
    } else if (val === 'OK') {
      const correctPasscode = getPasscode();
      if (passcodeInput === correctPasscode) {
        setIsLocked(false);
        setShowUnlockModal(false);
        setPasscodeInput('');
        toast.success('Kiosk Mode Unlocked!');
      } else {
        toast.error('Incorrect Passcode');
        setPasscodeInput('');
      }
    } else {
      if (passcodeInput.length < 12) {
        setPasscodeInput((prev) => prev + val);
      }
    }
  };

  // Filter staff list
  const filteredStaff = staffList.filter((s) => {
    const query = searchQuery.toLowerCase();
    return s.full_name.toLowerCase().includes(query) || s.staff_code.toLowerCase().includes(query);
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <div className="min-h-screen bg-[#050507] text-white flex flex-col font-sans select-none overflow-hidden relative">
      {/* Background futuristic glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-64 bg-performance-red/[0.03] blur-[120px] rounded-full pointer-events-none z-0" />
      
      {/* ── HEADER BAR ─────────────────────────────────── */}
      <header className="px-8 py-5 border-b border-white/5 bg-black/40 backdrop-blur-md flex items-center justify-between shrink-0 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-performance-red animate-pulse shadow-[0_0_8px_#FF2B2B]" />
          <div>
            <h1 className="text-sm font-extrabold tracking-widest text-white uppercase font-mono">
              GOC STUDIO <span className="text-performance-red">ATTENDANCE GATEWAY</span>
            </h1>
            <p className="text-[10px] text-tertiary/40 tracking-[0.2em] font-mono mt-0.5">
              KIOSK ACCESS TERMINAL
            </p>
          </div>
        </div>

        {/* Live Running Time Clock */}
        <div className="text-right">
          <p className="text-lg font-bold text-white font-mono leading-none">{timeStr || '00:00:00 AM'}</p>
          <p className="text-[10px] text-tertiary/60 tracking-wider font-mono mt-1">{dateStr || 'Loading date...'}</p>
        </div>

        {/* Locked / Unlocked controls */}
        <div className="flex items-center gap-3">
          {isLocked ? (
            <button
              onClick={() => setShowUnlockModal(true)}
              className="px-4 py-2 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl flex items-center gap-2 text-xs font-bold text-tertiary transition-all active:scale-95 hover:cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-performance-red">lock</span>
              <span>LOCKED</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsLocked(true);
                  toast.success('Kiosk Mode Locked');
                }}
                className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/25 hover:border-emerald-500/40 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-400 transition-all active:scale-95 hover:cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">lock_open</span>
                <span>UNLOCKED</span>
              </button>

              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 bg-gradient-to-r from-performance-red to-deep-crimson hover:shadow-[0_0_20px_rgba(255,43,43,0.3)] rounded-xl flex items-center gap-2 text-xs font-bold text-white transition-all active:scale-95 hover:cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                <span>EXIT KIOSK</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── MAIN WORKSPACE ───────────────────────────────── */}
      <main className="flex-1 p-8 flex flex-col items-center justify-center relative z-10 overflow-hidden">
        {successMsg ? (
          /* SUCCESS LOGGED SCREEN */
          <div className="max-w-md w-full bg-[#0c0c0e] border border-emerald-500/20 rounded-3xl p-8 flex flex-col items-center text-center shadow-2xl animate-fade-in relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 mb-6 shadow-inner animate-scale-up">
              <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'wght' 700" }}>check</span>
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-wide">ATTENDANCE LOGGED</h2>
            <p className="text-emerald-400 font-bold mt-2 uppercase tracking-widest text-xs bg-emerald-500/10 px-3.5 py-1 rounded-full border border-emerald-500/20">
              {successMsg.type}
            </p>
            <p className="text-white text-lg font-bold mt-6">{successMsg.name}</p>
            <p className="text-tertiary/60 text-sm mt-1 font-mono">Timestamp: {successMsg.time}</p>
            <div className="mt-8 text-xs text-tertiary/40 font-mono animate-pulse">
              Resetting console...
            </div>
          </div>
        ) : selectedStaff ? (
          /* WORKFLOW TERMINAL OVERLAY */
          <div className="max-w-4xl w-full bg-[#0c0c0e]/80 border border-white/5 backdrop-blur-3xl rounded-3xl p-8 shadow-2xl flex flex-col md:flex-row gap-8 relative overflow-hidden min-h-[500px]">
            <button
              onClick={() => {
                setSelectedStaff(null);
                setActionType(null);
              }}
              className="absolute top-5 right-5 w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-tertiary hover:text-white hover:bg-white/10 transition-all active:scale-90 hover:cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            {/* Left Column: Staff Details & Action Selector */}
            <div className="w-full md:w-5/12 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-4 border-b border-white/5 pb-5 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-performance-red/30 to-[#4a0000] border border-performance-red/20 flex items-center justify-center text-lg font-black text-white shrink-0">
                    {getInitials(selectedStaff.full_name)}
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-performance-red bg-performance-red/10 border border-performance-red/25 px-2 py-0.5 rounded-full uppercase tracking-widest">
                      {selectedStaff.role}
                    </span>
                    <h3 className="text-lg font-bold text-white mt-1.5 uppercase tracking-wide">{selectedStaff.full_name}</h3>
                    <p className="text-[10px] text-tertiary/40 font-mono mt-0.5">Staff Code: {selectedStaff.staff_code}</p>
                  </div>
                </div>

                {!actionType ? (
                  /* Action Select Form */
                  <div className="space-y-4">
                    <p className="text-xs text-tertiary font-bold uppercase tracking-wider mb-2">Select attendance action:</p>
                    <button
                      onClick={() => setActionType('check-in')}
                      className="w-full py-4.5 bg-gradient-to-r from-emerald-600 to-emerald-800 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:scale-[1.02] text-white font-extrabold rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] hover:cursor-pointer text-sm tracking-widest uppercase"
                    >
                      <span className="material-symbols-outlined">login</span>
                      <span>STAFF ENTRY (CHECK IN)</span>
                    </button>
                    <button
                      onClick={() => setActionType('check-out')}
                      className="w-full py-4.5 bg-gradient-to-r from-amber-600 to-amber-800 hover:shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:scale-[1.02] text-white font-extrabold rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] hover:cursor-pointer text-sm tracking-widest uppercase"
                    >
                      <span className="material-symbols-outlined">logout</span>
                      <span>STAFF EXIT (CHECK OUT)</span>
                    </button>
                  </div>
                ) : (
                  /* Action Selected - Instruction Panel */
                  <div className="space-y-4">
                    <div className="bg-black/40 border border-white/5 rounded-2xl p-4 border-l-2 border-l-performance-red">
                      <p className="text-[9px] text-tertiary/40 uppercase tracking-widest font-mono">SELECTED MODE</p>
                      <p className="text-base font-black text-white uppercase tracking-wider mt-1">
                        {actionType === 'check-in' ? 'ENTRY CHECK-IN' : 'EXIT CHECK-OUT'}
                      </p>
                    </div>

                    <div className="bg-black/30 border border-white/5 rounded-2xl p-4">
                      <h4 className="text-xs text-white font-bold uppercase tracking-wider mb-2">Photo guidelines</h4>
                      <ul className="space-y-2 text-[10px] text-tertiary/60 font-bold">
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-performance-red shrink-0" />
                          Look straight at the camera.
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-performance-red shrink-0" />
                          Ensure your face is clearly lit and visible.
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-performance-red shrink-0" />
                          Once photo is clicked, tap Confirm.
                        </li>
                      </ul>
                    </div>

                    <button
                      onClick={() => setActionType(null)}
                      className="w-full py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-tertiary hover:text-white rounded-xl transition-all active:scale-95 text-xs font-bold uppercase tracking-widest hover:cursor-pointer"
                    >
                      Change Action Type
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-8 text-[10px] text-tertiary/30 font-mono text-center md:text-left">
                Security check enabled. IP & Device logs are recorded.
              </div>
            </div>

            {/* Right Column: Camera Snapshot / Feed */}
            <div className="flex-1 bg-black/60 rounded-2xl border border-white/5 p-6 flex flex-col items-center justify-center min-h-[340px] relative overflow-hidden">
              {!actionType ? (
                /* Prompt Camera selection */
                <div className="text-center space-y-2 text-tertiary/40 max-w-xs p-4 flex flex-col items-center">
                  <span className="material-symbols-outlined text-5xl text-white/5 mb-3" style={{ fontVariationSettings: "'FILL' 0" }}>photo_camera</span>
                  <p className="text-xs font-bold text-white/30 uppercase tracking-widest">CAMERA SUSPENDED</p>
                  <p className="text-[10px] mt-1">Please select check-in or check-out to activate webcam scan.</p>
                </div>
              ) : isCameraLoading ? (
                /* Camera loading spinner */
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-2 border-performance-red border-t-transparent rounded-full animate-spin" />
                  <p className="text-[10px] text-tertiary uppercase tracking-widest font-mono">Initializing camera...</p>
                </div>
              ) : capturedPhoto ? (
                /* Captured Preview Screen */
                <div className="w-full h-full flex flex-col items-center justify-between">
                  <div className="relative w-full max-w-sm aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black">
                    <img src={capturedPhoto} alt="Captured Staff Face" className="w-full h-full object-cover" />
                    <div className="absolute top-3 left-3 bg-performance-red/80 backdrop-blur-md border border-white/10 text-[8px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                      PREVIEW
                    </div>
                  </div>

                  <div className="flex gap-4 w-full max-w-sm mt-6">
                    <button
                      onClick={handleRetake}
                      disabled={isSubmitting}
                      className="flex-1 py-3.5 border border-white/10 hover:border-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 hover:cursor-pointer disabled:opacity-50"
                    >
                      Retake Photo
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="flex-1 py-3.5 bg-gradient-to-r from-performance-red to-deep-crimson hover:shadow-[0_0_20px_rgba(255,43,43,0.3)] text-white font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 hover:cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>SUBMITTING...</span>
                        </>
                      ) : (
                        <span>CONFIRM &amp; LOG</span>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Live Camera Feed Screen */
                <div className="w-full h-full flex flex-col items-center justify-between">
                  <div className="relative w-full max-w-sm aspect-[4/3] rounded-2xl overflow-hidden border border-white/5 bg-black shadow-2xl">
                    <video 
                      ref={setVideoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="w-full h-full object-cover" 
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {/* Live target overlay indicators */}
                    <div className="absolute inset-0 border-[30px] border-black/30 pointer-events-none flex items-center justify-center">
                      <div className="w-full h-full border-2 border-white/15 border-dashed rounded-xl relative">
                        {/* Corner indicators */}
                        <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-performance-red/70" />
                        <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-performance-red/70" />
                        <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-performance-red/70" />
                        <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-performance-red/70" />
                      </div>
                    </div>

                    <div className="absolute top-3 left-3 bg-emerald-500/80 backdrop-blur-md border border-white/10 text-[8px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-widest font-mono flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-white animate-ping" />
                      LIVE WEBCAM
                    </div>
                  </div>

                  <button
                    onClick={handleSnapPhoto}
                    className="w-full max-w-sm mt-6 py-4 bg-white text-black hover:bg-white/95 text-xs font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2.5 transition-all hover:scale-[1.02] active:scale-[0.98] hover:cursor-pointer shadow-lg"
                  >
                    <span className="material-symbols-outlined text-lg">photo_camera</span>
                    <span>SNAP PHOTO</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── ROSTER SELECTION PANEL ───────────────────── */
          <div className="w-full max-w-5xl flex flex-col gap-6 animate-fade-in">
            {/* Search and Title */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold uppercase tracking-wide text-white">SELECT YOUR NAME</h2>
                <p className="text-xs text-tertiary/50 mt-1 font-bold">Tap on your profile card to register attendance</p>
              </div>

              {/* Big Touch Search Box */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-tertiary/40 text-lg">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Filter name or staff ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-72 bg-white/5 border border-white/10 hover:border-white/20 focus:border-performance-red/40 focus:outline-none rounded-2xl py-3.5 pl-12 pr-5 text-sm text-white placeholder-tertiary/30 font-bold transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-tertiary hover:text-white"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                )}
              </div>
            </div>

            {/* Staff Card Grid */}
            {isStaffLoading ? (
              <div className="py-24 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 border-2 border-performance-red border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-tertiary/50 uppercase tracking-widest font-mono">Synchronizing manifest...</p>
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="py-24 text-center bg-[#0c0c0e]/30 border border-white/5 rounded-3xl p-8 flex flex-col items-center justify-center text-tertiary/40">
                <span className="material-symbols-outlined text-4xl mb-2">person_search</span>
                <p className="text-xs font-bold uppercase tracking-wider">No matching staff member found</p>
                <p className="text-[10px] mt-1">Please try checking your spelling or enter your ID code.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar">
                {filteredStaff.map((s, idx) => {
                  const avatarColor = [
                    'from-performance-red/30 to-[#4a0000]',
                    'from-blue-600/30 to-blue-900/40',
                    'from-purple-600/30 to-purple-900/40',
                    'from-emerald-600/30 to-emerald-900/40',
                    'from-amber-600/30 to-amber-900/40',
                    'from-pink-600/30 to-pink-900/40',
                  ][idx % 6];

                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedStaff(s)}
                      className="bg-[#0c0c0e]/40 border border-white/5 hover:border-performance-red/30 hover:bg-performance-red/[0.01] rounded-2xl p-5 flex flex-col items-center text-center gap-3 transition-all active:scale-[0.96] hover:cursor-pointer shadow-xl duration-300"
                    >
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${avatarColor} border border-white/10 flex items-center justify-center text-base font-black text-white shadow-inner`}>
                        {getInitials(s.full_name)}
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-black text-white truncate max-w-[140px] uppercase tracking-wide">
                          {s.full_name}
                        </p>
                        <p className="text-[9px] text-performance-red font-bold uppercase tracking-widest font-mono">
                          {s.role}
                        </p>
                        <p className="text-[9px] text-tertiary/40 font-mono pt-1">
                          ID: {s.staff_code}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── FOOTER STATUS BAR ────────────────────────────── */}
      <footer className="px-8 py-4 bg-black/50 border-t border-white/5 flex items-center justify-between text-[9px] text-tertiary/40 font-mono tracking-widest shrink-0 uppercase relative z-10">
        <div>
          STATUS: ONLINE &bull; CAMERA SECURE
        </div>
        <div>
          SYSTEM VERSION 2.0 &bull; &copy; {new Date().getFullYear()} GOD OF CERAMIC
        </div>
      </footer>

      {/* ── KEYPAD KEYBOARD UNLOCK OVERLAY ───────────────── */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#0c0c0e] border border-white/10 rounded-3xl p-6 max-w-xs w-full shadow-2xl flex flex-col items-center relative">
            <button
              onClick={() => {
                setShowUnlockModal(false);
                setPasscodeInput('');
              }}
              className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-tertiary hover:text-white transition-all active:scale-90"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>

            <span className="material-symbols-outlined text-performance-red text-3xl mb-2">lock</span>
            <h3 className="text-xs font-bold uppercase tracking-widest text-white mb-1">ENTER PASSCODE</h3>
            <p className="text-[9px] text-tertiary/50 uppercase tracking-wider mb-5">To exit kiosk terminal</p>

            {/* Display passcode circles */}
            <div className="flex gap-2 justify-center mb-6 h-8 items-center">
              {passcodeInput ? (
                <div className="text-sm font-mono tracking-[0.2em] font-bold text-performance-red bg-performance-red/5 border border-performance-red/20 px-4 py-1.5 rounded-lg">
                  {passcodeInput.replace(/./g, '●')}
                </div>
              ) : (
                <span className="text-[9px] font-mono text-tertiary/30 uppercase tracking-widest">ENTER PIN</span>
              )}
            </div>

            {/* Grid Layout Keypad */}
            <div className="grid grid-cols-3 gap-2 w-full max-w-[220px]">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'].map((btn) => {
                const isAction = btn === 'C' || btn === 'OK';
                return (
                  <button
                    key={btn}
                    onClick={() => handleKeypadPress(btn)}
                    className={`h-11 rounded-xl font-mono text-sm font-bold flex items-center justify-center transition-all active:scale-90 hover:cursor-pointer ${
                      isAction
                        ? btn === 'C'
                          ? 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20'
                          : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 font-black'
                        : 'bg-white/5 border border-white/10 hover:border-white/20 text-white'
                    }`}
                  >
                    {btn}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
