import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Bell,
  ChevronDown,
  User,
  ShieldCheck,
  LogOut,
  Stethoscope,
} from 'lucide-react';
import { PatientUser, StaffUser, UserRole, StaffSection } from '../types';

export type PatientNavView = 'dashboard' | 'patient_pass' | 'teleconsult' | 'hospital_map' | 'appointments' | 'medical_file' | 'prescriptions' | 'reports' | 'profile_settings' | 'nearby_labs';

interface HeaderProps {
  currentRole: UserRole;
  patientNavView: PatientNavView;
  onPatientNavChange: (view: PatientNavView) => void;
  activeHospitalName?: string | null;
  currentUser?: PatientUser | null;
  staffUser?: StaffUser | null;
  unreadAlertsCount?: number;
  activeStaffSection?: StaffSection;
  onStaffSectionChange?: (section: StaffSection) => void;
  onOpenPatientProfile?: () => void;
  onOpenMedicalFile?: () => void;
  onOpenPatientAuth?: () => void;
  onOpenHospitalLogin?: () => void;
  onOpenDoctorLogin?: () => void;
  onOpenAdminLogin?: () => void;
  onSignOut?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  patientNavView,
  onPatientNavChange,
  activeHospitalName,
  currentUser,
  staffUser,
  unreadAlertsCount = 3,
  activeStaffSection,
  onStaffSectionChange,
  onOpenPatientProfile,
  onOpenMedicalFile,
  onOpenPatientAuth,
  onOpenHospitalLogin,
  onOpenDoctorLogin,
  onOpenAdminLogin,
  onSignOut,
}) => {
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState<boolean>(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
        setShowNotificationsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isStaff = (currentRole === 'staff' || currentRole === 'admin' || currentRole === 'doctor') && staffUser !== null;
  const displayName = isStaff ? staffUser?.name : (currentUser ? currentUser.name : 'Rajesh');
  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-white/76 dark:bg-[#162927]/82 supports-[backdrop-filter]:bg-white/68 dark:supports-[backdrop-filter]:bg-[#162927]/76 backdrop-blur-xl border-b border-[#DCEBE3]/90 dark:border-[#284440] shadow-[0_4px_18px_rgba(0,107,103,0.045)] px-4 sm:px-6 py-2.5 transition-colors duration-200 w-full box-border">
      <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-3">
        {/* LEFT: BRAND IDENTITY */}
        <div className="flex items-center gap-3 shrink-0">
          <div
            onClick={() => onPatientNavChange('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
            title="Medi-Queue Home"
          >
            <img
              src="/mediqueue-logo.png"
              alt=""
              className="h-11 w-11 object-contain transition-transform group-hover:scale-[1.02]"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-extrabold text-lg sm:text-xl text-[#13213A] dark:text-white tracking-tight">
                  Medi Queue
                </span>
                {isStaff && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EBF5FB] dark:bg-[#082F49] text-[#087FC9] dark:text-[#38BDF8] border border-[#BAE6FD]">
                    {currentRole === 'doctor' ? 'Doctor Portal' : 'Admin Portal'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-medium leading-tight hidden xs:block">
                Smarter Hospitals. Shorter Queues.
              </p>
            </div>
          </div>
        </div>

        {/* CENTER NAVIGATION (Desktop SaaS Pills) */}
        {!isStaff ? <div className="flex-1" /> : (
          /* Staff Section Breadcrumb / Navigation */
          <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
            <span className="px-3 py-1 rounded-xl bg-[#EBF5FB] dark:bg-[#082F49] text-[#087FC9] dark:text-[#38BDF8] border border-[#BAE6FD] font-bold">
              {staffUser?.hospitalName || 'Max Super Specialty Hospital'}
            </span>
            <span>•</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Clinical Console
            </span>
            {onStaffSectionChange && (
              <button
                type="button"
                onClick={() => onStaffSectionChange('doctor_dashboard')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeStaffSection === 'doctor_dashboard'
                    ? 'bg-sky-500 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                <span>Doctor Console</span>
              </button>
            )}
          </div>
        )}

        {/* DIRECT ACCESS: Doctor & Admin Portal Buttons */}
        {!isStaff && (
          <div className="hidden sm:flex items-center gap-2" data-portal-buttons="true">
            <button
              type="button"
              onClick={() => {
                if (onOpenDoctorLogin) onOpenDoctorLogin();
                else window.location.hash = '#doctor-login';
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/55 hover:bg-[#E8F8EF]/90 dark:bg-[#1B302D]/60 dark:hover:bg-[#23413B]/80 text-[#006B67] dark:text-[#66D4A5] border border-[#DCEBE3] dark:border-[#31534B] backdrop-blur-sm transition flex items-center gap-1.5 cursor-pointer shadow-[0_2px_8px_rgba(0,107,103,0.04)]"
            >
              <Stethoscope className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Doctor Login</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (onOpenAdminLogin) onOpenAdminLogin();
                else window.location.hash = '#admin-login';
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/55 hover:bg-[#E8F8EF]/90 dark:bg-[#1B302D]/60 dark:hover:bg-[#23413B]/80 text-[#006B67] dark:text-[#66D4A5] border border-[#DCEBE3] dark:border-[#31534B] backdrop-blur-sm transition flex items-center gap-1.5 cursor-pointer shadow-[0_2px_8px_rgba(0,107,103,0.04)]"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Admin Login</span>
            </button>
          </div>
        )}

        {/* RIGHT ACTIONS: Search, Notifications, Profile Avatar & Theme Toggle */}
        <div className="flex items-center gap-2 sm:gap-3" ref={dropdownRef}>
          {/* Search Trigger */}
          <button
            type="button"
            onClick={() => setShowSearchModal(!showSearchModal)}
            className="w-9 h-9 rounded-xl border border-[#DCEBE3] dark:border-[#31534B] bg-white/55 dark:bg-[#1B302D]/60 backdrop-blur-sm hover:bg-[#E8F8EF]/85 dark:hover:bg-[#23413B]/80 text-[#647875] dark:text-[#A8BDB6] hover:text-[#006B67] dark:hover:text-white flex items-center justify-center transition cursor-pointer shadow-[0_2px_8px_rgba(0,107,103,0.04)]"
            title="Search Doctors, Labs, or OPD Services"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Notifications Bell with Badge */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
              className="w-9 h-9 rounded-xl border border-[#DCEBE3] dark:border-[#31534B] bg-white/55 dark:bg-[#1B302D]/60 backdrop-blur-sm hover:bg-[#E8F8EF]/85 dark:hover:bg-[#23413B]/80 text-[#647875] dark:text-[#A8BDB6] hover:text-[#006B67] dark:hover:text-white flex items-center justify-center transition cursor-pointer shadow-[0_2px_8px_rgba(0,107,103,0.04)] relative"
              title="Hospital Alerts & Queue Announcements"
            >
              <Bell className="w-4 h-4" />
              {unreadAlertsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                  {unreadAlertsCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotificationsDropdown && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white dark:bg-[#111827] border border-[#E5EDF5] dark:border-[#1E293B] shadow-xl p-3 z-50 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-[#E5EDF5] dark:border-[#1E293B]">
                  <span className="text-xs font-bold text-[#13213A] dark:text-white">Recent Updates</span>
                  <span className="text-[10px] font-semibold text-[#087FC9] bg-[#EBF5FB] px-2 py-0.5 rounded-full">
                    3 New
                  </span>
                </div>
                <div className="py-2 space-y-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#F6F9FC] dark:bg-[#172033] flex items-start gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-[#16B981] mt-1 shrink-0"></span>
                    <div>
                      <p className="font-semibold text-[#13213A] dark:text-white leading-tight">
                        Token A-42 Generated
                      </p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                        Orthopedics • Est. Wait 14 mins
                      </p>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#F6F9FC] dark:bg-[#172033] flex items-start gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-[#087FC9] mt-1 shrink-0"></span>
                    <div>
                      <p className="font-semibold text-[#13213A] dark:text-white leading-tight">
                        Dr. Arvind Sharma in Room 204
                      </p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                        Consultation active on schedule.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Avatar & Name */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (currentUser || isStaff) {
                  setShowProfileDropdown(!showProfileDropdown);
                } else if (onOpenPatientAuth) {
                  onOpenPatientAuth();
                }
              }}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-xl border border-[#DCEBE3] dark:border-[#31534B] bg-white/55 dark:bg-[#1B302D]/60 backdrop-blur-sm hover:bg-[#E8F8EF]/85 dark:hover:bg-[#23413B]/80 transition cursor-pointer shadow-[0_2px_8px_rgba(0,107,103,0.04)]"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#38BDF8] to-[#087FC9] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {userInitial}
              </div>
              <span className="text-xs font-bold text-[#13213A] dark:text-white max-w-[100px] truncate hidden sm:inline">
                {displayName}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8]" />
            </button>

            {/* Profile Dropdown */}
            {showProfileDropdown && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-[#111827] border border-[#E5EDF5] dark:border-[#1E293B] shadow-xl p-2 z-50 animate-in fade-in duration-150">
                <div className="px-3 py-2 border-b border-[#E5EDF5] dark:border-[#1E293B]">
                  <p className="text-xs font-bold text-[#13213A] dark:text-white truncate">{displayName}</p>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-mono truncate">
                    {currentUser?.uhid || staffUser?.staffId || 'Active Patient'}
                  </p>
                </div>
                <div className="py-1">
                  {!isStaff && onOpenPatientProfile && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileDropdown(false);
                        onOpenPatientProfile();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#334155] dark:text-[#94A3B8] hover:bg-[#F6F9FC] dark:hover:bg-[#172033] hover:text-[#087FC9] rounded-xl cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Edit Patient Profile</span>
                    </button>
                  )}
                  {onOpenDoctorLogin && !isStaff && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileDropdown(false);
                        onOpenDoctorLogin();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-xl cursor-pointer font-semibold"
                    >
                      <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                      <span>Doctor Clinical Login</span>
                    </button>
                  )}
                  {onOpenAdminLogin && !isStaff && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileDropdown(false);
                        onOpenAdminLogin();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl cursor-pointer font-semibold"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Hospital Admin Login</span>
                    </button>
                  )}
                  {onOpenHospitalLogin && !onOpenDoctorLogin && !isStaff && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileDropdown(false);
                        onOpenHospitalLogin();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#334155] dark:text-[#94A3B8] hover:bg-[#F6F9FC] dark:hover:bg-[#172033] hover:text-[#087FC9] rounded-xl cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-sky-500" />
                      <span>Hospital Staff Portal</span>
                    </button>
                  )}
                  {isStaff && onStaffSectionChange && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileDropdown(false);
                        onStaffSectionChange('doctor_dashboard');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#334155] dark:text-[#94A3B8] hover:bg-[#F6F9FC] dark:hover:bg-[#172033] hover:text-[#087FC9] rounded-xl cursor-pointer font-bold"
                    >
                      <Stethoscope className="w-3.5 h-3.5 text-sky-500" />
                      <span>Doctor Clinical Console</span>
                    </button>
                  )}
                  {onSignOut && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileDropdown(false);
                        onSignOut();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl cursor-pointer font-semibold"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Instant Search Bar Overlay */}
      {showSearchModal && (
        <div className="pt-2.5 pb-1 max-w-xl mx-auto animate-in slide-in-from-top-2 duration-150">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search doctors (e.g. Dr. Arvind Sharma), department (Orthopedics), or labs..."
              className="w-full pl-10 pr-10 py-2 rounded-xl bg-[#F6F9FC] dark:bg-[#172033] border border-[#E5EDF5] dark:border-[#1E293B] text-xs text-[#13213A] dark:text-white placeholder-[#64748B] focus:outline-hidden focus:ring-2 focus:ring-[#087FC9]/30"
              autoFocus
            />
            <button
              onClick={() => setShowSearchModal(false)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#64748B] hover:text-[#13213A] cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
