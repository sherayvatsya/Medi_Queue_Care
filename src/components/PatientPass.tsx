import React from 'react';
import {
  Ticket,
  Clock,
  Users,
  Radio,
  MapPin,
  Copy,
  Printer,
  Share2,
  Accessibility,
  FlaskConical,
  Route,
  Calendar,
  Stethoscope,
  Plus,
} from 'lucide-react';
import { Doctor, Patient, PatientUser } from '../types';
import { getValidDoctorAvatar, handleDoctorImageError } from '../utils/doctorAvatar';

interface PatientPassProps {
  currentPatient: Patient | null;
  currentUser: PatientUser | null;
  doctors: Doctor[];
  onUpdatePatient: (updated: Patient) => void;
  onRegisterToken: () => void;
  onOpenAppointments: () => void;
  onOpenHospitalMap: () => void;
  onShowToast?: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
}

const formatAppointmentDate = (value?: string) => {
  if (!value) return 'Today';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const qrCells = Array.from({ length: 49 }, (_, index) =>
  [0, 1, 2, 4, 5, 6, 7, 10, 13, 14, 16, 18, 20, 21, 22, 24, 26, 28, 31, 32, 34, 35, 38, 40, 42, 43, 44, 46, 48].includes(index)
);

export const PatientPass: React.FC<PatientPassProps> = ({
  currentPatient,
  currentUser,
  doctors,
  onUpdatePatient,
  onRegisterToken,
  onOpenAppointments,
  onOpenHospitalMap,
  onShowToast,
}) => {
  if (!currentPatient) {
    return (
      <div className="card-healthcare bg-white dark:bg-[#111827] p-8 sm:p-10 text-center max-w-2xl mx-auto">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-[#EBF5FB] dark:bg-[#082F49] text-[#087FC9] dark:text-[#38BDF8] flex items-center justify-center">
          <Ticket className="w-7 h-7" />
        </div>
        <h1 className="font-heading text-2xl font-extrabold text-[#13213A] dark:text-white mt-5">No Active Patient Pass</h1>
        <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mt-2">
          Register an OPD token to generate a scannable queue pass for hospital entry, routing, and live status.
        </p>
        <button
          type="button"
          onClick={onRegisterToken}
          className="mt-5 px-5 py-3 rounded-xl bg-[#087FC9] hover:bg-[#006EAF] text-white text-sm font-bold inline-flex items-center gap-2 shadow-md shadow-[#087FC9]/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Register Token</span>
        </button>
      </div>
    );
  }

  const doctor = doctors.find((doc) => doc.id === currentPatient.doctorId);
  const passOwner = currentUser?.name || currentPatient.name;
  const isWheelchairActive = currentPatient.wheelchairRequest && currentPatient.wheelchairRequest.status !== 'completed';

  const copyUHID = async () => {
    try {
      await navigator.clipboard.writeText(currentPatient.uhid);
      onShowToast?.('UHID Copied', `${currentPatient.uhid} copied to clipboard.`, 'success');
    } catch {
      onShowToast?.('Copy Unavailable', 'Your browser blocked clipboard access.', 'info');
    }
  };

  const sharePass = () => {
    const message = `Medi Queue pass ${currentPatient.tokenNumber} for ${passOwner}. ${currentPatient.hospitalName || 'Hospital'}, ${currentPatient.roomNumber}, ${currentPatient.appointmentTime || currentPatient.createdAt}.`;
    if (navigator.share) {
      navigator.share({ title: 'Medi Queue Patient Pass', text: message }).catch(() => undefined);
    } else {
      navigator.clipboard?.writeText(message);
      onShowToast?.('Pass Details Copied', 'Share text copied for family updates.', 'success');
    }
  };

  const requestWheelchair = () => {
    if (isWheelchairActive) {
      onShowToast?.('Wheelchair Already Active', 'Porter assistance is already linked to this pass.', 'info');
      return;
    }

    onUpdatePatient({
      ...currentPatient,
      wheelchairRequest: {
        id: `wc-${Date.now()}`,
        patientId: currentPatient.id,
        patientName: currentPatient.name,
        tokenNumber: currentPatient.tokenNumber,
        location: 'Main Gate 1 Entrance',
        requestedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'requested',
      },
    });
    onShowToast?.('Wheelchair Requested', 'Porter bay has received your assistance request.', 'success');
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)] gap-5">
        <div className="rounded-3xl overflow-hidden bg-[#087FC9] text-white shadow-xl shadow-[#087FC9]/20 relative">
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_20%_20%,white_0,transparent_24%),radial-gradient(circle_at_80%_0%,white_0,transparent_18%)]"></div>
          <div className="relative p-5 sm:p-7 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-bold uppercase">
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  <span>Live Patient Pass</span>
                </div>
                <h1 className="font-heading text-2xl sm:text-3xl font-extrabold mt-4">{passOwner}</h1>
                <p className="text-sm text-white/80 mt-1">{currentPatient.uhid}</p>
              </div>
              <div className="w-28 h-28 rounded-2xl bg-white p-3 shadow-lg shrink-0">
                <div className="grid grid-cols-7 gap-1 h-full">
                  {qrCells.map((active, index) => (
                    <span key={index} className={`rounded-[2px] ${active ? 'bg-[#13213A]' : 'bg-slate-100'}`} />
                  ))}
                </div>
              </div>
            </div>

            <div className="text-center py-3">
              <p className="text-xs uppercase tracking-[0.3em] text-white/70 font-bold">Your Token</p>
              <div className="font-heading font-black text-7xl sm:text-8xl tracking-tight leading-none mt-2">{currentPatient.tokenNumber}</div>
              <p className="text-sm text-white/80 mt-3">
                {currentPatient.queuePosition === 0
                  ? 'Proceed to consultation room'
                  : `${currentPatient.queuePosition} patients ahead, estimated wait ${currentPatient.estimatedWaitMinutes} mins`}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 border-t border-white/20 pt-5">
              <div className="text-center">
                <Users className="w-4 h-4 mx-auto text-white/80" />
                <p className="font-heading font-extrabold text-xl mt-1">{currentPatient.queuePosition}</p>
                <p className="text-[11px] text-white/70">Ahead</p>
              </div>
              <div className="text-center border-x border-white/20">
                <Clock className="w-4 h-4 mx-auto text-white/80" />
                <p className="font-heading font-extrabold text-xl mt-1">~{currentPatient.estimatedWaitMinutes}</p>
                <p className="text-[11px] text-white/70">Minutes</p>
              </div>
              <div className="text-center">
                <MapPin className="w-4 h-4 mx-auto text-white/80" />
                <p className="font-heading font-extrabold text-xl mt-1">{currentPatient.roomNumber.replace('Room ', '')}</p>
                <p className="text-[11px] text-white/70">Room</p>
              </div>
            </div>
          </div>
        </div>

        <aside className="card-healthcare bg-white dark:bg-[#111827] p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-3">
            <img
              src={getValidDoctorAvatar(doctor?.id || currentPatient.doctorId, doctor?.avatar)}
              alt={currentPatient.doctorName}
              className="w-14 h-14 rounded-2xl object-cover border border-[#E5EDF5] dark:border-[#1E293B]"
              onError={(event) => handleDoctorImageError(event, doctor?.id || currentPatient.doctorId)}
            />
            <div className="min-w-0">
              <p className="font-heading font-extrabold text-base text-[#13213A] dark:text-white truncate">{currentPatient.doctorName}</p>
              <p className="text-xs text-[#087FC9] dark:text-[#38BDF8] font-bold">{currentPatient.department}</p>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{currentPatient.opdBlock}, {currentPatient.floor}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 rounded-xl border border-[#E5EDF5] dark:border-[#1E293B]">
              <Calendar className="w-3.5 h-3.5 text-[#087FC9] mb-1" />
              <p className="text-[#64748B] dark:text-[#94A3B8]">Date</p>
              <p className="font-bold text-[#13213A] dark:text-white">{formatAppointmentDate(currentPatient.appointmentDate)}</p>
            </div>
            <div className="p-3 rounded-xl border border-[#E5EDF5] dark:border-[#1E293B]">
              <Clock className="w-3.5 h-3.5 text-[#087FC9] mb-1" />
              <p className="text-[#64748B] dark:text-[#94A3B8]">Time</p>
              <p className="font-bold text-[#13213A] dark:text-white">{currentPatient.appointmentTime || currentPatient.createdAt}</p>
            </div>
            <div className="p-3 rounded-xl border border-[#E5EDF5] dark:border-[#1E293B]">
              <Stethoscope className="w-3.5 h-3.5 text-[#087FC9] mb-1" />
              <p className="text-[#64748B] dark:text-[#94A3B8]">Status</p>
              <p className="font-bold text-[#13213A] dark:text-white capitalize">{currentPatient.status.replace('_', ' ')}</p>
            </div>
            <div className="p-3 rounded-xl border border-[#E5EDF5] dark:border-[#1E293B]">
              <Ticket className="w-3.5 h-3.5 text-[#087FC9] mb-1" />
              <p className="text-[#64748B] dark:text-[#94A3B8]">Type</p>
              <p className="font-bold text-[#13213A] dark:text-white capitalize">{currentPatient.patientType}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={copyUHID} className="px-3 py-2.5 rounded-xl bg-[#F6F9FC] dark:bg-[#172033] border border-[#E5EDF5] dark:border-[#1E293B] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
              <Copy className="w-3.5 h-3.5 text-[#087FC9]" />
              <span>Copy UHID</span>
            </button>
            <button type="button" onClick={() => window.print()} className="px-3 py-2.5 rounded-xl bg-[#F6F9FC] dark:bg-[#172033] border border-[#E5EDF5] dark:border-[#1E293B] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
              <Printer className="w-3.5 h-3.5 text-[#087FC9]" />
              <span>Print</span>
            </button>
            <button type="button" onClick={sharePass} className="px-3 py-2.5 rounded-xl bg-[#F6F9FC] dark:bg-[#172033] border border-[#E5EDF5] dark:border-[#1E293B] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
              <Share2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Share</span>
            </button>
            <button
              type="button"
              onClick={requestWheelchair}
              className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                isWheelchairActive
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-[#F6F9FC] dark:bg-[#172033] border border-[#E5EDF5] dark:border-[#1E293B]'
              }`}
            >
              <Accessibility className="w-3.5 h-3.5" />
              <span>{isWheelchairActive ? 'Requested' : 'Assist'}</span>
            </button>
          </div>
        </aside>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card-healthcare bg-white dark:bg-[#111827] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-[#087FC9]" />
            <h2 className="font-heading font-extrabold text-sm text-[#13213A] dark:text-white">Route & Entry</h2>
          </div>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">Use Gate 1, follow Block B lift lobby signs, then proceed to {currentPatient.roomNumber}.</p>
          <button type="button" onClick={onOpenHospitalMap} className="text-xs font-bold text-[#087FC9] dark:text-[#38BDF8] cursor-pointer hover:underline">
            Open hospital map
          </button>
        </div>

        <div className="card-healthcare bg-white dark:bg-[#111827] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-[#7C3AED]" />
            <h2 className="font-heading font-extrabold text-sm text-[#13213A] dark:text-white">Pre-Test Status</h2>
          </div>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            {currentPatient.preTestOptIn
              ? currentPatient.preTestStatus === 'completed'
                ? 'Diagnostics completed and attached to your medical file.'
                : 'Diagnostics pending before consultation.'
              : 'No pre-consult diagnostics required for this pass.'}
          </p>
          <span className="inline-flex px-2.5 py-1 rounded-full bg-[#F3E8FF] dark:bg-[#2E1065] text-[#7C3AED] dark:text-[#C084FC] text-[10px] font-bold uppercase">
            {currentPatient.preTestStatus.replace('_', ' ')}
          </span>
        </div>

        <div className="card-healthcare bg-white dark:bg-[#111827] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#087FC9]" />
            <h2 className="font-heading font-extrabold text-sm text-[#13213A] dark:text-white">Appointment Link</h2>
          </div>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">This pass is linked with your appointment history and reminders.</p>
          <button type="button" onClick={onOpenAppointments} className="text-xs font-bold text-[#087FC9] dark:text-[#38BDF8] cursor-pointer hover:underline">
            View appointment center
          </button>
        </div>
      </section>
    </div>
  );
};
