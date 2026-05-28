import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, FileText, Plane, Upload, ExternalLink, Loader2, CheckCircle } from "lucide-react";

interface VisaApp {
  id: string;
  bookingId: string;
  status: string;
  visaNumber?: string;
  visaExpiry?: string;
  notes?: string;
  rejectionReason?: string;
  providerId?: string;
  visaDocumentUrl?: string;
  ticketDocumentUrl?: string;
  pilgrimName?: string;
  passportNumber?: string;
  createdAt: string;
  booking?: {
    id?: string;
    reference?: string;
    fullName?: string;
    passportNumber?: string;
    packageId?: string;
    departureCity?: string;
    gender?: string;
    idNumber?: number | null;
  };
  packageName?: string;
}

interface VisaProvider {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  specialization?: string;
  status: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: "Pending",   color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  submitted: { label: "Submitted", color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  approved:  { label: "Approved",  color: "text-green-700",  bg: "bg-green-50 border-green-200" },
  rejected:  { label: "Rejected",  color: "text-red-700",    bg: "bg-red-50 border-red-200" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "text-gray-700", bg: "bg-gray-100 border-gray-200" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>;
}

export default function AdminVisaManagement() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("tracking");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [packageFilter, setPackageFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedMap, setSelectedMap] = useState<Map<string, VisaApp>>(new Map());
  const [updatingVisa, setUpdatingVisa] = useState<VisaApp | null>(null);
  const [updateForm, setUpdateForm] = useState({
    status: "", visaNumber: "", visaExpiry: "",
    rejectionReason: "", notes: "", visaDocumentUrl: "", ticketDocumentUrl: "",
  });
  const [visaFile, setVisaFile] = useState<File | null>(null);
  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<VisaProvider | null>(null);
  const [providerForm, setProviderForm] = useState({ name: "", contactPerson: "", email: "", phone: "", specialization: "" });
  const visaFileRef = useRef<HTMLInputElement>(null);
  const ticketFileRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { data: stats } = useQuery<Record<string, number>>({
    queryKey: ["admin-visa-stats"],
    queryFn: () => fetch("/api/admin/visa-stats", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data, isLoading } = useQuery<{ visas: VisaApp[]; total: number; totalPages: number }>({
    queryKey: ["admin-visa", statusFilter, debouncedSearch, packageFilter, page],
    queryFn: async () => {
      const p = new URLSearchParams({ limit: "100", page: String(page) });
      if (statusFilter !== "all") p.set("status", statusFilter);
      if (debouncedSearch) p.set("search", debouncedSearch);
      if (packageFilter !== "all") p.set("packageId", packageFilter);
      return fetch(`/api/admin/visa?${p}`, { credentials: "include" }).then(r => r.json());
    },
    placeholderData: prev => prev,
  });

  const { data: packagesData } = useQuery<{ packages: { id: string; name: string }[] }>({
    queryKey: ["packages-filter-list"],
    queryFn: () => fetch("/api/packages?limit=100", { credentials: "include" }).then(r => r.json()),
  });

  const { data: providersData, refetch: refetchProviders } = useQuery<{ providers: VisaProvider[] }>({
    queryKey: ["visa-providers"],
    queryFn: () => fetch("/api/admin/visa-providers", { credentials: "include" }).then(r => r.json()),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, string> }) => {
      const r = await fetch(`/api/admin/visa/${id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Failed to update");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-visa"] });
      qc.invalidateQueries({ queryKey: ["admin-visa-stats"] });
      setUpdatingVisa(null);
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const r = await fetch("/api/admin/visa/bulk-approve", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-visa"] });
      qc.invalidateQueries({ queryKey: ["admin-visa-stats"] });
      setSelectedMap(new Map());
    },
  });

  const saveProviderMutation = useMutation({
    mutationFn: async (data: typeof providerForm) => {
      const url = editingProvider ? `/api/admin/visa-providers/${editingProvider.id}` : "/api/admin/visa-providers";
      const r = await fetch(url, {
        method: editingProvider ? "PUT" : "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => { refetchProviders(); setProviderOpen(false); setEditingProvider(null); },
  });

  const deleteProviderMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/visa-providers/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => refetchProviders(),
  });

  function handleSearch(v: string) {
    setSearch(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setDebouncedSearch(v); setPage(1); }, 350);
  }

  function openUpdate(visa: VisaApp) {
    setUpdatingVisa(visa);
    setUpdateForm({
      status: visa.status,
      visaNumber: visa.visaNumber ?? "",
      visaExpiry: visa.visaExpiry ?? "",
      rejectionReason: visa.rejectionReason ?? "",
      notes: visa.notes ?? "",
      visaDocumentUrl: visa.visaDocumentUrl ?? "",
      ticketDocumentUrl: visa.ticketDocumentUrl ?? "",
    });
    setVisaFile(null);
    setTicketFile(null);
  }

  async function handleSave() {
    if (!updatingVisa) return;
    setIsSaving(true);
    try {
      let vUrl = updateForm.visaDocumentUrl;
      let tUrl = updateForm.ticketDocumentUrl;
      if (visaFile || ticketFile) {
        const fd = new FormData();
        if (visaFile) fd.append("visa", visaFile);
        if (ticketFile) fd.append("ticket", ticketFile);
        const r = await fetch("/api/admin/upload", { method: "POST", credentials: "include", body: fd });
        const d = await r.json();
        if (d.visaUrl) vUrl = d.visaUrl;
        if (d.ticketUrl) tUrl = d.ticketUrl;
      }
      await updateMutation.mutateAsync({
        id: updatingVisa.id,
        body: { ...updateForm, visaDocumentUrl: vUrl, ticketDocumentUrl: tUrl },
      });
    } finally {
      setIsSaving(false);
    }
  }

  const visas: VisaApp[] = data?.visas ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const providers: VisaProvider[] = providersData?.providers ?? [];
  const allPageSelected = visas.length > 0 && visas.every(v => selectedMap.has(v.id));

  function togglePage(checked: boolean) {
    setSelectedMap(m => {
      const n = new Map(m);
      if (checked) visas.forEach(v => n.set(v.id, v));
      else visas.forEach(v => n.delete(v.id));
      return n;
    });
  }

  async function selectAllMatching() {
    const p = new URLSearchParams({ exportAll: "true" });
    if (statusFilter !== "all") p.set("status", statusFilter);
    if (debouncedSearch) p.set("search", debouncedSearch);
    if (packageFilter !== "all") p.set("packageId", packageFilter);
    const r = await fetch(`/api/admin/visa?${p}`, { credentials: "include" });
    const d = await r.json();
    setSelectedMap(m => {
      const n = new Map(m);
      (d.visas ?? []).forEach((v: VisaApp) => n.set(v.id, v));
      return n;
    });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Visa Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track, process and upload visa documents for pilgrims</p>
        </div>
        <div className="flex gap-2">
          {(["tracking", "providers"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                tab === t ? "bg-[#2D3199] text-white shadow-sm" : "bg-white text-gray-600 border hover:border-[#2D3199] hover:text-[#2D3199]"
              }`}>
              {t === "tracking" ? "Visa Tracking" : "Providers"}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          { key: "pending",   label: "Pending",   emoji: "⏳", accent: "#FF3B00" },
          { key: "submitted", label: "Submitted",  emoji: "📤", accent: "#2D3199" },
          { key: "approved",  label: "Approved",   emoji: "✅", accent: "#16a34a" },
          { key: "rejected",  label: "Rejected",   emoji: "❌", accent: "#dc2626" },
        ] as const).map(s => (
          <button key={s.key}
            onClick={() => { setStatusFilter(f => f === s.key ? "all" : s.key); setPage(1); }}
            className={`text-left p-4 rounded-xl border-2 bg-white hover:shadow-sm transition-all ${
              statusFilter === s.key ? "border-[#2D3199] shadow-sm" : "border-transparent shadow-sm"
            }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{s.label}</span>
              <span className="text-lg">{s.emoji}</span>
            </div>
            <p className="text-3xl font-black tabular-nums" style={{ color: s.accent }}>{stats?.[s.key] ?? 0}</p>
          </button>
        ))}
      </div>

      {/* ── TRACKING TAB ── */}
      {tab === "tracking" && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input value={search} onChange={e => handleSearch(e.target.value)}
                placeholder="Search name, passport, booking ref…"
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D3199]/30 focus:border-[#2D3199]" />
            </div>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2D3199]/30">
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select value={packageFilter} onChange={e => { setPackageFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2D3199]/30">
              <option value="all">All Packages</option>
              {(packagesData?.packages ?? []).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {selectedMap.size > 0 && (
              <>
                <button onClick={() => bulkApproveMutation.mutate([...selectedMap.keys()])}
                  disabled={bulkApproveMutation.isPending}
                  className="px-4 py-2 text-sm font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  {bulkApproveMutation.isPending ? "Approving…" : `Bulk Approve (${selectedMap.size})`}
                </button>
                <button onClick={() => setSelectedMap(new Map())}
                  className="px-3 py-2 text-sm text-gray-500 border rounded-lg hover:bg-gray-50">
                  Clear
                </button>
              </>
            )}
          </div>

          {/* Select-all-matching */}
          {total > 50 && selectedMap.size > 0 && selectedMap.size < total && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-center gap-3 text-sm">
              <span className="text-blue-700">{selectedMap.size} selected on this page.</span>
              <button onClick={selectAllMatching} className="font-bold text-blue-800 underline hover:no-underline">
                Select all {total} matching records
              </button>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="w-10 px-4 py-3">
                      <input type="checkbox" checked={allPageSelected} onChange={e => togglePage(e.target.checked)}
                        className="w-4 h-4 rounded accent-[#2D3199]" />
                    </th>
                    <th className="px-4 py-3 text-xs font-black text-gray-500 uppercase tracking-wide">#</th>
                    <th className="px-4 py-3 text-xs font-black text-gray-500 uppercase tracking-wide">Pilgrim</th>
                    <th className="px-4 py-3 text-xs font-black text-gray-500 uppercase tracking-wide">Package</th>
                    <th className="px-4 py-3 text-xs font-black text-gray-500 uppercase tracking-wide">Booking Ref</th>
                    <th className="px-4 py-3 text-xs font-black text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-xs font-black text-gray-500 uppercase tracking-wide">Visa #</th>
                    <th className="px-4 py-3 text-xs font-black text-gray-500 uppercase tracking-wide">Docs</th>
                    <th className="px-4 py-3 text-xs font-black text-gray-500 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={9} className="py-16 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-[#2D3199] mx-auto" />
                    </td></tr>
                  ) : visas.length === 0 ? (
                    <tr><td colSpan={9} className="py-16 text-center text-gray-400 text-sm">
                      No visa applications found for the current filters.
                    </td></tr>
                  ) : visas.map((visa, i) => (
                    <tr key={visa.id}
                      className={`border-b transition-colors hover:bg-gray-50/70 ${selectedMap.has(visa.id) ? "bg-blue-50/40" : ""}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedMap.has(visa.id)}
                          onChange={e => setSelectedMap(m => {
                            const n = new Map(m);
                            e.target.checked ? n.set(visa.id, visa) : n.delete(visa.id);
                            return n;
                          })}
                          className="w-4 h-4 rounded accent-[#2D3199]" />
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs tabular-nums">{(page - 1) * 100 + i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900 leading-tight">
                          {visa.booking?.fullName || visa.pilgrimName || "—"}
                        </p>
                        <p className="text-gray-400 text-[11px] font-mono mt-0.5">
                          {visa.booking?.passportNumber || visa.passportNumber || ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[130px] truncate">
                        {visa.packageName || "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">
                        {visa.booking?.reference || "—"}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={visa.status} /></td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">
                        {visa.visaNumber || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {visa.visaDocumentUrl && (
                            <a href={visa.visaDocumentUrl} target="_blank" rel="noreferrer"
                              title="Visa Document" className="p-1 rounded hover:bg-blue-50 text-blue-600">
                              <FileText className="w-4 h-4" />
                            </a>
                          )}
                          {visa.ticketDocumentUrl && (
                            <a href={visa.ticketDocumentUrl} target="_blank" rel="noreferrer"
                              title="Flight Ticket" className="p-1 rounded hover:bg-purple-50 text-purple-600">
                              <Plane className="w-4 h-4" />
                            </a>
                          )}
                          {!visa.visaDocumentUrl && !visa.ticketDocumentUrl && (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => openUpdate(visa)}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#2D3199]/8 text-[#2D3199] hover:bg-[#2D3199]/15 transition-colors">
                          Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-4 py-3 border-t flex items-center justify-between text-sm bg-gray-50/50">
                <span className="text-xs text-gray-500">Showing {(page - 1) * 100 + 1}–{Math.min(page * 100, total)} of {total}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1 rounded border text-xs hover:bg-white disabled:opacity-40">← Prev</button>
                  <span className="px-3 py-1 text-xs font-bold text-gray-600">{page} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="px-3 py-1 rounded border text-xs hover:bg-white disabled:opacity-40">Next →</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── PROVIDERS TAB ── */}
      {tab === "providers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {providers.length} visa service provider{providers.length !== 1 ? "s" : ""}
            </p>
            <button
              onClick={() => {
                setEditingProvider(null);
                setProviderForm({ name: "", contactPerson: "", email: "", phone: "", specialization: "" });
                setProviderOpen(true);
              }}
              className="px-4 py-2 text-sm font-bold bg-[#2D3199] text-white rounded-lg hover:bg-[#2D3199]/90">
              + Add Provider
            </button>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {providers.length === 0 ? (
              <p className="text-sm text-gray-400 col-span-3 text-center py-10">No providers yet.</p>
            ) : providers.map(p => (
              <div key={p.id} className="bg-white rounded-xl border p-4 space-y-2 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{p.name}</h3>
                    {p.specialization && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{p.specialization}</p>}
                  </div>
                  <span className={`shrink-0 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                    p.status === "active"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-gray-100 text-gray-500 border-gray-200"
                  }`}>{p.status}</span>
                </div>
                {p.contactPerson && <p className="text-xs text-gray-600"><span className="font-semibold">Contact:</span> {p.contactPerson}</p>}
                {p.email && <p className="text-xs text-gray-400">{p.email}</p>}
                {p.phone && <p className="text-xs text-gray-400">{p.phone}</p>}
                <div className="flex gap-3 pt-1 border-t">
                  <button onClick={() => {
                    setEditingProvider(p);
                    setProviderForm({
                      name: p.name, contactPerson: p.contactPerson ?? "",
                      email: p.email ?? "", phone: p.phone ?? "", specialization: p.specialization ?? "",
                    });
                    setProviderOpen(true);
                  }} className="text-xs font-bold text-[#2D3199] hover:underline">Edit</button>
                  <button onClick={() => { if (confirm(`Delete "${p.name}"?`)) deleteProviderMutation.mutate(p.id); }}
                    className="text-xs font-bold text-red-500 hover:underline">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── UPDATE DIALOG ── */}
      {updatingVisa && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => !isSaving && setUpdatingVisa(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b flex items-start justify-between gap-3 sticky top-0 bg-white rounded-t-2xl z-10">
              <div className="min-w-0">
                <h2 className="font-black text-gray-900">Update Visa Application</h2>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {updatingVisa.booking?.fullName || updatingVisa.pilgrimName}
                  {(updatingVisa.booking?.passportNumber || updatingVisa.passportNumber)
                    && ` · ${updatingVisa.booking?.passportNumber || updatingVisa.passportNumber}`}
                </p>
              </div>
              <button onClick={() => !isSaving && setUpdatingVisa(null)}
                className="w-7 h-7 shrink-0 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 text-lg">✕</button>
            </div>
            <div className="p-5 space-y-4">

              {/* Status */}
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1.5 block">Status</label>
                <select value={updateForm.status}
                  onChange={e => setUpdateForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D3199]/30 focus:border-[#2D3199]">
                  <option value="pending">Pending</option>
                  <option value="submitted">Submitted to Embassy</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {/* Visa # + expiry */}
              {(updateForm.status === "approved" || updateForm.status === "submitted") && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-700 mb-1.5 block">Visa Number</label>
                    <input value={updateForm.visaNumber}
                      onChange={e => setUpdateForm(f => ({ ...f, visaNumber: e.target.value }))}
                      placeholder="e.g. V-2024-XXXXX"
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D3199]/30" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 mb-1.5 block">Expiry Date</label>
                    <input type="date" value={updateForm.visaExpiry}
                      onChange={e => setUpdateForm(f => ({ ...f, visaExpiry: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D3199]/30" />
                  </div>
                </div>
              )}

              {/* Rejection reason */}
              {updateForm.status === "rejected" && (
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1.5 block">Rejection Reason</label>
                  <textarea value={updateForm.rejectionReason}
                    onChange={e => setUpdateForm(f => ({ ...f, rejectionReason: e.target.value }))}
                    rows={2} placeholder="Reason for rejection…"
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D3199]/30 resize-none" />
                </div>
              )}

              {/* Visa document */}
              <div className="p-3 rounded-xl bg-gray-50 border space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-500" /> Visa Document
                  </label>
                  {updateForm.visaDocumentUrl && (
                    <a href={updateForm.visaDocumentUrl} target="_blank" rel="noreferrer"
                      className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> View current
                    </a>
                  )}
                </div>
                <input ref={visaFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                  onChange={e => setVisaFile(e.target.files?.[0] ?? null)} />
                <div className="flex items-center gap-2">
                  <button onClick={() => visaFileRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-bold border rounded-lg bg-white hover:bg-gray-50 text-gray-700 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    {visaFile ? visaFile.name : "Choose file (PDF/image)"}
                  </button>
                  {visaFile && <button onClick={() => setVisaFile(null)} className="text-xs text-red-500 font-bold">✕</button>}
                </div>
                <p className="text-[10px] text-gray-400 italic">Or paste a direct URL:</p>
                <input value={updateForm.visaDocumentUrl}
                  onChange={e => setUpdateForm(f => ({ ...f, visaDocumentUrl: e.target.value }))}
                  placeholder="https://… or /api/uploads/visa/…"
                  className="w-full px-2 py-1.5 text-xs border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#2D3199]/30" />
              </div>

              {/* Ticket document */}
              <div className="p-3 rounded-xl bg-gray-50 border space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <Plane className="w-3.5 h-3.5 text-purple-500" /> Flight Ticket
                  </label>
                  {updateForm.ticketDocumentUrl && (
                    <a href={updateForm.ticketDocumentUrl} target="_blank" rel="noreferrer"
                      className="text-xs text-purple-600 font-bold hover:underline flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> View current
                    </a>
                  )}
                </div>
                <input ref={ticketFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                  onChange={e => setTicketFile(e.target.files?.[0] ?? null)} />
                <div className="flex items-center gap-2">
                  <button onClick={() => ticketFileRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-bold border rounded-lg bg-white hover:bg-gray-50 text-gray-700 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    {ticketFile ? ticketFile.name : "Choose file (PDF/image)"}
                  </button>
                  {ticketFile && <button onClick={() => setTicketFile(null)} className="text-xs text-red-500 font-bold">✕</button>}
                </div>
                <p className="text-[10px] text-gray-400 italic">Or paste a direct URL:</p>
                <input value={updateForm.ticketDocumentUrl}
                  onChange={e => setUpdateForm(f => ({ ...f, ticketDocumentUrl: e.target.value }))}
                  placeholder="https://… or /api/uploads/tickets/…"
                  className="w-full px-2 py-1.5 text-xs border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#2D3199]/30" />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1.5 block">Internal Notes</label>
                <textarea value={updateForm.notes}
                  onChange={e => setUpdateForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Notes for internal reference…"
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D3199]/30 resize-none" />
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => setUpdatingVisa(null)} disabled={isSaving}
                  className="flex-1 py-2.5 text-sm font-bold border rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={isSaving}
                  className="flex-1 py-2.5 text-sm font-black bg-[#2D3199] text-white rounded-xl hover:bg-[#2D3199]/90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PROVIDER DIALOG ── */}
      {providerOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setProviderOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="font-black text-gray-900">{editingProvider ? "Edit Provider" : "Add Visa Provider"}</h2>
              <button onClick={() => setProviderOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 text-lg">✕</button>
            </div>
            <div className="p-5 space-y-3">
              {([
                { key: "name",           label: "Company Name *",  placeholder: "e.g. VFS Global" },
                { key: "contactPerson",  label: "Contact Person",  placeholder: "Full name" },
                { key: "email",          label: "Email",           placeholder: "contact@company.com" },
                { key: "phone",          label: "Phone",           placeholder: "+234 …" },
                { key: "specialization", label: "Description",     placeholder: "Services provided…" },
              ] as const).map(f => (
                <div key={f.key}>
                  <label className="text-xs font-bold text-gray-700 mb-1 block">{f.label}</label>
                  <input value={providerForm[f.key]}
                    onChange={e => setProviderForm(pf => ({ ...pf, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D3199]/30 focus:border-[#2D3199]" />
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button onClick={() => setProviderOpen(false)}
                  className="flex-1 py-2 text-sm font-bold border rounded-xl text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={() => saveProviderMutation.mutate(providerForm)}
                  disabled={saveProviderMutation.isPending || !providerForm.name.trim()}
                  className="flex-1 py-2 text-sm font-black bg-[#2D3199] text-white rounded-xl hover:bg-[#2D3199]/90 disabled:opacity-50">
                  {saveProviderMutation.isPending ? "Saving…" : "Save Provider"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
