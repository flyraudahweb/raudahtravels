import { describe, expect, it } from "vitest";
import {
  matchesPaystackProof,
  providerTransactionId,
} from "../src/services/payments/paystackProof";

const expected = {
  reference: "OTA-1",
  amountKobo: 100,
  mode: "test",
  bookingId: "one",
  purpose: "ota" as const,
};
const payment = {
  reference: "OTA-1",
  amount: 100,
  domain: "test",
  currency: "NGN",
  status: "success",
  metadata: { otaBookingId: "one", type: "ota_booking" },
};
describe("canonical payment proof", () => {
  it("rejects altered identity, amount, mode, currency, status and transaction purpose", () => {
    expect(matchesPaystackProof(payment, expected)).toBe(true);
    for (const patch of [
      { reference: "other" },
      { amount: 99 },
      { amount: 100.1 },
      { domain: "live" },
      { currency: "USD" },
      { status: "pending" },
      { status: "reversed" },
      { metadata: { otaBookingId: "one" } },
      { metadata: { otaBookingId: "one", type: "wallet" } },
      { metadata: { ...payment.metadata, bookingId: "package" } },
    ]) {
      expect(matchesPaystackProof({ ...payment, ...patch }, expected)).toBe(
        false,
      );
    }
  });
  it("allows reversed transactions only for refund reconciliation", () => {
    expect(
      matchesPaystackProof({ ...payment, status: "reversed" }, expected, true),
    ).toBe(true);
    expect(
      matchesPaystackProof({ ...payment, status: "failed" }, expected, true),
    ).toBe(false);
  });
  it("binds package payments to the original owner and rejects OTA/wallet replay", () => {
    const binding = {
      ...expected,
      purpose: "package" as const,
      userId: "owner",
    };
    const packagePayment = {
      ...payment,
      metadata: { bookingId: "one", userId: "owner", type: "package_booking" },
    };
    expect(matchesPaystackProof(packagePayment, binding)).toBe(true);
    for (const metadata of [
      payment.metadata,
      { bookingId: "one", userId: "other" },
      { bookingId: "one", userId: "owner", type: "wallet_funding" },
    ])
      expect(matchesPaystackProof({ ...payment, metadata }, binding)).toBe(
        false,
      );
  });
  it("compares large provider IDs without floating point collisions", () => {
    expect(providerTransactionId("9007199254740992")).not.toBe(
      providerTransactionId("9007199254740993"),
    );
    expect(providerTransactionId(9007199254740992)).toBeUndefined();
    expect(providerTransactionId("000101")).toBe("101");
    for (const value of [0, -1, 1.5, "1e2", "", {}, null])
      expect(providerTransactionId(value)).toBeUndefined();
  });
});
