import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const loginSessionsTable = pgTable("login_sessions", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  clerkUserId: text("clerk_user_id").notNull(),
  clerkSessionId: text("clerk_session_id").notNull(),
  otpHash: text("otp_hash"),
  otpExpiresAt: timestamp("otp_expires_at"),
  verifiedAt: timestamp("verified_at"),
  sessionExpiresAt: timestamp("session_expires_at"),
  notificationSentAt: timestamp("notification_sent_at"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type LoginSession = typeof loginSessionsTable.$inferSelect;
