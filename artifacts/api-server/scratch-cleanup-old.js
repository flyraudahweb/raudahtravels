import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const sql = neon(process.env.DATABASE_URL);
  
  // Delete old dates (before 2026) that are NOT used by bookings
  const deleted = await sql`
    DELETE FROM package_dates 
    WHERE outbound < '2026-01-01' 
    AND id NOT IN (SELECT DISTINCT package_date_id FROM bookings WHERE package_date_id IS NOT NULL)
  `;
  console.log('Deleted old unused dates');
  
  // Final check
  const kano = await sql`SELECT outbound::text, return_date::text FROM package_dates WHERE outbound_route='KANO-JEDDAH' ORDER BY outbound`;
  const abuja = await sql`SELECT outbound::text, return_date::text FROM package_dates WHERE outbound_route='ABUJA-MADINAH' ORDER BY outbound`;
  console.log(`Kano: ${kano.length}`);
  kano.forEach(d => console.log(`  ${d.outbound} => ${d.return_date}`));
  console.log(`Abuja: ${abuja.length}`);
  abuja.forEach(d => console.log(`  ${d.outbound} => ${d.return_date}`));
}

run().catch(console.error);
