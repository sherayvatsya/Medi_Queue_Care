import React, { useState } from 'react';
import {
  PatientUser,
  MedicalExtractionResult,
  ExtractedConfidence,
} from '../types';
import { INITIAL_PATIENT_USERS, generateAlphanumericUHID } from '../data/mockData';
import { playHospitalChime } from '../utils/audio';
import { signInWithGoogle, saveUserProfileToFirestore } from '../firebase';
import confetti from 'canvas-confetti';
import hospitalQueueBg from '../../assets/hospital-queue-bg.png';
import { SmartDocumentUpload } from './SmartDocumentUpload';
import { ExtractedFieldIndicator } from './ExtractedFieldIndicator';
import {
  ShieldCheck,
  Send,
  Lock,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Home,
  UserCheck,
  KeyRound,
  IdCard,
  Eye,
  EyeOff,
  HeartPulse,
} from 'lucide-react';

interface PatientAuthProps {
  onLoginSuccess: (user: PatientUser) => void;
  onEmergencyBypass?: () => void;
  onShowToast?: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
  onBackToHome?: () => void;
  onOpenSupportModal?: () => void;
  onOpenHospitalStaffLogin?: () => void;
}

export const PatientAuth: React.FC<PatientAuthProps> = ({
  onLoginSuccess,
  onEmergencyBypass,
  onShowToast,
  onBackToHome,
  onOpenSupportModal,
  onOpenHospitalStaffLogin,
}) => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'otp_verify'>('signin');
  const [loginIdentifier, setLoginIdentifier] = useState<string>('SJMC-2026-DEL-08942A');
  const [loginPin, setLoginPin] = useState<string>('1234');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [authMethod, setAuthMethod] = useState<'otp' | 'pin'>('otp');
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [generatedOtp, setGeneratedOtp] = useState<string>('4829');
  const [enteredOtp, setEnteredOtp] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sign Up Form State
  const [signupName, setSignupName] = useState<string>('');
  const [signupPhone, setSignupPhone] = useState<string>('');
  const [signupEmail, setSignupEmail] = useState<string>('');
  const [signupAge, setSignupAge] = useState<number>(35);
  const [signupGender, setSignupGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [signupBloodGroup, setSignupBloodGroup] = useState<string>('O+');
  const [signupEmergencyName, setSignupEmergencyName] = useState<string>('');
  const [signupEmergencyPhone, setSignupEmergencyPhone] = useState<string>('');
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [customAllergy, setCustomAllergy] = useState<string>('');
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [customCondition, setCustomCondition] = useState<string>('');
  const [showCustomConditionInput, setShowCustomConditionInput] = useState<boolean>(false);
  const [agreedTerms, setAgreedTerms] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Modals for Forgot UHID / PIN
  const [showForgotUhidModal, setShowForgotUhidModal] = useState<boolean>(false);
  const [showForgotPinModal, setShowForgotPinModal] = useState<boolean>(false);
  const [recoveryPhone, setRecoveryPhone] = useState<string>('');

  // Smart Registration Extraction State
  const [fieldConfidence, setFieldConfidence] = useState<ExtractedConfidence>({});
  const [extractedFields, setExtractedFields] = useState<Record<string, boolean>>({});
  const [extractedMedications, setExtractedMedications] = useState<string[]>([]);
  const [extractedDiagnoses, setExtractedDiagnoses] = useState<string[]>([]);
  const [extractedDocType, setExtractedDocType] = useState<string>('');
  const [extractionBannerVisible, setExtractionBannerVisible] = useState<boolean>(false);

  const notify = (title: string, desc: string, type: 'info' | 'success' | 'urgent' = 'info') => {
    if (onShowToast) {
      onShowToast(title, desc, type);
    }
  };

  // Auto-population handler following clinical & confidence guidelines
  const handleDocumentExtracted = (data: MedicalExtractionResult) => {
    const newExtracted: Record<string, boolean> = {};
    const conf = data.confidence || {};
    setFieldConfidence(conf);

    if (data.fullName && (conf.fullName === undefined || conf.fullName >= 0.6)) {
      setSignupName(data.fullName);
      newExtracted.fullName = true;
    }

    if (data.mobileNumber && (conf.mobileNumber === undefined || conf.mobileNumber >= 0.6)) {
      setSignupPhone(data.mobileNumber.replace(/[^\d+ ]/g, '').trim());
      newExtracted.mobileNumber = true;
    }

    if (data.email && (conf.email === undefined || conf.email >= 0.6)) {
      setSignupEmail(data.email.trim());
      newExtracted.email = true;
    }

    if (typeof data.age === 'number' && !isNaN(data.age) && (conf.age === undefined || conf.age >= 0.6)) {
      setSignupAge(data.age);
      newExtracted.age = true;
    }

    if (data.gender && ['Male', 'Female', 'Other'].includes(data.gender) && (conf.gender === undefined || conf.gender >= 0.6)) {
      setSignupGender(data.gender as 'Male' | 'Female' | 'Other');
      newExtracted.gender = true;
    }

    if (data.bloodGroup && (conf.bloodGroup === undefined || conf.bloodGroup >= 0.6)) {
      const rawBg = data.bloodGroup.toUpperCase().replace(/\s+/g, '');
      const validBgs = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
      let matchedBg = validBgs.find((b) => b === rawBg);
      if (!matchedBg) {
        if (rawBg.includes('O') && rawBg.includes('+')) matchedBg = 'O+';
        else if (rawBg.includes('O') && rawBg.includes('-')) matchedBg = 'O-';
        else if (rawBg.includes('AB') && rawBg.includes('+')) matchedBg = 'AB+';
        else if (rawBg.includes('AB') && rawBg.includes('-')) matchedBg = 'AB-';
        else if (rawBg.includes('A') && rawBg.includes('+')) matchedBg = 'A+';
        else if (rawBg.includes('A') && rawBg.includes('-')) matchedBg = 'A-';
        else if (rawBg.includes('B') && rawBg.includes('+')) matchedBg = 'B+';
        else if (rawBg.includes('B') && rawBg.includes('-')) matchedBg = 'B-';
      }
      if (matchedBg) {
        setSignupBloodGroup(matchedBg);
        newExtracted.bloodGroup = true;
      }
    }

    if (data.emergencyContactName && (conf.emergencyContactName === undefined || conf.emergencyContactName >= 0.6)) {
      setSignupEmergencyName(data.emergencyContactName);
      newExtracted.emergencyContactName = true;
    }

    if (data.emergencyContactPhone && (conf.emergencyContactPhone === undefined || conf.emergencyContactPhone >= 0.6)) {
      setSignupEmergencyPhone(data.emergencyContactPhone.replace(/[^\d+ ]/g, '').trim());
      newExtracted.emergencyContactPhone = true;
    }

    if (data.allergies && data.allergies.length > 0 && (conf.allergies === undefined || conf.allergies >= 0.6)) {
      const stdAllergies = ['Penicillin', 'Sulfa Drugs', 'Aspirin/NSAIDs', 'Latex', 'Dust / Pollen', 'Contrast Dye'];
      const resolvedAllergies: string[] = [];
      data.allergies.forEach((alg) => {
        const trimmed = alg.trim();
        const lower = trimmed.toLowerCase();
        if (lower === 'none' || lower === 'nkda' || lower.includes('no known')) {
          resolvedAllergies.push('None');
        } else {
          const found = stdAllergies.find((s) => s.toLowerCase() === lower || lower.includes(s.toLowerCase()));
          if (found) {
            if (!resolvedAllergies.includes(found)) resolvedAllergies.push(found);
          } else {
            if (!resolvedAllergies.includes(trimmed)) resolvedAllergies.push(trimmed);
          }
        }
      });
      if (resolvedAllergies.length > 0) {
        setSelectedAllergies(resolvedAllergies);
        newExtracted.allergies = true;
      }
    }

    if (data.medicalConditions && data.medicalConditions.length > 0 && (conf.medicalConditions === undefined || conf.medicalConditions >= 0.6)) {
      const stdConditions = [
        { key: 'Hypertension (High BP)', match: ['hypertens', 'high bp', 'blood pressure', 'htn'] },
        { key: 'Type 2 Diabetes', match: ['diabetes', 't2d', 'dm2', 'type 2', 'diabetic'] },
        { key: 'Asthma / COPD', match: ['asthma', 'copd', 'bronchial', 'respiratory'] },
        { key: 'Thyroid Disorder', match: ['thyroid', 'hypothyroid', 'hyperthyroid'] },
        { key: 'Heart Disease', match: ['heart', 'cardiac', 'cad', 'chd', 'angina'] },
        { key: 'Arthritis', match: ['arthritis', 'osteoarthritis', 'rheumatoid'] },
      ];
      const resolvedConditions: string[] = [];
      data.medicalConditions.forEach((c) => {
        const lower = c.trim().toLowerCase();
        if (lower === 'none' || lower.includes('no prior') || lower.includes('nil')) {
          resolvedConditions.push('None');
        } else {
          const matched = stdConditions.find((item) => item.match.some((m) => lower.includes(m)));
          if (matched) {
            if (!resolvedConditions.includes(matched.key)) resolvedConditions.push(matched.key);
          } else {
            if (!resolvedConditions.includes(c.trim())) resolvedConditions.push(c.trim());
          }
        }
      });
      if (resolvedConditions.length > 0) {
        setSelectedConditions(resolvedConditions);
        newExtracted.medicalConditions = true;
      }
    }

    if (data.medications) setExtractedMedications(data.medications);
    if (data.diagnoses) setExtractedDiagnoses(data.diagnoses);
    if (data.documentType) setExtractedDocType(data.documentType);

    setExtractedFields(newExtracted);
    setExtractionBannerVisible(true);
  };

  const handleClearExtractedData = () => {
    setFieldConfidence({});
    setExtractedFields({});
    setExtractedMedications([]);
    setExtractedDiagnoses([]);
    setExtractedDocType('');
    setExtractionBannerVisible(false);
    setSignupName('');
    setSignupPhone('');
    setSignupEmail('');
    setSignupAge(35);
    setSignupGender('Male');
    setSignupBloodGroup('O+');
    setSignupEmergencyName('');
    setSignupEmergencyPhone('');
    setSelectedAllergies([]);
    setSelectedConditions([]);
  };

  const handleClearSingleField = (field: string) => {
    setExtractedFields((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setFieldConfidence((prev) => {
      const next = { ...prev };
      delete (next as any)[field];
      return next;
    });
    if (field === 'fullName') setSignupName('');
    else if (field === 'mobileNumber') setSignupPhone('');
    else if (field === 'email') setSignupEmail('');
    else if (field === 'emergencyContactName') setSignupEmergencyName('');
    else if (field === 'emergencyContactPhone') setSignupEmergencyPhone('');
    else if (field === 'allergies') setSelectedAllergies([]);
    else if (field === 'medicalConditions') setSelectedConditions([]);
  };

  const getFieldBorderClass = (fieldName: string) => {
    if (!extractedFields[fieldName]) {
      return 'border-[#DCE7F0] dark:border-[#334155] focus:border-[#0B9FE3] dark:focus:border-[#0B9FE3]';
    }
    const conf = (fieldConfidence as any)[fieldName];
    if (conf !== undefined && conf < 0.85) {
      return 'border-amber-400 bg-amber-50/30 dark:bg-amber-950/20';
    }
    return 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20';
  };

  // Google Sign-In Handler
  const handleGoogleSignIn = async () => {
    try {
      setIsSubmitting(true);
      const userProfile = await signInWithGoogle();
      if (userProfile) {
        playHospitalChime();
        try {
          confetti({ particleCount: 45, spread: 65, origin: { y: 0.6 } });
        } catch {}
        notify('Google Sign-In Successful', `Welcome, ${userProfile.name} (${userProfile.uhid})`, 'success');
        onLoginSuccess(userProfile);
      }
    } catch (err: any) {
      console.warn('Google Sign-In error:', err);
      notify('Sign-In Notice', 'Unable to complete Google sign-in. You can use Mobile OTP or 1-Click sign-in.', 'info');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Login Demo User
  const handleQuickLogin = (user: PatientUser) => {
    playHospitalChime();
    saveUserProfileToFirestore(user);
    try {
      confetti({
        particleCount: 40,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {}
    notify('Sign In Successful', `Welcome back, ${user.name} (${user.uhid})`, 'success');
    onLoginSuccess(user);
  };

  // Send Simulated OTP
  const handleSendOtp = () => {
    if (!loginIdentifier.trim()) {
      setErrorMessage('Please enter your UHID or registered mobile number.');
      return;
    }
    setErrorMessage('');
    const randomOtp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(randomOtp);
    setOtpSent(true);
    setAuthMode('otp_verify');
    playHospitalChime();
    notify('OTP Dispatched', `Hospital Security OTP: ${randomOtp} sent to ${loginIdentifier}`, 'info');
  };

  // Verify OTP / Sign In
  const handleVerifySignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanId = loginIdentifier.trim().toLowerCase();
    const matchedUser = INITIAL_PATIENT_USERS.find(
      (u) =>
        u.uhid.toLowerCase() === cleanId ||
        u.phone.replace(/\s+/g, '') === cleanId.replace(/\s+/g, '') ||
        u.name.toLowerCase().includes(cleanId)
    );

    if (matchedUser) {
      playHospitalChime();
      try {
        confetti({
          particleCount: 45,
          spread: 75,
          origin: { y: 0.6 },
        });
      } catch {}
      saveUserProfileToFirestore(matchedUser);
      notify('Sign In Successful', `Welcome back, ${matchedUser.name}!`, 'success');
      onLoginSuccess(matchedUser);
    } else {
      const newUser: PatientUser = {
        id: `user-${Date.now()}`,
        uhid: cleanId.startsWith('sjmc') || cleanId.startsWith('uhid') ? loginIdentifier.toUpperCase() : generateAlphanumericUHID('DEL'),
        name: cleanId.startsWith('sjmc') || cleanId.startsWith('uhid') ? 'Registered Patient' : loginIdentifier,
        phone: loginIdentifier.startsWith('+') ? loginIdentifier : `+91 ${loginIdentifier}`,
        email: 'patient@hospital.org',
        age: 40,
        gender: 'Male',
        bloodGroup: 'B+',
        emergencyContactName: 'Next of Kin',
        emergencyContactPhone: '+91 98000 00000',
        allergies: [],
        chronicConditions: [],
        registeredAt: new Date().toISOString().split('T')[0],
      };
      saveUserProfileToFirestore(newUser);
      playHospitalChime();
      notify('Signed In', `Welcome, ${newUser.name} (${newUser.uhid})`, 'success');
      onLoginSuccess(newUser);
    }
  };

  // Sign Up Submission
  const handleSignUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupName.trim()) {
      setErrorMessage('Please provide your full legal name.');
      return;
    }
    if (!signupPhone.trim()) {
      setErrorMessage('Please provide a valid contact mobile number.');
      return;
    }
    if (!agreedTerms) {
      setErrorMessage('Please accept the OPD digital triage & EHR consent to proceed.');
      return;
    }

    const generatedUhid = generateAlphanumericUHID('DEL');

    const newPatientUser: PatientUser = {
      id: `user-${Date.now()}`,
      uhid: generatedUhid,
      name: signupName.trim(),
      phone: signupPhone.trim().startsWith('+') ? signupPhone.trim() : `+91 ${signupPhone.trim()}`,
      email: signupEmail.trim() || `${signupName.toLowerCase().replace(/\s+/g, '')}@patient.org`,
      age: Number(signupAge) || 30,
      gender: signupGender,
      bloodGroup: signupBloodGroup,
      emergencyContactName: signupEmergencyName.trim() || 'Primary Contact',
      emergencyContactPhone: signupEmergencyPhone.trim() || signupPhone.trim(),
      allergies: selectedAllergies,
      chronicConditions: selectedConditions,
      registeredAt: new Date().toISOString().split('T')[0],
      medications: extractedMedications.length > 0 ? extractedMedications : undefined,
      diagnoses: extractedDiagnoses.length > 0 ? extractedDiagnoses : undefined,
      extractedDocumentType: extractedDocType || undefined,
    };

    saveUserProfileToFirestore(newPatientUser);
    playHospitalChime();
    try {
      confetti({
        particleCount: 65,
        spread: 85,
        origin: { y: 0.5 },
      });
    } catch {}

    notify(
      'Account Created & UHID Assigned',
      `UHID ${generatedUhid} generated for ${newPatientUser.name}.`,
      'success'
    );

    onLoginSuccess(newPatientUser);
  };

  const toggleAllergy = (item: string) => {
    if (item === 'None') {
      setSelectedAllergies(['None']);
      return;
    }
    setSelectedAllergies((prev) => {
      const filtered = prev.filter((i) => i !== 'None');
      return filtered.includes(item) ? filtered.filter((i) => i !== item) : [...filtered, item];
    });
  };

  const toggleCondition = (item: string) => {
    if (item === 'None') {
      setSelectedConditions(['None']);
      setShowCustomConditionInput(true);
      return;
    }
    setSelectedConditions((prev) => {
      const filtered = prev.filter((i) => i !== 'None');
      return filtered.includes(item) ? filtered.filter((i) => i !== item) : [...filtered, item];
    });
  };

  const handleAddCustomCondition = (e?: React.KeyboardEvent | React.MouseEvent) => {
    if (e && 'key' in e && e.key !== 'Enter') return;
    if (e) e.preventDefault();
    const clean = customCondition.trim();
    if (clean) {
      setSelectedConditions((prev) => {
        const filtered = prev.filter((i) => i !== 'None');
        return filtered.includes(clean) ? filtered : [...filtered, clean];
      });
      setCustomCondition('');
    }
  };

  return (
    <div
      className="min-h-screen text-[#14213D] dark:text-[#F1F5F9] flex flex-col font-sans transition-colors duration-200 relative overflow-x-hidden selection:bg-[#0B9FE3]/20 selection:text-[#0B9FE3] bg-[#07152E] bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${hospitalQueueBg})` }}
    >
      <div className="absolute inset-0 bg-linear-to-br from-[#07152E]/85 via-[#0B5E97]/42 to-[#07152E]/58 pointer-events-none"></div>
      <div className="absolute inset-0 bg-linear-to-r from-[#07152E]/52 via-[#07152E]/16 to-[#07152E]/48 pointer-events-none"></div>
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-[#07152E]/82 via-[#07152E]/30 to-transparent pointer-events-none"></div>

      {/* TOP HEADER (Section 4) */}
      <header className="w-full h-16 sm:h-20 border-b border-white/15 bg-white/5 backdrop-blur-md px-4 sm:px-8 lg:px-12 flex items-center justify-between sticky top-0 z-30 transition-colors duration-200">
        {/* Left: Brand Logo & Tagline */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white shadow-md shadow-[#0B9FE3]/20 ring-1 ring-white/25 backdrop-blur-md">
            <HeartPulse className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-extrabold text-white tracking-tight drop-shadow-sm">
                Medi Queue
              </span>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/16 text-cyan-50 border border-white/20 backdrop-blur-md">
                Patient Portal
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-cyan-50/85 font-medium hidden sm:block">
              Smarter Hospitals. Shorter Queues.
            </p>
          </div>
        </div>

        {/* Right: Clean Header Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {onBackToHome && (
            <button
              type="button"
              onClick={onBackToHome}
              className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white hover:bg-white/12 border border-white/12 hover:border-white/25 transition flex items-center gap-1.5 cursor-pointer shadow-2xs hover:shadow-xs backdrop-blur-md"
            >
              <Home className="w-4 h-4 text-cyan-100" />
              <span className="hidden sm:inline">Home</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (onOpenSupportModal) onOpenSupportModal();
              else notify('Help & Support', 'Our 24/7 Patient Concierge is ready to assist you. Call toll-free 1800-420-MEDI.', 'info');
            }}
            className="px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-white/14 hover:bg-white/22 text-white border border-white/18 hover:border-white/30 transition flex items-center gap-1.5 cursor-pointer shadow-2xs hover:shadow-xs backdrop-blur-md"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Help & Support</span>
          </button>
        </div>
      </header>

      {/* MAIN PAGE: FULL-SCREEN BACKGROUND WITH FLOATING AUTHENTICATION CARD */}
      <main className="relative z-10 flex-1 w-full max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-10 py-5 sm:py-7 lg:py-9 flex items-center justify-center md:justify-end">

        {/* ============================================================
            RIGHT COLUMN (~48%) - WHITE AUTHENTICATION CARD (Sections 11-26)
           ============================================================ */}
        <div className="w-full flex justify-center md:justify-end">
          <div className="patient-auth-card w-full sm:w-[min(92vw,620px)] md:w-[58vw] lg:w-[44vw] xl:w-[42vw] max-w-[660px] max-h-[calc(100vh-7.25rem)] bg-white/94 backdrop-blur-xl rounded-[24px] border border-white/70 shadow-[0_28px_80px_rgba(3,24,50,0.34)] overflow-y-auto transition-all duration-300">
            
            {/* CARD TOP TABS (Section 13) */}
            <div className="auth-tabs grid grid-cols-2 border-b border-[#DCE8F2] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#0E1726]">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setErrorMessage('');
                }}
                className={`py-4 px-4 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer relative ${
                  authMode === 'signin' || authMode === 'otp_verify'
                    ? 'bg-white dark:bg-[#111827] text-[#0B9FE3] dark:text-[#38BDF8] shadow-2xs font-extrabold'
                    : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#10244A] dark:hover:text-white hover:bg-white/50'
                }`}
              >
                <ArrowRight className="w-4 h-4 text-[#0B9FE3]" />
                <span>Sign In (Existing UHID)</span>
                {(authMode === 'signin' || authMode === 'otp_verify') && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#0B9FE3]"></div>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setErrorMessage('');
                }}
                className={`py-4 px-4 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer relative ${
                  authMode === 'signup'
                    ? 'bg-white dark:bg-[#111827] text-[#0B9FE3] dark:text-[#38BDF8] shadow-2xs font-extrabold'
                    : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#10244A] dark:hover:text-white hover:bg-white/50'
                }`}
              >
                <UserCheck className="w-4 h-4 text-[#0B9FE3]" />
                <span>Create Account (New Patient)</span>
                {authMode === 'signup' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#0B9FE3]"></div>
                )}
              </button>
            </div>

            {/* CARD BODY CONTENT */}
            <div className="p-6 sm:p-8 lg:p-9 space-y-6">
              
              {/* Heading Section (Section 12 & Section 22) */}
              <div className="space-y-1.5">
                <h2 className="text-2xl sm:text-[28px] font-extrabold text-[#10244A] dark:text-white tracking-tight">
                  {authMode === 'signup'
                    ? 'Create your Medi Queue account'
                    : 'Welcome to Medi Queue'}
                </h2>
                <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                  {authMode === 'signup'
                    ? 'Register once and manage your complete hospital journey.'
                    : 'Sign in to manage your appointments, queue passes and healthcare records.'}
                </p>
              </div>

              {/* Error Message Display */}
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* ============================================================
                  VIEW A: SIGN IN MODE (Sections 14-21)
                 ============================================================ */}
              {authMode === 'signin' && (
                <div className="space-y-5">
                  
                  {/* Google Login Button (Section 14) */}
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleGoogleSignIn}
                        className="auth-google-button w-full h-12 sm:h-13 px-4 rounded-xl border border-[#DCE7F0] dark:border-[#334155] bg-white dark:bg-[#1A263C] hover:bg-[#F8FAFC] dark:hover:bg-[#20304C] text-[#14213D] dark:text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-3 transition shadow-2xs hover:shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                        />
                      </svg>
                      <span>Continue with Google</span>
                    </button>
                    <p className="text-[11px] text-center text-[#64748B] dark:text-[#94A3B8]">
                      Secure authentication for your patient portal
                    </p>
                  </div>

                  {/* Divider (Section 15) */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-[#DCE7F0] dark:bg-[#1E293B]"></div>
                    <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
                      Or continue with
                    </span>
                    <div className="flex-1 h-px bg-[#DCE7F0] dark:bg-[#1E293B]"></div>
                  </div>

                  {/* Login Form */}
                  <form onSubmit={authMethod === 'pin' ? handleVerifySignIn : (e) => { e.preventDefault(); handleSendOtp(); }} className="space-y-4">
                    
                    {/* Login Method Segmented Control (Section 16) */}
                    <div className="auth-method-switch flex items-center justify-between gap-2 p-1 rounded-xl bg-[#F1F5F9] dark:bg-[#162238] border border-[#E2E8F0] dark:border-[#1E293B]">
                      <button
                        type="button"
                        onClick={() => setAuthMethod('otp')}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          authMethod === 'otp'
                            ? 'bg-white dark:bg-[#111827] text-[#0B9FE3] dark:text-[#38BDF8] shadow-xs ring-1 ring-[#0B9FE3]/20'
                            : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#10244A] dark:hover:text-white'
                        }`}
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>UHID / Mobile</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAuthMethod('pin')}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          authMethod === 'pin'
                            ? 'bg-white dark:bg-[#111827] text-[#0B9FE3] dark:text-[#38BDF8] shadow-xs ring-1 ring-[#0B9FE3]/20'
                            : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#10244A] dark:hover:text-white'
                        }`}
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Security PIN</span>
                      </button>
                    </div>

                    {/* UHID / Mobile Input (Section 17) */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#10244A] dark:text-[#F1F5F9]">
                        Hospital UHID or Registered Mobile Number
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                          <IdCard className="w-4 h-4" />
                        </span>
                        <input
                          type="text"
                          value={loginIdentifier}
                          onChange={(e) => setLoginIdentifier(e.target.value)}
                          placeholder="SJMC-2026-DEL-08942A"
                          className="w-full h-13 pl-10 pr-3.5 rounded-xl border border-[#DCE7F0] dark:border-[#334155] bg-white dark:bg-[#1A263C] text-xs sm:text-sm font-medium text-[#10244A] dark:text-white focus:outline-hidden focus:border-[#0B9FE3] focus:ring-2 focus:ring-[#0B9FE3]/20 transition"
                          required
                        />
                      </div>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        Enter your unique patient identifier or registered mobile number.
                      </p>
                    </div>

                    {/* Conditional PIN input or OTP Box */}
                    {authMethod === 'pin' ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-[#10244A] dark:text-[#F1F5F9]">
                            4-Digit Patient Security PIN
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowPin(!showPin)}
                            className="text-[11px] text-[#0B9FE3] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            {showPin ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            <span>{showPin ? 'Hide' : 'Show'}</span>
                          </button>
                        </div>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                            <KeyRound className="w-4 h-4" />
                          </span>
                          <input
                            type={showPin ? 'text' : 'password'}
                            value={loginPin}
                            onChange={(e) => setLoginPin(e.target.value)}
                            placeholder="****"
                            maxLength={8}
                            className="w-full h-13 pl-10 pr-3.5 rounded-xl border border-[#DCE7F0] dark:border-[#334155] bg-white dark:bg-[#1A263C] text-xs sm:text-sm font-mono tracking-widest text-[#10244A] dark:text-white focus:outline-hidden focus:border-[#0B9FE3] focus:ring-2 focus:ring-[#0B9FE3]/20 transition"
                            required
                          />
                        </div>
                      </div>
                    ) : (
                      /* OTP Information Box (Section 18) */
                      <div className="p-3.5 rounded-xl bg-[#E0F2FE]/60 dark:bg-[#0B9FE3]/10 border border-[#BAE6FD] dark:border-[#0B9FE3]/30 text-xs text-[#0369A1] dark:text-[#38BDF8] space-y-1">
                        <div className="flex items-center gap-2 font-bold text-[#087FC9] dark:text-[#38BDF8]">
                          <ShieldCheck className="w-4 h-4" />
                          <span>Fast OTP Verification</span>
                        </div>
                        <p className="text-[11px] text-[#0284C7] dark:text-[#93C5FD] leading-relaxed">
                          A 4-digit verification code will be sent to your registered mobile number for instant and secure access.
                        </p>
                      </div>
                    )}

                    {/* Primary Submit Button (Section 19) */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-13 sm:h-14 rounded-xl bg-[#0B9FE3] hover:bg-[#087FC9] text-white font-extrabold text-xs sm:text-sm shadow-md shadow-[#0B9FE3]/25 flex items-center justify-center gap-2.5 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>{authMethod === 'otp' ? 'Send Verification Code & Continue ->' : 'Sign In with Security PIN ->'}</span>
                    </button>

                    {/* Recovery Links (Section 20) */}
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setShowForgotUhidModal(true)}
                        className="text-[#0B9FE3] hover:text-[#087FC9] hover:underline font-semibold cursor-pointer"
                      >
                        Forgot UHID?
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowForgotPinModal(true)}
                        className="text-[#0B9FE3] hover:text-[#087FC9] hover:underline font-semibold cursor-pointer"
                      >
                        Forgot Security PIN?
                      </button>
                    </div>

                    {/* 1-Click Fast Demo Patients */}
                    <div className="pt-3 border-t border-[#DCE7F0] dark:border-[#1E293B] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                          1-Click Demo Patients:
                        </span>
                        <span className="text-[10px] text-[#0B9FE3] font-bold">Fast Test Login</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {INITIAL_PATIENT_USERS.slice(0, 3).map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => handleQuickLogin(u)}
                              className="auth-demo-button p-2 rounded-xl border border-[#DCE7F0] dark:border-[#1E293B] hover:border-[#0B9FE3] bg-[#F8FAFC] dark:bg-[#162238] hover:bg-[#E0F2FE]/40 dark:hover:bg-[#1E2E4A] transition text-left flex items-center gap-2 cursor-pointer group"
                          >
                            <div className="w-6 h-6 rounded-full bg-[#0B9FE3]/15 text-[#0B9FE3] flex items-center justify-center text-[10px] font-bold shrink-0">
                              {u.name.charAt(0)}
                            </div>
                            <div className="truncate flex-1 min-w-0">
                              <p className="text-[11px] font-bold text-[#10244A] dark:text-white truncate group-hover:text-[#0B9FE3]">
                                {u.name.split(' ')[0]}
                              </p>
                              <p className="text-[9px] text-[#64748B] dark:text-[#94A3B8] font-mono truncate">
                                {u.uhid.slice(-6)}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Security Footer Note (Section 21) */}
                    <div className="pt-2 text-center text-[11px] text-[#64748B] dark:text-[#94A3B8] flex items-center justify-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-[#16B981]" />
                      <span>
                        <strong className="font-bold text-[#10244A] dark:text-slate-200">Secure Patient Portal</strong> - Your information is protected and used only to provide Medi Queue services.
                      </span>
                    </div>

                  </form>
                </div>
              )}

              {/* ============================================================
                  VIEW B: OTP VERIFY SCREEN (Simulated live code verification)
                 ============================================================ */}
              {authMode === 'otp_verify' && (
                <div className="space-y-5 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-2xl mx-auto shadow-sm">
                    <ShieldCheck className="w-7 h-7" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-xl font-extrabold text-[#10244A] dark:text-white">
                      Enter Verification Code
                    </h3>
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                      We've sent a 4-digit security code for{' '}
                      <strong className="text-[#10244A] dark:text-white font-mono">{loginIdentifier}</strong>
                    </p>
                  </div>

                  {/* Simulated Live SMS Notification Pill */}
                  <div className="p-3.5 bg-[#F8FAFC] dark:bg-[#162238] border border-[#DCE7F0] dark:border-[#1E293B] rounded-2xl text-left flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#0B9FE3]/15 text-[#0B9FE3] flex items-center justify-center">
                        <Send className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] uppercase font-bold block">Hospital SMS Gateway</span>
                        <span className="font-mono font-bold text-[#10244A] dark:text-white">Security Code: <span className="text-[#0B9FE3] bg-[#E0F2FE] dark:bg-[#0B9FE3]/20 px-2 py-0.5 rounded font-extrabold">{generatedOtp}</span></span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEnteredOtp(generatedOtp)}
                      className="px-3 py-1.5 rounded-lg bg-[#0B9FE3] hover:bg-[#087FC9] text-white text-xs font-bold cursor-pointer transition shadow-2xs"
                    >
                      Auto-fill
                    </button>
                  </div>

                  <div>
                    <input
                      type="text"
                      maxLength={4}
                      value={enteredOtp}
                      onChange={(e) => setEnteredOtp(e.target.value)}
                      placeholder="* * * *"
                      className="w-48 mx-auto text-center py-3 text-3xl font-mono tracking-widest rounded-2xl border-2 border-[#0B9FE3] bg-white dark:bg-[#1A263C] text-[#10244A] dark:text-white focus:outline-hidden shadow-inner"
                      autoFocus
                    />
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setAuthMode('signin')}
                      className="px-4 py-2.5 rounded-xl bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] text-xs font-bold hover:bg-[#E2E8F0] cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleVerifySignIn}
                      className="px-6 py-2.5 rounded-xl bg-[#0B9FE3] hover:bg-[#087FC9] text-white text-xs font-extrabold shadow-md cursor-pointer transition"
                    >
                      Verify & Proceed to Dashboard {'->'}
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================================
                  VIEW C: SIGN UP (CREATE ACCOUNT) (Sections 22-26)
                 ============================================================ */}
              {authMode === 'signup' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  
                  {/* SMART REGISTRATION AI SECTION (Section 23) */}
                  <div className="rounded-2xl border border-[#BAE6FD] dark:border-[#0B9FE3]/30 bg-gradient-to-br from-[#F0F9FF] to-white dark:from-[#111F36] dark:to-[#111827] p-4 sm:p-5 space-y-3.5 shadow-xs">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#087FC9] to-[#0B9FE3] text-white flex items-center justify-center shadow-xs">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-extrabold text-[#10244A] dark:text-white">
                          Smart Registration
                        </h3>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-[#0B9FE3] to-[#8B5CF6] text-white shadow-2xs">
                        AI DOCUMENT VISION
                      </span>
                    </div>

                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                      Upload your prescription or health report and we'll help fill your details.
                    </p>

                    {/* Integrated SmartDocumentUpload Component */}
                    <SmartDocumentUpload
                      onExtractionSuccess={handleDocumentExtracted}
                      onClearData={handleClearExtractedData}
                      onShowToast={notify}
                    />

                    {/* Extraction Success Notice Banner */}
                    {extractionBannerVisible && (
                      <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs text-emerald-950 dark:text-emerald-200 flex items-center justify-between gap-3 shadow-2xs animate-in fade-in duration-300">
                        <div className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-bold">
                              Information extracted from your document.
                            </p>
                            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5">
                              Please review the highlighted fields below. All information can be edited.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleClearExtractedData}
                          className="px-2.5 py-1 bg-white dark:bg-[#111827] hover:bg-slate-50 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 rounded-lg text-[11px] font-bold transition cursor-pointer shrink-0 shadow-2xs"
                        >
                          Clear Auto-fill
                        </button>
                      </div>
                    )}
                  </div>

                  {/* REGISTRATION FORM (Section 24) */}
                  <form onSubmit={handleSignUpSubmit} className="space-y-4">
                    
                    {/* Row 1: Full Legal Name & Mobile */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-[#10244A] dark:text-[#F1F5F9]">
                          Full Legal Name <span className="text-[#EF4444]">*</span>
                        </label>
                        <input
                          type="text"
                          value={signupName}
                          onChange={(e) => setSignupName(e.target.value)}
                          placeholder="e.g. Ramesh Chandra"
                          className={`w-full h-12 px-3.5 rounded-xl border ${getFieldBorderClass('fullName')} bg-white dark:bg-[#1A263C] text-xs sm:text-sm text-[#10244A] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#0B9FE3]/20 transition`}
                          required
                        />
                        <ExtractedFieldIndicator
                          confidence={fieldConfidence.fullName}
                          fieldName="Full Legal Name"
                          isExtracted={Boolean(extractedFields.fullName)}
                          onClearField={() => handleClearSingleField('fullName')}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-[#10244A] dark:text-[#F1F5F9]">
                          Mobile Number <span className="text-[#EF4444]">*</span>
                        </label>
                        <input
                          type="tel"
                          value={signupPhone}
                          onChange={(e) => setSignupPhone(e.target.value)}
                          placeholder="e.g. 98200 12345"
                          className={`w-full h-12 px-3.5 rounded-xl border ${getFieldBorderClass('mobileNumber')} bg-white dark:bg-[#1A263C] text-xs sm:text-sm text-[#10244A] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#0B9FE3]/20 transition`}
                          required
                        />
                        <ExtractedFieldIndicator
                          confidence={fieldConfidence.mobileNumber}
                          fieldName="Mobile Number"
                          isExtracted={Boolean(extractedFields.mobileNumber)}
                          onClearField={() => handleClearSingleField('mobileNumber')}
                        />
                      </div>
                    </div>

                    {/* Row 2: Email, Age, Gender, Blood Group */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="col-span-2 sm:col-span-1 space-y-1">
                        <label className="block text-xs font-bold text-[#10244A] dark:text-[#F1F5F9]">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          placeholder="name@mail.com"
                          className={`w-full h-11 px-3 rounded-xl border ${getFieldBorderClass('email')} bg-white dark:bg-[#1A263C] text-xs text-[#10244A] dark:text-white focus:outline-hidden transition`}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-[#10244A] dark:text-[#F1F5F9]">
                          Age (Years) <span className="text-[#EF4444]">*</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={120}
                          value={signupAge}
                          onChange={(e) => setSignupAge(Number(e.target.value))}
                          className={`w-full h-11 px-3 rounded-xl border ${getFieldBorderClass('age')} bg-white dark:bg-[#1A263C] text-xs text-[#10244A] dark:text-white focus:outline-hidden transition`}
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-[#10244A] dark:text-[#F1F5F9]">
                          Gender <span className="text-[#EF4444]">*</span>
                        </label>
                        <select
                          value={signupGender}
                          onChange={(e) => setSignupGender(e.target.value as 'Male' | 'Female' | 'Other')}
                          className={`w-full h-11 px-2.5 rounded-xl border ${getFieldBorderClass('gender')} bg-white dark:bg-[#1A263C] text-xs text-[#10244A] dark:text-white focus:outline-hidden transition`}
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-[#10244A] dark:text-[#F1F5F9]">
                          Blood Group
                        </label>
                        <select
                          value={signupBloodGroup}
                          onChange={(e) => setSignupBloodGroup(e.target.value)}
                          className={`w-full h-11 px-2.5 rounded-xl border ${getFieldBorderClass('bloodGroup')} bg-white dark:bg-[#1A263C] text-xs text-[#10244A] dark:text-white focus:outline-hidden transition`}
                        >
                          {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((bg) => (
                            <option key={bg} value={bg}>
                              {bg}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Row 3: Emergency Contact */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-[#10244A] dark:text-[#F1F5F9]">
                          Emergency Contact Name
                        </label>
                        <input
                          type="text"
                          value={signupEmergencyName}
                          onChange={(e) => setSignupEmergencyName(e.target.value)}
                          placeholder="e.g. Suman Chandra (Spouse)"
                          className={`w-full h-11 px-3.5 rounded-xl border ${getFieldBorderClass('emergencyContactName')} bg-white dark:bg-[#1A263C] text-xs text-[#10244A] dark:text-white focus:outline-hidden transition`}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-[#10244A] dark:text-[#F1F5F9]">
                          Emergency Contact Phone
                        </label>
                        <input
                          type="tel"
                          value={signupEmergencyPhone}
                          onChange={(e) => setSignupEmergencyPhone(e.target.value)}
                          placeholder="e.g. +91 98200 99887"
                          className={`w-full h-11 px-3.5 rounded-xl border ${getFieldBorderClass('emergencyContactPhone')} bg-white dark:bg-[#1A263C] text-xs text-[#10244A] dark:text-white focus:outline-hidden transition`}
                        />
                      </div>
                    </div>

                    {/* Row 4: Allergies Selector */}
                    <div className="space-y-2 pt-1">
                      <label className="block text-xs font-bold text-[#10244A] dark:text-[#F1F5F9]">
                        Known Drug / Food Allergies (Select all that apply)
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {['Penicillin', 'Sulfa Drugs', 'Aspirin/NSAIDs', 'Latex', 'Dust / Pollen', 'Contrast Dye', 'None'].map((item) => {
                          const isSel = selectedAllergies.includes(item);
                          return (
                            <button
                              key={item}
                              type="button"
                              onClick={() => toggleAllergy(item)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                                isSel
                                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-400 font-bold'
                                  : 'bg-[#F8FAFC] dark:bg-[#162238] text-[#64748B] dark:text-[#94A3B8] border-[#DCE7F0] dark:border-[#1E293B] hover:bg-slate-100'
                              }`}
                            >
                              {isSel ? 'Selected ' : '+ '}
                              {item}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Row 5: Medical History & Conditions */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-[#10244A] dark:text-[#F1F5F9]">
                          Pre-existing Conditions / Medical History
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowCustomConditionInput(!showCustomConditionInput)}
                          className="text-[11px] text-[#0B9FE3] hover:underline font-bold cursor-pointer"
                        >
                          {showCustomConditionInput ? 'Hide custom' : '+ Type custom condition'}
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {['Hypertension (High BP)', 'Type 2 Diabetes', 'Asthma / COPD', 'Thyroid Disorder', 'Heart Disease', 'Arthritis', 'None'].map((item) => {
                          const isSel = selectedConditions.includes(item);
                          return (
                            <button
                              key={item}
                              type="button"
                              onClick={() => toggleCondition(item)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                                isSel
                                  ? 'bg-[#E0F2FE] dark:bg-[#0B9FE3]/20 text-[#087FC9] dark:text-[#38BDF8] border-[#0B9FE3] font-bold'
                                  : 'bg-[#F8FAFC] dark:bg-[#162238] text-[#64748B] dark:text-[#94A3B8] border-[#DCE7F0] dark:border-[#1E293B] hover:bg-slate-100'
                              }`}
                            >
                              {isSel ? 'Selected ' : '+ '}
                              {item}
                            </button>
                          );
                        })}
                      </div>

                      {showCustomConditionInput && (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            value={customCondition}
                            onChange={(e) => setCustomCondition(e.target.value)}
                            onKeyDown={handleAddCustomCondition}
                            placeholder="e.g. Migraine, Kidney Stones..."
                            className="flex-1 h-10 px-3 text-xs bg-white dark:bg-[#1A263C] rounded-xl border border-[#BAE6FD] dark:border-[#334155] text-[#10244A] dark:text-white focus:outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddCustomCondition()}
                            className="px-3.5 h-10 bg-[#0B9FE3] text-white text-xs font-bold rounded-xl hover:bg-[#087FC9] cursor-pointer"
                          >
                            Add
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Consent Checkbox Card (Section 25) */}
                    <div className="p-3.5 rounded-2xl bg-[#F0F9FF] dark:bg-[#112240] border border-[#BAE6FD] dark:border-[#1E3A68]">
                      <label className="flex items-start gap-3 cursor-pointer text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                        <input
                          type="checkbox"
                          checked={agreedTerms}
                          onChange={(e) => setAgreedTerms(e.target.checked)}
                          className="w-4 h-4 rounded text-[#0B9FE3] accent-[#0B9FE3] mt-0.5 cursor-pointer shrink-0"
                        />
                        <span>
                          I consent to digital triage, Electronic Health Record (EHR) generation, and real-time OPD queue status alerts.
                        </span>
                      </label>
                    </div>

                    {/* Create Patient Account Primary Button (Section 26) */}
                    <button
                      type="submit"
                      className="w-full h-13 sm:h-14 rounded-xl bg-[#0B9FE3] hover:bg-[#087FC9] text-white font-extrabold text-xs sm:text-sm shadow-md shadow-[#0B9FE3]/25 flex items-center justify-center gap-2.5 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Create Patient Account & Continue {'->'}</span>
                    </button>

                  </form>
                </div>
              )}

            </div>

            {/* Emergency Bypass Option (Preserved) */}
            {onEmergencyBypass && (
              <div className="bg-rose-50 dark:bg-rose-950/30 border-t border-rose-200 dark:border-rose-900/60 p-3 text-center">
                <button
                  type="button"
                  onClick={onEmergencyBypass}
                  className="text-xs text-rose-700 dark:text-rose-400 hover:underline font-extrabold flex items-center justify-center gap-2 mx-auto cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping"></span>
                  <span>Acute Code Red Emergency? Skip registration & open Casualty Triage Bay</span>
                </button>
              </div>
            )}

          </div>
        </div>

      </main>

      {/* Forgot UHID Modal */}
      {showForgotUhidModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#DCE7F0] dark:border-[#1E293B] shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-[#10244A] dark:text-white">
                <IdCard className="w-5 h-5 text-[#0B9FE3]" />
                <h3 className="text-base font-extrabold">Retrieve Hospital UHID</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotUhidModal(false)}
                className="text-[#64748B] hover:text-[#10244A] dark:hover:text-white text-sm cursor-pointer p-1"
              >
                x
              </button>
            </div>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Enter your registered 10-digit mobile number. We will send your unique hospital UHID via SMS.
            </p>
            <input
              type="tel"
              placeholder="+91 98200 55432"
              value={recoveryPhone}
              onChange={(e) => setRecoveryPhone(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-[#DCE7F0] dark:border-[#334155] bg-white dark:bg-[#1A263C] text-xs text-[#10244A] dark:text-white focus:outline-hidden"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForgotUhidModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#64748B] hover:bg-slate-100 dark:hover:bg-[#1E293B] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForgotUhidModal(false);
                  notify('UHID Sent via SMS', `Your UHID (SJMC-2026-DEL-08942A) has been dispatched to ${recoveryPhone || 'your mobile'}.`, 'success');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0B9FE3] hover:bg-[#087FC9] text-white cursor-pointer"
              >
                Send UHID via SMS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forgot PIN Modal */}
      {showForgotPinModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#DCE7F0] dark:border-[#1E293B] shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-[#10244A] dark:text-white">
                <KeyRound className="w-5 h-5 text-[#0B9FE3]" />
                <h3 className="text-base font-extrabold">Reset Patient Security PIN</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotPinModal(false)}
                className="text-[#64748B] hover:text-[#10244A] dark:hover:text-white text-sm cursor-pointer p-1"
              >
                x
              </button>
            </div>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              You can instantly sign in using <strong>UHID / Mobile OTP</strong> without a PIN, or reset your PIN below.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForgotPinModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#64748B] hover:bg-slate-100 dark:hover:bg-[#1E293B] cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPinModal(false);
                  setAuthMethod('otp');
                  notify('Switched to OTP Mode', 'Use one-time password verification for instant access.', 'info');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0B9FE3] hover:bg-[#087FC9] text-white cursor-pointer"
              >
                Sign In with OTP Instead
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
