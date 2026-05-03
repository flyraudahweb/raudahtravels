# Deployment Guide — Raudah Travels & Tours

This guide covers deploying the platform outside of Replit, onto standard cloud infrastructure. The app has two services that must both be running:

1. **API Server** — Node.js Express app (built to `artifacts/api-server/dist/index.mjs`)
2. **Frontend** — Static React/Vite build (built to `artifacts/raudah-travels/dist/public/`)

Both services sit behind a **single domain** using path-based routing: `/api/*` → API server, `/*` → frontend static files.

---

## Platform Recommendations

### Free / Low-cost options

| Platform | What to host | Notes |
|----------|-------------|-------|
| **Render** (render.com) | API server + static site | Best free tier for this stack. Free Web Service (750 hrs/mo) + free Static Site. Spins down on inactivity on free plan — upgrade to Starter ($7/mo) for always-on. |
| **Railway** (railway.app) | API server + static site | $5/mo Hobby plan — no sleep, generous limits. Easiest single-command deploy from GitHub. |
| **Fly.io** (fly.io) | API server | Free allowance covers a small Node app. Static files best served via Cloudflare Pages. |
| **Vercel** (vercel.com) | Frontend only | Excellent CDN for static React build. Pair with Render/Railway for the API. Free. |
| **Cloudflare Pages** (pages.cloudflare.com) | Frontend only | Fastest global CDN. Free unlimited bandwidth. Pair with any API host. |
| **Neon** (neon.tech) | PostgreSQL database | Free tier: 0.5 GB storage, 1 compute unit, auto-suspends. Serverless-friendly connection pooling. |
| **Supabase** (supabase.com) | PostgreSQL database | Free tier: 500 MB DB, pauses after 1 week of inactivity. Good dashboard + connection pooler. |
| **Aiven** (aiven.io) | PostgreSQL database | Free trial with $300 credit. Good for production-grade managed PG. |

### Paid / production-grade options

| Platform | What to host | Cost (approx.) | Notes |
|----------|-------------|----------------|-------|
| **Render Starter** | API + static | ~$7–14/mo | No sleep, custom domains, auto-deploy from GitHub |
| **Railway Pro** | Full stack | ~$20/mo | Best DX, one-click GitHub deploys, built-in PG |
| **DigitalOcean App Platform** | Full stack | ~$12–25/mo | Reliable, Nigerian-friendly billing, good docs |
| **AWS Elastic Beanstalk + RDS** | Full stack | ~$30–80/mo | Enterprise grade, most control, steepest learning curve |
| **Google Cloud Run + Cloud SQL** | Full stack | ~$15–50/mo | Scales to zero between requests, good for variable traffic |
| **Heroku** | Full stack | ~$25/mo | Classic option, easy deploys, Postgres add-on available |
| **Neon Scale** | PostgreSQL | ~$19/mo | Production-grade serverless PG, no auto-suspend, branching |
| **Supabase Pro** | PostgreSQL | ~$25/mo | Includes auth, storage, realtime (though this app uses Clerk) |

**Recommended production setup (best value):**
- **Railway** for API server ($5/mo Hobby)
- **Cloudflare Pages** for frontend (free)
- **Neon** for PostgreSQL (free → Scale as you grow)
- Total: ~$5/mo to start, scales gracefully

---

## Prerequisites

Before deploying, you need:

1. A **Clerk** application at [clerk.com](https://clerk.com) — free for 10,000 MAU
2. A **PostgreSQL** database (Neon, Supabase, or Railway built-in)
3. A **Paystack** business account at [paystack.com](https://paystack.com) (required for Nigerian card payments)
4. Optionally, a **Google AI Studio** API key at [aistudio.google.com](https://aistudio.google.com) (for Passport OCR)

---

## Step 1 — Set Up the Database (Neon)

1. Go to [neon.tech](https://neon.tech) → Create project → choose a region close to Nigeria (e.g. `eu-west-1` or `us-east-1`)
2. Copy the **connection string** — it looks like:
   ```
   postgresql://user:password@ep-xyz.eu-west-1.aws.neon.tech/neondb?sslmode=require
   ```
3. Run the database migrations. From your local machine (or CI):
   ```bash
   export DATABASE_URL="postgresql://user:password@..."
   psql "$DATABASE_URL" < lib/db/migrations/0000_initial.sql
   ```
   Or push schema directly with Drizzle:
   ```bash
   pnpm --filter @workspace/db run push
   ```

---

## Step 2 — Set Up Clerk

1. Go to [clerk.com](https://clerk.com) → Create application → name it "Raudah Travels"
2. Enable desired sign-in methods (Email, Google, Phone OTP)
3. Under **API Keys**, copy:
   - `CLERK_PUBLISHABLE_KEY` (starts with `pk_`)
   - `CLERK_SECRET_KEY` (starts with `sk_`)
4. Under **Domains**, add your production domain (e.g. `flyraudah.com.ng`)
5. Under **JWT Templates**, ensure the default session token is active

---

## Step 3 — Build the Project

```bash
# Install dependencies
pnpm install

# Build the API server
pnpm --filter @workspace/api-server run build
# Output: artifacts/api-server/dist/index.mjs

# Build the frontend
pnpm --filter @workspace/raudah-travels run build
# Output: artifacts/raudah-travels/dist/public/
```

The frontend build requires one build-time env var:
```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_key pnpm --filter @workspace/raudah-travels run build
```

---

## Step 4A — Deploy on Render (Recommended Free Option)

### Deploy the API Server (Web Service)

1. Push your code to GitHub
2. Go to [render.com](https://render.com) → New → **Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Name:** `raudah-api`
   - **Root Directory:** _(leave blank — monorepo root)_
   - **Build Command:**
     ```bash
     npm install -g pnpm && pnpm install && pnpm --filter @workspace/api-server run build
     ```
   - **Start Command:**
     ```bash
     node --enable-source-maps artifacts/api-server/dist/index.mjs
     ```
   - **Instance Type:** Free (or Starter $7/mo for no sleep)
5. Add **Environment Variables**:
   ```
   DATABASE_URL        = postgresql://...
   CLERK_PUBLISHABLE_KEY = pk_live_...
   CLERK_SECRET_KEY    = sk_live_...
   SESSION_SECRET      = <random 64-char string>
   PAYSTACK_PUBLIC_KEY = pk_live_...   (optional - can set in Admin Settings)
   PAYSTACK_SECRET_KEY = sk_live_...   (optional - can set in Admin Settings)
   NODE_ENV            = production
   PORT                = 10000
   ```
6. Click **Create Web Service** — Render will build and deploy

### Deploy the Frontend (Static Site)

1. New → **Static Site**
2. Settings:
   - **Name:** `raudah-frontend`
   - **Build Command:**
     ```bash
     npm install -g pnpm && pnpm install && VITE_CLERK_PUBLISHABLE_KEY=pk_live_... pnpm --filter @workspace/raudah-travels run build
     ```
   - **Publish Directory:** `artifacts/raudah-travels/dist/public`
3. Add **Rewrite Rule:**
   - Source: `/*`
   - Destination: `/index.html`
   - Action: Rewrite
4. Click **Create Static Site**

### Connect the Two Services

In your frontend's Render settings, set:
```
VITE_API_BASE_URL = https://raudah-api.onrender.com
```

Or if using a custom domain with a **Cloudflare** proxy to route `/api/*` to Render and `/*` to the static site, no env var changes are needed — the frontend already uses relative `/api/...` paths.

---

## Step 4B — Deploy on Railway

Railway is the simplest option for a monorepo with both services.

1. Go to [railway.app](https://railway.app) → New Project → **Deploy from GitHub**
2. Select your repo
3. Railway auto-detects the project. Add two services manually:

### Service 1: API Server
- **Start Command:** `node --enable-source-maps artifacts/api-server/dist/index.mjs`
- **Build Command:** `pnpm install && pnpm --filter @workspace/api-server run build`
- Environment variables: (same list as Render above)
- Railway provides `PORT` automatically

### Service 2: Frontend (static)
- **Build Command:** `pnpm install && pnpm --filter @workspace/raudah-travels run build`
- **Start Command:** Not needed — set as **Static** serving `artifacts/raudah-travels/dist/public`

### Optional: Add PostgreSQL
- Railway → New → **Database → PostgreSQL**
- Copy the `DATABASE_URL` and set it on the API service
- Railway auto-injects `DATABASE_URL` if you link the database to the service

---

## Step 4C — Deploy on Fly.io (API) + Cloudflare Pages (Frontend)

### API Server on Fly.io

1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. From project root:
   ```bash
   fly launch --name raudah-api
   ```
3. Edit the generated `fly.toml`:
   ```toml
   [build]
     [build.args]
       NODE_VERSION = "24"

   [http_service]
     internal_port = 8080
     force_https = true

   [[vm]]
     memory = "512mb"
     cpu_kind = "shared"
     cpus = 1
   ```
4. Create a `Dockerfile` at the project root:
   ```dockerfile
   FROM node:24-slim
   WORKDIR /app
   RUN npm install -g pnpm
   COPY . .
   RUN pnpm install
   RUN pnpm --filter @workspace/api-server run build
   EXPOSE 8080
   CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
   ```
5. Set secrets:
   ```bash
   fly secrets set DATABASE_URL="postgresql://..."
   fly secrets set CLERK_SECRET_KEY="sk_live_..."
   fly secrets set SESSION_SECRET="..."
   fly secrets set NODE_ENV="production"
   ```
6. Deploy: `fly deploy`

### Frontend on Cloudflare Pages

1. Go to [pages.cloudflare.com](https://pages.cloudflare.com) → Create project → Connect GitHub
2. Build settings:
   - **Framework preset:** None
   - **Build command:** `npm install -g pnpm && pnpm install && pnpm --filter @workspace/raudah-travels run build`
   - **Build output directory:** `artifacts/raudah-travels/dist/public`
3. Environment variables:
   ```
   VITE_CLERK_PUBLISHABLE_KEY = pk_live_...
   ```
4. Under **Settings → Functions → Routes**, add:
   ```
   /api/* → https://raudah-api.fly.dev/api/*
   ```
   Or configure Cloudflare Workers to proxy `/api/*` to your Fly.io app.

---

## Step 4D — DigitalOcean App Platform

1. Go to [cloud.digitalocean.com/apps](https://cloud.digitalocean.com/apps) → Create App
2. Connect GitHub repo
3. Add two components:

**Component 1 — API (Web Service)**
- Source directory: `/` (monorepo root)
- Build command: `npm install -g pnpm && pnpm install && pnpm --filter @workspace/api-server run build`
- Run command: `node --enable-source-maps artifacts/api-server/dist/index.mjs`
- HTTP port: 8080
- Route: `/api`

**Component 2 — Frontend (Static Site)**
- Build command: `npm install -g pnpm && pnpm install && pnpm --filter @workspace/raudah-travels run build`
- Output directory: `artifacts/raudah-travels/dist/public`
- Route: `/`
- Add a catchall rewrite `/* → /index.html`

4. Add all environment variables under **App-Level Env Vars**
5. Click **Create Resources**

---

## Step 5 — Configure Paystack Webhook

After deployment, set the Paystack webhook URL so online payments confirm automatically:

1. Log in to your deployed app as **super_admin**
2. Go to **Admin → Settings → Payment Gateway** — copy the webhook URL shown there:
   ```
   https://yourdomain.com/api/payments/paystack/webhook
   ```
3. Paste this URL in your **Paystack Dashboard → Settings → API Keys & Webhooks**
4. Paystack will now call this URL when payments complete, automatically confirming bookings

---

## Step 6 — First Login Setup

1. Sign up at your deployed URL — first registered user gets `user` role by default
2. To make yourself super_admin, run this against your database:
   ```sql
   UPDATE profiles SET role = 'super_admin' WHERE email = 'your@email.com';
   ```
3. Log in and go to **Admin → Settings** to:
   - Set contact information
   - Add Paystack API keys (if not set via env vars)
   - Optionally add a Gemini API key for Passport OCR

---

## Environment Variables Reference

Complete list of all variables needed:

```env
# === REQUIRED ===

# PostgreSQL connection string
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require

# Clerk authentication
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...   # frontend build-time only

# Session
SESSION_SECRET=a-very-long-random-string-at-least-64-chars

# Runtime
NODE_ENV=production
PORT=8080

# === OPTIONAL (can be set in Admin Settings instead) ===

# Paystack payments
PAYSTACK_PUBLIC_KEY=pk_live_...
PAYSTACK_SECRET_KEY=sk_live_...
```

> **Note:** `VITE_CLERK_PUBLISHABLE_KEY` is only needed at build time for the frontend. It is embedded into the JavaScript bundle, not used at runtime.

---

## Docker Compose (Self-hosted)

For VPS hosting (DigitalOcean Droplet, Hetzner, etc.):

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: raudah
      POSTGRES_USER: raudah
      POSTGRES_PASSWORD: changeme
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U raudah"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://raudah:changeme@postgres:5432/raudah
      CLERK_PUBLISHABLE_KEY: pk_live_...
      CLERK_SECRET_KEY: sk_live_...
      SESSION_SECRET: your-session-secret
      NODE_ENV: production
      PORT: 8080
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    image: nginx:alpine
    volumes:
      - ./artifacts/raudah-travels/dist/public:/usr/share/nginx/html:ro
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    ports:
      - "80:80"
    depends_on:
      - api

volumes:
  pgdata:
```

`nginx.conf`:
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://api:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Custom Domain Setup

### With Cloudflare (recommended)
1. Add your domain to Cloudflare → update nameservers at your registrar
2. Add DNS records pointing to your host's IP
3. Enable "Proxied" (orange cloud) for DDoS protection + free SSL
4. Under **SSL/TLS**, set mode to **Full (strict)**
5. Paystack webhooks work fine behind Cloudflare

### SSL Certificate (without Cloudflare)
On any VPS with nginx, use Let's Encrypt:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## Health Check Endpoint

The API server exposes a health check at:
```
GET /api/healthz
```
Returns `200 OK` with `{ "status": "ok" }`. Use this for:
- Load balancer health checks
- Uptime monitoring (UptimeRobot free tier works well)
- Container health checks in Kubernetes / Docker Compose

---

## Troubleshooting

### "Cannot find module" errors on startup
Run the build step before starting: `pnpm --filter @workspace/api-server run build`

### Database connection refused
- Confirm `DATABASE_URL` ends with `?sslmode=require` for hosted PG (Neon, Supabase, etc.)
- Local Docker: use `postgres` as hostname, not `localhost`

### Clerk authentication not working
- Ensure `CLERK_PUBLISHABLE_KEY` matches the `VITE_CLERK_PUBLISHABLE_KEY` used at frontend build time
- Add your production domain in Clerk Dashboard → Domains

### Paystack payments not confirming
- Verify the webhook URL is set in Paystack Dashboard
- Check that `/api/payments/paystack/webhook` is publicly accessible (not behind auth)
- On free Render: the service may be sleeping — upgrade to Starter to ensure webhooks arrive

### Frontend shows blank page after deploy
- Confirm the SPA rewrite rule is set: `/* → /index.html`
- Check browser console for 404 errors on JS/CSS assets — confirms output directory is wrong

### Passport OCR returns "Gemini key not configured"
- Log in as admin → Admin → Settings → AI Integration → Gemini
- Paste your key from [aistudio.google.com](https://aistudio.google.com) and click Save
