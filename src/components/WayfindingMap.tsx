import React, { useState } from 'react';
import { WayfindingStep } from '../types';
import { WAYFINDING_ROUTES } from '../data/mockData';
import { playHospitalChime } from '../utils/audio';
import { HospitalGoogleMap } from './HospitalGoogleMap';
import { MapsGroundingAssistant } from './MapsGroundingAssistant';

interface WayfindingMapProps {
  roomNumber: string;
  doctorName: string;
  floor: string;
  block: string;
  isEmergency?: boolean;
  onShowToast?: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
}

export const WayfindingMap: React.FC<WayfindingMapProps> = ({
  roomNumber,
  doctorName,
  floor,
  block,
  isEmergency = false,
  onShowToast,
}) => {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [activeViewMode, setActiveViewMode] = useState<'indoor' | 'gmap' | 'turnByTurn'>('indoor');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en-IN');

  const routeKey = isEmergency ? 'ER_CASUALTY' : (WAYFINDING_ROUTES[roomNumber] ? roomNumber : 'Room 204');
  const steps: WayfindingStep[] = WAYFINDING_ROUTES[routeKey] || WAYFINDING_ROUTES['Room 204'];

  const getDestinationCoords = () => {
    if (isEmergency) return { x: 380, y: 220, label: 'ER Bay 1' };
    if (roomNumber.includes('208')) return { x: 420, y: 80, label: 'Room 208' };
    if (roomNumber.includes('204')) return { x: 340, y: 80, label: 'Room 204' };
    if (roomNumber.includes('108')) return { x: 340, y: 150, label: 'Room 108' };
    if (roomNumber.includes('102')) return { x: 180, y: 220, label: 'Room 102' };
    if (roomNumber.includes('310')) return { x: 390, y: 60, label: 'Room 310' };
    return { x: 340, y: 80, label: roomNumber };
  };

  const dest = getDestinationCoords();

  const handleStopVoice = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    if (onShowToast) {
      onShowToast('Voice Stopped', 'Voice guidance playback cancelled.', 'info');
    }
  };

  const handleSpeakDirections = () => {
    if (isSpeaking) {
      handleStopVoice();
      return;
    }

    playHospitalChime();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const currentStepObj = steps.find((s) => s.stepNumber === activeStep) || steps[0];
      
      let textToSpeak = `Step ${currentStepObj.stepNumber}: ${currentStepObj.instruction}. Landmark: ${currentStepObj.landmark}. Destination is ${roomNumber}, ${doctorName}.`;

      // Multilingual speech translations for common Indian & international languages
      if (selectedLanguage.startsWith('hi')) {
        textToSpeak = `चरण ${currentStepObj.stepNumber}: ${currentStepObj.instruction}। निकटतम लैंडमार्क: ${currentStepObj.landmark}। आपका गंतव्य ${roomNumber}, ${doctorName} है।`;
      } else if (selectedLanguage.startsWith('bn')) {
        textToSpeak = `ধাপ ${currentStepObj.stepNumber}: ${currentStepObj.instruction}। ল্যান্ডমার্ক: ${currentStepObj.landmark}। গন্তব্য ${roomNumber}, ${doctorName}।`;
      } else if (selectedLanguage.startsWith('ta')) {
        textToSpeak = `படி ${currentStepObj.stepNumber}: ${currentStepObj.instruction}। அடையாளம்: ${currentStepObj.landmark}। இலக்கு ${roomNumber}, ${doctorName}।`;
      } else if (selectedLanguage.startsWith('te')) {
        textToSpeak = `దశ ${currentStepObj.stepNumber}: ${currentStepObj.instruction}. ల్యాండ్‌మార్క్: ${currentStepObj.landmark}. గమ్యం ${roomNumber}, ${doctorName}.`;
      } else if (selectedLanguage.startsWith('mr')) {
        textToSpeak = `पायरी ${currentStepObj.stepNumber}: ${currentStepObj.instruction}। लँडमार्क: ${currentStepObj.landmark}। ठिकाण ${roomNumber}, ${doctorName}।`;
      } else if (selectedLanguage.startsWith('gu')) {
        textToSpeak = `પગલું ${currentStepObj.stepNumber}: ${currentStepObj.instruction}। લેન્ડમાર્ક: ${currentStepObj.landmark}। ગંતવ્ય ${roomNumber}, ${doctorName}।`;
      } else if (selectedLanguage.startsWith('es')) {
        textToSpeak = `Paso ${currentStepObj.stepNumber}: ${currentStepObj.instruction}. Punto de referencia: ${currentStepObj.landmark}. Destino es ${roomNumber}, ${doctorName}.`;
      } else if (selectedLanguage.startsWith('ar')) {
        textToSpeak = `الخطوة ${currentStepObj.stepNumber}: ${currentStepObj.instruction}. المعلم: ${currentStepObj.landmark}. الوجهة هي ${roomNumber}، ${doctorName}.`;
      }

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = selectedLanguage;
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      // Try selecting available system voices for chosen language
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const matchingVoice = voices.find((v) => v.lang.toLowerCase().startsWith(selectedLanguage.substring(0, 2).toLowerCase()));
        if (matchingVoice) {
          utterance.voice = matchingVoice;
        }
      }

      window.speechSynthesis.speak(utterance);

      if (onShowToast) {
        onShowToast('Voice Guidance Active', textToSpeak, 'info');
      }
    }
  };

  const handleNextStep = () => {
    playHospitalChime();
    setActiveStep((prev) => (prev < steps.length ? prev + 1 : 1));
  };

  const handlePrevStep = () => {
    playHospitalChime();
    setActiveStep((prev) => (prev > 1 ? prev - 1 : steps.length));
  };

  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 sm:p-5 shadow-xs">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-3 mb-3 border-b border-[#e2e8f0] w-full box-border">
        <div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex p-1.5 rounded-lg shrink-0 ${isEmergency ? 'bg-[#fee2e2] text-[#ef4444]' : 'bg-[#e0f2fe] text-[#0ea5e9]'}`}>
              <i className={`fa-solid ${isEmergency ? 'fa-triangle-exclamation' : 'fa-map-location-dot'} text-sm`}></i>
            </span>
            <h4 className="font-bold text-[#0f172a] text-sm">
              {isEmergency ? 'Emergency Casualty Route' : 'Indoor Hospital Wayfinding'}
            </h4>
          </div>
          <p className="text-xs text-[#64748b] mt-0.5 break-words">
            Destination: <span className="font-semibold text-[#0ea5e9]">{roomNumber}</span> • {block} • {floor} ({doctorName})
          </p>
        </div>

        {/* View toggle & Voice button */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* Language Selector for Voice */}
          <div className="flex items-center gap-1 bg-[#f8fafc] px-2 py-1 rounded-lg border border-[#e2e8f0]">
            <i className="fa-solid fa-language text-[#0ea5e9] text-xs"></i>
            <select
              value={selectedLanguage}
              onChange={(e) => {
                setSelectedLanguage(e.target.value);
                if (isSpeaking) {
                  handleStopVoice();
                }
              }}
              className="text-[11px] font-semibold text-[#334155] bg-transparent border-0 focus:outline-hidden cursor-pointer"
              title="Select Voice Guidance Language"
            >
              <option value="en-IN">English (Indian)</option>
              <option value="hi-IN">हिन्दी (Hindi)</option>
              <option value="bn-IN">বাংলা (Bengali)</option>
              <option value="ta-IN">தமிழ் (Tamil)</option>
              <option value="te-IN">తెలుగు (Telugu)</option>
              <option value="mr-IN">मराठी (Marathi)</option>
              <option value="gu-IN">ગુજરાતી (Gujarati)</option>
              <option value="es-ES">Español</option>
              <option value="ar-SA">العربية (Arabic)</option>
            </select>
          </div>

          {/* Voice Speak / Stop Button */}
          {!isSpeaking ? (
            <button
              type="button"
              onClick={handleSpeakDirections}
              className="px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 border bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#334155] border-[#e2e8f0] transition cursor-pointer shrink-0"
              title="Read directions aloud"
            >
              <i className="fa-solid fa-volume-high text-[#0ea5e9]"></i>
              <span>Voice</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStopVoice}
              className="px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1.5 border bg-[#fee2e2] hover:bg-[#fecaca] text-[#dc2626] border-[#fca5a5] transition cursor-pointer shrink-0 animate-pulse"
              title="Stop voice immediately"
            >
              <i className="fa-solid fa-circle-stop text-[#dc2626]"></i>
              <span>Stop Voice</span>
            </button>
          )}

          <div className="flex items-center bg-[#f8fafc] p-1 rounded-lg border border-[#e2e8f0] text-[11px] sm:text-xs overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => {
                setActiveViewMode('indoor');
                playHospitalChime();
              }}
              className={`px-2 sm:px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeViewMode === 'indoor' ? 'bg-[#0ea5e9] text-white shadow-xs' : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              <i className="fa-solid fa-compass mr-1"></i> Indoor
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveViewMode('gmap');
                playHospitalChime();
              }}
              className={`px-2 sm:px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                activeViewMode === 'gmap' ? 'bg-[#0ea5e9] text-white shadow-xs' : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              <i className="fa-solid fa-map-location-dot text-[#38bdf8]"></i> Campus
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveViewMode('turnByTurn');
                playHospitalChime();
              }}
              className={`px-2 sm:px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeViewMode === 'turnByTurn' ? 'bg-[#0ea5e9] text-white shadow-xs' : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              <i className="fa-solid fa-list-ol mr-1"></i> Steps ({steps.length})
            </button>
          </div>
        </div>
      </div>

      {activeViewMode === 'gmap' ? (
        <HospitalGoogleMap
          initialDestination={isEmergency ? 'er' : 'opd'}
          targetRoomNumber={roomNumber}
          onShowToast={onShowToast}
          onSwitchToIndoorMap={() => setActiveViewMode('indoor')}
        />
      ) : activeViewMode === 'indoor' ? (
        <div className="space-y-3">
          {/* Hospital Floorplan SVG */}
          <div className="relative w-full aspect-[16/9] sm:aspect-[2/1] bg-[#0f172a] rounded-lg overflow-hidden border border-[#334155] p-2 shadow-inner">
            <svg viewBox="0 0 480 260" className="w-full h-full select-none">
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(51, 65, 85, 0.3)" strokeWidth="0.5" />
                </pattern>
                <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#0ea5e9" />
                </linearGradient>
              </defs>

              {/* Floor background */}
              <rect width="480" height="260" fill="#0f172a" />
              <rect width="480" height="260" fill="url(#grid)" />

              {/* Block A */}
              <rect x="30" y="30" width="160" height="100" rx="6" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
              <text x="40" y="50" fill="#94a3b8" fontSize="10" fontWeight="bold">BLOCK A - CLINICAL WING</text>
              
              {/* Room 102 */}
              <rect x="40" y="65" width="65" height="50" rx="4" fill="#0f172a" stroke="#475569" strokeWidth="1" />
              <text x="45" y="85" fill="#e2e8f0" fontSize="9" fontWeight="bold">Room 102</text>
              <text x="45" y="98" fill="#94a3b8" fontSize="7">Gen. Medicine</text>

              {/* OPD Triage */}
              <rect x="115" y="65" width="65" height="50" rx="4" fill="#0f172a" stroke="#475569" strokeWidth="1" />
              <text x="120" y="85" fill="#e2e8f0" fontSize="8" fontWeight="bold">OPD Triage</text>
              <text x="120" y="98" fill="#94a3b8" fontSize="7">& Vitals Desk</text>

              {/* Central Lobby */}
              <rect x="30" y="150" width="220" height="90" rx="6" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
              <text x="40" y="170" fill="#94a3b8" fontSize="10" fontWeight="bold">MAIN LOBBY & ADMISSION</text>
              <text x="40" y="185" fill="#38bdf8" fontSize="8">● Kiosk Check-In / Helpdesk</text>

              {/* Elevator Core */}
              <rect x="210" y="70" width="40" height="60" rx="4" fill="#1e293b" stroke="#0ea5e9" strokeWidth="1.5" strokeDasharray="3 3" />
              <text x="215" y="95" fill="#38bdf8" fontSize="8" fontWeight="bold">LIFT B</text>
              <text x="215" y="110" fill="#94a3b8" fontSize="7">To 2nd Fl</text>

              {/* Block B */}
              <rect x="270" y="30" width="190" height="120" rx="6" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
              <text x="280" y="50" fill="#94a3b8" fontSize="10" fontWeight="bold">BLOCK B - SPECIALTY OPD</text>

              {/* Room 204 */}
              <rect
                x="280"
                y="65"
                width="80"
                height="70"
                rx="4"
                fill={roomNumber === 'Room 204' ? 'rgba(14, 165, 233, 0.3)' : '#0f172a'}
                stroke={roomNumber === 'Room 204' ? '#0ea5e9' : '#475569'}
                strokeWidth={roomNumber === 'Room 204' ? '2' : '1'}
              />
              <text x="288" y="85" fill={roomNumber === 'Room 204' ? '#38bdf8' : '#e2e8f0'} fontSize="9" fontWeight="bold">
                Room 204
              </text>
              <text x="288" y="100" fill="#94a3b8" fontSize="8">Dr. A. Sharma</text>
              <text x="288" y="115" fill="#64748b" fontSize="7">Orthopedics</text>

              {/* Room 208 */}
              <rect
                x="375"
                y="65"
                width="75"
                height="70"
                rx="4"
                fill={roomNumber === 'Room 208' ? 'rgba(14, 165, 233, 0.3)' : '#0f172a'}
                stroke={roomNumber === 'Room 208' ? '#0ea5e9' : '#475569'}
                strokeWidth={roomNumber === 'Room 208' ? '2' : '1'}
              />
              <text x="382" y="85" fill={roomNumber === 'Room 208' ? '#38bdf8' : '#e2e8f0'} fontSize="9" fontWeight="bold">
                Room 208
              </text>
              <text x="382" y="100" fill="#94a3b8" fontSize="7">East Annex</text>

              {/* Diagnostic Lab */}
              <rect x="270" y="160" width="95" height="80" rx="6" fill="#132438" stroke="#0ea5e9" strokeWidth="1" />
              <text x="278" y="180" fill="#38bdf8" fontSize="9" fontWeight="bold">🔬 Diagnostic Lab</text>
              <text x="278" y="195" fill="#94a3b8" fontSize="7">Fast-Track Pre-Test</text>

              {/* ER */}
              <rect
                x="375"
                y="160"
                width="85"
                height="80"
                rx="6"
                fill={isEmergency ? 'rgba(239, 68, 68, 0.3)' : '#1e1b2e'}
                stroke={isEmergency ? '#ef4444' : '#64748b'}
                strokeWidth={isEmergency ? '2' : '1'}
              />
              <text x="383" y="180" fill={isEmergency ? '#f87171' : '#f43f5e'} fontSize="9" fontWeight="bold">
                🚨 ER Casualty
              </text>
              <text x="383" y="195" fill="#94a3b8" fontSize="7">Bay 1 Resus</text>

              {/* Route line */}
              {isEmergency ? (
                <g>
                  <path
                    d="M 120 210 L 230 210 L 375 200"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="3.5"
                    strokeDasharray="6 4"
                  />
                  <circle cx="120" cy="210" r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
                  <circle cx="375" cy="200" r="6" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
                </g>
              ) : (
                <g>
                  <path
                    d={
                      roomNumber === 'Room 208'
                        ? 'M 100 210 L 230 210 L 230 100 L 410 100'
                        : roomNumber === 'Room 102'
                        ? 'M 100 210 L 70 210 L 70 115'
                        : 'M 100 210 L 230 210 L 230 100 L 320 100'
                    }
                    fill="none"
                    stroke="url(#pathGradient)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray="8 4"
                  />
                  <circle cx="100" cy="210" r="5" fill="#0ea5e9" stroke="#ffffff" strokeWidth="2" />
                  <circle cx={dest.x} cy={dest.y} r="6" fill="#22c55e" stroke="#ffffff" strokeWidth="2" />
                  <text x={dest.x - 20} y={dest.y - 10} fill="#4ade80" fontSize="8" fontWeight="bold">
                    📍 {dest.label}
                  </text>
                </g>
              )}
            </svg>

            {/* Quick Live Wayfinding Overlay Footer */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-[#0f172a]/90 px-3 py-1.5 rounded-md border border-[#334155] text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-ping"></span>
                <span className="text-slate-200">
                  Follow <span className="text-[#38bdf8] font-semibold">Teal Navigation Path</span> to Lift B
                </span>
              </div>
              <span className="text-slate-400 font-mono text-[11px]">Est. Walk: ~1.5 mins</span>
            </div>
          </div>

          {/* Interactive Route Step Walker */}
          <div className="p-3 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] flex items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={handlePrevStep}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-[#cbd5e1] hover:bg-[#f1f5f9] text-[#334155] font-semibold flex items-center gap-1 cursor-pointer transition"
            >
              <i className="fa-solid fa-chevron-left text-[10px]"></i> Prev Step
            </button>
            <div className="text-center truncate">
              <span className="font-bold text-[#0f172a]">Step {activeStep} of {steps.length}: </span>
              <span className="text-[#0ea5e9] font-medium">{steps[activeStep - 1]?.instruction}</span>
            </div>
            <button
              type="button"
              onClick={handleNextStep}
              className="px-2.5 py-1.5 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-semibold flex items-center gap-1 cursor-pointer transition shadow-xs"
            >
              Next Step <i className="fa-solid fa-chevron-right text-[10px]"></i>
            </button>
          </div>
        </div>
      ) : (
        /* Turn-by-Turn Directions List */
        <div className="space-y-2">
          {steps.map((step) => {
            const isCurrent = step.stepNumber === activeStep;
            return (
              <div
                key={step.stepNumber}
                onClick={() => {
                  setActiveStep(step.stepNumber);
                  playHospitalChime();
                }}
                className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-3 ${
                  isCurrent
                    ? 'bg-[#e0f2fe] border-[#0ea5e9] shadow-xs'
                    : 'bg-[#f8fafc] border-[#e2e8f0] hover:bg-white'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isCurrent ? 'bg-[#0ea5e9] text-white' : 'bg-[#e2e8f0] text-[#64748b]'
                  }`}
                >
                  {step.stepNumber}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-xs font-semibold ${isCurrent ? 'text-[#0369a1]' : 'text-[#0f172a]'}`}>
                      {step.instruction}
                    </p>
                    <span className="text-[10px] text-[#64748b] font-mono shrink-0 ml-2">
                      {step.distanceMeters}m
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748b] mt-0.5 flex items-center gap-1.5">
                    <i className={`fa-solid ${step.icon} text-[#0ea5e9] text-[10px]`}></i>
                    <span>{step.landmark}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Google Maps Campus Grounding AI Assistant */}
      <div className="mt-4 pt-3 border-t border-[#e2e8f0]">
        <MapsGroundingAssistant onShowToast={onShowToast} defaultOpen={false} />
      </div>
    </div>
  );
};

