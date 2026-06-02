import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const sql = neon(process.env.DATABASE_URL);
  
  // Set ALL Kano 2026+ dates to global (package_id = NULL)
  const result = await sql`UPDATE package_dates SET package_id = NULL WHERE outbound_route = 'KANO-JEDDAH' AND outbound >= '2026-01-01'`;
  console.log('Updated Kano dates to global:', result);
  
  // Also set the old 2024/2025 dates to global just in case
  const result2 = await sql`UPDATE package_dates SET package_id = NULL WHERE outbound_route = 'KANO-JEDDAH'`;
  console.log('Updated ALL Kano dates to global:', result2);

  // Now remove duplicates again - keep one per (outbound, return_date, outbound_route)
  const allDates = await sql`SELECT id, outbound::text as outbound, return_date::text as ret, outbound_route FROM package_dates ORDER BY outbound_route, outbound, created_at ASC`;
  const usedIdsRaw = await sql`SELECT DISTINCT package_date_id FROM bookings WHERE package_date_id IS NOT NULL`;
  const usedIds = new Set(usedIdsRaw.map(r => r.package_date_id));
  
  const seen = new Map();
  const toDelete = [];
  for (const d of allDates) {
    const key = `${d.outbound}_${d.ret}_${d.outbound_route}`;
    if (seen.has(key)) {
      if (usedIds.has(d.id)) {
        const firstId = seen.get(key);
        if (!usedIds.has(firstId)) {
          toDelete.push(firstId);
          seen.set(key, d.id);
        }
      } else {
        toDelete.push(d.id);
      }
    } else {
      seen.set(key, d.id);
    }
  }
  
  if (toDelete.length > 0) {
    await sql`DELETE FROM package_dates WHERE id = ANY(${toDelete})`;
    console.log(`Deleted ${toDelete.length} duplicates`);
  }

  // Final verification
  const finalKano = await sql`SELECT outbound::text, return_date::text, package_id FROM package_dates WHERE outbound_route='KANO-JEDDAH' ORDER BY outbound`;
  const finalAbuja = await sql`SELECT outbound::text, return_date::text, package_id FROM package_dates WHERE outbound_route='ABUJA-MADINAH' ORDER BY outbound`;
  console.log(`\nFinal Kano: ${finalKano.length} dates (all global: ${finalKano.every(d => d.package_id === null)})`);
  console.log(`Final Abuja: ${finalAbuja.length} dates (all global: ${finalAbuja.every(d => d.package_id === null)})`);
}

run().catch(console.error);
