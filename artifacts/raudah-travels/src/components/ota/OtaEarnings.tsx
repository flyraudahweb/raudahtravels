import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ota } from "@/lib/ota";

type Amount = string | null;
type Report = {
  totals: {
    bookingCount: number;
    missingCostCount: number;
    paidKobo: string;
    supplierKobo: string;
    grossKobo: string;
  };
  bookings: {
    id: string;
    reference: string;
    kind: "flight" | "hotel";
    paidAt: string;
    paidKobo: string;
    supplierKobo: Amount;
    grossKobo: Amount;
  }[];
  nextOffset: number | null;
};

function naira(kobo: Amount) {
  if (kobo === null) return "Unavailable";
  const amount = BigInt(kobo);
  const absolute = amount < 0n ? -amount : amount;
  return `${amount < 0n ? "−" : ""}₦${(absolute / 100n).toLocaleString("en-NG")}.${String(absolute % 100n).padStart(2, "0")}`;
}

export default function OtaEarnings() {
  const [mode, setMode] = useState<"live" | "test">("live");
  const [offset, setOffset] = useState(0);
  const report = useQuery<Report>({
    queryKey: ["ota", "earnings", mode, offset],
    queryFn: () => ota(`/admin/earnings?mode=${mode}&offset=${offset}`),
  });
  const totals = report.data?.totals;
  const bookings = report.data?.bookings ?? [];
  return (
    <section aria-labelledby="ota-earnings-heading" className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2
            id="ota-earnings-heading"
            className="text-2xl font-bold text-[#1C1F66]"
          >
            Booking earnings
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Confirmed, paid reservations. Gross earnings equal customer payment
            minus supplier cost, before payment fees and operating expenses.
          </p>
        </div>
        <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {(
            [
              ["live", "Live"],
              ["test", "Sandbox"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              variant={mode === value ? "default" : "ghost"}
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value);
                setOffset(0);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </header>
      {report.isPending && (
        <p
          role="status"
          className="rounded-2xl border bg-white p-5 text-sm text-slate-600"
        >
          Loading earnings…
        </p>
      )}
      {report.isError && (
        <p
          role="alert"
          className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-800"
        >
          {report.error.message}
        </p>
      )}
      {totals && (
        <>
          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(
              [
                [
                  "Confirmed bookings",
                  totals.bookingCount.toLocaleString(),
                  false,
                ],
                ["Customer payments", naira(totals.paidKobo), false],
                ["Recorded supplier cost", naira(totals.supplierKobo), false],
                ["Gross earnings", naira(totals.grossKobo), true],
              ] as const
            ).map(([label, value, highlight]) => (
              <div
                key={label}
                className={`rounded-2xl border p-5 ${highlight ? "border-[#1C1F66] bg-[#1C1F66] text-white" : "border-slate-200 bg-white text-slate-900"}`}
              >
                <dt className="text-sm font-medium opacity-80">{label}</dt>
                <dd className="mt-2 break-words text-2xl font-bold tracking-tight tabular-nums">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          {totals.missingCostCount > 0 && (
            <p
              role="status"
              className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              {totals.missingCostCount} confirmed{" "}
              {totals.missingCostCount === 1 ? "booking has" : "bookings have"}{" "}
              no saved supplier cost. Their earnings are unavailable.
            </p>
          )}
          {bookings.length ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[650px] text-sm">
                <caption className="sr-only">Earnings by booking</caption>
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    {[
                      "Booking",
                      "Paid on",
                      "Customer paid",
                      "Supplier cost",
                      "Gross earnings",
                    ].map((label, index) => (
                      <th
                        key={label}
                        scope="col"
                        className={`px-4 py-3 ${index < 2 ? "text-left" : "text-right"}`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bookings.map((booking) => (
                    <tr key={booking.id}>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/ota?booking=${encodeURIComponent(booking.id)}`}
                          className="font-semibold text-[#2D3199] hover:underline"
                        >
                          {booking.reference}
                        </Link>
                        <p className="mt-0.5 capitalize text-xs text-slate-500">
                          {booking.kind}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {new Date(booking.paidAt).toLocaleDateString("en-NG", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          timeZone: "Africa/Lagos",
                        })}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {naira(booking.paidKobo)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {naira(booking.supplierKobo)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {naira(booking.grossKobo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-2xl border bg-white p-5 text-sm text-slate-600">
              {offset
                ? "No bookings on this page."
                : `No confirmed ${mode === "live" ? "live" : "sandbox"} bookings yet.`}
            </p>
          )}
          {(offset > 0 || report.data?.nextOffset != null) && (
            <nav
              aria-label="Earnings pages"
              className="flex justify-between gap-3"
            >
              <Button
                variant="outline"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 25))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={report.data?.nextOffset == null}
                onClick={() => setOffset(report.data!.nextOffset!)}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
