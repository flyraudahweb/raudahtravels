import { randomUUID } from "node:crypto";
import {
  db,
  otaBookingsTable as bookings,
  otaEventsTable,
  siteSettingsTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { getOtaConfig, duffelTokenForMode } from "./config";
import { bookNuiteeHotel, lookupNuiteeBooking } from "./nuitee";
import { refreshDomesticQuote } from "./flightSuppliers";
import {
  domesticFareIncrease,
  type DomesticFareQuote,
} from "./domesticFareChecks";
import {
  bilalDebitKobo,
  bookBilalOrder,
  getBilalOrder,
  type BilalOrder,
} from "./bilalOrders";
import {
  available,
  assertHotelQuote,
  duffelRequest,
  OtaError,
  validatePayment,
  sameSupplierAmount,
  supplierBookingTotalMatches,
  supplierBookingConfirmed,
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
export async function paystackKey(mode?: string, supplier = "duffel") {
  const row = await db.query.siteSettingsTable.findFirst({
    where: eq(siteSettingsTable.key, "paystack_secret_key"),
  });
  const dedicated =
    supplier === "bilalsadasub"
      ? mode === "test"
        ? process.env.BILALSADASUB_PAYSTACK_TEST_SECRET_KEY
        : mode === "live"
          ? process.env.BILALSADASUB_PAYSTACK_LIVE_SECRET_KEY
          : undefined
      : supplier === "nuitee"
        ? mode === "test"
          ? process.env.NUITEE_PAYSTACK_TEST_SECRET_KEY
          : mode === "live"
            ? process.env.NUITEE_PAYSTACK_LIVE_SECRET_KEY
            : undefined
        : undefined;
  const value = String(
    dedicated || row?.value || process.env.PAYSTACK_SECRET_KEY || "",
  );
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
  supplier = "duffel",
) {
  const secret = await paystackKey(mode, supplier);
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
    ...(row.supplier === "bilalsadasub"
      ? { offer: publicDomesticOffer(row.offer), providerOfferId: null }
      : row.supplier === "nuitee"
        ? { offer: publicNuiteeOffer(row.offer), providerOfferId: null }
        : {}),
    contact,
    travellers,
    issue:
      row.status === "requires_review"
        ? "Your payment or reservation needs a support review. Please do not pay again."
        : null,
  };
}
function publicDomesticOffer(offer: unknown) {
  const { domesticQuote, ...publicOffer } = offer as Record<string, unknown>;
  return publicOffer;
}
function publicNuiteeOffer(offer: unknown) {
  const { nuiteeStay, ...publicOffer } = offer as Record<string, unknown>;
  return publicOffer;
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
    undefined,
    row.supplier,
  );
  validatePayment(payment, row);
  const bookingId = row.id;
  const claimed = await db.transaction(async (tx) => {
    const [saved] = await tx
      .update(bookings)
      .set({
        revision: sql`${bookings.revision}+1`,
        status: "processing",
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(bookings.id, bookingId), eq(bookings.status, "payment_pending")),
      )
      .returning();
    if (saved)
      await tx.insert(otaEventsTable).values({
        id: randomUUID(),
        bookingId,
        actor: "system",
        action: "payment_verified",
      });
    return saved;
  });
  if (!claimed)
    return (await db.query.otaBookingsTable.findFirst({
      where: eq(bookings.id, row.id),
    }))!;
  row = claimed;
  let verifiedSupplier: any;
  // A process crash after this claim must be reconciled, never blindly retried.
  try {
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
    if (row.supplier === "bilalsadasub") {
      const quote = domesticBookingQuote(row);
      const latest = await refreshDomesticQuote(config, quote);
      if (!latest)
        throw new OtaError(
          "Domestic itinerary changed after payment. Review the reservation before taking further action.",
          409,
        );
      const order = await bookBilalOrder(config, quote.mode, {
        id: row.id,
        flightId: latest.refreshed.supplierId,
        travellers: row.travellers as Parameters<
          typeof bookBilalOrder
        >[2]["travellers"],
        adults: quote.search.adults,
      });
      return await saveBilalOrder(row, config, order);
    }
    if (row.supplier === "nuitee") {
      const result = await bookNuiteeHotel(savedConfig, row);
      return await saveNuiteeBooking(row, result);
    }
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
      result = await duffelRequest(
        config,
        "/air/orders",
        "POST",
        {
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
        },
        row.id,
      );
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
      const guests = row.travellers as {
        given_name: string;
        family_name: string;
      }[];
      result = await duffelRequest(
        config,
        "/stays/bookings",
        "POST",
        {
          quote_id: row.providerOfferId,
          guests: guests.map(({ given_name, family_name }) => ({
            given_name,
            family_name,
          })),
          email: contact.email,
          phone_number: contact.phone,
          accommodation_special_requests: contact.specialRequests || undefined,
          metadata: { ota_booking_id: row.id },
        },
        row.id,
      );
    }
    if (
      typeof result?.id !== "string" ||
      !(
        row.kind === "flight" ? /^ord_[A-Za-z0-9]+$/ : /^bok_[A-Za-z0-9]+$/
      ).test(result.id) ||
      result.metadata?.ota_booking_id !== row.id ||
      !supplierBookingTotalMatches(result, row) ||
      (result.live_mode !== undefined &&
        result.live_mode !== (row.mode === "live"))
    )
      throw new OtaError(
        "Supplier confirmation did not match the paid checkout. Reconciliation is required.",
        502,
      );
    verifiedSupplier = result;
    if (!supplierBookingConfirmed(row.kind, result))
      throw new OtaError("Provider booking needs reconciliation", 502);
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
        await tx.insert(otaEventsTable).values({
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
    const review = await db.transaction(async (tx) => {
      const [saved] = await tx
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
        .where(
          and(eq(bookings.id, bookingId), eq(bookings.status, "processing")),
        )
        .returning();
      if (saved)
        await tx.insert(otaEventsTable).values({
          id: randomUUID(),
          bookingId,
          actor: "system",
          action: "review_required",
        });
      return saved;
    });
    if (!review)
      return (await db.query.otaBookingsTable.findFirst({
        where: eq(bookings.id, row.id),
      }))!;
    return review;
  }
}

export function domesticBookingQuote(row: OtaBooking): DomesticFareQuote {
  const quote = (row.offer as { domesticQuote?: DomesticFareQuote })
    .domesticQuote;
  if (!quote || quote.mode !== row.mode)
    throw new OtaError(
      "Domestic booking reference requires reconciliation.",
      409,
    );
  return quote;
}

async function saveBilalOrder(
  row: OtaBooking,
  config: Awaited<ReturnType<typeof getOtaConfig>>,
  order: BilalOrder,
) {
  const { search, fare } = domesticBookingQuote(row);
  if (
    order.my_trans_id !== row.id ||
    (row.providerBookingId && row.providerBookingId !== order.reference) ||
    order.origin !== search.origin ||
    order.destination !== search.destination ||
    order.departure_date !== search.departureDate ||
    order.cabin !== search.cabinClass
  )
    throw new OtaError(
      "Bilalsadasub booking did not match the paid itinerary. Review is required.",
      502,
    );
  const tickets = [
    ...new Set((order.tickets || []).map((ticket) => ticket.number)),
  ];
  const issued =
    ["issued", "ticketed"].includes(order.status) &&
    !!order.pnr?.trim() &&
    tickets.length >= search.adults + search.childAges.length;
  const debit = bilalDebitKobo(config, order);
  const confirmed = issued && debit > 0;
  const cancelled = order.status === "cancelled";
  if (
    (!cancelled && row.status === "cancelled") ||
    (row.status === "confirmed" && !cancelled && !confirmed)
  )
    return row;
  const pending = ["reserved", "pending"].includes(order.status) && !confirmed;
  const status = confirmed
    ? "confirmed"
    : cancelled
      ? "cancelled"
      : pending && row.status === "processing"
        ? "processing"
        : "requires_review";
  const pricing = row.pricing as Record<string, unknown>;
  const previousDebit =
    typeof pricing.actualSupplierKobo === "number"
      ? pricing.actualSupplierKobo
      : fare.supplierKobo;
  const updated = await db.transaction(async (tx) => {
    const [saved] = await tx
      .update(bookings)
      .set({
        revision: sql`${bookings.revision}+1`,
        status,
        providerBookingId: order.reference,
        providerResult: {
          booking_reference: order.pnr,
          reference: order.reference,
          supplierStatus: order.status,
          ticketPdfAvailable: confirmed,
          slices: (row.offer as any).slices,
          documents: confirmed
            ? tickets.map((number) => ({
                type: "electronic_ticket",
                unique_identifier: number,
              }))
            : [],
        },
        ...(confirmed
          ? {
              pricing: {
                ...pricing,
                expectedSupplierKobo: fare.supplierKobo,
                actualSupplierKobo: debit,
                supplierKobo: debit,
              },
            }
          : {}),
        issue:
          status === "requires_review"
            ? "Bilalsadasub ticketing requires operator review."
            : null,
        ...(cancelled && row.status !== "cancelled"
          ? {
              providerNotice:
                "Bilalsadasub cancelled this booking. Review the customer refund separately.",
            }
          : {}),
        ...(row.status !== status
          ? { notificationSentAt: null, notificationAttemptAt: null }
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
    if (!saved) return;
    if (row.status !== status && status !== "processing")
      await tx.insert(otaEventsTable).values({
        id: randomUUID(),
        bookingId: row.id,
        actor: "system",
        action: confirmed
          ? "provider_confirmed"
          : cancelled
            ? "supplier_cancellation_detected"
            : "review_required",
      });
    if (confirmed && debit > previousDebit)
      await tx.insert(otaEventsTable).values({
        id: randomUUID(),
        bookingId: row.id,
        actor: "system",
        action: domesticFareIncrease,
        details: {
          mode: row.mode,
          match: "wallet_debit",
          bookingReference: row.reference,
          origin: search.origin,
          destination: search.destination,
          departure: fare.departure,
          airline: fare.airline,
          cabin: search.cabinClass,
          travellers: search.adults + search.childAges.length,
          previousSupplierKobo: previousDebit,
          currentSupplierKobo: debit,
          previousTotalKobo: row.amountKobo,
          currentTotalKobo: row.amountKobo,
        },
      });
    return saved;
  });
  return (
    updated ||
    (await db.query.otaBookingsTable.findFirst({
      where: eq(bookings.id, row.id),
    }))!
  );
}

async function saveNuiteeBooking(
  row: OtaBooking,
  result: NonNullable<Awaited<ReturnType<typeof lookupNuiteeBooking>>>,
) {
  if (row.status === "cancelled" && result.status !== "cancelled") return row;
  const stateChanged = row.status !== result.status;
  const notice =
    result.status === "cancelled"
      ? "The hotel reservation was cancelled. Contact support to review the cancellation terms and refund."
      : null;
  const updated = await db.transaction(async (tx) => {
    const [saved] = await tx
      .update(bookings)
      .set({
        revision: sql`${bookings.revision}+1`,
        status: result.status,
        providerBookingId: result.id,
        providerResult: result,
        issue: null,
        providerNotice: notice,
        ...(stateChanged
          ? { notificationSentAt: null, notificationAttemptAt: null }
          : {}),
        syncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bookings.id, row.id),
          eq(bookings.revision, row.revision),
          eq(bookings.status, row.status),
        ),
      )
      .returning();
    if (saved && stateChanged)
      await tx.insert(otaEventsTable).values({
        id: randomUUID(),
        bookingId: row.id,
        actor: "system",
        action:
          result.status === "cancelled"
            ? "supplier_cancellation_detected"
            : "provider_confirmed",
        details: { providerId: result.id },
      });
    return saved;
  });
  return (
    updated ||
    (await db.query.otaBookingsTable.findFirst({
      where: eq(bookings.id, row.id),
    }))!
  );
}

// Read-only supplier refresh: never creates or retries a reservation.
export async function refreshBooking(row: OtaBooking) {
  if (row.supplier === "nuitee") {
    if (!row.paidAt || row.status === "refunded") return row;
    const result = await lookupNuiteeBooking(await getOtaConfig(), row);
    return result ? saveNuiteeBooking(row, result) : row;
  }
  if (row.supplier === "bilalsadasub") {
    if (!row.paidAt || row.status === "refunded") return row;
    const config = await getOtaConfig();
    const quote = domesticBookingQuote(row);
    const order = await getBilalOrder(
      config,
      quote.mode,
      row.id,
      row.providerBookingId ?? undefined,
    );
    return order ? saveBilalOrder(row, config, order) : row;
  }
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
  if (
    result.id !== row.providerBookingId ||
    (result.metadata?.ota_booking_id &&
      result.metadata.ota_booking_id !== row.id) ||
    !supplierBookingTotalMatches(result, row) ||
    (result.live_mode !== undefined &&
      result.live_mode !== (row.mode === "live"))
  )
    throw new OtaError("Provider record mismatch", 502);
  const cancelled = !!result.cancelled_at || result.status === "cancelled";
  if (!cancelled && row.status === "cancelled") return row;
  if (!cancelled && !supplierBookingConfirmed(row.kind, result))
    throw new OtaError("Provider confirmation is incomplete", 409);
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
