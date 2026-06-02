import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const sql = neon(process.env.DATABASE_URL);
  
  // Find all duplicates
  // We want to keep one record for each unique combination of (outbound, return_date, outbound_route, airline)
  // For duplicates, we check if they are used in bookings.
  
  const allDates = await sql`SELECT * FROM package_dates ORDER BY created_at ASC`;
  const usedIdsRaw = await sql`SELECT DISTINCT package_date_id FROM bookings WHERE package_date_id IS NOT NULL`;
  const usedIds = new Set(usedIdsRaw.map(r => r.package_date_id));
  
  const seen = new Set();
  const toDelete = [];
  
  for (const d of allDates) {
    const key = `${d.outbound.toISOString().split('T')[0]}_${d.return_date.toISOString().split('T')[0]}_${d.outbound_route}_${d.airline}`;
    
    if (seen.has(key)) {
      // It's a duplicate
      if (usedIds.has(d.id)) {
        // We can't delete it because it's used. Let's swap the role - this used one becomes the "kept" one, 
        // but we already skipped the first one. That's fine, we just won't delete this one.
        console.log(`Duplicate but used: ${key} (ID: ${d.id})`);
      } else {
        toDelete.push(d.id);
      }
    } else {
      seen.add(key);
    }
  }
  
  console.log(`Found ${toDelete.length} duplicates safe to delete.`);
  
  if (toDelete.length > 0) {
    // Delete in chunks if needed, but it's small
    await sql`DELETE FROM package_dates WHERE id = ANY(${toDelete})`;
    console.log('Deleted successfully.');
  }
}

run().catch(console.error);
