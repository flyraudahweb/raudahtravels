import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetProfile } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Send, Hash, Plus, Trash2, Lock, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Channel { id: string; name: string; slug: string; description?: string; isDefault: boolean; createdAt: string; }
interface StaffMember { id: string; fullName: string; email: string; role: string; avatarUrl?: string; }
interface Message { id: string; senderId: string; receiverId?: string; channelId?: string; content: string; createdAt: string; sender?: { id: string; fullName: string; avatarUrl?: string; role: string }; }

const CHANNEL_SUGGESTIONS = [
  { name: "Flights & Transport", desc: "Flight bookings, airport transfers and logistics",  emoji: "✈️" },
  { name: "Accommodation",       desc: "Hotel and Makkah/Madinah housing updates",           emoji: "🏨" },
  { name: "Visa Processing",     desc: "Visa applications, approvals and follow-ups",        emoji: "🛂" },
  { name: "Documentation",       desc: "Passport, medical and travel document tracking",     emoji: "📄" },
  { name: "Medical & Health",    desc: "Health requirements, vaccinations and emergencies",  emoji: "🏥" },
  { name: "Catering & Meals",    desc: "Meal plans and dietary arrangements",                emoji: "🍽️" },
  { name: "Finance & Billing",   desc: "Invoices, refunds and financial reconciliation",     emoji: "💳" },
  { name: "Group Coordination",  desc: "Group leaders and pilgrim group logistics",          emoji: "👥" },
  { name: "Agent Relations",     desc: "Agent commission and partnership matters",           emoji: "🤝" },
  { name: "Announcements",       desc: "Important notices and broadcast messages",           emoji: "📢" },
  { name: "IT Support",          desc: "System issues and technical support",               emoji: "🖥️" },
  { name: "Emergency",           desc: "Urgent situations requiring immediate attention",    emoji: "🚨" },
];

async function api(path: string, opts?: RequestInit) {
  const r = await fetch(`/api${path}`, { credentials: "include", ...opts });
  if (!r.ok) throw new Error(`API error ${r.status}`);
  return r.json();
}

export default function AdminTeamChat() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: profileData } = useGetProfile();
  const [active, setActive] = useState<{ type: "channel"; channelId: string } | { type: "dm"; staffId: string } | null>(null);
  const [input, setInput] = useState("");
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const myProfileId = profileData?.id;
  const isAdmin = ["super_admin", "admin"].includes(profileData?.role || "");

  const { data: channelsData } = useQuery({
    queryKey: ["admin-channels"],
    queryFn: () => api("/admin/channels"),
    refetchInterval: 15000,
  });
  const channels: Channel[] = channelsData?.channels || [];

  const { data: staffData } = useQuery({
    queryKey: ["admin-staff-chat"],
    queryFn: () => api("/admin/staff"),
  });
  const staff: StaffMember[] = (staffData?.staff || []).filter((s: StaffMember) => s.id !== myProfileId);

  const messagesKey = active?.type === "channel"
    ? ["chat-messages", "channel", (active as any).channelId]
    : ["chat-messages", "dm", myProfileId, (active as any)?.staffId];

  const { data: msgsData } = useQuery({
    queryKey: messagesKey,
    queryFn: () => {
      if (!active) return { messages: [] };
      if (active.type === "channel") return api(`/admin/chat/messages?channelId=${(active as any).channelId}&limit=60`);
      if (!myProfileId) return { messages: [] };
      return api(`/admin/chat/messages?senderId=${myProfileId}&receiverId=${(active as any).staffId}&limit=60`);
    },
    enabled: !!active && !!myProfileId,
    refetchInterval: 3000,
  });
  const messages: Message[] = msgsData?.messages || [];

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMsg = useMutation({
    mutationFn: (content: string) => {
      if (!myProfileId || !active) throw new Error();
      const body: any = { senderId: myProfileId, content };
      if (active.type === "channel") body.channelId = (active as any).channelId;
      else body.receiverId = (active as any).staffId;
      return api("/admin/chat/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: messagesKey }); setInput(""); },
    onError: () => toast({ title: "Could not send message", variant: "destructive" }),
  });

  const createChannel = useMutation({
    mutationFn: () => api("/admin/channels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newChannelName, description: newChannelDesc }) }),
    onSuccess: (ch) => {
      qc.invalidateQueries({ queryKey: ["admin-channels"] });
      setShowNewChannel(false); setNewChannelName(""); setNewChannelDesc("");
      setActive({ type: "channel", channelId: ch.id });
      toast({ title: `#${ch.name} channel created` });
    },
    onError: (e: any) => toast({ title: e?.message || "Failed to create channel", variant: "destructive" }),
  });

  const deleteChannel = useMutation({
    mutationFn: (id: string) => api(`/admin/channels/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-channels"] }); setActive(null); toast({ title: "Channel deleted" }); },
    onError: () => toast({ title: "Cannot delete this channel", variant: "destructive" }),
  });

  const activeChannel = active?.type === "channel" ? channels.find(c => c.id === (active as any).channelId) : null;
  const activeMember = active?.type === "dm" ? staff.find(s => s.id === (active as any).staffId) : null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMsg.mutate(input.trim());
  };

  return (
    <div data-testid="page-admin-chat">
      <div className="mb-4">
        <p className="text-[#2D3199] text-xs font-bold uppercase tracking-widest mb-1">Communication</p>
        <h1 className="text-2xl font-black text-[#0F172A]">Team Chat</h1>
        <p className="text-[#64748B] text-sm mt-0.5">Internal messaging for your admin team</p>
      </div>

      <div className="flex bg-white rounded-2xl border border-[#DCE3F0] overflow-hidden shadow-[0_4px_24px_rgba(45,49,153,0.07)]" style={{ height: "calc(100vh - 200px)", minHeight: 520 }}>

        {/* ── Sidebar ── */}
        <div className={`${active ? "hidden md:flex" : "flex"} w-full md:w-64 flex-shrink-0 border-r border-[#F1F5F9] flex-col bg-[#F8FAFF]`}>

          {/* Channels */}
          <div className="flex-shrink-0 border-b border-[#F1F5F9]">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <span className="text-[9px] font-black text-[#94A3B8] uppercase tracking-[0.18em]">Channels</span>
              {isAdmin && (
                <button onClick={() => setShowNewChannel(true)} className="w-5 h-5 rounded-md bg-[#EEF0FF] hover:bg-[#2D3199] text-[#2D3199] hover:text-white flex items-center justify-center transition-all" title="Create channel">
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="pb-3 px-2 space-y-0.5">
              {channels.map(ch => {
                const isActive = active?.type === "channel" && (active as any).channelId === ch.id;
                return (
                  <div key={ch.id} className={`group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all ${isActive ? "bg-[#EEF0FF] text-[#2D3199]" : "text-[#64748B] hover:bg-white hover:text-[#0F172A]"}`}
                    onClick={() => setActive({ type: "channel", channelId: ch.id })}>
                    <Hash className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-[#2D3199]" : "text-[#94A3B8]"}`} />
                    <span className="flex-1 text-sm font-semibold truncate">{ch.name}</span>
                    {ch.isDefault ? (
                      <Lock className="w-3 h-3 text-[#CBD5E1] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    ) : isAdmin && (
                      <button onClick={e => { e.stopPropagation(); if (confirm(`Delete #${ch.name}?`)) deleteChannel.mutate(ch.id); }}
                        className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Direct Messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 pt-4 pb-2">
              <span className="text-[9px] font-black text-[#94A3B8] uppercase tracking-[0.18em]">Direct Messages</span>
            </div>
            <div className="pb-3 px-2 space-y-0.5">
              {staff.length === 0 ? (
                <p className="text-xs text-[#94A3B8] px-3 py-2">No other staff members</p>
              ) : staff.map(s => {
                const isActive = active?.type === "dm" && (active as any).staffId === s.id;
                return (
                  <div key={s.id} onClick={() => setActive({ type: "dm", staffId: s.id })}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-all ${isActive ? "bg-[#EEF0FF]" : "hover:bg-white"}`}>
                    <div className="relative flex-shrink-0">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={s.avatarUrl} />
                        <AvatarFallback className="text-[10px] bg-[#2D3199] text-white font-black">{s.fullName?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#F8FAFF] rounded-full" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate leading-tight ${isActive ? "text-[#2D3199]" : "text-[#0F172A]"}`}>{s.fullName}</p>
                      <p className="text-[10px] text-[#94A3B8] truncate capitalize">{s.role?.replace(/_/g, " ")}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Members count */}
          <div className="border-t border-[#F1F5F9] px-4 py-3 flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-[#94A3B8]" />
            <span className="text-xs text-[#94A3B8]">{staff.length + 1} team members</span>
          </div>
        </div>

        {/* ── Chat area ── */}
        <div className={`${!active ? "hidden md:flex" : "flex"} flex-1 flex-col min-w-0`}>
          {!active ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#EEF0FF] flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-8 h-8 text-[#2D3199]" />
                </div>
                <p className="font-bold text-[#0F172A] mb-1">Pick a channel or colleague</p>
                <p className="text-xs text-[#94A3B8]">Start a conversation with your team</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#F1F5F9] bg-white flex-shrink-0">
                <button onClick={() => setActive(null)} className="md:hidden mr-1 text-[#64748B] hover:text-[#2D3199]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                {active.type === "channel" && activeChannel ? (
                  <>
                    <div className="w-9 h-9 rounded-xl bg-[#EEF0FF] flex items-center justify-center flex-shrink-0">
                      <Hash className="w-4 h-4 text-[#2D3199]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#0F172A] text-sm">{activeChannel.name}</p>
                      {activeChannel.description && <p className="text-[10px] text-[#94A3B8] truncate">{activeChannel.description}</p>}
                    </div>
                  </>
                ) : activeMember ? (
                  <>
                    <div className="relative flex-shrink-0">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={activeMember.avatarUrl} />
                        <AvatarFallback className="text-sm bg-[#2D3199] text-white font-black">{activeMember.fullName?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-white rounded-full" />
                    </div>
                    <div>
                      <p className="font-bold text-[#0F172A] text-sm">{activeMember.fullName}</p>
                      <p className="text-[10px] text-[#94A3B8] capitalize">{activeMember.role?.replace(/_/g, " ")}</p>
                    </div>
                  </>
                ) : null}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-[#FAFBFF]">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <MessageCircle className="w-8 h-8 text-[#CBD5E1] mx-auto mb-2" />
                      <p className="text-sm text-[#94A3B8] font-semibold">No messages yet</p>
                      <p className="text-xs text-[#CBD5E1] mt-0.5">Be the first to say something!</p>
                    </div>
                  </div>
                ) : messages.map(msg => {
                  const isMe = msg.senderId === myProfileId;
                  return (
                    <div key={msg.id} className={`flex items-end gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}>
                      {!isMe && (
                        <Avatar className="h-7 w-7 flex-shrink-0 mb-1">
                          <AvatarImage src={msg.sender?.avatarUrl} />
                          <AvatarFallback className="text-[10px] bg-[#2D3199] text-white font-black">{msg.sender?.fullName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                      )}
                      <div className={`max-w-[72%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                        {!isMe && <p className="text-[10px] text-[#94A3B8] font-bold mb-1 px-1">{msg.sender?.fullName}</p>}
                        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${isMe ? "bg-[#2D3199] text-white rounded-br-md" : "bg-white text-[#0F172A] rounded-bl-md shadow-sm border border-[#EEF0FF]"}`}>
                          {msg.content}
                        </div>
                        <p className="text-[10px] text-[#CBD5E1] mt-1 px-1">
                          {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className="flex items-center gap-3 px-5 py-3.5 border-t border-[#F1F5F9] bg-white flex-shrink-0">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={`Message ${active.type === "channel" && activeChannel ? `#${activeChannel.name}` : activeMember?.fullName || ""}…`}
                  className="flex-1 bg-[#F8FAFF] border border-[#DCE3F0] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#2D3199] focus:ring-2 focus:ring-[#2D3199]/10 transition-all"
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e as any); } }}
                />
                <button type="submit" disabled={!input.trim() || sendMsg.isPending}
                  className="w-10 h-10 rounded-xl bg-[#2D3199] hover:bg-[#1C1F66] flex items-center justify-center text-white transition-colors disabled:opacity-40 flex-shrink-0">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* ── Create Channel Dialog ── */}
      <Dialog open={showNewChannel} onOpenChange={v => { setShowNewChannel(v); if (!v) { setNewChannelName(""); setNewChannelDesc(""); } }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-black text-[#0F172A] flex items-center gap-2">
              <Hash className="w-5 h-5 text-[#2D3199]" /> Create Channel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Predefined suggestions */}
            <div>
              <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-2">Quick Select</label>
              <div className="flex flex-wrap gap-2">
                {CHANNEL_SUGGESTIONS.filter(s => !channels.some(c => c.name.toLowerCase() === s.name.toLowerCase())).map(s => (
                  <button key={s.name} type="button"
                    onClick={() => { setNewChannelName(s.name); setNewChannelDesc(s.desc); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      newChannelName === s.name
                        ? "bg-[#2D3199] text-white border-[#2D3199]"
                        : "bg-white text-[#475569] border-[#DCE3F0] hover:border-[#2D3199] hover:text-[#2D3199]"
                    }`}>
                    <span>{s.emoji}</span> {s.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-[#F1F5F9] pt-4">
              <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-1.5">
                Channel Name <span className="text-[#CBD5E1] font-normal normal-case">— or type your own</span>
              </label>
              <Input
                value={newChannelName}
                onChange={e => setNewChannelName(e.target.value)}
                placeholder="e.g. Logistics, Catering…"
                className="rounded-xl border-[#DCE3F0]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-1.5">
                Description <span className="text-[#CBD5E1] font-normal normal-case">(optional)</span>
              </label>
              <Textarea
                value={newChannelDesc}
                onChange={e => setNewChannelDesc(e.target.value)}
                placeholder="What's this channel for?"
                className="rounded-xl border-[#DCE3F0] resize-none"
                rows={2}
              />
            </div>
            <Button onClick={() => createChannel.mutate()} disabled={!newChannelName.trim() || createChannel.isPending}
              className="w-full bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl h-11 font-bold">
              {createChannel.isPending ? "Creating…" : "Create Channel"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
