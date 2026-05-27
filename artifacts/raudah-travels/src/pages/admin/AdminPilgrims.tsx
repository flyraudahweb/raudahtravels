import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Search, ChevronRight, BookOpen, Phone, CreditCard, Calendar,
  MapPin, Download, FileText, Globe, UserCheck, X, Filter, Plane, Home, User,
  Mail, Badge, Clock, Shield, Heart, AlertCircle, CheckCircle2, Printer,
  Plus, Loader2,
} from "lucide-react";

const statusStyle: Record<string, string> = {
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending:   "bg-amber-50 text-amber-700 border-amber-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
};

const INDIGO_SHADES = ["#2D3199","#4C56B8","#6C74CD","#8C93DC","#FF3B00","#10B981","#F59E0B","#8B5CF6"];

type PilgrimRow = {
  id: string;
  userId: string;
  reference?: string | null;
  status: string;
  totalPrice: number;
  amountPaid: number;
  fullName?: string | null;
  civility?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  passportNumber?: string | null;
  passportExpiry?: string | null;
  passportIssueDate?: string | null;
  passportIssuingAuthority?: string | null;
  passportCopyUrl?: string | null;
  profilePhotoUrl?: string | null;
  visaNumber?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  nationality?: string | null;
  ethnicGroup?: string | null;
  levelOfStudy?: string | null;
  maritalStatus?: string | null;
  occupation?: string | null;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  placeOfBirth?: string | null;
  partner?: string | null;
  underCover?: string | null;
  observation?: string | null;
  fathersName?: string | null;
  mothersName?: string | null;
  mahramName?: string | null;
  mahramRelationship?: string | null;
  departureCity?: string | null;
  roomPreference?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  agentId?: string | null;
  registeredByStaffId?: string | null;
  agentBusinessName?: string | null;
  registeredByStaffName?: string | null;
  visaDeliveryMessage?: string | null;
  createdAt: string;
  package?: { id: string; name: string; type: string; category: string } | null;
  user?: { id: string; fullName: string; email: string; phone?: string | null } | null;
};

function paymentStatus(p: PilgrimRow) {
  if (!p.totalPrice) return "unknown";
  if (p.amountPaid >= p.totalPrice) return "paid";
  if (p.amountPaid > 0) return "partial";
  return "unpaid";
}

function visaStatus(p: PilgrimRow) {
  return p.visaDeliveryMessage ? "issued" : "pending";
}

const statusConfig: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  confirmed: { label: "Confirmed",  dot: "bg-emerald-400", bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200" },
  pending:   { label: "Pending",    dot: "bg-amber-400",   bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-200"   },
  cancelled: { label: "Cancelled",  dot: "bg-red-400",     bg: "bg-red-50",      text: "text-red-700",     border: "border-red-200"     },
  completed: { label: "Completed",  dot: "bg-blue-400",    bg: "bg-blue-50",     text: "text-blue-700",    border: "border-blue-200"    },
};

function DetailField({ label, value, icon: Icon, full = false }: {
  label: string; value?: string | null; icon?: React.ElementType; full?: boolean;
}) {
  if (!value) return null;
  return (
    <div className={`${full ? "col-span-2" : ""} group`}>
      <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-[.12em] mb-1 flex items-center gap-1">
        {Icon && <Icon className="w-2.5 h-2.5" />}
        {label}
      </p>
      <p className="text-sm font-semibold text-[#0F172A] break-words leading-snug">{value}</p>
    </div>
  );
}

function DetailSection({ title, icon: Icon, accent = "#2D3199", children }: {
  title: string; icon: React.ElementType; accent?: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#E2E8F0]"
           style={{ background: `${accent}08` }}>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
             style={{ background: accent }}>
          <Icon className="w-3 h-3 text-white" />
        </div>
        <h4 className="text-xs font-black text-[#0F172A] uppercase tracking-wide">{title}</h4>
      </div>
      <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-4">
        {children}
      </div>
    </div>
  );
}

function resolveDisplayName(p: PilgrimRow) {
  if (p.fullName) return p.fullName;
  const parts = [p.civility, p.firstName, p.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : "—";
}

const VISA_SM: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  pending:   { label: "Pending",   color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-400" },
  submitted: { label: "Submitted", color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200",    dot: "bg-blue-500" },
  approved:  { label: "Approved",  color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-400" },
  rejected:  { label: "Rejected",  color: "text-red-600",     bg: "bg-red-50",     border: "border-red-200",     dot: "bg-red-400" },
};

function PilgrimDetailDialog({ pilgrim, onClose }: { pilgrim: PilgrimRow; onClose: () => void }) {
  const [tab, setTab] = useState<"overview" | "personal" | "travel" | "family">("overview");
  const { toast } = useToast();
  const qc = useQueryClient();
  const paid = paymentStatus(pilgrim);
  const sc = statusConfig[pilgrim.status] ?? statusConfig.pending;

  // Record Payment state
  const [showRecordPay, setShowRecordPay] = useState(false);
  const [rpAmount, setRpAmount] = useState("");
  const [rpMethod, setRpMethod] = useState("cash");
  const [rpRef, setRpRef] = useState("");
  const [rpNotes, setRpNotes] = useState("");
  const [rpVerify, setRpVerify] = useState(true);
  const [rpLoading, setRpLoading] = useState(false);

  const openRecordPay = () => {
    const bal = Math.max(0, pilgrim.totalPrice - pilgrim.amountPaid);
    setRpAmount(bal.toString());
    setRpMethod("cash");
    setRpRef("");
    setRpNotes("");
    setRpVerify(true);
    setShowRecordPay(true);
  };

  const handleRecordPay = async () => {
    if (rpLoading) return;
    const amt = parseFloat(rpAmount);
    if (isNaN(amt) || amt <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    setRpLoading(true);
    try {
      const res = await fetch("/api/payments/admin-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          bookingId: pilgrim.id,
          amount: amt,
          method: rpMethod,
          reference: rpRef || undefined,
          notes: rpNotes || undefined,
          markVerified: rpVerify,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to record payment" }));
        throw new Error(err.error || err.message || "Failed to record payment");
      }
      toast({ title: "Payment recorded successfully" });
      // Invalidate all relevant caches so every page stays in sync
      qc.invalidateQueries({ queryKey: ["admin-pilgrims"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      setShowRecordPay(false);
      onClose(); // Close detail to force refresh
    } catch (e: any) {
      toast({ title: e.message || "Failed to record payment", variant: "destructive" });
    } finally {
      setRpLoading(false);
    }
  };

  const { data: visaData } = useQuery({
    queryKey: ["pilgrim-visa-detail", pilgrim.id],
    queryFn: () => fetch(`/api/admin/visa?bookingId=${pilgrim.id}`, { credentials: "include" }).then(r => r.json()),
    staleTime: 0,
  });
  const liveVisa = visaData?.visas?.[0] as { status: string; visaNumber?: string; visaDocumentUrl?: string; ticketDocumentUrl?: string } | undefined;
  const visaKey = liveVisa?.status ?? (pilgrim.visaDeliveryMessage ? "approved" : "pending");
  const vsm = VISA_SM[visaKey] ?? VISA_SM.pending;
  const paidPct = pilgrim.totalPrice > 0 ? Math.min(100, Math.round(pilgrim.amountPaid / pilgrim.totalPrice * 100)) : 0;
  const displayName = resolveDisplayName(pilgrim);
  const initials = displayName === "—" ? "?" : displayName.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  const avatarColor = (() => {
    const hash = (pilgrim.userId || "x").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return INDIGO_SHADES[hash % INDIGO_SHADES.length];
  })();

  const tabs = [
    { id: "overview", label: "Overview",  icon: BookOpen },
    { id: "personal", label: "Personal",  icon: User },
    { id: "travel",   label: "Travel",    icon: Plane },
    { id: "family",   label: "Family",    icon: Heart },
  ] as const;

  return (
    <>
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-hidden rounded-3xl p-0 flex flex-col">
        <DialogTitle className="sr-only">Pilgrim Profile — {pilgrim.fullName}</DialogTitle>

        {/* ── Hero Banner ── */}
        <div className="relative shrink-0 overflow-hidden rounded-t-3xl"
             style={{ background: "linear-gradient(135deg, #0D0F4E 0%, #1C1F66 40%, #2D3199 75%, #3D47B5 100%)" }}>

          {/* decorative circles */}
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-[.06]"
               style={{ background: "#FF3B00" }} />
          <div className="absolute -bottom-16 left-[30%] w-60 h-60 rounded-full opacity-[.04]"
               style={{ background: "#fff" }} />
          <div className="absolute top-3 right-[30%] w-20 h-20 rounded-full opacity-[.03]"
               style={{ background: "#fff" }} />

          <div className="relative z-10 p-6 pb-5">
            <div className="flex items-start justify-between gap-4">
              {/* Left: avatar + name */}
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  {pilgrim.profilePhotoUrl ? (
                    <img src={pilgrim.profilePhotoUrl} alt={displayName}
                         className="w-16 h-16 rounded-2xl object-cover ring-4 ring-white/20 shadow-lg" />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-black ring-4 ring-white/20 shadow-lg"
                         style={{ background: avatarColor }}>
                      {initials}
                    </div>
                  )}
                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[#1C1F66] flex items-center justify-center ${sc.dot}`} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white leading-tight">{displayName}</h3>
                  {(pilgrim.email || pilgrim.user?.email) && (
                    <p className="text-white/60 text-xs mt-0.5 flex items-center gap-1">
                      <Mail className="w-3 h-3" />{pilgrim.email || pilgrim.user?.email}
                    </p>
                  )}
                  {(pilgrim.phone || pilgrim.user?.phone) && (
                    <p className="text-white/60 text-xs mt-0.5 flex items-center gap-1">
                      <Phone className="w-3 h-3" />{pilgrim.phone || pilgrim.user?.phone}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                      {sc.label}
                    </span>
                    {pilgrim.package?.type && (
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-white/10 text-white border-white/20 capitalize">
                        {pilgrim.package.type}
                      </span>
                    )}
                    {pilgrim.reference && (
                      <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-white/8 text-white/70 border border-white/15">
                        {pilgrim.reference}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: close + print */}
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Payment progress ── */}
            <div className="mt-5 bg-white/8 rounded-2xl p-3.5 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-white/55 uppercase tracking-widest">Payment Progress</span>
                <span className="text-[10px] font-black text-white">{paidPct}% paid</span>
              </div>
              <div className="w-full h-2 bg-white/15 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                     style={{
                       width: `${paidPct}%`,
                       background: paidPct >= 100 ? "#10B981" : paidPct > 0 ? "#FF3B00" : "#EF4444",
                     }} />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-white text-xs font-black">₦{pilgrim.amountPaid.toLocaleString()}</span>
                <span className="text-white/45 text-[10px]">of ₦{pilgrim.totalPrice.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* ── Tabs inside hero ── */}
          <div className="relative z-10 flex px-6 gap-0.5">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all ${
                  tab === t.id
                    ? "bg-white text-[#2D3199]"
                    : "text-white/55 hover:text-white/90 hover:bg-white/10"
                }`}>
                <t.icon className="w-3 h-3" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab Content ── */}
        <div className="flex-1 overflow-y-auto bg-[#F8F9FF]">
          <div className="p-5 space-y-4">

            {/* ── OVERVIEW TAB ── */}
            {tab === "overview" && (
              <>
                {/* 3-stat row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      label: "Total Price",
                      value: `₦${pilgrim.totalPrice.toLocaleString()}`,
                      icon: CreditCard,
                      color: "#2D3199",
                      bg: "#EEF0FF",
                    },
                    {
                      label: "Amount Paid",
                      value: `₦${pilgrim.amountPaid.toLocaleString()}`,
                      icon: CheckCircle2,
                      color: paidPct >= 100 ? "#10B981" : "#FF3B00",
                      bg: paidPct >= 100 ? "#ECFDF5" : "#FFF4F1",
                    },
                    {
                      label: "Outstanding",
                      value: `₦${Math.max(0, pilgrim.totalPrice - pilgrim.amountPaid).toLocaleString()}`,
                      icon: AlertCircle,
                      color: pilgrim.amountPaid >= pilgrim.totalPrice ? "#10B981" : "#F59E0B",
                      bg: pilgrim.amountPaid >= pilgrim.totalPrice ? "#ECFDF5" : "#FFFBEB",
                    },
                  ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2.5"
                           style={{ background: s.bg }}>
                        <s.icon className="w-4 h-4" style={{ color: s.color }} />
                      </div>
                      <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest mb-1">{s.label}</p>
                      <p className="text-base font-black text-[#0F172A] leading-tight">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Package card */}
                {pilgrim.package && (
                  <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 p-4">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                           style={{ background: "linear-gradient(135deg, #2D3199, #4C56B8)" }}>
                        <Plane className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-[#0F172A] text-sm leading-tight truncate">{pilgrim.package.name}</p>
                        <p className="text-xs text-[#64748B] capitalize mt-0.5">{pilgrim.package.type} · {pilgrim.package.category}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full capitalize"
                              style={{
                                background: pilgrim.package.type === "hajj" ? "#EEF0FF" : "#FFF7ED",
                                color:      pilgrim.package.type === "hajj" ? "#2D3199"  : "#C2410C",
                              }}>
                          {pilgrim.package.type}
                        </span>
                      </div>
                    </div>
                    {pilgrim.departureCity && (
                      <div className="border-t border-[#F1F5F9] px-4 py-2.5 flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-[#94A3B8]" />
                        <span className="text-xs text-[#64748B]">Departs from <strong className="text-[#0F172A]">{pilgrim.departureCity}</strong></span>
                      </div>
                    )}
                    {pilgrim.roomPreference && (
                      <div className="border-t border-[#F1F5F9] px-4 py-2.5 flex items-center gap-2">
                        <Home className="w-3.5 h-3.5 text-[#94A3B8]" />
                        <span className="text-xs text-[#64748B]">Room: <strong className="text-[#0F172A]">{pilgrim.roomPreference}</strong></span>
                      </div>
                    )}
                  </div>
                )}

                {/* Status chips row */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Visa status */}
                  <div className={`bg-white rounded-2xl border p-4 flex items-center gap-3 shadow-sm ${vsm.border}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${vsm.bg}`}>
                      <Shield className={`w-4 h-4 ${vsm.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest">Visa Status</p>
                      <p className={`text-sm font-black mt-0.5 ${vsm.color}`}>{vsm.label}</p>
                      {liveVisa?.visaNumber && (
                        <p className="text-[10px] text-[#94A3B8] font-mono truncate mt-0.5">{liveVisa.visaNumber}</p>
                      )}
                    </div>
                  </div>
                  {/* Payment badge */}
                  <div className={`bg-white rounded-2xl border p-4 flex items-center gap-3 shadow-sm ${
                    paid === "paid" ? "border-emerald-200" : paid === "partial" ? "border-amber-200" : "border-red-200"
                  }`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      paid === "paid" ? "bg-emerald-50" : paid === "partial" ? "bg-amber-50" : "bg-red-50"
                    }`}>
                      <CreditCard className={`w-4 h-4 ${
                        paid === "paid" ? "text-emerald-600" : paid === "partial" ? "text-amber-500" : "text-red-500"
                      }`} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest">Payment</p>
                      <p className={`text-sm font-black mt-0.5 ${
                        paid === "paid" ? "text-emerald-700" : paid === "partial" ? "text-amber-700" : "text-red-700"
                      }`}>
                        {paid === "paid" ? "Fully Paid" : paid === "partial" ? "Partial" : "Unpaid"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Record Payment button */}
                {pilgrim.totalPrice - pilgrim.amountPaid > 0 && (
                  <button onClick={openRecordPay}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#FF3B00] hover:bg-[#CC2E00] text-white text-sm font-bold rounded-2xl transition-colors shadow-sm">
                    <Plus className="w-4 h-4" /> Record Payment · ₦{Math.max(0, pilgrim.totalPrice - pilgrim.amountPaid).toLocaleString()} outstanding
                  </button>
                )}

                {/* Visa note */}
                {pilgrim.visaDeliveryMessage && (
                  <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
                    <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest mb-2 flex items-center gap-1">
                      <Globe className="w-3 h-3" /> Visa Note
                    </p>
                    <p className="text-sm text-[#334155] leading-relaxed">{pilgrim.visaDeliveryMessage}</p>
                  </div>
                )}

                {/* Registration footer */}
                <div className="flex items-center gap-2 px-1 text-xs text-[#94A3B8]">
                  <Clock className="w-3.5 h-3.5" />
                  Registered {new Date(pilgrim.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}
                  {pilgrim.agentId && (
                    <span className="ml-3 text-[#2D3199] font-bold">· Via Agent</span>
                  )}
                </div>
              </>
            )}

            {/* ── PERSONAL TAB ── */}
            {tab === "personal" && (
              <div className="space-y-4">
                <DetailSection title="Identity" icon={User} accent="#2D3199">
                  {pilgrim.civility && (
                    <DetailField label="Civility" value={pilgrim.civility} />
                  )}
                  <DetailField label="First Name"     value={pilgrim.firstName} />
                  <DetailField label="Last Name"      value={pilgrim.lastName} />
                  <DetailField label="Full Name"      value={pilgrim.fullName} icon={User} full />
                  <DetailField label="Gender"         value={pilgrim.gender ? pilgrim.gender.charAt(0).toUpperCase() + pilgrim.gender.slice(1) : null} />
                  <DetailField label="Date of Birth"  value={pilgrim.dateOfBirth}    icon={Calendar} />
                  <DetailField label="Place of Birth" value={pilgrim.placeOfBirth} />
                  <DetailField label="Nationality"    value={pilgrim.nationality}    icon={Globe} />
                  <DetailField label="Ethnic Group"   value={pilgrim.ethnicGroup} />
                  <DetailField label="Marital Status" value={pilgrim.maritalStatus} />
                  <DetailField label="Level of Study" value={pilgrim.levelOfStudy} />
                  <DetailField label="Occupation"     value={pilgrim.occupation} />
                </DetailSection>
                <DetailSection title="Contact & Location" icon={Phone} accent="#10B981">
                  <DetailField label="Phone (WhatsApp)" value={pilgrim.phone || pilgrim.user?.phone} icon={Phone} />
                  <DetailField label="Email"            value={pilgrim.email || pilgrim.user?.email} icon={Mail} full />
                  <DetailField label="Country"          value={pilgrim.country}  icon={Globe} />
                  <DetailField label="City"             value={pilgrim.city}     icon={MapPin} />
                  <DetailField label="Address"          value={pilgrim.address}  icon={MapPin} full />
                </DetailSection>
                {(pilgrim.partner || pilgrim.underCover || pilgrim.observation) && (
                  <DetailSection title="Additional Notes" icon={Badge} accent="#8B5CF6">
                    <DetailField label="Partner / Mahram" value={pilgrim.partner} />
                    <DetailField label="Under Cover"      value={pilgrim.underCover} />
                    <DetailField label="Observation"      value={pilgrim.observation} full />
                  </DetailSection>
                )}
              </div>
            )}

            {/* ── TRAVEL TAB ── */}
            {tab === "travel" && (
              <div className="space-y-4">
                <DetailSection title="Passport & Documents" icon={FileText} accent="#FF3B00">
                  <DetailField label="Passport Number"       value={pilgrim.passportNumber}         icon={FileText} />
                  <DetailField label="Date of Issue"         value={pilgrim.passportIssueDate}      icon={Calendar} />
                  <DetailField label="Passport Expiry"       value={pilgrim.passportExpiry}         icon={Calendar} />
                  <DetailField label="Issuing Authority"     value={pilgrim.passportIssuingAuthority} />
                  <DetailField label="Nationality"           value={pilgrim.nationality}            icon={Globe} />
                  <DetailField label="N° Visa"               value={pilgrim.visaNumber} />
                </DetailSection>

                {(pilgrim.passportCopyUrl || pilgrim.profilePhotoUrl) && (
                  <div className="rounded-2xl border border-[#E2E8F0] overflow-hidden">
                    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#E2E8F0]" style={{ background: "#FF3B0008" }}>
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#FF3B00" }}>
                        <FileText className="w-3 h-3 text-white" />
                      </div>
                      <h4 className="text-xs font-black text-[#0F172A] uppercase tracking-wide">Document Images</h4>
                    </div>
                    <div className="p-4 flex gap-4 flex-wrap">
                      {pilgrim.profilePhotoUrl && (
                        <div className="flex flex-col items-center gap-1.5">
                          <img src={pilgrim.profilePhotoUrl} alt="Profile Photo"
                               className="w-24 h-28 object-cover rounded-xl border border-[#E2E8F0] shadow-sm" />
                          <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest">Profile Photo</p>
                        </div>
                      )}
                      {pilgrim.passportCopyUrl && (
                        <div className="flex flex-col items-center gap-1.5">
                          <img src={pilgrim.passportCopyUrl} alt="Passport Copy"
                               className="w-36 h-28 object-cover rounded-xl border border-[#E2E8F0] shadow-sm" />
                          <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest">Passport Copy</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <DetailSection title="Travel Preferences" icon={Plane} accent="#2D3199">
                  <DetailField label="Departure City"  value={pilgrim.departureCity}  icon={MapPin} />
                  <DetailField label="Room Preference" value={pilgrim.roomPreference} icon={Home} />
                  <DetailField label="Package"         value={pilgrim.package?.name}  icon={BookOpen} full />
                </DetailSection>
                {(pilgrim.visaDeliveryMessage || liveVisa) && (
                  <DetailSection title="Visa Information" icon={Shield} accent="#10B981">
                    {pilgrim.visaDeliveryMessage && <DetailField label="Visa Note" value={pilgrim.visaDeliveryMessage} full />}
                    {liveVisa?.visaNumber && <DetailField label="Visa Number" value={liveVisa.visaNumber} icon={Shield} />}
                    {(liveVisa?.visaDocumentUrl || liveVisa?.ticketDocumentUrl) && (
                      <div className="col-span-2 flex flex-wrap gap-3 pt-1">
                        {liveVisa.visaDocumentUrl && (
                          <a
                            href={liveVisa.visaDocumentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl hover:bg-emerald-100 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download Visa Document
                          </a>
                        )}
                        {liveVisa.ticketDocumentUrl && (
                          <a
                            href={liveVisa.ticketDocumentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#F0F2FF] border border-[#C7CCF5] text-[#2D3199] text-xs font-bold rounded-xl hover:bg-[#E8EAFF] transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download Ticket
                          </a>
                        )}
                      </div>
                    )}
                  </DetailSection>
                )}
              </div>
            )}

            {/* ── FAMILY TAB ── */}
            {tab === "family" && (
              <div className="space-y-4">
                {(pilgrim.partner || pilgrim.underCover) ? (
                  <DetailSection title="Partner / Mahram" icon={UserCheck} accent="#2D3199">
                    <DetailField label="Partner / Mahram Name" value={pilgrim.partner} full />
                    <DetailField label="Under Cover"           value={pilgrim.underCover} />
                  </DetailSection>
                ) : null}
                {(pilgrim.fathersName || pilgrim.mothersName) ? (
                  <DetailSection title="Family Details" icon={Heart} accent="#8B5CF6">
                    <DetailField label="Father's Name" value={pilgrim.fathersName} />
                    <DetailField label="Mother's Name" value={pilgrim.mothersName} />
                  </DetailSection>
                ) : null}
                {(pilgrim.mahramName || pilgrim.mahramRelationship) ? (
                  <DetailSection title="Mahram Details" icon={UserCheck} accent="#2D3199">
                    <DetailField label="Mahram Name"         value={pilgrim.mahramName} />
                    <DetailField label="Mahram Relationship" value={pilgrim.mahramRelationship} />
                  </DetailSection>
                ) : null}
                {pilgrim.emergencyContactName ? (
                  <DetailSection title="Emergency Contact" icon={Phone} accent="#FF3B00">
                    <DetailField label="Contact Name"  value={pilgrim.emergencyContactName} />
                    <DetailField label="Contact Phone" value={pilgrim.emergencyContactPhone} icon={Phone} />
                  </DetailSection>
                ) : null}
                {!pilgrim.partner && !pilgrim.fathersName && !pilgrim.mothersName && !pilgrim.mahramName && !pilgrim.emergencyContactName && (
                  <div className="text-center py-12 text-[#94A3B8]">
                    <Heart className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-semibold">No family or emergency contact recorded</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

      {/* ── Record Payment Dialog ── */}
      <Dialog open={showRecordPay} onOpenChange={setShowRecordPay}>
        <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-[#F1F5F9]">
            <DialogTitle className="font-black text-[#0F172A]">Record Payment</DialogTitle>
            <div className="mt-1.5 space-y-0.5">
              <p className="text-sm text-[#334155] font-semibold">{resolveDisplayName(pilgrim)}</p>
              {pilgrim.reference && <p className="text-xs text-[#94A3B8] font-mono">Ref: {pilgrim.reference}</p>}
              <p className="text-xs font-bold text-[#FF3B00]">Balance: ₦{Math.max(0, pilgrim.totalPrice - pilgrim.amountPaid).toLocaleString()}</p>
            </div>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Amount (₦)</Label>
              <input type="number" min="0" step="0.01" value={rpAmount}
                onChange={e => setRpAmount(e.target.value)}
                className="w-full mt-1.5 px-3 py-2.5 text-sm rounded-xl border border-[#DCE3F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#2D3199]/20 focus:border-[#2D3199] font-bold text-[#0F172A]"
                placeholder="0.00" />
            </div>
            <div>
              <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Payment Method</Label>
              <Select value={rpMethod} onValueChange={setRpMethod}>
                <SelectTrigger className="mt-1.5 rounded-xl border-[#DCE3F0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Reference <span className="text-[#94A3B8] normal-case font-normal">(optional)</span></Label>
              <input type="text" value={rpRef}
                onChange={e => setRpRef(e.target.value)}
                className="w-full mt-1.5 px-3 py-2.5 text-sm rounded-xl border border-[#DCE3F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#2D3199]/20 focus:border-[#2D3199] text-[#334155]"
                placeholder="e.g. transaction ID or receipt number" />
            </div>
            <div>
              <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Notes <span className="text-[#94A3B8] normal-case font-normal">(optional)</span></Label>
              <Textarea value={rpNotes}
                onChange={e => setRpNotes(e.target.value)}
                className="mt-1.5 rounded-xl border-[#DCE3F0] resize-none"
                placeholder="Any additional details…" rows={2} />
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={rpVerify}
                onChange={e => setRpVerify(e.target.checked)}
                className="w-4 h-4 rounded border-[#DCE3F0] text-[#2D3199] focus:ring-[#2D3199]/20" />
              <span className="text-sm font-semibold text-[#334155]">Mark as Verified</span>
            </label>
          </div>
          <div className="px-6 pb-5 flex gap-3">
            <button onClick={() => setShowRecordPay(false)}
              className="flex-1 py-2.5 rounded-xl border border-[#DCE3F0] text-[#64748B] text-sm font-bold hover:bg-[#F8FAFC] transition-colors">
              Cancel
            </button>
            <button onClick={handleRecordPay}
              disabled={rpLoading || !rpAmount || parseFloat(rpAmount) <= 0}
              className="flex-1 py-2.5 rounded-xl bg-[#FF3B00] hover:bg-[#CC2E00] text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {rpLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Recording…</> : <><Plus className="w-4 h-4" /> Record Payment</>}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function exportExcel(pilgrims: PilgrimRow[]) {
  const headers = [
    "Reference","Civility","First Name","Last Name","Full Name",
    "Gender","Nationality","Ethnic Group","Level of Study","Date of Birth","Place of Birth","Marital Status","Occupation",
    "Phone","Email",
    "Country","City","Address",
    "Passport No","Date of Issue","Passport Expiry","Issuing Authority","N° Visa",
    "Partner / Mahram","Under Cover","Observation",
    "Package","Type","Category","Status","Total Price","Amount Paid","Payment Status",
    "Departure City","Room Preference","Agent ID","Registered",
  ];
  const rows = pilgrims.map(p => [
    p.reference ?? "",
    p.civility ?? "",
    p.firstName ?? "",
    p.lastName ?? "",
    p.fullName ?? "",
    p.gender ?? "",
    p.nationality ?? "",
    p.ethnicGroup ?? "",
    p.levelOfStudy ?? "",
    p.dateOfBirth ?? "",
    p.placeOfBirth ?? "",
    p.maritalStatus ?? "",
    p.occupation ?? "",
    p.phone ?? p.user?.phone ?? "",
    p.email ?? p.user?.email ?? "",
    p.country ?? "",
    p.city ?? "",
    p.address ?? "",
    p.passportNumber ?? "",
    p.passportIssueDate ?? "",
    p.passportExpiry ?? "",
    p.passportIssuingAuthority ?? "",
    p.visaNumber ?? "",
    p.partner ?? "",
    p.underCover ?? "",
    p.observation ?? "",
    p.package?.name ?? "",
    p.package?.type ?? "",
    p.package?.category ?? "",
    p.status,
    p.totalPrice,
    p.amountPaid,
    paymentStatus(p),
    p.departureCity ?? "",
    p.roomPreference ?? "",
    p.agentId ?? "",
    new Date(p.createdAt).toLocaleDateString("en-GB"),
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pilgrims");
  XLSX.writeFile(wb, `raudah-pilgrims-${new Date().toISOString().slice(0,10)}.xlsx`);
}

function exportPDF(pilgrims: PilgrimRow[]) {
  const logoUrl = `${window.location.origin}/logo.png`;
  const generatedOn = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const totalPaid = pilgrims.reduce((s, p) => s + p.amountPaid, 0);
  const totalExpected = pilgrims.reduce((s, p) => s + p.totalPrice, 0);
  const confirmed = pilgrims.filter(p => p.status === "confirmed").length;
  const hajjCount = pilgrims.filter(p => p.package?.type === "hajj").length;
  const umrahCount = pilgrims.filter(p => p.package?.type === "umrah").length;

  const fmt = (n: number) => `₦${n.toLocaleString()}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Pilgrims Report — Raudah Travels &amp; Tours</title>
  <link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Lato', Arial, sans-serif; font-size: 11px; color: #1E293B; background: #fff; }

    /* ── Cover header ── */
    .header {
      background: linear-gradient(135deg, #12145C 0%, #2D3199 55%, #4C56B8 100%);
      padding: 28px 36px 24px;
      color: #fff;
      position: relative;
      overflow: hidden;
    }
    .header::before {
      content: '';
      position: absolute;
      top: -40px; right: -40px;
      width: 200px; height: 200px;
      border-radius: 50%;
      background: rgba(255,255,255,0.05);
    }
    .header::after {
      content: '';
      position: absolute;
      bottom: -60px; left: 20%;
      width: 260px; height: 260px;
      border-radius: 50%;
      background: rgba(255,59,0,0.08);
    }
    .header-inner { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; position: relative; z-index: 1; }
    .logo-wrap { display: flex; align-items: center; gap: 14px; }
    .logo-wrap img { height: 44px; width: auto; filter: brightness(0) invert(1); }
    .brand-divider { width: 1px; height: 44px; background: rgba(255,255,255,0.25); }
    .brand-text h1 { font-size: 20px; font-weight: 900; letter-spacing: -0.3px; }
    .brand-text p { font-size: 11px; color: rgba(255,255,255,0.65); margin-top: 2px; }
    .doc-meta { text-align: right; }
    .doc-meta .doc-type { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; color: rgba(255,255,255,0.55); }
    .doc-meta .doc-date { font-size: 13px; font-weight: 700; margin-top: 3px; }
    .doc-meta .doc-count { font-size: 11px; color: rgba(255,255,255,0.7); margin-top: 2px; }

    /* orange accent bar */
    .accent-bar { height: 4px; background: linear-gradient(90deg, #FF3B00 0%, #FF6B35 50%, #2D3199 100%); }

    /* ── Stats row ── */
    .stats { display: flex; gap: 0; border-bottom: 1px solid #E2E8F0; }
    .stat { flex: 1; padding: 14px 18px; border-right: 1px solid #E2E8F0; }
    .stat:last-child { border-right: none; }
    .stat .s-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: #94A3B8; margin-bottom: 4px; }
    .stat .s-value { font-size: 18px; font-weight: 900; color: #0F172A; }
    .stat .s-sub { font-size: 9px; color: #64748B; margin-top: 2px; }
    .stat.orange .s-value { color: #FF3B00; }
    .stat.indigo .s-value { color: #2D3199; }

    /* ── Table ── */
    .table-wrap { padding: 20px 36px 0; }
    .section-label { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: .15em; color: #2D3199; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
    .section-label::after { content: ''; flex: 1; height: 1px; background: #E2E8F0; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: linear-gradient(90deg, #1C1F66, #2D3199); }
    thead th { color: #fff; padding: 8px 10px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; white-space: nowrap; }
    thead th:first-child { border-radius: 6px 0 0 6px; }
    thead th:last-child  { border-radius: 0 6px 6px 0; }
    tbody tr { border-bottom: 1px solid #F1F5F9; }
    tbody tr:nth-child(even) td { background: #F8F9FF; }
    tbody tr:hover td { background: #EEF0FF; }
    td { padding: 7px 10px; font-size: 10px; color: #334155; vertical-align: middle; }
    td.num { font-weight: 700; color: #0F172A; white-space: nowrap; }
    td.mono { font-family: 'Courier New', monospace; font-size: 9px; color: #64748B; }
    td.name { font-weight: 700; color: #0F172A; }
    .badge {
      display: inline-block; padding: 2px 7px; border-radius: 99px;
      font-size: 9px; font-weight: 700; text-transform: capitalize;
      border: 1px solid transparent;
    }
    .b-confirmed { background: #d1fae5; color: #065f46; border-color: #a7f3d0; }
    .b-pending   { background: #fef3c7; color: #92400e; border-color: #fde68a; }
    .b-cancelled { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
    .b-completed { background: #dbeafe; color: #1e40af; border-color: #bfdbfe; }
    .b-hajj      { background: #EEF0FF; color: #2D3199; border-color: #C5CAE9; }
    .b-umrah     { background: #fff7ed; color: #c2410c; border-color: #fed7aa; }
    .b-paid      { background: #d1fae5; color: #065f46; border-color: #a7f3d0; }
    .b-partial   { background: #fef3c7; color: #92400e; border-color: #fde68a; }
    .b-unpaid    { background: #fee2e2; color: #991b1b; border-color: #fecaca; }

    /* ── Footer ── */
    .footer {
      margin-top: 28px;
      padding: 16px 36px;
      background: #F8F9FF;
      border-top: 2px solid #E2E8F0;
      display: flex; align-items: center; justify-content: space-between;
    }
    .footer-left { font-size: 9px; color: #94A3B8; line-height: 1.6; }
    .footer-left strong { color: #2D3199; }
    .footer-right { font-size: 9px; color: #94A3B8; text-align: right; line-height: 1.6; }
    .footer-logo { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
    .footer-logo img { height: 22px; opacity: 0.6; }

    @media print {
      @page { size: A4 landscape; margin: 0; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="header-inner">
      <div class="logo-wrap">
        <img src="${logoUrl}" alt="Raudah Travels" onerror="this.style.display='none'" />
        <div class="brand-divider"></div>
        <div class="brand-text">
          <h1>Raudah Travels &amp; Tours</h1>
          <p>Nigeria's Most Trusted Pilgrimage Partner</p>
        </div>
      </div>
      <div class="doc-meta">
        <div class="doc-type">Pilgrims Directory Report</div>
        <div class="doc-date">${generatedOn}</div>
        <div class="doc-count">${pilgrims.length} record${pilgrims.length !== 1 ? "s" : ""} exported</div>
      </div>
    </div>
  </div>
  <div class="accent-bar"></div>

  <!-- Stats -->
  <div class="stats">
    <div class="stat indigo">
      <div class="s-label">Total Pilgrims</div>
      <div class="s-value">${pilgrims.length}</div>
      <div class="s-sub">in this report</div>
    </div>
    <div class="stat">
      <div class="s-label">Confirmed</div>
      <div class="s-value">${confirmed}</div>
      <div class="s-sub">${pilgrims.length ? Math.round(confirmed / pilgrims.length * 100) : 0}% of total</div>
    </div>
    <div class="stat">
      <div class="s-label">Hajj / Umrah</div>
      <div class="s-value">${hajjCount} / ${umrahCount}</div>
      <div class="s-sub">package split</div>
    </div>
    <div class="stat orange">
      <div class="s-label">Total Collected</div>
      <div class="s-value">${fmt(totalPaid)}</div>
      <div class="s-sub">of ${fmt(totalExpected)} expected</div>
    </div>
  </div>

  <!-- Table -->
  <div class="table-wrap">
    <div class="section-label">Pilgrim Records</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Reference</th>
          <th>Full Name</th>
          <th>Gender</th>
          <th>Nationality</th>
          <th>Phone</th>
          <th>Package</th>
          <th>Type</th>
          <th>Status</th>
          <th>Total Price</th>
          <th>Amount Paid</th>
          <th>Payment</th>
          <th>Departure</th>
          <th>Registered</th>
        </tr>
      </thead>
      <tbody>
        ${pilgrims.map((p, i) => {
          const paid = paymentStatus(p);
          return `<tr>
            <td style="color:#94A3B8;font-size:9px">${i + 1}</td>
            <td class="mono">${p.reference ?? "—"}</td>
            <td class="name">${p.fullName ?? "—"}</td>
            <td>${p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : "—"}</td>
            <td>${p.nationality ?? "—"}</td>
            <td>${p.phone ?? p.user?.phone ?? "—"}</td>
            <td style="max-width:140px;white-space:normal">${p.package?.name ?? "—"}</td>
            <td><span class="badge b-${p.package?.type ?? "hajj"}">${p.package?.type ?? "—"}</span></td>
            <td><span class="badge b-${p.status}">${p.status}</span></td>
            <td class="num">${fmt(p.totalPrice)}</td>
            <td class="num">${fmt(p.amountPaid)}</td>
            <td><span class="badge b-${paid}">${paid === "paid" ? "Paid" : paid === "partial" ? "Partial" : "Unpaid"}</span></td>
            <td>${p.departureCity ?? "—"}</td>
            <td style="color:#64748B">${new Date(p.createdAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">
      <div class="footer-logo">
        <img src="${logoUrl}" alt="" onerror="this.style.display='none'" />
        <strong>Raudah Travels &amp; Tours Ltd.</strong>
      </div>
      Lagos, Nigeria · www.raudahtravels.com · info@raudahtravels.com
    </div>
    <div class="footer-right">
      Confidential — Internal Use Only<br />
      Generated by Admin Console · ${generatedOn}<br />
      © ${new Date().getFullYear()} Raudah Travels &amp; Tours Ltd. All rights reserved.
    </div>
  </div>

</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 800);
}

const FILTER_ALL = "__all__";
const PAGE_SIZE = 50;

export default function AdminPilgrims() {
  const [search, setSearch]               = useState("");
  const [filterStatus, setFilterStatus]   = useState(FILTER_ALL);
  const [filterType, setFilterType]       = useState(FILTER_ALL);
  const [filterPayment, setFilterPayment] = useState(FILTER_ALL);
  const [filterGender, setFilterGender]   = useState(FILTER_ALL);
  const [filterVisa, setFilterVisa]       = useState(FILTER_ALL);
  const [filterAgent, setFilterAgent]     = useState(FILTER_ALL);
  const [filterStaff, setFilterStaff]     = useState(FILTER_ALL);
  const [page, setPage]                   = useState(1);
  const [selected, setSelected]           = useState<PilgrimRow | null>(null);

  // Fetch agents and staff for filter dropdowns
  const { data: agentsData } = useQuery<{ agents: { id: string; businessName: string }[] }>({
    queryKey: ["admin-agents-list"],
    queryFn: () => fetch("/api/admin/agents-list", { credentials: "include" }).then(r => r.json()),
    staleTime: 60000,
  });
  const { data: staffData } = useQuery<{ staff: { id: string; fullName: string; role: string }[] }>({
    queryKey: ["admin-staff-list"],
    queryFn: () => fetch("/api/admin/staff-list", { credentials: "include" }).then(r => r.json()),
    staleTime: 60000,
  });
  const agentsList = agentsData?.agents || [];
  const staffList = staffData?.staff || [];

  useEffect(() => { setPage(1); }, [search, filterStatus, filterType, filterPayment, filterGender, filterVisa, filterAgent, filterStaff]);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (search)                         p.set("search",        search);
    if (filterStatus  !== FILTER_ALL)   p.set("status",        filterStatus);
    if (filterGender  !== FILTER_ALL)   p.set("gender",        filterGender);
    if (filterType    !== FILTER_ALL)   p.set("packageType",   filterType);
    if (filterPayment !== FILTER_ALL)   p.set("paymentStatus", filterPayment);
    if (filterVisa    !== FILTER_ALL)   p.set("visaStatus",    filterVisa);
    if (filterAgent   !== FILTER_ALL)   p.set("agentId",       filterAgent);
    if (filterStaff   !== FILTER_ALL)   p.set("registeredByStaffId", filterStaff);
    return p.toString();
  }, [search, filterStatus, filterType, filterPayment, filterGender, filterVisa, filterAgent, filterStaff, page]);

  const { data, isLoading } = useQuery<{ pilgrims: PilgrimRow[]; total: number; totalPages: number }>({
    queryKey: ["admin-pilgrims", queryParams],
    queryFn: async () => {
      const r = await fetch(`/api/admin/pilgrims?${queryParams}`);
      return r.json();
    },
  });

  const pilgrims   = (data?.pilgrims   ?? []) as PilgrimRow[];
  const total      = data?.total      ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const activeFilters = [filterStatus, filterType, filterPayment, filterGender, filterVisa, filterAgent, filterStaff].filter(f => f !== FILTER_ALL).length + (search ? 1 : 0);

  const exportParams = useMemo(() => {
    const p = new URLSearchParams({ exportAll: "true" });
    if (search)                         p.set("search",        search);
    if (filterStatus  !== FILTER_ALL)   p.set("status",        filterStatus);
    if (filterGender  !== FILTER_ALL)   p.set("gender",        filterGender);
    if (filterType    !== FILTER_ALL)   p.set("packageType",   filterType);
    if (filterPayment !== FILTER_ALL)   p.set("paymentStatus", filterPayment);
    if (filterVisa    !== FILTER_ALL)   p.set("visaStatus",    filterVisa);
    if (filterAgent   !== FILTER_ALL)   p.set("agentId",       filterAgent);
    if (filterStaff   !== FILTER_ALL)   p.set("registeredByStaffId", filterStaff);
    return p.toString();
  }, [search, filterStatus, filterType, filterPayment, filterGender, filterVisa, filterAgent, filterStaff]);

  const handleExportCSV = useCallback(async () => {
    const r = await fetch(`/api/admin/pilgrims?${exportParams}`);
    const d = await r.json();
    exportExcel((d.pilgrims ?? []) as PilgrimRow[]);
  }, [exportParams]);

  const handleExportPDF = useCallback(async () => {
    const r = await fetch(`/api/admin/pilgrims?${exportParams}`);
    const d = await r.json();
    exportPDF((d.pilgrims ?? []) as PilgrimRow[]);
  }, [exportParams]);

  const clearFilters = () => {
    setFilterStatus(FILTER_ALL); setFilterType(FILTER_ALL);
    setFilterPayment(FILTER_ALL); setFilterGender(FILTER_ALL);
    setFilterVisa(FILTER_ALL); setFilterAgent(FILTER_ALL);
    setFilterStaff(FILTER_ALL); setSearch("");
  };

  return (
    <div className="space-y-5" data-testid="page-admin-pilgrims">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[#2D3199] text-xs font-bold uppercase tracking-widest mb-1">Directory</p>
          <h1 className="text-2xl font-black text-[#0F172A]">Pilgrims</h1>
          <p className="text-[#64748B] text-sm mt-0.5">View and manage all registered pilgrims</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#DCE3F0] text-[#0F172A] text-sm font-semibold hover:bg-[#F8F9FF] hover:border-[#B8C0E8] transition-all shadow-sm"
          >
            <Download className="w-4 h-4 text-[#2D3199]" /> Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#DCE3F0] text-[#0F172A] text-sm font-semibold hover:bg-[#F8F9FF] hover:border-[#B8C0E8] transition-all shadow-sm"
          >
            <FileText className="w-4 h-4 text-[#FF3B00]" /> PDF
          </button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="bg-white rounded-2xl border border-[#DCE3F0] shadow-sm p-4 space-y-3">
        {/* Search bar */}
        <div className="flex items-center gap-2 bg-[#F8F9FF] border border-[#DCE3F0] rounded-xl px-3.5 py-2.5">
          <Search className="w-4 h-4 text-[#94A3B8] shrink-0" />
          <input
            className="flex-1 text-sm outline-none bg-transparent placeholder:text-[#94A3B8]"
            placeholder="Search name, email, passport, reference, phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch("")}><X className="w-4 h-4 text-[#94A3B8] hover:text-[#0F172A]" /></button>}
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest shrink-0">
            <Filter className="w-3 h-3" /> Filters:
          </span>

          {[
            { value: filterStatus, onChange: setFilterStatus, placeholder: "All Status", options: [
              { v: "confirmed", l: "Confirmed" }, { v: "pending", l: "Pending" },
              { v: "cancelled", l: "Cancelled" }, { v: "completed", l: "Completed" },
            ]},
            { value: filterType, onChange: setFilterType, placeholder: "All Types", options: [
              { v: "hajj", l: "Hajj" }, { v: "umrah", l: "Umrah" },
            ]},
            { value: filterPayment, onChange: setFilterPayment, placeholder: "All Payments", options: [
              { v: "paid", l: "Fully Paid" }, { v: "partial", l: "Partial" }, { v: "unpaid", l: "Unpaid" },
            ]},
            { value: filterGender, onChange: setFilterGender, placeholder: "All Genders", options: [
              { v: "male", l: "Male" }, { v: "female", l: "Female" }, { v: "unknown", l: "Not Set" },
            ]},
            { value: filterVisa, onChange: setFilterVisa, placeholder: "All Visas", options: [
              { v: "issued", l: "Visa Issued" }, { v: "pending", l: "Visa Pending" },
            ]},
            { value: filterAgent, onChange: setFilterAgent, placeholder: "All Agents", options:
              agentsList.map(a => ({ v: a.id, l: a.businessName }))
            },
            { value: filterStaff, onChange: setFilterStaff, placeholder: "All Staff", options:
              staffList.map(s => ({ v: s.id, l: s.fullName || "Staff" }))
            },
          ].map(f => (
            <div key={f.placeholder} className="w-[130px]">
              <Select value={f.value} onValueChange={f.onChange}>
                <SelectTrigger className={`h-8 text-xs rounded-lg border w-full px-2.5 ${f.value !== FILTER_ALL ? "border-[#2D3199] bg-[#EEF0FF] text-[#2D3199] font-bold" : "border-[#DCE3F0] text-[#64748B]"}`}>
                  <SelectValue placeholder={f.placeholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>{f.placeholder}</SelectItem>
                  {f.options.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}

          {activeFilters > 0 && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-[#FF3B00] font-bold hover:underline shrink-0">
              <X className="w-3.5 h-3.5" /> Clear ({activeFilters})
            </button>
          )}
        </div>
      </div>

      {/* Count bar + pagination */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5 bg-white rounded-xl border border-[#DCE3F0] px-4 py-2 shadow-sm">
          <Users className="w-4 h-4 text-[#2D3199]" />
          <span className="font-black text-[#0F172A] text-sm">{total.toLocaleString()}</span>
          <span className="text-[#94A3B8] text-sm">pilgrim{total !== 1 ? "s" : ""}</span>
          {activeFilters > 0 && <span className="text-[10px] text-[#FF3B00] font-bold bg-[#FF3B00]/10 px-2 py-0.5 rounded-full">{activeFilters} filter{activeFilters !== 1 ? "s" : ""}</span>}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-[#DCE3F0] text-sm font-bold text-[#0F172A] disabled:opacity-40 hover:bg-[#F8F9FF] transition-all"
            >
              ← Prev
            </button>
            <span className="text-xs font-semibold text-[#64748B] px-2">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-[#DCE3F0] text-sm font-bold text-[#0F172A] disabled:opacity-40 hover:bg-[#F8F9FF] transition-all"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : pilgrims.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center bg-white rounded-2xl border border-dashed border-[#DCE3F0]">
          <div className="w-14 h-14 rounded-2xl bg-[#EEF0FF] flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-[#2D3199]/40" />
          </div>
          <p className="text-[#0F172A] font-bold mb-1">{search || activeFilters ? "No results found" : "No pilgrims yet"}</p>
          <p className="text-[#94A3B8] text-sm mb-3">
            {search || activeFilters ? "Try adjusting your filters or search term" : "Pilgrims will appear as they register"}
          </p>
          {activeFilters > 0 && (
            <button onClick={clearFilters} className="text-sm text-[#2D3199] font-bold hover:underline">Clear all filters</button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {pilgrims.map((pilgrim, idx) => {
            const paid = paymentStatus(pilgrim);
            const visa = visaStatus(pilgrim);
            return (
              <div
                key={pilgrim.id}
                className="bg-white rounded-2xl border border-[#DCE3F0] shadow-[0_2px_12px_rgba(45,49,153,0.04)] p-4 flex items-center justify-between gap-4 cursor-pointer hover:shadow-[0_4px_20px_rgba(45,49,153,0.10)] hover:border-[#B8C0E8] transition-all"
                onClick={() => setSelected(pilgrim)}
                data-testid={`row-pilgrim-${pilgrim.id}`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {pilgrim.profilePhotoUrl ? (
                    <img src={pilgrim.profilePhotoUrl} alt={resolveDisplayName(pilgrim)}
                         className="h-11 w-11 rounded-xl object-cover shrink-0 border border-[#DCE3F0]" />
                  ) : (
                    <Avatar className="h-11 w-11 shrink-0">
                      <AvatarFallback className="font-black text-white text-base"
                        style={{ background: INDIGO_SHADES[idx % INDIGO_SHADES.length] }}>
                        {resolveDisplayName(pilgrim).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-[#0F172A] truncate">{resolveDisplayName(pilgrim)}</p>
                    <p className="text-[#94A3B8] text-xs truncate">{pilgrim.email || pilgrim.user?.email}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold capitalize border ${statusStyle[pilgrim.status] || statusStyle.pending}`}>
                        {pilgrim.status}
                      </span>
                      {pilgrim.package && (
                        <span className="text-[10px] text-[#64748B] bg-[#F1F5F9] border border-[#DCE3F0] px-2 py-0.5 rounded-full capitalize">
                          {pilgrim.package.type}
                        </span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${paid === "paid" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : paid === "partial" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                        {paid === "paid" ? "Paid" : paid === "partial" ? "Partial" : "Unpaid"}
                      </span>
                      {visa === "issued" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-blue-50 text-blue-700 border-blue-200">
                          Visa Issued
                        </span>
                      )}
                      {(pilgrim as any).agentBusinessName && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-purple-50 text-purple-700 border-purple-200">
                          Agent: {(pilgrim as any).agentBusinessName}
                        </span>
                      )}
                      {(pilgrim as any).registeredByStaffName && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-indigo-50 text-indigo-700 border-indigo-200">
                          Staff: {(pilgrim as any).registeredByStaffName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="hidden sm:block text-right">
                    <p className="font-black text-[#0F172A] text-sm">₦{pilgrim.amountPaid.toLocaleString()}</p>
                    <p className="text-[10px] text-[#94A3B8]">of ₦{pilgrim.totalPrice.toLocaleString()}</p>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-[#EEF0FF] flex items-center justify-center">
                    <ChevronRight className="w-4 h-4 text-[#2D3199]" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && <PilgrimDetailDialog pilgrim={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
