import { useState, useMemo, useEffect } from "react";
import { useListBookings, getListBookingsQueryKey, useUpdateBooking } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen, CalendarDays, Users, Edit2, CheckCircle2, Clock, XCircle,
  Award, Search, ChevronDown, ChevronUp, CreditCard, SlidersHorizontal,
  ChevronLeft, ChevronRight, Plus,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string; icon: typeof CheckCircle2 }> = {
  pending:   { label: "Pending",   bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-400",   icon: Clock },
  confirmed: { label: "Confirmed", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-400", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200",     dot: "bg-red-400",     icon: XCircle },
  completed: { label: "Completed", bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    dot: "bg-blue-400",    icon: Award },
};

const PAGE_SIZE = 100;

type SortKey = "newest" | "oldest" | "amount_high" | "amount_low" | "name_az";

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-bold border capitalize ${c.bg} ${c.text} ${c.border}`}>
      <Icon className="w-3 h-3" /> {c.label}
    </span>
  );
}

function PayProgress({ paid, total }: { paid: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Payment</span>
        <span className="text-[10px] font-black text-[#2D3199]">{pct}%</span>
      </div>
      <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden w-24">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: pct === 100 ? "#059669" : "#2D3199" }} />
      </div>
    </div>
  );
}

export default function AdminBookings() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<"pending" | "confirmed" | "cancelled" | "completed">("confirmed");
  const [editNotes, setEditNotes] = useState("");

  // Record Payment dialog state
  const [recordPayBookingId, setRecordPayBookingId] = useState<string | null>(null);
  const [recordPayAmount, setRecordPayAmount] = useState("");
  const [recordPayMethod, setRecordPayMethod] = useState("cash");
  const [recordPayRef, setRecordPayRef] = useState("");
  const [recordPayNotes, setRecordPayNotes] = useState("");
  const [recordPayVerify, setRecordPayVerify] = useState(true);
  const [recordPayLoading, setRecordPayLoading] = useState(false);

  // Fetch all bookings with a large limit so admin sees everything
  const { data, isLoading } = useListBookings(
    { limit: 500 } as Record<string, unknown>,
    { query: { queryKey: getListBookingsQueryKey({ limit: 500 }) } },
  );
  const updateBooking = useUpdateBooking();
  const allBookings = data?.bookings || [];
  const serverStatusCounts = (data as any)?.statusCounts;

  const counts = useMemo(() => {
    if (serverStatusCounts) return serverStatusCounts as Record<string, number>;
    return Object.keys(STATUS_CONFIG).reduce((acc, k) => {
      acc[k] = allBookings.filter(b => b.status === k).length;
      return acc;
    }, {} as Record<string, number>);
  }, [allBookings, serverStatusCounts]);

  const filtered = useMemo(() => {
    let list = allBookings;
    if (statusFilter !== "all") list = list.filter(b => b.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b =>
        b.user?.fullName?.toLowerCase().includes(q) ||
        b.package?.name?.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q)
      );
    }
    switch (sortKey) {
      case "oldest": return [...list].sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
      case "amount_high": return [...list].sort((a, b) => b.totalPrice - a.totalPrice);
      case "amount_low": return [...list].sort((a, b) => a.totalPrice - b.totalPrice);
      case "name_az": return [...list].sort((a, b) => (a.user?.fullName ?? "").localeCompare(b.user?.fullName ?? ""));
      default: return [...list].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    }
  }, [allBookings, statusFilter, search, sortKey]);

  // Reset to page 1 whenever filters change
  useEffect(() => { setCurrentPage(1); }, [statusFilter, search, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedBookings = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleUpdate = () => {
    if (!editingId) return;
    updateBooking.mutate({ id: editingId, data: { status: editStatus, notes: editNotes } }, {
      onSuccess: () => {
        toast({ title: "Booking updated" });
        qc.invalidateQueries({ queryKey: getListBookingsQueryKey({ limit: 500 }) });
        setEditingId(null);
      },
      onError: () => toast({ title: "Update failed", variant: "destructive" }),
    });
  };

  const openEdit = (b: typeof allBookings[0]) => {
    setEditingId(b.id);
    setEditStatus(b.status as typeof editStatus);
    setEditNotes(b.notes || "");
  };

  const openRecordPay = (b: typeof allBookings[0]) => {
    const bal = b.totalPrice - b.amountPaid;
    setRecordPayBookingId(b.id);
    setRecordPayAmount(bal.toString());
    setRecordPayMethod("cash");
    setRecordPayRef("");
    setRecordPayNotes("");
    setRecordPayVerify(true);
  };

  const handleRecordPay = async () => {
    if (!recordPayBookingId) return;
    setRecordPayLoading(true);
    try {
      const res = await fetch("/api/payments/admin-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          bookingId: recordPayBookingId,
          amount: parseFloat(recordPayAmount),
          method: recordPayMethod,
          reference: recordPayRef || undefined,
          notes: recordPayNotes || undefined,
          markVerified: recordPayVerify,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to record payment" }));
        throw new Error(err.message || "Failed to record payment");
      }
      toast({ title: "Payment recorded successfully" });
      qc.invalidateQueries({ queryKey: getListBookingsQueryKey({ limit: 500 }) });
      setRecordPayBookingId(null);
    } catch (e: any) {
      toast({ title: e.message || "Failed to record payment", variant: "destructive" });
    } finally {
      setRecordPayLoading(false);
    }
  };

  // Generate page numbers to show (up to 7 slots with ellipsis)
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "…")[] = [];
    if (currentPage <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push("…");
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 3) {
      pages.push(1);
      pages.push("…");
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push("…");
      for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
      pages.push("…");
      pages.push(totalPages);
    }
    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-5" data-testid="page-admin-bookings">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-[#2D3199] text-xs font-bold uppercase tracking-widest mb-1">Management</p>
          <h1 className="text-2xl font-black text-[#0F172A]">Bookings</h1>
          <p className="text-[#64748B] text-sm mt-0.5">View and manage all pilgrim bookings</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <span className="font-bold text-[#0F172A]">{allBookings.length}</span> total
          {statusFilter !== "all" && <> · <span className="font-bold text-[#2D3199]">{filtered.length}</span> shown</>}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, c]) => {
          const Icon = c.icon;
          return (
            <button key={key} onClick={() => setStatusFilter(key === statusFilter ? "all" : key)}
              className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${statusFilter === key ? `${c.bg} ${c.border}` : "bg-white border-[#DCE3F0] hover:border-[#2D3199]/20"}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${c.bg}`}>
                <Icon className={`w-4 h-4 ${c.text}`} />
              </div>
              <div>
                <p className={`text-xl font-black ${statusFilter === key ? c.text : "text-[#0F172A]"}`}>{counts[key] ?? 0}</p>
                <p className={`text-[10px] font-bold capitalize ${statusFilter === key ? c.text : "text-[#94A3B8]"}`}>{c.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search + Sort + Filter row */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search pilgrim, package or booking ID…"
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-[#DCE3F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#2D3199]/20 focus:border-[#2D3199]"
          />
        </div>

        {/* Sort */}
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value as SortKey)}
          className="text-sm border border-[#DCE3F0] rounded-xl px-3 py-2.5 bg-white text-[#334155] focus:outline-none focus:ring-2 focus:ring-[#2D3199]/20 focus:border-[#2D3199] font-semibold cursor-pointer"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="amount_high">Amount: High → Low</option>
          <option value="amount_low">Amount: Low → High</option>
          <option value="name_az">Pilgrim: A → Z</option>
        </select>

        {/* Status filter toggle */}
        <button onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all ${showFilters ? "bg-[#2D3199] text-white border-[#2D3199]" : "bg-white text-[#64748B] border-[#DCE3F0] hover:border-[#2D3199] hover:text-[#2D3199]"}`}>
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {statusFilter !== "all" && <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B00]" />}
        </button>
      </div>

      {/* Filter chips */}
      {showFilters && (
        <div className="flex items-center gap-2 flex-wrap bg-white rounded-2xl border border-[#DCE3F0] p-3">
          <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider mr-1">Status</span>
          {["all", "pending", "confirmed", "cancelled", "completed"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all capitalize whitespace-nowrap ${statusFilter === s ? "bg-[#2D3199] text-white shadow-sm" : "bg-[#F1F5F9] text-[#64748B] hover:text-[#2D3199] hover:bg-[#EEF0FF]"}`}>
              {s}{s !== "all" && counts[s] !== undefined ? ` (${counts[s]})` : ""}
            </button>
          ))}
          {(statusFilter !== "all" || search) && (
            <button onClick={() => { setStatusFilter("all"); setSearch(""); }}
              className="ml-auto text-xs text-red-500 font-bold hover:text-red-600">
              Clear all
            </button>
          )}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center bg-white rounded-2xl border border-dashed border-[#DCE3F0]">
          <div className="w-14 h-14 rounded-2xl bg-[#EEF0FF] flex items-center justify-center mb-4">
            <BookOpen className="w-6 h-6 text-[#2D3199]/40" />
          </div>
          <p className="text-[#0F172A] font-bold mb-1">{allBookings.length === 0 ? "No bookings yet" : "No bookings match your search"}</p>
          <p className="text-[#94A3B8] text-sm">
            {allBookings.length === 0 ? "Bookings will appear here once pilgrims register." : "Try adjusting your search or filter."}
          </p>
          {(search || statusFilter !== "all") && (
            <button onClick={() => { setSearch(""); setStatusFilter("all"); }}
              className="mt-4 text-[#2D3199] text-sm font-bold hover:underline">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            {paginatedBookings.map(b => {
              const expanded = expandedId === b.id;
              const balance = b.totalPrice - b.amountPaid;
              return (
                <div key={b.id} className="bg-white rounded-2xl border border-[#DCE3F0] hover:shadow-[0_4px_20px_rgba(45,49,153,0.08)] transition-all"
                  data-testid={`card-booking-${b.id}`}>
                  {/* Main row */}
                  <div className="flex items-center gap-4 p-5">
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#2D3199] to-[#4C56B8] flex items-center justify-center font-black text-white text-base shrink-0">
                      {(b.user?.fullName || "P").charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-bold text-[#0F172A]">{b.user?.fullName || "Pilgrim"}</p>
                        <StatusBadge status={b.status} />
                      </div>
                      <p className="text-[#64748B] text-sm truncate mb-1">{b.package?.name || "—"}</p>
                      <div className="flex items-center gap-4 text-xs text-[#94A3B8]">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {b.package?.departureDate ? new Date(b.package.departureDate).toLocaleDateString("en-GB") : "TBC"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {b.pilgrimCount} pilgrim{b.pilgrimCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    {/* Amount + actions */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="font-black text-[#0F172A]">₦{b.totalPrice.toLocaleString()}</p>
                        <p className="text-[#94A3B8] text-xs">₦{b.amountPaid.toLocaleString()} paid</p>
                        {balance > 0 && <p className="text-[#FF3B00] text-[10px] font-bold">₦{balance.toLocaleString()} due</p>}
                      </div>
                      <PayProgress paid={b.amountPaid} total={b.totalPrice} />
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setExpandedId(expanded ? null : b.id)}
                          className="w-8 h-8 rounded-xl bg-[#F8FAFC] hover:bg-[#EEF0FF] flex items-center justify-center transition-colors">
                          {expanded ? <ChevronUp className="w-4 h-4 text-[#2D3199]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
                        </button>
                        <button onClick={() => openEdit(b)}
                          className="w-8 h-8 rounded-xl bg-[#F0F2FF] hover:bg-[#EEF0FF] flex items-center justify-center transition-colors"
                          data-testid={`button-edit-booking-${b.id}`}>
                          <Edit2 className="w-3.5 h-3.5 text-[#2D3199]" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expanded && (
                    <div className="border-t border-[#F1F5F9] px-5 py-4 bg-[#FAFBFF] rounded-b-2xl space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-0.5">Booking ID</p>
                          <p className="font-mono text-xs text-[#334155] truncate">{b.id}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-0.5">Total Price</p>
                          <p className="font-black text-[#0F172A]">₦{b.totalPrice.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-0.5">Amount Paid</p>
                          <p className="font-black text-emerald-600">₦{b.amountPaid.toLocaleString()}</p>
                        </div>
                        {balance > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-0.5">Balance Due</p>
                            <p className="font-black text-[#FF3B00]">₦{balance.toLocaleString()}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-0.5">Pilgrims</p>
                          <p className="font-semibold text-[#334155]">{b.pilgrimCount}</p>
                        </div>
                        {(b as any).createdAt && (
                          <div>
                            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-0.5">Booked On</p>
                            <p className="font-semibold text-[#334155]">{new Date((b as any).createdAt).toLocaleDateString("en-GB")}</p>
                          </div>
                        )}
                      </div>
                      {b.notes && (
                        <div className="bg-white rounded-xl p-3 border border-[#E8EDF5]">
                          <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1">Admin Notes</p>
                          <p className="text-sm text-[#334155]">{b.notes}</p>
                        </div>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => openEdit(b)}
                          className="flex items-center gap-2 px-4 py-2 bg-[#2D3199] hover:bg-[#1C1F66] text-white text-xs font-bold rounded-xl transition-colors">
                          <Edit2 className="w-3.5 h-3.5" /> Update Status
                        </button>
                        {balance > 0 && (
                          <button onClick={() => openRecordPay(b)}
                            className="flex items-center gap-2 px-4 py-2 bg-[#FF3B00] hover:bg-[#CC2E00] text-white text-xs font-bold rounded-xl transition-colors">
                            <Plus className="w-3.5 h-3.5" /> Record Payment
                          </button>
                        )}
                        {balance > 0 && b.status === "pending" && (
                          <div className="flex items-center gap-2 px-4 py-2 bg-[#FFF5F2] border border-[#FECDBA] text-[#C2410C] text-xs font-bold rounded-xl">
                            <CreditCard className="w-3.5 h-3.5" /> ₦{balance.toLocaleString()} outstanding
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination bar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-2xl border border-[#DCE3F0] px-5 py-3.5">
              <p className="text-xs text-[#94A3B8] font-medium">
                Showing{" "}
                <span className="font-bold text-[#334155]">{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)}</span>
                {" "}of <span className="font-bold text-[#334155]">{filtered.length}</span>
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#DCE3F0] text-[#64748B] hover:border-[#2D3199] hover:text-[#2D3199] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {pageNumbers.map((p, i) => (
                  p === "…" ? (
                    <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-[#94A3B8]">…</span>
                  ) : (
                    <button key={p} onClick={() => setCurrentPage(p as number)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                        currentPage === p
                          ? "bg-[#2D3199] text-white shadow-sm"
                          : "border border-[#DCE3F0] text-[#64748B] hover:border-[#2D3199] hover:text-[#2D3199]"
                      }`}>
                      {p}
                    </button>
                  )
                ))}

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#DCE3F0] text-[#64748B] hover:border-[#2D3199] hover:text-[#2D3199] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editingId} onOpenChange={o => { if (!o) setEditingId(null); }}>
        <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#F1F5F9]">
            <DialogTitle className="font-black text-[#0F172A]">Update Booking Status</DialogTitle>
            <p className="text-[#94A3B8] text-sm mt-0.5">Change status and add an admin note</p>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4">
            <div>
              <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Status</Label>
              <Select value={editStatus} onValueChange={v => setEditStatus(v as typeof editStatus)}>
                <SelectTrigger className="mt-1.5 rounded-xl border-[#DCE3F0]" data-testid="select-edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["pending","confirmed","cancelled","completed"] as const).map(s => (
                    <SelectItem key={s} value={s} className="capitalize">
                      <span className="flex items-center gap-2 capitalize">
                        <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[s]?.dot}`} />
                        {s}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Admin Notes</Label>
              <Textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                className="mt-1.5 rounded-xl border-[#DCE3F0] resize-none"
                placeholder="Add a note visible to your team…"
                rows={3}
                data-testid="input-edit-notes"
              />
            </div>
          </div>
          <div className="px-6 pb-5 flex gap-3">
            <button onClick={() => setEditingId(null)}
              className="flex-1 py-2.5 rounded-xl border border-[#DCE3F0] text-[#64748B] text-sm font-bold hover:bg-[#F8FAFC] transition-colors">
              Cancel
            </button>
            <button
              onClick={handleUpdate}
              disabled={updateBooking.isPending}
              className="flex-1 py-2.5 rounded-xl bg-[#2D3199] hover:bg-[#1C1F66] text-white text-sm font-bold transition-colors disabled:opacity-50"
              data-testid="button-save-booking"
            >
              {updateBooking.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Payment dialog */}
      <Dialog open={!!recordPayBookingId} onOpenChange={o => { if (!o) setRecordPayBookingId(null); }}>
        <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden">
          {(() => {
            const rpBooking = allBookings.find(bk => bk.id === recordPayBookingId);
            const rpBalance = rpBooking ? rpBooking.totalPrice - rpBooking.amountPaid : 0;
            return (
              <>
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#F1F5F9]">
                  <DialogTitle className="font-black text-[#0F172A]">Record Payment</DialogTitle>
                  {rpBooking && (
                    <div className="mt-1.5 space-y-0.5">
                      <p className="text-sm text-[#334155] font-semibold">{rpBooking.user?.fullName || "Pilgrim"}</p>
                      <p className="text-xs text-[#94A3B8] font-mono truncate">Ref: {rpBooking.id}</p>
                      <p className="text-xs font-bold text-[#FF3B00]">Balance: ₦{rpBalance.toLocaleString()}</p>
                    </div>
                  )}
                </DialogHeader>
                <div className="px-6 py-5 space-y-4">
                  {/* Amount */}
                  <div>
                    <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Amount (₦)</Label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={recordPayAmount}
                      onChange={e => setRecordPayAmount(e.target.value)}
                      className="w-full mt-1.5 px-3 py-2.5 text-sm rounded-xl border border-[#DCE3F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#2D3199]/20 focus:border-[#2D3199] font-bold text-[#0F172A]"
                      placeholder="0.00"
                    />
                  </div>
                  {/* Payment Method */}
                  <div>
                    <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Payment Method</Label>
                    <Select value={recordPayMethod} onValueChange={setRecordPayMethod}>
                      <SelectTrigger className="mt-1.5 rounded-xl border-[#DCE3F0]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Reference */}
                  <div>
                    <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Reference <span className="text-[#94A3B8] normal-case font-normal">(optional)</span></Label>
                    <input
                      type="text"
                      value={recordPayRef}
                      onChange={e => setRecordPayRef(e.target.value)}
                      className="w-full mt-1.5 px-3 py-2.5 text-sm rounded-xl border border-[#DCE3F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#2D3199]/20 focus:border-[#2D3199] text-[#334155]"
                      placeholder="e.g. transaction ID or receipt number"
                    />
                  </div>
                  {/* Notes */}
                  <div>
                    <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Notes <span className="text-[#94A3B8] normal-case font-normal">(optional)</span></Label>
                    <Textarea
                      value={recordPayNotes}
                      onChange={e => setRecordPayNotes(e.target.value)}
                      className="mt-1.5 rounded-xl border-[#DCE3F0] resize-none"
                      placeholder="Any additional details…"
                      rows={2}
                    />
                  </div>
                  {/* Mark as Verified */}
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recordPayVerify}
                      onChange={e => setRecordPayVerify(e.target.checked)}
                      className="w-4 h-4 rounded border-[#DCE3F0] text-[#2D3199] focus:ring-[#2D3199]/20"
                    />
                    <span className="text-sm font-semibold text-[#334155]">Mark as Verified</span>
                  </label>
                </div>
                <div className="px-6 pb-5 flex gap-3">
                  <button onClick={() => setRecordPayBookingId(null)}
                    className="flex-1 py-2.5 rounded-xl border border-[#DCE3F0] text-[#64748B] text-sm font-bold hover:bg-[#F8FAFC] transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleRecordPay}
                    disabled={recordPayLoading || !recordPayAmount || parseFloat(recordPayAmount) <= 0}
                    className="flex-1 py-2.5 rounded-xl bg-[#FF3B00] hover:bg-[#CC2E00] text-white text-sm font-bold transition-colors disabled:opacity-50"
                  >
                    {recordPayLoading ? "Recording…" : "Record Payment"}
                  </button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
