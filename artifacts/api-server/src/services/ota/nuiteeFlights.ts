import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { nuiteeFlightSearchReady, type OtaConfig } from "./config";
import { NUITEE_API, nuiteeRequest } from "./nuitee";
import { OtaError, price, sameSupplierAmount, available } from "./provider";

type Mode = OtaConfig["nuiteeFlightMode"];
export type NuiteeFlightSearch = {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  childAges: number[];
  cabinClass: string;
};
const timestamp = z.string().datetime({ local: true, offset: true });
const code = z.string().regex(/^[A-Z0-9]{3}$/);
const providerId = z.string().min(1).max(4096);
const selectionSchema = z.object({
  offerId: providerId,
  mode: z.enum(["test", "live"]),
  adults: z.number().int().min(1).max(9),
  childAges: z.array(z.number().int().min(2).max(11)).max(8),
  journeyKey: z.string().min(1).max(256),
  roundTrip: z.boolean(),
  expiresAt: z.number().int(),
});
type Selection = z.infer<typeof selectionSchema>;
export const NUITEE_FLIGHT_PREFIX = "nfa_";

function sign(payload: string) {
  const key = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!key || !/^[a-f0-9]{64}$/i.test(key))
    throw new OtaError("Flight fare confirmation is unavailable.", 503);
  return createHmac("sha256", Buffer.from(key, "hex"))
    .update("ota-nuitee-flight:v1:" + payload)
    .digest();
}

function seal(selection: Selection) {
  const payload = Buffer.from(JSON.stringify(selection)).toString("base64url");
  return (
    NUITEE_FLIGHT_PREFIX + payload + "." + sign(payload).toString("base64url")
  );
}

function open(config: OtaConfig, token: string) {
  if (!config.flightsEnabled || !nuiteeFlightSearchReady(config))
    throw new OtaError("This flight supplier is currently paused.", 503);
  const [payload, signature, extra] = token
    .slice(NUITEE_FLIGHT_PREFIX.length)
    .split(".");
  if (
    !token.startsWith(NUITEE_FLIGHT_PREFIX) ||
    token.length > 8000 ||
    !payload ||
    !signature ||
    extra !== undefined ||
    !/^[a-zA-Z0-9_-]{43}$/.test(signature)
  )
    throw new OtaError("Invalid flight selection. Search again.", 400);
  const expected = sign(payload);
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new OtaError("Invalid flight selection. Search again.", 400);
  const selection = selectionSchema.parse(
    JSON.parse(Buffer.from(payload, "base64url").toString()),
  );
  if (
    selection.mode !== config.nuiteeFlightMode ||
    selection.expiresAt <= Date.now()
  )
    throw new OtaError("This flight offer expired. Search again.", 409);
  return selection;
}

async function request(
  config: OtaConfig,
  mode: Mode,
  path: string,
  body?: unknown,
  timeout = 18000,
) {
  const result = await nuiteeRequest(config, mode, NUITEE_API, path, {
    body,
    timeout,
  });
  if (
    !Array.isArray(result.data) ||
    result.data.length !== 1 ||
    !result.data[0]
  )
    throw new OtaError(
      "The flight supplier returned an incomplete response.",
      502,
    );
  return result.data[0];
}

async function fetchJourneys(
  config: OtaConfig,
  mode: Mode,
  input: NuiteeFlightSearch,
) {
  const legs = [
    {
      origin: input.origin,
      destination: input.destination,
      date: input.departureDate,
    },
  ];
  if (input.returnDate)
    legs.push({
      origin: input.destination,
      destination: input.origin,
      date: input.returnDate,
    });
  const data = await request(
    config,
    mode,
    "/flights/rates",
    {
      legs,
      adults: input.adults,
      children: input.childAges.length,
      ...(input.childAges.length ? { childrenAges: input.childAges } : {}),
      country: "NG",
      currency: "USD",
      cabinClass: input.cabinClass.toUpperCase(),
      filters: { cabinClassMatch: "exactly" },
    },
    28000,
  );
  if (!Array.isArray(data.journeys))
    throw new OtaError(
      "The flight supplier returned invalid itineraries.",
      502,
    );
  return data.journeys;
}

export async function checkNuiteeFlights(config: OtaConfig, mode: Mode) {
  const departureDate = new Date(Date.now() + 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  await fetchJourneys(config, mode, {
    origin: "LOS",
    destination: "LHR",
    departureDate,
    adults: 1,
    childAges: [],
    cabinClass: "economy",
  });
}

const airport = z.object({
  iata: code,
  name: z.string().min(1),
  city: z.string().nullish(),
});
export async function nuiteeFlightPlaces(config: OtaConfig, term: string) {
  const data = await request(
    config,
    config.nuiteeFlightMode,
    `/data/flights/airports/?${new URLSearchParams({ q: term })}`,
    undefined,
    12000,
  );
  if (!Array.isArray(data.airports))
    throw new OtaError("Airport results are unavailable.", 502);
  return data.airports.slice(0, 40).flatMap((value: unknown) => {
    const result = airport.safeParse(value);
    return result.success
      ? [
          {
            iata_code: result.data.iata,
            name: result.data.name,
            city_name: result.data.city || result.data.name,
          },
        ]
      : [];
  });
}

const segmentSchema = z.object({
  originCode: code,
  destinationCode: code,
  departureTime: timestamp,
  arrivalTime: timestamp,
  direction: z.enum(["OUTBOUND", "INBOUND"]),
  originName: z.string().optional(),
  destinationName: z.string().optional(),
  stopCount: z.number().int().min(0).optional(),
  duration: z.object({ iso8601: z.string().optional() }).optional(),
  carrier: z.object({
    marketingCode: z.string().optional(),
    marketingName: z.string().optional(),
    marketingLogo: z.string().optional(),
    operatingCode: z.string().optional(),
    operatingName: z.string().optional(),
  }),
  flight: z.object({
    marketingNumber: z.string().optional(),
    operatingNumber: z.string().optional(),
  }),
});

function normalizeJourney(
  config: OtaConfig,
  journey: any,
  quote: any,
  selection: Selection,
  id: string,
) {
  const parsed = z
    .array(segmentSchema)
    .min(1)
    .max(20)
    .safeParse(journey?.segments);
  const total = quote?.pricing?.display?.total;
  const currency = quote?.pricing?.display?.currency;
  if (
    !parsed.success ||
    typeof total !== "number" ||
    !Number.isFinite(total) ||
    total <= 0 ||
    typeof currency !== "string" ||
    !/^[A-Z]{3}$/.test(currency) ||
    !config.rates[currency]
  )
    return;
  const groups = [
    parsed.data.filter((segment) => segment.direction === "OUTBOUND"),
  ];
  const inbound = parsed.data.filter(
    (segment) => segment.direction === "INBOUND",
  );
  if (selection.roundTrip) groups.push(inbound);
  if (
    groups.some((group) => !group.length) ||
    (!selection.roundTrip && inbound.length)
  )
    return;
  const slices = groups.map((group) => {
    const segments = group.map((s) => ({
      origin: { iata_code: s.originCode, name: s.originName },
      destination: { iata_code: s.destinationCode, name: s.destinationName },
      departing_at: s.departureTime,
      arriving_at: s.arrivalTime,
      duration: s.duration?.iso8601,
      marketing_carrier: {
        name: s.carrier.marketingName,
        iata_code: s.carrier.marketingCode,
      },
      operating_carrier: {
        name: s.carrier.operatingName,
        iata_code: s.carrier.operatingCode,
      },
      marketing_carrier_flight_number: s.flight.marketingNumber,
      operating_carrier_flight_number: s.flight.operatingNumber,
      technical_stop_count: s.stopCount ?? 0,
    }));
    return {
      origin: segments[0].origin,
      destination: segments.at(-1)!.destination,
      segments,
    };
  });
  const first = parsed.data[0].carrier;
  const pricing = price(
    { ...config, flightMarkupPercent: config.nuiteeFlightMarkupPercent },
    "flight",
    String(total),
    currency,
  );
  return {
    id,
    mode: selection.mode,
    supplier: "nuitee",
    expires_at: new Date(selection.expiresAt).toISOString(),
    owner: {
      name: first.marketingName || first.marketingCode || "Airline",
      logo_symbol_url: first.marketingLogo?.startsWith("https://")
        ? first.marketingLogo
        : undefined,
    },
    total_amount: pricing.supplierAmount,
    total_currency: currency,
    slices,
    passengers: [
      ...Array.from({ length: selection.adults }, () => ({ type: "adult" })),
      ...selection.childAges.map((age) => ({ type: "child", age })),
    ].map((p, index) => ({ ...p, id: `pas_${index + 1}` })),
    pricing,
  };
}

export async function searchNuiteeFlights(
  config: OtaConfig,
  input: NuiteeFlightSearch,
) {
  const mode = config.nuiteeFlightMode;
  const journeys = await fetchJourneys(config, mode, input);
  const limit = Date.now() + 15 * 60000;
  const offers = journeys.slice(0, 200).flatMap((journey: any) => {
    if (!Array.isArray(journey?.offers)) return [];
    const candidates = (journey.offers as any[])
      .slice(0, 20)
      .flatMap((offer) => {
        const expiry = Date.parse(offer?.expiration);
        if (!Number.isFinite(expiry) || expiry <= Date.now() + 60000) return [];
        const result = selectionSchema.safeParse({
          offerId: offer.offerId,
          mode,
          adults: input.adults,
          childAges: input.childAges,
          journeyKey: journey.journeyKey,
          roundTrip: !!input.returnDate,
          expiresAt: Math.min(expiry, limit),
        });
        if (!result.success) return [];
        const normalized = normalizeJourney(
          config,
          journey,
          offer,
          result.data,
          seal(result.data),
        );
        return normalized ? [normalized] : [];
      });
    return candidates
      .sort((a, b) => a.pricing.totalKobo - b.pricing.totalKobo)
      .slice(0, 1);
  });
  if (!offers.length && journeys.length)
    throw new OtaError("This supplier returned no usable flight offers.", 502);
  return { offers };
}

export async function verifyNuiteeFlight(config: OtaConfig, token: string) {
  const selection = open(config, token);
  const { journey } = await request(config, selection.mode, "/flights/verify", {
    offerId: selection.offerId,
  });
  if (!journey || journey.journeyKey !== selection.journeyKey)
    throw new OtaError("The flight itinerary changed. Search again.", 409);
  const expiresAt = Math.min(
    selection.expiresAt,
    Date.parse(journey.expiration),
  );
  if (!Number.isFinite(expiresAt))
    throw new OtaError("This flight can no longer be verified.", 409);
  const offer = normalizeJourney(
    config,
    journey,
    journey,
    { ...selection, expiresAt },
    token,
  );
  if (!offer)
    throw new OtaError("The flight no longer has a usable price.", 409);
  available(offer);
  return { selection, offer, pricing: offer.pricing };
}

type Contact = { email: string; phone: string; phoneCountryCode?: string };
type Traveller = {
  id: string;
  title: string;
  given_name: string;
  family_name: string;
  born_on: string;
  gender: string;
  nationality?: string;
  identity_documents?: {
    unique_identifier: string;
    expires_on: string;
    issuing_country_code: string;
  }[];
};

export async function prebookNuiteeFlight(
  config: OtaConfig,
  quote: Awaited<ReturnType<typeof verifyNuiteeFlight>>,
  contact: Contact,
  travellers: Traveller[],
) {
  const callingCode = contact.phoneCountryCode;
  if (
    !callingCode ||
    !contact.phone.startsWith("+" + callingCode) ||
    contact.phone.length - callingCode.length - 1 < 4
  )
    throw new OtaError(
      "Enter the calling code that matches the contact phone number.",
      400,
    );
  const first = travellers[0];
  const passengers = travellers.map((traveller) => {
    if (!traveller.nationality || traveller.title === "dr")
      throw new OtaError(
        "Provide a nationality and a supported title for every traveller.",
        400,
      );
    const passport = traveller.identity_documents?.[0];
    return {
      firstName: traveller.given_name,
      lastName: traveller.family_name,
      title: traveller.title.toUpperCase(),
      birthday: traveller.born_on,
      gender: traveller.gender.toUpperCase(),
      nationality: traveller.nationality,
      passengerType:
        quote.offer.passengers.find((p) => p.id === traveller.id)?.type ===
        "adult"
          ? 0
          : 1,
      ...(passport
        ? {
            documentType: "passport",
            documentNumber: passport.unique_identifier,
            documentExpiry: passport.expires_on,
            documentIssueCountry: passport.issuing_country_code,
          }
        : {}),
    };
  });
  const data = await request(
    config,
    quote.selection.mode,
    "/flights/prebooks",
    {
      offerId: quote.selection.offerId,
      // N requires an SDK intent unless the account has payment bypass. The
      // intent credentials stay with N. Only the saved account card can settle.
      usePaymentSdk: true,
      contact: {
        firstName: first.given_name,
        lastName: first.family_name,
        email: contact.email,
        phoneCountryCode: callingCode,
        phoneNumber: contact.phone.slice(callingCode.length + 1),
      },
      passengers,
    },
    45000,
  );
  if (
    !Array.isArray(data.paymentTypes) ||
    !data.paymentTypes.includes("ACC_CREDIT_CARD")
  )
    throw new OtaError(
      "Online payment is unavailable for this flight. Contact travel support.",
      409,
    );
  const prebookId = z.string().uuid().safeParse(data.prebookId);
  if (
    !prebookId.success ||
    !sameSupplierAmount(String(data.price), quote.offer.total_amount) ||
    data.currency !== quote.offer.total_currency ||
    data.booking?.journey?.journeyKey !== quote.selection.journeyKey
  )
    throw new OtaError(
      "The supplier changed this flight or fare. Search again before paying.",
      409,
    );
  return prebookId.data;
}

type SavedFlight = {
  id: string;
  mode: string;
  providerOfferId: string;
  providerBookingId: string | null;
  supplierAmount: string;
  supplierCurrency: string;
  offer: unknown;
};

export async function verifyNuiteeFlightPrebook(
  config: OtaConfig,
  row: SavedFlight,
) {
  const { nuiteeFlightJourneyKey } = row.offer as {
    nuiteeFlightJourneyKey: string;
  };
  const result = await request(
    config,
    row.mode as Mode,
    `/flights/prebooks/${encodeURIComponent(row.providerOfferId)}`,
  );
  if (
    result.prebookId !== row.providerOfferId ||
    result.booking?.journey?.journeyKey !== nuiteeFlightJourneyKey ||
    !sameSupplierAmount(String(result.price), row.supplierAmount) ||
    result.currency !== row.supplierCurrency
  )
    throw new OtaError(
      "The flight changed. Review the fare before proceeding.",
      409,
    );
}

function flightBooking(row: SavedFlight, data: any) {
  const { nuiteeFlightJourneyKey } = row.offer as {
    nuiteeFlightJourneyKey: string;
  };
  if (
    data?.customTags?.RAUDAH_BOOKING !== row.id ||
    typeof data.bookingId !== "string" ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(data.bookingId) ||
    (row.providerBookingId && data.bookingId !== row.providerBookingId) ||
    data.journey?.journeyKey !== nuiteeFlightJourneyKey
  )
    throw new OtaError(
      "The supplier reservation could not be matched to this booking.",
      502,
    );
  const cancelled = ["CANCELLED", "CANCELLED_WITH_CHARGES"].includes(
    data.status,
  );
  const status = cancelled
    ? "cancelled"
    : data.status === "CONFIRMED"
      ? "confirmed"
      : data.status === "PENDING_CONFIRMATION"
        ? "processing"
        : "requires_review";
  const charged = data.payment?.amount ?? data.pricing?.totalAmount;
  const chargedCurrency = data.payment?.currency ?? data.pricing?.currency;
  if (
    status === "confirmed" &&
    (typeof charged !== "number" ||
      !Number.isFinite(charged) ||
      charged <= 0 ||
      charged > Number(row.supplierAmount) ||
      chargedCurrency !== row.supplierCurrency)
  )
    throw new OtaError(
      "The ticketed reservation needs review of the supplier charge.",
      409,
    );
  const locators = Array.isArray(data.airlineLocators)
    ? data.airlineLocators
        .map((record: any) => record.airlinePnr)
        .filter(
          (value: unknown) =>
            typeof value === "string" && /^[A-Z0-9-]{3,25}$/i.test(value),
        )
    : [];
  return {
    id: data.bookingId as string,
    status,
    booking_reference:
      locators.join(", ") ||
      (typeof data.bookingRef === "string"
        ? data.bookingRef.slice(0, 128)
        : data.bookingId),
    ...(typeof charged === "number" && /^[A-Z]{3}$/.test(chargedCurrency)
      ? {
          total_amount: String(charged),
          total_currency: chargedCurrency,
        }
      : {}),
    ...(status === "confirmed" &&
    typeof data.ticketData?.ticketedAt === "string"
      ? { ticketed_at: data.ticketData.ticketedAt }
      : {}),
  } as const;
}

export async function bookNuiteeFlight(config: OtaConfig, row: SavedFlight) {
  await verifyNuiteeFlightPrebook(config, row);
  const data = await request(
    config,
    row.mode as Mode,
    "/flights/bookings",
    {
      prebookId: row.providerOfferId,
      payment: { method: "ACC_CREDIT_CARD" },
      customTags: { RAUDAH_BOOKING: row.id },
    },
    95000,
  );
  return flightBooking(row, data.booking);
}

export async function lookupNuiteeFlight(config: OtaConfig, row: SavedFlight) {
  let bookingId = row.providerBookingId;
  if (!bookingId) {
    const query = new URLSearchParams({
      customTags: `RAUDAH_BOOKING:${row.id}`,
    });
    const result = await request(
      config,
      row.mode as Mode,
      `/flights/bookings?${query}`,
    );
    if (!Array.isArray(result.bookings))
      throw new OtaError("The supplier booking list is unavailable.", 502);
    const matches = result.bookings.filter(
      (booking: any) => booking.customTags?.RAUDAH_BOOKING === row.id,
    );
    if (!matches.length) return null;
    if (matches.length !== 1 || typeof matches[0].bookingId !== "string")
      throw new OtaError("Multiple supplier records need review.", 502);
    bookingId = matches[0].bookingId as string;
  }
  const result = await request(
    config,
    row.mode as Mode,
    `/flights/bookings/${encodeURIComponent(bookingId)}`,
  );
  return flightBooking(
    { ...row, providerBookingId: bookingId },
    result.booking,
  );
}
