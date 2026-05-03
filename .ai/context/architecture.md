# System Architecture & Index

This document serves as a map for AI agents to quickly understand the structure of the Raudah Travels monorepo.

## Monorepo Structure (`pnpm`)

The project is a `pnpm` workspace defined in `pnpm-workspace.yaml`.

- `artifacts/raudah-travels`: **The React/Vite Frontend**
  - **Framework**: React 19 + Vite + Tailwind CSS v4 + Radix UI (shadcn/ui).
  - **Routing**: `wouter` (client-side routing).
  - **State/Data**: `@tanstack/react-query` for API fetching.
  - **Authentication**: Clerk React SDK (`@clerk/react`).
  - **Configuration**: Uses `envDir: "../../"` to load environment variables from the root `.env` file.

- `artifacts/api-server`: **The Node.js/Express Backend**
  - **Framework**: Express.js with TypeScript.
  - **Authentication**: Clerk Express SDK (`@clerk/express`) via a custom proxy middleware to handle cross-origin auth seamlessly.
  - **Database ORM**: Drizzle ORM (imported from `@workspace/db`).
  - **Payments**: Paystack webhook integration.
  - **Production Serving**: In production (`NODE_ENV=production`), this server statically serves the built frontend files from `artifacts/raudah-travels/dist/public` (Option B: Single Service Deployment).

- `lib/db`: **The Database Layer**
  - **ORM**: Drizzle ORM + Drizzle Kit.
  - **Database**: PostgreSQL (hosted on Neon).
  - **Schema**: Located in `lib/db/src/schema/`. 32 distinct tables covering agents, packages, bookings, wallets, and support tickets.
  - **Connection**: Requires SSL (`sslmode=require`) to connect to hosted providers like Neon.

- `artifacts/mockup-sandbox`: **UI Prototyping**
  - A secondary Vite workspace used for building isolated UI components and testing them outside of the main app routing context.

## Deployment Strategy
- **Platform**: Render (Web Service).
- **Configuration**: Managed via `render.yaml` at the root.
- **Build Script**: `render-build.sh` handles installing dependencies and building both the API and the frontend.
- **Execution**: Render runs the built API server `dist/index.mjs`, which handles both API routes and static frontend serving.

## Essential Commands (Run from Root)
- `pnpm install`: Install all workspace dependencies.
- `pnpm run dev`: Starts the frontend and backend servers concurrently.
- `pnpm run build`: Builds all workspaces.
- `pnpm run db:push`: Attempts to push schema to the DB (Note: See `status.md` for known Windows/Neon connection issues).
