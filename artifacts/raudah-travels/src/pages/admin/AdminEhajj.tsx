import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useUser } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Banknote,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  FileUp,
  LayoutDashboard,
  Minimize2,
  Package,
  Plug,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  Upload,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ehajjPermissions,
  ehajjRequest,
  useEhajjAccess,
  type EhajjPermission,
  type EhajjProduct,
} from "@/lib/ehajj";

const panel =
  "min-w-0 space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6";
const selectClass =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary";
const views = [
  { key: "profile", label: "Profile", permission: "pilgrims" },
  { key: "travel", label: "Travel", permission: "operations" },
  { key: "accommodation", label: "Accommodation", permission: "operations" },
  { key: "payments", label: "Payments", permission: "finance" },
  { key: "documents", label: "Documents", permission: "documents" },
] as const;
const permissionLabels = {
  pilgrims: "Pilgrim profile",
  operations: "Travel and accommodation",
  finance: "Financial details",
  documents: "Document metadata and masked passport",
};

function PanelHeading({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-primary">
        <Icon size={19} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h3 className="text-lg font-semibold tracking-tight text-[#1C1F66]">
          {title}
        </h3>
        {children && (
          <p className="mt-0.5 break-words text-sm leading-relaxed text-slate-600">
            {children}
          </p>
        )}
      </div>
    </div>
  );
}

function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      {error instanceof Error
        ? error.message
        : "EHajj could not complete this request."}
    </p>
  );
}

function FieldList({ fields }: { fields: Record<string, string> }) {
  return (
    <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
      {Object.entries(fields).map(([label, value]) => (
        <div key={label} className="min-w-0 border-b border-slate-100 pb-2">
          <dt className="text-xs font-medium text-slate-600">{label}</dt>
          <dd className="mt-1 break-words text-sm text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function useProducts(userId: string) {
  return useQuery({
    queryKey: ["ehajj", userId, "products"],
    queryFn: ({ signal }) =>
      ehajjRequest<{ products: EhajjProduct[] }>("/products", { signal }),
    retry: false,
    gcTime: 0,
  });
}

function ProductBrowser({ userId }: { userId: string }) {
  const products = useProducts(userId);
  const [productId, setProductId] = useState<number>();
  const [search, setSearch] = useState("");
  const available = products.isSuccess ? products.data.products : [];
  const product =
    available.find((item) => item.id === productId) ??
    (available.length === 1 ? available[0] : undefined);
  const term = search.trim().toLowerCase();
  const matchingProducts = available.filter((item) =>
    [item.name, item.activity, item.edition, String(item.id)].some((value) =>
      value.toLowerCase().includes(term),
    ),
  );
  return (
    <div className="space-y-5">
      <section className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <PanelHeading icon={Package} title="Active EHajj products">
            Select a product to view its registered pilgrims.
          </PanelHeading>
          <Button
            variant="outline"
            onClick={() => void products.refetch()}
            disabled={products.isFetching}
          >
            <RefreshCw size={16} aria-hidden="true" /> Refresh products
          </Button>
        </div>
        <ErrorNotice error={products.error} />
        {products.isPending && (
          <p role="status" className="text-sm text-slate-600">
            Loading agency products…
          </p>
        )}
        {products.isSuccess && available.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
            No active EHajj products are available to this account.
          </p>
        )}
        {available.length > 0 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p
                role="status"
                className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-primary"
              >
                {available.length} active{" "}
                {available.length === 1 ? "product" : "products"}
              </p>
              {available.length > 1 && (
                <div className="relative w-full sm:w-64">
                  <Search
                    size={16}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <Input
                    aria-label="Search products"
                    className="pl-9"
                    value={search}
                    placeholder="Name, activity or edition"
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
              )}
            </div>
            {matchingProducts.length === 0 && (
              <p className="text-sm text-slate-600">
                No products match your search.
              </p>
            )}
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {matchingProducts.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={product?.id === item.id}
                    className="group flex h-full w-full flex-col gap-3 rounded-xl border border-slate-200 p-4 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 focus-visible:outline-2 focus-visible:outline-primary aria-pressed:border-primary aria-pressed:bg-indigo-50"
                    onClick={() => setProductId(item.id)}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="rounded-lg bg-indigo-100 p-2 text-primary">
                        <Package size={18} aria-hidden="true" />
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                        #{item.id}
                      </span>
                    </span>
                    <span className="w-full min-w-0 flex-1">
                      <span className="block break-words font-semibold text-slate-900">
                        {item.name}
                      </span>
                      <span className="mt-1 block text-xs text-slate-600">
                        {[
                          item.activity,
                          item.edition && "Edition " + item.edition,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="flex w-full items-center justify-between gap-2 border-t border-indigo-100 pt-3 text-xs font-semibold text-primary">
                      {product?.id === item.id
                        ? "Selected product"
                        : "View pilgrims"}
                      <ChevronRight size={16} aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {product?.description && (
          <p className="whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
            {product.description}
          </p>
        )}
      </section>
      {product && (
        <PilgrimBrowser key={product.id} userId={userId} product={product} />
      )}
    </div>
  );
}

function PilgrimBrowser({
  userId,
  product,
}: {
  userId: string;
  product: EhajjProduct;
}) {
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pilgrimId, setPilgrimId] = useState(0);
  const [viewKey, setViewKey] = useState("");
  const summaryRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (pilgrimId) summaryRef.current?.focus();
  }, [pilgrimId]);
  const availableViews = views.filter((view) =>
    product.permissions.includes(view.permission),
  );
  const view =
    availableViews.find((item) => item.key === viewKey) ?? availableViews[0];
  const path = "/products/" + product.id + "/pilgrims";
  const roster = useQuery({
    queryKey: ["ehajj", userId, "roster", product.id],
    queryFn: ({ signal }) =>
      ehajjRequest<{
        pilgrims: { id: number; fields: Record<string, string> }[];
      }>(path, { signal }),
    retry: false,
    gcTime: 0,
  });
  const pilgrim = roster.isError
    ? undefined
    : roster.data?.pilgrims.find((item) => item.id === pilgrimId);
  const detail = useQuery({
    queryKey: ["ehajj", userId, "detail", product.id, pilgrimId, view?.key],
    queryFn: ({ signal }) =>
      ehajjRequest<{
        sections: { title: string; fields: Record<string, string> }[];
      }>(path + "/" + pilgrimId + "/" + view.key, { signal }),
    enabled: !!pilgrim && !!view,
    retry: false,
    gcTime: 0,
  });
  const records = roster.data?.pilgrims ?? [];
  const search = filter.trim().toLowerCase();
  const matches = records.filter(
    ({ id, fields }) =>
      !search ||
      [
        [fields["First name"], fields["Last name"]].filter(Boolean).join(" "),
        fields["Pilgrim number"] ?? "",
        String(id),
      ].some((value) => value.toLowerCase().includes(search)),
  );
  const pageSize = 25;
  const lastPage = Math.max(1, Math.ceil(matches.length / pageSize));
  const currentPage = Math.min(page, lastPage);
  const start = (currentPage - 1) * pageSize;
  return (
    <div
      className={pilgrim ? "grid items-start gap-5 xl:grid-cols-2" : undefined}
    >
      <section className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <PanelHeading icon={Users} title="Registered pilgrims">
            {product.name}
          </PanelHeading>
          <Button
            variant="outline"
            onClick={() => void roster.refetch()}
            disabled={roster.isFetching}
          >
            <RefreshCw size={16} aria-hidden="true" /> Refresh list
          </Button>
        </div>
        <ErrorNotice error={roster.error} />
        {roster.isPending && (
          <p role="status" className="text-sm text-slate-600">
            Loading pilgrims…
          </p>
        )}
        {roster.isSuccess && records.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
            <Users
              size={24}
              aria-hidden="true"
              className="mx-auto mb-2 text-indigo-600"
            />
            <p className="font-medium text-slate-900">No registered pilgrims</p>
            <p className="mt-1 text-sm text-slate-600">
              EHajj returned no pilgrim records for this product.
            </p>
          </div>
        )}
        {roster.isSuccess && records.length > 0 && (
          <>
            <div className="relative">
              <Search
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <Input
                aria-label="Find a pilgrim"
                className="pl-9"
                placeholder="Find a pilgrim by name or number"
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <p role="status" className="text-sm text-slate-600">
              {matches.length === 0
                ? "No pilgrims match your search."
                : `Showing ${start + 1}–${Math.min(start + pageSize, matches.length)} of ${matches.length} ${search ? "matching records" : "registered pilgrims"}`}
            </p>
            {matches.length > 0 && (
              <div className="max-h-96 divide-y divide-slate-100 overflow-auto rounded-xl border border-slate-200">
                {matches.slice(start, start + pageSize).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={pilgrimId === item.id}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left text-sm transition-colors hover:bg-indigo-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary aria-pressed:bg-indigo-50"
                    onClick={() => {
                      if (item.id === pilgrimId) summaryRef.current?.focus();
                      else setPilgrimId(item.id);
                    }}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-indigo-100 text-primary">
                      <Users size={15} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 break-words">
                      <span className="block font-semibold text-slate-900">
                        {[item.fields["First name"], item.fields["Last name"]]
                          .filter(Boolean)
                          .join(" ") || "Pilgrim " + item.id}
                      </span>
                      <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                        <span>#{item.fields["Pilgrim number"] ?? item.id}</span>
                        {item.fields["Package"] && (
                          <span>{item.fields["Package"]}</span>
                        )}
                      </span>
                    </span>
                    <ChevronRight
                      size={16}
                      className="shrink-0 text-primary"
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            )}
            {lastPage > 1 && (
              <nav
                aria-label="Pilgrim list pages"
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft size={16} aria-hidden="true" /> Previous
                </Button>
                <span className="text-sm text-slate-600">
                  Page {currentPage} of {lastPage}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === lastPage}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next <ChevronRight size={16} aria-hidden="true" />
                </Button>
              </nav>
            )}
          </>
        )}
      </section>
      {pilgrim && (
        <section
          ref={summaryRef}
          tabIndex={-1}
          aria-label="Pilgrim summary"
          className={`${panel} scroll-mt-36 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:scroll-mt-20`}
        >
          <PanelHeading icon={FileCheck2} title="Pilgrim summary" />
          <FieldList fields={pilgrim.fields} />
          <p className="text-xs text-slate-600">
            EHajj reports financial figures in its source units. Currency and
            amount units await provider confirmation.
          </p>
          {view && (
            <>
              <div className="flex flex-wrap gap-2" aria-label="Pilgrim views">
                {availableViews.map((item) => (
                  <Button
                    key={item.key}
                    variant={view.key === item.key ? "default" : "outline"}
                    aria-pressed={view.key === item.key}
                    onClick={() => setViewKey(item.key)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
              <ErrorNotice error={detail.error} />
              {detail.isPending && (
                <p role="status" className="text-sm text-slate-600">
                  Loading {view.label.toLowerCase()}…
                </p>
              )}
              {detail.isSuccess && detail.data.sections.length === 0 && (
                <p className="text-sm text-slate-600">
                  EHajj reported no details for this view.
                </p>
              )}
              {detail.isSuccess &&
                detail.data.sections.map((section) => (
                  <div
                    key={section.title}
                    className="space-y-3 rounded-xl bg-slate-50 p-4"
                  >
                    <h3 className="font-semibold">{section.title}</h3>
                    <FieldList fields={section.fields} />
                  </div>
                ))}
            </>
          )}
        </section>
      )}
    </div>
  );
}

type Settings = {
  baseUrl: string | null;
  configuredBaseUrl: string | null;
  transportIssue: string | null;
  version: string | null;
  enabled: boolean;
  hasAgencyKey: boolean;
  hasJwt: boolean;
  encryptionReady: boolean;
};

function useEhajjSettings(userId?: string, enabled = true) {
  return useQuery({
    queryKey: ["ehajj", userId, "settings"],
    queryFn: ({ signal }) => ehajjRequest<Settings>("/settings", { signal }),
    enabled: !!userId && enabled,
    retry: false,
    gcTime: 0,
  });
}

function ConnectionSettings({ userId }: { userId: string }) {
  const settings = useEhajjSettings(userId);
  return (
    <section className={panel}>
      <PanelHeading icon={Plug} title="EHajj connection" />
      <ErrorNotice error={settings.error} />
      {settings.isPending && <p role="status">Loading settings…</p>}
      {settings.isSuccess && (
        <SettingsForm
          key={settings.data.version ?? "new"}
          userId={userId}
          settings={settings.data}
        />
      )}
      {settings.isError && (
        <Button variant="outline" onClick={() => void settings.refetch()}>
          Retry settings
        </Button>
      )}
    </section>
  );
}

function SettingsForm({
  userId,
  settings,
}: {
  userId: string;
  settings: Settings;
}) {
  const client = useQueryClient();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [agencyKey, setAgencyKey] = useState("");
  const [jwt, setJwt] = useState("");
  const [clearJwt, setClearJwt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const saved = await ehajjRequest<Settings>("/settings", {
        method: "PUT",
        body: JSON.stringify({
          version: settings.version,
          enabled,
          ...(agencyKey.trim() ? { agencyKey: agencyKey.trim() } : {}),
          ...(clearJwt ? { jwt: null } : jwt.trim() ? { jwt: jwt.trim() } : {}),
        }),
      });
      setAgencyKey("");
      setJwt("");
      await client.invalidateQueries({ queryKey: ["ehajj", userId] });
      client.setQueryData(["ehajj", userId, "settings"], saved);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="space-y-4" onSubmit={save}>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">Provider API URL</p>
        <p className="mt-1 break-all text-sm text-slate-600">
          {settings.configuredBaseUrl ??
            settings.baseUrl ??
            "Set EHAJJ_API_BASE_URL to the provider’s approved HTTPS base URL on the server."}
        </p>
      </div>
      {settings.transportIssue && (
        <p
          role="alert"
          className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
        >
          {settings.transportIssue}
        </p>
      )}
      {!settings.encryptionReady && (
        <p className="text-sm text-amber-800">
          Set the server’s SETTINGS_ENCRYPTION_KEY before saving credentials.
        </p>
      )}
      <p className="text-sm text-slate-600">
        Replacing the agency key clears product assignments and the previous
        JWT. Supply a matching JWT if you have one.
      </p>
      <label className="block space-y-1 text-sm font-medium">
        Agency key {settings.hasAgencyKey ? "(configured)" : "(required)"}
        <Input
          type="password"
          autoComplete="new-password"
          value={agencyKey}
          onChange={(event) => setAgencyKey(event.target.value)}
        />
      </label>
      <label className="block space-y-1 text-sm font-medium">
        EHajj JWT{" "}
        {settings.hasJwt
          ? "(saved)"
          : "(needed for detailed records and document metadata)"}
        <Input
          type="password"
          autoComplete="new-password"
          value={jwt}
          disabled={clearJwt}
          onChange={(event) => setJwt(event.target.value)}
        />
      </label>
      {settings.hasJwt && (
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={clearJwt}
            onChange={(event) => setClearJwt(event.target.checked)}
          />{" "}
          Remove saved JWT
        </label>
      )}
      <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium">
        <input
          type="checkbox"
          className="size-4 shrink-0 accent-primary"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />{" "}
        Enable EHajj connection
      </label>
      <ErrorNotice error={error} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={busy || !settings.baseUrl || !settings.encryptionReady}
        >
          Save connection
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() =>
            void client.invalidateQueries({
              queryKey: ["ehajj", userId, "settings"],
            })
          }
        >
          Reload settings
        </Button>
      </div>
    </form>
  );
}

function AccessAssignments({ userId }: { userId: string }) {
  const products = useProducts(userId);
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [lookup, setLookup] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [productId, setProductId] = useState(0);
  const [permissions, setPermissions] = useState<EhajjPermission[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const operators = useQuery({
    queryKey: ["ehajj", userId, "operators", lookup],
    queryFn: ({ signal }) =>
      ehajjRequest<{
        operators: { id: string; fullName: string; email: string }[];
      }>("/operators?search=" + encodeURIComponent(lookup), { signal }),
    enabled: lookup.length >= 2,
    retry: false,
    gcTime: 0,
  });
  const grantsPath = "/grants/" + encodeURIComponent(operatorId);
  const grants = useQuery({
    queryKey: ["ehajj", userId, "grants", operatorId],
    queryFn: ({ signal }) =>
      ehajjRequest<{
        grants: { productId: number; permissions: EhajjPermission[] }[];
      }>(grantsPath, { signal }),
    enabled: !!operatorId,
    retry: false,
    gcTime: 0,
  });
  async function update(revokeId?: number) {
    setBusy(true);
    setError(null);
    try {
      if (revokeId) {
        await ehajjRequest(grantsPath + "/" + revokeId, { method: "DELETE" });
      } else {
        await ehajjRequest("/grants", {
          method: "PUT",
          body: JSON.stringify({ userId: operatorId, productId, permissions }),
        });
      }
      await client.invalidateQueries({
        queryKey: ["ehajj", userId, "grants", operatorId],
      });
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={panel}>
      <PanelHeading icon={ShieldCheck} title="Product access assignments" />
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setLookup(search.trim());
          setOperatorId("");
        }}
      >
        <Input
          className="max-w-sm"
          aria-label="Staff name or email"
          placeholder="Staff name or email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button
          type="submit"
          variant="outline"
          disabled={busy || search.trim().length < 2}
        >
          Find staff
        </Button>
      </form>
      <ErrorNotice
        error={operators.error || products.error || grants.error || error}
      />
      {operators.isSuccess && (
        <label className="block space-y-1 text-sm font-medium">
          Admin or staff account
          <select
            className={selectClass}
            value={operatorId}
            disabled={busy}
            onChange={(event) => {
              setOperatorId(event.target.value);
              setProductId(0);
              setPermissions([]);
            }}
          >
            <option value="">
              {operators.data.operators.length
                ? "Choose an account"
                : "No matching accounts"}
            </option>
            {operators.data.operators.map((operator) => (
              <option key={operator.id} value={operator.id}>
                {operator.fullName} · {operator.email}
              </option>
            ))}
          </select>
        </label>
      )}
      {operatorId && grants.isSuccess && (
        <>
          <ul className="divide-y divide-slate-100">
            {grants.data.grants.map((grant) => (
              <li
                key={grant.productId}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <span>
                  {products.data?.products.find(
                    (product) => product.id === grant.productId,
                  )?.name ?? "Product " + grant.productId}{" "}
                  ·{" "}
                  {grant.permissions
                    .map((permission) => permissionLabels[permission])
                    .join(", ")}
                </span>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void update(grant.productId)}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
          {products.isSuccess && (
            <label className="block space-y-1 text-sm font-medium">
              Product
              <select
                className={selectClass}
                value={productId}
                disabled={busy}
                onChange={(event) => {
                  const id = Number(event.target.value);
                  setProductId(id);
                  setPermissions(
                    grants.data.grants.find((grant) => grant.productId === id)
                      ?.permissions ?? [],
                  );
                }}
              >
                <option value={0}>Choose a product</option>
                {products.data.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · {product.edition} · #{product.id}
                  </option>
                ))}
              </select>
            </label>
          )}
          {productId > 0 && products.isSuccess && (
            <fieldset className="space-y-2" disabled={busy}>
              <legend className="text-sm font-medium">Permitted views</legend>
              {ehajjPermissions.map((permission) => (
                <label key={permission} className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={permissions.includes(permission)}
                    onChange={(event) =>
                      setPermissions((current) =>
                        event.target.checked
                          ? [...current, permission]
                          : current.filter((value) => value !== permission),
                      )
                    }
                  />{" "}
                  {permissionLabels[permission]}
                </label>
              ))}
              <Button
                disabled={busy || !permissions.length}
                onClick={() => void update()}
              >
                Save assignment
              </Button>
            </fieldset>
          )}
        </>
      )}
    </section>
  );
}

type RegistrationFields = {
  firstName: string;
  lastName: string;
  gender: string;
  passportNumber: string;
  phone: string;
  packageId: string;
  amount: string;
  currency: string;
  paymentMethod: string;
  paymentReference: string;
  sourceBankId: string;
  destinationAccountId: string;
};
type RegistrationRecord = {
  id: string;
  version: string;
  state: "prepared" | "submitting" | "confirmed" | "requires_review";
  request: Record<string, string | number | boolean>;
  result: {
    id_pelerin: number;
    id_versement_pelerin: number;
    reste_a_verse: string | number;
  } | null;
  issue: string | null;
  updatedAt: string;
};
const blankRegistration: RegistrationFields = {
  firstName: "",
  lastName: "",
  gender: "",
  passportNumber: "",
  phone: "",
  packageId: "",
  amount: "",
  currency: "",
  paymentMethod: "",
  paymentReference: "",
  sourceBankId: "",
  destinationAccountId: "",
};

function RegistrationsWorkspace({ userId }: { userId: string }) {
  const [selected, setSelected] = useState<RegistrationRecord | null>(null);
  const history = useQuery({
    queryKey: ["ehajj", userId, "registrations"],
    queryFn: ({ signal }) =>
      ehajjRequest<{ registrations: RegistrationRecord[] }>("/registrations", {
        signal,
      }),
    retry: false,
    gcTime: 0,
  });
  return (
    <div className="space-y-5">
      <section className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PanelHeading icon={UserPlus} title="Pilgrim registration">
            Enter the pilgrim and their first payment for your EHajj agency.
            Review the details before sending.
          </PanelHeading>
          <Button variant="outline" onClick={() => setSelected(null)}>
            <UserPlus aria-hidden="true" /> New registration
          </Button>
        </div>
        <RegistrationForm
          key={
            userId + ":" + (selected ? selected.id + selected.version : "new")
          }
          userId={userId}
          initial={selected}
          onSaved={(record) => {
            setSelected(record);
            void history.refetch();
          }}
        />
      </section>
      <section className={panel}>
        <div className="flex items-center justify-between gap-3">
          <PanelHeading icon={Users} title="Recent registrations" />
          <Button
            variant="outline"
            disabled={history.isFetching}
            onClick={() => void history.refetch()}
          >
            <RefreshCw size={16} /> Refresh
          </Button>
        </div>
        <ErrorNotice error={history.error} />
        {history.isPending && <p role="status">Loading registrations…</p>}
        {history.isSuccess && !history.data.registrations.length && (
          <p className="text-sm text-slate-500">
            Your saved registrations will appear here.
          </p>
        )}
        <ul className="divide-y divide-slate-100">
          {history.data?.registrations.map((record) => (
            <li
              key={record.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="font-medium">
                  {String(record.request.firstName)}{" "}
                  {String(record.request.lastName)}
                </p>
                <p className="text-xs text-slate-500">
                  Package {String(record.request.packageId)} ·{" "}
                  {record.state.replaceAll("_", " ")}
                </p>
              </div>
              <Button variant="outline" onClick={() => setSelected(record)}>
                Review
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function RegistrationForm({
  userId,
  initial,
  onSaved,
}: {
  userId: string;
  initial: RegistrationRecord | null;
  onSaved: (record: RegistrationRecord) => void;
}) {
  const [fields, setFields] = useState<RegistrationFields>(
    () =>
      Object.fromEntries(
        Object.entries(blankRegistration).map(([key, fallback]) => [
          key,
          String(initial?.request[key] ?? fallback),
        ]),
      ) as RegistrationFields,
  );
  const [prepared, setPrepared] = useState(initial);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const terminal = prepared && prepared.state !== "prepared";
  const banks = useQuery({
    queryKey: ["ehajj", userId, "payment-options"],
    queryFn: ({ signal }) =>
      ehajjRequest<{
        banks: { id: number; name: string }[];
        accounts: { id: number; name: string; bankName: string }[];
      }>("/payment-options", { signal }),
    enabled: fields.paymentMethod === "3" && !terminal,
    retry: false,
    gcTime: 0,
  });
  function update(key: keyof RegistrationFields, value: string) {
    setFields((previous) => ({ ...previous, [key]: value }));
    setPrepared(null);
    setConfirmed(false);
  }
  async function save(submit: boolean) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await ehajjRequest<{ registration: RegistrationRecord }>(
        submit
          ? "/registrations/" + prepared!.id + "/submit"
          : "/registrations/prepare",
        {
          method: "POST",
          body: JSON.stringify(
            submit
              ? { confirmed: true, version: prepared!.version }
              : {
                  firstName: fields.firstName,
                  lastName: fields.lastName,
                  gender: fields.gender,
                  passportNumber: fields.passportNumber,
                  phone: fields.phone,
                  packageId: Number(fields.packageId),
                  amount: fields.amount,
                  currency: fields.currency,
                  paymentMethod: Number(fields.paymentMethod),
                  ...(fields.paymentReference.trim()
                    ? { paymentReference: fields.paymentReference.trim() }
                    : {}),
                  ...(fields.paymentMethod === "3"
                    ? {
                        sourceBankId: Number(fields.sourceBankId),
                        destinationAccountId: Number(
                          fields.destinationAccountId,
                        ),
                      }
                    : {}),
                  accountingConfirmed: confirmed,
                },
          ),
        },
      );
      setPrepared(result.registration);
      onSaved(result.registration);
    } catch (failure) {
      setError(failure);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  if (terminal)
    return (
      <div className="space-y-3 rounded-xl bg-slate-50 p-4" role="status">
        <h3 className="font-semibold">
          {prepared.state === "confirmed"
            ? "Registered in EHajj"
            : "Registration needs reconciliation"}
        </h3>
        <p className="text-sm">Registration reference {prepared.id}</p>
        <FieldList
          fields={{
            Pilgrim: fields.firstName + " " + fields.lastName,
            Package: fields.packageId,
            "First payment": fields.currency + " " + fields.amount,
          }}
        />
        {prepared.result && (
          <FieldList
            fields={{
              "EHajj pilgrim ID": String(prepared.result.id_pelerin),
              "EHajj payment ID": String(prepared.result.id_versement_pelerin),
              "Remaining balance": String(prepared.result.reste_a_verse),
            }}
          />
        )}
        {prepared.state === "submitting" && (
          <p className="text-sm">
            Submission has started. Refresh Recent registrations to check its
            outcome.
          </p>
        )}
        {prepared.issue && (
          <p className="text-sm text-amber-900">{prepared.issue}</p>
        )}
      </div>
    );
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save(false);
      }}
    >
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ["firstName", "First name", "text"],
            ["lastName", "Last name", "text"],
            ["passportNumber", "Passport number", "text"],
            ["phone", "Phone number", "tel"],
            ["packageId", "EHajj package ID", "number"],
            ["amount", "First payment amount", "text"],
          ] as const
        ).map(([key, label, type]) => (
          <label key={key} className="space-y-1 text-sm font-medium">
            {label}
            <Input
              required
              type={type}
              min={type === "number" ? 1 : undefined}
              value={fields[key]}
              onChange={(event) => update(key, event.target.value)}
            />
          </label>
        ))}
        <label className="space-y-1 text-sm font-medium">
          Gender
          <select
            required
            className={selectClass}
            value={fields.gender}
            onChange={(e) => update("gender", e.target.value)}
          >
            <option value="">Select</option>
            <option value="m">Male</option>
            <option value="f">Female</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          EHajj currency
          <Input
            required
            minLength={3}
            maxLength={3}
            placeholder="Three-letter currency code"
            value={fields.currency}
            onChange={(e) => update("currency", e.target.value.toUpperCase())}
          />
        </label>
        <label className="space-y-1 text-sm font-medium">
          Payment method
          <select
            required
            className={selectClass}
            value={fields.paymentMethod}
            onChange={(e) => update("paymentMethod", e.target.value)}
          >
            <option value="">Choose a method</option>
            {[
              [1, "Cash"],
              [2, "Cheque"],
              [3, "Bank transfer"],
              [4, "Nita transfer"],
              [5, "Amana transfer"],
            ].map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          Payment reference
          <Input
            required={fields.paymentMethod !== "1"}
            value={fields.paymentReference}
            onChange={(e) => update("paymentReference", e.target.value)}
          />
        </label>
        {fields.paymentMethod === "3" && (
          <>
            <label className="space-y-1 text-sm font-medium">
              Source bank
              <select
                required
                className={selectClass}
                value={fields.sourceBankId}
                onChange={(e) => update("sourceBankId", e.target.value)}
              >
                <option value="">Choose a bank</option>
                {banks.data?.banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Destination agency account
              <select
                required
                className={selectClass}
                value={fields.destinationAccountId}
                onChange={(e) => update("destinationAccountId", e.target.value)}
              >
                <option value="">Choose an account</option>
                {banks.data?.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.bankName} · {a.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label className="flex gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            required
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>
            I confirm the first payment has been received and the amount,
            currency, package and payment method match EHajj’s instructions.
          </span>
        </label>
      </fieldset>
      <ErrorNotice error={error || banks.error} />
      {banks.isError && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void banks.refetch()}
        >
          Retry banks
        </Button>
      )}
      {prepared && (
        <p className="rounded-xl bg-indigo-50 p-4 text-sm">
          Ready for review. Sending creates this pilgrim and records the first
          payment in EHajj.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !confirmed}>
          {busy ? "Please wait…" : "Prepare registration"}
        </Button>
        {prepared && (
          <Button
            type="button"
            disabled={busy || !confirmed}
            onClick={() => void save(true)}
          >
            Confirm and send
          </Button>
        )}
      </div>
    </form>
  );
}

const workspaceTabs = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  {
    key: "products",
    label: "Packages & pilgrims",
    icon: Package,
    description: "Browse agency packages and open registered pilgrim records.",
  },
  {
    key: "registrations",
    label: "Register pilgrim",
    icon: UserPlus,
    description: "Prepare a new registration or review a saved submission.",
  },
  {
    key: "delivery",
    label: "Document delivery",
    icon: FileCheck2,
    description:
      "Release travel documents to a booking owner’s FlyRaudah dashboard.",
  },
  {
    key: "connection",
    label: "Connection",
    icon: Plug,
    description: "Manage the agency credentials and connection to EHajj.",
  },
  {
    key: "access",
    label: "Access",
    icon: ShieldCheck,
    description: "Assign products and record permissions to staff.",
  },
] as const;
type WorkspaceTab = (typeof workspaceTabs)[number]["key"];

const workflow = [
  {
    icon: Banknote,
    title: "Booking & payment",
    description:
      "Customers select a package and pay through FlyRaudah checkout.",
  },
  {
    icon: CalendarCheck,
    title: "Payment confirmation",
    description: "FlyRaudah verifies the payment and issues the receipt.",
  },
  {
    icon: Plug,
    title: "Transfer to EHajj",
    description:
      "Automatic transfer awaits the provider’s booking and payment contract.",
  },
  {
    icon: FileCheck2,
    title: "Travel documents",
    description:
      "Collect the visa, ticket and other documents from EHajj. Automatic retrieval awaits the provider’s file access contract.",
  },
  {
    icon: FileUp,
    title: "Customer delivery",
    description: "Release a PDF to the booking owner’s FlyRaudah dashboard.",
  },
] as const;

const deliveryTypes = [
  ["visa", "Visa"],
  ["flight_ticket", "Flight ticket"],
  ["hotel_voucher", "Hotel voucher"],
  ["pre_departure_guide", "Pre-departure guide"],
] as const;
type DeliveryRecord = {
  booking: {
    id: string;
    recipientId: string;
    reference: string;
    customer: string;
    packageName: string;
    status: string;
    eligible: boolean;
  };
  documents: {
    id: string;
    type: string;
    fileName: string;
    createdAt: string;
  }[];
};

function DocumentDelivery({ userId }: { userId: string }) {
  const [search, setSearch] = useState("");
  const [reference, setReference] = useState("");
  const lookup = useQuery({
    queryKey: ["ehajj", userId, "delivery", reference],
    queryFn: ({ signal }) =>
      ehajjRequest<DeliveryRecord>(
        "/delivery/bookings/" + encodeURIComponent(reference),
        { signal },
      ),
    enabled: !!reference,
    retry: false,
    gcTime: 0,
  });
  return (
    <section className={panel}>
      <PanelHeading icon={FileCheck2} title="Find a booking">
        Look up a confirmed booking, check the recipient, then upload a PDF to
        their dashboard.
      </PanelHeading>
      <form
        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          if (search.trim() === reference) void lookup.refetch();
          else setReference(search.trim());
        }}
      >
        <label className="min-w-0 flex-1 space-y-1 text-sm font-medium">
          FlyRaudah booking reference
          <Input
            value={search}
            maxLength={100}
            required
            onChange={(event) => {
              setSearch(event.target.value);
              setReference("");
            }}
          />
        </label>
        <Button type="submit" disabled={!search.trim() || lookup.isFetching}>
          <Search aria-hidden="true" /> Find booking
        </Button>
      </form>
      {lookup.isFetching && (
        <p role="status" className="text-sm text-slate-600">
          Checking booking…
        </p>
      )}
      <ErrorNotice error={lookup.error} />
      {lookup.isSuccess && (
        <ReleaseDocumentForm
          key={lookup.data.booking.id + ":" + lookup.data.booking.recipientId}
          record={lookup.data}
          onReleased={() => void lookup.refetch()}
        />
      )}
    </section>
  );
}

function ReleaseDocumentForm({
  record,
  onReleased,
}: {
  record: DeliveryRecord;
  onReleased: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [released, setReleased] = useState(false);
  const submitting = useRef(false);
  const { booking } = record;
  async function release(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const body = new FormData(form);
    body.set("bookingId", booking.id);
    body.set("recipientId", booking.recipientId);
    submitting.current = true;
    setBusy(true);
    setError(null);
    setReleased(false);
    try {
      await ehajjRequest(
        "/delivery/bookings/" + encodeURIComponent(booking.reference),
        { method: "POST", body },
      );
      form.reset();
      setReleased(true);
      onReleased();
    } catch (failure) {
      setError(failure);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <FieldList
        fields={{
          Customer: booking.customer,
          Package: booking.packageName,
          Reference: booking.reference,
          Status: booking.status,
        }}
      />
      {booking.eligible ? (
        <form className="space-y-3" onSubmit={(event) => void release(event)}>
          <fieldset className="grid gap-3 sm:grid-cols-2" disabled={busy}>
            <label className="space-y-1 text-sm font-medium">
              Document type
              <select
                className={selectClass}
                name="type"
                required
                defaultValue=""
              >
                <option value="">Select type</option>
                {deliveryTypes.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              PDF file (up to 5 MB)
              <Input
                type="file"
                name="file"
                accept="application/pdf,.pdf"
                required
              />
            </label>
            <label className="flex items-start gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                name="confirmed"
                value="yes"
                required
                className="mt-1"
              />
              I’ve checked that this PDF belongs to the customer shown above.
            </label>
          </fieldset>
          <Button type="submit" disabled={busy}>
            <Upload size={16} /> {busy ? "Releasing…" : "Release to customer"}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-amber-900">
          Delivery requires a confirmed, fully paid booking and an active
          customer login.
        </p>
      )}
      <ErrorNotice error={error} />
      {released && (
        <p role="status" className="text-sm text-emerald-800">
          Document released. The customer has a dashboard notification.
        </p>
      )}
      {record.documents.length > 0 && (
        <ul
          className="space-y-2 border-t border-slate-200 pt-3 text-sm text-slate-700"
          aria-label="Released documents"
        >
          {record.documents.map((document) => (
            <li key={document.id} className="flex items-center gap-2">
              <FileCheck2 size={16} aria-hidden="true" /> {document.fileName}{" "}
              <span className="text-slate-500">
                {new Date(document.createdAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminEhajj({ onExit }: { onExit: () => void }) {
  const { user } = useUser();
  const access = useEhajjAccess(user?.id);
  const manages = access.data?.manage === true;
  const settings = useEhajjSettings(user?.id, manages);
  const [tab, setTab] = useState<WorkspaceTab>("overview");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sectionHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusSection = useRef(false);
  const requiresConnection =
    tab === "products" || tab === "registrations" || tab === "access";
  const activeTab = manages ? tab : "products";
  const activeSection = workspaceTabs.find(({ key }) => key === activeTab);
  const canAccess = !!user && access.isSuccess && access.data.allowed;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (focusSection.current) {
      sectionHeadingRef.current?.focus();
      focusSection.current = false;
    }
  }, [activeTab]);

  function openSection(nextTab: WorkspaceTab) {
    focusSection.current = true;
    setTab(nextTab);
  }

  useEffect(() => {
    function exitOnEscape(event: KeyboardEvent) {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing
      )
        return;
      // Let an open picker or dialog handle Escape first.
      if (
        event.target instanceof Element &&
        event.target.closest(
          'select, [role="combobox"], [role="dialog"], [role="alertdialog"], [role="listbox"]',
        )
      )
        return;
      event.preventDefault();
      onExit();
    }
    window.addEventListener("keydown", exitOnEscape);
    return () => window.removeEventListener("keydown", exitOnEscape);
  }, [onExit]);

  return (
    <div className="min-h-dvh bg-[#F5F6FC] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-white/15 bg-[#1C1F66] text-white shadow-sm">
        <div className="flex h-16 items-center justify-between gap-3 px-3 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/20 bg-white/10 text-white">
              <Package size={19} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="text-lg font-semibold leading-tight tracking-tight !text-white"
              >
                EHajj
              </h1>
              <span className="hidden text-xs text-indigo-200 sm:block">
                FlyRaudah Admin
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={onExit}
              aria-keyshortcuts="Escape"
              className="min-h-10 shrink-0 rounded-lg border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white focus-visible:ring-white"
            >
              <Minimize2 size={16} aria-hidden="true" /> Exit workspace
              <kbd
                aria-hidden="true"
                className="ml-1 hidden rounded border border-white/30 px-1.5 py-0.5 font-sans text-[11px] leading-none text-indigo-100 md:inline"
              >
                Esc
              </kbd>
            </Button>
          </div>
        </div>
      </header>
      <div
        className={
          canAccess && manages
            ? "lg:grid lg:grid-cols-[14.5rem_minmax(0,1fr)]"
            : ""
        }
      >
        {canAccess && manages && (
          <aside className="sticky top-[65px] z-20 self-start border-b border-slate-200 bg-white lg:h-[calc(100dvh-65px)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <nav
              aria-label="EHajj workspace"
              className="flex gap-1 overflow-x-auto px-3 py-2 lg:flex-col lg:px-3 lg:py-6"
            >
              {workspaceTabs.map(({ key, label, icon: Icon }) => (
                <Button
                  key={key}
                  variant="ghost"
                  aria-pressed={tab === key}
                  onClick={() => setTab(key)}
                  className={
                    "min-h-11 shrink-0 justify-start gap-2 rounded-lg border-l-2 px-3 " +
                    (activeTab === key
                      ? "border-l-[#FF3B00] bg-indigo-50 font-semibold text-primary hover:bg-indigo-100"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")
                  }
                >
                  <Icon size={17} aria-hidden="true" /> {label}
                </Button>
              ))}
            </nav>
          </aside>
        )}
        <main className="mx-auto w-full min-w-0 max-w-7xl space-y-6 px-3 py-5 sm:px-7 lg:py-8">
          {!user || access.isPending ? (
            <p role="status" className={panel}>
              Checking EHajj access…
            </p>
          ) : access.isError ? (
            <ErrorNotice error={access.error} />
          ) : !canAccess ? (
            <section className={panel}>
              <PanelHeading icon={ShieldOff} title="Product access required">
                Ask a Super Admin to assign EHajj product access.
              </PanelHeading>
            </section>
          ) : (
            <>
              {activeSection && "description" in activeSection && (
                <div className="border-b border-slate-200 pb-5">
                  <h2
                    ref={sectionHeadingRef}
                    tabIndex={-1}
                    className="scroll-mt-32 text-2xl font-semibold tracking-tight text-[#1C1F66] sm:text-3xl"
                  >
                    {activeSection.label}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {activeSection.description}
                  </p>
                </div>
              )}
              {manages && tab === "overview" && (
                <>
                  <section className="rounded-2xl border border-indigo-900 bg-linear-to-br from-[#1C1F66] to-[#2D3199] p-5 text-white shadow-sm sm:p-8">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                      <h2 className="text-2xl font-semibold tracking-tight !text-white sm:text-3xl">
                        EHajj overview
                      </h2>
                      {settings.data && (
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-indigo-50">
                          <span
                            aria-hidden="true"
                            className={
                              "size-2 rounded-full " +
                              (settings.data.enabled
                                ? "bg-emerald-300"
                                : "bg-amber-300")
                            }
                          />
                          {settings.data.enabled
                            ? "Connection enabled"
                            : "Disconnected"}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-indigo-100 sm:text-base">
                      Manage agency packages, pilgrim records and customer
                      travel documents.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {settings.data?.enabled ? (
                        <Button
                          onClick={() => openSection("products")}
                          className="min-h-10 rounded-lg border-white bg-white text-[#1C1F66] focus-visible:ring-white"
                        >
                          <Package aria-hidden="true" /> Browse packages
                        </Button>
                      ) : (
                        settings.data && (
                          <Button
                            onClick={() => openSection("connection")}
                            className="min-h-10 rounded-lg border-white bg-white text-[#1C1F66] focus-visible:ring-white"
                          >
                            <Plug aria-hidden="true" /> Open connection settings
                          </Button>
                        )
                      )}
                      <Button
                        variant="outline"
                        onClick={() => openSection("delivery")}
                        className="min-h-10 rounded-lg border-white/30 bg-white/10 text-white focus-visible:ring-white"
                      >
                        <FileCheck2 aria-hidden="true" /> Deliver a document
                      </Button>
                    </div>
                  </section>
                  <section className={panel}>
                    <PanelHeading
                      icon={CalendarCheck}
                      title="Booking to delivery"
                    />
                    <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                      {workflow.map(({ icon: Icon, title, description }) => (
                        <li
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                          key={title}
                        >
                          <Icon
                            size={19}
                            className="mb-3 text-primary"
                            aria-hidden="true"
                          />
                          <h4 className="text-sm font-semibold text-slate-900">
                            {title}
                          </h4>
                          <p className="mt-2 text-sm leading-relaxed text-slate-600">
                            {description}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </section>
                </>
              )}
              {manages && (tab === "overview" || requiresConnection) && (
                <ErrorNotice error={settings.error} />
              )}
              {manages && requiresConnection && settings.isPending && (
                <p role="status">Checking connection…</p>
              )}
              {manages &&
                requiresConnection &&
                settings.data &&
                !settings.data.enabled && (
                  <section className={panel}>
                    <PanelHeading
                      icon={ShieldOff}
                      title="EHajj is disconnected."
                    />
                    <Button
                      variant="outline"
                      onClick={() => openSection("connection")}
                    >
                      Connection settings <ArrowRight size={16} />
                    </Button>
                  </section>
                )}
              {(!manages || (tab === "products" && settings.data?.enabled)) && (
                <ProductBrowser userId={user.id} />
              )}
              {manages && tab === "connection" && (
                <ConnectionSettings userId={user.id} />
              )}
              {manages && tab === "access" && settings.data?.enabled && (
                <AccessAssignments userId={user.id} />
              )}
              {manages && tab === "registrations" && settings.data?.enabled && (
                <RegistrationsWorkspace key={user.id} userId={user.id} />
              )}
              {manages && tab === "delivery" && (
                <DocumentDelivery userId={user.id} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
