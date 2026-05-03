import { pgTable, text, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const userActivityTable = pgTable("user_activity", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  userId: text("user_id")
    .notNull()
    .references(() => profilesTable.id),
  eventType: text("event_type").notNull(),
  packageId: text("package_id"),
  bookingId: text("booking_id"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserActivitySchema = createInsertSchema(userActivityTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUserActivity = z.infer<typeof insertUserActivitySchema>;
export type UserActivity = typeof userActivityTable.$inferSelect;
