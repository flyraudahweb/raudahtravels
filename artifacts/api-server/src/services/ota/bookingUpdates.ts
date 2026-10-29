import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

// Only these customer-safe events leave the operational audit trail. Never expose
// raw webhook bodies, internal errors, credential events or operator notes.
export const bookingMessages: Record<
  string,
  { title: string; message: string; urgent: boolean }
> = {
  payment_verification_needs_review: {
    title: "Payment status needs checking",
    message:
      "Our team needs to check your payment status. Please do not pay again. Contact us with your booking reference.",
    urgent: true,
  },
  checkout_created: {
    title: "Checkout saved",
    message:
      "Your trip is saved. Complete payment before the offer expires; availability is checked again before payment.",
    urgent: false,
  },
  payment_verified: {
    title: "Payment received",
    message:
      "We received your payment and are confirming your reservation. Please do not pay again.",
    urgent: false,
  },
  provider_confirmed: {
    title: "Reservation confirmed",
    message:
      "Your reservation is confirmed. Open your booking for the latest itinerary and travel documents.",
    urgent: false,
  },
  ticket_documents_available: {
    title: "Ticket documents updated",
    message:
      "The airline has returned ticket document information. View your booking before you travel.",
    urgent: false,
  },
  itinerary_changed: {
    title: "Your itinerary has changed",
    message:
      "The airline updated your itinerary. Review your latest travel times and contact the travel team if you need help.",
    urgent: true,
  },
  supplier_cancellation_detected: {
    title: "Reservation cancelled by supplier",
    message:
      "Contact our travel team to review your options. A cancellation does not confirm a customer refund.",
    urgent: true,
  },
  review_required: {
    title: "Our travel team is reviewing your booking",
    message:
      "Your payment or reservation needs a review. Please do not pay again; contact us with your booking reference.",
    urgent: true,
  },
  interrupted_fulfillment_detected: {
    title: "Reservation needs a review",
    message:
      "We are checking the outcome of your reservation. Please do not make another payment.",
    urgent: true,
  },
  supplier_creation_failed: {
    title: "Reservation needs a review",
    message:
      "The supplier reported a booking issue. Our team must check the reservation and your payment before arranging the next step.",
    urgent: true,
  },
  full_refund_verified: {
    title: "Full refund verified",
    message:
      "Your full refund has been verified with the payment provider. Your bank determines when it appears in your account.",
    urgent: false,
  },
  booking_reconciled: {
    title: "Reservation status checked",
    message:
      "Our travel team checked your reservation with the supplier. Open your booking for its current status.",
    urgent: false,
  },
  service_requested: {
    title: "Booking help requested",
    message:
      "Your request is saved for the travel team. This request does not change or cancel your reservation.",
    urgent: true,
  },
  service_request_resolved: {
    title: "Your booking request has an update",
    message:
      "Our travel team has responded to your request. Open your booking to review the response.",
    urgent: false,
  },
};

// The audit ledger is the durable outbox. A deterministic notification ID and
// NOT EXISTS let a later worker recover missed publication without duplicates.
// Owners receive their own events; only active super admins receive operations alerts.
export async function publishBookingUpdates() {
  await db.execute(sql`
    INSERT INTO notifications (id, user_id, title, message, is_read, type, link, created_at)
    SELECT 'ota:' || e.id || ':' || p.id, p.id,
      CASE WHEN b.mode = 'test' THEN '[Test] ' ELSE '' END || (m.value->>'title'),
      b.reference || ' · ' || (m.value->>'message'), false, 'booking',
      CASE WHEN p.clerk_user_id = b.clerk_user_id THEN '/travel/bookings/' || b.id
           ELSE '/admin/ota?booking=' || b.id END, e.created_at
    FROM ota_events e
    JOIN ota_bookings b ON b.id = e.booking_id
    JOIN jsonb_each(${JSON.stringify(bookingMessages)}::jsonb) m ON m.key = e.action
    JOIN profiles p ON p.account_status = 'active' AND
      (p.clerk_user_id = b.clerk_user_id OR
       (p.role = 'super_admin' AND (m.value->>'urgent')::boolean))
    WHERE NOT EXISTS (SELECT 1 FROM notifications n WHERE n.id = 'ota:' || e.id || ':' || p.id)
    ORDER BY e.created_at, e.id, p.id LIMIT 200
    ON CONFLICT (id) DO NOTHING
  `);
}

export function customerTimeline(
  events: { id: string; action: string; createdAt: Date; details?: unknown }[],
) {
  return events
    .filter((e) => bookingMessages[e.action])
    .map((e) => ({
      id: e.id,
      ...bookingMessages[e.action],
      createdAt: e.createdAt,
      ...(e.action === "service_request_resolved" &&
      typeof (e.details as any)?.customerMessage === "string"
        ? { response: (e.details as any).customerMessage }
        : {}),
    }));
}
