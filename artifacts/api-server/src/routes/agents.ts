import { Router } from "express";
import { db } from "@workspace/db";
import {
  agentsTable, commissionsTable, profilesTable, bookingsTable,
  visaApplicationsTable, packagesTable, agentWalletsTable,
  walletTransactionsTable, agentApplicationsTable, agentPackageDiscountsTable,
  paymentsTable,
} from "@workspace/db";
import { getAuth } from "@clerk/express";
import { eq, and, sql, desc } from "drizzle-orm";
import { randomUUID } from "crypto";


const router = Router();

async function getProfileByClerkId(clerkUserId: string) {
  return db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, clerkUserId) });
}

function toAgentResponse(a: typeof agentsTable.$inferSelect) {
  return {
    id: a.id,
    userId: a.userId,
    businessName: a.businessName,
    contactPerson: a.contactPerson,
    email: a.email,
    phone: a.phone,
    agentCode: a.agentCode,
    commissionRate: Number(a.commissionRate),
    commissionType: a.commissionType,
    walletBalance: 0,
    isVerified: a.isVerified,
    status: a.status,
    createdAt: a.createdAt,
    user: null,
  };
}

// ── Public: Submit agent application (no auth required) ──────────────────────

// SECURITY FIX #10: Rate limit public agent applications (max 3/min per IP)
const agentApplyRateMap = new Map<string, { count: number; resetAt: number }>();
function rateLimitApply(ip: string): boolean {
  const now = Date.now();
  const entry = agentApplyRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    agentApplyRateMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of agentApplyRateMap) {
    if (now > val.resetAt) agentApplyRateMap.delete(key);
  }
}, 5 * 60 * 1000).unref();

router.post("/agents/public-apply", async (req, res) => {
  const clientIp = req.ip ?? req.socket.remoteAddress ?? "unknown";
  if (!rateLimitApply(clientIp)) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  const { businessName, contactPerson, email, phone, bio, experienceYears, address, city, state } = req.body;
  if (!businessName || !contactPerson || !email || !phone) {
    return res.status(400).json({ error: "businessName, contactPerson, email and phone are required" });
  }
  const existing = await db.query.agentApplicationsTable.findFirst({
    where: eq(agentApplicationsTable.email, email),
  });
  if (existing) {
    return res.status(409).json({ error: "An application with this email already exists" });
  }
  const [application] = await db.insert(agentApplicationsTable).values({
    id: randomUUID(),
    businessName,
    contactPerson,
    email,
    phone,
    bio: bio || null,
    experienceYears: experienceYears || 0,
    address: address || null,
    city: city || null,
    state: state || null,
  }).returning();
  return res.status(201).json({
    id: application.id,
    status: application.status,
    message: "Application submitted successfully. We will review and contact you.",
  });
});



// ── Agent profile ─────────────────────────────────────────────────────────────

router.get("/agents/profile", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const agent = await db.query.agentsTable.findFirst({
    where: eq(agentsTable.userId, profile.id),
  });
  if (!agent) return res.status(404).json({ error: "Agent profile not found" });

  const wallet = await db.query.agentWalletsTable.findFirst({ where: eq(agentWalletsTable.agentId, agent.id) });
  return res.json({ ...toAgentResponse(agent), walletBalance: Number(wallet?.balance || 0) });
});

router.put("/agents/profile", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const { businessName, contactPerson, email, phone } = req.body;
  const [agent] = await db.update(agentsTable)
    .set({ businessName, contactPerson, email, phone, updatedAt: new Date() })
    .where(eq(agentsTable.userId, profile.id))
    .returning();
  if (!agent) return res.status(404).json({ error: "Agent profile not found" });
  return res.json(toAgentResponse(agent));
});

// ── Agent wallet ──────────────────────────────────────────────────────────────

router.get("/agents/wallet", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  const agent = await db.query.agentsTable.findFirst({ where: eq(agentsTable.userId, profile.id) });
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  const wallet = await db.query.agentWalletsTable.findFirst({ where: eq(agentWalletsTable.agentId, agent.id) });
  const transactions = await db.query.walletTransactionsTable.findMany({
    where: eq(walletTransactionsTable.agentId, agent.id),
    orderBy: [desc(walletTransactionsTable.createdAt)],
    limit: 50,
  });

  return res.json({
    balance: Number(wallet?.balance || 0),
    transactions: transactions.map(t => ({ ...t, amount: Number(t.amount) })),
  });
});

// ── Agent package discounts (what admin has set for this agent) ───────────────

router.get("/agents/package-discounts", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  const agent = await db.query.agentsTable.findFirst({ where: eq(agentsTable.userId, profile.id) });
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  const discounts = await db.query.agentPackageDiscountsTable.findMany({
    where: eq(agentPackageDiscountsTable.agentId, agent.id),
  });

  return res.json({
    discounts: discounts.map(d => ({ ...d, discountValue: Number(d.discountValue) })),
    commissionRate: Number(agent.commissionRate),
    commissionType: agent.commissionType,
  });
});

// ── Agents list (admin) ───────────────────────────────────────────────────────

router.get("/agents", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const callerProfile = await getProfileByClerkId(clerkUserId);
  if (!callerProfile) return res.status(404).json({ error: "Profile not found" });
  const isAdmin = ["admin", "super_admin", "staff"].includes(callerProfile.role);
  if (!isAdmin) return res.status(403).json({ error: "Admin access required" });

  const { status, limit = "20", offset = "0" } = req.query as Record<string, string>;
  const conditions = [];
  if (status) conditions.push(eq(agentsTable.status, status as any));

  const agents = await db.query.agentsTable.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  const wallets = await db.query.agentWalletsTable.findMany();
  const walletMap = Object.fromEntries(wallets.map(w => [w.agentId, Number(w.balance)]));

  const total = await db.select({ count: sql<number>`count(*)` }).from(agentsTable);
  return res.json({
    agents: agents.map(a => ({ ...toAgentResponse(a), walletBalance: walletMap[a.id] || 0 })),
    total: Number(total[0].count),
  });
});

// ── Apply as agent (auth required, for signed-in users) ──────────────────────

router.post("/agents/apply", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const { businessName, contactPerson, email, phone } = req.body;
  const [agent] = await db.insert(agentsTable).values({
    id: randomUUID(),
    userId: profile.id,
    businessName: businessName ?? "Pending",
    contactPerson,
    email,
    phone,
    status: "pending",
  }).returning();

  return res.status(201).json(toAgentResponse(agent));
});

// ── Approve/Reject agent (admin) ──────────────────────────────────────────────

router.put("/agents/:id/approve", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const callerProfile = await getProfileByClerkId(clerkUserId);
  if (!callerProfile) return res.status(404).json({ error: "Profile not found" });
  const isAdmin = ["admin", "super_admin", "staff"].includes(callerProfile.role);
  if (!isAdmin) return res.status(403).json({ error: "Admin access required" });

  const { status, commissionRate } = req.body;
  const updates: any = { status, updatedAt: new Date() };
  if (commissionRate != null) updates.commissionRate = String(commissionRate);

  const [agent] = await db.update(agentsTable)
    .set(updates)
    .where(eq(agentsTable.id, req.params.id))
    .returning();
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  // Ensure wallet exists whenever an agent becomes active
  if (status === "active") {
    const existing = await db.query.agentWalletsTable.findFirst({
      where: eq(agentWalletsTable.agentId, agent.id),
    });
    if (!existing) {
      await db.insert(agentWalletsTable).values({
        id: randomUUID(),
        agentId: agent.id,
        balance: "0",
      });
    }
  }

  return res.json(toAgentResponse(agent));
});

// ── Commissions ───────────────────────────────────────────────────────────────

router.get("/agents/commissions", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const agent = await db.query.agentsTable.findFirst({
    where: eq(agentsTable.userId, profile.id),
  });
  if (!agent) return res.status(404).json({ error: "Agent profile not found" });

  const { status, limit = "20" } = req.query as Record<string, string>;
  const conditions = [eq(commissionsTable.agentId, agent.id)];
  if (status) conditions.push(eq(commissionsTable.status, status as any));

  const commissions = await db.query.commissionsTable.findMany({
    where: and(...conditions),
    limit: parseInt(limit),
  });

  const totalEarned = commissions.reduce((sum, c) => sum + Number(c.amount), 0);
  const pendingAmount = commissions
    .filter((c) => c.status === "pending")
    .reduce((sum, c) => sum + Number(c.amount), 0);

  return res.json({
    commissions: commissions.map((c) => ({ ...c, amount: Number(c.amount), booking: null })),
    totalEarned,
    pendingAmount,
  });
});

// ── Agent — Client list (all bookings by this agent) ─────────────────────────

router.get("/agent/clients", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  const agent = await db.query.agentsTable.findFirst({ where: eq(agentsTable.userId, profile.id) });
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  const { search = "", packageId = "", status = "", limit = "200" } = req.query as Record<string, string>;
  const conditions: ReturnType<typeof eq>[] = [eq(bookingsTable.agentId, agent.id)];
  if (status && status !== "all") conditions.push(eq(bookingsTable.status, status as any));
  if (packageId && packageId !== "all") conditions.push(eq(bookingsTable.packageId, packageId));

  const bookings = await db.select().from(bookingsTable)
    .where(and(...conditions))
    .orderBy(desc(bookingsTable.createdAt))
    .limit(parseInt(limit));

  const bookingIds = bookings.map(b => b.id);
  const packageIds = [...new Set(bookings.map(b => b.packageId).filter(Boolean))] as string[];

  const [visas, packages] = await Promise.all([
    bookingIds.length
      ? db.select().from(visaApplicationsTable)
          .where(sql`${visaApplicationsTable.bookingId} = ANY(ARRAY[${sql.join(bookingIds.map(id => sql`${id}`), sql`, `)}]::text[])`)
      : Promise.resolve([]),
    packageIds.length
      ? db.select().from(packagesTable)
          .where(sql`${packagesTable.id} = ANY(ARRAY[${sql.join(packageIds.map(id => sql`${id}`), sql`, `)}]::text[])`)
      : Promise.resolve([]),
  ]);

  const visaMap = Object.fromEntries(visas.map(v => [v.bookingId, v]));
  const pkgMap = Object.fromEntries(packages.map(p => [p.id, p]));

  let result = bookings.map(b => ({
    id: b.id,
    reference: b.reference,
    status: b.status,
    fullName: b.fullName || [b.civility, b.firstName, b.lastName].filter(Boolean).join(" ") || "—",
    civility: b.civility,
    firstName: b.firstName,
    lastName: b.lastName,
    passportNumber: b.passportNumber,
    passportExpiry: b.passportExpiry,
    passportIssueDate: b.passportIssueDate,
    dateOfBirth: b.dateOfBirth,
    gender: b.gender,
    nationality: b.nationality,
    phone: b.phone,
    email: b.email,
    totalPrice: Number(b.totalPrice),
    amountPaid: Number(b.amountPaid),
    packageId: b.packageId,
    packageName: b.packageId ? pkgMap[b.packageId]?.name : undefined,
    packageType: b.packageId ? pkgMap[b.packageId]?.type : undefined,
    visa: visaMap[b.id]
      ? {
          id: visaMap[b.id].id,
          status: visaMap[b.id].status,
          visaNumber: visaMap[b.id].visaNumber,
          visaDocumentUrl: visaMap[b.id].visaDocumentUrl,
          ticketDocumentUrl: visaMap[b.id].ticketDocumentUrl,
        }
      : null,
    ticketDocumentUrl: b.ticketDocumentUrl,
    createdAt: b.createdAt,
  }));

  if (search.trim()) {
    const q = search.toLowerCase();
    result = result.filter(b =>
      (b.fullName || "").toLowerCase().includes(q) ||
      (b.passportNumber || "").toLowerCase().includes(q) ||
      (b.reference || "").toLowerCase().includes(q) ||
      (b.phone || "").toLowerCase().includes(q)
    );
  }

  return res.json({ clients: result, total: result.length });
});

// ── Agent — Register a client ─────────────────────────────────────────────────

router.post("/agent/register-client", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  const agent = await db.query.agentsTable.findFirst({ where: eq(agentsTable.userId, profile.id) });
  if (!agent) return res.status(403).json({ error: "Agent account required" });
  if (agent.status !== "active") return res.status(403).json({ error: "Agent account must be active to register clients" });

  const {
    packageId, civility, firstName, lastName,
    passportNumber, passportIssueDate, passportExpiry, passportIssuingAuthority,
    passportCopyUrl, profilePhotoUrl,
    dateOfBirth, placeOfBirth, gender, phone, email, nationality,
    ethnicGroup, maritalStatus, levelOfStudy, occupation,
    address, city, country, roomPreference, departureCity, specialRequests,
    partner, underCover, observation,
    emergencyContactName, emergencyContactPhone, emergencyContactRelationship,
    fathersName, mothersName, mahramName, mahramRelationship, mahramPassport,
    paymentMethod, amountPaid, paymentReference, paymentProofUrl,
  } = req.body;

  if (!packageId) return res.status(400).json({ error: "packageId is required" });
  if (!firstName && !lastName) return res.status(400).json({ error: "At least a first or last name is required" });

  const pkg = await db.query.packagesTable.findFirst({ where: eq(packagesTable.id, packageId) });
  if (!pkg) return res.status(404).json({ error: "Package not found" });
  if (pkg.status && pkg.status !== "active") return res.status(400).json({ error: "Package is not currently available" });

  const walkinUuid = randomUUID();
  const resolvedFullName = [civility, firstName, lastName].filter(Boolean).join(" ");

  // SECURITY: Price is always the canonical package price — never trust client-supplied price
  const price = Number(pkg.price);

  // SECURITY: Clamp amountPaid to [0, price]. An agent cannot claim more was paid than the
  // package costs, and cannot supply a negative value to inflate the balance later.
  const rawPaid = amountPaid != null ? Number(amountPaid) : 0;
  if (isNaN(rawPaid) || rawPaid < 0) {
    return res.status(400).json({ error: "amountPaid must be a non-negative number" });
  }
  const clampedPaid = Math.min(rawPaid, price);

  const nullify = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v) as string | undefined;
  const bookingReference = `RDH-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;

  // ── Wallet Payment Flow (atomic, race-condition-proof) ─────────────────
  if (paymentMethod === "wallet") {
    const walletPaid = Math.min(price, price); // always pay full price from wallet

    let booking: any;
    let finalWalletBalance = 0;

    try {
      await db.transaction(async (tx) => {
        // Row-level lock: prevents concurrent wallet debits from racing
        const lockResult = await tx.execute(
          sql`SELECT * FROM agent_wallets WHERE agent_id = ${agent.id} FOR UPDATE`
        );
        const walletRow = (lockResult as any).rows?.[0] ?? (Array.isArray(lockResult) ? lockResult[0] : null);
        if (!walletRow) throw new Error("Wallet not found. Please contact admin to set up your wallet.");
        const currentBalance = Number((walletRow as any).balance);
        if (currentBalance < walletPaid) {
          throw new Error(`Insufficient wallet balance. Available: ₦${currentBalance.toLocaleString()}, Required: ₦${walletPaid.toLocaleString()}`);
        }

        // Create walk-in user
        const [walkInUser] = await tx.insert(profilesTable).values({
          id: randomUUID(),
          clerkUserId: `walkin-${walkinUuid}`,
          email: (email as string | undefined) || `walkin-${walkinUuid}@raudah.internal`,
          fullName: resolvedFullName || "Walk-in Client",
          role: "user",
        }).returning();

        // Create booking
        [booking] = await tx.insert(bookingsTable).values({
          id: randomUUID(), reference: bookingReference, userId: walkInUser.id,
          packageId, agentId: agent.id, status: "confirmed",
          totalPrice: String(price), amountPaid: String(walletPaid), pilgrimCount: 1,
          fullName: resolvedFullName || undefined,
          civility: nullify(civility), firstName: nullify(firstName), lastName: nullify(lastName),
          passportNumber: nullify(passportNumber), passportIssueDate: nullify(passportIssueDate),
          passportExpiry: nullify(passportExpiry), passportIssuingAuthority: nullify(passportIssuingAuthority),
          passportCopyUrl: nullify(passportCopyUrl), profilePhotoUrl: nullify(profilePhotoUrl),
          dateOfBirth: nullify(dateOfBirth), placeOfBirth: nullify(placeOfBirth),
          gender: nullify(gender), phone: nullify(phone), email: nullify(email),
          nationality: nullify(nationality) || "Nigerian", ethnicGroup: nullify(ethnicGroup),
          maritalStatus: nullify(maritalStatus), levelOfStudy: nullify(levelOfStudy),
          occupation: nullify(occupation), address: nullify(address), city: nullify(city),
          country: nullify(country), roomPreference: nullify(roomPreference) || "Double",
          departureCity: nullify(departureCity), specialRequests: nullify(specialRequests),
          partner: nullify(partner), underCover: nullify(underCover), observation: nullify(observation),
          emergencyContactName: nullify(emergencyContactName),
          emergencyContactPhone: nullify(emergencyContactPhone),
          emergencyContactRelationship: nullify(emergencyContactRelationship),
          fathersName: nullify(fathersName), mothersName: nullify(mothersName),
          mahramName: nullify(mahramName), mahramRelationship: nullify(mahramRelationship),
          mahramPassport: nullify(mahramPassport),
        }).returning();

        // Create verified payment record
        await tx.insert(paymentsTable).values({
          id: randomUUID(), bookingId: booking.id, userId: walkInUser.id,
          amount: String(walletPaid), method: "wallet", status: "verified",
          reference: `WALLET-${bookingReference}`,
          notes: `Paid from agent wallet (${agent.businessName})`,
        });

        // Debit wallet atomically
        const [updatedWallet] = await tx.update(agentWalletsTable)
          .set({ balance: sql`balance - ${walletPaid}`, updatedAt: new Date() })
          .where(eq(agentWalletsTable.agentId, agent.id))
          .returning();
        finalWalletBalance = Number(updatedWallet?.balance || 0);

        // Record wallet transaction
        await tx.insert(walletTransactionsTable).values({
          id: randomUUID(), agentId: agent.id,
          amount: String(-walletPaid), type: "booking_payment",
          reference: `BOOKING-${bookingReference}`,
          description: `Booking for ${resolvedFullName || "Client"} — ${pkg.name}`,
        });
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || "Wallet payment failed" });
    }

    return res.status(201).json({
      id: booking.id, reference: booking.reference, status: booking.status,
      fullName: booking.fullName, packageName: pkg.name,
      walletDebited: true, newWalletBalance: finalWalletBalance,
    });
  }

  // ── Standard (non-wallet) Payment Flow ─────────────────────────────────
  const [walkInUser] = await db.insert(profilesTable).values({
    id: randomUUID(),
    clerkUserId: `walkin-${walkinUuid}`,
    email: (email as string | undefined) || `walkin-${walkinUuid}@raudah.internal`,
    fullName: resolvedFullName || "Walk-in Client",
    role: "user",
  }).returning();

  const [booking] = await db.insert(bookingsTable).values({
    id: randomUUID(),
    reference: bookingReference,
    userId: walkInUser.id,
    packageId,
    agentId: agent.id,
    status: "pending",
    totalPrice: String(price),
    amountPaid: String(clampedPaid),
    pilgrimCount: 1,
    fullName: resolvedFullName || undefined,
    civility: nullify(civility),
    firstName: nullify(firstName),
    lastName: nullify(lastName),
    passportNumber: nullify(passportNumber),
    passportIssueDate: nullify(passportIssueDate),
    passportExpiry: nullify(passportExpiry),
    passportIssuingAuthority: nullify(passportIssuingAuthority),
    passportCopyUrl: nullify(passportCopyUrl),
    profilePhotoUrl: nullify(profilePhotoUrl),
    dateOfBirth: nullify(dateOfBirth),
    placeOfBirth: nullify(placeOfBirth),
    gender: nullify(gender),
    phone: nullify(phone),
    email: nullify(email),
    nationality: nullify(nationality) || "Nigerian",
    ethnicGroup: nullify(ethnicGroup),
    maritalStatus: nullify(maritalStatus),
    levelOfStudy: nullify(levelOfStudy),
    occupation: nullify(occupation),
    address: nullify(address),
    city: nullify(city),
    country: nullify(country),
    roomPreference: nullify(roomPreference) || "Double",
    departureCity: nullify(departureCity),
    specialRequests: nullify(specialRequests),
    partner: nullify(partner),
    underCover: nullify(underCover),
    observation: nullify(observation),
    emergencyContactName: nullify(emergencyContactName),
    emergencyContactPhone: nullify(emergencyContactPhone),
    emergencyContactRelationship: nullify(emergencyContactRelationship),
    fathersName: nullify(fathersName),
    mothersName: nullify(mothersName),
    mahramName: nullify(mahramName),
    mahramRelationship: nullify(mahramRelationship),
    mahramPassport: nullify(mahramPassport),
  }).returning();

  if (clampedPaid > 0) {
    await db.insert(paymentsTable).values({
      id: randomUUID(),
      bookingId: booking.id,
      userId: walkInUser.id,
      amount: String(clampedPaid),
      method: paymentMethod || "cash",
      status: "pending",
      reference: paymentReference || `INIT-${booking.reference}`,
      proofUrl: paymentProofUrl || null,
      notes: "Initial payment during agent registration",
    });
  }

  return res.status(201).json({
    id: booking.id,
    reference: booking.reference,
    status: booking.status,
    fullName: booking.fullName,
    packageName: pkg.name,
  });
});

// ── Agent — Client Visas ──────────────────────────────────────────────────────

router.get("/agent/visas", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  const agent = await db.query.agentsTable.findFirst({ where: eq(agentsTable.userId, profile.id) });
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  const rows = await db
    .select({
      visa: visaApplicationsTable,
      bookingRef: bookingsTable.reference,
      fullName: bookingsTable.fullName,
      packageName: packagesTable.name,
    })
    .from(visaApplicationsTable)
    .innerJoin(bookingsTable, and(
      eq(visaApplicationsTable.bookingId, bookingsTable.id),
      eq(bookingsTable.agentId, agent.id),
    ))
    .leftJoin(packagesTable, eq(bookingsTable.packageId, packagesTable.id))
    .orderBy(desc(visaApplicationsTable.createdAt));

  return res.json({
    visas: rows.map(r => ({ ...r.visa, bookingRef: r.bookingRef, fullName: r.fullName, packageName: r.packageName })),
  });
});

export default router;
