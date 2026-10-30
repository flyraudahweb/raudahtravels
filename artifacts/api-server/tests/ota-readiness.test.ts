import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  config: vi.fn(),
  keys: vi.fn(),
  payment: vi.fn(),
  duffel: vi.fn(),
}));
vi.mock("@workspace/db", () => ({ db: { execute: mocks.execute } }));
vi.mock("../src/services/ota/config", () => ({ getOtaConfig: mocks.config }));
vi.mock("../src/services/ota/apiKeys", () => ({
  apiKeyStorageReady: mocks.keys,
}));
vi.mock("../src/services/ota/booking", () => ({ paystackKey: mocks.payment }));
vi.mock("../src/services/ota/provider", () => ({
  duffelRequest: mocks.duffel,
}));
import { checkOtaReadiness } from "../src/services/ota/readiness";
import { otaAppOrigin } from "../src/services/ota/appOrigin";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_URL", "https://example.test/");
  mocks.execute.mockResolvedValue({ rows: [] });
  mocks.config.mockResolvedValue({
    mode: "test",
    flightsEnabled: true,
    hotelsEnabled: false,
    salesEnabled: false,
    supportEmail: "",
    webhookTestSecret: "",
    duffelToken: "private-provider-token",
  });
  mocks.keys.mockResolvedValue(true);
  mocks.payment.mockResolvedValue("private-payment-token");
  mocks.duffel.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());

describe("OTA launch diagnostics", () => {
  it("reports the distinct launch gates without exposing secrets or creating a purchase", async () => {
    const result = await checkOtaReadiness();
    expect(result.database).toBe("passed");
    expect(result.apiKeys).toBe("passed");
    expect(result.flights).toBe("enabled");
    expect(result.hotels).toContain("disabled");
    expect(result.sales).toContain("disabled");
    expect(result.support).toContain("missing");
    expect(result.webhook).toContain("missing test");
    expect(result.stays).toContain("not verified");
    expect(mocks.payment).toHaveBeenCalledWith("test");
    expect(mocks.duffel).toHaveBeenCalledExactlyOnceWith(
      expect.any(Object),
      "/air/airlines?limit=1",
    );
    expect(JSON.stringify(result)).not.toMatch(
      /private-provider-token|private-payment-token/,
    );
  });
  it("distinguishes missing schema from a transient database connection failure", async () => {
    mocks.execute.mockRejectedValueOnce({ cause: { code: "42703" } });
    expect((await checkOtaReadiness()).database).toContain("missing schema");
    mocks.execute.mockRejectedValueOnce({
      code: "ECONNRESET",
      message: "private-database-url",
    });
    const result = await checkOtaReadiness();
    expect(result.database).toContain("connectivity");
    expect(result.database).not.toContain("apply");
    expect(JSON.stringify(result)).not.toContain("private-database-url");
  });
  it("does not mistake optional search-key storage for a customer API prerequisite", async () => {
    mocks.keys.mockResolvedValue(false);
    const result = await checkOtaReadiness();
    expect(result.apiKeys).toContain("0012");
    expect(result.apiKeys).toContain(
      "customer JWT access does not require keys",
    );
    expect(result.database).toBe("passed");
  });
  it("reports unreadable configuration safely and avoids a provider call", async () => {
    mocks.config.mockRejectedValue(new Error("private-encryption-material"));
    const result = await checkOtaReadiness();
    expect(result.configuration).toContain("SETTINGS_ENCRYPTION_KEY");
    expect(JSON.stringify(result)).not.toContain("private-encryption-material");
    expect(mocks.duffel).not.toHaveBeenCalled();
  });
  it("shows payment-mode and invalid callback blockers without changing settings", async () => {
    mocks.payment.mockRejectedValue(new Error("private-key"));
    vi.stubEnv("APP_URL", "https://example.test/?redirect=somewhere");
    const result = await checkOtaReadiness();
    expect(result.paystack).toContain("must use test mode");
    expect(result.callback).toContain("invalid");
    expect(JSON.stringify(result)).not.toContain("private-key");
  });
});

it("accepts only complete HTTPS app origins for hosted payment callbacks", () => {
  expect(otaAppOrigin("https://flyraudah.com.ng/")).toBe(
    "https://flyraudah.com.ng",
  );
  expect(otaAppOrigin("https://staging.example.test:8443")).toBe(
    "https://staging.example.test:8443",
  );
  for (const value of [
    "",
    "https://",
    "http://example.test",
    "https://user:secret@example.test",
    "https://example.test/path",
    "https://example.test?x=1",
    "https://example.test#fragment",
  ])
    expect(otaAppOrigin(value)).toBeNull();
});
