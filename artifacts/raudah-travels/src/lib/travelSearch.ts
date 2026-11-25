export const MAX_MULTI_CITY_LEGS = 6;

export function hasTravelSearch(kind: "flight" | "hotel", query: URLSearchParams) {
  return kind === "flight" ? query.has("leg") || query.has("departureDate") : query.has("checkIn");
}

export function readMultiCityLegs(query: URLSearchParams) {
  return query.getAll("leg").slice(0, MAX_MULTI_CITY_LEGS + 1).map((value) => {
    const [origin = "", destination = "", departureDate = ""] = value.split(",");
    return { origin, destination, departureDate };
  });
}

type FlightSearchSnapshot = {
  trip_type?: string;
  cabin_class?: string;
  slices?: Array<{
    origin?: { iata_code?: string; iata_city_code?: string };
    destination?: { iata_code?: string; iata_city_code?: string };
    segments?: Array<{ departing_at?: string }>;
  }>;
  passengers?: Array<{ type?: string; age?: number }>;
};

export function flightRecheckHref(offer: FlightSearchSnapshot | undefined) {
  const slices = offer?.slices ?? [];
  if (!slices.length || slices.length > MAX_MULTI_CITY_LEGS) return "/flights";
  const legs = slices.map((slice) => ({
    origin: slice.origin?.iata_code ?? "",
    destination: slice.destination?.iata_code ?? "",
    date: slice.segments?.[0]?.departing_at?.slice(0, 10) ?? "",
  }));
  if (legs.some(({ origin, destination }) => !/^[A-Z]{3}$/.test(origin) ||
      !/^[A-Z]{3}$/.test(destination) || origin === destination)) return "/flights";

  const passengers = offer?.passengers ?? [];
  const adults = passengers.filter(({ type }) => type === "adult").length;
  const childAges = passengers.flatMap(({ type, age }) =>
    type === "child" && age !== undefined && Number.isInteger(age) && age >= 2 && age <= 11 ? [age] : [],
  );
  const countKnown = adults > 0 && passengers.length <= 9 && adults + childAges.length === passengers.length;
  const query = new URLSearchParams();
  if (countKnown) {
    query.set("adults", String(adults));
    query.set("childAges", childAges.join(","));
  }
  const cabin = offer?.cabin_class;
  if (cabin && Object.hasOwn(cabinNames, cabin)) query.set("cabinClass", cabin);

  const today = dateKey(new Date());
  const datesReady = legs.every(({ date }, index) =>
    !!readDate(date) && date >= today && (index === 0 || date >= legs[index - 1].date),
  );
  if (countKnown && datesReady && flightLegLabel(offer, 0) === "Flight 1") {
    for (const { origin, destination, date } of legs)
      query.append("leg", [origin, destination, date].join(","));
  } else {
    query.set("origin", legs[0].origin);
    query.set("destination", legs[0].destination);
    if (countKnown && datesReady) {
      query.set("departureDate", legs[0].date);
      if (legs.length === 2) query.set("returnDate", legs[1].date);
    }
  }
  return `/flights/search?${query}`;
}

export function flightLegLabel(offer: any, index: number) {
  const slices = offer.slices ?? [];
  if (slices.length === 1) return "Your flight";
  const iata = (place: any) => place?.iata_city_code ?? place?.iata_code;
  const outbound = slices[0];
  const inbound = slices[1];
  if (offer.trip_type === "multi_city" || slices.length !== 2 ||
      iata(outbound?.origin) !== iata(inbound?.destination) ||
      iata(outbound?.destination) !== iata(inbound?.origin))
    return `Flight ${index + 1}`;
  return index === 0 ? "Outbound" : "Return";
}

export const popularAirports = [
  {
    code: "LOS",
    city: "Lagos",
    name: "Murtala Muhammed International",
    region: "Nigeria",
  },
  {
    code: "ABV",
    city: "Abuja",
    name: "Nnamdi Azikiwe International",
    region: "Nigeria",
  },
  {
    code: "KAN",
    city: "Kano",
    name: "Mallam Aminu Kano International",
    region: "Nigeria",
  },
  {
    code: "PHC",
    city: "Port Harcourt",
    name: "Port Harcourt International",
    region: "Nigeria",
  },
  {
    code: "JED",
    city: "Jeddah",
    name: "King Abdulaziz International",
    region: "Saudi Arabia & Middle East",
  },
  {
    code: "MED",
    city: "Madinah",
    name: "Prince Mohammad bin Abdulaziz",
    region: "Saudi Arabia & Middle East",
  },
  {
    code: "DXB",
    city: "Dubai",
    name: "Dubai International",
    region: "Saudi Arabia & Middle East",
  },
  {
    code: "DOH",
    city: "Doha",
    name: "Hamad International",
    region: "Saudi Arabia & Middle East",
  },
  { code: "LHR", city: "London", name: "Heathrow", region: "International" },
  {
    code: "IST",
    city: "Istanbul",
    name: "Istanbul Airport",
    region: "International",
  },
  {
    code: "ACC",
    city: "Accra",
    name: "Kotoka International",
    region: "International",
  },
  {
    code: "CAI",
    city: "Cairo",
    name: "Cairo International",
    region: "International",
  },
  {
    code: "CDG",
    city: "Paris",
    name: "Charles de Gaulle",
    region: "International",
  },
  {
    code: "JFK",
    city: "New York",
    name: "John F. Kennedy International",
    region: "International",
  },
];
export const airportTitle = (code: string) =>
  popularAirports.find((p) => p.code === code)?.city || code;
export const cabinNames: Record<string, string> = {
  economy: "Economy",
  premium_economy: "Premium economy",
  business: "Business",
  first: "First",
};
export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function readDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && dateKey(date) === value
    ? date
    : undefined;
}
export function moveDate(value: string, offset: number) {
  const date = readDate(value);
  if (!date) return "";
  date.setDate(date.getDate() + offset);
  return dateKey(date);
}
export function flightStops(offer: any): number {
  if (offer.estimate) return offer.estimate.stops;
  return Math.max(
    0,
    ...(offer.slices || []).map(
      (slice: any) =>
        Math.max(0, (slice.segments?.length || 1) - 1) +
        (slice.segments || []).reduce(
          (n: number, segment: any) =>
            n + (segment.technical_stop_count ?? segment.stops?.length ?? 0),
          0,
        ),
    ),
  );
}
export function durationMinutes(value: string = "") {
  const match =
    /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(value);
  return match
    ? Number(match[1] || 0) * 1440 +
        Number(match[2] || 0) * 60 +
        Number(match[3] || 0) +
        Number(match[4] || 0) / 60
    : Infinity;
}
export function flightDurationLabel(value?: string) {
  const minutes = Math.round(durationMinutes(value));
  if (!Number.isFinite(minutes)) return "";
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}
export const flightDuration = (offer: any) =>
  offer.estimate
    ? (Date.parse(offer.estimate.arrival.slice(0, 16) + "Z") -
        Date.parse(offer.estimate.departure.slice(0, 16) + "Z")) /
      60000
    : (offer.slices || []).reduce(
        (n: number, slice: any) => n + durationMinutes(slice.duration),
        0,
      ) || Infinity;
export const airlineKey = (offer: any): string =>
  offer.owner?.id || offer.owner?.name || "other";
const departureTime = (offer: any) =>
  offer.estimate?.departure ??
  offer.slices?.[0]?.segments?.[0]?.departing_at ??
  "";
export type FlightFilters = {
  stops: string;
  airlines: string[];
  budget: number | null;
  departure: string;
  sort: string;
};
export function selectFlights(offers: any[], filter: FlightFilters) {
  return offers
    .filter((offer) => {
      const hour = Number.parseInt(departureTime(offer).slice(11, 13), 10);
      return (
        (filter.stops === "all" ||
          flightStops(offer) <= Number(filter.stops)) &&
        (!filter.airlines.length ||
          filter.airlines.includes(airlineKey(offer))) &&
        (filter.budget === null || offer.pricing.totalKobo <= filter.budget) &&
        (filter.departure === "all" ||
          (Number.isFinite(hour) &&
            Math.floor(hour / 6) === Number(filter.departure)))
      );
    })
    .sort((a, b) =>
      filter.sort === "duration"
        ? flightDuration(a) - flightDuration(b) ||
          a.pricing.totalKobo - b.pricing.totalKobo
        : filter.sort === "departure"
          ? departureTime(a).localeCompare(departureTime(b))
          : a.pricing.totalKobo - b.pricing.totalKobo,
    );
}
