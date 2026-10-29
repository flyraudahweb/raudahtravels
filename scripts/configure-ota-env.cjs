// Configure local OTA defaults without logging secrets or replacing saved keys.
// Admin Settings remain authoritative for Paystack and saved OTA exchange rates.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
const file = path.join(root, ".env");

async function main() {
  let source = fs.readFileSync(file, "utf8");
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const entries = {};
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match) {
      if (Object.hasOwn(entries, match[1]))
        throw new Error(
          "Duplicate environment keys need review; no changes made",
        );
      entries[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
    }
  }
  if (
    entries.SETTINGS_ENCRYPTION_KEY &&
    !/^[a-f0-9]{64}$/i.test(entries.SETTINGS_ENCRYPTION_KEY)
  )
    throw new Error("Existing encryption key is invalid; it was not replaced");
  const changed = [];
  function set(key, value) {
    if (entries[key] === value) return;
    const line = `${key}=${value.includes("{") ? `'${value}'` : value}`;
    const pattern = new RegExp(`^\\s*${key}\\s*=.*$`, "m");
    source = pattern.test(source)
      ? source.replace(pattern, () => line)
      : `${source.trimEnd()}${newline}${line}${newline}`;
    entries[key] = value;
    changed.push(key);
  }
  if (!entries.SETTINGS_ENCRYPTION_KEY)
    set("SETTINGS_ENCRYPTION_KEY", crypto.randomBytes(32).toString("hex"));
  if (
    !entries.APP_URL ||
    /^http:\/\/(localhost|127\.0\.0\.1):8080\/?$/.test(entries.APP_URL)
  )
    set("APP_URL", "http://localhost:5173");
  if (!entries.CORS_ORIGIN)
    set("CORS_ORIGIN", "http://localhost:5173,http://127.0.0.1:5173");
  const mode =
    process.argv.find((v) => v.startsWith("--mode="))?.slice(7) ||
    entries.OTA_MODE ||
    "test";
  if (!["test", "live"].includes(mode))
    throw new Error("Select --mode=test or --mode=live");
  set("OTA_MODE", mode);
  if (!Object.hasOwn(entries, "OTA_FLIGHTS_ENABLED"))
    set("OTA_FLIGHTS_ENABLED", "false");
  if (process.argv.includes("--enable-flight-search"))
    set("OTA_FLIGHTS_ENABLED", "true");
  if (!Object.hasOwn(entries, "OTA_HOTELS_ENABLED"))
    set("OTA_HOTELS_ENABLED", "false");
  if (!Object.hasOwn(entries, "OTA_SALES_ENABLED"))
    set("OTA_SALES_ENABLED", "false");
  set("OTA_FX_REFERENCE_ENABLED", "true");
  if (!entries.OTA_FX_PROVIDER) set("OTA_FX_PROVIDER", "frankfurter");
  if (!Object.hasOwn(entries, "EXCHANGERATE_API_KEY"))
    set("EXCHANGERATE_API_KEY", "");
  if (!entries.OTA_FX_REFRESH_SECONDS) set("OTA_FX_REFRESH_SECONDS", "900");
  if (!Object.hasOwn(entries, "DUFFEL_API_TOKEN")) set("DUFFEL_API_TOKEN", "");
  if (!entries.OTA_DEFAULT_RATES) {
    const response = await fetch(
      "https://api.frankfurter.dev/v2/rates?base=NGN&quotes=USD,GBP,EUR,SAR,AED",
      { redirect: "error", signal: AbortSignal.timeout(12000) },
    );
    if (!response.ok)
      throw new Error(
        "Could not obtain initial reference rates; no changes made",
      );
    const observations = await response.json();
    const rates = { NGN: 1 },
      dates = [];
    if (!Array.isArray(observations))
      throw new Error("Invalid reference response; no changes made");
    for (const row of observations) {
      if (
        row.base !== "NGN" ||
        !["USD", "GBP", "EUR", "SAR", "AED"].includes(row.quote) ||
        !Number.isFinite(row.rate) ||
        row.rate <= 0 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(row.date)
      )
        throw new Error("Invalid reference response; no changes made");
      if (
        Date.now() - Date.parse(row.date) > 7 * 86400000 ||
        Date.parse(row.date) > Date.now() + 86400000
      )
        throw new Error(
          "Reference data is too old or invalid; no changes made",
        );
      rates[row.quote] = Number((1 / row.rate).toFixed(6));
      dates.push(row.date);
    }
    if (Object.keys(rates).length !== 6)
      throw new Error(
        "Reference feed did not include all initial currencies; no changes made",
      );
    set("OTA_DEFAULT_RATES", JSON.stringify(rates));
    set("OTA_DEFAULT_RATES_AS_OF", dates.sort()[0]);
  }
  fs.writeFileSync(file, source);
  const productionArg = process.argv
    .find((v) => v.startsWith("--production-url="))
    ?.slice(17);
  if (productionArg) {
    const url = new URL(productionArg);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !["", "/"].includes(url.pathname)
    )
      throw new Error("Production URL must be an HTTPS origin");
    const productionFile = path.join(root, ".env.production");
    let production = fs.existsSync(productionFile)
      ? fs.readFileSync(productionFile, "utf8")
      : "# OTA overlay for hosting. Preserve existing database, Clerk, encryption and Paystack secrets on the host.\n# Duffel is in sandbox mode. OTA payments remain disabled while saved Paystack keys are live.\n";
    const fields = {
      NODE_ENV: "production",
      APP_URL: url.origin,
      CORS_ORIGIN: url.origin,
    };
    for (const key of [
      "DUFFEL_API_TOKEN",
      "OTA_MODE",
      "OTA_FLIGHTS_ENABLED",
      "OTA_HOTELS_ENABLED",
      "OTA_SALES_ENABLED",
      "OTA_DEFAULT_RATES",
      "OTA_DEFAULT_RATES_AS_OF",
      "OTA_FX_REFERENCE_ENABLED",
      "OTA_FX_PROVIDER",
      "OTA_FX_REFRESH_SECONDS",
    ])
      if (Object.hasOwn(entries, key)) fields[key] = entries[key];
    for (const [key, value] of Object.entries(fields)) {
      const pattern = new RegExp(`^\\s*${key}\\s*=.*$`, "m"),
        line = `${key}=${value.includes("{") ? `'${value}'` : value}`;
      production = pattern.test(production)
        ? production.replace(pattern, () => line)
        : `${production.trimEnd()}\n${line}\n`;
    }
    fs.writeFileSync(productionFile, production);
    console.log(
      JSON.stringify({
        productionOverlay: ".env.production",
        origin: url.origin,
        existingHostingSecrets: "not_copied_or_replaced",
      }),
    );
  }
  console.log(
    JSON.stringify({
      updatedFile: ".env",
      changedKeys: changed,
      encryptionKey: "preserved_or_generated_without_display",
      paystack: "unchanged_uses_admin_settings",
      otaMode: mode,
      sales: "not_enabled_by_this_script",
      initialRatesAsOf: entries.OTA_DEFAULT_RATES_AS_OF || null,
    }),
  );
}
main().catch(() => {
  console.error(
    "OTA environment setup failed. Existing file and secret values were not printed. Check network access and environment key validity.",
  );
  process.exitCode = 1;
});
