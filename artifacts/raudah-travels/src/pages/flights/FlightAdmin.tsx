import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Plane,
  RefreshCw,
  BarChart3,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import BookingTable from "@/components/flights/BookingTable";

interface Stats {
  total: number;
  confirmed: number;
  pending: number;
  cancelled: number;
}

export default function FlightAdmin() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/flights/admin/bookings");
      if (!res.ok) throw new Error(`Failed to load bookings (${res.status})`);
      const data = await res.json();
      setBookings(data.bookings || data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const stats: Stats = bookings.reduce(
    (acc, b) => {
      acc.total++;
      const s = (b.status || "").toLowerCase();
      if (s === "confirmed" || s === "complete") acc.confirmed++;
      else if (s === "cancelled" || s === "failed") acc.cancelled++;
      else acc.pending++;
      return acc;
    },
    { total: 0, confirmed: 0, pending: 0, cancelled: 0 } as Stats
  );

  const statCards = [
    { label: "Total Bookings", value: stats.total, icon: BarChart3, color: "text-primary", bg: "bg-primary/10" },
    { label: "Confirmed", value: stats.confirmed, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100" },
    { label: "Pending", value: stats.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-100" },
    { label: "Cancelled", value: stats.cancelled, icon: XCircle, color: "text-red-600", bg: "bg-red-100" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h1 className="text-2xl font-black tracking-tight">Flight Bookings</h1>
          <p className="text-sm text-muted-foreground font-medium mt-0.5">
            Manage and monitor all flight reservations
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Button
            onClick={fetchBookings}
            variant="outline"
            disabled={isLoading}
            className="rounded-xl font-semibold"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh
          </Button>
        </motion.div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            className="glass-card rounded-2xl p-4"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-black tracking-tight">{stat.value}</p>
                <p className="text-xs font-semibold text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card rounded-xl p-4 border-destructive/30 bg-destructive/5"
        >
          <p className="text-sm font-medium text-destructive">{error}</p>
        </motion.div>
      )}

      {/* Table */}
      <BookingTable bookings={bookings} isLoading={isLoading} />
    </div>
  );
}
