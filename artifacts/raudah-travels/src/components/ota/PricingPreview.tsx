import { useEffect, useState, useRef } from "react";
import { Calculator, ArrowRight } from "lucide-react";
import { money, ota, travelButton, travelInput } from "@/lib/ota";

export default function PricingPreview({
  settings,
  ratesText,
}: {
  settings: any;
  ratesText: string;
}) {
  const [amount, setAmount] = useState("100"),
    [currency, setCurrency] = useState("USD"),
    [kind, setKind] = useState("flight");
  const [result, setResult] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const draft = JSON.stringify([
    ratesText,
    settings.flightMarkupPercent,
    settings.hotelMarkupPercent,
    settings.serviceFeeNgn,
    amount,
    currency,
    kind,
  ]);
  const currentDraft = useRef(draft);
  currentDraft.current = draft;
  useEffect(() => {
    setResult(null);
    setError("");
  }, [draft]);
  return (
    <section
      aria-label="Customer price preview"
      className="overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 to-white"
    >
      <div className="border-b border-indigo-100/70 p-5">
        <h3 className="flex items-center gap-2 font-bold text-indigo-950">
          <Calculator size={18} />
          Customer price preview
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Check how this draft converts a supplier total into the customer
          price. Save settings to publish your pricing rules.
        </p>
      </div>
      <div className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-slate-600">
            Product
            <select
              className={`${travelInput} mt-1`}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="flight">Flight ticket</option>
              <option value="hotel">Hotel stay</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Supplier currency
            <input
              aria-label="Preview supplier currency"
              className={`${travelInput} mt-1 uppercase`}
              value={currency}
              maxLength={3}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Supplier total, including taxes
            <input
              aria-label="Preview supplier total"
              type="text"
              inputMode="decimal"
              className={`${travelInput} mt-1`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className={travelButton}
          disabled={busy}
          onClick={async () => {
            const submittedDraft = draft;
            setBusy(true);
            setError("");
            setResult(null);
            try {
              const rates: Record<string, number> = {};
              for (const line of ratesText
                .split("\n")
                .filter((value) => value.trim())) {
                const [code, value] = line.split("=");
                if (
                  !/^[A-Z]{3}$/.test(code?.trim() || "") ||
                  !Number.isFinite(Number(value)) ||
                  Number(value) <= 0
                )
                  throw new Error(
                    "Check the currency rates above before calculating.",
                  );
                rates[code.trim()] = Number(value);
              }
              const data = await ota("/admin/price-preview", {
                kind,
                amount,
                currency,
                pricing: {
                  rates,
                  flightMarkupPercent: settings.flightMarkupPercent,
                  hotelMarkupPercent: settings.hotelMarkupPercent,
                  serviceFeeNgn: settings.serviceFeeNgn,
                },
              });
              if (currentDraft.current === submittedDraft)
                setResult(data.pricing);
            } catch (e: any) {
              if (currentDraft.current === submittedDraft) setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Calculating…" : "Calculate customer price"}
          <ArrowRight size={15} />
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        {result && (
          <dl
            className="grid gap-3 rounded-xl border border-indigo-100 bg-white p-4 sm:grid-cols-2"
            aria-live="polite"
          >
            {[
              ["Converted supplier cost", result.supplierKobo],
              ["Markup", result.markupKobo],
              ["Booking service fee", result.feeKobo],
              ["Customer pays", result.totalKobo],
            ].map(([label, value]) => (
              <div
                key={label}
                className={
                  label === "Customer pays"
                    ? "rounded-lg bg-indigo-950 p-3 text-white"
                    : "p-3"
                }
              >
                <dt className="text-xs opacity-70">{label}</dt>
                <dd className="mt-1 text-lg font-bold">{money(value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
