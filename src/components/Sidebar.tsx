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
} from 'lucide-react';

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
}) => {
  const menuItems: { id: SidebarTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'appointments', label: 'My Appointments', icon: Calendar },
    { id: 'patient_pass', label: 'Patient Pass', icon: Ticket },
    { id: 'teleconsult', label: 'Tele-Consult', icon: Video },
    { id: 'medical_file', label: 'Medical File', icon: FolderKanban },
    { id: 'prescriptions', label: 'Prescriptions', icon: FileText },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'nearby_labs', label: 'Labs Near You', icon: FlaskConical },
    { id: 'profile_settings', label: 'Profile & Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 shrink-0 flex flex-col justify-start pt-8 pb-5 px-3 h-fit border-r border-[#DCEBE3]/85 dark:border-[#284440] bg-white/52 dark:bg-[#162927]/68 backdrop-blur-md shadow-[2px_0_18px_rgba(0,107,103,0.025)] transition-colors duration-200">
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
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all duration-150 cursor-pointer text-left select-none ${
                  isActive
                    ? 'bg-gradient-to-r from-[#087F78] to-[#2EBB86] dark:from-[#087F78] dark:to-[#2EBB86] text-white font-bold shadow-[0_4px_12px_rgba(8,127,120,0.18)]'
                    : 'text-[#334155] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] hover:text-[#13213A] dark:hover:text-white'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-transform ${
                    isActive ? 'text-white' : 'text-[#647875] dark:text-[#A8BDB6]'
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

    </aside>
  );
};
