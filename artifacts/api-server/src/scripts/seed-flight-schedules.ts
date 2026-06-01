import { db, packagesTable, packageDatesTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";

const flightSchedules = [
  // Kano Departures
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

  // Abuja Departures (from the new flyer)
  { outbound: "2026-06-23", outboundRoute: "ABUJA-MADINAH", returnDate: "2026-07-07", returnRoute: "JEDDAH-ABUJA", airline: "EGYPTAIR" },
  { outbound: "2026-07-07", outboundRoute: "ABUJA-MADINAH", returnDate: "2026-07-21", returnRoute: "JEDDAH-ABUJA", airline: "EGYPTAIR" },
  { outbound: "2026-07-21", outboundRoute: "ABUJA-MADINAH", returnDate: "2026-08-04", returnRoute: "JEDDAH-ABUJA", airline: "EGYPTAIR" },
  { outbound: "2026-08-04", outboundRoute: "ABUJA-MADINAH", returnDate: "2026-08-18", returnRoute: "JEDDAH-ABUJA", airline: "EGYPTAIR" },
  { outbound: "2026-08-18", outboundRoute: "ABUJA-MADINAH", returnDate: "2026-09-01", returnRoute: "JEDDAH-ABUJA", airline: "EGYPTAIR" },
  { outbound: "2026-08-20", outboundRoute: "ABUJA-MADINAH", returnDate: "2026-09-03", returnRoute: "JEDDAH-ABUJA", airline: "EGYPTAIR" },
  { outbound: "2026-08-23", outboundRoute: "ABUJA-MADINAH", returnDate: "2026-09-06", returnRoute: "JEDDAH-ABUJA", airline: "EGYPTAIR" },
  { outbound: "2026-09-01", outboundRoute: "ABUJA-MADINAH", returnDate: "2026-09-15", returnRoute: "JEDDAH-ABUJA", airline: "EGYPTAIR" },
  { outbound: "2026-09-15", outboundRoute: "ABUJA-MADINAH", returnDate: "2026-09-29", returnRoute: "JEDDAH-ABUJA", airline: "EGYPTAIR" },
  { outbound: "2026-09-29", outboundRoute: "ABUJA-MADINAH", returnDate: "2026-10-13", returnRoute: "JEDDAH-ABUJA", airline: "EGYPTAIR" },
  { outbound: "2026-10-13", outboundRoute: "ABUJA-MADINAH", returnDate: "2026-10-27", returnRoute: "JEDDAH-ABUJA", airline: "EGYPTAIR" },
  { outbound: "2026-10-27", outboundRoute: "ABUJA-MADINAH", returnDate: "2026-11-10", returnRoute: "JEDDAH-ABUJA", airline: "EGYPTAIR" },
  { outbound: "2026-11-10", outboundRoute: "ABUJA-MADINAH", returnDate: "2026-11-24", returnRoute: "JEDDAH-ABUJA", airline: "EGYPTAIR" },
  { outbound: "2026-11-24", outboundRoute: "ABUJA-MADINAH", returnDate: "2026-12-08", returnRoute: "JEDDAH-ABUJA", airline: "EGYPTAIR" },
  { outbound: "2026-12-08", outboundRoute: "ABUJA-MADINAH", returnDate: "2026-12-22", returnRoute: "JEDDAH-ABUJA", airline: "EGYPTAIR" },
  { outbound: "2026-12-22", outboundRoute: "ABUJA-MADINAH", returnDate: "2027-01-05", returnRoute: "JEDDAH-ABUJA", airline: "EGYPTAIR" },
  { outbound: "2027-01-05", outboundRoute: "ABUJA-MADINAH", returnDate: "2027-01-19", returnRoute: "JEDDAH-ABUJA", airline: "EGYPTAIR" },
  { outbound: "2027-01-19", outboundRoute: "ABUJA-MADINAH", returnDate: "2027-02-02", returnRoute: "JEDDAH-ABUJA", airline: "EGYPTAIR" }, // Corrected 2nd Jan typo to 2nd Feb
];

async function main() {
  console.log("Fetching global flight schedules...");
  const existingGlobalDates = await db.query.packageDatesTable.findMany({
    where: isNull(packageDatesTable.packageId),
  });

  if (existingGlobalDates.length > 0) {
    console.log(`Found ${existingGlobalDates.length} existing global flight schedules.`);
    console.log("To prevent duplicates, run the script after clearing the table manually if you need a reset.");
    console.log("Skipping insertion.");
    process.exit(0);
  }

  console.log(`Inserting ${flightSchedules.length} global flight schedules...`);

  // Insert dates with packageId: null so they apply globally
  const insertData = flightSchedules.map((schedule) => ({
    id: randomUUID(),
    packageId: null as any,
    outbound: schedule.outbound,
    outboundRoute: schedule.outboundRoute,
    returnDate: schedule.returnDate,
    returnRoute: schedule.returnRoute,
    airline: schedule.airline,
  }));

  await db.insert(packageDatesTable).values(insertData);
  console.log(`\nFinished! Inserted ${insertData.length} global flight schedules.`);
  
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
