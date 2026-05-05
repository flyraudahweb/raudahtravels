import express, { type Express } from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// Security headers — disable X-Powered-By, set sensible CSP/HSTS defaults.
// crossOriginResourcePolicy is set to "cross-origin" so the Vite dev proxy and
// external frontends can fetch API responses.
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // API — no HTML to protect
}));

// CORS configuration:
// - In production, use CORS_ORIGIN env var or APP_URL
// - In development, allow localhost Vite dev server
const corsOrigins: (string | RegExp)[] = [];

if (process.env.CORS_ORIGIN) {
  // Support comma-separated origins
  process.env.CORS_ORIGIN.split(",")
    .map(o => o.trim())
    .filter(Boolean)
    .forEach(o => corsOrigins.push(o));
} else if (process.env.APP_URL) {
  corsOrigins.push(process.env.APP_URL);
}

// In development, always allow localhost
if (process.env.NODE_ENV !== "production") {
  corsOrigins.push("http://localhost:5173");
  corsOrigins.push("http://localhost:3000");
  corsOrigins.push("http://127.0.0.1:5173");
}

app.use(cors({
  credentials: true,
  origin: corsOrigins.length > 0 ? corsOrigins : true,
}));

app.use(express.json({
  limit: "10mb",
  verify: (req, _res, buf) => {
    (req as any).rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api/uploads", express.static(path.resolve("uploads")));
app.use("/api", router);

// --- Production: Serve frontend static files (Option B — single service) ---
if (process.env.NODE_ENV === "production") {
  const frontendDir = path.resolve("artifacts/raudah-travels/dist/public");

  // Permissive CSP for the SPA shell — must allow YouTube & Vimeo iframes
  const frontendCSP = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.raudahtravels.com https://*.clerk.accounts.dev https://*.clerk.dev https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https: http:",
    "media-src 'self' https: blob:",
    "frame-src 'self' https://www.youtube.com https://youtube.com https://player.vimeo.com https://challenges.cloudflare.com https://*.clerk.accounts.dev",
    "connect-src 'self' https: wss:",
    "worker-src 'self' blob:",
  ].join("; ");

  app.use(express.static(frontendDir));

  // SPA fallback — serve index.html with correct CSP headers
  app.get(/(.*)/, (_req, res) => {
    res.setHeader("Content-Security-Policy", frontendCSP);
    res.sendFile(path.join(frontendDir, "index.html"));
  });
}

export default app;
