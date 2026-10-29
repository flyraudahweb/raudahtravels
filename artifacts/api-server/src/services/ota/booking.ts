import { randomUUID } from "node:crypto";
import {
  db,
  otaBookingsTable as bookings,
  otaEventsTable,
  siteSettingsTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { getOtaConfig, duffelTokenForMode } from "./config";
import {
  available,
  assertHotelQuote,
  duffelRequest,
  OtaError,
  validatePayment,
  sameSupplierAmount,
} from "./provider";

export async function audit(
  bookingId: string | null,
  actor: string,
  action: string,
  details?: unknown,
) {
  await db
    .insert(otaEventsTable)
    .values({ id: randomUUID(), bookingId, actor, action, details });
}
export async function paystackKey(mode?: string) {
  const row = await db.query.siteSettingsTable.findFirst({
    where: eq(siteSettingsTable.key, "paystack_secret_key"),
  });
  const value = String(row?.value || process.env.PAYSTACK_SECRET_KEY || "");
  if (!value || (mode && !value.startsWith(`sk_${mode}_`)))
    throw new OtaError(
      "Payment settings are unavailable or do not match the travel mode.",
      503,
    );
  return value;
}
export async function paystackRequest(
  path: string,
  mode: string,
  data?: unknown,
) {
  const secret = await paystackKey(mode);
  const response = await fetch(`https://api.paystack.co${path}`, {
    method: data ? "POST" : "GET",
    redirect: "error",
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const result = (await response.json()) as any;
  if (!response.ok || !result.status)
    throw new OtaError(
      "Payment service is unavailable. Your booking remains saved.",
      502,
    );
  return result.data;
}
export type OtaBooking = typeof bookings.$inferSelect;
export function customerBooking(row: OtaBooking) {
  const { travellers, contact, providerRequestId, ...safe } = row;
  return {
    ...safe,
    contact,
    travellers,
    issue:
      row.status === "requires_review"
        ? "Your payment or reservation needs a support review. Please do not pay again."
        : null,
  };
}
export async function fulfill(reference: string) {
  let row = await db.query.otaBookingsTable.findFirst({
    where: eq(bookings.reference, reference),
  });
  if (!row) throw new OtaError("Booking not found", 404);
  if (row.status !== "payment_pending") return row;
  // Fetch the authoritative transaction, never accept browser flags or amounts.
  const payment = await paystackRequest(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    row.mode,
  );
  validatePayment(payment, row);
  const [claimed] = await db
    .update(bookings)
    .set({
      revision: sql`${bookings.revision}+1`,
      status: "processing",
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(bookings.id, row.id), eq(bookings.status, "payment_pending")))
    .returning();
  if (!claimed)
    return (await db.query.otaBookingsTable.findFirst({
      where: eq(bookings.id, row.id),
    }))!;
  row = claimed;
  let verifiedSupplier: any;
  // A process crash after this claim must be reconciled, never blindly retried.
  try {
    await audit(row.id, "system", "payment_verified");
    const savedConfig = await getOtaConfig();
    const config = {
      ...savedConfig,
      mode: row.mode as "test" | "live",
      duffelToken: duffelTokenForMode(savedConfig, row.mode as "test" | "live"),
    };
    if (row.expiresAt.getTime() <= Date.now())
      throw new OtaError(
        "Offer expired after payment; support must arrange replacement or refund.",
        409,
      );
    const contact = row.contact as any;
    let result: any;
    if (row.kind === "flight") {
      const fresh = await duffelRequest(
        config,
        `/air/offers/${encodeURIComponent(row.providerOfferId)}`,
      );
      available(fresh);
      if (
        !sameSupplierAmount(fresh.total_amount, row.supplierAmount) ||
        fresh.total_currency !== row.supplierCurrency
      )
        throw new OtaError("Supplier price changed after payment.", 409);
      result = await duffelRequest(config, "/air/orders", "POST", {
        type: "instant",
        selected_offers: [row.providerOfferId],
        passengers: row.travellers,
        payments: [
          {
            type: "balance",
            amount: row.supplierAmount,
            currency: row.supplierCurrency,
          },
        ],
        metadata: { ota_booking_id: row.id },
      });
      // A confirmed order is distinct from the later availability of ticket documents.
      if (!result.id || !result.booking_reference)
        throw new OtaError("Provider booking needs reconciliation", 502);
    } else {
      const quote = await duffelRequest(
        config,
        `/stays/quotes/${encodeURIComponent(row.providerOfferId)}`,
      );
      available(quote);
      assertHotelQuote(quote);
      if (
        !sameSupplierAmount(quote.total_amount, row.supplierAmount) ||
        quote.total_currency !== row.supplierCurrency
      )
        throw new OtaError("Supplier price changed after payment.", 409);
      result = await duffelRequest(config, "/stays/bookings", "POST", {
        quote_id: row.providerOfferId,
        guests: row.travellers,
        email: contact.email,
        phone_number: contact.phone,
        accommodation_special_requests: contact.specialRequests || undefined,
        metadata: { ota_booking_id: row.id },
      });
      if (!result.id || result.status !== "confirmed")
        throw new OtaError("Provider booking needs reconciliation", 502);
    }
    if (
      !(
        row.kind === "flight" ? /^ord_[A-Za-z0-9]+$/ : /^bok_[A-Za-z0-9]+$/
      ).test(result.id) ||
      result.metadata?.ota_booking_id !== row.id ||
      !sameSupplierAmount(result.total_amount, row.supplierAmount) ||
      result.total_currency !== row.supplierCurrency ||
      (result.live_mode !== undefined &&
        result.live_mode !== (row.mode === "live"))
    )
      throw new OtaError(
        "Supplier confirmation did not match the paid checkout. Reconciliation is required.",
        502,
      );
    verifiedSupplier = result;
    const confirmed = await db.transaction(async (tx) => {
      const [saved] = await tx
        .update(bookings)
        .set({
          revision: sql`${bookings.revision}+1`,
          providerBookingId: result.id,
          providerResult: result,
          status: "confirmed",
          issue: null,
          syncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(bookings.id, row.id), eq(bookings.status, "processing")))
        .returning();
      if (saved)
        await tx
          .insert(otaEventsTable)
          .values({
            id: randomUUID(),
            bookingId: row.id,
            actor: "system",
            action: "provider_confirmed",
            details: { providerId: result.id },
          });
      return saved;
    });
    if (!confirmed)
      return (await db.query.otaBookingsTable.findFirst({
        where: eq(bookings.id, row.id),
      }))!;
    return confirmed;
  } catch (error) {
    // Never auto-repeat a possibly successful supplier purchase, including when
    // saving the successful response failed. The durable claim remains evidence.
    const [review] = await db
      .update(bookings)
      .set({
        revision: sql`${bookings.revision}+1`,
        status: "requires_review",
        ...(verifiedSupplier
          ? {
              providerBookingId: verifiedSupplier.id,
              providerResult: verifiedSupplier,
            }
          : {}),
        issue:
          error instanceof OtaError
            ? error.message
            : "Reservation outcome requires operator reconciliation",
        providerRequestId:
          error instanceof OtaError ? error.requestId : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(bookings.id, row.id), eq(bookings.status, "processing")))
      .returning();
    if (!review)
      return (await db.query.otaBookingsTable.findFirst({
        where: eq(bookings.id, row.id),
      }))!;
    await audit(row.id, "system", "review_required");
    return review;
  }
}

// Read-only supplier refresh: never creates or retries a reservation.
export async function refreshBooking(row: OtaBooking) {
  if (!row.providerBookingId || row.status === "refunded") return row;
  const savedConfig = await getOtaConfig();
  const config = {
    ...savedConfig,
    mode: row.mode as "test" | "live",
    duffelToken: duffelTokenForMode(savedConfig, row.mode as "test" | "live"),
  };
  const result = await duffelRequest(
    config,
    row.kind === "flight"
      ? `/air/orders/${row.providerBookingId}`
      : `/stays/bookings/${row.providerBookingId}`,
  );
  if (result.id !== row.providerBookingId)
    throw new OtaError("Provider record mismatch", 502);
  const cancelled = !!result.cancelled_at || result.status === "cancelled";
  const previousDocuments = new Set(
    ((row.providerResult as any)?.documents || [])
      .map((d: any) => d.unique_identifier)
      .filter(Boolean),
  );
  const newDocuments = (result.documents || []).some(
    (d: any) =>
      d.unique_identifier && !previousDocuments.has(d.unique_identifier),
  );
  const [updated] = await db
    .update(bookings)
    .set({
      revision: sql`${bookings.revision}+1`,
      providerResult: result,
      status: cancelled ? "cancelled" : row.status,
      ...(cancelled && row.status !== "cancelled"
        ? {
            providerNotice:
              "The supplier has cancelled this reservation. Contact support to review refund options.",
            notificationSentAt: null,
            notificationAttemptAt: null,
          }
        : {}),
      syncedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bookings.id, row.id),
        eq(bookings.status, row.status),
        eq(bookings.revision, row.revision),
      ),
    )
    .returning();
  if (updated && cancelled && row.status !== "cancelled")
    await audit(row.id, "system", "supplier_cancellation_detected");
  if (updated && !cancelled && newDocuments)
    await audit(row.id, "system", "ticket_documents_available");
  return (
    updated ||
    (await db.query.otaBookingsTable.findFirst({
      where: eq(bookings.id, row.id),
    }))!
  );
}
