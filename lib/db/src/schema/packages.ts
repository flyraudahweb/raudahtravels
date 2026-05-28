import {
  pgTable,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const packageTypeEnum = pgEnum("package_type", [
  "hajj", 
  "umrah",
  "visa_only",
  "ticket_only",
  "accommodation_only",
  "visa_ticket",
  "visa_accommodation",
  "accommodation_ticket"
]);
export const packageCategoryEnum = pgEnum("package_category", ["premium", "standard", "budget"]);
export const packageStatusEnum = pgEnum("package_status", ["active", "draft", "archived"]);

export const packagesTable = pgTable("packages", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  name: text("name").notNull(),
  type: packageTypeEnum("type").notNull(),
  category: packageCategoryEnum("category").notNull().default("standard"),
  season: text("season"),
  year: integer("year"),
  description: text("description").notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").default("NGN"),
  agentDiscount: numeric("agent_discount", { precision: 12, scale: 2 }).notNull().default("0"),
  depositAllowed: boolean("deposit_allowed").notNull().default(false),
  depositAmount: numeric("deposit_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  minimumDeposit: numeric("minimum_deposit", { precision: 12, scale: 2 }),
  duration: text("duration"),
  durationDays: integer("duration_days").notNull(),
  departureDate: text("departure_date").notNull(),
  returnDate: text("return_date").notNull(),
  departureCities: text("departure_cities").array().notNull().default([]),
  airlines: text("airlines").array().notNull().default([]),
  capacity: integer("capacity").notNull(),
  maxCapacity: integer("max_capacity").notNull(),
  currentBookings: integer("current_bookings").notNull().default(0),
  inclusions: text("inclusions").array().notNull().default([]),
  imageUrl: text("image_url"),
  status: packageStatusEnum("status").notNull().default("active"),
  isActive: boolean("is_active").notNull().default(true),
  featured: boolean("featured").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  starRating: integer("star_rating").notNull().default(3),
  countdownEnabled: boolean("countdown_enabled").notNull().default(false),
  countdownExpiry: text("countdown_expiry"),
  countdownAction: text("countdown_action").notNull().default("disable"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPackageSchema = createInsertSchema(packagesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertPackage = z.infer<typeof insertPackageSchema>;
export type Package = typeof packagesTable.$inferSelect;

import { relations } from "drizzle-orm";
import { packageDatesTable } from "./package-dates";

export const packagesRelations = relations(packagesTable, ({ many }) => ({
  packageDates: many(packageDatesTable),
}));
