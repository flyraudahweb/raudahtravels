import { useState, useMemo } from "react";
import { useListBookings, getListBookingsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { BookOpen, CalendarDays, Users, Plus, CreditCard, Search, CheckCircle2, Clock, XCircle, Award, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string; icon: typeof CheckCircle2 }> = {
  pending:   { label: "Pending",   bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-400",   icon: Clock },
  confirmed: { label: "Confirmed", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-400", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200",     dot: "bg-red-400",     icon: XCircle },
  completed: { label: "Completed", bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    dot: "bg-blue-400",    icon: Award },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-bold border capitalize ${c.bg} ${c.text} ${c.border}`}>
      <Icon className="w-3 h-3" /> {c.label}
    </span>
  );
}

export default function DashboardBookings() {
  const { data, isLoading } = useListBookings({}, { query: { queryKey: getListBookingsQueryKey({}) } });
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const allBookings = data?.bookings || [];

  const bookings = useMemo(() => {
    let list = allBookings;
    if (statusFilter !== "all") list = list.filter(b => b.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b =>
        b.package?.name?.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allBookings, statusFilter, search]);

  const counts = useMemo(() => Object.keys(STATUS_CONFIG).reduce((acc, k) => {
    acc[k] = allBookings.filter(b => b.status === k).length;
    return acc;
  }, {} as Record<string, number>), [allBookings]);

  return (
    <div className="space-y-6" data-testid="page-dashboard-bookings">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[#2D3199] text-xs font-bold uppercase tracking-widest mb-1">Pilgrim Portal</p>
          <h1 className="text-2xl font-black text-[#0F172A]">My Bookings</h1>
          <p className="text-[#64748B] text-sm mt-0.5">Track all your pilgrimage bookings</p>
        </div>
        <Link href="/packages">
          <button className="flex items-center gap-2 bg-[#FF3B00] hover:bg-[#D63200] text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> New Booking
          </button>
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, c]) => {
          const Icon = c.icon;
          return (
            <button key={key} onClick={() => setStatusFilter(key === statusFilter ? "all" : key)}
              className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${statusFilter === key ? `${c.bg} ${c.border}` : "bg-white border-[#DCE3F0] hover:border-[#2D3199]/20"}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${statusFilter === key ? c.bg : "bg-[#F8FAFC]"}`}>
                <Icon className={`w-4 h-4 ${statusFilter === key ? c.text : "text-[#94A3B8]"}`} />
              </div>
              <div>
                <p className={`text-lg font-black ${statusFilter === key ? c.text : "text-[#0F172A]"}`}>{counts[key] ?? 0}</p>
                <p className={`text-[10px] font-bold capitalize ${statusFilter === key ? c.text : "text-[#94A3B8]"}`}>{c.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search + filter row */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by package name…"
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-[#DCE3F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#2D3199]/20 focus:border-[#2D3199]"
          />
        </div>
        <div className="flex gap-1.5 bg-white rounded-xl border border-[#DCE3F0] p-1">
          {["all", "pending", "confirmed", "cancelled", "completed"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize whitespace-nowrap ${statusFilter === s ? "bg-[#2D3199] text-white shadow-sm" : "text-[#64748B] hover:text-[#2D3199]"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
      ) : allBookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#DCE3F0] p-12 text-center">
          <div className="w-14 h-14 bg-[#EEF0FF] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-7 h-7 text-[#2D3199]" />
          </div>
          <h3 className="font-black text-[#0F172A] text-lg mb-1">No bookings yet</h3>
          <p className="text-[#64748B] text-sm mb-6">Start your spiritual journey by exploring our packages</p>
          <Link href="/packages">
            <button className="bg-[#2D3199] hover:bg-[#1C1F66] text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors">
              Browse Packages
            </button>
          </Link>
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#DCE3F0] p-10 text-center">
          <Search className="w-8 h-8 text-[#94A3B8] mx-auto mb-3" />
          <p className="font-bold text-[#0F172A]">No bookings match your filters</p>
          <p className="text-sm text-[#64748B] mt-1">Try changing the status filter or search term</p>
          <button onClick={() => { setStatusFilter("all"); setSearch(""); }}
            className="mt-4 text-[#2D3199] text-sm font-bold hover:underline">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map(booking => {
            const balance = booking.totalPrice - booking.amountPaid;
            const pct = booking.totalPrice > 0 ? Math.round((booking.amountPaid / booking.totalPrice) * 100) : 0;
            return (
              <div key={booking.id} className="bg-white rounded-2xl border border-[#DCE3F0] hover:shadow-md hover:border-[#2D3199]/20 transition-all"
                data-testid={`card-booking-${booking.id}`}>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                        <h3 className="font-black text-[#0F172A] text-base truncate">
                          {booking.package?.name || "Pilgrimage Package"}
                        </h3>
                        <StatusBadge status={booking.status} />
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-[#64748B]">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5" />
                          {booking.package?.departureDate
                            ? new Date(booking.package.departureDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                            : "TBC"}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          {booking.pilgrimCount} pilgrim{booking.pilgrimCount !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-black text-[#2D3199]">₦{booking.totalPrice.toLocaleString()}</div>
                      <div className="text-xs text-[#64748B] mt-0.5">₦{booking.amountPaid.toLocaleString()} paid</div>
                      {balance > 0 && (
                        <div className="text-xs font-bold text-[#FF3B00] mt-0.5">₦{balance.toLocaleString()} due</div>
                      )}
                    </div>
                  </div>

                  {/* Payment progress */}
                  {booking.totalPrice > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Payment Progress</span>
                        <span className="text-[10px] font-black text-[#2D3199]">{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#2D3199] to-[#4C56B8] rounded-full transition-all"
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}

                  {booking.notes && (
                    <p className="mt-3 text-xs text-[#64748B] border-t border-[#F1F5F9] pt-3 line-clamp-2">{booking.notes}</p>
                  )}
                </div>

                {/* Action footer */}
                {booking.status === "pending" && balance > 0 && (
                  <div className="px-5 pb-4">
                    <Link href={`/dashboard/bookings/${booking.id}/pay`}>
                      <button className="flex items-center justify-center gap-2 w-full bg-[#FF3B00] hover:bg-[#D63200] text-white py-2.5 rounded-xl font-bold text-sm transition-colors">
                        <CreditCard className="w-4 h-4" /> Complete Payment — ₦{balance.toLocaleString()}
                      </button>
                    </Link>
                  </div>
                )}
                {(booking.status === "confirmed" || booking.status === "completed") && (
                  <div className="px-5 pb-4 flex justify-end">
                    <Link href={`/dashboard/bookings/${booking.id}`}>
                      <button className="flex items-center gap-1 text-[#2D3199] text-xs font-bold hover:underline">
                        View Details <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
