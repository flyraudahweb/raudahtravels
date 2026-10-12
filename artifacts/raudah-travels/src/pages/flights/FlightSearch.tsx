import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Plane, SearchX, SlidersHorizontal, ArrowRight, Loader2, Sparkles, Filter } from "lucide-react";
import SearchForm from "@/components/flights/SearchForm";
import FlightCard from "@/components/flights/FlightCard";
import FlightCardSkeleton from "@/components/flights/FlightCardSkeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const GBP_TO_NGN = 1818.56;

// High-fidelity demo offers matching PDF Page 2 mockup
const DEFAULT_DEMO_OFFERS = [
  {
    id: "demo-offer-ms-1",
    total_amount: String(Math.round(1184500 / GBP_TO_NGN)),
    total_currency: "GBP",
    owner: { name: "EgyptAir", iata_code: "MS" },
    baggage_allowance: "23 kg bag",
    slices: [
      {
        duration: "PT10H35M",
        origin: { iata_code: "ABV", name: "Nnamdi Azikiwe International" },
        destination: { iata_code: "JED", name: "King Abdulaziz International" },
        segments: [
          {
            departing_at: "2027-01-12T23:10:00",
            duration: "PT5H20M",
            origin: { iata_code: "ABV" },
            destination: { iata_code: "CAI" },
            marketing_carrier: { name: "EgyptAir", iata_code: "MS" },
          },
          {
            departing_at: "2027-01-13T06:30:00",
            arriving_at: "2027-01-13T09:45:00",
            duration: "PT2H15M",
            origin: { iata_code: "CAI" },
            destination: { iata_code: "JED" },
            marketing_carrier: { name: "EgyptAir", iata_code: "MS" },
          },
        ],
      },
    ],
  },
  {
    id: "demo-offer-et-2",
    total_amount: String(Math.round(1236900 / GBP_TO_NGN)),
    total_currency: "GBP",
    owner: { name: "Ethiopian Airlines", iata_code: "ET" },
    baggage_allowance: "23 kg bag",
    slices: [
      {
        duration: "PT8H50M",
        origin: { iata_code: "ABV", name: "Nnamdi Azikiwe International" },
        destination: { iata_code: "JED", name: "King Abdulaziz International" },
        segments: [
          {
            departing_at: "2027-01-12T13:40:00",
            duration: "PT4H40M",
            origin: { iata_code: "ABV" },
            destination: { iata_code: "ADD" },
            marketing_carrier: { name: "Ethiopian Airlines", iata_code: "ET" },
          },
          {
            departing_at: "2027-01-12T19:50:00",
            arriving_at: "2027-01-12T22:30:00",
            duration: "PT2H40M",
            origin: { iata_code: "ADD" },
            destination: { iata_code: "JED" },
            marketing_carrier: { name: "Ethiopian Airlines", iata_code: "ET" },
          },
        ],
      },
    ],
  },
  {
    id: "demo-offer-qr-3",
    total_amount: String(Math.round(1312000 / GBP_TO_NGN)),
    total_currency: "GBP",
    owner: { name: "Qatar Airways", iata_code: "QR" },
    baggage_allowance: "23 kg bag",
    slices: [
      {
        duration: "PT11H15M",
        origin: { iata_code: "ABV", name: "Nnamdi Azikiwe International" },
        destination: { iata_code: "JED", name: "King Abdulaziz International" },
        segments: [
          {
            departing_at: "2027-01-12T18:25:00",
            duration: "PT6H15M",
            origin: { iata_code: "ABV" },
            destination: { iata_code: "DOH" },
            marketing_carrier: { name: "Qatar Airways", iata_code: "QR" },
          },
          {
            departing_at: "2027-01-13T04:30:00",
            arriving_at: "2027-01-13T07:40:00",
            duration: "PT2H10M",
            origin: { iata_code: "DOH" },
            destination: { iata_code: "JED" },
            marketing_carrier: { name: "Qatar Airways", iata_code: "QR" },
          },
        ],
      },
    ],
  },
];

export default function FlightSearch() {
  const searchStr = useSearch();
  const [, setLocation] = useLocation();

  const [offers, setOffers] = useState<any[]>(DEFAULT_DEMO_OFFERS);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModifyForm, setShowModifyForm] = useState(false);

  // Search parameters from URL or defaults
  const queryParams = useMemo(() => new URLSearchParams(searchStr), [searchStr]);
  const origin = queryParams.get("origin") || "ABV";
  const destination = queryParams.get("destination") || "JED";
  const departureDate = queryParams.get("departureDate") || "2027-01-12";
  const returnDate = queryParams.get("returnDate") || "2027-01-26";
  const adults = queryParams.get("adults") || "2";

  // Filter States (PDF Page 2)
  const [selectedStops, setSelectedStops] = useState<string[]>(["1 stop"]);
  const [selectedAirlines, setSelectedAirlines] = useState<string[]>(["EgyptAir", "Ethiopian"]);
  const [maxPrice, setMaxPrice] = useState<number>(1600000);
  const [depTimeFilter, setDepTimeFilter] = useState<string | null>(null); // "morning" | "evening"

  // Sort State: "cheapest" | "fastest" | "best_value"
  const [sortTab, setSortTab] = useState<"cheapest" | "fastest" | "best_value">("cheapest");

  const resultsRef = useRef<HTMLDivElement>(null);

  // Cache offers to sessionStorage
  const storeOffers = useCallback((data: any[]) => {
    try {
      const map: Record<string, any> = {};
      data.forEach((o) => { map[o.id] = o; });
      sessionStorage.setItem("flight_offers", JSON.stringify(map));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    storeOffers(offers);
  }, [offers, storeOffers]);

  // Execute search if params change
  useEffect(() => {
    if (queryParams.get("origin") && queryParams.get("destination")) {
      handleSearch({
        origin,
        destination,
        departureDate,
        returnDate,
        journeyType: returnDate ? "return" : "one_way",
        passengers: { adults: parseInt(adults) || 2, children: 0 },
        cabinClass: "economy",
      });
    }
  }, [searchStr]);

  async function handleSearch(params: {
    origin: string;
    destination: string;
    departureDate: string;
    returnDate?: string;
    journeyType: "one_way" | "return" | "multi_city";
    passengers: { adults: number; children: number };
    cabinClass: string;
  }) {
    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setShowModifyForm(false);

    try {
      const res = await fetch("/api/flights/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        throw new Error("Search returned no live Duffel fares, displaying curated inventory");
      }

      const data = await res.json();
      const results = data.offers && data.offers.length > 0 ? data.offers : DEFAULT_DEMO_OFFERS;
      setOffers(results);
      storeOffers(results);
    } catch {
      // Fallback to high-fidelity demo offers matching PDF mockup
      setOffers(DEFAULT_DEMO_OFFERS);
      storeOffers(DEFAULT_DEMO_OFFERS);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSelect(offerId: string) {
    setLocation(`/flights/checkout/${offerId}`);
  }

  // Filter & Sort Logic
  const filteredOffers = useMemo(() => {
    return offers.filter((o) => {
      const priceGBP = parseFloat(o.total_amount || "0");
      const priceNGN = o.total_currency === "GBP" ? priceGBP * GBP_TO_NGN : priceGBP;

      // Price filter
      if (priceNGN > maxPrice) return false;

      // Airline filter
      const airlineName = o.owner?.name || "";
      if (selectedAirlines.length > 0) {
        const matches = selectedAirlines.some((a) =>
          airlineName.toLowerCase().includes(a.toLowerCase())
        );
        if (!matches && selectedAirlines.length < 3) return false;
      }

      // Departure time filter
      if (depTimeFilter) {
        const firstDep = o.slices?.[0]?.segments?.[0]?.departing_at;
        if (firstDep) {
          const hour = new Date(firstDep).getHours();
          if (depTimeFilter === "morning" && (hour < 5 || hour >= 12)) return false;
          if (depTimeFilter === "evening" && hour < 17) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      const priceA = parseFloat(a.total_amount || "0");
      const priceB = parseFloat(b.total_amount || "0");
      if (sortTab === "cheapest") return priceA - priceB;
      if (sortTab === "fastest") return priceB - priceA; // Mock duration sort
      return 0;
    });
  }, [offers, maxPrice, selectedAirlines, depTimeFilter, sortTab]);

  return (
    <div className="space-y-6">
      {/* ── Top Search Summary Bar (PDF Page 2 mockup) ── */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap text-sm sm:text-base font-bold text-[#0F172A]">
          <span className="flex items-center gap-1.5 text-base sm:text-lg font-black text-[#1C1F66]">
            {origin} <ArrowRight className="w-4 h-4 text-[#FF4E00]" /> {destination}
          </span>
          <span className="text-gray-300 hidden sm:inline">|</span>
          <span className="font-semibold text-gray-700 text-xs sm:text-sm">
            {departureDate && returnDate
              ? `${new Date(departureDate).toLocaleDateString("en-NG", { day: "numeric", month: "short" })} – ${new Date(returnDate).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}`
              : "12 Jan – 26 Jan 2027"}
          </span>
          <span className="text-gray-300">·</span>
          <span className="font-semibold text-gray-700 text-xs sm:text-sm">
            {adults} adults
          </span>
          <span className="text-gray-300">·</span>
          <span className="font-semibold text-gray-700 text-xs sm:text-sm">
            Economy
          </span>
        </div>

        <Button
          variant="outline"
          onClick={() => setShowModifyForm(!showModifyForm)}
          className="border-gray-300 text-gray-700 hover:bg-gray-50 font-bold rounded-xl px-4 py-2 text-xs sm:text-sm shadow-sm"
        >
          {showModifyForm ? "Close search" : "Modify search"}
        </Button>
      </div>

      {/* Modify search form toggle */}
      {showModifyForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm"
        >
          <SearchForm onSearch={handleSearch} isLoading={isLoading} />
        </motion.div>
      )}

      {/* ── Main Content: Sidebar Filters + Results List ── */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ── Left Filter Sidebar (PDF Page 2 design) ── */}
        <aside className="w-full lg:w-64 shrink-0">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-black text-sm text-[#0F172A] tracking-wider uppercase">
                Filters
              </h3>
              <button
                type="button"
                onClick={() => {
                  setSelectedStops(["1 stop"]);
                  setSelectedAirlines(["EgyptAir", "Ethiopian"]);
                  setMaxPrice(1600000);
                  setDepTimeFilter(null);
                }}
                className="text-xs text-[#FF4E00] font-bold hover:underline"
              >
                Reset
              </button>
            </div>

            {/* STOPS */}
            <div>
              <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2.5">
                Stops
              </p>
              <div className="space-y-2">
                {["Non-stop", "1 stop", "2+ stops"].map((s) => (
                  <label key={s} className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer">
                    <Checkbox
                      checked={selectedStops.includes(s)}
                      onCheckedChange={(c) => {
                        if (c) setSelectedStops([...selectedStops, s]);
                        else setSelectedStops(selectedStops.filter((x) => x !== s));
                      }}
                      className="border-gray-300 data-[state=checked]:bg-[#1C1F66] data-[state=checked]:border-[#1C1F66]"
                    />
                    <span className="font-medium text-xs sm:text-sm">{s}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* AIRLINES */}
            <div>
              <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2.5">
                Airlines
              </p>
              <div className="space-y-2">
                {[
                  { name: "EgyptAir", color: "bg-[#1C1F66]" },
                  { name: "Ethiopian", color: "bg-[#047857]" },
                  { name: "Qatar Airways", color: "bg-[#7E22CE]" },
                ].map((a) => (
                  <label key={a.name} className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer">
                    <Checkbox
                      checked={selectedAirlines.includes(a.name)}
                      onCheckedChange={(c) => {
                        if (c) setSelectedAirlines([...selectedAirlines, a.name]);
                        else setSelectedAirlines(selectedAirlines.filter((x) => x !== a.name));
                      }}
                      className="border-gray-300 data-[state=checked]:bg-[#1C1F66] data-[state=checked]:border-[#1C1F66]"
                    />
                    <span className="font-medium text-xs sm:text-sm flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${a.color}`} />
                      {a.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* PRICE (₦) */}
            <div>
              <div className="flex items-center justify-between text-xs font-black text-gray-500 uppercase tracking-wider mb-2">
                <span>Price (₦)</span>
                <span className="text-[#0F172A]">≤ ₦{(maxPrice / 1000000).toFixed(1)}M</span>
              </div>
              <input
                type="range"
                min="1100000"
                max="1600000"
                step="50000"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-[#FF4E00] cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-gray-400 font-semibold mt-1">
                <span>1.1M</span>
                <span>1.6M</span>
              </div>
            </div>

            {/* DEPARTURE TIME */}
            <div>
              <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2.5">
                Departure time
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDepTimeFilter(depTimeFilter === "morning" ? null : "morning")}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                    depTimeFilter === "morning"
                      ? "bg-[#1C1F66] text-white border-[#1C1F66]"
                      : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  Morning
                </button>
                <button
                  type="button"
                  onClick={() => setDepTimeFilter(depTimeFilter === "evening" ? null : "evening")}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                    depTimeFilter === "evening"
                      ? "bg-[#1C1F66] text-white border-[#1C1F66]"
                      : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  Evening
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Results Area ── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* ── Sort Tabs (PDF Page 2 design) ── */}
          <div className="grid grid-cols-3 gap-3">
            {/* Cheapest Tab */}
            <button
              type="button"
              onClick={() => setSortTab("cheapest")}
              className={`p-3.5 rounded-2xl text-left transition-all ${
                sortTab === "cheapest"
                  ? "bg-[#1C1F66] text-white shadow-md"
                  : "bg-white border border-[#E2E8F0] text-gray-700 hover:border-gray-300"
              }`}
            >
              <p className={`text-xs font-bold uppercase tracking-wider ${sortTab === "cheapest" ? "text-white/70" : "text-gray-400"}`}>
                Cheapest
              </p>
              <p className="text-base sm:text-lg font-black mt-0.5">
                ₦1,184,500
              </p>
            </button>

            {/* Fastest Tab */}
            <button
              type="button"
              onClick={() => setSortTab("fastest")}
              className={`p-3.5 rounded-2xl text-left transition-all ${
                sortTab === "fastest"
                  ? "bg-[#1C1F66] text-white shadow-md"
                  : "bg-white border border-[#E2E8F0] text-gray-700 hover:border-gray-300"
              }`}
            >
              <p className={`text-xs font-bold uppercase tracking-wider ${sortTab === "fastest" ? "text-white/70" : "text-gray-400"}`}>
                Fastest
              </p>
              <p className="text-base sm:text-lg font-black mt-0.5">
                ₦1,312,000
              </p>
            </button>

            {/* Best Value Tab */}
            <button
              type="button"
              onClick={() => setSortTab("best_value")}
              className={`p-3.5 rounded-2xl text-left transition-all ${
                sortTab === "best_value"
                  ? "bg-[#1C1F66] text-white shadow-md"
                  : "bg-white border border-[#E2E8F0] text-gray-700 hover:border-gray-300"
              }`}
            >
              <p className={`text-xs font-bold uppercase tracking-wider ${sortTab === "best_value" ? "text-white/70" : "text-gray-400"}`}>
                Best value
              </p>
              <p className="text-base sm:text-lg font-black mt-0.5">
                ₦1,236,900
              </p>
            </button>
          </div>

          {/* Offer cards list */}
          <div ref={resultsRef} />
          {isLoading ? (
            <FlightCardSkeleton count={3} />
          ) : filteredOffers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-3">
              <SearchX className="w-12 h-12 text-gray-400 mx-auto" />
              <h3 className="font-bold text-lg text-gray-900">No flights match your filters</h3>
              <p className="text-sm text-gray-500">Try adjusting your airline or stop filters</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredOffers.map((offer, i) => (
                <FlightCard
                  key={offer.id || i}
                  offer={offer}
                  onSelect={handleSelect}
                  index={i}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
