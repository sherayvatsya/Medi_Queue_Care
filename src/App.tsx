import React, { useState, useEffect, useCallback } from 'react';
import { Doctor, Patient, ICMRProtocol, PatientUser, StaffUser, UserRole, StaffSection } from './types';
import { INITIAL_DOCTORS, INITIAL_PATIENTS, INITIAL_PROTOCOLS } from './data/mockData';
import { Header, PatientNavView } from './components/Header';
import { PatientPortal } from './components/PatientPortal';
import { StaffDashboard } from './components/StaffDashboard';
import { TeleconsultModule } from './components/TeleconsultModule';
import { HospitalLeafletMap } from './components/HospitalLeafletMap';
import { HospitalLogin } from './components/HospitalLogin';
import { OTPAuthModal } from './components/OTPAuthModal';
import { EditProfileModal } from './components/EditProfileModal';
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
    return savedRole === 'staff' ? 'staff' : 'patient';
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
      return savedPatient ? JSON.parse(savedPatient) : null;
    } catch {
      return null;
    }
  });

  // 2. Navigation State for Patient & Staff
  const [patientNavView, setPatientNavView] = useState<PatientNavView>(() => {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (hash === 'teleconsult') return 'teleconsult';
    if (hash === 'hospital-map' || hash === 'map' || hash === 'hospitals') return 'hospital_map';
    return 'patient_pass';
  });

  const [activeStaffSection, setActiveStaffSection] = useState<StaffSection>(() => {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (hash === 'queue' || hash === 'queue-management') return 'queue_management';
    if (hash === 'doctors' || hash === 'doctor-availability') return 'doctor_availability';
    if (hash === 'patients' || hash === 'patient-management') return 'patient_management';
    if (hash === 'reports' || hash === 'analytics') return 'reports';
    if (hash === 'hospital-profile' || hash === 'profile') return 'hospital_profile';
    return 'staff_dashboard';
  });

  const [isHospitalLoginOpen, setIsHospitalLoginOpen] = useState<boolean>(() => {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    return hash === 'hospital-login';
  });

  // Modals & UI Controls
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
        return localStorage.getItem('mediqueue_active_patient_id') || '';
      }
      return '';
    } catch {
      return '';
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
      patient_pass: 'patient-pass',
      teleconsult: 'teleconsult',
      hospital_map: 'hospital-map',
    };
    updateUrlHash(hashMap[nav] || 'patient-pass');
  };

  // Staff Section Change (Strictly for staff)
  const handleStaffSectionChange = (section: StaffSection) => {
    if (userRole !== 'staff' || !staffUser) {
      showToast(
        'Staff Authentication Required',
        'You must sign in with authorized hospital employee credentials to view staff sections.',
        'urgent'
      );
      setIsHospitalLoginOpen(true);
      updateUrlHash('hospital-login');
      return;
    }
    setActiveStaffSection(section);
    const hashMap: Record<StaffSection, string> = {
      staff_dashboard: 'staff-dashboard',
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

      if (hash === 'hospital-login') {
        setIsHospitalLoginOpen(true);
        return;
      }

      if (hash === 'teleconsult') {
        setIsHospitalLoginOpen(false);
        setPatientNavView('teleconsult');
        return;
      }

      if (hash === 'hospital-map' || hash === 'map' || hash === 'hospitals') {
        setIsHospitalLoginOpen(false);
        setPatientNavView('hospital_map');
        return;
      }

      if (hash === 'patient-pass' || hash === 'patient') {
        setIsHospitalLoginOpen(false);
        setPatientNavView('patient_pass');
        return;
      }

      // Hospital routes
      const hospitalRoutes = [
        'staff',
        'staff-dashboard',
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
        const savedStaff = localStorage.getItem('mediqueue_staff_user');

        if (savedRole === 'staff' && savedStaff) {
          setIsHospitalLoginOpen(false);
          if (hash === 'queue' || hash === 'queue-management') setActiveStaffSection('queue_management');
          else if (hash === 'doctors' || hash === 'doctor-availability') setActiveStaffSection('doctor_availability');
          else if (hash === 'patients' || hash === 'patient-management') setActiveStaffSection('patient_management');
          else if (hash === 'reports' || hash === 'analytics') setActiveStaffSection('reports');
          else if (hash === 'hospital-profile') setActiveStaffSection('hospital_profile');
          else setActiveStaffSection('staff_dashboard');
        } else {
          showToast(
            'Hospital Access Guard',
            'Restricted clinical management route. Please sign in with Hospital Staff credentials.',
            'urgent'
          );
          setIsHospitalLoginOpen(true);
          window.history.replaceState(null, '', '#hospital-login');
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
  const handleUserLogin = (user: PatientUser, redirectNavView?: 'patient_pass' | 'teleconsult') => {
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
    const targetNav = redirectNavView || patientNavView || 'patient_pass';
    setPatientNavView(targetNav);
    updateUrlHash(targetNav === 'teleconsult' ? 'teleconsult' : 'patient-pass');
  };

  // Handle Hospital Staff Login
  const handleStaffLoginSuccess = (staff: StaffUser) => {
    setStaffUser(staff);
    setUserRole('staff');
    localStorage.setItem('mediqueue_role', 'staff');
    localStorage.setItem('mediqueue_staff_user', JSON.stringify(staff));

    setIsHospitalLoginOpen(false);
    setActiveStaffSection('staff_dashboard');
    updateUrlHash('staff-dashboard');
  };

  // Handle Logout (Strictly Clears Role, Patient Session, Active Hospital & Storage)
  const handleLogout = async () => {
    if (userRole === 'staff') {
      setStaffUser(null);
      setUserRole('patient');
      localStorage.removeItem('mediqueue_role');
      localStorage.removeItem('mediqueue_staff_user');
      showToast('Staff Session Ended', 'Hospital management logged out securely.', 'info');
      setIsHospitalLoginOpen(false);
      setPatientNavView('patient_pass');
      updateUrlHash('patient-pass');
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
      setPatientNavView('patient_pass');
      updateUrlHash('patient-pass');
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 flex flex-col selection:bg-sky-500 selection:text-white box-border overflow-x-hidden">
      {/* Top Header - Strictly Role-Based Navigation
          Patient Mode: Patient Pass | Tele-Consult | Profile | Logout
          Staff Mode: Staff Dashboard | Queue Management | Doctor Availability | Patient Management | Reports | Hospital Profile | Logout
      */}
      <Header
        currentRole={userRole}
        patientNavView={patientNavView}
        onPatientNavChange={handlePatientNavChange}
        activeHospitalName={activeHospitalName}
        activeStaffSection={activeStaffSection}
        onStaffSectionChange={handleStaffSectionChange}
        currentUser={currentUser}
        staffUser={staffUser}
        unreadAlertsCount={unreadAlerts}
        onOpenPatientProfile={() => setShowPatientProfileModal(true)}
        onOpenPatientAuth={() => setShowGlobalAuthModal(true)}
        onOpenHospitalLogin={() => {
          setIsHospitalLoginOpen(true);
          updateUrlHash('hospital-login');
        }}
        onSignOut={handleLogout}
      />

      {/* Main App Body */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-2.5 sm:p-6 box-border">
        {/* VIEW 1: HOSPITAL LOGIN (Displayed when hospital login is requested) */}
        {isHospitalLoginOpen ? (
          <div className="animate-in fade-in duration-200">
            <HospitalLogin
              onLoginSuccess={handleStaffLoginSuccess}
              onCancel={() => {
                setIsHospitalLoginOpen(false);
                updateUrlHash('patient-pass');
              }}
              onShowToast={showToast}
            />
          </div>
        ) : userRole === 'staff' && staffUser ? (
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
            {patientNavView === 'patient_pass' ? (
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

      {/* Real-time Toast Notifications */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-50 animate-in slide-in-from-bottom-5 duration-300 max-w-[calc(100vw-2rem)]">
          <div
            className={`p-3.5 sm:p-4 rounded-2xl border shadow-xl flex items-start gap-3 max-w-sm ${
              toastMessage.type === 'urgent'
                ? 'bg-rose-50 border-rose-400 text-rose-900'
                : toastMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                toastMessage.type === 'urgent'
                  ? 'bg-rose-500 text-white'
                  : toastMessage.type === 'success'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-sky-500 text-white'
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
              className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer p-1 shrink-0"
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
      <footer className="border-t border-slate-200/80 bg-white py-3.5 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">Medi-Queue™</span>
            <span>— Smart Hospital Queue & Real-time Platform</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap justify-center">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {userRole === 'staff' ? 'Staff Session Active' : 'Patient Portal Mode'}
            </span>
            <span>•</span>
            {userRole !== 'staff' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsHospitalLoginOpen(true);
                    updateUrlHash('hospital-login');
                  }}
                  className="text-sky-600 hover:text-sky-700 hover:underline font-semibold cursor-pointer flex items-center gap-1"
                >
                  <i className="fa-solid fa-user-shield text-[10px]"></i>
                  <span>Hospital Staff Access</span>
                </button>
                <span>•</span>
              </>
            )}
            <span>ICMR Clinical Board</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
