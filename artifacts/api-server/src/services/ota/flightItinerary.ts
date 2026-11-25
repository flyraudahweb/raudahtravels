import { z } from "zod";

export const flightLegSchema = z.object({
  origin: z.string().regex(/^[A-Z]{3}$/),
  destination: z.string().regex(/^[A-Z]{3}$/),
  departureDate: z.string().date(),
});

export const MAX_MULTI_CITY_LEGS = 6;
export const multiCityLegs = z
  .array(flightLegSchema)
  .min(2)
  .max(MAX_MULTI_CITY_LEGS);
export type FlightLeg = z.infer<typeof flightLegSchema>;

export function itineraryLegs(
  search: FlightLeg & { returnDate?: string; legs?: FlightLeg[] },
) {
  if (search.legs) return search.legs;
  const { origin, destination, departureDate, returnDate } = search;
  const legs = [{ origin, destination, departureDate }];
  if (returnDate)
    legs.push({
      origin: destination,
      destination: origin,
      departureDate: returnDate,
    });
  return legs;
}
