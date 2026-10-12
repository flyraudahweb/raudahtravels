import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { CheckCircle2, Building2, Loader2, LayoutDashboard, Search } from "lucide-react";

export default function HotelConfirmation() {
  const [, params] = useRoute("/hotels/confirmation/:id");
  const [, setLocation] = useLocation();
  const bookingId = params?.id || "";

  const [booking, setBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!bookingId) { setIsLoading(false); return; }
      try {
        // We don't have a dedicated get-one endpoint but admin endpoint exists
        // Just show success with whatever was stored
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [bookingId]);

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

  return (
    <div className="min-h-screen bg-[#F8FAFF]">
      <Navbar />
      <main className="pt-20">
        <div className="max-w-xl mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
            className="bg-white rounded-3xl border border-[#DCE3F0] p-10 text-center shadow-sm"
          >
            {/* Success icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
              className="relative mx-auto mb-6 w-20 h-20"
            >
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-emerald-400/30"
              />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <h1 className="text-2xl font-black text-[#0F172A] mb-2">Hotel booked!</h1>
              <p className="text-[#64748B] mb-1 text-sm">
                Your hotel booking has been confirmed. A confirmation email has been sent to your inbox.
              </p>
              {bookingId && (
                <p className="text-xs text-[#94A3B8] mt-2 font-mono">
                  Booking ref: {bookingId.slice(0, 8).toUpperCase()}
                </p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-8 flex items-center justify-center gap-2 p-4 bg-[#F8FAFF] rounded-2xl border border-[#DCE3F0]"
            >
              <Building2 className="w-5 h-5 text-[#2D3199] shrink-0" />
              <p className="text-sm text-[#334155] font-medium">
                Your hotel voucher will be sent to your email within 24 hours.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-3 mt-8"
            >
              <Button
                onClick={() => setLocation("/dashboard/my-trips")}
                className="flex-1 bg-[#2D3199] hover:bg-[#25297F] text-white font-bold rounded-xl"
              >
                <LayoutDashboard className="w-4 h-4 mr-2" />
                My trips
              </Button>
              <Button
                onClick={() => setLocation("/hotels/search")}
                variant="outline"
                className="flex-1 border-[#DCE3F0] rounded-xl"
              >
                <Search className="w-4 h-4 mr-2" />
                Search more hotels
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
