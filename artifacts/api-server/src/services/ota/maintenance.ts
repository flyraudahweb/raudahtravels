import { db, otaBookingsTable as bookings } from "@workspace/db";
import { and, eq, isNull, lt, or, asc, inArray, sql } from "drizzle-orm";
import { audit, refreshBooking } from "./booking";
import { sendEmail } from "../../utils/email";
import { logger } from "../../lib/logger";
import { processOtaPayments } from "./paymentQueue";
import { processDuffelEvents } from "./duffelWebhooks";
import { publishBookingUpdates } from "./bookingUpdates";

export async function maintainOta() {
  // Paid checkouts must continue processing even when new sales are disabled.
  await processOtaPayments();
  await processDuffelEvents();
  await maintainBookings();
}

async function maintainBookings() {
  const stale = await db
    .update(bookings)
    .set({
      revision: sql`${bookings.revision}+1`,
      status: "requires_review",
      issue:
        "Fulfillment was interrupted. Reconcile with Duffel before any further booking attempt.",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bookings.status, "processing"),
        lt(bookings.updatedAt, new Date(Date.now() - 10 * 60000)),
      ),
    )
    .returning();
  for (const row of stale)
    await audit(row.id, "system", "interrupted_fulfillment_detected");
  const syncDeadline = Date.now() + 30000;
  const sync = await db.query.otaBookingsTable.findMany({
    where: and(
      eq(bookings.status, "confirmed"),
      or(
        isNull(bookings.syncAttemptAt),
        lt(bookings.syncAttemptAt, sql`now() - interval '15 minutes'`),
      ),
      or(
        isNull(bookings.syncedAt),
        lt(bookings.syncedAt, new Date(Date.now() - 15 * 60000)),
      ),
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
            lt(bookings.syncAttemptAt, sql`now() - interval '15 minutes'`),
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
  const notify = await db.query.otaBookingsTable.findMany({
    where: and(
      inArray(bookings.status, ["confirmed", "cancelled", "requires_review"]),
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
    const url = `${(process.env.APP_URL || "").replace(/\/$/, "")}/travel/bookings/${row.id}`;
    if (!url.startsWith("https://")) continue;
    // Only server-generated IDs/URLs enter the HTML; traveller names are omitted.
    const label = row.providerNotice
      ? "There is an important update to your travel reservation"
      : row.status === "confirmed"
        ? "Your travel reservation is confirmed"
        : "Your travel reservation needs support review";
    try {
      const sent = await sendEmail({
        to: (row.contact as any).email,
        subject: `${label} · ${row.reference}`,
        text: `${label}. Reference: ${row.reference}. Sign in to view your itinerary and status: ${url}. Please do not pay again if payment was received.`,
        html: `<p>${label}.</p><p>Reference: ${row.reference}</p><p><a href="${url}">Sign in to view your booking and travel documents</a></p><p>If your payment was received, please do not pay again.</p>`,
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
