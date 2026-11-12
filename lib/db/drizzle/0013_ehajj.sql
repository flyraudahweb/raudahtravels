BEGIN;

CREATE TABLE IF NOT EXISTS ehajj_connections (
  id text PRIMARY KEY,
  base_url text NOT NULL,
  agency_key text,
  jwt text,
  enabled boolean NOT NULL DEFAULT false,
  version text NOT NULL,
  agency_scope text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ehajj_grants (
  user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agency_scope text NOT NULL,
  product_id integer NOT NULL CHECK (product_id > 0),
  permissions text[] NOT NULL,
  PRIMARY KEY (user_id, agency_scope, product_id)
);

CREATE TABLE IF NOT EXISTS ehajj_registrations (
  id text PRIMARY KEY,
  agency_scope text NOT NULL,
  fingerprint text NOT NULL,
  state text NOT NULL DEFAULT 'prepared' CHECK (state IN ('prepared','submitting','confirmed','requires_review')),
  payload text NOT NULL,
  version text NOT NULL,
  result jsonb,
  issue text,
  created_by text NOT NULL REFERENCES profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ehajj_registration_identity ON ehajj_registrations (agency_scope, fingerprint);

COMMIT;
