import { motion } from "framer-motion";
import { Plane } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BookingTableProps {
  bookings: any[];
  isLoading: boolean;
}

function statusBadge(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "confirmed" || s === "complete")
    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-bold text-xs">Confirmed</Badge>;
  if (s === "pending" || s === "processing")
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200 font-bold text-xs">Pending</Badge>;
  if (s === "cancelled" || s === "failed")
    return <Badge className="bg-red-100 text-red-700 border-red-200 font-bold text-xs">Cancelled</Badge>;
  return <Badge variant="secondary" className="font-bold text-xs">{status}</Badge>;
}

function formatDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatNGN(amount: number | string) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "—";
  return `₦${num.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function BookingTable({ bookings, isLoading }: BookingTableProps) {
  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!bookings || bookings.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-12 flex flex-col items-center justify-center text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mb-4">
          <Plane className="w-8 h-8 text-primary/40" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-1">No bookings yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Flight bookings will appear here once passengers complete their checkout.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card rounded-2xl overflow-hidden"
    >
      <Table>
        <TableHeader>
          <TableRow className="bg-primary/5 hover:bg-primary/5">
            <TableHead className="font-bold text-xs uppercase tracking-wider text-primary/70">PNR</TableHead>
            <TableHead className="font-bold text-xs uppercase tracking-wider text-primary/70">Passenger</TableHead>
            <TableHead className="font-bold text-xs uppercase tracking-wider text-primary/70">Route</TableHead>
            <TableHead className="font-bold text-xs uppercase tracking-wider text-primary/70">Airline</TableHead>
            <TableHead className="font-bold text-xs uppercase tracking-wider text-primary/70 text-right">Amount (NGN)</TableHead>
            <TableHead className="font-bold text-xs uppercase tracking-wider text-primary/70">Status</TableHead>
            <TableHead className="font-bold text-xs uppercase tracking-wider text-primary/70">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.map((booking: any, i: number) => (
            <motion.tr
              key={booking.id || booking.pnr || i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="border-b border-border/30 hover:bg-white/50 transition-colors"
            >
              <TableCell className="font-mono font-bold text-sm text-primary">
                {booking.pnr || booking.booking_reference || "—"}
              </TableCell>
              <TableCell className="font-semibold text-sm">
                {booking.passenger_name || `${booking.given_name || ""} ${booking.family_name || ""}`.trim() || "—"}
              </TableCell>
              <TableCell className="text-sm font-medium text-muted-foreground">
                {booking.origin || "—"} → {booking.destination || "—"}
              </TableCell>
              <TableCell className="text-sm font-medium">
                {booking.airline || "—"}
              </TableCell>
              <TableCell className="text-sm font-bold text-right">
                {formatNGN(booking.amount_ngn || booking.total_ngn || 0)}
              </TableCell>
              <TableCell>
                {statusBadge(booking.status || "pending")}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(booking.created_at || booking.booked_at || "")}
              </TableCell>
            </motion.tr>
          ))}
        </TableBody>
      </Table>
    </motion.div>
  );
}
