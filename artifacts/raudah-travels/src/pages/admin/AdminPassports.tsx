import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download, FileText, Search, User, AlertTriangle, CheckCircle2,
  Clock, Shield, Filter, X, ChevronLeft, ChevronRight, FileImage,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface PassportEntry {
  id: string;
  reference: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  passportNumber?: string;
  passportExpiry?: string;
  hasPassportDoc: boolean;
  hasProfilePhoto: boolean;
  package?: { name: string; type: string } | null;
  agentId?: string;
  registeredByStaffId?: string;
  status: string;
  createdAt: string;
}

interface StatsData {
  total: number;
  hasDocs: number;
  missing: number;
  critical: number;
  expired: number;
}

type ExpiryState = "expired" | "critical" | "ok" | "none";

function getExpiryState(expiry?: string): ExpiryState {
  if (!expiry) return "none";
  const d = new Date(expiry);
  const now = new Date();
  if (d < now) return "expired";
  const soon = new Date();
  soon.setMonth(soon.getMonth() + 3);
  if (d <= soon) return "critical";
  return "ok";
}

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const EXPIRY_CONFIG: Record<ExpiryState, { border: string; badge: string; label: string; icon: typeof Shield }> = {
  expired:  { border: "border-red-300",    badge: "bg-red-100 text-red-700 border-red-200",           label: "Expired",       icon: AlertTriangle },
  critical: { border: "border-orange-200", badge: "bg-orange-100 text-orange-700 border-orange-200", label: "Expiring Soon", icon: Clock },
  ok:       { border: "border-[#DCE3F0]",  badge: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Valid",       icon: Shield },
  none:     { border: "border-[#DCE3F0]",  badge: "bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]",    label: "No Date",       icon: FileText },
};

function PassportCard({
  pilgrim, selected, onToggle, onDownload, downloading,
}: {
  pilgrim: PassportEntry;
  selected: boolean;
  onToggle: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  const state = getExpiryState(pilgrim.passportExpiry);
  const cfg   = EXPIRY_CONFIG[state];
  const ExpiryIcon = cfg.icon;
  const name = pilgrim.fullName || [pilgrim.firstName, pilgrim.lastName].filter(Boolean).join(" ") || "Unknown";

  return (
    <div className={`rounded-2xl border-2 ${cfg.border} bg-white overflow-hidden transition-all ${selected ? "ring-2 ring-[#2D3199] ring-offset-2 shadow-lg" : "shadow-sm hover:shadow"}`}>

      {/* Document preview area */}
      <div className="relative h-40 bg-[#F8FAFC]">
        {pilgrim.hasPassportDoc ? (
          <div className="h-full flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-[#EEF0FF] flex items-center justify-center">
              <FileImage className="w-6 h-6 text-[#2D3199]" />
            </div>
            <span className="text-xs text-[#2D3199] font-semibold">Document Uploaded</span>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center">
              <User className="w-6 h-6 text-[#CBD5E1]" />
            </div>
            <span className="text-[11px] text-[#94A3B8]">No document uploaded</span>
          </div>
        )}

        {/* Profile photo indicator */}
        {pilgrim.hasProfilePhoto && (
          <div className="absolute top-2 right-2 w-9 h-9 rounded-lg border-2 border-white shadow bg-[#EEF0FF] flex items-center justify-center">
            <User className="w-4 h-4 text-[#2D3199]" />
          </div>
        )}

        {/* Checkbox */}
        <button
          onClick={onToggle}
          className={`absolute top-2 left-2 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
            selected ? "bg-[#2D3199] border-[#2D3199]" : "bg-white/80 border-[#DCE3F0] hover:border-[#2D3199]"
          }`}
        >
          {selected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
        </button>

        {/* Download button (only if has document) */}
        {pilgrim.hasPassportDoc && (
          <button
            onClick={onDownload}
            disabled={downloading}
            className="absolute bottom-2 right-2 w-7 h-7 rounded-lg bg-white/90 hover:bg-white border border-[#DCE3F0] flex items-center justify-center shadow-sm hover:shadow transition-all disabled:opacity-50"
            title="Download passport"
          >
            {downloading
              ? <span className="w-3.5 h-3.5 border-2 border-[#2D3199] border-t-transparent rounded-full animate-spin" />
              : <Download className="w-3.5 h-3.5 text-[#2D3199]" />
            }
          </button>
        )}
      </div>

      {/* Info section */}
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-[#0F172A] text-sm leading-tight truncate">{name}</p>
            <p className="text-[10px] text-[#94A3B8] font-mono mt-0.5">{pilgrim.passportNumber || "No passport number"}</p>
          </div>
          <span className={`flex items-center gap-1 text-[10px] border px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap ${cfg.badge}`}>
            <ExpiryIcon className="w-2.5 h-2.5" />
            {cfg.label}
          </span>
        </div>

        {pilgrim.package && (
          <p className="text-xs text-[#64748B] truncate">{pilgrim.package.name}</p>
        )}

        <div className="flex items-center justify-between">
          <p className={`text-xs font-semibold ${state === "expired" ? "text-red-600" : state === "critical" ? "text-orange-600" : "text-[#64748B]"}`}>
            {pilgrim.passportExpiry ? `Exp: ${fmtDate(pilgrim.passportExpiry)}` : "No expiry date"}
          </p>
          {pilgrim.agentId && (
            <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-100 px-1.5 py-0.5 rounded-full font-bold">Agent</span>
          )}
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 24;
const FILTER_ALL = "all";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function AdminPassports() {
  const { toast } = useToast();
  const [search, setSearch]             = useState("");
  const [filterType, setFilterType]     = useState(FILTER_ALL);
  const [filterExpiry, setFilterExpiry] = useState(FILTER_ALL);
  const [filterDocs, setFilterDocs]     = useState(FILTER_ALL);
  const [filterSource, setFilterSource] = useState(FILTER_ALL);
  const [filterStaff, setFilterStaff]   = useState(FILTER_ALL);
  const [filterAgent, setFilterAgent]   = useState(FILTER_ALL);
  const [page, setPage]                 = useState(1);
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [downloadingId, setDownloadingId]     = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 400);

  // Fetch staff and agent lists for filter dropdowns
  const { data: staffData } = useQuery<{ staff: { id: string; fullName: string }[] }>({
    queryKey: ["admin-staff-list"],
    queryFn: () => fetch("/api/admin/staff", { credentials: "include" }).then(r => r.json()),
    staleTime: 120_000,
  });
  const { data: agentData } = useQuery<{ agents: { id: string; businessName: string; user?: { fullName?: string } | null }[] }>({
    queryKey: ["admin-agent-list"],
    queryFn: () => fetch("/api/agents?limit=200", { credentials: "include" }).then(r => r.json()),
    staleTime: 120_000,
  });
  const staffList = staffData?.staff ?? [];
  const agentList = agentData?.agents ?? [];

  const hasFilters = search || filterType !== FILTER_ALL || filterExpiry !== FILTER_ALL || filterDocs !== FILTER_ALL || filterSource !== FILTER_ALL || filterStaff !== FILTER_ALL || filterAgent !== FILTER_ALL;

  const filterParams = useMemo(() => {
    const p: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
    if (debouncedSearch)              p.search              = debouncedSearch;
    if (filterType !== FILTER_ALL)    p.filterType          = filterType;
    if (filterExpiry !== FILTER_ALL)  p.filterExpiry        = filterExpiry;
    if (filterDocs !== FILTER_ALL)    p.filterDocs          = filterDocs;
    if (filterSource !== FILTER_ALL)  p.filterSource        = filterSource;
    if (filterStaff !== FILTER_ALL)   p.registeredByStaffId = filterStaff;
    if (filterAgent !== FILTER_ALL)   p.agentId             = filterAgent;
    return p;
  }, [page, debouncedSearch, filterType, filterExpiry, filterDocs, filterSource, filterStaff, filterAgent]);

  const { data, isLoading } = useQuery<{ passports: PassportEntry[]; total: number; totalPages: number }>({
    queryKey: ["admin-passports", filterParams],
    queryFn: () => fetch(`/api/admin/passports?${new URLSearchParams(filterParams)}`).then(r => r.json()),
    staleTime: 30_000,
    placeholderData: prev => prev,
  });

  const { data: stats } = useQuery<StatsData>({
    queryKey: ["admin-passport-stats"],
    queryFn: () => fetch("/api/admin/passports/stats").then(r => r.json()),
    staleTime: 60_000,
  });

  const passports   = data?.passports   ?? [];
  const total       = data?.total       ?? 0;
  const totalPages  = data?.totalPages  ?? 1;

  const toggleSelect = (id: string) => setSelected(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const allPageSelected = passports.length > 0 && passports.every(p => selected.has(p.id));
  const togglePage = () => setSelected(allPageSelected
    ? new Set([...selected].filter(id => !passports.find(p => p.id === id)))
    : new Set([...selected, ...passports.map(p => p.id)]),
  );

  const downloadFile = useCallback(async (id: string, reference: string, silent = false) => {
    const r = await fetch(`/api/admin/passports/${id}/file`, { credentials: "include" });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      if (!silent) toast({ title: "Download failed", description: (body as any).error || "Could not fetch document", variant: "destructive" });
      return null;
    }

    const contentType = r.headers.get("content-type") || "";

    // Binary response (proxied external file) — use blob download
    if (!contentType.includes("application/json")) {
      const blob = await r.blob();
      const ext = contentType.includes("pdf") ? "pdf" : "jpg";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `passport-${reference}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return url;
    }

    // JSON response (data URL stored in DB)
    const { passportCopyUrl } = await r.json();
    const isPdf = passportCopyUrl.startsWith("data:application/pdf");
    const ext   = isPdf ? "pdf" : "jpg";
    const a     = document.createElement("a");
    a.href     = passportCopyUrl;
    a.download = `passport-${reference}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return passportCopyUrl;
  }, [toast]);

  const handleSingleDownload = useCallback(async (id: string, reference: string) => {
    setDownloadingId(id);
    await downloadFile(id, reference);
    setDownloadingId(null);
  }, [downloadFile]);

  const handleBulkDownload = useCallback(async () => {
    const toDownload = passports.filter(p => selected.has(p.id) && p.hasPassportDoc);
    if (toDownload.length === 0) {
      toast({ title: "No documents to download", description: "Selected pilgrims have no passport documents" });
      return;
    }
    setBulkDownloading(true);
    for (const p of toDownload) {
      await downloadFile(p.id, p.reference, true);
      await new Promise(r => setTimeout(r, 400));
    }
    setBulkDownloading(false);
    toast({ title: `${toDownload.length} passport${toDownload.length > 1 ? "s" : ""} downloaded` });
  }, [passports, selected, downloadFile, toast]);

  const clearFilters = () => {
    setSearch(""); setFilterType(FILTER_ALL); setFilterExpiry(FILTER_ALL);
    setFilterDocs(FILTER_ALL); setFilterSource(FILTER_ALL);
    setFilterStaff(FILTER_ALL); setFilterAgent(FILTER_ALL); setPage(1);
  };

  useEffect(() => { setPage(1); }, [debouncedSearch, filterType, filterExpiry, filterDocs, filterSource, filterStaff, filterAgent]);

  const selectedWithDocs = passports.filter(p => selected.has(p.id) && p.hasPassportDoc).length;

  return (
    <div className="space-y-6" data-testid="page-admin-passports">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-[#2D3199] text-xs font-bold uppercase tracking-widest mb-1">Documents</p>
          <h1 className="text-2xl font-black text-[#0F172A]">Passports</h1>
          <p className="text-[#64748B] text-sm mt-0.5">All uploaded passport documents across all registrations</p>
        </div>
        {selected.size > 0 && (
          <Button onClick={handleBulkDownload} disabled={bulkDownloading || selectedWithDocs === 0}
            className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl gap-2">
            <Download className="w-4 h-4" />
            {bulkDownloading ? "Downloading…" : `Download ${selectedWithDocs} Doc${selectedWithDocs !== 1 ? "s" : ""}`}
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total Pilgrims", value: stats?.total    ?? "—", color: "text-[#2D3199]" },
          { label: "With Document",  value: stats?.hasDocs  ?? "—", color: "text-emerald-600" },
          { label: "Missing Doc",    value: stats?.missing  ?? "—", color: "text-[#64748B]" },
          { label: "Expiring Soon",  value: stats?.critical ?? "—", color: "text-orange-600" },
          { label: "Expired",        value: stats?.expired  ?? "—", color: "text-red-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-[#DCE3F0] p-3 text-center">
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-[#DCE3F0] shadow-sm p-4 space-y-3">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Name, passport no., reference…"
              className="pl-9 rounded-xl border-[#DCE3F0]" />
          </div>
          <Select value={filterType} onValueChange={v => { setFilterType(v); setPage(1); }}>
            <SelectTrigger className="w-36 rounded-xl border-[#DCE3F0]"><SelectValue placeholder="All Types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>All Types</SelectItem>
              <SelectItem value="hajj">Hajj</SelectItem>
              <SelectItem value="umrah">Umrah</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterExpiry} onValueChange={v => { setFilterExpiry(v); setPage(1); }}>
            <SelectTrigger className="w-40 rounded-xl border-[#DCE3F0]"><SelectValue placeholder="All Expiries" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>All Expiries</SelectItem>
              <SelectItem value="ok">Valid</SelectItem>
              <SelectItem value="critical">Expiring ≤ 3 months</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterDocs} onValueChange={v => { setFilterDocs(v); setPage(1); }}>
            <SelectTrigger className="w-44 rounded-xl border-[#DCE3F0]"><SelectValue placeholder="All Docs" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>All Pilgrims</SelectItem>
              <SelectItem value="with_doc">Has Passport Doc</SelectItem>
              <SelectItem value="without_doc">Missing Doc</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterSource} onValueChange={v => { setFilterSource(v); setPage(1); }}>
            <SelectTrigger className="w-40 rounded-xl border-[#DCE3F0]"><SelectValue placeholder="All Sources" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>All Sources</SelectItem>
              <SelectItem value="agent">Agent-Registered</SelectItem>
              <SelectItem value="direct">Direct / Online</SelectItem>
            </SelectContent>
          </Select>
          {staffList.length > 0 && (
            <Select value={filterStaff} onValueChange={v => { setFilterStaff(v); setPage(1); }}>
              <SelectTrigger className="w-44 rounded-xl border-[#DCE3F0]"><SelectValue placeholder="All Staff" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>All Staff</SelectItem>
                {staffList.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.fullName || "Unnamed"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {agentList.length > 0 && (
            <Select value={filterAgent} onValueChange={v => { setFilterAgent(v); setPage(1); }}>
              <SelectTrigger className="w-44 rounded-xl border-[#DCE3F0]"><SelectValue placeholder="All Agents" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>All Agents</SelectItem>
                {agentList.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.businessName || a.user?.fullName || "Unnamed"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {hasFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#64748B] border border-[#DCE3F0] rounded-xl hover:bg-[#F8F9FF] transition-all">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        {/* Select row */}
        <div className="flex items-center justify-between pt-1 border-t border-[#F1F5F9]">
          <button onClick={togglePage}
            className="flex items-center gap-2 text-xs font-semibold text-[#64748B] hover:text-[#2D3199] transition-colors">
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${allPageSelected ? "bg-[#2D3199] border-[#2D3199]" : "border-[#CBD5E1] hover:border-[#2D3199]"}`}>
              {allPageSelected && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
            </div>
            {allPageSelected ? "Deselect Page" : "Select Page"}
          </button>
          <span className="text-xs text-[#94A3B8]">
            {total.toLocaleString()} total
            {selected.size > 0 && ` · ${selected.size} selected`}
          </span>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(PAGE_SIZE)].map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      ) : passports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#DCE3F0] p-16 text-center">
          <FileText className="w-10 h-10 text-[#CBD5E1] mx-auto mb-3" />
          <p className="font-bold text-[#64748B]">No passport documents found</p>
          <p className="text-xs text-[#94A3B8] mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {passports.map(p => (
            <PassportCard
              key={p.id}
              pilgrim={p}
              selected={selected.has(p.id)}
              onToggle={() => toggleSelect(p.id)}
              onDownload={() => handleSingleDownload(p.id, p.reference)}
              downloading={downloadingId === p.id}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-2xl border border-[#DCE3F0] px-5 py-3">
          <p className="text-sm text-[#64748B]">
            Page <span className="font-bold text-[#0F172A]">{page}</span> of <span className="font-bold text-[#0F172A]">{totalPages}</span>
            <span className="ml-2 text-xs">({total.toLocaleString()} total records)</span>
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="rounded-xl border-[#DCE3F0] gap-1">
              <ChevronLeft className="w-4 h-4" /> Prev
            </Button>
            {/* Page number pills */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p: number;
                if (totalPages <= 5) p = i + 1;
                else if (page <= 3) p = i + 1;
                else if (page >= totalPages - 2) p = totalPages - 4 + i;
                else p = page - 2 + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${page === p ? "bg-[#2D3199] text-white" : "text-[#64748B] hover:bg-[#F0F2FF]"}`}>
                    {p}
                  </button>
                );
              })}
            </div>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="rounded-xl border-[#DCE3F0] gap-1">
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
