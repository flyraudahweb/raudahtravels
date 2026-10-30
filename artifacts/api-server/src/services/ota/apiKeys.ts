import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { db, otaApiKeysTable as keys, otaEventsTable } from "@workspace/db";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { OtaError } from "./provider";
import { getOtaConfig } from "./config";
import { searchKeyScope } from "./apiKeyPolicy";

export const API_KEY_SCOPES = [
  "config:read",
  "flights:read",
  "hotels:read",
] as const;
export const createApiKeySchema = z
  .object({
    name: z.string().trim().min(3).max(80),
    mode: z.enum(["test", "live"]),
    scopes: z
      .array(z.enum(API_KEY_SCOPES))
      .min(1)
      .max(3)
      .transform((values) => [...new Set(values)]),
    expiresInDays: z.number().int().min(1).max(365).default(90),
    requestsPerMinute: z.number().int().min(10).max(60).default(30),
  })
  .strict();
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const publicColumns = {
  id: keys.id,
  name: keys.name,
  prefix: keys.prefix,
  mode: keys.mode,
  scopes: keys.scopes,
  requestsPerMinute: keys.requestsPerMinute,
  createdAt: keys.createdAt,
  expiresAt: keys.expiresAt,
  lastUsedAt: keys.lastUsedAt,
  revokedAt: keys.revokedAt,
};
export async function apiKeyStorageReady() {
  try {
    await db.execute(
      sql`SELECT id, token_hash, mode, scopes, requests_per_minute, request_count, expires_at, revoked_at FROM ota_api_keys LIMIT 0`,
    );
    return true;
  } catch (error: any) {
    if (["42P01", "42703"].includes(error?.code || error?.cause?.code))
      return false;
    throw new OtaError(
      "Integration key storage is temporarily unavailable",
      503,
    );
  }
}
export async function listApiKeys() {
  if (!(await apiKeyStorageReady())) return { storageReady: false, keys: [] };
  return {
    storageReady: true,
    keys: await db
      .select(publicColumns)
      .from(keys)
      .orderBy(desc(keys.createdAt))
      .limit(100),
  };
}
export async function createApiKey(input: unknown, actor: string) {
  const parsed = createApiKeySchema.parse(input);
  if (!(await apiKeyStorageReady()))
    throw new OtaError(
      "Apply migration 0012_ota_api_keys.sql before creating integration keys",
      503,
    );
  const prefix = `otak_${parsed.mode}_${randomBytes(8).toString("hex")}`;
  const secret = `${prefix}.${randomBytes(32).toString("base64url")}`;
  const key = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(keys)
      .values({
        id: randomUUID(),
        name: parsed.name,
        prefix,
        tokenHash: hash(secret),
        mode: parsed.mode,
        scopes: parsed.scopes,
        requestsPerMinute: parsed.requestsPerMinute,
        createdBy: actor,
        expiresAt: new Date(Date.now() + parsed.expiresInDays * 86400000),
      })
      .returning(publicColumns);
    await tx.insert(otaEventsTable).values({
      id: randomUUID(),
      actor,
      action: "api_key_created",
      details: {
        keyId: created.id,
        prefix,
        scopes: created.scopes,
        mode: created.mode,
      },
    });
    return created;
  });
  return { key, secret }; // The raw key is returned once and is never persisted.
}
export async function revokeApiKey(id: string, actor: string) {
  z.string().uuid().parse(id);
  return db.transaction(async (tx) => {
    const [revoked] = await tx
      .update(keys)
      .set({ revokedAt: new Date() })
      .where(and(eq(keys.id, id), isNull(keys.revokedAt)))
      .returning({ id: keys.id });
    if (revoked)
      await tx.insert(otaEventsTable).values({
        id: randomUUID(),
        actor,
        action: "api_key_revoked",
        details: { keyId: id },
      });
    else if (
      !(await tx.select({ id: keys.id }).from(keys).where(eq(keys.id, id)))[0]
    )
      throw new OtaError("Integration key not found", 404);
    return { success: true };
  });
}
export async function optionalSearchApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.get("x-ota-api-key");
  if (token === undefined) {
    next();
    return;
  }
  try {
    const scope = searchKeyScope(req.method, req.path);
    if (!scope)
      throw new OtaError(
        "Search integration keys cannot authorize customer bookings, quotes, webhooks or administration. Use a customer session for customer endpoints.",
        403,
      );
    if (!/^otak_(test|live)_[0-9a-f]{16}\.[A-Za-z0-9_-]{43}$/.test(token))
      throw new OtaError("Invalid integration key", 401);
    const key = await db.query.otaApiKeysTable.findFirst({
      where: and(
        eq(keys.tokenHash, hash(token)),
        isNull(keys.revokedAt),
        sql`${keys.expiresAt}>now()`,
      ),
    });
    if (!key) throw new OtaError("Invalid or expired integration key", 401);
    if (!key.scopes.includes(scope))
      throw new OtaError("Integration key does not have this scope", 403);
    if (key.mode !== (await getOtaConfig()).mode)
      throw new OtaError(
        "Integration key mode does not match the configured travel mode",
        403,
      );
    const result = await db.execute(sql`UPDATE ota_api_keys SET
      request_count=CASE WHEN window_started_at<=now()-interval '60 seconds' THEN 1 ELSE request_count+1 END,
      window_started_at=CASE WHEN window_started_at<=now()-interval '60 seconds' THEN now() ELSE window_started_at END,
      last_used_at=now()
      WHERE id=${key.id} AND revoked_at IS NULL AND expires_at>now()
      AND (window_started_at<=now()-interval '60 seconds' OR request_count<requests_per_minute)
      RETURNING id`);
    if (!result.rows.length) {
      const [current] = await db
        .select({ revoked: keys.revokedAt, expires: keys.expiresAt })
        .from(keys)
        .where(eq(keys.id, key.id));
      if (!current || current.revoked || current.expires <= new Date())
        throw new OtaError("Invalid or expired integration key", 401);
      res.setHeader("Retry-After", "60");
      throw new OtaError("Integration key request limit reached", 429);
    }
    next();
  } catch (error) {
    res.status(error instanceof OtaError ? error.status : 503).json({
      error:
        error instanceof OtaError
          ? error.message
          : "Integration key authentication is unavailable",
    });
  }
}
