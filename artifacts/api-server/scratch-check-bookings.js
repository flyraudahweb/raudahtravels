import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const sql = neon(process.env.DATABASE_URL);
  
  const bookings = await sql`SELECT COUNT(*) FROM bookings`;
  console.log('Total bookings:', bookings[0].count);
  
  const bookingsWithDates = await sql`SELECT COUNT(*) FROM bookings WHERE package_date_id IS NOT NULL`;
  console.log('Bookings with dates:', bookingsWithDates[0].count);
}

run().catch(console.error);
