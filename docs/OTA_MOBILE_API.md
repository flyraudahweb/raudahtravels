# FlyRaudah OTA Mobile API

Contract version: 1.0.2. Base URL: https://flyraudah.com.ng/api/ota/v1.

## Developer kit, environments & first request

Download the OpenAPI contract, TypeScript client/declarations, mobile README and Postman collection/environment from the Developer Centre. The types are generated from this exact contract with openapi-typescript; the client uses openapi-fetch and does not retry purchases. Install openapi-fetch in the mobile project and keep the client/declaration files together. This is a native integration starter, not a completed app.

1. Create separate development/staging/production configurations. The full API base ends in /api/ota/v1 and production is https://flyraudah.com.ng/api/ota/v1. A test key does not turn a production host into a safe staging environment; check /capabilities mode and sales switches.
2. Configure the same Clerk instance/publishable key as the target backend, secure SDK token storage, getToken per request and the native sign-in redirect scheme. Do not put any backend/provider secrets in EXPO_PUBLIC_* variables.
3. First call GET /config and GET /capabilities without credentials. Then sign in, POST /me/bootstrap with {}, and GET /me with a fresh session token. 401 means missing/invalid session; 403 means profile/account access needs attention.
4. The Postman environment contains blank tokens/IDs and writes disabled by default. Use a current Postman with pm.execution.skipRequest, set a local-only customer_session, and choose the intended staging base. Customer POSTs require allow_customer_writes=true; booking POSTs additionally require allow_booking_writes=true. Importing files makes no requests.
5. Search responses capture non-secret offer/passenger/result/rate/quote/booking IDs into the local environment. Review sample contact/traveller data and refreshed expected_total_kobo before any write. The provided booking sample is for one adult flight; use the hotel journey guide to build hotel checkout payloads.
6. Copy the client starter into the app, typecheck it, and verify Request/AbortController/redirect behavior on both device runtimes. Network/abort/invalid-JSON errors can throw; HTTP JSON errors return the typed error/response result. None are payment proof.
7. Dart/Kotlin/Swift teams can use the same OpenAPI export for their client stack. The TypeScript starter is optional; use the same session, money, retry and ownership rules in every implementation.

[OpenAPI specification](https://spec.openapis.org/oas/v3.0.3)

[Typed fetch client](https://openapi-ts.dev/openapi-fetch/)

[Postman request guards](https://learning.postman.com/latest-v-12/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-execution)

## API conventions, pagination & compatibility

All customer requests use HTTPS and JSON. Send Content-Type: application/json for POST bodies ({} for bodyless actions); GET has no JSON body. Responses use camelCase Raudah envelopes with nested supplier fields often in snake_case. Unknown v1 routes return JSON404 and wrong methods JSON405 with Allow. Administrative and supplier webhook endpoints are excluded from v1.

1. Keep supplier IDs opaque. Preserve off_, srr_, rat_, quo_, pas_ and booking IDs exactly. URL-encode each raw path ID once, including ota: update IDs; typed client params.path handles serialization. Do not concatenate an untrusted URL as an API path.
2. Null means explicitly absent; omitted optional properties may not be supplied by that provider. Do not assume documents, baggage, cancellation rules, property photos or all rate fields exist. Missing fields need an honest fallback, not invented inventory or terms.
3. Money in amountKobo/pricing.totalKobo is integer NGN minor units. Supplier decimal amounts stay strings. Date-only dates stay YYYY-MM-DD; supplier local departure/arrival strings must retain airport/property timezone context. Revision is a monotonic booking snapshot version, not an HTTP ETag.
4. GET /bookings returns 50 rows and GET /updates 20; offset defaults to0, maximum100000. Follow nextOffset until null, merge by ID and retain the newest booking.revision. Counts cover all owner records. New rows can shift offset pages, so deduplicate and refresh page0 after changes; there is no cursor or stable export snapshot.
5. The v1 URL is the compatibility boundary; info.version identifies the documentation revision. Treat added optional fields as additive. Ignore unknown fields and handle unknown future enum values with a neutral state/support fallback. There is no announced deprecation date or API SLA in this contract; coordinate breaking changes before releasing a client.
6. Authenticated responses are no-store. Keep minimal recovery IDs locally; clear account-bound caches on sign-out/account changes. Do not log tokens, passport/contact payloads or complete reservation responses to analytics/crash tools.


## HTTP errors, throttling & retry decisions

Error JSON currently contains human-readable error and optional validation fields. There are no stable machine error codes; branch on HTTP status, current booking state and fields rather than matching message text. Proxies, offline networks and invalid/non-JSON responses can fail outside the JSON contract, so catch thrown client errors as well as HTTP error results.

1. 400: show field validation where fields are supplied; otherwise show the safe message and let the traveller correct details. 401: refresh the Clerk session or sign in, then recover state; avoid infinite authentication retries. 403: stop and resolve blocked/missing-profile or scope/mode access.
2. 404: record missing/unowned or expired context; return to search/My Trips as appropriate. 405: correct the method using Allow. 409: re-fetch the offer/quote/booking, display any new price and require explicit acceptance; never silently charge a changed amount.
3. 413/415: correct body size/encoding and send JSON. 429: honor Retry-After in seconds, show a countdown and coalesce polling/search calls. Do not attach generic automatic retries to customer mutation hooks.
4. 502/503/offline/abort/timeout: public discovery/search may be repeated with bounded backoff and jitter. A failed checkout/payment POST is ambiguous; recover GET /bookings or the known booking ID first. Never create a supplier order, mark paid, refund, or auto-repeat checkout from the device.
5. Current burst protection is60 requests/minute per signed-in user or unauthenticated IP in each process; edge limits can be stricter. Optional server search keys additionally use a shared database10–60/minute configured limit. These are limits, not guaranteed throughput; no X-RateLimit-Remaining header is promised.
6. Poll processing bookings about every5 seconds and settled trips/inbox about every30 seconds while visible. Single-flight/coalesce refreshes; pause in the background. Separate UI request generations when the route/account changes, discard older booking revisions, and never let a late request navigate a different checkout.


## Offline, app lifecycle, documents & safe links

A device can lose connectivity or be terminated while payment or reservation work continues on the server. Retain the saved booking ID before opening hosted payment, and restore its state after app restart/resume. The server callback currently returns to the web booking page. Native app routing/universal links and push are application work, not completed OTA endpoints.

1. Show offline/stale state and disable new checkout/payment while offline. Do not persist an automatic POST queue for payments or reservations. Aborting a fetch or dismissing the browser does not cancel a server operation.
2. Use GET /bookings/{id} on resume. Show processing/requires_review without pay-again actions, and use /complete only against the same saved booking when appropriate. A query flag/deep link/browser success screen is never payment proof.
3. Payment URLs must come from /pay and use https://checkout.paystack.com/. Do not accept a callback or arbitrary payment URL from user input. The typed starter rejects API redirects and limits bearer tokens to the configured HTTPS API origin/path.
4. Display supplied ticket/voucher documents and identifiers when available; documents may arrive after confirmation. Open only valid HTTPS document links after checking the expected supplier/host policy. Relative notification links are web links, not native routes; map only known internal paths such as /travel/bookings/{id}.
5. Keep passports/contact details in memory only when practical, use secure platform storage for session credentials, and clear per-account caches. Screen-capture/logging/analytics choices and account-deletion/privacy flows must be designed for the app; there is no OTA password-reset or account-deletion endpoint.


## Mobile acceptance matrix & release handoff

The documented API and starter do not certify a finished mobile app. Verify the integration on actual iOS/Android devices against a separate staging service with matching test credentials. Existing production Paystack settings must not be replaced just to make sandbox purchases work.

1. Identity: new verified account/bootstrap, expired token, blocked account, sign-out/account switch, and owner isolation (another booking ID returns404). Confirm profile errors are shown clearly.
2. Discovery: one-way/return/adult/child flights, no results, invalid dates/airports, offer expiry, changed total, disabled products and FX outage. Hotels: no rooms, prepaid filtering, room count/guest match, quote expiry and property extras/cancellation display.
3. Checkout/payment: duplicate taps, app kill immediately before/after save, unknown save response, success/pending/failed payment, lost browser return, repeated callbacks and interrupted supplier confirmation. Confirm there is one fulfillment and no client-side paid-state shortcut.
4. Trips/inbox: pagination with new incoming records, out-of-order revisions, late callback after navigation/account change, read-one/read-all ownership, support reply, delayed documents and server-observed cancellation/refund states.
5. Operations: all required migrations (0012 only for optional server keys), Stays entitlement, matching modes, funded provider balance, signature-verified webhooks, continuously running workers, edge throttling and operator reconciliation. Review actual /capabilities before enabling UI actions.
6. Handoff: record deployed API/documentation version, Clerk instance, staging/production base URLs, app release/build version, enabled features, test evidence, support contacts and rollback owner. Never include secrets or passenger data in that handoff record.


## FlyRaudah OTA app screen blueprint

Build the FlyRaudah mobile app on the same customer accounts and OTA engine as the web app. Product access, prices, payments and reservation status remain authoritative on the server. This guide describes the current implemented contract; a native application itself is a separate deliverable.

1. Home: GET /capabilities, /config and /exchange-rates. Show test/live mode and support contacts; hide disabled search/checkout products. Reference FX is informational, not the selling price.
2. Flights: debounce GET /places?q=, choose returned IATA codes, POST /flights/search, then GET /flights/offers/{id}. Use each slice/segment for local departure/arrival times, stops, airline and available baggage/conditions. Filtering/sorting runs on the returned offers; do not invent cheaper date prices.
3. Hotels: select a destination with latitude/longitude from the app's city list or a separately integrated geocoder, POST /hotels/search, POST /hotels/rates/{id} with {}, then sign in and POST /hotels/quotes with rateId. Arbitrary destination text is not accepted as coordinates. Show room conditions, cancellation deadlines and any separately payable property extras.
4. Account: use Clerk sign-up/sign-in/verification and secure SDK token storage, POST /me/bootstrap, then GET /me. Names/contact from the checkout do not change the account profile. Account editing and deletion use the identity provider's account flow; there is no OTA password or administrator API for mobile customers.
5. Traveller review: retain refreshed offer passenger IDs and ask for matching birth dates, names, E.164 contact and required passports. Hotel guest count must match the final quote. Explicitly accept terms and use the latest pricing.totalKobo.
6. Checkout: POST /bookings once per explicit confirmation. Save the returned booking ID before POST /bookings/{id}/pay. Disable repeated taps; do not silently retry checkout creation after a timeout because Idempotency-Key is not supported. Recover GET /bookings first.
7. Payment: open only the server authorizationUrl in the system authentication/browser flow. On web return, app resume or app restart, GET the retained booking and POST /complete only when appropriate. A browser success screen or mobile deep link is never payment proof.
8. My Trips: GET /bookings?offset=; use nextOffset, merge by ID, compare revisions and show pending/confirmed/attention summaries. Trip details use GET /bookings/{id}, GET /timeline and occasional POST /refresh with {}. Show supplied documents safely; never synthesize ticket numbers.
9. Inbox and help: GET /updates?offset=, POST /updates/{encodedId}/read or /updates/read-all, and POST /bookings/{id}/service-request. Poll only while active and respect Retry-After; native push, seats, infants, multi-city and instant self-service refunds/exchanges are not currently exposed.
10. Release acceptance: run the documented staging payment/provider tests with matching modes, migration 0012 only if backend keys are used, HTTPS, secret isolation, ownership tests, timeout recovery and operator reconciliation. Production Stays access and a funded supplier account are separate provider requirements.


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
2. POST /bookings/{id}/refresh with {} performs a supplier read, not a repeat purchase. Use sparingly because it consumes provider capacity.
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


## Named checkout examples

### One adult flight checkout

Illustrative data only; use a refreshed offer/quote and explicit terms acceptance.

```json
{
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
```

### One adult prepaid hotel checkout

Illustrative data only; use a refreshed offer/quote and explicit terms acceptance.

```json
{
  "kind": "hotel",
  "offerId": "quo_example123",
  "acceptedTerms": true,
  "expectedTotalKobo": 13447900,
  "contact": {
    "email": "traveller@example.com",
    "phone": "+2348012345678"
  },
  "travellers": [
    {
      "given_name": "Example",
      "family_name": "Traveller"
    }
  ]
}
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
    "expires_at": "2026-10-30T13:05:18.914Z",
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
      "expires_at": "2026-10-30T13:05:18.914Z",
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
    "expiresAt": "2026-10-30T13:05:18.915Z",
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
        "expires_at": "2026-10-30T13:05:18.914Z",
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
      "expiresAt": "2026-10-30T13:05:18.915Z",
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
        "anyOf": [
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
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "kind": {
          "type": "string",
          "enum": [
            "flight"
          ]
        },
        "travellers": {
          "type": "array",
          "items": {
            "$ref": "#/components/schemas/FlightTraveller"
          }
        }
      },
      "required": [
        "kind"
      ]
    },
    {
      "type": "object",
      "properties": {
        "kind": {
          "type": "string",
          "enum": [
            "hotel"
          ]
        },
        "travellers": {
          "type": "array",
          "items": {
            "$ref": "#/components/schemas/Guest"
          }
        }
      },
      "required": [
        "kind"
      ]
    }
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

## Response contracts

### GET /config

#### HTTP 200

Successful response

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "flightsEnabled": {
        "type": "boolean",
        "description": "Flight search enabled"
      },
      "hotelsEnabled": {
        "type": "boolean",
        "description": "Stays search enabled"
      },
      "salesEnabled": {
        "type": "boolean",
        "description": "Online checkout enabled"
      },
      "mode": {
        "type": "string",
        "description": "Mode",
        "enum": [
          "test",
          "live"
        ]
      },
      "supportEmail": {
        "type": "string",
        "description": "Support email"
      },
      "supportPhone": {
        "type": "string",
        "description": "Support phone"
      }
    },
    "required": [
      "flightsEnabled",
      "hotelsEnabled",
      "salesEnabled",
      "mode",
      "supportEmail",
      "supportPhone"
    ]
  },
  "example": {
    "flightsEnabled": true,
    "hotelsEnabled": false,
    "salesEnabled": false,
    "mode": "test",
    "supportEmail": "",
    "supportPhone": ""
  }
}
```

### GET /capabilities

#### HTTP 200

Successful response

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "apiVersion": {
        "type": "string",
        "description": "1"
      },
      "mode": {
        "type": "string",
        "description": "test/live"
      },
      "currency": {
        "type": "string",
        "description": "NGN"
      },
      "features": {
        "type": "object",
        "properties": {
          "flightSearch": {
            "type": "boolean",
            "description": "Enabled flight search"
          },
          "hotelSearch": {
            "type": "boolean",
            "description": "Enabled hotel search"
          },
          "onlineCheckout": {
            "type": "boolean",
            "description": "Enabled checkout"
          },
          "bookingHistory": {
            "type": "boolean",
            "description": "Implemented"
          },
          "bookingUpdates": {
            "type": "boolean",
            "description": "Implemented"
          },
          "supportRequests": {
            "type": "boolean",
            "description": "Implemented"
          },
          "selfServiceCancellation": {
            "type": "boolean",
            "description": "False"
          },
          "selfServiceExchange": {
            "type": "boolean",
            "description": "False"
          },
          "multiCity": {
            "type": "boolean",
            "description": "False"
          },
          "infants": {
            "type": "boolean",
            "description": "False"
          },
          "ancillaries": {
            "type": "boolean",
            "description": "False"
          }
        }
      },
      "limits": {
        "type": "object",
        "properties": {},
        "additionalProperties": {
          "type": "integer"
        }
      },
      "polling": {
        "type": "object",
        "properties": {
          "processingSeconds": {
            "type": "integer",
            "description": "5",
            "minimum": 0
          },
          "settledSeconds": {
            "type": "integer",
            "description": "30",
            "minimum": 0
          }
        }
      },
      "support": {
        "type": "object",
        "properties": {
          "email": {
            "type": "string",
            "description": "Support email"
          },
          "phone": {
            "type": "string",
            "description": "Support phone"
          }
        }
      }
    },
    "required": [
      "apiVersion",
      "mode",
      "currency",
      "features",
      "limits",
      "polling",
      "support"
    ]
  }
}
```

### GET /exchange-rates

#### HTTP 200

Successful response

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "sellingRates": {
        "type": "object",
        "properties": {},
        "additionalProperties": {
          "type": "number"
        }
      },
      "reference": {
        "type": "object",
        "properties": {
          "provider": {
            "type": "string",
            "description": "Reference source"
          },
          "frequency": {
            "type": "string",
            "description": "Publication frequency, e.g. daily"
          },
          "status": {
            "type": "string",
            "description": "current/stale/unavailable"
          },
          "stale": {
            "type": "boolean",
            "description": "Stale reference"
          },
          "fetchedAt": {
            "type": "string",
            "description": "Fetch time",
            "format": "date-time",
            "nullable": true
          },
          "rates": {
            "type": "object",
            "properties": {},
            "additionalProperties": {
              "type": "object",
              "properties": {
                "ngnPerUnit": {
                  "type": "number"
                },
                "date": {
                  "type": "string",
                  "description": "Source date",
                  "format": "date"
                }
              }
            }
          }
        },
        "additionalProperties": true
      }
    },
    "required": [
      "sellingRates",
      "reference"
    ]
  }
}
```

### GET /me

#### HTTP 200

Successful response

```json
{
  "schema": {
    "$ref": "#/components/schemas/ProfileResponse"
  }
}
```

### POST /me/bootstrap

#### HTTP 200

Successful response

```json
{
  "schema": {
    "$ref": "#/components/schemas/ProfileResponse"
  }
}
```

### GET /places

#### HTTP 200

Successful response

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "places": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "description": "Supplier place ID"
            },
            "name": {
              "type": "string",
              "description": "Display name"
            },
            "iata_code": {
              "type": "string",
              "description": "IATA code",
              "nullable": true
            },
            "type": {
              "type": "string",
              "description": "city/airport"
            },
            "city_name": {
              "type": "string",
              "description": "City name",
              "nullable": true
            },
            "airports": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {},
                "additionalProperties": true
              },
              "nullable": true
            }
          },
          "additionalProperties": true
        }
      }
    },
    "required": [
      "places"
    ]
  }
}
```

### POST /flights/search

#### HTTP 200

Successful response

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "offers": {
        "type": "array",
        "items": {
          "$ref": "#/components/schemas/FlightOffer"
        }
      }
    },
    "required": [
      "offers"
    ]
  },
  "example": {
    "offers": [
      {
        "id": "off_example123",
        "total_amount": "100.00",
        "total_currency": "USD",
        "expires_at": "2026-10-30T13:05:18.914Z",
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
    ]
  }
}
```

### GET /flights/offers/{id}

#### HTTP 200

Successful response

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "offer": {
        "$ref": "#/components/schemas/FlightOffer"
      },
      "pricing": {
        "$ref": "#/components/schemas/Pricing"
      }
    },
    "required": [
      "offer",
      "pricing"
    ]
  },
  "example": {
    "offer": {
      "id": "off_example123",
      "total_amount": "100.00",
      "total_currency": "USD",
      "expires_at": "2026-10-30T13:05:18.914Z",
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
      ]
    },
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

### POST /hotels/search

#### HTTP 200

Successful response

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "results": {
        "type": "array",
        "items": {
          "$ref": "#/components/schemas/HotelResult"
        }
      }
    },
    "required": [
      "results"
    ]
  }
}
```

### POST /hotels/rates/{id}

#### HTTP 200

Successful response

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "result": {
        "type": "object",
        "properties": {
          "accommodation": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "description": "Property name"
              },
              "description": {
                "type": "string",
                "description": "Property description"
              },
              "rooms": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "name": {
                      "type": "string",
                      "description": "Room name"
                    },
                    "rates": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/HotelRate"
                      }
                    }
                  },
                  "additionalProperties": true
                }
              }
            },
            "additionalProperties": true
          }
        },
        "additionalProperties": true
      }
    },
    "required": [
      "result"
    ]
  }
}
```

### POST /hotels/quotes

#### HTTP 200

Successful response

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "quote": {
        "$ref": "#/components/schemas/HotelQuote"
      },
      "pricing": {
        "$ref": "#/components/schemas/Pricing"
      }
    },
    "required": [
      "quote",
      "pricing"
    ]
  }
}
```

### GET /hotels/quotes/{id}

#### HTTP 200

Successful response

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "quote": {
        "$ref": "#/components/schemas/HotelQuote"
      },
      "pricing": {
        "$ref": "#/components/schemas/Pricing"
      }
    },
    "required": [
      "quote",
      "pricing"
    ]
  }
}
```

### POST /bookings

#### HTTP 201

Successful response

```json
{
  "schema": {
    "$ref": "#/components/schemas/BookingResponse"
  },
  "examples": {
    "flight": {
      "summary": "Saved flight checkout",
      "value": {
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
            "expires_at": "2026-10-30T13:05:18.914Z",
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
          "expiresAt": "2026-10-30T13:05:18.915Z",
          "paidAt": null,
          "providerResult": null,
          "providerNotice": null,
          "issue": null,
          "serviceRequest": null,
          "refund": null
        }
      }
    },
    "hotel": {
      "summary": "Saved prepaid hotel checkout",
      "value": {
        "booking": {
          "id": "41af391c-653c-4eb0-a168-cbd81d8e12d1",
          "reference": "OTA-example",
          "kind": "hotel",
          "mode": "test",
          "status": "payment_pending",
          "revision": 0,
          "providerOfferId": "quo_example123",
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
            "id": "quo_example123",
            "total_amount": "100.00",
            "total_currency": "USD",
            "guests": [
              {
                "type": "adult"
              }
            ],
            "accommodation": {
              "name": "Example hotel",
              "rooms": []
            }
          },
          "travellers": [
            {
              "given_name": "Example",
              "family_name": "Traveller"
            }
          ],
          "contact": {
            "email": "traveller@example.com",
            "phone": "+2348012345678"
          },
          "expiresAt": "2026-10-30T13:05:18.915Z",
          "paidAt": null,
          "providerResult": null,
          "providerNotice": null,
          "issue": null,
          "serviceRequest": null,
          "refund": null
        }
      }
    }
  }
}
```

### GET /bookings

#### HTTP 200

Successful response

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "bookings": {
        "type": "array",
        "items": {
          "$ref": "#/components/schemas/Booking"
        }
      },
      "nextOffset": {
        "type": "integer",
        "description": "Next page offset",
        "minimum": 0,
        "nullable": true
      },
      "summary": {
        "type": "object",
        "properties": {
          "confirmed": {
            "type": "integer",
            "description": "Confirmed count",
            "minimum": 0
          },
          "pending": {
            "type": "integer",
            "description": "Payable unexpired count",
            "minimum": 0
          },
          "attention": {
            "type": "integer",
            "description": "Processing/review/supplier-notice count",
            "minimum": 0
          }
        }
      }
    },
    "required": [
      "bookings",
      "nextOffset",
      "summary"
    ]
  }
}
```

### POST /bookings/{id}/pay

#### HTTP 200

Successful response

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "authorizationUrl": {
        "type": "string",
        "description": "https://checkout.paystack.com/...",
        "format": "uri"
      }
    },
    "required": [
      "authorizationUrl"
    ]
  }
}
```

### POST /bookings/{id}/complete

#### HTTP 200

Successful response

```json
{
  "schema": {
    "$ref": "#/components/schemas/BookingResponse"
  }
}
```

### GET /bookings/{id}

#### HTTP 200

Successful response

```json
{
  "schema": {
    "$ref": "#/components/schemas/BookingResponse"
  }
}
```

### POST /bookings/{id}/refresh

#### HTTP 200

Successful response

```json
{
  "schema": {
    "$ref": "#/components/schemas/BookingResponse"
  }
}
```

### GET /bookings/{id}/timeline

#### HTTP 200

Successful response

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "events": {
        "type": "array",
        "items": {
          "$ref": "#/components/schemas/TimelineEvent"
        }
      }
    },
    "required": [
      "events"
    ]
  }
}
```

### POST /bookings/{id}/service-request

#### HTTP 200

Successful response

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "success": {
        "type": "boolean",
        "description": "Saved"
      }
    },
    "required": [
      "success"
    ]
  }
}
```

### GET /updates

#### HTTP 200

Successful response

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "updates": {
        "type": "array",
        "items": {
          "$ref": "#/components/schemas/TravelUpdate"
        }
      },
      "nextOffset": {
        "type": "integer",
        "description": "Next offset",
        "minimum": 0,
        "nullable": true
      },
      "unreadCount": {
        "type": "integer",
        "description": "All owner OTA unread notifications",
        "minimum": 0
      }
    },
    "required": [
      "updates",
      "nextOffset",
      "unreadCount"
    ]
  }
}
```

### POST /updates/{id}/read

#### HTTP 200

Successful response

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "success": {
        "type": "boolean",
        "description": "Read"
      }
    },
    "required": [
      "success"
    ]
  }
}
```

### POST /updates/read-all

#### HTTP 200

Successful response

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "success": {
        "type": "boolean",
        "description": "Read"
      }
    },
    "required": [
      "success"
    ]
  }
}
```

## Common error responses

All errors use the Error schema and return JSON. HTTP 405 includes Allow; HTTP 429 includes Retry-After in seconds.

- HTTP 400: Invalid input. Check error.fields when present.
- HTTP 401: Customer session or supplied integration key is missing/invalid/expired.
- HTTP 403: Inactive account, incorrect role, integration scope or key mode.
- HTTP 404: Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404.
- HTTP 405: Wrong HTTP method. Use the method documented for this endpoint and inspect Allow.
- HTTP 409: Offer/price/state changed. Refresh the saved booking or current offer; do not silently accept a new price.
- HTTP 413: Request body exceeds the API size limit.
- HTTP 415: Unsupported request encoding. Send JSON with Content-Type: application/json.
- HTTP 429: Request limit exceeded. Respect the Retry-After response header.
- HTTP 502: Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself.
- HTTP 503: Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable.
