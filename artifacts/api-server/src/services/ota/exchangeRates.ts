import { z } from "zod";

const observation = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((v) => !Number.isNaN(Date.parse(v))),
  base: z.literal("NGN"),
  quote: z.string().regex(/^[A-Z]{3}$/),
  rate: z.number().finite().positive(),
});
export type ReferenceRates = {
  provider: "Frankfurter" | "ExchangeRate-API";
  sourceUrl: string;
  frequency: "daily" | "provider_schedule";
  publishedAt?: string;
  nextUpdateAt?: string;
  fetchedAt: string | null;
  stale: boolean;
  status: "current" | "cached" | "unavailable" | "disabled";
  rates: Record<string, { ngnPerUnit: number; date: string }>;
};
const sourceUrl = "https://frankfurter.dev/";
let cached: ReferenceRates | undefined;
let cachedKey = "",
  expiresAt = 0,
  retryAfter = 0,
  retryKey = "";
let inFlight: Promise<ReferenceRates> | undefined;
let inFlightKey = "";

export function parseReferenceRates(
  input: unknown,
  currencies: string[],
  now = new Date(),
): ReferenceRates {
  const rows = z.array(observation).min(1).max(250).parse(input);
  const wanted = new Set(currencies.filter((c) => c !== "NGN"));
  const rates: ReferenceRates["rates"] = {};
  for (const row of rows) {
    if (!wanted.has(row.quote)) continue;
    if (Date.parse(row.date) > now.getTime() + 86400000)
      throw new Error("Invalid reference date");
    const ngnPerUnit = 1 / row.rate;
    if (!Number.isFinite(ngnPerUnit) || ngnPerUnit <= 0 || ngnPerUnit > 1e7)
      throw new Error("Invalid reference rate");
    if (!rates[row.quote] || rates[row.quote].date < row.date)
      rates[row.quote] = { ngnPerUnit, date: row.date };
  }
  if (!Object.keys(rates).length)
    throw new Error("No supported reference rates returned");
  return {
    provider: "Frankfurter",
    sourceUrl,
    frequency: "daily",
    fetchedAt: now.toISOString(),
    status: "current",
    stale: Object.values(rates).some(
      (r) => now.getTime() - Date.parse(r.date) > 72 * 3600000,
    ),
    rates,
  };
}

export async function referenceRates(
  currencies: string[],
): Promise<ReferenceRates> {
  const paid = process.env.OTA_FX_PROVIDER === "exchangerate_api";
  const empty: ReferenceRates = {
    provider: paid ? "ExchangeRate-API" : "Frankfurter",
    sourceUrl: paid ? "https://www.exchangerate-api.com/" : sourceUrl,
    frequency: paid ? "provider_schedule" : "daily",
    fetchedAt: null,
    stale: true,
    status: "unavailable",
    rates: {},
  };
  if (process.env.OTA_FX_REFERENCE_ENABLED === "false")
    return { ...empty, status: "disabled" };
  const requested = [
    ...new Set(["USD", "GBP", "EUR", "SAR", "AED", ...currencies]),
  ]
    .filter((c) => /^[A-Z]{3}$/.test(c) && c !== "NGN")
    .sort()
    .slice(0, 200);
  const key = `${paid ? "exchangerate_api" : "frankfurter"}:${requested.join(",")}`,
    now = Date.now();
  const fallback = (): ReferenceRates =>
    cached &&
    cachedKey === key &&
    now - Date.parse(cached.fetchedAt!) < 7 * 86400000
      ? { ...cached, stale: true, status: "cached" }
      : empty;
  if (cached && cachedKey === key && now < expiresAt) return cached;
  if (now < retryAfter && retryKey === key) return fallback();
  if (inFlight) {
    if (inFlightKey === key) return inFlight;
    await inFlight;
    return referenceRates(currencies);
  }
  inFlightKey = key;
  inFlight = (async () => {
    await Promise.resolve();
    try {
      const apiKey = process.env.EXCHANGERATE_API_KEY || "";
      if (paid && !apiKey)
        throw new Error("Intraday reference provider is not configured");
      const url = paid
        ? `https://v6.exchangerate-api.com/v6/${encodeURIComponent(apiKey)}/latest/NGN`
        : `https://api.frankfurter.dev/v2/rates?base=NGN&quotes=${encodeURIComponent(requested.join(","))}`;
      const response = await fetch(url, {
        redirect: "error",
        signal: AbortSignal.timeout(10000),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Reference service unavailable");
      const body = await response.json();
      let result: ReferenceRates;
      if (paid) {
        const parsed = z
          .object({
            result: z.literal("success"),
            base_code: z.literal("NGN"),
            time_last_update_unix: z.number().int().positive(),
            time_next_update_unix: z.number().int().positive(),
            conversion_rates: z.record(z.number().finite().positive()),
          })
          .parse(body);
        const publishedAt = new Date(
          parsed.time_last_update_unix * 1000,
        ).toISOString();
        result = {
          ...parseReferenceRates(
            requested
              .filter((c) => parsed.conversion_rates[c])
              .map((quote) => ({
                date: publishedAt.slice(0, 10),
                base: "NGN",
                quote,
                rate: parsed.conversion_rates[quote],
              })),
            requested,
          ),
          provider: "ExchangeRate-API",
          sourceUrl: empty.sourceUrl,
          frequency: "provider_schedule",
          publishedAt,
          nextUpdateAt: new Date(
            parsed.time_next_update_unix * 1000,
          ).toISOString(),
        };
      } else result = parseReferenceRates(body, requested);
      cached = result;
      cachedKey = key;
      retryAfter = 0;
      const seconds = Number(process.env.OTA_FX_REFRESH_SECONDS || 900);
      expiresAt =
        Date.now() +
        (Number.isFinite(seconds)
          ? Math.min(86400, Math.max(300, seconds))
          : 900) *
          1000;
      const nextPublication = result.nextUpdateAt
        ? Date.parse(result.nextUpdateAt)
        : NaN;
      if (Number.isFinite(nextPublication) && nextPublication > Date.now()) {
        expiresAt = Math.min(
          expiresAt,
          Math.max(Date.now() + 60000, nextPublication),
        );
      }
      return result;
    } catch {
      cachedKey = cached ? cachedKey : key;
      retryKey = key;
      retryAfter = Date.now() + 60000;
      return fallback();
    } finally {
      inFlight = undefined;
    }
  })();
  return inFlight;
}
