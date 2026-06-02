import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const sql = neon(process.env.DATABASE_URL);
  
  const dates = await sql`SELECT * FROM package_dates ORDER BY outbound ASC`;
  console.log('Total dates:', dates.length);
  
  const kano = dates.filter(d => d.outbound_route === 'KANO-JEDDAH');
  const abuja = dates.filter(d => d.outbound_route === 'ABUJA-MADINAH');
  
  console.log('Kano dates:', kano.length);
  console.log('Abuja dates:', abuja.length);
  
  console.log('--- Kano ---');
  for (const d of kano) {
    console.log(`${d.outbound.toISOString().split('T')[0]} to ${d.return_date.toISOString().split('T')[0]}`);
  }
  
  console.log('--- Abuja ---');
  for (const d of abuja) {
    console.log(`${d.outbound.toISOString().split('T')[0]} to ${d.return_date.toISOString().split('T')[0]}`);
  }
}

run().catch(console.error);
