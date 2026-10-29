import { Check, Circle, Clock3 } from "lucide-react";

export function bookingState(booking: any) {
  const expired =
    booking.status === "payment_pending" &&
    Date.parse(booking.expiresAt) <= Date.now();
  if (expired)
    return {
      label: "Checkout expired",
      tone: "bg-slate-100 text-slate-700",
      next: "Search again for current availability. If you already paid, check payment status on this booking.",
      action: "View checkout",
    };
  const states: Record<
    string,
    { label: string; tone: string; next: string; action: string }
  > = {
    payment_pending: {
      label: "Awaiting payment",
      tone: "bg-amber-50 text-amber-900",
      next: "Complete payment before your offer expires. Your reservation is confirmed only after supplier confirmation.",
      action: "Continue payment",
    },
    processing: {
      label: "Confirming reservation",
      tone: "bg-blue-50 text-blue-800",
      next: "Payment received. We are confirming with the supplier. Please do not pay again.",
      action: "Track confirmation",
    },
    confirmed: {
      label: "Confirmed",
      tone: "bg-emerald-50 text-emerald-800",
      next: "Check your itinerary, traveller names and travel documents before departure.",
      action: "Manage booking",
    },
    requires_review: {
      label: "Under review",
      tone: "bg-amber-50 text-amber-900",
      next: "Our travel team needs to check your reservation. Please do not pay again. Contact us with your reference.",
      action: "View next steps",
    },
    cancelled: {
      label: "Cancelled",
      tone: "bg-rose-50 text-rose-800",
      next: "Contact the travel team to review your options and any applicable refund.",
      action: "Review cancellation",
    },
    refunded: {
      label: "Refund verified",
      tone: "bg-slate-100 text-slate-700",
      next: "Your full refund was verified with the payment provider. Your bank determines when funds appear.",
      action: "View refund details",
    },
  };
  return (
    states[booking.status] || {
      label: "Status unavailable",
      tone: "bg-slate-100 text-slate-700",
      next: "Contact the travel team for help.",
      action: "View booking",
    }
  );
}

export function BookingStatus({ booking }: { booking: any }) {
  const state = bookingState(booking);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${state.tone}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {state.label}
    </span>
  );
}

export function BookingSteps({ step }: { step: number }) {
  return (
    <ol
      aria-label="Booking progress"
      className="mb-7 grid grid-cols-4 gap-2 print:hidden"
    >
      {["Choose trip", "Traveller details", "Payment", "Confirmation"].map(
        (label, index) => (
          <li
            key={label}
            aria-current={index === step ? "step" : undefined}
            className={`border-t-2 pt-3 text-xs sm:text-sm ${index <= step ? "border-indigo-600 text-indigo-900" : "border-slate-200 text-slate-500"}`}
          >
            <span className="mb-1 flex items-center gap-2 font-semibold">
              {index < step ? (
                <Check size={14} />
              ) : index === step ? (
                <Clock3 size={14} />
              ) : (
                <Circle size={14} />
              )}
              <span className="hidden sm:inline">Step {index + 1}</span>
            </span>
            {label}
          </li>
        ),
      )}
    </ol>
  );
}

export function tripTitle(b: any) {
  const offer = b.providerResult || b.offer || {};
  const slice = offer.slices?.[0] || b.offer?.slices?.[0];
  return b.kind === "flight"
    ? `${slice?.origin?.iata_code || "Departure"} → ${slice?.destination?.iata_code || "Destination"}`
    : b.offer?.accommodation?.name || "Hotel reservation";
}

export function tripDates(b: any) {
  if (b.kind === "hotel")
    return `${b.offer?.check_in_date || ""} – ${b.offer?.check_out_date || ""}`;
  const slices = (b.providerResult || b.offer)?.slices || [];
  return slices
    .map((s: any) => s.segments?.[0]?.departing_at?.slice(0, 10))
    .filter(Boolean)
    .join(" · ");
}
