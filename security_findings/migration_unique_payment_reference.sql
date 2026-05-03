-- SECURITY FIX #13: Add unique index on payments.reference and payments.paystack_reference
-- to prevent duplicate payment processing at the database level.
-- 
-- Run this via the Neon Dashboard SQL Editor (Settings > SQL Editor).
-- Do NOT run via local drizzle-kit push due to Windows ECONNRESET issues.

CREATE UNIQUE INDEX IF NOT EXISTS "payments_reference_unique"
  ON "payments" ("reference")
  WHERE "reference" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "payments_paystack_reference_unique"
  ON "payments" ("paystack_reference")
  WHERE "paystack_reference" IS NOT NULL;
