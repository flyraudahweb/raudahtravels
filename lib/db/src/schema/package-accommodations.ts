import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { packagesTable } from "./packages";

export const packageAccommodationsTable = pgTable("package_accommodations", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  packageId: text("package_id")
    .notNull()
    .references(() => packagesTable.id, { onDelete: "cascade" }),
  city: text("city").notNull(),
  hotel: text("hotel").notNull(),
  distanceFromHaram: text("distance_from_haram"),
  distanceFromMasjid: text("distance_from_masjid"),
  rating: integer("rating").notNull().default(3),
  roomTypes: text("room_types").array().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPackageAccommodationSchema = createInsertSchema(packageAccommodationsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPackageAccommodation = z.infer<typeof insertPackageAccommodationSchema>;
export type PackageAccommodation = typeof packageAccommodationsTable.$inferSelect;
