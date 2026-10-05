import { sql } from "drizzle-orm";
import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { r2Client, BUCKET_NAME, isR2Configured } from "../../lib/r2";
import { registrationDb as db, registrationTransaction } from "./database";

interface RetainedSession { id: string; passport_image_r2_key: string | null; attachments: Array<{ r2Key?: string }> }

export async function purgeRetainedMedia(): Promise<number> {
  if (!await isR2Configured()) return 0;
  const purged = await registrationTransaction(async () => {
    const result = await db.execute(sql`SELECT * FROM ai_registration_sessions
      WHERE status IN ('rejected', 'expired', 'cancelled') AND media_purged_at IS NULL
        AND updated_at < now() - interval '30 days' ORDER BY updated_at FOR UPDATE SKIP LOCKED LIMIT 50`);
    const rows = (result as unknown as { rows: RetainedSession[] }).rows;
    for (const row of rows) {
      const keys = new Set([row.passport_image_r2_key, ...row.attachments.map((a) => a.r2Key)].filter((key): key is string => Boolean(key)));
      for (const key of keys) {
        if (!key.startsWith("passports/ai/")) throw new Error("Unexpected retention object key");
        await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
      }
      // DeleteObject is idempotent: a crash between deletion and commit is safe to retry.
      await db.execute(sql`UPDATE ai_registration_sessions SET passport_image_r2_key = NULL, attachments = '[]'::json, media_purged_at = now() WHERE id = ${row.id}`);
      await db.execute(sql`UPDATE ai_registration_submissions SET passport_image_r2_key = NULL, media_purged_at = now() WHERE session_id = ${row.id}`);
      await db.execute(sql`UPDATE ai_registration_messages SET media_r2_key = NULL WHERE session_id = ${row.id}`);
    }
    await db.execute(sql`UPDATE ai_registration_jobs SET payload = '{}'::jsonb, status = 'completed', completed_at = COALESCE(completed_at, now()) WHERE status IN ('completed', 'failed') AND created_at < now() - interval '30 days'`);
    return rows.length;
  });
  await purgeOrphans();
  return purged;
}

// A failed/rolled-back first photo can leave an object without a session.
// Wait 30 days and preserve every current session/submission attachment.
async function purgeOrphans() {
  let continuation: string | undefined;
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  do {
    const page = await r2Client.send(new ListObjectsV2Command({ Bucket: BUCKET_NAME, Prefix: "passports/ai/", ContinuationToken: continuation }));
    const keys = (page.Contents ?? []).filter((object) => object.Key && object.LastModified && object.LastModified.getTime() < cutoff).map((object) => object.Key!);
    if (keys.length) {
      const keyJson = JSON.stringify(keys);
      const result = await db.execute(sql`SELECT passport_image_r2_key, attachments FROM ai_registration_sessions
        WHERE passport_image_r2_key IN (SELECT jsonb_array_elements_text(${keyJson}::jsonb))
        OR EXISTS (SELECT 1 FROM json_array_elements(attachments) a WHERE a->>'r2Key' IN (SELECT jsonb_array_elements_text(${keyJson}::jsonb)))`);
      const referenced = new Set<string>();
      for (const row of (result as unknown as { rows: RetainedSession[] }).rows) {
        if (row.passport_image_r2_key) referenced.add(row.passport_image_r2_key);
        for (const attachment of row.attachments) if (attachment.r2Key) referenced.add(attachment.r2Key);
      }
      const submissions = await db.execute(sql`SELECT passport_image_r2_key FROM ai_registration_submissions
        WHERE passport_image_r2_key IN (SELECT jsonb_array_elements_text(${keyJson}::jsonb))`);
      for (const row of (submissions as unknown as { rows: Array<{ passport_image_r2_key: string }> }).rows) referenced.add(row.passport_image_r2_key);
      for (const key of keys) if (!referenced.has(key)) await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    }
    continuation = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuation);
}
