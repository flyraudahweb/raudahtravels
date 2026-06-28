import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  PlaneTakeoff,
  PlaneLanding,
  CalendarDays,
  Users,
  Loader2,
  MapPin,
  Plus,
  Minus,
  ArrowRightLeft,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "use-debounce";

interface Place {
  id: string;
  name: string;
  iata_code: string;
  iata_city_code?: string;
  city_name?: string;
  type: string;
}

interface SearchFormProps {
  onSearch: (params: {
    origin: string;
    destination: string;
    departureDate: string;
    returnDate?: string;
    journeyType: "one_way" | "return" | "multi_city";
    passengers: { adults: number; children: number };
    cabinClass: string;
  }) => void;
  isLoading: boolean;
}

// Format a place for display: "London Heathrow (LHR)"
function formatPlaceDisplay(place: Place): string {
  return `${place.name} (${place.iata_code})`;
}

// Format a short label for selected state
function formatSelectedLabel(name: string, code: string): string {
  if (!name || name === code) return code;
  // Truncate long names on very small screens
  const shortName = name.length > 25 ? name.substring(0, 22) + "…" : name;
  return `${shortName} (${code})`;
}

const CABIN_LABELS: Record<string, string> = {
  economy: "Economy",
  premium_economy: "Premium Economy",
  business: "Business",
  first: "First",
  any: "Any",
};

export default function SearchForm({ onSearch, isLoading }: SearchFormProps) {
  const [journeyType, setJourneyType] = useState<"one_way" | "return" | "multi_city">("return");

  // Store both code and display name
  const [origin, setOrigin] = useState("LHR");
  const [originName, setOriginName] = useState("London Heathrow");
  const [destination, setDestination] = useState("JFK");
  const [destName, setDestName] = useState("New York J.F. Kennedy");

  const [departureDate, setDepartureDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
  );
  const [returnDate, setReturnDate] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0]
  );
  const [passengers, setPassengers] = useState({ adults: 1, children: 0 });
  const [cabinClass, setCabinClass] = useState("economy");

  // Autocomplete State
  const [originQuery, setOriginQuery] = useState("London Heathrow (LHR)");
  const [destQuery, setDestQuery] = useState("New York J.F. Kennedy (JFK)");
  const [debouncedOrigin] = useDebounce(originQuery, 300);
  const [debouncedDest] = useDebounce(destQuery, 300);
  const [originPlaces, setOriginPlaces] = useState<Place[]>([]);
  const [destPlaces, setDestPlaces] = useState<Place[]>([]);
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);
  const [isOriginFocused, setIsOriginFocused] = useState(false);
  const [isDestFocused, setIsDestFocused] = useState(false);

  // Fetch places for origin
  useEffect(() => {
    if (debouncedOrigin.length < 2 || !isOriginFocused) return;
    // Don't search if the query matches the currently selected display value
    const currentDisplay = formatSelectedLabel(originName, origin);
    if (debouncedOrigin === currentDisplay) return;

    fetch(`/api/flights/places?q=${encodeURIComponent(debouncedOrigin)}`)
      .then((r) => r.json())
      .then((d) => {
        setOriginPlaces(d.places || []);
        if ((d.places || []).length > 0) setShowOriginDropdown(true);
      })
      .catch(() => setOriginPlaces([]));
  }, [debouncedOrigin, isOriginFocused]);

  // Fetch places for destination
  useEffect(() => {
    if (debouncedDest.length < 2 || !isDestFocused) return;
    const currentDisplay = formatSelectedLabel(destName, destination);
    if (debouncedDest === currentDisplay) return;

    fetch(`/api/flights/places?q=${encodeURIComponent(debouncedDest)}`)
      .then((r) => r.json())
      .then((d) => {
        setDestPlaces(d.places || []);
        if ((d.places || []).length > 0) setShowDestDropdown(true);
      })
      .catch(() => setDestPlaces([]));
  }, [debouncedDest, isDestFocused]);

  function selectOrigin(place: Place) {
    setOrigin(place.iata_code);
    setOriginName(place.name);
    setOriginQuery(formatSelectedLabel(place.name, place.iata_code));
    setShowOriginDropdown(false);
    setIsOriginFocused(false);
  }

  function selectDestination(place: Place) {
    setDestination(place.iata_code);
    setDestName(place.name);
    setDestQuery(formatSelectedLabel(place.name, place.iata_code));
    setShowDestDropdown(false);
    setIsDestFocused(false);
  }

  function handleSwap() {
    const tempCode = origin;
    const tempName = originName;
    const tempQuery = originQuery;
    setOrigin(destination);
    setOriginName(destName);
    setOriginQuery(destQuery);
    setDestination(tempCode);
    setDestName(tempName);
    setDestQuery(tempQuery);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSearch({
      origin,
      destination,
      departureDate,
      returnDate: journeyType === "return" ? returnDate : undefined,
      journeyType,
      passengers,
      cabinClass,
    });
  }

  const totalPassengers = passengers.adults + passengers.children;
  const passengerLabel = (() => {
    const parts: string[] = [];
    if (passengers.adults > 0) parts.push(`${passengers.adults} Adult${passengers.adults > 1 ? "s" : ""}`);
    if (passengers.children > 0) parts.push(`${passengers.children} Child${passengers.children > 1 ? "ren" : ""}`);
    return parts.join(", ");
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-4 sm:p-6 lg:p-8 space-y-5">

        {/* Journey Type */}
        <div>
          <Label className="text-sm font-bold text-foreground mb-3 block">Journey type</Label>
          <RadioGroup
            value={journeyType}
            onValueChange={(v: any) => setJourneyType(v)}
            className="flex flex-wrap items-center gap-4 sm:gap-6"
          >
            {[
              { value: "one_way", label: "One way", disabled: false },
              { value: "return", label: "Return", disabled: false },
              { value: "multi_city", label: "Multi-city", disabled: true },
            ].map((opt) => (
              <div
                key={opt.value}
                className={`flex items-center space-x-2 ${opt.disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <RadioGroupItem
                  value={opt.value}
                  id={opt.value}
                  disabled={opt.disabled}
                  className="border-border text-primary focus-visible:ring-primary"
                />
                <Label
                  htmlFor={opt.value}
                  className={`text-sm font-medium ${opt.disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                >
                  {opt.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Origin & Destination */}
        <div className="space-y-3 sm:space-y-0 sm:flex sm:items-end sm:gap-3">
          {/* Origin */}
          <div className="flex-1 relative">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
              <PlaneTakeoff className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
              Where from?
            </Label>
            <Input
              value={originQuery}
              onChange={(e) => {
                setOriginQuery(e.target.value);
                setIsOriginFocused(true);
              }}
              onFocus={() => {
                setIsOriginFocused(true);
                // Select all text on focus for easy re-typing
                if (originQuery) setOriginQuery("");
              }}
              onBlur={() => {
                setTimeout(() => {
                  setShowOriginDropdown(false);
                  setIsOriginFocused(false);
                  // Restore display if user didn't pick a new option
                  if (!originQuery.trim()) {
                    setOriginQuery(formatSelectedLabel(originName, origin));
                  }
                }, 200);
              }}
              placeholder="Type a city or airport…"
              className="h-12 sm:h-14 bg-white border-border rounded-xl text-sm sm:text-base font-medium pl-4 pr-4 focus:border-primary focus:ring-primary/20"
            />
            {showOriginDropdown && originPlaces.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-soft-lg z-50 max-h-64 overflow-y-auto">
                {originPlaces.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => selectOrigin(p)}
                    className="w-full px-4 py-3 hover:bg-primary/5 cursor-pointer flex items-center justify-between transition-colors text-left border-b border-border/30 last:border-0"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{p.type?.replace("_", " ")}</p>
                      </div>
                    </div>
                    <span className="font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg text-xs tracking-wider shrink-0 ml-2">
                      {p.iata_code}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Swap */}
          <div className="flex justify-center sm:pb-0.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleSwap}
              className="w-10 h-10 rounded-full bg-white hover:bg-primary hover:text-white border-primary/20 transition-all duration-300 shadow-soft hover:shadow-brand"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </Button>
          </div>

          {/* Destination */}
          <div className="flex-1 relative">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
              <PlaneLanding className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
              Where to?
            </Label>
            <Input
              value={destQuery}
              onChange={(e) => {
                setDestQuery(e.target.value);
                setIsDestFocused(true);
              }}
              onFocus={() => {
                setIsDestFocused(true);
                if (destQuery) setDestQuery("");
              }}
              onBlur={() => {
                setTimeout(() => {
                  setShowDestDropdown(false);
                  setIsDestFocused(false);
                  if (!destQuery.trim()) {
                    setDestQuery(formatSelectedLabel(destName, destination));
                  }
                }, 200);
              }}
              placeholder="Type a city or airport…"
              className="h-12 sm:h-14 bg-white border-border rounded-xl text-sm sm:text-base font-medium pl-4 pr-4 focus:border-primary focus:ring-primary/20"
            />
            {showDestDropdown && destPlaces.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-soft-lg z-50 max-h-64 overflow-y-auto">
                {destPlaces.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => selectDestination(p)}
                    className="w-full px-4 py-3 hover:bg-primary/5 cursor-pointer flex items-center justify-between transition-colors text-left border-b border-border/30 last:border-0"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{p.type?.replace("_", " ")}</p>
                      </div>
                    </div>
                    <span className="font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg text-xs tracking-wider shrink-0 ml-2">
                      {p.iata_code}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
              <CalendarDays className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
              Departure
            </Label>
            <Input
              type="date"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="h-12 sm:h-14 bg-white border-border rounded-xl font-medium text-sm sm:text-base pl-4 focus:border-primary focus:ring-primary/20"
            />
          </div>

          <div className={`transition-opacity duration-300 ${journeyType === "one_way" ? "opacity-30 pointer-events-none" : ""}`}>
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
              <CalendarDays className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
              Return
            </Label>
            <Input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              min={departureDate}
              className="h-12 sm:h-14 bg-white border-border rounded-xl font-medium text-sm sm:text-base pl-4 focus:border-primary focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Passengers & Class */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
              <Users className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
              Passengers
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 sm:h-14 justify-between text-left font-medium bg-white border-border rounded-xl hover:bg-white hover:border-primary/40 text-sm sm:text-base"
                >
                  <span>{passengerLabel}</span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-5 rounded-xl border-border bg-white shadow-soft-lg" align="start">
                <div className="space-y-5">
                  {/* Adults */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm text-foreground">Adults</p>
                      <p className="text-xs text-muted-foreground">18 years and older</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-lg bg-muted text-foreground hover:bg-gray-200 border-0"
                        onClick={() => setPassengers(p => ({ ...p, adults: Math.max(1, p.adults - 1) }))}
                        disabled={passengers.adults <= 1}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-6 text-center font-bold text-base">{passengers.adults}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-lg bg-primary text-white hover:bg-primary/90 border-0"
                        onClick={() => setPassengers(p => ({ ...p, adults: Math.min(9, p.adults + 1) }))}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {/* Children */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm text-foreground">Children</p>
                      <p className="text-xs text-muted-foreground">0 – 17 years</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-lg bg-muted text-foreground hover:bg-gray-200 border-0"
                        onClick={() => setPassengers(p => ({ ...p, children: Math.max(0, p.children - 1) }))}
                        disabled={passengers.children <= 0}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-6 text-center font-bold text-base">{passengers.children}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-lg bg-primary text-white hover:bg-primary/90 border-0"
                        onClick={() => setPassengers(p => ({ ...p, children: Math.min(9, p.children + 1) }))}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Class
            </Label>
            <Select value={cabinClass} onValueChange={setCabinClass}>
              <SelectTrigger className="w-full h-12 sm:h-14 bg-white border-border rounded-xl font-medium text-sm sm:text-base focus:ring-0 focus:border-primary/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border bg-white shadow-soft-lg">
                {Object.entries(CABIN_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Search Button */}
        <div className="pt-2">
          <Button
            type="submit"
            disabled={isLoading || !origin || !destination}
            className="w-full h-13 sm:h-14 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 text-white font-bold text-base sm:text-lg rounded-xl shadow-brand hover:shadow-brand-lg transition-all duration-300 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Find available flights"
            )}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
