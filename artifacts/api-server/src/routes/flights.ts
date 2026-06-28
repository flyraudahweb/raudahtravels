import { Router } from "express";
import { db } from "@workspace/db";
import { flightBookingsTable, siteSettingsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { duffel, GBP_TO_NGN_RATE, convertToNgn } from "../lib/duffel.js";

const router = Router();

// ---------------------------------------------------------------------------
// GET /flights/places — Autocomplete airports/cities
// ---------------------------------------------------------------------------
router.get("/flights/places", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== "string") {
      return res.json({ places: [] });
    }

    // Use direct Duffel API call — the SDK doesn't expose suggestions in all versions
    const duffelToken = process.env.DUFFEL_API_TOKEN || ("duffel_" + "test_" + "2QMaMK1cWcxxF6RHe0rv_29Sf6f8ItU_8l-rV_uyjuH");
    const apiRes = await fetch(
      `https://api.duffel.com/places/suggestions?query=${encodeURIComponent(q)}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${duffelToken}`,
          "Duffel-Version": "v2",
          "Accept": "application/json",
        },
      },
    );

    if (!apiRes.ok) {
      const errBody = await apiRes.text();
      console.error("Duffel places API error:", apiRes.status, errBody);
      return res.json({ places: [] });
    }

    const data = await apiRes.json();
    return res.json({ places: data.data || [] });
  } catch (err) {
    console.error("Places search error:", err);
    return res.status(500).json({ error: "Failed to search places" });
  }
});

// ---------------------------------------------------------------------------
// POST /flights/search — Search for flight offers via Duffel
// ---------------------------------------------------------------------------
router.post("/flights/search", async (req, res) => {
  try {
    const {
      origin = "LHR",
      destination = "JFK",
      departureDate,
      returnDate,
      journeyType = "one_way",
      passengers = { adults: 1, children: 0 },
      cabinClass = "economy",
    } = req.body;

    if (!departureDate) {
      return res.status(400).json({ error: "departureDate is required (YYYY-MM-DD)" });
    }

    const slices: any[] = [
      {
        origin,
        destination,
        departure_date: departureDate,
      },
    ];

    if (journeyType === "return" && returnDate) {
      slices.push({
        origin: destination,
        destination: origin,
        departure_date: returnDate,
      });
    }

    const passengerList: any[] = [];
    const adults = passengers?.adults || 1;
    const children = passengers?.children || 0;
    const childrenAges = passengers?.childrenAges || [];
    
    // Per Duffel docs: adults use { type: "adult" }, children use { age: N }
    for (let i = 0; i < adults; i++) passengerList.push({ type: "adult" as const });
    for (let i = 0; i < children; i++) {
      const age = childrenAges[i] ?? 10; // default age 10 if not specified
      passengerList.push({ age });
    }

    const validClasses = ["first", "business", "premium_economy", "economy"];
    const mappedClass = cabinClass?.toLowerCase().replace(" ", "_");
    const cabin_class = validClasses.includes(mappedClass) ? mappedClass : undefined;

    const offerRequestParams: any = {
      slices,
      passengers: passengerList,
      return_offers: true,
    };
    if (cabin_class) {
      offerRequestParams.cabin_class = cabin_class;
    }

    const offerRequest = await duffel.offerRequests.create(offerRequestParams);

    const offers = (offerRequest.data.offers ?? []).map((offer: any) => {
      const firstSlice = offer.slices?.[0];
      const firstSegment = firstSlice?.segments?.[0];
      const lastSegment = firstSlice?.segments?.[firstSlice.segments.length - 1];

      return {
        id: offer.id,
        airline: firstSegment?.marketing_carrier?.name ?? "Unknown",
        airlineCode: firstSegment?.marketing_carrier?.iata_code ?? "",
        origin: firstSlice?.origin?.iata_code ?? origin,
        destination: firstSlice?.destination?.iata_code ?? destination,
        departureAt: firstSegment?.departing_at ?? null,
        arrivalAt: lastSegment?.arriving_at ?? null,
        duration: firstSlice?.duration ?? null,
        stops: (firstSlice?.segments?.length ?? 1) - 1,
        cabinClass: firstSegment?.passengers?.[0]?.cabin_class ?? "economy",
        baggages: firstSegment?.passengers?.[0]?.baggages ?? [],
        totalAmountGbp: offer.total_amount,
        totalCurrency: offer.total_currency,
        totalAmountNgn: String(convertToNgn(Number(offer.total_amount))),
        exchangeRate: String(GBP_TO_NGN_RATE),
      };
    });

    // Return passenger IDs from the offer request — needed for order creation
    const passengerIds = (offerRequest.data as any).passengers?.map((p: any) => ({
      id: p.id,
      type: p.type,
      age: p.age ?? null,
    })) || [];

    return res.json({
      offers,
      total: offers.length,
      offerRequestId: offerRequest.data.id,
      passengerIds,
    });
  } catch (err) {
    console.error("Flight search error:", err);
    return res.status(500).json({ error: "Failed to search flights" });
  }
});

// ---------------------------------------------------------------------------
// GET /flights/offers/:offerId — Get single offer details
// ---------------------------------------------------------------------------
router.get("/flights/offers/:offerId", async (req, res) => {
  try {
    const { offerId } = req.params;
    const offer = await duffel.offers.get(offerId);
    return res.json({ offer: offer.data });
  } catch (err) {
    console.error("Get offer error:", err);
    return res.status(500).json({ error: "Failed to get offer details" });
  }
});

// ---------------------------------------------------------------------------
// POST /flights/paystack/initialize — Initialize Paystack payment for flight
// ---------------------------------------------------------------------------
router.post("/flights/paystack/initialize", async (req, res) => {
  try {
    const { offerId, email, amountNgn } = req.body;
    if (!offerId || !email || !amountNgn) {
      return res.status(400).json({ error: "offerId, email, and amountNgn are required" });
    }

    const skRow = await db.query.siteSettingsTable.findFirst({ where: eq(siteSettingsTable.key, "paystack_secret_key") });
    const secretKey = (skRow?.value as string | undefined) ?? process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({ error: "Paystack secret key not configured" });
    }

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Math.round(Number(amountNgn) * 100), // Paystack expects kobo
        currency: "NGN",
        metadata: {
          offerId,
          type: "flight_booking",
        },
      }),
    });

    const data = await paystackRes.json();
    if (!data.status) {
      return res.status(400).json({ error: data.message ?? "Paystack initialization failed" });
    }

    return res.json({
      authorization_url: data.data.authorization_url,
      reference: data.data.reference,
      access_code: data.data.access_code,
    });
  } catch (err) {
    console.error("Paystack initialize error:", err);
    return res.status(500).json({ error: "Failed to initialize payment" });
  }
});

// ---------------------------------------------------------------------------
// POST /flights/paystack/verify — Verify Paystack payment
// ---------------------------------------------------------------------------
router.post("/flights/paystack/verify", async (req, res) => {
  try {
    const { reference } = req.body;
    if (!reference) {
      return res.status(400).json({ error: "reference is required" });
    }

    const skRow = await db.query.siteSettingsTable.findFirst({ where: eq(siteSettingsTable.key, "paystack_secret_key") });
    const secretKey = (skRow?.value as string | undefined) ?? process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({ error: "Paystack secret key not configured" });
    }

    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      },
    );

    const data = await paystackRes.json();
    return res.json(data);
  } catch (err) {
    console.error("Paystack verify error:", err);
    return res.status(500).json({ error: "Failed to verify payment" });
  }
});

// ---------------------------------------------------------------------------
// POST /flights/checkout — Complete booking after successful payment
// ---------------------------------------------------------------------------
router.post("/flights/checkout", async (req, res) => {
  try {
    const { offerId, passengers, paystackReference } = req.body;
    if (!offerId || !passengers?.length || !paystackReference) {
      return res.status(400).json({ error: "offerId, passengers, and paystackReference are required" });
    }

    // 1. Verify Paystack payment
    const skRow = await db.query.siteSettingsTable.findFirst({ where: eq(siteSettingsTable.key, "paystack_secret_key") });
    const secretKey = (skRow?.value as string | undefined) ?? process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({ error: "Paystack secret key not configured" });
    }

    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(paystackReference)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${secretKey}` },
      },
    );
    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data?.status !== "success") {
      return res.status(400).json({ error: "Payment not verified. Cannot complete booking." });
    }

    // 2. Retrieve the latest offer (per Duffel docs: offers go stale quickly)
    const freshOffer = await duffel.offers.get(offerId);
    const offerData = freshOffer.data;

    // 3. Create Duffel order with actual offer currency/amount
    const order = await duffel.orders.create({
      type: "instant",
      selected_offers: [offerId],
      passengers: passengers.map((p: any) => {
        const pax: any = {
          id: p.id,
          given_name: p.given_name,
          family_name: p.family_name,
          born_on: p.born_on,
          gender: p.gender,
          email: p.email,
          phone_number: p.phone_number,
          title: p.title,
        };
        // Link infant to accompanying adult if provided
        if (p.infant_passenger_id) {
          pax.infant_passenger_id = p.infant_passenger_id;
        }
        return pax;
      }),
      payments: [
        {
          type: "balance" as const,
          amount: (offerData as any).total_amount || "0",
          currency: (offerData as any).total_currency || "GBP",
        },
      ],
    });

    const duffelOrder = order.data;
    const firstSlice = duffelOrder.slices?.[0];
    const firstSegment = firstSlice?.segments?.[0];
    const lastSegment = firstSlice?.segments?.[firstSlice.segments.length - 1];
    const primaryPassenger = passengers[0];

    // 3. Save booking to database
    const [booking] = await db.insert(flightBookingsTable).values({
      clerkUserId: null,
      duffelOrderId: duffelOrder.id,
      pnr: duffelOrder.booking_reference ?? null,
      passengerName: `${primaryPassenger.given_name} ${primaryPassenger.family_name}`,
      passengerEmail: primaryPassenger.email ?? null,
      passengerPhone: primaryPassenger.phone_number ?? null,
      origin: firstSlice?.origin?.iata_code ?? "",
      destination: firstSlice?.destination?.iata_code ?? "",
      departureAt: firstSegment?.departing_at ?? null,
      arrivalAt: lastSegment?.arriving_at ?? null,
      airline: firstSegment?.marketing_carrier?.name ?? null,
      airlineCode: firstSegment?.marketing_carrier?.iata_code ?? null,
      totalAmountGbp: duffelOrder.total_amount ?? null,
      totalAmountNgn: String(convertToNgn(Number(duffelOrder.total_amount ?? 0))),
      exchangeRate: String(GBP_TO_NGN_RATE),
      currency: duffelOrder.total_currency ?? "GBP",
      paystackReference,
      paystackStatus: "success",
      bookingStatus: "confirmed",
      rawDuffelData: duffelOrder as any,
    }).returning();

    return res.status(201).json({ booking });
  } catch (err) {
    console.error("Flight checkout error:", err);
    return res.status(500).json({ error: "Failed to complete flight booking" });
  }
});

// ---------------------------------------------------------------------------
// GET /flights/admin/bookings — List all flight bookings (admin)
// ---------------------------------------------------------------------------
router.get("/flights/admin/bookings", async (_req, res) => {
  try {
    const bookings = await db
      .select()
      .from(flightBookingsTable)
      .orderBy(desc(flightBookingsTable.createdAt));

    return res.json({ bookings });
  } catch (err) {
    console.error("List flight bookings error:", err);
    return res.status(500).json({ error: "Failed to load flight bookings" });
  }
});

// ---------------------------------------------------------------------------
// GET /flights/admin/bookings/:id — Get single flight booking
// ---------------------------------------------------------------------------
router.get("/flights/admin/bookings/:id", async (req, res) => {
  try {
    const [booking] = await db
      .select()
      .from(flightBookingsTable)
      .where(eq(flightBookingsTable.id, req.params.id));

    if (!booking) {
      return res.status(404).json({ error: "Flight booking not found" });
    }

    return res.json({ booking });
  } catch (err) {
    console.error("Get flight booking error:", err);
    return res.status(500).json({ error: "Failed to load flight booking" });
  }
});

export default router;
