import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { nuiteeFlightSearchReady, type OtaConfig } from "./config";
import { NUITEE_API, nuiteeRequest } from "./nuitee";
import { OtaError, price, sameSupplierAmount, available } from "./provider";
import {
  itineraryLegs,
  MAX_MULTI_CITY_LEGS,
  multiCityLegs,
  type FlightLeg,
} from "./flightItinerary";
import { matchesFlightAirport } from "./metroAirports";

type Mode = OtaConfig["nuiteeFlightMode"];
export type NuiteeFlightSearch = {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  legs?: FlightLeg[];
  adults: number;
  childAges: number[];
  cabinClass: string;
};
const timestamp = z.string().datetime({ local: true, offset: true });
const code = z.string().regex(/^[A-Z0-9]{3}$/);
const providerId = z.string().min(1).max(4096);
const elapsed = z
  .string()
  .regex(/^P(?:\d+D)?T(?=\d)(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?$/);
const legDurations = z.object({
  OUTBOUND: elapsed.optional(),
  INBOUND: elapsed.optional(),
});
export const nuiteeFlightCabin = z.enum(["economy", "premium_economy", "business", "first"]);
const selectionSchema = z.object({
  offerId: providerId,
  mode: z.enum(["test", "live"]),
  adults: z.number().int().min(1).max(9),
  childAges: z.array(z.number().int().min(2).max(11)).max(8),
  cabinClass: nuiteeFlightCabin.optional(),
  journeyKey: z.string().min(1).max(256),
  roundTrip: z.boolean(),
  legs: multiCityLegs.optional(),
  legDurations: legDurations.optional(),
  multiCityDurations: z
    .array(elapsed.nullable())
    .max(MAX_MULTI_CITY_LEGS)
    .optional(),
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
    flightOfferUnavailable: path === "/flights/verify" || path.startsWith("/flights/prebooks/"),
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
  const legs = itineraryLegs(input).map(({ origin, destination, departureDate }) => ({
    origin, destination, date: departureDate,
  }));
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
  legIndex: z.number().int().nonnegative().optional(),
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

const providerDuration = z.object({
  direction: z.enum(["OUTBOUND", "INBOUND"]),
  legIndex: z.number().int().nonnegative().optional(),
  duration: z.object({ iso8601: elapsed }),
});
const baggageItem = z.object({
  bagType: z.enum(["cabin", "checked", "personal", "equipment"]),
  passengerType: z.enum(["ADT", "CHD", "INF", "ALL"]),
  pieces: z.number().int().nonnegative().nullish(),
  weightKg: z.number().nonnegative().nullish(),
  description: z.string().trim().max(500).optional(),
});
const supplierFee = z.object({
  pricing: z
    .object({
      display: z
        .object({
          amount: z.number().nonnegative(),
          currency: z.string().regex(/^[A-Z]{3}$/),
        })
        .optional(),
    })
    .optional(),
  percent: z.number().nonnegative().optional(),
  applicability: z.string().max(50).optional(),
  label: z.string().max(200).optional(),
});

function allowanceDetails(quote: any) {
  const terms = quote?.terms;
  const fee = (value: unknown) => {
    const parsed = supplierFee.safeParse(value);
    if (!parsed.success) return;
    const { pricing, percent, applicability, label } = parsed.data;
    return { ...pricing?.display, percent, applicability, label };
  };
  const notes = Array.isArray(terms?.summary)
    ? terms.summary
        .flatMap((item: any) =>
          typeof item?.message === "string" && item.message.trim()
            ? [item.message.trim().slice(0, 500)]
            : [],
        )
        .slice(0, 20)
    : [];
  const baggage = Array.isArray(quote?.baggage?.included)
    ? quote.baggage.included.slice(0, 24).flatMap((item: unknown) => {
        const result = baggageItem.safeParse(item);
        return result.success ? [result.data] : [];
      })
    : [];
  return {
    ...(terms
      ? {
          fare_terms: {
            refundable:
              typeof terms.refundable === "boolean"
                ? terms.refundable
                : undefined,
            changeable:
              typeof terms.changeable === "boolean"
                ? terms.changeable
                : undefined,
            refund_fee: fee(terms.refundFee),
            change_fee: fee(terms.changeFee),
            has_refund_fee: terms.hasRefundFee === true,
            has_change_fee: terms.hasChangeFee === true,
            notes,
          },
        }
      : {}),
    ...(quote?.baggage
      ? {
          baggage_allowances: {
            included: baggage,
            has_carry_on:
              typeof quote.baggage.hasCarryOnBag === "boolean"
                ? quote.baggage.hasCarryOnBag
                : undefined,
            has_checked_bag:
              typeof quote.baggage.hasCheckedBag === "boolean"
                ? quote.baggage.hasCheckedBag
                : undefined,
          },
        }
      : {}),
  };
}

function journeyDurations(journey: any) {
  const durations: z.infer<typeof legDurations> = {};
  for (const item of Array.isArray(journey?.legDurations)
    ? journey.legDurations
    : []) {
    const parsed = providerDuration.safeParse(item);
    if (parsed.success)
      durations[parsed.data.direction] = parsed.data.duration.iso8601;
  }
  return durations;
}

type FlightSegment = z.infer<typeof segmentSchema>;

function groupMultiCitySegments(segments: FlightSegment[], legs: FlightLeg[], compareDates = true) {
  // Leg indices constrain the partition when supplied. The route, dates and
  // airport continuity also have to match, including for unindexed segments.
  const partitions: FlightSegment[][][] = [];
  function match(legIndex: number, offset: number, groups: FlightSegment[][]) {
    if (partitions.length > 1) return;
    if (legIndex === legs.length) {
      if (offset === segments.length) partitions.push(groups);
      return;
    }
    const leg = legs[legIndex];
    const first = segments[offset];
    if (
      !first ||
      !matchesFlightAirport(leg.origin, first.originCode) ||
      (compareDates && first.departureTime.slice(0, 10) !== leg.departureDate)
    )
      return;
    for (let end = offset; end < segments.length; end++) {
      const segment = segments[end];
      if (segment.legIndex !== undefined && segment.legIndex !== legIndex) break;
      if (end > offset && segments[end - 1].destinationCode !== segment.originCode)
        break;
      if (matchesFlightAirport(leg.destination, segment.destinationCode))
        match(legIndex + 1, end + 1, [...groups, segments.slice(offset, end + 1)]);
    }
  }
  match(0, 0, []);
  return partitions.length === 1 ? partitions[0] : undefined;
}

function multiCityLegDurations(
  journey: { legDurations?: unknown },
  count: number,
) {
  const values: unknown[] = Array.isArray(journey.legDurations)
    ? journey.legDurations
    : [];
  const durationsByPosition = values.map((value) => providerDuration.safeParse(value));
  const indexed = durationsByPosition.some(
    (parsed) => parsed.success && parsed.data.legIndex !== undefined,
  );
  const durations = new Map<number, string>();
  for (const [position, parsed] of durationsByPosition.entries()) {
    if (!parsed.success) continue;
    const index = indexed
      ? parsed.data.legIndex
      : values.length === count ? position : undefined;
    if (index !== undefined && index < count)
      durations.set(index, parsed.data.duration.iso8601);
  }
  return durations;
}

function segmentElapsed(group: FlightSegment[]) {
  if (group.length === 1) {
    const duration = elapsed.safeParse(group[0].duration?.iso8601);
    if (duration.success) return duration.data;
  }
  const departure = group[0].departureTime;
  const arrival = group.at(-1)!.arrivalTime;
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i;
  if (!hasOffset.test(departure) || !hasOffset.test(arrival)) return;
  const seconds = (Date.parse(arrival) - Date.parse(departure)) / 1000;
  return Number.isFinite(seconds) && seconds > 0 ? `PT${seconds}S` : undefined;
}

function presentSegments(group: FlightSegment[]) {
  return group.map((s) => ({
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
}

function normalizeJourney(
  config: OtaConfig,
  journey: any,
  quote: any,
  selection: Selection,
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
  const directionalGroups = [
    parsed.data.filter((segment) => segment.direction === "OUTBOUND"),
  ];
  const inbound = parsed.data.filter(
    (segment) => segment.direction === "INBOUND",
  );
  if (selection.roundTrip) directionalGroups.push(inbound);
  const groups = selection.legs
    ? groupMultiCitySegments(parsed.data, selection.legs)
    : directionalGroups;
  if (
    !groups ||
    groups.some((group) => !group.length) ||
    (!selection.legs && !selection.roundTrip && inbound.length)
  )
    return;
  const durations = { ...selection.legDurations, ...journeyDurations(journey) };
  const orderedDurations = selection.legs && multiCityLegDurations(journey, groups.length);
  const slices = groups.map((group, index) => {
    const segments = presentSegments(group);
    return {
      origin: segments[0].origin,
      destination: segments.at(-1)!.destination,
      duration: orderedDurations
        ? orderedDurations.get(index) ?? selection.multiCityDurations?.[index] ?? segmentElapsed(group)
        : durations[group[0].direction] ?? (group.length === 1 ? segments[0].duration : undefined),
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
    mode: selection.mode,
    supplier: "nuitee",
    ...(selection.legs ? { trip_type: "multi_city" } : {}),
    expires_at: new Date(selection.expiresAt).toISOString(),
    owner: {
      name: first.marketingName || first.marketingCode || "Airline",
      iata_code: first.marketingCode,
      logo_symbol_url: first.marketingLogo?.startsWith("https://")
        ? first.marketingLogo
        : undefined,
    },
    total_amount: pricing.supplierAmount,
    total_currency: currency,
    ...(selection.cabinClass ? { cabin_class: selection.cabinClass } : {}),
    ...allowanceDetails(quote),
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
  const offers: (NonNullable<ReturnType<typeof normalizeJourney>> & { id: string })[] = journeys.slice(0, 200).flatMap((journey: any) => {
    if (!Array.isArray(journey?.offers)) return [];
    const durations = journeyDurations(journey);
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
          cabinClass: input.cabinClass,
          journeyKey: journey.journeyKey,
          roundTrip: !!input.returnDate,
          legs: input.legs,
          legDurations: durations,
          expiresAt: Math.min(expiry, limit),
        });
        if (!result.success) return [];
        const normalized = normalizeJourney(
          config,
          journey,
          offer,
          result.data,
        );
        if (!normalized) return [];
        const selection = result.data.legs ? {
          ...result.data,
          legs: normalized.slices.map((slice) => ({
            origin: slice.origin.iata_code,
            destination: slice.destination.iata_code,
            departureDate: slice.segments[0].departing_at.slice(0, 10),
          })),
          multiCityDurations: normalized.slices.map((slice) => slice.duration ?? null),
        } : result.data;
        return [{ ...normalized, id: seal(selection) }];
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
  );
  if (!offer)
    throw new OtaError("The full itinerary and fare could not be verified. Search again.", 409);
  available(offer);
  return { selection, offer: { ...offer, id: token }, pricing: offer.pricing };
}

const savedAirport = z.object({ iata_code: code });
const savedCarrier = z.object({ iata_code: z.string().min(2) });
const savedFlight = z.object({
  trip_type: z.literal("multi_city").optional(),
  cabin_class: nuiteeFlightCabin.optional(),
  slices: z.array(z.object({
    segments: z.array(z.object({
      origin: savedAirport,
      destination: savedAirport,
      departing_at: timestamp,
      arriving_at: timestamp,
      marketing_carrier: savedCarrier,
      marketing_carrier_flight_number: z.string().min(1),
      operating_carrier: savedCarrier.partial().optional(),
      operating_carrier_flight_number: z.string().min(1).optional(),
    })).min(1).max(20),
  })).min(1).max(MAX_MULTI_CITY_LEGS),
  passengers: z.array(z.discriminatedUnion("type", [
    z.object({ type: z.literal("adult") }),
    z.object({ type: z.literal("child"), age: z.number().int().min(2).max(11) }),
  ])).min(1).max(9),
});

export function matchesNuiteeFlightDraft(saved: unknown, fresh: unknown) {
  const previous = savedFlight.safeParse(saved);
  const current = savedFlight.safeParse(fresh);
  if (!previous.success || !current.success || !current.data.cabin_class) return false;
  const { cabin_class: previousCabin, ...previousItinerary } = previous.data;
  const { cabin_class: currentCabin, ...currentItinerary } = current.data;
  return (!previousCabin || previousCabin === currentCabin) &&
    JSON.stringify(previousItinerary) === JSON.stringify(currentItinerary);
}

export async function refreshNuiteeFlightFare(
  config: OtaConfig,
  saved: unknown,
  requestedCabin?: z.infer<typeof nuiteeFlightCabin>,
) {
  const unavailable = () => new OtaError(
    "We couldn't find a current fare for these exact flights. See current flights to choose another option.",
    409, undefined, "flight_offer_unavailable",
  );
  const parsed = savedFlight.safeParse(saved);
  if (!parsed.success) throw unavailable();
  const { cabin_class, passengers, slices, trip_type } = parsed.data;
  const cabinClass = cabin_class ?? requestedCabin;
  if (!cabinClass) throw new OtaError("Choose a cabin class to check the current fare.");
  const legs = slices.map(({ segments }) => ({
    origin: segments[0].origin.iata_code,
    destination: segments[segments.length - 1].destination.iata_code,
    departureDate: segments[0].departing_at.slice(0, 10),
  }));
  if (legs[0].departureDate < new Date().toISOString().slice(0, 10)) throw unavailable();
  const matchesDraft = (offer: unknown) => matchesNuiteeFlightDraft(
    { ...parsed.data, cabin_class: cabinClass }, offer,
  );
  const { offers } = await searchNuiteeFlights(config, {
    ...legs[0],
    ...(trip_type === "multi_city" ? { legs } : legs[1] ? { returnDate: legs[1].departureDate } : {}),
    cabinClass,
    adults: passengers.filter((passenger) => passenger.type === "adult").length,
    childAges: passengers.flatMap((passenger) => passenger.type === "child" ? [passenger.age] : []),
  });
  const match = offers.filter(matchesDraft).sort((a, b) => a.pricing.totalKobo - b.pricing.totalKobo)[0];
  if (!match) throw unavailable();
  const quote = await verifyNuiteeFlight(config, match.id);
  if (!matchesDraft(quote.offer)) throw unavailable();
  return quote;
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
    data.booking?.journey?.journeyKey !== quote.selection.journeyKey ||
    !matchesPrebookFare(data, quote.offer.total_amount, quote.offer.total_currency)
  )
    throw new OtaError(
      "The supplier changed this flight or fare. Search again before paying.",
      409, undefined, "flight_fare_changed",
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

function usdCents(amount: string) {
  const parts = /^(\d{1,16})(?:\.(\d{1,2}))?$/.exec(amount);
  return parts ? BigInt(parts[1] + (parts[2] ?? "").padEnd(2, "0")) : null;
}

function matchesPrebookFare(
  prebook: { price?: unknown; currency?: unknown; booking?: { journey?: { pricing?: { display?: { currency?: unknown; total?: unknown } } } } },
  savedAmount: string,
  savedCurrency: string,
) {
  if (prebook.currency !== savedCurrency) return false;
  const payableAmount = String(prebook.price);
  if (sameSupplierAmount(payableAmount, savedAmount)) return true;
  // The payable USD amount can be one cent lower than the matching displayed fare.
  const display = prebook.booking?.journey?.pricing?.display;
  if (savedCurrency !== "USD" || display?.currency !== savedCurrency ||
      !sameSupplierAmount(String(display.total), savedAmount)) return false;
  const saved = usdCents(savedAmount), payable = usdCents(payableAmount);
  return saved !== null && payable !== null && payable > 0n && saved - payable === 1n;
}

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
  const journey = result.booking?.journey;
  if (
    result.prebookId !== row.providerOfferId ||
    !nuiteeFlightJourneyKey || journey?.journeyKey !== nuiteeFlightJourneyKey
  )
    throw new OtaError(
      "We couldn’t confirm this flight. Search again to see current options.",
      409, undefined, "flight_offer_unavailable",
    );

  if (matchesPrebookFare(result, row.supplierAmount, row.supplierCurrency)) return;
  throw new OtaError(
    "The saved fare has changed. Review current flight prices before paying.",
    409, undefined, "flight_fare_changed",
  );
}

function bookedSlices(offer: unknown, journey: any) {
  const saved = z.object({ slices: z.array(z.object({
    origin: z.object({ iata_code: code }),
    destination: z.object({ iata_code: code }),
  })).min(1).max(MAX_MULTI_CITY_LEGS) }).safeParse(offer);
  const itinerary = z.array(segmentSchema).min(1).max(20).safeParse(journey?.segments);
  if (!saved.success || !itinerary.success) return;
  const count = saved.data.slices.length;
  const segments = itinerary.data;
  const indexed = Array.from({ length: count }, (_, index) =>
    segments.filter((segment) => segment.legIndex === index));
  const contiguous = (leg: FlightSegment[]) =>
    leg.every((segment, index) => index === 0 || leg[index - 1].destinationCode === segment.originCode);
  const sameIndexedOrder = indexed.flat().every((segment, index) => segment === segments[index]);
  const groups = indexed.every((leg) => leg.length && contiguous(leg)) &&
      indexed.flat().length === segments.length && sameIndexedOrder
    ? indexed
    : groupMultiCitySegments(segments, saved.data.slices.map((leg) => ({
        origin: leg.origin.iata_code, destination: leg.destination.iata_code, departureDate: "",
      })), false) ?? (count === 1 && contiguous(segments) ? [segments] : undefined);
  if (!groups) return;
  const durations = multiCityLegDurations(journey, count);
  return groups.map((group, index) => {
    const displayed = presentSegments(group);
    return {
      origin: displayed[0].origin,
      destination: displayed.at(-1)!.destination,
      segments: displayed,
      duration: durations.get(index) ?? segmentElapsed(group),
    };
  });
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
    (!row.providerBookingId && data.journey?.journeyKey !== nuiteeFlightJourneyKey)
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
  const slices = bookedSlices(row.offer, data.journey);
  const itineraryReview = !cancelled && !slices && typeof data.journey?.journeyKey === "string" &&
    data.journey.journeyKey !== nuiteeFlightJourneyKey;
  return {
    ...(slices ? { slices } : {}),
    ...(itineraryReview ? { itineraryReview: true } : {}),
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
      `/flights/bookings/?${query}`,
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
  if (result.booking?.bookingId !== bookingId)
    throw new OtaError("The supplier reservation could not be matched to this booking.", 502);
  return flightBooking(row, result.booking);
}
