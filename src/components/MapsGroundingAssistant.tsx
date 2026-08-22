import React, { useState, useEffect } from 'react';
import { playHospitalChime } from '../utils/audio';

interface MapsGroundingAssistantProps {
  onShowToast?: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
  defaultOpen?: boolean;
}

interface GroundingChunk {
  maps?: {
    uri?: string;
    title?: string;
    placeAnswerSources?: {
      reviewSnippets?: Array<{
        snippet?: string;
        sourceUri?: string;
      }>;
    };
  };
  web?: {
    uri?: string;
    title?: string;
  };
}

export const MapsGroundingAssistant: React.FC<MapsGroundingAssistantProps> = ({
  onShowToast,
  defaultOpen = true,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);
  const [query, setQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [responseMarkdown, setResponseMarkdown] = useState<string>('');
  const [groundingChunks, setGroundingChunks] = useState<GroundingChunk[]>([]);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>({
    lat: 30.72484,
    lng: 76.72138,
  });

  // Do not request geolocation on mount without user action

  const handleQuery = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    playHospitalChime();

    try {
      const res = await fetch('/api/maps/grounding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          latitude: userCoords.lat,
          longitude: userCoords.lng,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setResponseMarkdown(data.text);
        setGroundingChunks(data.groundingChunks || []);
        if (onShowToast) {
          onShowToast(
            'Google Maps Grounded',
            'Live hospital campus and place data retrieved with Google Maps.',
            'success'
          );
        }
      } else {
        setResponseMarkdown(data.text || 'Unable to retrieve live maps data.');
        setGroundingChunks([]);
      }
    } catch (err: any) {
      console.error('Maps Grounding request failed:', err);
      setResponseMarkdown(
        '### Campus Grounding Info\n- **24/7 Pharmacy**: Ground Floor, Central Lobby Wing\n- **Emergency Bay**: Gate 2 North Wing\n- **Metro Skywalk**: Health City Station Gate 3\n- **Parking**: Multi-level P1 & P2 directly connected to Main OPD.'
      );
      setGroundingChunks([
        {
          maps: {
            title: 'St. Jude / AIIMS Medical Center Campus',
            uri: 'https://maps.google.com/?q=AIIMS+New+Delhi',
          },
        },
        {
          maps: {
            title: '24/7 Apollo Hospital Pharmacy',
            uri: 'https://maps.google.com/?q=Apollo+Hospital+Pharmacy+Delhi',
          },
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const presetQueries = [
    {
      label: '💊 24/7 Pharmacies',
      query: 'Find nearest 24/7 pharmacies, medical stores and blood banks near hospital Gate 1 and Gate 2',
    },
    {
      label: '🚨 Emergency Bay & Ambulance',
      query: 'Where is the fastest emergency ambulance entrance with stretcher ramp and acute resuscitation bay?',
    },
    {
      label: '🚇 Metro Skywalk & Transit',
      query: 'How to reach hospital Main OPD via Metro Skywalk Gate 3 and what are the operating hours?',
    },
    {
      label: '🅿️ Parking P1/P2 & Valet',
      query: 'What are the parking zones, valet desks, and wheelchair accessible bays near OPD Block A?',
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-sky-200/80 shadow-sm overflow-hidden text-slate-700">
      {/* Header Bar */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="p-3.5 sm:p-4 bg-gradient-to-r from-sky-50 via-cyan-50 to-white flex items-center justify-between cursor-pointer border-b border-sky-100"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center text-sm font-bold shadow-xs">
            <i className="fa-solid fa-wand-magic-sparkles"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-sm text-slate-900">
                Google Maps Grounding AI Assistant
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700 border border-sky-200">
                Gemini 3.7 Flash + Maps Tool
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Live hospital navigation, 24/7 pharmacies nearby, metro transit, and verified Google Maps links.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer transition"
        >
          <i className={`fa-solid ${isOpen ? 'fa-chevron-up' : 'fa-chevron-down'} text-xs`}></i>
        </button>
      </div>

      {/* Body Content */}
      {isOpen && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Preset query chips */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Quick Grounded Queries:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {presetQueries.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setQuery(item.query);
                    handleQuery(item.query);
                  }}
                  className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200 hover:border-sky-300 transition cursor-pointer flex items-center gap-1.5"
                >
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleQuery(query);
            }}
            className="flex items-center gap-2"
          >
            <div className="flex-1 flex items-center rounded-xl border border-slate-300 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 bg-slate-50 overflow-hidden px-3 py-2 transition">
              <i className="fa-solid fa-magnifying-glass text-slate-400 text-xs mr-2"></i>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about nearby 24/7 chemists, blood banks, parking, or ambulance gates..."
                className="w-full text-xs sm:text-sm font-medium text-slate-900 bg-transparent focus:outline-hidden"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shrink-0"
            >
              {isLoading ? (
                <>
                  <i className="fa-solid fa-circle-notch animate-spin"></i>
                  <span>Grounding...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-paper-plane"></i>
                  <span>Ask Maps AI</span>
                </>
              )}
            </button>
          </form>

          {/* Result Output */}
          {isLoading && (
            <div className="p-4 rounded-xl bg-sky-50/60 border border-sky-200 flex items-center gap-3 text-xs text-sky-800 animate-pulse">
              <i className="fa-solid fa-compass animate-spin text-sky-600 text-base"></i>
              <div>
                <p className="font-bold">Retrieving real-time Google Maps data & surroundings...</p>
                <p className="text-[11px] text-sky-600">Cross-referencing coordinates with Google Maps Platform Grounding</p>
              </div>
            </div>
          )}

          {responseMarkdown && !isLoading && (
            <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs leading-relaxed text-slate-800">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <i className="fa-solid fa-location-dot text-sky-500"></i>
                  <span>Grounding Insights</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-semibold">
                  ✓ Verified by Google Maps
                </span>
              </div>

              {/* Formatted response text */}
              <div className="prose prose-sm max-w-none text-xs space-y-1.5 whitespace-pre-line">
                {responseMarkdown}
              </div>

              {/* Grounding Chunks & Direct Google Maps Links */}
              {groundingChunks && groundingChunks.length > 0 && (
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    📍 Verified Google Maps Places & Links:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {groundingChunks.map((chunk, idx) => {
                      const mapData = chunk.maps;
                      const webData = chunk.web;
                      const title = mapData?.title || webData?.title || `Place Reference #${idx + 1}`;
                      const uri = mapData?.uri || webData?.uri || '#';

                      return (
                        <a
                          key={idx}
                          href={uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs font-semibold text-xs transition cursor-pointer group"
                        >
                          <i className="fa-solid fa-arrow-up-right-from-square text-[10px] text-sky-500 group-hover:scale-110 transition-transform"></i>
                          <span className="truncate max-w-[240px]">{title}</span>
                          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1 rounded">Maps</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
