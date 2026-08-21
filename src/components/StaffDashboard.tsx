import React, { useState } from 'react';
import { Doctor, Patient, ICMRProtocol, DoctorStatus } from '../types';
import { playHospitalChime, announceTokenVoice } from '../utils/audio';
import { HospitalGoogleMap } from './HospitalGoogleMap';

interface StaffDashboardProps {
  doctors: Doctor[];
  patients: Patient[];
  protocols: ICMRProtocol[];
  onUpdateDoctor: (updatedDoc: Doctor) => void;
  onUpdatePatient: (updatedPatient: Patient) => void;
  onCallNextPatient: (doctorId: string) => void;
  onCompletePatient: (patientId: string) => void;
  onEscalateToER: (patientId: string) => void;
  onToggleProtocol: (protocolId: string) => void;
  onAddProtocol: (newProtocol: ICMRProtocol) => void;
}

export const StaffDashboard: React.FC<StaffDashboardProps> = ({
  doctors,
  patients,
  protocols,
  onUpdateDoctor,
  onUpdatePatient,
  onCallNextPatient,
  onCompletePatient,
  onEscalateToER,
  onToggleProtocol,
  onAddProtocol,
}) => {
  // Filters & State
  const [selectedDepartment, setSelectedDepartment] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingRoomDocId, setEditingRoomDocId] = useState<string | null>(null);
  const [newRoomInput, setNewRoomInput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'queue' | 'doctors' | 'protocols' | 'campus_dispatch'>('queue');
  const [showAddProtocolModal, setShowAddProtocolModal] = useState<boolean>(false);

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

  // Filtered Patient List
  const filteredPatients = patients.filter((p) => {
    const matchesDept = selectedDepartment === 'All' || p.department === selectedDepartment;
    const matchesQuery =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tokenNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.uhid.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDept && matchesQuery;
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
      {/* OPD TELEMETRY & BOTTLENECK BAR */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-white border border-[#e2e8f0] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[#64748b] font-semibold uppercase tracking-wider">Avg. OPD Wait</span>
            <div className="text-xl font-bold text-[#0f172a] font-mono mt-0.5">
              13.8 <span className="text-xs font-normal text-[#64748b]">mins</span>
            </div>
            <span className="text-[11px] text-[#166534] font-semibold flex items-center gap-1 mt-0.5">
              <i className="fa-solid fa-arrow-trend-down"></i> 42% faster with Pre-Labs
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#dcfce7] text-[#166534] flex items-center justify-center text-base font-bold">
            <i className="fa-solid fa-clock"></i>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#e2e8f0] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[#64748b] font-semibold uppercase tracking-wider">Active In Queue</span>
            <div className="text-xl font-bold text-[#0ea5e9] font-mono mt-0.5">
              {totalWaiting} <span className="text-xs font-normal text-[#64748b]">waiting</span>
            </div>
            <span className="text-[11px] text-[#64748b] font-medium">
              {totalInConsult} in consultation
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#e0f2fe] text-[#0369a1] flex items-center justify-center text-base font-bold">
            <i className="fa-solid fa-people-group"></i>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#e2e8f0] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[#64748b] font-semibold uppercase tracking-wider">Lab Pre-Clearance</span>
            <div className="text-xl font-bold text-[#0d9488] font-mono mt-0.5">
              {labOptInRate}%
            </div>
            <span className="text-[11px] text-[#0d9488] font-semibold">
              ⚡ Fast-Track active
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#ccfbf1] text-[#0f766e] flex items-center justify-center text-base font-bold">
            <i className="fa-solid fa-flask-vial"></i>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#e2e8f0] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[#64748b] font-semibold uppercase tracking-wider">Consults Today</span>
            <div className="text-xl font-bold text-[#0f172a] font-mono mt-0.5">
              {completedToday}
            </div>
            <span className="text-[11px] text-[#64748b]">
              4 Specialty OPDs
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#f1f5f9] text-[#475569] flex items-center justify-center text-base font-bold">
            <i className="fa-solid fa-clipboard-check"></i>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#fff1f2] border border-[#fecdd3] col-span-2 lg:col-span-1 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[#9f1239] font-semibold uppercase tracking-wider">ER / Casualty Alerts</span>
            <div className="text-xl font-bold text-[#e11d48] font-mono mt-0.5">
              {erCount} <span className="text-xs font-normal text-[#9f1239]">diverted</span>
            </div>
            <span className="text-[11px] text-[#be123c] font-semibold">
              🚨 0 in general queue
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#fee2e2] text-[#991b1b] flex items-center justify-center text-base animate-pulse">
            <i className="fa-solid fa-truck-medical"></i>
          </div>
        </div>
      </div>

      {/* MODULE 1: DOCTOR AVAILABILITY MATRIX & REAL-TIME ROOM OVERRIDE */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e2e8f0]">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[#e0f2fe] text-[#0ea5e9] flex items-center justify-center text-sm font-bold">
                <i className="fa-solid fa-user-doctor"></i>
              </span>
              <h3 className="text-base font-bold text-[#0f172a]">
                Doctor Availability Matrix & Real-Time Room Override
              </h3>
            </div>
            <p className="text-xs text-[#64748b] mt-0.5">
              Control doctor active states, live queue pacing, and room reassignments (auto-syncs to patient wayfinding maps in real time).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="badge badge-green">
              <span className="w-1.5 h-1.5 rounded-full bg-[#166534] animate-ping"></span>
              Live Sync Broadcast Active
            </span>
          </div>
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
                className="p-4 rounded-xl border border-[#e2e8f0] bg-white hover:border-[#cbd5e1] transition-all flex flex-col justify-between shadow-xs"
              >
                <div>
                  {/* Doctor Profile Top */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={doc.avatar}
                        alt={doc.name}
                        className="w-10 h-10 rounded-full object-cover border border-[#e2e8f0]"
                      />
                      <div>
                        <h4 className="text-sm font-bold text-[#0f172a] leading-tight">
                          {doc.name}
                        </h4>
                        <span className="text-xs text-[#0ea5e9] font-medium block">
                          {doc.specialty}
                        </span>
                      </div>
                    </div>

                    {/* Quick status badge */}
                    <span className={doc.status === 'in_room' ? 'badge badge-green' : doc.status === 'on_break' ? 'badge badge-amber' : 'badge badge-slate'}>
                      {doc.status === 'in_room' ? 'Active' : doc.status === 'on_break' ? 'Break' : 'Shifted'}
                    </span>
                  </div>

                  {/* Room Number with Override Feature */}
                  <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] my-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] text-[#64748b] font-medium">Consultation Room</span>
                      {!isEditingThisRoom ? (
                        <button
                          onClick={() => {
                            setEditingRoomDocId(doc.id);
                            setNewRoomInput(doc.roomNumber);
                          }}
                          className="text-[11px] text-[#0ea5e9] hover:text-[#0369a1] font-semibold flex items-center gap-1 transition cursor-pointer"
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
                          className="w-full px-2.5 py-1 rounded-md bg-white border border-[#0ea5e9] text-xs text-[#0f172a] focus:outline-none font-bold"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveRoomOverride(doc)}
                          className="px-2.5 py-1 rounded-md bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-xs font-bold shrink-0 cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingRoomDocId(null)}
                          className="px-2 py-1 rounded-md bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] text-xs shrink-0 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm font-bold text-[#0f172a] font-mono">
                          {doc.roomNumber}
                        </span>
                        <span className="text-[11px] text-[#64748b]">
                          {doc.opdBlock} • {doc.floor}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Status Switcher Toggles (Professional Polish switch style) */}
                  <div className="my-2.5 flex items-center justify-between p-2 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                    <div className="text-[11px]">
                      <span className="font-semibold text-[#0f172a] block">
                        {isConsulting ? 'In Room / Consulting' : 'On Break / Paused'}
                      </span>
                      <span className="text-[#64748b] text-[10px]">
                        {isConsulting ? `Serving Token #${doc.currentPatientToken || 'Ready'}` : 'Pacing paused'}
                      </span>
                    </div>

                    {/* Smooth Toggle button as requested in theme */}
                    <div
                      onClick={() => handleStatusChange(doc, isConsulting ? 'on_break' : 'in_room')}
                      className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors ${
                        isConsulting ? 'bg-[#0ea5e9]' : 'bg-[#cbd5e1]'
                      }`}
                      title="Toggle Active / Break state"
                    >
                      <span
                        className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-transform ${
                          isConsulting ? 'left-[19px]' : 'left-[3px]'
                        }`}
                      ></span>
                    </div>
                  </div>

                  {/* Queue Metrics */}
                  <div className="flex items-center justify-between text-xs py-1 border-t border-[#e2e8f0] text-[#64748b]">
                    <span>Queue: <strong className="text-[#0ea5e9]">{docQueue.length} Waiting</strong></span>
                    <span>Done: <strong className="text-[#0f172a]">{doc.todayConsultedCount}</strong></span>
                  </div>
                </div>

                {/* Call Next Button for this doctor */}
                <div className="mt-3 pt-2 border-t border-[#e2e8f0]">
                  <button
                    onClick={() => handleCallDoctorQueue(doc)}
                    disabled={docQueue.length === 0}
                    className={`w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                      docQueue.length > 0
                        ? 'bg-[#0ea5e9] hover:bg-[#0284c7] text-white shadow-xs'
                        : 'bg-[#f1f5f9] text-[#94a3b8] cursor-not-allowed border border-[#e2e8f0]'
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

      {/* TABS SELECTOR: OPD QUEUE vs ICMR PROTOCOL MANAGER */}
      <div className="flex items-center gap-2 border-b border-[#e2e8f0] pb-2">
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'queue'
              ? 'bg-[#0ea5e9] text-white shadow-xs'
              : 'text-[#64748b] hover:text-[#0f172a] bg-white border border-[#e2e8f0]'
          }`}
        >
          <i className="fa-solid fa-list-check"></i>
          <span>OPD Active Queue ({patients.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('protocols')}
          className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'protocols'
              ? 'bg-[#0ea5e9] text-white shadow-xs'
              : 'text-[#64748b] hover:text-[#0f172a] bg-white border border-[#e2e8f0]'
          }`}
        >
          <i className="fa-solid fa-microscope"></i>
          <span>ICMR Diagnostic Protocols ({protocols.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('campus_dispatch')}
          className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'campus_dispatch'
              ? 'bg-[#0ea5e9] text-white shadow-xs'
              : 'text-[#64748b] hover:text-[#0f172a] bg-white border border-[#e2e8f0]'
          }`}
        >
          <i className="fa-solid fa-map-location-dot text-[#38bdf8]"></i>
          <span>Campus & Ambulance Dispatch (Google Maps)</span>
        </button>
      </div>

      {/* TAB 1: OPD ACTIVE QUEUE TABLE */}
      {activeTab === 'queue' && (
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 shadow-sm space-y-4">
          {/* REQUIREMENT #10: WHEELCHAIR ASSISTANCE DISPATCH ALERT BANNER */}
          {patients.some((p) => p.wheelchairRequest && p.wheelchairRequest.status !== 'completed') && (
            <div className="p-4 rounded-xl bg-[#fef3c7] border-2 border-[#f59e0b] shadow-xs text-[#92400e] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-[#f59e0b] text-white flex items-center justify-center text-base font-bold shadow-xs">
                    <i className="fa-solid fa-wheelchair"></i>
                  </span>
                  <div>
                    <h4 className="font-bold text-sm text-[#92400e] flex items-center gap-2">
                      <span>EMERGENCY WHEELCHAIR DISPATCH QUEUE</span>
                      <span className="badge badge-amber text-[10px]">
                        {patients.filter((p) => p.wheelchairRequest && p.wheelchairRequest.status !== 'completed').length} Pending
                      </span>
                    </h4>
                    <p className="text-xs text-[#b45309]">
                      Patient(s) requested mobility assistance at hospital entrance gate.
                    </p>
                  </div>
                </div>
                <span className="badge badge-amber font-mono font-bold">NURSE STATION 01</span>
              </div>

              {/* List of active wheelchair requests */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {patients
                  .filter((p) => p.wheelchairRequest && p.wheelchairRequest.status !== 'completed')
                  .map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-lg bg-white border border-[#fde68a] flex items-center justify-between text-xs shadow-xs"
                    >
                      <div>
                        <div className="font-bold text-[#0f172a] flex items-center gap-1.5">
                          <span>{p.name}</span>
                          <span className="font-mono text-[#0ea5e9]">#{p.tokenNumber}</span>
                        </div>
                        <div className="text-[11px] text-[#92400e] font-medium mt-0.5">
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
                            className="px-2.5 py-1 rounded-md bg-[#f59e0b] hover:bg-[#d97706] text-white font-bold text-[11px] transition cursor-pointer flex items-center gap-1"
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
                            className="px-2.5 py-1 rounded-md bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold text-[11px] transition cursor-pointer flex items-center gap-1"
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

          {/* Table Filters & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-[#94a3b8] text-xs"></i>
                <input
                  type="text"
                  placeholder="Search patient name, token #, or UHID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white border border-[#e2e8f0] text-[#0f172a] placeholder-[#94a3b8] text-xs focus:outline-hidden focus:border-[#0ea5e9]"
                />
              </div>
            </div>

            {/* Department Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              {['All', 'Orthopedics', 'Cardiology', 'General Medicine', 'Pulmonology'].map((dept) => (
                <button
                  key={dept}
                  onClick={() => setSelectedDepartment(dept)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap cursor-pointer ${
                    selectedDepartment === dept
                      ? 'bg-[#0ea5e9] text-white'
                      : 'bg-[#f8fafc] text-[#64748b] hover:text-[#0f172a] border border-[#e2e8f0]'
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>
          </div>

          {/* Patient Queue Table */}
          <div className="overflow-x-auto rounded-lg border border-[#e2e8f0]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] text-[#334155] font-semibold border-b border-[#e2e8f0]">
                  <th className="py-3 px-3.5">Token</th>
                  <th className="py-3 px-3.5">Patient Name</th>
                  <th className="py-3 px-3.5">Triage & Complaints</th>
                  <th className="py-3 px-3.5">Pre-Test</th>
                  <th className="py-3 px-3.5">Room</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0] bg-white">
                {filteredPatients.map((pat) => {
                  const isCurrent = pat.status === 'in_consultation';
                  const isER = pat.triageCategory === 'urgent_er' || pat.status === 'er_escalated';
                  const hasWheelchair = pat.wheelchairRequest && pat.wheelchairRequest.status !== 'completed';

                  return (
                    <tr
                      key={pat.id}
                      className={`hover:bg-[#f8fafc] transition ${
                        isCurrent
                          ? 'bg-[#f0fdf4]'
                          : isER
                          ? 'bg-[#fff1f2]'
                          : hasWheelchair
                          ? 'bg-[#fffbeb]'
                          : ''
                      }`}
                    >
                      {/* Token */}
                      <td className="py-3 px-3.5">
                        <span className="font-mono font-bold text-xs text-[#0f172a] bg-[#f1f5f9] px-2 py-1 rounded border border-[#e2e8f0]">
                          #{pat.tokenNumber}
                        </span>
                      </td>

                      {/* Name & UHID */}
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-[#0f172a] flex items-center gap-1.5">
                          <span>{pat.name}</span>
                          {hasWheelchair && (
                            <span className="badge badge-amber text-[9px]">
                              <i className="fa-solid fa-wheelchair"></i>
                              WHEELCHAIR REQUESTED
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#64748b] font-mono">
                          {pat.age}y • {pat.gender} • {pat.uhid}
                        </div>
                        {pat.allergiesText && (
                          <div className="text-[10px] text-[#ef4444] font-semibold flex items-center gap-1 mt-0.5">
                            <i className="fa-solid fa-shield-virus"></i>
                            <span>Allergies: {pat.allergiesText}</span>
                          </div>
                        )}
                      </td>

                      {/* Triage Class & Symptoms */}
                      <td className="py-3 px-3.5 max-w-[220px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={
                              pat.triageCategory === 'urgent_er'
                                ? 'badge badge-red'
                                : pat.triageCategory === 'fast_track_lab'
                                ? 'badge badge-teal'
                                : 'badge badge-amber'
                            }
                          >
                            {pat.triageCategory === 'urgent_er' ? 'Urgent (Chest)' : pat.department}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#64748b] truncate mt-0.5">
                          {pat.symptoms.join(', ')}
                        </p>
                        {pat.otherSymptomsText && (
                          <p className="text-[10px] text-[#0ea5e9] italic truncate">
                            Note: {pat.otherSymptomsText}
                          </p>
                        )}
                      </td>

                      {/* Pre-Test Status */}
                      <td className="py-3 px-3.5">
                        {pat.preTestOptIn ? (
                          <span
                            className={
                              pat.preTestStatus === 'completed'
                                ? 'badge badge-green'
                                : 'badge badge-amber'
                            }
                          >
                            <i className={`fa-solid ${pat.preTestStatus === 'completed' ? 'fa-check' : 'fa-spinner fa-spin'} text-[9px]`}></i>
                            {pat.preTestStatus === 'completed' ? 'COMPLETED' : 'WAITING'}
                          </span>
                        ) : (
                          <span className="badge badge-slate">NONE</span>
                        )}
                      </td>

                      {/* Assigned Room */}
                      <td className="py-3 px-3.5">
                        <span className="font-bold text-[#0f172a] block">
                          {pat.roomNumber}
                        </span>
                        <span className="text-[11px] text-[#64748b]">
                          {pat.doctorName}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3.5">
                        <span
                          className={
                            pat.status === 'in_consultation'
                              ? 'badge badge-green'
                              : pat.status === 'completed'
                              ? 'badge badge-slate'
                              : pat.status === 'er_escalated'
                              ? 'badge badge-red'
                              : 'badge badge-amber'
                          }
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
                              className="px-3 py-1 rounded-md border border-[#0ea5e9] text-[#0ea5e9] hover:bg-[#e0f2fe] text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                              title="Call this patient into room"
                            >
                              <i className="fa-solid fa-bullhorn text-[10px]"></i>
                              <span>Call Next</span>
                            </button>
                          )}

                          {pat.status === 'in_consultation' && (
                            <button
                              onClick={() => onCompletePatient(pat.id)}
                              className="px-3 py-1 rounded-md bg-[#22c55e] hover:bg-[#16a34a] text-white text-xs font-semibold flex items-center gap-1 shadow-xs transition cursor-pointer"
                            >
                              <i className="fa-solid fa-check text-[10px]"></i>
                              <span>Finish</span>
                            </button>
                          )}

                          {pat.status !== 'er_escalated' && pat.status !== 'completed' && (
                            <button
                              onClick={() => onEscalateToER(pat.id)}
                              className="px-2.5 py-1 rounded-md border border-[#ef4444] text-[#ef4444] hover:bg-[#fee2e2] text-xs font-semibold transition cursor-pointer"
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

      {/* TAB 2: ICMR PRE-TEST PROTOCOL MANAGER */}
      {activeTab === 'protocols' && (
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e2e8f0]">
            <div>
              <h3 className="text-base font-bold text-[#0f172a] flex items-center gap-2">
                <i className="fa-solid fa-book-medical text-[#0ea5e9]"></i>
                Pre-Approved ICMR Diagnostic Protocols
              </h3>
              <p className="text-xs text-[#64748b] mt-0.5">
                Rules governing preliminary test recommendations in the patient AI triage flow to slash consultation waiting times.
              </p>
            </div>

            <button
              onClick={() => setShowAddProtocolModal(true)}
              className="px-3.5 py-2 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <i className="fa-solid fa-plus"></i> Add Protocol
            </button>
          </div>

          {/* Protocols List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {protocols.map((proto) => (
              <div
                key={proto.id}
                className={`p-4 rounded-xl border transition-all ${
                  proto.active
                    ? 'bg-white border-[#cbd5e1] shadow-xs'
                    : 'bg-[#f8fafc] border-[#e2e8f0] opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="badge badge-teal">
                        {proto.department}
                      </span>
                      <span className="text-[11px] font-mono text-[#64748b]">
                        {proto.icmrCode}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-[#0f172a] mt-1.5">
                      {proto.condition}
                    </h4>
                  </div>

                  {/* Toggle switch button */}
                  <div
                    onClick={() => onToggleProtocol(proto.id)}
                    className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors ${
                      proto.active ? 'bg-[#0ea5e9]' : 'bg-[#cbd5e1]'
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-transform ${
                        proto.active ? 'left-[19px]' : 'left-[3px]'
                      }`}
                    ></span>
                  </div>
                </div>

                {/* Recommended tests chips */}
                <div className="my-3 space-y-1">
                  <span className="text-[10px] text-[#64748b] uppercase font-bold tracking-wider">
                    Triggered Pre-Consultation Labs:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {proto.recommendedTests.map((t, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2.5 py-0.5 rounded-md bg-[#f1f5f9] text-[#334155] border border-[#e2e8f0] font-medium"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-[#64748b] leading-relaxed bg-[#f8fafc] p-2.5 rounded-lg border border-[#e2e8f0]">
                  {proto.rationale}
                </p>

                <div className="mt-3 pt-2 border-t border-[#e2e8f0] flex items-center justify-between text-xs font-mono">
                  <span className="text-[#166534] font-semibold">
                    ⚡ Saves ~{proto.timeSavedMins} mins / patient
                  </span>
                  <span className="text-[#64748b]">
                    Accuracy: {proto.accuracyRate}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CAMPUS TELEMETRY & AMBULANCE DISPATCH (GOOGLE MAPS) */}
      {activeTab === 'campus_dispatch' && (
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-[#e2e8f0]">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-[#e0f2fe] text-[#0ea5e9] flex items-center justify-center text-sm font-bold">
                  <i className="fa-solid fa-map-location-dot"></i>
                </span>
                <h3 className="text-base font-bold text-[#0f172a]">
                  Hospital Campus & Ambulance Emergency Gateway
                </h3>
              </div>
              <p className="text-xs text-[#64748b] mt-0.5">
                Real-time campus logistics, ambulance trauma bay routing, visitor parking levels, and emergency supply telemetry.
              </p>
            </div>
            <span className="badge badge-green">
              <span className="w-2 h-2 rounded-full bg-[#166534] animate-ping"></span>
              Google Maps Live Telemetry
            </span>
          </div>

          <HospitalGoogleMap initialDestination="er" />
        </div>
      )}

      {/* ADD PROTOCOL MODAL */}
      {showAddProtocolModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-[#e2e8f0] max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0]">
              <h3 className="font-bold text-base text-[#0f172a]">
                Add Pre-Approved ICMR Diagnostic Protocol
              </h3>
              <button
                onClick={() => setShowAddProtocolModal(false)}
                className="text-[#64748b] hover:text-[#0f172a] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddProtocolSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#475569] font-medium mb-1">OPD Department</label>
                <select
                  value={newProtoDept}
                  onChange={(e) => setNewProtoDept(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#cbd5e1] text-[#0f172a] focus:outline-none focus:border-[#0ea5e9]"
                >
                  <option value="Orthopedics">Orthopedics</option>
                  <option value="Cardiology">Cardiology</option>
                  <option value="General Medicine">General Medicine</option>
                  <option value="Pulmonology">Pulmonology</option>
                  <option value="Gastroenterology">Gastroenterology</option>
                </select>
              </div>

              <div>
                <label className="block text-[#475569] font-medium mb-1">Clinical Condition / Trigger Rule</label>
                <input
                  type="text"
                  placeholder="e.g. Acute Epigastric Pain with Nausea"
                  value={newProtoCondition}
                  onChange={(e) => setNewProtoCondition(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#cbd5e1] text-[#0f172a] focus:outline-none focus:border-[#0ea5e9]"
                  required
                />
              </div>

              <div>
                <label className="block text-[#475569] font-medium mb-1">ICMR / Protocol Reference Code</label>
                <input
                  type="text"
                  value={newProtoCode}
                  onChange={(e) => setNewProtoCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#cbd5e1] text-[#0f172a] focus:outline-none font-mono focus:border-[#0ea5e9]"
                />
              </div>

              <div>
                <label className="block text-[#475569] font-medium mb-1">Recommended Tests (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Serum Amylase, Ultrasound Abdomen, CBC"
                  value={newProtoTests}
                  onChange={(e) => setNewProtoTests(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#cbd5e1] text-[#0f172a] focus:outline-none focus:border-[#0ea5e9]"
                  required
                />
              </div>

              <div>
                <label className="block text-[#475569] font-medium mb-1">Clinical Rationale & Time Benefit</label>
                <textarea
                  placeholder="Explains why pre-ordering this before consultation speeds diagnosis..."
                  value={newProtoRationale}
                  onChange={(e) => setNewProtoRationale(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#cbd5e1] text-[#0f172a] focus:outline-none h-16 focus:border-[#0ea5e9]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => setShowAddProtocolModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#f1f5f9] text-[#475569] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-semibold cursor-pointer shadow-xs"
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
