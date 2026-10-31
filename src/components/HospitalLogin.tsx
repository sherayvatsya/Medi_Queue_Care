import React, { useState } from 'react';
import { StaffUser } from '../types';
import { playHospitalChime } from '../utils/audio';
import { authenticateStaffWithRole, sendStaffPasswordResetEmail } from '../firebase';
import {
  HeartPulse,
  ShieldCheck,
  Shield,
  Lock,
  ArrowLeft,
  Activity,
  Users,
  FileText,
  KeyRound,
  Eye,
  EyeOff,
  Building2,
  Stethoscope,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Mail,
  Send,
} from 'lucide-react';

interface HospitalLoginProps {
  onLoginSuccess: (user: StaffUser) => void;
  onCancel: () => void;
  onShowToast: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
  onOpenSupportModal?: () => void;
}

export const HospitalLogin: React.FC<HospitalLoginProps> = ({
  onLoginSuccess,
  onCancel,
  onShowToast,
}) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState<boolean>(false);
  const [recoveryEmail, setRecoveryEmail] = useState<string>('');
  const [recoverySent, setRecoverySent] = useState<boolean>(false);
  const [isSendingRecovery, setIsSendingRecovery] = useState<boolean>(false);
  const [recoveryError, setRecoveryError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanEmail) {
      setErrorMessage('Please enter your hospital employee email address.');
      return;
    }

    if (!cleanPass) {
      setErrorMessage('Please enter your hospital staff security password.');
      return;
    }

    setIsLoading(true);
    const result = await authenticateStaffWithRole(cleanEmail, cleanPass);
    setIsLoading(false);

    if (!result.success || !result.user) {
      const error = result.error || 'Hospital staff authentication failed.';
      setErrorMessage(error);
      onShowToast('Access Denied', error, 'urgent');
      return;
    }

    playHospitalChime();
    onShowToast(
      'Hospital Authentication Verified',
      `Welcome, ${result.user.name} (${result.user.department}). Staff dashboard unlocked.`,
      'success'
    );
    onLoginSuccess(result.user);
  };

  const handleSendRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) return;

    setIsSendingRecovery(true);
    setRecoveryError('');
    try {
      await sendStaffPasswordResetEmail(recoveryEmail);
      setRecoverySent(true);
      playHospitalChime();
      onShowToast('Password Reset Email Sent', 'Check your inbox for a password reset link.', 'success');
    } catch (error) {
      console.error('Unable to send staff password reset email:', error);
      setRecoveryError('Unable to send the reset email. Check the address and try again, or contact hospital IT.');
    } finally {
      setIsSendingRecovery(false);
    }
  };

  return (
    <div className="min-h-screen text-[#173B40] dark:text-[#F1F5F9] flex flex-col font-sans transition-colors duration-200 relative overflow-x-hidden selection:bg-[#2EBB86]/20 selection:text-[#006B67] bg-[radial-gradient(ellipse_at_top,_rgba(46,187,134,0.08),_transparent_52%),#F5FAF7] bg-no-repeat">
      <img
        src="/mediqueue-logo.png"
        alt="Medi Queue"
        className="pointer-events-none absolute left-3 top-3 z-20 h-[23.78vw] w-[23.78vw] select-none object-contain sm:left-4 sm:top-4 sm:h-[min(160px,20vw)] sm:w-[min(160px,20vw)]"
      />
      {/* MAIN CONTENT AREA */}
      <main className="relative z-10 flex-1 w-full min-h-[100svh] max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 flex items-center justify-center">
        {/* Left Column: Hospital Clinical Highlights (Visible on Desktop) */}
        <div className="hidden">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-400/30 text-cyan-200 text-xs font-bold uppercase tracking-wider backdrop-blur-md w-fit">
            <Lock className="w-3.5 h-3.5 text-cyan-300" />
            <span>Authorized Clinical Personnel Gateway</span>
          </div>

          <h1 className="text-3xl sm:text-4xl xl:text-5xl font-black text-white tracking-tight leading-[1.15] font-heading drop-shadow-md">
            Hospital Clinical Operations & Triage Hub
          </h1>

          <p className="text-sm sm:text-base text-cyan-100/85 leading-relaxed">
            Secure high-availability authentication for doctors, triage officers, nursing in-charge, and hospital administration to manage real-time OPD queues, live patient calling, and emergency bay escalations.
          </p>

          <div className="grid grid-cols-2 gap-3.5 pt-2">
            <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-400/20 text-cyan-300 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Live OPD Telemetry</h4>
                <p className="text-[11px] text-cyan-100/75 mt-0.5">Real-time doctor token queues & ETA sync</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-400/20 text-rose-300 flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Casualty Bay Escalation</h4>
                <p className="text-[11px] text-cyan-100/75 mt-0.5">Instant Code Red triage override & alert</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">ICMR / NABH Compliant</h4>
                <p className="text-[11px] text-cyan-100/75 mt-0.5">Role-based encrypted clinical access</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Digital EHR & Records</h4>
                <p className="text-[11px] text-cyan-100/75 mt-0.5">Instant consultation documentation</p>
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center gap-3 text-xs text-cyan-100/80">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Max Super Specialty Hospital, Mohali • Clinical Network Online</span>
            </span>
          </div>
        </div>

        {/* Right Column: Staff Authentication Card */}
        <div className="w-full flex justify-center animate-in fade-in zoom-in-95 duration-300">
          <div className="w-full sm:w-[min(92vw,480px)] lg:w-[440px] xl:w-[470px] bg-white/70 dark:bg-[#162927]/72 backdrop-blur-xl rounded-[24px] border border-white/85 dark:border-[#284440]/80 shadow-[0_24px_70px_rgba(0,107,103,0.14)] overflow-hidden transition-all duration-300">
            {/* Top Hospital Badge Header */}
            <div className="bg-white/42 dark:bg-[#1B302D]/50 backdrop-blur-lg p-6 text-[#173B40] dark:text-white text-center relative border-b border-[#DCEBE3]/90 dark:border-[#284440]">
              <div className="w-14 h-14 rounded-2xl bg-[#E8F8EF]/90 dark:bg-[#087F78]/25 border border-[#BFE8D1] dark:border-[#31534B] text-[#006B67] dark:text-[#66D4A5] flex items-center justify-center text-2xl mx-auto mb-3 shadow-sm">
                <i className="fa-solid fa-hospital-user"></i>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F8EF]/80 dark:bg-[#087F78]/20 border border-[#BFE8D1] dark:border-[#31534B] text-[#087F78] dark:text-[#66D4A5] text-[10px] font-bold uppercase tracking-wider mb-2">
                <i className="fa-solid fa-lock text-[9px]"></i>
                <span>Authorized Personnel Only</span>
              </div>
              <h2 className="text-xl font-black text-[#173B40] dark:text-white tracking-tight font-heading">
                Hospital Staff & Admin Portal
              </h2>
              <p className="text-xs text-[#647875] dark:text-[#A8BDB6] mt-1 max-w-xs mx-auto">
                Secure clinical authentication for doctors, triage officers, and hospital administration.
              </p>
            </div>

            {/* Login Form Body */}
            <div className="p-6 sm:p-7 space-y-3">
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5 animate-in shake duration-200">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium">{errorMessage}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                    <span>Hospital Email Address</span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">Use your registered staff email</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500 text-xs">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      placeholder="admin10mediqueue@gmail.com"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white bg-white dark:bg-[#162238] placeholder:text-slate-400 focus:outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPasswordModal(true);
                        setRecoverySent(false);
                        setRecoveryError('');
                        setRecoveryEmail(email || '');
                      }}
                      className="text-[11px] text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:underline font-bold cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500 text-xs">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      placeholder="Enter hospital password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white bg-white dark:bg-[#162238] placeholder:text-slate-400 focus:outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer text-xs"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 rounded-xl bg-[#006B67] hover:bg-[#087F78] text-white font-bold text-xs sm:text-sm shadow-md shadow-[#006B67]/15 hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.99]"
                  >
                    {isLoading ? (
                      <>
                        <i className="fa-solid fa-spinner animate-spin"></i>
                        <span>Authenticating Staff Credentials...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Sign In to Hospital Console</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Return to Patient Portal Link */}
              <div className="pt-2 text-center border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 font-semibold inline-flex items-center gap-1.5 cursor-pointer py-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Patient Portal</span>
                </button>
              </div>

              {/* Security Footnote */}
              <div className="pt-1 text-center text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
                <Lock className="w-3 h-3 text-emerald-500" />
                <span>ICMR & NABH Hospital Data Compliance • 256-bit SSL Session</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* TRANSLUCENT FOOTER */}
      <footer className="relative z-10 border-t border-white/10 bg-white/5 backdrop-blur-md py-3.5 px-4 text-center text-xs text-cyan-100/70">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-heading font-extrabold text-white">Medi Queue™</span>
            <span>— Smarter Hospitals. Shorter Queues.</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] flex-wrap justify-center">
            <span className="flex items-center gap-1.5 text-cyan-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Authorized Hospital Staff Gateway</span>
            </span>
            <span>•</span>
            <button
              type="button"
              onClick={onCancel}
              className="hover:text-white underline cursor-pointer text-cyan-200"
            >
              Patient Portal Access
            </button>
            <span>•</span>
            <span className="text-cyan-200">ICMR Clinical Board Verified</span>
          </div>
        </div>
      </footer>

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                <KeyRound className="w-4 h-4 text-sky-500" />
                <span>Reset Staff Password</span>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {recoverySent ? (
              <div className="text-center py-3 space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Check Your Email</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  If this address is registered, Firebase has sent a password reset link. Follow the link to choose a new password.
                </p>
                <button
                  type="button"
                  onClick={() => setShowForgotPasswordModal(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-sky-600 text-white text-xs font-bold hover:bg-slate-800 dark:hover:bg-sky-700 transition cursor-pointer"
                >
                  Return to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendRecovery} className="space-y-3.5">
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Enter your registered hospital work email to receive a password recovery link.
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Work Email
                  </label>
                  <input
                    type="email"
                    required
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="admin10mediqueue@gmail.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#162238] text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
                {recoveryError && (
                  <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
                    {recoveryError}
                  </p>
                )}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotPasswordModal(false)}
                    className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingRecovery}
                    className="flex-1 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSendingRecovery ? (
                      <span>Sending...</span>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Link</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
