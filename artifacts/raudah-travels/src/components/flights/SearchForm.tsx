import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PlaneTakeoff,
  PlaneLanding,
  CalendarDays,
  Users,
  Search,
  Loader2,
  MapPin,
  Check,
  Plus,
  Minus
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

export default function SearchForm({ onSearch, isLoading }: SearchFormProps) {
  const [journeyType, setJourneyType] = useState<"one_way" | "return" | "multi_city">("return");
  const [origin, setOrigin] = useState("LHR");
  const [destination, setDestination] = useState("JFK");
  const [departureDate, setDepartureDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
  );
  const [returnDate, setReturnDate] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0]
  );
  const [passengers, setPassengers] = useState({ adults: 1, children: 0 });
  const [cabinClass, setCabinClass] = useState("economy");

  // Autocomplete State
  const [originQuery, setOriginQuery] = useState(origin);
  const [destQuery, setDestQuery] = useState(destination);
  const [debouncedOrigin] = useDebounce(originQuery, 300);
  const [debouncedDest] = useDebounce(destQuery, 300);
  const [originPlaces, setOriginPlaces] = useState<Place[]>([]);
  const [destPlaces, setDestPlaces] = useState<Place[]>([]);
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);

  // Fetch places
  useEffect(() => {
    if (debouncedOrigin.length < 2) return;
    fetch(`/api/flights/places?q=${debouncedOrigin}`)
      .then((r) => r.json())
      .then((d) => setOriginPlaces(d.places || []))
      .catch(() => setOriginPlaces([]));
  }, [debouncedOrigin]);

  useEffect(() => {
    if (debouncedDest.length < 2) return;
    fetch(`/api/flights/places?q=${debouncedDest}`)
      .then((r) => r.json())
      .then((d) => setDestPlaces(d.places || []))
      .catch(() => setDestPlaces([]));
  }, [debouncedDest]);

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
        
        {/* Journey Type Selection */}
        <div className="flex flex-col mb-4">
          <Label className="text-sm font-bold text-foreground mb-3">Journey type</Label>
          <RadioGroup
            defaultValue="return"
            value={journeyType}
            onValueChange={(v: any) => setJourneyType(v)}
            className="flex items-center gap-6"
          >
            <div className="flex items-center space-x-2 cursor-pointer">
              <RadioGroupItem value="one_way" id="one_way" className="border-border text-[#4CAF50] focus-visible:ring-[#4CAF50]" />
              <Label htmlFor="one_way" className="cursor-pointer text-sm font-medium">One way</Label>
            </div>
            <div className="flex items-center space-x-2 cursor-pointer">
              <RadioGroupItem value="return" id="return" className="border-border text-[#4CAF50] focus-visible:ring-[#4CAF50]" />
              <Label htmlFor="return" className="cursor-pointer text-sm font-medium">Return</Label>
            </div>
            <div className="flex items-center space-x-2 opacity-50 cursor-not-allowed">
              <RadioGroupItem value="multi_city" id="multi_city" disabled className="border-border text-[#4CAF50]" />
              <Label htmlFor="multi_city" className="cursor-not-allowed text-sm font-medium">Multi-city</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Origin / Destination Row */}
          <div className="relative">
            <Label className="text-xs font-bold text-muted-foreground mb-2 block">Origin</Label>
            <div className="relative">
              <Input
                value={originQuery}
                onChange={(e) => {
                  setOriginQuery(e.target.value);
                  setShowOriginDropdown(true);
                }}
                onFocus={() => setShowOriginDropdown(true)}
                onBlur={() => setTimeout(() => setShowOriginDropdown(false), 200)}
                placeholder="City or airport..."
                className="h-12 bg-white/80 border-border rounded-xl font-medium"
              />
              {showOriginDropdown && originPlaces.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto">
                  {originPlaces.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setOrigin(p.iata_code);
                        setOriginQuery(p.iata_code);
                        setShowOriginDropdown(false);
                      }}
                      className="px-4 py-3 hover:bg-muted cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm text-foreground">{p.name}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {p.type}
                        </span>
                      </div>
                      <span className="font-bold text-primary bg-primary/10 px-2 py-1 rounded text-xs">
                        {p.iata_code}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="relative">
            <Label className="text-xs font-bold text-muted-foreground mb-2 block">Destination</Label>
            <div className="relative">
              <Input
                value={destQuery}
                onChange={(e) => {
                  setDestQuery(e.target.value);
                  setShowDestDropdown(true);
                }}
                onFocus={() => setShowDestDropdown(true)}
                onBlur={() => setTimeout(() => setShowDestDropdown(false), 200)}
                placeholder="City or airport..."
                className="h-12 bg-white/80 border-border rounded-xl font-medium"
              />
              {showDestDropdown && destPlaces.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto">
                  {destPlaces.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setDestination(p.iata_code);
                        setDestQuery(p.iata_code);
                        setShowDestDropdown(false);
                      }}
                      className="px-4 py-3 hover:bg-muted cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm text-foreground">{p.name}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {p.type}
                        </span>
                      </div>
                      <span className="font-bold text-primary bg-primary/10 px-2 py-1 rounded text-xs">
                        {p.iata_code}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Dates Row */}
          <div>
            <Label className="text-xs font-bold text-muted-foreground mb-2 block">Departure date</Label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="pl-10 h-12 bg-white/80 border-border rounded-xl font-medium"
              />
            </div>
          </div>

          <div className={journeyType === "one_way" ? "opacity-40 pointer-events-none" : ""}>
            <Label className="text-xs font-bold text-muted-foreground mb-2 block">Return date</Label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                min={departureDate}
                className="pl-10 h-12 bg-white/80 border-border rounded-xl font-medium"
              />
            </div>
          </div>

          {/* Passengers & Class Row */}
          <div>
            <Label className="text-xs font-bold text-muted-foreground mb-2 block">Passengers</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full h-12 justify-start text-left font-medium bg-white/80 border-border rounded-xl hover:bg-white"
                >
                  <Users className="w-4 h-4 mr-2 text-muted-foreground" />
                  {totalPassengers} {totalPassengers === 1 ? "adult" : "passengers"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-4 rounded-xl border-border bg-white shadow-xl" align="start">
                <div className="space-y-4">
                  {/* Adults */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">Adults</p>
                      <p className="text-xs text-muted-foreground">18+</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded bg-muted text-muted-foreground hover:bg-gray-200 border-0"
                        onClick={() => setPassengers(p => ({ ...p, adults: Math.max(1, p.adults - 1) }))}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-4 text-center font-semibold text-sm">{passengers.adults}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded bg-black text-white hover:bg-gray-800 border-0"
                        onClick={() => setPassengers(p => ({ ...p, adults: Math.min(9, p.adults + 1) }))}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {/* Children */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">Children</p>
                      <p className="text-xs text-muted-foreground">0–17</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded bg-muted text-muted-foreground hover:bg-gray-200 border-0"
                        onClick={() => setPassengers(p => ({ ...p, children: Math.max(0, p.children - 1) }))}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-4 text-center font-semibold text-sm">{passengers.children}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded bg-black text-white hover:bg-gray-800 border-0"
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
            <Label className="text-xs font-bold text-muted-foreground mb-2 block">Class</Label>
            <Select value={cabinClass} onValueChange={setCabinClass}>
              <SelectTrigger className="w-full h-12 bg-white/80 border-border rounded-xl font-medium focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border bg-white shadow-xl">
                <SelectItem value="economy">Economy</SelectItem>
                <SelectItem value="premium_economy">Premium Economy</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="first">First</SelectItem>
                <SelectItem value="any">Any</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <Button
            type="submit"
            disabled={isLoading || !origin || !destination}
            className="w-full h-14 bg-black hover:bg-gray-900 text-white font-bold text-lg rounded-xl shadow-lg transition-all duration-300"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : (
              "Find available flights"
            )}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
