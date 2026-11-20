import { db, paymentsTable, siteSettingsTable } from "@workspace/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { expiredUnpaidPaystackSession, getPaystackSessionTimeout, lookupPaystackTransaction } from "./paystackProof";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function getPackagePaystackKeys(executor: Transaction | typeof db = db) {
  const [publicKey, secretKey] = await Promise.all([
    executor.query.siteSettingsTable.findFirst({
      where: eq(siteSettingsTable.key, "paystack_public_key"),
    }),
    executor.query.siteSettingsTable.findFirst({
      where: eq(siteSettingsTable.key, "paystack_secret_key"),
    }),
  ]);
  return {
    publicKey: (publicKey?.value as string | undefined) ?? process.env.PAYSTACK_PUBLIC_KEY ?? "",
    secretKey: (secretKey?.value as string | undefined) ?? process.env.PAYSTACK_SECRET_KEY ?? "",
  };
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
    const mode = /^sk_(test|live)_/.exec(secretKey)?.[1];
    if (!mode) return false;
    const timeout = await getPaystackSessionTimeout(secretKey);
    const expired = await Promise.all(attempts.map(async (payment) => {
      const reference = payment.reference || payment.paystackReference;
      if (!reference) return !payment.checkoutUrl && !payment.checkoutInitializedAt;
      const proof = await lookupPaystackTransaction(reference, secretKey);
      return expiredUnpaidPaystackSession(proof, mode, timeout, payment.checkoutExpiresAt, payment.createdAt) ||
        (!proof && !!payment.checkoutInitializedAt && !payment.checkoutUrl);
    }));
    if (!expired.every(Boolean)) return false;
  } catch {
    return false;
  }
  await tx.update(paymentsTable).set({ checkoutRetiredAt: new Date() })
    .where(inArray(paymentsTable.id, attempts.map(({ id }) => id)));
  return true;
}
