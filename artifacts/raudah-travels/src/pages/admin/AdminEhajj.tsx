import { useRef, useState, type FormEvent } from "react";
import { useUser } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, RefreshCw, ShieldCheck } from "lucide-react";
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
  "space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6";
const selectClass =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm";
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
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {Object.entries(fields).map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs font-medium text-slate-500">{label}</dt>
          <dd className="break-words text-sm text-slate-900">{value}</dd>
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
  const [productId, setProductId] = useState(0);
  const product = products.isError
    ? undefined
    : products.data?.products.find((item) => item.id === productId);
  return (
    <div className="space-y-4">
      <section className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Agency products</h2>
            <p className="text-sm text-slate-600">
              Select a product to see its registered pilgrims.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => void products.refetch()}
            disabled={products.isFetching}
          >
            <RefreshCw size={16} /> Refresh products
          </Button>
        </div>
        <ErrorNotice error={products.error} />
        {products.isPending && (
          <p role="status" className="text-sm text-slate-600">
            Loading agency products…
          </p>
        )}
        {products.isSuccess && products.data.products.length === 0 && (
          <p className="text-sm text-slate-600">
            There are no active products in your EHajj assignment.
          </p>
        )}
        {products.isSuccess && products.data.products.length > 0 && (
          <label className="block space-y-1 text-sm font-medium">
            Product
            <select
              className={selectClass}
              value={product?.id ?? 0}
              onChange={(event) => setProductId(Number(event.target.value))}
            >
              <option value={0}>Choose a product</option>
              {products.data.products.map((item) => (
                <option key={item.id} value={item.id}>
                  {[item.name, item.activity, item.edition]
                    .filter(Boolean)
                    .join(" · ")}
                </option>
              ))}
            </select>
          </label>
        )}
        {product?.description && (
          <p className="whitespace-pre-wrap break-words text-sm text-slate-600">
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
  const [pilgrimId, setPilgrimId] = useState(0);
  const [viewKey, setViewKey] = useState("");
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
  const matches = (roster.data?.pilgrims ?? []).filter((item) =>
    Object.values(item.fields).some((value) =>
      value.toLowerCase().includes(filter.trim().toLowerCase()),
    ),
  );
  return (
    <>
      <section className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Registered pilgrims</h2>
          <Button
            variant="outline"
            onClick={() => void roster.refetch()}
            disabled={roster.isFetching}
          >
            <RefreshCw size={16} /> Refresh list
          </Button>
        </div>
        <ErrorNotice error={roster.error} />
        {roster.isPending && (
          <p role="status" className="text-sm text-slate-600">
            Loading pilgrims…
          </p>
        )}
        {roster.isSuccess && (
          <>
            <Input
              aria-label="Find a pilgrim"
              placeholder="Find a pilgrim by name or number"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
            <p className="text-sm text-slate-600">
              {matches.length} matching records
              {matches.length > 100 &&
                ". Showing the first 100. Refine your search for the others."}
            </p>
            <div className="max-h-72 divide-y divide-slate-100 overflow-auto">
              {matches.slice(0, 100).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={pilgrimId === item.id}
                  className="flex w-full flex-wrap justify-between gap-2 rounded px-3 py-2.5 text-left text-sm hover:bg-indigo-50 aria-pressed:bg-indigo-100"
                  onClick={() => setPilgrimId(item.id)}
                >
                  <span className="font-medium">
                    {[item.fields["First name"], item.fields["Last name"]]
                      .filter(Boolean)
                      .join(" ") || "Pilgrim " + item.id}
                  </span>
                  <span className="text-slate-600">
                    {item.fields["Pilgrim number"] ?? item.id}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
      {pilgrim && (
        <section className={panel}>
          <h2 className="text-lg font-semibold">Pilgrim summary</h2>
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
    </>
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

function ConnectionSettings({ userId }: { userId: string }) {
  const settings = useQuery({
    queryKey: ["ehajj", userId, "settings"],
    queryFn: ({ signal }) => ehajjRequest<Settings>("/settings", { signal }),
    retry: false,
    gcTime: 0,
  });
  return (
    <section className={panel}>
      <h2 className="text-lg font-semibold">EHajj connection</h2>
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
      <p className="break-all text-sm text-slate-600">
        {settings.configuredBaseUrl ??
          settings.baseUrl ??
          "Set EHAJJ_API_BASE_URL to the provider’s approved HTTPS base URL on the server."}
      </p>
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
        Agency key {settings.hasAgencyKey ? "(saved)" : "(required)"}
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
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />{" "}
        Enable EHajj connection
      </label>
      <ErrorNotice error={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !settings.baseUrl}>
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
      <h2 className="text-lg font-semibold">Product access assignments</h2>
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
          <div>
            <h2 className="text-lg font-semibold">Pilgrim registration</h2>
            <p className="mt-1 text-sm text-slate-600">
              Enter the pilgrim and their first payment for your EHajj agency.
              Review the details before sending.
            </p>
          </div>
          <Button variant="outline" onClick={() => setSelected(null)}>
            New registration
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
          <h2 className="font-semibold">Recent registrations</h2>
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

export default function AdminEhajj() {
  const { user } = useUser();
  const access = useEhajjAccess(user?.id);
  const [tab, setTab] = useState("products");
  if (!user || access.isPending)
    return (
      <p className="p-6" role="status">
        Checking EHajj access…
      </p>
    );
  if (access.isError)
    return (
      <div className="p-6">
        <ErrorNotice error={access.error} />
      </div>
    );
  if (!access.data.allowed)
    return (
      <p className="p-6">Ask a Super Admin to assign EHajj product access.</p>
    );
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-8">
      <header className="rounded-2xl bg-[#1C1F66] p-6 text-white">
        <p className="flex items-center gap-2 text-sm text-indigo-100">
          <ShieldCheck size={16} /> Agency operations
        </p>
        <h1 className="mt-2 text-3xl font-bold !text-white">EHajj</h1>
        <p className="mt-2 max-w-xl text-sm text-indigo-100">
          View agency products, pilgrim records and assigned travel details
          through the documented EHajj API.
        </p>
      </header>
      {access.data.manage && (
        <nav aria-label="EHajj workspace" className="flex flex-wrap gap-2">
          {[
            ["products", "Products and pilgrims"],
            ["registrations", "Register pilgrim"],
            ["connection", "Connection"],
            ["access", "Access assignments"],
          ].map(([key, label]) => (
            <Button
              key={key}
              variant={tab === key ? "default" : "outline"}
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
            >
              {label}
            </Button>
          ))}
        </nav>
      )}
      {(!access.data.manage || tab === "products") && (
        <ProductBrowser userId={user.id} />
      )}
      {access.data.manage && tab === "connection" && (
        <ConnectionSettings userId={user.id} />
      )}
      {access.data.manage && tab === "access" && (
        <AccessAssignments userId={user.id} />
      )}
      {access.data.manage && tab === "registrations" && (
        <RegistrationsWorkspace key={user.id} userId={user.id} />
      )}
      <p className="flex items-center gap-2 text-xs text-slate-500">
        <BookOpen size={15} /> Source: eHadj 2.0 mobile API
      </p>
    </div>
  );
}
