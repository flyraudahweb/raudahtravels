CREATE TABLE IF NOT EXISTS ota_followups (
  id text PRIMARY KEY,
  booking_id text UNIQUE,
  clerk_user_id text NOT NULL,
  kind text NOT NULL CONSTRAINT ota_followups_kind CHECK (kind IN ('hotel', 'flight')),
  trip text NOT NULL,
  phone text,
  email text,
  requested_at timestamptz,
  assigned_to text,
  assigned_name text,
  outcome text CONSTRAINT ota_followups_outcome CHECK (outcome IN ('reached', 'no_answer', 'resolved')),
  note text,
  blocker text,
  blocked_revision integer,
  revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ota_followups_updated ON ota_followups (updated_at);
CREATE INDEX IF NOT EXISTS ota_followups_owner_request ON ota_followups (clerk_user_id, requested_at);
