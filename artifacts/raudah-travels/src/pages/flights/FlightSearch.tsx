import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Plane, Sparkles, Globe, SearchX } from "lucide-react";
import SearchForm from "@/components/flights/SearchForm";
import FlightCard from "@/components/flights/FlightCard";
import FlightCardSkeleton from "@/components/flights/FlightCardSkeleton";

export default function FlightSearch() {
  const [, setLocation] = useLocation();
  const [offers, setOffers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalAll, setTotalAll] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);

  const scrollToResults = useCallback(() => {
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }, []);

  // Store offers in a simple map so checkout can retrieve the selected one
  const storeOffers = useCallback((data: any[]) => {
    try {
      const map: Record<string, any> = {};
      data.forEach((o) => { map[o.id] = o; });
      sessionStorage.setItem("flight_offers", JSON.stringify(map));
    } catch {
      // sessionStorage not available — no-op
    }
  }, []);

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
    scrollToResults();

    try {
      const res = await fetch("/api/flights/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Search failed (${res.status})`);
      }

      const data = await res.json();
      const results = data.offers || [];
      setOffers(results);
      setTotalAll(data.totalAll || results.length);
      storeOffers(results);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setOffers([]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSelect(offerId: string) {
    setLocation(`/flights/checkout/${offerId}`);
  }

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary via-[#3A40B5] to-[#1C1F66] p-5 sm:p-8 lg:p-12 text-white"
      >
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-48 sm:w-72 h-48 sm:h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 sm:w-48 h-32 sm:h-48 bg-accent/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="absolute top-6 right-8 opacity-10 sm:opacity-20 hidden sm:block">
          <Globe className="w-24 sm:w-32 h-24 sm:h-32" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white/70">
              Premium Flight Search
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight mb-1.5 sm:mb-2 text-white">
            Find Your Perfect Flight
          </h1>
          <p className="text-sm sm:text-base text-white/70 max-w-lg font-medium">
            Search across 300+ airlines worldwide. Best fares guaranteed with instant booking confirmation.
          </p>
        </div>
      </motion.div>

      {/* Search Form */}
      <SearchForm onSearch={handleSearch} isLoading={isLoading} />

      {/* Results */}
      <div ref={resultsRef} className="scroll-mt-20" />
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Plane className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-sm font-semibold text-muted-foreground">Searching flights...</span>
            </div>
            <FlightCardSkeleton count={4} />
          </motion.div>
        )}

        {!isLoading && error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass-card rounded-2xl p-8 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <SearchX className="w-7 h-7 text-destructive" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">Search Error</h3>
            <p className="text-sm text-muted-foreground">{error}</p>
          </motion.div>
        )}

        {!isLoading && !error && hasSearched && offers.length === 0 && (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass-card rounded-2xl p-12 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto mb-4">
              <Plane className="w-8 h-8 text-primary/40" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">No flights found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              We couldn't find any flights for your search. Try different dates or airports.
            </p>
          </motion.div>
        )}

        {!isLoading && !error && offers.length > 0 && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Plane className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-foreground">
                  {totalAll > offers.length
                    ? `Showing best ${offers.length} of ${totalAll.toLocaleString()} flights`
                    : `${offers.length} flight${offers.length !== 1 ? "s" : ""} found`}
                </span>
              </div>
              {totalAll > offers.length && (
                <span className="text-xs text-muted-foreground font-medium">
                  Sorted by lowest price
                </span>
              )}
            </div>
            <div className="space-y-4">
              {offers.map((offer, i) => (
                <FlightCard
                  key={offer.id || i}
                  offer={offer}
                  onSelect={handleSelect}
                  index={i}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
