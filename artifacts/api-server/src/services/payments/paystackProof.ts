import { createHmac, timingSafeEqual } from "node:crypto";

type Binding = {
  reference: string;
  amountKobo: number;
  mode: string;
  bookingId: string;
  purpose: "ota" | "package";
  userId?: string | null;
  packagePaymentId?: string;
};

export async function getPaystackSessionTimeout(secret: string) {
  const response = await fetch("https://api.paystack.co/integration/payment_session_timeout", {
    redirect: "error",
    signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Bearer ${secret}` },
  });
  const result = (await response.json()) as {
    status?: boolean;
    data?: { payment_session_timeout?: number };
  } | null;
  const seconds = result?.data?.payment_session_timeout;
  if (!response.ok || result?.status !== true || typeof seconds !== "number" ||
      !Number.isSafeInteger(seconds) || seconds < 0)
    throw new Error("Paystack could not verify the payment session timeout");
  return seconds;
}

export function expiredUnpaidPaystackSession(
  payment: any,
  mode: string,
  timeout: number,
  savedExpiry?: Date | null,
  initializedAt?: Date | null,
) {
  if (payment?.domain !== mode || !["abandoned", "failed", "timeout"].includes(payment.status))
    return false;
  if (payment.status === "timeout" ||
      /session timeout exceeded|payment has exceeded the time to pay/i.test(payment.gateway_response ?? ""))
    return true;
  if (!timeout) return false;
  const created = Date.parse(payment.created_at ?? payment.createdAt);
  const startedAt = Math.max(Number.isFinite(created) ? created : 0, initializedAt?.getTime() ?? 0);
  const expires = Math.max(savedExpiry?.getTime() ?? 0, startedAt ? startedAt + timeout * 1000 : 0);
  // Paystack may report an untouched, still-payable session as abandoned.
  return expires > 0 && Date.now() >= expires;
}

export async function lookupPaystackTransaction(
  reference: string,
  secret: string,
) {
  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      redirect: "error",
      signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${secret}` },
    },
  );
  const result = (await response.json()) as {
    status?: boolean;
    message?: string;
    data?: any;
  };
  if (
    [400, 404].includes(response.status) &&
    /^transaction reference not found\.?$/i.test(result.message ?? "")
  )
    return null;
  if (
    !response.ok ||
    result.status !== true ||
    result.data?.reference !== reference ||
    typeof result.data.status !== "string"
  )
    throw new Error("Paystack could not verify the saved payment reference");
  return result.data;
}

export function matchesPaystackProof(
  payment: any,
  expected: Binding,
  allowReversed = false,
): boolean {
  if (
    !payment || !["success", ...(allowReversed ? ["reversed"] : [])].includes(payment.status)
  ) return false;
  return matchesPaystackBinding(payment, expected);
}

export function matchesPaystackBinding(payment: any, expected: Binding): boolean {
  if (
    !payment ||
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
    (!expected.packagePaymentId || metadata.packagePaymentId === expected.packagePaymentId) &&
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
  return parsed > 0n && parsed <= 18446744073709551615n ? parsed.toString() : undefined;
}
export function isPaystackReference(reference: unknown): reference is string {
  return typeof reference === "string" && /^[A-Za-z0-9_.=-]{1,128}$/.test(reference);
}

export function matchesPaystackSignature(body: Buffer, signature: string, secret: string) {
  return !!secret && /^[a-f0-9]{128}$/i.test(signature) &&
    timingSafeEqual(createHmac("sha512", secret).update(body).digest(), Buffer.from(signature, "hex"));
}
