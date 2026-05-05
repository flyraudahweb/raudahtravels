# Session 6: Railway Deployment & Clerk Fixes

## Problem
The application experienced two major issues after migrating to Railway:
1. **Clerk UI Failed to Load**: Users encountered `failed_to_load_clerk_ui` in production.
2. **Broken Package Images**: The frontend attempted to load legacy image URLs (`localhost` or deprecated `.onrender.com` paths).

## Investigation & Fixes

### 1. The Clerk UI Error
- **Root Cause 1**: `VITE_CLERK_PUBLISHABLE_KEY` was missing from Railway during the Vite build step, leading to an empty key in the frontend bundle.
- **Root Cause 2**: The Replit-specific Clerk frontend API proxy (`/api/__clerk`) was failing to resolve correctly on Railway due to `x-forwarded-host` issues and missing backend secret keys, resulting in 404s when the browser attempted to download the Clerk JS bundle.
- **Resolution**:
  - Created `.env.railway` template and updated `deployment.md` to document proper environment variable staging.
  - Removed `proxyUrl="/api/__clerk"` from `App.tsx` entirely. Clerk now connects natively to `*.clerk.accounts.dev`.
  - Loosened the Content Security Policy (CSP) in `app.ts` to allow `https://*.clerk.dev` and `https://*.clerk.accounts.dev` in the `script-src` and `frame-src`.

### 2. Broken Image URLs
- **Root Cause**: Database entries carried over from local development contained `127.0.0.1` and relative paths which cannot resolve in a cloud environment.
- **Resolution**:
  - Implemented a robust `getPackageImage(id, url)` helper in `Packages.tsx`, `PackageDetail.tsx`, and `Home.tsx`.
  - The helper sanitizes inputs and automatically falls back to high-quality Pexels placeholders if the database URL is missing, relative, or contains dead hosts (`localhost`, `onrender.com`, `repl.co`).

## Key Takeaway for Future Agents
When deploying this monorepo outside of Replit:
1. **Never use the Clerk proxy (`/api/__clerk`)**. Rely on native Clerk multi-domain syncing.
2. **Environment Variables**: Vite requires `VITE_CLERK_PUBLISHABLE_KEY` *before* the build step runs in Nixpacks (Railway).
