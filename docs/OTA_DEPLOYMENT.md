# Duffel OTA: deployment and operations

Implemented 2026-10-29. This guide covers the new OTA purchase flow. Existing Hajj/Umrah package workflows retain their own booking/payment records.

Latest migration status: the user reports 0009, 0010 and 0011 have all been applied in Neon. Only 0009 was independently checked by the agent; use deployed readiness checks to confirm the remaining schema. Do not rerun completed migrations unnecessarily. Code push does not confirm successful deployment, webhook activation or staging acceptance.

Latest sandbox configuration: flight search is now enabled and the five requested selling rates are saved in admin settings. Live API checks returned airport suggestions and 17 Lagos–London sandbox offers priced in NGN. The deployed test credential already works and was not replaced. New test installations default to flight search enabled; saved admin settings and explicit environment switches override that default. Disable flight search in `/admin/ota` when needed. Hotels and payment processing retain their separate prerequisites and switches.

Verification results are recorded in `.ai/ota-progress.md`. Provider/payment requests are mocked in tests. The configured database migration 0009 tables/required column types were checked read-only. Public desktop browser rendering was checked during the OTA build; authenticated/live provider acceptance and mobile verification remain deployment gates.

## Payment security follow-up

Payment verification binds the canonical Paystack transaction to its stored amount, currency, reference, mode, booking and purpose. A transaction for an OTA checkout cannot also credit a package booking. Duplicate historical online-payment references are rejected for operator reconciliation. Customer payment submissions accept offline methods only; online initialization and wallet debits use their dedicated server flows. Admin **Check Paystack** uses canonical verification rather than manual approval.

Legacy Paystack callbacks verify raw-body signatures with a configured nonempty key, fetch the canonical transaction and commit durable idempotent credit before acknowledging. Competing verification requests serialize on payment and booking rows. Wallet debits recheck funds and outstanding balance under locks; a losing transaction rolls back its debit, ledger entry and payment together. Reversed/refunded transactions cannot fund supplier purchases. Completed full-refund recording verifies the original transaction, including lossless provider-ID comparison. Supplier creation requests allow 135 seconds and ambiguous purchases remain subject to reconciliation, never automatic repeat purchase.

These controls and mocked-provider regression tests do not establish zero vulnerabilities or guarantee real-world chargeback, credential, hosting or provider outcomes. Complete signed-callback, interruption/replay, concurrent checkout and refund acceptance in staging after migrations and deployment. Monitor Paystack receipts against the application ledger and Duffel reservations/balance; investigate unmatched payments and requires-review bookings before manually retrying anything. Payment secrets, authorization URLs and private environment files must remain private.

## What is implemented

- Public flight search with Duffel airport suggestions, one-way/return itineraries, cabin selection and adult/child passengers.
- Hotel search through Duffel Stays, complete room rates, cancellation terms, final quotes and prepaid balance-funded reservations. The selector includes 16 destinations; the API accepts arbitrary valid coordinates.
- Landing-page search, flight/hotel review, authenticated traveller entry and durable checkout before payment.
- Server-priced NGN totals with operator-configurable supplier-currency conversion, markup and service fee. Initial editable rate defaults are provided; credentials have no embedded fallback token.
- Paystack redirects and authenticated callback recovery; verified amount, currency, reference, metadata and test/live mode; signed webhook handling at the existing application webhook URL.
- Saved checkouts and supplier-confirmed reservations in My Trips. Printable itinerary/hotel voucher and airline document identifiers when returned by Duffel. Supplier references and e-ticket numbers remain distinct.
- Super-admin OTA settings, booking operations, audit history, supplier reconciliation and completed full-refund verification.
- Read-only supplier refresh and customer help requests. A background worker checks interrupted fulfillment, refreshes supplier records and retries email delivery through the existing configured email provider.
- Legacy demo travel purchase endpoints return HTTP 410. Legacy UI entry files delegate to the new screens. Empty/error states do not fabricate inventory, confirmations, trips or balances.

## Enable in staging first

1. Back up the intended PostgreSQL database and apply the pending migrations in order: `0009_ota.sql`, `0010_duffel_webhooks.sql`, then `0011_ota_revision.sql` from `lib/db/drizzle/`. The user already applied 0009; do not re-run completed migrations unnecessarily. Migration 0011 adds an integer booking revision and the supplier-refresh attempt timestamp. It prevents stale responses from overwriting newer state and supports refresh backoff. These migrations are listed in the Drizzle journal. Never point integration tests at the live database.
2. Deploy the API and frontend together. Build commands are `pnpm run build:api` and `pnpm run build:frontend`. Run the production server from the repository root.
3. Configure the existing Clerk keys, `DATABASE_URL`, an HTTPS `APP_URL`, correct `CORS_ORIGIN` and `TRUST_PROXY_HOPS`, and a persistent 64-character hexadecimal `SETTINGS_ENCRYPTION_KEY`. Keep the encryption key with protected operational backups; losing it prevents reading saved credentials.
4. Obtain a Duffel test token and request **Stays access** for the organisation. Confirm that the selected Stays rates support payment from the Duffel balance. The integration searches instant-payment inventory and offers only supported prepaid balance rates.
5. Configure Paystack test keys through existing payment settings or environment variables. Duffel mode and Paystack secret-key mode must match.
6. Sign in as a `super_admin` and open **Admin → Online Travel Agency** (`/admin/ota`). Other admin/staff roles cannot access the settings or global reservation API.
7. Save the Duffel token, choose test mode, configure NGN per supplier-currency unit, markups, fee and the travel support email/phone. `NGN=1` is required; add every supplier currency your account returns. Review rates regularly. Unsupported currencies fail closed.
8. Use **Check connections**, enable search, exercise flight and hotel availability, and then enable online payments for sandbox acceptance testing.
9. Configure Paystack's webhook to the existing `https://YOUR-APP/api/payments/paystack/webhook`. That endpoint dispatches OTA metadata to the OTA handler while retaining package payment processing. `/api/ota/payments/webhook` is also supported for an OTA-only environment. Use HTTPS and the same secret key used for initialization and verification.
10. Configure SMTP/Resend through existing settings and verify delivery separately. The OTA worker retries unsent confirmation/review emails at 30-minute intervals; the in-app booking remains authoritative.

Live activation requires a live Duffel token and enabled live products, a funded live Duffel balance, matching live Paystack credentials and completed staging checks. No live charge, reservation, migration or deployment was performed during implementation. Avoid switching organisation/mode while active checkouts are being paid; existing bookings are bound to their original mode.

## Acceptance checks before live activation

### Duffel webhook deployment

The user-authorized **test** webhook was created on 2026-10-29: `end_0000BBuI8vsP5N3Th5YT7w`, URL `https://flyraudah.com.ng/api/ota/duffel/webhook/test`. It is **inactive** because the public app has not yet deployed this receiver. Its signing secret is saved privately in the ignored local `.env` and OTA `.env.production` overlay. Never paste these files into logs or commit them.

1. Apply `lib/db/drizzle/0010_duffel_webhooks.sql` after 0009, then `lib/db/drizzle/0011_ota_revision.sql`. They add the supplier inbox/notices, booking revision and refresh-attempt timestamp. Neither has been applied to the configured database by the agent.
2. Deploy the updated API/frontend. Import `DUFFEL_WEBHOOK_ID_TEST` and `DUFFEL_WEBHOOK_SECRET_TEST` from the private overlay into hosting, preserving its existing database, Clerk, Paystack and encryption keys. Use `APP_URL=https://flyraudah.com.ng`.
3. Open **Admin Settings → Duffel flights, hotels and webhooks**, or `/admin/ota` → Settings. Separate test/live tokens and signing secrets are editable here and encrypted on Save; blank secret inputs retain saved values. Required server infrastructure values stay in hosting.
4. Select test mode, save the required events, refresh provider status and click **Ping**. Wait for `ping.triggered` to appear in the received event inbox. Then click **Activate**. Activation requires the deployed receiver, migrations 0010/0011, signing configuration and a verified ping from the current signing key within 30 minutes. It does not enable customer sales.
5. Exercise signed test deliveries, duplicates, schedule changes, failures and cancellations in staging. Inspect unmatched/exhausted inbox events; retry performs read-only reconciliation. Repeat setup separately with live credentials when ready.

Implemented events: `order.created`, `order.creation_failed`, `order.airline_initiated_change_detected`, `order_cancellation.created`, `order_cancellation.confirmed`, `stays.booking.created`, `stays.booking_creation_failed`, `stays.booking.cancelled`. Paystack retains its separate customer-payment webhook. Car, airline-credit, assistant, payment-link and Duffel air-payment events are outside the current purchase flow.

The receiver verifies `X-Duffel-Signature` against the exact raw body with a five-minute replay window, persists a deduplicated inbox before acknowledgment and returns a retryable failure if storage is unavailable. The worker uses leased jobs and bounded retries, fetches fresh supplier records and validates association, mode and supplier price before updating a paid reservation. Cancellation never implies a completed customer refund. Delivery order cannot overwrite a refunded checkout. Flight schedule/cancellation notices appear in the booking and reset email notification delivery.

`node --env-file=.env.production scripts/manage-duffel-webhook.cjs` checks remote registration without exposing secrets. The explicit `--create-inactive` action creates/reuses the matching webhook and preserves its one-time secret privately. Admin controls provide normal ongoing management after deployment. References: [Duffel webhooks](https://duffel.com/docs/api/webhooks), [receiving and verifying deliveries](https://duffel.com/docs/guides/receiving-webhooks).

### Purchase and access acceptance

- Search both one-way and return flights with the intended airlines/currencies. Review baggage and change/refund conditions. Exercise every passenger and passport requirement the offered routes impose.
- Search Stays, fetch rates, create a final quote and confirm a prepaid hotel reservation. Review room/board details, taxes, property-payable charges, check-in information and cancellation timelines.
- Complete payment and return to the saved booking URL; reload or close the checkout tab and recover from My Trips.
- Test declined/cancelled payment, underpayment, a wrong currency/reference, stale inventory, duplicate callbacks, a webhook arriving before browser return, and provider timeout after payment.
- Confirm a second account cannot read/complete another account's booking. Confirm user, agent, staff and ordinary admin roles cannot use OTA administration.
- Verify that an uncertain supplier result appears in the operator queue without a repeated supplier purchase. Reconcile the actual provider ID against stored metadata.
- Verify itinerary refresh, document availability, support requests and email delivery. Exercise a real sandbox refund through the provider dashboards and verify the completed refund record.
- Test the deployed domain on mobile and desktop with Clerk authentication. Source tests and a public local preview do not validate live provider entitlements, funds, keys or ticket issuance.

## Payment and fulfillment behavior

The server retrieves an offer/quote and saves its supplier amount, currency, converted total, travellers, contact and owner. The browser supplies the displayed expected total only as a change-detection check. The server checks availability again before initializing payment and uses a stable reference for that checkout.

Fulfillment retrieves the transaction from Paystack and verifies its exact association with the saved checkout. A conditional PostgreSQL update claims the checkout once. Only that caller may attempt the supplier purchase. Concurrent callbacks return the saved state; they do not create additional orders.

Once a supplier write might have happened, network/provider/database ambiguity leads to `requires_review`. It is deliberately not retried automatically. Expiry or supplier price changes after payment also require review rather than an unapproved replacement fare. If a process stops after claiming fulfillment, maintenance flags the interrupted record after ten minutes. Customer payment is never presented as proof of supplier confirmation.

The existing Paystack webhook saves a deduplicated job to PostgreSQL before acknowledging it. The minute worker verifies and fulfills queued payments, using expiring database claims and bounded retries for verification failures. Supplier-write ambiguity is never retried. Inbox-write errors return 503 for provider retry. Browser completion and worker completion share the same fulfillment claim logic. A customer can also use **I have paid — check status**. After repeated verification failures, the booking is flagged for operator payment verification.

## Operator workflow

### Dashboard updates and simpler booking management

Customers receive flight/hotel lifecycle updates in their existing notification inbox, dashboard overview, My Trips and the booking activity timeline. Agents have **My flights & hotels** and **Notifications** for their own purchases; this does not grant access to clients' OTA reservations. Active super admins receive operational alerts for itinerary changes, cancellations, review cases, payment-verification failures and customer requests. Other staff/admin roles retain their existing access limits.

The OTA audit ledger acts as a durable notification outbox. The minute worker publishes up to 200 missing recipient notifications per pass using deterministic IDs, so restarts/concurrent workers do not duplicate messages. Keep maintenance running. Dashboard updates poll every 30 seconds while visible; processing bookings refresh every five seconds. These intervals are distinct from supplier delivery timing. Marking a notification read does not resolve the underlying booking issue.

Public timelines include only approved customer-safe messages. Raw provider payloads, internal errors, credential events and historical internal notes are excluded. **Response to customer** in booking operations is explicitly visible in booking activity; do not enter internal investigation notes there. A support request remains subject to supplier rules and does not automatically exchange, cancel or refund the reservation.

The super-admin overview shows all-record reservation totals, supplier event issues, exhausted payment jobs and the last supplier delivery. The OTA list still paginates 100 records and labels page-specific counts separately. Alerts open the precise booking, including reservations outside the current list page.

UX references reviewed: [Wakanow Manage My Booking](https://eg.wakanow.com/manage-booking/) and [Trip.com customer support](https://www.trip.com/pages/support/). These inform booking/document/support navigation; the implementation does not claim their full product coverage, guarantees or service response times.

My Trips supports destination/reference search, booking-status filters, current itinerary dates, clear status badges and next actions. Older OTA reservations can be loaded in pages of 50; filters explicitly apply to loaded trips, while summary counts cover all the owner's reservations. Checkout and booking pages show four-step progress, payment/confirmation distinctions, offer expiry, support shortcuts and activity. Public landing/search pages keep reference FX under an expandable section. Dashboard notification links and total unread counts are supported by the regenerated API contract. The later deep review adds migration 0011; apply it before deploying these changes.

Monitor `/admin/ota` for processing, review and customer-service requests. Lists are paginated in batches of 100; page counts are not lifetime analytics. The **Requires attention** filter includes customer requests. Operators can verify pending payments and resolve customer requests with an audited note.

For an unknown outcome, inspect Duffel using the stored offer/quote, `ota_booking_id` metadata, provider request ID and time. Enter the matching `ord_…` or `bok_…` into **Verify supplier record**. The API retrieves it and checks metadata, currency and amount before confirming it or recording its cancellation. It never creates a replacement booking.

Changes/cancellations are support-managed through Duffel's dashboard/support workflow under the applicable supplier rules. Send customer refunds through Paystack after resolving supplier charges. The console can verify and record a **completed full refund** by Paystack refund ID; it checks transaction association, amount, currency, mode and processed status. It does not initiate a transfer. Partial refunds require operational tracking in Paystack and the audit/support workflow; the console does not label them as a fully refunded checkout.

Supplier refresh updates itineraries and returned ticket data and detects cancellations. Background refresh processes up to ten eligible confirmed records per minute, each eligible again after fifteen minutes. Customers may request a read-only refresh from the booking page. A supplier cancellation does not imply a customer refund.

Payment processing, supplier event processing and booking maintenance run as independent minute workers, with no overlapping run of the same stage in one process. Slow/failing stages do not block the others. Batch time budgets prevent an outage from occupying one worker for an entire backlog; an already-started provider request may finish after the budget. Refresh attempt timestamps back off failed records so they cannot monopolize the next batch. Existing bookings use their original Duffel mode and its configured token, even when the mode for new sales changes. Payment verification still requires the correct original Paystack mode.

## Pre-deployment OTA bug-review fixes

- Monetary conversion, markup and service-fee rounding use exact decimal fractions and integer kobo. Equivalent supplier amounts such as `100.0` and `100.00` compare equally; changed or malformed amounts fail closed. Admin pricing includes a server-calculated draft preview without publishing changes.
- Supplier confirmations validate resource ID, checkout metadata, supplier total/currency and supplied test/live mode before confirmation. Confirmation and its audit/outbox event commit together. If that database transaction fails, the valid returned supplier reference is retained for operator review without repeating the purchase.
- Reconciliation/refund writes are conditional and atomic with their audits. Booking revisions protect refreshes, webhook writes and browser snapshots against stale responses, including concurrent updates which leave the same status. Conflicting supplier events retry read-only reconciliation. An event cannot silently replace a different linked supplier reservation.
- Maintenance continues with new sales/search disabled. Email acknowledgments cannot swallow a newer alert; duplicate cancellation lifecycle events do not reset delivery or emit a misleading itinerary-change message for an already cancelled reservation.
- Checkout data belongs to the selected offer; old hotel-room/quote requests are aborted when the search changes. Unmounted/changed checkout views cannot redirect to an older result. Optional passport data is optional when the supplier permits it; entered passports must remain valid through the itinerary. Destination-specific entry/validity requirements still need acceptance review.
- Super-admin drafts survive background settings refetches and display an unsaved indicator. Settings include section shortcuts, a draft price calculator and a persistent save bar. Itinerary cards show times, connections, operating carrier/terminals when supplied and expandable baggage details. Print layouts omit site navigation and keep the booking header readable.
- Authenticated rate limits use the verified account rather than grouping all office/mobile-network users together. Anonymous limits remain IP-based; buckets are bounded, and throttles return Retry-After. Shared edge throttling remains a deployment requirement for multiple instances.
- `/api/readyz`, receiver activation and admin connection checks verify the required OTA schema, including 0011, so missing migration columns cannot report readiness.

Regression evidence and remaining browser/staging acceptance limits are recorded in `.ai/ota-progress.md`. The review used official [Duffel offer documentation](https://duffel.com/docs/api/offers) and [order/booking response handling](https://duffel.com/docs/api/overview/response-handling/order-and-booking-creation). No live booking, payment, refund, production migration or deployment was executed during this review.

## Supported scope and operational limits

- The flight UI supports adults and children aged 2–11, one-way/return trips and one selected offer. Infant, multi-city, seat/ancillary sales, hold orders and self-service exchanges are not exposed. Direct those requests to support.
- Hotel checkout supports prepaid balance-funded rates. Card-guaranteed, deposit, loyalty-required and pay-at-property inventory is not offered for purchase. Property-payable extras remain visible when supplied.
- Booking FX is operator-managed. A separate automatically refreshed reference feed is displayed for comparison. References never overwrite admin selling rates or saved checkout prices.
- Signed Duffel webhooks reconcile flight/hotel creation, airline changes and cancellations. Polling and explicit refresh remain available. Monitor the event inbox and Duffel dashboard for unmatched or exhausted events requiring operator reconciliation.
- Run the API continuously so maintenance can refresh reservations and deliver emails. Add shared edge rate limiting for multi-instance deployments; application burst limits are per process.
- Public local browser checks were possible without starting the live API. Authenticated booking UI and live purchase acceptance must be exercised in staging.

## Navigation for developers

- `artifacts/api-server/src/routes/ota.ts`: public search, checkout, owner access, webhooks and super-admin endpoints.
- `artifacts/api-server/src/services/ota/`: encrypted configuration, provider calls/pricing, payment fulfillment, supplier refresh and maintenance.
- `lib/db/src/schema/ota.ts`, `lib/db/drizzle/0009_ota.sql` and `lib/db/drizzle/0010_duffel_webhooks.sql`: durable ledger, audit events and supplier event inbox.
- `artifacts/raudah-travels/src/components/ota/`: shared landing/search, review, checkout, confirmation and My Trips screens.
- `artifacts/raudah-travels/src/pages/admin/AdminOta.tsx`: super-admin console.
- `artifacts/api-server/tests/ota.test.ts`: isolated PostgreSQL integration tests with mocked providers.
- `.ai/context/ota-expansion.md` and `.ai/ota-progress.md`: task context and progress memory.

Provider references: [Stays integration guide](https://duffel.com/docs/guides/getting-started-with-stays), [rate retrieval](https://duffel.com/docs/api/v2/search-result/fetch-all-rates), [quotes](https://duffel.com/docs/api/v2/quotes/create-quote), [booking response handling](https://duffel.com/docs/api/overview/response-handling/order-and-booking-creation), [Paystack refunds](https://paystack.com/docs/api/refund/).

## Exchange-rate setup and control

The local environment was configured on 2026-10-29 with initial USD, GBP, EUR, SAR and AED conversion defaults from Frankfurter's published NGN-base references, inverted into NGN per currency unit. `NGN=1` stays fixed. These defaults are used only until the super admin saves OTA rates; saved admin rates take precedence even if a fallback environment value is invalid. The helper `node scripts/configure-ota-env.cjs --mode=test --enable-flight-search --production-url=https://flyraudah.com.ng` preserves existing keys and existing rate defaults. It does not enable sales or change Paystack/database settings.

The existing Paystack key was checked read-only in Admin Settings and is live. The user then supplied a Duffel test key, which is stored in ignored private environment files. A read-only Flights access check returned 200; Stays returned 403. OTA is therefore in test mode with flight search enabled, hotel search disabled and sales disabled. Do not overwrite working live Paystack settings to test OTA payments. Use a separate staging environment with matching test credentials, or obtain a live Duffel key before considering live sales. Settings validation refuses to enable sales when modes differ.

Local `.env` uses `APP_URL=http://localhost:5173` and local Vite CORS origins. The user confirmed `https://flyraudah.com.ng`; private `.env.production` contains an OTA overlay with this APP_URL and CORS origin, production runtime mode, the supplied Duffel test key, test-mode search switches and rate defaults. Both files are ignored by Git. Preparing this file does not update hosting: import its OTA variables into the host or load it explicitly with Node's `--env-file`. Preserve the host's existing database, Clerk, encryption and Paystack secrets. The local valid encryption key was preserved and was not copied over hosting secrets.

No Duffel webhook URL/secret was supplied. Supplier status still uses the implemented polling/read-only refresh workflow. The existing Paystack webhook at `https://flyraudah.com.ng/api/payments/paystack/webhook` is for Paystack events; it is not a Duffel webhook receiver.

Reference display is on the landing page, travel search pages and OTA pricing settings. The UI checks for changes once a minute; the backend coalesces calls and caches results for `OTA_FX_REFRESH_SECONDS` (default 900). Each currency shows its source date, and stale/unavailable references are labeled. A reference outage does not change approved selling rates. Cached references older than seven days are not shown as usable data.

- `OTA_FX_REFERENCE_ENABLED=true` enables comparison data.
- `OTA_FX_PROVIDER=frankfurter` uses a no-key feed. Frankfurter publishes daily rates; this is automatically refreshed daily reference data, not a tick-by-tick market feed.
- To use an intraday provider, set `OTA_FX_PROVIDER=exchangerate_api` and put its private key in `EXCHANGERATE_API_KEY` on the server. Publication frequency depends on the chosen provider plan. The UI shows the provider's actual publication and next-update timestamps, and the cache expires at the next announced publication when sooner than the normal TTL. A suitable provider key/plan has not been supplied or configured here.
- `OTA_DEFAULT_RATES` is a JSON map of initial NGN-per-unit rates. `OTA_DEFAULT_RATES_AS_OF` records the seed date. `OTA_SUPPORT_EMAIL` and `OTA_SUPPORT_PHONE` are optional initial support defaults; admin settings override them.

Super admin workflow: open `/admin/ota` → Settings → Pricing. Compare reference and Raudah rates, optionally click **Copy references into rate draft**, edit the selling rates/markups/service fee and click **Save settings**. Copying into the draft does not publish a change. Existing saved checkouts retain their agreed price snapshots.

Reference documentation: [Frankfurter](https://frankfurter.dev/) and [ExchangeRate-API standard requests](https://www.exchangerate-api.com/docs/standard-requests).

## OTA mobile API and Developer Centre (2026-10-30)

The super-admin-only Developer Centre is at `/admin/ota-api`, linked from Travel Distribution and OTA operations. It includes a searchable endpoint reference, request/response schemas, cURL/JavaScript/Dart examples, eleven integration guides and OpenAPI/Markdown downloads. The customer contract has 23 operations under `https://flyraudah.com.ng/api/ota/v1`. The existing `/api/ota` web contract continues to use the same booking/payment implementation.

Before enabling integration key creation, apply `lib/db/drizzle/0012_ota_api_keys.sql` to the intended database using your normal SQL migration workflow. This additive migration has **not** been applied to production by this change. The console detects missing key storage; documentation and customer-session endpoints remain available. Never run the test database setup against production.

Mobile customers authenticate with their Clerk session JWT, then call `POST /me/bootstrap` to create/reuse an active travel profile from verified Clerk identity. Do not send a user ID or role, embed Duffel/Paystack credentials, or embed server search keys in a mobile binary. Booking, payment, hotel quotes and trip updates always require the signed-in customer's ownership.

Optional trusted-backend search keys are created/revoked in the Developer Centre. Select test/live mode, expiry (1–365 days), scopes (`config:read`, `flights:read`, `hotels:read`) and a 10–60 request/minute limit. Copy the secret once into the trusted backend's secret store; only its hash is stored by Raudah. Keys cannot create purchases, access customer bookings or administer the service. Their mode must match active OTA settings. Shared database counters enforce each key's limit across instances; existing user/IP limits and an edge limit still apply.

Regenerate checked-in documentation with `pnpm run docs:ota`. The source is `artifacts/api-server/src/services/ota/apiDocumentation.ts`; generated deliverables are `docs/ota-openapi.json` and `docs/OTA_MOBILE_API.md`. See the guide for secure token storage, hosted payment/app resume, timeout recovery, price/revision rules, updates, polling and launch acceptance. Native push, self-service exchanges/cancellations, infants and multi-city are explicitly outside the current API scope. Hotel access and matching payment/provider modes remain deployment requirements.
