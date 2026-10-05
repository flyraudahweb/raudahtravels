import { registrationDb as db } from "./database";
import { availablePackages } from "./packages";
import { extractionFields, reviewFieldsSchema } from "./validation";
import { imageMime } from "../channels/media";
import { aiRegistrationSessionsTable, aiRegistrationSubmissionsTable, profilesTable, notificationsTable, type AiRegistrationSession } from "@workspace/db";
import { eq, sql, inArray } from "drizzle-orm";
import { createHash, randomUUID } from "crypto";
import { isR2Configured, uploadToR2 } from "../../lib/r2";
import { extractPassport } from "../passport/PassportExtractionService";
import { detectDuplicate } from "./DuplicateDetectionService";
import type { NormalizedInboundMessage } from "../channels/ChannelAdapter";
import {
  getOrCreateSession,
  recordMessage,
  mergeCollectedData,
  attachPassportImage,
  recordExtractionResult,
  transitionStatus,
  recordAudit,
} from "./ConversationService";

/** Re-exported so adapters/routes importing from here keep one source of truth. */
export type InboundMessage = NormalizedInboundMessage;

export interface AgentTurnResult {
  session: AiRegistrationSession;
  /** True when this inbound message was a duplicate delivery and was skipped */
  deduped: boolean;
  /** Set when the agent has something to say back to the user on this turn */
  reply?: { text: string; buttons?: Array<{ id: string; label: string }> };
}

/**
 * Single entry point for both WhatsApp and Telegram adapters. Advances the
 * conversation by one turn: records the message, folds in whatever data the
 * message carried (text answer or a passport image), and — once nothing is
 * missing — runs duplicate detection and creates the review submission.
 */
export async function handleInboundMessage(msg: InboundMessage): Promise<AgentTurnResult> {
  let session = await getOrCreateSession(msg.channel, msg.channelUserId);

  let resumed = false;
  const firstTurn = !session.lastMessageAt;
  if (session.status === "expired") {
    const command = msg.text?.trim().replace(/^\//, "").toLowerCase();
    if (command === "resume") {
      session = await transitionStatus(session.id, "collecting", "user");
      if (!session.passportImageR2Key) session = await mergeCollectedData(session.id, { passportExtracted: false, manualReview: false, confirmed: false });
      resumed = true;
    }
    else if (command === "restart") {
      await transitionStatus(session.id, "cancelled", "user");
      session = await getOrCreateSession(msg.channel, msg.channelUserId);
      resumed = true;
    } else {
      const recorded = await recordMessage({ sessionId: session.id, direction: "inbound", type: msg.type,
        channelMessageId: `${msg.channel}:${msg.channelMessageId}`, body: msg.type === "text" ? msg.text : undefined });
      return { session, deduped: !recorded.created, reply: { text: "Your registration expired. Resume your details or start again?",
      buttons: [{ id: "resume", label: "Resume" }, { id: "restart", label: "Start again" }] } };
    }
  }
  if (!session.displayName && (msg.displayName || msg.telegramUsername || msg.phone)) {
    const [updated] = await db
      .update(aiRegistrationSessionsTable)
      .set({
        displayName: msg.displayName ?? session.displayName,
        telegramUsername: msg.telegramUsername ?? session.telegramUsername,
        phone: msg.phone ?? session.phone,
        updatedAt: new Date(),
      })
      .where(eq(aiRegistrationSessionsTable.id, session.id))
      .returning();
    session = updated;
  }

  const { created } = await recordMessage({
    sessionId: session.id,
    direction: "inbound",
    type: msg.type,
    channelMessageId: `${msg.channel}:${msg.channelMessageId}`,
    body: msg.type === "text" || msg.type === "button" ? msg.text : undefined,
  });
  if (!created) {
    return { session, deduped: true };
  }

  if (resumed) return { session, deduped: false, reply: await buildReply(session) };
  if (session.status === "pending_review") return { session, deduped: false, reply: await buildReply(session) };
  if (/^\/bulk(?:\s|$)/i.test(msg.text?.trim() ?? "")) {
    const match = msg.text?.trim().match(/^\/bulk\s+(\d+)$/i);
    const count = Number(match?.[1]);
    if (!Number.isInteger(count) || count < 2 || count > 20) return { session, deduped: false, reply: { text: "Send /bulk followed by a number from 2 to 20, for example /bulk 3. Each pilgrim needs a separate passport and confirmation." } };
    if ((session.collectedData as any).fullName || session.passportImageR2Key || (session.collectedData as any).bulkId) return { session, deduped: false, reply: { text: "Finish this pilgrim or send /cancel before starting a bulk registration." } };
    session = await mergeCollectedData(session.id, { bulkId: randomUUID(), bulkSize: count, bulkIndex: 1 });
    return { session, deduped: false, reply: { text: `Registering ${count} pilgrims. We'll reuse the contact number and package; each pilgrim will be reviewed separately. Pilgrim 1 of ${count}: what's their full name?` } };
  }
  if (firstTurn && /^(hi|hello|hey|\/start)$/i.test(msg.text?.trim() ?? "")) return { session, deduped: false, reply: await buildReply(session) };
  if (/^\/?cancel$/i.test(msg.text?.trim() ?? "")) {
    session = await transitionStatus(session.id, "cancelled", "user");
    return { session, deduped: false, reply: { text: "Registration cancelled. Send /start to begin again." } };
  }
  let current = session;

  if ((msg.type === "image" || msg.type === "document") && msg.mediaBase64) {
    current = await handlePassportImage(current, msg.mediaBase64, msg.mediaMimeType, msg.channelMessageId);
  } else if ((msg.type === "text" || msg.type === "button") && msg.text) {
    current = await handleTextAnswer(current, msg.text);
  }

  if (isReadyForSubmission(current)) {
    current = await finalizeSubmission(current);
    const data = current.collectedData as Record<string, any>;
    if (data.bulkId && data.bulkIndex < data.bulkSize) {
      const next = await getOrCreateSession(msg.channel, msg.channelUserId, true);
      const nextSession = await mergeCollectedData(next.id, { bulkId: data.bulkId, bulkSize: data.bulkSize, bulkIndex: data.bulkIndex + 1,
        phone: data.phone, packageId: data.packageId });
      return { session: nextSession, deduped: false, reply: { text: `Pilgrim ${data.bulkIndex} submitted for review. Pilgrim ${data.bulkIndex + 1} of ${data.bulkSize}: what's their full name? Send a separate passport photo for this pilgrim.` } };
    }
  }

  return { session: current, deduped: false, reply: await buildReply(current) };
}

/** Picks the next prompt to send back to the user based on where the session landed. */
async function buildReply(session: AiRegistrationSession): Promise<AgentTurnResult["reply"]> {
  if (session.status === "pending_review") {
    const data = session.collectedData as Record<string, any>;
    return { text: data.bulkId ? `All ${data.bulkSize} pilgrims have been submitted for separate staff review. We'll send each outcome here.` : "Thanks! Your registration has been submitted for review. We'll notify you once it's approved." };
  }
  switch (session.currentStep) {
    case "awaiting_name":
      return { text: "Welcome! Let's get you registered. What's your full name?" };
    case "awaiting_contact":
      return { text: "Thanks. What's the best phone number to reach you on?" };
    case "awaiting_package": {
      const options = (await availablePackages()).slice(0, 3);
      return { text: "Choose a package below, send its name, or send 'staff' for help choosing.",
        buttons: options.map((p) => ({ id: p.id, label: p.name.slice(0, 20) })) };
    }
    case "awaiting_passport_image":
      return { text: "Please send a clear photo of your passport's data page." };
    case "awaiting_confirmation":
      return {
        text: `Please confirm: Name: ${(session.collectedData as any).fullName}; Phone: ${(session.collectedData as any).phone}. Staff will check your passport. Send 'name: ...' or 'phone: ...' to correct your details.`,
        buttons: [{ id: "confirm", label: "Yes, submit" }],
      };
    default:
      return undefined;
  }
}

/** Very small heuristic step router — the step tells us what field a plain-text reply fills. */
async function handleTextAnswer(
  session: AiRegistrationSession,
  text: string,
): Promise<AiRegistrationSession> {
  const trimmed = text.trim();
  if (!trimmed) return session;

  const correction = trimmed.match(/^(?:actually\s+)?(?:my\s+)?(name|phone|email|passport(?: number)?)\s*(?:is|:|=)\s*(.+)$/i);
  if (correction) {
    const field = ({ name: "fullName", phone: "phone", email: "email", passport: "passportNumber", "passport number": "passportNumber" } as Record<string, string>)[correction[1].toLowerCase()];
    const patch = reviewFieldsSchema.safeParse({ [field]: correction[2] });
    if (!patch.success) return session;
    return mergeCollectedData(session.id, { ...patch.data, confirmed: false });
  }
  switch (session.currentStep) {
    case "awaiting_name":
      if (!reviewFieldsSchema.safeParse({ fullName: trimmed }).success) return session;
      return mergeCollectedData(session.id, { fullName: trimmed });
    case "awaiting_contact":
      if (!reviewFieldsSchema.safeParse({ phone: trimmed }).success) return session;
      return mergeCollectedData(session.id, { phone: trimmed });
    case "awaiting_package": {
      if (/^(staff|skip)$/i.test(trimmed)) return mergeCollectedData(session.id, { packageId: "staff_assign" });
      const selected = (await availablePackages()).find((p) => p.id === trimmed || p.name.toLowerCase() === trimmed.toLowerCase());
      return selected ? mergeCollectedData(session.id, { packageId: selected.id }) : session;
    }
    case "awaiting_confirmation":
      if (/^(yes|confirm|y)$/i.test(trimmed)) {
        return mergeCollectedData(session.id, { confirmed: true });
      }
      return session;
    default:
      // Treat as a correction to an already-collected field set by the caller's UI/button flow.
      return session;
  }
}

async function handlePassportImage(
  session: AiRegistrationSession,
  mediaBase64: string,
  mediaMimeType: string | undefined,
  channelMessageId: string,
): Promise<AiRegistrationSession> {
  const buffer = Buffer.from(mediaBase64, "base64");
  const mime = imageMime(buffer);
  if (!await isR2Configured()) throw new Error("Passport storage unavailable");
  const hash = createHash("sha256").update(buffer).digest("hex");

  let r2Key = session.passportImageR2Key ?? "";
  if (await isR2Configured()) {
    r2Key = `passports/ai/${session.channel}/${createHash("sha256").update(channelMessageId).digest("hex")}.image`;
    await uploadToR2(r2Key, buffer, mime);
  }

  let current = await attachPassportImage(session.id, { r2Key, hash });

  current = await mergeCollectedData(session.id, { passportExtracted: false, manualReview: false, confirmed: false });
  const outcome = await extractPassport(mediaBase64, mime);

  if (!outcome.ok || !outcome.data) {
    await recordAudit(session.id, undefined, "extraction_failed", "system", {
      fallbackTriggered: outcome.fallbackTriggered,
      reason: outcome.fallbackReason ?? outcome.error?.message,
    });
    await db.update(aiRegistrationSessionsTable).set({ extractionResult: null, extractionProvider: null,
      fallbackTriggered: outcome.fallbackTriggered, fallbackReason: "Providers unavailable",
      extractionAttempts: sql`${aiRegistrationSessionsTable.extractionAttempts} + 1` }).where(eq(aiRegistrationSessionsTable.id, session.id));
    return mergeCollectedData(session.id, { manualReview: true });
  }

  if (outcome.data.isAcceptableQuality === false) {
    await recordAudit(session.id, undefined, "extraction_rejected_quality", `ai:${outcome.provider}`, {
      rejectionReason: outcome.data.rejectionReason,
    });
    return current;
  }

  current = await recordExtractionResult(session.id, {
    result: outcome.data,
    provider: outcome.provider ?? "manual",
    fallbackTriggered: outcome.fallbackTriggered,
    fallbackReason: outcome.fallbackReason,
  });

  return mergeCollectedData(current.id, extractionFields(outcome.data as unknown as Record<string, unknown>), "ai");
}

function isReadyForSubmission(session: AiRegistrationSession): boolean {
  if (session.status !== "collecting") return false;
  const missing = (session.missingFields as string[]) ?? [];
  const data = session.collectedData as Record<string, unknown>;
  return missing.length === 0 && Boolean(data.passportExtracted || data.manualReview) && Boolean(data.confirmed);
}

async function finalizeSubmission(session: AiRegistrationSession): Promise<AiRegistrationSession> {
  await transitionStatus(session.id, "ready_for_review");
  const data = session.collectedData as Record<string, unknown>;

  const duplicate = await detectDuplicate({
    passportImageHash: session.passportImageHash,
    excludeSessionId: session.id,
    passportNumber: data.passportNumber as string | undefined,
    phone: data.phone as string | undefined,
    email: data.email as string | undefined,
    fullName: data.fullName as string | undefined,
    dateOfBirth: data.dateOfBirth as string | undefined,
  });

  await db
    .update(aiRegistrationSessionsTable)
    .set({
      duplicateStatus: duplicate.status,
      duplicateMatches: duplicate.matches as any,
      duplicateCheckedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(aiRegistrationSessionsTable.id, session.id));

  await db.insert(aiRegistrationSubmissionsTable).values({
    id: randomUUID(),
    sessionId: session.id,
    snapshot: { ...data, packageId: data.packageId === "staff_assign" ? null : data.packageId, extractionResult: session.extractionResult },
    passportImageR2Key: session.passportImageR2Key,
    passportImageHash: session.passportImageHash,
    extractionProvider: session.extractionProvider,
    duplicateStatus: duplicate.status,
    duplicateMatches: duplicate.matches as any,
    status: "pending_review",
  });

  const reviewers = await db.select({ id: profilesTable.id }).from(profilesTable).where(inArray(profilesTable.role, ["admin", "super_admin"]));
  if (reviewers.length) await db.insert(notificationsTable).values(reviewers.map((profile) => ({ id: randomUUID(), userId: profile.id,
    title: "AI registration awaiting review", message: "A channel registration is ready for review.", type: "booking" as const, link: "/admin/ai-registrations" })));
  const updated = await transitionStatus(session.id, "pending_review", "system");
  await recordAudit(session.id, undefined, "submission_created", "system", { duplicateStatus: duplicate.status });
  return updated;
}
