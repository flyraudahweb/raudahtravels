import { createHmac, timingSafeEqual } from "node:crypto";

export const DUFFEL_EVENTS = [
  "order.created",
  "order.creation_failed",
  "order.airline_initiated_change_detected",
  "order_cancellation.created",
  "order_cancellation.confirmed",
  "stays.booking.created",
  "stays.booking_creation_failed",
  "stays.booking.cancelled",
] as const;
export const DUFFEL_RECEIVER = "raudah-duffel-v1";
export function validDuffelSignature(
  raw: Buffer,
  header: string,
  secret: string,
  now = Date.now(),
): boolean {
  if (!secret || !raw.length || raw.length > 256 * 1024 || header.length > 2048)
    return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const times = parts.filter(([k]) => k === "t");
  if (times.length !== 1 || !/^\d{10,13}$/.test(times[0][1] || ""))
    return false;
  const timestamp = times[0][1];
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret)
    .update(timestamp)
    .update(".")
    .update(raw)
    .digest();
  return parts
    .filter(([k]) => k === "v1")
    .some(([, value]) => {
      if (!/^[a-f0-9]{64}$/i.test(value || "")) return false;
      return timingSafeEqual(expected, Buffer.from(value, "hex"));
    });
}
