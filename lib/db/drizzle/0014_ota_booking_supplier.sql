ALTER TABLE ota_bookings ADD COLUMN IF NOT EXISTS supplier text NOT NULL DEFAULT 'duffel';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ota_supplier' AND conrelid = 'ota_bookings'::regclass) THEN
    ALTER TABLE ota_bookings ADD CONSTRAINT ota_supplier
      CHECK (supplier = 'duffel' OR (supplier = 'bilalsadasub' AND kind = 'flight'));
  END IF;
END $$;
