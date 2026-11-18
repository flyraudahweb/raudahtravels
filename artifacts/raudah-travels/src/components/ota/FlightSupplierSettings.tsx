import { useState } from "react";
import { Globe2, MapPin, Plug } from "lucide-react";
import { ota, travelInput } from "@/lib/ota";

type SupplierSettings = {
  mode: "test" | "live";
  primaryFlightsEnabled: boolean;
  bilalFlightsEnabled: boolean;
  bilalMode: "inherit" | "test" | "live";
  bilalSalesEnabled: boolean;
  bilalAirports: string[];
  bilalTestToken: string;
  bilalLiveToken: string;
  bilalTestTokenSet: boolean;
  bilalLiveTokenSet: boolean;
};

export default function FlightSupplierSettings({
  settings,
  update,
}: {
  settings: SupplierSettings;
  update: (patch: Partial<SupplierSettings>) => void;
}) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{
    mode: SupplierSettings["mode"];
    message: string;
  }>();
  const mode =
    settings.bilalMode === "inherit" ? settings.mode : settings.bilalMode;
  const sandbox = mode === "test";
  const hasSavedKey = sandbox
    ? settings.bilalTestTokenSet
    : settings.bilalLiveTokenSet;
  async function check() {
    setChecking(true);
    setResult(undefined);
    try {
      await ota("/admin/suppliers/bilalsadasub/check", { mode });
      setResult({
        mode,
        message: "The saved key was accepted for airport lookup.",
      });
    } catch (error) {
      setResult({
        mode,
        message:
          error instanceof Error ? error.message : "Connection check failed.",
      });
    } finally {
      setChecking(false);
    }
  }
  return (
    <section
      id="ota-flight-suppliers"
      className="scroll-mt-24 space-y-4 rounded-2xl border bg-white p-5 sm:p-6"
    >
      <h2 className="text-lg font-bold text-[#1C1F66]">Flight suppliers</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="space-y-4 rounded-xl border border-slate-200 p-4">
          <div className="flex items-start gap-3">
            <Globe2
              className="mt-0.5 size-5 shrink-0 text-[#2D3199]"
              aria-hidden="true"
            />
            <div>
              <h3 className="font-semibold">Api Provider</h3>
              <p className="mt-1 text-sm text-slate-600">
                Flight search and online checkout. Manage keys and webhooks
                below.
              </p>
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="mt-0.5 accent-primary"
              checked={settings.primaryFlightsEnabled}
              onChange={(event) =>
                update({ primaryFlightsEnabled: event.target.checked })
              }
            />
            Enable flights from Api Provider
          </label>
          <p className="text-xs text-slate-600">
            Saved bookings stay available for servicing when new flight sales
            are paused.
          </p>
        </article>
        <article className="space-y-4 rounded-xl border border-indigo-100 bg-[#F7F8FF] p-4">
          <div className="flex items-start gap-3">
            <MapPin
              className="mt-0.5 size-5 shrink-0 text-[#2D3199]"
              aria-hidden="true"
            />
            <div>
              <h3 className="font-semibold">Bilalsadasub</h3>
              <p className="mt-1 text-xs font-semibold text-indigo-800">
                Fare search and enquiries
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Estimated fares for one-way flights within Nigeria. Travellers
                can contact Raudah to confirm a fare.
              </p>
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="mt-0.5 accent-primary"
              checked={settings.bilalFlightsEnabled}
              onChange={(event) =>
                update({ bilalFlightsEnabled: event.target.checked })
              }
            />
            Use domestic fares when configured
          </label>
          <label className="block text-sm font-medium">
            Bilalsadasub mode
            <select
              className={`${travelInput} mt-1`}
              value={settings.bilalMode}
              onChange={(event) =>
                update({
                  bilalMode: event.target
                    .value as SupplierSettings["bilalMode"],
                })
              }
            >
              <option value="inherit">Follow main OTA mode</option>
              <option value="test">Sandbox</option>
              <option value="live">Live</option>
            </select>
          </label>
          <label className="flex items-start gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="mt-0.5 accent-primary"
              checked={settings.bilalSalesEnabled}
              onChange={(event) =>
                update({ bilalSalesEnabled: event.target.checked })
              }
            />
            Enable Bilalsadasub online sales
          </label>
          {settings.bilalFlightsEnabled && !hasSavedKey && (
            <p className="text-xs text-slate-600">
              Save a {sandbox ? "sandbox" : "live"} key to activate domestic
              fare search in this mode.
            </p>
          )}
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Online checkout is available for eligible one-way nonstop fares when
            enabled. Paystack must use a matching environment.
          </p>
          <label className="block text-sm font-medium">
            Domestic airport codes
            <input
              className={`${travelInput} mt-1`}
              defaultValue={settings.bilalAirports.join(", ")}
              onChange={(event) =>
                update({
                  bilalAirports: event.target.value
                    .toUpperCase()
                    .split(/[\s,]+/)
                    .filter(Boolean),
                })
              }
            />
            <span className="mt-1 block text-xs font-normal text-slate-600">
              Enter at least two IATA codes separated by commas.
            </span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["bilalTestToken", "Sandbox"],
                ["bilalLiveToken", "Live"],
              ] as const
            ).map(([key, label]) => (
              <label className="block text-sm font-medium" key={key}>
                {label} API key
                <input
                  className={`${travelInput} mt-1`}
                  type="password"
                  autoComplete="new-password"
                  value={settings[key]}
                  placeholder={
                    settings[`${key}Set`] ? "Key saved" : "Enter key"
                  }
                  onChange={(event) => update({ [key]: event.target.value })}
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={!hasSavedKey || checking}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 text-sm font-semibold text-[#2D3199] hover:border-indigo-400 disabled:opacity-50"
            onClick={() => void check()}
          >
            <Plug size={16} aria-hidden="true" />{" "}
            {checking
              ? "Checking…"
              : `Check saved ${sandbox ? "sandbox" : "live"} key`}
          </button>
          {result?.mode === mode && (
            <p role="status" className="text-sm text-slate-700">
              {result.message}
            </p>
          )}
        </article>
      </div>
    </section>
  );
}
