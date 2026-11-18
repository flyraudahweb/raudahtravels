import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { money, ota } from "@/lib/ota";

type FareChanges = {
  changes: {
    id: string;
    detectedAt: string;
    details: {
      origin: string;
      destination: string;
      airline: string;
      departure: string;
      cabin: string;
      travellers: number;
      previousSupplierKobo: number;
      currentSupplierKobo: number;
      previousTotalKobo: number;
      currentTotalKobo: number;
      match: "same_offer" | "matching_schedule" | "wallet_debit";
      bookingReference?: string;
    };
  }[];
  nextOffset: number | null;
};

export default function OtaFareChanges() {
  const [mode, setMode] = useState<"live" | "test">("live");
  const [offset, setOffset] = useState(0);
  const report = useQuery<FareChanges>({
    queryKey: ["ota", "fare-changes", mode, offset],
    queryFn: () => ota(`/admin/fare-changes?mode=${mode}&offset=${offset}`),
  });
  const nextOffset = report.data?.nextOffset;
  return (
    <section aria-labelledby="fare-change-title" className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2
            id="fare-change-title"
            className="text-2xl font-bold text-[#1C1F66]"
          >
            Fare changes
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Bilalsadasub price increases recorded during fare checks or after
            ticket issuance.
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
        <p role="status" className="rounded-xl border bg-white p-4 text-sm">
          Loading fare changes…
        </p>
      )}
      {report.isError && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {report.error.message}
        </p>
      )}
      {report.data?.changes.length === 0 && (
        <p className="rounded-xl border bg-white p-4 text-sm text-slate-600">
          No fare increases recorded on this page.
        </p>
      )}
      {report.data?.changes.map(({ id, detectedAt, details }) => (
        <article
          key={id}
          className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3"
        >
          <div>
            <h3 className="font-semibold text-slate-900">
              {details.origin} → {details.destination} · {details.airline}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {details.departure.slice(0, 10)} at{" "}
              {details.departure.slice(11, 16)} · {details.travellers}{" "}
              {details.travellers === 1 ? "traveller" : "travellers"} ·{" "}
              {details.cabin.replaceAll("_", " ")}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {details.match === "wallet_debit"
                ? `Wallet debit · ${details.bookingReference}`
                : details.match === "same_offer"
                  ? "Same supplier offer"
                  : "Matching schedule, new offer"}{" "}
              ·{" "}
              {new Date(detectedAt).toLocaleString("en-NG", {
                timeZone: "Africa/Lagos",
              })}
            </p>
          </div>
          <div className="text-sm">
            <p className="text-slate-600">Supplier cost</p>
            <p className="font-semibold">
              {money(details.previousSupplierKobo)} →{" "}
              {money(details.currentSupplierKobo)}
            </p>
          </div>
          <div className="text-sm">
            <p className="text-slate-600">
              {details.match === "wallet_debit"
                ? "Customer payment"
                : "Customer estimate"}
            </p>
            <p className="font-semibold">
              {money(details.previousTotalKobo)} →{" "}
              {money(details.currentTotalKobo)}
            </p>
          </div>
        </article>
      ))}
      {(offset > 0 || nextOffset != null) && (
        <nav aria-label="Fare change pages" className="flex justify-between">
          <Button
            variant="outline"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 25))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={nextOffset == null}
            onClick={() => {
              if (nextOffset != null) setOffset(nextOffset);
            }}
          >
            Next
          </Button>
        </nav>
      )}
    </section>
  );
}
