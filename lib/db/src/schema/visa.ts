import { pgTable, text, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { bookingsTable } from "./bookings";
import { profilesTable } from "./profiles";

export const visaApplicationsTable = pgTable("visa_applications", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  bookingId: text("booking_id").notNull().references(() => bookingsTable.id, { onDelete: "cascade" }),
  pilgrimName: text("pilgrim_name"),
  passportNumber: text("passport_number"),
  status: text("status").notNull().default("pending"),
  visaNumber: text("visa_number"),
  visaExpiry: date("visa_expiry"),
  providerId: text("provider_id"),
  notes: text("notes"),
  rejectionReason: text("rejection_reason"),
  visaDocumentUrl: text("visa_document_url"),
  ticketDocumentUrl: text("ticket_document_url"),
  submittedAt: timestamp("submitted_at"),
  processedAt: timestamp("processed_at"),
  processedBy: text("processed_by").references(() => profilesTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const visaProvidersTable = pgTable("visa_providers", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  specialization: text("specialization"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVisaApplicationSchema = createInsertSchema(visaApplicationsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertVisaProviderSchema = createInsertSchema(visaProvidersTable).omit({
  id: true, createdAt: true,
});
export type VisaApplication = typeof visaApplicationsTable.$inferSelect;
export type VisaProvider = typeof visaProvidersTable.$inferSelect;
export type InsertVisaApplication = z.infer<typeof insertVisaApplicationSchema>;
export type InsertVisaProvider = z.infer<typeof insertVisaProviderSchema>;
