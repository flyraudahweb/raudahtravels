# Current Sprint: Core Functionality & Agent Dashboard

## Active Focus

- **Neon Setup**: 🟢 Completed.
- **Clerk Setup**: 🟢 Completed.
- **API Connectivity**: 🟢 Fixed.
- **Promotion**: 🟢 `aleeyuwada01@gmail.com` is `super_admin`.
- **Auth Simplification**: 🟢 Removed custom 2FA/OTP system. Clerk now handles all authentication.
- **Security Audit**: 🟢 Completed comprehensive API audit. 16 issues found across 9 files.
- **Security Fixes**: 🟢 All 16 fixes implemented across 9 route files. Report: `security_findings/audit_report.md`.

## What Changed (Session 11 — Registration Payment Fixes & Wallet Hardening)

- **Atomic Wallet Payments**: Implemented thread-safe agent wallet payments for registrations using PostgreSQL `FOR UPDATE` locks.
- **Secure Admin Top-Ups**: Replaced the 2-step OTP flow with a single-step atomic endpoint restricted to Super Admins, protected by idempotency keys to prevent double-spending.
- **Paystack & Crop Fixes**: Resolved the "403 Forbidden" initialization error for agents/admins and fixed the passport cropping coordinate scaling bug.

## What Changed (Session 10 — Registration Form Standardization & Interactive Passport Cropping)

- **Agent Registration Synchronization**: Standardized the Agent registration flow (`AgentClients.tsx`) to dynamically respect Admin Booking Settings using the `useFormFieldConfig` hook, mirroring the behavior of User and Admin registration wizards.
- **Interactive Passport Cropping**: Replaced the automatic AI face-cropping in `PassportScanner.tsx` with a manual cropping UI using `react-image-crop`. The engine now presents a Dialog using the AI's detected face bounding box as an initial suggestion, giving users precise control over the profile picture framing.

## What Changed (Session 9 — Agent Activity, ID Printing & Seeding Automation)

- **Agent Activity Tracking**: Implemented `GET /api/admin/agents-activity` and a unified timeline UI in the admin panel to track agent performance and wallet transactions.
- **ID Tag Fidelity**: Resolved landscape print distortion by standardizing layout to `px` units and pixel-perfect CSS scaling.
- **Auto-Seeding**: Implemented idempotent database initialization for default chat channels and booking form fields, ensuring persistence across hosting migrations.
- **Startup Stability**: Modified the API entry point to allow the server to start even if the database is unmigrated, preventing healthcheck failures.

## Next Steps

1. **Verify Deployment**: Confirm that the missing booking form fields (Visa Number, etc.) appear in Admin → Settings once Railway finishes the healthy deployment.
2. **SMTP Configuration**: Finalize SMTP or Resend setup in Admin → Settings for transactional emails.
3. **Wallet Audit**: Perform a production audit of agent wallet transactions once the system is under load.




## Known Issues & Workarounds

- **Neon ECONNRESET**: Still applies for large local-to-remote SQL migrations. Use the Neon Dashboard SQL Editor.
