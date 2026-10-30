import React, { useState } from 'react';
import { StaffUser } from '../types';
import { authenticateStaffWithRole } from '../firebase';
import { playHospitalChime, playUrgentAlertSound } from '../utils/audio';
import {
  Stethoscope,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowLeft,
  ShieldCheck,
  Building2,
  Activity,
  AlertCircle,
  Sparkles,
  UserCheck,
} from 'lucide-react';

interface DoctorLoginPageProps {
  onLoginSuccess: (user: StaffUser) => void;
  onNavigateAdminLogin: () => void;
  onBackToPatientPortal: () => void;
  onShowToast?: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
}

export const DoctorLoginPage: React.FC<DoctorLoginPageProps> = ({
  onLoginSuccess,
  onNavigateAdminLogin,
  onBackToPatientPortal,
  onShowToast,
}) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const notify = (title: string, desc: string, type: 'info' | 'success' | 'urgent' = 'info') => {
    if (onShowToast) {
      onShowToast(title, desc, type);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim()) {
      setErrorMessage('Please enter your authorized doctor email address.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Please enter your clinical access security password.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authenticateStaffWithRole(email.trim(), password.trim(), 'doctor');

      if (!result.success || !result.user) {
        setIsLoading(false);
        const errMsg = result.error || 'Doctor authentication failed.';
        setErrorMessage(errMsg);
        playUrgentAlertSound();
        notify('Authentication Failed', errMsg, 'urgent');
        return;
      }

      setIsLoading(false);
      playHospitalChime();
      notify(
        'Doctor Access Granted',
        `Welcome, ${result.user.name}. Loading clinical queue for ${result.user.department}...`,
        'success'
      );
      onLoginSuccess(result.user);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err?.message || 'Unexpected login error. Please retry.');
    }
  };

  const handleDemoDoctorSelect = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('');
    setErrorMessage('');
    playHospitalChime();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#042f2e]/10 via-[#F6F9FC] to-[#0f766e]/10 dark:from-black dark:via-[#09090b] dark:to-[#042f2e]/20 flex flex-col justify-center items-center p-4 sm:p-6">
      {/* Top Navigation */}
      <div className="w-full max-w-md flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={onBackToPatientPortal}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 dark:text-teal-400 hover:text-teal-900 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Patient Portal</span>
        </button>

        <span className="px-3 py-1 rounded-full bg-teal-100 dark:bg-teal-950/70 border border-teal-300 dark:border-teal-800 text-teal-800 dark:text-teal-300 text-[11px] font-mono font-bold">
          CLINICAL OPD PORTAL
        </span>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-white dark:bg-[#0a0a0c] border border-teal-100 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header Icon & Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3.5 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white shadow-lg shadow-teal-600/25 mb-1">
            <Stethoscope className="w-8 h-8" />
          </div>
          <h1 className="font-heading font-black text-2xl text-slate-900 dark:text-white tracking-tight">
            Doctor Clinical Portal
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sign in with authorized physician credentials to manage patient queue, prescriptions, and consultations.
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-teal-600" />
              <span>Doctor Email Address</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dr.sharma@mediqueue.com"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500 transition"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-teal-600" />
              <span>Clinical Security Password</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3.5 rounded-2xl font-heading font-extrabold text-xs uppercase tracking-wider text-white shadow-lg transition cursor-pointer flex items-center justify-center gap-2 ${
              isLoading
                ? 'bg-slate-400 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:brightness-105 active:scale-[0.99] shadow-teal-600/30'
            }`}
          >
            {isLoading ? (
              <span>Verifying Physician Credentials...</span>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Sign In to Doctor Dashboard</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Doctor Accounts */}
        <div className="pt-2 border-t border-slate-100 dark:border-neutral-800 space-y-2">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 text-center">
            Doctor email addresses (click to fill):
          </div>
          <div className="grid grid-cols-1 gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => handleDemoDoctorSelect('dr.sharma@mediqueue.com')}
              className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-neutral-900 hover:bg-teal-50 dark:hover:bg-teal-950/50 border border-slate-200 dark:border-neutral-800 text-left flex items-center justify-between transition cursor-pointer"
            >
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Dr. Arvind Sharma (Orthopedics)
              </span>
              <span className="text-[10px] font-mono text-teal-600">dr.sharma@mediqueue.com</span>
            </button>
            <button
              type="button"
              onClick={() => handleDemoDoctorSelect('dr.nair@mediqueue.com')}
              className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-neutral-900 hover:bg-teal-50 dark:hover:bg-teal-950/50 border border-slate-200 dark:border-neutral-800 text-left flex items-center justify-between transition cursor-pointer"
            >
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Dr. Priya Nair (Cardiology)
              </span>
              <span className="text-[10px] font-mono text-teal-600">dr.nair@mediqueue.com</span>
            </button>
            <button
              type="button"
              onClick={() => handleDemoDoctorSelect('dr.verma@mediqueue.com')}
              className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-neutral-900 hover:bg-teal-50 dark:hover:bg-teal-950/50 border border-slate-200 dark:border-neutral-800 text-left flex items-center justify-between transition cursor-pointer"
            >
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Dr. Rajesh Verma (General Medicine)
              </span>
              <span className="text-[10px] font-mono text-teal-600">dr.verma@mediqueue.com</span>
            </button>
          </div>
        </div>

        {/* Switch to Admin Login */}
        <div className="pt-2 text-center border-t border-slate-100 dark:border-neutral-800">
          <button
            type="button"
            onClick={onNavigateAdminLogin}
            className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 transition cursor-pointer"
          >
            Hospital Administrator or Staff? <span className="underline text-teal-600">Switch to Admin Portal →</span>
          </button>
        </div>
      </div>
    </div>
  );
};
