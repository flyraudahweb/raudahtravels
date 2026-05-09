import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useGetBooking, useCreatePayment } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Building2, Banknote, CheckCircle2, CalendarDays, Users, ChevronLeft, Printer } from "lucide-react";
import { printReceipt } from "@/utils/printReceipt";

declare global {
  interface Window {
    PaystackPop?: new () => {
      resumeTransaction(
        accessCode: string,
        options?: {
          onSuccess?: (transaction: { reference: string }) => void;
          onCancel?: () => void;
          onError?: (error: Error) => void;
        }
      ): void;
    };
  }
}

type PayMethod = "online" | "bank_transfer" | "cash";

export default function DashboardPayExisting() {
  const [, params] = useRoute("/dashboard/bookings/:id/pay");
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { toast } = useToast();

  const bookingId = params?.id ?? "";
  const { data: booking, isLoading } = useGetBooking(bookingId);

  const [method, setMethod] = useState<PayMethod>("online");
  const [reference, setReference] = useState("");
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [doneMethod, setDoneMethod] = useState<PayMethod>("online");
  const [donePaymentRef, setDonePaymentRef] = useState<string | undefined>();
  const [donePaymentId, setDonePaymentId] = useState<string | undefined>();

  const createPayment = useCreatePayment();
  const paystackScriptLoaded = useRef(false);

  const { data: bankData } = useQuery<{ accounts: Array<{ id: string; bankName: string; accountName: string; accountNumber: string }> }>({
    queryKey: ["bank-accounts-public"],
    queryFn: () => fetch("/api/bank-accounts").then(r => r.json()),
    staleTime: 60000,
  });
  const primaryBank = bankData?.accounts?.[0];

  useEffect(() => {
    if (!paystackScriptLoaded.current) {
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v2/inline.js";
      script.async = true;
      document.body.appendChild(script);
      paystackScriptLoaded.current = true;
    }
  }, []);

  const totalPrice = booking ? Number(booking.totalPrice) : 0;
  const amountPaid = booking ? Number(booking.amountPaid) : 0;
  const amountDue = totalPrice - amountPaid;

  const handlePaystackPayment = async () => {
    try {
      const email = user?.primaryEmailAddress?.emailAddress ?? "";
      const res = await fetch("/api/payments/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bookingId, email }),
      });
      if (!res.ok) throw new Error("Failed to initialize payment");
      const data = await res.json() as { accessCode: string; reference: string };
      if (!window.PaystackPop) throw new Error("Paystack script not loaded");

      const popup = new window.PaystackPop();
      popup.resumeTransaction(data.accessCode, {
        onSuccess: async (transaction) => {
          try {
            const verifyRes = await fetch("/api/payments/paystack/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ reference: transaction.reference }),
            });
            if (!verifyRes.ok) {
              const err = await verifyRes.json() as { error?: string };
              throw new Error(err.error ?? "Verification failed");
            }
          } catch {
            toast({
              title: "Payment received but unconfirmed",
              description: "We received your payment but could not confirm it immediately. Our team will verify it shortly.",
            });
          }
          setDonePaymentRef(transaction.reference);
          setDoneMethod("online");
          setDone(true);
          setProcessing(false);
        },
        onCancel: () => {
          toast({
            title: "Payment not completed",
            description: "No payment was taken. You can try again or choose a different method.",
          });
          setProcessing(false);
        },
        onError: () => {
          toast({ title: "Payment error", description: "Something went wrong. Please try again or choose bank transfer.", variant: "destructive" });
          setProcessing(false);
        },
      });
    } catch {
      toast({ title: "Payment error", description: "Could not launch payment. Please try bank transfer.", variant: "destructive" });
      setProcessing(false);
    }
  };

  const handleSubmit = async () => {
    if (processing) return;
    setProcessing(true);

    if (method === "online") {
      await handlePaystackPayment();
      return;
    }

    createPayment.mutate(
      { data: { bookingId, amount: amountDue, method, reference, notes: "" } },
      {
        onSuccess: (res) => {
          setDonePaymentId((res as any)?.id ?? (res as any)?.payment?.id);
          setDonePaymentRef(reference || undefined);
          setDoneMethod(method);
          setDone(true);
          setProcessing(false);
        },
        onError: () => {
          toast({ title: "Submission failed", description: "Could not submit your payment. Please try again.", variant: "destructive" });
          setProcessing(false);
        },
      }
    );
  };

  if (isLoading) return (
    <div className="space-y-4 max-w-xl mx-auto">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-48 w-full" />
    </div>
  );

  if (!booking) return (
    <div className="text-center py-12 text-muted-foreground">Booking not found.</div>
  );

  if (booking.status === "confirmed") return (
    <div className="max-w-xl mx-auto text-center py-16 space-y-4">
      <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
      <h2 className="text-2xl font-bold font-serif text-primary">Already Confirmed</h2>
      <p className="text-muted-foreground">This booking has already been fully paid and confirmed.</p>
      <Button onClick={() => setLocation("/dashboard/bookings")}>Back to Bookings</Button>
    </div>
  );

  if (done) {
    const handlePrintDone = () => {
      printReceipt({
        id: donePaymentId ?? bookingId,
        amount: amountDue,
        method: doneMethod,
        status: doneMethod === "online" ? "verified" : "pending",
        reference: donePaymentRef,
        createdAt: new Date().toISOString(),
        pilgrimName: user?.fullName ?? undefined,
        packageName: (booking as any)?.package?.name,
        departureDate: (booking as any)?.package?.departureDate,
        bookingId,
      });
    };

    return (
      <div className="max-w-xl mx-auto py-12 space-y-0">
        {/* Success card */}
        <div className="bg-white rounded-3xl border border-[#DCE3F0] shadow-[0_8px_40px_rgba(45,49,153,0.08)] overflow-hidden">
          {/* Green header */}
          <div className={`px-8 pt-10 pb-8 text-center ${doneMethod === "online" ? "bg-gradient-to-br from-emerald-500 to-emerald-600" : "bg-gradient-to-br from-[#2D3199] to-[#4C56B8]"}`}>
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9 text-white" />
            </div>
            <h2 className="text-2xl font-black text-white">
              {doneMethod === "online" ? "Payment Confirmed!" : "Payment Submitted!"}
            </h2>
            <p className="text-white/80 text-sm mt-2">
              {doneMethod === "online"
                ? "Your payment was processed successfully via Paystack."
                : "Our team will verify your payment within 24 hours."}
            </p>
          </div>

          {/* Payment summary */}
          <div className="px-8 py-6 space-y-3 border-b border-[#F1F5F9]">
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#64748B]">Amount</span>
              <span className="font-black text-[#0F172A] text-lg">₦{amountDue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#64748B]">Method</span>
              <span className="font-semibold text-[#334155] capitalize">{doneMethod === "bank_transfer" ? "Bank Transfer" : doneMethod === "online" ? "Online (Paystack)" : "Cash"}</span>
            </div>
            {donePaymentRef && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#64748B]">Reference</span>
                <span className="font-mono text-sm text-[#2D3199] font-bold">{donePaymentRef}</span>
              </div>
            )}
            {(booking as any)?.package?.name && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#64748B]">Package</span>
                <span className="font-semibold text-[#334155] text-right max-w-[60%]">{(booking as any).package.name}</span>
              </div>
            )}
          </div>

          {/* Islamic message */}
          <div className="px-8 py-5 bg-[#FAFBFF] text-center">
            <p className="text-[#64748B] text-xs mt-1.5">
              {doneMethod === "online"
                ? "May Allah accept your Hajj/Umrah and grant you a blessed journey."
                : "We've received your submission. Our team will confirm shortly, insha'Allah."}
            </p>
          </div>

          {/* Actions */}
          <div className="px-8 pb-8 pt-5 flex flex-col gap-3">
            <button onClick={handlePrintDone}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#2D3199] hover:bg-[#1C1F66] text-white font-bold rounded-xl text-sm transition-colors">
              <Printer className="w-4 h-4" /> Print Receipt
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setLocation("/dashboard/payments")}
                className="py-2.5 rounded-xl border border-[#DCE3F0] text-sm font-semibold text-[#64748B] hover:bg-[#F8FAFC] transition-colors">
                View Payments
              </button>
              <button onClick={() => setLocation("/dashboard/bookings")}
                className="py-2.5 rounded-xl border border-[#2D3199] bg-[#EEF0FF] text-[#2D3199] text-sm font-bold hover:bg-[#E0E4FF] transition-colors">
                My Bookings
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/dashboard/bookings")} className="gap-1.5">
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold font-serif text-primary">Complete Payment</h1>
        <p className="text-muted-foreground text-sm mt-1">Choose how you'd like to pay for your booking</p>
      </div>

      {/* Booking summary */}
      <Card className="border-primary/20">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-primary truncate">{(booking as any).package?.name ?? "Package"}</h3>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />
                  {(booking as any).package?.departureDate
                    ? new Date((booking as any).package.departureDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
                    : "TBC"}
                </span>
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />
                  {booking.pilgrimCount} pilgrim{Number(booking.pilgrimCount) !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <Badge variant="outline" className="capitalize shrink-0">{booking.status}</Badge>
          </div>
          <div className="border-t border-border pt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total price</span>
              <span className="font-medium">₦{totalPrice.toLocaleString()}</span>
            </div>
            {amountPaid > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Already paid</span>
                <span>−₦{amountPaid.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-primary border-t border-border pt-2 mt-2">
              <span>Amount due</span>
              <span>₦{amountDue.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment method selection */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Payment Method</Label>
        <div className="grid grid-cols-3 gap-3">
          {([
            { value: "online" as const,        label: "Pay Online",      sub: "Cards & transfers", icon: CreditCard, highlight: true  },
            { value: "bank_transfer" as const,  label: "Bank Transfer",   sub: "Manual transfer",   icon: Building2,  highlight: false },
            { value: "cash" as const,           label: "Cash at Office",  sub: "Pay in person",     icon: Banknote,   highlight: false },
          ]).map(({ value, label, sub, icon: Icon, highlight }) => (
            <button key={value} type="button"
              onClick={() => setMethod(value)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center cursor-pointer ${
                method === value
                  ? highlight ? "border-accent bg-accent/10 text-accent" : "border-primary bg-primary/5 text-primary"
                  : "border-muted hover:border-primary/40"
              }`}>
              <Icon className={`w-5 h-5 ${method === value ? (highlight ? "text-accent" : "text-primary") : "text-muted-foreground"}`} />
              <span className="font-semibold text-xs">{label}</span>
              <span className="text-[10px] text-muted-foreground">{sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bank transfer reference field */}
      {method === "bank_transfer" && (
        <div className="space-y-2">
          <Label htmlFor="reference">Transfer Reference (optional)</Label>
          <Input
            id="reference"
            placeholder="e.g. bank teller number or transaction ID"
            value={reference}
            onChange={e => setReference(e.target.value)}
          />
          <div className="text-xs text-muted-foreground space-y-0.5">
            {primaryBank ? (
              <>
                <p><span className="font-medium text-foreground">Bank:</span> {primaryBank.bankName}</p>
                <p><span className="font-medium text-foreground">Account Name:</span> {primaryBank.accountName}</p>
                <p><span className="font-medium text-foreground">Account Number:</span> <strong className="font-mono text-foreground">{primaryBank.accountNumber}</strong></p>
              </>
            ) : null}
            <p className="mt-1">Transfer ₦{amountDue.toLocaleString()} and use your name as the transfer description. Our team will verify and confirm within 24 hours.</p>
          </div>
        </div>
      )}

      {method === "cash" && (
        <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
          Visit our office to pay ₦{amountDue.toLocaleString()} in cash. Your booking will be confirmed upon receipt.
        </p>
      )}

      <Button
        onClick={handleSubmit}
        disabled={processing}
        className="w-full bg-accent hover:bg-accent/90 text-white font-semibold py-6 text-base"
      >
        {processing ? "Processing…" : method === "online" ? `Pay ₦${amountDue.toLocaleString()} Now` : "Submit Payment"}
      </Button>
    </div>
  );
}
