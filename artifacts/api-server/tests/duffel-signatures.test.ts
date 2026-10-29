import { expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  validDuffelSignature,
  DUFFEL_EVENTS,
} from "../src/services/ota/duffelWebhookProtocol";
const now = 1793275200000,
  timestamp = String(Math.floor(now / 1000)),
  secret = "raw-signing-secret==";
const body = Buffer.from('{"type":"order.created","live_mode":false}');
const signature = createHmac("sha256", secret)
  .update(`${timestamp}.`)
  .update(body)
  .digest("hex");
it("verifies Duffel's timestamp-dot-raw-body HMAC and allows rotated v1 signatures", () => {
  expect(
    validDuffelSignature(body, `t=${timestamp},v1=${signature}`, secret, now),
  ).toBe(true);
  expect(
    validDuffelSignature(
      body,
      `v1=${"0".repeat(64)},t=${timestamp},v1=${signature}`,
      secret,
      now,
    ),
  ).toBe(true);
});
it("rejects tampering, stale/future timestamps, malformed signatures and mode-specific wrong keys", () => {
  expect(
    validDuffelSignature(
      Buffer.concat([body, Buffer.from(" ")]),
      `t=${timestamp},v1=${signature}`,
      secret,
      now,
    ),
  ).toBe(false);
  expect(
    validDuffelSignature(
      body,
      `t=${timestamp},v1=${signature}`,
      "other-mode-secret",
      now,
    ),
  ).toBe(false);
  expect(
    validDuffelSignature(
      body,
      `t=${timestamp},v1=${signature}`,
      secret,
      now + 301000,
    ),
  ).toBe(false);
  expect(
    validDuffelSignature(
      body,
      `t=${timestamp},v1=${signature}`,
      secret,
      now - 301000,
    ),
  ).toBe(false);
  expect(
    validDuffelSignature(
      body,
      `t=${timestamp},t=${timestamp},v1=${signature}`,
      secret,
      now,
    ),
  ).toBe(false);
  expect(validDuffelSignature(body, "garbage", secret, now)).toBe(false);
});
it("subscribes only to implemented flight/hotel lifecycle events", () => {
  expect(DUFFEL_EVENTS).toHaveLength(8);
  expect(
    DUFFEL_EVENTS.every((e) => !/^(air\.|cars\.|payment|assistant\.)/.test(e)),
  ).toBe(true);
});
