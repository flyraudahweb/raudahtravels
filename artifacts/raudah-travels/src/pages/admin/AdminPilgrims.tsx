import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Users, Search, ChevronRight, BookOpen, Phone, CreditCard, Calendar,
  MapPin, Download, FileText, Globe, UserCheck, X, Filter, Plane, Home, User,
  Mail, Badge, Clock, Shield, Heart, AlertCircle, CheckCircle2, Printer,
  Plus, Loader2, ChevronDown, Check, Edit3, Save, ArrowLeftRight, Upload, Camera, RotateCcw, Archive, ArchiveRestore, RefreshCcw,
} from "lucide-react";
import ReactCrop, { type Crop, type PercentCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { uploadFile } from "@/lib/upload";

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
  isArchived?: boolean;
  archiveReason?: string | null;
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
  packageDate?: {
    id: string;
    outbound: string;
    outboundRoute: string;
    returnDate: string;
    returnRoute: string;
    airline: string;
    islamicDate?: string | null;
    islamicReturnDate?: string | null;
  } | null;
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

function EditField({ label, field, icon: Icon, full = false, type = "text", options, fallback, isEditing, value: rawValue, onChange }: {
  label: string; field: string; icon?: React.ElementType; full?: boolean;
  type?: "text" | "date" | "select" | "textarea";
  options?: { value: string; label: string }[];
  fallback?: string | null;
  isEditing: boolean;
  value: string;
  onChange: (field: string, value: string) => void;
}) {
  const val = isEditing ? rawValue : (rawValue || fallback || "");
  if (!isEditing && !val) return null;
  return (
    <div className={`${full ? "col-span-2" : ""} group`}>
      <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-[.12em] mb-1 flex items-center gap-1">
        {Icon && <Icon className="w-2.5 h-2.5" />}{label}
      </p>
      {isEditing ? (
        type === "select" && options ? (
          <Select value={val} onValueChange={(v) => onChange(field, v)}>
            <SelectTrigger className="h-8 text-sm rounded-lg border-[#DCE3F0]"><SelectValue placeholder={`Select ${label.toLowerCase()}`} /></SelectTrigger>
            <SelectContent>{options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        ) : type === "textarea" ? (
          <Textarea value={val} onChange={e => onChange(field, e.target.value)}
            className="text-sm rounded-lg border-[#DCE3F0] resize-none" rows={2} />
        ) : (
          <input type={type} value={val} onChange={e => onChange(field, e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-[#DCE3F0] bg-white focus:outline-none focus:ring-2 focus:ring-[#2D3199]/20 focus:border-[#2D3199] font-semibold text-[#0F172A]" />
        )
      ) : (
        <p className="text-sm font-semibold text-[#0F172A] break-words leading-snug">{val}</p>
      )}
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

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Profile photo crop state
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string>("");
  const [crop, setCrop] = useState<Crop>();
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const cropImgRef = useRef<HTMLImageElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const passportInputRef = useRef<HTMLInputElement>(null);

  // Package upgrade state
  const [showPackageUpgrade, setShowPackageUpgrade] = useState(false);
  const [availablePackages, setAvailablePackages] = useState<any[]>([]);
  const [packageDatesForUpgrade, setPackageDatesForUpgrade] = useState<any[]>([]);
  const [selectedNewPkg, setSelectedNewPkg] = useState<string>("");
  const [selectedNewDate, setSelectedNewDate] = useState<string>("");
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [loadingPkgs, setLoadingPkgs] = useState(false);

  // Archive state
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

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
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      setShowRecordPay(false);
      onClose(); // Close detail to force refresh
    } catch (e: any) {
      toast({ title: e.message || "Failed to record payment", variant: "destructive" });
    } finally {
      setRpLoading(false);
    }
  };


  const handleArchive = async () => {
    if (!archiveReason.trim()) {
      toast({ title: "Please enter a reason for archiving", variant: "destructive" });
      return;
    }
    setIsArchiving(true);
    try {
      const res = await fetch(`/api/admin/bookings/${pilgrim.id}/archive`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archiveReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to archive");
      toast({ title: "Pilgrim Archived", description: "Pilgrim and their payments have been archived." });
      setShowArchiveModal(false);
      qc.invalidateQueries({ queryKey: ["admin-pilgrims"] });
      onClose();
    } catch (e: any) {
      toast({ title: "Error archiving", description: e.message, variant: "destructive" });
    } finally {
      setIsArchiving(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const res = await fetch(`/api/admin/bookings/${pilgrim.id}/restore`, {
        method: "PUT",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to restore");
      toast({ title: "Pilgrim Restored", description: "Pilgrim and their payments have been restored." });
      qc.invalidateQueries({ queryKey: ["admin-pilgrims"] });
      onClose();
    } catch (e: any) {
      toast({ title: "Error restoring", description: e.message, variant: "destructive" });
    } finally {
      setIsRestoring(false);
    }
  };

  // ── Edit mode helpers ──
  const startEditing = () => {
    setEditData({
      civility: pilgrim.civility || "", firstName: pilgrim.firstName || "", lastName: pilgrim.lastName || "",
      fullName: pilgrim.fullName || "", dateOfBirth: pilgrim.dateOfBirth || "", gender: pilgrim.gender || "",
      nationality: pilgrim.nationality || "", placeOfBirth: pilgrim.placeOfBirth || "",
      ethnicGroup: pilgrim.ethnicGroup || "", maritalStatus: pilgrim.maritalStatus || "",
      levelOfStudy: pilgrim.levelOfStudy || "", occupation: pilgrim.occupation || "",
      email: pilgrim.email || pilgrim.user?.email || "", phone: pilgrim.phone || pilgrim.user?.phone || "",
      country: pilgrim.country || "", city: pilgrim.city || "", address: pilgrim.address || "",
      observation: pilgrim.observation || "", partner: pilgrim.partner || "", underCover: pilgrim.underCover || "",
      fathersName: pilgrim.fathersName || "", mothersName: pilgrim.mothersName || "",
      mahramName: pilgrim.mahramName || "", mahramRelationship: pilgrim.mahramRelationship || "",
      emergencyContactName: pilgrim.emergencyContactName || "", emergencyContactPhone: pilgrim.emergencyContactPhone || "",
      passportNumber: pilgrim.passportNumber || "", passportIssueDate: pilgrim.passportIssueDate || "",
      passportExpiry: pilgrim.passportExpiry || "", passportIssuingAuthority: pilgrim.passportIssuingAuthority || "",
      visaNumber: pilgrim.visaNumber || "", departureCity: pilgrim.departureCity || "",
      roomPreference: pilgrim.roomPreference || "",
      profilePhotoUrl: pilgrim.profilePhotoUrl || "", passportCopyUrl: pilgrim.passportCopyUrl || "",
    });
    setIsEditing(true);
  };
  const cancelEditing = () => { setEditData({}); setIsEditing(false); };
  const updateField = (field: string, value: string) => setEditData(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/bookings/${pilgrim.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(editData),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({ error: "Failed" })); throw new Error(err.error || "Failed to save"); }
      toast({ title: "Pilgrim info updated successfully" });
      qc.invalidateQueries({ queryKey: ["admin-pilgrims"] });
      setIsEditing(false);
    } catch (e: any) {
      toast({ title: e.message || "Failed to save", variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  // ── Crop helpers ──
  function generateCroppedImage(image: HTMLImageElement, cropData: Crop): string {
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const isPercent = (cropData as PercentCrop).unit === "%";
    const pxX = isPercent ? (cropData.x / 100) * image.width : cropData.x;
    const pxY = isPercent ? (cropData.y / 100) * image.height : cropData.y;
    const pxW = isPercent ? (cropData.width / 100) * image.width : cropData.width;
    const pxH = isPercent ? (cropData.height / 100) * image.height : cropData.height;
    canvas.width = pxW * scaleX; canvas.height = pxH * scaleY;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(image, pxX * scaleX, pxY * scaleY, pxW * scaleX, pxH * scaleY, 0, 0, canvas.width, canvas.height);
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = 400; finalCanvas.height = 400;
    const fCtx = finalCanvas.getContext("2d");
    if (fCtx) { fCtx.fillStyle = "#fff"; fCtx.fillRect(0, 0, 400, 400); fCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, 400, 400); }
    return finalCanvas.toDataURL("image/jpeg", 0.92);
  }
  function dataUrlToFile(dataUrl: string, filename: string): File {
    const [header, base64] = dataUrl.split(",");
    const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], filename, { type: mime });
  }

  const handleProfilePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") { setCropImageSrc(reader.result); setShowCropDialog(true); } };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = "";
  };

  const handleCropConfirm = async () => {
    if (!cropImgRef.current || !crop) return;
    setIsUploadingPhoto(true);
    try {
      const b64 = generateCroppedImage(cropImgRef.current, crop);
      const file = dataUrlToFile(b64, `profile-${Date.now()}.jpg`);
      let url: string;
      try { url = await uploadFile(file, "photos"); } catch { url = b64; }
      updateField("profilePhotoUrl", url);
      toast({ title: "Profile photo updated" });
    } catch { toast({ title: "Failed to crop photo", variant: "destructive" }); }
    finally { setIsUploadingPhoto(false); setShowCropDialog(false); setCropImageSrc(""); }
  };

  const handlePassportUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try { const url = await uploadFile(file, "passports"); updateField("passportCopyUrl", url); toast({ title: "Passport document updated" }); }
    catch { toast({ title: "Failed to upload passport", variant: "destructive" }); }
    if (e.target) e.target.value = "";
  };

  // ── Package upgrade helpers ──
  const openPackageUpgrade = async () => {
    setLoadingPkgs(true); setShowPackageUpgrade(true); setSelectedNewPkg(""); setSelectedNewDate("");
    try {
      const res = await fetch("/api/packages", { credentials: "include" });
      const data = await res.json();
      const pkgs = (data.packages || data || []).filter((p: any) => p.status === "active" || p.isActive);
      setAvailablePackages(pkgs);
    } catch { toast({ title: "Failed to load packages", variant: "destructive" }); }
    finally { setLoadingPkgs(false); }
  };

  const handleSelectNewPackage = async (pkgId: string) => {
    setSelectedNewPkg(pkgId); setSelectedNewDate("");
    // packageDates are already embedded in the package response from GET /packages
    const cached = availablePackages.find((p: any) => p.id === pkgId);
    if (cached?.packageDates?.length) {
      setPackageDatesForUpgrade(cached.packageDates);
      return;
    }
    try {
      const res = await fetch(`/api/packages/${pkgId}`, { credentials: "include" });
      const data = await res.json();
      setPackageDatesForUpgrade(data.packageDates || []);
    } catch { setPackageDatesForUpgrade([]); }
  };

  const handleUpgradeConfirm = async () => {
    if (!selectedNewPkg || isUpgrading) return;
    setIsUpgrading(true);
    try {
      const res = await fetch(`/api/admin/bookings/${pilgrim.id}/upgrade-package`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ newPackageId: selectedNewPkg, newPackageDateId: selectedNewDate || null }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({ error: "Failed" })); throw new Error(err.error || "Failed to change package"); }
      const result = await res.json();
      const diff = result.priceDifference;
      if (diff > 0) toast({ title: `Package upgraded! ₦${diff.toLocaleString()} extra payment pending.` });
      else if (diff < 0) toast({ title: `Package changed. Total price reduced by ₦${Math.abs(diff).toLocaleString()}.` });
      else toast({ title: "Package dates updated successfully" });
      qc.invalidateQueries({ queryKey: ["admin-pilgrims"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      setShowPackageUpgrade(false); onClose();
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setIsUpgrading(false); }
  };

  // Helper to get field value for EditField
  const efVal = (field: string) => isEditing ? (editData[field] ?? "") : ((pilgrim as any)[field] ?? "");

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

              {/* Right: edit + close */}
              <div className="flex items-center gap-2 shrink-0">
                {isEditing ? (
                  <>
                    <button onClick={cancelEditing}
                      className="h-8 px-3 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-xs font-bold transition-all flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> Cancel
                    </button>
                    <button onClick={handleSave} disabled={isSaving}
                      className="h-8 px-3 rounded-full bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50">
                      {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      {isSaving ? "Saving…" : "Save"}
                    </button>
                  </>
                ) : (
                  <>
                    {pilgrim.isArchived ? (
                      <button onClick={handleRestore} disabled={isRestoring}
                        className="h-8 px-3 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50">
                        {isRestoring ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
                        Restore
                      </button>
                    ) : (
                      <>
                        <button onClick={() => setShowArchiveModal(true)}
                          className="h-8 px-3 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all flex items-center gap-1">
                          <Archive className="w-3 h-3" /> Archive
                        </button>
                        <button onClick={startEditing}
                          className="h-8 px-3 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-xs font-bold transition-all flex items-center gap-1">
                          <Edit3 className="w-3 h-3" /> Edit
                        </button>
                      </>
                    )}
                  </>
                )}
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
                    {pilgrim.packageDate && (
                      <div className="border-t border-[#F1F5F9] px-4 py-2.5 flex items-center justify-between gap-2 bg-emerald-50/20">
                        <div className="flex items-center gap-2">
                          <Plane className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-xs text-[#64748B]">
                            Flight: <strong className="text-emerald-700">{pilgrim.packageDate.airline}</strong> ({pilgrim.packageDate.outboundRoute} ➔ {pilgrim.packageDate.returnRoute})
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/50 px-2 py-0.5 rounded-md shrink-0">
                          {new Date(pilgrim.packageDate.outbound).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} - {new Date(pilgrim.packageDate.returnDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                        </span>
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

                {/* Change Package button */}
                <button onClick={openPackageUpgrade}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#2D3199] hover:bg-[#1C1F66] text-white text-sm font-bold rounded-2xl transition-colors shadow-sm">
                  <ArrowLeftRight className="w-4 h-4" /> Change / Upgrade Package
                </button>

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
                {isEditing && (
                  <div className="flex items-center gap-2 p-3 bg-[#EEF0FF] border border-[#C7CCF5] rounded-xl">
                    <Edit3 className="w-4 h-4 text-[#2D3199]" />
                    <p className="text-xs font-bold text-[#2D3199]">Edit mode active — modify fields below and click Save</p>
                  </div>
                )}
                <DetailSection title="Identity" icon={User} accent="#2D3199">
                  <EditField label="Civility" field="civility" type="select" options={[
                    { value: "Mr", label: "Mr" }, { value: "Mrs", label: "Mrs" },
                    { value: "Miss", label: "Miss" }, { value: "Dr", label: "Dr" },
                  ]}  isEditing={isEditing} value={efVal("civility")} onChange={updateField} />
                  <EditField label="First Name" field="firstName"  isEditing={isEditing} value={efVal("firstName")} onChange={updateField} />
                  <EditField label="Last Name" field="lastName"  isEditing={isEditing} value={efVal("lastName")} onChange={updateField} />
                  <EditField label="Full Name" field="fullName" icon={User} full  isEditing={isEditing} value={efVal("fullName")} onChange={updateField} />
                  <EditField label="Gender" field="gender" type="select" options={[
                    { value: "male", label: "Male" }, { value: "female", label: "Female" },
                  ]}  isEditing={isEditing} value={efVal("gender")} onChange={updateField} />
                  <EditField label="Date of Birth" field="dateOfBirth" type="date" icon={Calendar}  isEditing={isEditing} value={efVal("dateOfBirth")} onChange={updateField} />
                  <EditField label="Place of Birth" field="placeOfBirth"  isEditing={isEditing} value={efVal("placeOfBirth")} onChange={updateField} />
                  <EditField label="Nationality" field="nationality" icon={Globe}  isEditing={isEditing} value={efVal("nationality")} onChange={updateField} />
                  <EditField label="Ethnic Group" field="ethnicGroup"  isEditing={isEditing} value={efVal("ethnicGroup")} onChange={updateField} />
                  <EditField label="Marital Status" field="maritalStatus" type="select" options={[
                    { value: "single", label: "Single" }, { value: "married", label: "Married" },
                    { value: "divorced", label: "Divorced" }, { value: "widowed", label: "Widowed" },
                  ]}  isEditing={isEditing} value={efVal("maritalStatus")} onChange={updateField} />
                  <EditField label="Level of Study" field="levelOfStudy"  isEditing={isEditing} value={efVal("levelOfStudy")} onChange={updateField} />
                  <EditField label="Occupation" field="occupation"  isEditing={isEditing} value={efVal("occupation")} onChange={updateField} />
                </DetailSection>
                <DetailSection title="Contact & Location" icon={Phone} accent="#10B981">
                  <EditField label="Phone (WhatsApp)" field="phone" icon={Phone} fallback={pilgrim.user?.phone}  isEditing={isEditing} value={efVal("phone")} onChange={updateField} />
                  <EditField label="Email" field="email" icon={Mail} full fallback={pilgrim.user?.email}  isEditing={isEditing} value={efVal("email")} onChange={updateField} />
                  <EditField label="Country" field="country" icon={Globe}  isEditing={isEditing} value={efVal("country")} onChange={updateField} />
                  <EditField label="City" field="city" icon={MapPin}  isEditing={isEditing} value={efVal("city")} onChange={updateField} />
                  <EditField label="Address" field="address" icon={MapPin} full type="textarea"  isEditing={isEditing} value={efVal("address")} onChange={updateField} />
                </DetailSection>
                {(isEditing || pilgrim.partner || pilgrim.underCover || pilgrim.observation) && (
                  <DetailSection title="Additional Notes" icon={Badge} accent="#8B5CF6">
                    <EditField label="Partner / Mahram" field="partner"  isEditing={isEditing} value={efVal("partner")} onChange={updateField} />
                    <EditField label="Under Cover" field="underCover"  isEditing={isEditing} value={efVal("underCover")} onChange={updateField} />
                    <EditField label="Observation" field="observation" full type="textarea"  isEditing={isEditing} value={efVal("observation")} onChange={updateField} />
                  </DetailSection>
                )}
              </div>
            )}

            {/* ── TRAVEL TAB ── */}
            {tab === "travel" && (
              <div className="space-y-4">
                <DetailSection title="Passport & Documents" icon={FileText} accent="#FF3B00">
                  <EditField label="Passport Number" field="passportNumber" icon={FileText}  isEditing={isEditing} value={efVal("passportNumber")} onChange={updateField} />
                  <EditField label="Date of Issue" field="passportIssueDate" type="date" icon={Calendar}  isEditing={isEditing} value={efVal("passportIssueDate")} onChange={updateField} />
                  <EditField label="Passport Expiry" field="passportExpiry" type="date" icon={Calendar}  isEditing={isEditing} value={efVal("passportExpiry")} onChange={updateField} />
                  <EditField label="Issuing Authority" field="passportIssuingAuthority"  isEditing={isEditing} value={efVal("passportIssuingAuthority")} onChange={updateField} />
                  <EditField label="Nationality" field="nationality" icon={Globe}  isEditing={isEditing} value={efVal("nationality")} onChange={updateField} />
                  <EditField label="N° Visa" field="visaNumber"  isEditing={isEditing} value={efVal("visaNumber")} onChange={updateField} />
                </DetailSection>

                {/* Document Images with upload in edit mode */}
                {(isEditing || pilgrim.passportCopyUrl || pilgrim.profilePhotoUrl) && (
                <div className="rounded-2xl border border-[#E2E8F0] overflow-hidden">
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#E2E8F0]" style={{ background: "#FF3B0008" }}>
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#FF3B00" }}>
                      <FileText className="w-3 h-3 text-white" />
                    </div>
                    <h4 className="text-xs font-black text-[#0F172A] uppercase tracking-wide">Document Images</h4>
                  </div>
                  <div className="p-4 flex gap-4 flex-wrap">
                    {/* Profile Photo */}
                    <div className="flex flex-col items-center gap-1.5">
                      {(isEditing ? editData.profilePhotoUrl : pilgrim.profilePhotoUrl) ? (
                        <img src={isEditing ? editData.profilePhotoUrl : pilgrim.profilePhotoUrl} alt="Profile Photo"
                             className="w-24 h-28 object-cover rounded-xl border border-[#E2E8F0] shadow-sm" />
                      ) : (
                        <div className="w-24 h-28 rounded-xl border-2 border-dashed border-[#DCE3F0] flex items-center justify-center">
                          <Camera className="w-6 h-6 text-[#94A3B8]" />
                        </div>
                      )}
                      <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest">Profile Photo</p>
                      {isEditing && (
                        <>
                          <input ref={profileInputRef} type="file" accept="image/*" className="hidden" onChange={handleProfilePhotoSelect} />
                          <button onClick={() => profileInputRef.current?.click()}
                            className="text-[10px] font-bold text-[#2D3199] hover:underline flex items-center gap-1">
                            <Camera className="w-3 h-3" /> {editData.profilePhotoUrl ? "Re-crop" : "Upload"}
                          </button>
                        </>
                      )}
                    </div>
                    {/* Passport Copy */}
                    <div className="flex flex-col items-center gap-1.5">
                      {(isEditing ? editData.passportCopyUrl : pilgrim.passportCopyUrl) ? (
                        <img src={isEditing ? editData.passportCopyUrl : pilgrim.passportCopyUrl} alt="Passport Copy"
                             className="w-36 h-28 object-cover rounded-xl border border-[#E2E8F0] shadow-sm" />
                      ) : (
                        <div className="w-36 h-28 rounded-xl border-2 border-dashed border-[#DCE3F0] flex items-center justify-center">
                          <FileText className="w-6 h-6 text-[#94A3B8]" />
                        </div>
                      )}
                      <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest">Passport Copy</p>
                      {isEditing && (
                        <>
                          <input ref={passportInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handlePassportUpload} />
                          <button onClick={() => passportInputRef.current?.click()}
                            className="text-[10px] font-bold text-[#2D3199] hover:underline flex items-center gap-1">
                            <Upload className="w-3 h-3" /> {editData.passportCopyUrl ? "Replace" : "Upload"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                )}

                <DetailSection title="Travel Preferences" icon={Plane} accent="#2D3199">
                  <EditField label="Departure City" field="departureCity" icon={MapPin}  isEditing={isEditing} value={efVal("departureCity")} onChange={updateField} />
                  <EditField label="Room Preference" field="roomPreference" icon={Home}  isEditing={isEditing} value={efVal("roomPreference")} onChange={updateField} />
                  {!isEditing && <DetailField label="Package" value={pilgrim.package?.name} icon={BookOpen} full />}
                </DetailSection>

                {pilgrim.packageDate && (
                  <div className="rounded-2xl border border-emerald-200 overflow-hidden bg-emerald-50/50">
                    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-emerald-200" style={{ background: "rgba(16, 185, 129, 0.08)" }}>
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 bg-emerald-600">
                        <Plane className="w-3.5 h-3.5 text-white" />
                      </div>
                      <h4 className="text-xs font-black text-[#0F172A] uppercase tracking-wide">Flight Schedule</h4>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-4">
                      <DetailField label="Airline" value={pilgrim.packageDate.airline} icon={Plane} />
                      <DetailField label="Outbound Date" value={new Date(pilgrim.packageDate.outbound).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} icon={Calendar} />
                      <DetailField label="Outbound Route" value={pilgrim.packageDate.outboundRoute} icon={MapPin} />
                      <DetailField label="Return Date" value={new Date(pilgrim.packageDate.returnDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} icon={Calendar} />
                      <DetailField label="Return Route" value={pilgrim.packageDate.returnRoute} icon={MapPin} />
                    </div>
                  </div>
                )}
                {(!liveVisa && !pilgrim.visaDeliveryMessage && paidPct < 100) && (
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                      <div>
                        <p className="font-bold text-amber-700 text-sm">Visa Processing Pending</p>
                        <p className="text-amber-600 text-xs mt-1">Awaiting full payment to begin visa processing.</p>
                      </div>
                    </div>
                  </div>
                )}
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
                {(isEditing || pilgrim.partner || pilgrim.underCover) ? (
                  <DetailSection title="Partner / Mahram" icon={UserCheck} accent="#2D3199">
                    <EditField label="Partner / Mahram Name" field="partner" full  isEditing={isEditing} value={efVal("partner")} onChange={updateField} />
                    <EditField label="Under Cover" field="underCover"  isEditing={isEditing} value={efVal("underCover")} onChange={updateField} />
                  </DetailSection>
                ) : null}
                {(isEditing || pilgrim.fathersName || pilgrim.mothersName) ? (
                  <DetailSection title="Family Details" icon={Heart} accent="#8B5CF6">
                    <EditField label="Father's Name" field="fathersName"  isEditing={isEditing} value={efVal("fathersName")} onChange={updateField} />
                    <EditField label="Mother's Name" field="mothersName"  isEditing={isEditing} value={efVal("mothersName")} onChange={updateField} />
                  </DetailSection>
                ) : null}
                {(isEditing || pilgrim.mahramName || pilgrim.mahramRelationship) ? (
                  <DetailSection title="Mahram Details" icon={UserCheck} accent="#2D3199">
                    <EditField label="Mahram Name" field="mahramName"  isEditing={isEditing} value={efVal("mahramName")} onChange={updateField} />
                    <EditField label="Mahram Relationship" field="mahramRelationship"  isEditing={isEditing} value={efVal("mahramRelationship")} onChange={updateField} />
                  </DetailSection>
                ) : null}
                {(isEditing || pilgrim.emergencyContactName) ? (
                  <DetailSection title="Emergency Contact" icon={Phone} accent="#FF3B00">
                    <EditField label="Contact Name" field="emergencyContactName"  isEditing={isEditing} value={efVal("emergencyContactName")} onChange={updateField} />
                    <EditField label="Contact Phone" field="emergencyContactPhone" icon={Phone}  isEditing={isEditing} value={efVal("emergencyContactPhone")} onChange={updateField} />
                  </DetailSection>
                ) : null}
                {!isEditing && !pilgrim.partner && !pilgrim.fathersName && !pilgrim.mothersName && !pilgrim.mahramName && !pilgrim.emergencyContactName && (
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

      {/* ── Profile Photo Crop Dialog ── */}
      <Dialog open={showCropDialog} onOpenChange={() => { /* forced */ }}>
        <DialogContent className="max-w-xl p-0 overflow-hidden bg-white rounded-3xl gap-0 border-0 [&>button]:hidden"
          onInteractOutside={(e: Event) => e.preventDefault()}
          onEscapeKeyDown={(e: KeyboardEvent) => e.preventDefault()}>
          <DialogTitle className="p-5 pb-3 text-lg font-black text-[#0F172A] flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#2D3199]" /> Crop Profile Picture
          </DialogTitle>
          <div className="bg-[#1e293b] border-y border-[#334155] p-4 flex justify-center items-center relative min-h-[300px]">
            {cropImageSrc && (
              <ReactCrop crop={crop} onChange={(_, pc) => setCrop(pc)} aspect={1} className="max-h-[60vh]" keepSelection>
                <img ref={cropImgRef} src={cropImageSrc} alt="Crop" className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-xl"
                  onLoad={() => setCrop({ unit: "%" as const, x: 10, y: 10, width: 80, height: 80 })} />
              </ReactCrop>
            )}
          </div>
          <div className="p-4 bg-white flex items-center justify-end gap-3">
            <button onClick={() => { setShowCropDialog(false); setCropImageSrc(""); }}
              className="h-10 px-4 rounded-xl border border-[#DCE3F0] text-[#64748B] text-sm font-bold hover:bg-[#F8FAFC] transition-colors">Cancel</button>
            <button onClick={handleCropConfirm} disabled={isUploadingPhoto}
              className="h-10 px-6 rounded-xl bg-[#2D3199] hover:bg-[#1C1F66] text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2">
              {isUploadingPhoto ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> : "Confirm Crop"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Package Upgrade Dialog ── */}
      <Dialog open={showPackageUpgrade} onOpenChange={setShowPackageUpgrade}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden rounded-3xl p-0 flex flex-col">
          <DialogTitle className="px-6 pt-6 pb-4 border-b border-[#F1F5F9] font-black text-[#0F172A] flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-[#2D3199]" /> Change / Upgrade Package
          </DialogTitle>
          <div className="px-6 py-2 bg-[#F8F9FF] border-b border-[#E2E8F0]">
            <p className="text-xs text-[#64748B]">Current: <strong className="text-[#0F172A]">{pilgrim.package?.name}</strong> · ₦{pilgrim.totalPrice.toLocaleString()}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {loadingPkgs ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#2D3199]" /></div>
            ) : availablePackages.length === 0 ? (
              <p className="text-sm text-[#94A3B8] text-center py-8">No packages available</p>
            ) : (
              availablePackages.map((pkg: any) => {
                const isCurrent = pkg.id === pilgrim.package?.id;
                const isSelected = pkg.id === selectedNewPkg;
                const diff = Number(pkg.price) - pilgrim.totalPrice;
                return (
                  <button key={pkg.id} onClick={() => !isCurrent && handleSelectNewPackage(pkg.id)}
                    disabled={isCurrent}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                      isCurrent ? "border-[#10B981] bg-emerald-50/50 opacity-70 cursor-default" :
                      isSelected ? "border-[#2D3199] bg-[#F0F2FF] shadow-md" :
                      "border-[#E2E8F0] bg-white hover:border-[#B8C0E8] hover:shadow-sm"
                    }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-[#0F172A] text-sm">{pkg.name}</p>
                        <p className="text-xs text-[#64748B] capitalize mt-0.5">{pkg.type} · {pkg.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-[#0F172A]">₦{Number(pkg.price).toLocaleString()}</p>
                        {!isCurrent && (
                          <p className={`text-[10px] font-bold mt-0.5 ${diff > 0 ? "text-[#FF3B00]" : diff < 0 ? "text-emerald-600" : "text-[#94A3B8]"}`}>
                            {diff > 0 ? `+₦${diff.toLocaleString()} extra` : diff < 0 ? `-₦${Math.abs(diff).toLocaleString()} less` : "Same price"}
                          </p>
                        )}
                        {isCurrent && <p className="text-[10px] font-bold text-emerald-600 mt-0.5">Current Package</p>}
                      </div>
                    </div>
                  </button>
                );
              })
            )}

            {/* Date selection for selected package */}
            {selectedNewPkg && packageDatesForUpgrade.length > 0 && (
              <div className="mt-4 p-4 rounded-2xl bg-[#F8F9FF] border border-[#E2E8F0]">
                <p className="text-xs font-black text-[#94A3B8] uppercase tracking-widest mb-3">Select Flight Date (Optional)</p>
                <div className="space-y-2">
                  <button onClick={() => setSelectedNewDate("")}
                    className={`w-full text-left p-3 rounded-xl border transition-all text-sm ${
                      !selectedNewDate ? "border-[#2D3199] bg-[#EEF0FF] font-bold text-[#2D3199]" : "border-[#DCE3F0] hover:border-[#B8C0E8]"
                    }`}>
                    Keep current flight date / No specific date
                  </button>
                  {packageDatesForUpgrade.map((d: any) => (
                    <button key={d.id} onClick={() => setSelectedNewDate(d.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all text-sm ${
                        selectedNewDate === d.id ? "border-[#2D3199] bg-[#EEF0FF] font-bold text-[#2D3199]" : "border-[#DCE3F0] hover:border-[#B8C0E8]"
                      }`}>
                      <div className="flex justify-between items-center">
                        <span>{d.airline} · {d.outboundRoute}</span>
                        <span className="text-xs text-[#64748B]">{new Date(d.outbound).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Price difference warning */}
            {selectedNewPkg && (() => {
              const newPkg = availablePackages.find((p: any) => p.id === selectedNewPkg);
              if (!newPkg) return null;
              const diff = Number(newPkg.price) - pilgrim.totalPrice;
              if (diff > 0) return (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-700 text-sm">Additional Payment Required</p>
                      <p className="text-xs text-amber-600 mt-1">
                        Upgrading to {newPkg.name} requires an additional payment of <strong>₦{diff.toLocaleString()}</strong>. A pending payment record will be created automatically.
                      </p>
                    </div>
                  </div>
                </div>
              );
              if (diff < 0) return (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />
                    <div>
                      <p className="font-bold text-emerald-700 text-sm">Price Decrease</p>
                      <p className="text-xs text-emerald-600 mt-1">
                        Switching to {newPkg.name} reduces the total by <strong>₦{Math.abs(diff).toLocaleString()}</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              );
              return null;
            })()}
          </div>
          <div className="px-6 pb-5 pt-3 border-t border-[#F1F5F9] flex gap-3">
            <button onClick={() => setShowPackageUpgrade(false)}
              className="flex-1 py-2.5 rounded-xl border border-[#DCE3F0] text-[#64748B] text-sm font-bold hover:bg-[#F8FAFC] transition-colors">Cancel</button>
            <button onClick={handleUpgradeConfirm}
              disabled={!selectedNewPkg || isUpgrading || selectedNewPkg === pilgrim.package?.id}
              className="flex-1 py-2.5 rounded-xl bg-[#2D3199] hover:bg-[#1C1F66] text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {isUpgrading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</> : <><ArrowLeftRight className="w-4 h-4" /> Confirm Change</>}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Archive Dialog ── */}
      <Dialog open={showArchiveModal} onOpenChange={setShowArchiveModal}>
        <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden">
          <div className="p-6 bg-red-50 border-b border-red-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
              <Archive className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-red-900">Archive Pilgrim</DialogTitle>
              <p className="text-xs text-red-700 mt-0.5">This will soft-delete the pilgrim and their payments.</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#0F172A]">Reason for Archiving</Label>
              <Textarea 
                placeholder="e.g. Duplicate booking, mistake entry, etc." 
                value={archiveReason} 
                onChange={e => setArchiveReason(e.target.value)}
                className="min-h-[100px] resize-none"
              />
            </div>
          </div>
          <div className="p-6 pt-0 flex gap-3">
            <button onClick={() => setShowArchiveModal(false)}
              className="flex-1 py-2.5 rounded-xl border border-[#DCE3F0] text-[#64748B] text-sm font-bold hover:bg-[#F8FAFC] transition-colors">Cancel</button>
            <button onClick={handleArchive} disabled={isArchiving || !archiveReason.trim()}
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {isArchiving ? <><Loader2 className="w-4 h-4 animate-spin" /> Archiving…</> : "Confirm Archive"}
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
    "Departure City","Room Preference","Flight Schedule","Agent ID","Registered",
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
    p.packageDate ? `${p.packageDate.airline} (${p.packageDate.outboundRoute} - ${p.packageDate.returnRoute}) [${new Date(p.packageDate.outbound).toLocaleDateString("en-GB")} - ${new Date(p.packageDate.returnDate).toLocaleDateString("en-GB")}]` : "",
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
const PAGE_SIZE = 100;

function FilterCombobox({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: { v: string; l: string }[] }) {
  const [open, setOpen] = useState(false);
  const selectedLabel = value === FILTER_ALL ? placeholder : (options.find(o => o.v === value)?.l || placeholder);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={`flex items-center justify-between h-8 text-xs rounded-lg border w-full px-2.5 ${value !== FILTER_ALL ? "border-[#2D3199] bg-[#EEF0FF] text-[#2D3199] font-bold" : "border-[#DCE3F0] text-[#64748B] bg-white hover:bg-[#F8FAFC] transition-colors"}`}>
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} className="h-9 text-xs" />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-xs text-[#94A3B8]">No results found.</CommandEmpty>
            <CommandGroup>
              <CommandItem value={placeholder} onSelect={() => { onChange(FILTER_ALL); setOpen(false); }} className="text-xs">
                <Check className={`mr-2 h-3.5 w-3.5 ${value === FILTER_ALL ? "opacity-100" : "opacity-0"}`} />
                {placeholder}
              </CommandItem>
              {options.map((option) => (
                <CommandItem key={option.v} value={option.l} onSelect={() => { onChange(option.v); setOpen(false); }} className="text-xs">
                  <Check className={`mr-2 h-3.5 w-3.5 ${value === option.v ? "opacity-100" : "opacity-0"}`} />
                  {option.l}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function AdminPilgrims() {
  const [search, setSearch]               = useState("");
  const [filterStatus, setFilterStatus]   = useState(FILTER_ALL);
  const [filterType, setFilterType]       = useState(FILTER_ALL);
  const [filterPayment, setFilterPayment] = useState(FILTER_ALL);
  const [filterGender, setFilterGender]   = useState(FILTER_ALL);
  const [filterVisa, setFilterVisa]       = useState(FILTER_ALL);
  const [filterAgent, setFilterAgent]     = useState(FILTER_ALL);
  const [filterStaff, setFilterStaff]     = useState(FILTER_ALL);
  const [filterArchived, setFilterArchived] = useState(false);
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

  useEffect(() => { setPage(1); }, [search, filterStatus, filterType, filterPayment, filterGender, filterVisa, filterAgent, filterStaff, filterArchived]);

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
    if (filterArchived)                 p.set("isArchived",    "true");
    return p.toString();
  }, [search, filterStatus, filterType, filterPayment, filterGender, filterVisa, filterAgent, filterStaff, filterArchived, page]);

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

  // Keep the selected dialog updated automatically when background data changes
  useEffect(() => {
    if (selected) {
      const fresh = pilgrims.find(p => p.id === selected.id);
      if (fresh && JSON.stringify(fresh) !== JSON.stringify(selected)) {
        setSelected(fresh);
      }
    }
  }, [pilgrims, selected]);

  const activeFilters = [filterStatus, filterType, filterPayment, filterGender, filterVisa, filterAgent, filterStaff].filter(f => f !== FILTER_ALL).length + (search ? 1 : 0) + (filterArchived ? 1 : 0);

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
    if (filterArchived)                 p.set("isArchived",    "true");
    return p.toString();
  }, [search, filterStatus, filterType, filterPayment, filterGender, filterVisa, filterAgent, filterStaff, filterArchived]);

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
    setFilterStaff(FILTER_ALL); setSearch(""); setFilterArchived(false);
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
              {f.placeholder === "All Agents" || f.placeholder === "All Staff" ? (
                <FilterCombobox value={f.value} onChange={f.onChange} placeholder={f.placeholder} options={f.options} />
              ) : (
                <Select value={f.value} onValueChange={f.onChange}>
                  <SelectTrigger className={`h-8 text-xs rounded-lg border w-full px-2.5 ${f.value !== FILTER_ALL ? "border-[#2D3199] bg-[#EEF0FF] text-[#2D3199] font-bold" : "border-[#DCE3F0] text-[#64748B]"}`}>
                    <SelectValue placeholder={f.placeholder} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value={FILTER_ALL}>{f.placeholder}</SelectItem>
                    {f.options.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}

          <button
            onClick={() => setFilterArchived(!filterArchived)}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-bold transition-all shrink-0 ${
              filterArchived 
                ? "border-red-500 bg-red-50 text-red-700" 
                : "border-[#DCE3F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            Show Archived
          </button>

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
