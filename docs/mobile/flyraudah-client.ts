import createClient from "openapi-fetch";
import type { paths } from "./flyraudah-api";

export interface FlyRaudahClientOptions {
  /** Full v1 URL; use a separate HTTPS staging deployment for test purchases. */
  baseUrl: string;
  /** Pass getToken from the signed-in Clerk SDK. Never a provider/server key. */
  getToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** No automatic retries: recover saved bookings after an ambiguous timeout. */
export function createFlyRaudahClient(options: FlyRaudahClientOptions) {
  const base = new URL(options.baseUrl.replace(/\/+$/, ""));
  if (
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    !base.pathname.endsWith("/api/ota/v1")
  ) {
    throw new Error(
      "Use the full HTTPS FlyRaudah /api/ota/v1 URL without credentials, query or fragment",
    );
  }
  if (
    options.timeoutMs !== undefined &&
    (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)
  )
    throw new Error("timeoutMs must be positive");
  const fetchImpl = options.fetchImpl ?? fetch;
  const client = createClient<paths>({
    baseUrl: base.href,
    fetch: async (request: Request) => {
      const controller = new AbortController();
      const cancel = () => controller.abort(request.signal.reason);
      request.signal.addEventListener("abort", cancel, { once: true });
      if (request.signal.aborted) cancel();
      const timeout =
        options.timeoutMs ??
        (new URL(request.url).pathname.endsWith("/complete")
          ? 180_000
          : 65_000);
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        // Refuse redirects rather than forwarding an authenticated request.
        return await fetchImpl(
          new Request(request, {
            signal: controller.signal,
            redirect: "error",
          }),
        );
      } finally {
        clearTimeout(timer);
        request.signal.removeEventListener("abort", cancel);
      }
    },
  });
  client.use({
    async onRequest({ request }) {
      const target = new URL(request.url);
      if (
        target.origin !== base.origin ||
        !target.pathname.startsWith(base.pathname + "/")
      )
        throw new Error(
          "Refusing to send a session token outside the configured OTA API",
        );
      const token = await options.getToken();
      if (token) request.headers.set("Authorization", `Bearer ${token}`);
      else request.headers.delete("Authorization");
      request.headers.set("Accept", "application/json");
      return request;
    },
  });
  return client;
}

export function retryAfterSeconds(response: Response): number | null {
  const raw = response.headers.get("Retry-After");
  if (!raw || !/^\d+$/.test(raw)) return null;
  const seconds = Number(raw);
  return Number.isSafeInteger(seconds) ? seconds : null;
}
