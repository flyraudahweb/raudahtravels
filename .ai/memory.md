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
