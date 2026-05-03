import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { bookingsTable } from "./bookings";

export const documentTypeEnum = pgEnum("document_type", [
  "passport",
  "vaccine_certificate",
  "visa",
  "flight_ticket",
  "hotel_voucher",
  "booking_confirmation",
  "payment_receipt",
  "pre_departure_guide",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "pending",
  "approved",
  "rejected",
]);

export const documentsTable = pgTable("documents", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  userId: text("user_id")
    .notNull()
    .references(() => profilesTable.id),
  bookingId: text("booking_id").references(() => bookingsTable.id),
  type: documentTypeEnum("type").notNull(),
  url: text("url").notNull(),
  fileName: text("file_name"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  status: documentStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documentsTable.$inferSelect;
