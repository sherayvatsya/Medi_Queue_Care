import React from 'react';
import { Patient } from '../types';

interface BookingConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFindNearbyLabs: () => void;
  patient: Patient;
  appointmentDate?: string;
  appointmentTime?: string;
}

export const BookingConfirmationModal: React.FC<BookingConfirmationModalProps> = ({
  isOpen,
  onClose,
  onFindNearbyLabs,
  patient,
  appointmentDate,
  appointmentTime,
}) => {
  if (!isOpen) return null;

  // Format date and time if not provided
  const displayDate =
    appointmentDate ||
    patient.appointmentDate ||
    new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const displayTime =
    appointmentTime ||
    patient.appointmentTime ||
    new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden text-left animate-in zoom-in-95 duration-200">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-6 sm:p-7 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-6 opacity-15 text-8xl pointer-events-none">
            <i className="fa-solid fa-hospital-user"></i>
          </div>

          <div className="flex items-center gap-3 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white text-2xl border border-white/30 shadow-xs shrink-0">
              <i className="fa-solid fa-circle-check"></i>
            </div>
            <div>
              <span className="text-[11px] uppercase font-bold tracking-wider text-emerald-100 bg-white/15 px-2 py-0.5 rounded-full inline-block mb-1">
                Booking Confirmed
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Appointment Booked Successfully
              </h2>
            </div>
          </div>
        </div>

        {/* Details Card */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-4 sm:p-5 space-y-3.5">
            {/* Hospital & Department */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Hospital & Campus
                </span>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-1.5">
                  <i className="fa-solid fa-hospital text-sky-600 text-xs"></i>
                  <span>{patient.hospitalName || 'City Care Hospital'}</span>
                </h3>
                <p className="text-xs text-slate-500">{patient.hospitalAddress || 'Main Campus Medical Enclave'}</p>
              </div>

              {/* Token Badge */}
              <div className="text-right shrink-0 bg-sky-50 px-3.5 py-1.5 rounded-xl border border-sky-200 shadow-2xs">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-sky-600 block">
                  Queue Token
                </span>
                <span className="font-mono font-black text-lg sm:text-xl text-sky-700">
                  {patient.tokenNumber}
                </span>
              </div>
            </div>

            {/* Doctor & Department */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Doctor
                </span>
                <p className="font-bold text-slate-900 truncate">
                  {patient.doctorName}
                </p>
                <span className="text-[11px] text-slate-500 font-medium">
                  {patient.roomNumber} ({patient.opdBlock})
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Department
                </span>
                <p className="font-bold text-sky-700 truncate">
                  {patient.department}
                </p>
                <span className="text-[11px] text-slate-500 font-medium">
                  {patient.floor}
                </span>
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-200 text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Appointment Date
                </span>
                <p className="font-bold text-slate-900 flex items-center gap-1.5">
                  <i className="fa-regular fa-calendar text-emerald-600 text-[11px]"></i>
                  <span>{displayDate}</span>
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Consultation Time
                </span>
                <p className="font-bold text-slate-900 flex items-center gap-1.5">
                  <i className="fa-regular fa-clock text-emerald-600 text-[11px]"></i>
                  <span>{displayTime}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Quick Notice */}
          <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200/80 text-xs text-sky-900 flex items-start gap-2.5">
            <i className="fa-solid fa-circle-info text-sky-600 mt-0.5 shrink-0"></i>
            <span className="text-[11px] leading-relaxed">
              Need laboratory blood tests, pathology workup, or imaging before or after your consultation? Find your hospital's internal lab or verified centers nearby.
            </span>
          </div>

          {/* User Flow Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
            >
              <i className="fa-solid fa-ticket text-xs"></i>
              <span>View Appointment</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onFindNearbyLabs();
              }}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white font-extrabold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.99]"
            >
              <i className="fa-solid fa-flask-vial text-sm"></i>
              <span>🧪 Find Nearby Labs</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
