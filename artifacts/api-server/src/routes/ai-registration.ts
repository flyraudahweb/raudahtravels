import { getRegistrationConfig } from "../services/registration/config";
import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { registrationDb as db, registrationTransaction } from "../services/registration/database";
import { approveSchema, reviewFieldsSchema, rejectSchema, extractionFields } from "../services/registration/validation";
import { enqueueReply, rowsOf } from "../services/channels/ChannelQueue";
import { purgeRetainedMedia } from "../services/registration/RetentionService";
import { randomUUID } from "node:crypto";
import {
  profilesTable, staffPermissionsTable, userActivityTable,
  aiRegistrationSessionsTable, aiRegistrationSubmissionsTable, aiRegistrationAuditTable,
} from "@workspace/db";
import { eq, and, desc, ilike, sql, or } from "drizzle-orm";
import { createBooking, RegistrationError } from "../services/registration/RegistrationService";
import { detectDuplicate } from "../services/registration/DuplicateDetectionService";
import { extractPassport } from "../services/passport/PassportExtractionService";
import { getFromR2 } from "../lib/r2";


const router = Router();

/* ── Admin + permission guard — applied to every route in this file ─────── */

// One flat permission key, matching every other admin page's single-key
// convention (see artifacts/raudah-travels/src/pages/admin/AdminStaff.tsx
// PAGE_PERMISSIONS) — this system has no precedent for splitting a page into
// separate "review" vs "approve" grants, so review and approve share a key.
const AI_REGISTRATIONS_PERMISSION = "ai_registrations";

function requireAiRegistrationAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { userId: clerkUserId } = getAuth(req);
    if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

    const profile = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, clerkUserId) });
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    if (profile.accountStatus !== "active") return res.status(403).json({ error: "Account is not active" });
    if (!["admin", "super_admin", "staff"].includes(profile.role)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    if (profile.role === "super_admin" || profile.role === "admin") {
      (req as any).staffProfile = profile;
      return next();
    }

    const grant = await db.query.staffPermissionsTable.findFirst({
      where: and(eq(staffPermissionsTable.userId, profile.id), eq(staffPermissionsTable.permission, AI_REGISTRATIONS_PERMISSION)),
    });
    if (!grant) return res.status(403).json({ error: `Missing permission: ${AI_REGISTRATIONS_PERMISSION}` });

    (req as any).staffProfile = profile;
    return next();
  };
}

/* ── GET /admin/ai-registrations — list with filters ────────────────────── */

router.get(
  "/admin/ai-registrations",
  requireAiRegistrationAccess() as any,
  async (req, res) => {
    const { status, channel, duplicateStatus, q, page: pageStr = "1", limit: limitStr = "20" } = req.query as Record<string, string>;
    if ((status && !["pending_review", "approved", "rejected"].includes(status)) || (channel && !["whatsapp", "telegram"].includes(channel)) ||
      (duplicateStatus && !["duplicate_confirmed", "possible_duplicate", "no_duplicate_detected"].includes(duplicateStatus)) || (q && (typeof q !== "string" || q.length > 200))) {
      return res.status(400).json({ error: "Invalid list filters" });
    }
    const page = Math.max(1, Math.min(100000, parseInt(pageStr) || 1));
    const limit = Math.min(100, Math.max(1, parseInt(limitStr) || 20));

    const conditions: any[] = [];
    if (status) conditions.push(eq(aiRegistrationSubmissionsTable.status, status as any));
    if (duplicateStatus) conditions.push(eq(aiRegistrationSubmissionsTable.duplicateStatus, duplicateStatus as any));

    const rows = await db
      .select({
        submission: aiRegistrationSubmissionsTable,
        session: aiRegistrationSessionsTable,
      })
      .from(aiRegistrationSubmissionsTable)
      .innerJoin(aiRegistrationSessionsTable, eq(aiRegistrationSubmissionsTable.sessionId, aiRegistrationSessionsTable.id))
      .where(
        and(
          ...conditions,
          channel ? eq(aiRegistrationSessionsTable.channel, channel as any) : undefined,
          q ? or(ilike(aiRegistrationSessionsTable.displayName, `%${q}%`),
            sql`COALESCE(${aiRegistrationSubmissionsTable.reviewData}->>'fullName', ${aiRegistrationSubmissionsTable.snapshot}->>'fullName') ILIKE ${`%${q}%`}`,
            sql`${aiRegistrationSubmissionsTable.snapshot}->>'phone' ILIKE ${`%${q}%`}`) : undefined,
        ),
      )
      .orderBy(desc(aiRegistrationSubmissionsTable.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aiRegistrationSubmissionsTable)
      .innerJoin(aiRegistrationSessionsTable, eq(aiRegistrationSubmissionsTable.sessionId, aiRegistrationSessionsTable.id))
      .where(
        and(
          ...conditions,
          channel ? eq(aiRegistrationSessionsTable.channel, channel as any) : undefined,
          q ? or(ilike(aiRegistrationSessionsTable.displayName, `%${q}%`),
            sql`COALESCE(${aiRegistrationSubmissionsTable.reviewData}->>'fullName', ${aiRegistrationSubmissionsTable.snapshot}->>'fullName') ILIKE ${`%${q}%`}`,
            sql`${aiRegistrationSubmissionsTable.snapshot}->>'phone' ILIKE ${`%${q}%`}`) : undefined,
        ),
      );

    return res.json({
      submissions: rows.map((r) => ({ ...r.submission, channel: r.session.channel, displayName: r.session.displayName, phone: r.session.phone })),
      total: Number(count),
      page,
      limit,
    });
  },
);

/* ── GET /admin/ai-registrations/:id — detail ────────────────────────────── */

router.get(
  "/admin/ai-registrations/stats",
  requireAiRegistrationAccess() as any,
  async (_req, res) => {
    const byStatus = await db
      .select({ status: aiRegistrationSubmissionsTable.status, count: sql<number>`count(*)` })
      .from(aiRegistrationSubmissionsTable)
      .groupBy(aiRegistrationSubmissionsTable.status);

    const byChannel = await db
      .select({ channel: aiRegistrationSessionsTable.channel, count: sql<number>`count(*)` })
      .from(aiRegistrationSessionsTable)
      .groupBy(aiRegistrationSessionsTable.channel);

    const byProvider = await db
      .select({ provider: aiRegistrationSubmissionsTable.extractionProvider, count: sql<number>`count(*)` })
      .from(aiRegistrationSubmissionsTable)
      .groupBy(aiRegistrationSubmissionsTable.extractionProvider);

    const byDuplicateStatus = await db
      .select({ duplicateStatus: aiRegistrationSubmissionsTable.duplicateStatus, count: sql<number>`count(*)` })
      .from(aiRegistrationSubmissionsTable)
      .groupBy(aiRegistrationSubmissionsTable.duplicateStatus);

    const [{ fallbackCount }] = await db
      .select({ fallbackCount: sql<number>`count(*)` })
      .from(aiRegistrationSessionsTable)
      .where(eq(aiRegistrationSessionsTable.fallbackTriggered, true));

    return res.json({
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.count)])),
      byChannel: Object.fromEntries(byChannel.map((r) => [r.channel, Number(r.count)])),
      byProvider: Object.fromEntries(byProvider.map((r) => [r.provider ?? "none", Number(r.count)])),
      byDuplicateStatus: Object.fromEntries(byDuplicateStatus.map((r) => [r.duplicateStatus ?? "none", Number(r.count)])),
      geminiFallbackCount: Number(fallbackCount),
      queue: rowsOf(await db.execute(sql`SELECT direction, status, count(*)::int AS count, min(created_at) AS oldest FROM ai_registration_jobs GROUP BY direction, status`)),
      extraction: rowsOf(await db.execute(sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE extraction_provider IS NOT NULL)::int AS succeeded FROM ai_registration_submissions`))[0],
    });
  },
);

router.post("/admin/ai-registrations/purge", requireAiRegistrationAccess() as any, async (_req, res) => {
  const purged = await purgeRetainedMedia();
  return res.json({ purged });
});
router.get("/admin/ai-registrations/jobs", requireAiRegistrationAccess() as any, async (_req, res) => {
  return res.json({ jobs: rowsOf(await db.execute(sql`SELECT id, direction, channel, attempts, created_at, last_error FROM ai_registration_jobs WHERE status = 'failed' ORDER BY created_at LIMIT 100`)) });
});
router.post("/admin/ai-registrations/jobs/:jobId/skip", requireAiRegistrationAccess() as any, async (req, res) => {
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "A reason is required" });
  const skipped = await registrationTransaction(async () => {
    const rows = rowsOf(await db.execute(sql`UPDATE ai_registration_jobs SET status = 'completed', payload = '{}'::jsonb,
      completed_at = now(), last_error = 'Skipped by staff' WHERE id = ${req.params.jobId} AND status = 'failed' RETURNING id`));
    if (!rows.length) return false;
    await db.insert(userActivityTable).values({ id: randomUUID(), userId: (req as any).staffProfile.id,
      eventType: "ai_registration_job_skipped", metadata: { jobId: req.params.jobId, reason: parsed.data.reason } });
    return true;
  });
  return res.status(skipped ? 200 : 409).json({ skipped });
});
router.post("/admin/ai-registrations/jobs/:jobId/retry", requireAiRegistrationAccess() as any, async (req, res) => {
  const rows = rowsOf(await db.execute(sql`UPDATE ai_registration_jobs SET status = 'pending', attempts = 0, available_at = now(), last_error = NULL
    WHERE id = ${req.params.jobId} AND status = 'failed' AND payload <> '{}'::jsonb RETURNING id`));
  if (!rows.length) return res.status(409).json({ error: "Job is not retryable" });
  return res.json({ retried: true });
});

router.get(
  "/admin/ai-registrations/:id",
  requireAiRegistrationAccess() as any,
  async (req, res) => {
    const submission = await db.query.aiRegistrationSubmissionsTable.findFirst({
      where: eq(aiRegistrationSubmissionsTable.id, req.params.id),
    });
    if (!submission) return res.status(404).json({ error: "Submission not found" });

    const session = await db.query.aiRegistrationSessionsTable.findFirst({
      where: eq(aiRegistrationSessionsTable.id, submission.sessionId),
    });

    const audit = await db.query.aiRegistrationAuditTable.findMany({
      where: eq(aiRegistrationAuditTable.submissionId, submission.id),
      orderBy: aiRegistrationAuditTable.createdAt,
    });
    const sessionAudit = session
      ? await db.query.aiRegistrationAuditTable.findMany({
          where: eq(aiRegistrationAuditTable.sessionId, session.id),
          orderBy: aiRegistrationAuditTable.createdAt,
        })
      : [];

    let passportSignedUrl: string | null = null;
    if (submission.passportImageR2Key) {
      try {
        // Admin-gated fetch proxy — see GET /admin/ai-registrations/:id/passport-image below.
        passportSignedUrl = `/api/admin/ai-registrations/${submission.id}/passport-image`;
      } catch {
        passportSignedUrl = null;
      }
    }

    await db.insert(aiRegistrationAuditTable).values({
      id: randomUUID(),
      submissionId: submission.id,
      sessionId: session?.id,
      event: "ai_registration_viewed",
      actor: `staff:${(req as any).staffProfile?.id ?? "unknown"}`,
    });

    await db.insert(userActivityTable).values({ id: randomUUID(), userId: (req as any).staffProfile.id,
      eventType: "ai_registration_viewed", metadata: { submissionId: submission.id } });
    return res.json({
      submission,
      session,
      passportImageUrl: passportSignedUrl,
      audit: [...new Map([...audit, ...sessionAudit].map((entry) => [entry.id, entry])).values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    });
  },
);

/* ── GET /admin/ai-registrations/:id/passport-image — admin-gated media fetch ── */

router.get(
  "/admin/ai-registrations/:id/passport-image",
  requireAiRegistrationAccess() as any,
  async (req, res) => {
    const submission = await db.query.aiRegistrationSubmissionsTable.findFirst({
      where: eq(aiRegistrationSubmissionsTable.id, req.params.id),
    });
    if (!submission?.passportImageR2Key) return res.status(404).json({ error: "No passport image on file" });

    try {
      const file = await getFromR2(submission.passportImageR2Key);
      res.setHeader("Content-Type", file.contentType);
      res.setHeader("Cache-Control", "private, no-store");
      // R2 Body shape varies with SDK version (Node stream vs web ReadableStream) — handle both at runtime.
      const body = file.body as any;
      if (typeof body?.pipe === "function") {
        body.pipe(res);
      } else {
        res.send(Buffer.from(await body.transformToByteArray()));
      }
      return;
    } catch (err: any) {
      req.log.error("Failed to fetch passport image from R2");
      return res.status(500).json({ error: "Failed to load passport image" });
    }
  },
);

/* ── PUT /admin/ai-registrations/:id — staff corrections ─────────────────── */

router.put("/admin/ai-registrations/:id", requireAiRegistrationAccess() as any, async (req, res) => {
  const parsed = reviewFieldsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid review fields", fields: parsed.error.flatten() });
  try {
    const result = await registrationTransaction(async () => {
      const submission = await lockPending(req.params.id);
      const before = (submission.reviewData ?? submission.snapshot) as Record<string, unknown>;
      const changedFields = Object.keys(parsed.data).filter((key) => before[key] !== (parsed.data as any)[key]);
      const [updated] = await db.update(aiRegistrationSubmissionsTable).set({ reviewData: { ...before, ...parsed.data }, updatedAt: new Date() })
        .where(eq(aiRegistrationSubmissionsTable.id, submission.id)).returning();
      await db.insert(aiRegistrationAuditTable).values({ id: randomUUID(), submissionId: submission.id, sessionId: submission.sessionId,
        event: "reviewer_edited", actor: `staff:${(req as any).staffProfile.id}`, metadata: { changedFields } });
      return { submission: updated };
    });
    return res.json(result);
  } catch (err) { return reviewError(req, res, err); }
});

/* ── POST /admin/ai-registrations/:id/retry-extraction ───────────────────── */

router.post("/admin/ai-registrations/:id/retry-extraction", requireAiRegistrationAccess() as any, async (req, res) => {
  try {
    const result = await registrationTransaction(async () => {
      const submission = await lockPending(req.params.id);
      if (!submission.passportImageR2Key) throw new RegistrationError("No passport image on file", 400);
      const file = await getFromR2(submission.passportImageR2Key);
      const bytes = await file.body!.transformToByteArray();
      const outcome = await extractPassport(Buffer.from(bytes).toString("base64"), file.contentType, { forceProvider: "mistral" });
      if (!outcome.ok || !outcome.data || !outcome.data.isAcceptableQuality) throw new RegistrationError("Re-extraction failed; complete the fields manually or request a new photo", 422);
      const fields = extractionFields(outcome.data as unknown as Record<string, unknown>);
      const [updated] = await db.update(aiRegistrationSubmissionsTable).set({ extractionProvider: outcome.provider,
        reviewData: { ...(submission.reviewData ?? submission.snapshot as Record<string, unknown>), ...fields }, updatedAt: new Date() })
        .where(eq(aiRegistrationSubmissionsTable.id, submission.id)).returning();
      await db.update(aiRegistrationSessionsTable).set({ extractionResult: outcome.data, extractionProvider: outcome.provider,
        extractionAttempts: sql`${aiRegistrationSessionsTable.extractionAttempts} + 1` }).where(eq(aiRegistrationSessionsTable.id, submission.sessionId));
      await db.insert(aiRegistrationAuditTable).values({ id: randomUUID(), submissionId: submission.id, sessionId: submission.sessionId,
        event: "retry_extraction_completed", actor: `staff:${(req as any).staffProfile.id}`, metadata: { provider: outcome.provider } });
      return { submission: updated, extraction: outcome.data, provider: outcome.provider };
    });
    return res.json(result);
  } catch (err) { return reviewError(req, res, err); }
});

/* ── POST /admin/ai-registrations/:id/approve ─────────────────────────────── */

router.post("/admin/ai-registrations/:id/approve", requireAiRegistrationAccess() as any, async (req, res) => {
  const parsed = approveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid approval fields", fields: parsed.error.flatten() });
  try {
    const result = await registrationTransaction(async () => {
      // Serializes duplicate checks across approvals, then locks the submission.
      await db.execute(sql`SELECT pg_advisory_xact_lock(746281009)`);
      await db.execute(sql`SELECT id FROM ai_registration_submissions WHERE id = ${req.params.id} FOR UPDATE`);
      const submission = await db.query.aiRegistrationSubmissionsTable.findFirst({ where: eq(aiRegistrationSubmissionsTable.id, req.params.id) });
      if (!submission) throw new RegistrationError("Submission not found", 404);
      if (submission.status !== "pending_review") throw new RegistrationError(`Submission is already ${submission.status}`, 409);
      const { duplicateOverrideReason, packageDateId, agentId, ...patch } = parsed.data;
      const merged = { ...(submission.snapshot as Record<string, unknown>), ...(submission.reviewData as Record<string, unknown> ?? {}), ...patch };
      const fields = reviewFieldsSchema.parse(Object.fromEntries(Object.entries(merged).filter(([key]) => key in reviewFieldsSchema.shape)));
      if (!fields.packageId || !fields.fullName || !fields.phone || !fields.passportNumber || !fields.dateOfBirth || !fields.passportExpiry) {
        throw new RegistrationError("Package, full name, phone, passport number, date of birth and passport expiry must be completed before approval", 400);
      }
      if (fields.passportExpiry <= new Date().toISOString().slice(0, 10)) throw new RegistrationError("Passport has expired", 400);
      if (fields.dateOfBirth > new Date().toISOString().slice(0, 10)) throw new RegistrationError("Date of birth cannot be in the future", 400);
      const duplicate = await detectDuplicate({ ...fields, passportImageHash: submission.passportImageHash, excludeSessionId: submission.sessionId });
      if (duplicate.status === "duplicate_confirmed" && !duplicateOverrideReason) throw new RegistrationError("Duplicate confirmed: an override reason of at least five characters is required", 409);
      const session = await db.query.aiRegistrationSessionsTable.findFirst({ where: eq(aiRegistrationSessionsTable.id, submission.sessionId) });
      if (!session) throw new RegistrationError("Session not found", 404);
      const { booking } = await createBooking({ ...fields, packageId: fields.packageId, packageDateId, agentId,
        batchId: (submission.snapshot as Record<string, unknown>).bulkId as string | undefined,
        registeredByStaffId: (req as any).staffProfile.id, reviewedById: (req as any).staffProfile.id,
        source: session.channel === "whatsapp" ? "whatsapp_ai" : "telegram_ai", aiSessionId: session.id,
        duplicateStatus: duplicate.status, duplicateMatches: duplicate.matches,
        passportCopyUrl: submission.passportImageR2Key ? `/api/admin/ai-registrations/${submission.id}/passport-image` : undefined });
      const [updated] = await db.update(aiRegistrationSubmissionsTable).set({ status: "approved", reviewData: fields,
        duplicateStatus: duplicate.status, duplicateMatches: duplicate.matches, reviewedById: (req as any).staffProfile.id,
        reviewedAt: new Date(), duplicateOverrideReason: duplicateOverrideReason ?? null, bookingId: booking.id, updatedAt: new Date() })
        .where(and(eq(aiRegistrationSubmissionsTable.id, submission.id), eq(aiRegistrationSubmissionsTable.status, "pending_review"))).returning();
      await db.update(aiRegistrationSessionsTable).set({ status: "approved", bookingId: booking.id, updatedAt: new Date() }).where(eq(aiRegistrationSessionsTable.id, session.id));
      await db.insert(aiRegistrationAuditTable).values({ id: randomUUID(), sessionId: session.id, submissionId: submission.id,
        event: "submission_approved", actor: `staff:${(req as any).staffProfile.id}`, metadata: { bookingId: booking.id, duplicateOverrideReason } });
      await db.insert(userActivityTable).values({ id: randomUUID(), userId: (req as any).staffProfile.id, eventType: "ai_registration_approved", bookingId: booking.id });
      await enqueueOutcome(session, submission.id, "approved", booking.reference);
      return { submission: updated, booking };
    });
    return res.json(result);
  } catch (err) { return reviewError(req, res, err); }
});

/* ── POST /admin/ai-registrations/:id/reject ──────────────────────────────── */

router.post("/admin/ai-registrations/:id/reject", requireAiRegistrationAccess() as any, async (req, res) => {
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "A rejection reason of at least three characters is required" });
  try {
    const result = await registrationTransaction(async () => {
      const submission = await lockPending(req.params.id);
      const [updated] = await db.update(aiRegistrationSubmissionsTable).set({ status: "rejected", rejectionReason: parsed.data.reason,
        reviewedById: (req as any).staffProfile.id, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(aiRegistrationSubmissionsTable.id, submission.id)).returning();
      await db.update(aiRegistrationSessionsTable).set({ status: "rejected", updatedAt: new Date() }).where(eq(aiRegistrationSessionsTable.id, submission.sessionId));
      await db.insert(aiRegistrationAuditTable).values({ id: randomUUID(), submissionId: submission.id, sessionId: submission.sessionId,
        event: "submission_rejected", actor: `staff:${(req as any).staffProfile.id}` });
      const session = await db.query.aiRegistrationSessionsTable.findFirst({ where: eq(aiRegistrationSessionsTable.id, submission.sessionId) });
      if (session) await enqueueOutcome(session, submission.id, "rejected", "Contact staff for assistance");
      return { submission: updated };
    });
    return res.json(result);
  } catch (err) { return reviewError(req, res, err); }
});

/* ── GET /admin/ai-registrations/stats ────────────────────────────────────── */


async function lockPending(id: string) {
  await db.execute(sql`SELECT id FROM ai_registration_submissions WHERE id = ${id} FOR UPDATE`);
  const row = await db.query.aiRegistrationSubmissionsTable.findFirst({ where: eq(aiRegistrationSubmissionsTable.id, id) });
  if (!row) throw new RegistrationError("Submission not found", 404);
  if (row.status !== "pending_review") throw new RegistrationError(`Submission is already ${row.status}`, 409);
  return row;
}
function reviewError(req: Request, res: Response, err: unknown) {
  if (err instanceof RegistrationError) return res.status(err.status).json({ error: err.message });
  if ((err as any)?.name === "ZodError") return res.status(400).json({ error: "Please complete valid pilgrim details" });
  req.log.error("AI registration review failed");
  return res.status(500).json({ error: "Review failed. Please retry." });
}
async function enqueueOutcome(session: { channel: "whatsapp" | "telegram"; channelUserId: string; id: string }, id: string, status: string, reference: string) {
  const config = await getRegistrationConfig();
  const template = session.channel === "whatsapp" && config.whatsappReviewTemplate ? {
    name: config.whatsappReviewTemplate, language: config.whatsappTemplateLanguage, parameters: [status, reference],
  } : undefined;
  await enqueueReply(session.channel, session.channelUserId, { text: `Your registration was ${status}. ${reference}`, template }, `review:${id}:${status}`, session.id);
}
export default router;
