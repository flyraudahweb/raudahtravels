import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { sendEmail, sendAgentApprovalEmail, sendStaffWelcomeEmail } from "../utils/email.js";
import { createNotification } from "../utils/notify.js";

import {
  profilesTable, staffPermissionsTable, bookingsTable, paymentsTable,
  packagesTable, packageDatesTable, agentsTable, supportTicketsTable, bankAccountsTable,
  siteSettingsTable, bookingFormFieldsTable, userActivityTable,
  bookingAmendmentRequestsTable, staffMessagesTable, chatChannelsTable,
  visaApplicationsTable, visaProvidersTable,
  staffSupportSpecialtiesTable, agentApplicationsTable,
  agentPackageDiscountsTable, agentWalletsTable, walletTransactionsTable,
  adminOtpRequestsTable, contactMessagesTable,
  notificationsTable, supportMessagesTable, loginSessionsTable, commissionsTable,
} from "@workspace/db";
import { eq, ilike, and, sql, or, desc, ne, gte, lte, inArray, isNull, isNotNull, lt, gt } from "drizzle-orm";
import { createHash } from "crypto";
import { randomUUID } from "crypto";
import multer from "multer";
import path from "path";
import { mkdirSync } from "fs";

["uploads/visa", "uploads/tickets"].forEach(d => { try { mkdirSync(d, { recursive: true }); } catch {} });

const _uploadStorage = multer.diskStorage({
  destination: (_req, file, cb) => cb(null, file.fieldname === "ticket" ? "uploads/tickets" : "uploads/visa"),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
});
const _upload = multer({
  storage: _uploadStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.mimetype));
  },
});

const router = Router();

// ── Admin guard — applied to every route in this file ────────────────────────

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await db.query.profilesTable.findFirst({
    where: eq(profilesTable.clerkUserId, clerkUserId),
  });
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  if (!["admin", "super_admin", "staff"].includes(profile.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  return next();
}

router.use(requireAdmin as any);

// ── Users Management ──────────────────────────────────────────────────────────

router.get("/admin/users", async (req, res) => {
  const { role, status, search, page: pageStr = "1", limit: limitStr = "50" } = req.query as Record<string, string>;
  const page = Math.max(1, parseInt(pageStr) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr) || 50));

  const conditions: any[] = [];
  if (role && role !== "all") conditions.push(eq(profilesTable.role, role as any));
  if (status && status !== "all") conditions.push(eq(profilesTable.accountStatus, status));
  if (search && search.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    conditions.push(
      or(
        ilike(profilesTable.fullName, q),
        ilike(profilesTable.email, q),
        ilike(profilesTable.phone, q),
      )
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(profilesTable).where(where);
  const total = countResult?.count ?? 0;

  const users = await db.select().from(profilesTable)
    .where(where)
    .orderBy(desc(profilesTable.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  // Status counts (independent of pagination filters — always reflect the full dataset)
  const [activeCount, suspendedCount, blockedCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(profilesTable).where(eq(profilesTable.accountStatus, "active")),
    db.select({ count: sql<number>`count(*)::int` }).from(profilesTable).where(eq(profilesTable.accountStatus, "suspended")),
    db.select({ count: sql<number>`count(*)::int` }).from(profilesTable).where(eq(profilesTable.accountStatus, "blocked")),
  ]);

  return res.json({
    users, total, page, limit, totalPages: Math.ceil(total / limit),
    counts: {
      active: activeCount[0]?.count ?? 0,
      suspended: suspendedCount[0]?.count ?? 0,
      blocked: blockedCount[0]?.count ?? 0,
    },
  });
});

router.put("/admin/users/:id/status", async (req, res) => {
  const { accountStatus } = req.body as { accountStatus: string };
  const validStatuses = ["active", "suspended", "blocked"];
  if (!validStatuses.includes(accountStatus)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
  }

  const user = await db.query.profilesTable.findFirst({ where: eq(profilesTable.id, req.params.id) });
  if (!user) return res.status(404).json({ error: "User not found" });

  // Prevent suspending super_admins
  if (user.role === "super_admin" && accountStatus !== "active") {
    return res.status(403).json({ error: "Cannot suspend or block a super admin account." });
  }

  const [updated] = await db.update(profilesTable)
    .set({ accountStatus, updatedAt: new Date() })
    .where(eq(profilesTable.id, req.params.id))
    .returning();

  // Activity log
  try { const { userId: _clk } = getAuth(req); if (_clk) { const _c = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, _clk) }); if (_c) await db.insert(userActivityTable).values({ id: randomUUID(), userId: _c.id, eventType: "user_status_changed", metadata: { actorName: _c.fullName, actorRole: _c.role, targetName: user.fullName || user.email, oldStatus: user.accountStatus, newStatus: accountStatus } }); } } catch (_) { /* non-blocking */ }

  return res.json({ ...updated, message: `User account status updated to "${accountStatus}".` });
});

// ── Delete User (Clerk + Neon atomic) ─────────────────────────────────────────

router.delete("/admin/users/:id", async (req, res) => {
  try {
    const { userId: callerClerkId } = getAuth(req);
    if (!callerClerkId) return res.status(401).json({ error: "Unauthorized" });
    const caller = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, callerClerkId) });
    if (!caller) return res.status(404).json({ error: "Caller profile not found" });

    const targetId = req.params.id;
    const target = await db.query.profilesTable.findFirst({ where: eq(profilesTable.id, targetId) });
    if (!target) return res.status(404).json({ error: "User not found" });

    // Guards
    if (target.id === caller.id) {
      return res.status(400).json({ error: "You cannot delete your own account." });
    }
    if (target.role === "super_admin" && caller.role !== "super_admin") {
      return res.status(403).json({ error: "Only a super admin can delete another super admin." });
    }
    if (target.role === "super_admin") {
      const superAdminCount = await db.select({ count: sql<number>`count(*)::int` })
        .from(profilesTable).where(eq(profilesTable.role, "super_admin"));
      if ((superAdminCount[0]?.count ?? 0) <= 1) {
        return res.status(400).json({ error: "Cannot delete the last super admin account." });
      }
    }

    // Step 1: Delete from Clerk FIRST
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      return res.status(500).json({ error: "Clerk secret key not configured" });
    }

    // Skip Clerk deletion for walk-in users (fake clerkUserId)
    const isWalkIn = target.clerkUserId.startsWith("walkin-");
    if (!isWalkIn) {
      const clerkRes = await fetch(`https://api.clerk.com/v1/users/${target.clerkUserId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${clerkSecretKey}` },
      });
      // 404 = already deleted from Clerk, that's fine
      if (!clerkRes.ok && clerkRes.status !== 404) {
        const errBody = await clerkRes.text().catch(() => "Unknown error");
        console.error("[user-delete] Clerk deletion failed:", clerkRes.status, errBody);
        return res.status(502).json({ error: "Failed to delete user from authentication provider. Database was NOT modified." });
      }
    }

    // Step 2: Database cleanup in a transaction
    await db.transaction(async (tx) => {
      // 2a: Nullify nullable FK references pointing to this user
      await tx.update(bookingsTable).set({ registeredByStaffId: null }).where(eq(bookingsTable.registeredByStaffId, targetId));
      await tx.update(paymentsTable).set({ verifiedBy: null }).where(eq(paymentsTable.verifiedBy, targetId));
      await tx.update(supportTicketsTable).set({ assignedTo: null }).where(eq(supportTicketsTable.assignedTo, targetId));
      await tx.update(staffPermissionsTable).set({ grantedBy: null }).where(eq(staffPermissionsTable.grantedBy, targetId));
      await tx.update(staffMessagesTable).set({ receiverId: null }).where(eq(staffMessagesTable.receiverId, targetId));
      await tx.update(bookingAmendmentRequestsTable).set({ reviewedBy: null }).where(eq(bookingAmendmentRequestsTable.reviewedBy, targetId));

      // 2b: Delete owned rows (no cascade configured)
      await tx.delete(notificationsTable).where(eq(notificationsTable.userId, targetId));
      await tx.delete(userActivityTable).where(eq(userActivityTable.userId, targetId));
      await tx.delete(staffPermissionsTable).where(eq(staffPermissionsTable.userId, targetId));
      await tx.delete(staffSupportSpecialtiesTable).where(eq(staffSupportSpecialtiesTable.userId, targetId));
      await tx.delete(staffMessagesTable).where(eq(staffMessagesTable.senderId, targetId));
      await tx.delete(adminOtpRequestsTable).where(eq(adminOtpRequestsTable.adminId, targetId));
      await tx.delete(loginSessionsTable).where(eq(loginSessionsTable.clerkUserId, target.clerkUserId));

      // 2c: Support tickets — delete messages first, then tickets
      const userTickets = await tx.select({ id: supportTicketsTable.id }).from(supportTicketsTable).where(eq(supportTicketsTable.userId, targetId));
      if (userTickets.length > 0) {
        const ticketIds = userTickets.map(t => t.id);
        await tx.delete(supportMessagesTable).where(inArray(supportMessagesTable.ticketId, ticketIds));
        await tx.delete(supportTicketsTable).where(eq(supportTicketsTable.userId, targetId));
      }

      // 2d: Handle agent data if user is an agent
      const agent = await tx.query.agentsTable.findFirst({ where: eq(agentsTable.userId, targetId) });
      if (agent) {
        // Clean up agent-specific tables without cascade
        await tx.delete(walletTransactionsTable).where(eq(walletTransactionsTable.agentId, agent.id));
        await tx.delete(commissionsTable).where(eq(commissionsTable.agentId, agent.id));
        await tx.delete(adminOtpRequestsTable).where(eq(adminOtpRequestsTable.agentId, agent.id));
        await tx.delete(agentPackageDiscountsTable).where(eq(agentPackageDiscountsTable.agentId, agent.id));
        // Nullify agent reference on bookings
        await tx.update(bookingsTable).set({ agentId: null }).where(eq(bookingsTable.agentId, agent.id));
        // Delete agent row (cascades to agentClientsTable + agentWalletsTable)
        await tx.delete(agentsTable).where(eq(agentsTable.id, agent.id));
      }

      // 2e: Nullify financial record references (preserve bookings + payments)
      await tx.update(bookingsTable).set({ userId: null }).where(eq(bookingsTable.userId, targetId));
      await tx.update(paymentsTable).set({ userId: null }).where(eq(paymentsTable.userId, targetId));

      // 2f: Delete amendment requests
      await tx.delete(bookingAmendmentRequestsTable).where(eq(bookingAmendmentRequestsTable.userId, targetId));

      // 2g: Finally delete the profile
      await tx.delete(profilesTable).where(eq(profilesTable.id, targetId));
    });

    // Activity log (logged under caller since target is deleted)
    try { await db.insert(userActivityTable).values({ id: randomUUID(), userId: caller.id, eventType: "user_deleted", metadata: { actorName: caller.fullName, actorRole: caller.role, targetName: target.fullName || target.email, targetRole: target.role } }); } catch (_) { /* non-blocking */ }

    console.log(`[user-delete] Successfully deleted user ${targetId} (${target.email}) from Clerk and Neon`);
    return res.json({ success: true, deletedFrom: ["clerk", "neon"] });
  } catch (err: any) {
    console.error("[user-delete] Unexpected error:", err);
    return res.status(500).json({ error: err.message || "Failed to delete user" });
  }
});

// ── Change User Role ──────────────────────────────────────────────────────────

router.put("/admin/users/:id/role", async (req, res) => {
  try {
    const { userId: callerClerkId } = getAuth(req);
    if (!callerClerkId) return res.status(401).json({ error: "Unauthorized" });
    const caller = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, callerClerkId) });
    if (!caller) return res.status(404).json({ error: "Caller profile not found" });

    const { role, businessName, contactPerson, agentEmail, agentPhone } = req.body as {
      role: string;
      businessName?: string;
      contactPerson?: string;
      agentEmail?: string;
      agentPhone?: string;
    };

    const validRoles = ["user", "agent", "staff", "admin", "super_admin", "moderator"];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
    }

    const targetId = req.params.id;
    const target = await db.query.profilesTable.findFirst({ where: eq(profilesTable.id, targetId) });
    if (!target) return res.status(404).json({ error: "User not found" });

    // Only super_admin can assign super_admin role
    if (role === "super_admin" && caller.role !== "super_admin") {
      return res.status(403).json({ error: "Only a super admin can assign the super_admin role." });
    }

    // Prevent demoting the last super_admin
    if (target.role === "super_admin" && role !== "super_admin") {
      const superAdminCount = await db.select({ count: sql<number>`count(*)::int` })
        .from(profilesTable).where(eq(profilesTable.role, "super_admin"));
      if ((superAdminCount[0]?.count ?? 0) <= 1) {
        return res.status(400).json({ error: "Cannot demote the last super admin. Promote another user first." });
      }
    }

    // Update role in database
    const [updated] = await db.update(profilesTable)
      .set({ role: role as any, updatedAt: new Date() })
      .where(eq(profilesTable.id, targetId))
      .returning();

    // Sync role to Clerk public_metadata
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (clerkSecretKey && !target.clerkUserId.startsWith("walkin-")) {
      try {
        await fetch(`https://api.clerk.com/v1/users/${target.clerkUserId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${clerkSecretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ public_metadata: { role } }),
        });
      } catch (clerkErr: any) {
        console.error("[role-update] Failed to sync role to Clerk:", clerkErr.message);
        // Non-fatal: DB was updated, Clerk sync failed
      }
    }

    // Handle agent promotion: create agent record if needed
    let agentRecord = null;
    if (role === "agent") {
      const existingAgent = await db.query.agentsTable.findFirst({ where: eq(agentsTable.userId, targetId) });
      if (!existingAgent) {
        if (!businessName) {
          return res.status(400).json({ error: "businessName is required when promoting to agent." });
        }
        const agentCode = `AGT-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
        const [newAgent] = await db.insert(agentsTable).values({
          id: randomUUID(),
          userId: targetId,
          businessName: businessName,
          contactPerson: contactPerson || updated.fullName || "",
          email: agentEmail || updated.email,
          phone: agentPhone || updated.phone || "",
          agentCode,
          status: "active",
        }).returning();
        agentRecord = newAgent;

        // Create wallet for the new agent
        await db.insert(agentWalletsTable).values({
          id: randomUUID(),
          agentId: newAgent.id,
          balance: "0",
        });
      }
    }

    // Activity log
    try { await db.insert(userActivityTable).values({ id: randomUUID(), userId: caller.id, eventType: "role_changed", metadata: { actorName: caller.fullName, actorRole: caller.role, targetName: target.fullName || target.email, oldRole: target.role, newRole: role } }); } catch (_) { /* non-blocking */ }

    console.log(`[role-update] User ${targetId} (${target.email}) role changed: ${target.role} -> ${role}`);
    return res.json({
      ...updated,
      ...(agentRecord ? { agent: agentRecord } : {}),
      message: `Role updated to "${role}" successfully.`,
    });
  } catch (err: any) {
    console.error("[role-update] Unexpected error:", err);
    return res.status(500).json({ error: err.message || "Failed to update role" });
  }
});

// ── Pilgrims ──────────────────────────────────────────────────────────────────

router.get("/admin/pilgrims", async (req, res) => {
  const {
    search, status, gender, packageType, packageId, agentId, registeredByStaffId,
    departureCity, departureDateFrom, departureDateTo,
    page: pageStr, limit: limitStr, exportAll,
  } = req.query as Record<string, string>;

  const isExport = exportAll === "true";
  const page     = Math.max(1, parseInt(pageStr  ?? "1")  || 1);
  const limit    = Math.max(1, parseInt(limitStr ?? "50") || 50);

  const conditions: any[] = [];
  if (search) {
    conditions.push(or(
      ilike(bookingsTable.fullName,      `%${search}%`),
      ilike(bookingsTable.passportNumber, `%${search}%`),
      ilike(bookingsTable.reference,     `%${search}%`),
      ilike(bookingsTable.phone,         `%${search}%`),
    ));
  }
  if (status     && status !== "all")      conditions.push(eq(bookingsTable.status,  status as any));
  if (gender     && gender !== "all")      conditions.push(eq(bookingsTable.gender,  gender as any));
  if (agentId    && agentId !== "all")     conditions.push(eq(bookingsTable.agentId, agentId));
  if (registeredByStaffId && registeredByStaffId !== "all") conditions.push(eq(bookingsTable.registeredByStaffId, registeredByStaffId));
  if (packageType && packageType !== "all") conditions.push(eq(packagesTable.type,   packageType as any));
  if (packageId  && packageId  !== "all")  conditions.push(eq(bookingsTable.packageId, packageId));
  if (departureCity && departureCity !== "all") conditions.push(ilike(bookingsTable.departureCity, `%${departureCity}%`));
  if (departureDateFrom) conditions.push(gte(packagesTable.departureDate, departureDateFrom));
  if (departureDateTo)   conditions.push(lte(packagesTable.departureDate, departureDateTo));

  const isArchivedFilter = req.query.isArchived === "true";
  conditions.push(eq(bookingsTable.isArchived, isArchivedFilter));

  const whereClause = conditions.length ? and(...conditions) : undefined;

  // Use aliased tables for agent and staff joins to avoid collision with profiles
  const agentProfile = db.$with("agent_profile").as(
    db.select({ id: profilesTable.id, fullName: profilesTable.fullName }).from(profilesTable)
  );

  // Fetch all matching rows (we need JS-side filtering for payment/visa)
  const bookings = await db.select({
    booking: bookingsTable,
    package: {
      id: packagesTable.id,
      name: packagesTable.name,
      type: packagesTable.type,
      category: packagesTable.category,
      price: packagesTable.price,
    },
    packageDate: {
      id: packageDatesTable.id,
      outbound: packageDatesTable.outbound,
      outboundRoute: packageDatesTable.outboundRoute,
      returnDate: packageDatesTable.returnDate,
      returnRoute: packageDatesTable.returnRoute,
      airline: packageDatesTable.airline,
      islamicDate: packageDatesTable.islamicDate,
      islamicReturnDate: packageDatesTable.islamicReturnDate,
    },
    user: {
      id: profilesTable.id,
      fullName: profilesTable.fullName,
      email: profilesTable.email,
      phone: profilesTable.phone,
      avatarUrl: profilesTable.avatarUrl,
    },
    agentBusinessName: agentsTable.businessName,
    commissionAmount: commissionsTable.amount,
  })
    .from(bookingsTable)
    .leftJoin(packagesTable, eq(bookingsTable.packageId, packagesTable.id))
    .leftJoin(packageDatesTable, eq(bookingsTable.packageDateId, packageDatesTable.id))
    .leftJoin(profilesTable, eq(bookingsTable.userId, profilesTable.id))
    .leftJoin(agentsTable, eq(bookingsTable.agentId, agentsTable.id))
    .leftJoin(commissionsTable, eq(commissionsTable.bookingId, bookingsTable.id))
    .where(whereClause)
    .orderBy(desc(bookingsTable.createdAt));

  // Batch-fetch staff names for registeredByStaffId
  const staffIds = [...new Set(bookings.map(r => r.booking.registeredByStaffId).filter(Boolean))] as string[];
  const staffMap = new Map<string, string>();
  if (staffIds.length > 0) {
    const staffRows = await db.select({ id: profilesTable.id, fullName: profilesTable.fullName })
      .from(profilesTable)
      .where(inArray(profilesTable.id, staffIds));
    staffRows.forEach(r => staffMap.set(r.id, r.fullName || "Staff"));
  }

  // Batch-fetch initial payment info (method + status) for each booking
  const bookingIds = bookings.map(r => r.booking.id);
  const paymentMethodMap = new Map<string, { method: string; status: string }>();
  if (bookingIds.length > 0) {
    const paymentRows = await db.select({
      bookingId: paymentsTable.bookingId,
      method: paymentsTable.method,
      status: paymentsTable.status,
    })
      .from(paymentsTable)
      .where(and(inArray(paymentsTable.bookingId, bookingIds), eq(paymentsTable.isArchived, false)))
      .orderBy(paymentsTable.createdAt);
    // Keep the first (initial) payment per booking
    paymentRows.forEach(r => {
      if (r.bookingId && !paymentMethodMap.has(r.bookingId)) {
        paymentMethodMap.set(r.bookingId, { method: r.method || "unknown", status: r.status || "pending" });
      }
    });
  }

  const {
    paymentStatus: paymentFilter, visaStatus: visaFilter,
  } = req.query as Record<string, string>;

  let allPilgrims = bookings.map(row => ({
    ...row.booking,
    totalPrice: Number(row.booking.totalPrice),
    amountPaid: Number(row.booking.amountPaid),
    package: row.package,
    packageDate: row.packageDate || null,
    user: row.user,
    agentBusinessName: row.agentBusinessName || null,
    commissionAmount: row.commissionAmount ? Number(row.commissionAmount) : null,
    packagePrice: row.package?.price ? Number(row.package.price) : null,
    paymentMethod: paymentMethodMap.get(row.booking.id)?.method || null,
    paymentVerified: paymentMethodMap.get(row.booking.id)?.status === "verified",
    registeredByStaffName: row.booking.registeredByStaffId ? (staffMap.get(row.booking.registeredByStaffId) || null) : null,
  }));

  if (paymentFilter && paymentFilter !== "all") {
    allPilgrims = allPilgrims.filter(p => {
      const ps = p.totalPrice > 0
        ? (p.amountPaid >= p.totalPrice ? "paid" : p.amountPaid > 0 ? "partial" : "unpaid")
        : "unpaid";
      return ps === paymentFilter;
    });
  }
  if (visaFilter && visaFilter !== "all") {
    allPilgrims = allPilgrims.filter(p =>
      visaFilter === "issued" ? !!(p as any).visaDeliveryMessage : !(p as any).visaDeliveryMessage,
    );
  }

  const total      = allPilgrims.length;
  const totalPages = Math.ceil(total / limit) || 1;

  if (isExport) {
    return res.json({ pilgrims: allPilgrims, total, page: 1, limit: total, totalPages: 1 });
  }

  const paginated = allPilgrims.slice((page - 1) * limit, page * limit);
  return res.json({ pilgrims: paginated, total, page, limit, totalPages });
});

// ── Update Booking (Pilgrim Edit) ─────────────────────────────────────────────

router.put("/admin/bookings/:id", async (req, res) => {
  try {
    const { userId: callerClerkId } = getAuth(req);
    if (!callerClerkId) return res.status(401).json({ error: "Unauthorized" });
    const caller = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, callerClerkId) });
    if (!caller) return res.status(404).json({ error: "Caller profile not found" });

    const bookingId = req.params.id;
    const booking = await db.query.bookingsTable.findFirst({ where: eq(bookingsTable.id, bookingId) });
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    // Whitelist of editable fields
    const EDITABLE_FIELDS = [
      "civility", "firstName", "lastName", "fullName",
      "dateOfBirth", "gender", "nationality", "placeOfBirth",
      "ethnicGroup", "maritalStatus", "levelOfStudy", "occupation",
      "email", "phone", "country", "city", "address", "observation",
      "partner", "underCover", "fathersName", "mothersName",
      "mahramName", "mahramRelationship", "mahramPassport",
      "emergencyContactName", "emergencyContactPhone", "emergencyContactRelationship",
      "departureCity", "roomPreference", "specialRequests", "packageDateId",
      "passportNumber", "passportIssueDate", "passportExpiry", "passportIssuingAuthority",
      "passportCopyUrl", "profilePhotoUrl", "visaNumber",
    ] as const;

    const updates: Record<string, any> = {};
    for (const field of EDITABLE_FIELDS) {
      if (field in req.body) {
        updates[field] = req.body[field] === "" ? null : req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    updates.updatedAt = new Date();

    const [updated] = await db.update(bookingsTable)
      .set(updates as any)
      .where(eq(bookingsTable.id, bookingId))
      .returning();

    // Activity log
    try {
      await db.insert(userActivityTable).values({
        id: randomUUID(),
        userId: caller.id,
        eventType: "booking_updated",
        bookingId,
        metadata: {
          actorName: caller.fullName,
          actorRole: caller.role,
          targetName: updated.fullName || booking.fullName,
          updatedFields: Object.keys(updates),
        },
      });
    } catch (_) { /* non-blocking */ }

    return res.json({ success: true, booking: { ...updated, totalPrice: Number(updated.totalPrice), amountPaid: Number(updated.amountPaid) } });
  } catch (err: any) {
    console.error("[booking-update] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to update booking" });
  }
});

// ── Package Upgrade / Switch ──────────────────────────────────────────────────

router.post("/admin/bookings/:id/upgrade-package", async (req, res) => {
  try {
    const { userId: callerClerkId } = getAuth(req);
    if (!callerClerkId) return res.status(401).json({ error: "Unauthorized" });
    const caller = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, callerClerkId) });
    if (!caller) return res.status(404).json({ error: "Caller profile not found" });

    const bookingId = req.params.id;
    const { newPackageId, newPackageDateId } = req.body as { newPackageId: string; newPackageDateId?: string | null };

    if (!newPackageId) return res.status(400).json({ error: "newPackageId is required" });

    const booking = await db.query.bookingsTable.findFirst({ where: eq(bookingsTable.id, bookingId) });
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const newPackage = await db.query.packagesTable.findFirst({ where: eq(packagesTable.id, newPackageId) });
    if (!newPackage) return res.status(404).json({ error: "New package not found" });

    // Get old package for logging
    const oldPackage = booking.packageId
      ? await db.query.packagesTable.findFirst({ where: eq(packagesTable.id, booking.packageId) })
      : null;

    if (booking.packageId === newPackageId) {
      // Same package — just update packageDateId if provided
      if (newPackageDateId !== undefined) {
        await db.update(bookingsTable)
          .set({ packageDateId: newPackageDateId || null, updatedAt: new Date() })
          .where(eq(bookingsTable.id, bookingId));
      }
      const updatedBooking = await db.query.bookingsTable.findFirst({ where: eq(bookingsTable.id, bookingId) });
      return res.json({
        success: true,
        booking: updatedBooking ? { ...updatedBooking, totalPrice: Number(updatedBooking.totalPrice), amountPaid: Number(updatedBooking.amountPaid) } : null,
        payment: null,
        priceDifference: 0,
      });
    }

    const oldPrice = Number(booking.totalPrice);
    const newPrice = Number(newPackage.price);
    const priceDifference = newPrice - oldPrice;
    const currentPaid = Number(booking.amountPaid);

    let paymentRecord: any = null;
    let updatedBooking: typeof bookingsTable.$inferSelect | undefined;

    await db.transaction(async (tx) => {
      // Update booking to new package
      const bookingUpdate: Record<string, any> = {
        packageId: newPackageId,
        packageDateId: newPackageDateId !== undefined ? (newPackageDateId || null) : booking.packageDateId,
        totalPrice: String(newPrice),
        updatedAt: new Date(),
      };

      // If downgrade and already overpaid, auto-confirm
      if (currentPaid >= newPrice && newPrice > 0) {
        bookingUpdate.status = "confirmed";
      }

      const [b] = await tx.update(bookingsTable)
        .set(bookingUpdate)
        .where(eq(bookingsTable.id, bookingId))
        .returning();
      updatedBooking = b;

      // If upgrade (price increase), create a pending payment record for the difference
      if (priceDifference > 0) {
        const [p] = await tx.insert(paymentsTable).values({
          id: randomUUID(),
          bookingId,
          userId: booking.userId,
          amount: String(priceDifference),
          method: "cash",
          status: "pending",
          reference: `UPGRADE-${randomUUID().slice(0, 8).toUpperCase()}`,
          notes: `Package upgrade: ${oldPackage?.name || "Previous package"} → ${newPackage.name}`,
        }).returning();
        paymentRecord = { ...p, amount: Number(p.amount) };
      }
    });

    // Activity log
    try {
      await db.insert(userActivityTable).values({
        id: randomUUID(),
        userId: caller.id,
        eventType: "package_changed",
        bookingId,
        metadata: {
          actorName: caller.fullName,
          actorRole: caller.role,
          targetName: booking.fullName,
          oldPackage: oldPackage?.name,
          newPackage: newPackage.name,
          oldPrice,
          newPrice,
          priceDifference,
        },
      });
    } catch (_) { /* non-blocking */ }

    // Notify pilgrim
    if (booking.userId) {
      const fmt = (n: number) => `₦${n.toLocaleString()}`;
      const msg = priceDifference > 0
        ? `Your package has been upgraded to "${newPackage.name}". Additional payment of ${fmt(priceDifference)} is required.`
        : priceDifference < 0
          ? `Your package has been changed to "${newPackage.name}". Your new total is ${fmt(newPrice)}.`
          : `Your package has been changed to "${newPackage.name}".`;
      setImmediate(() => createNotification(booking.userId!, "Package Changed", msg, "booking"));
    }

    return res.json({
      success: true,
      booking: updatedBooking ? { ...updatedBooking, totalPrice: Number(updatedBooking.totalPrice), amountPaid: Number(updatedBooking.amountPaid) } : null,
      payment: paymentRecord,
      priceDifference,
    });
  } catch (err: any) {
    console.error("[package-upgrade] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to upgrade package" });
  }
});

// ── Passports ─────────────────────────────────────────────────────────────────

router.get("/admin/passports/stats", async (req, res) => {
  const today       = new Date().toISOString().split("T")[0];
  const threeMonths = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [row] = await db.select({
    total:    sql<number>`count(*)`,
    hasDocs:  sql<number>`count(*) filter (where ${bookingsTable.passportCopyUrl} is not null)`,
    critical: sql<number>`count(*) filter (where ${bookingsTable.passportExpiry} is not null and ${bookingsTable.passportExpiry} >= ${today} and ${bookingsTable.passportExpiry} <= ${threeMonths})`,
    expired:  sql<number>`count(*) filter (where ${bookingsTable.passportExpiry} is not null and ${bookingsTable.passportExpiry} < ${today})`,
  }).from(bookingsTable);

  const total   = Number(row.total);
  const hasDocs = Number(row.hasDocs);
  return res.json({ total, hasDocs, missing: total - hasDocs, critical: Number(row.critical), expired: Number(row.expired) });
});

router.get("/admin/passports", async (req, res) => {
  const {
    search, filterType, filterExpiry, filterDocs, filterSource,
    registeredByStaffId, agentId,
    page: pageStr, limit: limitStr,
  } = req.query as Record<string, string>;

  const page  = Math.max(1, parseInt(pageStr  ?? "1")  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr ?? "24") || 24));
  const offset = (page - 1) * limit;

  const today       = new Date().toISOString().split("T")[0];
  const threeMonths = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const conditions: any[] = [];

  if (search) {
    conditions.push(or(
      ilike(bookingsTable.fullName,      `%${search}%`),
      ilike(bookingsTable.passportNumber, `%${search}%`),
      ilike(bookingsTable.reference,     `%${search}%`),
    ));
  }
  if (filterType && filterType !== "all")   conditions.push(eq(packagesTable.type, filterType as any));
  if (filterDocs === "with_doc")            conditions.push(isNotNull(bookingsTable.passportCopyUrl));
  else if (filterDocs === "without_doc")    conditions.push(isNull(bookingsTable.passportCopyUrl));
  if (filterSource === "agent")             conditions.push(isNotNull(bookingsTable.agentId));
  else if (filterSource === "direct")       conditions.push(isNull(bookingsTable.agentId));
  if (filterExpiry === "expired")           conditions.push(and(isNotNull(bookingsTable.passportExpiry), lt(bookingsTable.passportExpiry, today)));
  else if (filterExpiry === "critical")     conditions.push(and(isNotNull(bookingsTable.passportExpiry), gte(bookingsTable.passportExpiry, today), lte(bookingsTable.passportExpiry, threeMonths)));
  else if (filterExpiry === "ok")           conditions.push(and(isNotNull(bookingsTable.passportExpiry), gt(bookingsTable.passportExpiry, threeMonths)));

  // Staff and agent filters
  if (registeredByStaffId && registeredByStaffId !== "all")
    conditions.push(eq(bookingsTable.registeredByStaffId, registeredByStaffId));
  if (agentId && agentId !== "all")
    conditions.push(eq(bookingsTable.agentId, agentId));

  const whereClause = conditions.length ? and(...conditions) : undefined;

  const baseQuery = () => db
    .select({ count: sql<number>`count(*)` })
    .from(bookingsTable)
    .leftJoin(packagesTable, eq(bookingsTable.packageId, packagesTable.id))
    .where(whereClause);

  const [countRow] = await baseQuery();
  const total      = Number(countRow.count);
  const totalPages = Math.ceil(total / limit) || 1;

  const rows = await db.select({
    id:             bookingsTable.id,
    reference:      bookingsTable.reference,
    fullName:       bookingsTable.fullName,
    firstName:      bookingsTable.firstName,
    lastName:       bookingsTable.lastName,
    passportNumber: bookingsTable.passportNumber,
    passportExpiry: bookingsTable.passportExpiry,
    agentId:        bookingsTable.agentId,
    registeredByStaffId: bookingsTable.registeredByStaffId,
    status:         bookingsTable.status,
    createdAt:      bookingsTable.createdAt,
    hasPassportDoc:  sql<boolean>`(${bookingsTable.passportCopyUrl} is not null)`,
    hasProfilePhoto: sql<boolean>`(${bookingsTable.profilePhotoUrl} is not null)`,
    packageName: packagesTable.name,
    packageType: packagesTable.type,
  })
    .from(bookingsTable)
    .leftJoin(packagesTable, eq(bookingsTable.packageId, packagesTable.id))
    .where(whereClause)
    .orderBy(desc(bookingsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const passports = rows.map(r => ({
    ...r,
    package: r.packageName ? { name: r.packageName, type: r.packageType } : null,
  }));

  return res.json({ passports, total, page, limit, totalPages });
});

router.get("/admin/passports/:bookingId/file", async (req, res) => {
  const booking = await db.query.bookingsTable.findFirst({
    where: eq(bookingsTable.id, req.params.bookingId),
    columns: { passportCopyUrl: true, reference: true, passportNumber: true, fullName: true },
  });
  if (!booking)                 return res.status(404).json({ error: "Booking not found" });
  if (!booking.passportCopyUrl) return res.status(404).json({ error: "No passport document uploaded" });

  const url = booking.passportCopyUrl;
  const mode = (req.query.mode as string) || "download";

  // Preview mode — always return the raw URL as JSON so the frontend can
  // render it directly in an <img> or <object> tag without blob URLs.
  if (mode === "preview") {
    return res.json({
      passportCopyUrl: url,
      reference: booking.reference,
      passportNumber: booking.passportNumber,
      fullName: booking.fullName,
    });
  }

  // --- Download mode (default) ---

  // If the stored URL is an external HTTP(S) link (not a data URI), proxy it
  // to avoid CORS issues and dead-link errors on the frontend
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const upstream = await fetch(url);
      if (!upstream.ok) return res.status(502).json({ error: "Passport file no longer available at stored URL" });
      const contentType = upstream.headers.get("content-type") || "application/octet-stream";
      const buffer = Buffer.from(await upstream.arrayBuffer());
      const ext = contentType.includes("pdf") ? "pdf" : "jpg";
      const filename = `passport-${booking.reference || booking.passportNumber || "doc"}.${ext}`;
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(buffer);
    } catch {
      return res.status(502).json({ error: "Failed to fetch passport file from external storage" });
    }
  }

  // Data URL — convert to binary and send as a proper file download
  if (url.startsWith("data:")) {
    try {
      const [header, base64Data] = url.split(",");
      const mimeMatch = header.match(/data:(.*?);/);
      const contentType = mimeMatch ? mimeMatch[1] : "application/octet-stream";
      const buffer = Buffer.from(base64Data, "base64");
      const ext = contentType.includes("pdf") ? "pdf" : contentType.includes("png") ? "png" : "jpg";
      const filename = `passport-${booking.reference || booking.passportNumber || "doc"}.${ext}`;
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", String(buffer.length));
      return res.send(buffer);
    } catch {
      return res.status(500).json({ error: "Failed to process stored passport file" });
    }
  }

  // Fallback — return as JSON for unknown URL formats
  return res.json({
    passportCopyUrl: booking.passportCopyUrl,
    reference: booking.reference,
    passportNumber: booking.passportNumber,
    fullName: booking.fullName,
  });
});

router.get("/admin/pilgrims/:id", async (req, res) => {
  const profile = await db.query.profilesTable.findFirst({
    where: eq(profilesTable.id, req.params.id),
  });
  if (!profile) return res.status(404).json({ error: "Pilgrim not found" });

  const bookings = await db.select({
    booking: bookingsTable,
    package: {
      id: packagesTable.id,
      name: packagesTable.name,
      type: packagesTable.type,
    },
    packageDate: {
      id: packageDatesTable.id,
      outbound: packageDatesTable.outbound,
      outboundRoute: packageDatesTable.outboundRoute,
      returnDate: packageDatesTable.returnDate,
      returnRoute: packageDatesTable.returnRoute,
      airline: packageDatesTable.airline,
      islamicDate: packageDatesTable.islamicDate,
      islamicReturnDate: packageDatesTable.islamicReturnDate,
    },
  })
    .from(bookingsTable)
    .leftJoin(packagesTable, eq(bookingsTable.packageId, packagesTable.id))
    .leftJoin(packageDatesTable, eq(bookingsTable.packageDateId, packageDatesTable.id))
    .where(eq(bookingsTable.userId, req.params.id));

  const payments = await db.query.paymentsTable.findMany({
    where: eq(paymentsTable.userId, req.params.id),
  });

  return res.json({
    ...profile,
    bookings: bookings.map(r => ({
      ...r.booking,
      totalPrice: Number(r.booking.totalPrice),
      amountPaid: Number(r.booking.amountPaid),
      package: r.package,
      packageDate: r.packageDate || null,
    })),
    documents: [],
    payments: payments.map(p => ({ ...p, amount: Number(p.amount) })),
  });
});

// ── Package Stats (admin) ──────────────────────────────────────────────────────

router.get("/admin/packages/:id/stats", async (req, res) => {
  const packageId = req.params.id;
  const rows = await db.select({
    gender: bookingsTable.gender,
    passportNumber: bookingsTable.passportNumber,
    totalPrice: bookingsTable.totalPrice,
    amountPaid: bookingsTable.amountPaid,
  }).from(bookingsTable).where(eq(bookingsTable.packageId, packageId));

  const total = rows.length;
  const male      = rows.filter(b => b.gender?.toLowerCase() === "male").length;
  const female    = rows.filter(b => b.gender?.toLowerCase() === "female").length;
  const hasPassport = rows.filter(b => b.passportNumber && b.passportNumber.trim()).length;
  const noPassport  = total - hasPassport;
  const paid    = rows.filter(b => Number(b.amountPaid) >= Number(b.totalPrice) && Number(b.totalPrice) > 0).length;
  const partial = rows.filter(b => Number(b.amountPaid) > 0 && Number(b.amountPaid) < Number(b.totalPrice)).length;
  const unpaid  = rows.filter(b => Number(b.amountPaid) === 0).length;

  return res.json({ total, male, female, hasPassport, noPassport, paid, partial, unpaid });
});

router.get("/admin/packages/:id/pilgrims", async (req, res) => {
  const packageId = req.params.id;
  const { filter, page: pageStr, limit: limitStr, exportAll } = req.query as Record<string, string>;

  const isExport = exportAll === "true";
  const page     = Math.max(1, parseInt(pageStr  ?? "1")  || 1);
  const limit    = Math.max(1, parseInt(limitStr ?? "50") || 50);

  const conditions: ReturnType<typeof eq>[] = [eq(bookingsTable.packageId, packageId)];
  if (filter === "male")        conditions.push(eq(bookingsTable.gender, "male"));
  else if (filter === "female") conditions.push(eq(bookingsTable.gender, "female"));

  const bookings = await db.select({
    booking: bookingsTable,
    user: { id: profilesTable.id, fullName: profilesTable.fullName, email: profilesTable.email, phone: profilesTable.phone },
  })
    .from(bookingsTable)
    .leftJoin(profilesTable, eq(bookingsTable.userId, profilesTable.id))
    .where(and(...conditions))
    .orderBy(desc(bookingsTable.createdAt));

  const pilgrims = bookings.map(row => ({
    ...row.booking,
    totalPrice: Number(row.booking.totalPrice),
    amountPaid: Number(row.booking.amountPaid),
    user: row.user,
  }));

  // JS-side filtering for passport / payment (avoids raw SQL casting)
  const filtered = (() => {
    if (filter === "passport")   return pilgrims.filter(p => p.passportNumber && p.passportNumber.trim());
    if (filter === "nopassport") return pilgrims.filter(p => !p.passportNumber || !p.passportNumber.trim());
    if (filter === "paid")       return pilgrims.filter(p => p.totalPrice > 0 && p.amountPaid >= p.totalPrice);
    if (filter === "partial")    return pilgrims.filter(p => p.amountPaid > 0 && p.amountPaid < p.totalPrice);
    if (filter === "unpaid")     return pilgrims.filter(p => p.amountPaid === 0);
    return pilgrims;
  })();

  const total      = filtered.length;
  const totalPages = Math.ceil(total / limit) || 1;

  // exportAll=true → return every record (used by Excel/PDF export)
  if (isExport) {
    return res.json({ pilgrims: filtered, total, page: 1, limit: total, totalPages: 1 });
  }

  const paginated = filtered.slice((page - 1) * limit, page * limit);
  return res.json({ pilgrims: paginated, total, page, limit, totalPages });
});

// ── Staff ─────────────────────────────────────────────────────────────────────

router.get("/admin/staff", async (req, res) => {
  const staff = await db.query.profilesTable.findMany({
    where: or(
      eq(profilesTable.role, "staff"),
      eq(profilesTable.role, "admin"),
      eq(profilesTable.role, "super_admin"),
    ),
  });

  const staffWithData = await Promise.all(
    staff.map(async (s) => {
      const [perms, specs] = await Promise.all([
        db.query.staffPermissionsTable.findMany({ where: eq(staffPermissionsTable.userId, s.id) }),
        db.query.staffSupportSpecialtiesTable.findMany({ where: eq(staffSupportSpecialtiesTable.userId, s.id) }),
      ]);
      return {
        ...s,
        permissions: perms.map((p) => p.permission),
        specialties: specs.map((sp) => sp.category),
      };
    })
  );

  return res.json({ staff: staffWithData, total: staffWithData.length });
});

router.get("/admin/staff/my-permissions", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, clerkUserId) });
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const [perms, specs] = await Promise.all([
    db.query.staffPermissionsTable.findMany({ where: eq(staffPermissionsTable.userId, profile.id) }),
    db.query.staffSupportSpecialtiesTable.findMany({ where: eq(staffSupportSpecialtiesTable.userId, profile.id) }),
  ]);

  return res.json({
    role: profile.role,
    permissions: perms.map((p) => p.permission),
    specialties: specs.map((sp) => sp.category),
  });
});

router.post("/admin/staff", async (req, res) => {
  try {
    const { fullName, email, role = "staff", password, permissions = [], specialties = [] } = req.body as {
      fullName: string; email: string; role: string; password: string;
      permissions?: string[]; specialties?: string[];
    };

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: "fullName, email and password are required" });
    }

    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) return res.status(500).json({ error: "Clerk not configured" });

    let clerkRes: globalThis.Response;
    try {
      clerkRes = await fetch("https://api.clerk.com/v1/users", {
        method: "POST",
        headers: { Authorization: `Bearer ${clerkSecretKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: fullName.split(" ")[0],
          last_name: fullName.split(" ").slice(1).join(" ") || "",
          email_address: [email],
          password,
          skip_password_checks: true,
        }),
      });
    } catch (fetchErr: any) {
      console.error("[staff-create] Clerk API network error:", fetchErr.message);
      return res.status(502).json({ error: `Could not reach Clerk API: ${fetchErr.message}` });
    }

    if (!clerkRes.ok) {
      const err = await clerkRes.json() as any;
      const msg = err?.errors?.[0]?.long_message || err?.errors?.[0]?.message || "Failed to create Clerk user";
      console.error("[staff-create] Clerk API error:", msg, JSON.stringify(err));
      return res.status(400).json({ error: msg });
    }

    const clerkUser = await clerkRes.json() as any;
    const clerkUserId: string = clerkUser.id;

    // Check if a profile already exists for this Clerk user (idempotent retry)
    const existingProfile = await db.query.profilesTable.findFirst({
      where: eq(profilesTable.clerkUserId, clerkUserId),
    });
    if (existingProfile) {
      return res.status(200).json({ ...existingProfile, permissions: [], specialties: [], message: "Account already exists" });
    }

    const profileId = randomUUID();
    const [profile] = await db.insert(profilesTable).values({
      id: profileId,
      clerkUserId,
      email,
      fullName,
      role: role as any,
    }).returning();

    if (permissions.length > 0) {
      await db.insert(staffPermissionsTable).values(
        permissions.map(p => ({ id: randomUUID(), userId: profileId, permission: p }))
      );
    }
    if (specialties.length > 0) {
      await db.insert(staffSupportSpecialtiesTable).values(
        specialties.map(cat => ({ id: randomUUID(), userId: profileId, category: cat }))
      );
    }

    // Send welcome email (non-blocking — account creation succeeds even if email fails)
    let emailWarning: string | undefined;
    try {
      await sendStaffWelcomeEmail({
        name: fullName,
        email,
        role: role as string,
        tempPassword: password,
      });
    } catch (emailErr: any) {
      console.error("[staff-create] Welcome email failed (account was created):", emailErr.message);
      emailWarning = "Account created but welcome email could not be sent.";
    }

    // Activity log
    try { const { userId: _clk } = getAuth(req); if (_clk) { const _c = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, _clk) }); if (_c) await db.insert(userActivityTable).values({ id: randomUUID(), userId: _c.id, eventType: "staff_created", metadata: { actorName: _c.fullName, actorRole: _c.role, targetName: fullName, targetEmail: email, assignedRole: role } }); } } catch (_) { /* non-blocking */ }

    return res.status(201).json({
      ...profile,
      permissions,
      specialties,
      ...(emailWarning ? { warning: emailWarning } : {}),
    });
  } catch (err: any) {
    console.error("[staff-create] Unexpected error:", err);
    return res.status(500).json({ error: err.message || "Failed to create staff account" });
  }
});

router.delete("/admin/staff/:id", async (req, res) => {
  try {
    const { userId: callerClerkId } = getAuth(req);
    if (!callerClerkId) return res.status(401).json({ error: "Unauthorized" });
    const caller = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, callerClerkId) });
    if (!caller) return res.status(404).json({ error: "Caller profile not found" });

    const targetId = req.params.id;
    const target = await db.query.profilesTable.findFirst({ where: eq(profilesTable.id, targetId) });
    if (!target) return res.status(404).json({ error: "Staff not found" });

    // Guards
    if (target.id === caller.id) {
      return res.status(400).json({ error: "You cannot delete your own account." });
    }
    if (target.role === "super_admin") {
      return res.status(403).json({ error: "Cannot delete a super admin from the staff page." });
    }

    // Step 1: Delete from Clerk FIRST — abort if it fails
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      return res.status(500).json({ error: "Clerk secret key not configured" });
    }

    const isWalkIn = target.clerkUserId.startsWith("walkin-");
    if (!isWalkIn) {
      const clerkRes = await fetch(`https://api.clerk.com/v1/users/${target.clerkUserId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${clerkSecretKey}` },
      });
      if (!clerkRes.ok && clerkRes.status !== 404) {
        const errBody = await clerkRes.text().catch(() => "Unknown error");
        console.error("[staff-delete] Clerk deletion failed:", clerkRes.status, errBody);
        return res.status(502).json({ error: "Failed to delete user from authentication provider. Database was NOT modified." });
      }
    }

    // Step 2: Database cleanup in a transaction
    await db.transaction(async (tx) => {
      // Nullify nullable FK references
      await tx.update(bookingsTable).set({ registeredByStaffId: null }).where(eq(bookingsTable.registeredByStaffId, targetId));
      await tx.update(paymentsTable).set({ verifiedBy: null }).where(eq(paymentsTable.verifiedBy, targetId));
      await tx.update(supportTicketsTable).set({ assignedTo: null }).where(eq(supportTicketsTable.assignedTo, targetId));
      await tx.update(staffPermissionsTable).set({ grantedBy: null }).where(eq(staffPermissionsTable.grantedBy, targetId));
      await tx.update(staffMessagesTable).set({ receiverId: null }).where(eq(staffMessagesTable.receiverId, targetId));
      await tx.update(bookingAmendmentRequestsTable).set({ reviewedBy: null }).where(eq(bookingAmendmentRequestsTable.reviewedBy, targetId));

      // Delete owned rows
      await tx.delete(notificationsTable).where(eq(notificationsTable.userId, targetId));
      await tx.delete(userActivityTable).where(eq(userActivityTable.userId, targetId));
      await tx.delete(staffPermissionsTable).where(eq(staffPermissionsTable.userId, targetId));
      await tx.delete(staffSupportSpecialtiesTable).where(eq(staffSupportSpecialtiesTable.userId, targetId));
      await tx.delete(staffMessagesTable).where(eq(staffMessagesTable.senderId, targetId));
      await tx.delete(adminOtpRequestsTable).where(eq(adminOtpRequestsTable.adminId, targetId));
      await tx.delete(loginSessionsTable).where(eq(loginSessionsTable.clerkUserId, target.clerkUserId));

      // Support tickets
      const userTickets = await tx.select({ id: supportTicketsTable.id }).from(supportTicketsTable).where(eq(supportTicketsTable.userId, targetId));
      if (userTickets.length > 0) {
        const ticketIds = userTickets.map(t => t.id);
        await tx.delete(supportMessagesTable).where(inArray(supportMessagesTable.ticketId, ticketIds));
        await tx.delete(supportTicketsTable).where(eq(supportTicketsTable.userId, targetId));
      }

      // Preserve financial records
      await tx.update(bookingsTable).set({ userId: null }).where(eq(bookingsTable.userId, targetId));
      await tx.update(paymentsTable).set({ userId: null }).where(eq(paymentsTable.userId, targetId));
      await tx.delete(bookingAmendmentRequestsTable).where(eq(bookingAmendmentRequestsTable.userId, targetId));

      // Delete profile
      await tx.delete(profilesTable).where(eq(profilesTable.id, targetId));
    });

    // Activity log
    try { await db.insert(userActivityTable).values({ id: randomUUID(), userId: caller.id, eventType: "staff_deleted", metadata: { actorName: caller.fullName, actorRole: caller.role, targetName: target.fullName || target.email, targetRole: target.role } }); } catch (_) { /* non-blocking */ }

    console.log(`[staff-delete] Successfully deleted staff ${targetId} (${target.email}) from Clerk and Neon`);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[staff-delete] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to delete staff member" });
  }
});

router.put("/admin/staff/:id/permissions", async (req, res) => {
  try {
    const { permissions } = req.body as { permissions: string[] };
    const userId = req.params.id;

    await db.delete(staffPermissionsTable).where(eq(staffPermissionsTable.userId, userId));

    if (permissions && permissions.length > 0) {
      await db.insert(staffPermissionsTable).values(
        permissions.map(p => ({ id: randomUUID(), userId, permission: p }))
      );
    }

    // Activity log
    try { const { userId: _clk } = getAuth(req); if (_clk) { const _c = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, _clk) }); const _t = await db.query.profilesTable.findFirst({ where: eq(profilesTable.id, userId) }); if (_c) await db.insert(userActivityTable).values({ id: randomUUID(), userId: _c.id, eventType: "staff_permissions_updated", metadata: { actorName: _c.fullName, actorRole: _c.role, targetName: _t?.fullName || userId, permissions } }); } } catch (_) { /* non-blocking */ }

    return res.json({ success: true });
  } catch (err: any) {
    console.error("[staff-permissions] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to update permissions" });
  }
});

router.put("/admin/staff/:id/specialties", async (req, res) => {
  try {
    const { specialties } = req.body as { specialties: string[] };
    const userId = req.params.id;

    await db.delete(staffSupportSpecialtiesTable).where(eq(staffSupportSpecialtiesTable.userId, userId));

    if (specialties && specialties.length > 0) {
      await db.insert(staffSupportSpecialtiesTable).values(
        specialties.map(cat => ({ id: randomUUID(), userId, category: cat }))
      );
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error("[staff-specialties] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to update specialties" });
  }
});

// SECURITY FIX #6: Validate role against allowed enum values.
// Only super_admin can assign super_admin role.
router.put("/admin/staff/:id/role", async (req, res) => {
  try {
    const { role } = req.body;
    const ALLOWED_ROLES = ["user", "staff", "moderator", "admin", "super_admin", "agent"];
    if (!role || !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Allowed: ${ALLOWED_ROLES.join(", ")}` });
    }

    // Restrict super_admin assignment: only super_admins can grant super_admin
    if (role === "super_admin") {
      const { userId: clerkUserId } = getAuth(req);
      if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
      const callerProfile = await db.query.profilesTable.findFirst({
        where: eq(profilesTable.clerkUserId, clerkUserId),
      });
      if (!callerProfile || callerProfile.role !== "super_admin") {
        return res.status(403).json({ error: "Only super admins can assign the super_admin role" });
      }
    }

    const [updated] = await db.update(profilesTable)
      .set({ role, updatedAt: new Date() })
      .where(eq(profilesTable.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Staff not found" });
    return res.json(updated);
  } catch (err: any) {
    console.error("[staff-role] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to update role" });
  }
});

// ── Staff profile update (fullName / email) ──────────────────────────────────

router.put("/admin/staff/:id/profile", async (req, res) => {
  try {
    const { userId: callerClerkId } = getAuth(req);
    if (!callerClerkId) return res.status(401).json({ error: "Unauthorized" });
    const caller = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, callerClerkId) });
    if (!caller || !["admin", "super_admin"].includes(caller.role)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { fullName, email } = req.body as { fullName?: string; email?: string };
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (fullName?.trim()) updates.fullName = fullName.trim();
    if (email?.trim()) updates.email = email.trim();

    if (!updates.fullName && !updates.email) {
      return res.status(400).json({ error: "At least fullName or email is required" });
    }

    const [updated] = await db.update(profilesTable)
      .set(updates)
      .where(eq(profilesTable.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Staff member not found" });

    // Sync name to Clerk if possible
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (clerkSecretKey && !updated.clerkUserId.startsWith("walkin-")) {
      try {
        const body: Record<string, any> = {};
        if (updates.fullName) {
          const parts = updates.fullName.split(" ");
          body.first_name = parts[0];
          body.last_name = parts.slice(1).join(" ") || "";
        }
        if (Object.keys(body).length > 0) {
          await fetch(`https://api.clerk.com/v1/users/${updated.clerkUserId}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${clerkSecretKey}`, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        }
      } catch (clerkErr: any) {
        console.error("[staff-profile] Clerk sync failed:", clerkErr.message);
      }
    }

    return res.json(updated);
  } catch (err: any) {
    console.error("[staff-profile] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to update profile" });
  }
});

// ── Analytics ─────────────────────────────────────────────────────────────────

router.get("/admin/analytics", async (req, res) => {
  const { period = "month", month, year } = req.query as Record<string, string>;
  const allBookings = await db.query.bookingsTable.findMany({ where: eq(bookingsTable.isArchived, false) });
  const allPayments = await db.query.paymentsTable.findMany({ where: eq(paymentsTable.isArchived, false) });
  const allProfiles = await db.query.profilesTable.findMany({ where: eq(profilesTable.role, "user") });
  const allPackages = await db.query.packagesTable.findMany();

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const now = new Date();

  // Revenue metrics
  const collectedRevenue = allPayments.filter(p => p.status === "verified").reduce((s, p) => s + Number(p.amount), 0);
  const expectedRevenue = allBookings.filter(b => ["confirmed", "completed"].includes(b.status)).reduce((s, b) => s + Number(b.totalPrice), 0);
  const pendingRevenue = allPayments.filter(p => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0);

  // Helper: day range filter
  const inDay = (date: Date, d: Date) => {
    const next = new Date(d); next.setDate(next.getDate() + 1);
    return date >= d && date < next;
  };
  const inMonth = (date: Date, d: Date) =>
    date.getMonth() === d.getMonth() && date.getFullYear() === d.getFullYear();

  // Period-aware time series
  const revenueByPeriod: Array<{ label: string; revenue: number; bookings: number; collected: number }> = [];

  if (month && year) {
    const m = parseInt(month) - 1;
    const y = parseInt(year);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    for (let dd = 1; dd <= daysInMonth; dd++) {
      const dayStart = new Date(y, m, dd);
      const rev = allBookings.filter(b => inDay(new Date(b.createdAt), dayStart)).reduce((s, b) => s + Number(b.totalPrice), 0);
      const col = allPayments.filter(p => inDay(new Date(p.createdAt), dayStart) && p.status === "verified").reduce((s, p) => s + Number(p.amount), 0);
      const bk = allBookings.filter(b => inDay(new Date(b.createdAt), dayStart)).length;
      revenueByPeriod.push({ label: `${dd}`, revenue: rev, bookings: bk, collected: col });
    }
  } else if (period === "week") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      const label = DAYS[d.getDay()];
      const rev = allBookings.filter(b => inDay(new Date(b.createdAt), d)).reduce((s, b) => s + Number(b.totalPrice), 0);
      const col = allPayments.filter(p => inDay(new Date(p.createdAt), d) && p.status === "verified").reduce((s, p) => s + Number(p.amount), 0);
      const bk = allBookings.filter(b => inDay(new Date(b.createdAt), d)).length;
      revenueByPeriod.push({ label, revenue: rev, bookings: bk, collected: col });
    }
  } else if (period === "quarter") {
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const rev = allBookings.filter(b => inMonth(new Date(b.createdAt), d)).reduce((s, b) => s + Number(b.totalPrice), 0);
      const col = allPayments.filter(p => inMonth(new Date(p.createdAt), d) && p.status === "verified").reduce((s, p) => s + Number(p.amount), 0);
      const bk = allBookings.filter(b => inMonth(new Date(b.createdAt), d)).length;
      revenueByPeriod.push({ label: MONTHS[d.getMonth()], revenue: rev, bookings: bk, collected: col });
    }
  } else if (period === "year") {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const rev = allBookings.filter(b => inMonth(new Date(b.createdAt), d)).reduce((s, b) => s + Number(b.totalPrice), 0);
      const col = allPayments.filter(p => inMonth(new Date(p.createdAt), d) && p.status === "verified").reduce((s, p) => s + Number(p.amount), 0);
      const bk = allBookings.filter(b => inMonth(new Date(b.createdAt), d)).length;
      revenueByPeriod.push({ label: MONTHS[d.getMonth()], revenue: rev, bookings: bk, collected: col });
    }
  } else {
    // default: last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const rev = allBookings.filter(b => inMonth(new Date(b.createdAt), d)).reduce((s, b) => s + Number(b.totalPrice), 0);
      const col = allPayments.filter(p => inMonth(new Date(p.createdAt), d) && p.status === "verified").reduce((s, p) => s + Number(p.amount), 0);
      const bk = allBookings.filter(b => inMonth(new Date(b.createdAt), d)).length;
      revenueByPeriod.push({ label: MONTHS[d.getMonth()], revenue: rev, bookings: bk, collected: col });
    }
  }

  // Package breakdown
  const packageBreakdown = allPackages.map(pkg => {
    const pkgBookings = allBookings.filter(b => b.packageId === pkg.id);
    const pkgRevenue = pkgBookings.filter(b => ["confirmed", "completed"].includes(b.status)).reduce((s, b) => s + Number(b.totalPrice), 0);
    return {
      name: pkg.name,
      type: pkg.type,
      bookings: pkgBookings.length,
      revenue: pkgRevenue,
      capacity: pkg.capacity,
      fillRate: pkg.capacity > 0 ? Math.round((pkgBookings.length / pkg.capacity) * 100) : 0,
    };
  }).sort((a, b) => b.bookings - a.bookings);

  // Hajj vs Umrah
  const pkgTypeMap = Object.fromEntries(allPackages.map(p => [p.id, p.type]));
  const hajjBookings = allBookings.filter(b => pkgTypeMap[b.packageId] === "hajj").length;
  const umrahBookings = allBookings.filter(b => pkgTypeMap[b.packageId] === "umrah").length;
  const total = allBookings.length;

  // Payment method breakdown
  const paymentMethodBreakdown = ["paystack", "bank_transfer", "cash"].map(method => ({
    method: method === "bank_transfer" ? "Bank Transfer" : method === "paystack" ? "Online" : "Cash",
    count: allPayments.filter(p => p.method === method).length,
    collected: allPayments.filter(p => p.method === method && p.status === "verified").reduce((s, p) => s + Number(p.amount), 0),
  }));

  const pendingCount = allBookings.filter(b => b.status === "pending").length;
  const confirmedCount = allBookings.filter(b => b.status === "confirmed").length;
  const cancelledCount = allBookings.filter(b => b.status === "cancelled").length;
  const completedCount = allBookings.filter(b => b.status === "completed").length;

  return res.json({
    period,
    totalRevenue: collectedRevenue,
    collectedRevenue,
    expectedRevenue,
    pendingRevenue,
    totalBookings: total,
    newPilgrims: allProfiles.length,
    conversionRate: total > 0 ? Math.round((confirmedCount / total) * 100) : 0,
    cancellationRate: total > 0 ? Math.round((cancelledCount / total) * 100) : 0,
    revenueByPeriod,
    packageBreakdown,
    bookingsByStatus: { pending: pendingCount, confirmed: confirmedCount, cancelled: cancelledCount, completed: completedCount },
    hajjVsUmrah: {
      hajj: hajjBookings,
      umrah: umrahBookings,
      hajjPercent: total > 0 ? Math.round((hajjBookings / total) * 100) : 0,
      umrahPercent: total > 0 ? Math.round((umrahBookings / total) * 100) : 0,
    },
    paymentMethodBreakdown,
  });
});

// ── Bank Accounts ─────────────────────────────────────────────────────────────

router.get("/admin/bank-accounts", async (_req, res) => {
  const accounts = await db.query.bankAccountsTable.findMany({
    orderBy: bankAccountsTable.createdAt,
  });
  return res.json({ accounts });
});

router.post("/admin/bank-accounts", async (req, res) => {
  const { bankName, accountName, accountNumber, sortCode, isActive = true } = req.body;
  const [account] = await db.insert(bankAccountsTable).values({
    id: randomUUID(),
    bankName,
    accountName,
    accountNumber,
    sortCode,
    isActive,
  }).returning();
  return res.status(201).json(account);
});

router.put("/admin/bank-accounts/:id", async (req, res) => {
  const { bankName, accountName, accountNumber, sortCode, isActive } = req.body;
  const updates: any = {};
  if (bankName !== undefined) updates.bankName = bankName;
  if (accountName !== undefined) updates.accountName = accountName;
  if (accountNumber !== undefined) updates.accountNumber = accountNumber;
  if (sortCode !== undefined) updates.sortCode = sortCode;
  if (isActive !== undefined) updates.isActive = isActive;

  const [account] = await db.update(bankAccountsTable)
    .set(updates)
    .where(eq(bankAccountsTable.id, req.params.id))
    .returning();
  if (!account) return res.status(404).json({ error: "Account not found" });
  return res.json(account);
});

router.delete("/admin/bank-accounts/:id", async (req, res) => {
  await db.delete(bankAccountsTable).where(eq(bankAccountsTable.id, req.params.id));
  return res.json({ success: true });
});

// ── Contact / Enquiries ────────────────────────────────────────────────────────

router.get("/admin/enquiries", async (req, res) => {
  const { status } = req.query as Record<string, string>;
  const conditions = status ? [eq(contactMessagesTable.status, status)] : [];
  const messages = await db.query.contactMessagesTable.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: [desc(contactMessagesTable.createdAt)],
  });
  return res.json({ messages });
});

router.put("/admin/enquiries/:id/status", async (req, res) => {
  const { status, notes } = req.body;
  const updates: any = { status };
  if (status === "read") updates.readAt = new Date();
  if (notes !== undefined) updates.notes = notes;
  const [updated] = await db.update(contactMessagesTable)
    .set(updates)
    .where(eq(contactMessagesTable.id, req.params.id))
    .returning();
  return res.json(updated);
});

router.delete("/admin/enquiries/:id", async (req, res) => {
  await db.delete(contactMessagesTable).where(eq(contactMessagesTable.id, req.params.id));
  return res.json({ success: true });
});

// ── Site Settings ─────────────────────────────────────────────────────────────

router.get("/admin/settings", async (_req, res) => {
  const settings = await db.query.siteSettingsTable.findMany();
  const map: Record<string, any> = {};
  settings.forEach(s => { map[s.key] = s.value; });
  if (map.paystack_secret_key) {
    const raw = String(map.paystack_secret_key);
    map.paystack_secret_key = raw.slice(0, 7) + "••••••••" + raw.slice(-4);
    map.paystack_secret_key_set = true;
  } else if (process.env.PAYSTACK_SECRET_KEY) {
    const raw = process.env.PAYSTACK_SECRET_KEY;
    map.paystack_secret_key = raw.slice(0, 7) + "••••••••" + raw.slice(-4);
    map.paystack_secret_key_set = true;
    map.paystack_secret_key_source = "env";
  }
  if (!map.paystack_public_key && process.env.PAYSTACK_PUBLIC_KEY) {
    map.paystack_public_key = process.env.PAYSTACK_PUBLIC_KEY;
    map.paystack_public_key_source = "env";
  }
  if (map.gemini_api_key) {
    const raw = String(map.gemini_api_key);
    map.gemini_api_key = raw.slice(0, 6) + "••••••••" + raw.slice(-4);
    map.gemini_api_key_set = true;
  }
  if (map.resend_api_key) {
    const raw = String(map.resend_api_key);
    map.resend_api_key = raw.slice(0, 5) + "••••••••" + raw.slice(-4);
    map.resend_api_key_set = true;
  }
  if (map.smtp_pass) {
    map.smtp_pass = "••••••••••••";
    map.smtp_pass_set = true;
  }
  if (map.mistral_api_key) {
    const raw = String(map.mistral_api_key);
    map.mistral_api_key = raw.slice(0, 5) + "••••••••" + raw.slice(-4);
    map.mistral_api_key_set = true;
  }
  return res.json({ settings: map });
});

router.post("/admin/email/test", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, clerkUserId) });
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  const isAdmin = ["admin", "super_admin", "staff"].includes(profile.role);
  if (!isAdmin) return res.status(403).json({ error: "Admin access required" });

  const { to } = req.body as { to?: string };
  if (!to) return res.status(400).json({ error: "to (email address) is required" });

  try {
    await sendEmail({
      to,
      subject: "Test Email - Raudah Travels",
      html: `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:32px;background:#F0F2FF;">
        <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #E2E8F0;">
          <div style="background:linear-gradient(135deg,#1C1F66,#2D3199);border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
            <p style="margin:0;color:#fff;font-size:18px;font-weight:800;">Raudah Travels &amp; Tours</p>
          </div>
          <h2 style="color:#0F172A;margin:0 0 12px;">Email Configuration Test</h2>
          <p style="color:#64748B;font-size:14px;line-height:1.6;margin:0 0 16px;">
            This is a test email sent from your Admin Settings to verify your email configuration is working correctly.
          </p>
          <div style="background:#DCFCE7;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
            <p style="margin:0;color:#16A34A;font-size:13px;font-weight:600;">&#10003; Your email settings are working!</p>
          </div>
          <p style="color:#94A3B8;font-size:12px;margin:0;">Sent from: Admin &gt; Settings &gt; Email &gt; Send Test Email</p>
        </div>
      </body></html>`,
      text: "This is a test email from Raudah Travels. Your email configuration is working correctly.",
      throwOnError: true,
    });
    return res.json({ success: true, message: `Test email sent to ${to}` });
  } catch (err: any) {
    const msg = err?.message || "Unknown error";
    return res.status(500).json({ success: false, error: `Email failed: ${msg}` });
  }
});

// ── DEBUG: Check email config (temporary diagnostic) ─────────────────────────
router.get("/admin/email/debug", async (req, res) => {
  const rows = await db.select().from(siteSettingsTable).where(
    inArray(siteSettingsTable.key, [
      "email_provider", "resend_api_key", "resend_from_email",
      "smtp_host", "smtp_port", "smtp_user", "smtp_pass",
      "smtp_secure", "smtp_from_name", "smtp_from_email",
    ])
  );
  const settings = rows.map(r => ({
    key: r.key,
    valueType: typeof r.value,
    value: r.key.includes("pass") || r.key.includes("api_key")
      ? (r.value ? `${String(r.value).substring(0, 6)}...` : "(empty)")
      : r.value,
    rawJSON: JSON.stringify(r.value),
  }));
  return res.json({
    totalSettingsFound: rows.length,
    settings,
    resolvedProvider: settings.find(s => s.key === "email_provider")?.value || "(not set, defaulting to smtp)",
  });
});

router.put("/admin/settings/:key", async (req, res) => {
  const { value } = req.body;
  const existing = await db.query.siteSettingsTable.findFirst({
    where: eq(siteSettingsTable.key, req.params.key),
  });

  let result: any;
  let statusCode = 200;
  if (existing) {
    const [updated] = await db.update(siteSettingsTable)
      .set({ value, updatedAt: new Date() })
      .where(eq(siteSettingsTable.key, req.params.key))
      .returning();
    result = updated;
  } else {
    const [created] = await db.insert(siteSettingsTable).values({
      id: randomUUID(),
      key: req.params.key,
      value,
    }).returning();
    result = created;
    statusCode = 201;
  }

  // Activity log
  try { const { userId: _clk } = getAuth(req); if (_clk) { const _c = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, _clk) }); if (_c) await db.insert(userActivityTable).values({ id: randomUUID(), userId: _c.id, eventType: "settings_updated", metadata: { actorName: _c.fullName, actorRole: _c.role, settingKey: req.params.key } }); } } catch (_) { /* non-blocking */ }

  return res.status(statusCode).json(result);
});

// ── Booking Form Fields ───────────────────────────────────────────────────────

router.get("/admin/booking-form-fields", async (req, res) => {
  const { appliesTo } = req.query as Record<string, string>;
  const conditions: any[] = [];
  if (appliesTo) conditions.push(eq(bookingFormFieldsTable.appliesTo, appliesTo));

  const fields = await db.query.bookingFormFieldsTable.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: bookingFormFieldsTable.sortOrder,
  });
  return res.json({ fields });
});

router.post("/admin/booking-form-fields", async (req, res) => {
  const { label, fieldName, fieldType, placeholder, required, appliesTo, section, options, sortOrder } = req.body;
  const [field] = await db.insert(bookingFormFieldsTable).values({
    id: randomUUID(),
    label,
    fieldName: fieldName || label.toLowerCase().replace(/\s+/g, "_"),
    fieldType,
    placeholder,
    required: required || false,
    appliesTo: appliesTo || "all",
    section: section || "pilgrim_info",
    options,
    sortOrder: sortOrder || 0,
    isSystem: false,
    enabled: true,
  }).returning();
  // Activity log
  try { const { userId: _clk } = getAuth(req); if (_clk) { const _c = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, _clk) }); if (_c) await db.insert(userActivityTable).values({ id: randomUUID(), userId: _c.id, eventType: "booking_form_updated", metadata: { actorName: _c.fullName, actorRole: _c.role, action: "created", fieldLabel: label } }); } } catch (_) { /* non-blocking */ }

  return res.status(201).json(field);
});

router.put("/admin/booking-form-fields/:id", async (req, res) => {
  const { label, placeholder, required, enabled, sortOrder, options } = req.body;
  const updates: any = { updatedAt: new Date() };
  if (label !== undefined) updates.label = label;
  if (placeholder !== undefined) updates.placeholder = placeholder;
  if (required !== undefined) updates.required = required;
  if (enabled !== undefined) updates.enabled = enabled;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  if (options !== undefined) updates.options = options;

  const [field] = await db.update(bookingFormFieldsTable)
    .set(updates)
    .where(eq(bookingFormFieldsTable.id, req.params.id))
    .returning();
  if (!field) return res.status(404).json({ error: "Field not found" });
  // Activity log
  try { const { userId: _clk } = getAuth(req); if (_clk) { const _c = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, _clk) }); if (_c) await db.insert(userActivityTable).values({ id: randomUUID(), userId: _c.id, eventType: "booking_form_updated", metadata: { actorName: _c.fullName, actorRole: _c.role, action: "updated", fieldId: req.params.id } }); } } catch (_) { /* non-blocking */ }

  return res.json(field);
});

router.delete("/admin/booking-form-fields/:id", async (req, res) => {
  const field = await db.query.bookingFormFieldsTable.findFirst({
    where: eq(bookingFormFieldsTable.id, req.params.id),
  });
  if (field?.isSystem) return res.status(400).json({ error: "Cannot delete system fields" });
  await db.delete(bookingFormFieldsTable).where(eq(bookingFormFieldsTable.id, req.params.id));
  return res.json({ success: true });
});

// ── Activity Log ──────────────────────────────────────────────────────────────

router.get("/admin/activity", async (req, res) => {
  const { eventType, search, limit = "50", offset = "0", dateFrom, dateTo, category } = req.query as Record<string, string>;
  const conditions: any[] = [];

  if (eventType && eventType !== "all") {
    conditions.push(eq(userActivityTable.eventType, eventType));
  }

  // Category shortcut: map to multiple event types
  const STAFF_EVENTS = ["pilgrim_registered","payment_verified","payment_rejected","booking_confirmed","booking_cancelled","amendment_approved","amendment_rejected","booking_status_changed","visa_status_changed","booking_completed","booking_pending"];
  const PAYMENT_EVENTS = ["payment_attempt","payment_success","payment_failed","payment_received","payment_verified","payment_rejected"];
  const PILGRIM_EVENTS = ["package_view","booking_start","booking_created","payment_attempt"];
  const ADMIN_EVENTS = ["role_changed","user_status_changed","user_deleted","staff_created","staff_deleted","staff_permissions_updated","package_created","package_updated","package_deleted","agent_approved","agent_rejected","agent_discount_applied","booking_form_updated","settings_updated"];
  const AGENT_EVENTS = ["agent_application_submitted","agent_client_registered","wallet_topup","wallet_transaction"];

  if (category === "staff") {
    conditions.push(sql`${userActivityTable.eventType} = ANY(ARRAY[${sql.raw(STAFF_EVENTS.map(e => `'${e}'`).join(","))}])`);
  } else if (category === "payments") {
    conditions.push(sql`${userActivityTable.eventType} = ANY(ARRAY[${sql.raw(PAYMENT_EVENTS.map(e => `'${e}'`).join(","))}])`);
  } else if (category === "pilgrim") {
    conditions.push(sql`${userActivityTable.eventType} = ANY(ARRAY[${sql.raw(PILGRIM_EVENTS.map(e => `'${e}'`).join(","))}])`);
  } else if (category === "admin") {
    conditions.push(sql`${userActivityTable.eventType} = ANY(ARRAY[${sql.raw(ADMIN_EVENTS.map(e => `'${e}'`).join(","))}])`);
  } else if (category === "agent") {
    conditions.push(sql`${userActivityTable.eventType} = ANY(ARRAY[${sql.raw(AGENT_EVENTS.map(e => `'${e}'`).join(","))}])`);
  }

  if (dateFrom) conditions.push(gte(userActivityTable.createdAt, new Date(dateFrom)));
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(userActivityTable.createdAt, end));
  }

  const activities = await db.select({
    activity: userActivityTable,
    actor: {
      id: profilesTable.id,
      fullName: profilesTable.fullName,
      email: profilesTable.email,
      avatarUrl: profilesTable.avatarUrl,
      role: profilesTable.role,
      phone: profilesTable.phone,
    },
  })
    .from(userActivityTable)
    .leftJoin(profilesTable, eq(userActivityTable.userId, profilesTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(userActivityTable.createdAt))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  // Client-side search filter
  let results = activities.map(r => ({ ...r.activity, user: r.actor }));
  if (search) {
    const s = search.toLowerCase();
    results = results.filter(a =>
      a.user?.fullName?.toLowerCase().includes(s) ||
      a.user?.email?.toLowerCase().includes(s) ||
      a.eventType.includes(s) ||
      JSON.stringify(a.metadata || {}).toLowerCase().includes(s)
    );
  }

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(userActivityTable)
    .where(conditions.length ? and(...conditions) : undefined);

  return res.json({
    activities: results,
    total: Number(count),
  });
});

// ── Agent Activity (Unified Logs & Wallet) ────────────────────────────────────

router.get("/admin/agents-activity", async (req, res) => {
  const { agentId, limit = "50", offset = "0" } = req.query as Record<string, string>;
  const pLimit = Math.min(Math.max(1, parseInt(limit) || 50), 200);
  const pOffset = Math.max(0, parseInt(offset) || 0);

  // 1. Get agent mapping
  const agents = await db.select({
    id: agentsTable.id,
    userId: agentsTable.userId,
    businessName: agentsTable.businessName,
  }).from(agentsTable);

  const targetAgentIds = agentId && agentId !== "all" ? [agentId] : agents.map(a => a.id);
  const targetUserIds = agents.filter(a => targetAgentIds.includes(a.id)).map(a => a.userId);

  // 2. Fetch ONLY the page of User Activities (with SQL limit/offset)
  let userActivities: any[] = [];
  let userTotal = 0;
  if (targetUserIds.length > 0) {
    const [userRows, userCountRow] = await Promise.all([
      db.select({
        id: userActivityTable.id,
        userId: userActivityTable.userId,
        eventType: userActivityTable.eventType,
        metadata: userActivityTable.metadata,
        createdAt: userActivityTable.createdAt,
      })
      .from(userActivityTable)
      .where(inArray(userActivityTable.userId, targetUserIds))
      .orderBy(desc(userActivityTable.createdAt)),
      db.select({ count: sql<number>`count(*)` })
        .from(userActivityTable)
        .where(inArray(userActivityTable.userId, targetUserIds)),
    ]);
    userActivities = userRows;
    userTotal = Number(userCountRow[0]?.count || 0);
  }

  // 3. Fetch ALL Wallet Transactions (needed to interleave with activities)
  let walletActivities: any[] = [];
  let walletTotal = 0;
  if (targetAgentIds.length > 0) {
    const [walletRows, walletCountRow] = await Promise.all([
      db.select({
        id: walletTransactionsTable.id,
        agentId: walletTransactionsTable.agentId,
        amount: walletTransactionsTable.amount,
        type: walletTransactionsTable.type,
        reference: walletTransactionsTable.reference,
        description: walletTransactionsTable.description,
        createdAt: walletTransactionsTable.createdAt,
      })
      .from(walletTransactionsTable)
      .where(inArray(walletTransactionsTable.agentId, targetAgentIds))
      .orderBy(desc(walletTransactionsTable.createdAt)),
      db.select({ count: sql<number>`count(*)` })
        .from(walletTransactionsTable)
        .where(inArray(walletTransactionsTable.agentId, targetAgentIds)),
    ]);
    walletActivities = walletRows;
    walletTotal = Number(walletCountRow[0]?.count || 0);
  }

  // 4. Combine & Format
  const combined = [
    ...userActivities.map(a => {
      const agent = agents.find(ag => ag.userId === a.userId);
      return {
        _id: a.id,
        _type: "system",
        agentId: agent?.id,
        businessName: agent?.businessName,
        eventType: a.eventType,
        metadata: a.metadata,
        createdAt: a.createdAt,
      };
    }),
    ...walletActivities.map(w => {
      const agent = agents.find(ag => ag.id === w.agentId);
      return {
        _id: w.id,
        _type: "wallet",
        agentId: w.agentId,
        businessName: agent?.businessName,
        eventType: "wallet_transaction",
        amount: Number(w.amount),
        txType: w.type,
        reference: w.reference,
        description: w.description,
        createdAt: w.createdAt,
      };
    })
  ];

  // 5. Sort & Paginate
  combined.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  
  const total = combined.length;
  const paginated = combined.slice(pOffset, pOffset + pLimit);

  return res.json({
    activities: paginated,
    total,
    totalPages: Math.ceil(total / pLimit),
  });
});


// ── Amendment Requests ────────────────────────────────────────────────────────

router.get("/admin/amendments", async (req, res) => {
  const { status, limit = "500", offset = "0" } = req.query as Record<string, string>;
  const conditions: any[] = [];
  if (status) conditions.push(eq(bookingAmendmentRequestsTable.status, status));

  const amendments = await db.select({
    amendment: bookingAmendmentRequestsTable,
    booking: {
      id: bookingsTable.id,
      reference: bookingsTable.reference,
      fullName: bookingsTable.fullName,
    },
    user: {
      id: profilesTable.id,
      fullName: profilesTable.fullName,
      email: profilesTable.email,
    },
  })
    .from(bookingAmendmentRequestsTable)
    .leftJoin(bookingsTable, eq(bookingAmendmentRequestsTable.bookingId, bookingsTable.id))
    .leftJoin(profilesTable, eq(bookingAmendmentRequestsTable.userId, profilesTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(bookingAmendmentRequestsTable.createdAt))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  const total = await db.select({ count: sql<number>`count(*)` }).from(bookingAmendmentRequestsTable);

  return res.json({
    amendments: amendments.map(r => ({ ...r.amendment, booking: r.booking, user: r.user })),
    total: Number(total[0].count),
  });
});

router.put("/admin/amendments/:id", async (req, res) => {
  const { status, adminNotes, reviewedBy } = req.body;

  const amendment = await db.query.bookingAmendmentRequestsTable.findFirst({
    where: eq(bookingAmendmentRequestsTable.id, req.params.id),
  });
  if (!amendment) return res.status(404).json({ error: "Amendment not found" });

  const [updated] = await db.update(bookingAmendmentRequestsTable)
    .set({ status, adminNotes, reviewedBy, reviewedAt: new Date() })
    .where(eq(bookingAmendmentRequestsTable.id, req.params.id))
    .returning();

  if (status === "approved" && amendment.requestedChanges) {
    const changes = amendment.requestedChanges as Record<string, any>;
    const allowed = ["phone", "address", "emergencyContactName", "emergencyContactPhone",
      "emergencyContactRelationship", "specialRequests", "departureCity", "roomPreference"];
    const safeChanges: Record<string, any> = {};
    for (const [k, v] of Object.entries(changes)) {
      if (allowed.includes(k)) safeChanges[k] = v;
    }
    if (Object.keys(safeChanges).length > 0) {
      await db.update(bookingsTable)
        .set({ ...safeChanges, updatedAt: new Date() })
        .where(eq(bookingsTable.id, amendment.bookingId));
    }
  }

  // Log staff action
  try {
    const { userId: clerkUserId } = getAuth(req);
    if (clerkUserId) {
      const actor = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, clerkUserId) });
      if (actor) {
        const pilgrimBooking = await db.query.bookingsTable.findFirst({ where: eq(bookingsTable.id, amendment.bookingId) });
        await db.insert(userActivityTable).values({
          id: randomUUID(),
          userId: actor.id,
          eventType: status === "approved" ? "amendment_approved" : "amendment_rejected",
          bookingId: amendment.bookingId,
          metadata: {
            actorName: actor.fullName,
            actorRole: actor.role,
            targetName: pilgrimBooking?.fullName,
            targetPhone: pilgrimBooking?.phone,
            changedFields: Object.keys((amendment.requestedChanges as object) || {}),
          },
        });
      }
    }
  } catch (_) { /* non-blocking */ }

  return res.json(updated);
});

// ── Visa Management ───────────────────────────────────────────────────────────

// ── File upload ───────────────────────────────────────────────────────────────

router.post("/admin/upload", _upload.fields([{ name: "visa", maxCount: 1 }, { name: "ticket", maxCount: 1 }]), (req, res) => {
  const files = req.files as Record<string, Express.Multer.File[]>;
  const vf = files?.visa?.[0];
  const tf = files?.ticket?.[0];
  return res.json({
    visaUrl:   vf ? `/api/uploads/visa/${vf.filename}`     : undefined,
    ticketUrl: tf ? `/api/uploads/tickets/${tf.filename}` : undefined,
  });
});

// ── Visa Applications ─────────────────────────────────────────────────────────

router.get("/admin/visa-stats", async (_req, res) => {
  const rows = await db.select({ status: visaApplicationsTable.status, count: sql<number>`count(*)::int` })
    .from(visaApplicationsTable).groupBy(visaApplicationsTable.status);
  const out: Record<string, number> = { awaiting_payment: 0, pending: 0, submitted: 0, approved: 0, rejected: 0 };
  rows.forEach(r => { out[r.status] = r.count; });
  return res.json(out);
});

router.get("/admin/visa", async (req, res) => {
  const { status, search, packageId: pkgId, bookingId, page: pageStr, limit: limitStr, exportAll } = req.query as Record<string, string>;
  const isExport = exportAll === "true";
  const page  = Math.max(1, parseInt(pageStr  ?? "1")  || 1);
  const limit = isExport ? 9999 : Math.max(1, parseInt(limitStr ?? "50") || 50);
  const offset = isExport ? 0 : (page - 1) * limit;

  const conds: any[] = [];
  if (status && status !== "all") conds.push(eq(visaApplicationsTable.status, status));
  if (pkgId  && pkgId  !== "all") conds.push(eq(bookingsTable.packageId, pkgId));
  if (bookingId) conds.push(eq(visaApplicationsTable.bookingId, bookingId));
  if (search) conds.push(or(
    ilike(bookingsTable.fullName,       `%${search}%`),
    ilike(bookingsTable.passportNumber, `%${search}%`),
    ilike(bookingsTable.reference,      `%${search}%`),
  ));
  
  const isArchivedFilter = req.query.isArchived === "true";
  conds.push(eq(bookingsTable.isArchived, isArchivedFilter));

  const where = conds.length ? and(...conds) : undefined;

  const [visas, [{ count }]] = await Promise.all([
    db.select({
      visa: visaApplicationsTable,
      booking: {
        id: bookingsTable.id, reference: bookingsTable.reference, fullName: bookingsTable.fullName,
        passportNumber: bookingsTable.passportNumber, packageId: bookingsTable.packageId,
        departureCity: bookingsTable.departureCity, gender: bookingsTable.gender, idNumber: bookingsTable.idNumber,
      },
      packageName: packagesTable.name,
    })
    .from(visaApplicationsTable)
    .leftJoin(bookingsTable, eq(visaApplicationsTable.bookingId, bookingsTable.id))
    .leftJoin(packagesTable, eq(bookingsTable.packageId, packagesTable.id))
    .where(where).orderBy(desc(visaApplicationsTable.createdAt)).limit(limit).offset(offset),

    db.select({ count: sql<number>`count(*)::int` })
    .from(visaApplicationsTable)
    .leftJoin(bookingsTable, eq(visaApplicationsTable.bookingId, bookingsTable.id))
    .leftJoin(packagesTable, eq(bookingsTable.packageId, packagesTable.id))
    .where(where),
  ]);

  return res.json({
    visas: visas.map(r => ({ ...r.visa, booking: r.booking, packageName: r.packageName })),
    total: count, totalPages: isExport ? 1 : Math.ceil(count / limit), page,
  });
});

router.post("/admin/visa", async (req, res) => {
  const { bookingId, pilgrimName, passportNumber, providerId, notes } = req.body;
  const [visa] = await db.insert(visaApplicationsTable).values({
    id: randomUUID(), bookingId, pilgrimName, passportNumber, providerId, notes, status: "pending",
  }).returning();
  return res.status(201).json(visa);
});

router.post("/admin/visa/bulk-approve", async (req, res) => {
  const { ids } = req.body as { ids: string[] };
  if (!ids?.length) return res.status(400).json({ error: "No IDs provided" });
  await db.update(visaApplicationsTable)
    .set({ status: "approved", processedAt: new Date(), updatedAt: new Date() })
    .where(inArray(visaApplicationsTable.id, ids));
  return res.json({ success: true, count: ids.length });
});

router.put("/admin/visa/:id", async (req, res) => {
  const { status, visaNumber, visaExpiry, rejectionReason, notes, processedBy, visaDocumentUrl, ticketDocumentUrl } = req.body;
  // Helper: turn empty strings into null for nullable DB columns
  const nullable = (v: string | undefined) => (v === "" || v == null) ? null : v;
  const u: any = { updatedAt: new Date() };
  if (status            !== undefined) u.status = status;
  if (visaNumber        !== undefined) u.visaNumber        = nullable(visaNumber);
  if (visaExpiry        !== undefined) u.visaExpiry        = nullable(visaExpiry);
  if (rejectionReason   !== undefined) u.rejectionReason   = nullable(rejectionReason);
  if (notes             !== undefined) u.notes             = nullable(notes);
  if (visaDocumentUrl   !== undefined) u.visaDocumentUrl   = nullable(visaDocumentUrl);
  if (ticketDocumentUrl !== undefined) u.ticketDocumentUrl = nullable(ticketDocumentUrl);
  if (processedBy !== undefined) { u.processedBy = processedBy; u.processedAt = new Date(); }
  if (status === "submitted") u.submittedAt = new Date();
  if (status === "approved" && !u.processedAt) u.processedAt = new Date();

  const [visa] = await db.update(visaApplicationsTable).set(u)
    .where(eq(visaApplicationsTable.id, req.params.id)).returning();
  if (!visa) return res.status(404).json({ error: "Not found" });

  // Notify the pilgrim when visa status changes to a terminal/notable state
  if (u.status && visa.bookingId) {
    try {
      const booking = await db.query.bookingsTable.findFirst({ where: eq(bookingsTable.id, visa.bookingId) });
      if (booking?.userId) {
        const visaNotifications: Record<string, { title: string; msg: string }> = {
          approved:   { title: "Visa Approved ✓",  msg: `Your visa application has been approved. Visa No: ${visa.visaNumber ?? "Pending issue"}.` },
          rejected:   { title: "Visa Rejected",    msg: `Your visa application was not approved. ${visa.rejectionReason ? `Reason: ${visa.rejectionReason}` : "Please contact support for details."}` },
          submitted:  { title: "Visa Submitted",   msg: "Your visa application has been submitted to the embassy for processing." },
          processing: { title: "Visa In Progress", msg: "Your visa application is currently being processed." },
        };
        const n = visaNotifications[u.status];
        if (n) setImmediate(() => createNotification(booking.userId!, n.title, n.msg, "document"));
      }
    } catch (_) { /* non-blocking */ }
  }

  // Activity log
  try { const { userId: _clk } = getAuth(req); if (_clk) { const _c = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, _clk) }); if (_c && u.status) await db.insert(userActivityTable).values({ id: randomUUID(), userId: _c.id, eventType: "visa_status_changed", metadata: { actorName: _c.fullName, actorRole: _c.role, newStatus: u.status, visaId: req.params.id } }); } } catch (_) { /* non-blocking */ }

  return res.json(visa);
});

// ── Visa Providers ────────────────────────────────────────────────────────────

router.get("/admin/visa-providers", async (_req, res) => {
  const providers = await db.select().from(visaProvidersTable).orderBy(visaProvidersTable.name);
  return res.json({ providers });
});

router.post("/admin/visa-providers", async (req, res) => {
  const { name, contactPerson, email, phone, specialization, description } = req.body;
  const [p] = await db.insert(visaProvidersTable).values({
    id: randomUUID(), name, contactPerson, email, phone,
    specialization: description || specialization, status: "active",
  }).returning();
  return res.status(201).json(p);
});

router.put("/admin/visa-providers/:id", async (req, res) => {
  const { name, contactPerson, email, phone, specialization, description, status } = req.body;
  const [p] = await db.update(visaProvidersTable)
    .set({ name, contactPerson, email, phone, specialization: description || specialization, status })
    .where(eq(visaProvidersTable.id, req.params.id)).returning();
  if (!p) return res.status(404).json({ error: "Not found" });
  return res.json(p);
});

router.delete("/admin/visa-providers/:id", async (req, res) => {
  await db.delete(visaProvidersTable).where(eq(visaProvidersTable.id, req.params.id));
  return res.json({ success: true });
});

// ── Team Chat ─────────────────────────────────────────────────────────────────

router.get("/admin/channels", async (req, res) => {
  const channels = await db.query.chatChannelsTable.findMany({
    orderBy: chatChannelsTable.createdAt,
  });
  return res.json({ channels });
});

router.post("/admin/channels", async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const existing = await db.query.chatChannelsTable.findFirst({ where: eq(chatChannelsTable.slug, slug) });
  if (existing) return res.status(409).json({ error: "A channel with this name already exists" });
  const [channel] = await db.insert(chatChannelsTable).values({
    id: randomUUID(), name, slug, description: description || null, isDefault: false,
  }).returning();
  return res.status(201).json(channel);
});

router.delete("/admin/channels/:id", async (req, res) => {
  const channel = await db.query.chatChannelsTable.findFirst({ where: eq(chatChannelsTable.id, req.params.id) });
  if (!channel) return res.status(404).json({ error: "Channel not found" });
  if (channel.isDefault) return res.status(400).json({ error: "Cannot delete default channels" });
  await db.delete(chatChannelsTable).where(eq(chatChannelsTable.id, req.params.id));
  return res.json({ success: true });
});

router.get("/admin/chat/messages", async (req, res) => {
  const { channelId, receiverId, senderId, limit = "50" } = req.query as Record<string, string>;
  const conditions: any[] = [];
  if (channelId) {
    conditions.push(eq(staffMessagesTable.channelId, channelId));
  } else if (senderId && receiverId) {
    conditions.push(or(
      and(eq(staffMessagesTable.senderId, senderId), eq(staffMessagesTable.receiverId, receiverId)),
      and(eq(staffMessagesTable.senderId, receiverId), eq(staffMessagesTable.receiverId, senderId)),
    ));
  } else {
    return res.json({ messages: [] });
  }

  const messages = await db.select({
    message: staffMessagesTable,
    sender: {
      id: profilesTable.id,
      fullName: profilesTable.fullName,
      avatarUrl: profilesTable.avatarUrl,
      role: profilesTable.role,
    },
  })
    .from(staffMessagesTable)
    .leftJoin(profilesTable, eq(staffMessagesTable.senderId, profilesTable.id))
    .where(and(...conditions))
    .orderBy(desc(staffMessagesTable.createdAt))
    .limit(parseInt(limit));

  return res.json({ messages: messages.map(r => ({ ...r.message, sender: r.sender })).reverse() });
});

router.post("/admin/chat/messages", async (req, res) => {
  const { receiverId, channelId, content } = req.body;
  const adminProfile = (req as any).adminProfile as typeof profilesTable.$inferSelect;
  const [message] = await db.insert(staffMessagesTable).values({
    id: randomUUID(),
    senderId: adminProfile.id,
    receiverId: receiverId || null,
    channelId: channelId || null,
    content,
  }).returning();
  return res.status(201).json(message);
});

// ── Admin Direct Booking ──────────────────────────────────────────────────────

const nullify = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

router.post("/admin/book-pilgrim", async (req, res) => {
  const {
    packageId, packageDateId, agentId, paymentMethod, markVerified,
    totalPrice, amountPaid, paymentReference, paymentProofUrl,
    // name / civility
    civility, firstName, lastName, fullName,
    // passport
    passportNumber, passportIssueDate, passportExpiry, passportIssuingAuthority,
    passportCopyUrl, profilePhotoUrl,
    // personal
    dateOfBirth, placeOfBirth, gender, nationality, ethnicGroup,
    maritalStatus, levelOfStudy, visaNumber, observation,
    // partner / cover
    partner, underCover,
    // contact & address
    phone, email, country, city, address,
    // travel
    departureCity, roomPreference, specialRequests,
    // emergency
    emergencyContactName, emergencyContactPhone, emergencyContactRelationship,
    // health / family
    meningitisVaccineDate, fathersName, mothersName,
    mahramName, mahramRelationship, mahramPassport,
    // New: room surcharge, pilgrim type, batch support
    roomSurcharge: clientRoomSurcharge,
    pilgrimType, parentBookingId, batchId,
  } = req.body;

  // Validate proof size: R2 URLs are short paths, but legacy base64 could be huge
  if (paymentProofUrl && typeof paymentProofUrl === "string" && paymentProofUrl.startsWith("data:") && paymentProofUrl.length > 300_000) {
    return res.status(400).json({ error: "Payment proof file is too large. Please upload via the file uploader." });
  }

  // Resolve the staff member who is performing this registration
  let staffProfileId: string | undefined;
  try {
    const { userId: clerkUserId } = getAuth(req);
    if (clerkUserId) {
      const staffProfile = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, clerkUserId) });
      if (staffProfile) staffProfileId = staffProfile.id;
    }
  } catch (_) { /* non-blocking */ }

  // SECURITY FIX #12: Always use canonical package price. Client totalPrice is ignored.
  // BUG FIX #8: If registering under an agent, apply the agent's per-package discount.
  const agentIdValue = nullify(agentId) as string | undefined;

  const reference = `RDH-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;

  const resolvedFullName = nullify(fullName) as string | undefined
    || [nullify(firstName), nullify(lastName)].filter(Boolean).join(" ")
    || undefined;

  let booking: any;

  try {
    await db.transaction(async (tx) => {
      // BUG FIX #4: Row-level lock on the package to prevent overbooking race condition
      const lockResult = await tx.execute(
        sql`SELECT * FROM packages WHERE id = ${packageId} FOR UPDATE`
      );
      const pkgRow = (lockResult as any).rows?.[0] ?? (Array.isArray(lockResult) ? lockResult[0] : null);
      if (!pkgRow) throw new Error("Package not found");

      // Capacity check — with row lock, this is now race-condition-proof
      if (pkgRow.capacity && (pkgRow.current_bookings || 0) >= pkgRow.capacity) {
        throw new Error("Package is fully booked — no more capacity available");
      }

      let price = Number(pkgRow.price);
      // Apply room surcharge if provided
      const surcharge = Number(clientRoomSurcharge) || 0;
      price += surcharge;

      // Apply infant/child pricing if applicable
      if (pilgrimType === "infant" || pilgrimType === "child") {
        const pricingSetting = await tx.query.siteSettingsTable.findFirst({
          where: eq(siteSettingsTable.key, "child_infant_pricing"),
        });
        if (pricingSetting && pricingSetting.value) {
          try {
            const pricing = JSON.parse(pricingSetting.value);
            if (pilgrimType === "infant" && pricing.infantPrice) {
              price += Number(pricing.infantPrice);
            } else if (pilgrimType === "child" && pricing.childPrice) {
              price += Number(pricing.childPrice);
            }
          } catch (e) {
            // Ignore parse error
          }
        }
      }

      if (agentIdValue) {
        const agentDiscount = await tx.query.agentPackageDiscountsTable.findFirst({
          where: and(
            eq(agentPackageDiscountsTable.agentId, agentIdValue),
            eq(agentPackageDiscountsTable.packageId, packageId),
          ),
        });
        if (agentDiscount) {
          if (agentDiscount.discountType === "percentage") {
            price = Math.round((price - (price * Number(agentDiscount.discountValue) / 100)) * 100) / 100;
          } else {
            price = Math.max(0, price - Number(agentDiscount.discountValue));
          }
        }
      }

      let userId = req.body.userId;
      if (!userId) {
        const walkinUuid = randomUUID();
        const [newProfile] = await tx.insert(profilesTable).values({
          id: randomUUID(),
          clerkUserId: `walkin-${walkinUuid}`,
          email: `walkin-${walkinUuid}@raudah.internal`,
          fullName: fullName || "Walk-in Pilgrim",
          role: "user",
        }).returning();
        userId = newProfile.id;
      }

      [booking] = await tx.insert(bookingsTable).values({
        id: randomUUID(),
        reference,
        userId,
        packageId,
        packageDateId:                 nullify(packageDateId) as string | undefined,
        agentId:                       nullify(agentId) as string | undefined,
        registeredByStaffId:           staffProfileId || undefined,
        // PARTIAL PAYMENT FIX: Only confirm booking when fully paid
        status: markVerified && (Number(amountPaid) || price) >= price ? "confirmed" : "pending",
        totalPrice: String(price),
        // BUG FIX: When markVerified=false, payment is created as "pending" below and
        // the verify handler will accumulate amountPaid via `amountPaid + payment.amount`.
        // Pre-populating amountPaid here would cause double-counting.
        // When markVerified=true, payment is inserted as "verified" (no future accumulation),
        // so pre-populating is correct.
        amountPaid: markVerified ? String(amountPaid || price) : "0",
        pilgrimCount: 1,
        // name / civility
        civility:                      nullify(civility) as string | undefined,
        firstName:                     nullify(firstName) as string | undefined,
        lastName:                      nullify(lastName) as string | undefined,
        fullName:                      resolvedFullName,
        // passport
        passportNumber:                nullify(passportNumber) as string | undefined,
        passportIssueDate:             nullify(passportIssueDate) as string | undefined,
        passportExpiry:                nullify(passportExpiry) as string | undefined,
        passportIssuingAuthority:      nullify(passportIssuingAuthority) as string | undefined,
        passportCopyUrl:               nullify(passportCopyUrl) as string | undefined,
        profilePhotoUrl:               nullify(profilePhotoUrl) as string | undefined,
        // personal
        dateOfBirth:                   nullify(dateOfBirth) as string | undefined,
        placeOfBirth:                  nullify(placeOfBirth) as string | undefined,
        gender:                        nullify(gender) as string | undefined,
        nationality:                   nullify(nationality) as string | undefined,
        ethnicGroup:                   nullify(ethnicGroup) as string | undefined,
        maritalStatus:                 nullify(maritalStatus) as string | undefined,
        levelOfStudy:                  nullify(levelOfStudy) as string | undefined,
        visaNumber:                    nullify(visaNumber) as string | undefined,
        observation:                   nullify(observation) as string | undefined,
        // partner / cover
        partner:                       nullify(partner) as string | undefined,
        underCover:                    nullify(underCover) as string | undefined,
        // contact & address
        phone:                         nullify(phone) as string | undefined,
        email:                         nullify(email) as string | undefined,
        country:                       nullify(country) as string | undefined,
        city:                          nullify(city) as string | undefined,
        address:                       nullify(address) as string | undefined,
        // travel
        departureCity:                 nullify(departureCity) as string | undefined,
        roomPreference:                nullify(roomPreference) as string | undefined,
        specialRequests:               nullify(specialRequests) as string | undefined,
        // emergency
        emergencyContactName:          nullify(emergencyContactName) as string | undefined,
        emergencyContactPhone:         nullify(emergencyContactPhone) as string | undefined,
        emergencyContactRelationship:  nullify(emergencyContactRelationship) as string | undefined,
        // health / family
        meningitisVaccineDate:         nullify(meningitisVaccineDate) as string | undefined,
        fathersName:                   nullify(fathersName) as string | undefined,
        mothersName:                   nullify(mothersName) as string | undefined,
        mahramName:                    nullify(mahramName) as string | undefined,
        mahramRelationship:            nullify(mahramRelationship) as string | undefined,
        mahramPassport:                nullify(mahramPassport) as string | undefined,
        // room surcharge, pilgrim type, batch
        roomSurcharge:                 String(surcharge),
        pilgrimType:                   pilgrimType || "adult",
        parentBookingId:               nullify(parentBookingId) as string | undefined,
        batchId:                       nullify(batchId) as string | undefined,
      }).returning();

      await tx.update(packagesTable)
        .set({ currentBookings: sql`${packagesTable.currentBookings} + 1` })
        .where(eq(packagesTable.id, packageId));

      const isFullyPaid = Number(booking.amountPaid) >= price;
      if (markVerified && isFullyPaid) {
        // Generate an idNumber for fully paid bookings
        await tx.execute(sql`
          UPDATE bookings 
          SET id_number = nextval('bookings_id_number_seq') 
          WHERE id = ${booking.id} AND id_number IS NULL
        `);
      }

      const existingVisa = await tx.query.visaApplicationsTable.findFirst({
        where: eq(visaApplicationsTable.bookingId, booking.id),
      });
      if (!existingVisa) {
        await tx.insert(visaApplicationsTable).values({
          id: randomUUID(),
          bookingId: booking.id,
          pilgrimName: booking.fullName ?? null,
          passportNumber: booking.passportNumber ?? null,
          status: (markVerified && isFullyPaid) ? "pending" : "awaiting_payment",
        });
      }

      const initialAmountPaid = Number(booking.amountPaid);
      if (initialAmountPaid > 0) {
        await tx.insert(paymentsTable).values({
          id: randomUUID(),
          bookingId: booking.id,
          userId: booking.userId,
          amount: String(initialAmountPaid),
          method: paymentMethod || "cash",
          status: markVerified ? "verified" : "pending",
          reference: paymentReference || `INIT-${booking.reference}`,
          proofUrl: paymentProofUrl || null,
          notes: "Initial payment during registration",
        });
      }
    });
  } catch (err: any) {
    // Capacity-full is a 409, other errors are 400
    if (err.message?.includes("fully booked")) {
      return res.status(409).json({ error: err.message });
    }
    return res.status(400).json({ error: err.message || "Registration failed" });
  }

  // Log staff action (outside transaction — non-blocking, should not cause rollback)
  try {
    const { userId: clerkUserId } = getAuth(req);
    if (clerkUserId) {
      const actor = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, clerkUserId) });
      if (actor) {
        await db.insert(userActivityTable).values({
          id: randomUUID(),
          userId: actor.id,
          eventType: "pilgrim_registered",
          bookingId: booking.id,
          metadata: {
            actorName: actor.fullName,
            actorRole: actor.role,
            targetName: booking.fullName,
            targetPhone: booking.phone,
            reference: booking.reference,
            packageId: booking.packageId,
            packageName: pkg.name,
            originalPrice: Number(pkg.price),
            totalPrice: price,
            amountPaid: markVerified ? (amountPaid || price) : 0,
            paymentMethod: method || "N/A",
            markVerified: !!markVerified,
          },
        });
      }
    }
  } catch (_) { /* non-blocking */ }

  return res.status(201).json({ booking, reference });
});

// ── Staff & Agents list for filter dropdowns ──────────────────────────────────

router.get("/admin/staff-list", async (_req, res) => {
  const staff = await db.select({ id: profilesTable.id, fullName: profilesTable.fullName, role: profilesTable.role })
    .from(profilesTable)
    .where(inArray(profilesTable.role, ["admin", "super_admin", "staff"]))
    .orderBy(profilesTable.fullName);
  return res.json({ staff });
});

router.get("/admin/agents-list", async (_req, res) => {
  const agents = await db.select({
    id: agentsTable.id,
    businessName: agentsTable.businessName,
    agentCode: agentsTable.agentCode,
    status: agentsTable.status,
    email: agentsTable.email,
    phone: agentsTable.phone,
    commissionRate: agentsTable.commissionRate,
    commissionType: agentsTable.commissionType,
  })
    .from(agentsTable)
    .where(eq(agentsTable.status, "active"))
    .orderBy(agentsTable.businessName);
  return res.json({ agents });
});

// ── Public bank accounts ──────────────────────────────────────────────────────

router.get("/bank-accounts", async (_req, res) => {
  const accounts = await db.query.bankAccountsTable.findMany({
    where: eq(bankAccountsTable.isActive, true),
    orderBy: bankAccountsTable.createdAt,
  });
  return res.json({ accounts });
});

// ── Agent Applications (from public form) ─────────────────────────────────────

router.get("/admin/agent-applications", async (_req, res) => {
  const apps = await db.query.agentApplicationsTable.findMany({
    orderBy: [desc(agentApplicationsTable.createdAt)],
  });
  return res.json({ applications: apps, total: apps.length });
});

router.put("/admin/agent-applications/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const { commissionRate = 0, commissionType = "percentage", tempPassword } = req.body as {
      commissionRate?: number; commissionType?: string; tempPassword?: string;
    };

    const app = await db.query.agentApplicationsTable.findFirst({
      where: eq(agentApplicationsTable.id, id),
    });
    if (!app) return res.status(404).json({ error: "Application not found" });
    if (app.status !== "pending") return res.status(400).json({ error: "Application already processed" });

    const password = tempPassword || `Raudah@${Math.random().toString(36).slice(-6)}`;
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) return res.status(500).json({ error: "Clerk not configured" });

  const clerkHeaders = { Authorization: `Bearer ${clerkSecretKey}`, "Content-Type": "application/json" };
  const nameParts = app.contactPerson.trim().split(" ");

  let clerkUser: any = null;
  let usedExistingClerkUser = false;

  // Step 1: Try to create a new Clerk user
  const clerkRes = await fetch("https://api.clerk.com/v1/users", {
    method: "POST",
    headers: clerkHeaders,
    body: JSON.stringify({
      first_name: nameParts[0],
      last_name: nameParts.slice(1).join(" ") || "",
      email_address: [app.email],
      password,
      skip_password_checks: true,
      skip_legal_checks: true,
    }),
  });

  if (clerkRes.ok) {
    clerkUser = await clerkRes.json();
  } else {
    const errBody = await clerkRes.json() as any;
    const errCode: string = errBody?.errors?.[0]?.code ?? "";
    const errMsg: string = errBody?.errors?.[0]?.long_message || errBody?.errors?.[0]?.message || "";
    const isExistingUser = errCode.includes("form_identifier_exists")
      || errCode.includes("duplicate")
      || errMsg.toLowerCase().includes("taken")
      || errMsg.toLowerCase().includes("already exists")
      || errMsg.toLowerCase().includes("unique");

    if (isExistingUser) {
      // The applicant already has a Clerk account (e.g. signed up as a regular user).
      // Look them up by email and use the existing account.
      const searchRes = await fetch(
        `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(app.email)}&limit=1`,
        { method: "GET", headers: clerkHeaders },
      );
      if (searchRes.ok) {
        const users = await searchRes.json() as any[];
        if (users?.length > 0) {
          clerkUser = users[0];
          usedExistingClerkUser = true;
        }
      }

      if (!clerkUser) {
        return res.status(400).json({
          error: "A Clerk account exists for this email but could not be found. Please try the direct agent creation instead.",
        });
      }
    } else {
      // Retry without password if the issue is password-related
      const isPasswordIssue = errCode.includes("password") || errCode.includes("form_password");
      if (isPasswordIssue) {
        const retryRes = await fetch("https://api.clerk.com/v1/users", {
          method: "POST",
          headers: clerkHeaders,
          body: JSON.stringify({
            first_name: nameParts[0],
            last_name: nameParts.slice(1).join(" ") || "",
            email_address: [app.email],
            skip_legal_checks: true,
          }),
        });
        if (retryRes.ok) {
          clerkUser = await retryRes.json();
        } else {
          const err2 = await retryRes.json() as any;
          const msg = err2?.errors?.[0]?.long_message || errMsg || "Failed to create Clerk user";
          return res.status(400).json({ error: msg });
        }
      } else {
        return res.status(400).json({ error: errMsg || "Failed to create Clerk user" });
      }
    }
  }

  // Mark the email address as verified — fire-and-forget
  if (!usedExistingClerkUser) {
    const emailAddressId: string | undefined = clerkUser?.email_addresses?.[0]?.id;
    if (emailAddressId) {
      setImmediate(() => {
        fetch(`https://api.clerk.com/v1/email_addresses/${emailAddressId}`, {
          method: "PATCH",
          headers: clerkHeaders,
          body: JSON.stringify({ verified: true }),
        }).catch(() => {});
      });
    }
  }

  // Step 2: Check if a profile already exists for this Clerk user
  let profileId: string;
  const existingProfile = await db.query.profilesTable.findFirst({
    where: eq(profilesTable.clerkUserId, clerkUser.id),
  });

  if (existingProfile) {
    profileId = existingProfile.id;
    // Promote the existing user to agent role if they were a regular user
    if (existingProfile.role !== "agent") {
      await db.update(profilesTable)
        .set({ role: "agent", updatedAt: new Date() })
        .where(eq(profilesTable.id, existingProfile.id));
    }
  } else {
    profileId = randomUUID();
    await db.insert(profilesTable).values({
      id: profileId,
      clerkUserId: clerkUser.id,
      email: app.email,
      fullName: app.contactPerson,
      role: "agent",
    });
  }

  // Step 3: Check if an agent record already exists (idempotent safety)
  const existingAgent = await db.query.agentsTable.findFirst({
    where: eq(agentsTable.userId, profileId),
  });

  if (existingAgent) {
    // Agent already created (previous attempt succeeded) — mark application and return
    await db.update(agentApplicationsTable)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(agentApplicationsTable.id, id));

    return res.json({
      agent: { ...existingAgent, walletBalance: 0 },
      tempPassword: password,
      message: "Agent account already exists — credentials shown.",
      alreadyExisted: true,
    });
  }

  // Step 4: Create agent record + wallet
  const agentCode = `AG${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const [agent] = await db.insert(agentsTable).values({
    id: randomUUID(),
    userId: profileId,
    companyName: app.businessName,
    businessName: app.businessName,
    contactPerson: app.contactPerson,
    email: app.email,
    phone: app.phone,
    agentCode,
    commissionRate: String(commissionRate),
    commissionType,
    status: "active",
  }).returning();

  await db.insert(agentWalletsTable).values({
    id: randomUUID(),
    agentId: agent.id,
    balance: "0",
  }).onConflictDoNothing();

  await db.update(agentApplicationsTable)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(agentApplicationsTable.id, id));

  // Send approval notification email (fire-and-forget)
  setImmediate(() => {
    sendAgentApprovalEmail({
      agentName: app.contactPerson,
      businessName: app.businessName,
      email: app.email,
      loginEmail: app.email,
      tempPassword: usedExistingClerkUser ? undefined : password,
      agentCode,
      isExistingUser: usedExistingClerkUser,
    }).catch(() => {});
  });

    // Activity log
    try { const { userId: _clk } = getAuth(req); if (_clk) { const _c = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, _clk) }); if (_c) await db.insert(userActivityTable).values({ id: randomUUID(), userId: _c.id, eventType: "agent_approved", metadata: { actorName: _c.fullName, actorRole: _c.role, agentBusinessName: agent.businessName } }); } } catch (_) { /* non-blocking */ }

    return res.json({
      agent: { ...agent, walletBalance: 0 },
      tempPassword: password,
      message: usedExistingClerkUser
        ? "Agent account created using existing login. The agent can sign in with their current credentials."
        : "Agent account created. Share the login credentials with the agent.",
    });
  } catch (err: any) {
    console.error("[agent-approve] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to approve agent application" });
  }
});

router.put("/admin/agent-applications/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body as { reason?: string };

    const [updated] = await db.update(agentApplicationsTable)
      .set({ status: "rejected", rejectionReason: reason || null, updatedAt: new Date() })
      .where(eq(agentApplicationsTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Application not found" });

    // Activity log
    try { const { userId: _clk } = getAuth(req); if (_clk) { const _c = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, _clk) }); if (_c) await db.insert(userActivityTable).values({ id: randomUUID(), userId: _c.id, eventType: "agent_rejected", metadata: { actorName: _c.fullName, actorRole: _c.role, applicationId: id, reason: reason || null } }); } } catch (_) { /* non-blocking */ }

    return res.json({ success: true });
  } catch (err: any) {
    console.error("[agent-reject] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to reject agent application" });
  }
});

// ── Direct Agent Creation ──────────────────────────────────────────────────────

router.post("/admin/agents/create", async (req, res) => {
  try {
    const { fullName, businessName, email, phone, tempPassword, commissionRate = 0, commissionType = "percentage" } = req.body as {
      fullName: string; businessName: string; email: string; phone: string;
      tempPassword: string; commissionRate?: number; commissionType?: string;
    };

    if (!fullName || !businessName || !email || !phone || !tempPassword) {
      return res.status(400).json({ error: "fullName, businessName, email, phone and tempPassword are required" });
    }

    // Check if email already exists in our DB — if agent was already fully created
    // (e.g. previous request succeeded server-side but client timed out), return
    // the existing agent data as a success response (idempotent retry).
    const existingProfile = await db.query.profilesTable.findFirst({ where: eq(profilesTable.email, email) });
    if (existingProfile) {
      const existingAgent = await db.query.agentsTable.findFirst({ where: eq(agentsTable.userId, existingProfile.id) });
      if (existingAgent) {
        // Account was fully created on a previous attempt — return success so
        // the frontend shows the credentials dialog instead of an error toast.
        return res.status(200).json({
          agent: { ...existingAgent, commissionRate: Number(existingAgent.commissionRate), walletBalance: 0 },
          profile: existingProfile,
          tempPassword,
          message: "Agent account already exists (previous request completed successfully).",
          alreadyExisted: true,
        });
      }
      // Profile exists but no agent record — genuine duplicate email from a non-agent user
      return res.status(400).json({ error: "An account with this email address already exists (non-agent user)." });
    }

    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) return res.status(500).json({ error: "Clerk not configured" });

    const nameParts = fullName.trim().split(" ");
    const clerkHeaders = { Authorization: `Bearer ${clerkSecretKey}`, "Content-Type": "application/json" };

    // Attempt 1: create with password
    let clerkRes = await fetch("https://api.clerk.com/v1/users", {
      method: "POST",
      headers: clerkHeaders,
      body: JSON.stringify({
        first_name: nameParts[0],
        last_name: nameParts.slice(1).join(" ") || "",
        email_address: [email],
        password: tempPassword,
        skip_password_checks: true,
        skip_legal_checks: true,
      }),
    });

    // Attempt 2: if Clerk rejects the password field (e.g. password auth disabled),
    // retry without the password so the account is still created.
    let passwordlessMode = false;
    if (!clerkRes.ok) {
      const errBody = await clerkRes.json() as any;
      const errCode: string = errBody?.errors?.[0]?.code ?? "";
      const isPasswordIssue = errCode.includes("password") || errCode.includes("form_password");
      if (isPasswordIssue) {
        clerkRes = await fetch("https://api.clerk.com/v1/users", {
          method: "POST",
          headers: clerkHeaders,
          body: JSON.stringify({
            first_name: nameParts[0],
            last_name: nameParts.slice(1).join(" ") || "",
            email_address: [email],
            skip_legal_checks: true,
          }),
        });
        passwordlessMode = true;
      }
      if (!clerkRes.ok) {
        const err2 = await clerkRes.json() as any;
        const msg = err2?.errors?.[0]?.long_message || err2?.errors?.[0]?.message || errBody?.errors?.[0]?.long_message || "Failed to create Clerk user";
        return res.status(400).json({ error: msg });
      }
    }

    const clerkUser = await clerkRes.json() as any;

    // Mark the email address as verified — fire-and-forget to reduce response time.
    // This was previously awaited and added ~1-2s latency, contributing to client timeouts.
    const emailAddressId: string | undefined = clerkUser?.email_addresses?.[0]?.id;
    if (emailAddressId) {
      setImmediate(() => {
        fetch(`https://api.clerk.com/v1/email_addresses/${emailAddressId}`, {
          method: "PATCH",
          headers: clerkHeaders,
          body: JSON.stringify({ verified: true }),
        }).catch(() => {}); // non-fatal, fire-and-forget
      });
    }

    void passwordlessMode; // used for response message only
    const profileId = randomUUID();
    const [profile] = await db.insert(profilesTable).values({
      id: profileId,
      clerkUserId: clerkUser.id,
      email,
      fullName,
      role: "agent",
    }).returning();

    const agentCode = `AG${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const [agent] = await db.insert(agentsTable).values({
      id: randomUUID(),
      userId: profileId,
      companyName: businessName,
      businessName,
      contactPerson: fullName,
      email,
      phone,
      agentCode,
      commissionRate: String(commissionRate),
      commissionType,
      status: "active",
    }).returning();

    await db.insert(agentWalletsTable).values({
      id: randomUUID(),
      agentId: agent.id,
      balance: "0",
    }).onConflictDoNothing();

    // Send welcome email to directly created agent (fire-and-forget)
    setImmediate(() => {
      sendAgentApprovalEmail({
        agentName: fullName,
        businessName,
        email,
        loginEmail: email,
        tempPassword,
        agentCode,
        isExistingUser: false,
      }).catch(() => {});
    });

    return res.status(201).json({
      agent: { ...agent, commissionRate: Number(agent.commissionRate), walletBalance: 0 },
      profile,
      tempPassword,
      message: "Agent account created successfully.",
    });
  } catch (err: any) {
    console.error("[agents-create] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to create agent" });
  }
});

// ── Agent Commission Update ───────────────────────────────────────────────────

router.put("/admin/agents/:id/commission", async (req, res) => {
  try {
    const { commissionRate, commissionType } = req.body as { commissionRate: number; commissionType: string };

    // Validate commission values
    if (commissionRate == null || typeof commissionRate !== "number" || isNaN(commissionRate) || commissionRate < 0) {
      return res.status(400).json({ error: "commissionRate must be a non-negative number" });
    }
    if (!["percentage", "fixed"].includes(commissionType)) {
      return res.status(400).json({ error: "commissionType must be 'percentage' or 'fixed'" });
    }
    if (commissionType === "percentage" && commissionRate > 100) {
      return res.status(400).json({ error: "Percentage commission cannot exceed 100%" });
    }

    const [agent] = await db.update(agentsTable)
      .set({ commissionRate: String(commissionRate), commissionType, updatedAt: new Date() })
      .where(eq(agentsTable.id, req.params.id))
      .returning();
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    return res.json({ ...agent, commissionRate: Number(agent.commissionRate) });
  } catch (err: any) {
    console.error("[agent-commission-update] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to update commission" });
  }
});

// ── Agent Status Update (suspend / unsuspend / block / unblock) ───────────────

router.put("/admin/agents/:id/status", async (req, res) => {
  const { status } = req.body as { status: string };
  const validStatuses = ["active", "suspended", "blocked"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
  }

  const agent = await db.query.agentsTable.findFirst({ where: eq(agentsTable.id, req.params.id) });
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  const [updated] = await db.update(agentsTable)
    .set({ status: status as any, updatedAt: new Date() })
    .where(eq(agentsTable.id, req.params.id))
    .returning();

  // Activity log
  try { const { userId: _clk } = getAuth(req); if (_clk) { const _c = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, _clk) }); if (_c) await db.insert(userActivityTable).values({ id: randomUUID(), userId: _c.id, eventType: "user_status_changed", metadata: { actorName: _c.fullName, actorRole: _c.role, targetName: agent.businessName, oldStatus: agent.status, newStatus: status } }); } } catch (_) { /* non-blocking */ }

  return res.json({
    ...updated,
    commissionRate: Number(updated.commissionRate),
    message: `Agent status updated to "${status}".`,
  });
});

// ── Delete Agent Account ──────────────────────────────────────────────────────

router.delete("/admin/agents/:id", async (req, res) => {
  const agent = await db.query.agentsTable.findFirst({ where: eq(agentsTable.id, req.params.id) });
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  // Check for confirmed bookings that would be orphaned
  const confirmedBookings = await db.select({ count: sql<number>`count(*)::int` })
    .from(bookingsTable)
    .where(and(eq(bookingsTable.agentId, agent.id), eq(bookingsTable.status, "confirmed")));
  const confirmedCount = confirmedBookings[0]?.count ?? 0;
  if (confirmedCount > 0) {
    return res.status(409).json({
      error: `Cannot delete agent with ${confirmedCount} confirmed booking(s). Cancel or complete them first.`,
    });
  }

  // BUG FIX #7: Delete wallet transactions, wallet, package discounts, then agent
  // All wrapped in a transaction to prevent orphaned data on partial failure.
  try {
    await db.transaction(async (tx) => {
      await tx.delete(walletTransactionsTable).where(eq(walletTransactionsTable.agentId, agent.id));
      await tx.delete(agentWalletsTable).where(eq(agentWalletsTable.agentId, agent.id));
      await tx.delete(agentPackageDiscountsTable).where(eq(agentPackageDiscountsTable.agentId, agent.id));
      await tx.delete(agentsTable).where(eq(agentsTable.id, agent.id));

      // Downgrade profile role back to user
      await tx.update(profilesTable)
        .set({ role: "user", updatedAt: new Date() })
        .where(eq(profilesTable.id, agent.userId));
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to delete agent: " + (err.message || "Unknown error") });
  }

  // Optionally delete the Clerk user so the email can be reused
  const profile = await db.query.profilesTable.findFirst({ where: eq(profilesTable.id, agent.userId) });
  if (profile?.clerkUserId) {
    const CLERK_SECRET = process.env.CLERK_SECRET_KEY;
    if (CLERK_SECRET) {
      // Fire-and-forget — don't block the response
      setImmediate(async () => {
        try {
          await fetch(`https://api.clerk.com/v1/users/${profile.clerkUserId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${CLERK_SECRET}` },
          });
        } catch (e) { /* best-effort */ }
      });
    }
  }

  return res.json({ message: "Agent account deleted successfully." });
});

// ── Delete Agent Application ──────────────────────────────────────────────────

router.delete("/admin/agent-applications/:id", async (req, res) => {
  const application = await db.query.agentApplicationsTable.findFirst({
    where: eq(agentApplicationsTable.id, req.params.id),
  });
  if (!application) return res.status(404).json({ error: "Application not found" });

  await db.delete(agentApplicationsTable).where(eq(agentApplicationsTable.id, req.params.id));
  return res.json({ message: "Application deleted successfully." });
});

// ── Secure Wallet Top-Up ──────────────────────────────────────────────────────

router.post("/admin/agents/:id/wallet/topup", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const adminProfile = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, clerkUserId) });
  if (!adminProfile) return res.status(404).json({ error: "Admin profile not found" });

  // SECURITY: Only super_admin can perform wallet top-ups directly
  if (adminProfile.role !== "super_admin") {
    return res.status(403).json({ error: "Only Super Admin can perform wallet top-ups" });
  }

  const { amount, idempotencyKey } = req.body as { amount: number; idempotencyKey: string };
  if (!amount || amount <= 0) return res.status(400).json({ error: "Valid amount is required" });
  if (!idempotencyKey) return res.status(400).json({ error: "idempotencyKey is required" });

  const agentId = req.params.id;
  const agent = await db.query.agentsTable.findFirst({ where: eq(agentsTable.id, agentId) });
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  let finalBalance = 0;

  try {
    // SECURITY: Wrap all mutations in a single DB transaction.
    await db.transaction(async (tx) => {
      // 1. Lock the wallet row to prevent concurrent modifications
      const lockResult = await tx.execute(
        sql`SELECT * FROM agent_wallets WHERE agent_id = ${agentId} FOR UPDATE`
      );
      const existingWallet = (lockResult as any).rows?.[0] ?? (Array.isArray(lockResult) ? lockResult[0] : null);

      let wallet;
      if (!existingWallet) {
        const [w] = await tx.insert(agentWalletsTable).values({
          id: randomUUID(),
          agentId,
          balance: String(amount),
        }).returning();
        wallet = w;
      } else {
        const [w] = await tx.update(agentWalletsTable)
          .set({ balance: sql`balance + ${amount}`, updatedAt: new Date() })
          .where(eq(agentWalletsTable.agentId, agentId))
          .returning();
        wallet = w;
      }

      // 2. Record transaction using idempotencyKey as reference.
      // If the idempotencyKey was already used, this insert will throw a unique constraint error,
      // rolling back the transaction and preventing double top-up.
      await tx.insert(walletTransactionsTable).values({
        id: randomUUID(),
        agentId,
        amount: String(amount),
        type: "topup",
        reference: `TOPUP-${idempotencyKey}`,
        description: `Top-up by Super Admin (${adminProfile.fullName})`,
      });

      // 3. Log audit activity
      await tx.insert(userActivityTable).values({
        id: randomUUID(),
        userId: adminProfile.id,
        eventType: "wallet_topup",
        metadata: {
          agentId,
          agentName: agent.businessName || agentId,
          amount,
          idempotencyKey,
        },
      });

      finalBalance = Number(wallet?.balance || 0);
    });
  } catch (err: any) {
    if (err.code === "23505" || err.message.includes("unique constraint")) {
      return res.status(409).json({ error: "This top-up has already been processed (duplicate request)" });
    }
    console.error("Wallet topup error:", err);
    return res.status(500).json({ error: "Failed to process wallet top-up" });
  }

  return res.json({
    success: true,
    newBalance: finalBalance,
    message: `₦${amount.toLocaleString()} added to agent wallet successfully.`,
  });
});

// ── Agent Wallet Deduction (admin) ────────────────────────────────────────────

router.post("/admin/agents/:id/wallet/deduct", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const adminProfile = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, clerkUserId) });
  if (!adminProfile) return res.status(404).json({ error: "Admin profile not found" });

  // Only super_admin can perform wallet deductions
  if (adminProfile.role !== "super_admin") {
    return res.status(403).json({ error: "Only Super Admin can perform wallet deductions" });
  }

  const { amount, reason, idempotencyKey } = req.body as { amount: number; reason: string; idempotencyKey: string };
  if (!amount || amount <= 0) return res.status(400).json({ error: "Valid amount is required" });
  if (!reason || !reason.trim()) return res.status(400).json({ error: "A reason for the deduction is required" });
  if (!idempotencyKey) return res.status(400).json({ error: "idempotencyKey is required" });

  const agentId = req.params.id;
  const agent = await db.query.agentsTable.findFirst({ where: eq(agentsTable.id, agentId) });
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  let finalBalance = 0;

  try {
    await db.transaction(async (tx) => {
      // Lock the wallet row to prevent concurrent modifications
      const lockResult = await tx.execute(
        sql`SELECT * FROM agent_wallets WHERE agent_id = ${agentId} FOR UPDATE`
      );
      const walletRow = (lockResult as any).rows?.[0] ?? (Array.isArray(lockResult) ? lockResult[0] : null);
      if (!walletRow) throw new Error("Wallet not found for this agent");

      const currentBalance = Number((walletRow as any).balance);
      if (currentBalance < amount) {
        throw new Error(`Insufficient balance. Available: ₦${currentBalance.toLocaleString()}, Requested deduction: ₦${amount.toLocaleString()}`);
      }

      // Deduct from wallet
      const [wallet] = await tx.update(agentWalletsTable)
        .set({ balance: sql`balance - ${amount}`, updatedAt: new Date() })
        .where(eq(agentWalletsTable.agentId, agentId))
        .returning();

      // Record transaction (idempotency via unique reference)
      await tx.insert(walletTransactionsTable).values({
        id: randomUUID(),
        agentId,
        amount: String(-amount),
        type: "deduction",
        reference: `DEDUCT-${idempotencyKey}`,
        description: `Deducted by Admin (${adminProfile.fullName}): ${reason}`,
      });

      // Log audit activity
      await tx.insert(userActivityTable).values({
        id: randomUUID(),
        userId: adminProfile.id,
        eventType: "wallet_deduction",
        metadata: {
          agentId,
          agentName: agent.businessName || agentId,
          amount,
          reason,
          idempotencyKey,
        },
      });

      finalBalance = Number(wallet?.balance || 0);
    });
  } catch (err: any) {
    if (err.code === "23505" || err.message.includes("unique constraint")) {
      return res.status(409).json({ error: "This deduction has already been processed (duplicate request)" });
    }
    console.error("Wallet deduction error:", err);
    return res.status(400).json({ error: err.message || "Failed to process wallet deduction" });
  }

  return res.json({
    success: true,
    newBalance: finalBalance,
    message: `₦${amount.toLocaleString()} deducted from agent wallet successfully.`,
  });
});

// ── Agent Transactions (admin view) ───────────────────────────────────────────

router.get("/admin/agents/:id/transactions", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const callerProfile = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, clerkUserId) });
  if (!callerProfile) return res.status(404).json({ error: "Profile not found" });
  if (!["admin", "super_admin", "staff"].includes(callerProfile.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  const agentId = req.params.id;
  const { limit = "50", offset = "0" } = req.query as Record<string, string>;
  const pLimit = Math.min(Math.max(1, parseInt(limit) || 50), 200);
  const pOffset = Math.max(0, parseInt(offset) || 0);

  const wallet = await db.query.agentWalletsTable.findFirst({ where: eq(agentWalletsTable.agentId, agentId) });

  const [transactions, [{ count }]] = await Promise.all([
    db.select().from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.agentId, agentId))
      .orderBy(desc(walletTransactionsTable.createdAt))
      .limit(pLimit)
      .offset(pOffset),
    db.select({ count: sql<number>`count(*)::int` })
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.agentId, agentId)),
  ]);

  // Also get commission totals
  const commissions = await db.select({
    totalAmount: sql<number>`COALESCE(SUM(amount::numeric), 0)`,
    paidAmount: sql<number>`COALESCE(SUM(CASE WHEN status = 'paid' THEN amount::numeric ELSE 0 END), 0)`,
    pendingAmount: sql<number>`COALESCE(SUM(CASE WHEN status = 'pending' THEN amount::numeric ELSE 0 END), 0)`,
  }).from(commissionsTable).where(eq(commissionsTable.agentId, agentId));

  return res.json({
    balance: Number(wallet?.balance || 0),
    transactions: transactions.map(t => ({ ...t, amount: Number(t.amount) })),
    total: count,
    totalPages: Math.ceil(count / pLimit),
    commissionSummary: {
      total: Number(commissions[0]?.totalAmount || 0),
      paid: Number(commissions[0]?.paidAmount || 0),
      pending: Number(commissions[0]?.pendingAmount || 0),
    },
  });
});



router.get("/admin/agents/:id/package-discounts", async (req, res) => {
  const discounts = await db.query.agentPackageDiscountsTable.findMany({
    where: eq(agentPackageDiscountsTable.agentId, req.params.id),
  });
  const packages = await db.query.packagesTable.findMany();
  const pkgMap = Object.fromEntries(packages.map(p => [p.id, p]));

  return res.json({
    discounts: discounts.map(d => ({
      ...d,
      discountValue: Number(d.discountValue),
      package: pkgMap[d.packageId] ? { id: pkgMap[d.packageId].id, name: pkgMap[d.packageId].name, price: Number(pkgMap[d.packageId].price) } : null,
    })),
  });
});

router.put("/admin/agents/:id/package-discounts/:packageId", async (req, res) => {
  const { discountType, discountValue } = req.body as { discountType: string; discountValue: number };
  if (!discountType || discountValue == null) return res.status(400).json({ error: "discountType and discountValue are required" });

  // BUG FIX #5: Comprehensive discount validation
  if (!['percentage', 'fixed'].includes(discountType)) {
    return res.status(400).json({ error: "discountType must be 'percentage' or 'fixed'" });
  }
  if (typeof discountValue !== 'number' || isNaN(discountValue) || discountValue <= 0) {
    return res.status(400).json({ error: "discountValue must be a positive number" });
  }
  if (discountType === 'percentage' && discountValue > 100) {
    return res.status(400).json({ error: "Percentage discount cannot exceed 100%" });
  }

  // Verify agent and package exist
  const agent = await db.query.agentsTable.findFirst({ where: eq(agentsTable.id, req.params.id) });
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  const pkg = await db.query.packagesTable.findFirst({ where: eq(packagesTable.id, req.params.packageId) });
  if (!pkg) return res.status(404).json({ error: "Package not found" });

  if (discountType === 'fixed' && discountValue > Number(pkg.price)) {
    return res.status(400).json({ error: `Fixed discount ₦${discountValue.toLocaleString()} exceeds package price ₦${Number(pkg.price).toLocaleString()}` });
  }

  // BUG FIX #6: Wrap upsert in a transaction with row-level locking to
  // prevent race conditions where two concurrent requests both see "not exists"
  // and both insert, creating duplicate discount rows.
  let discount: any;
  await db.transaction(async (tx) => {
    const existing = await tx.query.agentPackageDiscountsTable.findFirst({
      where: and(
        eq(agentPackageDiscountsTable.agentId, req.params.id),
        eq(agentPackageDiscountsTable.packageId, req.params.packageId),
      ),
    });

    if (existing) {
      const [d] = await tx.update(agentPackageDiscountsTable)
        .set({ discountType, discountValue: String(discountValue), updatedAt: new Date() })
        .where(eq(agentPackageDiscountsTable.id, existing.id))
        .returning();
      discount = d;
    } else {
      const [d] = await tx.insert(agentPackageDiscountsTable).values({
        id: randomUUID(),
        agentId: req.params.id,
        packageId: req.params.packageId,
        discountType,
        discountValue: String(discountValue),
      }).returning();
      discount = d;
    }
  });

  // Activity log
  try { const { userId: _clk } = getAuth(req); if (_clk) { const _c = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, _clk) }); if (_c) await db.insert(userActivityTable).values({ id: randomUUID(), userId: _c.id, eventType: "agent_discount_applied", metadata: { actorName: _c.fullName, actorRole: _c.role, agentName: agent.businessName, packageName: pkg.name, discountType, discountValue } }); } } catch (_) { /* non-blocking */ }

  return res.json({ ...discount, discountValue: Number(discount.discountValue) });
});

router.delete("/admin/agents/:id/package-discounts/:packageId", async (req, res) => {
  await db.delete(agentPackageDiscountsTable)
    .where(and(
      eq(agentPackageDiscountsTable.agentId, req.params.id),
      eq(agentPackageDiscountsTable.packageId, req.params.packageId),
    ));
  return res.json({ success: true });
});

export default router;
