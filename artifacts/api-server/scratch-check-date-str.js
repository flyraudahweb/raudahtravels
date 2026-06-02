import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const sql = neon(process.env.DATABASE_URL);
  
  const sample = await sql`SELECT id, outbound, outbound::text as txt FROM package_dates LIMIT 5`;
  console.log(sample);
}

run().catch(console.error);
