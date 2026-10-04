import React, { useState } from 'react';
import {
  PatientUser,
  MedicalExtractionResult,
  ExtractedConfidence,
} from '../types';
import { INITIAL_PATIENT_USERS, generateAlphanumericUHID } from '../data/mockData';
import { playHospitalChime, playUrgentAlertSound } from '../utils/audio';
import { signInWithGoogle, saveUserProfileToFirestore } from '../firebase';
import confetti from 'canvas-confetti';
import { SmartDocumentUpload } from './SmartDocumentUpload';
import { ExtractedFieldIndicator } from './ExtractedFieldIndicator';

interface PatientAuthProps {
  onLoginSuccess: (user: PatientUser) => void;
  onEmergencyBypass?: () => void;
  onShowToast?: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
}

export const PatientAuth: React.FC<PatientAuthProps> = ({
  onLoginSuccess,
  onEmergencyBypass,
  onShowToast,
}) => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'otp_verify'>('signin');
  const [loginIdentifier, setLoginIdentifier] = useState<string>('SJMC-2026-DEL-08942A');
  const [loginPin, setLoginPin] = useState<string>('1234');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [authMethod, setAuthMethod] = useState<'pin' | 'otp'>('otp');
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [generatedOtp, setGeneratedOtp] = useState<string>('4829');
  const [enteredOtp, setEnteredOtp] = useState<string>('');
  const [otpTimer, setOtpTimer] = useState<number>(30);

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
  const [showCustomAllergyInput, setShowCustomAllergyInput] = useState<boolean>(false);
  const [signupPin, setSignupPin] = useState<string>('1234');
  const [agreedTerms, setAgreedTerms] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Smart Registration Extraction State
  const [fieldConfidence, setFieldConfidence] = useState<ExtractedConfidence>({});
  const [extractedFields, setExtractedFields] = useState<Record<string, boolean>>({});
  const [extractedMedications, setExtractedMedications] = useState<string[]>([]);
  const [extractedDiagnoses, setExtractedDiagnoses] = useState<string[]>([]);
  const [extractedDocType, setExtractedDocType] = useState<string>('');
  const [extractionBannerVisible, setExtractionBannerVisible] = useState<boolean>(false);

  // Auto-population handler following strict clinical & confidence guidelines
  const handleDocumentExtracted = (data: MedicalExtractionResult) => {
    const newExtracted: Record<string, boolean> = {};
    const conf = data.confidence || {};
    setFieldConfidence(conf);

    // 1. Full Legal Name (Populate if >= 0.60, or high >= 0.85)
    if (data.fullName && (conf.fullName === undefined || conf.fullName >= 0.6)) {
      setSignupName(data.fullName);
      newExtracted.fullName = true;
    }

    // 2. Mobile Number (Sanitize and populate)
    if (data.mobileNumber && (conf.mobileNumber === undefined || conf.mobileNumber >= 0.6)) {
      setSignupPhone(data.mobileNumber.replace(/[^\d+ ]/g, '').trim());
      newExtracted.mobileNumber = true;
    }

    // 3. Email Address
    if (data.email && (conf.email === undefined || conf.email >= 0.6)) {
      setSignupEmail(data.email.trim());
      newExtracted.email = true;
    }

    // 4. Age
    if (typeof data.age === 'number' && !isNaN(data.age) && (conf.age === undefined || conf.age >= 0.6)) {
      setSignupAge(data.age);
      newExtracted.age = true;
    }

    // 5. Gender
    if (data.gender && ['Male', 'Female', 'Other'].includes(data.gender) && (conf.gender === undefined || conf.gender >= 0.6)) {
      setSignupGender(data.gender as 'Male' | 'Female' | 'Other');
      newExtracted.gender = true;
    }

    // 6. Blood Group (Normalize)
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

    // 7. Emergency Contact Name
    if (data.emergencyContactName && (conf.emergencyContactName === undefined || conf.emergencyContactName >= 0.6)) {
      setSignupEmergencyName(data.emergencyContactName);
      newExtracted.emergencyContactName = true;
    }

    // 8. Emergency Contact Phone
    if (data.emergencyContactPhone && (conf.emergencyContactPhone === undefined || conf.emergencyContactPhone >= 0.6)) {
      setSignupEmergencyPhone(data.emergencyContactPhone.replace(/[^\d+ ]/g, '').trim());
      newExtracted.emergencyContactPhone = true;
    }

    // 9. Known Allergies
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

    // 10. Medical Conditions / Pre-existing History
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

    if (data.medications) {
      setExtractedMedications(data.medications);
    }
    if (data.diagnoses) {
      setExtractedDiagnoses(data.diagnoses);
    }
    if (data.documentType) {
      setExtractedDocType(data.documentType);
    }

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
      return 'border-[#cbd5e1]';
    }
    const conf = (fieldConfidence as any)[fieldName];
    if (conf !== undefined && conf < 0.85) {
      return 'border-amber-400 bg-amber-50/20'; // Medium confidence (< 0.85)
    }
    return 'border-emerald-400 bg-emerald-50/20'; // High confidence (>= 0.85)
  };

  const notify = (title: string, desc: string, type: 'info' | 'success' | 'urgent' = 'info') => {
    if (onShowToast) {
      onShowToast(title, desc, type);
    }
  };

  // Google Sign-In Handler
  const handleGoogleSignIn = async () => {
    try {
      const userProfile = await signInWithGoogle();
      if (userProfile) {
        playHospitalChime();
        try {
          confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
        } catch {}
        notify('Google Sign-In Successful', `Welcome, ${userProfile.name} (${userProfile.uhid})`, 'success');
        onLoginSuccess(userProfile);
      }
    } catch (err: any) {
      console.warn('Google Sign-In error:', err);
      notify('Sign-In Error', 'Unable to complete Google sign-in. You can use Mobile OTP or Demo sign-in.', 'info');
    }
  };

  // Quick Login Demo User
  const handleQuickLogin = (user: PatientUser) => {
    playHospitalChime();
    saveUserProfileToFirestore(user);
    try {
      confetti({
        particleCount: 35,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore
    }
    notify('Sign In Successful', `Welcome back, ${user.name} (${user.uhid})`, 'success');
    onLoginSuccess(user);
  };

  // Send Simulated OTP
  const handleSendOtp = () => {
    if (!loginIdentifier.trim()) {
      setErrorMessage('Please enter your UHID or 10-digit mobile number.');
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

    // Check if matching mock user exists or create a session
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
          particleCount: 40,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // ignore
      }
      saveUserProfileToFirestore(matchedUser);
      notify('Sign In Successful', `Welcome back, ${matchedUser.name}! Proceeding to appointment register.`, 'success');
      onLoginSuccess(matchedUser);
    } else {
      // Create user session from identifier
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
        particleCount: 60,
        spread: 80,
        origin: { y: 0.5 },
      });
    } catch {
      // ignore
    }

    notify(
      'Account Created & UHID Assigned',
      `UHID ${generatedUhid} generated for ${newPatientUser.name}. Routing to appointment registration.`,
      'success'
    );

    onLoginSuccess(newPatientUser);
  };

  const toggleAllergy = (item: string) => {
    if (item === 'None') {
      setSelectedAllergies(['None']);
      setShowCustomAllergyInput(false);
      return;
    }
    setSelectedAllergies((prev) => {
      const filtered = prev.filter((i) => i !== 'None');
      return filtered.includes(item) ? filtered.filter((i) => i !== item) : [...filtered, item];
    });
  };

  const handleAddCustomAllergy = (e?: React.KeyboardEvent | React.MouseEvent) => {
    if (e && 'key' in e && e.key !== 'Enter') return;
    if (e) e.preventDefault();
    const clean = customAllergy.trim();
    if (clean) {
      setSelectedAllergies((prev) => {
        const filtered = prev.filter((i) => i !== 'None');
        return filtered.includes(clean) ? filtered : [...filtered, clean];
      });
      setCustomAllergy('');
    }
  };

  const toggleCondition = (item: string) => {
    if (item === 'None') {
      // If user clicks None, set to None and open manual type option if they wish to specify or keep None
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
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Patient Portal Welcome Header */}
      <div className="text-center space-y-1.5 pt-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0ea5e9]/10 text-[#0ea5e9] border border-[#0ea5e9]/20 shadow-xs mb-1">
          <i className="fa-solid fa-hospital-user text-2xl"></i>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] tracking-tight">
          Patient Portal & OPD Intake
        </h2>
        <p className="text-xs sm:text-sm text-[#64748b] max-w-md mx-auto">
          Please sign in with your <strong className="text-[#0f172a]">Hospital UHID / Mobile</strong> or create a new patient account to register for doctor appointments & queue passes.
        </p>
      </div>

      {/* Main Authentication Card */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-md overflow-hidden">
        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 border-b border-[#e2e8f0] bg-[#f8fafc]">
          <button
            type="button"
            onClick={() => {
              setAuthMode('signin');
              setErrorMessage('');
            }}
            className={`py-3.5 px-4 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              authMode === 'signin' || authMode === 'otp_verify'
                ? 'bg-white text-[#0ea5e9] border-b-2 border-[#0ea5e9] shadow-xs'
                : 'text-[#64748b] hover:text-[#0f172a] hover:bg-white/50'
            }`}
          >
            <i className="fa-solid fa-arrow-right-to-bracket"></i>
            <span>Sign In (Existing UHID)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMode('signup');
              setErrorMessage('');
            }}
            className={`py-3.5 px-4 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              authMode === 'signup'
                ? 'bg-white text-[#0ea5e9] border-b-2 border-[#0ea5e9] shadow-xs'
                : 'text-[#64748b] hover:text-[#0f172a] hover:bg-white/50'
            }`}
          >
            <i className="fa-solid fa-user-plus"></i>
            <span>New Patient (Sign Up)</span>
          </button>
        </div>

        <div className="p-5 sm:p-7">
          {/* Quick Google Sign-In Bar */}
          <div className="mb-5">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2.5 transition shadow-2xs cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
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
              <span>Continue with Google (Instant Hospital EHR)</span>
            </button>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-slate-200"></div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Or with Mobile OTP / UHID
              </span>
              <div className="flex-1 h-px bg-slate-200"></div>
            </div>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-lg bg-[#fee2e2] border border-[#fca5a5] text-[#991b1b] text-xs flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation text-sm shrink-0"></i>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* MODE 1: SIGN IN */}
          {authMode === 'signin' && (
            <form onSubmit={handleVerifySignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0f172a] mb-1">
                  Hospital UHID or Registered Mobile Number
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94a3b8] text-xs">
                    <i className="fa-solid fa-id-card"></i>
                  </span>
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="e.g. UHID-2026-54129 or +91 98200 55432"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[#cbd5e1] text-xs sm:text-sm focus:outline-hidden focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 transition"
                    required
                  />
                </div>
                <p className="text-[11px] text-[#64748b] mt-1">
                  Enter your unique patient identifier printed on previous hospital slips or SMS.
                </p>
              </div>

              {/* Auth Method Switch */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold text-[#475569]">Sign in with:</span>
                <div className="inline-flex rounded-lg bg-[#f1f5f9] p-0.5 border border-[#e2e8f0] text-xs">
                  <button
                    type="button"
                    onClick={() => setAuthMethod('otp')}
                    className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                      authMethod === 'otp' ? 'bg-white text-[#0ea5e9] shadow-xs' : 'text-[#64748b]'
                    }`}
                  >
                    <i className="fa-solid fa-comment-sms mr-1"></i> SMS OTP
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMethod('pin')}
                    className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                      authMethod === 'pin' ? 'bg-white text-[#0ea5e9] shadow-xs' : 'text-[#64748b]'
                    }`}
                  >
                    <i className="fa-solid fa-lock mr-1"></i> Security PIN
                  </button>
                </div>
              </div>

              {authMethod === 'pin' ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-[#0f172a]">
                      4-Digit Patient PIN / Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="text-[11px] text-[#0ea5e9] hover:underline cursor-pointer"
                    >
                      {showPin ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94a3b8] text-xs">
                      <i className="fa-solid fa-key"></i>
                    </span>
                    <input
                      type={showPin ? 'text' : 'password'}
                      value={loginPin}
                      onChange={(e) => setLoginPin(e.target.value)}
                      placeholder="••••"
                      maxLength={8}
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[#cbd5e1] text-xs sm:text-sm font-mono tracking-wider focus:outline-hidden focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 transition"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-[#f0f9ff] border border-[#bae6fd] rounded-xl text-xs text-[#0369a1] space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <i className="fa-solid fa-shield-halved text-[#0ea5e9]"></i>
                    <span>Fast OTP Verification</span>
                  </div>
                  <p className="text-[11px] text-[#0284c7]">
                    A 4-digit verification code will be generated for instant validation.
                  </p>
                </div>
              )}

              <div className="pt-2 space-y-2">
                {authMethod === 'otp' ? (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="w-full py-3 rounded-xl bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <i className="fa-solid fa-paper-plane"></i>
                    <span>Send Verification Code & Continue</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <i className="fa-solid fa-arrow-right-to-bracket"></i>
                    <span>Sign In & Book OPD Token</span>
                  </button>
                )}
              </div>

              {/* Demo Fast Login Section */}
              <div className="pt-4 border-t border-[#e2e8f0] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
                    Quick Demo Registered Patients:
                  </span>
                  <span className="text-[10px] text-[#0ea5e9] font-medium">1-Click Sign In</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {INITIAL_PATIENT_USERS.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleQuickLogin(user)}
                      className="p-2.5 rounded-lg border border-[#e2e8f0] hover:border-[#0ea5e9] hover:bg-[#f0f9ff] transition-all text-left flex items-center gap-2.5 group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#0ea5e9]/15 text-[#0ea5e9] flex items-center justify-center text-xs font-bold shrink-0">
                        {user.name.charAt(0)}
                      </div>
                      <div className="truncate flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#0f172a] group-hover:text-[#0ea5e9] truncate">
                          {user.name}
                        </p>
                        <p className="text-[10px] text-[#64748b] font-mono">
                          {user.uhid} • {user.bloodGroup}
                        </p>
                      </div>
                      <i className="fa-solid fa-arrow-right text-[10px] text-[#94a3b8] group-hover:text-[#0ea5e9] group-hover:translate-x-0.5 transition"></i>
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}

          {/* MODE 2: OTP VERIFICATION MODAL / VIEW */}
          {authMode === 'otp_verify' && (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-[#dcfce7] text-[#166534] flex items-center justify-center text-xl mx-auto">
                <i className="fa-solid fa-mobile-screen"></i>
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0f172a]">Enter Verification Code</h3>
                <p className="text-xs text-[#64748b] mt-1">
                  We've sent a 4-digit security code for{' '}
                  <strong className="text-[#0f172a] font-mono">{loginIdentifier}</strong>
                </p>
              </div>

              {/* Simulated Live SMS Notification Pill */}
              <div className="p-3 bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-left flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-envelope text-[#0ea5e9]"></i>
                  <div>
                    <span className="text-[10px] text-[#64748b] uppercase font-bold block">Hospital SMS Gateway</span>
                    <span className="font-mono font-bold text-[#0f172a]">Your Security Code is: <span className="text-[#0ea5e9] bg-[#e0f2fe] px-1.5 py-0.5 rounded">{generatedOtp}</span></span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEnteredOtp(generatedOtp)}
                  className="px-2 py-1 rounded bg-[#0ea5e9] text-white text-[11px] font-bold hover:bg-[#0284c7] cursor-pointer"
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
                  placeholder="• • • •"
                  className="w-48 mx-auto text-center py-2.5 text-2xl font-mono tracking-widest rounded-xl border-2 border-[#0ea5e9] focus:outline-hidden"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  className="px-4 py-2 rounded-lg bg-[#f1f5f9] text-[#475569] text-xs font-semibold hover:bg-[#e2e8f0] cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleVerifySignIn}
                  className="px-6 py-2 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  Verify & Proceed to Appointment Register
                </button>
              </div>
            </div>
          )}

          {/* MODE 3: SIGN UP (NEW PATIENT REGISTRATION) */}
          {authMode === 'signup' && (
            <div className="space-y-5">
              {/* SMART REGISTRATION UPLOAD COMPONENT */}
              <SmartDocumentUpload
                onExtractionSuccess={handleDocumentExtracted}
                onClearData={handleClearExtractedData}
                onShowToast={notify}
              />

              {/* Extraction Success Notice Banner */}
              {extractionBannerVisible && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-950 flex items-center justify-between gap-3 shadow-2xs animate-in fade-in duration-300">
                  <div className="flex items-start gap-2.5">
                    <i className="fa-solid fa-circle-check text-emerald-600 text-sm mt-0.5 shrink-0"></i>
                    <div>
                      <p className="font-bold text-emerald-950">
                        Information extracted from your document.
                      </p>
                      <p className="text-emerald-800 text-[11px] mt-0.5">
                        Please review the highlighted information before continuing. Every field is editable.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearExtractedData}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-emerald-300 text-emerald-800 rounded-lg text-[11px] font-bold transition cursor-pointer shrink-0 shadow-2xs"
                  >
                    Clear Extracted Data
                  </button>
                </div>
              )}

              <form id="registration-fields" onSubmit={handleSignUpSubmit} className="space-y-4">
                <div className="p-3 bg-[#e0f2fe] border border-[#bae6fd] rounded-xl text-xs text-[#0369a1] flex items-center gap-2">
                  <i className="fa-solid fa-circle-info text-[#0ea5e9] shrink-0"></i>
                  <span>
                    First-time visit? Registering creates your official government & hospital Electronic Health UHID.
                  </span>
                </div>

                {/* Row 1: Name & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-[#0f172a]">
                        Full Legal Name <span className="text-[#ef4444]">*</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      placeholder="e.g. Ramesh Chandra"
                      className={`w-full px-3 py-2 rounded-lg border ${getFieldBorderClass(
                        'fullName'
                      )} text-xs sm:text-sm focus:outline-hidden focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 transition`}
                      required
                    />
                    <ExtractedFieldIndicator
                      confidence={fieldConfidence.fullName}
                      fieldName="Full Legal Name"
                      isExtracted={Boolean(extractedFields.fullName)}
                      onClearField={() => handleClearSingleField('fullName')}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-[#0f172a]">
                        Mobile Number <span className="text-[#ef4444]">*</span>
                      </label>
                    </div>
                    <input
                      type="tel"
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value)}
                      placeholder="e.g. 98200 12345"
                      className={`w-full px-3 py-2 rounded-lg border ${getFieldBorderClass(
                        'mobileNumber'
                      )} text-xs sm:text-sm focus:outline-hidden focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 transition`}
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-bold text-[#0f172a] mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="name@mail.com"
                      className={`w-full px-3 py-2 rounded-lg border ${getFieldBorderClass(
                        'email'
                      )} text-xs focus:outline-hidden focus:border-[#0ea5e9] transition`}
                    />
                    <ExtractedFieldIndicator
                      confidence={fieldConfidence.email}
                      fieldName="Email Address"
                      isExtracted={Boolean(extractedFields.email)}
                      onClearField={() => handleClearSingleField('email')}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0f172a] mb-1">
                      Age (Years) <span className="text-[#ef4444]">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={signupAge}
                      onChange={(e) => setSignupAge(Number(e.target.value))}
                      className={`w-full px-3 py-2 rounded-lg border ${getFieldBorderClass(
                        'age'
                      )} text-xs focus:outline-hidden focus:border-[#0ea5e9] transition`}
                      required
                    />
                    <ExtractedFieldIndicator
                      confidence={fieldConfidence.age}
                      fieldName="Age"
                      isExtracted={Boolean(extractedFields.age)}
                      onClearField={() => handleClearSingleField('age')}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0f172a] mb-1">
                      Gender <span className="text-[#ef4444]">*</span>
                    </label>
                    <select
                      value={signupGender}
                      onChange={(e) =>
                        setSignupGender(e.target.value as 'Male' | 'Female' | 'Other')
                      }
                      className={`w-full px-2 py-2 rounded-lg border ${getFieldBorderClass(
                        'gender'
                      )} text-xs focus:outline-hidden focus:border-[#0ea5e9] transition`}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                    <ExtractedFieldIndicator
                      confidence={fieldConfidence.gender}
                      fieldName="Gender"
                      isExtracted={Boolean(extractedFields.gender)}
                      onClearField={() => handleClearSingleField('gender')}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0f172a] mb-1">
                      Blood Group
                    </label>
                    <select
                      value={signupBloodGroup}
                      onChange={(e) => setSignupBloodGroup(e.target.value)}
                      className={`w-full px-2 py-2 rounded-lg border ${getFieldBorderClass(
                        'bloodGroup'
                      )} text-xs focus:outline-hidden focus:border-[#0ea5e9] transition`}
                    >
                      {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ))}
                    </select>
                    <ExtractedFieldIndicator
                      confidence={fieldConfidence.bloodGroup}
                      fieldName="Blood Group"
                      isExtracted={Boolean(extractedFields.bloodGroup)}
                      onClearField={() => handleClearSingleField('bloodGroup')}
                    />
                  </div>
                </div>

                {/* Row 3: Emergency Contact */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-[#0f172a] mb-1">
                      Emergency Contact Name
                    </label>
                    <input
                      type="text"
                      value={signupEmergencyName}
                      onChange={(e) => setSignupEmergencyName(e.target.value)}
                      placeholder="e.g. Suman Chandra (Spouse)"
                      className={`w-full px-3 py-2 rounded-lg border ${getFieldBorderClass(
                        'emergencyContactName'
                      )} text-xs focus:outline-hidden focus:border-[#0ea5e9] transition`}
                    />
                    <ExtractedFieldIndicator
                      confidence={fieldConfidence.emergencyContactName}
                      fieldName="Emergency Contact Name"
                      isExtracted={Boolean(extractedFields.emergencyContactName)}
                      onClearField={() => handleClearSingleField('emergencyContactName')}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0f172a] mb-1">
                      Emergency Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={signupEmergencyPhone}
                      onChange={(e) => setSignupEmergencyPhone(e.target.value)}
                      placeholder="e.g. +91 98200 99887"
                      className={`w-full px-3 py-2 rounded-lg border ${getFieldBorderClass(
                        'emergencyContactPhone'
                      )} text-xs focus:outline-hidden focus:border-[#0ea5e9] transition`}
                    />
                    <ExtractedFieldIndicator
                      confidence={fieldConfidence.emergencyContactPhone}
                      fieldName="Emergency Contact Phone"
                      isExtracted={Boolean(extractedFields.emergencyContactPhone)}
                      onClearField={() => handleClearSingleField('emergencyContactPhone')}
                    />
                  </div>
                </div>

                {/* Row 4: Medical Background & Allergies */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[#0f172a]">
                      Known Drug / Food Allergies (Select all that apply)
                    </label>
                    <ExtractedFieldIndicator
                      confidence={fieldConfidence.allergies}
                      fieldName="Allergies"
                      isExtracted={Boolean(extractedFields.allergies)}
                      onClearField={() => handleClearSingleField('allergies')}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Penicillin',
                      'Sulfa Drugs',
                      'Aspirin/NSAIDs',
                      'Latex',
                      'Dust / Pollen',
                      'Contrast Dye',
                      'None',
                    ].map((item) => {
                      const isSel = selectedAllergies.includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => toggleAllergy(item)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${
                            isSel
                              ? 'bg-[#fee2e2] text-[#991b1b] border-[#ef4444] font-bold'
                              : 'bg-[#f8fafc] text-[#64748b] border-[#e2e8f0] hover:bg-[#f1f5f9]'
                          }`}
                        >
                          {isSel ? '✓ ' : '+ '}
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Row 5: Chronic Conditions */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <label className="block text-xs font-bold text-[#0f172a]">
                        Pre-existing Conditions / Medical History
                      </label>
                      <ExtractedFieldIndicator
                        confidence={fieldConfidence.medicalConditions}
                        fieldName="Conditions"
                        isExtracted={Boolean(extractedFields.medicalConditions)}
                        onClearField={() => handleClearSingleField('medicalConditions')}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setShowCustomConditionInput(!showCustomConditionInput)
                      }
                      className="text-[11px] text-[#0ea5e9] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <i className="fa-solid fa-keyboard text-[10px]"></i>
                      <span>
                        {showCustomConditionInput
                          ? 'Hide manual input'
                          : 'Type manually'}
                      </span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Hypertension (High BP)',
                      'Type 2 Diabetes',
                      'Asthma / COPD',
                      'Thyroid Disorder',
                      'Heart Disease',
                      'Arthritis',
                      'None',
                    ].map((item) => {
                      const isSel = selectedConditions.includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => toggleCondition(item)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${
                            isSel
                              ? 'bg-[#e0f2fe] text-[#0369a1] border-[#0ea5e9] font-bold'
                              : 'bg-[#f8fafc] text-[#64748b] border-[#e2e8f0] hover:bg-[#f1f5f9]'
                          }`}
                        >
                          {isSel ? '✓ ' : '+ '}
                          {item}
                        </button>
                      );
                    })}
                  </div>

                  {/* Option to manually type condition when 'None' or 'Type manually' is clicked */}
                  {showCustomConditionInput && (
                    <div className="p-2.5 bg-[#f0f9ff] border border-[#bae6fd] rounded-xl space-y-1.5 animate-in fade-in duration-200">
                      <label className="block text-[11px] font-bold text-[#0369a1] flex items-center gap-1.5">
                        <i className="fa-solid fa-pen-to-square text-[#0ea5e9]"></i>
                        <span>Type Custom / Other Pre-existing Condition:</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={customCondition}
                          onChange={(e) => setCustomCondition(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCustomCondition();
                            }
                          }}
                          placeholder="e.g. Migraine, Kidney Stones, Acid Reflux..."
                          className="flex-1 px-3 py-1.5 text-xs bg-white rounded-lg border border-[#bae6fd] focus:border-[#0ea5e9] focus:ring-1 focus:ring-[#0ea5e9] focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddCustomCondition()}
                          className="px-3 py-1.5 bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-xs font-bold rounded-lg transition shadow-2xs cursor-pointer shrink-0"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Active non-standard or selected condition tags */}
                  {selectedConditions.filter((c) => c !== 'None').length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {selectedConditions
                        .filter((c) => c !== 'None')
                        .map((c) => (
                          <span
                            key={c}
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#e0f2fe] text-[#0369a1] font-semibold text-[11px] border border-[#bae6fd]"
                          >
                            <span>{c}</span>
                            <button
                              type="button"
                              onClick={() => toggleCondition(c)}
                              className="text-[#0284c7] hover:text-[#0369a1] cursor-pointer text-xs"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                    </div>
                  )}
                </div>

                {/* Consent & Security */}
                <div className="p-3 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#334155]">
                    <input
                      type="checkbox"
                      checked={agreedTerms}
                      onChange={(e) => setAgreedTerms(e.target.checked)}
                      className="w-4 h-4 rounded text-[#0ea5e9] accent-[#0ea5e9] mt-0.5 cursor-pointer"
                    />
                    <span>
                      I consent to digital triage, Electronic Health Record (EHR) generation, and real-time OPD queue status alerts.
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <i className="fa-solid fa-user-check"></i>
                  <span>Complete Registration & Proceed to Appointment Register</span>
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Emergency Bypass Option */}
        {onEmergencyBypass && (
          <div className="bg-[#fff1f2] border-t border-[#fecdd3] p-3 text-center">
            <button
              type="button"
              onClick={onEmergencyBypass}
              className="text-xs text-[#be123c] hover:underline font-bold flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
            >
              <i className="fa-solid fa-truck-medical text-[#e11d48]"></i>
              <span>Acute Code Red Emergency? Skip registration & open Casualty Triage Bay</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
