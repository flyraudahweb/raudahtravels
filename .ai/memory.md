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
- See [current_sprint.md](file:///c:/Users/DEEPMIND/Downloads/Travel-Master-Guide-main/Travel-Master-Guide-main/.ai/epic/current_sprint.md) for the active focus.

## 📜 Session History
- [Session 1: Replit Migration](file:///c:/Users/DEEPMIND/Downloads/Travel-Master-Guide-main/Travel-Master-Guide-main/.ai/logs/session_1_replit_migration.md)
- [Session 5: Availability UI & Data Integrity](file:///c:/Users/DEEPMIND/Downloads/Travel-Master-Guide-main/Travel-Master-Guide-main/.ai/logs/session_5_availability_ui.md)
- [Session 6: Railway Deployment & Clerk Fixes](file:///c:/Users/DEEPMIND/Downloads/Travel-Master-Guide-main/Travel-Master-Guide-main/.ai/logs/session_6_railway_deployment.md)
