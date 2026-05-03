import pg from 'pg';
import { fileURLToPath } from 'url';
import * as path from 'path';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("No DATABASE_URL found in .env");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const email = process.argv[2];
  if (!email) {
    console.error("Please provide an email address as the first argument.");
    process.exit(1);
  }

  try {
    console.log(`Checking for user ${email}...`);
    const res = await pool.query('SELECT id, role FROM profiles WHERE email = $1', [email]);
    
    if (res.rowCount === 0) {
      console.log(`❌ User with email ${email} not found in the database. Are you sure you signed in on the frontend first?`);
      process.exit(1);
    }

    console.log(`Found user! Current role: ${res.rows[0].role}`);
    
    console.log(`Promoting ${email} to super_admin...`);
    const updateRes = await pool.query("UPDATE profiles SET role = 'super_admin' WHERE email = $1 RETURNING id, role", [email]);
    
    console.log(`✅ Success! User role is now: ${updateRes.rows[0].role}`);
  } catch (err) {
    console.error("❌ Promotion failed:", err);
  } finally {
    await pool.end();
  }
}

run();
