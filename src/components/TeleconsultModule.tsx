import React, { useState, useEffect } from 'react';
import { Doctor, PatientUser } from '../types';
import { playHospitalChime } from '../utils/audio';

interface TeleconsultModuleProps {
  doctors: Doctor[];
  currentUser: PatientUser | null;
  onShowToast: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
  onBookInPersonInstead?: () => void;
}

export const TeleconsultModule: React.FC<TeleconsultModuleProps> = ({
  doctors,
  currentUser,
  onShowToast,
  onBookInPersonInstead,
}) => {
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor>(
    doctors.find((d) => d.teleconsultAvailable) || doctors[0]
  );
  const [selectedPlan, setSelectedPlan] = useState<'onetime_299' | 'pass_999'>('onetime_299');
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean>(false);

  // Active Call State
  const [isInCall, setIsInCall] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
  const [callDurationSecs, setCallDurationSecs] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'video' | 'notes' | 'vitals'>('video');
  const [consultationNotes, setConsultationNotes] = useState<string>('Patient reports 3-day history of knee stiffness. Recommending weight-bearing radiograph.');

  // Live timer during call
  useEffect(() => {
    let interval: any;
    if (isInCall) {
      interval = setInterval(() => {
        setCallDurationSecs((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDurationSecs(0);
    }
    return () => clearInterval(interval);
  }, [isInCall]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartBooking = (doc: Doctor) => {
    setSelectedDoctor(doc);
    setShowCheckoutModal(true);
    playHospitalChime();
  };

  const handleProcessPayment = () => {
    setIsProcessingPayment(true);
    setTimeout(() => {
      setIsProcessingPayment(false);
      setShowCheckoutModal(false);
      setPaymentSuccess(true);
      setIsInCall(true);
      playHospitalChime();
      onShowToast(
        'Payment Verified & Call Connected',
        `Live HD video consultation initiated with ${selectedDoctor.name}.`,
        'success'
      );
    }, 1200);
  };

  const handleEndCall = () => {
    setIsInCall(false);
    playHospitalChime();
    onShowToast(
      'Consultation Concluded',
      `Virtual session summary & digital e-prescription generated for ${selectedDoctor.name}.`,
      'info'
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Teleconsult Header Banner */}
      <div className="bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white p-4 sm:p-6 rounded-2xl border border-[#334155] shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#0ea5e9]/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0ea5e9]/20 border border-[#0ea5e9]/40 text-[#38bdf8] text-[10px] font-bold uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-[#38bdf8] animate-ping"></span>
              24/7 Virtual OPD Tele-Consultation
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Consult Top Specialists from Home
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Zero hospital wait times. Encrypted 1-on-1 HD video call, AI pre-test evaluation, digital prescriptions, and follow-up support.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onBookInPersonInstead && (
              <button
                type="button"
                onClick={onBookInPersonInstead}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition cursor-pointer flex items-center gap-1.5"
              >
                <i className="fa-solid fa-hospital-user text-[#38bdf8]"></i>
                <span>Switch to In-Hospital Queue</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Container: Active Call or Doctor Roster & Pricing */}
      {isInCall ? (
        /* LIVE SIMULATED VIDEO CALL SCREEN */
        <div className="bg-[#0f172a] rounded-2xl border border-[#334155] p-3 sm:p-5 shadow-2xl text-white space-y-4">
          <div className="flex items-center justify-between border-b border-[#334155] pb-3">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[#22c55e] animate-pulse"></div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                  <span>Live Video Consultation</span>
                  <span className="text-[10px] bg-[#1e293b] text-[#38bdf8] border border-[#38bdf8]/30 px-2 py-0.5 rounded-full font-mono">
                    HD 1080p • Encrypted
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  With {selectedDoctor.name} ({selectedDoctor.specialty})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-[#1e293b] border border-[#334155] rounded-lg font-mono text-xs font-bold text-[#22c55e] flex items-center gap-1.5">
                <i className="fa-solid fa-record-vinyl text-[#ef4444] animate-spin"></i>
                <span>{formatTimer(callDurationSecs)}</span>
              </div>
            </div>
          </div>

          {/* Video Grid Container */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Main Doctor Video Area */}
            <div className="lg:col-span-2 relative aspect-video sm:aspect-[16/10] bg-[#1e293b] rounded-xl overflow-hidden border border-[#334155] shadow-inner flex items-center justify-center">
              {/* Doctor Video Feed Placeholder */}
              <img
                src={selectedDoctor.avatar}
                alt={selectedDoctor.name}
                className="w-full h-full object-cover opacity-90 filter contrast-105"
              />

              {/* Overlay Doctor Name Tag */}
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 text-xs font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#22c55e]"></span>
                <span>{selectedDoctor.name}</span>
                <span className="text-[10px] text-slate-300">({selectedDoctor.roomNumber})</span>
              </div>

              {/* Audio Equalizer Simulation */}
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1.5">
                <i className="fa-solid fa-microphone text-[#22c55e] text-xs"></i>
                <div className="flex items-end gap-0.5 h-3">
                  <span className="w-1 bg-[#22c55e] h-2 animate-bounce"></span>
                  <span className="w-1 bg-[#22c55e] h-3 animate-pulse"></span>
                  <span className="w-1 bg-[#22c55e] h-1.5 animate-bounce"></span>
                  <span className="w-1 bg-[#22c55e] h-3 animate-ping"></span>
                </div>
                <span className="text-[10px] text-slate-300 font-mono">Audio Active</span>
              </div>

              {/* Picture-in-Picture (Patient Self View) */}
              <div className="absolute bottom-3 right-3 w-28 sm:w-36 aspect-video bg-black/80 rounded-lg overflow-hidden border-2 border-[#0ea5e9] shadow-lg flex items-center justify-center">
                {isVideoOff ? (
                  <div className="text-center p-2">
                    <i className="fa-solid fa-video-slash text-slate-400 text-sm"></i>
                    <p className="text-[9px] text-slate-400 mt-0.5">Camera Off</p>
                  </div>
                ) : (
                  <div className="relative w-full h-full bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center">
                    <i className="fa-solid fa-user text-white/50 text-xl"></i>
                    <div className="absolute top-1 right-1 bg-black/60 px-1 rounded text-[8px] text-white">
                      You
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Side Clinical Telehealth Panel */}
            <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-3.5 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between border-b border-[#334155] pb-2 mb-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Live Telehealth Session
                  </h4>
                  <span className="text-[10px] text-[#38bdf8] font-bold">
                    Room ID: #VID-MQ-2026
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-[#0f172a] border border-[#334155]">
                    <span className="text-[10px] text-slate-400 block">Patient Profile</span>
                    <p className="font-bold text-white mt-0.5">
                      {currentUser ? currentUser.name : 'Rajesh Mukherjee'}
                    </p>
                    <p className="text-[11px] text-[#38bdf8] font-mono">
                      {currentUser ? currentUser.uhid : 'MQ-DEL-8942A'}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#0f172a] border border-[#334155]">
                    <span className="text-[10px] text-slate-400 block">Doctor's Live Prescription Notes</span>
                    <textarea
                      value={consultationNotes}
                      onChange={(e) => setConsultationNotes(e.target.value)}
                      rows={3}
                      className="w-full mt-1 bg-transparent text-xs text-slate-200 focus:outline-hidden border-none resize-none"
                      placeholder="Doctor's clinical findings & prescription..."
                    />
                  </div>

                  <div className="p-2 rounded-lg bg-[#0ea5e9]/10 border border-[#0ea5e9]/30 text-[11px] text-[#38bdf8] flex items-center gap-2">
                    <i className="fa-solid fa-file-shield text-xs"></i>
                    <span>E-Prescription will be dispatched via SMS & WhatsApp.</span>
                  </div>
                </div>
              </div>

              {/* Call Control Toolbar */}
              <div className="pt-3 border-t border-[#334155] flex items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className={`p-3 rounded-full transition cursor-pointer ${
                    isMuted ? 'bg-[#ef4444] text-white' : 'bg-[#334155] hover:bg-[#475569] text-white'
                  }`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
                </button>

                <button
                  type="button"
                  onClick={() => setIsVideoOff(!isVideoOff)}
                  className={`p-3 rounded-full transition cursor-pointer ${
                    isVideoOff ? 'bg-[#ef4444] text-white' : 'bg-[#334155] hover:bg-[#475569] text-white'
                  }`}
                  title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
                >
                  <i className={`fa-solid ${isVideoOff ? 'fa-video-slash' : 'fa-video'}`}></i>
                </button>

                <button
                  type="button"
                  onClick={handleEndCall}
                  className="px-4 py-2.5 rounded-full bg-[#ef4444] hover:bg-[#dc2626] text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-lg"
                >
                  <i className="fa-solid fa-phone-slash"></i>
                  <span>End Consult</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* DOCTOR ROSTER & PRICING PLANS */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Doctor Selection (2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0f172a] flex items-center gap-2">
                <i className="fa-solid fa-user-doctor text-[#0ea5e9]"></i>
                <span>Available Tele-Consultation Specialists</span>
              </h3>
              <span className="badge badge-green">
                <span className="w-1.5 h-1.5 rounded-full bg-[#166534] animate-ping"></span>
                Live Slots Open
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {doctors.map((doc) => (
                <div
                  key={doc.id}
                  className={`p-3.5 rounded-xl border transition-all text-left flex flex-col justify-between ${
                    selectedDoctor.id === doc.id
                      ? 'border-2 border-[#0ea5e9] bg-[#f0f9ff] shadow-sm'
                      : 'border-[#e2e8f0] bg-white hover:border-[#cbd5e1]'
                  }`}
                >
                  <div>
                    <div className="flex items-start gap-3">
                      <img
                        src={doc.avatar}
                        alt={doc.name}
                        className="w-12 h-12 rounded-xl object-cover border border-[#e2e8f0] shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-xs sm:text-sm text-[#0f172a] truncate">{doc.name}</h4>
                          <span className="badge badge-teal text-[9px]">{doc.department}</span>
                        </div>
                        <p className="text-[11px] text-[#64748b] line-clamp-1 mt-0.5">{doc.specialty}</p>
                        <p className="text-[10px] text-[#0ea5e9] font-medium mt-1">
                          <i className="fa-solid fa-clock mr-1"></i>
                          Avg Consult: {doc.avgConsultationTimeMin} mins • Room {doc.roomNumber}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-[#e2e8f0] flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#166534]">
                      <i className="fa-solid fa-video mr-1"></i> Video Slot Ready
                    </span>
                    <button
                      type="button"
                      onClick={() => handleStartBooking(doc)}
                      className="px-3 py-1.5 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1"
                    >
                      <span>Book Slot</span>
                      <i className="fa-solid fa-arrow-right text-[10px]"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing & Monetization Card */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 shadow-sm space-y-3.5">
            <div>
              <span className="badge badge-amber text-[10px] mb-1.5">
                <i className="fa-solid fa-crown mr-1"></i> Monetization & Pass Plans
              </span>
              <h3 className="font-bold text-sm text-[#0f172a]">Medi-Queue Tele-Consult Plans</h3>
              <p className="text-xs text-[#64748b] mt-0.5">
                Instant digital receipt, GST invoice, and direct doctor video link.
              </p>
            </div>

            {/* Plan A: One-time */}
            <div
              onClick={() => setSelectedPlan('onetime_299')}
              className={`p-3 rounded-xl border-2 transition cursor-pointer ${
                selectedPlan === 'onetime_299'
                  ? 'border-[#0ea5e9] bg-[#f0f9ff]'
                  : 'border-[#e2e8f0] hover:border-[#cbd5e1]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[#0f172a]">Option A: Single Consultation</span>
                <span className="text-sm font-black text-[#0284c7]">₹299</span>
              </div>
              <p className="text-[11px] text-[#64748b]">
                1 HD Video Session (15 mins) + 48hr follow-up e-prescription chat.
              </p>
            </div>

            {/* Plan B: Annual Pass */}
            <div
              onClick={() => setSelectedPlan('pass_999')}
              className={`p-3 rounded-xl border-2 transition cursor-pointer relative overflow-hidden ${
                selectedPlan === 'pass_999'
                  ? 'border-[#0ea5e9] bg-[#f0f9ff]'
                  : 'border-[#e2e8f0] hover:border-[#cbd5e1]'
              }`}
            >
              <span className="absolute top-0 right-0 bg-[#0ea5e9] text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">
                BEST VALUE
              </span>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[#0f172a]">Option B: Annual Health Pass</span>
                <span className="text-sm font-black text-[#0284c7]">₹999 / yr</span>
              </div>
              <p className="text-[11px] text-[#64748b]">
                Unlimited Tele-Consults for family (4 members) + Priority Fast-Track In-Hospital Token Queue.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowCheckoutModal(true)}
              className="w-full py-2.5 rounded-xl bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-xs font-bold transition shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-lock"></i>
              <span>
                Proceed to Checkout ({selectedPlan === 'onetime_299' ? '₹299' : '₹999'})
              </span>
            </button>
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 sm:p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0]">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-[#e0f2fe] text-[#0ea5e9] flex items-center justify-center font-bold">
                  <i className="fa-solid fa-shield-halved"></i>
                </span>
                <div>
                  <h3 className="font-bold text-sm text-[#0f172a]">Secure Telehealth Checkout</h3>
                  <p className="text-[11px] text-[#64748b]">Medi-Queue Instant Payment Gateway</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="text-[#94a3b8] hover:text-[#0f172a] text-sm cursor-pointer p-1"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="py-4 space-y-3">
              {/* Doctor Summary */}
              <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex items-center gap-3">
                <img
                  src={selectedDoctor.avatar}
                  alt={selectedDoctor.name}
                  className="w-10 h-10 rounded-lg object-cover"
                />
                <div>
                  <h4 className="font-bold text-xs text-[#0f172a]">{selectedDoctor.name}</h4>
                  <p className="text-[11px] text-[#64748b]">{selectedDoctor.specialty}</p>
                </div>
              </div>

              {/* Selected Plan Details */}
              <div className="p-3 rounded-xl bg-[#f0f9ff] border border-[#bae6fd] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#0284c7] uppercase">Selected Plan</span>
                  <p className="font-bold text-xs text-[#0f172a]">
                    {selectedPlan === 'onetime_299' ? 'One-Time Video Consultation' : 'Medi-Queue Annual Health Pass'}
                  </p>
                </div>
                <span className="text-base font-black text-[#0284c7]">
                  {selectedPlan === 'onetime_299' ? '₹299' : '₹999'}
                </span>
              </div>

              {/* Payment Methods */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
                  Payment Method (Simulated Instant UPI / Card)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 rounded-lg border-2 border-[#0ea5e9] bg-[#f0f9ff] text-center text-xs font-bold text-[#0284c7]">
                    <i className="fa-solid fa-mobile-screen-button block text-sm mb-0.5"></i>
                    <span>UPI GPay</span>
                  </div>
                  <div className="p-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-center text-xs font-semibold text-[#64748b]">
                    <i className="fa-regular fa-credit-card block text-sm mb-0.5"></i>
                    <span>Card</span>
                  </div>
                  <div className="p-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-center text-xs font-semibold text-[#64748b]">
                    <i className="fa-solid fa-building-columns block text-sm mb-0.5"></i>
                    <span>NetBanking</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="flex-1 py-2 rounded-xl bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#475569] text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessPayment}
                disabled={isProcessingPayment}
                className="flex-2 py-2 rounded-xl bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-xs font-bold transition shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessingPayment ? (
                  <>
                    <i className="fa-solid fa-spinner animate-spin"></i>
                    <span>Authorizing ₹{selectedPlan === 'onetime_299' ? '299' : '999'}...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check"></i>
                    <span>Pay ₹{selectedPlan === 'onetime_299' ? '299' : '999'} & Start Call</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
