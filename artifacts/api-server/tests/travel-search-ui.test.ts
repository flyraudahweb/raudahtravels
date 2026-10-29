import { describe, expect, it } from "vitest";
import {
  dateKey,
  durationMinutes,
  flightStops,
  moveDate,
  readDate,
  selectFlights,
  type FlightFilters,
} from "../../raudah-travels/src/lib/travelSearch";

const filters: FlightFilters = {
  stops: "all",
  airlines: [],
  budget: null,
  departure: "all",
  sort: "price",
};
const offer = (
  id: string,
  price: number,
  carrier: string,
  hour: string,
  duration: string,
  segments: any[] = [{}],
) => ({
  id,
  owner: { id: carrier },
  pricing: { totalKobo: price },
  slices: [
    {
      duration,
      segments: segments.map((segment, index) => ({
        departing_at: `2026-12-10T${hour}:00:00`,
        ...segment,
      })),
    },
  ],
});
describe("travel comparison filters", () => {
  it("counts both connections and technical stops, across both directions", () => {
    const technical = offer("one", 100, "air", "10", "PT2H", [{ stops: [{}] }]);
    expect(flightStops(technical)).toBe(1);
    expect(selectFlights([technical], { ...filters, stops: "0" })).toEqual([]);
    expect(
      flightStops({
        ...technical,
        slices: [{ segments: [{}] }, { segments: [{}, {}, {}] }],
      }),
    ).toBe(2);
  });
  it("combines airline, budget, stops and local departure-time filters", () => {
    const items = [
      offer("valid", 100, "air-a", "08", "PT2H"),
      offer("costly", 200, "air-a", "08", "PT2H"),
      offer("other", 80, "air-b", "08", "PT2H"),
      offer("evening", 100, "air-a", "20", "PT2H"),
    ];
    expect(
      selectFlights(items, {
        ...filters,
        airlines: ["air-a"],
        budget: 150,
        stops: "0",
        departure: "1",
      }).map((item) => item.id),
    ).toEqual(["valid"]);
  });
  it("sorts real duration rather than lexicographic ISO values without mutating supplier results", () => {
    const items = [
      offer("long", 100, "air", "08", "PT12H"),
      offer("short", 200, "air", "06", "PT2H30M"),
    ];
    expect(
      selectFlights(items, { ...filters, sort: "duration" }).map(
        (item) => item.id,
      ),
    ).toEqual(["short", "long"]);
    expect(items.map((item) => item.id)).toEqual(["long", "short"]);
    expect(durationMinutes("P1DT2H30M")).toBe(1590);
    expect(durationMinutes("invalid")).toBe(Infinity);
  });
});
describe("travel date selection", () => {
  it("preserves calendar days across month/year boundaries and rejects invalid dates", () => {
    expect(moveDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(moveDate("2026-11-01", -1)).toBe("2026-10-31");
    expect(readDate("2026-02-30")).toBeUndefined();
    expect(readDate("not-a-date")).toBeUndefined();
    expect(dateKey(readDate("2026-10-30")!)).toBe("2026-10-30");
  });
});
