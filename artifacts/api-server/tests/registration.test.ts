import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { randomUUID, createHmac } from "node:crypto";
import express from "express";
import EmbeddedPostgres from "embedded-postgres";

const mocks = vi.hoisted(() => ({ extract: vi.fn(), send: vi.fn(), upload: vi.fn(), delete: vi.fn(), list: vi.fn() }));
vi.mock("../src/services/passport/PassportExtractionService", () => ({ extractPassport: mocks.extract, PASSPORT_PROMPT: "test" }));
vi.mock("../src/lib/r2", () => ({ isR2Configured: () => true, uploadToR2: mocks.upload,
  getFromR2: async () => ({ contentType: "image/jpeg", body: { transformToByteArray: async () => new Uint8Array([255, 216, 255, 0]) } }),
  r2Client: { send: (command: any) => command.constructor.name === "DeleteObjectCommand" ? mocks.delete(command) : mocks.list(command) }, BUCKET_NAME: "test" }));
vi.mock("@clerk/express", async (importOriginal) => ({ ...await importOriginal<typeof import("@clerk/express")>(), getAuth: (req: any) => ({ userId: req.headers["x-test-user"] }) }));
vi.mock("../src/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

let pg: EmbeddedPostgres;
let directory: string;
let dbModule: typeof import("@workspace/db");
let queue: typeof import("../src/services/channels/ChannelQueue");
let transaction: typeof import("../src/services/registration/database");
let conversation: typeof import("../src/services/registration/ConversationService");
let duplicate: typeof import("../src/services/registration/DuplicateDetectionService");
let app: ReturnType<typeof express>;
let server: ReturnType<ReturnType<typeof express>["listen"]>;
let baseUrl: string;
let staffId: string;
let packageId: string;
let sequence = 0;
const jpg = Buffer.from([255, 216, 255, 0]).toString("base64");

beforeAll(async () => {
  const port = await new Promise<number>((resolve) => {
    const socket = createServer();
    socket.listen(0, "127.0.0.1", () => { const n = (socket.address() as any).port; socket.close(() => resolve(n)); });
  });
  directory = await mkdtemp(path.join(tmpdir(), "raudah-registration-test-"));
  pg = new EmbeddedPostgres({ databaseDir: path.join(directory, "postgres"), port, user: "postgres", password: "test-only",
    persistent: true, initdbFlags: ["--encoding=UTF8", "--locale=C"], postgresFlags: ["-h", "127.0.0.1"], onLog: () => {}, onError: () => {} });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("registration_test");
  process.env.DATABASE_URL = `postgresql://postgres:test-only@127.0.0.1:${port}/registration_test`;
  process.env.AI_REGISTRATION_ENABLED = "true";
  process.env.SETTINGS_ENCRYPTION_KEY = "12".repeat(32);
  process.env.WHATSAPP_VERIFY_TOKEN = "test-verify"; process.env.WHATSAPP_ACCESS_TOKEN = "test"; process.env.WHATSAPP_APP_SECRET = "test-secret";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456"; process.env.WHATSAPP_REVIEW_TEMPLATE = "test_review";
  process.env.TELEGRAM_BOT_TOKEN = "test"; process.env.TELEGRAM_WEBHOOK_SECRET = "test-secret";
  dbModule = await import("@workspace/db");
  const root = path.resolve(process.cwd(), "../..");
  const schema = execFileSync(process.execPath, [path.join(root, "lib/db/node_modules/drizzle-kit/bin.cjs"), "export", "--config=./drizzle.config.ts"],
    { cwd: path.join(root, "lib/db"), env: { ...process.env }, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  await dbModule.pool.query(schema);
  // Exercise the actual additive migrations against a base application schema.
  await dbModule.pool.query("DROP TABLE ai_registration_jobs, ai_registration_audit, ai_registration_messages, ai_registration_submissions, ai_registration_sessions CASCADE");
  await dbModule.pool.query("DROP TYPE ai_channel, ai_session_status, ai_session_step, ai_duplicate_status, ai_extraction_provider, ai_submission_status, ai_message_direction, ai_message_type CASCADE");
  await dbModule.pool.query(await readFile(path.join(root, "lib/db/drizzle/0007_ai_registration.sql"), "utf8"));
  await dbModule.pool.query(await readFile(path.join(root, "lib/db/drizzle/0008_ai_registration_reliability.sql"), "utf8"));
  queue = await import("../src/services/channels/ChannelQueue");
  transaction = await import("../src/services/registration/database");
  conversation = await import("../src/services/registration/ConversationService");
  duplicate = await import("../src/services/registration/DuplicateDetectionService");
  const { WhatsAppAdapter } = await import("../src/services/channels/WhatsAppAdapter");
  const { TelegramAdapter } = await import("../src/services/channels/TelegramAdapter");
  vi.spyOn(WhatsAppAdapter, "sendReply").mockImplementation(mocks.send);
  vi.spyOn(TelegramAdapter, "sendReply").mockImplementation(mocks.send);
  vi.spyOn(TelegramAdapter, "fetchMedia").mockResolvedValue({ base64: jpg, mimeType: "image/jpeg" });
  app = express();
  app.use(express.json({ verify: (req, _res, buffer) => { (req as any).rawBody = buffer; } }));
  app.use((req, _res, next) => { req.log = { error: vi.fn() } as any; next(); });
  app.use("/api", (await import("../src/routes/index")).default);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as any).port}/api`;
}, 120000);

afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (dbModule) await dbModule.pool.end();
  if (pg) await pg.stop();
  if (directory && path.dirname(directory) === tmpdir() && path.basename(directory).startsWith("raudah-registration-test-")) await rm(directory, { recursive: true, force: true });
});

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue({ Contents: [] });
  const tables = await dbModule.pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  await dbModule.pool.query(`TRUNCATE ${tables.rows.map((r) => `"${r.tablename}"`).join(",")} CASCADE`);
  staffId = randomUUID(); packageId = randomUUID();
  await dbModule.pool.query("INSERT INTO profiles(id,clerk_user_id,email,full_name,role) VALUES ($1,'test-admin','admin@test.invalid','Test Admin','admin')", [staffId]);
  await dbModule.pool.query(`INSERT INTO packages(id,name,type,description,price,duration_days,departure_date,return_date,capacity,max_capacity,status,is_active)
    VALUES ($1,'Test Umrah','umrah','test',100000,7,'2027-01-01','2027-01-08',10,10,'active',true)`, [packageId]);
  mocks.extract.mockResolvedValue({ ok: true, provider: "gemini", fallbackTriggered: false, data: {
    isAcceptableQuality: true, rejectionReason: "", firstName: "Test", lastName: "Pilgrim", documentNumber: "A12345678",
    nationality: "NIGERIAN", dateOfBirth: "1990-01-01", sex: "M", dateOfIssue: "2025-01-01", dateOfExpiry: "2030-01-01",
  } });
});

async function api(endpoint: string, method = "GET", body?: unknown, user = "test-admin") {
  return fetch(baseUrl + endpoint, { method, headers: { "Content-Type": "application/json", "x-test-user": user }, body: body ? JSON.stringify(body) : undefined });
}
async function turn(text: string, type: "text" | "image" = "text", sender = "100") {
  await queue.enqueueInbound([{ channel: "telegram", channelUserId: sender, channelMessageId: String(++sequence), type,
    text, ...(type === "image" ? { mediaBase64: jpg } : {}) }]);
  for (let i = 0; i < 10 && await queue.processNextJob(); i++);
}
async function submission(manual = false) {
  if (manual) mocks.extract.mockResolvedValue({ ok: false, fallbackTriggered: true, error: { status: 503, message: "offline" } });
  await turn("/start"); await turn("Test Pilgrim"); await turn("08031234567"); await turn(packageId);
  await turn("", "image"); await turn("confirm");
  return (await dbModule.pool.query("SELECT * FROM ai_registration_submissions")).rows[0];
}

describe("production registration workflow on real PostgreSQL", () => {
  it("uses the configured expiry for new intake sessions", async () => {
    expect((await api("/admin/registration-settings", "PUT", { enabled: false, sessionTtlHours: 72 })).status).toBe(200);
    const { handleInboundMessage } = await import("../src/services/registration/RegistrationAgentService");
    const result = await transaction.registrationTransaction(() => handleInboundMessage({ channel: "telegram", channelUserId: "ttl-test", channelMessageId: String(++sequence), type: "text", text: "/start" }));
    expect(result.session.expiresAt!.getTime() - Date.now()).toBeGreaterThan(71 * 3600000);
  });
  it("encrypts admin credentials, masks reads and preserves blank secrets on partial updates", async () => {
    const saved = await api("/admin/registration-settings", "PUT", { enabled: false, telegramBotToken: "rotated-bot-token", telegramWebhookSecret: "rotated-webhook", sessionTtlHours: 72 });
    expect(saved.status).toBe(200);
    const safe = await saved.json();
    expect(safe.telegramBotToken).toBe(""); expect(safe.telegramBotTokenSet).toBe(true);
    const stored = (await dbModule.pool.query("SELECT value FROM site_settings WHERE key='ai_registration_config'")).rows[0].value;
    expect(stored.telegramBotToken).toMatch(/^enc:v1:/);
    expect(JSON.stringify(stored)).not.toContain("rotated-bot-token");
    expect((await api("/admin/settings").then(r => r.json())).settings.ai_registration_config).toBeUndefined();
    const updated = await api("/admin/registration-settings", "PUT", { telegramBotToken: "", rateLimitPerMin: 30 });
    expect(updated.status).toBe(200);
    const { getRegistrationConfig } = await import("../src/services/registration/config");
    const config = await getRegistrationConfig();
    expect(config.enabled).toBe(false); expect(config.sessionTtlHours).toBe(72);
    expect(config.telegramBotToken).toBe("rotated-bot-token"); expect(config.rateLimitPerMin).toBe(30);
  });
  it("applies webhook secret rotation and enabling without a process restart", async () => {
    expect((await api("/admin/registration-settings", "PUT", { telegramWebhookSecret: "new-secret", enabled: true })).status).toBe(200);
    const body = { update_id: ++sequence, message: { message_id: sequence, chat: { id: 800, type: "private" }, text: "/start" } };
    const webhook = (secret: string) => fetch(`${baseUrl}/telegram/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "x-telegram-bot-api-secret-token": secret }, body: JSON.stringify(body) });
    expect((await webhook("test-secret")).status).toBe(401);
    expect((await webhook("new-secret")).status).toBe(200);
    expect((await dbModule.pool.query("SELECT * FROM ai_registration_jobs WHERE channel_user_id='800'")).rows).toHaveLength(1);
    expect((await api("/admin/registration-settings", "PUT", { enabled: false })).status).toBe(200);
    await webhook("new-secret");
    expect((await dbModule.pool.query("SELECT * FROM ai_registration_jobs WHERE channel_user_id='800'")).rows).toHaveLength(1);
  });
  it("encrypts storage credentials and prevents moving the location of existing documents", async () => {
    expect((await api("/admin/registration-settings", "PUT", { enabled: false, r2AccountId: "a".repeat(32), r2AccessKeyId: "storage-id", r2SecretAccessKey: "storage-secret" })).status).toBe(200);
    expect((await api("/admin/registration-settings", "PUT", { r2BucketName: "different-bucket" })).status).toBe(400);
    expect((await api("/admin/registration-settings", "PUT", { r2SecretAccessKey: "rotated-storage-secret" })).status).toBe(200);
    const { getRegistrationConfig } = await import("../src/services/registration/config");
    expect((await getRegistrationConfig()).r2SecretAccessKey).toBe("rotated-storage-secret");
    const safe = await api("/admin/registration-settings").then(r => r.json());
    expect(safe.r2SecretAccessKey).toBe(""); expect(safe.r2SecretAccessKeySet).toBe(true);
  });
  it("protects registration secrets from staff, generic writes, invalid config and lost encryption keys", async () => {
    expect((await api("/admin/settings/ai_registration_config", "PUT", { value: {} })).status).toBe(400);
    expect((await api("/admin/registration-settings", "PUT", { rateLimitPerMin: 999 })).status).toBe(400);
    expect((await api("/admin/registration-settings", "PUT", { unknown: "field" })).status).toBe(400);
    const key = process.env.SETTINGS_ENCRYPTION_KEY;
    delete process.env.SETTINGS_ENCRYPTION_KEY;
    try { expect((await api("/admin/registration-settings", "PUT", { telegramBotToken: "replacement" })).status).toBe(400); }
    finally { process.env.SETTINGS_ENCRYPTION_KEY = key; }
    expect((await dbModule.pool.query("SELECT * FROM site_settings WHERE key='ai_registration_config'")).rows).toHaveLength(0);
    await dbModule.pool.query("UPDATE profiles SET role='staff'");
    expect((await api("/admin/registration-settings")).status).toBe(403);
    expect((await api("/admin/registration-settings", "PUT", {})).status).toBe(403);
    expect((await api("/admin/settings/gemini_api_key", "PUT", { value: "replacement" })).status).toBe(403);
  });
  it("registers a bulk group as separate confirmed drafts and independently approved bookings", async () => {
    await turn("/bulk 2"); await turn("Test Pilgrim"); await turn("08031234567"); await turn(packageId);
    await turn("", "image"); await turn("confirm");
    let rows = (await dbModule.pool.query("SELECT * FROM ai_registration_submissions ORDER BY created_at")).rows;
    expect(rows).toHaveLength(1); expect(rows[0].status).toBe("pending_review");
    expect((await dbModule.pool.query("SELECT * FROM ai_registration_sessions WHERE status='collecting'")).rows).toHaveLength(1);
    mocks.extract.mockResolvedValue({ ok: true, provider: "gemini", fallbackTriggered: false, data: {
      isAcceptableQuality: true, firstName: "Jane", lastName: "Pilgrim", documentNumber: "B12345678", nationality: "NIGERIAN",
      dateOfBirth: "1991-01-01", sex: "F", dateOfExpiry: "2030-01-01", dateOfIssue: "2025-01-01", rejectionReason: "",
    } });
    await turn("Jane Pilgrim"); await turn("", "image"); await turn("confirm");
    rows = (await dbModule.pool.query("SELECT * FROM ai_registration_submissions ORDER BY created_at")).rows;
    expect(rows).toHaveLength(2);
    expect(rows[1].snapshot).toMatchObject({ fullName: "Jane Pilgrim", phone: "08031234567", packageId, bulkIndex: 2, bulkSize: 2, bulkId: rows[0].snapshot.bulkId });
    expect((await dbModule.pool.query("SELECT * FROM ai_registration_sessions WHERE status='collecting'")).rows).toHaveLength(0);
    // The fixture uses the same image bytes twice; staff must explicitly
    // override that duplicate warning, just as for any real repeated passport.
    expect((await api(`/admin/ai-registrations/${rows[0].id}/approve`, "POST", { duplicateOverrideReason: "Synthetic test image used for both fixtures" })).status).toBe(200);
    expect((await api(`/admin/ai-registrations/${rows[1].id}/approve`, "POST", { duplicateOverrideReason: "Synthetic test image used for both fixtures" })).status).toBe(200);
    expect((await dbModule.pool.query("SELECT DISTINCT ai_session_id FROM bookings")).rows).toHaveLength(2);
    expect((await dbModule.pool.query("SELECT DISTINCT batch_id FROM bookings")).rows).toEqual([{ batch_id: rows[0].snapshot.bulkId }]);
  });
  it("limits bulk group size and stops intake on cancellation without losing submitted pilgrims", async () => {
    await turn("/bulk 21");
    expect((await dbModule.pool.query("SELECT collected_data FROM ai_registration_sessions")).rows[0].collected_data.bulkId).toBeUndefined();
    await turn("/bulk 3"); await turn("Test Pilgrim"); await turn("08031234567"); await turn(packageId); await turn("", "image"); await turn("confirm");
    await turn("/cancel");
    expect((await dbModule.pool.query("SELECT * FROM ai_registration_submissions")).rows).toHaveLength(1);
    expect((await dbModule.pool.query("SELECT * FROM ai_registration_sessions WHERE status='collecting'")).rows).toHaveLength(0);
    await turn("/start");
    expect((await dbModule.pool.query("SELECT * FROM ai_registration_sessions WHERE status='collecting'")).rows).toHaveLength(1);
  });
  it("resumes the current group pilgrim instead of returning an older pending draft", async () => {
    await turn("/bulk 2"); await turn("Test Pilgrim"); await turn("08031234567"); await turn(packageId); await turn("", "image"); await turn("confirm");
    const child = (await dbModule.pool.query("SELECT * FROM ai_registration_sessions WHERE status='collecting'")).rows[0];
    await dbModule.pool.query("UPDATE ai_registration_sessions SET expires_at=(now() AT TIME ZONE 'UTC')-interval '1 minute' WHERE id=$1", [child.id]);
    await turn("hello"); await turn("resume"); await turn("Jane Pilgrim");
    const updated = (await dbModule.pool.query("SELECT * FROM ai_registration_sessions WHERE id=$1", [child.id])).rows[0];
    expect(updated.status).toBe("collecting"); expect(updated.collected_data).toMatchObject({ bulkIndex: 2, fullName: "Jane Pilgrim", phone: "08031234567" });
    expect((await dbModule.pool.query("SELECT * FROM ai_registration_submissions")).rows).toHaveLength(1);
  });
  it("applies reliability migrations repeatedly without changing existing data", async () => {
    const { migrateAiRegistration } = await import("../scripts/migrate-ai-registration.mjs");
    const client = await dbModule.pool.connect();
    try { await migrateAiRegistration(client); await migrateAiRegistration(client); }
    finally { client.release(); }
    expect((await dbModule.pool.query("SELECT id FROM profiles")).rows).toHaveLength(1);
  });
  it("preserves the order of messages batched in one webhook", async () => {
    await queue.enqueueInbound(["Test Pilgrim", "08031234567", packageId].map((text) => ({ channel: "telegram" as const,
      channelUserId: "100", channelMessageId: String(++sequence), type: "text" as const, text })));
    for (let i = 0; i < 10 && await queue.processNextJob(); i++);
    const session = (await dbModule.pool.query("SELECT * FROM ai_registration_sessions")).rows[0];
    expect(session.collected_data).toEqual({ fullName: "Test Pilgrim", phone: "08031234567", packageId });
  });
  it("rolls back failed processing and resumes from the durable job after a retry", async () => {
    mocks.upload.mockRejectedValueOnce(new Error("Storage offline"));
    await queue.enqueueInbound([{ channel: "telegram", channelUserId: "100", channelMessageId: String(++sequence), type: "image", mediaBase64: jpg }]);
    await queue.processNextJob();
    expect((await dbModule.pool.query("SELECT * FROM ai_registration_sessions")).rows).toHaveLength(0);
    expect((await dbModule.pool.query("SELECT attempts FROM ai_registration_jobs")).rows[0].attempts).toBe(1);
    await dbModule.pool.query("UPDATE ai_registration_jobs SET available_at=now()");
    await queue.processNextJob();
    expect((await dbModule.pool.query("SELECT * FROM ai_registration_sessions")).rows).toHaveLength(1);
    expect((await dbModule.pool.query("SELECT * FROM ai_registration_messages WHERE direction='inbound'")).rows).toHaveLength(1);
  });
  it("denies staff without a grant and allows staff after a grant", async () => {
    await dbModule.pool.query("UPDATE profiles SET role='staff'");
    expect((await api("/admin/ai-registrations")).status).toBe(403);
    expect((await api(`/admin/staff/${staffId}/permissions`, "PUT", { permissions: ["ai_registrations"] })).status).toBe(403);
    expect((await api(`/admin/staff/${staffId}/role`, "PUT", { role: "admin" })).status).toBe(403);
    expect((await api(`/admin/users/${staffId}/role`, "PUT", { role: "admin" })).status).toBe(403);
    await dbModule.pool.query("INSERT INTO staff_permissions(id,user_id,permission) VALUES ($1,$2,'ai_registrations')", [randomUUID(), staffId]);
    expect((await api("/admin/ai-registrations")).status).toBe(200);
  });
  it("filters by collected name and rejects invalid list filters", async () => {
    await submission();
    const response = await api("/admin/ai-registrations?q=Test%20Pilgrim&channel=telegram");
    expect((await response.json()).total).toBe(1);
    expect((await api("/admin/ai-registrations?status=invalid")).status).toBe(400);
  });
  it("retries outbound messages durably and records the transcript after success", async () => {
    await turn("/start");
    await queue.enqueueReply("telegram", "100", { text: "Test retry" }, "test-retry", (await dbModule.pool.query("SELECT id FROM ai_registration_sessions")).rows[0].id);
    mocks.send.mockRejectedValueOnce(new Error("Network unavailable"));
    await queue.processNextJob();
    expect((await dbModule.pool.query("SELECT status FROM ai_registration_jobs WHERE dedupe_key='test-retry'")).rows[0].status).toBe("pending");
    await dbModule.pool.query("UPDATE ai_registration_jobs SET available_at=now()");
    await queue.processNextJob();
    expect((await dbModule.pool.query("SELECT status FROM ai_registration_jobs WHERE dedupe_key='test-retry'")).rows[0].status).toBe("completed");
  });
  it("rejects edits and extraction retries once the review is final", async () => {
    const row = await submission(); await api(`/admin/ai-registrations/${row.id}/approve`, "POST", {});
    expect((await api(`/admin/ai-registrations/${row.id}`, "PUT", { fullName: "Changed Name" })).status).toBe(409);
    expect((await api(`/admin/ai-registrations/${row.id}/retry-extraction`, "POST", {})).status).toBe(409);
  });
  it("rejects invalid state transitions", async () => {
    await turn("/start");
    const id = (await dbModule.pool.query("SELECT id FROM ai_registration_sessions")).rows[0].id;
    await expect(transaction.registrationTransaction(() => conversation.transitionStatus(id, "approved"))).rejects.toThrow("Invalid registration state transition");
  });
  it("blocks later messages behind a failed job until staff skip it", async () => {
    await queue.enqueueInbound(["Test Pilgrim", "08031234567"].map((text) => ({ channel: "telegram" as const, channelUserId: "100",
      channelMessageId: String(++sequence), type: "text" as const, text })));
    const id = (await dbModule.pool.query("UPDATE ai_registration_jobs SET status='failed' WHERE sequence=(SELECT min(sequence) FROM ai_registration_jobs) RETURNING id")).rows[0].id;
    expect(await queue.processNextJob()).toBe(false);
    expect((await api(`/admin/ai-registrations/jobs/${id}/skip`, "POST", { reason: "Discarded invalid message" })).status).toBe(200);
    expect(await queue.processNextJob()).toBe(true);
  });
  it("keeps the existing passport-extraction response contract", async () => {
    const response = await api("/passport/extract", "POST", { imageBase64: jpg, mimeType: "image/jpeg" });
    expect(response.status).toBe(200);
    expect((await response.json()).documentNumber).toBe("A12345678");
  });
  it("does not create a booking before review; approval creates booking, visa, capacity and metadata", async () => {
    const row = await submission();
    expect(row.status).toBe("pending_review");
    expect((await dbModule.pool.query("SELECT * FROM bookings")).rows).toHaveLength(0);
    const result = await api(`/admin/ai-registrations/${row.id}/approve`, "POST", {});
    expect(result.status).toBe(200);
    const { booking } = await result.json();
    expect(booking.source).toBe("telegram_ai"); expect(booking.reviewStatus).toBe("approved");
    expect((await dbModule.pool.query("SELECT current_bookings FROM packages")).rows[0].current_bookings).toBe(1);
    expect((await dbModule.pool.query("SELECT * FROM visa_applications WHERE booking_id=$1", [booking.id])).rows).toHaveLength(1);
    expect((await dbModule.pool.query("SELECT * FROM ai_registration_jobs WHERE dedupe_key=$1", [`review:${row.id}:approved`])).rows).toHaveLength(1);
  });
  it("serializes concurrent approvals so only one booking is created", async () => {
    const row = await submission();
    const responses = await Promise.all([api(`/admin/ai-registrations/${row.id}/approve`, "POST", {}), api(`/admin/ai-registrations/${row.id}/approve`, "POST", {})]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await dbModule.pool.query("SELECT * FROM bookings")).rows).toHaveLength(1);
  });
  it("rolls back booking and capacity if updating the review record fails", async () => {
    const row = await submission();
    await dbModule.pool.query(`CREATE FUNCTION fail_review() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test rollback'; END $$;
      CREATE TRIGGER fail_review BEFORE UPDATE ON ai_registration_submissions FOR EACH ROW EXECUTE FUNCTION fail_review()`);
    try {
      expect((await api(`/admin/ai-registrations/${row.id}/approve`, "POST", {})).status).toBe(500);
      expect((await dbModule.pool.query("SELECT * FROM bookings")).rows).toHaveLength(0);
      expect((await dbModule.pool.query("SELECT current_bookings FROM packages")).rows[0].current_bookings).toBe(0);
    } finally { await dbModule.pool.query("DROP TRIGGER fail_review ON ai_registration_submissions; DROP FUNCTION fail_review()"); }
  });
  it("blocks approval of a full package without changing the submission", async () => {
    const row = await submission(); await dbModule.pool.query("UPDATE packages SET current_bookings=capacity");
    expect((await api(`/admin/ai-registrations/${row.id}/approve`, "POST", {})).status).toBe(409);
    expect((await dbModule.pool.query("SELECT status FROM ai_registration_submissions")).rows[0].status).toBe("pending_review");
  });
  it("supports failed extraction through manual review, with required-field validation", async () => {
    const row = await submission(true); expect(row.extraction_provider).toBeNull();
    expect((await api(`/admin/ai-registrations/${row.id}/approve`, "POST", {})).status).toBe(400);
    expect((await api(`/admin/ai-registrations/${row.id}/approve`, "POST", { passportNumber: "A12345678", dateOfBirth: "1990-01-01", passportExpiry: "2030-01-01" })).status).toBe(200);
  });
  it("requires duplicate override and recognizes image hashes", async () => {
    const row = await submission();
    await dbModule.pool.query("INSERT INTO ai_registration_sessions(id,channel,channel_user_id,expires_at) VALUES ('other','telegram','other',now()+interval '1 day')");
    await dbModule.pool.query("INSERT INTO ai_registration_submissions(session_id,snapshot,passport_image_hash) VALUES ('other','{}',$1)", [row.passport_image_hash]);
    const result = await duplicate.detectDuplicate({ passportImageHash: row.passport_image_hash, excludeSessionId: row.session_id });
    expect(result.status).toBe("duplicate_confirmed");
    expect((await api(`/admin/ai-registrations/${row.id}/approve`, "POST", {})).status).toBe(409);
    expect((await api(`/admin/ai-registrations/${row.id}/approve`, "POST", { duplicateOverrideReason: "Reviewed identity in person" })).status).toBe(200);
  });
  it("persists webhooks before ack and deduplicates repeated delivery", async () => {
    const payload = { update_id: ++sequence, message: { message_id: 1, chat: { id: 100, type: "private" }, text: "/start" } };
    const send = () => fetch(baseUrl + "/telegram/webhook", { method: "POST", headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": "test-secret" }, body: JSON.stringify(payload) });
    expect((await send()).status).toBe(200); expect((await send()).status).toBe(200);
    expect((await dbModule.pool.query("SELECT * FROM ai_registration_jobs")).rows).toHaveLength(1);
    expect((await dbModule.pool.query("SELECT * FROM ai_registration_sessions")).rows).toHaveLength(0);
    await queue.processNextJob();
    expect((await dbModule.pool.query("SELECT * FROM ai_registration_sessions")).rows).toHaveLength(1);
  });
  it("rejects unauthenticated review and invalid channel signatures", async () => {
    expect((await api("/admin/ai-registrations", "GET", undefined, "")).status).toBe(401);
    expect((await api("/telegram/webhook", "POST", { update_id: 1 })).status).toBe(401);
    const raw = JSON.stringify({ entry: [] });
    const signed = createHmac("sha256", "test-secret").update(raw).digest("hex");
    expect((await fetch(baseUrl + "/whatsapp/webhook", { method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": `sha256=${signed}` }, body: raw })).status).toBe(200);
    expect((await api("/whatsapp/webhook", "POST", { entry: [] })).status).toBe(401);
  });
  it("routes stats correctly, retries Mistral and saves extracted fields", async () => {
    expect((await api("/admin/ai-registrations/stats")).status).toBe(200);
    const row = await submission(true);
    mocks.extract.mockResolvedValue({ ok: true, provider: "mistral", data: { isAcceptableQuality: true, firstName: "Updated", lastName: "Pilgrim", documentNumber: "B99999999", dateOfBirth: "1990-01-01", dateOfExpiry: "2030-01-01" } });
    expect((await api(`/admin/ai-registrations/${row.id}/retry-extraction`, "POST", {})).status).toBe(200);
    expect(mocks.extract.mock.calls.at(-1)?.[2]).toEqual({ forceProvider: "mistral" });
    expect((await dbModule.pool.query("SELECT review_data FROM ai_registration_submissions")).rows[0].review_data.passportNumber).toBe("B99999999");
  });
  it("resumes an expired session and accepts corrections without losing data", async () => {
    await turn("Test Pilgrim");
    await dbModule.pool.query("UPDATE ai_registration_sessions SET expires_at=(now() AT TIME ZONE 'UTC')-interval '1 hour'");
    await transaction.registrationTransaction(() => conversation.expireStaleSessions());
    await turn("resume"); await turn("phone: 08031234567");
    const rows = (await dbModule.pool.query("SELECT * FROM ai_registration_sessions")).rows;
    expect(rows).toHaveLength(1); expect(rows[0].status).toBe("collecting"); expect(rows[0].collected_data.fullName).toBe("Test Pilgrim");
  });
  it("purges only rejected or expired media older than 30 days", async () => {
    const row = await submission();
    await api(`/admin/ai-registrations/${row.id}/reject`, "POST", { reason: "Test rejection" });
    expect((await api("/admin/ai-registrations/purge", "POST", {})).status).toBe(200); expect(mocks.delete).not.toHaveBeenCalled();
    await dbModule.pool.query("UPDATE ai_registration_sessions SET updated_at=now()-interval '31 days'");
    await api("/admin/ai-registrations/purge", "POST", {});
    expect(mocks.delete).toHaveBeenCalledOnce();
    expect((await dbModule.pool.query("SELECT passport_image_r2_key FROM ai_registration_submissions")).rows[0].passport_image_r2_key).toBeNull();
  });
  it("cleans abandoned uploads after 30 days while preserving approved passports", async () => {
    const row = await submission();
    await api(`/admin/ai-registrations/${row.id}/approve`, "POST", {});
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    mocks.list.mockResolvedValue({ Contents: [{ Key: row.passport_image_r2_key, LastModified: old }, { Key: "passports/ai/telegram/orphan.image", LastModified: old }] });
    await api("/admin/ai-registrations/purge", "POST", {});
    expect(mocks.delete).toHaveBeenCalledOnce();
    expect(mocks.delete.mock.calls[0][0].input.Key).toBe("passports/ai/telegram/orphan.image");
  });
});
