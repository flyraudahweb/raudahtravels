import { useState, useEffect, useRef, useCallback } from "react";
import { uploadFile } from "@/lib/upload";
import { useRoute, useLocation } from "wouter";
import { useGetPackage, getGetPackageQueryKey, useCreateBooking, useCreatePayment } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle2, ChevronLeft, ChevronRight, CalendarDays, Users, Star,
  CreditCard, Building2, Banknote, Upload, FileText, X, AlertTriangle,
  WifiOff, Wifi, Baby, UserPlus, AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PackageAvailability } from "@/components/PackageAvailability";
import { useQuery } from "@tanstack/react-query";
import { useFormFieldConfig, validateRequiredFields } from "@/hooks/useFormFieldConfig";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import PassportScanner from "@/components/PassportScanner";

const STEPS = ["Package", "Passport", "Personal Info", "Contact", "Payment & Review"];

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

type PayMethod = "bank_transfer" | "cash" | "online";

const CIVILITY_OPTIONS = ["Mr", "Mrs", "Miss", "Dr", "Prof", "Alhaji", "Alhaja", "Mal.", "Hajiya"];
const NATIONALITIES    = ["Nigerian", "Burkinabe", "Nigerien", "Ghanaian", "Senegalese", "Cameroonian", "Other"];

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
const MARITAL_STATUS   = ["Single", "Married", "Divorced", "Widowed"];
const LEVEL_OF_STUDY   = ["None", "Primary", "Secondary", "Tertiary", "Postgraduate"];



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
          <p className="font-bold text-red-800 text-sm uppercase tracking-wide mb-2">
            {isExpired ? "Passport Expired — Registration Blocked" : "Passport Expiring Soon — Registration Blocked"}
          </p>
          <p className="text-red-700 text-sm leading-relaxed">
            {isExpired
              ? `This passport expired on ${expiryStr}. An expired passport cannot be used for Hajj or Umrah visa applications.`
              : `This passport expires on ${expiryStr}, which is within 3 months from today.`
            }
            {" "}Saudi Arabia requires all passport holders to have a minimum of 6 months validity beyond the travel date. Additionally, visa processing can take several weeks — if a delay occurs, travel may fall outside the passport validity window.
          </p>
          <p className="text-red-600 text-xs mt-3 font-bold border-t border-red-200 pt-2">
            Please renew the passport before proceeding with registration.
          </p>
        </div>
      </div>
    </div>
  );
}

function FileUploadBox({
  label, accept, value, onChange, previewType = "image", hint, folder = "documents",
}: {
  label: string; accept: string; value: string; onChange: (v: string) => void;
  previewType?: "image" | "file"; hint?: string;
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
  const isPdf   = value && (value.startsWith("data:application/pdf") || /\.pdf$/i.test(value));

  return (
    <div>
      <Label className="text-sm font-medium">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground mt-0.5 mb-1">{hint}</p>}
      <div className="mt-1">
        {value ? (
          <div className="relative rounded-lg border-2 border-primary overflow-hidden bg-primary/5">
            {isImage && previewType === "image" ? (
              <img src={value} alt="preview" className="w-full h-28 object-cover" />
            ) : (
              <div className="flex items-center gap-3 p-3">
                <FileText className="w-7 h-7 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-primary">File uploaded</p>
                  <p className="text-[10px] text-muted-foreground">{isPdf ? "PDF document" : "Document"}</p>
                </div>
              </div>
            )}
            <button type="button"
              onClick={() => { onChange(""); if (inputRef.current) inputRef.current.value = ""; }}
              className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow border border-border hover:bg-red-50">
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/40 bg-muted/30 hover:bg-primary/5 transition-all p-4 flex flex-col items-center gap-2">
            <Upload className="w-5 h-5 text-muted-foreground/50" />
            <span className="text-xs font-medium text-muted-foreground">{uploading ? "Uploading..." : "Click to upload"}</span>
            <span className="text-[10px] text-muted-foreground/60">{accept.includes("pdf") ? "JPG, PNG or PDF" : "JPG or PNG"} · Max 3MB</span>
          </button>
        )}
        <input ref={inputRef} type="file" accept={accept} onChange={handleFile} className="hidden" />
      </div>
    </div>
  );
}

export default function BookingWizard() {
  const [, params] = useRoute("/dashboard/book/:id");
  const packageId = params?.id || "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useUser();

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch (e) {
      return dateStr;
    }
  };

  const { data: pkg, isLoading, isFetching } = useGetPackage(packageId, {
    query: { enabled: !!packageId, queryKey: getGetPackageQueryKey(packageId), staleTime: 0 },
  });
  const { data: appConfig } = useQuery<{ paystackPublicKey: string; paystackEnabled: boolean }>({
    queryKey: ["app-config"],
    queryFn: () => fetch("/api/config").then((r) => r.json()),
    staleTime: 30000,
  });
  const paystackEnabled = appConfig?.paystackEnabled ?? true;

  const { data: bankData } = useQuery<{ accounts: Array<{ id: string; bankName: string; accountName: string; accountNumber: string; isActive: boolean }> }>({
    queryKey: ["bank-accounts-public"],
    queryFn: () => fetch("/api/bank-accounts").then(r => r.json()),
    staleTime: 60000,
  });
  const primaryBank = bankData?.accounts?.[0];
  const bankAccounts = bankData?.accounts || [];

  // Fetch room surcharges and child/infant pricing from settings
  const { data: settingsData } = useQuery<Record<string, any>>({
    queryKey: ["public-settings-room"],
    queryFn: () => fetch("/api/public/settings").then(r => r.json()),
    staleTime: 60000,
  });
  const roomSurcharges: Record<string, number> = (() => {
    const raw = settingsData?.room_surcharges;
    if (raw && typeof raw === "object") return raw as Record<string, number>;
    return { single: 0, double: 0, triple: 0, quad: 0 };
  })();
  const childInfantPricing = (() => {
    const raw = settingsData?.child_infant_pricing;
    if (raw && typeof raw === "object") return raw as { childPrice?: number; infantPrice?: number };
    return { childPrice: 1200000, infantPrice: 1200000 };
  })();

  const createBooking = useCreateBooking();
  const createPayment = useCreatePayment();

  const [step, setStep] = useState(0);

  // Track a created booking ID so retrying Paystack reuses the same booking (no duplicates)
  const createdBookingIdRef = useRef<string | null>(null);

  // Step 1: Passport
  const [passportForm, setPassportForm] = useState({
    passportNumber: "", passportIssueDate: "", passportExpiry: "", passportIssuingAuthority: "",
    visaNumber: "", passportCopyUrl: "",
  });

  // Step 2: Personal info
  const [personalForm, setPersonalForm] = useState({
    civility: "", firstName: user?.firstName || "", lastName: user?.lastName || "",
    dateOfBirth: "", placeOfBirth: "", gender: "", nationality: "Nigerian",
    ethnicGroup: "", maritalStatus: "", levelOfStudy: "", partner: "", underCover: "",
    observation: "", profilePhotoUrl: "",
  });

  // Step 3: Contact
  const [contactForm, setContactForm] = useState({
    phone: "", email: user?.primaryEmailAddress?.emailAddress || "",
    country: "Nigeria", city: "", address: "",
    departureCity: "", roomType: "", specialRequests: "",
  });

  // Step 4: Payment
  const [payForm, setPayForm] = useState<{ method: PayMethod; reference: string; pilgrimCount: number; paymentProofUrl: string }>({
    method: "bank_transfer",
    reference: "",
    pilgrimCount: 1,
    paymentProofUrl: "",
  });

  const [done, setDone]           = useState(false);
  const [doneMethod, setDoneMethod] = useState<PayMethod>("bank_transfer");
  const [processing, setProcessing] = useState(false);
  const [phoneCode, setPhoneCode] = useState("+234");
  const [isRestored, setIsRestored] = useState(false);
  const paystackScriptLoaded = useRef(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Payment amount selection (for bank_transfer / cash only)
  const [paymentOption, setPaymentOption] = useState<"full" | "500000" | "1000000" | "custom">("full");
  const [customPaymentAmount, setCustomPaymentAmount] = useState("");

  const [aiFields, setAiFields] = useState<string[]>([]);
  const aiClass = (k: string) => aiFields.includes(k) ? "border-emerald-500 bg-emerald-50/50 shadow-[0_0_0_2px_rgba(16,185,129,0.3)] text-emerald-950 transition-all focus:border-emerald-600" : "";
  const childAiClass = (child: any, k: string) => child.aiFields?.includes(k) ? "border-emerald-500 bg-emerald-50/50 shadow-[0_0_0_2px_rgba(16,185,129,0.3)] text-emerald-950 transition-all focus:border-emerald-600" : "";

  // Child / Infant entries
  const [childEntries, setChildEntries] = useState<Array<{
    id: string;
    type: "child" | "infant";
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    nationality: string;
    passportNumber: string;
    passportIssueDate: string;
    passportExpiry: string;
    passportCopyUrl: string;
    profilePhotoUrl: string;
    aiFields?: string[];
  }>>([]);

  // Online/offline detection
  const { isOnline, wasOffline } = useOnlineStatus();
  
  const [packageDateId, setPackageDateId] = useState<string>("");
  const [departureCityFilter, setDepartureCityFilter] = useState<string>("");

  useEffect(() => {
    try {
      const draft = localStorage.getItem("user_booking_draft");
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.passportForm) setPassportForm(parsed.passportForm);
        if (parsed.personalForm) setPersonalForm(parsed.personalForm);
        if (parsed.contactForm) setContactForm(parsed.contactForm);
        if (parsed.payForm) setPayForm(parsed.payForm);
        if (parsed.step) setStep(parsed.step);
        if (parsed.childEntries) setChildEntries(parsed.childEntries);
        if (parsed.paymentOption) setPaymentOption(parsed.paymentOption);
        if (parsed.customPaymentAmount) setCustomPaymentAmount(parsed.customPaymentAmount);
        if (parsed.packageDateId) setPackageDateId(parsed.packageDateId);
      }
    } catch (e) {}
    setIsRestored(true);
  }, []);

  useEffect(() => {
    if (!isRestored) return;
    if (done) {
      localStorage.removeItem("user_booking_draft");
      return;
    }
    localStorage.setItem("user_booking_draft", JSON.stringify({
      passportForm, personalForm, contactForm, payForm, step,
      childEntries, paymentOption, customPaymentAmount, packageDateId,
    }));
  }, [passportForm, personalForm, contactForm, payForm, step, done, isRestored, childEntries, paymentOption, customPaymentAmount, packageDateId]);

  useEffect(() => {
    if (!paystackScriptLoaded.current) {
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v2/inline.js";
      script.async = true;
      document.body.appendChild(script);
      paystackScriptLoaded.current = true;
    }
  }, []);

  useEffect(() => {
    if (!paystackEnabled && payForm.method === "online") {
      setPayForm((f) => ({ ...f, method: "bank_transfer" }));
    }
  }, [paystackEnabled]);

  // ── Child/Infant helpers ──────────────────────────────────────────
  function getAgeFromDOB(dob: string): { years: number; months: number } | null {
    if (!dob) return null;
    const birth = new Date(dob);
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    if (months < 0) { years--; months += 12; }
    if (now.getDate() < birth.getDate()) months--;
    return { years, months: years * 12 + months };
  }

  function detectPilgrimType(dob: string): "adult" | "child" | "infant" {
    const age = getAgeFromDOB(dob);
    if (!age) return "adult";
    if (age.months <= 23) return "infant";
    if (age.years <= 11) return "child";
    return "adult";
  }

  const getChildPrice = (type: "child" | "infant") => type === "infant" ? (childInfantPricing.infantPrice || 1200000) : (childInfantPricing.childPrice || 1200000);

  const addChildEntry = (type: "child" | "infant") => {
    setChildEntries(prev => [...prev, {
      id: crypto.randomUUID(),
      type,
      firstName: "", lastName: "", dateOfBirth: "", gender: "",
      nationality: "Nigerian", passportNumber: "",
      passportIssueDate: "", passportExpiry: "",
      passportCopyUrl: "", profilePhotoUrl: "",
    }]);
  };

  const removeChildEntry = (id: string) => setChildEntries(prev => prev.filter(c => c.id !== id));

  const updateChildEntry = (id: string, updates: Partial<typeof childEntries[0]>) => {
    setChildEntries(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  // ── Price calculations ────────────────────────────────────────────
  const roomSurcharge = roomSurcharges[contactForm.roomType?.toLowerCase() || "quad"] || 0;
  const adultPrice = pkg ? (pkg.price + roomSurcharge) : 0;
  const childrenTotal = childEntries.reduce((sum, c) => sum + getChildPrice(c.type), 0);
  const fullAmount = (adultPrice * payForm.pilgrimCount) + childrenTotal;
  const fullName = [personalForm.firstName, personalForm.lastName].filter(Boolean).join(" ") || user?.fullName || "";

  // Payment amount based on selection (Paystack always full, bank/cash can be partial)
  const getPaymentAmount = (): number => {
    if (payForm.method === "online") return fullAmount;
    switch (paymentOption) {
      case "full": return fullAmount;
      case "500000": return Math.min(500000, fullAmount);
      case "1000000": return Math.min(1000000, fullAmount);
      case "custom": return Math.max(500000, Math.min(Number(customPaymentAmount) || 500000, fullAmount));
      default: return fullAmount;
    }
  };
  const paymentAmount = getPaymentAmount();

  const cfg = useFormFieldConfig();
  const show = (name: string) => cfg(name).visible;
  const req  = (name: string) => cfg(name).visible && cfg(name).required;
  const lbl  = (name: string, label: string) => req(name) ? `${label} *` : label;

  const handleNext = () => {
    // Step-level field validation
    if (step === 0) {
      if (pkg?.type === "umrah" && pkg.packageDates && pkg.packageDates.length > 0 && !packageDateId) {
        toast({ title: "Flight Schedule Required", description: "Please select a flight schedule before proceeding.", variant: "destructive" });
        return;
      }
    }
    if (step === 1) {
      const { valid, missingFields } = validateRequiredFields(cfg, passportForm,
        ["passportNumber", "passportIssueDate", "passportExpiry", "passportIssuingAuthority", "passportCopyUrl"]);
      if (!valid) {
        setValidationErrors(missingFields.map(f => f.label));
        toast({ title: "Required fields missing", description: missingFields.map(f => f.label).join(", "), variant: "destructive" });
        return;
      }
      if (passportForm.passportExpiry) {
        const w = passportExpiryWarning(passportForm.passportExpiry);
        if (w) {
          toast({ title: w.type === "expired" ? "Passport is expired" : "Passport expiring too soon", description: "The pilgrim's passport must be renewed before registration can continue.", variant: "destructive" });
          return;
        }
      }
    }
    if (step === 2) {
      const { valid, missingFields } = validateRequiredFields(cfg, personalForm,
        ["firstName", "lastName", "dateOfBirth", "gender", "nationality", "placeOfBirth", "profilePhotoUrl"]);
      if (!valid) {
        setValidationErrors(missingFields.map(f => f.label));
        toast({ title: "Required fields missing", description: missingFields.map(f => f.label).join(", "), variant: "destructive" });
        return;
      }
    }
    if (step === 3) {
      const { valid, missingFields } = validateRequiredFields(cfg, contactForm,
        ["phone", "email", "country", "city", "address"]);
      if (!valid) {
        setValidationErrors(missingFields.map(f => f.label));
        toast({ title: "Required fields missing", description: missingFields.map(f => f.label).join(", "), variant: "destructive" });
        return;
      }

      const invalidChild = childEntries.find(c => !c.firstName || !c.lastName || !c.dateOfBirth || !c.gender || !c.passportNumber || !c.passportCopyUrl);
      if (invalidChild) {
        toast({ title: "Child details missing", description: "Please ensure all added children/infants have their names, date of birth, gender, and passport details (including uploaded passport copy) filled.", variant: "destructive" });
        return;
      }
    }
    setValidationErrors([]);
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    if (processing) return;
    setProcessing(true);

    const pilgrimDetails = JSON.stringify({
      ...passportForm, ...personalForm, ...contactForm, fullName,
    });

    // If we already created a booking (e.g. user cancelled Paystack and is retrying),
    // skip booking creation and go straight to payment
    if (createdBookingIdRef.current) {
      if (payForm.method === "online") {
        await handlePaystackPayment(createdBookingIdRef.current);
      } else {
        createPayment.mutate(
          { data: { bookingId: createdBookingIdRef.current, amount: paymentAmount, method: payForm.method, reference: payForm.reference, proofUrl: payForm.paymentProofUrl } },
          {
            onSuccess: () => { setDoneMethod(payForm.method); setDone(true); setProcessing(false); },
            onError: () => { setDoneMethod(payForm.method); setDone(true); setProcessing(false); },
          }
        );
      }
      return;
    }

    // Auto-detect pilgrimType from DOB
    const mainPilgrimType = personalForm.dateOfBirth ? detectPilgrimType(personalForm.dateOfBirth) : "adult";

    createBooking.mutate(
      {
        data: {
          packageId: pkg!.id,
          packageDateId: packageDateId || undefined,
          pilgrimCount: payForm.pilgrimCount,
          pilgrimDetails,
          notes: contactForm.specialRequests,
          fullName,
          // Passport fields (from passportForm)
          passportNumber: passportForm.passportNumber || undefined,
          passportIssueDate: passportForm.passportIssueDate || undefined,
          passportExpiry: passportForm.passportExpiry || undefined,
          passportIssuingAuthority: passportForm.passportIssuingAuthority || undefined,
          passportCopyUrl: passportForm.passportCopyUrl || undefined,
          visaNumber: passportForm.visaNumber || undefined,
          // Personal fields (from personalForm)
          civility: personalForm.civility || undefined,
          firstName: personalForm.firstName || undefined,
          lastName: personalForm.lastName || undefined,
          dateOfBirth: personalForm.dateOfBirth || undefined,
          gender: personalForm.gender || undefined,
          nationality: personalForm.nationality || undefined,
          placeOfBirth: personalForm.placeOfBirth || undefined,
          ethnicGroup: personalForm.ethnicGroup || undefined,
          maritalStatus: personalForm.maritalStatus || undefined,
          levelOfStudy: personalForm.levelOfStudy || undefined,
          observation: personalForm.observation || undefined,
          profilePhotoUrl: personalForm.profilePhotoUrl || undefined,
          partner: personalForm.partner || undefined,
          underCover: personalForm.underCover || undefined,
          // Contact fields (from contactForm)
          phone: contactForm.phone ? `${phoneCode}${contactForm.phone}` : "",
          email: contactForm.email || undefined,
          country: contactForm.country || undefined,
          city: contactForm.city || undefined,
          address: contactForm.address || undefined,
          roomPreference: contactForm.roomType || "quad",
          departureCity: contactForm.departureCity || undefined,
          // Room surcharge & pilgrim type
          roomSurcharge: roomSurcharge || 0,
          pilgrimType: mainPilgrimType,
          customData: {
            childrenExtra: childrenTotal,
            childrenCount: childEntries.length,
          },
        },
      } as any,
      {
        onSuccess: async (booking) => {
          createdBookingIdRef.current = booking.id;

          // Create separate bookings for each child/infant
          if (childEntries.length > 0) {
            const batchId = crypto.randomUUID();
            for (const child of childEntries) {
              try {
                await createBooking.mutateAsync({
                  data: {
                    packageId: pkg!.id,
                    packageDateId: packageDateId || undefined,
                    pilgrimCount: 1,
                    fullName: `${child.firstName} ${child.lastName}`.trim(),
                    firstName: child.firstName || undefined,
                    lastName: child.lastName || undefined,
                    dateOfBirth: child.dateOfBirth || undefined,
                    gender: child.gender || undefined,
                    nationality: child.nationality || undefined,
                    passportNumber: child.passportNumber || undefined,
                    passportIssueDate: child.passportIssueDate || undefined,
                    passportExpiry: child.passportExpiry || undefined,
                    passportCopyUrl: child.passportCopyUrl || undefined,
                    profilePhotoUrl: child.profilePhotoUrl || undefined,
                    phone: contactForm.phone ? `${phoneCode}${contactForm.phone}` : "",
                    email: contactForm.email || undefined,
                    country: contactForm.country || undefined,
                    city: contactForm.city || undefined,
                    roomPreference: contactForm.roomType || "quad",
                    pilgrimType: child.type,
                    parentBookingId: booking.id,
                    batchId,
                  } as any,
                });
              } catch (err) {
                console.error(`Failed to create booking for child: ${child.firstName}`, err);
              }
            }
          }

          if (payForm.method === "online") {
            await handlePaystackPayment(booking.id);
          } else {
            createPayment.mutate(
              { data: { bookingId: booking.id, amount: paymentAmount, method: payForm.method, reference: payForm.reference, proofUrl: payForm.paymentProofUrl } },
              {
                onSuccess: () => { setDoneMethod(payForm.method); setDone(true); setProcessing(false); },
                onError: () => { setDoneMethod(payForm.method); setDone(true); setProcessing(false); },
              }
            );
          }
        },
        onError: () => {
          toast({ title: "Booking failed", description: "Could not create your booking. Please try again.", variant: "destructive" });
          setProcessing(false);
        },
      }
    );
  };

  const handlePaystackPayment = async (bookingId: string) => {
    try {
      const res = await fetch("/api/payments/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          bookingId,
          email: contactForm.email || user?.primaryEmailAddress?.emailAddress || fullName,
        }),
      });
      if (!res.ok) throw new Error("Failed to initialize payment");
      const data = await res.json() as { accessCode: string; reference: string };
      if (!window.PaystackPop) throw new Error("Paystack script not loaded");

      // Paystack Popup v2: use resumeTransaction with the access_code from the server
      const popup = new window.PaystackPop();
      popup.resumeTransaction(data.accessCode, {
        onSuccess: async (transaction) => {
          // Always verify server-side: confirms status=success and amount matches before showing success
          try {
            const verifyRes = await fetch("/api/payments/paystack/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ reference: transaction.reference }),
            });
            if (!verifyRes.ok) {
              const err = await verifyRes.json() as { error?: string };
              throw new Error(err.error ?? "Verification failed");
            }
          } catch (verifyErr) {
            toast({
              title: "Payment received but unconfirmed",
              description: "We received your payment but could not confirm it immediately. Our team will verify it shortly.",
            });
          }
          setDoneMethod("online");
          setDone(true);
          setProcessing(false);
        },
        onCancel: () => {
          // User closed Paystack popup — keep them on the wizard so they can retry or choose another method
          toast({
            title: "Payment not completed",
            description: "No payment was taken. You can try again or choose a different payment method.",
          });
          setProcessing(false);
          // Do NOT set done=true here — booking exists but no payment yet
        },
        onError: (_err) => {
          toast({ title: "Payment error", description: "Something went wrong with your payment. Please try again or choose bank transfer.", variant: "destructive" });
          setProcessing(false);
        },
      });
    } catch {
      toast({ title: "Payment error", description: "Could not launch payment. Please try bank transfer instead.", variant: "destructive" });
      setProcessing(false);
    }
  };

  if (isLoading) return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  if (!pkg) return <div className="text-center py-12 text-muted-foreground">Package not found.</div>;

  const spacesLeft = pkg.maxCapacity - pkg.currentBookings;

  if (done) {
    const isPaid = doneMethod === "online";
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${isPaid ? "bg-green-100" : "bg-amber-100"}`}>
          <CheckCircle2 className={`w-10 h-10 ${isPaid ? "text-green-600" : "text-amber-600"}`} />
        </div>
        <h1 className="text-3xl font-serif font-bold text-primary mb-4">
          {isPaid ? "Booking Confirmed!" : "Booking Submitted!"}
        </h1>
        <p className="text-muted-foreground mb-2">
          Your booking for <strong>{pkg.name}</strong> has been submitted.
        </p>
        <p className="text-muted-foreground mb-8">
          {isPaid
            ? "Your payment was received. Your visa application is now in progress."
            : "Our team will confirm your booking once payment is verified."}
        </p>
        {!isPaid && (
          <div className="bg-muted/50 rounded-lg p-4 text-sm mb-8 border text-left">
            <p className="font-semibold mb-2">
              {doneMethod === "bank_transfer" ? "Bank Transfer Details" : "Cash Payment"}
            </p>
            {doneMethod === "bank_transfer" ? (
              <>
                {primaryBank ? (
                  <>
                    <p><span className="text-muted-foreground">Bank:</span> {primaryBank.bankName}</p>
                    <p><span className="text-muted-foreground">Account Name:</span> {primaryBank.accountName}</p>
                    <p><span className="text-muted-foreground">Account Number:</span> <strong className="font-mono">{primaryBank.accountNumber}</strong></p>
                  </>
                ) : (
                  <p className="text-muted-foreground text-xs">Contact Raudah Travels for our bank account details.</p>
                )}
                <p><span className="text-muted-foreground">Amount:</span> ₦{fullAmount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Please use your name as the transfer description/narration.</p>
              </>
            ) : (
              <p className="text-muted-foreground">Please visit our office to complete your cash payment of ₦{fullAmount.toLocaleString()}.</p>
            )}
          </div>
        )}
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => setLocation("/dashboard/payments")}>View Payments</Button>
          <Button onClick={() => setLocation("/dashboard/bookings")}>My Bookings</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-serif font-bold text-primary">Book Your Pilgrimage</h1>
        <p className="text-muted-foreground text-sm mt-1">{pkg.name}</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className={`flex flex-col items-center ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${i < step ? "bg-primary border-primary text-white" : i === step ? "border-primary text-primary bg-white" : "border-muted-foreground/30 text-muted-foreground/50"}`}>
                {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs mt-1 hidden sm:block text-center ${i === step ? "text-primary font-medium" : "text-muted-foreground/60"}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 mx-1 ${i < step ? "bg-primary" : "bg-muted"}`} />}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          {/* Offline/Online detection banner */}
          {!isOnline && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <WifiOff className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">No internet connection</p>
                <p className="text-xs text-amber-600">Your progress is saved locally. It will be submitted when connection is restored.</p>
              </div>
            </div>
          )}
          {wasOffline && isOnline && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <Wifi className="w-4 h-4 text-green-600 flex-shrink-0" />
              <p className="text-sm font-medium text-green-800">Connection restored ✓</p>
            </div>
          )}
          {validationErrors.length > 0 && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Please fill in required fields:</p>
                <p className="text-xs text-red-600">{validationErrors.join(", ")}</p>
              </div>
            </div>
          )}

          {/* ── Step 0: Package summary ───────────────────────────── */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Package Summary</h2>
              <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-primary text-lg">{pkg.name}</h3>
                    <div className="flex items-center gap-1 mt-1">
                      {Array.from({ length: pkg.starRating }).map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 text-accent fill-current" />
                      ))}
                    </div>
                  </div>
                  <Badge variant="outline" className="capitalize">{pkg.type}</Badge>
                </div>
                <div className="grid grid-cols-1 gap-3 mt-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="w-4 h-4" /> {pkg.durationDays} Days</div>
                </div>
                <div className="mt-4">
                  <PackageAvailability
                    maxCapacity={pkg.maxCapacity}
                    currentBookings={pkg.currentBookings}
                  />
                </div>
                <div className="mt-4 pt-4 border-t border-primary/10">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Full Price (per person)</span>
                    {isFetching ? <Skeleton className="h-5 w-28" /> : <span className="font-bold text-primary">₦{pkg.price.toLocaleString()}</span>}
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="pilgrimCount">Number of Pilgrims</Label>
                <Select value={String(payForm.pilgrimCount)} onValueChange={(v) => setPayForm((f) => ({ ...f, pilgrimCount: Number(v) }))}>
                  <SelectTrigger id="pilgrimCount"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: Math.min(10, spacesLeft) }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} pilgrim{n > 1 ? "s" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {pkg?.type === "umrah" && pkg.packageDates && pkg.packageDates.length > 0 && (() => {
                const departureCities = [...new Set(pkg.packageDates.map((d: any) => (d.outboundRoute || "").split("-")[0].trim()).filter(Boolean))];
                const filteredDates = departureCityFilter
                  ? pkg.packageDates.filter((d: any) => (d.outboundRoute || "").startsWith(departureCityFilter))
                  : [];
                return (
                  <div className="space-y-3 mt-4 border-t pt-4">
                    <div>
                      <Label className="text-sm font-semibold text-primary">Departure City <span className="text-red-500">*</span></Label>
                      <div className="flex gap-2 mt-1.5">
                        {departureCities.map((city: string) => (
                          <button key={city} type="button"
                            onClick={() => { setDepartureCityFilter(departureCityFilter === city ? "" : city); setPackageDateId(""); }}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${
                              departureCityFilter === city
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-muted bg-muted/30 text-muted-foreground hover:border-primary/40"
                            }`}>
                            ✈ {city}
                          </button>
                        ))}
                      </div>
                    </div>
                    {departureCityFilter ? (
                      <div>
                        <Label htmlFor="packageDateId" className="text-sm font-semibold text-primary">Flight Schedule *</Label>
                        <Select value={packageDateId} onValueChange={setPackageDateId}>
                          <SelectTrigger id="packageDateId" className="w-full">
                            <SelectValue placeholder={`Select a ${departureCityFilter} flight...`} />
                          </SelectTrigger>
                          <SelectContent>
                            {[...filteredDates]
                              .sort((a: any, b: any) => new Date(a.outbound).getTime() - new Date(b.outbound).getTime())
                              .map((d: any) => (
                                <SelectItem key={d.id} value={d.id} className="text-xs">
                                  {formatDate(d.outbound)} - {formatDate(d.returnDate)} ({d.outboundRoute} → {d.returnRoute}) via {d.airline}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">👆 Please select a departure city first to see available flight dates.</p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── Step 1: Passport ─────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Passport Details</h2>
              <PassportExpiryAlert expiry={passportForm.passportExpiry} />
              {/* AI Passport Scanner — auto-fills all fields below */}
              <PassportScanner
                onExtracted={(data) => {
                  const extracted: string[] = [];
                  if (data.firstName) extracted.push("firstName");
                  if (data.lastName) extracted.push("lastName");
                  if (data.passportNumber) extracted.push("passportNumber");
                  if (data.passportIssueDate) extracted.push("passportIssueDate");
                  if (data.passportExpiry) extracted.push("passportExpiry");
                  if (data.dateOfBirth) extracted.push("dateOfBirth");
                  if (data.gender) extracted.push("gender");
                  if (data.nationality) extracted.push("nationality");
                  setAiFields(prev => Array.from(new Set([...prev, ...extracted])));
                  
                  setPassportForm(f => ({
                    ...f,
                    passportNumber:    data.passportNumber    || f.passportNumber,
                    passportIssueDate: data.passportIssueDate || f.passportIssueDate,
                    passportExpiry:    data.passportExpiry    || f.passportExpiry,
                    passportCopyUrl:   data.passportImageDataUrl || f.passportCopyUrl,
                  }));
                  if (data.firstName || data.lastName) {
                    setPersonalForm(f => ({
                      ...f,
                      firstName:   data.firstName   || f.firstName,
                      lastName:    data.lastName    || f.lastName,
                      dateOfBirth: data.dateOfBirth || f.dateOfBirth,
                      gender:      data.gender      || f.gender,
                      nationality: data.nationality || f.nationality,
                    }));
                  }
                }}
                onProfilePhoto={(dataUrl) => setPersonalForm(f => ({ ...f, profilePhotoUrl: dataUrl }))}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {show("passportNumber") && (
                  <div className="sm:col-span-2">
                    <Label htmlFor="passportNumber">{lbl("passportNumber", "Passport Number")}</Label>
                    <Input id="passportNumber" value={passportForm.passportNumber}
                      onChange={e => {
                        if (aiFields.includes("passportNumber")) setAiFields(p => p.filter(f => f !== "passportNumber"));
                        setPassportForm(f => ({ ...f, passportNumber: e.target.value }));
                      }}
                      placeholder="e.g. A12345678" className={`font-mono ${aiClass("passportNumber")}`} />
                  </div>
                )}
                {show("passportIssueDate") && (
                  <div>
                    <Label htmlFor="passportIssueDate">{lbl("passportIssueDate", "Date of Issue")}</Label>
                    <Input id="passportIssueDate" type="date" value={passportForm.passportIssueDate}
                      onChange={e => {
                        if (aiFields.includes("passportIssueDate")) setAiFields(p => p.filter(f => f !== "passportIssueDate"));
                        setPassportForm(f => ({ ...f, passportIssueDate: e.target.value }));
                      }} className={aiClass("passportIssueDate")} />
                  </div>
                )}
                {show("passportExpiry") && (
                  <div>
                    <Label htmlFor="passportExpiry">{lbl("passportExpiry", "Expiration Date")}</Label>
                    <Input id="passportExpiry" type="date" value={passportForm.passportExpiry}
                      onChange={e => {
                        if (aiFields.includes("passportExpiry")) setAiFields(p => p.filter(f => f !== "passportExpiry"));
                        setPassportForm(f => ({ ...f, passportExpiry: e.target.value }));
                      }} className={aiClass("passportExpiry")} />
                  </div>
                )}
                {show("passportIssuingAuthority") && (
                  <div className="sm:col-span-2">
                    <Label htmlFor="passportIssuingAuthority">{lbl("passportIssuingAuthority", "Issuing Authority")}</Label>
                    <Input id="passportIssuingAuthority" value={passportForm.passportIssuingAuthority}
                      onChange={e => {
                        if (aiFields.includes("passportIssuingAuthority")) setAiFields(p => p.filter(f => f !== "passportIssuingAuthority"));
                        setPassportForm(f => ({ ...f, passportIssuingAuthority: e.target.value }));
                      }}
                      placeholder="e.g. Nigeria Immigration Service" className={aiClass("passportIssuingAuthority")} />
                  </div>
                )}
                {show("visaNumber") && (
                  <div>
                    <Label htmlFor="visaNumber">{lbl("visaNumber", "N° Visa")}</Label>
                    <Input id="visaNumber" value={passportForm.visaNumber}
                      onChange={e => setPassportForm(f => ({ ...f, visaNumber: e.target.value }))}
                      placeholder="Visa number" className="font-mono" />
                  </div>
                )}
              </div>
              {(show("passportCopyUrl") || show("profilePhotoUrl")) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {show("passportCopyUrl") && (
                    <FileUploadBox
                      label={lbl("passportCopyUrl", "Passport Copy")}
                      accept="image/*,application/pdf"
                      previewType="file"
                      value={passportForm.passportCopyUrl}
                      onChange={v => setPassportForm(f => ({ ...f, passportCopyUrl: v }))}
                      hint="Upload a scan or photo of your passport"
                      folder="passports"
                    />
                  )}
                  {show("profilePhotoUrl") && (
                    <FileUploadBox
                      label={lbl("profilePhotoUrl", "Profile Picture")}
                      accept="image/*"
                      value={personalForm.profilePhotoUrl}
                      onChange={v => setPersonalForm(f => ({ ...f, profilePhotoUrl: v }))}
                      hint="Clear face photo for your ID"
                      folder="photos"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Personal Info ─────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Personal Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {show("civility") && (
                  <div>
                    <Label>{lbl("civility", "Civility")}</Label>
                    <Select value={personalForm.civility} onValueChange={v => {
                      if (aiFields.includes("civility")) setAiFields(p => p.filter(f => f !== "civility"));
                      setPersonalForm(f => ({ ...f, civility: v }));
                    }}>
                      <SelectTrigger className={aiClass("civility")}><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>{CIVILITY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {show("gender") && (
                  <div>
                    <Label>{lbl("gender", "Sex")}</Label>
                    <Select value={personalForm.gender} onValueChange={v => {
                      if (aiFields.includes("gender")) setAiFields(p => p.filter(f => f !== "gender"));
                      setPersonalForm(f => ({ ...f, gender: v }));
                    }}>
                      <SelectTrigger className={aiClass("gender")}><SelectValue placeholder="Select gender" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {show("firstName") && (
                  <div>
                    <Label htmlFor="firstName">{lbl("firstName", "First Name")}</Label>
                    <Input id="firstName" value={personalForm.firstName}
                      onChange={e => {
                        if (aiFields.includes("firstName")) setAiFields(p => p.filter(f => f !== "firstName"));
                        setPersonalForm(f => ({ ...f, firstName: e.target.value }));
                      }} className={aiClass("firstName")} />
                  </div>
                )}
                {show("lastName") && (
                  <div>
                    <Label htmlFor="lastName">{lbl("lastName", "Last Name")}</Label>
                    <Input id="lastName" value={personalForm.lastName}
                      onChange={e => {
                        if (aiFields.includes("lastName")) setAiFields(p => p.filter(f => f !== "lastName"));
                        setPersonalForm(f => ({ ...f, lastName: e.target.value }));
                      }} className={aiClass("lastName")} />
                  </div>
                )}
                {show("dateOfBirth") && (
                  <div>
                    <Label htmlFor="dateOfBirth">{lbl("dateOfBirth", "Date of Birth")}</Label>
                    <Input id="dateOfBirth" type="date" value={personalForm.dateOfBirth}
                      onChange={e => {
                        if (aiFields.includes("dateOfBirth")) setAiFields(p => p.filter(f => f !== "dateOfBirth"));
                        setPersonalForm(f => ({ ...f, dateOfBirth: e.target.value }));
                      }} className={aiClass("dateOfBirth")} />
                  </div>
                )}
                {show("placeOfBirth") && (
                  <div>
                    <Label htmlFor="placeOfBirth">{lbl("placeOfBirth", "Place of Birth")}</Label>
                    <Input id="placeOfBirth" value={personalForm.placeOfBirth}
                      onChange={e => setPersonalForm(f => ({ ...f, placeOfBirth: e.target.value }))}
                      placeholder="City / State" />
                  </div>
                )}
                {show("nationality") && (
                  <div>
                    <Label>{lbl("nationality", "Nationality")}</Label>
                    <Select value={personalForm.nationality} onValueChange={v => {
                      if (aiFields.includes("nationality")) setAiFields(p => p.filter(f => f !== "nationality"));
                      setPersonalForm(f => ({ ...f, nationality: v }));
                    }}>
                      <SelectTrigger className={aiClass("nationality")}><SelectValue /></SelectTrigger>
                      <SelectContent>{NATIONALITIES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {show("ethnicGroup") && (() => {
                  const isCustomEthnic = !!(personalForm.ethnicGroup && !ETHNIC_GROUPS.includes(personalForm.ethnicGroup));
                  const ethnicSelVal = isCustomEthnic ? "__other__" : (personalForm.ethnicGroup || "");
                  return (
                    <div>
                      <Label htmlFor="ethnicGroup">{lbl("ethnicGroup", "Ethnic Group")}</Label>
                      <Select value={ethnicSelVal} onValueChange={v => v === "__other__"
                        ? setPersonalForm(f => ({ ...f, ethnicGroup: "" }))
                        : setPersonalForm(f => ({ ...f, ethnicGroup: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select ethnic group…" /></SelectTrigger>
                        <SelectContent>
                          {ETHNIC_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                          <SelectItem value="__other__">Other (specify)</SelectItem>
                        </SelectContent>
                      </Select>
                      {(isCustomEthnic || ethnicSelVal === "__other__") && (
                        <Input id="ethnicGroup" value={personalForm.ethnicGroup}
                          onChange={e => setPersonalForm(f => ({ ...f, ethnicGroup: e.target.value }))}
                          placeholder="Type ethnic group…" className="mt-2" />
                      )}
                    </div>
                  );
                })()}
                {show("maritalStatus") && (
                  <div>
                    <Label>{lbl("maritalStatus", "Marital Status")}</Label>
                    <Select value={personalForm.maritalStatus} onValueChange={v => setPersonalForm(f => ({ ...f, maritalStatus: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>{MARITAL_STATUS.map(m => <SelectItem key={m} value={m.toLowerCase()}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {show("levelOfStudy") && (
                  <div>
                    <Label>{lbl("levelOfStudy", "Level of Study")}</Label>
                    <Select value={personalForm.levelOfStudy} onValueChange={v => setPersonalForm(f => ({ ...f, levelOfStudy: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>{LEVEL_OF_STUDY.map(l => <SelectItem key={l} value={l.toLowerCase()}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {show("partner") && (
                  <div>
                    <Label htmlFor="partner">{lbl("partner", "Partner / Mahram")}</Label>
                    <Input id="partner" value={personalForm.partner}
                      onChange={e => setPersonalForm(f => ({ ...f, partner: e.target.value }))}
                      placeholder="Partner or Mahram name" />
                  </div>
                )}
                {show("underCover") && (
                  <div>
                    <Label htmlFor="underCover">{lbl("underCover", "Under Cover")}</Label>
                    <Input id="underCover" value={personalForm.underCover}
                      onChange={e => setPersonalForm(f => ({ ...f, underCover: e.target.value }))}
                      placeholder="e.g. RAUDAH FUNTUA" />
                  </div>
                )}
                {show("observation") && (
                  <div className="sm:col-span-2">
                    <Label htmlFor="observation">{lbl("observation", "Observation")}</Label>
                    <Textarea id="observation" value={personalForm.observation}
                      onChange={e => setPersonalForm(f => ({ ...f, observation: e.target.value }))}
                      placeholder="Any notes about your travel needs…" rows={2} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step 3: Contact & Address ─────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Contact & Address</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {show("phone") && (
                  <div className="sm:col-span-2">
                    <Label htmlFor="phone">{lbl("phone", "Phone (WhatsApp)")}</Label>
                    <div className="flex gap-2 mt-1">
                      <Select value={phoneCode} onValueChange={setPhoneCode}>
                        <SelectTrigger className="w-[130px] shrink-0">
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
                      <Input id="phone" type="tel" value={contactForm.phone}
                        onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="80 0000 0000" className="flex-1" />
                    </div>
                  </div>
                )}
                {show("email") && (
                  <div className="sm:col-span-2">
                    <Label htmlFor="email">{lbl("email", "Email")}</Label>
                    <Input id="email" type="email" value={contactForm.email}
                      onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="your@email.com" />
                  </div>
                )}
                {show("country") && (
                  <div>
                    <Label htmlFor="country">{lbl("country", "Country")}</Label>
                    <Input id="country" value={contactForm.country}
                      onChange={e => setContactForm(f => ({ ...f, country: e.target.value }))}
                      placeholder="Nigeria" />
                  </div>
                )}
                {show("city") && (
                  <div>
                    <Label htmlFor="city">{lbl("city", "City")}</Label>
                    <Input id="city" value={contactForm.city}
                      onChange={e => setContactForm(f => ({ ...f, city: e.target.value }))}
                      placeholder="City of residence" />
                  </div>
                )}
                {show("address") && (
                  <div className="sm:col-span-2">
                    <Label htmlFor="address">{lbl("address", "Address")}</Label>
                    <Input id="address" value={contactForm.address}
                      onChange={e => setContactForm(f => ({ ...f, address: e.target.value }))}
                      placeholder="Full residential address" />
                  </div>
                )}
                {show("departureCity") && (
                  <div>
                    <Label>{lbl("departureCity", "Departure City")}</Label>
                    <Select value={contactForm.departureCity} onValueChange={v => setContactForm(f => ({ ...f, departureCity: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                      <SelectContent>
                        {["Lagos", "Abuja", "Kano", "Port Harcourt", "Ibadan", "Enugu"].map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {show("roomPreference") && (
                  <div>
                    <Label>{lbl("roomPreference", "Room Preference")}</Label>
                    <Select value={contactForm.roomType} onValueChange={v => setContactForm(f => ({ ...f, roomType: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select room type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="quad">Quad (4 persons) — Included</SelectItem>
                        <SelectItem value="triple">Triple (3 persons){roomSurcharges.triple ? ` (+₦${roomSurcharges.triple.toLocaleString()})` : ""}</SelectItem>
                        <SelectItem value="double">Double (2 persons){roomSurcharges.double ? ` (+₦${roomSurcharges.double.toLocaleString()})` : ""}</SelectItem>
                        <SelectItem value="single">Single (1 person){roomSurcharges.single ? ` (+₦${roomSurcharges.single.toLocaleString()})` : ""}</SelectItem>
                      </SelectContent>
                    </Select>
                    {roomSurcharge > 0 && (
                      <p className="text-xs text-amber-600 mt-1">Room surcharge: +₦{roomSurcharge.toLocaleString()} per person</p>
                    )}
                  </div>
                )}
                <div className="sm:col-span-2">
                  <Label htmlFor="specialRequests">Special Requests <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                  <Textarea id="specialRequests" value={contactForm.specialRequests}
                    onChange={e => setContactForm(f => ({ ...f, specialRequests: e.target.value }))}
                    placeholder="Dietary requirements, wheelchair access, medical needs…" rows={2} />
                </div>
              </div>
              {/* ── Child / Infant Registration ──────────────────── */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold">Travelling with Children?</h3>
                    <p className="text-xs text-muted-foreground">Add children or infants to this booking</p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => addChildEntry("child")}>
                      <UserPlus className="w-3.5 h-3.5 mr-1" /> Child
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => addChildEntry("infant")}>
                      <Baby className="w-3.5 h-3.5 mr-1" /> Infant
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Child (≤11 years): ₦{(childInfantPricing.childPrice || 1200000).toLocaleString()} · Infant (0-23 months): ₦{(childInfantPricing.infantPrice || 1200000).toLocaleString()}</p>
                {childEntries.map((child, idx) => {
                  const detectedType = child.dateOfBirth ? detectPilgrimType(child.dateOfBirth) : child.type;
                  const actualType = detectedType === "adult" ? child.type : detectedType;
                  return (
                    <div key={child.id} className="bg-muted/30 rounded-lg border p-4 mb-3">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={actualType === "infant" ? "secondary" : "outline"}>
                            {actualType === "infant" ? "👶 Infant" : "🧒 Child"} #{idx + 1}
                          </Badge>
                          <span className="text-xs font-semibold text-primary">₦{getChildPrice(actualType as "child" | "infant").toLocaleString()}</span>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeChildEntry(child.id)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <PassportScanner
                        compact
                        onExtracted={(data) => {
                          const extracted: string[] = [];
                          if (data.firstName) extracted.push("firstName");
                          if (data.lastName) extracted.push("lastName");
                          if (data.passportNumber) extracted.push("passportNumber");
                          if (data.passportIssueDate) extracted.push("passportIssueDate");
                          if (data.passportExpiry) extracted.push("passportExpiry");
                          if (data.dateOfBirth) extracted.push("dateOfBirth");
                          if (data.gender) extracted.push("gender");
                          if (data.nationality) extracted.push("nationality");
                          const newAiFields = Array.from(new Set([...(child.aiFields || []), ...extracted]));
                          
                          updateChildEntry(child.id, {
                            firstName: data.firstName || child.firstName,
                            lastName: data.lastName || child.lastName,
                            dateOfBirth: data.dateOfBirth || child.dateOfBirth,
                            gender: data.gender || child.gender,
                            nationality: data.nationality || child.nationality,
                            passportNumber: data.passportNumber || child.passportNumber,
                            passportIssueDate: data.passportIssueDate || child.passportIssueDate,
                            passportExpiry: data.passportExpiry || child.passportExpiry,
                            passportCopyUrl: data.passportImageDataUrl || child.passportCopyUrl,
                            aiFields: newAiFields,
                          });
                        }}
                        onProfilePhoto={(url) => updateChildEntry(child.id, { profilePhotoUrl: url })}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                        <div>
                          <Label className="text-xs">First Name *</Label>
                          <Input value={child.firstName} onChange={e => {
                            const aiFields = child.aiFields?.filter(f => f !== "firstName") || [];
                            updateChildEntry(child.id, { firstName: e.target.value, aiFields });
                          }} placeholder="First name" className={childAiClass(child, "firstName")} />
                        </div>
                        <div>
                          <Label className="text-xs">Last Name *</Label>
                          <Input value={child.lastName} onChange={e => {
                            const aiFields = child.aiFields?.filter(f => f !== "lastName") || [];
                            updateChildEntry(child.id, { lastName: e.target.value, aiFields });
                          }} placeholder="Last name" className={childAiClass(child, "lastName")} />
                        </div>
                        <div>
                          <Label className="text-xs">Date of Birth *</Label>
                          <Input type="date" value={child.dateOfBirth} onChange={e => {
                            const newDob = e.target.value;
                            const detected = detectPilgrimType(newDob);
                            const aiFields = child.aiFields?.filter(f => f !== "dateOfBirth") || [];
                            updateChildEntry(child.id, { dateOfBirth: newDob, type: detected === "adult" ? child.type : detected as "child" | "infant", aiFields });
                          }} className={childAiClass(child, "dateOfBirth")} />
                        </div>
                        <div>
                          <Label className="text-xs">Gender</Label>
                          <Select value={child.gender} onValueChange={v => {
                            const aiFields = child.aiFields?.filter(f => f !== "gender") || [];
                            updateChildEntry(child.id, { gender: v, aiFields });
                          }}>
                            <SelectTrigger className={childAiClass(child, "gender")}><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Passport Number</Label>
                          <Input value={child.passportNumber} onChange={e => {
                            const aiFields = child.aiFields?.filter(f => f !== "passportNumber") || [];
                            updateChildEntry(child.id, { passportNumber: e.target.value, aiFields });
                          }} placeholder="Passport number" className={`font-mono ${childAiClass(child, "passportNumber")}`} />
                        </div>
                        <div>
                          <Label className="text-xs">Nationality</Label>
                          <Select value={child.nationality} onValueChange={v => {
                            const aiFields = child.aiFields?.filter(f => f !== "nationality") || [];
                            updateChildEntry(child.id, { nationality: v, aiFields });
                          }}>
                            <SelectTrigger className={childAiClass(child, "nationality")}><SelectValue /></SelectTrigger>
                            <SelectContent>{NATIONALITIES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">Phone and email will use parent's contact information.</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Step 4: Review & Payment ─────────────────────────── */}
          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Review & Payment</h2>
              <div className="bg-muted/40 rounded-lg p-4 space-y-2 text-sm border">
                <p className="font-semibold mb-1">Booking Summary</p>
                <div className="flex justify-between"><span className="text-muted-foreground">Package</span><span className="font-medium">{pkg.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{personalForm.civility ? `${personalForm.civility} ` : ""}{fullName || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Pilgrims</span><span>{payForm.pilgrimCount}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Departure</span><span>{new Date(pkg.departureDate).toLocaleDateString()}</span></div>
                {packageDateId && (() => {
                  const selectedDate = pkg.packageDates?.find((d: any) => d.id === packageDateId);
                  if (!selectedDate) return null;
                  return (
                    <div className="flex justify-between text-emerald-700 bg-emerald-50/50 p-2 rounded border border-emerald-100 my-1">
                      <span className="text-muted-foreground">Flight Schedule</span>
                      <span className="font-medium text-right text-xs">
                        {formatDate(selectedDate.outbound as string)} - {formatDate(selectedDate.returnDate as string)}<br />
                        <span className="text-[10px] text-muted-foreground">({selectedDate.outboundRoute} | {selectedDate.returnRoute}) via {selectedDate.airline}</span>
                      </span>
                    </div>
                  );
                })()}
                <div className="flex justify-between"><span className="text-muted-foreground">Price per person</span>
                  {isFetching ? <Skeleton className="h-5 w-28" /> : <span>₦{pkg.price.toLocaleString()}</span>}
                </div>
                {roomSurcharge > 0 && (
                  <div className="flex justify-between text-amber-700"><span>Room surcharge ({contactForm.roomType})</span><span>+₦{roomSurcharge.toLocaleString()} × {payForm.pilgrimCount}</span></div>
                )}
                {childEntries.length > 0 && (
                  <>
                    <div className="border-t border-border pt-1 mt-1" />
                    {childEntries.map((c, i) => (
                      <div key={c.id} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{c.type === "infant" ? "👶 Infant" : "🧒 Child"}: {c.firstName || `#${i+1}`} {c.lastName}</span>
                        <span>₦{getChildPrice(c.type).toLocaleString()}</span>
                      </div>
                    ))}
                  </>
                )}
                <div className="flex justify-between font-bold border-t border-border pt-2 mt-1">
                  <span>Total Amount Due</span>
                  {isFetching ? <Skeleton className="h-5 w-28" /> : <span className="text-primary">₦{fullAmount.toLocaleString()}</span>}
                </div>
              </div>

              <div>
                <Label className="mb-3 block">Select Payment Method</Label>
                <div className={`grid grid-cols-1 gap-3 ${paystackEnabled ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                  {([
                    { value: "online",        label: "Pay Online",     sub: "Card / Bank (Paystack)", icon: CreditCard, highlight: true,  show: paystackEnabled },
                    { value: "bank_transfer", label: "Bank Transfer",  sub: "Transfer & send proof",  icon: Building2,  highlight: false, show: true },
                    { value: "cash",          label: "Cash at Office", sub: "Pay at our office",      icon: Banknote,   highlight: false, show: true },
                  ] as const).filter(o => o.show).map(({ value, label, sub, icon: Icon, highlight }) => (
                    <button key={value} type="button"
                      onClick={() => setPayForm(f => ({ ...f, method: value }))}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center cursor-pointer ${
                        payForm.method === value
                          ? highlight ? "border-accent bg-accent/10 text-accent" : "border-primary bg-primary/5 text-primary"
                          : "border-muted hover:border-primary/40"
                      }`}>
                      <Icon className={`w-6 h-6 ${payForm.method === value ? (highlight ? "text-accent" : "text-primary") : "text-muted-foreground"}`} />
                      <span className="font-semibold text-sm">{label}</span>
                      <span className="text-xs text-muted-foreground">{sub}</span>
                      {highlight && <Badge className="text-[10px] px-1.5 py-0 bg-accent text-accent-foreground">Instant</Badge>}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Payment Amount Options (bank_transfer / cash) ── */}
              {(payForm.method === "bank_transfer" || payForm.method === "cash") && (
                <div className="space-y-3">
                  <Label className="block">Payment Amount</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "full" as const, label: "Full Payment", amount: fullAmount },
                      { key: "500000" as const, label: "Minimum Deposit", amount: 500000 },
                      { key: "1000000" as const, label: "₦1,000,000", amount: 1000000 },
                      { key: "custom" as const, label: "Custom Amount", amount: null as number | null },
                    ].map(opt => (
                      <button key={opt.key} type="button"
                        onClick={() => setPaymentOption(opt.key)}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${paymentOption === opt.key ? "border-primary bg-primary/5" : "border-muted hover:border-primary/30"}`}>
                        <span className="text-sm font-semibold block">{opt.label}</span>
                        {opt.amount && <span className="text-xs text-muted-foreground">₦{opt.amount.toLocaleString()}</span>}
                      </button>
                    ))}
                  </div>
                  {paymentOption === "custom" && (
                    <div>
                      <Label className="text-xs">Enter Amount (minimum ₦500,000)</Label>
                      <Input type="number" value={customPaymentAmount}
                        onChange={e => setCustomPaymentAmount(e.target.value)}
                        placeholder="Enter amount" min={500000} />
                      {Number(customPaymentAmount) > 0 && Number(customPaymentAmount) < 500000 && (
                        <p className="text-xs text-red-500 mt-1">Minimum payment is ₦500,000</p>
                      )}
                    </div>
                  )}
                  <div className="bg-primary/5 rounded-lg p-3 flex justify-between items-center">
                    <span className="text-sm font-medium">Amount to Pay</span>
                    <span className="text-lg font-bold text-primary">₦{paymentAmount.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {payForm.method === "bank_transfer" && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm space-y-4">
                  <div>
                    <p className="font-semibold text-primary mb-2">Transfer to:</p>
                    {bankAccounts.length > 0 ? (
                      <div className="space-y-2">
                        {bankAccounts.map(b => (
                          <div key={b.id} className="bg-white p-3 rounded border border-primary/10">
                            <p className="font-bold text-foreground">{b.bankName}</p>
                            <p className="font-mono text-primary font-bold">{b.accountNumber} {(b as any).sortCode ? `· ${(b as any).sortCode}` : ""}</p>
                            <p className="text-xs text-muted-foreground">{b.accountName}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white p-3 rounded border border-primary/10">
                        <p className="font-bold text-foreground">GTBank</p>
                        <p className="font-mono text-primary font-bold">0123456789</p>
                        <p className="text-xs text-muted-foreground">Raudah Travels & Tours Ltd</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-3">
                    <Label htmlFor="payRef">Transaction Reference (optional)</Label>
                    <Input id="payRef" value={payForm.reference}
                      onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))}
                      placeholder="e.g. FT234567890" />
                  </div>
                  <div className="mt-3">
                    <FileUploadBox
                      label="Proof of Payment"
                      accept="image/*,application/pdf"
                      previewType="file"
                      value={payForm.paymentProofUrl}
                      onChange={v => setPayForm(f => ({ ...f, paymentProofUrl: v }))}
                      hint="Upload your transfer receipt"
                      folder="receipts"
                    />
                  </div>
                </div>
              )}
              {payForm.method === "online" && (
                <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 text-sm">
                  <p className="font-semibold text-accent mb-1">Pay securely with Paystack</p>
                  <p className="text-muted-foreground">Full payment of ₦{fullAmount.toLocaleString()} will be processed securely by Paystack. Once confirmed, visa processing begins automatically.</p>
                </div>
              )}
              {payForm.method === "cash" && (
                <div className="bg-muted/50 border rounded-lg p-4 text-sm">
                  <p className="font-semibold mb-1">Cash Payment</p>
                  <p className="text-muted-foreground">Visit our office to pay ₦{paymentAmount.toLocaleString()} in cash.</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0 || processing}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={handleNext} className="bg-primary" disabled={!isOnline}>
            {!isOnline ? "No Connection" : <>Continue <ChevronRight className="w-4 h-4 ml-1" /></>}
          </Button>
        ) : (
          <Button
            onClick={() => setShowConfirmDialog(true)}
            className={`min-w-36 ${payForm.method === "online" ? "bg-accent hover:bg-accent/90 text-accent-foreground" : "bg-primary"}`}
            disabled={processing}
          >
            {processing ? "Processing..." : payForm.method === "online" ? (isFetching ? "Loading…" : `Pay ₦${fullAmount.toLocaleString()}`) : "Confirm Booking"}
          </Button>
        )}
      </div>

      {/* Booking Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Your Booking</DialogTitle>
            <DialogDescription>Please review the details below before proceeding.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Pilgrim</span><span className="font-medium">{fullName || "\u2014"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Package</span><span className="font-medium">{pkg.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Payment Method</span><span className="font-medium capitalize">{payForm.method === "online" ? "Paystack (Online)" : payForm.method.replace("_", " ")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-bold">{"\u20a6"}{fullAmount.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Amount to Pay</span><span className="font-bold text-primary">{"\u20a6"}{paymentAmount.toLocaleString()}</span></div>
            {childEntries.length > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Children/Infants</span><span>{childEntries.length}</span></div>}
            {paymentAmount < fullAmount && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700">You're making a partial payment. The remaining balance is due before departure.</p>
              </div>
            )}
            {payForm.method === "bank_transfer" && !payForm.paymentProofUrl && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700">No payment receipt uploaded. You can upload it later from your dashboard.</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
            <Button onClick={() => { setShowConfirmDialog(false); handleSubmit(); }} disabled={processing}>
              {processing ? "Processing..." : "Confirm & Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
