import { expirePackageHolds } from "../payments/packageHolds";
import { db, otaBookingsTable as bookings, otaPrebookClaimsTable } from "@workspace/db";
import { and, eq, isNull, lt, or, asc, inArray, sql } from "drizzle-orm";
import { audit, refreshBooking } from "./booking";
import { sendEmail } from "../../utils/email";
import { logger } from "../../lib/logger";
import { processOtaPayments } from "./paymentQueue";
import { processDuffelEvents } from "./duffelWebhooks";
import { publishBookingUpdates } from "./bookingUpdates";
import { otaAppOrigin } from "./appOrigin";

function escapeEmailText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function maintainOta() {
  // Paid checkouts must continue processing even when new sales are disabled.
  await processOtaPayments();
  await processDuffelEvents();
  await maintainBookings();
  await expirePackageHolds();
}

async function maintainBookings() {
  await db.transaction(async (tx) => {
    const expired = await tx.delete(otaPrebookClaimsTable)
      .where(sql`${otaPrebookClaimsTable.createdAt} < now() - interval '2 minutes'`)
      .returning({ id: otaPrebookClaimsTable.attemptId });
    if (expired.length) await tx.update(bookings).set({ checkoutEditClaim: null })
      .where(inArray(bookings.checkoutEditClaim, expired.map(({ id }) => id)));
  });
  const stale = await db
    .update(bookings)
    .set({
      revision: sql`${bookings.revision}+1`,
      status: "requires_review",
      issue:
        "Fulfillment was interrupted. Reconcile with the recorded supplier before any further booking attempt.",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bookings.status, "processing"),
        or(
          sql`(${bookings.supplier} <> 'bilalsadasub' AND (${bookings.supplier} <> 'nuitee' OR ${bookings.kind} <> 'flight'))`,
          isNull(bookings.providerBookingId),
          sql`${bookings.paidAt} < now() - interval '1 day'`,
        ),
        lt(bookings.updatedAt, new Date(Date.now() - 10 * 60000)),
      ),
    )
    .returning();
  for (const row of stale)
    await audit(row.id, "system", "interrupted_fulfillment_detected");
  const syncDeadline = Date.now() + 30000;
  const syncCutoff = sql`now() - CASE
    WHEN ${bookings.supplier} = 'bilalsadasub' AND ${bookings.status} <> 'confirmed' THEN interval '30 seconds'
      WHEN ${bookings.supplier} = 'nuitee' AND ${bookings.status} IN ('processing', 'requires_review') THEN interval '2 minutes'
    ELSE interval '15 minutes' END`;
  const sync = await db.query.otaBookingsTable.findMany({
    where: and(
      or(
        eq(bookings.status, "confirmed"),
        and(
          eq(bookings.supplier, "bilalsadasub"),
          inArray(bookings.status, ["processing", "requires_review"]),
          sql`${bookings.paidAt} > now() - interval '1 day'`,
        ),
        and(
          eq(bookings.supplier, "nuitee"),
          or(
            eq(bookings.status, "requires_review"),
            and(
              eq(bookings.status, "processing"),
              eq(bookings.kind, "flight"),
              sql`${bookings.providerBookingId} IS NOT NULL`,
            ),
          ),
          sql`${bookings.paidAt} > now() - interval '1 day'`,
        ),
      ),
      or(
        isNull(bookings.syncAttemptAt),
        lt(bookings.syncAttemptAt, syncCutoff),
      ),
      or(isNull(bookings.syncedAt), lt(bookings.syncedAt, syncCutoff)),
    ),
    orderBy: [sql`${bookings.syncAttemptAt} ASC NULLS FIRST`, asc(bookings.id)],
    limit: 10,
  });
  for (const row of sync) {
    if (Date.now() >= syncDeadline) break;
    const [claimedSync] = await db
      .update(bookings)
      .set({ syncAttemptAt: new Date() })
      .where(
        and(
          eq(bookings.id, row.id),
          eq(bookings.revision, row.revision),
          or(
            isNull(bookings.syncAttemptAt),
            lt(bookings.syncAttemptAt, syncCutoff),
          ),
        ),
      )
      .returning();
    if (!claimedSync) continue;
    try {
      await refreshBooking(claimedSync);
    } catch {
      logger.warn({ bookingId: row.id }, "OTA supplier refresh unavailable");
    }
  }
  await publishBookingUpdates();
  const origin = otaAppOrigin();
  if (!origin) return;
  const notify = await db.query.otaBookingsTable.findMany({
    where: and(
      inArray(bookings.status, [
        "confirmed",
        "cancelled",
        "requires_review",
        "refunded",
      ]),
      isNull(bookings.notificationSentAt),
      or(
        isNull(bookings.notificationAttemptAt),
        lt(bookings.notificationAttemptAt, new Date(Date.now() - 30 * 60000)),
      ),
    ),
    limit: 10,
  });
  for (const row of notify) {
    const [claimed] = await db
      .update(bookings)
      .set({ notificationAttemptAt: new Date() })
      .where(
        and(
          eq(bookings.id, row.id),
          eq(bookings.status, row.status),
          eq(bookings.revision, row.revision),
          isNull(bookings.notificationSentAt),
          or(
            isNull(bookings.notificationAttemptAt),
            lt(
              bookings.notificationAttemptAt,
              new Date(Date.now() - 30 * 60000),
            ),
          ),
        ),
      )
      .returning();
    if (!claimed) continue;
    // A notification claim must not acknowledge a newer booking update which
    // arrived while email delivery was in flight.
    const url = `${origin}/travel/bookings/${row.id}`;
    const label =
      row.status === "refunded"
        ? "Your travel booking has been fully refunded"
        : row.status === "cancelled"
          ? "Your travel reservation has been cancelled; contact support about refund options"
          : row.providerNotice
            ? "There is an important update to your travel reservation"
            : row.status === "confirmed"
              ? "Your travel reservation is confirmed"
              : "Your travel reservation needs support review";
    const result = row.providerResult as any;
    const confirmationDetails: string[] = [];
    if (row.status === "confirmed" && result) {
      const reference = result.booking_reference || result.reference;
      if (reference)
        confirmationDetails.push(`Supplier reference: ${reference}`);
      const slices =
        Array.isArray(result.slices) &&
        result.slices.some((slice: any) => slice?.segments?.length)
          ? result.slices
          : (row.offer as { slices?: unknown })?.slices;
      if (row.kind === "flight" && Array.isArray(slices)) {
        for (const slice of slices) {
          if (!Array.isArray(slice?.segments)) continue;
          for (const segment of slice.segments) {
            const route = `${segment?.origin?.iata_code || ""} ${segment?.departing_at || ""} → ${segment?.destination?.iata_code || ""} ${segment?.arriving_at || ""}`;
            const carrier = segment?.operating_carrier?.name;
            confirmationDetails.push(
              carrier ? `${route} · Operated by ${carrier}` : route,
            );
          }
        }
      }
    }
    const confirmationHtml = confirmationDetails
      .map((line) => `<p>${escapeEmailText(line)}</p>`)
      .join("");
    try {
      const sent = await sendEmail({
        to: (row.contact as any).email,
        subject: `${label} · ${row.reference}`,
        text: [
          `${label}.`,
          `Reference: ${row.reference}`,
          ...confirmationDetails,
          `Sign in to view your itinerary and status: ${url}. Please do not pay again if payment was received.`,
        ].join("\n"),
        html: `<p>${label}.</p><p>Reference: ${row.reference}</p>${confirmationHtml}<p><a href="${url}">Sign in to view your booking and travel documents</a></p><p>If your payment was received, please do not pay again.</p>`,
      });
      if (sent) {
        await db
          .update(bookings)
          .set({ notificationSentAt: new Date() })
          .where(
            and(
              eq(bookings.id, row.id),
              eq(bookings.status, claimed.status),
              eq(
                bookings.notificationAttemptAt,
                claimed.notificationAttemptAt!,
              ),
              eq(bookings.revision, claimed.revision),
            ),
          );
        await audit(row.id, "system", "customer_email_sent");
      }
    } catch {
      logger.warn(
        { bookingId: row.id },
        "OTA notification delivery unavailable",
      );
    }
  }
}
export function startOtaMaintenance(
  stages: { name: string; run: () => Promise<void> }[] = [
    { name: "payment queue", run: processOtaPayments },
    { name: "supplier inbox", run: processDuffelEvents },
    { name: "booking maintenance", run: maintainBookings },
    { name: "package holds", run: expirePackageHolds },
  ],
) {
  // Slow provider requests in one stage must not stop the other queues or alerts.
  const timers = stages.map((stage) => {
    let running = false;
    const timer = setInterval(async () => {
      if (running) return;
      running = true;
      try {
        await stage.run();
      } catch {
        logger.warn(
          { stage: stage.name },
          "OTA worker unavailable; check settings and OTA migrations",
        );
      } finally {
        running = false;
      }
    }, 60000);
    timer.unref();
    return timer;
  });
  return () => timers.forEach((timer) => clearInterval(timer));
}
