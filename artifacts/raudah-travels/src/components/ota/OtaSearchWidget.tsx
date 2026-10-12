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
  Compass,
  Briefcase,
  Sparkles,
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

/* ── 1-Tap Hotel Destination Picker (Trip.com text-input style) ────────── */
function HotelWhereToSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (destId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = HOTEL_DESTINATIONS.find((h) => h.id === value) || HOTEL_DESTINATIONS[0];

  const filtered = query.trim()
    ? HOTEL_DESTINATIONS.filter(
        (d) =>
          d.name.toLowerCase().includes(query.toLowerCase()) ||
          d.subtitle.toLowerCase().includes(query.toLowerCase())
      )
    : HOTEL_DESTINATIONS;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex-1 min-w-[160px] flex items-center">
      <div
        className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-gray-50/80 transition-colors rounded-l-xl md:rounded-l-2xl group cursor-text"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
      >
        <MapPin className="w-5 h-5 text-gray-400 shrink-0" />
        <div className="min-w-0 flex-1">
          {open ? (
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={current.name}
              className="w-full bg-transparent outline-none text-sm font-bold text-gray-900 placeholder:text-gray-400"
              autoFocus
            />
          ) : (
            <p className="font-bold text-sm text-gray-900 truncate">{current.name}</p>
          )}
        </div>
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 py-1 max-h-72 overflow-y-auto">
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
                  isSelected
                    ? "bg-orange-50 text-[#FF4E00]"
                    : "hover:bg-gray-50 text-gray-900"
                }`}
              >
                <MapPin className={`w-4 h-4 shrink-0 ${isSelected ? "text-[#FF4E00]" : "text-gray-400"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm leading-tight truncate ${isSelected ? "text-[#FF4E00]" : ""}`}>
                    {dest.name}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate">{dest.subtitle}</p>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-400 text-center">No destinations found</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Trip.com Style Airport Text-Input Selector ───────────────────────────── */
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
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allPlaces = [...POPULAR_ORIGINS, ...POPULAR_DESTINATIONS];
  const selected =
    allPlaces.find((p) => p.code === valueCode) || placesList[0];

  // Filter: search across city, code, name, and country
  const filtered = query.trim()
    ? allPlaces.filter(
        (p) =>
          p.city.toLowerCase().includes(query.toLowerCase()) ||
          p.code.toLowerCase().includes(query.toLowerCase()) ||
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.country.toLowerCase().includes(query.toLowerCase())
      )
    : placesList;

  // Group by country for display
  const grouped = filtered.reduce<Record<string, Place[]>>((acc, p) => {
    if (!acc[p.country]) acc[p.country] = [];
    acc[p.country].push(p);
    return acc;
  }, {});

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex-1 min-w-[140px]">
      <div
        className="w-full text-left px-3.5 py-3 hover:bg-gray-50/80 transition-colors group cursor-text"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
      >
        {open ? (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`${selected?.city || label}`}
            className="w-full bg-transparent outline-none text-sm font-bold text-gray-900 placeholder:text-gray-400 pt-1"
            autoFocus
          />
        ) : (
          <div className="min-w-0">
            <p className="font-extrabold text-sm sm:text-base text-gray-900 truncate leading-tight">
              {selected?.city}
            </p>
            <p className="text-[10px] text-gray-400 truncate leading-none mt-0.5">
              {selected?.code} · {selected?.name}
            </p>
          </div>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 w-80 mt-1 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 py-1 max-h-80 overflow-y-auto">
          {Object.entries(grouped).map(([country, places]) => (
            <div key={country}>
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[#FF4E00]" />
                  <span className="text-sm font-bold text-[#FF4E00]">{country}</span>
                </div>
                {!query && (
                  <span className="text-[11px] text-gray-400 font-medium">Explore top deals &gt;</span>
                )}
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
                      isSelected
                        ? "bg-orange-50"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <MapPin className={`w-4 h-4 shrink-0 ${isSelected ? "text-[#FF4E00]" : "text-gray-300"}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm truncate ${isSelected ? "text-[#FF4E00]" : "text-gray-900"}`}>
                        {place.city}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-400 text-center">No airports found for "{query}"</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Trip.com Style Search Widget ────────────────────────────────────── */
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
    setLocation(`/hotels/search?${qs.toString()}`);
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* ── Main Trip.com Inspired White Card ── */}
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-[0_20px_60px_rgba(15,23,42,0.18)] border border-gray-100/80 p-4 sm:p-6 md:p-7 text-left transition-all">
        {/* Top Service Tabs (Icon ON TOP of text with clean active blue underline bar) */}
        <div className="flex items-center gap-6 sm:gap-10 border-b border-gray-100 pb-2 mb-5 overflow-x-auto no-scrollbar">
          {/* Hotels & Homes Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("hotels")}
            className={`flex flex-col items-center gap-1.5 pb-2 relative shrink-0 transition-colors group ${
              activeTab === "hotels" ? "text-[#FF4E00]" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <Building2 className={`w-6 h-6 transition-colors ${activeTab === "hotels" ? "text-[#FF4E00]" : "text-gray-500 group-hover:text-gray-700"}`} />
            <span className="text-xs sm:text-sm font-bold tracking-tight">Hotels</span>
            {activeTab === "hotels" && (
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-10 sm:w-12 h-0.5 bg-[#FF4E00] rounded-full" />
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
            <Plane className={`w-6 h-6 transition-colors ${activeTab === "flights" ? "text-[#FF4E00]" : "text-gray-500 group-hover:text-gray-700"}`} />
            <span className="text-xs sm:text-sm font-bold tracking-tight">Flights</span>
            {activeTab === "flights" && (
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 sm:w-10 h-0.5 bg-[#FF4E00] rounded-full" />
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
            <Package className={`w-6 h-6 transition-colors ${activeTab === "packages" ? "text-[#FF4E00]" : "text-gray-500 group-hover:text-gray-700"}`} />
            <span className="text-xs sm:text-sm font-bold tracking-tight">Hajj & Umrah</span>
            {activeTab === "packages" && (
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-10 sm:w-12 h-0.5 bg-[#FF4E00] rounded-full" />
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
            <Briefcase className={`w-6 h-6 transition-colors ${activeTab === "flight_hotel" ? "text-[#FF4E00]" : "text-gray-500 group-hover:text-gray-700"}`} />
            <span className="text-xs sm:text-sm font-bold tracking-tight">Flight + Hotel</span>
            {activeTab === "flight_hotel" && (
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-10 sm:w-12 h-0.5 bg-[#FF4E00] rounded-full" />
            )}
          </button>
        </div>

        {/* ── 1: HOTELS & HOMES PANEL (Trip.com screenshot exact segmented bar) ── */}
        {activeTab === "hotels" && (
          <div className="space-y-3">
            {/* Unified Segmented Input Bar */}
            <div className="border border-gray-300 hover:border-gray-400 transition-colors rounded-xl md:rounded-2xl flex flex-col md:flex-row items-stretch overflow-hidden bg-white shadow-sm">
              {/* Segment 1: Where to? */}
              <HotelWhereToSelector value={hotelDest} onChange={setHotelDest} />

              {/* Vertical divider */}
              <div className="hidden md:block w-px bg-gray-200 my-2 self-stretch" />

              {/* Segment 2: Dates (Check-in - Check-out with Night Pill) */}
              <div className="flex-[1.4] flex items-center gap-3 px-4 py-3 border-t md:border-t-0 border-gray-100 hover:bg-gray-50/80 transition-colors">
                <Calendar className="w-5 h-5 text-gray-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      className="text-xs sm:text-sm font-bold text-gray-900 bg-transparent outline-none cursor-pointer w-full"
                    />
                    <span className="text-gray-400 font-bold">-</span>
                    <input
                      type="date"
                      value={checkOut}
                      min={checkIn}
                      onChange={(e) => setCheckOut(e.target.value)}
                      className="text-xs sm:text-sm font-bold text-gray-900 bg-transparent outline-none cursor-pointer w-full"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium mt-0.5">Check-in & Check-out</p>
                </div>
                <span className="hidden sm:inline-block bg-gray-100 text-gray-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0">
                  {hotelNights} {hotelNights === 1 ? "night" : "nights"}
                </span>
              </div>

              {/* Vertical divider */}
              <div className="hidden md:block w-px bg-gray-200 my-2 self-stretch" />

              {/* Segment 3: Rooms & Guests */}
              <div className="flex-1 flex items-center justify-between gap-3 px-4 py-3 border-t md:border-t-0 border-gray-100 hover:bg-gray-50/80 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <Users className="w-5 h-5 text-gray-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                      {hotelRooms} room, 2 adults
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium mt-0.5">0 children</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setHotelRooms(Math.max(1, hotelRooms - 1))}
                    className="w-6 h-6 rounded-md border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 font-bold text-xs flex items-center justify-center transition-colors"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => setHotelRooms(hotelRooms + 1)}
                    className="w-6 h-6 rounded-md border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 font-bold text-xs flex items-center justify-center transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Segment 4: Search Button (Inside right of container) */}
              <div className="p-1.5 flex items-center justify-center border-t md:border-t-0 border-gray-100">
                <button
                  type="button"
                  onClick={handleHotelSearch}
                  className="w-full md:w-auto h-full px-7 sm:px-8 py-3.5 bg-[#FF4E00] hover:bg-[#E04500] text-white font-black rounded-lg md:rounded-xl text-sm sm:text-base flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
                >
                  <Search className="w-4 h-4" />
                  <span>Search</span>
                </button>
              </div>
            </div>

            {/* Bottom auxiliary row: Quick select pills + Sign in prompt */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto">
                <span className="text-gray-400 font-medium shrink-0">Quick Select:</span>
                {HOTEL_DESTINATIONS.map((dest) => (
                  <button
                    key={dest.id}
                    type="button"
                    onClick={() => setHotelDest(dest.id)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
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
                Sign in or register to unlock exclusive coupons & rewards
              </a>
            </div>
          </div>
        )}

        {/* ── 2: FLIGHTS PANEL (Trip.com exact segmented bar) ── */}
        {activeTab === "flights" && (
          <div className="space-y-3">
            {/* Top Sub-row: Trip Type Radios & Nonstop Checkbox */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-gray-700 pb-1">
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

            {/* Unified Segmented Input Bar */}
            <div className="border border-gray-300 hover:border-gray-400 transition-colors rounded-xl md:rounded-2xl flex flex-col md:flex-row items-stretch overflow-hidden bg-white shadow-sm">
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
                  className="w-7 h-7 rounded-full border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-[#2563EB] transition-colors shadow-xs"
                  title="Swap Departure and Destination"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Destination */}
              <AirportSelector
                label="To"
                valueCode={destination}
                onChange={setDestination}
                placesList={POPULAR_DESTINATIONS}
              />

              {/* Vertical divider */}
              <div className="hidden md:block w-px bg-gray-200 my-2 self-stretch" />

              {/* Dates */}
              <div className="flex-[1.2] flex items-center gap-3 px-4 py-3 border-t md:border-t-0 border-gray-100 hover:bg-gray-50/80 transition-colors">
                <Calendar className="w-5 h-5 text-gray-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-1">
                    Dates
                  </p>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={depDate}
                      onChange={(e) => setDepDate(e.target.value)}
                      className="text-xs sm:text-sm font-bold text-gray-900 bg-transparent outline-none cursor-pointer w-full"
                    />
                    {tripType === "round_trip" && (
                      <>
                        <span className="text-gray-400 font-bold">/</span>
                        <input
                          type="date"
                          value={retDate}
                          min={depDate}
                          onChange={(e) => setRetDate(e.target.value)}
                          className="text-xs sm:text-sm font-bold text-gray-900 bg-transparent outline-none cursor-pointer w-full"
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Vertical divider */}
              <div className="hidden md:block w-px bg-gray-200 my-2 self-stretch" />

              {/* Travellers */}
              <div className="flex-1 flex items-center justify-between gap-3 px-4 py-3 border-t md:border-t-0 border-gray-100 hover:bg-gray-50/80 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Users className="w-5 h-5 text-gray-500 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-1">
                      Travellers
                    </p>
                    <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                      {adults} {adults === 1 ? "Adult" : "Adults"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setAdults(Math.max(1, adults - 1))}
                    className="w-6 h-6 rounded-md border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 font-bold text-xs flex items-center justify-center transition-colors"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdults(adults + 1)}
                    className="w-6 h-6 rounded-md border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 font-bold text-xs flex items-center justify-center transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Search Button */}
              <div className="p-1.5 flex items-center justify-center border-t md:border-t-0 border-gray-100">
                <button
                  type="button"
                  onClick={handleFlightSearch}
                  className="w-full md:w-auto h-full px-7 sm:px-8 py-3.5 bg-[#FF4E00] hover:bg-[#E04500] text-white font-black rounded-lg md:rounded-xl text-sm sm:text-base flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
                >
                  <Search className="w-4 h-4" />
                  <span>Search flights</span>
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
                Sign in or register to unlock exclusive coupons & rewards
              </a>
            </div>
          </div>
        )}

        {/* ── 3: HAJJ & UMRAH PACKAGES PANEL ── */}
        {activeTab === "packages" && (
          <div className="space-y-3">
            <div className="border border-gray-300 hover:border-gray-400 transition-colors rounded-xl md:rounded-2xl flex flex-col md:flex-row items-stretch overflow-hidden bg-white shadow-sm p-4 gap-4 items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#FF4E00] flex items-center justify-center shrink-0">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-gray-900 text-base">
                    All-Inclusive Hajj & Umrah Packages 2027
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
            <div className="border border-gray-300 hover:border-gray-400 transition-colors rounded-xl md:rounded-2xl flex flex-col md:flex-row items-stretch overflow-hidden bg-white shadow-sm p-4 gap-4 items-center justify-between">
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
