ALTER TABLE bookings ADD COLUMN IF NOT EXISTS capacity_hold_expires_at timestamptz;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS archived_with_booking boolean NOT NULL DEFAULT false;

-- Give existing unpaid customer checkouts a grace period. Staff and agent
-- registrations have their own inventory workflow.
UPDATE bookings SET capacity_hold_expires_at = now() + interval '24 hours'
WHERE capacity_hold_expires_at IS NULL AND status = 'pending'
  AND is_archived = false AND parent_booking_id IS NULL AND agent_id IS NULL
  AND registered_by_staff_id IS NULL AND amount_paid = 0 AND user_id IS NOT NULL
  AND custom_data::jsonb ? 'checkoutFingerprint';

CREATE INDEX IF NOT EXISTS bookings_capacity_hold_expiry ON bookings (capacity_hold_expires_at)
  WHERE status = 'pending' AND is_archived = false AND parent_booking_id IS NULL;

ALTER TABLE ota_bookings ADD COLUMN IF NOT EXISTS payment_issue text;
ALTER TABLE ota_bookings ADD COLUMN IF NOT EXISTS checkout_edit_claim text;

CREATE TABLE IF NOT EXISTS ota_prebook_claims (
  key text PRIMARY KEY,
  attempt_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ota_payment_credentials (
  reference text PRIMARY KEY,
  booking_id text NOT NULL REFERENCES ota_bookings(id) ON DELETE CASCADE,
  encrypted_key text NOT NULL
);

UPDATE ota_bookings b SET payment_issue = 'Additional Paystack payment needs reconciliation'
WHERE b.payment_issue IS NULL AND EXISTS (
  SELECT 1 FROM ota_events e WHERE e.booking_id = b.id AND e.action = 'additional_payment_verified'
);
