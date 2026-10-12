import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Plane, Building2, Package, Search, MapPin, Calendar, Users, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/* ── Types ──────────────────────────────────────────────────────────────── */
type Tab = "flights" | "hotels" | "packages";
type TripType = "round_trip" | "one_way" | "multi_city";

/* ── Airport autocomplete field ─────────────────────────────────────────── */
function AirportField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); return; }
    try {
      const res = await fetch(`/api/flights/places?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSuggestions((data.places || []).slice(0, 6));
    } catch {
      setSuggestions([]);
    }
  }, []);

  function handleInput(v: string) {
    setQuery(v);
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => search(v), 300);
  }

  function select(place: any) {
    const code = place.iata_code || place.iata_country_code || "";
    const name = place.name || "";
    const display = code ? `${code} - ${name}` : name;
    setQuery(display);
    onChange(code);
    setOpen(false);
    setSuggestions([]);
  }

  return (
    <div className="relative flex-1 min-w-[150px]">
      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{label}</label>
      <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#CBD5E1] rounded-xl px-3 py-2.5 focus-within:border-[#1C1F66] focus-within:bg-white transition-all">
        <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={placeholder}
          className="bg-transparent text-[#0F172A] placeholder-gray-400 text-sm font-semibold w-full outline-none"
        />
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-[#DCE3F0] z-50 overflow-hidden">
          {suggestions.map((p, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => select(p)}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#EEF0FF] flex items-center gap-2 text-[#334155]"
            >
              <span className="font-bold text-[#1C1F66] w-10 shrink-0">{p.iata_code || "—"}</span>
              <span className="truncate">{p.name}{p.city_name ? `, ${p.city_name}` : ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Date field ─────────────────────────────────────────────────────────── */
function DateField({ label, value, onChange, min }: { label: string; value: string; onChange: (v: string) => void; min?: string }) {
  return (
    <div className="flex-1 min-w-[130px]">
      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{label}</label>
      <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#CBD5E1] rounded-xl px-3 py-2.5 focus-within:border-[#1C1F66] focus-within:bg-white transition-all">
        <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          type="date"
          value={value}
          min={min || new Date().toISOString().split("T")[0]}
          onChange={(e) => onChange(e.target.value)}
          className="bg-transparent text-[#0F172A] text-sm font-semibold w-full outline-none"
        />
      </div>
    </div>
  );
}

/* ── Destination text field ──────────────────────────────────────────────── */
function DestField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="flex-1 min-w-[160px]">
      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{label}</label>
      <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#CBD5E1] rounded-xl px-3 py-2.5 focus-within:border-[#1C1F66] focus-within:bg-white transition-all">
        <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="bg-transparent text-[#0F172A] placeholder-gray-400 text-sm font-semibold w-full outline-none"
        />
      </div>
    </div>
  );
}

/* ── Traveller / rooms counter ──────────────────────────────────────────── */
function CounterField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex-1 min-w-[120px]">
      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{label}</label>
      <div className="flex items-center justify-between bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="text-sm font-bold text-[#0F172A]">{value} {value === 1 ? "Adult" : "Adults"}</span>
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          <button
            type="button"
            onClick={() => onChange(Math.max(1, value - 1))}
            className="w-5 h-5 rounded-md bg-white border border-gray-200 text-gray-600 hover:text-black font-bold text-xs flex items-center justify-center transition-colors"
          >
            -
          </button>
          <button
            type="button"
            onClick={() => onChange(value + 1)}
            className="w-5 h-5 rounded-md bg-white border border-gray-200 text-gray-600 hover:text-black font-bold text-xs flex items-center justify-center transition-colors"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main widget ────────────────────────────────────────────────────────── */
export default function OtaSearchWidget() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("flights");
  const [tripType, setTripType] = useState<TripType>("round_trip");

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

  const TABS: { id: Tab; label: string; icon: typeof Plane }[] = [
    { id: "flights", label: "Flights", icon: Plane },
    { id: "hotels", label: "Hotels", icon: Building2 },
    { id: "packages", label: "Packages", icon: Package },
  ];

  const TRIP_TYPES: { id: TripType; label: string }[] = [
    { id: "round_trip", label: "Round trip" },
    { id: "one_way", label: "One way" },
    { id: "multi_city", label: "Multi-city" },
  ];

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

  function handleHotelSearch() {
    const qs = new URLSearchParams({ dest: hotelDest });
    if (checkIn) qs.set("checkin", checkIn);
    if (checkOut) qs.set("checkout", checkOut);
    qs.set("rooms", String(hotelRooms));
    setLocation(`/hotels/search?${qs.toString()}`);
  }

  function handlePackageSearch() {
    document.getElementById("featured-packages")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* ── Main Search Box (PDF Page 1 design) ── */}
      <div className="bg-white rounded-3xl shadow-[0_16px_50px_rgba(15,23,42,0.18)] border border-white/80 p-6 sm:p-7 text-left">
        {/* Service switcher tabs */}
        <div className="flex items-center gap-6 border-b border-[#F1F5F9] pb-4 mb-5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 pb-1 text-sm sm:text-base font-bold transition-all relative ${
                activeTab === id
                  ? "text-[#FF4E00]"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
              {activeTab === id && (
                <span className="absolute -bottom-4 left-0 right-0 h-0.5 bg-[#FF4E00] rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* ── Flights Panel ── */}
        {activeTab === "flights" && (
          <div className="space-y-4">
            {/* Trip type pills */}
            <div className="flex items-center gap-2">
              {TRIP_TYPES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTripType(id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                    tripType === id
                      ? "bg-[#1C1F66] text-white shadow-sm"
                      : "text-gray-600 bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <AirportField label="FROM" value={origin} onChange={setOrigin} placeholder="ABV - Abuja" />
              <AirportField label="TO" value={destination} onChange={setDestination} placeholder="JED - Jeddah" />
              <DateField label="DEPARTURE" value={depDate} onChange={setDepDate} />
              {tripType === "round_trip" ? (
                <DateField label="RETURN" value={retDate} onChange={setRetDate} min={depDate} />
              ) : (
                <div className="hidden lg:block" />
              )}
              <CounterField label="TRAVELLERS" value={adults} onChange={setAdults} />
            </div>

            {/* Search CTA */}
            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={handleFlightSearch}
                className="w-full sm:w-auto px-8 py-3.5 bg-[#FF4E00] hover:bg-[#E04500] text-white font-black rounded-xl text-sm shadow-md transition-all hover:scale-[1.01]"
              >
                <Search className="w-4 h-4 mr-2" />
                Search flights
              </Button>
            </div>
          </div>
        )}

        {/* ── Hotels Panel ── */}
        {activeTab === "hotels" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <DestField label="DESTINATION" value={hotelDest} onChange={setHotelDest} placeholder="Makkah or Madinah" />
              <DateField label="CHECK-IN" value={checkIn} onChange={setCheckIn} />
              <DateField label="CHECK-OUT" value={checkOut} onChange={setCheckOut} min={checkIn} />
              <CounterField label="ROOMS" value={hotelRooms} onChange={setHotelRooms} />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={handleHotelSearch}
                className="w-full sm:w-auto px-8 py-3.5 bg-[#FF4E00] hover:bg-[#E04500] text-white font-black rounded-xl text-sm shadow-md transition-all hover:scale-[1.01]"
              >
                <Search className="w-4 h-4 mr-2" />
                Search hotels
              </Button>
            </div>
          </div>
        )}

        {/* ── Packages Panel ── */}
        {activeTab === "packages" && (
          <div className="py-2 space-y-4">
            <p className="text-gray-600 text-sm font-medium">
              Explore our all-inclusive Hajj, Umrah, and customized spiritual journeys below with 5-star lodging, visa facilitation, and luxury logistics.
            </p>
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handlePackageSearch}
                className="w-full sm:w-auto px-8 py-3.5 bg-[#FF4E00] hover:bg-[#E04500] text-white font-black rounded-xl text-sm shadow-md transition-all hover:scale-[1.01]"
              >
                <Package className="w-4 h-4 mr-2" />
                Explore packages
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Featured Packages Row (Matches PDF Page 1) ── */}
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
              {/* Kaaba / spiritual cube icon */}
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
              {/* Umbrella / tourism icon */}
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
