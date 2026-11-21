ALTER TABLE payments ADD COLUMN IF NOT EXISTS checkout_mode text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS checkout_key_fingerprint text;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'payments'::regclass AND conname = 'payments_checkout_mode'
  ) THEN
    ALTER TABLE payments ADD CONSTRAINT payments_checkout_mode
      CHECK (checkout_mode IS NULL OR checkout_mode IN ('test', 'live'));
  END IF;
END
$migration$;

CREATE UNIQUE INDEX IF NOT EXISTS payments_active_online_checkout ON payments (booking_id)
  WHERE method = 'paystack' AND checkout_mode IS NOT NULL AND checkout_retired_at IS NULL
    AND status IN ('pending', 'rejected');

CREATE TABLE IF NOT EXISTS paystack_settlements (
  mode text NOT NULL,
  provider_id text NOT NULL,
  reference text NOT NULL,
  kind text NOT NULL,
  booking_id text NOT NULL,
  package_payment_id text,
  amount_kobo bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paystack_settlements_transaction UNIQUE (mode, provider_id),
  CONSTRAINT paystack_settlements_reference UNIQUE (mode, reference),
  CONSTRAINT paystack_settlements_mode CHECK (mode IN ('test', 'live')),
  CONSTRAINT paystack_settlements_kind CHECK (
    (kind = 'package') = (package_payment_id IS NOT NULL) AND kind IN ('package', 'ota')
  ),
  CONSTRAINT paystack_settlements_amount CHECK (amount_kobo > 0)
);
