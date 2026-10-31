import React, { useEffect, useRef, useState } from 'react';
import { ConfirmationResult, RecaptchaVerifier, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPhoneNumber, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import {
  PatientUser,
  MedicalExtractionResult,
  ExtractedConfidence,
} from '../types';
import { generateAlphanumericUHID } from '../data/mockData';
import { playHospitalChime } from '../utils/audio';
import { auth, db, firebaseProjectId, signInWithGoogle, saveUserProfileToFirestore } from '../firebase';
import confetti from 'canvas-confetti';
import { SmartDocumentUpload } from './SmartDocumentUpload';
import { ExtractedFieldIndicator } from './ExtractedFieldIndicator';
import { validatePhoneNumber } from '../utils/phoneValidation';
import {
  ShieldCheck,
  Send,
  Lock,
  ArrowRight,
  Sparkles,
  AlertCircle,
  UserCheck,
  Mic,
  Stethoscope,
} from 'lucide-react';

interface PatientAuthProps {
  onLoginSuccess: (user: PatientUser) => void;
  onRegistrationSuccess?: (user: PatientUser) => void;
  onEmergencyBypass?: () => void;
  onShowToast?: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
  onOpenHospitalStaffLogin?: () => void;
}

interface DictatedSignupDetails {
  name?: string;
  phone?: string;
  email?: string;
  age?: number;
  gender?: 'Male' | 'Female' | 'Other';
  bloodGroup?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  allergies?: string[];
  conditions?: string[];
  symptoms?: string;
  symptomDuration?: string;
}

const phoneAuthErrorMessage = (error: any): string => {
  switch (error?.code) {
    case 'auth/operation-not-allowed':
      return `Firebase project “${firebaseProjectId}” rejected Phone Authentication. Confirm the Phone provider is enabled in this exact project.`;
    case 'auth/unauthorized-domain':
      return 'This website domain is not authorized for Firebase Authentication. Use an authorized deployed domain; localhost is not supported for real SMS phone authentication.';
    case 'auth/invalid-app-credential':
    case 'auth/captcha-check-failed':
      return 'Firebase could not verify this app. Check the authorized domain and try the reCAPTCHA again.';
    case 'auth/invalid-phone-number':
      return 'Enter a valid 10-digit Indian phone number.';
    case 'auth/too-many-requests':
      return 'Firebase temporarily limited requests from this device. Wait a while and try again.';
    case 'auth/quota-exceeded':
      return 'The Firebase SMS quota has been reached. Check the project billing and authentication usage limits.';
    case 'auth/network-request-failed':
      return 'Could not reach Firebase Authentication. Check your connection and try again.';
    case 'auth/operation-not-supported-in-this-environment':
      return 'Phone verification requires a supported browser on an HTTPS site.';
    default:
      return error?.message || 'Could not start phone verification. Please try again.';
  }
};

const parseSignupVoiceDetails = (transcript: string): DictatedSignupDetails => {
  const text = transcript
    .replace(/[०-९]/g, (digit) => String('०१२३४५६७८९'.indexOf(digit)))
    .replace(/एट(?: द रेट)?/gi, '@')
    .replace(/डॉट/gi, '.');
  const labels = 'phone|mobile|email|age|aged|gender|blood group|emergency contact|emergency phone|allerg(?:y|ies)|condition|medical history|symptoms?|duration|फोन|मोबाइल|संपर्क|ईमेल|उम्र|आयु|लिंग|ब्लड ग्रुप|रक्त समूह|आपातकालीन|एलर्जी|बीमारी|रोग|चिकित्सा इतिहास|लक्षण|तकलीफ|समस्या|अवधि|कब से|कितने दिन';
  const readField = (fieldLabels: string) => {
    const match = new RegExp(`(?:${fieldLabels})\\s*(?:number|no\\.?|is|है|हैं|का|की|के|:)?\\s*`, 'iu').exec(text);
    if (!match || match.index === undefined) return '';
    const value = text.slice(match.index + match[0].length);
    const stop = new RegExp(`(?:${labels})|[,;،।]`, 'iu').exec(value);
    return (stop ? value.slice(0, stop.index) : value).replace(/^(?:is|है|हैं|हूँ|हूं)\s*/iu, '').trim();
  };
  const details: DictatedSignupDetails = {};
  const hindiName = text.match(/(?:मेरा|मेरी) नाम\s+(.+?)(?=\s+है(?:\s|$)|\s+(?:और\s+)?(?:मेरी\s+)?(?:उम्र|आयु|फोन|मोबाइल|ईमेल|लिंग|रक्त समूह)|[,;।]|$)/u)?.[1];
  const englishName = text.match(/(?:my name is|name is)\s+(.+?)(?=\s+(?:and\s+)?(?:phone|mobile|email|age|gender|blood group)|[,;.]|$)/i)?.[1];
  const rawName = hindiName || englishName || readField('मेरा नाम(?: है)?|नाम');
  const cleanPersonName = (value: string) => value
    .replace(/\s+(?:है|हैं|हूँ|हूं)\s+(?:और|मेरी|मेरा)?\s*$/iu, '')
    .replace(/\s+(?:और|and)\s*$/iu, '')
    .replace(/[,।.\s]+$/, '')
    .replace(/\s+(?:है|हैं|हूँ|हूं)$/iu, '')
    .trim();
  if (rawName) details.name = cleanPersonName(rawName);

  const numberWords: Record<string, string> = {
    zero: '0', oh: '0', शून्य: '0', जीरो: '0', one: '1', एक: '1', two: '2', दो: '2', three: '3', तीन: '3', four: '4', चार: '4', five: '5', पांच: '5', पाँच: '5', six: '6', छह: '6', छः: '6', seven: '7', सात: '7', eight: '8', आठ: '8', nine: '9', नौ: '9',
  };
  const digitsFrom = (value: string) => (value.toLowerCase().match(/[+]?\d+|[\p{L}]+/gu) || [])
    .map((part) => numberWords[part] ?? part).join('').replace(/\D/g, '');
  const phone = digitsFrom(readField('phone(?: number)?|mobile(?: number)?|मेरा फोन|फोन नंबर|फोन|मोबाइल नंबर|मोबाइल'));
  if (phone.length >= 10) details.phone = phone;
  const emergencyPhone = digitsFrom(readField('emergency contact phone|emergency phone|आपातकालीन संपर्क फोन|आपातकालीन फोन|संपर्क नंबर'));
  if (emergencyPhone.length >= 10) details.emergencyPhone = emergencyPhone;

  const emailText = text.replace(/\b(?:at the rate|at rate|at)\b/gi, '@').replace(/\b(?:dot)\b/gi, '.');
  const email = emailText.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0];
  if (email) details.email = email;
  const age = readField('age|aged|उम्र|आयु').match(/\d{1,3}/)?.[0];
  if (age && Number(age) > 0 && Number(age) <= 120) details.age = Number(age);

  const gender = text.match(/\b(male|female|other)\b|पुरुष|आदमी|महिला|स्त्री|अन्य/iu)?.[0]?.toLowerCase();
  if (gender) details.gender = /female|महिला|स्त्री/.test(gender) ? 'Female' : /other|अन्य/.test(gender) ? 'Other' : 'Male';

  const groupMatch = text.match(/\b(ab|a|b|o)\s*(positive|negative|pos|neg|[+-])?/iu);
  const hindiGroupMatch = text.match(/(एबी|ए|बी|ओ)\s*(पॉजिटिव|नेगेटिव|निगेटिव|प्लस|माइनस)/iu);
  if (groupMatch || hindiGroupMatch) {
    const group = (groupMatch?.[1] || ({ एबी: 'AB', ए: 'A', बी: 'B', ओ: 'O' } as Record<string, string>)[hindiGroupMatch?.[1] || ''] || '').toUpperCase();
    const sign = `${groupMatch?.[2] || ''} ${hindiGroupMatch?.[2] || ''}`;
    if (group) details.bloodGroup = `${group}${/negative|neg|नेगेटिव|निगेटिव|माइनस|-/.test(sign) ? '-' : '+'}`;
  }

  const emergencyName = readField('emergency contact name|आपातकालीन संपर्क का नाम|आपातकालीन संपर्क नाम');
  if (emergencyName) details.emergencyName = cleanPersonName(emergencyName);
  const allergyOptions = [
    { value: 'Penicillin', match: /penicillin|पेनिसिलिन/iu }, { value: 'Sulfa Drugs', match: /sulfa|सल्फा/iu },
    { value: 'Aspirin/NSAIDs', match: /aspirin|nsaid|एस्पिरिन/iu }, { value: 'Latex', match: /latex|लेटेक्स/iu },
    { value: 'Dust / Pollen', match: /dust|pollen|धूल|पराग/iu }, { value: 'Contrast Dye', match: /contrast dye|कॉन्ट्रास्ट डाई/iu },
  ];
  const allergies = allergyOptions.filter((item) => item.match.test(text)).map((item) => item.value);
  if (/no allergies|no known allergies|कोई एलर्जी नहीं|एलर्जी नहीं/iu.test(text)) allergies.push('None');
  const allergyDescription = readField('allerg(?:y|ies)|एलर्जी');
  if (!allergies.length && allergyDescription && !/none|कोई नहीं|नहीं/iu.test(allergyDescription)) allergies.push(allergyDescription);
  if (allergies.length) details.allergies = allergies.includes('None') ? ['None'] : allergies;

  const conditionOptions = [
    { value: 'Hypertension (High BP)', match: /hypertension|high blood pressure|उच्च रक्तचाप|बीपी/iu },
    { value: 'Type 2 Diabetes', match: /diabetes|diabetic|मधुमेह|शुगर/iu },
    { value: 'Asthma / COPD', match: /asthma|copd|अस्थमा|दमा/iu },
    { value: 'Thyroid Disorder', match: /thyroid|थायराइड/iu },
    { value: 'Heart Disease', match: /heart disease|हृदय रोग|दिल की बीमारी/iu },
    { value: 'Arthritis', match: /arthritis|गठिया|आर्थराइटिस/iu },
  ];
  const conditions = conditionOptions.filter((item) => item.match.test(text)).map((item) => item.value);
  if (/no conditions|no medical history|कोई बीमारी नहीं|कोई रोग नहीं/iu.test(text)) conditions.push('None');
  const conditionDescription = readField('pre-existing condition|condition|medical history|बीमारी|रोग|चिकित्सा इतिहास');
  if (!conditions.length && conditionDescription && !/none|कोई नहीं|नहीं/iu.test(conditionDescription)) conditions.push(conditionDescription);
  if (conditions.length) details.conditions = conditions.includes('None') ? ['None'] : conditions;

  const spokenSymptoms = readField('symptoms?|लक्षण|तकलीफ|समस्या') ||
    text.match(/(?:मुझे|मुझको|मेरी समस्या|मेरे लक्षण)\s+(.+?)(?=\s+(?:है|हैं|से|पिछले|पिछली|since|for)|[,;।]|$)/iu)?.[1] ||
    text.match(/(?:i have|symptoms are)\s+(.+?)(?=\s+(?:for|since)|[,;.]|$)/i)?.[1] || '';
  const durationUnit = '(?:days?|weeks?|months?|years?|hours?|दिन|दिवस|हफ्ते|सप्ताह|महीने|महीना|साल|वर्ष|घंटे|घंटा)';
  const durationNumber = '(\\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|एक|दो|तीन|चार|पाँच|पांच|छह|सात|आठ|नौ|दस)';
  const durationMatch = text.match(new RegExp(`(?:for|since|पिछले|पिछली|से)\\s*${durationNumber}\\s*(${durationUnit})|${durationNumber}\\s*(${durationUnit})\\s*(?:से|ago)`, 'iu'));
  const durationDescription = readField('duration|symptom duration|अवधि|कब से|कितने दिन');
  const spokenDuration = durationMatch ? durationMatch[0].trim() : durationDescription;
  if (spokenSymptoms) {
    const cleanSymptoms = spokenSymptoms
      .replace(new RegExp(`\\s+(?:(?:for|since|पिछले|पिछली)\\s+)?${durationNumber}\\s*${durationUnit}.*$`, 'iu'), '')
      .replace(/\s+(?:है|हैं)$/iu, '')
      .trim();
    if (cleanSymptoms) details.symptoms = cleanSymptoms;
  }
  if (spokenDuration) details.symptomDuration = spokenDuration.replace(/^(?:for|since|पिछले|पिछली|से)\s*/iu, '').trim();
  return details;
};

export const PatientAuth: React.FC<PatientAuthProps> = ({
  onLoginSuccess,
  onRegistrationSuccess,
  onEmergencyBypass,
  onShowToast,
  onOpenHospitalStaffLogin,
}) => {
  const [authMode, setAuthMode] = useState<'choice' | 'signin' | 'signup_options' | 'signup' | 'voice_signup' | 'otp_verify'>('choice');
  const [entryAnimationReady, setEntryAnimationReady] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginPhone, setLoginPhone] = useState<string>('');
  const [phoneConfirmation, setPhoneConfirmation] = useState<ConfirmationResult | null>(null);
  const [enteredOtp, setEnteredOtp] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDictatingSignup, setIsDictatingSignup] = useState(false);
  const [signupVoiceQuestionIndex, setSignupVoiceQuestionIndex] = useState(0);
  const [signupVoiceAwaitingNext, setSignupVoiceAwaitingNext] = useState(false);
  const [signupVoiceComplete, setSignupVoiceComplete] = useState(false);
  const signupRecognitionRef = useRef<any>(null);
  const [signupVoiceError, setSignupVoiceError] = useState('');
  const [signupVoiceTranscript, setSignupVoiceTranscript] = useState('');
  const [signupVoiceLanguage, setSignupVoiceLanguage] = useState<'en-IN' | 'hi-IN'>('en-IN');

  // Sign Up Form State
  const [signupName, setSignupName] = useState<string>('');
  const [signupPhone, setSignupPhone] = useState<string>('');
  const [signupSymptoms, setSignupSymptoms] = useState<string>('');
  const [signupSymptomDuration, setSignupSymptomDuration] = useState<string>('');
  const [signupEmail, setSignupEmail] = useState<string>('');
  const [signupPassword, setSignupPassword] = useState<string>('');
  const signupPasswordInputRef = useRef<HTMLInputElement>(null);
  const signupStepperRef = useRef<HTMLDivElement>(null);
  const [signupStep, setSignupStep] = useState<1 | 2 | 3>(1);
  const [signupAge, setSignupAge] = useState<number>(35);
  const [signupGender, setSignupGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [signupBloodGroup, setSignupBloodGroup] = useState<string>('O+');
  const [signupEmergencyName, setSignupEmergencyName] = useState<string>('');
  const [signupEmergencyPhone, setSignupEmergencyPhone] = useState<string>('');
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [customAllergy, setCustomAllergy] = useState<string>('');
  const [customAllergyInput, setCustomAllergyInput] = useState<string>('');
  const [showCustomAllergyInput, setShowCustomAllergyInput] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [phoneProviderUnavailable, setPhoneProviderUnavailable] = useState(false);
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [customCondition, setCustomCondition] = useState<string>('');
  const [showCustomConditionInput, setShowCustomConditionInput] = useState<boolean>(false);
  const [agreedTerms, setAgreedTerms] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    const handleSplashExit = () => setEntryAnimationReady(true);
    window.addEventListener('mediqueue:splash-exit', handleSplashExit);
    return () => window.removeEventListener('mediqueue:splash-exit', handleSplashExit);
  }, []);

  useEffect(() => () => {
    recaptchaRef.current?.clear();
    recaptchaRef.current = null;
    signupRecognitionRef.current?.stop?.();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  const createPhoneVerifier = (buttonId: string) => {
    recaptchaRef.current?.clear();
    const verifier = new RecaptchaVerifier(auth, buttonId, { size: 'invisible' });
    recaptchaRef.current = verifier;
    return verifier;
  };

  // Smart Registration Extraction State
  const [fieldConfidence, setFieldConfidence] = useState<ExtractedConfidence>({});
  const [extractedFields, setExtractedFields] = useState<Record<string, boolean>>({});
  const [extractedMedications, setExtractedMedications] = useState<string[]>([]);
  const [extractedDiagnoses, setExtractedDiagnoses] = useState<string[]>([]);
  const [extractedDocType, setExtractedDocType] = useState<string>('');

  const validateName = (v: string): string => {
    if (!v.trim()) return 'Name is required.';
    if (v.trim().length < 2) return 'Name must be at least 2 characters.';
    if (v.trim().length > 80) return 'Name must be 80 characters or fewer.';
    if (!/^[\p{L}\p{M}\s'-]+$/u.test(v.trim())) return 'Name may only contain letters, spaces, hyphens, and apostrophes.';
    return '';
  };

  const validatePhone = (v: string, isRequired: boolean = true): string => {
    const res = validatePhoneNumber(v, isRequired);
    return res.error;
  };

  const validateEmail = (v: string): string => {
    if (!v.trim()) return ''; // optional
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return 'Enter a valid email address.';
    return '';
  };

  const notify = (title: string, desc: string, type: 'info' | 'success' | 'urgent' = 'info') => {
    if (onShowToast) {
      onShowToast(title, desc, type);
    }
  };

  const signupVoiceQuestions = [
    { key: 'name', en: 'What is your full name?', hi: 'आपका पूरा नाम क्या है?' },
    { key: 'age', en: 'How old are you?', hi: 'आपकी उम्र कितनी है?' },
    { key: 'phone', en: 'What is your 10 digit mobile number?', hi: 'आपका दस अंकों का मोबाइल नंबर क्या है?' },
    { key: 'email', en: 'Please say or spell your email address using English letters. Say at and dot clearly.', hi: 'Please say or spell your email address using English letters. Say at and dot clearly.' },
    { key: 'gender', en: 'What is your gender: male, female, or other?', hi: 'आपका लिंग क्या है: पुरुष, महिला या अन्य?' },
    { key: 'bloodGroup', en: 'What is your blood group? You can say unknown.', hi: 'आपका ब्लड ग्रुप क्या है? पता न हो तो अज्ञात कहें।' },
    { key: 'symptoms', en: 'What symptoms are you experiencing? You can say none to skip.', hi: 'आपको क्या लक्षण हैं? छोड़ने के लिए कोई समस्या नहीं कहें।' },
    { key: 'duration', en: 'How long have you had these symptoms?', hi: 'आपको ये लक्षण कितने समय से हैं?' },
    { key: 'allergies', en: 'Do you have any medicine or food allergies? Say none if you do not.', hi: 'क्या आपको किसी दवा या भोजन से एलर्जी है? नहीं हो तो कोई नहीं कहें।' },
    { key: 'conditions', en: 'Do you have any ongoing medical conditions?', hi: 'क्या आपको कोई पुरानी बीमारी या स्वास्थ्य समस्या है?' },
    { key: 'emergencyName', en: 'What is your emergency contact name? Say skip if you do not want to add one.', hi: 'आपके आपातकालीन संपर्क का नाम क्या है? नहीं जोड़ना हो तो छोड़ें कहें।' },
    { key: 'emergencyPhone', en: 'What is your emergency contact phone number? Say skip if you do not want to add one.', hi: 'आपके आपातकालीन संपर्क का फोन नंबर क्या है? नहीं जोड़ना हो तो छोड़ें कहें।' },
  ] as const;

  const startSignupDictation = () => {
    let activeQuestionIndex = signupVoiceQuestionIndex;
    if (signupVoiceAwaitingNext) {
      if (activeQuestionIndex >= signupVoiceQuestions.length - 1) {
        setSignupVoiceComplete(true);
        setSignupVoiceAwaitingNext(false);
        return;
      }
      activeQuestionIndex += 1;
      setSignupVoiceQuestionIndex(activeQuestionIndex);
      setSignupVoiceAwaitingNext(false);
    }

    if (signupVoiceComplete) return;
    const question = signupVoiceQuestions[activeQuestionIndex];
    const questionLanguage = question.key === 'email' ? 'en-IN' : signupVoiceLanguage;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSignupVoiceError('Voice input is unavailable in this browser. You can enter the same details in the form.');
      return;
    }

    setSignupVoiceError('');
    try {
      const recognition = new SpeechRecognition();
      // Email addresses are Latin-script values, so always recognize this answer in English.
      recognition.lang = questionLanguage;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event: any) => {
        const transcript = String(event.results?.[0]?.[0]?.transcript || '').trim();
        if (!transcript) return;
        setSignupVoiceTranscript(transcript);
        const question = signupVoiceQuestions[activeQuestionIndex];
        const normalized = transcript
          .replace(/[०-९]/g, (digit) => String('०१२३४५६७८९'.indexOf(digit)))
          .trim();
        const skipAnswer = /^(skip|none|no|छोड़ें|छोड़ना|नहीं|कोई नहीं)$/i.test(normalized);
        if (question.key === 'name' && !skipAnswer) setSignupName(transcript.trim());
        if (question.key === 'age' && !skipAnswer) {
          const age = Number(normalized.match(/\d{1,3}/)?.[0]);
          if (Number.isFinite(age) && age > 0 && age <= 120) setSignupAge(age);
          else setSignupVoiceError('I could not understand the age. Please try again or type it in the form.');
        }
        if (question.key === 'phone' && !skipAnswer) {
          const phone = normalized.replace(/[^\d+]/g, '');
          setSignupPhone(phone);
          const validation = validatePhoneNumber(phone, true);
          setFieldErrors((prev) => ({ ...prev, phone: validation.error }));
        }
        if (question.key === 'email' && !skipAnswer) {
          const email = normalized.toLowerCase()
            .replace(/\b(?:at the rate|at rate|at)\b/gi, '@')
            .replace(/\b(?:dot)\b/gi, '.')
            .replace(/\s+/g, '');
          setSignupEmail(email);
          const emailError = validateEmail(email);
          setFieldErrors((prev) => ({ ...prev, email: emailError }));
        }
        if (question.key === 'gender' && !skipAnswer) {
          const genderText = normalized.toLowerCase();
          if (/female|woman|महिला|स्त्री/.test(genderText)) setSignupGender('Female');
          else if (/male|man|पुरुष/.test(genderText)) setSignupGender('Male');
          else if (/other|अन्य/.test(genderText)) setSignupGender('Other');
          else setSignupVoiceError('I could not identify the gender. Please try again or choose it in the form.');
        }
        if (question.key === 'bloodGroup' && !skipAnswer) {
          const bloodText = normalized.toUpperCase().replace(/ओ/g, 'O').replace(/ए/g, 'A').replace(/बी/g, 'B').replace(/पॉजिटिव|POSITIVE/g, '+').replace(/नेगेटिव|NEGATIVE/g, '-').replace(/\s/g, '');
          const bloodGroup = bloodText.match(/AB[+-]?|[ABO][+-]?/)?.[0];
          if (bloodGroup && ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].includes(bloodGroup)) setSignupBloodGroup(bloodGroup);
          else setSignupVoiceError('I could not identify the blood group. Please choose it in the form.');
        }
        if (question.key === 'symptoms' && !skipAnswer) setSignupSymptoms(transcript.trim());
        if (question.key === 'duration' && !skipAnswer) setSignupSymptomDuration(transcript.trim());
        if (question.key === 'allergies') setSelectedAllergies(skipAnswer ? ['None'] : [transcript.trim()]);
        if (question.key === 'conditions') setSelectedConditions(skipAnswer ? ['None'] : [transcript.trim()]);
        if (question.key === 'emergencyName' && !skipAnswer) setSignupEmergencyName(transcript.trim());
        if (question.key === 'emergencyPhone' && !skipAnswer) {
          const phone = normalized.replace(/[^\d+]/g, '');
          setSignupEmergencyPhone(phone);
          const validation = validatePhoneNumber(phone, false);
          setFieldErrors((prev) => ({ ...prev, emergencyPhone: validation.error }));
        }
        setSignupVoiceAwaitingNext(true);
      };
      recognition.onerror = (event: any) => {
        setSignupVoiceError(event.error === 'not-allowed'
          ? 'Microphone permission was denied. Allow access or type your details below.'
          : `Voice input failed${event.error ? ` (${event.error})` : ''}. You can type your details below.`);
      };
      recognition.onend = () => setIsDictatingSignup(false);
      setIsDictatingSignup(true);
      const prompt = questionLanguage === 'hi-IN' ? question.hi : question.en;
      if ('speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined') {
        window.speechSynthesis.cancel();
        const spokenQuestion = new SpeechSynthesisUtterance(prompt);
        spokenQuestion.lang = questionLanguage;
        spokenQuestion.onend = () => recognition.start();
        spokenQuestion.onerror = () => recognition.start();
        window.speechSynthesis.speak(spokenQuestion);
      } else {
        recognition.start();
      }
      signupRecognitionRef.current = recognition;
    } catch {
      setIsDictatingSignup(false);
      setSignupVoiceError('Could not start microphone access. You can type your details below.');
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
  };

  const handleClearExtractedData = () => {
    setFieldConfidence({});
    setExtractedFields({});
    setExtractedMedications([]);
    setExtractedDiagnoses([]);
    setExtractedDocType('');
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
      notify('Sign-In Notice', 'Unable to complete Google sign-in. Please try again.', 'info');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    const identifier = loginUsername.trim();
    if (!identifier || !loginPassword) {
      setErrorMessage('Enter your username/email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      let email = identifier.toLowerCase();
      if (!email.includes('@')) {
        const matchingUsers = await getDocs(query(collection(db, 'users'), where('name', '==', identifier)));
        const matchingProfiles = matchingUsers.docs
          .map((userDoc) => userDoc.data() as PatientUser)
          .filter((profile) => Boolean(profile.email));
        if (matchingProfiles.length !== 1) {
          throw new Error(matchingProfiles.length > 1
            ? 'More than one account uses that name. Sign in with your email address instead.'
            : 'No account was found for that username. Try your registered email address.');
        }
        email = matchingProfiles[0].email.toLowerCase();
      }

      const credential = await signInWithEmailAndPassword(auth, email, loginPassword);
      const profileSnapshot = await getDoc(doc(db, 'users', credential.user.uid));
      if (!profileSnapshot.exists()) {
        await signOut(auth);
        throw new Error('This login does not have a patient profile. Use Google sign-in or contact support.');
      }
      const profile = { ...profileSnapshot.data(), id: credential.user.uid } as PatientUser;
      playHospitalChime();
      notify('Sign-In Successful', `Welcome back, ${profile.name}!`, 'success');
      onLoginSuccess(profile);
    } catch (error: any) {
      const message = error?.code === 'auth/invalid-credential' || error?.code === 'auth/wrong-password' || error?.code === 'auth/user-not-found'
        ? 'The username/email or password is incorrect.'
        : error?.code === 'auth/too-many-requests'
        ? 'Too many sign-in attempts. Please wait a moment and try again.'
        : error?.message || 'Unable to sign in. Please try again.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    const phone = validatePhoneNumber(loginPhone, true);
    if (!phone.isValid) {
      setErrorMessage(phone.error);
      return;
    }

    setErrorMessage('');
    setPhoneProviderUnavailable(false);
    setIsSubmitting(true);
    try {
      const verifier = createPhoneVerifier('patient-phone-otp-button');
      const confirmation = await signInWithPhoneNumber(auth, `+91${phone.digits}`, verifier);
      verifier.clear();
      recaptchaRef.current = null;
      setPhoneConfirmation(confirmation);
      setAuthMode('otp_verify');
      notify('Verification code sent', `Enter the SMS code sent to +91 ${phone.digits}.`, 'success');
    } catch (error: any) {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      console.error('Phone OTP request failed', { code: error?.code, projectId: firebaseProjectId, message: error?.message });
      setPhoneProviderUnavailable(error?.code === 'auth/operation-not-allowed');
      setErrorMessage(phoneAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifySignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!phoneConfirmation || !/^\d{6}$/.test(enteredOtp.trim())) {
      setErrorMessage('Enter the 6-digit code from the SMS.');
      return;
    }

    setErrorMessage('');
    setPhoneProviderUnavailable(false);
    setIsSubmitting(true);
    try {
      const credential = await phoneConfirmation.confirm(enteredOtp.trim());
      const phone = validatePhoneNumber(loginPhone, true);
      const e164 = `+91${phone.digits}`;
      const phoneVariants = [...new Set([e164, `+91 ${phone.digits}`, phone.digits, `91${phone.digits}`])];
      const profiles = await getDocs(query(collection(db, 'users'), where('phone', 'in', phoneVariants)));
      const matchedDocs = profiles.docs.filter((profileDoc) =>
        String(profileDoc.data().phone || '').replace(/\D/g, '').slice(-10) === phone.digits
      );

      if (matchedDocs.length !== 1) {
        await signOut(auth);
        setPhoneConfirmation(null);
        setAuthMode('signin');
        setErrorMessage(matchedDocs.length > 1
          ? 'This phone number is linked to more than one profile. Please sign in with Google or contact support.'
          : 'No patient account is registered with this phone number. Create an account or try another number.');
        return;
      }

      const matchedDoc = matchedDocs[0];
      const profile = matchedDoc.data() as PatientUser;
      const patientUser: PatientUser = { ...profile, id: credential.user.uid, phone: e164 };
      const ownProfile = await getDoc(doc(db, 'users', credential.user.uid));
      if (!ownProfile.exists()) {
        await setDoc(doc(db, 'users', credential.user.uid), JSON.parse(JSON.stringify(patientUser)));
      }
      playHospitalChime();
      try { confetti({ particleCount: 45, spread: 75, origin: { y: 0.6 } }); } catch {}
      notify('Sign In Successful', `Welcome back, ${patientUser.name}!`, 'success');
      onLoginSuccess(patientUser);
    } catch (error: any) {
      setErrorMessage(error?.code === 'auth/invalid-verification-code'
        ? 'That code is not correct. Check the SMS and try again.'
        : error?.code === 'auth/code-expired'
        ? 'That code has expired. Return and request a new one.'
        : error?.message || 'Code verification failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sign Up Submission
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (signupPassword.length < 6) {
      const message = 'Password must be at least 6 characters before you can continue.';
      setFieldErrors((current) => ({ ...current, password: message }));
      setErrorMessage(message);
      notify('Password Too Short', message, 'urgent');
      signupPasswordInputRef.current?.focus();
      return;
    }

    const nameErr = validateName(signupName);
    const phoneRes = validatePhoneNumber(signupPhone, true);
    const emailErr = signupEmail.trim() ? validateEmail(signupEmail) : 'Email address is required for username and password sign-in.';
    const emergPhoneRes = signupEmergencyPhone.trim() ? validatePhoneNumber(signupEmergencyPhone, false) : { isValid: true, error: '' };

    const errors: Record<string, string> = {};
    if (nameErr) errors.name = nameErr;
    if (!phoneRes.isValid) errors.phone = phoneRes.error;
    if (emailErr) errors.email = emailErr;
    if (signupPassword.length < 6) errors.password = 'Password must be at least 6 characters.';
    if (!emergPhoneRes.isValid) errors.emergencyPhone = emergPhoneRes.error;

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstError = Object.values(errors)[0];
      setErrorMessage(firstError);
      notify('Validation Error', firstError, 'urgent');
      return;
    }

    if (!agreedTerms) {
      setErrorMessage('Please accept the OPD digital triage & EHR consent to proceed.');
      notify('Consent Required', 'Please accept the OPD digital triage & EHR consent to proceed.', 'urgent');
      return;
    }

    setIsSubmitting(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, signupEmail.trim().toLowerCase(), signupPassword);
      const generatedUhid = generateAlphanumericUHID('DEL');
      const newPatientUser: PatientUser = {
        id: credential.user.uid,
        uhid: generatedUhid,
        name: signupName.trim(),
        phone: signupPhone.trim().startsWith('+') ? signupPhone.trim() : `+91 ${signupPhone.trim()}`,
        email: signupEmail.trim().toLowerCase(),
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
        initialSymptoms: signupSymptoms.trim() || undefined,
        symptomDuration: signupSymptomDuration.trim() || undefined,
      };

      await saveUserProfileToFirestore(newPatientUser);
      playHospitalChime();
      try { confetti({ particleCount: 65, spread: 85, origin: { y: 0.5 } }); } catch {}
      notify('Account Created & UHID Assigned', `UHID ${generatedUhid} generated for ${newPatientUser.name}.`, 'success');
      (onRegistrationSuccess || onLoginSuccess)(newPatientUser);
    } catch (error: any) {
      const message = error?.code === 'auth/email-already-in-use'
        ? 'An account already exists with this email. Sign in instead.'
        : error?.code === 'auth/weak-password'
        ? 'Choose a password with at least 6 characters.'
        : error?.code === 'auth/operation-not-allowed'
        ? 'Email and password accounts are not enabled in Firebase Authentication.'
        : error?.message || 'Could not create your account. Please try again.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCustomAllergy = () => {
    const val = customAllergyInput.trim();
    if (!val) return;
    if (val.length > 60) {
      setFieldErrors(prev => ({ ...prev, customAllergy: 'Custom allergy name is too long (max 60 chars).' }));
      return;
    }
    if (!selectedAllergies.includes(val)) {
      setSelectedAllergies(prev => [...prev.filter(a => a !== 'None'), val]);
    }
    setCustomAllergyInput('');
    setShowCustomAllergyInput(false);
    setFieldErrors(prev => { const n = { ...prev }; delete n.customAllergy; return n; });
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
      className="min-h-screen text-[#173B40] dark:text-[#F1F5F9] flex flex-col font-sans transition-colors duration-200 relative overflow-x-hidden selection:bg-[#2EBB86]/20 selection:text-[#006B67] bg-[#F5FAF7] bg-no-repeat"
    >
      <img
        src="/mediqueue-logo.png"
        alt="Medi Queue"
        className="pointer-events-none absolute left-3 top-3 z-20 h-[23.78vw] w-[23.78vw] select-none object-contain sm:left-4 sm:top-4 sm:h-[min(160px,20vw)] sm:w-[min(160px,20vw)]"
      />
      {/* MAIN PAGE: FULL-SCREEN BACKGROUND WITH FLOATING AUTHENTICATION CARD */}
      <main className="relative z-10 flex-1 w-full max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-10 py-5 sm:py-7 lg:py-9 flex items-center justify-center">

        {/* ============================================================
            RIGHT COLUMN (~48%) - WHITE AUTHENTICATION CARD (Sections 11-26)
           ============================================================ */}
        <div className="w-full flex justify-center">
          <div className="patient-auth-card w-full sm:w-[min(92vw,700px)] max-w-[700px] max-h-[calc(100vh-2rem)] bg-[#EFF7FA]/95 backdrop-blur-xl rounded-[24px] border border-white/80 shadow-[0_28px_80px_rgba(20,75,88,0.24)] overflow-y-auto transition-all duration-300">
            
            {/* CARD BODY CONTENT */}
            <div className="p-6 sm:p-8 lg:p-9 space-y-6">
              {authMode !== 'choice' && (
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage('');
                    setPhoneConfirmation(null);
                    setAuthMode(authMode === 'signup' || authMode === 'voice_signup' ? 'signup_options' : 'choice');
                  }}
                  className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  <ArrowRight className="h-4 w-4 rotate-180" />
                  {authMode === 'signup' || authMode === 'voice_signup' ? 'Back to sign-up options' : 'Back'}
                </button>
              )}

              {/* Heading Section (Section 12 & Section 22) */}
              <div className="space-y-1.5">
                <h2 className="text-2xl sm:text-[28px] font-extrabold text-[#10244A] dark:text-white tracking-tight">
                  {authMode === 'choice' ? 'Welcome to Medi Queue' : authMode === 'signin' || authMode === 'otp_verify' ? 'Sign in to your account' : authMode === 'signup_options' ? 'Create your account' : authMode === 'voice_signup' ? 'Register by voice' : 'Create your Medi Queue account'}
                </h2>
                <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                  {authMode === 'choice' ? 'Choose how you want to continue.' : authMode === 'signin' || authMode === 'otp_verify' ? 'Use your username or email and password.' : authMode === 'signup_options' ? 'Choose voice registration or document scanning.' : authMode === 'voice_signup' ? 'Speak your registration details in English or Hindi, then review them before submitting.' : 'Register once and manage your complete hospital journey.'}
                </p>
              </div>

              {/* Error Message Display */}
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs animate-in fade-in duration-200">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{errorMessage}</span>
                  </div>
                  {phoneProviderUnavailable && (
                    <p className="mt-2 pl-6 leading-relaxed">
                      The app is sending requests to project <strong>{firebaseProjectId}</strong>. Check that <strong>Phone</strong> is enabled in this exact project. For local testing, configure a Firebase test phone number; real SMS requires an authorized deployed domain.{' '}
                      <a href={`https://console.firebase.google.com/project/${firebaseProjectId}/authentication/providers`} target="_blank" rel="noreferrer" className="font-bold underline">Open this project’s settings</a>.
                    </p>
                  )}
                </div>
              )}

              {authMode === 'choice' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <button type="button" onClick={() => { setAuthMode('signin'); setErrorMessage(''); }} className={`auth-choice-option auth-choice-option--signin rounded-2xl border border-sky-200 bg-sky-50/70 p-5 text-left transition hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-md ${entryAnimationReady ? 'is-settled' : ''}`}>
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-600 text-white"><ArrowRight className="h-5 w-5" /></span>
                    <span className="mt-4 block text-lg font-extrabold text-slate-900">Sign In</span>
                    <span className="mt-1 block text-sm text-slate-600">Access your patient account.</span>
                  </button>
                  <button type="button" onClick={() => { setAuthMode('signup_options'); setErrorMessage(''); }} className={`auth-choice-option auth-choice-option--signup rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-left transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md ${entryAnimationReady ? 'is-settled' : ''}`}>
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white"><UserCheck className="h-5 w-5" /></span>
                    <span className="mt-4 block text-lg font-extrabold text-slate-900">Sign Up</span>
                    <span className="mt-1 block text-sm text-slate-600">Create an account by voice or document.</span>
                  </button>
                </div>
              )}

              {authMode === 'signup_options' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <button type="button" onClick={() => { setSignupStep(1); setSignupVoiceQuestionIndex(0); setSignupVoiceAwaitingNext(false); setSignupVoiceComplete(false); setSignupVoiceTranscript(''); setSignupVoiceError(''); setAuthMode('voice_signup'); setErrorMessage(''); }} className="rounded-2xl border border-sky-200 bg-white p-5 text-left transition hover:border-sky-400 hover:bg-sky-50 hover:shadow-md">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-600 text-white"><Mic className="h-5 w-5" /></span>
                    <span className="mt-4 block text-base font-extrabold text-slate-900">Register by Voice</span>
                    <span className="mt-1 block text-sm text-slate-600">Speak your details in English or Hindi.</span>
                  </button>
                  <button type="button" onClick={() => { setSignupStep(1); setAuthMode('signup'); setErrorMessage(''); }} className="rounded-2xl border border-violet-200 bg-white p-5 text-left transition hover:border-violet-400 hover:bg-violet-50 hover:shadow-md">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600 text-white"><Sparkles className="h-5 w-5" /></span>
                    <span className="mt-4 block text-base font-extrabold text-slate-900">Register with Document OCR</span>
                    <span className="mt-1 block text-sm text-slate-600">Upload a prescription or health report to fill details.</span>
                  </button>
                </div>
              )}

              {authMode === 'signin' && (
                <div className="space-y-5">
                  <button type="button" disabled={isSubmitting} onClick={handleGoogleSignIn} className="auth-google-button w-full h-12 px-4 rounded-xl border border-[#DCE7F0] dark:border-[#334155] bg-white dark:bg-[#1A263C] hover:bg-[#F8FAFC] dark:hover:bg-[#20304C] text-[#14213D] dark:text-white font-bold text-sm flex items-center justify-center gap-3 transition shadow-xs disabled:opacity-50">
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
                      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                  <div className="flex items-center gap-3"><span className="h-px flex-1 bg-slate-200" /><span className="text-xs font-bold uppercase text-slate-500">or use password</span><span className="h-px flex-1 bg-slate-200" /></div>
                  <form onSubmit={handlePasswordSignIn} className="space-y-4">
                    <label className="block space-y-1.5 text-xs font-bold text-[#10244A] dark:text-white">Username or Email
                      <input value={loginUsername} onChange={(event) => setLoginUsername(event.target.value)} autoComplete="username" className="mt-1.5 h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" placeholder="Email address or registered name" required />
                    </label>
                    <label className="block space-y-1.5 text-xs font-bold text-[#10244A] dark:text-white">Password
                      <input type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} autoComplete="current-password" className="mt-1.5 h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" placeholder="Enter your password" required />
                    </label>
                    <button type="submit" disabled={isSubmitting} className="w-full h-12 rounded-xl bg-[#0B9FE3] text-white font-extrabold text-sm shadow-md transition hover:bg-[#087FC9] disabled:opacity-60">{isSubmitting ? 'Signing in…' : 'Sign In'}</button>
                    {onOpenHospitalStaffLogin && <button type="button" onClick={onOpenHospitalStaffLogin} className="w-full min-h-11 rounded-xl border border-[#BAE6FD] bg-[#F0F9FF] text-[#087FC9] font-bold text-xs">Staff Portal Login</button>}
                  </form>
                </div>
              )}
              {authMode === 'otp_verify' && (
                <form onSubmit={handleVerifySignIn} className="space-y-5 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mx-auto shadow-sm"><ShieldCheck className="w-7 h-7" /></div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-extrabold text-[#10244A] dark:text-white">Verify your phone</h3>
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">Enter the 6-digit code sent by SMS to <strong className="text-[#10244A] dark:text-white font-mono">+91 {loginPhone}</strong>.</p>
                  </div>
                  <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={enteredOtp} onChange={(event) => setEnteredOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="• • • • • •" className="w-56 mx-auto text-center py-3 text-2xl font-mono tracking-[0.4em] rounded-2xl border-2 border-[#0B9FE3] bg-white dark:bg-[#1A263C] text-[#10244A] dark:text-white focus:outline-hidden shadow-inner" autoFocus />
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button type="button" onClick={() => { setAuthMode('signin'); setPhoneConfirmation(null); setEnteredOtp(''); }} className="px-4 py-2.5 rounded-xl bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] text-xs font-bold hover:bg-[#E2E8F0]">Back</button>
                    <button type="submit" disabled={isSubmitting || enteredOtp.length !== 6} className="px-6 py-2.5 rounded-xl bg-[#0B9FE3] hover:bg-[#087FC9] text-white text-xs font-extrabold shadow-md disabled:opacity-60">{isSubmitting ? 'Verifying…' : 'Verify & Sign In →'}</button>
                  </div>
                </form>
              )}
              {/* ============================================================
                  VIEW C: SIGN UP (CREATE ACCOUNT) (Sections 22-26)
                 ============================================================ */}
              {(authMode === 'signup' || authMode === 'voice_signup') && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  
                  {signupStep === 1 && <div className="grid grid-cols-1 gap-4 items-stretch">
                  {/* SMART REGISTRATION AI SECTION (Section 23) */}
                  {authMode === 'signup' && (
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

                  </div>
                  )}

                  {authMode === 'voice_signup' && (
                  <section className="rounded-2xl border-2 border-sky-300 dark:border-sky-800 bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/40 dark:to-slate-900 p-4 sm:p-5 shadow-sm flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-extrabold text-[#10244A] dark:text-white">Guided voice registration</h3>
                        <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">Dictate your name, age, phone, symptoms, and how long you’ve had them in English or Hindi. You can also dictate the other signup fields. Review and edit them before submitting.</p>
                      </div>
                      <select aria-label="Voice input language" value={signupVoiceLanguage} onChange={(e) => setSignupVoiceLanguage(e.target.value as 'en-IN' | 'hi-IN')} className="rounded-lg border border-sky-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-100">
                        <option value="en-IN">English</option>
                        <option value="hi-IN">हिन्दी</option>
                      </select>
                      <button type="button" onClick={startSignupDictation} disabled={isDictatingSignup || signupVoiceComplete} className="shrink-0 rounded-xl bg-[#087FC9] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60">
                        <Mic className="mr-2 inline h-4 w-4" />{isDictatingSignup ? 'Listening…' : signupVoiceComplete ? 'Voice details captured' : signupVoiceAwaitingNext ? signupVoiceQuestionIndex === signupVoiceQuestions.length - 1 ? 'Finish voice questions' : 'Ask next question' : 'Start voice registration'}
                      </button>
                    </div>
                    <p className="-mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">After signup, your symptoms will help match you with relevant doctors.</p>
                    {!signupVoiceComplete && <div className="rounded-xl border border-sky-100 bg-white/80 p-3 dark:border-sky-900 dark:bg-slate-900/60">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Question {signupVoiceQuestionIndex + 1} of {signupVoiceQuestions.length}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{signupVoiceQuestions[signupVoiceQuestionIndex].key === 'email' ? signupVoiceQuestions[signupVoiceQuestionIndex].en : signupVoiceLanguage === 'hi-IN' ? signupVoiceQuestions[signupVoiceQuestionIndex].hi : signupVoiceQuestions[signupVoiceQuestionIndex].en}</p>
                    </div>}
                    {signupVoiceTranscript && <p className="rounded-xl bg-white/80 p-3 text-xs text-slate-700 dark:bg-slate-900/60 dark:text-slate-200"><b>Recognized:</b> {signupVoiceTranscript}</p>}
                    {signupVoiceComplete && <p className="text-xs text-emerald-700 dark:text-emerald-300">Voice answers are filled in. Review and edit them in the form below. Password and consent must be entered manually.</p>}
                    {signupVoiceError && <p role="alert" className="mt-2 text-xs font-medium text-rose-700 dark:text-rose-300">{signupVoiceError}</p>}
                  </section>
                  )}
                  </div>}

                  {/* REGISTRATION FORM (Section 24) */}
                  <form onSubmit={handleSignUpSubmit} className="space-y-4">
                    <div ref={signupStepperRef} className="mb-2 flex items-center gap-2" aria-label={`Signup step ${signupStep} of 3`}>
                      {[1, 2, 3].map((step) => (
                        <div key={step} className="flex flex-1 items-center gap-2">
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${signupStep >= step ? 'bg-[#0B9FE3] text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>{step}</div>
                          <span className={`hidden text-xs font-semibold sm:block ${signupStep === step ? 'text-[#087FC9]' : 'text-slate-500 dark:text-slate-400'}`}>{step === 1 ? 'Personal' : step === 2 ? 'Health' : 'Review'}</span>
                          {step < 3 && <div className={`h-0.5 flex-1 ${signupStep > step ? 'bg-[#0B9FE3]' : 'bg-slate-200 dark:bg-slate-700'}`} />}
                        </div>
                      ))}
                    </div>

                    {signupStep === 1 && <>
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
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={signupPhone}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSignupPhone(val);
                              const res = validatePhoneNumber(val, true);
                              setFieldErrors(prev => ({ ...prev, phone: res.error }));
                            }}
                            onPaste={(e) => {
                              e.preventDefault();
                              const pasted = e.clipboardData.getData('text');
                              setSignupPhone(pasted);
                              const res = validatePhoneNumber(pasted, true);
                              setFieldErrors(prev => ({ ...prev, phone: res.error }));
                            }}
                            placeholder="10-digit number e.g. 9820012345"
                            maxLength={15}
                            className={`w-full h-12 px-3.5 pr-14 rounded-xl border ${fieldErrors.phone ? 'border-rose-400 bg-rose-50/30 dark:bg-rose-950/20' : signupPhone.length === 10 && !validatePhoneNumber(signupPhone, true).error ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20' : getFieldBorderClass('mobileNumber')} bg-white dark:bg-[#1A263C] text-xs sm:text-sm text-[#10244A] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#0B9FE3]/20 transition font-mono tracking-wider`}
                          />
                          <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold tabular-nums pointer-events-none select-none ${fieldErrors.phone ? 'text-rose-500' : signupPhone.length === 10 ? 'text-emerald-600' : signupPhone.length > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                            {signupPhone.length}/10
                          </span>
                        </div>
                        {fieldErrors.phone && (
                          <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1 animate-in fade-in">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{fieldErrors.phone}</span>
                          </p>
                        )}
                        <ExtractedFieldIndicator
                          confidence={fieldConfidence.mobileNumber}
                          fieldName="Mobile Number"
                          isExtracted={Boolean(extractedFields.mobileNumber)}
                          onClearField={() => handleClearSingleField('mobileNumber')}
                        />
                      </div>
                    </div>

                    {/* Row 2: Email, Age, Gender, Blood Group */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="col-span-2 sm:col-span-2 space-y-1">
                        <label className="block text-xs font-bold text-[#10244A] dark:text-[#F1F5F9]">Email Address <span className="text-[#EF4444]">*</span></label>
                        <input
                          type="email"
                          required
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          placeholder="name@mail.com"
                          className={`w-full h-11 px-3 rounded-xl border ${getFieldBorderClass('email')} bg-white dark:bg-[#1A263C] text-xs text-[#10244A] dark:text-white focus:outline-hidden transition`}
                        />
                      </div>

                      <div className="col-span-2 sm:col-span-2 space-y-1">
                        <label className="block text-xs font-bold text-[#10244A] dark:text-[#F1F5F9]">Password <span className="text-[#EF4444]">*</span></label>
                        <input
                          ref={signupPasswordInputRef}
                          type="password"
                          autoComplete="new-password"
                          minLength={6}
                          required
                          value={signupPassword}
                          onChange={(event) => {
                            const password = event.target.value;
                            setSignupPassword(password);
                            setFieldErrors((current) => current.password
                              ? { ...current, password: password.length < 6 ? 'Password must be at least 6 characters.' : '' }
                              : current);
                          }}
                          placeholder="At least 6 characters"
                          className={`w-full h-11 px-3 rounded-xl border ${fieldErrors.password ? 'border-rose-400' : 'border-[#DCE7F0]'} bg-white dark:bg-[#1A263C] text-xs text-[#10244A] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#0B9FE3]/20 transition`}
                        />
                        {fieldErrors.password && <p className="text-[11px] text-rose-600">{fieldErrors.password}</p>}
                        <p className={`text-[11px] ${signupPassword.length > 0 && signupPassword.length < 6 ? 'text-rose-600' : 'text-slate-500 dark:text-slate-400'}`}>
                          {signupPassword.length}/6 characters minimum
                        </p>
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
                    </>}

                    {signupStep === 2 && <>
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
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={signupEmergencyPhone}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSignupEmergencyPhone(val);
                              const res = val.trim() ? validatePhoneNumber(val, false) : { isValid: true, error: '' };
                              setFieldErrors(prev => ({ ...prev, emergencyPhone: res.error }));
                            }}
                            onPaste={(e) => {
                              e.preventDefault();
                              const pasted = e.clipboardData.getData('text');
                              setSignupEmergencyPhone(pasted);
                              const res = pasted.trim() ? validatePhoneNumber(pasted, false) : { isValid: true, error: '' };
                              setFieldErrors(prev => ({ ...prev, emergencyPhone: res.error }));
                            }}
                            placeholder="10-digit emergency number"
                            maxLength={15}
                            className={`w-full h-11 px-3.5 pr-14 rounded-xl border ${
                              fieldErrors.emergencyPhone
                                ? 'border-rose-400 bg-rose-50/30 dark:bg-rose-950/20'
                                : signupEmergencyPhone.length === 10 && !validatePhoneNumber(signupEmergencyPhone, false).error
                                ? 'border-emerald-500 bg-emerald-50/20'
                                : getFieldBorderClass('emergencyContactPhone')
                            } bg-white dark:bg-[#1A263C] text-xs text-[#10244A] dark:text-white focus:outline-hidden transition font-mono`}
                          />
                          <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold tabular-nums pointer-events-none select-none ${
                            fieldErrors.emergencyPhone
                              ? 'text-rose-500'
                              : signupEmergencyPhone.length === 10
                              ? 'text-emerald-600'
                              : signupEmergencyPhone.length > 0
                              ? 'text-amber-500'
                              : 'text-slate-400'
                          }`}>
                            {signupEmergencyPhone.length}/10
                          </span>
                        </div>
                        {fieldErrors.emergencyPhone && (
                          <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1 animate-in fade-in">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{fieldErrors.emergencyPhone}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3.5 pt-1">
                      <div className="space-y-1">
                        <label htmlFor="signup-symptoms" className="block text-xs font-bold text-[#10244A] dark:text-[#F1F5F9]">Symptoms</label>
                        <textarea id="signup-symptoms" value={signupSymptoms} onChange={(e) => setSignupSymptoms(e.target.value)} placeholder="e.g. Fever and headache" rows={2} className="w-full px-3.5 py-3 rounded-xl border border-[#DCE7F0] dark:border-[#334155] bg-white dark:bg-[#1A263C] text-xs sm:text-sm text-[#10244A] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#0B9FE3]/20 transition" />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="signup-symptom-duration" className="block text-xs font-bold text-[#10244A] dark:text-[#F1F5F9]">Duration</label>
                        <input id="signup-symptom-duration" value={signupSymptomDuration} onChange={(e) => setSignupSymptomDuration(e.target.value)} placeholder="e.g. 3 days" className="w-full h-12 px-3.5 rounded-xl border border-[#DCE7F0] dark:border-[#334155] bg-white dark:bg-[#1A263C] text-xs sm:text-sm text-[#10244A] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#0B9FE3]/20 transition" />
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
                    </>}

                    {signupStep === 3 && <>
                      <section className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-900 dark:bg-slate-900/60">
                        <h3 className="text-sm font-bold text-[#10244A] dark:text-white">Review your details</h3>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Check your information before creating your patient account.</p>
                        <dl className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                          <div><dt className="text-slate-500">Full name</dt><dd className="font-semibold text-slate-900 dark:text-white">{signupName || 'Not provided'}</dd></div>
                          <div><dt className="text-slate-500">Mobile number</dt><dd className="font-semibold text-slate-900 dark:text-white">{signupPhone || 'Not provided'}</dd></div>
                          <div><dt className="text-slate-500">Email</dt><dd className="font-semibold text-slate-900 dark:text-white">{signupEmail || 'Not provided'}</dd></div>
                          <div><dt className="text-slate-500">Age, gender, and blood group</dt><dd className="font-semibold text-slate-900 dark:text-white">{signupAge} years · {signupGender} · {signupBloodGroup}</dd></div>
                          <div><dt className="text-slate-500">Symptoms</dt><dd className="font-semibold text-slate-900 dark:text-white">{signupSymptoms || 'Not provided'}</dd></div>
                          <div><dt className="text-slate-500">Symptom duration</dt><dd className="font-semibold text-slate-900 dark:text-white">{signupSymptomDuration || 'Not provided'}</dd></div>
                          <div><dt className="text-slate-500">Allergies</dt><dd className="font-semibold text-slate-900 dark:text-white">{selectedAllergies.join(', ') || 'None selected'}</dd></div>
                          <div><dt className="text-slate-500">Medical conditions</dt><dd className="font-semibold text-slate-900 dark:text-white">{selectedConditions.join(', ') || 'None selected'}</dd></div>
                          <div><dt className="text-slate-500">Emergency contact</dt><dd className="font-semibold text-slate-900 dark:text-white">{signupEmergencyName || signupEmergencyPhone ? `${signupEmergencyName || 'Name not provided'} · ${signupEmergencyPhone || 'Phone not provided'}` : 'Not provided'}</dd></div>
                        </dl>
                        <button type="button" onClick={() => setSignupStep(1)} className="mt-3 text-xs font-bold text-[#087FC9] hover:underline">Edit personal details</button>
                        <button type="button" onClick={() => setSignupStep(2)} className="ml-4 mt-3 text-xs font-bold text-[#087FC9] hover:underline">Edit health details</button>
                      </section>

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
                      disabled={isSubmitting || signupPassword.length < 6}
                      className="w-full h-13 sm:h-14 rounded-xl bg-[#0B9FE3] hover:bg-[#087FC9] text-white font-extrabold text-xs sm:text-sm shadow-md shadow-[#0B9FE3]/25 flex items-center justify-center gap-2.5 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Create Patient Account & Continue {'->'}</span>
                    </button>
                    </>}

                    {signupStep < 3 && (
                      <div className="flex gap-3 pt-2">
                        {signupStep === 2 && <button type="button" onClick={() => setSignupStep(1)} className="h-12 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Back</button>}
                        <button
                          type="button"
                          onClick={() => {
                            if (signupStep === 1) {
                              const nameError = validateName(signupName);
                              const phoneResult = validatePhoneNumber(signupPhone, true);
                              const emailError = signupEmail.trim() ? validateEmail(signupEmail) : 'Email address is required.';
                              const passwordError = signupPassword.length < 6 ? 'Password must be at least 6 characters.' : '';
                              const errors: Record<string, string> = {};
                              if (nameError) errors.name = nameError;
                              if (!phoneResult.isValid) errors.phone = phoneResult.error;
                              if (emailError) errors.email = emailError;
                              if (passwordError) errors.password = passwordError;
                              if (!Number.isFinite(signupAge) || signupAge < 1 || signupAge > 120) errors.age = 'Enter an age from 1 to 120.';
                              setFieldErrors(errors);
                              const firstError = Object.values(errors)[0];
                              if (firstError) {
                                setErrorMessage(firstError);
                                notify('Check your details', firstError, 'urgent');
                                if (passwordError) signupPasswordInputRef.current?.focus();
                                return;
                              }
                              setErrorMessage('');
                            }
                            setSignupStep((step) => step === 1 ? 2 : 3);
                            window.setTimeout(() => signupStepperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
                          }}
                          className="h-12 flex-1 rounded-xl bg-[#0B9FE3] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#087FC9]"
                        >
                          Continue to {signupStep === 1 ? 'health details' : 'review'} →
                        </button>
                      </div>
                    )}

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

    </div>
  );
};
