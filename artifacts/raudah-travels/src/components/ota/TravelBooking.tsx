import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { newestBooking } from "@/lib/bookingSnapshot";
import {
  useGetProfile,
  getGetProfileQueryKey,
} from "@workspace/api-client-react";
import { Link, useSearch } from "wouter";
import { SignInButton, useUser } from "@clerk/react";
import { CheckCircle2, Clock3, Printer, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  BookingSteps,
  BookingStatus,
  bookingState,
} from "./BookingPresentation";
import {
  ErrorMessage,
  FlightItinerary,
  Loading,
  RateConditions,
  TravelShell,
} from "./TravelSearchPage";
import { TravelCancellationPolicy } from "./TravelPolicies";
import { money, ota, OtaRequestError, travelButton, travelInput } from "@/lib/ota";
import { flightRecheckHref } from "@/lib/travelSearch";

type FlightFareQuote = {
  offer: { id: string; cabin_class: string } & Parameters<typeof TravelCancellationPolicy>[0]["offer"];
  pricing: { totalKobo: number };
  revision: number;
};

export default function TravelBooking({ bookingId }: { bookingId: string }) {
  const { isLoaded, isSignedIn, user } = useUser(),
    search = useSearch();
  const { data: profile } = useGetProfile({
    query: { queryKey: getGetProfileQueryKey(), enabled: !!isSignedIn },
  });
  const activeBookingId = useRef<string | null>(bookingId);
  const fareAlertRef = useRef<HTMLElement>(null);
  const autoFareRevision = useRef<number | undefined>(undefined);
  const requestEpoch = useRef(0),
    actionInFlight = useRef(false);
  const [booking, setBooking] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [notice, setNotice] = useState(""),
    [fareReview, setFareReview] = useState<string>(),
    [fareQuote, setFareQuote] = useState<FlightFareQuote>(),
    [fareError, setFareError] = useState(""),
    [recoveryCabin, setRecoveryCabin] = useState("");
  function acceptBooking(next: any) {
    if (activeBookingId.current === next.id)
      setBooking((previous: any) => newestBooking(previous, next));
  }
  const timeline = useQuery({
    queryKey: ["ota", "timeline", bookingId],
    queryFn: () => ota(`/bookings/${bookingId}/timeline`),
    enabled: !!isSignedIn && !!booking,
    refetchInterval: 30000,
  });
  const config = useQuery({
    queryKey: ["ota", "public-config"],
    queryFn: () => ota("/config"),
  });
  async function runAction(
    request: () => Promise<any>,
    apply: (data: any) => void,
    handleError?: (error: unknown) => boolean,
  ) {
    if (actionInFlight.current) return;
    const epoch = requestEpoch.current;
    actionInFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const data = await request();
      if (requestEpoch.current === epoch) apply(data);
    } catch (e: any) {
      if (requestEpoch.current === epoch && !handleError?.(e)) setError(e.message);
    } finally {
      if (requestEpoch.current === epoch) {
        actionInFlight.current = false;
        setBusy(false);
      }
    }
  }
  useLayoutEffect(() => {
    const epoch = ++requestEpoch.current;
    activeBookingId.current = bookingId;
    actionInFlight.current = false;
    setBooking(null);
    setError("");
    setBusy(false);
    setNotice("");
    setMessage("");
    setFareReview(undefined);
    setFareQuote(undefined);
    setFareError("");
    setRecoveryCabin("");
    autoFareRevision.current = undefined;
    if (!isSignedIn) return;
    const controller = new AbortController();
    ota(`/bookings/${bookingId}`, undefined, undefined, controller.signal)
      .then((d) => {
        if (!controller.signal.aborted && requestEpoch.current === epoch)
          acceptBooking(d.booking);
      })
      .catch((e) => {
        if (!controller.signal.aborted && requestEpoch.current === epoch)
          setError(e.message);
      });
    return () => {
      activeBookingId.current = null;
      requestEpoch.current++;
      controller.abort();
    };
  }, [bookingId, isSignedIn, user?.id]);
  useEffect(() => {
    if (!isSignedIn || !new URLSearchParams(search).has("reference")) return;
    void runAction(
      () => ota(`/bookings/${bookingId}/complete`, {}),
      (data) => acceptBooking(data.booking),
    );
  }, [bookingId, search, isSignedIn, user?.id]);
  useEffect(() => {
    if (!isSignedIn || !booking) return;
    const epoch = requestEpoch.current;
    let stopped = false;
    const timer = setInterval(
      () => {
        if (document.hidden) return;
        ota(`/bookings/${bookingId}`)
          .then((d) => {
            if (!stopped && requestEpoch.current === epoch)
              acceptBooking(d.booking);
          })
          .catch(() => {});
      },
      booking.status === "processing" ? 5000 : 30000,
    );
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [booking?.status, bookingId, isSignedIn, user?.id]);
  function handlePayError(error: unknown) {
    if (!(error instanceof OtaRequestError) ||
      !error.code || !["flight_fare_changed", "flight_offer_unavailable", "checkout_expired"].includes(error.code)) return false;
    setFareReview(error.code);
    return true;
  }
  async function pay() {
    await runAction(
      () => ota(`/bookings/${bookingId}/pay`, {}),
      (data) => window.location.assign(data.authorizationUrl),
      handlePayError,
    );
  }
  function showFareError(error: unknown) {
    setFareError(error instanceof Error ? error.message : "Couldn't check the fare. Please try again.");
    return true;
  }
  function checkCurrentFare() {
    setFareError("");
    setFareQuote(undefined);
    void runAction(
      () => ota<FlightFareQuote>(`/bookings/${bookingId}/flight-fare`, {
        ...(recoveryCabin && !booking.offer?.cabin_class ? { cabinClass: recoveryCabin } : {}),
      }),
      setFareQuote,
      showFareError,
    );
  }
  function acceptFareAndPay(quote: FlightFareQuote) {
    const epoch = requestEpoch.current;
    setFareError("");
    void runAction(async () => {
      const { booking: saved } = await ota("/bookings", {
        kind: "flight",
        offerId: quote.offer.id,
        editBookingId: bookingId,
        editRevision: quote.revision,
        refreshFlightFare: true,
        contact: booking.contact,
        travellers: booking.travellers,
        acceptedTerms: true,
        expectedTotalKobo: quote.pricing.totalKobo,
      });
      if (requestEpoch.current !== epoch) return;
      acceptBooking(saved);
      setFareQuote(undefined);
      setFareReview(undefined);
      return ota(`/bookings/${bookingId}/pay`, {});
    }, (data) => {
      if (data) window.location.assign(data.authorizationUrl);
    }, (error) => {
      setFareQuote(undefined);
      if (handlePayError(error)) return showFareError(error);
      setError(error instanceof Error ? error.message : "Couldn't continue to payment. Please try again.");
      return true;
    });
  }
  async function check() {
    await runAction(
      () => ota(`/bookings/${bookingId}/complete`, {}),
      (data) => acceptBooking(data.booking),
    );
  }
  useEffect(() => {
    if (fareReview) fareAlertRef.current?.focus();
  }, [fareReview]);
  const expired = booking && Date.parse(booking.expiresAt) <= Date.now();
  useEffect(() => {
    if ((!fareReview && !expired) || busy || !booking?.canRefreshFlightFare || !booking.offer?.cabin_class ||
        autoFareRevision.current === booking.revision) return;
    autoFareRevision.current = booking.revision;
    checkCurrentFare();
  }, [fareReview, expired, busy, booking]);
  if (!isLoaded)
    return (
      <TravelShell>
        <Loading />
      </TravelShell>
    );
  if (!isSignedIn)
    return (
      <TravelShell>
        <h1 className="mb-5 text-2xl font-bold">
          Sign in to view your booking
        </h1>
        <SignInButton mode="modal">
          <button className={travelButton}>Sign in</button>
        </SignInButton>
      </TravelShell>
    );
  const confirmed = booking?.status === "confirmed";
  const provider = booking?.providerResult,
    offer = booking?.offer;
  const needsFareReview = booking?.status === "payment_pending" && (expired || !!fareReview);
  const canRefreshFare = booking?.canRefreshFlightFare === true;
  const currentFare = canRefreshFare && fareQuote?.revision === booking?.revision ? fareQuote : undefined;
  const searchAgainHref = booking?.kind === "flight" ? flightRecheckHref(offer) : "/hotels";
  const checkPayment = (
    <button
      disabled={busy}
      onClick={check}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-indigo-300"
    >
      <RefreshCw size={15} aria-hidden="true" /> I have paid — check status
    </button>
  );
  return (
    <TravelShell>
      <div className="mx-auto max-w-4xl">
        {error && <ErrorMessage message={error} />}
        {needsFareReview && (
          <section ref={fareAlertRef} role="alert" tabIndex={-1} aria-labelledby="fare-review-title"
            className="mb-5 scroll-mt-28 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 sm:p-5 print:hidden">
            <h2 id="fare-review-title" className="text-base font-bold text-amber-950">
              {fareReview === "flight_fare_changed" ? "The flight price has changed"
                : fareReview === "flight_offer_unavailable" ? "This flight needs a new availability check"
                : "This checkout has expired"}
            </h2>
            <p className="mt-1 text-sm leading-relaxed">
              {canRefreshFare
                ? "Your traveller details are saved. Check the current fare for the same flights to continue."
                : "Your checkout is still in My Trips. Check the latest options before paying. If you already paid, check your payment status first."}
            </p>
            {canRefreshFare && !offer?.cabin_class && (
              <label className="mt-4 block max-w-xs text-sm font-semibold">
                Cabin class
                <select value={recoveryCabin} disabled={busy} className={`${travelInput} mt-1`}
                  onChange={(event) => {
                    setRecoveryCabin(event.target.value);
                    setFareQuote(undefined);
                    setFareError("");
                  }}>
                  <option value="">Choose a cabin class</option>
                  <option value="economy">Economy</option>
                  <option value="premium_economy">Premium economy</option>
                  <option value="business">Business</option>
                  <option value="first">First</option>
                </select>
              </label>
            )}
            {currentFare && (
              <div className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-white p-4 text-slate-900">
                <dl className="flex flex-wrap justify-between gap-x-6 gap-y-2 text-sm">
                  <div><dt className="text-slate-600">Saved quote</dt><dd>{money(booking.amountKobo)}</dd></div>
                  <div><dt className="text-slate-600">Current total</dt><dd className="font-bold">{money(currentFare.pricing.totalKobo)}</dd></div>
                </dl>
                <TravelCancellationPolicy kind="flight" offer={currentFare.offer} requestMode="none" />
              </div>
            )}
            {fareError && <p className="mt-3 text-sm font-semibold" role="status">{fareError}</p>}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              {canRefreshFare && (currentFare ? (
                <button type="button" className={travelButton} disabled={busy} onClick={() => acceptFareAndPay(currentFare)}>
                  {busy ? "Preparing payment…" : "Accept fare and pay"}
                </button>
              ) : (
                <button type="button" className={travelButton} disabled={busy || (!offer?.cabin_class && !recoveryCabin)} onClick={checkCurrentFare}>
                  {busy ? "Checking current fare…" : "Check current fare"}
                </button>
              ))}
              <Link href={searchAgainHref} className={canRefreshFare
                ? "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-indigo-300"
                : travelButton}>
                {booking.kind === "flight" ? "See current flights" : "See current hotel rates"}
              </Link>
              {!canRefreshFare && checkPayment}
            </div>
          </section>
        )}
        {booking?.providerNotice && (
          <p
            role="status"
            className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            {booking.providerNotice}
          </p>
        )}
        {!booking ? (
          !error && <Loading />
        ) : (
          <>
            <BookingSteps step={booking.status === "payment_pending" ? 2 : 3} />
            <div className="mb-6 rounded-3xl bg-gradient-to-br from-[#16194e] via-[#25297b] to-[#363da0] p-7 text-white shadow-[0_20px_50px_-30px_rgba(45,49,153,0.65)] md:p-10 print:border print:bg-white print:bg-none print:p-6 print:text-slate-950 print:shadow-none">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-200 print:text-slate-600">
                {booking.kind === "flight"
                  ? "Flight reservation"
                  : "Hotel reservation"}{" "}
                · {booking.mode === "test" ? "Sandbox" : "Live"}
              </p>
              <div className="flex items-start gap-4">
                {confirmed ? (
                  <CheckCircle2
                    className="mt-1 shrink-0 text-emerald-300"
                    size={32}
                  />
                ) : (
                  <Clock3 className="mt-1 shrink-0 text-amber-300" size={32} />
                )}
                <div className="min-w-0">
                  <h1 className="text-2xl font-black text-white md:text-3xl print:text-slate-950">
                    {confirmed
                      ? "Your reservation is confirmed."
                      : booking.status === "payment_pending"
                        ? "Your checkout is saved."
                        : booking.status === "requires_review"
                          ? "Our team needs to review your reservation."
                          : booking.status === "cancelled"
                            ? "The supplier reservation is cancelled."
                            : booking.status === "refunded"
                              ? "Your payment was refunded."
                              : "Your reservation is processing."}
                  </h1>
                  <p className="mt-3 break-all font-mono text-xs text-indigo-100 print:text-slate-600">
                    {booking.reference}
                  </p>
                  <div className="mt-3">
                    {fareReview && !expired && needsFareReview ? (
                      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
                        Fare needs review
                      </span>
                    ) : <BookingStatus booking={booking} />}
                  </div>
                  {booking.issue && (
                    <p className="mt-3 text-sm">{booking.issue}</p>
                  )}
                  {booking.status === "cancelled" && (
                    <p className="mt-3 text-sm">
                      A cancellation does not automatically confirm a customer
                      refund. Contact our travel team to review the applicable
                      refund.
                    </p>
                  )}
                  {booking.status === "processing" && (
                    <p className="mt-3 text-sm">
                      Payment received. We are checking the supplier
                      reservation. If this persists, contact support with your
                      reference. Please do not pay again.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <section
              className="mb-5 grid gap-5 rounded-2xl border bg-white p-6 sm:grid-cols-[1fr_auto]"
              aria-label="Booking next steps"
            >
              <div>
                <h2 className="font-bold text-slate-900">What happens next?</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                  {needsFareReview ? "Review current options to continue. Your saved booking details are below." : bookingState(booking).next}
                </p>
                {booking.status === "payment_pending" && !needsFareReview && (
                  <p className="mt-2 text-xs text-amber-800">
                    Offer expires {new Date(booking.expiresAt).toLocaleString()}
                    . Price and availability are checked before payment.
                  </p>
                )}
              </div>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-slate-500">{needsFareReview ? "Saved quote" : "Booking total"}</dt>
                  <dd className="text-xl font-bold text-slate-900">
                    {money(booking.amountKobo)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Payment</dt>
                  <dd className="font-semibold">
                    {booking.status === "refunded"
                      ? "Full refund verified"
                      : booking.paidAt
                        ? "Payment verified"
                        : "Awaiting verification"}
                  </dd>
                </div>
              </dl>
            </section>
            {booking.status === "payment_pending" && (
              <div className="mb-5">
                <TravelCancellationPolicy kind={booking.kind} offer={offer} />
              </div>
            )}
            <div className="mb-5 flex flex-wrap gap-3 print:hidden">
              <Link
                href={
                  profile?.role === "agent"
                    ? "/agent/my-trips"
                    : "/dashboard/my-trips"
                }
                className="rounded-xl border bg-white px-4 py-3 text-sm font-bold"
              >
                My trips
              </Link>
              {booking.editableOfferId && !needsFareReview && (
                <Link
                  href={`/${booking.kind === "flight" ? "flights" : "hotels"}/checkout/${encodeURIComponent(booking.editableOfferId)}?edit=${encodeURIComponent(booking.id)}`}
                  className="rounded-xl border bg-white px-4 py-3 text-sm font-bold"
                >
                  Edit checkout
                </Link>
              )}
              {confirmed && (
                <button onClick={() => window.print()} className={travelButton}>
                  <Printer size={16} />
                  Print itinerary / voucher
                </button>
              )}
              {confirmed &&
                booking.supplier === "bilalsadasub" &&
                booking.providerResult?.ticketPdfAvailable && (
                  <a
                    href={`/api/ota/bookings/${encodeURIComponent(booking.id)}/ticket`}
                    className={travelButton}
                  >
                    Download e-ticket (PDF)
                  </a>
                )}
              {booking.status === "payment_pending" && !needsFareReview && (
                <>
                  <button
                    disabled={busy}
                    onClick={pay}
                    className={travelButton}
                  >
                    {busy
                      ? "Please wait…"
                      : `Pay ${money(booking.amountKobo)}`}
                  </button>
                  {checkPayment}
                </>
              )}
            </div>
            {booking.providerBookingId && (
              <button
                disabled={busy}
                onClick={() =>
                  runAction(
                    () => ota(`/bookings/${bookingId}/refresh`, {}),
                    (data) => acceptBooking(data.booking),
                  )
                }
                className="mb-5 flex items-center gap-2 text-sm font-bold text-indigo-700 print:hidden"
              >
                <RefreshCw size={15} />
                Refresh supplier itinerary and ticket information
              </button>
            )}
            <section className="mb-5 space-y-5 rounded-2xl border bg-white p-6">
              <div className="flex flex-wrap justify-between gap-3">
                <h2 className="text-xl font-bold">
                  {provider?.booking_reference || provider?.reference
                    ? `Supplier reference: ${provider.booking_reference || provider.reference}`
                    : "Reservation details"}
                </h2>
                <strong>{money(booking.amountKobo)}</strong>
              </div>
              {booking.kind === "flight" ? (
                <>
                  <FlightItinerary
                    offer={
                      provider?.slices?.some(
                        (slice: any) => slice.segments?.length,
                      )
                        ? provider
                        : offer
                    }
                  />
                  <h3 className="font-bold">Ticket information</h3>
                  {confirmed && provider?.documents?.length ? (
                    provider.documents.map((d: any, i: number) => (
                      <p key={i} className="text-sm">
                        {d.type?.replace(/_/g, " ")}:{" "}
                        {d.unique_identifier || "Pending from airline"}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      Ticket documents are shown once returned by the airline. A
                      supplier booking reference is not an e-ticket number.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <h3 className="font-bold">{offer.accommodation?.name}</h3>
                  {provider?.check_in_instructions && (
                    <p className="mt-2 text-sm">
                      {provider.check_in_instructions}
                    </p>
                  )}
                  <p className="text-sm">
                    {offer.accommodation?.location?.address?.line_one},{" "}
                    {offer.accommodation?.location?.address?.city_name}
                  </p>
                  <p>
                    {offer.check_in_date} → {offer.check_out_date} ·{" "}
                    {offer.rooms} room(s)
                  </p>
                  <p className="text-sm">
                    Check-in after{" "}
                    {offer.accommodation?.check_in_information
                      ?.check_in_after_time || "the property's stated time"}
                    ; check-out before{" "}
                    {offer.accommodation?.check_in_information
                      ?.check_out_before_time || "the property's stated time"}
                    .
                  </p>
                  <p className="text-sm">
                    {offer.accommodation?.key_collection?.instructions}
                  </p>
                  {offer.accommodation?.rooms?.map((r: any, i: number) => (
                    <div key={i}>
                      <strong>{r.name}</strong>
                      {r.rates?.map((rate: any) => (
                        <RateConditions key={rate.id} rate={rate} />
                      ))}
                    </div>
                  ))}
                </>
              )}
              {booking.status !== "payment_pending" && (
                <TravelCancellationPolicy
                  kind={booking.kind}
                  offer={offer}
                  requestMode={confirmed ? "booking" : "none"}
                />
              )}
              <div className="border-t pt-4">
                <h3 className="mb-2 font-bold">Travellers</h3>
                {booking.travellers.map((p: any, i: number) => (
                  <p key={i} className="text-sm">
                    {p.given_name} {p.family_name}
                  </p>
                ))}
                <p className="mt-3 text-sm text-slate-500">
                  Contact: {booking.contact.email} · {booking.contact.phone}
                </p>
              </div>
            </section>
            <section
              className="mb-5 rounded-2xl border bg-white p-6 print:hidden"
              aria-label="Booking activity"
            >
              <h2 className="mb-4 text-lg font-bold">Booking activity</h2>
              {timeline.error ? (
                <p className="text-sm text-amber-800">
                  Activity could not be loaded.{" "}
                  <button
                    className="font-semibold underline"
                    onClick={() => timeline.refetch()}
                  >
                    Try again
                  </button>
                </p>
              ) : timeline.isLoading ? (
                <p className="text-sm text-slate-500">Loading activity…</p>
              ) : !timeline.data?.events?.length ? (
                <p className="text-sm text-slate-500">
                  Updates will appear here as your booking progresses.
                </p>
              ) : (
                <ol className="space-y-5 border-l border-slate-200 pl-5">
                  {timeline.data.events.map((event: any) => (
                    <li key={event.id}>
                      <p className="text-sm font-bold text-slate-900">
                        {event.title}
                      </p>
                      <time
                        className="text-xs text-slate-500"
                        dateTime={event.createdAt}
                      >
                        {new Date(event.createdAt).toLocaleString()}
                      </time>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">
                        {event.message}
                      </p>
                      {event.response && (
                        <p className="mt-2 whitespace-pre-wrap rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900">
                          Travel team: {event.response}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <section
              id="booking-help"
              className="scroll-mt-28 rounded-2xl border bg-white p-6 print:hidden"
            >
              <h2 className="mb-2 text-lg font-bold">
                Changes, cancellation or booking help
              </h2>
              <p className="mb-4 text-sm text-slate-500">
                Send a request to our travel team. Changes and cancellations
                depend on supplier rules and may carry fees. Sending a request
                does not cancel a reservation.
              </p>
              <div className="mb-4 flex flex-wrap gap-3 text-sm font-semibold text-indigo-700">
                {config.data?.supportEmail && (
                  <a href={`mailto:${config.data.supportEmail}`}>
                    Email travel support
                  </a>
                )}
                {config.data?.supportPhone && (
                  <a
                    href={`tel:${config.data.supportPhone.replace(/[^+\d]/g, "")}`}
                  >
                    Call {config.data.supportPhone}
                  </a>
                )}
                <Link href="/contact">Contact options</Link>
              </div>
              {booking.serviceRequest && (
                <p className="mb-4 rounded-xl bg-indigo-50 p-4 text-sm text-indigo-900">
                  Your request is with the travel team. A new request will
                  update the existing one.
                </p>
              )}
              <div className="mb-4 flex flex-wrap gap-2">
                {[
                  "I need help changing my travel dates.",
                  "I would like to request cancellation and review any applicable refund.",
                  "I need help with my ticket or hotel voucher.",
                ].map((text) => (
                  <button
                    type="button"
                    key={text}
                    onClick={() => setMessage(text)}
                    className="rounded-full border px-3 py-2 text-xs font-semibold text-slate-600"
                  >
                    {text.includes("dates")
                      ? "Change dates"
                      : text.includes("cancellation")
                        ? "Cancellation & refund"
                        : "Travel documents"}
                  </button>
                ))}
              </div>
              <form
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await runAction(
                    async () => {
                      await ota(`/bookings/${bookingId}/service-request`, {
                        message,
                      });
                      return ota(`/bookings/${bookingId}`);
                    },
                    (data) => {
                      acceptBooking(data.booking);
                      setNotice(
                        "Your request has been saved for the travel team.",
                      );
                      setMessage("");
                      void timeline.refetch();
                    },
                  );
                }}
              >
                <textarea
                  aria-label="Booking support request"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  minLength={10}
                  maxLength={2000}
                  required
                  className={`${travelInput} min-h-24`}
                  placeholder="Tell us how we can help. Do not include payment card details."
                />
                <button disabled={busy} className={travelButton}>
                  Send request
                </button>
                {notice && (
                  <p role="status" className="text-sm text-emerald-700">
                    {notice}
                  </p>
                )}
              </form>
            </section>
          </>
        )}
      </div>
    </TravelShell>
  );
}
