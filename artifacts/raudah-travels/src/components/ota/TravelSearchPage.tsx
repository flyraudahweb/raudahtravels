import {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { Link, useSearch, useLocation } from "wouter";
import { SignInButton, useUser } from "@clerk/react";
import {
  Plane,
  Building2,
  ArrowRight,
  ShieldCheck,
  Loader2,
  SlidersHorizontal,
  ChevronDown,
  Clock3,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import TravelSearchForm from "./TravelSearchForm";
import ExchangeRates from "./ExchangeRates";
import FlightResults, { SearchLoading } from "./FlightResults";
import { moveDate } from "@/lib/travelSearch";
import { destinations, money, ota, travelButton, travelInput } from "@/lib/ota";

export function TravelShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  useLayoutEffect(() => {
    // Wouter preserves document scroll between pages. A long results list must
    // not leave the next checkout at its footer (or a payment page halfway down).
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location]);
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#eef0ff_0%,_#f8fafc_50%)]">
      <div className="print:hidden">
        <Navbar />
      </div>
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-28 md:px-8 print:m-0 print:max-w-none print:p-0">
        {children}
      </main>
      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  );
}
export function ErrorMessage({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="my-4 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 print:hidden"
    >
      {message}
    </div>
  );
}
export function Loading({
  label = "Loading your travel details…",
}: {
  label?: string;
}) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 p-16 text-indigo-800"
    >
      <Loader2 className="animate-spin" />
      {label}
    </div>
  );
}
function flightDate(value?: string) {
  const date = value?.slice(0, 10);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Date pending";
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
function durationLabel(value?: string) {
  const parts = /^PT(?:(\d+)H)?(?:(\d+)M)?/.exec(value || "");
  return parts
    ? [parts[1] && `${parts[1]}h`, parts[2] && `${parts[2]}m`]
        .filter(Boolean)
        .join(" ")
    : "";
}
export function FlightItinerary({
  offer,
  compact = false,
}: {
  offer: any;
  compact?: boolean;
}) {
  return (
    <div className="space-y-4">
      {(offer.slices || []).map((slice: any, i: number) => {
        const segments = slice.segments || [],
          first = segments[0],
          last = segments[segments.length - 1];
        const stops =
          Math.max(0, segments.length - 1) +
          segments.reduce(
            (n: number, segment: any) => n + (segment.stops?.length || 0),
            0,
          );
        return (
          <div
            key={slice.id || i}
            className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50/60 p-4"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-indigo-700">
                {offer.slices.length > 1
                  ? i === 0
                    ? "Outbound"
                    : "Return"
                  : "Your flight"}{" "}
                · {flightDate(first?.departing_at)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <Clock3 size={12} />
                {durationLabel(slice.duration)}
                {slice.duration && " · "}
                {segments.length
                  ? stops === 0
                    ? "Non-stop"
                    : `${stops} stop${stops > 1 ? "s" : ""}`
                  : "Route details pending"}
              </span>
            </div>
            <div className="grid grid-cols-[1fr_60px_1fr] items-center gap-3 sm:grid-cols-[1fr_100px_1fr]">
              <div>
                <p className="text-2xl font-semibold tracking-tight text-slate-950">
                  {first?.departing_at?.slice(11, 16) || "—"}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-700">
                  {slice.origin?.iata_code || first?.origin?.iata_code}
                </p>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {slice.origin?.city_name || first?.origin?.name}
                </p>
              </div>
              <div className="relative h-px bg-slate-300">
                <Plane
                  size={19}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-50 px-0.5 text-indigo-500"
                />
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold tracking-tight text-slate-950">
                  {last?.arriving_at?.slice(11, 16) || "—"}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-700">
                  {slice.destination?.iata_code || last?.destination?.iata_code}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {flightDate(last?.arriving_at)}
                </p>
              </div>
            </div>
            {segments.length > 0 && (
              <details
                open={!compact}
                className="mt-4 border-t border-slate-200/70 pt-3"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-indigo-700">
                  Flight details & baggage
                  <ChevronDown size={14} />
                </summary>
                {segments.map((s: any, j: number) => (
                  <div
                    key={s.id || j}
                    className="mt-2 border-l-2 border-indigo-100 pl-4 text-sm"
                  >
                    <p className="font-semibold">
                      {s.marketing_carrier?.name} ·{" "}
                      {s.marketing_carrier_flight_number || ""}
                    </p>
                    {s.operating_carrier?.name &&
                      s.operating_carrier.name !==
                        s.marketing_carrier?.name && (
                        <p className="text-xs text-slate-500">
                          Operated by {s.operating_carrier.name}
                        </p>
                      )}
                    <p>
                      {s.departing_at?.replace("T", " ")} {s.origin?.iata_code}{" "}
                      → {s.arriving_at?.replace("T", " ")}{" "}
                      {s.destination?.iata_code}
                    </p>
                    {(s.origin_terminal || s.destination_terminal) && (
                      <p className="mt-1 text-xs text-slate-500">
                        Departure terminal{" "}
                        {s.origin_terminal || "to be confirmed"} · Arrival
                        terminal {s.destination_terminal || "to be confirmed"}
                      </p>
                    )}
                    <p className="text-xs text-slate-500">
                      {s.passengers?.[0]?.cabin_class?.replace("_", " ")} ·
                      Baggage:{" "}
                      {(s.passengers?.[0]?.baggages || [])
                        .map(
                          (b: any) =>
                            `${b.quantity} ${(b.type || "bag").replace(/_/g, " ")}`,
                        )
                        .join(", ") || "See fare conditions"}
                    </p>
                  </div>
                ))}
                <p className="mt-3 text-[11px] text-slate-500">
                  Times are local to each airport. Check the latest itinerary
                  before travel.
                </p>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
export function RateConditions({ rate }: { rate: any }) {
  return (
    <div className="space-y-2 text-sm text-slate-600">
      {rate.board_type && <p>Board: {rate.board_type.replace(/_/g, " ")}</p>}
      <p>{rate.description}</p>
      {(rate.conditions || []).map((c: any, i: number) => (
        <p key={i}>
          <strong>{c.title}</strong> {c.description}
        </p>
      ))}
      <p className="font-semibold">Cancellation policy</p>
      {(rate.cancellation_timeline || []).length ? (
        rate.cancellation_timeline.map((c: any, i: number) => (
          <p key={i}>
            Before {c.before}: refund {c.currency} {c.refund_amount}
          </p>
        ))
      ) : (
        <p>
          No free cancellation is indicated. Contact support to confirm the
          policy before booking.
        </p>
      )}
      {rate.due_at_accommodation_amount &&
        Number(rate.due_at_accommodation_amount) > 0 && (
          <p className="font-semibold text-amber-800">
            Pay separately at the property: {rate.due_at_accommodation_currency}{" "}
            {rate.due_at_accommodation_amount}. This is in addition to the
            online total.
          </p>
        )}
    </div>
  );
}
export default function TravelSearchPage({
  kind,
}: {
  kind: "flight" | "hotel";
}) {
  const search = useSearch(),
    [, navigate] = useLocation(),
    { isSignedIn } = useUser();
  const [data, setData] = useState<any[]>([]),
    [loading, setLoading] = useState(() =>
      new URLSearchParams(search).has(
        kind === "flight" ? "departureDate" : "checkIn",
      ),
    ),
    [error, setError] = useState("");
  const [config, setConfig] = useState<any>(null),
    [sort, setSort] = useState("price");
  const [rates, setRates] = useState<any>(null),
    [busy, setBusy] = useState("");
  const ratesSection = useRef<HTMLElement>(null);
  const resultsSection = useRef<HTMLElement>(null);
  const revealResults = useRef(false);
  const roomRequest = useRef<AbortController | null>(null);
  const searchRequest = useRef<AbortController | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (loading || !revealResults.current) return;
    revealResults.current = false;
    const frame = requestAnimationFrame(() => {
      resultsSection.current?.focus({ preventScroll: true });
      resultsSection.current?.scrollIntoView({
        block: "start",
        behavior: "instant",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [loading]);
  useEffect(() => () => roomRequest.current?.abort(), []);
  useEffect(() => {
    if (rates)
      ratesSection.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }, [rates]);
  const query = new URLSearchParams(search),
    hasSearch = query.has(kind === "flight" ? "departureDate" : "checkIn");
  useEffect(() => {
    ota("/config")
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    roomRequest.current?.abort();
    setRates(null);
    setBusy("");
    setLoading(false);
    revealResults.current = false;
    if (!hasSearch) {
      setData([]);
      return;
    }
    const abort = new AbortController();
    searchRequest.current = abort;
    setLoading(true);
    setError("");
    setData([]);
    setRates(null);
    const q = new URLSearchParams(search),
      childAges = q.get("childAges")
        ? q.get("childAges")!.split(",").map(Number)
        : [];
    const city = destinations[Number(q.get("city") || 0)];
    const body =
      kind === "flight"
        ? {
            origin: q.get("origin"),
            destination: q.get("destination"),
            departureDate: q.get("departureDate"),
            ...(q.get("returnDate") ? { returnDate: q.get("returnDate") } : {}),
            cabinClass: q.get("cabinClass") || "economy",
            adults: Number(q.get("adults") || 1),
            childAges,
          }
        : {
            latitude: city?.lat,
            longitude: city?.lng,
            checkIn: q.get("checkIn"),
            checkOut: q.get("checkOut"),
            rooms: Number(q.get("rooms") || 1),
            adults: Number(q.get("adults") || 1),
            childAges,
          };
    ota(
      `/${kind === "flight" ? "flights" : "hotels"}/search`,
      body,
      undefined,
      abort.signal,
    )
      .then((result) => {
        if (!abort.signal.aborted) {
          revealResults.current = true;
          setData(result.offers || result.results || []);
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted) {
          revealResults.current = true;
          setError(e.message);
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [search, kind, hasSearch, attempt]);
  async function viewRates(resultId: string) {
    roomRequest.current?.abort();
    const controller = new AbortController();
    roomRequest.current = controller;
    setBusy(resultId);
    setError("");
    try {
      const data = await ota(
        `/hotels/rates/${resultId}`,
        {},
        undefined,
        controller.signal,
      );
      if (!controller.signal.aborted) setRates(data.result);
    } catch (e: any) {
      if (!controller.signal.aborted) setError(e.message);
    } finally {
      if (!controller.signal.aborted) setBusy("");
    }
  }
  async function quote(rateId: string) {
    roomRequest.current?.abort();
    const controller = new AbortController();
    roomRequest.current = controller;
    setBusy(rateId);
    setError("");
    try {
      const { quote } = await ota(
        "/hotels/quotes",
        { rateId },
        undefined,
        controller.signal,
      );
      if (!controller.signal.aborted) navigate(`/hotels/checkout/${quote.id}`);
    } catch (e: any) {
      if (!controller.signal.aborted) setError(e.message);
    } finally {
      if (!controller.signal.aborted) setBusy("");
    }
  }
  const results = [...data].sort((a, b) =>
    sort === "price"
      ? a.pricing.totalKobo - b.pricing.totalKobo
      : (b.accommodation?.rating || 0) - (a.accommodation?.rating || 0),
  );
  return (
    <TravelShell>
      <div
        className={`${hasSearch ? "mb-4" : "mb-7"} flex flex-wrap items-end justify-between gap-4`}
      >
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-indigo-600">
            Raudah / Explore
          </p>
          <h1
            className={`${hasSearch ? "text-xl md:text-2xl" : "text-3xl md:text-4xl"} font-black tracking-tight text-slate-900`}
          >
            {hasSearch
              ? kind === "flight"
                ? "Compare your flight options"
                : "Choose your stay"
              : kind === "flight"
                ? "Your next journey starts here."
                : "Find your place to unwind."}
          </h1>
          {!hasSearch && (
            <p className="mt-3 text-slate-500">
              {kind === "flight"
                ? "Compare available flights and travel with confidence."
                : "Explore available stays, room options and booking conditions."}
            </p>
          )}
        </div>
        <Link
          href="/dashboard/my-trips"
          className="text-sm font-bold text-indigo-700"
        >
          Manage my trips →
        </Link>
      </div>
      {config?.mode === "test" && (
        <p
          className={`mb-4 rounded-xl bg-amber-100 text-amber-900 ${hasSearch ? "px-4 py-2 text-xs" : "p-3 text-sm"}`}
        >
          Sandbox travel booking — these are test reservations.
        </p>
      )}
      <TravelSearchForm
        key={`${kind}:${search}`}
        initialKind={kind}
        initial={query}
        compact
        onSearchAgain={() => setAttempt((value) => value + 1)}
      />
      <details className="mt-4 rounded-xl border bg-white px-4 py-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-600">
          Currency reference rates
        </summary>
        <div className="mt-3">
          <ExchangeRates />
        </div>
      </details>
      <section
        ref={resultsSection}
        tabIndex={-1}
        aria-label={
          kind === "flight" ? "Flight search results" : "Hotel search results"
        }
        className="scroll-mt-28 outline-none"
      >
        {error && <ErrorMessage message={error} />}
        {loading ? (
          <SearchLoading
            query={query}
            kind={kind}
            returnFocusRef={resultsSection}
            onCancel={() => {
              searchRequest.current?.abort();
              revealResults.current = true;
              setLoading(false);
              setError(
                "Search cancelled. You can search again whenever you’re ready.",
              );
            }}
          />
        ) : (
          hasSearch &&
          !error &&
          (kind === "flight" ? (
            <FlightResults
              key={search + attempt}
              offers={data}
              query={query}
              details={(offer) => <FlightItinerary offer={offer} />}
              onDate={(offset) => {
                const next = new URLSearchParams(search);
                next.set(
                  "departureDate",
                  moveDate(query.get("departureDate") || "", offset),
                );
                if (query.get("returnDate"))
                  next.set(
                    "returnDate",
                    moveDate(query.get("returnDate")!, offset),
                  );
                navigate(`/flights/search?${next}`);
              }}
            />
          ) : (
            <>
              <div className="my-6 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-bold text-slate-800">
                  {results.length} available stays
                </h2>
                <label className="flex items-center gap-3 text-sm">
                  <SlidersHorizontal size={17} />
                  <span className="sr-only">Sort hotels</span>
                  <select
                    aria-label="Sort hotels"
                    className={travelInput}
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="price">Lowest price</option>
                    <option value="rating">Highest star rating</option>
                  </select>
                </label>
              </div>
              {!results.length && (
                <div className="rounded-2xl border bg-white p-12 text-center text-slate-500">
                  No available stays for this search. Try different dates or a
                  nearby destination.
                </div>
              )}
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {results.map((result) => (
                  <article
                    key={result.id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                  >
                    {result.accommodation?.photos?.[0]?.url ? (
                      <img
                        src={result.accommodation.photos[0].url}
                        alt={result.accommodation.name}
                        className="h-48 w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-48 items-center justify-center bg-indigo-50">
                        <Building2 size={48} className="text-indigo-300" />
                      </div>
                    )}
                    <div className="space-y-3 p-5">
                      <p className="text-sm text-amber-600">
                        {"★".repeat(
                          Math.min(
                            5,
                            Math.floor(result.accommodation?.rating || 0),
                          ),
                        )}
                      </p>
                      <h3 className="text-lg font-black text-slate-900">
                        {result.accommodation?.name}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {result.accommodation?.location?.address?.line_one} ·{" "}
                        {result.accommodation?.location?.address?.city_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {result.check_in_date} → {result.check_out_date} ·{" "}
                        {result.rooms} room(s)
                      </p>
                      <div className="flex items-center justify-between gap-2 border-t pt-4">
                        <div>
                          <p className="text-xs text-slate-500">
                            Stay total from
                          </p>
                          <p className="text-xl font-black text-indigo-950">
                            {money(result.pricing.totalKobo)}
                          </p>
                        </div>
                        <button
                          disabled={!!busy}
                          onClick={() => viewRates(result.id)}
                          className={travelButton}
                        >
                          {busy === result.id ? "Loading…" : "View rooms"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ))
        )}
      </section>
      {rates && (
        <section
          ref={ratesSection}
          className="mt-8 scroll-mt-28 rounded-3xl border-2 border-indigo-100 bg-white p-6"
        >
          {error && <ErrorMessage message={error} />}
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-500">
                Choose your room
              </p>
              <h2 className="text-2xl font-black">
                {rates.accommodation.name}
              </h2>
            </div>
            <button
              onClick={() => {
                roomRequest.current?.abort();
                setBusy("");
                setRates(null);
              }}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              Close
            </button>
          </div>
          <p className="mb-5 text-sm text-slate-500">
            {rates.accommodation.description}
          </p>
          {!(rates.accommodation.rooms || []).some(
            (r: any) => r.rates.length,
          ) && (
            <p>
              No supported prepaid rooms remain. Please try another property.
            </p>
          )}
          {rates.accommodation.rooms.map((room: any, i: number) => (
            <div key={i} className="mb-6">
              <h3 className="mb-3 text-lg font-bold">{room.name}</h3>
              {room.rates.map((rate: any) => (
                <div
                  key={rate.id}
                  className="mb-3 grid gap-5 rounded-xl border p-5 md:grid-cols-[1fr_auto]"
                >
                  <div>
                    <h4 className="mb-2 font-bold">{rate.name || room.name}</h4>
                    <RateConditions rate={rate} />
                  </div>
                  <div>
                    <p className="mb-3 text-xl font-black">
                      {money(rate.pricing.totalKobo)}
                    </p>
                    {isSignedIn ? (
                      <button
                        className={travelButton}
                        disabled={!!busy}
                        onClick={() => quote(rate.id)}
                      >
                        {busy === rate.id ? "Checking…" : "Get final quote"}
                      </button>
                    ) : (
                      <SignInButton mode="modal">
                        <button className={travelButton}>
                          Sign in to continue
                        </button>
                      </SignInButton>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </section>
      )}
      <div className="mt-10 flex items-center gap-3 text-sm text-slate-500">
        <ShieldCheck className="shrink-0 text-indigo-500" size={20} />
        Review supplier conditions before payment. Our team can help with
        changes and cancellation requests.
      </div>
    </TravelShell>
  );
}
