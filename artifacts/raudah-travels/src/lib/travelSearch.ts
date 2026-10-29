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
  return Math.max(
    0,
    ...(offer.slices || []).map(
      (slice: any) =>
        Math.max(0, (slice.segments?.length || 1) - 1) +
        (slice.segments || []).reduce(
          (n: number, segment: any) => n + (segment.stops?.length || 0),
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
export const flightDuration = (offer: any) =>
  (offer.slices || []).reduce(
    (n: number, slice: any) => n + durationMinutes(slice.duration),
    0,
  ) || Infinity;
export const airlineKey = (offer: any): string =>
  offer.owner?.id || offer.owner?.name || "other";
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
      const hour = Number(
        offer.slices?.[0]?.segments?.[0]?.departing_at?.slice(11, 13),
      );
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
          ? String(
              a.slices?.[0]?.segments?.[0]?.departing_at || "",
            ).localeCompare(
              String(b.slices?.[0]?.segments?.[0]?.departing_at || ""),
            )
          : a.pricing.totalKobo - b.pricing.totalKobo,
    );
}
