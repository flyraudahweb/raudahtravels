import { getRegistrationConfig } from "../registration/config";
import { sql } from "drizzle-orm";
import { registrationDb as db, registrationTransaction } from "../registration/database";
import { handleInboundMessage } from "../registration/RegistrationAgentService";
import { recordMessage } from "../registration/ConversationService";
import { WhatsAppAdapter } from "./WhatsAppAdapter";
import { TelegramAdapter } from "./TelegramAdapter";
import { UnsupportedMediaError } from "./media";
import type { NormalizedInboundMessage, OutboundReply, AiChannel } from "./ChannelAdapter";
import { logger } from "../../lib/logger";

export const rowsOf = <T>(result: unknown): T[] => (result as { rows?: T[] }).rows ?? [];

// Persist before acknowledging the platform. Duplicate retries are harmless.
export async function enqueueInbound(messages: NormalizedInboundMessage[]) {
  await registrationTransaction(async () => {
    for (const sender of [...new Set(messages.map((m) => `${m.channel}:${m.channelUserId}`))].sort()) {
      await db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${sender}, 0))`);
    }
    for (const msg of messages) {
      const key = `in:${msg.channel}:${msg.channelMessageId}`;
      const exists = rowsOf(await db.execute(sql`SELECT id FROM ai_registration_jobs WHERE dedupe_key = ${key}`));
      if (exists.length) continue;
      const [count] = rowsOf<{ count: string }>(await db.execute(sql`SELECT count(*) FROM ai_registration_jobs
        WHERE channel = ${msg.channel} AND channel_user_id = ${msg.channelUserId} AND direction = 'inbound' AND created_at > now() - interval '1 minute'`));
      const throttled = Number(count.count) >= (await getRegistrationConfig()).rateLimitPerMin;
      await db.execute(sql`INSERT INTO ai_registration_jobs(dedupe_key, direction, channel, channel_user_id, payload, status, completed_at)
        VALUES (${key}, 'inbound', ${msg.channel}, ${msg.channelUserId}, ${JSON.stringify(throttled ? {} : msg)}::jsonb,
          ${throttled ? 'completed' : 'pending'}, ${throttled ? new Date() : null}) ON CONFLICT (dedupe_key) DO NOTHING`);
    }
  });
}

export async function enqueueReply(channel: AiChannel, userId: string, reply: OutboundReply, dedupeKey: string, sessionId?: string) {
  await db.execute(sql`INSERT INTO ai_registration_jobs(dedupe_key, direction, channel, channel_user_id, payload, session_id)
    VALUES (${dedupeKey}, 'outbound', ${channel}, ${userId}, ${JSON.stringify(reply)}::jsonb, ${sessionId ?? null})
    ON CONFLICT (dedupe_key) DO NOTHING`);
}

interface Job { id: string; dedupe_key: string; direction: string; channel: AiChannel; channel_user_id: string;
  session_id: string | null; payload: NormalizedInboundMessage & OutboundReply; attempts: number }

export async function processNextJob(): Promise<boolean> {
  let job: Job | undefined;
  try {
    return await registrationTransaction(async () => {
      // Preserve sender order, even when an earlier message is backing off.
      [job] = rowsOf<Job>(await db.execute(sql`SELECT j.* FROM ai_registration_jobs j
        WHERE j.status = 'pending' AND j.available_at <= now()
        AND NOT EXISTS (SELECT 1 FROM ai_registration_jobs earlier WHERE earlier.status IN ('pending', 'failed')
          AND earlier.channel = j.channel AND earlier.channel_user_id = j.channel_user_id
          AND earlier.direction = j.direction AND earlier.sequence < j.sequence)
        ORDER BY j.sequence FOR UPDATE OF j SKIP LOCKED LIMIT 1`));
      if (!job) return false;
      const adapter = job.channel === "whatsapp" ? WhatsAppAdapter : TelegramAdapter;
      if (job.direction === "inbound") {
        let msg = job.payload;
        try {
          if ((msg.type === "image" || msg.type === "document") && msg.text) {
            const media = await adapter.fetchMedia({ mediaId: msg.text });
            msg = { ...msg, mediaBase64: media.base64, mediaMimeType: media.mimeType };
          }
          const result = await handleInboundMessage(msg);
          if (!result.deduped && result.reply) await enqueueReply(job.channel, job.channel_user_id, result.reply, `reply:${job.id}`, result.session.id);
          await db.execute(sql`UPDATE ai_registration_jobs SET session_id = ${result.session.id} WHERE id = ${job.id}`);
        } catch (err) {
          if (!(err instanceof UnsupportedMediaError)) throw err;
          await enqueueReply(job.channel, job.channel_user_id, { text: "Please send a JPEG, PNG, or WebP passport image, maximum 8 MB." }, `reply:${job.id}`);
        }
      } else {
        await adapter.sendReply(job.channel_user_id, job.payload);
        if (job.session_id) await recordMessage({ sessionId: job.session_id, direction: "outbound", channelMessageId: `out:${job.id}`, body: job.payload.text });
      }
      await db.execute(sql`UPDATE ai_registration_jobs SET status = 'completed', payload = '{}'::jsonb, completed_at = now(), last_error = NULL WHERE id = ${job.id}`);
      return true;
    });
  } catch {
    if (!job) throw new Error("Channel queue unavailable");
    const failed = job.attempts + 1 >= 6;
    await db.execute(sql`UPDATE ai_registration_jobs SET attempts = attempts + 1, status = ${failed ? 'failed' : 'pending'},
      available_at = now() + ${Math.min(300, 2 ** job.attempts)} * interval '1 second', last_error = 'Channel processing failed' WHERE id = ${job.id} AND status = 'pending'`);
    logger.warn({ jobId: job.id, failed }, "Channel job failed; see admin queue metrics");
    return true;
  }
}

export function startChannelWorker() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { if (!(await getRegistrationConfig()).enabled) return; for (let i = 0; i < 10 && await processNextJob(); i++); }
    catch { logger.error("AI registration queue is unavailable; check database migrations"); }
    finally { running = false; }
  };
  const timer = setInterval(tick, 1000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
