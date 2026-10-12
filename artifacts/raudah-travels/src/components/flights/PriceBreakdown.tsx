import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ShieldCheck, CreditCard, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PriceBreakdownProps {
  offer: any;
  exchangeRate: number;
  onPay: () => void;
  isLoading: boolean;
}

export default function PriceBreakdown({ offer, exchangeRate, onPay, isLoading }: PriceBreakdownProps) {
  const [selectedPayMethod, setSelectedPayMethod] = useState<"card" | "transfer" | "ussd" | "wallet">("card");

  const slice = offer?.slices?.[0];
  const segment = slice?.segments?.[0];
  const airline = offer?.owner?.name || segment?.marketing_carrier?.name || "EgyptAir";
  const originCode = slice?.origin?.iata_code || segment?.origin?.iata_code || "ABV";
  const destCode = slice?.destination?.iata_code || segment?.destination?.iata_code || "JED";

  // Real or mockup calculations matching PDF Page 3
  const priceGBP = parseFloat(offer?.total_amount || "0");
  const rawTotalNGN = offer?.total_currency === "GBP" ? priceGBP * exchangeRate : (priceGBP || 2369000);
  const totalNGN = rawTotalNGN > 0 ? Math.round(rawTotalNGN) : 2369000;

  // Breakdown proportions matching Page 3: base fare ~73.5%, taxes ~25.2%, service fee ~1.3%
  const baseFare = Math.round(totalNGN * 0.735);
  const taxesAndFees = Math.round(totalNGN * 0.252);
  const serviceFee = totalNGN - baseFare - taxesAndFees;

  const paymentMethods: { id: "card" | "transfer" | "ussd" | "wallet"; label: string }[] = [
    { id: "card", label: "Card" },
    { id: "transfer", label: "Transfer" },
    { id: "ussd", label: "USSD" },
    { id: "wallet", label: "Wallet" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm sticky top-24 space-y-5"
    >
      {/* Title */}
      <h3 className="text-base font-black text-[#0F172A]">
        Trip summary
      </h3>

      {/* Route & Dates */}
      <div className="pb-4 border-b border-gray-100">
        <p className="font-bold text-sm text-[#0F172A]">
          {originCode} ⇄ {destCode} · {airline}
        </p>
        <p className="text-xs text-gray-500 font-medium mt-0.5">
          12 Jan – 26 Jan 2027 · 2 adults
        </p>
      </div>

      {/* Line Item Prices */}
      <div className="space-y-2.5 text-xs sm:text-sm font-medium text-gray-600">
        <div className="flex justify-between">
          <span>Base fare (2)</span>
          <span className="font-bold text-gray-900">₦{baseFare.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>Taxes and fees</span>
          <span className="font-bold text-gray-900">₦{taxesAndFees.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>Service fee</span>
          <span className="font-bold text-gray-900">₦{serviceFee.toLocaleString()}</span>
        </div>
      </div>

      {/* Total */}
      <div className="pt-3 border-t border-gray-200 flex items-baseline justify-between">
        <span className="text-base font-bold text-[#0F172A]">Total</span>
        <span className="text-2xl font-black text-[#0F172A]">
          ₦{totalNGN.toLocaleString()}
        </span>
      </div>

      {/* Confirmation Badge */}
      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
        Price confirmed with airline
      </div>

      {/* Payment Method Tabs (Card | Transfer | USSD | Wallet) */}
      <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#F8FAFC] rounded-xl border border-gray-200">
        {paymentMethods.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setSelectedPayMethod(m.id)}
            className={`py-2 text-xs font-bold rounded-lg transition-all text-center ${
              selectedPayMethod === m.id
                ? "bg-white text-[#FF4E00] shadow-sm border border-gray-200"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* CTA Button */}
      <Button
        onClick={onPay}
        disabled={isLoading}
        className="w-full bg-[#FF4E00] hover:bg-[#E04500] text-white font-black rounded-xl py-3.5 text-sm shadow-md transition-all hover:scale-[1.01]"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Connecting to Paystack…
          </>
        ) : (
          "Continue to payment"
        )}
      </Button>
    </motion.div>
  );
}
