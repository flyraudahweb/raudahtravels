import { Router } from "express";
import { db } from "@workspace/db";
import {
  bookingsTable, paymentsTable, notificationsTable,
  packagesTable, profilesTable, agentsTable, commissionsTable,
  supportTicketsTable, visaApplicationsTable, bookingAmendmentRequestsTable,
  agentWalletsTable,
} from "@workspace/db";
import { randomUUID } from "crypto";
import { getAuth } from "@clerk/express";
import { eq, and, sql, desc } from "drizzle-orm";

const router = Router();

async function getProfileByClerkId(clerkUserId: string) {
  return db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, clerkUserId) });
}

router.get("/dashboard/summary", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const myBookings = await db.query.bookingsTable.findMany({
    where: eq(bookingsTable.userId, profile.id),
  });

  const myPayments = await db.query.paymentsTable.findMany({
    where: eq(paymentsTable.userId, profile.id),
    limit: 5,
  });

  const myNotifications = await db.query.notificationsTable.findMany({
    where: and(eq(notificationsTable.userId, profile.id), eq(notificationsTable.isRead, false)),
  });

  const totalAmountPaid = myBookings.reduce((s, b) => s + Number(b.amountPaid), 0);
  const totalAmountDue = myBookings.reduce((s, b) => s + (Number(b.totalPrice) - Number(b.amountPaid)), 0);

  return res.json({
    totalBookings: myBookings.length,
    confirmedBookings: myBookings.filter((b) => b.status === "confirmed").length,
    pendingBookings: myBookings.filter((b) => b.status === "pending").length,
    totalAmountPaid,
    totalAmountDue,
    upcomingDepartures: myBookings.filter((b) => b.status === "confirmed").slice(0, 3).map((b) => ({
      ...b, totalPrice: Number(b.totalPrice), amountPaid: Number(b.amountPaid), package: null, user: null,
    })),
    recentPayments: myPayments.map((p) => ({ ...p, amount: Number(p.amount), booking: null })),
    unreadNotifications: myNotifications.length,
  });
});

router.get("/dashboard/admin-overview", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const callerProfile = await getProfileByClerkId(clerkUserId);
  if (!callerProfile) return res.status(404).json({ error: "Profile not found" });
  if (!["admin", "super_admin", "staff"].includes(callerProfile.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  const allBookings = await db.query.bookingsTable.findMany();
  const allPayments = await db.query.paymentsTable.findMany();
  const allPackages = await db.query.packagesTable.findMany();
  const allAgents = await db.query.agentsTable.findMany();
  const allTickets = await db.query.supportTicketsTable.findMany();

  const totalRevenue = allPayments.filter((p) => p.status === "verified").reduce((s, p) => s + Number(p.amount), 0);
  const pendingPayments = allPayments.filter((p) => p.status === "pending").length;

  const revenueByMonth: { month: string; revenue: number }[] = [];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = months[d.getMonth()];
    const revenue = allPayments
      .filter((p) => {
        const pd = new Date(p.createdAt);
        return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear() && p.status === "verified";
      })
      .reduce((s, p) => s + Number(p.amount), 0);
    revenueByMonth.push({ month: label, revenue });
  }

  // Expected revenue (confirmed/completed bookings by totalPrice)
  const expectedRevenue = allBookings.filter((b) => ["confirmed", "completed"].includes(b.status)).reduce((s, b) => s + Number(b.totalPrice), 0);

  // Real Hajj vs Umrah split
  const pkgTypeMap = Object.fromEntries(allPackages.map(p => [p.id, p.type]));
  const hajjBookings = allBookings.filter(b => pkgTypeMap[b.packageId] === "hajj").length;
  const umrahBookings = allBookings.filter(b => pkgTypeMap[b.packageId] === "umrah").length;

  // Package breakdown for donut
  const packageBreakdown = allPackages.map(pkg => ({
    name: pkg.name,
    type: pkg.type,
    bookings: allBookings.filter(b => b.packageId === pkg.id).length,
    revenue: allBookings.filter(b => b.packageId === pkg.id && ["confirmed","completed"].includes(b.status)).reduce((s, b) => s + Number(b.totalPrice), 0),
    capacity: pkg.capacity,
  })).filter(p => p.bookings > 0).sort((a, b) => b.bookings - a.bookings);

  return res.json({
    totalRevenue,
    expectedRevenue,
    totalPilgrims: (await db.query.profilesTable.findMany({ where: eq(profilesTable.role, "user") })).length,
    activePackages: allPackages.filter((p) => p.isActive).length,
    pendingPayments,
    totalAgents: allAgents.length,
    pendingAgentApplications: allAgents.filter((a) => a.status === "pending").length,
    openSupportTickets: allTickets.filter((t) => t.status === "open").length,
    revenueByMonth,
    totalBookings: allBookings.length,
    hajjVsUmrah: {
      hajj: hajjBookings,
      umrah: umrahBookings,
      hajjPercent: allBookings.length > 0 ? Math.round((hajjBookings / allBookings.length) * 100) : 0,
      umrahPercent: allBookings.length > 0 ? Math.round((umrahBookings / allBookings.length) * 100) : 0,
    },
    packageBreakdown,
    bookingsByStatus: {
      pending: allBookings.filter((b) => b.status === "pending").length,
      confirmed: allBookings.filter((b) => b.status === "confirmed").length,
      cancelled: allBookings.filter((b) => b.status === "cancelled").length,
      completed: allBookings.filter((b) => b.status === "completed").length,
    },
  });
});

router.get("/dashboard/agent-overview", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const agent = await db.query.agentsTable.findFirst({
    where: eq(agentsTable.userId, profile.id),
  });

  const [myBookings, agentCommissions, walletRecord] = await Promise.all([
    db.query.bookingsTable.findMany({
      where: agent ? eq(bookingsTable.agentId, agent.id) : eq(bookingsTable.userId, profile.id),
      orderBy: [desc(bookingsTable.createdAt)],
    }),
    agent
      ? db.query.commissionsTable.findMany({ where: eq(commissionsTable.agentId, agent.id) })
      : Promise.resolve([]),
    agent
      ? db.query.agentWalletsTable.findFirst({ where: eq(agentWalletsTable.agentId, agent.id) })
      : Promise.resolve(null),
  ]);

  const packageIds = [...new Set(myBookings.slice(0, 5).map(b => b.packageId).filter(Boolean))];
  const packages = packageIds.length
    ? await db.select().from(packagesTable).where(sql`id = ANY(ARRAY[${sql.join(packageIds.map(id => sql`${id}`), sql`, `)}]::text[])`)
    : [];
  const pkgMap = Object.fromEntries(packages.map(p => [p.id, p]));

  return res.json({
    walletBalance: Number(walletRecord?.balance || 0),
    totalCommissionsEarned: agentCommissions.reduce((s, c) => s + Number(c.amount), 0),
    pendingCommissions: agentCommissions.filter((c) => c.status === "pending").reduce((s, c) => s + Number(c.amount), 0),
    totalClients: myBookings.length,
    activeBookings: myBookings.filter((b) => b.status === "confirmed").length,
    recentBookings: myBookings.slice(0, 5).map((b) => ({
      ...b,
      totalPrice: Number(b.totalPrice),
      amountPaid: Number(b.amountPaid),
      package: b.packageId && pkgMap[b.packageId]
        ? { id: pkgMap[b.packageId].id, name: pkgMap[b.packageId].name, departureDate: pkgMap[b.packageId].departureDate }
        : null,
      user: null,
    })),
  });
});

router.get("/dashboard/activity", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const callerProfile = await getProfileByClerkId(clerkUserId);
  if (!callerProfile) return res.status(404).json({ error: "Profile not found" });
  if (!["admin", "super_admin", "staff"].includes(callerProfile.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { limit = "20" } = req.query as Record<string, string>;
  const recentBookings = await db.query.bookingsTable.findMany({ limit: 5, orderBy: bookingsTable.createdAt });
  const recentPayments = await db.query.paymentsTable.findMany({ limit: 5, orderBy: paymentsTable.createdAt });

  const activities = [
    ...recentBookings.map((b) => ({
      id: b.id,
      type: "booking_created" as const,
      description: `New booking created`,
      userId: b.userId,
      userName: null,
      createdAt: b.createdAt,
    })),
    ...recentPayments.map((p) => ({
      id: p.id,
      type: "payment_received" as const,
      description: `Payment of ₦${Number(p.amount).toLocaleString()} received`,
      userId: p.userId,
      userName: null,
      createdAt: p.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, parseInt(limit));

  return res.json({ activities });
});

// ── Pilgrim Visa ──────────────────────────────────────────────────────────────

router.get("/my-visa", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const rows = await db
    .select({
      visa: visaApplicationsTable,
      bookingRef: bookingsTable.reference,
      packageName: packagesTable.name,
      packageType: packagesTable.type,
    })
    .from(visaApplicationsTable)
    .innerJoin(bookingsTable, and(
      eq(visaApplicationsTable.bookingId, bookingsTable.id),
      eq(bookingsTable.userId, profile.id),
    ))
    .leftJoin(packagesTable, eq(bookingsTable.packageId, packagesTable.id))
    .orderBy(desc(visaApplicationsTable.createdAt));

  return res.json({
    visas: rows.map(r => ({ ...r.visa, bookingRef: r.bookingRef, packageName: r.packageName, packageType: r.packageType })),
  });
});

// ── Pilgrim Amendment Requests ────────────────────────────────────────────────

router.get("/dashboard/amendments", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const amendments = await db
    .select({
      amendment: bookingAmendmentRequestsTable,
      booking: {
        id: bookingsTable.id,
        reference: bookingsTable.reference,
        fullName: bookingsTable.fullName,
        status: bookingsTable.status,
      },
    })
    .from(bookingAmendmentRequestsTable)
    .leftJoin(bookingsTable, eq(bookingAmendmentRequestsTable.bookingId, bookingsTable.id))
    .where(eq(bookingAmendmentRequestsTable.userId, profile.id))
    .orderBy(desc(bookingAmendmentRequestsTable.createdAt));

  return res.json({
    amendments: amendments.map(r => ({ ...r.amendment, booking: r.booking })),
  });
});

router.post("/dashboard/amendments", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const { bookingId, requestedChanges } = req.body;
  if (!bookingId || !requestedChanges) {
    return res.status(400).json({ error: "bookingId and requestedChanges are required" });
  }

  const booking = await db.query.bookingsTable.findFirst({
    where: and(eq(bookingsTable.id, bookingId), eq(bookingsTable.userId, profile.id)),
  });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  const pending = await db.query.bookingAmendmentRequestsTable.findFirst({
    where: and(
      eq(bookingAmendmentRequestsTable.bookingId, bookingId),
      eq(bookingAmendmentRequestsTable.status, "pending"),
    ),
  });
  if (pending) {
    return res.status(409).json({ error: "You already have a pending amendment request for this booking" });
  }

  const [amendment] = await db.insert(bookingAmendmentRequestsTable).values({
    id: randomUUID(),
    bookingId,
    userId: profile.id,
    requestedChanges,
    status: "pending",
  }).returning();

  return res.status(201).json(amendment);
});

export default router;
