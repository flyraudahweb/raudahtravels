import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Enable SSL for hosted PostgreSQL providers (Neon, Supabase, etc.)
const connectionString = process.env.DATABASE_URL;
const useSSL = connectionString.includes("neon.tech") || 
               connectionString.includes("supabase.co") ||
               connectionString.includes("sslmode=require");

export const pool = new Pool({ 
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
