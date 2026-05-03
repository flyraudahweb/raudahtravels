import { useState } from "react";
import { useListPayments, getListPaymentsQueryKey, useVerifyPayment } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CreditCard, CheckCircle2, XCircle, Clock, ExternalLink,
  DollarSign, ArrowUpRight, Printer, Search,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { printReceipt } from "@/utils/printReceipt";

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

export default function AdminPayments() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

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
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by pilgrim, reference, or method…"
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-[#DCE3F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#2D3199]/20 focus:border-[#2D3199]"
          />
        </div>
        <div className="flex gap-1.5 bg-white rounded-xl border border-[#DCE3F0] p-1">
          {["all", "pending", "verified", "rejected"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
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
        <div className="space-y-3">
          {payments.map(payment => {
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
                      <a href={payment.proofUrl} target="_blank" rel="noreferrer"
                        className="w-9 h-9 rounded-xl bg-[#F0F2FF] hover:bg-[#EEF0FF] flex items-center justify-center transition-colors"
                        data-testid={`button-view-proof-${payment.id}`}>
                        <ExternalLink className="w-4 h-4 text-[#2D3199]" />
                      </a>
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
    </div>
  );
}
