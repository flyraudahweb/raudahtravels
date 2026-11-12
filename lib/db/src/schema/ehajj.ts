import {
  boolean,
  pgTable,
  text,
  timestamp,
  integer,
  primaryKey,
  jsonb,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { profilesTable } from "./profiles";

export const ehajjConnectionsTable = pgTable("ehajj_connections", {
  id: text("id").primaryKey(),
  baseUrl: text("base_url").notNull(),
  agencyKey: text("agency_key"),
  jwt: text("jwt"),
  enabled: boolean("enabled").notNull().default(false),
  version: text("version").notNull(),
  agencyScope: text("agency_scope").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const ehajjGrantsTable = pgTable(
  "ehajj_grants",
  {
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    agencyScope: text("agency_scope").notNull(),
    productId: integer("product_id").notNull(),
    permissions: text("permissions").array().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.agencyScope, table.productId] }),
  ],
);

export const ehajjRegistrationsTable = pgTable(
  "ehajj_registrations",
  {
    id: text("id").primaryKey(),
    agencyScope: text("agency_scope").notNull(),
    fingerprint: text("fingerprint").notNull(),
    state: text("state").notNull().default("prepared"),
    payload: text("payload").notNull(),
    version: text("version").notNull(),
    result: jsonb("result"),
    issue: text("issue"),
    createdBy: text("created_by")
      .notNull()
      .references(() => profilesTable.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "ehajj_registration_state",
      sql`${t.state} IN ('prepared','submitting','confirmed','requires_review')`,
    ),
    uniqueIndex("ehajj_registration_identity").on(t.agencyScope, t.fingerprint),
  ],
);
