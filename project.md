# Raudah Travels & Tours — Project Reference

## What This Is

A full-stack **Hajj & Umrah travel booking platform** built for the Nigerian market. The system manages the entire pilgrim journey from initial enquiry through package selection, booking, payment, passport processing, visa tracking, and travel documents — for three distinct user types operating in three separate portals.

**Business context:** Raudah Travels & Tours (flyraudah.com.ng) is a NAHCON-licensed Nigerian Hajj & Umrah operator based in Kano. The platform replaces manual WhatsApp/spreadsheet workflows with a fully digital, multi-role system.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm workspaces |
| Runtime | Node.js 24 |
| Language | TypeScript 5.9 (strict) |
| Frontend framework | React 18 + Vite 5 |
| UI components | shadcn/ui (Radix UI primitives) + Tailwind CSS |
| State / data | TanStack Query v5 |
| Routing | Wouter v3 |
| Authentication | Clerk (JWT, social login, email OTP) |
| API framework | Express 5 |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM + drizzle-zod |
| Validation | Zod v4 |
| API codegen | Orval (OpenAPI → React Query hooks + Zod schemas) |
| AI integration | Google Gemini 1.5 Flash (`@google/generative-ai`) |
| Payments | Paystack (online card + webhook verification) |
| Charts | Recharts |
| Animations | Framer Motion |
| Build | esbuild (API server) |
| Package manager | pnpm 10 |

**Design language:** Royal Indigo `#2D3199` primary, Deep Orange `#FF3B00` CTAs, white cards on `#F8FAFF` backgrounds.

---

## Repository Structure

```
/
├── artifacts/
│   ├── raudah-travels/          # React + Vite frontend (served at /)
│   └── api-server/              # Express API server (served at /api)
├── lib/
│   ├── db/                      # Drizzle ORM schema + DB client
│   ├── api-spec/openapi.yaml    # OpenAPI contract (source of truth)
│   ├── api-client-react/        # Generated React Query hooks (Orval)
│   └── api-zod/                 # Generated Zod schemas (Orval)
├── scripts/                     # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

---

## The Three Portals

### 1. Public Website (`/`)
Static marketing site, no auth required.

| Page | Purpose |
|------|---------|
| `/` | Landing page — hero, packages preview, testimonials, stats |
| `/packages` | Browse all active Hajj & Umrah packages |
| `/packages/:id` | Package detail with booking CTA |
| `/become-agent` | 3-step public agent partnership application |
| `/about` | About page with leadership team |
| `/contact` | Contact form + bank details |
| `/sign-in` / `/sign-up` | Clerk-hosted auth |

---

### 2. Pilgrim Dashboard (`/dashboard/*`)
For individual pilgrims who have registered and booked a package.

| Route | Feature |
|-------|---------|
| `/dashboard` | Summary: booking status, payment balance, visa status |
| `/dashboard/bookings` | All bookings with reference numbers |
| `/dashboard/packages` | Browse and initiate a booking |
| `/dashboard/book/:packageId` | Multi-step booking wizard |
| `/dashboard/payments` | Payment history, outstanding balance, pay online |
| `/dashboard/documents` | Download documents (flight tickets, hotel vouchers, guides) |
| `/dashboard/visa` | Visa application status + download visa PDF |
| `/dashboard/amendments` | Request booking changes |
| `/dashboard/support` | Create & track support tickets |
| `/dashboard/profile` | Edit personal details |
| `/dashboard/notifications` | In-app notifications |

---

### 3. Agent Portal (`/agent/*`)
For accredited travel agents who sell packages on behalf of Raudah.

| Route | Feature |
|-------|---------|
| `/agent` | Overview: total clients, wallet balance, commissions earned |
| `/agent/clients` | Client management: register, search, filter, view passport/visa/ticket details |
| `/agent/bookings` | All client bookings |
| `/agent/packages` | Browse packages with agent discount prices |
| `/agent/visas` | Client visa statuses |
| `/agent/commissions` | Commission history and pending payouts |
| `/agent/wallet` | Prepaid wallet: balance, transactions, top-up info |
| `/agent/profile` | Business profile |

**Agent Passport OCR:** Agents can upload a passport photo in the Register Client form. Gemini AI auto-extracts all fields and crops the pilgrim's face as a profile photo.

---

### 4. Admin Console (`/admin/*`)
Full system management for Raudah staff (roles: super_admin, admin, moderator, staff).

| Route | Feature |
|-------|---------|
| `/admin` | Overview: bookings, revenue, pilgrims, agents at a glance |
| `/admin/analytics` | Revenue, booking trends, payment method breakdown (Recharts) |
| `/admin/ai` | AI Business Assistant — ask questions about live data in natural language |
| `/admin/packages` | Create, edit, archive Hajj/Umrah packages; set departure dates, hotels, countdown timer |
| `/admin/bookings` | All bookings with filters; view full pilgrim profile |
| `/admin/book-pilgrim` | Walk-in / phone booking wizard (5 steps: Package → Passport → Personal → Contact → Payment) |
| `/admin/payments` | Verify bank transfer payments, view Paystack records |
| `/admin/pilgrims` | All pilgrims with passport/visa/payment status |
| `/admin/passports` | Passport review queue with status tracking |
| `/admin/id-tags` | Printable pilgrim ID card generator (A6 format with QR code) |
| `/admin/visa-management` | Visa tracking dashboard; assign providers; bulk approve; upload visa PDFs & tickets |
| `/admin/amendments` | Approve/reject pilgrim booking change requests |
| `/admin/agents` | Agent accounts, commission rates, wallet top-ups, per-package discounts |
| `/admin/bank-accounts` | Company bank accounts shown to pilgrims for transfer payments |
| `/admin/enquiries` | Contact form submissions |
| `/admin/support` | All support tickets with assignment and reply |
| `/admin/chat` | Internal team chat: channels + direct messages |
| `/admin/staff` | Staff management: roles, permissions, support specialties |
| `/admin/activity` | Full audit log of all user activity |
| `/admin/booking-form` | Drag-and-drop booking form field builder (show/hide/reorder/require system fields, add custom fields) |
| `/admin/settings` | Site-wide settings: contact info, social links, Paystack API keys, Gemini AI key, landing page content |

---

## Database Schema (26 Tables)

### Core tables

| Table | Purpose |
|-------|---------|
| `profiles` | All users synced from Clerk; roles: super_admin / admin / moderator / staff / agent / user |
| `packages` | Hajj/Umrah packages with type, category, price, capacity, countdown |
| `package_dates` | Multiple departure date options per package |
| `package_accommodations` | Hotel info per city (Makkah / Madinah) per package |
| `bookings` | Full pilgrim booking records — 30+ columns covering personal, passport, contact, travel and payment details |
| `payments` | Payment records; methods: paystack / bank_transfer / ussd / cash / wallet |
| `commissions` | Commission records per booking |
| `documents` | 8 document types: passport, vaccine certificate, visa, flight ticket, hotel voucher, booking confirmation, payment receipt, pre-departure guide |
| `notifications` | In-app notifications with deep-link support |
| `user_activity` | Audit log of every meaningful action |

### Agent tables

| Table | Purpose |
|-------|---------|
| `agents` | Agent accounts: businessName, agentCode, commissionRate, commissionType, status |
| `agent_applications` | Public partnership applications (no-auth), reviewed by admin |
| `agent_clients` | Pilgrim clients registered by an agent |
| `agent_wallets` | Prepaid wallet balance per agent |
| `wallet_transactions` | Full double-entry ledger of wallet credits/debits |
| `agent_package_discounts` | Per-package discount overrides per agent |
| `admin_otp_requests` | OTP codes for wallet top-up authorization (SHA256-hashed, 10-min expiry) |

### Admin / system tables

| Table | Purpose |
|-------|---------|
| `bank_accounts` | Company bank accounts for manual transfers |
| `booking_form_fields` | Configurable form field visibility, labels, required status |
| `booking_amendment_requests` | Pilgrim requests to change booking details |
| `contact_messages` | Contact form submissions |
| `site_settings` | Key-value store for all admin-configurable settings |
| `staff_permissions` | Granular permission flags per staff member |
| `staff_support_specialties` | Support categories assigned to staff |
| `chat_channels` | Internal team chat channels |
| `staff_messages` | Messages within channels |
| `visa_applications` | Visa application per booking: status, provider, document URLs |
| `visa_providers` | External visa processing companies |
| `support_tickets` + `support_messages` | Pilgrim support with threaded messages |

---

## Key Features

### Passport OCR (AI-powered)
- Upload a passport photo → Gemini 1.5 Flash extracts all fields in under 3 seconds
- Canvas API crops the face bounding box into a 400×400 JPEG profile photo
- Graceful fallback: quota exhausted / service down → clear message + all form fields remain manually editable
- API key managed in Admin → Settings → AI Integration

### Payment flows
- **Online (Paystack):** Initialize → redirect to Paystack Popup → webhook confirms → booking auto-confirmed
- **Bank transfer:** Pilgrim transfers, uploads receipt URL, admin verifies manually
- **Cash / USSD:** Admin records payment directly
- **Agent wallet:** Agent's prepaid balance debited at booking

### Booking form field builder
Admin can show/hide any of the 20+ built-in fields (passport number, date of birth, ethnicity, room preference, etc.), change their labels, mark them required, and add fully custom fields — without touching code.

### Printable ID tags
Admin generates passport-style ID cards (A6) for each pilgrim with photo, name, booking reference, package name, and QR code — for distribution before departure.

### AI Business Assistant
Admin chat interface powered by Gemini. Can answer natural-language questions about live booking/revenue/pilgrim data by querying the database in real time.

---

## Environment Variables

### API Server

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `CLERK_PUBLISHABLE_KEY` | ✅ | Clerk frontend public key |
| `CLERK_SECRET_KEY` | ✅ | Clerk backend secret key |
| `SESSION_SECRET` | ✅ | Express session secret (32+ random chars) |
| `PAYSTACK_PUBLIC_KEY` | ⚡ Optional | Paystack public key (can also be set via Admin Settings) |
| `PAYSTACK_SECRET_KEY` | ⚡ Optional | Paystack secret key (can also be set via Admin Settings) |
| `NODE_ENV` | Auto | `development` or `production` |
| `PORT` | Auto | HTTP port (default 8080) |

### Frontend (build-time)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | ✅ | Same Clerk publishable key as above |

### Admin-managed (stored in DB, not env vars)

| Setting key | Purpose |
|-------------|---------|
| `gemini_api_key` | Google Gemini AI key for Passport OCR |
| `paystack_public_key` | Overrides env var |
| `paystack_secret_key` | Overrides env var |
| `paystack_enabled` | Toggle online payments on/off |
| `contact_info` | Phone, email, address, WhatsApp |
| `social_links` | Facebook, Instagram, Twitter, YouTube |
| `landing_video_url` | Hero section YouTube/Vimeo URL |
| `trust_badges` | Certification badges in footer |
| `landing_stats` | Stats shown on homepage |
| `about_stats` | Stats on About page |
| `leadership_team` | Team members on About page |

---

## API Surface (Base path: `/api`)

All endpoints are prefixed `/api`. Auth is via Clerk JWT (`Authorization: Bearer <token>`).

### Public (no auth)
- `GET  /api/healthz`
- `GET  /api/config`
- `GET  /api/public/settings`
- `POST /api/contact`
- `GET  /api/packages`
- `GET  /api/packages/:id`
- `POST /api/agents/public-apply`

### Authenticated (any logged-in user)
- `GET/PUT /api/auth/profile`
- `POST    /api/auth/profile/sync`
- `GET/POST /api/bookings`
- `GET     /api/bookings/:id`
- `GET/POST /api/payments`
- `POST    /api/payments/paystack/initialize`
- `POST    /api/payments/paystack/verify`
- `GET/POST /api/support/tickets`
- `GET/POST /api/documents`
- `GET/PUT  /api/notifications`
- `GET      /api/dashboard/summary`
- `GET      /api/my-visa`
- `GET      /api/dashboard/amendments`
- `POST     /api/passport/extract` ← AI passport OCR

### Agent only
- `GET  /api/agents/profile`
- `GET  /api/agents/wallet`
- `GET  /api/agents/commissions`
- `GET  /api/agent/clients`
- `POST /api/agent/register-client`
- `GET  /api/agent/visas`

### Admin only
- Full CRUD: packages, bookings, payments, pilgrims, agents, staff, visa, documents, settings, bank accounts, enquiries, analytics, chat, activity log

---

## Running Locally (on Replit)

The project runs automatically via Replit workflows:
- **API Server** → `pnpm --filter @workspace/api-server run dev` (port 8080, proxied at `/api`)
- **Frontend** → `pnpm --filter @workspace/raudah-travels run dev` (port 25408, proxied at `/`)

### First-time setup
1. Set environment variables: `DATABASE_URL`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `SESSION_SECRET`
2. Run database migrations: `psql "$DATABASE_URL" -c "..."` (or use the Drizzle migration files in `lib/db/`)
3. Start both workflows
4. Go to Admin → Settings to configure Paystack keys and optionally a Gemini API key

### Generating API types after schema changes
```bash
pnpm --filter @workspace/api-spec run codegen
```

---

## Third-Party Service Dependencies

| Service | Purpose | Free tier? |
|---------|---------|-----------|
| Clerk | Authentication (JWT, social login, OTP) | Yes — 10,000 MAU free |
| Paystack | Online card payments (Nigerian cards) | Yes — % per transaction only |
| Google AI Studio (Gemini) | Passport OCR | Yes — 1,500 requests/day free |
| PostgreSQL host | Database | Depends on provider |

---

## Colour Reference

| Token | Hex | Usage |
|-------|-----|-------|
| Royal Indigo | `#2D3199` | Primary brand, nav, buttons |
| Deep Orange | `#FF3B00` | CTAs, destructive actions |
| Slate 900 | `#0F172A` | Main text |
| Slate 600 | `#64748B` | Secondary text |
| Indigo tint | `#EEF0FF` | Hover states, icon backgrounds |
| Border | `#DCE3F0` | Card borders |
| Background | `#F8FAFF` | Page background |
