import { Router } from "express";
import { db } from "@workspace/db";
import { bookingsTable, packagesTable, packageDatesTable, profilesTable, visaApplicationsTable, userActivityTable, siteSettingsTable } from "@workspace/db";
import { createNotification } from "../utils/notify.js";
import { getAuth } from "@clerk/express";
import { eq, and, sql, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

async function getProfileByClerkId(clerkUserId: string) {
  return db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, clerkUserId) });
}

async function ensureVisaApplication(bookingId: string, pilgrimName?: string, passportNumber?: string, isFullyPaid?: boolean) {
  const existing = await db.query.visaApplicationsTable.findFirst({
    where: eq(visaApplicationsTable.bookingId, bookingId),
  });
  if (!existing) {
    await db.insert(visaApplicationsTable).values({
      id: randomUUID(),
      bookingId,
      pilgrimName: pilgrimName ?? null,
      passportNumber: passportNumber ?? null,
      status: isFullyPaid ? "pending" : "awaiting_payment",
    });
  } else if (isFullyPaid && existing.status === "awaiting_payment") {
    await db.update(visaApplicationsTable)
      .set({ status: "pending" })
      .where(eq(visaApplicationsTable.id, existing.id));
  }
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

  const { status, packageId, limit = "20", offset = "0" } = req.query as Record<string, string>;
  const conditions: any[] = [];

  const isAdmin = ["admin", "super_admin", "staff"].includes(profile.role);
  if (!isAdmin) conditions.push(eq(bookingsTable.userId, profile.id));
  if (status) conditions.push(eq(bookingsTable.status, status as any));
  if (packageId) conditions.push(eq(bookingsTable.packageId, packageId));

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

  return res.json({
    bookings: bookings.map(b => toBookingResponse(
      b,
      b.packageId ? pkgMap[b.packageId] : undefined,
      b.userId ? userMap[b.userId] : undefined,
      b.packageDateId ? dateMap[b.packageDateId] : undefined
    )),
    total: Number(total[0].count),
  });
});

router.post("/bookings", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  // Destructure fields explicitly — strip any server-controlled fields from the
  // remaining spread so a client cannot override totalPrice, amountPaid, status, etc.
  const {
    packageId, packageDateId, pilgrimCount, pilgrimDetails, notes, agentId,
    // Room surcharge and pilgrim type (client-provided, validated server-side)
    roomSurcharge: clientRoomSurcharge, pilgrimType, parentBookingId, batchId,
    // These must never come from the client — explicitly consumed & discarded:
    totalPrice: _tp, amountPaid: _ap, status: _st,
    id: _id, reference: _ref, userId: _uid,
    createdAt: _ca, updatedAt: _ua,
    ...safePilgrimFields
  } = req.body;

  if (!packageId) return res.status(400).json({ error: "packageId is required" });

  const pkg = await db.query.packagesTable.findFirst({ where: eq(packagesTable.id, packageId) });
  if (!pkg) return res.status(404).json({ error: "Package not found" });
  if (pkg.status && pkg.status !== "active") return res.status(400).json({ error: "Package is not currently available" });

  const count = Math.max(1, Number(pilgrimCount) || 1);

  // Capacity check — prevent overbooking
  if (pkg.capacity && ((pkg.currentBookings || 0) + count) > pkg.capacity) {
    return res.status(409).json({ error: "Package is fully booked — no more capacity available" });
  }

  // Fetch settings for accurate server-side pricing
  const roomSettings = await db.query.siteSettingsTable.findFirst({ where: eq(siteSettingsTable.key, "room_surcharges") });
  const roomSurcharges = (roomSettings?.value as any) || {};

  // Compute pricing
  let finalTotalPrice = 0;
  const surcharge = Number(roomSurcharges[(safePilgrimFields.roomPreference || "quad").toLowerCase()]) || 0;
  
  if (parentBookingId) {
    // Child bookings are paid for by the parent booking
    finalTotalPrice = 0;
  } else {
    // Parent booking: Base + Room Surcharge + Children
    const basePerPerson = Number(pkg.price) + surcharge;
    const childrenExtra = Number((safePilgrimFields.customData as any)?.childrenExtra) || 0;
    finalTotalPrice = (basePerPerson * count) + childrenExtra;
  }

  const reference = `RDH-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;

  const [booking] = await db.insert(bookingsTable).values({
    id: randomUUID(),
    reference,
    userId: profile.id,
    packageId,
    packageDateId: packageDateId || undefined,
    agentId,
    status: "pending",     // always starts pending — never trust client
    totalPrice: String(finalTotalPrice),
    amountPaid: "0",       // always zero at creation
    pilgrimCount: count,
    pilgrimDetails,
    notes,
    roomSurcharge: String(surcharge),
    pilgrimType: pilgrimType || "adult",
    parentBookingId: parentBookingId || undefined,
    batchId: batchId || undefined,
    ...safePilgrimFields,  // only safe pilgrim-detail fields (name, passport, etc.)
  }).returning();

  // Increment package currentBookings
  await db.update(packagesTable)
    .set({ currentBookings: sql`${packagesTable.currentBookings} + ${count}` })
    .where(eq(packagesTable.id, packageId));

  // Always create an awaiting_payment visa application for new bookings
  await ensureVisaApplication(booking.id, booking.fullName ?? undefined, booking.passportNumber ?? undefined, false);

  return res.status(201).json(toBookingResponse(booking));
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
  if (!actorProfile) return res.status(404).json({ error: "Profile not found" });
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
  if (amountPaid != null) updateData.amountPaid = String(amountPaid);
  if (visaDeliveryMessage !== undefined) updateData.visaDeliveryMessage = visaDeliveryMessage;
  if (ticketDocumentUrl !== undefined) updateData.ticketDocumentUrl = ticketDocumentUrl;

  const [booking] = await db.update(bookingsTable)
    .set(updateData)
    .where(eq(bookingsTable.id, req.params.id))
    .returning();
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  if (updateData.status === "confirmed") {
    // Generate an idNumber if the booking doesn't have one
    await db.execute(sql`
      UPDATE bookings 
      SET id_number = nextval('bookings_id_number_seq') 
      WHERE id = ${booking.id} AND id_number IS NULL
    `);
    await ensureVisaApplication(booking.id, booking.fullName ?? undefined, booking.passportNumber ?? undefined, true);
  }

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
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const booking = await db.query.bookingsTable.findFirst({
    where: eq(bookingsTable.id, req.params.id),
  });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  const isAdmin = ["admin", "super_admin", "staff"].includes(profile.role);
  if (!isAdmin && booking.userId !== profile.id) return res.status(403).json({ error: "Forbidden" });

  // Only allow deleting pending bookings that have no payments
  if (booking.status !== "pending" || Number(booking.amountPaid) > 0) {
    return res.status(400).json({ error: "Can only delete pending bookings with no payments" });
  }

  // Decrement package stock
  if (booking.packageId) {
    await db.update(packagesTable)
      .set({ currentBookings: sql`${packagesTable.currentBookings} - ${booking.pilgrimCount || 1}` })
      .where(eq(packagesTable.id, booking.packageId));
  }

  // Clean up related records
  await db.delete(visaApplicationsTable).where(eq(visaApplicationsTable.bookingId, booking.id));
  const { paymentsTable } = await import("@workspace/db");
  await db.delete(paymentsTable).where(eq(paymentsTable.bookingId, booking.id));
  await db.delete(bookingsTable).where(eq(bookingsTable.id, booking.id));

  return res.json({ success: true });
});

export default router;
