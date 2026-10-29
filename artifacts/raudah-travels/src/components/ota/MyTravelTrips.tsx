import { useState } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Plane,
  Building2,
  Package,
  ArrowRight,
  Search,
  RefreshCw,
} from "lucide-react";
import { ota, money, travelButton } from "@/lib/ota";
import { ErrorMessage, Loading } from "./TravelSearchPage";
import {
  BookingStatus,
  bookingState,
  tripTitle,
  tripDates,
} from "./BookingPresentation";
import TravelUpdates from "./TravelUpdates";

export default function MyTravelTrips() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("all");
  const travel = useInfiniteQuery({
    queryKey: ["ota", "my-bookings"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => ota(`/bookings?offset=${pageParam}`),
    getNextPageParam: (last: any) => last.nextOffset ?? undefined,
    refetchInterval: 30000,
  });
  const legacy = useQuery({
    queryKey: ["dashboard", "real-trips"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/my-trips", {
        credentials: "include",
      });
      if (!res.ok)
        throw new Error(
          "Your package and earlier bookings could not be loaded.",
        );
      return res.json();
    },
  });
  const rows = [
      ...new Map(
        (travel.data?.pages.flatMap((page) => page.bookings) || []).map(
          (booking: any) => [booking.id, booking],
        ),
      ).values(),
    ] as any[],
    earlier = legacy.data?.trips || [];
  const totals = travel.data?.pages[0]?.summary;
  const matches = (b: any) =>
    (!search ||
      `${b.reference} ${tripTitle(b)} ${b.providerResult?.booking_reference || ""}`
        .toLowerCase()
        .includes(search.toLowerCase().trim())) &&
    (status === "all" ||
      (status === "attention"
        ? !!b.providerNotice ||
          ["requires_review", "processing"].includes(b.status)
        : b.status === status));
  const visible = rows.filter(
    (b: any) => (filter === "all" || filter === b.kind) && matches(b),
  );
  const visibleEarlier = earlier.filter(
    (b: any) =>
      (filter === "all" || filter === b.type) &&
      status === "all" &&
      (!search ||
        `${b.title} ${b.reference}`
          .toLowerCase()
          .includes(search.toLowerCase().trim())),
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-indigo-600">
            Your travel companion
          </p>
          <h1 className="text-3xl font-black text-slate-900">My trips</h1>
          <p className="mt-2 text-sm text-slate-500">
            Manage your bookings, see updates and find your travel documents.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/flights" className={travelButton}>
            <Plane size={16} />
            Book flights
          </Link>
          <Link
            href="/hotels"
            className="rounded-xl border bg-white px-4 py-3 text-sm font-bold text-indigo-700"
          >
            Find hotels
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Confirmed", totals?.confirmed ?? "—"],
          ["Awaiting payment", totals?.pending ?? "—"],
          ["Need attention", totals?.attention ?? "—"],
        ].map(([label, count]) => (
          <div key={label} className="rounded-2xl border bg-white p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{count}</p>
          </div>
        ))}
      </div>
      <TravelUpdates />
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">
            Search trips by destination or reference
          </span>
          <Search
            size={17}
            className="absolute left-4 top-3.5 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Destination or booking reference (loaded trips)"
            className="min-h-12 w-full rounded-xl border bg-white pl-11 pr-4 text-sm"
          />
        </label>
        <select
          aria-label="Filter by booking status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="min-h-12 rounded-xl border bg-white px-4 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="attention">Needs attention</option>
          <option value="payment_pending">Awaiting payment</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refund verified</option>
        </select>
        <button
          onClick={() => travel.refetch()}
          aria-label="Refresh trips"
          className="rounded-xl border bg-white p-3"
        >
          <RefreshCw
            size={18}
            className={travel.isFetching ? "animate-spin" : ""}
          />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {["all", "flight", "hotel", "package"].map((f) => (
          <button
            key={f}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-2 text-sm font-bold capitalize ${filter === f ? "bg-indigo-900 text-white" : "border bg-white text-slate-600"}`}
          >
            {f === "all" ? "All trips" : `${f}s`}
          </button>
        ))}
      </div>
      {travel.error && <ErrorMessage message={travel.error.message} />}
      {legacy.error && <ErrorMessage message={legacy.error.message} />}
      {travel.isLoading ? (
        <Loading />
      ) : (
        <div className="space-y-4">
          {visible.map((b: any) => {
            const Icon = b.kind === "flight" ? Plane : Building2;
            return (
              <article
                key={b.id}
                className="flex flex-col justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-6 sm:flex-row"
              >
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
                    <Icon size={22} />
                  </div>
                  <div>
                    <p className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-indigo-700">
                      {b.kind}{" "}
                      {b.mode === "test" && (
                        <span className="rounded bg-amber-100 px-2 py-1 text-amber-900">
                          Sandbox
                        </span>
                      )}
                    </p>
                    <h2 className="text-lg font-black text-slate-900">
                      {tripTitle(b)}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {tripDates(b)}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">{b.reference}</p>
                    <div className="mt-3">
                      <BookingStatus booking={b} />
                    </div>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-500">
                      {b.providerNotice || bookingState(b).next}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                  <strong className="text-lg text-indigo-950">
                    {money(b.amountKobo)}
                  </strong>
                  <Link
                    href={`/travel/bookings/${b.id}`}
                    className="flex items-center gap-2 text-sm font-bold text-indigo-700"
                  >
                    {bookingState(b).action} <ArrowRight size={16} />
                  </Link>
                </div>
              </article>
            );
          })}
          {visibleEarlier.map((b: any) => (
            <article
              key={`earlier-${b.id}`}
              className="rounded-2xl border bg-white p-6"
            >
              <div className="mb-3 flex items-center gap-3">
                <Package className="text-indigo-600" size={20} />
                <h2 className="font-bold">{b.title}</h2>
                <span className="ml-auto text-xs capitalize">{b.status}</span>
              </div>
              <p className="text-sm text-slate-500">
                {b.subtitle || b.reference}
              </p>
              {b.type === "package" ? (
                <>
                  <p className="my-3 text-sm">
                    Paid {money(b.amountPaid * 100)} of{" "}
                    {money(b.totalPrice * 100)}
                  </p>
                  <Link
                    href="/dashboard/bookings"
                    className="text-sm font-bold text-indigo-700"
                  >
                    Manage package →
                  </Link>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  Earlier reservation — contact support for assistance.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
      {travel.hasNextPage && (
        <div className="text-center">
          <p className="mb-3 text-xs text-slate-500">
            Search and filters apply to the trips loaded so far.
          </p>
          <button
            onClick={() => travel.fetchNextPage()}
            disabled={travel.isFetchingNextPage}
            className={travelButton}
          >
            {travel.isFetchingNextPage
              ? "Loading more trips…"
              : "Load older trips"}
          </button>
        </div>
      )}
      {!travel.isLoading &&
        !legacy.isLoading &&
        (rows.length > 0 || earlier.length > 0) &&
        !visible.length &&
        !visibleEarlier.length && (
          <div className="rounded-2xl border border-dashed bg-white p-10 text-center">
            <h2 className="font-bold text-slate-900">
              No trips match these filters
            </h2>
            <button
              onClick={() => {
                setSearch("");
                setStatus("all");
                setFilter("all");
              }}
              className="mt-3 text-sm font-semibold text-indigo-700"
            >
              Clear filters
            </button>
          </div>
        )}
      {!travel.isLoading &&
        !legacy.isLoading &&
        !travel.error &&
        !legacy.error &&
        !rows.length &&
        !earlier.length && (
          <div className="rounded-3xl border border-dashed bg-white p-14 text-center">
            <Plane size={36} className="mx-auto mb-4 text-indigo-300" />
            <h2 className="text-xl font-bold">Where will you go next?</h2>
            <p className="mt-2 text-sm text-slate-500">
              Your saved checkouts and reservations will appear here.
            </p>
          </div>
        )}
    </div>
  );
}
