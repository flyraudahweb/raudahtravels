# Walkthrough: Email, Hero & Agent Fixes

## 1. Email Encoding Fix (Critical)

**Problem:** Sending emails via the Resend SDK threw `"cannot convert argument to a bytestring"` errors because Node.js's `fetch` (undici) cannot handle non-ASCII characters in headers or body payloads.

**Root Causes Found:**
- The Resend SDK internally uses `fetch`, which triggers undici's strict Latin1 header validation
- The API key stored in the database contained invisible Unicode characters from copy-paste in the admin UI
- The test email subject and HTML contained non-ASCII characters (`—`, `✓`, `→`)

**Solution (3-layer fix):**
1. **Replaced Resend SDK with Node.js `https` module** — completely bypasses undici/fetch. Raw TCP has no character encoding restrictions.
2. **Added ASCII sanitizer** on config load — strips all non-printable/non-ASCII chars from API key and From email via `/.replace(/[^\x20-\x7E]/g, "").trim()`
3. **Made test email 100% ASCII** — replaced `—` with `-`, `✓` with `&#10003;`, `→` with `&gt;`

**Files Changed:**
- `artifacts/api-server/src/utils/email.ts` — `sendViaResend()` rewritten with `https.request()` + config sanitization
- `artifacts/api-server/src/routes/admin.ts` — Test email template cleaned to ASCII

---

## 2. Home Page Hero Redesign

**Problem:** User wanted the hero video section back alongside the text, using a specific YouTube embed URL.

**Solution:**
- Restored 2-column grid layout (text left, video right)
- Embedded `https://www.youtube.com/embed/zlUXmn4FJ0o` with autoplay+mute
- Polished video container with `rounded-3xl`, shadow, and indigo blur glow
- Retained the fullscreen background slideshow (4 Pexels images cycling every 5s)
- Cleaned up ~100 lines of dead code (`getEmbedUrl`, `HeroVideoCard`, `DEFAULT_HERO_VIDEO`)

**File Changed:**
- `artifacts/raudah-travels/src/pages/public/Home.tsx`

---

## 3. Agent List Pagination Bug

**Problem:** Admin page showed "39 Approved" in stats but only "20 Active Agents" in the tab.

**Root Causes Found:**
1. **API default limit was 20** — `GET /agents` had `limit = "20"` as default, and the frontend never passed a larger value. This silently truncated the list.
2. **Two different data sources** — "39 Approved" counts from `agent_applications` table, while "Active Agents" counts from the `agents` table. These are separate tables; some approved applications may not have created corresponding agent records (e.g., Clerk API timeouts during creation).

**Solution:**
- Increased default limit from `20` to `500`
- Added per-status breakdown counts (`active`, `suspended`, `blocked`, `pending`) to the API response for future use

**File Changed:**
- `artifacts/api-server/src/routes/agents.ts` — `GET /agents` endpoint

---

## 4. Admin Dashboard Pagination & Defaults

**Problem:** The increased list of agents (up to 500) could clutter the active agents tab. Additionally, agent commission defaulted to 10% which the user wanted to be 0%, and the Amendments route had the same `limit=20` bug.

**Solution:**
1. **Frontend Pagination:** Added client-side pagination to the "Active Agents" tab (`AdminAgents.tsx`). It now slices the `activeAgents` array into chunks of 15 and provides `ChevronLeft` and `ChevronRight` navigation controls along with direct page number buttons.
2. **Commission Defaults:** 
   - Updated backend routes (`/admin/agents/create` and `/admin/agent-applications/:id/approve`) to default `commissionRate` to `0` instead of `10`.
   - Updated frontend form states in `AdminAgents.tsx` to initialize `commissionRate` at `"0"`.
3. **Amendment Pagination Fix:** Increased the default limit in `GET /admin/amendments` from `20` to `500`.

**Files Changed:**
- `artifacts/raudah-travels/src/pages/admin/AdminAgents.tsx` (Pagination UI & Form Defaults)
- `artifacts/api-server/src/routes/admin.ts` (API Defaults & Limits)
