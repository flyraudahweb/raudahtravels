import { db, paystackSettlementsTable } from "@workspace/db";
import { and, eq, or } from "drizzle-orm";
import { providerTransactionId } from "./paystackProof";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Settlement = Omit<typeof paystackSettlementsTable.$inferInsert, "providerId" | "createdAt">;

// Both booking types record the same verified charge only once. The caller
// locks its booking before claiming it and commits the charge and state together.
export async function claimPaystackSettlement(
  tx: Transaction, providerIdValue: unknown, binding: Settlement,
) {
  const providerId = providerTransactionId(providerIdValue);
  if (!providerId) return false;
  const [created] = await tx.insert(paystackSettlementsTable).values({ ...binding, providerId })
    .onConflictDoNothing().returning({ providerId: paystackSettlementsTable.providerId });
  if (created) return true;

  const [previous, conflicting] = await tx.select().from(paystackSettlementsTable).where(and(
    eq(paystackSettlementsTable.mode, binding.mode),
    or(eq(paystackSettlementsTable.providerId, providerId),
      eq(paystackSettlementsTable.reference, binding.reference)),
  )).limit(2);
  return !!previous && !conflicting && previous.providerId === providerId &&
    previous.reference === binding.reference && previous.kind === binding.kind &&
    previous.bookingId === binding.bookingId && previous.amountKobo === binding.amountKobo &&
    previous.packagePaymentId === (binding.packagePaymentId ?? null);
}
