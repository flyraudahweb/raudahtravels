import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BookOpen, CalendarDays, Users, UserPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

interface AgentClient {
  id: string; reference: string; status: string; fullName: string;
  passportNumber?: string; phone?: string;
  totalPrice: number; amountPaid: number;
  packageId?: string; packageName?: string; packageType?: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; pill: string; dot: string }> = {
  pending:   { label: "Pending",   pill: "bg-amber-100 text-amber-700 border border-amber-200",  dot: "bg-amber-400" },
  confirmed: { label: "Confirmed", pill: "bg-emerald-100 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" },
  cancelled: { label: "Cancelled", pill: "bg-red-100 text-red-700 border border-red-200",        dot: "bg-red-400" },
  completed: { label: "Completed", pill: "bg-blue-100 text-blue-700 border border-blue-200",      dot: "bg-blue-500" },
};

const FILTERS = ["all", "pending", "confirmed", "cancelled", "completed"] as const;

export default function AgentBookings() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading } = useQuery<{ clients: AgentClient[]; total: number }>({
    queryKey: ["agent-clients-bookings", statusFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(pageSize), offset: String((page - 1) * pageSize) });
      if (statusFilter !== "all") params.set("status", statusFilter);
      return fetch(`/api/agent/clients?${params}`, { credentials: "include" }).then(r => r.json());
    },
    staleTime: 15000,
  });

  const bookings = data?.clients || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6" data-testid="page-agent-bookings">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2D3199]/60 mb-1">AGENT PORTAL</p>
          <h1 className="text-3xl font-black text-[#1C1F66] tracking-tight">Client Bookings</h1>
          <p className="text-[#64748B] text-sm mt-1">All bookings made through your agency</p>
        </div>
        <Button asChild className="bg-[#FF3B00] hover:bg-[#D63200] text-white rounded-xl font-black gap-2 h-11">
          <Link href="/agent/clients"><UserPlus className="w-4 h-4" /> Register Client</Link>
        </Button>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-black capitalize transition-all ${
              statusFilter === f
                ? "bg-[#2D3199] text-white shadow-md"
                : "bg-white text-[#64748B] border border-[#E2E8F0] hover:border-[#2D3199]/40 hover:text-[#2D3199]"
            }`}
          >
            {f === "all" ? "All Statuses" : f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center mb-4">
            <BookOpen className="w-7 h-7 text-[#CBD5E1]" />
          </div>
          <h3 className="font-black text-[#1C1F66] text-lg mb-1">No bookings found</h3>
          <p className="text-[#94A3B8] text-sm mb-6">Register clients from the Packages tab or the Clients page</p>
          <Button asChild className="bg-[#FF3B00] hover:bg-[#D63200] rounded-xl gap-2 text-white font-black">
            <Link href="/agent/clients"><UserPlus className="w-4 h-4" /> Register Client</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const cfg = STATUS_CONFIG[b.status] || STATUS_CONFIG.pending;
            const paidPct = b.totalPrice > 0 ? Math.min(100, Math.round((b.amountPaid / b.totalPrice) * 100)) : 0;
            return (
              <div key={b.id} data-testid={`card-booking-${b.id}`}
                className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm hover:shadow-md hover:border-[#2D3199]/20 transition-all p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#2D3199] to-[#4C56B8] flex items-center justify-center shrink-0">
                      <span className="text-base font-black text-white">{b.fullName.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-black text-[#1C1F66] truncate">{b.fullName}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black capitalize ${cfg.pill}`}>{cfg.label}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[#94A3B8] flex-wrap">
                        {b.packageName && (
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5" /> {b.packageName}
                          </span>
                        )}
                        {b.passportNumber && (
                          <span className="font-mono">{b.passportNumber}</span>
                        )}
                        {b.phone && (
                          <span>{b.phone}</span>
                        )}
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide">Payment</p>
                          <p className="text-[10px] font-black text-[#2D3199]">{paidPct}%</p>
                        </div>
                        <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${paidPct === 100 ? "bg-emerald-500" : "bg-[#2D3199]"}`}
                            style={{ width: `${paidPct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[10px] text-[#94A3B8]">Paid: ₦{b.amountPaid.toLocaleString()}</p>
                          <p className="text-[10px] text-[#94A3B8]">Total: ₦{b.totalPrice.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-black text-[#1C1F66] text-lg">₦{b.totalPrice.toLocaleString()}</p>
                    <p className="text-xs text-[#94A3B8] font-mono mt-0.5">{b.reference}</p>
                    <p className="text-[10px] text-[#CBD5E1] mt-0.5">
                      {new Date(b.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 px-5 py-4 bg-white rounded-2xl border border-[#E2E8F0]">
              <p className="text-xs text-[#64748B] font-semibold">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="rounded-lg border-[#E2E8F0] text-[#64748B] h-8">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="rounded-lg border-[#E2E8F0] text-[#64748B] h-8">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
