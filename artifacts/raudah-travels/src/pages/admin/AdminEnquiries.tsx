import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, MessageCircle, Trash2, Eye, Clock, CheckCircle2, Inbox, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Msg = {
  id: string; name: string; email: string | null; phone: string | null;
  subject: string; message: string; status: string;
  createdAt: string; readAt: string | null; notes: string | null;
};

async function fetchEnquiries(status?: string): Promise<{ messages: Msg[] }> {
  const url = status ? `/api/admin/enquiries?status=${status}` : "/api/admin/enquiries";
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

const STATUS_COLORS: Record<string, string> = {
  unread:   "bg-[#FF3B00]/10 text-[#FF3B00] border-[#FF3B00]/20",
  read:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  archived: "bg-[#F1F5F9] text-[#64748B] border-[#DCE3F0]",
};

export default function AdminEnquiries() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread" | "read" | "archived">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Msg | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-enquiries", filter === "all" ? undefined : filter],
    queryFn: () => fetchEnquiries(filter === "all" ? undefined : filter),
    refetchInterval: 30000,
  });

  const markStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/admin/enquiries/${id}/status`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-enquiries"] });
      toast({ title: "Updated" });
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/enquiries/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-enquiries"] });
      setSelected(null);
      toast({ title: "Deleted" });
    },
  });

  const messages = (data?.messages || []).filter(m => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.subject.toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q);
  });

  const unreadCount = data?.messages.filter(m => m.status === "unread").length ?? 0;

  const handleOpen = (msg: Msg) => {
    setSelected(msg);
    if (msg.status === "unread") markStatus.mutate({ id: msg.id, status: "read" });
  };

  return (
    <div className="space-y-6" data-testid="page-admin-enquiries">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[#2D3199] text-xs font-bold uppercase tracking-widest mb-1">Inbox</p>
          <h1 className="text-2xl font-black text-[#0F172A] flex items-center gap-2">
            Contact Enquiries
            {unreadCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#FF3B00] text-white text-xs font-black">{unreadCount}</span>
            )}
          </h1>
          <p className="text-[#64748B] text-sm mt-0.5">Messages sent via the public contact form</p>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2">
          {(["all", "unread", "read", "archived"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${filter === f ? "bg-[#2D3199] text-white" : "bg-white border border-[#DCE3F0] text-[#64748B] hover:border-[#2D3199]/30"}`}>
              {f}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search messages…"
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#DCE3F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#2D3199] focus:ring-2 focus:ring-[#2D3199]/10" />
        </div>
      </div>

      {/* Message list */}
      <div className="bg-white rounded-2xl border border-[#DCE3F0] overflow-hidden">
        {isLoading ? (
          <div className="space-y-0 divide-y divide-[#F1F5F9]">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 animate-pulse bg-[#F8FAFC]" />)}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#94A3B8]">
            <Inbox className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-bold">No messages found</p>
            <p className="text-sm mt-1">
              {filter !== "all" ? `No ${filter} messages` : "Contact form submissions will appear here"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {messages.map(msg => (
              <div key={msg.id}
                onClick={() => handleOpen(msg)}
                className={`flex items-start gap-4 px-6 py-4 cursor-pointer hover:bg-[#F8FAFC] transition-colors ${msg.status === "unread" ? "bg-[#FAFBFF]" : ""}`}>
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${msg.status === "unread" ? "bg-[#EEF0FF]" : "bg-[#F1F5F9]"}`}>
                  <Mail className={`w-4 h-4 ${msg.status === "unread" ? "text-[#2D3199]" : "text-[#94A3B8]"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-black text-sm ${msg.status === "unread" ? "text-[#0F172A]" : "text-[#334155]"}`}>{msg.name}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold capitalize ${STATUS_COLORS[msg.status] || STATUS_COLORS.read}`}>{msg.status}</span>
                    </div>
                    <span className="text-[10px] text-[#94A3B8] shrink-0 font-medium">
                      {new Date(msg.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <p className={`text-xs mt-0.5 ${msg.status === "unread" ? "font-bold text-[#2D3199]" : "text-[#64748B]"}`}>{msg.subject}</p>
                  <p className="text-xs text-[#94A3B8] truncate mt-0.5">{msg.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-w-lg rounded-3xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-left font-black text-[#0F172A]">
              {selected?.subject || "Enquiry"}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              {/* Sender info */}
              <div className="bg-[#F8FAFC] rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-[#EEF0FF] flex items-center justify-center shrink-0 font-black text-[#2D3199] text-sm">
                    {selected.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-black text-[#0F172A] text-sm">{selected.name}</p>
                    <p className="text-xs text-[#94A3B8]">
                      {new Date(selected.createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 pt-1">
                  {selected.email && (
                    <a href={`mailto:${selected.email}`} className="inline-flex items-center gap-1.5 text-xs text-[#2D3199] font-semibold hover:underline">
                      <Mail className="w-3 h-3" /> {selected.email}
                    </a>
                  )}
                  {selected.phone && (
                    <a href={`tel:${selected.phone}`} className="inline-flex items-center gap-1.5 text-xs text-[#64748B] font-semibold hover:underline">
                      <Phone className="w-3 h-3" /> {selected.phone}
                    </a>
                  )}
                </div>
              </div>

              {/* Message */}
              <div>
                <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest mb-2">Message</p>
                <div className="bg-white border border-[#DCE3F0] rounded-2xl p-4 text-sm text-[#0F172A] leading-relaxed whitespace-pre-wrap">
                  {selected.message}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-1">
                {selected.email && (
                  <Button asChild size="sm" className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl gap-1.5 text-xs">
                    <a href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject)}`}>
                      <Mail className="w-3.5 h-3.5" /> Reply via Email
                    </a>
                  </Button>
                )}
                {selected.phone && (
                  <Button asChild size="sm" variant="outline" className="rounded-xl gap-1.5 text-xs border-[#DCE3F0] text-[#25D366]">
                    <a href={`https://wa.me/${selected.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </a>
                  </Button>
                )}
                {selected.status !== "archived" && (
                  <Button size="sm" variant="outline" onClick={() => markStatus.mutate({ id: selected.id, status: "archived" })}
                    className="rounded-xl gap-1.5 text-xs border-[#DCE3F0] text-[#64748B]" disabled={markStatus.isPending}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Archive
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => del.mutate(selected.id)}
                  className="rounded-xl gap-1.5 text-xs border-red-200 text-red-500 hover:bg-red-50 ml-auto" disabled={del.isPending}>
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
