# AI-Assisted Registration Agent — Implementation Plan

**Status:** Phases 0-5 implemented and verified locally; Phase 6 live activation and external smoke tests pending credentials and deployment. See the current verification section below.
**Author:** Codex (OpenAI) · Generated 2026-10-03 · Phases 1–4 implemented by Claude (Kiro)
**Scope:** WhatsApp + Telegram as AI-assisted registration input channels, feeding the existing booking system through a mandatory human-review gate.


## Current verification - 2026-10-04

This section supersedes the earlier phase completion notes, which are retained as implementation history.

- Durable PostgreSQL inbound/outbound queue (migration 0008), receipt-before-ack, ordered processing, retries and audited failed-job retry/skip controls.
- Atomic review, duplicate re-check, shared booking creation, capacity, visa, booking/session review metadata and outcome enqueue. Concurrent approval is serialized and a unique AI session booking index prevents a second booking.
- Image-hash duplicate checks and structured checks across bookings, profiles and agent clients.
- Manual review when providers fail, readable-image retakes, conversational package options, corrections, cancellation and expired-session resume/restart.
- Validated Gemini/Mistral outputs, configurable current model IDs, Mistral-only review retry and persisted re-extracted fields. Existing passport endpoint retains its response shape and gains fallback.
- Review API, generated OpenAPI/Orval clients and Zod schemas, admin filtering/pagination/errors, duplicate warnings, metrics and delivery recovery.
- Private authenticated passport proxy, bounded image downloads, secret masking, permission escalation guards, readiness checks, per-IP/per-user limits, 30-day media retention and purge action.
- Read-only provider connection checks in Admin Settings, with timeouts, rate limits and sanitized results; no messages, generated registrations or AI inference are sent by these checks.
- Admin-managed encrypted channel, AI and private storage credentials; dynamic configuration, redacted responses, credential rotation, expiry/rate settings and configuration-check action. Database/authentication/public origin and encryption master key remain deployment bootstrap settings.
- `/bulk N` group intake for 2-20 pilgrims, separate passports/confirmations/reviews, shared contact/package, visible group identifiers and booking `batchId` links.
- CI workflow and 45 automated tests using disposable real PostgreSQL, with storage, AI and channel delivery mocked. Local typecheck, API generation and production builds verified; live provider metadata/bucket read checks passed; actual extraction/message delivery and browser login against a live deployment remain unverified.

Accepted differences from the original design: review and approval use the existing flat `ai_registrations` grant; expiry/retention use an in-process timer instead of an external cron secret; passport review uses an authenticated proxy; the UI is a single page/dialog. MFA is an identity-provider deployment requirement, not a new approval-specific challenge. Third-party outbound delivery is at least once.

**Live launch remains pending:** no WhatsApp/Telegram credentials or approved review template are present locally. On 2026-10-04, the currently configured database was snapshotted (33 tables with schema metadata) and migrations 0007/0008 were applied; the queue and unique approval index were verified. A persistent encryption key was generated in the ignored local `.env`. Every deployment sharing this database must configure the same key in its secret manager. Live read-only checks passed for Gemini model metadata, Mistral vision-model access and R2 bucket head/list operations. Bucket privacy/object read-write-delete, actual passport extraction/quota, webhook registration and live messaging smoke tests remain launch requirements. The feature is not marked fully launched.

Deployment and remaining acceptance steps: [AI_REGISTRATION_AGENT_DEPLOYMENT.md](./AI_REGISTRATION_AGENT_DEPLOYMENT.md).

---

## 0. Executive Summary

Add WhatsApp and Telegram as **conversational intake channels** that reuse the existing booking system. The AI agent collects pilgrim data conversationally, extracts passport fields with Gemini (Mistral fallback), runs duplicate detection, and writes a **pending-review** record. **No AI submission ever becomes a real booking without human approval.**

```
WhatsApp ─┐
          ├─► RegistrationAgent ─► PassportExtraction (Gemini→Mistral)
Telegram ─┘        │               ─► Validation
                   │               ─► DuplicateDetection
                   └─► submission (pending_review)
                          │
                    Human Review UI (staff)
                          │ approve
                          ▼
                    bookingsTable  ← SINGLE SOURCE OF TRUTH
```

**VPS is not required.** The existing Railway/Render single service already provides HTTPS webhooks, persistent Postgres (Neon), env secret management, and R2 file storage.

---

## 1. Current Registration Architecture (evidence-based)

There is **no standalone registration table**. Registration *is* a `bookings` row. Three entry points create it:

| Entry point | File:line | Auth | Notes |
|---|---|---|---|
| Pilgrim self-service | `artifacts/api-server/src/routes/bookings.ts:174` | Clerk user | Capacity + server-side pricing |
| Agent client register | `artifacts/api-server/src/routes/agents.ts` (`/agent/register-client`) | `agent` role | Agent discount |
| Staff walk-in/phone | `artifacts/api-server/src/routes/admin.ts:2340` | `requireAdmin` | 30+ fields, `registeredByStaffId` |

All three:
- Recompute price server-side (client `totalPrice`/`amountPaid`/`status` are explicitly destructured away — `_tp, _ap, _st`)
- Generate `reference: RDH-<10 hex>`
- Increment `packagesTable.currentBookings`
- Create a `visaApplicationsTable` row (`awaiting_payment` or `pending`)
- Write `userActivityTable` audit rows
- Emit `notificationsTable` rows via `utils/notify.ts`

**Status model today:** `booking_status` enum = `pending | confirmed | cancelled | completed`. No `pending_review` exists.

**Relevant schema fields already present** (`lib/db/src/schema/bookings.ts`):
`civility, firstName, lastName, fullName, passportNumber, passportIssueDate, passportExpiry, passportIssuingAuthority, passportCopyUrl, profilePhotoUrl, dateOfBirth, gender, nationality, placeOfBirth, ethnicGroup, maritalStatus, levelOfStudy, occupation, email, phone, country, city, address, observation, visaNumber, partner, underCover, fathersName, mothersName, mahramName, mahramRelationship, mahramPassport, meningitisVaccineDate, previousUmrah, previousUmrahYear, emergencyContactName/Phone/Relationship, roomPreference, roomSurcharge, departureCity, specialRequests, customData, pilgrimType, parentBookingId, batchId, registeredByStaffId`

Also: `profilesTable.ninNumber`, `profilesTable.passportNumber` — useful for duplicate detection.

---

## 2. Current Passport Extraction Flow

`POST /api/passport/extract` — `artifacts/api-server/src/routes/ai.ts`

1. **Auth:** Clerk required (`getAuth(req)`)
2. **Config:** `getAiConfig()` reads `site_settings` keys `ai_provider`, `gemini_api_key`, `mistral_api_key`
3. **Prompt:** `PASSPORT_PROMPT` — JSON-only. Returns `isAcceptableQuality`, `rejectionReason`, `firstName`, `lastName`, `documentNumber`, `nationality`, `dateOfBirth`, `sex`, `dateOfIssue`, `dateOfExpiry`, `faceBoundingBox {ymin,xmin,ymax,xmax}` (0–1 normalized)
4. **Gemini:** `gemini-2.0-flash` with `responseMimeType: "application/json"` → `JSON.parse`
5. **Mistral:** `mistral-small-latest` with a `data:` URL image part → strip ```json fences → `JSON.parse`
6. **Face crop:** done **client-side** in `components/PassportScanner.tsx` via `react-image-crop`

### Gap: no automatic fallback

Today `ai_provider` is a **single manual choice**. If Gemini is the provider and it returns 429/quota/invalid-key, the user gets an error telling them to ask an admin to switch providers in Settings. The brief requires **Gemini primary with automatic Mistral fallback** on failure, incompleteness, or unusable output.

**Fix:** extract the extraction logic into `services/passport/PassportExtractionService.ts` with an ordered provider chain and a completeness gate. Both `POST /api/passport/extract` and the new agent call the same service — no rewrite, just delegation.

---

## 3. Reusable Assets (do not rewrite)

| Asset | Location | Reuse for |
|---|---|---|
| `PASSPORT_PROMPT` + Gemini/Mistral calls | `routes/ai.ts` | Extract into service |
| `uploadToR2` / `getFromR2` / `isR2Configured` | `lib/r2.ts` | Store channel media |
| HMAC webhook verify (`createHmac` + `timingSafeEqual`) | `routes/payments.ts` (Paystack) | WhatsApp signature pattern |
| `requireAdmin` + `staffPermissionsTable` | `routes/admin.ts`, `schema/agents.ts` | Gate review endpoints |
| `createNotification` | `utils/notify.ts` | Review-queue alerts |
| `sendEmail` / `sendPaymentReceipt` | `utils/email.ts` | Reviewer + user emails |
| `userActivityTable` audit insert pattern | `routes/bookings.ts`, `routes/admin.ts` | Audit trail |
| Amendment review pattern (`status` + `reviewedBy` + `reviewedAt`) | `routes/admin.ts` `/admin/amendments/:id` | Review state machine |
| `book-pilgrim` business logic | `routes/admin.ts:2340` | Extract → shared booking creation |
| `AdminBookPilgrim.tsx` UI patterns | `pages/admin/` | Review UI |
| `site_settings` key-value store | `schema/site-settings.ts` | Non-secret config |

---

## 4. Proposed Architecture

```
┌─────────────────┐   ┌─────────────────┐
│ WhatsApp Cloud  │   │ Telegram Bot    │
│ API (Meta)      │   │ API             │
└────────┬────────┘   └────────┬────────┘
         │  HTTPS webhook      │
         └──────────┬──────────┘
                    ▼
        routes/whatsapp.ts   routes/telegram.ts
        (signature verify, idempotency)
                    │
                    ▼
         services/channels/ChannelAdapter.ts   ← interface
         ├── WhatsAppAdapter.ts
         └── TelegramAdapter.ts
                    │
                    ▼
         services/registration/RegistrationAgentService.ts
                    │
    ┌───────────────┼────────────────┬──────────────────┐
    ▼               ▼                ▼                  ▼
ConversationService  PassportExtractionService   DuplicateDetection
(PG-backed state)   (Gemini→Mistral)            Service
    │               │                │                  │
    └───────────────┴────────────────┴──────────────────┘
                    │
                    ▼
      ai_registration_submissions (pending_review)
                    │
                    ▼
       routes/ai-registration.ts (admin)
                    │ approve
                    ▼
       RegistrationService.createBooking()  → bookingsTable
```

**Channel independence:** adapters translate platform events into a common `InboundMessage` / `OutboundReply` shape. All business logic lives in channel-agnostic services.

---

## 5. WhatsApp Integration — Recommendation

**Official WhatsApp Business Platform / Cloud API (Meta-hosted).**

Why not a BSP aggregator (Twilio/360dialog/Wati): direct Cloud API is cheaper (Meta charges per conversation template; BSPs add markup), has no vendor lock-in, and gives full webhook control. For a Nigerian operator at moderate volume this is the right call. Revisit a BSP only if agent-assigned conversation windows become painful.

**Flow:**
- Webhook verification: `GET /api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…`
- Inbound: `POST /api/whatsapp/webhook` with `X-Hub-Signature-256: sha256=<hmac(app_secret, rawBody)>`
- Media: `GET https://graph.facebook.com/v{VER}/{MEDIA_ID}` → binary download → `uploadToR2`
- Outbound: `POST https://graph.facebook.com/v{VER}/{PHONE_NUMBER_ID}/messages`
- Template messages required outside the 24-hour customer service window

**Env:** `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_API_VERSION`

---

## 6. Telegram Integration — Recommendation

**Telegram Bot API with webhook.**

- Register bot via @BotFather → `TELEGRAM_BOT_TOKEN`
- `POST https://api.telegram.org/bot{TOKEN}/setWebhook` with `secret_token`
- Inbound verified via `X-Telegram-Bot-Api-Secret-Token` header
- Photos arrive as `message.photo[]` — always pick the **largest** `file_id`
- Documents via `message.document` (validate mime + size)
- Outbound: `sendMessage` / `sendPhoto` with inline keyboards

**Env:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_USERNAME`

---

## 7. Conversation / Session State Model

Persistent (Postgres), not memory — survives restarts and scale-out.

**States:** `collecting → ready_for_review → pending_review → approved | rejected`, plus `expired`, `cancelled`

**Steps** (drives what the bot asks next): `awaiting_name`, `awaiting_contact`, `awaiting_package`, `awaiting_passport_image`, `awaiting_confirmation`

**Resume:** on inbound message, look up active session by `(channel, channelUserId)` where `status='collecting'` and `expiresAt > now()`. If found → resume from `currentStep` and replay `missingFields`. If not → create new session. `expiresAt` = now + 48h, refreshed on each inbound message.

**Corrections:** user says "actually my name is X" → the agent merges into `collectedData`, writes an `ai_registration_audit` row (`field_corrected`), and re-evaluates `missingFields`.

---

## 8. Database Changes (additive, backwards-compatible)

New table `lib/db/src/schema/ai-registration.ts`:

1. **`ai_registration_sessions`** — conversation state, `collectedData` jsonb, extraction result, duplicate status, expiry
2. **`ai_registration_messages`** — every inbound/outbound message, `channelMessageId` UNIQUE for idempotency
3. **`ai_registration_submissions`** — the review artifact; `snapshot` jsonb frozen at submit; links to `bookingId` after approval
4. **`ai_registration_audit`** — append-only event log

New columns on `bookingsTable` (all nullable / defaulted → zero breakage):
`source` (`direct` | `whatsapp_ai` | `telegram_ai`), `aiSessionId`, `reviewStatus`, `reviewedById`, `reviewedAt`, `duplicateStatus`, `duplicateMatches` jsonb

Migration `lib/db/drizzle/0007_ai_registration.sql` + journal entry.

---

## 9. Duplicate Detection

Three tiers, exactly as briefed:

| Tier | Trigger | Effect |
|---|---|---|
| `duplicate_confirmed` | exact normalized passport number, **or** identical `passportImageHash` (sha256), **or** same email + same active booking | Block auto-approve; require explicit staff override with reason |
| `possible_duplicate` | fuzzy name similarity ≥ 0.88 **+** matching DOB, or same phone with different passport | Surface prominently to reviewer; allow approval |
| `no_duplicate_detected` | nothing matched | Normal review |

Normalization: passport → uppercase + strip non-alphanumerics; phone → digits only, last 9–10 digits (handles `+234`, `0803…`, `803…`). Name similarity: normalized Levenshtein ratio (no new dependency).

Search surface: `bookingsTable.passportNumber`, `profilesTable.passportNumber`, `profilesTable.ninNumber`, `bookingsTable.phone/email`, `bookingsTable.fullName + dateOfBirth`, `agentClientsTable.passportNumber/phone/email`.

Run **twice**: once when transitioning to `ready_for_review`, and again inside the approve transaction (guards TOCTOU).

---

## 10. Human Review Workflow

Admin endpoints under `routes/ai-registration.ts`:

- `GET /api/admin/ai-registrations?status=&channel=&duplicateStatus=&q=&page=&limit=`
- `GET /api/admin/ai-registrations/:id` (includes signed passport URL + duplicate matches + audit timeline)
- `PUT /api/admin/ai-registrations/:id` (staff corrections → audit `reviewer_edited` with field-level diff)
- `POST /api/admin/ai-registrations/:id/approve` → creates real booking, capacity check + pricing reused
- `POST /api/admin/ai-registrations/:id/reject` (reason required)
- `POST /api/admin/ai-registrations/:id/retry-extraction` (force Mistral)
- `GET /api/admin/ai-registrations/stats` (by channel/status, extraction success rate, gemini-vs-mistral, duplicate counts)

Authorization: `requireAdmin` **plus** `staffPermissionsTable` check for `ai_registration:review` / `ai_registration:approve` (super_admin bypass). Reuse the `require2fa.ts` pattern for approval.

---

## 11. Idempotency & Retry

- `ai_registration_messages.channelMessageId` is UNIQUE (WhatsApp `wamid.*`, Telegram `update_id`) → duplicate delivery short-circuits with 200
- Webhooks validate + persist synchronously, then process via `setImmediate` so Meta/Telegram never time out
- Outbound sends: exponential backoff 1s → 2s → 4s, 3 attempts
- Extraction: Gemini → (on 429/quota/invalid key/parse fail/incomplete) → Mistral → if both fail, `extraction_provider = null` and the reviewer does manual entry
- Approval runs in a DB transaction with a `status = 'pending_review'` guard — no partial bookings

---

## 12. Error Handling

| Situation | Behaviour |
|---|---|
| Blurry/unreadable passport | `isAcceptableQuality=false` → ask for retake, session stays `collecting` |
| Unsupported file type | Reply with allowed types, keep session |
| Multiple images | Keep all in `collectedData.attachments[]`, extract from latest |
| User corrects a field | Merge + audit + recompute `missingFields` |
| Session expired (>48h) | Mark `expired`; next message offers resume-or-restart |
| Both AI providers fail | Submission still created; reviewer completes manually |
| Duplicate confirmed | Submission created but flagged; approval requires override |

---

## 13. Security & Privacy

- **Media**: store in R2 under `passports/ai/<channel>/…`. Existing `GET /api/files/:folder/:filename` is public-by-UUID — for review UI, prefer short-lived signed URLs or admin-gated fetch so passports aren't casually browsable.
- **PII in logs**: never log base64 payloads or full passport numbers; mask (e.g. `A1234****`). Existing `pinoHttp` serializer already strips query strings.
- **Secrets**: channel tokens/app secrets in env vars only. Gemini/Mistral keys stay in `site_settings` (existing pattern) but **mask secrets in `GET /api/admin/settings`** — currently a real leak risk.
- **Webhook auth**: HMAC for WhatsApp, secret-token header for Telegram. Raw body preserved (`app.ts` already sets `req.rawBody` in the `verify` hook — reuse it).
- **Rate limiting**: per-`channelUserId` throttle + per-IP cap (mirror the existing `rateLimit()` helper in `routes/index.ts`).
- **Retention**: purge R2 media for rejected/expired submissions after 30 days; expose a purge action.
- **Audit PII access**: log `ai_registration_viewed` to `userActivityTable`.

---

## 14. Deployment — No VPS Required

**Extend the existing deployment.** Requirements check against current setup:

| Requirement | Current platform provides? |
|---|---|
| HTTPS webhooks (Meta/Telegram mandate) | ✅ Railway/Render public HTTPS + custom domain |
| Persistent DB | ✅ Neon (`DATABASE_URL`) |
| File storage | ✅ Cloudflare R2 |
| Env secret management | ✅ Railway variables / Render dashboard |
| Always-on (free tier sleeps) | ⚠️ **Use a paid tier** — sleeping instances drop webhook events |

**Recommendation: Railway Hobby ($5/mo).** Single service, no-sleep, generous limits, `healthcheckPath=/api/healthz` already configured in `railway.toml`. Alternative: Render Starter ($7/mo).

**No Redis / no separate worker for MVP.** Extraction is ~1–3s synchronous. If concurrency becomes an issue, add `pg-boss` (uses existing Postgres, zero new infra) before reaching for Redis.

**A VPS would only be justified if** you need >1000 msgs/min, local Redis, or an on-prem WhatsApp number. Not the case here.

---

## 15. Environment Variables

**New:**
```
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_API_VERSION=v21.0

TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_BOT_USERNAME=

AI_REGISTRATION_ENABLED=false
AI_REGISTRATION_AUTO_FALLBACK=true
AI_REGISTRATION_SESSION_TTL_HOURS=48
INTERNAL_CRON_SECRET=
```

**Existing (unchanged):** `DATABASE_URL`, `CLERK_*`, `VITE_CLERK_PUBLISHABLE_KEY`, `SESSION_SECRET`, `R2_*`, `APP_URL`, `CORS_ORIGIN`

**`site_settings` keys:** `ai_registration_enabled`, `ai_registration_package_allowlist`

---

## 16. Testing Strategy

- **Unit** — `DuplicateDetectionService` (each tier), normalizers, extraction completeness gate, state machine transitions
- **Integration** — HMAC verify accept/reject, Telegram secret-token, media download→R2, session resume, duplicate-delivery idempotency
- **E2E** — full webhook → submit → approve → assert `bookings` row created, `capacity` incremented, `visa_applications` row created
- **Regression** — existing `POST /api/passport/extract` returns identical shape after service extraction
- **Manual** — WhatsApp test number + Telegram test bot; blurry image; multi-image; correction; 48h expiry

---

## 17. Implementation Phases

| Phase | Scope | Est. |
|---|---|---|
| **0** | Plan doc, env scaffolding | ✅ done |
| **1** | Schema + migration, `PassportExtractionService` w/ auto-fallback, `DuplicateDetectionService`, `ConversationService`, `RegistrationAgentService` | ✅ done |
| **2** | `ChannelAdapter` + WhatsApp/Telegram adapters + webhook routes + idempotency | ✅ done |
| **3** | Review API + shared booking creation extracted from `book-pilgrim` + OpenAPI/Orval | ✅ backend and OpenAPI/Orval done |
| **4** | Admin review UI | ✅ done |
| **5** | Expiry, retention, rate limiting, secret masking, metrics, tests | ✅ locally verified |
| **6** | Deploy, set webhooks, smoke test | Pending live credentials and acceptance checks |

### Phase 1 files

**Create**
- `lib/db/src/schema/ai-registration.ts`
- `lib/db/drizzle/0007_ai_registration.sql`
- `artifacts/api-server/src/services/passport/PassportExtractionService.ts`
- `artifacts/api-server/src/services/registration/DuplicateDetectionService.ts`
- `artifacts/api-server/src/services/registration/ConversationService.ts`
- `artifacts/api-server/src/services/registration/RegistrationAgentService.ts`
- `artifacts/api-server/src/services/registration/normalizers.ts`

**Modify**
- `lib/db/src/schema/index.ts` (export)
- `lib/db/src/schema/bookings.ts` (new nullable columns)
- `lib/db/drizzle/meta/_journal.json` (entry 4)
- `artifacts/api-server/src/routes/ai.ts` (delegate extraction to service)
- `artifacts/api-server/build.mjs` (if new dirs need config)

**Phase 1 completion notes (for whoever picks up Phase 2):**
- `RegistrationAgentService.handleInboundMessage()` is the single entry point adapters will call — it already does idempotent message recording, passport-image handling (R2 upload + extraction + merge into `collectedData`), text-answer routing by `currentStep`, and auto-triggers duplicate detection + submission creation once nothing is missing and the user has confirmed.
- The text-answer router in `handleTextAnswer()` is intentionally a minimal step-based switch (plain field assignment, no NLU/intent parsing) — adequate for Phase 1 since no channel adapter exists yet to feed it real traffic. Revisit if WhatsApp/Telegram conversations need to handle free-form corrections mid-flow beyond the `mergeCollectedData` correction path already in `ConversationService`.
- `extractPassport(..., { strict: true })` preserves the exact legacy `/api/passport/extract` behavior (single configured provider, no fallback). `{ strict: false }` is the new auto-fallback path (Gemini → Mistral) used by the agent, gated by a completeness check (`isAcceptableQuality`, firstName/lastName/documentNumber present).
- `expireStaleSessions()` in `ConversationService.ts` is written but **not wired to a cron/scheduler yet** — Phase 2/5 should call it periodically (plan section 17, Phase 5 "Expiry cron").
- `DuplicateDetectionService` covers passport/email/name+DOB/phone tiers per section 9. Passport-image-hash matching across submissions is NOT yet implemented (the service only compares structured fields) — add it in Phase 3 when wiring the review API, since it needs to query `aiRegistrationSubmissionsTable.passportImageHash` across prior submissions.
- Build verified with `pnpm run typecheck` — `artifacts/api-server` typechecks clean. (A pre-existing, unrelated `scripts` package typecheck failure around `pg` types predates this work.)

### Phase 2 files
**Create** `services/channels/{ChannelAdapter,WhatsAppAdapter,TelegramAdapter}.ts`, `routes/{whatsapp,telegram}.ts`
**Modify** `routes/index.ts`, `.env.example`, `.env.railway`, `render.yaml`

**Phase 2 completion notes (for whoever picks up Phase 3):**
- `ChannelAdapter.ts` defines the common `NormalizedInboundMessage` / `OutboundReply` shapes. `RegistrationAgentService.InboundMessage` is now a type alias of `NormalizedInboundMessage` — one contract, not two.
- For image/document messages, adapters put the platform's media file id into `text` (they don't download media themselves — `parseInbound` only translates the webhook payload). The webhook route is responsible for calling `adapter.fetchMedia({ mediaId })` and attaching `mediaBase64`/`mediaMimeType` before calling `handleInboundMessage()`. This keeps `RegistrationAgentService` adapter-agnostic — it only ever consumes pre-resolved base64.
- Idempotency: `ConversationService.recordMessage()` relies on the DB's `channel_message_id` UNIQUE constraint check (a `select` then `insert`, not an atomic upsert — acceptable since WhatsApp/Telegram retries are seconds apart, not concurrent, but worth revisiting if duplicate webhook deliveries ever race).
- Both webhook routes ack with `200` immediately and do the real work in `setImmediate(...)`, matching the Paystack webhook pattern in `routes/payments.ts` — required so Meta/Telegram never time out and retry-storm.
- `RegistrationAgentService.handleInboundMessage()` now also returns a `reply` (the next prompt to send) and captures `displayName` / `telegramUsername` / `phone` on session creation. The route sends that reply via `adapter.sendReply()`.
- **Not wired yet:** actually registering a webhook URL with Meta/Telegram (that's a one-time `setWebhook` API call + Meta App dashboard config, not application code — see plan section 5/6, left for Phase 6 deployment). `.env.railway` / `render.yaml` were **not modified** — add the new env vars there before deploying.
- `AI_REGISTRATION_ENABLED` gates both webhook handlers: while `false` (the documented default), both routes 200 immediately without processing, so merging this is safe even with no WhatsApp/Telegram app configured yet.
- Build verified with `pnpm run typecheck` — `artifacts/api-server` typechecks clean, including the two new adapters and routes.

### Phase 3 files
**Create** `routes/ai-registration.ts`, `services/registration/RegistrationService.ts`
**Modify** `routes/admin.ts` (extract booking creation), `lib/api-spec/openapi.yaml`, regenerate Orval

**Phase 3 completion notes (for whoever picks up Phase 4 — the admin UI):**
- `RegistrationService.createBooking()` now holds the exact pricing/capacity-lock/agent-discount/commission/visa/payment logic that used to live inline in `admin.ts`'s `/admin/book-pilgrim` handler. That route is now a thin wrapper — same request/response contract, same status codes (409 for capacity-full via the new `RegistrationError` class, 400 otherwise). `routes/ai-registration.ts`'s `/approve` endpoint calls the same function, so staff walk-ins and AI-approved registrations always create bookings through one code path.
- **Permission model differs from the plan's assumption.** Section 10 names `require2fa.ts` and implies a dedicated fine-grained gate; neither existed in the codebase. What *did* exist was `staffPermissionsTable` (userId + free-text `permission` string, already used for staff grants elsewhere) — unused as a runtime check anywhere else in the app. `requireAiRegistrationAccess()` in `routes/ai-registration.ts` is new: `admin`/`super_admin` bypass, `staff` role requires a row in `staffPermissionsTable` with `permission = "ai_registration:review"` or `"ai_registration:approve"`. There is currently **no UI to grant these two permission strings** — an admin would need to insert them directly or `routes/admin.ts`'s existing staff-permission endpoints would need the two new strings added to their allowed list (check `POST /admin/staff` / staff edit handlers before Phase 4 ships a UI that assumes staff can review).
- Endpoints implemented exactly per plan section 10: list (with status/channel/duplicateStatus/q filters + pagination), detail (+ audit timeline, + `ai_registration_viewed` audit row), PUT for staff corrections (diffed against prior reviewData/snapshot, audited as `reviewer_edited`), approve (duplicate re-check with override reason, creates booking, links session+submission), reject (reason required), retry-extraction (forces the fallback-capable extraction path, not literally "Mistral-only" — see note below), stats.
- **Deviation from spec section 10:** "retry-extraction (force Mistral)" is NOT implemented as a hard Mistral-only call. `extractPassport(..., { strict: false })` is reused, which still tries Gemini first. There's no plumbing in `PassportExtractionService` to force a specific provider. If a true "retry with Mistral only, skip Gemini" button is needed, add a `forceProvider` option to `extractPassport()`.
- **Passport image access**: `GET /admin/ai-registrations/:id/passport-image` is a new admin-gated streaming proxy (not a signed URL) — matches the plan's "signed URLs or admin-gated fetch" requirement in section 13. It re-checks `requireAiRegistrationAccess` itself rather than trusting a URL token, so it's safe to link directly from the review UI.
- **Not done:** `lib/api-spec/openapi.yaml` was NOT updated and Orval was NOT regenerated — the frontend has no typed client/hooks for these endpoints yet. Phase 4's admin UI will need to either add the OpenAPI paths + regenerate, or call these endpoints with hand-written fetch calls as an interim step.
- **Not done:** outbound WhatsApp/Telegram confirmation message on approve/reject (plan implies pilgrims should be notified). `createNotification()` only notifies the approving staff member's own dashboard right now, which is arguably not useful — revisit if pilgrim-facing confirmation messages are in scope.
- Build verified with `pnpm run typecheck` — clean on all new/modified files; same pre-existing unrelated failures in `agents.ts`, `flights.ts`, `payments.ts`, `scripts/` as before.

### Phase 4 files
**Create** `pages/admin/AdminAiRegistrations.tsx`, `pages/admin/AdminAiRegistrationDetail.tsx`
**Modify** `pages/admin/AdminConsole.tsx`

**Phase 4 completion notes:**
- Built as **one page**, not two. The plan named a separate `AdminAiRegistrationDetail.tsx`, but every structurally-similar page in this codebase (`AdminAmendments.tsx` — list of pending items → review → approve/reject) uses a single page with an inline review `Dialog`, and there is no precedent anywhere in `AdminConsole.tsx`'s routes for a `:id`-parameterized nested admin route (every route is a flat path). Matching the existing convention was a better call than introducing a new routing pattern for one page, so `AdminAiRegistrations.tsx` does list + review-dialog + approve/reject/retry-extraction/edit-fields all in one file. No `AdminAiRegistrationDetail.tsx` was created.
- **Permission model fixed, not just wired.** While building this I found the Phase 3 permission design (`ai_registration:review` / `ai_registration:approve` as two colon-namespaced keys) doesn't match this codebase's actual convention — every other admin page uses exactly one flat permission key (see `pages/admin/AdminStaff.tsx` `PAGE_PERMISSIONS`, e.g. `"amendments"`, `"bookings"`), with no precedent for splitting one page into separate view/action grants. I changed `routes/ai-registration.ts`'s `requireAiRegistrationAccess()` to use a single `"ai_registrations"` key (admin/super_admin still bypass) and added it to `PAGE_PERMISSIONS` in `AdminStaff.tsx` so staff can actually be granted access through the existing staff-management UI — this was previously ungrantable.
- Nav entry added under "Pilgrims & Travel" next to Amendments, route `/admin/ai-registrations`, using the `Bot` icon (already imported for the AI Assistant page).
- No typed API client — per the Phase 3 note, OpenAPI/Orval wasn't regenerated, so this page uses hand-written `fetch(..., { credentials: "include" })` calls exactly like `AdminAmendments.tsx` and `AdminPassports.tsx` do (neither uses the Orval client either, so this isn't a regression in consistency).
- Passport image preview reuses the pattern from `AdminPassports.tsx`'s proof-viewer dialog (`<img src="...">` directly) but points at the new admin-gated streaming endpoint (`GET /admin/ai-registrations/:id/passport-image`) instead of a data URL — the browser sends cookies automatically for the same-origin `<img>` request, so no manual auth header plumbing was needed.
- Editable fields are tracked as a local diff (`editedFields`) and only sent on explicit "Save Edits" (calls `PUT .../:id`) or folded into the approve payload — matching the backend's reviewData-merge behavior from Phase 3.
- Build verified with `pnpm run typecheck` across the whole workspace — `artifacts/raudah-travels` and `artifacts/api-server` both clean; only the same pre-existing unrelated `scripts` package failure remains.
- **Not done / left for Phase 5+:** no end-to-end browser test was run (dev server wasn't started) since there's no WhatsApp/Telegram traffic to generate real submissions to review yet — this is first exercisable once Phase 6 wires up real webhooks or a seed script inserts a fake `pending_review` submission.

---

## 18. Risks & Open Decisions

**Risks**
- WhatsApp template approval delays → start template drafting early; keep Telegram as the fast path to value
- 24h customer-service window → pre-approved templates for follow-ups
- Gemini quota exhaustion → Mistral fallback + alerting on fallback rate spike
- PII leakage via logs or public R2 URLs → masking + signed URLs
- TOCTOU on duplicate check → re-check inside approve transaction

**Open decisions (flagged, default chosen)**
1. Does the user pick a package conversationally, or does staff assign at review? → **bot offers 2–3 options; `packageId` nullable until review**
2. Auto-fill phone from WhatsApp sender? → **prefill + require explicit confirmation**
3. Retention for rejected submissions? → **30 days then purge media**
4. Bulk/family registration via WhatsApp? → **Implemented on 2026-10-04:** `/bulk N` (2-20), separate passports and human approvals, shared contact/package, and group-linked bookings. No automatic group approval.
5. Hausa language support? → **English v1, i18n-ready prompts**

---

## 19. Backwards Compatibility

- All new columns nullable/defaulted; no existing query changes
- `POST /api/passport/extract` keeps identical request/response contract (delegates to new service)
- New OpenAPI paths are additive; Orval regeneration adds hooks without breaking existing ones
- Existing backup script (`scripts/backup-all-users.mjs`) dumps `*` → new tables included automatically
