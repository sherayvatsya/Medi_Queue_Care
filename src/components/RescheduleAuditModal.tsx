import React, { useState } from 'react';
import { RescheduleAudit, Doctor } from '../types';

interface RescheduleAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  audits: RescheduleAudit[];
  doctors: Doctor[];
}

export const RescheduleAuditModal: React.FC<RescheduleAuditModalProps> = ({
  isOpen,
  onClose,
  audits,
  doctors,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState<string>('All');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const filteredAudits = audits.filter((audit) => {
    const matchesDoc = selectedDoctorFilter === 'All' || audit.doctorId === selectedDoctorFilter;
    const query = searchQuery.toLowerCase();
    const matchesQuery =
      !searchQuery ||
      audit.patientName.toLowerCase().includes(query) ||
      audit.uhid.toLowerCase().includes(query) ||
      audit.doctorName.toLowerCase().includes(query) ||
      audit.reason.toLowerCase().includes(query) ||
      audit.changedBy.toLowerCase().includes(query);
    return matchesDoc && matchesQuery;
  });

  const handleCopyLogs = () => {
    const jsonStr = JSON.stringify(filteredAudits, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden box-border">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              <i className="fa-solid fa-clock-rotate-left"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900">
                  Appointment Reschedule & Schedule Audit Logs
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Compliance Trail
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Full chronological record of hospital doctor schedule modifications and patient appointment shifts.
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

        {/* Filters */}
        <div className="p-4 border-b border-slate-100 bg-white grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0 text-xs">
          <div className="sm:col-span-2 relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-slate-400 text-xs"></i>
            <input
              type="text"
              placeholder="Search by Patient, UHID, Doctor, or Reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div>
            <select
              value={selectedDoctorFilter}
              onChange={(e) => setSelectedDoctorFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
            >
              <option value="All">All Doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.department})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Audit List */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3 text-xs flex-1">
          {filteredAudits.length > 0 ? (
            <div className="space-y-3">
              {filteredAudits.map((audit) => (
                <div
                  key={audit.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-indigo-200 shadow-2xs space-y-2.5 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">
                        {audit.patientName}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {audit.uhid}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono">
                      {audit.changedAt}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400">Doctor: </span>
                      <strong className="text-slate-800">{audit.doctorName}</strong>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Time Shift: </span>
                      <span className="line-through text-slate-400 font-mono">
                        {audit.previousTime}
                      </span>
                      <i className="fa-solid fa-arrow-right text-[10px] text-indigo-500"></i>
                      <strong className="font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                        {audit.newTime}
                      </strong>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-700 flex items-start gap-2">
                    <i className="fa-solid fa-tag text-indigo-500 mt-0.5 shrink-0"></i>
                    <div>
                      <span className="font-semibold text-slate-800">Reason: </span>
                      <span>{audit.reason}</span>
                      {audit.newRoom && (
                        <span className="ml-2 text-slate-500">
                          (Room: <strong>{audit.newRoom}</strong>)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                    <span>
                      Changed By: <strong className="text-slate-700">{audit.changedBy}</strong>
                    </span>
                    <span className="font-mono text-slate-400">Log ID: {audit.id}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <i className="fa-solid fa-clock-rotate-left text-slate-300 text-3xl mb-2 block"></i>
              <p className="text-xs font-bold text-slate-700">No Reschedule Logs Found</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                When staff shifts patient appointment times or adjusts doctor delay schedules, full audit logs will appear here.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleCopyLogs}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <i className={`fa-solid ${copySuccess ? 'fa-check text-emerald-600' : 'fa-copy'}`}></i>
            <span>{copySuccess ? 'Copied to Clipboard!' : 'Copy Audit Log JSON'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
