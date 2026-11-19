import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  bilalFlightCheckoutReady,
  bilalMode,
  bilalTokenForMode,
  getOtaConfig,
  nuiteeHotelCheckoutReady,
  nuiteeHotelSearchReady,
} from "./config";
import { duffelRequest } from "./provider";
import { paystackKey } from "./booking";
import { apiKeyStorageReady } from "./apiKeys";
import { otaAppOrigin } from "./appOrigin";

// Operator-only diagnostics. Never return raw DB/provider errors or credentials.
export async function checkOtaReadiness() {
  const results: Record<string, string> = {};
  try {
    await db.execute(
      sql`SELECT revision, sync_attempt_at, provider_notice, supplier FROM ota_bookings LIMIT 0`,
    );
    await db.execute(sql`SELECT reference FROM ota_payment_jobs LIMIT 0`);
    await db.execute(sql`SELECT id FROM ota_events LIMIT 0`);
    await db.execute(sql`SELECT dedupe_key FROM ota_duffel_events LIMIT 0`);
    results.database = "passed";
  } catch (error: any) {
    const codes = [error?.code, error?.cause?.code, error?.cause?.cause?.code];
    results.database = codes.some((code) => ["42P01", "42703"].includes(code))
      ? "missing schema: apply unapplied OTA migrations 0009, 0010, 0011 and 0014"
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
  results.bilalsadasubSearch =
    !config.flightsEnabled || !config.bilalFlightsEnabled
      ? "paused in OTA settings"
      : bilalTokenForMode(config)
        ? `configured for ${bilalMode(config)} mode; verify the saved key under Flight suppliers`
        : `missing ${bilalMode(config)} API key`;
  results.bilalsadasubCheckout =
    "unavailable: Bilalsadasub online sales are paused or the supplier key is missing";
  if (bilalFlightCheckoutReady(config)) {
    try {
      await paystackKey(bilalMode(config), "bilalsadasub");
      results.bilalsadasubCheckout = `configured for ${bilalMode(config)} mode; verify booking and ticket delivery in sandbox`;
    } catch {
      results.bilalsadasubCheckout = `unavailable: missing Paystack key for Bilalsadasub ${bilalMode(config)} mode`;
    }
  }
  results.hotels = config.hotelsEnabled
    ? "enabled; Stays entitlement still requires a successful search"
    : "disabled; confirm Duffel Stays access before enabling";
  if (
    config.nuiteeHotelsEnabled ||
    config.nuiteeTestToken ||
    config.nuiteeLiveToken
  ) {
    results.nuiteeHotels = nuiteeHotelSearchReady(config)
      ? `configured for ${config.nuiteeMode}; use Test saved connection to verify provider access`
      : "paused or missing the selected environment’s key";
    results.nuiteeCheckout = "paused";
    if (nuiteeHotelCheckoutReady(config)) {
      try {
        await paystackKey(config.nuiteeMode, "nuitee");
        results.nuiteeCheckout = `configured for ${config.nuiteeMode}`;
      } catch {
        results.nuiteeCheckout = `missing a matching Paystack ${config.nuiteeMode} key`;
      }
    }
  }
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
