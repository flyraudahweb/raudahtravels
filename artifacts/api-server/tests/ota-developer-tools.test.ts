import { describe, expect, it, vi } from "vitest";
import {
  otaPostmanCollection,
  otaPostmanEnvironment,
} from "../src/services/ota/apiDeveloperTools";
import { MOBILE_OTA_OPERATIONS } from "../src/services/ota/mobileApiPaths";
import {
  createFlyRaudahClient,
  retryAfterSeconds,
} from "../../../docs/mobile/flyraudah-client";
import { runInNewContext } from "node:vm";
import { readFile } from "node:fs/promises";
import { MOBILE_CLIENT_FILES } from "../src/services/ota/mobileClientAssets";
import openapiTS, { astToString } from "openapi-typescript";
import ts from "typescript";
import { otaOpenApi } from "../src/services/ota/apiDocumentation";
import { validateOtaSchema } from "./helpers/ota-contract";

describe("FlyRaudah integration kit", () => {
  it("exports request samples that validate after variables are populated", () => {
    const spec = otaOpenApi();
    const values = Object.fromEntries(
      otaPostmanEnvironment().values.map((item) => [item.key, item.value]),
    );
    Object.assign(values, {
      offer_id: "off_fixture",
      passenger_id: "pas_fixture",
      rate_id: "rat_fixture",
      expected_total_kobo: "100000",
    });
    for (const item of otaPostmanCollection().item.flatMap(
      (group) => group.item,
    )) {
      const [method, path] = item.name.split(" ");
      if (!item.request.body) continue;
      const raw = item.request.body.raw.replace(
        /\{\{([^}]+)\}\}/g,
        (_match, key) => values[key],
      );
      validateOtaSchema(
        (spec.paths as any)[path][method.toLowerCase()].requestBody.content[
          "application/json"
        ].schema,
        JSON.parse(raw),
      );
    }
  });
  it("keeps bundled downloads and generated declarations in sync with their sources", async () => {
    for (const [name, source] of Object.entries(MOBILE_CLIENT_FILES))
      expect(
        await readFile(
          new URL(`../../../docs/mobile/${name}`, import.meta.url),
          "utf8",
        ),
      ).toBe(source);
    const regenerated = astToString(await openapiTS(otaOpenApi() as any));
    const print = (source: string) =>
      ts
        .createPrinter({ removeComments: true })
        .printFile(
          ts.createSourceFile(
            "api.d.ts",
            source,
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TS,
          ),
        );
    expect(print(regenerated)).toBe(
      print(MOBILE_CLIENT_FILES["flyraudah-api.d.ts"]),
    );
  });
  it("exports all customer operations without secrets or admin/provider routes", () => {
    const collection = otaPostmanCollection();
    const items = collection.item.flatMap((group) => group.item);
    expect(items.map((item) => item.name).sort()).toEqual(
      MOBILE_OTA_OPERATIONS.map(([method, path]) => `${method} ${path}`).sort(),
    );
    const vars = otaPostmanEnvironment().values;
    expect(vars.find((item) => item.key === "customer_session")?.value).toBe(
      "",
    );
    expect(
      vars.find((item) => item.key === "allow_booking_writes")?.value,
    ).toBe("false");
    expect(JSON.stringify(collection)).not.toMatch(
      /duffel_(test|live)_|sk_(test|live)_|\/admin\/|\/webhook/,
    );
  });
  it("actually skips protected Postman writes until both explicit flags are enabled", () => {
    const create = otaPostmanCollection()
      .item.flatMap((group) => group.item)
      .find((item) => item.name === "POST /bookings")!;
    const script = create.event[0].script.exec.join("\n");
    const values: Record<string, string> = {
      base_url: "https://example.test/api/ota/v1",
      customer_session: "fixture",
      offer_id: "off_fixture",
      passenger_id: "pas_fixture",
      expected_total_kobo: "100",
    };
    const skipRequest = vi.fn();
    const pm = {
      environment: { get: (key: string) => values[key] },
      execution: { skipRequest },
      variables: { set: vi.fn() },
    };
    runInNewContext(script, { pm, encodeURIComponent });
    expect(skipRequest).toHaveBeenCalledTimes(1);
    values.allow_customer_writes = "true";
    runInNewContext(script, { pm, encodeURIComponent });
    expect(skipRequest).toHaveBeenCalledTimes(2);
    values.allow_booking_writes = "true";
    runInNewContext(script, { pm, encodeURIComponent });
    expect(skipRequest).toHaveBeenCalledTimes(2);
  });
  it("refreshes session headers per request and preserves typed HTTP errors", async () => {
    const fetchImpl = vi.fn(async (request: Request) =>
      Response.json(
        request.url.endsWith("/config")
          ? { mode: "test" }
          : { error: "Please wait" },
        {
          status: request.url.endsWith("/config") ? 200 : 429,
          headers: { "Retry-After": "30" },
        },
      ),
    );
    const getToken = vi
      .fn()
      .mockResolvedValueOnce("first-session")
      .mockResolvedValueOnce("second-session");
    const client = createFlyRaudahClient({
      baseUrl: "https://example.test/api/ota/v1",
      getToken,
      fetchImpl: fetchImpl as typeof fetch,
    });
    const config = await client.GET("/config");
    expect(config.data?.mode).toBe("test");
    const result = await client.GET("/me");
    expect(result.error?.error).toBe("Please wait");
    expect(retryAfterSeconds(result.response)).toBe(30);
    expect(fetchImpl.mock.calls[0][0].headers.get("Authorization")).toBe(
      "Bearer first-session",
    );
    expect(fetchImpl.mock.calls[1][0].headers.get("Authorization")).toBe(
      "Bearer second-session",
    );
    expect(fetchImpl.mock.calls[0][0].redirect).toBe("error");
  });
  it("serializes opaque path IDs and never retries failed checkout POSTs", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("Network lost");
    });
    const client = createFlyRaudahClient({
      baseUrl: "https://example.test/api/ota/v1",
      getToken: async () => null,
      fetchImpl,
    });
    await expect(
      client.POST("/bookings/{id}/complete", {
        params: { path: { id: "opaque/id" } },
        body: {},
      }),
    ).rejects.toThrow("Network lost");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect((fetchImpl.mock.calls[0] as any)[0].url).toContain("opaque%2Fid");
  });
  it("aborts timed-out requests without retrying and validates base URLs", async () => {
    expect(() =>
      createFlyRaudahClient({
        baseUrl: "http://example.test/api/ota/v1",
        getToken: async () => null,
      }),
    ).toThrow();
    expect(() =>
      createFlyRaudahClient({
        baseUrl: "https://example.test/api/ota/v1?secret=x",
        getToken: async () => null,
      }),
    ).toThrow();
    const fetchImpl = vi.fn(
      (request: Request) =>
        new Promise<Response>((_resolve, reject) =>
          request.signal.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true },
          ),
        ),
    );
    const client = createFlyRaudahClient({
      baseUrl: "https://example.test/api/ota/v1",
      getToken: async () => null,
      timeoutMs: 10,
      fetchImpl: fetchImpl as typeof fetch,
    });
    await expect(client.GET("/config")).rejects.toThrow("aborted");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
