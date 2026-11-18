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
vi.mock("../src/lib/r2", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/lib/r2")>();
  const files = new Map<string, Buffer>();
  return {
    ...original,
    uploadToR2: vi.fn(async (key: string, buffer: Buffer) => {
      files.set(key, buffer);
      return key;
    }),
    getFromR2: vi.fn(async (key: string) => {
      const buffer = files.get(key);
      if (!buffer) throw new Error("Object not found");
      return { body: (async function* () { yield buffer; })(), contentLength: buffer.length };
    }),
  };
});
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
let supplierSnapshotPatch: Record<string, unknown> = {};
let hotelBookingStatus = 201;
let hotelQuotePayNow = true;
let paystackReferenceMismatch = false;
function hotelReservation() {
  return {
    id: "bok_test",
    status: "confirmed",
    reference: "HOTEL123",
    metadata: { ota_booking_id: booking.id },
    accommodation: {
      rooms: [{ rates: [{ total_amount: "100.00", total_currency: "GBP" }] }],
    },
    ...supplierSnapshotPatch,
  };
}
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
  await module.pool.query("DROP TABLE ehajj_registrations, ehajj_grants, ehajj_connections");
  await module.pool.query(
    await readFile(path.join(root, "lib/db/drizzle/0013_ehajj.sql"), "utf8"),
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
  await module.pool.query(await readFile(path.join(root, "lib/db/drizzle/0014_ota_booking_supplier.sql"), "utf8"));
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
  app.use("/api", (await import("../src/routes/ehajj")).default);
  app.use("/api", (await import("../src/routes/documents")).default);
  app.use("/api", (await import("../src/routes/upload")).default);
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
  supplierSnapshotPatch = {};
  hotelBookingStatus = 201;
  hotelQuotePayNow = true;
  paystackReferenceMismatch = false;
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
      flightMarkupPercent: 0,
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
            reference: paystackReferenceMismatch ? "OTA-other" : booking.reference,
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
            ...supplierSnapshotPatch,
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
                      payment_type: hotelQuotePayNow ? "pay_now" : "pay_at_accommodation",
                      available_payment_methods: [["balance"]],
                    },
                  ],
                },
              ],
            },
          },
        });
      if (url.endsWith("/stays/bookings/bok_test"))
        return Response.json({ data: hotelReservation() });
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
        return Response.json(
          { data: hotelReservation() },
          { status: hotelBookingStatus, headers: { "x-request-id": "hotel-request" } },
        );
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
async function create(native = false, expectedTotalKobo = 10000000) {
  const response = await (native ? nativeRequest : request)(
    "/bookings",
    "user",
    {
      kind: "flight",
      offerId: "off_test",
      expectedTotalKobo,
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
  it("provides the complete developer kit only to super admins", async () => {
    expect(
      (await request("/admin/developer/downloads/postman-collection")).status,
    ).toBe(401);
    expect(
      (await request("/admin/developer/downloads/postman-collection", "admin"))
        .status,
    ).toBe(403);
    for (const asset of [
      "postman-collection",
      "postman-environment",
      "flyraudah-client.ts",
      "flyraudah-api.d.ts",
      "README.md",
    ]) {
      const response = await request(
        `/admin/developer/downloads/${asset}`,
        "super",
      );
      expect(response.status, asset).toBe(200);
      expect(response.headers.get("content-disposition")).toContain(
        "attachment;",
      );
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect((await response.text()).length).toBeGreaterThan(100);
    }
    expect(
      (await request("/admin/developer/downloads/package.json", "super"))
        .status,
    ).toBe(404);
    expect(
      (
        await nativeRequest(
          "/admin/developer/downloads/postman-collection",
          "super",
        )
      ).status,
    ).toBe(404);
  });
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
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    // The loser can hit the balance check before or during the guarded debit.
    const rejected = responses.find((r) => r.status !== 201)!;
    expect([400, 409]).toContain(rejected.status);
    expect((await rejected.json()).error).toContain("Insufficient wallet balance");
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
  it.each([false, true])(
    "issues and downloads a live Bilalsadasub ticket while the primary provider stays in test (booking timeout %s)",
    async (bookingTimeout) => {
      const livePaymentKey = "sk_live_bilal_fixture";
      vi.stubEnv("BILALSADASUB_PAYSTACK_LIVE_SECRET_KEY", livePaymentKey);
      try {
        const saved = await request(
          "/admin/settings",
          "super",
          {
            bilalMode: "live",
            bilalSalesEnabled: true,
            bilalLiveToken: "bilal_live_fixture",
          },
          "PUT",
        );
        expect(saved.status).toBe(200);
        expect((await saved.json()).settings).toMatchObject({
          mode: "test",
          bilalMode: "live",
          bilalSalesEnabled: true,
          bilalLiveToken: "",
        });
        const departureDate = new Date(Date.now() + 86400000)
          .toISOString()
          .slice(0, 10);
        const fallback = globalThis.fetch;
        let issued = false;
        let purchases = 0;
        const supplierOrder = () => ({
          reference: "FL_fixture",
          my_trans_id: booking.id,
          origin: "LOS",
          destination: "ABV",
          departure_date: departureDate,
          trip_type: "oneway",
          cabin: "economy",
          pnr: issued ? "ABC123" : null,
          status: issued ? "ticketed" : "reserved",
          currency: "NGN",
          amount: 105000,
          addons_fee: 0,
          tickets: issued ? [{ number: "0572101234567" }] : [],
        });
        vi.stubGlobal(
          "fetch",
          vi.fn(async (input: string | URL, init?: RequestInit) => {
            const url = new URL(input);
            if (url.hostname === "api.paystack.co") {
              expect(init?.headers).toMatchObject({
                Authorization: `Bearer ${livePaymentKey}`,
              });
              if (url.pathname.endsWith("initialize")) {
                expect(JSON.parse(String(init.body))).toMatchObject({
                  reference: booking.reference,
                  amount: 11_000_000,
                });
                return fallback(input, init);
              }
              return Response.json({
                status: true,
                data: {
                  id: 101,
                  status: "success",
                  domain: "live",
                  currency: "NGN",
                  amount: 11_000_000,
                  reference: booking.reference,
                  metadata: { otaBookingId: booking.id, type: "ota_booking" },
                },
              });
            }
            if (url.hostname !== "bilalsadasub.com")
              return fallback(input, init);
            expect(init?.headers).toMatchObject({
              Authorization: "Token bilal_live_fixture",
            });
            if (url.pathname.endsWith("/search"))
              return Response.json({
                status: "success",
                data: [
                  {
                    flight_id: "OF_fixture",
                    airline: "Air Peace",
                    price: 100000,
                    currency: "NGN",
                    cabin: "economy",
                    departure: `${departureDate}T08:00`,
                    arrival: `${departureDate}T09:05`,
                    stops: 0,
                  },
                ],
              });
            if (url.pathname.endsWith("/book")) {
              purchases++;
              expect(JSON.parse(String(init?.body))).toMatchObject({
                flight_id: "OF_fixture",
                my_trans_id: booking.id,
                passengers: [
                  {
                    passenger_type: "adult",
                    first_name: "Test",
                    gender: "male",
                  },
                ],
              });
              if (bookingTimeout)
                throw new Error("simulated response loss after wallet debit");
            }
            if (url.pathname.endsWith("/bookings"))
              return Response.json({
                status: "success",
                data: [supplierOrder()],
              });
            if (url.pathname.endsWith("/ticket"))
              return new Response("%PDF-1.4\nfixture", {
                headers: { "Content-Type": "application/pdf" },
              });
            return Response.json({ status: "success", data: supplierOrder() });
          }),
        );
        const search = await request("/flights/search", undefined, {
          origin: "LOS",
          destination: "ABV",
          departureDate,
          adults: 1,
        });
        const { checkoutOfferId } = (await search.json()).estimatedFares[0];
        const created = await request("/bookings", "user", {
          kind: "flight",
          offerId: checkoutOfferId,
          expectedTotalKobo: 11_000_000,
          acceptedTerms: true,
          contact: { email: "user@example.test", phone: "+2348012345678" },
          travellers: [
            {
              id: "pas_1",
              given_name: "Test",
              family_name: "Traveller",
              born_on: "1990-01-01",
              title: "mr",
              gender: "m",
              email: "user@example.test",
              phone_number: "+2348012345678",
            },
          ],
        });
        expect(created.status).toBe(201);
        booking = (await created.json()).booking;
        expect(booking).toMatchObject({
          supplier: "bilalsadasub",
          mode: "live",
          amountKobo: 11_000_000,
          providerOfferId: null,
        });
        expect(booking.offer).not.toHaveProperty("domesticQuote");
        expect(
          (await request(`/bookings/${booking.id}/pay`, "user", {})).status,
        ).toBe(200);
        const webhookBody = JSON.stringify({
          event: "charge.success",
          data: {
            reference: booking.reference,
            metadata: { otaBookingId: booking.id },
          },
        });
        for (const [key, status] of [
          ["sk_test_fake", 401],
          [livePaymentKey, 200],
        ] as const) {
          const webhook = await httpFetch(`${baseUrl}/payments/webhook`, {
            method: "POST",
            body: webhookBody,
            headers: {
              "content-type": "application/json",
              "x-paystack-signature": createHmac("sha512", key)
                .update(webhookBody)
                .digest("hex"),
            },
          });
          expect(webhook.status).toBe(status);
        }
        const { processOtaPayments } =
          await import("../src/services/ota/paymentQueue");
        await Promise.all([
          processOtaPayments(),
          request(`/bookings/${booking.id}/complete`, "user", {}),
        ]);
        expect(purchases).toBe(1);
        expect(
          (await request(`/bookings/${booking.id}/ticket`, "user")).status,
        ).toBe(404);
        issued = true;
        const confirmed = await request(
          `/bookings/${booking.id}/refresh`,
          "user",
          {},
        );
        expect((await confirmed.json()).booking).toMatchObject({
          status: "confirmed",
          pricing: {
            supplierKobo: 10_500_000,
            expectedSupplierKobo: 10_000_000,
          },
          amountKobo: 11_000_000,
        });
        const changes = (
          await (await request("/admin/fare-changes?mode=live", "super")).json()
        ).changes;
        expect(changes).toHaveLength(1);
        expect(changes[0].details).toMatchObject({
          match: "wallet_debit",
          previousSupplierKobo: 10_000_000,
          currentSupplierKobo: 10_500_000,
          currentTotalKobo: 11_000_000,
        });
        expect(
          (await request(`/bookings/${booking.id}/ticket`, "other")).status,
        ).toBe(404);
        const pdf = await request(`/bookings/${booking.id}/ticket`, "user");
        expect(pdf.headers.get("content-type")).toBe("application/pdf");
        expect(await pdf.text()).toMatch(/^%PDF-/);
        expect(purchases).toBe(1);
      } finally {
        vi.unstubAllEnvs();
      }
    },
  );
  it("activates domestic estimates on saving a key and keeps those fares out of checkout", async () => {
    const credentials = { bilalTestToken: "sk_test_domestic_fixture" };
    expect(
      (await request("/admin/settings", "admin", credentials, "PUT")).status,
    ).toBe(403);
    const saved = await request("/admin/settings", "super", credentials, "PUT");
    expect(saved.status).toBe(200);
    expect((await saved.json()).settings).toMatchObject({
      bilalFlightsEnabled: true,
      bilalTestToken: "",
      bilalTestTokenSet: true,
    });
    const row = await module.db.query.siteSettingsTable.findFirst({
      where: eq(module.siteSettingsTable.key, "ota_config"),
    });
    expect(JSON.stringify(row?.value)).not.toContain(
      credentials.bilalTestToken,
    );
    const fallback = globalThis.fetch;
    const departureDate = new Date(Date.now() + 86400000)
      .toISOString()
      .slice(0, 10);
    let supplierFare = 85500;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = new URL(input);
        if (url.hostname !== "bilalsadasub.com") return fallback(input, init);
        expect(init?.headers).toMatchObject({
          Authorization: `Token ${credentials.bilalTestToken}`,
        });
        return Response.json({
          status: "success",
          data: url.pathname.endsWith("/airports")
            ? []
            : [
                {
                  flight_id: "OF_domestic",
                  airline: "Air Peace",
                  price: supplierFare,
                  currency: "NGN",
                  cabin: "economy",
                  departure: `${departureDate}T08:00`,
                  arrival: `${departureDate}T09:05`,
                  stops: 0,
                },
              ],
        });
      }),
    );
    expect(
      (
        await request("/admin/suppliers/bilalsadasub/check", "admin", {
          mode: "test",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request("/admin/suppliers/bilalsadasub/check", "super", {
          mode: "test",
        })
      ).status,
    ).toBe(200);
    const search = await request("/flights/search", undefined, {
      origin: "LOS",
      destination: "ABV",
      departureDate,
      adults: 1,
    });
    expect(search.status).toBe(200);
    const result = await search.json();
    expect(result.estimatedFares).toMatchObject([
      { airline: "Air Peace", estimatedTotalKobo: 9_405_000 },
    ]);
    expect(JSON.stringify(result)).not.toContain("OF_domestic");
    expect((await request("/flights/offers/OF_domestic", "user")).status).toBe(
      400,
    );
    const checkout = await request("/bookings", "user", {
      kind: "flight",
      offerId: "OF_domestic",
      expectedTotalKobo: 9_405_000,
      acceptedTerms: true,
      contact: { email: "user@example.test", phone: "+2348012345678" },
      travellers: [{}],
    });
    expect(checkout.status).toBe(400);
    expect(await module.db.query.otaBookingsTable.findMany()).toHaveLength(0);
    const token = result.estimatedFares[0].fareCheckToken;
    expect(typeof token).toBe("string");
    const tampered = `${token[0] === "A" ? "B" : "A"}${token.slice(1)}`;
    expect(
      (
        await request("/flights/estimates/check", undefined, {
          token: tampered,
        })
      ).status,
    ).toBe(400);
    supplierFare = 90000;
    const rechecks = await Promise.all([
      request("/flights/estimates/check", undefined, { token }),
      request("/flights/estimates/check", undefined, { token }),
    ]);
    for (const refreshed of rechecks) {
      expect(refreshed.status).toBe(200);
      expect(await refreshed.json()).toEqual({
        status: "available",
        match: "same_offer",
        estimatedTotalKobo: 9_900_000,
      });
    }
    expect(
      (await request("/admin/fare-changes?mode=test", "admin")).status,
    ).toBe(403);
    const live = await request("/admin/fare-changes?mode=live", "super");
    expect((await live.json()).changes).toEqual([]);
    const sandbox = await request("/admin/fare-changes?mode=test", "super");
    const { changes } = await sandbox.json();
    expect(changes).toHaveLength(1);
    expect(changes[0].details).toMatchObject({
      previousSupplierKobo: 8_550_000,
      currentSupplierKobo: 9_000_000,
      previousTotalKobo: 9_405_000,
      currentTotalKobo: 9_900_000,
    });
    expect(JSON.stringify(changes)).not.toContain("OF_domestic");
  });
  it("reports confirmed earnings from the saved checkout and separates sandbox and live", async () => {
    const settings = await request(
      "/admin/settings",
      "super",
      {
        flightMarkupPercent: 10,
        bilalMarkupPercent: 15,
      },
      "PUT",
    );
    expect(settings.status).toBe(200);
    const preview = await request("/admin/price-preview", "super", {
      kind: "bilalsadasub",
      amount: "10000",
      currency: "NGN",
      pricing: {
        rates: { NGN: 1 },
        flightMarkupPercent: 10,
        bilalMarkupPercent: 15,
      },
    });
    expect((await preview.json()).pricing.totalKobo).toBe(1_150_000);
    amount = 11_000_000;
    await create(false, amount);
    expect(
      (await request(`/bookings/${booking.id}/complete`, "user", {})).status,
    ).toBe(200);
    expect((await request("/admin/earnings?mode=test", "admin")).status).toBe(
      403,
    );
    const live = await request("/admin/earnings", "super");
    expect((await live.json()).totals).toMatchObject({
      bookingCount: 0,
      grossKobo: "0",
    });
    const sandbox = await request("/admin/earnings?mode=test", "super");
    expect(sandbox.status).toBe(200);
    expect(await sandbox.json()).toMatchObject({
      totals: {
        bookingCount: 1,
        paidKobo: "11000000",
        supplierKobo: "10000000",
        grossKobo: "1000000",
      },
      bookings: [{ id: booking.id, grossKobo: "1000000" }],
      nextOffset: null,
    });
    await module.db
      .update(module.otaBookingsTable)
      .set({ status: "refunded" })
      .where(eq(module.otaBookingsTable.id, booking.id));
    const afterRefund = await request("/admin/earnings?mode=test", "super");
    expect((await afterRefund.json()).totals).toMatchObject({
      bookingCount: 0,
      grossKobo: "0",
    });
  });
  it("does not return a saved payment link if the booking changes during the supplier check", async () => {
    await create();
    expect(
      (await request(`/bookings/${booking.id}/pay`, "user", {})).status,
    ).toBe(200);
    const fallback = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        if (String(input).includes("api.duffel.com/air/offers/"))
          await module.db
            .update(module.otaBookingsTable)
            .set({ status: "processing" })
            .where(eq(module.otaBookingsTable.id, booking.id));
        return fallback(input, init);
      }),
    );
    const stale = await request(`/bookings/${booking.id}/pay`, "user", {});
    expect(stale.status).toBe(409);
    expect(await stale.json()).not.toHaveProperty("authorizationUrl");
  });
  it("prevents an expired payment worker from clearing a replacement lease", async () => {
    await create();
    const { enqueuePayment, processOtaPayments } =
      await import("../src/services/ota/paymentQueue");
    const jobs = module.otaPaymentJobsTable;
    const replacementLease = new Date(Date.now() + 600000);
    await enqueuePayment(booking.reference, booking.id);
    const fallback = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        if (String(input).includes("api.paystack.co/transaction/verify/")) {
          await module.db
            .update(jobs)
            .set({ attempts: 2, lockedUntil: replacementLease })
            .where(eq(jobs.reference, booking.reference));
          return Response.json({ status: false }, { status: 503 });
        }
        return fallback(input, init);
      }),
    );
    await processOtaPayments();
    const job = await module.db.query.otaPaymentJobsTable.findFirst();
    expect(job).toMatchObject({
      attempts: 2,
      lockedUntil: replacementLease,
      lastError: null,
    });
  });
  it("restricts launch diagnostics to super admins and reports optional key storage", async () => {
    expect((await request("/admin/check", "admin", {})).status).toBe(403);
    const response = await request("/admin/check", "super", {});
    expect(response.status).toBe(200);
    const { results } = await response.json();
    expect(results.database).toBe("passed");
    expect(results.apiKeys).toBe("passed");
    expect(results.stays).toContain("not verified");
    expect(JSON.stringify(results)).not.toMatch(
      /duffel_test_fake|sk_test_fake/,
    );
    expect(supplierCalls).toBe(0);
  });
  it("rejects malformed callback origins before creating or initializing checkout", async () => {
    await create();
    const previous = process.env.APP_URL;
    try {
      process.env.APP_URL = "https://example.test?next=elsewhere";
      const response = await request(`/bookings/${booking.id}/pay`, "user", {});
      expect(response.status).toBe(503);
      expect((await response.json()).error).toContain("callback");
      expect(supplierCalls).toBe(0);
      const { saveOtaConfig } = await import("../src/services/ota/config");
      await expect(
        saveOtaConfig({ salesEnabled: true }, "super"),
      ).rejects.toThrow("HTTPS APP_URL");
    } finally {
      process.env.APP_URL = previous;
    }
  });
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
    supplierCancelled = false;
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
  it("blocks enabling live sales without a webhook secret, including environment-enabled checkout", async () => {
    await module.db.insert(module.siteSettingsTable).values({
      id: randomUUID(),
      key: "paystack_secret_key",
      value: "sk_live_test_fixture",
    });
    const settings = await request(
      "/admin/settings",
      "super",
      {
        mode: "live",
        duffelLiveToken: "duffel_live_test_fixture",
        salesEnabled: true,
      },
      "PUT",
    );
    expect(settings.status).toBe(503);
    expect((await settings.json()).error).toContain("webhook signing secret");
    await module.db
      .update(module.siteSettingsTable)
      .set({
        value: {
          mode: "live",
          flightsEnabled: true,
          salesEnabled: true,
          supportEmail: "help@example.test",
        },
      })
      .where(eq(module.siteSettingsTable.key, "ota_config"));
    const checkout = await request("/bookings", "user", {
      kind: "flight",
      offerId: "off_test",
      expectedTotalKobo: 10000000,
      acceptedTerms: true,
      contact: { email: "user@example.test", phone: "+2348012345678" },
      travellers: [{}],
    });
    expect(checkout.status).toBe(503);
    expect((await checkout.json()).error).toContain("webhook signing secret");
    expect(supplierCalls).toBe(0);
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
    const refreshed = await request(
      `/bookings/${booking.id}/refresh`,
      "user",
      {},
    );
    expect((await refreshed.json()).booking.status).toBe("confirmed");
    const reconciled = await request(
      `/admin/bookings/${booking.id}/reconcile`,
      "super",
      { providerId: "bok_test" },
    );
    expect(reconciled.status).toBe(200);
    expect(supplierCalls).toBe(1);
  });
  it("reconciles an accepted Stays reservation without repeating the purchase", async () => {
    const response = await request("/bookings", "user", {
      kind: "hotel",
      offerId: "quo_test",
      expectedTotalKobo: 10000000,
      acceptedTerms: true,
      contact: { email: "user@example.test", phone: "+2348012345678" },
      travellers: [{ given_name: "Test", family_name: "Guest" }],
    });
    expect(response.status).toBe(201);
    booking = (await response.json()).booking;

    hotelQuotePayNow = false;
    expect(
      (await request(`/bookings/${booking.id}/pay`, "user", {})).status,
    ).toBe(409);
    expect(fetch).not.toHaveBeenCalledWith(
      "https://api.paystack.co/transaction/initialize",
      expect.anything(),
    );
    hotelQuotePayNow = true;

    hotelBookingStatus = 202;
    const complete = () =>
      request(`/bookings/${booking.id}/complete`, "user", {});
    expect((await (await complete()).json()).booking.status).toBe(
      "requires_review",
    );
    const pending = await module.db.query.otaBookingsTable.findFirst();
    expect(pending?.providerBookingId).toBeNull();
    expect(pending?.providerRequestId).toBe("hotel-request");
    await complete();
    supplierSnapshotPatch = {
      accommodation: {
        rooms: [{ rates: [{ total_amount: "101.00", total_currency: "GBP" }] }],
      },
    };
    const mismatch = await request(
      `/admin/bookings/${booking.id}/reconcile`,
      "super",
      { providerId: "bok_test" },
    );
    expect(mismatch.status).toBe(409);
    supplierSnapshotPatch = {};
    await deliverDuffel("stays.booking.created", {
      booking_id: "bok_test",
      quote_id: "quo_test",
    });
    expect((await module.db.query.otaBookingsTable.findFirst())?.status).toBe(
      "confirmed",
    );
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
  it("rejects a payment redirect initialized for a different reference", async () => {
    await create();
    paystackReferenceMismatch = true;
    const response = await request(`/bookings/${booking.id}/pay`, "user", {});
    expect(response.status).toBe(502);
    expect(
      (await module.db.query.otaBookingsTable.findFirst())?.authorizationUrl,
    ).toBeNull();
    expect(supplierCalls).toBe(0);
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

it("includes the airline reference and operating carrier in a confirmation email", async () => {
  await create();
  await request(`/bookings/${booking.id}/complete`, "user", {});
  supplierSnapshotPatch = {
    slices: [{ segments: [{
      origin: { iata_code: "LOS" },
      destination: { iata_code: "LHR" },
      departing_at: "2026-12-01T12:00:00",
      arriving_at: "2026-12-01T18:00:00",
      operating_carrier: { name: "A & B Airways" },
    }] }],
  };
  await request(`/bookings/${booking.id}/refresh`, "user", {});
  const { sendEmail } = await import("../src/utils/email");
  vi.mocked(sendEmail).mockClear();
  await (await import("../src/services/ota/maintenance")).maintainOta();
  const email = vi.mocked(sendEmail).mock.calls[0]?.[0];
  expect(email?.text).toContain("Supplier reference: ABC123");
  expect(email?.text).toContain("LOS 2026-12-01T12:00:00 → LHR 2026-12-01T18:00:00");
  expect(email?.html).toContain("Operated by A &amp; B Airways");
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

it("rejects mismatched supplier snapshots without replacing a confirmed itinerary", async () => {
  await create();
  await request(`/bookings/${booking.id}/complete`, "user", {});
  const { refreshBooking } = await import("../src/services/ota/booking");
  const original = (await module.db.query.otaBookingsTable.findFirst())!;
  for (const patch of [
    { metadata: { ota_booking_id: "another-checkout" } },
    { total_amount: "1.00" },
    { total_currency: "USD" },
    { live_mode: true },
  ]) {
    supplierSnapshotPatch = patch;
    await expect(refreshBooking(original)).rejects.toThrow(
      "Provider record mismatch",
    );
    const saved = (await module.db.query.otaBookingsTable.findFirst())!;
    expect(saved.revision).toBe(original.revision);
    expect(saved.providerResult).toEqual(original.providerResult);
  }
  expect(supplierCalls).toBe(1);
});

it("rejects opposite-mode supplier data during manual and webhook reconciliation", async () => {
  await create();
  await request(`/bookings/${booking.id}/complete`, "user", {});
  const original = (await module.db.query.otaBookingsTable.findFirst())!;
  supplierSnapshotPatch = { live_mode: true };
  expect(
    (
      await request(`/admin/bookings/${booking.id}/reconcile`, "super", {
        providerId: "ord_test",
      })
    ).status,
  ).toBe(409);
  await deliverDuffel("order.created", { id: "ord_test" });
  const saved = (await module.db.query.otaBookingsTable.findFirst())!;
  expect(saved.revision).toBe(original.revision);
  expect(
    (await module.db.query.otaDuffelEventsTable.findFirst())?.issue,
  ).toBeTruthy();
});

it("rejects concurrent stale OTA setting saves instead of losing a credential rotation", async () => {
  const { saveOtaConfig, getOtaConfig } =
    await import("../src/services/ota/config");
  const query = module.db.query.siteSettingsTable;
  const original = query.findFirst.bind(query);
  let arrived = 0;
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const spy = vi
    .spyOn(query, "findFirst")
    .mockImplementation(async (...args: any[]) => {
      const row = await (original as any)(...args);
      if (arrived < 2) {
        arrived++;
        if (arrived === 2) release();
        await barrier;
      }
      return row;
    });
  let outcomes: PromiseSettledResult<any>[];
  try {
    outcomes = await Promise.allSettled([
      saveOtaConfig({ duffelTestToken: "duffel_test_rotated" }, "super"),
      saveOtaConfig({ serviceFeeNgn: 250 }, "super"),
    ]);
  } finally {
    spy.mockRestore();
  }
  expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const failure = outcomes.find(
    (r) => r.status === "rejected",
  ) as PromiseRejectedResult;
  expect(failure.reason.status).toBe(409);
  // Retrying the rejected partial change after refreshing preserves both edits.
  if (outcomes[0].status === "rejected")
    await saveOtaConfig({ duffelTestToken: "duffel_test_rotated" }, "super");
  else await saveOtaConfig({ serviceFeeNgn: 250 }, "super");
  const config = await getOtaConfig();
  expect(config.duffelTestToken).toBe("duffel_test_rotated");
  expect(config.serviceFeeNgn).toBe(250);
});

it("emails a verified full refund even when an earlier cancellation notice was already sent", async () => {
  await create();
  await module.db
    .update(module.otaBookingsTable)
    .set({
      status: "cancelled",
      paidAt: new Date(),
      notificationSentAt: new Date(),
    })
    .where(eq(module.otaBookingsTable.id, booking.id));
  expect(
    (
      await request(`/admin/bookings/${booking.id}/refund-record`, "super", {
        refundId: "77",
        supplierResolved: true,
        note: "Supplier cancellation has been verified",
      })
    ).status,
  ).toBe(200);
  expect(
    (await module.db.query.otaBookingsTable.findFirst())?.notificationSentAt,
  ).toBeNull();
  const { sendEmail } = await import("../src/utils/email");
  vi.mocked(sendEmail).mockClear();
  await (await import("../src/services/ota/maintenance")).maintainOta();
  expect(
    vi
      .mocked(sendEmail)
      .mock.calls.some(([message]) =>
        message.subject.includes("fully refunded"),
      ),
  ).toBe(true);
  expect(
    (await module.db.query.otaBookingsTable.findFirst())?.notificationSentAt,
  ).toBeTruthy();
});

describe("EHajj admin integration", () => {
  const upstream = "https://ehajj.example.test/mobile";
  const calls: {
    path: string;
    headers: Headers;
    method?: string;
    form?: Record<string, FormDataEntryValue>;
  }[] = [];
  let registrationFails = false;
  const documents = {
    id_document: 1,
    description: "Visa",
    piece_jointe: "https://files.example.test/private.pdf",
  };
  const responses: Record<string, unknown> = {
    getAllProduitsAgence: [
      {
        id_produit: 12,
        libelle_produit: "Assigned programme",
        activite_produit: "HADJ",
        edition: "2026",
      },
      {
        id_produit: 13,
        libelle_produit: "Other programme",
        activite_produit: "OUMRAH",
        edition: "2026",
      },
    ],
    "getPelerinsByProduit/12": [
      {
        id_pelerin: 101,
        prenom_pelerin: "Test",
        nom_pelerin: "Pilgrim",
        amount_paid: 150,
        rest: 50,
      },
    ],
    "getPelerinDetails/101": {
      civilite_pelerin: { prenom: "Test", groupe_ethenique: "excluded" },
      package: { designation: "Standard", tarif: 200 },
      passeport: { numero: "TEST5678" },
    },
    "getPelerinVersement/101": {
      total_a_payer: 200,
      total_verse: 150,
      reste_a_payer: 50,
      versements: [],
    },
    "getVoyagePelerin/101": {
      lieu_depart_aller: "LOS",
      lieu_arrivee_aller: "JED",
    },
    "getHebergementPelerin/101": {
      hebergement_makkah: { batiment: "Hotel" },
      hebergement_medine: "Non attribue",
    },
    "getPelerinServiceAdd/101":
      "Aucun service additionnel trouve pour ce pelerin.",
    "getPelerinGroupe/101": {
      groupe: { nom_groupe: "Group A" },
      membres_groupe: [{ nom_complet: "Other agency member" }],
    },
    "getDocumentsPelerin/101": [documents],
    getAllBanquesAgence: [{ id_banque: 3, nom_banque: "Agency bank" }],
    getAllComptesBancairesAgence: [
      {
        id_compte_bancaire: 5,
        libelle_compte_bancaire: "Agency account",
        numero_compte_bancaire: "TEST12345",
        nom_banque: "Agency bank",
      },
    ],
    addPelerin: {
      id_pelerin: 245,
      numero_pelerin: 37,
      pelerin_uuid: "test-pilgrim",
      id_versement_pelerin: 512,
      code_versement_pelerin: 58,
      reste_a_verse: 100000,
    },
  };

  function request(
    path: string,
    user?: string,
    method = "GET",
    body?: unknown,
  ) {
    return httpFetch(baseUrl.replace(/\/ota$/, "/admin/ehajj") + path, {
      method,
      headers: {
        ...(user ? { "x-test-user": user } : {}),
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  beforeEach(async () => {
    vi.stubEnv("EHAJJ_API_BASE_URL", upstream);
    vi.stubEnv("EHAJJ_AGENCY_KEY", "");
    await module.db.delete(module.ehajjRegistrationsTable);
    await module.db.delete(module.ehajjGrantsTable);
    await module.db.delete(module.ehajjConnectionsTable);
    calls.length = 0;
    registrationFails = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        if (!url.startsWith(upstream + "/api/"))
          throw new Error("Unexpected fetch in EHajj test");
        const endpoint = url.slice((upstream + "/api/").length);
        calls.push({
          path: endpoint,
          headers: new Headers(init?.headers),
          method: init?.method,
          ...(init?.body instanceof FormData
            ? { form: Object.fromEntries(init.body.entries()) }
            : {}),
        });
        if (endpoint === "addPelerin" && registrationFails)
          throw new Error("Lost response after provider commit");
        if (!(endpoint in responses))
          return Response.json({ code: 404, data: null }, { status: 404 });
        return Response.json({ code: 200, data: responses[endpoint] });
      }),
    );
  });

  async function connect() {
    const response = await request("/settings", "super", "PUT", {
      version: null,
      enabled: true,
      agencyKey: "fixture-agency",
      jwt: "fixture-jwt",
    });
    expect(response.status).toBe(200);
    const settings = await response.json();
    expect(settings).toMatchObject({
      hasAgencyKey: true,
      hasJwt: true,
      enabled: true,
    });
    expect(JSON.stringify(settings)).not.toContain("fixture-");
    return settings;
  }

  it("reports provider setup before fetching products and explains the HTTPS requirement", async () => {
    expect(await (await request("/settings", "super")).json()).toMatchObject({
      enabled: false, saved: false,
    });
    const missing = await request("/products", "super");
    expect(missing.status).toBe(503);
    expect(await missing.json()).toMatchObject({ error: expect.stringContaining("Save and enable") });
    vi.stubEnv("EHAJJ_API_BASE_URL", "http://ehajj.example.test/mobile");
    const insecure = await request("/products", "super");
    expect(insecure.status).toBe(503);
    expect(await insecure.json()).toMatchObject({ error: expect.stringContaining("HTTPS") });
    expect(calls).toHaveLength(0);
  });

  it("releases an encrypted PDF to the verified booking owner without contacting EHajj", async () => {
    const bookingId = await packageFixture(["payment-one", "payment-two"]);
    const reference = "RDH-DELIVERY-TEST";
    const url = baseUrl.replace(/\/ota$/, "/admin/ehajj/delivery/bookings/") + reference;
    const pdf = "%PDF-1.7\nPrivate fixture\n%%EOF";
    await module.db.update(module.bookingsTable).set({ reference, status: "confirmed" })
      .where(eq(module.bookingsTable.id, bookingId));
    const release = (user: string, recipientId = "user") => {
      const body = new FormData();
      body.set("type", "visa");
      body.set("bookingId", bookingId);
      body.set("recipientId", recipientId);
      body.set("confirmed", "yes");
      body.set("file", new Blob([pdf], { type: "application/pdf" }), "visa.pdf");
      return httpFetch(url, { method: "POST", headers: { "x-test-user": user }, body });
    };
    expect((await release("admin")).status).toBe(403);
    expect((await release("super")).status).toBe(409);
    await module.db.update(module.paymentsTable).set({ status: "verified" })
      .where(eq(module.paymentsTable.bookingId, bookingId));
    const lookup = await request("/delivery/bookings/" + reference, "super");
    expect(await lookup.json()).toMatchObject({ booking: { id: bookingId, recipientId: "user", eligible: true } });
    expect((await release("super", "other")).status).toBe(409);
    const response = await release("super");
    expect(response.status).toBe(201);
    const { id } = await response.json();
    const { uploadToR2 } = await import("../src/lib/r2");
    expect(uploadToR2).toHaveBeenLastCalledWith("ehajj-private/" + id + "/payload", expect.any(Buffer), "application/octet-stream");
    const [, stored] = vi.mocked(uploadToR2).mock.lastCall!;
    expect(stored.toString()).toMatch(/^enc:v1:/);
    expect(stored.includes(Buffer.from(pdf))).toBe(false);
    const root = baseUrl.replace(/\/ota$/, "");
    const docPath = "/documents/" + id + "/ehajj-download";
    expect((await httpFetch(root + docPath)).status).toBe(401);
    for (const user of ["other", "admin", "super"])
      expect((await httpFetch(root + docPath, { headers: { "x-test-user": user } })).status).toBe(404);
    expect((await httpFetch(root + "/files/ehajj-private/" + encodeURIComponent(id + "/payload"))).status).toBe(404);
    const downloaded = await httpFetch(root + docPath, { headers: { "x-test-user": "user" } });
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get("cache-control")).toBe("private, no-store");
    expect(downloaded.headers.get("content-disposition")).toContain("attachment");
    expect(await downloaded.text()).toBe(pdf);
    expect(await module.db.query.notificationsTable.findFirst()).toMatchObject({ userId: "user", type: "document", link: "/dashboard/documents" });
    expect(calls).toHaveLength(0);
  });

  it("requires Super Admin for credential changes and invalidates grants on agency key replacement", async () => {
    expect((await request("/access")).status).toBe(401);
    expect((await request("/access", "user")).status).toBe(403);
    expect((await request("/settings", "admin")).status).toBe(403);
    const settings = await connect();
    const stored = await module.db.query.ehajjConnectionsTable.findFirst();
    expect(stored?.agencyKey).toMatch(/^enc:v1:/);
    expect(stored?.jwt).toMatch(/^enc:v1:/);
    expect(
      (
        await request("/grants", "admin", "PUT", {
          userId: "admin",
          productId: 12,
          permissions: ["finance"],
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request("/grants", "super", "PUT", {
          userId: "admin",
          productId: 12,
          permissions: ["pilgrims"],
        })
      ).status,
    ).toBe(200);
    expect(await (await request("/access", "admin")).json()).toMatchObject({
      allowed: true,
      manage: false,
    });
    const changed = await request("/settings", "super", "PUT", {
      version: settings.version,
      enabled: true,
      agencyKey: "new-fixture-agency",
    });
    expect(changed.status).toBe(200);
    expect(await changed.json()).toMatchObject({ hasJwt: false });
    expect(await (await request("/access", "admin")).json()).toMatchObject({
      allowed: false,
    });
    expect(
      (
        await request("/settings", "super", "PUT", {
          version: settings.version,
          enabled: false,
        })
      ).status,
    ).toBe(409);
  });

  it("scopes product and pilgrim reads and redacts finance and document fields", async () => {
    await connect();
    expect((await request("/products", "admin")).status).toBe(403);
    expect(
      (
        await request("/grants", "super", "PUT", {
          userId: "admin",
          productId: 12,
          permissions: ["pilgrims", "operations"],
        })
      ).status,
    ).toBe(200);
    const products = await (await request("/products", "admin")).json();
    expect(
      products.products.map((product: { id: number }) => product.id),
    ).toEqual([12]);
    expect((await request("/products/13/pilgrims", "admin")).status).toBe(403);
    const roster = await (
      await request("/products/12/pilgrims", "admin")
    ).json();
    expect(roster.pilgrims[0].fields).toEqual({
      "First name": "Test",
      "Last name": "Pilgrim",
    });
    expect(
      (await request("/products/12/pilgrims/101/payments", "admin")).status,
    ).toBe(403);
    expect(
      (await request("/products/12/pilgrims/102/profile", "admin")).status,
    ).toBe(404);
    const profile = await (
      await request("/products/12/pilgrims/101/profile", "admin")
    ).json();
    expect(profile.sections[0].fields).toEqual({ "First name": "Test" });
    expect(JSON.stringify(profile)).not.toMatch(/Tariff|Passport|excluded/);
    expect(
      calls
        .find((call) => call.path === "getAllProduitsAgence")
        ?.headers.get("authorization"),
    ).toBeNull();
    const detail = calls.find((call) => call.path === "getPelerinDetails/101");
    expect(detail?.method).toBe("GET");
    expect(detail?.headers.get("authorizationagencekey")).toBe(
      "fixture-agency",
    );
    expect(detail?.headers.get("authorization")).toBe("Bearer fixture-jwt");
    expect(calls.some((call) => call.path === "getPelerinDetails/102")).toBe(
      false,
    );
  });

  it("reads documented detail shapes while keeping provider document URLs and member data private", async () => {
    await connect();
    for (const view of [
      "travel",
      "accommodation",
      "services",
      "group",
      "payments",
      "documents",
    ]) {
      const response = await request(
        "/products/12/pilgrims/101/" + view,
        "super",
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.sections).toBeInstanceOf(Array);
      expect(JSON.stringify(body)).not.toMatch(
        /https:\/\/files|Other agency member/,
      );
      if (view === "services") expect(body.sections).toEqual([]);
      if (view === "accommodation")
        expect(body.sections[1].fields).toEqual({ Assignment: "Unassigned" });
      if (view === "documents")
        expect(body.sections[0].fields.Attachment).toBe("Reported by EHajj");
    }
  });

  async function standaloneFixture() {
    await connect();
    await module.db.update(module.ehajjConnectionsTable).set({ jwt: null });
    return {
      firstName: "Test",
      lastName: "Pilgrim",
      gender: "f",
      passportNumber: "TEST12345",
      phone: "+2348012345678",
      packageId: 88,
      amount: "1500000",
      currency: "XOF",
      paymentMethod: 3,
      paymentReference: "EXTERNAL-RECEIPT-1",
      sourceBankId: 3,
      destinationAccountId: 5,
      accountingConfirmed: true,
    };
  }

  it("registers an independent pilgrim and external first payment exactly once", async () => {
    const input = await standaloneFixture();
    expect((await request("/payment-options", "admin")).status).toBe(403);
    expect(
      (await request("/registrations/prepare", "admin", "POST", input)).status,
    ).toBe(403);
    const response = await request(
      "/registrations/prepare",
      "super",
      "POST",
      input,
    );
    expect(response.status).toBe(200);
    const { registration } = await response.json();
    const rows = await module.db.select().from(module.ehajjRegistrationsTable);
    expect(rows[0].payload).toMatch(/^enc:v1:/);
    expect(rows[0].payload).not.toContain("TEST12345");
    expect(calls).toHaveLength(0);
    const results = await Promise.all(
      [1, 2].map(() =>
        request(
          "/registrations/" + registration.id + "/submit",
          "super",
          "POST",
          { confirmed: true, version: registration.version },
        ),
      ),
    );
    expect(results.every((result) => result.ok)).toBe(true);
    const sent = calls.filter((call) => call.path === "addPelerin");
    expect(sent).toHaveLength(1);
    expect(sent[0].headers.get("authorization")).toBeNull();
    expect(sent[0].headers.get("authorizationagencekey")).toBe(
      "fixture-agency",
    );
    expect(sent[0].headers.has("content-type")).toBe(false);
    expect(sent[0].form).toMatchObject({
      first_name: "Test",
      last_name: "Pilgrim",
      gender: "f",
      passport_number: "TEST12345",
      package_id: "88",
      payment_amount: "1500000",
      payment_method: "3",
      payment_reference: "EXTERNAL-RECEIPT-1",
      source_bank_id: "3",
      destination_bank_account_id: "5",
    });
    expect(sent[0].form).not.toHaveProperty("currency");
    expect(await module.db.select().from(module.paymentsTable)).toHaveLength(0);
    expect(await module.db.select().from(module.bookingsTable)).toHaveLength(0);
    expect(
      (await module.db.query.ehajjRegistrationsTable.findFirst())?.state,
    ).toBe("confirmed");
    expect(
      (await request("/registrations/prepare", "super", "POST", input)).status,
    ).toBe(409);
    expect(
      (await (await request("/registrations", "super")).json()).registrations[0]
        .result.id_pelerin,
    ).toBe(245);
    expect((await request("/registrations", "admin")).status).toBe(403);
    expect((await request("/handoff?reference=anything", "super")).status).toBe(
      404,
    );
  });

  it("requires fresh confirmation after a prepared registration is edited", async () => {
    const input = await standaloneFixture();
    const first = (
      await (
        await request("/registrations/prepare", "super", "POST", input)
      ).json()
    ).registration;
    const second = (
      await (
        await request("/registrations/prepare", "super", "POST", {
          ...input,
          amount: "1400000",
        })
      ).json()
    ).registration;
    expect(second.id).toBe(first.id);
    expect(second.version).not.toBe(first.version);
    expect(
      (
        await request(
          "/registrations/" + first.id + "/submit",
          "super",
          "POST",
          { confirmed: true, version: first.version },
        )
      ).status,
    ).toBe(409);
    expect(calls).toHaveLength(0);
    expect(
      (
        await request(
          "/registrations/" + second.id + "/submit",
          "super",
          "POST",
          { confirmed: true, version: second.version },
        )
      ).status,
    ).toBe(200);
    expect(
      calls.find((call) => call.path === "addPelerin")?.form?.payment_amount,
    ).toBe("1400000");
  });

  it("holds an uncertain registration and prevents duplicate external payment records", async () => {
    const input = await standaloneFixture();
    const { registration } = await (
      await request("/registrations/prepare", "super", "POST", input)
    ).json();
    registrationFails = true;
    const submit = () =>
      request(
        "/registrations/" + registration.id + "/submit",
        "super",
        "POST",
        { confirmed: true, version: registration.version },
      );
    expect((await (await submit()).json()).registration.state).toBe(
      "requires_review",
    );
    await submit();
    expect(calls.filter((call) => call.path === "addPelerin")).toHaveLength(1);
  });

  it("validates declared payment details and rejects unexpected gateway linkage", async () => {
    const input = await standaloneFixture();
    for (const invalid of [
      { ...input, amount: "0" },
      { ...input, paymentReference: undefined },
      { ...input, destinationAccountId: undefined },
      { ...input, accountingConfirmed: false },
      { ...input, paymentId: "paystack-record" },
    ])
      expect(
        (await request("/registrations/prepare", "super", "POST", invalid))
          .status,
      ).toBe(400);
    expect(calls).toHaveLength(0);
    const cash = { ...input, paymentMethod: 1, paymentReference: undefined };
    expect(
      (await request("/registrations/prepare", "super", "POST", cash)).status,
    ).toBe(200);
  });

  it("holds insecure connections and rejects cross-origin financial mutations", async () => {
    await connect();
    vi.stubEnv("EHAJJ_API_BASE_URL", "http://5.196.194.160/ehadj/api_mobile");
    const settings = await (await request("/settings", "super")).json();
    expect(settings.baseUrl).toBeNull();
    expect(settings.transportIssue).toContain("HTTPS");
    expect((await request("/products", "super")).status).toBe(503);
    const crossOrigin = await httpFetch(
      baseUrl.replace(/\/ota$/, "/admin/ehajj/settings"),
      {
        method: "PUT",
        headers: {
          "x-test-user": "super",
          "Content-Type": "application/json",
          Origin: "https://untrusted.example",
        },
        body: JSON.stringify({ version: null, enabled: false }),
      },
    );
    expect(crossOrigin.status).toBe(403);
    expect(calls).toHaveLength(0);
  });
});
