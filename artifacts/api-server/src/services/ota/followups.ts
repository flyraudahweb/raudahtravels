import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export const followupReasons = ["callback", "payment_review", "supplier_review", "fare_changed", "unavailable", "expired", "unpaid"] as const;

export async function trackCheckoutBlocker(bookingId: string, revision: number, blocker: "fare_changed" | "unavailable") {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM ota_bookings WHERE id = ${bookingId} FOR UPDATE`);
    await tx.execute(sql`
    INSERT INTO ota_followups (id, booking_id, clerk_user_id, kind, trip, blocker, blocked_revision)
    SELECT id, id, clerk_user_id, kind, 'Saved travel checkout', ${blocker}, revision
    FROM ota_bookings
    WHERE id = ${bookingId} AND revision = ${revision} AND mode = 'live' AND status = 'payment_pending'
    ON CONFLICT (id) DO UPDATE SET blocker = excluded.blocker, blocked_revision = excluded.blocked_revision,
      updated_at = now(), revision = ota_followups.revision + 1
    WHERE ota_followups.outcome IS DISTINCT FROM 'resolved'
      AND (ota_followups.blocked_revision IS NULL OR ota_followups.blocked_revision <= excluded.blocked_revision)
      AND (ota_followups.blocker IS DISTINCT FROM excluded.blocker OR ota_followups.blocked_revision IS DISTINCT FROM excluded.blocked_revision)
    `);
  });
}

const queue = sql`
  WITH candidates AS (
    SELECT COALESCE(f.id, b.id) AS id, f.id AS "savedCase", b.id AS "bookingId",
      COALESCE(b.clerk_user_id, f.clerk_user_id) AS "ownerId",
      COALESCE(b.kind, f.kind) AS kind, b.supplier, b.reference, b.mode,
      COALESCE(f.phone, b.contact->>'phone') AS phone,
      COALESCE(f.email, b.contact->>'email') AS email,
      COALESCE(NULLIF(concat_ws(' → ',
        b.offer #>> '{slices,0,origin,iata_code}', b.offer #>> '{slices,0,destination,iata_code}'), ''),
        b.offer #>> '{accommodation,name}', f.trip, 'Travel checkout') AS trip,
      f.assigned_to AS "assignedTo", f.assigned_name AS "assignedName", f.outcome, f.note, COALESCE(f.revision, 0) AS revision,
      COALESCE(b.offer #>> '{check_in_date}', left(b.offer #>> '{slices,0,segments,0,departing_at}', 10)) AS "travelDate",
      f.requested_at AS "requestedAt", COALESCE(f.updated_at, b.updated_at) AS "updatedAt",
      CASE
        WHEN b.payment_issue IS NOT NULL OR (b.status = 'payment_pending' AND
          (b.issue IS NOT NULL OR b.authorization_url IS NOT NULL OR b.payment_initialization_at IS NOT NULL)) THEN 'payment_review'
        WHEN b.status IN ('requires_review', 'processing') THEN 'supplier_review'
        WHEN f.requested_at IS NOT NULL THEN 'callback'
        WHEN b.status = 'payment_pending' AND f.blocked_revision = b.revision THEN f.blocker
        WHEN b.status = 'payment_pending' AND b.expires_at <= now() THEN 'expired'
        WHEN b.status = 'payment_pending' THEN 'unpaid'
      END AS reason
    FROM ota_bookings b FULL JOIN ota_followups f ON f.booking_id = b.id
    WHERE (f.id IS NOT NULL AND (f.booking_id IS NULL OR b.id IS NOT NULL))
      OR (b.mode = 'live' AND (
        b.status = 'requires_review' OR b.payment_issue IS NOT NULL OR
        (b.status = 'processing' AND b.updated_at < now() - interval '15 minutes') OR
        (b.status = 'payment_pending' AND b.paid_at IS NULL AND
          b.updated_at < now() - interval '15 minutes' AND b.updated_at > now() - interval '30 days')
      ))
  )`;

export async function followupQueue(input: {
  offset: number;
  kind?: "flight" | "hotel";
  reason?: typeof followupReasons[number];
  supplier?: string;
  search?: string;
  resolved?: boolean;
  id?: string;
}) {
  const term = input.search?.toLowerCase() || "";
  return (await db.execute<{
    id: string; savedCase: string | null; bookingId: string | null; ownerId: string;
    kind: "flight" | "hotel"; trip: string; phone: string | null; email: string | null;
    assignedTo: string | null;
  }>(sql`${queue}
    SELECT * FROM candidates
    WHERE (reason IS NOT NULL OR outcome = 'resolved')
      AND (${Boolean(input.resolved)} = COALESCE(outcome = 'resolved', false))
      AND (${input.kind ?? ""} = '' OR kind = ${input.kind ?? ""})
      AND (${input.reason ?? ""} = '' OR reason = ${input.reason ?? ""})
      AND (${input.supplier ?? ""} = '' OR supplier = ${input.supplier ?? ""})
      AND (${input.id ?? ""} = '' OR id = ${input.id ?? ""})
      AND (${term} = '' OR strpos(lower(concat_ws(' ', reference, trip, email, phone)), ${term}) > 0)
    ORDER BY CASE reason WHEN 'payment_review' THEN 0 WHEN 'supplier_review' THEN 1 WHEN 'callback' THEN 2 ELSE 3 END,
      "updatedAt" DESC, id
    LIMIT 51 OFFSET ${input.offset}
  `)).rows;
}
