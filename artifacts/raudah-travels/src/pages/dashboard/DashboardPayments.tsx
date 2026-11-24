import { useListPayments, getListPaymentsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CreditCard, Clock, CheckCircle2, XCircle, Printer, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { printReceipt } from "@/utils/printReceipt";

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; icon: typeof Clock }> = {
  pending:  { label: "Pending",  bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",  icon: Clock },
  verified: { label: "Verified", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: CheckCircle2 },
  rejected: { label: "Rejected", bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200",    icon: XCircle },
};

const METHOD_CONFIG: Record<string, { label: string; icon: string; bg: string }> = {
  bank_transfer: { label: "Bank Transfer", icon: "🏦", bg: "bg-blue-50" },
  cash:          { label: "Cash",          icon: "💵", bg: "bg-green-50" },
  card:          { label: "Card",          icon: "💳", bg: "bg-purple-50" },
  online:        { label: "Online",        icon: "🔒", bg: "bg-indigo-50" },
  paystack:      { label: "Paystack",      icon: "🔒", bg: "bg-indigo-50" },
};

export default function DashboardPayments() {
  const { data, isLoading } = useListPayments({}, { query: { queryKey: getListPaymentsQueryKey({}) } });
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const allPayments = data?.payments || [];

  const payments = allPayments.filter(p => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        p.reference?.toLowerCase().includes(q) ||
        (p.booking as any)?.package?.name?.toLowerCase().includes(q) ||
        p.method.toLowerCase().includes(q) ||
        String(p.amount).includes(q)
      );
    }
    return true;
  });

  const handlePrint = (payment: typeof allPayments[0]) => {
    printReceipt({
      id: payment.id,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      reference: payment.reference,
      createdAt: payment.createdAt,
      notes: payment.notes,
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

  const totalVerified = allPayments.filter(p => p.status === "verified").reduce((s, p) => s + p.amount, 0);
  const totalPending = allPayments.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6" data-testid="page-dashboard-payments">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-[#2D3199] text-xs font-bold uppercase tracking-widest mb-1">Pilgrim Portal</p>
          <h1 className="text-2xl font-black text-[#0F172A]">Payments</h1>
          <p className="text-[#64748B] text-sm mt-0.5">View your payment history and receipts</p>
        </div>
        <Link href="/dashboard/bookings" className="flex items-center gap-2 rounded-xl bg-[#FF3B00] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#D63200]">
          <CreditCard className="h-4 w-4" /> Pay Online
        </Link>
      </div>

      {/* Summary */}
      {allPayments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-[#DCE3F0] p-4">
            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1">Total Paid</p>
            <p className="text-xl font-black text-[#2D3199]">₦{allPayments.reduce((s, p) => s + p.amount, 0).toLocaleString()}</p>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">{allPayments.length} payment{allPayments.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#DCE3F0] p-4">
            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1">Verified</p>
            <p className="text-xl font-black text-emerald-600">₦{totalVerified.toLocaleString()}</p>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">{allPayments.filter(p => p.status === "verified").length} confirmed</p>
          </div>
          <div className="col-span-2 sm:col-span-1 bg-white rounded-2xl border border-[#DCE3F0] p-4">
            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1">Pending</p>
            <p className="text-xl font-black text-amber-600">₦{totalPending.toLocaleString()}</p>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">{allPayments.filter(p => p.status === "pending").length} awaiting</p>
          </div>
        </div>
      )}

      {/* Search + Filter */}
      {allPayments.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by reference or package…"
              className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-[#DCE3F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#2D3199]/20 focus:border-[#2D3199]"
            />
          </div>
          <div className="flex gap-1.5 bg-white rounded-xl border border-[#DCE3F0] p-1">
            {["all", "pending", "verified", "rejected"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize whitespace-nowrap ${statusFilter === s ? "bg-[#2D3199] text-white" : "text-[#64748B] hover:text-[#2D3199]"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
      ) : allPayments.length === 0 ? (
        <div className="flex flex-col items-center py-14 text-center bg-white rounded-2xl border border-dashed border-[#DCE3F0]">
          <div className="w-14 h-14 bg-[#EEF0FF] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-7 h-7 text-[#2D3199]" />
          </div>
          <p className="font-black text-[#0F172A]">No payments recorded</p>
          <p className="text-sm text-[#64748B] mt-1">Record your first payment to get started</p>
        </div>
      ) : payments.length === 0 ? (
        <div className="py-10 text-center bg-white rounded-2xl border border-[#DCE3F0]">
          <Search className="w-8 h-8 text-[#94A3B8] mx-auto mb-3" />
          <p className="font-bold text-[#0F172A]">No payments match your filters</p>
          <button onClick={() => { setStatusFilter("all"); setSearch(""); }}
            className="mt-3 text-[#2D3199] text-sm font-bold hover:underline">Clear filters</button>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map(payment => {
            const c = STATUS_CONFIG[payment.status] || STATUS_CONFIG.pending;
            const StatusIcon = c.icon;
            const m = METHOD_CONFIG[payment.method] || { label: payment.method.replace(/_/g, " "), icon: "💰", bg: "bg-[#F0F2FF]" };
            return (
              <div key={payment.id} className="bg-white rounded-2xl border border-[#DCE3F0] p-5 hover:shadow-sm transition-shadow"
                data-testid={`card-payment-${payment.id}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 ${m.bg}`}>
                    {m.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-black text-[#0F172A] text-lg">₦{payment.amount.toLocaleString()}</p>
                      <span className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-bold border ${c.bg} ${c.text} ${c.border}`}>
                        <StatusIcon className="w-3 h-3" /> {c.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[#94A3B8]">
                      <span className="capitalize font-semibold text-[#64748B]">{m.label}</span>
                      <span>·</span>
                      <span>{new Date(payment.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                      {payment.reference && <><span>·</span><span className="font-mono">Ref: {payment.reference}</span></>}
                      {(payment.booking as any)?.package?.name && <><span>·</span><span>{(payment.booking as any).package.name}</span></>}
                    </div>
                  </div>
                  {/* Print receipt */}
                  <button onClick={() => handlePrint(payment)}
                    className="w-9 h-9 rounded-xl bg-[#EEF0FF] hover:bg-[#2D3199] group flex items-center justify-center transition-colors flex-shrink-0"
                    title="Print receipt">
                    <Printer className="w-4 h-4 text-[#2D3199] group-hover:text-white transition-colors" />
                  </button>
                </div>
                {payment.status === "pending" && (
                  <div className="mt-3 pt-3 border-t border-[#F1F5F9]">
                    <p className="text-xs text-amber-600 font-semibold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Awaiting verification from our team — usually within 24 hours.
                    </p>
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
