import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const sql = neon(process.env.DATABASE_URL);
  
  // Check package_id for all dates
  const allDates = await sql`SELECT id, outbound::text, return_date::text, outbound_route, package_id FROM package_dates ORDER BY outbound_route, outbound`;
  
  console.log('=== ALL DATES WITH package_id ===');
  for (const d of allDates) {
    console.log(`${d.outbound} => ${d.return_date} | route: ${d.outbound_route} | pkg_id: ${d.package_id || 'NULL (global)'}`);
  }
  
  // Check which packages exist
  const packages = await sql`SELECT id, name, type FROM packages`;
  console.log('\n=== PACKAGES ===');
  for (const p of packages) {
    console.log(`${p.id} - ${p.name} (${p.type})`);
  }
}

run().catch(console.error);
