import { useState, useEffect, useCallback } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import PassengerForm, { type PassengerData } from "@/components/flights/PassengerForm";
import PriceBreakdown from "@/components/flights/PriceBreakdown";

const EXCHANGE_RATE = 1818.56;

export default function FlightCheckout() {
  const [, params] = useRoute("/checkout/:offerId");
  const search = useSearch();
  const [, setLocation] = useLocation();
  const offerId = params?.offerId || "";

  const [offer, setOffer] = useState<any>(null);
  const [loadingOffer, setLoadingOffer] = useState(true);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [passengerData, setPassengerData] = useState<PassengerData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Try to load offer from sessionStorage first, then API
  const loadOffer = useCallback(async () => {
    setLoadingOffer(true);
    setOfferError(null);

    // Try sessionStorage
    try {
      const cached = sessionStorage.getItem("flight_offers");
      if (cached) {
        const map = JSON.parse(cached);
        if (map[offerId]) {
          setOffer(map[offerId]);
          setLoadingOffer(false);
          return;
        }
      }
    } catch {
      // ignore
    }

    // Fetch from API
    try {
      const res = await fetch(`/api/flights/offers/${offerId}`);
      if (!res.ok) throw new Error(`Failed to load offer (${res.status})`);
      const data = await res.json();
      setOffer(data.offer || data.data || data);
    } catch (err: any) {
      setOfferError(err.message);
    } finally {
      setLoadingOffer(false);
    }
  }, [offerId]);

  useEffect(() => {
    if (offerId) loadOffer();
  }, [offerId, loadOffer]);

  // Handle Paystack redirect callback
  useEffect(() => {
    const urlParams = new URLSearchParams(search);
    const reference = urlParams.get("reference");
    if (reference && passengerData) {
      verifyAndCheckout(reference);
    }
  }, [search]);

  async function verifyAndCheckout(reference: string) {
    setIsProcessing(true);
    setPaymentError(null);

    try {
      // Verify payment
      const verifyRes = await fetch(`/api/flights/paystack/verify?reference=${reference}`);
      if (!verifyRes.ok) throw new Error("Payment verification failed");
      const verifyData = await verifyRes.json();

      if (verifyData.status !== "success" && verifyData.data?.status !== "success") {
        throw new Error("Payment was not successful");
      }

      // Complete checkout
      const checkoutRes = await fetch("/api/flights/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offer_id: offerId,
          passenger: passengerData,
          payment_reference: reference,
        }),
      });

      if (!checkoutRes.ok) throw new Error("Checkout failed");
      const checkoutData = await checkoutRes.json();
      const bookingId = checkoutData.booking_id || checkoutData.id || checkoutData.data?.id || "success";

      setLocation(`/flights/confirmation/${bookingId}`);
    } catch (err: any) {
      setPaymentError(err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handlePassengerSubmit(data: PassengerData) {
    setPassengerData(data);
    setIsProcessing(true);
    setPaymentError(null);

    try {
      const priceGBP = parseFloat(offer?.total_amount || "0");
      const amountNGN = Math.round(priceGBP * EXCHANGE_RATE * 100); // Paystack expects kobo

      const res = await fetch("/api/flights/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          amount: amountNGN,
          offer_id: offerId,
          callback_url: window.location.href,
          metadata: {
            passenger_name: `${data.given_name} ${data.family_name}`,
            offer_id: offerId,
          },
        }),
      });

      if (!res.ok) throw new Error("Failed to initialize payment");
      const payData = await res.json();
      const authUrl = payData.authorization_url || payData.data?.authorization_url;

      if (!authUrl) throw new Error("No payment URL received");

      // Redirect to Paystack
      window.location.href = authUrl;
    } catch (err: any) {
      setPaymentError(err.message);
      setIsProcessing(false);
    }
  }

  function handlePay() {
    // This is triggered from PriceBreakdown — scroll to form or focus it
    const form = document.querySelector("form");
    if (form) {
      form.scrollIntoView({ behavior: "smooth", block: "center" });
      const firstInput = form.querySelector("input");
      firstInput?.focus();
    }
  }

  if (loadingOffer) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (offerError || !offer) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-12 text-center max-w-md mx-auto"
      >
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7 text-destructive" />
        </div>
        <h3 className="text-lg font-bold mb-1">Offer not found</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {offerError || "This offer may have expired. Please search again."}
        </p>
        <Button onClick={() => setLocation("/flights")} variant="outline" className="rounded-xl">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Search
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={() => setLocation("/flights")}
        className="text-muted-foreground hover:text-foreground rounded-xl"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Search Results
      </Button>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-black tracking-tight">Complete Your Booking</h1>
        <p className="text-sm text-muted-foreground font-medium mt-1">
          Enter passenger details and proceed to payment
        </p>
      </motion.div>

      {/* Payment Error */}
      {paymentError && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl p-4 border-destructive/30 bg-destructive/5"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-bold text-destructive">Payment Error</p>
              <p className="text-xs text-muted-foreground">{paymentError}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Content: form + price */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <PassengerForm onSubmit={handlePassengerSubmit} isLoading={isProcessing} />
        </div>
        <div className="lg:col-span-2">
          <PriceBreakdown
            offer={offer}
            exchangeRate={EXCHANGE_RATE}
            onPay={handlePay}
            isLoading={isProcessing}
          />
        </div>
      </div>
    </div>
  );
}
