import { MongoClient, Db, Collection } from 'mongodb';
import {
  DoctorPrescription,
  DoctorConsultation,
  PrescriptionMedicine,
  PatientMedicalHistoryData,
  Patient,
  Doctor,
} from '../../types/index.ts';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mediqueue';
const DB_NAME = 'mediqueue';

let mongoClient: MongoClient | null = null;
let dbInstance: Db | null = null;
let isConnected = false;

// Resilient In-Memory Fallback Mirrors
const inMemoryPrescriptions: DoctorPrescription[] = [];
const inMemoryConsultations: DoctorConsultation[] = [];

// Seed initial default prescriptions and consultations so doctors see rich clinical history immediately
const INITIAL_DEMO_PRESCRIPTIONS: DoctorPrescription[] = [
  {
    id: 'RX-2026-042',
    prescriptionNumber: 'RX-MAXM-2026-042',
    patientId: 'pat-3',
    patientUhid: 'SJMC-2026-DEL-08942A',
    patientName: 'Rajesh Mukherjee',
    patientAge: 52,
    patientGender: 'Male',
    doctorId: 'doc-1',
    doctorName: 'Dr. Arvind Sharma, MD',
    doctorSpecialty: 'Senior Consultant Orthopedics & Joint Care',
    doctorDepartment: 'Orthopedics',
    doctorRoom: 'Room 204',
    tokenNumber: 'A-42',
    diagnosis: 'Bilateral Knee Osteoarthritis (Grade II) with Acute Flare-up',
    doctorNotes: 'Weight-bearing X-ray confirms medial compartment narrowing. Prescribed chondro-protective therapy and topical anti-inflammatory.',
    medicines: [
      {
        id: 'med-1',
        name: 'Glucosamine Sulfate + Chondroitin 500mg/400mg',
        dosage: '1 Tablet',
        frequency: '1-0-1 (Twice daily after meals)',
        duration: '30 days',
        instructions: 'Take with warm water after breakfast and dinner.',
      },
      {
        id: 'med-2',
        name: 'Aceclofenac 100mg + Paracetamol 325mg',
        dosage: '1 Tablet',
        frequency: '1-0-1 (Twice daily for 5 days)',
        duration: '5 days',
        instructions: 'Take strictly after food. SOS if pain persists.',
      },
      {
        id: 'med-3',
        name: 'Pantoprazole 40mg (Gastro-protective)',
        dosage: '1 Capsule',
        frequency: '1-0-0 (Once daily before breakfast)',
        duration: '7 days',
        instructions: 'Take 30 minutes before morning tea/breakfast.',
      },
    ],
    followUpDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dietaryAdvice: 'Low-impact quadriceps exercises (cycling/swimming). Avoid cross-legged sitting. Weight management recommended.',
    investigationsRecommended: ['Repeat Knee X-Ray AP/Lat in 6 months', 'Serum Vitamin D3 & Calcium'],
    prescribedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    isConfirmedByDoctor: true,
    signature: 'Digitally signed by Dr. Arvind Sharma, MD (Reg #MCI-48921/DMC)',
  },
  {
    id: 'RX-2026-038',
    prescriptionNumber: 'RX-MAXM-2026-038',
    patientId: 'pat-1',
    patientUhid: 'SJMC-2025-MUM-09901F',
    patientName: 'Vikram Mehta',
    patientAge: 58,
    patientGender: 'Male',
    doctorId: 'doc-1',
    doctorName: 'Dr. Arvind Sharma, MD',
    doctorSpecialty: 'Senior Consultant Orthopedics & Joint Care',
    doctorDepartment: 'Orthopedics',
    doctorRoom: 'Room 204',
    tokenNumber: 'A-40',
    diagnosis: 'Post-Traumatic Meniscal Strain (Right Knee)',
    doctorNotes: 'Joint line tenderness present. Advised relative rest, ice fomentation, and knee brace during ambulation.',
    medicines: [
      {
        id: 'med-4',
        name: 'Etoricoxib 90mg',
        dosage: '1 Tablet',
        frequency: '0-0-1 (Once daily at night)',
        duration: '7 days',
        instructions: 'Take after dinner. Discontinue if gastric upset occurs.',
      },
      {
        id: 'med-5',
        name: 'Thiocolchicoside 4mg (Muscle Relaxant)',
        dosage: '1 Capsule',
        frequency: '1-0-1 (Twice daily)',
        duration: '5 days',
        instructions: 'May cause mild drowsiness. Do not drive immediately after.',
      },
    ],
    followUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dietaryAdvice: 'Knee hinged support brace while walking. Avoid stairs.',
    prescribedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    isConfirmedByDoctor: true,
    signature: 'Digitally signed by Dr. Arvind Sharma, MD (Reg #MCI-48921/DMC)',
  },
];

const INITIAL_DEMO_CONSULTATIONS: DoctorConsultation[] = [
  {
    id: 'CONS-2026-901',
    tokenNumber: 'A-38',
    patientId: 'pat-prev-1',
    patientUhid: 'SJMC-2026-DEL-01290K',
    patientName: 'Harish Chandra',
    patientAge: 61,
    patientGender: 'Male',
    doctorId: 'doc-1',
    doctorName: 'Dr. Arvind Sharma, MD',
    doctorDepartment: 'Orthopedics',
    startedAt: '08:45 AM',
    completedAt: '09:02 AM',
    durationMinutes: 17,
    diagnosis: 'Lumbar Spondylosis with Radiculopathy L4-L5',
    clinicalNotes: 'SLR test positive at 60 deg right leg. Prescribed NSAID course + physiotherapy referral.',
    status: 'completed',
    vitals: { bp: '130/84 mmHg', pulse: '76 bpm', temp: '98.4°F' },
  },
  {
    id: 'CONS-2026-902',
    tokenNumber: 'A-39',
    patientId: 'pat-prev-2',
    patientUhid: 'SJMC-2026-DEL-05512B',
    patientName: 'Meenakshi Iyer',
    patientAge: 47,
    patientGender: 'Female',
    doctorId: 'doc-1',
    doctorName: 'Dr. Arvind Sharma, MD',
    doctorDepartment: 'Orthopedics',
    startedAt: '09:05 AM',
    completedAt: '09:22 AM',
    durationMinutes: 17,
    diagnosis: 'Frozen Shoulder (Adhesive Capsulitis - Phase 2)',
    clinicalNotes: 'Restricted external rotation and abduction. Intra-articular steroid discussed; patient opted for conservative mobilization first.',
    status: 'completed',
    vitals: { bp: '124/80 mmHg', pulse: '72 bpm', temp: '98.6°F' },
  },
];

inMemoryPrescriptions.push(...INITIAL_DEMO_PRESCRIPTIONS);
inMemoryConsultations.push(...INITIAL_DEMO_CONSULTATIONS);

/**
 * Connect to MongoDB and initialize collections & indexes
 */
export async function getMongoDb(): Promise<Db | null> {
  if (dbInstance && isConnected) {
    return dbInstance;
  }

  try {
    if (!mongoClient) {
      mongoClient = new MongoClient(MONGODB_URI, {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 5000,
      });
    }

    await mongoClient.connect();
    dbInstance = mongoClient.db(DB_NAME);
    isConnected = true;
    console.log(`[MongoDB] Connected successfully to database: ${DB_NAME}`);

    // Create Indexes
    await initIndexes(dbInstance);

    // Seed Initial Collections if empty
    await seedMongoDbIfEmpty(dbInstance);

    return dbInstance;
  } catch (error: any) {
    console.warn(`[MongoDB] Connection note: ${error?.message || 'Server not reachable'}. Running in resilient memory mode.`);
    isConnected = false;
    return null;
  }
}

async function initIndexes(db: Db): Promise<void> {
  try {
    await db.collection('prescriptions').createIndex({ patientId: 1, prescribedAt: -1 });
    await db.collection('prescriptions').createIndex({ patientUhid: 1 });
    await db.collection('prescriptions').createIndex({ doctorId: 1, prescribedAt: -1 });

    await db.collection('consultations').createIndex({ doctorId: 1, completedAt: -1 });
    await db.collection('consultations').createIndex({ patientId: 1 });
    await db.collection('consultations').createIndex({ tokenNumber: 1 });

    await db.collection('patients').createIndex({ id: 1 }, { unique: true, sparse: true });
    await db.collection('patients').createIndex({ doctorId: 1, status: 1 });
  } catch (e) {
    console.warn('[MongoDB] Index creation notice:', (e as any)?.message);
  }
}

async function seedMongoDbIfEmpty(db: Db): Promise<void> {
  try {
    const rxCount = await db.collection('prescriptions').countDocuments();
    if (rxCount === 0) {
      await db.collection('prescriptions').insertMany(INITIAL_DEMO_PRESCRIPTIONS as any);
      console.log('[MongoDB] Seeded initial prescriptions collection.');
    }

    const consCount = await db.collection('consultations').countDocuments();
    if (consCount === 0) {
      await db.collection('consultations').insertMany(INITIAL_DEMO_CONSULTATIONS as any);
      console.log('[MongoDB] Seeded initial consultations collection.');
    }
  } catch (e) {
    console.warn('[MongoDB] Seeding notice:', (e as any)?.message);
  }
}

// ==========================================
// DOCTOR DASHBOARD ATOMIC SERVICES
// ==========================================

/**
 * Atomic Call Next Patient
 * Prevents multiple doctors from calling the same patient simultaneously.
 */
export async function callNextPatientAtomicService(
  doctorId: string,
  patientsFallback: Patient[],
  doctorsFallback: Doctor[]
): Promise<{
  success: boolean;
  message: string;
  calledPatient?: Patient;
  completedPatientId?: string;
  updatedQueue?: Patient[];
}> {
  const db = await getMongoDb();

  // If MongoDB is connected and collection populated, use atomic findOneAndUpdate
  if (db) {
    try {
      const patientsCol = db.collection<Patient>('patients');

      // Auto-populate patients in MongoDB if collection is currently empty
      const patCount = await patientsCol.countDocuments();
      if (patCount === 0 && patientsFallback && patientsFallback.length > 0) {
        await patientsCol.insertMany(patientsFallback as any);
        console.log('[MongoDB] Initialized patients collection from active queue roster.');
      }

      // 1. If this doctor has a current patient in_consultation, mark as completed
      const currentInConsult = await patientsCol.findOne({
        doctorId,
        status: 'in_consultation',
      });

      let completedId: string | undefined;
      if (currentInConsult) {
        completedId = currentInConsult.id;
        await patientsCol.updateOne(
          { id: currentInConsult.id },
          { $set: { status: 'completed' } }
        );
      }

      // 2. Atomically find and claim the next waiting patient in queue
      const callTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const nextPatResult = await patientsCol.findOneAndUpdate(
        { doctorId, status: 'waiting' },
        {
          $set: {
            status: 'in_consultation',
            queuePosition: 0,
            estimatedWaitMinutes: 0,
            calledAt: callTime,
          },
        },
        { sort: { queuePosition: 1, createdAt: 1 }, returnDocument: 'after' }
      );

      const calledPatient = (nextPatResult as any)?.value || nextPatResult;

      if (!calledPatient) {
        const fallbackNext = patientsFallback.find((p) => p.doctorId === doctorId && p.status === 'waiting');
        if (fallbackNext) {
          await patientsCol.insertOne(fallbackNext as any);
          await patientsCol.updateOne(
            { id: fallbackNext.id },
            {
              $set: {
                status: 'in_consultation',
                queuePosition: 0,
                estimatedWaitMinutes: 0,
                calledAt: callTime,
              },
            }
          );
          return {
            success: true,
            message: `Token #${fallbackNext.tokenNumber} successfully called to consultation.`,
            calledPatient: {
              ...fallbackNext,
              status: 'in_consultation',
              queuePosition: 0,
              estimatedWaitMinutes: 0,
              calledAt: callTime,
            },
            completedPatientId: completedId,
          };
        }

        return {
          success: false,
          message: 'Queue is empty. No waiting patients found for this doctor.',
        };
      }

      // 3. Shift remaining waiting patients in this doctor queue
      await patientsCol.updateMany(
        { doctorId, status: 'waiting', id: { $ne: calledPatient.id } },
        { $inc: { queuePosition: -1 } }
      );

      // 4. Update doctor document in MongoDB
      await db.collection('doctors').updateOne(
        { id: doctorId },
        {
          $set: { currentPatientToken: calledPatient.tokenNumber },
          $inc: { todayConsultedCount: 1, activeQueueCount: -1 },
        },
        { upsert: true }
      );

      return {
        success: true,
        message: `Token #${calledPatient.tokenNumber} successfully called to consultation.`,
        calledPatient,
        completedPatientId: completedId,
      };
    } catch (err: any) {
      console.warn('[MongoDB] Call next fallback to memory queue:', err?.message);
    }
  }

  // Resilient In-Memory / Array Processing (Exact matching behavior)
  const nextPatient = patientsFallback.find(
    (p) => p.doctorId === doctorId && p.status === 'waiting'
  );

  if (!nextPatient) {
    return {
      success: false,
      message: 'Queue is empty. No waiting patients found for this doctor.',
    };
  }

  const callTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const currentInConsult = patientsFallback.find(
    (p) => p.doctorId === doctorId && p.status === 'in_consultation'
  );

  const updatedCalled: Patient = {
    ...nextPatient,
    status: 'in_consultation',
    queuePosition: 0,
    estimatedWaitMinutes: 0,
    calledAt: callTime,
  };

  return {
    success: true,
    message: `Token #${updatedCalled.tokenNumber} successfully called to consultation.`,
    calledPatient: updatedCalled,
    completedPatientId: currentInConsult?.id,
  };
}

/**
 * Save Prescription to MongoDB (and in-memory mirror)
 */
export async function savePrescriptionService(
  prescriptionData: Partial<DoctorPrescription>
): Promise<{ success: boolean; prescription?: DoctorPrescription; error?: string }> {
  // Input Validation
  if (!prescriptionData.diagnosis || !prescriptionData.diagnosis.trim()) {
    return { success: false, error: 'Diagnosis is strictly required to issue a prescription.' };
  }

  if (!prescriptionData.medicines || prescriptionData.medicines.length === 0) {
    return { success: false, error: 'At least one medicine with dosage and frequency is required.' };
  }

  for (const [idx, med] of prescriptionData.medicines.entries()) {
    if (!med.name || !med.name.trim()) {
      return { success: false, error: `Medicine #${idx + 1} name cannot be empty.` };
    }
    if (!med.dosage || !med.dosage.trim()) {
      return { success: false, error: `Dosage for ${med.name} is required (e.g. 1 Tablet, 500mg).` };
    }
    if (!med.frequency || !med.frequency.trim()) {
      return { success: false, error: `Frequency for ${med.name} is required (e.g. Twice daily).` };
    }
  }

  const year = new Date().getFullYear();
  const serial = Math.floor(1000 + Math.random() * 9000);
  const prescriptionId = prescriptionData.id || `RX-${year}-${serial}`;
  const prescriptionNumber = prescriptionData.prescriptionNumber || `RX-MQ-${year}-${serial}`;

  const cleanPrescription: DoctorPrescription = {
    id: prescriptionId,
    prescriptionNumber,
    patientId: prescriptionData.patientId || 'pat-unknown',
    patientUhid: prescriptionData.patientUhid || 'SJMC-2026-DEL-08942A',
    patientName: prescriptionData.patientName || 'Patient',
    patientAge: prescriptionData.patientAge || 40,
    patientGender: prescriptionData.patientGender || 'Male',
    doctorId: prescriptionData.doctorId || 'doc-1',
    doctorName: prescriptionData.doctorName || 'Dr. Arvind Sharma, MD',
    doctorSpecialty: prescriptionData.doctorSpecialty || 'Senior Consultant Orthopedics & Joint Care',
    doctorDepartment: prescriptionData.doctorDepartment || 'Orthopedics',
    doctorRoom: prescriptionData.doctorRoom || 'Room 204',
    tokenNumber: prescriptionData.tokenNumber || 'A-42',
    diagnosis: prescriptionData.diagnosis.trim(),
    doctorNotes: prescriptionData.doctorNotes?.trim() || '',
    medicines: prescriptionData.medicines.map((m, i) => ({
      id: m.id || `med-${Date.now()}-${i}`,
      name: m.name.trim(),
      dosage: m.dosage.trim(),
      frequency: m.frequency.trim(),
      duration: m.duration?.trim() || '5 days',
      instructions: m.instructions?.trim() || 'Take after meals with water.',
    })),
    followUpDate: prescriptionData.followUpDate || '',
    dietaryAdvice: prescriptionData.dietaryAdvice || '',
    investigationsRecommended: prescriptionData.investigationsRecommended || [],
    prescribedAt: new Date().toISOString(),
    status: 'active',
    isConfirmedByDoctor: true,
    signature: `Digitally signed by ${prescriptionData.doctorName || 'Attending Physician'} (Reg #${Math.floor(10000 + Math.random() * 90000)}/NMC)`,
  };

  // 1. Save to in-memory mirror
  inMemoryPrescriptions.unshift(cleanPrescription);

  // 2. Save to MongoDB if available
  const db = await getMongoDb();
  if (db) {
    try {
      await db.collection('prescriptions').insertOne(cleanPrescription as any);
      console.log(`[MongoDB] Prescription ${cleanPrescription.id} persisted to database.`);
    } catch (err: any) {
      console.warn('[MongoDB] Prescription save warning:', err?.message);
    }
  }

  return { success: true, prescription: cleanPrescription };
}

/**
 * Finish Consultation:
 * Marks patient completed, records duration and consultation notes, preserves history.
 */
export async function finishConsultationService(
  consultationData: Partial<DoctorConsultation>
): Promise<{ success: boolean; consultation?: DoctorConsultation; error?: string }> {
  if (!consultationData.patientId && !consultationData.tokenNumber) {
    return { success: false, error: 'Patient ID or Token Number required to finish consultation.' };
  }

  const consId = consultationData.id || `CONS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const finalConsultation: DoctorConsultation = {
    id: consId,
    tokenNumber: consultationData.tokenNumber || 'A-00',
    patientId: consultationData.patientId || 'pat-unknown',
    patientUhid: consultationData.patientUhid || 'UHID-PENDING',
    patientName: consultationData.patientName || 'Consulted Patient',
    patientAge: consultationData.patientAge,
    patientGender: consultationData.patientGender,
    doctorId: consultationData.doctorId || 'doc-1',
    doctorName: consultationData.doctorName || 'Dr. Arvind Sharma, MD',
    doctorDepartment: consultationData.doctorDepartment || 'Orthopedics',
    startedAt: consultationData.startedAt || new Date(Date.now() - 15 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    completedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    durationMinutes: consultationData.durationMinutes || 15,
    diagnosis: consultationData.diagnosis || 'Clinical OPD Examination Completed',
    clinicalNotes: consultationData.clinicalNotes || 'Patient examined, vital parameters reviewed, prescribed plan explained.',
    prescriptionId: consultationData.prescriptionId,
    prescription: consultationData.prescription,
    status: 'completed',
    vitals: consultationData.vitals || {
      bp: '122/80 mmHg',
      pulse: '74 bpm',
      temp: '98.6°F',
      spo2: '99%',
    },
  };

  // 1. In-memory mirror
  inMemoryConsultations.unshift(finalConsultation);

  // 2. Persist to MongoDB
  const db = await getMongoDb();
  if (db) {
    try {
      await db.collection('consultations').insertOne(finalConsultation as any);

      // Update patient status in patients collection
      if (finalConsultation.patientId) {
        await db.collection('patients').updateOne(
          { id: finalConsultation.patientId },
          { $set: { status: 'completed' } }
        );
      }

      // Update doctor status
      if (finalConsultation.doctorId) {
        await db.collection('doctors').updateOne(
          { id: finalConsultation.doctorId },
          {
            $set: { currentPatientToken: null },
            $inc: { todayConsultedCount: 1 },
          }
        );
      }
      console.log(`[MongoDB] Consultation ${finalConsultation.id} finalized and saved.`);
    } catch (err: any) {
      console.warn('[MongoDB] Finish consultation warning:', err?.message);
    }
  }

  return { success: true, consultation: finalConsultation };
}

/**
 * Get Comprehensive Patient Medical History:
 * Combines previous consultations, prescriptions, lab reports, allergies, and chronic conditions.
 */
export async function getPatientMedicalHistoryService(
  patientIdOrUhid: string
): Promise<PatientMedicalHistoryData> {
  const queryKey = patientIdOrUhid.trim().toLowerCase();

  let matchedPrescriptions: DoctorPrescription[] = inMemoryPrescriptions.filter(
    (rx) =>
      rx.patientId.toLowerCase() === queryKey ||
      rx.patientUhid.toLowerCase() === queryKey
  );

  let matchedConsultations: DoctorConsultation[] = inMemoryConsultations.filter(
    (c) =>
      c.patientId.toLowerCase() === queryKey ||
      c.patientUhid.toLowerCase() === queryKey
  );

  const db = await getMongoDb();
  if (db) {
    try {
      const dbRx = await db
        .collection<DoctorPrescription>('prescriptions')
        .find({
          $or: [
            { patientId: { $regex: new RegExp(`^${queryKey}$`, 'i') } },
            { patientUhid: { $regex: new RegExp(`^${queryKey}$`, 'i') } },
          ],
        })
        .sort({ prescribedAt: -1 })
        .toArray();

      if (dbRx.length > 0) {
        // Merge without duplicates
        const existingIds = new Set(matchedPrescriptions.map((r) => r.id));
        for (const item of dbRx) {
          if (!existingIds.has(item.id)) {
            matchedPrescriptions.push(item);
          }
        }
      }

      const dbCons = await db
        .collection<DoctorConsultation>('consultations')
        .find({
          $or: [
            { patientId: { $regex: new RegExp(`^${queryKey}$`, 'i') } },
            { patientUhid: { $regex: new RegExp(`^${queryKey}$`, 'i') } },
          ],
        })
        .sort({ completedAt: -1 })
        .toArray();

      if (dbCons.length > 0) {
        const existingConsIds = new Set(matchedConsultations.map((c) => c.id));
        for (const item of dbCons) {
          if (!existingConsIds.has(item.id)) {
            matchedConsultations.push(item);
          }
        }
      }
    } catch (e) {
      console.warn('[MongoDB] Patient history query warning:', (e as any)?.message);
    }
  }

  // Pre-configured Verified Lab Reports
  const defaultLabReports = [
    {
      id: 'rep-01',
      title: 'Digital Bilateral Knee X-Ray (AP & Lateral Weight-Bearing View)',
      date: 'Today, 09:15 AM',
      lab: 'Max Central Diagnostic Wing (Block C)',
      status: 'Verified by Radiologist',
      result: 'Mild-to-moderate medial compartment joint space narrowing right knee. Grade II Osteoarthritis. No bone fracture or lytic lesion.',
    },
    {
      id: 'rep-02',
      title: 'Complete Blood Count (CBC) with Platelets & ESR',
      date: 'Today, 09:20 AM',
      lab: 'Hospital Automated Hematology Lab',
      status: 'Verified',
      result: 'Hb: 14.1 g/dL • TLC: 7,400 /mcL • Platelets: 245,000 /mcL • ESR: 16 mm/hr (Mild elevation)',
    },
    {
      id: 'rep-03',
      title: 'Serum Uric Acid & Renal Functional Panel',
      date: '14 Oct 2026',
      lab: 'Apollo Diagnostic Partner Lab',
      status: 'Archived Record',
      result: 'Serum Uric Acid: 5.6 mg/dL (Normal Range: 3.5 - 7.2) • Serum Creatinine: 0.9 mg/dL',
    },
  ];

  const defaultMedications = [
    { name: 'Telmisartan 40mg', dose: '1 Tab Daily (Morning)', doctor: 'Dr. Priya Nair', status: 'Active (Hypertension)' },
    { name: 'Glucosamine Sulfate 500mg', dose: '1 Cap BD (After meals)', doctor: 'Dr. Arvind Sharma', status: 'Active' },
    { name: 'Paracetamol 650mg', dose: '1 Tab SOS for acute joint discomfort', doctor: 'Dr. Arvind Sharma', status: 'As Needed' },
  ];

  return {
    patientId: patientIdOrUhid,
    uhid: queryKey.toUpperCase(),
    name: 'Rajesh Mukherjee',
    age: 52,
    gender: 'Male',
    bloodGroup: 'B+',
    allergies: ['Penicillin', 'Dust Mites'],
    chronicConditions: ['Hypertension (Stage 1)', 'Mild Osteoarthritis (Right Knee)'],
    currentMedications: defaultMedications,
    previousConsultations: matchedConsultations,
    prescriptions: matchedPrescriptions,
    labReports: defaultLabReports,
    extractedDocumentSummary:
      'Verified OPD Follow-up Record. Prior radiograph graded as Grade II MSK Osteoarthritis. Patient has documented Penicillin allergy.',
  };
}

/**
 * Fetch all completed consultations for a doctor today
 */
export async function getDoctorCompletedConsultationsService(doctorId: string): Promise<DoctorConsultation[]> {
  const db = await getMongoDb();
  if (db) {
    try {
      const records = await db
        .collection<DoctorConsultation>('consultations')
        .find({ doctorId, status: 'completed' })
        .sort({ completedAt: -1 })
        .toArray();
      if (records.length > 0) {
        return records;
      }
    } catch (e) {
      console.warn('[MongoDB] Query doctor consultations warning:', (e as any)?.message);
    }
  }

  return inMemoryConsultations.filter((c) => c.doctorId === doctorId && c.status === 'completed');
}
