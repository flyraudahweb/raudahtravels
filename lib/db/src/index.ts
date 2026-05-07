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
  // Neon serverless: generous timeouts for cold starts, limit pool size
  connectionTimeoutMillis: 30000,  // 30s to allow Neon cold-start wake-up
  idleTimeoutMillis: 20000,        // Release idle connections after 20s
  max: 5,                          // Limit concurrent connections (Neon free tier)
  keepAlive: true,                 // Prevent OS from killing idle TCP sockets
});
export const db = drizzle(pool, { schema });

export * from "./schema";
