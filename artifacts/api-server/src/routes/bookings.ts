import { Router } from "express";
import { db } from "@workspace/db";
import { bookingsTable, packagesTable, packageDatesTable, paymentsTable, profilesTable, visaApplicationsTable, userActivityTable, siteSettingsTable } from "@workspace/db";
import { createNotification } from "../utils/notify.js";
import { getAuth } from "@clerk/express";
import { eq, and, sql, desc, or, inArray } from "drizzle-orm";
import { createHash, randomUUID } from "crypto";
import { z } from "zod";
import { confirmPaidGroup, confirmTravellerRecords } from "../services/payments/packageConfirmation";
import { retireExpiredPackageCheckouts } from "../services/payments/packagePaystack";

const router = Router();

class PackageBookingError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}

const pilgrimFields = [
  "fullName", "civility", "firstName", "lastName", "passportNumber", "passportIssueDate",
  "passportExpiry", "passportIssuingAuthority", "passportCopyUrl", "profilePhotoUrl",
  "dateOfBirth", "gender", "nationality", "placeOfBirth", "ethnicGroup", "maritalStatus",
  "levelOfStudy", "occupation", "observation", "partner", "underCover", "visaNumber",
  "phone", "email", "country", "city", "address", "roomPreference", "departureCity",
  "specialRequests", "emergencyContactName", "emergencyContactPhone", "emergencyContactRelationship",
] as const;
const uploadedDocument = z.string().trim().max(2048).refine((value) => !/^data:/i.test(value)).optional();
const pilgrimSchema = z.object(Object.fromEntries(pilgrimFields.map((field) => [
  field, z.string().trim().max(2048).optional(),
])) as Record<(typeof pilgrimFields)[number], z.ZodOptional<z.ZodString>>).extend({
  passportCopyUrl: uploadedDocument,
  profilePhotoUrl: uploadedDocument,
});
const childSchema = pilgrimSchema.extend({
  firstName: z.string().trim().min(1).max(200),
  lastName: z.string().trim().min(1).max(200),
  dateOfBirth: z.string().date(),
});
const packageCheckout = pilgrimSchema.extend({
  packageId: z.string().min(1).max(128),
  packageDateId: z.string().min(1).max(128).optional(),
  pilgrimCount: z.number().int().min(1).max(10).default(1),
  pilgrimDetails: z.string().max(60000).optional(),
  notes: z.string().max(4000).optional(),
  checkoutId: z.string().uuid().optional(),
  expectedTotal: z.number().finite().nonnegative().optional(),
  children: z.array(childSchema).max(10).default([]),
});

function bookingPricing(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return {}; }
  }
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function moneyKobo(value: unknown, fallback = 0) {
  if (value == null || value === "") return fallback;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : fallback;
}

async function getProfileByClerkId(clerkUserId: string) {
  return db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, clerkUserId) });
}

function toBookingResponse(b: typeof bookingsTable.$inferSelect, pkg?: any, user?: any, packageDate?: any) {
  return {
    id: b.id,
    reference: b.reference,
    userId: b.userId,
    packageId: b.packageId,
    packageDateId: b.packageDateId,
    agentId: b.agentId,
    status: b.status,
    totalPrice: Number(b.totalPrice),
    amountPaid: Number(b.amountPaid),
    pilgrimCount: b.pilgrimCount,
    fullName: b.fullName,
    passportNumber: b.passportNumber,
    passportExpiry: b.passportExpiry,
    dateOfBirth: b.dateOfBirth,
    gender: b.gender,
    nationality: b.nationality,
    phone: b.phone,
    address: b.address,
    departureCity: b.departureCity,
    roomPreference: b.roomPreference,
    specialRequests: b.specialRequests,
    emergencyContactName: b.emergencyContactName,
    emergencyContactPhone: b.emergencyContactPhone,
    emergencyContactRelationship: b.emergencyContactRelationship,
    meningitisVaccineDate: b.meningitisVaccineDate,
    pilgrimDetails: b.pilgrimDetails,
    notes: b.notes,
    visaDeliveryMessage: b.visaDeliveryMessage,
    ticketDocumentUrl: b.ticketDocumentUrl,
    roomSurcharge: Number(b.roomSurcharge || 0),
    pilgrimType: b.pilgrimType,
    parentBookingId: b.parentBookingId,
    batchId: b.batchId,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    package: pkg ? {
      id: pkg.id,
      name: pkg.name,
      type: pkg.type,
      category: pkg.category,
      price: Number(pkg.price),
      imageUrl: pkg.imageUrl,
    } : null,
    packageDate: packageDate ? {
      id: packageDate.id,
      outbound: packageDate.outbound,
      outboundRoute: packageDate.outboundRoute,
      returnDate: packageDate.returnDate,
      returnRoute: packageDate.returnRoute,
      airline: packageDate.airline,
      islamicDate: packageDate.islamicDate,
      islamicReturnDate: packageDate.islamicReturnDate,
    } : null,
    user: user ? {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
    } : null,
  };
}

router.get("/bookings", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const { status, packageId, archived, limit = "20", offset = "0" } = req.query as Record<string, string>;
  const conditions: any[] = [];

  const isAdmin = ["admin", "super_admin", "staff"].includes(profile.role);
  if (!isAdmin) conditions.push(eq(bookingsTable.userId, profile.id));
  if (status) conditions.push(eq(bookingsTable.status, status as any));
  if (packageId) conditions.push(eq(bookingsTable.packageId, packageId));
  
  if (archived === "true") {
    conditions.push(eq(bookingsTable.isArchived, true));
  } else {
    conditions.push(eq(bookingsTable.isArchived, false));
  }

  const bookings = await db.select()
    .from(bookingsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(bookingsTable.createdAt))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  const total = await db.select({ count: sql<number>`count(*)` }).from(bookingsTable)
    .where(conditions.length ? and(...conditions) : undefined);

  const packageIds = [...new Set(bookings.map(b => b.packageId).filter(Boolean))];
  const userIds = [...new Set(bookings.map(b => b.userId).filter(Boolean))];
  const packageDateIds = [...new Set(bookings.map(b => b.packageDateId).filter(Boolean))];

  const [packages, users, packageDates] = await Promise.all([
    packageIds.length ? db.select().from(packagesTable).where(sql`id = ANY(ARRAY[${sql.join(packageIds.map(id => sql`${id}`), sql`, `)}]::text[])`) : [],
    userIds.length ? db.select().from(profilesTable).where(sql`id = ANY(ARRAY[${sql.join(userIds.map(id => sql`${id}`), sql`, `)}]::text[])`) : [],
    packageDateIds.length ? db.select().from(packageDatesTable).where(sql`id = ANY(ARRAY[${sql.join(packageDateIds.map(id => sql`${id}`), sql`, `)}]::text[])`) : [],
  ]);

  const pkgMap = Object.fromEntries(packages.map(p => [p.id, p]));
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));
  const dateMap = Object.fromEntries(packageDates.map(d => [d.id, d]));

  // Status counts (independent of pagination — always reflect full non-archived dataset for admin)
  let statusCounts: Record<string, number> | undefined;
  if (isAdmin) {
    const archiveCondition = archived === "true" ? eq(bookingsTable.isArchived, true) : eq(bookingsTable.isArchived, false);
    const [pendingC, confirmedC, cancelledC, completedC] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(bookingsTable).where(and(archiveCondition, eq(bookingsTable.status, "pending"))),
      db.select({ count: sql<number>`count(*)::int` }).from(bookingsTable).where(and(archiveCondition, eq(bookingsTable.status, "confirmed"))),
      db.select({ count: sql<number>`count(*)::int` }).from(bookingsTable).where(and(archiveCondition, eq(bookingsTable.status, "cancelled"))),
      db.select({ count: sql<number>`count(*)::int` }).from(bookingsTable).where(and(archiveCondition, eq(bookingsTable.status, "completed"))),
    ]);
    statusCounts = {
      pending: pendingC[0]?.count ?? 0,
      confirmed: confirmedC[0]?.count ?? 0,
      cancelled: cancelledC[0]?.count ?? 0,
      completed: completedC[0]?.count ?? 0,
    };
  }

  return res.json({
    bookings: bookings.map(b => toBookingResponse(
      b,
      b.packageId ? pkgMap[b.packageId] : undefined,
      b.userId ? userMap[b.userId] : undefined,
      b.packageDateId ? dateMap[b.packageDateId] : undefined
    )),
    total: Number(total[0].count),
    ...(statusCounts ? { statusCounts } : {}),
  });
});

router.post("/bookings", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await getProfileByClerkId(clerkUserId);
  if (profile?.accountStatus !== "active")
    return res.status(403).json({ error: "Account access is unavailable" });

  const parsed = packageCheckout.safeParse(req.body);
  if (!parsed.success) {
    const uploadIssue = parsed.error.issues.find(({ path }) =>
      path.at(-1) === "passportCopyUrl" || path.at(-1) === "profilePhotoUrl");
    if (uploadIssue) {
      const field = uploadIssue.path.at(-1) === "passportCopyUrl" ? "passport copy" : "profile photo";
      return res.status(400).json({ error: `Upload the ${field} again using the file upload field.` });
    }
    return res.status(400).json({ error: "Review the package and traveller details." });
  }
  const { packageId, packageDateId, pilgrimCount, pilgrimDetails, notes, children, checkoutId, expectedTotal, ...person } = parsed.data;
  const checkoutKey = checkoutId
    ? createHash("sha256").update(JSON.stringify([profile.id, packageId, checkoutId])).digest("hex")
    : undefined;
  const checkoutFingerprint = createHash("sha256")
    .update(JSON.stringify({ packageId, packageDateId, pilgrimCount, person, children, expectedTotal }))
    .digest("hex");
  try {
    const result = await db.transaction(async (tx) => {
      // Customer, agent and staff bookings serialize on the same package row.
      const [pkg] = await tx.select().from(packagesTable).where(eq(packagesTable.id, packageId)).for("update");
      if (!pkg) throw new PackageBookingError("Package not found", 404);
      if (checkoutKey) {
        const existing = await tx.query.bookingsTable.findFirst({ where: eq(bookingsTable.checkoutKey, checkoutKey) });
        if (existing) {
          const saved = bookingPricing(existing.customData);
          if (saved.checkoutFingerprint !== checkoutFingerprint)
            throw new PackageBookingError("A checkout was already saved. Open My Bookings to review it before paying");
          return existing;
        }
      }
      if (pkg.status !== "active" || !pkg.isActive ||
          (pkg.countdownEnabled && pkg.countdownExpiry && new Date(pkg.countdownExpiry) <= new Date()))
        throw new PackageBookingError("Package registration is closed");

      const departure = packageDateId
        ? await tx.query.packageDatesTable.findFirst({ where: eq(packageDatesTable.id, packageDateId) })
        : undefined;
      if (packageDateId && (!departure || departure.status !== "open" ||
          (departure.packageId !== packageId && !(departure.packageId == null && pkg.type === "umrah"))))
        throw new PackageBookingError("The selected departure is unavailable");

      const seats = pilgrimCount + children.length;
      if (pkg.capacity > 0 && pkg.currentBookings + seats > pkg.capacity)
        throw new PackageBookingError("There is insufficient capacity for this group");

      const rows = await tx.query.siteSettingsTable.findMany({
        where: inArray(siteSettingsTable.key, ["room_surcharges", "child_infant_pricing"]),
      });
      const settings = Object.fromEntries(rows.map((row) => [row.key, bookingPricing(row.value)]));
      const surcharge = moneyKobo(settings.room_surcharges?.[person.roomPreference?.toLowerCase() || "quad"]);
      const overrides = bookingPricing(pkg.pricingOverrides);
      const today = new Date().toISOString().slice(0, 10);
      const childRecords = children.map(({ dateOfBirth, ...child }) => {
        const age = Number(today.slice(0, 4)) - Number(dateOfBirth.slice(0, 4)) -
          (today.slice(5) < dateOfBirth.slice(5) ? 1 : 0);
        if (age < 0 || age >= 12)
          throw new PackageBookingError("A child or infant date of birth is invalid", 400);
        const type = age < 2 ? "infant" as const : "child" as const;
        const field = type === "infant" ? "infantPrice" : "childPrice";
        return {
          person: { ...child, dateOfBirth, fullName: child.firstName + " " + child.lastName },
          type,
          price: moneyKobo(overrides[field] ?? settings.child_infant_pricing?.[field], 120000000),
        };
      });
      const childrenTotal = childRecords.reduce((total, child) => total + child.price, 0);
      const total = (moneyKobo(pkg.price) + surcharge) * pilgrimCount + childrenTotal;
      if (expectedTotal !== undefined && Math.round(expectedTotal * 100) !== total)
        throw new PackageBookingError("Package pricing changed. Refresh and review the total before paying");

      const reference = () => "RDH-" + randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
      const common = { userId: profile.id, packageId, packageDateId, status: "pending" as const, amountPaid: "0" };
      const [booking] = await tx.insert(bookingsTable).values({
        ...person, ...common, id: randomUUID(), reference: reference(), checkoutKey,
        pilgrimCount, pilgrimDetails, notes, totalPrice: (total / 100).toFixed(2),
        roomSurcharge: (surcharge / 100).toFixed(2), pilgrimType: "adult",
        customData: { childrenCount: children.length, childrenExtra: childrenTotal / 100, checkoutFingerprint },
      }).returning();
      const linked = childRecords.length ? await tx.insert(bookingsTable).values(childRecords.map((child) => ({
        ...child.person, ...common, id: randomUUID(), reference: reference(), parentBookingId: booking.id,
        pilgrimCount: 1, pilgrimType: child.type, totalPrice: "0", batchId: booking.id,
      }))).returning() : [];
      await tx.insert(visaApplicationsTable).values([booking, ...linked].map((traveller) => ({
        id: randomUUID(), bookingId: traveller.id, pilgrimName: traveller.fullName,
        passportNumber: traveller.passportNumber, status: "awaiting_payment",
      })));
      await tx.update(packagesTable).set({ currentBookings: sql`${packagesTable.currentBookings} + ${seats}` })
        .where(eq(packagesTable.id, packageId));
      return booking;
    });
    return res.status(201).json(toBookingResponse(result));
  } catch (error) {
    if (error instanceof PackageBookingError) return res.status(error.status).json({ error: error.message });
    throw error;
  }
});


router.get("/bookings/:id", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const booking = await db.query.bookingsTable.findFirst({
    where: eq(bookingsTable.id, req.params.id),
  });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  const isAdmin = ["admin", "super_admin", "staff"].includes(profile.role);
  if (!isAdmin && booking.userId !== profile.id) return res.status(403).json({ error: "Forbidden" });

  const [pkg, user, packageDate] = await Promise.all([
    booking.packageId ? db.query.packagesTable.findFirst({ where: eq(packagesTable.id, booking.packageId) }) : null,
    booking.userId ? db.query.profilesTable.findFirst({ where: eq(profilesTable.id, booking.userId) }) : null,
    booking.packageDateId ? db.query.packageDatesTable.findFirst({ where: eq(packageDatesTable.id, booking.packageDateId) }) : null,
  ]);

  return res.json(toBookingResponse(booking, pkg, user, packageDate));
});

router.put("/bookings/:id", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const actorProfile = await getProfileByClerkId(clerkUserId);
  if (actorProfile?.accountStatus !== "active") return res.status(403).json({ error: "Account access is unavailable" });
  const isAdmin = ["admin", "super_admin", "staff"].includes(actorProfile.role);
  if (!isAdmin) return res.status(403).json({ error: "Admin access required" });

  const { status, notes, amountPaid, visaDeliveryMessage, ticketDocumentUrl, ...rest } = req.body;

  // SECURITY FIX #11: Validate status against the booking_status enum
  const VALID_BOOKING_STATUSES = ["pending", "confirmed", "cancelled", "completed"];
  if (status !== undefined && !VALID_BOOKING_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Allowed: ${VALID_BOOKING_STATUSES.join(", ")}` });
  }

  const updateData: any = { updatedAt: new Date() };
  if (status !== undefined) updateData.status = status;
  if (notes !== undefined) updateData.notes = notes;
  // amountPaid is now derived from SUM(verified payments) — direct override removed
  // to maintain data integrity. Use the payment recording flow instead.
  if (visaDeliveryMessage !== undefined) updateData.visaDeliveryMessage = visaDeliveryMessage;
  if (ticketDocumentUrl !== undefined) updateData.ticketDocumentUrl = ticketDocumentUrl;

  const booking = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(bookingsTable)
      .where(eq(bookingsTable.id, req.params.id)).for("update");
    if (!current) return;
    if (status && status !== current.status && current.parentBookingId)
      throw new PackageBookingError("Manage the group status from the main booking");
    const linked = status && (status !== current.status || status === "confirmed" || status === "completed")
      ? await tx.select().from(bookingsTable)
        .where(and(eq(bookingsTable.parentBookingId, current.id), eq(bookingsTable.packageId, current.packageId),
          eq(bookingsTable.isArchived, false))).for("update")
      : [];
    if (status === "confirmed" || status === "completed") {
      if (current.isArchived) throw new PackageBookingError("Restore the booking before changing its status.");
      const members = [current, ...linked];
      const totals = await tx.select({
        id: paymentsTable.bookingId, amount: sql<string>`SUM(${paymentsTable.amount})`,
      }).from(paymentsTable).where(and(
        inArray(paymentsTable.bookingId, members.map(({ id }) => id)),
        eq(paymentsTable.status, "verified"), eq(paymentsTable.isArchived, false),
      )).groupBy(paymentsTable.bookingId);
      const paid = new Map(totals.map(({ id, amount }) => [id, Number(amount)]));
      if (members.some(({ id, totalPrice }) => (paid.get(id) ?? 0) < Number(totalPrice)))
        throw new PackageBookingError("Verify the full payment for this booking before confirming or completing it.");
    }
    if (status && status !== current.status) {
      if (status === "cancelled" || current.status === "cancelled") {
        const [pkg] = await tx.select().from(packagesTable)
          .where(eq(packagesTable.id, current.packageId)).for("update");
        const seats = [current, ...linked]
          .filter((item) => (item.status === "cancelled") !== (status === "cancelled"))
          .reduce((sum, item) => sum + item.pilgrimCount, 0);
        const next = pkg.currentBookings + (status === "cancelled" ? -seats : seats);
        if (status !== "cancelled" && pkg.capacity > 0 && next > pkg.capacity)
          throw new PackageBookingError("There is insufficient capacity to restore this booking");
        await tx.update(packagesTable).set({ currentBookings: Math.max(0, next) })
          .where(eq(packagesTable.id, pkg.id));
      }
      if (linked.length) await tx.update(bookingsTable).set({ status, updatedAt: new Date() })
        .where(inArray(bookingsTable.id, linked.map((item) => item.id)));
    }
    const [saved] = await tx.update(bookingsTable).set(updateData)
      .where(eq(bookingsTable.id, req.params.id)).returning();
    if (status === "confirmed") {
      const children = await tx.select().from(bookingsTable)
        .where(and(
          eq(bookingsTable.parentBookingId, saved.id),
          eq(bookingsTable.packageId, saved.packageId),
          eq(bookingsTable.status, "confirmed"),
          eq(bookingsTable.isArchived, false),
        )).for("update");
      await confirmTravellerRecords(tx, [saved, ...children]);
    }
    return saved;
  }).catch((error: unknown) => {
    if (error instanceof PackageBookingError) return error;
    throw error;
  });
  if (booking instanceof PackageBookingError)
    return res.status(booking.status).json({ error: booking.message });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  // Notify pilgrim when admin changes booking status
  if (updateData.status && booking.userId) {
    const statusMessages: Record<string, { title: string; msg: string }> = {
      confirmed:  { title: "Booking Confirmed ✓", msg: `Your booking (Ref: ${booking.reference ?? booking.id.slice(0, 8).toUpperCase()}) has been confirmed.` },
      cancelled:  { title: "Booking Cancelled",   msg: `Your booking (Ref: ${booking.reference ?? booking.id.slice(0, 8).toUpperCase()}) has been cancelled. Please contact support for assistance.` },
      completed:  { title: "Journey Completed",   msg: `Your pilgrimage booking has been marked as completed. Jazakallahu khairan!` },
    };
    const n = statusMessages[updateData.status];
    if (n) setImmediate(() => createNotification(booking.userId!, n.title, n.msg, "booking"));
  }

  // Log staff action when status changes
  if (updateData.status) {
    try {
      const { userId: clerkUserId } = getAuth(req);
      if (clerkUserId) {
        const actor = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, clerkUserId) });
        if (actor) {
          await db.insert(userActivityTable).values({
            id: randomUUID(),
            userId: actor.id,
            eventType: `booking_${updateData.status}`,
            bookingId: booking.id,
            metadata: {
              actorName: actor.fullName,
              actorRole: actor.role,
              targetName: booking.fullName,
              targetPhone: booking.phone,
              reference: booking.reference,
              newStatus: updateData.status,
            },
          });
        }
      }
    } catch (_) { /* non-blocking */ }
  }

  return res.json(toBookingResponse(booking));
});

router.delete("/bookings/:id", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await getProfileByClerkId(clerkUserId);
  if (profile?.accountStatus !== "active")
    return res.status(403).json({ error: "Account access is unavailable" });

  try {
    await db.transaction(async (tx) => {
      const [booking] = await tx.select().from(bookingsTable)
        .where(eq(bookingsTable.id, req.params.id)).for("update");
      if (!booking) throw new PackageBookingError("Booking not found", 404);
      if (!["admin", "super_admin", "staff"].includes(profile.role) && booking.userId !== profile.id)
        throw new PackageBookingError("Forbidden", 403);
      if (booking.status === "cancelled") return;
      if (booking.parentBookingId) throw new PackageBookingError("Manage the travellers from the main booking");
      const group = [booking, ...await tx.select().from(bookingsTable)
        .where(and(eq(bookingsTable.parentBookingId, booking.id), eq(bookingsTable.packageId, booking.packageId))).for("update")];
      const pending = group.filter((traveller) => traveller.status !== "cancelled");
      if (pending.some((traveller) => traveller.status !== "pending" || Number(traveller.amountPaid) > 0))
        throw new PackageBookingError("Only unpaid pending bookings can be cancelled here");
      const ids = pending.map((traveller) => traveller.id);
      const paidPayment = await tx.query.paymentsTable.findFirst({
        where: and(inArray(paymentsTable.bookingId, ids), eq(paymentsTable.status, "verified")),
      });
      if (paidPayment)
        throw new PackageBookingError("A payment has been recorded. Contact support to cancel.");
      if (!await retireExpiredPackageCheckouts(tx, ids))
        throw new PackageBookingError("This booking has an open or unresolved payment. Check its payment status before cancelling.");
      const seats = pending.reduce((total, traveller) => total + traveller.pilgrimCount, 0);
      await tx.update(bookingsTable).set({ status: "cancelled", updatedAt: new Date() })
        .where(inArray(bookingsTable.id, ids));
      await tx.update(packagesTable)
        .set({ currentBookings: sql`greatest(0, ${packagesTable.currentBookings} - ${seats})` })
        .where(eq(packagesTable.id, booking.packageId));
    });
    return res.json({ success: true });
  } catch (error) {
    if (error instanceof PackageBookingError) return res.status(error.status).json({ error: error.message });
    throw error;
  }
});


router.put("/bookings/:id/archive", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const actorProfile = await getProfileByClerkId(clerkUserId);
  if (!actorProfile) return res.status(404).json({ error: "Profile not found" });
  const isAdmin = ["admin", "super_admin", "staff"].includes(actorProfile.role);
  if (!isAdmin) return res.status(403).json({ error: "Admin access required" });

  const { archiveReason } = req.body;

  const booking = await db.transaction(async (tx) => {
    const [current] = await tx.update(bookingsTable)
      .set({ isArchived: true, archiveReason: archiveReason || null, updatedAt: new Date() })
      .where(eq(bookingsTable.id, req.params.id)).returning();
    if (!current) return;
    await tx.update(paymentsTable)
      .set({ isArchived: true, archiveReason: archiveReason || "Archived with booking" })
      .where(eq(paymentsTable.bookingId, current.id));
    return current;
  });

  if (!booking) return res.status(404).json({ error: "Booking not found" });

  return res.json(toBookingResponse(booking));
});

router.put("/bookings/:id/restore", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const actorProfile = await getProfileByClerkId(clerkUserId);
  if (!actorProfile) return res.status(404).json({ error: "Profile not found" });
  const isAdmin = ["admin", "super_admin", "staff"].includes(actorProfile.role);
  if (!isAdmin) return res.status(403).json({ error: "Admin access required" });

  const booking = await db.transaction(async (tx) => {
    // Package settlement serializes on this booking row, including late payments on archived bookings.
    const [current] = await tx.update(bookingsTable)
      .set({ isArchived: false, archiveReason: null, updatedAt: new Date() })
      .where(eq(bookingsTable.id, req.params.id)).returning();
    if (!current) return;
    await tx.update(paymentsTable)
      .set({ isArchived: false, archiveReason: null })
      .where(eq(paymentsTable.bookingId, current.id));
    const paid = sql`COALESCE((SELECT SUM(amount) FROM payments WHERE booking_id = ${current.id} AND status = 'verified' AND is_archived = false), 0)`;
    const [updated] = await tx.update(bookingsTable).set({
      amountPaid: paid,
      status: sql`CASE WHEN ${bookingsTable.status} = 'pending' AND ${paid} >= ${bookingsTable.totalPrice}
        THEN 'confirmed' ELSE ${bookingsTable.status} END`,
    }).where(eq(bookingsTable.id, current.id)).returning();
    if (updated && current.status === "pending" && updated.status === "confirmed")
      await confirmPaidGroup(tx, updated);
    return updated;
  });

  if (!booking) return res.status(404).json({ error: "Booking not found" });

  return res.json(toBookingResponse(booking));
});

export default router;
