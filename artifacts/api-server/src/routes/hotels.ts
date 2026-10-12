import { Router } from "express";
import { db } from "@workspace/db";
import { hotelBookingsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";

const router = Router();

function getSafeUserId(req: any): string | null {
  try {
    return getAuth(req)?.userId ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Demo hotel data — Makkah & Madinah
// Replace with live bedbank API (WebBeds etc.) when ready
// ---------------------------------------------------------------------------
const DEMO_HOTELS = [
  {
    id: "makkah-haram-view-suites",
    name: "Haram View Suites",
    destination: "makkah",
    destinationLabel: "Makkah",
    distanceToHaram: 150,
    distanceLabel: "150m to the Haram",
    stars: 5,
    boardType: "breakfast",
    boardLabel: "Breakfast",
    freeCancellation: true,
    rateType: "raudah_direct",
    rateLabel: "Raudah direct rate",
    pricePerNightNgn: 412000,
    description: "Steps from Al-Masjid al-Haram with panoramic views of the Kaaba.",
    amenities: ["WiFi", "Air conditioning", "24/7 room service", "Prayer mat & Qibla direction"],
  },
  {
    id: "makkah-ajyad-garden",
    name: "Ajyad Garden Hotel",
    destination: "makkah",
    destinationLabel: "Makkah",
    distanceToHaram: 280,
    distanceLabel: "280m to the Haram",
    stars: 4,
    boardType: "breakfast",
    boardLabel: "Breakfast",
    freeCancellation: false,
    rateType: "live_rate",
    rateLabel: "Live rate",
    pricePerNightNgn: 368000,
    description: "Comfortable 4-star hotel with excellent transport links to the Grand Mosque.",
    amenities: ["WiFi", "Air conditioning", "Restaurant", "Shuttle to Haram"],
  },
  {
    id: "makkah-al-noor-towers",
    name: "Al Noor Towers",
    destination: "makkah",
    destinationLabel: "Makkah",
    distanceToHaram: 240,
    distanceLabel: "240m to the Haram",
    stars: 3,
    boardType: "breakfast",
    boardLabel: "Breakfast",
    freeCancellation: true,
    rateType: "live_rate",
    rateLabel: "Live rate",
    pricePerNightNgn: 241000,
    description: "Value-for-money accommodation with easy access to the Holy Mosque.",
    amenities: ["WiFi", "Air conditioning", "Prayer facilities"],
  },
  {
    id: "makkah-pullman-zamzam",
    name: "Pullman Zamzam Makkah",
    destination: "makkah",
    destinationLabel: "Makkah",
    distanceToHaram: 200,
    distanceLabel: "200m to the Haram",
    stars: 5,
    boardType: "room_only",
    boardLabel: "Room only",
    freeCancellation: false,
    rateType: "live_rate",
    rateLabel: "Live rate",
    pricePerNightNgn: 440000,
    description: "Luxury 5-star tower with direct views of the Grand Mosque.",
    amenities: ["WiFi", "Pool", "Spa", "Multiple restaurants", "Prayer mat & Qibla direction"],
  },
  {
    id: "madinah-anwar-al-madinah",
    name: "Anwar Al Madinah Mövenpick",
    destination: "madinah",
    destinationLabel: "Madinah",
    distanceToHaram: 120,
    distanceLabel: "120m to Al-Masjid an-Nabawi",
    stars: 5,
    boardType: "breakfast",
    boardLabel: "Breakfast",
    freeCancellation: true,
    rateType: "raudah_direct",
    rateLabel: "Raudah direct rate",
    pricePerNightNgn: 385000,
    description: "Directly connected to Al-Masjid an-Nabawi complex via covered walkway.",
    amenities: ["WiFi", "Restaurant", "Concierge", "Prayer mat & Qibla direction"],
  },
  {
    id: "madinah-dallah-taibah",
    name: "Dallah Taibah Hotel",
    destination: "madinah",
    destinationLabel: "Madinah",
    distanceToHaram: 350,
    distanceLabel: "350m to Al-Masjid an-Nabawi",
    stars: 4,
    boardType: "breakfast",
    boardLabel: "Breakfast",
    freeCancellation: true,
    rateType: "live_rate",
    rateLabel: "Live rate",
    pricePerNightNgn: 290000,
    description: "Well-appointed hotel offering comfort and convenience near the Prophet's Mosque.",
    amenities: ["WiFi", "Restaurant", "Business centre", "Shuttle service"],
  },
  {
    id: "madinah-al-shohada",
    name: "Al Shohada Hotel",
    destination: "madinah",
    destinationLabel: "Madinah",
    distanceToHaram: 500,
    distanceLabel: "500m to Al-Masjid an-Nabawi",
    stars: 3,
    boardType: "room_only",
    boardLabel: "Room only",
    freeCancellation: true,
    rateType: "live_rate",
    rateLabel: "Live rate",
    pricePerNightNgn: 195000,
    description: "Budget-friendly option with easy access to Madinah's holy sites.",
    amenities: ["WiFi", "Air conditioning", "Prayer facilities"],
  },
];

// ---------------------------------------------------------------------------
// GET /api/hotels/search — search demo hotels with filters
// ---------------------------------------------------------------------------
router.get("/hotels/search", (req, res) => {
  const { dest, stars, board, freeCancellation, maxDistance } = req.query as Record<string, string>;

  let results = [...DEMO_HOTELS];

  if (dest) {
    const d = dest.toLowerCase();
    results = results.filter((h) => h.destination === d || h.destinationLabel.toLowerCase().includes(d));
  }
  if (stars) {
    const s = Number(stars);
    results = results.filter((h) => h.stars >= s);
  }
  if (board) {
    results = results.filter((h) => h.boardType === board);
  }
  if (freeCancellation === "true") {
    results = results.filter((h) => h.freeCancellation);
  }
  if (maxDistance) {
    const maxD = Number(maxDistance);
    results = results.filter((h) => h.distanceToHaram <= maxD);
  }

  return res.json({ hotels: results, total: results.length });
});

// ---------------------------------------------------------------------------
// GET /api/hotels/my-bookings — get authenticated user's hotel bookings
// ---------------------------------------------------------------------------
router.get("/hotels/my-bookings", async (req, res) => {
  try {
    const clerkUserId = getSafeUserId(req);
    if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

    const bookings = await db
      .select()
      .from(hotelBookingsTable)
      .where(eq(hotelBookingsTable.clerkUserId, clerkUserId))
      .orderBy(desc(hotelBookingsTable.createdAt));

    return res.json({ bookings });
  } catch (err) {
    console.error("Hotel my-bookings error:", err);
    return res.status(500).json({ error: "Failed to load hotel bookings" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/hotels/:id — get single hotel detail
// ---------------------------------------------------------------------------
router.get("/hotels/:id", (req, res) => {
  const hotel = DEMO_HOTELS.find((h) => h.id === req.params.id);
  if (!hotel) return res.status(404).json({ error: "Hotel not found" });
  return res.json({ hotel });
});

// ---------------------------------------------------------------------------
// POST /api/hotels/book — create a hotel booking (after Paystack payment)
// ---------------------------------------------------------------------------
router.post("/hotels/book", async (req, res) => {
  try {
    const clerkUserId = getSafeUserId(req);
    const {
      hotelId,
      checkIn,
      checkOut,
      nights,
      rooms,
      guests,
      guestName,
      guestEmail,
      guestPhone,
      paystackReference,
      paystackStatus,
    } = req.body;

    if (!hotelId || !checkIn || !checkOut || !guestName) {
      return res.status(400).json({ error: "hotelId, checkIn, checkOut and guestName are required" });
    }

    const hotel = DEMO_HOTELS.find((h) => h.id === hotelId);
    if (!hotel) return res.status(404).json({ error: "Hotel not found" });

    const numNights = nights || 1;
    const numRooms = rooms || 1;
    const totalAmountNgn = String(hotel.pricePerNightNgn * numNights * numRooms);

    const [booking] = await db
      .insert(hotelBookingsTable)
      .values({
        clerkUserId: clerkUserId ?? null,
        hotelId,
        hotelName: hotel.name,
        hotelDestination: hotel.destination,
        checkIn,
        checkOut,
        nights: numNights,
        rooms: numRooms,
        guests: guests || 1,
        boardType: hotel.boardType,
        rateType: hotel.rateType,
        totalAmountNgn,
        paystackReference: paystackReference ?? null,
        paystackStatus: paystackStatus ?? null,
        bookingStatus: paystackStatus === "success" ? "confirmed" : "pending",
        guestName,
        guestEmail: guestEmail ?? null,
        guestPhone: guestPhone ?? null,
        rawHotelData: hotel as any,
      })
      .returning();

    return res.status(201).json({ booking });
  } catch (err) {
    console.error("Hotel book error:", err);
    return res.status(500).json({ error: "Failed to create hotel booking" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/hotels/admin/bookings — admin list all hotel bookings
// ---------------------------------------------------------------------------
router.get("/hotels/admin/bookings", async (_req, res) => {
  try {
    const bookings = await db
      .select()
      .from(hotelBookingsTable)
      .orderBy(desc(hotelBookingsTable.createdAt));
    return res.json({ bookings });
  } catch (err) {
    console.error("Hotel admin bookings error:", err);
    return res.status(500).json({ error: "Failed to load hotel bookings" });
  }
});

export default router;
