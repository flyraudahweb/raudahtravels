import { getRegistrationConfig } from "./config";
import { registrationDb as db } from "./database";
import {
  aiRegistrationSessionsTable,
  aiRegistrationMessagesTable,
  aiRegistrationAuditTable,
  type AiRegistrationSession,
} from "@workspace/db";
import { and, eq, gt, lt, sql, or, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export type AiChannel = "whatsapp" | "telegram";
export type AiSessionStep =
  | "awaiting_name"
  | "awaiting_contact"
  | "awaiting_package"
  | "awaiting_passport_image"
  | "awaiting_confirmation"
  | "done";


const REQUIRED_FIELDS = ["fullName", "phone", "packageId"] as const;

async function newExpiry(): Promise<Date> {
  return new Date(Date.now() + (await getRegistrationConfig()).sessionTtlHours * 60 * 60 * 1000);
}

/**
 * Find the active (collecting, unexpired) session for a channel user, or
 * create a new one. This is the resume entry point every inbound message
 * goes through.
 */
export async function getOrCreateSession(
  channel: AiChannel,
  channelUserId: string,
  startNextPilgrim = false,
): Promise<AiRegistrationSession> {
  await db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${channel}:${channelUserId}`}, 0))`);
  const previous = await db.query.aiRegistrationSessionsTable.findFirst({
    where: and(eq(aiRegistrationSessionsTable.channel, channel), eq(aiRegistrationSessionsTable.channelUserId, channelUserId)),
    orderBy: desc(aiRegistrationSessionsTable.createdAt),
  });
  if (!startNextPilgrim && previous) {
    if (previous.status === "pending_review") return previous;
    if (previous.status === "collecting" && previous.expiresAt && previous.expiresAt > new Date()) return previous;
    if (previous.status === "collecting" || previous.status === "expired") {
      const [expired] = await db.update(aiRegistrationSessionsTable).set({ status: "expired" })
        .where(eq(aiRegistrationSessionsTable.id, previous.id)).returning();
      return expired;
    }
  }
  if (startNextPilgrim && previous?.status !== "pending_review") throw new Error("The previous pilgrim must be submitted before continuing a group");

  const [created] = await db
    .insert(aiRegistrationSessionsTable)
    .values({
      id: randomUUID(),
      channel,
      channelUserId,
      status: "collecting",
      currentStep: "awaiting_name",
      collectedData: {},
      missingFields: [...REQUIRED_FIELDS],
      expiresAt: await newExpiry(),
    })
    .returning();

  await recordAudit(created.id, undefined, "session_created", "system");
  return created;
}

/** Record an inbound/outbound message. Idempotent on channelMessageId. */
export async function recordMessage(params: {
  sessionId: string;
  direction: "inbound" | "outbound";
  type?: "text" | "image" | "document" | "button" | "system";
  channelMessageId: string;
  body?: string;
  mediaR2Key?: string;
  mediaMimeType?: string;
  metadata?: unknown;
}): Promise<{ created: boolean }> {
  const [existing] = await db
    .select({ id: aiRegistrationMessagesTable.id })
    .from(aiRegistrationMessagesTable)
    .where(eq(aiRegistrationMessagesTable.channelMessageId, params.channelMessageId))
    .limit(1);

  if (existing) return { created: false };

  const inserted = await db.insert(aiRegistrationMessagesTable).values({
    id: randomUUID(),
    sessionId: params.sessionId,
    direction: params.direction,
    type: params.type ?? "text",
    channelMessageId: params.channelMessageId,
    body: params.body,
    mediaR2Key: params.mediaR2Key,
    mediaMimeType: params.mediaMimeType,
    metadata: params.metadata as any,
  }).onConflictDoNothing({ target: aiRegistrationMessagesTable.channelMessageId }).returning({ id: aiRegistrationMessagesTable.id });
  if (!inserted.length) return { created: false };

  await db
    .update(aiRegistrationSessionsTable)
    .set({ lastMessageAt: new Date(), expiresAt: await newExpiry(), updatedAt: new Date() })
    .where(eq(aiRegistrationSessionsTable.id, params.sessionId));

  return { created: true };
}

/**
 * Merge new fields into collectedData, recompute missingFields and the
 * resulting currentStep. Used both for normal data gathering and for
 * corrections ("actually my name is X").
 */
export async function mergeCollectedData(
  sessionId: string,
  patch: Record<string, unknown>,
  actor: string = "user",
): Promise<AiRegistrationSession> {
  const [session] = await db
    .select()
    .from(aiRegistrationSessionsTable)
    .where(eq(aiRegistrationSessionsTable.id, sessionId))
    .limit(1);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  const collectedData = { ...(session.collectedData as Record<string, unknown>), ...patch };
  const missingFields = REQUIRED_FIELDS.filter((f) => !collectedData[f]);
  const currentStep = nextStep(missingFields, Boolean(collectedData.passportExtracted || collectedData.manualReview));

  const [updated] = await db
    .update(aiRegistrationSessionsTable)
    .set({ collectedData, missingFields, currentStep, updatedAt: new Date() })
    .where(eq(aiRegistrationSessionsTable.id, sessionId))
    .returning();

  for (const field of Object.keys(patch)) {
    await recordAudit(sessionId, undefined, "field_corrected", actor, { field });
  }

  return updated;
}

function nextStep(missingFields: string[], passportExtracted: boolean): AiSessionStep {
  if (missingFields.includes("fullName")) return "awaiting_name";
  if (missingFields.includes("phone")) return "awaiting_contact";
  if (missingFields.includes("packageId")) return "awaiting_package";
  if (!passportExtracted) return "awaiting_passport_image";
  return "awaiting_confirmation";
}

export async function attachPassportImage(
  sessionId: string,
  params: { r2Key: string; hash: string },
): Promise<AiRegistrationSession> {
  const [session] = await db
    .select()
    .from(aiRegistrationSessionsTable)
    .where(eq(aiRegistrationSessionsTable.id, sessionId))
    .limit(1);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  const attachments = [...((session.attachments as unknown[]) ?? []), { r2Key: params.r2Key, hash: params.hash, at: new Date().toISOString() }];

  const [updated] = await db
    .update(aiRegistrationSessionsTable)
    .set({
      mediaPurgedAt: null,
      passportImageR2Key: params.r2Key,
      passportImageHash: params.hash,
      attachments,
      updatedAt: new Date(),
    })
    .where(eq(aiRegistrationSessionsTable.id, sessionId))
    .returning();

  await recordAudit(sessionId, undefined, "passport_image_received", "user", { r2Key: params.r2Key });
  return updated;
}

export async function recordExtractionResult(
  sessionId: string,
  params: {
    result: unknown;
    provider: "gemini" | "mistral" | "manual";
    fallbackTriggered: boolean;
    fallbackReason?: string;
  },
): Promise<AiRegistrationSession> {
  const [session] = await db
    .select()
    .from(aiRegistrationSessionsTable)
    .where(eq(aiRegistrationSessionsTable.id, sessionId))
    .limit(1);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  const collectedData: Record<string, unknown> = {
    ...(session.collectedData as Record<string, unknown>),
    passportExtracted: true,
  };
  const missingFields = REQUIRED_FIELDS.filter((f) => !collectedData[f]);
  const currentStep = nextStep(missingFields, true);

  const [updated] = await db
    .update(aiRegistrationSessionsTable)
    .set({
      extractionResult: params.result as any,
      extractionProvider: params.provider,
      fallbackTriggered: params.fallbackTriggered,
      fallbackReason: params.fallbackReason,
      extractionAttempts: session.extractionAttempts + 1,
      collectedData,
      missingFields,
      currentStep,
      updatedAt: new Date(),
    })
    .where(eq(aiRegistrationSessionsTable.id, sessionId))
    .returning();

  await recordAudit(sessionId, undefined, "extraction_completed", `ai:${params.provider}`, {
    fallbackTriggered: params.fallbackTriggered,
  });
  return updated;
}

export async function transitionStatus(
  sessionId: string,
  status: AiRegistrationSession["status"],
  actor: string = "system",
): Promise<AiRegistrationSession> {
  const current = await db.query.aiRegistrationSessionsTable.findFirst({ where: eq(aiRegistrationSessionsTable.id, sessionId) });
  if (!current) throw new Error("Registration session not found");
  const transitions: Record<string, string[]> = {
    collecting: ["ready_for_review", "pending_review", "expired", "cancelled"],
    ready_for_review: ["pending_review", "cancelled"], pending_review: ["approved", "rejected"],
    expired: ["collecting", "cancelled"], approved: [], rejected: [], cancelled: [],
  };
  if (!transitions[current.status]?.includes(status)) throw new Error("Invalid registration state transition");
  const [updated] = await db
    .update(aiRegistrationSessionsTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(aiRegistrationSessionsTable.id, sessionId))
    .returning();

  await recordAudit(sessionId, undefined, `status_changed:${status}`, actor);
  return updated;
}

export async function recordAudit(
  sessionId: string | undefined,
  submissionId: string | undefined,
  event: string,
  actor: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db.insert(aiRegistrationAuditTable).values({
    id: randomUUID(),
    sessionId,
    submissionId,
    event,
    actor,
    metadata: metadata as any,
  });
}

/** Mark all collecting sessions past their expiry as expired. Intended for a cron job. */
export async function expireStaleSessions(): Promise<number> {
  const expired = await db
    .update(aiRegistrationSessionsTable)
    .set({ status: "expired", updatedAt: new Date() })
    .where(
      and(
        eq(aiRegistrationSessionsTable.status, "collecting"),
        lt(aiRegistrationSessionsTable.expiresAt, new Date()),
      ),
    )
    .returning({ id: aiRegistrationSessionsTable.id });

  for (const row of expired) {
    await recordAudit(row.id, undefined, "status_changed:expired", "system");
  }
  return expired.length;
}
