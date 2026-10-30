import { describe, expect, it } from "vitest";
import {
  otaOpenApi,
  mobileIntegrationGuide,
} from "../src/services/ota/apiDocumentation";
import { searchKeyScope } from "../src/services/ota/apiKeyPolicy";
import SwaggerParser from "@apidevtools/swagger-parser";
import { validateOtaSchema } from "./helpers/ota-contract";
import { MOBILE_OTA_OPERATIONS } from "../src/services/ota/mobileApiPaths";

describe("OTA mobile contract integrity", () => {
  it("keeps every documented operation in sync with the customer router", () => {
    const actual = Object.entries(otaOpenApi().paths)
      .flatMap(([path, methods]) =>
        Object.keys(methods as any).map(
          (method) => `${method.toUpperCase()} ${path}`,
        ),
      )
      .sort();
    expect(actual).toEqual(
      MOBILE_OTA_OPERATIONS.map(([method, path]) => `${method} ${path}`).sort(),
    );
  });
  it("passes standard OpenAPI validation without external reference resolution", async () => {
    await SwaggerParser.validate(otaOpenApi() as any, {
      resolve: { external: false },
    });
  });
  it("validates every documented request, response and component example", () => {
    const spec = otaOpenApi();
    for (const schema of Object.values(spec.components.schemas) as any[])
      if (schema.example) validateOtaSchema(schema, schema.example);
    for (const methods of Object.values(spec.paths))
      for (const op of Object.values(methods as any) as any[]) {
        const request = op.requestBody?.content["application/json"];
        if (request?.example)
          validateOtaSchema(request.schema, request.example);
        for (const named of Object.values(request?.examples || {}) as any[])
          validateOtaSchema(request.schema, named.value);
        for (const response of Object.values(op.responses) as any[]) {
          const json = response.content?.["application/json"];
          if (json?.example) validateOtaSchema(json.schema, json.example);
          for (const named of Object.values(json?.examples || {}) as any[])
            validateOtaSchema(json.schema, named.value);
        }
      }
  });
  it("requires complete flight travellers while accepting hotel guests", () => {
    const schema = otaOpenApi().components.schemas.BookingCreate;
    const valid = structuredClone(schema.example);
    validateOtaSchema(schema, valid);
    const incomplete = { given_name: "Native", family_name: "Traveller" };
    expect(() =>
      validateOtaSchema(schema, { ...valid, travellers: [incomplete] }),
    ).toThrow();
    validateOtaSchema(schema, {
      ...valid,
      kind: "hotel",
      offerId: "quo_example",
      travellers: [incomplete],
    });
  });
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
