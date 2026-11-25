import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { getAuth, clerkClient } from "@clerk/express";
import {
  randomUUID,
  createHash,
} from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import {
  db,
  profilesTable,
  otaBookingsTable as bookings,
  otaEventsTable,
  notificationsTable,
} from "@workspace/db";
import { and, eq, desc, sql, like, isNull, or } from "drizzle-orm";
import { customerTimeline } from "../services/ota/bookingUpdates";
import {
  getOtaConfig,
  saveOtaConfig,
  safeConfig,
  configSchema,
  requireLiveWebhook,
  bilalMode,
  bilalFlightCheckoutReady,
  nuiteeHotelSearchReady,
  nuiteeHotelCheckoutReady,
  nuiteeFlightCheckoutReady,
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
  supplierBookingConfirmed,
  supplierBookingTotalMatches,
  validateRefundPayment,
} from "../services/ota/provider";
import {
  audit,
  customerBooking,
  activeOtaPaymentReference,
  otaPaymentReferenceMatches,
  otaPaystackTimeoutSeconds,
  fulfill,
  paystackKey,
  paystackRequest,
  refreshBooking,
  domesticBookingQuote,
} from "../services/ota/booking";
import { enqueuePayment } from "../services/ota/paymentQueue";
import { referenceRates } from "../services/ota/exchangeRates";
import { otaEarnings } from "../services/ota/earnings";
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
import {
  expiredUnpaidPaystackSession,
  isPaystackReference,
  lookupPaystackTransaction,
  matchesPaystackBinding,
  matchesPaystackSignature,
  providerTransactionId,
} from "../services/payments/paystackProof";
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
import { checkOtaReadiness } from "../services/ota/readiness";
import { otaAppOrigin } from "../services/ota/appOrigin";
import {
  bilalAirports,
  checkDomesticFare,
  prepareDomesticCheckout,
  refreshDomesticQuote,
  searchFlightPlaces,
  searchFlights,
  flightSearchReady,
  multiCityFlightSearchReady,
} from "../services/ota/flightSuppliers";
import {
  flightLegSchema,
  itineraryLegs,
  MAX_MULTI_CITY_LEGS,
  multiCityLegs,
} from "../services/ota/flightItinerary";
import { getBilalTicket } from "../services/ota/bilalOrders";
import { featuredHotelAvailability } from "../services/ota/featuredHotels";
import { listDomesticFareIncreases } from "../services/ota/domesticFareChecks";
import {
  checkNuiteeConnection,
  searchNuiteeHotels,
  getNuiteeRates,
  createNuiteeQuote,
  readNuiteeQuote,
  verifyNuiteePrebook,
} from "../services/ota/nuitee";
import {
  NUITEE_FLIGHT_PREFIX,
  checkNuiteeFlights,
  verifyNuiteeFlight,
  prebookNuiteeFlight,
  verifyNuiteeFlightPrebook,
} from "../services/ota/nuiteeFlights";

// The existing mobile v1 contract exposes one supplier environment. Keep
// mixed-mode hotel inventory on the web until the mobile contract models it.
const webHotelChannel = (req: Request) =>
  !/^\/api\/ota\/v1(?:\/|$)/i.test(req.originalUrl);

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
        flightSearch: flightSearchReady(c),
        hotelSearch: c.hotelsEnabled,
        onlineCheckout: c.salesEnabled || nuiteeFlightCheckoutReady(c),
        bookingHistory: true,
        bookingUpdates: true,
        supportRequests: true,
        selfServiceCancellation: false,
        selfServiceExchange: false,
        multiCity: multiCityFlightSearchReady(c),
        infants: false,
        ancillaries: false,
      },
      limits: {
        flightPassengers: 9,
        multiCityLegs: MAX_MULTI_CITY_LEGS,
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
  phoneCountryCode: z
    .string()
    .regex(/^[1-9]\d{0,2}$/)
    .optional(),
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
        issued_on: date.optional(),
        nationality: z
          .string()
          .regex(/^[A-Z]{2}$/)
          .optional(),
      }),
    )
    .max(1)
    .optional(),
});
const nPassengerSchema = passengerSchema.extend({
  nationality: z.string().regex(/^[A-Z]{2}$/),
});

router.get(
  "/ota/config",
  endpoint(async (req, res) => {
    const c = await getOtaConfig();
    res.json({
      flightsEnabled: flightSearchReady(c),
      multiCityFlightSearchEnabled: multiCityFlightSearchReady(c),
      hotelsEnabled:
        c.hotelsEnabled || (webHotelChannel(req) && nuiteeHotelSearchReady(c)),
      ...(webHotelChannel(req)
        ? {
            nuiteeCheckoutEnabled: nuiteeHotelCheckoutReady(c),
            nuiteeMode: c.nuiteeMode,
          }
        : {}),
      salesEnabled: c.salesEnabled,
      bilalCheckoutEnabled: bilalFlightCheckoutReady(c),
      nuiteeFlightCheckoutEnabled: nuiteeFlightCheckoutReady(c),
      nuiteeFlightMode: c.nuiteeFlightMode,
      bilalMode: bilalMode(c),
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
      places: await searchFlightPlaces(c, q),
    });
  }),
);
router.post(
  "/ota/flights/search",
  endpoint(async (req, res) => {
    const travellers = z.object({
      adults: z.number().int().min(1).max(9),
      childAges: z.array(z.number().int().min(2).max(11)).max(8).default([]),
      cabinClass: z
        .enum(["economy", "premium_economy", "business", "first"])
        .default("economy"),
    });
    const payload = z.union([
      travellers.extend({
        legs: multiCityLegs,
        origin: z.never().optional(),
        destination: z.never().optional(),
        departureDate: z.never().optional(),
        returnDate: z.never().optional(),
      }),
      travellers.extend({
        ...flightLegSchema.shape,
        returnDate: future.optional(),
        legs: z.never().optional(),
      }),
    ]).parse(req.body);
    const input = payload.legs ? { ...payload, ...payload.legs[0] } : payload;
    const legs = itineraryLegs(input);
    if (
      input.adults + input.childAges.length > 9 ||
      legs.some(
        (leg, index) =>
          leg.origin === leg.destination ||
          !future.safeParse(leg.departureDate).success ||
          (index > 0 && leg.departureDate < legs[index - 1].departureDate),
      )
    )
      throw new OtaError(
        "Choose different airports for each leg, put travel dates in order and check the traveller count.",
      );
    const c = await getOtaConfig();
    if (!c.flightsEnabled)
      throw new OtaError("Flight search is not enabled", 503);
    res.json(
      await searchFlights(
        c,
        input,
        !req.originalUrl.startsWith("/api/ota/v1/"),
      ),
    );
  }),
);
router.get(
  "/ota/flights/offers/:id",
  endpoint(async (req, res) => {
    const c = await getOtaConfig();
    const offerId = String(req.params.id);
    if (offerId.startsWith(NUITEE_FLIGHT_PREFIX)) {
      const { offer, pricing } = await verifyNuiteeFlight(c, offerId);
      res.json({ offer, pricing });
      return;
    }
    if (
      offerId.startsWith("bilal_") &&
      !/^\/api\/ota\/v1\//i.test(req.originalUrl)
    ) {
      const { offer, pricing } = await prepareDomesticCheckout(c, offerId);
      res.json({ offer, pricing });
      return;
    }
    if (!c.flightsEnabled || !c.primaryFlightsEnabled)
      throw new OtaError("Online flight offers are not enabled", 503);
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
  "/ota/flights/estimates/check",
  endpoint(async (req, res) => {
    const { token } = z
      .object({ token: z.string().min(39).max(4096) })
      .strict()
      .parse(req.body);
    res.json(await checkDomesticFare(await getOtaConfig(), token));
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
        guestNationality: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z]{2}$/)
          .default("NG"),
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
    if (webHotelChannel(req) && nuiteeHotelSearchReady(c)) {
      res.json({ results: await searchNuiteeHotels(c, input) });
      return;
    }
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
router.get(
  "/ota/hotels/featured-destinations",
  endpoint(async (_req, res) => {
    res.json({
      availability: await featuredHotelAvailability(await getOtaConfig()),
    });
  }),
);
router.post(
  "/ota/hotels/rates/:id",
  endpoint(async (req, res) => {
    const c = await getOtaConfig();
    const resultId = String(req.params.id);
    if (webHotelChannel(req) && resultId.startsWith("nst_")) {
      res.json({ result: await getNuiteeRates(c, resultId) });
      return;
    }
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
    const { userId } = await identity(req);
    const input = z.object({ rateId: z.string() }).parse(req.body);
    const c = await getOtaConfig();
    if (webHotelChannel(req) && input.rateId.startsWith("nrt_")) {
      res.json(await createNuiteeQuote(c, input.rateId, userId));
      return;
    }
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
    const { userId } = await identity(req);
    const c = await getOtaConfig();
    const quoteId = String(req.params.id);
    if (webHotelChannel(req) && quoteId.startsWith("nqt_")) {
      const { quote, pricing } = await readNuiteeQuote(c, quoteId, userId);
      res.json({ quote, pricing });
      return;
    }
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
        editBookingId: z.string().uuid().optional(),
        editRevision: z.number().int().nonnegative().optional(),
        contact: contactSchema,
        travellers: z.array(z.unknown()).min(1).max(24),
        acceptedTerms: z.literal(true),
        expectedTotalKobo: z.number().int().positive(),
      })
      .refine(
        (payload) =>
          (payload.editBookingId === undefined) ===
          (payload.editRevision === undefined),
      )
      .parse(req.body);
    const c = await getOtaConfig();
    const domestic =
      input.kind === "flight" &&
      input.offerId.startsWith("bilal_") &&
      !/^\/api\/ota\/v1\//i.test(req.originalUrl);
    const nuitee =
      input.kind === "hotel" &&
      webHotelChannel(req) &&
      input.offerId.startsWith("nqt_");
    const nFlight =
      input.kind === "flight" && input.offerId.startsWith(NUITEE_FLIGHT_PREFIX);
    if (input.editBookingId && !nuitee && !nFlight)
      throw new OtaError("This checkout cannot be edited.", 409);
    if (
      nFlight
        ? !nuiteeFlightCheckoutReady(c)
        : nuitee
          ? !nuiteeHotelCheckoutReady(c)
          : domestic
            ? !bilalFlightCheckoutReady(c)
            : !c.salesEnabled ||
              !(input.kind === "flight"
                ? c.flightsEnabled && c.primaryFlightsEnabled
                : c.hotelsEnabled)
    )
      throw new OtaError(
        "Online booking is not enabled. Please contact support.",
        503,
      );
    const mode = nFlight
      ? c.nuiteeFlightMode
      : nuitee
        ? c.nuiteeMode
        : domestic
          ? bilalMode(c)
          : c.mode;
    const supplier =
      nFlight || nuitee ? "nuitee" : domestic ? "bilalsadasub" : "duffel";
    await paystackKey(mode, supplier);
    if (supplier === "duffel") requireLiveWebhook(c);
    if (!otaAppOrigin())
      throw new OtaError("Secure payment callback URL is not configured", 503);
    const domesticCheckout = domestic
      ? await prepareDomesticCheckout(c, input.offerId)
      : null;
    const nuiteeCheckout = nuitee
      ? await readNuiteeQuote(c, input.offerId, userId)
      : null;
    const nFlightQuote = nFlight
      ? await verifyNuiteeFlight(c, input.offerId)
      : null;
    let offerId =
      nFlightQuote?.selection.offerId ??
      nuiteeCheckout?.checkout.prebookId ??
      domesticCheckout?.quote.fare.supplierId ??
      id(input.offerId, input.kind === "flight" ? "off" : "quo");
    const offer =
      nFlightQuote?.offer ??
      nuiteeCheckout?.quote ??
      domesticCheckout?.offer ??
      (await duffelRequest(
        c,
        input.kind === "flight"
          ? `/air/offers/${offerId}`
          : `/stays/quotes/${offerId}`,
      ));
    available(offer);
    let travellers: any[];
    if (input.kind === "flight") {
      travellers = z
        .array(nFlight ? nPassengerSchema : passengerSchema)
        .parse(input.travellers);
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
        if (
          domestic &&
          (p.title === "dr" ||
            p.identity_documents?.some(
              (d: any) =>
                !d.issued_on ||
                !d.nationality ||
                d.issued_on >= d.expires_on ||
                d.issued_on > new Date().toISOString().slice(0, 10),
            ))
        )
          throw new OtaError(
            "Choose a supported title and complete the issue date and nationality for any passport supplied.",
          );
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
      if (!nuitee) assertHotelQuote(offer);
    }
    const pricing =
      nFlightQuote?.pricing ??
      nuiteeCheckout?.pricing ??
      domesticCheckout?.pricing ??
      price(c, input.kind, offer.total_amount, offer.total_currency);
    if (pricing.totalKobo !== input.expectedTotalKobo)
      throw new OtaError(
        "The price has changed. Refresh the offer and review the new total before paying.",
        409,
      );
    const sourceKey =
      nFlightQuote?.selection.offerId ??
      nuiteeCheckout?.checkout.sourceKey ??
      nuiteeCheckout?.checkout.prebookId;
    const checkoutKey = sourceKey
      ? createHash("sha256")
          .update(JSON.stringify([userId, input.kind, mode, sourceKey]))
          .digest("hex")
      : null;
    // Previously saved drafts included traveller identity in this key.
    const legacyCheckoutKey = sourceKey
      ? createHash("sha256")
          .update(
            JSON.stringify([
              userId,
              input.kind,
              mode,
              sourceKey,
              travellers
                .map((person) =>
                  JSON.stringify([
                    person.given_name.normalize("NFKC").toLowerCase(),
                    person.family_name.normalize("NFKC").toLowerCase(),
                    input.kind === "flight" ? person.born_on : null,
                  ]),
                )
                .sort(),
            ]),
          )
          .digest("hex")
      : null;
    const lockedCheckout = () =>
      new OtaError(
        "Payment may already be in progress, or this checkout changed. Open My Trips to review the saved booking.",
        409,
      );
    const reusable = (existing: typeof bookings.$inferSelect | undefined) =>
      existing?.clerkUserId === userId &&
      existing.status === "payment_pending" &&
      existing.supplier === supplier &&
      existing.mode === mode &&
      existing.kind === input.kind &&
      existing.expiresAt.getTime() > Date.now() + 60000 &&
      existing.amountKobo === pricing.totalKobo &&
      isDeepStrictEqual(existing.travellers, travellers) &&
      isDeepStrictEqual(existing.contact, input.contact);
    const existing = input.editBookingId
      ? await db.query.otaBookingsTable.findFirst({
          where: and(
            eq(bookings.id, input.editBookingId),
            eq(bookings.clerkUserId, userId),
          ),
        })
      : checkoutKey
        ? ((await db.query.otaBookingsTable.findFirst({
            where: eq(bookings.checkoutKey, checkoutKey),
          })) ??
          (legacyCheckoutKey
            ? await db.query.otaBookingsTable.findFirst({
                where: eq(bookings.checkoutKey, legacyCheckoutKey),
              })
            : undefined))
        : undefined;
    if (
      input.editBookingId &&
      (!existing ||
        existing.kind !== input.kind ||
        existing.supplier !== supplier ||
        existing.mode !== mode ||
        (existing.offer as { checkoutSelectionId?: string })
          .checkoutSelectionId !== input.offerId)
    )
      throw new OtaError("Editable checkout not found.", 404);
    if (existing && reusable(existing)) {
      res.status(201).json({ booking: customerBooking(existing) });
      return;
    }
    if (
      existing &&
      (existing.status !== "payment_pending" ||
        existing.paidAt ||
        existing.authorizationUrl ||
        existing.paymentInitializationAt ||
        (input.editRevision !== undefined &&
          input.editRevision !== existing.revision))
    )
      throw lockedCheckout();
    if (nFlightQuote)
      offerId = await prebookNuiteeFlight(
        c,
        nFlightQuote,
        input.contact,
        travellers,
      );
    const bookingId = randomUUID(),
      reference = `OTA-${randomUUID()}`;
    const expiresAt = new Date(expiration(offer));
    const row = await db
      .transaction(async (tx) => {
        const values = {
          id: bookingId,
          clerkUserId: userId,
          kind: input.kind,
          mode,
          supplier,
          reference,
          checkoutKey,
          providerOfferId: offerId,
          supplierAmount: offer.total_amount,
          supplierCurrency: offer.total_currency,
          amountKobo: pricing.totalKobo,
          pricing,
          offer: nFlightQuote
            ? {
                ...offer,
                id: undefined,
                checkoutSelectionId: input.offerId,
                nuiteeFlightJourneyKey: nFlightQuote.selection.journeyKey,
              }
            : nuiteeCheckout
              ? {
                  ...offer,
                  id: undefined,
                  checkoutSelectionId: input.offerId,
                  nuiteeStay: {
                    mode,
                    hotelId: nuiteeCheckout.checkout.hotelId,
                    checkIn: nuiteeCheckout.checkout.checkIn,
                    checkOut: nuiteeCheckout.checkout.checkOut,
                    rooms: nuiteeCheckout.checkout.rooms,
                    termsHash: nuiteeCheckout.checkout.termsHash,
                  },
                }
              : domesticCheckout
                ? {
                    ...offer,
                    id: undefined,
                    domesticQuote: domesticCheckout.quote,
                  }
                : offer,
          travellers,
          contact: input.contact,
          expiresAt,
        };
        if (existing) {
          const { id: _id, reference: _reference, ...details } = values;
          const [updated] = await tx
            .update(bookings)
            .set({
              ...details,
              revision: sql`${bookings.revision} + 1`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(bookings.id, existing.id),
                eq(bookings.clerkUserId, userId),
                eq(bookings.revision, existing.revision),
                eq(bookings.status, "payment_pending"),
                isNull(bookings.paidAt),
                isNull(bookings.authorizationUrl),
                isNull(bookings.paymentInitializationAt),
              ),
            )
            .returning();
          if (!updated) throw lockedCheckout();
          await tx.insert(otaEventsTable).values({
            id: randomUUID(),
            bookingId: updated.id,
            actor: userId,
            action: "checkout_updated",
            details: { termsAccepted: true },
          });
          return updated;
        }
        const insert = tx.insert(bookings).values(values);
        const [saved] = await (
          supplier === "nuitee" ? insert.onConflictDoNothing() : insert
        ).returning();
        if (!saved) {
          const existing = await tx.query.otaBookingsTable.findFirst({
            where: or(
              checkoutKey ? eq(bookings.checkoutKey, checkoutKey) : undefined,
              and(
                eq(bookings.providerOfferId, offerId),
                eq(bookings.mode, mode),
                eq(bookings.supplier, supplier),
              ),
            ),
          });
          if (!existing || !reusable(existing)) throw lockedCheckout();
          return existing;
        }
        await tx.insert(otaEventsTable).values({
          id: randomUUID(),
          bookingId,
          actor: userId,
          action: "checkout_created",
          details: { termsAccepted: true },
        });
        return saved;
      })
      .catch((error) => {
        if (
          supplier === "nuitee" &&
          (error.cause?.code ?? error.code) === "23505"
        )
          throw lockedCheckout();
        throw error;
      });
    res.status(201).json({ booking: customerBooking(row) });
  }),
);
router.post(
  "/ota/bookings/:id/pay",
  endpoint(async (req, res) => {
    const row = await owned(req),
      c = await getOtaConfig();
    const domestic = row.supplier === "bilalsadasub";
    const nuitee = row.supplier === "nuitee";
    const nFlight = nuitee && row.kind === "flight";
    if (
      nFlight
        ? !nuiteeFlightCheckoutReady(c) || c.nuiteeFlightMode !== row.mode
        : nuitee
          ? !nuiteeHotelCheckoutReady(c) || c.nuiteeMode !== row.mode
          : domestic
            ? !bilalFlightCheckoutReady(c) || bilalMode(c) !== row.mode
            : !c.salesEnabled || c.mode !== row.mode
    )
      throw new OtaError("Online payments are unavailable", 503);
    if (row.supplier === "duffel") requireLiveWebhook(c);
    if (
      row.status !== "payment_pending" ||
      row.expiresAt.getTime() <= Date.now() + 60000
    )
      throw new OtaError(
        "This checkout cannot accept payment. Please search again or view its status.",
        409,
      );
    if (
      !nuitee &&
      !(row.kind === "flight" ? c.flightsEnabled : c.hotelsEnabled)
    )
      throw new OtaError("This booking channel is currently unavailable", 503);
    const appOrigin = otaAppOrigin();
    if (!appOrigin)
      throw new OtaError("Secure payment callback URL is not configured", 503);
    if (nFlight) {
      await verifyNuiteeFlightPrebook(c, row);
    } else if (nuitee) {
      await verifyNuiteePrebook(c, row);
    } else if (domestic) {
      if (!(await refreshDomesticQuote(c, domesticBookingQuote(row))))
        throw new OtaError(
          "This itinerary is no longer available. Search again before paying.",
          409,
        );
    } else {
      const fresh = await duffelRequest(
        c,
        row.kind === "flight"
          ? `/air/offers/${row.providerOfferId}`
          : `/stays/quotes/${row.providerOfferId}`,
      );
      available(fresh);
      if (row.kind === "hotel") assertHotelQuote(fresh);
      if (
        !sameSupplierAmount(fresh.total_amount, row.supplierAmount) ||
        fresh.total_currency !== row.supplierCurrency
      )
        throw new OtaError(
          "Supplier pricing has changed. Please start a new search before paying.",
          409,
        );
    }
    const sameCheckout = and(
      eq(bookings.id, row.id),
      eq(bookings.status, "payment_pending"),
      eq(bookings.providerOfferId, row.providerOfferId),
      eq(bookings.amountKobo, row.amountKobo),
      eq(bookings.supplierAmount, row.supplierAmount),
      eq(bookings.supplierCurrency, row.supplierCurrency),
      sql`${bookings.contact} = ${JSON.stringify(row.contact)}::jsonb`,
      sql`${bookings.travellers} = ${JSON.stringify(row.travellers)}::jsonb`,
      sql`${bookings.expiresAt} > now()`,
    );
    const readCheckout = () => db.query.otaBookingsTable.findFirst({ where: sameCheckout });
    const current = await readCheckout();
    if (!current) throw new OtaError("Checkout changed. Refresh before paying.", 409);

    const timeout = await otaPaystackTimeoutSeconds(current.mode, current.supplier);
    const existingReference = activeOtaPaymentReference(current);
    const publishedUrl = current.authorizationUrl;
    const checkPreviousPayment = async () => {
      const gateway = await lookupPaystackTransaction(existingReference, await paystackKey(current.mode, current.supplier));
      if (!gateway) return null;
      if (!matchesPaystackBinding(gateway, {
        mode: current.mode, amountKobo: current.amountKobo, reference: existingReference,
        purpose: "ota", bookingId: current.id,
      })) throw new OtaError("The previous payment could not be verified. Check this booking before paying again.", 409);
      if (gateway?.status === "success") {
        await enqueuePayment(existingReference, current.id);
        throw new OtaError("Payment is being verified. Check the booking status before paying again.", 409);
      }
      return gateway;
    };
    if (publishedUrl) {
      const gateway = await checkPreviousPayment();
      if (!gateway) throw new OtaError("The previous payment could not be verified. Check this booking before paying again.", 409);
      if (!expiredUnpaidPaystackSession(gateway, current.mode, timeout, current.paymentSessionExpiresAt)) {
        const createdAt = Date.parse(gateway?.created_at ?? gateway?.createdAt);
        const deadline = current.paymentSessionExpiresAt?.getTime() ?? createdAt + timeout * 1000;
        if (deadline > Date.now() && ["abandoned", "failed"].includes(gateway.status)) {
          const latest = await readCheckout();
          if (latest?.authorizationUrl === publishedUrl &&
              activeOtaPaymentReference(latest) === existingReference) {
            res.json({ authorizationUrl: publishedUrl });
            return;
          }
        }
        throw new OtaError("The previous payment may still be processing. Check this booking before paying again.", 409);
      }
    }

    // A new session must leave time for both initialization and fulfillment.
    const paymentWindow = timeout + 90;
    if (current.expiresAt.getTime() <= Date.now() + paymentWindow * 1000)
      throw new OtaError("There is not enough time left to pay for this offer. Please search again.", 409);

    const canPreparePayment = and(
      sameCheckout,
      sql`${bookings.expiresAt} > now() + ${paymentWindow} * interval '1 second'`,
    );
    const startedAt = new Date();
    let reference = publishedUrl ? "OTA-" + randomUUID() : existingReference;
    const [claim] = await db.update(bookings)
      .set({
        paymentInitializationAt: startedAt,
        ...(publishedUrl ? {
          paymentReference: reference,
          previousPaymentReferences: [...current.previousPaymentReferences, existingReference],
          authorizationUrl: null,
          paymentSessionExpiresAt: null,
        } : {}),
      })
      .where(and(
        canPreparePayment,
        publishedUrl ? eq(bookings.authorizationUrl, publishedUrl) : isNull(bookings.authorizationUrl),
        current.paymentReference ? eq(bookings.paymentReference, current.paymentReference) : isNull(bookings.paymentReference),
        current.paymentInitializationAt
          ? and(
              eq(bookings.paymentInitializationAt, current.paymentInitializationAt),
              sql`${bookings.paymentInitializationAt} < now() - interval '45 seconds'`,
            )
          : isNull(bookings.paymentInitializationAt),
      ))
      .returning({ id: bookings.id });
    if (!claim)
      throw new OtaError("A payment session is being prepared. Refresh the booking before trying again.", 409);
    if (!publishedUrl && current.paymentInitializationAt) {
      const gateway = await checkPreviousPayment();
      if (gateway) {
        if (!expiredUnpaidPaystackSession(gateway, current.mode, timeout, null, current.paymentInitializationAt))
          throw new OtaError("The previous payment may still be processing. Check this booking before paying again.", 409);
        // This link was never published. Keep its reference for late callbacks.
        const nextReference = "OTA-" + randomUUID();
        const [rotated] = await db.update(bookings)
          .set({
            paymentReference: nextReference,
            previousPaymentReferences: [...current.previousPaymentReferences, reference],
          }).where(and(canPreparePayment, isNull(bookings.authorizationUrl),
            eq(bookings.paymentInitializationAt, startedAt)))
          .returning({ id: bookings.id });
        if (!rotated) throw new OtaError("Booking changed while preparing payment.", 409);
        reference = nextReference;
      }
    }

    const data = await paystackRequest(
      "/transaction/initialize",
      row.mode,
      {
        email: (row.contact as any).email,
        amount: row.amountKobo,
        currency: "NGN",
        reference,
        callback_url: `${appOrigin}/travel/bookings/${row.id}`,
        metadata: { otaBookingId: row.id, type: "ota_booking" },
      },
      row.supplier,
    );
    if (
      data?.reference !== reference ||
      !/^https:\/\/checkout\.paystack\.com\//.test(data.authorization_url || "")
    )
      throw new OtaError("Invalid payment redirect", 502);
    const [initialized] = await db
      .update(bookings)
      .set({
        revision: sql`${bookings.revision}+1`,
        authorizationUrl: data.authorization_url,
        paymentSessionExpiresAt: new Date(Date.now() + timeout * 1000),
        paymentInitializationAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          canPreparePayment,
          isNull(bookings.authorizationUrl),
          eq(bookings.paymentInitializationAt, startedAt),
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
router.get(
  "/ota/bookings/:id/ticket",
  endpoint(async (req, res) => {
    const row = await owned(req);
    if (
      row.supplier !== "bilalsadasub" ||
      row.status !== "confirmed" ||
      !row.providerBookingId ||
      !(row.providerResult as any)?.ticketPdfAvailable
    )
      throw new OtaError("The ticket is not available yet.", 404);
    const file = await getBilalTicket(
      await getOtaConfig(),
      z.enum(["test", "live"]).parse(row.mode),
      row.providerBookingId,
    );
    const current = await owned(req);
    if (
      current.status !== "confirmed" ||
      current.providerBookingId !== row.providerBookingId
    )
      throw new OtaError(
        "The ticket is not available for the current booking status.",
        409,
      );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="FlyRaudah-e-ticket.pdf"',
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(file);
  }),
);
router.post(
  "/ota/bookings/:id/complete",
  endpoint(async (req, res) => {
    const row = await owned(req);
    res.json({
      booking: customerBooking(row.status === "payment_pending"
        ? await fulfill(activeOtaPaymentReference(row), row.id) : row),
    });
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
    if (!raw || raw.length > 131072 || !/^[a-fA-F0-9]{128}$/.test(signature))
      return res.status(401).json({ error: "Invalid signature" });
    const reference = req.body?.data?.reference;
    const bookingId = req.body?.data?.metadata?.otaBookingId;
    const booking =
      isPaystackReference(reference) && z.string().uuid().safeParse(bookingId).success
        ? await db.query.otaBookingsTable.findFirst({
            columns: { mode: true, supplier: true },
            where: and(
              otaPaymentReferenceMatches(reference),
              eq(bookings.id, bookingId),
            ),
          })
        : undefined;
    if (!matchesPaystackSignature(raw, signature, await paystackKey(booking?.mode, booking?.supplier)))
      return res.status(401).json({ error: "Invalid signature" });
    if (
      req.body.event === "charge.success" && booking
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
  "/ota/admin/suppliers/nuitee/flights/check",
  endpoint(async (req, res) => {
    await identity(req, true);
    const { mode } = z
      .object({ mode: z.enum(["test", "live"]) })
      .parse(req.body);
    await checkNuiteeFlights(await getOtaConfig(), mode);
    res.json({ connected: true });
  }),
);
router.post(
  "/ota/admin/suppliers/nuitee/check",
  endpoint(async (req, res) => {
    await identity(req, true);
    const { mode } = z
      .object({ mode: z.enum(["test", "live"]) })
      .parse(req.body);
    await checkNuiteeConnection(await getOtaConfig(), mode);
    res.json({ connected: true });
  }),
);
router.post(
  "/ota/admin/suppliers/bilalsadasub/check",
  endpoint(async (req, res) => {
    await identity(req, true);
    const { mode } = z
      .object({ mode: z.enum(["test", "live"]) })
      .parse(req.body);
    const config = { ...(await getOtaConfig()), mode };
    await bilalAirports(config, "Lagos");
    res.json({ connected: true });
  }),
);
router.post(
  "/ota/admin/price-preview",
  endpoint(async (req, res) => {
    await identity(req, true);
    const input = z
      .object({
        kind: z.enum(["flight", "hotel", "bilalsadasub"]),
        amount: z.string().regex(/^\d{1,12}(?:\.\d{1,6})?$/),
        currency: z.string().regex(/^[A-Z]{3}$/),
        pricing: configSchema
          .pick({
            rates: true,
            flightMarkupPercent: true,
            hotelMarkupPercent: true,
            serviceFeeNgn: true,
          })
          .extend({
            bilalMarkupPercent:
              configSchema.shape.bilalMarkupPercent.optional(),
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
    res.json({ results: await checkOtaReadiness() });
  }),
);
router.get(
  "/ota/admin/earnings",
  endpoint(async (req, res) => {
    await identity(req, true);
    const { mode, offset } = z
      .object({
        mode: z.enum(["live", "test"]).default("live"),
        offset: z.coerce.number().int().min(0).max(100000).default(0),
      })
      .parse(req.query);
    res.json(await otaEarnings(mode, offset));
  }),
);
router.get(
  "/ota/admin/fare-changes",
  endpoint(async (req, res) => {
    await identity(req, true);
    const { mode, offset } = z
      .object({
        mode: z.enum(["live", "test"]).default("live"),
        offset: z.coerce.number().int().min(0).max(100000).default(0),
      })
      .parse(req.query);
    res.json(await listDomesticFareIncreases(mode, offset));
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
    if (row.supplier === "bilalsadasub" || row.supplier === "nuitee") {
      const updated = await refreshBooking(row);
      if (updated.revision === row.revision)
        throw new OtaError(
          "No matching supplier update was found. Review the booking by its transaction reference.",
          409,
        );
      res.json({ success: true });
      return;
    }
    const c = modeConfig(
      await getOtaConfig(),
      z.enum(["test", "live"]).parse(row.mode),
    );
    const providerId = id(
      req.body.providerId || row.providerBookingId,
      row.kind === "flight" ? "ord" : "bok",
    );
    if (row.providerBookingId && providerId !== row.providerBookingId)
      throw new OtaError(
        "Checkout is already linked to another supplier reservation",
        409,
      );
    const result = await duffelRequest(
      c,
      row.kind === "flight"
        ? `/air/orders/${providerId}`
        : `/stays/bookings/${providerId}`,
    );
    if (
      result.id !== providerId ||
      (result.live_mode !== undefined &&
        result.live_mode !== (row.mode === "live")) ||
      result.metadata?.ota_booking_id !== row.id ||
      !supplierBookingTotalMatches(result, row)
    )
      throw new OtaError("Provider record does not match this checkout", 409);
    if (row.status === "refunded")
      throw new OtaError("This booking has already been fully refunded", 409);
    const cancelled = !!result.cancelled_at || result.status === "cancelled";
    if (!cancelled && row.status === "cancelled")
      throw new OtaError(
        "This booking already has a recorded cancellation",
        409,
      );
    if (!cancelled && !supplierBookingConfirmed(row.kind, result))
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
    const refund = await paystackRequest(
      `/refund/${input.refundId}`,
      row.mode,
      undefined,
      row.supplier,
    );
    const paymentReference = row.paidPaymentReference || row.reference;
    const payment = await paystackRequest(
      `/transaction/verify/${encodeURIComponent(paymentReference)}`,
      row.mode,
      undefined,
      row.supplier,
    );
    validateRefundPayment(payment, { ...row, reference: paymentReference });
    if (
      String(refund.id) !== input.refundId ||
      refund.status !== "processed" ||
      refund.domain !== row.mode ||
      refund.currency !== "NGN" ||
      Number(refund.amount) !== row.amountKobo ||
      !providerTransactionId(payment.id) ||
      providerTransactionId(refund.transaction?.id ?? refund.transaction) !==
        providerTransactionId(payment.id) ||
      payment.reference !== paymentReference ||
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
          notificationSentAt: null,
          notificationAttemptAt: null,
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
    const updated = row.status === "payment_pending"
      ? await fulfill(activeOtaPaymentReference(row), row.id) : row;
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
