import React, { useState, useEffect } from 'react';
import { Patient, Doctor, StaffUser } from '../types';
import { playHospitalChime, playUrgentAlertSound } from '../utils/audio';

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  doctor: Doctor | null;
  allDoctors: Doctor[];
  allPatients: Patient[];
  staffUser?: StaffUser | null;
  onConfirmReschedule: (
    patientId: string,
    newDate: string,
    newTime: string,
    reason: string,
    customReason?: string,
    newRoom?: string
  ) => void;
}

const PRESET_REASONS = [
  'Doctor running late',
  'Doctor emergency case',
  'Doctor temporarily unavailable',
  'Doctor schedule changed',
  'Hospital emergency / casualty surge',
  'Patient requested reschedule',
  'Other (Specify custom clinical reason)',
];

// Helper to format date to human readable string
function formatDisplayDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// Generate time slots between 08:30 AM and 05:30 PM
function generateTimeSlots(): string[] {
  const slots: string[] = [];
  const startHour = 8;
  const startMin = 30;
  const endHour = 17;
  const endMin = 30;

  let current = startHour * 60 + startMin;
  const end = endHour * 60 + endMin;

  while (current <= end) {
    const hour = Math.floor(current / 60);
    const min = current % 60;
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    const formattedMin = min < 10 ? `0${min}` : `${min}`;
    const formattedHour = displayHour < 10 ? `0${displayHour}` : `${displayHour}`;
    slots.push(`${formattedHour}:${formattedMin} ${period}`);
    current += 15; // 15-minute slot increments
  }
  return slots;
}

const ALL_SLOTS = generateTimeSlots();

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  isOpen,
  onClose,
  patient,
  doctor,
  allDoctors,
  allPatients,
  staffUser,
  onConfirmReschedule,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [selectedReason, setSelectedReason] = useState<string>('Doctor running late');
  const [customReasonText, setCustomReasonText] = useState<string>('');
  const [staffNotes, setStaffNotes] = useState<string>('');
  const [showConfirmStep, setShowConfirmStep] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize modal state when opened
  useEffect(() => {
    if (patient) {
      const pDate = patient.appointmentDate || todayStr;
      setSelectedDate(pDate >= todayStr ? pDate : todayStr);
      setSelectedTime(patient.appointmentTime || '10:30 AM');
      setSelectedRoom(patient.roomNumber || doctor?.roomNumber || 'Room 204');
      setSelectedReason('Doctor running late');
      setCustomReasonText('');
      setStaffNotes('');
      setShowConfirmStep(false);
      setValidationError(null);
    }
  }, [patient, doctor, todayStr, isOpen]);

  if (!isOpen || !patient) return null;

  const currentDoctor = doctor || allDoctors.find((d) => d.id === patient.doctorId) || allDoctors[0];
  const isInSession = patient.status === 'in_consultation';
  const isCompleted = patient.status === 'completed';

  // Check which slots are already booked for this doctor on the selected date
  const bookedSlotsMap = new Map<string, Patient>();
  allPatients.forEach((p) => {
    if (
      p.id !== patient.id &&
      p.doctorId === currentDoctor?.id &&
      p.status !== 'completed' &&
      p.appointmentDate === selectedDate &&
      p.appointmentTime
    ) {
      bookedSlotsMap.set(p.appointmentTime.trim().toUpperCase(), p);
    }
  });

  const handleSlotClick = (slot: string) => {
    if (bookedSlotsMap.has(slot.toUpperCase())) return;
    setSelectedTime(slot);
    setValidationError(null);
    playHospitalChime();
  };

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();

    if (isInSession) {
      setValidationError('Appointment is currently in active session with the doctor.');
      playUrgentAlertSound();
      return;
    }

    if (isCompleted) {
      setValidationError('This consultation has already been completed.');
      return;
    }

    if (!selectedDate) {
      setValidationError('Please select a valid appointment date.');
      return;
    }

    if (selectedDate < todayStr) {
      setValidationError('Cannot reschedule appointment to a past date.');
      return;
    }

    if (!selectedTime) {
      setValidationError('Please select a consultation time slot.');
      return;
    }

    if (bookedSlotsMap.has(selectedTime.trim().toUpperCase())) {
      setValidationError(`Slot ${selectedTime} is already booked for Dr. ${currentDoctor.name}. Please select another slot.`);
      playUrgentAlertSound();
      return;
    }

    if (selectedReason.startsWith('Other') && !customReasonText.trim()) {
      setValidationError('Please enter a clinical reason for rescheduling.');
      return;
    }

    setValidationError(null);
    setShowConfirmStep(true);
    playHospitalChime();
  };

  const handleFinalConfirm = () => {
    const finalReason = selectedReason.startsWith('Other')
      ? customReasonText.trim() || 'Clinical schedule change'
      : selectedReason;

    const fullReasonWithNotes = staffNotes.trim()
      ? `${finalReason} (${staffNotes.trim()})`
      : finalReason;

    onConfirmReschedule(
      patient.id,
      selectedDate,
      selectedTime,
      finalReason,
      fullReasonWithNotes,
      selectedRoom || currentDoctor.roomNumber
    );

    setShowConfirmStep(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden box-border">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              <i className="fa-solid fa-clock-rotate-left"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900">
                  Reschedule Patient Appointment
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                  Staff Control
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Hospital OPD Scheduling & Delay Management
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-xs transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {/* Active Session / Completed Alerts */}
          {isInSession && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-3 animate-pulse">
              <i className="fa-solid fa-triangle-exclamation text-amber-600 text-lg mt-0.5 shrink-0"></i>
              <div>
                <strong className="block font-bold text-xs sm:text-sm">
                  ⚠️ In-Session Guard Active
                </strong>
                <p className="mt-0.5 leading-relaxed text-xs">
                  This patient is currently in session (in consultation) with {currentDoctor.name}. Normal rescheduling is disabled while the doctor is actively seeing the patient.
                </p>
              </div>
            </div>
          )}

          {isCompleted && (
            <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-300 text-slate-700 flex items-center gap-3">
              <i className="fa-solid fa-circle-check text-slate-500 text-base shrink-0"></i>
              <div>
                <strong>Consultation Completed:</strong> This appointment was already completed today.
              </div>
            </div>
          )}

          {/* Validation Error Banner */}
          {validationError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 flex items-center gap-2.5">
              <i className="fa-solid fa-circle-exclamation text-rose-600 text-sm shrink-0"></i>
              <span className="font-semibold">{validationError}</span>
            </div>
          )}

          {/* CURRENT APPOINTMENT SUMMARY CARD */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Current Booking Details
              </span>
              <span className="font-mono font-bold text-xs text-sky-700 bg-sky-100 px-2 py-0.5 rounded-md border border-sky-200">
                Token #{patient.tokenNumber}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-slate-400 text-[11px]">Patient Name:</span>
                <div className="font-bold text-slate-900 text-xs sm:text-sm">
                  {patient.name} ({patient.age}y / {patient.gender})
                </div>
                <div className="font-mono text-slate-500 text-[11px] mt-0.5">
                  UHID: {patient.uhid}
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-[11px]">Assigned Doctor:</span>
                <div className="font-bold text-slate-900 text-xs sm:text-sm">
                  {currentDoctor.name}
                </div>
                <div className="text-sky-600 font-medium text-[11px] mt-0.5">
                  {patient.department} • {patient.roomNumber} ({patient.opdBlock})
                </div>
              </div>

              <div className="sm:col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                <div>
                  <span className="text-slate-400">Current Scheduled Time: </span>
                  <strong className="text-slate-900 font-mono">
                    {patient.appointmentTime || patient.createdAt || '10:00 AM'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400">Date: </span>
                  <strong className="text-slate-800">
                    {formatDisplayDate(patient.appointmentDate || todayStr)}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {!showConfirmStep ? (
            /* STEP 1: FORM INPUTS */
            <form onSubmit={handleProceedToConfirm} className="space-y-4">
              {/* Date Selector & Room */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <i className="fa-solid fa-calendar-day text-sky-500"></i>
                      <span>New Appointment Date</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Min: Today</span>
                  </label>
                  <input
                    type="date"
                    min={todayStr}
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setValidationError(null);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-semibold focus:outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 cursor-pointer"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <i className="fa-solid fa-door-open text-sky-500"></i>
                      <span>Consultation Room</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Optional override</span>
                  </label>
                  <input
                    type="text"
                    value={selectedRoom}
                    onChange={(e) => setSelectedRoom(e.target.value)}
                    placeholder="e.g. Room 204"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-semibold focus:outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
              </div>

              {/* Time Slots Selector with Visual Distinction */}
              <div className="space-y-2 pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="block text-slate-800 font-bold flex items-center gap-1.5">
                    <i className="fa-solid fa-clock text-sky-500"></i>
                    <span>Select Time Slot ({selectedDate === todayStr ? 'Today' : selectedDate})</span>
                  </label>
                  <div className="flex items-center gap-2.5 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Available
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-400"></span> Booked
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-sky-500"></span> Selected
                    </span>
                  </div>
                </div>

                {/* Slots Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-2 rounded-2xl bg-slate-50 border border-slate-200">
                  {ALL_SLOTS.map((slot) => {
                    const isBooked = bookedSlotsMap.has(slot.toUpperCase());
                    const isSelected = selectedTime === slot;
                    const bookedPat = bookedSlotsMap.get(slot.toUpperCase());

                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={isBooked}
                        onClick={() => handleSlotClick(slot)}
                        title={isBooked ? `Booked by #${bookedPat?.tokenNumber} (${bookedPat?.name})` : `Select ${slot}`}
                        className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center justify-center cursor-pointer relative ${
                          isSelected
                            ? 'bg-sky-500 text-white shadow-md ring-2 ring-sky-500/30'
                            : isBooked
                            ? 'bg-slate-200/80 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                            : 'bg-white hover:bg-sky-50 hover:border-sky-300 text-slate-800 border border-slate-200 shadow-2xs'
                        }`}
                      >
                        <span className="font-mono">{slot}</span>
                        {isBooked && (
                          <span className="text-[8px] text-rose-600 font-normal truncate max-w-full">
                            Booked
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-[8px] text-sky-100 font-normal">
                            ✓ Chosen
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Selected Slot Display & Custom Time override */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-900">
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-circle-check text-sky-600 text-sm"></i>
                    <span>
                      Selected New Time: <strong className="font-mono text-slate-900">{selectedTime || 'None selected'}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500">Custom:</span>
                    <input
                      type="text"
                      value={selectedTime}
                      onChange={(e) => {
                        setSelectedTime(e.target.value);
                        setValidationError(null);
                      }}
                      placeholder="e.g. 11:45 AM"
                      className="w-24 px-2 py-1 rounded-lg bg-white border border-sky-300 text-xs font-mono font-bold text-slate-900 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Reason for Change (Required) */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <label className="block text-slate-800 font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <i className="fa-solid fa-clipboard-question text-sky-500"></i>
                    <span>Reason for Appointment Reschedule <span className="text-rose-500">*</span></span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Stored in audit history</span>
                </label>

                <select
                  value={selectedReason}
                  onChange={(e) => {
                    setSelectedReason(e.target.value);
                    setValidationError(null);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-semibold focus:outline-hidden focus:border-sky-500 cursor-pointer"
                  required
                >
                  {PRESET_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                {selectedReason.startsWith('Other') && (
                  <div className="animate-in fade-in duration-200">
                    <input
                      type="text"
                      value={customReasonText}
                      onChange={(e) => setCustomReasonText(e.target.value)}
                      placeholder="Enter specific clinical reason or emergency details..."
                      className="w-full px-3 py-2 rounded-xl bg-white border border-sky-400 text-slate-900 text-xs focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 font-medium"
                      autoFocus
                      required
                    />
                  </div>
                )}

                {/* Additional Clinical Notes */}
                <div>
                  <textarea
                    value={staffNotes}
                    onChange={(e) => setStaffNotes(e.target.value)}
                    placeholder="Optional staff operational notes (e.g., patient notified via phone, shifted due to emergency bypass)..."
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-hidden focus:border-sky-500 h-14"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInSession || isCompleted}
                  className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold transition flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Review & Confirm</span>
                  <i className="fa-solid fa-arrow-right text-xs"></i>
                </button>
              </div>
            </form>
          ) : (
            /* STEP 2: CONFIRMATION SUMMARY DIALOG */
            <div className="space-y-4 animate-in zoom-in-95 duration-150">
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-300 text-amber-950 space-y-3">
                <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                  <i className="fa-solid fa-circle-question text-base text-amber-600"></i>
                  <span>Confirm Appointment Reschedule?</span>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  Please review the schedule change before applying. This will update the patient's queue pass and broadcast an instant alert.
                </p>

                <div className="p-3.5 rounded-xl bg-white border border-amber-200 space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">Patient:</span>
                    <strong className="text-slate-900 font-bold">{patient.name} ({patient.uhid})</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">Doctor:</span>
                    <strong className="text-slate-900 font-bold">{currentDoctor.name} ({currentDoctor.department})</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">Previous Schedule:</span>
                    <span className="font-mono text-slate-500 line-through">
                      {formatDisplayDate(patient.appointmentDate || todayStr)} at {patient.appointmentTime || '10:00 AM'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-emerald-700 font-bold">New Schedule:</span>
                    <strong className="font-mono text-emerald-700 font-extrabold text-sm">
                      {formatDisplayDate(selectedDate)} at {selectedTime}
                    </strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">Consultation Room:</span>
                    <span className="font-mono font-bold text-slate-800">{selectedRoom || currentDoctor.roomNumber}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">Reason:</span>
                    <strong className="text-sky-700">{selectedReason.startsWith('Other') ? customReasonText : selectedReason}</strong>
                  </div>
                  <div className="flex justify-between text-[11px] pt-0.5">
                    <span className="text-slate-400">Authorized By:</span>
                    <span className="text-slate-600 font-semibold">{staffUser?.name || 'Authorized Staff'} (ID: {staffUser?.staffId || 'MQ-STAFF'})</span>
                  </div>
                </div>
              </div>

              {/* Confirmation Buttons */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmStep(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-arrow-left text-xs"></i>
                  <span>Back to Edit</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleFinalConfirm}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition flex items-center gap-2 shadow-md cursor-pointer"
                  >
                    <i className="fa-solid fa-check"></i>
                    <span>Confirm & Update Schedule</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
