import { describe, it, expect } from "vitest";
import { newestBooking } from "../../raudah-travels/src/lib/bookingSnapshot";

describe("booking screen response races", () => {
  it("ignores an older booking GET even when both server timestamps have the same millisecond", () => {
    const current = {
      id: "one",
      revision: 4,
      status: "confirmed",
      updatedAt: "2026-10-29T12:00:00Z",
    };
    expect(
      newestBooking(current, {
        ...current,
        revision: 3,
        status: "payment_pending",
      }),
    ).toBe(current);
  });
  it("accepts later cancellation and refund revisions", () => {
    const current = { id: "one", revision: 4, status: "confirmed" };
    const cancellation = { ...current, revision: 5, status: "cancelled" };
    expect(newestBooking(current, cancellation)).toBe(cancellation);
  });
  it("allows a different booking and protects older API snapshots during a rollout", () => {
    const current = { id: "one", updatedAt: "2026-10-29T13:00:00Z" };
    expect(
      newestBooking(current, { ...current, updatedAt: "2026-10-29T12:00:00Z" }),
    ).toBe(current);
    const other = { id: "two", revision: 0 };
    expect(newestBooking(current, other)).toBe(other);
  });
});
