export type PatientType = 'new' | 'followup';

export type TriageCategory = 'standard' | 'priority' | 'urgent_er' | 'fast_track_lab';

export type DoctorStatus = 'in_room' | 'on_break' | 'shifted_room' | 'in_procedure';

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
  paymentPlan: 'onetime_299' | 'pass_999';
  status: 'pending_payment' | 'confirmed' | 'in_call' | 'completed';
  paidAmount: number;
  meetingRoomId: string;
  scheduledTime: string;
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
  tokenNumber: string; // e.g. "A-42"
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  phone: string;
  uhid: string; // Expandable Alphanumeric ID e.g. "MQ-DEL-894A", "MQ-2026-X89B"
  patientType: PatientType;
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
