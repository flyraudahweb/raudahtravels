type Binding = {
  reference: string;
  amountKobo: number;
  mode: string;
  bookingId: string;
  purpose: "ota" | "package";
  userId?: string | null;
};

export function matchesPaystackProof(
  payment: any,
  expected: Binding,
  allowReversed = false,
): boolean {
  if (
    !payment ||
    !["success", ...(allowReversed ? ["reversed"] : [])].includes(
      payment.status,
    ) ||
    !Number.isSafeInteger(payment.amount) ||
    payment.amount <= 0 ||
    payment.amount !== expected.amountKobo ||
    payment.reference !== expected.reference ||
    payment.currency !== "NGN" ||
    payment.domain !== expected.mode ||
    !payment.metadata ||
    typeof payment.metadata !== "object" ||
    Array.isArray(payment.metadata)
  )
    return false;
  const metadata = payment.metadata;
  if (expected.purpose === "ota")
    return (
      metadata.otaBookingId === expected.bookingId &&
      metadata.type === "ota_booking" &&
      !metadata.bookingId
    );
  return (
    metadata.bookingId === expected.bookingId &&
    !metadata.otaBookingId &&
    (!metadata.type || metadata.type === "package_booking") &&
    (!expected.userId || metadata.userId === expected.userId)
  );
}

// Provider IDs can be decimal strings beyond JavaScript's safe integer range.
export function providerTransactionId(value: unknown): string | undefined {
  const input =
    typeof value === "number"
      ? Number.isSafeInteger(value) && value > 0
        ? String(value)
        : ""
      : typeof value === "string"
        ? value
        : "";
  if (!/^[0-9]{1,40}$/.test(input)) return undefined;
  const parsed = BigInt(input);
  return parsed > 0n ? parsed.toString() : undefined;
}
