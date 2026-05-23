import {
  pgTable,
  text,
  timestamp,
  numeric,
  boolean,
  integer,
  pgEnum,
  date,
  json,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const agentStatusEnum = pgEnum("agent_status", [
  "active",
  "suspended",
  "blocked",
  "pending",
]);

export const commissionStatusEnum = pgEnum("commission_status", [
  "pending",
  "paid",
]);

export const agentsTable = pgTable("agents", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  userId: text("user_id")
    .notNull()
    .references(() => profilesTable.id)
    .unique(),
  companyName: text("company_name").default(""),
  businessName: text("business_name").notNull(),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  agentCode: text("agent_code").unique(),
  commissionRate: numeric("commission_rate", { precision: 12, scale: 2 }).notNull().default("0"),
  commissionType: text("commission_type").default("percentage"),
  status: agentStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentClientsTable = pgTable("agent_clients", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  agentId: text("agent_id")
    .notNull()
    .references(() => agentsTable.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  passportNumber: text("passport_number"),
  passportExpiry: date("passport_expiry"),
  dateOfBirth: date("date_of_birth"),
  gender: text("gender"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentWalletsTable = pgTable("agent_wallets", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  agentId: text("agent_id")
    .notNull()
    .references(() => agentsTable.id, { onDelete: "cascade" })
    .unique(),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const walletTransactionsTable = pgTable("wallet_transactions", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  agentId: text("agent_id")
    .notNull()
    .references(() => agentsTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("completed"),
  reference: text("reference").unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminOtpRequestsTable = pgTable("admin_otp_requests", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  adminId: text("admin_id")
    .notNull()
    .references(() => profilesTable.id),
  agentId: text("agent_id")
    .notNull()
    .references(() => agentsTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  otpHash: text("otp_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const staffPermissionsTable = pgTable("staff_permissions", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  userId: text("user_id")
    .notNull()
    .references(() => profilesTable.id),
  permission: text("permission").notNull(),
  grantedBy: text("granted_by").references(() => profilesTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const staffSupportSpecialtiesTable = pgTable("staff_support_specialties", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  userId: text("user_id")
    .notNull()
    .references(() => profilesTable.id),
  category: text("category").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatChannelsTable = pgTable("chat_channels", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  createdBy: text("created_by").references(() => profilesTable.id),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const staffMessagesTable = pgTable("staff_messages", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  senderId: text("sender_id")
    .notNull()
    .references(() => profilesTable.id),
  receiverId: text("receiver_id")
    .references(() => profilesTable.id),
  channelId: text("channel_id")
    .references(() => chatChannelsTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentApplicationsTable = pgTable("agent_applications", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  businessName: text("business_name").notNull(),
  contactPerson: text("contact_person").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  bio: text("bio"),
  experienceYears: integer("experience_years").default(0),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  status: text("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const agentPackageDiscountsTable = pgTable("agent_package_discounts", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  agentId: text("agent_id").notNull(),
  packageId: text("package_id").notNull(),
  discountType: text("discount_type").notNull().default("percentage"),
  discountValue: numeric("discount_value", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertAgentSchema = createInsertSchema(agentsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertAgentClientSchema = createInsertSchema(agentClientsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertWalletTransactionSchema = createInsertSchema(walletTransactionsTable).omit({
  id: true, createdAt: true,
});

export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type InsertAgentClient = z.infer<typeof insertAgentClientSchema>;
export type Agent = typeof agentsTable.$inferSelect;
export type AgentClient = typeof agentClientsTable.$inferSelect;
export type AgentWallet = typeof agentWalletsTable.$inferSelect;
export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;
export type StaffPermission = typeof staffPermissionsTable.$inferSelect;
export type ChatChannel = typeof chatChannelsTable.$inferSelect;
export type StaffMessage = typeof staffMessagesTable.$inferSelect;
