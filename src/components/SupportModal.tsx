import React from 'react';
import { Phone, MessageSquare, Headphones, X, ShieldAlert, HeartPulse, ExternalLink } from 'lucide-react';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose, onShowToast }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#111827] rounded-3xl border border-[#E5EDF5] dark:border-[#1E293B] max-w-md w-full p-6 space-y-5 shadow-2xl text-left relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#F6F9FC] dark:bg-[#172033] text-[#64748B] hover:text-[#13213A] dark:hover:text-white flex items-center justify-center cursor-pointer transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#087FC9] to-[#38BDF8] text-white flex items-center justify-center shadow-md">
            <Headphones className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-heading font-extrabold text-lg text-[#13213A] dark:text-white">
              Patient Support & Care
            </h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              24/7 dedicated hospital concierge & queue desk.
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          {/* Option 1: Toll Free Hotline */}
          <div className="p-3.5 rounded-2xl border border-[#E5EDF5] dark:border-[#1E293B] bg-[#F6F9FC] dark:bg-[#172033] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#111827] text-[#087FC9] dark:text-[#38BDF8] flex items-center justify-center border border-[#E5EDF5] dark:border-[#1E293B]">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#13213A] dark:text-white">OPD Helpdesk Helpline</p>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-mono">+91 1800-202-6000 (Toll Free)</p>
              </div>
            </div>
            <a
              href="tel:18002026000"
              className="px-3 py-1.5 rounded-xl bg-[#087FC9] hover:bg-[#0B5E97] text-white text-xs font-bold transition"
            >
              Call
            </a>
          </div>

          {/* Option 2: Live OPD WhatsApp / Coordinator */}
          <div className="p-3.5 rounded-2xl border border-[#E5EDF5] dark:border-[#1E293B] bg-[#F6F9FC] dark:bg-[#172033] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#13213A] dark:text-white">Floor Coordinator Desk</p>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">Block B, 2nd Floor Help Station</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (onShowToast) {
                  onShowToast('Floor Coordinator Alerted', 'Station nurse notified of assistance request.', 'success');
                }
                onClose();
              }}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
            >
              Ping
            </button>
          </div>

          {/* Option 3: Emergency Casualty Hotline */}
          <div className="p-3.5 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-rose-900 dark:text-rose-200">Emergency Casualty (Code Red)</p>
                <p className="text-[11px] text-rose-700 dark:text-rose-300 font-mono">Dial 108 or +91 172-555-0911</p>
              </div>
            </div>
            <a
              href="tel:108"
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition"
            >
              Emergency
            </a>
          </div>
        </div>

        <div className="pt-2 text-center">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-[#E5EDF5] dark:border-[#1E293B] text-xs font-semibold text-[#64748B] hover:text-[#13213A] dark:hover:text-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
