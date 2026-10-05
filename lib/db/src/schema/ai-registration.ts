import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
  json,
  jsonb,
  bigint,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { bookingsTable } from "./bookings";

/* ── Enums ─────────────────────────────────────────────────────────────── */

export const aiChannelEnum = pgEnum("ai_channel", ["whatsapp", "telegram"]);

export const aiSessionStatusEnum = pgEnum("ai_session_status", [
  "collecting",
  "ready_for_review",
  "pending_review",
  "approved",
  "rejected",
  "expired",
  "cancelled",
]);

export const aiSessionStepEnum = pgEnum("ai_session_step", [
  "awaiting_name",
  "awaiting_contact",
  "awaiting_package",
  "awaiting_passport_image",
  "awaiting_confirmation",
  "done",
]);

export const aiDuplicateStatusEnum = pgEnum("ai_duplicate_status", [
  "no_duplicate_detected",
  "possible_duplicate",
  "duplicate_confirmed",
]);

export const aiExtractionProviderEnum = pgEnum("ai_extraction_provider", [
  "gemini",
  "mistral",
  "manual",
]);

export const aiSubmissionStatusEnum = pgEnum("ai_submission_status", [
  "pending_review",
  "approved",
  "rejected",
]);

export const aiMessageDirectionEnum = pgEnum("ai_message_direction", [
  "inbound",
  "outbound",
]);

export const aiMessageTypeEnum = pgEnum("ai_message_type", [
  "text",
  "image",
  "document",
  "button",
  "system",
]);

/* ── Sessions: durable conversation state ──────────────────────────────── */

export const aiRegistrationSessionsTable = pgTable("ai_registration_sessions", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  channel: aiChannelEnum("channel").notNull(),
  /** Platform-scoped user id (WhatsApp wa_id / Telegram chat id) */
  channelUserId: text("channel_user_id").notNull(),
  /** Normalized E.164 phone when known */
  phone: text("phone"),
  telegramUsername: text("telegram_username"),
  /** Human-friendly display name for the reviewer */
  displayName: text("display_name"),

  status: aiSessionStatusEnum("status").notNull().default("collecting"),
  currentStep: aiSessionStepEnum("current_step")
    .notNull()
    .default("awaiting_name"),

  /** Everything gathered from the user + extraction, channel-agnostic */
  collectedData: json("collected_data").notNull().default({}),
  /** Fields still required before submission */
  missingFields: json("missing_fields").notNull().default([]),

  /** R2 keys for passport media (latest + any extra images the user sent) */
  mediaPurgedAt: timestamp("media_purged_at", { withTimezone: true }),
  passportImageR2Key: text("passport_image_r2_key"),
  passportImageHash: text("passport_image_hash"),
  attachments: json("attachments").notNull().default([]),

  /** Raw AI extraction output, kept for reviewer comparison */
  extractionResult: json("extraction_result"),
  extractionProvider: aiExtractionProviderEnum("extraction_provider"),
  extractionConfidence: integer("extraction_confidence"),
  fallbackTriggered: boolean("fallback_triggered").notNull().default(false),
  fallbackReason: text("fallback_reason"),
  extractionAttempts: integer("extraction_attempts").notNull().default(0),

  duplicateStatus: aiDuplicateStatusEnum("duplicate_status"),
  duplicateMatches: json("duplicate_matches").notNull().default([]),
  duplicateCheckedAt: timestamp("duplicate_checked_at"),

  /** Linked booking once a human approves */
  bookingId: text("booking_id").references(() => bookingsTable.id),

  lastMessageAt: timestamp("last_message_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* ── Messages: full transcript + idempotency keys ──────────────────────── */

export const aiRegistrationMessagesTable = pgTable("ai_registration_messages", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id")
    .notNull()
    .references(() => aiRegistrationSessionsTable.id, { onDelete: "cascade" }),
  direction: aiMessageDirectionEnum("direction").notNull(),
  type: aiMessageTypeEnum("type").notNull().default("text"),
  /**
   * Unique platform id (WhatsApp wamid.*, Telegram update_id). The unique
   * constraint is what makes webhook delivery idempotent.
   */
  channelMessageId: text("channel_message_id").notNull().unique(),
  body: text("body"),
  mediaR2Key: text("media_r2_key"),
  mediaMimeType: text("media_mime_type"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Submissions: the review artifact ──────────────────────────────────── */

export const aiRegistrationSubmissionsTable = pgTable("ai_registration_submissions", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id")
    .notNull()
    .unique()
    .references(() => aiRegistrationSessionsTable.id, { onDelete: "cascade" }),

  /**
   * Frozen copy of collected + extracted data at submit time, so later edits
   * to the session never rewrite history.
   */
  snapshot: json("snapshot").notNull(),
  mediaPurgedAt: timestamp("media_purged_at", { withTimezone: true }),
  passportImageR2Key: text("passport_image_r2_key"),
  passportImageHash: text("passport_image_hash"),
  extractionProvider: aiExtractionProviderEnum("extraction_provider"),
  duplicateStatus: aiDuplicateStatusEnum("duplicate_status"),
  duplicateMatches: json("duplicate_matches").notNull().default([]),

  status: aiSubmissionStatusEnum("status").notNull().default("pending_review"),

  /** Staff corrections applied during review */
  reviewData: json("review_data"),
  reviewNotes: text("review_notes"),
  rejectionReason: text("rejection_reason"),
  /** Set when staff knowingly overrode a duplicate_confirmed flag */
  duplicateOverrideReason: text("duplicate_override_reason"),

  reviewedById: text("reviewed_by_id").references(() => profilesTable.id),
  reviewedAt: timestamp("reviewed_at"),

  /** Resulting real booking (set on approval) */
  bookingId: text("booking_id").references(() => bookingsTable.id),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* ── Audit: append-only event log ──────────────────────────────────────── */

export const aiRegistrationAuditTable = pgTable("ai_registration_audit", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").references(() => aiRegistrationSessionsTable.id, {
    onDelete: "cascade",
  }),
  submissionId: text("submission_id").references(
    () => aiRegistrationSubmissionsTable.id,
    { onDelete: "cascade" },
  ),
  event: text("event").notNull(),
  /** "system" | "user" | "ai:gemini" | "ai:mistral" | "staff:<id>" */
  actor: text("actor").notNull().default("system"),
  /** Field-level detail. Never store raw passport images or full doc numbers. */
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Zod schemas ───────────────────────────────────────────────────────── */

export const insertAiRegistrationSessionSchema = createInsertSchema(
  aiRegistrationSessionsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export const insertAiRegistrationMessageSchema = createInsertSchema(
  aiRegistrationMessagesTable,
).omit({ id: true, createdAt: true });

export const insertAiRegistrationSubmissionSchema = createInsertSchema(
  aiRegistrationSubmissionsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export const insertAiRegistrationAuditSchema = createInsertSchema(
  aiRegistrationAuditTable,
).omit({ id: true, createdAt: true });

export type AiRegistrationSession = typeof aiRegistrationSessionsTable.$inferSelect;
export type AiRegistrationMessage = typeof aiRegistrationMessagesTable.$inferSelect;
export type AiRegistrationSubmission = typeof aiRegistrationSubmissionsTable.$inferSelect;
export type AiRegistrationAudit = typeof aiRegistrationAuditTable.$inferSelect;
export type InsertAiRegistrationSession = z.infer<typeof insertAiRegistrationSessionSchema>;
export type InsertAiRegistrationMessage = z.infer<typeof insertAiRegistrationMessageSchema>;
export type InsertAiRegistrationSubmission = z.infer<
  typeof insertAiRegistrationSubmissionSchema
>;
export type InsertAiRegistrationAudit = z.infer<typeof insertAiRegistrationAuditSchema>;

export const aiRegistrationJobsTable = pgTable("ai_registration_jobs", {
  sequence: bigint("sequence", { mode: "number" }).generatedAlwaysAsIdentity().notNull().unique(),
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  dedupeKey: text("dedupe_key").notNull().unique(),
  direction: text("direction").notNull(), channel: aiChannelEnum("channel").notNull(),
  channelUserId: text("channel_user_id").notNull(), sessionId: text("session_id").references(() => aiRegistrationSessionsTable.id),
  payload: jsonb("payload").notNull(), status: text("status").notNull().default("pending"), attempts: integer("attempts").notNull().default(0),
  availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }), lastError: text("last_error"),
});
