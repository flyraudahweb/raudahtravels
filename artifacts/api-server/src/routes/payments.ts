import { Router } from "express";
import { db } from "@workspace/db";
import {
  paymentsTable,
  profilesTable,
  bookingsTable,
  userActivityTable,
  packagesTable,
  agentsTable,
  agentWalletsTable,
  walletTransactionsTable,
} from "@workspace/db";
import { createNotification } from "../utils/notify.js";
import { getAuth } from "@clerk/express";
import { eq, and, sql, desc, inArray, isNotNull, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { sendPaymentReceipt } from "../utils/email";
import { logger } from "../lib/logger";
import {
  expiredUnpaidPaystackSession,
  getPaystackSessionTimeout,
  isPaystackReference,
  lookupPaystackTransaction,
  matchesPaystackBinding,
  matchesPaystackProof,
  matchesPaystackSignature,
} from "../services/payments/paystackProof";
import {
  canPayPackage, getPackagePaystackKeys as getPaystackKeys, packageBalanceKobo, packagePaystackMode,
  packageSalesModeAllowed, packageVerificationKey, paystackKeyFingerprint, retireExpiredPackageCheckouts,
} from "../services/payments/packagePaystack";
import { claimPaystackSettlement } from "../services/payments/paystackSettlement";
import { confirmPaidGroup } from "../services/payments/packageConfirmation";
import { otaAppOrigin } from "../services/ota/appOrigin";

const router = Router();

router.use((req, res, next) => {
  if (!req.path.startsWith("/payments")) return next();
  res.setHeader("Cache-Control", "no-store");
  if (req.path === "/payments/paystack/webhook") return next();
  const origin = req.get("origin");
  if (origin && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const allowed = [
      process.env.APP_URL,
      ...(process.env.CORS_ORIGIN || "")
        .split(",")
        .map((value) => value.trim()),
    ]
      .filter(Boolean)
      .flatMap((value) => {
        try {
          return [new URL(value!).origin];
        } catch {
          return [];
        }
      });
    if (process.env.NODE_ENV !== "production")
      allowed.push(
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
      );
    if (!allowed.includes(origin))
      return res.status(403).json({ error: "Untrusted request origin" });
  }
  next();
});

async function getProfileByClerkId(clerkUserId: string) {
  return db.query.profilesTable.findFirst({
    where: and(
      eq(profilesTable.clerkUserId, clerkUserId),
      eq(profilesTable.accountStatus, "active"),
    ),
  });
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

async function sendBookingReceipt(
  bookingId: string,
  amount: number,
  reference?: string,
  method?: string,
) {
  try {
    const booking = await db.query.bookingsTable.findFirst({
      where: eq(bookingsTable.id, bookingId),
    });
    if (!booking) return;
    const [profile, pkg] = await Promise.all([
      booking.userId
        ? db.query.profilesTable.findFirst({
            where: eq(profilesTable.id, booking.userId),
          })
        : Promise.resolve(null),
      booking.packageId
        ? db.query.packagesTable.findFirst({
            where: eq(packagesTable.id, booking.packageId),
          })
        : Promise.resolve(null),
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

// ── Payment stats (true aggregates, independent of pagination) ────────────────
router.get("/payments/stats", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  const isAdmin = ["admin", "super_admin", "staff"].includes(profile.role);
  if (!isAdmin) return res.status(403).json({ error: "Admin access required" });

  const [
    totalRow,
    verifiedRow,
    pendingRow,
    rejectedRow,
    countRow,
    verifiedCountRow,
    pendingCountRow,
  ] = await Promise.all([
    db
      .select({ sum: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
      .from(paymentsTable)
      .where(eq(paymentsTable.isArchived, false)),
    db
      .select({ sum: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
      .from(paymentsTable)
      .where(
        and(
          eq(paymentsTable.isArchived, false),
          eq(paymentsTable.status, "verified"),
        ),
      ),
    db
      .select({ sum: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
      .from(paymentsTable)
      .where(
        and(
          eq(paymentsTable.isArchived, false),
          eq(paymentsTable.status, "pending"),
        ),
      ),
    db
      .select({ sum: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
      .from(paymentsTable)
      .where(
        and(
          eq(paymentsTable.isArchived, false),
          eq(paymentsTable.status, "rejected"),
        ),
      ),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(paymentsTable)
      .where(eq(paymentsTable.isArchived, false)),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(paymentsTable)
      .where(
        and(
          eq(paymentsTable.isArchived, false),
          eq(paymentsTable.status, "verified"),
        ),
      ),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(paymentsTable)
      .where(
        and(
          eq(paymentsTable.isArchived, false),
          eq(paymentsTable.status, "pending"),
        ),
      ),
  ]);

  return res.json({
    totalAmount: Number(totalRow[0].sum),
    verifiedAmount: Number(verifiedRow[0].sum),
    pendingAmount: Number(pendingRow[0].sum),
    rejectedAmount: Number(rejectedRow[0].sum),
    totalCount: Number(countRow[0].count),
    verifiedCount: Number(verifiedCountRow[0].count),
    pendingCount: Number(pendingCountRow[0].count),
  });
});

router.get("/payments", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const {
    bookingId,
    status,
    archived,
    limit = "50",
    offset = "0",
  } = req.query as Record<string, string>;
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

  const rows = await db
    .select({
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

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(paymentsTable)
    .leftJoin(bookingsTable, eq(paymentsTable.bookingId, bookingsTable.id))
    .where(where);

  const payments = rows.map((r) => ({
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
    booking: r.booking
      ? {
          id: r.booking.id,
          reference: r.booking.reference,
          user: r.user
            ? { id: r.user.id, fullName: r.user.fullName, email: r.user.email }
            : null,
          package: r.packageName ? { name: r.packageName } : null,
        }
      : null,
  }));

  return res.json({ payments, total: Number(count) });
});

router.post("/payments", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const { bookingId, amount, method, reference, proofUrl, notes } = req.body;
  if (!bookingId || !amount || !method)
    return res
      .status(400)
      .json({ error: "bookingId, amount, method required" });

  // Validate method is a known enum value
  const ALLOWED_METHODS = ["bank_transfer", "cash", "ussd"];
  if (!ALLOWED_METHODS.includes(method)) {
    return res.status(400).json({
      error: `Invalid payment method. Must be one of: ${ALLOWED_METHODS.join(", ")}`,
    });
  }

  // Validate proof size: R2 URLs are short paths, but legacy base64 could be huge
  if (
    proofUrl &&
    typeof proofUrl === "string" &&
    proofUrl.startsWith("data:") &&
    proofUrl.length > 300_000
  ) {
    return res.status(400).json({
      error:
        "Payment proof file is too large. Please upload via the file uploader.",
    });
  }

  // Validate amount is a positive number
  const parsedAmount = parseFloat(String(amount));
  if (
    !Number.isFinite(parsedAmount) ||
    parsedAmount <= 0 ||
    !/^\d+(\.\d{1,2})?$/.test(String(amount))
  ) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }

  // Verify the booking exists and belongs to the authenticated user (or caller is admin/staff)
  const booking = await db.query.bookingsTable.findFirst({
    where: eq(bookingsTable.id, bookingId),
  });
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  const isCallerAdmin = ["admin", "super_admin", "staff"].includes(
    profile.role,
  );
  if (!isCallerAdmin && booking.userId !== profile.id)
    return res.status(403).json({ error: "Forbidden" });

  // Amount must not exceed the outstanding balance (prevents overpayment attacks)
  const outstandingBalance =
    Number(booking.totalPrice) - Number(booking.amountPaid);
  if (parsedAmount > outstandingBalance + 0.01) {
    // 0.01 tolerance for float rounding
    return res.status(400).json({
      error: `Amount ₦${parsedAmount.toLocaleString()} exceeds the outstanding balance of ₦${outstandingBalance.toLocaleString()}`,
    });
  }

  const [payment] = await db
    .insert(paymentsTable)
    .values({
      id: randomUUID(),
      bookingId,
      userId: profile.id,
      amount: String(parsedAmount),
      method,
      status: "pending",
      reference,
      proofUrl,
      notes,
    })
    .returning();

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

  const {
    search,
    limit = "50",
    offset = "0",
  } = req.query as Record<string, string>;

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

  const rows = await db
    .select({
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
    .orderBy(
      sql`(${bookingsTable.totalPrice}::numeric - ${bookingsTable.amountPaid}::numeric) DESC`,
    )
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(bookingsTable)
    .where(where);

  // Compute totals
  const [totals] = await db
    .select({
      totalOutstanding: sql<string>`COALESCE(SUM(${bookingsTable.totalPrice}::numeric - ${bookingsTable.amountPaid}::numeric), 0)`,
      totalOwed: sql<string>`COALESCE(SUM(${bookingsTable.totalPrice}::numeric), 0)`,
      totalPaid: sql<string>`COALESCE(SUM(${bookingsTable.amountPaid}::numeric), 0)`,
    })
    .from(bookingsTable)
    .where(where);

  const bookings = rows.map((r) => ({
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
  if (!isAdmin && payment.userId !== profile.id)
    return res.status(403).json({ error: "Forbidden" });
  return res.json(toPaymentResponse(payment));
});

router.put("/payments/:id/verify", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const actorProfile = await getProfileByClerkId(clerkUserId);
  if (!actorProfile)
    return res.status(404).json({ error: "Profile not found" });
  const isAdmin = ["admin", "super_admin", "staff"].includes(actorProfile.role);
  if (!isAdmin) return res.status(403).json({ error: "Admin access required" });

  const { status, notes } = req.body;
  if (!["verified", "rejected"].includes(status))
    return res.status(400).json({ error: "Choose verified or rejected" });
  const candidate = await db.query.paymentsTable.findFirst({
    where: eq(paymentsTable.id, req.params.id),
  });
  if (!candidate)
    return res.status(404).json({ error: "Payment not found" });
  if (
    status === "verified" &&
    ["paystack", "wallet"].includes(candidate?.method ?? "")
  )
    return res.status(409).json({
      error:
        "Online and wallet payments require their dedicated verification flow",
    });

  // Idempotency: only allow transitioning from pending — prevents double-verify race condition
  let payment: typeof paymentsTable.$inferSelect | undefined;
  let confirmedBooking: typeof bookingsTable.$inferSelect | undefined;

  const blocked = await db.transaction(async (tx) => {
    const [currentBooking] = await tx.select().from(bookingsTable)
      .where(eq(bookingsTable.id, candidate.bookingId)).for("update");
    const current = await tx.query.paymentsTable.findFirst({
      where: eq(paymentsTable.id, candidate.id),
    });
    if (!current || current.status !== "pending" || current.isArchived) return undefined;
    if (status === "verified") {
      if (!currentBooking || !canPayPackage(currentBooking) ||
          Math.round(Number(current.amount) * 100) > packageBalanceKobo(currentBooking))
        return "This payment exceeds the available balance or the booking can no longer accept payment.";
      if (!await retireExpiredPackageCheckouts(tx, [candidate.bookingId]))
        return "Resolve the open Paystack payment before verifying another payment.";
    }
    const [p] = await tx
      .update(paymentsTable)
      .set({ status, notes, ...(status === "verified" ? { verifiedBy: actorProfile.id, verifiedAt: new Date() } : {}) })
      .where(
        and(
          eq(paymentsTable.id, req.params.id),
          eq(paymentsTable.status, "pending"),
          eq(paymentsTable.isArchived, false),
        ),
      )
      .returning();
    if (!p) return undefined;
    payment = p;

    if (status === "verified" && p.bookingId) {
      // BUG FIX: Recalculate amountPaid from SUM of all verified payments instead of
      // accumulating. This prevents double-counting when the booking's amountPaid was
      // pre-populated during registration (the root cause of the double-count bug).
      // PARTIAL PAYMENT FIX: Only transition to 'confirmed' when fully paid.
      const [booking] = await tx
        .update(bookingsTable)
        .set({
          amountPaid: sql`COALESCE((SELECT SUM(amount::numeric) FROM payments WHERE booking_id = ${p.bookingId} AND status = 'verified' AND is_archived = false), 0)`,
          status: sql`CASE WHEN COALESCE((SELECT SUM(amount::numeric) FROM payments WHERE booking_id = ${p.bookingId} AND status = 'verified' AND is_archived = false), 0) >= ${bookingsTable.totalPrice}::numeric AND ${bookingsTable.status} = 'pending' AND ${bookingsTable.isArchived} = false THEN 'confirmed' ELSE ${bookingsTable.status} END`,
          updatedAt: new Date(),
        })
        .where(eq(bookingsTable.id, p.bookingId))
        .returning();
      if (booking) {
        await confirmPaidGroup(tx, booking);
        confirmedBooking = booking;
      }
    }
    return undefined;
  });
  if (blocked) return res.status(409).json({ error: blocked });

  if (!payment)
    return res
      .status(404)
      .json({ error: "Payment not found or already processed" });

  if (confirmedBooking) {
    setImmediate(() =>
      sendBookingReceipt(
        confirmedBooking!.id,
        Number(payment!.amount),
        payment!.reference ?? undefined,
        payment!.method,
      ),
    );
  }

  // Notify the pilgrim about payment outcome
  if (payment.userId) {
    const amt = `₦${Number(payment.amount).toLocaleString()}`;
    if (status === "verified") {
      const isNowConfirmed =
        confirmedBooking &&
        Number(confirmedBooking.amountPaid) >=
          Number(confirmedBooking.totalPrice);
      const balance = confirmedBooking
        ? Number(confirmedBooking.totalPrice) -
          Number(confirmedBooking.amountPaid)
        : 0;
      setImmediate(() =>
        createNotification(
          payment!.userId!,
          "Payment Verified ✓",
          `Your payment of ${amt} has been verified. ${isNowConfirmed ? "Your booking is now confirmed!" : balance > 0 ? `Outstanding balance: ₦${balance.toLocaleString()}` : ""}`.trim(),
          "payment",
        ),
      );
    } else if (status === "rejected") {
      setImmediate(() =>
        createNotification(
          payment!.userId!,
          "Payment Rejected",
          `Your payment of ${amt} was not approved. Please contact support or try again.`,
          "payment",
        ),
      );
    }
  }

  // Log activity
  if (clerkUserId) {
    try {
      const actor = await db.query.profilesTable.findFirst({
        where: eq(profilesTable.clerkUserId, clerkUserId),
      });
      if (actor) {
        const pilgrimBooking =
          confirmedBooking ??
          (payment.bookingId
            ? await db.query.bookingsTable.findFirst({
                where: eq(bookingsTable.id, payment.bookingId),
              })
            : undefined);
        await db.insert(userActivityTable).values({
          id: randomUUID(),
          userId: actor.id,
          eventType:
            status === "verified" ? "payment_verified" : "payment_rejected",
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
    } catch (_) {
      /* non-blocking */
    }
  }

  return res.json(toPaymentResponse(payment));
});

// ── Reinstate rejected payment ────────────────────────────────────────────────
router.put("/payments/:id/reinstate", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const actorProfile = await getProfileByClerkId(clerkUserId);
  if (!actorProfile)
    return res.status(404).json({ error: "Profile not found" });
  if (!["admin", "super_admin", "staff"].includes(actorProfile.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { reason } = req.body ?? {};

  let payment: typeof paymentsTable.$inferSelect | undefined;

  await db.transaction(async (tx) => {
    // Only allow reinstating rejected payments
    const [p] = await tx
      .update(paymentsTable)
      .set({
        status: "pending",
        notes: reason ? `Reinstated: ${reason}` : "Reinstated by admin",
      })
      .where(
        and(
          eq(paymentsTable.id, req.params.id),
          eq(paymentsTable.status, "rejected"),
        ),
      )
      .returning();
    if (!p) return;
    payment = p;
  });

  if (!payment)
    return res
      .status(404)
      .json({ error: "Payment not found or not in rejected status" });

  // Notify the pilgrim
  if (payment.userId) {
    const amt = `₦${Number(payment.amount).toLocaleString()}`;
    setImmediate(() =>
      createNotification(
        payment!.userId!,
        "Payment Under Review",
        `Your previously rejected payment of ${amt} has been reinstated and is now pending review.`,
        "payment",
      ),
    );
  }

  // Log activity
  try {
    const pilgrimBooking = payment.bookingId
      ? await db.query.bookingsTable.findFirst({
          where: eq(bookingsTable.id, payment.bookingId),
        })
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
  } catch (_) {
    /* non-blocking */
  }

  return res.json(toPaymentResponse(payment));
});

router.post("/payments/paystack/initialize", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await getProfileByClerkId(clerkUserId);
  if (profile?.accountStatus !== "active")
    return res.status(403).json({ error: "Account access is unavailable" });
  const { bookingId, email: bodyEmail } = req.body;
  const email = profile.email || bodyEmail;
  if (typeof bookingId !== "string" || typeof email !== "string" || !email)
    return res
      .status(400)
      .json({ error: "A booking and valid email are required" });

  try {
    const { secretKey, enabled } = await getPaystackKeys();
    const mode = paymentMode(secretKey);
    const allowNewCheckout = enabled && packageSalesModeAllowed(mode);
    const fingerprint = paystackKeyFingerprint(secretKey);
    function requireNewCheckout() {
      if (!allowNewCheckout) throw new OnlinePaymentError("Online package checkout is currently unavailable", 503);
    }
    const attempt = await db.transaction(async (tx) => {
      const [booking] = await tx
        .select()
        .from(bookingsTable)
        .where(eq(bookingsTable.id, bookingId))
        .for("update");
      if (!booking) throw new OnlinePaymentError("Booking not found", 404);
      const isStaff = ["admin", "super_admin", "staff"].includes(profile.role);
      if (!isStaff && booking.userId !== profile.id) {
        const agent = await tx.query.agentsTable.findFirst({
          where: and(
            eq(agentsTable.userId, profile.id),
            eq(agentsTable.status, "active"),
          ),
        });
        if (!agent || agent.id !== booking.agentId)
          throw new OnlinePaymentError("Forbidden", 403);
      }
      if (!canPayPackage(booking))
        throw new OnlinePaymentError("This booking cannot accept payment");
      const balance = packageBalanceKobo(booking);
      if (balance <= 0)
        throw new OnlinePaymentError("No outstanding balance on this booking");
      const existing = await tx.query.paymentsTable.findMany({
        where: and(
          eq(paymentsTable.bookingId, bookingId),
          eq(paymentsTable.method, "paystack"),
          inArray(paymentsTable.status, ["pending", "rejected"]),
          isNotNull(paymentsTable.reference),
          isNull(paymentsTable.checkoutRetiredAt),
        ),
        limit: 2,
      });
      if (existing.length > 1)
        throw new OnlinePaymentError(
          "Earlier payment attempts need reconciliation. Contact support before paying again.",
        );
      const current = existing[0];
      if (current) {
        const samePayerAndAmount = current.userId === profile.id &&
          Math.round(Number(current.amount) * 100) === balance;
        if (current.isArchived)
          throw new OnlinePaymentError(
            "An earlier payment attempt needs reconciliation. Contact support before paying again.",
          );
        if (current.checkoutUrl && current.checkoutAccessCode) {
          return {
            payment: current,
            balance,
            samePayerAndAmount,
            action: "check_published" as const,
          };
        }
        if (!current.checkoutInitializedAt)
          return { payment: current, balance, samePayerAndAmount, action: "check_legacy" as const };
        if (Date.now() - current.checkoutInitializedAt.getTime() < 45000)
          throw new OnlinePaymentError(
            "Payment is being prepared. Check the booking before trying again.",
          );
        const [payment] = await tx
          .update(paymentsTable)
          .set({ checkoutInitializedAt: new Date() })
          .where(eq(paymentsTable.id, current.id))
          .returning();
        return { payment, balance, samePayerAndAmount, action: "resume" as const };
      }
      requireNewCheckout();
      const [payment] = await tx
        .insert(paymentsTable)
        .values({
          id: randomUUID(),
          bookingId,
          userId: profile.id,
          amount: (balance / 100).toFixed(2),
          method: "paystack",
          status: "pending",
          reference: "RDH-" + randomUUID(),
          checkoutInitializedAt: new Date(),
          checkoutMode: mode,
          checkoutKeyFingerprint: fingerprint,
        })
        .returning();
      return { payment, balance, samePayerAndAmount: true, action: "initialize" as const };
    });

    const send = (payment: typeof paymentsTable.$inferSelect) =>
      res.status(201).json({
        payment: toPaymentResponse(payment),
        authorizationUrl: payment.checkoutUrl,
        accessCode: payment.checkoutAccessCode,
        reference: payment.reference,
      });
    let payment = attempt.payment;
    if (attempt.action !== "initialize") {
      const verificationKey = packageVerificationKey(payment, secretKey);
      const verificationMode = paymentMode(verificationKey);
      const gateway = await lookupPaystackTransaction(
        payment.reference!,
        verificationKey,
      );
      if (gateway?.status === "success") {
        const result = await settleOnlinePayment(payment, gateway, verificationMode);
        notifyOnlinePayment(result, payment.reference!);
        return res.json({
          verified: true,
          bookingConfirmed: result.booking?.status === "confirmed",
          reference: payment.reference,
        });
      }
      if (gateway && !matchesPaystackBinding(gateway, packageBinding(payment, verificationMode)))
        throw new OnlinePaymentError("The previous payment does not match this package booking.");
      const previousTimeout = await getPaystackSessionTimeout(verificationKey);
      const wasPublished = attempt.action === "check_published";
      const legacyAttempt = attempt.action === "check_legacy";
      const canReplace = expiredUnpaidPaystackSession(
        gateway, verificationMode, previousTimeout, payment.checkoutExpiresAt, payment.createdAt,
      );
      if (wasPublished && !canReplace) {
        const startedAt = Date.parse(gateway?.created_at ?? gateway?.createdAt);
        const sessionActive = payment.checkoutExpiresAt
          ? payment.checkoutExpiresAt.getTime() > Date.now()
          : previousTimeout === 0 || startedAt + previousTimeout * 1000 > Date.now();
        if (attempt.samePayerAndAmount && gateway && sessionActive &&
            packageSalesModeAllowed(verificationMode) && ["abandoned", "failed"].includes(gateway.status)) {
          const current = await db.query.paymentsTable.findFirst({
            where: and(eq(paymentsTable.id, payment.id), eq(paymentsTable.status, payment.status),
              eq(paymentsTable.isArchived, false), isNull(paymentsTable.checkoutRetiredAt)),
          });
          if (current) return send(current);
        }
        throw new OnlinePaymentError(
          "The previous payment may still be processing. Check this booking before trying again.",
        );
      }
      if (legacyAttempt && !canReplace)
        throw new OnlinePaymentError(
          "An earlier payment attempt needs reconciliation. Contact support before paying again.",
        );
      if (attempt.action === "resume" && gateway && !canReplace)
        throw new OnlinePaymentError(
          "The previous payment may still be processing. Check this booking before trying again.",
        );
      if (!gateway && payment.checkoutKeyFingerprint && payment.checkoutKeyFingerprint !== paystackKeyFingerprint(verificationKey))
        throw new OnlinePaymentError("The original Paystack account must be reconciled before paying again.");
      requireNewCheckout();
      if (gateway || !attempt.samePayerAndAmount || (payment.checkoutMode && payment.checkoutMode !== mode) ||
          (payment.checkoutKeyFingerprint && payment.checkoutKeyFingerprint !== fingerprint)) {
        // Keep the original reference available for reconciling late payments.
        const previous = payment;
        payment = await db.transaction(async (tx) => {
          const [booking] = await tx
            .select()
            .from(bookingsTable)
            .where(eq(bookingsTable.id, bookingId))
            .for("update");
          if (
            !booking ||
            !canPayPackage(booking) ||
            packageBalanceKobo(booking) !== attempt.balance
          )
            throw new OnlinePaymentError(
              "The booking balance changed. Refresh the booking.",
            );
          const [retired] = await tx
            .update(paymentsTable)
            .set({ checkoutRetiredAt: new Date() })
            .where(
              and(
                eq(paymentsTable.id, previous.id),
                eq(paymentsTable.status, previous.status),
                eq(paymentsTable.isArchived, false),
                previous.checkoutUrl === null
                  ? isNull(paymentsTable.checkoutUrl)
                  : eq(paymentsTable.checkoutUrl, previous.checkoutUrl),
                isNull(paymentsTable.checkoutRetiredAt),
                previous.checkoutInitializedAt
                  ? eq(paymentsTable.checkoutInitializedAt, previous.checkoutInitializedAt)
                  : isNull(paymentsTable.checkoutInitializedAt),
              ),
            )
            .returning();
          if (!retired)
            throw new OnlinePaymentError(
              "The payment status changed. Refresh the booking.",
            );
          const [replacement] = await tx
            .insert(paymentsTable)
            .values({
              id: randomUUID(),
              bookingId,
              userId: profile.id,
              amount: (attempt.balance / 100).toFixed(2),
              method: "paystack",
              reference: "RDH-" + randomUUID(),
              status: "pending",
              checkoutInitializedAt: new Date(),
              checkoutMode: mode,
              checkoutKeyFingerprint: fingerprint,
            })
            .returning();
          return replacement;
        });
      }
    }

    const timeout = await getPaystackSessionTimeout(secretKey);
    if (timeout === 0)
      throw new OnlinePaymentError("Online package checkout is unavailable until the payment session timeout is configured", 503);
    const upstream = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(20000),
        headers: {
          Authorization: "Bearer " + secretKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: Math.round(Number(payment.amount) * 100),
          currency: "NGN",
          reference: payment.reference,
          metadata: {
            bookingId, userId: profile.id, type: "package_booking",
            ...(payment.checkoutMode ? { packagePaymentId: payment.id } : {}),
          },
          ...(profile.role === "agent" && otaAppOrigin()
            ? { callback_url: `${otaAppOrigin()}/agent/bookings` } : {}),
        }),
      },
    );
    const reply = (await upstream.json()) as any;
    const data = reply.data;
    if (
      !upstream.ok ||
      !reply.status ||
      data?.reference !== payment.reference ||
      !/^https:\/\/checkout\.paystack\.com\//.test(
        data.authorization_url || "",
      ) ||
      typeof data.access_code !== "string" ||
      !data.access_code
    )
      throw new OnlinePaymentError(
        "Payment service could not prepare checkout. Check your booking before retrying.",
        502,
      );
    const saved = await db.transaction(async (tx) => {
      const [booking] = await tx.select().from(bookingsTable)
        .where(eq(bookingsTable.id, bookingId)).for("update");
      if (!booking || !canPayPackage(booking) ||
          packageBalanceKobo(booking) !== Math.round(Number(payment.amount) * 100))
        return;
      const [ready] = await tx.update(paymentsTable)
        .set({
          checkoutUrl: data.authorization_url,
          checkoutAccessCode: data.access_code,
          checkoutExpiresAt: timeout ? new Date(Date.now() + timeout * 1000) : null,
        })
        .where(and(eq(paymentsTable.id, payment.id), eq(paymentsTable.status, "pending"),
          isNull(paymentsTable.checkoutRetiredAt), eq(paymentsTable.checkoutInitializedAt, payment.checkoutInitializedAt!)))
        .returning();
      return ready;
    });
    if (!saved)
      throw new OnlinePaymentError(
        "The payment status changed. Refresh the booking.",
      );
    return send(saved);
  } catch (error) {
    return res
      .status(error instanceof OnlinePaymentError ? error.status : 503)
      .json({
        error:
          error instanceof OnlinePaymentError
            ? error.message
            : "Payment preparation is temporarily unavailable",
      });
  }
});

class OnlinePaymentError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
function paymentMode(secret: string): "test" | "live" {
  const mode = packagePaystackMode(secret);
  if (mode !== "test" && mode !== "live") throw new OnlinePaymentError("Paystack is not configured", 503);
  return mode;
}
async function registeredOnlinePayment(reference: unknown) {
  if (!isPaystackReference(reference))
    throw new OnlinePaymentError("Invalid payment reference", 400);
  const matches = await db.query.paymentsTable.findMany({
    where: and(
      eq(paymentsTable.reference, reference),
      eq(paymentsTable.method, "paystack"),
    ),
    limit: 2,
  });
  if (matches.length > 1)
    throw new OnlinePaymentError(
      "Duplicate online payment references require operator reconciliation",
    );
  return matches[0];
}
async function canonicalOnlinePayment(reference: string, secret: string) {
  const result = await lookupPaystackTransaction(reference, secret);
  if (!result)
    throw new OnlinePaymentError(
      "Payment verification is temporarily unavailable",
      502,
    );
  return result;
}

function packageBinding(payment: typeof paymentsTable.$inferSelect, mode: string) {
  return {
    reference: payment.reference || "",
    amountKobo: Math.round(Number(payment.amount) * 100),
    mode, purpose: "package" as const, bookingId: payment.bookingId, userId: payment.userId,
    ...(payment.checkoutMode ? { packagePaymentId: payment.id } : {}),
  };
}
async function settleOnlinePayment(
  record: typeof paymentsTable.$inferSelect,
  gateway: any,
  mode: string,
) {
  return db.transaction(async (tx) => {
    // Initialization, cancellation and settlement share the booking lock order.
    await tx.execute(
      sql`SELECT id FROM bookings WHERE id = ${record.bookingId} FOR UPDATE`,
    );
    const [current] = await tx
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, record.id))
      .for("update");
    if (
      !current ||
      current.method !== "paystack" ||
      !packageSalesModeAllowed(mode) ||
      (current.checkoutMode !== null && current.checkoutMode !== mode) ||
      !matchesPaystackProof(gateway, packageBinding(current, mode))
    )
      throw new OnlinePaymentError(
        "Payment does not match this package booking",
        402,
      );
    const { reference, bookingId, amountKobo } = packageBinding(current, mode);
    if (!await claimPaystackSettlement(tx, gateway.id, {
      mode, reference, bookingId, amountKobo, kind: "package", packagePaymentId: current.id,
    })) throw new OnlinePaymentError("Payment is already bound to another transaction or booking.");
    if (current.status === "verified")
      return {
        payment: current,
        booking: await tx.query.bookingsTable.findFirst({
          where: eq(bookingsTable.id, current.bookingId),
        }),
        changed: false,
      };
    if (current.status === "refunded")
      throw new OnlinePaymentError("This payment has already been refunded");
    // A successful provider transaction can settle a superseded/failed local attempt,
    // but only this immutable payment record and its original booking can be credited.
    const [payment] = await tx
      .update(paymentsTable)
      .set({ status: "verified", verifiedAt: new Date() })
      .where(eq(paymentsTable.id, current.id))
      .returning();
    const [booking] = await tx
      .update(bookingsTable)
      .set({
        amountPaid: sql`COALESCE((SELECT SUM(amount::numeric) FROM payments WHERE booking_id = ${current.bookingId} AND status = 'verified' AND is_archived = false), 0)`,
        status: sql`CASE WHEN COALESCE((SELECT SUM(amount::numeric) FROM payments WHERE booking_id = ${current.bookingId} AND status = 'verified' AND is_archived = false), 0) >= ${bookingsTable.totalPrice}::numeric AND ${bookingsTable.status} = 'pending' AND ${bookingsTable.isArchived} = false THEN 'confirmed' ELSE ${bookingsTable.status} END`,
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, current.bookingId))
      .returning();
    if (!booking)
      throw new OnlinePaymentError("Package booking not found", 404);
    await confirmPaidGroup(tx, booking);
    if (
      payment.userId &&
      (booking.status === "cancelled" ||
        booking.isArchived ||
        payment.isArchived ||
        Number(booking.amountPaid) > Number(booking.totalPrice))
    ) {
      await tx.insert(userActivityTable).values({
        id: randomUUID(),
        userId: payment.userId,
        bookingId: booking.id,
        eventType: "payment_reconciliation_required",
        metadata: {
          reference: payment.reference,
          bookingStatus: booking.status,
          amountPaid: booking.amountPaid,
        },
      });
    }
    return { payment, booking, changed: true };
  });
}
function notifyOnlinePayment(
  result: Awaited<ReturnType<typeof settleOnlinePayment>>,
  reference: string,
) {
  if (!result.changed || !result.booking) return;
  void sendBookingReceipt(
    result.booking.id,
    Number(result.payment.amount),
    reference,
    "paystack",
  );
  if (result.payment.userId)
    void db
      .insert(userActivityTable)
      .values({
        id: randomUUID(),
        userId: result.payment.userId,
        eventType: "payment_success",
        bookingId: result.booking.id,
        metadata: { amount: Number(result.payment.amount), reference },
      })
      .catch(() => {});
}
router.post("/payments/paystack/verify", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const profile = await getProfileByClerkId(userId);
    if (!profile) return res.status(403).json({ error: "Access denied" });
    const payment = await registeredOnlinePayment(req.body.reference);
    if (!payment)
      return res.status(404).json({ error: "Online payment record not found" });
    if (
      !["admin", "super_admin", "staff"].includes(profile.role) &&
      payment.userId !== profile.id
    )
      return res.status(403).json({ error: "Forbidden" });
    const { secretKey } = await getPaystackKeys();
    const verificationKey = packageVerificationKey(payment, secretKey);
    const mode = paymentMode(verificationKey);
    const gateway = await canonicalOnlinePayment(payment.reference!, verificationKey);
    const result = await settleOnlinePayment(
      payment,
      gateway,
      mode,
    );
    notifyOnlinePayment(result, payment.reference!);
    return res.json({
      verified: true,
      payment: toPaymentResponse(result.payment),
      bookingConfirmed:
        !!result.booking && result.booking.status === "confirmed",
    });
  } catch (error) {
    return res
      .status(error instanceof OnlinePaymentError ? error.status : 503)
      .json({
        error:
          error instanceof OnlinePaymentError
            ? error.message
            : "Payment verification is temporarily unavailable",
      });
  }
});
router.post("/payments/paystack/webhook", async (req, res) => {
  if (req.body?.data?.metadata?.otaBookingId) {
    const { otaPaymentWebhook } = await import("./ota");
    return otaPaymentWebhook(req, res);
  }
  try {
    const raw = (req as any).rawBody as Buffer | undefined;
    const signature = req.get("x-paystack-signature") || "";
    if (!raw || raw.length > 131072 || !/^[a-f0-9]{128}$/i.test(signature))
      return res.status(401).json({ error: "Invalid signature" });
    const { secretKey } = await getPaystackKeys();
    const previous = process.env.PACKAGE_PAYSTACK_PREVIOUS_SECRET_KEY || "";
    if (!matchesPaystackSignature(raw, signature, secretKey) &&
        !matchesPaystackSignature(raw, signature, previous))
      return res.status(401).json({ error: "Invalid signature" });
    const event = JSON.parse(raw.toString("utf8"));
    if (event.event !== "charge.success") return res.json({ received: true });
    if (!isPaystackReference(event.data?.reference)) return res.status(400).json({ error: "Invalid payment reference" });
    const payment = await registeredOnlinePayment(event.data?.reference);
    if (!payment) return res.json({ received: true });
    const verificationKey = packageVerificationKey(payment, secretKey);
    const mode = paymentMode(verificationKey);
    const gateway = await canonicalOnlinePayment(payment.reference!, verificationKey);
    const result = await settleOnlinePayment(payment, gateway, mode);
    notifyOnlinePayment(result, payment.reference!);
    // Acknowledge only after durable, idempotent crediting. A failure is retried by Paystack.
    return res.json({ received: true });
  } catch (error) {
    logger.warn(
      "Paystack webhook could not settle a matching payment; gateway retry or operator review is required",
    );
    return res.status(503).json({ error: "Payment processing unavailable" });
  }
});

// ── Admin: Record top-up payment for a booking ────────────────────────────────

router.post("/payments/admin-record", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const actorProfile = await getProfileByClerkId(clerkUserId);
  if (!actorProfile)
    return res.status(404).json({ error: "Profile not found" });
  const isAdmin = ["admin", "super_admin", "staff"].includes(actorProfile.role);

  // Also allow agents — they'll be verified against their booking below
  let actorAgent: typeof agentsTable.$inferSelect | null = null;
  if (!isAdmin) {
    actorAgent =
      (await db.query.agentsTable.findFirst({
        where: eq(agentsTable.userId, actorProfile.id),
      })) ?? null;
    if (!actorAgent || actorAgent.status !== "active") {
      return res
        .status(403)
        .json({ error: "Admin or active agent access required" });
    }
  }

  const {
    bookingId,
    amount,
    method,
    reference,
    proofUrl,
    notes,
    markVerified,
  } = req.body;
  if (!bookingId || !amount || !method)
    return res
      .status(400)
      .json({ error: "bookingId, amount, method required" });

  const ALLOWED_METHODS = [
    "bank_transfer",
    "cash",
    "ussd",
    ...(actorAgent ? ["wallet"] : []),
  ];
  if (!ALLOWED_METHODS.includes(method)) {
    return res.status(400).json({
      error: `Invalid payment method. Must be one of: ${ALLOWED_METHODS.join(", ")}`,
    });
  }

  // Validate proof size: R2 URLs are short paths, but legacy base64 could be huge
  if (
    proofUrl &&
    typeof proofUrl === "string" &&
    proofUrl.startsWith("data:") &&
    proofUrl.length > 300_000
  ) {
    return res.status(400).json({
      error:
        "Payment proof file is too large. Please upload via the file uploader.",
    });
  }

  const parsedAmount = parseFloat(String(amount));
  if (
    !Number.isFinite(parsedAmount) ||
    parsedAmount <= 0 ||
    !/^\d+(\.\d{1,2})?$/.test(String(amount))
  ) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }

  const booking = await db.query.bookingsTable.findFirst({
    where: eq(bookingsTable.id, bookingId),
  });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  // Agent ownership check: agents can only record payments for their own bookings
  if (actorAgent && booking.agentId !== actorAgent.id) {
    return res.status(403).json({
      error: "You can only record payments for your own client bookings",
    });
  }

  const outstandingBalance =
    Number(booking.totalPrice) - Number(booking.amountPaid);
  if (outstandingBalance <= 0) {
    return res
      .status(400)
      .json({ error: "This booking is already fully paid" });
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
    const wallet = await db.query.agentWalletsTable.findFirst({
      where: eq(agentWalletsTable.agentId, actorAgent!.id),
    });
    const walletBalance = Number(wallet?.balance || 0);
    if (walletBalance < parsedAmount) {
      return res.status(400).json({
        error: `Insufficient wallet balance. Available: ₦${walletBalance.toLocaleString()}, Required: ₦${parsedAmount.toLocaleString()}`,
      });
    }
  }

  let payment: typeof paymentsTable.$inferSelect | undefined;
  let updatedBooking: typeof bookingsTable.$inferSelect | undefined;

  try {
    await db.transaction(async (tx) => {
      // Serialize the outstanding-balance check with every other payment credit.
      const [lockedBooking] = await tx
        .select()
        .from(bookingsTable)
        .where(eq(bookingsTable.id, bookingId))
        .for("update");
      if (
        !lockedBooking ||
        !canPayPackage(lockedBooking) ||
        Math.round(parsedAmount * 100) > packageBalanceKobo(lockedBooking)
      ) {
        throw new OnlinePaymentError(
          "The outstanding balance changed. Refresh before paying.",
        );
      }
      if (actorAgent && lockedBooking.agentId !== actorAgent.id)
        throw new OnlinePaymentError("You can only record payments for your own client bookings", 403);
      if (shouldVerify && !await retireExpiredPackageCheckouts(tx, [bookingId]))
        throw new OnlinePaymentError("Resolve the open Paystack payment before recording another credit.");
      // For wallet payments, lock the wallet row to prevent race conditions
      if (isWalletPayment && actorAgent) {
        const lockResult = await tx.execute(
          sql`SELECT * FROM agent_wallets WHERE agent_id = ${actorAgent.id} FOR UPDATE`,
        );
        const walletRow =
          (lockResult as any).rows?.[0] ??
          (Array.isArray(lockResult) ? lockResult[0] : null);
        if (!walletRow) throw new OnlinePaymentError("Wallet not found");
        const currentBalance = Number((walletRow as any).balance);
        if (currentBalance < parsedAmount)
          throw new OnlinePaymentError("Insufficient wallet balance");

        // Debit wallet
        await tx
          .update(agentWalletsTable)
          .set({
            balance: sql`balance - ${parsedAmount}`,
            updatedAt: new Date(),
          })
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

      const [p] = await tx
        .insert(paymentsTable)
        .values({
          id: randomUUID(),
          bookingId,
          userId: booking.userId,
          amount: String(parsedAmount),
          method,
          status: shouldVerify ? "verified" : "pending",
          reference:
            reference || `TOPUP-${randomUUID().slice(0, 8).toUpperCase()}`,
          proofUrl: proofUrl || null,
          notes:
            notes ||
            (isWalletPayment
              ? `Wallet top-up by agent (${actorAgent!.businessName})`
              : "Top-up payment recorded by admin"),
          verifiedBy: shouldVerify ? actorProfile.id : null,
          verifiedAt: shouldVerify ? new Date() : null,
        })
        .returning();
      payment = p;

      if (shouldVerify) {
        // BUG FIX: Recalculate amountPaid from SUM of verified payments (idempotent).
        const [b] = await tx
          .update(bookingsTable)
          .set({
            amountPaid: sql`COALESCE((SELECT SUM(amount::numeric) FROM payments WHERE booking_id = ${bookingId} AND status = 'verified' AND is_archived = false), 0)`,
            status: sql`CASE WHEN COALESCE((SELECT SUM(amount::numeric) FROM payments WHERE booking_id = ${bookingId} AND status = 'verified' AND is_archived = false), 0) >= ${bookingsTable.totalPrice}::numeric AND ${bookingsTable.status} = 'pending' AND ${bookingsTable.isArchived} = false THEN 'confirmed' ELSE ${bookingsTable.status} END`,
            updatedAt: new Date(),
          })
          .where(eq(bookingsTable.id, bookingId))
          .returning();
        if (b) {
          updatedBooking = b;
          await confirmPaidGroup(tx, b);
        }
      }
    });
  } catch (error) {
    if (error instanceof OnlinePaymentError)
      return res.status(error.status).json({ error: error.message });
    logger.warn("Manual payment transaction failed; no credit was committed");
    return res.status(503).json({
      error: "Payment could not be recorded. Refresh before trying again.",
    });
  }

  // Notifications
  if (payment && booking.userId) {
    const amt = `₦${parsedAmount.toLocaleString()}`;
    const isNowConfirmed =
      updatedBooking &&
      Number(updatedBooking.amountPaid) >= Number(updatedBooking.totalPrice);
    const balance = updatedBooking
      ? Number(updatedBooking.totalPrice) - Number(updatedBooking.amountPaid)
      : outstandingBalance - parsedAmount;
    if (markVerified) {
      setImmediate(() =>
        createNotification(
          booking.userId!,
          "Payment Recorded & Verified ✓",
          `A payment of ${amt} has been recorded and verified. ${isNowConfirmed ? "Your booking is now confirmed!" : balance > 0 ? `Outstanding balance: ₦${balance.toLocaleString()}` : ""}`.trim(),
          "payment",
        ),
      );
    } else {
      setImmediate(() =>
        createNotification(
          booking.userId!,
          "Payment Recorded",
          `A payment of ${amt} has been recorded and is pending verification.`,
          "payment",
        ),
      );
    }
  }

  // Send receipt if verified & confirmed
  if (updatedBooking && payment) {
    setImmediate(() =>
      sendBookingReceipt(
        updatedBooking!.id,
        parsedAmount,
        payment!.reference ?? undefined,
        method,
      ),
    );
  }

  // Activity log — enriched with agent context (Enhancement 4)
  try {
    // Look up agent info if this is an agent-linked booking
    let agentBusinessName: string | null = null;
    let agentRecord: { userId: string; businessName: string } | null = null;
    if (booking.agentId) {
      const agent = await db.query.agentsTable.findFirst({
        where: eq(agentsTable.id, booking.agentId),
      });
      if (agent) {
        agentBusinessName = agent.businessName;
        agentRecord = agent;
      }
    }

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
        isAgentPilgrim: !!booking.agentId,
        agentId: booking.agentId || null,
        agentBusinessName,
      },
    });

    // Enhancement 4: Notify the agent when admin adds payment to their pilgrim
    if (isAdmin && booking.agentId && agentRecord?.userId) {
      const amt = `₦${parsedAmount.toLocaleString()}`;
      const statusText = markVerified
        ? "recorded and verified"
        : "recorded (pending verification)";
      setImmediate(() =>
        createNotification(
          agentRecord!.userId,
          "Payment Added to Your Client",
          `A payment of ${amt} has been ${statusText} for your client ${booking.fullName || "—"} (Ref: ${booking.reference}).`,
          "payment",
        ),
      );
    }
  } catch (_) {
    /* non-blocking */
  }

  return res.status(201).json({
    payment: payment ? toPaymentResponse(payment) : null,
    booking: updatedBooking
      ? {
          id: updatedBooking.id,
          status: updatedBooking.status,
          totalPrice: Number(updatedBooking.totalPrice),
          amountPaid: Number(updatedBooking.amountPaid),
          balance:
            Number(updatedBooking.totalPrice) -
            Number(updatedBooking.amountPaid),
        }
      : null,
  });
});

// ── Payment history for a booking ─────────────────────────────────────────────

router.get("/payments/booking/:bookingId", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const { bookingId } = req.params;
  const booking = await db.query.bookingsTable.findFirst({
    where: eq(bookingsTable.id, bookingId),
  });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  // Allow admin/staff, booking owner, or booking's agent
  const isAdmin = ["admin", "super_admin", "staff"].includes(profile.role);
  const isOwner = booking.userId === profile.id;
  let isAgent = false;
  if (booking.agentId) {
    const agent = await db.query.agentsTable.findFirst({
      where: eq(agentsTable.userId, profile.id),
    });
    isAgent = agent?.id === booking.agentId;
  }
  if (!isAdmin && !isOwner && !isAgent)
    return res.status(403).json({ error: "Forbidden" });

  const payments = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.bookingId, bookingId))
    .orderBy(desc(paymentsTable.createdAt));

  return res.json({
    payments: payments.map((p) => ({
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
  if (!actorProfile)
    return res.status(404).json({ error: "Profile not found" });
  const isAdmin = ["admin", "super_admin", "staff"].includes(actorProfile.role);
  if (!isAdmin) return res.status(403).json({ error: "Admin access required" });

  const { archiveReason } = req.body;

  let updatedPayment: typeof paymentsTable.$inferSelect | undefined;
  let paymentBlocked = false;

  await db.transaction(async (tx) => {
    const record = await tx.query.paymentsTable.findFirst({ where: eq(paymentsTable.id, req.params.id) });
    if (!record) return;
    await tx.execute(sql`SELECT id FROM bookings WHERE id = ${record.bookingId} FOR UPDATE`);
    const current = await tx.query.paymentsTable.findFirst({ where: eq(paymentsTable.id, record.id) });
    if (!current) return;
    if (current.method === "paystack" &&
        (current.status === "verified" || !await retireExpiredPackageCheckouts(tx, [current.bookingId]))) {
      paymentBlocked = true;
      return;
    }
    const [payment] = await tx
      .update(paymentsTable)
      .set({ isArchived: true, archiveReason: archiveReason || null })
      .where(eq(paymentsTable.id, req.params.id))
      .returning();

    if (!payment) return;
    updatedPayment = payment;

    // BUG FIX: Recalculate amountPaid from SUM of non-archived verified payments (idempotent).
    if (payment.status === "verified" && payment.bookingId) {
      await tx
        .update(bookingsTable)
        .set({
          amountPaid: sql`COALESCE((SELECT SUM(amount::numeric) FROM payments WHERE booking_id = ${payment.bookingId} AND status = 'verified' AND is_archived = false), 0)`,
          status: sql`CASE WHEN ${bookingsTable.status} IN ('cancelled', 'completed') OR ${bookingsTable.isArchived} THEN ${bookingsTable.status} WHEN COALESCE((SELECT SUM(amount::numeric) FROM payments WHERE booking_id = ${payment.bookingId} AND status = 'verified' AND is_archived = false), 0) >= ${bookingsTable.totalPrice}::numeric THEN 'confirmed'::booking_status ELSE 'pending'::booking_status END`,
          updatedAt: new Date(),
        })
        .where(eq(bookingsTable.id, payment.bookingId));
    }
  });

  if (paymentBlocked)
    return res.status(409).json({ error: "Reconcile this Paystack payment before changing its archive status." });
  if (!updatedPayment)
    return res.status(404).json({ error: "Payment not found" });
  return res.json(toPaymentResponse(updatedPayment));
});

router.put("/payments/:id/restore", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const actorProfile = await getProfileByClerkId(clerkUserId);
  if (!actorProfile)
    return res.status(404).json({ error: "Profile not found" });
  const isAdmin = ["admin", "super_admin", "staff"].includes(actorProfile.role);
  if (!isAdmin) return res.status(403).json({ error: "Admin access required" });

  let updatedPayment: typeof paymentsTable.$inferSelect | undefined;
  let paymentBlocked = false;

  await db.transaction(async (tx) => {
    const record = await tx.query.paymentsTable.findFirst({ where: eq(paymentsTable.id, req.params.id) });
    if (!record) return;
    await tx.execute(sql`SELECT id FROM bookings WHERE id = ${record.bookingId} FOR UPDATE`);
    const current = await tx.query.paymentsTable.findFirst({ where: eq(paymentsTable.id, record.id) });
    if (!current) return;
    if (current.isArchived && current.status === "verified" &&
        !await retireExpiredPackageCheckouts(tx, [current.bookingId])) {
      paymentBlocked = true;
      return;
    }
    const [payment] = await tx
      .update(paymentsTable)
      .set({ isArchived: false, archiveReason: null })
      .where(eq(paymentsTable.id, req.params.id))
      .returning();

    if (!payment) return;
    updatedPayment = payment;

    // BUG FIX: Recalculate amountPaid from SUM of non-archived verified payments (idempotent).
    if (payment.status === "verified" && payment.bookingId) {
      await tx
        .update(bookingsTable)
        .set({
          amountPaid: sql`COALESCE((SELECT SUM(amount::numeric) FROM payments WHERE booking_id = ${payment.bookingId} AND status = 'verified' AND is_archived = false), 0)`,
          status: sql`CASE WHEN ${bookingsTable.status} IN ('cancelled', 'completed') OR ${bookingsTable.isArchived} THEN ${bookingsTable.status} WHEN COALESCE((SELECT SUM(amount::numeric) FROM payments WHERE booking_id = ${payment.bookingId} AND status = 'verified' AND is_archived = false), 0) >= ${bookingsTable.totalPrice}::numeric THEN 'confirmed'::booking_status ELSE 'pending'::booking_status END`,
          updatedAt: new Date(),
        })
        .where(eq(bookingsTable.id, payment.bookingId));
    }
  });

  if (paymentBlocked)
    return res.status(409).json({ error: "Reconcile the active Paystack checkout before restoring this payment." });
  if (!updatedPayment)
    return res.status(404).json({ error: "Payment not found" });
  return res.json(toPaymentResponse(updatedPayment));
});

export default router;
