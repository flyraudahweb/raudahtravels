import { useRef, useState, type FormEvent } from "react";
import { useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Building2, CheckCircle2, FileText, Plane, RefreshCw } from "lucide-react";
import { money, ota, travelInput } from "@/lib/ota";
import { BookingStatus, tripDates, tripTitle } from "@/components/ota/BookingPresentation";
import { FlightItinerary } from "@/components/ota/TravelSearchPage";
import { TravelCancellationPolicy } from "@/components/ota/TravelPolicies";
import { FlightItineraryDownload } from "@/components/ota/FlightItineraryDownload";

const card = "space-y-4 rounded-2xl border border-slate-200 bg-white p-5";
const outline = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-indigo-500 disabled:opacity-50";
const statuses = { payment_pending: "Awaiting payment", processing: "Awaiting supplier", requires_review: "Needs review", confirmed: "Confirmed", cancelled: "Cancelled", refunded: "Refunded" };
const suppliers = { nuitee: "Nuitee", duffel: "Duffel", bilalsadasub: "Bilalsadasub" };
const tasks = { confirmation: "Paid awaiting confirmation", tickets: "Flights awaiting ticket", vouchers: "Hotels missing confirmation", changes: "Supplier updates", service: "Customer service requests", finance: "Finance exceptions" };
const stages = { proposed: "Proposal prepared", approved: "Customer approval recorded", supplier_submitted: "Submitted to supplier" };
const documentStatus = { voucher: "Voucher ready", pdf: "Ticket PDF ready", issued: "Ticket issuance reported" };
const filters = { search: "", mode: "live", kind: "", supplier: "", status: "", payment: "", document: "", task: "", from: "", to: "" };
type ReservationRow = { id: string; kind: "flight" | "hotel"; supplier: keyof typeof suppliers; trip: string; reference: string; locator?: string; travelDate?: string; status: keyof typeof statuses; document?: "voucher" | "pdf" | "issued"; assignedName?: string; paidAt?: string };

function SelectFilter({ title, value, onChange, items, placeholder }: { title: string; value: string; onChange: (value: string) => void; items: Record<string, string>; placeholder?: string }) {
  return <label className="space-y-1 text-xs font-semibold text-slate-700">{title}
    <select className={travelInput} value={value} onChange={(event) => onChange(event.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {Object.entries(items).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select>
  </label>;
}

export default function AdminOtaReservations() {
  const { user } = useUser();
  const link = new URLSearchParams(useSearch());
  const [values, setValues] = useState(() => ({ ...filters, mode: link.get("mode") === "test" ? "test" : "live" }));
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(() => link.get("booking") || undefined);
  const params = new URLSearchParams(Object.entries(values).filter(([, value]) => value));
  params.set("offset", String(offset));
  const records = useQuery({ queryKey: ["ota-reservations-desk", user?.id, params.toString()],
    queryFn: ({ signal }) => ota<{ rows: ReservationRow[]; nextOffset: number | null }>(`/admin/reservations?${params}`, undefined, undefined, signal),
    enabled: !!user?.id, gcTime: 0, retry: false,
  });
  function change(key: keyof typeof values, value: string) {
    setValues({ ...values, [key]: value });
    setOffset(0);
    setSelected(undefined);
  }
  const rows = records.isSuccess ? records.data.rows : [];
  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4 print:hidden">
      <div><h1 className="text-3xl font-bold tracking-tight text-slate-950">Reservations Desk</h1><p className="mt-2 text-sm text-slate-600">Find reservations and manage issues after payment.</p></div>
      <button type="button" className={outline} onClick={() => void records.refetch()} disabled={records.isFetching}><RefreshCw size={16} aria-hidden="true" /> Refresh</button>
    </header>
    <section className={`${card} grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:hidden`} aria-label="Reservation filters">
      <label className="space-y-1 text-xs font-semibold text-slate-700">Search reservations
        <input className={travelInput} placeholder="PNR, confirmation, reference or contact" maxLength={120} value={values.search} onChange={(event) => change("search", event.target.value)} />
      </label>
      <SelectFilter title="Work queue" value={values.task} onChange={(value) => change("task", value)} items={tasks} placeholder="All reservations" />
      <SelectFilter title="Booking status" value={values.status} onChange={(value) => change("status", value)} items={statuses} placeholder="All statuses" />
      <SelectFilter title="Payment" value={values.payment} onChange={(value) => change("payment", value)} items={{ paid: "Payment verified", unpaid: "Payment unverified" }} placeholder="All payments" />
      <SelectFilter title="Documents" value={values.document} onChange={(value) => change("document", value)} items={{ ready: "Ticket or voucher ready", missing: "Ticket or voucher missing" }} placeholder="All document states" />
      <SelectFilter title="Supplier" value={values.supplier} onChange={(value) => change("supplier", value)} items={suppliers} placeholder="All suppliers" />
      <SelectFilter title="Trip type" value={values.kind} onChange={(value) => change("kind", value)} items={{ flight: "Flights", hotel: "Hotels" }} placeholder="Flights and hotels" />
      <SelectFilter title="Environment" value={values.mode} onChange={(value) => change("mode", value)} items={{ live: "Live", test: "Sandbox" }} />
      <label className="space-y-1 text-xs font-semibold text-slate-700">Travel from<input className={travelInput} type="date" value={values.from} onChange={(event) => change("from", event.target.value)} /></label>
      <label className="space-y-1 text-xs font-semibold text-slate-700">Travel through<input className={travelInput} type="date" value={values.to} onChange={(event) => change("to", event.target.value)} /></label>
    </section>
    {records.error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{records.error.message}</p>}
    {records.isPending && <p role="status" className="text-sm text-slate-600">Loading reservations…</p>}
    {records.isSuccess && rows.length === 0 && <p className={`${card} text-sm text-slate-600`}>No reservations match these filters.</p>}
    <div className={selected ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]" : ""}>
      <ul className="space-y-2 print:hidden">
        {rows.map((row) => <li key={row.id}>
          <button type="button" aria-pressed={selected === row.id} className="flex w-full items-start gap-3 rounded-xl border bg-white p-4 text-left hover:border-indigo-400 aria-pressed:border-indigo-500 aria-pressed:bg-indigo-50" onClick={() => setSelected(row.id)}>
            {row.kind === "flight" ? <Plane size={19} className="mt-1 shrink-0 text-indigo-700" aria-hidden="true" /> : <Building2 size={19} className="mt-1 shrink-0 text-indigo-700" aria-hidden="true" />}
            <span className="min-w-0 flex-1 break-words"><span className="block font-bold text-slate-900">{row.trip}</span><span className="block text-xs text-slate-600">{[suppliers[row.supplier], row.travelDate, row.locator || row.reference].filter(Boolean).join(" · ")}</span>
              <span className="mt-1 block text-xs text-slate-600">{[row.paidAt ? "Payment verified" : "Payment unverified", row.document ? documentStatus[row.document] : row.status === "confirmed" ? "Document pending" : null].filter(Boolean).join(" · ")}</span>
              {row.assignedName && <span className="block text-xs text-slate-600">Assigned to {row.assignedName}</span>}</span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800">{statuses[row.status]}</span>
          </button>
        </li>)}
        {(offset > 0 || records.data?.nextOffset != null) && <li className="flex justify-between gap-3">
          <button type="button" className={outline} disabled={!offset} onClick={() => { setSelected(undefined); setOffset(Math.max(0, offset - 50)); }}>Previous</button>
          <button type="button" className={outline} disabled={records.data?.nextOffset == null} onClick={() => { setSelected(undefined); setOffset(records.data?.nextOffset ?? offset); }}>Next</button>
        </li>}
      </ul>
      {selected && records.isSuccess && <ReservationDetail key={`${user?.id}:${selected}`} id={selected} userId={user?.id} onChange={() => void records.refetch()} />}
    </div>
  </div>;
}

function formFields(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return new FormData(event.currentTarget);
}

function formatKobo(value?: number | null) {
  return typeof value === "number" ? money(value) : "Not verified";
}

function DetailField({ name, value }: { name: string; value: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs font-semibold text-slate-600">{name}</dt><dd className="mt-1 break-words text-sm text-slate-900">{value}</dd></div>;
}

function ReservationDetail({ id, userId, onChange }: { id: string; userId?: string; onChange: () => void }) {
  const base = `/admin/reservations/${encodeURIComponent(id)}`;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [quote, setQuote] = useState<any>();
  const pending = useRef(false);
  const details = useQuery({ queryKey: ["ota-reservation", userId, id],
    queryFn: ({ signal }) => ota(base, undefined, undefined, signal), enabled: !!userId, gcTime: 0, retry: false,
  });
  const data = details.isSuccess ? details.data : undefined;
  async function run(path: string, body: object | undefined, success: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await ota(base + path, body);
      if (path === "/cancellation-quote") setQuote(response.quote);
      else {
        if (path === "/refresh") setQuote(undefined);
        await details.refetch(); onChange();
      }
      setMessage(success);
    } catch (error) {
      setError(error instanceof Error ? error.message : "The action could not be completed.");
    } finally { pending.current = false; setBusy(false); }
  }
  if (details.error) return <p role="alert" className={`${card} text-red-800`}>{details.error.message}</p>;
  if (!data) return <p role="status" className={card}>Loading reservation…</p>;
  const { booking, case: work, permissions, events } = data;
  const rev = work.revision;
  const editable = work.assignedToMe || permissions.supervisor;
  const service = work.service;
  const finance = work.finance;
  const isHotel = booking.kind === "hotel";
  const printable = permissions.documents && booking.status === "confirmed" && !booking.itineraryReview && (!isHotel || booking.locator);
  const documentTitle = isHotel ? "Hotel voucher" : "Flight itinerary";
  const policyOffer = { ...booking.offer, accommodation: { ...booking.offer.accommodation, rooms: [{ rates: booking.offer.rates }] } };
  return <div className="space-y-4">
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{tripTitle(booking)}</h2><p className="mt-1 break-all text-xs text-slate-600">{booking.reference} · {suppliers[booking.supplier as keyof typeof suppliers] || booking.supplier}{booking.mode === "test" ? " · Sandbox" : ""}</p></div><BookingStatus booking={booking} /></div>
      <dl className="grid gap-3 sm:grid-cols-2"><DetailField name={isHotel ? "Hotel confirmation" : "Airline or supplier locator"} value={booking.locator || "Pending"} /><DetailField name="Travel dates" value={tripDates(booking) || "Unavailable"} />
        <DetailField name="Customer email" value={booking.contact?.email || "Unavailable"} /><DetailField name="Customer phone" value={booking.contact?.phone || "Unavailable"} />
      </dl>
      {booking.providerNotice && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{booking.providerNotice}</p>}
      {message && <p role="status" className="text-sm text-emerald-800">{message}</p>}{error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      <div className="flex flex-wrap gap-2 print:hidden">
        {booking.paidAt && booking.status !== "refunded" && <button type="button" className={outline} disabled={busy} onClick={() => void run("/refresh", {}, "Supplier status checked.")}>Check supplier status</button>}
        {permissions.supervisor && <Link href={`/admin/ota?booking=${id}`} className={outline}>Open OTA operations</Link>}
      </div>
    </section>
    <section className={`${card} print:hidden`}>
      <h3 className="font-bold">Work assignment</h3><p className="text-sm text-slate-700">{work.assignedName || "Unassigned"}{work.resolvedAt ? " · Resolved" : ""}</p>
      {work.note && <p className="break-words text-sm text-slate-600">{work.note}</p>}
      <div className="flex flex-wrap gap-2">
        {!work.assigned && <button className={outline} disabled={busy} onClick={() => void run("/case", { action: "claim", revision: rev }, "Case claimed.")}>Claim case</button>}
        {editable && work.assigned && <button className={outline} disabled={busy} onClick={() => void run("/case", { action: "release", revision: rev }, "Case released.")}>Release case</button>}
        {editable && work.resolvedAt && <button className={outline} disabled={busy} onClick={() => void run("/case", { action: "reopen", revision: rev }, "Case reopened.")}>Reopen case</button>}
      </div>
      {editable && !work.resolvedAt && <form className="space-y-3" onSubmit={(event) => {
        const form = formFields(event);
        const customerMessage = String(form.get("customerMessage") ?? "").trim();
        if (customerMessage && customerMessage.length < 10) {
          setError("Enter at least 10 characters in the customer update.");
          return;
        }
        void run("/case", { action: "resolve", revision: rev, note: form.get("note"), customerMessage: customerMessage || undefined },
          customerMessage ? "Case resolved and the customer request closed." : "Case resolved.");
      }}>
        <input name="note" className={travelInput} aria-label="Internal resolution note" placeholder="Internal resolution note" minLength={3} maxLength={1000} required />
        {booking.serviceRequest && <label className="block space-y-1 text-sm text-slate-700">Customer update to close their request (optional)
          <textarea name="customerMessage" minLength={10} maxLength={1000} className={travelInput} placeholder="Leave blank to keep the customer request open" />
        </label>}
        <button className={outline} disabled={busy}>Resolve case</button>
      </form>}
    </section>
    <section className={`${card} print:hidden`}>
      <h3 className="font-bold">Changes and cancellations</h3>
      {booking.serviceRequest && <p className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm">{booking.serviceRequest}</p>}
      <TravelCancellationPolicy kind={booking.kind} offer={policyOffer} requestMode="none" />
      {booking.supplier === "nuitee" && !isHotel && booking.status === "confirmed" && <button className={outline} disabled={busy} onClick={() => void run("/cancellation-quote", undefined, "Supplier quote received.")}>Get Nuitee cancellation quote</button>}
      {quote && <dl className="grid gap-3 rounded-lg bg-indigo-50 p-3 sm:grid-cols-2"><DetailField name="Estimated refund" value={quote.refund ? `${quote.refund.currency} ${quote.refund.amount}` : "Unavailable"}/><DetailField name="Penalty" value={quote.penalty ? `${quote.penalty.currency} ${quote.penalty.amount}` : "Unavailable"}/><DetailField name="Quote confidence" value={quote.confidence}/><DetailField name="Refund destination" value={quote.destination || "Unavailable"}/></dl>}
      {service && <dl className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2"><DetailField name="Case stage" value={stages[service.stage as keyof typeof stages]} /><DetailField name="Request type" value={service.kind} /><DetailField name="Proposed fee" value={service.fee == null ? "Unavailable" : `${service.currency} ${service.fee}`} /><DetailField name="Proposed refund" value={service.refund == null ? "Unavailable" : `${service.currency} ${service.refund}`} /><DetailField name="Operator note" value={service.note} />{service.supplierReference && <DetailField name="Supplier case reference" value={service.supplierReference}/>}</dl>}
      {editable && booking.paidAt && !["cancelled", "refunded"].includes(booking.status) && (work.resolvedAt || service?.stage !== "supplier_submitted") && (
        <ServiceForm key={`${rev}:${!!quote}`} service={work.resolvedAt ? undefined : service} quote={quote} busy={busy}
          save={(body, text) => void run("/service", { ...body, revision: rev }, text)} />
      )}
      {booking.status === "cancelled" && <p className="text-sm font-semibold text-slate-800">Supplier cancellation recorded. Check the customer refund separately in Finance.</p>}
    </section>
    {permissions.documents && <section className={`${card} print:border-0 print:shadow-none`} data-ota-print={printable ? "" : undefined}>
      <h3 className="flex items-center gap-2 font-bold"><FileText size={16} aria-hidden="true" /> {printable ? documentTitle : "Travel documents"}</h3>
      {printable ? <><p className="text-sm text-slate-700">{isHotel ? `${booking.offer.accommodation.name || "Hotel"} · ${booking.locator}` : booking.ticketed ? "Ticket issuance reported by the supplier." : "Flight itinerary. Ticket issuance is still awaiting confirmation."}</p>
        <p className="break-all text-xs text-slate-600">{[booking.reference, !isHotel && booking.locator, booking.mode === "test" && "Sandbox"].filter(Boolean).join(" · ")}</p>
        {isHotel ? <div className="space-y-2 text-sm"><p>{tripDates(booking)}</p>{booking.offer.accommodation.address && <p>{booking.offer.accommodation.address}</p>}{booking.offer.check_in_instructions && <p className="whitespace-pre-wrap">{booking.offer.check_in_instructions}</p>}</div> : <FlightItinerary offer={booking.offer} />}
        {booking.travellers?.length > 0 && <p className="break-words text-sm">{booking.travellers.join(" · ")}</p>}
        <div className="flex flex-wrap gap-2 print:hidden"><button className={outline} onClick={() => window.print()}>Print or save as PDF</button>
          {!isHotel && booking.supplier === "nuitee" && <FlightItineraryDownload className={outline} itinerary={{
            reference: booking.reference, locator: booking.locator, ticketed: booking.ticketed, mode: booking.mode,
            names: booking.travellers, slices: booking.offer.slices ?? [],
          }} />}
          {booking.ticket && <a className={outline} href={`/api/ota${base}/ticket`}>Download airline ticket</a>}
          {booking.mode === "live" && booking.paidAt && <button className={outline} disabled={busy} onClick={() => void run("/send-documents", {}, "Secure booking link sent to the saved customer email.")}>Email secure booking link</button>}</div>
        {work.documentSentAt && <p className="text-xs text-slate-600 print:hidden">Last emailed {new Date(work.documentSentAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</p>}
      </> : <p className="text-sm text-slate-600">{booking.itineraryReview
        ? "Confirm the updated flight schedule with the supplier before issuing documents."
        : "Documents become available when the reservation is confirmed."}</p>}
    </section>}
    {permissions.finance && booking.paidAt && <section className={`${card} print:hidden`}>
      <h3 className="font-bold">Finance reconciliation</h3>
      {booking.paymentIssue && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{booking.paymentIssue}</p>}
      <dl className="grid gap-3 sm:grid-cols-2"><DetailField name="Customer payment" value={formatKobo(booking.amountKobo)} /><DetailField name="Quoted supplier cost" value={formatKobo(booking.quotedSupplierKobo)} /><DetailField name="Actual net supplier cost" value={formatKobo(finance?.supplierKobo)} /><DetailField name="Paystack fees" value={formatKobo(finance?.feesKobo)} /><DetailField name="Verified customer refunds" value={finance ? formatKobo(finance.refundedKobo) : "Not checked"} /><DetailField name="Supplier cost difference" value={formatKobo(finance?.differenceKobo)} /><DetailField name="Margin on recorded amounts" value={formatKobo(finance?.marginKobo)} /><DetailField name="Paystack settlement" value={finance?.settlement ? `#${finance.settlement.id} · ${finance.settlement.date.slice(0, 10)}` : "Not reconciled"} /></dl>
      {finance?.supplierInvoice && <p className="break-words text-sm text-slate-700">Supplier evidence {finance.supplierInvoice}</p>}
      <button className={outline} disabled={busy} onClick={() => void run("/finance", { action: "refresh", revision: rev }, "Customer payment checked against Paystack.")}>Verify Paystack payment</button>
      <FinanceForms key={rev} busy={busy} save={(body, text) => void run("/finance", { ...body, revision: rev }, text)} />
    </section>}
    <section className={`${card} print:hidden`}><h3 className="font-bold">Reservation activity</h3>
      {events.length === 0 ? <p className="text-sm text-slate-600">No activity recorded.</p> : <ul className="space-y-2">{events.map((event: any, index: number) => <li key={`${event.createdAt}-${index}`} className="flex items-start gap-2 text-sm text-slate-700"><CheckCircle2 size={15} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{event.action.replace(/^(desk_)/, "").replaceAll("_", " ")} · {new Date(event.createdAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</span></li>)}</ul>}
    </section>
  </div>;
}

function ServiceForm({ service, quote, busy, save }: { service: any; quote: any; busy: boolean; save: (body: object, message: string) => void }) {
  const currency = service?.currency || quote?.refund?.currency || quote?.penalty?.currency || "NGN";
  return <div className="space-y-3 border-t pt-3">
    {service?.stage !== "approved" && <form className="grid gap-2 sm:grid-cols-2" onSubmit={(event) => {
      const form = formFields(event);
      const amount = (key: string) => form.get(key) ? Number(form.get(key)) : null;
      save({ stage: "proposed", kind: form.get("kind"), fee: amount("fee"), refund: amount("refund"), currency: String(form.get("currency")).toUpperCase(), note: form.get("note") }, "Servicing proposal saved.");
    }}>
      <select aria-label="Service request type" name="kind" className={travelInput} defaultValue={service?.kind ?? (quote ? "cancellation" : "change")}><option value="change">Change reservation</option><option value="cancellation">Cancel reservation</option></select>
      <input aria-label="Currency code" placeholder="Currency (e.g. NGN)" name="currency" pattern="[A-Za-z]{3}" className={travelInput} required defaultValue={currency} />
      <input aria-label="Estimated supplier fee" name="fee" placeholder="Estimated fee, if known" type="number" min="0" step="0.01" className={travelInput} defaultValue={service?.fee ?? (quote?.penalty?.currency === currency ? quote.penalty.amount : "")} />
      <input aria-label="Estimated supplier refund" name="refund" placeholder="Estimated refund, if known" type="number" min="0" step="0.01" className={travelInput} defaultValue={service?.refund ?? (quote?.refund?.currency === currency ? quote.refund.amount : "")} />
      <input aria-label="Supplier terms and operator note" name="note" placeholder="Supplier terms and operator note" minLength={3} maxLength={1000} required className={travelInput} defaultValue={service?.note ?? ""} /><button disabled={busy} className={outline}>Save proposal</button>
    </form>}
    {service?.stage === "proposed" && <form className="grid gap-2" onSubmit={(event) => { const form = formFields(event); save({ stage: "approved", customerApproved: form.get("approved") === "on", note: form.get("note") }, "Customer approval recorded."); }}>
      <label className="flex gap-2 text-sm text-slate-700"><input type="checkbox" name="approved" required /> Customer reviewed the terms and approved this change.</label>
      <input name="note" aria-label="Approval details" placeholder="Approval details" className={travelInput} minLength={3} maxLength={1000} required /><button className={outline} disabled={busy}>Record approval</button>
    </form>}
    {service?.stage === "approved" && <form className="grid gap-2" onSubmit={(event) => { const form = formFields(event); save({ stage: "supplier_submitted", supplierReference: form.get("reference"), note: form.get("note") }, "Supplier submission recorded. Use Check supplier status to verify the outcome."); }}>
      <p className="text-sm text-slate-700">Submit the approved request in the supplier portal and record its reference here.</p>
      <input name="reference" aria-label="Supplier case reference" placeholder="Supplier case reference" className={travelInput} minLength={2} maxLength={128} required /><input name="note" aria-label="Supplier submission details" placeholder="Submission details" className={travelInput} minLength={3} maxLength={1000} required /><button className={outline} disabled={busy}>Record supplier submission</button>
    </form>}
  </div>;
}

function FinanceForms({ busy, save }: { busy: boolean; save: (body: object, message: string) => void }) {
  return <div className="space-y-3 border-t pt-3">
    <form className="grid gap-2 sm:grid-cols-2" onSubmit={(event) => { const form = formFields(event); save({ action: "supplier_cost", supplierKobo: Math.round(Number(form.get("amount")) * 100), invoice: form.get("invoice") }, "Supplier cost evidence saved."); }}>
      <input aria-label="Net supplier cost in naira" name="amount" type="number" min="0" step="0.01" className={travelInput} placeholder="Net supplier cost (₦)" required /><input aria-label="Supplier invoice or debit reference" name="invoice" className={travelInput} placeholder="Invoice or debit reference" minLength={3} maxLength={128} required /><button className={outline} disabled={busy}>Record supplier cost</button>
    </form>
    <form className="grid gap-2 sm:grid-cols-2" onSubmit={(event) => { const form = formFields(event); save({ action: "refund", refundId: form.get("refundId") }, "Completed customer refund verified."); }}>
      <input name="refundId" aria-label="Paystack refund ID" placeholder="Paystack refund ID" pattern="[1-9][0-9]{0,19}" className={travelInput} required /><button className={outline} disabled={busy}>Verify completed refund</button>
    </form>
    <form className="grid gap-2 sm:grid-cols-2" onSubmit={(event) => { const form = formFields(event); save({ action: "settlement", settlementId: form.get("settlement"), date: form.get("date"), page: Number(form.get("page")) }, "Payout and transaction match verified."); }}>
      <input name="settlement" aria-label="Paystack settlement ID" placeholder="Paystack settlement ID" pattern="[1-9][0-9]{0,19}" className={travelInput} required /><input name="date" aria-label="Paystack settlement date" type="date" className={travelInput} required /><label className="text-xs text-slate-700">Settlement transaction page<input name="page" type="number" min="1" max="1000" step="1" className={travelInput} defaultValue="1" required /></label><button className={`${outline} self-end`} disabled={busy}>Verify payout match</button>
    </form>
  </div>;
}
