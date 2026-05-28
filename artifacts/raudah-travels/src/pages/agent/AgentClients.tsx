import React, { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop, { type Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Users, UserPlus, Search, FileText, Plane, BookOpen, CheckCircle2,
  Clock, XCircle, Phone, BookMarked, X, ChevronDown, ChevronUp, AlertTriangle,
  Package, Loader2, ChevronLeft, ChevronRight, CreditCard, User, Upload,
  WifiOff, Wifi, AlertCircle,
} from "lucide-react";
import PassportScanner from "@/components/PassportScanner";
import BatchPassportUpload, { type BatchPilgrim } from "@/components/BatchPassportUpload";
import { useFormFieldConfig, validateRequiredFields } from "@/hooks/useFormFieldConfig";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { uploadFile } from "@/lib/upload";

function FileUploadBox({ label, accept, value, onChange, previewType = "image", folder = "documents" }: {
  label: string; accept: string; value: string; onChange: (v: string) => void; previewType?: "image" | "file";
  folder?: "passports" | "photos" | "receipts" | "documents";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      alert(`File too large (${(file.size / 1024).toFixed(0)}KB). Maximum size is 3MB.`);
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const url = await uploadFile(file, folder);
      onChange(url);
    } catch (err: any) {
      alert(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
    e.target.value = "";
  };
  const isImage = value && (value.startsWith("data:image") || /\.(jpg|jpeg|png|webp)$/i.test(value));
  return (
    <div>
      <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{label}</label>
      <div className="mt-1">
        {value ? (
          <div className="rounded-xl border-2 border-[#2D3199] overflow-hidden bg-[#EEF0FF]">
            {isImage && previewType === "image" ? (
              <img src={value} alt="preview" className="w-full h-28 object-cover" />
            ) : (
              <div className="flex items-center gap-3 p-3">
                <FileText className="w-6 h-6 text-[#2D3199]" />
                <p className="text-xs font-bold text-[#2D3199]">File uploaded</p>
              </div>
            )}
            <div className="flex gap-2 px-3 py-2 border-t border-[#C7CCF5]">
              <button type="button" onClick={() => inputRef.current?.click()} className="text-[10px] font-bold text-[#2D3199]"><Upload className="w-3 h-3 inline mr-1" />Change</button>
              <span className="text-[#C7CCF5]">·</span>
              <button type="button" onClick={() => { onChange(""); if (inputRef.current) inputRef.current.value = ""; }} className="text-[10px] font-bold text-red-500"><X className="w-3 h-3 inline mr-1" />Remove</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
            className="w-full rounded-xl border-2 border-dashed border-[#DCE3F0] hover:border-[#2D3199]/40 bg-[#F8FAFC] hover:bg-[#EEF0FF] transition-all p-4 flex flex-col items-center gap-1.5 text-center">
            {uploading ? (
              <><Loader2 className="w-5 h-5 text-[#2D3199] animate-spin" /><span className="text-xs font-semibold text-[#2D3199]">Uploading...</span></>
            ) : (
              <><Upload className="w-5 h-5 text-[#94A3B8]" /><span className="text-xs font-semibold text-[#64748B]">Click to upload</span><span className="text-[10px] text-[#94A3B8]">Max 3MB</span></>
            )}
          </button>
        )}
        <input ref={inputRef} type="file" accept={accept} onChange={handleFile} className="hidden" />
      </div>
    </div>
  );
}

const CIVILITY = ["Mr", "Mrs", "Miss", "Dr", "Prof", "Alhaji", "Alhaja", "Mal.", "Hajiya"];
const GENDERS  = ["male", "female"];
const ROOMS    = ["Single", "Double", "Triple", "Quad"];
const NATIONALITIES = ["Nigerian", "Burkinabe", "Nigerien", "Ghanaian", "Senegalese", "Cameroonian", "Other"];
const MARITAL_STATUS = ["Single", "Married", "Divorced", "Widowed"];
const LEVEL_OF_STUDY = ["None", "Primary", "Secondary", "Tertiary", "Postgraduate"];
const PHONE_CODES = [
  { code: "+234", flag: "🇳🇬", label: "Nigeria" },
  { code: "+226", flag: "🇧🇫", label: "Burkina Faso" },
  { code: "+227", flag: "🇳🇪", label: "Niger" },
  { code: "+233", flag: "🇬🇭", label: "Ghana" },
  { code: "+221", flag: "🇸🇳", label: "Senegal" },
  { code: "+237", flag: "🇨🇲", label: "Cameroon" },
];
const REG_STEPS = [
  { id: 1, label: "Package",  icon: Package },
  { id: 2, label: "Passport", icon: BookOpen },
  { id: 3, label: "Personal", icon: User },
  { id: 4, label: "Contact",  icon: Phone },
  { id: 5, label: "Payment",  icon: CreditCard },
];

const STATUS_CFG: Record<string, { label: string; pill: string; dot: string }> = {
  pending:   { label: "Pending",   pill: "bg-amber-100 text-amber-700 border-amber-200",   dot: "bg-amber-400" },
  confirmed: { label: "Confirmed", pill: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  cancelled: { label: "Cancelled", pill: "bg-red-100 text-red-700 border-red-200",         dot: "bg-red-400" },
  completed: { label: "Completed", pill: "bg-blue-100 text-blue-700 border-blue-200",       dot: "bg-blue-500" },
};
const VISA_CFG: Record<string, { label: string; pill: string }> = {
  pending:   { label: "Pending",   pill: "bg-amber-100 text-amber-700" },
  submitted: { label: "Submitted", pill: "bg-blue-100 text-blue-700" },
  approved:  { label: "Approved",  pill: "bg-emerald-100 text-emerald-700" },
  rejected:  { label: "Rejected",  pill: "bg-red-100 text-red-700" },
};

interface AgentClient {
  id: string; reference: string; status: string;
  fullName: string; civility?: string; firstName?: string; lastName?: string;
  passportNumber?: string; passportExpiry?: string; passportIssueDate?: string;
  dateOfBirth?: string; gender?: string; nationality?: string;
  phone?: string; email?: string;
  totalPrice: number; amountPaid: number;
  packageId?: string; packageName?: string; packageType?: string;
  visa?: { id: string; status: string; visaNumber?: string; visaDocumentUrl?: string; ticketDocumentUrl?: string } | null;
  ticketDocumentUrl?: string;
  createdAt: string;
}
interface Package { id: string; name: string; type: string; price: number; maxCapacity: number; currentBookings: number; }

const BLANK_FORM = {
  packageId: "", civility: "", firstName: "", lastName: "",
  passportNumber: "", passportIssueDate: "", passportExpiry: "", passportIssuingAuthority: "",
  passportCopyUrl: "", profilePhotoUrl: "", visaNumber: "",
  dateOfBirth: "", placeOfBirth: "", gender: "", phone: "", email: "", nationality: "Nigerian",
  ethnicGroup: "", maritalStatus: "", levelOfStudy: "", occupation: "",
  country: "Nigeria", city: "", address: "",
  roomPreference: "Double", departureCity: "", specialRequests: "",
  partner: "", underCover: "", observation: "",
  amountPaid: "", paymentMethod: "cash", paymentReference: "", paymentProofUrl: ""
};

function passportWarn(expiry: string) {
  if (!expiry) return null;
  const d = new Date(expiry); const now = new Date();
  if (d < now) return "expired";
  const soon = new Date(); soon.setMonth(soon.getMonth() + 6);
  return d <= soon ? "soon" : null;
}

export default function AgentClients() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const searchStr = useSearch();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [regStep, setRegStep] = useState(1);
  const [sessionCount, setSessionCount] = useState(0);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [phoneCode, setPhoneCode] = useState("+234");
  const [pilgrimType, setPilgrimType] = useState<"adult" | "child" | "infant">("adult");
  const [batchMode, setBatchMode] = useState(false);
  const [batchPilgrims, setBatchPilgrims] = useState<BatchPilgrim[]>([]);
  const [batchStep, setBatchStep] = useState<"upload" | "details" | "payment">("upload");
  const [batchActiveIndex, setBatchActiveIndex] = useState(0);
  const [batchPayments, setBatchPayments] = useState<Array<{
    method: string;
    amountPaid: string;
    markVerified: boolean;
  }>>([]);
  const [batchCropTarget, setBatchCropTarget] = useState<{ index: number; imageUrl: string } | null>(null);
  const [batchCropState, setBatchCropState] = useState<any>(null);
  const batchCropImgRef = useRef<HTMLImageElement>(null);
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchResults, setBatchResults] = useState<{ name: string; success: boolean; reference?: string; error?: string }[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const lastPkgRef = useRef("");
  const autoOpenedRef = useRef(false);
  const [isRestored, setIsRestored] = useState(false);
  const [result, setResult] = useState<{ reference: string } | null>(null);

  // Restore draft on mount
  useEffect(() => {
    try {
      const draft = localStorage.getItem("agent_client_draft");
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.form) setForm(parsed.form);
        if (parsed.regStep) setRegStep(parsed.regStep);
        if (parsed.phoneCode) setPhoneCode(parsed.phoneCode);
        if (parsed.pilgrimType) setPilgrimType(parsed.pilgrimType);
      }
    } catch (e) {}
    setIsRestored(true);
  }, []);

  // Save draft on changes (includes phoneCode)
  useEffect(() => {
    if (!isRestored) return;
    if (regStep === 6 || !dialogOpen) {
      localStorage.removeItem("agent_client_draft");
      return;
    }
    localStorage.setItem("agent_client_draft", JSON.stringify({ form, regStep, phoneCode, pilgrimType }));
  }, [form, regStep, phoneCode, isRestored, dialogOpen, pilgrimType]);

  const cfg = useFormFieldConfig();
  const show = (name: string) => cfg(name).visible;
  const req  = (name: string) => cfg(name).visible && cfg(name).required;
  const lbl  = (name: string, label: string) => <>{label}{req(name) && <span className="text-red-500 ml-0.5 font-black normal-case">*</span>}</>;

  const { data, isLoading } = useQuery<{ clients: AgentClient[]; total: number }>({
    queryKey: ["agent-clients", page, search, statusFilter],
    queryFn: () => {
      const offset = (page - 1) * pageSize;
      const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset) });
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      return fetch(`/api/agent/clients?${params}`, { credentials: "include" }).then(r => r.json());
    },
    staleTime: 15000,
  });

  const { data: appConfig } = useQuery<{ paystackPublicKey: string; paystackEnabled: boolean }>({
    queryKey: ["app-config"],
    queryFn: () => fetch("/api/config").then(r => r.json()),
    staleTime: 30000,
  });
  const paystackEnabled = appConfig?.paystackEnabled ?? true;

  // Fetch room surcharges and child/infant pricing from admin settings
  const { data: pubSettings } = useQuery<Record<string, any>>({
    queryKey: ["public-settings"],
    queryFn: () => fetch("/api/public/settings").then(r => r.json()),
    staleTime: 60_000,
  });
  const roomSurcharges: Record<string, number> = (() => {
    const raw = pubSettings?.["room_surcharges"];
    if (raw && typeof raw === "object") return raw as Record<string, number>;
    return { single: 0, double: 0, triple: 0, quad: 0, quint: 0 };
  })();
  const childInfantPricing: { childPrice?: number; infantPrice?: number } = (() => {
    const raw = pubSettings?.["child_infant_pricing"];
    if (raw && typeof raw === "object") return raw as { childPrice?: number; infantPrice?: number };
    return {};
  })();

  const { data: walletData } = useQuery<{ balance: number }>({
    queryKey: ["agent-wallet"],
    queryFn: () => fetch("/api/agents/wallet", { credentials: "include" }).then(r => r.json()),
    staleTime: 30000,
  });
  const walletBalance = walletData?.balance ?? 0;

  const paystackScriptLoaded = useRef(false);
  const { isOnline, wasOffline } = useOnlineStatus();
  useEffect(() => {
    if (!paystackScriptLoaded.current) {
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v2/inline.js";
      script.async = true;
      document.body.appendChild(script);
      paystackScriptLoaded.current = true;
    }
  }, []);

  const { data: bankAccountsData } = useQuery<{ accounts: any[] }>({
    queryKey: ["public-bank-accounts"],
    queryFn: () => fetch("/api/bank-accounts").then(r => r.json()),
    staleTime: 60000,
  });
  const bankAccounts = bankAccountsData?.accounts || [];

  const { data: pkgData } = useQuery<{ packages: Package[] }>({
    queryKey: ["packages-active"],
    queryFn: () => fetch("/api/packages?status=active&limit=50", { credentials: "include" }).then(r => r.json()),
  });

  const { data: discountData } = useQuery<{ discounts: Array<{ packageId: string; discountValue: number; discountType: string }>; commissionRate: number; commissionType: string }>({
    queryKey: ["agent-package-discounts"],
    queryFn: () => fetch("/api/agents/package-discounts", { credentials: "include" }).then(r => r.json()),
  });

  const packages = pkgData?.packages || [];
  const discounts = discountData?.discounts || [];
  const discountMap = Object.fromEntries(discounts.map(d => [d.packageId, d]));

  // If navigated from "Book for Client" on the Packages page, pre-select the
  // package and auto-open the registration dialog (runs once when packages load).
  useEffect(() => {
    if (autoOpenedRef.current || !packages.length) return;
    const urlPkgId = new URLSearchParams(searchStr).get("packageId") ?? "";
    if (!urlPkgId) return;
    const exists = packages.some(p => p.id === urlPkgId);
    if (!exists) return;
    autoOpenedRef.current = true;
    setForm(f => ({ ...f, packageId: urlPkgId }));
    setDialogOpen(true);
  }, [searchStr, packages]);
  const selectedPkg = packages.find(p => p.id === form.packageId);

  // Compute agent's effective price after admin-applied discount
  const selectedDiscount = selectedPkg ? discountMap[selectedPkg.id] : undefined;
  const effectivePrice = selectedPkg ? (() => {
    let p = selectedPkg.price;
    if (selectedDiscount) {
      if (selectedDiscount.discountType === "percentage") {
        p = Math.round((p - (p * selectedDiscount.discountValue / 100)) * 100) / 100;
      } else {
        p = Math.max(0, p - selectedDiscount.discountValue);
      }
    }
    return p;
  })() : 0;

  const registerMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/agent/register-client", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Failed"); return d; }),
    onSuccess: async (data) => {
      submittingRef.current = false;
      // Skip automatic navigation during batch submission
      if (isBatchSubmitting) return;
      const finishLocal = () => {
        toast({ title: `✓ ${data.fullName || "Client"} registered`, description: `Ref: ${data.reference}` });
        setSessionCount(c => c + 1);
        qc.invalidateQueries({ queryKey: ["agent-clients"] });
        // BUG FIX #9: Invalidate wallet cache so balance updates across all pages
        qc.invalidateQueries({ queryKey: ["agent-wallet"] });
        // Invalidate packages cache so capacity bar updates immediately
        qc.invalidateQueries({ queryKey: ["packages-active"] });
        setResult({ reference: data.reference });
        localStorage.removeItem("agent_client_draft");
        setRegStep(6);
      };

      if (form.paymentMethod === "online") {
        try {
          const amount = effectivePrice;
          const res = await fetch("/api/payments/paystack/initialize", {
            method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
            body: JSON.stringify({ bookingId: data.id, amount, email: form.email || "admin@raudah.com" }),
          });
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error((errBody as any).error || "Initialize failed");
          }
          const pdata = await res.json() as { reference: string; accessCode: string };
          if (!(window as any).PaystackPop) throw new Error("Paystack script not loaded");
          
          const popup = new (window as any).PaystackPop();
          popup.resumeTransaction(pdata.accessCode, {
            onSuccess: (transaction: any) => finishLocal(),
            onCancel: () => {
              fetch(`/api/bookings/${data.id}`, { method: "DELETE", credentials: "include" }).catch(() => {});
              toast({ title: "Payment cancelled", description: "The payment window was closed and the pending booking has been discarded." });
            },
            onError: (err: Error) => {
              fetch(`/api/bookings/${data.id}`, { method: "DELETE", credentials: "include" }).catch(() => {});
              toast({ title: "Payment error", description: err.message || "Could not launch Paystack. The pending booking was discarded.", variant: "destructive" });
            }
          });
        } catch (err: any) {
          fetch(`/api/bookings/${data.id}`, { method: "DELETE", credentials: "include" }).catch(() => {});
          toast({ title: "Payment error", description: err.message || "Could not launch Paystack. The pending booking was discarded.", variant: "destructive" });
        }
      } else {
        finishLocal();
      }
    },
    onError: (err: Error) => { submittingRef.current = false; if (!isBatchSubmitting) toast({ title: "Registration failed", description: err.message, variant: "destructive" }); },
  });

  // BUG FIX #12: Double-submit guard ref
  const submittingRef = useRef(false);

  const handleSubmit = () => {
    // BUG FIX #12: Prevent double-submit on rapid clicks
    if (submittingRef.current || registerMutation.isPending) return;
    submittingRef.current = true;
    // Only submit when user is on the final payment step
    if (!form.packageId) { submittingRef.current = false; toast({ title: "Select a package", variant: "destructive" }); return; }
    if (req("firstName") && !form.firstName.trim()) { submittingRef.current = false; toast({ title: "First Name is required", variant: "destructive" }); return; }
    if (req("lastName") && !form.lastName.trim()) { submittingRef.current = false; toast({ title: "Last Name is required", variant: "destructive" }); return; }
    if (req("phone") && !form.phone.trim()) { submittingRef.current = false; toast({ title: "Phone number is required", variant: "destructive" }); return; }
    const warn = passportWarn(form.passportExpiry);
    if (warn === "expired") { submittingRef.current = false; toast({ title: "Passport expired", description: "Cannot register with expired passport.", variant: "destructive" }); return; }
    registerMutation.mutate({
      packageId: form.packageId,
      civility: form.civility || undefined,
      firstName: form.firstName || undefined,
      lastName: form.lastName || undefined,
      passportNumber: form.passportNumber || undefined,
      passportIssueDate: form.passportIssueDate || undefined,
      passportExpiry: form.passportExpiry || undefined,
      passportIssuingAuthority: form.passportIssuingAuthority || undefined,
      dateOfBirth: form.dateOfBirth || undefined,
      placeOfBirth: form.placeOfBirth || undefined,
      gender: form.gender || undefined,
      phone: form.phone ? `${phoneCode}${form.phone}` : undefined,
      email: form.email || undefined,
      nationality: form.nationality,
      ethnicGroup: form.ethnicGroup || undefined,
      maritalStatus: form.maritalStatus || undefined,
      levelOfStudy: form.levelOfStudy || undefined,
      occupation: form.occupation || undefined,
      country: form.country || undefined,
      city: form.city || undefined,
      address: form.address || undefined,
      roomPreference: form.roomPreference,
      departureCity: form.departureCity || undefined,
      specialRequests: form.specialRequests || undefined,
      partner: form.partner || undefined,
      underCover: form.underCover || undefined,
      observation: form.observation || undefined,
      visaNumber: form.visaNumber || undefined,
      passportCopyUrl: form.passportCopyUrl || undefined,
      profilePhotoUrl: form.profilePhotoUrl || undefined,
      amountPaid: form.paymentMethod === "online" ? 0 : form.paymentMethod === "wallet" ? effectivePrice : (form.amountPaid ? Number(form.amountPaid) : undefined),
      paymentMethod: form.paymentMethod === "online" ? "paystack" : form.paymentMethod,
      paymentReference: form.paymentReference || undefined,
      paymentProofUrl: form.paymentProofUrl || undefined,
      pilgrimType,
    });
  };

  const allClients = data?.clients || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);
  const clients = allClients;

  const stats = {
    total: data?.total || allClients.length,
    confirmed: allClients.filter(c => c.status === "confirmed").length,
    pending: allClients.filter(c => c.status === "pending").length,
    visaApproved: allClients.filter(c => c.visa?.status === "approved").length,
    ticketsIssued: allClients.filter(c => !!(c.ticketDocumentUrl || c.visa?.ticketDocumentUrl)).length,
  };

  const set = useCallback((k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v })), []);
  const passportWarnLevel = passportWarn(form.passportExpiry);

  return (
    <div className="space-y-6" data-testid="page-agent-clients">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2D3199]/60 mb-1">AGENT PORTAL</p>
          <h1 className="text-3xl font-black text-[#1C1F66] tracking-tight">My Clients</h1>
          <p className="text-[#64748B] text-sm mt-1">Register pilgrims, manage passports, track visas & tickets</p>
        </div>
        <Button
          onClick={() => { lastPkgRef.current = form.packageId; setDialogOpen(true); }}
          className="bg-[#FF3B00] hover:bg-[#D63200] text-white rounded-xl font-black gap-2 h-11 shadow-lg"
          data-testid="button-register-client"
        >
          <UserPlus className="w-4 h-4" /> Register Client
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Clients", value: stats.total, color: "from-[#2D3199] to-[#4C56B8]", icon: Users },
          { label: "Confirmed", value: stats.confirmed, color: "from-emerald-500 to-teal-600", icon: CheckCircle2 },
          { label: "Pending", value: stats.pending, color: "from-amber-500 to-orange-500", icon: Clock },
          { label: "Visas Approved", value: stats.visaApproved, color: "from-purple-500 to-indigo-600", icon: BookMarked },
          { label: "Tickets Issued", value: stats.ticketsIssued, color: "from-[#FF3B00] to-[#FF6B35]", icon: Plane },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`relative overflow-hidden rounded-2xl p-4 text-white shadow-md bg-gradient-to-br ${s.color}`}>
              <div className="absolute -top-3 -right-3 w-16 h-16 rounded-full bg-white/10" />
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/70 leading-tight">{s.label}</p>
                  <Icon className="w-3.5 h-3.5 text-white/60" />
                </div>
                <p className="text-2xl font-black tabular-nums">{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <Input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, passport no., phone or ref…"
            className="pl-10 rounded-xl border-[#E2E8F0] h-11"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", "pending", "confirmed", "cancelled", "completed"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-full text-xs font-black capitalize transition-all ${
                statusFilter === s ? "bg-[#2D3199] text-white shadow" : "bg-white border border-[#E2E8F0] text-[#64748B] hover:border-[#2D3199]/40"
              }`}>
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Client List */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : clients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center mb-4">
            <Users className="w-7 h-7 text-[#CBD5E1]" />
          </div>
          <h3 className="font-black text-[#1C1F66] text-lg mb-1">
            {search || statusFilter !== "all" ? "No clients match" : "No clients yet"}
          </h3>
          <p className="text-[#94A3B8] text-sm mb-6 max-w-xs">
            {search || statusFilter !== "all" ? "Try adjusting your filters." : "Register your first client to get started."}
          </p>
          {!search && statusFilter === "all" && (
            <Button onClick={() => setDialogOpen(true)} className="bg-[#FF3B00] hover:bg-[#D63200] text-white rounded-xl gap-2">
              <UserPlus className="w-4 h-4" /> Register First Client
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="px-6 py-3 border-b border-[#F1F5F9] bg-[#F8FAFC] flex items-center justify-between">
            <p className="text-xs font-black text-[#64748B] uppercase tracking-wider">{clients.length} client{clients.length !== 1 ? "s" : ""}</p>
            <button onClick={() => setDialogOpen(true)}
              className="text-xs font-black text-[#FF3B00] hover:underline flex items-center gap-1">
              <UserPlus className="w-3.5 h-3.5" /> Register New
            </button>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#F1F5F9]">
                  {["#", "Pilgrim", "Passport", "Package", "Booking Status", "Payment", "Visa", "Ticket", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[9px] font-black text-[#94A3B8] uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map((c, i) => {
                  const scfg = STATUS_CFG[c.status] || STATUS_CFG.pending;
                  const vcfg = c.visa ? (VISA_CFG[c.visa.status] || VISA_CFG.pending) : null;
                  const paidPct = c.totalPrice > 0 ? Math.min(100, Math.round(c.amountPaid / c.totalPrice * 100)) : 0;
                  const ticket = c.ticketDocumentUrl || c.visa?.ticketDocumentUrl;
                  const visaDoc = c.visa?.visaDocumentUrl;
                  const isExpanded = expandedId === c.id;
                  return (
                    <React.Fragment key={c.id}>
                      <tr className={`border-b border-[#F1F5F9] hover:bg-[#FAFBFF] transition-colors ${isExpanded ? "bg-[#FAFBFF]" : ""}`}>
                        <td className="px-4 py-3 text-xs text-[#CBD5E1] font-black tabular-nums">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2D3199] to-[#4C56B8] flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-black text-white">{c.fullName.charAt(0)}</span>
                            </div>
                            <div>
                              <p className="font-black text-[#1C1F66] text-sm leading-tight">{c.fullName}</p>
                              {c.phone && <p className="text-[10px] text-[#94A3B8]">{c.phone}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs text-[#334155]">{c.passportNumber || <span className="text-[#CBD5E1]">—</span>}</p>
                          {c.passportExpiry && (
                            <p className={`text-[10px] mt-0.5 ${passportWarn(c.passportExpiry) ? "text-red-500 font-bold" : "text-[#94A3B8]"}`}>
                              Exp: {new Date(c.passportExpiry).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-[140px]">
                          <p className="text-xs font-semibold text-[#64748B] truncate">{c.packageName || "—"}</p>
                          {c.packageType && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${c.packageType === "hajj" ? "bg-[#EEF0FF] text-[#2D3199]" : "bg-orange-50 text-orange-700"}`}>
                              {c.packageType}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-black border ${scfg.pill}`}>{scfg.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="w-20">
                            <div className="flex items-center justify-between mb-0.5">
                              <p className="text-[10px] font-black text-[#2D3199]">{paidPct}%</p>
                            </div>
                            <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${paidPct === 100 ? "bg-emerald-500" : "bg-[#2D3199]"}`} style={{ width: `${paidPct}%` }} />
                            </div>
                            <p className="text-[9px] text-[#94A3B8] mt-0.5">₦{c.amountPaid.toLocaleString()} / ₦{c.totalPrice.toLocaleString()}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {vcfg ? (
                            <div className="space-y-1">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${vcfg.pill}`}>{vcfg.label}</span>
                              {c.visa?.visaNumber && <p className="font-mono text-[10px] text-[#64748B]">{c.visa.visaNumber}</p>}
                            </div>
                          ) : <span className="text-[10px] text-[#CBD5E1]">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {ticket ? (
                            <a href={ticket} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white transition-colors">
                              <Plane className="w-3 h-3" /> View
                            </a>
                          ) : visaDoc ? (
                            <a href={visaDoc} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-[#EEF0FF] text-[#2D3199] hover:bg-[#2D3199] hover:text-white transition-colors">
                              <FileText className="w-3 h-3" /> Visa
                            </a>
                          ) : <span className="text-[10px] text-[#CBD5E1]">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                            className="w-7 h-7 rounded-lg border border-[#E2E8F0] flex items-center justify-center hover:bg-[#EEF0FF] hover:border-[#2D3199]/30 transition-colors">
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-[#2D3199]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${c.id}-detail`} className="bg-[#F8FAFC]">
                          <td colSpan={9} className="px-6 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              {[
                                { label: "Booking Ref", value: c.reference },
                                { label: "Gender", value: c.gender },
                                { label: "Date of Birth", value: c.dateOfBirth ? new Date(c.dateOfBirth).toLocaleDateString("en-NG") : undefined },
                                { label: "Nationality", value: c.nationality },
                                { label: "Passport Issue", value: c.passportIssueDate ? new Date(c.passportIssueDate).toLocaleDateString("en-NG") : undefined },
                                { label: "Email", value: c.email },
                                { label: "Visa Number", value: c.visa?.visaNumber },
                                { label: "Registered", value: new Date(c.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) },
                              ].map(({ label, value }) => value ? (
                                <div key={label}>
                                  <p className="text-[9px] font-black uppercase tracking-widest text-[#94A3B8] mb-0.5">{label}</p>
                                  <p className="font-semibold text-[#334155] text-xs">{value}</p>
                                </div>
                              ) : null)}
                            </div>
                            {(visaDoc || ticket) && (
                              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[#E2E8F0]">
                                <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">Documents:</p>
                                {visaDoc && (
                                  <a href={visaDoc} target="_blank" rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-[#EEF0FF] text-[#2D3199] hover:bg-[#2D3199] hover:text-white transition-colors">
                                    <FileText className="w-3.5 h-3.5" /> Visa Document
                                  </a>
                                )}
                                {ticket && (
                                  <a href={ticket} target="_blank" rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white transition-colors">
                                    <Plane className="w-3.5 h-3.5" /> Flight Ticket
                                  </a>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ); // eslint-disable-line react/jsx-key
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
            {clients.map(c => {
              const scfg = STATUS_CFG[c.status] || STATUS_CFG.pending;
              const paidPct = c.totalPrice > 0 ? Math.min(100, Math.round(c.amountPaid / c.totalPrice * 100)) : 0;
              const ticket = c.ticketDocumentUrl || c.visa?.ticketDocumentUrl;
              const visaDoc = c.visa?.visaDocumentUrl;
              return (
                <div key={c.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2D3199] to-[#4C56B8] flex items-center justify-center shrink-0">
                        <span className="text-sm font-black text-white">{c.fullName.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-[#1C1F66] text-sm truncate">{c.fullName}</p>
                        <p className="text-[10px] text-[#94A3B8] font-mono">{c.passportNumber || "No passport"}</p>
                      </div>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-black border shrink-0 ${scfg.pill}`}>{scfg.label}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#64748B]">
                    <span className="font-semibold truncate max-w-[140px]">{c.packageName || "—"}</span>
                    <span className="font-mono">{c.reference}</span>
                  </div>
                  <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${paidPct === 100 ? "bg-emerald-500" : "bg-[#2D3199]"}`} style={{ width: `${paidPct}%` }} />
                  </div>
                  {(visaDoc || ticket) && (
                    <div className="flex gap-2">
                      {visaDoc && (
                        <a href={visaDoc} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black bg-[#EEF0FF] text-[#2D3199]">
                          <FileText className="w-3 h-3" /> Visa
                        </a>
                      )}
                      {ticket && (
                        <a href={ticket} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black bg-purple-50 text-purple-700">
                          <Plane className="w-3 h-3" /> Ticket
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Register Client Dialog (Wizard) */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!registerMutation.isPending) setDialogOpen(open); }}>
        <DialogContent className="sm:max-w-2xl max-h-[95vh] overflow-y-auto p-0 rounded-2xl flex flex-col bg-[#F8FAFC]">
          <DialogTitle className="sr-only">Register Client</DialogTitle>
          <div className="bg-[#1C1F66] p-6 text-white shrink-0 rounded-t-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-black flex items-center gap-2"><UserPlus className="w-5 h-5" /> Register Client</h2>
                <p className="text-white/70 text-sm mt-1">
                  Fill & submit — form resets for the next client.{" "}
                  {sessionCount > 0 && <span className="text-emerald-400 font-black">✓ {sessionCount} registered this session</span>}
                </p>
              </div>
              <button onClick={() => setDialogOpen(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="mt-6 flex items-center justify-between relative">
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/10 -translate-y-1/2 z-0" />
              {REG_STEPS.map(s => (
                <div key={s.id} className="relative z-10 flex flex-col items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors duration-300 ${
                    regStep === s.id ? "bg-[#FF3B00] text-white ring-4 ring-[#FF3B00]/20" :
                    regStep > s.id ? "bg-emerald-500 text-white" : "bg-white/10 text-white/50"
                  }`}>
                    {regStep > s.id ? <CheckCircle2 className="w-4 h-4" /> : s.id}
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-wider ${regStep >= s.id ? "text-white" : "text-white/50"}`}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

           <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            {/* Offline/Online status */}
            {!isOnline && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <WifiOff className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">No internet connection</p>
                  <p className="text-xs text-amber-600">Your progress is saved locally. Submit when connection is restored.</p>
                </div>
              </div>
            )}
            {wasOffline && isOnline && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
                <Wifi className="w-4 h-4 text-green-600 flex-shrink-0" />
                <p className="text-sm font-medium text-green-800">Connection restored ✓</p>
              </div>
            )}
            
            {/* ── STEP 1: PACKAGE ── */}
            {regStep === 1 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Mode toggle */}
                <div className="flex rounded-xl bg-[#F1F5F9] p-1 gap-1">
                  <button type="button" onClick={() => setBatchMode(false)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex-1 ${!batchMode ? "bg-white text-[#2D3199] shadow-sm" : "text-[#64748B]"}`}>
                    👤 Single Client
                  </button>
                  <button type="button" onClick={() => setBatchMode(true)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex-1 ${batchMode ? "bg-white text-[#2D3199] shadow-sm" : "text-[#64748B]"}`}>
                    👥 Batch (up to 10)
                  </button>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-black text-[#1C1F66] uppercase tracking-wide flex items-center gap-1">
                    <Package className="w-3.5 h-3.5" /> Select Package <span className="text-red-500">*</span>
                  </Label>
                  <Select value={form.packageId} onValueChange={v => set("packageId", v)}>
                    <SelectTrigger className="rounded-xl border-[#E2E8F0] h-14 bg-white text-base">
                      <SelectValue placeholder="Choose a package…" />
                    </SelectTrigger>
                    <SelectContent>
                      {packages.map(p => {
                        const discount = discountMap[p.id];
                        return (
                          <SelectItem key={p.id} value={p.id} className="py-3">
                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded mr-3 ${p.type === "hajj" ? "bg-[#EEF0FF] text-[#2D3199]" : "bg-orange-50 text-orange-700"}`}>{p.type}</span>
                            <span className="font-bold text-[#0F172A]">{p.name}</span>
                            <span className="ml-2 font-mono text-[#64748B]"> — ₦{p.price.toLocaleString()}</span>
                            {discount && <span className="ml-2 text-emerald-600 font-bold text-xs">(Your discount: {discount.discountType === "percentage" ? `${discount.discountValue}%` : `₦${discount.discountValue.toLocaleString()}`})</span>}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {selectedPkg && (
                    <div className="mt-3 p-4 bg-white border border-[#E2E8F0] rounded-xl flex items-center justify-between shadow-sm">
                      <div>
                        <p className="text-sm font-black text-[#0F172A]">{selectedPkg.name}</p>
                        <p className="text-xs text-[#64748B] mt-0.5">
                          {selectedPkg.maxCapacity - selectedPkg.currentBookings} spaces remaining
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-[#1C1F66]">₦{selectedPkg.price.toLocaleString()}</p>
                        {discountMap[selectedPkg.id] && (
                          <p className="text-[10px] text-emerald-600 font-bold mt-0.5 bg-emerald-50 px-2 py-0.5 rounded inline-block">
                            Discount Applied
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── STEP 2: PASSPORT (or Batch Upload) ── */}
            {regStep === 2 && batchMode && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                {batchStep === "upload" && (
                  <BatchPassportUpload
                    maxPilgrims={10}
                    formConfig={cfg}
                    onBatchReady={(pilgrims) => {
                      setBatchPilgrims(pilgrims);
                      setBatchActiveIndex(0);
                      setBatchStep("details");
                    }}
                    onCancel={() => {
                      setBatchMode(false);
                      setRegStep(1);
                    }}
                  />
                )}
                {/* BATCH STEP: Details (Personal + Contact per pilgrim) */}
                {batchStep === "details" && batchPilgrims.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-xs text-[#64748B]">Complete details for each pilgrim. Click a pilgrim tab to edit their info.</p>
                    {/* Pilgrim selector tabs */}
                    <div className="flex gap-2 flex-wrap">
                      {batchPilgrims.map((p, i) => {
                        const isComplete = !!(p.firstName && p.lastName && p.dateOfBirth && p.gender);
                        const isActive = batchActiveIndex === i;
                        let detType: "adult" | "child" | "infant" = "adult";
                        if (p.dateOfBirth) {
                          const birth = new Date(p.dateOfBirth), now = new Date();
                          const ageM = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
                          if (ageM <= 23) detType = "infant"; else if (ageM <= 132) detType = "child";
                        }
                        return (
                          <button key={p.id} type="button" onClick={() => setBatchActiveIndex(i)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-xs font-bold transition-all ${
                              isActive ? "border-[#2D3199] bg-[#EEF0FF] text-[#2D3199]"
                              : isComplete ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : "border-[#DCE3F0] text-[#64748B] hover:border-[#2D3199]/30"
                            }`}>
                            {p.profilePhotoUrl && <img src={p.profilePhotoUrl} alt="" className="w-5 h-5 rounded-full object-cover" />}
                            <span>{i + 1}. {(p.firstName || p.lastName) ? `${p.firstName} ${p.lastName}`.trim() : "Pilgrim"}</span>
                            {detType !== "adult" && <span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded font-black uppercase">{detType}</span>}
                            <span>{isComplete ? "✓" : "●"}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Active pilgrim editor */}
                    {(() => {
                      const ap = batchPilgrims[batchActiveIndex];
                      if (!ap) return null;
                      const updateAP = (updates: Partial<BatchPilgrim>) =>
                        setBatchPilgrims(prev => prev.map((p, i) => i === batchActiveIndex ? { ...p, ...updates } : p));

                      let detType: "adult" | "child" | "infant" = "adult";
                      if (ap.dateOfBirth) {
                        const birth = new Date(ap.dateOfBirth), now = new Date();
                        const ageM = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
                        if (ageM <= 23) detType = "infant"; else if (ageM <= 132) detType = "child";
                      }
                      const roomSurcharge = roomSurcharges[(ap.roomPreference || "quad").toLowerCase()] || 0;
                      const ciExtra = detType === "infant" ? (childInfantPricing.infantPrice || 0) : detType === "child" ? (childInfantPricing.childPrice || 0) : 0;

                      return (
                        <div className="border border-[#E2E8F0] rounded-2xl p-4 space-y-3 bg-[#FAFBFF]">
                          <div className="flex items-center justify-between">
                            <h3 className="font-black text-[#1C1F66] text-sm">Pilgrim {batchActiveIndex + 1} of {batchPilgrims.length}</h3>
                            {ap.passportCopyUrl && (
                              <button type="button" onClick={() => setBatchCropTarget({ index: batchActiveIndex, imageUrl: ap.passportCopyUrl })}
                                className="flex items-center gap-1 text-xs font-bold text-[#2D3199] bg-[#EEF0FF] px-3 py-1.5 rounded-lg hover:bg-[#2D3199] hover:text-white transition-all">
                                ✂ Crop Profile Photo
                              </button>
                            )}
                          </div>
                          {ap.profilePhotoUrl && (
                            <div className="flex items-center gap-3">
                              <img src={ap.profilePhotoUrl} alt="Profile" className="w-14 h-14 rounded-full object-cover border-2 border-[#2D3199]/20" />
                              <p className="text-xs text-[#64748B]">Profile photo set{ap.passportCopyUrl ? " — click Crop to adjust" : ""}</p>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-[10px] font-bold text-[#64748B] uppercase">First Name *</label>
                              <input className="w-full mt-1 px-3 py-2 rounded-xl border border-[#DCE3F0] text-sm" value={ap.firstName} onChange={e => updateAP({ firstName: e.target.value })} /></div>
                            <div><label className="text-[10px] font-bold text-[#64748B] uppercase">Last Name *</label>
                              <input className="w-full mt-1 px-3 py-2 rounded-xl border border-[#DCE3F0] text-sm" value={ap.lastName} onChange={e => updateAP({ lastName: e.target.value })} /></div>
                            <div><label className="text-[10px] font-bold text-[#64748B] uppercase">Date of Birth *</label>
                              <input type="date" className="w-full mt-1 px-3 py-2 rounded-xl border border-[#DCE3F0] text-sm" value={ap.dateOfBirth} onChange={e => updateAP({ dateOfBirth: e.target.value })} /></div>
                            <div><label className="text-[10px] font-bold text-[#64748B] uppercase">Gender *</label>
                              <select className="w-full mt-1 px-3 py-2 rounded-xl border border-[#DCE3F0] text-sm" value={ap.gender} onChange={e => updateAP({ gender: e.target.value })}>
                                <option value="">Select…</option><option value="male">Male</option><option value="female">Female</option>
                              </select></div>
                            <div><label className="text-[10px] font-bold text-[#64748B] uppercase">Passport No.</label>
                              <input className="w-full mt-1 px-3 py-2 rounded-xl border border-[#DCE3F0] text-sm font-mono" value={ap.passportNumber} onChange={e => updateAP({ passportNumber: e.target.value })} /></div>
                            <div><label className="text-[10px] font-bold text-[#64748B] uppercase">Passport Expiry</label>
                              <input type="date" className="w-full mt-1 px-3 py-2 rounded-xl border border-[#DCE3F0] text-sm" value={ap.passportExpiry} onChange={e => updateAP({ passportExpiry: e.target.value })} /></div>
                            <div><label className="text-[10px] font-bold text-[#64748B] uppercase">Phone</label>
                              <input className="w-full mt-1 px-3 py-2 rounded-xl border border-[#DCE3F0] text-sm" value={ap.phone} onChange={e => updateAP({ phone: e.target.value })} placeholder="080…" /></div>
                            <div><label className="text-[10px] font-bold text-[#64748B] uppercase">Email</label>
                              <input type="email" className="w-full mt-1 px-3 py-2 rounded-xl border border-[#DCE3F0] text-sm" value={ap.email} onChange={e => updateAP({ email: e.target.value })} /></div>
                            <div><label className="text-[10px] font-bold text-[#64748B] uppercase">City</label>
                              <input className="w-full mt-1 px-3 py-2 rounded-xl border border-[#DCE3F0] text-sm" value={ap.city} onChange={e => updateAP({ city: e.target.value })} /></div>
                            <div><label className="text-[10px] font-bold text-[#64748B] uppercase">Occupation</label>
                              <input className="w-full mt-1 px-3 py-2 rounded-xl border border-[#DCE3F0] text-sm" value={ap.occupation} onChange={e => updateAP({ occupation: e.target.value })} /></div>
                            <div className="col-span-2"><label className="text-[10px] font-bold text-[#64748B] uppercase">Address</label>
                              <input className="w-full mt-1 px-3 py-2 rounded-xl border border-[#DCE3F0] text-sm" value={ap.address} onChange={e => updateAP({ address: e.target.value })} placeholder="Full residential address" /></div>
                            <div className="col-span-2">
                              <label className="text-[10px] font-bold text-[#64748B] uppercase">Room Preference</label>
                              <select className="w-full mt-1 px-3 py-2 rounded-xl border border-[#DCE3F0] text-sm" value={ap.roomPreference} onChange={e => updateAP({ roomPreference: e.target.value })}>
                                {["Single","Double","Triple","Quad","Quint"].map(r => {
                                  const extra = roomSurcharges[r.toLowerCase()] || 0;
                                  return <option key={r} value={r}>{r}{extra > 0 ? ` (+₦${extra.toLocaleString()})` : ""}</option>;
                                })}
                              </select>
                              {roomSurcharge > 0 && <p className="text-xs text-amber-600 mt-1 font-semibold">⚠ {ap.roomPreference} room surcharge: +₦{roomSurcharge.toLocaleString()}</p>}
                            </div>
                            {detType !== "adult" && (
                              <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                                <p className="text-xs font-black text-amber-700 uppercase">{detType === "infant" ? "👶 Infant" : "🧒 Child"} — Separate Booking</p>
                                {ciExtra > 0 ? <p className="text-xs text-amber-600 font-semibold">Extra charge: +₦{ciExtra.toLocaleString()}</p>
                                  : <p className="text-xs text-amber-600">No extra {detType} charge configured.</p>}
                                <div><label className="text-[10px] font-bold text-[#64748B] uppercase">Link to Parent (optional)</label>
                                  <select className="w-full mt-1 px-3 py-2 rounded-xl border border-[#DCE3F0] text-xs" value={ap.partner} onChange={e => updateAP({ partner: e.target.value })}>
                                    <option value="">None / Add later</option>
                                    {batchPilgrims.filter((_, j) => j !== batchActiveIndex).map((pp) => (
                                      <option key={pp.id} value={`${pp.firstName} ${pp.lastName}`.trim()}>{`${pp.firstName} ${pp.lastName}`.trim() || "Pilgrim"}</option>
                                    ))}
                                  </select></div>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 pt-2 border-t border-[#F1F5F9]">
                            <Button type="button" variant="outline" onClick={() => setBatchStep("upload")} className="rounded-xl text-xs font-bold h-9">← Back to Passports</Button>
                            {batchActiveIndex > 0 && (
                              <Button type="button" variant="outline" onClick={() => setBatchActiveIndex(i => Math.max(0, i - 1))} className="rounded-xl text-xs font-bold h-9">← Prev</Button>
                            )}
                            <div className="flex-1" />
                            {batchActiveIndex < batchPilgrims.length - 1 ? (
                              <Button type="button" onClick={() => setBatchActiveIndex(i => i + 1)} className="rounded-xl text-xs font-black h-9 bg-[#2D3199] text-white">Next →</Button>
                            ) : (
                              <Button type="button" onClick={() => {
                                setBatchPayments(batchPilgrims.map(() => ({ method: "cash", amountPaid: "", markVerified: true })));
                                setBatchStep("payment");
                              }} className="rounded-xl text-xs font-black h-9 bg-[#FF3B00] text-white">Continue to Payment →</Button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* BATCH STEP: Payment per pilgrim */}
                {batchStep === "payment" && batchPilgrims.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-black text-[#1C1F66] text-sm">Payment — {batchPilgrims.length} Pilgrim{batchPilgrims.length !== 1 ? "s" : ""}</h3>
                      <Button type="button" variant="outline" onClick={() => { setBatchActiveIndex(batchPilgrims.length - 1); setBatchStep("details"); }} className="rounded-xl text-xs font-bold h-8">← Back to Details</Button>
                    </div>
                    {batchPilgrims.map((p, i) => {
                      const pm = batchPayments[i] || { method: "cash", amountPaid: "", markVerified: true };
                      const updatePM = (updates: Partial<typeof pm>) => setBatchPayments(prev => prev.map((x, j) => j === i ? { ...x, ...updates } : x));
                      let detType: "adult" | "child" | "infant" = "adult";
                      if (p.dateOfBirth) {
                        const birth = new Date(p.dateOfBirth), now = new Date();
                        const ageM = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
                        if (ageM <= 23) detType = "infant"; else if (ageM <= 132) detType = "child";
                      }
                      const roomSurcharge = roomSurcharges[(p.roomPreference || "quad").toLowerCase()] || 0;
                      const ciExtra = detType === "infant" ? (childInfantPricing.infantPrice || 0) : detType === "child" ? (childInfantPricing.childPrice || 0) : 0;
                      const totalPrice = Number(effectivePrice) + roomSurcharge + ciExtra;
                      return (
                        <div key={p.id} className="border border-[#E2E8F0] rounded-2xl p-4 space-y-3 bg-white">
                          <div className="flex items-center gap-3">
                            {p.profilePhotoUrl && <img src={p.profilePhotoUrl} alt="" className="w-10 h-10 rounded-full object-cover" />}
                            <div className="flex-1">
                              <p className="font-black text-[#1C1F66] text-sm">{i + 1}. {`${p.firstName} ${p.lastName}`.trim() || "Pilgrim"}</p>
                              <p className="text-xs text-[#64748B]">{p.roomPreference || "Quad"} room{detType !== "adult" ? ` · ${detType}` : ""}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-[#2D3199]">₦{totalPrice.toLocaleString()}</p>
                              {roomSurcharge > 0 && <p className="text-[10px] text-amber-600">+₦{roomSurcharge.toLocaleString()} room</p>}
                              {ciExtra > 0 && <p className="text-[10px] text-amber-600">+₦{ciExtra.toLocaleString()} {detType}</p>}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {(["wallet", "cash", "bank_transfer"] as const).map(method => (
                              <button key={method} type="button" onClick={() => updatePM({ method })}
                                className={`p-2 rounded-xl border-2 text-xs font-bold transition-all ${
                                  pm.method === method ? "border-[#2D3199] bg-[#EEF0FF] text-[#2D3199]" : "border-[#DCE3F0] text-[#64748B]"
                                }`}>{method === "wallet" ? "🏦 Wallet" : method === "cash" ? "💵 Cash" : "🏦 Bank"}</button>
                            ))}
                          </div>
                          {pm.method !== "wallet" && (
                            <div>
                              <label className="text-[10px] font-bold text-[#64748B] uppercase">Amount Paid (₦)</label>
                              <div className="grid grid-cols-3 gap-1.5 mt-1">
                                {[{ label: "Full", amount: String(totalPrice) }, { label: "₦500k", amount: "500000" }, { label: "Custom", amount: "custom" }].map(opt => (
                                  <button key={opt.label} type="button"
                                    onClick={() => updatePM({ amountPaid: opt.label === "Custom" ? "" : opt.amount })}
                                    className={`p-2 rounded-xl border-2 text-[10px] font-bold transition-all ${
                                      pm.amountPaid === opt.amount && opt.label !== "Custom" ? "border-[#2D3199] bg-[#EEF0FF]" : "border-[#DCE3F0] text-[#64748B]"
                                    }`}>{opt.label}{opt.label !== "Custom" && <span className="block text-[9px] font-normal">₦{Number(opt.amount).toLocaleString()}</span>}</button>
                                ))}
                              </div>
                              {(pm.amountPaid === "" || (pm.amountPaid && pm.amountPaid !== String(totalPrice) && pm.amountPaid !== "500000")) && (
                                <input type="number" className="w-full mt-2 px-3 py-2 rounded-xl border border-[#DCE3F0] text-sm" placeholder="Enter amount" value={pm.amountPaid} onChange={e => updatePM({ amountPaid: e.target.value })} />
                              )}
                              {pm.amountPaid && Number(pm.amountPaid) > 0 && Number(pm.amountPaid) < totalPrice && (
                                <p className="text-xs text-amber-600 mt-1 font-semibold">Partial — ₦{(totalPrice - Number(pm.amountPaid)).toLocaleString()} balance remaining</p>
                              )}
                            </div>
                          )}
                          {pm.method === "wallet" && (
                            <p className="text-xs text-[#2D3199] font-bold mt-1">
                              Will deduct ₦{totalPrice.toLocaleString()} from your wallet.
                            </p>
                          )}
                        </div>
                      );
                    })}
                    {isBatchSubmitting && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2 text-sm font-bold text-[#2D3199]"><Loader2 className="w-4 h-4 animate-spin" />Creating {batchProgress}/{batchPilgrims.length}...</div>
                        <div className="w-full bg-[#E2E8F0] rounded-full h-2 mt-2"><div className="bg-[#2D3199] h-2 rounded-full transition-all" style={{ width: `${(batchProgress / batchPilgrims.length) * 100}%` }} /></div>
                      </div>
                    )}
                    <Button type="button" disabled={isBatchSubmitting} onClick={async () => {
                      if (isBatchSubmitting) return;

                      // Wallet balance check for batch
                      const totalWalletRequired = batchPilgrims.reduce((acc, p, i) => {
                        const pm = batchPayments[i] || { method: "cash", amountPaid: "", markVerified: true };
                        if (pm.method !== "wallet") return acc;
                        let detType: "adult" | "child" | "infant" = "adult";
                        if (p.dateOfBirth) {
                          const birth = new Date(p.dateOfBirth), now = new Date();
                          const ageM = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
                          if (ageM <= 23) detType = "infant"; else if (ageM <= 132) detType = "child";
                        }
                        const roomSurcharge = roomSurcharges[(p.roomPreference || "quad").toLowerCase()] || 0;
                        const ciExtra = detType === "infant" ? (childInfantPricing.infantPrice || 0) : detType === "child" ? (childInfantPricing.childPrice || 0) : 0;
                        return acc + Number(effectivePrice) + roomSurcharge + ciExtra;
                      }, 0);

                      if (totalWalletRequired > 0) {
                        const balance = walletData?.balance ?? 0;
                        if (balance < totalWalletRequired) {
                          toast({ title: "Insufficient wallet balance", description: `Need ₦${totalWalletRequired.toLocaleString()} from wallet, but you have ₦${balance.toLocaleString()}`, variant: "destructive" });
                          return;
                        }
                      }

                      setIsBatchSubmitting(true); setBatchProgress(0);
                      const batchId = crypto.randomUUID();
                      const results: { name: string; success: boolean; reference?: string; error?: string }[] = [];
                      for (let i = 0; i < batchPilgrims.length; i++) {
                        const p = batchPilgrims[i];
                        const pm = batchPayments[i] || { method: "cash", amountPaid: "0", markVerified: true };
                        setBatchProgress(i + 1);
                        let detType: "adult" | "child" | "infant" = "adult";
                        if (p.dateOfBirth) {
                          const birth = new Date(p.dateOfBirth), now = new Date();
                          const ageM = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
                          if (ageM <= 23) detType = "infant"; else if (ageM <= 132) detType = "child";
                        }
                        const roomSurcharge = roomSurcharges[(p.roomPreference || "quad").toLowerCase()] || 0;
                        const ciExtra = detType === "infant" ? (childInfantPricing.infantPrice || 0) : detType === "child" ? (childInfantPricing.childPrice || 0) : 0;
                        const pTotalPrice = Number(effectivePrice) + roomSurcharge + ciExtra;

                        try {
                          const data = await registerMutation.mutateAsync({
                            packageId: form.packageId,
                            civility: p.civility,
                            firstName: p.firstName,
                            lastName: p.lastName,
                            fullName: `${p.firstName} ${p.lastName}`.trim(),
                            passportNumber: p.passportNumber,
                            passportIssueDate: p.passportIssueDate,
                            passportExpiry: p.passportExpiry,
                            passportIssuingAuthority: p.passportIssuingAuthority,
                            dateOfBirth: p.dateOfBirth,
                            placeOfBirth: p.placeOfBirth,
                            gender: p.gender,
                            nationality: p.nationality,
                            maritalStatus: p.maritalStatus,
                            occupation: p.occupation,
                            ethnicGroup: p.ethnicGroup,
                            levelOfStudy: p.levelOfStudy,
                            visaNumber: p.visaNumber,
                            partner: p.partner,
                            underCover: p.underCover,
                            observation: p.observation,
                            passportCopyUrl: p.passportCopyUrl,
                            profilePhotoUrl: p.profilePhotoUrl,
                            phone: p.phone || "",
                            email: p.email || "",
                            country: p.country || "Nigeria",
                            city: p.city || "",
                            address: p.address || "",
                            roomPreference: p.roomPreference || "Double",
                            departureCity: p.departureCity || undefined,
                            paymentMethod: pm.method,
                            amountPaid: pm.method === "wallet" ? pTotalPrice : (pm.amountPaid ? Number(pm.amountPaid) : 0),
                            pilgrimType: detType,
                            batchId,
                          });
                          results.push({ name: `${p.firstName} ${p.lastName}`, success: true, reference: data.reference });
                        } catch (err: any) {
                          results.push({ name: `${p.firstName} ${p.lastName}`, success: false, error: err.message || "Failed" });
                        }
                      }
                      setIsBatchSubmitting(false);
                      const successes = results.filter(r => r.success);
                      if (successes.length > 0) { 
                        localStorage.removeItem("agent_client_draft"); 
                        setBatchResults(results); 
                        qc.invalidateQueries({ queryKey: ["agent-clients"] });
                        qc.invalidateQueries({ queryKey: ["agent-wallet"] });
                        qc.invalidateQueries({ queryKey: ["packages-active"] });
                        setRegStep(6); 
                      }
                      const failures = results.filter(r => !r.success);
                      if (failures.length > 0) toast({ title: `${failures.length} registration(s) failed`, description: failures.map(f => f.name).join(", "), variant: "destructive" });
                    }} className="w-full bg-[#FF3B00] hover:bg-[#CC2E00] text-white rounded-xl font-black h-11">
                      <UserPlus className="w-4 h-4 mr-2 inline" />
                      {isBatchSubmitting ? `Registering ${batchProgress}/${batchPilgrims.length}…` : `Register ${batchPilgrims.length} Client${batchPilgrims.length !== 1 ? "s" : ""}`}
                    </Button>
                  </div>
                )}
              </div>
            )}
            {regStep === 2 && !batchMode && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-[#EEF0FF] border border-[#2D3199]/20 p-4 rounded-xl">
                  <h3 className="text-sm font-black text-[#1C1F66] flex items-center gap-2 mb-2">
                    <BookOpen className="w-4 h-4" /> Scan Passport (Optional)
                  </h3>
                  <p className="text-xs text-[#2D3199]/80 mb-4">Auto-fill the details below by scanning the passport data page.</p>
                  <PassportScanner
                    onExtracted={data => {
                      setForm(f => ({
                        ...f,
                        firstName:         data.firstName        || f.firstName,
                        lastName:          data.lastName         || f.lastName,
                        passportNumber:    data.passportNumber   || f.passportNumber,
                        passportIssueDate: data.passportIssueDate || f.passportIssueDate,
                        passportExpiry:    data.passportExpiry   || f.passportExpiry,
                        dateOfBirth:       data.dateOfBirth      || f.dateOfBirth,
                        gender:            data.gender           || f.gender,
                        nationality:       data.nationality      || f.nationality,
                        passportCopyUrl:   data.passportImageDataUrl || f.passportCopyUrl,
                      }));
                    }}
                    onProfilePhoto={dataUrl => setForm(f => ({ ...f, profilePhotoUrl: dataUrl }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {show("passportNumber") && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-black text-[#1C1F66] uppercase tracking-wide">{lbl("passportNumber", "Passport No.")}</Label>
                      <Input value={form.passportNumber} onChange={e => set("passportNumber", e.target.value.toUpperCase())} placeholder="A12345678" className="rounded-xl border-[#E2E8F0] h-12 font-mono bg-white" />
                    </div>
                  )}
                  {show("passportIssuingAuthority") && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-black text-[#1C1F66] uppercase tracking-wide">{lbl("passportIssuingAuthority", "Issuing Authority")}</Label>
                      <Input value={form.passportIssuingAuthority} onChange={e => set("passportIssuingAuthority", e.target.value)} placeholder="e.g., NIS" className="rounded-xl border-[#E2E8F0] h-12 bg-white" />
                    </div>
                  )}
                  {show("passportIssueDate") && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-black text-[#1C1F66] uppercase tracking-wide">{lbl("passportIssueDate", "Issue Date")}</Label>
                      <Input type="date" value={form.passportIssueDate} onChange={e => set("passportIssueDate", e.target.value)} className="rounded-xl border-[#E2E8F0] h-12 bg-white" />
                    </div>
                  )}
                  {show("passportExpiry") && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-black text-[#1C1F66] uppercase tracking-wide">{lbl("passportExpiry", "Expiry Date")}</Label>
                      <Input type="date" value={form.passportExpiry} onChange={e => set("passportExpiry", e.target.value)} className="rounded-xl border-[#E2E8F0] h-12 bg-white" />
                    </div>
                  )}
                  {show("visaNumber") && (
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs font-black text-[#1C1F66] uppercase tracking-wide">{lbl("visaNumber", "Visa Number")}</Label>
                      <Input value={form.visaNumber} onChange={e => set("visaNumber", e.target.value)} placeholder="Visa Number" className="rounded-xl border-[#E2E8F0] h-12 font-mono bg-white" />
                    </div>
                  )}
                </div>
                {passportWarnLevel && (
                  <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-semibold ${passportWarnLevel === "expired" ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {passportWarnLevel === "expired" ? "Passport has expired — cannot register." : "Passport expiring within 6 months — may cause visa issues."}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 pt-1">
                  {show("passportCopyUrl") && (
                    <FileUploadBox
                      label="Passport Copy"
                      accept="image/*,.pdf"
                      value={form.passportCopyUrl}
                      onChange={v => set("passportCopyUrl", v)}
                      previewType="image"
                      folder="passports"
                    />
                  )}
                  {show("profilePhotoUrl") && (
                    <FileUploadBox
                      label="Profile Photo"
                      accept="image/*"
                      value={form.profilePhotoUrl}
                      onChange={v => set("profilePhotoUrl", v)}
                      previewType="image"
                      folder="photos"
                    />
                  )}
                </div>
              </div>
            )}

            {/* ── STEP 3: PERSONAL ── */}
            {regStep === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                
                <div className="space-y-4">
                  <h3 className="text-sm font-black border-b border-[#E2E8F0] pb-2 text-[#1C1F66]">Basic Information</h3>
                  <div className="grid grid-cols-5 gap-3">
                    {show("civility") && (
                      <div className="col-span-2 space-y-1.5">
                        <Label className="text-[10px] font-black text-[#64748B] uppercase tracking-wider">{lbl("civility", "Title")}</Label>
                        <Select value={form.civility} onValueChange={v => set("civility", v)}>
                          <SelectTrigger className="rounded-xl border-[#E2E8F0] h-12 bg-white"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>{CIVILITY.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    {show("firstName") && (
                      <div className="col-span-3 space-y-1.5">
                        <Label className="text-[10px] font-black text-[#64748B] uppercase tracking-wider">{lbl("firstName", "First Name")}</Label>
                        <Input value={form.firstName} onChange={e => set("firstName", e.target.value)} placeholder="Abubakar" className="rounded-xl border-[#E2E8F0] h-12 bg-white" />
                      </div>
                    )}
                  </div>
                  {show("lastName") && (
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black text-[#64748B] uppercase tracking-wider">{lbl("lastName", "Last Name")}</Label>
                      <Input value={form.lastName} onChange={e => set("lastName", e.target.value)} placeholder="Ibrahim" className="rounded-xl border-[#E2E8F0] h-12 bg-white" />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {show("dateOfBirth") && (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black text-[#64748B] uppercase tracking-wider">{lbl("dateOfBirth", "Date of Birth")}</Label>
                        <Input type="date" value={form.dateOfBirth} onChange={e => {
                          set("dateOfBirth", e.target.value);
                          if (e.target.value) {
                            const birth = new Date(e.target.value);
                            const now = new Date();
                            let years = now.getFullYear() - birth.getFullYear();
                            const mo = now.getMonth() - birth.getMonth();
                            if (mo < 0 || (mo === 0 && now.getDate() < birth.getDate())) years--;
                            if (years < 2) setPilgrimType("infant");
                            else if (years < 12) setPilgrimType("child");
                            else setPilgrimType("adult");
                          }
                        }} className="rounded-xl border-[#E2E8F0] h-12 bg-white" />
                      </div>
                    )}
                    {show("gender") && (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black text-[#64748B] uppercase tracking-wider">{lbl("gender", "Gender")}</Label>
                        <Select value={form.gender} onValueChange={v => set("gender", v)}>
                          <SelectTrigger className="rounded-xl border-[#E2E8F0] h-12 bg-white"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>{GENDERS.map(g => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  </div>
                  {/* Pilgrim Type selector */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black text-[#64748B] uppercase tracking-wider">Pilgrim Type</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {([["adult", "Adult", "👤"], ["child", "Child (2-11)", "🧒"], ["infant", "Infant (0-1)", "👶"]] as const).map(([val, label, icon]) => (
                        <button key={val} type="button" onClick={() => setPilgrimType(val)}
                          className={`p-2 rounded-xl border-2 text-center text-[10px] font-bold transition-all ${
                            pilgrimType === val ? "border-[#2D3199] bg-[#EEF0FF] text-[#2D3199]" : "border-[#DCE3F0] text-[#64748B] hover:border-[#2D3199]/30"
                          }`}>
                          {icon} {label}
                        </button>
                      ))}
                    </div>
                    {pilgrimType !== "adult" && (
                      <p className="text-[10px] text-amber-600 font-semibold">
                        ⚠ {pilgrimType === "infant" ? "Infants" : "Children"} will be registered as a separate booking.
                      </p>
                    )}
                  </div>

                {/* Other Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-black border-b border-[#E2E8F0] pb-2 text-[#1C1F66]">Other &amp; Preferences</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {show("nationality") && (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black text-[#64748B] uppercase tracking-wider">{lbl("nationality", "Nationality")}</Label>
                        <Select value={form.nationality} onValueChange={v => set("nationality", v)}>
                          <SelectTrigger className="rounded-xl border-[#E2E8F0] h-12 bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>{NATIONALITIES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    {show("placeOfBirth") && (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black text-[#64748B] uppercase tracking-wider">{lbl("placeOfBirth", "Place of Birth")}</Label>
                        <Input value={form.placeOfBirth} onChange={e => set("placeOfBirth", e.target.value)} placeholder="City / State" className="rounded-xl border-[#E2E8F0] h-12 bg-white" />
                      </div>
                    )}
                    {show("maritalStatus") && (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black text-[#64748B] uppercase tracking-wider">{lbl("maritalStatus", "Marital Status")}</Label>
                        <Select value={form.maritalStatus} onValueChange={v => set("maritalStatus", v)}>
                          <SelectTrigger className="rounded-xl border-[#E2E8F0] h-12 bg-white"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>{MARITAL_STATUS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    {show("levelOfStudy") && (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black text-[#64748B] uppercase tracking-wider">{lbl("levelOfStudy", "Level of Study")}</Label>
                        <Select value={form.levelOfStudy} onValueChange={v => set("levelOfStudy", v)}>
                          <SelectTrigger className="rounded-xl border-[#E2E8F0] h-12 bg-white"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>{LEVEL_OF_STUDY.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    {show("ethnicGroup") && (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black text-[#64748B] uppercase tracking-wider">{lbl("ethnicGroup", "Ethnic Group")}</Label>
                        <Input value={form.ethnicGroup} onChange={e => set("ethnicGroup", e.target.value)} placeholder="e.g. Hausa" className="rounded-xl border-[#E2E8F0] h-12 bg-white" />
                      </div>
                    )}
                    {(show("roomType") || show("roomPreference")) && (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black text-[#64748B] uppercase tracking-wider">{lbl("roomType", "Room Preference")}</Label>
                        <Select value={form.roomPreference} onValueChange={v => set("roomPreference", v)}>
                          <SelectTrigger className="rounded-xl border-[#E2E8F0] h-12 bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>{ROOMS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    {show("partner") && (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black text-[#64748B] uppercase tracking-wider">{lbl("partner", "Partner / Mahram")}</Label>
                        <Input value={form.partner} onChange={e => set("partner", e.target.value)} placeholder="Partner name" className="rounded-xl border-[#E2E8F0] h-12 bg-white" />
                      </div>
                    )}
                    {show("underCover") && (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black text-[#64748B] uppercase tracking-wider">{lbl("underCover", "Under Cover")}</Label>
                        <Input value={form.underCover} onChange={e => set("underCover", e.target.value)} placeholder="e.g. RAUDAH FUNTUA" className="rounded-xl border-[#E2E8F0] h-12 bg-white" />
                      </div>
                    )}
                    {show("observation") && (
                      <div className="space-y-1.5 col-span-2">
                        <Label className="text-[10px] font-black text-[#64748B] uppercase tracking-wider">{lbl("observation", "Observation")}</Label>
                        <Textarea value={form.observation} onChange={e => set("observation", e.target.value)} placeholder="Any notes…" className="rounded-xl border-[#E2E8F0] bg-white resize-none" rows={2} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 4: CONTACT ── */}
            {regStep === 4 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-4">
                  <h3 className="text-sm font-black border-b border-[#E2E8F0] pb-2 text-[#1C1F66]">Contact &amp; Address</h3>
                  {show("phone") && (
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black text-[#64748B] uppercase tracking-wider">{lbl("phone", "Phone")}</Label>
                      <div className="flex gap-2">
                        <Select value={phoneCode} onValueChange={setPhoneCode}>
                          <SelectTrigger className="w-[100px] rounded-xl border-[#E2E8F0] h-12 bg-white shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PHONE_CODES.map(p => (
                              <SelectItem key={p.code} value={p.code}>{p.flag} {p.code}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="800 000 0000" className="rounded-xl border-[#E2E8F0] h-12 bg-white flex-1" />
                      </div>
                    </div>
                  )}
                  {show("email") && (
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black text-[#64748B] uppercase tracking-wider">{lbl("email", "Email")}</Label>
                      <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="client@example.com" className="rounded-xl border-[#E2E8F0] h-12 bg-white" />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black text-[#64748B] uppercase tracking-wider">Occupation</Label>
                      <Input value={form.occupation} onChange={e => set("occupation", e.target.value)} placeholder="e.g. Teacher" className="rounded-xl border-[#E2E8F0] h-12 bg-white" />
                    </div>
                    {show("city") && (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black text-[#64748B] uppercase tracking-wider">{lbl("city", "City")}</Label>
                        <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="City" className="rounded-xl border-[#E2E8F0] h-12 bg-white" />
                      </div>
                    )}
                    {show("address") && (
                      <div className="space-y-1.5 col-span-2">
                        <Label className="text-[10px] font-black text-[#64748B] uppercase tracking-wider">{lbl("address", "Address")}</Label>
                        <Input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Full residential address" className="rounded-xl border-[#E2E8F0] h-12 bg-white" />
                      </div>
                    )}
                    {show("departureCity") && (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black text-[#64748B] uppercase tracking-wider">{lbl("departureCity", "Departure City")}</Label>
                        <Select value={form.departureCity} onValueChange={v => set("departureCity", v)}>
                          <SelectTrigger className="rounded-xl border-[#E2E8F0] h-12 bg-white"><SelectValue placeholder="Select…" /></SelectTrigger>
                          <SelectContent>
                            {["Lagos", "Abuja", "Kano", "Port Harcourt", "Ibadan", "Enugu"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {show("specialRequests") && (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black text-[#64748B] uppercase tracking-wider">{lbl("specialRequests", "Special Requests")}</Label>
                        <Input value={form.specialRequests} onChange={e => set("specialRequests", e.target.value)} placeholder="Any notes…" className="rounded-xl border-[#E2E8F0] h-12 bg-white" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 5: PAYMENT ── */}
            {regStep === 5 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-[#EEF0FF] p-4 rounded-xl border border-[#2D3199]/20 flex items-start gap-3">
                  <CreditCard className="w-5 h-5 text-[#2D3199] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-black text-[#1C1F66]">Payment & Finalize</h4>
                    <p className="text-xs text-[#2D3199]/80 mt-1">
                      Choose the payment method and enter the amount paid by the client. The minimum required for confirmation may vary by package.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {selectedPkg && (
                    <div className="bg-[#F0F2FF] rounded-2xl p-4 mb-2">
                      <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Booking Summary</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-black text-[#0F172A]">{selectedPkg.name}</p>
                          <p className="text-sm text-[#64748B]">
                            {form.civility && `${form.civility} `}{form.firstName} {form.lastName}
                          </p>
                        </div>
                        <p className="font-black text-[#2D3199] text-xl">₦{effectivePrice.toLocaleString()}{selectedDiscount ? <span className="text-xs text-emerald-600 ml-1 font-bold">({selectedDiscount.discountType === "percentage" ? `${selectedDiscount.discountValue}% off` : `₦${selectedDiscount.discountValue.toLocaleString()} off`})</span> : null}</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Payment Method</Label>
                    <div className={`grid gap-3 mt-1 ${paystackEnabled ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
                      {paystackEnabled && (
                        <div onClick={() => setForm(f => ({ ...f, paymentMethod: "online" }))}
                          className={`cursor-pointer rounded-xl border-2 p-3 text-sm font-semibold text-center transition-all ${form.paymentMethod === "online" ? "border-[#FF3B00] bg-[#FFF0EC] text-[#FF3B00]" : "border-[#DCE3F0] text-[#64748B] hover:border-[#FF3B00]/30"}`}>
                          💳 Pay Online
                          <span className="block text-[10px] mt-0.5 font-normal opacity-70">Paystack — Instant</span>
                        </div>
                      )}
                      <div onClick={() => {
                        if (walletBalance >= effectivePrice) {
                          setForm(f => ({ ...f, paymentMethod: "wallet" }));
                        }
                      }}
                        className={`cursor-pointer rounded-xl border-2 p-3 text-sm font-semibold text-center transition-all ${walletBalance < effectivePrice ? "opacity-50 cursor-not-allowed border-[#E2E8F0] bg-gray-50 text-gray-400" : form.paymentMethod === "wallet" ? "border-[#2D3199] bg-[#EEF0FF] text-[#2D3199]" : "border-[#DCE3F0] text-[#64748B] hover:border-[#2D3199]/30"}`}>
                        🏦 Wallet
                        <span className="block text-[10px] mt-0.5 font-normal opacity-70">{walletBalance >= effectivePrice ? "Instant Deduct" : "Insuff. Balance"}</span>
                      </div>
                      <div onClick={() => setForm(f => ({ ...f, paymentMethod: "cash" }))}
                        className={`cursor-pointer rounded-xl border-2 p-3 text-sm font-semibold text-center transition-all ${form.paymentMethod === "cash" ? "border-[#2D3199] bg-[#EEF0FF] text-[#2D3199]" : "border-[#DCE3F0] text-[#64748B] hover:border-[#2D3199]/30"}`}>
                        💵 Cash
                        <span className="block text-[10px] mt-0.5 font-normal opacity-70">Paid in Office</span>
                      </div>
                      <div onClick={() => setForm(f => ({ ...f, paymentMethod: "bank_transfer" }))}
                        className={`cursor-pointer rounded-xl border-2 p-3 text-sm font-semibold text-center transition-all ${form.paymentMethod === "bank_transfer" ? "border-[#2D3199] bg-[#EEF0FF] text-[#2D3199]" : "border-[#DCE3F0] text-[#64748B] hover:border-[#2D3199]/30"}`}>
                        🏦 Bank
                        <span className="block text-[10px] mt-0.5 font-normal opacity-70">Transfer</span>
                      </div>
                    </div>
                  </div>

                  {form.paymentMethod !== "online" && form.paymentMethod !== "wallet" && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-black text-[#1C1F66] uppercase tracking-wide">Payment Amount</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { key: "full", label: "Full Payment", amount: String(effectivePrice) },
                            { key: "500000", label: "Minimum Deposit", amount: "500000" },
                            { key: "1000000", label: "₦1,000,000", amount: "1000000" },
                            { key: "custom", label: "Custom Amount", amount: "" },
                          ].map(opt => (
                            <button key={opt.key} type="button"
                              onClick={() => set("amountPaid", opt.amount)}
                              className={`p-3 rounded-xl border-2 text-left transition-all ${
                                form.amountPaid === opt.amount ? "border-[#2D3199] bg-[#EEF0FF]" : "border-[#DCE3F0] hover:border-[#2D3199]/30"
                              }`}>
                              <span className="text-xs font-bold text-[#0F172A] block">{opt.label}</span>
                              {opt.amount && <span className="text-[10px] text-[#64748B]">₦{Number(opt.amount).toLocaleString()}</span>}
                            </button>
                          ))}
                        </div>
                        {/* Custom amount input */}
                        {!["", String(effectivePrice), "500000", "1000000"].includes(form.amountPaid) && (
                          <div className="mt-2 relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B] font-bold">₦</span>
                            <Input type="number" value={form.amountPaid} onChange={e => set("amountPaid", e.target.value)} placeholder="Enter amount" className="pl-8 rounded-xl border-[#E2E8F0] h-12 text-lg font-black text-[#0F172A] bg-white" min={0} />
                          </div>
                        )}
                      </div>
                      
                      {selectedPkg && form.amountPaid && Number(form.amountPaid) > 0 && (
                        <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs space-y-1">
                          <div className="flex justify-between text-[#64748B]"><span>Total Price:</span> <span>₦{effectivePrice.toLocaleString()}</span></div>
                          <div className="flex justify-between text-emerald-600 font-bold"><span>Amount Paid:</span> <span>₦{Number(form.amountPaid).toLocaleString()}</span></div>
                          <div className="flex justify-between text-[#0F172A] font-black border-t border-[#E2E8F0] pt-1 mt-1">
                            <span>Balance Remaining:</span> 
                            <span>₦{Math.max(0, effectivePrice - Number(form.amountPaid)).toLocaleString()}</span>
                          </div>
                        </div>
                      )}

                      {form.paymentMethod === "bank_transfer" && (
                        <div className="mt-4 p-4 rounded-xl border border-[#DCE3F0] bg-white space-y-4">
                          <div>
                            <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Transfer To</p>
                            {bankAccounts.length > 0 ? (
                              <div className="space-y-3">
                                {bankAccounts.map(b => (
                                  <div key={b.id} className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                                    <p className="font-bold text-[#0F172A] text-sm">{b.bankName}</p>
                                    <p className="font-mono text-[#2D3199] font-black">{b.accountNumber} {b.sortCode ? `· ${b.sortCode}` : ""}</p>
                                    <p className="text-xs text-[#64748B]">{b.accountName}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                                <p className="font-bold text-[#0F172A] text-sm">GTBank</p>
                                <p className="font-mono text-[#2D3199] font-black">0123456789</p>
                                <p className="text-xs text-[#64748B]">Raudah Travels & Tours Ltd</p>
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black text-[#64748B] uppercase tracking-wider">Transaction Reference (Optional)</Label>
                            <Input value={form.paymentReference} onChange={e => set("paymentReference", e.target.value)} placeholder="e.g. FT234567890" className="rounded-xl border-[#E2E8F0] h-11 bg-white" />
                          </div>

                          <FileUploadBox
                            label="Proof of Payment (Optional)"
                            accept="image/*,application/pdf"
                            previewType="file"
                            value={form.paymentProofUrl}
                            onChange={v => set("paymentProofUrl", v)}
                            folder="receipts"
                          />

                        </div>
                      )}

                    </>
                  )}

                  {form.paymentMethod === "online" && (
                    <div className="bg-[#FFF4F0] border border-[#FF3B00]/20 rounded-xl p-4 text-sm">
                      <p className="font-bold text-[#FF3B00] mb-1">💳 Paystack Online Payment</p>
                      <p className="text-[#64748B]">The pilgrim's email will be used for payment. A Paystack popup will open after you click Complete Registration.</p>
                      {!form.email && (
                        <p className="text-amber-600 font-semibold mt-1 text-xs">⚠ Add pilgrim email in Contact step for best results.</p>
                      )}
                    </div>
                  )}

                  {form.paymentMethod === "wallet" && (
                    <div className="bg-[#EEF0FF] border border-[#2D3199]/20 rounded-xl p-4 text-sm">
                      <p className="font-bold text-[#2D3199] mb-1">🏦 Wallet Payment</p>
                      <p className="text-[#64748B]">₦{effectivePrice.toLocaleString()} will be automatically deducted from your wallet balance to confirm this booking.</p>
                      <p className="text-[#2D3199] font-bold mt-2 pt-2 border-t border-[#2D3199]/10">
                        Remaining Balance: ₦{Math.max(0, walletBalance - effectivePrice).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── STEP 6: SUCCESS ── */}
            {regStep === 6 && (
              <div className="space-y-6 text-center py-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-[#0F172A]">
                    {batchResults.length > 0
                      ? `${batchResults.filter(r => r.success).length} Registration${batchResults.filter(r => r.success).length !== 1 ? "s" : ""} Complete`
                      : "Registration Complete"}
                  </h3>
                  <p className="text-sm text-[#64748B] mt-1">
                    {batchResults.length > 0
                      ? `${batchResults.filter(r => r.success).length} of ${batchResults.length} client(s) added successfully.`
                      : "Client has been successfully added to your list."}
                  </p>
                </div>
                {batchResults.length > 0 ? (
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 text-left space-y-2">
                    <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Batch Results</p>
                    {batchResults.map((r, i) => (
                      <div key={i} className={`flex items-center gap-2 text-sm ${r.success ? "text-emerald-700" : "text-red-600"}`}>
                        {r.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                        <span className="font-medium">{r.name}</span>
                        {r.reference && <span className="ml-auto font-mono text-xs text-[#64748B]">{r.reference}</span>}
                        {r.error && <span className="ml-auto text-xs">{r.error}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 inline-block">
                    <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Reference Number</p>
                    <p className="font-mono text-2xl font-black text-[#2D3199]">{result?.reference}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── FOOTER ACTIONS ── */}
            <div className="pt-4 border-t border-[#E2E8F0] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#F8FAFC]">
              {regStep === 6 ? (
                <>
                  <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto rounded-xl text-[#94A3B8] hover:bg-[#E2E8F0] font-bold h-12 px-6">
                    Close
                  </Button>
                  {form.paymentMethod !== "online" && (
                    <Button type="button" onClick={() => {
                      setResult(null);
                      setForm(f => ({ ...BLANK_FORM, packageId: f.packageId, paymentMethod: f.paymentMethod }));
                      setPilgrimType("adult");
                      setBatchMode(false); setBatchPilgrims([]); setBatchStep("upload"); setBatchActiveIndex(0); setBatchPayments([]); setBatchCropTarget(null); setBatchCropState(null);
                      setIsBatchSubmitting(false); setBatchProgress(0); setBatchResults([]);
                      setRegStep(2);
                    }} className="w-full sm:w-auto bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl font-black h-12 px-6 shadow-md">
                      <UserPlus className="w-4 h-4 mr-2" /> Register Another Client
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {regStep > 1 ? (
                    <Button type="button" variant="outline" onClick={() => setRegStep(s => s - 1)} className="w-full sm:w-auto rounded-xl border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] font-bold h-12 px-6">
                      <ChevronLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                  ) : (
                    <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto rounded-xl text-[#94A3B8] hover:bg-[#E2E8F0] font-bold h-12 px-6">
                      Cancel
                    </Button>
                  )}

                  {regStep < 5 ? (
                    <Button type="button" onClick={() => {
                      if (regStep === 1 && !form.packageId) { toast({ title: "Select a package", variant: "destructive" }); return; }
                      if (regStep === 2) {
                        const { valid, missingFields } = validateRequiredFields(cfg, form,
                          ["passportNumber", "passportIssueDate", "passportExpiry"]);
                        if (!valid) {
                          toast({ title: "Required fields missing", description: missingFields.map(f => f.label).join(", "), variant: "destructive" }); return;
                        }
                      }
                      if (regStep === 3) {
                        const { valid, missingFields } = validateRequiredFields(cfg, form,
                          ["firstName", "lastName", "dateOfBirth", "gender", "nationality"]);
                        if (!valid) {
                          toast({ title: "Required fields missing", description: missingFields.map(f => f.label).join(", "), variant: "destructive" }); return;
                        }
                      }
                      if (regStep === 4) {
                        const { valid, missingFields } = validateRequiredFields(cfg, form,
                          ["phone", "email", "country", "city"]);
                        if (!valid) {
                          toast({ title: "Required fields missing", description: missingFields.map(f => f.label).join(", "), variant: "destructive" }); return;
                        }
                      }
                      setRegStep(s => s + 1);
                    }} disabled={!isOnline} className="w-full sm:w-auto bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl font-black h-12 px-8 shadow-md">
                      Next Step <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button type="button" onClick={handleSubmit} disabled={registerMutation.isPending || passportWarnLevel === "expired"} className="w-full sm:w-auto bg-[#FF3B00] hover:bg-[#D63200] text-white rounded-xl font-black h-12 px-8 shadow-lg shadow-[#FF3B00]/20 gap-2">
                      {registerMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</> : <><CheckCircle2 className="w-4 h-4" /> Complete Registration</>}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Batch Profile Crop Dialog */}
      {batchCropTarget && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setBatchCropTarget(null); }}>
          <DialogContent className="max-w-xl p-0 overflow-hidden bg-white rounded-3xl gap-0 border-0">
            <DialogHeader className="p-5 pb-3">
              <DialogTitle className="text-lg font-black text-[#0F172A]">✂ Crop Profile Photo</DialogTitle>
              <DialogDescription className="text-xs text-[#64748B]">Drag to frame the face. Click Confirm to save.</DialogDescription>
            </DialogHeader>
            <div className="bg-[#1e293b] border-y border-[#334155] p-4 flex justify-center items-center min-h-[300px]">
              <ReactCrop crop={batchCropState} onChange={(_: any, pct: any) => setBatchCropState(pct)} aspect={1} keepSelection className="max-h-[60vh]">
                <img ref={batchCropImgRef} src={batchCropTarget.imageUrl} alt="Passport"
                  className="max-w-full max-h-[60vh] object-contain rounded-lg"
                  onLoad={() => setBatchCropState({ unit: "%" as const, x: 3, y: 7, width: 28, height: 61 })} />
              </ReactCrop>
            </div>
            <DialogFooter className="p-4 bg-white flex items-center justify-between">
              <Button type="button" variant="outline" onClick={() => setBatchCropTarget(null)} className="rounded-xl border-[#E2E8F0] font-bold h-11 px-6">Cancel</Button>
              <Button type="button" onClick={async () => {
                if (!batchCropImgRef.current || !batchCropState) return;
                const img = batchCropImgRef.current;
                const scaleX = img.naturalWidth / img.width, scaleY = img.naturalHeight / img.height;
                const pxX = (batchCropState.x / 100) * img.width, pxY = (batchCropState.y / 100) * img.height;
                const pxW = (batchCropState.width / 100) * img.width, pxH = (batchCropState.height / 100) * img.height;
                const canvas = document.createElement("canvas");
                canvas.width = pxW * scaleX; canvas.height = pxH * scaleY;
                const ctx = canvas.getContext("2d");
                if (ctx) ctx.drawImage(img, pxX * scaleX, pxY * scaleY, pxW * scaleX, pxH * scaleY, 0, 0, canvas.width, canvas.height);
                const final = document.createElement("canvas"); final.width = 400; final.height = 400;
                const fCtx = final.getContext("2d");
                if (fCtx) { fCtx.fillStyle = "#fff"; fCtx.fillRect(0,0,400,400); fCtx.drawImage(canvas,0,0,canvas.width,canvas.height,0,0,400,400); }
                const dataUrl = final.toDataURL("image/jpeg", 0.92);
                try {
                  const res2 = await fetch(dataUrl); const blob = await res2.blob();
                  const file = new File([blob], "profile.jpg", { type: "image/jpeg" });
                  const { uploadFile } = await import("@/lib/upload");
                  const url = await uploadFile(file, "photos");
                  setBatchPilgrims(prev => prev.map((p, i) => i === batchCropTarget!.index ? { ...p, profilePhotoUrl: url } : p));
                } catch { /* fallback: store dataUrl locally */
                  setBatchPilgrims(prev => prev.map((p, i) => i === batchCropTarget!.index ? { ...p, profilePhotoUrl: dataUrl } : p));
                }
                setBatchCropTarget(null);
              }} className="rounded-xl bg-[#2D3199] hover:bg-[#1C1F66] text-white font-black h-11 px-6">Confirm Crop</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
