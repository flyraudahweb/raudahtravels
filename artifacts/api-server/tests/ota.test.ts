import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { randomUUID, createHmac } from "node:crypto";
import express from "express";
import { validateOtaResponse } from "./helpers/ota-contract";
import EmbeddedPostgres from "embedded-postgres";
import { eq, sql } from "drizzle-orm";
import {
  price,
  validatePayment,
  sameSupplierAmount,
  duffelRequest,
} from "../src/services/ota/provider";

vi.mock("@clerk/express", () => ({
  getAuth: (req: any) => ({ userId: req.headers["x-test-user"] }),
  clerkClient: {
    users: {
      getUser: vi.fn(async (id: string) => ({
        id,
        firstName: "Native",
        lastName: "Traveller",
        primaryEmailAddress: {
          emailAddress: "native@example.test",
          verification: {
            status: id === "unverified" ? "unverified" : "verified",
          },
        },
      })),
    },
  },
}));
vi.mock("../src/utils/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  sendPaymentReceipt: vi.fn().mockResolvedValue(true),
}));
vi.mock("../src/services/ota/exchangeRates", () => ({
  referenceRates: async () => ({
    provider: "Frankfurter",
    frequency: "daily",
    sourceUrl: "https://frankfurter.dev/",
    stale: false,
    status: "current",
    fetchedAt: "2026-10-29T12:00:00Z",
    rates: { GBP: { ngnPerUnit: 900, date: "2026-10-29" } },
  }),
}));
let pg: EmbeddedPostgres,
  directory: string,
  module: typeof import("@workspace/db"),
  baseUrl: string;
let server: ReturnType<ReturnType<typeof express>["listen"]>;
let configSchema: typeof import("../src/services/ota/config").configSchema;
const httpFetch = globalThis.fetch;
let booking: any,
  supplierCalls = 0,
  amount = 10000000,
  failSupplier = false;
let supplierCancelled = false,
  confirmationWinsRace = false;
let changeDuringSupplierRead = false,
  changeDuringRefundRead = false;
let newerSupplierSnapshot = false;
let gatewayPatch: Record<string, unknown> = {};
let refundTransaction: string | number = 101;
let changeDuringInitialization = false;
let testClientId = 0;
const offer = () => ({
  id: "off_test",
  total_amount: "100.00",
  total_currency: "GBP",
  expires_at: new Date(Date.now() + 600000).toISOString(),
  passengers: [{ id: "pas_test", type: "adult" }],
  slices: [
    {
      origin: { iata_code: "LOS" },
      destination: { iata_code: "JED" },
      segments: [
        {
          departing_at: `${new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)}T10:00:00`,
          arriving_at: `${new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)}T16:00:00`,
        },
      ],
    },
  ],
});
const setupTrace = (phase: string) => {
  if (process.env.OTA_TEST_DEBUG === "1")
    console.info(`[OTA test database] ${phase}`);
};
beforeAll(async () => {
  setupTrace("selecting local port");
  const port = await new Promise<number>((resolve) => {
    const socket = createServer();
    socket.listen(0, "127.0.0.1", () => {
      const p = (socket.address() as any).port;
      socket.close(() => resolve(p));
    });
  });
  directory = await mkdtemp(path.join(tmpdir(), "raudah-ota-test-"));
  setupTrace("initializing disposable PostgreSQL");
  pg = new EmbeddedPostgres({
    databaseDir: path.join(directory, "pg"),
    port,
    user: "postgres",
    password: "test-only",
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-h", "127.0.0.1"],
    onLog: () => {},
    onError: () => {},
  });
  await pg.initialise();
  setupTrace("starting disposable PostgreSQL");
  await pg.start();
  setupTrace("creating database");
  await pg.createDatabase("ota_test");
  process.env.DATABASE_URL = `postgresql://postgres:test-only@127.0.0.1:${port}/ota_test`;
  process.env.SETTINGS_ENCRYPTION_KEY = "34".repeat(32);
  process.env.DUFFEL_API_TOKEN = "duffel_test_fake";
  process.env.PAYSTACK_SECRET_KEY = "sk_test_fake";
  process.env.APP_URL = "https://example.test";
  module = await import("@workspace/db");
  setupTrace("exporting schema");
  configSchema = (await import("../src/services/ota/config")).configSchema;
  const root = path.resolve(process.cwd(), "../..");
  const schema = execFileSync(
    process.execPath,
    [
      path.join(root, "lib/db/node_modules/drizzle-kit/bin.cjs"),
      "export",
      "--config=./drizzle.config.ts",
    ],
    {
      cwd: path.join(root, "lib/db"),
      env: { ...process.env },
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  await module.pool.query(schema);
  await module.pool.query("DROP TABLE ota_api_keys");
  await module.pool.query(
    await readFile(
      path.join(root, "lib/db/drizzle/0012_ota_api_keys.sql"),
      "utf8",
    ),
  );
  await module.pool.query(
    "CREATE SEQUENCE IF NOT EXISTS bookings_id_number_seq",
  );
  setupTrace("applying checked-in migrations");
  // Verify the checked-in migration, including its database constraints.
  await module.pool.query(
    "DROP TABLE ota_duffel_events, ota_payment_jobs, ota_events, ota_bookings CASCADE",
  );
  await module.pool.query(
    await readFile(path.join(root, "lib/db/drizzle/0009_ota.sql"), "utf8"),
  );
  await module.pool.query(
    await readFile(
      path.join(root, "lib/db/drizzle/0010_duffel_webhooks.sql"),
      "utf8",
    ),
  );
  await module.pool.query(
    await readFile(
      path.join(root, "lib/db/drizzle/0011_ota_revision.sql"),
      "utf8",
    ),
  );
  await module.db.insert(module.profilesTable).values([
    {
      id: "user",
      clerkUserId: "user",
      email: "user@example.test",
      fullName: "Test User",
      role: "user",
    },
    {
      id: "admin",
      clerkUserId: "admin",
      email: "admin@example.test",
      fullName: "Admin",
      role: "admin",
    },
    {
      id: "super",
      clerkUserId: "super",
      email: "super@example.test",
      fullName: "Super",
      role: "super_admin",
    },
    {
      id: "other",
      clerkUserId: "other",
      email: "other@example.test",
      fullName: "Other",
      role: "user",
    },
  ]);
  const app = express();
  app.set("trust proxy", "loopback");
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  const otaRouter = (await import("../src/routes/ota")).default;
  app.use(
    "/api/ota/v1",
    (await import("../src/services/ota/mobileRoutes")).mobileOtaRouter(
      otaRouter,
    ),
  );
  app.use("/api", otaRouter);
  app.use("/api", (await import("../src/routes/notifications")).default);
  app.use("/api", (await import("../src/routes/payments")).default);
  app.use("/api", (await import("../src/routes/admin")).default);
  app.use((await import("../src/services/ota/mobileRoutes")).mobileOtaError);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.on("listening", r));
  baseUrl = `http://127.0.0.1:${(server.address() as any).port}/api/ota`;
}, 120000);
afterAll(async () => {
  vi.unstubAllGlobals();
  await new Promise<void>((r) => server?.close(() => r()) || r());
  await module?.pool.end();
  await pg?.stop();
  if (directory)
    await rm(directory, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
}, 30000);
beforeEach(async () => {
  (await import("../src/routes/ota")).resetOtaBurstState();
  testClientId++;
  await module.db.delete(module.notificationsTable);
  await module.db.delete(module.otaApiKeysTable);
  await module.pool.query(
    "TRUNCATE payments, visa_applications, user_activity, bookings, packages, agents CASCADE",
  );
  await module.db
    .delete(module.profilesTable)
    .where(eq(module.profilesTable.clerkUserId, "native"));
  supplierCalls = 0;
  amount = 10000000;
  failSupplier = false;
  supplierCancelled = false;
  confirmationWinsRace = false;
  changeDuringSupplierRead = false;
  changeDuringRefundRead = false;
  newerSupplierSnapshot = false;
  gatewayPatch = {};
  refundTransaction = 101;
  changeDuringInitialization = false;
  await module.db.delete(module.otaDuffelEventsTable);
  await module.db.delete(module.otaPaymentJobsTable);
  await module.db.delete(module.otaEventsTable);
  await module.db.delete(module.otaBookingsTable);
  await module.db.delete(module.siteSettingsTable);
  await module.db.insert(module.siteSettingsTable).values({
    id: randomUUID(),
    key: "ota_config",
    value: {
      flightsEnabled: true,
      hotelsEnabled: true,
      salesEnabled: true,
      mode: "test",
      rates: { NGN: 1, GBP: 1000 },
      supportEmail: "help@example.test",
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith(baseUrl)) return httpFetch(input, init);
      if (url.endsWith("api.paystack.co/transaction/initialize")) {
        if (changeDuringInitialization)
          await module.db
            .update(module.otaBookingsTable)
            .set({
              status: "confirmed",
              revision: sql`${module.otaBookingsTable.revision}+1`,
            })
            .where(eq(module.otaBookingsTable.id, booking.id));
        return Response.json({
          status: true,
          data: {
            authorization_url: "https://checkout.paystack.com/test-session",
            reference: booking.reference,
            access_code: "test-access",
          },
        });
      }
      if (url.includes("api.paystack.co/transaction/verify/"))
        return Response.json({
          status: true,
          data: {
            id: 101,
            status: "success",
            currency: "NGN",
            amount,
            reference: decodeURIComponent(
              new URL(url).pathname.split("/").at(-1)!,
            ),
            domain: "test",
            metadata: { otaBookingId: booking?.id, type: "ota_booking" },
            ...gatewayPatch,
          },
        });
      if (url.includes("api.duffel.com/air/offers/"))
        return Response.json({ data: offer() });
      if (url.includes("/places/suggestions"))
        return Response.json({
          data: [
            {
              id: "arp_test",
              name: "Lagos",
              iata_code: "LOS",
              type: "airport",
            },
          ],
        });
      if (url.includes("/air/offer_requests?"))
        return Response.json({ data: { offers: [offer()] } });
      if (url.endsWith("/stays/search"))
        return Response.json({
          data: {
            results: [
              {
                id: "srr_test",
                cheapest_rate_total_amount: "100.00",
                cheapest_rate_currency: "GBP",
                accommodation: { name: "Test Hotel" },
              },
            ],
          },
        });
      if (url.endsWith("/stays/quotes"))
        return Response.json({
          data: {
            id: "quo_test",
            total_amount: "100.00",
            total_currency: "GBP",
            guests: [{ type: "adult" }],
            accommodation: {
              rooms: [
                {
                  rates: [
                    {
                      payment_type: "pay_now",
                      available_payment_methods: [["balance"]],
                    },
                  ],
                },
              ],
            },
          },
        });
      if (url.includes("api.duffel.com/air/orders/ord_test")) {
        if (newerSupplierSnapshot)
          await module.db
            .update(module.otaBookingsTable)
            .set({
              revision: sql`${module.otaBookingsTable.revision}+1`,
              providerNotice: "A newer supplier update was saved.",
            })
            .where(eq(module.otaBookingsTable.id, booking.id));
        if (changeDuringSupplierRead)
          await module.db
            .update(module.otaBookingsTable)
            .set({ status: "refunded" })
            .where(eq(module.otaBookingsTable.id, booking.id));
        return Response.json({
          data: {
            id: "ord_test",
            booking_reference: "ABC123",
            total_amount: "100.00",
            total_currency: "GBP",
            metadata: { ota_booking_id: booking.id },
            cancelled_at: supplierCancelled ? new Date().toISOString() : null,
            slices: [],
          },
        });
      }
      if (url.includes("api.paystack.co/refund/")) {
        if (changeDuringRefundRead)
          await module.db
            .update(module.otaBookingsTable)
            .set({ status: "confirmed" })
            .where(eq(module.otaBookingsTable.id, booking.id));
        return Response.json({
          status: true,
          data: {
            id: 77,
            status: "processed",
            transaction: refundTransaction,
            domain: "test",
            currency: "NGN",
            amount,
          },
        });
      }
      if (url.endsWith("/air/orders")) {
        supplierCalls++;
        if (confirmationWinsRace) {
          await module.db
            .update(module.otaBookingsTable)
            .set({ status: "confirmed", providerBookingId: "ord_test" })
            .where(eq(module.otaBookingsTable.id, booking.id));
          throw new Error(
            "Connection failed after webhook confirmation committed",
          );
        }
        if (failSupplier) throw new Error("Ambiguous network failure");
        return Response.json({
          data: {
            id: "ord_test",
            booking_reference: "ABC123",
            total_amount: "100.00",
            total_currency: "GBP",
            metadata: { ota_booking_id: booking.id },
          },
        });
      }
      if (url.includes("/stays/search_results/"))
        return Response.json({
          data: {
            id: "srr_test",
            accommodation: {
              name: "Test Hotel",
              rooms: [
                {
                  name: "Double",
                  rates: [
                    {
                      id: "rat_prepaid",
                      payment_type: "pay_now",
                      total_amount: "100.00",
                      total_currency: "GBP",
                      available_payment_methods: [["balance"]],
                    },
                    {
                      id: "rat_property",
                      payment_type: "pay_at_accommodation",
                      total_amount: "100.00",
                      total_currency: "GBP",
                      available_payment_methods: [["balance"]],
                    },
                    {
                      id: "rat_card",
                      payment_type: "pay_now",
                      total_amount: "100.00",
                      total_currency: "GBP",
                      available_payment_methods: [["card"]],
                    },
                  ],
                },
              ],
            },
          },
        });
      if (url.includes("/stays/quotes/"))
        return Response.json({
          data: {
            id: "quo_test",
            total_amount: "100.00",
            total_currency: "GBP",
            rooms: 1,
            guests: [{ type: "adult" }],
            accommodation: {
              name: "Test Hotel",
              rooms: [
                {
                  rates: [
                    {
                      payment_type: "pay_now",
                      available_payment_methods: [["balance"]],
                    },
                  ],
                },
              ],
            },
          },
        });
      if (url.endsWith("/stays/bookings/bok_test"))
        return Response.json({
          data: {
            id: "bok_test",
            status: "confirmed",
            reference: "HOTEL123",
            total_amount: "100.00",
            total_currency: "GBP",
            metadata: { ota_booking_id: booking.id },
          },
        });
      if (url.endsWith("/air/webhooks"))
        return Response.json({
          data: [
            {
              id: "end_test",
              url: "https://example.test/api/ota/duffel/webhook/test",
              active: false,
              live_mode: false,
              events: ["order.created"],
            },
          ],
        });
      if (url.endsWith("/air/webhooks/end_test"))
        return Response.json({ data: { id: "end_test", active: true } });
      if (url === "https://example.test/api/ota/duffel/webhook/test")
        return Response.json({
          receiver: "raudah-duffel-v1",
          mode: "test",
          storageReady: true,
          signatureConfigured: true,
        });
      if (url.endsWith("/stays/bookings")) {
        supplierCalls++;
        return Response.json({
          data: {
            id: "bok_test",
            status: "confirmed",
            reference: "HOTEL123",
            total_amount: "100.00",
            total_currency: "GBP",
            metadata: { ota_booking_id: booking.id },
          },
        });
      }
      throw new Error("Unexpected test request");
    }),
  );
});
async function request(
  path: string,
  user?: string,
  body?: unknown,
  method?: string,
) {
  return httpFetch(`${baseUrl}${path}`, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": `203.0.113.${testClientId}`,
      ...(user ? { "x-test-user": user } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function create(native = false) {
  const response = await (native ? nativeRequest : request)(
    "/bookings",
    "user",
    {
      kind: "flight",
      offerId: "off_test",
      expectedTotalKobo: 10000000,
      acceptedTerms: true,
      contact: { email: "user@example.test", phone: "+2348012345678" },
      travellers: [
        {
          id: "pas_test",
          given_name: "Test",
          family_name: "User",
          born_on: "1990-01-01",
          title: "mr",
          gender: "m",
          email: "user@example.test",
          phone_number: "+2348012345678",
        },
      ],
    },
  );
  expect(response.status).toBe(201);
  booking = (await response.json()).booking;
  return booking;
}
async function nativeRequest(
  path: string,
  user?: string,
  body?: unknown,
  key?: string,
) {
  return httpFetch(`${baseUrl}/v1${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(user ? { "x-test-user": user } : {}),
      ...(key ? { "X-OTA-API-Key": key } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
describe("OTA native contract and integration keys", () => {
  it("rolls back a support message if its durable audit cannot be saved", async () => {
    await create();
    await module.db.execute(
      sql`ALTER TABLE ota_events ADD CONSTRAINT ota_test_reject_service CHECK (action <> 'service_requested')`,
    );
    try {
      const response = await nativeRequest(
        `/bookings/${booking.id}/service-request`,
        "user",
        { message: "Please help me change my departure date." },
      );
      expect(response.status).toBe(503);
      const row = await module.db.query.otaBookingsTable.findFirst({
        where: eq(module.otaBookingsTable.id, booking.id),
      });
      expect(row?.serviceRequest).toBeNull();
      expect(row?.revision).toBe(booking.revision);
    } finally {
      await module.db.execute(
        sql`ALTER TABLE ota_events DROP CONSTRAINT ota_test_reject_service`,
      );
    }
  });
  it("protects and validates header settings and saves concurrent first writes", async () => {
    const url = `${baseUrl.replace(/\/ota$/, "")}/admin/settings/landing_hero`;
    const save = (value: unknown, user?: string) =>
      httpFetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(user ? { "x-test-user": user } : {}),
        },
        body: JSON.stringify({ value }),
      });
    expect(
      (await save({ slideshowEnabled: true, aircraftEnabled: false })).status,
    ).toBe(401);
    expect(
      (await save({ slideshowEnabled: true, aircraftEnabled: false }, "user"))
        .status,
    ).toBe(403);
    for (const value of [
      null,
      {},
      { slideshowEnabled: "false", aircraftEnabled: true },
      { slideshowEnabled: true, aircraftEnabled: false, extra: true },
    ])
      expect((await save(value, "super")).status).toBe(400);
    const writes = await Promise.all([
      save({ slideshowEnabled: false, aircraftEnabled: true }, "admin"),
      save({ slideshowEnabled: true, aircraftEnabled: false }, "super"),
    ]);
    expect(writes.map((response) => response.status)).toEqual([200, 200]);
    const rows = await module.db
      .select()
      .from(module.siteSettingsTable)
      .where(eq(module.siteSettingsTable.key, "landing_hero"));
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toMatchObject({
      slideshowEnabled: expect.any(Boolean),
      aircraftEnabled: expect.any(Boolean),
    });
  });
  it("rejects null quote/support input with 400 rather than reporting an outage", async () => {
    const quote = await nativeRequest("/hotels/quotes", "user", null);
    expect(quote.status).toBe(400);
    await create();
    const support = await nativeRequest(
      `/bookings/${booking.id}/service-request`,
      "user",
      null,
    );
    expect(support.status).toBe(400);
  });
  it("distinguishes database outages from a missing key migration", async () => {
    const spy = vi
      .spyOn(module.db, "execute")
      .mockRejectedValueOnce(new Error("database connection interrupted"));
    try {
      const response = await request("/admin/developer/keys", "super");
      expect(response.status).toBe(503);
      expect((await response.json()).error).toBe(
        "Integration key storage is temporarily unavailable",
      );
    } finally {
      spy.mockRestore();
    }
  });
  it("validates real v1 discovery and search responses against OpenAPI", async () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const later = new Date(Date.now() + 3 * 86400000)
      .toISOString()
      .slice(0, 10);
    for (const [path, template, body, user] of [
      ["/config", "/config"],
      ["/capabilities", "/capabilities"],
      ["/exchange-rates", "/exchange-rates"],
      ["/places?q=Lagos", "/places"],
      [
        "/flights/search",
        "/flights/search",
        {
          origin: "LOS",
          destination: "JED",
          departureDate: tomorrow,
          adults: 1,
        },
      ],
      ["/flights/offers/off_test", "/flights/offers/{id}"],
      [
        "/hotels/search",
        "/hotels/search",
        {
          latitude: 21.42,
          longitude: 39.82,
          checkIn: tomorrow,
          checkOut: later,
          rooms: 1,
          adults: 1,
        },
      ],
      ["/hotels/rates/srr_test", "/hotels/rates/{id}", {}],
      ["/hotels/quotes", "/hotels/quotes", { rateId: "rat_prepaid" }, "user"],
      ["/hotels/quotes/quo_test", "/hotels/quotes/{id}", undefined, "user"],
      ["/me/bootstrap", "/me/bootstrap", {}, "user"],
      ["/me", "/me", undefined, "user"],
    ] as [string, string, unknown?, string?][]) {
      const response = await nativeRequest(path, user, body);
      expect(response.status, path).toBe(200);
      validateOtaResponse(
        template,
        body === undefined ? "GET" : "POST",
        response.status,
        await response.json(),
      );
    }
  });
  it("validates native checkout, payment recovery and trip lifecycle contracts", async () => {
    await create(true);
    validateOtaResponse("/bookings", "POST", 201, { booking });
    const actions: [string, string, unknown?][] = [
      ["/bookings", "/bookings"],
      [`/bookings/${booking.id}`, "/bookings/{id}"],
      [`/bookings/${booking.id}/pay`, "/bookings/{id}/pay", {}],
      [`/bookings/${booking.id}/complete`, "/bookings/{id}/complete", {}],
      [`/bookings/${booking.id}/refresh`, "/bookings/{id}/refresh", {}],
      [
        `/bookings/${booking.id}/service-request`,
        "/bookings/{id}/service-request",
        { message: "Please review a change of departure date." },
      ],
      [`/bookings/${booking.id}/timeline`, "/bookings/{id}/timeline"],
      ["/updates", "/updates"],
      ["/updates/read-all", "/updates/read-all", {}],
    ];
    for (const [path, template, body] of actions) {
      const response = await nativeRequest(path, "user", body);
      expect(response.status, path).toBe(200);
      validateOtaResponse(
        template,
        body === undefined ? "GET" : "POST",
        200,
        await response.json(),
      );
    }
    expect(supplierCalls).toBe(1);
  });
  it("returns JSON errors for wrong methods, malformed bodies and malformed encoding", async () => {
    for (const path of ["/config", "/flights/search", "/bookings/id/refresh"]) {
      const response = await httpFetch(`${baseUrl}/v1${path}`, {
        method: "DELETE",
      });
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBeTruthy();
      expect((await response.json()).error).toBeTruthy();
    }
    const malformed = await httpFetch(`${baseUrl}/v1/flights/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error).not.toContain("SyntaxError");
    const encoding = await nativeRequest("/bookings/%E0%A4%A", "user");
    expect(encoding.status).toBe(400);
    expect((await encoding.json()).error).toBeTruthy();
  });
  it("accepts scoped search keys consistently with trailing slashes and HEAD", async () => {
    const created = await (
      await request("/admin/developer/keys", "super", {
        name: "Canonical paths",
        mode: "test",
        scopes: ["config:read"],
      })
    ).json();
    expect(
      (await nativeRequest("/config/", undefined, undefined, created.secret))
        .status,
    ).toBe(200);
    const head = await httpFetch(`${baseUrl}/v1/config`, {
      method: "HEAD",
      headers: { "X-OTA-API-Key": created.secret },
    });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
  });
  it("serves a protected OTA-only contract and customer-only v1 alias", async () => {
    expect((await request("/admin/developer/openapi")).status).toBe(401);
    expect((await request("/admin/developer/openapi", "admin")).status).toBe(
      403,
    );
    const response = await request("/admin/developer/openapi", "super");
    expect(response.status).toBe(200);
    const spec = await response.json();
    expect(spec.openapi).toBe("3.0.3");
    expect(spec.paths["/bookings"].post.security).toEqual([
      { CustomerSession: [] },
    ]);
    expect(
      Object.keys(spec.paths).some(
        (path) => path.includes("admin") || path.includes("webhook"),
      ),
    ).toBe(false);
    expect(
      (await request("/admin/developer/guide", "super")).headers.get(
        "content-type",
      ),
    ).toContain("text/markdown");
    expect((await nativeRequest("/capabilities")).status).toBe(200);
    expect((await nativeRequest("/admin/settings", "super")).status).toBe(404);
    expect(
      (await nativeRequest("/payments/webhook", undefined, {})).status,
    ).toBe(404);
    expect(
      (await nativeRequest("/unknown")).headers.get("content-type"),
    ).toContain("application/json");
  });
  it("bootstraps only the verified session identity and cannot set privileged roles", async () => {
    expect(
      (
        await nativeRequest("/me/bootstrap", undefined, {
          clerkUserId: "super",
        })
      ).status,
    ).toBe(401);
    const response = await nativeRequest("/me/bootstrap", "native", {
      clerkUserId: "super",
      role: "super_admin",
      email: "attacker@example.test",
    });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.profile.role).toBe("user");
    expect(result.profile.email).toBe("native@example.test");
    expect((await nativeRequest("/me", "native")).status).toBe(200);
    await nativeRequest("/me/bootstrap", "native", {});
    expect(
      (
        await module.db.query.profilesTable.findMany({
          where: eq(module.profilesTable.clerkUserId, "native"),
        })
      ).length,
    ).toBe(1);
    expect(
      (await nativeRequest("/me/bootstrap", "unverified", {})).status,
    ).toBe(400);
    expect(
      (
        await module.db.query.profilesTable.findFirst({
          where: eq(module.profilesTable.clerkUserId, "super"),
        })
      )?.role,
    ).toBe("super_admin");
  });
  it("never reactivates a blocked account through native bootstrap", async () => {
    await module.db
      .update(module.profilesTable)
      .set({ accountStatus: "blocked" })
      .where(eq(module.profilesTable.clerkUserId, "other"));
    try {
      expect((await nativeRequest("/me/bootstrap", "other", {})).status).toBe(
        403,
      );
      expect((await nativeRequest("/me", "other")).status).toBe(403);
    } finally {
      await module.db
        .update(module.profilesTable)
        .set({ accountStatus: "active" })
        .where(eq(module.profilesTable.clerkUserId, "other"));
    }
  });
  it("keeps native booking access owner-only", async () => {
    await create();
    expect((await nativeRequest(`/bookings/${booking.id}`)).status).toBe(401);
    expect(
      (await nativeRequest(`/bookings/${booking.id}`, "other")).status,
    ).toBe(404);
    expect(
      (await nativeRequest(`/bookings/${booking.id}`, "user")).status,
    ).toBe(200);
    expect(supplierCalls).toBe(0);
  });
  it("creates hashed, scoped keys only for super admins and never lists secrets", async () => {
    const body = {
      name: "Mobile BFF search",
      mode: "test",
      scopes: ["config:read", "flights:read"],
      expiresInDays: 30,
      requestsPerMinute: 30,
    };
    expect((await request("/admin/developer/keys", "admin", body)).status).toBe(
      403,
    );
    const response = await request("/admin/developer/keys", "super", body);
    expect(response.status).toBe(201);
    const created = await response.json();
    expect(created.secret).toMatch(/^otak_test_/);
    const stored = await module.db.query.otaApiKeysTable.findFirst();
    expect(stored?.tokenHash).not.toBe(created.secret);
    expect(stored?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    const listed = await (
      await request("/admin/developer/keys", "super")
    ).json();
    expect(listed.storageReady).toBe(true);
    expect(listed.keys).toHaveLength(1);
    expect(JSON.stringify(listed)).not.toContain(created.secret);
    expect(JSON.stringify(listed)).not.toContain("tokenHash");
    expect(
      (await nativeRequest("/config", undefined, undefined, created.secret))
        .status,
    ).toBe(200);
    expect(
      (await nativeRequest("/hotels/search", undefined, {}, created.secret))
        .status,
    ).toBe(403);
    expect(
      (await nativeRequest("/bookings", "user", undefined, created.secret))
        .status,
    ).toBe(403);
    expect(
      (
        await request("/admin/developer/keys", "super", {
          ...body,
          scopes: ["bookings:write"],
        })
      ).status,
    ).toBe(400);
  });
  it("enforces expiry, revocation, mode and invalid-key rejection", async () => {
    const createKey = async (mode = "test") =>
      await (
        await request("/admin/developer/keys", "super", {
          name: "Scoped server",
          mode,
          scopes: ["config:read"],
        })
      ).json();
    const first = await createKey(),
      second = await createKey(),
      live = await createKey("live");
    expect(
      (await nativeRequest("/config", undefined, undefined, "not-a-real-key"))
        .status,
    ).toBe(401);
    expect(
      (await nativeRequest("/config", undefined, undefined, live.secret))
        .status,
    ).toBe(403);
    expect(
      (
        await request(
          `/admin/developer/keys/${first.key.id}/revoke`,
          "admin",
          {},
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          `/admin/developer/keys/${first.key.id}/revoke`,
          "super",
          {},
        )
      ).status,
    ).toBe(200);
    expect(
      (await nativeRequest("/config", undefined, undefined, first.secret))
        .status,
    ).toBe(401);
    expect(
      (await nativeRequest("/config", undefined, undefined, second.secret))
        .status,
    ).toBe(200);
    await module.db
      .update(module.otaApiKeysTable)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(module.otaApiKeysTable.id, second.key.id));
    expect(
      (await nativeRequest("/config", undefined, undefined, second.secret))
        .status,
    ).toBe(401);
  });
  it("uses an atomic database counter for concurrent key requests", async () => {
    const created = await (
      await request("/admin/developer/keys", "super", {
        name: "Rate limited server",
        mode: "test",
        scopes: ["config:read"],
        requestsPerMinute: 10,
      })
    ).json();
    const responses = await Promise.all(
      Array.from({ length: 15 }, () =>
        nativeRequest("/config", undefined, undefined, created.secret),
      ),
    );
    expect(responses.filter((r) => r.status === 200)).toHaveLength(10);
    expect(responses.filter((r) => r.status === 429)).toHaveLength(5);
    expect(
      responses.find((r) => r.status === 429)?.headers.get("retry-after"),
    ).toBe("60");
    expect(
      (await module.db.query.otaApiKeysTable.findFirst())?.requestCount,
    ).toBe(10);
  });
  it("keeps docs/customer APIs available before optional key migration", async () => {
    await module.pool.query(
      "ALTER TABLE ota_api_keys RENAME TO ota_api_keys_temporarily_absent",
    );
    try {
      expect((await request("/admin/developer/openapi", "super")).status).toBe(
        200,
      );
      const response = await (
        await request("/admin/developer/keys", "super")
      ).json();
      expect(response.storageReady).toBe(false);
      expect((await nativeRequest("/config")).status).toBe(200);
      expect(
        (
          await request("/admin/developer/keys", "super", {
            name: "Unavailable storage",
            mode: "test",
            scopes: ["config:read"],
          })
        ).status,
      ).toBe(503);
    } finally {
      await module.pool.query(
        "ALTER TABLE ota_api_keys_temporarily_absent RENAME TO ota_api_keys",
      );
    }
  });
  it("paginates OTA updates and read actions cannot affect other users or non-OTA records", async () => {
    await module.db.insert(module.notificationsTable).values(
      Array.from({ length: 23 }, (_, index) => ({
        id: `ota:mobile-${String(index).padStart(2, "0")}`,
        userId: "user",
        title: "Trip update",
        message: "Example message",
        type: "booking",
      })),
    );
    await module.db.insert(module.notificationsTable).values([
      {
        id: "ota:other-mobile",
        userId: "other",
        title: "Other",
        message: "Private",
        type: "booking",
      },
      {
        id: "not-ota-mobile",
        userId: "user",
        title: "Other product",
        message: "Not OTA",
        type: "booking",
      },
    ]);
    const page = await (await nativeRequest("/updates", "user")).json();
    validateOtaResponse("/updates", "GET", 200, page);
    expect(page.updates).toHaveLength(20);
    expect(page.nextOffset).toBe(20);
    expect(page.unreadCount).toBe(23);
    const next = await (
      await nativeRequest("/updates?offset=20", "user")
    ).json();
    expect(next.updates).toHaveLength(3);
    expect(
      (
        await nativeRequest(
          `/updates/${encodeURIComponent("ota:other-mobile")}/read`,
          "user",
          {},
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await nativeRequest(
          `/updates/${encodeURIComponent("not-ota-mobile")}/read`,
          "user",
          {},
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await nativeRequest(
          `/updates/${encodeURIComponent("ota:mobile-00")}/read`,
          "user",
          {},
        )
      ).status,
    ).toBe(200);
    await nativeRequest("/updates/read-all", "user", {});
    expect(
      (await (await nativeRequest("/updates", "user")).json()).unreadCount,
    ).toBe(0);
    expect(
      (
        await module.db.query.notificationsTable.findFirst({
          where: eq(module.notificationsTable.id, "ota:other-mobile"),
        })
      )?.isRead,
    ).toBe(false);
    expect(
      (
        await module.db.query.notificationsTable.findFirst({
          where: eq(module.notificationsTable.id, "not-ota-mobile"),
        })
      )?.isRead,
    ).toBe(false);
  });
});
async function legacyRequest(
  path: string,
  user?: string,
  body?: unknown,
  method = "POST",
) {
  return httpFetch(`${baseUrl.replace(/\/ota$/, "")}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(user ? { "x-test-user": user } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function packageFixture(references = ["RDH-package"]) {
  const packageId = randomUUID(),
    bookingId = randomUUID();
  await module.db.insert(module.packagesTable).values({
    id: packageId,
    name: "Test package",
    type: "umrah",
    description: "Test",
    price: "200000",
    durationDays: 5,
    departureDate: "2027-01-01",
    returnDate: "2027-01-06",
    capacity: 10,
    maxCapacity: 10,
  });
  await module.db.insert(module.bookingsTable).values({
    id: bookingId,
    userId: "user",
    packageId,
    totalPrice: "200000",
    fullName: "Test User",
  });
  await module.db.insert(module.paymentsTable).values(
    references.map((reference) => ({
      id: randomUUID(),
      userId: "user",
      bookingId,
      reference,
      amount: "100000",
      method: "paystack" as const,
      status: "pending" as const,
    })),
  );
  gatewayPatch = {
    metadata: { bookingId, userId: "user", type: "package_booking" },
  };
  return bookingId;
}
describe("shared Paystack payment isolation", () => {
  it("rejects customer-created online and wallet credits", async () => {
    const bookingId = await packageFixture();
    for (const method of ["paystack", "wallet"])
      expect(
        (
          await legacyRequest("/payments", "user", {
            bookingId,
            amount: 100000,
            method,
            reference: "stolen",
          })
        ).status,
      ).toBe(400);
    expect((await module.db.query.paymentsTable.findMany()).length).toBe(1);
  });
  it("rejects an OTA transaction replayed against a package record", async () => {
    await create();
    const bookingId = await packageFixture([booking.reference]);
    gatewayPatch = {
      metadata: { otaBookingId: booking.id, type: "ota_booking" },
    };
    expect(
      (
        await legacyRequest("/payments/paystack/verify", "user", {
          reference: booking.reference,
        })
      ).status,
    ).toBe(402);
    expect(
      Number((await module.db.query.bookingsTable.findFirst())?.amountPaid),
    ).toBe(0);
    expect(bookingId).toBeTruthy();
  });
  it("rejects mismatched gateway currency, mode, owner and purpose", async () => {
    const bookingId = await packageFixture();
    const valid = {
      metadata: { bookingId, userId: "user", type: "package_booking" },
    };
    for (const patch of [
      { currency: "USD" },
      { domain: "live" },
      { amount: 1 },
      { status: "reversed" },
      { reference: "other" },
      { metadata: { bookingId, userId: "other" } },
      { metadata: { bookingId, userId: "user", type: "wallet_funding" } },
    ]) {
      gatewayPatch = { ...valid, ...patch };
      expect(
        (
          await legacyRequest("/payments/paystack/verify", "user", {
            reference: "RDH-package",
          })
        ).status,
      ).toBe(402);
    }
    expect(
      Number((await module.db.query.bookingsTable.findFirst())?.amountPaid),
    ).toBe(0);
  });
  it("fails closed for duplicate historical payment references", async () => {
    await packageFixture(["duplicate", "duplicate"]);
    expect(
      (
        await legacyRequest("/payments/paystack/verify", "user", {
          reference: "duplicate",
        })
      ).status,
    ).toBe(409);
    expect(
      Number((await module.db.query.bookingsTable.findFirst())?.amountPaid),
    ).toBe(0);
  });
  it("credits one payment once under concurrent verification and signed webhook replay", async () => {
    await packageFixture();
    const body = JSON.stringify({
      event: "charge.success",
      data: { reference: "RDH-package" },
    });
    const signature = createHmac("sha512", "sk_test_fake")
      .update(body)
      .digest("hex");
    const deliveries = Array.from({ length: 5 }, () =>
      httpFetch(`${baseUrl.replace(/\/ota$/, "")}/payments/paystack/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-paystack-signature": signature,
        },
        body,
      }),
    );
    const responses = await Promise.all([
      ...deliveries,
      ...Array.from({ length: 5 }, () =>
        legacyRequest("/payments/paystack/verify", "user", {
          reference: "RDH-package",
        }),
      ),
    ]);
    expect(responses.map((r) => r.status)).toEqual(Array(10).fill(200));
    expect(
      Number((await module.db.query.bookingsTable.findFirst())?.amountPaid),
    ).toBe(100000);
    expect((await module.db.query.userActivityTable.findMany()).length).toBe(1);
  });
  it("retains both concurrent partial payments and confirms exactly one booking", async () => {
    await packageFixture(["part-one", "part-two"]);
    const responses = await Promise.all(
      ["part-one", "part-two"].map((reference) =>
        legacyRequest("/payments/paystack/verify", "user", { reference }),
      ),
    );
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    const saved = await module.db.query.bookingsTable.findFirst();
    expect(Number(saved?.amountPaid)).toBe(200000);
    expect(saved?.status).toBe("confirmed");
    expect(
      (await module.db.query.visaApplicationsTable.findMany()).length,
    ).toBe(1);
  });
  it("rejects forged webhooks and empty-secret signatures", async () => {
    await packageFixture();
    const body = JSON.stringify({
      event: "charge.success",
      data: { reference: "RDH-package" },
    });
    const url = `${baseUrl.replace(/\/ota$/, "")}/payments/paystack/webhook`;
    const send = (signature: string) =>
      httpFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-paystack-signature": signature,
        },
        body,
      });
    expect((await send("0".repeat(128))).status).toBe(401);
    await module.db
      .insert(module.siteSettingsTable)
      .values({ id: randomUUID(), key: "paystack_secret_key", value: "" });
    expect(
      (await send(createHmac("sha512", "").update(body).digest("hex"))).status,
    ).toBe(503);
    expect(
      Number((await module.db.query.bookingsTable.findFirst())?.amountPaid),
    ).toBe(0);
  });
  it("prevents manual approval and admin creation of unverified online credits", async () => {
    const bookingId = await packageFixture();
    const payment = await module.db.query.paymentsTable.findFirst();
    expect(
      (
        await legacyRequest(
          `/payments/${payment!.id}/verify`,
          "super",
          { status: "verified" },
          "PUT",
        )
      ).status,
    ).toBe(409);
    for (const method of ["paystack", "wallet"])
      expect(
        (
          await legacyRequest("/payments/admin-record", "super", {
            bookingId,
            method,
            amount: 100000,
            markVerified: true,
          })
        ).status,
      ).toBe(400);
    expect(
      Number((await module.db.query.bookingsTable.findFirst())?.amountPaid),
    ).toBe(0);
  });
  it("blocks cross-origin payment mutations", async () => {
    const response = await httpFetch(
      `${baseUrl.replace(/\/ota$/, "")}/payments/paystack/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: "https://attacker.test",
          "x-test-user": "user",
        },
        body: JSON.stringify({ reference: "unknown" }),
      },
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("rolls back a competing wallet debit without overdrawing or crediting the losing booking", async () => {
    const first = await packageFixture(["pending-one"]),
      second = await packageFixture(["pending-two"]);
    const agentId = randomUUID();
    await module.db.insert(module.agentsTable).values({
      id: agentId,
      userId: "user",
      businessName: "Test agent",
      status: "active",
    });
    await module.db
      .insert(module.agentWalletsTable)
      .values({ id: randomUUID(), agentId, balance: "100000" });
    await module.db.update(module.bookingsTable).set({ agentId });
    const responses = await Promise.all(
      [first, second].map((bookingId) =>
        legacyRequest("/payments/admin-record", "user", {
          bookingId,
          amount: 75000,
          method: "wallet",
        }),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(
      Number((await module.db.query.agentWalletsTable.findFirst())?.balance),
    ).toBe(25000);
    expect(
      (await module.db.query.walletTransactionsTable.findMany()).length,
    ).toBe(1);
    const bookings = await module.db.query.bookingsTable.findMany();
    expect(
      bookings.map((b) => Number(b.amountPaid)).sort((a, b) => a - b),
    ).toEqual([0, 75000]);
  });
});
async function deliverDuffel(type: string, object: Record<string, unknown>) {
  const { saveOtaConfig } = await import("../src/services/ota/config");
  await saveOtaConfig({ webhookTestSecret: "test-webhook-private==" }, "super");
  const body = JSON.stringify({
      id: `wev_${randomUUID()}`,
      idempotency_key: randomUUID(),
      type,
      live_mode: false,
      data: { object },
    }),
    t = String(Math.floor(Date.now() / 1000));
  const signature = `t=${t},v1=${createHmac("sha256", "test-webhook-private==").update(`${t}.`).update(body).digest("hex")}`;
  const service = await import("../src/services/ota/duffelWebhooks");
  await service.receiveDuffel(Buffer.from(body), signature, "test");
  await service.processDuffelEvents();
}
describe("OTA authorization and payments", () => {
  it("refreshes airline changes and keeps cancellations/refunds intact when older events arrive", async () => {
    await create();
    await request(`/bookings/${booking.id}/complete`, "user", {});
    await deliverDuffel("order.airline_initiated_change_detected", {
      order_id: "ord_test",
    });
    expect(
      (await module.db.query.otaBookingsTable.findFirst())?.providerNotice,
    ).toContain("airline");
    supplierCancelled = true;
    await deliverDuffel("order_cancellation.confirmed", {
      order_id: "ord_test",
    });
    expect((await module.db.query.otaBookingsTable.findFirst())?.status).toBe(
      "cancelled",
    );
    await deliverDuffel("order.created", { id: "ord_test" });
    expect((await module.db.query.otaBookingsTable.findFirst())?.status).toBe(
      "cancelled",
    );
    await module.db
      .update(module.otaBookingsTable)
      .set({ status: "refunded" })
      .where(eq(module.otaBookingsTable.id, booking.id));
    await deliverDuffel("order.created", { id: "ord_test" });
    expect((await module.db.query.otaBookingsTable.findFirst())?.status).toBe(
      "refunded",
    );
    expect(supplierCalls).toBe(1);
  });
  it("recovers a paid Stays reservation from a signed booking event without creating a second reservation", async () => {
    await create();
    await module.db
      .update(module.otaBookingsTable)
      .set({
        kind: "hotel",
        providerOfferId: "quo_test",
        paidAt: new Date(),
        status: "requires_review",
      })
      .where(eq(module.otaBookingsTable.id, booking.id));
    await deliverDuffel("stays.booking.created", {
      id: "bok_test",
      quote_id: "quo_test",
    });
    const row = await module.db.query.otaBookingsTable.findFirst();
    expect(row?.status).toBe("confirmed");
    expect(row?.providerBookingId).toBe("bok_test");
    expect(supplierCalls).toBe(0);
  });
  it("requires a recent signed ping before webhook activation", async () => {
    const { saveOtaConfig } = await import("../src/services/ota/config");
    await saveOtaConfig(
      { webhookTestSecret: "test-webhook-private==" },
      "super",
    );
    const { controlWebhook } =
      await import("../src/services/ota/duffelWebhooks");
    await expect(controlWebhook("test", "activate")).rejects.toThrow("ping");
    await deliverDuffel("ping.triggered", {});
    expect((await controlWebhook("test", "activate")).success).toBe(true);
  });
  it("does not downgrade a webhook-confirmed reservation after a late supplier network failure", async () => {
    await create();
    confirmationWinsRace = true;
    const response = await request(
      `/bookings/${booking.id}/complete`,
      "user",
      {},
    );
    expect((await response.json()).booking.status).toBe("confirmed");
    expect(supplierCalls).toBe(1);
  });
  it("stores signed Duffel notifications durably, deduplicates retries and recovers a paid uncertain order", async () => {
    await create();
    await module.db
      .update(module.otaBookingsTable)
      .set({ paidAt: new Date(), status: "requires_review" })
      .where(eq(module.otaBookingsTable.id, booking.id));
    const { saveOtaConfig } = await import("../src/services/ota/config");
    await saveOtaConfig(
      { webhookTestSecret: "test-webhook-private==" },
      "super",
    );
    const body = JSON.stringify({
      id: "wev_test",
      idempotency_key: "ord_test",
      api_version: "v2",
      type: "order.created",
      live_mode: false,
      data: {
        object: {
          id: "ord_test",
          offer_id: "off_test",
          email: "not-stored@example.test",
        },
      },
    });
    const t = String(Math.floor(Date.now() / 1000)),
      signature = `t=${t},v1=${createHmac("sha256", "test-webhook-private==").update(`${t}.`).update(body).digest("hex")}`;
    const send = (signatureValue: string, raw = body, mode = "test") =>
      httpFetch(`${baseUrl}/duffel/webhook/${mode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-duffel-signature": signatureValue,
        },
        body: raw,
      });
    expect((await send("invalid")).status).toBe(401);
    expect((await send(signature)).status).toBe(200);
    expect((await send(signature)).status).toBe(200);
    const queued = await module.db.query.otaDuffelEventsTable.findMany();
    expect(queued).toHaveLength(1);
    expect(JSON.stringify(queued)).not.toContain("not-stored@example.test");
    const { processDuffelEvents } =
      await import("../src/services/ota/duffelWebhooks");
    await processDuffelEvents();
    const saved = await module.db.query.otaBookingsTable.findFirst();
    expect(saved?.status).toBe("confirmed");
    expect(saved?.providerBookingId).toBe("ord_test");
    expect(supplierCalls).toBe(0);
    const settings = await request("/admin/settings", "super");
    expect(JSON.stringify(await settings.json())).not.toContain(
      "test-webhook-private",
    );
  });
  it("rejects cross-mode signed events and keeps webhook controls restricted to super admins", async () => {
    const { saveOtaConfig } = await import("../src/services/ota/config");
    await saveOtaConfig({ webhookTestSecret: "signing" }, "super");
    const body = JSON.stringify({
        id: "wev_wrong",
        type: "order.created",
        live_mode: true,
        data: { object: { id: "ord_test" } },
      }),
      t = String(Math.floor(Date.now() / 1000));
    const signature = `t=${t},v1=${createHmac("sha256", "signing").update(`${t}.`).update(body).digest("hex")}`;
    const response = await httpFetch(`${baseUrl}/duffel/webhook/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-duffel-signature": signature,
      },
      body,
    });
    expect(response.status).toBe(400);
    expect(await module.db.query.otaDuffelEventsTable.findMany()).toHaveLength(
      0,
    );
    expect(
      (
        await request("/admin/duffel/webhook/register", "admin", {
          mode: "test",
        })
      ).status,
    ).toBe(403);
    expect((await request("/admin/duffel/events", "user")).status).toBe(403);
  });
  it("refuses to enable sales when Duffel and the existing Paystack key use different modes", async () => {
    const response = await request(
      "/admin/settings",
      "super",
      { mode: "live", duffelToken: "duffel_live_fake", salesEnabled: true },
      "PUT",
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("Paystack");
    const stored = await module.db.query.siteSettingsTable.findFirst({
      where: eq(module.siteSettingsTable.key, "ota_config"),
    });
    expect((stored?.value as any).mode).toBe("test");
  });
  it("shows approved rates and references separately without leaking secrets or changing selling prices", async () => {
    const response = await request("/exchange-rates");
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sellingRates.GBP).toBe(1000);
    expect(data.reference.rates.GBP.ngnPerUnit).toBe(900);
    expect(JSON.stringify(data)).not.toContain("duffel_test_fake");
    expect(JSON.stringify(data)).not.toContain("sk_test_fake");
    const config = await (
      await import("../src/services/ota/config")
    ).getOtaConfig();
    expect(config.rates.GBP).toBe(1000);
  });
  it("starts fresh sandbox installations with flight search and editable currency defaults", async () => {
    const keys = [
      "OTA_MODE",
      "OTA_FLIGHTS_ENABLED",
      "OTA_DEFAULT_RATES",
    ] as const;
    const previous = Object.fromEntries(
      keys.map((key) => [key, process.env[key]]),
    );
    try {
      keys.forEach((key) => delete process.env[key]);
      await module.db
        .delete(module.siteSettingsTable)
        .where(eq(module.siteSettingsTable.key, "ota_config"));
      const { getOtaConfig, DEFAULT_OTA_RATES } =
        await import("../src/services/ota/config");
      const config = await getOtaConfig();
      expect(config.mode).toBe("test");
      expect(config.flightsEnabled).toBe(true);
      expect(config.salesEnabled).toBe(false);
      expect(config.hotelsEnabled).toBe(false);
      expect(config.rates).toEqual(DEFAULT_OTA_RATES);
      expect(config.rates.USD).toBe(1344.79);
      process.env.OTA_FLIGHTS_ENABLED = "false";
      expect((await getOtaConfig()).flightsEnabled).toBe(false);
      delete process.env.OTA_FLIGHTS_ENABLED;
      process.env.OTA_MODE = "live";
      expect((await getOtaConfig()).flightsEnabled).toBe(false);
    } finally {
      for (const key of keys) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
    }
  });
  it("retains a saved admin disable switch and approved rates over enabled environment defaults", async () => {
    const previous = process.env.OTA_FLIGHTS_ENABLED;
    try {
      process.env.OTA_FLIGHTS_ENABLED = "true";
      const { saveOtaConfig, getOtaConfig } =
        await import("../src/services/ota/config");
      await saveOtaConfig({ flightsEnabled: false }, "super");
      const config = await getOtaConfig();
      expect(config.flightsEnabled).toBe(false);
      expect(config.rates).toEqual({ NGN: 1, GBP: 1000 });
    } finally {
      if (previous === undefined) delete process.env.OTA_FLIGHTS_ENABLED;
      else process.env.OTA_FLIGHTS_ENABLED = previous;
    }
  });
  it("can disable environment-configured flights without copying host credentials into settings", async () => {
    const previous = process.env.SETTINGS_ENCRYPTION_KEY;
    try {
      delete process.env.SETTINGS_ENCRYPTION_KEY;
      const { saveOtaConfig, getOtaConfig } =
        await import("../src/services/ota/config");
      await saveOtaConfig({ flightsEnabled: false }, "super");
      const saved = await module.db.query.siteSettingsTable.findFirst({
        where: eq(module.siteSettingsTable.key, "ota_config"),
      });
      expect((saved?.value as any).duffelTestToken).toBe("");
      expect((saved?.value as any).duffelToken).toBe("");
      const config = await getOtaConfig();
      expect(config.flightsEnabled).toBe(false);
      expect(config.duffelToken).toBe("duffel_test_fake");
      await expect(
        saveOtaConfig({ duffelTestToken: "duffel_test_changed" }, "super"),
      ).rejects.toThrow("SETTINGS_ENCRYPTION_KEY");
    } finally {
      if (previous === undefined) delete process.env.SETTINGS_ENCRYPTION_KEY;
      else process.env.SETTINGS_ENCRYPTION_KEY = previous;
    }
  });
  it("uses environment rate defaults only when the admin has not saved rates", async () => {
    const original = process.env.OTA_DEFAULT_RATES;
    try {
      process.env.OTA_DEFAULT_RATES = JSON.stringify({ NGN: 1, GBP: 1700 });
      const { getOtaConfig } = await import("../src/services/ota/config");
      expect((await getOtaConfig()).rates.GBP).toBe(1000);
      process.env.OTA_DEFAULT_RATES =
        "invalid-json-is-ignored-when-admin-rates-exist";
      expect((await getOtaConfig()).rates.GBP).toBe(1000);
      process.env.OTA_DEFAULT_RATES = JSON.stringify({ NGN: 1, GBP: 1700 });
      await module.db
        .delete(module.siteSettingsTable)
        .where(eq(module.siteSettingsTable.key, "ota_config"));
      expect((await getOtaConfig()).rates.GBP).toBe(1700);
    } finally {
      if (original === undefined) delete process.env.OTA_DEFAULT_RATES;
      else process.env.OTA_DEFAULT_RATES = original;
    }
  });
  it("allows only super admins to read or change OTA settings and redacts encrypted tokens", async () => {
    expect((await request("/admin/settings")).status).toBe(401);
    expect((await request("/admin/settings", "admin")).status).toBe(403);
    expect(
      (await request("/admin/settings", "user", { salesEnabled: false }, "PUT"))
        .status,
    ).toBe(403);
    expect(
      (
        await request(
          "/admin/settings",
          "super",
          { duffelToken: "duffel_test_private" },
          "PUT",
        )
      ).status,
    ).toBe(200);
    const stored = await module.db.query.siteSettingsTable.findFirst({
      where: eq(module.siteSettingsTable.key, "ota_config"),
    });
    expect(JSON.stringify(stored?.value)).not.toContain("duffel_test_private");
    const response = await request("/admin/settings", "super");
    const data = await response.json();
    expect(data.settings.duffelTokenSet).toBe(true);
    expect(JSON.stringify(data)).not.toContain("private");
  });
  it("binds a checkout to its owner and rejects a changed customer price", async () => {
    await create();
    expect((await request(`/bookings/${booking.id}`, "other")).status).toBe(
      404,
    );
    expect(
      (await request(`/bookings/${booking.id}/complete`, "other", {})).status,
    ).toBe(404);
    const saved = await module.db.query.otaBookingsTable.findFirst();
    expect(saved?.amountKobo).toBe(10000000);
  });
  it("filters unsupported hotel rates and books a server-priced quote after verified payment", async () => {
    const rates = await request("/hotels/rates/srr_test", undefined, {});
    expect(
      (await rates.json()).result.accommodation.rooms[0].rates.map(
        (r: any) => r.id,
      ),
    ).toEqual(["rat_prepaid"]);
    const response = await request("/bookings", "user", {
      kind: "hotel",
      offerId: "quo_test",
      expectedTotalKobo: 10000000,
      acceptedTerms: true,
      contact: { email: "user@example.test", phone: "+2348012345678" },
      travellers: [{ given_name: "Test", family_name: "Guest" }],
      paystackStatus: "success",
    });
    expect(response.status).toBe(201);
    booking = (await response.json()).booking;
    expect(booking.status).toBe("payment_pending");
    expect(supplierCalls).toBe(0);
    const confirmed = await request(
      `/bookings/${booking.id}/complete`,
      "user",
      {},
    );
    expect((await confirmed.json()).booking.providerBookingId).toBe("bok_test");
    expect(supplierCalls).toBe(1);
  });
  it("rejects a stale displayed price and mismatched passenger identities before saving", async () => {
    const input = {
      kind: "flight",
      offerId: "off_test",
      expectedTotalKobo: 1,
      acceptedTerms: true,
      contact: { email: "user@example.test", phone: "+2348012345678" },
      travellers: [
        {
          id: "pas_test",
          given_name: "Test",
          family_name: "User",
          born_on: "1990-01-01",
          title: "mr",
          gender: "m",
          email: "user@example.test",
          phone_number: "+2348012345678",
        },
      ],
    };
    expect((await request("/bookings", "user", input)).status).toBe(409);
    expect(
      (
        await request("/bookings", "user", {
          ...input,
          expectedTotalKobo: 10000000,
          travellers: [{ ...input.travellers[0], id: "pas_other" }],
        })
      ).status,
    ).toBe(400);
    expect(await module.db.query.otaBookingsTable.findMany()).toHaveLength(0);
  });
  it("puts a payment for an expired checkout into review without buying a replacement", async () => {
    await create();
    await module.db
      .update(module.otaBookingsTable)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(module.otaBookingsTable.id, booking.id));
    const response = await request(
      `/bookings/${booking.id}/complete`,
      "user",
      {},
    );
    expect((await response.json()).booking.status).toBe("requires_review");
    expect(supplierCalls).toBe(0);
  });
  it("fulfills concurrent payment callbacks once and returns the same confirmation on replay", async () => {
    await create();
    const responses = await Promise.all([
      request(`/bookings/${booking.id}/complete`, "user", {}),
      request(`/bookings/${booking.id}/complete`, "user", {}),
    ]);
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect(supplierCalls).toBe(1);
    const replay = await request(
      `/bookings/${booking.id}/complete`,
      "user",
      {},
    );
    expect((await replay.json()).booking.status).toBe("confirmed");
    expect(supplierCalls).toBe(1);
  });
  it("rejects underpayment before making a supplier purchase", async () => {
    await create();
    amount = 1;
    expect(
      (await request(`/bookings/${booking.id}/complete`, "user", {})).status,
    ).toBe(409);
    expect(supplierCalls).toBe(0);
    expect((await module.db.query.otaBookingsTable.findFirst())?.status).toBe(
      "payment_pending",
    );
  });
  it("quarantines an ambiguous booking outcome without retrying the supplier", async () => {
    await create();
    failSupplier = true;
    const response = await request(
      `/bookings/${booking.id}/complete`,
      "user",
      {},
    );
    expect((await response.json()).booking.status).toBe("requires_review");
    await request(`/bookings/${booking.id}/complete`, "user", {});
    expect(supplierCalls).toBe(1);
  });
  it("marks interrupted fulfillment for review and delivers a retriable notification without a supplier retry", async () => {
    await create();
    await module.db
      .update(module.otaBookingsTable)
      .set({
        status: "processing",
        paidAt: new Date(),
        updatedAt: new Date(Date.now() - 11 * 60000),
      })
      .where(eq(module.otaBookingsTable.id, booking.id));
    const { maintainOta } = await import("../src/services/ota/maintenance");
    await maintainOta();
    const saved = await module.db.query.otaBookingsTable.findFirst();
    expect(saved?.status).toBe("requires_review");
    expect(saved?.notificationSentAt).toBeTruthy();
    expect(supplierCalls).toBe(0);
  });
  it("records only a verified full refund associated with the paid checkout", async () => {
    await create();
    await module.db
      .update(module.otaBookingsTable)
      .set({ status: "requires_review", paidAt: new Date() })
      .where(eq(module.otaBookingsTable.id, booking.id));
    const input = {
      refundId: "77",
      supplierResolved: true,
      note: "Confirmed no supplier reservation and completed customer refund",
    };
    expect(
      (
        await request(
          `/admin/bookings/${booking.id}/refund-record`,
          "admin",
          input,
        )
      ).status,
    ).toBe(403);
    amount = 1;
    expect(
      (
        await request(
          `/admin/bookings/${booking.id}/refund-record`,
          "super",
          input,
        )
      ).status,
    ).toBe(409);
    amount = 10000000;
    gatewayPatch = { status: "reversed" };
    expect(
      (
        await request(
          `/admin/bookings/${booking.id}/refund-record`,
          "super",
          input,
        )
      ).status,
    ).toBe(200);
    expect((await module.db.query.otaBookingsTable.findFirst())?.status).toBe(
      "refunded",
    );
    expect(supplierCalls).toBe(0);
  });
  it("never purchases a ticket with a reversed transaction", async () => {
    await create();
    gatewayPatch = { status: "reversed" };
    expect(
      (await request(`/bookings/${booking.id}/complete`, "user", {})).status,
    ).toBe(409);
    expect(supplierCalls).toBe(0);
    expect(
      (await module.db.query.otaBookingsTable.findFirst())?.paidAt,
    ).toBeNull();
  });
  it("does not return a payment redirect after the booking changes during initialization", async () => {
    await create();
    changeDuringInitialization = true;
    expect(
      (await request(`/bookings/${booking.id}/pay`, "user", {})).status,
    ).toBe(409);
    const saved = await module.db.query.otaBookingsTable.findFirst();
    expect(saved?.status).toBe("confirmed");
    expect(saved?.authorizationUrl).toBeNull();
  });
  it("serializes simultaneous payment redirect updates", async () => {
    await create();
    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        request(`/bookings/${booking.id}/pay`, "user", {}),
      ),
    );
    expect(responses.every((r) => [200, 409].includes(r.status))).toBe(true);
    const saved = await module.db.query.otaBookingsTable.findFirst();
    expect(saved?.authorizationUrl).toBe(
      "https://checkout.paystack.com/test-session",
    );
    expect(saved?.status).toBe("payment_pending");
    expect(supplierCalls).toBe(0);
  });
  it("rejects refund transaction IDs that collide when converted to JavaScript numbers", async () => {
    await create();
    await module.db
      .update(module.otaBookingsTable)
      .set({ status: "requires_review", paidAt: new Date() })
      .where(eq(module.otaBookingsTable.id, booking.id));
    gatewayPatch = { id: "9007199254740993", status: "reversed" };
    refundTransaction = "9007199254740992";
    expect(
      (
        await request(`/admin/bookings/${booking.id}/refund-record`, "super", {
          refundId: "77",
          supplierResolved: true,
          note: "Checked refund",
        })
      ).status,
    ).toBe(409);
    expect((await module.db.query.otaBookingsTable.findFirst())?.status).toBe(
      "requires_review",
    );
  });
  it("allows the documented supplier creation timeout while keeping reads bounded", async () => {
    await create();
    const timeout = vi.spyOn(AbortSignal, "timeout");
    try {
      const { getOtaConfig } = await import("../src/services/ota/config");
      const config = await getOtaConfig();
      await duffelRequest(config, "/air/offers/off_test");
      expect(timeout).toHaveBeenLastCalledWith(55000);
      await duffelRequest(config, "/air/orders", "POST", { type: "instant" });
      expect(timeout).toHaveBeenLastCalledWith(135000);
    } finally {
      timeout.mockRestore();
    }
  });
  it("validates webhook signatures and durably queues processing before acknowledging", async () => {
    await create();
    const body = JSON.stringify({
      event: "charge.success",
      data: {
        reference: booking.reference,
        metadata: { otaBookingId: booking.id },
      },
    });
    expect(
      (await request("/payments/webhook", undefined, JSON.parse(body))).status,
    ).toBe(401);
    const response = await httpFetch(`${baseUrl}/payments/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-paystack-signature": createHmac("sha512", "sk_test_fake")
          .update(body)
          .digest("hex"),
      },
      body,
    });
    expect(response.status).toBe(200);
    expect(await module.db.query.otaPaymentJobsTable.findMany()).toHaveLength(
      1,
    );
    expect(supplierCalls).toBe(0);
    const { processOtaPayments } =
      await import("../src/services/ota/paymentQueue");
    await processOtaPayments();
    expect(
      (await module.db.query.otaPaymentJobsTable.findFirst())?.attempts,
    ).toBe(1);
    expect((await module.db.query.otaBookingsTable.findFirst())?.status).toBe(
      "confirmed",
    );
  });
});
it("publishes durable booking notifications once, routes urgent alerts by role and protects owner timelines", async () => {
  await create();
  const { audit } = await import("../src/services/ota/booking");
  const { publishBookingUpdates } =
    await import("../src/services/ota/bookingUpdates");
  await audit(booking.id, "system", "itinerary_changed", {
    internalError: "PRIVATE PROVIDER DATA",
    passport: "SECRET",
  });
  await audit(booking.id, "operator", "settings_updated", {
    secret: "PRIVATE TOKEN",
  });
  await Promise.all([publishBookingUpdates(), publishBookingUpdates()]);
  const all = await module.db.query.notificationsTable.findMany();
  expect(all.filter((n) => n.userId === "user")).toHaveLength(2);
  expect(all.filter((n) => n.userId === "super")).toHaveLength(1);
  expect(all.filter((n) => ["other", "admin"].includes(n.userId))).toHaveLength(
    0,
  );
  expect(JSON.stringify(all)).not.toMatch(/PRIVATE|SECRET/);
  expect(all.find((n) => n.userId === "super")?.link).toBe(
    `/admin/ota?booking=${booking.id}`,
  );
  expect(
    (await (await request("/updates", "other")).json()).updates,
  ).toHaveLength(0);
  expect(
    (await request(`/bookings/${booking.id}/timeline`, "other")).status,
  ).toBe(404);
  expect((await request(`/admin/bookings/${booking.id}`, "admin")).status).toBe(
    403,
  );
  expect((await request(`/admin/bookings/${booking.id}`, "super")).status).toBe(
    200,
  );
  expect((await request("/admin/overview", "admin")).status).toBe(403);
  const overview = await (await request("/admin/overview", "super")).json();
  expect(overview.totals.total).toBe(1);
  expect(overview.queues.supplier_issues).toBe(0);
  const timeline = await (
    await request(`/bookings/${booking.id}/timeline`, "user")
  ).json();
  expect(timeline.events.map((e: any) => e.title)).toContain(
    "Your itinerary has changed",
  );
  expect(JSON.stringify(timeline)).not.toMatch(
    /PRIVATE|SECRET|settings_updated/,
  );
  await publishBookingUpdates();
  expect(await module.db.query.notificationsTable.findMany()).toHaveLength(
    all.length,
  );
});

it("shows an explicit customer support response without exposing historical internal notes", async () => {
  await create();
  const { audit } = await import("../src/services/ota/booking");
  await audit(booking.id, "operator", "service_request_resolved", {
    note: "INTERNAL ONLY",
  });
  await module.db
    .update(module.otaBookingsTable)
    .set({ serviceRequest: "Please help change my travel dates." })
    .where(eq(module.otaBookingsTable.id, booking.id));
  expect(
    (
      await request(`/admin/bookings/${booking.id}/resolve-request`, "super", {
        note: "Please contact us to review the fare difference.",
      })
    ).status,
  ).toBe(200);
  const timeline = await (
    await request(`/bookings/${booking.id}/timeline`, "user")
  ).json();
  expect(JSON.stringify(timeline)).toContain(
    "Please contact us to review the fare difference.",
  );
  expect(JSON.stringify(timeline)).not.toContain("INTERNAL ONLY");
});

it("counts unread notifications beyond the returned page and prevents another account from marking them read", async () => {
  await module.db.insert(module.notificationsTable).values(
    [1, 2, 3].map((i) => ({
      id: `notice-${i}`,
      userId: "user",
      title: "Booking update",
      message: "Your booking changed",
      type: "booking" as const,
    })),
  );
  const notificationUrl = baseUrl.replace(/\/ota$/, "/notifications");
  const page = await (
    await httpFetch(`${notificationUrl}?limit=1`, {
      headers: { "x-test-user": "user" },
    })
  ).json();
  expect(page.notifications).toHaveLength(1);
  expect(page.unreadCount).toBe(3);
  expect(
    (
      await httpFetch(`${notificationUrl}/notice-1/read`, {
        method: "PUT",
        headers: { "x-test-user": "other" },
      })
    ).status,
  ).toBe(404);
});

it("does not undo a refund or hide a supplier confirmation during concurrent operator verification", async () => {
  await create();
  await module.db
    .update(module.otaBookingsTable)
    .set({ status: "requires_review", paidAt: new Date() })
    .where(eq(module.otaBookingsTable.id, booking.id));
  changeDuringSupplierRead = true;
  expect(
    (
      await request(`/admin/bookings/${booking.id}/reconcile`, "super", {
        providerId: "ord_test",
      })
    ).status,
  ).toBe(409);
  expect((await module.db.query.otaBookingsTable.findFirst())?.status).toBe(
    "refunded",
  );
  await module.db
    .update(module.otaBookingsTable)
    .set({ status: "requires_review" })
    .where(eq(module.otaBookingsTable.id, booking.id));
  changeDuringRefundRead = true;
  expect(
    (
      await request(`/admin/bookings/${booking.id}/refund-record`, "super", {
        refundId: "77",
        supplierResolved: true,
        note: "Full refund verified with the payment provider",
      })
    ).status,
  ).toBe(409);
  expect((await module.db.query.otaBookingsTable.findFirst())?.status).toBe(
    "confirmed",
  );
  expect(
    (await module.db.query.otaEventsTable.findMany()).filter((e) =>
      ["booking_reconciled", "full_refund_verified"].includes(e.action),
    ),
  ).toHaveLength(0);
});

it("continues paid-booking maintenance and notifications when both new search channels are disabled", async () => {
  await create();
  await module.db
    .update(module.otaBookingsTable)
    .set({
      status: "processing",
      paidAt: new Date(),
      updatedAt: new Date(Date.now() - 11 * 60000),
    })
    .where(eq(module.otaBookingsTable.id, booking.id));
  await (
    await import("../src/services/ota/config")
  ).saveOtaConfig({ flightsEnabled: false, hotelsEnabled: false }, "super");
  await (await import("../src/services/ota/maintenance")).maintainOta();
  const row = await module.db.query.otaBookingsTable.findFirst();
  expect(row?.status).toBe("requires_review");
  expect(row?.notificationSentAt).toBeTruthy();
  expect(
    (await module.db.query.notificationsTable.findMany()).some((n) =>
      n.title.includes("review"),
    ),
  ).toBe(true);
  expect(supplierCalls).toBe(0);
});

it.each(["0.07", "0.14", "1.10", "19.99", "100.01"])(
  "prices %s without binary floating-point overcharges",
  (amount) => {
    const config = configSchema.parse({
      rates: { NGN: 1 },
      flightMarkupPercent: 0,
      serviceFeeNgn: 0,
    });
    expect(price(config, "flight", amount, "NGN").totalKobo).toBe(
      Math.round(Number(amount) * 100),
    );
  },
);

it("does not acknowledge a newer reservation alert while an older email is being sent", async () => {
  await create();
  await request(`/bookings/${booking.id}/complete`, "user", {});
  const { sendEmail } = await import("../src/utils/email");
  vi.mocked(sendEmail).mockImplementationOnce(async () => {
    await module.db
      .update(module.otaBookingsTable)
      .set({
        providerNotice: "The airline updated your itinerary.",
        notificationSentAt: null,
        notificationAttemptAt: null,
        updatedAt: new Date(),
      })
      .where(eq(module.otaBookingsTable.id, booking.id));
    return true;
  });
  const { maintainOta } = await import("../src/services/ota/maintenance");
  await maintainOta();
  expect(
    (await module.db.query.otaBookingsTable.findFirst())?.notificationSentAt,
  ).toBeNull();
  await maintainOta();
  expect(
    (await module.db.query.otaBookingsTable.findFirst())?.notificationSentAt,
  ).toBeTruthy();
});

it("previews draft pricing only for super admins without changing saved prices", async () => {
  const input = {
    kind: "flight",
    amount: "100.00",
    currency: "GBP",
    pricing: {
      rates: { NGN: 1, GBP: 1200 },
      flightMarkupPercent: 5,
      hotelMarkupPercent: 2,
      serviceFeeNgn: 500,
    },
  };
  expect((await request("/admin/price-preview", "admin", input)).status).toBe(
    403,
  );
  const response = await request("/admin/price-preview", "super", input);
  expect(response.status).toBe(200);
  expect((await response.json()).pricing.totalKobo).toBe(12650000);
  expect(
    (await (await import("../src/services/ota/config")).getOtaConfig()).rates
      .GBP,
  ).toBe(1000);
  expect(supplierCalls).toBe(0);
});

it("retries stale supplier events instead of overwriting a newer confirmed-booking revision", async () => {
  await create();
  await request(`/bookings/${booking.id}/complete`, "user", {});
  newerSupplierSnapshot = true;
  await deliverDuffel("order.created", { id: "ord_test" });
  const event = await module.db.query.otaDuffelEventsTable.findFirst();
  expect(event?.completedAt).toBeNull();
  expect(event?.attempts).toBe(1);
  expect(
    (await module.db.query.otaBookingsTable.findFirst())?.providerNotice,
  ).toBe("A newer supplier update was saved.");
  newerSupplierSnapshot = false;
  await module.db
    .update(module.otaDuffelEventsTable)
    .set({ availableAt: new Date(Date.now() - 1000) });
  await (
    await import("../src/services/ota/duffelWebhooks")
  ).processDuffelEvents();
  expect(
    (await module.db.query.otaDuffelEventsTable.findFirst())?.completedAt,
  ).toBeTruthy();
});

it("paginates owner history without leaking other accounts and reports owner totals", async () => {
  await create();
  const row = (await module.db.query.otaBookingsTable.findFirst())!;
  await module.db.insert(module.otaBookingsTable).values(
    Array.from({ length: 51 }, (_, i) => ({
      ...row,
      id: randomUUID(),
      reference: `OTA-history-${i}`,
      clerkUserId: i === 50 ? "other" : "user",
    })),
  );
  const first = await (await request("/bookings", "user")).json();
  expect(first.bookings).toHaveLength(50);
  expect(first.nextOffset).toBe(50);
  expect(first.summary.pending).toBe(51);
  const next = await (await request("/bookings?offset=50", "user")).json();
  expect(next.bookings).toHaveLength(1);
  expect(next.nextOffset).toBeNull();
  expect(
    new Set([...first.bookings, ...next.bookings].map((b) => b.id)).size,
  ).toBe(51);
  expect((await request("/bookings?offset=-1", "user")).status).toBe(400);
});

it("matches supplier decimals exactly while rejecting changed and malformed amounts", () => {
  expect(sameSupplierAmount("100.0", "100.00")).toBe(true);
  expect(sameSupplierAmount("100.01", "100.00")).toBe(false);
  expect(sameSupplierAmount("not-money", "100.00")).toBe(false);
});

it("rejects a passport which expires before the itinerary ends before accepting payment", async () => {
  await create();
  const response = await request("/bookings", "user", {
    kind: "flight",
    offerId: "off_test",
    expectedTotalKobo: 10000000,
    acceptedTerms: true,
    contact: booking.contact,
    travellers: booking.travellers.map((p: any) => ({
      ...p,
      identity_documents: [
        {
          type: "passport",
          issuing_country_code: "NG",
          unique_identifier: "TEST12345",
          expires_on: new Date(Date.now() + 20 * 86400000)
            .toISOString()
            .slice(0, 10),
        },
      ],
    })),
  });
  expect(response.status).toBe(400);
  expect((await response.json()).error).toContain("last flight");
  expect(supplierCalls).toBe(0);
});

it("does not re-notify a cancellation or report an itinerary change for a cancelled reservation", async () => {
  await create();
  await request(`/bookings/${booking.id}/complete`, "user", {});
  supplierCancelled = true;
  await deliverDuffel("order.created", { id: "ord_test" });
  const sentAt = new Date();
  await module.db
    .update(module.otaBookingsTable)
    .set({ notificationSentAt: sentAt })
    .where(eq(module.otaBookingsTable.id, booking.id));
  await deliverDuffel("order.airline_initiated_change_detected", {
    id: "ord_test",
  });
  expect(
    (
      await module.db.query.otaBookingsTable.findFirst()
    )?.notificationSentAt?.getTime(),
  ).toBe(sentAt.getTime());
  expect(
    (await module.db.query.otaEventsTable.findMany()).filter(
      (e) => e.action === "itinerary_changed",
    ),
  ).toHaveLength(0);
});

it("limits one authenticated account without blocking another account on the same network", async () => {
  for (let i = 0; i < 60; i++)
    expect((await request("/config", "user")).status).toBe(200);
  const blocked = await request("/config", "user");
  expect(blocked.status).toBe(429);
  expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
  expect((await request("/config", "other")).status).toBe(200);
});

it("retains the supplier reservation without repeating a purchase when its confirmation audit fails", async () => {
  await create();
  await module.pool.query(
    "ALTER TABLE ota_events ADD CONSTRAINT ota_test_audit_failure CHECK (action <> 'provider_confirmed')",
  );
  try {
    const response = await request(
      `/bookings/${booking.id}/complete`,
      "user",
      {},
    );
    expect(response.status).toBe(200);
    const row = (await response.json()).booking;
    expect(row.status).toBe("requires_review");
    expect(row.providerBookingId).toBe("ord_test");
    await request(`/bookings/${booking.id}/complete`, "user", {});
    expect(supplierCalls).toBe(1);
  } finally {
    await module.pool.query(
      "ALTER TABLE ota_events DROP CONSTRAINT ota_test_audit_failure",
    );
  }
});

it("uses a booking's original supplier mode when new sales settings change", async () => {
  await create();
  await (
    await import("../src/services/ota/config")
  ).saveOtaConfig(
    {
      mode: "live",
      flightsEnabled: false,
      hotelsEnabled: false,
      salesEnabled: false,
    },
    "super",
  );
  const response = await request(
    `/bookings/${booking.id}/complete`,
    "user",
    {},
  );
  expect((await response.json()).booking.status).toBe("confirmed");
  expect(supplierCalls).toBe(1);
});

it("backs off failed supplier refreshes so they do not starve other bookings", async () => {
  await create();
  await request(`/bookings/${booking.id}/complete`, "user", {});
  const row = (await module.db.query.otaBookingsTable.findFirst())!;
  const old = new Date(Date.now() - 20 * 60000);
  await module.db
    .update(module.otaBookingsTable)
    .set({ syncedAt: old, notificationSentAt: new Date() })
    .where(eq(module.otaBookingsTable.id, row.id));
  await module.db.insert(module.otaBookingsTable).values(
    Array.from({ length: 10 }, (_, i) => ({
      ...row,
      id: `000-failed-${i}`,
      reference: `OTA-failed-${i}`,
      providerBookingId: `ord_unavailable${i}`,
      syncedAt: old,
      notificationSentAt: new Date(),
    })),
  );
  const { maintainOta } = await import("../src/services/ota/maintenance");
  await maintainOta();
  expect(
    (
      await module.db.query.otaBookingsTable.findFirst({
        where: eq(module.otaBookingsTable.id, row.id),
      })
    )?.syncedAt?.getTime(),
  ).toBe(old.getTime());
  await maintainOta();
  expect(
    (
      await module.db.query.otaBookingsTable.findFirst({
        where: eq(module.otaBookingsTable.id, row.id),
      })
    )?.syncedAt?.getTime(),
  ).toBeGreaterThan(old.getTime());
  expect(supplierCalls).toBe(1);
});

it("rounds decimal conversion, markup and service fees exactly to kobo", () => {
  const config = configSchema.parse({
    rates: { NGN: 1, GBP: 1.4 },
    flightMarkupPercent: 10,
    serviceFeeNgn: 0.145,
  });
  expect(price(config, "flight", "0.10", "GBP")).toMatchObject({
    supplierKobo: 14,
    markupKobo: 2,
    feeKobo: 15,
    totalKobo: 31,
  });
  expect(() => price(config, "flight", "1e999", "GBP")).toThrow();
});

it("prices supported currencies and rejects replay, currency and mode mismatches", () => {
  const config = configSchema.parse({
    rates: { NGN: 1, GBP: 1000 },
    flightMarkupPercent: 5,
    serviceFeeNgn: 100,
  });
  expect(price(config, "flight", "100", "GBP").totalKobo).toBe(10510000);
  expect(() => price(config, "flight", "100", "USD")).toThrow("Pricing");
  const checkout = {
    id: "one",
    reference: "OTA-one",
    amountKobo: 100,
    mode: "test",
  };
  const valid = {
    status: "success",
    reference: "OTA-one",
    currency: "NGN",
    amount: 100,
    domain: "test",
    metadata: { otaBookingId: "one", type: "ota_booking" },
  };
  expect(() => validatePayment(valid, checkout)).not.toThrow();
  for (const patch of [
    { reference: "other" },
    { currency: "USD" },
    { domain: "live" },
    { metadata: { otaBookingId: "two" } },
    { amount: 1 },
  ])
    expect(() => validatePayment({ ...valid, ...patch }, checkout)).toThrow();
});
