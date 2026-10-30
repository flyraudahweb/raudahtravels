import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useGetProfile } from "@workspace/api-client-react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileJson,
  Globe2,
  KeyRound,
  Loader2,
  LockKeyhole,
  Plane,
  Search,
  ShieldCheck,
  Smartphone,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { ota, travelButton, travelInput } from "@/lib/ota";

const methodStyle: Record<string, string> = {
  get: "bg-emerald-50 text-emerald-700 border-emerald-100",
  post: "bg-indigo-50 text-[#2D3199] border-indigo-100",
};
function CodeBlock({
  value,
  label = "Example",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#11132D]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-[11px] text-slate-400">
        <span>{label}</span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-slate-300 hover:bg-white/10"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}{" "}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-[520px] overflow-auto p-4 text-[11px] leading-6 text-indigo-100">
        <code>{value}</code>
      </pre>
    </div>
  );
}
function resolveSchema(schema: any, spec: any): any {
  return schema?.$ref
    ? spec.components.schemas[schema.$ref.split("/").at(-1)]
    : schema;
}
function example(schema: any, spec: any, depth = 0): any {
  const value = resolveSchema(schema, spec);
  if (!value || depth > 5) return {};
  if (value.example !== undefined) return value.example;
  if (value.enum) return value.enum[0];
  if (value.oneOf) return example(value.oneOf[0], spec, depth + 1);
  if (value.type === "array") return [example(value.items, spec, depth + 1)];
  if (value.type === "object")
    return Object.fromEntries(
      Object.entries(value.properties || {}).map(([key, field]) => [
        key,
        example(field, spec, depth + 1),
      ]),
    );
  if (value.type === "boolean") return false;
  if (value.type === "integer" || value.type === "number")
    return value.minimum ?? 0;
  if (value.format === "date") return "YYYY-MM-DD";
  if (value.format === "date-time") return "ISO-8601 timestamp";
  return "string";
}
function SchemaFields({ schema, spec }: { schema: any; spec: any }) {
  const resolved = resolveSchema(schema, spec),
    properties = resolved?.properties;
  if (!properties)
    return (
      <CodeBlock label="JSON schema" value={JSON.stringify(schema, null, 2)} />
    );
  return (
    <div className="divide-y rounded-xl border border-slate-200 bg-white">
      {Object.entries(properties).map(([name, raw]: [string, any]) => {
        const field = resolveSchema(raw, spec);
        const nested = raw.$ref?.split("/").at(-1);
        return (
          <div key={name} className="px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-xs font-bold text-[#2D3199]">{name}</code>
              <span className="text-[10px] text-slate-400">
                {nested || field?.type || "object"}
                {field?.type === "array"
                  ? `<${field.items?.$ref?.split("/").at(-1) || field.items?.type || "object"}>`
                  : ""}
              </span>
              {resolved.required?.includes(name) && (
                <span className="text-[9px] font-bold uppercase text-[#E34317]">
                  Required
                </span>
              )}
              {field?.nullable && (
                <span className="text-[9px] text-slate-400">nullable</span>
              )}
            </div>
            {field?.description && (
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {field.description}
              </p>
            )}
            {field?.enum && (
              <p className="mt-1 break-words font-mono text-[10px] text-slate-500">
                {field.enum.map(String).join(" · ")}
              </p>
            )}
            {(field?.minimum !== undefined ||
              field?.minLength !== undefined ||
              field?.maxItems !== undefined) && (
              <p className="mt-1 text-[10px] text-slate-400">
                {field.minimum !== undefined ? `Minimum ${field.minimum}` : ""}
                {field.maximum !== undefined
                  ? ` · Maximum ${field.maximum}`
                  : ""}
                {field.minLength !== undefined
                  ? `Minimum length ${field.minLength}`
                  : ""}
                {field.maxLength !== undefined
                  ? ` · Maximum length ${field.maxLength}`
                  : ""}
                {field.maxItems !== undefined
                  ? `Maximum items ${field.maxItems}`
                  : ""}
              </p>
            )}
            {(field?.properties ||
              field?.items?.$ref ||
              field?.items?.oneOf) && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[10px] font-semibold text-[#2D3199]">
                  View nested schema
                </summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-slate-50 p-3 text-[10px] leading-5 text-slate-600">
                  {JSON.stringify(field, null, 2)}
                </pre>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AdminOtaApi() {
  const { data: profile } = useGetProfile(),
    allowed = profile?.role === "super_admin";
  const qc = useQueryClient();
  const contract = useQuery({
    queryKey: ["ota", "developer", "openapi"],
    queryFn: () => ota("/admin/developer/openapi"),
    enabled: allowed,
    retry: false,
  });
  const keyQuery = useQuery({
    queryKey: ["ota", "developer", "keys"],
    queryFn: () => ota("/admin/developer/keys"),
    enabled: allowed,
    retry: false,
  });
  const settings = useQuery({
    queryKey: ["ota", "admin-settings"],
    queryFn: () => ota("/admin/settings"),
    enabled: allowed,
    retry: false,
  });
  const [tab, setTab] = useState("overview"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState("post:/flights/search"),
    [language, setLanguage] = useState("curl"),
    [guideId, setGuideId] = useState("app-blueprint"),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [newSecret, setNewSecret] = useState(""),
    [newKeyId, setNewKeyId] = useState(""),
    [showSecret, setShowSecret] = useState(false),
    [keyName, setKeyName] = useState(""),
    [keyMode, setKeyMode] = useState("test"),
    [expiry, setExpiry] = useState(90),
    [rate, setRate] = useState(30),
    [scopes, setScopes] = useState(["config:read", "flights:read"]);
  const spec = contract.data;
  useEffect(() => {
    setNewSecret("");
    setNewKeyId("");
    setShowSecret(false);
  }, [profile?.id, allowed]);
  async function copyToClipboard(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setError("Clipboard access failed. Select and copy the text manually.");
    }
  }
  const operations = useMemo(
    () =>
      spec
        ? Object.entries(spec.paths).flatMap(([path, methods]: [string, any]) =>
            Object.entries(methods).map(
              ([method, operation]: [string, any]) => ({
                path,
                method,
                ...operation,
                id: `${method}:${path}`,
              }),
            ),
          )
        : [],
    [spec],
  );
  const filtered = operations.filter((item) =>
    `${item.path} ${item.summary} ${item.tags.join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const active =
    filtered.find((item) => item.id === selected) || filtered[0];
  const guide =
    spec?.["x-guides"].find((item: any) => item.id === guideId) ||
    spec?.["x-guides"][0];
  const base = spec?.servers[0].url || "https://flyraudah.com.ng/api/ota/v1";
  const nativeSample = `import { useAuth } from '@clerk/expo';\n\nconst API = '${base}';\n\n// Inside your signed-in component/custom hook:\nconst { getToken } = useAuth();\n\nasync function otaRequest(path, body) {\n  const token = await getToken();\n  if (!token) throw new Error('Sign in first');\n  const response = await fetch(API + path, {\n    method: body === undefined ? 'GET' : 'POST',\n    headers: {\n      Authorization: 'Bearer ' + token,\n      ...(body === undefined ? {} : {'Content-Type': 'application/json'}),\n    },\n    ...(body === undefined ? {} : {body: JSON.stringify(body)}),\n  });\n  const data = await response.json();\n  if (!response.ok) throw new Error(data.error || 'Request failed');\n  return data;\n}\n\nawait otaRequest('/me/bootstrap', {});\nconst { bookings } = await otaRequest('/bookings');`;
  async function download(format: "json" | "md") {
    setError("");
    try {
      const response = await fetch(
        `/api/ota/admin/developer/${format === "json" ? "openapi" : "guide"}`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Documentation download failed");
      const text =
        format === "json"
          ? JSON.stringify(await response.json(), null, 2)
          : await response.text();
      const url = URL.createObjectURL(
        new Blob([text], {
          type: format === "json" ? "application/json" : "text/markdown",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download =
        format === "json"
          ? "raudah-ota-v1.openapi.json"
          : "raudah-ota-mobile-guide.md";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function createKey(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNewSecret("");
    try {
      const result = await ota("/admin/developer/keys", {
        name: keyName,
        mode: keyMode,
        scopes,
        expiresInDays: expiry,
        requestsPerMinute: rate,
      });
      setNewSecret(result.secret);
      setNewKeyId(result.key.id);
      setShowSecret(false);
      setKeyName("");
      setMessage(
        "Integration key created. Copy it now; it cannot be retrieved again.",
      );
      await qc.invalidateQueries({ queryKey: ["ota", "developer", "keys"] });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function revoke(key: any) {
    if (
      !window.confirm(
        `Revoke “${key.name}”? Services using this key will stop authenticating.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await ota(`/admin/developer/keys/${key.id}/revoke`, {});
      if (key.id === newKeyId) setNewSecret("");
      setMessage("Integration key revoked.");
      await qc.invalidateQueries({ queryKey: ["ota", "developer", "keys"] });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!profile)
    return (
      <p className="p-8 text-sm text-slate-500">Loading developer access…</p>
    );
  if (!allowed)
    return (
      <div className="rounded-2xl border bg-white p-8">
        <LockKeyhole className="mb-4 text-[#2D3199]" />
        <h1 className="text-xl font-bold">Super-admin access required</h1>
        <p className="mt-2 text-sm text-slate-500">
          OTA documentation and integration keys are managed by a super admin.
        </p>
      </div>
    );
  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-[#1C1F66] p-6 text-white md:p-8">
        <div className="pointer-events-none absolute -right-10 -top-16 h-72 w-72 rounded-full border-[35px] border-white/5" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.22em] text-indigo-200">
              <Code2 size={15} />
              Raudah Developer Centre
            </p>
            <h1 className="max-w-xl text-2xl font-bold tracking-tight !text-white md:text-3xl">
              One travel platform.
              <br />
              <span className="text-[#FF865E]">Every screen.</span>
            </h1>
            <p className="mt-3 max-w-xl text-xs leading-6 text-indigo-200">
              The OTA integration guide for your mobile app and trusted
              services. Real contracts, clear booking flows and controlled
              access.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[10px]">
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                REST · JSON · HTTPS
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                v{spec?.info.version || "1.0.0"}
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                {operations.length} customer operations
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 capitalize">
                {settings.data?.settings?.mode || "Loading"} mode
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => download("json")}
              className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-[#2D3199]"
            >
              <FileJson size={15} />
              OpenAPI JSON
            </button>
            <button
              onClick={() => download("md")}
              className="flex items-center gap-2 rounded-xl border border-white/25 px-4 py-2.5 text-xs font-bold"
            >
              <Download size={15} />
              Guide
            </button>
          </div>
        </div>
        <div className="relative mt-6 flex items-center gap-3 rounded-xl border border-white/10 bg-black/15 px-4 py-3">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF865E]" />
          <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-[11px] text-indigo-100">
            {base}
          </code>
          <button
            aria-label="Copy API base URL"
            onClick={() => copyToClipboard(base)}
            className="text-indigo-200"
          >
            <Copy size={14} />
          </button>
        </div>
      </header>
      <nav
        className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5"
        aria-label="Developer centre sections"
      >
        {[
          ["overview", "Start here", BookOpen],
          ["reference", "API reference", Terminal],
          ["guides", "Mobile guide", Smartphone],
          ["keys", "API keys", KeyRound],
        ].map(([id, label, Icon]: any) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-3 text-xs font-bold ${tab === id ? "bg-[#2D3199] text-white" : "text-slate-500 hover:bg-indigo-50"}`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>
      {(error || contract.error || keyQuery.error) && (
        <p
          role="alert"
          className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"
        >
          {error || contract.error?.message || keyQuery.error?.message}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {message}
        </p>
      )}
      {contract.isLoading && (
        <div className="flex items-center gap-3 rounded-2xl bg-white p-10 text-sm text-slate-500">
          <Loader2 size={20} className="animate-spin" />
          Loading API contract…
        </div>
      )}
      {spec && tab === "overview" && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <Smartphone className="text-[#2D3199]" />
              <h2 className="mt-4 text-base font-bold">For the mobile app</h2>
              <p className="mt-2 text-xs leading-6 text-slate-500">
                Use your customer’s Clerk session. Public search is available
                without an embedded API secret; booking actions always verify
                the signed-in owner.
              </p>
              <button
                onClick={() => {
                  setGuideId("authentication");
                  setTab("guides");
                }}
                className="mt-4 flex items-center gap-2 text-xs font-bold text-[#2D3199]"
              >
                Set up customer authentication
                <ArrowRight size={14} />
              </button>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <ShieldCheck className="text-[#FF3B00]" />
              <h2 className="mt-4 text-base font-bold">
                For a trusted backend
              </h2>
              <p className="mt-2 text-xs leading-6 text-slate-500">
                Create scoped, expiring search keys for your server. Keys are
                shown once, stored as hashes and can be revoked here. They
                cannot book on behalf of customers.
              </p>
              <button
                onClick={() => setTab("keys")}
                className="mt-4 flex items-center gap-2 text-xs font-bold text-[#2D3199]"
              >
                Manage integration keys
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-bold">Your app’s booking journey</h2>
              <span className="text-[10px] font-semibold text-[#2D3199]">
                Shared web + mobile backend
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                [
                  "01",
                  "Search & compare",
                  "Discover enabled products, airports, flight offers and prepaid stays.",
                ],
                [
                  "02",
                  "Review & save",
                  "Revalidate the final price, collect travellers and save a checkout.",
                ],
                [
                  "03",
                  "Pay & verify",
                  "Open hosted payment; trust the server’s booking state on return.",
                ],
                [
                  "04",
                  "Manage the trip",
                  "Recover history, itinerary changes, documents and support requests.",
                ],
              ].map(([n, title, body]) => (
                <div key={n} className="rounded-xl bg-slate-50 p-4">
                  <span className="text-[10px] font-bold text-[#FF3B00]">
                    {n}
                  </span>
                  <h3 className="mt-2 text-xs font-bold">{title}</h3>
                  <p className="mt-2 text-[11px] leading-5 text-slate-500">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </section>
          <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
            <section className="rounded-2xl border bg-white p-6">
              <h2 className="font-bold">What you can build today</h2>
              <div className="mt-4 space-y-3">
                {[
                  "Flight discovery, fares and traveller checkout",
                  "Prepaid hotel search, room rates and quotes",
                  "Hosted payments with saved-booking recovery",
                  "My Trips, timelines and travel notification inbox",
                  "Support requests for changes and refund review",
                ].map((text) => (
                  <p
                    key={text}
                    className="flex items-start gap-2 text-xs leading-5 text-slate-600"
                  >
                    <CheckCircle2
                      size={14}
                      className="mt-0.5 shrink-0 text-[#2D3199]"
                    />
                    {text}
                  </p>
                ))}
              </div>
              <p className="mt-5 rounded-xl bg-amber-50 p-3 text-[11px] leading-5 text-amber-800">
                Product switches, provider access and payment modes still apply.
                Self-service exchanges, native push and multi-city are not
                implemented.
              </p>
              <button
                onClick={() => {
                  setTab("guides");
                  setGuideId("scope");
                }}
                className="mt-4 text-xs font-bold text-[#2D3199]"
              >
                Read supported scope & launch checks →
              </button>
            </section>
            <CodeBlock
              label="Expo / React Native · customer session"
              value={nativeSample}
            />
          </div>
        </>
      )}
      {spec && tab === "guides" && (
        <div className="grid items-start gap-5 lg:grid-cols-[220px_1fr]">
          <aside className="rounded-2xl border bg-white p-3">
            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Integration handbook
            </p>
            {spec["x-guides"].map((item: any) => (
              <button
                key={item.id}
                onClick={() => setGuideId(item.id)}
                className={`block w-full rounded-xl px-3 py-2.5 text-left text-xs ${guideId === item.id ? "bg-indigo-50 font-bold text-[#2D3199]" : "text-slate-500 hover:bg-slate-50"}`}
              >
                {item.title}
              </button>
            ))}
          </aside>
          <article className="rounded-2xl border bg-white p-6 md:p-8">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#FF3B00]">
              Mobile integration
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">
              {guide.title}
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              {guide.body}
            </p>
            <ol className="mt-7 space-y-4">
              {guide.steps.map((step: string, index: number) => (
                <li
                  key={step}
                  className="flex gap-3 rounded-xl border border-slate-100 p-4"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-[#2D3199]">
                    {index + 1}
                  </span>
                  <p className="text-xs leading-6 text-slate-600">{step}</p>
                </li>
              ))}
            </ol>
            {guide.id === "authentication" && (
              <div className="mt-6">
                <CodeBlock
                  label="Customer session request helper"
                  value={nativeSample}
                />
              </div>
            )}
            {guide.links && (
              <div className="mt-6 flex flex-wrap gap-4 border-t pt-5">
                {guide.links.map((link: any) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs font-semibold text-[#2D3199]"
                  >
                    {link.label}
                    <ExternalLink size={12} />
                  </a>
                ))}
              </div>
            )}
          </article>
        </div>
      )}
      {spec && tab === "reference" && (
        <div className="grid items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-2xl border bg-white">
            <div className="flex items-center gap-2 border-b p-3">
              <Search size={15} className="text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find an endpoint"
                aria-label="Search OTA endpoints"
                className="min-w-0 w-full py-1 text-xs outline-none"
              />
            </div>
            <div className="max-h-[75dvh] overflow-y-auto p-2">
              {spec.tags.map((tag: any) => {
                const items = filtered.filter((item) =>
                  item.tags.includes(tag.name),
                );
                return (
                  items.length > 0 && (
                    <div key={tag.name} className="mb-3">
                      <p className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                        {tag.name}
                      </p>
                      {items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setSelected(item.id)}
                          className={`block w-full rounded-xl p-3 text-left ${active?.id === item.id ? "bg-indigo-50" : "hover:bg-slate-50"}`}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={`rounded border px-1.5 py-0.5 text-[8px] font-black uppercase ${methodStyle[item.method]}`}
                            >
                              {item.method}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-700">
                              {item.summary}
                            </span>
                          </span>
                          <code className="mt-1.5 block truncate text-[9px] text-slate-400">
                            {item.path}
                          </code>
                        </button>
                      ))}
                    </div>
                  )
                );
              })}
              {!filtered.length && (
                <p className="p-4 text-xs text-slate-500">
                  No endpoints match your search.
                </p>
              )}
            </div>
          </aside>
          {active && (
            <section className="min-w-0 space-y-5">
              <div className="rounded-2xl border bg-white p-6">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-lg border px-2 py-1 text-[10px] font-black uppercase ${methodStyle[active.method]}`}
                  >
                    {active.method}
                  </span>
                  <code className="break-all text-xs font-bold text-slate-700">
                    {active.path}
                  </code>
                </div>
                <h2 className="mt-4 text-xl font-bold">{active.summary}</h2>
                <p className="mt-3 text-xs leading-6 text-slate-500">
                  {active.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-[10px]">
                  <span className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5">
                    <LockKeyhole size={11} />
                    {active.security.some(
                      (security: any) => security.CustomerSession,
                    )
                      ? "Customer session required"
                      : "Public search / optional server key"}
                  </span>
                  {active["x-key-scope"] && (
                    <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-[#2D3199]">
                      {active["x-key-scope"]}
                    </span>
                  )}
                </div>
                <p className="mt-4 rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-500">
                  <strong>Retry behaviour: </strong>
                  {active["x-idempotency"]}
                </p>
              </div>
              {active.parameters.length > 0 && (
                <section>
                  <h3 className="mb-3 text-sm font-bold">
                    Path & query parameters
                  </h3>
                  <div className="divide-y rounded-xl border bg-white">
                    {active.parameters.map((parameter: any) => (
                      <div key={parameter.name} className="px-4 py-3">
                        <code className="text-xs font-bold text-[#2D3199]">
                          {parameter.name}
                        </code>
                        <span className="ml-2 text-[10px] text-slate-400">
                          {parameter.in} · {parameter.schema.type}
                          {parameter.required ? " · required" : ""}
                        </span>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {parameter.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {active.requestBody && (
                <section>
                  <h3 className="mb-3 text-sm font-bold">Request body</h3>
                  <SchemaFields
                    spec={spec}
                    schema={
                      active.requestBody.content["application/json"].schema
                    }
                  />
                </section>
              )}
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold">Request example</h3>
                  <div className="flex rounded-lg border bg-white p-1">
                    {["curl", "javascript", "dart"].map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setLanguage(lang)}
                        className={`rounded-md px-2 py-1 text-[10px] font-semibold ${lang === language ? "bg-indigo-50 text-[#2D3199]" : "text-slate-400"}`}
                      >
                        {lang === "curl"
                          ? "cURL"
                          : lang === "dart"
                            ? "Dart"
                            : "JavaScript"}
                      </button>
                    ))}
                  </div>
                </div>
                <CodeBlock
                  label="Illustrative data · replace IDs and current prices"
                  value={requestExample(active, spec, base, language)}
                />
              </section>
              <section>
                <h3 className="mb-3 text-sm font-bold">Success response</h3>
                {Object.entries(active.responses)
                  .filter(([status]) => Number(status) < 300)
                  .map(([status, response]: [string, any]) => (
                    <div key={status} className="space-y-3">
                      <p className="text-[11px] font-semibold text-emerald-700">
                        HTTP {status}
                      </p>
                      <CodeBlock
                        label="JSON response example / shape"
                        value={JSON.stringify(
                          response.content?.["application/json"]?.example ||
                            example(
                              response.content?.["application/json"]?.schema,
                              spec,
                            ),
                          null,
                          2,
                        )}
                      />
                      <details className="rounded-xl border bg-white p-4">
                        <summary className="cursor-pointer text-xs font-bold text-slate-600">
                          Complete response schema
                        </summary>
                        <div className="mt-4">
                          <SchemaFields
                            spec={spec}
                            schema={
                              response.content?.["application/json"]?.schema
                            }
                          />
                        </div>
                      </details>
                    </div>
                  ))}
              </section>
              <details className="rounded-xl border bg-white p-4">
                <summary className="cursor-pointer text-xs font-bold text-slate-600">
                  Error responses & recovery
                </summary>
                <div className="mt-4 divide-y">
                  {Object.entries(active.responses)
                    .filter(([status]) => Number(status) >= 400)
                    .map(([status, response]: [string, any]) => (
                      <div key={status} className="flex gap-3 py-3">
                        <code className="text-xs font-bold text-[#E34317]">
                          {status}
                        </code>
                        <p className="text-xs leading-5 text-slate-500">
                          {response.description}
                        </p>
                      </div>
                    ))}
                </div>
              </details>
            </section>
          )}
        </div>
      )}
      {tab === "keys" && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D3199]">
              <ShieldCheck size={17} />
              Trusted-server keys only
            </h2>
            <p className="mt-2 text-xs leading-6 text-indigo-900/70">
              These keys identify public search integrations. Mobile customers
              use session tokens. A key cannot read a traveller’s bookings or
              create purchases, and must not be embedded in an app.
            </p>
          </div>
          {keyQuery.data && !keyQuery.data.storageReady && (
            <p
              role="status"
              className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900"
            >
              Key storage is not ready. Apply <code>0012_ota_api_keys.sql</code>{" "}
              to the intended database before creating keys. Documentation and
              customer session APIs remain available.
            </p>
          )}
          {newSecret && (
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-emerald-900">
                  Copy this key once
                </h3>
                <button
                  aria-label="Dismiss new API key"
                  onClick={() => setNewSecret("")}
                >
                  <X size={17} />
                </button>
              </div>
              <p className="my-3 text-xs leading-5 text-emerald-800">
                Store it in your backend secret manager. This value is not
                stored and cannot be retrieved after closing.
              </p>
              <div className="flex gap-2">
                <input
                  aria-label="New integration key"
                  readOnly
                  type={showSecret ? "text" : "password"}
                  value={newSecret}
                  className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 font-mono text-xs"
                />
                <button
                  onClick={() => setShowSecret((value) => !value)}
                  className="rounded-lg border bg-white px-3 text-xs font-semibold"
                >
                  {showSecret ? "Hide" : "Show"}
                </button>
                <button
                  onClick={() => copyToClipboard(newSecret)}
                  className="rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
          <div className="grid items-start gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <form
              onSubmit={createKey}
              className="space-y-4 rounded-2xl border bg-white p-6"
            >
              <h2 className="font-bold">Create search key</h2>
              <label className="block text-xs font-semibold">
                Integration name
                <input
                  required
                  minLength={3}
                  maxLength={80}
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g. Staging search backend"
                  className={`${travelInput} mt-2`}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold">
                  Mode
                  <select
                    value={keyMode}
                    onChange={(e) => setKeyMode(e.target.value)}
                    className={`${travelInput} mt-2`}
                  >
                    <option value="test">Test</option>
                    <option value="live">Live</option>
                  </select>
                </label>
                <label className="text-xs font-semibold">
                  Expires in days
                  <input
                    type="number"
                    min={1}
                    max={365}
                    required
                    value={expiry}
                    onChange={(e) => setExpiry(Number(e.target.value))}
                    className={`${travelInput} mt-2`}
                  />
                </label>
              </div>
              <label className="block text-xs font-semibold">
                Requests per minute
                <input
                  type="number"
                  min={10}
                  max={60}
                  required
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                  className={`${travelInput} mt-2`}
                />
              </label>
              <fieldset className="space-y-3 rounded-xl border p-4">
                <legend className="px-1 text-[11px] font-bold text-slate-500">
                  Allowed scopes
                </legend>
                {["config:read", "flights:read", "hotels:read"].map((scope) => (
                  <label
                    key={scope}
                    className="flex items-center gap-2 text-xs text-slate-600"
                  >
                    <input
                      type="checkbox"
                      checked={scopes.includes(scope)}
                      onChange={(e) =>
                        setScopes((previous) =>
                          e.target.checked
                            ? [...previous, scope]
                            : previous.filter((value) => value !== scope),
                        )
                      }
                      className="accent-[#2D3199]"
                    />
                    {scope}
                  </label>
                ))}
              </fieldset>
              <button
                disabled={
                  busy ||
                  !keyQuery.data?.storageReady ||
                  !scopes.length ||
                  Boolean(newSecret)
                }
                className={`${travelButton} w-full`}
              >
                {busy ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <KeyRound size={15} />
                )}
                Create key
              </button>
              <p className="text-[10px] leading-5 text-slate-400">
                Mode must match active OTA settings when used. Existing
                account/IP and edge limits also apply.
              </p>
            </form>
            <section className="overflow-hidden rounded-2xl border bg-white">
              <div className="border-b p-5">
                <h2 className="font-bold">Active & historical keys</h2>
                <p className="mt-1 text-[11px] text-slate-400">
                  Latest 100 keys · prefixes only · raw secrets are never listed
                </p>
              </div>
              {keyQuery.isLoading ? (
                <p className="p-6 text-xs text-slate-500">
                  Loading integration keys…
                </p>
              ) : !keyQuery.data?.keys?.length ? (
                <div className="p-10 text-center">
                  <KeyRound className="mx-auto text-indigo-200" size={30} />
                  <p className="mt-3 text-sm font-semibold text-slate-600">
                    No integration keys yet
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    First-party mobile sign-in works without a server search
                    key.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {keyQuery.data.keys.map((key: any) => {
                    const state = key.revokedAt
                      ? "Revoked"
                      : Date.parse(key.expiresAt) <= Date.now()
                        ? "Expired"
                        : "Active";
                    return (
                      <div key={key.id} className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-bold">{key.name}</h3>
                            <p className="mt-1 break-all font-mono text-[10px] text-slate-400">
                              {key.prefix}…
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2 py-1 text-[9px] font-bold ${state === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                          >
                            {state}
                          </span>
                        </div>
                        <p className="mt-3 text-[10px] text-slate-500">
                          {key.mode} · {key.requestsPerMinute}/min · expires{" "}
                          {new Date(key.expiresAt).toLocaleDateString()}
                        </p>
                        <p className="mt-2 text-[10px] text-slate-400">
                          {key.scopes.join(" · ")}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-400">
                            Last used:{" "}
                            {key.lastUsedAt
                              ? new Date(key.lastUsedAt).toLocaleString()
                              : "Never"}
                          </span>
                          {state === "Active" && (
                            <button
                              disabled={busy}
                              onClick={() => revoke(key)}
                              className="flex items-center gap-1 text-[11px] font-bold text-red-600 disabled:opacity-50"
                            >
                              <Trash2 size={12} />
                              Revoke
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
          <CodeBlock
            label="Trusted backend search request — never embed this secret in a mobile app"
            value={`curl '${base}/places?q=Lagos' \\\n  -H "X-OTA-API-Key: $RAUDAH_SEARCH_KEY"`}
          />
        </div>
      )}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-[10px] text-slate-400">
        <span>
          OTA-only contract · user sessions protect bookings · provider
          credentials remain server-side
        </span>
        <Link href="/admin/ota" className="font-semibold text-[#2D3199]">
          Back to OTA operations →
        </Link>
      </footer>
    </div>
  );
}

function requestExample(
  operation: any,
  spec: any,
  base: string,
  language: string,
) {
  const authenticated = operation.security.some(
    (security: any) => security.CustomerSession,
  );
  const bodySchema =
    operation.requestBody?.content?.["application/json"]?.schema;
  const body = bodySchema ? example(bodySchema, spec) : undefined;
  const path =
    operation.path + (operation.path === "/places" ? "?q=Lagos" : "");
  if (language === "javascript")
    return `const response = await fetch('${base}${path}', {\n  method: '${operation.method.toUpperCase()}',\n  headers: {${authenticated ? "\n    Authorization: 'Bearer ' + await getToken()," : ""}${body !== undefined ? "\n    'Content-Type': 'application/json'," : ""}\n  },${body !== undefined ? "\n  body: JSON.stringify(" + JSON.stringify(body, null, 2) + ")," : ""}\n});\nconst data = await response.json();\nif (!response.ok) throw new Error(data.error);`;
  if (language === "dart")
    return `// package:http and dart:convert; obtain a fresh session token via your auth SDK.\nfinal request = http.Request('${operation.method.toUpperCase()}', Uri.parse('${base}${path}'));\n${authenticated ? "request.headers['Authorization'] = 'Bearer $sessionToken';\n" : ""}${body !== undefined ? "request.headers['Content-Type'] = 'application/json';\nrequest.body = jsonEncode(" + JSON.stringify(body, null, 2) + ");\n" : ""}final response = await http.Response.fromStream(await request.send());\nfinal data = jsonDecode(response.body);\nif (response.statusCode >= 400) throw Exception(data['error']);`;
  return `curl --request ${operation.method.toUpperCase()} \\\n  '${base}${path}'${authenticated ? ' \\\n  --header "Authorization: Bearer $CUSTOMER_SESSION"' : ""}${body !== undefined ? " \\\n  --header 'Content-Type: application/json' \\\n  --data '" + JSON.stringify(body, null, 2) + "'" : ""}`;
}
