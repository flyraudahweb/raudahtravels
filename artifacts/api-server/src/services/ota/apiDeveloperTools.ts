import { otaOpenApi } from "./apiDocumentation";

const pathVariable = (path: string) =>
  path.startsWith("/flights/")
    ? "offer_id"
    : path.startsWith("/hotels/rates/")
      ? "search_result_id"
      : path.startsWith("/hotels/quotes/")
        ? "quote_id"
        : path.startsWith("/updates/")
          ? "encoded_update_id"
          : "booking_id";
function sample(schema: any, spec: any): any {
  if (schema?.$ref)
    return sample(spec.components.schemas[schema.$ref.split("/").at(-1)], spec);
  if (schema.example !== undefined) return structuredClone(schema.example);
  if (schema.default !== undefined) return schema.default;
  if (schema.enum) return schema.enum[0];
  if (schema.type === "object")
    return Object.fromEntries(
      Object.entries(schema.properties || {})
        .filter(([name]) => schema.required?.includes(name))
        .map(([name, value]) => [name, sample(value, spec)]),
    );
  if (schema.type === "array") return [];
  if (schema.type === "integer" || schema.type === "number")
    return schema.minimum ?? 0;
  if (schema.type === "boolean") return false;
  return "example";
}

export function otaPostmanEnvironment() {
  const base = otaOpenApi().servers[0].url;
  const variables: Record<string, string> = {
    base_url: base,
    customer_session: "",
    allow_customer_writes: "false",
    allow_booking_writes: "false",
    origin: "LOS",
    destination: "JED",
    departure_date: new Date(Date.now() + 45 * 86400000)
      .toISOString()
      .slice(0, 10),
    offer_id: "",
    passenger_id: "",
    search_result_id: "",
    rate_id: "",
    quote_id: "",
    booking_id: "",
    update_id: "",
    expected_total_kobo: "0",
    hotel_total_kobo: "0",
  };
  return {
    name: "FlyRaudah OTA — select staging before writes",
    values: Object.entries(variables).map(([key, value]) => ({
      key,
      value,
      enabled: true,
      type: key === "customer_session" ? "secret" : "default",
    })),
    _postman_variable_scope: "environment",
  };
}

export function otaPostmanCollection() {
  const spec = otaOpenApi(),
    groups = new Map<string, any[]>();
  for (const [path, methods] of Object.entries(spec.paths))
    for (const [method, op] of Object.entries(methods as any) as [
      string,
      any,
    ][]) {
      const customer = op.security.some((item: any) => item.CustomerSession);
      const mutation = customer && method === "post",
        bookingWrite = mutation && path.startsWith("/bookings");
      const variable = pathVariable(path);
      const required = [
        ...(customer ? ["customer_session"] : []),
        ...(path.includes("{id}")
          ? [variable === "encoded_update_id" ? "update_id" : variable]
          : []),
      ];
      let body = op.requestBody
        ? sample(op.requestBody.content["application/json"].schema, spec)
        : undefined;
      if (path === "/flights/search")
        body = {
          origin: "{{origin}}",
          destination: "{{destination}}",
          departureDate: "{{departure_date}}",
          adults: 1,
          childAges: [],
          cabinClass: "economy",
        };
      if (path === "/hotels/quotes" && method === "post") {
        body = { rateId: "{{rate_id}}" };
        required.push("rate_id");
      }
      if (path === "/bookings" && method === "post") {
        body.offerId = "{{offer_id}}";
        body.expectedTotalKobo = "{{expected_total_kobo}}";
        body.travellers[0].id = "{{passenger_id}}";
        required.push("offer_id", "passenger_id", "expected_total_kobo");
      }
      const guards = [
        "(function () {",
        "if (!/^https:\\/\\/[^/?#@]+\\/api\\/ota\\/v1\\/?$/.test(pm.environment.get('base_url') || '')) { pm.execution.skipRequest(); return; }",
        ...(mutation
          ? [
              "if (pm.environment.get('allow_customer_writes') !== 'true') { pm.execution.skipRequest(); return; }",
            ]
          : []),
        ...(bookingWrite
          ? [
              "if (pm.environment.get('allow_booking_writes') !== 'true') { pm.execution.skipRequest(); return; }",
            ]
          : []),
        `if (${JSON.stringify(required)}.some(key => !pm.environment.get(key))) { pm.execution.skipRequest(); return; }`,
        "pm.variables.set('encoded_update_id', encodeURIComponent(pm.environment.get('update_id') || ''));",
        "})();",
      ];
      const tests = [
        "pm.test('API returns JSON', () => pm.expect(pm.response.headers.get('Content-Type')).to.include('application/json'));",
        "if (pm.response.code >= 200 && pm.response.code < 300) {",
        "const data = pm.response.json();",
        "if (data.offers?.[0]) { pm.environment.set('offer_id', data.offers[0].id); pm.environment.set('passenger_id', data.offers[0].passengers?.[0]?.id || ''); pm.environment.set('expected_total_kobo', String(data.offers[0].pricing?.totalKobo || 0)); }",
        "if (data.offer?.id) { pm.environment.set('offer_id', data.offer.id); pm.environment.set('passenger_id', data.offer.passengers?.[0]?.id || ''); }",
        "if (data.results?.[0]?.id) pm.environment.set('search_result_id', data.results[0].id);",
        "if (data.result?.accommodation?.rooms?.[0]?.rates?.[0]?.id) pm.environment.set('rate_id', data.result.accommodation.rooms[0].rates[0].id);",
        "if (data.quote?.id) pm.environment.set('quote_id', data.quote.id);",
        "if (data.offer && data.pricing?.totalKobo) pm.environment.set('expected_total_kobo', String(data.pricing.totalKobo));",
        "if (data.quote && data.pricing?.totalKobo) pm.environment.set('hotel_total_kobo', String(data.pricing.totalKobo));",
        "if (data.booking?.id) pm.environment.set('booking_id', data.booking.id);",
        "if (data.updates?.[0]?.id) pm.environment.set('update_id', data.updates[0].id);",
        "}",
      ];
      const entry = {
        name: `${method.toUpperCase()} ${path}`,
        request: {
          method: method.toUpperCase(),
          auth: customer
            ? {
                type: "bearer",
                bearer: [
                  {
                    key: "token",
                    value: "{{customer_session}}",
                    type: "string",
                  },
                ],
              }
            : { type: "noauth" },
          header: [
            { key: "Accept", value: "application/json" },
            ...(body === undefined
              ? []
              : [{ key: "Content-Type", value: "application/json" }]),
          ],
          url: `{{base_url}}${path.replace("{id}", `{{${variable}}}`)}${path === "/places" ? "?q=Lagos" : ""}`,
          description: `${op.description}\n\n${op["x-idempotency"]}\n\nCustomer writes are disabled by default. Replace sample traveller/contact data and review the current price before any checkout.`,
          ...(body === undefined
            ? {}
            : {
                body: {
                  mode: "raw",
                  raw: JSON.stringify(body, null, 2).replace(
                    '"{{expected_total_kobo}}"',
                    "{{expected_total_kobo}}",
                  ),
                  options: { raw: { language: "json" } },
                },
              }),
        },
        event: [
          {
            listen: "prerequest",
            script: { type: "text/javascript", exec: guards },
          },
          { listen: "test", script: { type: "text/javascript", exec: tests } },
        ],
        response: [],
      };
      const tag = op.tags[0];
      if (!groups.has(tag)) groups.set(tag, []);
      groups.get(tag)!.push(entry);
    }
  return {
    info: {
      name: "FlyRaudah OTA Mobile API",
      schema:
        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      description: `Contract ${spec.info.version}. Import the companion environment. Use local-only tokens and a separate staging host. All customer writes are skipped by default; booking writes require a second explicit flag. Importing this collection never sends requests. Current Postman supporting pm.execution.skipRequest is required. Search/quote IDs expire; retrieve fresh inventory before checkout. No provider/admin endpoints or secrets are included.`,
    },
    item: [...groups].map(([name, item]) => ({ name, item })),
  };
}
