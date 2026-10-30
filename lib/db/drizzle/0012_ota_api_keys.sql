BEGIN;
CREATE TABLE IF NOT EXISTS ota_api_keys (
  id text PRIMARY KEY, name text NOT NULL, prefix text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  mode text NOT NULL CONSTRAINT ota_api_key_mode CHECK (mode IN ('test','live')),
  scopes jsonb NOT NULL,
  requests_per_minute integer NOT NULL DEFAULT 30 CONSTRAINT ota_api_key_rate CHECK (requests_per_minute BETWEEN 10 AND 60),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0 CONSTRAINT ota_api_key_count CHECK (request_count >= 0),
  created_by text REFERENCES profiles(id), created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL, last_used_at timestamptz, revoked_at timestamptz
);
COMMIT;
