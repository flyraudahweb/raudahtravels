import { useRef, useState, type FormEvent } from "react";
import { Phone } from "lucide-react";
import { ota, travelButton, travelInput } from "@/lib/ota";

type CallbackSource =
  | { source: "booking"; bookingId: string }
  | { source: "checkout"; kind: "flight" | "hotel"; offerId: string; trip: string };

export function TravelCallback({ request }: { request: CallbackSource }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const phone = String(new FormData(event.currentTarget).get("phone") ?? "").replace(/\s/g, "");
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await ota("/callbacks", request.source === "checkout" ? { ...request, phone } : request);
      setSent(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Couldn't request a callback. Try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-label="Travel callback" className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-slate-800">
      {sent ? <p role="status" className="font-semibold">Callback requested. Our travel team will contact you.</p> : (
        <>
          <h3 className="flex items-center gap-2 font-bold text-indigo-950"><Phone size={16} aria-hidden="true" /> Need help with this trip?</h3>
          {open ? (
            <form onSubmit={submit} className="mt-3 space-y-3">
              {request.source === "checkout" ? (
                <label className="block">Phone number with country code
                  <input className={`${travelInput} mt-1`} name="phone" type="tel" required maxLength={24}
                    placeholder="+234…" autoComplete="tel" />
                </label>
              ) : <p>Our team will call the number saved on this booking.</p>}
              {error && <p role="alert" className="text-red-700">{error}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <button className={travelButton} disabled={busy}>{busy ? "Sending…" : "Confirm callback request"}</button>
                <button type="button" className="font-semibold text-indigo-800" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </form>
          ) : <button type="button" className="mt-2 font-semibold text-indigo-800 underline" onClick={() => setOpen(true)}>Request a callback</button>}
        </>
      )}
    </section>
  );
}
