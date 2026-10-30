import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getOtaConfig } from "./config";
import { duffelRequest } from "./provider";
import { paystackKey } from "./booking";
import { apiKeyStorageReady } from "./apiKeys";
import { otaAppOrigin } from "./appOrigin";

// Operator-only diagnostics. Never return raw DB/provider errors or credentials.
export async function checkOtaReadiness() {
  const results: Record<string, string> = {};
  try {
    await db.execute(
      sql`SELECT revision, sync_attempt_at, provider_notice FROM ota_bookings LIMIT 0`,
    );
    await db.execute(sql`SELECT reference FROM ota_payment_jobs LIMIT 0`);
    await db.execute(sql`SELECT id FROM ota_events LIMIT 0`);
    await db.execute(sql`SELECT dedupe_key FROM ota_duffel_events LIMIT 0`);
    results.database = "passed";
  } catch (error: any) {
    const codes = [error?.code, error?.cause?.code, error?.cause?.cause?.code];
    results.database = codes.some((code) => ["42P01", "42703"].includes(code))
      ? "missing schema: apply unapplied OTA migrations 0009, 0010 and 0011"
      : "unavailable: check database connectivity and permissions; a migration is not confirmed missing";
  }
  try {
    results.apiKeys = (await apiKeyStorageReady())
      ? "passed"
      : "optional storage missing: apply 0012_ota_api_keys.sql for trusted-backend search keys; customer JWT access does not require keys";
  } catch {
    results.apiKeys =
      "storage unavailable: check database connectivity and permissions";
  }
  let config: Awaited<ReturnType<typeof getOtaConfig>>;
  try {
    config = await getOtaConfig();
    results.configuration = `loaded (${config.mode} mode)`;
  } catch {
    results.configuration =
      "unreadable: check database access, saved OTA settings and the hosting SETTINGS_ENCRYPTION_KEY; do not replace an existing encryption key";
    return results;
  }
  results.flights = config.flightsEnabled
    ? "enabled"
    : "disabled in OTA settings";
  results.hotels = config.hotelsEnabled
    ? "enabled; Stays entitlement still requires a successful search"
    : "disabled; confirm Duffel Stays access before enabling";
  results.sales = config.salesEnabled
    ? "enabled; complete staging purchase acceptance before launch"
    : "disabled in OTA settings";
  results.callback = otaAppOrigin()
    ? "valid HTTPS app origin"
    : "invalid: APP_URL must be a complete HTTPS origin without credentials, path, query or fragment";
  results.support = config.supportEmail
    ? "email configured"
    : "missing travel support email; required before enabling sales";
  results.webhook = (
    config.mode === "test" ? config.webhookTestSecret : config.webhookLiveSecret
  )
    ? "signing secret configured; verify signed ping and activation separately"
    : `missing ${config.mode} webhook signing secret on this service`;
  try {
    await paystackKey(config.mode);
    results.paystack = `configured for ${config.mode} mode; no charge or purchase attempted`;
  } catch {
    results.paystack = `missing or mode mismatch: Paystack must use ${config.mode} mode; existing payment settings have not been changed`;
  }
  try {
    await duffelRequest(config, "/air/airlines?limit=1");
    results.duffel =
      "passed; flight credential accepted, not proof of Stays access or purchase funding";
  } catch {
    results.duffel =
      "failed: verify the selected mode, credential and provider availability";
  }
  results.stays =
    "not verified: run a Stays search with the intended account; no reservation was created by this check";
  return results;
}
