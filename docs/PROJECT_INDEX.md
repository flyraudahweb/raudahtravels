# Project index

Code navigation map refreshed from source on 2026-11-12. Paths below are relative to the repository root. The working tree contains both committed OTA functionality and pending EHajj work. Deployment and production database state need their own checks.

## Development checkpoint

- Local `main` and its recorded `origin/main` point to `a3e6ea6`, the Duffel confirmation and live-checkout fixes pushed on 8 November. This pass inspected local Git state without fetching the remote.
- The public homepage/package redesign, shared OTA search and booking screens, `/app` starter and mobile API developer centre are committed.
- EHajj release c688f78 is pushed to main. It includes the admin workspace, API client/routes, encrypted connection settings, product grants, migration `0013_ehajj.sql`, tests and integration notes. The 12 November continuation adds the provider's combined registration/first-payment submission and bank lookups. The workflow is independent of Paystack. HTTPS activation, provider currency/unit confirmation and customer document delivery remain pending. Read the [integration review](integrations/EHAJJ_INTEGRATION_REVIEW.md) and [endpoint index](integrations/EHAJJ_API_INDEX.json).
- A separate uncommitted Vite change uses `FRONTEND_PORT`/`VITE_PORT` for the browser server and process `PORT` for the API proxy, falling back to 8081. The API itself defaults to 8080. Align these values before starting development.
- The [launch review](OTA_LAUNCH_READINESS.md) records the latest environment checks from 8 November. At that time checkout/hotels were disabled, support email and webhook signing configuration were missing, Stays search returned 403 and the test webhook was inactive. These observations have not been repeated during this indexing pass.

## Purpose and stack

Raudah Travels & Tours is a Nigerian Hajj/Umrah operations and booking platform. It combines a public website, pilgrim dashboard, agent portal, staff/admin console, flight booking, hotel booking, and messaging-based AI registration.

The pnpm workspace uses TypeScript, React 19.1, Vite 7, Tailwind 4, Radix/shadcn components, Wouter, TanStack Query 5, Express 5, PostgreSQL, Drizzle, Clerk and Zod 3. Package manifests and `pnpm-workspace.yaml` are the version references. Older descriptions in `project.md` use different versions and incomplete table counts.

## Repository map

- `artifacts/raudah-travels/`: main React application; `src/pages/` groups public, auth, dashboard, agent, admin, flights and hotels screens.
- `artifacts/api-server/`: Express API, route handlers, integration clients, registration services, tests and build script.
- `lib/db/`: PostgreSQL pool, Drizzle schemas, SQL migrations and schema management commands. The current working tree has 47 `pgTable` declarations across 24 schema modules, including three pending EHajj tables. Source counts do not establish which tables exist in production.
- `lib/api-spec/`: OpenAPI contract and Orval code generation configuration.
- `lib/api-client-react/`: generated API functions/React Query hooks and handwritten `src/custom-fetch.ts`.
- `lib/api-zod/`: generated runtime validation schemas.
- `artifacts/mockup-sandbox/`: separate UI prototyping application.
- `scripts/`: verification, setup and document-generation utilities.
- `docs/`: deployment, AI registration, email/OAuth and staff documentation.
- `.ai/`: historical project context, sprint notes and session logs. Useful background; reconcile claims against current source.
- `security_findings/`: earlier audit material; historical completion claims do not establish current security.
- `attached_assets/`, `backups/`, `scratch/`, proposal directories and root scratch scripts: supporting material outside the main application flow. Some scripts perform database writes; inspect before executing.

## Entry points and request flow

1. `artifacts/raudah-travels/src/main.tsx` mounts `App.tsx`.
2. `App.tsx` installs Clerk, React Query, profile synchronization and the top-level Wouter routes.
3. Portal route/layout components are `pages/dashboard/UserDashboard.tsx`, `pages/agent/AgentPortal.tsx` and `pages/admin/AdminConsole.tsx`. Flight and hotel routing lives in each module's `index.tsx`.
4. Screens use both generated hooks and handwritten `fetch` calls. Inspect both when changing API behavior. Browser requests use the Clerk session; generated fetch also supports an optional bearer-token getter.
5. Development Vite proxies `/api` to the local API. Check the pending Vite port change described above.
6. API `src/index.ts` loads environment configuration before importing the application, checks registration readiness, initializes defaults/storage, starts the channel worker and schedules registration maintenance.
7. API `src/app.ts` installs request logging, Clerk proxy support, Helmet, CORS, body parsing with raw-body capture and Clerk middleware. It mounts `/api/ota/v1`, then the shared `/api/ota` router, returns HTTP 410 for retired `/api/flights` and `/api/hotels`, then mounts `src/routes/index.ts` beneath `/api`.
8. Route handlers access `@workspace/db`, which exports a node-postgres pool, Drizzle client and schema. Many business operations remain directly in route files.
9. In production, Express also serves `artifacts/raudah-travels/dist/public` with a SPA fallback. Launch from the repository root because static paths resolve from the working directory.

## Feature navigation

- [OTA flight supplier architecture and onboarding](integrations/OTA_FLIGHT_SUPPLIERS.md)

### Identity and permissions

- Frontend auth: `src/App.tsx`, `src/pages/auth/` and each portal layout.
- API identity synchronization: `artifacts/api-server/src/routes/auth.ts`.
- User records: `lib/db/src/schema/profiles.ts`; staff permissions are in `schema/agents.ts`.
- Authorization is implemented in individual routers/handlers. `routes/admin.ts` has a router-level guard; role behavior should be checked per endpoint rather than inferred from a UI route or a role name.
- Clerk proxy support exists server-side, while historical `.ai/memory.md` warns against enabling the proxy on Railway. Inspect the deployment configuration before changing auth routing.

### Packages and bookings

- UI: `pages/public/Packages.tsx`, `PackageDetail.tsx`, `pages/dashboard/BookingWizard.tsx`, `pages/admin/AdminBookPilgrim.tsx`, `AdminBookingForm.tsx`, `pages/agent/AgentClients.tsx`.
- API: `routes/packages.ts`, `bookings.ts`, `agents.ts`, `admin.ts`.
- Shared booking creation: `services/registration/RegistrationService.ts`; it locks the package row and performs related writes transactionally.
- Shared transaction context: `services/registration/database.ts` uses AsyncLocalStorage so nested registration operations use the caller's transaction.
- Agent registration also contains its own booking/wallet transaction paths in `routes/agents.ts`. Booking logic is not fully centralized.
- Data: `schema/packages.ts`, `package-dates.ts`, `package-accommodations.ts`, `bookings.ts`, `booking-form-fields.ts`.
- Configurable fields: `hooks/useFormFieldConfig.ts`, admin form builder, public booking-field endpoint and `utils/init-db.ts` defaults.

### Payments and agent finances

- `routes/payments.ts`: Paystack initialization, verification and webhook handling; bank/manual payment verification; booking balances and related visa/receipt work.
- `routes/agents.ts` and `routes/admin.ts`: wallet operations, agent discounts, commissions and administration.
- `schema/payments.ts`, `schema/agents.ts`, `schema/bookings.ts`: financial records and their booking associations.
- `utils/email.ts`, `utils/notify.ts` and frontend `utils/printReceipt.ts`: delivery and receipt helpers.
- Financial changes require checking all entry paths: direct bookings, staff bookings, agent registration, wallet payments and provider callbacks.

### Passports, visas, documents and support

- `components/PassportScanner.tsx`, `BatchPassportUpload.tsx`: passport intake/cropping UI.
- `routes/ai.ts` and `services/passport/PassportExtractionService.ts`: AI extraction paths; the service supports Gemini/Mistral handling.
- `routes/upload.ts`, `documents.ts`, `admin.ts`, `dashboard.ts`: uploads, documents, visa operations and dashboard access.
- Storage includes local upload paths and R2 integration (`src/lib/r2.ts`); check the specific workflow when changing media access or retention.
- `routes/support.ts`, `notifications.ts`, and admin chat endpoints handle support, notifications and staff conversation.

### WhatsApp/Telegram AI registration

- Webhook routes: `routes/whatsapp.ts`, `routes/telegram.ts`.
- `services/channels/`: channel adapters, media handling, rate limiting and durable channel queue/worker.
- `services/registration/RegistrationAgentService.ts`: inbound conversation processing, passport intake, data collection and review submission.
- `ConversationService.ts`, `DuplicateDetectionService.ts`, `validation.ts`, `normalizers.ts`: session state, deduplication and input handling.
- `routes/ai-registration.ts`: staff review, editing, approval/rejection and queue controls.
- `config.ts`, `readiness.ts`, `ConnectionChecks.ts`, `RetentionService.ts`: encrypted configuration, readiness checks, connection diagnostics and retention cleanup.
- UI: `pages/admin/AdminAiRegistrations.tsx`, `components/admin/RegistrationAgentSettings.tsx`.
- Data/migrations: `schema/ai-registration.ts`, `drizzle/0007_ai_registration.sql`, `0008_ai_registration_reliability.sql`.
- Flow: webhook -> queued channel work -> conversation/extraction -> pending staff review -> booking creation on approval -> queued outcome notification.
- Enabling this feature adds startup requirements for private R2 storage, a configured channel, valid limits and required database objects. Production also requires HTTPS `APP_URL`.

### Flights and hotels

- Shared UI lives in `components/ota/`. `pages/flights/index.tsx` and `pages/hotels/index.tsx` route search, checkout and confirmation to shared components. `TravelSearchForm.tsx`, `SearchPickers.tsx`, `SearchPopoverContent.tsx`, `FlightResults.tsx`, `TravelCheckout.tsx` and `TravelBooking.tsx` own the customer flow. Saved bookings use `/travel/bookings/:id`; dashboard and agent My Trips use `MyTravelTrips.tsx`.
- API entry is `routes/ota.ts`; `services/ota/provider.ts` supplies Duffel v2 requests, price calculations and supplier validation. Flights use offers and balance-funded instant orders. Hotels use search, fetched rates, quote and balance-funded prepaid booking. Deposits, card-only and pay-at-property rates are excluded from online purchase.
- `services/ota/booking.ts` verifies Paystack evidence and atomically claims fulfillment before the supplier purchase. State progresses from `payment_pending` through `processing` to `confirmed` or `requires_review`, with cancellation and verified full-refund states. An ambiguous supplier response stays available for reconciliation. `revision` guards competing state updates.
- `paymentQueue.ts`, `duffelWebhooks.ts`, `maintenance.ts` and `bookingUpdates.ts` implement durable payment jobs, signed/deduplicated supplier notifications, recovery, owner updates and email delivery. Startup launches the maintenance stages independently.
- Data is in `schema/ota.ts` and `ota-api-keys.ts`. The old `flight-bookings.ts`, `hotel-bookings.ts` and legacy frontend components remain in source. Their presence does not identify the active purchase engine. The old API routes return 410 and `src/lib/duffel.ts` is a compatibility stub.
- Super Admin manages credentials, pricing, channels, webhooks and reconciliation at `/admin/ota` through `pages/admin/AdminOta.tsx`. API checks the role independently. `config.ts` supports encrypted test/live credentials and editable selling rates. Preserve `SETTINGS_ENCRYPTION_KEY`.
- `exchangeRates.ts` fetches dated market references, using Frankfurter by default or optional ExchangeRate-API configuration. Approved admin rates price checkout. References have a provider schedule and cache, so the default feed supplies daily observations.

### Mobile API and app starter

- `/app`, `/app/login` and `/app/signup` are a responsive web starter in `pages/app/TravelApp.tsx`. It uses Clerk, real package reads and the shared OTA search, continuing into existing web checkout. See [app scope](OTA_APP_STARTER.md).
- `services/ota/mobileRoutes.ts` and `mobileApiPaths.ts` expose 23 customer operations under `/api/ota/v1`. Owner actions require a Clerk session and an active profile. Optional hashed, scoped, expiring/revocable search keys serve trusted backends. Mobile clients use customer authentication.
- `/admin/ota-api` is the Super Admin developer centre in `pages/admin/AdminOtaApi.tsx`. Contract source is `services/ota/apiDocumentation.ts`; `apiDeveloperTools.ts` and `mobileClientAssets.ts` supply protected download assets. Run `pnpm run docs:ota` after changing the OTA contract to refresh `docs/ota-openapi.json`, the integration guide, Postman files and typed mobile client/declarations. See [mobile API](OTA_MOBILE_API.md) and `docs/mobile/README.md`.
- Native packaging, device acceptance, push, deep links, infants, multi-city, paid extras and self-service changes/cancellations remain outside the supported starter. Customer service requests provide the current support workflow.

### Public design and package discovery

- `pages/public/Home.tsx`, `Packages.tsx`, `PackageDetail.tsx` and `components/packages/PackageCard.tsx` implement the current package discovery and booking entry points.
- Home uses the shared OTA widget with Flights, Hotels and Packages. Slideshow/aircraft settings use the public `landing_hero` setting and `services/landingHero.ts`. Admin page edits control the switches. The public slideshow controls are hidden.
- The design follows the supplied Nusuk/Trip.com layout references while using Raudah colours, content and existing booking actions. See [design implementation](NUSUK_UI_IMPLEMENTATION.md).

### EHajj integration pending publication

- `routes/ehajj.ts`, `services/ehajj.ts`, frontend `lib/ehajj.ts` and `pages/admin/AdminEhajj.tsx` implement `/admin/ehajj`. The current route index mounts EHajj before the broad admin router.
- Super Admin configures credentials and grants. Selected active admins/staff get per-product access with separate pilgrim, operations, finance and document-metadata permissions. Detail requests verify upstream roster membership.
- Connection base comes from `EHAJJ_API_BASE_URL`. Agency key and manually supplied provider JWT are encrypted in dedicated connection storage. The two key-only reads list products/rosters; the remaining seven also need the provider JWT.
- `0013_ehajj.sql` creates `ehajj_connections`, `ehajj_grants` and `ehajj_registrations`, and is registered in the journal. The migration was applied to the configured shared database on 12 November. The continuation added standalone registration storage to the earlier two-table SQL.
- `services/ehajjRegistrations.ts` prepares and submits standalone multipart `addPelerin` registrations with staff-entered pilgrim details and first payments. Currency is explicitly declared and the amount is sent unchanged. Encrypted drafts, a passport/package fingerprint and versioned submission claims protect recovery and concurrency.
- EHajj operates independently of FlyRaudah booking, Paystack and wallet ledgers. Later installments, token issuance/refresh, signed fulfillment callbacks and protected customer file delivery await further provider contracts.

## Local commands and deployment

Use Node 24 and pnpm 10 to match `.github/workflows/registration.yml`. The inspected machine reports Node 24.11.1 and pnpm 10.33.0.

```sh
pnpm install --frozen-lockfile
pnpm run dev:api
pnpm run dev:frontend
pnpm run typecheck
pnpm --filter @workspace/api-server test
pnpm run build:api
pnpm run build:frontend
pnpm --filter @workspace/api-spec run codegen
```

Run the API and frontend development commands in separate terminals. API defaults to port 8080 and frontend to 5173. Check the pending local proxy configuration before starting. Root `pnpm run dev` wraps both with `npx concurrently`; concurrently is not declared in the root manifest.

Start configuration from `.env.example`. Core dependencies are PostgreSQL and Clerk; `VITE_CLERK_PUBLISHABLE_KEY` must exist before the frontend build. Optional integrations include Paystack, Duffel, AI providers, R2, messaging channels and email. Some credentials/settings live in the database rather than environment variables. `SETTINGS_ENCRYPTION_KEY` must remain stable for saved encrypted registration credentials.

`pnpm run db:push` directly changes the database schema; it is not a read-only setup check. Migration files also exist in `lib/db/drizzle/`, and a dedicated AI registration migration script exists in the API package. Historical project notes recommend the Neon SQL Editor for large migrations affected by Windows connection resets.

`railway.toml` and `render.yaml` both build through `render-build.sh` and launch `artifacts/api-server/dist/index.mjs` from root. `/api/healthz` is liveness; `/api/readyz` checks the database and relevant registration schema. Configuration files show deployment support, not which host is currently active.

## Contracts and verification

- Core API contract workflow uses `lib/api-spec/openapi.yaml` and Orval codegen. OTA maintains its own contract source and export command described above. Additional handwritten endpoints exist, so inspect runtime routes too.
- CI runs dependency installation, codegen, workspace typechecking, API tests, API build and frontend build.
- Sixteen test files currently cover registration/connections/extraction, payment proofs, Duffel signatures, FX, OTA integration/readiness/workers/contracts/developer assets, search/navigation/state, app starter and public design. `ota.test.ts` also contains the pending EHajj integration tests.
- Integration suites use disposable PostgreSQL and provider mocks. Earlier Windows registration setup/cleanup failures are documented in progress notes. The latest 8 November verification ran 131 tests across nine suites, then 94 booking/worker tests after the email update, with API typecheck/build passing. Those are historical results.
- This 12 November pass refreshed code navigation and memory. Runtime tests and deployed checks belong to subsequent development verification.

## Resume points

- For OTA release work, start with `OTA_LAUNCH_READINESS.md`, current Admin diagnostics, provider/payment credentials and staging acceptance. A successful build or flight search alone does not establish live booking readiness.
- For EHajj, resolve HTTPS transport, confirm provider package/currency/accounting details, and verify the deployed standalone registration workspace. The new addPelerin contract covers registration and its first payment.
- For UI work, use the current shared search/checkout components and package card, and preserve existing owner/session and route-state handling.
- For payment changes, inspect both OTA and package ledgers plus all agent wallet paths. They are separate booking domains sharing Paystack evidence validation.
- Earlier descriptions in `project.md`, `.ai/context/architecture.md` and sprint/session notes contain outdated counts and pre-OTA route behaviour. This refreshed map and runtime source should guide new navigation.
