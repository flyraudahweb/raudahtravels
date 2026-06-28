import { motion } from "framer-motion";
import { Plane, Luggage, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface FlightCardProps {
  offer: any;
  onSelect: (offerId: string) => void;
  index: number;
}

const GBP_TO_NGN = 1818.56;

function formatDuration(duration: string): string {
  const match = duration?.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return duration || "—";
  const h = match[1] ? `${match[1]}h` : "";
  const m = match[2] ? ` ${match[2]}m` : "";
  return `${h}${m}`.trim();
}

function formatTime(dateTime: string): string {
  if (!dateTime) return "--:--";
  const d = new Date(dateTime);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatPrice(amount: number | string, currency: string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(num);
}

function airlineColor(name: string): string {
  const colors = [
    "bg-blue-600", "bg-emerald-600", "bg-violet-600",
    "bg-rose-600", "bg-amber-600", "bg-teal-600",
    "bg-indigo-600", "bg-pink-600",
  ];
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) hash = (hash + name.charCodeAt(i)) * 31;
  return colors[Math.abs(hash) % colors.length];
}

export default function FlightCard({ offer, onSelect, index }: FlightCardProps) {
  const priceGBP = parseFloat(offer.total_amount || "0");
  const priceCurrency = offer.total_currency || "GBP";
  const priceNGN = priceCurrency === "GBP" ? priceGBP * GBP_TO_NGN : priceGBP;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.45, ease: "easeOut" }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="glass-card rounded-2xl p-4 sm:p-5 hover:shadow-brand transition-shadow duration-300 cursor-pointer group"
      onClick={() => onSelect(offer.id)}
    >
      <div className="flex flex-col lg:flex-row lg:items-stretch gap-4 lg:gap-6">
        {/* Slices list */}
        <div className="flex-1 flex flex-col justify-center gap-4">
          {offer.slices?.map((slice: any, sliceIndex: number) => {
            const segment = slice?.segments?.[0];
            const airline = offer.owner?.name || segment?.marketing_carrier?.name || "Airline";
            const airlineCode = offer.owner?.iata_code || segment?.marketing_carrier?.iata_code || "";
            const origin = slice?.origin?.iata_code || segment?.origin?.iata_code || "---";
            const dest = slice?.destination?.iata_code || segment?.destination?.iata_code || "---";
            const depTime = formatTime(segment?.departing_at || "");
            const arrTime = formatTime(slice?.segments?.[slice.segments.length - 1]?.arriving_at || "");
            const duration = formatDuration(slice?.duration || segment?.duration || "");
            const stops = (slice?.segments?.length || 1) - 1;
            const cabin = segment?.passengers?.[0]?.cabin_class_marketing_name || "Economy";
            const bagsIncluded = segment?.passengers?.[0]?.baggages?.filter((b: any) => b.type === "checked")?.length || 0;

            return (
              <div key={slice.id || sliceIndex} className="relative">
                {sliceIndex > 0 && <Separator className="mb-4 bg-border/50" />}
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:gap-6">
                  {/* Airline info */}
                  <div className="flex items-center gap-3 sm:w-40 lg:w-44 shrink-0">
                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${airlineColor(airline)} flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-sm`}>
                      {airlineCode || airline.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs sm:text-sm text-foreground leading-tight truncate">{airline}</p>
                      {airlineCode && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">{airlineCode}</p>
                      )}
                    </div>
                  </div>

                  {/* Flight path */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      {/* Departure */}
                      <div className="text-center shrink-0">
                        <p className="text-lg sm:text-xl lg:text-2xl font-black text-foreground tracking-tight">{depTime}</p>
                        <p className="text-xs sm:text-sm font-bold text-primary">{origin}</p>
                      </div>

                      {/* Flight path line */}
                      <div className="flex-1 flex flex-col items-center gap-1 px-1 sm:px-2">
                        <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground">{duration}</span>
                        <div className="w-full flex items-center gap-1">
                          <div className="h-[2px] flex-1 bg-gradient-to-r from-primary/40 to-primary/20 rounded-full" />
                          <Plane className={`w-3 h-3 sm:w-4 sm:h-4 text-primary shrink-0 ${sliceIndex > 0 ? 'rotate-180 text-accent' : ''}`} />
                          <div className="h-[2px] flex-1 bg-gradient-to-r from-primary/20 to-primary/40 rounded-full" />
                        </div>
                        <span className={`text-[10px] sm:text-xs font-semibold ${stops === 0 ? "text-emerald-600" : "text-amber-600"}`}>
                          {stops === 0 ? "Direct" : `${stops} stop${stops > 1 ? "s" : ""}`}
                        </span>
                      </div>

                      {/* Arrival */}
                      <div className="text-center shrink-0">
                        <p className="text-lg sm:text-xl lg:text-2xl font-black text-foreground tracking-tight">{arrTime}</p>
                        <p className="text-xs sm:text-sm font-bold text-primary">{dest}</p>
                      </div>
                    </div>
                  </div>

                  {/* Badges (desktop inline, mobile below) */}
                  <div className="hidden xl:flex flex-col gap-1.5 shrink-0 w-24 items-end justify-center">
                    <Badge variant="secondary" className="text-[10px] font-semibold bg-primary/5 text-primary border-primary/10 whitespace-nowrap">
                      {cabin}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] font-semibold bg-muted text-muted-foreground whitespace-nowrap">
                      <Luggage className="w-2.5 h-2.5 mr-1" />
                      {bagsIncluded > 0 ? `${bagsIncluded} bag${bagsIncluded > 1 ? "s" : ""}` : "No bags"}
                    </Badge>
                  </div>
                </div>

                {/* Mobile Badges */}
                <div className="flex xl:hidden flex-wrap gap-2 mt-3 sm:mt-2 sm:pl-[10.5rem] lg:pl-52">
                  <Badge variant="secondary" className="text-[10px] sm:text-xs font-semibold bg-primary/5 text-primary border-primary/10">
                    {cabin}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] sm:text-xs font-semibold bg-muted text-muted-foreground">
                    <Luggage className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" />
                    {bagsIncluded > 0 ? `${bagsIncluded} bag${bagsIncluded > 1 ? "s" : ""}` : "No bags"}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>

        <Separator orientation="horizontal" className="lg:hidden bg-border/60" />
        <Separator orientation="vertical" className="hidden lg:block h-auto bg-border/60" />

        {/* Offer Meta / Price / Select Button */}
        <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-4 shrink-0 lg:w-44 py-1 lg:py-2">
          <div className="text-left lg:text-right flex flex-col justify-center">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground line-through opacity-70">
              {formatPrice(priceGBP, "GBP")}
            </p>
            <p className="text-lg sm:text-xl lg:text-2xl font-black text-accent tracking-tight leading-none mt-0.5">
              ₦{priceNGN.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Total price</p>
          </div>

          <Button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(offer.id);
            }}
            className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-brand hover:shadow-brand-lg transition-all duration-300 px-4 sm:px-6 h-10 sm:h-12 w-full max-w-[140px] lg:max-w-none"
          >
            Select
            <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
