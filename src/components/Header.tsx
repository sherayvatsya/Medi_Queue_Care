import React, { useEffect, useState } from 'react';
import { PatientUser, StaffUser, UserRole, StaffSection } from '../types';

export type PatientNavView = 'patient_pass' | 'teleconsult' | 'hospital_map';

interface HeaderProps {
  currentRole: UserRole;
  // Patient Nav State
  patientNavView: PatientNavView;
  onPatientNavChange: (view: PatientNavView) => void;
  // Hospital Context State
  activeHospitalName?: string | null;
  // User States
  currentUser?: PatientUser | null;
  staffUser?: StaffUser | null;
  unreadAlertsCount?: number;
  activeStaffSection?: StaffSection;
  onStaffSectionChange?: (section: StaffSection) => void;
  // Action Callbacks
  onOpenPatientProfile?: () => void;
  onOpenPatientAuth?: () => void;
  onOpenHospitalLogin?: () => void;
  onSignOut?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  patientNavView,
  onPatientNavChange,
  activeHospitalName,
  currentUser,
  staffUser,
  onOpenPatientProfile,
  onOpenPatientAuth,
  onOpenHospitalLogin,
  onSignOut,
}) => {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isStaff = currentRole === 'staff' && staffUser !== null;
  const displayHospitalName = isStaff ? (staffUser?.hospitalName || 'Hospital Network') : (activeHospitalName || null);

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-lg px-3 sm:px-6 py-2.5 text-white transition-all w-full max-w-full overflow-hidden box-border">
      <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5 sm:gap-3">
        {/* Left: Brand Identity */}
        <div className="flex items-center justify-between w-full md:w-auto gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-white flex items-center justify-center font-black text-base sm:text-lg shadow-md shadow-sky-500/20 shrink-0">
              <i className={isStaff ? "fa-solid fa-hospital-user text-sm sm:text-base" : "fa-solid fa-hospital text-sm sm:text-base"}></i>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h1 className="text-sm sm:text-lg font-extrabold tracking-tight text-white flex items-center gap-1.5 truncate">
                  <span>Medi-Queue</span>
                </h1>
                <span className={`text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full border shrink-0 ${
                  isStaff
                    ? 'bg-sky-950/80 text-sky-400 border-sky-600/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700/80'
                }`}>
                  {isStaff ? 'Hospital Staff Portal' : 'Patient Portal'}
                </span>
              </div>
              {displayHospitalName ? (
                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-slate-400 truncate mt-0.5">
                  <span className="flex items-center gap-1 font-medium truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse shrink-0"></span>
                    <span className="text-emerald-400 font-semibold truncate">{displayHospitalName}</span>
                  </span>
                  <span className="text-slate-600 hidden sm:inline">•</span>
                  <span className="text-[11px] text-slate-400 hidden sm:inline font-mono">
                    {isStaff ? 'Clinical Console' : 'Active Pass'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-slate-400 truncate mt-0.5">
                  <span className="text-slate-400 font-medium truncate">
                    Smart Hospital Queue & Real-time Platform
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Clock */}
          <div className="flex items-center gap-2 md:hidden shrink-0">
            <span className="text-[10px] sm:text-[11px] font-mono text-slate-300 bg-slate-800 px-2 py-1 rounded-md border border-slate-700">
              {time}
            </span>
          </div>
        </div>

        {/* Center: Navigation (Rendered ONLY in Patient Mode; Staff navigation is housed exclusively in secondary white bar) */}
        {!isStaff && (
          <div className="bg-slate-800/90 p-1 rounded-xl flex items-center gap-1 border border-slate-700/70 shadow-inner w-full md:w-auto overflow-x-auto max-w-full scrollbar-none justify-center">
            <button
              type="button"
              onClick={() => onPatientNavChange('patient_pass')}
              className={`flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex-1 md:flex-initial cursor-pointer ${
                patientNavView === 'patient_pass'
                  ? 'bg-sky-500 text-white shadow-sm font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <i className="fa-solid fa-mobile-screen text-xs"></i>
              <span>Patient Pass</span>
            </button>

            <button
              type="button"
              onClick={() => onPatientNavChange('teleconsult')}
              className={`flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex-1 md:flex-initial cursor-pointer ${
                patientNavView === 'teleconsult'
                  ? 'bg-sky-500 text-white shadow-sm font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="Virtual Tele-Consultation"
            >
              <i className="fa-solid fa-video text-sky-400 text-xs"></i>
              <span>Tele-Consult</span>
            </button>
          </div>
        )}

        {/* Right: Authentication Status & Actions */}
        <div className="flex items-center gap-2 justify-end w-full md:w-auto">
          {/* Desktop live clock for staff */}
          {isStaff && (
            <div className="hidden md:flex items-center gap-2 mr-2">
              <span className="text-xs font-mono text-slate-300 bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700">
                <i className="fa-regular fa-clock text-sky-400 mr-1.5 text-[11px]"></i>
                {time}
              </span>
            </div>
          )}

          {isStaff && staffUser ? (
            /* Hospital Staff Profile Badge & Logout */
            <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-sky-500/30 shadow-xs max-w-full min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                <i className="fa-solid fa-user-shield text-xs"></i>
              </div>
              <div className="text-left hidden xs:block min-w-0">
                <span className="text-xs font-bold text-white block leading-tight truncate max-w-[130px]">
                  {staffUser.name}
                </span>
                <span className="text-[10px] text-sky-400 font-mono block truncate">
                  {staffUser.staffId} • {staffUser.role.toUpperCase()}
                </span>
              </div>
              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="ml-1 text-xs text-rose-300 hover:text-rose-200 bg-rose-950/50 hover:bg-rose-900/60 px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 font-semibold"
                  title="Logout from Hospital Staff Session"
                >
                  <i className="fa-solid fa-right-from-bracket text-[10px]"></i>
                  <span>Logout</span>
                </button>
              )}
            </div>
          ) : currentUser ? (
            /* Authenticated Patient: Profile + Logout */
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Profile Button */}
              <button
                type="button"
                onClick={onOpenPatientProfile}
                className="flex items-center gap-2 bg-slate-800/90 hover:bg-slate-700 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-700 shadow-xs transition cursor-pointer text-left"
                title="View & Edit Patient Profile"
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-tr from-sky-500 to-cyan-400 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden xs:block min-w-0">
                  <span className="text-xs font-bold text-white block leading-tight truncate max-w-[90px] sm:max-w-[120px]">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] font-mono text-sky-400 block truncate">
                    Profile
                  </span>
                </div>
              </button>

              {/* Patient Logout */}
              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 p-2 rounded-xl transition cursor-pointer shrink-0 border border-slate-800"
                  title="Sign out of Patient Session"
                >
                  <i className="fa-solid fa-right-from-bracket"></i>
                </button>
              )}
            </div>
          ) : (
            /* Unauthenticated Visitor Options: Sign In & Hospital Staff Access */
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenPatientAuth}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition cursor-pointer shadow-sm shrink-0"
              >
                <i className="fa-solid fa-user text-xs"></i>
                <span>Sign In</span>
              </button>

              <button
                type="button"
                onClick={onOpenHospitalLogin}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white border border-slate-700 text-xs font-semibold transition cursor-pointer shrink-0"
                title="Hospital Staff & Admin Portal"
              >
                <i className="fa-solid fa-lock text-[10px] text-sky-400"></i>
                <span className="hidden sm:inline">Hospital Login</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
