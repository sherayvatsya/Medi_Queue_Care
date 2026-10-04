import {
  NearbyLabsResponse,
  LabCategory,
  InternalHospitalLab,
  NearbyLab,
} from '../../types';
import {
  REAL_HOSPITALS_NETWORK,
  PRIMARY_HOSPITAL_ID,
  calculateHaversineDistance,
  HospitalLocation,
} from '../../data/hospitalsData';
import {
  getInternalHospitalLab,
  findNearbyExternalLabs,
  VERIFIED_NEARBY_LABS,
} from '../../data/labsData';

interface GetNearbyLabsParams {
  hospitalId?: string;
  lat?: string | number;
  lng?: string | number;
  radius?: string | number;
  category?: string;
  openNow?: string | boolean;
  sortBy?: string;
}

/**
 * Modular service for finding internal hospital diagnostic labs and nearby external laboratories.
 * Implements:
 * 1. Prioritization of the booked hospital's internal laboratory (0 m / inside hospital)
 * 2. High-accuracy geolocation center with hospital-coordinate fallback
 * 3. Verified diagnostic centers with real distances, ratings, and operating hours
 * 4. Automatic radius expansion (5 km -> 10 km -> 20 km) when 0 results match
 * 5. Multi-category filtering (pathology, blood test, radiology, x-ray, ultrasound, CT, MRI, open now)
 */
export async function getNearbyLabsService(
  params: GetNearbyLabsParams
): Promise<NearbyLabsResponse> {
  const {
    hospitalId,
    lat,
    lng,
    radius = 5000,
    category = 'all',
    openNow = false,
    sortBy = 'distance',
  } = params;

  // 1. Resolve Booked Hospital from Database / Network
  // Security rule: When hospitalId is available, obtain authentic coordinates from database,
  // do not trust arbitrary hospital coordinates supplied by the frontend.
  let matchedHospital: HospitalLocation | undefined = undefined;

  if (hospitalId) {
    matchedHospital = REAL_HOSPITALS_NETWORK.find((h) => h.id === hospitalId);
    if (!matchedHospital) {
      // Try matching by lowercase name or partial ID
      const cleanId = hospitalId.toLowerCase().trim();
      matchedHospital = REAL_HOSPITALS_NETWORK.find(
        (h) =>
          h.id.toLowerCase().includes(cleanId) ||
          h.name.toLowerCase().includes(cleanId) ||
          h.shortName.toLowerCase().includes(cleanId)
      );
    }
  }

  // Fallback to primary hospital if hospitalId is not provided or not matched
  const hospital: HospitalLocation =
    matchedHospital ||
    REAL_HOSPITALS_NETWORK.find((h) => h.id === PRIMARY_HOSPITAL_ID) ||
    REAL_HOSPITALS_NETWORK[0];

  // 2. Resolve Internal Hospital Laboratory (Pathology, Blood tests, X-Ray, USG, CT, MRI)
  const internalLab: InternalHospitalLab | null =
    hospital.internalLab || getInternalHospitalLab(hospital.id, hospital.name);

  // 3. Resolve Search Center (User GPS coordinates vs. Booked Hospital coordinates fallback)
  let centerLat = hospital.lat;
  let centerLng = hospital.lng;
  let searchSource: 'user' | 'hospital' = 'hospital';
  let searchLabel = `${hospital.name} (Booked Hospital)`;

  const parsedLat = typeof lat === 'number' ? lat : parseFloat(String(lat));
  const parsedLng = typeof lng === 'number' ? lng : parseFloat(String(lng));

  if (!isNaN(parsedLat) && !isNaN(parsedLng) && parsedLat >= -90 && parsedLat <= 90 && parsedLng >= -180 && parsedLng <= 180) {
    centerLat = parsedLat;
    centerLng = parsedLng;
    searchSource = 'user';
    searchLabel = 'Your Current Location';
  }

  // Parse radius
  const parsedRadius = typeof radius === 'number' ? radius : parseInt(String(radius), 10) || 5000;
  const initialRadius = Math.max(1000, Math.min(parsedRadius, 50000));

  const isOpenNowBool = openNow === true || openNow === 'true' || openNow === '1';
  const cleanCategory = (category as LabCategory) || 'all';
  const cleanSort = (sortBy as 'distance' | 'rating' | 'open') || 'distance';

  // 4. Query Nearby External Laboratories
  const searchResult = findNearbyExternalLabs({
    centerLat,
    centerLng,
    radiusMeters: initialRadius,
    category: cleanCategory,
    openNowOnly: isOpenNowBool,
    sortBy: cleanSort,
  });

  let externalLabs = searchResult.labs;
  const effectiveRadius = searchResult.effectiveRadiusMeters;
  const autoExpanded = searchResult.autoExpanded;

  // 5. Build friendly descriptive message
  let message = `Found ${externalLabs.length} external ${
    externalLabs.length === 1 ? 'laboratory' : 'laboratories'
  } within ${(effectiveRadius / 1000).toFixed(0)} km of ${
    searchSource === 'user' ? 'your current location' : hospital.name
  }.`;

  if (autoExpanded) {
    message = `No labs found within ${(initialRadius / 1000).toFixed(0)} km. Automatically expanded search to ${(
      effectiveRadius / 1000
    ).toFixed(0)} km (${externalLabs.length} found).`;
  }

  if (searchSource === 'hospital') {
    message += ' Location permission was not provided; showing laboratories near your booked hospital.';
  }

  return {
    success: true,
    searchCenter: {
      lat: centerLat,
      lng: centerLng,
      source: searchSource,
      label: searchLabel,
    },
    searchRadiusMeters: effectiveRadius,
    initialRadiusMeters: initialRadius,
    autoExpandedRadius: autoExpanded,
    hospital: {
      id: hospital.id,
      name: hospital.name,
      shortName: hospital.shortName,
      address: hospital.address,
      lat: hospital.lat,
      lng: hospital.lng,
      city: hospital.city,
      location: hospital.location || {
        type: 'Point',
        coordinates: [hospital.lng, hospital.lat],
      },
    },
    internalLab,
    nearbyLabs: externalLabs,
    totalLabsFound: externalLabs.length + (internalLab ? 1 : 0),
    message,
  };
}
