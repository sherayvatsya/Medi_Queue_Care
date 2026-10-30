import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Volume2,
  RefreshCw,
  FileText,
  User,
  Calendar,
  Clock,
  ShieldCheck,
  Languages,
  ArrowRight,
  Printer,
  ChevronDown,
  Info,
  X,
  Radio,
  WifiOff,
} from 'lucide-react';
import { Doctor, Patient, PatientUser } from '../types';
import { playHospitalChime, playUrgentAlertSound } from '../utils/audio';

interface VoiceIntakeProps {
  doctors: Doctor[];
  currentUser?: PatientUser | null;
  onGenerateToken: (patient: Patient) => void;
  onFallbackToTyped: () => void;
  onShowToast?: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
}

type SupportedLanguage = 'hi-IN' | 'en-IN' | 'pa-guru-IN';

interface StructuredFields {
  name: string;
  age: string;
  symptoms: string[];
  duration: string;
  notes: string;
  urgent: boolean;
}

export const VoiceIntake: React.FC<VoiceIntakeProps> = ({
  doctors,
  currentUser,
  onGenerateToken,
  onFallbackToTyped,
  onShowToast,
}) => {
  // Language selection
  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>('hi-IN');

  // Speech Recognition & Audio Recorder state
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [interimText, setInterimText] = useState<string>('');
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);
  const [micNotice, setMicNotice] = useState<{ type: 'warning' | 'info'; message: string } | null>(null);
  const [isProcessingAudio, setIsProcessingAudio] = useState<boolean>(false);

  // Structuring state
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [structuredData, setStructuredData] = useState<StructuredFields | null>(null);
  const [newSymptomInput, setNewSymptomInput] = useState<string>('');

  // Confirmation & Consent
  const [consentGiven, setConsentGiven] = useState<boolean>(false);
  const [createdPatient, setCreatedPatient] = useState<Patient | null>(null);

  // Selected doctor
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(() => {
    const genDoc = doctors.find((d) => d.department === 'General Medicine');
    return genDoc?.id || doctors[0]?.id || 'doc-1';
  });

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const hasWebSpeechNetworkErrorRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const notify = (title: string, desc: string, type: 'info' | 'success' | 'urgent' = 'info') => {
    if (onShowToast) {
      onShowToast(title, desc, type);
    }
  };

  // Convert custom language code to valid BCP 47 for Web Speech API
  const getBCP47Lang = (lang: SupportedLanguage): string => {
    if (lang === 'pa-guru-IN') return 'pa-IN'; // Chrome requires pa-IN, not pa-guru-IN
    return lang;
  };

  // Announce Token via SpeechSynthesis
  const speakTokenAnnouncement = (tokenNumber: string, lang: SupportedLanguage, isUrgent: boolean) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();

        let message = '';
        let synthLang = 'en-IN';

        if (lang === 'hi-IN') {
          synthLang = 'hi-IN';
          message = isUrgent
            ? `कृपया ध्यान दें। आपका आपातकालीन टोकन नंबर ${tokenNumber} है। तुरंत आपातकालीन स्टाफ से संपर्क करें।`
            : `आपका टोकन नंबर ${tokenNumber} है। कृपया प्रतीक्षा करें।`;
        } else if (lang === 'pa-guru-IN') {
          synthLang = 'pa-IN';
          message = isUrgent
            ? `ਕਿਰਪਾ ਕਰਕੇ ਧਿਆਨ ਦਿਓ। ਤੁਹਾਡਾ ਐਮਰਜੈਂਸੀ ਟੋਕਨ ਨੰਬਰ ${tokenNumber} ਹੈ। ਤੁਰੰਤ ਸਟਾਫ ਨੂੰ ਮਿਲੋ।`
            : `ਤੁਹਾਡਾ ਟੋਕਨ ਨੰਬਰ ${tokenNumber} ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਉਡੀਕ ਕਰੋ।`;
        } else {
          synthLang = 'en-IN';
          message = isUrgent
            ? `Attention please. Your urgent token number is ${tokenNumber}. Please inform nursing staff immediately.`
            : `Your token number is ${tokenNumber}. Please proceed to the waiting area.`;
        }

        const utterance = new SpeechSynthesisUtterance(message);
        utterance.lang = synthLang;
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('Speech synthesis announcement error:', err);
      }
    }
  };

  // Transcribe recorded audio via backend Gemini
  const transcribeRecordedAudio = async (audioBlob: Blob) => {
    if (!audioBlob || audioBlob.size < 500) {
      return;
    }

    setIsProcessingAudio(true);
    setMicNotice({
      type: 'info',
      message: 'Processing your voice recording via Hospital Gemini AI...',
    });

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'patient_recording.webm');
      formData.append('language', getBCP47Lang(selectedLang));

      const res = await fetch('/api/intake/transcribe-audio', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (result.success && result.transcript) {
        setTranscript((prev) => {
          const trimmed = prev.trim();
          const fresh = result.transcript.trim();
          return trimmed ? `${trimmed} ${fresh}` : fresh;
        });

        // Pre-fill structured data automatically
        setStructuredData({
          name: result.name || currentUser?.name || '',
          age: result.age !== null && result.age !== undefined ? String(result.age) : (currentUser ? String(currentUser.age) : ''),
          symptoms: Array.isArray(result.symptoms) && result.symptoms.length > 0 ? result.symptoms : ['General consultation'],
          duration: result.duration || '',
          notes: result.notes || '',
          urgent: Boolean(result.urgent),
        });

        setMicNotice(null);
        playHospitalChime();

        if (result.urgent) {
          playUrgentAlertSound();
          notify('Urgent Symptoms Detected', 'Potential acute condition flagged from voice recording.', 'urgent');
        } else {
          notify('Voice Transcribed', 'Spoken symptoms captured and structured successfully.', 'success');
        }
      } else {
        throw new Error(result.error || 'Could not transcribe voice audio.');
      }
    } catch (err: any) {
      console.warn('Backend audio transcription notice:', err);
      setMicNotice({
        type: 'warning',
        message: 'Could not automatically transcribe audio. You can type your symptoms in the box below or switch to typed form.',
      });
    } finally {
      setIsProcessingAudio(false);
    }
  };

  // Start Voice Listener (Web Speech API + Dual MediaRecorder backup)
  const startListening = async () => {
    setMicNotice(null);
    hasWebSpeechNetworkErrorRef.current = false;
    audioChunksRef.current = [];

    // Step 1: Request microphone permission & start hardware audio stream
    let stream: MediaStream | null = null;
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;

        // Initialize MediaRecorder for fail-proof backup
        try {
          const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : '';

          const mediaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
          mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              audioChunksRef.current.push(e.data);
            }
          };
          mediaRecorderRef.current = mediaRecorder;
          mediaRecorder.start(250);
        } catch (recorderErr) {
          console.warn('MediaRecorder init notice:', recorderErr);
        }
      }
    } catch (permErr: any) {
      console.warn('Microphone permission notice:', permErr);
      setMicNotice({
        type: 'warning',
        message: 'Microphone permission was not granted. Please allow microphone access in your browser bar, or use the typed registration form.',
      });
      setIsListening(false);
      return;
    }

    // Step 2: Start Web Speech API recognition
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      // Browser does not support Web Speech, but MediaRecorder is running
      setIsListening(true);
      playHospitalChime();
      setMicNotice({
        type: 'info',
        message: 'Recording audio directly via Hospital AI. Click the stop button when done speaking.',
      });
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = getBCP47Lang(selectedLang);

      recognition.onstart = () => {
        setIsListening(true);
        playHospitalChime();
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let finalizedSegment = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalizedSegment += result[0].transcript + ' ';
          } else {
            currentInterim += result[0].transcript;
          }
        }

        if (finalizedSegment) {
          setTranscript((prev) => {
            const trimmed = prev.trim();
            const addition = finalizedSegment.trim();
            return trimmed ? `${trimmed} ${addition}` : addition;
          });
        }
        setInterimText(currentInterim);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech Recognition Event Code:', event.error);
        const errorCode = event.error;

        if (errorCode === 'network') {
          hasWebSpeechNetworkErrorRef.current = true;
          // Silently fall back to MediaRecorder — no scary warning, just an info notice
          setMicNotice({
            type: 'info',
            message: 'AI Audio Mode: Your voice is being recorded directly. Tap Stop when done — Gemini AI will transcribe it automatically.',
          });
          // Do NOT abort; let the user keep talking into MediaRecorder!
          return;
        }

        if (errorCode === 'no-speech') {
          // Not an error — user just hasn't spoken yet. Ignore silently.
          return;
        }

        if (errorCode === 'audio-capture') {
          setMicNotice({
            type: 'warning',
            message: 'Microphone not detected. Please connect a microphone and try again, or switch to typed registration.',
          });
          setIsListening(false);
          return;
        }

        if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed' || errorCode === 'permission-denied') {
          setMicNotice({
            type: 'warning',
            message: 'Microphone access was not granted. Please click Allow in your browser\'s permission prompt, or switch to typed registration.',
          });
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        // Only turn off listening if not actively recording via MediaRecorder
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
          setIsListening(false);
          setInterimText('');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch (err: any) {
      console.warn('Speech recognition startup notice:', err);
      // Even if Web Speech crashes, MediaRecorder is still recording!
      setIsListening(true);
      setMicNotice({
        type: 'info',
        message: '🎙️ Direct Audio Mode Active: Speak now. Tap stop when finished to transcribe with AI.',
      });
    }
  };

  // Stop Listening and Process Voice
  const stopListening = () => {
    setIsListening(false);
    setInterimText('');

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          // Stop audio tracks
          if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach((t) => t.stop());
            audioStreamRef.current = null;
          }

          // If transcript is empty or network error occurred, transcribe via Gemini
          if (!transcript.trim() || hasWebSpeechNetworkErrorRef.current) {
            transcribeRecordedAudio(audioBlob);
          }
        };
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn('Error stopping media recorder:', err);
      }
    } else {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
      }
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setSelectedLang(newLang);
    if (isListening) {
      stopListening();
    }
  };

  // Call /api/intake/structure for typed or transcribed text
  const handleGenerateSummary = async () => {
    // Prevent duplicate requests while analysis is in progress
    if (isAnalyzing) {
      return;
    }

    const textToAnalyze = transcript.trim();
    if (!textToAnalyze) {
      setAnalysisError('Please speak into the microphone or type symptoms in the transcript box before generating summary.');
      notify('Empty Transcript', 'Please speak into the microphone or type your symptoms first.', 'urgent');
      return;
    }

    if (isListening) {
      stopListening();
    }

    // Abort any prior pending request
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch {}
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 25-second timeout safeguard
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 25000);

    setIsAnalyzing(true);
    setAnalysisError(null);
    setMicNotice(null);

    try {
      const response = await fetch('/api/intake/structure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-staff-role': 'staff',
        },
        body: JSON.stringify({ transcript: textToAnalyze }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to extract structured data from transcript.');
      }

      // Validate the returned structure
      if (typeof data !== 'object') {
        throw new Error('Malformed clinical response received from server.');
      }

      setStructuredData({
        name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : (currentUser?.name || ''),
        age: data.age !== null && data.age !== undefined && !isNaN(Number(data.age))
          ? String(data.age)
          : (currentUser ? String(currentUser.age) : ''),
        symptoms: Array.isArray(data.symptoms) && data.symptoms.length > 0 ? data.symptoms : ['General consultation'],
        duration: typeof data.duration === 'string' ? data.duration : '',
        notes: typeof data.notes === 'string' ? data.notes : '',
        urgent: Boolean(data.urgent),
      });

      setAnalysisError(null);

      if (data.urgent) {
        playUrgentAlertSound();
        notify(
          'Urgent Symptoms Detected',
          'Potential acute red-flag detected from speech. Prioritizing emergency routing.',
          'urgent'
        );
      } else {
        playHospitalChime();
        notify('Information Extracted', 'Speech successfully converted into clinical registration fields.', 'success');
      }
    } catch (err: any) {
      console.error('Intake structuring error:', err);
      let errMsg = err?.message || 'Could not analyze voice input. Please review and try again.';
      if (err?.name === 'AbortError') {
        errMsg = 'Clinical analysis request timed out (15s). Please check your internet connection or click Retry.';
      }
      setAnalysisError(errMsg);
      notify('Extraction Failed', errMsg, 'urgent');
    } finally {
      clearTimeout(timeoutId);
      setIsAnalyzing(false);
    }
  };

  const handleAddSymptom = () => {
    if (!newSymptomInput.trim() || !structuredData) return;
    const clean = newSymptomInput.trim();
    if (!structuredData.symptoms.includes(clean)) {
      setStructuredData({
        ...structuredData,
        symptoms: [...structuredData.symptoms, clean],
      });
    }
    setNewSymptomInput('');
  };

  const handleRemoveSymptom = (idx: number) => {
    if (!structuredData) return;
    const updated = structuredData.symptoms.filter((_, i) => i !== idx);
    setStructuredData({
      ...structuredData,
      symptoms: updated,
    });
  };

  const handleConfirmAndGenerateToken = () => {
    if (!structuredData) return;

    if (!consentGiven) {
      notify('Consent Required', 'Please confirm patient consent before generating token.', 'urgent');
      return;
    }

    const assignedDoctor = doctors.find((d) => d.id === selectedDoctorId) || doctors[0];
    const isUrgent = structuredData.urgent;

    const prefix = assignedDoctor?.department === 'Orthopedics' ? 'A' : assignedDoctor?.department === 'Cardiology' ? 'C' : 'G';
    const randomNum = Math.floor(Math.random() * 40) + 45;
    const tokenStr = isUrgent ? `ER-${Math.floor(Math.random() * 80) + 10}` : `${prefix}-${randomNum}`;
    const waitMins = isUrgent ? 0 : 15;
    const queuePos = isUrgent ? 0 : 2;

    const newPatient: Patient = {
      id: `pat-v-${Date.now()}`,
      userId: currentUser?.id,
      tokenNumber: tokenStr,
      name: structuredData.name.trim() || currentUser?.name || 'Patient Guest',
      age: Number(structuredData.age) || currentUser?.age || 35,
      gender: currentUser?.gender || 'Male',
      phone: currentUser?.phone || '+91 98000 00000',
      uhid: currentUser?.uhid || `MQ-DEL-V${Math.floor(1000 + Math.random() * 9000)}`,
      patientType: 'new',
      department: isUrgent ? 'Emergency & Trauma' : assignedDoctor.department,
      doctorId: isUrgent ? 'doc-er' : assignedDoctor.id,
      doctorName: isUrgent ? 'Emergency Triage Team' : assignedDoctor.name,
      roomNumber: isUrgent ? 'ER Bay 1' : assignedDoctor.roomNumber,
      opdBlock: isUrgent ? 'Emergency Casualty Block' : assignedDoctor.opdBlock,
      floor: isUrgent ? 'Ground Floor' : assignedDoctor.floor,
      symptoms: structuredData.symptoms,
      otherSymptomsText: structuredData.duration ? `Duration: ${structuredData.duration}` : undefined,
      allergiesText: currentUser?.allergies?.join(', ') || undefined,
      triageCategory: isUrgent ? 'urgent_er' : 'standard',
      triageNotes: isUrgent
        ? `VOICE RED-FLAG TRIAGE: Spoke acute keywords. Auto-routed to Emergency.`
        : `Voice Intake: ${structuredData.symptoms.join(', ')}. Duration: ${structuredData.duration || 'Not specified'}. Notes: ${structuredData.notes || 'None'}`,
      preTestRecommended: [],
      preTestOptIn: false,
      preTestStatus: 'not_required',
      queuePosition: queuePos,
      estimatedWaitMinutes: waitMins,
      status: isUrgent ? 'in_consultation' : 'waiting',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      duration: structuredData.duration || undefined,
      notes: structuredData.notes || undefined,
      urgent: isUrgent,
      intakeSource: 'voice',
      consentGiven: true,
    };

    onGenerateToken(newPatient);
    setCreatedPatient(newPatient);

    if (isUrgent) {
      playUrgentAlertSound();
    } else {
      playHospitalChime();
    }

    speakTokenAnnouncement(tokenStr, selectedLang, isUrgent);

    notify(
      isUrgent ? 'Urgent Token Dispatched' : 'Token Generated',
      `Token #${tokenStr} generated successfully for ${newPatient.name}.`,
      isUrgent ? 'urgent' : 'success'
    );
  };

  const handleReset = () => {
    setStructuredData(null);
    setCreatedPatient(null);
    setTranscript('');
    setInterimText('');
    setConsentGiven(false);
    setMicNotice(null);
    setAnalysisError(null);
  };

  // -------------------------------------------------------------
  // VIEW: Token Success Display
  // -------------------------------------------------------------
  if (createdPatient) {
    const isUrgent = createdPatient.urgent;
    return (
      <div className="card-healthcare p-6 sm:p-8 bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-neutral-800 rounded-3xl space-y-6 shadow-xl animate-in fade-in zoom-in-95 duration-300">
        <div className="text-center space-y-3">
          <div className="inline-flex p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mb-1">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">
            Voice Registration Confirmed!
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Spoken intake successfully processed and assigned to the live hospital queue.
          </p>

          {isUrgent && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-100 dark:bg-red-950/80 border-2 border-red-500 text-red-700 dark:text-red-300 font-bold text-sm animate-pulse shadow-md">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span>URGENT: Inform Nursing Staff Immediately</span>
            </div>
          )}
        </div>

        {/* Big Token Number Banner */}
        <div
          className={`p-6 sm:p-8 rounded-2xl text-center relative overflow-hidden ${
            isUrgent
              ? 'bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-lg shadow-red-500/25'
              : 'bg-gradient-to-br from-[#087FC9] to-[#0B5E97] text-white shadow-lg shadow-sky-500/25'
          }`}
        >
          <div className="text-xs uppercase tracking-wider font-bold opacity-90 mb-1">
            Official OPD Consultation Token
          </div>
          <div className="font-mono font-black text-5xl sm:text-6xl tracking-tight my-2">
            #{createdPatient.tokenNumber}
          </div>
          <div className="text-sm font-medium opacity-95">
            {createdPatient.doctorName} • {createdPatient.roomNumber} ({createdPatient.floor})
          </div>
        </div>

        {/* Patient Details Snapshot */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-neutral-900/60 border border-slate-200 dark:border-neutral-800 text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400">Patient Name:</span>
            <div className="font-bold text-slate-900 dark:text-white text-sm">{createdPatient.name}</div>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">Patient Age / UHID:</span>
            <div className="font-bold text-slate-900 dark:text-white text-sm">
              {createdPatient.age} yrs • {createdPatient.uhid}
            </div>
          </div>
          <div className="sm:col-span-2">
            <span className="text-slate-500 dark:text-slate-400">Captured Symptoms:</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {createdPatient.symptoms.map((s, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-800 dark:text-slate-200 font-semibold"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Announcement controls & Actions */}
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={() => speakTokenAnnouncement(createdPatient.tokenNumber, selectedLang, Boolean(isUrgent))}
            className="flex-1 min-w-[200px] px-4 py-3 rounded-xl bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-900 dark:text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Volume2 className="w-4 h-4 text-[#087FC9]" />
            <span>Replay Voice Announcement</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="px-5 py-3 rounded-xl bg-[#087FC9] hover:bg-[#0B5E97] text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Register Another Patient</span>
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: Main Voice Intake & Recording Interface
  // -------------------------------------------------------------
  return (
    <div className="card-healthcare p-5 sm:p-7 bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-neutral-800 rounded-3xl space-y-6 shadow-md">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-neutral-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-[#087FC9] text-white flex items-center justify-center shadow-md">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-lg sm:text-xl text-slate-900 dark:text-white">
                Voice-First OPD Registration
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Speak in Hindi, English, or Punjabi. Dual Speech + AI Audio transcription engine.
              </p>
            </div>
          </div>
        </div>

        {/* Fallback to standard typed form */}
        <button
          type="button"
          onClick={onFallbackToTyped}
          className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition self-start sm:self-center cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Switch to Typed Form</span>
        </button>
      </div>

      {/* Language Selector */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Languages className="w-4 h-4 text-[#087FC9]" />
          Spoken Language:
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleLanguageChange('hi-IN')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              selectedLang === 'hi-IN'
                ? 'bg-[#087FC9] text-white shadow-sm'
                : 'bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-neutral-700'
            }`}
          >
            🇮🇳 हिन्दी (Hindi)
          </button>
          <button
            type="button"
            onClick={() => handleLanguageChange('en-IN')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              selectedLang === 'en-IN'
                ? 'bg-[#087FC9] text-white shadow-sm'
                : 'bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-neutral-700'
            }`}
          >
            🇬🇧 English (India)
          </button>
          <button
            type="button"
            onClick={() => handleLanguageChange('pa-guru-IN')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              selectedLang === 'pa-guru-IN'
                ? 'bg-[#087FC9] text-white shadow-sm'
                : 'bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-neutral-700'
            }`}
          >
            🇮🇳 ਪੰਜਾਬੀ (Punjabi)
          </button>
        </div>
      </div>

      {/* Mic Notice or Fallback Indicator */}
      {micNotice && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-start gap-3 animate-in fade-in duration-200 ${
            micNotice.type === 'info'
              ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-900/60 text-sky-900 dark:text-sky-200'
              : 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
          }`}
        >
          {micNotice.type === 'info' ? (
            <Radio className="w-5 h-5 text-sky-600 shrink-0 mt-0.5 animate-pulse" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 space-y-1">
            <div className="font-bold">
              {micNotice.type === 'info' ? '🎙️ AI Audio Recording Active' : 'Microphone Notice'}
            </div>
            <p>{micNotice.message}</p>
            {micNotice.type === 'warning' && (
              <button
                type="button"
                onClick={onFallbackToTyped}
                className="mt-1 inline-flex items-center gap-1 text-amber-800 dark:text-amber-300 underline hover:no-underline font-semibold cursor-pointer"
              >
                <FileText className="w-3 h-3" />
                Click here to use the standard typed registration form instead →
              </button>
            )}
          </div>
          {/* Dismiss button */}
          <button
            type="button"
            onClick={() => setMicNotice(null)}
            className={`shrink-0 p-1 rounded-lg cursor-pointer hover:opacity-70 transition ${
              micNotice.type === 'info' ? 'text-sky-600' : 'text-amber-600'
            }`}
            title="Dismiss notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mic Recording Panel */}
      <div className="p-6 rounded-2xl bg-slate-50 dark:bg-neutral-900/60 border border-slate-200 dark:border-neutral-800 text-center space-y-4">
        {/* Pulsing Mic Circle */}
        <div className="relative inline-flex items-center justify-center">
          {isListening && (
            <>
              <span className="absolute w-24 h-24 rounded-full bg-red-400 opacity-75 animate-ping"></span>
              <span className="absolute w-20 h-20 rounded-full bg-red-500 opacity-30 animate-pulse"></span>
            </>
          )}
          <button
            type="button"
            onClick={toggleListening}
            disabled={isProcessingAudio}
            className={`relative z-10 w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95 ${
              isListening
                ? 'bg-red-600 text-white hover:bg-red-700 ring-4 ring-red-400/30'
                : 'bg-gradient-to-tr from-[#087FC9] to-[#0284C7] text-white hover:shadow-sky-500/30 hover:scale-105'
            } ${isProcessingAudio ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={isListening ? 'Click to stop listening' : 'Click to start recording voice'}
          >
            {isProcessingAudio ? (
              <RefreshCw className="w-8 h-8 animate-spin" />
            ) : isListening ? (
              <MicOff className="w-8 h-8" />
            ) : (
              <Mic className="w-8 h-8" />
            )}
          </button>
        </div>

        <div>
          <div className="font-heading font-bold text-base text-slate-900 dark:text-white">
            {isProcessingAudio
              ? 'Hospital Gemini AI is transcribing your voice...'
              : isListening
              ? 'Listening to patient... Tap again when finished speaking'
              : 'Tap the microphone to speak'}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            {isListening
              ? 'Speak clearly in your chosen language. Click the mic button again when you are done speaking.'
              : 'Example: "Mera naam Ramesh hai, umar 45 saal, teen din se tez bukhar aur khansi hai."'}
          </p>
        </div>

        {/* Live Audio Visualizer Bar Simulation */}
        {isListening && (
          <div className="flex items-center justify-center gap-1.5 h-6">
            <span className="w-1.5 h-3 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-6 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            <span className="w-1.5 h-4 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '450ms' }} />
            <span className="w-1.5 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
          </div>
        )}
      </div>

      {/* Editable Transcript Textarea */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-[#087FC9]" />
            Spoken Transcript (Editable):
          </label>
          {transcript && (
            <button
              type="button"
              onClick={() => setTranscript('')}
              className="text-[11px] text-slate-500 hover:text-red-500 cursor-pointer"
            >
              Clear Transcript
            </button>
          )}
        </div>

        <div className="relative">
          <textarea
            rows={4}
            value={transcript + (interimText ? ` [${interimText}]` : '')}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Your spoken words will appear here in real-time. You can also edit or type directly if any word is misunderstood..."
            className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-[#087FC9] transition leading-relaxed resize-y"
          />
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Tip: You can manually correct any misheard names, numbers, or symptoms in the text box above before generating the summary.
        </p>
      </div>

      {/* Analysis Error Alert with Explicit Retry Button */}
      {analysisError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-900/60 text-rose-900 dark:text-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">Clinical Analysis Notice</div>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5 leading-relaxed">{analysisError}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={handleGenerateSummary}
              disabled={isAnalyzing}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm disabled:opacity-50 active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>Retry Analysis</span>
            </button>
            <button
              type="button"
              onClick={() => setAnalysisError(null)}
              className="px-3 py-2 rounded-xl border border-rose-200 dark:border-neutral-700 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-neutral-800 transition cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Generate Summary Button */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleGenerateSummary}
          disabled={isAnalyzing || (!transcript.trim() && !interimText.trim())}
          className={`w-full sm:w-auto px-6 py-3.5 rounded-2xl font-heading font-extrabold text-sm flex items-center justify-center gap-2.5 transition cursor-pointer shadow-md ${
            isAnalyzing || (!transcript.trim() && !interimText.trim())
              ? 'bg-slate-300 dark:bg-neutral-800 text-slate-500 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-[#087FC9] to-[#0284C7] text-white hover:brightness-105 active:scale-[0.99]'
          }`}
        >
          {isAnalyzing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Analyzing Spoken Clinical Input...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Generate Summary & Structure Details</span>
            </>
          )}
        </button>
      </div>

      {/* -------------------------------------------------------------
          CONFIRMATION FORM: Extracted Structured Fields
          ------------------------------------------------------------- */}
      {structuredData && (
        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-neutral-800 space-y-6 animate-in fade-in duration-300">
          {/* Urgent Red Flag Badge if applicable */}
          {structuredData.urgent && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/60 border-2 border-red-500 text-red-700 dark:text-red-300 flex items-start gap-3 shadow-md animate-pulse">
              <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-extrabold text-base">Urgent, Inform Staff!</div>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5 leading-relaxed">
                  The spoken intake mentions critical red-flag symptoms (such as chest pain, severe breathlessness, unconsciousness, or bleeding). An Emergency priority token will be assigned.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h4 className="font-heading font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>Verify Extracted Patient Details</span>
            </h4>
            <span className="text-xs text-slate-500">Edit fields if needed before booking</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Patient Name */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Patient Full Name:
              </label>
              <input
                type="text"
                value={structuredData.name}
                onChange={(e) => setStructuredData({ ...structuredData, name: e.target.value })}
                placeholder="e.g. Ramesh Kumar"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#087FC9]"
              />
            </div>

            {/* Patient Age */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Patient Age:
              </label>
              <input
                type="number"
                min={1}
                max={120}
                value={structuredData.age}
                onChange={(e) => setStructuredData({ ...structuredData, age: e.target.value })}
                placeholder="e.g. 45"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#087FC9]"
              />
            </div>

            {/* Duration */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Symptom Duration:
              </label>
              <input
                type="text"
                value={structuredData.duration}
                onChange={(e) => setStructuredData({ ...structuredData, duration: e.target.value })}
                placeholder="e.g. 3 days, since yesterday"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#087FC9]"
              />
            </div>

            {/* Assigned OPD Doctor / Department */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Consulting Doctor:
              </label>
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#087FC9]"
              >
                {doctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name} ({doc.department} - {doc.roomNumber})
                  </option>
                ))}
              </select>
            </div>

            {/* Extracted Symptoms Tag List */}
            <div className="sm:col-span-2 space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Identified Symptoms:
              </label>
              <div className="flex flex-wrap gap-2 min-h-9 p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-900/60 border border-slate-200 dark:border-neutral-800">
                {structuredData.symptoms.map((sym, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-100 dark:bg-sky-950/70 border border-sky-300 dark:border-sky-800 text-sky-800 dark:text-sky-300 text-xs font-bold"
                  >
                    <span>{sym}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSymptom(idx)}
                      className="text-sky-600 hover:text-red-500 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}

                {structuredData.symptoms.length === 0 && (
                  <span className="text-xs text-slate-400">No specific symptoms extracted. Add one below.</span>
                )}
              </div>

              {/* Add Symptom input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSymptomInput}
                  onChange={(e) => setNewSymptomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSymptom();
                    }
                  }}
                  placeholder="Add another symptom and press Enter..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 text-xs text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleAddSymptom}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-neutral-800 hover:bg-slate-300 text-xs font-bold cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Additional Clinical Notes */}
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Clinical Context / Spoken Notes:
              </label>
              <textarea
                rows={2}
                value={structuredData.notes}
                onChange={(e) => setStructuredData({ ...structuredData, notes: e.target.value })}
                placeholder="Additional notes extracted from patient speech..."
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#087FC9]"
              />
            </div>
          </div>

          {/* Required Consent Checkbox */}
          <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-neutral-900/70 border border-sky-200 dark:border-neutral-800 flex items-start gap-3">
            <input
              id="voice-consent-checkbox"
              type="checkbox"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-[#087FC9] focus:ring-[#087FC9] cursor-pointer"
            />
            <label
              htmlFor="voice-consent-checkbox"
              className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed cursor-pointer select-none"
            >
              <strong className="text-slate-900 dark:text-white">Patient Consent Confirmation:</strong> I confirm that the patient (or attendant) has consented to hospital voice-assisted OPD registration and verified that the above symptoms and identity details are accurate.
            </label>
          </div>

          {/* Confirm & Save Button */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-neutral-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-neutral-800 transition cursor-pointer"
            >
              Cancel & Start Over
            </button>

            <button
              type="button"
              onClick={handleConfirmAndGenerateToken}
              disabled={!consentGiven}
              className={`px-8 py-3.5 rounded-2xl font-heading font-extrabold text-sm flex items-center justify-center gap-2.5 transition shadow-lg cursor-pointer ${
                consentGiven
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:brightness-105 active:scale-[0.99] shadow-emerald-600/25'
                  : 'bg-slate-300 dark:bg-neutral-800 text-slate-500 cursor-not-allowed shadow-none'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
              <span>Confirm & Generate Queue Token</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
