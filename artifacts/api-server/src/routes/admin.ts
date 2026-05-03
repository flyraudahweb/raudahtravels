import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { sendEmail } from "../utils/email.js";
import { createNotification } from "../utils/notify.js";

import {
  profilesTable, staffPermissionsTable, bookingsTable, paymentsTable,
  packagesTable, agentsTable, supportTicketsTable, bankAccountsTable,
  siteSettingsTable, bookingFormFieldsTable, userActivityTable,
  bookingAmendmentRequestsTable, staffMessagesTable, chatChannelsTable,
  visaApplicationsTable, visaProvidersTable,
  staffSupportSpecialtiesTable, agentApplicationsTable,
  agentPackageDiscountsTable, agentWalletsTable, walletTransactionsTable,
  adminOtpRequestsTable, contactMessagesTable,
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
    },
    user: {
      id: profilesTable.id,
      fullName: profilesTable.fullName,
      email: profilesTable.email,
      phone: profilesTable.phone,
      avatarUrl: profilesTable.avatarUrl,
    },
    agentBusinessName: agentsTable.businessName,
  })
    .from(bookingsTable)
    .leftJoin(packagesTable, eq(bookingsTable.packageId, packagesTable.id))
    .leftJoin(profilesTable, eq(bookingsTable.userId, profilesTable.id))
    .leftJoin(agentsTable, eq(bookingsTable.agentId, agentsTable.id))
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

  const {
    paymentStatus: paymentFilter, visaStatus: visaFilter,
  } = req.query as Record<string, string>;

  let allPilgrims = bookings.map(row => ({
    ...row.booking,
    totalPrice: Number(row.booking.totalPrice),
    amountPaid: Number(row.booking.amountPaid),
    package: row.package,
    user: row.user,
    agentBusinessName: row.agentBusinessName || null,
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
  })
    .from(bookingsTable)
    .leftJoin(packagesTable, eq(bookingsTable.packageId, packagesTable.id))
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
  const { fullName, email, role = "staff", password, permissions = [], specialties = [] } = req.body as {
    fullName: string; email: string; role: string; password: string;
    permissions?: string[]; specialties?: string[];
  };

  if (!fullName || !email || !password) {
    return res.status(400).json({ error: "fullName, email and password are required" });
  }

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) return res.status(500).json({ error: "Clerk not configured" });

  const clerkRes = await fetch("https://api.clerk.com/v1/users", {
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

  if (!clerkRes.ok) {
    const err = await clerkRes.json() as any;
    const msg = err?.errors?.[0]?.long_message || err?.errors?.[0]?.message || "Failed to create Clerk user";
    return res.status(400).json({ error: msg });
  }

  const clerkUser = await clerkRes.json() as any;
  const clerkUserId: string = clerkUser.id;

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

  return res.status(201).json({
    ...profile,
    permissions,
    specialties,
  });
});

router.delete("/admin/staff/:id", async (req, res) => {
  const { id } = req.params;
  const profile = await db.query.profilesTable.findFirst({ where: eq(profilesTable.id, id) });
  if (!profile) return res.status(404).json({ error: "Staff not found" });

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (clerkSecretKey && profile.clerkUserId) {
    await fetch(`https://api.clerk.com/v1/users/${profile.clerkUserId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${clerkSecretKey}` },
    });
  }

  await db.delete(staffPermissionsTable).where(eq(staffPermissionsTable.userId, id));
  await db.delete(staffSupportSpecialtiesTable).where(eq(staffSupportSpecialtiesTable.userId, id));
  await db.delete(profilesTable).where(eq(profilesTable.id, id));

  return res.json({ success: true });
});

router.put("/admin/staff/:id/permissions", async (req, res) => {
  const { permissions } = req.body as { permissions: string[] };
  const userId = req.params.id;

  await db.delete(staffPermissionsTable).where(eq(staffPermissionsTable.userId, userId));

  if (permissions && permissions.length > 0) {
    await db.insert(staffPermissionsTable).values(
      permissions.map(p => ({ id: randomUUID(), userId, permission: p }))
    );
  }

  return res.json({ success: true });
});

router.put("/admin/staff/:id/specialties", async (req, res) => {
  const { specialties } = req.body as { specialties: string[] };
  const userId = req.params.id;

  await db.delete(staffSupportSpecialtiesTable).where(eq(staffSupportSpecialtiesTable.userId, userId));

  if (specialties && specialties.length > 0) {
    await db.insert(staffSupportSpecialtiesTable).values(
      specialties.map(cat => ({ id: randomUUID(), userId, category: cat }))
    );
  }

  return res.json({ success: true });
});

// SECURITY FIX #6: Validate role against allowed enum values.
// Only super_admin can assign super_admin role.
router.put("/admin/staff/:id/role", async (req, res) => {
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
});

// ── Analytics ─────────────────────────────────────────────────────────────────

router.get("/admin/analytics", async (req, res) => {
  const { period = "month", month, year } = req.query as Record<string, string>;
  const allBookings = await db.query.bookingsTable.findMany();
  const allPayments = await db.query.paymentsTable.findMany();
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
  const paymentMethodBreakdown = ["online", "bank_transfer", "cash"].map(method => ({
    method: method === "bank_transfer" ? "Bank Transfer" : method === "online" ? "Online" : "Cash",
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

  const ok = await sendEmail({
    to,
    subject: "Test Email — Raudah Travels & Tours",
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
          <p style="margin:0;color:#16A34A;font-size:13px;font-weight:600;">✓ Your email settings are working!</p>
        </div>
        <p style="color:#94A3B8;font-size:12px;margin:0;">Sent from: Admin → Settings → Email → Send Test Email</p>
      </div>
    </body></html>`,
    text: "This is a test email from Raudah Travels & Tours. Your email configuration is working correctly.",
  });

  if (ok) {
    return res.json({ success: true, message: `Test email sent to ${to}` });
  } else {
    return res.status(500).json({ success: false, error: "Email failed to send. Check your configuration in Settings." });
  }
});

router.put("/admin/settings/:key", async (req, res) => {
  const { value } = req.body;
  const existing = await db.query.siteSettingsTable.findFirst({
    where: eq(siteSettingsTable.key, req.params.key),
  });

  if (existing) {
    const [updated] = await db.update(siteSettingsTable)
      .set({ value, updatedAt: new Date() })
      .where(eq(siteSettingsTable.key, req.params.key))
      .returning();
    return res.json(updated);
  } else {
    const [created] = await db.insert(siteSettingsTable).values({
      id: randomUUID(),
      key: req.params.key,
      value,
    }).returning();
    return res.status(201).json(created);
  }
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
  const STAFF_EVENTS = ["pilgrim_registered","payment_verified","payment_rejected","booking_confirmed","booking_cancelled","amendment_approved","amendment_rejected","booking_status_changed"];
  const PAYMENT_EVENTS = ["payment_attempt","payment_success","payment_failed","payment_received","payment_verified","payment_rejected"];
  const PILGRIM_EVENTS = ["package_view","booking_start","booking_created","payment_attempt"];

  if (category === "staff") {
    conditions.push(sql`${userActivityTable.eventType} = ANY(ARRAY[${sql.raw(STAFF_EVENTS.map(e => `'${e}'`).join(","))}])`);
  } else if (category === "payments") {
    conditions.push(sql`${userActivityTable.eventType} = ANY(ARRAY[${sql.raw(PAYMENT_EVENTS.map(e => `'${e}'`).join(","))}])`);
  } else if (category === "pilgrim") {
    conditions.push(sql`${userActivityTable.eventType} = ANY(ARRAY[${sql.raw(PILGRIM_EVENTS.map(e => `'${e}'`).join(","))}])`);
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

// ── Amendment Requests ────────────────────────────────────────────────────────

router.get("/admin/amendments", async (req, res) => {
  const { status, limit = "20", offset = "0" } = req.query as Record<string, string>;
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
  const out: Record<string, number> = { pending: 0, submitted: 0, approved: 0, rejected: 0 };
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

/** Convert empty-string / whitespace-only values to undefined so Drizzle stores NULL */
const nullify = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

router.post("/admin/book-pilgrim", async (req, res) => {
  const {
    packageId, packageDateId, agentId, paymentMethod, markVerified,
    totalPrice, amountPaid,
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
  } = req.body;

  const pkg = await db.query.packagesTable.findFirst({ where: eq(packagesTable.id, packageId) });
  if (!pkg) return res.status(404).json({ error: "Package not found" });

  // Resolve the staff member who is performing this registration
  let staffProfileId: string | undefined;
  try {
    const { userId: clerkUserId } = getAuth(req);
    if (clerkUserId) {
      const staffProfile = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, clerkUserId) });
      if (staffProfile) staffProfileId = staffProfile.id;
    }
  } catch (_) { /* non-blocking */ }

  let userId = req.body.userId;
  if (!userId) {
    const walkinUuid = randomUUID();
    const [newProfile] = await db.insert(profilesTable).values({
      id: randomUUID(),
      clerkUserId: `walkin-${walkinUuid}`,
      email: `walkin-${walkinUuid}@raudah.internal`,
      fullName: fullName || "Walk-in Pilgrim",
      role: "user",
    }).returning();
    userId = newProfile.id;
  }

  // SECURITY FIX #12: Always use canonical package price. Client totalPrice is ignored.
  const price = Number(pkg.price);
  const reference = `RDH-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;

  const resolvedFullName = nullify(fullName) as string | undefined
    || [nullify(firstName), nullify(lastName)].filter(Boolean).join(" ")
    || undefined;

  const [booking] = await db.insert(bookingsTable).values({
    id: randomUUID(),
    reference,
    userId,
    packageId,
    packageDateId:                 nullify(packageDateId) as string | undefined,
    agentId:                       nullify(agentId) as string | undefined,
    registeredByStaffId:           staffProfileId || undefined,
    status: markVerified ? "confirmed" : "pending",
    totalPrice: String(price),
    amountPaid: markVerified ? String(amountPaid || price) : String(amountPaid || 0),
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
  }).returning();

  await db.update(packagesTable)
    .set({ currentBookings: (pkg.currentBookings || 0) + 1 })
    .where(eq(packagesTable.id, packageId));

  if (markVerified) {
    const existingVisa = await db.query.visaApplicationsTable.findFirst({
      where: eq(visaApplicationsTable.bookingId, booking.id),
    });
    if (!existingVisa) {
      await db.insert(visaApplicationsTable).values({
        id: randomUUID(),
        bookingId: booking.id,
        pilgrimName: booking.fullName ?? null,
        passportNumber: booking.passportNumber ?? null,
        status: "pending",
      });
    }
  }

  // Log staff action
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
  const { id } = req.params;
  const { commissionRate = 10, commissionType = "percentage", tempPassword } = req.body as {
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

  const nameParts = app.contactPerson.trim().split(" ");
  const clerkRes = await fetch("https://api.clerk.com/v1/users", {
    method: "POST",
    headers: { Authorization: `Bearer ${clerkSecretKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      first_name: nameParts[0],
      last_name: nameParts.slice(1).join(" ") || "",
      email_address: [app.email],
      password,
      skip_password_checks: true,
    }),
  });

  if (!clerkRes.ok) {
    const err = await clerkRes.json() as any;
    const msg = err?.errors?.[0]?.long_message || "Failed to create Clerk user";
    return res.status(400).json({ error: msg });
  }

  const clerkUser = await clerkRes.json() as any;
  const profileId = randomUUID();
  await db.insert(profilesTable).values({
    id: profileId,
    clerkUserId: clerkUser.id,
    email: app.email,
    fullName: app.contactPerson,
    role: "agent",
  });

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

  return res.json({
    agent: { ...agent, walletBalance: 0 },
    tempPassword: password,
    message: "Agent account created. Share the login credentials with the agent.",
  });
});

router.put("/admin/agent-applications/:id/reject", async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body as { reason?: string };

  const [updated] = await db.update(agentApplicationsTable)
    .set({ status: "rejected", rejectionReason: reason || null, updatedAt: new Date() })
    .where(eq(agentApplicationsTable.id, id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Application not found" });
  return res.json({ success: true });
});

// ── Direct Agent Creation ──────────────────────────────────────────────────────

router.post("/admin/agents/create", async (req, res) => {
  const { fullName, businessName, email, phone, tempPassword, commissionRate = 10, commissionType = "percentage" } = req.body as {
    fullName: string; businessName: string; email: string; phone: string;
    tempPassword: string; commissionRate?: number; commissionType?: string;
  };

  if (!fullName || !businessName || !email || !phone || !tempPassword) {
    return res.status(400).json({ error: "fullName, businessName, email, phone and tempPassword are required" });
  }

  // Check if email already exists in our DB
  const existingProfile = await db.query.profilesTable.findFirst({ where: eq(profilesTable.email, email) });
  if (existingProfile) return res.status(400).json({ error: "An account with this email address already exists." });

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

  // Mark the email address as verified so the agent can log in immediately
  const emailAddressId: string | undefined = clerkUser?.email_addresses?.[0]?.id;
  if (emailAddressId) {
    await fetch(`https://api.clerk.com/v1/email_addresses/${emailAddressId}`, {
      method: "PATCH",
      headers: clerkHeaders,
      body: JSON.stringify({ verified: true }),
    }).catch(() => {}); // non-fatal
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

  return res.status(201).json({
    agent: { ...agent, commissionRate: Number(agent.commissionRate), walletBalance: 0 },
    profile,
    message: "Agent account created successfully.",
  });
});

// ── Agent Commission Update ───────────────────────────────────────────────────

router.put("/admin/agents/:id/commission", async (req, res) => {
  const { commissionRate, commissionType } = req.body as { commissionRate: number; commissionType: string };
  const [agent] = await db.update(agentsTable)
    .set({ commissionRate: String(commissionRate), commissionType, updatedAt: new Date() })
    .where(eq(agentsTable.id, req.params.id))
    .returning();
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  return res.json({ ...agent, commissionRate: Number(agent.commissionRate) });
});

// ── Wallet Top-Up with OTP ────────────────────────────────────────────────────

router.post("/admin/agents/:id/wallet/topup/initiate", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const adminProfile = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, clerkUserId) });
  if (!adminProfile) return res.status(404).json({ error: "Admin profile not found" });

  const { amount } = req.body as { amount: number };
  if (!amount || amount <= 0) return res.status(400).json({ error: "Valid amount is required" });

  const agent = await db.query.agentsTable.findFirst({ where: eq(agentsTable.id, req.params.id) });
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = createHash("sha256").update(otp).digest("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const [otpRequest] = await db.insert(adminOtpRequestsTable).values({
    id: randomUUID(),
    adminId: adminProfile.id,
    agentId: agent.id,
    amount: String(amount),
    otpHash,
    expiresAt,
  }).returning();

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  let emailSent = false;
  if (clerkSecretKey && adminProfile.clerkUserId) {
    try {
      const clerkUserRes = await fetch(`https://api.clerk.com/v1/users/${adminProfile.clerkUserId}`, {
        headers: { Authorization: `Bearer ${clerkSecretKey}` },
      });
      if (clerkUserRes.ok) {
        const clerkUser = await clerkUserRes.json() as any;
        const emailAddressId = clerkUser?.email_addresses?.[0]?.id;
        if (emailAddressId) {
          await fetch("https://api.clerk.com/v1/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${clerkSecretKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              email_address_id: emailAddressId,
              subject: "Wallet Top-Up Verification Code",
              body: `Your OTP for topping up agent wallet by ₦${Number(amount).toLocaleString()} is: <strong>${otp}</strong><br>This code expires in 10 minutes. Do not share it with anyone.`,
              from_email_name: "Raudah Travels Admin",
            }),
          });
          emailSent = true;
        }
      }
    } catch (_e) {}
  }

  return res.json({
    requestId: otpRequest.id,
    message: emailSent
      ? `OTP sent to ${adminProfile.email}. Enter it below to confirm the top-up.`
      : `OTP generated (email delivery not configured). Use dev OTP.`,
    devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
  });
});

router.post("/admin/agents/:id/wallet/topup/confirm", async (req, res) => {
  const { requestId, otp } = req.body as { requestId: string; otp: string };
  if (!requestId || !otp) return res.status(400).json({ error: "requestId and otp are required" });

  const otpRecord = await db.query.adminOtpRequestsTable.findFirst({
    where: eq(adminOtpRequestsTable.id, requestId),
  });
  if (!otpRecord) return res.status(404).json({ error: "OTP request not found" });
  if (otpRecord.used) return res.status(400).json({ error: "OTP already used or invalidated" });
  if (new Date() > new Date(otpRecord.expiresAt)) return res.status(400).json({ error: "OTP has expired" });
  if (otpRecord.agentId !== req.params.id) return res.status(400).json({ error: "OTP does not match this agent" });

  const otpHash = createHash("sha256").update(otp).digest("hex");
  if (otpHash !== otpRecord.otpHash) {
    // SECURITY: Immediately invalidate the OTP on any wrong attempt to prevent brute-force.
    // The admin must initiate a new top-up request to try again.
    await db.update(adminOtpRequestsTable)
      .set({ used: true })
      .where(eq(adminOtpRequestsTable.id, requestId));
    return res.status(400).json({ error: "Invalid OTP — the code has been invalidated. Please start a new top-up request." });
  }

  const amount = Number(otpRecord.amount);
  const adminName = (req as any).adminProfile?.fullName ?? "Admin";
  const agentId = req.params.id;

  // SECURITY: Wrap all mutations in a single DB transaction.
  // If any step fails, the entire operation is rolled back — no partial wallet credits.
  let finalBalance = 0;
  await db.transaction(async (tx) => {
    // Mark OTP used FIRST inside the transaction to prevent concurrent re-use
    await tx.update(adminOtpRequestsTable)
      .set({ used: true })
      .where(and(eq(adminOtpRequestsTable.id, requestId), eq(adminOtpRequestsTable.used, false)));

    // Upsert wallet
    const existing = await tx.query.agentWalletsTable.findFirst({
      where: eq(agentWalletsTable.agentId, agentId),
    });

    let wallet;
    if (!existing) {
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

    // Record transaction
    await tx.insert(walletTransactionsTable).values({
      id: randomUUID(),
      agentId,
      amount: String(amount),
      type: "topup",
      reference: `TOPUP-${randomUUID()}`,
      description: `Top-up by ${adminName}`,
    });

    finalBalance = Number(wallet?.balance || 0);
  });

  return res.json({
    success: true,
    newBalance: finalBalance,
    message: `₦${amount.toLocaleString()} added to agent wallet successfully.`,
  });
});

// ── Agent Package Discounts ───────────────────────────────────────────────────

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

  const existing = await db.query.agentPackageDiscountsTable.findFirst({
    where: and(
      eq(agentPackageDiscountsTable.agentId, req.params.id),
      eq(agentPackageDiscountsTable.packageId, req.params.packageId),
    ),
  });

  let discount;
  if (existing) {
    const [d] = await db.update(agentPackageDiscountsTable)
      .set({ discountType, discountValue: String(discountValue), updatedAt: new Date() })
      .where(eq(agentPackageDiscountsTable.id, existing.id))
      .returning();
    discount = d;
  } else {
    const [d] = await db.insert(agentPackageDiscountsTable).values({
      id: randomUUID(),
      agentId: req.params.id,
      packageId: req.params.packageId,
      discountType,
      discountValue: String(discountValue),
    }).returning();
    discount = d;
  }

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
