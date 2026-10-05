import { getRegistrationConfig } from "../services/registration/config";
import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { isWhatsAppConfigured } from "../services/channels/WhatsAppAdapter";
import { isTelegramConfigured } from "../services/channels/TelegramAdapter";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { isR2Configured } from "../lib/r2";

const router: IRouter = Router();

router.get("/readyz", async (_req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    if ((await getRegistrationConfig()).enabled) await db.execute(sql`SELECT sequence FROM ai_registration_jobs LIMIT 0`);
    return res.json({ status: "ready" });
  } catch { return res.status(503).json({ status: "unavailable" }); }
});

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

/**
 * Deeper readiness probe: reports whether each integration is configured.
 * Reports PRESENCE ONLY - no keys, tokens, ids, or secrets are ever returned.
 * Authenticated via Clerk (same middleware chain as the rest of /api).
 */
router.get("/health/details", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  return res.json({
    status: "ok",
    aiRegistration: {
      enabled: (await getRegistrationConfig()).enabled,
      whatsapp: await isWhatsAppConfigured(),
      telegram: await isTelegramConfigured(),
    },
    storage: { r2: await isR2Configured() },
  });
});

export default router;