import { randomUUID } from "node:crypto";
import {
  db,
  otaPaymentJobsTable as jobs,
  otaBookingsTable as bookings,
  otaEventsTable,
} from "@workspace/db";
import { and, eq, isNotNull, isNull, lt, lte, or, asc, sql } from "drizzle-orm";
import { fulfill, otaPaymentReferenceMatches } from "./booking";

const MAX_ATTEMPTS = 10;
const VERIFICATION_ERROR = "Payment verification unavailable or transaction mismatch";

async function flagFinalAttempt(reference: string, lastError: string, expired: boolean) {
  await db.transaction(async (tx) => {
    const flaggedJobs = await tx.update(jobs).set({ lockedUntil: null, lastError })
      .where(and(eq(jobs.reference, reference), isNull(jobs.completedAt),
        eq(jobs.attempts, MAX_ATTEMPTS),
        expired ? lt(jobs.lockedUntil, sql`now()`) : isNotNull(jobs.lockedUntil),
      )).returning({ bookingId: jobs.bookingId });
    for (const { bookingId } of flaggedJobs) {
      const [flagged] = await tx.update(bookings).set({
        revision: sql`${bookings.revision} + 1`,
        issue: "Payment callback requires manual verification",
        updatedAt: new Date(),
      }).where(and(eq(bookings.id, bookingId), eq(bookings.status, "payment_pending")))
        .returning({ id: bookings.id });
      if (flagged) await tx.insert(otaEventsTable).values({
        id: randomUUID(), bookingId, actor: "system", action: "payment_verification_needs_review",
      });
    }
  });
}

export async function enqueuePayment(reference: string, bookingId: string) {
  const row = await db.query.otaBookingsTable.findFirst({
    where: and(
      eq(bookings.id, bookingId),
      otaPaymentReferenceMatches(reference),
    ),
  });
  if (!row) return; // Unrelated provider notifications cannot create jobs.
  await db.insert(jobs).values({ reference, bookingId }).onConflictDoNothing();
}
export async function processOtaPayments() {
  const deadline = Date.now() + 60000;
  const expiredFinalAttempt = and(
    isNull(jobs.completedAt), eq(jobs.attempts, MAX_ATTEMPTS), lt(jobs.lockedUntil, sql`now()`),
  );
  const interrupted = await db.query.otaPaymentJobsTable.findMany({
    where: expiredFinalAttempt, columns: { reference: true }, orderBy: asc(jobs.lockedUntil), limit: 10,
  });
  for (const { reference } of interrupted) {
    await flagFinalAttempt(reference, "Final payment verification was interrupted", true);
  }
  // Use one database clock for defaults, leases and eligibility. Host timezone
  // and sub-millisecond clock differences must not defer an available job.
  const ready = and(
    isNull(jobs.completedAt),
    lt(jobs.attempts, MAX_ATTEMPTS),
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
    const claim = and(
      eq(jobs.reference, claimed.reference),
      eq(jobs.attempts, claimed.attempts),
      isNull(jobs.completedAt),
    );
    try {
      await fulfill(job.reference, job.bookingId);
      await db
        .update(jobs)
        .set({ completedAt: new Date(), lockedUntil: null, lastError: null })
        .where(claim);
    } catch {
      if (claimed.attempts >= MAX_ATTEMPTS) {
        await flagFinalAttempt(job.reference, VERIFICATION_ERROR, false);
        continue;
      }
      await db
        .update(jobs)
        .set({
          lockedUntil: null,
          lastError: VERIFICATION_ERROR,
          availableAt: sql`now() + (${Math.min(30, 2 ** claimed.attempts)} * interval '1 minute')`,
        })
        .where(claim);
    }
  }
}
