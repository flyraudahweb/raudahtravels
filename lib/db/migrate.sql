-- ============================================================
-- Raudah Travels — Full Schema Migration
-- ============================================================
-- NOTE: ALTER TYPE ADD VALUE cannot run inside a transaction block.
-- Run this file in psql directly.

-- Step 1: Add enum values (must be outside transaction)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'moderator' BEFORE 'staff';
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'closed';
ALTER TYPE ticket_priority ADD VALUE IF NOT EXISTS 'urgent';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'wallet';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refunded';

-- Create package_status enum
DO $$ BEGIN
  CREATE TYPE package_status AS ENUM ('active', 'draft', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Step 2: Rename document_type enum (no documents in DB yet)
ALTER TYPE document_type RENAME TO document_type_old;
CREATE TYPE document_type AS ENUM (
  'passport',
  'vaccine_certificate',
  'visa',
  'flight_ticket',
  'hotel_voucher',
  'booking_confirmation',
  'payment_receipt',
  'pre_departure_guide'
);
ALTER TABLE documents ALTER COLUMN type TYPE document_type USING type::text::document_type;
DROP TYPE document_type_old;

-- Step 3: Migrate agent_status enum (pending/approved/rejected → active/suspended/pending)
ALTER TYPE agent_status RENAME TO agent_status_old;
CREATE TYPE agent_status AS ENUM ('active', 'suspended', 'pending');
ALTER TABLE agent_profiles ALTER COLUMN status DROP DEFAULT;
ALTER TABLE agent_profiles ALTER COLUMN status TYPE agent_status USING (
  CASE status::text
    WHEN 'approved' THEN 'active'::agent_status
    WHEN 'rejected' THEN 'suspended'::agent_status
    ELSE 'pending'::agent_status
  END
);
ALTER TABLE agent_profiles ALTER COLUMN status SET DEFAULT 'pending';
DROP TYPE agent_status_old;

-- Step 4: Rename agent_profiles → agents, drop commissions (will recreate)
DROP TABLE IF EXISTS commissions;
ALTER TABLE agent_profiles RENAME TO agents;

-- Add new columns to agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS agent_code TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'percentage';
UPDATE agents SET business_name = company_name WHERE business_name IS NULL;

-- Step 5: Update profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language_preference TEXT DEFAULT 'en';

-- Step 6: Update packages
ALTER TABLE packages ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'NGN';
ALTER TABLE packages ADD COLUMN IF NOT EXISTS deposit_allowed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS minimum_deposit NUMERIC(12,2);
ALTER TABLE packages ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS capacity INTEGER;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS status package_status NOT NULL DEFAULT 'active';
UPDATE packages SET capacity = max_capacity WHERE capacity IS NULL;
ALTER TABLE packages ALTER COLUMN capacity SET NOT NULL;
-- Sync featured with is_featured
UPDATE packages SET featured = is_featured;

-- Step 7: Update bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reference TEXT UNIQUE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS package_date_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS agent_client_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS passport_number TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS passport_expiry DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS nationality TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS place_of_birth TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS marital_status TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS occupation TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS fathers_name TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS mothers_name TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS mahram_name TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS mahram_relationship TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS mahram_passport TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS meningitis_vaccine_date DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS previous_umrah BOOLEAN;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS previous_umrah_year INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS departure_city TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room_preference TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS special_requests TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS custom_data JSONB;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS visa_delivery_message TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ticket_document_url TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ticket_delivery_message TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ticket_uploaded_at TIMESTAMPTZ;
-- Drop old agent FK to profiles, leave agent_id as plain TEXT for now
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_agent_id_profiles_id_fk;

-- Step 8: Update payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS paystack_reference TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS proof_of_payment_url TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_by TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Step 9: Update support_tickets
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS unread_count_admin INTEGER NOT NULL DEFAULT 0;

-- Step 10: Update support_messages
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- Step 11: Update notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT;

-- Step 12: Recreate commissions (now referencing agents)
CREATE TABLE IF NOT EXISTS commissions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Step 13: Create package_dates
CREATE TABLE IF NOT EXISTS package_dates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  package_id TEXT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  outbound DATE NOT NULL,
  outbound_route TEXT,
  return_date DATE NOT NULL,
  return_route TEXT,
  airline TEXT,
  islamic_date TEXT,
  islamic_return_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Step 14: Create package_accommodations
CREATE TABLE IF NOT EXISTS package_accommodations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  package_id TEXT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  city TEXT NOT NULL,
  hotel TEXT NOT NULL,
  distance_from_haram TEXT,
  distance_from_masjid TEXT,
  rating INTEGER NOT NULL DEFAULT 3,
  room_types TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Step 15: Create agent_clients
CREATE TABLE IF NOT EXISTS agent_clients (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  passport_number TEXT,
  passport_expiry DATE,
  date_of_birth DATE,
  gender TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Step 16: Create agent_wallets
CREATE TABLE IF NOT EXISTS agent_wallets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id TEXT NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Step 17: Create wallet_transactions
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  amount NUMERIC(12,2) NOT NULL,
  type TEXT NOT NULL,
  reference TEXT UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Step 18: Create admin_otp_requests
CREATE TABLE IF NOT EXISTS admin_otp_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  admin_id TEXT NOT NULL REFERENCES profiles(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  amount NUMERIC(12,2) NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Step 19: Create bank_accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  sort_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Step 20: Create site_settings
CREATE TABLE IF NOT EXISTS site_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  key TEXT NOT NULL UNIQUE,
  value JSON,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_by TEXT REFERENCES profiles(id)
);

-- Step 21: Create booking_amendment_requests
CREATE TABLE IF NOT EXISTS booking_amendment_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  user_id TEXT NOT NULL REFERENCES profiles(id),
  requested_changes JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by TEXT REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Step 22: Create booking_form_fields
CREATE TABLE IF NOT EXISTS booking_form_fields (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  label TEXT NOT NULL,
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL,
  placeholder TEXT,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  applies_to TEXT NOT NULL DEFAULT 'all',
  sort_order INTEGER NOT NULL DEFAULT 0,
  options JSON,
  accept TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  section TEXT NOT NULL DEFAULT 'pilgrim_info',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Step 23: Create staff_support_specialties
CREATE TABLE IF NOT EXISTS staff_support_specialties (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, category)
);

-- Step 24: Create staff_messages
CREATE TABLE IF NOT EXISTS staff_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sender_id TEXT NOT NULL REFERENCES profiles(id),
  receiver_id TEXT NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Step 25: Create user_activity
CREATE TABLE IF NOT EXISTS user_activity (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  event_type TEXT NOT NULL,
  package_id TEXT,
  booking_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Step 26: Seed site_settings defaults
INSERT INTO site_settings (key, value) VALUES
  ('contact_whatsapp', '"2348012345678"'),
  ('paystack_enabled', 'true'),
  ('bank_transfer_enabled', 'true'),
  ('site_name', '"Raudah Travels & Tours"'),
  ('currency', '"NGN"')
ON CONFLICT (key) DO NOTHING;

-- Step 27: Seed bank accounts (Nigerian banks)
INSERT INTO bank_accounts (bank_name, account_name, account_number, sort_code, is_active) VALUES
  ('Zenith Bank', 'Raudah Travels & Tours Ltd', '2012345678', '057', TRUE),
  ('First Bank', 'Raudah Travels & Tours Ltd', '3012345678', '011', TRUE)
ON CONFLICT DO NOTHING;
