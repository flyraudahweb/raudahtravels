import { beforeEach, expect, it, vi } from "vitest";
import { normalizePassport, normalizePhone, similarity } from "../src/services/registration/normalizers";
import { approveSchema, reviewFieldsSchema } from "../src/services/registration/validation";
import { imageMime, downloadImage, MAX_MEDIA_BYTES } from "../src/services/channels/media";

const mocks = vi.hoisted(() => ({ mistral: vi.fn(), config: vi.fn() }));
vi.mock("@workspace/db", () => ({ db: { query: { siteSettingsTable: { findMany: mocks.config, findFirst: vi.fn().mockResolvedValue(undefined) } } }, siteSettingsTable: { key: "key" } }));
vi.mock("@mistralai/mistralai", () => ({ Mistral: class { chat = { complete: mocks.mistral }; } }));
import { extractPassport, parseExtraction, isComplete } from "../src/services/passport/PassportExtractionService";
import { TelegramAdapter } from "../src/services/channels/TelegramAdapter";

it("accepts Telegram private chats and rejects group messages and callbacks", () => {
  expect(TelegramAdapter.parseInbound({ update_id: 1, message: { chat: { id: 1, type: "private" }, text: "/start" } })).toHaveLength(1);
  expect(TelegramAdapter.parseInbound({ update_id: 2, message: { chat: { id: 1, type: "supergroup" }, text: "/start" } })).toHaveLength(0);
  expect(TelegramAdapter.parseInbound({ update_id: 3, callback_query: { data: "confirm", message: { chat: { id: 1, type: "supergroup" } } } })).toHaveLength(0);
});

const passport = { isAcceptableQuality: true, rejectionReason: "", firstName: "Test", lastName: "Pilgrim", documentNumber: "A12345678",
  nationality: "NIGERIAN", dateOfBirth: "1990-01-01", sex: "M", dateOfIssue: "2025-01-01", dateOfExpiry: "2030-01-01" };

beforeEach(() => {
  vi.clearAllMocks(); vi.unstubAllGlobals();
  delete process.env.AI_REGISTRATION_AUTO_FALLBACK;
  mocks.config.mockResolvedValue([{ key: "gemini_api_key", value: "test" }, { key: "mistral_api_key", value: "test" }]);
  mocks.mistral.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(passport) } }] });
});

it("falls back to Mistral on provider HTTP failure", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 429 })));
  const result = await extractPassport("image", "image/jpeg");
  expect(result.ok).toBe(true); expect(result.provider).toBe("mistral"); expect(result.fallbackTriggered).toBe(true);
});
it("falls back on incomplete and malformed Gemini output", async () => {
  for (const value of [{ ...passport, documentNumber: "" }, { firstName: 123 }, null]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] })));
    expect((await extractPassport("image", "image/jpeg")).provider).toBe("mistral");
  }
});
it("rejects incomplete fallback output instead of claiming success", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));
  mocks.mistral.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ ...passport, dateOfExpiry: "" }) } }] });
  expect((await extractPassport("image", "image/jpeg")).ok).toBe(false);
});
it("forces Mistral without making a Gemini request", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  expect((await extractPassport("image", "image/jpeg", { forceProvider: "mistral" })).provider).toBe("mistral");
  expect(fetch).not.toHaveBeenCalled();
});
it("returns a quality rejection when neither provider can read the image", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ ...passport, isAcceptableQuality: false }) }] } }] })));
  mocks.mistral.mockRejectedValue(new Error("offline"));
  expect((await extractPassport("image", "image/jpeg")).data?.isAcceptableQuality).toBe(false);
});
it("validates extraction types, calendar dates and core fields", () => {
  expect(() => parseExtraction({ ...passport, dateOfBirth: "2026-02-30" })).toThrow();
  expect(() => parseExtraction({ ...passport, isAcceptableQuality: "true" })).toThrow();
  expect(isComplete(parseExtraction(passport))).toBe(true);
});
it("normalizes Nigerian phones, passports and fuzzy names", () => {
  expect(normalizePhone("+2348031234567")).toBe(normalizePhone("08031234567"));
  expect(normalizePassport("a-123 456")).toBe("A123456");
  expect(similarity("test pilgrim", "test pilgrim")).toBe(1);
});
it("rejects payment/status injection and invalid review dates", () => {
  expect(approveSchema.safeParse({ amountPaid: 100, status: "confirmed" }).success).toBe(false);
  expect(reviewFieldsSchema.safeParse({ dateOfBirth: "2026-02-30" }).success).toBe(false);
  expect(approveSchema.safeParse({ duplicateOverrideReason: " " }).success).toBe(false);
});
it("checks image signatures and enforces streaming size limits", async () => {
  expect(imageMime(Buffer.from([255, 216, 255, 0]))).toBe("image/jpeg");
  expect(() => imageMime(Buffer.from("%PDF-1.7"))).toThrow();
  expect(() => imageMime(Buffer.alloc(MAX_MEDIA_BYTES + 1))).toThrow();
  await expect(downloadImage(new Response("x", { headers: { "content-length": String(MAX_MEDIA_BYTES + 1) } }))).rejects.toThrow();
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MAX_MEDIA_BYTES + 1)); controller.close(); } });
  await expect(downloadImage(new Response(stream))).rejects.toThrow();
});
