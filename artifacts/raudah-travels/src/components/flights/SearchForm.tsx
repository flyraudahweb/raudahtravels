import { useState } from "react";
import { motion } from "framer-motion";
import {
  PlaneTakeoff,
  PlaneLanding,
  ArrowRightLeft,
  CalendarDays,
  Users,
  Search,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SearchFormProps {
  onSearch: (params: {
    origin: string;
    destination: string;
    departureDate: string;
    passengers: number;
  }) => void;
  isLoading: boolean;
}

export default function SearchForm({ onSearch, isLoading }: SearchFormProps) {
  const [origin, setOrigin] = useState("LHR");
  const [destination, setDestination] = useState("JFK");
  const [departureDate, setDepartureDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
  );
  const [passengers, setPassengers] = useState(1);

  function handleSwap() {
    setOrigin(destination);
    setDestination(origin);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSearch({ origin, destination, departureDate, passengers });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 sm:p-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Origin */}
          <motion.div
            className="md:col-span-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <Label htmlFor="origin" className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
              From
            </Label>
            <div className="relative">
              <PlaneTakeoff className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
              <Input
                id="origin"
                value={origin}
                onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                placeholder="LHR"
                maxLength={3}
                className="pl-10 h-12 text-lg font-bold tracking-widest uppercase bg-white/60 border-border/50 focus:border-primary focus:ring-primary/20 rounded-xl"
              />
            </div>
          </motion.div>

          {/* Swap Button */}
          <motion.div
            className="md:col-span-1 flex justify-center"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.3, type: "spring" }}
          >
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleSwap}
              className="w-10 h-10 rounded-full bg-white/80 hover:bg-primary hover:text-white border-primary/20 transition-all duration-300 shadow-soft hover:shadow-brand mt-5 md:mt-0"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </Button>
          </motion.div>

          {/* Destination */}
          <motion.div
            className="md:col-span-3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <Label htmlFor="destination" className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
              To
            </Label>
            <div className="relative">
              <PlaneLanding className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
              <Input
                id="destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value.toUpperCase())}
                placeholder="JFK"
                maxLength={3}
                className="pl-10 h-12 text-lg font-bold tracking-widest uppercase bg-white/60 border-border/50 focus:border-primary focus:ring-primary/20 rounded-xl"
              />
            </div>
          </motion.div>

          {/* Departure Date */}
          <motion.div
            className="md:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <Label htmlFor="departure" className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
              Departure
            </Label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
              <Input
                id="departure"
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="pl-10 h-12 bg-white/60 border-border/50 focus:border-primary focus:ring-primary/20 rounded-xl font-semibold"
              />
            </div>
          </motion.div>

          {/* Passengers */}
          <motion.div
            className="md:col-span-1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
          >
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
              Guests
            </Label>
            <Select
              value={String(passengers)}
              onValueChange={(v) => setPassengers(Number(v))}
            >
              <SelectTrigger className="h-12 bg-white/60 border-border/50 rounded-xl font-semibold">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary/60" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </motion.div>

          {/* Search Button */}
          <motion.div
            className="md:col-span-2"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35, duration: 0.4, type: "spring" }}
          >
            <Button
              type="submit"
              disabled={isLoading || !origin || !destination || !departureDate}
              className="w-full h-12 bg-accent hover:bg-accent/90 text-white font-bold text-base rounded-xl shadow-cta hover:shadow-cta transition-all duration-300 border-0"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Search
                </>
              )}
            </Button>
          </motion.div>
        </div>
      </form>
    </motion.div>
  );
}
