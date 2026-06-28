-- Enhancement 5: Package Flexibility
-- Add per-package pricing overrides (room surcharges, child/infant pricing)
ALTER TABLE packages ADD COLUMN IF NOT EXISTS pricing_overrides jsonb DEFAULT '{}';

-- Add per-flight-date capacity and status
ALTER TABLE package_dates ADD COLUMN IF NOT EXISTS capacity integer;
ALTER TABLE package_dates ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';
