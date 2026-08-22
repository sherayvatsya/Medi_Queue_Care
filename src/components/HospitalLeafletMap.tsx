import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  HospitalLocation,
  PRIMARY_HOSPITAL_ID,
  REAL_HOSPITALS_NETWORK,
  calculateHaversineDistance,
  fetchOsrmRoute,
} from '../data/hospitalsData';
import { playHospitalChime, playUrgentAlertSound } from '../utils/audio';

declare global {
  interface Window {
    L: any;
  }
}

interface HospitalLeafletMapProps {
  onSelectHospitalForBooking?: (hospital: HospitalLocation) => void;
  onShowToast?: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
  initialHospitalId?: string;
}

interface RouteInfo {
  distanceKm: number;
  durationMinutes: number;
  isOsrm: boolean;
  coordinates: [number, number][];
}

interface SearchSuggestion {
  displayName: string;
  lat: number;
  lng: number;
}

type LocationErrorType = 'blocked' | 'preview' | 'insecure' | 'timeout' | 'unavailable' | 'general';

interface LocationErrorInfo {
  title: string;
  message: string;
  type: LocationErrorType;
}

export const HospitalLeafletMap: React.FC<HospitalLeafletMapProps> = ({
  onSelectHospitalForBooking,
  onShowToast,
  initialHospitalId = PRIMARY_HOSPITAL_ID,
}) => {
  // DOM & Map references
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);

  // Hospital state (Primary: Max Super Specialty Hospital, Mohali)
  const [hospitals] = useState<HospitalLocation[]>(REAL_HOSPITALS_NETWORK);
  const [selectedHospital, setSelectedHospital] = useState<HospitalLocation>(() => {
    return (
      REAL_HOSPITALS_NETWORK.find((h) => h.id === initialHospitalId) ||
      REAL_HOSPITALS_NETWORK.find((h) => h.id === PRIMARY_HOSPITAL_ID) ||
      REAL_HOSPITALS_NETWORK[0]
    );
  });

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState<string>('All');
  const [emergencyOnly, setEmergencyOnly] = useState<boolean>(false);
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([]);
  const [isSearchingGeocode, setIsSearchingGeocode] = useState<boolean>(false);

  // Patient Location states
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [isLocatingUser, setIsLocatingUser] = useState<boolean>(false);
  const [isLiveTracking, setIsLiveTracking] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<LocationErrorInfo | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState | 'unknown'>('unknown');

  // Navigation & Route states
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState<boolean>(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Modal for View Hospital Details
  const [viewHospitalModal, setViewHospitalModal] = useState<HospitalLocation | null>(null);

  // UI state
  const [isLeafletReady, setIsLeafletReady] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');

  const notify = useCallback(
    (title: string, desc: string, type: 'info' | 'success' | 'urgent' = 'info') => {
      if (onShowToast) {
        onShowToast(title, desc, type);
      }
    },
    [onShowToast]
  );

  // Check if current context is secure (HTTPS or localhost)
  const isSecureContextActive = useCallback((): boolean => {
    if (typeof window === 'undefined') return true;
    return Boolean(
      window.isSecureContext ||
      window.location.protocol === 'https:' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    );
  }, []);

  // Check if running inside an iframe / embedded AI Studio preview
  const isInsidePreviewIframe = useCallback((): boolean => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  // Monitor Permissions API state without prompting
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((permStatus) => {
          setPermissionState(permStatus.state);
          permStatus.onchange = () => {
            setPermissionState(permStatus.state);
            if (permStatus.state === 'granted') {
              setLocationError(null);
            }
          };
        })
        .catch(() => {
          // Some environments/browsers do not support querying geolocation permission
        });
    }
  }, []);

  // Collect unique departments
  const allDepartments = useMemo(() => {
    const set = new Set<string>();
    hospitals.forEach((h) => h.departments.forEach((d) => set.add(d.split('&')[0].trim())));
    return ['All', ...Array.from(set)];
  }, [hospitals]);

  // Compute distances & filtered list
  const filteredHospitals = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return hospitals
      .map((h) => {
        let distance: number | undefined = undefined;
        if (userLocation) {
          distance = calculateHaversineDistance(userLocation.lat, userLocation.lng, h.lat, h.lng);
        }
        return {
          ...h,
          distanceKm: distance,
        };
      })
      .filter((h) => {
        if (emergencyOnly && !h.emergency24x7) return false;

        if (selectedDepartmentFilter !== 'All') {
          const matchDept = h.departments.some((d) =>
            d.toLowerCase().includes(selectedDepartmentFilter.toLowerCase())
          );
          if (!matchDept) return false;
        }

        if (!query) return true;
        return (
          h.name.toLowerCase().includes(query) ||
          h.shortName.toLowerCase().includes(query) ||
          h.address.toLowerCase().includes(query) ||
          h.city.toLowerCase().includes(query) ||
          h.state.toLowerCase().includes(query) ||
          h.departments.some((d) => d.toLowerCase().includes(query)) ||
          h.facilities.some((f) => f.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => {
        // Priority: Main campus (Max Mohali) first, then by distance if available
        if (a.id === PRIMARY_HOSPITAL_ID) return -1;
        if (b.id === PRIMARY_HOSPITAL_ID) return 1;
        if (a.distanceKm !== undefined && b.distanceKm !== undefined) {
          return a.distanceKm - b.distanceKm;
        }
        return 0;
      });
  }, [hospitals, searchQuery, selectedDepartmentFilter, emergencyOnly, userLocation]);

  // Ensure Leaflet is loaded
  useEffect(() => {
    const loadLeaflet = () => {
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
        script.onerror = () => {
          const fallback = document.createElement('script');
          fallback.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
          fallback.onload = () => {
            if (window.L) setIsLeafletReady(true);
          };
          document.body.appendChild(fallback);
        };
        document.body.appendChild(script);
      } else {
        const timer = setInterval(() => {
          if (window.L) {
            setIsLeafletReady(true);
            clearInterval(timer);
          }
        }, 100);
        return () => clearInterval(timer);
      }
    };

    loadLeaflet();
  }, []);

  // Initialize Map with Max Super Specialty Hospital, Mohali as default center
  useEffect(() => {
    if (!isLeafletReady || !mapContainerRef.current || mapInstanceRef.current) return;

    const L = window.L;
    if (!L) return;

    // Real Coordinates for Max Super Specialty Hospital, Mohali
    const maxMohaliCenter: [number, number] = [30.72484, 76.72138];

    const map = L.map(mapContainerRef.current, {
      center: maxMohaliCenter,
      zoom: 13,
      zoomControl: false,
      attributionControl: true,
    });

    // OpenStreetMap standard tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors • <span style="color:#0ea5e9;font-weight:700;">Max Healthcare Mohali Network</span>',
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = markersGroup;
    mapInstanceRef.current = map;

    // Recalculate size
    [100, 300, 700, 1200].forEach((delay) => {
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, delay);
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [isLeafletReady]);

  // Render Hospital Markers on Leaflet Map
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current || !window.L) return;

    const L = window.L;
    const markersGroup = markersGroupRef.current;
    markersGroup.clearLayers();

    filteredHospitals.forEach((hosp) => {
      const isPrimary = hosp.id === PRIMARY_HOSPITAL_ID;
      const isSelected = selectedHospital?.id === hosp.id;

      const markerHtml = `
        <div class="relative flex items-center justify-center cursor-pointer transition-transform hover:scale-110" style="transform: translate(-50%, -50%);">
          ${
            isPrimary
              ? `<div class="absolute w-12 h-12 rounded-full bg-sky-500/30 animate-ping"></div>`
              : ''
          }
          <div class="w-9 h-9 rounded-2xl shadow-xl flex items-center justify-center font-bold text-sm border-2 ${
            isSelected
              ? 'bg-sky-500 text-white border-white ring-4 ring-sky-500/30'
              : isPrimary
              ? 'bg-slate-900 text-sky-400 border-sky-400'
              : 'bg-white text-slate-800 border-slate-300'
          }">
            <i class="fa-solid fa-hospital text-xs"></i>
          </div>
          ${
            isPrimary
              ? `<span class="absolute -top-2 -right-2 bg-emerald-500 text-white text-[8px] font-extrabold px-1.5 py-0.2 rounded-full shadow-xs uppercase">Main</span>`
              : ''
          }
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-hospital-marker',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -20],
      });

      const marker = L.marker([hosp.lat, hosp.lng], { icon: customIcon });

      const popupContent = `
        <div class="p-3 text-left font-sans min-w-[240px] max-w-[280px]">
          <div class="flex items-center gap-1.5 mb-1.5">
            <span class="w-2 h-2 rounded-full ${
              hosp.statusColor === 'emerald'
                ? 'bg-emerald-500'
                : hosp.statusColor === 'amber'
                ? 'bg-amber-500'
                : 'bg-sky-500'
            }"></span>
            <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              ${isPrimary ? '🏥 Apex Hospital Mohali' : 'Regional Network Hub'}
            </span>
          </div>
          
          <h4 class="font-extrabold text-sm text-slate-900 leading-tight mb-1">
            ${hosp.name}
          </h4>
          
          <p class="text-xs text-slate-600 mb-2 leading-snug">
            ${hosp.address}, ${hosp.city}
          </p>

          <div class="grid grid-cols-2 gap-1.5 text-[11px] mb-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
            <div>
              <span class="text-slate-400 block text-[9px] font-bold uppercase">OPD Queue</span>
              <strong class="text-slate-800 font-semibold">${hosp.opdStatus}</strong>
            </div>
            <div>
              <span class="text-slate-400 block text-[9px] font-bold uppercase">Est. Wait</span>
              <strong class="text-sky-600 font-bold">~${hosp.estimatedWaitMinutes} mins</strong>
            </div>
          </div>

          <div class="flex items-center gap-2 pt-1 border-t border-slate-100">
            <button id="btn-view-${hosp.id}" class="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition">
              Details
            </button>
            <button id="btn-directions-${hosp.id}" class="flex-1 px-2.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-1">
              <i class="fa-solid fa-diamond-turn-right text-[10px]"></i> Directions
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 300 });

      marker.on('popupopen', () => {
        const btnView = document.getElementById(`btn-view-${hosp.id}`);
        if (btnView) {
          btnView.onclick = () => {
            setViewHospitalModal(hosp);
            playHospitalChime();
          };
        }

        const btnDir = document.getElementById(`btn-directions-${hosp.id}`);
        if (btnDir) {
          btnDir.onclick = () => {
            setSelectedHospital(hosp);
            handleGetDirections(hosp);
          };
        }
      });

      markersGroup.addLayer(marker);
    });
  }, [filteredHospitals, selectedHospital]);

  // Update User Location Pin with pulsating radar
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const L = window.L;

    if (userMarkerRef.current) {
      mapInstanceRef.current.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }

    if (userLocation) {
      const userHtml = `
        <div class="relative flex items-center justify-center" style="transform: translate(-50%, -50%);">
          <div class="absolute w-10 h-10 rounded-full bg-sky-500/30 animate-ping"></div>
          <div class="absolute w-6 h-6 rounded-full bg-sky-400/50 animate-pulse"></div>
          <div class="w-7 h-7 rounded-full bg-slate-900 border-2 border-white shadow-xl flex items-center justify-center text-xs text-sky-400 font-bold z-10">
            <i class="fa-solid fa-person-walking"></i>
          </div>
          <div class="absolute top-8 px-2 py-0.5 rounded-full bg-slate-900 text-white text-[9px] font-bold shadow-md border border-slate-700 whitespace-nowrap z-20">
            📍 You are here
          </div>
        </div>
      `;

      const userIcon = L.divIcon({
        html: userHtml,
        className: 'custom-user-location-marker',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .bindPopup(
          `<div class="p-2 text-xs font-sans text-slate-800">
            <strong>📍 Patient Current Location</strong><br/>
            <span class="text-slate-500">${userLocation.label}</span><br/>
            <span class="text-sky-600 font-bold text-[11px] mt-1 inline-block">Lat: ${userLocation.lat.toFixed(4)}, Lng: ${userLocation.lng.toFixed(4)}</span>
          </div>`
        )
        .addTo(mapInstanceRef.current);

      userMarkerRef.current = userMarker;
    }
  }, [userLocation]);

  // Draw or Remove OSRM Road Route on Map
  const drawRouteOnMap = useCallback((coords: [number, number][]) => {
    if (!mapInstanceRef.current || !window.L) return;
    const L = window.L;

    if (routeLayerRef.current) {
      mapInstanceRef.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    if (coords && coords.length > 0) {
      // Glow casing layer for high contrast
      const casing = L.polyline(coords, {
        color: '#0369a1',
        weight: 8,
        opacity: 0.4,
        lineCap: 'round',
        lineJoin: 'round',
      });

      // Vibrant foreground route line
      const line = L.polyline(coords, {
        color: '#0ea5e9',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      });

      const group = L.featureGroup([casing, line]).addTo(mapInstanceRef.current);
      routeLayerRef.current = group;

      // Fit map viewport to encompass entire road route
      mapInstanceRef.current.fitBounds(group.getBounds(), {
        padding: [60, 60],
        maxZoom: 15,
        animate: true,
      });
    }
  }, []);

  // Calculate & Display Real Road Route
  const calculateAndShowRoute = useCallback(
    async (
      origin: { lat: number; lng: number },
      dest: HospitalLocation = selectedHospital
    ) => {
      setIsCalculatingRoute(true);
      setRouteError(null);

      try {
        const result = await fetchOsrmRoute(origin.lat, origin.lng, dest.lat, dest.lng);

        const newRouteInfo: RouteInfo = {
          distanceKm: result.distanceKm,
          durationMinutes: result.durationMinutes,
          isOsrm: result.success,
          coordinates: result.coordinates,
        };

        setRouteInfo(newRouteInfo);
        drawRouteOnMap(result.coordinates);
        playHospitalChime();

        notify(
          `Route to ${dest.shortName} Ready ✓`,
          `Distance: ${result.distanceKm} km • Approx. ${result.durationMinutes} min drive via primary road corridor.`,
          'success'
        );
      } catch (err: any) {
        console.error('Routing calculation error:', err);
        setRouteError('Unable to calculate a route right now. Please try again or open navigation externally.');
        notify('Routing Notice', 'Unable to calculate road route right now. You can open navigation in Maps.', 'urgent');
      } finally {
        setIsCalculatingRoute(false);
      }
    },
    [selectedHospital, drawRouteOnMap, notify]
  );

  // Core "Use My Location" Handler (Triggered ON CLICK ONLY)
  const handleUseMyLocation = useCallback(() => {
    // 1. Secure context check
    if (!isSecureContextActive()) {
      setLocationError({
        title: 'HTTPS Required',
        message: 'Location requires a secure connection. Please open Medi-Queue using HTTPS.',
        type: 'insecure',
      });
      playUrgentAlertSound();
      return;
    }

    // 2. Geolocation API presence check
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError({
        title: 'Geolocation Unsupported',
        message: 'Browser geolocation is not supported on this device or browser.',
        type: 'unavailable',
      });
      playUrgentAlertSound();
      return;
    }

    setIsLocatingUser(true);
    setLocationError(null);
    playHospitalChime();
    notify('Requesting Geolocation', 'Accessing device GPS coordinates...', 'info');

    // Request GPS position with high accuracy
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocatingUser(false);
        const { latitude, longitude } = position.coords;
        const newLoc = {
          lat: latitude,
          lng: longitude,
          label: 'Current GPS Position',
        };

        setUserLocation(newLoc);
        setLocationError(null);
        setPermissionState('granted');

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 14, { duration: 1.2 });
        }

        // Always target Max Super Specialty Hospital, Mohali as flagship destination
        const targetHosp =
          selectedHospital ||
          REAL_HOSPITALS_NETWORK.find((h) => h.id === PRIMARY_HOSPITAL_ID) ||
          REAL_HOSPITALS_NETWORK[0];

        setSelectedHospital(targetHosp);

        // Calculate and display real road route
        calculateAndShowRoute(newLoc, targetHosp);
      },
      (error) => {
        // Fallback: If high accuracy timed out, retry once with low accuracy (cell tower / Wi-Fi fix)
        if (error.code === error.TIMEOUT) {
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => {
              setIsLocatingUser(false);
              const { latitude, longitude } = fallbackPos.coords;
              const newLoc = {
                lat: latitude,
                lng: longitude,
                label: 'Current Location (Network)',
              };

              setUserLocation(newLoc);
              setLocationError(null);
              setPermissionState('granted');

              if (mapInstanceRef.current) {
                mapInstanceRef.current.flyTo([latitude, longitude], 14, { duration: 1.2 });
              }

              const targetHosp =
                selectedHospital ||
                REAL_HOSPITALS_NETWORK.find((h) => h.id === PRIMARY_HOSPITAL_ID) ||
                REAL_HOSPITALS_NETWORK[0];

              setSelectedHospital(targetHosp);
              calculateAndShowRoute(newLoc, targetHosp);
            },
            (fallbackErr) => {
              setIsLocatingUser(false);
              handleGeolocationError(fallbackErr);
            },
            { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
          );
        } else {
          setIsLocatingUser(false);
          handleGeolocationError(error);
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }, [isSecureContextActive, selectedHospital, calculateAndShowRoute, notify]);

  // Geolocation error mapping helper
  const handleGeolocationError = useCallback((error: GeolocationPositionError) => {
    playUrgentAlertSound();

    if (error.code === error.PERMISSION_DENIED) {
      setPermissionState('denied');
      if (isInsidePreviewIframe()) {
        setLocationError({
          title: 'Live location is unavailable in this preview',
          message: 'Open the deployed Medi-Queue website in a browser to enable GPS directions.',
          type: 'preview',
        });
      } else {
        setLocationError({
          title: 'Location permission is blocked',
          message: 'Please enable location permission in your browser settings to use live directions.',
          type: 'blocked',
        });
      }
      notify('Location Blocked', 'Location permission is blocked in browser settings.', 'urgent');
    } else if (error.code === error.POSITION_UNAVAILABLE) {
      setLocationError({
        title: 'Location Unavailable',
        message: 'Unable to detect device GPS coordinates. Please check your signal or select a preset origin.',
        type: 'unavailable',
      });
      notify('Location Unavailable', 'Unable to determine GPS location.', 'urgent');
    } else if (error.code === error.TIMEOUT) {
      setLocationError({
        title: 'Location Request Timed Out',
        message: 'GPS request timed out. Please try again or select a nearby origin point.',
        type: 'timeout',
      });
      notify('Request Timed Out', 'Location request took too long.', 'urgent');
    } else {
      setLocationError({
        title: 'Location Error',
        message: error.message || 'An unexpected error occurred while accessing location.',
        type: 'general',
      });
      notify('Location Error', 'Unable to retrieve location.', 'urgent');
    }
  }, [isInsidePreviewIframe, notify]);

  // Start / Stop Live Location Tracking (`navigator.geolocation.watchPosition`)
  const handleToggleLiveTracking = () => {
    if (isLiveTracking) {
      // Stop tracking
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsLiveTracking(false);
      playHospitalChime();
      notify('Tracking Stopped', 'Live location tracking has been disabled.', 'info');
      return;
    }

    if (!isSecureContextActive()) {
      setLocationError({
        title: 'HTTPS Required',
        message: 'Location requires a secure connection. Please open Medi-Queue using HTTPS.',
        type: 'insecure',
      });
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError({
        title: 'Geolocation Unsupported',
        message: 'Browser geolocation is not supported on this device.',
        type: 'unavailable',
      });
      return;
    }

    setLocationError(null);
    playHospitalChime();
    notify('Starting Live Tracking', 'Connecting to device GPS stream...', 'info');

    let lastLat = userLocation?.lat || 0;
    let lastLng = userLocation?.lng || 0;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        // Only mark active once we actually receive a real coordinate
        setIsLiveTracking(true);
        const { latitude, longitude } = position.coords;
        const newLoc = {
          lat: latitude,
          lng: longitude,
          label: 'Live Tracking Location',
        };

        setUserLocation(newLoc);
        setLocationError(null);
        setPermissionState('granted');

        // Update marker smoothly
        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng([latitude, longitude]);
        }

        // If moved > 50 meters, recalculate route
        const movedDist = calculateHaversineDistance(lastLat, lastLng, latitude, longitude);
        if (movedDist > 0.05) {
          lastLat = latitude;
          lastLng = longitude;
          calculateAndShowRoute(newLoc, selectedHospital);
        }
      },
      (error) => {
        setIsLiveTracking(false);
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        handleGeolocationError(error);
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );

    watchIdRef.current = watchId;
  };

  // Clean up watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  // "Get Directions" Handler
  const handleGetDirections = (targetHospital: HospitalLocation = selectedHospital) => {
    if (!userLocation) {
      notify('Requesting Location', 'Enabling GPS to generate turn-by-turn route...', 'info');
      handleUseMyLocation();
      return;
    }

    calculateAndShowRoute(userLocation, targetHospital);
  };

  // Nominatim OpenStreetMap Geocoding Search
  const handleSearchNominatim = async (query: string) => {
    if (!query || query.trim().length < 3) {
      setSearchSuggestions([]);
      return;
    }

    setIsSearchingGeocode(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query + ' Punjab Chandigarh India'
      )}&limit=5&countrycodes=in`;

      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      if (res.ok) {
        const data = await res.json();
        const suggestions: SearchSuggestion[] = data.map((item: any) => ({
          displayName: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        }));
        setSearchSuggestions(suggestions);
      }
    } catch (e) {
      console.warn('Geocode search failed:', e);
    } finally {
      setIsSearchingGeocode(false);
    }
  };

  const handleSelectSuggestion = (sug: SearchSuggestion) => {
    const newLoc = {
      lat: sug.lat,
      lng: sug.lng,
      label: sug.displayName.split(',')[0],
    };
    setUserLocation(newLoc);
    setLocationError(null);
    setSearchSuggestions([]);
    setSearchQuery('');
    playHospitalChime();

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([sug.lat, sug.lng], 13, { duration: 1 });
    }

    notify('Location Set', `Origin set to ${newLoc.label}.`, 'info');
    calculateAndShowRoute(newLoc, selectedHospital);
  };

  // Map Controls: Zoom & Reset
  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  const handleResetMap = () => {
    if (!mapInstanceRef.current || !window.L) return;
    const L = window.L;
    const bounds = L.latLngBounds(hospitals.map((h) => [h.lat, h.lng]));
    mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    playHospitalChime();
    notify('Map Reset', 'Viewport fitted to all regional hospital network centers.', 'info');
  };

  // External Navigation URL (OpenStreetMap / Google Maps fallback)
  // Requirement 7: If location exists, route origin -> hospital. If location is unavailable, open hospital directly.
  const getOpenStreetMapDirectionsUrl = (hospital: HospitalLocation) => {
    if (userLocation) {
      return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${userLocation.lat}%2C${userLocation.lng}%3B${hospital.lat}%2C${hospital.lng}`;
    }
    // Destination only view
    return `https://www.openstreetmap.org/?mlat=${hospital.lat}&mlon=${hospital.lng}#map=17/${hospital.lat}/${hospital.lng}`;
  };

  const getGoogleMapsDirectionsUrl = (hospital: HospitalLocation) => {
    if (userLocation) {
      return `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${hospital.lat},${hospital.lng}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${hospital.lat},${hospital.lng}`;
  };

  // Calculate live dynamic distance to selected hospital
  const dynamicDistanceKm = useMemo(() => {
    if (routeInfo?.distanceKm) return routeInfo.distanceKm;
    if (userLocation) {
      return calculateHaversineDistance(
        userLocation.lat,
        userLocation.lng,
        selectedHospital.lat,
        selectedHospital.lng
      );
    }
    return undefined;
  }, [routeInfo, userLocation, selectedHospital]);

  const dynamicTravelTimeMinutes = useMemo(() => {
    if (routeInfo?.durationMinutes) return routeInfo.durationMinutes;
    if (dynamicDistanceKm) {
      return Math.max(2, Math.round((dynamicDistanceKm / 30) * 60));
    }
    return undefined;
  }, [routeInfo, dynamicDistanceKm]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 text-slate-800">
      {/* 1. Header & Hospital Information */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <span className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-500 text-white flex items-center justify-center text-xl shadow-sm shrink-0">
              <i className="fa-solid fa-hospital"></i>
            </span>
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-xl font-extrabold text-slate-900 tracking-tight">
                  Max Super Specialty Hospital, Mohali
                </h2>
                <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active Flagship Campus
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Near Civil Hospital, Phase 6, Sector 56, Mohali, Punjab • Level 1 Trauma & 24/7 OPD
              </p>
            </div>
          </div>

          {/* Action Buttons: [Use My Location] [Live Tracking] [Fit All] */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={isLocatingUser}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 active:scale-[0.98] text-white text-xs font-bold transition shadow-sm cursor-pointer flex items-center justify-center gap-2 disabled:opacity-75"
              title="Request device GPS location to calculate exact road distance and route"
            >
              {isLocatingUser ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                  <span>Detecting GPS...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-location-crosshairs text-xs"></i>
                  <span>📍 Use My Location</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleToggleLiveTracking}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition flex items-center gap-2 cursor-pointer ${
                isLiveTracking
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
              title="Continuously track patient position as you move"
            >
              {isLiveTracking ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block"></span>
                  <span>Stop Tracking</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block"></span>
                  <span>Live Tracking</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleResetMap}
              className="px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              title="Fit map view to all hospital locations"
            >
              <i className="fa-solid fa-expand text-slate-500"></i>
              <span>Fit All</span>
            </button>

            {/* Mobile View Toggle */}
            <div className="flex lg:hidden bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs ml-auto sm:ml-0">
              <button
                type="button"
                onClick={() => setActiveTab('map')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  activeTab === 'map' ? 'bg-white text-sky-600 shadow-2xs' : 'text-slate-600'
                }`}
              >
                <i className="fa-solid fa-map mr-1"></i> Map
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  activeTab === 'list' ? 'bg-white text-sky-600 shadow-2xs' : 'text-slate-600'
                }`}
              >
                <i className="fa-solid fa-list mr-1"></i> Directory
              </button>
            </div>
          </div>
        </div>

        {/* Geolocation Permission / Environment Notice with Retry Action (Shown only if error occurs) */}
        {locationError && (
          <div
            className={`mt-4 p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              locationError.type === 'blocked'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <i
                className={`fa-solid ${
                  locationError.type === 'blocked'
                    ? 'fa-lock text-rose-600'
                    : 'fa-triangle-exclamation text-amber-600'
                } text-sm mt-0.5 shrink-0`}
              ></i>
              <div className="space-y-0.5">
                <strong className="font-extrabold">{locationError.title}: </strong>
                <span className="opacity-90">{locationError.message}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {locationError.type === 'preview' ? (
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
                >
                  <i className="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                  <span>Open in Browser</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <i className="fa-solid fa-rotate-right text-xs"></i>
                  <span>Try Again</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setLocationError(null)}
                className="w-7 h-7 rounded-lg bg-black/5 hover:bg-black/10 flex items-center justify-center font-bold transition text-xs"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Search + Filters Area */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Box with live Nominatim geocoding */}
          <div className="md:col-span-6 relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                handleSearchNominatim(val);
              }}
              placeholder="Search hospital or location (e.g. Max Mohali, Phase 7, Sector 17, Zirakpur)..."
              className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchSuggestions([]);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}

            {/* Nominatim Suggestions Dropdown */}
            {searchSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto">
                <div className="p-2 text-[10px] font-bold text-slate-400 bg-slate-50 uppercase tracking-wider">
                  📍 OpenStreetMap Geocoded Places
                </div>
                {searchSuggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSuggestion(sug)}
                    className="w-full text-left p-2.5 text-xs hover:bg-sky-50 text-slate-800 flex items-start gap-2 transition cursor-pointer"
                  >
                    <i className="fa-solid fa-location-dot text-sky-500 mt-0.5 text-xs"></i>
                    <span className="line-clamp-2 leading-relaxed">{sug.displayName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Department Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedDepartmentFilter}
              onChange={(e) => setSelectedDepartmentFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-sky-500 cursor-pointer"
            >
              {allDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept === 'All' ? '🏥 All Departments' : `🩺 ${dept}`}
                </option>
              ))}
            </select>
          </div>

          {/* 24/7 Emergency Toggle */}
          <div className="md:col-span-3 flex items-center justify-start md:justify-end">
            <button
              type="button"
              onClick={() => {
                setEmergencyOnly((prev) => !prev);
                playHospitalChime();
              }}
              className={`w-full md:w-auto px-3.5 py-2.5 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 cursor-pointer ${
                emergencyOnly
                  ? 'bg-rose-50 border-rose-400 text-rose-700 shadow-xs ring-2 ring-rose-500/20'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <i className="fa-solid fa-truck-medical text-rose-500"></i>
              <span>24/7 Trauma / Emergency</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Clean Location → Destination Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Origin -> Destination Info */}
          <div className="flex items-center gap-3 text-xs flex-1">
            <div className="space-y-0.5 min-w-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <i className="fa-solid fa-location-crosshairs text-sky-500"></i>
                <span>Your Location</span>
              </span>
              <p className="font-bold text-slate-800 truncate">
                {userLocation ? userLocation.label : 'Current location / Location not selected'}
              </p>
            </div>

            <div className="text-slate-300 flex items-center px-1 shrink-0">
              <i className="fa-solid fa-arrow-right text-base text-sky-400"></i>
            </div>

            <div className="space-y-0.5 min-w-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <i className="fa-solid fa-hospital text-sky-500"></i>
                <span>Destination</span>
              </span>
              <p className="font-bold text-slate-900 truncate">
                {selectedHospital.name}
              </p>
            </div>
          </div>

          {/* Distance/Time Stats & Action Buttons */}
          <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4">
            {dynamicDistanceKm !== undefined && (
              <div className="text-left md:text-right pr-1 shrink-0">
                <div className="text-sm font-black font-mono text-slate-900">
                  {dynamicDistanceKm} km
                </div>
                {dynamicTravelTimeMinutes !== undefined && (
                  <div className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                    🚗 ~{dynamicTravelTimeMinutes} min
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleGetDirections(selectedHospital)}
                disabled={isCalculatingRoute}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 active:scale-[0.98] text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-75"
              >
                {isCalculatingRoute ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                    <span>Routing...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-diamond-turn-right text-xs"></i>
                    <span>Get Directions</span>
                  </>
                )}
              </button>

              <a
                href={getOpenStreetMapDirectionsUrl(selectedHospital)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                title={
                  userLocation
                    ? 'Open turn-by-turn road route in OpenStreetMap'
                    : 'Open hospital location on OpenStreetMap'
                }
              >
                <i className="fa-solid fa-arrow-up-right-from-square text-[10px] text-sky-500"></i>
                <span>Open in Maps</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Large Map + Hospital Information Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Clean Hospital Directory Cards */}
        <div
          className={`lg:col-span-5 space-y-3 ${
            activeTab === 'map' ? 'hidden lg:block' : 'block'
          } max-h-[560px] overflow-y-auto pr-1 scrollbar-thin`}
        >
          <div className="flex items-center justify-between px-1 text-xs text-slate-500 font-semibold">
            <span>Showing {filteredHospitals.length} Hospitals</span>
            {userLocation && <span className="text-sky-600 font-bold">📍 GPS Active</span>}
          </div>

          {filteredHospitals.map((hosp) => {
            const isSelected = selectedHospital?.id === hosp.id;
            const isPrimary = hosp.id === PRIMARY_HOSPITAL_ID;

            return (
              <div
                key={hosp.id}
                onClick={() => {
                  setSelectedHospital(hosp);
                  playHospitalChime();
                  if (userLocation) {
                    calculateAndShowRoute(userLocation, hosp);
                  }
                }}
                className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer text-left relative overflow-hidden ${
                  isSelected
                    ? 'border-sky-500 ring-2 ring-sky-500/20 shadow-md bg-sky-50/20'
                    : isPrimary
                    ? 'border-sky-300 bg-sky-50/10 shadow-xs'
                    : 'border-slate-200/80 hover:border-sky-300 hover:shadow-sm bg-white'
                }`}
              >
                {/* Flagship Badge */}
                {isPrimary && (
                  <div className="absolute top-0 right-0 bg-sky-500 text-white text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-bl-lg tracking-wider shadow-xs">
                    ⭐ Flagship Mohali Campus
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-base shrink-0 shadow-xs border ${
                      isSelected
                        ? 'bg-sky-500 text-white border-sky-400'
                        : isPrimary
                        ? 'bg-slate-900 text-sky-400 border-slate-800'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <i className="fa-solid fa-hospital"></i>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap pr-14">
                      <h4 className="font-extrabold text-sm text-slate-900 truncate leading-snug">
                        {hosp.name}
                      </h4>
                    </div>

                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                      <i className="fa-solid fa-location-dot text-slate-400 text-[10px]"></i>
                      <span>{hosp.address}, {hosp.city}</span>
                    </p>

                    {/* Status & Estimated Wait */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          hosp.statusColor === 'emerald'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : hosp.statusColor === 'amber'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-sky-50 text-sky-700 border-sky-200'
                        }`}
                      >
                        🟢 OPD: {hosp.opdStatus}
                      </span>

                      <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                        ⏱️ ~{hosp.estimatedWaitMinutes}m wait
                      </span>

                      {hosp.distanceKm !== undefined && (
                        <span className="text-[10px] font-bold font-mono text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
                          📍 {hosp.distanceKm} km
                        </span>
                      )}
                    </div>

                    {/* Action Buttons inside Card */}
                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewHospitalModal(hosp);
                          playHospitalChime();
                        }}
                        className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer"
                      >
                        <i className="fa-solid fa-circle-info text-[11px]"></i>
                        <span>View Hospital</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedHospital(hosp);
                            handleGetDirections(hosp);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                        >
                          <i className="fa-solid fa-diamond-turn-right text-[10px] text-sky-600"></i>
                          <span>Get Directions</span>
                        </button>

                        {onSelectHospitalForBooking && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectHospitalForBooking(hosp);
                              playHospitalChime();
                              notify('Hospital Selected', `${hosp.name} set for active appointment booking.`, 'success');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                          >
                            <span>Book Here</span>
                            <i className="fa-solid fa-chevron-right text-[10px]"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Responsive Interactive Leaflet OpenStreetMap Container */}
        <div
          className={`lg:col-span-7 relative ${
            activeTab === 'list' ? 'hidden lg:block' : 'block'
          }`}
        >
          <div className="w-full h-[380px] md:h-[430px] lg:h-[540px] rounded-2xl overflow-hidden border border-slate-200/80 shadow-md bg-slate-100 relative">
            {/* The Actual Leaflet Map DOM Element */}
            <div ref={mapContainerRef} className="w-full h-full z-0" />

            {/* Map Loading State */}
            {!isLeafletReady && (
              <div className="absolute inset-0 z-20 bg-slate-100/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-sky-500 text-white flex items-center justify-center text-xl shadow-md animate-pulse">
                  <i className="fa-solid fa-map-location-dot"></i>
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-sm text-slate-800">Initializing OpenStreetMap Engine</h4>
                  <p className="text-xs text-slate-500 max-w-xs">Connecting to Max Healthcare Mohali routing telemetry...</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-sky-600 font-semibold">
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                  <span>Rendering interactive map</span>
                </div>
              </div>
            )}

            {/* Custom Map Floating Controls (Top-Right) */}
            <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5 shadow-md rounded-xl overflow-hidden bg-white border border-slate-200">
              <button
                type="button"
                onClick={handleZoomIn}
                className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-100 hover:text-slate-900 text-sm font-bold transition cursor-pointer"
                title="Zoom In"
              >
                <i className="fa-solid fa-plus"></i>
              </button>
              <div className="h-px bg-slate-200" />
              <button
                type="button"
                onClick={handleZoomOut}
                className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-100 hover:text-slate-900 text-sm font-bold transition cursor-pointer"
                title="Zoom Out"
              >
                <i className="fa-solid fa-minus"></i>
              </button>
              <div className="h-px bg-slate-200" />
              <button
                type="button"
                onClick={handleUseMyLocation}
                className="w-8 h-8 flex items-center justify-center text-sky-600 hover:bg-sky-50 text-sm transition cursor-pointer"
                title="Detect GPS & Calculate Route"
              >
                <i className="fa-solid fa-crosshairs"></i>
              </button>
              <div className="h-px bg-slate-200" />
              <button
                type="button"
                onClick={handleToggleLiveTracking}
                className={`w-8 h-8 flex items-center justify-center text-sm transition cursor-pointer ${
                  isLiveTracking ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 hover:bg-slate-50'
                }`}
                title={isLiveTracking ? 'Stop Live GPS Tracking' : 'Start Live GPS Tracking'}
              >
                <i className="fa-solid fa-satellite-dish"></i>
              </button>
            </div>

            {/* Floating Selected Hospital Card at Bottom of Map */}
            {selectedHospital && (
              <div className="absolute bottom-3 left-3 right-3 z-10 max-w-xl mx-auto">
                <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 p-3 sm:p-3.5 shadow-xl text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-500 text-white flex items-center justify-center font-black text-base shrink-0 shadow-xs">
                      <i className="fa-solid fa-hospital"></i>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                          {selectedHospital.name}
                        </h4>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                          {selectedHospital.opdStatus}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {selectedHospital.address}, {selectedHospital.city} • ⏱️ ~{selectedHospital.estimatedWaitMinutes}m wait
                        {dynamicDistanceKm !== undefined && (
                          <strong className="text-sky-600 ml-1 font-mono">({dynamicDistanceKm} km)</strong>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setViewHospitalModal(selectedHospital);
                        playHospitalChime();
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <i className="fa-solid fa-circle-info text-[10px]"></i>
                      <span>View Hospital</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleGetDirections(selectedHospital)}
                      className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                    >
                      <i className="fa-solid fa-diamond-turn-right text-[10px]"></i>
                      <span>Get Directions</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed "View Hospital" Modal */}
      {viewHospitalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5 shadow-2xl text-left max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-500 text-white flex items-center justify-center font-bold text-xl shadow-md shrink-0">
                  <i className="fa-solid fa-hospital"></i>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-base text-slate-900">
                      {viewHospitalModal.name}
                    </h3>
                    {viewHospitalModal.id === PRIMARY_HOSPITAL_ID && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                        Apex Mohali Campus
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {viewHospitalModal.tagline}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewHospitalModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">OPD Status</span>
                <strong className="text-emerald-700 font-extrabold block mt-0.5">{viewHospitalModal.opdStatus}</strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Est. Wait</span>
                <strong className="text-slate-900 font-extrabold block mt-0.5">~{viewHospitalModal.estimatedWaitMinutes} mins</strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Doctors On Duty</span>
                <strong className="text-slate-900 font-extrabold block mt-0.5">{viewHospitalModal.activeDoctorsCount} MDs</strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Beds Available</span>
                <strong className="text-emerald-600 font-extrabold block mt-0.5">{viewHospitalModal.availableBeds} / {viewHospitalModal.totalBeds}</strong>
              </div>
            </div>

            {/* Location & Timings */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <i className="fa-solid fa-location-dot text-sky-500 text-sm mt-0.5 shrink-0"></i>
                <div>
                  <strong className="text-slate-900 block font-bold">Address & Campus Location</strong>
                  <span className="text-slate-600">{viewHospitalModal.address}, {viewHospitalModal.city}, {viewHospitalModal.state} - {viewHospitalModal.postalCode}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 pt-1 border-t border-slate-200/60">
                <i className="fa-regular fa-clock text-slate-500 text-sm mt-0.5 shrink-0"></i>
                <div>
                  <strong className="text-slate-900 block font-bold">OPD Consultation Hours</strong>
                  <span className="text-slate-600">{viewHospitalModal.opdTimings}</span>
                </div>
              </div>
            </div>

            {/* Available Departments */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <i className="fa-solid fa-stethoscope text-sky-500"></i>
                <span>Available Clinical Departments</span>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {viewHospitalModal.departments.map((dept) => (
                  <span
                    key={dept}
                    className="px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-100 text-sky-900 text-xs font-semibold"
                  >
                    {dept}
                  </span>
                ))}
              </div>
            </div>

            {/* Facilities */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <i className="fa-solid fa-circle-check text-emerald-500"></i>
                <span>Campus Facilities & Telemetry</span>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {viewHospitalModal.facilities.map((fac) => (
                  <span
                    key={fac}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium"
                  >
                    ✓ {fac}
                  </span>
                ))}
              </div>
            </div>

            {/* Emergency Hotline Alert */}
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-truck-medical text-rose-600 text-base"></i>
                <div>
                  <strong className="text-rose-900 font-bold block">{viewHospitalModal.traumaLevel}</strong>
                  <span className="text-rose-700">{viewHospitalModal.emergencyPhone}</span>
                </div>
              </div>
              <a
                href={`tel:${viewHospitalModal.phone}`}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition"
              >
                <i className="fa-solid fa-phone mr-1 text-[10px]"></i> Call
              </a>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5 border-t border-slate-100">
              <a
                href={getOpenStreetMapDirectionsUrl(viewHospitalModal)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-diamond-turn-right text-sky-500"></i>
                <span>Open in OpenStreetMap</span>
              </a>

              {onSelectHospitalForBooking && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectHospitalForBooking(viewHospitalModal);
                    setViewHospitalModal(null);
                    playHospitalChime();
                    notify('Hospital Selected', `${viewHospitalModal.name} selected for your appointment.`, 'success');
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition shadow-sm cursor-pointer flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-ticket"></i>
                  <span>Select & Book OPD Pass</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
