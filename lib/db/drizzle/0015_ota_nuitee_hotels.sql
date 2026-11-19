ALTER TABLE ota_bookings DROP CONSTRAINT IF EXISTS ota_supplier;
ALTER TABLE ota_bookings ADD CONSTRAINT ota_supplier
  CHECK (
    supplier = 'duffel'
    OR (supplier = 'bilalsadasub' AND kind = 'flight')
    OR (supplier = 'nuitee' AND kind = 'hotel')
  );
CREATE UNIQUE INDEX IF NOT EXISTS ota_nuitee_prebook_unique
  ON ota_bookings (mode, provider_offer_id) WHERE supplier = 'nuitee';
