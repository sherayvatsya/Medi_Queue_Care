import React, { useState, useEffect } from 'react';
import { Doctor, Patient, DoctorStatus, ShiftAffectedAppointment, StaffUser } from '../types';
import { playHospitalChime, playUrgentAlertSound } from '../utils/audio';
import { getValidDoctorAvatar, handleDoctorImageError } from '../utils/doctorAvatar';

interface DoctorScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctor: Doctor | null;
  patients: Patient[];
  staffUser?: StaffUser | null;
  onSaveSchedule: (
    doctorId: string,
    newStatus: DoctorStatus,
    delayMinutes?: number,
    expectedReturnTime?: string,
    reason?: string,
    affectedAppointments?: { patientId: string; newTime: string; isIncluded: boolean }[]
  ) => void;
}

// Add minutes to a time string like "10:00 AM" or "09:30 AM"
function shiftTimeString(timeStr: string, addMinutes: number): string {
  if (!timeStr) return '';
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) {
    // If not matching standard format, calculate from current time
    const now = new Date();
    now.setMinutes(now.getMinutes() + addMinutes);
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase() || 'AM';

  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  const totalMin = hours * 60 + minutes + addMinutes;
  const newHour24 = Math.floor(totalMin / 60) % 24;
  const newMin = totalMin % 60;

  const newPeriod = newHour24 >= 12 ? 'PM' : 'AM';
  const displayHour = newHour24 > 12 ? newHour24 - 12 : newHour24 === 0 ? 12 : newHour24;
  const formattedHour = displayHour < 10 ? `0${displayHour}` : `${displayHour}`;
  const formattedMin = newMin < 10 ? `0${newMin}` : `${newMin}`;

  return `${formattedHour}:${formattedMin} ${newPeriod}`;
}

export const DoctorScheduleModal: React.FC<DoctorScheduleModalProps> = ({
  isOpen,
  onClose,
  doctor,
  patients,
  staffUser,
  onSaveSchedule,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<DoctorStatus>('in_room');
  const [delayPreset, setDelayPreset] = useState<number>(30);
  const [customDelayMin, setCustomDelayMin] = useState<string>('');
  const [expectedReturnTime, setExpectedReturnTime] = useState<string>('11:30 AM');
  const [scheduleReason, setScheduleReason] = useState<string>('Doctor running late due to morning rounds');
  const [customReasonText, setCustomReasonText] = useState<string>('');
  const [affectedList, setAffectedList] = useState<ShiftAffectedAppointment[]>([]);
  const [showConfirmStep, setShowConfirmStep] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize affected list when doctor changes
  useEffect(() => {
    if (doctor) {
      setSelectedStatus(doctor.status || 'in_room');
      setDelayPreset(doctor.delayMinutes || 30);
      setExpectedReturnTime(doctor.emergencyUnavailableUntil || '11:30 AM');
      setScheduleReason(doctor.delayReason || doctor.emergencyReason || 'Doctor running late due to morning rounds');
      setShowConfirmStep(false);
      setValidationError(null);

      // Filter waiting patients for this doctor
      const waitingPatients = patients.filter(
        (p) => p.doctorId === doctor.id && p.status === 'waiting'
      );

      const computedDelay = doctor.delayMinutes || 30;

      const initialAffected: ShiftAffectedAppointment[] = waitingPatients.map((p, idx) => {
        const orig = p.appointmentTime || p.createdAt || `10:${15 * (idx + 1)} AM`;
        const suggested = shiftTimeString(orig, computedDelay);
        return {
          patientId: p.id,
          tokenNumber: p.tokenNumber,
          patientName: p.name,
          uhid: p.uhid,
          originalTime: orig,
          suggestedTime: suggested,
          status: p.status,
          isIncluded: true,
        };
      });

      setAffectedList(initialAffected);
    }
  }, [doctor, patients, isOpen]);

  // Recalculate suggested times whenever delay changes
  const effectiveDelay = customDelayMin ? parseInt(customDelayMin, 10) || 30 : delayPreset;

  const handleDelayPresetChange = (mins: number) => {
    setDelayPreset(mins);
    setCustomDelayMin('');
    setAffectedList((prev) =>
      prev.map((item) => ({
        ...item,
        suggestedTime: shiftTimeString(item.originalTime, mins),
      }))
    );
    playHospitalChime();
  };

  const handleCustomDelayChange = (val: string) => {
    setCustomDelayMin(val);
    const mins = parseInt(val, 10) || 0;
    if (mins > 0) {
      setAffectedList((prev) =>
        prev.map((item) => ({
          ...item,
          suggestedTime: shiftTimeString(item.originalTime, mins),
        }))
      );
    }
  };

  const handleTogglePatientIncluded = (patientId: string) => {
    setAffectedList((prev) =>
      prev.map((item) =>
        item.patientId === patientId ? { ...item, isIncluded: !item.isIncluded } : item
      )
    );
  };

  const handlePatientCustomTimeChange = (patientId: string, customTime: string) => {
    setAffectedList((prev) =>
      prev.map((item) =>
        item.patientId === patientId ? { ...item, suggestedTime: customTime } : item
      )
    );
  };

  const handleSelectAllAffected = (selectAll: boolean) => {
    setAffectedList((prev) =>
      prev.map((item) => ({ ...item, isIncluded: selectAll }))
    );
  };

  if (!isOpen || !doctor) return null;

  const activeWaitingCount = patients.filter(
    (p) => p.doctorId === doctor.id && p.status === 'waiting'
  ).length;

  const includedCount = affectedList.filter((a) => a.isIncluded).length;

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setShowConfirmStep(true);
    playHospitalChime();
  };

  const handleFinalConfirm = () => {
    const finalReason = customReasonText.trim() || scheduleReason;

    const formattedShifts = affectedList
      .filter((a) => a.isIncluded)
      .map((a) => ({
        patientId: a.patientId,
        newTime: a.suggestedTime,
        isIncluded: true,
      }));

    onSaveSchedule(
      doctor.id,
      selectedStatus,
      selectedStatus === 'running_late' ? effectiveDelay : undefined,
      selectedStatus === 'emergency' ? expectedReturnTime : undefined,
      finalReason,
      formattedShifts
    );

    setShowConfirmStep(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden box-border">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <img
              src={getValidDoctorAvatar(doctor.id, doctor.avatar)}
              alt={doctor.name}
              onError={(e) => handleDoctorImageError(e, doctor.id)}
              className="w-11 h-11 rounded-2xl object-cover border border-slate-200 bg-slate-100 shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900">
                  Manage Doctor Schedule & Delay
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                  Doctor Availability
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {doctor.name} • {doctor.specialty} ({doctor.roomNumber})
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
          {validationError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation text-rose-600"></i>
              <span>{validationError}</span>
            </div>
          )}

          {!showConfirmStep ? (
            <form onSubmit={handleProceedToConfirm} className="space-y-4">
              {/* Doctor Status Selector Buttons */}
              <div>
                <label className="block text-slate-800 font-bold mb-2 flex items-center justify-between">
                  <span>1. Select Doctor Current Operational Status</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    {activeWaitingCount} patients waiting in queue
                  </span>
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      id: 'in_room' as DoctorStatus,
                      label: 'Active / Available',
                      desc: 'In consult room, on schedule',
                      icon: 'fa-circle-check',
                      badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-300',
                      activeRing: 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20',
                    },
                    {
                      id: 'running_late' as DoctorStatus,
                      label: 'Running Late',
                      desc: 'Delayed due to rounds/traffic',
                      icon: 'fa-clock-rotate-left',
                      badgeColor: 'text-amber-700 bg-amber-50 border-amber-300',
                      activeRing: 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20',
                    },
                    {
                      id: 'emergency' as DoctorStatus,
                      label: 'Emergency Case',
                      desc: 'Called to ER / Trauma / OT',
                      icon: 'fa-truck-medical',
                      badgeColor: 'text-rose-700 bg-rose-50 border-rose-300',
                      activeRing: 'border-rose-500 bg-rose-50/60 ring-2 ring-rose-500/20',
                    },
                    {
                      id: 'on_break' as DoctorStatus,
                      label: 'On Break',
                      desc: 'Short 15-30 min pause',
                      icon: 'fa-mug-hot',
                      badgeColor: 'text-amber-800 bg-amber-50 border-amber-300',
                      activeRing: 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20',
                    },
                    {
                      id: 'shifted_room' as DoctorStatus,
                      label: 'Shifted Room',
                      desc: 'Relocated to alternate suite',
                      icon: 'fa-door-open',
                      badgeColor: 'text-sky-700 bg-sky-50 border-sky-300',
                      activeRing: 'border-sky-500 bg-sky-50/50 ring-2 ring-sky-500/20',
                    },
                    {
                      id: 'unavailable' as DoctorStatus,
                      label: 'Unavailable',
                      desc: 'Off-duty / Leaves for day',
                      icon: 'fa-ban',
                      badgeColor: 'text-slate-700 bg-slate-100 border-slate-300',
                      activeRing: 'border-slate-500 bg-slate-100 ring-2 ring-slate-400/20',
                    },
                  ].map((st) => {
                    const isSelected = selectedStatus === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          setSelectedStatus(st.id);
                          if (st.id === 'emergency') playUrgentAlertSound();
                          else playHospitalChime();
                        }}
                        className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? st.activeRing + ' shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <i className={`fa-solid ${st.icon} ${isSelected ? 'text-sky-600' : 'text-slate-400'} text-sm`}></i>
                          {isSelected && (
                            <span className="w-4 h-4 rounded-full bg-sky-500 text-white flex items-center justify-center text-[9px]">
                              ✓
                            </span>
                          )}
                        </div>
                        <div className="mt-2">
                          <div className="font-bold text-slate-900 text-xs">{st.label}</div>
                          <div className="text-[10px] text-slate-500 leading-tight mt-0.5">{st.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* RUNNING LATE DETAILS */}
              {selectedStatus === 'running_late' && (
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-900 flex items-center gap-1.5">
                      <i className="fa-solid fa-hourglass-half text-amber-600"></i>
                      <span>Select Estimated Delay Duration:</span>
                    </span>
                    <span className="text-[11px] font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      +{effectiveDelay} mins delay
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[15, 30, 45, 60].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => handleDelayPresetChange(mins)}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                          delayPreset === mins && !customDelayMin
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-white text-amber-900 border border-amber-300 hover:bg-amber-100'
                        }`}
                      >
                        +{mins} mins
                      </button>
                    ))}

                    <div className="flex items-center gap-1.5 ml-auto">
                      <span className="text-slate-500 text-[11px]">Custom:</span>
                      <input
                        type="number"
                        min="5"
                        max="240"
                        placeholder="min"
                        value={customDelayMin}
                        onChange={(e) => handleCustomDelayChange(e.target.value)}
                        className="w-16 px-2.5 py-1 rounded-xl bg-white border border-amber-300 text-xs font-mono font-bold text-slate-900 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* EMERGENCY DETAILS */}
              {selectedStatus === 'emergency' && (
                <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-300 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 text-rose-950 font-bold">
                    <i className="fa-solid fa-triangle-exclamation text-rose-600 text-base"></i>
                    <span>Emergency Mode: Doctor called to Trauma / Casualty / OT</span>
                  </div>
                  <p className="text-[11px] text-rose-900">
                    Expected unavailable time will be displayed to waiting patients. You can shift their appointments or keep them queued.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Expected Return Time:</label>
                      <input
                        type="text"
                        value={expectedReturnTime}
                        onChange={(e) => setExpectedReturnTime(e.target.value)}
                        placeholder="e.g. 11:30 AM or ~45 mins"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-rose-300 text-slate-900 font-semibold focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Emergency Department / Bay:</label>
                      <input
                        type="text"
                        defaultValue="Casualty Trauma OT Bay 1"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-rose-300 text-slate-900 font-semibold focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Reason / Notes */}
              <div>
                <label className="block text-slate-800 font-bold mb-1.5">
                  Reason for Schedule Change / Patient Notice:
                </label>
                <select
                  value={scheduleReason}
                  onChange={(e) => setScheduleReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-semibold focus:outline-hidden focus:border-sky-500 cursor-pointer"
                >
                  <option value="Doctor running late due to morning ward rounds">
                    Doctor running late due to morning ward rounds
                  </option>
                  <option value="Doctor attending emergency trauma case in OT">
                    Doctor attending emergency trauma case in OT
                  </option>
                  <option value="Doctor temporarily unavailable - Delayed start">
                    Doctor temporarily unavailable - Delayed start
                  </option>
                  <option value="Hospital emergency diversion in progress">
                    Hospital emergency diversion in progress
                  </option>
                  <option value="Short clinical break / Brief pause in consults">
                    Short clinical break / Brief pause in consults
                  </option>
                  <option value="Other">Other custom clinical notice</option>
                </select>

                {scheduleReason === 'Other' && (
                  <input
                    type="text"
                    value={customReasonText}
                    onChange={(e) => setCustomReasonText(e.target.value)}
                    placeholder="Type custom schedule reason..."
                    className="w-full mt-2 px-3 py-2 rounded-xl bg-white border border-sky-400 text-slate-900 focus:outline-hidden"
                    autoFocus
                  />
                )}
              </div>

              {/* AUTOMATIC APPOINTMENT SHIFTING SECTION */}
              {(selectedStatus === 'running_late' || selectedStatus === 'emergency') && affectedList.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div>
                      <span className="font-bold text-slate-900 text-xs block">
                        2. Adjust Affected Patient Appointments ({includedCount} of {affectedList.length} selected)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Review suggested shifted times. Staff confirmation required to apply.
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectAllAffected(true)}
                        className="text-[10px] text-sky-600 font-bold hover:underline cursor-pointer"
                      >
                        Select All
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => handleSelectAllAffected(false)}
                        className="text-[10px] text-slate-500 font-bold hover:underline cursor-pointer"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  {/* Affected Patients Table */}
                  <div className="rounded-2xl border border-slate-200 overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <th className="py-2.5 px-3 w-8">✓</th>
                          <th className="py-2.5 px-3">Patient & Token</th>
                          <th className="py-2.5 px-3">Original Time</th>
                          <th className="py-2.5 px-3">New Suggested Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {affectedList.map((item) => (
                          <tr
                            key={item.patientId}
                            className={`hover:bg-slate-50 transition ${
                              item.isIncluded ? 'bg-sky-50/30' : 'opacity-50'
                            }`}
                          >
                            <td className="py-2.5 px-3">
                              <input
                                type="checkbox"
                                checked={item.isIncluded}
                                onChange={() => handleTogglePatientIncluded(item.patientId)}
                                className="w-4 h-4 rounded text-sky-500 accent-sky-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">{item.patientName}</div>
                              <span className="text-[10px] font-mono text-sky-600 font-bold bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200">
                                #{item.tokenNumber}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-500">
                              {item.originalTime}
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                value={item.suggestedTime}
                                onChange={(e) =>
                                  handlePatientCustomTimeChange(item.patientId, e.target.value)
                                }
                                disabled={!item.isIncluded}
                                className="w-24 px-2 py-1 rounded-lg bg-white border border-slate-300 font-mono text-xs font-bold text-emerald-700 focus:outline-hidden focus:border-emerald-500"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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
                  className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <span>Review Schedule Changes</span>
                  <i className="fa-solid fa-arrow-right text-xs"></i>
                </button>
              </div>
            </form>
          ) : (
            /* STEP 2: CONFIRMATION STEP */
            <div className="space-y-4 animate-in zoom-in-95 duration-150">
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-300 text-amber-950 space-y-3">
                <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                  <i className="fa-solid fa-circle-exclamation text-amber-600 text-base"></i>
                  <span>Confirm Schedule Update & Broadcast Alerts</span>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  You are updating {doctor.name}'s schedule to <strong>{selectedStatus.toUpperCase().replace('_', ' ')}</strong>.
                  {includedCount > 0 && ` ${includedCount} waiting patient appointments will be shifted and their Patient Passes updated in real-time.`}
                </p>

                <div className="p-3.5 rounded-xl bg-white border border-amber-200 space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">Doctor:</span>
                    <strong className="text-slate-900">{doctor.name} ({doctor.department})</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">New Status:</span>
                    <strong className="text-sky-700 font-bold uppercase">{selectedStatus.replace('_', ' ')}</strong>
                  </div>
                  {selectedStatus === 'running_late' && (
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">Estimated Delay:</span>
                      <strong className="font-mono text-amber-700">+{effectiveDelay} minutes</strong>
                    </div>
                  )}
                  {selectedStatus === 'emergency' && (
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">Expected Unavailable Until:</span>
                      <strong className="font-mono text-rose-700">{expectedReturnTime}</strong>
                    </div>
                  )}
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">Notice Reason:</span>
                    <span className="text-slate-800 font-medium">{customReasonText.trim() || scheduleReason}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">Affected Patients Shifted:</span>
                    <strong className="text-emerald-700">{includedCount} Patients</strong>
                  </div>
                  <div className="flex justify-between text-[11px] pt-0.5">
                    <span className="text-slate-400">Authorized Staff:</span>
                    <span className="text-slate-600 font-semibold">{staffUser?.name || 'Staff User'}</span>
                  </div>
                </div>
              </div>

              {/* Confirm Actions */}
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
                    <span>Apply & Broadcast to Passes</span>
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
