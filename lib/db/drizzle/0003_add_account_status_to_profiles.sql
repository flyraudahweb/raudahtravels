ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "account_status" text NOT NULL DEFAULT 'active';
