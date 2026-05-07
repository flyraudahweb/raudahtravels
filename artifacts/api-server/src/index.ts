import path from "path";
import { fileURLToPath } from "url";

// Load .env from monorepo root (works locally and in production)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", "..", "..", ".env");

// Dynamic import for dotenv — it may not be installed in all environments
try {
  const dotenv = await import("dotenv");
  dotenv.config({ path: envPath });
} catch {
  // dotenv not available — env vars must be set externally (e.g. Render dashboard)
}

import app from "./app";
import { logger } from "./lib/logger";

import { ensureDefaultData } from "./utils/init-db";

const port = Number(process.env["PORT"]) || 8080;

ensureDefaultData()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to initialize default database data");
    process.exit(1);
  });
