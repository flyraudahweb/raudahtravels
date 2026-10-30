import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { profilesTable } from "./profiles";

export const otaApiKeysTable = pgTable(
  "ota_api_keys",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    mode: text("mode").notNull(),
    scopes: jsonb("scopes").$type<string[]>().notNull(),
    requestsPerMinute: integer("requests_per_minute").notNull().default(30),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    requestCount: integer("request_count").notNull().default(0),
    createdBy: text("created_by").references(() => profilesTable.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    check("ota_api_key_mode", sql`${table.mode} IN ('test','live')`),
    check(
      "ota_api_key_rate",
      sql`${table.requestsPerMinute} BETWEEN 10 AND 60`,
    ),
    check("ota_api_key_count", sql`${table.requestCount} >= 0`),
  ],
);
