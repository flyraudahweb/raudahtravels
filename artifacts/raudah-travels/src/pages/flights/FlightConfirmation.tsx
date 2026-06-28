import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle2, Plane, Search, LayoutDashboard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
export default function FlightConfirmation() {
  const [, params] = useRoute("/flights/confirmation/:bookingId");
  const [, setLocation] = useLocation();
  const bookingId = params?.bookingId || "";

  const [booking, setBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadBooking() {
      if (!bookingId || bookingId === "success") {
        setIsLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/flights/bookings/${bookingId}`);
        if (res.ok) {
          const data = await res.json();
          setBooking(data.booking || data.data || data);
        }
      } catch {
        // Failed to load details, show generic success
      } finally {
        setIsLoading(false);
      }
    }
    loadBooking();
  }, [bookingId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: "spring", bounce: 0.3 }}
        className="glass-card rounded-3xl p-8 sm:p-10 text-center"
      >
        {/* Success Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", bounce: 0.5, duration: 0.8 }}
          className="relative mx-auto mb-6 w-20 h-20"
        >
          {/* Pulse rings */}
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-full bg-emerald-400/20"
          />
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
            className="absolute inset-0 rounded-full bg-emerald-400/15"
          />
          <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg">
            <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={2.5} />
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-2xl font-black tracking-tight mb-2 text-foreground"
        >
          Booking Confirmed! 🎉
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-sm text-muted-foreground font-medium"
        >
          Your flight has been booked successfully. Check your email for the confirmation details.
        </motion.p>

        {/* Booking Details */}
        {(booking || bookingId !== "success") && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-6 bg-primary/5 rounded-2xl p-5 text-left space-y-3"
          >
            {(booking?.pnr || booking?.booking_reference) && (
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">PNR</span>
                <span className="font-mono font-black text-lg text-primary tracking-widest">
                  {booking.pnr || booking.booking_reference}
                </span>
              </div>
            )}

            {bookingId && bookingId !== "success" && !booking?.pnr && (
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Booking ID</span>
                <span className="font-mono font-bold text-sm text-primary">
                  {bookingId.slice(0, 12)}...
                </span>
              </div>
            )}

            {booking?.passenger_name && (
              <>
                <Separator className="bg-border/30" />
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Passenger</span>
                  <span className="font-bold text-sm">{booking.passenger_name}</span>
                </div>
              </>
            )}

            {(booking?.origin || booking?.destination) && (
              <>
                <Separator className="bg-border/30" />
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Route</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{booking.origin}</span>
                    <Plane className="w-3.5 h-3.5 text-primary" />
                    <span className="font-bold text-sm">{booking.destination}</span>
                  </div>
                </div>
              </>
            )}

            {booking?.airline && (
              <>
                <Separator className="bg-border/30" />
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Airline</span>
                  <span className="font-bold text-sm">{booking.airline}</span>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 flex flex-col sm:flex-row gap-3"
        >
          <Button
            onClick={() => setLocation("/flights")}
            className="flex-1 h-11 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-brand border-0"
          >
            <Search className="w-4 h-4 mr-2" />
            Search More Flights
          </Button>
          <Button
            onClick={() => setLocation("/flights/admin")}
            variant="outline"
            className="flex-1 h-11 rounded-xl font-bold"
          >
            <LayoutDashboard className="w-4 h-4 mr-2" />
            View All Bookings
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
