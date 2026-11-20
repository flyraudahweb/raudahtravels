ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checkout_key text;
CREATE UNIQUE INDEX IF NOT EXISTS bookings_checkout_key_unique ON bookings (checkout_key);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS checkout_url text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS checkout_access_code text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS checkout_initialized_at timestamptz;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS checkout_retired_at timestamptz;

ALTER TABLE ota_bookings ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE ota_bookings ADD COLUMN IF NOT EXISTS previous_payment_references jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE ota_bookings ADD COLUMN IF NOT EXISTS paid_payment_reference text;
CREATE UNIQUE INDEX IF NOT EXISTS ota_bookings_payment_reference_unique ON ota_bookings (payment_reference);
CREATE INDEX IF NOT EXISTS ota_bookings_previous_payment_references_gin ON ota_bookings USING gin (previous_payment_references);

DO $migration$
BEGIN
IF to_regclass('legacy_upload_grants') IS NULL THEN
CREATE TABLE legacy_upload_grants (
  url text NOT NULL,
  booking_id text,
  user_id text,
  CHECK (booking_id IS NOT NULL OR user_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS legacy_upload_grants_url ON legacy_upload_grants (url);

-- Capture the relationships that existed before customers could use a link to
-- request access. Future changes to user-submitted URL fields grant no access.
INSERT INTO legacy_upload_grants (url, booking_id, user_id)
SELECT url, booking_id, user_id FROM (
  SELECT unnest(ARRAY[passport_copy_url, profile_photo_url, ticket_document_url]) AS url, id AS booking_id, NULL::text AS user_id FROM bookings
  UNION SELECT url, booking_id, user_id FROM documents
  UNION SELECT unnest(ARRAY[proof_url, proof_of_payment_url]), booking_id, user_id FROM payments
  UNION SELECT unnest(ARRAY[visa_document_url, ticket_document_url]), booking_id, NULL FROM visa_applications
) AS historical_files
WHERE url LIKE '/api/files/%' OR url LIKE '/api/uploads/%';
END IF;
END
$migration$;

-- Existing agent Paystack bookings were omitted from the stored counter.
-- Hold package locks so a booking creation cannot interleave with reconciliation.
LOCK TABLE packages IN SHARE ROW EXCLUSIVE MODE;
UPDATE packages AS p SET current_bookings = COALESCE((
  SELECT sum(b.pilgrim_count) FROM bookings AS b
  WHERE b.package_id = p.id AND b.status <> 'cancelled'
), 0);
