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

// Load application modules only after dotenv: channel/storage clients read env
// during module initialization. Production still prefers platform env secrets.
const [{ default: app }, { logger }, { ensureDefaultData }, { assertRegistrationReady },
  { startChannelWorker }, { purgeRetainedMedia }, { registrationTransaction }, { ensureBucket }] = await Promise.all([
  import("./app"), import("./lib/logger"), import("./utils/init-db"), import("./services/registration/readiness"),
  import("./services/channels/ChannelQueue"), import("./services/registration/RetentionService"),
  import("./services/registration/database"), import("./lib/r2"),
]);

const port = Number(process.env["PORT"]) || 8080;

await assertRegistrationReady();

Promise.all([
  ensureDefaultData().then(() => logger.info("Default data initialization successful.")),
  ensureBucket(),
])
  .catch((err) => {
    logger.error({ err }, "Failed to initialize default database data (possibly unmigrated schema). Proceeding to start server anyway.");
  })
  .finally(() => {
    // Background: expire stale AI registration sessions every 30 minutes.
    // Import lazily so this never blocks startup on import-time failures.
    startChannelWorker();
    let maintenanceRunning = false;
    const EXPIRE_MS = 30 * 60 * 1000;
    setInterval(async () => {
      if (maintenanceRunning) return;
      maintenanceRunning = true;
      try {
        const { expireStaleSessions } = await import("./services/registration/ConversationService.js");
        const n = await registrationTransaction(() => expireStaleSessions());
        await purgeRetainedMedia();
        if (n > 0) logger.info({ expiredSessions: n }, "Expired stale AI registration sessions");
      } catch (err) {
        logger.error("AI registration maintenance failed");
      } finally { maintenanceRunning = false; }
    }, EXPIRE_MS).unref();
    app.listen(port, () => {
      logger.info({ port }, "Server listening");
    }).on('error', (err) => {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    });
  });
