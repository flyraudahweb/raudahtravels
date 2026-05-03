import { useState } from "react";
import {
  useListSupportTickets, getListSupportTicketsQueryKey,
  useCreateSupportTicket, useGetSupportTicket, getGetSupportTicketQueryKey,
  useSendSupportMessage,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, ChevronLeft, Plus, ChevronRight, CheckCircle2, Clock, FileQuestion } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@clerk/react";
import type { SupportTicketDetail, SupportMessage } from "@workspace/api-client-react";

const CATEGORIES = [
  { id: "general_inquiry",            label: "General Inquiry",            desc: "General questions and inquiries",         color: "bg-blue-50 border-blue-200 text-blue-700",    dot: "bg-blue-400" },
  { id: "booking_issues",             label: "Booking Issues",             desc: "Booking-related problems",                color: "bg-amber-50 border-amber-200 text-amber-700",  dot: "bg-amber-400" },
  { id: "payment_issues",             label: "Payment Issues",             desc: "Payment and billing queries",             color: "bg-orange-50 border-orange-200 text-orange-700", dot: "bg-orange-400" },
  { id: "document_problems",          label: "Document Problems",          desc: "Document upload or verification",         color: "bg-red-50 border-red-200 text-red-700",      dot: "bg-red-400" },
  { id: "visa_processing",            label: "Visa Processing",            desc: "Visa issuance and tracking",              color: "bg-purple-50 border-purple-200 text-purple-700", dot: "bg-purple-400" },
  { id: "pilgrim_booking_assistance", label: "Booking Assistance",         desc: "Help with pilgrim booking process",       color: "bg-teal-50 border-teal-200 text-teal-700",   dot: "bg-teal-400" },
  { id: "flights_transport",          label: "Flights & Transport",        desc: "Flight ticketing and logistics",          color: "bg-sky-50 border-sky-200 text-sky-700",      dot: "bg-sky-400" },
  { id: "agent_commissions",          label: "Agent Commissions",          desc: "Commission and agent-related queries",    color: "bg-indigo-50 border-indigo-200 text-indigo-700", dot: "bg-indigo-400" },
  { id: "technical_support",          label: "Technical Support",          desc: "Technical or system issues",              color: "bg-slate-50 border-slate-200 text-slate-700",  dot: "bg-slate-400" },
];

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  open:        { label: "Open",        cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  in_progress: { label: "In Progress", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  resolved:    { label: "Resolved",    cls: "bg-gray-100 text-gray-500 border-gray-200" },
  closed:      { label: "Closed",      cls: "bg-gray-100 text-gray-400 border-gray-200" },
};

function TicketThread({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const { user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: ticket, isLoading } = useGetSupportTicket(ticketId, { query: { enabled: !!ticketId, queryKey: getGetSupportTicketQueryKey(ticketId) } });
  const sendMessage = useSendSupportMessage();
  const [message, setMessage] = useState("");

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendMessage.mutate({ id: ticketId, data: { message } }, {
      onSuccess: () => { setMessage(""); qc.invalidateQueries({ queryKey: getGetSupportTicketQueryKey(ticketId) }); },
      onError: () => toast({ title: "Could not send message.", variant: "destructive" }),
    });
  };

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>;
  if (!ticket) return <p className="text-[#94A3B8] text-center py-12">Ticket not found.</p>;

  const cfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
  const catInfo = CATEGORIES.find(c => c.id === ticket.category);
  const messages: SupportMessage[] = (ticket as SupportTicketDetail).messages || [];

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-[#64748B] hover:text-[#2D3199] transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Support
      </button>

      <div className="bg-white rounded-2xl border border-[#DCE3F0] shadow-[0_2px_16px_rgba(45,49,153,0.06)] overflow-hidden">
        <div className="bg-gradient-to-r from-[#2D3199] to-[#4C56B8] px-6 py-4">
          <h2 className="font-black text-white text-base">{ticket.subject}</h2>
          <div className="flex items-center gap-2.5 mt-2 flex-wrap">
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${cfg.cls}`}>{cfg.label}</span>
            {catInfo && (
              <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${catInfo.color}`}>{catInfo.label}</span>
            )}
            <span className="text-white/60 text-xs">{new Date(ticket.createdAt).toLocaleDateString("en-GB")}</span>
          </div>
        </div>
        <div className="p-5">
          <ScrollArea className="h-72 pr-2 mb-4">
            <div className="space-y-3">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <MessageSquare className="w-8 h-8 text-[#94A3B8]/50 mb-2" />
                  <p className="text-[#94A3B8] text-sm">No messages yet. Describe your issue below.</p>
                </div>
              ) : messages.map(msg => {
                const isMe = msg.senderId === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${isMe ? "bg-[#2D3199] text-white rounded-br-md" : "bg-[#F0F2FF] text-[#0F172A] rounded-bl-md"}`}>
                      {!isMe && <p className="text-[10px] font-bold text-[#94A3B8] mb-1">Support Team</p>}
                      <p>{msg.message}</p>
                      <p className={`text-xs mt-1.5 ${isMe ? "text-white/50" : "text-[#94A3B8]"}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          {ticket.status !== "resolved" && ticket.status !== "closed" && (
            <form onSubmit={handleSend} className="flex gap-2 border-t border-[#F1F5F9] pt-4">
              <input value={message} onChange={e => setMessage(e.target.value)} placeholder="Write your message…"
                className="flex-1 bg-[#F8F9FF] border border-[#DCE3F0] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#2D3199] focus:ring-2 focus:ring-[#2D3199]/10 transition-all" />
              <button type="submit" disabled={sendMessage.isPending || !message.trim()}
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

type Step = "list" | "select-category" | "compose" | "thread";

export default function DashboardSupport() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useListSupportTickets({}, { query: { queryKey: getListSupportTicketsQueryKey({}) } });
  const createTicket = useCreateSupportTicket();
  const [step, setStep] = useState<Step>("list");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"low"|"medium"|"high">("medium");

  const tickets = data?.tickets || [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createTicket.mutate({ data: { subject, message, priority, category: selectedCategory || undefined } }, {
      onSuccess: () => {
        toast({ title: "Ticket submitted", description: "Our support team will respond shortly." });
        qc.invalidateQueries({ queryKey: getListSupportTicketsQueryKey({}) });
        setStep("list"); setSubject(""); setMessage(""); setSelectedCategory(""); setPriority("medium");
      },
      onError: () => toast({ title: "Could not create ticket.", variant: "destructive" }),
    });
  };

  if (selectedTicketId) return <TicketThread ticketId={selectedTicketId} onBack={() => setSelectedTicketId(null)} />;

  if (step === "select-category") {
    return (
      <div className="space-y-5" data-testid="page-dashboard-support">
        <button onClick={() => setStep("list")} className="flex items-center gap-2 text-sm font-bold text-[#64748B] hover:text-[#2D3199] transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div>
          <h2 className="text-xl font-black text-[#0F172A] mb-1">What do you need help with?</h2>
          <p className="text-sm text-[#64748B]">Select a category so we can route your request to the right team.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => { setSelectedCategory(cat.id); setStep("compose"); }}
              className={`text-left p-4 rounded-2xl border-2 transition-all hover:scale-[1.02] hover:shadow-md ${cat.color} hover:border-current`}>
              <div className={`w-2.5 h-2.5 rounded-full ${cat.dot} mb-3`} />
              <p className="font-bold text-sm mb-0.5">{cat.label}</p>
              <p className="text-xs opacity-75 leading-relaxed">{cat.desc}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === "compose") {
    const catInfo = CATEGORIES.find(c => c.id === selectedCategory);
    return (
      <div className="space-y-5" data-testid="page-dashboard-support">
        <button onClick={() => setStep("select-category")} className="flex items-center gap-2 text-sm font-bold text-[#64748B] hover:text-[#2D3199] transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-black text-[#0F172A]">Describe your issue</h2>
          {catInfo && <span className={`text-xs px-3 py-1 rounded-full font-bold border ${catInfo.color}`}>{catInfo.label}</span>}
        </div>
        <form onSubmit={handleCreate} className="space-y-4 bg-white rounded-2xl border border-[#DCE3F0] p-6 shadow-[0_2px_16px_rgba(45,49,153,0.06)]">
          <div>
            <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-1.5">Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} required placeholder="Brief description of your issue"
              className="w-full bg-[#F8F9FF] border border-[#DCE3F0] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#2D3199] focus:ring-2 focus:ring-[#2D3199]/10 transition-all" />
          </div>
          <div>
            <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-1.5">Priority</label>
            <div className="flex gap-2">
              {(["low","medium","high"] as const).map(p => (
                <button key={p} type="button" onClick={() => setPriority(p)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all capitalize ${priority === p
                    ? p === "high" ? "bg-red-500 border-red-500 text-white" : p === "medium" ? "bg-amber-500 border-amber-500 text-white" : "bg-slate-400 border-slate-400 text-white"
                    : "bg-white border-[#DCE3F0] text-[#64748B] hover:border-[#2D3199] hover:text-[#2D3199]"}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-1.5">Message</label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)} required placeholder="Describe your issue in detail…" rows={5}
              className="bg-[#F8F9FF] border-[#DCE3F0] rounded-xl resize-none focus:border-[#2D3199] focus:ring-2 focus:ring-[#2D3199]/10" />
          </div>
          <Button type="submit" disabled={createTicket.isPending || !subject.trim() || !message.trim()}
            className="w-full bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl h-11 font-bold">
            {createTicket.isPending ? "Submitting…" : "Submit Ticket"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-dashboard-support">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-serif text-[#0F172A]">Support</h1>
          <p className="text-[#64748B] text-sm mt-0.5">Get help from our team</p>
        </div>
        <Button onClick={() => setStep("select-category")} className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl font-bold gap-2">
          <Plus className="w-4 h-4" /> New Ticket
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : tickets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#DCE3F0] p-16 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#EEF0FF] flex items-center justify-center mb-4">
            <FileQuestion className="w-6 h-6 text-[#2D3199]" />
          </div>
          <p className="font-bold text-[#0F172A] mb-1">No support tickets</p>
          <p className="text-sm text-[#94A3B8] mb-5">Create a ticket if you need help with anything</p>
          <Button onClick={() => setStep("select-category")} className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl font-bold gap-2">
            <Plus className="w-4 h-4" /> New Ticket
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(ticket => {
            const cfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
            const catInfo = CATEGORIES.find(c => c.id === ticket.category);
            return (
              <div key={ticket.id}
                className="bg-white rounded-2xl border border-[#DCE3F0] p-5 cursor-pointer hover:shadow-[0_4px_20px_rgba(45,49,153,0.08)] hover:border-[#B8C0E8] transition-all flex items-center gap-4"
                onClick={() => setSelectedTicketId(ticket.id)}>
                <div className="w-10 h-10 rounded-2xl bg-[#EEF0FF] flex items-center justify-center flex-shrink-0">
                  {ticket.status === "resolved" ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    : ticket.status === "in_progress" ? <Clock className="w-5 h-5 text-blue-500" />
                    : <MessageSquare className="w-5 h-5 text-[#2D3199]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#0F172A] truncate mb-1">{ticket.subject}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${cfg.cls}`}>{cfg.label}</span>
                    {catInfo && <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${catInfo.color}`}>{catInfo.label}</span>}
                    <span className="text-xs text-[#94A3B8]">{new Date(ticket.createdAt).toLocaleDateString("en-GB")}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
