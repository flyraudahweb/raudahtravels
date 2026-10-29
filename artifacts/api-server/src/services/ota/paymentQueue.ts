import {
  db,
  otaPaymentJobsTable as jobs,
  otaBookingsTable as bookings,
} from "@workspace/db";
import { and, eq, isNull, lt, lte, or, asc, sql } from "drizzle-orm";
import { fulfill, audit } from "./booking";

export async function enqueuePayment(reference: string, bookingId: string) {
  const row = await db.query.otaBookingsTable.findFirst({
    where: and(eq(bookings.id, bookingId), eq(bookings.reference, reference)),
  });
  if (!row) return; // Unrelated provider notifications cannot create jobs.
  await db.insert(jobs).values({ reference, bookingId }).onConflictDoNothing();
}
export async function processOtaPayments() {
  const deadline = Date.now() + 60000;
  // Use one database clock for defaults, leases and eligibility. Host timezone
  // and sub-millisecond clock differences must not defer an available job.
  const ready = and(
    isNull(jobs.completedAt),
    lt(jobs.attempts, 10),
    lte(jobs.availableAt, sql`now()`),
    or(isNull(jobs.lockedUntil), lt(jobs.lockedUntil, sql`now()`)),
  );
  const pending = await db.query.otaPaymentJobsTable.findMany({
    where: ready,
    orderBy: asc(jobs.availableAt),
    limit: 10,
  });
  for (const job of pending) {
    if (Date.now() >= deadline) break;
    const [claimed] = await db
      .update(jobs)
      .set({
        attempts: sql`${jobs.attempts} + 1`,
        lockedUntil: sql`now() + interval '5 minutes'`,
      })
      .where(and(eq(jobs.reference, job.reference), ready))
      .returning();
    if (!claimed) continue;
    try {
      await fulfill(job.reference);
      await db
        .update(jobs)
        .set({ completedAt: new Date(), lockedUntil: null, lastError: null })
        .where(eq(jobs.reference, job.reference));
    } catch {
      await db
        .update(jobs)
        .set({
          lockedUntil: null,
          lastError: "Payment verification unavailable or transaction mismatch",
          availableAt: sql`now() + (${Math.min(30, 2 ** claimed.attempts)} * interval '1 minute')`,
        })
        .where(eq(jobs.reference, job.reference));
      if (claimed.attempts >= 10) {
        const [flagged] = await db
          .update(bookings)
          .set({
            revision: sql`${bookings.revision}+1`,
            issue: "Payment callback requires manual verification",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(bookings.id, job.bookingId),
              eq(bookings.status, "payment_pending"),
            ),
          )
          .returning();
        if (flagged)
          await audit(
            job.bookingId,
            "system",
            "payment_verification_needs_review",
          );
      }
    }
  }
}
