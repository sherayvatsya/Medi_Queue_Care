import React, { useState, useEffect, useRef } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
  useMapsLibrary,
  useAdvancedMarkerRef,
} from '@vis.gl/react-google-maps';
import { playHospitalChime, playUrgentAlertSound } from '../utils/audio';
import { MapsGroundingAssistant } from './MapsGroundingAssistant';

// API Key resolution according to Google Maps Platform skill constitution
const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

export const hasValidGoogleMapsKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

// Hospital Campus Center Coordinates (Apollo / AIIMS Metro Health City Campus, New Delhi)
export const HOSPITAL_CENTER = { lat: 28.5672, lng: 77.2100 };

export interface HospitalPOI {
  id: string;
  name: string;
  category: 'er' | 'opd' | 'lab' | 'pharmacy' | 'parking' | 'transit' | 'entrance';
  lat: number;
  lng: number;
  description: string;
  floorInfo: string;
  hours: string;
  phone?: string;
  badge: string;
  pinBg: string;
  pinGlyph: string;
}

export const HOSPITAL_POIS: HospitalPOI[] = [
  {
    id: 'poi-er',
    name: '24/7 Emergency & Trauma Bay (Gate 2)',
    category: 'er',
    lat: 28.5679,
    lng: 77.2115,
    description: 'Code Red Acute Resuscitation, Ambulance Bay & 24/7 Emergency Casualty Desk.',
    floorInfo: 'Ground Floor, North Casualty Wing',
    hours: 'Open 24 Hours / 7 Days',
    phone: '+91 11 2658 8500 (ER Hotline)',
    badge: 'EMERGENCY RED',
    pinBg: '#ef4444',
    pinGlyph: '🚨',
  },
  {
    id: 'poi-opd-a',
    name: 'Main OPD Block A - Clinical Suites',
    category: 'opd',
    lat: 28.5670,
    lng: 77.2095,
    description: 'General Medicine, Pediatrics, Orthopedics (Room 204), and OPD Vitals & Triage.',
    floorInfo: 'Floors 1 - 3, Main Clinical Tower',
    hours: '08:00 AM - 08:00 PM',
    phone: '+91 11 2658 8700',
    badge: 'OPD BLOCK A',
    pinBg: '#0ea5e9',
    pinGlyph: '🏥',
  },
  {
    id: 'poi-opd-b',
    name: 'Specialty Surgical & Cardiology Tower (Block B)',
    category: 'opd',
    lat: 28.5663,
    lng: 77.2108,
    description: 'Cardiology, Neurology, Orthopedic East Annex (Room 208), Day Surgery Care.',
    floorInfo: 'Floors 2 - 5, Tower B',
    hours: '08:00 AM - 07:00 PM',
    phone: '+91 11 2658 8705',
    badge: 'SPECIALTY OPD',
    pinBg: '#8b5cf6',
    pinGlyph: '🩺',
  },
  {
    id: 'poi-lab',
    name: 'Diagnostic Pathology & Imaging Hub',
    category: 'lab',
    lat: 28.5675,
    lng: 77.2088,
    description: 'Fast-Track Pre-Consultation Blood Tests, Digital X-Ray, ECG & MRI Center.',
    floorInfo: 'Ground & Basement 1, Diagnostic Wing',
    hours: '06:30 AM - 10:00 PM',
    phone: '+91 11 2658 8910',
    badge: 'FAST-TRACK LAB',
    pinBg: '#06b6d4',
    pinGlyph: '🔬',
  },
  {
    id: 'poi-pharmacy',
    name: 'Apollo / AIIMS 24/7 Central Pharmacy & Blood Bank',
    category: 'pharmacy',
    lat: 28.5667,
    lng: 77.2118,
    description: 'Prescription dispensing, surgical consumables, emergency oxygen & 24/7 Blood Bank.',
    floorInfo: 'Ground Floor, Adjacent to Main Lobby',
    hours: 'Open 24/7',
    phone: '+91 11 2658 8800',
    badge: '24/7 PHARMACY',
    pinBg: '#10b981',
    pinGlyph: '💊',
  },
  {
    id: 'poi-parking',
    name: 'Multi-Level Patient & Visitor Parking (P1 & P2)',
    category: 'parking',
    lat: 28.5658,
    lng: 77.2090,
    description: '450 EV & Wheelchair-accessible parking spaces with direct ramp to Main Lobby.',
    floorInfo: 'P1 (Patients) & P2 (Valet)',
    hours: '24 Hours',
    phone: '+91 11 2658 8600',
    badge: 'PARKING P1',
    pinBg: '#64748b',
    pinGlyph: '🅿️',
  },
  {
    id: 'poi-transit',
    name: 'Health City Metro Station (Gate 3 Interchange)',
    category: 'transit',
    lat: 28.5684,
    lng: 77.2082,
    description: 'Direct air-conditioned pedestrian skywalk connection into Hospital Main Lobby.',
    floorInfo: 'Skywalk Level 1',
    hours: '05:30 AM - 11:30 PM',
    phone: 'Metro Info 155370',
    badge: 'METRO SKYWALK',
    pinBg: '#f59e0b',
    pinGlyph: '🚇',
  },
  {
    id: 'poi-entrance',
    name: 'Main Hospital Entrance & Reception Gate 1',
    category: 'entrance',
    lat: 28.5668,
    lng: 77.2085,
    description: 'Wheelchair porter desk, Self-service check-in kiosk bank & Helpdesk.',
    floorInfo: 'Lobby Level',
    hours: 'Open 24/7',
    phone: '+91 11 2658 8000',
    badge: 'MAIN GATE 1',
    pinBg: '#3b82f6',
    pinGlyph: '🚪',
  },
];

export const PRESET_ORIGINS = [
  { id: 'city_center', name: 'Connaught Place / New Delhi Center', coords: { lat: 28.6315, lng: 77.2167 }, distance: '~7.8 km' },
  { id: 'noida', name: 'Noida Sector 18 / Atta Market', coords: { lat: 28.5708, lng: 77.3271 }, distance: '~12.4 km' },
  { id: 'gurugram', name: 'Cyber City, Gurugram', coords: { lat: 28.4950, lng: 77.0895 }, distance: '~18.2 km' },
  { id: 'south_ext', name: 'South Extension Ring Road', coords: { lat: 28.5728, lng: 77.2223 }, distance: '~2.1 km' },
  { id: 'airport', name: 'IGI Airport Terminal 3', coords: { lat: 28.5562, lng: 77.1000 }, distance: '~14.5 km' },
];

interface HospitalGoogleMapProps {
  initialDestination?: 'er' | 'opd' | 'lab' | 'pharmacy';
  targetRoomNumber?: string;
  onShowToast?: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
  onSwitchToIndoorMap?: () => void;
}

// Inner Google Maps Controller using SDK Hooks
const MapController: React.FC<{
  selectedPoi: HospitalPOI | null;
  filteredPois: HospitalPOI[];
  onSelectPoi: (poi: HospitalPOI) => void;
  activeRoute: {
    origin: google.maps.LatLngLiteral;
    destination: google.maps.LatLngLiteral;
    travelMode: 'DRIVING' | 'WALKING' | 'TRANSIT';
  } | null;
  onRouteComputed?: (info: { distance: string; duration: string }) => void;
  searchNearbyQuery?: string;
}> = ({ selectedPoi, filteredPois, onSelectPoi, activeRoute, onRouteComputed, searchNearbyQuery }) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const placesLib = useMapsLibrary('places');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const [nearbyPlaces, setNearbyPlaces] = useState<google.maps.places.Place[]>([]);
  const [selectedNearbyPlace, setSelectedNearbyPlace] = useState<google.maps.places.Place | null>(null);

  // Markers with InfoWindow state
  const [activeMarkerRef, activeMarker] = useAdvancedMarkerRef();

  // Recenter map when selected POI changes
  useEffect(() => {
    if (map && selectedPoi) {
      map.panTo({ lat: selectedPoi.lat, lng: selectedPoi.lng });
      map.setZoom(17);
    }
  }, [map, selectedPoi]);

  // Compute Routes via Routes API
  useEffect(() => {
    if (!routesLib || !map || !activeRoute) return;

    // Clear previous polylines
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    routesLib.Route.computeRoutes({
      origin: activeRoute.origin,
      destination: activeRoute.destination,
      travelMode: activeRoute.travelMode,
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    })
      .then(({ routes }) => {
        if (routes && routes.length > 0) {
          const firstRoute = routes[0];
          const newPolylines = firstRoute.createPolylines();
          newPolylines.forEach((p) => {
            p.setOptions({
              strokeColor: activeRoute.travelMode === 'WALKING' ? '#10b981' : '#0ea5e9',
              strokeWeight: 5,
              strokeOpacity: 0.85,
            });
            p.setMap(map);
          });
          polylinesRef.current = newPolylines;

          if (firstRoute.viewport) {
            map.fitBounds(firstRoute.viewport);
          }

          if (onRouteComputed) {
            const distKm = ((firstRoute.distanceMeters || 0) / 1000).toFixed(1);
            const durMins = Math.ceil(((firstRoute.durationMillis || 0) as number) / 60000);
            onRouteComputed({
              distance: `${distKm} km`,
              duration: `${durMins} mins`,
            });
          }
        }
      })
      .catch((err) => {
        console.warn('Routes computation notice:', err);
      });

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
    };
  }, [routesLib, map, activeRoute]);

  // Places API (New) - Nearby Search / Text Search
  useEffect(() => {
    if (!placesLib || !searchNearbyQuery) {
      setNearbyPlaces([]);
      return;
    }

    placesLib.Place.searchByText({
      textQuery: searchNearbyQuery,
      fields: ['displayName', 'location', 'formattedAddress', 'rating', 'userRatingCount'],
      locationBias: map?.getCenter() || HOSPITAL_CENTER,
      maxResultCount: 6,
    })
      .then(({ places }) => {
        if (places) {
          setNearbyPlaces(places);
        }
      })
      .catch((err) => {
        console.warn('Places search notice:', err);
      });
  }, [placesLib, map, searchNearbyQuery]);

  return (
    <>
      {/* Hospital Campus POI Advanced Markers */}
      {filteredPois.map((poi) => {
        const isSelected = selectedPoi?.id === poi.id;
        return (
          <AdvancedMarker
            key={poi.id}
            position={{ lat: poi.lat, lng: poi.lng }}
            title={poi.name}
            onClick={() => onSelectPoi(poi)}
            gmpClickable={true}
          >
            <Pin
              background={poi.pinBg}
              borderColor="#ffffff"
              glyphColor="#ffffff"
              scale={isSelected ? 1.3 : 1.0}
            />
          </AdvancedMarker>
        );
      })}

      {/* Nearby Places Markers */}
      {nearbyPlaces.map((place) => {
        if (!place.location) return null;
        return (
          <AdvancedMarker
            key={place.id || Math.random().toString()}
            position={place.location}
            title={place.displayName || 'Medical Place'}
            onClick={() => setSelectedNearbyPlace(place)}
            gmpClickable={true}
          >
            <Pin background="#f59e0b" glyphColor="#ffffff" />
          </AdvancedMarker>
        );
      })}

      {/* Selected POI Info Window */}
      {selectedPoi && (
        <InfoWindow
          position={{ lat: selectedPoi.lat, lng: selectedPoi.lng }}
          onCloseClick={() => onSelectPoi(selectedPoi)}
          pixelOffset={[0, -35]}
        >
          <div className="p-1 max-w-[240px] text-[#0f172a]">
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                style={{ backgroundColor: selectedPoi.pinBg }}
              >
                {selectedPoi.badge}
              </span>
              <span className="text-[10px] text-[#64748b]">{selectedPoi.hours}</span>
            </div>
            <h4 className="font-bold text-xs leading-tight text-[#0f172a] mb-1">{selectedPoi.name}</h4>
            <p className="text-[11px] text-[#475569] leading-snug mb-1">{selectedPoi.description}</p>
            <p className="text-[10px] text-[#0ea5e9] font-medium mb-1.5">
              <i className="fa-solid fa-location-arrow mr-1"></i>
              {selectedPoi.floorInfo}
            </p>
            {selectedPoi.phone && (
              <a
                href={`tel:${selectedPoi.phone}`}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-[#16a34a] bg-[#dcfce7] px-2 py-0.5 rounded hover:bg-[#bbf7d0]"
              >
                <i className="fa-solid fa-phone text-[9px]"></i> {selectedPoi.phone}
              </a>
            )}
          </div>
        </InfoWindow>
      )}

      {/* Selected Nearby Place Info Window */}
      {selectedNearbyPlace && selectedNearbyPlace.location && (
        <InfoWindow
          position={selectedNearbyPlace.location}
          onCloseClick={() => setSelectedNearbyPlace(null)}
          pixelOffset={[0, -35]}
        >
          <div className="p-1 max-w-[220px] text-[#0f172a]">
            <span className="text-[9px] font-bold bg-[#fef3c7] text-[#b45309] px-1.5 py-0.5 rounded">
              Verified Place
            </span>
            <h4 className="font-bold text-xs mt-1 text-[#0f172a]">{selectedNearbyPlace.displayName}</h4>
            <p className="text-[10px] text-[#64748b] mt-0.5">{selectedNearbyPlace.formattedAddress}</p>
            {selectedNearbyPlace.rating && (
              <p className="text-[10px] text-[#f59e0b] font-bold mt-1">
                ★ {selectedNearbyPlace.rating} ({selectedNearbyPlace.userRatingCount || 0} reviews)
              </p>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
};

export const HospitalGoogleMap: React.FC<HospitalGoogleMapProps> = ({
  initialDestination = 'opd',
  targetRoomNumber = 'Room 204',
  onShowToast,
  onSwitchToIndoorMap,
}) => {
  // Category Filter
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedPoi, setSelectedPoi] = useState<HospitalPOI | null>(HOSPITAL_POIS[1]); // Default to OPD Block A
  
  // Directions / Routing State
  const [originPreset, setOriginPreset] = useState<string>(PRESET_ORIGINS[0].id);
  const [travelMode, setTravelMode] = useState<'DRIVING' | 'WALKING' | 'TRANSIT'>('DRIVING');
  const [isRoutingActive, setIsRoutingActive] = useState<boolean>(false);
  const [routeSummary, setRouteSummary] = useState<{ distance: string; duration: string } | null>(null);

  // Search Nearby State (Places API New)
  const [searchNearbyQuery, setSearchNearbyQuery] = useState<string>('');
  const [activeSearchTag, setActiveSearchTag] = useState<string>('');

  // Auto select initial destination POI
  useEffect(() => {
    if (initialDestination === 'er') {
      const erPoi = HOSPITAL_POIS.find((p) => p.category === 'er');
      if (erPoi) setSelectedPoi(erPoi);
    } else if (initialDestination === 'lab') {
      const labPoi = HOSPITAL_POIS.find((p) => p.category === 'lab');
      if (labPoi) setSelectedPoi(labPoi);
    }
  }, [initialDestination]);

  const notify = (title: string, desc: string, type: 'info' | 'success' | 'urgent' = 'info') => {
    if (onShowToast) {
      onShowToast(title, desc, type);
    }
  };

  // Filtered POIs
  const filteredPois = HOSPITAL_POIS.filter((p) => {
    if (activeCategory === 'all') return true;
    return p.category === activeCategory;
  });

  // Calculate active route parameters
  const currentOrigin = PRESET_ORIGINS.find((o) => o.id === originPreset)?.coords || PRESET_ORIGINS[0].coords;
  const currentDestination = selectedPoi
    ? { lat: selectedPoi.lat, lng: selectedPoi.lng }
    : HOSPITAL_CENTER;

  const activeRoute = isRoutingActive
    ? {
        origin: currentOrigin,
        destination: currentDestination,
        travelMode,
      }
    : null;

  // Trigger Driving Directions
  const handleComputeRoute = (mode: 'DRIVING' | 'WALKING' | 'TRANSIT' = travelMode) => {
    setTravelMode(mode);
    setIsRoutingActive(true);
    playHospitalChime();
    notify('Route Computed', `Calculating real-time ${mode.toLowerCase()} route to ${selectedPoi?.name || 'Hospital'}.`, 'info');
  };

  // 1-Click Code Red Emergency Ambulance Route
  const handleEmergencyRoute = () => {
    const erPoi = HOSPITAL_POIS.find((p) => p.category === 'er') || HOSPITAL_POIS[0];
    setSelectedPoi(erPoi);
    setActiveCategory('er');
    setTravelMode('DRIVING');
    setIsRoutingActive(true);
    playUrgentAlertSound();
    notify('🚨 Code Red Route', 'Priority Emergency Casualty Bay 2 (Ambulance Access) highlighted.', 'urgent');
  };

  // Dynamic search tags for Places API
  const handleSearchNearby = (tagQuery: string, label: string) => {
    if (activeSearchTag === label) {
      setActiveSearchTag('');
      setSearchNearbyQuery('');
    } else {
      setActiveSearchTag(label);
      setSearchNearbyQuery(tagQuery);
      playHospitalChime();
      notify('Places Search', `Finding nearby ${label} around Hospital Campus.`, 'info');
    }
  };

  // MANDATORY: Render Splash Screen when API key is missing
  if (!hasValidGoogleMapsKey) {
    return (
      <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 sm:p-8 shadow-xs max-w-2xl mx-auto my-4 text-[#334155]">
        <div className="text-center max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-[#e0f2fe] text-[#0ea5e9] flex items-center justify-center text-2xl mx-auto mb-3 shadow-xs">
            <i className="fa-solid fa-map-location-dot"></i>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-[#0f172a] tracking-tight">
            Google Maps API Key Required
          </h2>
          <p className="text-xs text-[#64748b] mt-1 leading-relaxed">
            To enable real-time city navigation, Google Maps campus routing, and 24/7 emergency pharmacy search, add your key:
          </p>

          <div className="mt-4 p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-left text-xs space-y-2.5">
            <p className="font-semibold text-[#0f172a] flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#0ea5e9] text-white flex items-center justify-center text-[10px] font-bold">1</span>
              <span>
                Get an API key:{' '}
                <a
                  href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0ea5e9] underline font-bold hover:text-[#0284c7]"
                >
                  Google Cloud Console Start
                </a>
              </span>
            </p>
            <p className="font-semibold text-[#0f172a] flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#0ea5e9] text-white flex items-center justify-center text-[10px] font-bold">2</span>
              <span>When the <strong>"Enter your environment variable to continue"</strong> popup appears, paste your API key and press <strong>Enter</strong>.</span>
            </p>
            <div className="pl-7 text-[11px] text-[#64748b]">
              <p className="font-medium text-[#475569]">Or manually configure:</p>
              <ul className="list-disc pl-4 space-y-1 mt-1">
                <li>Open <strong>Settings</strong> (⚙️ gear icon, top-right corner)</li>
                <li>Select <strong>Secrets</strong></li>
                <li>Type <code className="font-mono bg-[#e2e8f0] px-1 py-0.5 rounded text-[#0f172a]">GOOGLE_MAPS_PLATFORM_KEY</code> → <strong>Enter</strong></li>
                <li>Paste your API key → <strong>Enter</strong></li>
              </ul>
            </div>
            <p className="text-[11px] text-[#0ea5e9] font-medium pt-1 border-t border-[#e2e8f0]">
              ✨ The app rebuilds automatically after adding the secret — no page reload needed.
            </p>
          </div>

          {/* Interactive fallback button if indoor map is available */}
          {onSwitchToIndoorMap && (
            <div className="mt-4">
              <button
                type="button"
                onClick={onSwitchToIndoorMap}
                className="px-4 py-2 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-2"
              >
                <i className="fa-solid fa-compass"></i>
                <span>Open Indoor Hospital Floorplan (Offline Mode)</span>
              </button>
            </div>
          )}
        </div>

        {/* Live Maps Grounding Assistant */}
        <div className="mt-6 text-left">
          <MapsGroundingAssistant onShowToast={onShowToast} defaultOpen={true} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 text-[#334155]">
      {/* Top Banner with Real-Time Routing Control & POI Categories */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] p-3.5 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[#e2e8f0]">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-[#e0f2fe] text-[#0ea5e9] flex items-center justify-center text-sm font-bold">
                <i className="fa-solid fa-hospital"></i>
              </span>
              <div>
                <h3 className="text-sm font-bold text-[#0f172a]">
                  Hospital Campus & City Route Navigation
                </h3>
                <p className="text-[11px] text-[#64748b]">
                  Apollo / AIIMS Metro Health City Campus • Real-time traffic, entry gates & indoor sync
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleEmergencyRoute}
              className="px-3 py-1.5 rounded-lg bg-[#ef4444] hover:bg-[#dc2626] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer animate-pulse"
              title="Quick Code Red direct route to Emergency Casualty Bay"
            >
              <i className="fa-solid fa-truck-medical"></i>
              <span>Direct to ER Bay</span>
            </button>

            {onSwitchToIndoorMap && (
              <button
                type="button"
                onClick={onSwitchToIndoorMap}
                className="px-3 py-1.5 rounded-lg bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#334155] border border-[#e2e8f0] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                title="Switch to Indoor Room 204 floorplan"
              >
                <i className="fa-solid fa-stairs text-[#0ea5e9]"></i>
                <span>Indoor Floorplan</span>
              </button>
            )}
          </div>
        </div>

        {/* POI Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {[
            { id: 'all', label: 'All Campus Gates', icon: 'fa-map-pin' },
            { id: 'er', label: '🚨 Emergency Bay 2', icon: 'fa-triangle-exclamation' },
            { id: 'opd', label: '🏥 OPD & Clinical Towers', icon: 'fa-user-doctor' },
            { id: 'lab', label: '🔬 Diagnostic Labs', icon: 'fa-vial-virus' },
            { id: 'pharmacy', label: '💊 24/7 Pharmacy', icon: 'fa-pills' },
            { id: 'parking', label: '🅿️ Parking P1/P2', icon: 'fa-car' },
            { id: 'transit', label: '🚇 Metro Skywalk', icon: 'fa-train-subway' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setActiveCategory(cat.id);
                playHospitalChime();
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                activeCategory === cat.id
                  ? 'bg-[#0ea5e9] text-white shadow-xs'
                  : 'bg-[#f8fafc] text-[#64748b] border border-[#e2e8f0] hover:bg-[#f1f5f9]'
              }`}
            >
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Routes API Controller Bar */}
        <div className="p-3 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
          {/* Origin selector */}
          <div className="sm:col-span-4">
            <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1">
              Start Location (Patient Origin)
            </label>
            <select
              value={originPreset}
              onChange={(e) => {
                setOriginPreset(e.target.value);
                if (isRoutingActive) handleComputeRoute(travelMode);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#cbd5e1] text-xs text-[#0f172a] focus:outline-hidden focus:border-[#0ea5e9]"
            >
              {PRESET_ORIGINS.map((orig) => (
                <option key={orig.id} value={orig.id}>
                  {orig.name} ({orig.distance})
                </option>
              ))}
            </select>
          </div>

          {/* Destination Display */}
          <div className="sm:col-span-4">
            <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1">
              Destination Gate
            </label>
            <div className="px-2.5 py-1.5 rounded-lg bg-white border border-[#cbd5e1] text-xs font-semibold text-[#0ea5e9] truncate flex items-center gap-1.5">
              <i className="fa-solid fa-location-dot"></i>
              <span className="truncate">{selectedPoi?.name || 'Main OPD Block A'}</span>
            </div>
          </div>

          {/* Travel Mode & Action */}
          <div className="sm:col-span-4 flex items-center gap-1.5 pt-4 sm:pt-0">
            <div className="flex bg-white rounded-lg border border-[#cbd5e1] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => handleComputeRoute('DRIVING')}
                className={`p-1.5 rounded-md cursor-pointer transition ${
                  travelMode === 'DRIVING' && isRoutingActive ? 'bg-[#0ea5e9] text-white' : 'text-[#64748b] hover:text-[#0f172a]'
                }`}
                title="Driving route"
              >
                <i className="fa-solid fa-car"></i>
              </button>
              <button
                type="button"
                onClick={() => handleComputeRoute('TRANSIT')}
                className={`p-1.5 rounded-md cursor-pointer transition ${
                  travelMode === 'TRANSIT' && isRoutingActive ? 'bg-[#0ea5e9] text-white' : 'text-[#64748b] hover:text-[#0f172a]'
                }`}
                title="Transit route"
              >
                <i className="fa-solid fa-bus"></i>
              </button>
              <button
                type="button"
                onClick={() => handleComputeRoute('WALKING')}
                className={`p-1.5 rounded-md cursor-pointer transition ${
                  travelMode === 'WALKING' && isRoutingActive ? 'bg-[#0ea5e9] text-white' : 'text-[#64748b] hover:text-[#0f172a]'
                }`}
                title="Walking route"
              >
                <i className="fa-solid fa-person-walking"></i>
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleComputeRoute(travelMode)}
              className="flex-1 py-1.5 px-3 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <i className="fa-solid fa-route"></i>
              <span>{isRoutingActive ? 'Recalculate' : 'Get Directions'}</span>
            </button>
          </div>
        </div>

        {/* Live Route Calculated Metric Pill */}
        {routeSummary && isRoutingActive && (
          <div className="p-2.5 bg-[#e0f2fe] border border-[#bae6fd] rounded-lg text-xs flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#0369a1] font-semibold">
              <i className="fa-solid fa-circle-check text-[#0ea5e9]"></i>
              <span>
                Estimated Travel Time: <strong>{routeSummary.duration}</strong> ({routeSummary.distance}) via {travelMode.toLowerCase()}
              </span>
            </div>
            <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded text-[#0369a1] font-bold">
              Live Google Routes API
            </span>
          </div>
        )}
      </div>

      {/* Main Google Map Container */}
      <div className="relative w-full h-[460px] sm:h-[520px] rounded-xl overflow-hidden border border-[#cbd5e1] shadow-md bg-[#f1f5f9]">
        <APIProvider apiKey={API_KEY} version="weekly">
          <Map
            defaultCenter={HOSPITAL_CENTER}
            defaultZoom={16}
            mapId="DEMO_MAP_ID"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
            gestureHandling="greedy"
            disableDefaultUI={false}
          >
            <MapController
              selectedPoi={selectedPoi}
              filteredPois={filteredPois}
              onSelectPoi={(poi) => {
                setSelectedPoi(poi);
                playHospitalChime();
                if (isRoutingActive) {
                  // update route to new poi
                  setIsRoutingActive(true);
                }
              }}
              activeRoute={activeRoute}
              onRouteComputed={(info) => setRouteSummary(info)}
              searchNearbyQuery={searchNearbyQuery}
            />
          </Map>
        </APIProvider>

        {/* Floating Quick Search Bar (Places API New) */}
        <div className="absolute top-3 left-3 right-3 sm:right-auto sm:max-w-xs z-10 space-y-1.5">
          <div className="bg-white/95 backdrop-blur-md p-2 rounded-xl border border-[#cbd5e1] shadow-lg">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping"></span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#475569]">
                Nearby Campus Amenities (Places API)
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {[
                { tag: '24 hour pharmacy near hospital', label: '24/7 Chemist' },
                { tag: 'blood bank near hospital', label: 'Blood Bank' },
                { tag: 'diagnostic lab near hospital', label: 'Diagnostic Hub' },
                { tag: 'cafeteria food court near hospital', label: 'Cafeteria' },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => handleSearchNearby(btn.tag, btn.label)}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border transition cursor-pointer ${
                    activeSearchTag === btn.label
                      ? 'bg-[#f59e0b] text-white border-[#f59e0b]'
                      : 'bg-[#f8fafc] text-[#334155] border-[#e2e8f0] hover:bg-[#f1f5f9]'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Selected POI Floating Detail Card at Bottom */}
        {selectedPoi && (
          <div className="absolute bottom-3 left-3 right-3 z-10">
            <div className="bg-white/95 backdrop-blur-md p-3.5 rounded-xl border border-[#cbd5e1] shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-xs"
                  style={{ backgroundColor: selectedPoi.pinBg }}
                >
                  {selectedPoi.pinGlyph}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-xs sm:text-sm text-[#0f172a]">{selectedPoi.name}</h4>
                    <span
                      className="text-[9px] font-bold px-2 py-0.2 rounded-full text-white"
                      style={{ backgroundColor: selectedPoi.pinBg }}
                    >
                      {selectedPoi.badge}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748b] mt-0.5">{selectedPoi.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {selectedPoi.phone && (
                  <a
                    href={`tel:${selectedPoi.phone}`}
                    className="px-3 py-1.5 rounded-lg bg-[#dcfce7] hover:bg-[#bbf7d0] text-[#166534] text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <i className="fa-solid fa-phone"></i>
                    <span>Call Hotline</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => handleComputeRoute('DRIVING')}
                  className="px-3 py-1.5 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <i className="fa-solid fa-location-arrow"></i>
                  <span>Drive Here</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* POI Directory Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
        {HOSPITAL_POIS.slice(0, 4).map((poi) => (
          <div
            key={poi.id}
            onClick={() => {
              setSelectedPoi(poi);
              playHospitalChime();
            }}
            className={`p-3 rounded-xl border transition-all cursor-pointer text-left ${
              selectedPoi?.id === poi.id
                ? 'bg-[#e0f2fe] border-[#0ea5e9] shadow-xs'
                : 'bg-white border-[#e2e8f0] hover:border-[#cbd5e1]'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-base">{poi.pinGlyph}</span>
              <span
                className="text-[9px] font-bold px-1.5 py-0.2 rounded text-white"
                style={{ backgroundColor: poi.pinBg }}
              >
                {poi.badge}
              </span>
            </div>
            <h5 className="font-bold text-xs text-[#0f172a] truncate">{poi.name}</h5>
            <p className="text-[11px] text-[#64748b] mt-0.5 line-clamp-1">{poi.floorInfo}</p>
          </div>
        ))}
      </div>

      {/* Real-time Google Maps Grounding Assistant with Gemini & verified Maps Links */}
      <div className="pt-2">
        <MapsGroundingAssistant onShowToast={onShowToast} defaultOpen={true} />
      </div>
    </div>
  );
};
