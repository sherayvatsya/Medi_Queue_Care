import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
} from 'firebase/firestore';
import config from '../firebase-applet-config.json';
import { Patient, Doctor, WheelchairRequest, PatientUser } from './types';
import { INITIAL_DOCTORS, INITIAL_PATIENTS } from './data/mockData';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(config);

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firestore with specific database ID if provided
export const db = config.firestoreDatabaseId
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);

// Helper to recursively strip undefined values so Firestore does not throw 'Unsupported field value: undefined'
export function sanitizeFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeFirestoreData(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        sanitized[key] = sanitizeFirestoreData(value);
      }
    }
    return sanitized as T;
  }
  return obj;
}

// Google Sign In
export async function signInWithGoogle(): Promise<PatientUser | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const fbUser = result.user;
    if (!fbUser) return null;

    // Check or create patient profile in Firestore
    const userDocRef = doc(db, 'users', fbUser.uid);
    const userSnap = await getDoc(userDocRef);

    let patientProfile: PatientUser;
    if (userSnap.exists()) {
      patientProfile = userSnap.data() as PatientUser;
    } else {
      // Generate clean UHID for new patient e.g. "MQ-2026-DEL-XXXX"
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const generatedUhid = `MQ-DEL-${randomSuffix}`;
      
      patientProfile = {
        id: fbUser.uid,
        uhid: generatedUhid,
        name: fbUser.displayName || 'Registered Patient',
        email: fbUser.email || '',
        phone: fbUser.phoneNumber || '+91 98101 23456',
        age: 32,
        gender: 'Male',
        bloodGroup: 'B+',
        emergencyContactName: 'Next of Kin',
        emergencyContactPhone: '+91 98111 99999',
        allergies: ['Penicillin'],
        chronicConditions: ['Mild Hypertension'],
        registeredAt: new Date().toISOString(),
        avatarUrl: fbUser.photoURL || undefined,
        hasHealthPass: true,
      };

      await setDoc(userDocRef, sanitizeFirestoreData(patientProfile));
    }

    return patientProfile;
  } catch (error) {
    console.error('Firebase Google Sign-In error:', error);
    throw error;
  }
}

// Sign Out
export async function signOutPatient(): Promise<void> {
  await fbSignOut(auth);
}

// Seed initial hospital doctors and queue tokens into Firestore if collection is empty
export async function seedInitialFirestoreData(): Promise<void> {
  try {
    const doctorsSnap = await getDocs(collection(db, 'doctors'));
    if (doctorsSnap.empty) {
      console.log('Seeding initial doctors into Firestore...');
      const batch = writeBatch(db);
      INITIAL_DOCTORS.forEach((docData) => {
        const docRef = doc(db, 'doctors', docData.id);
        batch.set(docRef, sanitizeFirestoreData(docData));
      });
      await batch.commit();
    } else {
      // Check if any existing doctor documents have the old broken avatar URL
      doctorsSnap.forEach(async (docSnap) => {
        const data = docSnap.data() as Doctor;
        if (data.avatar && data.avatar.includes('1594824813589')) {
          const correctDoc = INITIAL_DOCTORS.find((d) => d.id === data.id);
          if (correctDoc) {
            await updateDoc(docSnap.ref, { avatar: correctDoc.avatar });
          }
        }
      });
    }

    const patientsSnap = await getDocs(collection(db, 'patients'));
    if (patientsSnap.empty) {
      console.log('Seeding initial queue tokens into Firestore...');
      const batch = writeBatch(db);
      INITIAL_PATIENTS.forEach((patData) => {
        const patRef = doc(db, 'patients', patData.id);
        batch.set(patRef, sanitizeFirestoreData(patData));
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn('Could not seed initial Firestore data (might be offline or permissions):', err);
  }
}

// Save or Update Patient Token in Firestore
export async function savePatientTokenToFirestore(patient: Patient): Promise<void> {
  try {
    const docRef = doc(db, 'patients', patient.id);
    await setDoc(docRef, sanitizeFirestoreData(patient), { merge: true });
  } catch (error) {
    console.error('Error saving patient to Firestore:', error);
  }
}

// Update Doctor Status in Firestore
export async function updateDoctorStatusInFirestore(doctorId: string, updates: Partial<Doctor>): Promise<void> {
  try {
    const docRef = doc(db, 'doctors', doctorId);
    await updateDoc(docRef, sanitizeFirestoreData(updates));
  } catch (error) {
    console.error('Error updating doctor status in Firestore:', error);
  }
}

// Save Wheelchair Request
export async function saveWheelchairRequestToFirestore(request: WheelchairRequest): Promise<void> {
  try {
    const docRef = doc(db, 'wheelchairs', request.id);
    await setDoc(docRef, sanitizeFirestoreData(request), { merge: true });
  } catch (error) {
    console.error('Error saving wheelchair request to Firestore:', error);
  }
}

// Update Wheelchair Request Status
export async function updateWheelchairStatusInFirestore(requestId: string, status: WheelchairRequest['status'], porterName?: string): Promise<void> {
  try {
    const docRef = doc(db, 'wheelchairs', requestId);
    const updates: any = { status };
    if (porterName) updates.porterName = porterName;
    await updateDoc(docRef, sanitizeFirestoreData(updates));
  } catch (error) {
    console.error('Error updating wheelchair status in Firestore:', error);
  }
}

// Save or Update Patient User Profile in Firestore
export async function saveUserProfileToFirestore(user: PatientUser): Promise<void> {
  try {
    const docRef = doc(db, 'users', user.id);
    await setDoc(docRef, sanitizeFirestoreData(user), { merge: true });
  } catch (error) {
    console.error('Error saving user profile to Firestore:', error);
  }
}

// Save Reschedule Audit record in Firestore
export async function saveRescheduleAuditToFirestore(audit: any): Promise<void> {
  try {
    const docRef = doc(db, 'reschedule_audits', audit.id);
    await setDoc(docRef, sanitizeFirestoreData(audit), { merge: true });
  } catch (error) {
    console.error('Error saving reschedule audit to Firestore:', error);
  }
}

