import {
  pgTable,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  pgEnum,
  json,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { packagesTable } from "./packages";
import { agentsTable, agentClientsTable } from "./agents";
import { packageDatesTable } from "./package-dates";

export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
]);

export const pilgrimTypeEnum = pgEnum("pilgrim_type", [
  "adult",
  "child",
  "infant",
]);

export const bookingsTable = pgTable("bookings", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  reference: text("reference").unique(),
  userId: text("user_id")
    .references(() => profilesTable.id),
  packageId: text("package_id")
    .notNull()
    .references(() => packagesTable.id),
  packageDateId: text("package_date_id").references(() => packageDatesTable.id),
  agentId: text("agent_id").references(() => agentsTable.id),
  agentClientId: text("agent_client_id").references(() => agentClientsTable.id),
  status: bookingStatusEnum("status").notNull().default("pending"),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull().default("0"),
  pilgrimCount: integer("pilgrim_count").notNull().default(1),

  // Civility / name split
  civility: text("civility"),
  firstName: text("first_name"),
  lastName: text("last_name"),

  // Pilgrim personal details
  fullName: text("full_name"),
  passportNumber: text("passport_number"),
  passportIssueDate: date("passport_issue_date"),
  passportExpiry: date("passport_expiry"),
  passportIssuingAuthority: text("passport_issuing_authority"),
  passportCopyUrl: text("passport_copy_url"),
  profilePhotoUrl: text("profile_photo_url"),
  dateOfBirth: date("date_of_birth"),
  gender: text("gender"),
  nationality: text("nationality"),
  placeOfBirth: text("place_of_birth"),
  ethnicGroup: text("ethnic_group"),
  maritalStatus: text("marital_status"),
  levelOfStudy: text("level_of_study"),
  occupation: text("occupation"),
  email: text("email"),
  phone: text("phone"),
  country: text("country"),
  city: text("city"),
  address: text("address"),
  observation: text("observation"),

  // Visa
  visaNumber: text("visa_number"),

  // Partner / Mahram
  partner: text("partner"),
  underCover: text("under_cover"),
  fathersName: text("fathers_name"),
  mothersName: text("mothers_name"),
  mahramName: text("mahram_name"),
  mahramRelationship: text("mahram_relationship"),
  mahramPassport: text("mahram_passport"),

  // Health
  meningitisVaccineDate: date("meningitis_vaccine_date"),
  previousUmrah: boolean("previous_umrah"),
  previousUmrahYear: integer("previous_umrah_year"),

  // Emergency contact
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  emergencyContactRelationship: text("emergency_contact_relationship"),

  // Room pricing
  roomPreference: text("room_preference"),
  roomSurcharge: numeric("room_surcharge", { precision: 12, scale: 2 }).default("0"),

  // Travel preferences
  departureCity: text("departure_city"),
  specialRequests: text("special_requests"),

  // Admin fields
  customData: json("custom_data"),
  visaDeliveryMessage: text("visa_delivery_message"),
  ticketDocumentUrl: text("ticket_document_url"),
  ticketDeliveryMessage: text("ticket_delivery_message"),
  ticketUploadedAt: timestamp("ticket_uploaded_at"),

  // ID Tag number (sequential, assigned at booking confirmation)
  idNumber: integer("id_number"),

  // Pilgrim type (adult, child, infant) and parent linkage
  pilgrimType: pilgrimTypeEnum("pilgrim_type").default("adult"),
  parentBookingId: text("parent_booking_id"),

  // Bulk registration batch grouping
  batchId: text("batch_id"),

  // Registration tracking
  registeredByStaffId: text("registered_by_staff_id").references(() => profilesTable.id),

  // Legacy / compat
  pilgrimDetails: text("pilgrim_details"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const commissionsTable = pgTable("commissions", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  agentId: text("agent_id")
    .notNull()
    .references(() => agentsTable.id),
  bookingId: text("booking_id")
    .notNull()
    .references(() => bookingsTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bookingAmendmentRequestsTable = pgTable("booking_amendment_requests", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  bookingId: text("booking_id")
    .notNull()
    .references(() => bookingsTable.id),
  userId: text("user_id")
    .references(() => profilesTable.id),
  requestedChanges: json("requested_changes"),
  status: text("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  reviewedBy: text("reviewed_by").references(() => profilesTable.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertAmendmentRequestSchema = createInsertSchema(bookingAmendmentRequestsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
export type Commission = typeof commissionsTable.$inferSelect;
export type BookingAmendmentRequest = typeof bookingAmendmentRequestsTable.$inferSelect;

import { relations } from "drizzle-orm";

export const bookingsRelations = relations(bookingsTable, ({ one }) => ({
  packageDate: one(packageDatesTable, {
    fields: [bookingsTable.packageDateId],
    references: [packageDatesTable.id],
  }),
  package: one(packagesTable, {
    fields: [bookingsTable.packageId],
    references: [packagesTable.id],
  }),
}));
