import React, { useState, useEffect } from 'react';
import { PatientUser } from '../types';
import { INITIAL_PATIENT_USERS, generateAlphanumericUHID } from '../data/mockData';
import { playHospitalChime } from '../utils/audio';
import { signInWithGoogle } from '../firebase';

interface OTPAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: PatientUser) => void;
  onShowToast: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
}

export const OTPAuthModal: React.FC<OTPAuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onShowToast,
}) => {
  const [authStep, setAuthStep] = useState<1 | 2>(1);
  const [mobileNumber, setMobileNumber] = useState<string>('9820055432');
  const [otpDigits, setOtpDigits] = useState<string[]>(['5', '4', '1', '2', '9', '0']);
  const [resendTimer, setResendTimer] = useState<number>(30);
  const [canResend, setCanResend] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);

  // New user registration fields if mobile doesn't exist
  const [newName, setNewName] = useState<string>('Arjun Sen');
  const [newAge, setNewAge] = useState<number>(34);
  const [newGender, setNewGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [newBloodGroup, setNewBloodGroup] = useState<string>('O+');
  const [newEmergencyContact, setNewEmergencyContact] = useState<string>('Pooja Sen (Spouse)');
  const [newEmergencyPhone, setNewEmergencyPhone] = useState<string>('+91 98200 11990');
  const [newAllergies, setNewAllergies] = useState<string>('None known');

  // Timer countdown for Step 2
  useEffect(() => {
    let timer: any;
    if (isOpen && authStep === 2 && resendTimer > 0) {
      timer = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen, authStep, resendTimer]);

  if (!isOpen) return null;

  // Firebase Google Sign In Handler
  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      const user = await signInWithGoogle();
      if (user) {
        onLoginSuccess(user);
        playHospitalChime();
        onShowToast(
          'Google Sign-In Successful',
          `Welcome, ${user.name}! Connected with Firebase Auth & UHID: ${user.uhid}`,
          'success'
        );
        onClose();
      }
    } catch (err: any) {
      console.error('Google Sign In error:', err);
      onShowToast('Google Sign-In Notice', err?.message || 'Could not authenticate with Google. You can use mobile OTP.', 'urgent');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSendOTP = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileNumber || mobileNumber.replace(/\D/g, '').length < 10) {
      onShowToast('Invalid Mobile', 'Please enter a valid 10-digit mobile number.', 'urgent');
      return;
    }

    setAuthStep(2);
    setResendTimer(30);
    setCanResend(false);
    playHospitalChime();
    onShowToast(
      'OTP Sent via SMS',
      `6-digit verification code sent to +91 ${mobileNumber}. (Auto-filled for demo: 541290)`,
      'info'
    );
  };

  const handleResendOTP = () => {
    if (!canResend) return;
    setResendTimer(30);
    setCanResend(false);
    setOtpDigits(['5', '4', '1', '2', '9', '0']);
    playHospitalChime();
    onShowToast('OTP Resent', `New code sent to +91 ${mobileNumber}.`, 'info');
  };

  const handleOtpDigitChange = (index: number, val: string) => {
    const cleanVal = val.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = cleanVal;
    setOtpDigits(newDigits);

    // Auto-focus next input
    if (cleanVal && index < 5) {
      const nextInput = document.getElementById(`otp-digit-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleVerifyOTP = () => {
    const fullOtp = otpDigits.join('');
    if (fullOtp.length < 6) {
      onShowToast('Incomplete Code', 'Please enter all 6 digits of the OTP.', 'urgent');
      return;
    }

    setIsVerifying(true);

    setTimeout(() => {
      setIsVerifying(false);
      const cleanPhone = mobileNumber.replace(/\D/g, '');
      const existingUser = INITIAL_PATIENT_USERS.find(
        (u) => u.phone.replace(/\D/g, '').includes(cleanPhone) || cleanPhone.includes(u.phone.replace(/\D/g, ''))
      );

      if (existingUser) {
        onLoginSuccess(existingUser);
        playHospitalChime();
        onShowToast(
          'Sign In Successful',
          `Welcome back, ${existingUser.name} (${existingUser.uhid}). Profile loaded from database!`,
          'success'
        );
        onClose();
      } else {
        // Create new patient profile with expandable alphanumeric UHID
        const newUhid = generateAlphanumericUHID('DEL');
        const user: PatientUser = {
          id: `user-${Date.now()}`,
          uhid: newUhid,
          name: newName || 'Patient User',
          phone: `+91 ${mobileNumber}`,
          email: `${newName.toLowerCase().replace(/\s+/g, '') || 'patient'}@example.com`,
          age: newAge || 35,
          gender: newGender,
          bloodGroup: newBloodGroup,
          emergencyContactName: newEmergencyContact || 'Emergency Contact',
          emergencyContactPhone: newEmergencyPhone || '+91 99999 00000',
          allergies: newAllergies ? newAllergies.split(',').map((s) => s.trim()) : [],
          chronicConditions: [],
          registeredAt: new Date().toISOString().split('T')[0],
          hasHealthPass: false,
        };

        onLoginSuccess(user);
        playHospitalChime();
        onShowToast(
          'Registration Complete',
          `Account created with Unique ID: ${newUhid}. Saved to hospital database.`,
          'success'
        );
        onClose();
      }
    }, 800);
  };

  const handleQuickFill = (user: PatientUser) => {
    const cleanNumber = user.phone.replace('+91', '').trim().replace(/\s/g, '');
    setMobileNumber(cleanNumber);
    setNewName(user.name);
    setNewAge(user.age);
    setNewGender(user.gender);
    setNewBloodGroup(user.bloodGroup);
    setNewAllergies(user.allergies.join(', '));
    setAuthStep(1);
    playHospitalChime();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 text-slate-700 max-h-[90vh] overflow-y-auto box-border">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center text-lg font-bold shadow-xs shrink-0">
              <i className="fa-solid fa-hospital-user"></i>
            </span>
            <div className="min-w-0">
              <h3 className="font-extrabold text-base text-slate-900 truncate">
                {authStep === 1 ? 'Patient Portal Sign-In' : 'Verify Mobile OTP'}
              </h3>
              <p className="text-xs text-slate-500">
                {authStep === 1 ? 'Google Account or Mobile OTP with Firebase' : 'Step 2: 6-digit SMS verification'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-base cursor-pointer p-1 shrink-0"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* STEP 1: AUTH SELECTION */}
        {authStep === 1 ? (
          <div className="py-4 space-y-4">
            {/* Google Firebase Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading}
              className="w-full py-3 px-4 rounded-xl border border-slate-300 hover:border-sky-500 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isGoogleLoading ? (
                <>
                  <i className="fa-solid fa-circle-notch animate-spin text-sky-500"></i>
                  <span>Connecting to Google Account...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google Sign-In</span>
                </>
              )}
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="shrink-0 mx-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Or Use Mobile OTP
              </span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <form onSubmit={handleSendOTP} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Mobile Number (India)
                </label>
                <div className="flex items-center rounded-xl border border-slate-300 overflow-hidden focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 transition bg-slate-50">
                  <div className="px-3 py-2.5 bg-slate-200/80 text-xs font-bold text-slate-700 border-r border-slate-300 flex items-center gap-1.5 shrink-0">
                    <span>🇮🇳</span>
                    <span>+91</span>
                  </div>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="98200 55432"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                    className="flex-1 px-3 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Quick Demo Fill Accounts */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  ⚡ Quick-Select Demo Patient
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {INITIAL_PATIENT_USERS.slice(0, 4).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleQuickFill(u)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:border-sky-500 hover:bg-sky-50 text-left transition cursor-pointer text-xs"
                    >
                      <p className="font-bold text-slate-900 truncate">{u.name}</p>
                      <p className="text-[10px] text-sky-600 font-mono">{u.uhid}</p>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition shadow-sm cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Get OTP Code</span>
                <i className="fa-solid fa-arrow-right text-xs"></i>
              </button>
            </form>
          </div>
        ) : (
          /* STEP 2: 6-DIGIT OTP VERIFICATION */
          <div className="py-4 space-y-4">
            <div className="text-center">
              <p className="text-xs text-slate-600">
                Enter 6-digit code sent to <strong className="text-slate-900">+91 {mobileNumber}</strong>
              </p>
              <button
                type="button"
                onClick={() => setAuthStep(1)}
                className="text-[11px] text-sky-600 font-bold hover:underline mt-0.5 cursor-pointer"
              >
                Change Phone Number
              </button>
            </div>

            {/* 6-Digit OTP Input Grid */}
            <div className="flex items-center justify-center gap-1.5 sm:gap-2">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  id={`otp-digit-${idx}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                  className="w-9 sm:w-12 h-11 sm:h-12 text-center text-base sm:text-lg font-black text-slate-900 rounded-xl border border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-hidden bg-slate-50"
                />
              ))}
            </div>

            {/* Resend OTP countdown */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>Didn't receive SMS?</span>
              {canResend ? (
                <button
                  type="button"
                  onClick={handleResendOTP}
                  className="text-sky-600 font-bold hover:underline cursor-pointer"
                >
                  Resend OTP Now
                </button>
              ) : (
                <span className="font-mono text-sky-600">
                  Resend in <strong>{resendTimer}s</strong>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAuthStep(1)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleVerifyOTP}
                disabled={isVerifying}
                className="flex-2 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition shadow-sm cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isVerifying ? (
                  <>
                    <i className="fa-solid fa-spinner animate-spin"></i>
                    <span>Verifying Secure OTP...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-circle-check"></i>
                    <span>Verify & Login</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
