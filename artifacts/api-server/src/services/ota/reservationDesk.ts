import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { otaPaymentKey, paystackRequest, type OtaBooking } from "./booking";
import { OtaError, validateRefundPayment } from "./provider";
import { getOtaConfig } from "./config";
import { NUITEE_API, nuiteeRequest } from "./nuitee";
import { providerTransactionId } from "../payments/paystackProof";

export const deskQuery = z.object({
  offset: z.coerce.number().int().min(0).max(10000).default(0),
  mode: z.enum(["live", "test"]).default("live"),
  kind: z.enum(["flight", "hotel"]).optional(),
  supplier: z.enum(["nuitee", "duffel", "bilalsadasub"]).optional(),
  status: z.enum(["payment_pending", "processing", "confirmed", "cancelled", "requires_review", "refunded"]).optional(),
  payment: z.enum(["paid", "unpaid"]).optional(),
  document: z.enum(["missing", "ready"]).optional(),
  task: z.enum(["confirmation", "tickets", "vouchers", "changes", "service", "finance"]).optional(),
  from: z.string().date().optional(), to: z.string().date().optional(), search: z.string().trim().max(120).optional(),
});

export async function reservations(input: z.infer<typeof deskQuery>) {
  const search = input.search?.toLowerCase() || "";
  const { rows } = await db.execute(sql`
    WITH reservations AS (
      SELECT b.id, b.reference, b.kind, b.supplier, b.mode, b.status, b.created_at AS "createdAt",
        b.paid_at AS "paidAt", b.contact->>'email' AS email, b.contact->>'phone' AS phone,
        COALESCE(b.provider_result->>'booking_reference', b.provider_result->>'reference') AS locator, b.provider_booking_id AS "supplierId",
        COALESCE(b.offer #>> '{accommodation,name}', NULLIF(concat_ws(' → ',
          b.offer #>> '{slices,0,origin,iata_code}', b.offer #>> '{slices,0,destination,iata_code}'), ''), 'Travel reservation') AS trip,
        COALESCE(b.offer->>'check_in_date', left(b.provider_result #>> '{slices,0,segments,0,departing_at}',10),
          left(b.offer #>> '{slices,0,segments,0,departing_at}',10)) AS "travelDate",
        CASE WHEN b.status <> 'confirmed' THEN NULL
          WHEN b.kind = 'hotel' AND COALESCE(b.provider_result->>'booking_reference', b.provider_result->>'reference') IS NOT NULL THEN 'voucher'
          WHEN b.kind = 'flight' AND b.provider_result->>'ticketPdfAvailable' = 'true' THEN 'pdf'
          WHEN b.kind = 'flight' AND (b.provider_result->>'ticketed_at' IS NOT NULL OR
            (jsonb_typeof(b.provider_result->'documents') = 'array' AND b.provider_result->'documents' <> '[]'::jsonb)) THEN 'issued'
          ELSE NULL END AS document,
        b.service_request IS NOT NULL AS "serviceRequest", b.provider_notice IS NOT NULL AS "providerNotice",
        (b.payment_issue IS NOT NULL OR (d.finance->>'differenceKobo' IS NOT NULL AND d.finance->>'differenceKobo' <> '0')) AS "financeFlag",
        d.assigned_name AS "assignedName", d.resolved_at AS "resolvedAt",
        d.updated_at AS "deskUpdatedAt", b.updated_at AS "bookingUpdatedAt"
      FROM ota_bookings b LEFT JOIN ota_reservation_desk d ON d.booking_id = b.id
      WHERE b.mode = ${input.mode}
        AND (${input.kind ?? ""} = '' OR b.kind = ${input.kind ?? ""})
        AND (${input.supplier ?? ""} = '' OR b.supplier = ${input.supplier ?? ""})
        AND (${input.status ?? ""} = '' OR b.status = ${input.status ?? ""})
        AND (${input.payment ?? ""} = '' OR (${input.payment ?? ""} = 'paid') = (b.paid_at IS NOT NULL))
    )
    SELECT * FROM reservations
      WHERE (${input.from ?? ""} = '' OR "travelDate" >= ${input.from ?? ""})
      AND (${input.to ?? ""} = '' OR "travelDate" <= ${input.to ?? ""})
      AND (${input.document ?? ""} = '' OR (status = 'confirmed' AND (${input.document ?? ""} = 'ready') = (document IS NOT NULL)))
      AND (${search} = '' OR strpos(lower(concat_ws(' ', reference, locator, "supplierId", trip, email, phone)), ${search}) > 0)
      AND (${input.task ?? ""} = '' OR (("resolvedAt" IS NULL OR "bookingUpdatedAt" > "resolvedAt") AND CASE ${input.task ?? ""}
        WHEN 'confirmation' THEN "paidAt" IS NOT NULL AND status IN ('processing','requires_review')
        WHEN 'tickets' THEN status = 'confirmed' AND kind = 'flight' AND document IS NULL
        WHEN 'vouchers' THEN status = 'confirmed' AND kind = 'hotel' AND document IS NULL
        WHEN 'changes' THEN "providerNotice"
        WHEN 'service' THEN "serviceRequest"
        WHEN 'finance' THEN "financeFlag"
        ELSE false END))
    ORDER BY CASE WHEN ${input.task ?? ""} <> '' THEN "travelDate" END ASC NULLS LAST, "createdAt" DESC, id
    LIMIT 51 OFFSET ${input.offset}`);
  return { rows: rows.slice(0, 50), nextOffset: rows.length > 50 ? input.offset + 50 : null };
}

const safeMoney = z.number().int().nonnegative().max(1_000_000_000_000_000);

export async function verifyDeskPayment(row: OtaBooking) {
  if (!row.paidAt) throw new OtaError("There is no verified customer payment for this reservation.", 409);
  const reference = row.paidPaymentReference || row.reference;
  const key = await otaPaymentKey(row, reference);
  const payment = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`, row.mode, undefined, row.supplier, key);
  validateRefundPayment(payment, { ...row, reference });
  const transactionId = providerTransactionId(payment.id);
  if (!transactionId) throw new OtaError("Paystack did not provide a valid transaction ID.", 409);
  const fees = safeMoney.safeParse(payment.fees);
  return { reference, key, transactionId, amountKobo: row.amountKobo,
    feesKobo: fees.success ? fees.data : null, gatewayStatus: String(payment.status),
  };
}

export async function verifyDeskRefund(row: OtaBooking, pay: Awaited<ReturnType<typeof verifyDeskPayment>>, refundId: string) {
  const refund = await paystackRequest(`/refund/${refundId}`, row.mode, undefined, row.supplier, pay.key);
  const amount = safeMoney.positive().safeParse(refund.amount);
  if (String(refund.id) !== refundId || refund.status !== "processed" || refund.domain !== row.mode ||
      refund.currency !== "NGN" || !amount.success || amount.data > pay.amountKobo ||
      providerTransactionId(refund.transaction?.id ?? refund.transaction) !== pay.transactionId)
    throw new OtaError("This completed refund could not be matched to the original payment.", 409);
  return { id: refundId, amountKobo: amount.data };
}

export async function verifyDeskSettlement(row: OtaBooking, pay: Awaited<ReturnType<typeof verifyDeskPayment>>, settlementId: string, date: string, page: number) {
  const from = new Date(`${date}T00:00:00Z`);
  const next = new Date(from.getTime() + 86_400_000);
  const query = new URLSearchParams({ from: from.toISOString(), to: next.toISOString(), perPage: "100" });
  const [settlement, transactions] = await Promise.all([
    paystackRequest(`/settlement?${query}`, row.mode, undefined, row.supplier, pay.key),
    paystackRequest(`/settlement/${settlementId}/transactions?perPage=100&page=${page}`, row.mode, undefined, row.supplier, pay.key),
  ]);
  const paidOut = Array.isArray(settlement) && settlement.find((item) => String(item.id) === settlementId);
  if (!paidOut || paidOut.status !== "success" || paidOut.currency !== "NGN" || paidOut.domain !== row.mode)
    throw new OtaError("This settlement could not be verified as paid out in the booking environment.", 409);
  if (!Array.isArray(transactions) || !transactions.some((item) => providerTransactionId(item.id) === pay.transactionId && item.reference === pay.reference))
    throw new OtaError("This payment was not found on that settlement page.", 409);
  return { id: settlementId, date: String(paidOut.settlement_date ?? "").slice(0, 50) };
}

export async function deskCancellationQuote(row: OtaBooking) {
  if (row.supplier !== "nuitee" || row.kind !== "flight" || row.status !== "confirmed" || !row.providerBookingId)
    throw new OtaError("A live cancellation quote is unavailable for this reservation. Check the supplier’s terms.", 409);
  const result = await nuiteeRequest(await getOtaConfig(), z.enum(["test", "live"]).parse(row.mode), NUITEE_API,
    `/flights/bookings/${encodeURIComponent(row.providerBookingId)}/cancellations`);
  const value = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!value || typeof value !== "object") throw new OtaError("The supplier did not return a cancellation quote.", 502);
  const money = z.object({ amount: z.union([z.number(), z.string().regex(/^\d+(?:\.\d+)?$/)])
    .transform(Number).pipe(z.number().finite().nonnegative()), currency: z.string().regex(/^[A-Z]{3}$/) });
  const refund = money.safeParse(value.refund), penalty = money.safeParse(value.penalty);
  return { confidence: String(value.confidence ?? "unknown").slice(0, 30),
    isRefundable: value.isRefundable === true, isVoidable: value.isVoidable === true,
    refund: refund.success ? refund.data : null, penalty: penalty.success ? penalty.data : null,
    destination: typeof value.destination === "string" ? value.destination.slice(0, 50) : null,
  };
}
