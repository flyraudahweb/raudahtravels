ALTER TABLE ota_bookings ADD COLUMN IF NOT EXISTS checkout_key text;
ALTER TABLE ota_bookings ADD COLUMN IF NOT EXISTS payment_initialization_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS ota_checkout_key_unique
  ON ota_bookings (checkout_key) WHERE checkout_key IS NOT NULL;
