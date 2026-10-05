import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ config: vi.fn(), keys: vi.fn(), send: vi.fn() }));
vi.mock("../src/services/registration/config", () => ({ getRegistrationConfig: mocks.config }));
vi.mock("../src/services/registration/database", () => ({ registrationDb: { query: { siteSettingsTable: { findMany: mocks.keys } } } }));
vi.mock("@workspace/db", () => ({ siteSettingsTable: { key: "key" } }));
vi.mock("../src/lib/r2", () => ({ r2Client: { send: mocks.send }, BUCKET_NAME: "test-bucket" }));
import { checkRegistrationConnections } from "../src/services/registration/ConnectionChecks";

beforeEach(() => {
  vi.clearAllMocks(); vi.unstubAllGlobals();
  mocks.config.mockResolvedValue({}); mocks.keys.mockResolvedValue([]); mocks.send.mockResolvedValue({});
  process.env.APP_URL = "https://example.test";
});
it("reports missing integrations without making external requests", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  expect((await checkRegistrationConnections()).every(check => check.status === "not_configured")).toBe(true);
  expect(fetch).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
});
it("validates saved tokens, model capabilities and bucket listing through read-only requests", async () => {
  mocks.config.mockResolvedValue({ whatsappAccessToken: "secret-wa", whatsappPhoneNumberId: "123", whatsappApiVersion: "v21.0",
    telegramBotToken: "secret-telegram", geminiKey: "secret-gemini", geminiModel: "test-model", mistralKey: "secret-mistral", mistralModel: "vision-model",
    r2AccountId: "account", r2AccessKeyId: "access", r2SecretAccessKey: "storage-secret" });
  const fetch = vi.fn(async (url: string) => Response.json(url.includes("graph.facebook.com") ? { id: "123" }
    : url.endsWith("getMe") ? { ok: true, result: { is_bot: true } }
    : url.endsWith("getWebhookInfo") ? { ok: true, result: { url: "https://example.test/api/telegram/webhook" } }
    : url.includes("googleapis.com") ? { supportedGenerationMethods: ["generateContent"] }
    : { data: [{ id: "vision-model", capabilities: { vision: true } }] }));
  vi.stubGlobal("fetch", fetch);
  expect((await checkRegistrationConnections()).every(check => check.status === "passed")).toBe(true);
  for (const [, options] of fetch.mock.calls as any[]) {
    expect(options.method).toBeUndefined(); expect(options.redirect).toBe("error"); expect(options.signal).toBeDefined();
  }
  expect(mocks.send.mock.calls.map(([command]) => command.constructor.name)).toEqual(["HeadBucketCommand", "ListObjectsV2Command"]);
});
it("does not leak tokens, URLs or provider errors in failure results", async () => {
  mocks.config.mockResolvedValue({ telegramBotToken: "very-private-token" });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Request failed at https://api.telegram.org/botvery-private-token/getMe")));
  const result = await checkRegistrationConnections();
  expect(result.find(check => check.integration === "Telegram")?.status).toBe("failed");
  expect(JSON.stringify(result)).not.toContain("very-private-token"); expect(JSON.stringify(result)).not.toContain("https://");
});
it("reports mismatched Telegram webhooks and rejects Mistral models without vision", async () => {
  mocks.config.mockResolvedValue({ telegramBotToken: "test", mistralKey: "test", mistralModel: "text-only" });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json(url.endsWith("getMe") ? { ok: true, result: { is_bot: true } }
    : url.endsWith("getWebhookInfo") ? { ok: true, result: { url: "https://wrong.test/webhook" } }
    : { data: [{ id: "text-only", capabilities: { vision: false } }] })));
  const result = await checkRegistrationConnections();
  expect(result.find(check => check.integration === "Telegram")?.message).toContain("register the displayed webhook");
  expect(result.find(check => check.integration === "Mistral")?.status).toBe("failed");
});
it("checks the existing AI Integration keys when dedicated registration keys are absent", async () => {
  mocks.config.mockResolvedValue({ geminiModel: "test-model" });
  mocks.keys.mockResolvedValue([{ key: "gemini_api_key", value: "legacy-private-key" }]);
  const fetch = vi.fn().mockResolvedValue(Response.json({ supportedGenerationMethods: ["generateContent"] })); vi.stubGlobal("fetch", fetch);
  expect((await checkRegistrationConnections()).find(check => check.integration === "Gemini")?.status).toBe("passed");
  expect(fetch.mock.calls[0][1].headers["x-goog-api-key"]).toBe("legacy-private-key");
});
