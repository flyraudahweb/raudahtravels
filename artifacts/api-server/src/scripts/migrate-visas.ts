import { db } from "../db/index.js";
import { bookingsTable, visaApplicationsTable } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

async function main() {
  console.log("Starting visa migration...");
  
  // Find all pending visas
  const visas = await db.select({
    visaId: visaApplicationsTable.id,
    bookingId: visaApplicationsTable.bookingId,
    status: visaApplicationsTable.status
  })
  .from(visaApplicationsTable)
  .where(eq(visaApplicationsTable.status, "pending"));

  console.log(`Found ${visas.length} pending visas.`);

  let updated = 0;
  for (const v of visas) {
    if (!v.bookingId) continue;
    
    const [booking] = await db.select({
      amountPaid: bookingsTable.amountPaid,
      totalPrice: bookingsTable.totalPrice
    })
    .from(bookingsTable)
    .where(eq(bookingsTable.id, v.bookingId));
    
    if (booking) {
      const isFullyPaid = Number(booking.amountPaid) >= Number(booking.totalPrice);
      if (!isFullyPaid) {
        await db.update(visaApplicationsTable)
          .set({ status: "awaiting_payment" })
          .where(eq(visaApplicationsTable.id, v.visaId));
        updated++;
        console.log(`Updated visa ${v.visaId} to awaiting_payment`);
      }
    }
  }

  console.log(`Migration complete. Updated ${updated} visas.`);
  process.exit(0);
}

main().catch(console.error);
