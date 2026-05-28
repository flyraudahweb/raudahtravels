import { Client } from 'pg';
async function setupSeq() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  // Create sequence
  await client.query('CREATE SEQUENCE IF NOT EXISTS bookings_id_number_seq START WITH 1001');
  
  // Update all currently confirmed or completed bookings that have no id_number
  const res = await client.query(`
    UPDATE bookings 
    SET id_number = nextval('bookings_id_number_seq') 
    WHERE id_number IS NULL AND status IN ('confirmed', 'completed')
    RETURNING id, id_number, reference
  `);
  
  console.log('Updated ' + res.rowCount + ' bookings with idNumber');
  await client.end();
}
setupSeq().catch(console.error);
