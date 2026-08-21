import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Doctor, Patient, PreTestItem, PatientType, PatientUser, WheelchairRequest } from '../types';
import { SYMPTOMS_LIST, LAB_LOCATION_DEFAULT, generateAlphanumericUHID } from '../data/mockData';
import { WayfindingMap } from './WayfindingMap';
import { PatientAuth } from './PatientAuth';
import { OTPAuthModal } from './OTPAuthModal';
import { EditProfileModal } from './EditProfileModal';
import { playHospitalChime, playUrgentAlertSound, announceTokenVoice } from '../utils/audio';
import { exportTokenToPDF } from '../utils/pdfExport';

interface PatientPortalProps {
  doctors: Doctor[];
  currentPatient: Patient | null;
  onGenerateToken: (newPatient: Patient) => void;
  onUpdatePatient: (updated: Patient) => void;
  isMobileFrame?: boolean;
  onToggleMobileFrame?: () => void;
  onShowToast?: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
  currentUser?: PatientUser | null;
  onUserLogin?: (user: PatientUser) => void;
  onUserLogout?: () => void;
  onUpdateUserProfile?: (updatedUser: PatientUser) => void;
  onRequestTeleconsult?: () => void;
}

export const PatientPortal: React.FC<PatientPortalProps> = ({
  doctors,
  currentPatient,
  onGenerateToken,
  onUpdatePatient,
  isMobileFrame = false,
  onToggleMobileFrame,
  onShowToast,
  currentUser = null,
  onUserLogin,
  onUserLogout,
  onUpdateUserProfile,
  onRequestTeleconsult,
}) => {
  // Stepper state: 'type_selection' | 'triage' | 'token_active'
  const [currentStep, setCurrentStep] = useState<'type_selection' | 'triage' | 'token_active'>(
    currentPatient ? 'token_active' : 'type_selection'
  );

  // Form State initialized from currentUser if present - default to 'new' (General Medicine)
  const [patientType, setPatientType] = useState<PatientType>('new');
  const [patientName, setPatientName] = useState<string>(currentUser?.name || 'Rajesh Mukherjee');
  const [patientAge, setPatientAge] = useState<number>(currentUser?.age || 52);
  const [patientGender, setPatientGender] = useState<'Male' | 'Female' | 'Other'>(currentUser?.gender || 'Male');
  const [patientPhone, setPatientPhone] = useState<string>(currentUser?.phone || '+91 98200 55432');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(
    doctors.find((d) => d.department === 'General Medicine')?.id || doctors[0]?.id || 'doc-1'
  );
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(['Persistent High Fever']);
  const [otherSymptomsText, setOtherSymptomsText] = useState<string>('');
  const [allergiesText, setAllergiesText] = useState<string>(currentUser?.allergies?.join(', ') || 'Penicillin, Dust Mites');
  const [optInFastTrackLab, setOptInFastTrackLab] = useState<boolean>(true);
  
  // Wheelchair assistance request state
  const [wheelchairRequested, setWheelchairRequested] = useState<boolean>(false);
  const [wheelchairLocation, setWheelchairLocation] = useState<string>('Main Gate 1 Entrance');
  const [showWheelchairModal, setShowWheelchairModal] = useState<boolean>(false);

  // Modals & UI States
  const [showSlipModal, setShowSlipModal] = useState<boolean>(false);
  const [showNotificationModal, setShowNotificationModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [smsSentNotice, setSmsSentNotice] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [isSavingPDF, setIsSavingPDF] = useState<boolean>(false);

  // PDF Export Handler
  const handleSavePDF = () => {
    if (!currentPatient) return;
    setIsSavingPDF(true);
    playHospitalChime();
    setTimeout(() => {
      exportTokenToPDF(
        currentPatient,
        liveDoctor?.name || currentPatient.doctorName,
        activeRoom,
        notify
      );
      setIsSavingPDF(false);
    }, 350);
  };

  // Sync profile when currentUser changes
  useEffect(() => {
    if (currentUser) {
      setPatientName(currentUser.name);
      setPatientAge(currentUser.age);
      setPatientGender(currentUser.gender);
      setPatientPhone(currentUser.phone);
      if (currentUser.allergies?.length) {
        setAllergiesText(currentUser.allergies.join(', '));
      }
    }
  }, [currentUser]);

  // Selected doctor object
  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId) || doctors[0];

  // Check if critical symptom is selected
  const hasCriticalSymptom = selectedSymptoms.includes('Chest Discomfort / Tightness');

  // Compute recommended tests based on selected symptoms
  const getRecommendedTests = (): PreTestItem[] => {
    const testsMap = new Map<string, PreTestItem>();
    selectedSymptoms.forEach((symLabel) => {
      const symObj = SYMPTOMS_LIST.find((s) => s.label === symLabel);
      if (symObj) {
        symObj.recommendedTests.forEach((t) => testsMap.set(t.id, t));
      }
    });
    return Array.from(testsMap.values());
  };

  const recommendedTests = getRecommendedTests();

  const notify = (title: string, desc: string, type: 'info' | 'success' | 'urgent' = 'info') => {
    if (onShowToast) {
      onShowToast(title, desc, type);
    }
  };

  // Handle Login event
  const handleAuthSuccess = (user: PatientUser) => {
    if (onUserLogin) {
      onUserLogin(user);
    }
    setPatientName(user.name);
    setPatientAge(user.age);
    setPatientGender(user.gender);
    setPatientPhone(user.phone);
    if (user.allergies?.length) {
      setAllergiesText(user.allergies.join(', '));
    }
    setCurrentStep('type_selection');
  };

  // Emergency bypass
  const handleEmergencyBypass = () => {
    playUrgentAlertSound();
    setSelectedSymptoms(['Chest Discomfort / Tightness']);
    setCurrentStep('triage');
    notify('Emergency Triage', 'Emergency bypass triggered. Acute care bay designated.', 'urgent');
  };

  // Handle symptom toggle
  const toggleSymptom = (label: string) => {
    setSelectedSymptoms((prev) => {
      const exists = prev.includes(label);
      const next = exists ? prev.filter((s) => s !== label) : [...prev, label];

      if (!exists && label === 'Chest Discomfort / Tightness') {
        playUrgentAlertSound();
        notify('Emergency Warning', 'Chest Discomfort flagged! Emergency casualty route activated.', 'urgent');
      } else {
        playHospitalChime();
      }
      return next;
    });
  };

  // Copy Alphanumeric UHID to clipboard
  const handleCopyUHID = (uhid: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(uhid);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 3000);
      playHospitalChime();
      notify('ID Copied to Clipboard', `Unique Patient ID ${uhid} copied successfully.`, 'success');
    }
  };

  // Submit and create token
  const handleCreateToken = (isEmergency = false) => {
    const prefix = selectedDoctor?.department === 'Orthopedics' ? 'A' : selectedDoctor?.department === 'Cardiology' ? 'C' : 'G';
    const randomNum = Math.floor(Math.random() * 40) + 45;
    const tokenStr = isEmergency ? `ER-${Math.floor(Math.random() * 80) + 10}` : `${prefix}-${randomNum}`;
    const waitMins = isEmergency ? 0 : (optInFastTrackLab ? 14 : 28);
    const queuePos = isEmergency ? 0 : 2;

    const patientUhid = currentUser?.uhid || generateAlphanumericUHID('DEL');

    let wcRequestObj: WheelchairRequest | undefined = undefined;
    if (wheelchairRequested) {
      wcRequestObj = {
        id: `wc-${Date.now()}`,
        patientId: `pat-${Date.now()}`,
        patientName: patientName || currentUser?.name || 'Patient Guest',
        tokenNumber: tokenStr,
        location: wheelchairLocation,
        requestedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'requested',
      };
    }

    const allSymptomsList = [...selectedSymptoms];
    if (otherSymptomsText.trim()) {
      allSymptomsList.push(`Manual: ${otherSymptomsText.trim()}`);
    }

    const newPatient: Patient = {
      id: `pat-${Date.now()}`,
      tokenNumber: tokenStr,
      name: patientName || currentUser?.name || 'Patient Guest',
      age: Number(patientAge) || 45,
      gender: patientGender,
      phone: patientPhone || currentUser?.phone || '+91 98000 00000',
      uhid: patientUhid,
      patientType,
      department: isEmergency ? 'Emergency & Trauma' : selectedDoctor.department,
      doctorId: isEmergency ? 'doc-er' : selectedDoctor.id,
      doctorName: isEmergency ? 'Emergency Triage Team' : selectedDoctor.name,
      roomNumber: isEmergency ? 'ER Bay 1' : selectedDoctor.roomNumber,
      opdBlock: isEmergency ? 'Emergency Casualty Block' : selectedDoctor.opdBlock,
      floor: isEmergency ? 'Ground Floor' : selectedDoctor.floor,
      symptoms: allSymptomsList,
      otherSymptomsText: otherSymptomsText.trim() || undefined,
      allergiesText: allergiesText.trim() || undefined,
      triageCategory: isEmergency ? 'urgent_er' : (optInFastTrackLab ? 'fast_track_lab' : 'standard'),
      triageNotes: isEmergency
        ? 'CRITICAL RED TRIAGE: Chest discomfort. Auto-routed to Emergency Bay 1.'
        : `AI Triage: ${allSymptomsList.join(', ')}. ${optInFastTrackLab ? 'Diagnostic Fast-Track Active.' : ''}`,
      preTestRecommended: recommendedTests,
      preTestOptIn: optInFastTrackLab,
      preTestStatus: optInFastTrackLab ? 'in_progress' : 'not_required',
      queuePosition: queuePos,
      estimatedWaitMinutes: waitMins,
      status: isEmergency ? 'in_consultation' : 'waiting',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      wheelchairRequest: wcRequestObj,
    };

    onGenerateToken(newPatient);
    setCurrentStep('token_active');

    if (isEmergency) {
      playUrgentAlertSound();
      notify('Code Red Activated', 'Emergency Bay 1 prepared. Priority triage assigned.', 'urgent');
    } else {
      playHospitalChime();
      notify('Token Generated', `Token #${tokenStr} assigned to ${selectedDoctor.name} (${selectedDoctor.roomNumber})`, 'success');
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });
      } catch {}
    }
  };

  const handleSendSMS = () => {
    playHospitalChime();
    setSmsSentNotice(true);
    notify('SMS Dispatched', `Live Wayfinding link sent to ${currentPatient?.phone || patientPhone}`, 'success');
    setTimeout(() => setSmsSentNotice(false), 5000);
  };

  const handleToggleWheelchairInActiveToken = () => {
    if (!currentPatient) return;
    const isNowRequested = !wheelchairRequested;
    setWheelchairRequested(isNowRequested);
    playHospitalChime();

    const updatedWc: WheelchairRequest | undefined = isNowRequested
      ? {
          id: `wc-${Date.now()}`,
          patientId: currentPatient.id,
          patientName: currentPatient.name,
          tokenNumber: currentPatient.tokenNumber,
          location: wheelchairLocation,
          requestedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'requested',
        }
      : undefined;

    onUpdatePatient({
      ...currentPatient,
      wheelchairRequest: updatedWc,
    });

    if (isNowRequested) {
      notify(
        'Wheelchair Dispatched',
        `Porter dispatched to ${wheelchairLocation}. Estimated arrival in ~2 mins.`,
        'urgent'
      );
    } else {
      notify('Wheelchair Cancelled', 'Wheelchair assistance request marked resolved.', 'info');
    }
  };

  const handleShareWhatsApp = () => {
    playHospitalChime();
    notify('Status Shared', 'WhatsApp queue tracking link copied to clipboard & shared.', 'info');
  };

  // Sync patient room with live doctor room if doctor relocated
  const liveDoctor = doctors.find((d) => d.id === currentPatient?.doctorId);
  const activeRoom = liveDoctor?.roomNumber || currentPatient?.roomNumber || 'Room 204';
  const isDoctorShifted = liveDoctor && liveDoctor.roomNumber !== 'Room 204' && currentPatient?.department === 'Orthopedics';
  const isDoctorOnBreak = liveDoctor?.status === 'on_break';

  // MAIN CONTAINER CONTENT
  const containerContent = (
    <div className="max-w-4xl mx-auto w-full px-2.5 sm:px-4 py-3 sm:py-6 space-y-4 sm:space-y-6 box-border">
      {/* 1. TOP PATIENT PROFILE CARD (Responsive Mobile-First Layout) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 sm:p-7 flex flex-col sm:flex-row items-center sm:justify-between gap-3.5 sm:gap-4 text-center sm:text-left transition-all w-full box-border">
        {/* Left Column: Avatar & Patient Details */}
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto min-w-0">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-white flex items-center justify-center font-bold text-base sm:text-lg shadow-sm shrink-0">
            {currentUser ? currentUser.name.charAt(0) : <i className="fa-solid fa-user-shield"></i>}
          </div>
          <div className="space-y-1 flex flex-col items-center sm:items-start max-w-full min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2 max-w-full">
              <h2 className="font-extrabold text-base md:text-lg text-slate-900 tracking-tight truncate max-w-[240px] sm:max-w-none">
                {currentUser ? currentUser.name : patientName}
              </h2>
              {currentUser ? (
                <button
                  type="button"
                  onClick={() => handleCopyUHID(currentUser.uhid)}
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-full border border-sky-200 shadow-2xs max-w-full font-mono text-[11px] sm:text-xs font-bold transition-all cursor-pointer group shrink-0"
                  title="Click to copy Official Hospital UHID"
                >
                  <span className="text-[9px] font-sans font-extrabold uppercase tracking-wider text-sky-800 bg-sky-200/60 px-1 py-0.2 rounded-full shrink-0">
                    UHID
                  </span>
                  <span className="tracking-tight truncate max-w-[140px] sm:max-w-none">{currentUser.uhid}</span>
                  <i className={`fa-solid ${copiedId ? 'fa-check text-emerald-600' : 'fa-copy text-sky-500 group-hover:scale-110'} text-[10px] transition-transform shrink-0`}></i>
                </button>
              ) : (
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                  Guest Session
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium break-words text-center sm:text-left">
              {currentUser
                ? `${currentUser.age} yrs • ${currentUser.gender} • ${currentUser.phone}`
                : 'Sign in with Mobile OTP for automated history & fast-track queue pass.'}
            </p>
          </div>
        </div>

        {/* Right Column: Aligned Action Buttons (No Clipping / Wrap cleanly on mobile) */}
        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          {currentUser ? (
            <>
              <button
                type="button"
                onClick={() => setShowProfileModal(true)}
                className="flex-1 sm:flex-initial px-3 sm:px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs whitespace-nowrap"
              >
                <i className="fa-solid fa-address-card text-sky-500"></i>
                <span>Medical File</span>
              </button>
              <button
                type="button"
                onClick={() => setShowEditProfileModal(true)}
                className="flex-1 sm:flex-initial px-3 sm:px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs whitespace-nowrap"
                title="Edit personal details, age, blood group, allergies, and emergency contacts"
              >
                <i className="fa-solid fa-user-pen text-sky-600"></i>
                <span>Edit Details</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="flex-1 sm:flex-initial px-3 sm:px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs whitespace-nowrap"
                title="Switch patient account or login with another mobile OTP"
              >
                <i className="fa-solid fa-arrows-rotate text-slate-500"></i>
                <span>Switch OTP</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition shadow-sm cursor-pointer flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-mobile-screen"></i>
                <span>Mobile OTP Sign-In</span>
              </button>
            </>
          )}

          {onRequestTeleconsult && (
            <button
              type="button"
              onClick={onRequestTeleconsult}
              className="flex-1 sm:flex-initial px-3 sm:px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-sky-400 text-xs font-semibold border border-slate-800 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs whitespace-nowrap"
            >
              <i className="fa-solid fa-video"></i>
              <span>Virtual OPD</span>
            </button>
          )}
        </div>
      </div>

      {/* STEP 1: APPOINTMENT TYPE SELECTION */}
      {currentStep === 'type_selection' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-base md:text-lg text-slate-900 flex items-center gap-2.5">
                  <i className="fa-solid fa-hospital-user text-sky-500"></i>
                  <span>Step 1: Select OPD Encounter Category</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Choose your visit type to trigger the appropriate ICMR clinical triage protocols.
                </p>
              </div>
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                Step 1 of 2
              </span>
            </div>

            {/* Option Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Option A: First-Time Patient / General Medicine */}
              <div
                onClick={() => {
                  setPatientType('new');
                  const genDoc = doctors.find((d) => d.department === 'General Medicine') || doctors[0];
                  setSelectedDoctorId(genDoc.id);
                  setSelectedSymptoms(['Persistent High Fever']);
                  setCurrentStep('triage');
                  playHospitalChime();
                }}
                className={`p-5 rounded-2xl transition-all cursor-pointer text-left group ${
                  patientType === 'new'
                    ? 'border-2 border-sky-500 bg-sky-50/50 shadow-md ring-4 ring-sky-500/10'
                    : 'border border-slate-200 bg-white hover:border-sky-300 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition ${
                      patientType === 'new'
                        ? 'bg-sky-500 text-white shadow-xs'
                        : 'bg-sky-100 text-sky-600 group-hover:bg-sky-500 group-hover:text-white'
                    }`}
                  >
                    <i className="fa-solid fa-user-plus"></i>
                  </span>
                  <span
                    className={`px-3 py-1 text-xs font-semibold rounded-full border ${
                      patientType === 'new'
                        ? 'bg-sky-100 text-sky-800 border-sky-300'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {patientType === 'new' ? 'Active Choice' : 'Option A'}
                  </span>
                </div>
                <h3 className={`font-bold text-base transition ${patientType === 'new' ? 'text-sky-700' : 'text-slate-900 group-hover:text-sky-600'}`}>
                  General Medicine / New Complaint
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  First visit for new acute symptoms, fever, checkup, or unassigned specialty. Includes AI lab pre-test evaluation.
                </p>
                <div
                  className={`mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs font-semibold w-full ${
                    patientType === 'new' ? 'text-sky-700 font-bold' : 'text-sky-600 group-hover:text-sky-700'
                  }`}
                >
                  <span>Register Intake</span>
                  <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
                </div>
              </div>

              {/* Option B: Follow-up Patient */}
              <div
                onClick={() => {
                  setPatientType('followup');
                  setSelectedDoctorId(doctors[0]?.id || 'doc-1');
                  setSelectedSymptoms(['Joint / Knee Pain']);
                  setCurrentStep('triage');
                  playHospitalChime();
                }}
                className={`p-5 rounded-2xl transition-all cursor-pointer text-left group ${
                  patientType === 'followup'
                    ? 'border-2 border-sky-500 bg-sky-50/50 shadow-md ring-4 ring-sky-500/10'
                    : 'border border-slate-200 bg-white hover:border-sky-300 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition ${
                      patientType === 'followup'
                        ? 'bg-sky-500 text-white shadow-xs'
                        : 'bg-sky-100 text-sky-600 group-hover:bg-sky-500 group-hover:text-white'
                    }`}
                  >
                    <i className="fa-solid fa-clipboard-user"></i>
                  </span>
                  <span
                    className={`px-3 py-1 text-xs font-semibold rounded-full border ${
                      patientType === 'followup'
                        ? 'bg-sky-100 text-sky-800 border-sky-300'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {patientType === 'followup' ? 'Active Choice' : 'Option B'}
                  </span>
                </div>
                <h3 className={`font-bold text-base transition ${patientType === 'followup' ? 'text-sky-700' : 'text-slate-900 group-hover:text-sky-600'}`}>
                  Specialist OPD Follow-Up
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Returning patient with prior Unique ID. Retains doctor continuity with Orthopedics, Cardiology, etc.
                </p>
                <div
                  className={`mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs font-semibold w-full ${
                    patientType === 'followup' ? 'text-sky-700 font-bold' : 'text-sky-600 group-hover:text-sky-700'
                  }`}
                >
                  <span>Proceed to AI Triage</span>
                  <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
                </div>
              </div>
            </div>

            {/* Emergency Casualty Bypass Button */}
            <div className="pt-2">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-rose-50/80 p-4 sm:p-5 rounded-2xl border border-rose-200">
                <div className="flex items-center gap-3 text-xs text-rose-900">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 text-lg font-bold">
                    <i className="fa-solid fa-triangle-exclamation"></i>
                  </div>
                  <div>
                    <strong className="font-bold text-sm block">Experiencing Severe Emergency Symptoms?</strong>
                    <span>Chest pain, sudden weakness, breathlessness, or acute trauma.</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleEmergencyBypass}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer shadow-sm whitespace-nowrap flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-truck-medical"></i>
                  <span>Emergency Casualty Bypass</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: AI PRE-CONSULTATION TRIAGE FLOW */}
      {currentStep === 'triage' && (
        <div className="space-y-6">
          {/* Step Bar & Switcher Tabs */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setCurrentStep('type_selection')}
                className="text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <i className="fa-solid fa-chevron-left text-[11px]"></i>
                <span>Back to Encounter Category</span>
              </button>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Encounter Flow:</span>
                <span
                  className={`px-3 py-1 text-xs font-semibold rounded-full border ${
                    patientType === 'new'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-sky-50 text-sky-700 border-sky-200'
                  }`}
                >
                  {patientType === 'new' ? '1. General Ward Intake' : '2. Specialist OPD Follow-Up'}
                </span>
              </div>
            </div>

            {/* Visual Flow Switcher Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setPatientType('new');
                  const genDoc = doctors.find((d) => d.department === 'General Medicine') || doctors[0];
                  setSelectedDoctorId(genDoc.id);
                  playHospitalChime();
                }}
                className={`py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
                  patientType === 'new'
                    ? 'bg-white text-sky-700 shadow-sm border border-sky-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <i className="fa-solid fa-hospital-user text-sm"></i>
                <span className="truncate">New Registration (General Ward)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPatientType('followup');
                  if (selectedDoctorId === 'doc-3') {
                    setSelectedDoctorId(doctors[0]?.id || 'doc-1');
                  }
                  playHospitalChime();
                }}
                className={`py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
                  patientType === 'followup'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <i className="fa-solid fa-user-doctor text-sm text-sky-500"></i>
                <span className="truncate">Specialist OPD Follow-Up</span>
              </button>
            </div>
          </div>

          {/* Differentiated Hero Banner: New Registration vs Specialist Follow-Up */}
          {patientType === 'new' ? (
            <div className="p-5 md:p-6 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-200 text-emerald-950 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-xl font-bold shadow-xs">
                    <i className="fa-solid fa-hospital-user"></i>
                  </span>
                  <div>
                    <h3 className="font-extrabold text-base md:text-lg text-emerald-950 flex items-center gap-2">
                      <span>New Patient Registration & General Ward Intake</span>
                    </h3>
                    <p className="text-xs text-emerald-800 font-medium">
                      Primary Care Vitals Intake & ICMR Baseline Clinical Evaluation
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 text-xs font-mono font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  GENERAL WARD • ROOM 102
                </span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed pt-1">
                <strong>First-Time Hospital Intake:</strong> All walk-in and newly registered patients are evaluated at the <strong>General Ward & Primary Care OPD</strong> for baseline vitals and clinical triaging. If specialized care is required, the doctor will generate an internal referral.
              </p>
            </div>
          ) : (
            <div className="p-5 md:p-6 rounded-2xl bg-gradient-to-r from-sky-50 via-blue-50 to-slate-50 border border-sky-200 text-sky-950 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-xl bg-sky-500 text-white flex items-center justify-center text-xl font-bold shadow-xs">
                    <i className="fa-solid fa-user-doctor"></i>
                  </span>
                  <div>
                    <h3 className="font-extrabold text-base md:text-lg text-sky-950 flex items-center gap-2">
                      <span>Specialist OPD Follow-Up & Consultant Clinic</span>
                    </h3>
                    <p className="text-xs text-sky-800 font-medium">
                      Returning Patient Continuity • Direct Specialist Consultation
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 text-xs font-mono font-bold rounded-full bg-sky-100 text-sky-800 border border-sky-300">
                  SPECIALIST CLINIC ROSTER
                </span>
              </div>
              <p className="text-xs text-sky-800 leading-relaxed pt-1">
                <strong>Specialist Follow-Up:</strong> Returning patients with active UHID history may select their designated specialist doctor (Orthopedics, Cardiology, Pulmonology, etc.) to sync previous consultation records.
              </p>
            </div>
          )}

          {/* Critical Emergency Trigger Warning Banner */}
          {hasCriticalSymptom && (
            <div className="p-5 rounded-2xl bg-rose-50 border-2 border-rose-500 text-rose-950 shadow-sm space-y-3 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center text-lg font-bold shrink-0">
                  <i className="fa-solid fa-triangle-exclamation"></i>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-extrabold text-base text-rose-950">
                      CRITICAL: High Risk Symptoms Detected
                    </h3>
                    <span className="px-3 py-1 text-xs font-mono font-bold rounded-full bg-rose-200 text-rose-900 border border-rose-300">
                      CODE RED-01
                    </span>
                  </div>
                  <p className="text-xs text-rose-900 mt-1 leading-relaxed">
                    You have flagged <strong>Chest Discomfort / Tightness</strong>. Potential Acute Coronary / Respiratory emergency.
                    Proceed directly to <strong>Emergency Triage (ER Bay 1 - Ground Floor)</strong>.
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2.5">
                    <button
                      onClick={() => handleCreateToken(true)}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
                    >
                      <i className="fa-solid fa-truck-medical"></i>
                      <span>Direct to ER / Casualty Now</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedSymptoms((prev) => prev.filter((s) => s !== 'Chest Discomfort / Tightness'));
                        notify('Updated', 'Emergency flag cleared. Returned to standard OPD triage.', 'info');
                      }}
                      className="px-4 py-2 rounded-xl bg-white border border-rose-300 text-rose-800 text-xs font-semibold hover:bg-rose-50 transition cursor-pointer"
                    >
                      Deselect Chest Discomfort
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Patient Quick Info Card Pre-filled */}
          <div className="bg-white rounded-2xl p-6 md:p-7 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <i className="fa-solid fa-id-card-clip text-sky-500"></i>
                {patientType === 'new' ? '1. General Ward Intake & Patient Demographics' : '1. Specialist Consultant & Patient Demographics'}
              </h4>
              <span
                className={`px-3 py-1 text-xs font-semibold rounded-full border ${
                  patientType === 'new'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-sky-50 text-sky-700 border-sky-200'
                }`}
              >
                {patientType === 'new' ? 'General Ward Only' : 'Multi-Specialty'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Patient Full Name</label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                  placeholder="e.g. Rajesh Mukherjee"
                />
              </div>

              {/* DOCTOR / OPD SUITE SELECTOR - FILTERED BASED ON PATIENT TYPE */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5 flex items-center justify-between">
                  <span>{patientType === 'new' ? 'Assigned General Ward Doctor' : 'Select Specialist Doctor / OPD Suite'}</span>
                  {patientType === 'new' && (
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                      General Ward Locked
                    </span>
                  )}
                </label>

                {patientType === 'new' ? (
                  /* NEW REGISTRATION: ONLY SHOW GENERAL WARD / GENERAL MEDICINE OPTION */
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-emerald-50/50 border-2 border-emerald-300 text-emerald-900 font-semibold text-xs focus:outline-hidden focus:border-emerald-500"
                  >
                    {doctors
                      .filter((d) => d.department === 'General Medicine')
                      .map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.name} — General Ward / Primary Care Triage ({doc.roomNumber}, {doc.floor})
                        </option>
                      ))}
                  </select>
                ) : (
                  /* SPECIALIST OPD FOLLOW-UP: SHOW ALL SPECIALIST DOCTORS */
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                  >
                    {doctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name} — {doc.department} ({doc.roomNumber}, {doc.floor} {doc.opdBlock})
                      </option>
                    ))}
                  </select>
                )}

                {/* Helper notice */}
                <p className="text-[11px] text-slate-500 mt-1.5">
                  {patientType === 'new'
                    ? '📍 General Ward Suite (Room 102, Ground Floor) handles initial diagnostic assessment.'
                    : `📍 Assigned suite: ${selectedDoctor?.roomNumber} (${selectedDoctor?.floor} ${selectedDoctor?.opdBlock})`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Age</label>
                  <input
                    type="number"
                    value={patientAge}
                    onChange={(e) => setPatientAge(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Gender</label>
                  <select
                    value={patientGender}
                    onChange={(e) => setPatientGender(e.target.value as 'Male' | 'Female' | 'Other')}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Phone Number (SMS Token)</label>
                <input
                  type="text"
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 font-mono"
                  placeholder="+91 98XXX XXXXX"
                />
              </div>
            </div>
          </div>

          {/* Dynamic Symptom Checklist & Custom Inputs */}
          <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <i className="fa-solid fa-stethoscope text-sky-500"></i>
                  Presenting Symptoms Checklist
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select primary complaints to trigger AI pre-consultation protocols.
                </p>
              </div>
              <span className="px-3 py-1 text-xs font-mono font-semibold rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                {selectedSymptoms.length} Selected
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {SYMPTOMS_LIST.map((sym) => {
                const isSelected = selectedSymptoms.includes(sym.label);
                return (
                  <button
                    type="button"
                    key={sym.id}
                    onClick={() => toggleSymptom(sym.label)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 text-left w-full ${
                      isSelected
                        ? sym.isEmergency
                          ? 'bg-rose-50 border-rose-500 text-rose-900 shadow-xs'
                          : 'bg-sky-50 border-sky-500 text-sky-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? sym.isEmergency
                            ? 'bg-rose-600 text-white'
                            : 'bg-sky-500 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <i className={`fa-solid ${sym.icon} text-xs`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold leading-tight truncate text-slate-900">
                          {sym.label}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ml-1 ${
                            sym.isEmergency
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {sym.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                        {sym.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Symptom Input Field */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <label className="block text-xs font-bold text-slate-900">
                Other Symptoms (Describe Manually)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={otherSymptomsText}
                  onChange={(e) => setOtherSymptomsText(e.target.value)}
                  placeholder="e.g. Mild morning stiffness, dizziness after meals, nausea, fatigue..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span className="text-xs text-slate-500 font-medium">Quick suggestions:</span>
                {['Severe Fatigue', 'Morning Stiffness', 'Acid Reflux', 'Skin Rash', 'Loss of Appetite'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setOtherSymptomsText((prev) => (prev ? `${prev}, ${tag}` : tag));
                      playHospitalChime();
                    }}
                    className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Known Medical Allergies Input Field */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <label className="block text-xs font-bold text-slate-900 flex items-center justify-between">
                <span>Known Medical Allergies (e.g., Penicillin, Sulfa, Latex, Dust)</span>
                <span className="text-xs text-rose-600 font-semibold">Critical for Prescriptions</span>
              </label>
              <input
                type="text"
                value={allergiesText}
                onChange={(e) => setAllergiesText(e.target.value)}
                placeholder="e.g. Penicillin, Aspirin, Sulfa drugs, None known"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
          </div>

          {/* Diagnostic Pre-Test Recommendations Card */}
          {recommendedTests.length > 0 && (
            <div className="bg-sky-50/70 rounded-2xl p-6 border border-sky-200 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-500 text-white flex items-center justify-center">
                    <i className="fa-solid fa-microscope text-xs"></i>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs md:text-sm text-sky-950 uppercase tracking-wide">
                      AI Recommended Pre-Consultation Lab Diagnostics
                    </h4>
                    <p className="text-[11px] text-sky-800">
                      Based on ICMR clinical protocols for selected symptoms.
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                  {recommendedTests.length} Pre-Tests
                </span>
              </div>

              <div className="space-y-2">
                {recommendedTests.map((test) => (
                  <div
                    key={test.id}
                    className="p-3 rounded-xl bg-white border border-sky-200 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center font-bold">
                        <i className="fa-solid fa-vial-virus text-xs"></i>
                      </div>
                      <div>
                        <strong className="text-slate-900 block font-bold">{test.name}</strong>
                        <span className="text-xs text-slate-500">
                          {test.category} • Code: {test.code} • Est. {test.estimatedTimeMin} mins
                        </span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 text-[11px] font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Recommended
                    </span>
                  </div>
                ))}
              </div>

              {/* Opt-in Toggle */}
              <div className="pt-3 border-t border-sky-200">
                <label className="flex items-center gap-3 cursor-pointer text-xs font-semibold text-slate-900">
                  <input
                    type="checkbox"
                    checked={optInFastTrackLab}
                    onChange={(e) => {
                      e.stopPropagation();
                      setOptInFastTrackLab(e.target.checked);
                    }}
                    className="w-4 h-4 rounded text-sky-500 accent-sky-500 cursor-pointer"
                  />
                  <div>
                    <span>Fast-Track Diagnostic Pre-Tests Before Doctor Visit</span>
                    <p className="text-xs font-normal text-slate-500 mt-0.5">
                      Your token will route you to Diagnostic Wing Block C first for fast-track sample/X-ray clearance.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Emergency Wheelchair Request Toggle at Intake */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-slate-900">
                <input
                  type="checkbox"
                  checked={wheelchairRequested}
                  onChange={(e) => setWheelchairRequested(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-500 accent-sky-500 cursor-pointer"
                />
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-wheelchair text-sky-500"></i>
                  <span>Request Wheelchair Assistance at Hospital Entrance</span>
                </span>
              </label>
              <span
                className={`px-3 py-1 text-xs font-semibold rounded-full border ${
                  wheelchairRequested
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {wheelchairRequested ? 'Porter Requested' : 'Optional'}
              </span>
            </div>

            {wheelchairRequested && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2.5 text-xs text-emerald-900 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Select Arrival Gate for Porter Pickup:</span>
                  <span className="text-xs font-bold text-emerald-800">Est. Porter Arrival: 2 mins</span>
                </div>
                <select
                  value={wheelchairLocation}
                  onChange={(e) => setWheelchairLocation(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-emerald-300 text-slate-900 text-xs font-semibold focus:outline-hidden"
                >
                  <option value="Main Gate 1 Entrance">Main Gate 1 Entrance (Reception Atrium)</option>
                  <option value="Metro Skywalk Gate 3">Metro Skywalk Gate 3 (Overpass)</option>
                  <option value="Emergency Gate 2 / Casualty">Emergency Gate 2 / Casualty Bay</option>
                  <option value="Multi-Level Parking P1">Multi-Level Parking P1 (Level 0 Drop-off)</option>
                </select>
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            {!hasCriticalSymptom ? (
              <button
                type="button"
                onClick={() => handleCreateToken(false)}
                className="w-full py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <i className="fa-solid fa-ticket"></i>
                <span>Generate OPD Token & View Indoor Route</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleCreateToken(true)}
                className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition cursor-pointer animate-pulse"
              >
                <i className="fa-solid fa-truck-medical"></i>
                <span>Issue Priority Emergency ER Pass</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* STEP 3: LIVE TOKEN & REAL-TIME INDOOR WAYFINDING MAP */}
      {currentStep === 'token_active' && currentPatient && (
        <div className="space-y-6">
          {/* Top Token Active Navigation Bar */}
          <div className="flex flex-col xs:flex-row items-center justify-between gap-2.5 pb-3 border-b border-slate-200/80 text-xs w-full">
            <button
              onClick={() => setCurrentStep('type_selection')}
              className="text-sky-600 hover:text-sky-700 font-bold flex items-center justify-center gap-2 cursor-pointer px-3 py-1.5 rounded-xl hover:bg-sky-50 transition w-full xs:w-auto"
            >
              <i className="fa-solid fa-plus text-[11px]"></i>
              <span>Register Another Token</span>
            </button>
            {/* Subtle Clean Pill Badge */}
            <span className="px-3.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs shrink-0">
              ACTIVE QUEUE PASS
            </span>
          </div>

          {/* Doctor Relocated Banner */}
          {isDoctorShifted && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-sky-50 border-2 border-sky-500 text-sky-950 shadow-sm animate-pulse">
              <div className="flex items-center gap-3">
                <i className="fa-solid fa-bell-concierge text-sky-500 text-xl shrink-0"></i>
                <div className="flex-1 text-xs">
                  <strong className="text-slate-900 font-bold block text-sm">
                    📢 Doctor Relocated in Real-Time!
                  </strong>
                  {liveDoctor?.name} has shifted to <span className="underline font-bold text-slate-900">{activeRoom} (East Wing Annex)</span>.
                  Your route map and room telemetry have updated automatically below.
                </div>
              </div>
            </div>
          )}

          {/* Doctor On Break Notice */}
          {isDoctorOnBreak && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-3">
              <i className="fa-solid fa-mug-hot text-amber-500 text-lg shrink-0"></i>
              <div>
                <strong>Doctor On Short Break:</strong> Consultation will resume in ~8 mins. Your position in queue remains reserved.
              </div>
            </div>
          )}

          {/* 2. MAIN TOKEN PASS CARD ("A-42" / "G-48") */}
          <div className="rounded-2xl bg-gradient-to-br from-sky-500 via-sky-600 to-cyan-600 text-white text-center p-4 sm:p-8 shadow-lg relative overflow-hidden space-y-3 w-full box-border">
            <div className="flex flex-col xs:flex-row gap-2 justify-between items-center text-center xs:text-left px-1 w-full">
              <span className="text-xs font-bold uppercase tracking-widest text-sky-100">
                LIVE PATIENT PASS
              </span>
              <button
                type="button"
                onClick={() => handleCopyUHID(currentPatient.uhid)}
                className="inline-flex items-center self-center xs:self-auto text-xs font-mono bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full font-bold transition gap-1.5 cursor-pointer backdrop-blur-xs max-w-full"
                title="Click to copy Unique ID"
              >
                <span className="truncate max-w-[180px] sm:max-w-none">{currentPatient.uhid}</span>
                <i className="fa-solid fa-copy text-[10px] shrink-0"></i>
              </button>
            </div>

            {/* Dynamic Token Display (Centered with responsive clamp) */}
            <div className="token-clamp font-black font-mono tracking-tight my-2 drop-shadow-sm text-center">
              {currentPatient.tokenNumber}
            </div>

            {/* Sub-info with Flexible Centered Pill Container */}
            <div className="py-1.5 my-1 flex justify-center w-full">
              <div className="inline-block bg-white/15 backdrop-blur-xs px-3.5 sm:px-4 py-2 rounded-full sub-pill-clamp font-semibold text-white shadow-2xs max-w-full text-center break-words">
                {currentPatient.queuePosition === 0
                  ? '🎉 You are Next! Please proceed into room'
                  : `${currentPatient.queuePosition} Patients Ahead • Est. wait ~${currentPatient.estimatedWaitMinutes} mins`}
              </div>
            </div>

            {/* Center-aligned Action inside Token Card */}
            <div className="pt-3 border-t border-white/20 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => announceTokenVoice(currentPatient.tokenNumber, activeRoom, liveDoctor?.name || currentPatient.doctorName)}
                className="w-full xs:w-auto px-4 py-2 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer backdrop-blur-xs"
              >
                <i className="fa-solid fa-volume-high text-xs"></i>
                <span>Listen Audio Call</span>
              </button>
            </div>
          </div>

          {/* 3. DESTINATION CARD */}
          <div className="p-4 sm:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 sm:gap-4 w-full box-border">
            <div className="space-y-1 text-left min-w-0">
              <div className="text-xs text-sky-600 font-bold uppercase tracking-wider">
                DESTINATION & SUITE
              </div>
              <div className="text-base md:text-lg font-extrabold text-slate-900 truncate">
                {liveDoctor?.name || currentPatient.doctorName}
              </div>
              <div className="text-xs text-slate-500">
                {currentPatient.opdBlock} | {currentPatient.floor} | <strong className="text-slate-900">{activeRoom}</strong>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowSlipModal(true)}
                className="flex-1 sm:flex-initial px-3.5 sm:px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs whitespace-nowrap"
              >
                <i className="fa-solid fa-print text-slate-400"></i>
                <span>Digital Pass</span>
              </button>
              <button
                type="button"
                onClick={handleSendSMS}
                className="flex-1 sm:flex-initial px-3.5 sm:px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm whitespace-nowrap"
              >
                <i className="fa-solid fa-paper-plane"></i>
                <span>SMS Route</span>
              </button>
            </div>
          </div>

          {/* SMS Notification Banner confirmation */}
          {smsSentNotice && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <i className="fa-solid fa-circle-check text-emerald-600 text-base"></i>
                <span>SMS Link sent to {currentPatient.phone}. Open link on any phone to track live!</span>
              </span>
              <button onClick={() => setSmsSentNotice(false)} className="text-emerald-800 font-bold cursor-pointer p-1">✕</button>
            </div>
          )}

          {/* 4. ACTION BUTTON GROUPING (Responsive Mobile Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3.5 w-full">
            <button
              type="button"
              onClick={handleToggleWheelchairInActiveToken}
              className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-2.5 transition cursor-pointer shadow-2xs ${
                currentPatient.wheelchairRequest || wheelchairRequested
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <i className={`fa-solid fa-wheelchair text-sm ${currentPatient.wheelchairRequest || wheelchairRequested ? 'text-emerald-600' : 'text-sky-500'}`}></i>
              <span>{currentPatient.wheelchairRequest || wheelchairRequested ? 'Wheelchair Dispatched' : 'Request Wheelchair'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="p-3.5 rounded-2xl border bg-white border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2.5 transition cursor-pointer shadow-2xs"
            >
              <i className="fa-brands fa-whatsapp text-emerald-500 text-base"></i>
              <span>Share with Family</span>
            </button>

            <button
              type="button"
              onClick={() => setShowNotificationModal(true)}
              className="p-3.5 rounded-2xl border bg-white border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2.5 transition cursor-pointer sm:col-span-2 md:col-span-1 shadow-2xs"
            >
              <i className="fa-solid fa-bell text-amber-500 text-sm"></i>
              <span>OPD Announcements</span>
            </button>
          </div>

          {/* 5. PRE-TEST STATUS PILL BANNER */}
          {currentPatient.preTestOptIn && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                {/* Subtle Clean Status Pill Badge */}
                <span
                  className={`px-3 py-1 text-xs font-semibold rounded-full border ${
                    currentPatient.preTestStatus === 'completed'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {currentPatient.preTestStatus === 'completed' ? 'LAB COMPLETED' : 'LAB IN PROGRESS'}
                </span>
                <span className="text-xs text-slate-500">
                  {currentPatient.preTestStatus === 'completed' ? 'Preliminary diagnostics ready' : `Proceed to ${LAB_LOCATION_DEFAULT}`}
                </span>
              </div>
              {currentPatient.preTestStatus !== 'completed' && (
                <button
                  type="button"
                  onClick={() => {
                    onUpdatePatient({
                      ...currentPatient,
                      preTestStatus: 'completed',
                    });
                    playHospitalChime();
                    notify('Lab Completed', 'Preliminary diagnostics recorded. Doctor dashboard updated!', 'success');
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition cursor-pointer shadow-2xs"
                >
                  Mark Done
                </button>
              )}
            </div>
          )}

          {/* Visual Step-by-Step Route Map Component */}
          <div className="rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm">
            <WayfindingMap
              roomNumber={activeRoom}
              doctorName={liveDoctor?.name || currentPatient.doctorName}
              floor={currentPatient.floor}
              block={currentPatient.opdBlock}
              isEmergency={currentPatient.triageCategory === 'urgent_er'}
              onShowToast={onShowToast}
            />
          </div>
        </div>
      )}

      {/* PATIENT PROFILE DETAILS MODAL */}
      {showProfileModal && currentUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-base border border-sky-100">
                  {currentUser.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">{currentUser.name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono text-xs text-sky-600 font-semibold">{currentUser.uhid}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyUHID(currentUser.uhid)}
                      className="text-xs text-slate-400 hover:text-sky-600"
                      title="Copy UHID"
                    >
                      <i className="fa-solid fa-copy"></i>
                    </button>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Age / Gender</span>
                  <span className="font-bold text-slate-800">{currentUser.age} yrs • {currentUser.gender}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Blood Group</span>
                  <span className="font-bold text-sky-600">{currentUser.bloodGroup}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Mobile</span>
                  <span className="font-bold text-slate-800 font-mono">{currentUser.phone}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Registered On</span>
                  <span className="font-bold text-slate-800">{currentUser.registeredAt}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Emergency Contact</span>
                <p className="font-semibold text-slate-800">{currentUser.emergencyContactName}</p>
                <p className="font-mono text-slate-500">{currentUser.emergencyContactPhone}</p>
              </div>

              <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 space-y-1">
                <span className="text-rose-600 block text-[10px] uppercase font-bold">Documented Allergies</span>
                <p className="font-semibold text-rose-800">
                  {currentUser.allergies?.length ? currentUser.allergies.join(', ') : 'No known drug or environmental allergies'}
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowProfileModal(false);
                  if (onUserLogout) onUserLogout();
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-50 text-rose-700 font-semibold text-xs cursor-pointer hover:bg-rose-100 transition"
              >
                Switch Account
              </button>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="px-6 py-2.5 rounded-xl bg-sky-500 text-white font-semibold text-xs cursor-pointer hover:bg-sky-600 transition shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIGITAL TOKEN PASS MODAL WITH PDF EXPORT */}
      {showSlipModal && currentPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div
            id="printable-token-pass"
            className="bg-white rounded-3xl border border-slate-200 max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-8 text-center space-y-4 sm:space-y-5 shadow-2xl animate-in zoom-in-95 duration-200 box-border"
          >
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center mx-auto text-lg sm:text-xl font-bold shadow-xs">
              <i className="fa-solid fa-hospital"></i>
            </div>
            <div>
              <span className="text-[10px] sm:text-xs font-bold tracking-widest text-slate-500 uppercase">
                ST. JUDE MEDICAL CENTER
              </span>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5">OPD Consultation Pass</h3>
              <div className="flex items-center justify-center gap-1.5 mt-1.5 flex-wrap">
                <span className="text-xs font-mono font-bold text-sky-700 bg-sky-50 px-3 py-1 rounded-full border border-sky-200 truncate max-w-[200px]">
                  {currentPatient.uhid}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyUHID(currentPatient.uhid)}
                  className="text-xs text-slate-400 hover:text-sky-600 p-1 cursor-pointer no-print shrink-0"
                  title="Copy UHID"
                >
                  <i className={`fa-solid ${copiedId ? 'fa-check text-emerald-600' : 'fa-copy'}`}></i>
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 sm:space-y-3 text-left text-xs">
              <div className="text-center pb-2.5 border-b border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Token Number</span>
                <div className="token-clamp font-black font-mono text-sky-600 tracking-tight my-1">
                  {currentPatient.tokenNumber}
                </div>
                <span className="text-[11px] sm:text-xs text-slate-500 font-medium">
                  {currentPatient.queuePosition === 0
                    ? 'Next in line • Proceed to consultation room'
                    : `${currentPatient.queuePosition} patients ahead • Est. wait ~${currentPatient.estimatedWaitMinutes} mins`}
                </span>
              </div>
              <div className="flex justify-between text-xs pt-1 gap-2">
                <span className="text-slate-400 shrink-0">Patient:</span>
                <span className="font-bold text-slate-900 truncate text-right">{currentPatient.name} ({currentPatient.age}y / {currentPatient.gender})</span>
              </div>
              <div className="flex justify-between text-xs gap-2">
                <span className="text-slate-400 shrink-0">Doctor:</span>
                <span className="font-bold text-slate-900 truncate text-right">{activeRoom} ({liveDoctor?.name || currentPatient.doctorName})</span>
              </div>
              <div className="flex justify-between text-xs gap-2">
                <span className="text-slate-400 shrink-0">Location:</span>
                <span className="font-semibold text-sky-600 truncate text-right">{currentPatient.opdBlock}, {currentPatient.floor}</span>
              </div>
              <div className="flex justify-between text-xs gap-2">
                <span className="text-slate-400 shrink-0">Allergies:</span>
                <span className="font-semibold text-rose-600 truncate text-right">{currentPatient.allergiesText || 'None known'}</span>
              </div>
              {currentPatient.wheelchairRequest && (
                <div className="flex justify-between text-xs pt-2 border-t border-slate-200 gap-2">
                  <span className="text-emerald-700 font-bold shrink-0">Wheelchair:</span>
                  <span className="text-emerald-700 font-bold truncate text-right">Porter at {currentPatient.wheelchairRequest.location}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 no-print pt-1">
              <button
                type="button"
                onClick={handleSavePDF}
                disabled={isSavingPDF}
                className="flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-75"
                title="Save PDF file directly to device memory"
              >
                {isSavingPDF ? (
                  <>
                    <i className="fa-solid fa-circle-notch animate-spin text-sm"></i>
                    <span>Saving PDF...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-file-arrow-down text-sm sm:text-base"></i>
                    <span className="tracking-wide">Save PDF</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleCopyUHID(currentPatient.uhid)}
                className="px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer flex items-center gap-1.5 transition shrink-0"
                title="Copy Unique Patient ID"
              >
                <i className={`fa-solid ${copiedId ? 'fa-check text-emerald-600' : 'fa-copy'}`}></i>
                <span className="hidden xs:inline">{copiedId ? 'Copied' : 'Copy ID'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSlipModal(false)}
                className="px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs cursor-pointer transition shrink-0"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OPD NOTIFICATIONS MODAL */}
      {showNotificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 space-y-4 shadow-xl text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <i className="fa-solid fa-bell text-sky-500"></i>
                <h3 className="font-bold text-sm text-slate-900">Hospital Live Announcements</h3>
              </div>
              <button onClick={() => setShowNotificationModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-900">
                <strong className="block font-bold">📢 Diagnostic Fast-Track Bay Open</strong>
                Blood sample collection & X-Ray running without delays at Ground Floor Diagnostic Wing (Block C).
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-700">
                <strong className="block font-bold">☕ Cafeteria & 24/7 Pharmacy</strong>
                Located on Ground Floor next to Main Entrance Gate 1.
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-700">
                <strong className="block font-bold">♿ Wheelchair Porter Service</strong>
                Active porters stationed at Gate 1, Gate 2, and Metro Skywalk.
              </div>
            </div>

            <button
              onClick={() => setShowNotificationModal(false)}
              className="w-full py-2.5 rounded-xl bg-sky-500 text-white text-xs font-semibold hover:bg-sky-600 transition cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* OTP AUTH MODAL */}
      <OTPAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLoginSuccess={handleAuthSuccess}
        onShowToast={notify}
      />
    </div>
  );

  // If mobile frame is toggled on, wrap in phone mockup
  if (isMobileFrame) {
    return (
      <div className="flex flex-col items-center justify-center py-2">
        <div className="bg-slate-800 rounded-[40px] p-3 border-8 border-slate-700 w-[340px] sm:w-[360px] shadow-2xl relative">
          <div className="bg-slate-50 w-full rounded-[28px] overflow-hidden flex flex-col min-h-[640px] max-h-[720px]">
            <div className="bg-slate-900 p-4 text-white">
              <div className="text-[10px] opacity-70">Welcome to Medi-Queue</div>
              <div className="text-base font-bold truncate">{currentUser?.name || patientName}</div>
            </div>

            <div className="p-3 flex-1 overflow-y-auto scrollbar-thin">
              {containerContent}
            </div>

            <div className="bg-white p-2.5 flex justify-around border-t border-slate-200">
              <button
                type="button"
                onClick={() => setCurrentStep('type_selection')}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs transition cursor-pointer ${
                  currentStep === 'type_selection' ? 'bg-sky-500 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="Category / Intake"
              >
                <i className="fa-solid fa-home"></i>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (currentPatient) {
                    setCurrentStep('token_active');
                  } else {
                    setCurrentStep('triage');
                  }
                }}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs transition cursor-pointer ${
                  currentStep === 'token_active' || currentStep === 'triage' ? 'bg-sky-500 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="Active Token / Route"
              >
                <i className="fa-solid fa-ticket"></i>
              </button>
              <button
                type="button"
                onClick={() => setShowNotificationModal(true)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs transition cursor-pointer"
                title="Hospital Alerts & Notices"
              >
                <i className="fa-solid fa-bell"></i>
              </button>
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-slate-500 mt-2">Patient Device Emulator</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {containerContent}
    </div>
  );
};
