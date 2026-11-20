import { createHmac, randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  ehajjConnectionsTable,
  ehajjRegistrationsTable as registrations,
  userActivityTable,
} from "@workspace/db";
import { ehajjClient, ehajjId, EhajjError } from "./ehajj";
import { decryptSetting, encryptSetting } from "./registration/config";

const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
  );
export const registrationInput = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    gender: z.enum(["m", "f"]),
    passportNumber: z
      .string()
      .trim()
      .min(4)
      .max(40)
      .transform((value) => value.toUpperCase()),
    phone: z.string().trim().min(6).max(30),
    dateOfBirth: calendarDate.optional(),
    passportExpiry: calendarDate.optional(),
    packageId: ehajjId,
    amount: z
      .string()
      .trim()
      .regex(/^\d{1,12}(?:\.\d{1,2})?$/)
      .refine(
        (value) => /[1-9]/.test(value),
        "Enter a positive payment amount",
      ),
    currency: z.string().regex(/^[A-Z]{3}$/),
    paymentMethod: z.number().int().min(1).max(5),
    paymentReference: z.string().trim().min(1).max(128).optional(),
    paymentDate: calendarDate.optional(),
    sourceBankId: ehajjId.optional(),
    destinationAccountId: ehajjId.optional(),
    accountingConfirmed: z.literal(true),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.paymentMethod !== 1 && !input.paymentReference)
      context.addIssue({
        code: "custom",
        path: ["paymentReference"],
        message: "Enter the payment reference",
      });
    if (
      input.paymentMethod === 3 &&
      (!input.sourceBankId || !input.destinationAccountId)
    )
      context.addIssue({
        code: "custom",
        path: ["sourceBankId"],
        message: "Choose the source bank and destination account",
      });
  });
type Input = z.infer<typeof registrationInput>;
type Registration = typeof registrations.$inferSelect;

function openRequest(row: Registration): Input {
  try {
    return registrationInput.parse(
      JSON.parse(decryptSetting(row.payload, "ehajj:registration:" + row.id)),
    );
  } catch {
    throw new EhajjError(
      503,
      "The saved registration could not be opened. Check the server encryption configuration.",
    );
  }
}
export function registrationView(row: Registration) {
  const interrupted =
    row.state === "submitting" &&
    Date.now() - row.updatedAt.getTime() >= 2 * 60 * 1000;
  return {
    id: row.id,
    version: row.version,
    state: interrupted ? ("requires_review" as const) : row.state,
    request: openRequest(row),
    result: row.result,
    issue: interrupted
      ? "The submission was interrupted. Reconcile the pilgrim registration and initial payment in EHajj before taking further action."
      : row.issue,
    updatedAt: row.updatedAt,
  };
}

export async function listRegistrations() {
  const connection = await db.query.ehajjConnectionsTable.findFirst({
    where: eq(ehajjConnectionsTable.id, "primary"),
  });
  if (!connection) return [];
  const rows = await db
    .select()
    .from(registrations)
    .where(eq(registrations.agencyScope, connection.agencyScope))
    .orderBy(desc(registrations.createdAt))
    .limit(50);
  return rows.map(registrationView);
}

export async function prepareRegistration(input: Input, actorId: string) {
  return db.transaction(async (tx) => {
    const connection = await tx.query.ehajjConnectionsTable.findFirst({
      where: eq(ehajjConnectionsTable.id, "primary"),
    });
    if (!connection?.enabled)
      throw new EhajjError(
        503,
        "Enable the EHajj connection before preparing a registration.",
      );
    ehajjClient(connection);
    if (!/^[a-f0-9]{64}$/i.test(process.env.SETTINGS_ENCRYPTION_KEY || ""))
      throw new EhajjError(
        503,
        "Configure the server encryption key before saving a registration.",
      );
    const fingerprint = createHmac(
      "sha256",
      process.env.SETTINGS_ENCRYPTION_KEY!,
    )
      .update(JSON.stringify([input.packageId, input.passportNumber]))
      .digest("hex");
    const [existing] = await tx
      .select()
      .from(registrations)
      .where(
        and(
          eq(registrations.agencyScope, connection.agencyScope),
          eq(registrations.fingerprint, fingerprint),
        ),
      )
      .for("update");
    if (existing && existing.state !== "prepared")
      throw new EhajjError(
        409,
        "This passport and package already have an EHajj submission. Review the saved registration.",
      );
    const id = existing?.id || randomUUID();
    const values = {
      agencyScope: connection.agencyScope,
      fingerprint,
      payload: encryptSetting(
        JSON.stringify(input),
        "ehajj:registration:" + id,
      ),
      version: randomUUID(),
      createdBy: actorId,
      updatedAt: new Date(),
    };
    const [saved] = existing
      ? await tx
          .update(registrations)
          .set(values)
          .where(
            and(
              eq(registrations.id, id),
              eq(registrations.version, existing.version),
              eq(registrations.state, "prepared"),
            ),
          )
          .returning()
      : await tx
          .insert(registrations)
          .values({ id, ...values })
          .onConflictDoNothing()
          .returning();
    if (!saved)
      throw new EhajjError(
        409,
        "This registration changed. Refresh the saved registrations.",
      );
    await tx.insert(userActivityTable).values({
      id: randomUUID(),
      userId: actorId,
      eventType: "ehajj_registration_prepared",
      metadata: { registrationId: id },
    });
    return registrationView(saved);
  });
}

function providerFields(input: Input) {
  const fields: Record<string, string> = {
    first_name: input.firstName,
    last_name: input.lastName,
    gender: input.gender,
    passport_number: input.passportNumber,
    phone_number: input.phone,
    package_id: String(input.packageId),
    payment_amount: input.amount,
    payment_method: String(input.paymentMethod),
  };
  if (input.dateOfBirth) fields.date_of_birth = input.dateOfBirth;
  if (input.passportExpiry) fields.passport_expiry_date = input.passportExpiry;
  if (input.paymentReference) fields.payment_reference = input.paymentReference;
  if (input.paymentDate) fields.payment_date = input.paymentDate;
  if (input.paymentMethod === 3) {
    fields.source_bank_id = String(input.sourceBankId);
    fields.destination_bank_account_id = String(input.destinationAccountId);
  }
  return fields;
}

export async function submitRegistration(
  id: string,
  version: string,
  actorId: string,
) {
  const prepared = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(registrations)
      .where(eq(registrations.id, id))
      .for("update");
    if (!row) throw new EhajjError(404, "Registration not found.");
    if (row.version !== version)
      throw new EhajjError(
        409,
        "The registration changed. Review its latest details before sending.",
      );
    if (row.state !== "prepared") return { existing: row };
    const connection = await tx.query.ehajjConnectionsTable.findFirst({
      where: eq(ehajjConnectionsTable.id, "primary"),
    });
    if (!connection || connection.agencyScope !== row.agencyScope)
      throw new EhajjError(
        409,
        "This registration belongs to a different EHajj connection.",
      );
    const client = ehajjClient(connection);
    const input = openRequest(row);
    await tx
      .update(registrations)
      .set({ state: "submitting", updatedAt: new Date() })
      .where(eq(registrations.id, id));
    await tx.insert(userActivityTable).values({
      id: randomUUID(),
      userId: actorId,
      eventType: "ehajj_registration_submitted",
      metadata: { registrationId: id },
    });
    return { client, input };
  });
  if ("existing" in prepared) return registrationView(prepared.existing!);
  let result: unknown;
  try {
    if (prepared.input.paymentMethod === 3) {
      const [banks, accounts] = await Promise.all([
        prepared.client.banks(),
        prepared.client.bankAccounts(),
      ]);
      if (
        !banks.some((bank) => bank.id === prepared.input.sourceBankId) ||
        !accounts.some(
          (account) => account.id === prepared.input.destinationAccountId,
        )
      )
        throw new EhajjError(
          409,
          "The selected bank or account is unavailable.",
        );
    }
    result = await prepared.client.registerPilgrim(
      providerFields(prepared.input),
    );
  } catch {
    const [review] = await db
      .update(registrations)
      .set({
        state: "requires_review",
        issue:
          "Check the registration and first payment in EHajj before taking further action. The outcome needs provider reconciliation.",
        updatedAt: new Date(),
      })
      .where(eq(registrations.id, id))
      .returning();
    return registrationView(review);
  }
  // A failed local save leaves the durable submitting claim available for review.
  const [saved] = await db
    .update(registrations)
    .set({ state: "confirmed", result, issue: null, updatedAt: new Date() })
    .where(eq(registrations.id, id))
    .returning();
  return registrationView(saved);
}
