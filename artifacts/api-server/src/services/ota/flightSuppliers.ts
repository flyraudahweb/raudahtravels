import { z } from "zod";
import {
  bilalFlightSearchReady,
  bilalFlightCheckoutReady,
  bilalMode,
  bilalTokenForMode,
  primaryFlightSearchReady,
  nuiteeFlightSearchReady,
  type OtaConfig,
} from "./config";
import { duffelRequest, OtaError, price } from "./provider";
import {
  openDomesticFare,
  recordDomesticFareIncrease,
  sealDomesticFare,
  type DomesticFareQuote,
} from "./domesticFareChecks";
import { searchNuiteeFlights, nuiteeFlightPlaces } from "./nuiteeFlights";
import { itineraryLegs, type FlightLeg } from "./flightItinerary";

type FlightSearch = {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  legs?: FlightLeg[];
  adults: number;
  childAges: number[];
  cabinClass: DomesticFareQuote["search"]["cabinClass"];
};

type Airport = { iata_code: string; name: string; city_name: string };
type EstimatedFare = {
  airline: string;
  origin: string;
  destination: string;
  departure: string;
  arrival: string;
  stops: number;
  cabin: string;
  estimatedTotalKobo: number;
  fareCheckToken?: string;
  checkoutOfferId?: string;
};
type FlightInventory = { offers: any[] } | { estimatedFares: EstimatedFare[] };

interface FlightSupplier {
  supportsMultiCity: boolean;
  isEnabled(config: OtaConfig): boolean;
  covers(config: OtaConfig, input: FlightSearch): boolean;
  search(
    config: OtaConfig,
    input: FlightSearch,
    includeFareCheckTokens: boolean,
  ): Promise<FlightInventory>;
  places(config: OtaConfig, term: string): Promise<Airport[]>;
}

const iata = z.string().regex(/^[A-Z]{3}$/);
const localTime = z.string().max(40).datetime({ local: true, offset: true });
const bilalFare = z.object({
  flight_id: z.string().min(1).max(256),
  airline: z.string().trim().min(1).max(100),
  price: z.number().positive(),
  currency: z.literal("NGN"),
  cabin: z.string(),
  departure: localTime,
  arrival: localTime,
  stops: z.number().int().min(0).max(12),
});
const bilalAirport = z.object({
  code: iata,
  name: z.string().trim().min(1).max(150),
  city: z.string().trim().min(1).max(100),
  country: z.string(),
});
const bilalResponse = z.object({
  status: z.literal("success"),
  data: z.array(z.unknown()),
});

async function bilalGet(
  config: OtaConfig,
  path: "search" | "airports",
  params: URLSearchParams,
) {
  const token = bilalTokenForMode(config);
  if (!token)
    throw new OtaError("Domestic flight search is not configured", 503);
  try {
    const response = await fetch(
      `https://bilalsadasub.com/api/flight/${path}?${params}`,
      {
        headers: {
          Authorization: `Token ${token}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8_000),
        redirect: "error",
      },
    );
    if (response.ok) {
      const result = bilalResponse.safeParse(await response.json());
      if (result.success) return result.data.data;
    }
  } catch {
    // The supplier's response can contain account details. Return a local message.
  }
  throw new OtaError(
    "Domestic flight availability could not be checked. Please try again.",
    502,
  );
}

export async function bilalAirports(
  config: OtaConfig,
  term: string,
): Promise<Airport[]> {
  const raw = await bilalGet(
    config,
    "airports",
    new URLSearchParams({ keyword: term }),
  );
  return raw.slice(0, 100).flatMap((value) => {
    const result = bilalAirport.safeParse(value);
    if (!result.success) return [];
    const { code, name, city, country } = result.data;
    if (
      !/^(ng|nigeria)$/i.test(country.trim()) ||
      !config.bilalAirports.includes(code)
    )
      return [];
    return [{ iata_code: code, name, city_name: city }];
  });
}

function coversDomesticFare(config: OtaConfig, input: FlightSearch) {
  return (
    !input.returnDate &&
    !input.legs &&
    [input.origin, input.destination].every((code) =>
      config.bilalAirports.includes(code),
    )
  );
}

async function fetchDomesticFares(config: OtaConfig, input: FlightSearch) {
  const raw = await bilalGet(
    config,
    "search",
    new URLSearchParams({
      origin: input.origin,
      destination: input.destination,
      departure_date: input.departureDate,
      adults: String(input.adults),
      children: String(input.childAges.length),
      cabin: input.cabinClass,
    }),
  );
  const fares: DomesticFareQuote["fare"][] = [];
  for (const value of raw.slice(0, 200)) {
    const fare = bilalFare.safeParse(value);
    if (!fare.success) continue;
    const {
      airline,
      price: amount,
      cabin,
      departure,
      arrival,
      stops,
    } = fare.data;
    if (
      cabin !== input.cabinClass ||
      !departure.startsWith(input.departureDate + "T") ||
      arrival.slice(0, 16) < departure.slice(0, 16)
    )
      continue;
    try {
      const pricing = price(config, "bilalsadasub", String(amount), "NGN");
      fares.push({
        supplierId: fare.data.flight_id,
        airline,
        departure,
        arrival,
        stops,
        supplierKobo: pricing.supplierKobo,
        estimatedTotalKobo: pricing.totalKobo,
      });
    } catch (error) {
      if (!(error instanceof OtaError)) throw error;
    }
  }
  if (raw.length && !fares.length)
    throw new OtaError("Domestic supplier returned no usable fares", 502);
  return fares;
}

export async function refreshDomesticQuote(
  config: OtaConfig,
  quote: DomesticFareQuote,
) {
  const pinned = { ...config, bilalMode: quote.mode };
  const { fare } = quote;
  const schedules = (await fetchDomesticFares(pinned, quote.search)).filter(
    (candidate) =>
      candidate.airline === fare.airline &&
      candidate.departure === fare.departure &&
      candidate.arrival === fare.arrival &&
      candidate.stops === fare.stops,
  );
  const exact = schedules.filter(
    (candidate) => candidate.supplierId === fare.supplierId,
  );
  const refreshed =
    exact.length === 1
      ? exact[0]
      : schedules.length === 1
        ? schedules[0]
        : undefined;
  if (!refreshed) return null;
  const match = exact.length === 1 ? "same_offer" : "matching_schedule";
  if (refreshed.supplierKobo > fare.supplierKobo)
    await recordDomesticFareIncrease(quote, refreshed, match);
  return { refreshed, match } as const;
}

export async function checkDomesticFare(config: OtaConfig, token: string) {
  const quote = openDomesticFare(token);
  if (
    !config.flightsEnabled ||
    !bilalFlightSearchReady(config) ||
    bilalMode(config) !== quote.mode ||
    !coversDomesticFare(config, quote.search)
  )
    throw new OtaError("Please search again for current domestic fares.", 409);
  const result = await refreshDomesticQuote(config, quote);
  if (!result) return { status: "unavailable" } as const;
  return {
    status: "available",
    match: result.match,
    estimatedTotalKobo: result.refreshed.estimatedTotalKobo,
  } as const;
}

export async function prepareDomesticCheckout(
  config: OtaConfig,
  offerId: string,
) {
  if (!bilalFlightCheckoutReady(config))
    throw new OtaError("Domestic online checkout is paused.", 503);
  const quote = openDomesticFare(offerId.slice("bilal_".length));
  if (
    quote.mode !== bilalMode(config) ||
    quote.fare.stops !== 0 ||
    !coversDomesticFare(config, quote.search)
  )
    throw new OtaError(
      "This domestic flight is unavailable for online booking. Search again.",
      409,
    );
  const result = await refreshDomesticQuote(config, quote);
  if (!result)
    throw new OtaError(
      "This exact itinerary is no longer available. Search again.",
      409,
    );
  const { refreshed } = result;
  const { origin, destination, adults, childAges } = quote.search;
  const pricing = price(
    config,
    "bilalsadasub",
    String(refreshed.supplierKobo / 100),
    "NGN",
  );
  const offer = {
    id: offerId,
    expires_at: new Date(quote.expiresAt).toISOString(),
    mode: quote.mode,
    owner: { name: refreshed.airline },
    total_amount: pricing.supplierAmount,
    total_currency: "NGN",
    passengers: [
      ...Array.from({ length: adults }, () => ({ type: "adult" })),
      ...childAges.map((age) => ({ type: "child", age })),
    ].map((passenger, index) => ({ ...passenger, id: `pas_${index + 1}` })),
    slices: [
      {
        origin: { iata_code: origin },
        destination: { iata_code: destination },
        segments: [
          {
            origin: { iata_code: origin },
            destination: { iata_code: destination },
            departing_at: refreshed.departure,
            arriving_at: refreshed.arrival,
          },
        ],
      },
    ],
  };
  return { offer, pricing, quote: { ...quote, fare: refreshed } };
}

const suppliers: FlightSupplier[] = [
  {
    supportsMultiCity: true,
    isEnabled: nuiteeFlightSearchReady,
    covers: () => true,
    search: searchNuiteeFlights,
    places: nuiteeFlightPlaces,
  },
  {
    supportsMultiCity: true,
    isEnabled: primaryFlightSearchReady,
    covers: () => true,
    async search(config, input) {
      const slices = itineraryLegs(input).map(
        ({ origin, destination, departureDate }) => ({
          origin,
          destination,
          departure_date: departureDate,
        }),
      );
      const data = await duffelRequest(
        config,
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
      return {
        offers: (data.offers || [])
          .filter((offer: any) =>
            !input.legs ||
            (Array.isArray(offer?.slices) &&
              offer.slices.length === slices.length &&
              offer.slices.every((slice: any) =>
                Array.isArray(slice?.segments) && slice.segments.length,
              )),
          )
          .map((offer: any) => ({
            ...offer,
            ...(input.legs ? { trip_type: "multi_city" } : {}),
            pricing: price(
              config,
              "flight",
              offer.total_amount,
              offer.total_currency,
            ),
          })),
      };
    },
    places: (config, term) =>
      duffelRequest(
        config,
        `/places/suggestions?query=${encodeURIComponent(term)}`,
      ),
  },
  {
    supportsMultiCity: false,
    isEnabled: bilalFlightSearchReady,
    // The published search result only describes an outbound journey.
    covers: coversDomesticFare,
    async search(config, input, includeFareCheckTokens) {
      const expiresAt = Date.now() + 10 * 60_000;
      const estimatedFares = (await fetchDomesticFares(config, input)).map(
        (fare) => {
          const token = includeFareCheckTokens
            ? sealDomesticFare({
                mode: bilalMode(config),
                search: input,
                fare,
                expiresAt,
              })
            : undefined;
          return {
            airline: fare.airline,
            origin: input.origin,
            destination: input.destination,
            departure: fare.departure,
            arrival: fare.arrival,
            stops: fare.stops,
            cabin: input.cabinClass,
            estimatedTotalKobo: fare.estimatedTotalKobo,
            ...(token ? { fareCheckToken: token } : {}),
            ...(token && fare.stops === 0 && bilalFlightCheckoutReady(config)
              ? { checkoutOfferId: `bilal_${token}` }
              : {}),
          };
        },
      );
      return { estimatedFares };
    },
    places: bilalAirports,
  },
];

export function flightSearchReady(config: OtaConfig) {
  return (
    config.flightsEnabled &&
    suppliers.some((supplier) => supplier.isEnabled(config))
  );
}

export function multiCityFlightSearchReady(config: OtaConfig) {
  return (
    config.flightsEnabled &&
    suppliers.some((supplier) => supplier.supportsMultiCity && supplier.isEnabled(config))
  );
}

function configuredSuppliers(config: OtaConfig) {
  const enabled = suppliers.filter((supplier) => supplier.isEnabled(config));
  if (!enabled.length)
    throw new OtaError(
      "Travel search is not configured. Please contact support.",
      503,
    );
  return enabled;
}

export async function searchFlights(
  config: OtaConfig,
  input: FlightSearch,
  includeFareCheckTokens = false,
) {
  const eligible = configuredSuppliers(config).filter((supplier) =>
    (!input.legs || supplier.supportsMultiCity) && supplier.covers(config, input),
  );
  if (input.legs && !eligible.length)
    throw new OtaError("Multi-city search is currently unavailable.", 503);
  const settled = await Promise.allSettled(
    eligible.map((supplier) =>
      supplier.search(config, input, includeFareCheckTokens),
    ),
  );
  const results = settled.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  if (settled.length && !results.length) {
    if (settled.length === 1 && settled[0].status === "rejected")
      throw settled[0].reason;
    throw new OtaError(
      "Flight availability could not be checked. Please try again.",
      502,
    );
  }
  const offers = results.flatMap((result) =>
    "offers" in result ? result.offers : [],
  );
  const estimates = results.flatMap((result) =>
    "estimatedFares" in result ? result.estimatedFares : [],
  );
  return {
    offers: offers
      .sort((a, b) => a.pricing.totalKobo - b.pricing.totalKobo)
      .slice(0, 80),
    ...(estimates.length
      ? {
          estimatedFares: estimates
            .sort((a, b) => a.estimatedTotalKobo - b.estimatedTotalKobo)
            .slice(0, 40),
        }
      : {}),
    ...(results.length < settled.length ? { partialAvailability: true } : {}),
  };
}

export async function searchFlightPlaces(config: OtaConfig, term: string) {
  const settled = await Promise.allSettled(
    configuredSuppliers(config).map((supplier) =>
      supplier.places(config, term),
    ),
  );
  if (settled.length && settled.every((result) => result.status === "rejected"))
    throw settled[0].reason;
  const seen = new Set<string>();
  return settled
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((place) => {
      if (!place.iata_code) return true;
      if (seen.has(place.iata_code)) return false;
      seen.add(place.iata_code);
      return true;
    });
}
