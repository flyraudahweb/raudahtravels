import { useState, useEffect, useRef, useMemo } from "react";
import { uploadFile } from "@/lib/upload";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2, ChevronRight, ChevronLeft, UserPlus, Package, User,
  CreditCard, BookOpen, Phone, Camera, FileText, Upload, X, AlertTriangle, Search,
  WifiOff, Wifi, Baby, AlertCircle, Loader2,
} from "lucide-react";
import PassportScanner from "@/components/PassportScanner";
import BatchPassportUpload, { type BatchPilgrim } from "@/components/BatchPassportUpload";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useFormFieldConfig, validateRequiredFields } from "@/hooks/useFormFieldConfig";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import ReactCrop, { type Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

declare global {
  interface Window {
    PaystackPop?: new () => {
      resumeTransaction(
        accessCode: string,
        options?: {
          onSuccess?: (transaction: { reference: string }) => void;
          onCancel?: () => void;
          onError?: (error: Error) => void;
        }
      ): void;
    };
  }
}

interface PackageOption {
  id: string; name: string; type: string; price: number;
  departureDate: string; capacity: number; currentBookings: number;
}

const STEPS = [
  { id: 1, label: "Package",  icon: Package },
  { id: 2, label: "Passport", icon: BookOpen },
  { id: 3, label: "Personal", icon: User },
  { id: 4, label: "Contact",  icon: Phone },
  { id: 5, label: "Payment",  icon: CreditCard },
];

const CIVILITY_OPTIONS = ["Mr", "Mrs", "Miss", "Dr", "Prof", "Alhaji", "Alhaja", "Mal.", "Hajiya"];
const GENDERS         = ["male", "female"];
const NATIONALITIES   = ["Nigerian", "Burkinabe", "Nigerien", "Ghanaian", "Senegalese", "Cameroonian", "Other"];
const MARITAL_STATUS  = ["Single", "Married", "Divorced", "Widowed"];
const LEVEL_OF_STUDY  = ["None", "Primary", "Secondary", "Tertiary", "Postgraduate"];
const ROOM_PREFS      = ["Single", "Double", "Triple", "Quad"];

const ETHNIC_GROUPS = [
  "Hausa", "Fulani", "Yoruba", "Igbo", "Ijaw", "Kanuri",
  "Ibibio", "Tiv", "Edo", "Nupe", "Efik", "Itsekiri",
];

const PHONE_CODES = [
  { code: "+234", flag: "🇳🇬", label: "Nigeria" },
  { code: "+226", flag: "🇧🇫", label: "Burkina Faso" },
  { code: "+227", flag: "🇳🇪", label: "Niger" },
  { code: "+233", flag: "🇬🇭", label: "Ghana" },
  { code: "+221", flag: "🇸🇳", label: "Senegal" },
  { code: "+237", flag: "🇨🇲", label: "Cameroon" },
  { code: "+229", flag: "🇧🇯", label: "Benin" },
  { code: "+225", flag: "🇨🇮", label: "Côte d'Ivoire" },
  { code: "+966", flag: "🇸🇦", label: "Saudi Arabia" },
];

async function fetchPackages(): Promise<{ packages: PackageOption[] }> {
  const r = await fetch("/api/packages?status=active&limit=50", { credentials: "include" });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function bookPilgrim(data: any): Promise<{ booking: any; reference: string }> {
  const r = await fetch("/api/admin/book-pilgrim", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to create booking");
  return r.json();
}



function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-8 flex-wrap">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const done   = current > s.id;
        const active = current === s.id;
        return (
          <div key={s.id} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${done ? "bg-emerald-500" : active ? "bg-[#2D3199]" : "bg-[#F1F5F9]"}`}>
                {done
                  ? <CheckCircle2 className="w-4 h-4 text-white" />
                  : <Icon className={`w-4 h-4 ${active ? "text-white" : "text-[#94A3B8]"}`} />}
              </div>
              <span className={`text-[10px] font-bold whitespace-nowrap ${active ? "text-[#2D3199]" : done ? "text-emerald-500" : "text-[#94A3B8]"}`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 mb-4 rounded-full ${done ? "bg-emerald-400" : "bg-[#F1F5F9]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FileUploadBox({
  label, accept, value, onChange, previewType = "image", folder = "documents",
}: {
  label: string; accept: string; value: string; onChange: (v: string) => void; previewType?: "image" | "file"; folder?: "passports" | "photos" | "receipts" | "documents";
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
  const isPdf   = value && (value.startsWith("data:application/pdf") || /\.pdf$/i.test(value));

  return (
    <div>
      <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{label}</Label>
      <div className="mt-1">
        {value ? (
          <div className="rounded-xl border-2 border-[#2D3199] overflow-hidden bg-[#EEF0FF]">
            <div className="relative">
              {isImage && previewType === "image" ? (
                <img src={value} alt="preview" className="w-full h-32 object-cover" />
              ) : (
                <div className="flex items-center gap-3 p-4">
                  <FileText className="w-8 h-8 text-[#2D3199]" />
                  <div>
                    <p className="text-xs font-bold text-[#2D3199]">File uploaded</p>
                    <p className="text-[10px] text-[#64748B]">{isPdf ? "PDF document" : "Document"}</p>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => { onChange(""); if (inputRef.current) inputRef.current.value = ""; }}
                className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow border border-[#DCE3F0] hover:bg-red-50"
              >
                <X className="w-3 h-3 text-[#64748B]" />
              </button>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 border-t border-[#C7CCF5] bg-[#EEF0FF]">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex items-center gap-1.5 text-[10px] font-bold text-[#2D3199] hover:text-[#1C1F66] transition-colors"
              >
                <Upload className="w-3 h-3" />
                Change
              </button>
              <span className="text-[#C7CCF5] text-xs">·</span>
              <button
                type="button"
                onClick={() => { onChange(""); if (inputRef.current) inputRef.current.value = ""; }}
                className="flex items-center gap-1.5 text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors"
              >
                <X className="w-3 h-3" />
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-[#DCE3F0] hover:border-[#2D3199]/40 bg-[#F8FAFC] hover:bg-[#EEF0FF] transition-all p-5 flex flex-col items-center gap-2 text-center"
          >
            <Upload className="w-6 h-6 text-[#94A3B8]" />
            <span className="text-xs font-semibold text-[#64748B]">{uploading ? "Uploading…" : "Click to upload"}</span>
            <span className="text-[10px] text-[#94A3B8]">{accept.includes("pdf") ? "JPG, PNG or PDF" : "JPG or PNG"} · Max 3MB</span>
          </button>
        )}
        <input ref={inputRef} type="file" accept={accept} onChange={handleFile} className="hidden" />
      </div>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="flex-1 h-px bg-[#F1F5F9]" />
      <span className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8]">{label}</span>
      <div className="flex-1 h-px bg-[#F1F5F9]" />
    </div>
  );
}

function passportExpiryWarning(expiry: string): { type: "expired" | "soon" } | null {
  if (!expiry) return null;
  const d = new Date(expiry);
  const now = new Date();
  if (d < now) return { type: "expired" };
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() + 3);
  if (d <= cutoff) return { type: "soon" };
  return null;
}

function PassportExpiryAlert({ expiry }: { expiry: string }) {
  const w = passportExpiryWarning(expiry);
  if (!w) return null;
  const isExpired = w.type === "expired";
  const expiryStr = new Date(expiry).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  return (
    <div className="rounded-2xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-orange-50 p-5">
      <div className="flex gap-4">
        <div className="w-11 h-11 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-red-800 text-sm uppercase tracking-wide mb-2">
            {isExpired ? "Passport Expired — Registration Blocked" : "Passport Expiring Soon — Registration Blocked"}
          </p>
          <p className="text-red-700 text-sm leading-relaxed">
            {isExpired
              ? `This passport expired on ${expiryStr}. An expired passport cannot be used for Hajj or Umrah visa applications.`
              : `This passport expires on ${expiryStr}, which is within 3 months from today.`
            }
            {" "}Saudi Arabia requires all passport holders to have a minimum of 6 months validity beyond the travel date. Additionally, visa processing can take several weeks — if a delay occurs, the pilgrim may be unable to travel.
          </p>
          <p className="text-red-600 text-xs mt-3 font-bold border-t border-red-200 pt-2">
            To proceed, the pilgrim must obtain a renewed or replacement passport before registration can continue.
          </p>
        </div>
      </div>
    </div>
  );
}

type PilgrimState = {
  civility: string; firstName: string; lastName: string;
  passportNumber: string; passportIssueDate: string; passportExpiry: string; passportIssuingAuthority: string;
  passportCopyUrl: string; profilePhotoUrl: string;
  dateOfBirth: string; placeOfBirth: string; gender: string; nationality: string;
  ethnicGroup: string; maritalStatus: string; levelOfStudy: string;
  visaNumber: string; partner: string; underCover: string; observation: string;
  phone: string; email: string; occupation: string; country: string; city: string; address: string;
};

const DEFAULT_PILGRIM: PilgrimState = {
  civility: "", firstName: "", lastName: "",
  passportNumber: "", passportIssueDate: "", passportExpiry: "", passportIssuingAuthority: "",
  passportCopyUrl: "", profilePhotoUrl: "",
  dateOfBirth: "", placeOfBirth: "", gender: "", nationality: "Nigerian",
  ethnicGroup: "", maritalStatus: "", levelOfStudy: "",
  visaNumber: "", partner: "", underCover: "", observation: "",
  phone: "", email: "", occupation: "", country: "Nigeria", city: "", address: "",
};

export default function AdminBookPilgrim() {
  const { toast } = useToast();
  const [step, setStep]     = useState(1);
  const [result, setResult] = useState<{ reference: string } | null>(null);

  const [packageId, setPackageId] = useState("");
  const [pilgrim, setPilgrim]     = useState<PilgrimState>(DEFAULT_PILGRIM);
  const [travel, setTravel]       = useState({
    departureCity: "", roomPreference: "Quad", specialRequests: "",
  });
  const [payment, setPayment] = useState({ method: "cash", markVerified: true, amountPaid: "", paymentReference: "", paymentProofUrl: "" });
  const [pkgTab, setPkgTab]     = useState<"all" | "hajj" | "umrah">("all");
  const [pkgSearch, setPkgSearch] = useState("");
  const [phoneCode, setPhoneCode] = useState("+234");
  const [isRestored, setIsRestored] = useState(false);
  const [pilgrimType, setPilgrimType] = useState<"adult" | "child" | "infant">("adult");
  const [batchMode, setBatchMode] = useState(false);
  const [batchPilgrims, setBatchPilgrims] = useState<BatchPilgrim[]>([]);
  const [batchStep, setBatchStep] = useState<"upload" | "details" | "payment">("upload");
  const [batchActiveIndex, setBatchActiveIndex] = useState(0);
  const [batchPayments, setBatchPayments] = useState<Array<{
    method: string;
    amountPaid: string;
    markVerified: boolean;
    paymentReference: string;
    paymentProofUrl: string;
  }>>([]);
  const [batchCropTarget, setBatchCropTarget] = useState<{ index: number; imageUrl: string } | null>(null);
  const [batchCropState, setBatchCropState] = useState<any>(null);
  const batchCropImgRef = useRef<HTMLImageElement>(null);
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchResults, setBatchResults] = useState<{ name: string; success: boolean; reference?: string; error?: string }[]>([]);
  const paystackScriptLoaded = useRef(false);
  const { isOnline, wasOffline } = useOnlineStatus();

  // Restore draft on mount
  useEffect(() => {
    try {
      const draft = localStorage.getItem("admin_pilgrim_draft");
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.packageId) setPackageId(parsed.packageId);
        if (parsed.pilgrim) setPilgrim(parsed.pilgrim);
        if (parsed.travel) setTravel(parsed.travel);
        if (parsed.payment) setPayment(parsed.payment);
        if (parsed.step) setStep(parsed.step);
        if (parsed.phoneCode) setPhoneCode(parsed.phoneCode);
        if (parsed.pilgrimType) setPilgrimType(parsed.pilgrimType);
      }
    } catch (e) {
      // ignore
    }
    setIsRestored(true);
  }, []);

  // Save draft on changes
  useEffect(() => {
    if (!isRestored) return;
    // Don't save draft if we are on the success step
    if (step === 6) {
      localStorage.removeItem("admin_pilgrim_draft");
      return;
    }
    localStorage.setItem("admin_pilgrim_draft", JSON.stringify({ packageId, pilgrim, travel, payment, step, phoneCode, pilgrimType }));
  }, [packageId, pilgrim, travel, payment, step, phoneCode, isRestored, pilgrimType]);

  const { data: pkgData } = useQuery({ queryKey: ["packages-for-booking"], queryFn: fetchPackages });
  
  const { data: bankAccountsData } = useQuery<{ accounts: any[] }>({
    queryKey: ["public-bank-accounts"],
    queryFn: () => fetch("/api/bank-accounts").then(r => r.json()),
    staleTime: 60000,
  });
  const bankAccounts = bankAccountsData?.accounts || [];

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

  const { data: appConfig } = useQuery<{ paystackPublicKey: string; paystackEnabled: boolean }>({
    queryKey: ["app-config"],
    queryFn: () => fetch("/api/config").then(r => r.json()),
    staleTime: 30000,
  });
  const paystackEnabled = appConfig?.paystackEnabled ?? true;

  useEffect(() => {
    if (!paystackScriptLoaded.current) {
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v2/inline.js";
      script.async = true;
      document.body.appendChild(script);
      paystackScriptLoaded.current = true;
    }
  }, []);
  const packages    = pkgData?.packages || [];
  const selectedPkg = packages.find(p => p.id === packageId);

  const hajjCount  = useMemo(() => packages.filter(p => p.type === "hajj").length,  [packages]);
  const umrahCount = useMemo(() => packages.filter(p => p.type === "umrah").length, [packages]);

  const visiblePackages = useMemo(() => {
    let list = packages;
    if (pkgTab !== "all") list = list.filter(p => p.type === pkgTab);
    if (pkgSearch.trim()) {
      const q = pkgSearch.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [packages, pkgTab, pkgSearch]);

  const set = (key: keyof PilgrimState) => (v: string) => setPilgrim(p => ({ ...p, [key]: v }));
  const setInput = (key: keyof PilgrimState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key)(e.target.value);

  const cfg = useFormFieldConfig();
  const show = (name: string) => cfg(name).visible;
  const req  = (name: string) => cfg(name).visible && cfg(name).required;
  const lbl  = (name: string, label: string) => (
    <>{label}{req(name) && <span className="text-red-500 ml-0.5 font-black normal-case">*</span>}</>
  );

  const showIdentitySection   = show("civility") || show("gender") || show("firstName") || show("lastName") || show("dateOfBirth") || show("placeOfBirth") || show("nationality") || show("ethnicGroup");
  const showAdditionalSection = show("maritalStatus") || show("levelOfStudy") || show("partner") || show("underCover") || show("observation");

  const handlePaystackPayment = async (bookingId: string, serverBooking?: { totalPrice?: string }) => {
    try {
      const amount = (Number(serverBooking?.totalPrice) || selectedPkg?.price) ?? 0;
      const res = await fetch("/api/payments/paystack/initialize", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ bookingId, amount, email: pilgrim.email || "admin@raudah.com" }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error((errBody as any).error || "Initialize failed");
      }
      const data = await res.json() as { reference: string; accessCode: string };
      if (!window.PaystackPop) throw new Error("Paystack script not loaded");
      const popup = new window.PaystackPop();
      popup.resumeTransaction(data.accessCode, {
        onSuccess: (transaction) => { setResult({ reference: transaction.reference }); setStep(6); },
        onCancel: () => {
          fetch(`/api/bookings/${bookingId}`, { method: "DELETE", credentials: "include" }).catch(() => {});
          toast({ title: "Payment cancelled", description: "The payment window was closed and the pending booking has been discarded." });
        },
        onError: (err) => {
          fetch(`/api/bookings/${bookingId}`, { method: "DELETE", credentials: "include" }).catch(() => {});
          toast({ title: "Payment error", description: err.message || "Could not launch Paystack. The pending booking was discarded.", variant: "destructive" });
        }
      });
    } catch (err: any) {
      fetch(`/api/bookings/${bookingId}`, { method: "DELETE", credentials: "include" }).catch(() => {});
      toast({ title: "Payment error", description: err.message || "Could not launch Paystack. The pending booking was discarded.", variant: "destructive" });
    }
  };

  const bookMutation = useMutation({
    mutationFn: bookPilgrim,
    onSuccess: async (data) => {
      // Skip automatic navigation during batch submission — batch handler manages its own flow
      if (isBatchSubmitting) return;
      if (payment.method === "online") {
        await handlePaystackPayment(data.booking.id, data.booking);
      } else {
        localStorage.removeItem("admin_pilgrim_draft");
        setResult({ reference: data.reference });
        setStep(6);
      }
    },
    onError: () => {
      if (!isBatchSubmitting) toast({ title: "Failed to create booking", variant: "destructive" });
    },
  });

  const handleFinish = () => {
    if (!packageId) { toast({ title: "Select a package", variant: "destructive" }); return; }
    if (req("firstName") && !pilgrim.firstName) { toast({ title: "First name is required", variant: "destructive" }); return; }
    if (req("lastName") && !pilgrim.lastName) { toast({ title: "Last name is required", variant: "destructive" }); return; }
    if (req("gender") && !pilgrim.gender) { toast({ title: "Sex is required", variant: "destructive" }); return; }
    if (req("phone") && !pilgrim.phone) { toast({ title: "Phone number is required", variant: "destructive" }); return; }
    bookMutation.mutate({
      packageId,
      ...pilgrim,
      phone: pilgrim.phone ? `${phoneCode}${pilgrim.phone}` : "",
      fullName: `${pilgrim.firstName} ${pilgrim.lastName}`.trim(),
      ...travel,
      paymentMethod: payment.method === "online" ? "paystack" : payment.method,
      paymentReference: payment.paymentReference || undefined,
      paymentProofUrl: payment.paymentProofUrl || undefined,
      markVerified: payment.method === "online" ? false : payment.markVerified,
      amountPaid: payment.method === "online" ? 0 : (payment.amountPaid ? Number(payment.amountPaid) : undefined),
      totalPrice: selectedPkg?.price,
      pilgrimType,
    });
  };

  const handleNext = () => {
    if (step === 1 && !packageId) {
      toast({ title: "Please select a package", variant: "destructive" }); return;
    }
    if (step === 2) {
      const { valid, missingFields } = validateRequiredFields(cfg, pilgrim,
        ["passportNumber", "passportIssueDate", "passportExpiry", "passportIssuingAuthority", "passportCopyUrl"]);
      if (!valid) {
        toast({ title: "Required fields missing", description: missingFields.map(f => f.label).join(", "), variant: "destructive" }); return;
      }
      if (pilgrim.passportExpiry) {
        const expiryCheck = passportExpiryWarning(pilgrim.passportExpiry);
        if (expiryCheck) {
          toast({
            title: expiryCheck.type === "expired" ? "Passport is expired" : "Passport expiring too soon",
            description: "Please renew the passport before continuing registration.",
            variant: "destructive",
          });
          return;
        }
      }
    }
    if (step === 3) {
      const { valid, missingFields } = validateRequiredFields(cfg, pilgrim,
        ["firstName", "lastName", "dateOfBirth", "gender", "nationality", "placeOfBirth"]);
      if (!valid) {
        toast({ title: "Required fields missing", description: missingFields.map(f => f.label).join(", "), variant: "destructive" }); return;
      }
    }
    if (step === 4) {
      const { valid, missingFields } = validateRequiredFields(cfg, pilgrim,
        ["phone", "email", "country", "city", "address"]);
      if (!valid) {
        toast({ title: "Required fields missing", description: missingFields.map(f => f.label).join(", "), variant: "destructive" }); return;
      }
    }
    setStep(s => s + 1);
  };

  const resetForm = () => {
    localStorage.removeItem("admin_pilgrim_draft");
    setStep(1); setResult(null); setPackageId("");
    setPilgrim(DEFAULT_PILGRIM);
    setTravel({ departureCity: "", roomPreference: "Quad", specialRequests: "" });
    setPayment({ method: "cash", markVerified: true, amountPaid: "", paymentReference: "", paymentProofUrl: "" });
    setPilgrimType("adult");
    setBatchMode(false); setBatchPilgrims([]); setBatchStep("upload");
    setIsBatchSubmitting(false); setBatchProgress(0); setBatchResults([]);
    setBatchCropTarget(null); setBatchActiveIndex(0); setBatchPayments([]);
  };

  const registerAnother = () => {
    // Keep packageId and payment, but reset personal details
    setResult(null);
    setPilgrim(DEFAULT_PILGRIM);
    setPilgrimType("adult");
    setBatchCropTarget(null); setBatchActiveIndex(0); setBatchPayments([]);
    setStep(2);
  };

  if (result || batchResults.length > 0) {
    const isBatch = batchResults.length > 0;
    const successes = batchResults.filter(r => r.success);
    const failures = batchResults.filter(r => !r.success);
    return (
      <div className="max-w-lg mx-auto text-center space-y-6 py-12" data-testid="page-admin-book-pilgrim">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-[#0F172A]">
            {isBatch ? `${successes.length} Booking${successes.length !== 1 ? "s" : ""} Created!` : "Booking Created!"}
          </h2>
          <p className="text-[#64748B] mt-1">
            {isBatch
              ? `${successes.length} of ${batchResults.length} pilgrim(s) registered successfully`
              : "The pilgrim has been successfully registered"}
          </p>
        </div>
        {isBatch ? (
          <div className="bg-[#F0F2FF] rounded-2xl p-4 space-y-2 text-left">
            <p className="text-xs font-bold text-[#2D3199] uppercase tracking-widest mb-2">Batch Results</p>
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
          <div className="bg-[#F0F2FF] rounded-2xl p-6">
            <p className="text-xs font-bold text-[#2D3199] uppercase tracking-widest mb-2">Reference Number</p>
            <p className="text-3xl font-black text-[#0F172A] font-mono">{result!.reference}</p>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          {!isBatch && payment.method !== "online" && (
            <Button variant="outline" onClick={registerAnother} className="flex-1 rounded-xl border-[#DCE3F0]">
              <UserPlus className="w-4 h-4 mr-2" />
              Register Another for this Package
            </Button>
          )}
          <Button variant="outline" onClick={resetForm} className="flex-1 rounded-xl border-[#DCE3F0]">
            Start New Booking
          </Button>
          <Link href="/admin/pilgrims" className="flex-1">
            <Button className="w-full bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl">View Pilgrims</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto" data-testid="page-admin-book-pilgrim">
      <div className="mb-6">
        <p className="text-[#2D3199] text-xs font-bold uppercase tracking-widest mb-1">Direct Registration</p>
        <h1 className="text-2xl font-black text-[#0F172A]">Register Pilgrim</h1>
        <p className="text-[#64748B] text-sm mt-0.5">Multi-step wizard for walk-in or phone bookings</p>
      </div>

      <div className="bg-white rounded-2xl border border-[#DCE3F0] p-6">
        {/* Offline/Online status */}
        {!isOnline && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <WifiOff className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">No internet connection</p>
              <p className="text-xs text-amber-600">Your progress is saved locally. Submit when connection is restored.</p>
            </div>
          </div>
        )}
        {wasOffline && isOnline && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <Wifi className="w-4 h-4 text-green-600 flex-shrink-0" />
            <p className="text-sm font-medium text-green-800">Connection restored ✓</p>
          </div>
        )}
        <StepIndicator current={step} />

        {/* ── Step 1: Package ──────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-black text-[#0F172A] text-lg">Select Package</h2>
            {/* Registration mode toggle */}
            <div className="flex rounded-xl bg-[#F1F5F9] p-1 gap-1">
              <button type="button" onClick={() => setBatchMode(false)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${!batchMode ? "bg-white text-[#2D3199] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"}`}>
                👤 Single Pilgrim
              </button>
              <button type="button" onClick={() => setBatchMode(true)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${batchMode ? "bg-white text-[#2D3199] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"}`}>
                👥 Batch Registration (up to 10)
              </button>
            </div>

            {packages.length === 0 ? (
              <div className="text-center py-8 text-[#94A3B8]">
                <Package className="w-10 h-10 mx-auto mb-2" />
                <p>No active packages available</p>
              </div>
            ) : (
              <>
                {/* Tabs + Search row */}
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Tabs */}
                  <div className="flex rounded-xl bg-[#F1F5F9] p-1 gap-1 shrink-0">
                    {([
                      { key: "all",   label: "All",   count: packages.length },
                      { key: "hajj",  label: "Hajj",  count: hajjCount  },
                      { key: "umrah", label: "Umrah", count: umrahCount },
                    ] as const).map(tab => (
                      <button key={tab.key} onClick={() => setPkgTab(tab.key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${pkgTab === tab.key ? "bg-white text-[#2D3199] shadow-sm" : "text-[#64748B] hover:text-[#2D3199]"}`}>
                        {tab.label}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${pkgTab === tab.key ? (tab.key === "hajj" ? "bg-emerald-100 text-emerald-700" : tab.key === "umrah" ? "bg-blue-100 text-blue-700" : "bg-[#EEF0FF] text-[#2D3199]") : "bg-[#E2E8F0] text-[#94A3B8]"}`}>
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>
                  {/* Search */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                    <input
                      value={pkgSearch} onChange={e => setPkgSearch(e.target.value)}
                      placeholder="Search packages…"
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-[#DCE3F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#2D3199]/20 focus:border-[#2D3199]"
                    />
                  </div>
                </div>

                {/* Package list */}
                {visiblePackages.length === 0 ? (
                  <div className="text-center py-8 text-[#94A3B8]">
                    <Package className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">No packages match your search</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                    {visiblePackages.map(pkg => (
                      <div key={pkg.id} onClick={() => setPackageId(pkg.id)}
                        className={`cursor-pointer rounded-2xl border-2 p-4 transition-all ${packageId === pkg.id ? "border-[#2D3199] bg-[#EEF0FF]" : "border-[#DCE3F0] hover:border-[#2D3199]/30"}`}>
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-black text-[#0F172A] truncate">{pkg.name}</span>
                              <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${pkg.type === "hajj" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>{pkg.type}</span>
                            </div>
                            <p className="text-xs text-[#64748B]">Departs: {pkg.departureDate} · {pkg.capacity - pkg.currentBookings} slots left</p>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <p className="font-black text-[#2D3199] text-lg">₦{Number(pkg.price).toLocaleString()}</p>
                            {packageId === pkg.id && <CheckCircle2 className="w-5 h-5 text-[#2D3199] ml-auto mt-1" />}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Step 2: Passport (or Batch Upload) ──────────────────── */}
        {step === 2 && batchMode && (
          <div className="space-y-4">
            <h2 className="font-black text-[#0F172A] text-lg">Batch Passport Upload</h2>
            <p className="text-sm text-[#64748B]">
              Upload passport images for multiple pilgrims. AI will extract details from each passport automatically.
            </p>
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
                  setStep(1);
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
                              : <p className="text-xs text-amber-600">No extra {detType} charge configured (Admin → Settings).</p>}
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
                            setBatchPayments(batchPilgrims.map(() => ({ method: "cash", amountPaid: "", markVerified: true, paymentReference: "", paymentProofUrl: "" })));
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
                  const totalPrice = Number(selectedPkg?.price || 0) + roomSurcharge + ciExtra;
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
                      <div className="grid grid-cols-2 gap-2">
                        {(["cash", "bank_transfer"] as const).map(method => (
                          <button key={method} type="button" onClick={() => updatePM({ method })}
                            className={`p-2 rounded-xl border-2 text-xs font-bold transition-all ${
                              pm.method === method ? "border-[#2D3199] bg-[#EEF0FF] text-[#2D3199]" : "border-[#DCE3F0] text-[#64748B]"
                            }`}>{method === "cash" ? "💵 Cash" : "🏦 Bank Transfer"}</button>
                        ))}
                      </div>
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
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={pm.markVerified} onChange={e => updatePM({ markVerified: e.target.checked })} className="w-4 h-4 accent-emerald-600" />
                        <span className="text-xs font-semibold text-emerald-700">Mark as verified</span>
                      </label>
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
                    try {
                      const data = await bookMutation.mutateAsync({
                        packageId, civility: p.civility, firstName: p.firstName, lastName: p.lastName,
                        fullName: `${p.firstName} ${p.lastName}`.trim(),
                        passportNumber: p.passportNumber, passportIssueDate: p.passportIssueDate,
                        passportExpiry: p.passportExpiry, passportIssuingAuthority: p.passportIssuingAuthority,
                        dateOfBirth: p.dateOfBirth, placeOfBirth: p.placeOfBirth, gender: p.gender,
                        nationality: p.nationality, maritalStatus: p.maritalStatus, occupation: p.occupation,
                        ethnicGroup: p.ethnicGroup, levelOfStudy: p.levelOfStudy, visaNumber: p.visaNumber,
                        partner: p.partner, underCover: p.underCover, observation: p.observation,
                        passportCopyUrl: p.passportCopyUrl, profilePhotoUrl: p.profilePhotoUrl,
                        phone: p.phone, email: p.email, country: p.country, city: p.city, address: p.address,
                        roomPreference: p.roomPreference || "Quad", roomSurcharge,
                        departureCity: p.departureCity || undefined,
                        paymentMethod: pm.method, amountPaid: pm.amountPaid ? Number(pm.amountPaid) : 0,
                        markVerified: pm.markVerified, pilgrimType: detType, batchId,
                      });
                      results.push({ name: `${p.firstName} ${p.lastName}`, success: true, reference: data.reference });
                    } catch (err: any) {
                      results.push({ name: `${p.firstName} ${p.lastName}`, success: false, error: err.message || "Failed" });
                    }
                  }
                  setIsBatchSubmitting(false);
                  const successes = results.filter(r => r.success);
                  if (successes.length > 0) { localStorage.removeItem("admin_pilgrim_draft"); setBatchResults(results); setStep(6); }
                  const failures = results.filter(r => !r.success);
                  if (failures.length > 0) toast({ title: `${failures.length} booking(s) failed`, description: failures.map(f => f.name).join(", "), variant: "destructive" });
                }} className="w-full bg-[#FF3B00] hover:bg-[#CC2E00] text-white rounded-xl font-black h-11">
                  <UserPlus className="w-4 h-4 mr-2" />
                  {isBatchSubmitting ? `Creating ${batchProgress}/${batchPilgrims.length}…` : `Create ${batchPilgrims.length} Booking${batchPilgrims.length !== 1 ? "s" : ""}`}
                </Button>
              </div>
            )}
          </div>
        )}
        {step === 2 && !batchMode && (
          <div className="space-y-4">
            <h2 className="font-black text-[#0F172A] text-lg mb-4">Passport Details</h2>

            <PassportScanner
              onExtracted={data => {
                setPilgrim(prev => ({
                  ...prev,
                  firstName:             data.firstName        || prev.firstName,
                  lastName:              data.lastName         || prev.lastName,
                  passportNumber:        data.passportNumber   || prev.passportNumber,
                  passportIssueDate:     data.passportIssueDate || prev.passportIssueDate,
                  passportExpiry:        data.passportExpiry   || prev.passportExpiry,
                  dateOfBirth:           data.dateOfBirth      || prev.dateOfBirth,
                  gender:                data.gender           || prev.gender,
                  nationality:           data.nationality      || prev.nationality,
                  passportCopyUrl:       data.passportImageDataUrl || prev.passportCopyUrl,
                }));
              }}
              onProfilePhoto={dataUrl => {
                setPilgrim(prev => ({ ...prev, profilePhotoUrl: dataUrl }));
              }}
            />

            <PassportExpiryAlert expiry={pilgrim.passportExpiry} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {show("passportNumber") && (
                <div className="md:col-span-2">
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{lbl("passportNumber", "Passport Number")}</Label>
                  <Input value={pilgrim.passportNumber} onChange={setInput("passportNumber")}
                    placeholder="e.g. A12345678" className="mt-1 rounded-xl font-mono" />
                </div>
              )}
              {show("passportIssueDate") && (
                <div>
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{lbl("passportIssueDate", "Date of Issue")}</Label>
                  <Input type="date" value={pilgrim.passportIssueDate} onChange={setInput("passportIssueDate")} className="mt-1 rounded-xl" />
                </div>
              )}
              {show("passportExpiry") && (
                <div>
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{lbl("passportExpiry", "Expiration Date")}</Label>
                  <Input type="date" value={pilgrim.passportExpiry} onChange={setInput("passportExpiry")} className="mt-1 rounded-xl" />
                </div>
              )}
              {show("passportIssuingAuthority") && (
                <div className="md:col-span-2">
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{lbl("passportIssuingAuthority", "Issuing Authority")}</Label>
                  <Input value={pilgrim.passportIssuingAuthority} onChange={setInput("passportIssuingAuthority")}
                    placeholder="e.g. Nigeria Immigration Service" className="mt-1 rounded-xl" />
                </div>
              )}
              {show("visaNumber") && (
                <div>
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{lbl("visaNumber", "N° Visa")}</Label>
                  <Input value={pilgrim.visaNumber} onChange={setInput("visaNumber")}
                    placeholder="Visa number" className="mt-1 rounded-xl font-mono" />
                </div>
              )}
            </div>
            {(show("passportCopyUrl") || show("profilePhotoUrl")) && <Divider label="Documents" />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {show("passportCopyUrl") && (
                <FileUploadBox
                  label={req("passportCopyUrl") ? "Passport Copy *" : "Passport Copy"}
                  accept="image/*,.pdf"
                  value={pilgrim.passportCopyUrl}
                  onChange={set("passportCopyUrl")}
                  previewType="image"
                  folder="passports"
                />
              )}
              {show("profilePhotoUrl") && (
                <FileUploadBox
                  label={req("profilePhotoUrl") ? "Profile Picture *" : "Profile Picture"}
                  accept="image/*"
                  value={pilgrim.profilePhotoUrl}
                  onChange={set("profilePhotoUrl")}
                  previewType="image"
                  folder="photos"
                />
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Personal Info ─────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-black text-[#0F172A] text-lg mb-4">Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {showIdentitySection && (
                <div className="md:col-span-2"><Divider label="Identity" /></div>
              )}

              {show("civility") && (
                <div>
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{lbl("civility", "Civility")}</Label>
                  <Select value={pilgrim.civility} onValueChange={set("civility")}>
                    <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>{CIVILITY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {show("gender") && (
                <div>
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{lbl("gender", "Sex")}</Label>
                  <Select value={pilgrim.gender} onValueChange={set("gender")}>
                    <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>{GENDERS.map(g => <SelectItem key={g} value={g} className="capitalize">{g.charAt(0).toUpperCase() + g.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {show("firstName") && (
                <div>
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{lbl("firstName", "First Name")}</Label>
                  <Input value={pilgrim.firstName} onChange={setInput("firstName")}
                    placeholder="First name" className="mt-1 rounded-xl" />
                </div>
              )}
              {show("lastName") && (
                <div>
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{lbl("lastName", "Last Name")}</Label>
                  <Input value={pilgrim.lastName} onChange={setInput("lastName")}
                    placeholder="Last name" className="mt-1 rounded-xl" />
                </div>
              )}
              {show("dateOfBirth") && (
                <div>
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{lbl("dateOfBirth", "Date of Birth")}</Label>
                  <Input type="date" value={pilgrim.dateOfBirth} onChange={e => {
                    setPilgrim(p => ({ ...p, dateOfBirth: e.target.value }));
                    // Auto-detect pilgrim type from DOB
                    if (e.target.value) {
                      const birth = new Date(e.target.value);
                      const now = new Date();
                      let years = now.getFullYear() - birth.getFullYear();
                      const m = now.getMonth() - birth.getMonth();
                      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--;
                      if (years < 2) setPilgrimType("infant");
                      else if (years < 12) setPilgrimType("child");
                      else setPilgrimType("adult");
                    }
                  }} className="mt-1 rounded-xl" />
                </div>
              )}
              {/* Pilgrim Type (auto-detected from DOB or manual) */}
              <div>
                <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Pilgrim Type</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {([["adult", "Adult", "👤"], ["child", "Child (2-11)", "🧒"], ["infant", "Infant (0-1)", "👶"]] as const).map(([val, label, icon]) => (
                    <button key={val} type="button" onClick={() => setPilgrimType(val)}
                      className={`p-2 rounded-xl border-2 text-center text-xs font-bold transition-all ${
                        pilgrimType === val ? "border-[#2D3199] bg-[#EEF0FF] text-[#2D3199]" : "border-[#DCE3F0] text-[#64748B] hover:border-[#2D3199]/30"
                      }`}>
                      {icon} {label}
                    </button>
                  ))}
                </div>
                {pilgrimType !== "adult" && (
                  <p className="text-xs text-amber-600 mt-1 font-semibold">
                    ⚠ {pilgrimType === "infant" ? "Infants" : "Children"} will be registered as a separate booking.
                  </p>
                )}
              </div>
              {show("placeOfBirth") && (
                <div>
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{lbl("placeOfBirth", "Place of Birth")}</Label>
                  <Input value={pilgrim.placeOfBirth} onChange={setInput("placeOfBirth")}
                    placeholder="City / State" className="mt-1 rounded-xl" />
                </div>
              )}
              {show("nationality") && (
                <div>
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{lbl("nationality", "Nationality")}</Label>
                  <Select value={pilgrim.nationality} onValueChange={set("nationality")}>
                    <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{NATIONALITIES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {show("ethnicGroup") && (() => {
                const isCustomEthnic = !!(pilgrim.ethnicGroup && !ETHNIC_GROUPS.includes(pilgrim.ethnicGroup));
                const ethnicSelVal = isCustomEthnic ? "__other__" : (pilgrim.ethnicGroup || "");
                return (
                  <div>
                    <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{lbl("ethnicGroup", "Ethnic Group")}</Label>
                    <Select value={ethnicSelVal} onValueChange={v => v === "__other__" ? set("ethnicGroup")("") : set("ethnicGroup")(v)}>
                      <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Select ethnic group…" /></SelectTrigger>
                      <SelectContent>
                        {ETHNIC_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                        <SelectItem value="__other__">Other (specify)</SelectItem>
                      </SelectContent>
                    </Select>
                    {(isCustomEthnic || ethnicSelVal === "__other__") && (
                      <Input value={pilgrim.ethnicGroup} onChange={setInput("ethnicGroup")}
                        placeholder="Type ethnic group…" className="mt-2 rounded-xl" />
                    )}
                  </div>
                );
              })()}

              {showAdditionalSection && (
                <div className="md:col-span-2"><Divider label="Additional" /></div>
              )}

              {show("maritalStatus") && (
                <div>
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{lbl("maritalStatus", "Marital Status")}</Label>
                  <Select value={pilgrim.maritalStatus} onValueChange={set("maritalStatus")}>
                    <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>{MARITAL_STATUS.map(m => <SelectItem key={m} value={m.toLowerCase()}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {show("levelOfStudy") && (
                <div>
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{lbl("levelOfStudy", "Level of Study")}</Label>
                  <Select value={pilgrim.levelOfStudy} onValueChange={set("levelOfStudy")}>
                    <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>{LEVEL_OF_STUDY.map(l => <SelectItem key={l} value={l.toLowerCase()}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {show("partner") && (
                <div>
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{lbl("partner", "Partner / Mahram")}</Label>
                  <Input value={pilgrim.partner} onChange={setInput("partner")}
                    placeholder="Partner / Mahram name" className="mt-1 rounded-xl" />
                </div>
              )}
              {show("underCover") && (
                <div>
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{lbl("underCover", "Under Cover")}</Label>
                  <Input value={pilgrim.underCover} onChange={setInput("underCover")}
                    placeholder="e.g. RAUDAH FUNTUA" className="mt-1 rounded-xl" />
                </div>
              )}
              {show("observation") && (
                <div className="md:col-span-2">
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{lbl("observation", "Observation")}</Label>
                  <Textarea value={pilgrim.observation} onChange={setInput("observation")}
                    placeholder="Any notes or observations about this pilgrim…" className="mt-1 rounded-xl resize-none" rows={2} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 4: Contact & Address ─────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="font-black text-[#0F172A] text-lg mb-4">Contacts & Address</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {show("phone") && (
                <div className="md:col-span-2">
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{lbl("phone", "Phone (WhatsApp)")}</Label>
                  <div className="flex gap-2 mt-1">
                    <Select value={phoneCode} onValueChange={setPhoneCode}>
                      <SelectTrigger className="w-[130px] rounded-xl shrink-0 bg-[#F8FAFC] border-[#DCE3F0] text-xs font-bold text-[#64748B]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PHONE_CODES.map(c => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.flag} {c.code} {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input value={pilgrim.phone} onChange={setInput("phone")}
                      placeholder="80 0000 0000" className="rounded-xl flex-1" />
                  </div>
                </div>
              )}
              {show("email") && (
                <div className="md:col-span-2">
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{lbl("email", "Email")}</Label>
                  <Input type="email" value={pilgrim.email} onChange={setInput("email")}
                    placeholder="pilgrim@example.com" className="mt-1 rounded-xl" />
                </div>
              )}
              {show("occupation") && (
                <div>
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{lbl("occupation", "Profession")}</Label>
                  <Input value={pilgrim.occupation} onChange={setInput("occupation")}
                    placeholder="e.g. Teacher, Farmer…" className="mt-1 rounded-xl" />
                </div>
              )}
              {show("country") && (
                <div>
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{lbl("country", "Country")}</Label>
                  <Input value={pilgrim.country} onChange={setInput("country")}
                    placeholder="Nigeria" className="mt-1 rounded-xl" />
                </div>
              )}
              {show("city") && (
                <div>
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{lbl("city", "City")}</Label>
                  <Input value={pilgrim.city} onChange={setInput("city")}
                    placeholder="City of residence" className="mt-1 rounded-xl" />
                </div>
              )}
              {show("roomPreference") && (
                <div>
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{lbl("roomPreference", "Room Preference")}</Label>
                  <Select value={travel.roomPreference} onValueChange={v => setTravel(t => ({ ...t, roomPreference: v }))}>
                    <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{ROOM_PREFS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {show("address") && (
                <div className="md:col-span-2">
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{lbl("address", "Address")}</Label>
                  <Input value={pilgrim.address} onChange={setInput("address")}
                    placeholder="Full residential address" className="mt-1 rounded-xl" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 5: Payment ───────────────────────────────────────── */}
        {step === 5 && (
          <div className="space-y-4">
            <h2 className="font-black text-[#0F172A] text-lg mb-4">Payment & Finalize</h2>
            {selectedPkg && (
              <div className="bg-[#F0F2FF] rounded-2xl p-4 mb-2">
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Booking Summary</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-black text-[#0F172A]">{selectedPkg.name}</p>
                    <p className="text-sm text-[#64748B]">
                      {pilgrim.civility && `${pilgrim.civility} `}{pilgrim.firstName} {pilgrim.lastName}
                      {pilgrim.passportNumber && ` · ${pilgrim.passportNumber}`}
                    </p>
                  </div>
                  <p className="font-black text-[#2D3199] text-xl">₦{Number(selectedPkg.price).toLocaleString()}</p>
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Payment Method</Label>
              <div className={`grid gap-3 mt-1 ${paystackEnabled ? "grid-cols-3" : "grid-cols-2"}`}>
                {paystackEnabled && (
                  <div onClick={() => setPayment(p => ({ ...p, method: "online" }))}
                    className={`cursor-pointer rounded-xl border-2 p-3 text-sm font-semibold text-center transition-all ${payment.method === "online" ? "border-[#FF3B00] bg-[#FFF0EC] text-[#FF3B00]" : "border-[#DCE3F0] text-[#64748B] hover:border-[#FF3B00]/30"}`}>
                    💳 Pay Online
                    <span className="block text-[10px] mt-0.5 font-normal opacity-70">Paystack — Instant</span>
                  </div>
                )}
                <div onClick={() => setPayment(p => ({ ...p, method: "cash" }))}
                  className={`cursor-pointer rounded-xl border-2 p-3 text-sm font-semibold text-center transition-all ${payment.method === "cash" ? "border-[#2D3199] bg-[#EEF0FF] text-[#2D3199]" : "border-[#DCE3F0] text-[#64748B] hover:border-[#2D3199]/30"}`}>
                  💵 Cash
                  <span className="block text-[10px] mt-0.5 font-normal opacity-70">Paid in Office</span>
                </div>
                <div onClick={() => setPayment(p => ({ ...p, method: "bank_transfer" }))}
                  className={`cursor-pointer rounded-xl border-2 p-3 text-sm font-semibold text-center transition-all ${payment.method === "bank_transfer" ? "border-[#2D3199] bg-[#EEF0FF] text-[#2D3199]" : "border-[#DCE3F0] text-[#64748B] hover:border-[#2D3199]/30"}`}>
                  🏦 Bank Transfer
                  <span className="block text-[10px] mt-0.5 font-normal opacity-70">Transfer & confirm</span>
                </div>
              </div>
            </div>
            {payment.method !== "online" && (
              <>
                {payment.method === "bank_transfer" && (
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
                      <Input value={payment.paymentReference} onChange={e => setPayment(p => ({ ...p, paymentReference: e.target.value }))} placeholder="e.g. FT234567890" className="rounded-xl border-[#E2E8F0] h-11 bg-white" />
                    </div>

                    <FileUploadBox
                      label="Proof of Payment (Optional)"
                      accept="image/*,application/pdf"
                      previewType="file"
                      value={payment.paymentProofUrl}
                      onChange={v => setPayment(p => ({ ...p, paymentProofUrl: v }))}
                      folder="receipts"
                    />
                  </div>
                )}

                {/* Structured payment amount options */}
                <div>
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2 block">Payment Amount</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "full", label: "Full Payment", amount: selectedPkg ? String(selectedPkg.price) : "0" },
                      { key: "500000", label: "Minimum Deposit", amount: "500000" },
                      { key: "1000000", label: "₦1,000,000", amount: "1000000" },
                      { key: "custom", label: "Custom Amount", amount: "" },
                    ].map(opt => (
                      <button key={opt.key} type="button"
                        onClick={() => setPayment(p => ({ ...p, amountPaid: opt.amount }))}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          payment.amountPaid === opt.amount ? "border-[#2D3199] bg-[#EEF0FF]" : "border-[#DCE3F0] hover:border-[#2D3199]/30"
                        }`}>
                        <span className="text-xs font-bold text-[#0F172A] block">{opt.label}</span>
                        {opt.amount && <span className="text-[10px] text-[#64748B]">₦{Number(opt.amount).toLocaleString()}</span>}
                      </button>
                    ))}
                  </div>
                  {/* Custom amount input fallback */}
                  {!["", String(selectedPkg?.price || "0"), "500000", "1000000"].includes(payment.amountPaid) && (
                    <div className="mt-2">
                      <Input type="number" value={payment.amountPaid}
                        onChange={e => setPayment(p => ({ ...p, amountPaid: e.target.value }))}
                        placeholder="Enter amount" className="rounded-xl font-mono" min={0} />
                    </div>
                  )}
                  {payment.amountPaid && (
                    <div className="bg-[#F0F2FF] rounded-xl p-3 mt-2 flex justify-between items-center">
                      <span className="text-xs font-bold text-[#64748B]">Amount to record</span>
                      <span className="text-lg font-black text-[#2D3199]">₦{Number(payment.amountPaid || 0).toLocaleString()}</span>
                    </div>
                  )}
                </div>
                {selectedPkg && payment.amountPaid && Number(payment.amountPaid) > 0 && Number(payment.amountPaid) < Number(selectedPkg.price) && payment.method !== "online" && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-sm text-amber-700 font-semibold">
                      💡 Partial Payment: ₦{Number(payment.amountPaid).toLocaleString()} of ₦{Number(selectedPkg.price).toLocaleString()} — Booking will remain pending until balance is cleared.
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      Balance remaining: ₦{(Number(selectedPkg.price) - Number(payment.amountPaid)).toLocaleString()}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                  <input type="checkbox" checked={payment.markVerified}
                    onChange={e => setPayment(p => ({ ...p, markVerified: e.target.checked }))}
                    id="markVerified" className="w-4 h-4 accent-emerald-600" />
                  <label htmlFor="markVerified" className="flex-1 cursor-pointer">
                    <span className="text-sm font-bold text-emerald-700 block">Mark as Verified & Confirmed</span>
                    <span className="text-xs text-emerald-600">
                      {selectedPkg && payment.amountPaid && Number(payment.amountPaid) > 0 && Number(payment.amountPaid) < Number(selectedPkg.price)
                        ? "Verify this deposit — Booking will remain pending until balance is cleared"
                        : "Automatically confirm booking and verify payment"}
                    </span>
                  </label>
                </div>
              </>
            )}
            {payment.method === "online" && (
              <div className="bg-[#FFF4F0] border border-[#FF3B00]/20 rounded-xl p-4 text-sm">
                <p className="font-bold text-[#FF3B00] mb-1">💳 Paystack Online Payment</p>
                <p className="text-[#64748B]">The pilgrim's email will be used for payment. A Paystack popup will open after booking creation.</p>
                {!pilgrim.email && (
                  <p className="text-amber-600 font-semibold mt-1 text-xs">⚠ Add pilgrim email in Contact step for best results.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-8 pt-6 border-t border-[#F1F5F9]">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} className="rounded-xl border-[#DCE3F0] gap-2">
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
          )}
          <div className="flex-1" />
          {step < 5 ? (
            <Button onClick={handleNext} className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl gap-2">
              Continue <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={bookMutation.isPending}
              className="bg-[#FF3B00] hover:bg-[#CC2E00] text-white rounded-xl gap-2">
              <UserPlus className="w-4 h-4" />
              {bookMutation.isPending ? "Creating Booking…" : "Create Booking"}
            </Button>
          )}
        </div>
      </div>

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
