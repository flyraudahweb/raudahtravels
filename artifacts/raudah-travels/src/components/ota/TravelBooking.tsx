import { useEffect, useState, useRef } from "react";
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
import { FlightConditions } from "./TravelCheckout";
import { money, ota, travelButton, travelInput } from "@/lib/ota";

export default function TravelBooking({ bookingId }: { bookingId: string }) {
  const { isLoaded, isSignedIn } = useUser(),
    search = useSearch();
  const { data: profile } = useGetProfile({
    query: { queryKey: getGetProfileQueryKey(), enabled: !!isSignedIn },
  });
  const activeBookingId = useRef<string | null>(bookingId);
  const [booking, setBooking] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [notice, setNotice] = useState("");
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
  async function load() {
    const data = await ota(`/bookings/${bookingId}`);
    acceptBooking(data.booking);
    return data.booking;
  }
  useEffect(() => {
    activeBookingId.current = bookingId;
    setBooking(null);
    setError("");
    setBusy(false);
    setNotice("");
    setMessage("");
    if (!isSignedIn) return;
    const controller = new AbortController();
    ota(`/bookings/${bookingId}`, undefined, undefined, controller.signal)
      .then((d) => acceptBooking(d.booking))
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => {
      activeBookingId.current = null;
      controller.abort();
    };
  }, [bookingId, isSignedIn]);
  useEffect(() => {
    if (!isSignedIn || !new URLSearchParams(search).has("reference")) return;
    setBusy(true);
    ota(`/bookings/${bookingId}/complete`, {})
      .then((d) => acceptBooking(d.booking))
      .catch((e) => {
        if (activeBookingId.current === bookingId) setError(e.message);
      })
      .finally(() => {
        if (activeBookingId.current === bookingId) setBusy(false);
      });
  }, [bookingId, search, isSignedIn]);
  useEffect(() => {
    if (!isSignedIn || !booking) return;
    let stopped = false;
    const timer = setInterval(
      () => {
        if (document.hidden) return;
        ota(`/bookings/${bookingId}`)
          .then((d) => {
            if (!stopped) acceptBooking(d.booking);
          })
          .catch(() => {});
      },
      booking.status === "processing" ? 5000 : 30000,
    );
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [booking?.status, bookingId, isSignedIn]);
  async function pay() {
    setBusy(true);
    setError("");
    try {
      const data = await ota(`/bookings/${bookingId}/pay`, {});
      if (activeBookingId.current === bookingId)
        window.location.assign(data.authorizationUrl);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }
  async function check() {
    setBusy(true);
    setError("");
    try {
      const data = await ota(`/bookings/${bookingId}/complete`, {});
      acceptBooking(data.booking);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
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
  const confirmed = booking?.status === "confirmed",
    expired = booking && Date.parse(booking.expiresAt) <= Date.now();
  const provider = booking?.providerResult,
    offer = booking?.offer;
  return (
    <TravelShell>
      <div className="mx-auto max-w-4xl">
        {error && <ErrorMessage message={error} />}
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
                <div>
                  <h1 className="text-2xl font-black md:text-3xl">
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
                    <BookingStatus booking={booking} />
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
                  {bookingState(booking).next}
                </p>
                {booking.status === "payment_pending" && !expired && (
                  <p className="mt-2 text-xs text-amber-800">
                    Offer expires {new Date(booking.expiresAt).toLocaleString()}
                    . Price and availability are checked before payment.
                  </p>
                )}
              </div>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-slate-500">Booking total</dt>
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
              {booking.status === "payment_pending" && expired && (
                <Link
                  href={booking.kind === "flight" ? "/flights" : "/hotels"}
                  className={travelButton}
                >
                  Search again
                </Link>
              )}
              {confirmed && (
                <button onClick={() => window.print()} className={travelButton}>
                  <Printer size={16} />
                  Print itinerary / voucher
                </button>
              )}
              {booking.status === "payment_pending" && (
                <>
                  <button
                    disabled={busy || expired}
                    onClick={pay}
                    className={travelButton}
                  >
                    {busy
                      ? "Please wait…"
                      : expired
                        ? "Checkout expired"
                        : `Pay ${money(booking.amountKobo)}`}
                  </button>
                  <button
                    disabled={busy}
                    onClick={check}
                    className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold"
                  >
                    <RefreshCw size={15} />I have paid — check status
                  </button>
                </>
              )}
            </div>
            {booking.providerBookingId && (
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    acceptBooking(
                      (await ota(`/bookings/${bookingId}/refresh`, {})).booking,
                    );
                  } catch (e: any) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
                className="mb-5 flex items-center gap-2 text-sm font-bold text-indigo-700 print:hidden"
              >
                <RefreshCw size={15} />
                Refresh supplier itinerary and ticket information
              </button>
            )}
            {expired && booking.status === "payment_pending" && (
              <p className="mb-4 text-sm text-amber-800">
                This offer has expired. If you have already paid, check payment
                status. Otherwise, start a new search.
              </p>
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
                  <FlightItinerary offer={provider || offer} />
                  <FlightConditions offer={offer} />
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
              className="rounded-2xl border bg-white p-6 print:hidden"
              id="booking-help"
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
                  setBusy(true);
                  setError("");
                  try {
                    await ota(`/bookings/${bookingId}/service-request`, {
                      message,
                    });
                    setNotice(
                      "Your request has been saved for the travel team.",
                    );
                    setMessage("");
                    await load();
                    await timeline.refetch();
                  } catch (e: any) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
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
