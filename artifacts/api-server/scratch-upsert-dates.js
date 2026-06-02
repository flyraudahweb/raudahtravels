import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const kanoAirlines = 'flyadeal';
const kanoOutboundRoute = 'KANO-JEDDAH';
const kanoReturnRoute = 'JEDDAH-KANO';

const abujaAirlines = 'EGYPTAIR';
const abujaOutboundRoute = 'ABUJA-MADINAH';
const abujaReturnRoute = 'JEDDAH-ABUJA';

// Dates provided in the image for 2026 (some spill into 2027)
const datePairs = [
  ['2026-06-23', '2026-07-07'],
  ['2026-07-07', '2026-07-21'],
  ['2026-07-21', '2026-08-04'],
  ['2026-08-04', '2026-08-18'],
  ['2026-08-18', '2026-09-01'],
  ['2026-08-20', '2026-09-03'],
  ['2026-08-23', '2026-09-06'],
  ['2026-09-01', '2026-09-15'],
  ['2026-09-15', '2026-09-29'],
  ['2026-09-29', '2026-10-13'],
  ['2026-10-13', '2026-10-27'],
  ['2026-10-27', '2026-11-10'],
  ['2026-11-10', '2026-11-24'],
  ['2026-11-24', '2026-12-08'],
  ['2026-12-08', '2026-12-22'],
  ['2026-12-22', '2027-01-05'],
  ['2027-01-05', '2027-01-19'],
  ['2027-01-19', '2027-02-02'], // Corrected from 2nd Jan
];

async function run() {
  const sql = neon(process.env.DATABASE_URL);
  
  // First, find existing dates
  const existingDates = await sql`SELECT * FROM package_dates`;
  
  // A helper function to find an exact matching date or insert a new one
  async function upsertDate(outbound, returnDate, routeOut, routeRet, airline) {
    const existing = existingDates.find(d => 
      d.outbound.toISOString().split('T')[0] === outbound &&
      d.outbound_route === routeOut
    );
    
    if (existing) {
      // Just make sure it is updated correctly (though we only have these fields)
      // Actually if it exists, let's leave it alone to avoid duplicate key issues if not needed,
      // but let's update return date and airline just in case.
      await sql`
        UPDATE package_dates 
        SET return_date = ${returnDate}, return_route = ${routeRet}, airline = ${airline}
        WHERE id = ${existing.id}
      `;
      return existing.id;
    } else {
      const id = crypto.randomUUID();
      await sql`
        INSERT INTO package_dates (id, outbound, return_date, outbound_route, return_route, airline, created_at)
        VALUES (${id}, ${outbound}, ${returnDate}, ${routeOut}, ${routeRet}, ${airline}, NOW())
      `;
      return id;
    }
  }

  console.log('Processing Kano dates...');
  for (const [outbound, returnDate] of datePairs) {
    await upsertDate(outbound, returnDate, kanoOutboundRoute, kanoReturnRoute, kanoAirlines);
  }
  
  console.log('Processing Abuja dates...');
  for (const [outbound, returnDate] of datePairs) {
    await upsertDate(outbound, returnDate, abujaOutboundRoute, abujaReturnRoute, abujaAirlines);
  }

  // Next, we should probably delete any dates that are NOT in the lists above,
  // EXCEPT we shouldn't delete dates that are actively used by bookings.
  // Wait, the user said "it remove some of the kano dates", meaning maybe they want the ones that were there before?
  // No, the user said "while adding the abuja dates, it remove some of the kano dates, also the abuja dates are not all, please attached are all the dates, add them all"
  // This means the source of truth is the attached images.
  // I will just add all the missing ones.
  
  console.log('Done mapping all dates from images.');
  
  const finalDates = await sql`SELECT outbound_route, COUNT(*) FROM package_dates GROUP BY outbound_route`;
  console.log('Final counts:', finalDates);
}

run().catch(console.error);
