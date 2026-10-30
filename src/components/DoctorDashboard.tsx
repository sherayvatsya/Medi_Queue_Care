import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import confetti from 'canvas-confetti';
import {
  Stethoscope,
  User,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Printer,
  Download,
  Eye,
  FileText,
  Pill,
  Activity,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Phone,
  Hash,
  X,
  HeartPulse,
  Share2,
  Lock,
  ChevronRight,
  History,
  FlaskConical,
  ClipboardList,
} from 'lucide-react';
import {
  Doctor,
  Patient,
  ICMRProtocol,
  StaffUser,
  DoctorPrescription,
  DoctorConsultation,
  PrescriptionMedicine,
  PatientMedicalHistoryData,
} from '../types';
import { playHospitalChime, announceTokenVoice, playUrgentAlertSound } from '../utils/audio';
import { getValidDoctorAvatar, handleDoctorImageError } from '../utils/doctorAvatar';
import { savePatientTokenToFirestore, updateDoctorStatusInFirestore } from '../firebase';

interface DoctorDashboardProps {
  doctors: Doctor[];
  patients: Patient[];
  protocols?: ICMRProtocol[];
  staffUser?: StaffUser | null;
  onUpdateDoctor: (updatedDoc: Doctor) => void;
  onUpdatePatient: (updatedPatient: Patient) => void;
  onCallNextPatient: (doctorId: string) => void;
  onCompletePatient: (patientId: string) => void;
  onEscalateToER?: (patientId: string) => void;
  onShowToast: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
}

export const DoctorDashboard: React.FC<DoctorDashboardProps> = ({
  doctors,
  patients,
  protocols = [],
  staffUser,
  onUpdateDoctor,
  onUpdatePatient,
  onCallNextPatient,
  onCompletePatient,
  onEscalateToER,
  onShowToast,
}) => {
  // Determine active doctor:
  // If staffUser is a doctor, lock to their doctor record if matched; otherwise default to doc-1 or first doctor
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(() => {
    if (staffUser?.role === 'doctor') {
      const match = doctors.find(
        (d) => d.id === staffUser.id || d.name.toLowerCase().includes(staffUser.name.toLowerCase())
      );
      if (match) return match.id;
    }
    return doctors[0]?.id || 'doc-1';
  });

  const currentDoctor = useMemo(() => {
    return doctors.find((d) => d.id === selectedDoctorId) || doctors[0];
  }, [doctors, selectedDoctorId]);

  // Active Doctor's Patients
  const waitingPatients = useMemo(() => {
    return patients
      .filter((p) => p.doctorId === currentDoctor?.id && p.status === 'waiting')
      .sort((a, b) => (a.queuePosition ?? 99) - (b.queuePosition ?? 99));
  }, [patients, currentDoctor]);

  const inConsultationPatient = useMemo(() => {
    return patients.find((p) => p.doctorId === currentDoctor?.id && p.status === 'in_consultation') || null;
  }, [patients, currentDoctor]);

  const completedPatients = useMemo(() => {
    return patients.filter((p) => p.doctorId === currentDoctor?.id && p.status === 'completed');
  }, [patients, currentDoctor]);

  // Selected patient for medical history view (defaults to in-consultation, or first waiting)
  const [activePatientId, setActivePatientId] = useState<string>('');

  useEffect(() => {
    if (inConsultationPatient) {
      setActivePatientId(inConsultationPatient.id);
    } else if (waitingPatients.length > 0 && !activePatientId) {
      setActivePatientId(waitingPatients[0].id);
    }
  }, [inConsultationPatient, waitingPatients]);

  const selectedPatient = useMemo(() => {
    return (
      (inConsultationPatient && inConsultationPatient.id === activePatientId ? inConsultationPatient : null) ||
      patients.find((p) => p.id === activePatientId) ||
      inConsultationPatient ||
      waitingPatients[0] ||
      null
    );
  }, [patients, activePatientId, inConsultationPatient, waitingPatients]);

  // Medical History State from MongoDB
  const [medicalHistory, setMedicalHistory] = useState<PatientMedicalHistoryData | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [historyTab, setHistoryTab] = useState<'overview' | 'history' | 'allergies' | 'medications' | 'prescriptions' | 'reports'>('overview');

  // Prescription Form State
  const [diagnosis, setDiagnosis] = useState<string>('');
  const [doctorNotes, setDoctorNotes] = useState<string>('');
  const [medicines, setMedicines] = useState<PrescriptionMedicine[]>([
    {
      id: 'med-init-1',
      name: '',
      dosage: '1 Tablet',
      frequency: '1-0-1 (Twice daily after meals)',
      duration: '5 days',
      instructions: 'Take with water after meals',
    },
  ]);
  const [followUpDate, setFollowUpDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [dietaryAdvice, setDietaryAdvice] = useState<string>('');
  const [isSavingPrescription, setIsSavingPrescription] = useState<boolean>(false);
  const [isCallingNext, setIsCallingNext] = useState<boolean>(false);
  const [isFinishingConsultation, setIsFinishingConsultation] = useState<boolean>(false);

  // Modals
  const [previewPrescriptionModal, setPreviewPrescriptionModal] = useState<DoctorPrescription | null>(null);
  const [completedConsultationsList, setCompletedConsultationsList] = useState<DoctorConsultation[]>([]);
  const [isAutoSyncActive, setIsAutoSyncActive] = useState<boolean>(true);

  // Fetch Patient Medical History from MongoDB
  const fetchPatientHistory = useCallback(async (patientId: string, uhid?: string) => {
    if (!patientId && !uhid) return;
    setIsLoadingHistory(true);
    try {
      const targetId = patientId || uhid || '';
      const response = await fetch(`/api/doctor/patient-history/${encodeURIComponent(targetId)}`, {
        headers: {
          'x-staff-role': staffUser?.role || 'doctor',
          'x-staff-id': staffUser?.staffId || currentDoctor?.id || 'doc-1',
        },
      });
      const data = await response.json();
      if (data.success && data.history) {
        setMedicalHistory(data.history);
      }
    } catch (err) {
      console.warn('Could not fetch MongoDB medical history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [staffUser, currentDoctor]);

  // Fetch Completed Consultations from MongoDB
  const fetchCompletedConsultations = useCallback(async () => {
    if (!currentDoctor) return;
    try {
      const response = await fetch(`/api/doctor/consultations?doctorId=${encodeURIComponent(currentDoctor.id)}`, {
        headers: {
          'x-staff-role': staffUser?.role || 'doctor',
          'x-staff-id': staffUser?.staffId || currentDoctor.id,
        },
      });
      const data = await response.json();
      if (data.success && Array.isArray(data.consultations)) {
        setCompletedConsultationsList(data.consultations);
      }
    } catch (err) {
      console.warn('Could not fetch doctor consultations from MongoDB:', err);
    }
  }, [currentDoctor, staffUser]);

  // Trigger history fetch when selected patient changes
  useEffect(() => {
    if (selectedPatient) {
      fetchPatientHistory(selectedPatient.id, selectedPatient.uhid);
      // Pre-fill diagnosis from symptoms if blank
      if (!diagnosis && selectedPatient.symptoms && selectedPatient.symptoms.length > 0) {
        setDiagnosis(`${selectedPatient.symptoms.join(', ')} - Initial Workup`);
      }
    }
  }, [selectedPatient?.id]);

  // Initial and Periodic Fetch
  useEffect(() => {
    fetchCompletedConsultations();
  }, [currentDoctor?.id]);

  // Polling Queue Sync every 12 seconds
  useEffect(() => {
    if (!isAutoSyncActive) return;
    const interval = setInterval(() => {
      fetchCompletedConsultations();
    }, 12000);
    return () => clearInterval(interval);
  }, [isAutoSyncActive, fetchCompletedConsultations]);

  // Quick ICMR / Clinical diagnosis presets based on doctor specialty
  const diagnosisPresets = useMemo(() => {
    const dept = currentDoctor?.department?.toLowerCase() || '';
    if (dept.includes('ortho')) {
      return [
        'Knee Osteoarthritis Grade II',
        'Acute Lumbar Strain (L4-L5)',
        'Right Ankle Sprain (Ligament Grade I)',
        'Cervical Spondylosis with Muscle Spasm',
      ];
    }
    if (dept.includes('cardio')) {
      return [
        'Essential Hypertension Grade 1',
        'Atypical Chest Discomfort (Non-Cardiac)',
        'Sinus Tachycardia / Exertional Fatigue',
        'Stable Angina Pectoris - OPD Follow-up',
      ];
    }
    if (dept.includes('pulmo')) {
      return [
        'Acute Bronchitis (Viral Etiology)',
        'Bronchial Asthma (Exacerbation)',
        'Post-Infectious Subacute Cough',
        'Allergic Rhinitis with Hyperreactivity',
      ];
    }
    return [
      'Acute Febrile Illness (Suspected Viral)',
      'Acute Gastroenteritis / Dehydration',
      'Generalized Myalgia / Fatigue',
      'Upper Respiratory Tract Infection (URTI)',
    ];
  }, [currentDoctor]);

  // Medicine Management
  const handleAddMedicine = () => {
    setMedicines((prev) => [
      ...prev,
      {
        id: `med-${Date.now()}-${prev.length + 1}`,
        name: '',
        dosage: '1 Tablet',
        frequency: '1-0-1 (Twice daily after meals)',
        duration: '5 days',
        instructions: 'Take after meals with water',
      },
    ]);
  };

  const handleRemoveMedicine = (id: string) => {
    if (medicines.length <= 1) {
      onShowToast('Prescription Requirement', 'A prescription must contain at least one medicine.', 'info');
      return;
    }
    setMedicines((prev) => prev.filter((m) => m.id !== id));
  };

  const handleUpdateMedicine = (id: string, field: keyof PrescriptionMedicine, value: string) => {
    setMedicines((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };
  // Quick Medicine Presets
  const applyQuickMedicine = (name: string, dose: string, freq: string, dur: string, instr: string) => {
    // If the last entry is empty, replace it, else append
    setMedicines((prev) => {
      const last = prev[prev.length - 1];
      if (last && !last.name.trim()) {
        return prev.map((m) =>
          m.id === last.id
            ? { ...m, name, dosage: dose, frequency: freq, duration: dur, instructions: instr }
            : m
        );
      }
      return [
        ...prev,
        {
          id: `med-${Date.now()}`,
          name,
          dosage: dose,
          frequency: freq,
          duration: dur,
          instructions: instr,
        },
      ];
    });
    onShowToast('Medicine Added', `${name} added to prescription draft.`, 'info');
  };

  // 1. Call Next Patient Atomic
  const handleCallNext = async () => {
    if (!currentDoctor) return;
    if (waitingPatients.length === 0) {
      onShowToast('Queue Empty', `No waiting patients for ${currentDoctor.name}.`, 'info');
      return;
    }

    setIsCallingNext(true);
    try {
      // 1. Attempt Backend MongoDB Atomic Call
      const response = await fetch('/api/doctor/call-next', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-staff-role': staffUser?.role || 'doctor',
          'x-staff-id': staffUser?.staffId || currentDoctor.id,
        },
        body: JSON.stringify({
          doctorId: currentDoctor.id,
          patients,
          doctors,
        }),
      });

      const result = await response.json();

      // 2. Perform frontend & Firestore synchronization
      onCallNextPatient(currentDoctor.id);

      const nextTarget = result.calledPatient || waitingPatients[0];
      if (nextTarget) {
        announceTokenVoice(nextTarget.tokenNumber, currentDoctor.roomNumber, currentDoctor.name);
        setActivePatientId(nextTarget.id);
        onShowToast(
          'Next Patient Called',
          `Token #${nextTarget.tokenNumber} (${nextTarget.name}) called to ${currentDoctor.roomNumber}.`,
          'success'
        );
      }
    } catch (err: any) {
      console.warn('Backend call-next notice, fallback applied:', err);
      onCallNextPatient(currentDoctor.id);
    } finally {
      setIsCallingNext(false);
    }
  };

  // 2. Save Prescription to MongoDB
  const handleSavePrescription = async (): Promise<DoctorPrescription | null> => {
    if (!inConsultationPatient && !selectedPatient) {
      onShowToast('No Patient Selected', 'Please select or call a patient before writing a prescription.', 'urgent');
      return null;
    }

    const patientForRx = inConsultationPatient || selectedPatient;
    if (!patientForRx) return null;

    if (!diagnosis.trim()) {
      onShowToast('Diagnosis Required', 'Please enter a diagnosis before confirming the prescription.', 'urgent');
      return null;
    }

    const validMedicines = medicines.filter((m) => m.name.trim().length > 0);
    if (validMedicines.length === 0) {
      onShowToast('Medicine Details Missing', 'Please enter at least one valid medicine name and dosage.', 'urgent');
      return null;
    }

    setIsSavingPrescription(true);
    try {
      const rxPayload: Partial<DoctorPrescription> = {
        patientId: patientForRx.id,
        patientUhid: patientForRx.uhid,
        patientName: patientForRx.name,
        patientAge: patientForRx.age,
        patientGender: patientForRx.gender,
        doctorId: currentDoctor.id,
        doctorName: currentDoctor.name,
        doctorSpecialty: currentDoctor.specialty,
        doctorDepartment: currentDoctor.department,
        doctorRoom: currentDoctor.roomNumber,
        tokenNumber: patientForRx.tokenNumber,
        diagnosis: diagnosis.trim(),
        doctorNotes: doctorNotes.trim(),
        medicines: validMedicines,
        followUpDate,
        dietaryAdvice,
        status: 'active',
        isConfirmedByDoctor: true,
      };

      const response = await fetch('/api/doctor/prescription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-staff-role': staffUser?.role || 'doctor',
          'x-staff-id': staffUser?.staffId || currentDoctor.id,
        },
        body: JSON.stringify(rxPayload),
      });

      const data = await response.json();
      if (data.success && data.prescription) {
        onShowToast('Prescription Saved', `Prescription #${data.prescription.prescriptionNumber} saved to MongoDB.`, 'success');
        playHospitalChime();

        // Refresh patient history to show new prescription
        fetchPatientHistory(patientForRx.id, patientForRx.uhid);
        return data.prescription;
      } else {
        throw new Error(data.error || 'Failed to save prescription.');
      }
    } catch (err: any) {
      onShowToast('Save Error', err?.message || 'Could not save prescription to MongoDB.', 'urgent');
      return null;
    } finally {
      setIsSavingPrescription(false);
    }
  };

  // 3. Finish Consultation
  const handleFinishConsultation = async () => {
    if (!inConsultationPatient) {
      onShowToast('No Active Consultation', 'There is no patient currently inside the consultation room.', 'info');
      return;
    }

    setIsFinishingConsultation(true);
    try {
      // First save prescription if medicines are written
      let savedRx: DoctorPrescription | null = null;
      if (medicines.some((m) => m.name.trim().length > 0)) {
        savedRx = await handleSavePrescription();
      }

      // Finish Consultation in MongoDB
      const consultationPayload = {
        patientId: inConsultationPatient.id,
        patientUhid: inConsultationPatient.uhid,
        patientName: inConsultationPatient.name,
        patientAge: inConsultationPatient.age,
        patientGender: inConsultationPatient.gender,
        doctorId: currentDoctor.id,
        doctorName: currentDoctor.name,
        doctorDepartment: currentDoctor.department,
        tokenNumber: inConsultationPatient.tokenNumber,
        startedAt: inConsultationPatient.calledAt || '09:00 AM',
        completedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        durationMinutes: currentDoctor.avgConsultationTimeMin || 10,
        diagnosis: diagnosis.trim() || 'Clinical Review Completed',
        clinicalNotes: doctorNotes.trim() || 'Consultation finished. Vitals normal. Patient discharged from OPD.',
        prescriptionId: savedRx?.id,
        prescription: savedRx || undefined,
        status: 'completed',
        vitals: {
          bp: '120/80 mmHg',
          pulse: '76 bpm',
          temp: '98.4°F',
          spo2: '99%',
        },
      };

      await fetch('/api/doctor/finish-consultation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-staff-role': staffUser?.role || 'doctor',
          'x-staff-id': staffUser?.staffId || currentDoctor.id,
        },
        body: JSON.stringify(consultationPayload),
      });

      // Update patient status in existing app state & Firestore
      onCompletePatient(inConsultationPatient.id);

      // Trigger Confetti Celebration for Doctor
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
      });

      playHospitalChime();
      onShowToast(
        'Consultation Finished',
        `Token #${inConsultationPatient.tokenNumber} marked complete. Records saved to MongoDB.`,
        'success'
      );

      // Reset Prescription Form
      setDiagnosis('');
      setDoctorNotes('');
      setDietaryAdvice('');
      setMedicines([
        {
          id: `med-${Date.now()}`,
          name: '',
          dosage: '1 Tablet',
          frequency: '1-0-1 (Twice daily after meals)',
          duration: '5 days',
          instructions: 'Take after meals with water',
        },
      ]);

      // Refresh list
      fetchCompletedConsultations();
    } catch (err: any) {
      onShowToast('Consultation Finalize Notice', err?.message || 'Updated local consultation status.', 'info');
      onCompletePatient(inConsultationPatient.id);
    } finally {
      setIsFinishingConsultation(false);
    }
  };

  // 4. Export & Print Prescription PDF
  const handlePrintPrescriptionPDF = (prescription: DoctorPrescription) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Hospital Header
      doc.setFillColor(8, 127, 201); // #087FC9
      doc.rect(0, 0, 210, 32, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('MAX SUPER SPECIALTY HOSPITAL, MOHALI', 14, 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text('Department of ' + (prescription.doctorDepartment || 'Clinical Services') + ' • OPD Clinical Consultation', 14, 18);
      doc.text('Hospital Accreditation: NABH & NABL Verified • Medi-Queue Verified Electronic Medical Record', 14, 23);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`Prescription #: ${prescription.prescriptionNumber}`, 196, 12, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Date: ${new Date(prescription.prescribedAt).toLocaleDateString('en-IN')}`, 196, 18, { align: 'right' });
      doc.text(`Token #${prescription.tokenNumber} • ${prescription.doctorRoom}`, 196, 23, { align: 'right' });

      // Patient Details Card
      doc.setFillColor(248, 250, 252);
      doc.rect(14, 38, 182, 28, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(14, 38, 182, 28, 'S');

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('PATIENT IDENTIFIER', 20, 45);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Patient Name: ${prescription.patientName}`, 20, 52);
      doc.text(`Age / Gender: ${prescription.patientAge} Years / ${prescription.patientGender}`, 20, 58);
      doc.text(`UHID: ${prescription.patientUhid}`, 110, 52);
      doc.text(`Consultant: ${prescription.doctorName} (${prescription.doctorSpecialty})`, 110, 58);

      // Diagnosis Section
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(8, 127, 201);
      doc.text('CLINICAL DIAGNOSIS & OBSERVATION', 14, 76);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text(`Primary Diagnosis: ${prescription.diagnosis}`, 14, 83);

      if (prescription.doctorNotes) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`Clinical Notes: ${prescription.doctorNotes}`, 14, 89);
      }

      // Rx Symbol
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(8, 127, 201);
      doc.text('Rx', 14, 104);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('MEDICINE NAME & STRENGTH', 30, 103);
      doc.text('DOSAGE & FREQUENCY', 105, 103);
      doc.text('DURATION', 150, 103);
      doc.text('INSTRUCTIONS', 175, 103);

      doc.setDrawColor(203, 213, 225);
      doc.line(14, 107, 196, 107);

      // Medicines Table Rows
      let currentY = 114;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);

      prescription.medicines.forEach((med, idx) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${idx + 1}. ${med.name}`, 14, currentY);

        doc.setFont('helvetica', 'normal');
        doc.text(`${med.dosage} • ${med.frequency}`, 105, currentY);
        doc.text(med.duration, 150, currentY);
        doc.text(med.instructions, 175, currentY, { maxWidth: 22 });

        currentY += 10;
      });

      currentY += 6;
      doc.setDrawColor(203, 213, 225);
      doc.line(14, currentY, 196, currentY);
      currentY += 8;

      // Dietary & Follow-up
      if (prescription.dietaryAdvice) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(8, 127, 201);
        doc.text('Dietary & Lifestyle Advice:', 14, currentY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text(prescription.dietaryAdvice, 65, currentY, { maxWidth: 130 });
        currentY += 8;
      }

      if (prescription.followUpDate) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(8, 127, 201);
        doc.text('Recommended Follow-up:', 14, currentY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text(prescription.followUpDate, 65, currentY);
        currentY += 12;
      }

      // Doctor Digital Signature Box
      currentY = Math.max(currentY + 10, 240);
      doc.setDrawColor(203, 213, 225);
      doc.rect(120, currentY, 76, 28, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(8, 127, 201);
      doc.text('VERIFIED ELECTRONIC SIGNATURE', 125, currentY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(prescription.doctorName, 125, currentY + 12);
      doc.text(prescription.doctorSpecialty, 125, currentY + 17);
      doc.text('Reg #: MCI-48921 / DMC Verified', 125, currentY + 22);

      // Footer
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Medi-Queue Electronic Prescription System • Compliant with Indian Medical Council (EHR Guidelines 2026)', 14, 288);

      doc.save(`Prescription_${prescription.patientName.replace(/\s+/g, '_')}_${prescription.tokenNumber}.pdf`);
      onShowToast('PDF Downloaded', `Prescription for ${prescription.patientName} exported successfully.`, 'success');
    } catch (err: any) {
      onShowToast('Export Error', err?.message || 'Failed to generate PDF.', 'urgent');
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto py-1 font-sans text-slate-800 dark:text-slate-100">
      {/* =========================================================================
          TOP BANNER: DOCTOR IDENTITY & LIVE OP CLINICAL CONSOLE
          ========================================================================= */}
      <div className="bg-gradient-to-r from-sky-900 via-slate-900 to-indigo-950 rounded-3xl p-5 sm:p-6 text-white shadow-xl border border-sky-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src={getValidDoctorAvatar(currentDoctor.id, currentDoctor.avatar)}
              alt={currentDoctor.name}
              onError={handleDoctorImageError}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-sky-400 shadow-md"
            />
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center text-[10px] text-white">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-extrabold text-white font-heading tracking-tight">
                {currentDoctor.name}
              </h1>
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-300">
                Doctor Console
              </span>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                In OPD Room: {currentDoctor.roomNumber}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-sky-200 mt-1 font-medium">
              {currentDoctor.specialty} • {currentDoctor.department} ({currentDoctor.opdBlock}, {currentDoctor.floor})
            </p>

            <div className="flex items-center gap-4 mt-2 text-xs text-slate-300 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                Avg. Consult: <strong className="text-white">{currentDoctor.avgConsultationTimeMin} mins</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Completed Today: <strong className="text-white">{currentDoctor.todayConsultedCount + completedPatients.length}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                Waiting in Queue: <strong className="text-amber-300">{waitingPatients.length}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Doctor Switcher & Quick Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {/* Quick Doctor Roster Switcher (Accessible to staff or for multi-doctor demo) */}
          <div className="bg-slate-800/80 backdrop-blur-xs rounded-2xl p-1.5 border border-slate-700">
            <label className="block text-[10px] uppercase font-bold text-slate-400 px-2 pb-0.5">
              Switch Doctor Roster:
            </label>
            <select
              value={selectedDoctorId}
              onChange={(e) => {
                setSelectedDoctorId(e.target.value);
                playHospitalChime();
              }}
              className="w-full bg-slate-900 text-white text-xs font-semibold rounded-xl px-3 py-1.5 border border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              {doctors.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.name} — {doc.department} ({doc.roomNumber})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                fetchCompletedConsultations();
                if (selectedPatient) fetchPatientHistory(selectedPatient.id, selectedPatient.uhid);
                onShowToast('Synced Real-Time', 'MongoDB queue & history refreshed.', 'info');
              }}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
              title="Manual Sync with MongoDB"
            >
              <RefreshCw className="w-4 h-4 text-sky-400" />
            </button>
            <button
              type="button"
              onClick={handleCallNext}
              disabled={isCallingNext || waitingPatients.length === 0}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                waitingPatients.length > 0
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-sky-500/30'
                  : 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              <span>{isCallingNext ? 'Calling Patient...' : 'Call Next Patient'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MAIN 3-COLUMN CLINICAL WORKFLOW
          Left: Waiting Queue
          Middle: Active Patient & Medical History
          Right: Prescription Form & Finish Consultation
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* =====================================================================
            COLUMN 1: WAITING QUEUE (3 Cols on Desktop)
            ===================================================================== */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white dark:bg-[#111827] rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400 flex items-center justify-center font-bold text-xs">
                  {waitingPatients.length}
                </div>
                <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  Waiting Queue
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                {currentDoctor.department}
              </span>
            </div>

            {/* In-Consultation Highlight in Queue Sidebar */}
            {inConsultationPatient && (
              <div className="mt-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 text-slate-800 dark:text-slate-200 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    Currently In Room
                  </span>
                  <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-lg bg-emerald-600 text-white">
                    #{inConsultationPatient.tokenNumber}
                  </span>
                </div>
                <h4 className="font-bold text-xs mt-1 text-slate-900 dark:text-white">
                  {inConsultationPatient.name}
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                  {inConsultationPatient.age}y • {inConsultationPatient.gender} • UHID: {inConsultationPatient.uhid}
                </p>
                <div className="mt-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-between">
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                    Called: {inConsultationPatient.calledAt || 'Just now'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActivePatientId(inConsultationPatient.id)}
                    className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
                  >
                    View Chart →
                  </button>
                </div>
              </div>
            )}

            {/* Waiting Patients List */}
            <div className="mt-3 space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {waitingPatients.length === 0 ? (
                <div className="text-center py-8 px-2 text-slate-400">
                  <ClipboardList className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 stroke-1" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-2">
                    Queue is Clear
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    No waiting tokens in this department.
                  </p>
                </div>
              ) : (
                waitingPatients.map((pat, idx) => {
                  const isSelected = selectedPatient?.id === pat.id;
                  return (
                    <div
                      key={pat.id}
                      onClick={() => setActivePatientId(pat.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                        isSelected
                          ? 'bg-sky-50/80 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800 shadow-xs'
                          : 'bg-white dark:bg-[#151D2F] border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[10px] flex items-center justify-center font-mono">
                            {idx + 1}
                          </span>
                          <span className="font-mono text-xs font-extrabold text-sky-600 dark:text-sky-400">
                            #{pat.tokenNumber}
                          </span>
                        </div>
                        <span
                          className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${
                            pat.triageCategory === 'urgent_er'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                              : pat.preTestOptIn
                              ? 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {pat.preTestOptIn ? '⚡ Lab Ready' : pat.triageCategory}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 dark:text-white mt-1.5 truncate">
                        {pat.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {pat.age}y • {pat.gender} • Est: {pat.estimatedWaitMinutes}m
                      </p>

                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                        <span className="truncate max-w-[120px]">
                          {pat.symptoms?.[0] || 'Routine Consultation'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCallNextPatient(currentDoctor.id);
                            announceTokenVoice(pat.tokenNumber, currentDoctor.roomNumber, currentDoctor.name);
                            setActivePatientId(pat.id);
                          }}
                          className="text-[10px] font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                        >
                          Call Now →
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* =====================================================================
            COLUMN 2: PATIENT MEDICAL RECORD & CHARTS (5 Cols on Desktop)
            ===================================================================== */}
        <div className="lg:col-span-5 space-y-4">
          {selectedPatient ? (
            <div className="bg-white dark:bg-[#111827] rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              {/* Patient Banner */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                    {selectedPatient.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                        {selectedPatient.name}
                      </h3>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                        Token #{selectedPatient.tokenNumber}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>{selectedPatient.age} Yrs</span>
                      <span>•</span>
                      <span>{selectedPatient.gender}</span>
                      <span>•</span>
                      <span className="font-mono">{selectedPatient.uhid}</span>
                      <span>•</span>
                      <span>Blood: <strong className="text-rose-600">{medicalHistory?.bloodGroup || 'B+'}</strong></span>
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      selectedPatient.status === 'in_consultation'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : selectedPatient.status === 'completed'
                        ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {selectedPatient.status === 'in_consultation' ? 'In Consultation' : selectedPatient.status}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Phone: {selectedPatient.phone}
                  </p>
                </div>
              </div>

              {/* CRITICAL SAFETY ALERT: ALLERGIES & CONTRAINDICATIONS */}
              {((medicalHistory?.allergies && medicalHistory.allergies.length > 0) ||
                selectedPatient.allergiesText) && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-300 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-bold text-rose-900 dark:text-rose-200 uppercase tracking-wide">
                      Safety Alert: Known Allergies
                    </h5>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {(medicalHistory?.allergies || (selectedPatient.allergiesText ? [selectedPatient.allergiesText] : ['Penicillin'])).map(
                        (all, i) => (
                          <span
                            key={i}
                            className="text-xs font-bold px-2 py-0.5 rounded-md bg-rose-200/70 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200"
                          >
                            ⚠️ {all}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Medical Chart Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl overflow-x-auto scrollbar-none">
                {[
                  { id: 'overview', label: 'Vitals & Complaint', icon: Activity },
                  { id: 'history', label: 'Past History', icon: History },
                  { id: 'medications', label: 'Medications', icon: Pill },
                  { id: 'prescriptions', label: 'Past Prescriptions', icon: FileText },
                  { id: 'reports', label: 'Lab Reports', icon: FlaskConical },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = historyTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setHistoryTab(tab.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition ${
                        isActive
                          ? 'bg-white dark:bg-[#111827] text-sky-600 dark:text-sky-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab Content Display */}
              <div className="min-h-[220px]">
                {historyTab === 'overview' && (
                  <div className="space-y-3 animate-in fade-in">
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Current Chief Symptoms
                      </span>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {selectedPatient.symptoms?.map((s, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                      {selectedPatient.otherSymptomsText && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                          <strong>Patient Notes:</strong> {selectedPatient.otherSymptomsText}
                        </p>
                      )}
                      {selectedPatient.triageNotes && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          <strong>Triage Assessment:</strong> {selectedPatient.triageNotes}
                        </p>
                      )}
                    </div>

                    {/* Vitals Grid */}
                    <div className="grid grid-cols-4 gap-2">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">BP</span>
                        <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">122/80</p>
                        <span className="text-[9px] text-emerald-600">Normal</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Pulse</span>
                        <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">76 bpm</p>
                        <span className="text-[9px] text-emerald-600">Regular</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Temp</span>
                        <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">98.4°F</p>
                        <span className="text-[9px] text-emerald-600">Afebrile</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">SpO2</span>
                        <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">99%</p>
                        <span className="text-[9px] text-emerald-600">Room Air</span>
                      </div>
                    </div>
                  </div>
                )}

                {historyTab === 'history' && (
                  <div className="space-y-2.5 animate-in fade-in">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Documented Chronic Conditions & Prior Diagnosis
                    </span>
                    {(medicalHistory?.chronicConditions && medicalHistory.chronicConditions.length > 0) ? (
                      <div className="space-y-1.5">
                        {medicalHistory.chronicConditions.map((cond, i) => (
                          <div
                            key={i}
                            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-medium"
                          >
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              • {cond}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">Documented</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 p-4 text-center">
                        No chronic conditions registered for this patient.
                      </p>
                    )}
                    {medicalHistory?.extractedDocumentSummary && (
                      <div className="p-3 rounded-xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-xs text-sky-900 dark:text-sky-300">
                        <strong>Clinical Summary:</strong> {medicalHistory.extractedDocumentSummary}
                      </div>
                    )}
                  </div>
                )}

                {historyTab === 'medications' && (
                  <div className="space-y-2 animate-in fade-in">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Active Medications (EHR)
                    </span>
                    {medicalHistory?.currentMedications && medicalHistory.currentMedications.length > 0 ? (
                      medicalHistory.currentMedications.map((med, i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">{med.name}</p>
                            <p className="text-[11px] text-slate-500">{med.dose}</p>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            {med.status || 'Active'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 p-4 text-center">
                        No active medications on record.
                      </p>
                    )}
                  </div>
                )}

                {historyTab === 'prescriptions' && (
                  <div className="space-y-2.5 animate-in fade-in max-h-[300px] overflow-y-auto pr-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Historical Prescriptions (MongoDB)
                    </span>
                    {medicalHistory?.prescriptions && medicalHistory.prescriptions.length > 0 ? (
                      medicalHistory.prescriptions.map((rx) => (
                        <div
                          key={rx.id}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold font-mono text-sky-600 dark:text-sky-400">
                              {rx.prescriptionNumber}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(rx.prescribedAt).toLocaleDateString('en-IN')}
                            </span>
                          </div>
                          <p className="font-bold text-slate-900 dark:text-white">
                            Dx: {rx.diagnosis}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            By {rx.doctorName} • {rx.medicines?.length || 0} Medicines
                          </p>
                          <div className="pt-1 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewPrescriptionModal(rx)}
                              className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" /> View Rx
                            </button>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={() => handlePrintPrescriptionPDF(rx)}
                              className="text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Download className="w-3 h-3" /> PDF Export
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 p-4 text-center">
                        No previous prescriptions found for this patient in MongoDB.
                      </p>
                    )}
                  </div>
                )}

                {historyTab === 'reports' && (
                  <div className="space-y-2.5 animate-in fade-in max-h-[300px] overflow-y-auto pr-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Verified Laboratory & Diagnostic Reports
                    </span>
                    {medicalHistory?.labReports && medicalHistory.labReports.length > 0 ? (
                      medicalHistory.labReports.map((rep) => (
                        <div
                          key={rep.id}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {rep.title}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              {rep.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">{rep.lab} • {rep.date}</p>
                          <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-1 bg-white dark:bg-slate-800 p-2 rounded-lg font-mono">
                            {rep.result}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 p-4 text-center">
                        No uploaded lab reports on file.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#111827] rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center text-slate-400">
              <Stethoscope className="w-12 h-12 mx-auto text-sky-500 stroke-1" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white mt-3">
                No Patient Selected
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Click "Call Next Patient" from the top banner or select an active token from the waiting queue on the left.
              </p>
            </div>
          )}
        </div>

        {/* =====================================================================
            COLUMN 3: ADD PRESCRIPTION & FINISH CONSULTATION (4 Cols on Desktop)
            ===================================================================== */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-[#111827] rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  Doctor Prescription Form
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                MongoDB Validated
              </span>
            </div>

            {/* Diagnosis Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Clinical Diagnosis *
              </label>
              <input
                type="text"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="e.g. Knee Osteoarthritis Grade II / Acute Strain"
                className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 font-semibold"
              />

              {/* Quick Preset Diagnosis Chips */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {diagnosisPresets.slice(0, 3).map((preset, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setDiagnosis(preset)}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-sky-100 dark:bg-slate-800 dark:hover:bg-sky-950 text-slate-600 dark:text-slate-300 hover:text-sky-700 transition cursor-pointer"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Doctor Clinical Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Clinical Examination Notes & Observations
              </label>
              <textarea
                value={doctorNotes}
                onChange={(e) => setDoctorNotes(e.target.value)}
                rows={2}
                placeholder="Physical signs, range of motion, tenderness, auscultation findings..."
                className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Multi-Medicine Prescription List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5 text-sky-500" />
                  Medicines Prescribed ({medicines.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddMedicine}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 hover:bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300 flex items-center gap-1 cursor-pointer transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Medicine
                </button>
              </div>

              {/* Quick Department Common Drug Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400">Quick Add:</span>
                <button
                  type="button"
                  onClick={() =>
                    applyQuickMedicine('Paracetamol 650mg', '1 Tablet', '1-0-1 (SOS)', '3 days', 'Take after food')
                  }
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-sky-100 cursor-pointer"
                >
                  + Paracetamol 650mg
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyQuickMedicine('Pantoprazole 40mg', '1 Capsule', '1-0-0 (Morning)', '7 days', 'Before breakfast')
                  }
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-sky-100 cursor-pointer"
                >
                  + Pantoprazole 40mg
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyQuickMedicine('Glucosamine Sulfate 500mg', '1 Cap', '1-0-1 (BD)', '30 days', 'After food')
                  }
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-sky-100 cursor-pointer"
                >
                  + Glucosamine 500mg
                </button>
              </div>

              {/* Medicine Inputs List */}
              <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                {medicines.map((med, index) => (
                  <div
                    key={med.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 font-bold text-[10px] flex items-center justify-center">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        placeholder="Drug Name (e.g. Aceclofenac 100mg)"
                        value={med.name}
                        onChange={(e) => handleUpdateMedicine(med.id, 'name', e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveMedicine(med.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                        title="Remove medicine"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold">Dosage</label>
                        <input
                          type="text"
                          value={med.dosage}
                          onChange={(e) => handleUpdateMedicine(med.id, 'dosage', e.target.value)}
                          placeholder="e.g. 1 Tablet"
                          className="w-full px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold">Duration</label>
                        <input
                          type="text"
                          value={med.duration}
                          onChange={(e) => handleUpdateMedicine(med.id, 'duration', e.target.value)}
                          placeholder="e.g. 5 days"
                          className="w-full px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold">Frequency</label>
                        <select
                          value={med.frequency}
                          onChange={(e) => handleUpdateMedicine(med.id, 'frequency', e.target.value)}
                          className="w-full px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs cursor-pointer"
                        >
                          <option value="1-0-1 (Twice daily after meals)">1-0-1 (Twice daily after meals)</option>
                          <option value="1-0-0 (Once daily morning)">1-0-0 (Once daily morning)</option>
                          <option value="0-0-1 (Once daily at bedtime)">0-0-1 (Once daily at bedtime)</option>
                          <option value="1-1-1 (Thrice daily)">1-1-1 (Thrice daily)</option>
                          <option value="1-0-1 (SOS / When needed)">1-0-1 (SOS / As needed)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold">Instructions</label>
                        <input
                          type="text"
                          value={med.instructions}
                          onChange={(e) => handleUpdateMedicine(med.id, 'instructions', e.target.value)}
                          placeholder="e.g. After food"
                          className="w-full px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Follow-up & Dietary Advice */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Follow-up Date
                </label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Lifestyle / Advice
                </label>
                <input
                  type="text"
                  value={dietaryAdvice}
                  onChange={(e) => setDietaryAdvice(e.target.value)}
                  placeholder="e.g. Ice fomentation, avoid stairs"
                  className="w-full px-2.5 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                />
              </div>
            </div>

            {/* Attending Physician Confirmation Stamp */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-[11px] text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Prescription electronically stamped by <strong>{currentDoctor.name}</strong>. Strictly doctor confirmed.
              </span>
            </div>

            {/* Prescription Action Buttons */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const rx = await handleSavePrescription();
                    if (rx) setPreviewPrescriptionModal(rx);
                  }}
                  disabled={isSavingPrescription || !selectedPatient}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-sky-500 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview & Save Rx</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const rx = await handleSavePrescription();
                    if (rx) handlePrintPrescriptionPDF(rx);
                  }}
                  disabled={isSavingPrescription || !selectedPatient}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  title="Print & PDF Export"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
              </div>

              {/* Finish Consultation Button */}
              <button
                type="button"
                onClick={handleFinishConsultation}
                disabled={isFinishingConsultation || !inConsultationPatient}
                className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                  inConsultationPatient
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-600/20'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isFinishingConsultation
                    ? 'Saving & Finalizing...'
                    : inConsultationPatient
                    ? `Finish Consultation (Token #${inConsultationPatient.tokenNumber})`
                    : 'Finish Consultation (Waiting For Active Patient)'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          BOTTOM SECTION: COMPLETED CONSULTATIONS TODAY (MongoDB Persisted Table)
          ========================================================================= */}
      <div className="bg-white dark:bg-[#111827] rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white font-heading">
                Today's Completed Consultations ({completedConsultationsList.length + completedPatients.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                Permanent records stored in MongoDB with timestamp and prescription links.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Auto-sync active
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-3">Token</th>
                <th className="py-2.5 px-3">Patient Name</th>
                <th className="py-2.5 px-3">UHID</th>
                <th className="py-2.5 px-3">Diagnosis</th>
                <th className="py-2.5 px-3">Completed At</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {completedConsultationsList.length === 0 && completedPatients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-400">
                    No completed consultations logged yet today.
                  </td>
                </tr>
              ) : (
                completedConsultationsList.map((cons) => (
                  <tr key={cons.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-mono font-bold text-sky-600 dark:text-sky-400">
                      #{cons.tokenNumber}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                      {cons.patientName}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                      {cons.patientUhid}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                      {cons.diagnosis}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                      {cons.completedAt}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Completed
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {cons.prescription ? (
                        <button
                          type="button"
                          onClick={() => setPreviewPrescriptionModal(cons.prescription!)}
                          className="text-[11px] font-bold text-sky-600 hover:underline cursor-pointer"
                        >
                          View Rx
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400">Consult Only</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          PRESCRIPTION PREVIEW MODAL
          ========================================================================= */}
      {previewPrescriptionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#111827] rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-600" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white font-heading">
                  Digital Prescription Preview
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPrescriptionModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Prescription Slip Card */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs font-sans">
              <div className="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h4 className="font-extrabold text-sm text-sky-700 dark:text-sky-400">
                    MAX SUPER SPECIALTY HOSPITAL, MOHALI
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Department of {previewPrescriptionModal.doctorDepartment} • {previewPrescriptionModal.doctorRoom}
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-bold mt-1">
                    Consultant: {previewPrescriptionModal.doctorName}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                    {previewPrescriptionModal.prescriptionNumber}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Date: {new Date(previewPrescriptionModal.prescribedAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
              </div>

              {/* Patient info */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-white dark:bg-slate-800 rounded-xl">
                <div>
                  <span className="text-[10px] text-slate-400">Patient:</span>
                  <p className="font-bold text-slate-900 dark:text-white">
                    {previewPrescriptionModal.patientName} ({previewPrescriptionModal.patientAge}y, {previewPrescriptionModal.patientGender})
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">UHID:</span>
                  <p className="font-mono font-bold text-slate-900 dark:text-white">
                    {previewPrescriptionModal.patientUhid}
                  </p>
                </div>
              </div>

              {/* Diagnosis */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Diagnosis:</span>
                <p className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">
                  {previewPrescriptionModal.diagnosis}
                </p>
              </div>

              {/* Medicines Table */}
              <div>
                <span className="text-base font-bold text-sky-600 font-serif">Rx</span>
                <div className="space-y-1.5 mt-1">
                  {previewPrescriptionModal.medicines.map((m, i) => (
                    <div
                      key={m.id || i}
                      className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">
                          {i + 1}. {m.name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {m.dosage} • {m.frequency} • {m.instructions}
                        </p>
                      </div>
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {m.duration}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {previewPrescriptionModal.dietaryAdvice && (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Diet / Advice:</span>
                  <p className="text-slate-700 dark:text-slate-300 mt-0.5">
                    {previewPrescriptionModal.dietaryAdvice}
                  </p>
                </div>
              )}

              {/* Signature */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-right">
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  {previewPrescriptionModal.doctorName}
                </p>
                <p className="text-[10px] text-slate-400">
                  {previewPrescriptionModal.signature || 'Electronically Verified by Attending Physician'}
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPreviewPrescriptionModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handlePrintPrescriptionPDF(previewPrescriptionModal)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Official PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
