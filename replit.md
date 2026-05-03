# Raudah Travels & Tours

## Overview

Full-stack Hajj & Umrah travel booking platform for the Nigerian market. Serves three user types: Pilgrims (user dashboard), Travel Agents (agent B2B portal), and Admin/Staff (admin console). Also includes a public landing page at `/`.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React 18 + Vite 5, TanStack Query v5, shadcn/ui, Tailwind CSS, Framer Motion, Recharts
- **Routing**: Wouter v3
- **Auth**: Clerk (Replit-managed)
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (zod/v4), drizzle-zod
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Architecture

- `artifacts/raudah-travels/` — React + Vite frontend (served at `/`)
- `artifacts/api-server/` — Express API server (served at `/api`)
- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/api-client-react/` — Generated React Query hooks
- `lib/api-zod/` — Generated Zod validation schemas
- `lib/db/` — Drizzle ORM schema and DB client

## Routing Map

### Public
- `/` — Landing page
- `/packages` — Browse packages
- `/packages/:id` — Package detail
- `/become-agent` — Public agent application form (3-step, no auth required)
- `/sign-in` — Clerk sign-in
- `/sign-up` — Clerk sign-up

### User Dashboard (`/dashboard/*`)
- `/dashboard` — Overview
- `/dashboard/bookings` — User bookings
- `/dashboard/packages` — Browse to book
- `/dashboard/payments` — Payment history
- `/dashboard/documents` — Documents
- `/dashboard/visa` — Visa & ticket status + document downloads
- `/dashboard/profile` — Edit profile
- `/dashboard/support` — Support tickets

### Agent Portal (`/agent/*`)
- `/agent` — Overview/stats
- `/agent/packages` — Browse packages
- `/agent/bookings` — Client bookings
- `/agent/visas` — Client visa status + document downloads
- `/agent/commissions` — Commissions
- `/agent/profile` — Agent profile

### Admin Console (`/admin/*`)
- `/admin` — Overview/stats
- `/admin/analytics` — Revenue charts
- `/admin/ai` — AI Business Assistant (live data Q&A)
- `/admin/packages` — Manage packages
- `/admin/bookings` — All bookings
- `/admin/payments` — Verify payments
- `/admin/pilgrims` — All pilgrims
- `/admin/book-pilgrim` — Walk-in/phone booking wizard (4-step)
- `/admin/id-tags` — Pilgrim ID card generator (printable)
- `/admin/visa-management` — Visa tracking + provider CRUD
- `/admin/amendments` — Booking amendment requests (approve/reject)
- `/admin/agents` — Agent management
- `/admin/bank-accounts` — Bank account CRUD (shown to pilgrims)
- `/admin/support` — Support tickets
- `/admin/chat` — Internal team chat (channels + DMs)
- `/admin/staff` — Staff management + permissions
- `/admin/activity` — User activity audit log
- `/admin/booking-form` — Booking form field builder (system + custom fields)
- `/admin/settings` — Site-wide settings (contact, social, payments, email/SMTP)
- `/admin/backup` — DB backup & restore (export signed JSON + import with SHA-256 checksum)
- `/admin/passports` — AI passport scanner (Gemini 2.0 Flash OCR)

## DB Schema (26 tables — production-ready)

### Core
- `profiles` — user profiles (Clerk-synced); roles: super_admin/admin/moderator/staff/agent/user
- `packages` — Hajj/Umrah packages; enums: package_type, package_category, package_status; new: `countdown_enabled` (bool), `countdown_expiry` (text, ISO datetime)
- `package_dates` — multiple flight-date options per package
- `package_accommodations` — hotel info per city (Makkah/Madinah) per package
- `bookings` — full pilgrim booking records with 25+ pilgrim detail columns + auto reference
- `payments` — payment records; methods: paystack/bank_transfer/ussd/cash/wallet
- `documents` — 8 document types: passport/vaccine_certificate/visa/flight_ticket/hotel_voucher/booking_confirmation/payment_receipt/pre_departure_guide
- `notifications` — user notifications with deep link support

### Agent
- `agents` — travel agent accounts; status: active/suspended/pending; fields: businessName, contactPerson, email, phone, agentCode, commissionRate, commissionType (percentage/fixed)
- `agent_applications` — public partnership applications (no auth); reviewed by admin; status: pending/approved/rejected
- `agent_package_discounts` — per-package discount overrides for specific agents (UNIQUE agent_id+package_id)
- `agent_clients` — pilgrim clients managed by agents
- `agent_wallets` — prepaid wallet balance per agent
- `wallet_transactions` — full ledger of wallet operations
- `admin_otp_requests` — OTP verification for wallet top-ups (SHA256-hashed, 10-min expiry)
- `commissions` — commission records per booking

### Support
- `support_tickets` — tickets with category/priority/assignment; priority: low/medium/high/urgent; status: open/in_progress/resolved/closed
- `support_messages` — ticket messages with attachment support
- `staff_permissions` — granular staff permissions (14 permission types)
- `staff_support_specialties` — maps staff to ticket categories
- `staff_messages` — internal team chat

### Admin / Config
- `bank_accounts` — payment bank accounts (seeded: Zenith, First Bank)
- `site_settings` — key-value config store (seeded: WhatsApp, Paystack toggle, etc.); new keys: `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_secure`, `smtp_from_name`, `smtp_from_email`
- `backup_history` — record of every DB export/import operation
- `booking_amendment_requests` — pilgrim change requests with admin review flow
- `booking_form_fields` — dynamic form fields managed by admin
- `user_activity` — analytics event tracking
- `visa_applications` — per-booking visa status (pending/submitted/approved/rejected) with `visa_document_url`, `ticket_document_url` columns; `id_number` sequence on bookings starts at 1001
- `visa_providers` — authorized visa processing companies (seeded: VFS Global, Tawaf, Nusuk)

## Register Pilgrim Form (5-step wizard)

Both AdminBookPilgrim (`/admin/book-pilgrim`) and BookingWizard (`/dashboard/book/:id`, used by pilgrims and agents) have been updated with comprehensive pilgrim fields:

**Step 1 — Package**: Select active package  
**Step 2 — Passport**: passport number, date of issue, expiry, issuing authority, N° visa, passport copy upload (base64), profile photo upload (base64)  
**Step 3 — Personal Info**: civility (Mr/Mrs/Alhaji/…), first name*, last name*, DOB (optional), place of birth (optional), sex*, nationality, ethnic group, marital status (optional), level of study, partner/mahram*, under cover (optional), observation (optional)  
**Step 4 — Contact & Address**: phone WhatsApp*, email (optional), profession (optional), country (optional), city (optional), room preference, address (optional)  
**Step 5 — Payment**: method (cash/bank transfer), amount paid, mark verified toggle

New DB columns added (all nullable): `civility`, `first_name`, `last_name`, `passport_issue_date`, `passport_issuing_authority`, `passport_copy_url`, `profile_photo_url`, `ethnic_group`, `level_of_study`, `visa_number`, `email`, `country`, `city`, `partner`, `under_cover`, `observation`

File uploads stored as base64 data URLs in text columns (MVP approach).

## Email System

Receipt emails and custom notifications are sent via nodemailer SMTP.
Configure in Admin → Settings → Email (SMTP). Supports Gmail, Zoho, Brevo, SendGrid, etc.

Templates (inline HTML, branded with Royal Indigo #2D3199 + Deep Orange #FF3B00):
- **Payment Receipt** — sent automatically after payment confirmed (Paystack verify, webhook, or admin manual verify)
- Email utility: `artifacts/api-server/src/utils/email.ts`

**Note:** Clerk handles auth emails (OTP codes for sign-up, password reset). The application name shown in those emails ("Travel Master Guide") must be changed in the Clerk Dashboard → your app → Customization / Email settings.

## AI Business Assistant

Real Gemini AI chat at `/admin/ai`. Route: `POST /api/ai/chat`.
- Gemini API key stored in `site_settings` table (key: `gemini_api_key`) — configure in Admin → Settings → AI Integration
- Fetches live DB data (revenue, bookings, pilgrims, agents) as context on every request
- Model: `gemini-2.0-flash`
- 12 quick-prompt categories for business analysis

## Password Reset

`/forgot-password` — dedicated page using Clerk's built-in password reset flow.
Also accessible via "Forgot your password?" link on the sign-in page.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Auth

Clerk (Replit-managed). Role hierarchy: super_admin → admin → staff → agent → user.
After sign-in/sign-up, frontend calls `/api/auth/profile/sync` to upsert profile in DB.

## Currency

Nigerian Naira (NGN / ₦)
