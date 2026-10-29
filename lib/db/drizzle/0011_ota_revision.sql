BEGIN;
-- Prevent stale supplier/admin responses from overwriting newer booking updates.
ALTER TABLE ota_bookings ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;
ALTER TABLE ota_bookings ADD COLUMN IF NOT EXISTS sync_attempt_at timestamptz;
COMMIT;
