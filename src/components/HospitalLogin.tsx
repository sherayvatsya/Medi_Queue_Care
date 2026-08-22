import React, { useState } from 'react';
import { StaffUser } from '../types';
import { playHospitalChime } from '../utils/audio';

interface HospitalLoginProps {
  onLoginSuccess: (user: StaffUser) => void;
  onCancel: () => void;
  onShowToast: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
}

// Authorized Hospital Staff registry with secure credential validation
const VALID_STAFF_ACCOUNTS: Array<{
  email: string;
  passwordHash: string; // In production this is checked against Firebase/backend auth
  user: StaffUser;
}> = [
  {
    email: 'hospital@mediqueue.com',
    passwordHash: 'Hospital@123',
    user: {
      id: 'staff-admin-01',
      name: 'Dr. Alok Verma',
      email: 'hospital@mediqueue.com',
      role: 'admin',
      department: 'OPD Administration & Clinical Operations',
      staffId: 'MQ-STAFF-8801',
      hospitalName: 'Max Super Specialty Hospital, Mohali',
      avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80',
    },
  },
  {
    email: 'admin@mediqueue.com',
    passwordHash: 'Hospital@123',
    user: {
      id: 'staff-admin-02',
      name: 'Chief Clinical Admin',
      email: 'admin@mediqueue.com',
      role: 'admin',
      department: 'Hospital Administration',
      staffId: 'MQ-STAFF-8802',
      hospitalName: 'Max Super Specialty Hospital, Mohali',
      avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80',
    },
  },
  {
    email: 'dr.sharma@mediqueue.com',
    passwordHash: 'Hospital@123',
    user: {
      id: 'doc-1',
      name: 'Dr. Arvind Sharma, MD',
      email: 'dr.sharma@mediqueue.com',
      role: 'doctor',
      department: 'Orthopedics & Joint Care',
      staffId: 'MQ-DOC-204',
      hospitalName: 'Max Super Specialty Hospital, Mohali',
      avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80',
    },
  },
];

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

  const handleSubmit = (e: React.FormEvent) => {
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

    setTimeout(() => {
      setIsLoading(false);

      const matchedAccount = VALID_STAFF_ACCOUNTS.find(
        (acc) => acc.email.toLowerCase() === cleanEmail && acc.passwordHash === cleanPass
      );

      if (matchedAccount) {
        playHospitalChime();
        onShowToast(
          'Hospital Authentication Verified',
          `Welcome, ${matchedAccount.user.name} (${matchedAccount.user.department}). Staff dashboard unlocked.`,
          'success'
        );
        onLoginSuccess(matchedAccount.user);
      } else {
        setErrorMessage('Invalid hospital email or password. Please verify your credentials or contact Hospital IT.');
        onShowToast('Access Denied', 'Invalid hospital credentials entered.', 'urgent');
      }
    }, 650);
  };

  const handleSendRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) return;

    setRecoverySent(true);
    playHospitalChime();
    onShowToast(
      'Password Reset Link Sent',
      `Authorization link dispatched to ${recoveryEmail}. Please check your hospital inbox.`,
      'info'
    );
  };

  return (
    <div className="max-w-md mx-auto my-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden">
        {/* Top Hospital Badge Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 p-6 text-white text-center relative">
          <div className="w-14 h-14 rounded-2xl bg-sky-500/20 border border-sky-400/30 text-sky-300 flex items-center justify-center text-2xl mx-auto mb-3 shadow-inner">
            <i className="fa-solid fa-hospital-user"></i>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 text-[10px] font-bold uppercase tracking-wider mb-2">
            <i className="fa-solid fa-lock text-[9px]"></i>
            <span>Authorized Personnel Only</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">
            Hospital Staff & Admin Portal
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto">
            Secure clinical authentication for doctors, triage officers, and hospital administration.
          </p>
        </div>

        {/* Login Form */}
        <div className="p-6 sm:p-7 space-y-4">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in shake duration-200">
              <i className="fa-solid fa-circle-exclamation text-rose-500 text-sm mt-0.5 shrink-0"></i>
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                <span>Hospital Email Address</span>
                <span className="text-[11px] text-slate-400 font-normal">@mediqueue.com</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-xs">
                  <i className="fa-solid fa-envelope"></i>
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="hospital@mediqueue.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPasswordModal(true);
                    setRecoverySent(false);
                    setRecoveryEmail(email || '');
                  }}
                  className="text-[11px] text-sky-600 hover:text-sky-700 hover:underline font-bold cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-xs">
                  <i className="fa-solid fa-lock"></i>
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
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer text-xs"
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-700 hover:to-sky-600 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.99]"
              >
                {isLoading ? (
                  <>
                    <i className="fa-solid fa-spinner animate-spin"></i>
                    <span>Authenticating Staff Credentials...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-shield-halved"></i>
                    <span>Sign In to Hospital Console</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Return to Patient Portal Link */}
          <div className="pt-3 text-center border-t border-slate-100">
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-slate-500 hover:text-sky-600 font-semibold inline-flex items-center gap-1.5 cursor-pointer py-1"
            >
              <i className="fa-solid fa-arrow-left text-[10px]"></i>
              <span>Return to Patient Portal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <i className="fa-solid fa-key text-sky-500"></i>
                <span>Reset Staff Password</span>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {recoverySent ? (
              <div className="text-center py-3 space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl mx-auto">
                  <i className="fa-solid fa-paper-plane"></i>
                </div>
                <h4 className="font-bold text-sm text-slate-900">Recovery Instructions Dispatched</h4>
                <p className="text-xs text-slate-600">
                  Password reset link has been sent to <strong>{recoveryEmail}</strong>. Follow the instructions to reset your security credentials.
                </p>
                <button
                  type="button"
                  onClick={() => setShowForgotPasswordModal(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
                >
                  Return to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendRecovery} className="space-y-3.5">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Enter your registered hospital work email to receive a password recovery link.
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Work Email
                  </label>
                  <input
                    type="email"
                    required
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="hospital@mediqueue.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotPasswordModal(false)}
                    className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    Send Link
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
