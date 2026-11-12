import { randomUUID } from "node:crypto";
import { getAuth } from "@clerk/express";
import { Router, type Request, type Response } from "express";
import { and, eq, ilike, inArray, or } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  ehajjConnectionsTable,
  ehajjGrantsTable,
  profilesTable,
  userActivityTable,
} from "@workspace/db";
import {
  agencyKeyField,
  ehajjBaseUrl,
  ehajjClient,
  ehajjDetail,
  ehajjDetailPermission,
  EhajjError,
  ehajjId,
  ehajjPermissions,
  jwtField,
  type EhajjPermission,
} from "../services/ehajj";
import { allowChannelMessage } from "../services/channels/channelRateLimit";
import { encryptSetting } from "../services/registration/config";
import { otaAppOrigin } from "../services/ota/appOrigin";
import {
  prepareRegistration,
  submitRegistration,
  registrationInput,
  listRegistrations,
} from "../services/ehajjRegistrations";

const router = Router();
const connectionId = "primary";
const operators = ["admin", "staff"] as const;
type Actor = Pick<typeof profilesTable.$inferSelect, "id" | "role">;
type Handler = (req: Request, res: Response, actor: Actor) => Promise<unknown>;
const secret = z
  .string()
  .trim()
  .min(1)
  .max(8192)
  .regex(/^[\x21-\x7E]+$/)
  .nullable()
  .optional();
const settingsInput = z
  .object({
    version: z.string().uuid().nullable(),
    enabled: z.boolean(),
    agencyKey: secret,
    jwt: secret,
  })
  .strict();
const grantInput = z
  .object({
    userId: z.string().trim().min(1).max(100),
    productId: ehajjId,
    permissions: z
      .array(z.enum(ehajjPermissions))
      .min(1)
      .max(ehajjPermissions.length),
  })
  .strict();

function protectedRoute(handler: Handler, manage = false) {
  return async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "private, no-store");
    try {
      const { userId } = getAuth(req);
      if (!userId) throw new EhajjError(401, "Sign in to access EHajj.");
      const actor = await db.query.profilesTable.findFirst({
        columns: { id: true, role: true, accountStatus: true },
        where: eq(profilesTable.clerkUserId, userId),
      });
      if (
        !actor ||
        actor.accountStatus !== "active" ||
        (actor.role !== "super_admin" &&
          (manage || (actor.role !== "admin" && actor.role !== "staff")))
      ) {
        throw new EhajjError(
          403,
          "You do not have access to this EHajj action.",
        );
      }
      if (
        !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
        req.headers.origin
      ) {
        const origin = req.headers.origin;
        const permitted = [
          otaAppOrigin(),
          ...(process.env.CORS_ORIGIN || "").split(",").map((v) => v.trim()),
        ];
        if (!permitted.includes(origin))
          throw new EhajjError(403, "Untrusted request origin.");
      }
      return await handler(req, res, actor);
    } catch (error) {
      if (error instanceof EhajjError)
        return res.status(error.status).json({ error: error.message });
      if (error instanceof z.ZodError)
        return res
          .status(400)
          .json({ error: "Check the EHajj request fields." });
      const dbError = error as { code?: string; cause?: { code?: string } };
      if (dbError?.code === "42P01" || dbError?.cause?.code === "42P01") {
        return res.status(503).json({
          error: "Apply the EHajj database migration to finish setup.",
        });
      }
      return res
        .status(500)
        .json({ error: "FlyRaudah could not complete the EHajj request." });
    }
  };
}

const getConnection = () =>
  db.query.ehajjConnectionsTable.findFirst({
    where: eq(ehajjConnectionsTable.id, connectionId),
  });
type Connection = NonNullable<Awaited<ReturnType<typeof getConnection>>>;

function settingsView(connection?: Connection) {
  const baseUrl = ehajjBaseUrl();
  const matches = !!baseUrl && connection?.baseUrl === baseUrl;
  return {
    baseUrl,
    configuredBaseUrl: process.env.EHAJJ_API_BASE_URL?.trim() || null,
    transportIssue:
      process.env.EHAJJ_API_BASE_URL && !baseUrl
        ? "EHajj requires a valid HTTPS API URL before credentials and personal records can be transferred."
        : null,
    version: connection?.version ?? null,
    enabled: matches && !!connection?.enabled,
    hasAgencyKey:
      (matches && !!connection?.agencyKey) || !!process.env.EHAJJ_AGENCY_KEY,
    hasJwt: matches && !!connection?.jwt,
    encryptionReady: /^[a-f0-9]{64}$/i.test(
      process.env.SETTINGS_ENCRYPTION_KEY ?? "",
    ),
  };
}

async function grantsFor(actor: Actor, connection: Connection) {
  if (actor.role === "super_admin") return null;
  return db.query.ehajjGrantsTable.findMany({
    where: and(
      eq(ehajjGrantsTable.userId, actor.id),
      eq(ehajjGrantsTable.agencyScope, connection.agencyScope),
    ),
  });
}

async function readContext(actor: Actor) {
  const connection = await getConnection();
  if (!connection)
    throw new EhajjError(503, "EHajj connection settings have not been saved.");
  const grants = await grantsFor(actor, connection);
  if (grants?.length === 0)
    throw new EhajjError(
      403,
      "No EHajj products are assigned to your account.",
    );
  return { client: ehajjClient(connection), grants };
}

function productPermissions(
  grants: Awaited<ReturnType<typeof grantsFor>>,
  productId: number,
) {
  const permissions =
    grants === null
      ? ehajjPermissions
      : grants.find((grant) => grant.productId === productId)?.permissions;
  if (!permissions?.length)
    throw new EhajjError(403, "This EHajj product is outside your assignment.");
  return new Set(
    ehajjPermissions.filter((permission) => permissions.includes(permission)),
  );
}

function throttle(actor: Actor) {
  if (!allowChannelMessage("ehajj-admin", actor.id, 30)) {
    throw new EhajjError(
      429,
      "Wait a minute before requesting more EHajj records.",
    );
  }
}

router.get(
  "/admin/ehajj/access",
  protectedRoute(async (_req, res, actor) => {
    if (actor.role === "super_admin")
      return res.json({ allowed: true, manage: true });
    if (!ehajjBaseUrl()) return res.json({ allowed: false, manage: false });
    const connection = await getConnection();
    const allowed =
      !!connection?.enabled &&
      connection.baseUrl === ehajjBaseUrl() &&
      !!(await grantsFor(actor, connection))?.length;
    return res.json({ allowed, manage: false });
  }),
);

router.get(
  "/admin/ehajj/settings",
  protectedRoute(
    async (_req, res) => res.json(settingsView(await getConnection())),
    true,
  ),
);

router.put(
  "/admin/ehajj/settings",
  protectedRoute(async (req, res, actor) => {
    const input = settingsInput.parse(req.body);
    const baseUrl = ehajjBaseUrl();
    if (!baseUrl)
      throw new EhajjError(
        400,
        "Set EHAJJ_API_BASE_URL to the approved HTTPS base URL on the server.",
      );
    const previous = await getConnection();
    const conflict = () =>
      new EhajjError(
        409,
        "EHajj settings changed. Reload before saving again.",
      );
    if (input.version !== (previous?.version ?? null)) throw conflict();
    const sameUrl = previous?.baseUrl === baseUrl;
    let agencyKey = sameUrl ? previous.agencyKey : null;
    let jwt = sameUrl ? previous.jwt : null;
    const scopeChanged = !sameUrl || input.agencyKey !== undefined;
    try {
      if (input.agencyKey !== undefined)
        agencyKey = input.agencyKey
          ? encryptSetting(input.agencyKey, agencyKeyField)
          : null;
      if (scopeChanged) jwt = null;
      if (input.jwt !== undefined)
        jwt = input.jwt ? encryptSetting(input.jwt, jwtField) : null;
      if (
        input.agencyKey === undefined &&
        !agencyKey &&
        process.env.EHAJJ_AGENCY_KEY
      )
        agencyKey = encryptSetting(
          process.env.EHAJJ_AGENCY_KEY,
          agencyKeyField,
        );
    } catch {
      throw new EhajjError(
        503,
        "Set the server encryption key before saving EHajj credentials.",
      );
    }
    if (input.enabled && !agencyKey)
      throw new EhajjError(400, "Save an agency key before enabling EHajj.");
    const values = {
      baseUrl,
      agencyKey,
      jwt,
      enabled: input.enabled,
      version: randomUUID(),
      agencyScope: scopeChanged ? randomUUID() : previous.agencyScope,
      updatedAt: new Date(),
    };
    const saved = await db.transaction(async (tx) => {
      const [row] = previous
        ? await tx
            .update(ehajjConnectionsTable)
            .set(values)
            .where(
              and(
                eq(ehajjConnectionsTable.id, connectionId),
                eq(ehajjConnectionsTable.version, previous.version),
              ),
            )
            .returning()
        : await tx
            .insert(ehajjConnectionsTable)
            .values({ id: connectionId, ...values })
            .onConflictDoNothing()
            .returning();
      if (!row) throw conflict();
      if (previous && scopeChanged) {
        await tx
          .delete(ehajjGrantsTable)
          .where(eq(ehajjGrantsTable.agencyScope, previous.agencyScope));
      }
      await tx.insert(userActivityTable).values({
        id: randomUUID(),
        userId: actor.id,
        eventType: "ehajj_settings_updated",
        metadata: { enabled: row.enabled, agencyScopeChanged: scopeChanged },
      });
      return row;
    });
    return res.json(settingsView(saved));
  }, true),
);

router.get(
  "/admin/ehajj/products",
  protectedRoute(async (_req, res, actor) => {
    throttle(actor);
    const { client, grants } = await readContext(actor);
    const products = await client.products();
    return res.json({
      products: products
        .filter(
          (product) =>
            grants === null ||
            grants.some((grant) => grant.productId === product.id),
        )
        .map((product) => ({
          ...product,
          permissions: [...productPermissions(grants, product.id)],
        })),
    });
  }),
);

router.get(
  "/admin/ehajj/products/:productId/pilgrims",
  protectedRoute(async (req, res, actor) => {
    const productId = ehajjId.parse(req.params.productId);
    throttle(actor);
    const { client, grants } = await readContext(actor);
    const permissions = productPermissions(grants, productId);
    return res.json({
      pilgrims: await client.pilgrims(productId, permissions.has("finance")),
    });
  }),
);

router.get(
  "/admin/ehajj/products/:productId/pilgrims/:pilgrimId/:view",
  protectedRoute(async (req, res, actor) => {
    const productId = ehajjId.parse(req.params.productId);
    const pilgrimId = ehajjId.parse(req.params.pilgrimId);
    const view = ehajjDetail.parse(req.params.view);
    throttle(actor);
    const { client, grants } = await readContext(actor);
    const permissions: Set<EhajjPermission> = productPermissions(
      grants,
      productId,
    );
    if (!permissions.has(ehajjDetailPermission[view])) {
      throw new EhajjError(403, "You do not have access to this EHajj view.");
    }
    // Verify membership against the authorized product before using a pilgrim ID.
    if (
      !(await client.pilgrims(productId, false)).some(
        (pilgrim) => pilgrim.id === pilgrimId,
      )
    ) {
      throw new EhajjError(
        404,
        "This pilgrim is outside the selected EHajj product.",
      );
    }
    const sections = await client.detail(view, pilgrimId, permissions);
    if (view === "documents") {
      await db.insert(userActivityTable).values({
        id: randomUUID(),
        userId: actor.id,
        eventType: "ehajj_documents_viewed",
        metadata: { productId, pilgrimId },
      });
    }
    return res.json({ sections });
  }),
);

router.get(
  "/admin/ehajj/operators",
  protectedRoute(async (req, res) => {
    const search = z
      .string()
      .trim()
      .max(120)
      .parse(req.query.search ?? "");
    if (search.length < 2) return res.json({ operators: [] });
    const people = await db.query.profilesTable.findMany({
      columns: { id: true, fullName: true, email: true, role: true },
      where: and(
        inArray(profilesTable.role, [...operators]),
        eq(profilesTable.accountStatus, "active"),
        or(
          ilike(profilesTable.fullName, "%" + search + "%"),
          ilike(profilesTable.email, "%" + search + "%"),
        ),
      ),
      limit: 25,
    });
    return res.json({ operators: people });
  }, true),
);

router.get(
  "/admin/ehajj/grants/:userId",
  protectedRoute(async (req, res) => {
    const userId = z.string().min(1).max(100).parse(req.params.userId);
    const connection = await getConnection();
    const grants = connection
      ? await db.query.ehajjGrantsTable.findMany({
          columns: { productId: true, permissions: true },
          where: and(
            eq(ehajjGrantsTable.userId, userId),
            eq(ehajjGrantsTable.agencyScope, connection.agencyScope),
          ),
        })
      : [];
    return res.json({ grants });
  }, true),
);

router.put(
  "/admin/ehajj/grants",
  protectedRoute(async (req, res, actor) => {
    const input = grantInput.parse(req.body);
    throttle(actor);
    const target = await db.query.profilesTable.findFirst({
      columns: { id: true },
      where: and(
        eq(profilesTable.id, input.userId),
        inArray(profilesTable.role, [...operators]),
        eq(profilesTable.accountStatus, "active"),
      ),
    });
    if (!target)
      throw new EhajjError(404, "Select an active admin or staff account.");
    const connection = await getConnection();
    if (!connection)
      throw new EhajjError(
        503,
        "Save an EHajj connection before assigning products.",
      );
    if (
      !(await ehajjClient(connection).products()).some(
        (product) => product.id === input.productId,
      )
    ) {
      throw new EhajjError(
        404,
        "Select an active product from the connected agency.",
      );
    }
    const permissions = [...new Set(input.permissions)];
    await db.transaction(async (tx) => {
      await tx
        .insert(ehajjGrantsTable)
        .values({
          ...input,
          permissions,
          agencyScope: connection.agencyScope,
        })
        .onConflictDoUpdate({
          target: [
            ehajjGrantsTable.userId,
            ehajjGrantsTable.agencyScope,
            ehajjGrantsTable.productId,
          ],
          set: { permissions },
        });
      await tx.insert(userActivityTable).values({
        id: randomUUID(),
        userId: actor.id,
        eventType: "ehajj_grant_saved",
        metadata: { ...input, permissions },
      });
    });
    return res.json({ saved: true });
  }, true),
);

router.delete(
  "/admin/ehajj/grants/:userId/:productId",
  protectedRoute(async (req, res, actor) => {
    const userId = z.string().min(1).max(100).parse(req.params.userId);
    const productId = ehajjId.parse(req.params.productId);
    const connection = await getConnection();
    if (connection)
      await db.transaction(async (tx) => {
        await tx
          .delete(ehajjGrantsTable)
          .where(
            and(
              eq(ehajjGrantsTable.userId, userId),
              eq(ehajjGrantsTable.productId, productId),
              eq(ehajjGrantsTable.agencyScope, connection.agencyScope),
            ),
          );
        await tx.insert(userActivityTable).values({
          id: randomUUID(),
          userId: actor.id,
          eventType: "ehajj_grant_revoked",
          metadata: { userId, productId },
        });
      });
    return res.json({ revoked: true });
  }, true),
);

router.get(
  "/admin/ehajj/payment-options",
  protectedRoute(async (_req, res, actor) => {
    throttle(actor);
    const { client } = await readContext(actor);
    const [banks, accounts] = await Promise.all([
      client.banks(),
      client.bankAccounts(),
    ]);
    return res.json({ banks, accounts });
  }, true),
);

router.get(
  "/admin/ehajj/registrations",
  protectedRoute(
    async (_req, res) => res.json({ registrations: await listRegistrations() }),
    true,
  ),
);

router.post(
  "/admin/ehajj/registrations/prepare",
  protectedRoute(async (req, res, actor) => {
    throttle(actor);
    return res.json({
      registration: await prepareRegistration(
        registrationInput.parse(req.body),
        actor.id,
      ),
    });
  }, true),
);

router.post(
  "/admin/ehajj/registrations/:id/submit",
  protectedRoute(async (req, res, actor) => {
    throttle(actor);
    const id = z.string().uuid().parse(req.params.id);
    const input = z
      .object({ confirmed: z.literal(true), version: z.string().uuid() })
      .strict()
      .parse(req.body);
    return res.json({
      registration: await submitRegistration(id, input.version, actor.id),
    });
  }, true),
);

export default router;
