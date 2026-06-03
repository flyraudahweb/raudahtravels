import { Router } from "express";
import { db } from "@workspace/db";
import { paymentsTable, profilesTable, bookingsTable, visaApplicationsTable, siteSettingsTable, userActivityTable, packagesTable, agentsTable, agentWalletsTable, walletTransactionsTable } from "@workspace/db";
import { createNotification } from "../utils/notify.js";
import { getAuth } from "@clerk/express";
import { eq, and, sql, desc } from "drizzle-orm";
import { randomUUID, createHmac, timingSafeEqual } from "crypto";
import { sendPaymentReceipt } from "../utils/email";
import { logger } from "../lib/logger";

const router = Router();

async function getPaystackKeys(): Promise<{ publicKey: string; secretKey: string }> {
  const [pkRow, skRow] = await Promise.all([
    db.query.siteSettingsTable.findFirst({ where: eq(siteSettingsTable.key, "paystack_public_key") }),
    db.query.siteSettingsTable.findFirst({ where: eq(siteSettingsTable.key, "paystack_secret_key") }),
  ]);
  return {
    publicKey: (pkRow?.value as string | undefined) ?? process.env.PAYSTACK_PUBLIC_KEY ?? "",
    secretKey: (skRow?.value as string | undefined) ?? process.env.PAYSTACK_SECRET_KEY ?? "",
  };
}

async function getProfileByClerkId(clerkUserId: string) {
  return db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, clerkUserId) });
}

function toPaymentResponse(p: typeof paymentsTable.$inferSelect) {
  return {
    id: p.id,
    bookingId: p.bookingId,
    userId: p.userId,
    amount: Number(p.amount),
    method: p.method,
    status: p.status,
    reference: p.reference,
    proofUrl: p.proofUrl,
    notes: p.notes,
    createdAt: p.createdAt,
    booking: null,
  };
}

async function sendBookingReceipt(bookingId: string, amount: number, reference?: string, method?: string) {
  try {
    const booking = await db.query.bookingsTable.findFirst({ where: eq(bookingsTable.id, bookingId) });
    if (!booking) return;
    const [profile, pkg] = await Promise.all([
      booking.userId ? db.query.profilesTable.findFirst({ where: eq(profilesTable.id, booking.userId) }) : Promise.resolve(null),
      booking.packageId ? db.query.packagesTable.findFirst({ where: eq(packagesTable.id, booking.packageId) }) : Promise.resolve(null),
    ]);
    const email = profile?.email;
    if (!email) return;
    await sendPaymentReceipt({
      pilgrimName: booking.fullName ?? profile?.fullName ?? "Pilgrim",
      email,
      bookingRef: bookingId.slice(0, 8).toUpperCase(),
      packageName: (pkg as any)?.name ?? undefined,
      amount,
      method: method ?? "payment",
      reference,
    });
  } catch (err) {
    logger.warn({ err, bookingId }, "Receipt email failed (non-blocking)");
  }
}

async function ensureVisaApplication(bookingId: string, pilgrimName?: string | null, passportNumber?: string | null, isFullyPaid?: boolean) {
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

router.get("/payments", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const { bookingId, status, archived, limit = "50", offset = "0" } = req.query as Record<string, string>;
  const isAdmin = ["admin", "super_admin", "staff"].includes(profile.role);

  const conditions: any[] = [];
  if (!isAdmin) conditions.push(eq(paymentsTable.userId, profile.id));
  if (bookingId) conditions.push(eq(paymentsTable.bookingId, bookingId));
  if (status) conditions.push(eq(paymentsTable.status, status as any));
  if (archived === "true") {
    conditions.push(eq(paymentsTable.isArchived, true));
  } else {
    conditions.push(eq(paymentsTable.isArchived, false));
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db.select({
    payment: paymentsTable,
    booking: {
      id: bookingsTable.id,
      reference: bookingsTable.reference,
    },
    user: {
      id: profilesTable.id,
      fullName: profilesTable.fullName,
      email: profilesTable.email,
    },
    packageName: packagesTable.name,
  })
    .from(paymentsTable)
    .leftJoin(bookingsTable, eq(paymentsTable.bookingId, bookingsTable.id))
    .leftJoin(profilesTable, eq(paymentsTable.userId, profilesTable.id))
    .leftJoin(packagesTable, eq(bookingsTable.packageId, packagesTable.id))
    .where(where)
    .orderBy(desc(paymentsTable.createdAt))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  const [{ count }] = await db.select({ count: sql<number>`count(*)` })
    .from(paymentsTable)
    .leftJoin(bookingsTable, eq(paymentsTable.bookingId, bookingsTable.id))
    .where(where);

  const payments = rows.map(r => ({
    id: r.payment.id,
    bookingId: r.payment.bookingId,
    userId: r.payment.userId,
    amount: Number(r.payment.amount),
    method: r.payment.method,
    status: r.payment.status,
    reference: r.payment.reference,
    proofUrl: r.payment.proofUrl,
    notes: r.payment.notes,
    createdAt: r.payment.createdAt,
    booking: r.booking ? {
      id: r.booking.id,
      reference: r.booking.reference,
      user: r.user ? { id: r.user.id, fullName: r.user.fullName, email: r.user.email } : null,
      package: r.packageName ? { name: r.packageName } : null,
    } : null,
  }));

  return res.json({ payments, total: Number(count) });
});

router.post("/payments", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const { bookingId, amount, method, reference, proofUrl, notes } = req.body;
  if (!bookingId || !amount || !method) return res.status(400).json({ error: "bookingId, amount, method required" });

  // Validate method is a known enum value
  const ALLOWED_METHODS = ["bank_transfer", "cash", "paystack", "ussd", "wallet"];
  if (!ALLOWED_METHODS.includes(method)) {
    return res.status(400).json({ error: `Invalid payment method. Must be one of: ${ALLOWED_METHODS.join(", ")}` });
  }

  // Validate proof size: R2 URLs are short paths, but legacy base64 could be huge
  if (proofUrl && typeof proofUrl === "string" && proofUrl.startsWith("data:") && proofUrl.length > 300_000) {
    return res.status(400).json({ error: "Payment proof file is too large. Please upload via the file uploader." });
  }

  // Validate amount is a positive number
  const parsedAmount = parseFloat(String(amount));
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }

  // Verify the booking exists and belongs to the authenticated user (or caller is admin/staff)
  const booking = await db.query.bookingsTable.findFirst({ where: eq(bookingsTable.id, bookingId) });
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  const isCallerAdmin = ["admin", "super_admin", "staff"].includes(profile.role);
  if (!isCallerAdmin && booking.userId !== profile.id) return res.status(403).json({ error: "Forbidden" });

  // Amount must not exceed the outstanding balance (prevents overpayment attacks)
  const outstandingBalance = Number(booking.totalPrice) - Number(booking.amountPaid);
  if (parsedAmount > outstandingBalance + 0.01) { // 0.01 tolerance for float rounding
    return res.status(400).json({
      error: `Amount ₦${parsedAmount.toLocaleString()} exceeds the outstanding balance of ₦${outstandingBalance.toLocaleString()}`,
    });
  }

  const [payment] = await db.insert(paymentsTable).values({
    id: randomUUID(),
    bookingId,
    userId: profile.id,
    amount: String(parsedAmount),
    method,
    status: "pending",
    reference,
    proofUrl,
    notes,
  }).returning();

  return res.status(201).json(toPaymentResponse(payment));
});

// ── Outstanding balances / debtors list ───────────────────────────────────────

router.get("/payments/outstanding", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  const isAdmin = ["admin", "super_admin", "staff"].includes(profile.role);
  if (!isAdmin) return res.status(403).json({ error: "Admin access required" });

  const { search, limit = "50", offset = "0" } = req.query as Record<string, string>;

  const conditions: any[] = [
    sql`${bookingsTable.amountPaid}::numeric < ${bookingsTable.totalPrice}::numeric`,
    sql`${bookingsTable.status} != 'cancelled'`,
    eq(bookingsTable.isArchived, false),
  ];

  if (search) {
    const q = `%${search}%`;
    conditions.push(
      sql`(${bookingsTable.fullName} ILIKE ${q} OR ${bookingsTable.reference} ILIKE ${q} OR ${bookingsTable.phone} ILIKE ${q} OR ${bookingsTable.passportNumber} ILIKE ${q})`,
    );
  }

  const where = and(...conditions);

  const rows = await db.select({
    booking: {
      id: bookingsTable.id,
      reference: bookingsTable.reference,
      fullName: bookingsTable.fullName,
      phone: bookingsTable.phone,
      status: bookingsTable.status,
      totalPrice: bookingsTable.totalPrice,
      amountPaid: bookingsTable.amountPaid,
      createdAt: bookingsTable.createdAt,
      userId: bookingsTable.userId,
    },
    packageName: packagesTable.name,
    packageType: packagesTable.type,
    agentName: agentsTable.businessName,
  })
    .from(bookingsTable)
    .leftJoin(packagesTable, eq(bookingsTable.packageId, packagesTable.id))
    .leftJoin(agentsTable, eq(bookingsTable.agentId, agentsTable.id))
    .where(where)
    .orderBy(sql`(${bookingsTable.totalPrice}::numeric - ${bookingsTable.amountPaid}::numeric) DESC`)
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  const [{ count }] = await db.select({ count: sql<number>`count(*)` })
    .from(bookingsTable)
    .where(where);

  // Compute totals
  const [totals] = await db.select({
    totalOutstanding: sql<string>`COALESCE(SUM(${bookingsTable.totalPrice}::numeric - ${bookingsTable.amountPaid}::numeric), 0)`,
    totalOwed: sql<string>`COALESCE(SUM(${bookingsTable.totalPrice}::numeric), 0)`,
    totalPaid: sql<string>`COALESCE(SUM(${bookingsTable.amountPaid}::numeric), 0)`,
  })
    .from(bookingsTable)
    .where(where);

  const bookings = rows.map(r => ({
    ...r.booking,
    totalPrice: Number(r.booking.totalPrice),
    amountPaid: Number(r.booking.amountPaid),
    balance: Number(r.booking.totalPrice) - Number(r.booking.amountPaid),
    packageName: r.packageName,
    packageType: r.packageType,
    agentName: r.agentName,
  }));

  return res.json({
    bookings,
    total: Number(count),
    summary: {
      totalOutstanding: Number(totals.totalOutstanding),
      totalOwed: Number(totals.totalOwed),
      totalPaid: Number(totals.totalPaid),
      count: Number(count),
    },
  });
});

router.get("/payments/:id", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const payment = await db.query.paymentsTable.findFirst({
    where: eq(paymentsTable.id, req.params.id),
  });
  if (!payment) return res.status(404).json({ error: "Payment not found" });

  const isAdmin = ["admin", "super_admin", "staff"].includes(profile.role);
  if (!isAdmin && payment.userId !== profile.id) return res.status(403).json({ error: "Forbidden" });
  return res.json(toPaymentResponse(payment));
});

router.put("/payments/:id/verify", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const actorProfile = await getProfileByClerkId(clerkUserId);
  if (!actorProfile) return res.status(404).json({ error: "Profile not found" });
  const isAdmin = ["admin", "super_admin", "staff"].includes(actorProfile.role);
  if (!isAdmin) return res.status(403).json({ error: "Admin access required" });

  const { status, notes } = req.body;

  // Idempotency: only allow transitioning from pending — prevents double-verify race condition
  let payment: typeof paymentsTable.$inferSelect | undefined;
  let confirmedBooking: typeof bookingsTable.$inferSelect | undefined;

  await db.transaction(async (tx) => {
    const [p] = await tx.update(paymentsTable)
      .set({ status, notes })
      .where(and(eq(paymentsTable.id, req.params.id), eq(paymentsTable.status, "pending")))
      .returning();
    if (!p) return; // already processed or not found
    payment = p;

    if (status === "verified" && p.bookingId) {
      // BUG FIX: Recalculate amountPaid from SUM of all verified payments instead of
      // accumulating. This prevents double-counting when the booking's amountPaid was
      // pre-populated during registration (the root cause of the double-count bug).
      // PARTIAL PAYMENT FIX: Only transition to 'confirmed' when fully paid.
      const [booking] = await tx.update(bookingsTable)
        .set({
          amountPaid: sql`COALESCE((SELECT SUM(amount::numeric) FROM payments WHERE booking_id = ${p.bookingId} AND status = 'verified'), 0)`,
          status: sql`CASE WHEN COALESCE((SELECT SUM(amount::numeric) FROM payments WHERE booking_id = ${p.bookingId} AND status = 'verified'), 0) >= ${bookingsTable.totalPrice}::numeric THEN 'confirmed' ELSE ${bookingsTable.status} END`,
          updatedAt: new Date(),
        })
        .where(eq(bookingsTable.id, p.bookingId))
        .returning();
      if (booking) confirmedBooking = booking;
    }
  });

  if (!payment) return res.status(404).json({ error: "Payment not found or already processed" });

  if (confirmedBooking) {
    // Only create visa application when booking becomes fully paid
    const isFullyPaid = Number(confirmedBooking.amountPaid) >= Number(confirmedBooking.totalPrice);
    if (isFullyPaid) {
      // Generate an idNumber for fully paid bookings
      await db.execute(sql`
        UPDATE bookings 
        SET id_number = nextval('bookings_id_number_seq') 
        WHERE id = ${confirmedBooking.id} AND id_number IS NULL
      `);
      await ensureVisaApplication(confirmedBooking.id, confirmedBooking.fullName, confirmedBooking.passportNumber, true);
    }
    setImmediate(() => sendBookingReceipt(
      confirmedBooking!.id,
      Number(payment!.amount),
      payment!.reference ?? undefined,
      payment!.method,
    ));
  }

  // Notify the pilgrim about payment outcome
  if (payment.userId) {
    const amt = `₦${Number(payment.amount).toLocaleString()}`;
    if (status === "verified") {
      const isNowConfirmed = confirmedBooking && Number(confirmedBooking.amountPaid) >= Number(confirmedBooking.totalPrice);
      const balance = confirmedBooking ? Number(confirmedBooking.totalPrice) - Number(confirmedBooking.amountPaid) : 0;
      setImmediate(() => createNotification(
        payment!.userId!,
        "Payment Verified ✓",
        `Your payment of ${amt} has been verified. ${isNowConfirmed ? "Your booking is now confirmed!" : balance > 0 ? `Outstanding balance: ₦${balance.toLocaleString()}` : ""}`.trim(),
        "payment",
      ));
    } else if (status === "rejected") {
      setImmediate(() => createNotification(
        payment!.userId!,
        "Payment Rejected",
        `Your payment of ${amt} was not approved. Please contact support or try again.`,
        "payment",
      ));
    }
  }

  // Log activity
  if (clerkUserId) {
    try {
      const actor = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, clerkUserId) });
      if (actor) {
        const pilgrimBooking = confirmedBooking ?? (payment.bookingId
          ? await db.query.bookingsTable.findFirst({ where: eq(bookingsTable.id, payment.bookingId) })
          : undefined);
        await db.insert(userActivityTable).values({
          id: randomUUID(),
          userId: actor.id,
          eventType: status === "verified" ? "payment_verified" : "payment_rejected",
          bookingId: payment.bookingId ?? undefined,
          metadata: {
            actorName: actor.fullName,
            actorRole: actor.role,
            amount: Number(payment.amount),
            reference: payment.reference,
            targetName: pilgrimBooking?.fullName,
            targetPhone: pilgrimBooking?.phone,
          },
        });
      }
    } catch (_) { /* non-blocking */ }
  }

  return res.json(toPaymentResponse(payment));
});

// ── Reinstate rejected payment ────────────────────────────────────────────────
router.put("/payments/:id/reinstate", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const actorProfile = await getProfileByClerkId(clerkUserId);
  if (!actorProfile) return res.status(404).json({ error: "Profile not found" });
  if (!["admin", "super_admin", "staff"].includes(actorProfile.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { reason } = req.body ?? {};

  let payment: typeof paymentsTable.$inferSelect | undefined;

  await db.transaction(async (tx) => {
    // Only allow reinstating rejected payments
    const [p] = await tx.update(paymentsTable)
      .set({ status: "pending", notes: reason ? `Reinstated: ${reason}` : "Reinstated by admin" })
      .where(and(eq(paymentsTable.id, req.params.id), eq(paymentsTable.status, "rejected")))
      .returning();
    if (!p) return;
    payment = p;
  });

  if (!payment) return res.status(404).json({ error: "Payment not found or not in rejected status" });

  // Notify the pilgrim
  if (payment.userId) {
    const amt = `₦${Number(payment.amount).toLocaleString()}`;
    setImmediate(() => createNotification(
      payment!.userId!,
      "Payment Under Review",
      `Your previously rejected payment of ${amt} has been reinstated and is now pending review.`,
      "payment",
    ));
  }

  // Log activity
  try {
    const pilgrimBooking = payment.bookingId
      ? await db.query.bookingsTable.findFirst({ where: eq(bookingsTable.id, payment.bookingId) })
      : undefined;
    await db.insert(userActivityTable).values({
      id: randomUUID(),
      userId: actorProfile.id,
      eventType: "payment_reinstated",
      bookingId: payment.bookingId ?? undefined,
      metadata: {
        actorName: actorProfile.fullName,
        actorRole: actorProfile.role,
        amount: Number(payment.amount),
        reference: payment.reference,
        reason: reason || "No reason provided",
        targetName: pilgrimBooking?.fullName,
        targetPhone: pilgrimBooking?.phone,
      },
    });
  } catch (_) { /* non-blocking */ }

  return res.json(toPaymentResponse(payment));
});

router.post("/payments/paystack/initialize", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const { bookingId, email: bodyEmail } = req.body;
  if (!bookingId) return res.status(400).json({ error: "bookingId required" });
  // Prefer the authenticated user's email from their profile; fallback to body email
  const email = profile.email || bodyEmail;
  if (!email) return res.status(400).json({ error: "email required (no email on file — please update your profile)" });

  // Fetch booking server-side — NEVER trust a client-supplied amount
  const initBooking = await db.query.bookingsTable.findFirst({ where: eq(bookingsTable.id, bookingId) });
  if (!initBooking) return res.status(404).json({ error: "Booking not found" });

  // Allow initialization if the caller owns the booking, is admin/staff, or is the booking's agent
  const isCallerAdmin = ["admin", "super_admin", "staff"].includes(profile.role);
  const isBookingAgent = initBooking.agentId
    ? await (async () => {
        const agent = await db.query.agentsTable.findFirst({ where: eq(agentsTable.userId, profile.id) });
        return agent?.id === initBooking.agentId;
      })()
    : false;
  if (!isCallerAdmin && !isBookingAgent && initBooking.userId !== profile.id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (initBooking.status === "confirmed") return res.status(409).json({ error: "Booking is already confirmed" });

  const amount = Number(initBooking.totalPrice) - Number(initBooking.amountPaid);
  if (amount <= 0) return res.status(400).json({ error: "No outstanding balance on this booking" });

  // Cancel any prior pending Paystack attempt for this booking to avoid duplicate records
  await db.update(paymentsTable)
    .set({ status: "rejected" })
    .where(and(
      eq(paymentsTable.bookingId, bookingId),
      eq(paymentsTable.status, "pending"),
      eq(paymentsTable.method, "paystack"),
    ));

  const paystackRef = `RDH-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;

  const { secretKey: paystackSecret } = await getPaystackKeys();
  const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: Math.round(amount * 100),
      reference: paystackRef,
      metadata: { bookingId, userId: profile.id },
    }),
  });

  if (!paystackRes.ok) {
    const err = await paystackRes.json() as { message?: string };
    return res.status(502).json({ error: err.message ?? "Paystack error" });
  }

  const data = await paystackRes.json() as { data: { authorization_url: string; reference: string; access_code: string } };

  const [payment] = await db.insert(paymentsTable).values({
    id: randomUUID(),
    bookingId,
    userId: profile.id,
    amount: String(amount),
    method: "paystack",
    status: "pending",
    reference: paystackRef,
  }).returning();

  return res.status(201).json({
    payment: toPaymentResponse(payment),
    authorizationUrl: data.data.authorization_url,
    accessCode: data.data.access_code,
    reference: paystackRef,
  });
});

router.post("/payments/paystack/verify", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const { reference } = req.body as { reference?: string };
  if (!reference) return res.status(400).json({ error: "reference required" });

  const { secretKey: paystackSecret } = await getPaystackKeys();
  const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${paystackSecret}` },
  });

  if (!paystackRes.ok) {
    const err = await paystackRes.json() as { message?: string };
    return res.status(502).json({ error: err.message ?? "Paystack verify failed" });
  }

  const paystackData = await paystackRes.json() as {
    status: boolean;
    data: { status: string; amount: number; reference: string; metadata?: { bookingId?: string } };
  };
  const tx = paystackData.data;

  if (tx.status !== "success") {
    return res.status(402).json({ error: `Transaction status: ${tx.status}` });
  }

  // Find the payment record by reference
  const payment = await db.query.paymentsTable.findFirst({ where: eq(paymentsTable.reference, reference) });
  if (!payment) return res.status(404).json({ error: "Payment record not found" });

  // Ownership check — the reference must belong to the authenticated user's booking
  const verifyProfile = await getProfileByClerkId(clerkUserId);
  if (!verifyProfile) return res.status(404).json({ error: "Profile not found" });
  const isVerifyAdmin = ["admin", "super_admin", "staff"].includes(verifyProfile.role);
  if (!isVerifyAdmin && payment.userId !== verifyProfile.id) return res.status(403).json({ error: "Forbidden" });

  // Verify amount matches (Paystack returns amount in kobo)
  const expectedKobo = Math.round(Number(payment.amount) * 100);
  if (tx.amount !== expectedKobo) {
    req.log.warn({ reference, expected: expectedKobo, received: tx.amount }, "Paystack amount mismatch");
    return res.status(402).json({ error: "Amount mismatch — payment not confirmed" });
  }

  // SECURITY FIX #8: Wrap Paystack verify in a transaction for atomicity.
  // SECURITY FIX #7: Accumulate amountPaid instead of overwriting.
  let updatedPayment: typeof paymentsTable.$inferSelect | undefined;
  let confirmedBooking: typeof bookingsTable.$inferSelect | undefined;
  const bookingId = tx.metadata?.bookingId ?? payment.bookingId;

  await db.transaction(async (trx) => {
    // Mark payment as verified
    const [p] = await trx.update(paymentsTable)
      .set({ status: "verified" })
      .where(and(eq(paymentsTable.reference, reference), eq(paymentsTable.status, "pending")))
      .returning();
    if (!p) return; // already processed
    updatedPayment = p;

    // BUG FIX: Recalculate amountPaid from SUM of verified payments (idempotent).
    // PARTIAL PAYMENT FIX: Only transition to 'confirmed' when fully paid.
    if (bookingId) {
      const [booking] = await trx.update(bookingsTable)
        .set({
          amountPaid: sql`COALESCE((SELECT SUM(amount::numeric) FROM payments WHERE booking_id = ${bookingId} AND status = 'verified'), 0)`,
          status: sql`CASE WHEN COALESCE((SELECT SUM(amount::numeric) FROM payments WHERE booking_id = ${bookingId} AND status = 'verified'), 0) >= ${bookingsTable.totalPrice}::numeric THEN 'confirmed' ELSE ${bookingsTable.status} END`,
          updatedAt: new Date(),
        })
        .where(eq(bookingsTable.id, bookingId))
        .returning();
      if (booking) {
        confirmedBooking = booking;
        // Only create visa application when booking becomes fully paid
        const isFullyPaid = Number(booking.amountPaid) >= Number(booking.totalPrice);
        if (isFullyPaid) {
          // Generate an idNumber for fully paid bookings
          await trx.execute(sql`
            UPDATE bookings 
            SET id_number = nextval('bookings_id_number_seq') 
            WHERE id = ${booking.id} AND id_number IS NULL
          `);
          await ensureVisaApplication(booking.id, booking.fullName, booking.passportNumber, true);
        }
      }
    }
  });

  // Send receipt email (non-blocking)
  if (confirmedBooking) {
    setImmediate(() => sendBookingReceipt(
      confirmedBooking!.id,
      tx.amount / 100,
      reference,
      "paystack",
    ));
  }

  // Log activity
  try {
    const profile = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, clerkUserId) });
    if (profile) {
      await db.insert(userActivityTable).values({
        id: randomUUID(),
        userId: profile.id,
        eventType: "payment_success",
        bookingId: bookingId ?? undefined,
        metadata: {
          amount: tx.amount / 100,
          reference,
          targetName: confirmedBooking?.fullName ?? profile.fullName,
          targetPhone: confirmedBooking?.phone,
        },
      });
    }
  } catch (_) { /* non-blocking */ }

  return res.json({
    verified: true,
    payment: updatedPayment ? toPaymentResponse(updatedPayment) : toPaymentResponse(payment),
    bookingConfirmed: !!confirmedBooking,
  });
});

router.post("/payments/paystack/webhook", async (req, res) => {
  const signature = req.headers["x-paystack-signature"] as string;
  const rawBody = (req as any).rawBody as Buffer | undefined;

  if (!signature || !rawBody) return res.status(400).json({ error: "Missing signature or body" });

  const { secretKey: paystackSecret } = await getPaystackKeys();
  const hash = createHmac("sha512", paystackSecret).update(rawBody).digest("hex");

  // SECURITY FIX #3: Timing-safe HMAC comparison.
  // Regular string comparison (===) is vulnerable to timing attacks where
  // an attacker measures response times to guess the valid signature
  // byte-by-byte. timingSafeEqual runs in constant time.
  const hashBuf = Buffer.from(hash, "hex");
  const sigBuf = Buffer.from(signature, "hex");
  if (hashBuf.length !== sigBuf.length || !timingSafeEqual(hashBuf, sigBuf)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  // Acknowledge immediately — Paystack requires 200 OK before any long-running work.
  // Processing happens asynchronously so a slow DB can never cause a timeout retry.
  res.status(200).json({ received: true });

  const event = JSON.parse(rawBody.toString()) as {
    event: string;
    data: { reference: string; amount: number; metadata?: { bookingId?: string } };
  };

  setImmediate(async () => {
    try {
      if (event.event === "charge.success") {
        const { reference, amount, metadata } = event.data;

        // SECURITY FIX #1 & #2: Wrap in a transaction for atomicity +
        // accumulate amountPaid via SQL instead of overwriting.
        // Without this, partial payments get lost: if a pilgrim pays
        // ₦200k then ₦300k, the old code would set amountPaid=₦300k
        // instead of ₦500k.
        let confirmedPayment: typeof paymentsTable.$inferSelect | undefined;
        let confirmedBooking: typeof bookingsTable.$inferSelect | undefined;

        await db.transaction(async (tx) => {
          // Idempotency: only verify if still pending
          const [payment] = await tx.update(paymentsTable)
            .set({ status: "verified" })
            .where(and(eq(paymentsTable.reference, reference), eq(paymentsTable.status, "pending")))
            .returning();
          if (!payment) return; // already processed — idempotent
          confirmedPayment = payment;

          // SECURITY FIX #4: Verify webhook amount matches stored payment record.
          // Prevents confirming if amounts diverge (defence-in-depth).
          const expectedKobo = Math.round(Number(payment.amount) * 100);
          if (amount !== expectedKobo) {
            logger.error(
              { reference, expected: expectedKobo, received: amount },
              "WEBHOOK AMOUNT MISMATCH — possible tampering, rolling back",
            );
            throw new Error("Amount mismatch"); // rolls back the transaction
          }

          const bookingId = metadata?.bookingId ?? payment.bookingId;
          if (bookingId) {
            // BUG FIX: Recalculate amountPaid from SUM of verified payments (idempotent).
            // PARTIAL PAYMENT FIX: Only transition to 'confirmed' when fully paid.
            const [booking] = await tx.update(bookingsTable)
              .set({
                amountPaid: sql`COALESCE((SELECT SUM(amount::numeric) FROM payments WHERE booking_id = ${bookingId} AND status = 'verified'), 0)`,
                status: sql`CASE WHEN COALESCE((SELECT SUM(amount::numeric) FROM payments WHERE booking_id = ${bookingId} AND status = 'verified'), 0) >= ${bookingsTable.totalPrice}::numeric THEN 'confirmed' ELSE ${bookingsTable.status} END`,
                updatedAt: new Date(),
              })
              .where(eq(bookingsTable.id, bookingId))
              .returning();
            if (booking) {
              confirmedBooking = booking;
              // Only create visa application when booking becomes fully paid
              const isFullyPaid = Number(booking.amountPaid) >= Number(booking.totalPrice);
              if (isFullyPaid) {
                // Generate an idNumber for fully paid bookings
                await tx.execute(sql`
                  UPDATE bookings 
                  SET id_number = nextval('bookings_id_number_seq') 
                  WHERE id = ${booking.id} AND id_number IS NULL
                `);
                await ensureVisaApplication(booking.id, booking.fullName, booking.passportNumber, true);
              }
            }
          }
        });

        // Non-blocking post-transaction work
        if (confirmedBooking && confirmedPayment) {
          sendBookingReceipt(confirmedBooking.id, amount / 100, reference, "paystack").catch(() => {});
          if (confirmedPayment.userId) {
            db.insert(userActivityTable).values({
              id: randomUUID(),
              userId: confirmedPayment.userId,
              eventType: "payment_success",
              bookingId: confirmedBooking.id,
              metadata: { amount: amount / 100, reference, targetName: confirmedBooking.fullName, targetPhone: confirmedBooking.phone },
            }).catch(() => {});
          }
        }
      }

      if (event.event === "charge.failed") {
        const evData = event.data as any;
        const { reference, amount } = evData;
        const customer = evData.customer as { email?: string } | undefined;

        const payment = await db.query.paymentsTable.findFirst({ where: eq(paymentsTable.reference, reference) });
        if (payment) {
          await db.update(paymentsTable).set({ status: "rejected" }).where(eq(paymentsTable.id, payment.id));

          const pilgrimBooking = payment.bookingId
            ? await db.query.bookingsTable.findFirst({ where: eq(bookingsTable.id, payment.bookingId) })
            : undefined;
          const pilgrimProfile = payment.userId
            ? await db.query.profilesTable.findFirst({ where: eq(profilesTable.id, payment.userId) })
            : undefined;

          if (payment.userId) {
            await db.insert(userActivityTable).values({
              id: randomUUID(),
              userId: payment.userId,
              eventType: "payment_failed",
              bookingId: payment.bookingId ?? undefined,
              metadata: {
                amount: amount ? amount / 100 : Number(payment.amount),
                reference,
                targetName: pilgrimBooking?.fullName ?? pilgrimProfile?.fullName,
                targetPhone: pilgrimBooking?.phone ?? pilgrimProfile?.phone,
                targetEmail: customer?.email ?? pilgrimProfile?.email,
              },
            }).catch(() => {});
          }
        }
      }
    } catch (err) {
      logger.error({ err, event: event.event }, "Webhook processing error");
    }
  });

  return;
});

// ── Admin: Record top-up payment for a booking ────────────────────────────────

router.post("/payments/admin-record", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const actorProfile = await getProfileByClerkId(clerkUserId);
  if (!actorProfile) return res.status(404).json({ error: "Profile not found" });
  const isAdmin = ["admin", "super_admin", "staff"].includes(actorProfile.role);

  // Also allow agents — they'll be verified against their booking below
  let actorAgent: typeof agentsTable.$inferSelect | null = null;
  if (!isAdmin) {
    actorAgent = await db.query.agentsTable.findFirst({ where: eq(agentsTable.userId, actorProfile.id) });
    if (!actorAgent || actorAgent.status !== "active") {
      return res.status(403).json({ error: "Admin or active agent access required" });
    }
  }

  const { bookingId, amount, method, reference, proofUrl, notes, markVerified } = req.body;
  if (!bookingId || !amount || !method) return res.status(400).json({ error: "bookingId, amount, method required" });

  const ALLOWED_METHODS = ["bank_transfer", "cash", "paystack", "ussd", "wallet"];
  if (!ALLOWED_METHODS.includes(method)) {
    return res.status(400).json({ error: `Invalid payment method. Must be one of: ${ALLOWED_METHODS.join(", ")}` });
  }

  // Validate proof size: R2 URLs are short paths, but legacy base64 could be huge
  if (proofUrl && typeof proofUrl === "string" && proofUrl.startsWith("data:") && proofUrl.length > 300_000) {
    return res.status(400).json({ error: "Payment proof file is too large. Please upload via the file uploader." });
  }

  const parsedAmount = parseFloat(String(amount));
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }

  const booking = await db.query.bookingsTable.findFirst({ where: eq(bookingsTable.id, bookingId) });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  // Agent ownership check: agents can only record payments for their own bookings
  if (actorAgent && booking.agentId !== actorAgent.id) {
    return res.status(403).json({ error: "You can only record payments for your own client bookings" });
  }

  const outstandingBalance = Number(booking.totalPrice) - Number(booking.amountPaid);
  if (outstandingBalance <= 0) {
    return res.status(400).json({ error: "This booking is already fully paid" });
  }
  if (parsedAmount > outstandingBalance + 0.01) {
    return res.status(400).json({
      error: `Amount ₦${parsedAmount.toLocaleString()} exceeds the outstanding balance of ₦${outstandingBalance.toLocaleString()}`,
    });
  }

  // Determine verification: admin can choose, agent wallet auto-verifies, other agent methods don't
  const isWalletPayment = method === "wallet" && !!actorAgent;
  const shouldVerify = isAdmin ? !!markVerified : isWalletPayment;

  // Wallet balance check (agent wallet payments only)
  if (isWalletPayment) {
    const wallet = await db.query.agentWalletsTable.findFirst({ where: eq(agentWalletsTable.agentId, actorAgent!.id) });
    const walletBalance = Number(wallet?.balance || 0);
    if (walletBalance < parsedAmount) {
      return res.status(400).json({
        error: `Insufficient wallet balance. Available: ₦${walletBalance.toLocaleString()}, Required: ₦${parsedAmount.toLocaleString()}`,
      });
    }
  }

  let payment: typeof paymentsTable.$inferSelect | undefined;
  let updatedBooking: typeof bookingsTable.$inferSelect | undefined;

  await db.transaction(async (tx) => {
    // For wallet payments, lock the wallet row to prevent race conditions
    if (isWalletPayment && actorAgent) {
      const lockResult = await tx.execute(
        sql`SELECT * FROM agent_wallets WHERE agent_id = ${actorAgent.id} FOR UPDATE`
      );
      const walletRow = (lockResult as any).rows?.[0] ?? (Array.isArray(lockResult) ? lockResult[0] : null);
      if (!walletRow) throw new Error("Wallet not found");
      const currentBalance = Number((walletRow as any).balance);
      if (currentBalance < parsedAmount) throw new Error("Insufficient wallet balance");

      // Debit wallet
      await tx.update(agentWalletsTable)
        .set({ balance: sql`balance - ${parsedAmount}`, updatedAt: new Date() })
        .where(eq(agentWalletsTable.agentId, actorAgent.id));

      // Record wallet transaction
      await tx.insert(walletTransactionsTable).values({
        id: randomUUID(),
        agentId: actorAgent.id,
        amount: String(-parsedAmount),
        type: "booking_payment",
        reference: `TOPUP-${randomUUID().slice(0, 8).toUpperCase()}`,
        description: `Top-up payment for ${booking.fullName || "Client"} — Ref: ${booking.reference}`,
      });
    }

    const [p] = await tx.insert(paymentsTable).values({
      id: randomUUID(),
      bookingId,
      userId: booking.userId,
      amount: String(parsedAmount),
      method,
      status: shouldVerify ? "verified" : "pending",
      reference: reference || `TOPUP-${randomUUID().slice(0, 8).toUpperCase()}`,
      proofUrl: proofUrl || null,
      notes: notes || (isWalletPayment ? `Wallet top-up by agent (${actorAgent!.businessName})` : "Top-up payment recorded by admin"),
      verifiedBy: shouldVerify ? actorProfile.id : null,
      verifiedAt: shouldVerify ? new Date() : null,
    }).returning();
    payment = p;

    if (shouldVerify) {
      // BUG FIX: Recalculate amountPaid from SUM of verified payments (idempotent).
      const [b] = await tx.update(bookingsTable)
        .set({
          amountPaid: sql`COALESCE((SELECT SUM(amount::numeric) FROM payments WHERE booking_id = ${bookingId} AND status = 'verified'), 0)`,
          status: sql`CASE WHEN COALESCE((SELECT SUM(amount::numeric) FROM payments WHERE booking_id = ${bookingId} AND status = 'verified'), 0) >= ${bookingsTable.totalPrice}::numeric THEN 'confirmed' ELSE ${bookingsTable.status} END`,
          updatedAt: new Date(),
        })
        .where(eq(bookingsTable.id, bookingId))
        .returning();
      if (b) {
        updatedBooking = b;
        const isFullyPaid = Number(b.amountPaid) >= Number(b.totalPrice);
        if (isFullyPaid) {
          await ensureVisaApplication(b.id, b.fullName, b.passportNumber, true);
        }
      }
    }
  });

  // Notifications
  if (payment && booking.userId) {
    const amt = `₦${parsedAmount.toLocaleString()}`;
    const isNowConfirmed = updatedBooking && Number(updatedBooking.amountPaid) >= Number(updatedBooking.totalPrice);
    const balance = updatedBooking ? Number(updatedBooking.totalPrice) - Number(updatedBooking.amountPaid) : outstandingBalance - parsedAmount;
    if (markVerified) {
      setImmediate(() => createNotification(
        booking.userId!,
        "Payment Recorded & Verified ✓",
        `A payment of ${amt} has been recorded and verified. ${isNowConfirmed ? "Your booking is now confirmed!" : balance > 0 ? `Outstanding balance: ₦${balance.toLocaleString()}` : ""}`.trim(),
        "payment",
      ));
    } else {
      setImmediate(() => createNotification(
        booking.userId!,
        "Payment Recorded",
        `A payment of ${amt} has been recorded and is pending verification.`,
        "payment",
      ));
    }
  }

  // Send receipt if verified & confirmed
  if (updatedBooking && payment) {
    setImmediate(() => sendBookingReceipt(updatedBooking!.id, parsedAmount, payment!.reference ?? undefined, method));
  }

  // Activity log
  try {
    await db.insert(userActivityTable).values({
      id: randomUUID(),
      userId: actorProfile.id,
      eventType: markVerified ? "payment_verified" : "payment_recorded",
      bookingId,
      metadata: {
        actorName: actorProfile.fullName,
        actorRole: actorProfile.role,
        amount: parsedAmount,
        reference: payment?.reference,
        targetName: booking.fullName,
        targetPhone: booking.phone,
      },
    });
  } catch (_) { /* non-blocking */ }

  return res.status(201).json({
    payment: payment ? toPaymentResponse(payment) : null,
    booking: updatedBooking ? {
      id: updatedBooking.id,
      status: updatedBooking.status,
      totalPrice: Number(updatedBooking.totalPrice),
      amountPaid: Number(updatedBooking.amountPaid),
      balance: Number(updatedBooking.totalPrice) - Number(updatedBooking.amountPaid),
    } : null,
  });
});



// ── Payment history for a booking ─────────────────────────────────────────────

router.get("/payments/booking/:bookingId", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const { bookingId } = req.params;
  const booking = await db.query.bookingsTable.findFirst({ where: eq(bookingsTable.id, bookingId) });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  // Allow admin/staff, booking owner, or booking's agent
  const isAdmin = ["admin", "super_admin", "staff"].includes(profile.role);
  const isOwner = booking.userId === profile.id;
  let isAgent = false;
  if (booking.agentId) {
    const agent = await db.query.agentsTable.findFirst({ where: eq(agentsTable.userId, profile.id) });
    isAgent = agent?.id === booking.agentId;
  }
  if (!isAdmin && !isOwner && !isAgent) return res.status(403).json({ error: "Forbidden" });

  const payments = await db.select()
    .from(paymentsTable)
    .where(eq(paymentsTable.bookingId, bookingId))
    .orderBy(desc(paymentsTable.createdAt));

  return res.json({
    payments: payments.map(p => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.method,
      status: p.status,
      reference: p.reference,
      proofUrl: p.proofUrl,
      notes: p.notes,
      createdAt: p.createdAt,
      verifiedAt: p.verifiedAt,
    })),
    booking: {
      id: booking.id,
      reference: booking.reference,
      fullName: booking.fullName,
      totalPrice: Number(booking.totalPrice),
      amountPaid: Number(booking.amountPaid),
      balance: Number(booking.totalPrice) - Number(booking.amountPaid),
      status: booking.status,
    },
  });
});

router.put("/payments/:id/archive", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const actorProfile = await getProfileByClerkId(clerkUserId);
  if (!actorProfile) return res.status(404).json({ error: "Profile not found" });
  const isAdmin = ["admin", "super_admin", "staff"].includes(actorProfile.role);
  if (!isAdmin) return res.status(403).json({ error: "Admin access required" });

  const { archiveReason } = req.body;

  let updatedPayment: typeof paymentsTable.$inferSelect | undefined;

  await db.transaction(async (tx) => {
    const [payment] = await tx.update(paymentsTable)
      .set({ isArchived: true, archiveReason: archiveReason || null })
      .where(eq(paymentsTable.id, req.params.id))
      .returning();

    if (!payment) return;
    updatedPayment = payment;

    // If it was verified, we must subtract the amount from the booking's amountPaid
    // to keep revenue totals correct
    if (payment.status === "verified" && payment.bookingId) {
      await tx.update(bookingsTable)
        .set({
          amountPaid: sql`GREATEST(${bookingsTable.amountPaid} - ${payment.amount}::numeric, 0)`,
          updatedAt: new Date()
        })
        .where(eq(bookingsTable.id, payment.bookingId));
    }
  });

  if (!updatedPayment) return res.status(404).json({ error: "Payment not found" });
  return res.json(toPaymentResponse(updatedPayment));
});

router.put("/payments/:id/restore", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const actorProfile = await getProfileByClerkId(clerkUserId);
  if (!actorProfile) return res.status(404).json({ error: "Profile not found" });
  const isAdmin = ["admin", "super_admin", "staff"].includes(actorProfile.role);
  if (!isAdmin) return res.status(403).json({ error: "Admin access required" });

  let updatedPayment: typeof paymentsTable.$inferSelect | undefined;

  await db.transaction(async (tx) => {
    const [payment] = await tx.update(paymentsTable)
      .set({ isArchived: false, archiveReason: null })
      .where(eq(paymentsTable.id, req.params.id))
      .returning();

    if (!payment) return;
    updatedPayment = payment;

    // If it was verified, we must re-add the amount to the booking's amountPaid
    if (payment.status === "verified" && payment.bookingId) {
      await tx.update(bookingsTable)
        .set({
          amountPaid: sql`${bookingsTable.amountPaid} + ${payment.amount}::numeric`,
          updatedAt: new Date()
        })
        .where(eq(bookingsTable.id, payment.bookingId));
    }
  });

  if (!updatedPayment) return res.status(404).json({ error: "Payment not found" });
  return res.json(toPaymentResponse(updatedPayment));
});

export default router;
