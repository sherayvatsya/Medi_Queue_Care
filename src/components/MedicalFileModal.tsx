import React, { useState } from 'react';
import {
  X,
  FolderKanban,
  FileText,
  Activity,
  AlertTriangle,
  Pill,
  BarChart3,
  Download,
  Calendar,
  User,
  ShieldCheck,
  CheckCircle2,
  FileCheck,
  Plus,
} from 'lucide-react';
import { PatientUser } from '../types';

interface MedicalFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: PatientUser | null;
  initialTab?: 'overview' | 'history' | 'allergies' | 'medications' | 'prescriptions' | 'reports';
  onShowToast?: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
}

export const MedicalFileModal: React.FC<MedicalFileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  initialTab = 'overview',
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'history' | 'allergies' | 'medications' | 'prescriptions' | 'reports'
  >(initialTab);

  if (!isOpen) return null;

  const patientName = currentUser?.name || 'Rajesh Mukherjee';
  const patientUhid = currentUser?.uhid || 'SJMC-2026-DEL-08942A';
  const bloodGroup = currentUser?.bloodGroup || 'B+';
  const age = currentUser?.age || 52;
  const gender = currentUser?.gender || 'Male';
  const allergies = currentUser?.allergies || ['Penicillin', 'Dust Mites'];
  const chronicConditions = currentUser?.chronicConditions || ['Hypertension', 'Mild Osteoarthritis'];

  const medications = [
    { name: 'Telmisartan 40mg', dose: '1 tab daily (morning)', doctor: 'Dr. Arvind Sharma', status: 'Active' },
    { name: 'Glucosamine Sulfate 500mg', dose: '1 cap twice daily after meals', doctor: 'Dr. Arvind Sharma', status: 'Active' },
    { name: 'Paracetamol 650mg', dose: 'SOS for knee pain', doctor: 'Dr. Arvind Sharma', status: 'As Needed' },
  ];

  const prescriptions = [
    { id: 'rx-2026-042', date: '10 Oct 2026', doctor: 'Dr. Arvind Sharma, MD', department: 'Orthopedics', diagnosis: 'Knee Osteoarthritis Follow-up' },
    { id: 'rx-2025-918', date: '14 Nov 2025', doctor: 'Dr. Priya Nair', department: 'Internal Medicine', diagnosis: 'Essential Hypertension Grade 1' },
  ];

  const labReports = [
    { title: 'Complete Blood Count (CBC) Panel', date: '10 Oct 2026', lab: 'Hospital Laboratory (Inside Hospital)', status: 'Verified', result: 'Hemoglobin: 14.2 g/dL • Platelets: 240k' },
    { title: 'Bilateral Knee Digital X-Ray (AP/Lat)', date: '10 Oct 2026', lab: 'Max Radiology Dept', status: 'Verified', result: 'Mild medial joint space narrowing in right knee' },
    { title: 'Serum Uric Acid & Lipid Profile', date: '14 Nov 2025', lab: 'Apollo Diagnostics', status: 'Archived', result: 'Uric Acid: 5.8 mg/dL (Normal)' },
  ];

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: FolderKanban },
    { id: 'history' as const, label: 'Medical History', icon: Activity },
    { id: 'allergies' as const, label: 'Allergies', icon: AlertTriangle },
    { id: 'medications' as const, label: 'Medications', icon: Pill },
    { id: 'prescriptions' as const, label: 'Prescriptions', icon: FileText },
    { id: 'reports' as const, label: 'Reports', icon: BarChart3 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111827] rounded-3xl border border-[#E5EDF5] dark:border-[#1E293B] max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-left">
        {/* Modal Top Header */}
        <div className="p-4 sm:p-6 border-b border-[#E5EDF5] dark:border-[#1E293B] flex items-center justify-between bg-[#F6F9FC] dark:bg-[#172033]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#087FC9] to-[#38BDF8] text-white flex items-center justify-center shadow-md">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-extrabold text-base sm:text-lg text-[#13213A] dark:text-white">
                  Patient Medical File
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#EBF5FB] text-[#087FC9] border border-[#BAE6FD]">
                  {patientUhid}
                </span>
              </div>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                {patientName} • {age} yrs • {gender} • Blood Group: <strong className="text-[#EF4444]">{bloodGroup}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white dark:bg-[#111827] border border-[#E5EDF5] dark:border-[#1E293B] text-[#64748B] hover:text-[#13213A] dark:hover:text-white flex items-center justify-center cursor-pointer transition shadow-2xs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="px-4 sm:px-6 pt-3 pb-1 border-b border-[#E5EDF5] dark:border-[#1E293B] flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'bg-[#EBF5FB] dark:bg-[#082F49] text-[#087FC9] dark:text-[#38BDF8] font-bold border border-[#BAE6FD] dark:border-[#0284C7]'
                    : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#13213A] hover:bg-[#F6F9FC] dark:hover:bg-[#172033]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl border border-[#E5EDF5] dark:border-[#1E293B] bg-[#F6F9FC] dark:bg-[#172033]">
                  <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] block">Blood Group</span>
                  <span className="text-base font-extrabold text-[#EF4444] font-heading">{bloodGroup}</span>
                </div>
                <div className="p-3.5 rounded-2xl border border-[#E5EDF5] dark:border-[#1E293B] bg-[#F6F9FC] dark:bg-[#172033]">
                  <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] block">Age & Gender</span>
                  <span className="text-base font-extrabold text-[#13213A] dark:text-white font-heading">{age} yrs • {gender}</span>
                </div>
                <div className="p-3.5 rounded-2xl border border-[#E5EDF5] dark:border-[#1E293B] bg-[#F6F9FC] dark:bg-[#172033]">
                  <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] block">Active Medications</span>
                  <span className="text-base font-extrabold text-[#087FC9] font-heading">{medications.length} Prescribed</span>
                </div>
                <div className="p-3.5 rounded-2xl border border-[#E5EDF5] dark:border-[#1E293B] bg-[#F6F9FC] dark:bg-[#172033]">
                  <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] block">Verified Reports</span>
                  <span className="text-base font-extrabold text-[#16B981] font-heading">{labReports.length} Available</span>
                </div>
              </div>

              {/* Conditions Summary Card */}
              <div className="p-4 rounded-2xl border border-[#E5EDF5] dark:border-[#1E293B] bg-white dark:bg-[#111827] space-y-2">
                <h4 className="text-xs font-bold text-[#13213A] dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-[#087FC9]" />
                  <span>Chronic Diagnoses & Conditions</span>
                </h4>
                <div className="flex flex-wrap gap-2 pt-1">
                  {chronicConditions.map((cond, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-xl text-xs font-semibold bg-[#EBF5FB] dark:bg-[#082F49] text-[#087FC9] dark:text-[#38BDF8] border border-[#BAE6FD]"
                    >
                      {cond}
                    </span>
                  ))}
                </div>
              </div>

              {/* Allergies Alert */}
              <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/20 space-y-2">
                <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Documented Medical Allergies</span>
                </h4>
                <div className="flex flex-wrap gap-2 pt-1">
                  {allergies.map((all, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-xl text-xs font-bold bg-white dark:bg-[#111827] text-rose-700 dark:text-rose-300 border border-rose-200 shadow-2xs"
                    >
                      ⚠️ {all}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MEDICAL HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              {chronicConditions.map((cond, i) => (
                <div
                  key={i}
                  className="p-4 rounded-2xl border border-[#E5EDF5] dark:border-[#1E293B] bg-[#F6F9FC] dark:bg-[#172033] flex items-center justify-between"
                >
                  <div>
                    <h5 className="text-xs font-bold text-[#13213A] dark:text-white">{cond}</h5>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">Documented in electronic health records since 2024</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active Condition
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: ALLERGIES */}
          {activeTab === 'allergies' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              {allergies.map((all, i) => (
                <div
                  key={i}
                  className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold text-xs">
                      !
                    </span>
                    <div>
                      <h5 className="text-xs font-bold text-rose-900 dark:text-rose-200">{all}</h5>
                      <p className="text-[11px] text-rose-700 dark:text-rose-300">Severe reaction precaution flagged for electronic prescribing.</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800">
                    High Risk
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: MEDICATIONS */}
          {activeTab === 'medications' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              {medications.map((med, i) => (
                <div
                  key={i}
                  className="p-4 rounded-2xl border border-[#E5EDF5] dark:border-[#1E293B] bg-white dark:bg-[#111827] flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#EBF5FB] dark:bg-[#082F49] text-[#087FC9] dark:text-[#38BDF8] flex items-center justify-center">
                      <Pill className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-[#13213A] dark:text-white">{med.name}</h5>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        Dosage: {med.dose} • Prescribed by {med.doctor}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {med.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* TAB 5: PRESCRIPTIONS */}
          {activeTab === 'prescriptions' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              {prescriptions.map((rx) => (
                <div
                  key={rx.id}
                  className="p-4 rounded-2xl border border-[#E5EDF5] dark:border-[#1E293B] bg-white dark:bg-[#111827] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#EBF5FB] dark:bg-[#082F49] text-[#087FC9] dark:text-[#38BDF8] flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="text-xs font-bold text-[#13213A] dark:text-white">{rx.doctor}</h5>
                        <span className="text-[10px] font-mono text-[#64748B]">{rx.date}</span>
                      </div>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        {rx.department} • Diagnosis: {rx.diagnosis}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (onShowToast) onShowToast('Digital Rx Exported', `Prescription ${rx.id} downloaded.`, 'success');
                    }}
                    className="self-end sm:self-auto px-3 py-1.5 rounded-xl border border-[#087FC9] text-[#087FC9] hover:bg-[#087FC9] hover:text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Rx</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* TAB 6: REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              {labReports.map((rep, i) => (
                <div
                  key={i}
                  className="p-4 rounded-2xl border border-[#E5EDF5] dark:border-[#1E293B] bg-white dark:bg-[#111827] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="text-xs font-bold text-[#13213A] dark:text-white">{rep.title}</h5>
                        <span className="text-[10px] font-mono text-[#64748B]">{rep.date}</span>
                      </div>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        {rep.lab} • {rep.result}
                      </p>
                    </div>
                  </div>
                  <span className="self-end sm:self-auto text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                    {rep.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#E5EDF5] dark:border-[#1E293B] bg-[#F6F9FC] dark:bg-[#172033] flex items-center justify-between">
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#16B981]" />
            <span>ABHA / NDHM Standards-Compliant Medical Records</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#087FC9] hover:bg-[#0B5E97] text-white text-xs font-bold transition cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
