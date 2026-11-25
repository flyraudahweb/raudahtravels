import { bookingsTable as bookings, db, packagesTable, paymentsTable } from "@workspace/db";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { packageDependants } from "./packageConfirmation";
import { retireExpiredPackageCheckouts } from "./packagePaystack";

export async function expirePackageHolds() {
  const expired = and(
    eq(bookings.status, "pending"),
    eq(bookings.isArchived, false),
    isNull(bookings.parentBookingId),
    eq(bookings.amountPaid, "0"),
    sql`${bookings.capacityHoldExpiresAt} <= now()`,
  );
  const candidates = await db.select({ id: bookings.id }).from(bookings)
    .where(expired).orderBy(asc(bookings.updatedAt)).limit(5);

  for (const { id } of candidates) {
    await db.transaction(async (tx) => {
      const [booking] = await tx.select().from(bookings)
        .where(and(expired, eq(bookings.id, id))).for("update", { skipLocked: true });
      if (!booking) return;
      const children = await tx.select().from(bookings)
        .where(and(packageDependants(booking), eq(bookings.status, "pending")))
        .orderBy(asc(bookings.id)).for("update");
      const ids = [booking.id, ...children.map((row) => row.id)];
      const paid = await tx.query.paymentsTable.findFirst({
        where: and(inArray(paymentsTable.bookingId, ids), eq(paymentsTable.status, "verified")),
        columns: { id: true },
      });
      if (paid || !await retireExpiredPackageCheckouts(tx, ids)) {
        await tx.update(bookings).set({ updatedAt: new Date() }).where(eq(bookings.id, id));
        return;
      }
      const seats = booking.pilgrimCount + children.reduce((sum, row) => sum + row.pilgrimCount, 0);
      await tx.update(packagesTable)
        .set({ currentBookings: sql`GREATEST(0, ${packagesTable.currentBookings} - ${seats})` })
        .where(eq(packagesTable.id, booking.packageId));
      await tx.update(bookings).set({ status: "cancelled", updatedAt: new Date() })
        .where(inArray(bookings.id, ids));
    });
  }
}
