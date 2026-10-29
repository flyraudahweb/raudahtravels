# OTA expansion context

Started 2026-10-29 at the user's request. Expand Duffel across public flight/hotel booking, landing search, user trips and a super-admin-only OTA management console. Preserve the Hajj/Umrah business flows and brand. Work in this checkout; do not run live bookings, charges or production migrations while developing.

## Confirmed provider capabilities

- Duffel Flights supports offer search/retrieval and orders funded from the organisation's Duffel balance.
- Duffel Stays supports search, complete room rates, final quotes and accommodation bookings. The account must request Stays access.
- Stays booking creation must not be retried after an ambiguous provider/network error. Hold the booking for operator reconciliation.
- References: https://duffel.com/docs/guides/getting-started-with-stays, https://duffel.com/docs/api/v2/search-result/fetch-all-rates, https://duffel.com/docs/api/v2/quotes/create-quote, https://duffel.com/docs/api/v2/bookings, https://duffel.com/docs/api/overview/response-handling.

## Design and correctness decisions

- Replace demo purchase paths with real provider results and explicit unavailable/error states.
- Persist a server-priced checkout and traveller details before Paystack redirect. Bind payment reference, currency, amount and owner to that checkout.
- Require sign-in before purchase; public search remains available. Only super_admin can manage OTA settings or inspect all OTA bookings.
- Use a dedicated durable OTA checkout ledger. A conditional database state transition claims fulfillment once; ambiguous provider writes go to manual reconciliation without automatic retry.
- Use encrypted Duffel credentials, explicit sandbox/live mode, configurable currency conversion and markups, no fallback tokens.
- Never trust client amounts, payment success flags or confirmation placeholders.
- Treat provider confirmation, customer payment and ticket document availability as separate facts.

## Progress

Latest UI work: the user's supplied Trip.com screenshots guided interaction/layout only. Shared `SearchPickers.tsx` provides popular destinations plus worldwide Duffel suggestions, responsive calendar dates, traveller steppers, child age selectors and hotel room/destination selection. `TravelSearchForm.tsx` is used on the landing, flight/hotel entry and results pages. Raudah indigo/orange, package links, market references, booking conditions, checkout routes and supported passenger categories are retained.

`FlightResults.tsx` renders comparison rows, actual airline/stops/budget/departure filters, shortest/lowest sorting, nearby-date search shortcuts, and a route-specific loading dialog over skeleton results. Nearby-date prices are not fabricated; unqueried dates explicitly say Check fares. Search cancellation aborts the client request, repeated identical searches work, and stale aborted results/errors cannot replace the active search. Selected airport names survive navigation via display-only URL labels; supplier requests still use IATA codes. Calendar code is lazy-loaded, and the existing calendar primitive's CSS variable sizes were corrected for Tailwind 4. Read the progress log for verified browser scope.

The implementation lives in `artifacts/api-server/src/services/ota/`, `artifacts/api-server/src/routes/ota.ts`, the frontend `components/ota/` directory and `pages/admin/AdminOta.tsx`. The additive migration is `lib/db/drizzle/0009_ota.sql`. Public routes use the `/api/ota` contract; unsafe legacy travel API routes return 410. Fulfillment uses a PostgreSQL webhook inbox with database-clock leases and conditional booking claims. All new timestamps are timezone-aware.

See [OTA progress memory](../ota-progress.md). Initial project navigation is in `docs/PROJECT_INDEX.md`.

## FX and environment follow-up

Latest correction: user explicitly requested sandbox flight search enabled by default. New test installations now enable flight search unless disabled in saved admin settings or explicitly through the environment; live-mode installations remain opt-in. Initial selling-rate defaults approved on 2026-10-29 are USD 1344.79, GBP 1791.60, EUR 1500.71, SAR 358.62 and AED 366.18 NGN per unit. Existing admin rate maps remain authoritative. These are initial operator-editable prices, not automatically synchronized market rates.

Applied the requested rates and sandbox flight flag in the configured database, with a `sandbox_defaults_configured` audit event and no credential/payment changes. The deployed API confirmed the new settings and returned 17 LOS–LHR sandbox offers in NGN. The initial hypothesis that the host lacked the test credential was disproved by these provider responses; no token replacement or hosting login was necessary. Saving non-secret admin settings no longer copies hosting-managed credentials into the database or requires an encryption key for those unchanged credentials; newly edited credentials still require encryption. See progress for tests.

The user requested environment configuration plus a live comparison feed, while keeping super-admin control of selling rates. Local `.env` was updated without displaying/replacing existing secrets. Existing database Paystack settings are live and remain unchanged. The user subsequently supplied a Duffel test key, stored privately: Flights check returned 200, Stays 403. OTA mode is test, flight search is enabled, hotels/sales disabled. Saved admin OTA settings were absent at the read-only check. Environment defaults seed five current conversion rates until explicitly overridden in admin. Save validation prevents enabling sales if payment modes differ.

`services/ota/exchangeRates.ts` fetches dated reference observations, inverts NGN-base values, coalesces/caches requests and labels outages/stale data. Frankfurter is the active no-key daily feed. Optional ExchangeRate-API support accepts a server-side key for a provider plan with more frequent updates; no such key was supplied. `components/ota/ExchangeRates.tsx` shows references separately from approved rates. Importing references only edits an admin draft; Save settings is required to publish.

The user confirmed `https://flyraudah.com.ng`. Ignored `.env.production` holds the OTA-only hosting overlay; local development origins remain in `.env`. Hosting has not been changed. Preserve existing database/Clerk/encryption/Paystack secrets when applying the overlay. Never print `.env`, API tokens or encryption keys.

## Duffel admin/webhook follow-up

The user explicitly authorized selecting and creating required webhooks. Super-admin settings now contain separate encrypted test/live API tokens, signing secrets, webhook IDs, eight implemented event selections, management controls and a durable event inbox. Admin Settings links to the OTA console only for super admins; the API enforces the same role.

Created test webhook `end_0000BBuI8vsP5N3Th5YT7w` at `https://flyraudah.com.ng/api/ota/duffel/webhook/test`, confirmed inactive. Its one-time secret and ID were saved in ignored `.env` and `.env.production`. The deployed app still lacks the new receiver. Migration `0010_duffel_webhooks.sql` has NOT been applied to the configured database. Deploy the code, apply 0010 and import the private signing configuration; send a signed ping from admin and then activate. Activation requires a recent verified ping with the current signing key.

The selected events cover order creation/failure, airline changes, cancellation creation/confirmation and Stays creation/failure/cancellation. Payment, credits, cars and assistant events are excluded. Receiver validates raw-body HMAC/timestamp/mode and durably deduplicates deliveries. Worker fetches fresh supplier records, checks booking/payment ownership and amounts, never creates purchases, preserves refunded states and displays supplier notices. Unmatched events remain visible for operator review. Polling continues as fallback.

## Dashboard updates and UX follow-up

User requested important webhook outcomes across dashboards plus a simpler travel experience comparable to established OTAs. Implemented durable owner notifications and urgent super-admin operations alerts via the existing notifications table, safe owner-only activity timelines, explicit customer support responses, all-record super-admin operations/queue overview and booking deep links. Agents see only their own OTA purchases through new portal entries. No role access was broadened to other customers' bookings or credentials.

New backend `services/ota/bookingUpdates.ts` publishes missing deterministic notification IDs from the audit ledger in batches; maintenance must run continuously. Raw/internal event details are excluded from public timelines. User/agent/admin overviews and My Trips poll updates; booking pages refresh confirmed records too, so later cancellations/itinerary changes become visible. Support responses use an explicit `customerMessage` field; historical notes stay private.

Shared BookingPresentation, TravelUpdates and OtaOperationsSummary components simplify statuses, progress, next actions and role-specific alerts. My Trips adds search/status filters, dates and clear actions. Checkout adds progress; booking view adds payment summary, activity and support shortcuts. Landing adds Manage My Trips and collapses reference FX. Keyboard selection/escape/blur behavior was added to airport suggestions. Deployment gates from the prior webhook task remain; no new schema migration was needed for this follow-up.

## Deep OTA review and design polish

The user explicitly requested a deep OTA bug review with fixes and professional UI before deployment. Fixes include exact decimal pricing, conditional/atomic operator reconciliation and refund audits, validated supplier confirmations with atomic confirmation/outbox writes, revision-protected supplier/UI updates, cancellation-notification deduplication, safe email acknowledgment, optional/valid-through-itinerary passports, stale search/checkout request cancellation, owner history pagination and accurate totals, account-based authenticated throttles, draft-preserving admin settings and a server-side price preview.

**New required migration:** `lib/db/drizzle/0011_ota_revision.sql` adds `revision` and `sync_attempt_at` to bookings. Apply after 0009 and 0010 before deployment; it has NOT been run against the configured database. All material booking writes increment revision. Supplier/admin updates compare the captured revision; webhook conflicts retry without purchasing. Customer snapshots keep the highest revision for that booking. Notification delivery metadata and sync-attempt claims intentionally do not increment the material revision.

Existing bookings use their original Duffel mode/token when fulfilling, refreshing or reconciling. Background stages run independently with per-stage overlap prevention and batch budgets. Failed refreshes back off and no longer starve other reservations. No automatic supplier purchase retry was introduced. Readiness, activation and admin diagnostics require the new columns.

Design changes: clearer itinerary cards with local times, route line, duration/stops and expandable details; operating carrier/terminals/baggage when provided; calmer booking header and print styling; fewer duplicate admin metrics, section shortcuts and sticky Save bar. Temporary sample-only QA files were removed after browser tooling timed out. They are not part of the product. Browser/mobile/authenticated purchase acceptance remains a staging gate; tests/build results are recorded in the progress log.

## Payment isolation and concurrency security follow-up

User requested assurance against payment leakage and race conditions. Do not claim zero vulnerabilities or production certification. Reviewed the OTA flow together with the shared legacy Paystack verifier/webhook, since a successful OTA transaction must never credit another booking flow.

Added shared canonical payment proof binding (reference, amount in kobo, NGN, mode, booking, purpose, and package payer). Generic verification requires a unique stored online-payment record; duplicate historical references fail closed for operator reconciliation. Manual submissions/approvals cannot mint online or wallet credits. Admin online verification now calls Paystack verification, and wallet approval requires its actual debit workflow.

Legacy webhooks reject missing keys/forged signatures, verify the canonical provider transaction, and acknowledge only after the financial database commit. Failed events cannot downgrade verified credit. Payment rows and booking balances serialize concurrent settlement; wallet top-ups lock/recheck both outstanding balance and wallet funds and roll back losing debits. Transactional visa work uses the same database transaction to avoid pool exhaustion. OTA payment initialization compares the original status/revision before returning a newly saved redirect.

Completed refund reconciliation accepts canonical success/reversed states, but ticket/hotel fulfillment accepts success only. Decimal-string provider IDs compare losslessly, and unsafe numeric IDs fail closed. Supplier money POSTs use a 135-second timeout and retain the existing no-automatic-repurchase rule for ambiguous outcomes. Browser payment mutations require a configured origin when an Origin header is present; sensitive payment responses are not cached.

No additional schema migration was added in this follow-up. Existing pending 0010/0011 migrations, receiver deployment/activation, matching provider modes/access/funds and staging acceptance remain required. See the latest progress section for exact test results and the Windows registration-suite teardown limitation.
