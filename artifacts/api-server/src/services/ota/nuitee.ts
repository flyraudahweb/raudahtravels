import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import {
  nuiteeHotelSearchReady,
  nuiteeTokenForMode,
  type OtaConfig,
} from "./config";
import { OtaError, price, sameSupplierAmount } from "./provider";

type Mode = OtaConfig["nuiteeMode"];
export type HotelSearch = {
  latitude: number;
  longitude: number;
  checkIn: string;
  checkOut: string;
  rooms: number;
  adults: number;
  childAges: number[];
  guestNationality: string;
};
type Stay = {
  mode: Mode;
  hotelId: string;
  name: string;
  address: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  expiresAt: number;
};
type RateSelection = Stay & { offerId: string };
type Checkout = Stay & { prebookId: string; owner: string; termsHash: string };
type Guest = { given_name: string; family_name: string };
type Contact = { email: string; specialRequests?: string };
type SupplierBooking = {
  mode: string;
  reference: string;
  providerOfferId: string;
  providerBookingId: string | null;
  supplierAmount: string;
  supplierCurrency: string;
  offer: unknown;
};
type Money = { amount: string; currency: string };
const SEARCH_API = "https://api.liteapi.travel/v3.0";
const BOOKING_API = "https://book.liteapi.travel/v3.0";

async function nuiteeRequest(
  config: OtaConfig,
  mode: Mode,
  base: string,
  path: string,
  options: { body?: unknown; timeout?: number; unavailable?: boolean } = {},
) {
  const key = nuiteeTokenForMode(config, mode);
  if (!key)
    throw new OtaError(
      "Nuitee credentials are unavailable for this mode.",
      503,
    );
  let response: Response;
  let payload: any;
  try {
    response = await fetch(`${base}${path}`, {
      method: options.body ? "POST" : "GET",
      headers: {
        "X-API-Key": key,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      redirect: "error",
      signal: AbortSignal.timeout(options.timeout ?? 25000),
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    payload = await response.json();
  } catch {
    throw new OtaError("Nuitee did not return a usable response.", 502);
  }
  const errorCode = Number(payload?.error?.code);
  if (response.status === 401 || response.status === 403)
    throw new OtaError("Nuitee rejected the API key or hotel access.", 503);
  const flag = payload.sandbox;
  if (flag != null && !matchesMode(flag, mode))
    throw new OtaError(
      "The Nuitee response did not match the requested environment.",
      502,
    );
  if (options.unavailable && errorCode === 2001) return { data: [] };
  if (errorCode === 2001)
    throw new OtaError(
      "The room rate is no longer available. Search again for fresh rates.",
      409,
    );
  if (!response.ok || payload?.error || payload?.data == null)
    throw new OtaError(
      "Nuitee could not complete this request. Check the reservation status before trying again.",
      502,
    );
  return payload;
}

function matchesMode(flag: unknown, mode: string) {
  const flags: unknown[] = mode === "test" ? [true, 1, "1"] : [false, 0, "0"];
  return flags.includes(flag);
}

function tokenKey() {
  const key = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!key || !/^[a-f0-9]{64}$/i.test(key))
    throw new OtaError("Hotel selections are temporarily unavailable.", 503);
  return createHash("sha256")
    .update("ota-nuitee:v1")
    .update(Buffer.from(key, "hex"))
    .digest();
}

function seal(prefix: string, value: Stay) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  cipher.setAAD(Buffer.from(prefix));
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return (
    prefix +
    Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url")
  );
}

function open<T extends Stay>(
  config: OtaConfig,
  prefix: string,
  token: string,
): T {
  const key = tokenKey();
  let value: T;
  try {
    if (!token.startsWith(prefix) || token.length > 22000) throw new Error();
    const raw = Buffer.from(token.slice(prefix.length), "base64url");
    if (raw.length < 29 || prefix + raw.toString("base64url") !== token)
      throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
    decipher.setAAD(Buffer.from(prefix));
    decipher.setAuthTag(raw.subarray(12, 28));
    value = JSON.parse(
      Buffer.concat([
        decipher.update(raw.subarray(28)),
        decipher.final(),
      ]).toString(),
    );
  } catch {
    throw new OtaError("Invalid hotel selection. Please search again.", 400);
  }
  if (value.mode !== config.nuiteeMode || value.expiresAt <= Date.now())
    throw new OtaError(
      "The hotel selection has expired. Please search again.",
      409,
    );
  return value;
}

function occupancies(input: HotelSearch) {
  return Array.from({ length: input.rooms }, (_, index) => ({
    adults:
      Math.floor(input.adults / input.rooms) +
      Number(index < input.adults % input.rooms),
    children: input.childAges.filter(
      (_, childIndex) => childIndex % input.rooms === index,
    ),
  }));
}

async function fetchRates(
  config: OtaConfig,
  mode: Mode,
  input: HotelSearch,
  hotelId?: string,
) {
  return nuiteeRequest(config, mode, SEARCH_API, "/hotels/rates", {
    unavailable: true,
    body: {
      ...(hotelId
        ? { hotelIds: [hotelId], maxRatesPerHotel: 15 }
        : {
            latitude: input.latitude,
            longitude: input.longitude,
            radius: 10000,
            limit: 45,
            maxRatesPerHotel: 5,
          }),
      includeHotelData: true,
      checkin: input.checkIn,
      checkout: input.checkOut,
      guestNationality: input.guestNationality,
      currency: "USD",
      occupancies: occupancies(input),
      timeout: 12,
    },
  });
}

export async function checkNuiteeConnection(config: OtaConfig, mode: Mode) {
  const day = (offset: number) =>
    new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  await fetchRates(config, mode, {
    latitude: 6.4541,
    longitude: 3.3947,
    checkIn: day(21),
    checkOut: day(22),
    rooms: 1,
    adults: 1,
    childAges: [],
    guestNationality: "NG",
  });
}

function money(amount: unknown, currency: unknown): Money | undefined {
  const value = String(amount);
  if (
    !/^\d+(\.\d{1,6})?$/.test(value) ||
    typeof currency !== "string" ||
    !/^[A-Z]{3}$/.test(currency)
  )
    return;
  return { amount: value, currency };
}

function nuiteePrice(config: OtaConfig, cost: Money, floor?: Money) {
  const pricing = price(
    { ...config, hotelMarkupPercent: config.nuiteeMarkupPercent },
    "hotel",
    cost.amount,
    cost.currency,
  );
  const minimum =
    floor && Number(floor.amount) > 0
      ? price(config, "hotel", floor.amount, floor.currency).supplierKobo
      : 0;
  const adjustment = Math.max(
    0,
    minimum - pricing.supplierKobo - pricing.markupKobo,
  );
  return {
    ...pricing,
    totalKobo: pricing.totalKobo + adjustment,
    markupKobo: pricing.markupKobo + adjustment,
  };
}

function clean(value: unknown, limit = 300) {
  return typeof value === "string"
    ? value
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, limit)
    : "";
}

function supportsPrepay(rate: any) {
  const types = rate?.paymentTypes;
  return (
    !!rate &&
    (!Array.isArray(types) ||
      !types.length ||
      types.some((type) => type === "NUITEE_PAY" || type === "ACC_CREDIT_CARD"))
  );
}

function rateDetails(rates: any[]) {
  return rates.map((rate, index) => {
    const conditions: { title: string; description: string }[] = [];
    const note = clean(rate.remarks, 3000);
    if (note) conditions.push({ title: "Hotel terms", description: note });
    for (const tax of rate.retailRate?.taxesAndFees ?? []) {
      const cost = money(tax.amount, tax.currency);
      if (tax.included === false && cost)
        conditions.push({
          title: "Pay at the property",
          description: `${clean(tax.description) || "Taxes and fees"} · ${cost.currency} ${cost.amount}`,
        });
    }
    const policies = rate.cancellationPolicies;
    for (const policy of policies?.cancelPolicyInfos ?? []) {
      const time = clean(policy.cancelTime);
      const cost = money(policy.amount, policy.currency);
      if (time && cost)
        conditions.push({
          title: "Cancellation fee",
          description: `From ${time}${policy.timezone ? ` (${clean(policy.timezone)})` : ""} · ${policy.type === "percent" ? `${cost.amount}%` : `${cost.currency} ${cost.amount}`}`,
        });
    }
    for (const remark of policies?.hotelRemarks ?? []) {
      const description = clean(remark);
      if (description)
        conditions.push({ title: "Cancellation terms", description });
    }
    return {
      name: clean(rate.name) || `Room ${index + 1}`,
      board_type: clean(rate.boardName || rate.boardType),
      conditions,
      cancellation_summary:
        policies?.refundableTag === "RFN"
          ? "Refundable subject to the hotel’s cancellation terms."
          : policies?.refundableTag === "NRFN"
            ? "The hotel may retain some or all of the payment if you cancel."
            : "Confirm cancellation terms with support.",
    };
  });
}

function hotelInfo(stay: Stay, photo?: unknown, rating?: unknown) {
  return {
    name: stay.name,
    location: { address: { line_one: stay.address } },
    photos:
      typeof photo === "string" && /^https:\/\//i.test(photo)
        ? [{ url: photo }]
        : [],
    rating: typeof rating === "number" ? rating : null,
  };
}

function hotelRates(config: OtaConfig, stay: Stay, offers: unknown) {
  if (!Array.isArray(offers)) return [];
  return offers
    .flatMap((offer) => {
      if (
        typeof offer?.offerId !== "string" ||
        !offer.offerId ||
        offer.offerId.length > 15000 ||
        !Array.isArray(offer.rates) ||
        offer.rates.length !== stay.rooms ||
        !offer.rates.every(supportsPrepay)
      )
        return [];
      const cost = money(
        offer.offerRetailRate?.amount,
        offer.offerRetailRate?.currency,
      );
      const floor = money(
        offer.suggestedSellingPrice?.amount,
        offer.suggestedSellingPrice?.currency,
      );
      if (
        !cost ||
        !config.rates[cost.currency] ||
        Number(cost.amount) <= 0 ||
        (floor && Number(floor.amount) > 0 && !config.rates[floor.currency])
      )
        return [];
      const rooms = rateDetails(offer.rates);
      const selection: RateSelection = { ...stay, offerId: offer.offerId };
      return [
        {
          ...rooms[0],
          name: rooms.map((r) => r.name).join(" + "),
          board_type: rooms.length === 1 ? rooms[0].board_type : "",
          conditions: rooms.flatMap((room, index) => [
            ...(rooms.length > 1 && room.board_type
              ? [{ title: `Room ${index + 1}`, description: room.board_type }]
              : []),
            ...room.conditions,
          ]),
          cancellation_summary:
            rooms.length > 1
              ? rooms
                  .map(
                    (room, i) => `Room ${i + 1}: ${room.cancellation_summary}`,
                  )
                  .join(" ")
              : rooms[0].cancellation_summary,
          id: seal("nrt_", selection),
          total_amount: cost.amount,
          total_currency: cost.currency,
          pricing: nuiteePrice(config, cost, floor),
        },
      ];
    })
    .sort((a, b) => a.pricing.totalKobo - b.pricing.totalKobo);
}

function requireHotelSearch(config: OtaConfig) {
  if (!nuiteeHotelSearchReady(config))
    throw new OtaError("Nuitee hotel search is unavailable.", 503);
}

export async function searchNuiteeHotels(
  config: OtaConfig,
  input: HotelSearch,
) {
  requireHotelSearch(config);
  const payload = await fetchRates(config, config.nuiteeMode, input);
  if (!Array.isArray(payload.data))
    throw new OtaError("Invalid hotel search response.", 502);
  const hotels = new Map<string, any>(
    (Array.isArray(payload.hotels) ? payload.hotels : []).map((hotel: any) => [
      hotel.id,
      hotel,
    ]),
  );
  return payload.data.flatMap((item: any) => {
    const hotel = hotels.get(item.hotelId);
    if (!clean(hotel?.name) || typeof item.hotelId !== "string") return [];
    const stay: Stay = {
      mode: config.nuiteeMode,
      hotelId: item.hotelId,
      name: clean(hotel.name, 160),
      address: clean(hotel.address, 240),
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      rooms: input.rooms,
      expiresAt: Date.now() + 15 * 60000,
    };
    const cheapest = hotelRates(config, stay, item.roomTypes)[0];
    if (!cheapest) return [];
    const result = { ...stay, input };
    return [
      {
        id: seal("nst_", result),
        accommodation: hotelInfo(
          stay,
          hotel.main_photo || hotel.thumbnail,
          hotel.rating,
        ),
        pricing: cheapest.pricing,
        cheapest_rate_total_amount: cheapest.total_amount,
        cheapest_rate_currency: cheapest.total_currency,
      },
    ];
  });
}

export async function getNuiteeRates(config: OtaConfig, token: string) {
  requireHotelSearch(config);
  const selection = open<Stay & { input: HotelSearch }>(config, "nst_", token);
  const { input, ...stay } = selection;
  const [payload, property] = await Promise.all([
    fetchRates(config, stay.mode, input, stay.hotelId),
    nuiteeRequest(
      config,
      stay.mode,
      SEARCH_API,
      `/data/hotel?hotelId=${encodeURIComponent(stay.hotelId)}`,
      {
        timeout: 6000,
      },
    )
      .then((response) => response.data)
      .catch(() => null),
  ]);
  if (!Array.isArray(payload.data))
    throw new OtaError("Invalid hotel rates response.", 502);
  const hotel = payload.data.find((item: any) => item.hotelId === stay.hotelId);
  const accommodation = hotelInfo(stay);
  return {
    id: token,
    accommodation: {
      ...accommodation,
      description:
        property?.id === stay.hotelId
          ? clean(property.hotelDescription, 4000)
          : "",
      rooms: [
        {
          name: "Available rates",
          rates: hotelRates(config, stay, hotel?.roomTypes),
        },
      ],
    },
  };
}

function prebookResource(stay: Stay, prebook: any) {
  const cost = money(prebook.price, prebook.currency);
  if (
    !cost ||
    Number(cost.amount) <= 0 ||
    prebook.hotelId !== stay.hotelId ||
    prebook.checkin !== stay.checkIn ||
    prebook.checkout !== stay.checkOut
  )
    throw new OtaError(
      "Nuitee’s prebook details did not match the selected stay.",
      502,
    );
  const rates = (
    Array.isArray(prebook.roomTypes) ? prebook.roomTypes : []
  ).flatMap((item: any) => (Array.isArray(item.rates) ? item.rates : []));
  if (
    rates.length !== stay.rooms ||
    !rates.every(supportsPrepay) ||
    !supportsPrepay(prebook)
  )
    throw new OtaError(
      "This stay is unavailable for online payment. Choose another rate.",
      409,
    );
  const details = rateDetails(rates);
  const terms = clean(prebook.termsAndConditions, 16000);
  const floor = money(
    prebook.suggestedSellingPrice?.amount,
    prebook.suggestedSellingPrice?.currency,
  );
  const termsHash = createHash("sha256")
    .update(JSON.stringify({ cost, floor, details, terms }))
    .digest("base64url");
  return { cost, details, terms, floor, termsHash };
}

function quoteResponse(
  config: OtaConfig,
  checkout: Checkout,
  resource: ReturnType<typeof prebookResource>,
  token: string,
) {
  const { cost, details, terms, floor, termsHash } = resource;
  if (termsHash !== checkout.termsHash)
    throw new OtaError(
      "The hotel rate or booking terms changed. Search again and review the new offer.",
      409,
    );
  return {
    quote: {
      id: token,
      supplier: "nuitee",
      mode: checkout.mode,
      expires_at: new Date(checkout.expiresAt).toISOString(),
      total_amount: cost.amount,
      total_currency: cost.currency,
      check_in_date: checkout.checkIn,
      check_out_date: checkout.checkOut,
      rooms: checkout.rooms,
      guests: details.map((_, index) => ({ id: `room-${index + 1}` })),
      accommodation: {
        ...hotelInfo(checkout),
        rooms: details.map((rate, index) => ({
          name: rate.name,
          rates: [
            {
              ...rate,
              conditions:
                index === 0 && terms
                  ? [
                      ...rate.conditions,
                      { title: "Booking terms", description: terms },
                    ]
                  : rate.conditions,
            },
          ],
        })),
      },
    },
    pricing: nuiteePrice(config, cost, floor),
  };
}

export async function createNuiteeQuote(
  config: OtaConfig,
  token: string,
  owner: string,
) {
  requireHotelSearch(config);
  const { offerId, ...stay } = open<RateSelection>(config, "nrt_", token);
  const payload = await nuiteeRequest(
    config,
    stay.mode,
    BOOKING_API,
    "/rates/prebook?timeout=120",
    {
      body: { offerId, usePaymentSdk: false },
      timeout: 125000,
    },
  );
  const prebookId = payload.data?.prebookId;
  if (typeof prebookId !== "string" || !/^[\w-]{1,128}$/.test(prebookId))
    throw new OtaError(
      "Nuitee did not return a valid prebook identifier.",
      502,
    );
  const resource = prebookResource(stay, payload.data);
  const checkout: Checkout = {
    ...stay,
    prebookId,
    owner,
    termsHash: resource.termsHash,
    expiresAt: Date.now() + 15 * 60000,
  };
  return quoteResponse(config, checkout, resource, seal("nqt_", checkout));
}

export async function readNuiteeQuote(
  config: OtaConfig,
  token: string,
  owner: string,
) {
  requireHotelSearch(config);
  const checkout = open<Checkout>(config, "nqt_", token);
  if (checkout.owner !== owner)
    throw new OtaError("Hotel quote not found.", 404);
  const resource = await readPrebook(config, checkout, checkout.prebookId);
  return { ...quoteResponse(config, checkout, resource, token), checkout };
}

async function readPrebook(config: OtaConfig, stay: Stay, prebookId: string) {
  const payload = await nuiteeRequest(
    config,
    stay.mode,
    BOOKING_API,
    `/prebooks/${encodeURIComponent(prebookId)}`,
  );
  if (payload.data.prebookId !== prebookId)
    throw new OtaError("Nuitee returned a different checkout session.", 502);
  return prebookResource(stay, payload.data);
}

export async function verifyNuiteePrebook(
  config: OtaConfig,
  row: SupplierBooking,
) {
  const stay = (row.offer as { nuiteeStay: Stay & { termsHash: string } })
    .nuiteeStay;
  const refreshed = await readPrebook(config, stay, row.providerOfferId);
  if (
    stay.mode !== row.mode ||
    stay.termsHash !== refreshed.termsHash ||
    !sameSupplierAmount(refreshed.cost.amount, row.supplierAmount) ||
    refreshed.cost.currency !== row.supplierCurrency
  )
    throw new OtaError(
      "The hotel rate or terms changed. Review the reservation before proceeding.",
      409,
    );
}

export async function bookNuiteeHotel(
  config: OtaConfig,
  row: SupplierBooking & { travellers: unknown; contact: unknown },
) {
  await verifyNuiteePrebook(config, row);
  const travellers = row.travellers as Guest[];
  const contact = row.contact as Contact;
  const guest = (traveller: Guest) => ({
    firstName: traveller.given_name,
    lastName: traveller.family_name,
    email: contact.email,
  });
  const result = await nuiteeRequest(
    config,
    row.mode as Mode,
    BOOKING_API,
    "/rates/book?timeout=90",
    {
      timeout: 95000,
      body: {
        prebookId: row.providerOfferId,
        clientReference: row.reference,
        holder: guest(travellers[0]),
        guests: travellers.map((person, index) => ({
          ...guest(person),
          occupancyNumber: index + 1,
          ...(index === 0 && contact.specialRequests
            ? { remarks: contact.specialRequests }
            : {}),
        })),
        payment: { method: "ACC_CREDIT_CARD" },
      },
    },
  );
  return normalizeBooking(row, result.data);
}

function normalizeBooking(row: SupplierBooking, data: any) {
  const stay = (row.offer as { nuiteeStay: Stay }).nuiteeStay;
  const bookingId = data?.bookingId;
  if (
    typeof bookingId !== "string" ||
    !/^[\w-]{1,128}$/.test(bookingId) ||
    (row.providerBookingId && row.providerBookingId !== bookingId) ||
    data.clientReference !== row.reference ||
    data.prebookId !== row.providerOfferId ||
    (data.hotel?.hotelId ?? data.hotelId) !== stay.hotelId ||
    data.checkin !== stay.checkIn ||
    data.checkout !== stay.checkOut ||
    !sameSupplierAmount(
      money(data.price, data.currency)?.amount,
      row.supplierAmount,
    ) ||
    data.currency !== row.supplierCurrency ||
    (data.sandbox != null && !matchesMode(data.sandbox, row.mode))
  )
    throw new OtaError(
      "Nuitee’s booking record does not match the paid checkout. Reconciliation is required.",
      502,
    );
  const cancelled = ["CANCELLED", "CANCELLED_WITH_CHARGES"].includes(
    data.status,
  );
  if (
    !cancelled &&
    (data.status !== "CONFIRMED" ||
      (data.paymentStatus && data.paymentStatus !== "succeeded"))
  )
    throw new OtaError(
      "The Nuitee booking outcome is pending. Check the status before booking again.",
      409,
    );
  return {
    id: bookingId,
    status: cancelled ? "cancelled" : "confirmed",
    booking_reference: clean(
      data.hotelConfirmationCode || data.supplierBookingId || bookingId,
      128,
    ),
    total_amount: row.supplierAmount,
    total_currency: row.supplierCurrency,
    check_in_date: stay.checkIn,
    check_out_date: stay.checkOut,
    cancellation_status: cancelled ? data.status : null,
    check_in_instructions: clean(data.checkinInstructions?.instructions, 4000),
  };
}

export async function lookupNuiteeBooking(
  config: OtaConfig,
  row: SupplierBooking,
) {
  const mode = row.mode as Mode;
  let bookingId = row.providerBookingId;
  if (!bookingId) {
    const payload = await nuiteeRequest(
      config,
      mode,
      BOOKING_API,
      `/bookings?clientReference=${encodeURIComponent(row.reference)}`,
    );
    if (!Array.isArray(payload.data))
      throw new OtaError("Invalid Nuitee booking list response.", 502);
    const matches = payload.data.filter(
      (entry: any) => entry.clientReference === row.reference,
    );
    if (!matches.length) return null;
    if (matches.length !== 1 || typeof matches[0].bookingId !== "string")
      throw new OtaError(
        "Nuitee returned conflicting booking references.",
        502,
      );
    bookingId = matches[0].bookingId as string;
  }
  const payload = await nuiteeRequest(
    config,
    mode,
    BOOKING_API,
    `/bookings/${encodeURIComponent(bookingId)}`,
  );
  return normalizeBooking(
    { ...row, providerBookingId: bookingId },
    payload.data,
  );
}
