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
import {
  verifyNuiteeFlight,
  prebookNuiteeFlight,
  bookNuiteeFlight,
} from "../src/services/ota/nuiteeFlights";

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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("OTA flight suppliers", () => {
  it("verifies and prebooks an N fare with its own live key when the other suppliers are paused", async () => {
    vi.stubEnv("SETTINGS_ENCRYPTION_KEY", "b".repeat(64));
    const settings = configSchema.parse({
      mode: "test",
      primaryFlightsEnabled: false,
      bilalFlightsEnabled: false,
      nuiteeFlightsEnabled: true,
      nuiteeFlightMode: "live",
      nuiteeLiveToken: "prod_fixture",
      nuiteeFlightMarkupPercent: 10,
    });
    const segment = {
      originCode: "LOS",
      destinationCode: "ABV",
      direction: "OUTBOUND",
      departureTime: "2027-01-15T08:00:00",
      arrivalTime: "2027-01-15T09:05:00",
      stopCount: 1,
      carrier: { marketingCode: "P4", marketingName: "Air Peace" },
      flight: { marketingNumber: "7001" },
    };
    const fare = {
      offerId: "provider-offer",
      expiration: new Date(Date.now() + 300_000).toISOString(),
      pricing: { display: { total: 85000, currency: "NGN" } },
    };
    const journey = { journeyKey: "itinerary-1", segments: [segment] };
    const terms = {
      refundable: false,
      changeable: true,
      hasChangeFee: true,
      changeFee: {
        pricing: { display: { amount: 20, currency: "USD" } },
        label: "Change fee",
      },
      summary: [{ message: "Fare difference may apply." }],
    };
    const baggage = {
      hasCarryOnBag: true,
      hasCheckedBag: true,
      included: [
        { bagType: "checked", passengerType: "ADT", pieces: 1, weightKg: 23 },
        { bagType: "cabin", passengerType: "CHD", pieces: 1, weightKg: 8 },
      ],
    };
    const prebookId = "019d0674-834d-7db7-9c8b-93fe8e46e7b8";
    let prebookPrice = 85000;
    let bookingCalls = 0;
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      const destination = new URL(url);
      expect(destination.hostname).toBe("api.liteapi.travel");
      expect(new Headers(init.headers).get("X-API-Key")).toBe("prod_fixture");
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      const path = destination.pathname.replace("/v3.0", "");
      switch (path) {
        case "/flights/rates":
          expect(body).toMatchObject({
            adults: 1,
            childrenAges: [8],
            legs: [{ origin: "LOS", destination: "ABV" }],
          });
          return Response.json({
            data: [
              {
                journeys: [
                  {
                    ...journey,
                    legDurations: [
                      {
                        direction: "OUTBOUND",
                        duration: { iso8601: "PT2H5M" },
                      },
                    ],
                    offers: [fare],
                  },
                ],
              },
            ],
          });
        case "/flights/verify":
          expect(body).toEqual({ offerId: fare.offerId });
          return Response.json({
            data: [{ journey: { ...journey, ...fare, terms, baggage } }],
          });
        case "/flights/prebooks":
          expect(body).toMatchObject({
            offerId: fare.offerId,
            usePaymentSdk: true,
            contact: { phoneCountryCode: "234", phoneNumber: "8012345678" },
            passengers: [
              { passengerType: 0, nationality: "NG" },
              { passengerType: 1, nationality: "NG" },
            ],
          });
          return Response.json({
            data: [
              {
                prebookId,
                price: prebookPrice,
                currency: "NGN",
                paymentTypes: ["ACC_CREDIT_CARD"],
                booking: { journey },
              },
            ],
          });
        case `/flights/prebooks/${prebookId}`:
          return Response.json({
            data: [
              {
                prebookId,
                price: prebookPrice,
                currency: "NGN",
                booking: { journey },
              },
            ],
          });
        case "/flights/bookings":
          bookingCalls++;
          expect(body).toEqual({
            prebookId,
            payment: { method: "ACC_CREDIT_CARD" },
            customTags: { RAUDAH_BOOKING: "test-booking" },
          });
          return Response.json({
            data: [
              {
                booking: {
                  bookingId: "f-test",
                  status: "PENDING_CONFIRMATION",
                  journey,
                  customTags: body.customTags,
                },
              },
            ],
          });
        default:
          throw new Error("Unexpected provider request");
      }
    });
    const offers = (await searchFlights(settings, input)).offers;
    expect(offers).toHaveLength(1);
    expect(offers[0].slices[0].duration).toBe("PT2H5M");
    const selectionId = offers[0].id;
    expect(offers[0].slices[0].segments[0].technical_stop_count).toBe(1);
    expect(offers[0].pricing.totalKobo).toBe(9_350_000);
    await expect(
      verifyNuiteeFlight(settings, selectionId + "x"),
    ).rejects.toMatchObject({ status: 400 });
    const quote = await verifyNuiteeFlight(settings, selectionId);
    expect(quote.offer.slices[0].duration).toBe("PT2H5M");
    expect(quote.offer.fare_terms).toMatchObject({
      refundable: false,
      changeable: true,
      change_fee: { amount: 20, currency: "USD" },
      notes: ["Fare difference may apply."],
    });
    expect(quote.offer.baggage_allowances?.included).toEqual(baggage.included);
    const traveller = {
      given_name: "Test",
      family_name: "Guest",
      born_on: "1990-01-01",
      title: "mr",
      gender: "m",
      nationality: "NG",
    };
    const contact = {
      email: "test@example.test",
      phone: "+2348012345678",
      phoneCountryCode: "234",
    };
    const travellers = [
      { ...traveller, id: "pas_1" },
      { ...traveller, born_on: "2018-11-19", id: "pas_2" },
    ];
    expect(
      await prebookNuiteeFlight(settings, quote, contact, travellers),
    ).toBe(prebookId);
    const row = {
      id: "test-booking",
      mode: "live",
      providerOfferId: prebookId,
      providerBookingId: null,
      supplierAmount: "85000",
      supplierCurrency: "NGN",
      offer: { nuiteeFlightJourneyKey: journey.journeyKey },
    };
    prebookPrice++;
    await expect(bookNuiteeFlight(settings, row)).rejects.toMatchObject({
      status: 409,
    });
    expect(bookingCalls).toBe(0);
    prebookPrice--;
    expect(await bookNuiteeFlight(settings, row)).toMatchObject({
      id: "f-test",
      status: "processing",
    });
    expect(bookingCalls).toBe(1);
  });
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
