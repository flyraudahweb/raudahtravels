ALTER TABLE ota_bookings DROP CONSTRAINT IF EXISTS ota_supplier;
ALTER TABLE ota_bookings ADD CONSTRAINT ota_supplier
  CHECK (supplier IN ('duffel', 'nuitee') OR (supplier = 'bilalsadasub' AND kind = 'flight'));
