import type { OtaConfig } from "./config";
import { matchesPaystackProof } from "../payments/paystackProof";

export class OtaError extends Error {
  constructor(
    message: string,
    public status = 400,
    public requestId?: string,
  ) {
    super(message);
  }
}
export async function duffelRequest(
  config: OtaConfig,
  path: string,
  method = "GET",
  data?: unknown,
): Promise<any> {
  if (
    !config.duffelToken ||
    !config.duffelToken.startsWith(`duffel_${config.mode}_`)
  )
    throw new OtaError(
      "Travel search is not configured. Please contact support.",
      503,
    );
  let response: Response;
  try {
    response = await fetch(`https://api.duffel.com${path}`, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(
        method === "POST" && ["/air/orders", "/stays/bookings"].includes(path)
          ? 135000
          : 55000,
      ),
      headers: {
        Authorization: `Bearer ${config.duffelToken}`,
        "Duffel-Version": "v2",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...(data === undefined ? {} : { body: JSON.stringify({ data }) }),
    });
  } catch {
    throw new OtaError(
      "The travel provider did not respond. Please try again later.",
      502,
    );
  }
  const body = (await response.json().catch(() => ({}))) as any;
  if (response.status === 204) return null;
  if (!response.ok)
    throw new OtaError(
      response.status === 429
        ? "Too many searches. Please wait a minute."
        : "The travel provider could not complete this request. Refresh availability or contact support.",
      response.status === 429 ? 429 : 502,
      response.headers.get("x-request-id") || body.meta?.request_id,
    );
  if (body.data == null)
    throw new OtaError(
      "The travel provider returned an incomplete response.",
      502,
    );
  return body.data;
}
export function price(
  config: OtaConfig,
  kind: "flight" | "hotel",
  amount: string,
  currency: string,
) {
  const rate = config.rates[currency],
    value = Number(amount);
  if (!rate || !Number.isFinite(value) || value <= 0)
    throw new OtaError(
      `Pricing for ${currency} is unavailable. Please contact support.`,
      503,
    );
  // Compute using decimal fractions: binary floating point can round 0.07 NGN
  // up to 8 kobo even though it is exactly 7 kobo.
  const [amountN, amountD] = decimalFraction(amount),
    [rateN, rateD] = decimalFraction(rate);
  const ceil = (n: bigint, d: bigint) => (n + d - 1n) / d;
  const supplierMinor = ceil(amountN * rateN * 100n, amountD * rateD);
  const [markupN, markupD] = decimalFraction(
    kind === "flight" ? config.flightMarkupPercent : config.hotelMarkupPercent,
  );
  const [feeN, feeD] = decimalFraction(config.serviceFeeNgn);
  const supplierKobo = Number(supplierMinor);
  const markupKobo = Number(ceil(supplierMinor * markupN, markupD * 100n));
  const feeKobo = Number((feeN * 200n + feeD) / (feeD * 2n)),
    totalKobo = supplierKobo + markupKobo + feeKobo;
  if (!Number.isSafeInteger(totalKobo) || totalKobo <= 0)
    throw new OtaError("Invalid travel price", 503);
  return {
    supplierKobo,
    markupKobo,
    feeKobo,
    totalKobo,
    currency: "NGN",
    rate,
    supplierCurrency: currency,
    supplierAmount: amount,
  };
}
function decimalFraction(value: string | number): [bigint, bigint] {
  const raw = String(value);
  const parts = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(raw);
  if (!parts || raw.length > 80 || !Number.isFinite(Number(raw)))
    throw new OtaError("Invalid travel price", 503);
  const scale = (parts[2]?.length || 0) - Number(parts[3] || 0);
  if (Math.abs(scale) > 400) throw new OtaError("Invalid travel price", 503);
  const numerator = BigInt(parts[1] + (parts[2] || ""));
  return scale < 0
    ? [numerator * 10n ** BigInt(-scale), 1n]
    : [numerator, 10n ** BigInt(scale)];
}
export function sameSupplierAmount(left: unknown, right: unknown) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  try {
    const [ln, ld] = decimalFraction(left),
      [rn, rd] = decimalFraction(right);
    return ln * rd === rn * ld;
  } catch {
    return false;
  }
}
export function expiration(resource: any): number {
  const dates = [
    resource.expires_at,
    ...(resource.accommodation?.rooms || []).flatMap((room: any) =>
      (room.rates || []).map((rate: any) => rate.expires_at),
    ),
  ]
    .filter(Boolean)
    .map((value: string) => Date.parse(value));
  if (dates.some((d: number) => !Number.isFinite(d)))
    throw new OtaError("The provider returned an invalid offer expiry", 502);
  return Math.min(Date.now() + 10 * 60000, ...dates);
}
export function available(resource: any) {
  if (expiration(resource) <= Date.now() + 60000)
    throw new OtaError(
      "This offer has expired or is about to expire. Please search again.",
      409,
    );
}
export function prepaidRate(rate: any): boolean {
  return (
    rate.payment_type === "pay_now" &&
    !rate.loyalty_programme_required &&
    !Number(rate.deposit_amount || 0) &&
    !!rate.available_payment_methods?.some((methods: string[]) =>
      methods.includes("balance"),
    )
  );
}
export function assertHotelQuote(quote: any) {
  const rates = (quote.accommodation?.rooms || []).flatMap(
    (room: any) => room.rates || [],
  );
  if (
    Number(quote.deposit_amount || 0) > 0 ||
    !rates.length ||
    !rates.every(prepaidRate)
  )
    throw new OtaError(
      "This hotel rate cannot be prepaid online. Choose another rate.",
      409,
    );
}
export function validatePayment(
  payment: any,
  booking: { reference: string; amountKobo: number; id: string; mode: string },
) {
  if (
    !matchesPaystackProof(payment, {
      ...booking,
      bookingId: booking.id,
      purpose: "ota",
    })
  ) {
    throw new OtaError(
      "Payment does not match this booking. Please contact support.",
      409,
    );
  }
}
export function validateRefundPayment(
  payment: any,
  booking: { reference: string; amountKobo: number; id: string; mode: string },
) {
  if (
    !matchesPaystackProof(
      payment,
      { ...booking, bookingId: booking.id, purpose: "ota" },
      true,
    )
  )
    throw new OtaError("Refund transaction does not match this booking", 409);
}
