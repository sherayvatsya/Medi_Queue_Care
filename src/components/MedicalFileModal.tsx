import React, { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  X,
  FolderKanban,
  FileText,
  Activity,
  AlertTriangle,
  Pill,
  BarChart3,
  Download,
  ShieldCheck,
  Search,
  CalendarDays,
} from 'lucide-react';
import { PatientUser } from '../types';

type MedicalFileTab = 'overview' | 'history' | 'allergies' | 'medications' | 'prescriptions' | 'reports';

interface MedicalFileModalProps {
  isOpen: boolean;
  presentation?: 'modal' | 'page';
  onClose: () => void;
  currentUser: PatientUser | null;
  initialTab?: MedicalFileTab;
  onShowToast?: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
}

export const MedicalFileModal: React.FC<MedicalFileModalProps> = ({
  isOpen,
  presentation = 'modal',
  onClose,
  currentUser,
  initialTab = 'overview',
  onShowToast,
}) => {
  const isPage = presentation === 'page';
  const isFocusedSectionPage = isPage && (initialTab === 'prescriptions' || initialTab === 'reports');
  const isMedicalFilePage = isPage && initialTab === 'overview';
  const [activeTab, setActiveTab] = useState<MedicalFileTab>(initialTab);
  const [prescriptionQuery, setPrescriptionQuery] = useState('');
  const [prescriptionDateRange, setPrescriptionDateRange] = useState<'all' | 'year' | '90days'>('all');
  const [reportQuery, setReportQuery] = useState('');
  const [reportDateRange, setReportDateRange] = useState<'all' | 'year' | '90days'>('all');
  const [reportTypeFilter, setReportTypeFilter] = useState('all');
  const [expandedReportTitle, setExpandedReportTitle] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

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
  const filteredPrescriptions = prescriptions.filter((rx) => {
    const query = prescriptionQuery.trim().toLowerCase();
    const matchesQuery = !query || `${rx.doctor} ${rx.department} ${rx.diagnosis} ${rx.date}`.toLowerCase().includes(query);
    if (!matchesQuery || prescriptionDateRange === 'all') return matchesQuery;
    const rxDate = new Date(rx.date);
    if (Number.isNaN(rxDate.getTime())) return false;
    const days = prescriptionDateRange === 'year' ? 365 : 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return rxDate >= cutoff;
  });

  const labReports = [
    { title: 'Complete Blood Count (CBC) Panel', date: '10 Oct 2026', lab: 'Hospital Laboratory (Inside Hospital)', status: 'Verified', result: 'Hemoglobin: 14.2 g/dL • Platelets: 240k' },
    { title: 'Bilateral Knee Digital X-Ray (AP/Lat)', date: '10 Oct 2026', lab: 'Max Radiology Dept', status: 'Verified', result: 'Mild medial joint space narrowing in right knee' },
    { title: 'Serum Uric Acid & Lipid Profile', date: '14 Nov 2025', lab: 'Apollo Diagnostics', status: 'Archived', result: 'Uric Acid: 5.8 mg/dL (Normal)' },
  ];

  const filteredLabReports = labReports.filter((report) => {
    const query = reportQuery.trim().toLowerCase();
    const matchesQuery = !query || `${report.title} ${report.date} ${report.lab} ${report.result}`.toLowerCase().includes(query);
    const reportType = report.title.toLowerCase().includes('x-ray') ? 'X-Ray' : 'Blood Test';
    const matchesType = reportTypeFilter === 'all' || reportType === reportTypeFilter;
    if (!matchesQuery || !matchesType || reportDateRange === 'all') return matchesQuery && matchesType;
    const reportDate = new Date(report.date);
    if (Number.isNaN(reportDate.getTime())) return false;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (reportDateRange === 'year' ? 365 : 90));
    return reportDate >= cutoff;
  });

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: FolderKanban },
    { id: 'history' as const, label: 'Medical History', icon: Activity },
    { id: 'allergies' as const, label: 'Allergies', icon: AlertTriangle },
    { id: 'medications' as const, label: 'Medications', icon: Pill },
    { id: 'prescriptions' as const, label: 'Prescriptions', icon: FileText },
    { id: 'reports' as const, label: 'Reports', icon: BarChart3 },
  ];
  const visibleTabs = isPage
    ? tabs.filter((tab) => tab.id !== 'prescriptions' && tab.id !== 'reports')
    : tabs;

  const tabMeta: Record<MedicalFileTab, { title: string; description: string; icon: typeof FolderKanban }> = {
    overview: {
      title: 'Patient Medical File',
      description: 'Clinical summary, identifiers, chronic diagnoses, and safety flags.',
      icon: FolderKanban,
    },
    history: {
      title: 'Medical History',
      description: 'Longitudinal conditions and documented care context.',
      icon: Activity,
    },
    allergies: {
      title: 'Allergy & Risk Flags',
      description: 'High-priority allergy warnings for consultations and prescriptions.',
      icon: AlertTriangle,
    },
    medications: {
      title: 'Current Medications',
      description: 'Active and as-needed medicines linked to this patient profile.',
      icon: Pill,
    },
    prescriptions: {
      title: 'Digital Prescriptions',
      description: 'View and manage your doctor-prescribed medicines and diagnosis details.',
      icon: FileText,
    },
    reports: {
      title: 'Lab Reports',
      description: 'Verified diagnostics with PDF export for each report.',
      icon: BarChart3,
    },
  };
  const activeTabMeta = tabMeta[activeTab];

  const ActiveHeaderIcon = isMedicalFilePage ? FolderKanban : activeTabMeta.icon;

  const exportReportPDF = (report?: (typeof labReports)[number]) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const reportsToExport = report ? [report] : labReports;
      const generatedAt = new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      doc.setFillColor(8, 127, 201);
      doc.rect(0, 0, 210, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(report ? 'Medical Report PDF' : 'Medical Reports Bundle', 14, 11);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Medi Queue Verified Diagnostic Record', 14, 17);
      doc.text(`Generated: ${generatedAt}`, 196, 11, { align: 'right' });
      doc.text(`UHID: ${patientUhid}`, 196, 17, { align: 'right' });

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Patient Details', 14, 40);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Name: ${patientName}`, 14, 47);
      doc.text(`Age / Gender: ${age} yrs / ${gender}`, 14, 53);
      doc.text(`Blood Group: ${bloodGroup}`, 14, 59);

      let y = 72;
      reportsToExport.forEach((item, index) => {
        if (y > 245) {
          doc.addPage();
          y = 24;
        }

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(14, y, 182, 36, 2, 2, 'FD');

        doc.setTextColor(8, 127, 201);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`${index + 1}. ${item.title}`, 20, y + 8);

        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(`Date: ${item.date}`, 20, y + 15);
        doc.text(`Lab: ${item.lab}`, 20, y + 21);
        doc.text(`Status: ${item.status}`, 158, y + 15);

        const resultLines = doc.splitTextToSize(`Result: ${item.result}`, 166);
        doc.text(resultLines, 20, y + 28);

        y += 45;
      });

      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('This PDF is generated from the patient medical file for personal healthcare use.', 105, 287, { align: 'center' });

      const safeName = patientName.replace(/[^a-zA-Z0-9]/g, '_');
      const safeReport = report ? report.title.replace(/[^a-zA-Z0-9]/g, '_') : 'All_Reports';
      const fileName = `MediQueue_Report_${safeReport}_${safeName}.pdf`;
      doc.save(fileName);

      onShowToast?.(
        'Report PDF Saved',
        `${report ? report.title : 'All reports'} saved as ${fileName}.`,
        'success'
      );
    } catch (error) {
      console.error('Failed to export report PDF:', error);
      onShowToast?.('PDF Export Failed', 'Unable to save the report PDF. Please try again.', 'urgent');
    }
  };

  const exportPrescriptionPDF = (prescription: (typeof prescriptions)[number]) => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      doc.setFillColor(8, 127, 201);
      doc.rect(0, 0, 210, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('Medi Queue', 14, 13);
      doc.setFontSize(11);
      doc.text('Digital Prescription Record', 14, 22);

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.text('Patient details', 14, 44);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Name: ${patientName}`, 14, 53);
      doc.text(`UHID: ${patientUhid}`, 14, 60);
      doc.text(`Age / Gender: ${age} years / ${gender}`, 14, 67);
      doc.text(`Blood group: ${bloodGroup}`, 14, 74);

      doc.setDrawColor(203, 213, 225);
      doc.line(14, 83, 196, 83);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Prescription details', 14, 94);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Record ID: ${prescription.id}`, 14, 104);
      doc.text(`Date: ${prescription.date}`, 14, 112);
      doc.text(`Doctor: ${prescription.doctor}`, 14, 120);
      doc.text(`Department: ${prescription.department}`, 14, 128);
      doc.setFont('helvetica', 'bold');
      doc.text('Diagnosis', 14, 141);
      doc.setFont('helvetica', 'normal');
      const diagnosisLines = doc.splitTextToSize(prescription.diagnosis, 175);
      doc.text(diagnosisLines, 14, 149);

      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('This PDF contains the prescription details available in the patient record.', 105, 282, { align: 'center' });

      const safeName = patientName.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `MediQueue_Prescription_${prescription.id}_${safeName}.pdf`;
      doc.save(fileName);
      onShowToast?.('Prescription Downloaded', `${prescription.id} was saved as a PDF.`, 'success');
    } catch (error) {
      console.error('Failed to export prescription PDF:', error);
      onShowToast?.('Download Failed', 'Unable to create the prescription PDF. Please try again.', 'urgent');
    }
  };

  return (
    <div className={isPage ? 'w-full animate-in fade-in duration-200' : 'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200'}>
      <div className={isPage
        ? 'bg-white/75 dark:bg-[#162927]/78 backdrop-blur-md rounded-2xl border border-[#DCEBE3]/90 dark:border-[#284440] w-full h-[calc(100vh-10rem)] min-h-[560px] flex flex-col shadow-[0_12px_32px_rgba(0,107,103,0.07)] overflow-hidden text-left'
        : 'bg-white dark:bg-[#111827] rounded-3xl border border-[#E5EDF5] dark:border-[#1E293B] max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-left'}>
        {/* Modal Top Header */}
        <div className={isMedicalFilePage
          ? 'px-5 py-5 sm:px-7 sm:py-6 border-b border-[#DCEBE3] dark:border-[#284440] flex items-center justify-between bg-white/60 dark:bg-[#1B302D]/55 backdrop-blur-md'
          : isFocusedSectionPage
            ? 'p-4 sm:p-6 border-b border-sky-100 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-sky-50 to-white dark:from-slate-900 dark:to-slate-800'
            : 'p-4 sm:p-6 border-b border-[#E5EDF5] dark:border-[#1E293B] flex items-center justify-between bg-[#F6F9FC] dark:bg-[#172033]'}>
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className={`${isMedicalFilePage ? 'w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#006B67] shadow-[0_5px_14px_rgba(0,107,103,0.2)]' : 'w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#087FC9] to-[#38BDF8] shadow-md'} shrink-0 text-white flex items-center justify-center`}>
              <ActiveHeaderIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`font-heading font-extrabold text-[#13213A] dark:text-white ${isMedicalFilePage ? 'text-lg sm:text-2xl' : 'text-base sm:text-lg'}`}>
                  {isMedicalFilePage ? 'Patient Medical File' : activeTabMeta.title}
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

        {/* Full record tabs stay on Medical File; sidebar Prescription and Reports are focused pages. */}
        {!isFocusedSectionPage && <div className={`px-4 sm:px-6 flex items-center gap-1.5 overflow-x-auto scrollbar-none ${isPage ? 'pt-2 border-b border-[#DCEBE3]/90 dark:border-[#284440] bg-white/48 dark:bg-[#162927]/50 backdrop-blur-sm' : 'pt-3 pb-1 border-b border-[#E5EDF5] dark:border-[#1E293B]'}`}>
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition cursor-pointer ${
                  isPage
                    ? isActive
                      ? 'text-[#087FC9] dark:text-[#38BDF8] border-b-2 border-[#087FC9] dark:border-[#38BDF8]'
                      : 'text-[#64748B] dark:text-[#94A3B8] border-b-2 border-transparent hover:text-[#13213A] dark:hover:text-white'
                    : isActive
                      ? 'rounded-xl bg-[#EBF5FB] dark:bg-[#082F49] text-[#087FC9] dark:text-[#38BDF8] font-bold border border-[#BAE6FD] dark:border-[#0284C7]'
                      : 'rounded-xl text-[#64748B] dark:text-[#94A3B8] hover:text-[#13213A] hover:bg-[#F6F9FC] dark:hover:bg-[#172033]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>}

        {/* Tab Content Body */}
        <div className={`overflow-y-auto flex-1 ${isMedicalFilePage ? 'p-4 sm:p-6 lg:p-7 space-y-4 sm:space-y-5 bg-[#F5FAF7]/60 dark:bg-[#10201F]/65 backdrop-blur-sm' : 'p-4 sm:p-6 space-y-4'}`}>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 sm:p-4 rounded-2xl border border-rose-100/90 dark:border-rose-900/50 bg-rose-50/55 dark:bg-rose-950/20 backdrop-blur-sm">
                  <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] block">Blood Group</span>
                  <span className="text-base font-extrabold text-[#EF4444] font-heading">{bloodGroup}</span>
                </div>
                <div className="p-3.5 sm:p-4 rounded-2xl border border-[#DCEBE3] dark:border-[#284440] bg-white/65 dark:bg-[#162927]/65 backdrop-blur-sm">
                  <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] block">Age & Gender</span>
                  <span className="text-base font-extrabold text-[#13213A] dark:text-white font-heading">{age} yrs • {gender}</span>
                </div>
                <div className="p-3.5 sm:p-4 rounded-2xl border border-emerald-100/90 dark:border-emerald-900/50 bg-emerald-50/55 dark:bg-emerald-950/20 backdrop-blur-sm">
                  <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] block">Active Medications</span>
                  <span className="text-base font-extrabold text-[#087FC9] font-heading">{medications.length} Prescribed</span>
                </div>
                <div className="p-3.5 sm:p-4 rounded-2xl border border-violet-100/90 dark:border-violet-900/50 bg-violet-50/50 dark:bg-violet-950/20 backdrop-blur-sm">
                  <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] block">Verified Reports</span>
                  <span className="text-base font-extrabold text-[#16B981] font-heading">{labReports.length} Available</span>
                </div>
              </div>

              {/* Conditions Summary Card */}
              <div className="p-4 sm:p-5 rounded-2xl border border-[#DCEBE3]/90 dark:border-[#284440] bg-white/72 dark:bg-[#162927]/72 backdrop-blur-sm space-y-2.5 shadow-[0_4px_14px_rgba(0,107,103,0.045)]">
                <h4 className="text-sm font-bold text-[#13213A] dark:text-white flex items-center gap-2">
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
              <div className="p-4 sm:p-5 rounded-2xl border border-rose-200/90 dark:border-rose-900 bg-rose-50/55 dark:bg-rose-950/20 backdrop-blur-sm space-y-2.5 shadow-[0_4px_14px_rgba(225,29,72,0.045)]">
                <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200 flex items-center gap-2">
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
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h4 className="text-lg font-bold text-[#13213A] dark:text-white">Medical History</h4>
                  <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">Review diagnoses and conditions recorded in your medical file.</p>
                </div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{chronicConditions.length} {chronicConditions.length === 1 ? 'record' : 'records'}</span>
              </div>

              {chronicConditions.length > 0 ? (
                <div className="relative space-y-3 before:absolute before:bottom-7 before:left-[1.05rem] before:top-7 before:w-px before:bg-sky-200 dark:before:bg-sky-900">
                  {chronicConditions.map((cond, i) => (
                    <article key={`${cond}-${i}`} className="relative ml-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:ml-4 sm:gap-4 sm:p-4">
                      <span className="absolute -left-[1.1rem] top-1/2 z-10 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white bg-sky-500 shadow ring-2 ring-sky-100 dark:border-slate-900 dark:ring-sky-950" aria-hidden="true" />
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${i % 2 === 0 ? 'bg-rose-50 text-rose-500 dark:bg-rose-950/40 dark:text-rose-300' : 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300'}`}>
                        <Activity className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h5 className="text-sm font-bold text-slate-900 dark:text-white">{cond}</h5>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Recorded in your medical history</p>
                      </div>
                      <span className="hidden shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 sm:inline-flex">On file</span>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
                  <Activity className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
                  <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">No medical history recorded</p>
                  <p className="mt-1 text-xs text-slate-500">Your documented conditions will appear here.</p>
                </div>
              )}
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
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                <label className="relative block">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={prescriptionQuery}
                    onChange={(event) => setPrescriptionQuery(event.target.value)}
                    placeholder="Search doctor, diagnosis, or date"
                    aria-label="Search prescriptions"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
                  <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
                  <select
                    value={prescriptionDateRange}
                    onChange={(event) => setPrescriptionDateRange(event.target.value as 'all' | 'year' | '90days')}
                    aria-label="Filter prescriptions by date"
                    className="w-full bg-transparent py-3 text-sm font-medium text-slate-700 outline-none dark:text-slate-200"
                  >
                    <option value="all">All time</option>
                    <option value="year">Past year</option>
                    <option value="90days">Past 90 days</option>
                  </select>
                </label>
              </div>

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-slate-800">
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">Your prescriptions</h4>
                    <p className="mt-1 text-sm text-slate-500">Doctor instructions and diagnosis details in one place.</p>
                  </div>
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                    {filteredPrescriptions.length} {filteredPrescriptions.length === 1 ? 'record' : 'records'}
                  </span>
                </div>

                {filteredPrescriptions.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredPrescriptions.map((rx) => {
                      const rxDate = new Date(rx.date);
                      const dayLabel = Number.isNaN(rxDate.getTime()) ? '—' : rxDate.toLocaleDateString('en-IN', { day: '2-digit' });
                      const monthLabel = Number.isNaN(rxDate.getTime()) ? rx.date : rxDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
                      return (
                        <article key={rx.id} className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                          <div className="flex items-center gap-3 sm:w-20 sm:shrink-0 sm:flex-col sm:gap-0 sm:rounded-xl sm:bg-sky-50 sm:px-2 sm:py-2 dark:sm:bg-sky-950/40">
                            <span className="text-lg font-bold leading-tight text-sky-700 dark:text-sky-300">{dayLabel}</span>
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{monthLabel}</span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <h5 className="text-sm font-bold text-slate-900 dark:text-white">{rx.doctor}</h5>
                              <span className="text-xs text-slate-500">{rx.department}</span>
                            </div>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{rx.diagnosis}</p>
                            <span className="mt-2 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                              Prescription
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => exportPrescriptionPDF(rx)}
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-sky-200 px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/40"
                          >
                            <Download className="h-4 w-4" />
                            Download Rx
                          </button>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-5 py-12 text-center">
                    <FileText className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
                    <h5 className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">No prescriptions found</h5>
                    <p className="mt-1 text-sm text-slate-500">Try a different search or date range.</p>
                  </div>
                )}
              </section>
            </div>
          )}


          {/* TAB 6: REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_170px_170px_auto]">
                <label className="relative block">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input type="search" value={reportQuery} onChange={(event) => setReportQuery(event.target.value)} placeholder="Search by test, date, or laboratory" aria-label="Search lab reports" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
                  <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
                  <select value={reportDateRange} onChange={(event) => setReportDateRange(event.target.value as 'all' | 'year' | '90days')} aria-label="Filter reports by date" className="w-full bg-transparent py-3 text-sm font-medium text-slate-700 outline-none dark:text-slate-200">
                    <option value="all">All time</option>
                    <option value="year">Past year</option>
                    <option value="90days">Past 90 days</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
                  <BarChart3 className="h-4 w-4 shrink-0 text-slate-400" />
                  <select value={reportTypeFilter} onChange={(event) => setReportTypeFilter(event.target.value)} aria-label="Filter reports by test type" className="w-full bg-transparent py-3 text-sm font-medium text-slate-700 outline-none dark:text-slate-200">
                    <option value="all">All test types</option>
                    <option value="Blood Test">Blood test</option>
                    <option value="X-Ray">X-Ray</option>
                  </select>
                </label>
                <button type="button" onClick={() => exportReportPDF()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-700">
                  <Download className="h-4 w-4" />
                  Download all
                </button>
              </div>

              <div className="flex items-center justify-between px-1">
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">Lab reports</h4>
                  <p className="mt-1 text-sm text-slate-500">Your diagnostic results and laboratory records.</p>
                </div>
                <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                  {filteredLabReports.length} {filteredLabReports.length === 1 ? 'report' : 'reports'}
                </span>
              </div>

              {filteredLabReports.length > 0 ? (
                <div className="space-y-3">
                  {filteredLabReports.map((report) => {
                    const isExpanded = expandedReportTitle === report.title;
                    const reportType = report.title.toLowerCase().includes('x-ray') ? 'X-Ray' : 'Blood Test';
                    const statusClass = report.status === 'Verified'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
                    return (
                      <article key={report.title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:px-5">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                            <BarChart3 className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <h5 className="text-sm font-bold text-slate-900 dark:text-white">{report.title}</h5>
                              <span className="text-xs text-slate-500">{report.date}</span>
                            </div>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{report.lab}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">{reportType}</span>
                              <span className={'rounded-full px-2.5 py-1 text-[11px] font-semibold ' + statusClass}>{report.status}</span>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <button type="button" aria-expanded={isExpanded} onClick={() => setExpandedReportTitle(isExpanded ? null : report.title)} className="rounded-xl border border-sky-200 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/40">
                              {isExpanded ? 'Hide details' : 'View report'}
                            </button>
                            <button type="button" onClick={() => exportReportPDF(report)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/40">
                              <Download className="h-4 w-4" />
                              Download PDF
                            </button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 sm:px-5">
                            <p className="font-semibold text-slate-900 dark:text-white">Result summary</p>
                            <p className="mt-1">{report.result}</p>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
                  <BarChart3 className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
                  <h5 className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">No reports found</h5>
                  <p className="mt-1 text-sm text-slate-500">Try another search term or filter.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className={`${isMedicalFilePage ? 'px-4 py-3.5 sm:px-6 bg-white/55 dark:bg-[#162927]/58 backdrop-blur-md' : 'p-4 bg-[#F6F9FC] dark:bg-[#172033]'} border-t border-[#DCEBE3]/90 dark:border-[#284440] flex items-center justify-between gap-3`}>
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
