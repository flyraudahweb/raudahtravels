# Current Sprint: Core Functionality & Agent Dashboard

## Active Focus

- **Neon Setup**: 🟢 Completed.
- **Clerk Setup**: 🟢 Completed.
- **API Connectivity**: 🟢 Fixed.
- **Promotion**: 🟢 `aleeyuwada01@gmail.com` is `super_admin`.
- **Auth Simplification**: 🟢 Removed custom 2FA/OTP system. Clerk now handles all authentication.
- **Security Audit**: 🟢 Completed comprehensive API audit. 16 issues found across 9 files.
- **Security Fixes**: 🟢 All 16 fixes implemented across 9 route files. Report: `security_findings/audit_report.md`.

## What Changed (Session 4 — Workflow & UI Hardening)

- **Database Tracking**: Added `registered_by_staff_id` to the `bookings` table via Drizzle migration.
- **Admin Backend**: 
  - `POST /admin/book-pilgrim` updated to record the acting staff ID.
  - Added `/admin/staff-list` and `/admin/agents-list` for dropdown populations.
  - `GET /admin/pilgrims` accepts filters for `registeredByStaffId` and `agentId`.
- **Agent Backend**: `POST /agent/register-client` securely handles all extended admin-level client data parameters.
- **Admin UI**:
  - `AdminPilgrims.tsx`: Added filters for "Registered By Agent" and "Registered By Staff", plus source badges on the rows.
  - `AdminAgents.tsx`: Replaced basic view with a robust **Agent Detail Dialog** showing wallet balance, commission, and an embedded searchable list of all clients registered by that agent.
- **Agent UI**: `AgentClients.tsx`: Completely replaced the single-form registration with a robust **4-Step Wizard** identical to the Admin flow.
- **Database Fix**: Applied the `migration_unique_payment_reference.sql` directly to Neon.

## What Changed (Session 3 — Security Hardening)

- **notifications.ts**: Removed unauthenticated `POST /notifications`; added ownership to mark-as-read
- **packages.ts**: Added `requireAdmin` guard to all mutation endpoints (POST/PUT/DELETE)
- **documents.ts**: Added auth + ownership check to `GET /documents/:id`
- **support.ts**: Admin-only ticket mutations; message ownership check; sanitized search input
- **admin.ts**: Role enum validation + super_admin restriction; canonical price enforcement
- **payments.ts**: Atomic Paystack verify via `db.transaction()`; `amountPaid` accumulation fix
- **bookings.ts**: Status enum validation on booking updates
- **index.ts**: Rate limiting on `POST /contact` (5/min/IP)
- **agents.ts**: Rate limiting on `POST /agents/public-apply` (3/min/IP)

## Next Steps

1. **Test New UI Workflows**: Fire up `npm run dev` to verify the Admin filters, Agent detail dialogs, and the Agent Registration Wizard.
2. **Configure Email Provider**: Set up SMTP or Resend in Admin → Settings for transactional emails (receipts, etc.)
3. **Render Deployment**: Push to GitHub and deploy via `render.yaml` Blueprint
4. **Paystack Integration**: Configure payment keys in Admin → Settings

## Known Issues & Workarounds

- **Neon ECONNRESET**: Still applies for large local-to-remote SQL migrations. Use the Neon Dashboard SQL Editor.
