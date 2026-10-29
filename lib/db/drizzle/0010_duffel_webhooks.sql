BEGIN;
ALTER TABLE ota_bookings ADD COLUMN IF NOT EXISTS provider_notice text;
CREATE TABLE IF NOT EXISTS ota_duffel_events (
  id text PRIMARY KEY, dedupe_key text NOT NULL UNIQUE, mode text NOT NULL CONSTRAINT ota_duffel_mode CHECK (mode IN ('test','live')), event_type text NOT NULL,
  resource jsonb NOT NULL, booking_id text REFERENCES ota_bookings(id), attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(), locked_until timestamptz, completed_at timestamptz,
  issue text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ota_duffel_events_pending ON ota_duffel_events(available_at) WHERE completed_at IS NULL;
COMMIT;
