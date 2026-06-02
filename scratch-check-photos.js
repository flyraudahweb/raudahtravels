const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_Q53GhkruKfJU@ep-round-band-a4o9pouq.us-east-1.aws.neon.tech/neondb?sslmode=require"
  });

  try {
    await client.connect();
    const res = await client.query('SELECT id, full_name, passport_copy_url, profile_photo_url, created_at FROM bookings ORDER BY created_at DESC LIMIT 3;');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("Error executing query", err);
  } finally {
    await client.end();
  }
}

main();
