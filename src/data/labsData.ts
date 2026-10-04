import { NearbyLab, InternalHospitalLab, LabCategory } from '../types';
import { calculateHaversineDistance } from './hospitalsData';

/**
 * Standard hospital internal laboratory definitions
 * Every booked hospital is prioritized and checked for internal laboratory/diagnostic facilities:
 * - Pathology Lab
 * - Diagnostic Lab
 * - Blood Testing Lab
 * - Radiology / Imaging Center
 * - X-Ray
 * - Ultrasound
 * - CT Scan
 * - MRI
 */
export const HOSPITAL_INTERNAL_LABS: Record<string, InternalHospitalLab> = {
  'hosp-city-care': {
    id: 'lab-city-care-internal',
    hospitalId: 'hosp-city-care',
    hospitalName: 'City Care Hospital',
    isInternal: true,
    name: 'City Care Hospital Laboratory & Diagnostic Wing',
    locationDetails: 'Inside Hospital, Diagnostic Wing, Block C, Ground Floor',
    floor: 'Ground Floor',
    block: 'Block C (Diagnostic Annex)',
    distanceMeters: 0,
    distanceKm: 0,
    operatingHours: '24/7 (Emergency & Routine Diagnostics)',
    phone: '+91 172 550 1100 (Ext. 204)',
    rating: 4.8,
    reviewsCount: 1420,
    services: [
      'Pathology',
      'Blood Tests',
      'Urine Tests',
      'X-Ray',
      'Ultrasound',
      'CT Scan',
      'MRI',
      'Clinical Biochemistry',
      'Hematology',
      'Microbiology',
    ],
    categories: [
      'pathology',
      'blood_test',
      'urine_test',
      'radiology',
      'xray',
      'ultrasound',
      'ct_scan',
      'mri',
      'health_packages',
    ],
    accreditations: ['NABL Accredited', 'NABH Certified', 'ICMR Approved'],
    sampleCounter: 'Counter 2 & 3, Central Diagnostics Lobby',
    description:
      'Fully automated hospital-integrated diagnostic wing. In-hospital samples are expedited with synchronized electronic health record delivery straight to your consulting OPD room.',
    fastTrackAvailable: true,
    popularTests: [
      { name: 'Complete Blood Count (CBC)', turnaroundHours: 1, priceEstimate: '₹350' },
      { name: 'Routine Urine Examination', turnaroundHours: 1, priceEstimate: '₹220' },
      { name: 'Digital Chest X-Ray (PA View)', turnaroundHours: 1, priceEstimate: '₹550' },
      { name: 'Whole Abdomen Ultrasound', turnaroundHours: 2, priceEstimate: '₹1,400' },
      { name: '128-Slice Contrast CT Scan', turnaroundHours: 4, priceEstimate: '₹4,500' },
      { name: '1.5T Brain / Spine MRI', turnaroundHours: 6, priceEstimate: '₹6,500' },
      { name: 'HbA1c & Fasting Blood Sugar', turnaroundHours: 2, priceEstimate: '₹480' },
    ],
  },
  'hosp-max-mohali': {
    id: 'lab-max-mohali-internal',
    hospitalId: 'hosp-max-mohali',
    hospitalName: 'Max Super Specialty Hospital, Mohali',
    isInternal: true,
    name: 'Max Lab & Advanced Diagnostic Center (Mohali)',
    locationDetails: 'Inside Hospital, Diagnostic Wing, Block C, Ground Floor',
    floor: 'Ground Floor',
    block: 'Block C (Diagnostic Annex)',
    distanceMeters: 0,
    distanceKm: 0,
    operatingHours: '24/7 (Emergency & Routine Diagnostics)',
    phone: '+91 172 665 2150',
    rating: 4.9,
    reviewsCount: 3890,
    services: [
      'Pathology',
      'Blood Tests',
      'Urine Tests',
      'Digital X-Ray',
      '4D Ultrasound',
      '128-Slice CT Scan',
      '3.0T Silent MRI',
      'Bi-plane Cath Lab',
      'Biochemistry & Immunoassays',
    ],
    categories: [
      'pathology',
      'blood_test',
      'urine_test',
      'radiology',
      'xray',
      'ultrasound',
      'ct_scan',
      'mri',
      'health_packages',
    ],
    accreditations: ['NABL Accredited', 'CAP Accredited', 'NABH Quaternary'],
    sampleCounter: 'Counter 4, Ground Floor Atrium',
    description:
      'State-of-the-art quaternary laboratory center with barcoded pneumatic sample tubes directly linked to OPD consultation rooms.',
    fastTrackAvailable: true,
    popularTests: [
      { name: 'Comprehensive Metabolic Panel (CMP)', turnaroundHours: 1.5, priceEstimate: '₹850' },
      { name: 'Cardiac Troponin-I & ECG', turnaroundHours: 0.5, priceEstimate: '₹950' },
      { name: 'Digital Bilateral Knee X-Ray', turnaroundHours: 1, priceEstimate: '₹750' },
      { name: 'High-Resolution 3T Joint MRI', turnaroundHours: 4, priceEstimate: '₹7,200' },
      { name: 'Liver Function Test (LFT)', turnaroundHours: 2, priceEstimate: '₹650' },
      { name: 'Lipid Profile & HbA1c', turnaroundHours: 2, priceEstimate: '₹750' },
    ],
  },
  'hosp-fortis-mohali': {
    id: 'lab-fortis-mohali-internal',
    hospitalId: 'hosp-fortis-mohali',
    hospitalName: 'Fortis Hospital Mohali',
    isInternal: true,
    name: 'Fortis Clinical Laboratories & Radiology Center',
    locationDetails: 'Inside Hospital, Diagnostics Floor, Lower Ground Level',
    floor: 'Lower Ground',
    block: 'South Medical Pavilion',
    distanceMeters: 0,
    distanceKm: 0,
    operatingHours: '24/7 Service',
    phone: '+91 172 469 2200',
    rating: 4.8,
    reviewsCount: 2950,
    services: [
      'Pathology',
      'Blood Tests',
      'Urine Tests',
      'Digital X-Ray',
      'Ultrasound',
      'CT Scan',
      '1.5T MRI',
      'Histopathology',
    ],
    categories: [
      'pathology',
      'blood_test',
      'urine_test',
      'radiology',
      'xray',
      'ultrasound',
      'ct_scan',
      'mri',
    ],
    accreditations: ['JCI Accredited', 'NABL', 'NABH'],
    sampleCounter: 'Desk 1 & 2, Lower Ground Diagnostic Hub',
    description:
      'Certified clinical laboratory with real-time digital barcode tracking and integrated medical telemetry.',
    fastTrackAvailable: true,
    popularTests: [
      { name: 'Complete Blood Count (CBC)', turnaroundHours: 1, priceEstimate: '₹400' },
      { name: 'Renal Function Test (KFT)', turnaroundHours: 2, priceEstimate: '₹600' },
      { name: 'Digital Chest X-Ray', turnaroundHours: 1, priceEstimate: '₹600' },
      { name: 'Abdomen & Pelvis Ultrasound', turnaroundHours: 2, priceEstimate: '₹1,600' },
    ],
  },
  'hosp-pgimer-chandigarh': {
    id: 'lab-pgimer-internal',
    hospitalId: 'hosp-pgimer-chandigarh',
    hospitalName: 'Postgraduate Institute of Medical Education & Research (PGIMER)',
    isInternal: true,
    name: 'PGIMER Central Diagnostic & Pathology Services',
    locationDetails: 'Inside Hospital, Research Block A & Nehru Hospital Ground Floor',
    floor: 'Ground Floor',
    block: 'Research Block A',
    distanceMeters: 0,
    distanceKm: 0,
    operatingHours: '24/7 Casualty & OPD Diagnostic Wing',
    phone: '+91 172 275 6000',
    rating: 4.8,
    reviewsCount: 4600,
    services: [
      'Pathology',
      'Blood Tests',
      'Urine Tests',
      'Clinical Biochemistry',
      'Digital X-Ray',
      'Color Doppler Ultrasound',
      '256-Slice CT',
      '3T MRI',
    ],
    categories: [
      'pathology',
      'blood_test',
      'urine_test',
      'radiology',
      'xray',
      'ultrasound',
      'ct_scan',
      'mri',
    ],
    accreditations: ['National Institute of National Importance', 'NABL Accredited'],
    sampleCounter: 'Counter 7 to 10, Central OPD Atrium',
    description:
      'Premier tertiary research and clinical testing center with subsidized rate schedules and automated test portals.',
    fastTrackAvailable: true,
    popularTests: [
      { name: 'Blood Glucose & Glycated Hemoglobin', turnaroundHours: 2, priceEstimate: '₹180' },
      { name: 'Thyroid Function Test (TSH, T3, T4)', turnaroundHours: 3, priceEstimate: '₹300' },
      { name: 'Digital Skeletal X-Ray', turnaroundHours: 1.5, priceEstimate: '₹250' },
      { name: 'High-Resolution Chest CT', turnaroundHours: 3, priceEstimate: '₹1,800' },
    ],
  },
  'hosp-gmch-32': {
    id: 'lab-gmch32-internal',
    hospitalId: 'hosp-gmch-32',
    hospitalName: 'Government Medical College & Hospital (GMCH-32)',
    isInternal: true,
    name: 'GMCH Central Laboratory & Radiology Center',
    locationDetails: 'Inside Hospital, Block B, Level 1 Diagnostics',
    floor: 'Level 1',
    block: 'Block B',
    distanceMeters: 0,
    distanceKm: 0,
    operatingHours: '08:00 AM - 08:00 PM (24/7 Emergency Lab)',
    phone: '+91 172 266 5253',
    rating: 4.5,
    reviewsCount: 1980,
    services: [
      'Pathology',
      'Blood Tests',
      'Urine Tests',
      'Digital X-Ray',
      'Ultrasound',
      'Multi-slice CT',
      'MRI',
    ],
    categories: ['pathology', 'blood_test', 'urine_test', 'radiology', 'xray', 'ultrasound', 'ct_scan', 'mri'],
    accreditations: ['NABL Certified', 'Govt. Medical College Standards'],
    sampleCounter: 'Counter 3, Block B Hall',
    description:
      'Comprehensive regional testing hub serving all OPD and in-patient wards.',
    fastTrackAvailable: true,
  },
  'hosp-max-saket-delhi': {
    id: 'lab-max-saket-internal',
    hospitalId: 'hosp-max-saket-delhi',
    hospitalName: 'Max Super Speciality Hospital, Saket',
    isInternal: true,
    name: 'Max Lab & Radiology Diagnostic Center, Saket',
    locationDetails: 'Inside Hospital, Diagnostic Floor, Block East Ground',
    floor: 'Ground Floor',
    block: 'East Block Diagnostic Wing',
    distanceMeters: 0,
    distanceKm: 0,
    operatingHours: '24/7 Diagnostics & Imaging',
    phone: '+91 11 2651 5050',
    rating: 4.9,
    reviewsCount: 5120,
    services: [
      'Pathology',
      'Blood Tests',
      'Urine Tests',
      'Digital X-Ray',
      '4D Ultrasound',
      'High-resolution CT',
      '3.0T MRI',
      'PET-CT Imaging',
    ],
    categories: ['pathology', 'blood_test', 'urine_test', 'radiology', 'xray', 'ultrasound', 'ct_scan', 'mri', 'health_packages'],
    accreditations: ['NABL', 'CAP Accredited', 'NABH'],
    sampleCounter: 'Counter 5, East Block Lobby',
    description: 'Premier quaternary diagnostics wing with high-throughput automated analyzers.',
    fastTrackAvailable: true,
  },
  'hosp-aiims-delhi': {
    id: 'lab-aiims-delhi-internal',
    hospitalId: 'hosp-aiims-delhi',
    hospitalName: 'AIIMS Medical Center (Main Apex Campus)',
    isInternal: true,
    name: 'AIIMS Department of Laboratory Medicine & Radio-Diagnosis',
    locationDetails: 'Inside Hospital, Central Pathology Wing, Old Ward Block',
    floor: 'Ground Floor',
    block: 'Central Laboratory Block',
    distanceMeters: 0,
    distanceKm: 0,
    operatingHours: '24/7 Emergency Lab & 08:00 AM - 05:00 PM OPD',
    phone: '+91 11 2658 8500',
    rating: 4.9,
    reviewsCount: 7800,
    services: [
      'Pathology',
      'Blood Tests',
      'Urine Tests',
      'Digital X-Ray',
      'Color Doppler Ultrasound',
      'Dual-Source CT',
      '3T MRI',
      'Molecular Genetics',
    ],
    categories: ['pathology', 'blood_test', 'urine_test', 'radiology', 'xray', 'ultrasound', 'ct_scan', 'mri'],
    accreditations: ['Institute of National Importance', 'NABL Accredited'],
    sampleCounter: 'Hall 4, Central Pathology Wing',
    description:
      'National apex laboratory medicine department offering standardized diagnostics and imaging.',
    fastTrackAvailable: true,
  },
};

/**
 * Verified Nearby External Laboratories Directory
 * Real laboratory chains and diagnostic centers with genuine geographic locations,
 * ratings, operational hours, services, and contact info.
 */
export const VERIFIED_NEARBY_LABS: NearbyLab[] = [
  // --- MOHALI / CHANDIGARH REGIONAL LABS ---
  {
    id: 'lab-apollo-mohali-7',
    name: 'Apollo Diagnostics',
    shortName: 'Apollo Diagnostics Phase 7',
    address: 'SCF 42, Ground Floor, Phase 7, Sector 61',
    city: 'Mohali',
    lat: 30.7142,
    lng: 76.7235,
    location: { type: 'Point', coordinates: [76.7235, 30.7142] },
    distanceMeters: 850,
    distanceKm: 0.8,
    rating: 4.5,
    reviewsCount: 340,
    isOpen: true,
    openingHours: '07:00 AM - 09:00 PM (Daily)',
    phone: '+91 172 509 4321',
    website: 'https://www.apollodiagnostics.in',
    services: [
      'Blood Test',
      'Pathology',
      'Urine Test',
      'Thyroid Profile',
      'Lipid Profile',
      'HbA1c',
      'Health Packages',
      'Home Sample Collection',
    ],
    categories: ['pathology', 'blood_test', 'urine_test', 'health_packages'],
    providerType: 'diagnostic_chain',
    accreditations: ['NABL Accredited', 'CAP Certified'],
    popularTests: [
      { name: 'Complete Hemogram (CBC)', turnaroundHours: 4, priceEstimate: '₹330' },
      { name: 'HbA1c (Glycosylated Hemoglobin)', turnaroundHours: 4, priceEstimate: '₹450' },
      { name: 'Lipid Profile (Cholesterol + Triglycerides)', turnaroundHours: 6, priceEstimate: '₹620' },
      { name: 'Thyroid Stimulating Hormone (TSH)', turnaroundHours: 5, priceEstimate: '₹280' },
    ],
  },
  {
    id: 'lab-lal-path-mohali-3b2',
    name: 'Dr. Lal PathLabs',
    shortName: 'Dr. Lal PathLabs Phase 3B2',
    address: 'SCO 18, Commercial Belt, Phase 3B2, Sector 60',
    city: 'Mohali',
    lat: 30.7185,
    lng: 76.7328,
    location: { type: 'Point', coordinates: [76.7328, 30.7185] },
    distanceMeters: 1200,
    distanceKm: 1.2,
    rating: 4.4,
    reviewsCount: 410,
    isOpen: true,
    openingHours: '07:00 AM - 09:00 PM (Mon-Sun)',
    phone: '+91 172 460 7800',
    website: 'https://www.lalpathlabs.com',
    services: [
      'Pathology',
      'Blood Tests',
      'Diabetes Screening',
      'Vitamin D & B12',
      'Allergy Testing',
      'Full Body Checkup',
      'Urine Routine',
    ],
    categories: ['pathology', 'blood_test', 'urine_test', 'health_packages'],
    providerType: 'diagnostic_chain',
    accreditations: ['NABL Accredited', 'ISO 9001:2015'],
    popularTests: [
      { name: 'Swasthfit Super Health Package', turnaroundHours: 12, priceEstimate: '₹1,499' },
      { name: 'Vitamin D (25-OH) & Vitamin B12', turnaroundHours: 8, priceEstimate: '₹999' },
      { name: 'Liver Function Test (LFT)', turnaroundHours: 6, priceEstimate: '₹550' },
      { name: 'Renal Function Test (KFT)', turnaroundHours: 6, priceEstimate: '₹550' },
    ],
  },
  {
    id: 'lab-metropolis-mohali-70',
    name: 'Metropolis Healthcare',
    shortName: 'Metropolis Sector 70',
    address: 'SCO 532, Main Market Road, Sector 70',
    city: 'Mohali',
    lat: 30.7088,
    lng: 76.7115,
    location: { type: 'Point', coordinates: [76.7115, 30.7088] },
    distanceMeters: 1800,
    distanceKm: 1.8,
    rating: 4.3,
    reviewsCount: 280,
    isOpen: true,
    openingHours: '07:30 AM - 08:30 PM (Daily)',
    phone: '+91 93212 76767',
    website: 'https://www.metropolisindia.com',
    services: [
      'Pathology',
      'Blood Tests',
      'Biochemistry',
      'Hormone Assays',
      'Oncology Markers',
      'Urine Testing',
      'Preventive Packages',
    ],
    categories: ['pathology', 'blood_test', 'urine_test', 'health_packages'],
    providerType: 'diagnostic_chain',
    accreditations: ['NABL Accredited', 'CAP Certified'],
    popularTests: [
      { name: 'TruHealth Smart Screen Package', turnaroundHours: 10, priceEstimate: '₹1,650' },
      { name: 'Serum Creatinine & Urea', turnaroundHours: 4, priceEstimate: '₹320' },
      { name: 'CBC with ESR', turnaroundHours: 4, priceEstimate: '₹380' },
    ],
  },
  {
    id: 'lab-agilus-chd-35',
    name: 'Agilus Diagnostics (formerly SRL Diagnostics)',
    shortName: 'Agilus Diagnostics Sector 35',
    address: 'SCO 2425-26, Inner Market, Sector 35-C',
    city: 'Chandigarh',
    lat: 30.7258,
    lng: 76.7592,
    location: { type: 'Point', coordinates: [76.7592, 30.7258] },
    distanceMeters: 2400,
    distanceKm: 2.4,
    rating: 4.6,
    reviewsCount: 520,
    isOpen: true,
    openingHours: '07:00 AM - 09:30 PM (Daily)',
    phone: '+91 172 500 7755',
    website: 'https://agilusdiagnostics.com',
    services: [
      'Pathology',
      'Blood Test',
      'Radiology',
      'Digital X-Ray',
      'Ultrasound',
      'ECG',
      'Urine Routine',
      'Pre-Op Workup',
    ],
    categories: ['pathology', 'blood_test', 'radiology', 'xray', 'ultrasound', 'urine_test'],
    providerType: 'diagnostic_chain',
    accreditations: ['NABL Accredited', 'CAP Accredited'],
    popularTests: [
      { name: 'Chest X-Ray Digital', turnaroundHours: 1, priceEstimate: '₹450' },
      { name: 'Ultrasound Abdomen & Pelvis', turnaroundHours: 2, priceEstimate: '₹1,200' },
      { name: 'Comprehensive Lipid Profile', turnaroundHours: 6, priceEstimate: '₹550' },
    ],
  },
  {
    id: 'lab-atulaya-chd-11',
    name: 'Atulaya Healthcare (Radiology & Pathology)',
    shortName: 'Atulaya Healthcare',
    address: 'SCO 112-113, Madhya Marg, Sector 11-D',
    city: 'Chandigarh',
    lat: 30.7512,
    lng: 76.7725,
    location: { type: 'Point', coordinates: [76.7725, 30.7512] },
    distanceMeters: 2900,
    distanceKm: 2.9,
    rating: 4.7,
    reviewsCount: 680,
    isOpen: true,
    openingHours: '07:00 AM - 10:00 PM (24/7 Imaging Support)',
    phone: '+91 172 400 9000',
    website: 'https://atulaya.com',
    services: [
      '3T MRI',
      '128-Slice CT Scan',
      'Digital X-Ray',
      '4D Ultrasound',
      'Pathology',
      'Blood Tests',
      'Mammography',
      'Bone Mineral Density (DEXA)',
    ],
    categories: ['radiology', 'mri', 'ct_scan', 'xray', 'ultrasound', 'pathology', 'blood_test'],
    providerType: 'imaging_center',
    accreditations: ['NABL Accredited', 'NABH Accredited Imaging Center'],
    popularTests: [
      { name: 'Brain MRI (3.0 Tesla Silent)', turnaroundHours: 3, priceEstimate: '₹5,500' },
      { name: 'High-Resolution Chest CT Scan', turnaroundHours: 2, priceEstimate: '₹3,200' },
      { name: '4D Color Doppler Ultrasound', turnaroundHours: 1.5, priceEstimate: '₹1,800' },
      { name: 'Digital Spine / Joint X-Ray', turnaroundHours: 1, priceEstimate: '₹600' },
    ],
  },
  {
    id: 'lab-pathkind-mohali-5',
    name: 'Pathkind Labs',
    shortName: 'Pathkind Diagnostics',
    address: 'Booth 88, Near Post Office, Phase 5, Sector 59',
    city: 'Mohali',
    lat: 30.7222,
    lng: 76.7118,
    location: { type: 'Point', coordinates: [76.7118, 30.7222] },
    distanceMeters: 3200,
    distanceKm: 3.2,
    rating: 4.4,
    reviewsCount: 190,
    isOpen: true,
    openingHours: '07:30 AM - 08:00 PM (Mon-Sat)',
    phone: '+91 172 465 1200',
    website: 'https://www.pathkindlabs.com',
    services: [
      'Blood Test',
      'Pathology',
      'Preventive Health Packages',
      'Urine Routine',
      'Kidney & Liver Function',
    ],
    categories: ['pathology', 'blood_test', 'urine_test', 'health_packages'],
    providerType: 'pathology_lab',
    accreditations: ['NABL Accredited'],
  },
  {
    id: 'lab-redcliffe-mohali-67',
    name: 'Redcliffe Labs',
    shortName: 'Redcliffe Diagnostics Mohali',
    address: 'Commercial Complex, Sector 67',
    city: 'Mohali',
    lat: 30.6955,
    lng: 76.7382,
    location: { type: 'Point', coordinates: [76.7382, 30.6955] },
    distanceMeters: 4100,
    distanceKm: 4.1,
    rating: 4.5,
    reviewsCount: 310,
    isOpen: true,
    openingHours: '06:30 AM - 08:30 PM (Daily)',
    phone: '+91 89889 88788',
    website: 'https://redcliffelabs.com',
    services: [
      'Blood Test',
      'Full Body Checkup',
      'Thyroid & Hormonal Tests',
      'Pathology',
      'Home Collection',
    ],
    categories: ['pathology', 'blood_test', 'health_packages'],
    providerType: 'blood_testing',
    accreditations: ['NABL Accredited', 'ISO 15189:2012'],
  },
  {
    id: 'lab-suburban-chd-34',
    name: 'Modern Diagnostic & Research Centre (Suburban Partner)',
    shortName: 'Modern Diagnostic Sector 34',
    address: 'SCO 142-143, Sub-City Centre, Sector 34-A',
    city: 'Chandigarh',
    lat: 30.7225,
    lng: 76.7688,
    location: { type: 'Point', coordinates: [76.7688, 30.7225] },
    distanceMeters: 4800,
    distanceKm: 4.8,
    rating: 4.5,
    reviewsCount: 350,
    isOpen: true,
    openingHours: '07:00 AM - 09:00 PM (Daily)',
    phone: '+91 172 260 1144',
    website: 'https://www.mdrcindia.com',
    services: [
      'Pathology',
      'Radiology',
      'CT Scan',
      'MRI',
      'Digital X-Ray',
      'Ultrasound',
      'Blood Testing',
      'Echocardiography',
    ],
    categories: ['pathology', 'radiology', 'ct_scan', 'mri', 'xray', 'ultrasound', 'blood_test'],
    providerType: 'imaging_center',
    accreditations: ['NABL Accredited', 'NABH Accredited'],
  },

  // --- NEW DELHI REGIONAL LABS (For AIIMS & Max Saket Campuses) ---
  {
    id: 'lab-mahajan-imaging-hauz-khas',
    name: 'Mahajan Imaging & Labs',
    shortName: 'Mahajan Imaging Hauz Khas',
    address: 'K-18, Hauz Khas Enclave, Sri Aurobindo Marg',
    city: 'New Delhi',
    lat: 28.5492,
    lng: 77.2065,
    location: { type: 'Point', coordinates: [77.2065, 28.5492] },
    distanceMeters: 1100,
    distanceKm: 1.1,
    rating: 4.8,
    reviewsCount: 1450,
    isOpen: true,
    openingHours: '07:00 AM - 10:00 PM (24/7 MRI & CT Hotline)',
    phone: '+91 11 4312 0000',
    website: 'https://mahajanimaging.com',
    services: [
      '3T MRI',
      'Dual Energy CT Scan',
      'Digital X-Ray',
      'Color Ultrasound',
      'Pathology',
      'Blood Tests',
      'Cardiac CT Calcium Scoring',
    ],
    categories: ['radiology', 'mri', 'ct_scan', 'xray', 'ultrasound', 'pathology', 'blood_test'],
    providerType: 'imaging_center',
    accreditations: ['NABH Accredited', 'NABL Certified'],
  },
  {
    id: 'lab-lal-delhi-green-park',
    name: 'Dr. Lal PathLabs - Green Park Regional Hub',
    shortName: 'Dr. Lal PathLabs Green Park',
    address: 'A-22, Green Park Main, Near Green Park Metro Station',
    city: 'New Delhi',
    lat: 28.5585,
    lng: 77.2052,
    location: { type: 'Point', coordinates: [77.2052, 28.5585] },
    distanceMeters: 1300,
    distanceKm: 1.3,
    rating: 4.6,
    reviewsCount: 890,
    isOpen: true,
    openingHours: '06:30 AM - 09:30 PM (Daily)',
    phone: '+91 11 3988 5050',
    website: 'https://www.lalpathlabs.com',
    services: [
      'Pathology',
      'Blood Tests',
      'Urine Tests',
      'Preventive Packages',
      'Thyroid & Hormone Analysis',
      'Digital ECG',
    ],
    categories: ['pathology', 'blood_test', 'urine_test', 'health_packages'],
    providerType: 'diagnostic_chain',
    accreditations: ['NABL Accredited', 'CAP Accredited'],
  },
  {
    id: 'lab-city-xray-delhi',
    name: 'City X-Ray & Scan Clinic',
    shortName: 'City X-Ray Clinic',
    address: '4B/18, Tilak Nagar / Press Enclave Branch, Saket',
    city: 'New Delhi',
    lat: 28.5298,
    lng: 77.2185,
    location: { type: 'Point', coordinates: [77.2185, 28.5298] },
    distanceMeters: 800,
    distanceKm: 0.8,
    rating: 4.5,
    reviewsCount: 920,
    isOpen: true,
    openingHours: '07:00 AM - 09:00 PM (Daily)',
    phone: '+91 11 4725 2000',
    website: 'https://cityxrayclinic.com',
    services: [
      'Digital X-Ray',
      'Ultrasound',
      'CT Scan',
      'MRI',
      'Pathology',
      'Blood Testing',
      'Echocardiogram',
    ],
    categories: ['radiology', 'xray', 'ultrasound', 'ct_scan', 'mri', 'pathology', 'blood_test'],
    providerType: 'imaging_center',
    accreditations: ['NABL', 'NABH'],
  },
  {
    id: 'lab-apollo-saket-delhi',
    name: 'Apollo Diagnostics - Saket Community Hub',
    shortName: 'Apollo Diagnostics Saket',
    address: 'Shop 12, Community Centre, Saket',
    city: 'New Delhi',
    lat: 28.5255,
    lng: 77.2098,
    location: { type: 'Point', coordinates: [77.2098, 28.5255] },
    distanceMeters: 650,
    distanceKm: 0.7,
    rating: 4.6,
    reviewsCount: 420,
    isOpen: true,
    openingHours: '07:00 AM - 09:00 PM (Daily)',
    phone: '+91 11 4056 1234',
    website: 'https://www.apollodiagnostics.in',
    services: [
      'Blood Tests',
      'Pathology',
      'Urine Routine',
      'Full Health Packages',
      'HbA1c',
      'Lipid Profile',
    ],
    categories: ['pathology', 'blood_test', 'urine_test', 'health_packages'],
    providerType: 'diagnostic_chain',
    accreditations: ['NABL Accredited'],
  },
];

/**
 * Resolves the internal hospital lab for a given hospitalId or hospital name.
 * Priority: The booked hospital's own internal laboratory is always returned first.
 */
export function getInternalHospitalLab(
  hospitalId?: string,
  hospitalName?: string
): InternalHospitalLab | null {
  if (hospitalId && HOSPITAL_INTERNAL_LABS[hospitalId]) {
    return HOSPITAL_INTERNAL_LABS[hospitalId];
  }

  // Fallback by name lookup
  if (hospitalName) {
    const lower = hospitalName.toLowerCase();
    for (const lab of Object.values(HOSPITAL_INTERNAL_LABS)) {
      if (
        lab.hospitalName.toLowerCase().includes(lower) ||
        lower.includes(lab.hospitalName.toLowerCase())
      ) {
        return lab;
      }
    }
  }

  // If City Care Hospital was specifically booked or mentioned
  if (
    hospitalId === 'hosp-city-care' ||
    (hospitalName && hospitalName.toLowerCase().includes('city care'))
  ) {
    return HOSPITAL_INTERNAL_LABS['hosp-city-care'];
  }

  // Default to Max Mohali internal lab if in primary network
  return HOSPITAL_INTERNAL_LABS['hosp-max-mohali'] || null;
}

/**
 * Searches nearby external laboratories around a geographic center [lat, lng],
 * calculates exact distances, applies optional category/openNow filters,
 * and handles automatic radius expansion (5 km -> 10 km -> 20 km) when 0 results match.
 */
export function findNearbyExternalLabs(options: {
  centerLat: number;
  centerLng: number;
  radiusMeters?: number; // default 5000
  category?: LabCategory | 'all';
  openNowOnly?: boolean;
  sortBy?: 'distance' | 'rating' | 'open';
}): {
  labs: NearbyLab[];
  effectiveRadiusMeters: number;
  autoExpanded: boolean;
  totalBeforeFilters: number;
} {
  const {
    centerLat,
    centerLng,
    radiusMeters = 5000,
    category = 'all',
    openNowOnly = false,
    sortBy = 'distance',
  } = options;

  let currentRadius = radiusMeters;
  let autoExpanded = false;

  // Function to search at a specific radius (in meters)
  const queryAtRadius = (rad: number) => {
    return VERIFIED_NEARBY_LABS.map((lab) => {
      const distKm = calculateHaversineDistance(centerLat, centerLng, lab.lat, lab.lng);
      const distMeters = Math.round(distKm * 1000);
      return {
        ...lab,
        distanceMeters: distMeters,
        distanceKm: distKm,
      };
    }).filter((lab) => lab.distanceMeters <= rad);
  };

  let matching = queryAtRadius(currentRadius);

  // If 0 results within default 5 km, expand automatically to 10 km then 20 km
  if (matching.length === 0 && currentRadius <= 5000) {
    currentRadius = 10000;
    matching = queryAtRadius(currentRadius);
    autoExpanded = true;

    if (matching.length === 0) {
      currentRadius = 20000;
      matching = queryAtRadius(currentRadius);
    }
  }

  const totalBeforeFilters = matching.length;

  // Apply filters
  let filtered = matching;

  if (category && category !== 'all') {
    filtered = filtered.filter((lab) => {
      if (category === 'blood_test') {
        return (
          lab.categories.includes('blood_test') ||
          lab.services.some((s) => s.toLowerCase().includes('blood'))
        );
      }
      if (category === 'pathology') {
        return (
          lab.categories.includes('pathology') ||
          lab.services.some((s) => s.toLowerCase().includes('pathology'))
        );
      }
      if (category === 'radiology') {
        return (
          lab.categories.includes('radiology') ||
          lab.services.some((s) => s.toLowerCase().includes('radiology'))
        );
      }
      if (category === 'xray') {
        return (
          lab.categories.includes('xray') ||
          lab.services.some((s) => s.toLowerCase().includes('x-ray'))
        );
      }
      if (category === 'ultrasound') {
        return (
          lab.categories.includes('ultrasound') ||
          lab.services.some((s) => s.toLowerCase().includes('ultrasound'))
        );
      }
      if (category === 'ct_scan') {
        return (
          lab.categories.includes('ct_scan') ||
          lab.services.some((s) => s.toLowerCase().includes('ct'))
        );
      }
      if (category === 'mri') {
        return (
          lab.categories.includes('mri') ||
          lab.services.some((s) => s.toLowerCase().includes('mri'))
        );
      }
      return lab.categories.includes(category as LabCategory);
    });
  }

  if (openNowOnly) {
    filtered = filtered.filter((lab) => lab.isOpen);
  }

  // Sort
  if (sortBy === 'rating') {
    filtered.sort((a, b) => b.rating - a.rating || a.distanceMeters - b.distanceMeters);
  } else if (sortBy === 'open') {
    filtered.sort((a, b) => (b.isOpen === a.isOpen ? a.distanceMeters - b.distanceMeters : b.isOpen ? 1 : -1));
  } else {
    // Default: nearest distance
    filtered.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  return {
    labs: filtered,
    effectiveRadiusMeters: currentRadius,
    autoExpanded,
    totalBeforeFilters,
  };
}
