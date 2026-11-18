import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const pageSize = 25;

export async function otaEarnings(mode: "test" | "live", offset: number) {
  // One database snapshot gives the same booking status to the totals and page.
  // Return money as integer strings to preserve exact totals even for large reports.
  const {
    rows: [report],
  } = await db.execute(sql`
    WITH confirmed AS (
      SELECT id, reference, kind, paid_at, amount_kobo,
        CASE WHEN jsonb_typeof(pricing->'supplierKobo') = 'number'
          AND pricing->>'supplierKobo' ~ '^[1-9][0-9]{0,15}$'
          THEN (pricing->>'supplierKobo')::bigint
        END AS supplier_kobo
      FROM ota_bookings
      WHERE mode = ${mode} AND status = 'confirmed' AND paid_at IS NOT NULL
    )
    SELECT count(*)::int AS "bookingCount",
      count(*) FILTER (WHERE supplier_kobo IS NULL)::int AS "missingCostCount",
      coalesce(sum(amount_kobo), 0)::text AS "paidKobo",
      coalesce(sum(supplier_kobo), 0)::text AS "supplierKobo",
      coalesce(sum(amount_kobo - supplier_kobo), 0)::text AS "grossKobo",
      (SELECT coalesce(jsonb_agg(to_jsonb(page) ORDER BY page."paidAt" DESC, page.id DESC), '[]'::jsonb)
       FROM (
         SELECT id, reference, kind, paid_at AS "paidAt", amount_kobo::text AS "paidKobo",
           supplier_kobo::text AS "supplierKobo", (amount_kobo - supplier_kobo)::text AS "grossKobo"
         FROM confirmed ORDER BY paid_at DESC, id DESC LIMIT ${pageSize} OFFSET ${offset}
       ) page) AS bookings
    FROM confirmed
  `);
  const { bookings, bookingCount, ...totals } = report;
  return {
    bookings,
    totals: { ...totals, bookingCount },
    nextOffset:
      offset + pageSize < Number(bookingCount) ? offset + pageSize : null,
  };
}
