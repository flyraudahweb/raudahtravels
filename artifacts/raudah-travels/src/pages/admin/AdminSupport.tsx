import { useState, useCallback } from "react";
import {
  useListSupportTickets, getListSupportTicketsQueryKey,
  useGetSupportTicket, getGetSupportTicketQueryKey,
  useSendSupportMessage, useUpdateSupportTicket,
} from "@workspace/api-client-react";
import type { SupportTicketDetail, SupportMessage } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare, ChevronLeft, Send, CheckCircle, ChevronRight,
  Zap, AlertTriangle, Info, Minus, User, Tag, Search, ChevronDown,
  Mail, Phone, X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const CATEGORY_LABELS: Record<string, string> = {
  general_inquiry: "General Inquiry",
  booking_issues: "Booking Issues",
  payment_issues: "Payment Issues",
  document_problems: "Document Problems",
  technical_support: "Technical Support",
  pilgrim_booking_assistance: "Booking Assistance",
  visa_processing: "Visa Processing",
  flights_transport: "Flights & Transport",
  agent_commissions: "Agent Commissions",
};

const CATEGORY_COLORS: Record<string, string> = {
  general_inquiry: "bg-blue-50 text-blue-700 border-blue-200",
  booking_issues: "bg-amber-50 text-amber-700 border-amber-200",
  payment_issues: "bg-orange-50 text-orange-700 border-orange-200",
  document_problems: "bg-red-50 text-red-700 border-red-200",
  technical_support: "bg-slate-50 text-slate-700 border-slate-200",
  pilgrim_booking_assistance: "bg-teal-50 text-teal-700 border-teal-200",
  visa_processing: "bg-purple-50 text-purple-700 border-purple-200",
  flights_transport: "bg-sky-50 text-sky-700 border-sky-200",
  agent_commissions: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  open:        { label: "Open",        bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  in_progress: { label: "In Progress", bg: "bg-blue-50",    text: "text-blue-700",   border: "border-blue-200" },
  resolved:    { label: "Resolved",    bg: "bg-gray-100",   text: "text-gray-500",   border: "border-gray-200" },
  closed:      { label: "Closed",      bg: "bg-gray-100",   text: "text-gray-400",   border: "border-gray-200" },
};

const PRIORITY_CONFIG: Record<string, { icon: typeof Zap; color: string; bg: string }> = {
  urgent: { icon: Zap,           color: "text-red-600",    bg: "bg-red-50 border-red-200" },
  high:   { icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
  medium: { icon: Info,          color: "text-blue-600",   bg: "bg-blue-50 border-blue-200" },
  normal: { icon: Info,          color: "text-blue-600",   bg: "bg-blue-50 border-blue-200" },
  low:    { icon: Minus,         color: "text-gray-500",   bg: "bg-gray-50 border-gray-200" },
};

const PAGE_SIZE = 20;

function TicketView({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: ticket, isLoading } = useGetSupportTicket(ticketId, {
    query: { queryKey: getGetSupportTicketQueryKey(ticketId), refetchInterval: 15_000 },
  });
  const sendMessage = useSendSupportMessage();
  const updateTicket = useUpdateSupportTicket();
  const [reply, setReply] = useState("");

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    sendMessage.mutate({ id: ticketId, data: { message: reply } }, {
      onSuccess: () => { setReply(""); qc.invalidateQueries({ queryKey: getGetSupportTicketQueryKey(ticketId) }); },
      onError: () => toast({ title: "Send failed", variant: "destructive" }),
    });
  };

  const handleResolve = () => {
    updateTicket.mutate({ id: ticketId, data: { status: "resolved" } }, {
      onSuccess: () => {
        toast({ title: "Ticket resolved" });
        qc.invalidateQueries({ queryKey: getListSupportTicketsQueryKey({}) });
        onBack();
      },
      onError: () => toast({ title: "Could not resolve ticket", variant: "destructive" }),
    });
  };

  if (isLoading) return (
    <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
  );
  if (!ticket) return <p className="text-[#94A3B8] text-center py-12">Ticket not found.</p>;

  const messages: SupportMessage[] = (ticket as SupportTicketDetail).messages || [];
  const sc = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
  const pc = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;
  const PriorityIcon = pc.icon;
  const catLabel = CATEGORY_LABELS[(ticket as any).category || ""] || (ticket as any).category;
  const catColor = CATEGORY_COLORS[(ticket as any).category || ""] || "bg-gray-50 text-gray-600 border-gray-200";
  const assignedStaff = (ticket as any).assignedStaff || (ticket as any).assignedToName;
  const userName = (ticket as any).userName;
  const userEmail = (ticket as any).userEmail;
  const userPhone = (ticket as any).userPhone;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-[#64748B] hover:text-[#2D3199] transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to Tickets
        </button>
        {ticket.status !== "resolved" && (
          <button onClick={handleResolve} disabled={updateTicket.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
            <CheckCircle className="w-4 h-4" /> Mark Resolved
          </button>
        )}
      </div>

      {/* Contact info card */}
      {(userName || userEmail || userPhone) && (
        <div className="bg-[#F8F9FF] border border-[#DCE3F0] rounded-2xl px-5 py-4 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#2D3199] flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Pilgrim</p>
              <p className="font-bold text-[#0F172A] text-sm">{userName || "Unknown"}</p>
            </div>
          </div>
          {userEmail && (
            <a href={`mailto:${userEmail}`} className="flex items-center gap-2 text-sm text-[#2D3199] hover:underline">
              <Mail className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate max-w-[200px]">{userEmail}</span>
            </a>
          )}
          {userPhone && (
            <a href={`tel:${userPhone}`} className="flex items-center gap-2 text-sm text-[#2D3199] hover:underline">
              <Phone className="w-3.5 h-3.5 shrink-0" />
              {userPhone}
            </a>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[#DCE3F0] shadow-[0_2px_16px_rgba(45,49,153,0.06)] overflow-hidden">
        <div className="bg-gradient-to-r from-[#2D3199] to-[#4C56B8] px-6 py-4">
          <h2 className="font-black text-white text-base">{ticket.subject}</h2>
          <div className="flex items-center gap-2.5 mt-2 flex-wrap">
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${sc.bg} ${sc.text} ${sc.border}`}>{sc.label}</span>
            <span className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-bold border capitalize ${pc.bg} ${pc.color}`}>
              <PriorityIcon className="w-3 h-3" /> {ticket.priority}
            </span>
            {catLabel && <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${catColor}`}>{catLabel}</span>}
            <span className="text-white/60 text-xs">{new Date(ticket.createdAt).toLocaleDateString("en-GB")}</span>
          </div>
          {assignedStaff && (
            <div className="flex items-center gap-1.5 mt-2.5">
              <User className="w-3 h-3 text-white/60" />
              <span className="text-white/70 text-xs">Assigned to <span className="text-white font-bold">{assignedStaff}</span></span>
            </div>
          )}
        </div>

        <div className="p-5">
          <ScrollArea className="h-72 pr-2 mb-4">
            <div className="space-y-3">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <MessageSquare className="w-8 h-8 text-[#94A3B8]/50 mb-2" />
                  <p className="text-[#94A3B8] text-sm">No messages yet</p>
                </div>
              ) : messages.map(msg => {
                const isAdmin = (msg as any).senderRole === "admin" || (msg as any).senderRole === "super_admin" || (msg as any).senderRole === "staff" || (msg as any).isAdmin;
                return (
                  <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${isAdmin ? "bg-[#2D3199] text-white rounded-br-md" : "bg-[#F0F2FF] text-[#0F172A] rounded-bl-md"}`}>
                      {!isAdmin && <p className="text-[10px] font-bold text-[#94A3B8] mb-1">{userName || "Pilgrim"}</p>}
                      <p>{msg.message}</p>
                      <p className={`text-xs mt-1.5 ${isAdmin ? "text-white/50" : "text-[#94A3B8]"}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {ticket.status !== "resolved" && (
            <form onSubmit={handleSend} className="flex gap-2 border-t border-[#F1F5F9] pt-4">
              <input value={reply} onChange={e => setReply(e.target.value)} placeholder="Reply to pilgrim…"
                className="flex-1 bg-[#F8F9FF] border border-[#DCE3F0] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#2D3199] focus:ring-2 focus:ring-[#2D3199]/10 transition-all" />
              <button type="submit" disabled={sendMessage.isPending || !reply.trim()}
                className="w-10 h-10 rounded-xl bg-[#2D3199] hover:bg-[#25297F] flex items-center justify-center text-white transition-colors disabled:opacity-50">
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminSupport() {
  const [statusFilter, setStatusFilter] = useState("open");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const qc = useQueryClient();

  // Debounce search
  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    setPage(0);
    const t = setTimeout(() => setDebouncedSearch(val), 350);
    return () => clearTimeout(t);
  }, []);

  const params: Record<string, string> = { limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) };
  if (statusFilter !== "all") params.status = statusFilter;
  if (categoryFilter !== "all") params.category = categoryFilter;
  if (debouncedSearch) params.search = debouncedSearch;

  const { data, isLoading } = useListSupportTickets(params, {
    query: { queryKey: getListSupportTicketsQueryKey(params) },
  });

  const tickets = data?.tickets || [];
  const total = (data as any)?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const openCount = statusFilter === "open" ? tickets.length : undefined;

  if (selectedId) return <TicketView ticketId={selectedId} onBack={() => {
    setSelectedId(null);
    qc.invalidateQueries({ queryKey: getListSupportTicketsQueryKey(params) });
  }} />;

  return (
    <div className="space-y-5" data-testid="page-admin-support">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[#2D3199] text-xs font-bold uppercase tracking-widest mb-1">Help Desk</p>
          <h1 className="text-2xl font-black text-[#0F172A]">Support Tickets</h1>
          <p className="text-[#64748B] text-sm mt-0.5">
            {total > 0 ? `${total.toLocaleString()} ticket${total !== 1 ? "s" : ""} total` : "Respond to pilgrim support requests"}
          </p>
        </div>
        {statusFilter === "open" && tickets.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-[#FF3B00]/10 border border-[#FF3B00]/20 rounded-2xl">
            <div className="w-2 h-2 rounded-full bg-[#FF3B00] animate-pulse" />
            <span className="text-sm font-bold text-[#FF3B00]">{tickets.length} open</span>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
        <input
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search by subject, pilgrim name or email…"
          className="w-full bg-white border border-[#DCE3F0] rounded-2xl pl-10 pr-10 py-3 text-sm text-[#0F172A] outline-none focus:border-[#2D3199] focus:ring-2 focus:ring-[#2D3199]/10 transition-all shadow-sm"
        />
        {search && (
          <button onClick={() => handleSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg bg-[#F1F5F9] hover:bg-[#DCE3F0] flex items-center justify-center text-[#94A3B8] transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Status Filters */}
      <div className="flex gap-1.5 bg-white rounded-2xl border border-[#DCE3F0] p-1 shadow-sm w-fit">
        {[
          { value: "all", label: "All" },
          { value: "open", label: "Open" },
          { value: "in_progress", label: "In Progress" },
          { value: "resolved", label: "Resolved" },
        ].map(f => (
          <button key={f.value} onClick={() => { setStatusFilter(f.value); setPage(0); }}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all capitalize ${statusFilter === f.value ? "bg-[#2D3199] text-white shadow-sm" : "text-[#64748B] hover:text-[#2D3199]"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Category Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: "all", label: "All Categories" },
          ...Object.entries(CATEGORY_LABELS).map(([id, label]) => ({ value: id, label })),
        ].map(f => (
          <button key={f.value} onClick={() => { setCategoryFilter(f.value); setPage(0); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${categoryFilter === f.value
              ? "bg-[#2D3199] text-white border-[#2D3199]"
              : "bg-white text-[#64748B] border-[#DCE3F0] hover:border-[#2D3199] hover:text-[#2D3199]"}`}>
            {f.value !== "all" && <Tag className="w-3 h-3 inline-block mr-1 -mt-0.5" />}
            {f.label}
          </button>
        ))}
      </div>

      {/* Ticket List */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center bg-white rounded-2xl border border-dashed border-[#DCE3F0]">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
          </div>
          <p className="text-[#0F172A] font-bold mb-1">
            {debouncedSearch ? "No results found" : "All clear!"}
          </p>
          <p className="text-[#94A3B8] text-sm">
            {debouncedSearch ? `No tickets match "${debouncedSearch}"` : "No tickets in this category"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(ticket => {
            const sc = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
            const pc = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;
            const PriorityIcon = pc.icon;
            const catLabel = CATEGORY_LABELS[(ticket as any).category || ""];
            const catColor = CATEGORY_COLORS[(ticket as any).category || ""] || "bg-gray-50 text-gray-600 border-gray-200";
            const assignedStaff = (ticket as any).assignedToName;
            const userName = (ticket as any).userName;
            const unreadAdmin = (ticket as any).unreadCountAdmin;
            return (
              <div key={ticket.id}
                className="bg-white rounded-2xl border border-[#DCE3F0] shadow-[0_2px_12px_rgba(45,49,153,0.04)] p-5 cursor-pointer hover:shadow-[0_4px_20px_rgba(45,49,153,0.10)] hover:border-[#B8C0E8] transition-all flex items-center gap-4"
                onClick={() => setSelectedId(ticket.id)}>
                <div className="w-10 h-10 rounded-2xl bg-[#EEF0FF] flex items-center justify-center shrink-0 relative">
                  <MessageSquare className="w-4 h-4 text-[#2D3199]" />
                  {unreadAdmin > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#FF3B00] text-white text-[9px] font-black flex items-center justify-center">
                      {unreadAdmin > 9 ? "9+" : unreadAdmin}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-[#0F172A] truncate">{ticket.subject}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${sc.bg} ${sc.text} ${sc.border}`}>{sc.label}</span>
                    <span className={`flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-bold border capitalize ${pc.bg} ${pc.color}`}>
                      <PriorityIcon className="w-2.5 h-2.5" /> {ticket.priority}
                    </span>
                    {catLabel && <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${catColor}`}>{catLabel}</span>}
                    {userName && (
                      <span className="text-[10px] text-[#64748B] flex items-center gap-0.5 font-medium">
                        <User className="w-2.5 h-2.5" /> {userName}
                      </span>
                    )}
                    <span className="text-xs text-[#94A3B8]">{new Date(ticket.createdAt).toLocaleDateString("en-GB")}</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-xl bg-[#EEF0FF] flex items-center justify-center shrink-0">
                  <ChevronRight className="w-4 h-4 text-[#2D3199]" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-[#94A3B8] font-medium">
            Page {page + 1} of {totalPages} · {total.toLocaleString()} total
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-4 py-2 rounded-xl border border-[#DCE3F0] text-xs font-bold text-[#64748B] hover:border-[#2D3199] hover:text-[#2D3199] disabled:opacity-40 disabled:cursor-not-allowed transition-all bg-white"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-4 py-2 rounded-xl border border-[#DCE3F0] text-xs font-bold text-[#64748B] hover:border-[#2D3199] hover:text-[#2D3199] disabled:opacity-40 disabled:cursor-not-allowed transition-all bg-white"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
