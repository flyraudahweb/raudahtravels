import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { db, otaEventsTable } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { OtaError } from "./provider";

export const domesticFareIncrease = "domestic_fare_increased";
const scope = Buffer.from("ota-bilalsadasub-fare:v1");
const iata = z.string().regex(/^[A-Z]{3}$/);
const amount = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const fareSchema = z.object({
  supplierId: z.string().min(1).max(256),
  airline: z.string().min(1).max(100),
  departure: z.string().max(40).datetime({ local: true, offset: true }),
  arrival: z.string().max(40).datetime({ local: true, offset: true }),
  stops: z.number().int().min(0).max(12),
  supplierKobo: amount,
  estimatedTotalKobo: amount,
});
const quoteSchema = z.object({
  mode: z.enum(["test", "live"]),
  expiresAt: z.number().int(),
  search: z.object({
    origin: iata,
    destination: iata,
    departureDate: z.string().date(),
    adults: z.number().int().min(1).max(9),
    childAges: z.array(z.number().int().min(2).max(11)).max(8),
    cabinClass: z.enum(["economy", "premium_economy", "business", "first"]),
  }),
  fare: fareSchema,
});
export type DomesticFareQuote = z.infer<typeof quoteSchema>;
type DomesticFare = z.infer<typeof fareSchema>;

function quoteKey() {
  const masterKey = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!masterKey || !/^[a-f0-9]{64}$/i.test(masterKey)) return;
  return createHash("sha256")
    .update(scope)
    .update(Buffer.from(masterKey, "hex"))
    .digest();
}

export function sealDomesticFare(quote: DomesticFareQuote) {
  const key = quoteKey();
  if (!key) return;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(scope);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(quote)),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function openDomesticFare(token: string) {
  const key = quoteKey();
  if (!key) throw new OtaError("Fare checks are temporarily unavailable.", 503);
  let quote: DomesticFareQuote;
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length < 29 || raw.toString("base64url") !== token)
      throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
    decipher.setAAD(scope);
    decipher.setAuthTag(raw.subarray(12, 28));
    const decoded = Buffer.concat([
      decipher.update(raw.subarray(28)),
      decipher.final(),
    ]);
    quote = quoteSchema.parse(JSON.parse(decoded.toString("utf8")));
  } catch {
    throw new OtaError("Invalid fare selection. Please search again.", 400);
  }
  if (quote.expiresAt <= Date.now())
    throw new OtaError(
      "This fare selection has expired. Please search again.",
      409,
    );
  return quote;
}

export async function recordDomesticFareIncrease(
  quote: DomesticFareQuote,
  refreshed: DomesticFare,
  match: "same_offer" | "matching_schedule",
) {
  const { mode, search, fare } = quote;
  const details = {
    match,
    mode,
    origin: search.origin,
    destination: search.destination,
    departure: fare.departure,
    airline: fare.airline,
    cabin: search.cabinClass,
    travellers: search.adults + search.childAges.length,
    previousSupplierKobo: fare.supplierKobo,
    currentSupplierKobo: refreshed.supplierKobo,
    previousTotalKobo: fare.estimatedTotalKobo,
    currentTotalKobo: refreshed.estimatedTotalKobo,
  };
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(details))
    .digest("hex");
  await db
    .insert(otaEventsTable)
    .values({
      id: `bilalsadasub-fare:${fingerprint}`,
      actor: "system",
      action: domesticFareIncrease,
      details,
    })
    .onConflictDoNothing();
}

export async function listDomesticFareIncreases(
  mode: DomesticFareQuote["mode"],
  offset: number,
) {
  const pageSize = 25;
  const rows = await db
    .select({
      id: otaEventsTable.id,
      detectedAt: otaEventsTable.createdAt,
      details: otaEventsTable.details,
    })
    .from(otaEventsTable)
    .where(
      and(
        eq(otaEventsTable.action, domesticFareIncrease),
        sql`${otaEventsTable.details}->>'mode' = ${mode}`,
      ),
    )
    .orderBy(desc(otaEventsTable.createdAt), desc(otaEventsTable.id))
    .limit(pageSize + 1)
    .offset(offset);
  return {
    changes: rows.slice(0, pageSize),
    nextOffset: rows.length > pageSize ? offset + pageSize : null,
  };
}
