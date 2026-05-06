import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { siteSettingsTable, contactMessagesTable, bankAccountsTable, bookingFormFieldsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import healthRouter from "./health";
import authRouter from "./auth";
import packagesRouter from "./packages";
import bookingsRouter from "./bookings";
import paymentsRouter from "./payments";
import notificationsRouter from "./notifications";
import supportRouter from "./support";
import agentsRouter from "./agents";
import documentsRouter from "./documents";
import dashboardRouter from "./dashboard";
import adminRouter from "./admin";
import aiRouter from "./ai";
import backupRouter from "./backup";

const router: IRouter = Router();

function getWebhookUrl(): string {
  const appUrl = process.env.APP_URL ?? "";
  return appUrl ? `${appUrl.replace(/\/+$/, "")}/api/payments/paystack/webhook` : "";
}

router.get("/config", async (_req, res) => {
  const [pkSetting, enabledSetting] = await Promise.all([
    db.query.siteSettingsTable.findFirst({ where: eq(siteSettingsTable.key, "paystack_public_key") }),
    db.query.siteSettingsTable.findFirst({ where: eq(siteSettingsTable.key, "paystack_enabled") }),
  ]);
  const paystackPublicKey = (pkSetting?.value as string | undefined) ?? process.env.PAYSTACK_PUBLIC_KEY ?? "";
  const paystackEnabled = enabledSetting ? Boolean(enabledSetting.value) : true;
  return res.json({ paystackPublicKey, webhookUrl: getWebhookUrl(), paystackEnabled });
});

router.get("/public/settings", async (_req, res) => {
  try {
    const PUBLIC_KEYS = new Set([
      "contact_info", "social_links", "trust_badges", "landing_video_url",
      "leadership_team", "landing_stats", "about_stats",
    ]);
    const rows = await db.query.siteSettingsTable.findMany();
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      if (PUBLIC_KEYS.has(row.key)) result[row.key] = row.value;
    }
    return res.json(result);
  } catch {
    return res.status(500).json({ error: "Failed to load settings" });
  }
});

// Public bank accounts (active only, no auth required — needed for payment instructions)
router.get("/bank-accounts", async (_req, res) => {
  try {
    const accounts = await db.query.bankAccountsTable.findMany({
      where: eq(bankAccountsTable.isActive, true),
      orderBy: bankAccountsTable.createdAt,
    });
    return res.json({ accounts });
  } catch {
    return res.json({ accounts: [] });
  }
});

// Public booking form fields (for user booking wizard)
router.get("/public/booking-form-fields", async (req, res) => {
  try {
    const { appliesTo } = req.query as Record<string, string>;
    const conditions: any[] = [];
    if (appliesTo) conditions.push(eq(bookingFormFieldsTable.appliesTo, appliesTo));

    const fields = await db.query.bookingFormFieldsTable.findMany({
      where: conditions.length ? and(...conditions) : undefined,
      orderBy: bookingFormFieldsTable.sortOrder,
    });
    return res.json({ fields });
  } catch {
    return res.status(500).json({ error: "Failed to load form fields" });
  }
});

// SECURITY FIX #9: Simple in-memory rate limiter for public endpoints
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function rateLimit(ip: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}
// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000).unref();

router.post("/contact", async (req, res) => {
  try {
    const clientIp = req.ip ?? req.socket.remoteAddress ?? "unknown";
    if (!rateLimit(clientIp, 5, 60_000)) {
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }

    const { name, email, phone, subject, message } = req.body;
    if (!name || !message) return res.status(400).json({ error: "Name and message are required" });
    await db.insert(contactMessagesTable).values({
      id: randomUUID(),
      name: String(name),
      email: email ? String(email) : null,
      phone: phone ? String(phone) : null,
      subject: subject ? String(subject) : "General Enquiry",
      message: String(message),
      status: "unread",
    });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "Failed to save message" });
  }
});

router.use(healthRouter);
router.use(authRouter);
router.use(packagesRouter);
router.use(bookingsRouter);
router.use(paymentsRouter);
router.use(notificationsRouter);
router.use(supportRouter);
router.use(aiRouter);
router.use(agentsRouter);
router.use(documentsRouter);
router.use(dashboardRouter);
router.use(adminRouter);
router.use(backupRouter);

export default router;
