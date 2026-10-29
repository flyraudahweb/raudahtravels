import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  ArrowRightLeft,
  ChevronDown,
  Clock3,
  Plane,
  SlidersHorizontal,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  airlineKey,
  airportTitle,
  dateKey,
  durationMinutes,
  flightDuration,
  flightStops,
  moveDate,
  readDate,
  selectFlights,
  type FlightFilters,
} from "@/lib/travelSearch";
import { money, travelButton } from "@/lib/ota";

const initialFilters: FlightFilters = {
  stops: "all",
  airlines: [],
  budget: null,
  departure: "all",
  sort: "price",
};
const shortDate = (value: string) =>
  readDate(value)?.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }) || "Choose dates";
const duration = (value: string) => {
  const minutes = durationMinutes(value);
  return Number.isFinite(minutes)
    ? `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`
    : "Duration pending";
};

export function SearchLoading({
  query,
  kind,
  onCancel,
}: {
  query: URLSearchParams;
  kind: "flight" | "hotel";
  onCancel: () => void;
}) {
  const [phase, setPhase] = useState(0);
  const travellerCount =
    Number(query.get("adults") || 1) +
    (query.get("childAges")?.split(",").filter(Boolean).length || 0);
  useEffect(() => {
    const timer = setInterval(
      () => setPhase((value) => Math.min(2, value + 1)),
      6500,
    );
    return () => clearInterval(timer);
  }, []);
  const messages =
    kind === "flight"
      ? [
          "Checking current flight availability…",
          "Comparing available fares for your journey…",
          "Still checking with the travel provider. Thank you for waiting…",
        ]
      : [
          "Checking available stays…",
          "Finding room options for your dates…",
          "Still checking with the travel provider. Thank you for waiting…",
        ];
  return (
    <>
      <div
        aria-hidden="true"
        className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]"
      >
        <div className="hidden space-y-6 rounded-2xl bg-white p-6 lg:block">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-4">
              <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-3 animate-pulse rounded bg-slate-100"
                />
              ))}
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="grid grid-cols-3 gap-6 rounded-2xl bg-white p-8"
            >
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-5">
                  <div className="h-5 animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <Dialog
        open
        onOpenChange={(value) => {
          if (!value) onCancel();
        }}
      >
        <DialogContent
          overlayClassName="bg-slate-950/45 backdrop-blur-[1px]"
          className="max-w-[calc(100vw-32px)] rounded-3xl border-0 p-7 text-center sm:max-w-[470px] sm:p-9 [&>button:last-child]:hidden"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogTitle className="flex items-center justify-center gap-3 text-xl font-bold text-[#1C1F66]">
            {kind === "flight" ? (
              <>
                {query.get("originLabel")?.slice(0, 80) ||
                  airportTitle(query.get("origin") || "")}
                <ArrowRightLeft size={18} className="text-[#FF3B00]" />
                {query.get("destinationLabel")?.slice(0, 80) ||
                  airportTitle(query.get("destination") || "")}
              </>
            ) : (
              "Finding your next stay"
            )}
          </DialogTitle>
          <DialogDescription className="text-center text-xs text-slate-500">
            {shortDate(
              query.get(kind === "flight" ? "departureDate" : "checkIn") || "",
            )}
            {query.get(kind === "flight" ? "returnDate" : "checkOut") &&
              ` — ${shortDate(query.get(kind === "flight" ? "returnDate" : "checkOut")!)}`}{" "}
            · {travellerCount} traveller{travellerCount === 1 ? "" : "s"}
          </DialogDescription>
          <div className="relative mx-auto my-5 flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50">
            <span className="absolute inset-0 rounded-full border-2 border-dashed border-indigo-200 motion-safe:animate-[spin_14s_linear_infinite]" />
            <Plane className="-rotate-12 text-[#2D3199]" size={34} />
            <span className="absolute right-1 top-1 h-3 w-3 rounded-full bg-[#FF3B00]" />
          </div>
          <p
            role="status"
            aria-live="polite"
            className="min-h-10 text-sm font-medium text-slate-700"
          >
            {messages[phase]}
          </p>
          <div
            aria-hidden="true"
            className="my-3 h-1.5 overflow-hidden rounded-full bg-indigo-50"
          >
            <div className="h-full w-1/3 rounded-full bg-[#2D3199] motion-safe:animate-[travel-search-progress_1.7s_ease-in-out_infinite]" />
          </div>
          <p className="text-[11px] text-slate-400">
            Current availability. Clear prices. Your journey with Raudah.
          </p>
          <button
            type="button"
            onClick={onCancel}
            className="mx-auto mt-2 text-xs font-semibold text-[#2D3199] underline underline-offset-4"
          >
            Cancel search
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function FlightResults({
  offers,
  query,
  onDate,
  details,
}: {
  offers: any[];
  query: URLSearchParams;
  onDate: (offset: number) => void;
  details: (offer: any) => React.ReactNode;
}) {
  const [filters, setFilters] = useState<FlightFilters>(initialFilters),
    [mobileFilters, setMobileFilters] = useState(false);
  const update = (patch: Partial<FlightFilters>) =>
    setFilters((previous) => ({ ...previous, ...patch }));
  const results = selectFlights(offers, filters),
    cheapest = offers.length
      ? Math.min(...offers.map((o) => o.pricing.totalKobo))
      : 0;
  const filteredCheapest = results.length
    ? Math.min(...results.map((o) => o.pricing.totalKobo))
    : 0;
  const fastest = [...results].sort(
    (a, b) =>
      flightDuration(a) - flightDuration(b) ||
      a.pricing.totalKobo - b.pricing.totalKobo,
  )[0];
  const maxPrice = offers.length
    ? Math.max(...offers.map((o) => o.pricing.totalKobo))
    : 0;
  const dateStrip = useRef<HTMLDivElement>(null);
  const selectedDate = query.get("departureDate");
  useEffect(() => {
    const strip = dateStrip.current,
      selected = strip?.querySelector<HTMLButtonElement>(
        'button[aria-pressed="true"]',
      );
    if (strip && selected)
      strip.scrollLeft +=
        selected.getBoundingClientRect().left -
        strip.getBoundingClientRect().left -
        strip.clientWidth / 2 +
        selected.clientWidth / 2;
  }, [selectedDate]);
  const airlines = [
    ...new Map<
      string,
      { id: string; name: string; price: number; count: number }
    >(
      offers.map((offer) => {
        const id = airlineKey(offer),
          same = offers.filter((o) => airlineKey(o) === id);
        return [
          id,
          {
            id,
            name: offer.owner?.name || "Other airline",
            price: Math.min(...same.map((o) => o.pricing.totalKobo)),
            count: same.length,
          },
        ];
      }),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const activeCount =
    Number(filters.stops !== "all") +
    filters.airlines.length +
    Number(filters.budget !== null) +
    Number(filters.departure !== "all");
  const departure = query.get("departureDate") || "",
    origin =
      query.get("originLabel")?.slice(0, 80) ||
      airportTitle(query.get("origin") || ""),
    destination =
      query.get("destinationLabel")?.slice(0, 80) ||
      airportTitle(query.get("destination") || "");
  return (
    <>
      <div
        className="mt-5 flex overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
        aria-label="Search nearby departure dates"
        ref={dateStrip}
      >
        {[-3, -2, -1, 0, 1, 2, 3].map((offset) => {
          const date = moveDate(departure, offset);
          return (
            <button
              type="button"
              key={offset}
              disabled={!date || date < dateKey(new Date())}
              onClick={() => offset !== 0 && onDate(offset)}
              aria-pressed={offset === 0}
              className={`min-w-[118px] flex-1 rounded-xl px-3 py-3 text-center transition disabled:opacity-30 ${offset === 0 ? "bg-[#2D3199] text-white shadow-sm" : "text-slate-600 hover:bg-indigo-50"}`}
            >
              <span className="block whitespace-nowrap text-xs font-bold">
                {shortDate(date)}
              </span>
              <span
                className={`mt-1 block text-[10px] ${offset === 0 ? "text-indigo-100" : "text-slate-400"}`}
              >
                {offset === 0
                  ? cheapest
                    ? money(cheapest)
                    : "Selected date"
                  : "Check fares"}
              </span>
            </button>
          );
        })}
      </div>
      <div className="my-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950">
            {origin} <span className="px-1 text-slate-400">→</span>{" "}
            {destination}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {results.length} of {offers.length} available flight options · Total
            prices for all travellers
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMobileFilters(!mobileFilters)}
          aria-expanded={mobileFilters}
          className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-[#2D3199] lg:hidden"
        >
          <SlidersHorizontal size={16} />
          Filters{activeCount > 0 ? ` (${activeCount})` : ""}
        </button>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[235px_minmax(0,1fr)]">
        <aside
          aria-label="Flight filters"
          className={`${mobileFilters ? "block" : "hidden"} space-y-0 rounded-2xl border border-slate-200 bg-white px-5 lg:block`}
        >
          <div className="flex items-center justify-between border-b py-5">
            <h3 className="font-bold text-slate-950">
              Filters{" "}
              {activeCount > 0 && (
                <span className="text-[#2D3199]">({activeCount})</span>
              )}
            </h3>
            <button
              type="button"
              onClick={() => setFilters(initialFilters)}
              className="text-xs font-semibold text-[#2D3199]"
            >
              Reset all
            </button>
          </div>
          <details open className="border-b py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold">
              Stops
              <ChevronDown size={15} />
            </summary>
            <div className="mt-4 space-y-3">
              {[
                ["all", "Any number of stops"],
                ["0", "Non-stop"],
                ["1", "Up to 1 stop"],
              ].map(([value, label]) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 text-xs text-slate-600"
                >
                  <input
                    type="radio"
                    name="result-stops"
                    value={value}
                    checked={filters.stops === value}
                    onChange={() => update({ stops: value })}
                    className="accent-[#2D3199]"
                  />
                  {label}
                </label>
              ))}
            </div>
          </details>
          <details open className="border-b py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold">
              Airlines
              <ChevronDown size={15} />
            </summary>
            <div className="mt-4 space-y-3">
              {airlines.map((airline) => (
                <label
                  key={airline.id}
                  className="flex cursor-pointer items-start gap-2 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={filters.airlines.includes(airline.id)}
                    onChange={(e) =>
                      update({
                        airlines: e.target.checked
                          ? [...filters.airlines, airline.id]
                          : filters.airlines.filter((id) => id !== airline.id),
                      })
                    }
                    className="mt-0.5 accent-[#2D3199]"
                  />
                  <span className="min-w-0 flex-1 text-slate-600">
                    {airline.name}
                    <span className="ml-1 text-slate-400">
                      ({airline.count})
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-500">
                    {money(airline.price)}
                  </span>
                </label>
              ))}
            </div>
          </details>
          {maxPrice > 0 && (
            <details open className="border-b py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold">
                Budget
                <ChevronDown size={15} />
              </summary>
              <label className="mt-4 block text-xs text-slate-500">
                Up to{" "}
                <span className="font-bold text-slate-800">
                  {money(filters.budget ?? maxPrice)}
                </span>
                <input
                  aria-label="Maximum total flight price"
                  type="range"
                  min={cheapest}
                  max={maxPrice}
                  step={1}
                  value={filters.budget ?? maxPrice}
                  onChange={(e) => update({ budget: Number(e.target.value) })}
                  className="mt-4 w-full accent-[#2D3199]"
                />
              </label>
            </details>
          )}
          <details className="py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold">
              Departure time
              <ChevronDown size={15} />
            </summary>
            <div className="mt-4 space-y-3">
              {[
                ["all", "Any time"],
                ["0", "Night · 00:00–05:59"],
                ["1", "Morning · 06:00–11:59"],
                ["2", "Afternoon · 12:00–17:59"],
                ["3", "Evening · 18:00–23:59"],
              ].map(([value, label]) => (
                <label
                  key={value}
                  className="flex items-center gap-2 text-xs text-slate-600"
                >
                  <input
                    type="radio"
                    name="departure-time"
                    checked={filters.departure === value}
                    onChange={() => update({ departure: value })}
                    className="accent-[#2D3199]"
                  />
                  {label}
                </label>
              ))}
            </div>
          </details>
        </aside>
        <div className="min-w-0 space-y-3">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 bg-[#1C1F66] px-5 py-3 text-xs font-semibold text-white">
              <Plane size={15} />
              {query.get("returnDate")
                ? "Your round-trip options"
                : "Flights to " + destination}
            </div>
            <div className="grid grid-cols-[1fr_1fr_auto] divide-x divide-slate-100">
              {[
                ["price", "Lowest price", filteredCheapest],
                ["duration", "Shortest journey", fastest?.pricing.totalKobo],
              ].map(([value, label, amount]) => (
                <button
                  key={String(value)}
                  type="button"
                  onClick={() => update({ sort: String(value) })}
                  aria-pressed={filters.sort === value}
                  className={`border-b-2 px-3 py-3 text-center ${filters.sort === value ? "border-[#2D3199] bg-indigo-50/50 text-[#2D3199]" : "border-transparent text-slate-600 hover:bg-slate-50"}`}
                >
                  <span className="block text-xs font-bold">{label}</span>
                  <span className="mt-1 block text-[11px]">
                    {Number(amount) > 0 ? money(Number(amount)) : "—"}
                  </span>
                </button>
              ))}
              <label className="flex items-center px-2 sm:px-4">
                <span className="sr-only">Sort flight results</span>
                <select
                  value={filters.sort}
                  onChange={(e) => update({ sort: e.target.value })}
                  className="w-24 bg-transparent text-[11px] font-semibold outline-none sm:w-28"
                >
                  <option value="price">Lowest price</option>
                  <option value="duration">Shortest time</option>
                  <option value="departure">Departure time</option>
                </select>
              </label>
            </div>
          </div>
          {!results.length && (
            <div className="rounded-2xl border bg-white px-6 py-12 text-center">
              <SearchEmpty />
              <h3 className="mt-4 font-bold text-slate-800">
                {offers.length
                  ? "No flights match these filters"
                  : "No available flights for these dates"}
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
                {offers.length
                  ? "Try fewer filters to see more flight options."
                  : "Choose a nearby date above or change your destination."}
              </p>
              {offers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilters(initialFilters)}
                  className={`${travelButton} mt-5`}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
          {results.map((offer) => (
            <article
              key={offer.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_3px_14px_-10px_rgba(28,31,102,0.2)] transition-shadow hover:shadow-md"
            >
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-[10px] sm:px-5">
                {offer.pricing.totalKobo === cheapest && (
                  <span className="rounded bg-[#EDEEFF] px-2 py-1 font-bold text-[#2D3199]">
                    Lowest available fare
                  </span>
                )}
                <span className="text-slate-500">
                  {query.get("returnDate") ? "Round trip" : "One way"} ·{" "}
                  {query.get("cabinClass")?.replace(/_/g, " ") || "Economy"}
                </span>
                {offer.conditions?.refund_before_departure?.allowed && (
                  <span className="ml-auto text-[#2D3199]">
                    Refunds allowed · conditions apply
                  </span>
                )}
              </div>
              <div className="grid gap-4 px-4 py-4 sm:px-5 xl:grid-cols-[minmax(0,1fr)_170px]">
                <div className="space-y-3">
                  {(offer.slices || []).map((slice: any, index: number) => {
                    const first = slice.segments?.[0],
                      last = slice.segments?.at(-1),
                      stops = flightStops({ slices: [slice] });
                    return (
                      <div
                        key={slice.id || index}
                        className="grid grid-cols-[1fr_1fr_70px_1fr] items-center gap-2 sm:grid-cols-[130px_1fr_105px_1fr]"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {offer.owner?.logo_symbol_url ? (
                              <img
                                src={offer.owner.logo_symbol_url}
                                alt=""
                                className="h-7 w-7 object-contain"
                                loading="lazy"
                              />
                            ) : (
                              <Plane size={23} className="text-[#2D3199]" />
                            )}
                            <span className="hidden truncate text-xs font-semibold text-slate-700 sm:block">
                              {offer.owner?.name ||
                                first?.marketing_carrier?.name}
                            </span>
                          </div>
                          <p className="mt-1 text-[9px] text-slate-400">
                            {offer.slices.length > 1
                              ? index
                                ? "Return"
                                : "Outbound"
                              : "Departure"}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold tracking-tight text-slate-950 sm:text-xl">
                            {first?.departing_at?.slice(11, 16) || "—"}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {slice.origin?.iata_code ||
                              first?.origin?.iata_code}
                            {first?.origin_terminal
                              ? ` · T${first.origin_terminal}`
                              : ""}
                          </p>
                          <p className="mt-0.5 text-[9px] text-slate-400">
                            {shortDate(first?.departing_at?.slice(0, 10) || "")}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="mb-2 text-[10px] text-slate-500">
                            {duration(slice.duration)}
                          </p>
                          <div className="relative mx-1 h-px bg-slate-300">
                            <span className="absolute -top-0.5 left-0 h-1 w-1 rounded-full bg-slate-300" />
                            <span className="absolute -top-0.5 right-0 h-1 w-1 rounded-full bg-slate-300" />
                          </div>
                          <p
                            className={`mt-2 text-[10px] ${stops ? "text-slate-500" : "text-[#2D3199]"}`}
                          >
                            {stops
                              ? `${stops} stop${stops > 1 ? "s" : ""}`
                              : "Non-stop"}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold tracking-tight text-slate-950 sm:text-xl">
                            {last?.arriving_at?.slice(11, 16) || "—"}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {slice.destination?.iata_code ||
                              last?.destination?.iata_code}
                            {last?.destination_terminal
                              ? ` · T${last.destination_terminal}`
                              : ""}
                          </p>
                          <p className="mt-0.5 text-[9px] text-slate-400">
                            {shortDate(last?.arriving_at?.slice(0, 10) || "")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-xs font-semibold text-slate-600 sm:hidden">
                    {offer.owner?.name}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-dashed border-slate-200 pt-4 xl:flex-col xl:items-end xl:justify-center xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
                  <div className="xl:text-right">
                    <p className="text-[10px] text-slate-400">
                      Total for all travellers
                    </p>
                    <p className="mt-1 whitespace-nowrap text-xl font-black tracking-tight text-[#2D3199]">
                      {money(offer.pricing.totalKobo)}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      Fare total in NGN
                    </p>
                  </div>
                  <Link
                    href={`/flights/checkout/${offer.id}`}
                    className={`${travelButton} shrink-0 rounded-lg bg-[#FF3B00] px-4 py-2.5 hover:bg-[#dc3300] xl:w-full`}
                  >
                    Select flight
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
              <details className="border-t border-slate-100">
                <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-[11px] font-semibold text-[#2D3199]">
                  <span className="flex items-center gap-2">
                    <Clock3 size={13} />
                    Flight details & baggage
                  </span>
                  <ChevronDown size={14} />
                </summary>
                <div className="border-t border-slate-100 p-4">
                  {details(offer)}
                </div>
              </details>
            </article>
          ))}
          {offers.length > 0 && (
            <p className="flex items-center justify-center gap-2 py-4 text-[11px] text-slate-500">
              <ShieldCheck size={14} className="text-[#2D3199]" />
              Availability and final fare are checked again before payment.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
function SearchEmpty() {
  return <SlidersHorizontal size={32} className="mx-auto text-indigo-200" />;
}
