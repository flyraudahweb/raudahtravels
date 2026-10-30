# 🧠 Raudah Travels: AI Memory Root

> **Agent Instruction**: This is the source of truth for the project context. Before starting any task, read this file and its linked context documents.

## 🏗️ Project Architecture
- **Type**: PNPM Monorepo
- **Frontend**: React/Vite (Port 5173) - [architecture.md](file:///c:/Users/DEEPMIND/Downloads/Travel-Master-Guide-main/Travel-Master-Guide-main/.ai/context/architecture.md)
- **Backend**: Express API (Port 8080)
- **Database**: Neon PostgreSQL (Drizzle ORM)
- **Auth**: Clerk (Native CDN loaded, DO NOT use `/api/__clerk` proxy on Railway)

## 🛠️ Critical Workflows
### Environment Variables
- **Local Dev**: Use a single root `.env` file.
- **Node Execution**: Use the `--env-file=../../.env` flag for Node scripts (required for Node 20.6+). This ensures environment variables are loaded before ESM imports are evaluated.
- **Vite/Railway**: `VITE_CLERK_PUBLISHABLE_KEY` must be present *before* the build step or the bundle will break.

### Database Migrations
- **Issue**: Windows to Neon connections often drop (`ECONNRESET`) during large SQL migrations.
- **Solution**: Always execute raw SQL from `lib/db/drizzle/` directly in the Neon Dashboard SQL Editor.

## 🚀 Active Development
- **Current requested work (2026-10-29): Duffel OTA expansion**. Read [OTA context](context/ota-expansion.md) and [progress memory](ota-progress.md) before continuing this work.
- **Travel search UI redesign**: User supplied Trip.com screenshots as UX references, retaining Raudah colours/content/features. Added popular/global airport selection, a responsive two-month calendar, passenger/age/room popovers, route-aware loading/cancellation, comparison cards and airline/stops/budget/time filters. Browser QA covered desktop/mobile and actual sandbox flight results using a temporary public-only relay; no bookings/payments were forwarded. Seven focused tests, frontend typecheck/build and diff checks pass. See the latest progress section. No new migration or credential/configuration changes.
- **Sandbox defaults corrected**: User requested test flights enabled by default and five prefilled selling rates. Saved these non-secret settings to the configured database and confirmed the live API returns airport suggestions plus 17 LOS–LHR offers priced in NGN. The host already has a working test credential; no credential/key change was needed. Fresh test installs now enable flight search; saved admin false and explicit env false take precedence. Admin switch/rate saves retain hosting secrets rather than copying/encrypting them. Latest targeted suites: 93 tests pass; API typecheck/build pass. Payments/hotels remain disabled pending their separate prerequisites.
- **Duffel webhook status**: Authorized test webhook created inactive; private signing configuration saved in ignored environment files. User now reports migrations 0009, 0010 and 0011 applied; the agent has not independently rechecked 0010/0011. Receiver deployment and signed-ping activation remain. Never expose stored secrets.
- **Travel dashboard updates/deep review**: Durable lifecycle notifications, owner-only timelines and urgent super-admin alerts are implemented. Deep review fixed financial/state races, rounding, stale browser/provider updates, worker recovery, pagination and admin drafts; added price preview and design polish. Latest checks: 101 tests, typecheck and both builds pass. Browser automation timed out; staging/mobile acceptance and launch gates remain. Read the latest progress section before continuing.
- **Payment security follow-up**: Shared Paystack verification now prevents OTA/package replay, rejects minted online/wallet credits and empty-key signatures, durably commits webhook credit, and serializes booking balances/wallet debits. Refund and redirect races were tightened. Latest targeted run: 90 tests across eight suites pass cleanly; full run had 120 passing assertions but registration cleanup timed out. Do not claim zero leakage or a fully green nine-suite run. Migrations are now user-reported complete; deployment and staging gates remain.
- See [current_sprint.md](file:///c:/Users/DEEPMIND/Downloads/Travel-Master-Guide-main/Travel-Master-Guide-main/.ai/epic/current_sprint.md) for the active focus.

## 📜 Session History
- [Session 1: Replit Migration](file:///c:/Users/DEEPMIND/Downloads/Travel-Master-Guide-main/Travel-Master-Guide-main/.ai/logs/session_1_replit_migration.md)
- [Session 5: Availability UI & Data Integrity](file:///c:/Users/DEEPMIND/Downloads/Travel-Master-Guide-main/Travel-Master-Guide-main/.ai/logs/session_5_availability_ui.md)
- [Session 6: Railway Deployment & Clerk Fixes](file:///c:/Users/DEEPMIND/Downloads/Travel-Master-Guide-main/Travel-Master-Guide-main/.ai/logs/session_6_railway_deployment.md)
- [Session 7: YouTube Hero Video Fix and Paystack Security Hardening](file:///c:/Users/DEEPMIND/Downloads/Travel-Master-Guide-main/Travel-Master-Guide-main/.ai/logs/session_7_video_and_paystack_security.md)
- [Session 8: Admin Booking Fixes & Dashboard Stability](file:///c:/Users/DEEPMIND/Downloads/Travel-Master-Guide-main/Travel-Master-Guide-main/.ai/logs/session_8_admin_booking_fixes.md)
- [Session 9: Agent Activity Tracking, ID Tag Printing & Seeding Automation](file:///c:/Users/DEEPMIND/Downloads/Travel-Master-Guide-main/Travel-Master-Guide-main/.ai/logs/session_9_agent_activity_and_id_tags.md)
- [Session 10: Registration Form Standardization & Interactive Passport Cropping](file:///c:/Users/DEEPMIND/Downloads/Travel-Master-Guide-main/Travel-Master-Guide-main/.ai/logs/session_10_registration_and_cropping.md)
- [Session 11: Registration Payment Fixes & Wallet Infrastructure Hardening](file:///c:/Users/DEEPMIND/Downloads/Travel-Master-Guide-main/Travel-Master-Guide-main/.ai/logs/session_11_registration_payment_and_wallet_hardening.md)
- [Session 12: Wallet Hardening & Paystack V2 Migration](file:///c:/Users/DEEPMIND/Downloads/Travel-Master-Guide-main/Travel-Master-Guide-main/.ai/logs/session_12_wallet_paystack_fixes.md)

2026-10-30: Restored header slideshow with fixed aircraft overlay. Added OTA-only mobile v1 API and super-admin Developer Centre (`/admin/ota-api`), detailed 23-operation/11-guide OpenAPI and mobile documentation, verified customer profile bootstrap, owner notification pagination/read actions, scoped/hashed/expiring/revocable backend search keys with atomic rate limits. Mobile apps use Clerk JWTs, never embedded server keys. Production migration `0012_ota_api_keys.sql` remains required for key management; not applied here. 109 regression tests pass excluding the known Windows registration suite. Builds pass. Local fixture UI QA desktop/mobile passed without real financial/authentication actions. See OTA context and generated docs.
