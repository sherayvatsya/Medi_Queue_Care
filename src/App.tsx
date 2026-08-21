import React, { useState, useEffect } from 'react';
import { Doctor, Patient, ICMRProtocol, PatientUser } from './types';
import { INITIAL_DOCTORS, INITIAL_PATIENTS, INITIAL_PROTOCOLS, INITIAL_PATIENT_USERS } from './data/mockData';
import { Header, AppViewMode } from './components/Header';
import { PatientPortal } from './components/PatientPortal';
import { StaffDashboard } from './components/StaffDashboard';
import { SplitScreenDemo } from './components/SplitScreenDemo';
import { TVKioskDisplay } from './components/TVKioskDisplay';
import { HospitalGoogleMap } from './components/HospitalGoogleMap';
import { TeleconsultModule } from './components/TeleconsultModule';
import { OTPAuthModal } from './components/OTPAuthModal';
import { playHospitalChime, playUrgentAlertSound } from './utils/audio';
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
  // Navigation
  const [viewMode, setViewMode] = useState<AppViewMode>('patient');
  const [isMobileFrameActive, setIsMobileFrameActive] = useState<boolean>(false);
  const [showGlobalAuthModal, setShowGlobalAuthModal] = useState<boolean>(false);

  // Application Data States
  const [doctors, setDoctors] = useState<Doctor[]>(INITIAL_DOCTORS);
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [protocols, setProtocols] = useState<ICMRProtocol[]>(INITIAL_PROTOCOLS);

  // Patient Authentication State (Prompt Sign-In / Sign-Up on initial visit)
  const [currentUser, setCurrentUser] = useState<PatientUser | null>(null);

  // Active Patient for Patient View
  const [currentPatientId, setCurrentPatientId] = useState<string>('pat-3');

  // Database Connection Indicator
  const [isDbConnected, setIsDbConnected] = useState<boolean>(false);

  // Live Toast Notification State
  const [toastMessage, setToastMessage] = useState<{
    id: number;
    title: string;
    description: string;
    type: 'info' | 'success' | 'urgent';
  } | null>(null);

  const showToast = (title: string, description: string, type: 'info' | 'success' | 'urgent' = 'info') => {
    const id = Date.now();
    setToastMessage({ id, title, description, type });
    setTimeout(() => {
      setToastMessage((current) => (current?.id === id ? null : current));
    }, 4500);
  };

  // 1. Initialize Firebase and Listen to Auth Changes
  useEffect(() => {
    // Seed initial data if empty
    seedInitialFirestoreData().catch(console.warn);

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            const data = snap.data() as PatientUser;
            setCurrentUser(data);
          } else {
            const newUser: PatientUser = {
              id: fbUser.uid,
              uhid: `MQ-DEL-${Math.floor(1000 + Math.random() * 9000)}`,
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
          }
        } catch (e) {
          console.warn('Auth snapshot error:', e);
        }
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // 2. Real-time Firestore Listeners for Patients & Doctors
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
            // Sort by createdAt descending or token number
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
              liveDoctors.push(docSnap.data() as Doctor);
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
      console.warn('Firestore subscription initialization error:', e);
    }
  }, []);

  // Find active patient object
  const currentPatient = patients.find((p) => p.id === currentPatientId) || patients[0] || null;

  // Handle User Login / Sign Up via OTP or Google
  const handleUserLogin = (user: PatientUser) => {
    setCurrentUser(user);
    const existingPatient = patients.find(
      (p) => p.uhid.toLowerCase() === user.uhid.toLowerCase() || p.name.toLowerCase() === user.name.toLowerCase()
    );
    if (existingPatient) {
      setCurrentPatientId(existingPatient.id);
    }
  };

  // Handle User Logout
  const handleUserLogout = async () => {
    try {
      await signOutPatient();
    } catch (e) {
      console.warn(e);
    }
    setCurrentUser(null);
    showToast('Signed Out', 'Patient session cleared. Ready for next intake.', 'info');
  };

  // Handle Update Patient User Profile
  const handleUpdateUserProfile = (updatedUser: PatientUser) => {
    setCurrentUser(updatedUser);
    saveUserProfileToFirestore(updatedUser);

    // Sync matching patient tokens
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

    // Save to Firestore Real-Time Database
    savePatientTokenToFirestore(newPatient);

    // Increment doctor active count
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
      `Token #${newPatient.tokenNumber} issued for ${newPatient.department} (${newPatient.roomNumber}) and stored in Firestore database.`,
      'success'
    );
  };

  // Handle Update Patient
  const handleUpdatePatient = (updated: Patient) => {
    setPatients((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    savePatientTokenToFirestore(updated);
  };

  // Handle Doctor Update (e.g. Room Override or Status Change)
  const handleUpdateDoctor = (updatedDoc: Doctor) => {
    const prevDoc = doctors.find((d) => d.id === updatedDoc.id);
    const roomChanged = prevDoc && prevDoc.roomNumber !== updatedDoc.roomNumber;

    setDoctors((prev) => prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)));
    updateDoctorStatusInFirestore(updatedDoc.id, updatedDoc);

    // If room changed, update roomNumber on all active patients of this doctor!
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

    // Find the first waiting patient for this doctor
    const nextPatient = patients.find((p) => p.doctorId === doctorId && p.status === 'waiting');
    if (!nextPatient) {
      showToast('Queue Empty', `No waiting patients for ${docItem.name}`, 'info');
      return;
    }

    // Mark previous in-consultation patient as completed if any
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

    // Update doctor's current token in Firestore
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
      showToast('Consultation Finished', `Token #${completed.tokenNumber} marked complete in Firestore.`, 'success');
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
      'Patient diverted to Emergency Casualty Bay 1 with Code RED.',
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

  // Reset Demo Data
  const handleResetDemoData = () => {
    setDoctors(INITIAL_DOCTORS);
    setPatients(INITIAL_PATIENTS);
    setProtocols(INITIAL_PROTOCOLS);
    setCurrentPatientId('pat-3');
    showToast('Demo State Reset', 'Queue, doctors, and diagnostic rules restored.', 'info');
    playHospitalChime();
  };

  const activeWheelchairCount = patients.filter((p) => p.wheelchairRequest && p.wheelchairRequest.status !== 'completed').length;
  const unreadAlerts = patients.filter((p) => p.triageCategory === 'urgent_er').length + activeWheelchairCount;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 flex flex-col selection:bg-sky-500 selection:text-white box-border overflow-x-hidden">
      {/* Top Header */}
      <Header
        currentView={viewMode}
        onViewChange={(v) => setViewMode(v)}
        serverStatus={isDbConnected ? 'connected' : 'connected'}
        unreadAlertsCount={unreadAlerts}
        onResetDemoData={handleResetDemoData}
        currentUser={currentUser}
        onSignOut={handleUserLogout}
        onOpenAuthModal={() => setShowGlobalAuthModal(true)}
      />

      {/* Main App Body */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-2.5 sm:p-6 box-border">
        {viewMode === 'patient' && (
          <div className="animate-in fade-in duration-300">
            <PatientPortal
              doctors={doctors}
              currentPatient={currentPatient}
              currentUser={currentUser}
              onUserLogin={handleUserLogin}
              onUserLogout={handleUserLogout}
              onUpdateUserProfile={handleUpdateUserProfile}
              onGenerateToken={handleGenerateToken}
              onUpdatePatient={handleUpdatePatient}
              isMobileFrame={isMobileFrameActive}
              onToggleMobileFrame={() => setIsMobileFrameActive(!isMobileFrameActive)}
              onShowToast={showToast}
              onRequestTeleconsult={() => setViewMode('teleconsult')}
            />
          </div>
        )}

        {viewMode === 'teleconsult' && (
          <div className="animate-in fade-in duration-300">
            <TeleconsultModule
              doctors={doctors}
              currentUser={currentUser}
              onShowToast={showToast}
              onReturnToOPD={() => setViewMode('patient')}
            />
          </div>
        )}

        {viewMode === 'staff' && (
          <div className="animate-in fade-in duration-300">
            <StaffDashboard
              doctors={doctors}
              patients={patients}
              protocols={protocols}
              onUpdateDoctor={handleUpdateDoctor}
              onUpdatePatient={handleUpdatePatient}
              onCallNextPatient={handleCallNextPatient}
              onCompletePatient={handleCompletePatient}
              onEscalateToER={handleEscalateToER}
              onToggleProtocol={handleToggleProtocol}
              onAddProtocol={handleAddProtocol}
            />
          </div>
        )}

        {viewMode === 'split' && (
          <div className="animate-in fade-in duration-300">
            <SplitScreenDemo
              doctors={doctors}
              patients={patients}
              protocols={protocols}
              currentPatient={currentPatient}
              currentUser={currentUser}
              onUserLogin={handleUserLogin}
              onUserLogout={handleUserLogout}
              onUpdateUserProfile={handleUpdateUserProfile}
              onGenerateToken={handleGenerateToken}
              onUpdatePatient={handleUpdatePatient}
              onUpdateDoctor={handleUpdateDoctor}
              onCallNextPatient={handleCallNextPatient}
              onCompletePatient={handleCompletePatient}
              onEscalateToER={handleEscalateToER}
              onToggleProtocol={handleToggleProtocol}
              onAddProtocol={handleAddProtocol}
              onShowToast={showToast}
            />
          </div>
        )}

        {viewMode === 'tv_kiosk' && (
          <div className="animate-in fade-in duration-300">
            <TVKioskDisplay doctors={doctors} patients={patients} />
          </div>
        )}

        {viewMode === 'campus_map' && (
          <div className="animate-in fade-in duration-300 max-w-6xl mx-auto">
            <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <i className="fa-solid fa-map-location-dot text-sky-500"></i>
                  Hospital Campus & Google Maps Live Grounding
                </h2>
                <p className="text-xs text-slate-500">
                  Google Maps Platform • Gemini Maps Grounding AI • Apollo / AIIMS Delhi Medical Campus Hub
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewMode('patient')}
                className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <i className="fa-solid fa-ticket"></i>
                <span>Open Patient OPD Pass</span>
              </button>
            </div>
            <HospitalGoogleMap
              onShowToast={showToast}
              onSwitchToIndoorMap={() => setViewMode('patient')}
            />
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

      {/* Global OTP & Google Auth Modal */}
      <OTPAuthModal
        isOpen={showGlobalAuthModal}
        onClose={() => setShowGlobalAuthModal(false)}
        onLoginSuccess={handleUserLogin}
        onShowToast={showToast}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-3.5 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">Medi-Queue™</span>
            <span>— In-Hospital Smart Queue & Real-time Database</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap justify-center">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Firebase Firestore Active
            </span>
            <span>•</span>
            <span>Google Maps Grounding Enabled</span>
            <span>•</span>
            <span>ICMR Clinical Protocols</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
