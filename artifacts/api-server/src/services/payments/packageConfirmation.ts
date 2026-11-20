import { bookingsTable, db, paymentsTable, visaApplicationsTable } from "@workspace/db";
import { and, eq, ilike, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Booking = typeof bookingsTable.$inferSelect;
type Traveller = Pick<Booking, "id" | "fullName" | "passportNumber">;

export async function confirmTravellerRecords(tx: Transaction, travellers: Traveller[]) {
  const ids = travellers.map(({ id }) => id);
  if (!ids.length) return;
  await tx.update(bookingsTable)
    .set({ idNumber: sql`nextval('bookings_id_number_seq')` })
    .where(and(inArray(bookingsTable.id, ids), sql`${bookingsTable.idNumber} IS NULL`));
  const existing = await tx.select({ bookingId: visaApplicationsTable.bookingId })
    .from(visaApplicationsTable).where(inArray(visaApplicationsTable.bookingId, ids));
  await tx.update(visaApplicationsTable).set({ status: "pending", updatedAt: new Date() })
    .where(and(inArray(visaApplicationsTable.bookingId, ids), eq(visaApplicationsTable.status, "awaiting_payment")));
  const present = new Set(existing.map(({ bookingId }) => bookingId));
  const missing = travellers.filter(({ id }) => !present.has(id));
  if (missing.length) await tx.insert(visaApplicationsTable).values(missing.map((traveller) => ({
    id: randomUUID(), bookingId: traveller.id, pilgrimName: traveller.fullName,
    passportNumber: traveller.passportNumber, status: "pending",
  })));
}

export async function confirmPaidGroup(tx: Transaction, booking: Booking) {
  if (booking.status !== "confirmed" || booking.isArchived ||
      Number(booking.amountPaid) < Number(booking.totalPrice)) return;

  const dependants = and(
    eq(bookingsTable.parentBookingId, booking.id),
    eq(bookingsTable.packageId, booking.packageId),
    eq(bookingsTable.isArchived, false),
  );
  await tx.update(bookingsTable).set({ status: "confirmed", updatedAt: new Date() })
    .where(and(dependants, eq(bookingsTable.status, "pending"),
      sql`${bookingsTable.amountPaid} >= ${bookingsTable.totalPrice}`));
  const children = await tx.select().from(bookingsTable)
    .where(and(dependants, eq(bookingsTable.status, "confirmed"))).for("update");
  await confirmTravellerRecords(tx, [booking, ...children]);
  await tx.update(paymentsTable).set({ status: "rejected" })
    .where(and(eq(paymentsTable.bookingId, booking.id), eq(paymentsTable.method, "cash"),
      eq(paymentsTable.status, "pending"), ilike(paymentsTable.reference, "UPGRADE-%")));
}
