import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Star,
  MapPin,
  Coffee,
  X,
  SlidersHorizontal,
  ChevronDown,
  Loader2,
  SearchX,
  Shield,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { HOTEL_DESTINATIONS } from "@/lib/placesData";

interface Hotel {
  id: string;
  name: string;
  destination: string;
  destinationLabel: string;
  distanceToHaram: number;
  distanceLabel: string;
  stars: number;
  boardType: string;
  boardLabel: string;
  freeCancellation: boolean;
  rateType: string;
  rateLabel: string;
  pricePerNightNgn: number;
  description: string;
  amenities: string[];
}

function StarRating({ stars }: { stars: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: stars }).map((_, i) => (
        <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
      ))}
    </span>
  );
}

function HotelCard({ hotel, nights }: { hotel: Hotel; nights: number }) {
  const [, setLocation] = useLocation();
  const total = hotel.pricePerNightNgn * nights;

  const isDirect = hotel.rateType === "raudah_direct";
  const bgBoxColor = isDirect ? "bg-[#1C1F66]" : "bg-[#5C4EBA]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-[#DCE3F0] overflow-hidden flex flex-col sm:flex-row shadow-sm hover:shadow-md transition-shadow duration-200"
    >
      {/* Hotel image / styled icon box */}
      <div className={`sm:w-56 h-36 sm:h-auto ${bgBoxColor} flex flex-col items-center justify-center p-6 shrink-0 text-white relative`}>
        <Building2 className="w-14 sm:w-16 h-14 sm:h-16 text-white/90 drop-shadow-sm" />
      </div>

      {/* Details */}
      <div className="flex-1 p-4 sm:p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div>
              {/* Rate badge */}
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full mb-2 ${
                  isDirect
                    ? "bg-[#1C1F66] text-white"
                    : "bg-[#F1F5F9] text-[#475569] border border-gray-200"
                }`}
              >
                {hotel.rateLabel}
              </span>
              <h3 className="text-base sm:text-lg font-bold text-[#0F172A] leading-snug">
                {hotel.name}
              </h3>
              <div className="mt-1">
                <StarRating stars={hotel.stars} />
              </div>
              <p className="text-xs text-gray-500 font-medium mt-1.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                {hotel.distanceLabel}
              </p>
            </div>

            {/* Price */}
            <div className="text-right shrink-0">
              <p className="text-xl sm:text-2xl font-black text-[#0F172A]">
                ₦{hotel.pricePerNightNgn.toLocaleString()}
              </p>
              <p className="text-[11px] text-[#64748B] font-medium">per night</p>
              <p className="text-xs font-semibold text-[#64748B] mt-1 hidden sm:block">
                {nights} nights ₦{total.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Badges: board + cancellation */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3">
            <span className="text-[11px] sm:text-xs text-[#475569] bg-[#F1F5F9] font-semibold px-2.5 sm:px-3 py-1 rounded-full">
              {hotel.boardLabel}
            </span>
            {hotel.freeCancellation && (
              <span className="text-[11px] sm:text-xs text-emerald-700 bg-emerald-50 font-semibold border border-emerald-200 px-2.5 sm:px-3 py-1 rounded-full">
                Free cancellation
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500 line-clamp-1 flex-1 hidden sm:block">
            {hotel.description}
          </p>
          <span className="text-xs font-bold text-gray-600 sm:hidden">
            {nights} nights: ₦{total.toLocaleString()}
          </span>
          <Button
            onClick={() => setLocation(`/hotels/${hotel.id}`)}
            className="w-full sm:w-auto bg-[#FF4E00] hover:bg-[#E04500] text-white font-bold rounded-xl px-6 py-2.5 shadow-sm transition-all hover:scale-[1.02]"
          >
            View rooms
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default function HotelSearch() {
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);

  const [destination, setDestination] = useState(params.get("dest") || "makkah");
  const [checkIn] = useState(params.get("checkin") || "2027-01-12");
  const [checkOut] = useState(params.get("checkout") || "2027-01-19");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const nights = (() => {
    if (!checkIn || !checkOut) return 7;
    const d = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000);
    return d > 0 ? d : 7;
  })();

  // Filters
  const [filterDist, setFilterDist] = useState<number | null>(null);
  const [filterStars, setFilterStars] = useState<number | null>(null);
  const [filterBoard, setFilterBoard] = useState<string | null>(null);
  const [filterFree, setFilterFree] = useState(false);

  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchHotels() {
    setIsLoading(true);
    setError(null);
    try {
      const qp = new URLSearchParams();
      if (destination) qp.set("dest", destination);
      if (filterDist) qp.set("maxDistance", String(filterDist));
      if (filterStars) qp.set("stars", String(filterStars));
      if (filterBoard) qp.set("board", filterBoard);
      if (filterFree) qp.set("freeCancellation", "true");

      const res = await fetch(`/api/hotels/search?${qp.toString()}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setHotels(data.hotels || []);
    } catch {
      setError("Failed to load hotels. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchHotels();
  }, [destination, filterDist, filterStars, filterBoard, filterFree]);

  const FilterBody = (
    <div className="space-y-5">
      <h2 className="text-sm font-black text-[#0F172A] flex items-center justify-between pb-3 border-b border-gray-100">
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4" /> Filters
        </span>
        <button
          type="button"
          onClick={() => {
            setFilterDist(null);
            setFilterStars(null);
            setFilterBoard(null);
            setFilterFree(false);
          }}
          className="text-xs text-[#FF4E00] font-bold hover:underline"
        >
          Reset
        </button>
      </h2>

      {/* Distance to Haram */}
      <div>
        <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-2">
          Distance to the Haram
        </p>
        {[{ label: "Under 300 m", val: 300 }, { label: "300 – 700 m", val: 700 }, { label: "Over 700 m", val: 99999 }].map(
          (opt) => (
            <label key={opt.val} className="flex items-center gap-2 py-1.5 cursor-pointer">
              <Checkbox
                checked={filterDist === opt.val}
                onCheckedChange={(c) => setFilterDist(c ? opt.val : null)}
                className="border-[#DCE3F0] data-[state=checked]:bg-[#1C1F66] data-[state=checked]:border-[#1C1F66]"
              />
              <Label className="text-sm text-[#334155] cursor-pointer">{opt.label}</Label>
            </label>
          )
        )}
      </div>

      {/* Star rating */}
      <div>
        <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-2">Star Rating</p>
        {[5, 4, 3].map((s) => (
          <label key={s} className="flex items-center gap-2 py-1.5 cursor-pointer">
            <Checkbox
              checked={filterStars === s}
              onCheckedChange={(c) => setFilterStars(c ? s : null)}
              className="border-[#DCE3F0] data-[state=checked]:bg-[#1C1F66] data-[state=checked]:border-[#1C1F66]"
            />
            <Label className="flex items-center gap-1 cursor-pointer">
              {Array.from({ length: s }).map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              ))}
            </Label>
          </label>
        ))}
      </div>

      {/* Board */}
      <div>
        <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-2">Board</p>
        {[{ label: "Room only", val: "room_only" }, { label: "Breakfast", val: "breakfast" }].map((b) => (
          <label key={b.val} className="flex items-center gap-2 py-1.5 cursor-pointer">
            <Checkbox
              checked={filterBoard === b.val}
              onCheckedChange={(c) => setFilterBoard(c ? b.val : null)}
              className="border-[#DCE3F0] data-[state=checked]:bg-[#1C1F66] data-[state=checked]:border-[#1C1F66]"
            />
            <Label className="text-sm text-[#334155] cursor-pointer">{b.label}</Label>
          </label>
        ))}
      </div>

      {/* Policy */}
      <div>
        <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-2">Policy</p>
        <label className="flex items-center gap-2 py-1.5 cursor-pointer">
          <Checkbox
            checked={filterFree}
            onCheckedChange={(c) => setFilterFree(!!c)}
            className="border-[#DCE3F0] data-[state=checked]:bg-[#1C1F66] data-[state=checked]:border-[#1C1F66]"
          />
          <Label className="text-sm text-[#334155] cursor-pointer">Free cancellation</Label>
        </label>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFF]">
      <Navbar />

      <main className="pt-20">
        {/* Search summary bar */}
        <div className="bg-white border-b border-[#DCE3F0] shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm text-[#64748B]">
              <Building2 className="w-4 h-4 text-[#FF4E00]" />
              <span className="font-bold text-[#0F172A] text-sm sm:text-base capitalize">
                {destination || "Makkah"}
              </span>
              <span className="text-gray-300">|</span>
              <span className="font-medium text-gray-700">
                {checkIn && checkOut
                  ? `${new Date(checkIn).toLocaleDateString("en-NG", { day: "numeric", month: "short" })} – ${new Date(checkOut).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}`
                  : "12 – 19 Jan 2027"}
              </span>
              <span className="text-gray-300 hidden sm:inline">·</span>
              <span className="font-medium text-gray-700 hidden sm:inline">{nights} nights</span>
              <span className="text-gray-300 hidden sm:inline">·</span>
              <span className="font-medium text-gray-700 hidden sm:inline">1 room, 2 adults</span>
            </div>

            {/* Mobile Filter Button */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setMobileFilterOpen(true)}
                className="lg:hidden flex items-center gap-1.5 text-xs font-bold border-gray-300"
              >
                <Filter className="w-3.5 h-3.5 text-[#FF4E00]" />
                Filters
              </Button>
            </div>
          </div>
        </div>

        {/* ── 1-Tap Quick Destination Switcher Pills ── */}
        <div className="bg-white/80 border-b border-gray-100 py-3">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-xs font-bold text-gray-500 whitespace-nowrap mr-1">
              Holy Lands & Hubs:
            </span>
            {HOTEL_DESTINATIONS.map((dest) => (
              <button
                key={dest.id}
                type="button"
                onClick={() => setDestination(dest.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  destination === dest.id
                    ? "bg-[#1C1F66] text-white shadow-sm"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <span>{dest.icon}</span>
                <span>{dest.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Filter Sheet */}
        <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
          <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto p-6">
            <SheetHeader className="mb-4">
              <SheetTitle className="text-left font-black text-lg">Filter Hotels</SheetTitle>
            </SheetHeader>
            {FilterBody}
            <Button
              onClick={() => setMobileFilterOpen(false)}
              className="w-full mt-6 bg-[#FF4E00] text-white font-bold rounded-xl py-3"
            >
              Show Hotels
            </Button>
          </SheetContent>
        </Sheet>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex gap-8">
            {/* Desktop Filter sidebar */}
            <aside className="w-56 shrink-0 hidden lg:block">
              <div className="bg-white rounded-2xl border border-[#DCE3F0] p-5 sticky top-24">
                {FilterBody}
              </div>
            </aside>

            {/* Results */}
            <div className="flex-1 min-w-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <Loader2 className="w-10 h-10 animate-spin text-[#1C1F66]" />
                  <p className="text-[#64748B] font-medium">Searching hotels…</p>
                </div>
              ) : error ? (
                <div className="text-center py-24">
                  <p className="text-red-500 font-medium">{error}</p>
                  <Button onClick={fetchHotels} className="mt-4 bg-[#1C1F66] text-white">
                    Try again
                  </Button>
                </div>
              ) : hotels.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-[#64748B]">
                  <SearchX className="w-12 h-12" />
                  <p className="font-semibold text-lg">No hotels match your filters</p>
                  <p className="text-sm">Try adjusting your filters or destination</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs sm:text-sm text-[#64748B] font-medium">
                    {hotels.length} hotel{hotels.length !== 1 ? "s" : ""} found in {destination.charAt(0).toUpperCase() + destination.slice(1)}
                  </p>
                  <AnimatePresence>
                    {hotels.map((hotel) => (
                      <HotelCard key={hotel.id} hotel={hotel} nights={nights} />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
