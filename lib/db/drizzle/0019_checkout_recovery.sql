ALTER TABLE payments ADD COLUMN IF NOT EXISTS checkout_expires_at timestamptz;
ALTER TABLE ota_bookings ADD COLUMN IF NOT EXISTS payment_session_expires_at timestamptz;

-- Migration 0018 copied customer-submitted associations into a read ACL.
-- Staff-issued documents now use the current, staff-managed booking linkage.
DELETE FROM legacy_upload_grants;

-- Repair groups already confirmed through the old manual workflow.
DO $migration$
BEGIN
  IF to_regclass('bookings_id_number_seq') IS NULL THEN
    CREATE SEQUENCE bookings_id_number_seq START WITH 1001;
    PERFORM setval(
      'bookings_id_number_seq',
      GREATEST(1001, COALESCE(MAX(id_number), 1000) + 1),
      false
    ) FROM bookings;
  END IF;
END
$migration$;

UPDATE bookings AS child
SET id_number = nextval('bookings_id_number_seq')
FROM bookings AS parent
WHERE child.parent_booking_id = parent.id AND child.status = 'confirmed'
  AND parent.status = 'confirmed' AND NOT child.is_archived AND child.id_number IS NULL;

UPDATE visa_applications AS visa SET status = 'pending', updated_at = now()
FROM bookings AS child JOIN bookings AS parent ON parent.id = child.parent_booking_id
WHERE visa.booking_id = child.id AND child.status = 'confirmed'
  AND parent.status = 'confirmed' AND NOT child.is_archived AND visa.status = 'awaiting_payment';

INSERT INTO visa_applications (id, booking_id, pilgrim_name, passport_number, status)
SELECT gen_random_uuid()::text, child.id, child.full_name, child.passport_number, 'pending'
FROM bookings AS child JOIN bookings AS parent ON parent.id = child.parent_booking_id
WHERE child.status = 'confirmed' AND parent.status = 'confirmed' AND NOT child.is_archived
  AND NOT EXISTS (SELECT 1 FROM visa_applications AS visa WHERE visa.booking_id = child.id);

-- Restore the counters for bookings moved by the previous upgrade flow.
LOCK TABLE packages IN SHARE ROW EXCLUSIVE MODE;
UPDATE packages AS p SET current_bookings = COALESCE((
  SELECT sum(b.pilgrim_count) FROM bookings AS b
  WHERE b.package_id = p.id AND b.status <> 'cancelled'
), 0);
