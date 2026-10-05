-- 0007_ai_registration.sql
-- AI-assisted registration: sessions, messages, submissions, audit
-- All additive / nullable — no breaking changes to existing tables.

-- ── Enums ────────────────────────────────────────────────────────────────

CREATE TYPE "ai_channel" AS ENUM ('whatsapp', 'telegram');
CREATE TYPE "ai_session_status" AS ENUM (
  'collecting', 'ready_for_review', 'pending_review',
  'approved', 'rejected', 'expired', 'cancelled'
);
CREATE TYPE "ai_session_step" AS ENUM (
  'awaiting_name', 'awaiting_contact', 'awaiting_package',
  'awaiting_passport_image', 'awaiting_confirmation', 'done'
);
CREATE TYPE "ai_duplicate_status" AS ENUM (
  'no_duplicate_detected', 'possible_duplicate', 'duplicate_confirmed'
);
CREATE TYPE "ai_extraction_provider" AS ENUM ('gemini', 'mistral', 'manual');
CREATE TYPE "ai_submission_status" AS ENUM ('pending_review', 'approved', 'rejected');
CREATE TYPE "ai_message_direction" AS ENUM ('inbound', 'outbound');
CREATE TYPE "ai_message_type" AS ENUM ('text', 'image', 'document', 'button', 'system');

-- ── Sessions ─────────────────────────────────────────────────────────────

CREATE TABLE "ai_registration_sessions" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
  "channel" "ai_channel" NOT NULL,
  "channel_user_id" text NOT NULL,
  "phone" text,
  "telegram_username" text,
  "display_name" text,
  "status" "ai_session_status" NOT NULL DEFAULT 'collecting',
  "current_step" "ai_session_step" NOT NULL DEFAULT 'awaiting_name',
  "collected_data" json NOT NULL DEFAULT '{}',
  "missing_fields" json NOT NULL DEFAULT '[]',
  "passport_image_r2_key" text,
  "passport_image_hash" text,
  "attachments" json NOT NULL DEFAULT '[]',
  "extraction_result" json,
  "extraction_provider" "ai_extraction_provider",
  "extraction_confidence" integer,
  "fallback_triggered" boolean NOT NULL DEFAULT false,
  "fallback_reason" text,
  "extraction_attempts" integer NOT NULL DEFAULT 0,
  "duplicate_status" "ai_duplicate_status",
  "duplicate_matches" json NOT NULL DEFAULT '[]',
  "duplicate_checked_at" timestamp,
  "booking_id" text REFERENCES "bookings"("id"),
  "last_message_at" timestamp,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "ai_sessions_channel_user_idx"
  ON "ai_registration_sessions" ("channel", "channel_user_id");
CREATE INDEX "ai_sessions_status_idx"
  ON "ai_registration_sessions" ("status");
CREATE INDEX "ai_sessions_expires_idx"
  ON "ai_registration_sessions" ("expires_at");

-- ── Messages ─────────────────────────────────────────────────────────────

CREATE TABLE "ai_registration_messages" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" text NOT NULL REFERENCES "ai_registration_sessions"("id") ON DELETE CASCADE,
  "direction" "ai_message_direction" NOT NULL,
  "type" "ai_message_type" NOT NULL DEFAULT 'text',
  "channel_message_id" text NOT NULL UNIQUE,
  "body" text,
  "media_r2_key" text,
  "media_mime_type" text,
  "metadata" json,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "ai_messages_session_idx"
  ON "ai_registration_messages" ("session_id");

-- ── Submissions ──────────────────────────────────────────────────────────

CREATE TABLE "ai_registration_submissions" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" text NOT NULL UNIQUE
    REFERENCES "ai_registration_sessions"("id") ON DELETE CASCADE,
  "snapshot" json NOT NULL,
  "passport_image_r2_key" text,
  "passport_image_hash" text,
  "extraction_provider" "ai_extraction_provider",
  "duplicate_status" "ai_duplicate_status",
  "duplicate_matches" json NOT NULL DEFAULT '[]',
  "status" "ai_submission_status" NOT NULL DEFAULT 'pending_review',
  "review_data" json,
  "review_notes" text,
  "rejection_reason" text,
  "duplicate_override_reason" text,
  "reviewed_by_id" text REFERENCES "profiles"("id"),
  "reviewed_at" timestamp,
  "booking_id" text REFERENCES "bookings"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "ai_submissions_status_idx"
  ON "ai_registration_submissions" ("status");
CREATE INDEX "ai_submissions_duplicate_idx"
  ON "ai_registration_submissions" ("duplicate_status");

-- ── Audit ────────────────────────────────────────────────────────────────

CREATE TABLE "ai_registration_audit" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" text REFERENCES "ai_registration_sessions"("id") ON DELETE CASCADE,
  "submission_id" text REFERENCES "ai_registration_submissions"("id") ON DELETE CASCADE,
  "event" text NOT NULL,
  "actor" text NOT NULL DEFAULT 'system',
  "metadata" json,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "ai_audit_session_idx"
  ON "ai_registration_audit" ("session_id");
CREATE INDEX "ai_audit_submission_idx"
  ON "ai_registration_audit" ("submission_id");

-- ── Bookings: additive columns ───────────────────────────────────────────

ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS "ai_session_id" text,
  ADD COLUMN IF NOT EXISTS "review_status" text,
  ADD COLUMN IF NOT EXISTS "reviewed_by_id" text REFERENCES "profiles"("id"),
  ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp,
  ADD COLUMN IF NOT EXISTS "duplicate_status" text,
  ADD COLUMN IF NOT EXISTS "duplicate_matches" json;

CREATE INDEX "bookings_source_idx" ON "bookings" ("source");
CREATE INDEX "bookings_review_status_idx" ON "bookings" ("review_status");
