import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Plane,
  Building2,
  Package,
  Search,
  MapPin,
  Calendar,
  Users,
  ChevronDown,
  ArrowRightLeft,
  Map as MapIcon,
  Check,
  Briefcase,
  Plus,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  POPULAR_ORIGINS,
  POPULAR_DESTINATIONS,
  HOTEL_DESTINATIONS,
  type Place,
} from "@/lib/placesData";

type Tab = "hotels" | "flights" | "packages" | "flight_hotel";
type TripType = "round_trip" | "one_way" | "multi_city";

/* ── Date formatting helper ─────────────────────────────────────────────── */
function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function addDaysToDate(dateStr: string, days: number): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  } catch {
    return dateStr;
  }
}

/* ── 1. HOTEL: Where To Selector ────────────────────────────────────────── */
function HotelWhereToSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (destId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLDivElement>(null);

  const current = HOTEL_DESTINATIONS.find((h) => h.id === value) || HOTEL_DESTINATIONS[0];

  const filtered = query.trim()
    ? HOTEL_DESTINATIONS.filter(
        (d) =>
          d.name.toLowerCase().includes(query.toLowerCase()) ||
          d.subtitle.toLowerCase().includes(query.toLowerCase())
      )
    : HOTEL_DESTINATIONS;

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={triggerRef} className="relative flex-[1.4] min-w-0">
      <div
        className="w-full text-left flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/90 transition-colors cursor-pointer select-none rounded-xl md:rounded-none"
        onClick={() => setOpen((prev) => !prev)}
      >
        <MapPin className="w-5 h-5 text-gray-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-1">Where to?</p>
          <p className="font-extrabold text-sm sm:text-base text-gray-900 truncate leading-tight">{current.name}</p>
          <p className="text-[10px] text-gray-400 truncate mt-0.5 leading-none">{current.subtitle}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </div>

      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 z-50 w-full sm:w-[340px] md:w-[380px] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.22)] border border-gray-200 py-2 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3.5 pb-2 pt-1 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search city, district, or area..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-sm font-medium outline-none focus:border-[#FF4E00] focus:bg-white transition-all"
            />
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            <p className="px-4 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Popular Destinations</p>
            {filtered.map((dest) => {
              const isSelected = dest.id === value;
              return (
                <button
                  key={dest.id}
                  type="button"
                  onClick={() => {
                    onChange(dest.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                    isSelected ? "bg-orange-50/80 text-[#FF4E00]" : "hover:bg-gray-50 text-gray-900"
                  }`}
                >
                  <span className="text-xl shrink-0">{dest.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm leading-tight ${isSelected ? "text-[#FF4E00]" : "text-gray-900"}`}>{dest.name}</p>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{dest.subtitle}</p>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[#FF4E00] shrink-0" />}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-4 py-4 text-sm text-gray-400 text-center">No destination matches "{query}"</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 2. HOTEL: Dates Selector Popover ───────────────────────────────────── */
function HotelDateSelector({
  checkIn,
  checkOut,
  onCheckInChange,
  onCheckOutChange,
  nights,
}: {
  checkIn: string;
  checkOut: string;
  onCheckInChange: (v: string) => void;
  onCheckOutChange: (v: string) => void;
  nights: number;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function setStayDuration(days: number) {
    onCheckOutChange(addDaysToDate(checkIn, days));
  }

  return (
    <div ref={triggerRef} className="relative flex-[1.6] min-w-0">
      <div
        className="w-full text-left flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/90 transition-colors cursor-pointer select-none rounded-xl md:rounded-none"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Calendar className="w-5 h-5 text-gray-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-1">Check-in — Check-out</p>
          <p className="font-extrabold text-sm sm:text-base text-gray-900 truncate leading-tight">
            {formatDisplayDate(checkIn)} — {formatDisplayDate(checkOut)}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-bold text-[#FF4E00] bg-orange-50 px-1.5 py-0.2 rounded">
              {nights} {nights === 1 ? "night" : "nights"}
            </span>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </div>

      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 z-50 w-full sm:w-[340px] md:w-[380px] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.22)] border border-gray-200 p-4 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <p className="font-bold text-sm text-gray-900">Select Stay Dates</p>
              <p className="text-xs text-gray-400 mt-0.5">{nights} {nights === 1 ? "night" : "nights"} selected</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-bold text-[#FF4E00] hover:underline"
            >
              Done
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Check-in</label>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => {
                  onCheckInChange(e.target.value);
                  if (e.target.value >= checkOut) {
                    onCheckOutChange(addDaysToDate(e.target.value, 1));
                  }
                }}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-bold text-gray-900 outline-none focus:border-[#FF4E00] cursor-pointer"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Check-out</label>
              <input
                type="date"
                value={checkOut}
                min={checkIn}
                onChange={(e) => onCheckOutChange(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-bold text-gray-900 outline-none focus:border-[#FF4E00] cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Quick Duration</p>
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 3, 7, 14].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setStayDuration(d)}
                  className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    nights === d
                      ? "bg-[#FF4E00] text-white border-[#FF4E00]"
                      : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {d} {d === 1 ? "Night" : "Nights"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 3. HOTEL: Rooms & Guests Popover ───────────────────────────────────── */
function HotelGuestsSelector({
  rooms,
  adults,
  onRoomsChange,
  onAdultsChange,
}: {
  rooms: number;
  adults: number;
  onRoomsChange: (v: number) => void;
  onAdultsChange: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={triggerRef} className="relative flex-1 min-w-0">
      <div
        className="w-full text-left flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/90 transition-colors cursor-pointer select-none rounded-xl md:rounded-none"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Users className="w-5 h-5 text-gray-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-1">Rooms &amp; Guests</p>
          <p className="font-extrabold text-sm sm:text-base text-gray-900 truncate leading-tight">
            {rooms} {rooms === 1 ? "Room" : "Rooms"}, {adults} {adults === 1 ? "Adult" : "Adults"}
          </p>
          <p className="text-[10px] text-gray-400 truncate mt-0.5 leading-none">0 children</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </div>

      {open && (
        <div className="absolute top-[calc(100%+6px)] right-0 md:left-0 z-50 w-full sm:w-[300px] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.22)] border border-gray-200 p-4 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <p className="font-bold text-sm text-gray-900">Rooms &amp; Guests</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-bold text-[#FF4E00] hover:underline"
            >
              Done
            </button>
          </div>

          {/* Rooms Counter */}
          <div className="flex items-center justify-between py-3 border-b border-gray-50">
            <div>
              <p className="text-sm font-bold text-gray-900">Rooms</p>
              <p className="text-xs text-gray-400">Number of rooms required</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onRoomsChange(Math.max(1, rooms - 1))}
                className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-700 font-bold"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-5 text-center text-sm font-bold">{rooms}</span>
              <button
                type="button"
                onClick={() => onRoomsChange(Math.min(10, rooms + 1))}
                className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-700 font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Adults Counter */}
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-bold text-gray-900">Adults</p>
              <p className="text-xs text-gray-400">Ages 18 and above</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onAdultsChange(Math.max(1, adults - 1))}
                className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-700 font-bold"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-5 text-center text-sm font-bold">{adults}</span>
              <button
                type="button"
                onClick={() => onAdultsChange(Math.min(20, adults + 1))}
                className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-700 font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 4. FLIGHT: Airport Selector ────────────────────────────────────────── */
function AirportSelector({
  label,
  valueCode,
  onChange,
  placesList,
}: {
  label: string;
  valueCode: string;
  onChange: (code: string) => void;
  placesList: Place[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLDivElement>(null);

  const allPlaces = [...POPULAR_ORIGINS, ...POPULAR_DESTINATIONS];
  const selected = allPlaces.find((p) => p.code === valueCode) || placesList[0];

  const filtered = query.trim()
    ? allPlaces.filter(
        (p) =>
          p.city.toLowerCase().includes(query.toLowerCase()) ||
          p.code.toLowerCase().includes(query.toLowerCase()) ||
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.country.toLowerCase().includes(query.toLowerCase())
      )
    : placesList;

  const grouped = filtered.reduce<Record<string, Place[]>>((acc, p) => {
    if (!acc[p.country]) acc[p.country] = [];
    acc[p.country].push(p);
    return acc;
  }, {});

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={triggerRef} className="relative flex-1 min-w-0">
      <div
        className="w-full text-left px-4 py-3.5 hover:bg-gray-50/90 transition-colors cursor-pointer select-none rounded-xl md:rounded-none"
        onClick={() => setOpen((prev) => !prev)}
      >
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-1">{label}</p>
        <p className="font-extrabold text-sm sm:text-base text-gray-900 truncate leading-tight">{selected?.city}</p>
        <p className="text-[10px] text-gray-400 truncate leading-none mt-0.5">{selected?.code} · {selected?.name}</p>
      </div>

      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 z-50 w-full sm:w-[320px] md:w-[360px] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.22)] border border-gray-200 py-2 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3.5 pb-2 pt-1 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()} city or airport...`}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-sm font-medium outline-none focus:border-[#FF4E00] focus:bg-white transition-all"
            />
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {Object.entries(grouped).map(([country, places]) => (
              <div key={country}>
                <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50/60 border-y border-gray-100/60">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#FF4E00]" />
                    <span className="text-xs font-bold text-[#FF4E00]">{country}</span>
                  </div>
                  {!query && <span className="text-[10px] text-gray-400 font-medium">Explore top deals &gt;</span>}
                </div>
                {places.map((place) => {
                  const isSelected = place.code === valueCode;
                  return (
                    <button
                      key={place.code}
                      type="button"
                      onClick={() => {
                        onChange(place.code);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                        isSelected ? "bg-orange-50/80" : "hover:bg-gray-50"
                      }`}
                    >
                      <Plane className={`w-4 h-4 shrink-0 ${isSelected ? "text-[#FF4E00]" : "text-gray-300"}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${isSelected ? "text-[#FF4E00]" : "text-gray-900"}`}>{place.city}</p>
                        <p className="text-[11px] text-gray-400 truncate">{place.code} · {place.name}</p>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-[#FF4E00] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="px-4 py-4 text-sm text-gray-400 text-center">No airports found for "{query}"</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 5. FLIGHT: Dates Selector Popover (Unified Round-Trip / One-Way) ────── */
function FlightDateSelector({
  tripType,
  depDate,
  retDate,
  onDepChange,
  onRetChange,
}: {
  tripType: TripType;
  depDate: string;
  retDate: string;
  onDepChange: (v: string) => void;
  onRetChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const daysDiff = useMemo(() => {
    try {
      const d1 = new Date(depDate);
      const d2 = new Date(retDate);
      const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      return diff > 0 ? diff : 0;
    } catch {
      return 0;
    }
  }, [depDate, retDate]);

  function setTripDuration(days: number) {
    onRetChange(addDaysToDate(depDate, days));
  }

  return (
    <div ref={triggerRef} className="relative flex-[1.4] min-w-0">
      <div
        className="w-full text-left flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/90 transition-colors cursor-pointer select-none rounded-xl md:rounded-none"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Calendar className="w-5 h-5 text-gray-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-1">
            {tripType === "round_trip" ? "Depart — Return" : "Departure Date"}
          </p>
          <p className="font-extrabold text-sm sm:text-base text-gray-900 truncate leading-tight">
            {tripType === "round_trip"
              ? `${formatDisplayDate(depDate)} — ${formatDisplayDate(retDate)}`
              : formatDisplayDate(depDate)}
          </p>
          {tripType === "round_trip" && daysDiff > 0 && (
            <p className="text-[10px] font-bold text-[#FF4E00] mt-0.5 leading-none">
              {daysDiff} {daysDiff === 1 ? "day trip" : "days trip"}
            </p>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </div>

      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 z-50 w-full sm:w-[340px] md:w-[380px] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.22)] border border-gray-200 p-4 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <p className="font-bold text-sm text-gray-900">
                {tripType === "round_trip" ? "Select Flight Dates" : "Select Departure Date"}
              </p>
              {tripType === "round_trip" && (
                <p className="text-xs text-gray-400 mt-0.5">{daysDiff} days duration</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-bold text-[#FF4E00] hover:underline"
            >
              Done
            </button>
          </div>

          <div className={`grid ${tripType === "round_trip" ? "grid-cols-2" : "grid-cols-1"} gap-3 pt-3`}>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Depart</label>
              <input
                type="date"
                value={depDate}
                onChange={(e) => {
                  onDepChange(e.target.value);
                  if (tripType === "round_trip" && e.target.value >= retDate) {
                    onRetChange(addDaysToDate(e.target.value, 7));
                  }
                }}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-bold text-gray-900 outline-none focus:border-[#FF4E00] cursor-pointer"
              />
            </div>
            {tripType === "round_trip" && (
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Return</label>
                <input
                  type="date"
                  value={retDate}
                  min={depDate}
                  onChange={(e) => onRetChange(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-bold text-gray-900 outline-none focus:border-[#FF4E00] cursor-pointer"
                />
              </div>
            )}
          </div>

          {tripType === "round_trip" && (
            <div className="pt-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Popular Stay Durations</p>
              <div className="grid grid-cols-4 gap-1.5">
                {[7, 14, 21, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setTripDuration(d)}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      daysDiff === d
                        ? "bg-[#FF4E00] text-white border-[#FF4E00]"
                        : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {d} Days
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── 6. FLIGHT: Travellers Popover ──────────────────────────────────────── */
function FlightTravellersSelector({
  adults,
  onAdultsChange,
}: {
  adults: number;
  onAdultsChange: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={triggerRef} className="relative flex-1 min-w-0">
      <div
        className="w-full text-left flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/90 transition-colors cursor-pointer select-none rounded-xl md:rounded-none"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Users className="w-5 h-5 text-gray-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-1">Travellers</p>
          <p className="font-extrabold text-sm sm:text-base text-gray-900 truncate leading-tight">
            {adults} {adults === 1 ? "Adult" : "Adults"}
          </p>
          <p className="text-[10px] text-gray-400 truncate mt-0.5 leading-none">Economy</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </div>

      {open && (
        <div className="absolute top-[calc(100%+6px)] right-0 md:left-0 z-50 w-full sm:w-[300px] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.22)] border border-gray-200 p-4 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <p className="font-bold text-sm text-gray-900">Passengers</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-bold text-[#FF4E00] hover:underline"
            >
              Done
            </button>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-gray-50">
            <div>
              <p className="text-sm font-bold text-gray-900">Adults</p>
              <p className="text-xs text-gray-400">12+ years</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onAdultsChange(Math.max(1, adults - 1))}
                className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-700 font-bold"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-5 text-center text-sm font-bold">{adults}</span>
              <button
                type="button"
                onClick={() => onAdultsChange(Math.min(9, adults + 1))}
                className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-700 font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="pt-3">
            <p className="text-xs font-bold text-gray-500 mb-1.5">Cabin Class</p>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-center py-1.5 px-3 bg-orange-50 text-[#FF4E00] border border-orange-200 text-xs font-bold rounded-lg cursor-pointer">
                Economy
              </span>
              <span className="text-center py-1.5 px-3 bg-gray-50 text-gray-400 border border-gray-200 text-xs font-semibold rounded-lg cursor-not-allowed">
                Business
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── MAIN OTA SEARCH WIDGET ─────────────────────────────────────────────── */
export default function OtaSearchWidget() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("flights");
  const [tripType, setTripType] = useState<TripType>("round_trip");
  const [isNonstopOnly, setIsNonstopOnly] = useState(false);

  // Flights state
  const [origin, setOrigin] = useState("ABV");
  const [destination, setDestination] = useState("JED");
  const [depDate, setDepDate] = useState("2027-01-12");
  const [retDate, setRetDate] = useState("2027-01-26");
  const [adults, setAdults] = useState(2);

  // Hotels state
  const [hotelDest, setHotelDest] = useState("makkah");
  const [checkIn, setCheckIn] = useState("2027-01-12");
  const [checkOut, setCheckOut] = useState("2027-01-19");
  const [hotelRooms, setHotelRooms] = useState(1);
  const [hotelAdults, setHotelAdults] = useState(2);

  // Calculate nights
  const hotelNights = useMemo(() => {
    try {
      const d1 = new Date(checkIn);
      const d2 = new Date(checkOut);
      const diffTime = Math.abs(d2.getTime() - d1.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 1;
    } catch {
      return 1;
    }
  }, [checkIn, checkOut]);

  // Swap From & To
  function handleSwap() {
    setOrigin(destination);
    setDestination(origin);
  }

  function handleFlightSearch() {
    const qs = new URLSearchParams({
      origin,
      destination,
      departureDate: depDate,
      journeyType: tripType === "round_trip" ? "return" : "one_way",
      adults: String(adults),
    });
    if (tripType === "round_trip" && retDate) qs.set("returnDate", retDate);
    setLocation(`/flights?${qs.toString()}`);
  }

  function handleMapExplore() {
    const flightRoutesEl = document.getElementById("flight-routes");
    if (flightRoutesEl) {
      window.dispatchEvent(
        new CustomEvent("flight-route-selected", {
          detail: { origin, destination },
        })
      );
      flightRoutesEl.scrollIntoView({ behavior: "smooth" });
    } else {
      const qs = new URLSearchParams({
        origin,
        destination,
        departureDate: depDate,
        returnDate: retDate,
        map: "true",
      });
      setLocation(`/flights?${qs.toString()}`);
    }
  }

  function handleHotelSearch() {
    const qs = new URLSearchParams({ dest: hotelDest });
    if (checkIn) qs.set("checkin", checkIn);
    if (checkOut) qs.set("checkout", checkOut);
    qs.set("rooms", String(hotelRooms));
    qs.set("adults", String(hotelAdults));
    setLocation(`/hotels/search?${qs.toString()}`);
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* ── Main Card (No overflow-hidden so popovers appear seamlessly on PC) ── */}
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-[0_20px_60px_rgba(15,23,42,0.18)] border border-gray-100 p-4 sm:p-6 md:p-7 text-left transition-all">
        {/* Top Service Tabs */}
        <div className="flex items-center gap-6 sm:gap-10 border-b border-gray-100 pb-2 mb-5 overflow-x-auto no-scrollbar">
          {/* Hotels & Homes Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("hotels")}
            className={`flex flex-col items-center gap-1.5 pb-2 relative shrink-0 transition-colors group ${
              activeTab === "hotels" ? "text-[#FF4E00]" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <Building2 className={`w-6 h-6 transition-colors ${activeTab === "hotels" ? "text-[#FF4E00]" : "text-gray-400 group-hover:text-gray-600"}`} />
            <span className="text-xs sm:text-sm font-bold tracking-tight">Hotels &amp; Homes</span>
            {activeTab === "hotels" && (
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-[#FF4E00] rounded-full" />
            )}
          </button>

          {/* Flights Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("flights")}
            className={`flex flex-col items-center gap-1.5 pb-2 relative shrink-0 transition-colors group ${
              activeTab === "flights" ? "text-[#FF4E00]" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <Plane className={`w-6 h-6 transition-colors ${activeTab === "flights" ? "text-[#FF4E00]" : "text-gray-400 group-hover:text-gray-600"}`} />
            <span className="text-xs sm:text-sm font-bold tracking-tight">Flights</span>
            {activeTab === "flights" && (
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-[#FF4E00] rounded-full" />
            )}
          </button>

          {/* Hajj & Umrah Packages Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("packages")}
            className={`flex flex-col items-center gap-1.5 pb-2 relative shrink-0 transition-colors group ${
              activeTab === "packages" ? "text-[#FF4E00]" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <Package className={`w-6 h-6 transition-colors ${activeTab === "packages" ? "text-[#FF4E00]" : "text-gray-400 group-hover:text-gray-600"}`} />
            <span className="text-xs sm:text-sm font-bold tracking-tight">Hajj &amp; Umrah</span>
            {activeTab === "packages" && (
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-[#FF4E00] rounded-full" />
            )}
          </button>

          {/* Flight + Hotel Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("flight_hotel")}
            className={`flex flex-col items-center gap-1.5 pb-2 relative shrink-0 transition-colors group ${
              activeTab === "flight_hotel" ? "text-[#FF4E00]" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <Briefcase className={`w-6 h-6 transition-colors ${activeTab === "flight_hotel" ? "text-[#FF4E00]" : "text-gray-400 group-hover:text-gray-600"}`} />
            <span className="text-xs sm:text-sm font-bold tracking-tight">Flight + Hotel</span>
            {activeTab === "flight_hotel" && (
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-[#FF4E00] rounded-full" />
            )}
          </button>
        </div>

        {/* ── 1: HOTELS & HOMES PANEL ── */}
        {activeTab === "hotels" && (
          <div className="space-y-3">
            {/* Unified Segmented Bar — NO overflow-hidden so popovers display cleanly */}
            <div className="border border-gray-300 hover:border-gray-400 transition-colors rounded-xl md:rounded-2xl flex flex-col md:flex-row items-stretch bg-white shadow-sm relative">
              {/* Segment 1: Destination */}
              <HotelWhereToSelector value={hotelDest} onChange={setHotelDest} />

              {/* Vertical divider */}
              <div className="hidden md:block w-px bg-gray-200 my-2 self-stretch" />

              {/* Segment 2: Dates (Check-in — Check-out) */}
              <HotelDateSelector
                checkIn={checkIn}
                checkOut={checkOut}
                onCheckInChange={setCheckIn}
                onCheckOutChange={setCheckOut}
                nights={hotelNights}
              />

              {/* Vertical divider */}
              <div className="hidden md:block w-px bg-gray-200 my-2 self-stretch" />

              {/* Segment 3: Rooms & Guests */}
              <HotelGuestsSelector
                rooms={hotelRooms}
                adults={hotelAdults}
                onRoomsChange={setHotelRooms}
                onAdultsChange={setHotelAdults}
              />

              {/* Segment 4: Search Button — Prominently visible on right */}
              <div className="p-2 flex items-center justify-center border-t md:border-t-0 md:border-l border-gray-100 shrink-0">
                <button
                  type="button"
                  onClick={handleHotelSearch}
                  className="w-full md:w-auto h-full px-7 sm:px-9 py-3.5 bg-[#FF4E00] hover:bg-[#E04500] text-white font-black rounded-lg md:rounded-xl text-sm sm:text-base flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 whitespace-nowrap"
                >
                  <Search className="w-4 h-4 stroke-[2.5]" />
                  <span>Search</span>
                </button>
              </div>
            </div>

            {/* Bottom auxiliary row: Quick select pills + Sign in prompt */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto">
                <span className="text-gray-400 font-medium shrink-0">Quick Select:</span>
                {HOTEL_DESTINATIONS.slice(0, 5).map((dest) => (
                  <button
                    key={dest.id}
                    type="button"
                    onClick={() => setHotelDest(dest.id)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                      hotelDest === dest.id
                        ? "bg-[#1C1F66] text-white shadow-sm"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <span>{dest.icon}</span>
                    <span>{dest.name}</span>
                  </button>
                ))}
              </div>

              <a
                href="/login"
                className="text-[#FF4E00] hover:underline font-semibold text-xs sm:text-[13px] self-end sm:self-center"
              >
                Sign in or register to unlock exclusive coupons &amp; rewards
              </a>
            </div>
          </div>
        )}

        {/* ── 2: FLIGHTS PANEL ── */}
        {activeTab === "flights" && (
          <div className="space-y-3">
            {/* Top Sub-row: Trip Type Radios & Nonstop Checkbox */}
            <div className="flex flex-wrap items-center gap-5 text-xs font-bold text-gray-700 pb-1">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="trip_type"
                  checked={tripType === "round_trip"}
                  onChange={() => setTripType("round_trip")}
                  className="accent-[#FF4E00] w-3.5 h-3.5"
                />
                <span>Round-trip</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="trip_type"
                  checked={tripType === "one_way"}
                  onChange={() => setTripType("one_way")}
                  className="accent-[#FF4E00] w-3.5 h-3.5"
                />
                <span>One-way</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="trip_type"
                  checked={tripType === "multi_city"}
                  onChange={() => setTripType("multi_city")}
                  className="accent-[#FF4E00] w-3.5 h-3.5"
                />
                <span>Multi-city</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-gray-500">
                <input
                  type="checkbox"
                  checked={isNonstopOnly}
                  onChange={(e) => setIsNonstopOnly(e.target.checked)}
                  className="accent-[#FF4E00] w-3.5 h-3.5"
                />
                <span>Direct flights only</span>
              </label>
            </div>

            {/* Unified Segmented Bar — NO overflow-hidden so popovers display cleanly */}
            <div className="border border-gray-300 hover:border-gray-400 transition-colors rounded-xl md:rounded-2xl flex flex-col md:flex-row items-stretch bg-white shadow-sm relative">
              {/* Origin */}
              <AirportSelector
                label="From"
                valueCode={origin}
                onChange={setOrigin}
                placesList={POPULAR_ORIGINS}
              />

              {/* Swap Button */}
              <div className="hidden md:flex items-center justify-center px-1">
                <button
                  type="button"
                  onClick={handleSwap}
                  className="w-7 h-7 rounded-full border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-[#FF4E00] transition-colors"
                  title="Swap Departure and Destination"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Vertical divider */}
              <div className="hidden md:block w-px bg-gray-200 my-2 self-stretch" />

              {/* Destination */}
              <AirportSelector
                label="To"
                valueCode={destination}
                onChange={setDestination}
                placesList={POPULAR_DESTINATIONS}
              />

              {/* Vertical divider */}
              <div className="hidden md:block w-px bg-gray-200 my-2 self-stretch" />

              {/* Dates Segment (Unified Depart & Return like Trip.com) */}
              <FlightDateSelector
                tripType={tripType}
                depDate={depDate}
                retDate={retDate}
                onDepChange={setDepDate}
                onRetChange={setRetDate}
              />

              {/* Vertical divider */}
              <div className="hidden md:block w-px bg-gray-200 my-2 self-stretch" />

              {/* Travellers */}
              <FlightTravellersSelector
                adults={adults}
                onAdultsChange={setAdults}
              />

              {/* Search Button — Prominently visible on right */}
              <div className="p-2 flex items-center justify-center border-t md:border-t-0 md:border-l border-gray-100 shrink-0">
                <button
                  type="button"
                  onClick={handleFlightSearch}
                  className="w-full md:w-auto h-full px-7 sm:px-9 py-3.5 bg-[#FF4E00] hover:bg-[#E04500] text-white font-black rounded-lg md:rounded-xl text-sm sm:text-base flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 whitespace-nowrap"
                >
                  <Search className="w-4 h-4 stroke-[2.5]" />
                  <span>Search</span>
                </button>
              </div>
            </div>

            {/* Bottom auxiliary row: Explore Route on Map + Sign in prompt */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleMapExplore}
                className="border-gray-200 hover:border-orange-300 hover:bg-orange-50/60 text-gray-700 hover:text-[#FF4E00] font-bold rounded-xl px-3.5 py-2 text-xs flex items-center gap-2 shadow-2xs transition-all active:scale-95"
              >
                <MapIcon className="w-3.5 h-3.5 text-[#FF4E00]" />
                <span>Explore Route on Map</span>
              </Button>

              <a
                href="/login"
                className="text-[#FF4E00] hover:underline font-semibold text-xs sm:text-[13px]"
              >
                Sign in or register to unlock exclusive coupons &amp; rewards
              </a>
            </div>
          </div>
        )}

        {/* ── 3: HAJJ & UMRAH PACKAGES PANEL ── */}
        {activeTab === "packages" && (
          <div className="space-y-3">
            <div className="border border-gray-300 hover:border-gray-400 transition-colors rounded-xl md:rounded-2xl flex flex-col md:flex-row items-center justify-between bg-white shadow-sm p-4 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#FF4E00] flex items-center justify-center shrink-0">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-gray-900 text-base">
                    All-Inclusive Hajj &amp; Umrah Packages 2027
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    5-star hotels right outside the Haramain, official visa approvals, expert scholarly guidance, and VIP transit.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                onClick={() => setLocation("/packages")}
                className="w-full md:w-auto px-8 py-3.5 bg-[#FF4E00] hover:bg-[#E04500] text-white font-black rounded-xl text-sm shadow-sm"
              >
                View All Packages
              </Button>
            </div>

            <div className="flex justify-end pt-1">
              <a href="/login" className="text-[#FF4E00] hover:underline font-semibold text-xs">
                Sign in or register to unlock wholesale agent rates
              </a>
            </div>
          </div>
        )}

        {/* ── 4: FLIGHT + HOTEL PANEL ── */}
        {activeTab === "flight_hotel" && (
          <div className="space-y-3">
            <div className="border border-gray-300 hover:border-gray-400 transition-colors rounded-xl md:rounded-2xl flex flex-col md:flex-row items-center justify-between bg-white shadow-sm p-4 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#FF4E00] flex items-center justify-center shrink-0">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-gray-900 text-base">
                    Save up to 25% with Combined Flight + Hotel
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Bundle return flights from Nigeria with premium Makkah and Madinah accommodations for guaranteed lower rates.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                onClick={() => setLocation("/packages")}
                className="w-full md:w-auto px-8 py-3.5 bg-[#FF4E00] hover:bg-[#E04500] text-white font-black rounded-xl text-sm shadow-sm"
              >
                Explore Bundles
              </Button>
            </div>

            <div className="flex justify-end pt-1">
              <a href="/login" className="text-[#FF4E00] hover:underline font-semibold text-xs">
                Sign in or register to unlock exclusive bundle discounts
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
