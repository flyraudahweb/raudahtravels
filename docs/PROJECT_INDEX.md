# Project index

This is the baseline inspection before the OTA expansion. For the current Duffel flight/hotel implementation, resolved demo/security concerns, and deployment requirements, read [OTA deployment and operations](OTA_DEPLOYMENT.md).

Code-grounded navigation map, inspected 2026-10-29. Paths below are relative to the repository root. This index describes the checked-out implementation; it does not establish the state of any live deployment.

## Purpose and stack

Raudah Travels & Tours is a Nigerian Hajj/Umrah operations and booking platform. It combines a public website, pilgrim dashboard, agent portal, staff/admin console, flight booking, hotel booking, and messaging-based AI registration.

The pnpm workspace uses TypeScript, React 19.1, Vite 7, Tailwind 4, Radix/shadcn components, Wouter, TanStack Query 5, Express 5, PostgreSQL, Drizzle, Clerk and Zod 3. Package manifests and `pnpm-workspace.yaml` are the version references. Older descriptions in `project.md` use different versions and incomplete table counts.

## Repository map

- `artifacts/raudah-travels/`: main React application; `src/pages/` groups public, auth, dashboard, agent, admin, flights and hotels screens.
- `artifacts/api-server/`: Express API, route handlers, integration clients, registration services, tests and build script.
- `lib/db/`: PostgreSQL pool, Drizzle schemas, SQL migrations and schema management commands. There are 39 `pgTable` declarations across the schema files at inspection time.
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
5. Development Vite proxies `/api` to `http://localhost:8080`.
6. API `src/index.ts` loads environment configuration before importing the application, checks registration readiness, initializes defaults/storage, starts the channel worker and schedules registration maintenance.
7. API `src/app.ts` installs request logging, Clerk proxy support, Helmet, CORS, body parsing and Clerk middleware. It mounts flight/hotel routers and then `src/routes/index.ts` beneath `/api`.
8. Route handlers access `@workspace/db`, which exports a node-postgres pool, Drizzle client and schema. Many business operations remain directly in route files.
9. In production, Express also serves `artifacts/raudah-travels/dist/public` with a SPA fallback. Launch from the repository root because static paths resolve from the working directory.

## Feature navigation

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

- Flights: `pages/flights/`, `components/flights/`, `routes/flights.ts`, `src/lib/duffel.ts`, `schema/flight-bookings.ts`. Duffel provides flight offers/orders; Paystack handles payment. GBP-to-NGN conversion currently uses a fixed source-code rate.
- Hotels: `pages/hotels/`, `routes/hotels.ts`, `schema/hotel-bookings.ts`. Search uses hardcoded demo hotel inventory, with bookings persisted to PostgreSQL; no live bedbank integration is present in this route.

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

Run the API and frontend development commands in separate terminals. API defaults to port 8080; frontend defaults to 5173. Vite reads the process-level `PORT`, so ensure the frontend's process does not inherit `PORT=8080`. Root `pnpm run dev` wraps both with `npx concurrently`; concurrently is not declared in the root manifest.

Start configuration from `.env.example`. Core dependencies are PostgreSQL and Clerk; `VITE_CLERK_PUBLISHABLE_KEY` must exist before the frontend build. Optional integrations include Paystack, Duffel, AI providers, R2, messaging channels and email. Some credentials/settings live in the database rather than environment variables. `SETTINGS_ENCRYPTION_KEY` must remain stable for saved encrypted registration credentials.

`pnpm run db:push` directly changes the database schema; it is not a read-only setup check. Migration files also exist in `lib/db/drizzle/`, and a dedicated AI registration migration script exists in the API package. Historical project notes recommend the Neon SQL Editor for large migrations affected by Windows connection resets.

`railway.toml` and `render.yaml` both build through `render-build.sh` and launch `artifacts/api-server/dist/index.mjs` from root. `/api/healthz` is liveness; `/api/readyz` checks the database and relevant registration schema. Configuration files show deployment support, not which host is currently active.

## Contracts and verification

- API contract workflow: edit `lib/api-spec/openapi.yaml`, then run codegen; generated client/schema files should be regenerated rather than edited manually. Additional handwritten endpoints exist, so inspect runtime routes too.
- CI runs dependency installation, codegen, workspace typechecking, API tests, API build and frontend build.
- Tests: `artifacts/api-server/tests/connections.test.ts`, `extraction.test.ts`, `registration.test.ts`.
- Connection and extraction tests mock integrations. Registration tests create a temporary embedded PostgreSQL instance and exercise schema/migration and registration behavior. Existing tests primarily cover registration; they do not establish end-to-end coverage of every business module.
- This indexing pass does not start the application, contact live providers, run migrations, seed data or change application behavior.

## Concrete concerns found while navigating

These are source observations, not a complete audit:

- `routes/flights.ts` exposes `/flights/admin/bookings` and `/flights/admin/bookings/:id` without an explicit authentication/role guard. `app.ts` mounts this router before the guarded admin router, and Clerk middleware alone does not deny anonymous requests.
- `routes/hotels.ts` accepts `paystackStatus` from the request body and uses it to mark a booking confirmed; that handler does not verify payment with Paystack.
- `src/lib/duffel.ts` and flight place suggestions contain a hardcoded test-token fallback. No token value is reproduced here.
- `project.md` and historical architecture/sprint notes contain stale stack versions, table counts and deployment/startup descriptions. Use manifests, runtime source and CI as the implementation references.
