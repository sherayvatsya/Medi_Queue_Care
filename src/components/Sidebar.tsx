import React from 'react';
import {
  LayoutDashboard,
  Calendar,
  Ticket,
  Video,
  FolderKanban,
  FileText,
  BarChart3,
  FlaskConical,
  Settings,
  HelpCircle,
  PhoneCall,
  Sparkles,
} from 'lucide-react';
import { PatientNavView } from './Header';

export type SidebarTab =
  | 'dashboard'
  | 'appointments'
  | 'patient_pass'
  | 'teleconsult'
  | 'medical_file'
  | 'prescriptions'
  | 'reports'
  | 'nearby_labs'
  | 'profile_settings';

interface SidebarProps {
  activeTab: SidebarTab;
  onSelectTab: (tab: SidebarTab) => void;
  onOpenSupportModal?: () => void;
  unreadCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onOpenSupportModal,
}) => {
  const menuItems: { id: SidebarTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'appointments', label: 'My Appointments', icon: Calendar },
    { id: 'patient_pass', label: 'Patient Pass', icon: Ticket },
    { id: 'teleconsult', label: 'Tele-Consult', icon: Video },
    { id: 'medical_file', label: 'Medical File', icon: FolderKanban },
    { id: 'prescriptions', label: 'Prescriptions', icon: FileText },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'nearby_labs', label: 'Find Nearby Labs', icon: FlaskConical },
    { id: 'profile_settings', label: 'Profile & Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 shrink-0 flex flex-col justify-between py-5 px-3 min-h-[calc(100vh-70px)] border-r border-[#E5EDF5] dark:border-[#1E293B] bg-white/70 dark:bg-[#111827]/70 backdrop-blur-md transition-colors duration-200">
      {/* Top Menu Section */}
      <div className="space-y-1">
        <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
          Navigation
        </div>
        <nav className="space-y-1" aria-label="Sidebar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer text-left select-none ${
                  isActive
                    ? 'bg-[#EBF5FB] dark:bg-[#082F49] text-[#087FC9] dark:text-[#38BDF8] font-bold shadow-2xs'
                    : 'text-[#334155] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] hover:text-[#13213A] dark:hover:text-white'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-transform ${
                    isActive ? 'text-[#087FC9] dark:text-[#38BDF8] scale-105' : 'text-[#64748B] dark:text-[#94A3B8]'
                  }`}
                />
                <span className="truncate">{item.label}</span>
                {item.id === 'nearby_labs' && (
                  <span className="ml-auto text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-[#F3E8FF] text-[#7C3AED] dark:bg-[#2E1065] dark:text-[#C084FC]">
                    Labs
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Support Card Matching Reference */}
      <div className="mt-8 pt-4">
        <div className="p-4 rounded-2xl border border-[#E5EDF5] dark:border-[#1E293B] bg-[#F6F9FC] dark:bg-[#172033] text-center space-y-2.5 shadow-2xs">
          <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-tr from-[#087FC9] to-[#38BDF8] p-0.5 shadow-sm">
            <div className="w-full h-full rounded-full bg-white dark:bg-[#111827] flex items-center justify-center overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=120&auto=format&fit=crop&q=80"
                alt="Support Doctor"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
              <HelpCircle className="w-5 h-5 text-[#087FC9]" />
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#13213A] dark:text-white">Need Help?</h4>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] leading-tight mt-0.5">
              Our support team is here for you.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenSupportModal}
            className="w-full py-2 px-3 rounded-xl border border-[#087FC9] text-[#087FC9] dark:text-[#38BDF8] dark:border-[#38BDF8] hover:bg-[#087FC9] hover:text-white dark:hover:bg-[#087FC9] dark:hover:text-white text-xs font-semibold transition-all duration-150 cursor-pointer shadow-2xs"
          >
            Contact Support
          </button>
        </div>
      </div>
    </aside>
  );
};
