import pkg from 'pg';
const { Client } = pkg;
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve('.env') });

const dates = [
  // existing KANO-JEDDAH
  {
    id: "uuid-1", // Will be gen by db or randomUUID
    outbound: "2024-12-11T00:00:00Z",
    outboundRoute: "KANO-JEDDAH",
    returnDate: "2024-12-25T00:00:00Z",
    returnRoute: "JEDDAH-KANO",
    airline: "flyadeal",
    islamicDate: "10 Jumada Al-Akhirah",
    islamicReturnDate: "24 Jumada Al-Akhirah"
  },
  {
    id: "uuid-2",
    outbound: "2024-12-25T00:00:00Z",
    outboundRoute: "KANO-JEDDAH",
    returnDate: "2025-01-08T00:00:00Z",
    returnRoute: "JEDDAH-KANO",
    airline: "flyadeal",
    islamicDate: "24 Jumada Al-Akhirah",
    islamicReturnDate: "8 Rajab"
  },
  {
    id: "uuid-3",
    outbound: "2025-01-08T00:00:00Z",
    outboundRoute: "KANO-JEDDAH",
    returnDate: "2025-01-22T00:00:00Z",
    returnRoute: "JEDDAH-KANO",
    airline: "flyadeal",
    islamicDate: "8 Rajab",
    islamicReturnDate: "22 Rajab"
  },
  {
    id: "uuid-4",
    outbound: "2025-01-22T00:00:00Z",
    outboundRoute: "KANO-JEDDAH",
    returnDate: "2025-02-05T00:00:00Z",
    returnRoute: "JEDDAH-KANO",
    airline: "flyadeal",
    islamicDate: "22 Rajab",
    islamicReturnDate: "6 Sha'ban"
  },
  // new ABUJA-MADINAH
  {
    id: "uuid-5",
    outbound: "2025-01-05T00:00:00Z",
    outboundRoute: "ABUJA-MADINAH",
    returnDate: "2025-01-19T00:00:00Z",
    returnRoute: "JEDDAH-ABUJA",
    airline: "flyadeal",
    islamicDate: "5 Rajab",
    islamicReturnDate: "19 Rajab"
  },
  {
    id: "uuid-6",
    outbound: "2025-01-19T00:00:00Z",
    outboundRoute: "ABUJA-MADINAH",
    returnDate: "2025-02-02T00:00:00Z", // Fixed from Jan 2nd
    returnRoute: "JEDDAH-ABUJA",
    airline: "flyadeal",
    islamicDate: "19 Rajab",
    islamicReturnDate: "3 Sha'ban"
  },
  {
    id: "uuid-7",
    outbound: "2025-02-02T00:00:00Z",
    outboundRoute: "ABUJA-MADINAH",
    returnDate: "2025-02-16T00:00:00Z",
    returnRoute: "JEDDAH-ABUJA",
    airline: "flyadeal",
    islamicDate: "3 Sha'ban",
    islamicReturnDate: "17 Sha'ban"
  },
];

async function seed() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log("Connected to DB, deleting old dates...");
  await client.query('DELETE FROM package_dates WHERE package_id IS NULL OR package_id IS NOT NULL'); // just clear all for a clean slate, wait no let's just clear nulls
  await client.query('DELETE FROM package_dates');

  for (const date of dates) {
    const id = crypto.randomUUID();
    await client.query(`
      INSERT INTO package_dates (
        id, package_id, outbound, outbound_route, return_date, return_route, airline, islamic_date, islamic_return_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      id,
      null, // package_id IS NULL = global
      date.outbound,
      date.outboundRoute,
      date.returnDate,
      date.returnRoute,
      date.airline,
      date.islamicDate,
      date.islamicReturnDate
    ]);
  }
  console.log("Inserted global dates successfully.");
  await client.end();
}

seed().catch(console.error);
