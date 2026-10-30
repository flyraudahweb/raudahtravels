type Schema = Record<string, any>;
const string = (description: string, extra: Schema = {}) => ({
  type: "string",
  description,
  ...extra,
});
const integer = (description: string, min = 0, max?: number) => ({
  type: "integer",
  description,
  minimum: min,
  ...(max === undefined ? {} : { maximum: max }),
});
const object = (
  properties: Schema,
  required: string[] = [],
  extra: Schema = {},
) => ({
  type: "object",
  properties,
  ...(required.length ? { required } : {}),
  ...extra,
});
const array = (items: Schema, extra: Schema = {}) => ({
  type: "array",
  items,
  ...extra,
});
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const nullable = (schema: Schema) => ({ ...schema, nullable: true });
const bool = (description: string) => ({ type: "boolean", description });
const date = (description: string) => string(description, { format: "date" });
const timestamp = (description: string) =>
  string(description, { format: "date-time" });
const empty = object({});
const customer = [{ CustomerSession: [] }];
const publicAccess = [{}, { SearchKey: [] }];
const success = (
  schema: Schema,
  description = "Successful response",
  example?: any,
) => ({
  description,
  content: { "application/json": { schema, ...(example ? { example } : {}) } },
});
const errorResponses = Object.fromEntries(
  [
    [400, "Invalid input. Check error.fields when present."],
    [
      401,
      "Customer session or supplied integration key is missing/invalid/expired.",
    ],
    [403, "Inactive account, incorrect role, integration scope or key mode."],
    [
      405,
      "Wrong HTTP method. Use the method documented for this endpoint and inspect Allow.",
    ],
    [413, "Request body exceeds the API size limit."],
    [
      415,
      "Unsupported request encoding. Send JSON with Content-Type: application/json.",
    ],
    [
      404,
      "Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404.",
    ],
    [
      409,
      "Offer/price/state changed. Refresh the saved booking or current offer; do not silently accept a new price.",
    ],
    [429, "Request limit exceeded. Respect the Retry-After response header."],
    [
      502,
      "Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself.",
    ],
    [
      503,
      "Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable.",
    ],
  ].map(([status, description]) => [
    status,
    {
      description,
      headers:
        status === 405
          ? {
              Allow: {
                description: "Supported HTTP methods for this endpoint",
                schema: { type: "string" },
              },
            }
          : status === 429
            ? {
                "Retry-After": {
                  description:
                    "Seconds before retry; limits also apply at the edge",
                  schema: { type: "string" },
                },
              }
            : {},
      content: {
        "application/json": {
          schema: ref("Error"),
          example: {
            error:
              status === 409
                ? "The price has changed. Refresh the offer and review the new total before paying."
                : String(description),
          },
        },
      },
    },
  ]),
);

export const mobileGuides = [
  {
    id: "app-blueprint",
    title: "FlyRaudah OTA app screen blueprint",
    body: "Build the FlyRaudah mobile app on the same customer accounts and OTA engine as the web app. Product access, prices, payments and reservation status remain authoritative on the server. This guide describes the current implemented contract; a native application itself is a separate deliverable.",
    steps: [
      "Home: GET /capabilities, /config and /exchange-rates. Show test/live mode and support contacts; hide disabled search/checkout products. Reference FX is informational, not the selling price.",
      "Flights: debounce GET /places?q=, choose returned IATA codes, POST /flights/search, then GET /flights/offers/{id}. Use each slice/segment for local departure/arrival times, stops, airline and available baggage/conditions. Filtering/sorting runs on the returned offers; do not invent cheaper date prices.",
      "Hotels: select a destination with latitude/longitude from the app's city list or a separately integrated geocoder, POST /hotels/search, POST /hotels/rates/{id} with {}, then sign in and POST /hotels/quotes with rateId. Arbitrary destination text is not accepted as coordinates. Show room conditions, cancellation deadlines and any separately payable property extras.",
      "Account: use Clerk sign-up/sign-in/verification and secure SDK token storage, POST /me/bootstrap, then GET /me. Names/contact from the checkout do not change the account profile. Account editing and deletion use the identity provider's account flow; there is no OTA password or administrator API for mobile customers.",
      "Traveller review: retain refreshed offer passenger IDs and ask for matching birth dates, names, E.164 contact and required passports. Hotel guest count must match the final quote. Explicitly accept terms and use the latest pricing.totalKobo.",
      "Checkout: POST /bookings once per explicit confirmation. Save the returned booking ID before POST /bookings/{id}/pay. Disable repeated taps; do not silently retry checkout creation after a timeout because Idempotency-Key is not supported. Recover GET /bookings first.",
      "Payment: open only the server authorizationUrl in the system authentication/browser flow. On web return, app resume or app restart, GET the retained booking and POST /complete only when appropriate. A browser success screen or mobile deep link is never payment proof.",
      "My Trips: GET /bookings?offset=; use nextOffset, merge by ID, compare revisions and show pending/confirmed/attention summaries. Trip details use GET /bookings/{id}, GET /timeline and occasional POST /refresh with {}. Show supplied documents safely; never synthesize ticket numbers.",
      "Inbox and help: GET /updates?offset=, POST /updates/{encodedId}/read or /updates/read-all, and POST /bookings/{id}/service-request. Poll only while active and respect Retry-After; native push, seats, infants, multi-city and instant self-service refunds/exchanges are not currently exposed.",
      "Release acceptance: run the documented staging payment/provider tests with matching modes, migration 0012 only if backend keys are used, HTTPS, secret isolation, ownership tests, timeout recovery and operator reconciliation. Production Stays access and a funded supplier account are separate provider requirements.",
    ],
  },
  {
    id: "overview",
    title: "Build the Raudah mobile experience",
    body: "Use one backend for the web and mobile apps. OTA v1 covers flight and prepaid hotel discovery, authenticated checkout, hosted payment, saved trips and travel updates. Public inventory is not a guarantee of a reservation. Fetch capabilities before exposing checkout or Stays. All examples are illustrative: use current supplier IDs, prices and availability from actual responses.",
    steps: [
      "Discover enabled products with GET /capabilities and GET /config.",
      "Let the traveller search, inspect an offer or hotel quote, and review all conditions.",
      "Use the same Clerk account as the web app; bootstrap an active travel profile after sign-in.",
      "Create a saved checkout, retain its booking ID, open the hosted payment URL, then verify the server booking status.",
      "Build My Trips and the update inbox from owner-authenticated endpoints.",
    ],
  },
  {
    id: "authentication",
    title: "Customer authentication & account setup",
    body: "Use the same Clerk instance as the web app. A native client obtains a current session JWT from the Clerk SDK and sends Authorization: Bearer <session_token>. No user ID, role or email supplied in a request is accepted as proof of identity. Call POST /me/bootstrap after sign-in for a new mobile account: the server reads verified email/name from Clerk, creates only a user profile, and does not reactivate blocked accounts. GET /me returns the active profile. Session JWTs are short-lived; ask the SDK for a token for each request and refresh authentication after a 401. Native HTTP requests normally send no Origin header. Browser/WebView origins must be allowlisted; do not forge an Origin header to bypass browser policy.",
    steps: [
      "Install the current supported @clerk/expo SDK and expo-secure-store for an Expo app; use the SDK’s documented token cache.",
      "Configure EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY with the publishable key of the same Clerk instance. Configure native sign-in providers, redirect schemes and the application IDs in Clerk.",
      "Never ship CLERK_SECRET_KEY, Duffel tokens, Paystack secret keys or a privileged operator session in a mobile build.",
      "After SDK sign-in, POST /me/bootstrap with the session Bearer token; a verified primary email is required for a new profile.",
      "Do not persist passport/contact payloads in analytics, logs, crash breadcrumbs or unencrypted local storage.",
    ],
    links: [
      {
        label: "Clerk Expo session access",
        url: "https://clerk.com/docs/expo/guides/users/reading",
      },
      {
        label: "Express bearer/cookie authentication",
        url: "https://clerk.com/docs/reference/express/clerk-middleware",
      },
      {
        label: "Expo authentication setup",
        url: "https://docs.expo.dev/guides/using-clerk/",
      },
    ],
  },
  {
    id: "keys",
    title: "API key setup, scopes & rotation",
    body: "First-party mobile apps use public search plus customer session JWTs; they do not need an embedded secret API key. Optional search integration keys are for your trusted server/BFF. Super admins create them in this Developer Centre, select test/live mode, allowed public-read scopes, a 1–365 day expiry and a 10–60 request/minute limit. A raw key is shown once; only its SHA-256 digest is stored. Send it in X-OTA-API-Key from your server. It never authorizes customers, hotel quotes, bookings, payments, administration or provider callbacks—even when a customer token is also sent. Do not put it in a mobile bundle, web client, URL, repository or analytics.",
    steps: [
      "Apply migration 0012_ota_api_keys.sql before using key management. Existing web/customer APIs and docs do not require keys or this table.",
      "Create a test key with only the scopes your server needs: config:read, flights:read and/or hotels:read.",
      "Keep the secret in your server’s secret manager and send it only to your Raudah API over HTTPS.",
      "Key mode must match the selected OTA mode. A live key does not enable live sales or replace provider setup.",
      "Rotate by creating a replacement, updating the trusted service, verifying a read request and revoking the old key. Revocation/expiry are checked on every request.",
      "Per-key limits use a shared database counter. Public per-process account/IP limits and edge limits still apply; provision shared edge throttling for multi-instance production.",
    ],
  },
  {
    id: "flights",
    title: "Flight search → offer → checkout",
    body: "Use GET /places for city/airport suggestions and select the returned IATA code. POST /flights/search supports one-way or return trips, economy/premium economy/business/first, adults and children aged 2–11. At most nine passengers total. Results include supplier offer/passenger IDs, itinerary, expiry, conditions and server-priced pricing.totalKobo. Re-fetch GET /flights/offers/{id} before checkout. Map each traveller to that offer’s passenger ID; birth date must match the searched age at departure. Provide passport data when passenger_identity_documents_required is true. A passport supplied optionally is still validated through the last itinerary date. Entry/visa/extra passport-validity requirements are not determined by this API.",
    steps: [
      "POST /flights/search with origin, destination, departureDate, optional returnDate, adults, childAges and cabinClass.",
      "Render both slices for a return offer; never present its bundled price as one leg’s separate fare. Filter stops using connections plus technical stops.",
      "GET /flights/offers/{id}; display pricing.totalKobo, expiry, baggage and cancellation/change conditions.",
      "POST /bookings with kind=flight, current offerId, acceptedTerms=true, contact, one matching traveller per passenger, and expectedTotalKobo from the last response.",
      "A 409 price change requires fresh presentation and explicit traveller confirmation. A saved checkout is not yet a paid or supplier-confirmed booking.",
    ],
  },
  {
    id: "hotels",
    title: "Prepaid Stays → room → final quote",
    body: "Duffel Stays access must be enabled for the organisation. POST /hotels/search uses geographic coordinates, a 10km search radius, 1–99 nights, check-in within 330 days, 1–8 rooms and at least one adult per room. Adults max 16 and children max 8, ages 0–17. POST /hotels/rates/{searchResultId} returns supported prepaid balance rates only. Card guarantees, deposits, loyalty-required and property-payable room rates are excluded; separately payable property extras may still be returned and must be shown. Creating and retrieving a final quote require a signed-in active customer. Quote availability and final room conditions control checkout.",
    steps: [
      "Search by latitude/longitude and dates; return property pictures, location and star rating as supplied.",
      "Fetch all supported rates for an srr_ search result and display board type, cancellation timeline and property extras.",
      "POST /hotels/quotes with the selected rat_ rateId and a customer Bearer token; retain the returned quo_ ID.",
      "GET /hotels/quotes/{id} immediately before checkout and collect one guest record per quote guest.",
      "POST /bookings with kind=hotel and the final quote ID as offerId. Payment and confirmation then use the same saved-booking workflow as flights.",
    ],
  },
  {
    id: "payments",
    title: "Hosted payment & reliable app return",
    body: "POST /bookings/{id}/pay returns a validated HTTPS Paystack checkout URL tied to that saved booking. Open it in the platform browser or supported secure browser session. The backend currently sets the return URL to the web booking page /travel/bookings/{id}; arbitrary callback URLs or app schemes are not accepted. On app resume, retrieve the saved booking and call POST /complete when appropriate; a payment return URL, app callback or client success flag never proves payment. The server verifies amount, NGN, reference, metadata and test/live mode before claiming supplier fulfillment. It never accepts a browser-supplied paid amount/status as evidence.",
    steps: [
      "Save booking.id/reference on the device before opening the payment browser. Fetch the latest customer JWT again when returning.",
      "Use an external browser/auth session, not a WebView that intercepts payment credentials. Follow the payment provider’s supported browser flow.",
      "On app resume, GET /bookings/{id}; if payment_pending, POST /bookings/{id}/complete initiates canonical verification and returns the saved booking state.",
      "Display confirmed only when the backend says confirmed. Supplier confirmation and later ticket-document availability are separate facts.",
      "Use Universal Links/App Links only after configuring real bundle/package IDs, signing certificates and the domain association files. Those mobile-domain files are not supplied automatically by this API.",
      "Sandbox Duffel and Paystack test modes must match. Never switch a working live payment account to test just to test this app; use staging with matching credentials.",
    ],
  },
  {
    id: "recovery",
    title: "Idempotency, retries & ambiguous outcomes",
    body: "POST /bookings currently does not support an Idempotency-Key header. If its response is lost, retrieve booking history and recover the matching saved checkout before creating another. Prevent double taps and retain the returned booking ID. Payment initialization uses one stable reference per booking. Repeating /complete returns/reconciles the existing checkout claim; it cannot authorize blind re-purchase. If the supplier outcome is ambiguous, the backend keeps requires_review and the operator must reconcile it. A general network error never proves a reservation or payment failed.",
    steps: [
      "GET requests can be retried with bounded exponential backoff and jitter; obey 429 Retry-After.",
      "Do not automatically retry checkout creation, quote creation or payment initialization after a timeout without checking saved state.",
      "Give /complete a sufficiently long client timeout (for example 180 seconds) because supplier creation can take more than two minutes. If the client times out, recover by GET; do not purchase again.",
      "Poll a processing booking approximately every 5 seconds while visible; poll settled records/updates approximately every 30 seconds. Stop background polling when the app is inactive.",
      "Compare booking.revision, not client completion order, before replacing a screen snapshot. Ignore lower revisions for the same booking ID.",
      "A cancellation is not a refund. Only refunded means the backend has recorded a verified full customer refund; bank settlement timing is separate.",
    ],
  },
  {
    id: "trips",
    title: "My Trips, documents & travel updates",
    body: "Booking endpoints always derive ownership from the verified session. GET /bookings returns 50 rows, nextOffset and all-owner summary counts. GET /bookings/{id}/timeline returns up to 100 customer-safe lifecycle events; the raw admin audit is not available. GET /updates returns 20 OTA-only notifications, nextOffset and an all-owner unreadCount. Mark an update read through /updates/{id}/read, URL-encoding the whole notification ID; read-all affects only the signed-in customer’s OTA updates. Retrieve providerResult.documents when supplied for ticket identifiers/documents. Do not invent e-ticket numbers or promise a PDF URL when none is returned.",
    steps: [
      "Persist only the booking ID/reference needed for recovery; re-fetch sensitive details from the authenticated API.",
      "POST /bookings/{id}/refresh with {} performs a supplier read, not a repeat purchase. Use sparingly because it consumes provider capacity.",
      "Show providerNotice and the customer-safe issue message; booking timelines may contain customer support replies.",
      "POST /bookings/{id}/service-request saves a 10–2000 character request for support. It does not itself cancel, change or refund a reservation.",
      "My Trips on the web remains at /dashboard/my-trips and a booking web page is /travel/bookings/{id}. No dedicated native PDF-export or push-token registration endpoint is implemented.",
    ],
  },
  {
    id: "states",
    title: "Booking state machine & amounts",
    body: "payment_pending: checkout saved, payment not verified. processing: payment verified and supplier outcome in progress; do not collect payment again. confirmed: supplier reservation confirmed; documents may arrive later. requires_review: payment/reservation ambiguity requiring support; suppress pay-again actions. cancelled: supplier cancellation confirmed/observed; do not imply a refund. refunded: full customer refund verified and recorded by an operator. Revision increases on material state changes. amountKobo and pricing.totalKobo are integer NGN minor units (100 kobo = ₦1); supplier amounts remain decimal strings in supplier currency. Admin selling rates/markups and saved checkout totals are not overwritten by the comparison-rate feed.",
    steps: [
      "Render amounts with the NGN currency and divide kobo by 100 only for display.",
      "Search/quote pricing is advisory until refreshed and accepted; keep the saved checkout’s original total after payment.",
      "Display provider timestamps in each airport/property’s local timezone; date-only travel dates are YYYY-MM-DD and should not shift through UTC conversion.",
      "Call /capabilities to hide disabled features and distinguish test from live. Test reservations are visibly labelled throughout the app.",
    ],
  },
  {
    id: "webhooks",
    title: "Provider events & mobile notifications",
    body: "Paystack delivers signed events to the existing /api/payments/paystack/webhook (or the OTA-only /api/ota/payments/webhook). Duffel events use /api/ota/duffel/webhook/test or /live. These are provider-to-server endpoints; do not call them from the mobile app, install provider secrets in the app or point provider webhooks at device URLs. The server verifies signatures, stores event work durably, reconciles reservations and publishes customer updates. The mobile app consumes /updates, /timeline and current booking snapshots. Native push notifications, partner event subscriptions and an SSE/WebSocket API are not implemented.",
    steps: [
      "Keep the API worker continuously running for payment jobs, supplier events, refreshes and update publication.",
      "Activate Duffel receivers only after migrations, deployed configuration and a valid signed Ping are verified.",
      "Monitor requires-review bookings, exhausted events and payment-vs-reservation reconciliation in the super-admin OTA console.",
    ],
  },
  {
    id: "scope",
    title: "Supported scope & launch checklist",
    body: "This is the implemented Raudah OTA API, not a claim of Trip.com feature parity. Supported: one-way/return flights, adult/child travel, prepaid hotel inventory, owner checkout/history, hosted payment, supplier updates and support requests. Not exposed: multi-city, infants, ancillary/seat sales, held orders, self-service exchanges/cancellations, arbitrary payment callbacks, partial-refund APIs, native push subscriptions or partner booking-on-behalf APIs. Direct unsupported requests to support. Do not represent these as completed features in a mobile UI.",
    steps: [
      "Deploy API and web code together; apply the required OTA migrations and 0012 for optional search keys.",
      "Use the same Clerk instance and verify new-account bootstrap plus blocked-account rejection.",
      "Confirm provider products/access, modes, selling rates, support contacts, HTTPS origin and funded supplier balance.",
      "Test success, pending/failed payment, lost browser return, repeated callbacks, app kill/resume, changed/expired price, duplicate taps and interrupted supplier responses in staging.",
      "Verify ownership isolation, API key scope/revocation/expiry/rate limits, update read ownership, document access and support responses.",
      "Add shared edge throttling, monitoring, secret rotation, operational reconciliation and privacy-safe mobile crash/analytics handling before enabling live sales.",
    ],
  },
];

export function otaOpenApi() {
  const travelDate = new Date(Date.now() + 45 * 86400000)
      .toISOString()
      .slice(0, 10),
    returnDate = new Date(Date.now() + 52 * 86400000)
      .toISOString()
      .slice(0, 10);
  let origin = "https://flyraudah.com.ng";
  try {
    if (process.env.APP_URL) origin = new URL(process.env.APP_URL).origin;
  } catch {
    /* Use the known public origin. */
  }
  const pricingExample = {
    supplierKobo: 13447900,
    markupKobo: 0,
    feeKobo: 0,
    totalKobo: 13447900,
    currency: "NGN",
    rate: 1344.79,
    supplierCurrency: "USD",
    supplierAmount: "100.00",
  };
  const flightExample = {
    id: "off_example123",
    total_amount: "100.00",
    total_currency: "USD",
    expires_at: new Date(Date.now() + 600000).toISOString(),
    passengers: [{ id: "pas_example123", type: "adult" }],
    owner: { id: "arl_example123", name: "Example airline" },
    slices: [
      {
        origin: { iata_code: "LOS", city_name: "Lagos" },
        destination: { iata_code: "JED", city_name: "Jeddah" },
        duration: "PT5H30M",
        segments: [
          {
            departing_at: `${travelDate}T10:00:00`,
            arriving_at: `${travelDate}T17:30:00`,
            origin: { iata_code: "LOS" },
            destination: { iata_code: "JED" },
            passengers: [
              {
                passenger_id: "pas_example123",
                cabin_class: "economy",
                baggages: [],
              },
            ],
          },
        ],
      },
    ],
    pricing: pricingExample,
  };
  const traveller = {
    id: "pas_example123",
    given_name: "Example",
    family_name: "Traveller",
    born_on: "1990-01-01",
    title: "mr",
    gender: "m",
    email: "traveller@example.com",
    phone_number: "+2348012345678",
  };
  const bookingExample = {
    id: "41af391c-653c-4eb0-a168-cbd81d8e12d1",
    reference: "OTA-example",
    kind: "flight",
    mode: "test",
    status: "payment_pending",
    revision: 0,
    providerOfferId: "off_example123",
    providerBookingId: null,
    amountKobo: 13447900,
    pricing: pricingExample,
    offer: flightExample,
    travellers: [traveller],
    contact: { email: "traveller@example.com", phone: "+2348012345678" },
    expiresAt: new Date(Date.now() + 600000).toISOString(),
    paidAt: null,
    providerResult: null,
    providerNotice: null,
    issue: null,
    serviceRequest: null,
    refund: null,
  };
  const schemas: Schema = {
    Error: object(
      {
        error: string("Human-readable safe error message"),
        fields: array(string("Invalid request field path")),
      },
      ["error"],
    ),
    Pricing: object(
      {
        supplierKobo: integer("Converted supplier price in kobo"),
        markupKobo: integer("Configured markup in kobo"),
        feeKobo: integer("Configured service fee in kobo"),
        totalKobo: integer(
          "Total integer NGN price to show and submit as expectedTotalKobo",
          1,
        ),
        currency: string("Selling currency", { enum: ["NGN"] }),
        rate: {
          type: "number",
          description: "Configured NGN per supplier-currency unit",
        },
        supplierCurrency: string("Supplier ISO currency"),
        supplierAmount: string("Supplier decimal amount; preserve as a string"),
      },
      ["totalKobo", "currency", "supplierCurrency", "supplierAmount"],
      { example: pricingExample },
    ),
    Profile: object(
      {
        id: string("Internal profile ID"),
        email: string("Verified account email", { format: "email" }),
        fullName: string("Account display name"),
        phone: nullable(string("Account contact phone")),
        role: string(
          "Existing account role; never accepted from a mobile client",
        ),
      },
      ["id", "email", "fullName", "role"],
    ),
    ProfileResponse: object({ profile: ref("Profile") }, ["profile"]),
    Contact: object(
      {
        email: string("Booking email", { format: "email", maxLength: 254 }),
        phone: string("E.164 contact number", {
          pattern: "^\\+[1-9]\\d{6,14}$",
        }),
        specialRequests: string("Optional hotel accommodation request", {
          maxLength: 1000,
        }),
      },
      ["email", "phone"],
    ),
    Guest: object(
      {
        given_name: string("Given name", { minLength: 1, maxLength: 100 }),
        family_name: string("Family name", { minLength: 1, maxLength: 100 }),
        born_on: date("Optional date of birth for hotel guests"),
      },
      ["given_name", "family_name"],
    ),
    Passport: object(
      {
        type: string("Document type", { enum: ["passport"] }),
        unique_identifier: string("Passport number", {
          minLength: 4,
          maxLength: 30,
        }),
        expires_on: date(
          "Expiry must be current/future and valid through the final itinerary date",
        ),
        issuing_country_code: string("Two-letter uppercase country code", {
          pattern: "^[A-Z]{2}$",
        }),
      },
      ["type", "unique_identifier", "expires_on", "issuing_country_code"],
    ),
    FlightTraveller: object(
      {
        id: string("Exactly one matching pas_ ID from the selected offer"),
        given_name: string("Given name", { minLength: 1, maxLength: 100 }),
        family_name: string("Family name", { minLength: 1, maxLength: 100 }),
        born_on: date(
          "Must match the searched passenger type/age at departure",
        ),
        title: string("Passenger title", {
          enum: ["mr", "ms", "mrs", "miss", "dr"],
        }),
        gender: string("Provider gender code", { enum: ["m", "f"] }),
        email: string("Passenger email", { format: "email" }),
        phone_number: string("E.164 phone", { pattern: "^\\+[1-9]\\d{6,14}$" }),
        identity_documents: array(ref("Passport"), {
          maxItems: 1,
          description:
            "Required when the offer requires passenger identity documents",
        }),
      },
      [
        "id",
        "given_name",
        "family_name",
        "born_on",
        "title",
        "gender",
        "email",
        "phone_number",
      ],
      { example: traveller },
    ),
    Segment: object(
      {
        id: string("Supplier segment ID"),
        departing_at: string(
          "Local departure timestamp as supplied; preserve timezone information",
        ),
        arriving_at: string("Local arrival timestamp as supplied"),
        origin: object({
          iata_code: string("Departure IATA"),
          name: string("Airport name"),
        }),
        destination: object({
          iata_code: string("Arrival IATA"),
          name: string("Airport name"),
        }),
        origin_terminal: nullable(string("Departure terminal")),
        destination_terminal: nullable(string("Arrival terminal")),
        marketing_carrier: object({
          name: string("Marketing carrier"),
          iata_code: string("Carrier code"),
        }),
        operating_carrier: object({ name: string("Operating carrier") }),
        marketing_carrier_flight_number: string("Flight number"),
        stops: array(object({}, [], { additionalProperties: true })),
        passengers: array(
          object(
            {
              passenger_id: string("Passenger ID"),
              cabin_class: string("Cabin"),
              baggages: array(
                object({
                  type: string("Baggage type"),
                  quantity: integer("Quantity"),
                }),
              ),
            },
            [],
            { additionalProperties: true },
          ),
        ),
      },
      [],
      { additionalProperties: true },
    ),
    Slice: object(
      {
        id: string("Supplier slice ID"),
        origin: object({
          iata_code: string("Origin IATA"),
          city_name: nullable(string("City")),
        }),
        destination: object({
          iata_code: string("Destination IATA"),
          city_name: nullable(string("City")),
        }),
        duration: string("ISO 8601 duration, e.g. PT5H30M"),
        segments: array(ref("Segment")),
      },
      [],
      { additionalProperties: true },
    ),
    FlightOffer: object(
      {
        id: string("off_ ID"),
        total_amount: string("Supplier decimal total"),
        total_currency: string("Supplier ISO currency"),
        expires_at: timestamp("Supplier offer expiry"),
        owner: object({
          id: string("Airline ID"),
          name: string("Airline name"),
          logo_symbol_url: nullable(string("Supplier logo URL")),
        }),
        passengers: array(
          object({
            id: string("pas_ ID"),
            type: string("adult or child"),
            age: integer("Child age when provided"),
          }),
        ),
        passenger_identity_documents_required: bool(
          "Requires passport data in every flight traveller",
        ),
        slices: array(ref("Slice")),
        conditions: object({}, [], { additionalProperties: true }),
        pricing: ref("Pricing"),
      },
      ["id"],
      { additionalProperties: true, example: flightExample },
    ),
    HotelResult: object(
      {
        id: string("srr_ search result ID"),
        accommodation: object(
          {
            name: string("Property name"),
            rating: {
              type: "number",
              description: "Supplier star rating, not a customer review score",
            },
            photos: array(object({ url: string("Property image URL") })),
            location: object({}, [], { additionalProperties: true }),
          },
          [],
          { additionalProperties: true },
        ),
        pricing: ref("Pricing"),
      },
      ["id", "pricing"],
      { additionalProperties: true },
    ),
    HotelRate: object(
      {
        id: string("rat_ rate ID"),
        name: string("Rate name"),
        board_type: string("Board basis when supplied"),
        payment_type: string("Only supported prepaid rates are exposed"),
        conditions: array(
          object(
            {
              title: string("Condition title"),
              description: string("Condition details"),
            },
            [],
            { additionalProperties: true },
          ),
        ),
        cancellation_timeline: array(
          object(
            {
              before: string("Deadline"),
              currency: string("Refund currency"),
              refund_amount: string("Supplier refund decimal amount"),
            },
            [],
            { additionalProperties: true },
          ),
        ),
        due_at_accommodation_amount: string(
          "Separately payable extras; not included in the online total",
        ),
        due_at_accommodation_currency: string("Currency of property extras"),
        pricing: ref("Pricing"),
      },
      ["id", "pricing"],
      { additionalProperties: true },
    ),
    HotelQuote: object(
      {
        id: string("quo_ final quote ID"),
        expires_at: timestamp(
          "Expiry when returned; revalidation is mandatory",
        ),
        total_amount: string("Supplier decimal total"),
        total_currency: string("Supplier currency"),
        guests: array(
          object(
            {
              type: string("Adult/child"),
              age: integer("Child age when supplied"),
            },
            [],
            { additionalProperties: true },
          ),
        ),
        accommodation: object({}, [], { additionalProperties: true }),
      },
      ["id"],
      { additionalProperties: true },
    ),
    Booking: object(
      {
        id: string("Saved checkout UUID", { format: "uuid" }),
        reference: string("Stable OTA payment/reference identifier"),
        kind: string("Product", { enum: ["flight", "hotel"] }),
        mode: string("Original checkout mode", { enum: ["test", "live"] }),
        status: string("Authoritative booking state", {
          enum: [
            "payment_pending",
            "processing",
            "confirmed",
            "requires_review",
            "cancelled",
            "refunded",
          ],
        }),
        revision: integer(
          "Monotonic material revision; ignore lower revisions for the same booking",
        ),
        amountKobo: integer("Saved total NGN minor units", 1),
        providerOfferId: string("Original off_ or quo_ ID"),
        providerBookingId: nullable(
          string("ord_ flight reservation or bok_ hotel booking ID"),
        ),
        pricing: ref("Pricing"),
        offer: object({}, [], { additionalProperties: true }),
        travellers: array(object({}, [], { additionalProperties: true })),
        contact: ref("Contact"),
        providerResult: nullable(
          object(
            {
              documents: array(object({}, [], { additionalProperties: true })),
            },
            [],
            { additionalProperties: true },
          ),
        ),
        providerNotice: nullable(string("Supplier-facing customer notice")),
        issue: nullable(string("Customer-safe review message")),
        serviceRequest: nullable(string("Current support request")),
        refund: nullable(object({}, [], { additionalProperties: true })),
        authorizationUrl: nullable(
          string("Hosted payment URL when initialised"),
        ),
        expiresAt: timestamp("Saved checkout expiry"),
        paidAt: nullable(timestamp("Canonical payment verified at")),
        createdAt: timestamp("Created at"),
        updatedAt: timestamp("Updated at"),
      },
      ["id", "reference", "kind", "mode", "status", "revision", "amountKobo"],
      { additionalProperties: true, example: bookingExample },
    ),
    BookingResponse: object({ booking: ref("Booking") }, ["booking"], {
      example: { booking: bookingExample },
    }),
    BookingCreate: object(
      {
        kind: string("Product", { enum: ["flight", "hotel"] }),
        offerId: string("Current off_ flight offer ID or quo_ hotel quote ID"),
        acceptedTerms: {
          type: "boolean",
          enum: [true],
          description: "Explicit acceptance of the currently displayed terms",
        },
        expectedTotalKobo: integer(
          "Use the current server pricing.totalKobo; must match exactly",
          1,
        ),
        contact: ref("Contact"),
        travellers: array(
          { anyOf: [ref("FlightTraveller"), ref("Guest")] },
          {
            minItems: 1,
            maxItems: 24,
            description:
              "Flight: every offer passenger exactly once; hotel: one guest per quote guest",
          },
        ),
      },
      [
        "kind",
        "offerId",
        "acceptedTerms",
        "expectedTotalKobo",
        "contact",
        "travellers",
      ],
      {
        oneOf: [
          object(
            {
              kind: { type: "string", enum: ["flight"] },
              travellers: array(ref("FlightTraveller")),
            },
            ["kind"],
          ),
          object(
            {
              kind: { type: "string", enum: ["hotel"] },
              travellers: array(ref("Guest")),
            },
            ["kind"],
          ),
        ],
        example: {
          kind: "flight",
          offerId: "off_example123",
          acceptedTerms: true,
          expectedTotalKobo: 13447900,
          contact: bookingExample.contact,
          travellers: [traveller],
        },
      },
    ),
    TimelineEvent: object(
      {
        id: string("Event ID"),
        title: string("Customer-facing title"),
        message: string("Customer-safe description"),
        createdAt: timestamp("Event time"),
        urgent: bool("Needs traveller attention"),
        response: string(
          "Customer-visible reply on a resolved support request",
        ),
      },
      [],
      { additionalProperties: true },
    ),
    TravelUpdate: object(
      {
        id: string("Opaque OTA notification ID; URL-encode when marking read"),
        title: string("Notification title"),
        message: string("Customer message"),
        isRead: bool("Read status"),
        type: string("Notification type"),
        link: nullable(string("Relative web link, not a native app deep link")),
        createdAt: timestamp("Creation time"),
      },
      ["id", "title", "message", "isRead", "createdAt"],
    ),
  };
  const paths: Schema = {};
  function add(
    method: string,
    path: string,
    summary: string,
    tag: string,
    description: string,
    options: {
      auth?: boolean;
      body?: Schema;
      response?: Schema;
      example?: any;
      status?: number;
      parameters?: any[];
      scope?: string;
      idempotency?: string;
    } = {},
  ) {
    paths[path] ??= {};
    // These are Raudah-owned envelopes, whose keys are always returned. Supplier
    // objects remain explicitly optional where provider fields can vary.
    if (options.response?.type === "object" && !options.response.required) {
      options.response.required = Object.keys(
        options.response.properties || {},
      );
    }
    const parameterIds = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
      name: match[1],
      in: "path",
      required: true,
      schema: { type: "string" },
      description:
        "Use the current identifier returned by the API; URL-encode it.",
    }));
    paths[path][method.toLowerCase()] = {
      operationId: `${method.toLowerCase()}${path.replace(/[^A-Za-z0-9]/g, "_")}`,
      summary,
      tags: [tag],
      description,
      security: options.auth ? customer : publicAccess,
      parameters: [...parameterIds, ...(options.parameters || [])],
      ...(options.scope ? { "x-key-scope": options.scope } : {}),
      "x-idempotency":
        options.idempotency ||
        (method === "GET"
          ? "Read-only; bounded retry with backoff."
          : "Do not automatically retry after an ambiguous timeout; recover state first."),
      ...(options.body
        ? {
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: options.body,
                  ...(options.body.example
                    ? { example: options.body.example }
                    : {}),
                },
              },
            },
          }
        : {}),
      responses: {
        [options.status || 200]: success(
          options.response || empty,
          "Successful response",
          options.example,
        ),
        ...errorResponses,
      },
    };
  }
  add(
    "GET",
    "/config",
    "Read channel availability",
    "Discovery",
    "Public feature switches, mode and support contacts. Hide disabled checkout and Stays actions.",
    {
      scope: "config:read",
      response: object({
        flightsEnabled: bool("Flight search enabled"),
        hotelsEnabled: bool("Stays search enabled"),
        salesEnabled: bool("Online checkout enabled"),
        mode: string("Mode", { enum: ["test", "live"] }),
        supportEmail: string("Support email"),
        supportPhone: string("Support phone"),
      }),
      example: {
        flightsEnabled: true,
        hotelsEnabled: false,
        salesEnabled: false,
        mode: "test",
        supportEmail: "",
        supportPhone: "",
      },
    },
  );
  add(
    "GET",
    "/capabilities",
    "Discover mobile features & limits",
    "Discovery",
    "Implemented features, active switches, limits and suggested foreground polling intervals. No supplier credentials are exposed.",
    {
      scope: "config:read",
      response: object({
        apiVersion: string("1"),
        mode: string("test/live"),
        currency: string("NGN"),
        features: object({
          flightSearch: bool("Enabled flight search"),
          hotelSearch: bool("Enabled hotel search"),
          onlineCheckout: bool("Enabled checkout"),
          bookingHistory: bool("Implemented"),
          bookingUpdates: bool("Implemented"),
          supportRequests: bool("Implemented"),
          selfServiceCancellation: bool("False"),
          selfServiceExchange: bool("False"),
          multiCity: bool("False"),
          infants: bool("False"),
          ancillaries: bool("False"),
        }),
        limits: object({}, [], { additionalProperties: { type: "integer" } }),
        polling: object({
          processingSeconds: integer("5"),
          settledSeconds: integer("30"),
        }),
        support: object({
          email: string("Support email"),
          phone: string("Support phone"),
        }),
      }),
    },
  );
  add(
    "GET",
    "/exchange-rates",
    "Read selling & reference FX",
    "Discovery",
    "sellingRates are operator-controlled NGN-per-unit selling rates. The separate reference object is a dated comparison feed and may be stale/unavailable; it never changes checkout prices.",
    {
      scope: "config:read",
      response: object({
        sellingRates: object({}, [], {
          additionalProperties: { type: "number" },
        }),
        reference: object(
          {
            provider: string("Reference source"),
            frequency: string("Publication frequency, e.g. daily"),
            status: string("current/stale/unavailable"),
            stale: bool("Stale reference"),
            fetchedAt: nullable(timestamp("Fetch time")),
            rates: object({}, [], {
              additionalProperties: object({
                ngnPerUnit: { type: "number" },
                date: date("Source date"),
              }),
            }),
          },
          [],
          { additionalProperties: true },
        ),
      }),
    },
  );
  add(
    "GET",
    "/me",
    "Read active travel profile",
    "Identity",
    "Customer session required; 403 if profile is absent/inactive. Use bootstrap for a new account.",
    { auth: true, response: ref("ProfileResponse") },
  );
  add(
    "POST",
    "/me/bootstrap",
    "Create/reuse the signed-in profile",
    "Identity",
    "Idempotently links the verified Clerk session to a user profile. A new account requires a verified primary Clerk email. Identity/role fields from the request body are ignored; blocked accounts remain blocked.",
    {
      auth: true,
      body: empty,
      response: ref("ProfileResponse"),
      idempotency:
        "Safe to repeat; a unique Clerk user ID prevents duplicate profiles.",
    },
  );
  add(
    "GET",
    "/places",
    "Find cities & airports",
    "Flights",
    "Select an IATA code from returned places. A city result may represent all its airports. No customer login required.",
    {
      scope: "flights:read",
      parameters: [
        {
          name: "q",
          in: "query",
          required: true,
          schema: { type: "string", minLength: 2, maxLength: 80 },
          example: "Lagos",
        },
      ],
      response: object({
        places: array(
          object(
            {
              id: string("Supplier place ID"),
              name: string("Display name"),
              iata_code: nullable(string("IATA code")),
              type: string("city/airport"),
              city_name: nullable(string("City name")),
              airports: nullable(
                array(object({}, [], { additionalProperties: true })),
              ),
            },
            [],
            { additionalProperties: true },
          ),
        ),
      }),
    },
  );
  const flightSearch = object(
    {
      origin: string("Uppercase origin IATA", { pattern: "^[A-Z]{3}$" }),
      destination: string("Different uppercase destination IATA", {
        pattern: "^[A-Z]{3}$",
      }),
      departureDate: date("Today or future"),
      returnDate: date("Optional; same day or after departure"),
      adults: integer("Adult passengers, ages 12+", 1, 9),
      childAges: array(integer("Child age at departure", 2, 11), {
        maxItems: 8,
        default: [],
      }),
      cabinClass: string("Cabin", {
        enum: ["economy", "premium_economy", "business", "first"],
        default: "economy",
      }),
    },
    ["origin", "destination", "departureDate", "adults"],
    {
      example: {
        origin: "LOS",
        destination: "JED",
        departureDate: travelDate,
        returnDate,
        adults: 1,
        childAges: [],
        cabinClass: "economy",
      },
    },
  );
  add(
    "POST",
    "/flights/search",
    "Search one-way / return flights",
    "Flights",
    "Adults plus children cannot exceed 9. Returns up to 80 currently available offers, priced and sorted by totalKobo. Empty offers is a valid no-inventory response.",
    {
      scope: "flights:read",
      body: flightSearch,
      response: object({ offers: array(ref("FlightOffer")) }),
      example: { offers: [flightExample] },
      idempotency:
        "Search only; repeat explicitly as needed. Supplier IDs/availability may change.",
    },
  );
  add(
    "GET",
    "/flights/offers/{id}",
    "Refresh an offer before checkout",
    "Flights",
    "Use a current off_ ID. Revalidates availability/expiry and returns server selling price. Keep passenger IDs and conditions from this refreshed offer.",
    {
      scope: "flights:read",
      response: object({ offer: ref("FlightOffer"), pricing: ref("Pricing") }),
      example: {
        offer: Object.fromEntries(
          Object.entries(flightExample).filter(([key]) => key !== "pricing"),
        ),
        pricing: pricingExample,
      },
    },
  );
  const hotelSearch = object(
    {
      latitude: { type: "number", minimum: -90, maximum: 90 },
      longitude: { type: "number", minimum: -180, maximum: 180 },
      checkIn: date("Current/future and within 330 days"),
      checkOut: date("1–99 nights after check-in"),
      rooms: integer("At least one adult per room", 1, 8),
      adults: integer("Adult guests", 1, 16),
      childAges: array(integer("Child age at check-in", 0, 17), {
        maxItems: 8,
        default: [],
      }),
    },
    ["latitude", "longitude", "checkIn", "checkOut", "rooms", "adults"],
    {
      example: {
        latitude: 21.4225,
        longitude: 39.8262,
        checkIn: travelDate,
        checkOut: returnDate,
        rooms: 1,
        adults: 1,
        childAges: [],
      },
    },
  );
  add(
    "POST",
    "/hotels/search",
    "Search prepaid Stays",
    "Hotels",
    "Requires enabled Duffel Stays product. Uses a 10km radius and only supported instant/prepaid inventory; supplier access errors do not imply no hotels exist.",
    {
      scope: "hotels:read",
      body: hotelSearch,
      response: object({ results: array(ref("HotelResult")) }),
    },
  );
  add(
    "POST",
    "/hotels/rates/{id}",
    "Retrieve all supported room rates",
    "Hotels",
    "Use an srr_ search result ID. Returns accommodation.rooms[].rates[] after supported-prepaid filtering; an empty rate list is valid.",
    {
      scope: "hotels:read",
      body: empty,
      response: object({
        result: object(
          {
            accommodation: object(
              {
                name: string("Property name"),
                description: string("Property description"),
                rooms: array(
                  object(
                    {
                      name: string("Room name"),
                      rates: array(ref("HotelRate")),
                    },
                    [],
                    { additionalProperties: true },
                  ),
                ),
              },
              [],
              { additionalProperties: true },
            ),
          },
          [],
          { additionalProperties: true },
        ),
      }),
    },
  );
  add(
    "POST",
    "/hotels/quotes",
    "Create final room quote",
    "Hotels",
    "Signed-in customer only; search integration keys cannot access this endpoint. Quote creation does not reserve a room.",
    {
      auth: true,
      body: object(
        { rateId: string("Current rat_ room rate ID") },
        ["rateId"],
        { example: { rateId: "rat_example123" } },
      ),
      response: object({ quote: ref("HotelQuote"), pricing: ref("Pricing") }),
    },
  );
  add(
    "GET",
    "/hotels/quotes/{id}",
    "Refresh the final hotel quote",
    "Hotels",
    "Signed-in customer only. Use the quo_ ID from quote creation. Rechecks supported payment/guest rules and availability.",
    {
      auth: true,
      response: object({ quote: ref("HotelQuote"), pricing: ref("Pricing") }),
    },
  );
  add(
    "POST",
    "/bookings",
    "Save a customer checkout",
    "Checkout",
    "Sales/product switches, modes and HTTPS callback must be configured. Fresh offer/quote, exact expectedTotalKobo and every traveller are revalidated. No supplier purchase occurs yet. Request has no Idempotency-Key support; recover history after a lost response.",
    {
      auth: true,
      body: ref("BookingCreate"),
      response: ref("BookingResponse"),
      status: 201,
      example: { booking: bookingExample },
    },
  );
  add(
    "POST",
    "/bookings/{id}/pay",
    "Open hosted Paystack payment",
    "Checkout",
    "Returns a validated Paystack HTTPS authorizationUrl using the booking’s stable reference. Callback is the configured web booking page; client-supplied callback URLs are not supported. A previously prepared redirect can be reused while the checkout is payable.",
    {
      auth: true,
      body: empty,
      response: object(
        {
          authorizationUrl: string("https://checkout.paystack.com/...", {
            format: "uri",
          }),
        },
        ["authorizationUrl"],
      ),
      idempotency:
        "Stable provider reference per booking; concurrent state changes may return 409. Refresh saved state first.",
    },
  );
  add(
    "POST",
    "/bookings/{id}/complete",
    "Verify payment & claim fulfillment",
    "Checkout",
    "Does not accept paid/status flags or amounts. Server verifies canonical Paystack proof and claims supplier creation once. May take over two minutes. Returns confirmed/review/processing/etc from the saved checkout. A repeated call cannot force automatic supplier repurchase.",
    {
      auth: true,
      body: empty,
      response: ref("BookingResponse"),
      idempotency:
        "Repeat against the same saved booking after inspecting state; payment/supplier claims are protected against duplicate fulfillment.",
    },
  );
  const offset = {
    name: "offset",
    in: "query",
    schema: { type: "integer", minimum: 0, maximum: 100000, default: 0 },
    description:
      "Use the previous nextOffset. Records are newest first; deduplicate IDs when new records arrive.",
  };
  add(
    "GET",
    "/bookings",
    "List the customer’s saved trips",
    "Trips",
    "Returns 50 newest owner records per page. Summary counts cover all the owner’s records, not only the page; pending excludes expired checkouts.",
    {
      auth: true,
      parameters: [offset],
      response: object({
        bookings: array(ref("Booking")),
        nextOffset: nullable(integer("Next page offset")),
        summary: object({
          confirmed: integer("Confirmed count"),
          pending: integer("Payable unexpired count"),
          attention: integer("Processing/review/supplier-notice count"),
        }),
      }),
    },
  );
  add(
    "GET",
    "/bookings/{id}",
    "Recover the saved booking",
    "Trips",
    "The authenticated owner only. Someone else’s ID returns 404. Compare revision before replacing the current mobile snapshot.",
    { auth: true, response: ref("BookingResponse") },
  );
  add(
    "POST",
    "/bookings/{id}/refresh",
    "Read latest supplier status",
    "Trips",
    "Owner only. Performs a read-only supplier refresh for a linked reservation; never creates or repeats a reservation. Do not poll this supplier action aggressively.",
    {
      auth: true,
      body: empty,
      response: ref("BookingResponse"),
      idempotency:
        "Supplier read/reconciliation only; material revisions may advance.",
    },
  );
  add(
    "GET",
    "/bookings/{id}/timeline",
    "Read customer lifecycle timeline",
    "Trips",
    "Up to 100 newest customer-safe lifecycle entries; raw audit details are private. Unknown/internal audit actions are not exposed.",
    { auth: true, response: object({ events: array(ref("TimelineEvent")) }) },
  );
  add(
    "POST",
    "/bookings/{id}/service-request",
    "Ask support for a change/refund review",
    "Trips",
    "Saves a customer request; it does not itself cancel, exchange or refund anything. A later request replaces the current open message and is audited.",
    {
      auth: true,
      body: object(
        {
          message: string("Support request", {
            minLength: 10,
            maxLength: 2000,
          }),
        },
        ["message"],
        {
          example: {
            message: "Please review whether I can change my departure date.",
          },
        },
      ),
      response: object({ success: bool("Saved") }),
    },
  );
  add(
    "GET",
    "/updates",
    "Read travel notification inbox",
    "Updates",
    "20 newest owner OTA notifications, nextOffset and total unreadCount. No other customer’s/admin updates are returned.",
    {
      auth: true,
      parameters: [offset],
      response: object({
        updates: array(ref("TravelUpdate")),
        nextOffset: nullable(integer("Next offset")),
        unreadCount: integer("All owner OTA unread notifications"),
      }),
    },
  );
  add(
    "POST",
    "/updates/{id}/read",
    "Mark one travel update read",
    "Updates",
    "URL-encode the whole opaque ota: notification ID. Owner-only; an unknown/unowned/non-OTA ID cannot be marked read.",
    {
      auth: true,
      body: empty,
      response: object({ success: bool("Read") }),
      idempotency: "Safe to repeat for the same owned update.",
    },
  );
  add(
    "POST",
    "/updates/read-all",
    "Mark all customer travel updates read",
    "Updates",
    "Only OTA notifications of the authenticated owner are changed.",
    {
      auth: true,
      body: empty,
      response: object({ success: bool("Read") }),
      idempotency: "Safe to repeat.",
    },
  );
  return {
    openapi: "3.0.3",
    info: {
      title: "Raudah OTA Mobile API",
      version: "1.0.1",
      description:
        "Customer-only OTA contract shared by web and native apps. Examples are illustrative, not real inventory or payment proof. Administrative endpoints and provider webhooks are deliberately not part of this customer v1 surface.",
    },
    servers: [
      {
        url: `${origin}/api/ota/v1`,
        description:
          "Current deployment; use a separate staging host for sandbox purchases",
      },
    ],
    tags: [
      "Discovery",
      "Identity",
      "Flights",
      "Hotels",
      "Checkout",
      "Trips",
      "Updates",
    ].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        CustomerSession: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "Clerk session JWT",
          description:
            "Use a current SDK customer session token. Never a Clerk/Duffel/Paystack secret.",
        },
        SearchKey: {
          type: "apiKey",
          in: "header",
          name: "X-OTA-API-Key",
          description:
            "Optional trusted-server search key. Not for mobile embedding or customer/admin authorization.",
        },
      },
      schemas,
    },
    "x-guides": mobileGuides,
    "x-key-scopes": ["config:read", "flights:read", "hotels:read"],
    "x-legacy-base": `${origin}/api/ota`,
    "x-admin-operations": [
      {
        method: "GET",
        path: "/api/ota/admin/developer/openapi",
        summary: "Download this OpenAPI contract",
      },
      {
        method: "GET",
        path: "/api/ota/admin/developer/guide",
        summary: "Download integration guide",
      },
      {
        method: "GET",
        path: "/api/ota/admin/developer/keys",
        summary: "List redacted search keys and storage readiness",
      },
      {
        method: "POST",
        path: "/api/ota/admin/developer/keys",
        summary: "Create a key; raw secret returned once",
        body: {
          name: "Staging search server",
          mode: "test",
          scopes: ["config:read", "flights:read"],
          expiresInDays: 90,
          requestsPerMinute: 30,
        },
      },
      {
        method: "POST",
        path: "/api/ota/admin/developer/keys/{id}/revoke",
        summary: "Revoke a search key immediately",
      },
    ],
  };
}

export function mobileIntegrationGuide() {
  const spec = otaOpenApi();
  const sections = mobileGuides
    .map(
      (guide) =>
        `## ${guide.title}\n\n${guide.body}\n\n${guide.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}\n${"links" in guide ? guide.links?.map((link) => `\n[${link.label}](${link.url})`).join("\n") : ""}`,
    )
    .join("\n\n");
  const operations = Object.entries(spec.paths)
    .flatMap(([path, methods]) =>
      Object.entries(methods as Schema).map(
        ([method, operation]: [string, any]) =>
          `### ${method.toUpperCase()} ${path}\n\n${operation.summary}. ${operation.description}\n\nAuthentication: ${operation.security.some((item: any) => "CustomerSession" in item) ? "Customer Clerk session JWT" : "Public; optional scoped server search key"}.\n\nRetry policy: ${operation["x-idempotency"]}\n${operation.parameters.length ? "\nParameters:\n" + operation.parameters.map((p: any) => `- ${p.name} (${p.in}${p.required ? ", required" : ""}): ${p.description || p.schema.type}`).join("\n") : ""}\n${operation.requestBody ? "\nRequest schema:\n\n```json\n" + JSON.stringify(operation.requestBody.content["application/json"].schema, null, 2) + "\n```\n" : ""}`,
      ),
    )
    .join("\n\n");
  const responses = Object.entries(spec.paths)
    .flatMap(([path, methods]) =>
      Object.entries(methods as Schema).map(
        ([method, operation]: [string, any]) =>
          `### ${method.toUpperCase()} ${path}\n\n${Object.entries(
            operation.responses,
          )
            .filter(([status]) => Number(status) < 300)
            .map(
              ([status, response]: [string, any]) =>
                `#### HTTP ${status}\n\n${response.description}\n\n\`\`\`json\n${JSON.stringify(response.content?.["application/json"] || {}, null, 2)}\n\`\`\``,
            )
            .join("\n\n")}`,
      ),
    )
    .join("\n\n");
  return `# FlyRaudah OTA Mobile API\n\nContract version: ${spec.info.version}. Base URL: ${spec.servers[0].url}.\n\n${sections}\n\n${nativeQuickstart(spec.servers[0].url)}\n\n## Endpoint reference\n\n${operations}\n\n## Complete schemas\n\nDownload docs/ota-openapi.json or the super-admin Developer Centre export for all nested schemas, examples and responses.\n\n${Object.entries(
    spec.components.schemas,
  )
    .map(
      ([name, schema]) =>
        `### ${name}\n\n\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\``,
    )
    .join(
      "\n\n",
    )}\n\n## Response contracts\n\n${responses}\n\n## Common error responses\n\nAll errors use the Error schema and return JSON. HTTP 405 includes Allow; HTTP 429 includes Retry-After in seconds.\n\n${Object.entries(
    errorResponses,
  )
    .map(
      ([status, response]: [string, any]) =>
        `- HTTP ${status}: ${response.description}`,
    )
    .join("\n")}\n`;
}
function nativeQuickstart(base: string) {
  return `## Native client quickstart

Configure Clerk with the same application instance as the web app. Use its publishable key, never a backend secret.

\`\`\`tsx
import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';

<ClerkProvider
  publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY}
  tokenCache={tokenCache}
>
  <YourApplication />
</ClerkProvider>
\`\`\`

Obtain getToken from useAuth() inside your signed-in component/hook. This helper performs no automatic checkout/payment retry.

\`\`\`js
const API = '${base}';
async function otaRequest(path, body) {
  const token = await getToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), path.endsWith('/complete') ? 180000 : 65000);
  try {
    const response = await fetch(API + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(token ? {Authorization: 'Bearer ' + token} : {}),
        ...(body === undefined ? {} : {'Content-Type': 'application/json'}) },
      signal: controller.signal,
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error),
      {status: response.status, fields: data.fields, retryAfter: response.headers.get('Retry-After')});
    return data;
  } finally { clearTimeout(timer); }
}
await otaRequest('/me/bootstrap', {});
const {bookings} = await otaRequest('/bookings');
// On payment return/app resume, recover the retained booking ID.
const {booking} = await otaRequest('/bookings/' + savedBookingId);
\`\`\`

Public search:

\`\`\`bash
curl '${base}/places?q=Lagos'
\`\`\`

Customer request (SDK session token in CUSTOMER_SESSION):

\`\`\`bash
curl '${base}/bookings' -H "Authorization: Bearer $CUSTOMER_SESSION"
\`\`\`

Trusted server search (never from a native app):

\`\`\`bash
curl '${base}/config' -H "X-OTA-API-Key: $RAUDAH_SEARCH_KEY"
\`\`\`
`;
}
