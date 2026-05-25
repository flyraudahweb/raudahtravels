import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { BookOpen, CalendarDays, Users, UserPlus, ChevronLeft, ChevronRight, Plus, History, CreditCard, Upload, Wallet, FileText, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { uploadFile } from "@/lib/upload";



function ProofUploadBox({ value, onChange, onError }: { value: string; onChange: (v: string) => void; onError?: (msg: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      onError?.(`File too large (${(file.size / 1024).toFixed(0)}KB). Maximum size is 3MB.`);
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const url = await uploadFile(file, "receipts");
      onChange(url);
    } catch (err: any) {
      onError?.(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
    e.target.value = "";
  };
  const isImage = value && (value.startsWith("data:image") || /\.(jpg|jpeg|png|webp)$/i.test(value));
  return (
    <div>
      <Label className="text-xs font-bold text-[#64748B]">Payment Receipt / Proof <span className="text-red-500">*</span></Label>
      <div className="mt-1">
        {value ? (
          <div className="rounded-xl border-2 border-[#2D3199] overflow-hidden bg-[#EEF0FF]">
            {isImage ? (
              <img src={value} alt="proof" className="w-full h-24 object-cover" />
            ) : (
              <div className="flex items-center gap-3 p-3">
                <FileText className="w-5 h-5 text-[#2D3199]" />
                <p className="text-xs font-bold text-[#2D3199]">File uploaded</p>
              </div>
            )}
            <div className="flex gap-2 px-3 py-2 border-t border-[#C7CCF5]">
              <button type="button" onClick={() => inputRef.current?.click()} className="text-[10px] font-bold text-[#2D3199]">
                <Upload className="w-3 h-3 inline mr-1" />Change
              </button>
              <span className="text-[#C7CCF5]">·</span>
              <button type="button" onClick={() => { onChange(""); if (inputRef.current) inputRef.current.value = ""; }} className="text-[10px] font-bold text-red-500">
                <X className="w-3 h-3 inline mr-1" />Remove
              </button>
            </div>
          </div>
        ) : uploading ? (
          <div className="w-full rounded-xl border-2 border-dashed border-[#2D3199]/40 bg-[#EEF0FF] p-3 flex flex-col items-center gap-1 text-center">
            <svg className="animate-spin w-5 h-5 text-[#2D3199]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
            <span className="text-xs font-semibold text-[#2D3199]">Uploading...</span>
          </div>
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-[#DCE3F0] hover:border-[#2D3199]/40 bg-[#F8FAFC] hover:bg-[#EEF0FF] transition-all p-3 flex flex-col items-center gap-1 text-center">
            <Upload className="w-4 h-4 text-[#94A3B8]" />
            <span className="text-xs font-semibold text-[#64748B]">Upload receipt or screenshot</span>
            <span className="text-[10px] text-[#94A3B8]">Max 3MB · Images or PDF</span>
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*,.pdf" onChange={handleFile} className="hidden" />
      </div>
    </div>
  );
}

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

interface PaymentRecord {
  id: string;
  amount: number;
  method: string;
  status: string;
  reference?: string;
  notes?: string;
  createdAt: string;
}

export default function AgentBookings() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // Record Payment state
  const [recordPayBooking, setRecordPayBooking] = useState<AgentClient | null>(null);
  const [recordPayAmount, setRecordPayAmount] = useState("");
  const [recordPayMethod, setRecordPayMethod] = useState<"cash" | "bank_transfer" | "wallet">("bank_transfer");
  const [recordPayRef, setRecordPayRef] = useState("");
  const [recordPayNotes, setRecordPayNotes] = useState("");
  const [recordPayProof, setRecordPayProof] = useState("");
  const [recordPayLoading, setRecordPayLoading] = useState(false);

  // Payment History state
  const [historyBookingId, setHistoryBookingId] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<PaymentRecord[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Agent wallet balance
  const { data: walletData } = useQuery<{ balance: number }>({
    queryKey: ["agent-wallet"],
    queryFn: () => fetch("/api/agents/wallet", { credentials: "include" }).then(r => r.json()),
    staleTime: 30000,
  });
  const walletBalance = walletData?.balance ?? 0;

  const openRecordPayment = (b: AgentClient) => {
    const balance = b.totalPrice - b.amountPaid;
    setRecordPayBooking(b);
    setRecordPayAmount(balance > 0 ? balance.toString() : "");
    setRecordPayMethod("bank_transfer");
    setRecordPayRef("");
    setRecordPayNotes("");
    setRecordPayProof("");
  };

  const handleSubmitPayment = async () => {
    if (!recordPayBooking) return;
    const amount = parseFloat(recordPayAmount);
    if (!amount || amount <= 0) {
      toast({ title: "Invalid amount", description: "Please enter a valid payment amount.", variant: "destructive" });
      return;
    }
    // Require proof for bank transfer
    if (recordPayMethod === "bank_transfer" && !recordPayProof) {
      toast({ title: "Receipt required", description: "Please upload a payment receipt for bank transfer.", variant: "destructive" });
      return;
    }
    // Check wallet balance
    if (recordPayMethod === "wallet" && walletBalance < amount) {
      toast({ title: "Insufficient balance", description: `Wallet balance ₦${walletBalance.toLocaleString()} is less than ₦${amount.toLocaleString()}.`, variant: "destructive" });
      return;
    }
    setRecordPayLoading(true);
    try {
      const res = await fetch("/api/payments/admin-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          bookingId: recordPayBooking.id,
          amount,
          method: recordPayMethod,
          reference: recordPayRef || undefined,
          proofUrl: recordPayProof || undefined,
          notes: recordPayNotes || undefined,
          markVerified: false,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to record payment" }));
        throw new Error(err.message || err.error || "Failed to record payment");
      }
      const isWallet = recordPayMethod === "wallet";
      toast({
        title: isWallet ? "Payment processed" : "Payment submitted",
        description: isWallet
          ? `₦${amount.toLocaleString()} debited from your wallet and verified.`
          : "Payment has been submitted for admin verification.",
      });
      queryClient.invalidateQueries({ queryKey: ["agent-clients-bookings"] });
      if (isWallet) queryClient.invalidateQueries({ queryKey: ["agent-wallet"] });
      setRecordPayBooking(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setRecordPayLoading(false);
    }
  };

  const openPaymentHistory = async (bookingId: string) => {
    setHistoryBookingId(bookingId);
    setHistoryData(null);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/payments/booking/${bookingId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load payment history");
      const json = await res.json();
      setHistoryData(json.payments || json || []);
    } catch {
      toast({ title: "Error", description: "Could not load payment history.", variant: "destructive" });
      setHistoryBookingId(null);
    } finally {
      setHistoryLoading(false);
    }
  };

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
                        {b.totalPrice > b.amountPaid && (
                          <div className="flex items-center gap-2 mt-2">
                            <Button
                              size="sm"
                              className="bg-[#FF3B00] hover:bg-[#D63200] text-white rounded-lg text-[11px] font-bold h-7 px-2.5 gap-1"
                              onClick={() => openRecordPayment(b)}
                            >
                              <Plus className="w-3.5 h-3.5" /> Add Payment
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg text-[11px] font-bold h-7 px-2.5 gap-1 border-[#E2E8F0] text-[#64748B] hover:text-[#2D3199] hover:border-[#2D3199]/40"
                              onClick={() => openPaymentHistory(b.id)}
                            >
                              <History className="w-3.5 h-3.5" /> View History
                            </Button>
                          </div>
                        )}
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

      {/* Record Payment Dialog */}
      <Dialog open={!!recordPayBooking} onOpenChange={(open) => { if (!open) setRecordPayBooking(null); }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-black text-[#1C1F66] text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#2D3199]" /> Record Payment
            </DialogTitle>
          </DialogHeader>
          {recordPayBooking && (() => {
            const balance = recordPayBooking.totalPrice - recordPayBooking.amountPaid;
            return (
            <div className="space-y-4 mt-2">
              <div className="bg-[#F0F2FF] rounded-xl p-3">
                <p className="text-sm font-black text-[#1C1F66]">{recordPayBooking.fullName}</p>
                <p className="text-xs text-[#64748B] font-mono mt-0.5">{recordPayBooking.reference}</p>
                <p className="text-xs text-[#2D3199] font-bold mt-1">
                  Balance: ₦{balance.toLocaleString()}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-[#64748B]">Payment Method</Label>
                <Select value={recordPayMethod} onValueChange={(v) => setRecordPayMethod(v as "cash" | "bank_transfer" | "wallet")}>
                  <SelectTrigger className="rounded-xl border-[#E2E8F0]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wallet">
                      <span className="flex items-center gap-2">
                        <Wallet className="w-3.5 h-3.5 text-emerald-600" /> Wallet (₦{walletBalance.toLocaleString()})
                      </span>
                    </SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash (Office Visit)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Wallet balance indicator */}
              {recordPayMethod === "wallet" && (
                <div className={`rounded-xl px-3 py-2 border ${walletBalance >= parseFloat(recordPayAmount || "0") ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                  <p className={`text-[11px] font-bold ${walletBalance >= parseFloat(recordPayAmount || "0") ? "text-emerald-700" : "text-red-700"}`}>
                    <Wallet className="w-3.5 h-3.5 inline mr-1" />
                    Wallet Balance: ₦{walletBalance.toLocaleString()}
                    {walletBalance < parseFloat(recordPayAmount || "0") && " — Insufficient funds"}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-bold text-[#64748B]">Amount (₦)</Label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={recordPayAmount}
                  onChange={(e) => setRecordPayAmount(e.target.value)}
                  className="rounded-xl border-[#E2E8F0] focus:border-[#2D3199]"
                />
              </div>

              {/* Receipt upload for bank transfer */}
              {recordPayMethod === "bank_transfer" && (
                <ProofUploadBox value={recordPayProof} onChange={setRecordPayProof} onError={(msg) => toast({ title: "File too large", description: msg, variant: "destructive" })} />
              )}

              {recordPayMethod !== "wallet" && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-[#64748B]">Reference <span className="text-[#94A3B8] font-normal">(optional)</span></Label>
                  <Input
                    placeholder="Transaction reference"
                    value={recordPayRef}
                    onChange={(e) => setRecordPayRef(e.target.value)}
                    className="rounded-xl border-[#E2E8F0] focus:border-[#2D3199]"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-bold text-[#64748B]">Notes <span className="text-[#94A3B8] font-normal">(optional)</span></Label>
                <Textarea
                  placeholder="Add notes..."
                  value={recordPayNotes}
                  onChange={(e) => setRecordPayNotes(e.target.value)}
                  className="rounded-xl border-[#E2E8F0] focus:border-[#2D3199] resize-none"
                  rows={2}
                />
              </div>

              {/* Status message based on method */}
              {recordPayMethod === "wallet" ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  <p className="text-[11px] text-emerald-700 font-semibold">✓ Wallet payments are auto-verified — balance will be deducted instantly</p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  <p className="text-[11px] text-amber-700 font-semibold">Payment will be submitted for admin verification</p>
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl border-[#E2E8F0] text-[#64748B] font-bold"
                  onClick={() => setRecordPayBooking(null)}
                  disabled={recordPayLoading}
                >
                  Cancel
                </Button>
                <Button
                  className={`flex-1 rounded-xl font-black gap-2 ${recordPayMethod === "wallet" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-[#2D3199] hover:bg-[#1C1F66] text-white"}`}
                  onClick={handleSubmitPayment}
                  disabled={recordPayLoading || (recordPayMethod === "wallet" && walletBalance < parseFloat(recordPayAmount || "0"))}
                >
                  {recordPayLoading ? "Processing..." : recordPayMethod === "wallet" ? "Pay from Wallet" : "Submit Payment"}
                </Button>
              </div>
            </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={!!historyBookingId} onOpenChange={(open) => { if (!open) { setHistoryBookingId(null); setHistoryData(null); } }}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-black text-[#1C1F66] text-lg flex items-center gap-2">
              <History className="w-5 h-5 text-[#2D3199]" /> Payment History
            </DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <div className="space-y-3 mt-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : historyData && historyData.length > 0 ? (
            (() => {
              const hBooking = bookings.find((b) => b.id === historyBookingId);
              return (
                <div className="space-y-4 mt-2">
                  {hBooking && (
                    <div className="bg-[#F0F2FF] rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-black text-[#1C1F66]">{hBooking.fullName}</p>
                          <p className="text-xs text-[#64748B] font-mono mt-0.5">{hBooking.reference}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-[#94A3B8]">Total: <span className="font-bold text-[#1C1F66]">₦{hBooking.totalPrice.toLocaleString()}</span></p>
                          <p className="text-xs text-[#94A3B8]">Paid: <span className="font-bold text-emerald-600">₦{hBooking.amountPaid.toLocaleString()}</span></p>
                          <p className="text-xs text-[#94A3B8]">Balance: <span className="font-bold text-[#FF3B00]">₦{(hBooking.totalPrice - hBooking.amountPaid).toLocaleString()}</span></p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {historyData.map((p) => {
                      const statusCfg =
                        p.status === "verified" ? { label: "Verified", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" } :
                        p.status === "rejected" ? { label: "Rejected", cls: "bg-red-100 text-red-700 border-red-200" } :
                        { label: "Pending", cls: "bg-amber-100 text-amber-700 border-amber-200" };
                      return (
                        <div key={p.id} className="bg-white border border-[#E2E8F0] rounded-xl p-3 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-sm font-black text-[#1C1F66]">₦{p.amount.toLocaleString()}</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border capitalize ${statusCfg.cls}`}>
                                {statusCfg.label}
                              </span>
                            </div>
                            <p className="text-xs text-[#94A3B8] capitalize">{p.method?.replace("_", " ")}</p>
                            {p.reference && <p className="text-[10px] text-[#CBD5E1] font-mono truncate">Ref: {p.reference}</p>}
                          </div>
                          <p className="text-[10px] text-[#CBD5E1] shrink-0">
                            {new Date(p.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center mb-3">
                <CreditCard className="w-5 h-5 text-[#CBD5E1]" />
              </div>
              <p className="font-bold text-[#1C1F66] text-sm">No payments recorded</p>
              <p className="text-xs text-[#94A3B8] mt-1">No payment records found for this booking</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
