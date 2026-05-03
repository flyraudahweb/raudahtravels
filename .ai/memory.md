# 🧠 Raudah Travels: AI Memory Root

> **Agent Instruction**: This is the source of truth for the project context. Before starting any task, read this file and its linked context documents.

## 🏗️ Project Architecture
- **Type**: PNPM Monorepo
- **Frontend**: React/Vite (Port 5173) - [architecture.md](file:///c:/Users/DEEPMIND/Downloads/Travel-Master-Guide-main/Travel-Master-Guide-main/.ai/context/architecture.md)
- **Backend**: Express API (Port 8080)
- **Database**: Neon PostgreSQL (Drizzle ORM)
- **Auth**: Clerk

## 🛠️ Critical Workflows
### Environment Variables
- **Local Dev**: Use a single root `.env` file.
- **Node Execution**: Use the `--env-file=../../.env` flag for Node scripts (required for Node 20.6+). This ensures environment variables are loaded before ESM imports are evaluated.
- **Vite**: Configured to load `.env` from the monorepo root via `envDir`.

### Database Migrations
- **Issue**: Windows to Neon connections often drop (`ECONNRESET`) during large SQL migrations.
- **Solution**: Always execute raw SQL from `lib/db/drizzle/` directly in the Neon Dashboard SQL Editor.

## 🚀 Active Development
- See [current_sprint.md](file:///c:/Users/DEEPMIND/Downloads/Travel-Master-Guide-main/Travel-Master-Guide-main/.ai/epic/current_sprint.md) for the active focus.

## 📜 Session History
- [Session 1: Replit Migration](file:///c:/Users/DEEPMIND/Downloads/Travel-Master-Guide-main/Travel-Master-Guide-main/.ai/logs/session_1_replit_migration.md)
