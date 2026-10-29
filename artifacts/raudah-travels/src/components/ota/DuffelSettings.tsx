import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ota, travelInput, travelButton } from "@/lib/ota";

export default function DuffelSettings({
  settings,
  setSettings,
  urls,
  events,
}: {
  settings: any;
  setSettings: (value: any) => void;
  urls?: Record<string, string>;
  events: string[];
}) {
  const qc = useQueryClient(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const mode = settings.mode as "test" | "live";
  const status = useQuery({
    queryKey: ["ota", "duffel-webhook", mode],
    queryFn: () => ota(`/admin/duffel/webhook?mode=${mode}`),
    enabled: false,
    retry: false,
  });
  const deliveries = useQuery({
    queryKey: ["ota", "duffel-events"],
    queryFn: () => ota("/admin/duffel/events"),
    retry: false,
    refetchInterval: 30000,
  });
  async function manage(action: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await ota(`/admin/duffel/webhook/${action}`, { mode });
      setMessage(
        action === "register"
          ? "Webhook registered/reused. New endpoints remain inactive until deployment readiness is verified."
          : `Webhook ${action} request completed.`,
      );
      await qc.invalidateQueries({ queryKey: ["ota"] });
      await status.refetch();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const input = (key: string, label: string, password = false) => (
    <label key={key} className="block text-sm">
      {label}
      {password && (
        <span className="ml-2 text-xs text-slate-500">
          {settings[key]
            ? "will update on Save"
            : settings[`${key}Set`]
              ? "saved · blank retains value"
              : "not configured"}
        </span>
      )}
      <input
        type={password ? "password" : "text"}
        autoComplete={password ? "new-password" : "off"}
        value={settings[key] || ""}
        onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
        className={`${travelInput} mt-1`}
      />
    </label>
  );
  return (
    <section
      id="ota-duffel"
      className="scroll-mt-24 space-y-5 rounded-2xl border bg-white p-6"
    >
      <div>
        <h2 className="text-lg font-bold">Duffel keys and webhooks</h2>
        <p className="mt-2 text-sm text-slate-500">
          Test and live credentials are stored separately and encrypted. Save
          credentials and event selections before using webhook controls.
          Database and encryption master keys stay in hosting configuration.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {(["test", "live"] as const).map((value) => {
          const title = value === "test" ? "Test" : "Live";
          return (
            <div
              key={value}
              className="space-y-4 rounded-xl border border-slate-200 p-4"
            >
              <h3 className="font-bold">{title} configuration</h3>
              {input(`duffel${title}Token`, `${title} Duffel API token`, true)}
              {input(
                `webhook${title}Secret`,
                `${title} webhook signing secret`,
                true,
              )}
              {input(`webhook${title}Id`, `${title} webhook ID`)}
              <label className="block text-sm">
                Receiver URL
                <input
                  readOnly
                  value={urls?.[value] || "Set APP_URL on the server"}
                  className={`${travelInput} mt-1 text-xs`}
                  onFocus={(e) => e.target.select()}
                />
              </label>
            </div>
          );
        })}
      </div>
      <div>
        <h3 className="mb-3 text-sm font-bold">
          Events used by flight and hotel bookings
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {events.map((event) => (
            <label
              key={event}
              className="flex items-start gap-2 break-all text-xs"
            >
              <input
                type="checkbox"
                checked={(settings.webhookEvents || []).includes(event)}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    webhookEvents: e.target.checked
                      ? [...new Set([...(settings.webhookEvents || []), event])]
                      : (settings.webhookEvents || []).filter(
                          (v: string) => v !== event,
                        ),
                  })
                }
              />
              <span>{event}</span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Car, airline-credit and Duffel payment-link events are not used by
          this app. Paystack has a separate webhook.
        </p>
      </div>
      <div className="space-y-3 border-t pt-4">
        <h3 className="font-bold">Manage the {mode} webhook</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={travelButton}
            disabled={busy}
            onClick={() => manage("register")}
          >
            Create / reuse webhook
          </button>
          {["activate", "deactivate", "ping"].map((action) => (
            <button
              key={action}
              type="button"
              disabled={busy}
              onClick={() => manage(action)}
              className="rounded-xl border px-4 py-2 text-sm font-bold capitalize disabled:opacity-50"
            >
              {action}
            </button>
          ))}
          <button
            type="button"
            disabled={busy || status.isFetching}
            onClick={() => status.refetch()}
            className="rounded-xl border px-4 py-2 text-sm"
          >
            Refresh provider status
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Activation checks the deployed receiver, signing configuration and
          migrations 0010 and 0011. A ping tests delivery; view received events
          below. Creation alone does not activate a new webhook.
        </p>
        {status.data?.hooks?.map((hook: any) => (
          <p className="break-all text-xs" key={hook.id}>
            {hook.id} · {hook.active ? "Active" : "Inactive"} · {hook.url}
          </p>
        ))}
        {status.error && (
          <p role="alert" className="text-sm text-red-700">
            {status.error.message}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-sm text-emerald-700">
            {message}
          </p>
        )}
      </div>
      <div className="border-t pt-4">
        <h3 className="mb-3 font-bold">Recent received events</h3>
        {deliveries.error ? (
          <p className="text-sm text-amber-800">
            Event inbox unavailable. Apply OTA migrations and deploy the
            receiver.
          </p>
        ) : !deliveries.data?.events?.length ? (
          <p className="text-sm text-slate-500">
            No Duffel events received yet.
          </p>
        ) : (
          <div className="space-y-2">
            {deliveries.data.events.map((event: any) => (
              <div
                key={event.id}
                className="rounded-lg bg-slate-50 p-3 text-xs"
              >
                <p className="font-semibold">
                  {event.eventType} · {event.mode}
                </p>
                <p className="mt-1 text-slate-500">
                  {new Date(event.createdAt).toLocaleString()} ·{" "}
                  {event.completedAt
                    ? "Processed"
                    : event.attempts >= 10
                      ? "Needs operator review"
                      : "Queued / retrying"}{" "}
                  · attempts {event.attempts}
                </p>
                {event.issue && (
                  <p className="mt-1 text-amber-800">{event.issue}</p>
                )}
                {!event.completedAt && event.attempts >= 10 && (
                  <button
                    type="button"
                    disabled={busy}
                    className="mt-2 rounded-lg border bg-white px-3 py-2 font-bold"
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        await ota(
                          `/admin/duffel/events/${encodeURIComponent(event.id)}/retry`,
                          {},
                        );
                        await deliveries.refetch();
                        setMessage(
                          "Supplier event queued for another read-only reconciliation attempt.",
                        );
                      } catch (e: any) {
                        setError(e.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Retry event reconciliation
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
