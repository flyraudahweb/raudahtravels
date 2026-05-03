import { useQuery } from "@tanstack/react-query";
import React from "react";
import { ShieldCheck, FileText, Plane, Loader2, Clock, CheckCircle, XCircle, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AgentVisaRecord {
  id: string;
  status: string;
  visaNumber?: string;
  visaDocumentUrl?: string;
  ticketDocumentUrl?: string;
  createdAt: string;
  bookingRef?: string;
  fullName?: string;
  packageName?: string;
}

const STATUS_CFG: Record<string, { label: string; pill: string; dot: string; icon: typeof Clock }> = {
  pending:   { label: "Pending",   pill: "bg-amber-100 text-amber-700 border border-amber-200",    dot: "bg-amber-400",   icon: Clock },
  submitted: { label: "Submitted", pill: "bg-blue-100 text-blue-700 border border-blue-200",        dot: "bg-blue-500",    icon: Loader2 },
  approved:  { label: "Approved",  pill: "bg-emerald-100 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500", icon: CheckCircle },
  rejected:  { label: "Rejected",  pill: "bg-red-100 text-red-700 border border-red-200",           dot: "bg-red-400",     icon: XCircle },
};

const STAT_CARDS = [
  { key: "pending",   label: "Pending",   gradient: "from-amber-500 to-orange-500" },
  { key: "submitted", label: "Submitted", gradient: "from-[#2D3199] to-[#4C56B8]" },
  { key: "approved",  label: "Approved",  gradient: "from-emerald-500 to-teal-600" },
  { key: "rejected",  label: "Rejected",  gradient: "from-red-500 to-rose-600" },
] as const;

export default function AgentVisas() {
  const [page, setPage] = React.useState(1);
  const pageSize = 20;

  const { data, isLoading } = useQuery<{ visas: AgentVisaRecord[] }>({
    queryKey: ["agent-visas", page],
    queryFn: () => {
      const offset = (page - 1) * pageSize;
      return fetch(`/api/agent/visas?limit=${pageSize}&offset=${offset}`, { credentials: "include" }).then(r => r.json());
    },
  });

  const visas = data?.visas ?? [];
  const total = visas.length;
  const totalPages = Math.ceil(total / pageSize);
  const counts = STAT_CARDS.reduce((acc, s) => {
    acc[s.key] = visas.filter(v => v.status === s.key).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6" data-testid="page-agent-visas">
      {/* Header */}
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2D3199]/60 mb-1">AGENT PORTAL</p>
        <h1 className="text-3xl font-black text-[#1C1F66] tracking-tight">Client Visa Status</h1>
        <p className="text-[#64748B] text-sm mt-1">Track visa and flight document status for all your clients</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STAT_CARDS.map(s => (
          <div key={s.key} className={`relative overflow-hidden rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br ${s.gradient}`}>
            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/10" />
            <div className="absolute -bottom-6 -right-2 w-24 h-24 rounded-full bg-white/5" />
            <div className="relative">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/70 mb-2">{s.label}</p>
              <p className="text-3xl font-black tabular-nums">{counts[s.key] ?? 0}</p>
              <div className="flex items-center gap-1 mt-2">
                <ArrowUpRight className="w-3 h-3 text-white/70" />
                <p className="text-[10px] text-white/70 font-semibold">Applications</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#2D3199]" />
            <p className="text-sm text-[#94A3B8] font-semibold">Loading visa records…</p>
          </div>
        </div>
      ) : visas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center mb-4">
            <ShieldCheck className="w-7 h-7 text-[#CBD5E1]" />
          </div>
          <p className="font-black text-[#94A3B8] text-base">No visa applications yet</p>
          <p className="text-sm text-[#CBD5E1] mt-1 max-w-xs">Visa applications will appear here once bookings are confirmed.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#F1F5F9]">
            <h2 className="font-black text-[#1C1F66] text-sm">All Visa Applications</h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">{visas.length} total application{visas.length !== 1 ? "s" : ""}</p>
          </div>
          {/* Cards on mobile, table on desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-[#F8FAFC]">
                  {["#", "Pilgrim", "Package", "Ref", "Status", "Visa #", "Documents"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visas.map((visa, i) => {
                  const meta = STATUS_CFG[visa.status] ?? STATUS_CFG.pending;
                  const Icon = meta.icon;
                  return (
                    <tr key={visa.id} className="border-b border-[#F1F5F9] hover:bg-[#FAFBFF] transition-colors">
                      <td className="px-4 py-4 text-xs text-[#CBD5E1] font-black tabular-nums">{i + 1}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2D3199] to-[#4C56B8] flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-black text-white">{(visa.fullName || "?").charAt(0)}</span>
                          </div>
                          <p className="font-black text-[#1C1F66] text-sm">{visa.fullName || "—"}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs text-[#64748B] max-w-[140px] truncate font-semibold">{visa.packageName || "—"}</td>
                      <td className="px-4 py-4 font-mono text-xs text-[#94A3B8]">{visa.bookingRef || "—"}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border ${meta.pill}`}>
                          <Icon className={`w-3 h-3 ${visa.status === "submitted" ? "animate-spin" : ""}`} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-[#64748B]">
                        {visa.visaNumber || <span className="text-[#E2E8F0]">—</span>}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {visa.visaDocumentUrl ? (
                            <a href={visa.visaDocumentUrl} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-[#EEF0FF] text-[#2D3199] hover:bg-[#2D3199] hover:text-white transition-colors">
                              <FileText className="w-3 h-3" /> Visa
                            </a>
                          ) : null}
                          {visa.ticketDocumentUrl ? (
                            <a href={visa.ticketDocumentUrl} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white transition-colors">
                              <Plane className="w-3 h-3" /> Ticket
                            </a>
                          ) : null}
                          {!visa.visaDocumentUrl && !visa.ticketDocumentUrl && (
                            <span className="text-[10px] text-[#CBD5E1] font-semibold">Awaiting upload</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-[#F1F5F9] flex items-center justify-between bg-[#FAFBFF]">
              <p className="text-xs text-[#64748B] font-semibold">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="rounded-lg border-[#E2E8F0] text-[#64748B] h-8">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="rounded-lg border-[#E2E8F0] text-[#64748B] h-8">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-[#F1F5F9]">
            {visas.map((visa) => {
              const meta = STATUS_CFG[visa.status] ?? STATUS_CFG.pending;
              const Icon = meta.icon;
              return (
                <div key={visa.id} className="px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2D3199] to-[#4C56B8] flex items-center justify-center">
                        <span className="text-xs font-black text-white">{(visa.fullName || "?").charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-black text-[#1C1F66] text-sm">{visa.fullName || "—"}</p>
                        <p className="text-xs text-[#94A3B8]">{visa.packageName || "—"}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border ${meta.pill}`}>
                      <Icon className={`w-3 h-3 ${visa.status === "submitted" ? "animate-spin" : ""}`} />
                      {meta.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#94A3B8] font-mono">{visa.bookingRef || "—"}</p>
                    <div className="flex items-center gap-2">
                      {visa.visaDocumentUrl && (
                        <a href={visa.visaDocumentUrl} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black bg-[#EEF0FF] text-[#2D3199]">
                          <FileText className="w-3 h-3" /> Visa
                        </a>
                      )}
                      {visa.ticketDocumentUrl && (
                        <a href={visa.ticketDocumentUrl} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black bg-purple-50 text-purple-700">
                          <Plane className="w-3 h-3" /> Ticket
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
