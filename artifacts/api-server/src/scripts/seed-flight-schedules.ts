import { db, packagesTable, packageDatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const flightSchedules = [
  { outbound: "2026-06-23", outboundRoute: "KANO-JEDDAH", returnDate: "2026-07-07", returnRoute: "JEDDAH-KANO", airline: "flyadeal" },
  { outbound: "2026-07-07", outboundRoute: "KANO-JEDDAH", returnDate: "2026-07-21", returnRoute: "JEDDAH-KANO", airline: "flyadeal" },
  { outbound: "2026-07-21", outboundRoute: "KANO-JEDDAH", returnDate: "2026-08-04", returnRoute: "JEDDAH-KANO", airline: "flyadeal" },
  { outbound: "2026-08-04", outboundRoute: "KANO-JEDDAH", returnDate: "2026-08-18", returnRoute: "JEDDAH-KANO", airline: "flyadeal" },
  { outbound: "2026-08-18", outboundRoute: "KANO-JEDDAH", returnDate: "2026-09-01", returnRoute: "JEDDAH-KANO", airline: "flyadeal" },
  { outbound: "2026-08-20", outboundRoute: "KANO-JEDDAH", returnDate: "2026-09-03", returnRoute: "JEDDAH-KANO", airline: "flyadeal" },
  { outbound: "2026-08-23", outboundRoute: "KANO-JEDDAH", returnDate: "2026-09-06", returnRoute: "JEDDAH-KANO", airline: "flyadeal" },
  { outbound: "2026-09-01", outboundRoute: "KANO-JEDDAH", returnDate: "2026-09-15", returnRoute: "JEDDAH-KANO", airline: "flyadeal" },
  { outbound: "2026-09-15", outboundRoute: "KANO-JEDDAH", returnDate: "2026-09-29", returnRoute: "JEDDAH-KANO", airline: "flyadeal" },
  { outbound: "2026-09-29", outboundRoute: "KANO-JEDDAH", returnDate: "2026-10-13", returnRoute: "JEDDAH-KANO", airline: "flyadeal" },
  { outbound: "2026-10-13", outboundRoute: "KANO-JEDDAH", returnDate: "2026-10-27", returnRoute: "JEDDAH-KANO", airline: "flyadeal" },
  { outbound: "2026-10-27", outboundRoute: "KANO-JEDDAH", returnDate: "2026-11-10", returnRoute: "JEDDAH-KANO", airline: "flyadeal" },
  { outbound: "2026-11-10", outboundRoute: "KANO-JEDDAH", returnDate: "2026-11-24", returnRoute: "JEDDAH-KANO", airline: "flyadeal" },
  { outbound: "2026-11-24", outboundRoute: "KANO-JEDDAH", returnDate: "2026-12-08", returnRoute: "JEDDAH-KANO", airline: "flyadeal" },
  { outbound: "2026-12-08", outboundRoute: "KANO-JEDDAH", returnDate: "2026-12-22", returnRoute: "JEDDAH-KANO", airline: "flyadeal" },
  { outbound: "2026-12-22", outboundRoute: "KANO-JEDDAH", returnDate: "2027-01-05", returnRoute: "JEDDAH-KANO", airline: "flyadeal" },
  { outbound: "2027-01-05", outboundRoute: "KANO-JEDDAH", returnDate: "2027-01-19", returnRoute: "JEDDAH-KANO", airline: "flyadeal" },
  { outbound: "2027-01-19", outboundRoute: "KANO-JEDDAH", returnDate: "2027-02-02", returnRoute: "JEDDAH-KANO", airline: "flyadeal" }, // Corrected 2nd Jan typo to 2nd Feb
];

async function main() {
  console.log("Fetching umrah packages...");
  const umrahPackages = await db.query.packagesTable.findMany({
    where: eq(packagesTable.type, "umrah"),
  });

  console.log(`Found ${umrahPackages.length} umrah packages.`);

  let totalInserted = 0;

  for (const pkg of umrahPackages) {
    console.log(`Checking package: ${pkg.name} (${pkg.id})`);
    
    // Check if dates already exist to prevent duplicates
    const existingDates = await db.query.packageDatesTable.findMany({
      where: eq(packageDatesTable.packageId, pkg.id),
    });

    if (existingDates.length > 0) {
      console.log(`  Package already has ${existingDates.length} dates. Skipping...`);
      continue;
    }

    // Insert dates
    const insertData = flightSchedules.map((schedule) => ({
      id: randomUUID(),
      packageId: pkg.id,
      outbound: schedule.outbound,
      outboundRoute: schedule.outboundRoute,
      returnDate: schedule.returnDate,
      returnRoute: schedule.returnRoute,
      airline: schedule.airline,
    }));

    await db.insert(packageDatesTable).values(insertData);
    console.log(`  Inserted ${insertData.length} schedules.`);
    totalInserted += insertData.length;
  }

  console.log(`\nFinished! Inserted ${totalInserted} flight schedules across all Umrah packages.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
