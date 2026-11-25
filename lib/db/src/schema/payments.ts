import {
  pgTable,
  text,
  timestamp,
  numeric,
  pgEnum,
  boolean,
  bigint,
  unique,
  check,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { bookingsTable } from "./bookings";

export const paymentMethodEnum = pgEnum("payment_method", [
  "paystack",
  "bank_transfer",
  "ussd",
  "cash",
  "wallet",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "verified",
  "rejected",
  "refunded",
]);

export const paymentsTable = pgTable("payments", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  bookingId: text("booking_id")
    .notNull()
    .references(() => bookingsTable.id),
  userId: text("user_id").references(() => profilesTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  method: paymentMethodEnum("method").notNull(),
  status: paymentStatusEnum("status").notNull().default("pending"),
  reference: text("reference"),
  paystackReference: text("paystack_reference"),
  checkoutUrl: text("checkout_url"),
  checkoutAccessCode: text("checkout_access_code"),
  checkoutInitializedAt: timestamp("checkout_initialized_at", {
    withTimezone: true,
  }),
  checkoutRetiredAt: timestamp("checkout_retired_at", { withTimezone: true }),
  checkoutExpiresAt: timestamp("checkout_expires_at", { withTimezone: true }),
  checkoutMode: text("checkout_mode"),
  checkoutKeyFingerprint: text("checkout_key_fingerprint"),
  proofUrl: text("proof_url"),
  proofOfPaymentUrl: text("proof_of_payment_url"),
  verifiedBy: text("verified_by").references(() => profilesTable.id),
  verifiedAt: timestamp("verified_at"),
  notes: text("notes"),
  isArchived: boolean("is_archived").default(false).notNull(),
  archiveReason: text("archive_reason"),
  archivedWithBooking: boolean("archived_with_booking").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  check("payments_checkout_mode", sql`${table.checkoutMode} IS NULL OR ${table.checkoutMode} IN ('test', 'live')`),
  uniqueIndex("payments_active_online_checkout")
    .on(table.bookingId)
    .where(sql`${table.method} = 'paystack' AND ${table.checkoutMode} IS NOT NULL AND ${table.checkoutRetiredAt} IS NULL AND ${table.status} IN ('pending', 'rejected')`),
]);

export const paystackSettlementsTable = pgTable("paystack_settlements", {
  mode: text("mode").notNull(),
  providerId: text("provider_id").notNull(),
  reference: text("reference").notNull(),
  kind: text("kind").notNull(),
  bookingId: text("booking_id").notNull(),
  packagePaymentId: text("package_payment_id"),
  amountKobo: bigint("amount_kobo", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("paystack_settlements_transaction").on(table.mode, table.providerId),
  unique("paystack_settlements_reference").on(table.mode, table.reference),
  check("paystack_settlements_mode", sql`${table.mode} IN ('test', 'live')`),
  check("paystack_settlements_kind", sql`(${table.kind} = 'package') = (${table.packagePaymentId} IS NOT NULL) AND ${table.kind} IN ('package', 'ota')`),
  check("paystack_settlements_amount", sql`${table.amountKobo} > 0`),
]);

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
