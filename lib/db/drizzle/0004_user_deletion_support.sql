-- Make user_id nullable on financial tables to preserve records when users are deleted
ALTER TABLE bookings ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE payments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE booking_amendment_requests ALTER COLUMN user_id DROP NOT NULL;
