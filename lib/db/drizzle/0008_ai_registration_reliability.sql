CREATE TABLE IF NOT EXISTS ai_registration_jobs (
  id text PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence bigint GENERATED ALWAYS AS IDENTITY NOT NULL UNIQUE,
  dedupe_key text NOT NULL UNIQUE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  channel ai_channel NOT NULL,
  channel_user_id text NOT NULL,
  session_id text REFERENCES ai_registration_sessions(id),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  last_error text
);
CREATE INDEX IF NOT EXISTS ai_jobs_ready_idx ON ai_registration_jobs(available_at, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS ai_jobs_sender_idx ON ai_registration_jobs(channel, channel_user_id, created_at);
CREATE INDEX IF NOT EXISTS ai_submissions_hash_idx ON ai_registration_submissions(passport_image_hash);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_ai_session_unique ON bookings(ai_session_id) WHERE ai_session_id IS NOT NULL;
ALTER TABLE ai_registration_sessions ADD COLUMN IF NOT EXISTS media_purged_at timestamptz;
ALTER TABLE ai_registration_submissions ADD COLUMN IF NOT EXISTS media_purged_at timestamptz;
