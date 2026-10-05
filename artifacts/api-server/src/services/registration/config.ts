import { registrationDb as db } from "./database";
import { siteSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";

export const CONFIG_KEY = "ai_registration_config";
export const secretFields = ["whatsappAccessToken", "whatsappAppSecret", "whatsappVerifyToken", "telegramBotToken", "telegramWebhookSecret", "geminiKey", "mistralKey", "r2AccessKeyId", "r2SecretAccessKey"] as const;
const text = z.string().trim().max(4096);
export const registrationConfigSchema = z.object({
  enabled: z.boolean().default(false),
  whatsappAccessToken: text.default(""), whatsappAppSecret: text.default(""), whatsappVerifyToken: text.default(""),
  whatsappPhoneNumberId: z.string().regex(/^\d*$/).max(40).default(""),
  whatsappApiVersion: z.string().regex(/^v\d+\.\d+$/).default("v21.0"),
  whatsappReviewTemplate: z.string().regex(/^[a-z0-9_]*$/).max(512).default(""),
  whatsappTemplateLanguage: z.string().regex(/^[a-z]{2,3}(?:_[A-Z]{2})?$/).default("en"),
  telegramBotToken: text.default(""), telegramWebhookSecret: z.string().regex(/^[A-Za-z0-9_-]*$/).max(256).default(""),
  geminiKey: text.default(""), mistralKey: text.default(""),
  r2AccountId: z.string().regex(/^[a-f0-9]*$/i).max(64).default(""),
  r2AccessKeyId: text.default(""), r2SecretAccessKey: text.default(""),
  r2BucketName: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/).default("raudah-uploads"),
  geminiModel: z.string().regex(/^[\w.-]+$/).max(128).default("gemini-3.8-flash"),
  mistralModel: z.string().regex(/^[\w.-]+$/).max(128).default("mistral-small-latest"),
  autoFallback: z.boolean().default(true), sessionTtlHours: z.number().int().min(1).max(720).default(48),
  rateLimitPerMin: z.number().int().min(1).max(300).default(20),
}).strict();
export type RegistrationConfig = z.infer<typeof registrationConfigSchema>;

function encryptionKey() {
  const value = process.env.SETTINGS_ENCRYPTION_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error("Set SETTINGS_ENCRYPTION_KEY to a persistent 64-character hex key before saving credentials");
  return Buffer.from(value, "hex");
}
export function encryptSetting(value: string, field: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`${CONFIG_KEY}:${field}`));
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `enc:v1:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${body.toString("hex")}`;
}
function decryptSetting(value: string, field: string): string {
  if (!value.startsWith("enc:v1:")) throw new Error("Invalid encrypted registration credential");
  const [, , iv, tag, body] = value.split(":");
  const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "hex"));
  cipher.setAAD(Buffer.from(`${CONFIG_KEY}:${field}`));
  cipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([cipher.update(Buffer.from(body, "hex")), cipher.final()]).toString("utf8");
}
export async function getRegistrationConfig(): Promise<RegistrationConfig> {
  const row = await db.query.siteSettingsTable.findFirst({ where: eq(siteSettingsTable.key, CONFIG_KEY) });
  const stored = { ...((row?.value as Record<string, unknown>) || {}) };
  for (const field of secretFields) if (stored[field]) stored[field] = decryptSetting(String(stored[field]), field);
  const env = process.env;
  return registrationConfigSchema.parse({
    enabled: env.AI_REGISTRATION_ENABLED === "true", whatsappAccessToken: env.WHATSAPP_ACCESS_TOKEN || "",
    whatsappAppSecret: env.WHATSAPP_APP_SECRET || "", whatsappVerifyToken: env.WHATSAPP_VERIFY_TOKEN || "",
    whatsappPhoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || "", whatsappApiVersion: env.WHATSAPP_API_VERSION || "v21.0",
    whatsappReviewTemplate: env.WHATSAPP_REVIEW_TEMPLATE || "", whatsappTemplateLanguage: env.WHATSAPP_TEMPLATE_LANGUAGE || "en",
    telegramBotToken: env.TELEGRAM_BOT_TOKEN || "", telegramWebhookSecret: env.TELEGRAM_WEBHOOK_SECRET || "",
    geminiKey: env.GEMINI_API_KEY || "", mistralKey: env.MISTRAL_API_KEY || "",
    r2AccountId: env.R2_ACCOUNT_ID || "", r2AccessKeyId: env.R2_ACCESS_KEY_ID || "", r2SecretAccessKey: env.R2_SECRET_ACCESS_KEY || "",
    r2BucketName: env.R2_BUCKET_NAME || "raudah-uploads",
    geminiModel: env.GEMINI_PASSPORT_MODEL || "gemini-3.8-flash", mistralModel: env.MISTRAL_PASSPORT_MODEL || "mistral-small-latest",
    autoFallback: env.AI_REGISTRATION_AUTO_FALLBACK !== "false", sessionTtlHours: Number(env.AI_REGISTRATION_SESSION_TTL_HOURS || 48),
    rateLimitPerMin: Number(env.AI_REGISTRATION_RATE_LIMIT_PER_MIN || 20), ...stored,
  });
}
export function redactConfig(config: RegistrationConfig) {
  const safe: Record<string, unknown> = { ...config };
  for (const field of secretFields) { safe[`${field}Set`] = Boolean(config[field]); safe[field] = ""; }
  safe.encryptionReady = /^[a-f0-9]{64}$/i.test(process.env.SETTINGS_ENCRYPTION_KEY || "");
  safe.webhookBaseUrl = (process.env.APP_URL || "").replace(/\/+$/, "");
  return safe;
}
