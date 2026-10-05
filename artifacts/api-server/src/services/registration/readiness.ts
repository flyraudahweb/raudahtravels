import { getRegistrationConfig, type RegistrationConfig } from "./config";
import { sql } from "drizzle-orm";
import { registrationDb as db } from "./database";
import { isR2Configured } from "../../lib/r2";

export async function assertRegistrationReady(config?: RegistrationConfig) {
  config ??= await getRegistrationConfig();
  if (!config.enabled) return;
  if (process.env.NODE_ENV === "production" && !/^https:\/\//.test(process.env.APP_URL || "")) throw new Error("AI registration requires an HTTPS APP_URL");
  if (!await isR2Configured(config)) throw new Error("AI registration requires private R2 storage");
  if (!(config.whatsappAccessToken && config.whatsappAppSecret && config.whatsappPhoneNumberId) && !(config.telegramBotToken && config.telegramWebhookSecret)) throw new Error("AI registration requires a configured channel");
  if ((config.whatsappAccessToken && config.whatsappAppSecret && config.whatsappPhoneNumberId) && (!config.whatsappVerifyToken || !config.whatsappApiVersion || !config.whatsappReviewTemplate)) {
    throw new Error("WhatsApp requires verification token, supported API version and approved review template");
  }
  const ttl = config.sessionTtlHours;
  const limit = config.rateLimitPerMin;
  if (!Number.isFinite(ttl) || ttl < 1 || ttl > 720 || !Number.isInteger(limit) || limit < 1 || limit > 300) throw new Error("Invalid AI registration TTL or rate limit");
  await db.execute(sql`SELECT sequence FROM ai_registration_jobs LIMIT 0`);
  const index = await db.execute(sql`SELECT 1 FROM pg_index WHERE indexrelid = to_regclass('bookings_ai_session_unique') AND indisunique AND indisvalid`);
  if (!(index as unknown as { rows: unknown[] }).rows.length) throw new Error("AI registration requires the unique booking-session index from migration 0008");
  await db.execute(sql`SELECT media_purged_at FROM ai_registration_sessions LIMIT 0`);
}
