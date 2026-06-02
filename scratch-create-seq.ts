import { db } from "../lib/db/src/index.js";
import { sql } from "drizzle-orm";

async function main() {
  try {
    console.log("Creating sequence if not exists...");
    await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS bookings_id_number_seq START 1001;`);
    console.log("Sequence created or already exists.");
  } catch (error) {
    console.error("Error creating sequence:", error);
  }
  process.exit(0);
}

main();
