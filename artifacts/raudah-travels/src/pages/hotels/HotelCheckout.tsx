import { useState, useEffect } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Check, ArrowLeft, Loader2, Building2, MapPin,
  Star, Shield, CreditCard, Landmark, Smartphone, Wallet,
} from "lucide-react";
import { useUser } from "@clerk/react";

const STEPS = ["Select hotel", "Guest details", "Payment", "Confirmation"];

function StepTracker({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition-colors ${
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                    ? "bg-[#2D3199] text-white"
                    : "bg-[#DCE3F0] text-[#94A3B8]"
                }`}
              >
                {done ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span
                className={`text-xs mt-1 font-semibold whitespace-nowrap hidden sm:block ${
                  active ? "text-[#2D3199]" : done ? "text-emerald-600" : "text-[#94A3B8]"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 w-12 sm:w-20 mx-1 rounded-full ${done ? "bg-emerald-400" : "bg-[#DCE3F0]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

const PAYMENT_METHODS = [
  { id: "card", label: "Card", icon: CreditCard },
  { id: "transfer", label: "Transfer", icon: Landmark },
  { id: "ussd", label: "USSD", icon: Smartphone },
  { id: "wallet", label: "Wallet", icon: Wallet },
];

export default function HotelCheckout() {
  const [, params] = useRoute("/hotels/checkout/:hotelId");
  const searchStr = useSearch();
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const hotelId = params?.hotelId || "";
  const qs = new URLSearchParams(searchStr);
  const nights = Number(qs.get("nights") || 7);
  const rooms = Number(qs.get("rooms") || 1);
  const roomType = qs.get("roomType") || "standard";

  const [hotel, setHotel] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState(1); // 0=select(done), 1=details, 2=payment, 3=confirm
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("card");

  const ROOM_MULTIPLIERS: Record<string, number> = { standard: 1, superior: 1.2, deluxe: 1.45, suite: 2.1 };
  const multiplier = ROOM_MULTIPLIERS[roomType] || 1;

  const [form, setForm] = useState({
    guestName: user?.fullName || "",
    email: user?.primaryEmailAddress?.emailAddress || "",
    phone: "",
    specialRequests: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/hotels/${hotelId}`);
        if (res.ok) {
          const data = await res.json();
          setHotel(data.hotel);
        }
      } finally {
        setIsLoading(false);
      }
    }
    if (hotelId) load();
  }, [hotelId]);

  useEffect(() => {
    if (user) {
      setForm((f) => ({
        ...f,
        guestName: f.guestName || user.fullName || "",
        email: f.email || user.primaryEmailAddress?.emailAddress || "",
      }));
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFF]">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-[#2D3199]" />
        </div>
      </div>
    );
  }

  if (!hotel) {
    return (
      <div className="min-h-screen bg-[#F8FAFF]">
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-[#64748B]">Hotel not found.</p>
          <Button onClick={() => setLocation("/hotels")} variant="outline">Back to hotels</Button>
        </div>
      </div>
    );
  }

  const pricePerNight = Math.round(hotel.pricePerNightNgn * multiplier);
  const serviceFee = Math.round(pricePerNight * nights * rooms * 0.02);
  const subtotal = pricePerNight * nights * rooms;
  const total = subtotal + serviceFee;

  async function handlePayment() {
    setIsProcessing(true);
    try {
      if (paymentMethod === "card") {
        // Initialize Paystack for card payment
        const initRes = await fetch("/api/flights/paystack/initialize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            offerId: hotelId,
            email: form.email,
            amountNgn: total,
          }),
        });
        const initData = await initRes.json();
        if (initData.authorization_url) {
          // Store booking intent in sessionStorage for after redirect
          sessionStorage.setItem(
            "hotel_booking_intent",
            JSON.stringify({ hotelId, nights, rooms, roomType, guestName: form.guestName, guestEmail: form.email, guestPhone: form.phone, total })
          );
          window.location.href = initData.authorization_url;
          return;
        }
      }

      // For transfer/USSD/wallet: save booking as pending
      const bookRes = await fetch("/api/hotels/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelId,
          checkIn: new Date().toISOString().split("T")[0],
          checkOut: new Date(Date.now() + nights * 86400000).toISOString().split("T")[0],
          nights,
          rooms,
          guestName: form.guestName,
          guestEmail: form.email,
          guestPhone: form.phone,
          paystackStatus: "pending",
        }),
      });

      if (bookRes.ok) {
        const { booking } = await bookRes.json();
        setLocation(`/hotels/confirmation/${booking.id}`);
      }
    } catch (err) {
      console.error("Hotel payment error:", err);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFF]">
      <Navbar />
      <main className="pt-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button
            onClick={() => setLocation(`/hotels/${hotelId}`)}
            className="flex items-center gap-2 text-sm text-[#64748B] hover:text-[#2D3199] mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to hotel
          </button>

          <StepTracker current={step} />

          <div className="grid lg:grid-cols-5 gap-8">
            {/* Form */}
            <div className="lg:col-span-3 space-y-6">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="bg-white rounded-2xl border border-[#DCE3F0] p-6">
                  <h2 className="font-black text-[#0F172A] text-lg mb-5">Guest details</h2>
                  <p className="text-xs text-[#64748B] mb-4">Names must match your passport</p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-[#334155] uppercase tracking-wide mb-1.5">Full name</label>
                      <input
                        value={form.guestName}
                        onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
                        className="w-full border border-[#DCE3F0] rounded-xl px-4 py-3 text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2D3199]/20 focus:border-[#2D3199]"
                        placeholder="Aisha Bello"
                      />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-[#334155] uppercase tracking-wide mb-1.5">Email</label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                          className="w-full border border-[#DCE3F0] rounded-xl px-4 py-3 text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2D3199]/20 focus:border-[#2D3199]"
                          placeholder="aisha@email.com"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#334155] uppercase tracking-wide mb-1.5">Phone (WhatsApp)</label>
                        <input
                          value={form.phone}
                          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                          className="w-full border border-[#DCE3F0] rounded-xl px-4 py-3 text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2D3199]/20 focus:border-[#2D3199]"
                          placeholder="+234 803 000 0000"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#334155] uppercase tracking-wide mb-1.5">Special requests (optional)</label>
                      <textarea
                        value={form.specialRequests}
                        onChange={(e) => setForm((f) => ({ ...f, specialRequests: e.target.value }))}
                        rows={3}
                        className="w-full border border-[#DCE3F0] rounded-xl px-4 py-3 text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2D3199]/20 focus:border-[#2D3199] resize-none"
                        placeholder="e.g. high floor, early check-in…"
                      />
                    </div>
                  </div>
                </div>

                {/* Payment method */}
                <div className="bg-white rounded-2xl border border-[#DCE3F0] p-6 mt-4">
                  <h2 className="font-black text-[#0F172A] text-lg mb-4">Payment method</h2>
                  <div className="flex gap-2 flex-wrap">
                    {PAYMENT_METHODS.map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        onClick={() => setPaymentMethod(id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                          paymentMethod === id
                            ? "border-[#2D3199] bg-[#EEF0FF] text-[#2D3199]"
                            : "border-[#DCE3F0] text-[#64748B] hover:border-[#2D3199]/40"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                      </button>
                    ))}
                  </div>

                  {paymentMethod === "transfer" && (
                    <div className="mt-4 p-4 bg-[#F8FAFF] rounded-xl border border-[#DCE3F0] text-sm text-[#334155] space-y-1">
                      <p className="font-bold text-[#0F172A]">Bank transfer instructions</p>
                      <p>Transfer <strong>₦{total.toLocaleString()}</strong> to the account shown in your booking confirmation, then send proof to our team via WhatsApp.</p>
                    </div>
                  )}
                  {paymentMethod === "ussd" && (
                    <div className="mt-4 p-4 bg-[#F8FAFF] rounded-xl border border-[#DCE3F0] text-sm text-[#334155]">
                      <p className="font-bold text-[#0F172A]">USSD payment</p>
                      <p>Dial <strong>*737*50*{total}#</strong> from your registered mobile number to pay.</p>
                    </div>
                  )}
                  {paymentMethod === "wallet" && (
                    <div className="mt-4 p-4 bg-[#F8FAFF] rounded-xl border border-[#DCE3F0] text-sm text-[#334155]">
                      <p className="font-bold text-[#0F172A]">Wallet payment</p>
                      <p>Your wallet balance will be debited on confirmation.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Price summary */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-[#DCE3F0] p-6 sticky top-24 shadow-sm space-y-4">
                {/* Hotel summary */}
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#EEF0FF] flex items-center justify-center shrink-0">
                    <Building2 className="w-6 h-6 text-[#2D3199]" />
                  </div>
                  <div>
                    <p className="font-bold text-[#0F172A] text-sm">{hotel.name}</p>
                    <p className="text-xs text-[#64748B]">{hotel.distanceLabel}</p>
                    <div className="flex gap-0.5 mt-0.5">
                      {Array.from({ length: hotel.stars }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#DCE3F0] pt-4 space-y-2 text-sm">
                  <div className="flex justify-between text-[#64748B]">
                    <span>Room ({roomType})</span>
                    <span>₦{pricePerNight.toLocaleString()}/night</span>
                  </div>
                  <div className="flex justify-between text-[#64748B]">
                    <span>{nights} nights × {rooms} room{rooms > 1 ? "s" : ""}</span>
                    <span>₦{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[#64748B]">
                    <span>Service fee</span>
                    <span>₦{serviceFee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-black text-[#0F172A] text-base border-t border-[#DCE3F0] pt-2">
                    <span>Total</span>
                    <span>₦{total.toLocaleString()}</span>
                  </div>
                  {hotel.freeCancellation && (
                    <p className="text-emerald-700 text-xs font-semibold flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Free cancellation included
                    </p>
                  )}
                </div>

                <Button
                  onClick={handlePayment}
                  disabled={isProcessing || !form.guestName || !form.email}
                  className="w-full bg-[#FF3B00] hover:bg-[#E03400] text-white font-bold rounded-xl py-3 disabled:opacity-60"
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Processing…
                    </span>
                  ) : (
                    "Continue to payment"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
