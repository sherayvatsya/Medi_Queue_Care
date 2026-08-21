import React, { useEffect, useState, useRef } from 'react';
import { playHospitalChime } from '../utils/audio';
import { PatientUser } from '../types';

export type AppViewMode = 'patient' | 'staff' | 'split' | 'tv_kiosk' | 'campus_map' | 'teleconsult';

interface HeaderProps {
  currentView: AppViewMode;
  onViewChange: (view: AppViewMode) => void;
  serverStatus: 'connected' | 'syncing' | 'offline';
  unreadAlertsCount?: number;
  onResetDemoData: () => void;
  currentUser?: PatientUser | null;
  onSignOut?: () => void;
  onOpenAuthModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  unreadAlertsCount = 0,
  onResetDemoData,
  currentUser,
  onSignOut,
  onOpenAuthModal,
}) => {
  const [time, setTime] = useState<string>('');
  const [showDevMenu, setShowDevMenu] = useState<boolean>(false);
  const devMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close dev menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (devMenuRef.current && !devMenuRef.current.contains(event.target as Node)) {
        setShowDevMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isDevViewActive = currentView === 'split' || currentView === 'tv_kiosk';

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-lg px-3 sm:px-6 py-2.5 text-white transition-all w-full max-w-full overflow-hidden box-border">
      <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5 sm:gap-3">
        {/* Left: Brand Identity & Status */}
        <div className="flex items-center justify-between w-full md:w-auto gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-white flex items-center justify-center font-black text-base sm:text-lg shadow-md shadow-sky-500/20 shrink-0">
              <i className="fa-solid fa-hospital-user text-sm sm:text-base"></i>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h1 className="text-sm sm:text-lg font-extrabold tracking-tight text-white flex items-center gap-1.5 truncate">
                  <span>Medi-Queue</span>
                </h1>
                <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full bg-slate-800 text-sky-400 border border-slate-700/80 shrink-0">
                  OPD Suite
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-slate-400 truncate">
                <span className="flex items-center gap-1 font-medium truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse shrink-0"></span>
                  <span className="text-emerald-400 font-semibold truncate">St. Jude Medical Center</span>
                </span>
                <span className="text-slate-600 hidden sm:inline">•</span>
                <span className="text-[11px] text-slate-400 hidden sm:inline font-mono">Hub DEL-01</span>
              </div>
            </div>
          </div>

          {/* Mobile Clock */}
          <div className="flex items-center gap-2 md:hidden shrink-0">
            <span className="text-[10px] sm:text-[11px] font-mono text-slate-300 bg-slate-800 px-2 py-1 rounded-md border border-slate-700">
              {time}
            </span>
          </div>
        </div>

        {/* Center: Modern Segmented Pill View Switcher */}
        <div className="bg-slate-800 p-1 rounded-xl flex items-center gap-1 border border-slate-700/70 shadow-inner w-full md:w-auto overflow-x-auto max-w-full scrollbar-none">
          <button
            type="button"
            onClick={() => onViewChange('patient')}
            className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap flex-1 md:flex-initial cursor-pointer ${
              currentView === 'patient'
                ? 'bg-sky-500 text-white shadow-sm font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <i className="fa-solid fa-mobile-screen text-[10px] sm:text-xs"></i>
            <span>Patient Pass</span>
          </button>

          <button
            type="button"
            onClick={() => onViewChange('teleconsult')}
            className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap flex-1 md:flex-initial cursor-pointer ${
              currentView === 'teleconsult'
                ? 'bg-sky-500 text-white shadow-sm font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
            title="Virtual Tele-Consultation"
          >
            <i className="fa-solid fa-video text-sky-400 text-[10px] sm:text-xs"></i>
            <span>Tele-Consult</span>
          </button>

          <button
            type="button"
            onClick={() => onViewChange('staff')}
            className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap flex-1 md:flex-initial cursor-pointer ${
              currentView === 'staff'
                ? 'bg-sky-500 text-white shadow-sm font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <i className="fa-solid fa-user-doctor text-[10px] sm:text-xs"></i>
            <span>Staff</span>
            {unreadAlertsCount > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onViewChange('campus_map')}
            className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap flex-1 md:flex-initial cursor-pointer ${
              currentView === 'campus_map'
                ? 'bg-sky-500 text-white shadow-sm font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
            title="Hospital Campus Map & Routes"
          >
            <i className="fa-solid fa-map-location-dot text-[10px] sm:text-xs text-sky-400"></i>
            <span>Campus</span>
          </button>
        </div>

        {/* Right: Collapsed Dev Tools Dropdown & User Profile */}
        <div className="flex items-center gap-2 justify-end w-full md:w-auto">
          {/* Subtle Collapsed Dev Tools Dropdown */}
          <div className="relative" ref={devMenuRef}>
            <button
              type="button"
              id="dev-tools-toggle-btn"
              onClick={() => {
                setShowDevMenu((prev) => !prev);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setShowDevMenu((prev) => !prev);
                } else if (e.key === 'Escape') {
                  setShowDevMenu(false);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all shadow-sm cursor-pointer select-none active:scale-95 ${
                isDevViewActive || showDevMenu
                  ? 'bg-sky-500 text-white border-sky-400 shadow-sky-500/30 ring-2 ring-sky-400/40'
                  : 'bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 hover:text-white border-sky-500/40'
              }`}
              title="Developer & Simulator Controls (Click to open menu)"
              aria-haspopup="true"
              aria-expanded={showDevMenu}
            >
              <i className="fa-solid fa-sliders text-xs text-sky-400"></i>
              <span className="text-xs">Dev Tools</span>
              <i className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-200 ${showDevMenu ? 'rotate-180 text-white' : 'text-sky-300'}`}></i>
            </button>

            {/* Collapsed Dropdown Menu */}
            {showDevMenu && (
              <div className="absolute right-0 mt-2 w-60 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 flex items-center justify-between">
                  <span>Simulation & Displays</span>
                  <span className="text-[9px] text-sky-400 font-mono">LIVE</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onViewChange('split');
                    setShowDevMenu(false);
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer text-left active:scale-[0.98] ${
                    currentView === 'split'
                      ? 'bg-sky-500 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <i className="fa-solid fa-table-columns text-sky-400"></i>
                  <div className="flex-1 min-w-0">
                    <span className="block leading-tight truncate font-bold">Dual Live Pitch Mode</span>
                    <span className="text-[10px] text-slate-400 font-normal">Side-by-side patient & staff</span>
                  </div>
                  {currentView === 'split' && <i className="fa-solid fa-check text-xs text-white"></i>}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onViewChange('tv_kiosk');
                    setShowDevMenu(false);
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer text-left active:scale-[0.98] ${
                    currentView === 'tv_kiosk'
                      ? 'bg-sky-500 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <i className="fa-solid fa-tv text-sky-400"></i>
                  <div className="flex-1 min-w-0">
                    <span className="block leading-tight truncate font-bold">TV Kiosk Display</span>
                    <span className="text-[10px] text-slate-400 font-normal">Waiting hall digital board</span>
                  </div>
                  {currentView === 'tv_kiosk' && <i className="fa-solid fa-check text-xs text-white"></i>}
                </button>

                <div className="my-1 border-t border-slate-800"></div>

                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Telemetry & System Actions
                </div>

                <button
                  type="button"
                  onClick={() => {
                    playHospitalChime();
                    setShowDevMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer text-left active:scale-[0.98]"
                >
                  <i className="fa-solid fa-volume-high text-sky-400"></i>
                  <div className="flex-1 min-w-0">
                    <span className="block leading-tight font-medium">Test Hospital Chime</span>
                    <span className="text-[10px] text-slate-400">Play standard OPD notification sound</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onResetDemoData();
                    setShowDevMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-rose-300 hover:bg-rose-950/50 hover:text-rose-200 transition cursor-pointer text-left active:scale-[0.98]"
                >
                  <i className="fa-solid fa-rotate-left text-rose-400"></i>
                  <div className="flex-1 min-w-0">
                    <span className="block leading-tight font-medium">Reset Demo Queue</span>
                    <span className="text-[10px] text-rose-400/80">Restore sample patients & doctors</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* User Profile / OTP Sign In button */}
          {currentUser ? (
            <div className="flex items-center gap-2 bg-slate-800/90 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-700 shadow-xs max-w-full min-w-0">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-tr from-sky-500 to-cyan-400 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                {currentUser.name.charAt(0)}
              </div>
              <div className="text-left hidden xs:block min-w-0">
                <span className="text-xs font-bold text-white block leading-tight truncate max-w-[90px] sm:max-w-[120px]">
                  {currentUser.name}
                </span>
                <span className="text-[10px] font-mono text-sky-400 block truncate">{currentUser.uhid}</span>
              </div>
              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="ml-0.5 sm:ml-1 text-xs text-slate-400 hover:text-rose-400 transition cursor-pointer p-1 shrink-0"
                  title="Sign out"
                >
                  <i className="fa-solid fa-right-from-bracket"></i>
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition cursor-pointer shadow-sm shrink-0"
            >
              <i className="fa-solid fa-mobile-screen text-xs"></i>
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
