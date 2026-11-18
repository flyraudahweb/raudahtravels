import { z } from "zod";
import { bilalTokenForMode, type OtaConfig } from "./config";
import { OtaError, price } from "./provider";

type Mode = OtaConfig["mode"];

const reference = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const order = z.object({
  reference,
  my_trans_id: z.string(),
  origin: z.string(),
  destination: z.string(),
  departure_date: z.string(),
  trip_type: z.literal("oneway"),
  cabin: z.string(),
  pnr: z.string().nullish(),
  status: z.enum([
    "reserved",
    "pending",
    "issued",
    "ticketed",
    "cancelled",
    "failed",
  ]),
  currency: z.literal("NGN"),
  amount: z.number().nonnegative(),
  addons_fee: z.number().nonnegative().nullish(),
  tickets: z
    .array(z.object({ number: z.string().trim().min(1).max(50) }))
    .nullish(),
});

export type BilalOrder = z.infer<typeof order>;

async function request(
  config: OtaConfig,
  mode: Mode,
  path: string,
  body?: object,
  pdf = false,
) {
  const token = bilalTokenForMode(config, mode);
  if (!token)
    throw new OtaError(
      "Bilalsadasub credentials are unavailable for this booking.",
      503,
    );
  try {
    const response = await fetch(`https://bilalsadasub.com/api/flight${path}`, {
      method: body ? "POST" : "GET",
      redirect: "error",
      signal: AbortSignal.timeout(body ? 40_000 : 15_000),
      headers: {
        Authorization: `Token ${token}`,
        Accept: pdf ? "application/pdf" : "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.ok) return response;
  } catch {
    /* Never return a supplier error body or credential. */
  }
  throw new OtaError(
    body
      ? "Bilalsadasub booking outcome requires verification. Do not retry or pay again."
      : "Bilalsadasub booking information is temporarily unavailable.",
    502,
  );
}

async function result(response: Response) {
  const envelope = z
    .object({ status: z.literal("success"), data: z.unknown() })
    .safeParse(await response.json().catch(() => null));
  if (!envelope.success)
    throw new OtaError(
      "Bilalsadasub returned an unverified booking outcome.",
      502,
    );
  return envelope.data.data;
}

function parseOrder(value: unknown) {
  const parsed = order.safeParse(value);
  if (!parsed.success)
    throw new OtaError(
      "Bilalsadasub returned incomplete booking information.",
      502,
    );
  return parsed.data;
}

type Passenger = {
  id: string;
  title: string;
  given_name: string;
  family_name: string;
  born_on: string;
  gender: "m" | "f";
  email: string;
  phone_number: string;
  identity_documents?: {
    unique_identifier: string;
    issuing_country_code: string;
    expires_on: string;
    issued_on?: string;
    nationality?: string;
  }[];
};

export async function bookBilalOrder(
  config: OtaConfig,
  mode: Mode,
  input: {
    id: string;
    flightId: string;
    travellers: Passenger[];
    adults: number;
  },
) {
  return parseOrder(
    await result(
      await request(config, mode, "/book", {
        flight_id: input.flightId,
        my_trans_id: input.id,
        passengers: input.travellers.map((passenger) => {
          const document = passenger.identity_documents?.[0];
          return {
            passenger_type:
              Number(passenger.id.slice(4)) <= input.adults ? "adult" : "child",
            title: passenger.title,
            first_name: passenger.given_name,
            last_name: passenger.family_name,
            dob: passenger.born_on,
            gender: passenger.gender === "m" ? "male" : "female",
            email: passenger.email,
            phone_number: passenger.phone_number.replace(/^\+/, ""),
            ...(document
              ? {
                  documents: {
                    number: document.unique_identifier,
                    issuing_date: document.issued_on,
                    expiry_date: document.expires_on,
                    issuing_country: document.issuing_country_code,
                    nationality_country: document.nationality,
                  },
                }
              : {}),
          };
        }),
      }),
    ),
  );
}

export async function getBilalOrder(
  config: OtaConfig,
  mode: Mode,
  bookingId: string,
  providerId?: string,
) {
  if (providerId) {
    const id = reference.parse(providerId);
    const entry = parseOrder(
      await result(
        await request(config, mode, `/booking/${encodeURIComponent(id)}`),
      ),
    );
    if (entry.reference !== id)
      throw new OtaError("Bilalsadasub booking reference mismatch.", 502);
    return entry;
  }
  const rows = await result(await request(config, mode, "/bookings"));
  if (!Array.isArray(rows))
    throw new OtaError("Bilalsadasub booking lookup failed.", 502);
  const matches = rows.filter((row) => row?.my_trans_id === bookingId);
  if (matches.length > 1)
    throw new OtaError(
      "Multiple supplier records require reconciliation.",
      409,
    );
  return matches.length ? parseOrder(matches[0]) : undefined;
}

export function bilalDebitKobo(config: OtaConfig, order: BilalOrder) {
  const kobo = (value: number) =>
    value
      ? price(
          {
            ...config,
            rates: { NGN: 1 },
            bilalMarkupPercent: 0,
            serviceFeeNgn: 0,
          },
          "bilalsadasub",
          String(value),
          "NGN",
        ).supplierKobo
      : 0;
  const debit = kobo(order.amount) + kobo(order.addons_fee || 0);
  if (!Number.isSafeInteger(debit))
    throw new OtaError("Bilalsadasub debit requires reconciliation.", 502);
  return debit;
}

export async function getBilalTicket(
  config: OtaConfig,
  mode: Mode,
  providerId: string,
) {
  const response = await request(
    config,
    mode,
    `/booking/${encodeURIComponent(reference.parse(providerId))}/ticket`,
    undefined,
    true,
  );
  if (
    response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
      "application/pdf" ||
    !response.body
  )
    throw new OtaError(
      "The supplier ticket PDF is temporarily unavailable.",
      502,
    );
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 8 * 1024 * 1024) throw new Error("oversized PDF");
      chunks.push(value);
    }
    const file = Buffer.concat(chunks, bytes);
    if (file.subarray(0, 5).toString() !== "%PDF-")
      throw new Error("invalid PDF");
    return file;
  } catch {
    await reader.cancel().catch(() => {});
    throw new OtaError("The supplier ticket PDF could not be downloaded.", 502);
  }
}
