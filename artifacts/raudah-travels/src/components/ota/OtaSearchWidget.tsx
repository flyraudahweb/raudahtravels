import { useState, useRef, useEffect, useCallback } from "react";
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
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  POPULAR_ORIGINS,
  POPULAR_DESTINATIONS,
  HOTEL_DESTINATIONS,
  type Place,
} from "@/lib/placesData";

type Tab = "flights" | "hotels" | "packages";
type TripType = "round_trip" | "one_way" | "multi_city";

/* ── Rich Airport / City Selector Popup ─────────────────────────────────── */
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
  const containerRef = useRef<HTMLDivElement>(null);

  const selected =
    placesList.find((p) => p.code === valueCode) ||
    POPULAR_ORIGINS.find((p) => p.code === valueCode) ||
    POPULAR_DESTINATIONS.find((p) => p.code === valueCode) ||
    placesList[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex-1 min-w-[140px]">
      <label className="block text-[11px] font-black text-gray-400 uppercase tracking-wider mb-1">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left flex items-center justify-between gap-2 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] hover:border-gray-300 rounded-xl px-3.5 py-2.5 transition-all"
      >
        <div className="min-w-0">
          <p className="font-black text-[#0F172A] text-sm leading-tight truncate">
            {selected?.city || valueCode}
          </p>
          <p className="text-[11px] text-gray-500 font-medium truncate mt-0.5">
            {selected?.code} · {selected?.name || "Airport"}
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Popover list of tap-friendly airports */}
      {open && (
        <div className="absolute top-full left-0 right-0 sm:w-72 mt-1.5 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 p-2 max-h-72 overflow-y-auto">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 py-1.5">
            Popular Airports
          </p>
          <div className="space-y-1">
            {placesList.map((place) => {
              const isSelected = place.code === valueCode;
              return (
                <button
                  key={place.code}
                  type="button"
                  onClick={() => {
                    onChange(place.code);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors ${
                    isSelected
                      ? "bg-[#1C1F66] text-white"
                      : "hover:bg-[#EEF0FF] text-[#0F172A]"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-bold text-xs truncate">
                      {place.city} ({place.code})
                    </p>
                    <p className={`text-[10px] truncate ${isSelected ? "text-white/80" : "text-gray-400"}`}>
                      {place.name}
                    </p>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-white" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 1-Tap Hotel Destination Selector (Zero Typing Needed!) ─────────────── */
function HotelDestinationSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (destId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = HOTEL_DESTINATIONS.find((h) => h.id === value) || HOTEL_DESTINATIONS[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex-1 min-w-[200px]">
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider">
          Destination / Holy City
        </label>
        <span className="text-[10px] text-[#FF4E00] font-bold">1-Tap Select</span>
      </div>

      {/* Main Selector Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left flex items-center justify-between gap-2 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] hover:border-gray-300 rounded-xl px-3.5 py-2.5 transition-all"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xl shrink-0">{current.icon}</span>
          <div className="min-w-0">
            <p className="font-black text-[#0F172A] text-sm leading-tight truncate">
              {current.name}
            </p>
            <p className="text-[11px] text-gray-500 font-medium truncate mt-0.5">
              {current.subtitle}
            </p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Card Grid */}
      {open && (
        <div className="absolute top-full left-0 right-0 sm:w-80 mt-1.5 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 p-2 space-y-1">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 py-1.5">
            Select Holy City or Hub
          </p>
          {HOTEL_DESTINATIONS.map((dest) => {
            const isSelected = dest.id === value;
            return (
              <button
                key={dest.id}
                type="button"
                onClick={() => {
                  onChange(dest.id);
                  setOpen(false);
                }}
                className={`w-full text-left p-2.5 rounded-xl flex items-center gap-3 transition-colors ${
                  isSelected
                    ? "bg-[#1C1F66] text-white"
                    : "hover:bg-[#EEF0FF] text-[#0F172A]"
                }`}
              >
                <span className="text-2xl">{dest.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-xs sm:text-sm truncate">
                    {dest.name}
                  </p>
                  <p className={`text-[10px] truncate ${isSelected ? "text-white/80" : "text-gray-400"}`}>
                    {dest.subtitle}
                  </p>
                </div>
                {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Main OTA Search Component (Trip.com Inspired with Raudah Colors) ────── */
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
    const qs = new URLSearchParams({
      origin,
      destination,
      departureDate: depDate,
      returnDate: retDate,
      map: "true",
    });
    setLocation(`/flights?${qs.toString()}`);
  }

  function handleHotelSearch() {
    const qs = new URLSearchParams({ dest: hotelDest });
    if (checkIn) qs.set("checkin", checkIn);
    if (checkOut) qs.set("checkout", checkOut);
    qs.set("rooms", String(hotelRooms));
    setLocation(`/hotels/search?${qs.toString()}`);
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5">
      {/* ── Main Trip.com Style Search Card ── */}
      <div className="bg-white rounded-3xl shadow-[0_20px_60px_rgba(15,23,42,0.18)] border border-white p-5 sm:p-7 text-left">
        {/* Top Service Tabs with Big Icons & Bolder Text */}
        <div className="flex items-center gap-6 sm:gap-10 border-b border-[#F1F5F9] pb-4 mb-5 overflow-x-auto no-scrollbar">
          {/* Hotels Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("hotels")}
            className={`flex items-center gap-2.5 pb-2 transition-all relative shrink-0 ${
              activeTab === "hotels"
                ? "text-[#FF4E00]"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <Building2 className={`w-5 h-5 ${activeTab === "hotels" ? "text-[#FF4E00]" : "text-gray-400"}`} />
            <span className="text-sm sm:text-base font-black">Hotels & Stays</span>
            {activeTab === "hotels" && (
              <span className="absolute -bottom-4 left-0 right-0 h-1 bg-[#FF4E00] rounded-full" />
            )}
          </button>

          {/* Flights Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("flights")}
            className={`flex items-center gap-2.5 pb-2 transition-all relative shrink-0 ${
              activeTab === "flights"
                ? "text-[#FF4E00]"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <Plane className={`w-5 h-5 ${activeTab === "flights" ? "text-[#FF4E00]" : "text-gray-400"}`} />
            <span className="text-sm sm:text-base font-black">Flights</span>
            {activeTab === "flights" && (
              <span className="absolute -bottom-4 left-0 right-0 h-1 bg-[#FF4E00] rounded-full" />
            )}
          </button>

          {/* Packages Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("packages")}
            className={`flex items-center gap-2.5 pb-2 transition-all relative shrink-0 ${
              activeTab === "packages"
                ? "text-[#FF4E00]"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <Package className={`w-5 h-5 ${activeTab === "packages" ? "text-[#FF4E00]" : "text-gray-400"}`} />
            <span className="text-sm sm:text-base font-black">Hajj & Umrah Packages</span>
            {activeTab === "packages" && (
              <span className="absolute -bottom-4 left-0 right-0 h-1 bg-[#FF4E00] rounded-full" />
            )}
          </button>
        </div>

        {/* ── Flights Search Panel ── */}
        {activeTab === "flights" && (
          <div className="space-y-4">
            {/* Trip Type Radio Buttons (Trip.com Style) */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-gray-700">
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

              <label className="flex items-center gap-1.5 cursor-pointer ml-auto text-gray-500">
                <input
                  type="checkbox"
                  checked={isNonstopOnly}
                  onChange={(e) => setIsNonstopOnly(e.target.checked)}
                  className="accent-[#FF4E00] w-3.5 h-3.5"
                />
                <span>Direct flights only</span>
              </label>
            </div>

            {/* Inputs Grid with Swap Button (Trip.com segment bar) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
              {/* Origin */}
              <div className="md:col-span-3">
                <AirportSelector
                  label="From"
                  valueCode={origin}
                  onChange={setOrigin}
                  placesList={POPULAR_ORIGINS}
                />
              </div>

              {/* Swap Button */}
              <div className="hidden md:flex md:col-span-1 justify-center pb-2">
                <button
                  type="button"
                  onClick={handleSwap}
                  className="w-8 h-8 rounded-full border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-gray-500 hover:text-[#FF4E00] transition-colors shadow-sm"
                  title="Swap Departure and Destination"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Destination */}
              <div className="md:col-span-3">
                <AirportSelector
                  label="To"
                  valueCode={destination}
                  onChange={setDestination}
                  placesList={POPULAR_DESTINATIONS}
                />
              </div>

              {/* Dates */}
              <div className="md:col-span-3">
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-wider mb-1">
                  Dates
                </label>
                <div className="flex items-center gap-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2">
                  <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <input
                    type="date"
                    value={depDate}
                    onChange={(e) => setDepDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-[#0F172A] outline-none w-full"
                  />
                  {tripType === "round_trip" && (
                    <>
                      <span className="text-gray-300">/</span>
                      <input
                        type="date"
                        value={retDate}
                        min={depDate}
                        onChange={(e) => setRetDate(e.target.value)}
                        className="bg-transparent text-xs font-bold text-[#0F172A] outline-none w-full"
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Travellers */}
              <div className="md:col-span-2">
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-wider mb-1">
                  Travellers
                </label>
                <div className="flex items-center justify-between bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2">
                  <span className="text-xs font-bold text-[#0F172A]">
                    {adults} {adults === 1 ? "Adult" : "Adults"}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setAdults(Math.max(1, adults - 1))}
                      className="w-5 h-5 rounded bg-white border border-gray-200 text-gray-700 font-bold text-xs"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdults(adults + 1)}
                      className="w-5 h-5 rounded bg-white border border-gray-200 text-gray-700 font-bold text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons: Search Flights & Explore on Map */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleMapExplore}
                className="w-full sm:w-auto border-gray-300 hover:bg-gray-50 text-gray-800 font-bold rounded-xl px-5 py-3 text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm"
              >
                <MapIcon className="w-4 h-4 text-[#1C1F66]" />
                Explore Route on Map
              </Button>

              <Button
                type="button"
                onClick={handleFlightSearch}
                className="w-full sm:w-auto px-8 py-3 bg-[#FF4E00] hover:bg-[#E04500] text-white font-black rounded-xl text-sm shadow-md transition-all hover:scale-[1.01] flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                Search flights
              </Button>
            </div>
          </div>
        )}

        {/* ── Hotels Search Panel (1-Tap Selection UX) ── */}
        {activeTab === "hotels" && (
          <div className="space-y-4">
            {/* Quick-Tap Destination Chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-gray-500 mr-1">Quick Select:</span>
              {HOTEL_DESTINATIONS.map((dest) => (
                <button
                  key={dest.id}
                  type="button"
                  onClick={() => setHotelDest(dest.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
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

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <HotelDestinationSelector
                value={hotelDest}
                onChange={setHotelDest}
              />

              {/* Check-in */}
              <div>
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-wider mb-1">
                  Check-in
                </label>
                <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2.5">
                  <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                  <input
                    type="date"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="bg-transparent text-xs font-bold text-[#0F172A] outline-none w-full"
                  />
                </div>
              </div>

              {/* Check-out */}
              <div>
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-wider mb-1">
                  Check-out
                </label>
                <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2.5">
                  <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                  <input
                    type="date"
                    value={checkOut}
                    min={checkIn}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="bg-transparent text-xs font-bold text-[#0F172A] outline-none w-full"
                  />
                </div>
              </div>

              {/* Rooms & Guests */}
              <div>
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-wider mb-1">
                  Rooms & Guests
                </label>
                <div className="flex items-center justify-between bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2.5">
                  <span className="text-xs font-bold text-[#0F172A]">
                    {hotelRooms} Room, 2 Guests
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setHotelRooms(Math.max(1, hotelRooms - 1))}
                      className="w-5 h-5 rounded bg-white border border-gray-200 text-gray-700 font-bold text-xs"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => setHotelRooms(hotelRooms + 1)}
                      className="w-5 h-5 rounded bg-white border border-gray-200 text-gray-700 font-bold text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Search Button */}
            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={handleHotelSearch}
                className="w-full sm:w-auto px-8 py-3 bg-[#FF4E00] hover:bg-[#E04500] text-white font-black rounded-xl text-sm shadow-md transition-all hover:scale-[1.01] flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                Search hotels in {hotelDest.charAt(0).toUpperCase() + hotelDest.slice(1)}
              </Button>
            </div>
          </div>
        )}

        {/* ── Packages Search Panel ── */}
        {activeTab === "packages" && (
          <div className="py-2 space-y-4">
            <p className="text-gray-600 text-sm font-medium">
              Explore our all-inclusive Hajj, Umrah, and customized spiritual journeys below with 5-star lodging, visa facilitation, and luxury logistics.
            </p>
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => document.getElementById("featured-packages")?.scrollIntoView({ behavior: "smooth" })}
                className="w-full sm:w-auto px-8 py-3 bg-[#FF4E00] hover:bg-[#E04500] text-white font-black rounded-xl text-sm shadow-md transition-all hover:scale-[1.01]"
              >
                <Package className="w-4 h-4 mr-2" />
                Explore packages
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Featured Packages Row ── */}
      <div className="pt-2 text-left">
        <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-3 px-1">
          Featured packages
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Ramadan Umrah 2027 */}
          <div
            onClick={() => setLocation("/packages")}
            className="group cursor-pointer bg-white/95 hover:bg-white rounded-2xl p-4 border border-white/20 shadow-md transition-all duration-200 hover:-translate-y-1 flex items-center gap-4"
          >
            <div className="w-14 h-14 rounded-xl bg-[#5C4EBA] flex items-center justify-center shrink-0 shadow-inner">
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[#0F172A] text-sm group-hover:text-[#FF4E00] transition-colors truncate">
                Ramadan Umrah 2027
              </p>
              <p className="text-xs text-gray-500 truncate mt-0.5">14 nights • Makkah and Madinah</p>
              <p className="text-xs font-black text-[#FF4E00] mt-1">From ₦4.25M</p>
            </div>
          </div>

          {/* Card 2: Hajj 2027 Premium */}
          <div
            onClick={() => setLocation("/packages")}
            className="group cursor-pointer bg-white/95 hover:bg-white rounded-2xl p-4 border border-white/20 shadow-md transition-all duration-200 hover:-translate-y-1 flex items-center gap-4"
          >
            <div className="w-14 h-14 rounded-xl bg-[#5C4EBA] flex items-center justify-center shrink-0 shadow-inner">
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[#0F172A] text-sm group-hover:text-[#FF4E00] transition-colors truncate">
                Hajj 2027 Premium
              </p>
              <p className="text-xs text-gray-500 truncate mt-0.5">21 nights • group departure</p>
              <p className="text-xs font-black text-[#FF4E00] mt-1">From ₦12.9M</p>
            </div>
          </div>

          {/* Card 3: Dubai family break */}
          <div
            onClick={() => setLocation("/packages")}
            className="group cursor-pointer bg-white/95 hover:bg-white rounded-2xl p-4 border border-white/20 shadow-md transition-all duration-200 hover:-translate-y-1 flex items-center gap-4"
          >
            <div className="w-14 h-14 rounded-xl bg-[#1C1F66] flex items-center justify-center shrink-0 shadow-inner">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v2m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[#0F172A] text-sm group-hover:text-[#FF4E00] transition-colors truncate">
                Dubai family break
              </p>
              <p className="text-xs text-gray-500 truncate mt-0.5">5 nights • flight and hotel</p>
              <p className="text-xs font-black text-[#FF4E00] mt-1">From ₦1.65M</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
