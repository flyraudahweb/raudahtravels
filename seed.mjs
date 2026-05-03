import fs from 'fs';
import path from 'path';
import pg from 'pg';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("No DATABASE_URL found in .env");
  process.exit(1);
}

console.log("Connecting to database...");

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log("Reading migrate.sql...");
    const sqlPath = path.resolve(__dirname, 'lib/db/migrate.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    
    console.log("Executing migration SQL directly...");
    await pool.query(sql);
    console.log("✅ Migration completed successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    await pool.end();
  }
}

run();
