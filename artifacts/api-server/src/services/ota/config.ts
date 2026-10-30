import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { db, siteSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { OtaError } from "./provider";
import { DUFFEL_EVENTS } from "./duffelWebhookProtocol";
import { otaAppOrigin } from "./appOrigin";

export const OTA_CONFIG_KEY = "ota_config";
// Initial operator-editable selling rates approved on 2026-10-29.
// Market references never overwrite these or an existing admin rate map.
export const DEFAULT_OTA_RATES = {
  NGN: 1,
  USD: 1344.79,
  GBP: 1791.6,
  EUR: 1500.71,
  SAR: 358.62,
  AED: 366.18,
};
export const OTA_SECRET_FIELDS = [
  "duffelToken",
  "duffelTestToken",
  "duffelLiveToken",
  "webhookTestSecret",
  "webhookLiveSecret",
] as const;
export const configSchema = z
  .object({
    flightsEnabled: z.boolean().default(true),
    hotelsEnabled: z.boolean().default(false),
    salesEnabled: z.boolean().default(false),
    mode: z.enum(["test", "live"]).default("test"),
    duffelToken: z.string().trim().max(512).default(""),
    duffelTestToken: z.string().trim().max(512).default(""),
    duffelLiveToken: z.string().trim().max(512).default(""),
    webhookTestSecret: z.string().trim().max(512).default(""),
    webhookLiveSecret: z.string().trim().max(512).default(""),
    webhookTestId: z
      .string()
      .regex(/^(?:end_[A-Za-z0-9]+)?$/)
      .default(""),
    webhookLiveId: z
      .string()
      .regex(/^(?:end_[A-Za-z0-9]+)?$/)
      .default(""),
    webhookEvents: z
      .array(z.enum(DUFFEL_EVENTS))
      .min(1)
      .max(DUFFEL_EVENTS.length)
      .default([...DUFFEL_EVENTS]),
    rates: z
      .record(z.string().regex(/^[A-Z]{3}$/), z.number().positive().max(1e7))
      .default(() => ({ ...DEFAULT_OTA_RATES })),
    flightMarkupPercent: z.number().min(0).max(50).default(0),
    hotelMarkupPercent: z.number().min(0).max(50).default(0),
    serviceFeeNgn: z.number().min(0).max(1000000).default(0),
    supportEmail: z.string().email().or(z.literal("")).default(""),
    supportPhone: z.string().max(50).default(""),
  })
  .strict();
export type OtaConfig = z.infer<typeof configSchema>;
export function duffelTokenForMode(c: OtaConfig, mode: "test" | "live") {
  const dedicated = mode === "test" ? c.duffelTestToken : c.duffelLiveToken;
  return (
    dedicated ||
    (c.duffelToken.startsWith(`duffel_${mode}_`) ? c.duffelToken : "")
  );
}
function key() {
  if (!/^[a-f0-9]{64}$/i.test(process.env.SETTINGS_ENCRYPTION_KEY || ""))
    throw new Error("SETTINGS_ENCRYPTION_KEY must be configured");
  return Buffer.from(process.env.SETTINGS_ENCRYPTION_KEY!, "hex");
}
function crypt(value: string, decrypt = false) {
  if (decrypt) {
    const [version, iv, tag, body] = value.split(":");
    if (version !== "v1") throw new Error("Invalid OTA credential");
    const cipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(iv, "hex"),
    );
    cipher.setAAD(Buffer.from(OTA_CONFIG_KEY));
    cipher.setAuthTag(Buffer.from(tag, "hex"));
    return Buffer.concat([
      cipher.update(Buffer.from(body, "hex")),
      cipher.final(),
    ]).toString("utf8");
  }
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(OTA_CONFIG_KEY));
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${body.toString("hex")}`;
}
export async function getOtaConfig(): Promise<OtaConfig> {
  const row = await db.query.siteSettingsTable.findFirst({
    where: eq(siteSettingsTable.key, OTA_CONFIG_KEY),
  });
  const stored = { ...((row?.value as Record<string, unknown>) || {}) };
  for (const field of OTA_SECRET_FIELDS)
    if (stored[field]) stored[field] = crypt(String(stored[field]), true);
    else delete stored[field]; // Blank stored fields retain hosting credentials.
  const active = process.env.DUFFEL_API_TOKEN || "";
  const mode = stored.mode ?? process.env.OTA_MODE ?? "test";
  const config = configSchema.parse({
    duffelToken: process.env.DUFFEL_API_TOKEN || "",
    duffelTestToken:
      process.env.DUFFEL_TEST_API_TOKEN ||
      (active.startsWith("duffel_test_") ? active : ""),
    duffelLiveToken:
      process.env.DUFFEL_LIVE_API_TOKEN ||
      (active.startsWith("duffel_live_") ? active : ""),
    webhookTestSecret: process.env.DUFFEL_WEBHOOK_SECRET_TEST || "",
    webhookLiveSecret: process.env.DUFFEL_WEBHOOK_SECRET_LIVE || "",
    webhookTestId: process.env.DUFFEL_WEBHOOK_ID_TEST || "",
    webhookLiveId: process.env.DUFFEL_WEBHOOK_ID_LIVE || "",
    mode,
    flightsEnabled:
      process.env.OTA_FLIGHTS_ENABLED === undefined
        ? mode === "test"
        : process.env.OTA_FLIGHTS_ENABLED === "true",
    hotelsEnabled: process.env.OTA_HOTELS_ENABLED === "true",
    salesEnabled: process.env.OTA_SALES_ENABLED === "true",
    rates:
      stored.rates ??
      (process.env.OTA_DEFAULT_RATES
        ? JSON.parse(process.env.OTA_DEFAULT_RATES)
        : { ...DEFAULT_OTA_RATES }),
    supportEmail: process.env.OTA_SUPPORT_EMAIL || "",
    supportPhone: process.env.OTA_SUPPORT_PHONE || "",
    ...stored,
  });
  config.duffelToken = duffelTokenForMode(config, config.mode);
  return config;
}
export function safeConfig(c: OtaConfig) {
  const safe: Record<string, unknown> = {
    ...c,
    encryptionReady: /^[a-f0-9]{64}$/i.test(
      process.env.SETTINGS_ENCRYPTION_KEY || "",
    ),
  };
  for (const field of OTA_SECRET_FIELDS) {
    safe[field] = "";
    safe[`${field}Set`] = !!c[field];
  }
  return safe;
}
export async function saveOtaConfig(patch: unknown, actor: string) {
  const parsed = configSchema.partial().parse(patch),
    current = await getOtaConfig();
  for (const field of OTA_SECRET_FIELDS)
    if (!parsed[field]) delete parsed[field]; // Blank means retain.
  if (parsed.duffelToken) {
    if (parsed.duffelToken.startsWith("duffel_test_"))
      parsed.duffelTestToken = parsed.duffelToken;
    else if (parsed.duffelToken.startsWith("duffel_live_"))
      parsed.duffelLiveToken = parsed.duffelToken;
  }
  const next = configSchema.parse({ ...current, ...parsed });
  next.duffelToken = duffelTokenForMode(next, next.mode);
  if (next.duffelTestToken && !next.duffelTestToken.startsWith("duffel_test_"))
    throw new OtaError("Enter a valid Duffel test token", 400);
  if (next.duffelLiveToken && !next.duffelLiveToken.startsWith("duffel_live_"))
    throw new OtaError("Enter a valid Duffel live token", 400);
  if (
    (next.flightsEnabled || next.hotelsEnabled) &&
    !next.duffelToken.startsWith(`duffel_${next.mode}_`)
  )
    throw new OtaError("Duffel token must match the selected mode", 400);
  if (next.rates.NGN !== 1) throw new OtaError("NGN rate must equal 1", 400);
  if (next.salesEnabled && (!next.supportEmail || !otaAppOrigin()))
    throw new OtaError("Sales require a support email and HTTPS APP_URL", 400);
  if (next.salesEnabled) {
    const paymentSetting = await db.query.siteSettingsTable.findFirst({
      where: eq(siteSettingsTable.key, "paystack_secret_key"),
    });
    const paymentKey = String(
      paymentSetting?.value || process.env.PAYSTACK_SECRET_KEY || "",
    );
    if (!paymentKey.startsWith(`sk_${next.mode}_`))
      throw new OtaError(
        "Online sales cannot be enabled: the saved Paystack key must match the Duffel test/live mode. Existing Paystack settings have not been changed.",
        400,
      );
  }
  const stored = { ...next };
  const previous = await db.query.siteSettingsTable.findFirst({
    where: eq(siteSettingsTable.key, OTA_CONFIG_KEY),
  });
  const previousValues = (previous?.value as Record<string, unknown>) || {};
  // Saving switches/rates must not copy hosting secrets into the database or
  // require an encryption key when credentials are managed by the host.
  for (const field of OTA_SECRET_FIELDS)
    stored[field] = parsed[field]
      ? crypt(next[field])
      : String(previousValues[field] || "");
  await db
    .insert(siteSettingsTable)
    .values({
      id: randomUUID(),
      key: OTA_CONFIG_KEY,
      value: stored,
      updatedBy: actor,
    })
    .onConflictDoUpdate({
      target: siteSettingsTable.key,
      set: { value: stored, updatedBy: actor, updatedAt: new Date() },
    });
  return safeConfig(next);
}
