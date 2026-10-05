# AI registration release and operations

Implementation verified locally on 2026-10-04. The currently configured database was snapshotted (33 application tables plus schema metadata) and migrations 0007/0008 were applied on 2026-10-04. The private JSON snapshot and checksum are in ignored `backups/`; this is an application data snapshot, not a native PostgreSQL cluster backup. A persistent local encryption key was generated in ignored `.env`. Every service sharing this database must use the same persistent encryption key. Remote deployments must configure that key in their secret manager and apply migrations to any separate target database. Live read-only checks passed for Gemini model metadata, Mistral vision-model access and R2 bucket head/list operations. Live activation is pending channel credentials, Meta template approval, deployment configuration, privacy/write-access validation and extraction/messaging smoke tests. Do not treat local tests as evidence that production webhooks are registered.

## Release checks

Run from the monorepo root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck
pnpm --filter @workspace/api-server test
pnpm run build:api
pnpm run build:frontend
```

The tests start a disposable local PostgreSQL cluster and apply migrations 0007 and 0008. They do not use the application's DATABASE_URL. Channel sending, storage and AI provider calls are mocked. Coverage includes signed webhooks, persistence before acknowledgement, duplicate deliveries, ordered processing, rollback/retry, permission escalation, manual extraction review, duplicate override, simultaneous approvals, capacity, visa creation, final-state guards, provider fallback, Mistral-only retry, media limits, expiry/resume, and 30-day cleanup. Linux CI runs the same commands; CI has not been run remotely until these changes are pushed.

## Configure the service

Use an always-on deployment, PostgreSQL, and a private R2 bucket. The R2 service credentials need bucket listing plus object read, write and delete permissions for intake and retention. The Render blueprint selects Starter; applying that blueprint may incur hosting charges. Railway and Render use `/api/readyz` to check database readiness. Keep `/api/healthz` for basic liveness.

Set the bootstrap configuration in the deployment's secret manager. Do not commit values:

- `DATABASE_URL`, Clerk keys, and `APP_URL` (the public HTTPS API origin).
- `SETTINGS_ENCRYPTION_KEY`: a persistent **64-character hexadecimal** AES key. Generate once with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Keep it private and back it up separately with the database. All app instances sharing one database must use the same key; use separate keys only with separate databases. Losing or changing this key makes saved credentials unreadable; rotating the key requires re-encrypting the stored secrets before switching it.
- `AI_REGISTRATION_ENABLED=false` for initial setup. The admin enable switch overrides this fallback after settings are saved.
- `TRUST_PROXY_HOPS`: the exact number of trusted proxies; use 0 for direct access. Render's blueprint assumes 1.

In **Admin > Settings > AI Registration Agent**, enter the WhatsApp access token, app secret, phone number ID, verification token, supported API version, approved review template and language; Telegram bot token and webhook secret; Gemini/Mistral keys and models; and private Cloudflare R2 account, bucket and access credentials. Session expiry, message limits, automatic fallback and the enable switch are also managed here. Existing environment variables continue to work as fallbacks. Existing AI Integration keys are used when the registration-specific AI key is blank and no dedicated key has been saved.

Secrets use AES-256-GCM encryption with a random nonce and field-specific authentication. Only admin/super_admin accounts can read or change this settings section; GET and PUT responses never return secrets or ciphertext. Empty secret inputs preserve saved credentials; entering a replacement rotates a credential. Settings changes apply to subsequent webhook, queue, storage and extraction operations without a restart. The generic settings endpoint cannot bypass this credential-saving path. Activity logs record changed field names, never values.

Create a private R2 bucket first and grant get, put, list and delete access. Once a storage location is configured, the admin panel permits access-key rotation but refuses account or bucket moves. A location change requires a deployment migration of existing files and their references. `R2_ENDPOINT`, if configured for an S3-compatible deployment, remains a deployment setting.

For WhatsApp, use a Meta-approved review utility template with **two body parameters**: outcome and booking reference/rejection reason. Choose the API version and language supported by your Meta app/template. The app cannot approve a template on your behalf. Telegram requires a strong webhook secret using letters, digits, underscores or hyphens and private chats for intake.

Click **Test provider connections** after saving to check WhatsApp phone-number token access, Telegram bot identity and webhook URL, Gemini model metadata, Mistral vision model availability, and R2 bucket access/listing. Checks make only read requests, use bounded timeouts, are limited to three runs per administrator per minute, and sanitize provider errors so tokens cannot leak into responses. A passed check does not establish template approval, passport extraction accuracy, message delivery, bucket privacy or object write/delete access. Existing AI Integration keys are checked when dedicated registration keys are absent.

Click **Check saved configuration** after saving. It checks required settings and migration/index presence without sending messages. It does **not** validate provider credentials, template approval, bucket privacy or model access. Enabling the feature runs the same checks. Startup also validates enabled saved configuration. Live acceptance checks remain required.

### Registration settings API

Administrator-only routes: `GET /api/admin/registration-settings`, `PUT /api/admin/registration-settings` (validated partial update), and `POST /api/admin/registration-settings/check`, and `POST /api/admin/registration-settings/test-connections`. The existing `site_settings` JSON field holds the configuration; no new migration is needed for these settings or bulk metadata. All save operations are atomic and serialized to prevent lost credential updates.

## Apply migrations

Back up the target database, verify its identity, then run in the deployment environment:

```sh
pnpm --filter @workspace/api-server run migrate:ai-registration
```

This dedicated runner applies 0007 when the AI tables are absent and applies the additive reliability migration 0008. It uses a transaction and advisory lock and is safe to repeat. It does not update Drizzle's historical migration ledger; use this runner for this feature on deployments whose earlier schema was managed with `db:push`. Do not interchange the manual runner and a new wholesale Drizzle migration against an existing production database.

If migration 0008 reports a duplicate `bookings.ai_session_id`, stop and investigate the existing duplicate bookings. The migration deliberately does not delete booking data or silently discard duplicates. Roll back the transaction and resolve those records before retrying.

## Register webhooks and activate

1. In Meta, register `APP_URL/api/whatsapp/webhook`, use the verification token, and subscribe the app to inbound messages for the intended WhatsApp business account. Confirm the phone number and template can send.
2. Register `APP_URL/api/telegram/webhook` through Telegram's `setWebhook`, with `secret_token` equal to `TELEGRAM_WEBHOOK_SECRET` and `allowed_updates` containing `message` and `callback_query`. Use a server-side script or the provider dashboard; do not paste bot tokens into shared browser URLs or logs.
3. Enable registration in **Admin > Settings > AI Registration Agent**. No restart is required.
4. Confirm `/api/readyz` returns 200. Check authenticated `/api/health/details` and the admin registration statistics.
5. Complete the smoke checks below before announcing availability.

## Bulk registration and safe testing

Send `/bulk N` from a private WhatsApp or Telegram chat, where N is 2–20. Supply the first pilgrim's name, contact, package, passport photo and confirmation. The bot then prompts for the next pilgrim; contact and package are reused, but name, passport extraction and confirmation are separate. Send `phone: ...` to change the contact for a subsequent pilgrim. Each frozen draft carries `bulkId`, `bulkSize` and `bulkIndex`, visible in the review list. Approval copies the group ID to the existing booking `batchId`. Group intake does not reserve capacity or create bookings until individual staff approval. Duplicate-image/passport checks are still enforced for each person. Cancellation stops the current intake; previously submitted drafts remain for staff review. Photo albums are processed in arrival order, but a group still requires separate per-person confirmations; they are not auto-approved as a batch.

For automated testing, run `pnpm --filter @workspace/api-server test`. This starts a disposable database and mocks delivery, storage and AI. It cannot message real users, consume live capacity or write to the application's configured database. The suite includes encrypted saves, redacted reads, blank-secret preservation, webhook secret rotation, permissions, storage location protection, expiry settings, bulk intake/cancellation and group booking creation, alongside existing registration tests.

For live chat testing, use a staging deployment or dedicated test package and consenting testers. Send `/start` for a single pilgrim and `/bulk 2` for a group. Review drafts before any approval. **Live approval creates a real booking and consumes capacity**; on production, reject test drafts unless the registration is intended to be real. There is no simulated-approval button in the production admin panel.

## Live smoke checks

- Send `/start` from a consenting test user in each configured channel; select a real active package and upload a test passport image with permission.
- Confirm a pending review record appears and **no booking exists** before approval.
- Save a reviewer correction, retry extraction with Mistral, and verify the displayed fields change.
- Approve once; confirm exactly one booking, the correct server price, capacity increment, visa application, review metadata, audit, and outcome delivery.
- Retry approval and duplicate webhook delivery; confirm no extra booking or capacity increment.
- Reject a second submission; confirm the reason is retained and the user receives the rejection outcome.
- Test a blurry photo, unsupported file, expired session resume, confirmed duplicate with/without override, capacity exhaustion, and staff access without the grant.
- Send `/bulk 2`; confirm two separate review drafts with the same group ID, independent passports and shared contact/package. Approve each separately; confirm two bookings with the same `batchId`, individual references, correct total capacity increment and two outcomes.
- Rotate a webhook secret in Settings; confirm the old secret fails and the new one works without restarting.
- Exercise WhatsApp review outcome delivery after the 24-hour service window using the approved template.
- Verify the bucket is private and passport access fails without staff authentication.

These are external acceptance checks. They are not completed by the local mocked tests.

## Operating the queue

Webhooks authenticate and commit normalized messages to Postgres before returning 200. A database failure returns 503 so the platform can retry. A sender's jobs retain their arrival order through a database-generated sequence. An earlier failed job blocks later messages for that sender until staff retry or skip it. Other senders can continue.

The worker runs every second, uses row locks with `SKIP LOCKED`, and commits intake state, message records, submissions and queued replies together. Storage and extraction have bounded network timeouts. Jobs retry with backoff and become visible in the admin failed-job panel after six failed worker attempts. Outbound adapters also attempt HTTP sends up to three times. A staff retry resets the job; skipping requires an audited reason and discards that message. Review the failure before choosing to skip.

Outbound delivery is **at least once**: a platform can accept a send immediately before the database connection fails. A retry may repeat that message. Booking creation remains protected by the approval transaction and unique AI session index. Do not promise exactly-once third-party message delivery.

The admin queue/stats endpoints show pending/completed/failed counts, oldest pending timestamps, provider totals and fallback counts. Monitor persistent failures and growing queue age. The review page refreshes statistics and registrations every 30 seconds and exposes retry, skip and retention actions.

Expiry and retention run every 30 minutes. Rejected, expired and cancelled sessions older than 30 days have all recorded passport attachments deleted from R2 and their media links cleared. Approved bookings retain their passports. Unreferenced uploads left by failed transactions are also removed after 30 days, with all live session/submission attachment references protected. Completed/failed job payloads are scrubbed after 30 days; scrubbed failed jobs cannot be retried. Message transcripts and structured review records are not deleted by media retention.

Grant the flat `ai_registrations` permission through Admin Staff. This repository intentionally uses one permission for review and approval; admin/super_admin bypass it. There is no separate approval-specific second-factor challenge in this implementation. Enforce MFA for privileged Clerk accounts in the identity-provider configuration before live activation.

## Disable or roll back

Disable registration in Admin Settings (or set `AI_REGISTRATION_ENABLED=false` if no saved override exists) to stop intake/worker processing, then unregister provider webhooks to avoid silently acknowledging messages while the feature is disabled. Preserve the additive schema and queued records. Do not drop AI tables or booking columns as an emergency rollback. Restore the previous application build only after checking its compatibility with existing review records and protecting passport media.

## Provider references

- [Google model lifecycle](https://ai.google.dev/gemini-api/docs/deprecations): the original Gemini 2.0 model is retired; model IDs are configurable.
- [Mistral vision](https://docs.mistral.ai/studio/conversations/vision).
- [Telegram webhook API](https://core.telegram.org/bots/api#setwebhook).

Additional connection-check references: [Telegram getMe](https://core.telegram.org/bots/api#getme), [Gemini models](https://ai.google.dev/api/models), [Mistral models](https://docs.mistral.ai/api/endpoint/models).
