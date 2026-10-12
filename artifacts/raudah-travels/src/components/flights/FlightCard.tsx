import { motion } from "framer-motion";
import { Plane, Luggage } from "lucide-react";
import { Button } from "@/components/ui/button";

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

function getAirlineStyle(airline: string, code: string) {
  const upper = (airline || code || "").toUpperCase();
  if (upper.includes("EGYPT") || code === "MS") {
    return { bg: "bg-[#1C1F66]", text: "text-white", initials: "MS", name: "EgyptAir" };
  }
  if (upper.includes("ETHIOPIAN") || code === "ET") {
    return { bg: "bg-[#047857]", text: "text-white", initials: "ET", name: "Ethiopian Airlines" };
  }
  if (upper.includes("QATAR") || code === "QR") {
    return { bg: "bg-[#7E22CE]", text: "text-white", initials: "QR", name: "Qatar Airways" };
  }
  if (upper.includes("EMIRATES") || code === "EK") {
    return { bg: "bg-[#DC2626]", text: "text-white", initials: "EK", name: "Emirates" };
  }
  if (upper.includes("SAUDI") || code === "SV") {
    return { bg: "bg-[#065F46]", text: "text-white", initials: "SV", name: "Saudia" };
  }
  return {
    bg: "bg-[#2D3199]",
    text: "text-white",
    initials: code || airline.slice(0, 2).toUpperCase() || "FL",
    name: airline || "Airline",
  };
}

export default function FlightCard({ offer, onSelect, index }: FlightCardProps) {
  const priceGBP = parseFloat(offer.total_amount || "0");
  const priceCurrency = offer.total_currency || "GBP";
  const priceNGN = priceCurrency === "GBP" ? priceGBP * GBP_TO_NGN : priceGBP;

  const slice = offer.slices?.[0];
  const segments = slice?.segments || [];
  const firstSeg = segments[0];
  const lastSeg = segments[segments.length - 1] || firstSeg;

  const rawAirlineName = offer.owner?.name || firstSeg?.marketing_carrier?.name || "Airline";
  const airlineCode = offer.owner?.iata_code || firstSeg?.marketing_carrier?.iata_code || "";
  const airlineInfo = getAirlineStyle(rawAirlineName, airlineCode);

  const originCode = slice?.origin?.iata_code || firstSeg?.origin?.iata_code || "ABV";
  const destCode = slice?.destination?.iata_code || lastSeg?.destination?.iata_code || "JED";

  const depTime = formatTime(firstSeg?.departing_at || "2027-01-12T23:10:00");
  const arrTime = formatTime(lastSeg?.arriving_at || "2027-01-13T09:45:00");
  const duration = formatDuration(slice?.duration || firstSeg?.duration || "PT10H35M");

  const stopsCount = Math.max(0, segments.length - 1);
  const stopCode = segments.length > 1 ? segments[0]?.destination?.iata_code || "CAI" : null;
  const stopsText = stopsCount === 0 ? "Non-stop" : `${stopsCount} stop${stopCode ? ` - ${stopCode}` : ""}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="bg-white rounded-2xl border border-[#E2E8F0] p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
        {/* Top / Left: Airline info & Baggage */}
        <div className="flex items-center justify-between md:justify-start gap-3 md:w-44 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full ${airlineInfo.bg} ${airlineInfo.text} flex items-center justify-center font-black text-xs sm:text-sm shrink-0 shadow-sm`}>
              {airlineInfo.initials}
            </div>
            <div>
              <p className="font-bold text-xs sm:text-sm text-[#0F172A] leading-tight">
                {airlineInfo.name}
              </p>
              {airlineCode && (
                <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium">{airlineCode}</p>
              )}
            </div>
          </div>

          {/* Baggage Tag visible at top on mobile */}
          <div className="md:hidden flex items-center text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <Luggage className="w-3 h-3 mr-1" />
            23 kg bag
          </div>
        </div>

        {/* Middle: Departure ➔ Route Timeline ➔ Arrival */}
        <div className="flex-1 flex items-center justify-between gap-2 sm:gap-4 py-2 sm:py-0">
          {/* Departure */}
          <div className="text-left shrink-0">
            <p className="text-lg sm:text-xl font-black text-[#0F172A]">{depTime}</p>
            <p className="text-[11px] sm:text-xs font-bold text-gray-500 mt-0.5">{originCode}</p>
          </div>

          {/* Timeline Bar */}
          <div className="flex-1 max-w-[180px] sm:max-w-[210px] flex flex-col items-center px-1 sm:px-2">
            <span className="text-[10px] sm:text-[11px] font-semibold text-gray-500 mb-1">
              {duration}
            </span>
            <div className="relative w-full flex items-center">
              <div className="w-full h-[2px] bg-gray-200 rounded-full" />
              {stopsCount > 0 && (
                <div className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#FF4E00] ring-4 ring-white" />
              )}
            </div>
            <span className={`text-[10px] sm:text-[11px] font-bold mt-1 ${stopsCount > 0 ? "text-[#FF4E00]" : "text-emerald-600"}`}>
              {stopsText}
            </span>
          </div>

          {/* Arrival */}
          <div className="text-right shrink-0">
            <p className="text-lg sm:text-xl font-black text-[#0F172A]">{arrTime}</p>
            <p className="text-[11px] sm:text-xs font-bold text-gray-500 mt-0.5">{destCode}</p>
          </div>
        </div>

        {/* Desktop Baggage Tag */}
        <div className="hidden md:flex shrink-0 items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
          <Luggage className="w-3.5 h-3.5 mr-1" />
          23 kg bag
        </div>

        {/* Right: Price & Select button */}
        <div className="flex items-center md:flex-col md:items-end justify-between md:justify-center gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-gray-100">
          <div className="text-left md:text-right">
            <p className="text-xl sm:text-2xl font-black text-[#0F172A]">
              ₦{Math.round(priceNGN).toLocaleString()}
            </p>
            <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium">per adult</p>
          </div>

          <Button
            onClick={() => onSelect(offer.id)}
            className="bg-[#FF4E00] hover:bg-[#E04500] text-white font-black rounded-xl px-6 sm:px-7 py-2 sm:py-2.5 text-xs sm:text-sm shadow-sm transition-all hover:scale-[1.02]"
          >
            Select
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
