import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

async function run() {
  const sql = neon(process.env.DATABASE_URL);

  // Step 1: Get current state
  const allDates = await sql`SELECT id, outbound::text as outbound, return_date::text as ret, outbound_route, return_route, airline FROM package_dates ORDER BY outbound_route, outbound`;
  const usedIdsRaw = await sql`SELECT DISTINCT package_date_id FROM bookings WHERE package_date_id IS NOT NULL`;
  const usedIds = new Set(usedIdsRaw.map(r => r.package_date_id));

  console.log('=== CURRENT STATE ===');
  console.log('Total dates:', allDates.length);
  console.log('Used by bookings:', usedIds.size);

  const kano = allDates.filter(d => d.outbound_route === 'KANO-JEDDAH');
  const abuja = allDates.filter(d => d.outbound_route === 'ABUJA-MADINAH');
  console.log('Kano:', kano.length, '| Abuja:', abuja.length);

  console.log('\n--- KANO dates ---');
  for (const d of kano) {
    const used = usedIds.has(d.id) ? ' [USED]' : '';
    console.log(`  ${d.outbound} => ${d.ret} (${d.airline}) ${d.id}${used}`);
  }

  console.log('\n--- ABUJA dates ---');
  for (const d of abuja) {
    const used = usedIds.has(d.id) ? ' [USED]' : '';
    console.log(`  ${d.outbound} => ${d.ret} (${d.airline}) ${d.id}${used}`);
  }

  // The CORRECT 18 date pairs from the flyers (both cities share same schedule)
  const correctDates = [
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
    ['2027-01-19', '2027-02-02'],
  ];

  // Check which correct dates are MISSING for Kano
  console.log('\n=== MISSING KANO DATES ===');
  const missingKano = [];
  for (const [out, ret] of correctDates) {
    const found = kano.find(d => d.outbound === out && d.ret === ret);
    if (!found) {
      console.log(`  MISSING: ${out} => ${ret}`);
      missingKano.push([out, ret]);
    }
  }
  if (missingKano.length === 0) console.log('  All present!');

  // Check which correct dates are MISSING for Abuja
  console.log('\n=== MISSING ABUJA DATES ===');
  const missingAbuja = [];
  for (const [out, ret] of correctDates) {
    const found = abuja.find(d => d.outbound === out && d.ret === ret);
    if (!found) {
      console.log(`  MISSING: ${out} => ${ret}`);
      missingAbuja.push([out, ret]);
    }
  }
  if (missingAbuja.length === 0) console.log('  All present!');

  // Check for EXTRA dates (not in the flyer) that have no bookings
  console.log('\n=== EXTRA/STALE KANO DATES (not in flyer) ===');
  const correctKanoKeys = new Set(correctDates.map(([o,r]) => `${o}_${r}`));
  for (const d of kano) {
    const key = `${d.outbound}_${d.ret}`;
    if (!correctKanoKeys.has(key)) {
      const used = usedIds.has(d.id) ? ' [USED - KEEP]' : ' [UNUSED - CAN DELETE]';
      console.log(`  EXTRA: ${d.outbound} => ${d.ret} ${d.id}${used}`);
    }
  }

  // NOW FIX: Insert missing dates
  console.log('\n=== INSERTING MISSING DATES ===');
  for (const [out, ret] of missingKano) {
    const id = crypto.randomUUID();
    await sql`INSERT INTO package_dates (id, outbound, return_date, outbound_route, return_route, airline, created_at) VALUES (${id}, ${out}, ${ret}, 'KANO-JEDDAH', 'JEDDAH-KANO', 'flyadeal', NOW())`;
    console.log(`  Inserted KANO: ${out} => ${ret}`);
  }
  for (const [out, ret] of missingAbuja) {
    const id = crypto.randomUUID();
    await sql`INSERT INTO package_dates (id, outbound, return_date, outbound_route, return_route, airline, created_at) VALUES (${id}, ${out}, ${ret}, 'ABUJA-MADINAH', 'JEDDAH-ABUJA', 'EGYPTAIR', NOW())`;
    console.log(`  Inserted ABUJA: ${out} => ${ret}`);
  }

  // Delete duplicates (keep the first one, or the used one)
  console.log('\n=== CLEANING DUPLICATES ===');
  const finalDates = await sql`SELECT id, outbound::text as outbound, return_date::text as ret, outbound_route FROM package_dates ORDER BY outbound_route, outbound, created_at ASC`;
  const seen = new Map();
  const toDelete = [];
  for (const d of finalDates) {
    const key = `${d.outbound}_${d.ret}_${d.outbound_route}`;
    if (seen.has(key)) {
      if (usedIds.has(d.id)) {
        // This duplicate is used by a booking, keep it and delete the first one instead (if not used)
        const firstId = seen.get(key);
        if (!usedIds.has(firstId)) {
          toDelete.push(firstId);
          seen.set(key, d.id); // update to keep this one
        }
        // else both are used, keep both (edge case)
      } else {
        toDelete.push(d.id);
      }
    } else {
      seen.set(key, d.id);
    }
  }
  if (toDelete.length > 0) {
    await sql`DELETE FROM package_dates WHERE id = ANY(${toDelete})`;
    console.log(`  Deleted ${toDelete.length} duplicates`);
  } else {
    console.log('  No duplicates found');
  }

  // Final verification
  const finalKano = await sql`SELECT outbound::text as outbound, return_date::text as ret FROM package_dates WHERE outbound_route='KANO-JEDDAH' AND outbound >= '2026-06-01' ORDER BY outbound`;
  const finalAbuja = await sql`SELECT outbound::text as outbound, return_date::text as ret FROM package_dates WHERE outbound_route='ABUJA-MADINAH' AND outbound >= '2026-06-01' ORDER BY outbound`;
  console.log('\n=== FINAL VERIFICATION ===');
  console.log(`Kano 2026+ dates: ${finalKano.length} (expected 18)`);
  for (const d of finalKano) console.log(`  ${d.outbound} => ${d.ret}`);
  console.log(`Abuja 2026+ dates: ${finalAbuja.length} (expected 18)`);
  for (const d of finalAbuja) console.log(`  ${d.outbound} => ${d.ret}`);
}

run().catch(console.error);
