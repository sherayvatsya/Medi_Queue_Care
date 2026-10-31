import React from 'react';
import {
  LayoutDashboard,
  Ticket,
  Video,
  FlaskConical,
  User,
} from 'lucide-react';
import { PatientNavView } from './Header';

interface MobileBottomNavProps {
  currentView: PatientNavView;
  onNavigate: (view: PatientNavView) => void;
  onOpenProfile: () => void;
  activeTokenNumber?: string;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onNavigate,
  onOpenProfile,
  activeTokenNumber,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/78 dark:bg-[#162927]/84 backdrop-blur-xl border-t border-[#DCEBE3]/90 dark:border-[#284440] px-3 py-2 flex items-center justify-around shadow-[0_-6px_22px_rgba(0,107,103,0.07)]">
      {/* 1. Dashboard / Home */}
      <button
        type="button"
        onClick={() => onNavigate('dashboard')}
        className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition ${
          currentView === 'dashboard'
            ? 'text-[#006B67] dark:text-[#66D4A5] font-bold'
            : 'text-[#647875] dark:text-[#A8BDB6]'
        }`}
      >
        <LayoutDashboard className="w-4 h-4" />
        <span>Home</span>
      </button>

      {/* 2. Live Pass */}
      <button
        type="button"
        onClick={() => onNavigate('patient_pass')}
        className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold relative -top-3 ${
          currentView === 'patient_pass'
            ? 'text-[#006B67] dark:text-[#66D4A5] font-bold'
            : 'text-[#087F78] dark:text-[#66D4A5]'
        }`}
      >
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#006B67] to-[#2EBB86] text-white flex flex-col items-center justify-center shadow-sm">
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
        onClick={() => onNavigate('nearby_labs')}
        className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition ${
          currentView === 'nearby_labs'
            ? 'text-[#006B67] dark:text-[#66D4A5] font-bold'
            : 'text-[#647875] dark:text-[#A8BDB6]'
        }`}
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
            ? 'text-[#006B67] dark:text-[#66D4A5] font-bold'
            : 'text-[#647875] dark:text-[#A8BDB6]'
        }`}
      >
        <Video className="w-4 h-4" />
        <span>Tele-OPD</span>
      </button>

      {/* 5. Profile & Medical File */}
      <button
        type="button"
        onClick={onOpenProfile}
        className="flex flex-col items-center gap-0.5 text-[10px] font-semibold text-[#647875] dark:text-[#A8BDB6]"
      >
        <User className="w-4 h-4" />
        <span>Profile</span>
      </button>
    </nav>
  );
};
