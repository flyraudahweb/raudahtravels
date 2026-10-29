import {
  pgTable,
  text,
  jsonb,
  timestamp,
  bigint,
  index,
  check,
  integer,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// A durable checkout survives payment redirects, duplicate webhooks and restarts.
export const otaBookingsTable = pgTable(
  "ota_bookings",
  {
    id: text("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    kind: text("kind").notNull(),
    mode: text("mode").notNull(),
    status: text("status").notNull().default("payment_pending"),
    revision: integer("revision").notNull().default(0),
    providerOfferId: text("provider_offer_id").notNull(),
    providerBookingId: text("provider_booking_id").unique(),
    reference: text("reference").notNull().unique(),
    amountKobo: bigint("amount_kobo", { mode: "number" }).notNull(),
    supplierAmount: text("supplier_amount").notNull(),
    supplierCurrency: text("supplier_currency").notNull(),
    pricing: jsonb("pricing").notNull(),
    offer: jsonb("offer").notNull(),
    travellers: jsonb("travellers").notNull(),
    contact: jsonb("contact").notNull(),
    providerResult: jsonb("provider_result"),
    providerNotice: text("provider_notice"),
    authorizationUrl: text("authorization_url"),
    providerRequestId: text("provider_request_id"),
    issue: text("issue"),
    serviceRequest: text("service_request"),
    refund: jsonb("refund"),
    notificationSentAt: timestamp("notification_sent_at", {
      withTimezone: true,
    }),
    notificationAttemptAt: timestamp("notification_attempt_at", {
      withTimezone: true,
    }),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    syncAttemptAt: timestamp("sync_attempt_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("ota_bookings_owner_created").on(t.clerkUserId, t.createdAt),
    check("ota_kind", sql`${t.kind} IN ('flight', 'hotel')`),
    check("ota_mode", sql`${t.mode} IN ('test', 'live')`),
    check(
      "ota_status",
      sql`${t.status} IN ('payment_pending','processing','confirmed','cancelled','requires_review','refunded')`,
    ),
    check("ota_positive_amount", sql`${t.amountKobo} > 0`),
  ],
);

export const otaEventsTable = pgTable("ota_events", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").references(() => otaBookingsTable.id),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const otaPaymentJobsTable = pgTable("ota_payment_jobs", {
  reference: text("reference").primaryKey(),
  bookingId: text("booking_id")
    .notNull()
    .references(() => otaBookingsTable.id),
  attempts: integer("attempts").notNull().default(0),
  availableAt: timestamp("available_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  lastError: text("last_error"),
});

export const otaDuffelEventsTable = pgTable(
  "ota_duffel_events",
  {
    id: text("id").primaryKey(),
    dedupeKey: text("dedupe_key").notNull().unique(),
    mode: text("mode").notNull(),
    eventType: text("event_type").notNull(),
    resource: jsonb("resource").notNull(),
    bookingId: text("booking_id").references(() => otaBookingsTable.id),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    issue: text("issue"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ota_duffel_events_pending")
      .on(t.availableAt)
      .where(sql`${t.completedAt} IS NULL`),
    check("ota_duffel_mode", sql`${t.mode} IN ('test','live')`),
  ],
);
