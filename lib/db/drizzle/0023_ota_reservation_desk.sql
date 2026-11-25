CREATE TABLE IF NOT EXISTS ota_reservation_desk (
  booking_id text PRIMARY KEY,
  revision integer NOT NULL DEFAULT 0,
  assigned_to text,
  assigned_name text,
  resolved_at timestamptz,
  note text,
  service jsonb,
  finance jsonb,
  document_sent_at timestamptz,
  document_attempt_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
