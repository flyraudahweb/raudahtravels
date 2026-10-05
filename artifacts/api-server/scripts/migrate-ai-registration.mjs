import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export async function migrateAiRegistration(client) {
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(746281010)");
    const { rows } = await client.query("SELECT to_regclass('public.ai_registration_sessions') AS existing");
    if (!rows[0].existing) await client.query(await readFile(path.join(root, "lib/db/drizzle/0007_ai_registration.sql"), "utf8"));
    await client.query(await readFile(path.join(root, "lib/db/drizzle/0008_ai_registration_reliability.sql"), "utf8"));
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  dotenv.config({ path: path.join(root, ".env") });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await migrateAiRegistration(client);
    console.log("AI registration migrations applied successfully");
  } finally { await client.end(); }
}
