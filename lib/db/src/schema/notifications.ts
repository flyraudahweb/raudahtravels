import {
  pgTable,
  text,
  timestamp,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const notificationTypeEnum = pgEnum("notification_type", [
  "booking",
  "payment",
  "document",
  "support",
  "system",
]);

export const notificationsTable = pgTable("notifications", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  userId: text("user_id")
    .notNull()
    .references(() => profilesTable.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  type: notificationTypeEnum("type").notNull(),
  link: text("link"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNotificationSchema = createInsertSchema(
  notificationsTable,
).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
