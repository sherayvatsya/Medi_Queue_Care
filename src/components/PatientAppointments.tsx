import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Stethoscope,
  Ticket,
  Video,
  BellPlus,
  RotateCcw,
  ChevronRight,
  Plus,
  CheckCircle2,
  Activity,
} from 'lucide-react';
import { Doctor, Patient, PatientUser } from '../types';
import { getValidDoctorAvatar, handleDoctorImageError } from '../utils/doctorAvatar';

interface PatientAppointmentsProps {
  patients: Patient[];
  doctors: Doctor[];
  currentUser: PatientUser | null;
  currentPatient: Patient | null;
  onViewPass: (patientId: string) => void;
  onBookAppointment: () => void;
  onRequestTeleconsult: () => void;
  onShowToast?: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
}

type AppointmentFilter = 'upcoming' | 'completed' | 'all';

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

const getStatusLabel = (patient: Patient) => {
  if (patient.status === 'in_consultation') return 'In consultation';
  if (patient.status === 'completed') return 'Completed';
  if (patient.status === 'er_escalated') return 'Emergency escalated';
  if (patient.queuePosition === 0) return 'Ready now';
  return 'Upcoming';
};

const getStatusClass = (patient: Patient) => {
  if (patient.status === 'completed') return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  if (patient.status === 'er_escalated') return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900';
  if (patient.status === 'in_consultation') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900';
  return 'bg-sky-50 text-[#087FC9] border-sky-200 dark:bg-sky-950/40 dark:text-[#38BDF8] dark:border-sky-900';
};

export const PatientAppointments: React.FC<PatientAppointmentsProps> = ({
  patients,
  doctors,
  currentUser,
  currentPatient,
  onViewPass,
  onBookAppointment,
  onRequestTeleconsult,
  onShowToast,
}) => {
  const [filter, setFilter] = useState<AppointmentFilter>('upcoming');

  const userAppointments = useMemo(() => {
    const normalizedPhone = currentUser?.phone?.replace(/\D/g, '');
    const matchesUser = (patient: Patient) =>
      (currentUser?.id && patient.userId === currentUser.id) ||
      (currentUser?.uhid && patient.uhid?.toLowerCase() === currentUser.uhid.toLowerCase()) ||
      (normalizedPhone && patient.phone?.replace(/\D/g, '') === normalizedPhone);

    const appointments = patients.filter(matchesUser);
    if (!appointments.length && currentPatient) return [currentPatient];

    return appointments.sort((a, b) => {
      const aDate = `${a.appointmentDate || ''} ${a.appointmentTime || a.createdAt || ''}`;
      const bDate = `${b.appointmentDate || ''} ${b.appointmentTime || b.createdAt || ''}`;
      return bDate.localeCompare(aDate);
    });
  }, [currentPatient, currentUser, patients]);

  const filteredAppointments = userAppointments.filter((appointment) => {
    if (filter === 'all') return true;
    if (filter === 'completed') return appointment.status === 'completed';
    return appointment.status !== 'completed';
  });

  const upcomingCount = userAppointments.filter((appointment) => appointment.status !== 'completed').length;
  const completedCount = userAppointments.filter((appointment) => appointment.status === 'completed').length;
  const activePassCount = userAppointments.filter((appointment) => appointment.status === 'waiting' || appointment.status === 'in_consultation').length;

  const handleReminder = (appointment: Patient) => {
    onShowToast?.(
      'Reminder Added',
      `${appointment.department} visit reminder set for ${formatAppointmentDate(appointment.appointmentDate)} at ${appointment.appointmentTime || appointment.createdAt}.`,
      'success'
    );
  };

  const handleReschedule = (appointment: Patient) => {
    onShowToast?.(
      'Reschedule Request Sent',
      `${appointment.hospitalName || 'Hospital'} desk will confirm the next slot for token ${appointment.tokenNumber}.`,
      'info'
    );
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="card-healthcare bg-white dark:bg-[#111827] p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBF5FB] dark:bg-[#082F49] text-[#087FC9] dark:text-[#38BDF8] text-[11px] font-bold uppercase border border-[#BAE6FD]">
              <Calendar className="w-3.5 h-3.5" />
              <span>Appointment Center</span>
            </div>
            <div>
              <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#13213A] dark:text-white tracking-tight">
                My Appointments
              </h1>
              <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mt-1">
                Track OPD slots, live queue tokens, reminders, and tele-consult actions in one place.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onRequestTeleconsult}
              className="px-4 py-2.5 rounded-xl bg-white dark:bg-[#172033] border border-[#E5EDF5] dark:border-[#1E293B] text-[#087FC9] dark:text-[#38BDF8] text-xs font-bold flex items-center gap-2 hover:bg-[#F6F9FC] transition cursor-pointer"
            >
              <Video className="w-4 h-4" />
              <span>Tele-Consult</span>
            </button>
            <button
              type="button"
              onClick={onBookAppointment}
              className="px-4 py-2.5 rounded-xl bg-[#087FC9] hover:bg-[#006EAF] text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-[#087FC9]/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Book New OPD</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          {[
            { label: 'Upcoming', value: upcomingCount, icon: Calendar, color: 'text-[#087FC9]' },
            { label: 'Active Passes', value: activePassCount, icon: Ticket, color: 'text-emerald-600' },
            { label: 'Completed', value: completedCount, icon: CheckCircle2, color: 'text-slate-600 dark:text-slate-300' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="p-4 rounded-2xl bg-[#F6F9FC] dark:bg-[#172033] border border-[#E5EDF5] dark:border-[#1E293B]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">{item.label}</span>
                  <Icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <p className="font-heading text-2xl font-extrabold text-[#13213A] dark:text-white mt-2">{item.value}</p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 'upcoming' as const, label: 'Upcoming' },
          { id: 'completed' as const, label: 'Completed' },
          { id: 'all' as const, label: 'All' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
              filter === item.id
                ? 'bg-[#087FC9] border-[#087FC9] text-white shadow-md shadow-[#087FC9]/20'
                : 'bg-white dark:bg-[#111827] border-[#E5EDF5] dark:border-[#1E293B] text-[#64748B] dark:text-[#94A3B8] hover:text-[#13213A] dark:hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="space-y-3">
        {filteredAppointments.length ? (
          filteredAppointments.map((appointment) => {
            const doctor = doctors.find((doc) => doc.id === appointment.doctorId);
            return (
              <article key={appointment.id} className="card-healthcare bg-white dark:bg-[#111827] p-4 sm:p-5">
                <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <img
                      src={getValidDoctorAvatar(doctor?.id || appointment.doctorId, doctor?.avatar)}
                      alt={appointment.doctorName}
                      className="w-14 h-14 rounded-2xl object-cover border border-[#E5EDF5] dark:border-[#1E293B] shrink-0"
                      onError={(event) => handleDoctorImageError(event, doctor?.id || appointment.doctorId)}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-heading font-extrabold text-base text-[#13213A] dark:text-white truncate">
                          {appointment.doctorName}
                        </h2>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusClass(appointment)}`}>
                          {getStatusLabel(appointment)}
                        </span>
                      </div>
                      <p className="text-xs text-[#087FC9] dark:text-[#38BDF8] font-bold mt-1">{appointment.department}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3 text-xs">
                        <span className="flex items-center gap-1.5 text-[#64748B] dark:text-[#94A3B8]">
                          <Calendar className="w-3.5 h-3.5 text-[#087FC9]" />
                          {formatAppointmentDate(appointment.appointmentDate)}
                        </span>
                        <span className="flex items-center gap-1.5 text-[#64748B] dark:text-[#94A3B8]">
                          <Clock className="w-3.5 h-3.5 text-[#087FC9]" />
                          {appointment.appointmentTime || appointment.createdAt}
                        </span>
                        <span className="flex items-center gap-1.5 text-[#64748B] dark:text-[#94A3B8]">
                          <MapPin className="w-3.5 h-3.5 text-[#087FC9]" />
                          {appointment.opdBlock}, {appointment.floor}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-2 xl:w-72">
                    <button
                      type="button"
                      onClick={() => onViewPass(appointment.id)}
                      className="px-3 py-2.5 rounded-xl bg-[#EBF5FB] dark:bg-[#082F49] text-[#087FC9] dark:text-[#38BDF8] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-sky-100 dark:hover:bg-sky-950 transition cursor-pointer"
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      <span>Pass</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReminder(appointment)}
                      className="px-3 py-2.5 rounded-xl bg-white dark:bg-[#172033] border border-[#E5EDF5] dark:border-[#1E293B] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#F6F9FC] transition cursor-pointer"
                    >
                      <BellPlus className="w-3.5 h-3.5 text-amber-500" />
                      <span>Reminder</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReschedule(appointment)}
                      className="px-3 py-2.5 rounded-xl bg-white dark:bg-[#172033] border border-[#E5EDF5] dark:border-[#1E293B] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#F6F9FC] transition cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#64748B]" />
                      <span>Reschedule</span>
                    </button>
                    <button
                      type="button"
                      onClick={onRequestTeleconsult}
                      className="px-3 py-2.5 rounded-xl bg-[#F3E8FF] dark:bg-[#2E1065] text-[#7C3AED] dark:text-[#C084FC] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#EDE9FE] transition cursor-pointer"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Video</span>
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-[#E5EDF5] dark:border-[#1E293B] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-[#64748B] dark:text-[#94A3B8]">
                    <Stethoscope className="w-4 h-4 text-emerald-600" />
                    <span>
                      Token <strong className="text-[#13213A] dark:text-white">{appointment.tokenNumber}</strong>
                      {appointment.queuePosition > 0 ? `, ${appointment.queuePosition} ahead, about ${appointment.estimatedWaitMinutes} mins` : ', ready for room'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onViewPass(appointment.id)}
                    className="text-[#087FC9] dark:text-[#38BDF8] font-bold flex items-center gap-1 cursor-pointer hover:underline self-start sm:self-auto"
                  >
                    <span>Open live details</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </article>
            );
          })
        ) : (
          <div className="card-healthcare bg-white dark:bg-[#111827] p-8 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#EBF5FB] dark:bg-[#082F49] text-[#087FC9] dark:text-[#38BDF8] flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
            <h2 className="font-heading font-extrabold text-lg text-[#13213A] dark:text-white mt-4">No appointments in this view</h2>
            <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mt-1">Book a new OPD visit or switch filters to see older appointments.</p>
            <button
              type="button"
              onClick={onBookAppointment}
              className="mt-4 px-4 py-2.5 rounded-xl bg-[#087FC9] text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Book OPD Visit</span>
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
