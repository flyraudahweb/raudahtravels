import { useState } from "react";
import {
  useListPackages,
  getListPackagesQueryKey,
} from "@workspace/api-client-react";
import { Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Check, SlidersHorizontal, X } from "lucide-react";
import PackageCard from "@/components/packages/PackageCard";
import { packageTypeLabels as TYPE_LABELS } from "@/lib/packagePresentation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function Packages() {
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const initialType = searchParams.get("type") as "hajj" | "umrah" | null;

  const [typeFilter, setTypeFilter] = useState<string>(initialType || "all");
  const [categoryFilter, setCategoryFilter] = useState<
    "premium" | "standard" | "budget" | "all"
  >("all");
  const [seasonFilter, setSeasonFilter] = useState<string | "all">("all");
  const [priceRange, setPriceRange] = useState([0, 10_000_000]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const { data, isLoading, isError, refetch } = useListPackages(
    {
      type: typeFilter === "all" ? undefined : (typeFilter as any),
      available: true,
    },
    {
      query: {
        queryKey: getListPackagesQueryKey({
          type: typeFilter === "all" ? undefined : (typeFilter as any),
          available: true,
        }),
      },
    },
  );

  const packages = (data?.packages ?? []).filter((pkg) => {
    if (categoryFilter !== "all" && pkg.category !== categoryFilter)
      return false;
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

  const filterPanel = (
    <div className="space-y-7">
      {/* Package Type */}
      <div>
        <p className="text-sm font-semibold text-slate-700 mb-3">
          Package Type
        </p>
        <div className="flex flex-col gap-1.5">
          {(["all", "hajj", "umrah"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={typeFilter === t}
              onClick={() => setTypeFilter(t)}
              className={`flex min-h-11 items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                typeFilter === t
                  ? "bg-[#EEF0FF] text-[#2D3199]"
                  : "bg-white text-[#334155] hover:bg-[#F8FAFC] hover:text-[#2D3199]"
              }`}
            >
              <span className="capitalize">{TYPE_LABELS[t]}</span>
              {typeFilter === t && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
          <Select
            value={
              ["hajj", "umrah", "all"].includes(typeFilter) ? "" : typeFilter
            }
            onValueChange={(v) => setTypeFilter(v)}
          >
            <SelectTrigger
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all h-auto ${!["hajj", "umrah", "all"].includes(typeFilter) ? "bg-[#EEF0FF] text-[#2D3199]" : "bg-white text-[#334155] hover:bg-[#F8FAFC] hover:text-[#2D3199] border-none"}`}
            >
              <SelectValue
                placeholder={
                  !["hajj", "umrah", "all"].includes(typeFilter)
                    ? TYPE_LABELS[typeFilter]
                    : "Other Services"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="visa_only">Visa Only</SelectItem>
              <SelectItem value="ticket_only">Ticket Only</SelectItem>
              <SelectItem value="accommodation_only">
                Accommodation Only
              </SelectItem>
              <SelectItem value="visa_ticket">Visa + Ticket</SelectItem>
              <SelectItem value="visa_accommodation">
                Visa + Accommodation
              </SelectItem>
              <SelectItem value="accommodation_ticket">
                Accommodation + Ticket
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Category */}
      <div>
        <p className="text-sm font-semibold text-slate-700 mb-3">Category</p>
        <div className="flex flex-col gap-1.5">
          {(["all", "premium", "standard", "budget"] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={categoryFilter === c}
              onClick={() => setCategoryFilter(c)}
              className={`flex min-h-11 items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                categoryFilter === c
                  ? "bg-[#EEF0FF] text-[#2D3199]"
                  : "bg-white text-[#334155] hover:bg-[#F8FAFC] hover:text-[#2D3199]"
              }`}
            >
              <span className="capitalize">
                {c === "all" ? "All Categories" : c}
              </span>
              {categoryFilter === c && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      </div>

      {/* Season */}
      <div>
        <p className="text-sm font-semibold text-slate-700 mb-3">Season</p>
        <div className="flex flex-col gap-1.5">
          {(["all", "hajj", "Ramadan", "Sha'ban"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={seasonFilter === s}
              onClick={() => setSeasonFilter(s)}
              className={`flex min-h-11 items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                seasonFilter === s
                  ? "bg-[#EEF0FF] text-[#2D3199]"
                  : "bg-white text-[#334155] hover:bg-[#F8FAFC] hover:text-[#2D3199]"
              }`}
            >
              <span>{s === "all" ? "All Seasons" : s}</span>
              {seasonFilter === s && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      </div>

      {/* Max Price */}
      <div>
        <p className="text-sm font-semibold text-slate-700 mb-3">Max Price</p>
        <div className="px-1">
          <Slider
            value={[priceRange[1]]}
            max={10_000_000}
            step={500_000}
            onValueChange={(val) => setPriceRange([0, val[0]])}
            className="mb-3"
            aria-label="Maximum package price"
          />
          <div className="flex justify-between text-xs font-semibold text-[#64748B]">
            <span>₦0</span>
            <span className="text-[#2D3199]">
              ₦{priceRange[1].toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {activeFilters > 0 && (
        <button
          onClick={clearAll}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-[#FF3B00] border border-[#FF3B00]/30 hover:bg-[#FF3B00]/5 transition-all"
        >
          <X className="w-3.5 h-3.5" /> Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <Sheet open={showMobileFilters} onOpenChange={setShowMobileFilters}>
      <div className="min-h-[100dvh] flex flex-col bg-white">
        <Navbar />

        {/* Page header */}
        <div className="bg-[#F8F9FF] border-b border-[#DCE3F0] pt-20 md:pt-28">
          <div className="mx-auto max-w-7xl px-4 md:px-8 py-8 md:py-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <p className="text-[#2D3199] text-[10px] font-black uppercase tracking-widest mb-1">
                  Explore
                </p>
                <h1 className="text-2xl md:text-3xl font-black text-[#0F172A] leading-tight">
                  Hajj &amp; Umrah Packages
                </h1>
                <p className="text-[#64748B] text-sm mt-0.5">
                  Curated pilgrimage packages for every budget — economy to
                  five-star.
                </p>
              </div>

              {/* Quick type tabs (desktop) */}
              <div className="hidden md:flex items-center gap-1.5 bg-[#F1F5F9] p-1 rounded-2xl shrink-0">
                {(["all", "hajj", "umrah"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={typeFilter === t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-4 py-1.5 rounded-xl text-sm font-bold transition-all ${
                      typeFilter === t
                        ? "bg-white text-[#2D3199] shadow-sm"
                        : "text-[#64748B] hover:text-[#2D3199]"
                    }`}
                  >
                    {TYPE_LABELS[t]}
                  </button>
                ))}
                <div className="relative">
                  <Select
                    value={
                      ["hajj", "umrah", "all"].includes(typeFilter)
                        ? ""
                        : typeFilter
                    }
                    onValueChange={(v) => setTypeFilter(v)}
                  >
                    <SelectTrigger
                      className={`px-4 py-1.5 rounded-xl text-sm font-bold transition-all border-none h-auto focus:ring-0 ${!["hajj", "umrah", "all"].includes(typeFilter) ? "bg-white text-[#2D3199] shadow-sm" : "bg-transparent text-[#64748B] hover:text-[#2D3199]"}`}
                    >
                      <SelectValue
                        placeholder={
                          !["hajj", "umrah", "all"].includes(typeFilter)
                            ? TYPE_LABELS[typeFilter]
                            : "Other Services"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="visa_only">Visa Only</SelectItem>
                      <SelectItem value="ticket_only">Ticket Only</SelectItem>
                      <SelectItem value="accommodation_only">
                        Accommodation Only
                      </SelectItem>
                      <SelectItem value="visa_ticket">Visa + Ticket</SelectItem>
                      <SelectItem value="visa_accommodation">
                        Visa + Accommodation
                      </SelectItem>
                      <SelectItem value="accommodation_ticket">
                        Accommodation + Ticket
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#DCE3F0]">
              <p className="text-xs text-[#64748B]">
                {isLoading ? (
                  "Loading…"
                ) : (
                  <>
                    <span className="font-black text-[#0F172A]">
                      {packages.length}
                    </span>{" "}
                    packages found
                  </>
                )}
              </p>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="md:hidden flex min-h-11 items-center gap-2 px-4 py-2 bg-[#2D3199] text-white text-xs font-bold rounded-xl"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Filters{" "}
                  {activeFilters > 0 && (
                    <span className="bg-[#FF3B00] text-white text-xs px-1.5 py-0.5 rounded-full">
                      {activeFilters}
                    </span>
                  )}
                </button>
              </SheetTrigger>
            </div>
          </div>
        </div>

        <SheetContent
          side="right"
          className="w-[min(90vw,360px)] overflow-y-auto bg-white"
        >
          <SheetHeader className="mb-6">
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          {filterPanel}
          <Button
            type="button"
            onClick={() => setShowMobileFilters(false)}
            className="mt-6 min-h-11 w-full bg-[#2D3199] text-white"
          >
            Show packages
          </Button>
        </SheetContent>

        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 md:px-8 py-10 md:py-14">
            <div className="flex gap-8">
              {/* Sidebar filters (desktop) */}
              <aside className="hidden md:block w-60 shrink-0">
                <div className="sticky top-28 max-h-[calc(100dvh-8rem)] overflow-y-auto bg-white pr-4 pb-4">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-black text-[#0F172A]">Filters</h3>
                    {activeFilters > 0 && (
                      <span className="text-xs font-bold bg-[#FF3B00] text-white px-2 py-0.5 rounded-full">
                        {activeFilters}
                      </span>
                    )}
                  </div>
                  {filterPanel}
                </div>
              </aside>

              {/* Package grid */}
              <div className="flex-1 min-w-0">
                {isLoading ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-[460px] rounded-3xl bg-white animate-pulse border border-[#DCE3F0]"
                      />
                    ))}
                  </div>
                ) : isError ? (
                  <div
                    role="alert"
                    className="rounded-2xl bg-slate-50 px-6 py-16 text-center"
                  >
                    <h2 className="text-xl font-bold text-slate-900">
                      Unable to load packages
                    </h2>
                    <p className="mt-3 text-slate-600">Please try again.</p>
                    <button
                      type="button"
                      onClick={() => refetch()}
                      className="mt-5 min-h-11 rounded-lg bg-[#2D3199] px-6 text-sm font-semibold text-white"
                    >
                      Try again
                    </button>
                  </div>
                ) : packages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-20 h-20 rounded-full bg-[#EEF0FF] flex items-center justify-center mb-6">
                      <MapPin className="w-8 h-8 text-[#2D3199]" />
                    </div>
                    <h3 className="text-xl font-black text-[#0F172A] mb-2">
                      No packages found
                    </h3>
                    <p className="text-[#64748B] mb-6">
                      Try adjusting your filters to see more options.
                    </p>
                    <button
                      onClick={clearAll}
                      className="px-6 py-2.5 bg-[#2D3199] text-white text-sm font-bold rounded-full hover:bg-[#25297F] transition-colors"
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {packages.map((pkg) => (
                      <PackageCard key={pkg.id} pkg={pkg} detailed />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </Sheet>
  );
}
