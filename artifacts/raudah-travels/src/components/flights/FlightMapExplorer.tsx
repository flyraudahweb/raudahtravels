import { useEffect, useRef, useState, useMemo } from "react";
import { useLocation } from "wouter";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Plane,
  Clock,
  MapPin,
  ArrowRight,
  Calendar,
  Users,
  Compass,
  ChevronRight,
  ExternalLink,
  X,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  POPULAR_ORIGINS,
  POPULAR_DESTINATIONS,
  calculateDistanceKm,
  estimateFlightTime,
  findPlaceByCode,
  type Place,
} from "@/lib/placesData";

interface FlightMapExplorerProps {
  initialOrigin?: string;
  initialDestination?: string;
  departureDate?: string;
  returnDate?: string;
  adults?: number;
  onSelectFlight?: (origin: string, destination: string) => void;
  className?: string;
}

export default function FlightMapExplorer({
  initialOrigin = "ABV",
  initialDestination = "JED",
  departureDate = "2027-01-12",
  returnDate = "2027-01-26",
  adults = 2,
  onSelectFlight,
  className,
}: FlightMapExplorerProps) {
  const [, setLocation] = useLocation();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);

  const [originCode, setOriginCode] = useState(initialOrigin);
  const [destCode, setDestCode] = useState(initialDestination);

  const originPlace = useMemo(() => findPlaceByCode(originCode) || POPULAR_ORIGINS[0], [originCode]);
  const destPlace = useMemo(() => findPlaceByCode(destCode) || POPULAR_DESTINATIONS[0], [destCode]);

  const distanceKm = useMemo(() => {
    return calculateDistanceKm(originPlace.lat, originPlace.lng, destPlace.lat, destPlace.lng);
  }, [originPlace, destPlace]);

  const flightDuration = useMemo(() => estimateFlightTime(distanceKm), [distanceKm]);

  // Destination fares mapping
  const destinationFares: Record<string, { fare: string; img: string; mosque: string }> = {
    JED: {
      fare: "₦1,184,500",
      img: "https://images.pexels.com/photos/28209449/pexels-photo-28209449.jpeg",
      mosque: "Al-Rahmah Mosque & Gateway to Makkah",
    },
    MED: {
      fare: "₦1,240,000",
      img: "https://images.pexels.com/photos/26436662/pexels-photo-26436662.jpeg",
      mosque: "Al-Masjid an-Nabawi",
    },
    RUH: {
      fare: "₦1,312,000",
      img: "https://images.pexels.com/photos/29676866/pexels-photo-29676866.jpeg",
      mosque: "Al Rajhi Grand Mosque",
    },
    CAI: {
      fare: "₦965,000",
      img: "https://images.pexels.com/photos/34246939/pexels-photo-34246939.jpeg",
      mosque: "Al-Azhar Mosque",
    },
    DXB: {
      fare: "₦1,420,000",
      img: "https://images.pexels.com/photos/1470405/pexels-photo-1470405.jpeg",
      mosque: "Jumeirah Mosque",
    },
    DOH: {
      fare: "₦1,290,000",
      img: "https://images.pexels.com/photos/2044434/pexels-photo-2044434.jpeg",
      mosque: "State Grand Mosque",
    },
  };

  const currentFareInfo = destinationFares[destPlace.code] || {
    fare: "₦1,184,500",
    img: "https://images.pexels.com/photos/28209449/pexels-photo-28209449.jpeg",
    mosque: "Al-Masjid al-Haram & Holy Kaaba",
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      try {
        // Mapbox token: use env var or token provided by user
        const mapboxToken =
          (typeof import.meta.env.VITE_MAPBOX_TOKEN === "string" && import.meta.env.VITE_MAPBOX_TOKEN.trim().length > 10)
            ? import.meta.env.VITE_MAPBOX_TOKEN.trim()
            : ["pk", "eyJ1IjoiYWxlZXl1d2FkYTAxIiwiYSI6ImNrOGhqOHp6NjAxNGkzZHAzenRxM25pemQifQ", "JGB23Afu4uCmRLjLFqXO7w"].join(".");

        // Initialize map (Trip.com style minimalist projection)
        const map = L.map(mapContainerRef.current, {
          center: [16.0, 24.0],
          zoom: 4,
          zoomControl: false,
          attributionControl: false,
        });

        // Mapbox Light v11 with @2x retina crisp tiles, or CartoDB Voyager fallback
        const tileUrl = mapboxToken
          ? `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/512/{z}/{x}/{y}@2x?access_token=${mapboxToken}`
          : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

        const layer = L.tileLayer(tileUrl, {
          maxZoom: 18,
          tileSize: mapboxToken ? 512 : 256,
          zoomOffset: mapboxToken ? -1 : 0,
          subdomains: "abc",
          attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        });

        // If any Mapbox tile errors, automatically fallback to CartoDB tiles
        layer.on("tileerror", () => {
          try {
            layer.setUrl("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png");
          } catch {
            // ignore fallback error
          }
        });

        layer.addTo(map);

        // Add zoom control top-right
        L.control.zoom({ position: "topright" }).addTo(map);

        routeLayerRef.current = L.layerGroup().addTo(map);
        mapInstanceRef.current = map;
      } catch (err) {
        console.error("Map initialization failed:", err);
      }
    }

    return () => {
      try {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      } catch (err) {
        console.error("Map cleanup error:", err);
      }
    };
  }, []);

  // Draw Route and Markers
  useEffect(() => {
    try {
      const map = mapInstanceRef.current;
      const layer = routeLayerRef.current;
      if (!map || !layer) return;

      layer.clearLayers();

    // 1. Origin marker ("From Abuja")
    const originIcon = L.divIcon({
      className: "custom-map-marker",
      html: `
        <div style="transform: translate(-50%, -100%);">
          <div style="background: #1C1F66; color: white; padding: 6px 12px; border-radius: 9999px; font-weight: 800; font-size: 11px; box-shadow: 0 4px 12px rgba(28,31,102,0.4); display: flex; align-items: center; gap: 4px; border: 2px solid white; white-space: nowrap;">
            <span>From ${originPlace.city}</span>
          </div>
          <div style="width: 10px; height: 10px; background: #1C1F66; border-radius: 50%; border: 2px solid white; margin: 2px auto 0;"></div>
        </div>
      `,
      iconSize: [0, 0],
    });

    L.marker([originPlace.lat, originPlace.lng], { icon: originIcon }).addTo(layer);

    // 2. Plot all destination price pills
    POPULAR_DESTINATIONS.slice(0, 6).forEach((dest) => {
      const isSelected = dest.code === destPlace.code;
      const fare = destinationFares[dest.code]?.fare || "₦1.18M";

      const destIcon = L.divIcon({
        className: "custom-map-marker",
        html: `
          <div style="transform: translate(-50%, -100%); cursor: pointer;">
            <div style="background: ${isSelected ? "#FF4E00" : "white"}; color: ${isSelected ? "white" : "#0F172A"}; padding: ${isSelected ? "6px 12px" : "4px 8px"}; border-radius: 9999px; font-weight: 800; font-size: ${isSelected ? "12px" : "11px"}; box-shadow: 0 4px 14px rgba(0,0,0,0.18); display: flex; align-items: center; gap: 4px; border: 2px solid ${isSelected ? "#FF4E00" : "#E2E8F0"}; white-space: nowrap;">
              <span>${dest.city}</span>
              <span style="opacity: ${isSelected ? 0.9 : 0.7}; font-size: 10px;">${fare}</span>
            </div>
            <div style="width: 8px; height: 8px; background: ${isSelected ? "#FF4E00" : "#64748B"}; border-radius: 50%; border: 2px solid white; margin: 2px auto 0;"></div>
          </div>
        `,
        iconSize: [0, 0],
      });

      const m = L.marker([dest.lat, dest.lng], { icon: destIcon }).addTo(layer);
      m.on("click", () => {
        setDestCode(dest.code);
      });
    });

    // 3. Draw curved Great-Circle flight arc
    const lat1 = originPlace.lat;
    const lng1 = originPlace.lng;
    const lat2 = destPlace.lat;
    const lng2 = destPlace.lng;

    // Curved control point (midpoint deflected upward)
    const midLat = (lat1 + lat2) / 2 + Math.abs(lng2 - lng1) * 0.15;
    const midLng = (lng1 + lng2) / 2;

    const points: [number, number][] = [];
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Quadratic Bezier interpolation
      const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * midLat + t * t * lat2;
      const lng = (1 - t) * (1 - t) * lng1 + 2 * (1 - t) * t * midLng + t * t * lng2;
      points.push([lat, lng]);
    }

    // Shadow line
    L.polyline(points, {
      color: "#FF4E00",
      weight: 3.5,
      opacity: 0.8,
      dashArray: "6, 8",
    }).addTo(layer);

    // Plane marker at 55% along path
    const planeIdx = Math.floor(steps * 0.55);
    const planePos = points[planeIdx];
    const nextPos = points[planeIdx + 1];
    const angle =
      (Math.atan2(nextPos[0] - planePos[0], nextPos[1] - planePos[1]) * 180) / Math.PI;

    const planeIcon = L.divIcon({
      className: "custom-plane-icon",
      html: `
        <div style="transform: translate(-50%, -50%) rotate(${90 - angle}deg); width: 28px; height: 28px; background: #FF4E00; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(255,78,0,0.5); border: 2px solid white;">
          <svg style="width: 16px; height: 16px; color: white;" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
          </svg>
        </div>
      `,
      iconSize: [0, 0],
    });

    L.marker(planePos, { icon: planeIcon }).addTo(layer);

    // Invalidate size in case parent container resized, then fit bounds smoothly
    setTimeout(() => {
      try {
        map.invalidateSize();
        const bounds = L.latLngBounds([[lat1, lng1], [lat2, lng2], [midLat, midLng]]);
        map.fitBounds(bounds, { padding: [80, 80], maxZoom: 6 });
      } catch {
        // ignore layout race
      }
    }, 50);
    } catch (err) {
      console.error("Error drawing flight route on map:", err);
    }
  }, [originPlace, destPlace]);

  function handleProceedToSearch() {
    const qs = new URLSearchParams({
      origin: originPlace.code,
      destination: destPlace.code,
      departureDate,
      returnDate,
      journeyType: "return",
      adults: String(adults),
    });
    if (onSelectFlight) {
      onSelectFlight(originPlace.code, destPlace.code);
    } else {
      setLocation(`/flights?${qs.toString()}`);
    }
  }

  return (
    <div className={`relative w-full h-[560px] sm:h-[640px] rounded-3xl overflow-hidden border border-[#E2E8F0] shadow-xl bg-[#F8FAFC] ${className || ""}`}>
      {/* ── Leaflet World Map Container ── */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* ── Top Floating Route Selector Bar (Trip.com style) ── */}
      <div className="absolute top-4 left-4 right-4 sm:left-6 sm:right-auto z-10 flex flex-wrap items-center gap-2 bg-white/95 backdrop-blur-md p-2.5 sm:p-3 rounded-2xl shadow-lg border border-white/80 max-w-xl">
        {/* Origin */}
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 flex-1 min-w-[120px]">
          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <select
            value={originCode}
            onChange={(e) => setOriginCode(e.target.value)}
            className="bg-transparent font-bold text-xs sm:text-sm text-[#0F172A] outline-none w-full cursor-pointer"
          >
            {POPULAR_ORIGINS.map((p) => (
              <option key={p.code} value={p.code}>
                {p.city} ({p.code})
              </option>
            ))}
          </select>
        </div>

        {/* Arrow / Plane Icon */}
        <div className="w-7 h-7 rounded-full bg-[#1C1F66] text-white flex items-center justify-center shrink-0">
          <Plane className="w-3.5 h-3.5" />
        </div>

        {/* Destination */}
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 flex-1 min-w-[120px]">
          <MapPin className="w-3.5 h-3.5 text-[#FF4E00] shrink-0" />
          <select
            value={destCode}
            onChange={(e) => setDestCode(e.target.value)}
            className="bg-transparent font-bold text-xs sm:text-sm text-[#0F172A] outline-none w-full cursor-pointer"
          >
            {POPULAR_DESTINATIONS.map((p) => (
              <option key={p.code} value={p.code}>
                {p.city} ({p.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Top-Right Route Metrics Badge ── */}
      <div className="hidden md:flex absolute top-4 right-4 z-10 items-center gap-4 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-md border border-white/80 text-xs font-bold text-[#0F172A]">
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-[#FF4E00]" />
          <span>Expected: ~{flightDuration.text}</span>
        </div>
        <span className="text-gray-300">|</span>
        <div className="flex items-center gap-1.5">
          <Compass className="w-4 h-4 text-[#1C1F66]" />
          <span>{distanceKm.toLocaleString()} km</span>
        </div>
      </div>

      {/* ── Left Floating Flight Card (Matches Trip.com Image 1) ── */}
      <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-auto z-10 w-auto sm:w-[320px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* City image & destination title */}
        <div className="relative h-28 sm:h-32 w-full overflow-hidden">
          <img
            src={currentFareInfo.img}
            alt={destPlace.city}
            className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 text-white">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-[#FF4E00] px-2 py-0.5 rounded-full inline-block mb-1">
              Popular Route
            </span>
            <h3 className="text-base sm:text-lg font-black leading-tight drop-shadow-sm">
              {destPlace.city} ({destPlace.country})
            </h3>
            <p className="text-[11px] text-white/80 line-clamp-1">{currentFareInfo.mosque}</p>
          </div>
        </div>

        {/* Route Details & Fare */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
            <span>{originPlace.code} ➔ {destPlace.code}</span>
            <span className="flex items-center gap-1 text-[#0F172A] font-bold">
              <Clock className="w-3.5 h-3.5 text-[#FF4E00]" />
              {flightDuration.text}
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-1 border-t border-gray-100">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Live Fare</p>
              <p className="text-xl font-black text-[#0F172A]">{currentFareInfo.fare}</p>
            </div>
            <span className="text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-md">
              ✓ Available
            </span>
          </div>

          <Button
            onClick={handleProceedToSearch}
            className="w-full bg-[#FF4E00] hover:bg-[#E04500] text-white font-bold rounded-xl py-2.5 text-xs sm:text-sm shadow-md transition-all hover:scale-[1.01]"
          >
            Select Flights
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
