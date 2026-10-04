import React from 'react';
import {
  LayoutDashboard,
  Calendar,
  Ticket,
  Video,
  FlaskConical,
  User,
} from 'lucide-react';
import { PatientNavView } from './Header';

interface MobileBottomNavProps {
  currentView: PatientNavView;
  onNavigate: (view: PatientNavView) => void;
  onOpenLabs: () => void;
  onOpenProfile: () => void;
  activeTokenNumber?: string;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onNavigate,
  onOpenLabs,
  onOpenProfile,
  activeTokenNumber,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-t border-[#E5EDF5] dark:border-[#1E293B] px-3 py-2 flex items-center justify-around shadow-lg">
      {/* 1. Dashboard / Home */}
      <button
        type="button"
        onClick={() => onNavigate('patient_pass')}
        className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition ${
          currentView === 'patient_pass'
            ? 'text-[#087FC9] dark:text-[#38BDF8] font-bold'
            : 'text-[#64748B] dark:text-[#94A3B8]'
        }`}
      >
        <LayoutDashboard className="w-4 h-4" />
        <span>Queue</span>
      </button>

      {/* 2. Live Pass */}
      <button
        type="button"
        onClick={() => onNavigate('patient_pass')}
        className="flex flex-col items-center gap-0.5 text-[10px] font-semibold text-[#087FC9] dark:text-[#38BDF8] relative -top-3"
      >
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#087FC9] to-[#00A3FF] text-white flex flex-col items-center justify-center shadow-md shadow-[#087FC9]/30">
          <Ticket className="w-4 h-4" />
          {activeTokenNumber && (
            <span className="text-[9px] font-black font-mono leading-none mt-0.5">
              {activeTokenNumber}
            </span>
          )}
        </div>
        <span className="font-bold">Pass</span>
      </button>

      {/* 3. Nearby Labs */}
      <button
        type="button"
        onClick={onOpenLabs}
        className="flex flex-col items-center gap-0.5 text-[10px] font-semibold text-[#8B5CF6] dark:text-[#C084FC]"
      >
        <FlaskConical className="w-4 h-4" />
        <span>Labs</span>
      </button>

      {/* 4. Tele-Consult */}
      <button
        type="button"
        onClick={() => onNavigate('teleconsult')}
        className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition ${
          currentView === 'teleconsult'
            ? 'text-[#087FC9] dark:text-[#38BDF8] font-bold'
            : 'text-[#64748B] dark:text-[#94A3B8]'
        }`}
      >
        <Video className="w-4 h-4" />
        <span>Tele-OPD</span>
      </button>

      {/* 5. Profile & Medical File */}
      <button
        type="button"
        onClick={onOpenProfile}
        className="flex flex-col items-center gap-0.5 text-[10px] font-semibold text-[#64748B] dark:text-[#94A3B8]"
      >
        <User className="w-4 h-4" />
        <span>Profile</span>
      </button>
    </nav>
  );
};
