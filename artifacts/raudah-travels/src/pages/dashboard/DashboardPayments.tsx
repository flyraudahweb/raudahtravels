import { useListPayments, getListPaymentsQueryKey, useListBookings, getListBookingsQueryKey, useCreatePayment } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CreditCard, Clock, CheckCircle2, XCircle, Plus, Printer, Building2, Banknote, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useListPayments({}, { query: { queryKey: getListPaymentsQueryKey({}) } });
  const { data: bookingsData } = useListBookings({}, { query: { queryKey: getListBookingsQueryKey({}) } });
  const createPayment = useCreatePayment();

  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ bookingId: "", amount: "", method: "bank_transfer", reference: "", notes: "" });

  const allPayments = data?.payments || [];
  const bookings = bookingsData?.bookings || [];

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

  const parsedAmount = Number(form.amount);
  const formValid = form.bookingId.trim() !== "" && !isNaN(parsedAmount) && parsedAmount > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.bookingId.trim()) {
      toast({ title: "Select a booking", variant: "destructive" }); return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" }); return;
    }
    createPayment.mutate(
      { data: { bookingId: form.bookingId, amount: parsedAmount, method: form.method as "bank_transfer" | "cash", reference: form.reference, notes: form.notes } },
      {
        onSuccess: () => {
          toast({ title: "Payment submitted", description: "Awaiting verification from our team." });
          qc.invalidateQueries({ queryKey: getListPaymentsQueryKey({}) });
          setOpen(false);
          setForm({ bookingId: "", amount: "", method: "bank_transfer", reference: "", notes: "" });
        },
        onError: () => toast({ title: "Could not submit payment", variant: "destructive" }),
      }
    );
  };

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
          <p className="text-[#64748B] text-sm mt-0.5">View and submit your payment records</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-2 bg-[#FF3B00] hover:bg-[#D63200] text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
              data-testid="button-add-payment">
              <Plus className="w-4 h-4" /> Record Payment
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#F1F5F9]">
              <DialogTitle className="font-black text-[#0F172A]">Record a Payment</DialogTitle>
              <p className="text-[#94A3B8] text-sm mt-0.5">Submit a bank transfer or cash payment for verification</p>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Booking</Label>
                <Select value={form.bookingId} onValueChange={v => setForm(f => ({ ...f, bookingId: v }))}>
                  <SelectTrigger className="mt-1.5 rounded-xl border-[#DCE3F0]" data-testid="select-booking">
                    <SelectValue placeholder="Select booking" />
                  </SelectTrigger>
                  <SelectContent>
                    {bookings.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.package?.name || b.id.slice(0, 8)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Amount (₦)</Label>
                  <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="500000" className="mt-1.5 rounded-xl border-[#DCE3F0]"
                    data-testid="input-amount" />
                </div>
                <div>
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Method</Label>
                  <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v }))}>
                    <SelectTrigger className="mt-1.5 rounded-xl border-[#DCE3F0]" data-testid="select-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.method === "bank_transfer" && (
                <div className="bg-[#EEF0FF] rounded-xl p-4 border border-[#C7CCF5] space-y-1.5">
                  <p className="text-xs font-black text-[#2D3199] uppercase tracking-wider mb-2">Bank Details</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#64748B]">Bank</span>
                    <span className="font-semibold text-[#0F172A]">GTBank</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#64748B]">Account Name</span>
                    <span className="font-semibold text-[#0F172A]">Raudah Travels & Tours Ltd</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#64748B]">Account No</span>
                    <span className="font-black text-[#2D3199] font-mono">0123456789</span>
                  </div>
                </div>
              )}
              <div>
                <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Transaction Reference</Label>
                <Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                  placeholder="e.g. FT234567890"
                  className="mt-1.5 rounded-xl border-[#DCE3F0]" data-testid="input-reference" />
              </div>
              <div>
                <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Notes (optional)</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional notes"
                  className="mt-1.5 rounded-xl border-[#DCE3F0] resize-none"
                  rows={2} data-testid="input-notes" />
              </div>
              <button type="submit" disabled={createPayment.isPending || !formValid}
                className="w-full py-3 bg-[#2D3199] hover:bg-[#1C1F66] text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50"
                data-testid="button-submit-payment">
                {createPayment.isPending ? "Submitting…" : "Submit Payment"}
              </button>
            </form>
          </DialogContent>
        </Dialog>
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
