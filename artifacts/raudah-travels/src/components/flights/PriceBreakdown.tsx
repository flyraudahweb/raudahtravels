import { motion } from "framer-motion";
import { Plane, ArrowRight, RefreshCw, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface PriceBreakdownProps {
  offer: any;
  exchangeRate: number;
  onPay: () => void;
  isLoading: boolean;
}

export default function PriceBreakdown({ offer, exchangeRate, onPay, isLoading }: PriceBreakdownProps) {
  if (!offer) return null;

  const slice = offer.slices?.[0];
  const segment = slice?.segments?.[0];
  const airline = offer.owner?.name || segment?.marketing_carrier?.name || "Airline";
  const originCode = slice?.origin?.iata_code || segment?.origin?.iata_code || "---";
  const destCode = slice?.destination?.iata_code || segment?.destination?.iata_code || "---";
  const originName = slice?.origin?.name || segment?.origin?.name || "";
  const destName = slice?.destination?.name || segment?.destination?.name || "";
  const priceGBP = parseFloat(offer.total_amount || "0");
  const priceCurrency = offer.total_currency || "GBP";
  const priceNGN = priceCurrency === "GBP" ? priceGBP * exchangeRate : priceGBP;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="glass-card rounded-2xl p-6 sticky top-24"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h3 className="text-lg font-black tracking-tight">Price Summary</h3>
          <p className="text-xs text-muted-foreground font-medium">Fare breakdown</p>
        </div>
      </div>

      {/* Route */}
      <div className="flex flex-col gap-2 py-4 bg-primary/5 rounded-xl mb-4 px-4">
        <div className="flex items-center justify-center gap-3">
          <span className="text-xl font-black text-primary">{originCode}</span>
          <div className="flex items-center gap-1 text-primary/50">
            <div className="w-6 h-[2px] bg-primary/30 rounded-full" />
            <Plane className="w-4 h-4 text-primary" />
            <div className="w-6 h-[2px] bg-primary/30 rounded-full" />
          </div>
          <span className="text-xl font-black text-primary">{destCode}</span>
        </div>
        <div className="flex items-center justify-between text-xs font-semibold text-primary/70 text-center">
          <span className="flex-1 truncate pr-2">{originName}</span>
          <span className="flex-1 truncate pl-2">{destName}</span>
        </div>
      </div>

      {/* Airline */}
      <div className="flex justify-between items-center py-2">
        <span className="text-sm text-muted-foreground font-medium">Airline</span>
        <span className="text-sm font-bold">{airline}</span>
      </div>

      <Separator className="my-2 bg-border/40" />

      {/* Base Price */}
      <div className="flex justify-between items-center py-2">
        <span className="text-sm text-muted-foreground font-medium">Base fare</span>
        <span className="text-sm font-bold">
          {new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(priceGBP)}
        </span>
      </div>

      {/* Exchange Rate */}
      <div className="flex justify-between items-center py-2">
        <span className="text-sm text-muted-foreground font-medium flex items-center gap-1">
          <RefreshCw className="w-3 h-3" />
          Exchange rate
        </span>
        <span className="text-xs font-semibold text-primary bg-primary/5 px-2 py-1 rounded-md">
          1 GBP = ₦{exchangeRate.toLocaleString()}
        </span>
      </div>

      <Separator className="my-3 bg-border/40" />

      {/* Total NGN */}
      <div className="flex justify-between items-center py-3">
        <span className="text-base font-bold text-foreground">Total (NGN)</span>
        <motion.span
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", bounce: 0.4 }}
          className="text-2xl font-black text-accent tracking-tight"
        >
          ₦{priceNGN.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </motion.span>
      </div>

      {/* Pay Button */}
      <Button
        onClick={onPay}
        disabled={isLoading}
        className="w-full h-12 mt-4 bg-accent hover:bg-accent/90 text-white font-bold text-base rounded-xl shadow-cta hover:shadow-[0_6px_20px_rgba(255,59,0,0.4)] transition-all duration-300 border-0"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="w-5 h-5 mr-2" />
            Pay Now
          </>
        )}
      </Button>

      <p className="text-[11px] text-muted-foreground text-center mt-3">
        Secured by Paystack · 256-bit encryption
      </p>
    </motion.div>
  );
}
