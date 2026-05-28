import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  History, Search, Phone, Mail, User, CreditCard, CheckCircle2, XCircle,
  Eye, ShoppingCart, Pencil, AlertTriangle, UserPlus, RefreshCw, ChevronDown, ChevronUp,
  Calendar, Filter, Shield, ShieldAlert, Trash2, Tag, Settings,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow, format } from "date-fns";

interface ActivityMeta {
  actorName?: string;
  actorRole?: string;
  targetName?: string;
  targetPhone?: string;
  targetEmail?: string;
  amount?: number;
  reference?: string;
  changedFields?: string[];
  newStatus?: string;
  packageId?: string;
}

interface Activity {
  id: string;
  eventType: string;
  packageId?: string;
  bookingId?: string;
  metadata?: ActivityMeta;
  createdAt: string;
  user?: { id: string; fullName: string; email: string; avatarUrl?: string; role?: string; phone?: string };
}

const EVENT_CONFIG: Record<string, { label: string; Icon: any; color: string; bg: string; category: string }> = {
  // Staff actions
  pilgrim_registered:   { label: "Pilgrim Registered",   Icon: UserPlus,      color: "text-indigo-600",  bg: "bg-indigo-50",  category: "staff" },
  payment_verified:     { label: "Payment Verified",      Icon: CheckCircle2,  color: "text-emerald-600", bg: "bg-emerald-50", category: "staff" },
  payment_rejected:     { label: "Payment Rejected",      Icon: XCircle,       color: "text-red-600",     bg: "bg-red-50",     category: "staff" },
  booking_confirmed:    { label: "Booking Confirmed",     Icon: CheckCircle2,  color: "text-emerald-600", bg: "bg-emerald-50", category: "staff" },
  booking_cancelled:    { label: "Booking Cancelled",     Icon: XCircle,       color: "text-red-600",     bg: "bg-red-50",     category: "staff" },
  booking_completed:    { label: "Booking Completed",     Icon: CheckCircle2,  color: "text-blue-600",    bg: "bg-blue-50",    category: "staff" },
  booking_pending:      { label: "Booking Set Pending",   Icon: History,       color: "text-amber-600",   bg: "bg-amber-50",   category: "staff" },
  booking_status_changed: { label: "Booking Status Changed", Icon: History,    color: "text-amber-600",   bg: "bg-amber-50",   category: "staff" },
  amendment_approved:   { label: "Amendment Approved",    Icon: CheckCircle2,  color: "text-teal-600",    bg: "bg-teal-50",    category: "staff" },
  amendment_rejected:   { label: "Amendment Rejected",    Icon: XCircle,       color: "text-rose-600",    bg: "bg-rose-50",    category: "staff" },
  visa_status_changed:  { label: "Visa Status Changed",   Icon: Pencil,        color: "text-sky-600",     bg: "bg-sky-50",     category: "staff" },
  // Payment events
  payment_attempt:      { label: "Payment Attempt",       Icon: CreditCard,    color: "text-purple-600",  bg: "bg-purple-50",  category: "payments" },
  payment_success:      { label: "Payment Success",       Icon: CheckCircle2,  color: "text-emerald-600", bg: "bg-emerald-50", category: "payments" },
  payment_failed:       { label: "Payment Failed",        Icon: AlertTriangle, color: "text-red-600",     bg: "bg-red-50",     category: "payments" },
  payment_received:     { label: "Payment Received",      Icon: CreditCard,    color: "text-teal-600",    bg: "bg-teal-50",    category: "payments" },
  // Pilgrim activity
  package_view:         { label: "Package Viewed",        Icon: Eye,           color: "text-blue-600",    bg: "bg-blue-50",    category: "pilgrim" },
  booking_start:        { label: "Booking Started",       Icon: ShoppingCart,  color: "text-amber-600",   bg: "bg-amber-50",   category: "pilgrim" },
  booking_created:      { label: "Booking Created",       Icon: ShoppingCart,  color: "text-indigo-600",  bg: "bg-indigo-50",  category: "pilgrim" },
  // Agent activity
  agent_application_submitted: { label: "Agent Application",      Icon: UserPlus,    color: "text-orange-600", bg: "bg-orange-50",  category: "agent" },
  agent_client_registered:     { label: "Agent Client Registered", Icon: UserPlus,   color: "text-teal-600",   bg: "bg-teal-50",    category: "agent" },
  wallet_topup:                { label: "Wallet Top-up",          Icon: CreditCard,  color: "text-green-600",  bg: "bg-green-50",   category: "agent" },
  wallet_transaction:          { label: "Wallet Transaction",     Icon: CreditCard,  color: "text-cyan-600",   bg: "bg-cyan-50",    category: "agent" },
  // Admin actions
  role_changed:              { label: "Role Changed",           Icon: Shield,       color: "text-violet-600", bg: "bg-violet-50",  category: "admin" },
  user_status_changed:       { label: "User Status Changed",    Icon: ShieldAlert,  color: "text-amber-600",  bg: "bg-amber-50",   category: "admin" },
  user_deleted:              { label: "User Deleted",           Icon: Trash2,       color: "text-red-600",    bg: "bg-red-50",     category: "admin" },
  staff_created:             { label: "Staff Created",          Icon: UserPlus,     color: "text-blue-600",   bg: "bg-blue-50",    category: "admin" },
  staff_deleted:             { label: "Staff Removed",          Icon: Trash2,       color: "text-red-600",    bg: "bg-red-50",     category: "admin" },
  staff_permissions_updated: { label: "Permissions Updated",    Icon: Shield,       color: "text-indigo-600", bg: "bg-indigo-50",  category: "admin" },
  package_created:           { label: "Package Created",        Icon: ShoppingCart,  color: "text-green-600",  bg: "bg-green-50",   category: "admin" },
  package_updated:           { label: "Package Updated",        Icon: Pencil,       color: "text-blue-600",   bg: "bg-blue-50",    category: "admin" },
  package_deleted:           { label: "Package Deleted",        Icon: Trash2,       color: "text-red-600",    bg: "bg-red-50",     category: "admin" },
  agent_approved:            { label: "Agent Approved",         Icon: CheckCircle2, color: "text-emerald-600",bg: "bg-emerald-50", category: "admin" },
  agent_rejected:            { label: "Agent Rejected",         Icon: XCircle,      color: "text-red-600",    bg: "bg-red-50",     category: "admin" },
  agent_discount_applied:    { label: "Discount Applied",       Icon: Tag,          color: "text-purple-600", bg: "bg-purple-50",  category: "admin" },
  booking_form_updated:      { label: "Booking Form Updated",   Icon: Pencil,       color: "text-slate-600",  bg: "bg-slate-50",   category: "admin" },
  settings_updated:          { label: "Settings Updated",       Icon: Settings,     color: "text-gray-600",   bg: "bg-gray-50",    category: "admin" },
};

const CATEGORIES = [
  { id: "all",      label: "All Activity",     count_key: null },
  { id: "staff",    label: "Staff Actions",    count_key: "staff" },
  { id: "admin",    label: "Admin Actions",    count_key: "admin" },
  { id: "agent",    label: "Agent Activity",   count_key: "agent" },
  { id: "payments", label: "Payment Events",   count_key: "payments" },
  { id: "pilgrim",  label: "Pilgrim Activity", count_key: "pilgrim" },
];

async function fetchActivity(params: Record<string, string>): Promise<{ activities: Activity[]; total: number }> {
  const q = new URLSearchParams(params);
  const r = await fetch(`/api/admin/activity?${q}`, { credentials: "include" });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

function ContactButtons({ phone, email, name }: { phone?: string; email?: string; name?: string }) {
  if (!phone && !email) return null;
  return (
    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
      <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider mr-0.5">Contact:</span>
      {phone && (
        <a href={`tel:${phone}`}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl hover:bg-red-100 transition-colors"
          onClick={e => e.stopPropagation()}>
          <Phone className="w-3 h-3" /> {phone}
        </a>
      )}
      {email && (
        <a href={`mailto:${email}?subject=Payment Issue - ${name || ""}`}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold rounded-xl hover:bg-orange-100 transition-colors"
          onClick={e => e.stopPropagation()}>
          <Mail className="w-3 h-3" /> {email}
        </a>
      )}
    </div>
  );
}

function ActivityRow({ a }: { a: Activity }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = EVENT_CONFIG[a.eventType] ?? { label: a.eventType.replace(/_/g, " "), Icon: History, color: "text-gray-600", bg: "bg-gray-100", category: "other" };
  const { Icon } = cfg;
  const meta = (a.metadata || {}) as ActivityMeta;

  const isStaffAction = !!meta.actorRole;
  const actorName = isStaffAction ? meta.actorName : a.user?.fullName;
  const targetName = meta.targetName;
  const isPaymentFailed = a.eventType === "payment_failed";

  // For payment_failed: get contact from metadata
  const contactPhone = isPaymentFailed ? (meta.targetPhone ?? a.user?.phone) : undefined;
  const contactEmail = isPaymentFailed ? (meta.targetEmail ?? a.user?.email) : undefined;
  const contactName = meta.targetName ?? a.user?.fullName;

  const hasExpandable = Object.keys(meta).length > 0;

  return (
    <div
      className={`border-b border-[#F1F5F9] last:border-0 transition-colors ${isPaymentFailed ? "bg-red-50/40 hover:bg-red-50/60" : "hover:bg-[#F8FAFF]"}`}
      onClick={() => hasExpandable && setExpanded(e => !e)}>
      <div className="flex items-center gap-4 px-5 py-3.5">
        {/* Icon */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
          <Icon className={`w-4 h-4 ${cfg.color}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className={`text-sm font-bold capitalize ${isPaymentFailed ? "text-red-700" : "text-[#0F172A]"}`}>
              {cfg.label}
            </span>
            {isPaymentFailed && (
              <span className="text-[10px] bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-black animate-pulse">
                FAILED — needs follow-up
              </span>
            )}
            {a.bookingId && (
              <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-bold">BKG</span>
            )}
          </div>

          {/* Actor → Target */}
          <div className="flex items-center gap-1.5 text-xs text-[#64748B] flex-wrap">
            {isStaffAction && actorName ? (
              <>
                <span className="flex items-center gap-1 font-semibold text-[#2D3199]">
                  <User className="w-3 h-3" /> {actorName}
                </span>
                <span className="text-[#CBD5E1]">→</span>
                {targetName && <span className="font-medium">{targetName}</span>}
              </>
            ) : (
              <span>{actorName || a.user?.email}</span>
            )}
            {meta.amount && (
              <><span className="text-[#CBD5E1]">·</span><span className="font-bold text-emerald-700">₦{Number(meta.amount).toLocaleString()}</span></>
            )}
            {meta.reference && (
              <><span className="text-[#CBD5E1]">·</span><span className="font-mono text-[10px] text-[#94A3B8]">{meta.reference}</span></>
            )}
          </div>

          {/* Contact buttons for failed payments */}
          {isPaymentFailed && (
            <ContactButtons phone={contactPhone} email={contactEmail} name={contactName} />
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <Avatar className="h-7 w-7">
            <AvatarImage src={a.user?.avatarUrl} />
            <AvatarFallback className={`text-[10px] font-black ${isStaffAction ? "bg-[#2D3199] text-white" : "bg-[#EEF0FF] text-[#2D3199]"}`}>
              {(actorName || "?").charAt(0)}
            </AvatarFallback>
          </Avatar>
          <span className="text-[11px] text-[#94A3B8] whitespace-nowrap min-w-[80px] text-right">
            {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
          </span>
          {hasExpandable && (
            <button className="text-[#94A3B8] hover:text-[#2D3199] transition-colors">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded metadata */}
      {expanded && (
        <div className="px-5 pb-4 pt-0">
          <div className="ml-[52px] bg-white rounded-xl border border-[#EEF0FF] p-3 text-xs space-y-2">
            {meta.actorName && (
              <div className="flex gap-2">
                <span className="text-[#94A3B8] w-28 flex-shrink-0">Performed by</span>
                <span className="font-bold text-[#0F172A]">{meta.actorName} <span className="text-[#94A3B8] font-normal capitalize">({meta.actorRole?.replace(/_/g, " ")})</span></span>
              </div>
            )}
            {meta.targetName && (
              <div className="flex gap-2">
                <span className="text-[#94A3B8] w-28 flex-shrink-0">Pilgrim</span>
                <span className="font-bold text-[#0F172A]">{meta.targetName}</span>
              </div>
            )}
            {meta.targetPhone && (
              <div className="flex gap-2">
                <span className="text-[#94A3B8] w-28 flex-shrink-0">Phone</span>
                <a href={`tel:${meta.targetPhone}`} className="text-[#2D3199] font-bold hover:underline">{meta.targetPhone}</a>
              </div>
            )}
            {meta.targetEmail && (
              <div className="flex gap-2">
                <span className="text-[#94A3B8] w-28 flex-shrink-0">Email</span>
                <a href={`mailto:${meta.targetEmail}`} className="text-[#2D3199] font-bold hover:underline">{meta.targetEmail}</a>
              </div>
            )}
            {meta.amount && (
              <div className="flex gap-2">
                <span className="text-[#94A3B8] w-28 flex-shrink-0">Amount</span>
                <span className="font-bold text-[#0F172A]">₦{Number(meta.amount).toLocaleString()}</span>
              </div>
            )}
            {meta.reference && (
              <div className="flex gap-2">
                <span className="text-[#94A3B8] w-28 flex-shrink-0">Reference</span>
                <span className="font-mono text-[#0F172A]">{meta.reference}</span>
              </div>
            )}
            {meta.changedFields && meta.changedFields.length > 0 && (
              <div className="flex gap-2">
                <span className="text-[#94A3B8] w-28 flex-shrink-0">Changed Fields</span>
                <span className="text-[#0F172A]">{meta.changedFields.map(f => f.replace(/([A-Z])/g, " $1")).join(", ")}</span>
              </div>
            )}
            <div className="flex gap-2 pt-1 border-t border-[#F1F5F9]">
              <span className="text-[#94A3B8] w-28 flex-shrink-0">Exact time</span>
              <span className="text-[#64748B]">{format(new Date(a.createdAt), "dd MMM yyyy, HH:mm:ss")}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminActivity() {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;

  const params: Record<string, string> = { 
    limit: String(PAGE_SIZE), 
    offset: String((page - 1) * PAGE_SIZE) 
  };
  if (category !== "all") params.category = category;
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo) params.dateTo = dateTo;
  if (search) params.search = search;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-activity", category, dateFrom, dateTo, search, page],
    queryFn: () => fetchActivity(params),
    refetchInterval: 15000,
  });

  const activities = data?.activities || [];

  const failedPayments = useMemo(() => activities.filter(a => a.eventType === "payment_failed"), [activities]);

  // Date group helpers
  const grouped = useMemo(() => {
    const groups: { label: string; items: Activity[] }[] = [];
    let lastLabel = "";
    for (const a of activities) {
      const d = new Date(a.createdAt);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const isYesterday = d.toDateString() === new Date(Date.now() - 86400000).toDateString();
      const label = isToday ? "Today" : isYesterday ? "Yesterday" : format(d, "EEEE, d MMMM yyyy");
      if (label !== lastLabel) { groups.push({ label, items: [] }); lastLabel = label; }
      groups[groups.length - 1].items.push(a);
    }
    return groups;
  }, [activities]);

  return (
    <div className="space-y-5" data-testid="page-admin-activity">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[#2D3199] text-xs font-bold uppercase tracking-widest mb-1">System</p>
          <h1 className="text-2xl font-black text-[#0F172A]">Activity Log</h1>
          <p className="text-[#64748B] text-sm mt-0.5">Full audit trail — track every action across your platform</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#DCE3F0] rounded-xl text-xs font-bold text-[#64748B] hover:text-[#2D3199] hover:border-[#2D3199] transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Failed payment alert */}
      {failedPayments.length > 0 && category === "all" && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-700">{failedPayments.length} failed payment{failedPayments.length !== 1 ? "s" : ""} need follow-up</p>
            <p className="text-xs text-red-600 mt-0.5">Click the "Payment Events" tab to filter and view contact details</p>
          </div>
          <button onClick={() => { setCategory("payments"); setPage(1); }} className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors whitespace-nowrap">
            View All
          </button>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-1.5 bg-white rounded-2xl border border-[#DCE3F0] p-1 shadow-sm w-fit">
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => { setCategory(cat.id); setPage(1); }}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${category === cat.id ? "bg-[#2D3199] text-white shadow-sm" : "text-[#64748B] hover:text-[#2D3199]"}`}>
            {cat.label}
            {cat.id === "payments" && failedPayments.length > 0 && (
              <span className="bg-red-500 text-white text-[9px] rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 font-black">
                {failedPayments.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search + filters row */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, email, reference…"
            className="pl-9 rounded-xl border-[#DCE3F0] bg-white h-9" />
        </div>
        <button onClick={() => setShowFilters(f => !f)}
          className={`flex items-center gap-1.5 px-3 h-9 rounded-xl border text-xs font-bold transition-all ${showFilters || dateFrom || dateTo ? "bg-[#EEF0FF] border-[#2D3199] text-[#2D3199]" : "bg-white border-[#DCE3F0] text-[#64748B] hover:border-[#2D3199]"}`}>
          <Filter className="w-3.5 h-3.5" /> Date Filter {(dateFrom || dateTo) && "•"}
        </button>
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(""); setDateTo(""); }}
            className="px-3 h-9 rounded-xl bg-[#FFF1F0] border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50">
            Clear dates
          </button>
        )}
      </div>

      {showFilters && (
        <div className="flex gap-3 flex-wrap bg-white rounded-2xl border border-[#DCE3F0] p-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#94A3B8]" />
            <span className="text-xs font-bold text-[#64748B] whitespace-nowrap">From</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-[#DCE3F0] rounded-xl px-3 py-1.5 text-xs font-medium outline-none focus:border-[#2D3199] transition-all" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#64748B] whitespace-nowrap">To</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-[#DCE3F0] rounded-xl px-3 py-1.5 text-xs font-medium outline-none focus:border-[#2D3199] transition-all" />
          </div>
        </div>
      )}

      {/* Activity list */}
      <div className="bg-white rounded-2xl border border-[#DCE3F0] overflow-hidden shadow-[0_2px_16px_rgba(45,49,153,0.05)]">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-[#F8FAFF] rounded-xl animate-pulse" />)}
          </div>
        ) : activities.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#EEF0FF] flex items-center justify-center mx-auto mb-4">
              <History className="w-6 h-6 text-[#CBD5E1]" />
            </div>
            <p className="font-bold text-[#64748B] mb-1">No activity found</p>
            <p className="text-sm text-[#94A3B8]">Try adjusting your filters or check back later</p>
          </div>
        ) : (
          grouped.map(group => (
            <div key={group.label}>
              <div className="px-5 py-2 bg-[#F8FAFF] border-b border-[#F1F5F9] flex items-center gap-2">
                <span className="text-[10px] font-black text-[#94A3B8] uppercase tracking-[0.15em]">{group.label}</span>
                <span className="text-[10px] text-[#CBD5E1]">· {group.items.length} event{group.items.length !== 1 ? "s" : ""}</span>
              </div>
              {group.items.map(a => <ActivityRow key={a.id} a={a} />)}
            </div>
          ))
        )}
      </div>

      {/* Pagination controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 px-2 py-2">
        <p className="text-center text-xs text-[#94A3B8]">
          Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data?.total ?? 0)} of {data?.total ?? 0} events · Auto-refreshes
        </p>
        <div className="flex gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg border text-xs font-bold text-[#64748B] bg-white hover:bg-[#F8FAFF] disabled:opacity-40 transition-colors">← Prev</button>
          <span className="px-3 py-1.5 rounded-lg text-xs font-black text-[#2D3199] bg-[#EEF0FF]">
            {page} / {Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))}
          </span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil((data?.total ?? 0) / PAGE_SIZE)} className="px-3 py-1.5 rounded-lg border text-xs font-bold text-[#64748B] bg-white hover:bg-[#F8FAFF] disabled:opacity-40 transition-colors">Next →</button>
        </div>
      </div>
    </div>
  );
}
