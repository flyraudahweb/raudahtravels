import { pgTable, text, timestamp, boolean, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bookingFormFieldsTable = pgTable("booking_form_fields", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  label: text("label").notNull(),
  fieldName: text("field_name").notNull(),
  fieldType: text("field_type").notNull(),
  placeholder: text("placeholder"),
  required: boolean("required").notNull().default(false),
  appliesTo: text("applies_to").notNull().default("all"),
  sortOrder: integer("sort_order").notNull().default(0),
  options: json("options"),
  accept: text("accept"),
  isSystem: boolean("is_system").notNull().default(false),
  enabled: boolean("enabled").notNull().default(true),
  section: text("section").notNull().default("pilgrim_info"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBookingFormFieldSchema = createInsertSchema(bookingFormFieldsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBookingFormField = z.infer<typeof insertBookingFormFieldSchema>;
export type BookingFormField = typeof bookingFormFieldsTable.$inferSelect;
