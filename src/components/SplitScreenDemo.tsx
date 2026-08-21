import React from 'react';
import { Doctor, Patient, ICMRProtocol, PatientUser } from '../types';
import { PatientPortal } from './PatientPortal';
import { StaffDashboard } from './StaffDashboard';

interface SplitScreenDemoProps {
  doctors: Doctor[];
  patients: Patient[];
  protocols: ICMRProtocol[];
  currentPatient: Patient | null;
  currentUser?: PatientUser | null;
  onUserLogin?: (user: PatientUser) => void;
  onUserLogout?: () => void;
  onGenerateToken: (p: Patient) => void;
  onUpdatePatient: (p: Patient) => void;
  onUpdateDoctor: (d: Doctor) => void;
  onCallNextPatient: (doctorId: string) => void;
  onCompletePatient: (patientId: string) => void;
  onEscalateToER: (patientId: string) => void;
  onToggleProtocol: (protoId: string) => void;
  onAddProtocol: (proto: ICMRProtocol) => void;
  onShowToast?: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
}

export const SplitScreenDemo: React.FC<SplitScreenDemoProps> = ({
  doctors,
  patients,
  protocols,
  currentPatient,
  currentUser,
  onUserLogin,
  onUserLogout,
  onGenerateToken,
  onUpdatePatient,
  onUpdateDoctor,
  onCallNextPatient,
  onCompletePatient,
  onEscalateToER,
  onToggleProtocol,
  onAddProtocol,
  onShowToast,
}) => {
  return (
    <div className="space-y-4">
      {/* Live Sync Banner */}
      <div className="bg-white p-3.5 rounded-xl border border-[#e2e8f0] shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e] animate-ping"></span>
          <span className="font-bold text-[#0f172a]">
            Dual Interactive Split-Screen Live Demo
          </span>
          <span className="text-[#64748b]">
            • Two-way synchronization active
          </span>
        </div>
        <div className="text-[#334155] text-[11px] bg-[#f8fafc] px-3 py-1 rounded-md border border-[#e2e8f0]">
          💡 <strong>Demo tip:</strong> Click <span className="text-[#0ea5e9] font-bold">Shift Room</span> or <span className="text-[#0ea5e9] font-bold">Call Next</span> on the right Staff panel to see the patient view on the left update in real time!
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Patient Mobile Interface Emulator */}
        <div className="xl:col-span-5 flex flex-col items-center">
          <div className="w-full text-center pb-1">
            <span className="badge badge-teal">
              <i className="fa-solid fa-mobile-screen-button mr-1"></i>
              Live Patient Screen
            </span>
          </div>

          <PatientPortal
            doctors={doctors}
            currentPatient={currentPatient}
            currentUser={currentUser}
            onUserLogin={onUserLogin}
            onUserLogout={onUserLogout}
            onGenerateToken={onGenerateToken}
            onUpdatePatient={onUpdatePatient}
            isMobileFrame={true}
            onShowToast={onShowToast}
          />
        </div>

        {/* RIGHT COLUMN: Staff & Nurse Dashboard Console */}
        <div className="xl:col-span-7 space-y-3">
          <div className="w-full text-left pb-1">
            <span className="badge badge-slate">
              <i className="fa-solid fa-desktop mr-1 text-[#0ea5e9]"></i>
              Hospital Nurse & Doctor Control Station
            </span>
          </div>

          <div className="max-h-[880px] overflow-y-auto pr-1">
            <StaffDashboard
              doctors={doctors}
              patients={patients}
              protocols={protocols}
              onUpdateDoctor={onUpdateDoctor}
              onUpdatePatient={onUpdatePatient}
              onCallNextPatient={onCallNextPatient}
              onCompletePatient={onCompletePatient}
              onEscalateToER={onEscalateToER}
              onToggleProtocol={onToggleProtocol}
              onAddProtocol={onAddProtocol}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
