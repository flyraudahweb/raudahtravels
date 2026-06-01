import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { packagesTable, profilesTable } from "@workspace/db";
import { getAuth } from "@clerk/express";
import { eq, and, sql, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

// SECURITY FIX #4: Admin guard for package mutation routes.
// Read endpoints (GET) remain public for the landing page.
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await db.query.profilesTable.findFirst({
    where: eq(profilesTable.clerkUserId, clerkUserId),
  });
  if (!profile || !["admin", "super_admin", "staff"].includes(profile.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  return next();
}

function toPackageResponse(p: any) {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    category: p.category,
    season: p.season ?? null,
    year: p.year ?? null,
    currency: p.currency ?? "NGN",
    description: p.description,
    price: Number(p.price),
    agentDiscount: Number(p.agentDiscount),
    depositAllowed: p.depositAllowed,
    depositAmount: Number(p.depositAmount),
    minimumDeposit: p.minimumDeposit ? Number(p.minimumDeposit) : null,
    duration: p.duration ?? null,
    durationDays: p.durationDays,
    departureDate: p.departureDate,
    returnDate: p.returnDate,
    departureCities: p.departureCities,
    airlines: p.airlines,
    capacity: p.capacity,
    maxCapacity: p.maxCapacity,
    currentBookings: p.currentBookings,
    inclusions: p.inclusions,
    imageUrl: p.imageUrl,
    status: p.status,
    isActive: p.isActive,
    featured: p.featured,
    isFeatured: p.isFeatured,
    starRating: p.starRating,
    countdownEnabled: p.countdownEnabled,
    countdownExpiry: p.countdownExpiry ?? null,
    countdownAction: p.countdownAction ?? "disable",
    isRegistrationClosed: !!(p.countdownEnabled && p.countdownExpiry && new Date(p.countdownExpiry) < new Date()),
    createdAt: p.createdAt,
    packageDates: p.packageDates ?? [],
  };
}

router.get("/packages", async (req, res) => {
  try {
    const { type, available, status, limit = "100", offset = "0" } = req.query as Record<string, string>;

    const conditions = [];
    if (type) conditions.push(eq(packagesTable.type, type as any));
    if (available === "true") conditions.push(eq(packagesTable.isActive, true));
    if (status) conditions.push(eq(packagesTable.status, status as any));

    const packages = await db.query.packagesTable.findMany({
      where: conditions.length ? and(...conditions) : undefined,
      limit: parseInt(limit),
      offset: parseInt(offset),
      orderBy: desc(packagesTable.createdAt),
      // Removed: with: { packageDates: true }
    });

    const globalDates = await db.query.packageDatesTable.findMany({
      where: sql`package_id IS NULL`,
    });

    let mapped = packages.map((p) => {
      const isUmrah = p.type === "umrah";
      return toPackageResponse({
        ...p,
        packageDates: isUmrah ? globalDates : [],
      });
    });

    // For public listings, hide packages whose countdown expired AND action is to disable/hide.
    // Packages with countdownAction "show_closed_badge" stay visible with a "Registration Closed" indicator.
    if (available === "true") {
      mapped = mapped.filter(p => {
        if (!p.isRegistrationClosed) return true;
        // Keep visible when admin chose to show a closed badge instead of hiding
        return p.countdownAction === "show_closed_badge";
      });
    }

    const total = await db.select({ count: sql<number>`count(*)` }).from(packagesTable);
    return res.json({ packages: mapped, total: Number(total[0].count) });
  } catch (err) {
    console.error("Packages list error:", err);
    return res.status(500).json({ error: "Failed to load packages" });
  }
});

router.get("/packages/stats", async (req, res) => {
  const all = await db.query.packagesTable.findMany();
  return res.json({
    totalPackages: all.length,
    hajjCount: all.filter((p) => p.type === "hajj").length,
    umrahCount: all.filter((p) => p.type === "umrah").length,
    availablePackages: all.filter((p) => p.isActive && p.currentBookings < p.capacity).length,
    soldOutPackages: all.filter((p) => p.currentBookings >= p.capacity).length,
  });
});

router.get("/packages/:id", async (req, res) => {
  const pkg = await db.query.packagesTable.findFirst({
    where: eq(packagesTable.id, req.params.id),
    // Removed: with: { packageDates: true }
  });
  if (!pkg) return res.status(404).json({ error: "Package not found" });

  const globalDates = await db.query.packageDatesTable.findMany({
    where: sql`package_id IS NULL`,
  });

  return res.json(toPackageResponse({
    ...pkg,
    packageDates: pkg.type === "umrah" ? globalDates : [],
  }));
});

// === GLOBAL PACKAGE DATES ENDPOINTS ===
import { packageDatesTable } from "@workspace/db";

router.get("/package-dates", async (req, res) => {
  const dates = await db.query.packageDatesTable.findMany({
    where: sql`package_id IS NULL`,
  });
  return res.json({ dates });
});

router.post("/package-dates", requireAdmin as any, async (req, res) => {
  const { outbound, outboundRoute, returnDate, returnRoute, airline, islamicDate, islamicReturnDate } = req.body;
  
  const [newDate] = await db.insert(packageDatesTable).values({
    id: randomUUID(),
    packageId: null as any, // Global
    outbound,
    outboundRoute,
    returnDate,
    returnRoute,
    airline,
    islamicDate,
    islamicReturnDate,
  }).returning();

  return res.status(201).json(newDate);
});

router.put("/package-dates/:id", requireAdmin as any, async (req, res) => {
  const { outbound, outboundRoute, returnDate, returnRoute, airline, islamicDate, islamicReturnDate } = req.body;
  const updates: any = {};
  if (outbound !== undefined) updates.outbound = outbound;
  if (outboundRoute !== undefined) updates.outboundRoute = outboundRoute;
  if (returnDate !== undefined) updates.returnDate = returnDate;
  if (returnRoute !== undefined) updates.returnRoute = returnRoute;
  if (airline !== undefined) updates.airline = airline;
  if (islamicDate !== undefined) updates.islamicDate = islamicDate;
  if (islamicReturnDate !== undefined) updates.islamicReturnDate = islamicReturnDate;

  const [updated] = await db.update(packageDatesTable)
    .set(updates)
    .where(eq(packageDatesTable.id, req.params.id))
    .returning();
    
  if (!updated) return res.status(404).json({ error: "Flight schedule not found" });
  return res.json(updated);
});

router.delete("/package-dates/:id", requireAdmin as any, async (req, res) => {
  await db.delete(packageDatesTable).where(eq(packageDatesTable.id, req.params.id));
  return res.status(204).send();
});

// SECURITY FIX #4: All mutation endpoints below require admin authentication
router.post("/packages", requireAdmin as any, async (req, res) => {
  const {
    name, type, category, season, year, description, price, depositAmount,
    depositAllowed, minimumDeposit, duration, durationDays, departureDate, returnDate,
    capacity, maxCapacity, inclusions, imageUrl, isActive, starRating,
    departureCities, airlines, agentDiscount, isFeatured, featured, status,
    countdownEnabled, countdownExpiry, countdownAction,
  } = req.body;
  const cap = capacity ?? maxCapacity ?? 0;
  const [pkg] = await db.insert(packagesTable).values({
    id: randomUUID(), name, type, category: category ?? "standard", season, year,
    description, price: String(price), depositAmount: String(depositAmount ?? 0),
    depositAllowed: depositAllowed ?? false, minimumDeposit: minimumDeposit ? String(minimumDeposit) : null,
    duration, durationDays: durationDays ?? 0, departureDate, returnDate,
    capacity: cap, maxCapacity: cap,
    departureCities: departureCities ?? [], airlines: airlines ?? [],
    inclusions: inclusions ?? [], imageUrl, isActive: isActive ?? true,
    starRating: starRating ?? 3, agentDiscount: String(agentDiscount ?? 0),
    isFeatured: isFeatured ?? false, featured: featured ?? false,
    status: status ?? "active",
    countdownEnabled: countdownEnabled ?? false,
    countdownExpiry: countdownExpiry ?? null,
    countdownAction: countdownAction ?? "disable",
  }).returning();
  return res.status(201).json(toPackageResponse(pkg));
});

router.put("/packages/:id", requireAdmin as any, async (req, res) => {
  const {
    name, type, category, season, year, description, price, depositAmount,
    depositAllowed, minimumDeposit, duration, durationDays, departureDate, returnDate,
    capacity, maxCapacity, inclusions, imageUrl, isActive, starRating,
    departureCities, airlines, agentDiscount, isFeatured, featured, status,
    countdownEnabled, countdownExpiry, countdownAction,
  } = req.body;
  const updates: any = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (type !== undefined) updates.type = type;
  if (category !== undefined) updates.category = category;
  if (season !== undefined) updates.season = season;
  if (year !== undefined) updates.year = year;
  if (description !== undefined) updates.description = description;
  if (price !== undefined) updates.price = String(price);
  if (depositAmount !== undefined) updates.depositAmount = String(depositAmount);
  if (depositAllowed !== undefined) updates.depositAllowed = depositAllowed;
  if (minimumDeposit !== undefined) updates.minimumDeposit = minimumDeposit ? String(minimumDeposit) : null;
  if (duration !== undefined) updates.duration = duration;
  if (durationDays !== undefined) updates.durationDays = durationDays;
  if (departureDate !== undefined) updates.departureDate = departureDate;
  if (returnDate !== undefined) updates.returnDate = returnDate;
  if (capacity !== undefined) { updates.capacity = capacity; updates.maxCapacity = capacity; }
  if (maxCapacity !== undefined) { updates.maxCapacity = maxCapacity; updates.capacity = maxCapacity; }
  if (inclusions !== undefined) updates.inclusions = inclusions;
  if (imageUrl !== undefined) updates.imageUrl = imageUrl;
  if (isActive !== undefined) updates.isActive = isActive;
  if (starRating !== undefined) updates.starRating = starRating;
  if (departureCities !== undefined) updates.departureCities = departureCities;
  if (airlines !== undefined) updates.airlines = airlines;
  if (agentDiscount !== undefined) updates.agentDiscount = String(agentDiscount);
  if (isFeatured !== undefined) { updates.isFeatured = isFeatured; updates.featured = isFeatured; }
  if (featured !== undefined) { updates.featured = featured; updates.isFeatured = featured; }
  if (status !== undefined) updates.status = status;
  if (countdownEnabled !== undefined) updates.countdownEnabled = countdownEnabled;
  if (countdownExpiry !== undefined) updates.countdownExpiry = countdownExpiry || null;
  if (countdownAction !== undefined) updates.countdownAction = countdownAction;

  const [pkg] = await db.update(packagesTable)
    .set(updates)
    .where(eq(packagesTable.id, req.params.id))
    .returning();
  if (!pkg) return res.status(404).json({ error: "Package not found" });
  return res.json(toPackageResponse(pkg));
});

router.delete("/packages/:id", requireAdmin as any, async (req, res) => {
  await db.delete(packagesTable).where(eq(packagesTable.id, req.params.id));
  return res.status(204).send();
});

export default router;
