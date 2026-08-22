import React, { useState, useEffect } from 'react';
import { Doctor, PatientUser, TeleconsultAppointment, TeleconsultPaymentDetails } from '../types';
import { playHospitalChime, playUrgentAlertSound } from '../utils/audio';
import { getValidDoctorAvatar, handleDoctorImageError } from '../utils/doctorAvatar';
import { INITIAL_PATIENT_USERS, generateAlphanumericUHID } from '../data/mockData';
import { signInWithGoogle, saveUserProfileToFirestore, savePatientTokenToFirestore } from '../firebase';
import { exportTokenToPDF } from '../utils/pdfExport';
import confetti from 'canvas-confetti';

interface TeleconsultModuleProps {
  doctors: Doctor[];
  currentUser: PatientUser | null;
  onUserLogin?: (user: PatientUser) => void;
  onShowToast: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
  onReturnToOPD?: () => void;
  onBookInPersonInstead?: () => void;
}

// Generate realistic date options: Today, Tomorrow, Day after Tomorrow
const getAvailableDates = () => {
  const dates = [];
  const today = new Date();

  for (let i = 0; i < 3; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' });
    const formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    dates.push({
      label: `${dayName} (${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
      fullDate: `${dayName}, ${formattedDate}`,
      isoDate: d.toISOString().split('T')[0],
    });
  }
  return dates;
};

// Realistic predefined consultation time slots per doctor
const DOCTOR_TIME_SLOTS: Record<string, string[]> = {
  'doc-1': ['09:30 AM - 09:45 AM', '10:15 AM - 10:30 AM', '11:45 AM - 12:00 PM', '02:30 PM - 02:45 PM', '04:15 PM - 04:30 PM', '05:30 PM - 05:45 PM'],
  'doc-2': ['10:00 AM - 10:15 AM', '11:30 AM - 11:45 AM', '02:00 PM - 02:15 PM', '03:45 PM - 04:00 PM', '04:45 PM - 05:00 PM', '06:00 PM - 06:15 PM'],
  'doc-3': ['09:00 AM - 09:15 AM', '10:45 AM - 11:00 AM', '12:15 PM - 12:30 PM', '03:15 PM - 03:30 PM', '05:00 PM - 05:15 PM', '06:30 PM - 06:45 PM'],
  'doc-4': ['09:45 AM - 10:00 AM', '11:15 AM - 11:30 AM', '01:45 PM - 02:00 PM', '03:30 PM - 03:45 PM', '05:15 PM - 05:30 PM'],
};

const DEFAULT_SLOTS = [
  '09:30 AM - 09:45 AM',
  '10:30 AM - 10:45 AM',
  '11:45 AM - 12:00 PM',
  '02:15 PM - 02:30 PM',
  '03:45 PM - 04:00 PM',
  '05:00 PM - 05:15 PM',
];

export const TeleconsultModule: React.FC<TeleconsultModuleProps> = ({
  doctors,
  currentUser,
  onUserLogin,
  onShowToast,
  onReturnToOPD,
  onBookInPersonInstead,
}) => {
  const availableDates = getAvailableDates();

  // Booking Selection State
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor>(
    doctors.find((d) => d.teleconsultAvailable) || doctors[0]
  );
  const [selectedDate, setSelectedDate] = useState<string>(availableDates[0].fullDate);
  const [selectedSlot, setSelectedSlot] = useState<string>(
    (DOCTOR_TIME_SLOTS[selectedDoctor?.id] || DEFAULT_SLOTS)[1] || '11:30 AM - 11:45 AM'
  );
  const [selectedPlan, setSelectedPlan] = useState<'onetime_299' | 'pass_999' | 'pass_3999'>('onetime_299');

  // Dynamic Amount Calculation
  const getPlanAmount = (plan: 'onetime_299' | 'pass_999' | 'pass_3999') => {
    switch (plan) {
      case 'pass_3999':
        return 3999;
      case 'pass_999':
        return 999;
      case 'onetime_299':
      default:
        return 299;
    }
  };

  const getPlanLabel = (plan: 'onetime_299' | 'pass_999' | 'pass_3999') => {
    switch (plan) {
      case 'pass_3999':
        return 'Family Super Care Pass';
      case 'pass_999':
        return 'Annual Health Pass';
      case 'onetime_299':
      default:
        return 'Single Consultation';
    }
  };

  const currentAmount = getPlanAmount(selectedPlan);

  // Multi-step Flow State: 'roster' | 'confirmation' | 'payment' | 'processing' | 'success' | 'failure'
  const [bookingStep, setBookingStep] = useState<
    'roster' | 'confirmation' | 'payment' | 'processing' | 'success' | 'failure'
  >('roster');

  const [confirmedAppointment, setConfirmedAppointment] = useState<TeleconsultAppointment | null>(null);
  const [lastPaymentDetails, setLastPaymentDetails] = useState<TeleconsultPaymentDetails | null>(null);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState<string>('');

  // Authentication Modal State (with preserved slot context)
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');
  const [loginIdentifier, setLoginIdentifier] = useState<string>('SJMC-2026-DEL-08942A');
  const [loginPin, setLoginPin] = useState<string>('1234');
  const [authMethod, setAuthMethod] = useState<'otp' | 'pin'>('otp');
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [generatedOtp, setGeneratedOtp] = useState<string>('5412');
  const [enteredOtp, setEnteredOtp] = useState<string>('');
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');

  // Sign Up Form State
  const [signupName, setSignupName] = useState<string>('');
  const [signupPhone, setSignupPhone] = useState<string>('');
  const [signupEmail, setSignupEmail] = useState<string>('');
  const [signupAge, setSignupAge] = useState<number>(32);
  const [signupGender, setSignupGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [signupBloodGroup, setSignupBloodGroup] = useState<string>('O+');
  const [signupEmergencyName, setSignupEmergencyName] = useState<string>('');
  const [signupEmergencyPhone, setSignupEmergencyPhone] = useState<string>('');
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [agreedTerms, setAgreedTerms] = useState<boolean>(true);

  // Slot Validation State
  const [slotUnavailableError, setSlotUnavailableError] = useState<string>('');
  const [isSlotValidating, setIsSlotValidating] = useState<boolean>(false);

  // Payment Form & Methods State
  const [paymentMethodTab, setPaymentMethodTab] = useState<'upi' | 'card' | 'netbanking' | 'wallets' | 'paylater'>('upi');
  
  // UPI Sub-options
  const [upiOption, setUpiOption] = useState<'apps' | 'id' | 'qr'>('apps');
  const [selectedUpiApp, setSelectedUpiApp] = useState<'gpay' | 'phonepe' | 'paytm' | 'bhim' | 'cred'>('gpay');
  const [upiIdInput, setUpiIdInput] = useState<string>('patient@okhdfcbank');
  const [isUpiVerified, setIsUpiVerified] = useState<boolean>(true);

  // Card Inputs
  const [cardNumber, setCardNumber] = useState<string>('4532 8921 4420 1092');
  const [cardholderName, setCardholderName] = useState<string>('RAHUL SHARMA');
  const [cardExpiry, setCardExpiry] = useState<string>('08/29');
  const [cardCvv, setCardCvv] = useState<string>('842');
  const [saveCardRbi, setSaveCardRbi] = useState<boolean>(true);

  // Net Banking Inputs
  const [selectedBank, setSelectedBank] = useState<string>('HDFC Bank');

  // Wallets & PayLater
  const [selectedWallet, setSelectedWallet] = useState<string>('Amazon Pay');
  const [selectedPayLater, setSelectedPayLater] = useState<string>('Simpl PayLater');

  // Simulation & Testing Controls
  const [simulateFailure, setSimulateFailure] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<string>('Initiating 256-bit secure gateway...');

  // Active Live Video Call State
  const [isInCall, setIsInCall] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
  const [callDurationSecs, setCallDurationSecs] = useState<number>(0);
  const [consultationNotes, setConsultationNotes] = useState<string>(
    'Patient presented for virtual follow-up. Vital review normal. Recommended lifestyle modification and follow-up in 4 weeks.'
  );

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

  // Card Number Auto-formatting
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ');
    setCardNumber(formatted);
  };

  // Expiry Date Auto-formatting
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      raw = raw.slice(0, 2) + '/' + raw.slice(2, 4);
    }
    setCardExpiry(raw);
  };

  // Switch doctor & pick appropriate slot
  const handleSelectDoctor = (doc: Doctor) => {
    setSelectedDoctor(doc);
    const slots = DOCTOR_TIME_SLOTS[doc.id] || DEFAULT_SLOTS;
    if (!slots.includes(selectedSlot)) {
      setSelectedSlot(slots[0] || '10:00 AM - 10:15 AM');
    }
  };

  // User clicks "Book Slot" or selects slot
  const handleInitiateBooking = (doc: Doctor, slot?: string, date?: string) => {
    setSelectedDoctor(doc);
    if (slot) setSelectedSlot(slot);
    if (date) setSelectedDate(date);
    setSlotUnavailableError('');

    playHospitalChime();

    // Flow Check: Is user authenticated?
    if (currentUser) {
      // Flow 3: Already logged in -> directly open review & confirmation screen
      setBookingStep('confirmation');
    } else {
      // Flow 1 & 2: Not logged in -> preserve selection and show professional Auth modal
      setShowAuthModal(true);
      setAuthError('');
    }
  };

  // Complete Login & Preserve Context
  const handleSuccessfulAuth = (authenticatedUser: PatientUser) => {
    saveUserProfileToFirestore(authenticatedUser);
    if (onUserLogin) {
      onUserLogin(authenticatedUser);
    }

    try {
      confetti({ particleCount: 35, spread: 60, origin: { y: 0.6 } });
    } catch {}

    playHospitalChime();
    setShowAuthModal(false);
    setIsAuthLoading(false);

    onShowToast(
      'Authenticated Successfully',
      `Welcome, ${authenticatedUser.name}! Returning to your preserved slot with ${selectedDoctor.name}.`,
      'success'
    );

    // Transition directly to review appointment screen with preserved slot
    setBookingStep('confirmation');
  };

  // Google Sign-In
  const handleGoogleSignIn = async () => {
    try {
      setIsAuthLoading(true);
      setAuthError('');
      const user = await signInWithGoogle();
      if (user) {
        handleSuccessfulAuth(user);
      }
    } catch (err: any) {
      console.warn('Google Sign In error:', err);
      setAuthError('Unable to complete Google sign-in. You can use Mobile OTP or Demo patient login.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Quick Demo Login
  const handleQuickDemoLogin = (demoUser: PatientUser) => {
    setIsAuthLoading(true);
    setTimeout(() => {
      handleSuccessfulAuth(demoUser);
    }, 400);
  };

  // Send OTP
  const handleSendOtp = () => {
    if (!loginIdentifier.trim()) {
      setAuthError('Please enter your UHID or 10-digit mobile number.');
      return;
    }
    setAuthError('');
    const randomOtp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(randomOtp);
    setOtpSent(true);
    playHospitalChime();
    onShowToast('Security OTP Sent', `Verification Code: ${randomOtp} dispatched for ${loginIdentifier}.`, 'info');
  };

  // Verify Sign In
  const handleVerifySignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);

    setTimeout(() => {
      const cleanId = loginIdentifier.trim().toLowerCase();
      const matchedUser = INITIAL_PATIENT_USERS.find(
        (u) =>
          u.uhid.toLowerCase() === cleanId ||
          u.phone.replace(/\s+/g, '') === cleanId.replace(/\s+/g, '') ||
          u.name.toLowerCase().includes(cleanId)
      );

      if (matchedUser) {
        handleSuccessfulAuth(matchedUser);
      } else {
        const newUser: PatientUser = {
          id: `user-${Date.now()}`,
          uhid: cleanId.startsWith('sjmc') || cleanId.startsWith('uhid') ? loginIdentifier.toUpperCase() : generateAlphanumericUHID('DEL'),
          name: cleanId.startsWith('sjmc') || cleanId.startsWith('uhid') ? 'Registered Patient' : loginIdentifier,
          phone: loginIdentifier.startsWith('+') ? loginIdentifier : `+91 ${loginIdentifier}`,
          email: 'patient@hospital.org',
          age: 38,
          gender: 'Male',
          bloodGroup: 'B+',
          emergencyContactName: 'Next of Kin',
          emergencyContactPhone: '+91 98000 00000',
          allergies: [],
          chronicConditions: [],
          registeredAt: new Date().toISOString().split('T')[0],
        };
        handleSuccessfulAuth(newUser);
      }
    }, 600);
  };

  // Sign Up Submit
  const handleSignUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupName.trim()) {
      setAuthError('Please enter your full legal name.');
      return;
    }
    if (!signupPhone.trim()) {
      setAuthError('Please provide a valid contact mobile number.');
      return;
    }
    if (!agreedTerms) {
      setAuthError('Please accept the tele-health consultation and EHR consent to continue.');
      return;
    }

    setIsAuthLoading(true);
    setAuthError('');

    setTimeout(() => {
      const newUhid = generateAlphanumericUHID('DEL');
      const newPatientUser: PatientUser = {
        id: `user-${Date.now()}`,
        uhid: newUhid,
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
      };

      handleSuccessfulAuth(newPatientUser);
    }, 700);
  };

  // Validate Slot Availability on Backend
  const validateSlotAvailability = async (): Promise<boolean> => {
    try {
      setIsSlotValidating(true);
      const res = await fetch('/api/teleconsult/validate-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId: selectedDoctor.id,
          date: selectedDate,
          slotTime: selectedSlot,
          patientId: currentUser?.id || currentUser?.uhid,
        }),
      });
      const data = await res.json();
      if (data && data.success && !data.available) {
        setSlotUnavailableError(data.message || 'This slot is no longer available. Please select another slot.');
        return false;
      }
      return true;
    } catch (e) {
      return true;
    } finally {
      setIsSlotValidating(false);
    }
  };

  // Step 2 -> Step 3: From Review & Confirm Appointment to SECURE PAYMENT PAGE
  const handleProceedToPayment = async () => {
    if (!currentUser) {
      setShowAuthModal(true);
      setAuthError('Authentication required to proceed to payment.');
      return;
    }

    setSlotUnavailableError('');
    const isAvailable = await validateSlotAvailability();
    if (!isAvailable) {
      playUrgentAlertSound();
      onShowToast('Slot Unavailable', 'The selected slot was just taken. Please select an alternate slot.', 'urgent');
      return;
    }

    playHospitalChime();
    setBookingStep('payment');
  };

  // Step 3 -> Step 4/5: Process Secure Payment & Confirm Appointment on Success
  const handleExecutePayment = async () => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    // Input validations based on active tab
    if (paymentMethodTab === 'card') {
      const cleanNum = cardNumber.replace(/\s+/g, '');
      if (cleanNum.length < 15) {
        onShowToast('Invalid Card Number', 'Please enter a valid 16-digit card number.', 'urgent');
        return;
      }
      if (!cardExpiry.includes('/') || cardExpiry.length < 5) {
        onShowToast('Invalid Expiry', 'Please enter card expiry date in MM/YY format.', 'urgent');
        return;
      }
      if (cardCvv.length < 3) {
        onShowToast('Invalid CVV', 'Please enter 3 or 4 digit CVV code.', 'urgent');
        return;
      }
    } else if (paymentMethodTab === 'upi' && upiOption === 'id') {
      if (!upiIdInput.includes('@') || upiIdInput.trim().length < 5) {
        onShowToast('Invalid UPI ID', 'Please enter a valid UPI ID (e.g. name@okhdfcbank).', 'urgent');
        return;
      }
    }

    // Enter Processing State
    setBookingStep('processing');
    setProcessingStage('Establishing encrypted 256-bit TLS tunnel...');

    // Progress simulated steps
    setTimeout(() => {
      setProcessingStage('Authenticating with Bank / UPI network...');
    }, 1000);

    setTimeout(() => {
      setProcessingStage('Securing appointment lock & finalizing transaction...');
    }, 1900);

    setTimeout(async () => {
      // If user enabled simulation failure
      if (simulateFailure) {
        playUrgentAlertSound();
        setPaymentErrorMessage('Transaction declined by issuing bank (ERR_BANK_DECLINE_504). No money was deducted.');
        setBookingStep('failure');
        onShowToast('Payment Failed', 'Bank authentication failed. You can retry with another method.', 'urgent');
        return;
      }

      // Generate payment method label
      let methodLabel = 'UPI - Google Pay';
      if (paymentMethodTab === 'upi') {
        if (upiOption === 'apps') {
          methodLabel = `UPI App (${selectedUpiApp.toUpperCase()})`;
        } else if (upiOption === 'id') {
          methodLabel = `UPI ID (${upiIdInput})`;
        } else {
          methodLabel = 'UPI Dynamic QR Scan';
        }
      } else if (paymentMethodTab === 'card') {
        const last4 = cardNumber.replace(/\s+/g, '').slice(-4) || '1092';
        methodLabel = `Credit/Debit Card (ending in ${last4})`;
      } else if (paymentMethodTab === 'netbanking') {
        methodLabel = `Net Banking (${selectedBank})`;
      } else if (paymentMethodTab === 'wallets') {
        methodLabel = `Wallet (${selectedWallet})`;
      } else if (paymentMethodTab === 'paylater') {
        methodLabel = `PayLater (${selectedPayLater})`;
      }

      const generatedPaymentId = `PAY-${new Date().getFullYear()}-MQ-${Math.floor(10000 + Math.random() * 90000)}`;
      const generatedTxnId = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const paymentResult = {
        status: 'success',
        paymentId: generatedPaymentId,
        transactionId: generatedTxnId,
        method: paymentMethodTab,
        methodLabel,
        amount: currentAmount,
        currency: 'INR',
        gatewayRef: `GW-RAZORPAY-MOCK-${Math.floor(100000 + Math.random() * 900000)}`,
      };

      try {
        // Backend Protected Verification and Final Appointment Creation
        const res = await fetch('/api/teleconsult/verify-payment-and-book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientUser: currentUser,
            doctor: selectedDoctor,
            hospitalId: selectedDoctor.hospitalId || 'hosp-max-mohali',
            hospitalName: selectedDoctor.hospitalName || 'Max Super Specialty Hospital, Mohali',
            hospitalAddress: selectedDoctor.hospitalAddress || 'Near Civil Hospital, Phase 6, Sector 56, Mohali',
            selectedDate,
            selectedSlot,
            paymentPlan: selectedPlan,
            paymentResult,
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to verify payment with hospital servers.');
        }

        const appointment: TeleconsultAppointment = data.appointment;
        setConfirmedAppointment(appointment);
        setLastPaymentDetails(appointment.paymentDetails || null);

        // Save token to Firestore so it reflects on patient pass & hospital queue
        const tokenNumber = `TC-${appointment.id.split('-')[2] || '42'}`;
        savePatientTokenToFirestore({
          id: appointment.id,
          userId: currentUser.id,
          tokenNumber,
          name: currentUser.name,
          age: currentUser.age,
          gender: currentUser.gender,
          phone: currentUser.phone,
          uhid: currentUser.uhid,
          patientType: 'new',
          hospitalId: appointment.hospitalId || selectedDoctor.hospitalId || 'hosp-max-mohali',
          hospitalName: appointment.hospitalName || selectedDoctor.hospitalName || 'Max Super Specialty Hospital, Mohali',
          hospitalAddress: appointment.hospitalAddress || selectedDoctor.hospitalAddress || 'Near Civil Hospital, Phase 6, Sector 56, Mohali',
          department: selectedDoctor.department,
          doctorId: selectedDoctor.id,
          doctorName: selectedDoctor.name,
          roomNumber: `Virtual Room (${selectedDoctor.roomNumber})`,
          opdBlock: 'Telehealth Digital Wing',
          floor: 'Virtual Suite',
          symptoms: ['Virtual Tele-Consultation Request'],
          triageCategory: 'standard',
          triageNotes: `Tele-consult booked for ${selectedDate} at ${selectedSlot}. Plan: ${getPlanLabel(selectedPlan)} • Fee ₹${currentAmount} Paid (${generatedPaymentId})`,
          preTestRecommended: [],
          preTestOptIn: false,
          preTestStatus: 'not_required',
          queuePosition: 1,
          estimatedWaitMinutes: 0,
          status: 'waiting',
          createdAt: new Date().toISOString(),
          teleconsult: {
            isTeleconsult: true,
            paymentPlan: selectedPlan,
            status: 'confirmed',
            paidAmount: appointment.amount,
            meetingRoomId: appointment.meetingRoomId,
            scheduledTime: `${selectedDate} • ${selectedSlot}`,
          },
        });

        playHospitalChime();
        try {
          confetti({ particleCount: 75, spread: 90, origin: { y: 0.5 } });
        } catch {}

        setBookingStep('success');
        onShowToast(
          'Payment Successful & Booking Confirmed',
          `Payment ID ${generatedPaymentId} captured. Appointment ${appointment.id} created!`,
          'success'
        );
      } catch (err: any) {
        console.error('Payment confirmation error:', err);
        setPaymentErrorMessage(err.message || 'Payment verification failed. Please try again.');
        setBookingStep('failure');
        playUrgentAlertSound();
      }
    }, 2800);
  };

  // Launch Simulated Video Consultation
  const handleLaunchVideoCall = () => {
    setIsInCall(true);
    playHospitalChime();
    onShowToast(
      'Live Video Call Connected',
      `Encrypted consultation room active with ${selectedDoctor.name}.`,
      'success'
    );
  };

  // Conclude Call
  const handleEndCall = () => {
    setIsInCall(false);
    playHospitalChime();
    onShowToast(
      'Consultation Concluded',
      `Virtual session summary & digital e-prescription generated for ${selectedDoctor.name}.`,
      'info'
    );
  };

  // Export PDF Slip
  const handleExportPDF = () => {
    if (!confirmedAppointment) return;
    const dummyPatient: any = {
      id: confirmedAppointment.id,
      tokenNumber: confirmedAppointment.id,
      name: confirmedAppointment.patientName,
      age: currentUser?.age || 35,
      gender: currentUser?.gender || 'Male',
      phone: confirmedAppointment.patientPhone,
      uhid: confirmedAppointment.patientUhid,
      patientType: 'new',
      hospitalId: confirmedAppointment.hospitalId || 'hosp-max-mohali',
      hospitalName: confirmedAppointment.hospitalName || 'Max Super Specialty Hospital, Mohali',
      hospitalAddress: confirmedAppointment.hospitalAddress || 'Near Civil Hospital, Phase 6, Sector 56, Mohali',
      department: confirmedAppointment.doctorDepartment,
      doctorId: confirmedAppointment.doctorId,
      doctorName: confirmedAppointment.doctorName,
      roomNumber: confirmedAppointment.doctorRoom,
      opdBlock: 'Telehealth Virtual Wing',
      floor: 'Virtual Suite',
      symptoms: ['Tele-Consultation Session'],
      triageCategory: 'standard',
      triageNotes: `Confirmed Video Slot: ${confirmedAppointment.date} at ${confirmedAppointment.slotTime} | Paid: ₹${confirmedAppointment.amount} (${lastPaymentDetails?.paymentId || 'Captured'})`,
      preTestRecommended: [],
      preTestOptIn: false,
      preTestStatus: 'not_required',
      queuePosition: 1,
      estimatedWaitMinutes: 0,
      status: 'waiting',
      createdAt: confirmedAppointment.createdAt,
    };
    exportTokenToPDF(
      dummyPatient,
      confirmedAppointment.doctorName,
      confirmedAppointment.doctorRoom,
      onShowToast
    );
  };

  const doctorSlots = DOCTOR_TIME_SLOTS[selectedDoctor?.id] || DEFAULT_SLOTS;

  return (
    <div className="space-y-4">
      {/* Top Teleconsult Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-4 sm:p-6 rounded-2xl border border-slate-700 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-300 text-[10px] font-bold uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping"></span>
              24/7 Virtual OPD Tele-Consultation
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Consult Top Specialists from Home
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Zero hospital wait times. Browse available specialists and slots freely. Sign in before booking to secure your appointment.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onBookInPersonInstead && (
              <button
                type="button"
                onClick={onBookInPersonInstead}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition cursor-pointer flex items-center gap-1.5"
              >
                <i className="fa-solid fa-hospital-user text-sky-400"></i>
                <span>Switch to In-Hospital Queue</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* VIEW 1: LIVE SIMULATED VIDEO CALL SCREEN */}
      {isInCall ? (
        <div className="bg-slate-900 rounded-2xl border border-slate-700 p-3 sm:p-5 shadow-2xl text-white space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                  <span>Live Video Consultation</span>
                  <span className="text-[10px] bg-slate-800 text-sky-400 border border-sky-400/30 px-2 py-0.5 rounded-full font-mono">
                    HD 1080p • Encrypted
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  With {selectedDoctor.name} ({selectedDoctor.specialty})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg font-mono text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <i className="fa-solid fa-record-vinyl text-rose-500 animate-spin"></i>
                <span>{formatTimer(callDurationSecs)}</span>
              </div>
            </div>
          </div>

          {/* Video Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 relative aspect-video sm:aspect-[16/10] bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-inner flex items-center justify-center">
              <img
                src={getValidDoctorAvatar(selectedDoctor.id, selectedDoctor.avatar)}
                alt={selectedDoctor.name}
                onError={(e) => handleDoctorImageError(e, selectedDoctor.id)}
                className="w-full h-full object-cover opacity-90 filter contrast-105"
              />

              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 text-xs font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>{selectedDoctor.name}</span>
                <span className="text-[10px] text-slate-300">({selectedDoctor.roomNumber})</span>
              </div>

              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1.5">
                <i className="fa-solid fa-microphone text-emerald-400 text-xs"></i>
                <div className="flex items-end gap-0.5 h-3">
                  <span className="w-1 bg-emerald-400 h-2 animate-bounce"></span>
                  <span className="w-1 bg-emerald-400 h-3 animate-pulse"></span>
                  <span className="w-1 bg-emerald-400 h-1.5 animate-bounce"></span>
                  <span className="w-1 bg-emerald-400 h-3 animate-ping"></span>
                </div>
                <span className="text-[10px] text-slate-300 font-mono">Audio Active</span>
              </div>

              <div className="absolute bottom-3 right-3 w-28 sm:w-36 aspect-video bg-black/80 rounded-lg overflow-hidden border-2 border-sky-500 shadow-lg flex items-center justify-center">
                {isVideoOff ? (
                  <div className="text-center p-2">
                    <i className="fa-solid fa-video-slash text-slate-400 text-sm"></i>
                    <p className="text-[9px] text-slate-400 mt-0.5">Camera Off</p>
                  </div>
                ) : (
                  <div className="relative w-full h-full bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center">
                    <i className="fa-solid fa-user text-white/50 text-xl"></i>
                    <div className="absolute top-1 right-1 bg-black/60 px-1 rounded text-[8px] text-white">
                      You ({currentUser?.name?.split(' ')[0] || 'Patient'})
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Side Clinical Telehealth Panel */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-3.5 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between border-b border-slate-700 pb-2 mb-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Live Telehealth Session
                  </h4>
                  <span className="text-[10px] text-sky-400 font-bold">
                    {confirmedAppointment?.meetingRoomId || '#VID-MQ-2026'}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700">
                    <span className="text-[10px] text-slate-400 block">Patient Profile</span>
                    <p className="font-bold text-white mt-0.5">
                      {currentUser ? currentUser.name : 'Registered Patient'}
                    </p>
                    <p className="text-[11px] text-sky-400 font-mono">
                      {currentUser ? currentUser.uhid : 'SJMC-2026-DEL-08942A'}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700">
                    <span className="text-[10px] text-slate-400 block">Doctor's Live Prescription Notes</span>
                    <textarea
                      value={consultationNotes}
                      onChange={(e) => setConsultationNotes(e.target.value)}
                      rows={3}
                      className="w-full mt-1 bg-transparent text-xs text-slate-200 focus:outline-hidden border-none resize-none"
                      placeholder="Doctor's clinical findings & prescription..."
                    />
                  </div>

                  <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-[11px] text-sky-300 flex items-center gap-2">
                    <i className="fa-solid fa-file-shield text-xs"></i>
                    <span>E-Prescription will be dispatched via SMS & WhatsApp.</span>
                  </div>
                </div>
              </div>

              {/* Call Control Toolbar */}
              <div className="pt-3 border-t border-slate-700 flex items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className={`p-3 rounded-full transition cursor-pointer ${
                    isMuted ? 'bg-rose-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
                </button>

                <button
                  type="button"
                  onClick={() => setIsVideoOff(!isVideoOff)}
                  className={`p-3 rounded-full transition cursor-pointer ${
                    isVideoOff ? 'bg-rose-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                  title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
                >
                  <i className={`fa-solid ${isVideoOff ? 'fa-video-slash' : 'fa-video'}`}></i>
                </button>

                <button
                  type="button"
                  onClick={handleEndCall}
                  className="px-4 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-lg"
                >
                  <i className="fa-solid fa-phone-slash"></i>
                  <span>End Consult</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : bookingStep === 'confirmation' ? (
        /* VIEW 2: REVIEW & CONFIRM APPOINTMENT (Before Secure Payment) */
        <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in zoom-in-95 duration-200">
          {/* Breadcrumb Indicator */}
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
            <button
              type="button"
              onClick={() => setBookingStep('roster')}
              className="text-sky-600 hover:text-sky-700 flex items-center gap-1.5 cursor-pointer"
            >
              <i className="fa-solid fa-arrow-left"></i>
              <span>Back to Doctor Roster</span>
            </button>
            <span className="badge badge-sky">Step 1 of 3: Review Appointment</span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-5 sm:p-7 space-y-5">
            {/* Header */}
            <div className="border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center text-lg font-bold shadow-xs">
                  <i className="fa-solid fa-clipboard-check"></i>
                </span>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900">Review & Confirm Appointment</h3>
                  <p className="text-xs text-slate-500">
                    Verify your consultation details. You will proceed to the Secure Payment Gateway next.
                  </p>
                </div>
              </div>
            </div>

            {/* Selected Slot Box */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-sky-50 to-indigo-50/50 border border-sky-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-sky-700 uppercase tracking-wider flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-check text-sky-500"></i>
                  <span>Selected Slot</span>
                </span>
                <span className="badge badge-green text-[10px]">
                  <i className="fa-solid fa-lock mr-1"></i> Slot Reserved
                </span>
              </div>

              <div className="flex items-start gap-3.5">
                <img
                  src={getValidDoctorAvatar(selectedDoctor.id, selectedDoctor.avatar)}
                  alt={selectedDoctor.name}
                  onError={(e) => handleDoctorImageError(e, selectedDoctor.id)}
                  className="w-14 h-14 rounded-xl object-cover border border-slate-200 bg-slate-100 shrink-0 shadow-xs"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="font-extrabold text-base text-slate-900">{selectedDoctor.name}</h4>
                  <p className="text-xs font-semibold text-sky-700">{selectedDoctor.specialty}</p>
                  <p className="text-xs text-slate-600 mt-1 font-bold flex items-center gap-1.5">
                    <i className="fa-regular fa-calendar text-sky-500"></i>
                    <span>{selectedDate}</span>
                    <span>•</span>
                    <i className="fa-regular fa-clock text-sky-500"></i>
                    <span>{selectedSlot}</span>
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-sky-200/70 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Consultation Type</span>
                  <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                    <i className="fa-solid fa-video text-sky-600"></i>
                    <span>Tele-Consult (HD Video)</span>
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Doctor OPD Room</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{selectedDoctor.roomNumber} ({selectedDoctor.department})</span>
                </div>
              </div>
            </div>

            {/* Patient Details Summary */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <i className="fa-solid fa-user-check text-sky-600"></i>
                  <span>Patient Information</span>
                </span>
                <span className="text-[11px] text-sky-700 font-mono font-bold">{currentUser?.uhid}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-slate-700">
                <div>
                  <span className="text-[10px] text-slate-500 block">Patient Name</span>
                  <span className="font-bold text-slate-900">{currentUser?.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Mobile Number</span>
                  <span className="font-mono font-semibold">{currentUser?.phone}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Age & Gender</span>
                  <span className="font-semibold">{currentUser?.age} yrs • {currentUser?.gender}</span>
                </div>
              </div>
            </div>

            {/* Select Consultation Plan */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-900 block">
                Select Tele-Consultation Plan
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setSelectedPlan('onetime_299')}
                  className={`p-3 rounded-xl border-2 transition cursor-pointer ${
                    selectedPlan === 'onetime_299'
                      ? 'border-sky-500 bg-sky-50/70 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">Single Consultation</span>
                    <span className="text-sm font-black text-sky-600">₹299</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    1 HD Video Session (15 mins) + 48hr follow-up e-prescription chat.
                  </p>
                </div>

                <div
                  onClick={() => setSelectedPlan('pass_999')}
                  className={`p-3 rounded-xl border-2 transition cursor-pointer relative overflow-hidden ${
                    selectedPlan === 'pass_999'
                      ? 'border-sky-500 bg-sky-50/70 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span className="absolute top-0 right-0 bg-sky-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-bl-md">
                    POPULAR
                  </span>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">Annual Health Pass</span>
                    <span className="text-sm font-black text-sky-600">₹999 / yr</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Unlimited Tele-Consults for family + Priority In-Hospital Token Queue.
                  </p>
                </div>
              </div>
            </div>

            {/* Error message if slot was taken */}
            {slotUnavailableError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <i className="fa-solid fa-triangle-exclamation text-rose-600 text-sm shrink-0"></i>
                  <span>{slotUnavailableError}</span>
                </div>
                <div className="pt-1">
                  <span className="text-[11px] font-semibold block text-slate-700 mb-1">
                    Please pick another open slot for {selectedDoctor.name}:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {doctorSlots.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setSelectedSlot(s);
                          setSlotUnavailableError('');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          selectedSlot === s
                            ? 'bg-sky-500 text-white shadow-xs'
                            : 'bg-white border border-slate-300 text-slate-700 hover:border-sky-400'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBookingStep('roster')}
                className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold transition cursor-pointer"
              >
                Change Slot
              </button>

              <button
                type="button"
                onClick={handleProceedToPayment}
                disabled={isSlotValidating}
                className="flex-2 py-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs sm:text-sm font-bold transition shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <i className="fa-solid fa-lock"></i>
                <span>Proceed to Secure Payment (₹{currentAmount})</span>
              </button>
            </div>
          </div>
        </div>
      ) : bookingStep === 'payment' ? (
        /* VIEW 3: DEDICATED SECURE PAYMENT PAGE */
        <div className="max-w-4xl mx-auto space-y-4 animate-in fade-in zoom-in-95 duration-200">
          {/* Top Nav & Breadcrumb */}
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
            <button
              type="button"
              onClick={() => setBookingStep('confirmation')}
              className="text-sky-600 hover:text-sky-700 flex items-center gap-1.5 cursor-pointer"
            >
              <i className="fa-solid fa-arrow-left"></i>
              <span>Back to Review</span>
            </button>
            <div className="flex items-center gap-2 text-slate-600">
              <span className="inline-flex items-center gap-1 text-emerald-600 font-mono text-[11px]">
                <i className="fa-solid fa-shield-halved"></i> 256-bit SSL Encrypted
              </span>
              <span className="badge badge-sky">Step 2 of 3: Secure Payment</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* LEFT COLUMN: PAYMENT METHODS (8 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg font-bold shadow-xs">
                      <i className="fa-solid fa-lock"></i>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base sm:text-lg text-slate-900">Secure Payment</h3>
                      <p className="text-xs text-slate-500">Choose your preferred payment method</p>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-full">
                    <i className="fa-solid fa-lock text-emerald-600"></i>
                    <span>PCI-DSS Compliant</span>
                  </div>
                </div>

                {/* Payment Method Selector Tabs */}
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
                    <button
                      type="button"
                      onClick={() => setPaymentMethodTab('upi')}
                      className={`py-2 px-1 rounded-lg transition text-center cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 ${
                        paymentMethodTab === 'upi'
                          ? 'bg-white text-sky-700 shadow-xs font-black'
                          : 'hover:text-slate-900'
                      }`}
                    >
                      <i className="fa-solid fa-mobile-screen-button text-sky-500"></i>
                      <span>UPI</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethodTab('card')}
                      className={`py-2 px-1 rounded-lg transition text-center cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 ${
                        paymentMethodTab === 'card'
                          ? 'bg-white text-sky-700 shadow-xs font-black'
                          : 'hover:text-slate-900'
                      }`}
                    >
                      <i className="fa-regular fa-credit-card text-emerald-500"></i>
                      <span>Card</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethodTab('netbanking')}
                      className={`py-2 px-1 rounded-lg transition text-center cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 ${
                        paymentMethodTab === 'netbanking'
                          ? 'bg-white text-sky-700 shadow-xs font-black'
                          : 'hover:text-slate-900'
                      }`}
                    >
                      <i className="fa-solid fa-building-columns text-indigo-500"></i>
                      <span>NetBanking</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethodTab('wallets')}
                      className={`py-2 px-1 rounded-lg transition text-center cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 ${
                        paymentMethodTab === 'wallets'
                          ? 'bg-white text-sky-700 shadow-xs font-black'
                          : 'hover:text-slate-900'
                      }`}
                    >
                      <i className="fa-solid fa-wallet text-amber-500"></i>
                      <span>Wallets</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethodTab('paylater')}
                      className={`py-2 px-1 rounded-lg transition text-center cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 ${
                        paymentMethodTab === 'paylater'
                          ? 'bg-white text-sky-700 shadow-xs font-black'
                          : 'hover:text-slate-900'
                      }`}
                    >
                      <i className="fa-solid fa-clock-rotate-left text-violet-500"></i>
                      <span>PayLater</span>
                    </button>
                  </div>

                  {/* TAB 1: UPI PAYMENT */}
                  {paymentMethodTab === 'upi' && (
                    <div className="space-y-4 pt-1 animate-in fade-in duration-150">
                      {/* UPI Option Sub-pills */}
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setUpiOption('apps')}
                          className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                            upiOption === 'apps' ? 'bg-sky-100 text-sky-800' : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          Popular UPI Apps
                        </button>
                        <button
                          type="button"
                          onClick={() => setUpiOption('id')}
                          className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                            upiOption === 'id' ? 'bg-sky-100 text-sky-800' : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          Enter UPI ID / VPA
                        </button>
                        <button
                          type="button"
                          onClick={() => setUpiOption('qr')}
                          className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                            upiOption === 'qr' ? 'bg-sky-100 text-sky-800' : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          Scan QR Code
                        </button>
                      </div>

                      {upiOption === 'apps' && (
                        <div className="space-y-3">
                          <label className="text-xs font-bold text-slate-700 block">
                            Select UPI App on this device:
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {[
                              { id: 'gpay', label: 'Google Pay', icon: 'fa-brands fa-google text-rose-500' },
                              { id: 'phonepe', label: 'PhonePe', icon: 'fa-solid fa-p text-indigo-600' },
                              { id: 'paytm', label: 'Paytm UPI', icon: 'fa-solid fa-coins text-sky-500' },
                              { id: 'bhim', label: 'BHIM UPI', icon: 'fa-solid fa-bolt text-amber-500' },
                            ].map((app) => (
                              <button
                                key={app.id}
                                type="button"
                                onClick={() => setSelectedUpiApp(app.id as any)}
                                className={`p-3 rounded-xl border-2 text-center transition cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                                  selectedUpiApp === app.id
                                    ? 'border-sky-500 bg-sky-50 shadow-xs'
                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                              >
                                <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm">
                                  <i className={app.icon}></i>
                                </span>
                                <span className="text-xs font-bold text-slate-800">{app.label}</span>
                              </button>
                            ))}
                          </div>
                          <p className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
                            <i className="fa-solid fa-circle-info text-sky-500"></i>
                            <span>You will receive a fast UPI collect notification request in {selectedUpiApp.toUpperCase()}.</span>
                          </p>
                        </div>
                      )}

                      {upiOption === 'id' && (
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-700 block">
                            Virtual Payment Address (VPA / UPI ID)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={upiIdInput}
                              onChange={(e) => {
                                setUpiIdInput(e.target.value);
                                setIsUpiVerified(e.target.value.includes('@'));
                              }}
                              placeholder="mobile@upi or name@okhdfcbank"
                              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono focus:border-sky-500 focus:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setIsUpiVerified(upiIdInput.includes('@'));
                                onShowToast('UPI Verified', `${upiIdInput} verified with NPCI registry.`, 'success');
                              }}
                              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
                            >
                              Verify
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold">
                            <i className="fa-solid fa-circle-check text-emerald-600"></i>
                            <span>Verified VPA Handle registered with NPCI / Unified Payments Interface</span>
                          </div>
                        </div>
                      )}

                      {upiOption === 'qr' && (
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
                          <div className="w-36 h-36 mx-auto bg-white p-2 rounded-xl border border-slate-300 shadow-xs flex flex-col items-center justify-center">
                            <i className="fa-solid fa-qrcode text-6xl text-slate-800"></i>
                            <span className="text-[8px] font-mono text-slate-500 mt-1">UPI://PAY/MEDIQUEUE</span>
                          </div>
                          <p className="text-xs font-bold text-slate-800">
                            Scan with Any UPI App (GPay, PhonePe, Paytm)
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Amount: <strong className="text-slate-900">₹{currentAmount}</strong> • Auto-confirm in 3 mins
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: CREDIT / DEBIT CARD */}
                  {paymentMethodTab === 'card' && (
                    <div className="space-y-3.5 pt-1 animate-in fade-in duration-150">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Card Number
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={cardNumber}
                            onChange={handleCardNumberChange}
                            maxLength={19}
                            placeholder="4532 8921 4420 1092"
                            className="w-full px-3.5 py-2.5 pr-14 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono tracking-wider focus:border-sky-500 focus:outline-hidden"
                          />
                          <div className="absolute right-3 top-2.5 flex items-center gap-1 text-slate-400 text-base">
                            <i className="fa-brands fa-cc-visa text-sky-600"></i>
                            <i className="fa-brands fa-cc-mastercard text-rose-500"></i>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Cardholder Name (as on card)
                        </label>
                        <input
                          type="text"
                          value={cardholderName}
                          onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
                          placeholder="RAHUL SHARMA"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold tracking-wide focus:border-sky-500 focus:outline-hidden"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">
                            Expiry Date
                          </label>
                          <input
                            type="text"
                            value={cardExpiry}
                            onChange={handleExpiryChange}
                            maxLength={5}
                            placeholder="MM/YY"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono focus:border-sky-500 focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center justify-between">
                            <span>CVV / CVC</span>
                            <span className="text-[10px] text-slate-400 font-normal">3 or 4 digits</span>
                          </label>
                          <div className="relative">
                            <input
                              type="password"
                              value={cardCvv}
                              onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                              maxLength={4}
                              placeholder="•••"
                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono tracking-widest focus:border-sky-500 focus:outline-hidden"
                            />
                            <i className="fa-solid fa-lock text-slate-400 text-xs absolute right-3 top-3"></i>
                          </div>
                        </div>
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={saveCardRbi}
                          onChange={(e) => setSaveCardRbi(e.target.checked)}
                          className="rounded text-sky-600 focus:ring-0"
                        />
                        <span>Securely tokenise this card as per RBI guidelines</span>
                      </label>
                    </div>
                  )}

                  {/* TAB 3: NET BANKING */}
                  {paymentMethodTab === 'netbanking' && (
                    <div className="space-y-3.5 pt-1 animate-in fade-in duration-150">
                      <label className="text-xs font-bold text-slate-700 block">
                        Select from Popular Indian Banks:
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          { name: 'SBI', fullName: 'State Bank of India', icon: 'fa-building-columns' },
                          { name: 'HDFC Bank', fullName: 'HDFC Bank Ltd', icon: 'fa-building-columns' },
                          { name: 'ICICI Bank', fullName: 'ICICI Bank Ltd', icon: 'fa-building-columns' },
                          { name: 'Axis Bank', fullName: 'Axis Bank Ltd', icon: 'fa-building-columns' },
                          { name: 'Kotak Mahindra Bank', fullName: 'Kotak Mahindra', icon: 'fa-building-columns' },
                          { name: 'Punjab National Bank', fullName: 'PNB', icon: 'fa-building-columns' },
                        ].map((b) => (
                          <button
                            key={b.name}
                            type="button"
                            onClick={() => setSelectedBank(b.name)}
                            className={`p-2.5 rounded-xl border-2 text-left transition cursor-pointer flex items-center gap-2 ${
                              selectedBank === b.name
                                ? 'border-sky-500 bg-sky-50 font-bold text-sky-900 shadow-xs'
                                : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                            }`}
                          >
                            <span className="w-6 h-6 rounded-md bg-slate-100 text-sky-600 flex items-center justify-center text-xs shrink-0">
                              <i className={`fa-solid ${b.icon}`}></i>
                            </span>
                            <span className="text-xs font-semibold truncate">{b.name}</span>
                          </button>
                        ))}
                      </div>

                      <div className="pt-2">
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Or select other bank (50+ available):
                        </label>
                        <select
                          value={selectedBank}
                          onChange={(e) => setSelectedBank(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium focus:border-sky-500 focus:outline-hidden bg-white"
                        >
                          <option value="HDFC Bank">HDFC Bank</option>
                          <option value="State Bank of India">State Bank of India</option>
                          <option value="ICICI Bank">ICICI Bank</option>
                          <option value="Axis Bank">Axis Bank</option>
                          <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                          <option value="Bank of Baroda">Bank of Baroda</option>
                          <option value="Canara Bank">Canara Bank</option>
                          <option value="Union Bank of India">Union Bank of India</option>
                          <option value="IndusInd Bank">IndusInd Bank</option>
                          <option value="IDFC First Bank">IDFC First Bank</option>
                          <option value="Federal Bank">Federal Bank</option>
                          <option value="Yes Bank">Yes Bank</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: WALLETS */}
                  {paymentMethodTab === 'wallets' && (
                    <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                      <label className="text-xs font-bold text-slate-700 block">
                        Select Digital Wallet:
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        {[
                          { id: 'Amazon Pay', desc: 'Fast 1-click checkout' },
                          { id: 'Paytm Wallet', desc: 'Direct balance debit' },
                          { id: 'PhonePe Wallet', desc: 'Auto-linked balance' },
                          { id: 'Mobikwik', desc: 'SuperCash applicable' },
                        ].map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => setSelectedWallet(w.id)}
                            className={`p-3 rounded-xl border-2 text-left transition cursor-pointer ${
                              selectedWallet === w.id
                                ? 'border-sky-500 bg-sky-50 shadow-xs'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <i className="fa-solid fa-wallet text-amber-500 text-sm"></i>
                              <span className="text-xs font-bold text-slate-900">{w.id}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1">{w.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 5: PAYLATER / EMI */}
                  {paymentMethodTab === 'paylater' && (
                    <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                      <label className="text-xs font-bold text-slate-700 block">
                        PayLater & Cardless Credit:
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        {[
                          { id: 'Simpl PayLater', desc: 'Pay on the 15th with 0% interest' },
                          { id: 'LazyPay', desc: 'Instant 1-tap checkout credit' },
                          { id: 'ICICI PayLater', desc: '30-day deferred billing' },
                          { id: 'HDFC FlexiPay', desc: 'Zero cost 15/30/60 days' },
                        ].map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedPayLater(p.id)}
                            className={`p-3 rounded-xl border-2 text-left transition cursor-pointer ${
                              selectedPayLater === p.id
                                ? 'border-sky-500 bg-sky-50 shadow-xs'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <i className="fa-solid fa-bolt text-violet-600 text-sm"></i>
                              <span className="text-xs font-bold text-slate-900">{p.id}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1">{p.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Gateway Test / Simulation Notice */}
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="font-semibold text-slate-700">Sandbox Payment Gateway Active</span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    <input
                      type="checkbox"
                      checked={simulateFailure}
                      onChange={(e) => setSimulateFailure(e.target.checked)}
                      className="rounded text-rose-600"
                    />
                    <span>Simulate Payment Failure (Testing)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: BOOKING & ORDER SUMMARY (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-4 sm:p-5 space-y-4">
                <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                    Booking Summary
                  </h4>
                  <span className="badge badge-sky text-[10px]">
                    <i className="fa-solid fa-video mr-1"></i> Tele-Consult
                  </span>
                </div>

                {/* Doctor & Slot Info */}
                <div className="flex items-start gap-3">
                  <img
                    src={getValidDoctorAvatar(selectedDoctor.id, selectedDoctor.avatar)}
                    alt={selectedDoctor.name}
                    onError={(e) => handleDoctorImageError(e, selectedDoctor.id)}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-slate-100 shrink-0"
                  />
                  <div className="min-w-0 flex-1 text-xs">
                    <h5 className="font-extrabold text-slate-900 text-sm truncate">{selectedDoctor.name}</h5>
                    <p className="text-sky-700 font-semibold">{selectedDoctor.specialty}</p>
                    <p className="text-slate-500 font-medium mt-0.5">
                      {selectedDoctor.department} • Room {selectedDoctor.roomNumber}
                    </p>
                  </div>
                </div>

                {/* Date & Time Slot Box */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="font-medium text-slate-500">Date:</span>
                    <strong className="text-slate-900">{selectedDate}</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="font-medium text-slate-500">Time Slot:</span>
                    <strong className="text-sky-700 font-mono">{selectedSlot}</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="font-medium text-slate-500">Selected Plan:</span>
                    <strong className="text-slate-900">{getPlanLabel(selectedPlan)}</strong>
                  </div>
                </div>

                {/* Pricing Breakdown */}
                <div className="space-y-2 text-xs pt-1 border-t border-slate-200">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Consultation Fee</span>
                    <span className="font-mono font-semibold">₹{currentAmount}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Digital OPD Platform & E-Rx</span>
                    <span className="font-mono text-emerald-600 font-semibold">FREE (Hospital Waived)</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>GST (18% Healthcare Exemption)</span>
                    <span className="font-mono text-slate-500">₹0</span>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 text-xs block">Total Amount:</span>
                      <span className="text-[10px] text-slate-500">Includes all hospital taxes</span>
                    </div>
                    <span className="text-xl font-black text-slate-900 font-mono">
                      ₹{currentAmount}
                    </span>
                  </div>
                </div>

                {/* Pay Button */}
                <button
                  type="button"
                  onClick={handleExecutePayment}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold transition shadow-lg hover:shadow-emerald-600/30 cursor-pointer flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-lock"></i>
                  <span>Pay ₹{currentAmount} Securely</span>
                </button>

                {/* Security Indicator */}
                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-[11px] text-emerald-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <i className="fa-solid fa-shield-check text-emerald-600 text-xs"></i>
                    <span>🔒 Secure & Encrypted Payment</span>
                  </div>
                  <p className="text-[10px] text-emerald-700 leading-relaxed">
                    100% Refundable if doctor cancels. No raw card or UPI PINs are ever stored.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : bookingStep === 'processing' ? (
        /* VIEW 4: PAYMENT PROCESSING SCREEN (Animated Loader) */
        <div className="max-w-md mx-auto my-8 bg-white rounded-3xl border border-slate-200 shadow-2xl p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-sky-200 animate-ping opacity-30"></div>
            <div className="w-20 h-20 rounded-full border-4 border-sky-500 border-t-transparent animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-sky-600 text-2xl">
              <i className="fa-solid fa-lock"></i>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg sm:text-xl font-black text-slate-900">
              Processing Payment of ₹{currentAmount}
            </h3>
            <p className="text-xs text-sky-700 font-semibold font-mono animate-pulse">
              {processingStage}
            </p>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto pt-1">
              Please do not refresh, close this window, or press the back button while we communicate with the gateway.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Doctor:</span>
              <strong>{selectedDoctor.name}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Slot:</span>
              <strong className="font-mono">{selectedSlot}</strong>
            </div>
          </div>
        </div>
      ) : bookingStep === 'failure' ? (
        /* VIEW 5: PAYMENT FAILED SCREEN (With retry & preserved context) */
        <div className="max-w-xl mx-auto space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-3xl border border-rose-200 shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-rose-600 to-rose-700 text-white p-6 text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center text-2xl mx-auto shadow-inner">
                <i className="fa-solid fa-xmark"></i>
              </div>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight">Payment Failed</h3>
              <p className="text-xs sm:text-sm text-rose-100 max-w-md mx-auto">
                {paymentErrorMessage || 'The payment was not approved by the payment gateway or bank.'}
              </p>
            </div>

            <div className="p-5 sm:p-7 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1.5">
                <span className="font-bold block">No money was deducted from your account.</span>
                <p className="text-[11px] text-rose-800">
                  Your selected doctor, slot, and plan have been kept safe so you can retry immediately.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Preserved Doctor:</span>
                  <strong>{selectedDoctor.name} ({selectedDoctor.specialty})</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Preserved Slot:</span>
                  <strong className="font-mono">{selectedDate} • {selectedSlot}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount:</span>
                  <strong className="font-mono">₹{currentAmount}</strong>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSimulateFailure(false);
                    setBookingStep('payment');
                  }}
                  className="w-full py-3.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-extrabold transition shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-rotate-right"></i>
                  <span>Try Payment Again (₹{currentAmount})</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSimulateFailure(false);
                      setPaymentMethodTab('upi');
                      setBookingStep('payment');
                    }}
                    className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer text-center"
                  >
                    Change Payment Method
                  </button>

                  <button
                    type="button"
                    onClick={() => setBookingStep('confirmation')}
                    className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer text-center"
                  >
                    Return to Appointment
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : bookingStep === 'success' && confirmedAppointment ? (
        /* VIEW 6: PAYMENT SUCCESSFUL & APPOINTMENT CONFIRMED SCREEN */
        <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-3xl border border-emerald-200 shadow-xl overflow-hidden">
            {/* Top Success Banner */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-6 text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center text-2xl mx-auto shadow-inner">
                <i className="fa-solid fa-check"></i>
              </div>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight">Payment Successful ✓</h3>
              <p className="text-xs sm:text-sm text-emerald-100 max-w-md mx-auto">
                Transaction confirmed. Your tele-consultation appointment has been officially created.
              </p>
            </div>

            {/* Appointment Details Grid */}
            <div className="p-5 sm:p-7 space-y-5">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5">
                {/* Row 1: Booking ID & Payment Transaction ID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Booking / Appointment ID
                    </span>
                    <span className="font-mono text-base font-black text-sky-600">
                      {confirmedAppointment.id}
                    </span>
                  </div>
                  <div className="sm:text-right">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Payment ID / Transaction ID
                    </span>
                    <span className="font-mono text-xs font-bold text-emerald-700 block">
                      {lastPaymentDetails?.paymentId || 'PAY-2026-MQ-9842X'}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {lastPaymentDetails?.transactionId || 'TXN-98420-MQ'}
                    </span>
                  </div>
                </div>

                {/* Hospital Facility Badge */}
                <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <i className="fa-solid fa-hospital text-sky-600 shrink-0"></i>
                    <span className="font-bold text-slate-800 truncate">
                      {confirmedAppointment.hospitalName || 'Max Super Specialty Hospital, Mohali'}
                    </span>
                  </div>
                  <span className="text-[10px] text-sky-700 font-semibold bg-white px-2 py-0.5 rounded-md border border-sky-100 shrink-0">
                    Virtual OPD
                  </span>
                </div>

                {/* Row 2: Doctor & Specialty */}
                <div className="flex items-center gap-3.5">
                  <img
                    src={getValidDoctorAvatar(confirmedAppointment.doctorId, confirmedAppointment.doctorAvatar)}
                    alt={confirmedAppointment.doctorName}
                    onError={(e) => handleDoctorImageError(e, confirmedAppointment.doctorId)}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-slate-100 shrink-0"
                  />
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Doctor Name</span>
                    <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                      {confirmedAppointment.doctorName}
                    </h4>
                    <p className="text-xs text-sky-700 font-semibold">{confirmedAppointment.doctorSpecialty}</p>
                  </div>
                </div>

                {/* Row 3: Date, Time & Meeting Room */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">
                      Consultation Date & Time
                    </span>
                    <span className="font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                      <i className="fa-regular fa-calendar-check text-emerald-600"></i>
                      <span>{confirmedAppointment.date}</span>
                    </span>
                    <span className="font-semibold text-sky-700 block mt-0.5">
                      {confirmedAppointment.slotTime} (IST)
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">
                      Encrypted Meeting Room ID
                    </span>
                    <span className="font-mono font-bold text-slate-900 mt-0.5 block">
                      {confirmedAppointment.meetingRoomId}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">
                      ✓ Instant 1-Click Launch Ready
                    </span>
                  </div>
                </div>

                {/* Row 4: Patient & Payment Summary */}
                <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2">
                  <span>Patient: <strong className="text-slate-900">{confirmedAppointment.patientName}</strong></span>
                  <span>UHID: <strong className="font-mono text-slate-900">{confirmedAppointment.patientUhid}</strong></span>
                  <span>
                    Amount Paid:{' '}
                    <strong className="text-emerald-700 font-bold font-mono">
                      ₹{confirmedAppointment.amount} (Captured)
                    </strong>
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleLaunchVideoCall}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold transition shadow-lg cursor-pointer flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-video"></i>
                  <span>Join Video Consultation Now</span>
                </button>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleExportPDF}
                    className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <i className="fa-solid fa-file-pdf text-rose-600"></i>
                    <span>Download Receipt</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onReturnToOPD) onReturnToOPD();
                    }}
                    className="py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 border border-sky-200"
                  >
                    <i className="fa-solid fa-hospital-user"></i>
                    <span>Go to Dashboard</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBookingStep('roster');
                      setConfirmedAppointment(null);
                    }}
                    className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 col-span-2 sm:col-span-1"
                  >
                    <i className="fa-solid fa-calendar-plus text-sky-600"></i>
                    <span>Book Another</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* VIEW 7: DEFAULT DOCTOR ROSTER & SLOT BROWSER */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Doctor Selection (2 cols) */}
          <div className="lg:col-span-2 space-y-3.5">
            {/* Header & Date Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <i className="fa-solid fa-user-doctor text-sky-500"></i>
                  <span>Available Tele-Consultation Specialists & Slots</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Select your preferred doctor, date, and consultation time slot below.
                </p>
              </div>

              {/* Date Pills */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs">
                {availableDates.map((d) => (
                  <button
                    key={d.isoDate}
                    type="button"
                    onClick={() => setSelectedDate(d.fullDate)}
                    className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                      selectedDate === d.fullDate
                        ? 'bg-white text-sky-600 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Doctors Grid with Interactive Slots */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {doctors.map((doc) => {
                const isSelected = selectedDoctor.id === doc.id;
                const slots = DOCTOR_TIME_SLOTS[doc.id] || DEFAULT_SLOTS;

                return (
                  <div
                    key={doc.id}
                    className={`p-4 rounded-2xl border transition-all text-left flex flex-col justify-between ${
                      isSelected
                        ? 'border-2 border-sky-500 bg-sky-50/40 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      {/* Doctor Info */}
                      <div className="flex items-start gap-3">
                        <img
                          src={getValidDoctorAvatar(doc.id, doc.avatar)}
                          alt={doc.name}
                          onError={(e) => handleDoctorImageError(e, doc.id)}
                          className="w-13 h-13 rounded-xl object-cover border border-slate-200 bg-slate-100 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-extrabold text-sm text-slate-900 truncate">
                              {doc.name}
                            </h4>
                            <span className="w-2 h-2 rounded-full bg-emerald-500" title="Online for Tele-Consult"></span>
                          </div>
                          <p className="text-xs font-semibold text-sky-700">{doc.specialty}</p>
                          <p className="text-[11px] text-slate-500">{doc.department} • Room {doc.roomNumber}</p>
                        </div>
                      </div>

                      {/* Available Slots Pills */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1.5">
                          Available Slots ({selectedDate.split(',')[0]}):
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {slots.slice(0, 4).map((s) => {
                            const isSlotActive = isSelected && selectedSlot === s;
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => {
                                  handleSelectDoctor(doc);
                                  setSelectedSlot(s);
                                }}
                                className={`px-2 py-1 rounded-lg text-[11px] font-mono font-medium transition text-center cursor-pointer ${
                                  isSlotActive
                                    ? 'bg-sky-500 text-white font-bold shadow-xs'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                              >
                                {s.split('-')[0].trim()}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Book Button */}
                    <div className="mt-3.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        From <span className="text-sky-600 font-extrabold">₹299</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleInitiateBooking(doc)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-xs'
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                      >
                        <i className="fa-solid fa-calendar-check"></i>
                        <span>Book Slot</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Side: Quick Booking Card & Security Assurance (1 col) */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-4 sm:p-5 space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <span className="badge badge-sky text-[10px] mb-1">
                  <i className="fa-solid fa-bolt mr-1"></i> Fast Digital Booking
                </span>
                <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                  Ready to Consult?
                </h4>
                <p className="text-xs text-slate-500">
                  {currentUser ? `Signed in as ${currentUser.name}` : 'Sign in/Sign up required before payment'}
                </p>
              </div>

              {/* Doctor Details */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center gap-2.5">
                  <img
                    src={getValidDoctorAvatar(selectedDoctor.id, selectedDoctor.avatar)}
                    alt={selectedDoctor.name}
                    onError={(e) => handleDoctorImageError(e, selectedDoctor.id)}
                    className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                  />
                  <div>
                    <h5 className="font-bold text-slate-900">{selectedDoctor.name}</h5>
                    <p className="text-[11px] text-sky-700">{selectedDoctor.specialty}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 space-y-1 text-slate-600">
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <strong className="text-slate-900">{selectedDate}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Slot:</span>
                    <strong className="text-sky-700 font-mono">{selectedSlot}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Fee:</span>
                    <strong className="text-slate-900 font-mono">₹{currentAmount}</strong>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleInitiateBooking(selectedDoctor)}
                className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs sm:text-sm font-bold transition shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-calendar-check"></i>
                <span>{currentUser ? 'Review & Proceed to Pay' : 'Book Slot (Sign in)'}</span>
              </button>

              <div className="space-y-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-emerald-500 text-xs"></i>
                  <span>Encrypted 1080p HD Video & Audio Room</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-emerald-500 text-xs"></i>
                  <span>Official Hospital Digital E-Prescription</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-emerald-500 text-xs"></i>
                  <span>256-bit Encrypted Secure Payment Gateway</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROFESSIONAL PATIENT AUTHENTICATION MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
            {/* Modal Top Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 relative">
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-base"></i>
              </button>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-300 text-[10px] font-bold uppercase tracking-wider mb-2">
                <i className="fa-solid fa-lock text-xs"></i> Patient Verification
              </div>
              <h3 className="text-lg sm:text-xl font-black">Sign in to continue booking</h3>
              <p className="text-xs text-sky-200 mt-1">
                Your selected doctor and slot will be saved while you sign in.
              </p>

              {/* Selected Slot Context Tag */}
              <div className="mt-3 p-2.5 rounded-xl bg-white/10 border border-white/15 backdrop-blur-md flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={getValidDoctorAvatar(selectedDoctor.id, selectedDoctor.avatar)}
                    alt={selectedDoctor.name}
                    onError={(e) => handleDoctorImageError(e, selectedDoctor.id)}
                    className="w-8 h-8 rounded-lg object-cover border border-white/20 shrink-0"
                  />
                  <div className="truncate">
                    <strong className="block text-white truncate">{selectedDoctor.name}</strong>
                    <span className="text-[11px] text-sky-300 font-mono">{selectedSlot}</span>
                  </div>
                </div>
                <span className="badge badge-green text-[10px] shrink-0">Preserved</span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
              {/* Sign In vs Sign Up Tabs */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('signin');
                    setAuthError('');
                  }}
                  className={`py-2 rounded-lg transition text-center cursor-pointer ${
                    authTab === 'signin'
                      ? 'bg-white text-sky-700 shadow-xs font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className="fa-solid fa-right-to-bracket mr-1.5"></i>
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('signup');
                    setAuthError('');
                  }}
                  className={`py-2 rounded-lg transition text-center cursor-pointer ${
                    authTab === 'signup'
                      ? 'bg-white text-sky-700 shadow-xs font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className="fa-solid fa-user-plus mr-1.5"></i>
                  <span>New Patient / Sign Up</span>
                </button>
              </div>

              {/* Error Message */}
              {authError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <i className="fa-solid fa-circle-exclamation text-rose-600 shrink-0"></i>
                  <span>{authError}</span>
                </div>
              )}

              {/* TAB 1: SIGN IN */}
              {authTab === 'signin' ? (
                <div className="space-y-4">
                  {/* Google & Demo Quick Sign In */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={isAuthLoading}
                      className="w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <i className="fa-brands fa-google text-rose-500"></i>
                      <span>Continue with Google</span>
                    </button>

                    <div className="relative text-center py-1">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200"></div>
                      </div>
                      <span className="relative px-3 bg-white text-[11px] text-slate-400 font-semibold uppercase">
                        Or with Hospital UHID / Mobile OTP
                      </span>
                    </div>
                  </div>

                  {/* Sign In Form */}
                  <form onSubmit={handleVerifySignIn} className="space-y-3.5">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Hospital UHID or Registered Mobile
                      </label>
                      <input
                        type="text"
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        placeholder="e.g. SJMC-2026-DEL-08942A or 9876543210"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium focus:border-sky-500 focus:outline-hidden"
                        required
                      />
                    </div>

                    {/* Method Selector: OTP vs PIN */}
                    <div className="flex items-center gap-3 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                        <input
                          type="radio"
                          name="authMethod"
                          checked={authMethod === 'otp'}
                          onChange={() => setAuthMethod('otp')}
                          className="text-sky-600"
                        />
                        <span>SMS OTP Verification</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                        <input
                          type="radio"
                          name="authMethod"
                          checked={authMethod === 'pin'}
                          onChange={() => setAuthMethod('pin')}
                          className="text-sky-600"
                        />
                        <span>Security PIN</span>
                      </label>
                    </div>

                    {authMethod === 'otp' ? (
                      <div className="space-y-2">
                        {!otpSent ? (
                          <button
                            type="button"
                            onClick={handleSendOtp}
                            className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer"
                          >
                            <i className="fa-solid fa-paper-plane mr-1.5 text-sky-600"></i>
                            <span>Send 4-Digit OTP Code</span>
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={enteredOtp}
                                onChange={(e) => setEnteredOtp(e.target.value)}
                                maxLength={4}
                                placeholder="Enter 4-digit OTP (e.g. 5412)"
                                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono text-center tracking-widest focus:border-sky-500 focus:outline-hidden font-bold"
                              />
                              <button
                                type="button"
                                onClick={handleSendOtp}
                                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                              >
                                Resend
                              </button>
                            </div>
                            <p className="text-[10px] text-emerald-700 font-semibold">
                              ✓ Demo OTP: <span className="font-mono font-bold">{generatedOtp}</span> dispatched
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          4-Digit Security PIN
                        </label>
                        <input
                          type="password"
                          value={loginPin}
                          onChange={(e) => setLoginPin(e.target.value)}
                          maxLength={4}
                          placeholder="••••"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono tracking-widest text-center focus:border-sky-500 focus:outline-hidden"
                          required
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isAuthLoading}
                      className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs sm:text-sm font-bold transition shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isAuthLoading ? (
                        <>
                          <i className="fa-solid fa-circle-notch animate-spin"></i>
                          <span>Verifying Patient Credentials...</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-right-to-bracket"></i>
                          <span>Sign In & Continue Booking</span>
                        </>
                      )}
                    </button>
                  </form>

                  {/* 1-Click Demo Profiles */}
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      1-Click Demo Patient Accounts:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {INITIAL_PATIENT_USERS.slice(0, 2).map((demoUser) => (
                        <button
                          key={demoUser.id}
                          type="button"
                          onClick={() => handleQuickDemoLogin(demoUser)}
                          className="p-2 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 text-left transition cursor-pointer"
                        >
                          <strong className="block text-xs text-slate-900 truncate">{demoUser.name}</strong>
                          <span className="text-[10px] text-sky-700 font-mono">{demoUser.uhid}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* TAB 2: SIGN UP / NEW PATIENT */
                <form onSubmit={handleSignUpSubmit} className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Full Legal Name *
                    </label>
                    <input
                      type="text"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      placeholder="e.g. Ramesh Chandra Verma"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium focus:border-sky-500 focus:outline-hidden"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Mobile Number *
                      </label>
                      <input
                        type="tel"
                        value={signupPhone}
                        onChange={(e) => setSignupPhone(e.target.value)}
                        placeholder="9876543210"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium focus:border-sky-500 focus:outline-hidden"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder="patient@gmail.com"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium focus:border-sky-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Age</label>
                      <input
                        type="number"
                        value={signupAge}
                        onChange={(e) => setSignupAge(Number(e.target.value))}
                        min={1}
                        max={110}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:border-sky-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Gender</label>
                      <select
                        value={signupGender}
                        onChange={(e) => setSignupGender(e.target.value as any)}
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:border-sky-500 focus:outline-hidden bg-white"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Blood Group</label>
                      <select
                        value={signupBloodGroup}
                        onChange={(e) => setSignupBloodGroup(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:border-sky-500 focus:outline-hidden bg-white"
                      >
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <label className="flex items-start gap-2 cursor-pointer pt-1 text-[11px] text-slate-600">
                    <input
                      type="checkbox"
                      checked={agreedTerms}
                      onChange={(e) => setAgreedTerms(e.target.checked)}
                      className="rounded text-sky-600 mt-0.5"
                    />
                    <span>
                      I consent to Telehealth Virtual Consultation and Hospital Electronic Health Records (EHR).
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={isAuthLoading}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold transition shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isAuthLoading ? (
                      <>
                        <i className="fa-solid fa-circle-notch animate-spin"></i>
                        <span>Registering New UHID...</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-user-check"></i>
                        <span>Register UHID & Continue Booking</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
