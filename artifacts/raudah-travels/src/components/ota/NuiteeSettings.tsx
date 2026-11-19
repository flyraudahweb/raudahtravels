import { useState } from "react";
import { Building2 } from "lucide-react";
import { ota, travelButton, travelInput } from "@/lib/ota";

export default function NuiteeSettings({
  settings,
  update,
}: {
  settings: any;
  update: (patch: Record<string, string | number | boolean>) => void;
}) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState("");
  const mode = settings.nuiteeMode;
  const keyName = mode === "live" ? "nuiteeLiveToken" : "nuiteeTestToken";
  async function verify() {
    setChecking(true);
    setResult("");
    try {
      await ota("/admin/suppliers/nuitee/check", { mode });
      setResult(
        `Connected to Nuitee ${mode === "live" ? "production" : "sandbox"} hotel search.`,
      );
    } catch (error) {
      setResult(
        error instanceof Error ? error.message : "Connection check failed.",
      );
    } finally {
      setChecking(false);
    }
  }
  return (
    <section
      id="ota-nuitee"
      className="scroll-mt-24 space-y-5 rounded-2xl border bg-white p-6"
    >
      <div className="flex items-start gap-3">
        <Building2 className="mt-1 text-indigo-700" size={21} />
        <div>
          <h2 className="text-lg font-bold">Nuitee hotel supplier</h2>
          <p className="mt-1 text-sm text-slate-600">
            Use Nuitee hotels on the website. Paystack collects from the guest
            and Nuitee books against the card on your Connect account.
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Hotel environment
          <select
            className={`${travelInput} mt-1`}
            value={mode}
            onChange={(e) => {
              update({ nuiteeMode: e.target.value, nuiteeSalesEnabled: false });
              setResult("");
            }}
          >
            <option value="test">Sandbox</option>
            <option value="live">Production</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Nuitee hotel markup (%)
          <input
            type="number"
            min={0}
            max={50}
            step="0.01"
            className={`${travelInput} mt-1`}
            value={settings.nuiteeMarkupPercent}
            onChange={(e) =>
              update({ nuiteeMarkupPercent: Number(e.target.value) })
            }
          />
        </label>
        {(["Test", "Live"] as const).map((environment) => {
          const field = `nuitee${environment}Token`;
          return (
            <label key={field} className="text-sm font-semibold">
              {environment === "Test" ? "Sandbox" : "Production"} API key
              <input
                type="password"
                autoComplete="new-password"
                className={`${travelInput} mt-1`}
                value={settings[field]}
                placeholder={
                  settings[`${field}Set`]
                    ? "Saved · enter a value to replace"
                    : "From Connect → API Keys"
                }
                onChange={(e) => {
                  update({ [field]: e.target.value });
                  setResult("");
                }}
              />
            </label>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-5 text-sm font-semibold">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.nuiteeHotelsEnabled}
            onChange={(e) =>
              update(
                e.target.checked
                  ? { nuiteeHotelsEnabled: true }
                  : { nuiteeHotelsEnabled: false, nuiteeSalesEnabled: false },
              )
            }
          />
          Use Nuitee for website hotel search
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            disabled={!settings.nuiteeHotelsEnabled}
            checked={settings.nuiteeSalesEnabled}
            onChange={(e) => update({ nuiteeSalesEnabled: e.target.checked })}
          />
          Accept Nuitee hotel payments
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={travelButton}
          onClick={verify}
          disabled={
            checking || !settings[`${keyName}Set`] || !!settings[keyName]
          }
        >
          {checking ? "Checking…" : "Test saved connection"}
        </button>
        <p className="text-sm text-slate-600" role="status">
          {result}
        </p>
      </div>
    </section>
  );
}
