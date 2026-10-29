import { useQuery } from "@tanstack/react-query";
import { RefreshCw, ArrowDownUp } from "lucide-react";
import { money, ota, travelButton } from "@/lib/ota";

type FxData = {
  sellingRates: Record<string, number>;
  reference: {
    sourceUrl: string;
    provider: string;
    frequency: string;
    fetchedAt: string | null;
    stale: boolean;
    status: string;
    publishedAt?: string;
    nextUpdateAt?: string;
    rates: Record<string, { ngnPerUnit: number; date: string }>;
  };
};
export default function ExchangeRates({
  onUseReference,
}: {
  onUseReference?: (rates: Record<string, number>) => void;
}) {
  const query = useQuery<FxData>({
    queryKey: ["ota", "exchange-rates"],
    queryFn: () => ota("/exchange-rates"),
    staleTime: 60000,
    refetchInterval: 60000,
    retry: false,
  });
  const data = query.data;
  const currencies = [
    ...new Set([
      "USD",
      "GBP",
      "EUR",
      "SAR",
      "AED",
      ...Object.keys(data?.sellingRates || {}),
    ]),
  ].filter((c) => c !== "NGN");
  return (
    <section
      className="rounded-2xl border border-indigo-100 bg-white p-5 text-slate-900"
      aria-label="Currency conversion rates"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold">
            <ArrowDownUp size={17} className="text-indigo-600" />
            Currency conversion rates
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Booking rates are set by Raudah. Market references are refreshed
            automatically for comparison; they do not change a saved checkout.
          </p>
        </div>
        <button
          type="button"
          disabled={query.isFetching}
          onClick={() => query.refetch()}
          aria-label="Refresh currency rates"
          className="rounded-lg border p-2 disabled:opacity-50"
        >
          <RefreshCw
            size={15}
            className={query.isFetching ? "animate-spin" : ""}
          />
        </button>
      </div>
      {query.isLoading && (
        <p role="status" className="text-sm text-slate-500">
          Loading currency rates…
        </p>
      )}
      {query.error && (
        <p role="status" className="text-sm text-amber-800">
          Currency display is temporarily unavailable. Booking totals are still
          checked on the server.
        </p>
      )}
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {currencies.map((currency) => {
              const selling = data.sellingRates[currency],
                reference = data.reference.rates[currency];
              return (
                <div
                  key={currency}
                  className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"
                >
                  <p className="mb-2 text-xs font-bold text-indigo-600">
                    1 {currency}
                  </p>
                  <p className="text-base font-black">
                    {selling ? money(selling * 100) : "Not configured"}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Raudah booking rate
                  </p>
                  {reference && (
                    <p className="mt-2 border-t border-slate-200 pt-2 text-[11px] leading-relaxed text-slate-500">
                      Reference: {money(reference.ngnPerUnit * 100)}
                      <br />
                      Source date: {reference.date}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <p>
              <a
                className="text-indigo-700 underline"
                href={data.reference.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                {data.reference.provider} reference data
              </a>{" "}
              ·{" "}
              {data.reference.frequency === "daily"
                ? "Daily publication"
                : "Publication follows your provider plan"}{" "}
              · Display checks every minute
              {data.reference.fetchedAt && (
                <>
                  {" "}
                  · Retrieved{" "}
                  {new Date(data.reference.fetchedAt).toLocaleString()}
                </>
              )}
            </p>
            {data.reference.stale && (
              <p className="font-semibold text-amber-800">
                {data.reference.status === "cached"
                  ? "Provider unavailable — showing dated cached references."
                  : data.reference.status === "unavailable"
                    ? "Reference feed unavailable; configured booking rates remain in effect."
                    : data.reference.status === "disabled"
                      ? "Reference feed disabled."
                      : "Reference data is older than 72 hours."}
              </p>
            )}
          </div>
          {data.reference.publishedAt && (
            <p className="mt-2 text-xs text-slate-500">
              Provider update:{" "}
              {new Date(data.reference.publishedAt).toLocaleString()}
              {data.reference.nextUpdateAt && (
                <>
                  {" "}
                  · Next scheduled update:{" "}
                  {new Date(data.reference.nextUpdateAt).toLocaleString()}
                </>
              )}
            </p>
          )}
          {onUseReference && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <button
                type="button"
                className={travelButton}
                disabled={
                  data.reference.stale ||
                  !Object.keys(data.reference.rates).length
                }
                onClick={() =>
                  onUseReference(
                    Object.fromEntries(
                      Object.entries(data.reference.rates).map(
                        ([currency, row]) => [
                          currency,
                          Number(row.ngnPerUnit.toFixed(6)),
                        ],
                      ),
                    ),
                  )
                }
              >
                Copy references into rate draft
              </button>
              <p className="mt-2 text-xs text-slate-500">
                Review your selling rates and click Save settings below to apply
                them. This button does not publish rates.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
