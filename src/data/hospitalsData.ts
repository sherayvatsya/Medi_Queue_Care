export interface HospitalLocation {
  id: string;
  name: string;
  shortName: string;
  tagline: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  lat: number;
  lng: number;
  phone: string;
  emergencyPhone: string;
  email: string;
  website: string;
  opdStatus: 'Normal Queue' | 'Fast-Track' | 'High Volume' | 'Express Day Care' | 'Open';
  statusColor: 'emerald' | 'sky' | 'amber' | 'rose';
  estimatedWaitMinutes: number;
  activeDoctorsCount: number;
  totalBeds: number;
  availableBeds: number;
  emergency24x7: boolean;
  traumaLevel: string;
  rating: number;
  reviewsCount: number;
  departments: string[];
  facilities: string[];
  opdTimings: string;
  isMainCampus?: boolean;
  distanceKm?: number;
  roadDistanceKm?: number;
  travelTimeMinutes?: number;
}

export const PRIMARY_HOSPITAL_ID = 'hosp-max-mohali';

export const REAL_HOSPITALS_NETWORK: HospitalLocation[] = [
  {
    id: 'hosp-max-mohali',
    name: 'Max Super Specialty Hospital, Mohali',
    shortName: 'Max Super Specialty Mohali',
    tagline: 'NABH & NABL Accredited Quaternary Care & Multi-Organ Transplant Institute',
    address: 'Near Civil Hospital, Phase 6, Sector 56',
    city: 'Sahibzada Ajit Singh Nagar, Mohali',
    state: 'Punjab',
    postalCode: '160055',
    lat: 30.72484,
    lng: 76.72138,
    phone: '+91 172 665 2000',
    emergencyPhone: '+91 172 665 2100 (24/7 ER)',
    email: 'mohali@maxhealthcare.com',
    website: 'https://www.maxhealthcare.in/hospital-network/max-super-speciality-hospital-mohali',
    opdStatus: 'Normal Queue',
    statusColor: 'sky',
    estimatedWaitMinutes: 14,
    activeDoctorsCount: 52,
    totalBeds: 230,
    availableBeds: 46,
    emergency24x7: true,
    traumaLevel: '24/7 Level 1 Trauma & Cardiac Emergency Bay',
    rating: 4.9,
    reviewsCount: 4890,
    departments: [
      'Cardiology & Robotic CTVS',
      'Orthopedics & Joint Reconstruction',
      'Neurosciences & Neurosurgery',
      'Oncology & Bone Marrow Transplant',
      'Gastroenterology & Hepatology',
      'Obstetrics & Gynecology',
      'Pediatrics & Neonatology',
      'Nephrology & Renal Transplant',
      'Trauma & Emergency Resuscitation',
    ],
    facilities: [
      '24/7 Advanced Trauma Center',
      'State-of-the-Art Bi-Plane Cath Lab',
      'Robotic Surgery Suite',
      'Central Blood Bank & Dialysis Bay',
      'Ambulance Fleet with GPS Telemetry',
      'Automated Kiosk Token Check-in',
      'Valet Parking & EV Charging',
    ],
    opdTimings: '08:00 AM - 08:00 PM (Daily)',
    isMainCampus: true,
  },
  {
    id: 'hosp-fortis-mohali',
    name: 'Fortis Hospital Mohali',
    shortName: 'Fortis Mohali',
    tagline: 'JCI Accredited Multi-Super Speciality Regional Medical Hub',
    address: 'Sector 62, Phase 8, SAS Nagar',
    city: 'Mohali',
    state: 'Punjab',
    postalCode: '160062',
    lat: 30.7022,
    lng: 76.7275,
    phone: '+91 172 469 2222',
    emergencyPhone: '+91 172 1050 10',
    email: 'contactus.mohali@fortishealthcare.com',
    website: 'https://www.fortishealthcare.com',
    opdStatus: 'Normal Queue',
    statusColor: 'sky',
    estimatedWaitMinutes: 18,
    activeDoctorsCount: 45,
    totalBeds: 344,
    availableBeds: 58,
    emergency24x7: true,
    traumaLevel: 'Emergency Critical Care & Stroke Unit',
    rating: 4.7,
    reviewsCount: 3620,
    departments: [
      'Cardiac Sciences',
      'Orthopedics & Sports Medicine',
      'Pulmonology & Critical Care',
      'Oncology Care',
      'Urology & Kidney Care',
    ],
    facilities: ['24/7 Blood Bank', 'Fast-Track Triage', 'Ambulance Bay', 'Pediatric ICU'],
    opdTimings: '08:30 AM - 07:00 PM (Mon-Sat)',
  },
  {
    id: 'hosp-pgimer-chandigarh',
    name: 'Postgraduate Institute of Medical Education & Research (PGIMER)',
    shortName: 'PGIMER Chandigarh',
    tagline: 'Premier Institute of National Importance & Tertiary Research Hub',
    address: 'Madhya Marg, Sector 12',
    city: 'Chandigarh',
    state: 'Chandigarh UT',
    postalCode: '160012',
    lat: 30.7651,
    lng: 76.7766,
    phone: '+91 172 274 7585',
    emergencyPhone: '+91 172 275 6565',
    email: 'pgimer@chd.nic.in',
    website: 'https://pgimer.edu.in',
    opdStatus: 'High Volume',
    statusColor: 'amber',
    estimatedWaitMinutes: 28,
    activeDoctorsCount: 88,
    totalBeds: 2200,
    availableBeds: 110,
    emergency24x7: true,
    traumaLevel: 'Apex Advanced Trauma Center',
    rating: 4.8,
    reviewsCount: 8150,
    departments: [
      'General Medicine',
      'Advanced Cardiac Center',
      'Advanced Eye Center',
      'Pediatric Medicine',
      'Neurosurgery & Neurology',
      'Hepatology & Gastroenterology',
    ],
    facilities: ['Level 1 Trauma Bay', 'Helipad Emergency Access', 'Extensive Diagnostics', 'Jan Aushadhi Pharmacy'],
    opdTimings: '08:00 AM - 04:00 PM (Mon-Sat)',
  },
  {
    id: 'hosp-gmch-32',
    name: 'Government Medical College & Hospital (GMCH-32)',
    shortName: 'GMCH Sector 32',
    tagline: 'Comprehensive Regional Healthcare & Academic Hospital',
    address: 'Sector 32B, Chandi Path',
    city: 'Chandigarh',
    state: 'Chandigarh UT',
    postalCode: '160030',
    lat: 30.7107,
    lng: 76.7828,
    phone: '+91 172 266 5253',
    emergencyPhone: '+91 172 266 5300',
    email: 'gmch_chd@gmch.gov.in',
    website: 'https://gmch.gov.in',
    opdStatus: 'Normal Queue',
    statusColor: 'sky',
    estimatedWaitMinutes: 20,
    activeDoctorsCount: 40,
    totalBeds: 950,
    availableBeds: 90,
    emergency24x7: true,
    traumaLevel: '24/7 Emergency & Trauma Center',
    rating: 4.5,
    reviewsCount: 2900,
    departments: [
      'General Medicine',
      'Orthopedics',
      'Obstetrics & Gynecology',
      'Pediatrics',
      'Ophthalmology',
      'ENT',
    ],
    facilities: ['Emergency ICU', 'Blood Transfusion Unit', 'Diagnostic MRI/CT', 'Subsidized Pharmacy'],
    opdTimings: '08:30 AM - 05:00 PM (Mon-Sat)',
  },
  {
    id: 'hosp-max-saket-delhi',
    name: 'Max Super Speciality Hospital, Saket',
    shortName: 'Max Saket New Delhi',
    tagline: 'Centre of Excellence in Cardiac Sciences & Neurosciences',
    address: '1, 2, Press Enclave Marg, Saket Institutional Area',
    city: 'New Delhi',
    state: 'Delhi',
    postalCode: '110017',
    lat: 28.5284,
    lng: 77.2127,
    phone: '+91 11 2651 5050',
    emergencyPhone: '+91 11 4055 4055',
    email: 'saket@maxhealthcare.com',
    website: 'https://www.maxhealthcare.in',
    opdStatus: 'Normal Queue',
    statusColor: 'sky',
    estimatedWaitMinutes: 16,
    activeDoctorsCount: 56,
    totalBeds: 530,
    availableBeds: 72,
    emergency24x7: true,
    traumaLevel: '24/7 Acute Heart Attack & Stroke Center',
    rating: 4.8,
    reviewsCount: 5400,
    departments: [
      'Cardiology & Vascular Interventions',
      'Cancer Care & Bone Marrow Transplant',
      'Orthopedics & Spine Surgery',
      'Neurosciences & Stroke Unit',
      'Nephrology & Renal Dialysis',
    ],
    facilities: ['24/7 Advanced Cath Lab', 'Smart Queue QR Check-in', 'Cafeteria & Lounge', 'EV Charging Station'],
    opdTimings: '08:00 AM - 08:30 PM (Daily)',
  },
  {
    id: 'hosp-aiims-delhi',
    name: 'AIIMS Medical Center (Main Apex Campus)',
    shortName: 'AIIMS Delhi',
    tagline: 'Apex Level 1 Quaternary Care & Multi-Specialty Clinical Hub',
    address: 'Sri Aurobindo Marg, Ansari Nagar East',
    city: 'New Delhi',
    state: 'Delhi',
    postalCode: '110029',
    lat: 28.5672,
    lng: 77.2100,
    phone: '+91 11 2658 8500',
    emergencyPhone: '+91 11 2658 8700 (ER 24/7)',
    email: 'admissions@mediqueue-aiims.org',
    website: 'https://www.aiims.edu',
    opdStatus: 'Normal Queue',
    statusColor: 'sky',
    estimatedWaitMinutes: 18,
    activeDoctorsCount: 60,
    totalBeds: 2478,
    availableBeds: 184,
    emergency24x7: true,
    traumaLevel: 'Level 1 Trauma Center',
    rating: 4.9,
    reviewsCount: 6200,
    departments: [
      'General Medicine',
      'Cardiology & Cath Lab',
      'Orthopedics & Joint Care',
      'Pediatrics & Neonatology',
      'Neurology & Neurosurgery',
    ],
    facilities: ['24/7 Emergency Bay', 'Digital Kiosk Check-in', 'Wheelchair Porters', 'Multi-level EV Parking'],
    opdTimings: '08:00 AM - 08:00 PM (Mon-Sat)',
  },
];

export const POPULAR_LOCATIONS = [
  { name: 'Mohali Phase 7 Market', city: 'Mohali', lat: 30.7068, lng: 76.7210 },
  { name: 'Mohali Phase 3B2 Market', city: 'Mohali', lat: 30.7180, lng: 76.7320 },
  { name: 'Sector 17 Plaza, Chandigarh', city: 'Chandigarh', lat: 30.7415, lng: 76.7794 },
  { name: 'Sector 35 Market, Chandigarh', city: 'Chandigarh', lat: 30.7266, lng: 76.7640 },
  { name: 'Chandigarh Railway Station', city: 'Chandigarh', lat: 30.7032, lng: 76.8238 },
  { name: 'Shaheed Bhagat Singh Airport (IXC)', city: 'Mohali', lat: 30.6730, lng: 76.7885 },
  { name: 'Kharar Bus Stand', city: 'Kharar', lat: 30.7455, lng: 76.6450 },
  { name: 'VIP Road, Zirakpur', city: 'Zirakpur', lat: 30.6425, lng: 76.8173 },
];

/**
 * Calculates the great-circle distance between two GPS coordinates using the Haversine formula (in kilometers).
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

/**
 * Calculate driving route using standard OSRM (Open Source Routing Machine) public endpoint.
 * Returns geojson coordinates array [[lng, lat], ...], distance in km, and duration in minutes.
 */
export async function fetchOsrmRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<{
  coordinates: [number, number][]; // [lat, lng] array for Leaflet Polyline
  distanceKm: number;
  durationMinutes: number;
  success: boolean;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`OSRM HTTP error ${res.status}`);
    }

    const data = await res.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const primaryRoute = data.routes[0];
      const rawCoords: [number, number][] = primaryRoute.geometry.coordinates; // [lng, lat]
      // Convert to [lat, lng] for Leaflet
      const leafletCoords: [number, number][] = rawCoords.map(([lng, lat]) => [lat, lng]);

      const distanceKm = Math.round((primaryRoute.distance / 1000) * 10) / 10;
      const durationMinutes = Math.max(1, Math.round(primaryRoute.duration / 60));

      return {
        coordinates: leafletCoords,
        distanceKm,
        durationMinutes,
        success: true,
      };
    }
  } catch (err) {
    console.warn('OSRM routing fetch failed, calculating curved road interpolation fallback:', err);
  }

  // Graceful fallback: Haversine distance with realistic road curvature factor (1.25x) and average 32 km/h city speed
  const straightDistance = calculateHaversineDistance(originLat, originLng, destLat, destLng);
  const roadDist = Math.round(straightDistance * 1.22 * 10) / 10;
  const durationMin = Math.max(2, Math.round((roadDist / 32) * 60));

  // Generate intermediate points with smooth curve
  const steps = 12;
  const interpolated: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // slight curve offset
    const curveOffset = Math.sin(t * Math.PI) * 0.003;
    const lat = originLat + (destLat - originLat) * t + curveOffset;
    const lng = originLng + (destLng - originLng) * t - curveOffset;
    interpolated.push([lat, lng]);
  }

  return {
    coordinates: interpolated,
    distanceKm: roadDist,
    durationMinutes: durationMin,
    success: false,
  };
}
