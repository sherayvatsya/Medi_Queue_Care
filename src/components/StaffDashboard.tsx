import React, { useState } from 'react';
import { Doctor, Patient, ICMRProtocol, DoctorStatus, StaffUser, StaffSection, RescheduleAudit } from '../types';
import { playHospitalChime, announceTokenVoice, playUrgentAlertSound } from '../utils/audio';
import { HospitalGoogleMap } from './HospitalGoogleMap';
import { getValidDoctorAvatar, handleDoctorImageError } from '../utils/doctorAvatar';
import { RescheduleModal } from './RescheduleModal';
import { DoctorScheduleModal } from './DoctorScheduleModal';
import { RescheduleAuditModal } from './RescheduleAuditModal';

interface StaffDashboardProps {
  doctors: Doctor[];
  patients: Patient[];
  protocols: ICMRProtocol[];
  audits?: RescheduleAudit[];
  staffUser?: StaffUser | null;
  activeSection?: StaffSection;
  onSectionChange?: (section: StaffSection) => void;
  onUpdateDoctor: (updatedDoc: Doctor) => void;
  onUpdatePatient: (updatedPatient: Patient) => void;
  onCallNextPatient: (doctorId: string) => void;
  onCompletePatient: (patientId: string) => void;
  onEscalateToER: (patientId: string) => void;
  onToggleProtocol: (protocolId: string) => void;
  onAddProtocol: (newProtocol: ICMRProtocol) => void;
  onReschedulePatient?: (
    patientId: string,
    newDate: string,
    newTime: string,
    reason: string,
    customReason?: string,
    newRoom?: string
  ) => void;
  onSaveDoctorSchedule?: (
    doctorId: string,
    newStatus: DoctorStatus,
    delayMinutes?: number,
    expectedReturnTime?: string,
    reason?: string,
    affectedAppointments?: { patientId: string; newTime: string; isIncluded: boolean }[]
  ) => void;
}

export const StaffDashboard: React.FC<StaffDashboardProps> = ({
  doctors,
  patients,
  protocols,
  audits = [],
  staffUser,
  activeSection = 'staff_dashboard',
  onSectionChange,
  onUpdateDoctor,
  onUpdatePatient,
  onCallNextPatient,
  onCompletePatient,
  onEscalateToER,
  onToggleProtocol,
  onAddProtocol,
  onReschedulePatient,
  onSaveDoctorSchedule,
}) => {
  // Filters & Local State
  const [selectedDepartment, setSelectedDepartment] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [triageFilter, setTriageFilter] = useState<string>('All');
  const [editingRoomDocId, setEditingRoomDocId] = useState<string | null>(null);
  const [newRoomInput, setNewRoomInput] = useState<string>('');
  const [showAddProtocolModal, setShowAddProtocolModal] = useState<boolean>(false);

  // Reschedule & Doctor Schedule Modals State
  const [selectedPatientForReschedule, setSelectedPatientForReschedule] = useState<Patient | null>(null);
  const [selectedDoctorForSchedule, setSelectedDoctorForSchedule] = useState<Doctor | null>(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState<boolean>(false);
  const [showDoctorScheduleModal, setShowDoctorScheduleModal] = useState<boolean>(false);
  const [showAuditLogsModal, setShowAuditLogsModal] = useState<boolean>(false);
  const [sessionGuardNotice, setSessionGuardNotice] = useState<string | null>(null);

  // New Protocol Form State
  const [newProtoDept, setNewProtoDept] = useState<string>('Orthopedics');
  const [newProtoCondition, setNewProtoCondition] = useState<string>('');
  const [newProtoCode, setNewProtoCode] = useState<string>('ICMR-CUSTOM-01');
  const [newProtoTests, setNewProtoTests] = useState<string>('');
  const [newProtoRationale, setNewProtoRationale] = useState<string>('');

  // Calculations for Telemetry Bar
  const totalWaiting = patients.filter((p) => p.status === 'waiting').length;
  const totalInConsult = patients.filter((p) => p.status === 'in_consultation').length;
  const completedToday = patients.filter((p) => p.status === 'completed').length + 38;
  const erCount = patients.filter((p) => p.triageCategory === 'urgent_er' || p.status === 'er_escalated').length;
  const labOptedCount = patients.filter((p) => p.preTestOptIn).length;
  const labOptInRate = patients.length > 0 ? Math.round((labOptedCount / patients.length) * 100) : 75;
  const pendingWheelchairs = patients.filter((p) => p.wheelchairRequest && p.wheelchairRequest.status !== 'completed');

  // Filtered Patient List
  const filteredPatients = patients.filter((p) => {
    const matchesDept = selectedDepartment === 'All' || p.department === selectedDepartment;
    const matchesTriage =
      triageFilter === 'All' ||
      (triageFilter === 'urgent_er' && (p.triageCategory === 'urgent_er' || p.status === 'er_escalated')) ||
      (triageFilter === 'fast_track_lab' && p.preTestOptIn) ||
      (triageFilter === 'waiting' && p.status === 'waiting') ||
      (triageFilter === 'in_consultation' && p.status === 'in_consultation');
    const matchesQuery =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tokenNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.uhid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.symptoms.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesDept && matchesTriage && matchesQuery;
  });

  // Handle Doctor Status Toggle
  const handleStatusChange = (doc: Doctor, newStatus: DoctorStatus) => {
    const updated: Doctor = { ...doc, status: newStatus };
    onUpdateDoctor(updated);
    playHospitalChime();
  };

  // Handle Room Override Save
  const handleSaveRoomOverride = (doc: Doctor) => {
    if (!newRoomInput.trim()) return;
    const updated: Doctor = {
      ...doc,
      roomNumber: newRoomInput.trim(),
    };
    onUpdateDoctor(updated);
    setEditingRoomDocId(null);
    setNewRoomInput('');
    playHospitalChime();
  };

  // Handle Call Next with voice
  const handleCallDoctorQueue = (doc: Doctor) => {
    onCallNextPatient(doc.id);
    const nextPatient = patients.find((p) => p.doctorId === doc.id && p.status === 'waiting');
    if (nextPatient) {
      announceTokenVoice(nextPatient.tokenNumber, doc.roomNumber, doc.name);
    } else {
      playHospitalChime();
    }
  };

  const handleAddProtocolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProtoCondition.trim() || !newProtoTests.trim()) return;

    const newProtocol: ICMRProtocol = {
      id: `icmr-${Date.now()}`,
      department: newProtoDept,
      condition: newProtoCondition,
      icmrCode: newProtoCode || `ICMR-${Date.now().toString().slice(-4)}`,
      recommendedTests: newProtoTests.split(',').map((t) => t.trim()),
      rationale: newProtoRationale || 'Standard Hospital Clinical Board diagnostic clearance.',
      timeSavedMins: 20,
      active: true,
      accuracyRate: '95.0%',
    };

    onAddProtocol(newProtocol);
    setShowAddProtocolModal(false);
    setNewProtoCondition('');
    setNewProtoTests('');
    setNewProtoRationale('');
    playHospitalChime();
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto py-1">
      {/* =========================================================================
          HOSPITAL STAFF SUB-NAVIGATION TABS (Quick in-page switcher)
          ========================================================================= */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200 shadow-xs flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        {[
          { id: 'staff_dashboard', label: 'Staff Dashboard', icon: 'fa-gauge' },
          { id: 'queue_management', label: 'Queue Management', icon: 'fa-list-check', badge: totalWaiting > 0 ? `${totalWaiting}` : undefined },
          { id: 'doctor_availability', label: 'Doctor Availability', icon: 'fa-user-doctor', badge: `${doctors.filter((d) => d.status === 'in_room').length} Active` },
          { id: 'patient_management', label: 'Patient Management', icon: 'fa-hospital-user', badge: `${patients.length}` },
          { id: 'reports', label: 'Reports & Analytics', icon: 'fa-chart-line' },
          { id: 'hospital_profile', label: 'Hospital Profile', icon: 'fa-building-columns' },
        ].map((tab) => {
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSectionChange && onSectionChange(tab.id as StaffSection)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200/70'
              }`}
            >
              <i className={`fa-solid ${tab.icon} text-xs ${isActive ? 'text-white' : 'text-sky-600'}`}></i>
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          SECTION 1: STAFF DASHBOARD (Overview, Telemetry & Real-Time Summaries)
          ========================================================================= */}
      {(activeSection === 'staff_dashboard' || !activeSection) && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Welcome & Shift Card */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 rounded-2xl p-5 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-400/30 text-sky-400 flex items-center justify-center text-xl shadow-inner shrink-0">
                <i className="fa-solid fa-hospital-user"></i>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-extrabold text-white">
                    {staffUser ? staffUser.name : 'Hospital Clinical Console'}
                  </h2>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
                    Live Duty
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  {staffUser ? `${staffUser.department} • Staff ID: ${staffUser.staffId}` : 'OPD Central Queue Authority'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onSectionChange && onSectionChange('queue_management')}
                className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <i className="fa-solid fa-list-check text-xs"></i>
                <span>Open Active Queue</span>
              </button>
              <button
                type="button"
                onClick={() => onSectionChange && onSectionChange('doctor_availability')}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-user-doctor text-xs text-sky-400"></i>
                <span>Doctor Roster</span>
              </button>
            </div>
          </div>

          {/* Telemetry Metrics Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Avg. OPD Wait</span>
                <div className="text-xl font-bold text-slate-900 font-mono mt-0.5">
                  13.8 <span className="text-xs font-normal text-slate-500">mins</span>
                </div>
                <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                  <i className="fa-solid fa-arrow-trend-down"></i> 42% faster with Pre-Labs
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-base font-bold">
                <i className="fa-solid fa-clock"></i>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Active In Queue</span>
                <div className="text-xl font-bold text-sky-600 font-mono mt-0.5">
                  {totalWaiting} <span className="text-xs font-normal text-slate-500">waiting</span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  {totalInConsult} in consultation
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center text-base font-bold">
                <i className="fa-solid fa-people-group"></i>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Lab Pre-Clearance</span>
                <div className="text-xl font-bold text-teal-600 font-mono mt-0.5">
                  {labOptInRate}%
                </div>
                <span className="text-[11px] text-teal-700 font-semibold">
                  ⚡ Fast-Track active
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center text-base font-bold">
                <i className="fa-solid fa-flask-vial"></i>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Consults Today</span>
                <div className="text-xl font-bold text-slate-900 font-mono mt-0.5">
                  {completedToday}
                </div>
                <span className="text-[11px] text-slate-500">
                  4 Specialty OPDs
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center text-base font-bold">
                <i className="fa-solid fa-clipboard-check"></i>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 col-span-2 lg:col-span-1 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] text-rose-800 font-bold uppercase tracking-wider">ER / Casualty Alerts</span>
                <div className="text-xl font-bold text-rose-600 font-mono mt-0.5">
                  {erCount} <span className="text-xs font-normal text-rose-800">diverted</span>
                </div>
                <span className="text-[11px] text-rose-700 font-semibold">
                  🚨 0 in general queue
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-base animate-pulse">
                <i className="fa-solid fa-truck-medical"></i>
              </div>
            </div>
          </div>

          {/* Quick Active Overview Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Quick Doctor Status */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <i className="fa-solid fa-user-doctor text-sky-500"></i>
                  <span>Doctor Availability Summary</span>
                </h3>
                <button
                  type="button"
                  onClick={() => onSectionChange && onSectionChange('doctor_availability')}
                  className="text-[11px] text-sky-600 font-bold hover:underline cursor-pointer"
                >
                  Manage All →
                </button>
              </div>
              <div className="space-y-2.5">
                {doctors.slice(0, 4).map((doc) => {
                  const docWaiting = patients.filter((p) => p.doctorId === doc.id && p.status === 'waiting').length;
                  return (
                    <div key={doc.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={getValidDoctorAvatar(doc.id, doc.avatar)}
                          alt={doc.name}
                          onError={(e) => handleDoctorImageError(e, doc.id)}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 bg-slate-100 shrink-0"
                        />
                        <div>
                          <div className="font-bold text-slate-900 leading-tight">{doc.name}</div>
                          <div className="text-[10px] text-slate-500">{doc.department} • <strong className="font-mono text-slate-700">{doc.roomNumber}</strong></div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          doc.status === 'in_room' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {doc.status === 'in_room' ? 'Consulting' : 'Break'}
                        </span>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{docWaiting} waiting</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Urgent / Wheelchair Queue */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <i className="fa-solid fa-wheelchair text-amber-500"></i>
                  <span>Wheelchair & Triage Alerts</span>
                </h3>
                <button
                  type="button"
                  onClick={() => onSectionChange && onSectionChange('queue_management')}
                  className="text-[11px] text-sky-600 font-bold hover:underline cursor-pointer"
                >
                  View Queue →
                </button>
              </div>

              {pendingWheelchairs.length > 0 ? (
                <div className="space-y-2">
                  {pendingWheelchairs.map((p) => (
                    <div key={p.id} className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{p.name}</span>
                          <span className="font-mono text-sky-600">#{p.tokenNumber}</span>
                        </div>
                        <div className="text-[11px] text-amber-800 font-medium mt-0.5">
                          📍 {p.wheelchairRequest?.location}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                        {p.wheelchairRequest?.status === 'requested' ? 'Porter Needed' : 'Dispatched'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <i className="fa-solid fa-circle-check text-emerald-500 text-lg mb-1 block"></i>
                  <p className="text-xs font-semibold text-slate-700">No Pending Mobility Alerts</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">All porter requests cleared.</p>
                </div>
              )}
            </div>

            {/* Live Campus Telemetry Snapshot */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <i className="fa-solid fa-map-location-dot text-sky-500"></i>
                  <span>Hospital Campus Logistics</span>
                </h3>
                <button
                  type="button"
                  onClick={() => onSectionChange && onSectionChange('reports')}
                  className="text-[11px] text-sky-600 font-bold hover:underline cursor-pointer"
                >
                  Full Map →
                </button>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Emergency Trauma Bay 1</span>
                  <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-md text-[10px]">Open & Ready</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Diagnostic Wing Block C (Pre-Labs)</span>
                  <span className="text-teal-700 font-bold bg-teal-100 px-2 py-0.5 rounded-md text-[10px]">High Throughput</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600 font-medium">P1 Visitor Parking</span>
                  <span className="text-sky-700 font-bold bg-sky-100 px-2 py-0.5 rounded-md text-[10px]">84 Bays Free</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 2: QUEUE MANAGEMENT (Active Queues, Calls, Wheelchair Dispatch)
          ========================================================================= */}
      {activeSection === 'queue_management' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center text-sm font-bold">
                  <i className="fa-solid fa-list-check"></i>
                </span>
                <h3 className="text-base font-extrabold text-slate-900">
                  Hospital Central OPD Queue Management
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time patient intake pacing, live consultation calling, porter wheelchair dispatch, and ER priority diversion.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Synced
            </span>
          </div>

          {/* Wheelchair Dispatch Banner */}
          {pendingWheelchairs.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 shadow-xs text-amber-900 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center text-base font-bold shadow-xs">
                    <i className="fa-solid fa-wheelchair"></i>
                  </span>
                  <div>
                    <h4 className="font-bold text-sm text-amber-900 flex items-center gap-2">
                      <span>EMERGENCY WHEELCHAIR DISPATCH QUEUE</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold">
                        {pendingWheelchairs.length} Pending
                      </span>
                    </h4>
                    <p className="text-xs text-amber-800">
                      Patient(s) requested mobility assistance at hospital entrance gate.
                    </p>
                  </div>
                </div>
                <span className="font-mono font-bold text-xs bg-amber-200 px-2 py-1 rounded-lg">NURSE STATION 01</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {pendingWheelchairs.map((p) => (
                  <div key={p.id} className="p-3 rounded-xl bg-white border border-amber-200 flex items-center justify-between text-xs shadow-xs">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{p.name}</span>
                        <span className="font-mono text-sky-600">#{p.tokenNumber}</span>
                      </div>
                      <div className="text-[11px] text-amber-800 font-medium mt-0.5">
                        📍 <strong>{p.wheelchairRequest?.location}</strong> • Req at {p.wheelchairRequest?.requestedAt}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {p.wheelchairRequest?.status === 'requested' ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (!p.wheelchairRequest) return;
                            onUpdatePatient({
                              ...p,
                              wheelchairRequest: {
                                ...p.wheelchairRequest,
                                status: 'dispatched',
                                dispatchedPorterName: 'Ramesh K. (Porter #04)',
                              },
                            });
                            playHospitalChime();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] transition cursor-pointer flex items-center gap-1 shadow-xs"
                        >
                          <i className="fa-solid fa-person-walking-arrow-right"></i>
                          <span>Dispatch Porter</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (!p.wheelchairRequest) return;
                            onUpdatePatient({
                              ...p,
                              wheelchairRequest: {
                                ...p.wheelchairRequest,
                                status: 'completed',
                              },
                            });
                            playHospitalChime();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] transition cursor-pointer flex items-center gap-1 shadow-xs"
                        >
                          <i className="fa-solid fa-circle-check"></i>
                          <span>Mark Arrived</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search & Department Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-3 text-slate-400 text-xs"></i>
                <input
                  type="text"
                  placeholder="Search patient name, token #, or UHID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs focus:outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
                />
              </div>
            </div>

            {/* Department Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              {['All', 'Orthopedics', 'Cardiology', 'General Medicine', 'Pulmonology'].map((dept) => (
                <button
                  key={dept}
                  onClick={() => setSelectedDepartment(dept)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                    selectedDepartment === dept
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>
          </div>

          {/* Patient Queue Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-3 px-3.5">Token</th>
                  <th className="py-3 px-3.5">Patient Name</th>
                  <th className="py-3 px-3.5">Triage & Complaints</th>
                  <th className="py-3 px-3.5">Pre-Test</th>
                  <th className="py-3 px-3.5">Room</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredPatients.map((pat) => {
                  const isCurrent = pat.status === 'in_consultation';
                  const isER = pat.triageCategory === 'urgent_er' || pat.status === 'er_escalated';
                  const hasWheelchair = pat.wheelchairRequest && pat.wheelchairRequest.status !== 'completed';

                  return (
                    <tr
                      key={pat.id}
                      className={`hover:bg-slate-50/80 transition ${
                        isCurrent
                          ? 'bg-emerald-50/50'
                          : isER
                          ? 'bg-rose-50/60'
                          : hasWheelchair
                          ? 'bg-amber-50/40'
                          : ''
                      }`}
                    >
                      {/* Token */}
                      <td className="py-3 px-3.5">
                        <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                          #{pat.tokenNumber}
                        </span>
                      </td>

                      {/* Name & UHID */}
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{pat.name}</span>
                          {hasWheelchair && (
                            <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold">
                              <i className="fa-solid fa-wheelchair"></i> WHEELCHAIR
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {pat.age}y • {pat.gender} • {pat.uhid}
                        </div>
                        {pat.allergiesText && (
                          <div className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-0.5">
                            <i className="fa-solid fa-shield-virus"></i>
                            <span>Allergies: {pat.allergiesText}</span>
                          </div>
                        )}
                      </td>

                      {/* Triage Class & Symptoms */}
                      <td className="py-3 px-3.5 max-w-[220px]">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                            pat.triageCategory === 'urgent_er'
                              ? 'bg-rose-100 text-rose-800'
                              : pat.triageCategory === 'fast_track_lab'
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {pat.triageCategory === 'urgent_er' ? 'Urgent (ER)' : pat.department}
                        </span>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {pat.symptoms.join(', ')}
                        </p>
                      </td>

                      {/* Pre-Test Status */}
                      <td className="py-3 px-3.5">
                        {pat.preTestOptIn ? (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                              pat.preTestStatus === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            <i className={`fa-solid ${pat.preTestStatus === 'completed' ? 'fa-check' : 'fa-spinner fa-spin'} text-[9px]`}></i>
                            {pat.preTestStatus === 'completed' ? 'COMPLETED' : 'WAITING'}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">NONE</span>
                        )}
                      </td>

                      {/* Assigned Room */}
                      <td className="py-3 px-3.5">
                        <span className="font-bold text-slate-900 block font-mono">
                          {pat.roomNumber}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {pat.doctorName}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3.5">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
                            pat.status === 'in_consultation'
                              ? 'bg-emerald-100 text-emerald-800'
                              : pat.status === 'completed'
                              ? 'bg-slate-100 text-slate-600'
                              : pat.status === 'er_escalated'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {pat.status === 'in_consultation' ? 'IN SESSION' : pat.status.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {pat.status === 'waiting' && (
                            <button
                              onClick={() => {
                                onUpdatePatient({
                                  ...pat,
                                  status: 'in_consultation',
                                  calledAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                });
                                announceTokenVoice(pat.tokenNumber, pat.roomNumber, pat.doctorName);
                              }}
                              className="px-3 py-1 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition cursor-pointer"
                              title="Call this patient into consultation room"
                            >
                              <i className="fa-solid fa-bullhorn text-[10px]"></i>
                              <span>Call Next</span>
                            </button>
                          )}

                          {pat.status === 'in_consultation' && (
                            <button
                              onClick={() => onCompletePatient(pat.id)}
                              className="px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition cursor-pointer"
                            >
                              <i className="fa-solid fa-check text-[10px]"></i>
                              <span>Finish</span>
                            </button>
                          )}

                          {pat.status !== 'er_escalated' && pat.status !== 'completed' && (
                            <button
                              onClick={() => onEscalateToER(pat.id)}
                              className="px-2.5 py-1 rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50 text-xs font-bold transition cursor-pointer"
                              title="Immediately transfer to Emergency"
                            >
                              Escalate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 3: DOCTOR AVAILABILITY (Roster, Matrix & Room Override)
          ========================================================================= */}
      {activeSection === 'doctor_availability' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center text-sm font-bold">
                  <i className="fa-solid fa-user-doctor"></i>
                </span>
                <h3 className="text-base font-extrabold text-slate-900">
                  Doctor Availability Matrix & Real-Time Room Override
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Control active consultation states, queue pacing, and room reassignments (auto-syncs to patient wayfinding in real time).
              </p>
            </div>

            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              Live Broadcast Active
            </span>
          </div>

          {/* Doctor Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {doctors.map((doc) => {
              const docQueue = patients.filter((p) => p.doctorId === doc.id && p.status === 'waiting');
              const isEditingThisRoom = editingRoomDocId === doc.id;
              const isConsulting = doc.status === 'in_room';

              return (
                <div
                  key={doc.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-sky-300 transition-all flex flex-col justify-between shadow-xs"
                >
                  <div>
                    {/* Doctor Profile Top */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={getValidDoctorAvatar(doc.id, doc.avatar)}
                          alt={doc.name}
                          onError={(e) => handleDoctorImageError(e, doc.id)}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 bg-slate-100 shrink-0"
                        />
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 leading-tight">
                            {doc.name}
                          </h4>
                          <span className="text-[11px] text-sky-600 font-medium block">
                            {doc.specialty}
                          </span>
                        </div>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        doc.status === 'in_room'
                          ? 'bg-emerald-100 text-emerald-800'
                          : doc.status === 'on_break'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {doc.status === 'in_room' ? 'Active' : doc.status === 'on_break' ? 'Break' : 'Shifted'}
                      </span>
                    </div>

                    {/* Room Number with Override Feature */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 my-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-500 font-medium">Consultation Room</span>
                        {!isEditingThisRoom ? (
                          <button
                            onClick={() => {
                              setEditingRoomDocId(doc.id);
                              setNewRoomInput(doc.roomNumber);
                            }}
                            className="text-[11px] text-sky-600 hover:text-sky-700 font-bold flex items-center gap-1 transition cursor-pointer"
                            title="Override Doctor Room Number"
                          >
                            <i className="fa-solid fa-pen-to-square"></i> Shift Room
                          </button>
                        ) : null}
                      </div>

                      {isEditingThisRoom ? (
                        <div className="mt-2 flex items-center gap-1.5">
                          <input
                            type="text"
                            value={newRoomInput}
                            onChange={(e) => setNewRoomInput(e.target.value)}
                            placeholder="e.g. Room 208"
                            className="w-full px-2.5 py-1 rounded-lg bg-white border border-sky-500 text-xs text-slate-900 focus:outline-hidden font-bold"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveRoomOverride(doc)}
                            className="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shrink-0 cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingRoomDocId(null)}
                            className="px-2 py-1 rounded-lg bg-slate-200 text-slate-700 text-xs shrink-0 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-sm font-bold text-slate-900 font-mono">
                            {doc.roomNumber}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {doc.opdBlock} • {doc.floor}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Status Switcher Toggles */}
                    <div className="my-2.5 flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[11px]">
                        <span className="font-bold text-slate-900 block">
                          {isConsulting ? 'In Room / Consulting' : 'On Break / Paused'}
                        </span>
                        <span className="text-slate-500 text-[10px]">
                          {isConsulting ? `Serving Token #${doc.currentPatientToken || 'Ready'}` : 'Pacing paused'}
                        </span>
                      </div>

                      <div
                        onClick={() => handleStatusChange(doc, isConsulting ? 'on_break' : 'in_room')}
                        className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors ${
                          isConsulting ? 'bg-sky-500' : 'bg-slate-300'
                        }`}
                        title="Toggle Active / Break state"
                      >
                        <span
                          className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-transform shadow-xs ${
                            isConsulting ? 'left-[19px]' : 'left-[3px]'
                          }`}
                        ></span>
                      </div>
                    </div>

                    {/* Queue Metrics */}
                    <div className="flex items-center justify-between text-xs py-1 border-t border-slate-100 text-slate-500">
                      <span>Queue: <strong className="text-sky-600">{docQueue.length} Waiting</strong></span>
                      <span>Done: <strong className="text-slate-900">{doc.todayConsultedCount}</strong></span>
                    </div>
                  </div>

                  {/* Call Next Button for this doctor */}
                  <div className="mt-3 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleCallDoctorQueue(doc)}
                      disabled={docQueue.length === 0}
                      className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                        docQueue.length > 0
                          ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                      }`}
                    >
                      <i className="fa-solid fa-bullhorn text-xs"></i>
                      <span>Call Next ({docQueue[0]?.tokenNumber || 'None'})</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 4: PATIENT MANAGEMENT (EHR Registry, Triage Records, Search)
          ========================================================================= */}
      {activeSection === 'patient_management' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center text-sm font-bold">
                  <i className="fa-solid fa-hospital-user"></i>
                </span>
                <h3 className="text-base font-extrabold text-slate-900">
                  Patient Health Records & Triage Registry
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete diagnostic registry, patient allergies, pre-test opt-in tracking, and clinical consultation history.
              </p>
            </div>
            <div className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              Total Registered: <strong>{patients.length} Patients</strong>
            </div>
          </div>

          {/* Search and Triage Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-slate-400 text-xs"></i>
              <input
                type="text"
                placeholder="Search by Patient Name, UHID, Symptoms, or Token #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
            <div>
              <select
                value={triageFilter}
                onChange={(e) => setTriageFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-hidden focus:border-sky-500 cursor-pointer"
              >
                <option value="All">All Triage Categories</option>
                <option value="waiting">Waiting Only</option>
                <option value="in_consultation">In Session Only</option>
                <option value="fast_track_lab">Fast-Track Lab Opt-ins</option>
                <option value="urgent_er">Urgent ER Only</option>
              </select>
            </div>
          </div>

          {/* Patient Cards List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPatients.map((pat) => (
              <div key={pat.id} className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-sky-300 transition-all shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-extrabold text-slate-900">{pat.name}</h4>
                      <span className="font-mono text-xs font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                        #{pat.tokenNumber}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      {pat.age} yrs • {pat.gender} • UHID: {pat.uhid}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
                    pat.status === 'in_consultation'
                      ? 'bg-emerald-100 text-emerald-800'
                      : pat.status === 'completed'
                      ? 'bg-slate-100 text-slate-600'
                      : pat.status === 'er_escalated'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {pat.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Clinical Symptoms & Notes */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                  <div className="text-slate-600 font-semibold">Chief Symptoms:</div>
                  <div className="flex flex-wrap gap-1">
                    {pat.symptoms.map((sym, idx) => (
                      <span key={idx} className="bg-white border border-slate-200 px-2 py-0.5 rounded-md text-[11px] text-slate-700 font-medium">
                        {sym}
                      </span>
                    ))}
                  </div>
                  {pat.allergiesText && (
                    <div className="text-rose-600 text-[11px] font-bold pt-1 flex items-center gap-1">
                      <i className="fa-solid fa-triangle-exclamation"></i>
                      <span>Allergies: {pat.allergiesText}</span>
                    </div>
                  )}
                </div>

                {/* Assigned OPD Room & Contact */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 text-slate-600">
                  <div>
                    <span className="text-slate-400">Assigned: </span>
                    <strong className="text-slate-800">{pat.doctorName}</strong> ({pat.roomNumber})
                  </div>
                  <div className="font-mono text-slate-500">{pat.phone}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 5: REPORTS & ANALYTICS (OPD Bottlenecks, ICMR Rules, Campus Maps)
          ========================================================================= */}
      {activeSection === 'reports' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Diagnostic Protocols Management */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <i className="fa-solid fa-microscope text-sky-500"></i>
                  <span>Pre-Approved ICMR Diagnostic Protocols</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rules governing preliminary test recommendations in the patient AI triage flow to slash consultation waiting times.
                </p>
              </div>

              <button
                onClick={() => setShowAddProtocolModal(true)}
                className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <i className="fa-solid fa-plus"></i> Add Protocol
              </button>
            </div>

            {/* Protocols List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {protocols.map((proto) => (
                <div
                  key={proto.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    proto.active
                      ? 'bg-white border-slate-300 shadow-xs'
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                          {proto.department}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">
                          {proto.icmrCode}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 mt-1.5">
                        {proto.condition}
                      </h4>
                    </div>

                    <div
                      onClick={() => onToggleProtocol(proto.id)}
                      className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors ${
                        proto.active ? 'bg-sky-500' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-transform ${
                          proto.active ? 'left-[19px]' : 'left-[3px]'
                        }`}
                      ></span>
                    </div>
                  </div>

                  <div className="my-3 space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                      Triggered Pre-Consultation Labs:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {proto.recommendedTests.map((t, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-medium"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    {proto.rationale}
                  </p>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
                    <span className="text-emerald-700 font-bold">
                      ⚡ Saves ~{proto.timeSavedMins} mins / patient
                    </span>
                    <span className="text-slate-500">
                      Accuracy: {proto.accuracyRate}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Google Maps Campus Logistics */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center text-sm font-bold">
                    <i className="fa-solid fa-map-location-dot"></i>
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Hospital Campus & Ambulance Logistics Gateway
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time campus logistics, ambulance trauma bay routing, visitor parking levels, and emergency supply telemetry.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                Google Maps Live Telemetry
              </span>
            </div>

            <HospitalGoogleMap initialDestination="er" />
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 6: HOSPITAL PROFILE (Institutional Credentials, Staff On Duty)
          ========================================================================= */}
      {activeSection === 'hospital_profile' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center text-2xl shadow-md">
                <i className="fa-solid fa-hospital"></i>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                    {staffUser?.hospitalName || 'Max Super Specialty Hospital, Mohali'}
                  </h2>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    NABH Accredited
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tertiary Care & Super-Specialty Medical Institute • License: DL-HOSP-2026-9812
                </p>
              </div>
            </div>

            <div className="text-right text-xs font-mono text-slate-500">
              <div>OPD Blocks: A, B, C, D</div>
              <div className="text-emerald-600 font-bold">24x7 Casualty Active</div>
            </div>
          </div>

          {/* Active Logged-in Staff Admin Security Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-sky-950 text-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300">
                Active Staff Session
              </span>
              <span className="text-xs font-mono text-slate-300">Security Clearance Level 4</span>
            </div>
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-sky-500/20 border border-sky-400/30 text-sky-300 flex items-center justify-center text-xl shrink-0">
                <i className="fa-solid fa-user-shield"></i>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{staffUser ? staffUser.name : 'Dr. Alok Verma'}</h3>
                <p className="text-xs text-slate-300">{staffUser ? staffUser.department : 'OPD Administration & Clinical Operations'}</p>
                <div className="text-[11px] font-mono text-sky-400 mt-0.5">
                  Staff ID: {staffUser ? staffUser.staffId : 'MQ-STAFF-8801'} • Role: {staffUser ? staffUser.role.toUpperCase() : 'ADMIN'}
                </div>
              </div>
            </div>
          </div>

          {/* Facility Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-bold text-slate-800 block mb-1">Clinical Specialties</span>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>• General Medicine & Primary Care</li>
                <li>• Orthopedics & Joint Replacement</li>
                <li>• Cardiology & Interventional Cath Lab</li>
                <li>• Pulmonology & Respiratory Care</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-bold text-slate-800 block mb-1">Emergency Protocols</span>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>• Code RED: Trauma Casualty Bay</li>
                <li>• Code BLUE: Cardiac Resuscitation</li>
                <li>• Fast-Track Lab Pre-Clearance</li>
                <li>• On-Demand Wheelchair Porters</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-bold text-slate-800 block mb-1">Hospital Contacts</span>
              <div className="text-xs text-slate-600 space-y-1 font-mono">
                <div>Emergency: 102 / +91 11 2659 8888</div>
                <div>OPD Desk: +91 11 2659 8800</div>
                <div>IT & Admin: hospital@mediqueue.com</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD PROTOCOL MODAL */}
      {showAddProtocolModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">
                Add Pre-Approved ICMR Diagnostic Protocol
              </h3>
              <button
                onClick={() => setShowAddProtocolModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddProtocolSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">OPD Department</label>
                <select
                  value={newProtoDept}
                  onChange={(e) => setNewProtoDept(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-sky-500"
                >
                  <option value="Orthopedics">Orthopedics</option>
                  <option value="Cardiology">Cardiology</option>
                  <option value="General Medicine">General Medicine</option>
                  <option value="Pulmonology">Pulmonology</option>
                  <option value="Gastroenterology">Gastroenterology</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Clinical Condition / Trigger Rule</label>
                <input
                  type="text"
                  placeholder="e.g. Acute Epigastric Pain with Nausea"
                  value={newProtoCondition}
                  onChange={(e) => setNewProtoCondition(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">ICMR / Protocol Reference Code</label>
                <input
                  type="text"
                  value={newProtoCode}
                  onChange={(e) => setNewProtoCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-hidden font-mono focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Recommended Tests (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Serum Amylase, Ultrasound Abdomen, CBC"
                  value={newProtoTests}
                  onChange={(e) => setNewProtoTests(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Clinical Rationale & Time Benefit</label>
                <textarea
                  placeholder="Explains why pre-ordering this before consultation speeds diagnosis..."
                  value={newProtoRationale}
                  onChange={(e) => setNewProtoRationale(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-hidden h-16 focus:border-sky-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddProtocolModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold cursor-pointer shadow-xs"
                >
                  Save Protocol
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
