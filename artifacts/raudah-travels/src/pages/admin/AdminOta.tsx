import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetProfile } from "@workspace/api-client-react";
import {
  Settings2,
  Plane,
  Building2,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { money, ota, travelButton, travelInput } from "@/lib/ota";
import { ErrorMessage, Loading } from "@/components/ota/TravelSearchPage";
import ExchangeRates from "@/components/ota/ExchangeRates";
import DuffelSettings from "@/components/ota/DuffelSettings";
import PricingPreview from "@/components/ota/PricingPreview";
import TravelUpdates from "@/components/ota/TravelUpdates";
import OtaOperationsSummary from "@/components/ota/OtaOperationsSummary";
import { BookingStatus, tripTitle } from "@/components/ota/BookingPresentation";
import { Link, useSearch } from "wouter";

export default function AdminOta() {
  const { data: profile } = useGetProfile(),
    qc = useQueryClient();
  const allowed = profile?.role === "super_admin";
  const [dirty, setDirty] = useState(false);
  const search = useSearch(),
    linkedId = new URLSearchParams(search).get("booking");
  const [searchTerm, setSearchTerm] = useState("");
  const linked = useQuery({
    queryKey: ["ota", "admin-booking", linkedId],
    queryFn: () => ota(`/admin/bookings/${encodeURIComponent(linkedId!)}`),
    enabled: allowed && !!linkedId,
  });
  const [tab, setTab] = useState(
      new URLSearchParams(search).get("tab") === "settings"
        ? "settings"
        : "bookings",
    ),
    [settings, setSettings] = useState<any>(null),
    [rates, setRates] = useState("");
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<any>(null),
    [providerId, setProviderId] = useState(""),
    [offset, setOffset] = useState(0),
    [filter, setFilter] = useState("all");
  function updateSettings(value: any) {
    setDirty(true);
    setSettings(value);
  }
  const config = useQuery({
    queryKey: ["ota", "admin-settings"],
    queryFn: () => ota("/admin/settings"),
    enabled: allowed,
  });
  const records = useQuery({
    queryKey: ["ota", "admin-bookings", offset],
    queryFn: () => ota(`/admin/bookings?offset=${offset}`),
    enabled: allowed,
    refetchInterval: 30000,
  });
  const events = useQuery({
    queryKey: ["ota", "events", selected?.id],
    queryFn: () => ota(`/admin/bookings/${selected.id}/events`),
    enabled: allowed && !!selected,
    refetchInterval: 30000,
  });
  useEffect(() => {
    if (linked.data?.booking) {
      setSelected(linked.data.booking);
      setProviderId(linked.data.booking.providerBookingId || "");
    }
  }, [linked.data]);
  useEffect(() => {
    if (!selected) return;
    const latest = records.data?.bookings?.find(
      (b: any) => b.id === selected.id,
    );
    if (latest) setSelected(latest);
  }, [records.data, selected?.id]);
  useEffect(() => {
    if (config.data && !dirty) {
      setSettings(config.data.settings);
      setRates(
        Object.entries(config.data.settings.rates)
          .map(([currency, rate]) => `${currency}=${rate}`)
          .join("\n"),
      );
    }
  }, [config.data, dirty]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("tab") === "settings") setTab("settings");
    else if (params.get("booking")) setTab("bookings");
  }, [search]);
  async function action(fn: () => Promise<any>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await fn();
      setNotice(typeof result === "string" ? result : message);
      await qc.invalidateQueries({ queryKey: ["ota"] });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!profile) return <Loading />;
  if (!allowed)
    return (
      <ErrorMessage message="Only a super admin can access the OTA console." />
    );
  const rows = records.data?.bookings || [],
    needsReview = rows.filter(
      (b: any) =>
        b.issue ||
        b.providerNotice ||
        b.serviceRequest ||
        b.status === "requires_review" ||
        b.status === "processing",
    );
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600">
            <ShieldCheck size={14} />
            Super admin only
          </p>
          <h1 className="text-3xl font-black text-slate-900">
            Online travel agency
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Manage distribution, pricing, reservations and booking exceptions.
          </p>
        </div>
        <button
          aria-label="Refresh OTA console"
          onClick={() => qc.invalidateQueries({ queryKey: ["ota"] })}
          className="rounded-xl border bg-white p-3"
        >
          <RefreshCw size={18} />
        </button>
      </div>
      <OtaOperationsSummary />
      <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3">
        {[
          ["Reservations on this page", rows.length, Plane],
          ["Need attention on this page", needsReview.length, ShieldCheck],
          ["Mode", settings?.mode || "—", Settings2],
        ].map(([label, value, Icon]: any) => (
          <div key={label} className="flex items-center gap-2 pr-5">
            <Icon size={15} className="text-indigo-500" />
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-sm font-bold capitalize text-slate-900">
              {value}
            </p>
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-b pb-3">
        {["bookings", "settings"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold capitalize ${tab === t ? "bg-indigo-900 text-white" : "bg-white text-slate-600"}`}
          >
            {t}
          </button>
        ))}
        <Link href="/admin/ota-api" className="ml-auto self-center px-3 text-xs font-bold text-[#2D3199]">API & Mobile →</Link>
      </div>
      {(error || config.error || records.error || linked.error) && (
        <ErrorMessage
          message={
            error ||
            config.error?.message ||
            records.error?.message ||
            linked.error?.message ||
            ""
          }
        />
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      {tab === "settings" ? (
        !settings ? (
          <Loading />
        ) : (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              action(async () => {
                const parsed: Record<string, number> = { NGN: 1 };
                for (const line of rates.split("\n").filter((s) => s.trim())) {
                  const [currency, value] = line.split("=");
                  if (
                    !/^[A-Z]{3}$/.test(currency?.trim() || "") ||
                    !Number.isFinite(Number(value)) ||
                    Number(value) <= 0
                  )
                    throw new Error(
                      "Enter each rate as GBP=1900, one currency per line.",
                    );
                  parsed[currency.trim()] = Number(value);
                }
                const payload = Object.fromEntries(
                  Object.entries(settings).filter(
                    ([key]) =>
                      !key.endsWith("Set") && key !== "encryptionReady",
                  ),
                );
                const saved = await ota(
                  "/admin/settings",
                  {
                    ...payload,
                    rates: parsed,
                  },
                  "PUT",
                );
                qc.setQueryData(["ota", "admin-settings"], (previous: any) => ({
                  ...previous,
                  settings: saved.settings,
                }));
                setSettings(saved.settings);
                setDirty(false);
              }, "OTA settings saved.");
            }}
          >
            <nav
              aria-label="OTA settings sections"
              className="flex flex-wrap gap-2"
            >
              {[
                ["ota-distribution", "Distribution"],
                ["ota-duffel", "Duffel & webhooks"],
                ["ota-pricing", "Pricing"],
                ["ota-support", "Support"],
              ].map(([id, title]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="rounded-full border bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
                >
                  {title}
                </a>
              ))}
            </nav>
            {dirty && (
              <p
                role="status"
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              >
                You have unsaved changes. Save settings to apply them.
              </p>
            )}
            <section
              id="ota-distribution"
              className="scroll-mt-24 space-y-4 rounded-2xl border bg-white p-6"
            >
              <h2 className="text-lg font-bold">
                Distribution and credentials
              </h2>
              <p className="text-sm text-slate-600">
                Existing Paystack configuration:{" "}
                <strong>
                  {config.data?.paystackMode?.replace("_", " ") || "checking"}
                </strong>
                . Keep the OTA mode aligned with those saved keys.
              </p>
              <p className="text-sm text-slate-500">
                Stays access must be enabled by Duffel. Sales require a funded
                Duffel balance, matching Paystack mode, currency rates, HTTPS
                APP_URL and a support email.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  Mode
                  <select
                    className={`${travelInput} mt-1`}
                    value={settings.mode}
                    onChange={(e) =>
                      updateSettings({ ...settings, mode: e.target.value })
                    }
                  >
                    <option value="test">Sandbox / test</option>
                    <option value="live">Live</option>
                  </select>
                </label>
                <p className="self-center text-sm text-slate-500">
                  Manage separate test/live keys and webhook signing secrets in
                  the Duffel section below.
                </p>
              </div>
              <p className="text-xs text-slate-500">
                Credential encryption:{" "}
                {settings.encryptionReady
                  ? "ready"
                  : "SETTINGS_ENCRYPTION_KEY must be configured before saving tokens"}
                . Tokens are never returned to the browser.
              </p>
              <div className="flex flex-wrap gap-5">
                {[
                  ["flightsEnabled", "Flight search"],
                  ["hotelsEnabled", "Duffel Stays search"],
                  ["salesEnabled", "Accept online payments"],
                ].map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 text-sm font-semibold"
                  >
                    <input
                      type="checkbox"
                      checked={settings[key]}
                      onChange={(e) =>
                        updateSettings({ ...settings, [key]: e.target.checked })
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </section>
            <DuffelSettings
              settings={settings}
              setSettings={updateSettings}
              urls={config.data?.webhookUrls}
              events={config.data?.recommendedWebhookEvents || []}
            />
            <section
              id="ota-pricing"
              className="scroll-mt-24 space-y-4 rounded-2xl border bg-white p-6"
            >
              <h2 className="text-lg font-bold">Pricing in Nigerian naira</h2>
              <ExchangeRates
                onUseReference={(reference) => {
                  setDirty(true);
                  try {
                    const draft: Record<string, number> = {};
                    for (const line of rates
                      .split("\n")
                      .filter((v) => v.trim())) {
                      const [currency, rate] = line.split("=");
                      if (
                        !/^[A-Z]{3}$/.test(currency?.trim() || "") ||
                        !Number.isFinite(Number(rate)) ||
                        Number(rate) <= 0
                      )
                        throw new Error(
                          "Check your rate draft before copying references.",
                        );
                      draft[currency.trim()] = Number(rate);
                    }
                    setRates(
                      Object.entries({ ...draft, ...reference, NGN: 1 })
                        .map(([currency, rate]) => `${currency}=${rate}`)
                        .join("\n"),
                    );
                    setNotice(
                      "Reference rates copied into your draft. Review and Save settings to apply your booking rates.",
                    );
                  } catch (e: any) {
                    setError(e.message);
                  }
                }}
              />
              <p className="text-sm text-slate-500">
                Enter NGN per one unit of each supplier currency. Unsupported
                currencies fail closed. Review rates regularly; each checkout
                saves its pricing snapshot.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  Currency rates
                  <textarea
                    value={rates}
                    onChange={(e) => {
                      setDirty(true);
                      setRates(e.target.value);
                    }}
                    placeholder={"NGN=1\nGBP=1900\nUSD=1500"}
                    className={`${travelInput} mt-1 min-h-36 font-mono`}
                  />
                </label>
                <div className="space-y-3">
                  {[
                    ["flightMarkupPercent", "Flight markup (%)"],
                    ["hotelMarkupPercent", "Hotel markup (%)"],
                    ["serviceFeeNgn", "Service fee (NGN)"],
                  ].map(([key, label]) => (
                    <label key={key} className="block text-sm">
                      {label}
                      <input
                        type="number"
                        min={0}
                        max={key === "serviceFeeNgn" ? 1000000 : 50}
                        step="0.01"
                        required
                        value={settings[key]}
                        onChange={(e) =>
                          updateSettings({
                            ...settings,
                            [key]: Number(e.target.value),
                          })
                        }
                        className={`${travelInput} mt-1`}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </section>
            <PricingPreview settings={settings} ratesText={rates} />
            <section
              id="ota-support"
              className="scroll-mt-24 grid gap-4 rounded-2xl border bg-white p-6 sm:grid-cols-2"
            >
              <label className="text-sm">
                Travel support email
                <input
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) =>
                    updateSettings({
                      ...settings,
                      supportEmail: e.target.value,
                    })
                  }
                  className={`${travelInput} mt-1`}
                />
              </label>
              <label className="text-sm">
                Travel support phone
                <input
                  value={settings.supportPhone}
                  onChange={(e) =>
                    updateSettings({
                      ...settings,
                      supportPhone: e.target.value,
                    })
                  }
                  className={`${travelInput} mt-1`}
                />
              </label>
            </section>
            <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
              <button disabled={busy} className={travelButton}>
                {busy ? "Saving…" : "Save settings"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  action(async () => {
                    const data = await ota("/admin/check", {});
                    return Object.entries(data.results)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ");
                  }, "Connection check finished. See diagnostics below.")
                }
                className="rounded-xl border bg-white px-5 py-3 text-sm font-bold"
              >
                Check connections
              </button>
            </div>
          </form>
        )
      ) : (
        <>
          <TravelUpdates operations limit={20} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              aria-label="Search reservations on this page"
              placeholder="Reference, destination or contact email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`${travelInput} max-w-sm`}
            />
            <select
              aria-label="Filter reservations"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className={`${travelInput} max-w-xs`}
            >
              <option value="all">All reservations on this page</option>
              <option value="attention">Requires attention</option>
              <option value="confirmed">Confirmed</option>
              <option value="flight">Flights</option>
              <option value="hotel">Hotels</option>
            </select>
            <div className="flex items-center gap-3 text-sm">
              <button
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 100))}
                className="disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                {rows.length ? offset + 1 : 0}–{offset + rows.length}
              </span>
              <button
                disabled={rows.length < 100}
                onClick={() => setOffset(offset + 100)}
                className="disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
          {records.isLoading ? (
            <Loading />
          ) : (
            <div className="space-y-3">
              {rows
                .filter(
                  (b: any) =>
                    (filter === "all" ||
                      filter === b.kind ||
                      filter === b.status ||
                      (filter === "attention" &&
                        (b.issue ||
                          b.providerNotice ||
                          b.serviceRequest ||
                          ["processing", "requires_review"].includes(
                            b.status,
                          )))) &&
                    (!searchTerm ||
                      `${b.reference} ${tripTitle(b)} ${b.contact?.email || ""}`
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase().trim())),
                )
                .map((b: any) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setSelected(b);
                      setProviderId(b.providerBookingId || "");
                    }}
                    className="flex w-full flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5 text-left hover:border-indigo-400"
                  >
                    <div>
                      <p className="font-bold">
                        {tripTitle(b)}{" "}
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          {b.mode}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {b.reference} · {b.contact.email}
                      </p>
                      {b.serviceRequest && (
                        <p className="mt-2 text-xs font-bold text-amber-700">
                          Customer service request
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <strong>{money(b.amountKobo)}</strong>
                      <div className="mt-2">
                        <BookingStatus booking={b} />
                      </div>
                    </div>
                  </button>
                ))}
              {!rows.length && (
                <div className="rounded-2xl border bg-white p-12 text-center text-slate-500">
                  Reservations will appear here after customers save a checkout.
                </div>
              )}
            </div>
          )}
          {selected && (
            <section className="space-y-4 rounded-2xl border-2 border-indigo-200 bg-white p-6">
              <div className="flex justify-between gap-4">
                <h2 className="text-lg font-bold">Booking operations</h2>
                <button onClick={() => setSelected(null)} className="text-sm">
                  Close
                </button>
              </div>
              <p className="break-all text-sm">{selected.reference}</p>
              <p className="text-sm">
                Customer: {selected.contact.email} · {selected.contact.phone}
              </p>
              <p className="text-sm">
                Paid: {selected.paidAt || "Not verified"} · Status:{" "}
                {selected.status}
              </p>
              {selected.issue && <ErrorMessage message={selected.issue} />}
              {selected.providerNotice && (
                <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                  {selected.providerNotice}
                </p>
              )}
              {selected.providerRequestId && (
                <p className="text-sm">
                  Duffel request ID: {selected.providerRequestId}
                </p>
              )}
              {selected.serviceRequest && (
                <div className="rounded-xl bg-amber-50 p-4 text-sm">
                  <strong>Customer request</strong>
                  <p className="mt-2 whitespace-pre-wrap">
                    {selected.serviceRequest}
                  </p>
                </div>
              )}
              <p className="text-sm">
                Supplier booking ID:{" "}
                {selected.providerBookingId || "Not recorded"}
              </p>
              {selected.status === "payment_pending" && (
                <button
                  className={travelButton}
                  disabled={busy}
                  onClick={() =>
                    action(
                      () =>
                        ota(`/admin/bookings/${selected.id}/check-payment`, {}),
                      "Payment verification completed. Booking state refreshed.",
                    )
                  }
                >
                  Verify customer payment
                </button>
              )}
              {selected.serviceRequest && (
                <form
                  className="space-y-3 rounded-xl border p-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const note = String(
                      new FormData(e.currentTarget).get("resolution"),
                    );
                    action(
                      () =>
                        ota(`/admin/bookings/${selected.id}/resolve-request`, {
                          note,
                        }),
                      "Service request resolved and saved to the audit history.",
                    );
                  }}
                >
                  <label className="block text-sm">
                    Response to customer (visible in booking activity)
                    <textarea
                      name="resolution"
                      required
                      minLength={10}
                      maxLength={2000}
                      className={`${travelInput} mt-1`}
                    />
                  </label>
                  <button className={travelButton} disabled={busy}>
                    Resolve customer request
                  </button>
                </form>
              )}
              <p className="text-sm text-slate-500">
                For processing or uncertain bookings, locate the reservation in
                the Duffel dashboard using this checkout's metadata or request
                ID. Do not create another supplier reservation. Verify
                cancellation/refund conditions with the supplier before acting.
              </p>
              <form
                className="flex flex-wrap gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  action(
                    () =>
                      ota(`/admin/bookings/${selected.id}/reconcile`, {
                        providerId,
                      }),
                    "Supplier reservation reconciled. Refresh the selected record to view updates.",
                  );
                }}
              >
                <input
                  aria-label="Verified Duffel order or booking ID"
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  placeholder="ord_… or bok_…"
                  required
                  className={`${travelInput} flex-1`}
                />
                <button
                  disabled={busy || !selected.paidAt}
                  className={travelButton}
                >
                  Verify supplier record
                </button>
              </form>
              {selected.paidAt &&
                ["requires_review", "cancelled"].includes(selected.status) && (
                  <form
                    key={`refund-${selected.id}`}
                    className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const data = new FormData(e.currentTarget);
                      action(
                        () =>
                          ota(`/admin/bookings/${selected.id}/refund-record`, {
                            refundId: String(data.get("refundId")),
                            supplierResolved: data.get("resolved") === "on",
                            note: String(data.get("note")),
                          }),
                        "Completed customer refund verified and recorded.",
                      );
                    }}
                  >
                    <h3 className="font-bold">
                      Record a completed customer refund
                    </h3>
                    <p className="text-sm text-slate-600">
                      Resolve the supplier reservation in Duffel, then process
                      any customer refund through Paystack. This verifies a
                      completed full refund; it does not send money or cancel a
                      reservation.
                    </p>
                    <label className="block text-sm">
                      Paystack refund ID
                      <input
                        name="refundId"
                        pattern="[0-9]+"
                        required
                        className={`${travelInput} mt-1`}
                      />
                    </label>
                    <label className="block text-sm">
                      Resolution note
                      <textarea
                        name="note"
                        minLength={10}
                        maxLength={1000}
                        required
                        className={`${travelInput} mt-1`}
                      />
                    </label>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="resolved"
                        required
                        className="mt-1"
                      />
                      I verified the supplier cancellation or absence of a
                      reservation and resolved supplier charges.
                    </label>
                    <button className={travelButton} disabled={busy}>
                      Verify completed refund
                    </button>
                  </form>
                )}
              <div className="border-t pt-4">
                <h3 className="mb-3 font-bold">Audit trail</h3>
                {events.error && (
                  <ErrorMessage message={events.error.message} />
                )}
                {events.data?.events?.map((event: any) => (
                  <p key={event.id} className="mb-2 text-xs text-slate-500">
                    {new Date(event.createdAt).toLocaleString()} ·{" "}
                    {event.action} · {event.actor}
                  </p>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
