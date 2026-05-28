import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

async function check() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query(`
    SELECT e.enumlabel 
    FROM pg_enum e 
    JOIN pg_type t ON e.enumtypid = t.oid 
    WHERE t.typname = 'package_type'
  `);
  console.log('\n--- Enum values in Neon DB for package_type ---');
  res.rows.forEach(r => console.log('✅ ' + r.enumlabel));
  console.log('----------------------------------------------\n');
  await client.end();
}
check().catch(console.error);
