const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_Q53GhkruKfJU@ep-round-band-a4o9pouq.us-east-1.aws.neon.tech/neondb?sslmode=require"
  });

  try {
    await client.connect();
    console.log("Connected to DB");
    
    await client.query('CREATE SEQUENCE IF NOT EXISTS bookings_id_number_seq START 1001;');
    console.log("Sequence bookings_id_number_seq created successfully.");
    
  } catch (err) {
    console.error("Error executing query", err);
  } finally {
    await client.end();
  }
}

main();
