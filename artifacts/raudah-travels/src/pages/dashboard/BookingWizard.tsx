import { useState, useEffect, useRef } from "react";
import { uploadFile, uploadScannedImage } from "@/lib/upload";
import { useRoute, useLocation } from "wouter";
import { useGetPackage, getGetPackageQueryKey, useCreateBooking } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle2, ChevronLeft, ChevronRight, CalendarDays, Users, Star,
  CreditCard, Upload, FileText, X,
  WifiOff, Wifi, Baby, UserPlus, AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PackageAvailability } from "@/components/PackageAvailability";
import { PackageCancellationPolicy } from "@/components/CancellationPolicy";
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

const CIVILITY_OPTIONS = ["Mr", "Mrs", "Miss", "Dr", "Prof", "Alhaji", "Alhaja", "Mal.", "Hajiya"];
const NATIONALITIES    = ["Nigerian", "Burkinabe", "Nigerien", "Ghanaian", "Senegalese", "Cameroonian", "Other"];
const DEFAULT_DEPARTURE_CITIES = ["Lagos", "Abuja", "Kano", "Port Harcourt", "Ibadan", "Enugu"];

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
  const { user } = useUser();
  if (!user) return null;
  return <PackageBookingForm key={user.id + ":" + packageId} packageId={packageId} />;
}

function PackageBookingForm({ packageId }: { packageId: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useUser();
  const checkoutStorageKey = "package-checkout:" + user?.id + ":" + packageId;

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
  const { data: appConfig, isPending: loadingPaymentConfig } = useQuery<{ paystackEnabled: boolean }>({
    queryKey: ["app-config"],
    queryFn: () => fetch("/api/config").then((r) => r.json()),
    staleTime: 30000,
  });
  const paystackEnabled = appConfig?.paystackEnabled === true;

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

  const [step, setStep] = useState(0);

  // Track a created booking ID so retrying Paystack reuses the same booking (no duplicates)
  const createdBookingIdRef = useRef<string | null>(null);
  const checkoutIdRef = useRef<string | null>(null);
  const submitting = useRef(false);
  const scannedUploads = useRef(new Map<string, Promise<unknown>>());
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  // Step 1: Passport
  const [passportForm, setPassportForm] = useState({
    passportNumber: "", passportIssueDate: "", passportExpiry: "",
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
    specialRequests: "",
  });

  // Step 4: Payment
  const [pilgrimCount, setPilgrimCount] = useState(1);

  const [done, setDone]           = useState(false);
  const [processing, setProcessing] = useState(false);
  const [phoneCode, setPhoneCode] = useState("+234");
  const paystackScriptLoaded = useRef(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Payment amount selection (for bank_transfer / cash only)

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
  const [departureCity, setDepartureCity] = useState("");
  const [roomType, setRoomType] = useState("quad");
  const hasFlightSchedule = pkg?.type === "umrah" && Boolean(pkg.packageDates?.length);

  useEffect(() => {
    if (!paystackScriptLoaded.current) {
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v2/inline.js";
      script.async = true;
      document.body.appendChild(script);
      paystackScriptLoaded.current = true;
    }
  }, []);

  // ── Child/Infant helpers ──────────────────────────────────────────
  function childCategory(dob: string): "child" | "infant" | undefined {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || !Number.isFinite(Date.parse(dob))) return undefined;
    const today = new Date().toISOString().slice(0, 10);
    const age = Number(today.slice(0, 4)) - Number(dob.slice(0, 4))
      - (today.slice(5) < dob.slice(5) ? 1 : 0);
    return age >= 0 && age < 12 ? (age < 2 ? "infant" : "child") : undefined;
  }

  const getChildPrice = (type: "child" | "infant") => {
    const key = type === "infant" ? "infantPrice" : "childPrice";
    const overrides = pkg?.pricingOverrides as Record<string, unknown> | undefined;
    const value = Number(overrides?.[key] ?? childInfantPricing[key] ?? 1200000);
    return Number.isFinite(value) && value >= 0 ? value : 1200000;
  };

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
  const roomSurcharge = roomSurcharges[roomType] || 0;
  const adultPrice = pkg ? (pkg.price + roomSurcharge) : 0;
  const childrenTotal = childEntries.reduce((sum, c) => sum + getChildPrice(childCategory(c.dateOfBirth) ?? c.type), 0);
  const fullAmount = (adultPrice * pilgrimCount) + childrenTotal;
  const fullName = [personalForm.firstName, personalForm.lastName].filter(Boolean).join(" ") || user?.fullName || "";

  const cfg = useFormFieldConfig();
  const show = (name: string) => cfg(name).visible;
  const req  = (name: string) => cfg(name).visible && cfg(name).required;
  const lbl  = (name: string, label: string) => req(name) ? `${label} *` : label;

  const handleNext = () => {
    // Step-level field validation
    if (step === 0) {
      if (hasFlightSchedule && !packageDateId) {
        toast({ title: "Flight Schedule Required", description: "Please select a flight schedule before proceeding.", variant: "destructive" });
        return;
      }
    }
    if (step === 1) {
      const { valid, missingFields } = validateRequiredFields(cfg, passportForm,
        ["passportNumber", "passportIssueDate", "passportCopyUrl"]);
      if (!valid) {
        setValidationErrors(missingFields.map(f => f.label));
        toast({ title: "Required fields missing", description: missingFields.map(f => f.label).join(", "), variant: "destructive" });
        return;
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
      if (childEntries.some((child) => !childCategory(child.dateOfBirth))) {
        toast({ title: "Check the dates of birth", description: "Children and infants must be under 12 and have a date of birth in the past.", variant: "destructive" });
        return;
      }
    }
    setValidationErrors([]);
    setStep(s => s + 1);
  };

  async function travellerDocuments(passport: string, photo: string) {
    async function upload(value: string, folder: "passports" | "photos") {
      if (!value.startsWith("data:")) return value || undefined;
      const key = folder + ":" + value;
      const pending = scannedUploads.current.get(key) ?? uploadScannedImage(value, folder);
      scannedUploads.current.set(key, pending);
      try { return await pending; }
      catch (error) { scannedUploads.current.delete(key); throw error; }
    }
    const [passportCopyUrl, profilePhotoUrl] = await Promise.all([upload(passport, "passports"), upload(photo, "photos")]);
    return { passportCopyUrl, profilePhotoUrl };
  }

  const handleSubmit = async () => {
    if (!paystackEnabled || isFetching || !isOnline || processing || submitting.current) return;
    submitting.current = true;
    setProcessing(true);
    try {
      let bookingId = createdBookingIdRef.current;
      if (!bookingId) {
        if (!checkoutIdRef.current) {
          try {
            const stored = JSON.parse(sessionStorage.getItem(checkoutStorageKey) ?? "null");
            if (stored?.expiresAt > Date.now() && typeof stored.id === "string")
              checkoutIdRef.current = stored.id;
          } catch { /* Storage is optional. */ }
          checkoutIdRef.current ||= crypto.randomUUID();
          try {
            sessionStorage.setItem(checkoutStorageKey, JSON.stringify({
              id: checkoutIdRef.current,
              expiresAt: Date.now() + 2 * 60 * 60 * 1000,
            }));
          } catch { /* The server can still deduplicate retries on this screen. */ }
        }
        const files = await travellerDocuments(passportForm.passportCopyUrl, personalForm.profilePhotoUrl);
        const children = await Promise.all(childEntries.map(async ({ id, type, ...child }) => ({
          ...child, ...await travellerDocuments(child.passportCopyUrl, child.profilePhotoUrl),
          phone: contactForm.phone ? phoneCode + contactForm.phone : undefined,
          email: contactForm.email, country: contactForm.country, city: contactForm.city,
          roomPreference: roomType,
        })));
        const booking = await createBooking.mutateAsync({
          data: {
            packageId: pkg!.id,
            packageDateId: packageDateId || undefined,
            pilgrimCount: pilgrimCount,
            pilgrimDetails: JSON.stringify({ ...passportForm, ...personalForm, ...files, ...contactForm, departureCity, roomType, fullName }),
            notes: contactForm.specialRequests,
            fullName,
            // Passport fields (from passportForm)
            passportNumber: passportForm.passportNumber || undefined,
            passportIssueDate: passportForm.passportIssueDate || undefined,
            passportExpiry: passportForm.passportExpiry || undefined,
            ...files,
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
            partner: personalForm.partner || undefined,
            underCover: personalForm.underCover || undefined,
            // Contact fields (from contactForm)
            phone: contactForm.phone ? `${phoneCode}${contactForm.phone}` : "",
            email: contactForm.email || undefined,
            country: contactForm.country || undefined,
            city: contactForm.city || undefined,
            address: contactForm.address || undefined,
            roomPreference: roomType,
            departureCity: departureCity || undefined,
            checkoutId: checkoutIdRef.current,
            expectedTotal: fullAmount,
            children,
          } as Parameters<typeof createBooking.mutateAsync>[0]["data"],
        });
        bookingId = booking.id;
        createdBookingIdRef.current = bookingId;
      }
      await handlePaystackPayment(bookingId);
    } catch (error) {
      toast({ title: "Booking needs attention", description: error instanceof Error ? error.message : "Open My Bookings before trying again.", variant: "destructive" });
      setProcessing(false);
    } finally {
      submitting.current = false;
    }
  };

  useEffect(() => {
    if (done && paymentConfirmed) {
      try { sessionStorage.removeItem(checkoutStorageKey); } catch { /* Storage is optional. */ }
    }
  }, [done, paymentConfirmed, checkoutStorageKey]);

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
      const data = await res.json() as { accessCode?: string; reference?: string; verified?: boolean; bookingConfirmed?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || "Payment could not be prepared");
      if (data.verified) {
        setPaymentConfirmed(data.bookingConfirmed === true);
        setDone(true);
        setProcessing(false);
        return;
      }
      if (!data.accessCode) throw new Error("Checkout is not available. Check My Bookings.");
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
            const result = await verifyRes.json() as { bookingConfirmed?: boolean };
            setPaymentConfirmed(result.bookingConfirmed === true);
          } catch (verifyErr) {
            toast({
              title: "Payment received but unconfirmed",
              description: "Check My Bookings for the verified status before paying again.",
            });
          }
          setDone(true);
          setProcessing(false);
        },
        onCancel: () => {
          toast({
            title: "Payment not completed",
            description: "Check the payment status before making another payment.",
          });
          setProcessing(false);
          // Do NOT set done=true here — booking exists but no payment yet
        },
        onError: (_err) => {
          toast({ title: "Payment status unavailable", description: "Check the booking before making another payment.", variant: "destructive" });
          setProcessing(false);
        },
      });
    } catch (error) {
      toast({ title: "Payment unavailable", description: error instanceof Error ? error.message : "Check My Bookings before trying again.", variant: "destructive" });
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
    const isPaid = paymentConfirmed;
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${isPaid ? "bg-green-100" : "bg-amber-100"}`}>
          <CheckCircle2 className={`w-10 h-10 ${isPaid ? "text-green-600" : "text-amber-600"}`} />
        </div>
        <h1 className="text-3xl font-serif font-bold text-primary mb-4">
          {isPaid ? "Booking Confirmed!" : "Payment verification pending"}
        </h1>
        <p className="text-muted-foreground mb-2">
          Your booking for <strong>{pkg.name}</strong> has been submitted.
        </p>
        <p className="text-muted-foreground mb-8">
          {isPaid
            ? "Your payment was received. Your visa application is now in progress."
            : "Check My Bookings for the latest payment and reservation status."}
        </p>
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
              <PackageCancellationPolicy />
              <div>
                <Label htmlFor="pilgrimCount">Number of Pilgrims</Label>
                <Select value={String(pilgrimCount)} onValueChange={(v) => setPilgrimCount(Number(v))}>
                  <SelectTrigger id="pilgrimCount"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: Math.min(10, spacesLeft) }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} pilgrim{n > 1 ? "s" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {hasFlightSchedule && (() => {
                const dates = pkg.packageDates ?? [];
                const origin = (route?: string | null) => (route || "").split("-")[0].trim();
                const departureCities = [...new Set(dates.map(d => origin(d.outboundRoute)).filter(Boolean))];
                const filteredDates = dates.filter(d => origin(d.outboundRoute) === departureCity);
                return (
                  <div className="space-y-3 mt-4 border-t pt-4">
                    <div>
                      <Label className="text-sm font-semibold text-primary">Departure City <span className="text-red-500">*</span></Label>
                      <div className="flex gap-2 mt-1.5">
                        {departureCities.map((city: string) => (
                          <button key={city} type="button"
                            onClick={() => { setDepartureCity(departureCity === city ? "" : city); setPackageDateId(""); }}
                            aria-pressed={departureCity === city}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${
                              departureCity === city
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-muted bg-muted/30 text-muted-foreground hover:border-primary/40"
                            }`}>
                            ✈ {city}
                          </button>
                        ))}
                      </div>
                    </div>
                    {departureCity ? (
                      <div>
                        <Label htmlFor="packageDateId" className="text-sm font-semibold text-primary">Flight Schedule *</Label>
                        <Select value={packageDateId} onValueChange={setPackageDateId}>
                          <SelectTrigger id="packageDateId" className="w-full">
                            <SelectValue placeholder={`Select a ${departureCity} flight...`} />
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
              {!hasFlightSchedule && show("departureCity") && (
                <div>
                  <Label htmlFor="packageDepartureCity">Departure City</Label>
                  <Select value={departureCity} onValueChange={setDepartureCity}>
                    <SelectTrigger id="packageDepartureCity"><SelectValue placeholder="Select city" /></SelectTrigger>
                    <SelectContent>
                      {(pkg.departureCities?.length ? pkg.departureCities : DEFAULT_DEPARTURE_CITIES).map(city => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {show("roomPreference") && (
                <div>
                  <Label htmlFor="packageRoomPreference">Room Preference</Label>
                  <Select value={roomType} onValueChange={setRoomType}>
                    <SelectTrigger id="packageRoomPreference"><SelectValue /></SelectTrigger>
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
            </div>
          )}

          {/* ── Step 1: Passport ─────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Passport Details</h2>
              {/* AI Passport Scanner — auto-fills all fields below */}
              <PassportScanner
                requirePrivateUpload
                onExtracted={(data) => {
                  const extracted: string[] = [];
                  if (data.firstName) extracted.push("firstName");
                  if (data.lastName) extracted.push("lastName");
                  if (data.passportNumber) extracted.push("passportNumber");
                  if (data.passportIssueDate) extracted.push("passportIssueDate");
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
                <p className="text-xs text-muted-foreground mb-3">Child (2–11 years): ₦{getChildPrice("child").toLocaleString()} · Infant (0–23 months): ₦{getChildPrice("infant").toLocaleString()}</p>
                {childEntries.map((child, idx) => {
                  const actualType = childCategory(child.dateOfBirth) ?? child.type;
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
                        requirePrivateUpload
                        onExtracted={(data) => {
                          const extracted: string[] = [];
                          if (data.firstName) extracted.push("firstName");
                          if (data.lastName) extracted.push("lastName");
                          if (data.passportNumber) extracted.push("passportNumber");
                          if (data.passportIssueDate) extracted.push("passportIssueDate");
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
                        <FileUploadBox label="Passport copy" accept="image/*,application/pdf" folder="passports"
                          value={child.passportCopyUrl} onChange={(value) => updateChildEntry(child.id, { passportCopyUrl: value })} />
                        <FileUploadBox label="Profile photo" accept="image/*" folder="photos"
                          value={child.profilePhotoUrl} onChange={(value) => updateChildEntry(child.id, { profilePhotoUrl: value })} />
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
                            const aiFields = child.aiFields?.filter(f => f !== "dateOfBirth") || [];
                            updateChildEntry(child.id, { dateOfBirth: newDob, aiFields });
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
                <div className="flex justify-between"><span className="text-muted-foreground">Pilgrims</span><span>{pilgrimCount}</span></div>
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
                  <div className="flex justify-between text-amber-700"><span>Room surcharge ({roomType})</span><span>+₦{roomSurcharge.toLocaleString()} × {pilgrimCount}</span></div>
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

              <PackageCancellationPolicy />

              <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 p-4">
                <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <div>
                  <h3 className="text-sm font-semibold">Pay Online</h3>
                  <p className="text-sm text-muted-foreground">
                    {loadingPaymentConfig ? "Checking payment availability…" : paystackEnabled ? "Pay securely through Paystack." : "Online payment is currently unavailable. Please try again later."}
                  </p>
                </div>
              </div>
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
            className="min-w-36 bg-accent hover:bg-accent/90 text-accent-foreground"
            disabled={processing || isFetching || !paystackEnabled || !isOnline}
          >
            {processing ? "Processing…" : loadingPaymentConfig || isFetching ? "Loading…" : `Pay Online · ₦${fullAmount.toLocaleString()}`}
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
            <div className="flex justify-between"><span className="text-muted-foreground">Payment Method</span><span className="font-medium capitalize">Paystack (Online)</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Amount to Pay</span><span className="font-bold text-primary">{"\u20a6"}{fullAmount.toLocaleString()}</span></div>
            {childEntries.length > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Children/Infants</span><span>{childEntries.length}</span></div>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
            <Button onClick={() => { setShowConfirmDialog(false); handleSubmit(); }} disabled={processing || isFetching || !paystackEnabled || !isOnline}>
              {processing ? "Processing…" : "Continue to Paystack"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
