import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);
export const ticketPriorityEnum = pgEnum("ticket_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const supportTicketsTable = pgTable("support_tickets", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  userId: text("user_id")
    .notNull()
    .references(() => profilesTable.id),
  subject: text("subject").notNull(),
  description: text("description"),
  category: text("category"),
  status: ticketStatusEnum("status").notNull().default("open"),
  priority: ticketPriorityEnum("priority").notNull().default("medium"),
  assignedTo: text("assigned_to").references(() => profilesTable.id),
  lastMessageAt: timestamp("last_message_at"),
  unreadCountAdmin: integer("unread_count_admin").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const supportMessagesTable = pgTable("support_messages", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  ticketId: text("ticket_id")
    .notNull()
    .references(() => supportTicketsTable.id, { onDelete: "cascade" }),
  senderId: text("sender_id")
    .notNull()
    .references(() => profilesTable.id),
  message: text("message").notNull(),
  attachmentUrl: text("attachment_url"),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSupportTicketSchema = createInsertSchema(
  supportTicketsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSupportMessageSchema = createInsertSchema(
  supportMessagesTable,
).omit({ id: true, createdAt: true });

export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type InsertSupportMessage = z.infer<typeof insertSupportMessageSchema>;
export type SupportTicket = typeof supportTicketsTable.$inferSelect;
export type SupportMessage = typeof supportMessagesTable.$inferSelect;
