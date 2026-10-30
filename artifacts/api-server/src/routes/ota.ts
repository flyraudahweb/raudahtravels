import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  db,
  profilesTable,
  otaBookingsTable as bookings,
  otaEventsTable,
  notificationsTable,
} from "@workspace/db";
import { and, eq, desc, sql, like } from "drizzle-orm";
import { customerTimeline } from "../services/ota/bookingUpdates";
import {
  getOtaConfig,
  saveOtaConfig,
  safeConfig,
  configSchema,
} from "../services/ota/config";
import {
  duffelRequest,
  prepaidRate,
  assertHotelQuote,
  price,
  available,
  expiration,
  OtaError,
  sameSupplierAmount,
  validateRefundPayment,
} from "../services/ota/provider";
import {
  audit,
  customerBooking,
  fulfill,
  paystackKey,
  paystackRequest,
  refreshBooking,
} from "../services/ota/booking";
import { enqueuePayment } from "../services/ota/paymentQueue";
import { referenceRates } from "../services/ota/exchangeRates";
import {
  receiveDuffel,
  receiverReadiness,
  webhookStatus,
  registerWebhook,
  controlWebhook,
  recentDuffelEvents,
  retryDuffelEvent,
  webhookUrl,
  modeConfig,
} from "../services/ota/duffelWebhooks";
import { DUFFEL_EVENTS } from "../services/ota/duffelWebhookProtocol";
import { providerTransactionId } from "../services/payments/paystackProof";
import {
  optionalSearchApiKey,
  listApiKeys,
  createApiKey,
  revokeApiKey,
} from "../services/ota/apiKeys";
import {
  otaOpenApi,
  mobileIntegrationGuide,
} from "../services/ota/apiDocumentation";
import {
  otaPostmanCollection,
  otaPostmanEnvironment,
} from "../services/ota/apiDeveloperTools";
import { MOBILE_CLIENT_FILES } from "../services/ota/mobileClientAssets";

const router = Router();
const endpoint =
  (fn: (req: Request, res: Response) => Promise<any>) =>
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: "Please check your travel details.",
          fields: error.issues.map((i) => i.path.join(".")),
        });
        return;
      }
      res.status(error instanceof OtaError ? error.status : 503).json({
        error:
          error instanceof OtaError
            ? error.message
            : "Travel services are temporarily unavailable. Please contact support.",
      });
    }
  };
async function identity(req: Request, superOnly = false) {
  const userId = getAuth(req).userId;
  if (!userId) throw new OtaError("Sign in to continue", 401);
  const profile = await db.query.profilesTable.findFirst({
    where: eq(profilesTable.clerkUserId, userId),
  });
  if (
    !profile ||
    profile.accountStatus !== "active" ||
    (superOnly && profile.role !== "super_admin")
  )
    throw new OtaError("Access denied", 403);
  return { userId, profile };
}
async function owned(req: Request) {
  const { userId } = await identity(req);
  const row = await db.query.otaBookingsTable.findFirst({
    where: and(
      eq(bookings.id, String(req.params.id)),
      eq(bookings.clerkUserId, userId),
    ),
  });
  if (!row) throw new OtaError("Booking not found", 404);
  return row;
}
// Bounded in-memory burst control; production multi-instance deployments should
// additionally apply a shared rate limit at their reverse proxy.
const bursts = new Map<string, { count: number; reset: number }>();
// Isolates in-memory state between integration cases; this has no HTTP route.
export function resetOtaBurstState() {
  bursts.clear();
}
router.use("/ota", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (
    req.path === "/payments/webhook" ||
    req.path.startsWith("/duffel/webhook/")
  ) {
    next();
    return;
  }
  const origin = req.get("origin");
  if (origin && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const allowed = [
      process.env.APP_URL,
      ...(process.env.CORS_ORIGIN || "")
        .split(",")
        .map((value) => value.trim()),
      ...(process.env.NODE_ENV !== "production"
        ? ["http://localhost:5173", "http://127.0.0.1:5173"]
        : []),
    ]
      .filter(Boolean)
      .flatMap((value) => {
        try {
          return [new URL(value!).origin];
        } catch {
          return [];
        }
      });
    if (!allowed.includes(origin)) {
      res.status(403).json({ error: "Untrusted request origin" });
      return;
    }
  }
  let authenticatedUser: string | null = null;
  try {
    authenticatedUser = getAuth(req).userId;
  } catch {
    /* Public request without an attached session. */
  }
  const key = authenticatedUser
      ? `user:${authenticatedUser}`
      : `ip:${req.ip || "unknown"}`,
    now = Date.now();
  if (bursts.size >= 10000)
    for (const [k, v] of bursts) if (v.reset < now) bursts.delete(k);
  const entry = bursts.get(key);
  if (entry && entry.reset > now) {
    if (++entry.count > 60) {
      res
        .status(429)
        .setHeader(
          "Retry-After",
          String(Math.max(1, Math.ceil((entry.reset - now) / 1000))),
        )
        .json({ error: "Please wait a minute before trying again." });
      return;
    }
  } else {
    if (!bursts.has(key) && bursts.size >= 10000) {
      res
        .status(429)
        .setHeader("Retry-After", "60")
        .json({ error: "Travel services are busy. Please try again shortly." });
      return;
    }
    bursts.set(key, { count: 1, reset: now + 60000 });
  }
  next();
});
// Public data only. Supplier credentials, markups and payment settings stay private.
router.use("/ota", optionalSearchApiKey);
router.get(
  "/ota/capabilities",
  endpoint(async (_req, res) => {
    const c = await getOtaConfig();
    res.json({
      apiVersion: "1",
      mode: c.mode,
      currency: "NGN",
      features: {
        flightSearch: c.flightsEnabled,
        hotelSearch: c.hotelsEnabled,
        onlineCheckout: c.salesEnabled,
        bookingHistory: true,
        bookingUpdates: true,
        supportRequests: true,
        selfServiceCancellation: false,
        selfServiceExchange: false,
        multiCity: false,
        infants: false,
        ancillaries: false,
      },
      limits: {
        flightPassengers: 9,
        flightChildAgeMin: 2,
        flightChildAgeMax: 11,
        hotelAdults: 16,
        hotelChildren: 8,
        hotelRooms: 8,
        hotelNights: 99,
      },
      polling: { processingSeconds: 5, settledSeconds: 30 },
      support: { email: c.supportEmail, phone: c.supportPhone },
    });
  }),
);
router.get(
  "/ota/me",
  endpoint(async (req, res) => {
    const { profile } = await identity(req);
    res.json({
      profile: {
        id: profile.id,
        email: profile.email,
        fullName: profile.fullName,
        phone: profile.phone,
        role: profile.role,
      },
    });
  }),
);
router.post(
  "/ota/me/bootstrap",
  endpoint(async (req, res) => {
    const userId = getAuth(req).userId;
    if (!userId) throw new OtaError("Sign in to continue", 401);
    const existing = await db.query.profilesTable.findFirst({
      where: eq(profilesTable.clerkUserId, userId),
    });
    if (!existing) {
      const user = await clerkClient.users.getUser(userId);
      const email = user.primaryEmailAddress;
      if (!email || email.verification?.status !== "verified")
        throw new OtaError(
          "Add and verify an email address in your account before creating a travel profile",
          400,
        );
      await db
        .insert(profilesTable)
        .values({
          id: randomUUID(),
          clerkUserId: userId,
          email: email.emailAddress,
          fullName:
            [user.firstName, user.lastName].filter(Boolean).join(" ") ||
            user.username ||
            "Traveller",
          role: "user",
        })
        .onConflictDoNothing({ target: profilesTable.clerkUserId });
    }
    const { profile } = await identity(req);
    res.json({
      profile: {
        id: profile.id,
        email: profile.email,
        fullName: profile.fullName,
        phone: profile.phone,
        role: profile.role,
      },
    });
  }),
);
router.get(
  "/ota/exchange-rates",
  endpoint(async (_req, res) => {
    const config = await getOtaConfig();
    res.json({
      sellingRates: config.rates,
      reference: await referenceRates(Object.keys(config.rates)),
    });
  }),
);
const id = (value: unknown, prefix: string) =>
  z
    .string()
    .regex(new RegExp(`^${prefix}_[A-Za-z0-9]+$`))
    .max(128)
    .parse(value);
router.get(
  "/ota/duffel/webhook/:mode",
  endpoint(async (req, res) => {
    const ready = await receiverReadiness(
      z.enum(["test", "live"]).parse(req.params.mode),
    );
    res.status(ready.storageReady ? 200 : 503).json(ready);
  }),
);
router.post(
  "/ota/duffel/webhook/:mode",
  endpoint(async (req, res) => {
    const mode = z.enum(["test", "live"]).parse(req.params.mode);
    res.json(
      await receiveDuffel(
        (req as any).rawBody || Buffer.alloc(0),
        req.get("x-duffel-signature") || "",
        mode,
      ),
    );
  }),
);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
  );
const future = date.refine(
  (v) => v >= new Date().toISOString().slice(0, 10),
  "Choose today or a future date",
);
const contactSchema = z.object({
  email: z.string().email().max(254),
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
  specialRequests: z.string().max(1000).optional(),
});
const name = z.string().trim().min(1).max(100);
const guestSchema = z.object({
  given_name: name,
  family_name: name,
  born_on: date.optional(),
});
const passengerSchema = guestSchema.extend({
  id: z.string().regex(/^pas_[A-Za-z0-9]+$/),
  born_on: date,
  title: z.enum(["mr", "ms", "mrs", "miss", "dr"]),
  gender: z.enum(["m", "f"]),
  email: z.string().email(),
  phone_number: z.string().regex(/^\+[1-9]\d{6,14}$/),
  identity_documents: z
    .array(
      z.object({
        type: z.literal("passport"),
        unique_identifier: z.string().min(4).max(30),
        expires_on: future,
        issuing_country_code: z.string().regex(/^[A-Z]{2}$/),
      }),
    )
    .max(1)
    .optional(),
});

router.get(
  "/ota/config",
  endpoint(async (_req, res) => {
    const c = await getOtaConfig();
    res.json({
      flightsEnabled: c.flightsEnabled,
      hotelsEnabled: c.hotelsEnabled,
      salesEnabled: c.salesEnabled,
      mode: c.mode,
      supportEmail: c.supportEmail,
      supportPhone: c.supportPhone,
    });
  }),
);
router.get(
  "/ota/places",
  endpoint(async (req, res) => {
    const q = z.string().trim().min(2).max(80).parse(req.query.q);
    const c = await getOtaConfig();
    if (!c.flightsEnabled)
      throw new OtaError("Flight search is not enabled", 503);
    res.json({
      places: await duffelRequest(
        c,
        `/places/suggestions?query=${encodeURIComponent(q)}`,
      ),
    });
  }),
);
router.post(
  "/ota/flights/search",
  endpoint(async (req, res) => {
    const input = z
      .object({
        origin: z.string().regex(/^[A-Z]{3}$/),
        destination: z.string().regex(/^[A-Z]{3}$/),
        departureDate: future,
        returnDate: future.optional(),
        adults: z.number().int().min(1).max(9),
        childAges: z.array(z.number().int().min(2).max(11)).max(8).default([]),
        cabinClass: z
          .enum(["economy", "premium_economy", "business", "first"])
          .default("economy"),
      })
      .parse(req.body);
    if (
      input.origin === input.destination ||
      (input.returnDate && input.returnDate < input.departureDate) ||
      input.adults + input.childAges.length > 9
    )
      throw new OtaError("Check airports, dates and passenger count");
    const c = await getOtaConfig();
    if (!c.flightsEnabled)
      throw new OtaError("Flight search is not enabled", 503);
    const slices = [
      {
        origin: input.origin,
        destination: input.destination,
        departure_date: input.departureDate,
      },
    ];
    if (input.returnDate)
      slices.push({
        origin: input.destination,
        destination: input.origin,
        departure_date: input.returnDate,
      });
    const data = await duffelRequest(
      c,
      "/air/offer_requests?return_offers=true",
      "POST",
      {
        slices,
        cabin_class: input.cabinClass,
        passengers: [
          ...Array.from({ length: input.adults }, () => ({ type: "adult" })),
          ...input.childAges.map((age) => ({ age })),
        ],
      },
    );
    const offers = (data.offers || [])
      .map((o: any) => ({
        ...o,
        pricing: price(c, "flight", o.total_amount, o.total_currency),
      }))
      .sort((a: any, b: any) => a.pricing.totalKobo - b.pricing.totalKobo);
    res.json({ offers: offers.slice(0, 80) });
  }),
);
router.get(
  "/ota/flights/offers/:id",
  endpoint(async (req, res) => {
    const c = await getOtaConfig();
    if (!c.flightsEnabled)
      throw new OtaError("Flight search is not enabled", 503);
    const offer = await duffelRequest(
      c,
      `/air/offers/${id(req.params.id, "off")}`,
    );
    available(offer);
    res.json({
      offer,
      pricing: price(c, "flight", offer.total_amount, offer.total_currency),
    });
  }),
);
router.post(
  "/ota/hotels/search",
  endpoint(async (req, res) => {
    const input = z
      .object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        checkIn: future,
        checkOut: future,
        rooms: z.number().int().min(1).max(8),
        adults: z.number().int().min(1).max(16),
        childAges: z.array(z.number().int().min(0).max(17)).max(8).default([]),
      })
      .parse(req.body);
    const nights =
      (Date.parse(input.checkOut) - Date.parse(input.checkIn)) / 86400000;
    if (
      nights < 1 ||
      nights > 99 ||
      input.adults < input.rooms ||
      Date.parse(input.checkIn) > Date.now() + 330 * 86400000
    )
      throw new OtaError(
        "Choose 1–99 nights, a check-in within 330 days, and at least one adult per room",
      );
    const c = await getOtaConfig();
    if (!c.hotelsEnabled)
      throw new OtaError("Hotel search is not enabled", 503);
    const data = await duffelRequest(c, "/stays/search", "POST", {
      check_in_date: input.checkIn,
      check_out_date: input.checkOut,
      rooms: input.rooms,
      location: {
        radius: 10,
        geographic_coordinates: {
          latitude: input.latitude,
          longitude: input.longitude,
        },
      },
      instant_payment: true,
      guests: [
        ...Array.from({ length: input.adults }, () => ({ type: "adult" })),
        ...input.childAges.map((age) => ({ type: "child", age })),
      ],
    });
    res.json({
      results: (data.results || []).map((r: any) => ({
        ...r,
        pricing: price(
          c,
          "hotel",
          r.cheapest_rate_total_amount,
          r.cheapest_rate_currency,
        ),
      })),
    });
  }),
);
router.post(
  "/ota/hotels/rates/:id",
  endpoint(async (req, res) => {
    const c = await getOtaConfig();
    if (!c.hotelsEnabled)
      throw new OtaError("Hotel search is not enabled", 503);
    const result = await duffelRequest(
      c,
      `/stays/search_results/${id(req.params.id, "srr")}/actions/fetch_all_rates`,
      "POST",
    );
    const rooms = (result.accommodation?.rooms || []).map((room: any) => ({
      ...room,
      rates: (room.rates || []).filter(prepaidRate).map((r: any) => ({
        ...r,
        pricing: price(c, "hotel", r.total_amount, r.total_currency),
      })),
    }));
    res.json({
      result: { ...result, accommodation: { ...result.accommodation, rooms } },
    });
  }),
);
router.post(
  "/ota/hotels/quotes",
  endpoint(async (req, res) => {
    await identity(req);
    const input = z.object({ rateId: z.string() }).parse(req.body);
    const c = await getOtaConfig();
    if (!c.hotelsEnabled)
      throw new OtaError("Hotel search is not enabled", 503);
    const quote = await duffelRequest(c, "/stays/quotes", "POST", {
      rate_id: id(input.rateId, "rat"),
    });
    available(quote);
    assertHotelQuote(quote);
    res.json({
      quote,
      pricing: price(c, "hotel", quote.total_amount, quote.total_currency),
    });
  }),
);
router.get(
  "/ota/hotels/quotes/:id",
  endpoint(async (req, res) => {
    await identity(req);
    const c = await getOtaConfig();
    const quote = await duffelRequest(
      c,
      `/stays/quotes/${id(req.params.id, "quo")}`,
    );
    available(quote);
    assertHotelQuote(quote);
    res.json({
      quote,
      pricing: price(c, "hotel", quote.total_amount, quote.total_currency),
    });
  }),
);

router.post(
  "/ota/bookings",
  endpoint(async (req, res) => {
    const { userId } = await identity(req);
    const input = z
      .object({
        kind: z.enum(["flight", "hotel"]),
        offerId: z.string(),
        contact: contactSchema,
        travellers: z.array(z.unknown()).min(1).max(24),
        acceptedTerms: z.literal(true),
        expectedTotalKobo: z.number().int().positive(),
      })
      .parse(req.body);
    const c = await getOtaConfig();
    if (
      !c.salesEnabled ||
      !(input.kind === "flight" ? c.flightsEnabled : c.hotelsEnabled)
    )
      throw new OtaError(
        "Online booking is not enabled. Please contact support.",
        503,
      );
    await paystackKey(c.mode);
    const appUrl = process.env.APP_URL || "";
    if (!/^https:\/\//.test(appUrl))
      throw new OtaError("Secure payment callback URL is not configured", 503);
    const offerId = id(input.offerId, input.kind === "flight" ? "off" : "quo");
    const offer = await duffelRequest(
      c,
      input.kind === "flight"
        ? `/air/offers/${offerId}`
        : `/stays/quotes/${offerId}`,
    );
    available(offer);
    let travellers: any[];
    if (input.kind === "flight") {
      travellers = z.array(passengerSchema).parse(input.travellers);
      const required = offer.passengers || [];
      if (
        travellers.length !== required.length ||
        new Set(travellers.map((p) => p.id)).size !== required.length ||
        travellers.some((p) => !required.some((r: any) => r.id === p.id))
      )
        throw new OtaError(
          "Traveller details must match every passenger on this offer",
        );
      if (
        offer.passenger_identity_documents_required &&
        travellers.some((p) => !p.identity_documents?.length)
      )
        throw new OtaError("Passport details are required for this flight");
      for (const p of travellers) {
        const lastTravelDate = (offer.slices || [])
          .flatMap((slice: any) =>
            (slice.segments || []).map((segment: any) =>
              String(segment.arriving_at || segment.departing_at).slice(0, 10),
            ),
          )
          .sort()
          .at(-1);
        if (
          lastTravelDate &&
          p.identity_documents?.some(
            (document: any) => document.expires_on < lastTravelDate,
          )
        )
          throw new OtaError(
            "Passports must remain valid through the last flight in this itinerary. Check any additional destination validity requirements before booking.",
          );
        const departure = String(
          offer.slices?.[0]?.segments?.[0]?.departing_at ||
            new Date().toISOString(),
        ).slice(0, 10);
        const age =
          Number(departure.slice(0, 4)) -
          Number(p.born_on.slice(0, 4)) -
          (departure.slice(5) < p.born_on.slice(5) ? 1 : 0);
        const expected = required.find((r: any) => r.id === p.id);
        if (
          age < 0 ||
          age > 120 ||
          (expected?.type === "adult" && age < 12) ||
          (expected?.type === "child" && (age < 2 || age > 11)) ||
          (expected?.age != null && age !== expected.age)
        )
          throw new OtaError(
            "Traveller birth dates must match the selected passenger ages",
          );
      }
    } else {
      travellers = z.array(guestSchema).parse(input.travellers);
      if (travellers.length !== offer.guests?.length)
        throw new OtaError("Provide details for every guest in the quote");
      assertHotelQuote(offer);
    }
    const pricing = price(
      c,
      input.kind,
      offer.total_amount,
      offer.total_currency,
    );
    if (pricing.totalKobo !== input.expectedTotalKobo)
      throw new OtaError(
        "The price has changed. Refresh the offer and review the new total before paying.",
        409,
      );
    const bookingId = randomUUID(),
      reference = `OTA-${randomUUID()}`;
    const expiresAt = new Date(expiration(offer));
    const [row] = await db
      .insert(bookings)
      .values({
        id: bookingId,
        clerkUserId: userId,
        kind: input.kind,
        mode: c.mode,
        reference,
        providerOfferId: offerId,
        supplierAmount: offer.total_amount,
        supplierCurrency: offer.total_currency,
        amountKobo: pricing.totalKobo,
        pricing,
        offer,
        travellers,
        contact: input.contact,
        expiresAt,
      })
      .returning();
    await audit(row.id, userId, "checkout_created", { termsAccepted: true });
    res.status(201).json({ booking: customerBooking(row) });
  }),
);
router.post(
  "/ota/bookings/:id/pay",
  endpoint(async (req, res) => {
    const row = await owned(req),
      c = await getOtaConfig();
    if (!c.salesEnabled || c.mode !== row.mode)
      throw new OtaError("Online payments are unavailable", 503);
    if (
      row.status !== "payment_pending" ||
      row.expiresAt.getTime() <= Date.now() + 60000
    )
      throw new OtaError(
        "This checkout cannot accept payment. Please search again or view its status.",
        409,
      );
    if (!(row.kind === "flight" ? c.flightsEnabled : c.hotelsEnabled))
      throw new OtaError("This booking channel is currently unavailable", 503);
    const fresh = await duffelRequest(
      c,
      row.kind === "flight"
        ? `/air/offers/${row.providerOfferId}`
        : `/stays/quotes/${row.providerOfferId}`,
    );
    available(fresh);
    if (
      !sameSupplierAmount(fresh.total_amount, row.supplierAmount) ||
      fresh.total_currency !== row.supplierCurrency
    )
      throw new OtaError(
        "Supplier pricing has changed. Please start a new search before paying.",
        409,
      );
    if (row.authorizationUrl) {
      res.json({ authorizationUrl: row.authorizationUrl });
      return;
    }
    // Stable reference prevents concurrent initialization from creating separate charges.
    const data = await paystackRequest("/transaction/initialize", row.mode, {
      email: (row.contact as any).email,
      amount: row.amountKobo,
      currency: "NGN",
      reference: row.reference,
      callback_url: `${process.env.APP_URL!.replace(/\/$/, "")}/travel/bookings/${row.id}`,
      metadata: { otaBookingId: row.id, type: "ota_booking" },
    });
    if (
      !/^https:\/\/checkout\.paystack\.com\//.test(data.authorization_url || "")
    )
      throw new OtaError("Invalid payment redirect", 502);
    const [initialized] = await db
      .update(bookings)
      .set({
        revision: sql`${bookings.revision}+1`,
        authorizationUrl: data.authorization_url,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bookings.id, row.id),
          eq(bookings.status, "payment_pending"),
          eq(bookings.revision, row.revision),
        ),
      )
      .returning({ id: bookings.id });
    if (!initialized)
      throw new OtaError(
        "Booking changed while preparing payment. Refresh to see its current status.",
        409,
      );
    res.json({ authorizationUrl: data.authorization_url });
  }),
);
router.get(
  "/ota/bookings",
  endpoint(async (req, res) => {
    const { userId } = await identity(req);
    const offset = z.coerce
      .number()
      .int()
      .min(0)
      .max(100000)
      .default(0)
      .parse(req.query.offset);
    const rows = await db.query.otaBookingsTable.findMany({
      where: eq(bookings.clerkUserId, userId),
      orderBy: [desc(bookings.createdAt), desc(bookings.id)],
      limit: 51,
      offset,
    });
    const summary =
      await db.execute(sql`SELECT count(*) FILTER (WHERE status = 'confirmed')::int AS confirmed,
      count(*) FILTER (WHERE status = 'payment_pending' AND expires_at > now())::int AS pending,
      count(*) FILTER (WHERE status IN ('processing','requires_review') OR provider_notice IS NOT NULL)::int AS attention
      FROM ota_bookings WHERE clerk_user_id = ${userId}`);
    res.json({
      bookings: rows.slice(0, 50).map(customerBooking),
      nextOffset: rows.length > 50 ? offset + 50 : null,
      summary: summary.rows[0],
    });
  }),
);
router.get(
  "/ota/updates",
  endpoint(async (req, res) => {
    const { profile } = await identity(req);
    const offset = z.coerce
      .number()
      .int()
      .min(0)
      .max(100000)
      .default(0)
      .parse(req.query.offset);
    const updates = await db.query.notificationsTable.findMany({
      where: and(
        eq(notificationsTable.userId, profile.id),
        like(notificationsTable.id, "ota:%"),
      ),
      orderBy: [
        desc(notificationsTable.createdAt),
        desc(notificationsTable.id),
      ],
      limit: 21,
      offset,
    });
    const [count] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.userId, profile.id),
          like(notificationsTable.id, "ota:%"),
          eq(notificationsTable.isRead, false),
        ),
      );
    res.json({
      updates: updates.slice(0, 20),
      nextOffset: updates.length > 20 ? offset + 20 : null,
      unreadCount: count.count,
    });
  }),
);
router.post(
  "/ota/updates/read-all",
  endpoint(async (req, res) => {
    const { profile } = await identity(req);
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(
        and(
          eq(notificationsTable.userId, profile.id),
          like(notificationsTable.id, "ota:%"),
          eq(notificationsTable.isRead, false),
        ),
      );
    res.json({ success: true });
  }),
);
router.post(
  "/ota/updates/:id/read",
  endpoint(async (req, res) => {
    const { profile } = await identity(req);
    const updateId = z
      .string()
      .startsWith("ota:")
      .max(250)
      .parse(req.params.id);
    const [updated] = await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(
        and(
          eq(notificationsTable.id, updateId),
          eq(notificationsTable.userId, profile.id),
        ),
      )
      .returning({ id: notificationsTable.id });
    if (!updated) throw new OtaError("Travel update not found", 404);
    res.json({ success: true });
  }),
);
router.get(
  "/ota/bookings/:id/timeline",
  endpoint(async (req, res) => {
    const row = await owned(req);
    const events = await db.query.otaEventsTable.findMany({
      where: eq(otaEventsTable.bookingId, row.id),
      orderBy: desc(otaEventsTable.createdAt),
      limit: 100,
    });
    res.json({ events: customerTimeline(events) });
  }),
);
router.get(
  "/ota/bookings/:id",
  endpoint(async (req, res) => {
    res.json({ booking: customerBooking(await owned(req)) });
  }),
);
router.post(
  "/ota/bookings/:id/complete",
  endpoint(async (req, res) => {
    const row = await owned(req);
    res.json({ booking: customerBooking(await fulfill(row.reference)) });
  }),
);
router.post(
  "/ota/bookings/:id/refresh",
  endpoint(async (req, res) => {
    res.json({
      booking: customerBooking(await refreshBooking(await owned(req))),
    });
  }),
);
router.post(
  "/ota/bookings/:id/service-request",
  endpoint(async (req, res) => {
    const row = await owned(req);
    const { message } = z
      .object({ message: z.string().trim().min(10).max(2000) })
      .parse(req.body);
    await db.transaction(async (tx) => {
      await tx
        .update(bookings)
        .set({
          revision: sql`${bookings.revision}+1`,
          serviceRequest: message,
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, row.id));
      await tx.insert(otaEventsTable).values({
        id: randomUUID(),
        bookingId: row.id,
        actor: row.clerkUserId,
        action: "service_requested",
        details: { message },
      });
    });
    res.json({ success: true });
  }),
);

// This is also used by the application's existing Paystack webhook URL.
export async function otaPaymentWebhook(req: Request, res: Response) {
  try {
    const raw = (req as any).rawBody as Buffer;
    const signature = req.get("x-paystack-signature") || "";
    const hash = createHmac("sha512", await paystackKey())
      .update(raw || Buffer.alloc(0))
      .digest();
    const sig = Buffer.from(signature, "hex");
    if (sig.length !== hash.length || !timingSafeEqual(hash, sig))
      return res.status(401).json({ error: "Invalid signature" });
    if (
      req.body.event === "charge.success" &&
      req.body.data?.metadata?.otaBookingId
    )
      await enqueuePayment(
        String(req.body.data.reference),
        String(req.body.data.metadata.otaBookingId),
      );
    // Acknowledge after the durable inbox write; the worker verifies/fulfills.
    return res.json({ received: true });
  } catch {
    return res.status(503).json({ error: "Payment processing unavailable" });
  }
}
router.post("/ota/payments/webhook", otaPaymentWebhook);

router.get(
  "/ota/admin/developer/openapi",
  endpoint(async (req, res) => {
    await identity(req, true);
    res.json(otaOpenApi());
  }),
);
router.get(
  "/ota/admin/developer/guide",
  endpoint(async (req, res) => {
    await identity(req, true);
    res.type("text/markdown").send(mobileIntegrationGuide());
  }),
);
router.get(
  "/ota/admin/developer/downloads/:asset",
  endpoint(async (req, res) => {
    await identity(req, true);
    const asset = String(req.params.asset);
    if (asset === "postman-collection" || asset === "postman-environment") {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="flyraudah-ota.${asset === "postman-collection" ? "postman_collection" : "postman_environment"}.json"`,
      );
      res.json(
        asset === "postman-collection"
          ? otaPostmanCollection()
          : otaPostmanEnvironment(),
      );
      return;
    }
    if (!Object.hasOwn(MOBILE_CLIENT_FILES, asset))
      throw new OtaError("Developer download not found", 404);
    res.setHeader("Content-Disposition", `attachment; filename="${asset}"`);
    res
      .type("text/plain")
      .send(MOBILE_CLIENT_FILES[asset as keyof typeof MOBILE_CLIENT_FILES]);
  }),
);
router.get(
  "/ota/admin/developer/keys",
  endpoint(async (req, res) => {
    await identity(req, true);
    res.json(await listApiKeys());
  }),
);
router.post(
  "/ota/admin/developer/keys",
  endpoint(async (req, res) => {
    const { profile } = await identity(req, true);
    res.status(201).json(await createApiKey(req.body, profile.id));
  }),
);
router.post(
  "/ota/admin/developer/keys/:id/revoke",
  endpoint(async (req, res) => {
    const { profile } = await identity(req, true);
    res.json(await revokeApiKey(String(req.params.id), profile.id));
  }),
);
router.get(
  "/ota/admin/overview",
  endpoint(async (req, res) => {
    await identity(req, true);
    const totals = await db.execute(sql`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE status = 'confirmed')::int AS confirmed,
      count(*) FILTER (WHERE status = 'requires_review' OR service_request IS NOT NULL)::int AS attention,
      count(*) FILTER (WHERE status = 'processing')::int AS processing FROM ota_bookings`);
    const queues = await db.execute(sql`SELECT
      (SELECT count(*)::int FROM ota_duffel_events WHERE issue IS NOT NULL) AS supplier_issues,
      (SELECT count(*)::int FROM ota_payment_jobs WHERE completed_at IS NULL AND attempts >= 10) AS payment_issues,
      (SELECT max(created_at) FROM ota_duffel_events) AS last_supplier_event`);
    res.json({ totals: totals.rows[0], queues: queues.rows[0] });
  }),
);
router.get(
  "/ota/admin/settings",
  endpoint(async (req, res) => {
    await identity(req, true);
    let paystackMode = "not_configured";
    try {
      const key = await paystackKey();
      paystackMode = key.startsWith("sk_live_")
        ? "live"
        : key.startsWith("sk_test_")
          ? "test"
          : "not_configured";
    } catch {
      /* Expose presence/mode only. */
    }
    res.json({
      settings: safeConfig(await getOtaConfig()),
      paystackMode,
      webhookUrls: { test: webhookUrl("test"), live: webhookUrl("live") },
      recommendedWebhookEvents: [...DUFFEL_EVENTS],
    });
  }),
);
router.put(
  "/ota/admin/settings",
  endpoint(async (req, res) => {
    const { profile, userId } = await identity(req, true);
    const settings = await saveOtaConfig(req.body, profile.id);
    await audit(null, userId, "settings_updated", {
      fields: Object.keys(req.body).filter((k) => !/Token|Secret/.test(k)),
    });
    res.json({ settings });
  }),
);
router.post(
  "/ota/admin/price-preview",
  endpoint(async (req, res) => {
    await identity(req, true);
    const input = z
      .object({
        kind: z.enum(["flight", "hotel"]),
        amount: z.string().regex(/^\d{1,12}(?:\.\d{1,6})?$/),
        currency: z.string().regex(/^[A-Z]{3}$/),
        pricing: configSchema.pick({
          rates: true,
          flightMarkupPercent: true,
          hotelMarkupPercent: true,
          serviceFeeNgn: true,
        }),
      })
      .parse(req.body);
    if (input.pricing.rates.NGN !== 1)
      throw new OtaError("NGN rate must equal 1", 400);
    const c = { ...(await getOtaConfig()), ...input.pricing };
    res.json({ pricing: price(c, input.kind, input.amount, input.currency) });
  }),
);
router.post(
  "/ota/admin/check",
  endpoint(async (req, res) => {
    await identity(req, true);
    const c = await getOtaConfig();
    const results: Record<string, string> = {};
    try {
      await db.execute(
        sql`SELECT revision, sync_attempt_at, provider_notice FROM ota_bookings LIMIT 0`,
      );
      await db.execute(sql`SELECT reference FROM ota_payment_jobs LIMIT 0`);
      await db.execute(sql`SELECT dedupe_key FROM ota_duffel_events LIMIT 0`);
      results.database = "passed";
    } catch {
      results.database = "failed: apply OTA migrations 0009, 0010 and 0011";
    }
    try {
      await duffelRequest(c, "/air/airlines?limit=1");
      results.duffel = "passed";
    } catch {
      results.duffel = "failed";
    }
    try {
      await paystackKey(c.mode);
      results.paystack = "configured";
    } catch {
      results.paystack = "not configured or mode mismatch";
    }
    results.stays =
      "Confirm Stays access with Duffel and exercise a sandbox search";
    res.json({ results });
  }),
);
router.get(
  "/ota/admin/duffel/webhook",
  endpoint(async (req, res) => {
    await identity(req, true);
    res.json(
      await webhookStatus(z.enum(["test", "live"]).parse(req.query.mode)),
    );
  }),
);
router.post(
  "/ota/admin/duffel/webhook/register",
  endpoint(async (req, res) => {
    const { profile, userId } = await identity(req, true);
    const mode = z.enum(["test", "live"]).parse(req.body.mode);
    const result = await registerWebhook(mode, profile.id);
    await audit(null, userId, "duffel_webhook_registered", {
      mode,
      id: result.id,
    });
    res.json(result);
  }),
);
router.post(
  "/ota/admin/duffel/webhook/:action",
  endpoint(async (req, res) => {
    const { userId } = await identity(req, true);
    const mode = z.enum(["test", "live"]).parse(req.body.mode),
      action = z
        .enum(["activate", "deactivate", "ping"])
        .parse(req.params.action);
    const result = await controlWebhook(mode, action);
    await audit(null, userId, `duffel_webhook_${action}`, { mode });
    res.json(result);
  }),
);
router.post(
  "/ota/admin/duffel/events/:id/retry",
  endpoint(async (req, res) => {
    const { userId } = await identity(req, true);
    const id = z.string().min(1).max(256).parse(req.params.id);
    const result = await retryDuffelEvent(id);
    await audit(null, userId, "duffel_event_retry_requested", { eventId: id });
    res.json(result);
  }),
);
router.get(
  "/ota/admin/duffel/events",
  endpoint(async (req, res) => {
    await identity(req, true);
    res.json({ events: await recentDuffelEvents() });
  }),
);
router.get(
  "/ota/admin/bookings",
  endpoint(async (req, res) => {
    await identity(req, true);
    const offset = z.coerce
      .number()
      .int()
      .min(0)
      .max(100000)
      .default(0)
      .parse(req.query.offset);
    const rows = await db.query.otaBookingsTable.findMany({
      orderBy: [desc(bookings.createdAt), desc(bookings.id)],
      limit: 100,
      offset,
    });
    res.json({ bookings: rows });
  }),
);
router.get(
  "/ota/admin/bookings/:id",
  endpoint(async (req, res) => {
    await identity(req, true);
    const row = await db.query.otaBookingsTable.findFirst({
      where: eq(bookings.id, String(req.params.id)),
    });
    if (!row) throw new OtaError("Booking not found", 404);
    res.json({ booking: row });
  }),
);
router.get(
  "/ota/admin/bookings/:id/events",
  endpoint(async (req, res) => {
    await identity(req, true);
    res.json({
      events: await db.query.otaEventsTable.findMany({
        where: eq(otaEventsTable.bookingId, String(req.params.id)),
        orderBy: desc(otaEventsTable.createdAt),
        limit: 100,
      }),
    });
  }),
);
router.post(
  "/ota/admin/bookings/:id/reconcile",
  endpoint(async (req, res) => {
    const { userId } = await identity(req, true);
    const row = await db.query.otaBookingsTable.findFirst({
      where: eq(bookings.id, String(req.params.id)),
    });
    if (!row || !row.paidAt) throw new OtaError("Paid booking not found", 404);
    const c = modeConfig(
      await getOtaConfig(),
      z.enum(["test", "live"]).parse(row.mode),
    );
    const providerId = id(
      req.body.providerId || row.providerBookingId,
      row.kind === "flight" ? "ord" : "bok",
    );
    const result = await duffelRequest(
      c,
      row.kind === "flight"
        ? `/air/orders/${providerId}`
        : `/stays/bookings/${providerId}`,
    );
    if (
      result.id !== providerId ||
      result.metadata?.ota_booking_id !== row.id ||
      !sameSupplierAmount(result.total_amount, row.supplierAmount) ||
      result.total_currency !== row.supplierCurrency
    )
      throw new OtaError("Provider record does not match this checkout", 409);
    if (row.status === "refunded")
      throw new OtaError("This booking has already been fully refunded", 409);
    const cancelled = !!result.cancelled_at || result.status === "cancelled";
    if (!cancelled && row.kind === "hotel" && result.status !== "confirmed")
      throw new OtaError("Provider booking is not yet confirmed", 409);
    if (!cancelled && row.kind === "flight" && !result.booking_reference)
      throw new OtaError("Provider confirmation is incomplete", 409);
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(bookings)
        .set({
          revision: sql`${bookings.revision}+1`,
          providerBookingId: result.id,
          providerResult: result,
          status: cancelled ? "cancelled" : "confirmed",
          issue: null,
          notificationSentAt: null,
          notificationAttemptAt: null,
          ...(cancelled
            ? {
                providerNotice:
                  "The supplier has cancelled this reservation. Contact support to review refund options.",
              }
            : {}),
          syncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(bookings.id, row.id),
            eq(bookings.status, row.status),
            eq(bookings.revision, row.revision),
          ),
        )
        .returning();
      if (!updated)
        throw new OtaError(
          "Booking status changed during verification. Refresh and review the latest status.",
          409,
        );
      await tx.insert(otaEventsTable).values({
        id: randomUUID(),
        bookingId: row.id,
        actor: userId,
        action: "booking_reconciled",
        details: { providerId },
      });
    });
    res.json({ success: true });
  }),
);
router.post(
  "/ota/admin/bookings/:id/refund-record",
  endpoint(async (req, res) => {
    const { userId } = await identity(req, true);
    const input = z
      .object({
        refundId: z.string().regex(/^\d+$/),
        supplierResolved: z.literal(true),
        note: z.string().trim().min(10).max(1000),
      })
      .parse(req.body);
    const row = await db.query.otaBookingsTable.findFirst({
      where: eq(bookings.id, String(req.params.id)),
    });
    if (!row?.paidAt || !["requires_review", "cancelled"].includes(row.status))
      throw new OtaError(
        "Reconcile supplier cancellation/non-booking before recording a refund",
        409,
      );
    const refund = await paystackRequest(`/refund/${input.refundId}`, row.mode);
    const payment = await paystackRequest(
      `/transaction/verify/${encodeURIComponent(row.reference)}`,
      row.mode,
    );
    validateRefundPayment(payment, row);
    if (
      String(refund.id) !== input.refundId ||
      refund.status !== "processed" ||
      refund.domain !== row.mode ||
      refund.currency !== "NGN" ||
      Number(refund.amount) !== row.amountKobo ||
      !providerTransactionId(payment.id) ||
      providerTransactionId(refund.transaction?.id ?? refund.transaction) !==
        providerTransactionId(payment.id) ||
      payment.reference !== row.reference ||
      payment.metadata?.otaBookingId !== row.id
    )
      throw new OtaError(
        "Only a completed full Paystack refund for this transaction can be recorded",
        409,
      );
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(bookings)
        .set({
          revision: sql`${bookings.revision}+1`,
          status: "refunded",
          refund: {
            id: refund.id,
            amount: refund.amount,
            status: refund.status,
          },
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(bookings.id, row.id),
            eq(bookings.status, row.status),
            eq(bookings.revision, row.revision),
          ),
        )
        .returning();
      if (!updated)
        throw new OtaError(
          "Booking status changed during refund verification. Refresh and reconcile the supplier outcome.",
          409,
        );
      await tx.insert(otaEventsTable).values({
        id: randomUUID(),
        bookingId: row.id,
        actor: userId,
        action: "full_refund_verified",
        details: {
          refundId: refund.id,
          note: input.note,
          supplierResolved: true,
        },
      });
    });
    res.json({ success: true });
  }),
);
router.post(
  "/ota/admin/bookings/:id/check-payment",
  endpoint(async (req, res) => {
    const { userId } = await identity(req, true);
    const row = await db.query.otaBookingsTable.findFirst({
      where: eq(bookings.id, String(req.params.id)),
    });
    if (!row) throw new OtaError("Booking not found", 404);
    const updated = await fulfill(row.reference);
    await audit(row.id, userId, "operator_payment_checked");
    res.json({ booking: updated });
  }),
);
router.post(
  "/ota/admin/bookings/:id/resolve-request",
  endpoint(async (req, res) => {
    const { userId } = await identity(req, true);
    const note = z.string().trim().min(10).max(2000).parse(req.body.note);
    const row = await db.query.otaBookingsTable.findFirst({
      where: eq(bookings.id, String(req.params.id)),
    });
    if (!row?.serviceRequest)
      throw new OtaError("Open service request not found", 404);
    const originalRequest = row.serviceRequest;
    await db.transaction(async (tx) => {
      const [resolved] = await tx
        .update(bookings)
        .set({
          revision: sql`${bookings.revision}+1`,
          serviceRequest: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(bookings.id, row.id),
            eq(bookings.serviceRequest, originalRequest),
          ),
        )
        .returning();
      if (!resolved)
        throw new OtaError(
          "This request changed. Refresh before responding.",
          409,
        );
      await tx.insert(otaEventsTable).values({
        id: randomUUID(),
        bookingId: row.id,
        actor: userId,
        action: "service_request_resolved",
        details: { message: row.serviceRequest, note, customerMessage: note },
      });
    });
    res.json({ success: true });
  }),
);
export default router;
