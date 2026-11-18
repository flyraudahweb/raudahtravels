import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bilalTokenForMode,
  configSchema,
  safeConfig,
} from "../src/services/ota/config";
import {
  searchFlightPlaces,
  searchFlights,
} from "../src/services/ota/flightSuppliers";

vi.mock("@workspace/db", () => ({ db: {}, siteSettingsTable: {} }));

const input = {
  origin: "LOS",
  destination: "ABV",
  departureDate: "2027-01-15",
  adults: 1,
  childAges: [8],
  cabinClass: "economy" as const,
};
const config = configSchema.parse({
  duffelToken: "duffel_test_fixture",
  bilalTestToken: "sk_test_fixture",
  bilalLiveToken: "supplier_live_fixture",
  flightMarkupPercent: 5,
  serviceFeeNgn: 500,
});
const fare = {
  flight_id: "OF_supplier_private",
  airline: "Air Peace",
  price: 85500,
  currency: "NGN",
  cabin: "economy",
  departure: "2027-01-15T08:00",
  arrival: "2027-01-15T09:05",
  stops: 0,
};
const online = {
  id: "off_online",
  total_amount: "80000",
  total_currency: "NGN",
};

afterEach(() => vi.unstubAllGlobals());

describe("OTA flight suppliers", () => {
  it("uses a configured supplier by default and skips missing or explicitly disabled keys", async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(new URL(url).hostname).toBe("api.duffel.com");
      return Response.json({ data: { offers: [] } });
    });
    vi.stubGlobal("fetch", fetcher);
    await expect(
      searchFlights({ ...config, bilalTestToken: "" }, input),
    ).resolves.toEqual({ offers: [] });
    await expect(
      searchFlights({ ...config, bilalFlightsEnabled: false }, input),
    ).resolves.toEqual({ offers: [] });
    await expect(
      searchFlights({ ...config, duffelToken: "", bilalTestToken: "" }, input),
    ).rejects.toMatchObject({ status: 503 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("compares both sources while keeping supplier estimate IDs out of checkout", async () => {
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      const destination = new URL(url);
      if (destination.hostname === "api.duffel.com") {
        expect(init.method).toBe("POST");
        expect(JSON.parse(String(init.body)).data.passengers).toEqual([
          { type: "adult" },
          { age: 8 },
        ]);
        return Response.json({ data: { offers: [online] } });
      }
      expect(destination.origin).toBe("https://bilalsadasub.com");
      expect(destination.pathname).toBe("/api/flight/search");
      expect(destination.searchParams.get("children")).toBe("1");
      expect(destination.searchParams.get("departure_date")).toBe(
        input.departureDate,
      );
      expect(init.headers).toMatchObject({
        Authorization: "Token sk_test_fixture",
      });
      expect(init.redirect).toBe("error");
      return Response.json({
        status: "success",
        data: [fare, { ...fare, currency: "USD" }],
      });
    });
    vi.stubGlobal("fetch", fetcher);
    const result = await searchFlights(config, input);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.offers.map((item) => item.id)).toEqual(["off_online"]);
    expect(result.offers[0].pricing.totalKobo).toBe(8_450_000);
    expect(result.estimatedFares).toEqual([
      {
        airline: fare.airline,
        origin: "LOS",
        destination: "ABV",
        departure: fare.departure,
        arrival: fare.arrival,
        cabin: fare.cabin,
        stops: 0,
        estimatedTotalKobo: 9_455_000,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain(fare.flight_id);
    expect(result.partialAvailability).toBeUndefined();
  });

  it("returns working supplier results when the other source is down", async () => {
    vi.stubGlobal("fetch", async (url: string) =>
      new URL(url).hostname === "bilalsadasub.com"
        ? Response.json({ status: "success", data: [fare] })
        : Response.json({ error: "private supplier error" }, { status: 503 }),
    );
    await expect(searchFlights(config, input)).resolves.toMatchObject({
      partialAvailability: true,
      offers: [],
      estimatedFares: [{ airline: fare.airline }],
    });
  });

  it("keeps working online offers when the domestic supplier fails", async () => {
    vi.stubGlobal("fetch", async (url: string) =>
      new URL(url).hostname === "api.duffel.com"
        ? Response.json({ data: { offers: [online] } })
        : Response.json({ status: "fail", message: "private account detail" }),
    );
    await expect(searchFlights(config, input)).resolves.toMatchObject({
      partialAvailability: true,
      offers: [online],
    });
  });

  it("keeps round trips and routes outside the configured domestic airports on the existing adapter", async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(new URL(url).hostname).toBe("api.duffel.com");
      return Response.json({ data: { offers: [] } });
    });
    vi.stubGlobal("fetch", fetcher);
    for (const search of [
      { ...input, returnDate: "2027-01-16" },
      { ...input, destination: "JED" },
    ]) {
      await expect(searchFlights(config, search)).resolves.toEqual({
        offers: [],
      });
    }
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("enforces mode separation and masks both saved keys", async () => {
    expect(
      bilalTokenForMode(
        { ...config, bilalLiveToken: config.bilalTestToken },
        "live",
      ),
    ).toBe("");
    expect(
      bilalTokenForMode({ ...config, bilalTestToken: config.bilalLiveToken }),
    ).toBe("");
    expect(safeConfig(config)).toMatchObject({
      bilalTestToken: "",
      bilalTestTokenSet: true,
      bilalLiveToken: "",
      bilalLiveTokenSet: true,
    });
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.headers).toMatchObject({
        Authorization: "Token supplier_live_fixture",
      });
      return Response.json({
        status: "success",
        data: [
          {
            code: "LOS",
            name: "Murtala Muhammed",
            city: "Lagos",
            country: "Nigeria",
          },
          {
            code: "JED",
            name: "King Abdulaziz",
            city: "Jeddah",
            country: "Saudi Arabia",
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetcher);
    await expect(
      searchFlightPlaces(
        { ...config, mode: "live", primaryFlightsEnabled: false },
        "Lagos",
      ),
    ).resolves.toEqual([
      { iata_code: "LOS", name: "Murtala Muhammed", city_name: "Lagos" },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
