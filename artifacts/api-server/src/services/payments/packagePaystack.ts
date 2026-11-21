import { db, paymentsTable, siteSettingsTable } from "@workspace/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { createHash } from "node:crypto";
import { expiredUnpaidPaystackSession, getPaystackSessionTimeout, lookupPaystackTransaction, matchesPaystackBinding } from "./paystackProof";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function getPackagePaystackKeys(executor: Transaction | typeof db = db) {
  const settings = await executor.query.siteSettingsTable.findMany({
    where: inArray(siteSettingsTable.key, ["paystack_public_key", "paystack_secret_key", "paystack_enabled"]),
  });
  const values = new Map(settings.map(({ key, value }) => [key, value]));
  const publicKey = values.get("paystack_public_key");
  const secretKey = values.get("paystack_secret_key");
  return {
    publicKey: typeof publicKey === "string" ? publicKey : process.env.PAYSTACK_PUBLIC_KEY ?? "",
    secretKey: typeof secretKey === "string" ? secretKey : process.env.PAYSTACK_SECRET_KEY ?? "",
    enabled: !values.has("paystack_enabled") || values.get("paystack_enabled") === true,
  };
}

export function packagePaystackMode(secret: string) {
  return /^sk_(test|live)_/.exec(secret)?.[1];
}

export function packageSalesModeAllowed(mode: string | undefined) {
  const configured = process.env.PACKAGE_PAYSTACK_MODE ??
    (process.env.NODE_ENV === "production" ? "live" : undefined);
  return !!mode && (!configured || mode === configured);
}

export function paystackKeyFingerprint(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function packageVerificationKey(attempt: {
  checkoutMode: string | null;
  checkoutKeyFingerprint: string | null;
}, currentKey: string) {
  const previous = process.env.PACKAGE_PAYSTACK_PREVIOUS_SECRET_KEY;
  if (previous && attempt.checkoutKeyFingerprint === paystackKeyFingerprint(previous) &&
      packagePaystackMode(previous) === attempt.checkoutMode) return previous;
  if (!attempt.checkoutMode || packagePaystackMode(currentKey) === attempt.checkoutMode) return currentKey;
  return "";
}

export function canPayPackage(booking: {
  status: string;
  isArchived: boolean;
  parentBookingId: string | null;
  totalPrice: string;
}) {
  return (!booking.parentBookingId || Number(booking.totalPrice) > 0) && !booking.isArchived &&
    (booking.status === "pending" || booking.status === "confirmed");
}

export function packageBalanceKobo(booking: { totalPrice: string; amountPaid: string }) {
  return Math.round(Number(booking.totalPrice) * 100) - Math.round(Number(booking.amountPaid) * 100);
}

// Call while holding the same booking locks used by settlement and initialization.
export async function retireExpiredPackageCheckouts(tx: Transaction, bookingIds: string[]) {
  const attempts = await tx.query.paymentsTable.findMany({
    where: and(
      inArray(paymentsTable.bookingId, bookingIds),
      eq(paymentsTable.method, "paystack"),
      inArray(paymentsTable.status, ["pending", "rejected"]),
      isNull(paymentsTable.checkoutRetiredAt),
    ),
  });
  if (!attempts.length) return true;
  if (attempts.some(({ checkoutExpiresAt, checkoutInitializedAt, checkoutUrl }) =>
    (checkoutExpiresAt && checkoutExpiresAt.getTime() > Date.now()) ||
    (!checkoutUrl && checkoutInitializedAt && Date.now() - checkoutInitializedAt.getTime() < 45000))) return false;
  try {
    const { secretKey } = await getPackagePaystackKeys(tx);
    const timeouts = new Map<string, Promise<number>>();
    const expired = await Promise.all(attempts.map(async (payment) => {
      const reference = payment.reference || payment.paystackReference;
      if (!reference) return !payment.checkoutUrl && !payment.checkoutInitializedAt;
      const key = packageVerificationKey(payment, secretKey);
      const mode = packagePaystackMode(key);
      if (!mode) return false;
      const timeoutRequest = timeouts.get(key) ?? getPaystackSessionTimeout(key);
      timeouts.set(key, timeoutRequest);
      const [timeout, proof] = await Promise.all([timeoutRequest, lookupPaystackTransaction(reference, key)]);
      if (proof && !matchesPaystackBinding(proof, {
        reference,
        amountKobo: Math.round(Number(payment.amount) * 100),
        bookingId: payment.bookingId,
        mode,
        purpose: "package",
        userId: payment.userId,
        packagePaymentId: payment.checkoutMode ? payment.id : undefined,
      })) return false;
      return expiredUnpaidPaystackSession(proof, mode, timeout, payment.checkoutExpiresAt, payment.createdAt) ||
        (!proof && !!payment.checkoutInitializedAt && !payment.checkoutUrl &&
          (!payment.checkoutKeyFingerprint || payment.checkoutKeyFingerprint === paystackKeyFingerprint(key)));
    }));
    if (!expired.every(Boolean)) return false;
  } catch {
    return false;
  }
  await tx.update(paymentsTable).set({ checkoutRetiredAt: new Date() })
    .where(inArray(paymentsTable.id, attempts.map(({ id }) => id)));
  return true;
}
