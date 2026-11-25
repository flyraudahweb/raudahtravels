import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { newestBooking } from "../../raudah-travels/src/lib/bookingSnapshot";
import { PackageCancellationPolicy } from "../../raudah-travels/src/components/CancellationPolicy";
import { TravelCancellationPolicy } from "../../raudah-travels/src/components/ota/TravelPolicies";

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

describe("booking cancellation policies", () => {
  it("shows flight supplier eligibility and fees and gives a fallback for missing rules", () => {
    const withTerms = renderToStaticMarkup(
      createElement(TravelCancellationPolicy, {
        kind: "flight",
        requestMode: "booking",
        offer: {
          fare_terms: {
            refundable: false,
            changeable: true,
            change_fee: { amount: 20, currency: "GBP" },
          },
        },
      }),
    );
    expect(withTerms).toContain("Cancellation policy");
    expect(withTerms).toContain("Not permitted by this fare");
    expect(withTerms).toContain("GBP 20");
    expect(withTerms).toContain('href="#booking-help"');

    const withoutTerms = renderToStaticMarkup(
      createElement(TravelCancellationPolicy, { kind: "flight", offer: {} }),
    );
    expect(withoutTerms).toContain(
      "Ask travel support to confirm the refund and change terms",
    );
    expect(withoutTerms).toContain("My Trips");
    expect(withoutTerms).not.toContain("Not permitted");
  });

  it("keeps hotel deadlines and zero refunds attached to the selected room", () => {
    const markup = renderToStaticMarkup(
      createElement(TravelCancellationPolicy, {
        kind: "hotel",
        offer: {
          accommodation: {
            rooms: [
              {
                name: "Double room",
                rates: [
                  {
                    cancellation_summary: "Refundable subject to hotel terms.",
                  },
                ],
              },
              {
                name: "Family room",
                rates: [
                  {
                    cancellation_timeline: [
                      {
                        before: "2026-12-18T10:00:00Z",
                        currency: "USD",
                        refund_amount: 0,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      }),
    );
    expect(markup).toContain("Room 1 · Double room");
    expect(markup).toContain("Room 2 · Family room");
    expect(markup).toMatch(/18 Dec 2026.+UTC.+USD 0/);
  });

  it("displays the published package terms and links to their section", () => {
    const markup = renderToStaticMarkup(
      createElement(PackageCancellationPolicy, { detailed: true }),
    );
    expect(markup).toContain("Before visa processing starts");
    expect(markup).toContain("You may be eligible for a partial refund.");
    expect(markup).toContain("The package is non-refundable.");
    expect(markup).toContain("/terms#package-cancellations");
    expect(markup).toContain('href="/contact"');
  });
});
