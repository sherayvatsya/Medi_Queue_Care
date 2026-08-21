import React, { useEffect, useState } from 'react';
import { Doctor, Patient } from '../types';
import { announceTokenVoice } from '../utils/audio';

interface TVKioskDisplayProps {
  doctors: Doctor[];
  patients: Patient[];
  onExitFullscreen?: () => void;
}

export const TVKioskDisplay: React.FC<TVKioskDisplayProps> = ({ doctors, patients }) => {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // In-consultation patients currently inside rooms
  const activeConsultations = doctors.map((doc) => {
    const activePatient = patients.find(
      (p) => p.doctorId === doc.id && p.status === 'in_consultation'
    );
    const nextPatients = patients.filter(
      (p) => p.doctorId === doc.id && p.status === 'waiting'
    );
    return {
      doctor: doc,
      current: activePatient,
      next: nextPatients[0],
      queueCount: nextPatients.length,
    };
  });

  return (
    <div className="min-h-[82vh] bg-white text-[#334155] p-5 sm:p-7 rounded-xl border border-[#e2e8f0] shadow-sm flex flex-col justify-between space-y-6">
      {/* Top TV Header Bar with Professional Polish theme */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b-[3px] border-[#0ea5e9]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0ea5e9] text-white flex items-center justify-center text-xl font-black shadow-sm">
            M
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0f172a] flex items-center gap-2">
              <span>ST. JUDE MEDICAL CENTER</span>
              <span className="text-[#0ea5e9] font-normal text-lg">| OPD LIVE TOKEN BOARD</span>
            </h1>
            <p className="text-xs text-[#64748b]">
              Specialty Outpatient Lounges • Real-Time Queue Telemetry System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#0ea5e9]">
              {time}
            </div>
            <div className="text-xs text-[#166534] font-semibold flex items-center justify-end gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-ping"></span>
              Live Queue Broadcasting
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Active Doctor Consultation Rooms */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
        {activeConsultations.map(({ doctor, current, next, queueCount }) => (
          <div
            key={doctor.id}
            className={`rounded-xl border p-5 flex flex-col justify-between transition-all ${
              doctor.status === 'in_room'
                ? 'bg-white border-[#0ea5e9] shadow-md ring-1 ring-[#0ea5e9]/20'
                : 'bg-[#f8fafc] border-[#e2e8f0]'
            }`}
          >
            {/* Room & Doctor Header */}
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0]">
                <div className="bg-[#e0f2fe] text-[#0369a1] px-3 py-1 rounded-md text-xs font-bold font-mono tracking-wide border border-[#bae6fd]">
                  {doctor.roomNumber}
                </div>
                <span
                  className={
                    doctor.status === 'in_room'
                      ? 'badge badge-green'
                      : 'badge badge-amber'
                  }
                >
                  {doctor.status === 'in_room' ? 'ACTIVE' : 'ON BREAK'}
                </span>
              </div>

              <div className="mt-3">
                <h3 className="font-bold text-sm sm:text-base text-[#0f172a] truncate">
                  {doctor.name}
                </h3>
                <p className="text-xs text-[#0ea5e9] font-medium">{doctor.specialty}</p>
                <p className="text-[11px] text-[#64748b]">
                  {doctor.opdBlock} • {doctor.floor}
                </p>
              </div>

              {/* CURRENTLY SERVING BIG TOKEN */}
              <div className="mt-4 p-4 rounded-xl bg-[#0f172a] text-white text-center relative overflow-hidden shadow-sm">
                <span className="text-[10px] text-[#38bdf8] uppercase font-bold tracking-widest block">
                  ● NOW SERVING
                </span>
                {current ? (
                  <>
                    <div className="text-4xl sm:text-5xl font-black font-mono text-white my-1 tracking-tight">
                      {current.tokenNumber}
                    </div>
                    <div className="text-xs text-slate-300 font-semibold truncate">
                      {current.name}
                    </div>
                    <button
                      onClick={() =>
                        announceTokenVoice(current.tokenNumber, doctor.roomNumber, doctor.name)
                      }
                      className="mt-2 text-[10px] text-[#38bdf8] hover:text-white flex items-center justify-center gap-1 mx-auto cursor-pointer"
                    >
                      <i className="fa-solid fa-volume-high"></i> Re-announce Chime
                    </button>
                  </>
                ) : (
                  <div className="py-4 text-slate-400 text-sm font-medium italic">
                    Room Ready / Calling Next
                  </div>
                )}
              </div>
            </div>

            {/* Next in Line & Queue Count */}
            <div className="mt-4 pt-3 border-t border-[#e2e8f0] flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-[#64748b] block font-medium">Next Token</span>
                <span className="font-mono font-bold text-[#0f172a]">
                  {next ? next.tokenNumber : 'None'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[#64748b] block font-medium">Waiting</span>
                <span className="font-mono font-bold text-[#0ea5e9]">
                  {queueCount} Patients
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Kiosk Running News & Announcements */}
      <div className="p-3.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-0.5 rounded-full bg-[#0ea5e9] text-white font-bold uppercase text-[10px]">
            Notice
          </span>
          <span className="text-[#334155]">
            Please proceed to Fast-Track Diagnostic Bay on 2nd Floor (Block B) if your AI triage indicated preliminary lab tests.
          </span>
        </div>
        <div className="flex items-center gap-3 text-[#64748b] font-mono text-[11px]">
          <span>Emergency Casualty: Ext 108</span>
          <span>•</span>
          <span>Helpdesk Gate 1</span>
        </div>
      </div>
    </div>
  );
};
