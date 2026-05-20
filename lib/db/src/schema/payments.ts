import {
  pgTable,
  text,
  timestamp,
  numeric,
  pgEnum,
} from "drizzle-orm/pg-core";
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
  userId: text("user_id")
    .references(() => profilesTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  method: paymentMethodEnum("method").notNull(),
  status: paymentStatusEnum("status").notNull().default("pending"),
  reference: text("reference"),
  paystackReference: text("paystack_reference"),
  proofUrl: text("proof_url"),
  proofOfPaymentUrl: text("proof_of_payment_url"),
  verifiedBy: text("verified_by").references(() => profilesTable.id),
  verifiedAt: timestamp("verified_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
