// User-authorized test webhook setup. Never prints API tokens/signing secrets.
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, "..");
async function main() {
  const mode = process.env.OTA_MODE || "test",
    token = process.env.DUFFEL_API_TOKEN || "";
  if (!["test", "live"].includes(mode) || !token.startsWith(`duffel_${mode}_`))
    throw new Error("Token/mode mismatch");
  const origin = new URL(process.env.APP_URL || "");
  if (origin.protocol !== "https:") throw new Error("HTTPS APP_URL required");
  const url = `${origin.origin}/api/ota/duffel/webhook/${mode}`;
  const { DUFFEL_EVENTS } = await import(
    pathToFileURL(
      path.join(
        root,
        "artifacts/api-server/src/services/ota/duffelWebhookProtocol.ts",
      ),
    ).href
  );
  async function request(route, method = "GET", data) {
    const response = await fetch(`https://api.duffel.com${route}`, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(20000),
      headers: {
        Authorization: `Bearer ${token}`,
        "Duffel-Version": "v2",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...(data ? { body: JSON.stringify({ data }) } : {}),
    });
    if (!response.ok)
      throw new Error(
        `Provider control request returned HTTP ${response.status}`,
      );
    if (response.status === 204) return null;
    const body = await response.json();
    return body.data;
  }
  const hooks = await request("/air/webhooks");
  if (!process.argv.includes("--create-inactive")) {
    console.log(
      JSON.stringify({
        mode,
        expectedUrl: url,
        hooks: hooks.map((h) => ({
          id: h.id,
          url: h.url,
          active: h.active,
          events: h.events,
        })),
      }),
    );
    return;
  }
  if (hooks.length) {
    const own = hooks.find((h) => h.url === url);
    if (!own)
      throw new Error(
        "An existing webhook uses another URL; it was not modified",
      );
    console.log(
      JSON.stringify({
        reused: true,
        id: own.id,
        url: own.url,
        active: own.active,
        events: own.events,
      }),
    );
    return;
  }
  const hook = await request("/air/webhooks", "POST", {
    url,
    events: DUFFEL_EVENTS,
  });
  let stored = false;
  try {
    if (
      !/^end_[A-Za-z0-9]+$/.test(hook?.id || "") ||
      !/^[A-Za-z0-9+/=_-]{16,512}$/.test(hook?.secret || "") ||
      hook.live_mode !== (mode === "live")
    )
      throw new Error("Unexpected webhook configuration");
    const fields = {
      [`DUFFEL_WEBHOOK_ID_${mode.toUpperCase()}`]: hook.id,
      [`DUFFEL_WEBHOOK_SECRET_${mode.toUpperCase()}`]: hook.secret,
    };
    for (const name of [".env", ".env.production"]) {
      const file = path.join(root, name);
      if (!fs.existsSync(file))
        throw new Error("Expected private environment file missing");
      let source = fs.readFileSync(file, "utf8");
      for (const [key, value] of Object.entries(fields)) {
        const pattern = new RegExp(`^\\s*${key}\\s*=.*$`, "m"),
          line = `${key}=${JSON.stringify(value)}`;
        source = pattern.test(source)
          ? source.replace(pattern, () => line)
          : `${source.trimEnd()}\n${line}\n`;
      }
      fs.writeFileSync(file, source);
    }
    stored = true;
  } finally {
    try {
      await request(`/air/webhooks/${encodeURIComponent(hook.id)}`, "PATCH", {
        active: false,
      });
    } catch {
      console.error(
        JSON.stringify({
          actionRequired:
            "Deactivate this newly created webhook in Duffel until receiver deployment is complete",
          id: hook.id,
        }),
      );
      throw new Error("Webhook deactivation needs attention");
    }
  }
  console.log(
    JSON.stringify({
      created: true,
      id: hook.id,
      mode,
      active: false,
      url,
      events: [...DUFFEL_EVENTS],
      secretSavedPrivately: stored,
      nextStep:
        "Apply migrations 0010 and 0011, deploy receiver, import private webhook variables, then ping and activate in super-admin settings",
    }),
  );
}
main().catch((error) => {
  console.error(
    JSON.stringify({
      error:
        error instanceof Error && !/secret|token/i.test(error.message)
          ? error.message
          : "Webhook setup failed; check configuration privately",
    }),
  );
  process.exitCode = 1;
});
