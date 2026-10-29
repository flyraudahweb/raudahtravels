BEGIN;
CREATE TABLE IF NOT EXISTS ota_bookings (
  id text PRIMARY KEY, clerk_user_id text NOT NULL,
  kind text NOT NULL CONSTRAINT ota_kind CHECK (kind IN ('flight', 'hotel')),
  mode text NOT NULL CONSTRAINT ota_mode CHECK (mode IN ('test', 'live')),
  status text NOT NULL DEFAULT 'payment_pending' CONSTRAINT ota_status CHECK (status IN ('payment_pending','processing','confirmed','cancelled','requires_review','refunded')),
  provider_offer_id text NOT NULL, provider_booking_id text UNIQUE,
  reference text NOT NULL UNIQUE, amount_kobo bigint NOT NULL CONSTRAINT ota_positive_amount CHECK (amount_kobo > 0),
  supplier_amount text NOT NULL, supplier_currency text NOT NULL,
  pricing jsonb NOT NULL, offer jsonb NOT NULL, travellers jsonb NOT NULL, contact jsonb NOT NULL,
  provider_result jsonb, authorization_url text, provider_request_id text, issue text, service_request text,
  refund jsonb, notification_sent_at timestamptz, notification_attempt_at timestamptz, synced_at timestamptz,
  expires_at timestamptz NOT NULL, paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ota_bookings_owner_created ON ota_bookings(clerk_user_id, created_at);
CREATE TABLE IF NOT EXISTS ota_events (
  id text PRIMARY KEY, booking_id text REFERENCES ota_bookings(id), actor text NOT NULL,
  action text NOT NULL, details jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ota_payment_jobs (
  reference text PRIMARY KEY, booking_id text NOT NULL REFERENCES ota_bookings(id),
  attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz, completed_at timestamptz, last_error text
);
COMMIT;
