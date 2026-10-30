import { useLayoutEffect, useState, useRef, type FormEvent } from "react";
import { useLocation } from "wouter";
import { SignInButton, useUser } from "@clerk/react";
import { LockKeyhole, ArrowRight } from "lucide-react";
import {
  ErrorMessage,
  FlightItinerary,
  Loading,
  RateConditions,
  TravelShell,
} from "./TravelSearchPage";
import { money, ota, travelButton, travelInput } from "@/lib/ota";
import { BookingSteps } from "./BookingPresentation";

export function FlightConditions({ offer }: { offer: any }) {
  return (
    <div className="space-y-2 text-sm text-slate-600">
      {["refund_before_departure", "change_before_departure"].map((key) => {
        const condition = offer.conditions?.[key];
        return (
          <p key={key}>
            <strong>
              {key === "refund_before_departure" ? "Refunds" : "Changes"}:
            </strong>{" "}
            {condition == null
              ? "Ask support for the fare rules before booking."
              : condition.allowed
                ? `Allowed${condition.penalty_amount ? `, supplier penalty ${condition.penalty_currency} ${condition.penalty_amount}` : " subject to supplier rules"}. Fare differences and service fees may apply.`
                : "Not permitted by this fare."}
          </p>
        );
      })}
    </div>
  );
}
export default function TravelCheckout({
  kind,
  offerId,
}: {
  kind: "flight" | "hotel";
  offerId: string;
}) {
  const { isLoaded, isSignedIn, user } = useUser(),
    [, navigate] = useLocation();
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [config, setConfig] = useState<any>(null);
  const [passportNumbers, setPassportNumbers] = useState<
    Record<number, string>
  >({});
  const checkoutKey = `${kind}:${offerId}`,
    activeCheckout = useRef<string | null>(checkoutKey);
  const requestEpoch = useRef(0),
    submitting = useRef(false);
  useLayoutEffect(() => {
    const epoch = ++requestEpoch.current;
    activeCheckout.current = checkoutKey;
    submitting.current = false;
    setBusy(false);
    setData(null);
    setError("");
    setPassportNumbers({});
    if (!isLoaded || (kind === "hotel" && !isSignedIn)) return;
    const abort = new AbortController();
    ota(
      `/${kind === "flight" ? "flights/offers" : "hotels/quotes"}/${encodeURIComponent(offerId)}`,
      undefined,
      undefined,
      abort.signal,
    )
      .then((result) => {
        if (!abort.signal.aborted && requestEpoch.current === epoch) {
          const travellers =
            kind === "flight" ? result.offer?.passengers : result.quote?.guests;
          if (!Array.isArray(travellers) || !travellers.length)
            throw new Error(
              "Traveller information is unavailable for this offer. Please choose another option.",
            );
          setData({ ...result, checkoutKey });
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted && requestEpoch.current === epoch)
          setError(e.message);
      });
    ota("/config", undefined, undefined, abort.signal)
      .then((result) => {
        if (!abort.signal.aborted && requestEpoch.current === epoch)
          setConfig(result);
      })
      .catch(() => {});
    return () => {
      activeCheckout.current = null;
      requestEpoch.current++;
      abort.abort();
    };
  }, [offerId, kind, isLoaded, isSignedIn, user?.id]);
  const offer =
    data?.checkoutKey === checkoutKey ? data?.offer || data?.quote : null;
  const lastTravelDate = (offer?.slices || [])
    .flatMap((slice: any) =>
      (slice.segments || []).map((segment: any) =>
        String(segment.arriving_at || segment.departing_at).slice(0, 10),
      ),
    )
    .sort()
    .at(-1);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!offer || submitting.current) return;
    const epoch = requestEpoch.current;
    submitting.current = true;
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const contact = {
      email: String(form.get("email")),
      phone: String(form.get("phone")),
      specialRequests: String(form.get("specialRequests") || ""),
    };
    const travellers = (
      kind === "flight" ? offer.passengers : offer.guests
    ).map((p: any, i: number) => ({
      given_name: String(form.get(`given_${i}`)),
      family_name: String(form.get(`family_${i}`)),
      ...(kind === "flight"
        ? {
            id: p.id,
            born_on: String(form.get(`dob_${i}`)),
            gender: String(form.get(`gender_${i}`)),
            title: String(form.get(`title_${i}`)),
            email: contact.email,
            phone_number: contact.phone,
            ...(form.get(`passport_${i}`)
              ? {
                  identity_documents: [
                    {
                      type: "passport",
                      unique_identifier: String(form.get(`passport_${i}`)),
                      issuing_country_code: String(
                        form.get(`country_${i}`),
                      ).toUpperCase(),
                      expires_on: String(form.get(`expiry_${i}`)),
                    },
                  ],
                }
              : {}),
          }
        : {}),
    }));
    try {
      const { booking } = await ota("/bookings", {
        kind,
        offerId,
        contact,
        travellers,
        expectedTotalKobo: data.pricing.totalKobo,
        acceptedTerms: form.get("terms") === "on",
      });
      // Persist first and navigate to the durable checkout before initiating a redirect.
      if (
        activeCheckout.current === checkoutKey &&
        requestEpoch.current === epoch
      )
        navigate(`/travel/bookings/${booking.id}`);
    } catch (e: any) {
      if (requestEpoch.current === epoch) setError(e.message);
    } finally {
      if (requestEpoch.current === epoch) {
        submitting.current = false;
        setBusy(false);
      }
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
        <div className="mx-auto max-w-lg rounded-3xl border bg-white p-10 text-center">
          <LockKeyhole className="mx-auto mb-4 text-indigo-600" size={36} />
          <h1 className="mb-3 text-2xl font-black">
            Keep your booking in one place.
          </h1>
          <p className="mb-6 text-slate-500">
            Sign in to save traveller details, pay securely and access your
            itinerary.
          </p>
          <SignInButton mode="modal">
            <button className={travelButton}>Sign in to continue</button>
          </SignInButton>
        </div>
      </TravelShell>
    );
  return (
    <TravelShell>
      <BookingSteps step={1} />
      <h1 className="mb-7 text-3xl font-black text-slate-900">
        Review your trip and add travellers
      </h1>
      {error && <ErrorMessage message={error} />}
      {!offer && !error ? (
        <Loading />
      ) : (
        offer && (
          <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
            <form onSubmit={submit} className="space-y-5">
              <section className="rounded-2xl border bg-white p-6">
                <h2 className="mb-4 text-xl font-bold">Contact details</h2>
                <p className="mb-4 text-sm text-slate-500">
                  Booking updates go to this address. Enter a phone number with
                  country code.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm">
                    Email
                    <input
                      name="email"
                      type="email"
                      defaultValue={user?.primaryEmailAddress?.emailAddress}
                      required
                      maxLength={254}
                      className={`${travelInput} mt-1`}
                    />
                  </label>
                  <label className="text-sm">
                    Phone
                    <input
                      name="phone"
                      type="tel"
                      placeholder="+2348012345678"
                      pattern="\+[1-9][0-9]{6,14}"
                      required
                      className={`${travelInput} mt-1`}
                    />
                  </label>
                </div>
              </section>
              {(kind === "flight" ? offer.passengers : offer.guests || []).map(
                (passenger: any, i: number) => (
                  <section
                    key={passenger.id || i}
                    className="rounded-2xl border bg-white p-6"
                  >
                    <h2 className="mb-2 text-lg font-bold">
                      {kind === "flight" ? "Traveller" : "Guest"} {i + 1}{" "}
                      {passenger.age != null ? `· age ${passenger.age}` : ""}
                    </h2>
                    <p className="mb-4 text-sm text-slate-500">
                      Use names exactly as shown on the travel document.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="text-sm">
                        Given names
                        <input
                          name={`given_${i}`}
                          required
                          maxLength={100}
                          className={`${travelInput} mt-1`}
                        />
                      </label>
                      <label className="text-sm">
                        Family name
                        <input
                          name={`family_${i}`}
                          required
                          maxLength={100}
                          className={`${travelInput} mt-1`}
                        />
                      </label>
                      {kind === "flight" && (
                        <>
                          <label className="text-sm">
                            Date of birth
                            <input
                              type="date"
                              name={`dob_${i}`}
                              required
                              max={new Date().toISOString().slice(0, 10)}
                              className={`${travelInput} mt-1`}
                            />
                          </label>
                          <label className="text-sm">
                            Gender on travel document
                            <select
                              name={`gender_${i}`}
                              required
                              className={`${travelInput} mt-1`}
                            >
                              <option value="">Select</option>
                              <option value="m">Male</option>
                              <option value="f">Female</option>
                            </select>
                          </label>
                          <label className="text-sm">
                            Title
                            <select
                              name={`title_${i}`}
                              required
                              className={`${travelInput} mt-1`}
                            >
                              {["mr", "ms", "mrs", "miss", "dr"].map((t) => (
                                <option key={t} value={t}>
                                  {t.toUpperCase()}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-sm">
                            Passport number{" "}
                            {offer.passenger_identity_documents_required
                              ? ""
                              : "(optional for this fare)"}
                            <input
                              name={`passport_${i}`}
                              minLength={4}
                              maxLength={30}
                              required={
                                !!offer.passenger_identity_documents_required
                              }
                              value={passportNumbers[i] || ""}
                              onChange={(e) =>
                                setPassportNumbers((previous) => ({
                                  ...previous,
                                  [i]: e.target.value,
                                }))
                              }
                              className={`${travelInput} mt-1`}
                            />
                          </label>
                          <label className="text-sm">
                            Issuing country (2 letters)
                            <input
                              name={`country_${i}`}
                              placeholder="NG"
                              pattern="[a-zA-Z]{2}"
                              maxLength={2}
                              required={
                                !!offer.passenger_identity_documents_required ||
                                !!passportNumbers[i]
                              }
                              className={`${travelInput} mt-1 uppercase`}
                            />
                          </label>
                          <label className="text-sm">
                            Passport expiry
                            <input
                              name={`expiry_${i}`}
                              type="date"
                              min={
                                lastTravelDate ||
                                new Date().toISOString().slice(0, 10)
                              }
                              required={
                                !!offer.passenger_identity_documents_required ||
                                !!passportNumbers[i]
                              }
                              className={`${travelInput} mt-1`}
                            />
                          </label>
                        </>
                      )}
                    </div>
                  </section>
                ),
              )}
              {kind === "hotel" && (
                <label className="block rounded-2xl border bg-white p-6 text-sm">
                  Special requests (optional)
                  <textarea
                    name="specialRequests"
                    maxLength={1000}
                    placeholder="Requests are subject to availability. Do not include medical or sensitive information."
                    className={`${travelInput} mt-3 min-h-24`}
                  />
                </label>
              )}
              <section className="space-y-4 rounded-2xl border bg-white p-6">
                <label className="flex items-start gap-3 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    name="terms"
                    required
                    className="mt-1"
                  />
                  <span>
                    I have checked all names, dates and travel requirements, and
                    accept the displayed supplier fare/rate and cancellation
                    conditions and{" "}
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-700 underline"
                    >
                      Raudah terms
                    </a>
                    . Price and availability will be checked before payment.
                  </span>
                </label>
                <button
                  disabled={busy || !config?.salesEnabled}
                  className={`${travelButton} w-full`}
                >
                  {busy ? "Saving checkout…" : "Save and continue to payment"}
                  <ArrowRight size={16} />
                </button>
                {!config?.salesEnabled && (
                  <p className="text-sm text-amber-800">
                    Online sales are currently unavailable. Please contact
                    support.
                  </p>
                )}
              </section>
            </form>
            <aside className="space-y-5 lg:sticky lg:top-28">
              <section className="rounded-2xl border bg-white p-6">
                <h2 className="mb-5 text-lg font-bold">Your trip</h2>
                {kind === "flight" ? (
                  <>
                    <FlightItinerary offer={offer} />
                    <div className="mt-5 border-t pt-4">
                      <FlightConditions offer={offer} />
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="font-bold">{offer.accommodation?.name}</h3>
                    <p className="mt-2 text-sm">
                      {offer.accommodation?.location?.address?.line_one}
                    </p>
                    <p className="my-3 text-sm">
                      {offer.check_in_date} → {offer.check_out_date} ·{" "}
                      {offer.rooms} room(s) · {offer.guests?.length} guest(s)
                    </p>
                    <p className="mb-4 text-xs text-slate-500">
                      Check-in after{" "}
                      {offer.accommodation?.check_in_information
                        ?.check_in_after_time || "the property's stated time"}
                      . Check-out before{" "}
                      {offer.accommodation?.check_in_information
                        ?.check_out_before_time || "the property's stated time"}
                      .
                    </p>
                    {offer.accommodation?.rooms?.map((r: any, i: number) => (
                      <div key={i}>
                        <p className="font-bold">{r.name}</p>
                        {r.rates?.map((rate: any) => (
                          <RateConditions key={rate.id} rate={rate} />
                        ))}
                      </div>
                    ))}
                  </>
                )}
                <dl className="mt-5 space-y-2 border-t pt-4 text-sm">
                  <div className="flex justify-between">
                    <dt>Travel fare, taxes & markup</dt>
                    <dd>
                      {money(
                        data.pricing.supplierKobo + data.pricing.markupKobo,
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Service fee</dt>
                    <dd>{money(data.pricing.feeKobo)}</dd>
                  </div>
                  <div className="flex justify-between border-t pt-3 text-lg font-black">
                    <dt>Pay online</dt>
                    <dd>{money(data.pricing.totalKobo)}</dd>
                  </div>
                </dl>
                {config?.mode === "test" && (
                  <p className="mt-4 rounded-lg bg-amber-100 p-3 text-xs text-amber-900">
                    Sandbox booking · test payments only
                  </p>
                )}
              </section>
              <div className="rounded-2xl bg-indigo-50 p-5 text-sm text-indigo-900">
                <h3 className="font-bold">Need a hand?</h3>
                <p className="mt-2">
                  {config?.supportEmail ||
                    "Contact our support team through the Contact page."}
                </p>
                <p>{config?.supportPhone}</p>
              </div>
            </aside>
          </div>
        )
      )}
    </TravelShell>
  );
}
