import { afterEach, beforeEach, expect, it, vi } from "vitest";

const observation = [
  { base: "NGN", quote: "USD", rate: 0.001, date: "2026-10-29" },
  { base: "NGN", quote: "GBP", rate: 0.0005, date: "2026-10-29" },
];
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
  vi.stubEnv("OTA_FX_REFERENCE_ENABLED", "true");
  vi.stubEnv("OTA_FX_PROVIDER", "frankfurter");
  vi.stubEnv("OTA_FX_REFRESH_SECONDS", "900");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("converts NGN-base observations into NGN per supplier-currency unit and preserves dates", async () => {
  const { parseReferenceRates } =
    await import("../src/services/ota/exchangeRates");
  const result = parseReferenceRates(observation, ["USD", "GBP"]);
  expect(result.rates.USD).toEqual({ ngnPerUnit: 1000, date: "2026-10-29" });
  expect(result.rates.GBP.ngnPerUnit).toBe(2000);
  expect(result.stale).toBe(false);
  expect(
    parseReferenceRates([{ ...observation[0], date: "2026-10-20" }], ["USD"])
      .stale,
  ).toBe(true);
  for (const rate of [0, -1, NaN, Infinity])
    expect(() =>
      parseReferenceRates([{ ...observation[0], rate }], ["USD"]),
    ).toThrow();
});
it("coalesces simultaneous requests and caches the reference feed without changing approved rates", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json(observation));
  vi.stubGlobal("fetch", fetch);
  const { referenceRates } = await import("../src/services/ota/exchangeRates");
  const approved = { NGN: 1, USD: 1500, GBP: 2200 };
  const [first, second] = await Promise.all([
    referenceRates(Object.keys(approved)),
    referenceRates(Object.keys(approved)),
  ]);
  expect(first).toEqual(second);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(first.rates.USD.ngnPerUnit).toBe(1000);
  expect(approved.USD).toBe(1500);
  await referenceRates(Object.keys(approved));
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("labels an outage as stale cached data and backs off failed requests", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json(observation))
    .mockRejectedValue(new Error("provider unavailable"));
  vi.stubGlobal("fetch", fetch);
  const { referenceRates } = await import("../src/services/ota/exchangeRates");
  await referenceRates(["USD"]);
  vi.advanceTimersByTime(901000);
  const fallback = await referenceRates(["USD"]);
  expect(fallback.status).toBe("cached");
  expect(fallback.stale).toBe(true);
  expect(fallback.rates.USD.ngnPerUnit).toBe(1000);
  await referenceRates(["USD"]);
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("does not fabricate a rate or leak provider errors when the feed is unavailable", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockRejectedValue(
        new Error("https://secret-provider-url/private-token"),
      ),
  );
  const { referenceRates } = await import("../src/services/ota/exchangeRates");
  const result = await referenceRates(["USD"]);
  expect(result.status).toBe("unavailable");
  expect(result.rates).toEqual({});
  expect(JSON.stringify(result)).not.toContain("private-token");
});
it("supports an optional faster provider and reports its actual update schedule without exposing its key", async () => {
  vi.stubEnv("OTA_FX_PROVIDER", "exchangerate_api");
  vi.stubEnv("EXCHANGERATE_API_KEY", "private-fx-key");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({
          result: "success",
          base_code: "NGN",
          time_last_update_unix: Date.now() / 1000 - 300,
          time_next_update_unix: Date.now() / 1000 + 300,
          conversion_rates: { NGN: 1, USD: 0.001, GBP: 0.0005 },
        }),
      ),
  );
  const { referenceRates } = await import("../src/services/ota/exchangeRates");
  const result = await referenceRates(["USD", "GBP"]);
  expect(result.provider).toBe("ExchangeRate-API");
  expect(result.frequency).toBe("provider_schedule");
  expect(result.nextUpdateAt).toBeTruthy();
  expect(result.rates.GBP.ngnPerUnit).toBe(2000);
  expect(JSON.stringify(result)).not.toContain("private-fx-key");
});
it("can disable external references while retaining an explicit disabled state", async () => {
  vi.stubEnv("OTA_FX_REFERENCE_ENABLED", "false");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const { referenceRates } = await import("../src/services/ota/exchangeRates");
  expect((await referenceRates(["USD"])).status).toBe("disabled");
  expect(fetch).not.toHaveBeenCalled();
});
