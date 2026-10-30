import React, { useState, useEffect, useCallback } from 'react';
import { Doctor, Patient, ICMRProtocol, PatientUser, StaffUser, UserRole, StaffSection } from './types';
import { INITIAL_DOCTORS, INITIAL_PATIENTS, INITIAL_PROTOCOLS, INITIAL_PATIENT_USERS } from './data/mockData';
import { Header, PatientNavView } from './components/Header';
import { PatientPortal } from './components/PatientPortal';
import { PatientAuth } from './components/PatientAuth';
import { StaffDashboard } from './components/StaffDashboard';
import { TeleconsultModule } from './components/TeleconsultModule';
import { HospitalLeafletMap } from './components/HospitalLeafletMap';
import { HospitalLogin } from './components/HospitalLogin';
import { DoctorLoginPage } from './components/DoctorLoginPage';
import { AdminLoginPage } from './components/AdminLoginPage';
import { OTPAuthModal } from './components/OTPAuthModal';
import { EditProfileModal } from './components/EditProfileModal';
import { Sidebar, SidebarTab } from './components/Sidebar';
import { SupportModal } from './components/SupportModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MedicalFileModal } from './components/MedicalFileModal';
import { NearbyLabsModal } from './components/NearbyLabsModal';
import { PatientAppointments } from './components/PatientAppointments';
import { PatientPass } from './components/PatientPass';
import { playHospitalChime, playUrgentAlertSound } from './utils/audio';
import { getValidDoctorAvatar } from './utils/doctorAvatar';
import {
  auth,
  db,
  seedInitialFirestoreData,
  savePatientTokenToFirestore,
  saveUserProfileToFirestore,
  updateDoctorStatusInFirestore,
  signOutPatient,
} from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';

export default function App() {
  // 1. Role-Based Access Control & User State Management
  const [userRole, setUserRole] = useState<UserRole>(() => {
    const savedRole = localStorage.getItem('mediqueue_role');
    if (savedRole === 'staff' || savedRole === 'admin' || savedRole === 'doctor') {
      return savedRole as UserRole;
    }
    return 'patient';
  });

  const [staffUser, setStaffUser] = useState<StaffUser | null>(() => {
    try {
      const savedStaff = localStorage.getItem('mediqueue_staff_user');
      return savedStaff ? JSON.parse(savedStaff) : null;
    } catch {
      return null;
    }
  });

  const [currentUser, setCurrentUser] = useState<PatientUser | null>(() => {
    try {
      const savedPatient = localStorage.getItem('mediqueue_patient_user');
      return savedPatient ? JSON.parse(savedPatient) : INITIAL_PATIENT_USERS[0];
    } catch {
      return INITIAL_PATIENT_USERS[0];
    }
  });

  // 2. Navigation State for Patient & Staff
  const [patientNavView, setPatientNavView] = useState<PatientNavView>(() => {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (hash === 'teleconsult') return 'teleconsult';
    if (hash === 'hospital-map' || hash === 'map' || hash === 'hospitals') return 'hospital_map';
    if (hash === 'appointments') return 'appointments';
    if (hash === 'patient-pass' || hash === 'patient' || hash === 'pass') return 'patient_pass';
    return 'dashboard';
  });

  const [activeStaffSection, setActiveStaffSection] = useState<StaffSection>(() => {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (hash === 'doctor' || hash === 'doctor-dashboard') return 'doctor_dashboard';
    if (hash === 'queue' || hash === 'queue-management') return 'queue_management';
    if (hash === 'doctors' || hash === 'doctor-availability') return 'doctor_availability';
    if (hash === 'patients' || hash === 'patient-management') return 'patient_management';
    if (hash === 'reports' || hash === 'analytics') return 'reports';
    if (hash === 'hospital-profile' || hash === 'profile') return 'hospital_profile';
    return 'staff_dashboard';
  });

  const [isDoctorLoginOpen, setIsDoctorLoginOpen] = useState<boolean>(() => {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    return hash === 'doctor-login' || hash === 'doctor-auth';
  });
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState<boolean>(() => {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    return hash === 'admin-login' || hash === 'hospital-login' || hash === 'staff-login';
  });
  const [isHospitalLoginOpen, setIsHospitalLoginOpen] = useState<boolean>(false);

  // Sidebar & Modal UI Controls
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>(() => {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (hash === 'appointments') return 'appointments';
    if (hash === 'patient-pass' || hash === 'patient' || hash === 'pass') return 'patient_pass';
    if (hash === 'teleconsult') return 'teleconsult';
    if (hash === 'medical-file') return 'medical_file';
    return 'dashboard';
  });
  const [showSupportModal, setShowSupportModal] = useState<boolean>(false);
  const [showAppMedicalFileModal, setShowAppMedicalFileModal] = useState<boolean>(() => {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    return hash === 'medical-file';
  });
  const [medicalFileInitialTab, setMedicalFileInitialTab] = useState<'overview' | 'history' | 'allergies' | 'medications' | 'prescriptions' | 'reports'>('overview');
  const [showAppNearbyLabsModal, setShowAppNearbyLabsModal] = useState<boolean>(false);
  const [isMobileFrameActive, setIsMobileFrameActive] = useState<boolean>(false);
  const [showGlobalAuthModal, setShowGlobalAuthModal] = useState<boolean>(false);
  const [showPatientProfileModal, setShowPatientProfileModal] = useState<boolean>(false);

  // Application Data States
  const [doctors, setDoctors] = useState<Doctor[]>(INITIAL_DOCTORS);
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [protocols, setProtocols] = useState<ICMRProtocol[]>(INITIAL_PROTOCOLS);

  // Active Patient for Patient View (Strictly initialized from authenticated active pass)
  const [currentPatientId, setCurrentPatientId] = useState<string>(() => {
    try {
      const savedPatient = localStorage.getItem('mediqueue_patient_user');
      if (savedPatient) {
        return localStorage.getItem('mediqueue_active_patient_id') || 'pat-3';
      }
      return 'pat-3';
    } catch {
      return 'pat-3';
    }
  });

  // Database Connection Indicator
  const [isDbConnected, setIsDbConnected] = useState<boolean>(false);

  // Live Toast Notification State
  const [toastMessage, setToastMessage] = useState<{
    id: number;
    title: string;
    description: string;
    type: 'info' | 'success' | 'urgent';
  } | null>(null);

  const showToast = useCallback((title: string, description: string, type: 'info' | 'success' | 'urgent' = 'info') => {
    const id = Date.now();
    setToastMessage({ id, title, description, type });
    setTimeout(() => {
      setToastMessage((current) => (current?.id === id ? null : current));
    }, 4500);
  }, []);

  // 3. Sync State with Browser URL & Protected Route Enforcement
  const updateUrlHash = useCallback((hash: string) => {
    if (window.location.hash !== `#${hash}`) {
      window.history.replaceState(null, '', `#${hash}`);
    }
  }, []);

  // Patient Nav Change
  const handlePatientNavChange = (nav: PatientNavView) => {
    setIsHospitalLoginOpen(false);
    setPatientNavView(nav);
    const hashMap: Record<PatientNavView, string> = {
      dashboard: 'dashboard',
      patient_pass: 'patient-pass',
      teleconsult: 'teleconsult',
      hospital_map: 'hospital-map',
      appointments: 'appointments',
      medical_file: 'medical-file',
    };
    updateUrlHash(hashMap[nav] || 'patient-pass');
  };

  // Staff Section Change with Strict Role Enforcement
  const handleStaffSectionChange = (section: StaffSection) => {
    const isStaffOrDoctor = (userRole === 'staff' || userRole === 'doctor' || userRole === 'admin') && staffUser !== null;

    if (!isStaffOrDoctor) {
      if (section === 'doctor_dashboard') {
        showToast('Doctor Authentication Required', 'Please sign in with Doctor credentials to access Doctor Dashboard.', 'urgent');
        setIsDoctorLoginOpen(true);
        updateUrlHash('doctor-login');
      } else {
        showToast('Admin Authentication Required', 'Please sign in with Administrator credentials.', 'urgent');
        setIsAdminLoginOpen(true);
        updateUrlHash('admin-login');
      }
      return;
    }

    // Role-based boundary enforcement: Doctor can only access doctor_dashboard
    if (staffUser?.role === 'doctor' && section !== 'doctor_dashboard') {
      showToast('Access Restricted', 'Physician accounts are restricted to the Doctor Dashboard.', 'urgent');
      setActiveStaffSection('doctor_dashboard');
      updateUrlHash('doctor-dashboard');
      return;
    }

    // Admin accounts have full oversight access including Doctor Dashboard (read/supervise mode)
    // No restriction — admins can view and monitor the Doctor Dashboard

    setActiveStaffSection(section);
    const hashMap: Record<StaffSection, string> = {
      doctor_dashboard: 'doctor-dashboard',
      staff_dashboard: 'staff-dashboard',
      overcrowding_predictor: 'overcrowding-predictor',
      queue_management: 'queue-management',
      doctor_availability: 'doctor-availability',
      patient_management: 'patient-management',
      reports: 'reports',
      hospital_profile: 'hospital-profile',
    };
    updateUrlHash(hashMap[section] || 'staff-dashboard');
  };

  // Handle URL Hash Changes (Enforce route-level protection)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();

      if (hash === 'doctor-login' || hash === 'doctor-auth') {
        setIsDoctorLoginOpen(true);
        setIsAdminLoginOpen(false);
        setIsHospitalLoginOpen(false);
        return;
      }

      if (hash === 'admin-login' || hash === 'hospital-login' || hash === 'staff-login') {
        setIsAdminLoginOpen(true);
        setIsDoctorLoginOpen(false);
        setIsHospitalLoginOpen(false);
        return;
      }

      if (hash === 'teleconsult') {
        setIsHospitalLoginOpen(false);
        setPatientNavView('teleconsult');
        setActiveSidebarTab('teleconsult');
        return;
      }

      if (hash === 'hospital-map' || hash === 'map' || hash === 'hospitals') {
        setIsHospitalLoginOpen(false);
        setPatientNavView('hospital_map');
        return;
      }

      if (hash === 'appointments') {
        setIsHospitalLoginOpen(false);
        setPatientNavView('appointments');
        setActiveSidebarTab('appointments');
        return;
      }

      if (hash === 'patient-pass' || hash === 'patient' || hash === 'pass') {
        setIsHospitalLoginOpen(false);
        setPatientNavView('patient_pass');
        setActiveSidebarTab('patient_pass');
        return;
      }

      if (hash === 'medical-file') {
        setIsHospitalLoginOpen(false);
        setActiveSidebarTab('medical_file');
        setMedicalFileInitialTab('overview');
        setShowAppMedicalFileModal(true);
        return;
      }

      if (hash === 'dashboard' || hash === 'patient-portal' || hash === '') {
        setIsHospitalLoginOpen(false);
        setPatientNavView('dashboard');
        setActiveSidebarTab('dashboard');
        return;
      }

      // Hospital routes
      const hospitalRoutes = [
        'doctor',
        'doctor-dashboard',
        'staff',
        'staff-dashboard',
        'overcrowding',
        'overcrowding-predictor',
        'predictor',
        'queue',
        'queue-management',
        'doctors',
        'doctor-availability',
        'patients',
        'patient-management',
        'reports',
        'analytics',
        'hospital-profile',
      ];

      if (hospitalRoutes.includes(hash)) {
        const savedRole = localStorage.getItem('mediqueue_role');
        const savedStaffStr = localStorage.getItem('mediqueue_staff_user');
        let parsedStaff: any = null;
        try {
          if (savedStaffStr) parsedStaff = JSON.parse(savedStaffStr);
        } catch {}

        const isAuthenticatedStaff = (savedRole === 'staff' || savedRole === 'doctor' || savedRole === 'admin') && parsedStaff;

        if (hash === 'doctor' || hash === 'doctor-dashboard') {
          if (isAuthenticatedStaff && parsedStaff?.role === 'doctor') {
            setIsDoctorLoginOpen(false);
            setIsAdminLoginOpen(false);
            setIsHospitalLoginOpen(false);
            setActiveStaffSection('doctor_dashboard');
          } else {
            showToast('Doctor Access Guard', 'Access restricted to authorized doctors. Please log in.', 'urgent');
            setIsDoctorLoginOpen(true);
            setIsAdminLoginOpen(false);
            window.history.replaceState(null, '', '#doctor-login');
          }
          return;
        }

        // Admin routes
        if (isAuthenticatedStaff && parsedStaff?.role === 'admin') {
          setIsDoctorLoginOpen(false);
          setIsAdminLoginOpen(false);
          setIsHospitalLoginOpen(false);
          if (hash === 'queue' || hash === 'queue-management') setActiveStaffSection('queue_management');
          else if (hash === 'overcrowding' || hash === 'overcrowding-predictor' || hash === 'predictor') setActiveStaffSection('overcrowding_predictor');
          else if (hash === 'doctors' || hash === 'doctor-availability') setActiveStaffSection('doctor_availability');
          else if (hash === 'patients' || hash === 'patient-management') setActiveStaffSection('patient_management');
          else if (hash === 'reports' || hash === 'analytics') setActiveStaffSection('reports');
          else if (hash === 'hospital-profile') setActiveStaffSection('hospital_profile');
          else setActiveStaffSection('staff_dashboard');
        } else {
          showToast('Admin Access Guard', 'Access restricted to hospital administrators. Please log in.', 'urgent');
          setIsAdminLoginOpen(true);
          setIsDoctorLoginOpen(false);
          window.history.replaceState(null, '', '#admin-login');
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [showToast]);

  // 4. Initialize Firebase and Listen to Auth Changes
  useEffect(() => {
    seedInitialFirestoreData().catch(console.warn);

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            const data = snap.data() as PatientUser;
            setCurrentUser(data);
            localStorage.setItem('mediqueue_patient_user', JSON.stringify(data));
          } else {
            const newUser: PatientUser = {
              id: fbUser.uid,
              uhid: `SJMC-${new Date().getFullYear()}-DEL-${Math.floor(10000 + Math.random() * 90000)}P`,
              name: fbUser.displayName || 'Registered Patient',
              email: fbUser.email || '',
              phone: fbUser.phoneNumber || '+91 98101 23456',
              age: 32,
              gender: 'Male',
              bloodGroup: 'B+',
              emergencyContactName: 'Family Contact',
              emergencyContactPhone: '+91 98111 99999',
              allergies: ['Penicillin'],
              chronicConditions: ['Hypertension'],
              registeredAt: new Date().toISOString(),
              avatarUrl: fbUser.photoURL || undefined,
              hasHealthPass: true,
            };
            await setDoc(userDocRef, newUser);
            setCurrentUser(newUser);
            localStorage.setItem('mediqueue_patient_user', JSON.stringify(newUser));
          }
        } catch (e) {
          console.warn('Auth snapshot error:', e);
        }
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // 5. Real-time Firestore Listeners for Patients & Doctors
  useEffect(() => {
    try {
      const unsubPatients = onSnapshot(
        collection(db, 'patients'),
        (snapshot) => {
          if (!snapshot.empty) {
            setIsDbConnected(true);
            const livePatients: Patient[] = [];
            snapshot.forEach((docSnap) => {
              livePatients.push(docSnap.data() as Patient);
            });
            livePatients.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setPatients(livePatients);
          }
        },
        (err) => {
          console.warn('Firestore patients sync fallback to local memory:', err);
        }
      );

      const unsubDoctors = onSnapshot(
        collection(db, 'doctors'),
        (snapshot) => {
          if (!snapshot.empty) {
            setIsDbConnected(true);
            const liveDoctors: Doctor[] = [];
            snapshot.forEach((docSnap) => {
              const rawDoc = docSnap.data() as Doctor;
              const cleanAvatar = getValidDoctorAvatar(rawDoc.id, rawDoc.avatar);
              liveDoctors.push({
                ...rawDoc,
                avatar: cleanAvatar,
              });
            });
            setDoctors(liveDoctors);
          }
        },
        (err) => {
          console.warn('Firestore doctors sync fallback to local memory:', err);
        }
      );

      return () => {
        unsubPatients();
        unsubDoctors();
      };
    } catch (e) {
      console.warn('Firestore subscription error:', e);
    }
  }, []);

  // Find active patient object strictly belonging to currentUser or the active session
  const currentPatient = currentUser
    ? (currentPatientId ? patients.find((p) => p.id === currentPatientId) : null) ||
      patients.find((p) => p.userId === currentUser.id) ||
      patients.find(
        (p) =>
          currentUser.uhid &&
          p.uhid &&
          p.uhid.toLowerCase() === currentUser.uhid.toLowerCase()
      ) ||
      patients.find(
        (p) =>
          currentUser.phone &&
          p.phone &&
          p.phone.replace(/\D/g, '') === currentUser.phone.replace(/\D/g, '')
      ) ||
      null
    : null;

  // Active Hospital Name strictly from active patient context or staff user
  const activeHospitalName =
    userRole === 'staff'
      ? staffUser?.hospitalName || 'Hospital Network'
      : currentUser && currentPatient
      ? currentPatient.hospitalName || 'Max Super Specialty Hospital, Mohali'
      : null;

  // Handle Patient Login
  const handleUserLogin = (user: PatientUser, redirectNavView?: 'dashboard' | 'patient_pass' | 'teleconsult') => {
    setCurrentUser(user);
    setUserRole('patient');
    localStorage.setItem('mediqueue_role', 'patient');
    localStorage.setItem('mediqueue_patient_user', JSON.stringify(user));

    const existingPatient = patients.find(
      (p) =>
        (p.userId && p.userId === user.id) ||
        (p.uhid && user.uhid && p.uhid.toLowerCase() === user.uhid.toLowerCase()) ||
        (p.phone && user.phone && p.phone.replace(/\D/g, '') === user.phone.replace(/\D/g, ''))
    );
    if (existingPatient) {
      setCurrentPatientId(existingPatient.id);
      localStorage.setItem('mediqueue_active_patient_id', existingPatient.id);
    } else {
      setCurrentPatientId('');
      localStorage.removeItem('mediqueue_active_patient_id');
    }
    setIsHospitalLoginOpen(false);
    const targetNav = redirectNavView || patientNavView || 'dashboard';
    setPatientNavView(targetNav);
    updateUrlHash(targetNav === 'teleconsult' ? 'teleconsult' : targetNav === 'patient_pass' ? 'patient-pass' : 'dashboard');
  };

  // Handle Hospital Staff / Doctor / Admin Login
  const handleStaffLoginSuccess = (staff: StaffUser) => {
    setStaffUser(staff);
    const role = staff.role === 'doctor' ? 'doctor' : 'admin';
    setUserRole(role as any);
    localStorage.setItem('mediqueue_role', role);
    localStorage.setItem('mediqueue_staff_user', JSON.stringify(staff));

    setIsDoctorLoginOpen(false);
    setIsAdminLoginOpen(false);
    setIsHospitalLoginOpen(false);

    if (staff.role === 'doctor') {
      setActiveStaffSection('doctor_dashboard');
      updateUrlHash('doctor-dashboard');
    } else {
      setActiveStaffSection('staff_dashboard');
      updateUrlHash('staff-dashboard');
    }
  };

  // Handle Logout (Strictly Clears Role, Patient Session, Active Hospital & Storage)
  const handleLogout = async () => {
    if (userRole === 'staff' || userRole === 'doctor' || userRole === 'admin') {
      setStaffUser(null);
      setUserRole('patient');
      localStorage.removeItem('mediqueue_role');
      localStorage.removeItem('mediqueue_staff_user');
      showToast('Session Ended', 'Logged out securely.', 'info');
      setIsDoctorLoginOpen(false);
      setIsAdminLoginOpen(false);
      setIsHospitalLoginOpen(false);
      setPatientNavView('dashboard');
      updateUrlHash('dashboard');
    } else {
      try {
        await signOutPatient();
      } catch (e) {
        console.warn(e);
      }
      setCurrentUser(null);
      setCurrentPatientId('');
      localStorage.removeItem('mediqueue_patient_user');
      localStorage.removeItem('mediqueue_role');
      localStorage.removeItem('mediqueue_selected_hospital');
      localStorage.removeItem('mediqueue_active_patient_id');
      localStorage.removeItem('mediqueue_active_pass');
      sessionStorage.clear();
      showToast('Signed Out', 'Patient session cleared. Ready for next intake.', 'info');
      setPatientNavView('dashboard');
      updateUrlHash('dashboard');
    }
  };

  // Handle Update Patient User Profile
  const handleUpdateUserProfile = (updatedUser: PatientUser) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('mediqueue_patient_user', JSON.stringify(updatedUser));
    saveUserProfileToFirestore(updatedUser);

    setPatients((prev) =>
      prev.map((p) => {
        if (
          (p.uhid && updatedUser.uhid && p.uhid.toLowerCase() === updatedUser.uhid.toLowerCase()) ||
          (p.userId && updatedUser.id && p.userId === updatedUser.id)
        ) {
          const updatedPat: Patient = {
            ...p,
            name: updatedUser.name,
            age: updatedUser.age,
            gender: updatedUser.gender,
            phone: updatedUser.phone,
          };
          savePatientTokenToFirestore(updatedPat);
          return updatedPat;
        }
        return p;
      })
    );
  };

  // Handle Token Generation from Patient Portal
  const handleGenerateToken = (newPatient: Patient) => {
    setPatients((prev) => [newPatient, ...prev]);
    setCurrentPatientId(newPatient.id);
    localStorage.setItem('mediqueue_active_patient_id', newPatient.id);
    savePatientTokenToFirestore(newPatient);

    setDoctors((prev) =>
      prev.map((d) => {
        if (d.id === newPatient.doctorId) {
          const updated = { ...d, activeQueueCount: d.activeQueueCount + 1 };
          updateDoctorStatusInFirestore(d.id, { activeQueueCount: updated.activeQueueCount });
          return updated;
        }
        return d;
      })
    );

    showToast(
      'Token Generated & Synced',
      `Token #${newPatient.tokenNumber} issued for ${newPatient.department} (${newPatient.roomNumber}) and stored in database.`,
      'success'
    );
  };

  // Handle Update Patient
  const handleUpdatePatient = (updated: Patient) => {
    setPatients((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    savePatientTokenToFirestore(updated);
  };

  // Handle Doctor Update
  const handleUpdateDoctor = (updatedDoc: Doctor) => {
    const prevDoc = doctors.find((d) => d.id === updatedDoc.id);
    const roomChanged = prevDoc && prevDoc.roomNumber !== updatedDoc.roomNumber;

    setDoctors((prev) => prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)));
    updateDoctorStatusInFirestore(updatedDoc.id, updatedDoc);

    if (roomChanged) {
      setPatients((prev) =>
        prev.map((p) => {
          if (p.doctorId === updatedDoc.id) {
            const updatedPat = { ...p, roomNumber: updatedDoc.roomNumber };
            savePatientTokenToFirestore(updatedPat);
            return updatedPat;
          }
          return p;
        })
      );

      showToast(
        'Doctor Relocated Real-Time',
        `${updatedDoc.name} shifted to ${updatedDoc.roomNumber}. Patient wayfinding updated across hospital!`,
        'info'
      );
    }
  };

  // Handle Call Next Patient in Doctor Queue
  const handleCallNextPatient = (doctorId: string) => {
    const docItem = doctors.find((d) => d.id === doctorId);
    if (!docItem) return;

    const nextPatient = patients.find((p) => p.doctorId === doctorId && p.status === 'waiting');
    if (!nextPatient) {
      showToast('Queue Empty', `No waiting patients for ${docItem.name}`, 'info');
      return;
    }

    setPatients((prev) =>
      prev.map((p) => {
        if (p.doctorId === doctorId && p.status === 'in_consultation') {
          const compPat: Patient = { ...p, status: 'completed' };
          savePatientTokenToFirestore(compPat);
          return compPat;
        }
        if (p.id === nextPatient.id) {
          const inConsultPat: Patient = {
            ...p,
            status: 'in_consultation',
            queuePosition: 0,
            estimatedWaitMinutes: 0,
            calledAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          savePatientTokenToFirestore(inConsultPat);
          return inConsultPat;
        }
        if (p.doctorId === doctorId && p.status === 'waiting' && p.id !== nextPatient.id) {
          const updatedPat: Patient = {
            ...p,
            queuePosition: Math.max(0, p.queuePosition - 1),
            estimatedWaitMinutes: Math.max(0, p.estimatedWaitMinutes - docItem.avgConsultationTimeMin),
          };
          savePatientTokenToFirestore(updatedPat);
          return updatedPat;
        }
        return p;
      })
    );

    const updatedDocValues = {
      currentPatientToken: nextPatient.tokenNumber,
      todayConsultedCount: docItem.todayConsultedCount + 1,
      activeQueueCount: Math.max(0, docItem.activeQueueCount - 1),
    };
    updateDoctorStatusInFirestore(doctorId, updatedDocValues);

    setDoctors((prev) =>
      prev.map((d) =>
        d.id === doctorId
          ? {
              ...d,
              ...updatedDocValues,
            }
          : d
      )
    );

    showToast(
      'Patient Called In',
      `Calling Token #${nextPatient.tokenNumber} to ${docItem.roomNumber} (${docItem.name})`,
      'success'
    );
  };

  // Handle Mark Consultation Complete
  const handleCompletePatient = (patientId: string) => {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === patientId) {
          const comp = { ...p, status: 'completed' as const };
          savePatientTokenToFirestore(comp);
          return comp;
        }
        return p;
      })
    );

    const completed = patients.find((p) => p.id === patientId);
    if (completed) {
      showToast('Consultation Finished', `Token #${completed.tokenNumber} marked complete.`, 'success');
      playHospitalChime();
    }
  };

  // Handle Escalate to ER
  const handleEscalateToER = (patientId: string) => {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === patientId) {
          const erPat: Patient = {
            ...p,
            triageCategory: 'urgent_er',
            status: 'er_escalated',
            roomNumber: 'ER Bay 1',
            doctorName: 'Emergency Triage Team',
            opdBlock: 'Emergency Casualty Block',
            floor: 'Ground Floor',
            queuePosition: 0,
            estimatedWaitMinutes: 0,
          };
          savePatientTokenToFirestore(erPat);
          return erPat;
        }
        return p;
      })
    );

    playUrgentAlertSound();
    showToast(
      '🚨 EMERGENCY ESCALATION',
      'Patient diverted to Emergency Casualty Bay 1 with Code RED priority.',
      'urgent'
    );
  };

  // Toggle ICMR Protocol
  const handleToggleProtocol = (protocolId: string) => {
    setProtocols((prev) =>
      prev.map((proto) =>
        proto.id === protocolId ? { ...proto, active: !proto.active } : proto
      )
    );
  };

  // Add Custom Protocol
  const handleAddProtocol = (newProto: ICMRProtocol) => {
    setProtocols((prev) => [newProto, ...prev]);
    showToast('Protocol Registered', `ICMR diagnostic rule added: ${newProto.condition}`, 'success');
  };

  const activeWheelchairCount = patients.filter((p) => p.wheelchairRequest && p.wheelchairRequest.status !== 'completed').length;
  const unreadAlerts = patients.filter((p) => p.triageCategory === 'urgent_er').length + activeWheelchairCount;

  // Handle Sidebar Tab Selection
  const handleSidebarTabSelect = (tab: SidebarTab) => {
    setActiveSidebarTab(tab);
    if (tab === 'dashboard') {
      handlePatientNavChange('dashboard');
    } else if (tab === 'patient_pass') {
      handlePatientNavChange('patient_pass');
    } else if (tab === 'appointments') {
      handlePatientNavChange('appointments');
    } else if (tab === 'teleconsult') {
      handlePatientNavChange('teleconsult');
    } else if (tab === 'medical_file') {
      setMedicalFileInitialTab('overview');
      setShowAppMedicalFileModal(true);
    } else if (tab === 'prescriptions') {
      setMedicalFileInitialTab('prescriptions');
      setShowAppMedicalFileModal(true);
    } else if (tab === 'reports') {
      setMedicalFileInitialTab('reports');
      setShowAppMedicalFileModal(true);
    } else if (tab === 'nearby_labs') {
      setShowAppNearbyLabsModal(true);
      playHospitalChime();
    } else if (tab === 'profile_settings') {
      setShowPatientProfileModal(true);
    }
  };

  // VIEW: DEDICATED ADMIN LOGIN PAGE
  if (isAdminLoginOpen) {
    return (
      <div className="min-h-screen text-[#14213D] dark:text-[#F1F5F9] flex flex-col font-sans transition-colors duration-200">
        <AdminLoginPage
          onLoginSuccess={(adminUser) => {
            handleStaffLoginSuccess(adminUser);
            setIsAdminLoginOpen(false);
          }}
          onNavigateDoctorLogin={() => {
            setIsAdminLoginOpen(false);
            setIsDoctorLoginOpen(true);
            updateUrlHash('doctor-login');
          }}
          onBackToPatientPortal={() => {
            setIsAdminLoginOpen(false);
            updateUrlHash(currentUser ? 'dashboard' : 'patient-pass');
          }}
          onShowToast={showToast}
        />

        {/* Support Concierge Modal */}
        <SupportModal
          isOpen={showSupportModal}
          onClose={() => setShowSupportModal(false)}
          onShowToast={showToast}
        />

        {/* Real-time Toast Notifications */}
        {toastMessage && (
          <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-50 animate-in slide-in-from-bottom-5 duration-300 max-w-[calc(100vw-2rem)]">
            <div
              className={`p-3.5 sm:p-4 rounded-2xl border shadow-xl flex items-start gap-3 max-w-sm ${
                toastMessage.type === 'urgent'
                  ? 'bg-rose-50 border-rose-400 text-rose-900'
                  : toastMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                  : 'bg-white dark:bg-[#111827] border-[#E5EDF5] dark:border-[#1E293B] text-[#13213A] dark:text-white'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                  toastMessage.type === 'urgent'
                    ? 'bg-rose-100 text-rose-600'
                    : toastMessage.type === 'success'
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-sky-100 text-[#0B9FE3]'
                }`}
              >
                {toastMessage.type === 'urgent' ? (
                  <i className="fa-solid fa-triangle-exclamation text-xs"></i>
                ) : toastMessage.type === 'success' ? (
                  <i className="fa-solid fa-circle-check text-xs"></i>
                ) : (
                  <i className="fa-solid fa-bell text-xs"></i>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold font-heading truncate">{toastMessage.title}</h4>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] leading-tight mt-0.5">
                  {toastMessage.description}
                </p>
              </div>
              <button
                onClick={() => setToastMessage(null)}
                className="text-[#94A3B8] hover:text-[#13213A] dark:hover:text-white text-xs cursor-pointer"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // VIEW: DEDICATED DOCTOR LOGIN PAGE
  if (isDoctorLoginOpen) {
    return (
      <div className="min-h-screen text-[#14213D] dark:text-[#F1F5F9] flex flex-col font-sans transition-colors duration-200">
        <DoctorLoginPage
          onLoginSuccess={(doctorStaff) => {
            handleStaffLoginSuccess(doctorStaff);
            setIsDoctorLoginOpen(false);
          }}
          onNavigateAdminLogin={() => {
            setIsDoctorLoginOpen(false);
            setIsAdminLoginOpen(true);
            updateUrlHash('admin-login');
          }}
          onBackToPatientPortal={() => {
            setIsDoctorLoginOpen(false);
            updateUrlHash(currentUser ? 'dashboard' : 'patient-pass');
          }}
          onShowToast={showToast}
        />

        {/* Support Concierge Modal */}
        <SupportModal
          isOpen={showSupportModal}
          onClose={() => setShowSupportModal(false)}
          onShowToast={showToast}
        />

        {/* Real-time Toast Notifications */}
        {toastMessage && (
          <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-50 animate-in slide-in-from-bottom-5 duration-300 max-w-[calc(100vw-2rem)]">
            <div
              className={`p-3.5 sm:p-4 rounded-2xl border shadow-xl flex items-start gap-3 max-w-sm ${
                toastMessage.type === 'urgent'
                  ? 'bg-rose-50 border-rose-400 text-rose-900'
                  : toastMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                  : 'bg-white dark:bg-[#111827] border-[#E5EDF5] dark:border-[#1E293B] text-[#13213A] dark:text-white'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                  toastMessage.type === 'urgent'
                    ? 'bg-rose-100 text-rose-600'
                    : toastMessage.type === 'success'
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-sky-100 text-[#0B9FE3]'
                }`}
              >
                {toastMessage.type === 'urgent' ? (
                  <i className="fa-solid fa-triangle-exclamation text-xs"></i>
                ) : toastMessage.type === 'success' ? (
                  <i className="fa-solid fa-circle-check text-xs"></i>
                ) : (
                  <i className="fa-solid fa-bell text-xs"></i>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold font-heading truncate">{toastMessage.title}</h4>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] leading-tight mt-0.5">
                  {toastMessage.description}
                </p>
              </div>
              <button
                onClick={() => setToastMessage(null)}
                className="text-[#94A3B8] hover:text-[#13213A] dark:hover:text-white text-xs cursor-pointer"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // VIEW: DEDICATED HOSPITAL STAFF & ADMIN LOGIN PAGE (Matching PatientAuth full-screen background)
  if (isHospitalLoginOpen) {
    return (
      <div className="min-h-screen text-[#14213D] dark:text-[#F1F5F9] flex flex-col font-sans transition-colors duration-200">
        <HospitalLogin
          onLoginSuccess={handleStaffLoginSuccess}
          onCancel={() => {
            setIsHospitalLoginOpen(false);
            updateUrlHash(currentUser ? 'dashboard' : 'patient-pass');
          }}
          onShowToast={showToast}
          onOpenSupportModal={() => setShowSupportModal(true)}
        />

        {/* Support Concierge Modal */}
        <SupportModal
          isOpen={showSupportModal}
          onClose={() => setShowSupportModal(false)}
          onShowToast={showToast}
        />

        {/* Real-time Toast Notifications */}
        {toastMessage && (
          <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-50 animate-in slide-in-from-bottom-5 duration-300 max-w-[calc(100vw-2rem)]">
            <div
              className={`p-3.5 sm:p-4 rounded-2xl border shadow-xl flex items-start gap-3 max-w-sm ${
                toastMessage.type === 'urgent'
                  ? 'bg-rose-50 border-rose-400 text-rose-900'
                  : toastMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                  : 'bg-white dark:bg-[#111827] border-[#E5EDF5] dark:border-[#1E293B] text-[#13213A] dark:text-white'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                  toastMessage.type === 'urgent'
                    ? 'bg-rose-100 text-rose-600'
                    : toastMessage.type === 'success'
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-sky-100 text-[#0B9FE3]'
                }`}
              >
                {toastMessage.type === 'urgent' ? (
                  <i className="fa-solid fa-triangle-exclamation text-xs"></i>
                ) : toastMessage.type === 'success' ? (
                  <i className="fa-solid fa-circle-check text-xs"></i>
                ) : (
                  <i className="fa-solid fa-bell text-xs"></i>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold font-heading truncate">{toastMessage.title}</h4>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] leading-tight mt-0.5">
                  {toastMessage.description}
                </p>
              </div>
              <button
                onClick={() => setToastMessage(null)}
                className="text-[#94A3B8] hover:text-[#13213A] dark:hover:text-white text-xs cursor-pointer"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // If unauthenticated patient user and not in Hospital Staff Login, render dedicated PatientAuth page
  if (!currentUser && userRole === 'patient') {
    return (
      <div className="min-h-screen bg-[#F6FAFE] dark:bg-[#0B1220] text-[#14213D] dark:text-[#F1F5F9] flex flex-col transition-colors duration-200">
        <PatientAuth
          onLoginSuccess={handleUserLogin}
          onShowToast={showToast}
          onBackToHome={() => handleUserLogin(INITIAL_PATIENT_USERS[0])}
          onOpenSupportModal={() => setShowSupportModal(true)}
          onOpenHospitalStaffLogin={() => {
            setIsHospitalLoginOpen(true);
            updateUrlHash('hospital-login');
          }}
        />

        {/* Support Concierge Modal */}
        <SupportModal
          isOpen={showSupportModal}
          onClose={() => setShowSupportModal(false)}
          onShowToast={showToast}
        />

        {/* Real-time Toast Notifications */}
        {toastMessage && (
          <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-50 animate-in slide-in-from-bottom-5 duration-300 max-w-[calc(100vw-2rem)]">
            <div
              className={`p-3.5 sm:p-4 rounded-2xl border shadow-xl flex items-start gap-3 max-w-sm ${
                toastMessage.type === 'urgent'
                  ? 'bg-rose-50 border-rose-400 text-rose-900'
                  : toastMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                  : 'bg-white dark:bg-[#111827] border-[#E5EDF5] dark:border-[#1E293B] text-[#13213A] dark:text-white'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                  toastMessage.type === 'urgent'
                    ? 'bg-rose-500 text-white'
                    : toastMessage.type === 'success'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-[#087FC9] text-white'
                }`}
              >
                <i
                  className={`fa-solid ${
                    toastMessage.type === 'urgent'
                      ? 'fa-triangle-exclamation'
                      : toastMessage.type === 'success'
                      ? 'fa-check'
                      : 'fa-bell'
                  } text-xs`}
                ></i>
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="font-bold text-xs leading-tight">{toastMessage.title}</h5>
                <p className="text-[11px] opacity-90 mt-0.5 leading-snug break-words">
                  {toastMessage.description}
                </p>
              </div>
              <button
                onClick={() => setToastMessage(null)}
                className="text-[#64748B] hover:text-[#13213A] dark:hover:text-white text-xs cursor-pointer p-1 shrink-0"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F9FC] dark:bg-[#0B1220] text-[#13213A] dark:text-[#F1F5F9] flex flex-col selection:bg-[#087FC9] selection:text-white box-border overflow-x-hidden transition-colors duration-200">
      {/* Top Header - Strictly Role-Based Navigation matching Stitch aesthetic */}
      <Header
        currentRole={userRole}
        patientNavView={patientNavView}
        onPatientNavChange={(nav) => {
          if (nav === 'medical_file') {
            setMedicalFileInitialTab('overview');
            setShowAppMedicalFileModal(true);
            setActiveSidebarTab('medical_file');
            updateUrlHash('medical-file');
            return;
          }
          handlePatientNavChange(nav);
          if (nav === 'dashboard') setActiveSidebarTab('dashboard');
          else if (nav === 'patient_pass') setActiveSidebarTab('patient_pass');
          else if (nav === 'teleconsult') setActiveSidebarTab('teleconsult');
          else if (nav === 'appointments') setActiveSidebarTab('appointments');
        }}
        activeHospitalName={activeHospitalName}
        activeStaffSection={activeStaffSection}
        onStaffSectionChange={handleStaffSectionChange}
        currentUser={currentUser}
        staffUser={staffUser}
        unreadAlertsCount={unreadAlerts}
        onOpenPatientProfile={() => setShowPatientProfileModal(true)}
        onOpenMedicalFile={() => {
          setMedicalFileInitialTab('overview');
          setShowAppMedicalFileModal(true);
          setActiveSidebarTab('medical_file');
          updateUrlHash('medical-file');
        }}
        onOpenPatientAuth={() => setShowGlobalAuthModal(true)}
        onOpenHospitalLogin={() => {
          setIsAdminLoginOpen(true);
          updateUrlHash('admin-login');
        }}
        onOpenDoctorLogin={() => {
          setIsDoctorLoginOpen(true);
          setIsAdminLoginOpen(false);
          updateUrlHash('doctor-login');
        }}
        onOpenAdminLogin={() => {
          setIsAdminLoginOpen(true);
          setIsDoctorLoginOpen(false);
          updateUrlHash('admin-login');
        }}
        onSignOut={handleLogout}
      />

      {/* Main Layout Container with Left Sidebar on Desktop */}
      <div className="flex-1 w-full max-w-[1440px] mx-auto flex flex-col md:flex-row pb-16 md:pb-0">
        {/* Left Sidebar on Desktop (Visible for Patient Portal when not in Hospital Staff Login) */}
        {!isHospitalLoginOpen && userRole === 'patient' && (
          <div className="hidden md:block">
            <Sidebar
              activeTab={activeSidebarTab}
              onSelectTab={handleSidebarTabSelect}
              onOpenSupportModal={() => setShowSupportModal(true)}
            />
          </div>
        )}

        {/* Main App Body */}
        <main className="flex-1 min-w-0 p-2.5 sm:p-6 box-border">
          {/* VIEW 1: HOSPITAL STAFF & DOCTOR CLINICAL MANAGEMENT SUITE
             (Renders for verified Hospital Staff, Admin, or Doctor) */}
          {(userRole === 'staff' || userRole === 'admin' || userRole === 'doctor') && staffUser ? (
            /* VIEW 2: HOSPITAL STAFF MANAGEMENT SUITE
               (Renders only for verified Hospital Staff with dedicated staff sections) */
            <div className="animate-in fade-in duration-200">
              <StaffDashboard
                doctors={doctors}
                patients={patients}
                protocols={protocols}
                staffUser={staffUser}
                activeSection={activeStaffSection}
                onSectionChange={handleStaffSectionChange}
                onUpdateDoctor={handleUpdateDoctor}
                onUpdatePatient={handleUpdatePatient}
                onCallNextPatient={handleCallNextPatient}
                onCompletePatient={handleCompletePatient}
                onEscalateToER={handleEscalateToER}
                onToggleProtocol={handleToggleProtocol}
                onAddProtocol={handleAddProtocol}
              />
            </div>
          ) : (
            /* VIEW 3: PATIENT PORTAL & TELE-CONSULT
               (Strictly for patients and unauthenticated guests) */
            <div className="animate-in fade-in duration-200">
              {patientNavView === 'dashboard' ? (
                <PatientPortal
                  doctors={doctors}
                  currentPatient={currentPatient}
                  currentUser={currentUser}
                  onUserLogin={handleUserLogin}
                  onUserLogout={handleLogout}
                  onUpdateUserProfile={handleUpdateUserProfile}
                  onGenerateToken={handleGenerateToken}
                  onUpdatePatient={handleUpdatePatient}
                  isMobileFrame={isMobileFrameActive}
                  onToggleMobileFrame={() => setIsMobileFrameActive(!isMobileFrameActive)}
                  onShowToast={showToast}
                  onRequestTeleconsult={() => handlePatientNavChange('teleconsult')}
                  onOpenHospitalMap={() => handlePatientNavChange('hospital_map')}
                />
              ) : patientNavView === 'patient_pass' ? (
                <PatientPass
                  currentPatient={currentPatient}
                  currentUser={currentUser}
                  doctors={doctors}
                  onUpdatePatient={handleUpdatePatient}
                  onRegisterToken={() => {
                    setActiveSidebarTab('dashboard');
                    handlePatientNavChange('dashboard');
                  }}
                  onOpenAppointments={() => {
                    setActiveSidebarTab('appointments');
                    handlePatientNavChange('appointments');
                  }}
                  onOpenHospitalMap={() => handlePatientNavChange('hospital_map')}
                  onShowToast={showToast}
                />
              ) : patientNavView === 'appointments' ? (
                <PatientAppointments
                  patients={patients}
                  doctors={doctors}
                  currentUser={currentUser}
                  currentPatient={currentPatient}
                  onViewPass={(patientId) => {
                    setCurrentPatientId(patientId);
                    localStorage.setItem('mediqueue_active_patient_id', patientId);
                    setActiveSidebarTab('patient_pass');
                    handlePatientNavChange('patient_pass');
                  }}
                  onBookAppointment={() => {
                    setActiveSidebarTab('dashboard');
                    handlePatientNavChange('dashboard');
                  }}
                  onRequestTeleconsult={() => handlePatientNavChange('teleconsult')}
                  onShowToast={showToast}
                />
              ) : patientNavView === 'teleconsult' ? (
                <TeleconsultModule
                  doctors={doctors}
                  currentUser={currentUser}
                  onUserLogin={(user) => handleUserLogin(user, 'teleconsult')}
                  onShowToast={showToast}
                  onReturnToOPD={() => handlePatientNavChange('patient_pass')}
                  onBookInPersonInstead={() => handlePatientNavChange('patient_pass')}
                />
              ) : (
                <HospitalLeafletMap
                  onShowToast={showToast}
                  onSelectHospitalForBooking={(hosp) => {
                    showToast('Hospital Selected', `Switched to ${hosp.name}. Proceed with OPD registration.`, 'success');
                    handlePatientNavChange('patient_pass');
                  }}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (md:hidden) */}
      {!isHospitalLoginOpen && userRole === 'patient' && (
        <MobileBottomNav
          currentView={patientNavView}
          onNavigate={(view) => {
            handlePatientNavChange(view);
            if (view === 'dashboard') setActiveSidebarTab('dashboard');
            else if (view === 'patient_pass') setActiveSidebarTab('patient_pass');
            else if (view === 'teleconsult') setActiveSidebarTab('teleconsult');
          }}
          onOpenLabs={() => {
            setShowAppNearbyLabsModal(true);
            playHospitalChime();
          }}
          onOpenProfile={() => setShowPatientProfileModal(true)}
          activeTokenNumber={currentPatient?.tokenNumber}
        />
      )}

      {/* Support Concierge Modal */}
      <SupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
        onShowToast={showToast}
      />

      {/* Application Level Medical File Modal */}
      <MedicalFileModal
        isOpen={showAppMedicalFileModal}
        onClose={() => setShowAppMedicalFileModal(false)}
        currentUser={currentUser}
        initialTab={medicalFileInitialTab}
        onShowToast={showToast}
      />

      {/* Application Level Nearby Labs Modal */}
      {(currentPatient || patients[0]) && (
        <NearbyLabsModal
          isOpen={showAppNearbyLabsModal}
          onClose={() => setShowAppNearbyLabsModal(false)}
          booking={currentPatient || patients[0]}
          onShowToast={showToast}
        />
      )}

      {/* Real-time Toast Notifications */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-50 animate-in slide-in-from-bottom-5 duration-300 max-w-[calc(100vw-2rem)]">
          <div
            className={`p-3.5 sm:p-4 rounded-2xl border shadow-xl flex items-start gap-3 max-w-sm ${
              toastMessage.type === 'urgent'
                ? 'bg-rose-50 border-rose-400 text-rose-900'
                : toastMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                : 'bg-white dark:bg-[#111827] border-[#E5EDF5] dark:border-[#1E293B] text-[#13213A] dark:text-white'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                toastMessage.type === 'urgent'
                  ? 'bg-rose-500 text-white'
                  : toastMessage.type === 'success'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-[#087FC9] text-white'
              }`}
            >
              <i
                className={`fa-solid ${
                  toastMessage.type === 'urgent'
                    ? 'fa-triangle-exclamation'
                    : toastMessage.type === 'success'
                    ? 'fa-check'
                    : 'fa-bell'
                } text-xs`}
              ></i>
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="font-bold text-xs leading-tight">{toastMessage.title}</h5>
              <p className="text-[11px] opacity-90 mt-0.5 leading-snug break-words">
                {toastMessage.description}
              </p>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-[#64748B] hover:text-[#13213A] dark:hover:text-white text-xs cursor-pointer p-1 shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Patient Profile Modal (triggered by Patient Profile header button) */}
      <EditProfileModal
        isOpen={showPatientProfileModal}
        onClose={() => setShowPatientProfileModal(false)}
        currentUser={currentUser}
        onSaveProfile={handleUpdateUserProfile}
        onShowToast={showToast}
      />

      {/* Global Patient OTP & Google Auth Modal */}
      <OTPAuthModal
        isOpen={showGlobalAuthModal}
        onClose={() => setShowGlobalAuthModal(false)}
        onLoginSuccess={handleUserLogin}
        onShowToast={showToast}
      />

      {/* Footer with Role Indicator & Clean Hospital Staff link */}
      <footer className="border-t border-[#E5EDF5] dark:border-[#1E293B] bg-white dark:bg-[#111827] py-3.5 px-4 text-center text-xs text-[#64748B] dark:text-[#94A3B8] transition-colors duration-200">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-heading font-extrabold text-[#13213A] dark:text-white">Medi Queue™</span>
            <span>— Smarter Hospitals. Shorter Queues.</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-[#64748B] dark:text-[#94A3B8] flex-wrap justify-center">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#16B981]"></span>
              {(userRole === 'staff' || userRole === 'admin' || userRole === 'doctor')
                ? (userRole === 'doctor' ? 'Doctor Clinical Session' : 'Hospital Admin Session')
                : 'Patient Portal Mode'}
            </span>
            <span>•</span>
            {userRole === 'patient' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsDoctorLoginOpen(true);
                    updateUrlHash('doctor-login');
                  }}
                  className="text-teal-600 hover:underline font-semibold cursor-pointer flex items-center gap-1"
                >
                  <i className="fa-solid fa-user-doctor text-[10px]"></i>
                  <span>Doctor Login</span>
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminLoginOpen(true);
                    updateUrlHash('admin-login');
                  }}
                  className="text-[#087FC9] hover:underline font-semibold cursor-pointer flex items-center gap-1"
                >
                  <i className="fa-solid fa-shield-halved text-[10px]"></i>
                  <span>Admin Login</span>
                </button>
                <span>•</span>
              </>
            )}
            <span>ICMR Clinical Board Verified</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
