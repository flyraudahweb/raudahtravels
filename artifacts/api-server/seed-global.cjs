const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function run() {
  // Step 1: ALTER TABLE to allow NULL package_id
  console.log("Step 1: Making package_id nullable...");
  try {
    await sql`ALTER TABLE package_dates ALTER COLUMN package_id DROP NOT NULL`;
    console.log("  Done - package_id is now nullable.");
  } catch (e) {
    if (e.message && e.message.includes('already')) {
      console.log("  Already nullable, skipping.");
    } else {
      // Check if it's already nullable
      const colInfo = await sql`SELECT is_nullable FROM information_schema.columns WHERE table_name = 'package_dates' AND column_name = 'package_id'`;
      if (colInfo[0]?.is_nullable === 'YES') {
        console.log("  Already nullable, skipping.");
      } else {
        throw e;
      }
    }
  }

  // Step 2: Verify column is nullable
  const colCheck = await sql`SELECT is_nullable FROM information_schema.columns WHERE table_name = 'package_dates' AND column_name = 'package_id'`;
  console.log("  package_id nullable?", colCheck[0]?.is_nullable);

  // Step 3: Insert global dates
  const dates = [
    { outbound: "2024-12-11", outboundRoute: "KANO-JEDDAH", returnDate: "2024-12-25", returnRoute: "JEDDAH-KANO", airline: "flyadeal", islamicDate: "10 Jumada Al-Akhirah", islamicReturnDate: "24 Jumada Al-Akhirah" },
    { outbound: "2024-12-25", outboundRoute: "KANO-JEDDAH", returnDate: "2025-01-08", returnRoute: "JEDDAH-KANO", airline: "flyadeal", islamicDate: "24 Jumada Al-Akhirah", islamicReturnDate: "8 Rajab" },
    { outbound: "2025-01-08", outboundRoute: "KANO-JEDDAH", returnDate: "2025-01-22", returnRoute: "JEDDAH-KANO", airline: "flyadeal", islamicDate: "8 Rajab", islamicReturnDate: "22 Rajab" },
    { outbound: "2025-01-22", outboundRoute: "KANO-JEDDAH", returnDate: "2025-02-05", returnRoute: "JEDDAH-KANO", airline: "flyadeal", islamicDate: "22 Rajab", islamicReturnDate: "6 Sha'ban" },
    { outbound: "2025-01-05", outboundRoute: "ABUJA-MADINAH", returnDate: "2025-01-19", returnRoute: "JEDDAH-ABUJA", airline: "flyadeal", islamicDate: "5 Rajab", islamicReturnDate: "19 Rajab" },
    { outbound: "2025-01-19", outboundRoute: "ABUJA-MADINAH", returnDate: "2025-02-02", returnRoute: "JEDDAH-ABUJA", airline: "flyadeal", islamicDate: "19 Rajab", islamicReturnDate: "3 Sha'ban" },
    { outbound: "2025-02-02", outboundRoute: "ABUJA-MADINAH", returnDate: "2025-02-16", returnRoute: "JEDDAH-ABUJA", airline: "flyadeal", islamicDate: "3 Sha'ban", islamicReturnDate: "17 Sha'ban" },
  ];

  // Clear old global dates
  console.log("\nStep 2: Clearing old global dates...");
  await sql`DELETE FROM package_dates WHERE package_id IS NULL`;

  // Insert
  console.log("Step 3: Inserting new global dates...");
  for (const d of dates) {
    const id = require('crypto').randomUUID();
    await sql`INSERT INTO package_dates (id, package_id, outbound, outbound_route, return_date, return_route, airline, islamic_date, islamic_return_date)
      VALUES (${id}, ${null}, ${d.outbound}, ${d.outboundRoute}, ${d.returnDate}, ${d.returnRoute}, ${d.airline}, ${d.islamicDate}, ${d.islamicReturnDate})`;
    console.log("  Inserted:", d.outboundRoute, d.outbound, "->", d.returnDate);
  }

  // Verify
  console.log("\nStep 4: Verification...");
  const verify = await sql`SELECT id, outbound, outbound_route, return_date, return_route, airline FROM package_dates WHERE package_id IS NULL ORDER BY outbound_route, outbound`;
  console.log("All global dates in DB:");
  verify.forEach(r => console.log("  ", r.outbound_route, r.outbound, "->", r.return_date, "("+r.airline+")"));
  console.log("\n=== SUCCESS: " + verify.length + " global flight schedules inserted! ===");
}

run().catch(err => { console.error("FAILED:", err); process.exit(1); });
