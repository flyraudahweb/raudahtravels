# OTA and mobile API launch readiness

Verified 2026-10-30 through source review, read-only database inspection, public deployed endpoint checks and Duffel test-account discovery requests. No customer profile, booking, payment, refund, webhook activation or hosting setting was changed.

## Working now

- Deployed `GET /api/healthz`: 200.
- Deployed `GET /api/readyz`: 200, ready.
- Deployed `GET /api/ota/config` and `GET /api/ota/v1/capabilities`: 200. Mode test, flight search enabled, hotel search and online checkout disabled.
- Deployed `GET /api/ota/v1/places?q=Lagos`: 200, 15 suggestions.
- Deployed `POST /api/ota/v1/flights/search`: LOS–LHR, one adult, departure 35 days ahead returned 200 and 76 sandbox offers, all with positive integer server-priced NGN totals. These are test offers, not proof of production ticket issuance or Nigerian domestic coverage.
- Unauthenticated `GET /api/ota/v1/me`: 401 as required.
- `GET /api/ota/v1/admin/settings`: 404; operator routes are not exposed through the mobile customer surface.
- Configured project database contains the OTA booking, audit, payment-job, supplier-inbox and API-key tables, including booking revision and refresh-attempt columns. No missing OTA migration was detected through 0012. Deployed receiver independently reports storage ready.
- Approved NGN selling-rate map contains NGN, USD, GBP, EUR, SAR and AED.

## Blocking hotel booking

- A discovery-only request to `/stays/search` using the supplied Duffel test credential returned **403**, without creating a reservation. This credential currently cannot perform the tested Stays search; confirm organisation/product entitlement with Duffel.
- Hotel search is disabled in saved OTA settings. Enable only after Stays access and the search → rates → quote → booking workflow have been validated in the intended environment.
- The current implementation supports prepaid balance-funded Stays rates, not every possible hotel payment model.

## Blocking flight/hotel payments

- OTA/Duffel are in **test** mode; the configured Paystack secret is **live**. Existing validation correctly refuses this combination for sales.
- Online checkout is disabled.
- Travel support email and phone are blank. A support email is required by sales validation; configure an operator-approved address rather than inventing one.
- Choose a separate staging environment with matching test provider/payment settings for purchase acceptance. Do not replace the shared site's working live Paystack settings to test OTA.
- Live release needs a live Duffel credential, relevant product entitlement, adequate provider funds, matching live Paystack settings and completed staging acceptance. Test search success does not verify these.

## Blocking supplier webhook delivery

- The existing Duffel test webhook is present and **inactive**.
- Deployed receiver `GET /api/ota/duffel/webhook/test` returns 200, `storageReady: true`, `signatureConfigured: false`.
- The corresponding secret and webhook ID are present in private local environment configuration but are not installed on the deployed receiver.
- Install the matching secret on hosting, preserving the existing `SETTINGS_ENCRYPTION_KEY`. Alternatively save through super-admin settings only when the deployed encryption key is known to be correct. Do not guess or replace that encryption key, or create a duplicate webhook to work around this issue.
- Send a ping, wait for a signature-verified delivery and then activate using the super-admin controls. Verify worker processing and customer updates afterwards.

## Code fixes prepared in this review

- Super-admin Check connections now distinguishes missing PostgreSQL tables/columns from connectivity/permission failures; it no longer directs operators to rerun migrations for every database failure.
- Diagnostics include optional API-key storage, current mode/switches, callback origin, support contact, signing-secret presence and payment-mode matching. They explicitly distinguish accepted flight credentials from Stays entitlement and purchase funding.
- Hosted callback validation now requires a complete HTTPS origin. Malformed URLs, embedded credentials, paths, queries and fragments are rejected when enabling sales, creating checkout and initializing payment. Payment initialization uses the validated origin.
- Added regression coverage for these diagnostics, super-admin access, secret redaction and invalid callback handling.
- These code fixes are local until committed/pushed and successfully deployed. They do not change any hosting or supplier settings.

## Mobile implementation still required

The customer API, OpenAPI contract and client starter are implemented. A finished native app is not included. Implement Clerk sign-in and verified-profile bootstrap, secure token storage, screens and account isolation, hosted-payment browser return/resume, saved booking recovery and actual iOS/Android acceptance.

First-party mobile customers use Clerk session JWTs. The optional super-admin-created search keys are for trusted servers, not mobile binaries and not customer booking access.

API capability flags explicitly exclude infants, multi-city, ancillary sales, native push and self-service exchanges/cancellations. Changes/cancellations use support requests. These are product extensions rather than prerequisites for the supported basic booking flow.

No Tiqwa, Wakanow or other Nigerian domestic supplier integration has been implemented. Supplier research is separate from current functionality. Confirm an account, contract, exact airline coverage and API specification before adding an adapter.

## Acceptance still outstanding

1. Signed-in deployed web/mobile profile bootstrap, owner-only bookings and denied cross-account/operator access with real sessions.
2. Matching-mode staged payment → verified payment → exactly one supplier purchase → issued ticket/hotel confirmation → customer document retrieval.
3. Declines, duplicate callbacks, concurrent attempts, stale quotes, price changes, process interruption and unknown supplier outcomes. Never retry an uncertain supplier purchase automatically.
4. Verified supplier events, worker recovery, booking updates, notification/email delivery and support response.
5. Staged cancellation/refund reconciliation. A cancelled supplier booking must not be displayed as a completed customer refund without payment evidence.
6. Confirmed operating support contacts, reconciliation procedures and suitable edge throttling.

## Local verification

- 145 tests passed across 13 suites, covering OTA integration, mobile contracts/client assets, UI state/navigation, worker isolation, payment proofs, signatures, FX and related connection/extraction behaviour.
- The existing registration integration suite was excluded because of its separately documented Windows setup/cleanup issue; this is not a claim that every repository test passed.
- The first sandboxed run encountered Windows temporary-file/PostgreSQL permissions errors. The subsequent isolated test run with normal local child-process access passed.
- Workspace TypeScript checks, including the mobile client, and both API/frontend production builds passed. The frontend retains existing nonfatal NODE_ENV, sourcemap and large-chunk warnings.

See [deployment operations](OTA_DEPLOYMENT.md), [mobile API contract](OTA_MOBILE_API.md) and [provider comparison](research/OTA_PROVIDER_COMPARISON_2026-10-30.md).
