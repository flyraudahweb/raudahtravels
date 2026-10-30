import { describe, expect, it } from "vitest";
import {
  otaOpenApi,
  mobileIntegrationGuide,
} from "../src/services/ota/apiDocumentation";
import { searchKeyScope } from "../src/services/ota/apiKeyPolicy";

describe("OTA mobile contract integrity", () => {
  it("resolves every component schema reference and required property", () => {
    const spec = otaOpenApi();
    function visit(value: any) {
      if (!value || typeof value !== "object") return;
      if (value.$ref)
        expect(
          spec.components.schemas[value.$ref.split("/").at(-1)],
        ).toBeDefined();
      if (value.type === "object" && value.required)
        for (const key of value.required)
          expect(value.properties[key]).toBeDefined();
      Object.values(value).forEach(visit);
    }
    visit(spec);
    expect(Object.keys(spec.paths).length).toBeGreaterThan(20);
  });
  it("documents customer sessions and excludes operator/provider routes", () => {
    const spec = otaOpenApi();
    for (const [path, methods] of Object.entries(spec.paths)) {
      expect(path).not.toMatch(/admin|webhook|packages|wallet/);
      for (const operation of Object.values(methods as any) as any[])
        if (
          path.startsWith("/bookings") ||
          path.startsWith("/updates") ||
          path.startsWith("/me") ||
          path.startsWith("/hotels/quotes")
        )
          expect(operation.security).toEqual([{ CustomerSession: [] }]);
    }
    expect(mobileIntegrationGuide()).toContain("Idempotency-Key");
    expect(mobileIntegrationGuide()).toContain("never authorizes customers");
  });
  it("search keys never grant a write/customer/admin scope", () => {
    expect(searchKeyScope("POST", "/flights/search")).toBe("flights:read");
    expect(searchKeyScope("GET", "/capabilities")).toBe("config:read");
    for (const path of [
      "/bookings",
      "/bookings/one/pay",
      "/bookings/one/complete",
      "/hotels/quotes",
      "/me/bootstrap",
      "/admin/settings",
      "/payments/webhook",
    ])
      expect(searchKeyScope("POST", path)).toBeUndefined();
  });
});
