import { useState } from "react";
import { useListPackages, getListPackagesQueryKey } from "@workspace/api-client-react";
import { Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CalendarDays, MapPin, Users, Star, Check,
  SlidersHorizontal, X, ChevronRight, Plane, Building2,
} from "lucide-react";
import { CountdownBanner } from "@/components/CountdownBanner";
import { PackageAvailability } from "@/components/PackageAvailability";

const PACKAGE_IMAGES = [
  "https://images.pexels.com/photos/28209449/pexels-photo-28209449.jpeg",
  "https://images.pexels.com/photos/26436662/pexels-photo-26436662.jpeg",
  "https://images.pexels.com/photos/34246939/pexels-photo-34246939.jpeg",
  "https://images.pexels.com/photos/29676866/pexels-photo-29676866.jpeg",
];

/** Returns a valid external image URL for a package.
 * Falls back to a Pexels photo when imageUrl is absent, a localhost URL,
 * a Render/Railway internal URL, or a relative path — all of which are
 * dead on the production deployment.
 */
function getPackageImage(id: string, imageUrl?: string | null) {
  const isDeadUrl = !imageUrl ||
    imageUrl.startsWith("/") ||
    imageUrl.includes("localhost") ||
    imageUrl.includes("127.0.0.1") ||
    imageUrl.includes(".onrender.com") ||
    imageUrl.includes(".repl.co");

  const idx = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % PACKAGE_IMAGES.length;
  return isDeadUrl ? PACKAGE_IMAGES[idx] : imageUrl!;
}

const CATEGORY_COLORS: Record<string, string> = {
  premium: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  standard: "bg-blue-500/20 text-blue-200 border-blue-400/30",
  budget: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

const SEASON_BADGE: Record<string, string> = {
  Ramadan: "bg-purple-500/15 text-purple-300 border-purple-400/30",
  "Sha'ban": "bg-teal-500/15 text-teal-300 border-teal-400/30",
};

const TYPE_LABELS: Record<string, string> = {
  hajj: "Hajj", umrah: "Umrah", visa_only: "Visa Only", ticket_only: "Ticket Only",
  accommodation_only: "Accommodation Only", visa_ticket: "Visa + Ticket",
  visa_accommodation: "Visa + Accommodation", accommodation_ticket: "Accommodation + Ticket",
  all: "All Types"
};

export default function Packages() {
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const initialType = searchParams.get("type") as "hajj" | "umrah" | null;

  const [typeFilter, setTypeFilter] = useState<string>(initialType || "all");
  const [categoryFilter, setCategoryFilter] = useState<"premium" | "standard" | "budget" | "all">("all");
  const [seasonFilter, setSeasonFilter] = useState<string | "all">("all");
  const [priceRange, setPriceRange] = useState([0, 10_000_000]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const { data, isLoading } = useListPackages(
    { type: typeFilter === "all" ? undefined : typeFilter, available: true },
    { query: { queryKey: getListPackagesQueryKey({ type: typeFilter === "all" ? undefined : typeFilter, available: true }) } }
  );

  const packages = (data?.packages ?? []).filter(pkg => {
    if (categoryFilter !== "all" && pkg.category !== categoryFilter) return false;
    if (seasonFilter !== "all") {
      if (seasonFilter === "hajj" && pkg.type !== "hajj") return false;
      if (seasonFilter !== "hajj" && pkg.season !== seasonFilter) return false;
    }
    if (pkg.price < priceRange[0] || pkg.price > priceRange[1]) return false;
    return true;
  });

  const activeFilters =
    (typeFilter !== "all" ? 1 : 0) +
    (categoryFilter !== "all" ? 1 : 0) +
    (seasonFilter !== "all" ? 1 : 0) +
    (priceRange[1] < 10_000_000 ? 1 : 0);

  const clearAll = () => {
    setTypeFilter("all");
    setCategoryFilter("all");
    setSeasonFilter("all");
    setPriceRange([0, 10_000_000]);
  };

  const FilterPanel = () => (
    <div className="space-y-7">

      {/* Package Type */}
      <div>
        <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest mb-3">Package Type</p>
        <div className="flex flex-col gap-1.5">
          {(["all", "hajj", "umrah"] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                typeFilter === t
                  ? "bg-[#2D3199] text-white shadow-brand"
                  : "bg-[#F1F5F9] text-[#334155] hover:bg-[#EEF0FF] hover:text-[#2D3199]"
              }`}>
              <span className="capitalize">{TYPE_LABELS[t]}</span>
              {typeFilter === t && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
          <Select value={["hajj", "umrah", "all"].includes(typeFilter) ? "" : typeFilter} onValueChange={(v) => setTypeFilter(v)}>
            <SelectTrigger className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all h-auto ${!["hajj", "umrah", "all"].includes(typeFilter) ? "bg-[#2D3199] text-white shadow-brand" : "bg-[#F1F5F9] text-[#334155] hover:bg-[#EEF0FF] hover:text-[#2D3199] border-none"}`}>
              <SelectValue placeholder={!["hajj", "umrah", "all"].includes(typeFilter) ? TYPE_LABELS[typeFilter] : "Other Services"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="visa_only">Visa Only</SelectItem>
              <SelectItem value="ticket_only">Ticket Only</SelectItem>
              <SelectItem value="accommodation_only">Accommodation Only</SelectItem>
              <SelectItem value="visa_ticket">Visa + Ticket</SelectItem>
              <SelectItem value="visa_accommodation">Visa + Accommodation</SelectItem>
              <SelectItem value="accommodation_ticket">Accommodation + Ticket</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Category */}
      <div>
        <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest mb-3">Category</p>
        <div className="flex flex-col gap-1.5">
          {(["all", "premium", "standard", "budget"] as const).map(c => (
            <button key={c} onClick={() => setCategoryFilter(c)}
              className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                categoryFilter === c
                  ? "bg-[#2D3199] text-white shadow-brand"
                  : "bg-[#F1F5F9] text-[#334155] hover:bg-[#EEF0FF] hover:text-[#2D3199]"
              }`}>
              <span className="capitalize">{c === "all" ? "All Categories" : c}</span>
              {categoryFilter === c && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      </div>

      {/* Season */}
      <div>
        <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest mb-3">Season</p>
        <div className="flex flex-col gap-1.5">
          {(["all", "hajj", "Ramadan", "Sha'ban"] as const).map(s => (
            <button key={s} onClick={() => setSeasonFilter(s)}
              className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                seasonFilter === s
                  ? "bg-[#2D3199] text-white shadow-brand"
                  : "bg-[#F1F5F9] text-[#334155] hover:bg-[#EEF0FF] hover:text-[#2D3199]"
              }`}>
              <span>{s === "all" ? "All Seasons" : s}</span>
              {seasonFilter === s && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      </div>

      {/* Max Price */}
      <div>
        <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest mb-3">Max Price</p>
        <div className="px-1">
          <Slider
            defaultValue={[10_000_000]}
            max={10_000_000}
            step={500_000}
            onValueChange={(val) => setPriceRange([0, val[0]])}
            className="mb-3"
          />
          <div className="flex justify-between text-xs font-semibold text-[#64748B]">
            <span>₦0</span>
            <span className="text-[#2D3199]">₦{priceRange[1].toLocaleString()}</span>
          </div>
        </div>
      </div>

      {activeFilters > 0 && (
        <button onClick={clearAll}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-[#FF3B00] border border-[#FF3B00]/30 hover:bg-[#FF3B00]/5 transition-all">
          <X className="w-3.5 h-3.5" /> Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#F8F9FF]">
      <Navbar />

      {/* Page header */}
      <div className="bg-white border-b border-[#DCE3F0]" style={{ paddingTop: "80px" }}>
        <div className="container mx-auto px-4 md:px-8 py-5 md:py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <p className="text-[#2D3199] text-[10px] font-black uppercase tracking-widest mb-1">Explore</p>
              <h1 className="text-2xl md:text-3xl font-black text-[#0F172A] leading-tight">
                Hajj &amp; Umrah Packages
              </h1>
              <p className="text-[#64748B] text-sm mt-0.5">
                Curated pilgrimage packages for every budget — economy to five-star.
              </p>
            </div>

            {/* Quick type tabs (desktop) */}
            <div className="hidden md:flex items-center gap-1.5 bg-[#F1F5F9] p-1 rounded-2xl shrink-0">
              {(["all", "hajj", "umrah"] as const).map(t => (
                <button key={t} onClick={() => setTypeFilter(t)}
                  className={`px-4 py-1.5 rounded-xl text-sm font-bold transition-all ${
                    typeFilter === t ? "bg-white text-[#2D3199] shadow-sm" : "text-[#64748B] hover:text-[#2D3199]"
                  }`}>
                  {TYPE_LABELS[t]}
                </button>
              ))}
              <div className="relative">
                <Select value={["hajj", "umrah", "all"].includes(typeFilter) ? "" : typeFilter} onValueChange={(v) => setTypeFilter(v)}>
                  <SelectTrigger className={`px-4 py-1.5 rounded-xl text-sm font-bold transition-all border-none h-auto focus:ring-0 ${!["hajj", "umrah", "all"].includes(typeFilter) ? "bg-white text-[#2D3199] shadow-sm" : "bg-transparent text-[#64748B] hover:text-[#2D3199]"}`}>
                    <SelectValue placeholder={!["hajj", "umrah", "all"].includes(typeFilter) ? TYPE_LABELS[typeFilter] : "Other Services"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visa_only">Visa Only</SelectItem>
                    <SelectItem value="ticket_only">Ticket Only</SelectItem>
                    <SelectItem value="accommodation_only">Accommodation Only</SelectItem>
                    <SelectItem value="visa_ticket">Visa + Ticket</SelectItem>
                    <SelectItem value="visa_accommodation">Visa + Accommodation</SelectItem>
                    <SelectItem value="accommodation_ticket">Accommodation + Ticket</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#DCE3F0]">
            <p className="text-xs text-[#64748B]">
              {isLoading ? "Loading…" : <><span className="font-black text-[#0F172A]">{packages.length}</span> packages found</>}
            </p>
            <button onClick={() => setShowMobileFilters(true)}
              className="md:hidden flex items-center gap-2 px-3 py-1.5 bg-[#2D3199] text-white text-xs font-bold rounded-xl">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters {activeFilters > 0 && <span className="bg-[#FF3B00] text-white text-xs px-1.5 py-0.5 rounded-full">{activeFilters}</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowMobileFilters(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-2xl p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-[#0F172A] text-lg">Filters</h3>
              <button onClick={() => setShowMobileFilters(false)} className="p-2 rounded-xl hover:bg-[#F1F5F9]">
                <X className="w-5 h-5 text-[#64748B]" />
              </button>
            </div>
            <FilterPanel />
          </div>
        </div>
      )}

      <main className="flex-1">
        <div className="container mx-auto px-4 md:px-8 py-10">
          <div className="flex gap-8">
            {/* Sidebar filters (desktop) */}
            <aside className="hidden md:block w-60 shrink-0">
              <div className="sticky top-28 bg-white rounded-3xl border border-[#DCE3F0] shadow-[0_2px_16px_rgba(45,49,153,0.06)] p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-black text-[#0F172A]">Filters</h3>
                  {activeFilters > 0 && (
                    <span className="text-xs font-bold bg-[#FF3B00] text-white px-2 py-0.5 rounded-full">{activeFilters}</span>
                  )}
                </div>
                <FilterPanel />
              </div>
            </aside>

            {/* Package grid */}
            <div className="flex-1 min-w-0">
              {isLoading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-[460px] rounded-3xl bg-white animate-pulse border border-[#DCE3F0]" />
                  ))}
                </div>
              ) : packages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-20 h-20 rounded-full bg-[#EEF0FF] flex items-center justify-center mb-6">
                    <MapPin className="w-8 h-8 text-[#2D3199]" />
                  </div>
                  <h3 className="text-xl font-black text-[#0F172A] mb-2">No packages found</h3>
                  <p className="text-[#64748B] mb-6">Try adjusting your filters to see more options.</p>
                  <button onClick={clearAll}
                    className="px-6 py-2.5 bg-[#2D3199] text-white text-sm font-bold rounded-full hover:bg-[#25297F] transition-colors">
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {packages.map((pkg) => {
                    const spacesLeft = pkg.maxCapacity - pkg.currentBookings;
                    const imgSrc = getPackageImage(pkg.id, pkg.imageUrl);
                    const isLowAvail = spacesLeft > 0 && spacesLeft <= 15;
                    const fillPct = Math.round((pkg.currentBookings / pkg.maxCapacity) * 100);
                    return (
                      <Link key={pkg.id} href={`/packages/${pkg.id}`}
                        className="group block bg-white rounded-3xl border border-[#DCE3F0] overflow-hidden shadow-[0_2px_16px_rgba(45,49,153,0.06)] hover:shadow-[0_8px_40px_rgba(45,49,153,0.14)] hover:-translate-y-1 transition-all duration-300">

                        {/* Image */}
                        <div className="relative h-52 overflow-hidden bg-[#1C1F66]">
                          <img src={imgSrc} alt={pkg.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute inset-0"
                            style={{ background: "linear-gradient(to top, rgba(13,15,78,0.85) 0%, transparent 55%)" }} />

                          {/* Top left badges */}
                          <div className="absolute top-4 left-4 flex flex-wrap gap-1.5">
                            <span className="px-3 py-1 bg-[#FF3B00] text-white text-xs font-black uppercase tracking-wider rounded-full">
                              {TYPE_LABELS[pkg.type] ?? pkg.type}
                            </span>
                            <span className={`px-3 py-1 text-xs font-bold rounded-full border capitalize ${CATEGORY_COLORS[pkg.category] ?? ""}`}>
                              {pkg.category}
                            </span>
                            {pkg.season && (
                              <span className={`px-3 py-1 text-xs font-bold rounded-full border ${SEASON_BADGE[pkg.season] ?? "bg-white/15 text-white border-white/20"}`}>
                                {pkg.season}
                              </span>
                            )}
                          </div>

                          {/* Star rating */}
                          <span className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-1 bg-black/30 backdrop-blur border border-white/15 text-white text-xs font-bold rounded-full">
                            <Star className="w-3 h-3 fill-[#FF3B00] text-[#FF3B00]" /> {pkg.starRating}-Star
                          </span>

                          {/* Low availability */}
                          {isLowAvail && (
                            <span className="absolute bottom-12 left-4 px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-full shadow-lg">
                              Only {spacesLeft} left!
                            </span>
                          )}

                          {/* Price */}
                          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                            <div>
                              <p className="text-white text-2xl font-black leading-none">₦{pkg.price.toLocaleString()}</p>
                              <p className="text-white/55 text-[10px] font-medium mt-0.5">per person</p>
                            </div>
                            {pkg.agentDiscount > 0 && (
                              <span className="text-[10px] font-bold text-white/60 bg-white/10 border border-white/15 px-2.5 py-1 rounded-full">
                                Agent: ₦{(pkg.price - pkg.agentDiscount).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Card body */}
                        <div className="p-5">
                          <h3 className="text-base font-black text-[#0F172A] leading-snug mb-3 group-hover:text-[#2D3199] transition-colors line-clamp-2">
                            {pkg.name}
                          </h3>

                          {pkg.countdownEnabled && pkg.countdownExpiry && (
                            <div className="mb-3">
                              <CountdownBanner
                                expiry={pkg.countdownExpiry}
                                variant="card"
                                onExpired={pkg.countdownAction === "both" ? "show-closed" : "hide"}
                              />
                            </div>
                          )}

                          {/* Key stats row */}
                          <div className="flex items-center gap-3 text-xs text-[#64748B] mb-4 flex-wrap">
                            <span className="flex items-center gap-1.5 font-semibold">
                              <CalendarDays className="w-3.5 h-3.5 text-[#2D3199]" />
                              {pkg.durationDays} Days
                            </span>
                            <span className="w-1 h-1 rounded-full bg-[#DCE3F0]" />
                            <span className="flex items-center gap-1.5 font-semibold">
                              <Users className="w-3.5 h-3.5 text-[#2D3199]" />
                              {spacesLeft} spaces
                            </span>
                            <span className="w-1 h-1 rounded-full bg-[#DCE3F0]" />
                            <span className="flex items-center gap-1.5 font-semibold">
                              <Building2 className="w-3.5 h-3.5 text-[#2D3199]" />
                              Makkah + Madinah
                            </span>
                          </div>

                          {/* Airlines + Departure cities */}
                          <div className="flex items-start gap-4 mb-4">
                            {pkg.airlines.length > 0 && (
                              <div className="flex-1">
                                <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest mb-1.5">Airline</p>
                                <div className="flex flex-wrap gap-1">
                                  {pkg.airlines.map((a) => (
                                    <span key={a} className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#EEF0FF] text-[#2D3199] px-2 py-0.5 rounded-md">
                                      <Plane className="w-2.5 h-2.5" />{a}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {pkg.departureCities.length > 0 && (
                              <div className="flex-1">
                                <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest mb-1.5">Departs From</p>
                                <div className="flex flex-wrap gap-1">
                                  {pkg.departureCities.map((c) => (
                                    <span key={c} className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#F1F5F9] text-[#334155] px-2 py-0.5 rounded-md">
                                      <MapPin className="w-2.5 h-2.5" />{c}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Top inclusions */}
                          <div className="space-y-1.5 mb-4">
                            {pkg.inclusions.slice(0, 3).map((inc, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs text-[#475569]">
                                <span className="w-4 h-4 rounded-full bg-[#EEF0FF] flex items-center justify-center shrink-0">
                                  <Check className="w-2.5 h-2.5 text-[#2D3199]" />
                                </span>
                                <span className="truncate">{inc}</span>
                              </div>
                            ))}
                            {pkg.inclusions.length > 3 && (
                              <p className="text-[10px] text-[#94A3B8] pl-6">+{pkg.inclusions.length - 3} more inclusions</p>
                            )}
                          </div>

                          {/* Capacity bar */}
                          <PackageAvailability
                            maxCapacity={pkg.maxCapacity}
                            currentBookings={pkg.currentBookings}
                            className="mb-4"
                          />

                          {/* Departure + CTA */}
                          <div className="flex items-center justify-between pt-4 border-t border-[#F1F5F9]">
                            <div>
                              <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest">Departure</p>
                              <p className="text-sm font-bold text-[#334155]">
                                {new Date(pkg.departureDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                              </p>
                            </div>
                            <span className="flex items-center gap-1 px-4 py-2 bg-[#2D3199] group-hover:bg-[#FF3B00] text-white text-sm font-bold rounded-full transition-colors duration-300">
                              View Details <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
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
