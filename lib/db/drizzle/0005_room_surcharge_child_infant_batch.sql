-- Add room surcharge, pilgrim type, parent booking linkage, and batch ID columns
-- These support: room-based pricing, child/infant registration, and bulk registration features

-- Pilgrim type enum
DO $$ BEGIN
  CREATE TYPE pilgrim_type AS ENUM ('adult', 'child', 'infant');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Room surcharge column (extra charge for single/double/triple rooms, quad is default at 0)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room_surcharge NUMERIC(12,2) DEFAULT '0';

-- Pilgrim type column (adult is default for backward compatibility)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pilgrim_type pilgrim_type DEFAULT 'adult';

-- Parent booking reference (links child/infant to parent's booking)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS parent_booking_id TEXT REFERENCES bookings(id);

-- Batch ID for bulk registration (groups bookings registered together)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS batch_id TEXT;

-- Index for batch lookups
CREATE INDEX IF NOT EXISTS idx_bookings_batch_id ON bookings(batch_id) WHERE batch_id IS NOT NULL;

-- Index for parent booking lookups  
CREATE INDEX IF NOT EXISTS idx_bookings_parent_booking_id ON bookings(parent_booking_id) WHERE parent_booking_id IS NOT NULL;
