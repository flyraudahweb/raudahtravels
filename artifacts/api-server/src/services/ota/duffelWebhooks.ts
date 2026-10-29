import {
  db,
  otaBookingsTable as bookings,
  otaDuffelEventsTable as events,
  otaEventsTable,
} from "@workspace/db";
import { randomUUID, createHash } from "node:crypto";
import { and, eq, isNull, lt, lte, or, asc, desc, sql } from "drizzle-orm";
import { z } from "zod";
import {
  getOtaConfig,
  duffelTokenForMode,
  saveOtaConfig,
  type OtaConfig,
} from "./config";
import { duffelRequest, OtaError, sameSupplierAmount } from "./provider";
import { audit } from "./booking";
import {
  DUFFEL_EVENTS,
  DUFFEL_RECEIVER,
  validDuffelSignature,
} from "./duffelWebhookProtocol";

export function modeConfig(config: OtaConfig, mode: "test" | "live") {
  return { ...config, mode, duffelToken: duffelTokenForMode(config, mode) };
}
export function webhookUrl(mode: "test" | "live") {
  const url = new URL(process.env.APP_URL || "http://localhost:5173");
  return `${url.origin}/api/ota/duffel/webhook/${mode}`;
}
export async function receiverReadiness(mode: "test" | "live") {
  const c = await getOtaConfig();
  let storageReady = true;
  try {
    await db.execute(sql`SELECT id FROM ota_duffel_events LIMIT 0`);
    await db.execute(
      sql`SELECT provider_notice, revision, sync_attempt_at FROM ota_bookings LIMIT 0`,
    );
  } catch {
    storageReady = false;
  }
  return {
    receiver: DUFFEL_RECEIVER,
    mode,
    storageReady,
    signatureConfigured: !!(mode === "test"
      ? c.webhookTestSecret
      : c.webhookLiveSecret),
  };
}
export async function receiveDuffel(
  raw: Buffer,
  signature: string,
  mode: "test" | "live",
) {
  const c = await getOtaConfig(),
    secret = mode === "test" ? c.webhookTestSecret : c.webhookLiveSecret;
  if (!secret)
    throw new OtaError("Duffel webhook signing is not configured", 503);
  if (!validDuffelSignature(raw, signature, secret))
    throw new OtaError("Invalid Duffel signature", 401);
  let body: any;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new OtaError("Invalid event JSON", 400);
  }
  const envelope = z
    .object({
      id: z.string().min(1).max(128).optional(),
      idempotency_key: z.string().min(1).max(128).optional(),
      type: z.string().max(100),
      live_mode: z.boolean().optional(),
      api_version: z.literal("v2").optional(),
      data: z.object({ object: z.record(z.unknown()) }).optional(),
    })
    .parse(body);
  if (
    envelope.live_mode !== undefined &&
    envelope.live_mode !== (mode === "live")
  )
    throw new OtaError("Webhook mode mismatch", 400);
  if (
    envelope.type !== "ping.triggered" &&
    (!envelope.id || envelope.live_mode === undefined)
  )
    throw new OtaError("Invalid event envelope", 400);
  if (
    !DUFFEL_EVENTS.includes(envelope.type as any) &&
    envelope.type !== "ping.triggered"
  )
    return { received: true, ignored: true };
  const object = envelope.data?.object || {};
  const identifier = (v: unknown) =>
    typeof v === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(v) ? v : undefined;
  // Keep only correlation fields; passport, contact and payment details are not stored in the inbox.
  const resource = {
    id: identifier(object.id),
    orderId:
      identifier(object.order_id) || identifier((object.order as any)?.id),
    bookingId: identifier(object.booking_id),
    offerId: identifier(object.offer_id),
    quoteId: identifier(object.quote_id),
    ...(envelope.type === "ping.triggered"
      ? { signingKeyTag: createHash("sha256").update(secret).digest("hex") }
      : {}),
  };
  const eventId = envelope.id || `ping-${signature.slice(-32)}`;
  await db
    .insert(events)
    .values({
      id: `${mode}:${eventId}`,
      dedupeKey: `${mode}:${envelope.type}:${envelope.idempotency_key || eventId}`,
      mode,
      eventType: envelope.type,
      resource,
      ...(envelope.type === "ping.triggered"
        ? { completedAt: new Date() }
        : {}),
    })
    .onConflictDoNothing();
  return { received: true };
}

async function applyEvent(event: typeof events.$inferSelect) {
  const mode = z.enum(["test", "live"]).parse(event.mode);
  const c = modeConfig(await getOtaConfig(), mode),
    resource = event.resource as Record<string, string | undefined>;
  const hotel = event.eventType.startsWith("stays.");
  const failure = event.eventType.endsWith("creation_failed");
  let supplier: any;
  let beforeSupplierRead: typeof bookings.$inferSelect | undefined;
  let providerId = hotel
    ? resource.bookingId || resource.id
    : resource.orderId || resource.id;
  if (
    !hotel &&
    event.eventType.startsWith("order_cancellation.") &&
    providerId &&
    !providerId.startsWith("ord_")
  ) {
    const cancellation = await duffelRequest(
      c,
      `/air/order_cancellations/${encodeURIComponent(providerId)}`,
    );
    providerId = cancellation.order_id;
  }
  if (!failure) {
    if (
      !providerId ||
      !(hotel ? /^bok_[A-Za-z0-9]+$/ : /^ord_[A-Za-z0-9]+$/).test(providerId)
    )
      throw new OtaError("Provider event needs order/booking correlation", 409);
    beforeSupplierRead = await db.query.otaBookingsTable.findFirst({
      where: and(
        eq(bookings.mode, mode),
        eq(bookings.kind, hotel ? "hotel" : "flight"),
        eq(bookings.providerBookingId, providerId),
      ),
    });
    supplier = await duffelRequest(
      c,
      hotel ? `/stays/bookings/${providerId}` : `/air/orders/${providerId}`,
    );
    if (supplier.id !== providerId)
      throw new OtaError("Provider resource mismatch", 409);
  }
  const metadataId = supplier?.metadata?.ota_booking_id;
  const matches = await db.query.otaBookingsTable.findMany({
    where: and(
      eq(bookings.mode, mode),
      eq(bookings.kind, hotel ? "hotel" : "flight"),
      metadataId
        ? eq(bookings.id, String(metadataId))
        : supplier
          ? eq(bookings.providerBookingId, supplier.id)
          : eq(
              bookings.providerOfferId,
              resource.offerId || resource.quoteId || "",
            ),
    ),
    limit: 2,
  });
  if (!matches.length)
    return { issue: "Unmatched event; no Raudah checkout was changed" };
  if (matches.length !== 1)
    throw new OtaError(
      "Multiple checkouts require operator reconciliation",
      409,
    );
  const row = matches[0];
  if (!row.paidAt || row.status === "refunded")
    return {
      bookingId: row.id,
      issue: "Unpaid or refunded checkout was not changed",
    };
  if (failure) {
    if (["processing", "requires_review"].includes(row.status)) {
      const [updated] = await db
        .update(bookings)
        .set({
          revision: sql`${bookings.revision}+1`,
          status: "requires_review",
          issue:
            "Duffel reported reservation creation failure. Reconcile supplier outcome and customer payment; do not book again automatically.",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(bookings.id, row.id),
            eq(bookings.status, row.status),
            eq(bookings.revision, row.revision),
          ),
        )
        .returning();
      if (updated)
        await audit(row.id, "duffel", "supplier_creation_failed", {
          eventId: event.id,
        });
      else
        throw new OtaError("Booking changed; reconcile this event again", 409);
    }
    return { bookingId: row.id };
  }
  if (row.providerBookingId && row.providerBookingId !== supplier.id)
    throw new OtaError(
      "Checkout is already linked to another supplier reservation",
      409,
    );
  if (
    (beforeSupplierRead &&
      (beforeSupplierRead.id !== row.id ||
        beforeSupplierRead.revision !== row.revision)) ||
    (!beforeSupplierRead && row.providerBookingId)
  )
    throw new OtaError(
      "Booking changed while supplier data was being fetched; retry reconciliation",
      409,
    );
  if (metadataId && metadataId !== row.id)
    throw new OtaError("Booking metadata mismatch", 409);
  if (
    !sameSupplierAmount(supplier.total_amount, row.supplierAmount) ||
    supplier.total_currency !== row.supplierCurrency
  )
    throw new OtaError("Supplier amount mismatch; operator review needed", 409);
  const cancelled = !!supplier.cancelled_at || supplier.status === "cancelled";
  if (!cancelled && hotel && supplier.status !== "confirmed")
    throw new OtaError("Supplier reservation is not yet confirmed", 409);
  if (!cancelled && !hotel && !supplier.booking_reference)
    throw new OtaError("Supplier confirmation is incomplete", 409);
  const scheduleChanged =
    !cancelled && event.eventType === "order.airline_initiated_change_detected";
  const notifyChanged =
    scheduleChanged ||
    (cancelled ? row.status !== "cancelled" : row.status !== "confirmed");
  const notice = cancelled
    ? "The supplier has cancelled this reservation. Contact support to review refund options."
    : scheduleChanged
      ? "The airline has updated your itinerary. Review your travel details and contact our team for assistance."
      : row.providerNotice;
  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(bookings)
      .set({
        revision: sql`${bookings.revision}+1`,
        providerBookingId: supplier.id,
        providerResult: supplier,
        status: cancelled ? "cancelled" : "confirmed",
        issue: null,
        providerNotice: notice,
        notificationSentAt: notifyChanged ? null : row.notificationSentAt,
        notificationAttemptAt: notifyChanged ? null : row.notificationAttemptAt,
        syncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bookings.id, row.id),
          eq(bookings.status, row.status),
          eq(bookings.revision, row.revision),
        ),
      )
      .returning();
    if (updated) {
      await tx.insert(otaEventsTable).values({
        id: randomUUID(),
        bookingId: row.id,
        actor: "duffel",
        action:
          cancelled && row.status !== "cancelled"
            ? "supplier_cancellation_detected"
            : scheduleChanged
              ? "itinerary_changed"
              : !cancelled && row.status !== "confirmed"
                ? "provider_confirmed"
                : event.eventType,
        details: { eventId: event.id, providerId: supplier.id },
      });
    } else
      throw new OtaError("Booking changed; reconcile this event again", 409);
  });
  return { bookingId: row.id };
}
export async function processDuffelEvents() {
  const deadline = Date.now() + 60000;
  const ready = and(
    isNull(events.completedAt),
    lt(events.attempts, 10),
    lte(events.availableAt, sql`now()`),
    or(isNull(events.lockedUntil), lt(events.lockedUntil, sql`now()`)),
  );
  const pending = await db.query.otaDuffelEventsTable.findMany({
    where: ready,
    orderBy: asc(events.availableAt),
    limit: 20,
  });
  for (const event of pending) {
    if (Date.now() >= deadline) break;
    const [claim] = await db
      .update(events)
      .set({
        attempts: sql`${events.attempts}+1`,
        lockedUntil: sql`now()+interval '5 minutes'`,
      })
      .where(and(eq(events.id, event.id), ready))
      .returning();
    if (!claim) continue;
    try {
      const result = await applyEvent(claim);
      await db
        .update(events)
        .set({
          issue: null,
          ...result,
          completedAt: new Date(),
          lockedUntil: null,
        })
        .where(eq(events.id, claim.id));
    } catch {
      await db
        .update(events)
        .set({
          issue: "Supplier event needs retry or operator reconciliation",
          lockedUntil: null,
          availableAt: sql`now()+(${Math.min(30, 2 ** claim.attempts)} * interval '1 minute')`,
        })
        .where(eq(events.id, claim.id));
    }
  }
}

export async function webhookStatus(mode: "test" | "live") {
  const c = modeConfig(await getOtaConfig(), mode),
    url = webhookUrl(mode);
  const hooks = await duffelRequest(c, "/air/webhooks");
  return {
    url,
    recommendedEvents: [...DUFFEL_EVENTS],
    hooks: (hooks || []).map((hook: any) => ({
      id: hook.id,
      url: hook.url,
      active: hook.active,
      liveMode: hook.live_mode,
      events: hook.events,
    })),
    secretConfigured: !!(mode === "test"
      ? c.webhookTestSecret
      : c.webhookLiveSecret),
    mode,
  };
}
export async function registerWebhook(mode: "test" | "live", actor: string) {
  const c = modeConfig(await getOtaConfig(), mode),
    status = await webhookStatus(mode);
  if (!status.url.startsWith("https://"))
    throw new OtaError(
      "Set an HTTPS APP_URL on the hosting platform before registration",
      400,
    );
  if (status.hooks.length) {
    const own = status.hooks.find((h: any) => h.url === status.url);
    if (!own)
      throw new OtaError(
        "Duffel already has a webhook for another URL. Review it before changing account-wide routing.",
        409,
      );
    return { ...status, created: false, id: own.id, active: own.active };
  }
  const hook = await duffelRequest(c, "/air/webhooks", "POST", {
    url: status.url,
    events: c.webhookEvents,
  });
  try {
    if (!hook.secret || hook.live_mode !== (mode === "live"))
      throw new OtaError(
        "Webhook creation returned incomplete configuration",
        502,
      );
    await saveOtaConfig(
      mode === "test"
        ? { webhookTestId: hook.id, webhookTestSecret: hook.secret }
        : { webhookLiveId: hook.id, webhookLiveSecret: hook.secret },
      actor,
    );
  } finally {
    // Creation defaults to active in Duffel. Keep it inactive until readiness and a signed ping are verified after deployment.
    await duffelRequest(
      c,
      `/air/webhooks/${encodeURIComponent(hook.id)}`,
      "PATCH",
      { active: false },
    );
  }
  return {
    created: true,
    id: hook.id,
    active: false,
    url: status.url,
    events: hook.events,
    secretStored: true,
  };
}
export async function controlWebhook(
  mode: "test" | "live",
  action: "activate" | "deactivate" | "ping",
) {
  const c = modeConfig(await getOtaConfig(), mode),
    status = await webhookStatus(mode);
  const own = status.hooks.find((h: any) => h.url === status.url);
  if (!own) throw new OtaError("Create the Raudah webhook first", 404);
  if (action !== "deactivate") {
    if (!status.secretConfigured)
      throw new OtaError(
        "Save the webhook signing secret before activation or ping",
        400,
      );
    const response = await fetch(status.url, {
      redirect: "error",
      signal: AbortSignal.timeout(10000),
      headers: { Accept: "application/json" },
    });
    const ready = (await response.json().catch(() => ({}))) as any;
    if (
      !response.ok ||
      ready.receiver !== DUFFEL_RECEIVER ||
      ready.mode !== mode ||
      !ready.storageReady ||
      !ready.signatureConfigured
    )
      throw new OtaError(
        "Deploy the receiver, apply OTA migrations 0010 and 0011 and configure the signing secret before activation",
        409,
      );
  }
  if (action === "ping")
    await duffelRequest(c, `/air/webhooks/${own.id}/actions/ping`, "POST");
  else {
    if (action === "activate") {
      const secret =
        mode === "test" ? c.webhookTestSecret : c.webhookLiveSecret;
      const tag = createHash("sha256").update(secret).digest("hex");
      const ping = await db.query.otaDuffelEventsTable.findFirst({
        where: and(
          eq(events.mode, mode),
          eq(events.eventType, "ping.triggered"),
          sql`${events.createdAt} > now() - interval '30 minutes'`,
          sql`${events.resource}->>'signingKeyTag' = ${tag}`,
        ),
      });
      if (!ping)
        throw new OtaError(
          "Send a ping and wait for its signed delivery to appear before activating this webhook",
          409,
        );
    }
    await duffelRequest(c, `/air/webhooks/${own.id}`, "PATCH", {
      active: action === "activate",
      ...(action === "activate" ? { events: c.webhookEvents } : {}),
    });
  }
  return { success: true, action, id: own.id };
}
export async function recentDuffelEvents() {
  return db.query.otaDuffelEventsTable.findMany({
    orderBy: desc(events.createdAt),
    limit: 30,
  });
}
export async function retryDuffelEvent(id: string) {
  const [event] = await db
    .update(events)
    .set({
      attempts: 0,
      availableAt: sql`now()`,
      lockedUntil: null,
      issue: null,
    })
    .where(
      and(
        eq(events.id, id),
        isNull(events.completedAt),
        or(isNull(events.lockedUntil), lt(events.lockedUntil, sql`now()`)),
      ),
    )
    .returning();
  if (!event)
    throw new OtaError(
      "Only unfinished, unlocked supplier events can be retried",
      409,
    );
  return { success: true };
}
