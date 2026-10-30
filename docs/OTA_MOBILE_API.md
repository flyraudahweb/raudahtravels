# Raudah OTA Mobile API

Contract version: 1.0.0. Base URL: https://flyraudah.com.ng/api/ota/v1.

## Build the Raudah mobile experience

Use one backend for the web and mobile apps. OTA v1 covers flight and prepaid hotel discovery, authenticated checkout, hosted payment, saved trips and travel updates. Public inventory is not a guarantee of a reservation. Fetch capabilities before exposing checkout or Stays. All examples are illustrative: use current supplier IDs, prices and availability from actual responses.

1. Discover enabled products with GET /capabilities and GET /config.
2. Let the traveller search, inspect an offer or hotel quote, and review all conditions.
3. Use the same Clerk account as the web app; bootstrap an active travel profile after sign-in.
4. Create a saved checkout, retain its booking ID, open the hosted payment URL, then verify the server booking status.
5. Build My Trips and the update inbox from owner-authenticated endpoints.


## Customer authentication & account setup

Use the same Clerk instance as the web app. A native client obtains a current session JWT from the Clerk SDK and sends Authorization: Bearer <session_token>. No user ID, role or email supplied in a request is accepted as proof of identity. Call POST /me/bootstrap after sign-in for a new mobile account: the server reads verified email/name from Clerk, creates only a user profile, and does not reactivate blocked accounts. GET /me returns the active profile. Session JWTs are short-lived; ask the SDK for a token for each request and refresh authentication after a 401. Native HTTP requests normally send no Origin header. Browser/WebView origins must be allowlisted; do not forge an Origin header to bypass browser policy.

1. Install the current supported @clerk/expo SDK and expo-secure-store for an Expo app; use the SDK’s documented token cache.
2. Configure EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY with the publishable key of the same Clerk instance. Configure native sign-in providers, redirect schemes and the application IDs in Clerk.
3. Never ship CLERK_SECRET_KEY, Duffel tokens, Paystack secret keys or a privileged operator session in a mobile build.
4. After SDK sign-in, POST /me/bootstrap with the session Bearer token; a verified primary email is required for a new profile.
5. Do not persist passport/contact payloads in analytics, logs, crash breadcrumbs or unencrypted local storage.

[Clerk Expo session access](https://clerk.com/docs/expo/guides/users/reading)

[Express bearer/cookie authentication](https://clerk.com/docs/reference/express/clerk-middleware)

[Expo authentication setup](https://docs.expo.dev/guides/using-clerk/)

## API key setup, scopes & rotation

First-party mobile apps use public search plus customer session JWTs; they do not need an embedded secret API key. Optional search integration keys are for your trusted server/BFF. Super admins create them in this Developer Centre, select test/live mode, allowed public-read scopes, a 1–365 day expiry and a 10–60 request/minute limit. A raw key is shown once; only its SHA-256 digest is stored. Send it in X-OTA-API-Key from your server. It never authorizes customers, hotel quotes, bookings, payments, administration or provider callbacks—even when a customer token is also sent. Do not put it in a mobile bundle, web client, URL, repository or analytics.

1. Apply migration 0012_ota_api_keys.sql before using key management. Existing web/customer APIs and docs do not require keys or this table.
2. Create a test key with only the scopes your server needs: config:read, flights:read and/or hotels:read.
3. Keep the secret in your server’s secret manager and send it only to your Raudah API over HTTPS.
4. Key mode must match the selected OTA mode. A live key does not enable live sales or replace provider setup.
5. Rotate by creating a replacement, updating the trusted service, verifying a read request and revoking the old key. Revocation/expiry are checked on every request.
6. Per-key limits use a shared database counter. Public per-process account/IP limits and edge limits still apply; provision shared edge throttling for multi-instance production.


## Flight search → offer → checkout

Use GET /places for city/airport suggestions and select the returned IATA code. POST /flights/search supports one-way or return trips, economy/premium economy/business/first, adults and children aged 2–11. At most nine passengers total. Results include supplier offer/passenger IDs, itinerary, expiry, conditions and server-priced pricing.totalKobo. Re-fetch GET /flights/offers/{id} before checkout. Map each traveller to that offer’s passenger ID; birth date must match the searched age at departure. Provide passport data when passenger_identity_documents_required is true. A passport supplied optionally is still validated through the last itinerary date. Entry/visa/extra passport-validity requirements are not determined by this API.

1. POST /flights/search with origin, destination, departureDate, optional returnDate, adults, childAges and cabinClass.
2. Render both slices for a return offer; never present its bundled price as one leg’s separate fare. Filter stops using connections plus technical stops.
3. GET /flights/offers/{id}; display pricing.totalKobo, expiry, baggage and cancellation/change conditions.
4. POST /bookings with kind=flight, current offerId, acceptedTerms=true, contact, one matching traveller per passenger, and expectedTotalKobo from the last response.
5. A 409 price change requires fresh presentation and explicit traveller confirmation. A saved checkout is not yet a paid or supplier-confirmed booking.


## Prepaid Stays → room → final quote

Duffel Stays access must be enabled for the organisation. POST /hotels/search uses geographic coordinates, a 10km search radius, 1–99 nights, check-in within 330 days, 1–8 rooms and at least one adult per room. Adults max 16 and children max 8, ages 0–17. POST /hotels/rates/{searchResultId} returns supported prepaid balance rates only. Card guarantees, deposits, loyalty-required and property-payable room rates are excluded; separately payable property extras may still be returned and must be shown. Creating and retrieving a final quote require a signed-in active customer. Quote availability and final room conditions control checkout.

1. Search by latitude/longitude and dates; return property pictures, location and star rating as supplied.
2. Fetch all supported rates for an srr_ search result and display board type, cancellation timeline and property extras.
3. POST /hotels/quotes with the selected rat_ rateId and a customer Bearer token; retain the returned quo_ ID.
4. GET /hotels/quotes/{id} immediately before checkout and collect one guest record per quote guest.
5. POST /bookings with kind=hotel and the final quote ID as offerId. Payment and confirmation then use the same saved-booking workflow as flights.


## Hosted payment & reliable app return

POST /bookings/{id}/pay returns a validated HTTPS Paystack checkout URL tied to that saved booking. Open it in the platform browser or supported secure browser session. The backend currently sets the return URL to the web booking page /travel/bookings/{id}; arbitrary callback URLs or app schemes are not accepted. On app resume, retrieve the saved booking and call POST /complete when appropriate; a payment return URL, app callback or client success flag never proves payment. The server verifies amount, NGN, reference, metadata and test/live mode before claiming supplier fulfillment. It never accepts a browser-supplied paid amount/status as evidence.

1. Save booking.id/reference on the device before opening the payment browser. Fetch the latest customer JWT again when returning.
2. Use an external browser/auth session, not a WebView that intercepts payment credentials. Follow the payment provider’s supported browser flow.
3. On app resume, GET /bookings/{id}; if payment_pending, POST /bookings/{id}/complete initiates canonical verification and returns the saved booking state.
4. Display confirmed only when the backend says confirmed. Supplier confirmation and later ticket-document availability are separate facts.
5. Use Universal Links/App Links only after configuring real bundle/package IDs, signing certificates and the domain association files. Those mobile-domain files are not supplied automatically by this API.
6. Sandbox Duffel and Paystack test modes must match. Never switch a working live payment account to test just to test this app; use staging with matching credentials.


## Idempotency, retries & ambiguous outcomes

POST /bookings currently does not support an Idempotency-Key header. If its response is lost, retrieve booking history and recover the matching saved checkout before creating another. Prevent double taps and retain the returned booking ID. Payment initialization uses one stable reference per booking. Repeating /complete returns/reconciles the existing checkout claim; it cannot authorize blind re-purchase. If the supplier outcome is ambiguous, the backend keeps requires_review and the operator must reconcile it. A general network error never proves a reservation or payment failed.

1. GET requests can be retried with bounded exponential backoff and jitter; obey 429 Retry-After.
2. Do not automatically retry checkout creation, quote creation or payment initialization after a timeout without checking saved state.
3. Give /complete a sufficiently long client timeout (for example 180 seconds) because supplier creation can take more than two minutes. If the client times out, recover by GET; do not purchase again.
4. Poll a processing booking approximately every 5 seconds while visible; poll settled records/updates approximately every 30 seconds. Stop background polling when the app is inactive.
5. Compare booking.revision, not client completion order, before replacing a screen snapshot. Ignore lower revisions for the same booking ID.
6. A cancellation is not a refund. Only refunded means the backend has recorded a verified full customer refund; bank settlement timing is separate.


## My Trips, documents & travel updates

Booking endpoints always derive ownership from the verified session. GET /bookings returns 50 rows, nextOffset and all-owner summary counts. GET /bookings/{id}/timeline returns up to 100 customer-safe lifecycle events; the raw admin audit is not available. GET /updates returns 20 OTA-only notifications, nextOffset and an all-owner unreadCount. Mark an update read through /updates/{id}/read, URL-encoding the whole notification ID; read-all affects only the signed-in customer’s OTA updates. Retrieve providerResult.documents when supplied for ticket identifiers/documents. Do not invent e-ticket numbers or promise a PDF URL when none is returned.

1. Persist only the booking ID/reference needed for recovery; re-fetch sensitive details from the authenticated API.
2. GET /bookings/{id}/refresh performs a supplier read, not a repeat purchase. Use sparingly because it consumes provider capacity.
3. Show providerNotice and the customer-safe issue message; booking timelines may contain customer support replies.
4. POST /bookings/{id}/service-request saves a 10–2000 character request for support. It does not itself cancel, change or refund a reservation.
5. My Trips on the web remains at /dashboard/my-trips and a booking web page is /travel/bookings/{id}. No dedicated native PDF-export or push-token registration endpoint is implemented.


## Booking state machine & amounts

payment_pending: checkout saved, payment not verified. processing: payment verified and supplier outcome in progress; do not collect payment again. confirmed: supplier reservation confirmed; documents may arrive later. requires_review: payment/reservation ambiguity requiring support; suppress pay-again actions. cancelled: supplier cancellation confirmed/observed; do not imply a refund. refunded: full customer refund verified and recorded by an operator. Revision increases on material state changes. amountKobo and pricing.totalKobo are integer NGN minor units (100 kobo = ₦1); supplier amounts remain decimal strings in supplier currency. Admin selling rates/markups and saved checkout totals are not overwritten by the comparison-rate feed.

1. Render amounts with the NGN currency and divide kobo by 100 only for display.
2. Search/quote pricing is advisory until refreshed and accepted; keep the saved checkout’s original total after payment.
3. Display provider timestamps in each airport/property’s local timezone; date-only travel dates are YYYY-MM-DD and should not shift through UTC conversion.
4. Call /capabilities to hide disabled features and distinguish test from live. Test reservations are visibly labelled throughout the app.


## Provider events & mobile notifications

Paystack delivers signed events to the existing /api/payments/paystack/webhook (or the OTA-only /api/ota/payments/webhook). Duffel events use /api/ota/duffel/webhook/test or /live. These are provider-to-server endpoints; do not call them from the mobile app, install provider secrets in the app or point provider webhooks at device URLs. The server verifies signatures, stores event work durably, reconciles reservations and publishes customer updates. The mobile app consumes /updates, /timeline and current booking snapshots. Native push notifications, partner event subscriptions and an SSE/WebSocket API are not implemented.

1. Keep the API worker continuously running for payment jobs, supplier events, refreshes and update publication.
2. Activate Duffel receivers only after migrations, deployed configuration and a valid signed Ping are verified.
3. Monitor requires-review bookings, exhausted events and payment-vs-reservation reconciliation in the super-admin OTA console.


## Supported scope & launch checklist

This is the implemented Raudah OTA API, not a claim of Trip.com feature parity. Supported: one-way/return flights, adult/child travel, prepaid hotel inventory, owner checkout/history, hosted payment, supplier updates and support requests. Not exposed: multi-city, infants, ancillary/seat sales, held orders, self-service exchanges/cancellations, arbitrary payment callbacks, partial-refund APIs, native push subscriptions or partner booking-on-behalf APIs. Direct unsupported requests to support. Do not represent these as completed features in a mobile UI.

1. Deploy API and web code together; apply the required OTA migrations and 0012 for optional search keys.
2. Use the same Clerk instance and verify new-account bootstrap plus blocked-account rejection.
3. Confirm provider products/access, modes, selling rates, support contacts, HTTPS origin and funded supplier balance.
4. Test success, pending/failed payment, lost browser return, repeated callbacks, app kill/resume, changed/expired price, duplicate taps and interrupted supplier responses in staging.
5. Verify ownership isolation, API key scope/revocation/expiry/rate limits, update read ownership, document access and support responses.
6. Add shared edge throttling, monitoring, secret rotation, operational reconciliation and privacy-safe mobile crash/analytics handling before enabling live sales.


## Native client quickstart

Configure Clerk with the same application instance as the web app. Use its publishable key, never a backend secret.

```tsx
import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';

<ClerkProvider
  publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY}
  tokenCache={tokenCache}
>
  <YourApplication />
</ClerkProvider>
```

Obtain getToken from useAuth() inside your signed-in component/hook. This helper performs no automatic checkout/payment retry.

```js
const API = 'https://flyraudah.com.ng/api/ota/v1';
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
```

Public search:

```bash
curl 'https://flyraudah.com.ng/api/ota/v1/places?q=Lagos'
```

Customer request (SDK session token in CUSTOMER_SESSION):

```bash
curl 'https://flyraudah.com.ng/api/ota/v1/bookings' -H "Authorization: Bearer $CUSTOMER_SESSION"
```

Trusted server search (never from a native app):

```bash
curl 'https://flyraudah.com.ng/api/ota/v1/config' -H "X-OTA-API-Key: $RAUDAH_SEARCH_KEY"
```


## Endpoint reference

### GET /config

Read channel availability. Public feature switches, mode and support contacts. Hide disabled checkout and Stays actions.

Authentication: Public; optional scoped server search key.

Retry policy: Read-only; bounded retry with backoff.



### GET /capabilities

Discover mobile features & limits. Implemented features, active switches, limits and suggested foreground polling intervals. No supplier credentials are exposed.

Authentication: Public; optional scoped server search key.

Retry policy: Read-only; bounded retry with backoff.



### GET /exchange-rates

Read selling & reference FX. sellingRates are operator-controlled NGN-per-unit selling rates. The separate reference object is a dated comparison feed and may be stale/unavailable; it never changes checkout prices.

Authentication: Public; optional scoped server search key.

Retry policy: Read-only; bounded retry with backoff.



### GET /me

Read active travel profile. Customer session required; 403 if profile is absent/inactive. Use bootstrap for a new account.

Authentication: Customer Clerk session JWT.

Retry policy: Read-only; bounded retry with backoff.



### POST /me/bootstrap

Create/reuse the signed-in profile. Idempotently links the verified Clerk session to a user profile. A new account requires a verified primary Clerk email. Identity/role fields from the request body are ignored; blocked accounts remain blocked.

Authentication: Customer Clerk session JWT.

Retry policy: Safe to repeat; a unique Clerk user ID prevents duplicate profiles.


Request schema:

```json
{
  "type": "object",
  "properties": {}
}
```


### GET /places

Find cities & airports. Select an IATA code from returned places. A city result may represent all its airports. No customer login required.

Authentication: Public; optional scoped server search key.

Retry policy: Read-only; bounded retry with backoff.

Parameters:
- q (query, required): string


### POST /flights/search

Search one-way / return flights. Adults plus children cannot exceed 9. Returns up to 80 currently available offers, priced and sorted by totalKobo. Empty offers is a valid no-inventory response.

Authentication: Public; optional scoped server search key.

Retry policy: Search only; repeat explicitly as needed. Supplier IDs/availability may change.


Request schema:

```json
{
  "type": "object",
  "properties": {
    "origin": {
      "type": "string",
      "description": "Uppercase origin IATA",
      "pattern": "^[A-Z]{3}$"
    },
    "destination": {
      "type": "string",
      "description": "Different uppercase destination IATA",
      "pattern": "^[A-Z]{3}$"
    },
    "departureDate": {
      "type": "string",
      "description": "Today or future",
      "format": "date"
    },
    "returnDate": {
      "type": "string",
      "description": "Optional; same day or after departure",
      "format": "date"
    },
    "adults": {
      "type": "integer",
      "description": "Adult passengers, ages 12+",
      "minimum": 1,
      "maximum": 9
    },
    "childAges": {
      "type": "array",
      "items": {
        "type": "integer",
        "description": "Child age at departure",
        "minimum": 2,
        "maximum": 11
      },
      "maxItems": 8,
      "default": []
    },
    "cabinClass": {
      "type": "string",
      "description": "Cabin",
      "enum": [
        "economy",
        "premium_economy",
        "business",
        "first"
      ],
      "default": "economy"
    }
  },
  "required": [
    "origin",
    "destination",
    "departureDate",
    "adults"
  ],
  "example": {
    "origin": "LOS",
    "destination": "JED",
    "departureDate": "2026-12-14",
    "returnDate": "2026-12-21",
    "adults": 1,
    "childAges": [],
    "cabinClass": "economy"
  }
}
```


### GET /flights/offers/{id}

Refresh an offer before checkout. Use a current off_ ID. Revalidates availability/expiry and returns server selling price. Keep passenger IDs and conditions from this refreshed offer.

Authentication: Public; optional scoped server search key.

Retry policy: Read-only; bounded retry with backoff.

Parameters:
- id (path, required): Use the current identifier returned by the API; URL-encode it.


### POST /hotels/search

Search prepaid Stays. Requires enabled Duffel Stays product. Uses a 10km radius and only supported instant/prepaid inventory; supplier access errors do not imply no hotels exist.

Authentication: Public; optional scoped server search key.

Retry policy: Do not automatically retry after an ambiguous timeout; recover state first.


Request schema:

```json
{
  "type": "object",
  "properties": {
    "latitude": {
      "type": "number",
      "minimum": -90,
      "maximum": 90
    },
    "longitude": {
      "type": "number",
      "minimum": -180,
      "maximum": 180
    },
    "checkIn": {
      "type": "string",
      "description": "Current/future and within 330 days",
      "format": "date"
    },
    "checkOut": {
      "type": "string",
      "description": "1–99 nights after check-in",
      "format": "date"
    },
    "rooms": {
      "type": "integer",
      "description": "At least one adult per room",
      "minimum": 1,
      "maximum": 8
    },
    "adults": {
      "type": "integer",
      "description": "Adult guests",
      "minimum": 1,
      "maximum": 16
    },
    "childAges": {
      "type": "array",
      "items": {
        "type": "integer",
        "description": "Child age at check-in",
        "minimum": 0,
        "maximum": 17
      },
      "maxItems": 8,
      "default": []
    }
  },
  "required": [
    "latitude",
    "longitude",
    "checkIn",
    "checkOut",
    "rooms",
    "adults"
  ],
  "example": {
    "latitude": 21.4225,
    "longitude": 39.8262,
    "checkIn": "2026-12-14",
    "checkOut": "2026-12-21",
    "rooms": 1,
    "adults": 1,
    "childAges": []
  }
}
```


### POST /hotels/rates/{id}

Retrieve all supported room rates. Use an srr_ search result ID. Returns accommodation.rooms[].rates[] after supported-prepaid filtering; an empty rate list is valid.

Authentication: Public; optional scoped server search key.

Retry policy: Do not automatically retry after an ambiguous timeout; recover state first.

Parameters:
- id (path, required): Use the current identifier returned by the API; URL-encode it.

Request schema:

```json
{
  "type": "object",
  "properties": {}
}
```


### POST /hotels/quotes

Create final room quote. Signed-in customer only; search integration keys cannot access this endpoint. Quote creation does not reserve a room.

Authentication: Customer Clerk session JWT.

Retry policy: Do not automatically retry after an ambiguous timeout; recover state first.


Request schema:

```json
{
  "type": "object",
  "properties": {
    "rateId": {
      "type": "string",
      "description": "Current rat_ room rate ID"
    }
  },
  "required": [
    "rateId"
  ],
  "example": {
    "rateId": "rat_example123"
  }
}
```


### GET /hotels/quotes/{id}

Refresh the final hotel quote. Signed-in customer only. Use the quo_ ID from quote creation. Rechecks supported payment/guest rules and availability.

Authentication: Customer Clerk session JWT.

Retry policy: Read-only; bounded retry with backoff.

Parameters:
- id (path, required): Use the current identifier returned by the API; URL-encode it.


### POST /bookings

Save a customer checkout. Sales/product switches, modes and HTTPS callback must be configured. Fresh offer/quote, exact expectedTotalKobo and every traveller are revalidated. No supplier purchase occurs yet. Request has no Idempotency-Key support; recover history after a lost response.

Authentication: Customer Clerk session JWT.

Retry policy: Do not automatically retry after an ambiguous timeout; recover state first.


Request schema:

```json
{
  "$ref": "#/components/schemas/BookingCreate"
}
```


### GET /bookings

List the customer’s saved trips. Returns 50 newest owner records per page. Summary counts cover all the owner’s records, not only the page; pending excludes expired checkouts.

Authentication: Customer Clerk session JWT.

Retry policy: Read-only; bounded retry with backoff.

Parameters:
- offset (query): Use the previous nextOffset. Records are newest first; deduplicate IDs when new records arrive.


### POST /bookings/{id}/pay

Open hosted Paystack payment. Returns a validated Paystack HTTPS authorizationUrl using the booking’s stable reference. Callback is the configured web booking page; client-supplied callback URLs are not supported. A previously prepared redirect can be reused while the checkout is payable.

Authentication: Customer Clerk session JWT.

Retry policy: Stable provider reference per booking; concurrent state changes may return 409. Refresh saved state first.

Parameters:
- id (path, required): Use the current identifier returned by the API; URL-encode it.

Request schema:

```json
{
  "type": "object",
  "properties": {}
}
```


### POST /bookings/{id}/complete

Verify payment & claim fulfillment. Does not accept paid/status flags or amounts. Server verifies canonical Paystack proof and claims supplier creation once. May take over two minutes. Returns confirmed/review/processing/etc from the saved checkout. A repeated call cannot force automatic supplier repurchase.

Authentication: Customer Clerk session JWT.

Retry policy: Repeat against the same saved booking after inspecting state; payment/supplier claims are protected against duplicate fulfillment.

Parameters:
- id (path, required): Use the current identifier returned by the API; URL-encode it.

Request schema:

```json
{
  "type": "object",
  "properties": {}
}
```


### GET /bookings/{id}

Recover the saved booking. The authenticated owner only. Someone else’s ID returns 404. Compare revision before replacing the current mobile snapshot.

Authentication: Customer Clerk session JWT.

Retry policy: Read-only; bounded retry with backoff.

Parameters:
- id (path, required): Use the current identifier returned by the API; URL-encode it.


### POST /bookings/{id}/refresh

Read latest supplier status. Owner only. Performs a read-only supplier refresh for a linked reservation; never creates or repeats a reservation. Do not poll this supplier action aggressively.

Authentication: Customer Clerk session JWT.

Retry policy: Supplier read/reconciliation only; material revisions may advance.

Parameters:
- id (path, required): Use the current identifier returned by the API; URL-encode it.

Request schema:

```json
{
  "type": "object",
  "properties": {}
}
```


### GET /bookings/{id}/timeline

Read customer lifecycle timeline. Up to 100 newest customer-safe lifecycle entries; raw audit details are private. Unknown/internal audit actions are not exposed.

Authentication: Customer Clerk session JWT.

Retry policy: Read-only; bounded retry with backoff.

Parameters:
- id (path, required): Use the current identifier returned by the API; URL-encode it.


### POST /bookings/{id}/service-request

Ask support for a change/refund review. Saves a customer request; it does not itself cancel, exchange or refund anything. A later request replaces the current open message and is audited.

Authentication: Customer Clerk session JWT.

Retry policy: Do not automatically retry after an ambiguous timeout; recover state first.

Parameters:
- id (path, required): Use the current identifier returned by the API; URL-encode it.

Request schema:

```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "description": "Support request",
      "minLength": 10,
      "maxLength": 2000
    }
  },
  "required": [
    "message"
  ],
  "example": {
    "message": "Please review whether I can change my departure date."
  }
}
```


### GET /updates

Read travel notification inbox. 20 newest owner OTA notifications, nextOffset and total unreadCount. No other customer’s/admin updates are returned.

Authentication: Customer Clerk session JWT.

Retry policy: Read-only; bounded retry with backoff.

Parameters:
- offset (query): Use the previous nextOffset. Records are newest first; deduplicate IDs when new records arrive.


### POST /updates/{id}/read

Mark one travel update read. URL-encode the whole opaque ota: notification ID. Owner-only; an unknown/unowned/non-OTA ID cannot be marked read.

Authentication: Customer Clerk session JWT.

Retry policy: Safe to repeat for the same owned update.

Parameters:
- id (path, required): Use the current identifier returned by the API; URL-encode it.

Request schema:

```json
{
  "type": "object",
  "properties": {}
}
```


### POST /updates/read-all

Mark all customer travel updates read. Only OTA notifications of the authenticated owner are changed.

Authentication: Customer Clerk session JWT.

Retry policy: Safe to repeat.


Request schema:

```json
{
  "type": "object",
  "properties": {}
}
```


## Complete schemas

Download docs/ota-openapi.json or the super-admin Developer Centre export for all nested schemas, examples and responses.

### Error

```json
{
  "type": "object",
  "properties": {
    "error": {
      "type": "string",
      "description": "Human-readable safe error message"
    },
    "fields": {
      "type": "array",
      "items": {
        "type": "string",
        "description": "Invalid request field path"
      }
    }
  },
  "required": [
    "error"
  ]
}
```

### Pricing

```json
{
  "type": "object",
  "properties": {
    "supplierKobo": {
      "type": "integer",
      "description": "Converted supplier price in kobo",
      "minimum": 0
    },
    "markupKobo": {
      "type": "integer",
      "description": "Configured markup in kobo",
      "minimum": 0
    },
    "feeKobo": {
      "type": "integer",
      "description": "Configured service fee in kobo",
      "minimum": 0
    },
    "totalKobo": {
      "type": "integer",
      "description": "Total integer NGN price to show and submit as expectedTotalKobo",
      "minimum": 1
    },
    "currency": {
      "type": "string",
      "description": "Selling currency",
      "enum": [
        "NGN"
      ]
    },
    "rate": {
      "type": "number",
      "description": "Configured NGN per supplier-currency unit"
    },
    "supplierCurrency": {
      "type": "string",
      "description": "Supplier ISO currency"
    },
    "supplierAmount": {
      "type": "string",
      "description": "Supplier decimal amount; preserve as a string"
    }
  },
  "required": [
    "totalKobo",
    "currency",
    "supplierCurrency",
    "supplierAmount"
  ],
  "example": {
    "supplierKobo": 13447900,
    "markupKobo": 0,
    "feeKobo": 0,
    "totalKobo": 13447900,
    "currency": "NGN",
    "rate": 1344.79,
    "supplierCurrency": "USD",
    "supplierAmount": "100.00"
  }
}
```

### Profile

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Internal profile ID"
    },
    "email": {
      "type": "string",
      "description": "Verified account email",
      "format": "email"
    },
    "fullName": {
      "type": "string",
      "description": "Account display name"
    },
    "phone": {
      "type": "string",
      "description": "Account contact phone",
      "nullable": true
    },
    "role": {
      "type": "string",
      "description": "Existing account role; never accepted from a mobile client"
    }
  },
  "required": [
    "id",
    "email",
    "fullName",
    "role"
  ]
}
```

### ProfileResponse

```json
{
  "type": "object",
  "properties": {
    "profile": {
      "$ref": "#/components/schemas/Profile"
    }
  },
  "required": [
    "profile"
  ]
}
```

### Contact

```json
{
  "type": "object",
  "properties": {
    "email": {
      "type": "string",
      "description": "Booking email",
      "format": "email",
      "maxLength": 254
    },
    "phone": {
      "type": "string",
      "description": "E.164 contact number",
      "pattern": "^\\+[1-9]\\d{6,14}$"
    },
    "specialRequests": {
      "type": "string",
      "description": "Optional hotel accommodation request",
      "maxLength": 1000
    }
  },
  "required": [
    "email",
    "phone"
  ]
}
```

### Guest

```json
{
  "type": "object",
  "properties": {
    "given_name": {
      "type": "string",
      "description": "Given name",
      "minLength": 1,
      "maxLength": 100
    },
    "family_name": {
      "type": "string",
      "description": "Family name",
      "minLength": 1,
      "maxLength": 100
    },
    "born_on": {
      "type": "string",
      "description": "Optional date of birth for hotel guests",
      "format": "date"
    }
  },
  "required": [
    "given_name",
    "family_name"
  ]
}
```

### Passport

```json
{
  "type": "object",
  "properties": {
    "type": {
      "type": "string",
      "description": "Document type",
      "enum": [
        "passport"
      ]
    },
    "unique_identifier": {
      "type": "string",
      "description": "Passport number",
      "minLength": 4,
      "maxLength": 30
    },
    "expires_on": {
      "type": "string",
      "description": "Expiry must be current/future and valid through the final itinerary date",
      "format": "date"
    },
    "issuing_country_code": {
      "type": "string",
      "description": "Two-letter uppercase country code",
      "pattern": "^[A-Z]{2}$"
    }
  },
  "required": [
    "type",
    "unique_identifier",
    "expires_on",
    "issuing_country_code"
  ]
}
```

### FlightTraveller

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Exactly one matching pas_ ID from the selected offer"
    },
    "given_name": {
      "type": "string",
      "description": "Given name",
      "minLength": 1,
      "maxLength": 100
    },
    "family_name": {
      "type": "string",
      "description": "Family name",
      "minLength": 1,
      "maxLength": 100
    },
    "born_on": {
      "type": "string",
      "description": "Must match the searched passenger type/age at departure",
      "format": "date"
    },
    "title": {
      "type": "string",
      "description": "Passenger title",
      "enum": [
        "mr",
        "ms",
        "mrs",
        "miss",
        "dr"
      ]
    },
    "gender": {
      "type": "string",
      "description": "Provider gender code",
      "enum": [
        "m",
        "f"
      ]
    },
    "email": {
      "type": "string",
      "description": "Passenger email",
      "format": "email"
    },
    "phone_number": {
      "type": "string",
      "description": "E.164 phone",
      "pattern": "^\\+[1-9]\\d{6,14}$"
    },
    "identity_documents": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/Passport"
      },
      "maxItems": 1,
      "description": "Required when the offer requires passenger identity documents"
    }
  },
  "required": [
    "id",
    "given_name",
    "family_name",
    "born_on",
    "title",
    "gender",
    "email",
    "phone_number"
  ],
  "example": {
    "id": "pas_example123",
    "given_name": "Example",
    "family_name": "Traveller",
    "born_on": "1990-01-01",
    "title": "mr",
    "gender": "m",
    "email": "traveller@example.com",
    "phone_number": "+2348012345678"
  }
}
```

### Segment

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Supplier segment ID"
    },
    "departing_at": {
      "type": "string",
      "description": "Local departure timestamp as supplied; preserve timezone information"
    },
    "arriving_at": {
      "type": "string",
      "description": "Local arrival timestamp as supplied"
    },
    "origin": {
      "type": "object",
      "properties": {
        "iata_code": {
          "type": "string",
          "description": "Departure IATA"
        },
        "name": {
          "type": "string",
          "description": "Airport name"
        }
      }
    },
    "destination": {
      "type": "object",
      "properties": {
        "iata_code": {
          "type": "string",
          "description": "Arrival IATA"
        },
        "name": {
          "type": "string",
          "description": "Airport name"
        }
      }
    },
    "origin_terminal": {
      "type": "string",
      "description": "Departure terminal",
      "nullable": true
    },
    "destination_terminal": {
      "type": "string",
      "description": "Arrival terminal",
      "nullable": true
    },
    "marketing_carrier": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "description": "Marketing carrier"
        },
        "iata_code": {
          "type": "string",
          "description": "Carrier code"
        }
      }
    },
    "operating_carrier": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "description": "Operating carrier"
        }
      }
    },
    "marketing_carrier_flight_number": {
      "type": "string",
      "description": "Flight number"
    },
    "stops": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {},
        "additionalProperties": true
      }
    },
    "passengers": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "passenger_id": {
            "type": "string",
            "description": "Passenger ID"
          },
          "cabin_class": {
            "type": "string",
            "description": "Cabin"
          },
          "baggages": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "description": "Baggage type"
                },
                "quantity": {
                  "type": "integer",
                  "description": "Quantity",
                  "minimum": 0
                }
              }
            }
          }
        },
        "additionalProperties": true
      }
    }
  },
  "additionalProperties": true
}
```

### Slice

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Supplier slice ID"
    },
    "origin": {
      "type": "object",
      "properties": {
        "iata_code": {
          "type": "string",
          "description": "Origin IATA"
        },
        "city_name": {
          "type": "string",
          "description": "City",
          "nullable": true
        }
      }
    },
    "destination": {
      "type": "object",
      "properties": {
        "iata_code": {
          "type": "string",
          "description": "Destination IATA"
        },
        "city_name": {
          "type": "string",
          "description": "City",
          "nullable": true
        }
      }
    },
    "duration": {
      "type": "string",
      "description": "ISO 8601 duration, e.g. PT5H30M"
    },
    "segments": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/Segment"
      }
    }
  },
  "additionalProperties": true
}
```

### FlightOffer

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "off_ ID"
    },
    "total_amount": {
      "type": "string",
      "description": "Supplier decimal total"
    },
    "total_currency": {
      "type": "string",
      "description": "Supplier ISO currency"
    },
    "expires_at": {
      "type": "string",
      "description": "Supplier offer expiry",
      "format": "date-time"
    },
    "owner": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "Airline ID"
        },
        "name": {
          "type": "string",
          "description": "Airline name"
        },
        "logo_symbol_url": {
          "type": "string",
          "description": "Supplier logo URL",
          "nullable": true
        }
      }
    },
    "passengers": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "description": "pas_ ID"
          },
          "type": {
            "type": "string",
            "description": "adult or child"
          },
          "age": {
            "type": "integer",
            "description": "Child age when provided",
            "minimum": 0
          }
        }
      }
    },
    "passenger_identity_documents_required": {
      "type": "boolean",
      "description": "Requires passport data in every flight traveller"
    },
    "slices": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/Slice"
      }
    },
    "conditions": {
      "type": "object",
      "properties": {},
      "additionalProperties": true
    },
    "pricing": {
      "$ref": "#/components/schemas/Pricing"
    }
  },
  "required": [
    "id"
  ],
  "additionalProperties": true,
  "example": {
    "id": "off_example123",
    "total_amount": "100.00",
    "total_currency": "USD",
    "expires_at": "2026-10-30T00:46:12.077Z",
    "passengers": [
      {
        "id": "pas_example123",
        "type": "adult"
      }
    ],
    "owner": {
      "id": "arl_example123",
      "name": "Example airline"
    },
    "slices": [
      {
        "origin": {
          "iata_code": "LOS",
          "city_name": "Lagos"
        },
        "destination": {
          "iata_code": "JED",
          "city_name": "Jeddah"
        },
        "duration": "PT5H30M",
        "segments": [
          {
            "departing_at": "2026-12-14T10:00:00",
            "arriving_at": "2026-12-14T17:30:00",
            "origin": {
              "iata_code": "LOS"
            },
            "destination": {
              "iata_code": "JED"
            },
            "passengers": [
              {
                "passenger_id": "pas_example123",
                "cabin_class": "economy",
                "baggages": []
              }
            ]
          }
        ]
      }
    ],
    "pricing": {
      "supplierKobo": 13447900,
      "markupKobo": 0,
      "feeKobo": 0,
      "totalKobo": 13447900,
      "currency": "NGN",
      "rate": 1344.79,
      "supplierCurrency": "USD",
      "supplierAmount": "100.00"
    }
  }
}
```

### HotelResult

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "srr_ search result ID"
    },
    "accommodation": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "description": "Property name"
        },
        "rating": {
          "type": "number",
          "description": "Supplier star rating, not a customer review score"
        },
        "photos": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "url": {
                "type": "string",
                "description": "Property image URL"
              }
            }
          }
        },
        "location": {
          "type": "object",
          "properties": {},
          "additionalProperties": true
        }
      },
      "additionalProperties": true
    },
    "pricing": {
      "$ref": "#/components/schemas/Pricing"
    }
  },
  "required": [
    "id",
    "pricing"
  ],
  "additionalProperties": true
}
```

### HotelRate

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "rat_ rate ID"
    },
    "name": {
      "type": "string",
      "description": "Rate name"
    },
    "board_type": {
      "type": "string",
      "description": "Board basis when supplied"
    },
    "payment_type": {
      "type": "string",
      "description": "Only supported prepaid rates are exposed"
    },
    "conditions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": {
            "type": "string",
            "description": "Condition title"
          },
          "description": {
            "type": "string",
            "description": "Condition details"
          }
        },
        "additionalProperties": true
      }
    },
    "cancellation_timeline": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "before": {
            "type": "string",
            "description": "Deadline"
          },
          "currency": {
            "type": "string",
            "description": "Refund currency"
          },
          "refund_amount": {
            "type": "string",
            "description": "Supplier refund decimal amount"
          }
        },
        "additionalProperties": true
      }
    },
    "due_at_accommodation_amount": {
      "type": "string",
      "description": "Separately payable extras; not included in the online total"
    },
    "due_at_accommodation_currency": {
      "type": "string",
      "description": "Currency of property extras"
    },
    "pricing": {
      "$ref": "#/components/schemas/Pricing"
    }
  },
  "required": [
    "id",
    "pricing"
  ],
  "additionalProperties": true
}
```

### HotelQuote

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "quo_ final quote ID"
    },
    "expires_at": {
      "type": "string",
      "description": "Expiry when returned; revalidation is mandatory",
      "format": "date-time"
    },
    "total_amount": {
      "type": "string",
      "description": "Supplier decimal total"
    },
    "total_currency": {
      "type": "string",
      "description": "Supplier currency"
    },
    "guests": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": {
            "type": "string",
            "description": "Adult/child"
          },
          "age": {
            "type": "integer",
            "description": "Child age when supplied",
            "minimum": 0
          }
        },
        "additionalProperties": true
      }
    },
    "accommodation": {
      "type": "object",
      "properties": {},
      "additionalProperties": true
    }
  },
  "required": [
    "id"
  ],
  "additionalProperties": true
}
```

### Booking

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Saved checkout UUID",
      "format": "uuid"
    },
    "reference": {
      "type": "string",
      "description": "Stable OTA payment/reference identifier"
    },
    "kind": {
      "type": "string",
      "description": "Product",
      "enum": [
        "flight",
        "hotel"
      ]
    },
    "mode": {
      "type": "string",
      "description": "Original checkout mode",
      "enum": [
        "test",
        "live"
      ]
    },
    "status": {
      "type": "string",
      "description": "Authoritative booking state",
      "enum": [
        "payment_pending",
        "processing",
        "confirmed",
        "requires_review",
        "cancelled",
        "refunded"
      ]
    },
    "revision": {
      "type": "integer",
      "description": "Monotonic material revision; ignore lower revisions for the same booking",
      "minimum": 0
    },
    "amountKobo": {
      "type": "integer",
      "description": "Saved total NGN minor units",
      "minimum": 1
    },
    "providerOfferId": {
      "type": "string",
      "description": "Original off_ or quo_ ID"
    },
    "providerBookingId": {
      "type": "string",
      "description": "ord_ flight reservation or bok_ hotel booking ID",
      "nullable": true
    },
    "pricing": {
      "$ref": "#/components/schemas/Pricing"
    },
    "offer": {
      "type": "object",
      "properties": {},
      "additionalProperties": true
    },
    "travellers": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {},
        "additionalProperties": true
      }
    },
    "contact": {
      "$ref": "#/components/schemas/Contact"
    },
    "providerResult": {
      "type": "object",
      "properties": {
        "documents": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {},
            "additionalProperties": true
          }
        }
      },
      "additionalProperties": true,
      "nullable": true
    },
    "providerNotice": {
      "type": "string",
      "description": "Supplier-facing customer notice",
      "nullable": true
    },
    "issue": {
      "type": "string",
      "description": "Customer-safe review message",
      "nullable": true
    },
    "serviceRequest": {
      "type": "string",
      "description": "Current support request",
      "nullable": true
    },
    "refund": {
      "type": "object",
      "properties": {},
      "additionalProperties": true,
      "nullable": true
    },
    "authorizationUrl": {
      "type": "string",
      "description": "Hosted payment URL when initialised",
      "nullable": true
    },
    "expiresAt": {
      "type": "string",
      "description": "Saved checkout expiry",
      "format": "date-time"
    },
    "paidAt": {
      "type": "string",
      "description": "Canonical payment verified at",
      "format": "date-time",
      "nullable": true
    },
    "createdAt": {
      "type": "string",
      "description": "Created at",
      "format": "date-time"
    },
    "updatedAt": {
      "type": "string",
      "description": "Updated at",
      "format": "date-time"
    }
  },
  "required": [
    "id",
    "reference",
    "kind",
    "mode",
    "status",
    "revision",
    "amountKobo"
  ],
  "additionalProperties": true,
  "example": {
    "id": "41af391c-653c-4eb0-a168-cbd81d8e12d1",
    "reference": "OTA-example",
    "kind": "flight",
    "mode": "test",
    "status": "payment_pending",
    "revision": 0,
    "providerOfferId": "off_example123",
    "providerBookingId": null,
    "amountKobo": 13447900,
    "pricing": {
      "supplierKobo": 13447900,
      "markupKobo": 0,
      "feeKobo": 0,
      "totalKobo": 13447900,
      "currency": "NGN",
      "rate": 1344.79,
      "supplierCurrency": "USD",
      "supplierAmount": "100.00"
    },
    "offer": {
      "id": "off_example123",
      "total_amount": "100.00",
      "total_currency": "USD",
      "expires_at": "2026-10-30T00:46:12.077Z",
      "passengers": [
        {
          "id": "pas_example123",
          "type": "adult"
        }
      ],
      "owner": {
        "id": "arl_example123",
        "name": "Example airline"
      },
      "slices": [
        {
          "origin": {
            "iata_code": "LOS",
            "city_name": "Lagos"
          },
          "destination": {
            "iata_code": "JED",
            "city_name": "Jeddah"
          },
          "duration": "PT5H30M",
          "segments": [
            {
              "departing_at": "2026-12-14T10:00:00",
              "arriving_at": "2026-12-14T17:30:00",
              "origin": {
                "iata_code": "LOS"
              },
              "destination": {
                "iata_code": "JED"
              },
              "passengers": [
                {
                  "passenger_id": "pas_example123",
                  "cabin_class": "economy",
                  "baggages": []
                }
              ]
            }
          ]
        }
      ],
      "pricing": {
        "supplierKobo": 13447900,
        "markupKobo": 0,
        "feeKobo": 0,
        "totalKobo": 13447900,
        "currency": "NGN",
        "rate": 1344.79,
        "supplierCurrency": "USD",
        "supplierAmount": "100.00"
      }
    },
    "travellers": [
      {
        "id": "pas_example123",
        "given_name": "Example",
        "family_name": "Traveller",
        "born_on": "1990-01-01",
        "title": "mr",
        "gender": "m",
        "email": "traveller@example.com",
        "phone_number": "+2348012345678"
      }
    ],
    "contact": {
      "email": "traveller@example.com",
      "phone": "+2348012345678"
    },
    "expiresAt": "2026-10-30T00:46:12.077Z",
    "paidAt": null,
    "providerResult": null,
    "providerNotice": null,
    "issue": null,
    "serviceRequest": null,
    "refund": null
  }
}
```

### BookingResponse

```json
{
  "type": "object",
  "properties": {
    "booking": {
      "$ref": "#/components/schemas/Booking"
    }
  },
  "required": [
    "booking"
  ],
  "example": {
    "booking": {
      "id": "41af391c-653c-4eb0-a168-cbd81d8e12d1",
      "reference": "OTA-example",
      "kind": "flight",
      "mode": "test",
      "status": "payment_pending",
      "revision": 0,
      "providerOfferId": "off_example123",
      "providerBookingId": null,
      "amountKobo": 13447900,
      "pricing": {
        "supplierKobo": 13447900,
        "markupKobo": 0,
        "feeKobo": 0,
        "totalKobo": 13447900,
        "currency": "NGN",
        "rate": 1344.79,
        "supplierCurrency": "USD",
        "supplierAmount": "100.00"
      },
      "offer": {
        "id": "off_example123",
        "total_amount": "100.00",
        "total_currency": "USD",
        "expires_at": "2026-10-30T00:46:12.077Z",
        "passengers": [
          {
            "id": "pas_example123",
            "type": "adult"
          }
        ],
        "owner": {
          "id": "arl_example123",
          "name": "Example airline"
        },
        "slices": [
          {
            "origin": {
              "iata_code": "LOS",
              "city_name": "Lagos"
            },
            "destination": {
              "iata_code": "JED",
              "city_name": "Jeddah"
            },
            "duration": "PT5H30M",
            "segments": [
              {
                "departing_at": "2026-12-14T10:00:00",
                "arriving_at": "2026-12-14T17:30:00",
                "origin": {
                  "iata_code": "LOS"
                },
                "destination": {
                  "iata_code": "JED"
                },
                "passengers": [
                  {
                    "passenger_id": "pas_example123",
                    "cabin_class": "economy",
                    "baggages": []
                  }
                ]
              }
            ]
          }
        ],
        "pricing": {
          "supplierKobo": 13447900,
          "markupKobo": 0,
          "feeKobo": 0,
          "totalKobo": 13447900,
          "currency": "NGN",
          "rate": 1344.79,
          "supplierCurrency": "USD",
          "supplierAmount": "100.00"
        }
      },
      "travellers": [
        {
          "id": "pas_example123",
          "given_name": "Example",
          "family_name": "Traveller",
          "born_on": "1990-01-01",
          "title": "mr",
          "gender": "m",
          "email": "traveller@example.com",
          "phone_number": "+2348012345678"
        }
      ],
      "contact": {
        "email": "traveller@example.com",
        "phone": "+2348012345678"
      },
      "expiresAt": "2026-10-30T00:46:12.077Z",
      "paidAt": null,
      "providerResult": null,
      "providerNotice": null,
      "issue": null,
      "serviceRequest": null,
      "refund": null
    }
  }
}
```

### BookingCreate

```json
{
  "type": "object",
  "properties": {
    "kind": {
      "type": "string",
      "description": "Product",
      "enum": [
        "flight",
        "hotel"
      ]
    },
    "offerId": {
      "type": "string",
      "description": "Current off_ flight offer ID or quo_ hotel quote ID"
    },
    "acceptedTerms": {
      "type": "boolean",
      "enum": [
        true
      ],
      "description": "Explicit acceptance of the currently displayed terms"
    },
    "expectedTotalKobo": {
      "type": "integer",
      "description": "Use the current server pricing.totalKobo; must match exactly",
      "minimum": 1
    },
    "contact": {
      "$ref": "#/components/schemas/Contact"
    },
    "travellers": {
      "type": "array",
      "items": {
        "oneOf": [
          {
            "$ref": "#/components/schemas/FlightTraveller"
          },
          {
            "$ref": "#/components/schemas/Guest"
          }
        ]
      },
      "minItems": 1,
      "maxItems": 24,
      "description": "Flight: every offer passenger exactly once; hotel: one guest per quote guest"
    }
  },
  "required": [
    "kind",
    "offerId",
    "acceptedTerms",
    "expectedTotalKobo",
    "contact",
    "travellers"
  ],
  "example": {
    "kind": "flight",
    "offerId": "off_example123",
    "acceptedTerms": true,
    "expectedTotalKobo": 13447900,
    "contact": {
      "email": "traveller@example.com",
      "phone": "+2348012345678"
    },
    "travellers": [
      {
        "id": "pas_example123",
        "given_name": "Example",
        "family_name": "Traveller",
        "born_on": "1990-01-01",
        "title": "mr",
        "gender": "m",
        "email": "traveller@example.com",
        "phone_number": "+2348012345678"
      }
    ]
  }
}
```

### TimelineEvent

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Event ID"
    },
    "title": {
      "type": "string",
      "description": "Customer-facing title"
    },
    "message": {
      "type": "string",
      "description": "Customer-safe description"
    },
    "createdAt": {
      "type": "string",
      "description": "Event time",
      "format": "date-time"
    },
    "urgent": {
      "type": "boolean",
      "description": "Needs traveller attention"
    },
    "response": {
      "type": "string",
      "description": "Customer-visible reply on a resolved support request"
    }
  },
  "additionalProperties": true
}
```

### TravelUpdate

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Opaque OTA notification ID; URL-encode when marking read"
    },
    "title": {
      "type": "string",
      "description": "Notification title"
    },
    "message": {
      "type": "string",
      "description": "Customer message"
    },
    "isRead": {
      "type": "boolean",
      "description": "Read status"
    },
    "type": {
      "type": "string",
      "description": "Notification type"
    },
    "link": {
      "type": "string",
      "description": "Relative web link, not a native app deep link",
      "nullable": true
    },
    "createdAt": {
      "type": "string",
      "description": "Creation time",
      "format": "date-time"
    }
  },
  "required": [
    "id",
    "title",
    "message",
    "isRead",
    "createdAt"
  ]
}
```
