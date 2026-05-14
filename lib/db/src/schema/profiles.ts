import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roleEnum = pgEnum("user_role", [
  "super_admin",
  "admin",
  "moderator",
  "staff",
  "agent",
  "user",
]);

export const profilesTable = pgTable("profiles", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  role: roleEnum("role").notNull().default("user"),
  accountStatus: text("account_status").notNull().default("active"),
  languagePreference: text("language_preference").default("en"),
  ninNumber: text("nin_number"),
  passportNumber: text("passport_number"),
  dateOfBirth: text("date_of_birth"),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProfileSchema = createInsertSchema(profilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;
