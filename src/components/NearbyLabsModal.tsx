import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Patient,
  NearbyLab,
  InternalHospitalLab,
  NearbyLabsResponse,
  LabCategory,
} from '../types';
import {
  REAL_HOSPITALS_NETWORK,
  PRIMARY_HOSPITAL_ID,
  calculateHaversineDistance,
  HospitalLocation,
} from '../data/hospitalsData';
import {
  getInternalHospitalLab,
  findNearbyExternalLabs,
  VERIFIED_NEARBY_LABS,
} from '../data/labsData';
import { playHospitalChime } from '../utils/audio';

declare global {
  interface Window {
    L: any;
  }
}

interface NearbyLabsModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Patient;
  onShowToast?: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
}

export const NearbyLabsModal: React.FC<NearbyLabsModalProps> = ({
  isOpen,
  onClose,
  booking,
  onShowToast,
}) => {
  // Synchronous resolution of initial hospital data for 0ms instant loading
  const initialHospital = React.useMemo(() => {
    return (
      REAL_HOSPITALS_NETWORK.find((h) => h.id === booking?.hospitalId) ||
      REAL_HOSPITALS_NETWORK.find((h) => booking?.hospitalName && h.name.toLowerCase().includes(booking.hospitalName.toLowerCase())) ||
      REAL_HOSPITALS_NETWORK.find((h) => h.id === PRIMARY_HOSPITAL_ID) ||
      REAL_HOSPITALS_NETWORK[0]
    );
  }, [booking?.hospitalId, booking?.hospitalName]);

  const initialInternal = React.useMemo(() => {
    return initialHospital.internalLab || getInternalHospitalLab(initialHospital.id, initialHospital.name);
  }, [initialHospital]);

  const initialLabsResult = React.useMemo(() => {
    return findNearbyExternalLabs({
      centerLat: initialHospital.lat,
      centerLng: initialHospital.lng,
      radiusMeters: 5000,
      category: 'all',
      openNowOnly: false,
      sortBy: 'distance',
    });
  }, [initialHospital]);

  // Geolocation & Fallback states
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocatingUser, setIsLocatingUser] = useState<boolean>(false);
  const [locationDenied, setLocationDenied] = useState<boolean>(false);
  const [locationNotice, setLocationNotice] = useState<string>('');

  // API response data — Instant Optimistic Initialization so 0ms wait time
  const [isLoading, setIsLoading] = useState<boolean>(false);     // Instant load!
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false); // background sync
  const [apiError, setApiError] = useState<string | null>(null);
  const [internalLab, setInternalLab] = useState<InternalHospitalLab | null>(() => initialInternal);
  const [allFetchedLabs, setAllFetchedLabs] = useState<NearbyLab[]>(() => initialLabsResult.labs);
  const [searchCenter, setSearchCenter] = useState<{
    lat: number;
    lng: number;
    source: 'user' | 'hospital';
    label: string;
  }>(() => ({
    lat: initialHospital.lat,
    lng: initialHospital.lng,
    source: 'hospital',
    label: `${initialHospital.name} (Booked Hospital)`,
  }));
  const [autoExpanded, setAutoExpanded] = useState<boolean>(false);

  // Filters & Controls
  const [selectedRadius, setSelectedRadius] = useState<number>(5000); // 5km default
  const [selectedCategory, setSelectedCategory] = useState<LabCategory | 'all'>('all');
  const [openNowOnly, setOpenNowOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'open'>('distance');

  // Client-side filtered + sorted labs — instant, no API call needed
  const nearbyLabs = React.useMemo(() => {
    let labs = [...allFetchedLabs];

    // Category filter
    if (selectedCategory !== 'all') {
      labs = labs.filter((lab) => {
        if (selectedCategory === 'blood_test')
          return lab.categories.includes('blood_test') || lab.services.some(s => s.toLowerCase().includes('blood'));
        if (selectedCategory === 'pathology')
          return lab.categories.includes('pathology') || lab.services.some(s => s.toLowerCase().includes('pathology'));
        if (selectedCategory === 'radiology')
          return lab.categories.includes('radiology') || lab.services.some(s => s.toLowerCase().includes('radiology'));
        if (selectedCategory === 'xray')
          return lab.categories.includes('xray') || lab.services.some(s => s.toLowerCase().includes('x-ray'));
        if (selectedCategory === 'ultrasound')
          return lab.categories.includes('ultrasound') || lab.services.some(s => s.toLowerCase().includes('ultrasound'));
        if (selectedCategory === 'ct_scan')
          return lab.categories.includes('ct_scan') || lab.services.some(s => s.toLowerCase().includes('ct'));
        if (selectedCategory === 'mri')
          return lab.categories.includes('mri') || lab.services.some(s => s.toLowerCase().includes('mri'));
        return lab.categories.includes(selectedCategory as LabCategory);
      });
    }

    // Open Now filter
    if (openNowOnly) {
      labs = labs.filter(lab => lab.isOpen);
    }

    // Sort
    if (sortBy === 'rating') {
      labs.sort((a, b) => b.rating - a.rating || a.distanceMeters - b.distanceMeters);
    } else if (sortBy === 'open') {
      labs.sort((a, b) => (b.isOpen === a.isOpen ? a.distanceMeters - b.distanceMeters : b.isOpen ? 1 : -1));
    } else {
      labs.sort((a, b) => a.distanceMeters - b.distanceMeters);
    }

    return labs;
  }, [allFetchedLabs, selectedCategory, openNowOnly, sortBy]);

  // Selected Lab for Detailed Modal Popup
  const [selectedLabDetails, setSelectedLabDetails] = useState<
    NearbyLab | InternalHospitalLab | null
  >(null);

  // Leaflet map refs & readiness
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const [isLeafletReady, setIsLeafletReady] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'split' | 'map' | 'list'>('split');

  const notify = useCallback(
    (title: string, desc: string, type: 'info' | 'success' | 'urgent' = 'info') => {
      if (onShowToast) {
        onShowToast(title, desc, type);
      }
    },
    [onShowToast]
  );

  // Ensure Leaflet is loaded in DOM
  useEffect(() => {
    if (!isOpen) return;

    if (window.L) {
      setIsLeafletReady(true);
      return;
    }

    if (!document.getElementById('leaflet-css-bundle')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css-bundle';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!document.getElementById('leaflet-js-bundle')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js-bundle';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => {
        if (window.L) setIsLeafletReady(true);
      };
      document.body.appendChild(script);
    } else {
      const checkTimer = setInterval(() => {
        if (window.L) {
          setIsLeafletReady(true);
          clearInterval(checkTimer);
        }
      }, 100);
      return () => clearInterval(checkTimer);
    }
  }, [isOpen]);

  // Request browser location permission strictly on user action when opening Nearby Labs
  const requestUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationDenied(true);
      setLocationNotice('Geolocation is not supported by your browser. Showing laboratories near your booked hospital.');
      return;
    }

    setIsLocatingUser(true);
    setLocationNotice('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocatingUser(false);
        setLocationDenied(false);
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationNotice('Location access granted. Showing laboratories near your current GPS position.');
        notify('Location Acquired', 'Finding nearby laboratories around your current location.', 'success');
      },
      (error) => {
        setIsLocatingUser(false);
        setLocationDenied(true);
        // Fallback to booked hospital coordinates
        setLocationNotice(
          'Location permission was not provided. Showing laboratories near your booked hospital.'
        );
      },
      {
        enableHighAccuracy: false,
        timeout: 3500,
        maximumAge: 120000,
      }
    );
  }, [notify]);

  // Request location when modal opens for the first time
  useEffect(() => {
    if (isOpen) {
      requestUserLocation();
    }
  }, [isOpen, requestUserLocation]);

  // Fetch all labs from backend API (only re-runs when location or radius changes)
  // Category/sort/openNow filtering is done client-side instantly via useMemo above
  const abortRef = useRef<AbortController | null>(null);

  const fetchNearbyLabs = useCallback(async () => {
    // Cancel any previous in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setIsRefreshing(true);
    setApiError(null);

    try {
      const queryParams = new URLSearchParams();
      if (booking.hospitalId) queryParams.set('hospitalId', booking.hospitalId);
      if (userLocation) {
        queryParams.set('lat', userLocation.lat.toString());
        queryParams.set('lng', userLocation.lng.toString());
      }
      // Send 'all' category to get full list — client-side filtering handles the rest instantly
      queryParams.set('radius', selectedRadius.toString());
      queryParams.set('sortBy', 'distance');

      const res = await fetch(`/api/labs/nearby?${queryParams.toString()}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to retrieve nearby laboratories.`);
      }

      const data: NearbyLabsResponse = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to load laboratory data.');
      }

      if (data.internalLab) setInternalLab(data.internalLab);
      if (data.nearbyLabs && data.nearbyLabs.length > 0) {
        setAllFetchedLabs(data.nearbyLabs);
      }
      if (data.searchCenter) setSearchCenter(data.searchCenter);
      setAutoExpanded(Boolean(data.autoExpandedRadius));
    } catch (err: any) {
      // Silently ignore aborted requests — a newer fetch is already in progress
      if (err?.name === 'AbortError') return;
      console.warn('Nearby labs fetch error:', err);
    } finally {
      // Only reset loading if this controller is still the active one
      if (abortRef.current === controller) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [booking.hospitalId, userLocation, selectedRadius]);

  // Refetch when location or radius changes
  useEffect(() => {
    if (isOpen) {
      fetchNearbyLabs();
    }
    // Cleanup: abort any pending fetch when modal closes
    return () => {
      abortRef.current?.abort();
    };
  }, [isOpen, fetchNearbyLabs]);

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (!isOpen || !isLeafletReady || !mapContainerRef.current) return;
    const L = window.L;
    if (!L) return;

    const initialCenterLat = searchCenter?.lat || 30.7248;
    const initialCenterLng = searchCenter?.lng || 76.7213;

    // Create map instance if not existing
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([initialCenterLat, initialCenterLng], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapInstanceRef.current = map;
      markersLayerRef.current = L.layerGroup().addTo(map);
    }

    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;

    // Clear previous markers
    markersLayer.clearLayers();

    const bounds: [number, number][] = [];

    // Helper: Create custom styled marker
    const createCustomIcon = (bgColor: string, iconClass: string, label?: string) => {
      return L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%);">
            <div style="background:${bgColor}; color:white; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 8px rgba(0,0,0,0.3); border:2.5px solid white;">
              <i class="${iconClass}" style="font-size:14px;"></i>
            </div>
            <div style="width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:8px solid ${bgColor}; margin-top:-1px;"></div>
            ${label ? `<div style="background:white; color:#0f172a; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px; margin-top:2px; box-shadow:0 1px 4px rgba(0,0,0,0.2); white-space:nowrap; border:1px solid #cbd5e1;">${label}</div>` : ''}
          </div>
        `,
        iconSize: [34, 42],
        iconAnchor: [17, 42],
        popupAnchor: [0, -42],
      });
    };

    // 1. Patient / Current Location Marker (if permission granted)
    if (userLocation) {
      bounds.push([userLocation.lat, userLocation.lng]);
      const userIcon = L.divIcon({
        className: 'user-pulse-marker',
        html: `
          <div style="position:relative; width:24px; height:24px;">
            <div style="position:absolute; width:24px; height:24px; background:rgba(14,165,233,0.35); border-radius:50%; animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="position:absolute; top:4px; left:4px; width:16px; height:16px; background:#0284c7; border:3px solid white; border-radius:50%; box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(markersLayer);
      userMarker.bindPopup(`
        <div style="font-family:sans-serif; padding:4px;">
          <strong style="color:#0369a1; font-size:12px; display:block;">📍 Your Location</strong>
          <span style="font-size:11px; color:#475569;">Used to calculate lab distances.</span>
        </div>
      `);
    }

    // 2. Booked Hospital Marker
    if (searchCenter && searchCenter.source === 'hospital') {
      bounds.push([searchCenter.lat, searchCenter.lng]);
      const hospIcon = createCustomIcon('#0369a1', 'fa-solid fa-hospital', booking.hospitalName || 'Hospital');
      const hospMarker = L.marker([searchCenter.lat, searchCenter.lng], { icon: hospIcon }).addTo(markersLayer);
      hospMarker.bindPopup(`
        <div style="font-family:sans-serif; padding:4px; min-width:180px;">
          <span style="font-size:10px; font-weight:800; color:#0369a1; text-transform:uppercase;">Booked Hospital</span>
          <strong style="font-size:13px; color:#0f172a; display:block; margin:2px 0;">${booking.hospitalName || 'Booked Hospital'}</strong>
          <p style="font-size:11px; color:#475569; margin:0 0 6px 0;">${booking.hospitalAddress || ''}</p>
        </div>
      `);
    }

    // 3. Hospital Internal Laboratory Marker (Prioritized Emerald Pin)
    if (internalLab && searchCenter) {
      // Offset slightly from hospital main center for distinct visual identity
      const internalLabLat = searchCenter.lat + 0.0004;
      const internalLabLng = searchCenter.lng + 0.0004;
      bounds.push([internalLabLat, internalLabLng]);

      const internalIcon = createCustomIcon('#059669', 'fa-solid fa-flask-vial', 'Hospital Lab');
      const internalMarker = L.marker([internalLabLat, internalLabLng], { icon: internalIcon }).addTo(markersLayer);

      internalMarker.bindPopup(`
        <div style="font-family:sans-serif; padding:4px; min-width:200px;">
          <span style="font-size:10px; font-weight:bold; color:#059669; text-transform:uppercase; background:#ecfdf5; padding:2px 6px; border-radius:4px; display:inline-block; margin-bottom:4px;">
            🏥 Inside Your Hospital
          </span>
          <strong style="font-size:13px; color:#0f172a; display:block;">${internalLab.name}</strong>
          <p style="font-size:11px; color:#475569; margin:3px 0 6px 0;">Distance: <strong>0 m (Inside Hospital)</strong></p>
          <div style="font-size:10px; color:#047857; margin-bottom:8px;">
            ✓ Pathology • Blood Tests • X-Ray • Ultrasound • CT/MRI
          </div>
        </div>
      `);
    }

    // 4. Nearby External Laboratories Markers (Purple/Sky Pin)
    nearbyLabs.forEach((lab) => {
      bounds.push([lab.lat, lab.lng]);
      const labIcon = createCustomIcon('#7c3aed', 'fa-solid fa-flask', `${lab.distanceKm} km`);
      const marker = L.marker([lab.lat, lab.lng], { icon: labIcon }).addTo(markersLayer);

      const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${
        userLocation ? `${userLocation.lat},${userLocation.lng}` : `${searchCenter?.lat},${searchCenter?.lng}`
      }&destination=${lab.lat},${lab.lng}`;

      marker.bindPopup(`
        <div style="font-family:sans-serif; padding:4px; min-width:190px;">
          <strong style="font-size:13px; color:#0f172a; display:block;">${lab.name}</strong>
          <div style="display:flex; align-items:center; gap:6px; font-size:11px; color:#475569; margin:3px 0;">
            <span style="color:#d97706; font-weight:bold;">★ ${lab.rating}</span>
            <span>•</span>
            <span>${lab.distanceKm} km away</span>
            <span>•</span>
            <span style="color:${lab.isOpen ? '#059669' : '#dc2626'}; font-weight:600;">${lab.isOpen ? 'Open' : 'Closed'}</span>
          </div>
          <p style="font-size:11px; color:#64748b; margin:2px 0 8px 0;">${lab.address}</p>
          <div style="display:flex; gap:6px;">
            <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" style="flex:1; background:#0284c7; color:white; text-decoration:none; text-align:center; padding:5px 8px; border-radius:6px; font-size:11px; font-weight:bold;">
              Get Directions
            </a>
          </div>
        </div>
      `);
    });

    // Fit map bounds to encompass all points comfortably
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [isOpen, isLeafletReady, searchCenter, userLocation, internalLab, nearbyLabs, booking]);

  // Center on hospital lab
  const handleCenterOnHospital = () => {
    if (mapInstanceRef.current && searchCenter) {
      mapInstanceRef.current.setView([searchCenter.lat, searchCenter.lng], 16);
      playHospitalChime();
    }
  };

  // Center on user location
  const handleCenterOnUser = () => {
    if (!userLocation) {
      requestUserLocation();
    } else if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 16);
      playHospitalChime();
    }
  };

  // Focus a specific lab on map
  const handleFocusLabOnMap = (lab: NearbyLab) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lab.lat, lab.lng], 16);
      playHospitalChime();
      if (activeTab === 'list') {
        setActiveTab('map');
      }
    }
  };

  // Helper to construct directions URL
  const getDirectionsUrl = (destLat: number, destLng: number) => {
    const originLat = userLocation?.lat || searchCenter?.lat || booking.hospitalId;
    const originLng = userLocation?.lng || searchCenter?.lng;
    if (userLocation) {
      return `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${destLat},${destLng}`;
    }
    if (searchCenter) {
      return `https://www.google.com/maps/dir/?api=1&origin=${searchCenter.lat},${searchCenter.lng}&destination=${destLat},${destLng}`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-slate-50 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-5xl h-[92vh] max-h-[900px] flex flex-col overflow-hidden text-left">
        {/* 1. TOP HEADER & PRIVACY BANNER */}
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition cursor-pointer"
              title="Return to appointment"
            >
              <i className="fa-solid fa-arrow-left text-sm"></i>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <i className="fa-solid fa-flask-vial text-sky-600"></i>
                  <span>Labs Near You</span>
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full">
                  Diagnostic Centers
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Pathology, blood tests, and medical imaging facilities near your booked hospital.
              </p>
            </div>
          </div>

          {/* Privacy Notice Pill */}
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] text-slate-600">
              <i className="fa-solid fa-shield-halved text-emerald-600"></i>
              <span>Your location is used only to find nearby laboratories and is not stored.</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-2 rounded-lg text-base cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 2. APPOINTMENT SUMMARY BANNER */}
        <div className="bg-gradient-to-r from-sky-500/10 via-cyan-500/10 to-emerald-500/10 border-b border-sky-200/80 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
              <i className="fa-solid fa-hospital text-sky-600"></i>
              <span>{booking.hospitalName || 'Booked Hospital'}</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-700">
              {booking.department} ({booking.doctorName})
            </span>
            <span className="text-slate-300">•</span>
            <span className="font-medium text-slate-700">
              {booking.appointmentDate || 'Today'} • {booking.appointmentTime || '10:30 AM'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold bg-white px-2.5 py-0.5 rounded-md border border-slate-200 text-slate-800 shadow-2xs">
              Token: {booking.tokenNumber}
            </span>
          </div>
        </div>

        {/* 3. LOCATION NOTIFICATION / FALLBACK NOTICE */}
        {locationDenied && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2 flex items-center justify-between text-xs text-amber-900 animate-in fade-in">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-location-dot text-amber-600 shrink-0"></i>
              <span>
                <strong>Hospital Search Mode:</strong> Location permission was not provided. Showing laboratories near your booked hospital.
              </span>
            </div>
            <button
              type="button"
              onClick={requestUserLocation}
              disabled={isLocatingUser}
              className="text-xs font-bold text-sky-700 hover:text-sky-800 underline cursor-pointer shrink-0 ml-2"
            >
              {isLocatingUser ? 'Locating…' : 'Enable Location'}
            </button>
          </div>
        )}

        {/* 4. CONTROLS TOOLBAR (Quick Center, Radius, Categories, Sort) */}
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
          {/* Quick Center Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCenterOnUser}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Center map on your current GPS location"
            >
              <i className="fa-solid fa-compass text-sky-600"></i>
              <span>Near Me</span>
            </button>

            <button
              type="button"
              onClick={handleCenterOnHospital}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Focus on booked hospital's internal lab"
            >
              <i className="fa-solid fa-hospital-user text-emerald-600"></i>
              <span>Hospital Lab</span>
            </button>

            {/* Radius Selector — always visible */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold text-slate-700">
              {[5000, 10000, 20000].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedRadius(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    selectedRadius === r
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {r / 1000} km
                </button>
              ))}
            </div>
          </div>

          {/* Sort Selector & Mobile Tab Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-medium hidden sm:inline">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'distance' | 'rating' | 'open')}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-hidden cursor-pointer"
              >
                <option value="distance">Nearest</option>
                <option value="rating">Highest Rated</option>
                <option value="open">Open Now</option>
              </select>
            </div>

            {/* View Mode Toggle (Mobile / Responsive) */}
            <div className="flex lg:hidden bg-slate-100 p-0.5 rounded-lg text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className={`px-2 py-1 rounded-md transition ${activeTab === 'list' ? 'bg-white text-sky-700 shadow-2xs' : 'text-slate-500'}`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('map')}
                className={`px-2 py-1 rounded-md transition ${activeTab === 'map' ? 'bg-white text-sky-700 shadow-2xs' : 'text-slate-500'}`}
              >
                Map
              </button>
            </div>
          </div>
        </div>

        {/* 5. CATEGORY FILTER CHIPS — client-side instant filtering */}
        <div className="bg-slate-100/70 border-b border-slate-200 px-4 sm:px-6 py-2 overflow-x-auto flex items-center gap-1.5 text-xs scrollbar-none">
          {[
            { id: 'all', label: 'All Services', icon: 'fa-layer-group' },
            { id: 'pathology', label: 'Pathology', icon: 'fa-microscope' },
            { id: 'blood_test', label: 'Blood Test', icon: 'fa-vial' },
            { id: 'radiology', label: 'Radiology', icon: 'fa-x-ray' },
            { id: 'xray', label: 'X-Ray', icon: 'fa-film' },
            { id: 'ultrasound', label: 'Ultrasound', icon: 'fa-wave-square' },
            { id: 'ct_scan', label: 'CT Scan', icon: 'fa-circle-notch' },
            { id: 'mri', label: 'MRI', icon: 'fa-magnet' },
          ].map((cat) => {
            // Count matching labs for each category to show badge
            const count = cat.id === 'all'
              ? allFetchedLabs.length
              : allFetchedLabs.filter(lab => {
                  if (cat.id === 'blood_test') return lab.categories.includes('blood_test') || lab.services.some(s => s.toLowerCase().includes('blood'));
                  if (cat.id === 'pathology') return lab.categories.includes('pathology') || lab.services.some(s => s.toLowerCase().includes('pathology'));
                  if (cat.id === 'radiology') return lab.categories.includes('radiology') || lab.services.some(s => s.toLowerCase().includes('radiology'));
                  if (cat.id === 'xray') return lab.categories.includes('xray') || lab.services.some(s => s.toLowerCase().includes('x-ray'));
                  if (cat.id === 'ultrasound') return lab.categories.includes('ultrasound') || lab.services.some(s => s.toLowerCase().includes('ultrasound'));
                  if (cat.id === 'ct_scan') return lab.categories.includes('ct_scan') || lab.services.some(s => s.toLowerCase().includes('ct'));
                  if (cat.id === 'mri') return lab.categories.includes('mri') || lab.services.some(s => s.toLowerCase().includes('mri'));
                  return lab.categories.includes(cat.id as LabCategory);
                }).length;
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.id as LabCategory | 'all');
                  playHospitalChime();
                }}
                className={`px-3 py-1 rounded-full font-bold whitespace-nowrap text-xs transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-sm scale-105 ring-2 ring-sky-300'
                    : count === 0
                    ? 'bg-white text-slate-400 border border-slate-200 opacity-50 cursor-not-allowed'
                    : 'bg-white hover:bg-sky-50 hover:border-sky-300 hover:text-sky-700 text-slate-700 border border-slate-200'
                }`}
                disabled={count === 0 && !isLoading}
              >
                <i className={`fa-solid ${cat.icon} text-[10px]`}></i>
                <span>{cat.label}</span>
                {!isLoading && count > 0 && (
                  <span className={`text-[9px] font-black px-1 py-0 rounded-full ml-0.5 ${
                    isActive ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>{count}</span>
                )}
              </button>
            );
          })}

          {/* Open Now Toggle Chip */}
          <button
            type="button"
            onClick={() => {
              setOpenNowOnly(!openNowOnly);
              playHospitalChime();
            }}
            className={`px-3 py-1 rounded-full font-bold whitespace-nowrap text-xs transition-all duration-150 cursor-pointer flex items-center gap-1.5 ml-auto ${
              openNowOnly
                ? 'bg-emerald-600 text-white shadow-sm scale-105 ring-2 ring-emerald-300'
                : 'bg-white hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 text-slate-700 border border-slate-200'
            }`}
          >
            <i className="fa-solid fa-clock text-[10px]"></i>
            <span>Open Now</span>
            {!isLoading && (
              <span className={`text-[9px] font-black px-1 py-0 rounded-full ml-0.5 ${
                openNowOnly ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
              }`}>{allFetchedLabs.filter(l => l.isOpen).length}</span>
            )}
          </button>
        </div>

        {/* 6. MAIN BODY: SPLIT VIEW (MAP + LABS LIST) */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* LEFT COLUMN: LABORATORIES DIRECTORY LIST */}
          <div
            className={`w-full lg:w-1/2 flex flex-col overflow-y-auto p-4 sm:p-5 space-y-4 ${
              activeTab === 'map' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Auto-expansion Banner if triggered */}
            {autoExpanded && (
              <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-center gap-2">
                <i className="fa-solid fa-arrows-maximize text-sky-600 shrink-0"></i>
                <span>No labs found within 5 km. Automatically expanded search radius to 10 km.</span>
              </div>
            )}

            {/* SECTION 1: PRIORITY HOSPITAL INTERNAL LABORATORY */}
            {internalLab && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <i className="fa-solid fa-hospital-user text-emerald-600"></i>
                    <span>🧪 LABS AT YOUR HOSPITAL</span>
                  </h3>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-300">
                    Inside Your Hospital
                  </span>
                </div>

                <div className="rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-teal-50/60 border-2 border-emerald-400 p-4 sm:p-5 shadow-xs hover:shadow-md transition space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                          <i className="fa-solid fa-flask-vial"></i>
                        </span>
                        <div>
                          <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                            {internalLab.name}
                          </h4>
                          <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                            <i className="fa-solid fa-location-dot text-[11px]"></i>
                            <span>0 m • Inside hospital ({internalLab.locationDetails})</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-1 text-xs font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        ★ {internalLab.rating}
                      </span>
                    </div>
                  </div>

                  {/* Available internal services checkboxes/tags */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs text-slate-700 pt-1">
                    <span className="flex items-center gap-1 font-semibold text-emerald-900">
                      <i className="fa-solid fa-check text-emerald-600 text-[10px]"></i> Pathology
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-emerald-900">
                      <i className="fa-solid fa-check text-emerald-600 text-[10px]"></i> Blood Tests
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-emerald-900">
                      <i className="fa-solid fa-check text-emerald-600 text-[10px]"></i> Urine Tests
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-emerald-900">
                      <i className="fa-solid fa-check text-emerald-600 text-[10px]"></i> Digital X-Ray
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-emerald-900">
                      <i className="fa-solid fa-check text-emerald-600 text-[10px]"></i> Ultrasound
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-emerald-900">
                      <i className="fa-solid fa-check text-emerald-600 text-[10px]"></i> CT Scan & MRI
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-emerald-200">
                    <span className="text-[11px]">
                      <i className="fa-regular fa-clock mr-1 text-emerald-600"></i>
                      {internalLab.operatingHours}
                    </span>

                    <button
                      type="button"
                      onClick={() => setSelectedLabDetails(internalLab)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-eye text-xs"></i>
                      <span>View Lab Details</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 2: NEARBY EXTERNAL LABORATORIES */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <i className="fa-solid fa-map-location-dot text-slate-400"></i>
                  <span>🧪 NEARBY LABS ({nearbyLabs.length}{(selectedCategory !== 'all' || openNowOnly) && !isLoading ? ` of ${allFetchedLabs.length}` : ''})</span>
                </h3>
                <div className="flex items-center gap-2">
                  {(selectedCategory !== 'all' || openNowOnly) && !isLoading && (
                    <button
                      type="button"
                      onClick={() => { setSelectedCategory('all'); setOpenNowOnly(false); playHospitalChime(); }}
                      className="text-[10px] font-bold text-sky-600 hover:text-sky-800 underline cursor-pointer flex items-center gap-0.5"
                    >
                      <i className="fa-solid fa-xmark text-[9px]"></i> Clear
                    </button>
                  )}
                  <span className="text-[11px] text-slate-400">Sorted by {sortBy}</span>
                </div>
              </div>

              {/* Refreshing indicator (background refetch — data already visible) */}
              {isRefreshing && allFetchedLabs.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-700 animate-in fade-in">
                  <svg className="animate-spin w-3 h-3 text-sky-500 shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  <span className="font-semibold">Updating with your GPS location…</span>
                </div>
              )}

              {/* Initial Loading Skeleton — only shown when no data exists yet */}
              {isLoading && allFetchedLabs.length === 0 && (
                <div className="space-y-3 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                      <div className="h-3 bg-slate-100 rounded w-3/4"></div>
                      <div className="h-3 bg-slate-100 rounded w-1/4"></div>
                    </div>
                  ))}
                  <p className="text-center text-xs text-slate-400">Finding laboratories near you…</p>
                </div>
              )}

              {/* API Error Notice — only show if no existing data to display */}
              {!isLoading && !isRefreshing && apiError && allFetchedLabs.length === 0 && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-2">
                  <div className="font-bold flex items-center gap-2">
                    <i className="fa-solid fa-triangle-exclamation"></i>
                    <span>Unable to load nearby laboratories</span>
                  </div>
                  <p>{apiError}</p>
                  <button
                    type="button"
                    onClick={fetchNearbyLabs}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition"
                  >
                    Retry Search
                  </button>
                </div>
              )}

              {/* Empty Results State — only after load is complete and we truly have 0 labs */}
              {!isLoading && !isRefreshing && !apiError && allFetchedLabs.length === 0 && nearbyLabs.length === 0 && (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xl mx-auto">
                    <i className="fa-solid fa-magnifying-glass-location"></i>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">No laboratories found in this radius</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    No external labs matched your selected filters within {(selectedRadius / 1000).toFixed(0)} km. Try expanding your search radius.
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRadius(selectedRadius >= 20000 ? 50000 : selectedRadius * 2);
                        setSelectedCategory('all');
                        setOpenNowOnly(false);
                      }}
                      className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                    >
                      Search Wider Area
                    </button>
                  </div>
                </div>
              )}

              {/* Filter Empty State — labs loaded but active filter returns 0 */}
              {!isLoading && !isRefreshing && !apiError && allFetchedLabs.length > 0 && nearbyLabs.length === 0 && (
                <div className="p-6 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-sky-50 text-sky-400 flex items-center justify-center text-lg mx-auto">
                    <i className="fa-solid fa-filter-circle-xmark"></i>
                  </div>
                  <h4 className="font-semibold text-slate-800 text-sm">No labs match this filter</h4>
                  <p className="text-xs text-slate-500">
                    {allFetchedLabs.length} lab{allFetchedLabs.length > 1 ? 's' : ''} found nearby, but none match the selected category.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setSelectedCategory('all'); setOpenNowOnly(false); playHospitalChime(); }}
                    className="mt-1 px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition cursor-pointer"
                  >
                    Show All Labs
                  </button>
                </div>
              )}


              {/* Labs List — visible immediately, even during background refresh */}
              {(!isLoading || allFetchedLabs.length > 0) &&
                nearbyLabs.map((lab, index) => {
                  const directionsUrl = getDirectionsUrl(lab.lat, lab.lng);
                  return (
                    <div
                      key={lab.id}
                      className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 hover:border-sky-300 shadow-2xs hover:shadow-sm transition text-left space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-black">
                              {index + 1}
                            </span>
                            <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                              {lab.name}
                            </h4>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-500 pl-8">
                            <span className="font-bold text-slate-800">{lab.distanceKm} km</span>
                            <span>•</span>
                            <span className="text-amber-600 font-bold flex items-center gap-0.5">
                              ★ {lab.rating}
                            </span>
                            <span>•</span>
                            <span
                              className={`font-semibold ${
                                lab.isOpen ? 'text-emerald-600' : 'text-slate-400'
                              }`}
                            >
                              {lab.isOpen ? 'Open Now' : 'Closed'}
                            </span>
                          </div>
                        </div>

                        {/* Lab Chain / Provider Badge */}
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                          {lab.providerType.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Services Bullet Line */}
                      <div className="text-xs text-slate-600 pl-8">
                        <span>{lab.services.slice(0, 4).join(' • ')}</span>
                      </div>

                      {/* Action Buttons: View on Map, Directions, Details */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                        <button
                          type="button"
                          onClick={() => setSelectedLabDetails(lab)}
                          className="text-slate-600 hover:text-slate-900 font-semibold cursor-pointer py-1 px-2 rounded-lg hover:bg-slate-100 transition"
                        >
                          View Details
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleFocusLabOnMap(lab)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                          >
                            <i className="fa-solid fa-map text-slate-400"></i>
                            <span>View on Map</span>
                          </button>

                          <a
                            href={directionsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5"
                          >
                            <i className="fa-solid fa-diamond-turn-right text-xs"></i>
                            <span>Directions</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* RIGHT COLUMN: INTERACTIVE LEAFLET MAP */}
          <div
            className={`w-full lg:w-1/2 h-full flex flex-col relative bg-slate-100 dark:bg-[#0B1220] overflow-hidden z-0 ${
              activeTab === 'list' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <div ref={mapContainerRef} className="w-full h-full min-h-[350px] z-0"></div>

            {/* Map Legend Overlay */}
            <div className="absolute top-3 left-3 z-[10] bg-white/95 dark:bg-[#111827]/95 backdrop-blur-xs p-2.5 rounded-xl border border-slate-200 dark:border-[#1E293B] shadow-sm text-[11px] text-slate-700 dark:text-[#94A3B8] space-y-1.5 pointer-events-auto max-w-[200px]">
              <div className="font-extrabold text-slate-900 dark:text-white border-b border-slate-200 dark:border-[#1E293B] pb-1">
                Map Markers
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-sky-600 shrink-0"></span>
                <span>Your Location</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-600 shrink-0"></span>
                <span>Hospital Lab (0 m)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-600 shrink-0"></span>
                <span>Nearby External Labs</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7. DETAILED LABORATORY MODAL POPUP — Rendered at Root Viewport Level with z-[2500] so Leaflet Map Never Overlaps */}
      {selectedLabDetails && (
        <div className="fixed inset-0 z-[2500] flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-[#1E293B] max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl text-left overflow-y-auto max-h-[85vh] relative animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-[#1E293B]">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-[#082F49] px-2 py-0.5 rounded-full inline-block mb-1 border border-sky-200 dark:border-sky-800">
                  {'isInternal' in selectedLabDetails ? '🏥 Inside Your Hospital' : '🧪 External Diagnostic Partner'}
                </span>
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">{selectedLabDetails.name}</h3>
                <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
                  {'locationDetails' in selectedLabDetails
                    ? selectedLabDetails.locationDetails
                    : (selectedLabDetails as NearbyLab).address}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLabDetails(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#172033] text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            {/* Quick Info Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-[#172033] p-3.5 rounded-2xl border border-slate-200 dark:border-[#1E293B]">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-[#94A3B8] block">Distance</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {'distanceKm' in selectedLabDetails && selectedLabDetails.distanceKm === 0
                    ? '0 m (Inside Hospital)'
                    : `${selectedLabDetails.distanceKm} km away`}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-[#94A3B8] block">Rating</span>
                <span className="font-bold text-amber-500">
                  ★ {selectedLabDetails.rating} ({selectedLabDetails.reviewsCount} reviews)
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-[#94A3B8] block">Operating Hours</span>
                <span className="font-semibold text-slate-800 dark:text-[#F1F5F9]">
                  {'operatingHours' in selectedLabDetails
                    ? selectedLabDetails.operatingHours
                    : (selectedLabDetails as NearbyLab).openingHours}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-[#94A3B8] block">Phone</span>
                <a
                  href={`tel:${selectedLabDetails.phone}`}
                  className="font-bold text-sky-600 dark:text-sky-400 hover:underline"
                >
                  {selectedLabDetails.phone}
                </a>
              </div>
            </div>

            {/* Accreditations if present */}
            {selectedLabDetails.accreditations && selectedLabDetails.accreditations.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <span className="text-[11px] font-bold text-slate-500 dark:text-[#94A3B8]">Accreditations:</span>
                {selectedLabDetails.accreditations.map((acc) => (
                  <span
                    key={acc}
                    className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800"
                  >
                    ✓ {acc}
                  </span>
                ))}
              </div>
            )}

            {/* Available Services List */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-900 dark:text-white block">Available Diagnostic Tests & Services:</span>
              <div className="flex flex-wrap gap-1.5">
                {selectedLabDetails.services.map((srv) => (
                  <span
                    key={srv}
                    className="bg-slate-100 dark:bg-[#1E293B] text-slate-800 dark:text-[#F1F5F9] text-xs px-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#334155] font-medium"
                  >
                    {srv}
                  </span>
                ))}
              </div>
            </div>

            {/* Popular Test Turnaround & Pricing */}
            {selectedLabDetails.popularTests && selectedLabDetails.popularTests.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">Standard Turnaround Times:</span>
                <div className="space-y-1">
                  {selectedLabDetails.popularTests.map((t) => (
                    <div
                      key={t.name}
                      className="flex items-center justify-between text-xs bg-slate-50 dark:bg-[#172033] p-2 rounded-xl border border-slate-200 dark:border-[#1E293B]"
                    >
                      <span className="text-slate-800 dark:text-[#F1F5F9] font-medium">{t.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 dark:text-[#94A3B8]">~{t.turnaroundHours}h</span>
                        {t.priceEstimate && (
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                            {t.priceEstimate}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions: Call & Directions */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-[#1E293B]">
              <a
                href={`tel:${selectedLabDetails.phone}`}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-[#1E293B] hover:bg-slate-100 dark:hover:bg-[#172033] text-slate-700 dark:text-white font-bold text-xs flex items-center justify-center gap-2 transition"
              >
                <i className="fa-solid fa-phone text-slate-400"></i>
                <span>Call Lab</span>
              </a>

              {'lat' in selectedLabDetails && (
                <a
                  href={getDirectionsUrl(selectedLabDetails.lat, selectedLabDetails.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-xs"
                >
                  <i className="fa-solid fa-diamond-turn-right"></i>
                  <span>Directions</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
