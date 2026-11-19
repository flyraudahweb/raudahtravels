import { nuiteeHotelSearchReady, type OtaConfig } from "./config";
import { searchNuiteeHotels } from "./nuitee";

const cities = [
  { city: 0, latitude: 21.4225, longitude: 39.8262 },
  { city: 1, latitude: 24.4672, longitude: 39.6111 },
];
type Availability = {
  checkIn: string;
  checkOut: string;
  destinations: { city: number; count: number | null }[];
};
let cache:
  | { checkIn: string; expiresAt: number; result: Promise<Availability> }
  | undefined;

export function featuredHotelAvailability(config: OtaConfig) {
  if (config.nuiteeMode !== "live" || !nuiteeHotelSearchReady(config))
    return null;
  const date = (days: number) =>
    new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const checkIn = date(14);
  const checkOut = date(16);
  if (cache?.checkIn === checkIn && cache.expiresAt > Date.now())
    return cache.result;

  const pending = {
    checkIn,
    expiresAt: Date.now() + 15 * 60000,
    result: Promise.allSettled(
      cities.map(async ({ city, latitude, longitude }) => {
        const results = await searchNuiteeHotels(config, {
          latitude,
          longitude,
          checkIn,
          checkOut,
          rooms: 1,
          adults: 1,
          childAges: [],
          guestNationality: "NG",
        });
        return { city, count: results.length };
      }),
    ).then((results) => {
      if (results.some((result) => result.status === "rejected"))
        pending.expiresAt = Date.now() + 60000;
      return {
        checkIn,
        checkOut,
        destinations: results.map((result, index) =>
          result.status === "fulfilled"
            ? result.value
            : { city: cities[index].city, count: null },
        ),
      };
    }),
  };
  cache = pending;
  return pending.result;
}
