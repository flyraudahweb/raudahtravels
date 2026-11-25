import { useState } from "react";
import { useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertCircle, ChevronLeft, ChevronRight, Phone, RefreshCw } from "lucide-react";
import { ota, travelButton, travelInput } from "@/lib/ota";

const reasons = {
  payment_review: { label: "Check payment", guidance: "Verify the existing payment before asking the customer to pay again." },
  supplier_review: { label: "Check reservation", guidance: "Check the existing reservation with the supplier before creating another one." },
  callback: { label: "Callback requested", guidance: "Call the customer to find out where they need help." },
  fare_changed: { label: "Fare changed", guidance: "Help the customer review the current price in checkout." },
  unavailable: { label: "Offer needs review", guidance: "Check availability and the current price before continuing." },
  expired: { label: "Quote expired", guidance: "Check current availability and review the new total with the customer." },
  unpaid: { label: "Awaiting payment", guidance: "Ask if the customer needs help continuing their checkout." },
};
type FollowupCase = {
  id: string; bookingId: string | null; kind: "flight" | "hotel"; trip: string;
  reference: string | null; supplier: string | null; email: string | null; phone: string | null;
  mode: string | null; travelDate: string | null; revision: number;
  requestedAt: string | null; updatedAt: string; reason: keyof typeof reasons | null;
  assigned: boolean; assignedToMe: boolean; assignedName: string | null;
  outcome: "reached" | "no_answer" | "resolved" | null; note: string | null;
};
const outcomes = { reached: "Customer reached", no_answer: "No answer", resolved: "Resolved" };
const suppliers = { nuitee: "Nuitee", duffel: "Duffel", bilalsadasub: "Bilalsadasub" };

export default function AdminOtaFollowups() {
  const { user } = useUser();
  const [filters, setFilters] = useState({ kind: "", reason: "", supplier: "", search: "", state: "open" });
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState("");
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== ""));
  query.set("offset", String(offset));
  const queue = useQuery({
    queryKey: ["ota-follow-ups", user?.id, query.toString()],
    queryFn: ({ signal }) => ota<{ cases: FollowupCase[]; nextOffset: number | null; canManage: boolean; canOpenDesk: boolean }>(
      `/admin/follow-ups?${query}`, undefined, undefined, signal,
    ),
    enabled: !!user?.id, gcTime: 0, retry: false, refetchInterval: 30_000,
  });
  function filter(name: keyof typeof filters, value: string) {
    setFilters((previous) => ({ ...previous, [name]: value }));
    setOffset(0);
  }
  async function update(caseId: string, body: object) {
    setBusy(caseId);
    setError("");
    try {
      await ota(`/admin/follow-ups/${encodeURIComponent(caseId)}`, body);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Couldn't update this follow-up.");
    } finally {
      await queue.refetch();
      setBusy(undefined);
    }
  }
  const data = queue.isSuccess ? queue.data : undefined;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Checkout follow-up</h1>
          <p className="mt-2 text-sm text-slate-600">Help flight and hotel customers finish an interrupted checkout.</p>
        </div>
        <button type="button" className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold" disabled={queue.isFetching} onClick={() => void queue.refetch()}>
          <RefreshCw size={16} aria-hidden="true" /> Refresh
        </button>
      </header>
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <input aria-label="Search follow-ups" className={travelInput} placeholder="Reference, trip or contact" maxLength={100} value={filters.search} onChange={(event) => filter("search", event.target.value)} />
        <select aria-label="Trip type" className={travelInput} value={filters.kind} onChange={(event) => filter("kind", event.target.value)}>
          <option value="">Flights and hotels</option><option value="flight">Flights</option><option value="hotel">Hotels</option>
        </select>
        <select aria-label="Supplier" className={travelInput} value={filters.supplier} onChange={(event) => filter("supplier", event.target.value)}>
          <option value="">All suppliers</option>{Object.entries(suppliers).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
        </select>
        <select aria-label="Follow-up reason" className={travelInput} value={filters.reason} onChange={(event) => filter("reason", event.target.value)}>
          <option value="">All reasons</option>{Object.entries(reasons).map(([key, reason]) => <option value={key} key={key}>{reason.label}</option>)}
        </select>
        <select aria-label="Case status" className={travelInput} value={filters.state} onChange={(event) => filter("state", event.target.value)}>
          <option value="open">Open cases</option><option value="resolved">Resolved cases</option>
        </select>
      </div>
      {(error || queue.error) && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error || queue.error?.message}</p>}
      {queue.isPending && <p role="status" className="text-sm text-slate-600">Loading follow-ups…</p>}
      {data?.cases.length === 0 && <p className="rounded-xl border bg-white p-6 text-sm text-slate-600">No cases match these filters.</p>}
      <ul className="space-y-3">
        {data?.cases.map((item) => {
          const reason = item.reason ? reasons[item.reason] : undefined;
          const editable = item.outcome !== "resolved" && (item.assignedToMe || (data.canManage && item.assigned));
          const dial = item.phone?.replace(/[\s()-]/g, "");
          return (
            <li key={item.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-lg font-bold text-slate-950">{item.trip}</h2>
                  <p className="mt-1 break-words text-sm text-slate-600">{[item.kind === "flight" ? "Flight" : "Hotel", item.supplier && (suppliers[item.supplier as keyof typeof suppliers] ?? item.supplier), item.travelDate, item.reference, item.mode === "test" && "Sandbox"].filter(Boolean).join(" · ")}</p>
                </div>
                {reason && <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-900">{reason.label}</span>}
              </div>
              {reason && <p className="flex gap-2 text-sm text-slate-700"><AlertCircle className="mt-0.5 shrink-0" size={15} aria-hidden="true" />{reason.guidance}</p>}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
                {item.phone && <span>{item.phone}</span>}{item.email && <span className="break-all">{item.email}</span>}
                {item.requestedAt && <span>Customer requested a call</span>}
                <span>Updated {new Date(item.updatedAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })}</span>
                <span>{item.assignedName ? `Assigned to ${item.assignedName}` : "Unassigned"}</span>
                {item.outcome && <span className="font-semibold">{outcomes[item.outcome]}</span>}
              </div>
              {item.note && <p className="whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{item.note}</p>}
              <div className="flex flex-wrap items-center gap-3">
                {!item.assigned && item.outcome !== "resolved" && <button type="button" className={travelButton} disabled={!!busy} onClick={() => void update(item.id, { action: "claim", revision: item.revision })}>Claim case</button>}
                {editable && item.assignedToMe && dial && /^\+[1-9]\d{6,14}$/.test(dial) && <a className={travelButton} href={`tel:${dial}`}><Phone size={15} aria-hidden="true" /> Call customer</a>}
                {editable && <button type="button" className="rounded-xl border px-4 py-2 text-sm font-semibold" disabled={!!busy} onClick={() => void update(item.id, { action: "release", revision: item.revision })}>Release case</button>}
                {data.canOpenDesk && item.bookingId && <Link className="text-sm font-semibold text-indigo-800 underline" href={`/admin/ota-reservations?booking=${item.bookingId}${item.mode === "test" ? "&mode=test" : ""}`}>Open reservation</Link>}
              </div>
              {editable && <form className="grid gap-3 border-t pt-4 sm:grid-cols-[1fr_2fr_auto]" onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void update(item.id, { action: "outcome", revision: item.revision, outcome: form.get("outcome"), note: form.get("note") });
              }}>
                <select name="outcome" aria-label="Call outcome" className={travelInput} required defaultValue={item.outcome ?? ""}>
                  <option value="">Choose an outcome</option>{Object.entries(outcomes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                <input name="note" aria-label="Follow-up note" className={travelInput} maxLength={500} defaultValue={item.note ?? ""} placeholder="Internal note (optional)" />
                <button className="rounded-xl border px-4 py-2 text-sm font-semibold" disabled={!!busy}>Save outcome</button>
              </form>}
            </li>
          );
        })}
      </ul>
      {data && (offset > 0 || data.nextOffset !== null) && <div className="flex items-center justify-between gap-4 text-sm">
        <button type="button" disabled={offset === 0} className="inline-flex items-center gap-1 disabled:opacity-40" onClick={() => setOffset(Math.max(0, offset - 50))}><ChevronLeft size={16} aria-hidden="true" /> Previous</button>
        <span>{data.cases.length ? `${offset + 1}–${offset + data.cases.length}` : "No cases on this page"}</span>
        <button type="button" disabled={data.nextOffset === null} className="inline-flex items-center gap-1 disabled:opacity-40" onClick={() => setOffset(data.nextOffset ?? offset)}>Next <ChevronRight size={16} aria-hidden="true" /></button>
      </div>}
    </div>
  );
}
