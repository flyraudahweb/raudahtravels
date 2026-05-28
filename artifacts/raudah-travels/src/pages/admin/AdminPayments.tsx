import { useState } from "react";
import { useListPayments, getListPaymentsQueryKey, useVerifyPayment } from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CreditCard, CheckCircle2, XCircle, Clock, ExternalLink,
  DollarSign, ArrowUpRight, Printer, Search, Plus, History, AlertTriangle, TrendingDown, Users,
  ChevronLeft, ChevronRight, Check
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { printReceipt } from "@/utils/printReceipt";



/* ─── Constants ─────────────────────────────────────────────────────── */

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; icon: typeof CheckCircle2 }> = {
  pending:  { label: "Pending",  bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",  icon: Clock },
  verified: { label: "Verified", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: CheckCircle2 },
  rejected: { label: "Rejected", bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200",    icon: XCircle },
};

const METHOD_CONFIG: Record<string, { label: string; icon: string; bg: string }> = {
  bank_transfer: { label: "Bank Transfer", icon: "🏦", bg: "bg-blue-50" },
  card:          { label: "Card",          icon: "💳", bg: "bg-purple-50" },
  cash:          { label: "Cash",          icon: "💵", bg: "bg-green-50" },
  wallet:        { label: "Wallet",        icon: "👛", bg: "bg-amber-50" },
  online:        { label: "Online",        icon: "🔒", bg: "bg-indigo-50" },
  paystack:      { label: "Paystack",      icon: "🔒", bg: "bg-indigo-50" },
};

const OUTSTANDING_PAGE_SIZE = 100;

/* ─── Types ─────────────────────────────────────────────────────────── */

interface OutstandingBooking {
  id: string;
  reference: string;
  fullName: string;
  phone: string;
  status: string;
  totalPrice: number;
  amountPaid: number;
  balance: number;
  packageName: string;
  packageType: string;
  agentName: string;
  createdAt: string;
}

interface OutstandingSummary {
  totalOutstanding: number;
  totalOwed: number;
  totalPaid: number;
  count: number;
}

interface OutstandingResponse {
  bookings: OutstandingBooking[];
  total: number;
  summary: OutstandingSummary;
}

interface BookingPayment {
  id: string;
  amount: number;
  method: string;
  status: string;
  reference: string;
  notes: string;
  createdAt: string;
}

interface PaymentHistoryResponse {
  payments: BookingPayment[];
  booking: {
    id: string;
    reference: string;
    fullName: string;
    totalPrice: number;
    amountPaid: number;
    balance: number;
  };
}

/* ─── PayProgress (mirrored from AdminBookings) ─────────────────────── */

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

/* ═══════════════════════════════════════════════════════════════════════
   OUTSTANDING BALANCES TAB
   ═══════════════════════════════════════════════════════════════════════ */

function OutstandingBalancesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  // Debounce search
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimer) clearTimeout(searchTimer);
    const t = setTimeout(() => { setDebouncedSearch(val); setPage(1); }, 300);
    setSearchTimer(t);
  };

  // Dialog state
  const [recordBooking, setRecordBooking] = useState<OutstandingBooking | null>(null);
  const [historyBookingId, setHistoryBookingId] = useState<string | null>(null);

  // Record payment form
  const [rpAmount, setRpAmount] = useState("");
  const [rpMethod, setRpMethod] = useState("cash");
  const [rpReference, setRpReference] = useState("");
  const [rpNotes, setRpNotes] = useState("");
  const [rpMarkVerified, setRpMarkVerified] = useState(true);

  // Fetch outstanding bookings
  const outstandingQuery = useQuery<OutstandingResponse>({
    queryKey: ["payments", "outstanding", debouncedSearch, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: debouncedSearch,
        limit: String(OUTSTANDING_PAGE_SIZE),
        offset: String((page - 1) * OUTSTANDING_PAGE_SIZE),
      });
      const r = await fetch(`/api/payments/outstanding?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch outstanding balances");
      return r.json();
    },
  });

  // Fetch payment history for a booking
  const historyQuery = useQuery<PaymentHistoryResponse>({
    queryKey: ["payments", "booking", historyBookingId],
    queryFn: async () => {
      const r = await fetch(`/api/payments/booking/${historyBookingId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch payment history");
      return r.json();
    },
    enabled: !!historyBookingId,
  });

  // Record payment mutation
  const recordMutation = useMutation({
    mutationFn: async (body: {
      bookingId: string;
      amount: number;
      method: string;
      reference: string;
      proofUrl: string;
      notes: string;
      markVerified: boolean;
    }) => {
      const r = await fetch("/api/payments/admin-record", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message || "Failed to record payment");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Payment recorded ✓" });
      qc.invalidateQueries({ queryKey: ["payments", "outstanding"] });
      qc.invalidateQueries({ queryKey: ["payments", "booking"] });
      qc.invalidateQueries({ queryKey: getListPaymentsQueryKey({}) });
      setRecordBooking(null);
    },
    onError: (err: Error) => {
      toast({ title: err.message || "Failed to record payment", variant: "destructive" });
    },
  });

  const handleRecordSubmit = () => {
    if (!recordBooking) return;
    const amount = parseFloat(rpAmount);
    if (!amount || amount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    recordMutation.mutate({
      bookingId: recordBooking.id,
      amount,
      method: rpMethod,
      reference: rpReference,
      proofUrl: "",
      notes: rpNotes,
      markVerified: rpMarkVerified,
    });
  };

  const openRecordDialog = (b: OutstandingBooking) => {
    setRecordBooking(b);
    setRpAmount(String(b.balance));
    setRpMethod("cash");
    setRpReference("");
    setRpNotes("");
    setRpMarkVerified(true);
  };

  const summary = outstandingQuery.data?.summary;
  const bookings = outstandingQuery.data?.bookings || [];
  const totalResults = outstandingQuery.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalResults / OUTSTANDING_PAGE_SIZE));

  const HISTORY_STATUS: Record<string, { label: string; bg: string; text: string; border: string; icon: typeof CheckCircle2 }> = {
    verified: { label: "Verified", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: CheckCircle2 },
    pending:  { label: "Pending",  bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",  icon: Clock },
    rejected: { label: "Rejected", bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200",    icon: XCircle },
  };

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      {outstandingQuery.isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-[#FF3B00] to-[#E63500] rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">Total Outstanding</p>
              <AlertTriangle className="w-4 h-4 text-white/50" />
            </div>
            <p className="text-2xl font-black">₦{summary.totalOutstanding.toLocaleString()}</p>
          </div>
          <div className="bg-gradient-to-br from-[#2D3199] to-[#4C56B8] rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">Total Owed</p>
              <TrendingDown className="w-4 h-4 text-white/50" />
            </div>
            <p className="text-2xl font-black">₦{summary.totalOwed.toLocaleString()}</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-500 rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">Total Paid</p>
              <CheckCircle2 className="w-4 h-4 text-white/50" />
            </div>
            <p className="text-2xl font-black">₦{summary.totalPaid.toLocaleString()}</p>
          </div>
          <div className="bg-gradient-to-br from-[#334155] to-[#1E293B] rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">Bookings</p>
              <Users className="w-4 h-4 text-white/50" />
            </div>
            <p className="text-2xl font-black">{summary.count}</p>
            <p className="text-white/60 text-xs mt-1">with outstanding balance</p>
          </div>
        </div>
      ) : null}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
        <input
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search by name, reference, phone, or passport…"
          className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-[#DCE3F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#2D3199]/20 focus:border-[#2D3199]"
        />
      </div>

      {/* Bookings list */}
      {outstandingQuery.isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : bookings.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center bg-white rounded-2xl border border-dashed border-[#DCE3F0]">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <p className="text-[#0F172A] font-bold mb-1">No outstanding balances</p>
          <p className="text-[#94A3B8] text-sm">All bookings are fully paid!</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {bookings.map(b => (
              <div key={b.id}
                className="bg-white rounded-2xl border border-[#DCE3F0] p-5 hover:shadow-[0_4px_20px_rgba(45,49,153,0.08)] transition-shadow">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#2D3199] to-[#4C56B8] flex items-center justify-center font-black text-white text-base shrink-0">
                    {(b.fullName || "P").charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-bold text-[#0F172A]">{b.fullName}</p>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#F1F5F9] text-[#64748B]">{b.reference}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#94A3B8] mb-2">
                      <span className="font-semibold text-[#64748B]">{b.packageName}</span>
                      {b.agentName && (
                        <>
                          <span>·</span>
                          <span>Agent: <span className="font-semibold text-[#334155]">{b.agentName}</span></span>
                        </>
                      )}
                      <span>·</span>
                      <span>{new Date(b.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                    </div>

                    {/* Amounts row */}
                    <div className="flex items-center gap-4 flex-wrap text-xs">
                      <div>
                        <span className="text-[#94A3B8] font-bold uppercase tracking-wider text-[10px]">Total</span>
                        <p className="font-black text-[#0F172A]">₦{b.totalPrice.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-[#94A3B8] font-bold uppercase tracking-wider text-[10px]">Paid</span>
                        <p className="font-black text-emerald-600">₦{b.amountPaid.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-[#94A3B8] font-bold uppercase tracking-wider text-[10px]">Balance</span>
                        <p className="font-black text-[#FF3B00]">₦{b.balance.toLocaleString()}</p>
                      </div>
                      <PayProgress paid={b.amountPaid} total={b.totalPrice} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <button
                      onClick={() => setHistoryBookingId(b.id)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-[#F0F2FF] hover:bg-[#EEF0FF] text-[#2D3199] text-xs font-bold rounded-xl transition-colors"
                      title="View History"
                    >
                      <History className="w-3.5 h-3.5" /> History
                    </button>
                    <button
                      onClick={() => openRecordDialog(b)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-[#2D3199] hover:bg-[#1C1F66] text-white text-xs font-bold rounded-xl transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Record Payment
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-2xl border border-[#DCE3F0] px-5 py-3.5">
              <p className="text-xs text-[#94A3B8] font-medium">
                Showing{" "}
                <span className="font-bold text-[#334155]">{(page - 1) * OUTSTANDING_PAGE_SIZE + 1}–{Math.min(page * OUTSTANDING_PAGE_SIZE, totalResults)}</span>
                {" "}of <span className="font-bold text-[#334155]">{totalResults}</span>
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#DCE3F0] text-[#64748B] hover:border-[#2D3199] hover:text-[#2D3199] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let num: number;
                  if (totalPages <= 7) {
                    num = i + 1;
                  } else if (page <= 4) {
                    num = i + 1;
                  } else if (page >= totalPages - 3) {
                    num = totalPages - 6 + i;
                  } else {
                    num = page - 3 + i;
                  }
                  return (
                    <button key={num} onClick={() => setPage(num)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                        page === num
                          ? "bg-[#2D3199] text-white shadow-sm"
                          : "border border-[#DCE3F0] text-[#64748B] hover:border-[#2D3199] hover:text-[#2D3199]"
                      }`}>
                      {num}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#DCE3F0] text-[#64748B] hover:border-[#2D3199] hover:text-[#2D3199] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Record Payment Dialog ───────────────────────────────────── */}
      <Dialog open={!!recordBooking} onOpenChange={o => { if (!o) setRecordBooking(null); }}>
        <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#F1F5F9]">
            <DialogTitle className="font-black text-[#0F172A]">Record Payment</DialogTitle>
            <p className="text-[#94A3B8] text-sm mt-0.5">Add a manual payment entry</p>
          </DialogHeader>

          {recordBooking && (
            <div className="px-6 py-5 space-y-4">
              {/* Booking info header */}
              <div className="bg-[#F8FAFC] rounded-xl p-3 border border-[#F1F5F9]">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-bold text-[#0F172A] text-sm">{recordBooking.fullName}</p>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white text-[#64748B] border border-[#E8EDF5]">{recordBooking.reference}</span>
                </div>
                <p className="text-xs text-[#64748B]">
                  Balance: <span className="font-black text-[#FF3B00]">₦{recordBooking.balance.toLocaleString()}</span>
                </p>
              </div>

              {/* Amount */}
              <div>
                <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Amount (₦)</Label>
                <input
                  type="number"
                  value={rpAmount}
                  onChange={e => setRpAmount(e.target.value)}
                  min={1}
                  className="mt-1.5 w-full px-3 py-2.5 text-sm rounded-xl border border-[#DCE3F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#2D3199]/20 focus:border-[#2D3199]"
                  placeholder="0"
                />
              </div>

              {/* Method */}
              <div>
                <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Payment Method</Label>
                <Select value={rpMethod} onValueChange={setRpMethod}>
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
                <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Reference (optional)</Label>
                <input
                  value={rpReference}
                  onChange={e => setRpReference(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2.5 text-sm rounded-xl border border-[#DCE3F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#2D3199]/20 focus:border-[#2D3199]"
                  placeholder="Transaction reference…"
                />
              </div>

              {/* Notes */}
              <div>
                <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Notes (optional)</Label>
                <Textarea
                  value={rpNotes}
                  onChange={e => setRpNotes(e.target.value)}
                  className="mt-1.5 rounded-xl border-[#DCE3F0] resize-none"
                  placeholder="Add a note…"
                  rows={2}
                />
              </div>

              {/* Mark verified checkbox */}
              <div className="flex items-center gap-2.5">
                <Checkbox
                  id="rp-mark-verified"
                  checked={rpMarkVerified}
                  onCheckedChange={(c) => setRpMarkVerified(!!c)}
                />
                <label htmlFor="rp-mark-verified" className="text-sm font-semibold text-[#334155] cursor-pointer select-none">
                  Mark as Verified & Confirmed
                </label>
              </div>

              {/* Submit */}
              <button
                onClick={handleRecordSubmit}
                disabled={recordMutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#2D3199] hover:bg-[#1C1F66] text-white font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {recordMutation.isPending ? (
                  "Recording…"
                ) : (
                  <>
                    <Check className="w-4 h-4" /> Record Payment
                  </>
                )}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Payment History Dialog ──────────────────────────────────── */}
      <Dialog open={!!historyBookingId} onOpenChange={o => { if (!o) setHistoryBookingId(null); }}>
        <DialogContent className="sm:max-w-lg rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#F1F5F9]">
            <DialogTitle className="font-black text-[#0F172A]">Payment History</DialogTitle>
            <p className="text-[#94A3B8] text-sm mt-0.5">All payments for this booking</p>
          </DialogHeader>

          <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {historyQuery.isLoading ? (
              <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
            ) : historyQuery.data ? (
              <>
                {/* Booking summary */}
                <div className="bg-[#F8FAFC] rounded-xl p-4 border border-[#F1F5F9]">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-bold text-[#0F172A]">{historyQuery.data.booking.fullName}</p>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white text-[#64748B] border border-[#E8EDF5]">{historyQuery.data.booking.reference}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-[#94A3B8] font-bold uppercase tracking-wider text-[10px]">Total</span>
                      <p className="font-black text-[#0F172A]">₦{historyQuery.data.booking.totalPrice.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-[#94A3B8] font-bold uppercase tracking-wider text-[10px]">Paid</span>
                      <p className="font-black text-emerald-600">₦{historyQuery.data.booking.amountPaid.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-[#94A3B8] font-bold uppercase tracking-wider text-[10px]">Balance</span>
                      <p className="font-black text-[#FF3B00]">₦{historyQuery.data.booking.balance.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Payments list */}
                {historyQuery.data.payments.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-[#94A3B8] text-sm">No payments recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {[...historyQuery.data.payments]
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map(p => {
                        const sc = HISTORY_STATUS[p.status] || HISTORY_STATUS.pending;
                        const StatusIcon = sc.icon;
                        const mc = METHOD_CONFIG[p.method] || { label: p.method.replace(/_/g, " "), icon: "💰", bg: "bg-[#F0F2FF]" };
                        return (
                          <div key={p.id} className="flex items-center gap-3 bg-white rounded-xl border border-[#DCE3F0] p-3.5">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${mc.bg}`}>
                              {mc.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="font-black text-[#0F172A]">₦{p.amount.toLocaleString()}</p>
                                <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold border ${sc.bg} ${sc.text} ${sc.border}`}>
                                  <StatusIcon className="w-3 h-3" /> {sc.label}
                                </span>
                              </div>
                              <div className="flex gap-x-3 text-[11px] text-[#94A3B8]">
                                <span className="font-semibold text-[#64748B] capitalize">{mc.label}</span>
                                {p.reference && <span className="font-mono">Ref: {p.reference}</span>}
                                <span>{new Date(p.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-[#94A3B8] text-sm">Could not load payment history</p>
              </div>
            )}
          </div>

          <div className="px-6 pb-5">
            <button
              onClick={() => setHistoryBookingId(null)}
              className="w-full py-2.5 rounded-xl border border-[#DCE3F0] text-[#64748B] text-sm font-bold hover:bg-[#F8FAFC] transition-colors"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */

export default function AdminPayments() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [viewingProof, setViewingProof] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [page, setPage] = useState(1);

  /* ── Tab state ── */
  const [activeTab, setActiveTab] = useState<"all" | "outstanding">("all");

  const params = statusFilter !== "all" ? { status: statusFilter } : {};
  const { data, isLoading } = useListPayments(params as Record<string, unknown>, { query: { queryKey: getListPaymentsQueryKey(params as Record<string, unknown>) } });
  const verifyPayment = useVerifyPayment();
  const allPayments = data?.payments || [];

  const payments = search.trim()
    ? allPayments.filter(p => {
        const q = search.toLowerCase();
        return (
          p.reference?.toLowerCase().includes(q) ||
          p.booking?.user?.fullName?.toLowerCase().includes(q) ||
          p.method.toLowerCase().includes(q) ||
          String(p.amount).includes(q)
        );
      })
    : allPayments;

  const PAGE_SIZE = 100;
  const totalPages = Math.max(1, Math.ceil(payments.length / PAGE_SIZE));
  const paginatedPayments = payments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleVerify = (action: "verified" | "rejected") => {
    if (!verifyingId) return;
    verifyPayment.mutate({ id: verifyingId, data: { status: action, notes } }, {
      onSuccess: () => {
        toast({ title: action === "verified" ? "Payment verified ✓" : "Payment rejected" });
        qc.invalidateQueries({ queryKey: getListPaymentsQueryKey({}) });
        qc.invalidateQueries({ queryKey: getListPaymentsQueryKey({ status: "pending" }) });
        setVerifyingId(null); setNotes("");
      },
      onError: () => toast({ title: "Action failed", variant: "destructive" }),
    });
  };

  const totalAll      = allPayments.reduce((s, p) => s + p.amount, 0);
  const totalPending  = allPayments.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const totalVerified = allPayments.filter(p => p.status === "verified").reduce((s, p) => s + p.amount, 0);

  const handlePrint = (payment: typeof allPayments[0]) => {
    printReceipt({
      id: payment.id,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      reference: payment.reference,
      createdAt: payment.createdAt,
      notes: payment.notes,
      pilgrimName: payment.booking?.user?.fullName,
      packageName: (payment.booking as any)?.package?.name,
      departureDate: (payment.booking as any)?.package?.departureDate,
      bookingId: payment.booking?.id,
      totalPrice: (payment.booking as any)?.totalPrice,
      amountPaidSoFar: (payment.booking as any)?.amountPaid,
      breakdown: {
        basePrice: (payment.booking as any)?.package?.price || 0,
        roomSurcharge: (payment.booking as any)?.roomSurcharge || 0,
        childrenExtra: (payment.booking as any)?.childrenExtra || 0,
      },
    });
  };


  return (
    <div className="space-y-6" data-testid="page-admin-payments">

      {/* Header */}
      <div>
        <p className="text-[#2D3199] text-xs font-bold uppercase tracking-widest mb-1">Finance</p>
        <h1 className="text-2xl font-black text-[#0F172A]">Payments</h1>
        <p className="text-[#64748B] text-sm mt-0.5">Verify and manage all payment records</p>
      </div>



      {/* Tab bar */}
      <div className="flex gap-1.5 bg-white rounded-xl border border-[#DCE3F0] p-1 w-fit">
        <button
          onClick={() => setActiveTab("all")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === "all"
              ? "bg-[#2D3199] text-white shadow-sm"
              : "text-[#64748B] hover:text-[#2D3199]"
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" /> All Payments
        </button>
        <button
          onClick={() => setActiveTab("outstanding")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === "outstanding"
              ? "bg-[#2D3199] text-white shadow-sm"
              : "text-[#64748B] hover:text-[#2D3199]"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" /> Outstanding Balances
        </button>
      </div>

      {/* ── Outstanding Balances Tab ── */}
      {activeTab === "outstanding" && <OutstandingBalancesTab />}

      {/* ── All Payments Tab (existing) ── */}
      {activeTab === "all" && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-[#2D3199] to-[#4C56B8] rounded-2xl p-5 text-white">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">Total Payments</p>
                <DollarSign className="w-4 h-4 text-white/50" />
              </div>
              <p className="text-2xl font-black">₦{totalAll.toLocaleString()}</p>
              <p className="text-white/60 text-xs mt-1">{allPayments.length} records</p>
            </div>
            <div className="bg-gradient-to-br from-amber-500 to-amber-400 rounded-2xl p-5 text-white">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">Pending Review</p>
                <Clock className="w-4 h-4 text-white/50" />
              </div>
              <p className="text-2xl font-black">₦{totalPending.toLocaleString()}</p>
              <p className="text-white/60 text-xs mt-1">{allPayments.filter(p => p.status === "pending").length} payments</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-500 rounded-2xl p-5 text-white">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">Verified</p>
                <CheckCircle2 className="w-4 h-4 text-white/50" />
              </div>
              <p className="text-2xl font-black">₦{totalVerified.toLocaleString()}</p>
              <p className="text-white/60 text-xs mt-1">{allPayments.filter(p => p.status === "verified").length} payments</p>
            </div>
          </div>

          {/* Search + Filter */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by pilgrim, reference, or method…"
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-[#DCE3F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#2D3199]/20 focus:border-[#2D3199]"
              />
            </div>
            <div className="flex gap-1.5 bg-white rounded-xl border border-[#DCE3F0] p-1">
              {["all", "pending", "verified", "rejected"].map(s => (
                <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize whitespace-nowrap ${statusFilter === s ? "bg-[#2D3199] text-white shadow-sm" : "text-[#64748B] hover:text-[#2D3199]"}`}
                  data-testid={`filter-${s}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center bg-white rounded-2xl border border-dashed border-[#DCE3F0]">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="text-[#0F172A] font-bold mb-1">No payments found</p>
              <p className="text-[#94A3B8] text-sm">Try a different filter or search term</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedPayments.map(payment => {
                const c = STATUS_CONFIG[payment.status] || STATUS_CONFIG.pending;
                const StatusIcon = c.icon;
                const m = METHOD_CONFIG[payment.method] || { label: payment.method.replace(/_/g, " "), icon: "💰", bg: "bg-[#F0F2FF]" };
                return (
                  <div key={payment.id}
                    className="bg-white rounded-2xl border border-[#DCE3F0] p-5 hover:shadow-[0_4px_20px_rgba(45,49,153,0.08)] transition-shadow"
                    data-testid={`card-payment-${payment.id}`}>
                    <div className="flex items-start gap-4">
                      {/* Method icon */}
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 ${m.bg}`}>
                        {m.icon}
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 flex-wrap mb-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-black text-[#0F172A] text-lg">₦{payment.amount.toLocaleString()}</p>
                            <span className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-bold border ${c.bg} ${c.text} ${c.border}`}>
                              <StatusIcon className="w-3 h-3" /> {c.label}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#94A3B8]">
                          <span className="font-semibold capitalize text-[#64748B]">{m.label}</span>
                          <span>·</span>
                          <span>{new Date(payment.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                          {payment.reference && (
                            <><span>·</span><span className="font-mono">Ref: {payment.reference}</span></>
                          )}
                          {payment.booking?.user?.fullName && (
                            <><span>·</span><span className="font-semibold text-[#334155]">{payment.booking.user.fullName}</span></>
                          )}
                          {(payment.booking as any)?.package?.name && (
                            <><span>·</span><span>{(payment.booking as any).package.name}</span></>
                          )}
                        </div>

                        {payment.notes && (
                          <p className="mt-2 text-xs text-[#64748B] bg-[#F8FAFC] rounded-lg px-3 py-1.5 border border-[#F1F5F9]">{payment.notes}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        {/* Print receipt */}
                        <button
                          onClick={() => handlePrint(payment)}
                          className="w-9 h-9 rounded-xl bg-[#EEF0FF] hover:bg-[#2D3199] group flex items-center justify-center transition-colors"
                          title="Print receipt"
                        >
                          <Printer className="w-4 h-4 text-[#2D3199] group-hover:text-white transition-colors" />
                        </button>

                        {payment.proofUrl && (
                          <button onClick={() => setViewingProof(payment.proofUrl ?? null)}
                            className="w-9 h-9 rounded-xl bg-[#F0F2FF] hover:bg-[#EEF0FF] flex items-center justify-center transition-colors"
                            title="View receipt"
                            data-testid={`button-view-proof-${payment.id}`}>
                            <ExternalLink className="w-4 h-4 text-[#2D3199]" />
                          </button>
                        )}

                        {payment.status === "pending" && (
                          <button onClick={() => setVerifyingId(payment.id)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-[#2D3199] hover:bg-[#1C1F66] text-white text-xs font-bold rounded-xl transition-colors"
                            data-testid={`button-verify-${payment.id}`}>
                            <ArrowUpRight className="w-3.5 h-3.5" /> Review
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between bg-white rounded-2xl border border-[#DCE3F0] px-5 py-3.5 mt-4">
                  <p className="text-xs text-[#94A3B8] font-medium">
                    Showing{" "}
                    <span className="font-bold text-[#334155]">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, payments.length)}</span>
                    {" "}of <span className="font-bold text-[#334155]">{payments.length}</span>
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#DCE3F0] text-[#64748B] hover:border-[#2D3199] hover:text-[#2D3199] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let num: number;
                      if (totalPages <= 7) {
                        num = i + 1;
                      } else if (page <= 4) {
                        num = i + 1;
                      } else if (page >= totalPages - 3) {
                        num = totalPages - 6 + i;
                      } else {
                        num = page - 3 + i;
                      }
                      return (
                        <button key={num} onClick={() => setPage(num)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                            page === num
                              ? "bg-[#2D3199] text-white shadow-sm"
                              : "border border-[#DCE3F0] text-[#64748B] hover:border-[#2D3199] hover:text-[#2D3199]"
                          }`}>
                          {num}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#DCE3F0] text-[#64748B] hover:border-[#2D3199] hover:text-[#2D3199] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Review dialog */}
      <Dialog open={!!verifyingId} onOpenChange={o => { if (!o) { setVerifyingId(null); setNotes(""); } }}>
        <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#F1F5F9]">
            <DialogTitle className="font-black text-[#0F172A]">Review Payment</DialogTitle>
            <p className="text-[#94A3B8] text-sm mt-0.5">Verify or reject this payment submission</p>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4">
            <div>
              <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Notes (optional)</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)}
                className="mt-1.5 rounded-xl border-[#DCE3F0] resize-none"
                placeholder="Add a note for this decision…"
                rows={3}
                data-testid="input-verify-notes" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => handleVerify("verified")} disabled={verifyPayment.isPending}
                className="flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
                data-testid="button-confirm-verify">
                <CheckCircle2 className="w-4 h-4" /> Verify
              </button>
              <button onClick={() => handleVerify("rejected")} disabled={verifyPayment.isPending}
                className="flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
                data-testid="button-confirm-reject">
                <XCircle className="w-4 h-4" /> Reject
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Proof Viewer dialog */}
      <Dialog open={!!viewingProof} onOpenChange={o => { if (!o) setViewingProof(null); }}>
        <DialogContent className="sm:max-w-3xl rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#F1F5F9]">
            <DialogTitle className="font-black text-[#0F172A]">Payment Receipt</DialogTitle>
          </DialogHeader>
          <div className="p-6 bg-[#F8FAFC] flex justify-center max-h-[85vh] overflow-y-auto">
            {viewingProof?.startsWith("data:application/pdf") ? (
              <object data={viewingProof} type="application/pdf" className="w-full h-[70vh] rounded-lg">
                <iframe src={viewingProof} className="w-full h-[70vh] border-0 rounded-lg">
                  This browser does not support PDFs. Please download the PDF to view it.
                </iframe>
              </object>
            ) : (
              <img src={viewingProof || ""} alt="Payment Proof" className="max-w-full rounded-lg shadow-sm" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
