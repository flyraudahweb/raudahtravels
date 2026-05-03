import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Bot, Send, Sparkles, TrendingUp, Users, DollarSign, BarChart3,
  Lightbulb, Package, Globe, Megaphone, AlertCircle, RefreshCw,
  CalendarDays, ShieldCheck, Copy, Check, History, Trash2, Clock, Plus, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  error?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Array<{ id: string; role: "user" | "assistant"; content: string; timestamp: string; error?: boolean }>;
  createdAt: string;
}

const STORAGE_KEY = "raudah_ai_chat_history";
const MAX_SESSIONS = 20;

const QUICK_PROMPTS = [
  { icon: DollarSign,    label: "Revenue Summary",   prompt: "Give me a full revenue summary — total, this month, and trend over the last 6 months." },
  { icon: TrendingUp,    label: "Monthly Trend",     prompt: "Show this month's revenue and compare it with last month. What's the growth rate?" },
  { icon: Users,         label: "Pilgrim Stats",     prompt: "How many pilgrims are registered? Break down bookings by status and show conversion rate." },
  { icon: BarChart3,     label: "Top Agents",        prompt: "Who are our top-performing agents this month? What can I do to incentivize them?" },
  { icon: Package,       label: "Package Review",    prompt: "Which packages are most popular? What pricing or feature improvements would you recommend?" },
  { icon: AlertCircle,   label: "Pending Actions",   prompt: "What needs my urgent attention today — pending payments, open tickets, agent applications?" },
  { icon: Lightbulb,     label: "Growth Strategy",   prompt: "Give me 5 actionable growth strategies specifically for a Nigerian Hajj & Umrah agency." },
  { icon: Megaphone,     label: "Marketing Tips",    prompt: "What are the best marketing channels and campaign ideas for Hajj/Umrah packages in Nigeria?" },
  { icon: CalendarDays,  label: "Season Planning",   prompt: "It's approaching Hajj/Umrah season. What should I be doing now to maximize bookings and operations?" },
  { icon: Globe,         label: "Visa Process",      prompt: "Give me a breakdown of the Saudi visa process for Nigerian pilgrims — timelines, requirements, common issues." },
  { icon: ShieldCheck,   label: "Compliance Check",  prompt: "What Nigerian travel agency compliance requirements and NABTEB/NUC regulations should I be aware of?" },
  { icon: RefreshCw,     label: "Reduce Cancels",    prompt: "What strategies can reduce booking cancellations and improve pilgrim retention at Raudah Travels?" },
];

const WELCOME_MSG: Message = {
  id: "welcome",
  role: "assistant",
  content: "As-salamu alaykum! I'm **Raudah AI** — your intelligent business assistant.\n\nI have real-time access to your platform data: revenue, bookings, pilgrims, agents, and more. Ask me anything about your business, strategy, or operations.\n\nHow can I assist you today?",
  timestamp: new Date(),
};

function loadHistory(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatSession[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(sessions: ChatSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch {}
}

export default function AdminAiAssistant() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ChatSession[]>(loadHistory);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const saveCurrentSession = useCallback((msgs: Message[]) => {
    const userMsgs = msgs.filter(m => m.role === "user");
    if (userMsgs.length === 0) return;
    const title = userMsgs[0].content.slice(0, 60) + (userMsgs[0].content.length > 60 ? "…" : "");
    const session: ChatSession = {
      id: Date.now().toString(),
      title,
      messages: msgs.map(m => ({ ...m, timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp })),
      createdAt: new Date().toISOString(),
    };
    const updated = [session, ...loadHistory()].slice(0, MAX_SESSIONS);
    saveHistory(updated);
    setHistory(updated);
  }, []);

  const sendMessage = async (prompt: string) => {
    if (!prompt.trim() || isThinking) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: prompt.trim(),
      timestamp: new Date(),
    };
    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);
    setInput("");
    setIsThinking(true);
    setApiError(null);

    try {
      const history = updatedMsgs
        .filter(m => m.id !== "welcome")
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      const data = await res.json() as { content?: string; error?: string };

      if (!res.ok) {
        const errMsg = data.error ?? "Something went wrong. Please try again.";
        if (res.status === 503) setApiError(errMsg);
        setMessages(m => [...m, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: errMsg,
          timestamp: new Date(),
          error: true,
        }]);
      } else {
        setMessages(m => [...m, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.content ?? "I couldn't generate a response. Please try again.",
          timestamp: new Date(),
        }]);
      }
    } catch {
      setMessages(m => [...m, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Network error — please check your connection and try again.",
        timestamp: new Date(),
        error: true,
      }]);
    } finally {
      setIsThinking(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const startNewChat = () => {
    saveCurrentSession(messages);
    setMessages([{ ...WELCOME_MSG, timestamp: new Date() }]);
    setApiError(null);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const loadSession = (session: ChatSession) => {
    const loaded: Message[] = session.messages.map(m => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
    setMessages(loaded);
    setApiError(null);
    setHistoryOpen(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(s => s.id !== id);
    saveHistory(updated);
    setHistory(updated);
  };

  const clearAllHistory = () => {
    saveHistory([]);
    setHistory([]);
    toast({ title: "Chat history cleared" });
  };

  const copyMessage = async (id: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatContent = (content: string) => {
    const lines = content.split("\n");
    return lines.map((line, i) => {
      if (line === "") return <div key={i} className="h-2" />;
      if (line.startsWith("# ")) return <p key={i} className="text-base font-black text-[#0F172A] mt-3 mb-1">{line.slice(2)}</p>;
      if (line.startsWith("## ")) return <p key={i} className="text-sm font-black text-[#2D3199] mt-3 mb-1">{line.slice(3)}</p>;
      const isBold = line.startsWith("**") && line.endsWith("**") && line.length > 4;
      if (isBold) return <p key={i} className="font-bold text-[#0F172A] text-sm mt-2">{line.replace(/\*\*/g, "")}</p>;
      if (line.startsWith("- ") || line.startsWith("• ")) {
        return (
          <div key={i} className="flex gap-2 text-sm leading-relaxed">
            <span className="text-[#FF3B00] mt-1 flex-shrink-0">•</span>
            <span>{renderInline(line.slice(2))}</span>
          </div>
        );
      }
      if (line.match(/^\d+\.\s/)) {
        const [num, ...rest] = line.split(". ");
        return (
          <div key={i} className="flex gap-2 text-sm leading-relaxed">
            <span className="text-[#2D3199] font-bold flex-shrink-0 w-5">{num}.</span>
            <span>{renderInline(rest.join(". "))}</span>
          </div>
        );
      }
      return <p key={i} className="text-sm leading-relaxed">{renderInline(line)}</p>;
    });
  };

  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, j) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={j} className="font-bold text-[#0F172A]">{p.slice(2, -2)}</strong>
        : p
    );
  };

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  return (
    <div className="flex flex-col gap-6 h-full" data-testid="page-admin-ai">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[#2D3199] text-xs font-bold uppercase tracking-widest mb-1">Intelligence</p>
          <h1 className="text-2xl font-black text-[#0F172A] flex items-center gap-2.5">
            AI Business Assistant
            <Sparkles className="w-5 h-5 text-[#FF3B00]" />
          </h1>
          <p className="text-[#64748B] text-sm mt-0.5">Powered by AI — with live access to your platform data</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge className="bg-[#EEF0FF] text-[#2D3199] border-0 gap-1.5 font-semibold px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2D3199] animate-pulse" />
            Live Data
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}
            className="text-[#64748B] border-[#DCE3F0] hover:border-[#2D3199] hover:text-[#2D3199] rounded-xl text-xs gap-1.5">
            <History className="w-3.5 h-3.5" />
            History
            {history.length > 0 && (
              <span className="bg-[#2D3199] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {history.length}
              </span>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={startNewChat}
            className="text-[#64748B] border-[#DCE3F0] hover:border-[#2D3199] hover:text-[#2D3199] rounded-xl text-xs gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            New Chat
          </Button>
        </div>
      </div>

      {/* API Error Banner */}
      {apiError && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">AI Not Configured</p>
            <p className="text-xs text-amber-700 mt-0.5">{apiError}</p>
          </div>
        </div>
      )}

      {/* Quick Prompts */}
      <div>
        <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider mb-2.5">Quick Prompts</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {QUICK_PROMPTS.map(qp => {
            const Icon = qp.icon;
            return (
              <button key={qp.label} onClick={() => sendMessage(qp.prompt)} disabled={isThinking}
                className="flex items-center gap-2 px-3 py-2.5 bg-white rounded-xl border border-[#DCE3F0] text-left hover:border-[#2D3199] hover:bg-[#F0F2FF] transition-all disabled:opacity-40 group cursor-pointer">
                <div className="w-6 h-6 rounded-lg bg-[#EEF0FF] flex items-center justify-center flex-shrink-0 group-hover:bg-[#2D3199] transition-colors">
                  <Icon className="w-3 h-3 text-[#2D3199] group-hover:text-white transition-colors" />
                </div>
                <span className="font-semibold text-[#475569] group-hover:text-[#2D3199] text-xs leading-tight">{qp.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat Window */}
      <div className="bg-white rounded-2xl border border-[#DCE3F0] overflow-hidden flex flex-col flex-1 min-h-[420px]">

        {/* Chat Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-[#F1F5F9] bg-gradient-to-r from-[#F8FAFF] to-white">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2D3199] to-[#4C56B8] flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#0F172A]">Raudah AI</p>
            <p className="text-xs text-[#94A3B8]">Powered by AI — live platform data</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-[#64748B] font-medium">Online</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {messages.map(msg => (
            <div key={msg.id} className={`flex items-start gap-3 group ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                msg.role === "assistant"
                  ? msg.error ? "bg-red-100" : "bg-gradient-to-br from-[#2D3199] to-[#4C56B8]"
                  : "bg-[#FF3B00]"
              }`}>
                {msg.role === "assistant"
                  ? <Bot className={`w-4 h-4 ${msg.error ? "text-red-500" : "text-white"}`} />
                  : <span className="text-white text-[10px] font-black">YOU</span>
                }
              </div>
              <div className={`max-w-[80%] relative ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                <div className={`px-4 py-3 rounded-2xl ${
                  msg.role === "assistant"
                    ? msg.error
                      ? "bg-red-50 border border-red-100 text-red-700 rounded-tl-sm"
                      : "bg-[#F0F2FF] text-[#0F172A] rounded-tl-sm"
                    : "bg-[#2D3199] text-white rounded-tr-sm"
                }`}>
                  {msg.role === "assistant"
                    ? <div className="space-y-1">{formatContent(msg.content)}</div>
                    : <p className="text-sm leading-relaxed">{msg.content}</p>
                  }
                </div>
                <div className={`flex items-center gap-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <span className="text-[10px] text-[#94A3B8]">
                    {(msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {msg.role === "assistant" && !msg.error && (
                    <button onClick={() => copyMessage(msg.id, msg.content)} className="text-[#94A3B8] hover:text-[#2D3199] transition-colors">
                      {copiedId === msg.id
                        ? <Check className="w-3 h-3 text-emerald-500" />
                        : <Copy className="w-3 h-3" />
                      }
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2D3199] to-[#4C56B8] flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-[#F0F2FF] px-4 py-3 rounded-2xl rounded-tl-sm">
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full bg-[#2D3199]/50 animate-bounce" style={{ animationDelay: `${i * 0.18}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex items-end gap-3 px-5 py-4 border-t border-[#F1F5F9] bg-white">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask me about revenue, bookings, strategy, visa processes…"
            className="flex-1 rounded-xl border-[#DCE3F0] bg-[#F8FAFF] resize-none text-sm focus-visible:ring-[#2D3199]/30 min-h-[42px] max-h-32"
            rows={1}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
          />
          <Button type="submit" disabled={!input.trim() || isThinking}
            className="w-11 h-11 rounded-xl bg-[#2D3199] hover:bg-[#1C1F66] text-white p-0 flex-shrink-0 disabled:opacity-40 transition-all">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-[#F1F5F9]">
            <DialogTitle className="text-lg font-black text-[#0F172A] flex items-center gap-2">
              <History className="w-5 h-5 text-[#2D3199]" />
              Chat History
            </DialogTitle>
            <p className="text-[#94A3B8] text-sm mt-0.5">Your past conversations — click to restore</p>
          </DialogHeader>

          <div className="max-h-[420px] overflow-y-auto">
            {history.length === 0 ? (
              <div className="py-12 text-center px-6">
                <div className="w-12 h-12 bg-[#EEF0FF] rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-6 h-6 text-[#2D3199]" />
                </div>
                <p className="font-bold text-[#0F172A]">No history yet</p>
                <p className="text-sm text-[#64748B] mt-1">Start a chat and click "New Chat" to save it here.</p>
              </div>
            ) : (
              <div className="p-3 space-y-1.5">
                {history.map(session => (
                  <button key={session.id} onClick={() => loadSession(session)}
                    className="w-full text-left flex items-start gap-3 p-3 rounded-xl hover:bg-[#F8FAFF] group transition-colors border border-transparent hover:border-[#DCE3F0]">
                    <div className="w-8 h-8 rounded-lg bg-[#EEF0FF] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-[#2D3199]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0F172A] truncate">{session.title}</p>
                      <p className="text-[10px] text-[#94A3B8] mt-0.5">
                        {fmtDate(session.createdAt)} · {session.messages.filter(m => m.role === "user").length} messages
                      </p>
                    </div>
                    <button
                      onClick={e => deleteSession(session.id, e)}
                      className="w-6 h-6 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all flex-shrink-0 mt-0.5"
                      title="Delete this conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[#94A3B8] hover:text-red-500" />
                    </button>
                  </button>
                ))}
              </div>
            )}
          </div>

          {history.length > 0 && (
            <div className="px-6 py-4 border-t border-[#F1F5F9] bg-[#FAFBFF] flex items-center justify-between gap-3">
              <p className="text-xs text-[#94A3B8]">{history.length} saved conversation{history.length !== 1 ? "s" : ""}</p>
              <button onClick={clearAllHistory}
                className="flex items-center gap-1.5 text-xs font-bold text-red-500 hover:text-red-600 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
                Clear All
              </button>
            </div>
          )}

          <button onClick={() => setHistoryOpen(false)}
            className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#F1F5F9] transition-colors">
            <X className="w-4 h-4 text-[#94A3B8]" />
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
