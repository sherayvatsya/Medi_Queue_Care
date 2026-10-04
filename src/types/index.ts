export type PatientType = 'new' | 'followup';

export type UserRole = 'patient' | 'staff';

export type StaffSection =
  | 'staff_dashboard'
  | 'queue_management'
  | 'doctor_availability'
  | 'patient_management'
  | 'reports'
  | 'hospital_profile';

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: 'staff' | 'admin' | 'doctor';
  department: string;
  staffId: string;
  hospitalName: string;
  avatarUrl?: string;
}

export type TriageCategory = 'standard' | 'priority' | 'urgent_er' | 'fast_track_lab';

export type DoctorStatus =
  | 'in_room'
  | 'on_break'
  | 'shifted_room'
  | 'in_procedure'
  | 'running_late'
  | 'emergency'
  | 'unavailable';

export interface RescheduleInfo {
  previousTime: string;
  previousDate: string;
  newTime: string;
  newDate: string;
  reason: string;
  customReason?: string;
  changedBy: string;
  changedAt: string;
  isRescheduled: boolean;
}

export interface RescheduleAudit {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  uhid: string;
  doctorId: string;
  doctorName: string;
  previousDate: string;
  previousTime: string;
  newDate: string;
  newTime: string;
  newRoom?: string;
  reason: string;
  customReason?: string;
  changedBy: string;
  changedAt: string;
  impactedQueuePosition?: number;
}

export interface ShiftAffectedAppointment {
  patientId: string;
  tokenNumber: string;
  patientName: string;
  uhid: string;
  originalTime: string;
  suggestedTime: string;
  customTime?: string;
  status: 'waiting' | 'in_consultation' | 'completed' | 'er_escalated';
  isIncluded: boolean;
}

export interface PatientUser {
  id: string;
  uhid: string; // e.g. "MQ-DEL-8942A" or "MQ-2026-X89B"
  name: string;
  phone: string;
  email: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  bloodGroup: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  allergies: string[];
  chronicConditions: string[];
  registeredAt: string;
  avatarUrl?: string;
  hasHealthPass?: boolean;
  medications?: string[];
  diagnoses?: string[];
  extractedDocumentType?: string;
}

export type DocumentType =
  | 'prescription'
  | 'lab_report'
  | 'medical_report'
  | 'discharge_summary'
  | 'health_record'
  | 'other';

export interface ExtractedConfidence {
  fullName?: number;
  mobileNumber?: number;
  email?: number;
  age?: number;
  dateOfBirth?: number;
  gender?: number;
  bloodGroup?: number;
  emergencyContactName?: number;
  emergencyContactPhone?: number;
  allergies?: number;
  medicalConditions?: number;
  medications?: number;
  diagnoses?: number;
}

export interface MedicalExtractionResult {
  fullName: string;
  mobileNumber: string;
  email: string;
  age: number | null;
  dateOfBirth: string;
  gender: 'Male' | 'Female' | 'Other' | '';
  bloodGroup: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  allergies: string[];
  medicalConditions: string[];
  medications: string[];
  diagnoses: string[];
  documentType: DocumentType;
  confidence: ExtractedConfidence;
  isUnclearOrBlurry?: boolean;
  hasMultiplePatients?: boolean;
  hasConflicts?: boolean;
  conflictNotes?: string;
  documentSummary?: string;
}

export interface PreTestItem {
  id: string;
  name: string;
  code: string;
  category: string;
  estimatedTimeMin: number;
  icmrProtocol: string;
  inHospitalLabAvailable?: boolean;
  labLocation?: string;
}

export interface TeleconsultBooking {
  isTeleconsult: boolean;
  paymentPlan: 'onetime_299' | 'pass_999' | 'pass_3999';
  status: 'pending_payment' | 'confirmed' | 'in_call' | 'completed';
  paidAmount: number;
  meetingRoomId: string;
  scheduledTime: string;
}

export interface TeleconsultPaymentDetails {
  paymentId: string; // e.g. "PAY-2026-MQ-8492X"
  transactionId: string;
  amount: number;
  currency: string; // "INR"
  method: 'upi' | 'card' | 'netbanking' | 'wallet' | 'paylater';
  methodLabel: string; // e.g. "Google Pay (UPI)", "HDFC Credit Card ending in 4242"
  status: 'captured' | 'failed' | 'pending';
  paidAt: string;
  gatewayRef: string;
}

export interface TeleconsultAppointment {
  id: string; // e.g. "TC-2026-8942-A"
  patientId: string;
  patientName: string;
  patientUhid: string;
  patientPhone: string;
  patientEmail: string;
  // Hospital Association
  hospitalId?: string;
  hospitalName?: string;
  hospitalAddress?: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorDepartment: string;
  doctorAvatar: string;
  doctorRoom: string;
  date: string; // e.g. "Today, Aug 22, 2026"
  slotTime: string; // e.g. "11:30 AM - 11:45 AM"
  type: 'Tele-Consult';
  paymentPlan: 'onetime_299' | 'pass_999' | 'pass_3999';
  amount: number;
  status: 'confirmed' | 'in_consultation' | 'completed' | 'cancelled';
  meetingRoomId: string;
  paymentDetails?: TeleconsultPaymentDetails;
  createdAt: string;
}

export interface WheelchairRequest {
  id: string;
  patientId: string;
  patientName: string;
  tokenNumber: string;
  location: string; // e.g. "Main Gate 1 Entrance", "Metro Skywalk Gate 3", "ER Gate 2"
  requestedAt: string;
  status: 'requested' | 'dispatched' | 'arrived' | 'completed';
  porterName?: string;
}

export interface Patient {
  id: string;
  userId?: string;
  tokenNumber: string; // e.g. "A-42"
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  phone: string;
  uhid: string; // Expandable Alphanumeric ID e.g. "MQ-DEL-894A", "MQ-2026-X89B"
  patientType: PatientType;
  // Hospital Association
  hospitalId?: string;
  hospitalName?: string;
  hospitalAddress?: string;
  department: string;
  doctorId: string;
  doctorName: string;
  roomNumber: string;
  opdBlock: string;
  floor: string;
  symptoms: string[];
  otherSymptomsText?: string;
  allergiesText?: string;
  triageCategory: TriageCategory;
  triageNotes: string;
  preTestRecommended: PreTestItem[];
  preTestOptIn: boolean;
  preTestStatus: 'not_required' | 'pending' | 'in_progress' | 'completed';
  queuePosition: number;
  estimatedWaitMinutes: number;
  status: 'waiting' | 'in_consultation' | 'completed' | 'er_escalated';
  createdAt: string;
  calledAt?: string;
  // Appointment Time & Rescheduling
  appointmentDate?: string;
  appointmentTime?: string;
  rescheduleInfo?: RescheduleInfo;
  auditHistory?: RescheduleAudit[];
  wheelchairRequest?: WheelchairRequest;
  teleconsult?: TeleconsultBooking;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  department: string;
  roomNumber: string;
  opdBlock: string;
  floor: string;
  status: DoctorStatus;
  currentPatientToken: string | null;
  avgConsultationTimeMin: number;
  todayConsultedCount: number;
  activeQueueCount: number;
  avatar: string;
  teleconsultAvailable?: boolean;
  hospitalId?: string;
  hospitalName?: string;
  hospitalAddress?: string;
  // Doctor Schedule & Delay Attributes
  delayMinutes?: number;
  delayReason?: string;
  emergencyUnavailableUntil?: string;
  emergencyReason?: string;
  scheduleStatusLabel?: string;
}

export interface ICMRProtocol {
  id: string;
  department: string;
  condition: string;
  icmrCode: string;
  recommendedTests: string[];
  rationale: string;
  timeSavedMins: number;
  active: boolean;
  accuracyRate: string;
}

export interface HospitalStat {
  avgWaitTimeMin: number;
  totalFootfallToday: number;
  activeInQueue: number;
  labFastTrackPercentage: number;
  erEscalationsCount: number;
  doctorCapacityUtilization: number;
}

export interface WayfindingStep {
  stepNumber: number;
  instruction: string;
  landmark: string;
  distanceMeters: number;
  icon: string;
}
