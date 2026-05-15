# Agent Lifecycle Controls — Completed ✅

## Done
- [x] Backend: `PUT /admin/agents/:id/status` (suspend/block/unsuspend/unblock)
- [x] Backend: `DELETE /admin/agents/:id` (delete agent + cascade cleanup)
- [x] Backend: `DELETE /admin/agent-applications/:id` (delete applications)
- [x] Backend: `ensureActiveAgent` guard on agent routes (403 for suspended/blocked)
- [x] Frontend: Suspend / Block / Delete buttons on Active Agents tab
- [x] Frontend: "Suspended" tab with Unsuspend/Unblock/Delete for inactive agents
- [x] Frontend: Delete button on Pending and Rejected application tabs
- [x] Frontend: Confirmation dialogs for all destructive actions
- [x] Frontend: Agent portal guard (full-page notice for suspended/blocked agents)
- [x] Schema: Added `blocked` to `agent_status` PostgreSQL enum
- [x] Pushed to GitHub → Railway deploying

# Admin Users Page — Completed ✅

## Done
- [x] Schema: Added `account_status` field to profiles table
- [x] Backend: `GET /admin/users` (list all users with role/status/search filters + pagination)
- [x] Backend: `PUT /admin/users/:id/status` (suspend/block/activate any user)
- [x] Frontend: Full AdminUsers page with stats, filters, table, mobile cards, pagination
- [x] Frontend: User Dashboard suspension guard (shows notice page for suspended/blocked users)
- [x] Admin Console: Wired Users page into sidebar nav and routes
- [x] Migration: `0003_add_account_status_to_profiles.sql`
- [x] Pushed to GitHub → Railway deploying

# Email Infrastructure Fixes — Completed ✅

## Done
- [x] Replaced Resend SDK with Node.js `https` module (bypasses undici bytestring encoding bug)
- [x] Added ASCII sanitizer for API key and From email (strips invisible Unicode from copy-paste)
- [x] Made test email HTML fully ASCII (HTML entities for special chars)
- [x] Added `/admin/email/debug` diagnostic endpoint
- [x] Pushed to GitHub → Railway deploying

# Home Page Hero — Completed ✅

## Done
- [x] Added YouTube video embed (`zlUXmn4FJ0o`) alongside hero text in 2-column grid
- [x] Retained fullscreen background slideshow (4 images, 5s cycle)
- [x] Polished video container (rounded corners, shadow, indigo glow)
- [x] Removed unused `getEmbedUrl`, `HeroVideoCard`, `DEFAULT_HERO_VIDEO` dead code
- [x] Pushed to GitHub → Railway deploying

# Agent List Pagination Fix — Completed ✅

## Done
- [x] Fixed `GET /agents` default limit from 20 → 500 (was silently truncating agent list)
- [x] Added per-status breakdown counts (active/suspended/blocked/pending) to API response
- [x] Pushed to GitHub → Railway deploying
