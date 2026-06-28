import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListPackages, getListPackagesQueryKey, useCreatePackage, useUpdatePackage, useDeletePackage } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Edit2, Trash2, Star, Users, CalendarDays, Package, CheckCircle2,
  TrendingUp, Archive, ArchiveRestore, X, ChevronRight, CreditCard,
  UserCheck, ShieldCheck, ShieldX, BadgeDollarSign, BadgeCheck, BadgeAlert,
  ArrowLeft, Download, Timer,
} from "lucide-react";
import { CountdownBanner, RegistrationClosedBanner } from "@/components/CountdownBanner";
import type { TravelPackage } from "@workspace/api-client-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { GlobalPackageDatesDialog } from "./GlobalPackageDatesDialog";

type PackageForm = {
  name: string; type: "hajj" | "umrah" | "visa_only" | "ticket_only" | "accommodation_only" | "visa_ticket" | "visa_accommodation" | "accommodation_ticket"; description: string; price: string;
  depositAmount: string; durationDays: string; departureDate: string; returnDate: string;
  maxCapacity: string; starRating: string; inclusions: string;
  countdownEnabled: boolean; countdownExpiry: string; countdownAction: "disable" | "both";
};

const emptyForm: PackageForm = {
  name: "", type: "umrah", description: "", price: "", depositAmount: "",
  durationDays: "", departureDate: "", returnDate: "", maxCapacity: "", starRating: "4", inclusions: "",
  countdownEnabled: false, countdownExpiry: "", countdownAction: "disable" as const,
};

function PackageFormDialog({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: TravelPackage }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const createPackage = useCreatePackage();
  const updatePackage = useUpdatePackage();
  const [form, setForm] = useState<PackageForm>(initial ? {
    name: initial.name, type: initial.type, description: initial.description,
    price: String(initial.price), depositAmount: String(initial.depositAmount),
    durationDays: String(initial.durationDays), departureDate: initial.departureDate,
    returnDate: initial.returnDate, maxCapacity: String(initial.maxCapacity),
    starRating: String(initial.starRating), inclusions: initial.inclusions.join("\n"),
    countdownEnabled: initial.countdownEnabled ?? false,
    countdownExpiry: initial.countdownExpiry ?? "",
    countdownAction: (initial.countdownAction ?? "disable") as "disable" | "both",
  } : emptyForm);
  const [pricingOverrides, setPricingOverrides] = useState<{
    roomSurcharges?: Record<string, number | undefined>;
    childPrice?: number;
    infantPrice?: number;
  }>(() => {
    if (initial?.pricingOverrides) {
      try {
        return typeof initial.pricingOverrides === 'string' ? JSON.parse(initial.pricingOverrides) : initial.pricingOverrides;
      } catch { return {}; }
    }
    return {};
  });

  const set = (k: keyof PackageForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: form.name, type: form.type, description: form.description,
      price: Number(form.price), depositAmount: Number(form.depositAmount),
      durationDays: Number(form.durationDays), departureDate: form.departureDate,
      returnDate: form.returnDate, maxCapacity: Number(form.maxCapacity),
      starRating: Number(form.starRating),
      inclusions: form.inclusions.split("\n").map(s => s.trim()).filter(Boolean),
      isActive: true,
      countdownEnabled: form.countdownEnabled,
      countdownExpiry: form.countdownEnabled && form.countdownExpiry ? form.countdownExpiry : null,
      countdownAction: form.countdownAction,
      pricingOverrides: (() => {
        const clean: Record<string, unknown> = {};
        if (pricingOverrides.childPrice != null) clean.childPrice = pricingOverrides.childPrice;
        if (pricingOverrides.infantPrice != null) clean.infantPrice = pricingOverrides.infantPrice;
        const surcharges = pricingOverrides.roomSurcharges;
        if (surcharges) {
          const rs: Record<string, number> = {};
          for (const [k, v] of Object.entries(surcharges)) { if (v != null) rs[k] = v; }
          if (Object.keys(rs).length > 0) clean.roomSurcharges = rs;
        }
        return JSON.stringify(clean);
      })(),
    };
    const opts = {
      onSuccess: () => { toast({ title: initial ? "Package updated" : "Package created" }); qc.invalidateQueries({ queryKey: getListPackagesQueryKey() }); setPricingOverrides({}); onClose(); },
      onError: () => toast({ title: "Error saving package", variant: "destructive" as const }),
    };
    if (initial) updatePackage.mutate({ id: initial.id, data }, opts);
    else createPackage.mutate({ data }, opts);
  };

  const isPending = createPackage.isPending || updatePackage.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
        <DialogTitle className="font-black text-[#0F172A] text-lg">
          {initial ? "Edit Package" : "Create New Package"}
        </DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label className="text-sm font-bold text-[#334155]">Package Name</Label>
              <Input value={form.name} onChange={set("name")} required className="mt-1.5 rounded-xl" placeholder="e.g. Premium Hajj 2026" />
            </div>
            <div>
              <Label className="text-sm font-bold text-[#334155]">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v as any }))}>
                <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hajj">Hajj</SelectItem>
                  <SelectItem value="umrah">Umrah</SelectItem>
                  <SelectItem value="visa_only">Visa Only</SelectItem>
                  <SelectItem value="ticket_only">Ticket Only</SelectItem>
                  <SelectItem value="accommodation_only">Accommodation Only</SelectItem>
                  <SelectItem value="visa_ticket">Visa + Ticket</SelectItem>
                  <SelectItem value="visa_accommodation">Visa + Accommodation</SelectItem>
                  <SelectItem value="accommodation_ticket">Accommodation + Ticket</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-bold text-[#334155]">Star Rating</Label>
              <Select value={form.starRating} onValueChange={(v) => setForm(f => ({ ...f, starRating: v }))}>
                <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[3, 4, 5].map(s => <SelectItem key={s} value={String(s)}>{s} Stars</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-bold text-[#334155]">Price (₦)</Label>
              <Input type="number" value={form.price} onChange={set("price")} required className="mt-1.5 rounded-xl" placeholder="5000000" />
            </div>
            <div>
              <Label className="text-sm font-bold text-[#334155]">Deposit Amount (₦)</Label>
              <Input type="number" value={form.depositAmount} onChange={set("depositAmount")} required className="mt-1.5 rounded-xl" placeholder="500000" />
            </div>
            <div>
              <Label className="text-sm font-bold text-[#334155]">Duration (days)</Label>
              <Input type="number" value={form.durationDays} onChange={set("durationDays")} required className="mt-1.5 rounded-xl" />
            </div>
            <div>
              <Label className="text-sm font-bold text-[#334155]">Max Capacity</Label>
              <Input type="number" value={form.maxCapacity} onChange={set("maxCapacity")} required className="mt-1.5 rounded-xl" />
            </div>
            <div>
              <Label className="text-sm font-bold text-[#334155]">Departure Date</Label>
              <Input type="date" value={form.departureDate} onChange={set("departureDate")} required className="mt-1.5 rounded-xl" />
            </div>
            <div>
              <Label className="text-sm font-bold text-[#334155]">Return Date</Label>
              <Input type="date" value={form.returnDate} onChange={set("returnDate")} required className="mt-1.5 rounded-xl" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-sm font-bold text-[#334155]">Description</Label>
              <Textarea value={form.description} onChange={set("description")} rows={3} required className="mt-1.5 rounded-xl" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-sm font-bold text-[#334155]">Inclusions <span className="text-[#94A3B8] font-normal">(one per line)</span></Label>
              <Textarea value={form.inclusions} onChange={set("inclusions")} rows={5} className="mt-1.5 rounded-xl font-mono text-sm"
                placeholder={"5-Star Hotel Makkah\nReturn Flights\nVisa Processing\nGround Transportation"} />
            </div>

            {/* Countdown Timer */}
            <div className="sm:col-span-2 border border-[#E2E8F0] rounded-2xl p-4 bg-[#FAFBFF]">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-[#FF3B00]" />
                  <Label className="text-sm font-bold text-[#334155] cursor-pointer" htmlFor="countdown-toggle">Countdown Timer</Label>
                </div>
                <Switch
                  id="countdown-toggle"
                  checked={form.countdownEnabled}
                  onCheckedChange={(v) => setForm(f => ({ ...f, countdownEnabled: v }))}
                />
              </div>
              <p className="text-[11px] text-[#94A3B8] mb-3">Show an urgency countdown on all public-facing package cards. Package registration will close when the timer expires.</p>
              {form.countdownEnabled && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-bold text-[#334155]">Countdown Expires</Label>
                    <Input
                      type="datetime-local"
                      value={form.countdownExpiry}
                      onChange={set("countdownExpiry")}
                      className="mt-1.5 rounded-xl"
                      required={form.countdownEnabled}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold text-[#334155]">On Expiry</Label>
                    <Select
                      value={form.countdownAction}
                      onValueChange={(v) => setForm(f => ({ ...f, countdownAction: v as "disable" | "both" }))}
                    >
                      <SelectTrigger className="mt-1.5 rounded-xl text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="disable">Auto-disable package (hide from public listings)</SelectItem>
                        <SelectItem value="both">Show "Registration Closed" badge + hide from listings</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-[#94A3B8] mt-1.5">
                      {form.countdownAction === "both"
                        ? "Pilgrims will see a \"Registration Closed\" notice on this package, then it will be removed from listings."
                        : "Package will be automatically removed from public listings when the timer reaches zero."}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Per-Package Pricing Overrides */}
            <div className="sm:col-span-2 space-y-3 pt-4 border-t border-slate-200">
              <h4 className="text-sm font-semibold text-slate-700">Pricing Overrides (Optional)</h4>
              <p className="text-xs text-slate-500">Leave empty to use global site settings</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600">Child Price (₦)</label>
                  <input
                    type="number"
                    value={pricingOverrides.childPrice ?? ""}
                    onChange={(e) => setPricingOverrides(prev => ({ ...prev, childPrice: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="Global default"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600">Infant Price (₦)</label>
                  <input
                    type="number"
                    value={pricingOverrides.infantPrice ?? ""}
                    onChange={(e) => setPricingOverrides(prev => ({ ...prev, infantPrice: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="Global default"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-600 mb-1 block">Room Surcharges (₦)</label>
                {["Single", "Triple", "Quad", "Sharing"].map(roomType => (
                  <div key={roomType} className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-slate-600 w-20">{roomType}</span>
                    <input
                      type="number"
                      value={pricingOverrides.roomSurcharges?.[roomType] ?? ""}
                      onChange={(e) => setPricingOverrides(prev => ({
                        ...prev,
                        roomSurcharges: {
                          ...prev.roomSurcharges,
                          [roomType]: e.target.value ? Number(e.target.value) : undefined,
                        }
                      }))}
                      placeholder="Global default"
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
            <Button type="submit" className="bg-[#2D3199] hover:bg-[#25297F] rounded-xl font-bold" disabled={isPending}>
              {isPending ? "Saving..." : initial ? "Update Package" : "Create Package"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type PackageStats = { total: number; male: number; female: number; hasPassport: number; noPassport: number; paid: number; partial: number; unpaid: number };
type FilterKey = "total" | "male" | "female" | "passport" | "nopassport" | "paid" | "partial" | "unpaid";

type PilgrimRow = {
  id: string; fullName?: string | null; reference?: string | null; gender?: string | null;
  passportNumber?: string | null; totalPrice: number; amountPaid: number; status: string;
  departureCity?: string | null; nationality?: string | null; phone?: string | null;
  user?: { email: string; fullName: string; phone?: string | null } | null;
};

async function fetchAllPilgrims(packageId: string, filterKey: FilterKey): Promise<PilgrimRow[]> {
  const params = new URLSearchParams({ exportAll: "true" });
  if (filterKey !== "total") params.set("filter", filterKey);
  const r = await fetch(`/api/admin/packages/${packageId}/pilgrims?${params}`);
  const data = await r.json();
  return data.pilgrims ?? [];
}

function getPayLabel(p: PilgrimRow) {
  if (p.totalPrice > 0 && p.amountPaid >= p.totalPrice) return "Fully Paid";
  if (p.amountPaid > 0) return "Partial";
  return "Unpaid";
}

function getPayStatus(p: PilgrimRow) {
  if (p.totalPrice > 0 && p.amountPaid >= p.totalPrice) return "paid";
  if (p.amountPaid > 0) return "partial";
  return "unpaid";
}

function slugify(s: string) {
  return s.replace(/\s+/g, "-").replace(/[^a-z0-9-]/gi, "").toLowerCase();
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const r = await fetch("/logo.png");
    const blob = await r.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

function exportToExcel(pilgrims: PilgrimRow[], label: string, pkgName: string) {
  const data = pilgrims.map((p, i) => ({
    "#": i + 1,
    "Full Name": p.fullName || p.user?.fullName || "",
    "Email": p.user?.email || "",
    "Reference": p.reference || "",
    "Gender": p.gender || "",
    "Nationality": p.nationality || "",
    "Phone": p.phone || p.user?.phone || "",
    "Passport No.": p.passportNumber || "",
    "Total Price (₦)": p.totalPrice,
    "Amount Paid (₦)": p.amountPaid,
    "Payment Status": getPayLabel(p),
    "Booking Status": p.status,
    "Departure City": p.departureCity || "",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const keys = Object.keys(data[0] ?? {});
  ws["!cols"] = keys.map(k => ({
    wch: Math.max(k.length, ...data.map(r => String(r[k as keyof typeof r]).length)) + 2,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, label.slice(0, 31));
  XLSX.writeFile(wb, `${slugify(pkgName)}-${slugify(label)}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

async function exportToPDF(pilgrims: PilgrimRow[], label: string, pkgName: string, isHajj: boolean) {
  const logoDataUrl = await loadLogoDataUrl();

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const primary: [number, number, number] = isHajj ? [45, 49, 153] : [200, 48, 0];
  const dark: [number, number, number]    = isHajj ? [18, 20, 92]  : [100, 20, 0];
  const light: [number, number, number]   = [248, 249, 255];

  const drawHeader = () => {
    doc.setFillColor(...primary);
    doc.rect(0, 0, W, 36, "F");

    doc.setFillColor(...dark);
    doc.rect(0, 0, W, 1, "F");

    if (logoDataUrl) {
      try { doc.addImage(logoDataUrl, "PNG", 8, 5, 24, 24); } catch { /* skip */ }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(17);
    doc.setFont("helvetica", "bold");
    doc.text("RAUDAH TRAVELS & TOURS", 38, 16);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(220, 220, 255);
    doc.text("Pilgrim Export Report  ·  Confidential", 38, 23);

    doc.setFontSize(8);
    doc.setTextColor(200, 200, 255);
    doc.text(`Generated: ${today}`, W - 10, 23, { align: "right" });

    doc.setFillColor(...light);
    doc.roundedRect(0, 38, W, 18, 0, 0, "F");

    doc.setTextColor(...dark);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(pkgName, 10, 48);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 120);
    doc.text(`Filter: ${label}`, 10, 54);
    doc.text(`Total: ${pilgrims.length.toLocaleString()} pilgrim${pilgrims.length !== 1 ? "s" : ""}`, W / 2, 54, { align: "center" });

    const paid   = pilgrims.filter(p => getPayStatus(p) === "paid").length;
    const unpaid = pilgrims.filter(p => getPayStatus(p) === "unpaid").length;
    doc.text(`Paid: ${paid}  ·  Unpaid: ${unpaid}`, W - 10, 54, { align: "right" });
  };

  const drawFooter = (pageNum: number, totalPages: number) => {
    doc.setFillColor(...primary);
    doc.rect(0, H - 10, W, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text("Raudah Travels & Tours  ·  www.raudahtravels.com  ·  Confidential", W / 2, H - 4, { align: "center" });
    doc.text(`Page ${pageNum} of ${totalPages}`, W - 8, H - 4, { align: "right" });
  };

  drawHeader();

  autoTable(doc, {
    startY: 58,
    margin: { left: 8, right: 8, bottom: 15 },
    head: [["#", "Full Name", "Email / Phone", "Reference", "Gender", "Nationality", "Passport No.", "Paid (₦)", "Total (₦)", "Payment", "City"]],
    body: pilgrims.map((p, i) => [
      i + 1,
      p.fullName || p.user?.fullName || "—",
      p.user?.email || p.phone || "—",
      p.reference || "—",
      p.gender ? (p.gender.charAt(0).toUpperCase() + p.gender.slice(1)) : "—",
      p.nationality || "—",
      p.passportNumber || "—",
      Number(p.amountPaid).toLocaleString(),
      Number(p.totalPrice).toLocaleString(),
      getPayLabel(p),
      p.departureCity || "—",
    ]),
    headStyles: {
      fillColor: dark,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
    },
    bodyStyles: { fontSize: 7.5, cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 } },
    alternateRowStyles: { fillColor: light },
    columnStyles: {
      0:  { cellWidth: 8, halign: "center", fontStyle: "bold" },
      1:  { cellWidth: 38 },
      2:  { cellWidth: 45 },
      3:  { cellWidth: 24 },
      4:  { cellWidth: 16, halign: "center" },
      5:  { cellWidth: 22 },
      6:  { cellWidth: 28 },
      7:  { cellWidth: 20, halign: "right" },
      8:  { cellWidth: 20, halign: "right" },
      9:  { cellWidth: 22, halign: "center" },
      10: { cellWidth: "auto" },
    },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 9) {
        const val = String(data.cell.raw ?? "");
        const color: [number, number, number] =
          val === "Fully Paid" ? [5, 150, 105] :
          val === "Partial"    ? [180, 83, 9]  :
                                 [220, 38, 38];
        doc.setTextColor(...color);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        const x = data.cell.x + data.cell.width / 2;
        const y = data.cell.y + data.cell.height / 2 + 2.5;
        doc.text(val, x, y, { align: "center" });
      }
    },
    didDrawPage: (hookData) => {
      const totalPages = (doc.internal as { pages: unknown[] }).pages.length - 1;
      drawFooter(hookData.pageNumber, totalPages);
      if (hookData.pageNumber > 1) {
        drawHeader();
      }
    },
  });

  const totalPages = (doc.internal as { pages: unknown[] }).pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  doc.save(`${slugify(pkgName)}-${slugify(label)}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

const PAGE_SIZE = 50;

function PilgrimFilterView({
  packageId, pkgName, filterKey, filterLabel, count, accentColor, isHajj, onBack,
}: {
  packageId: string; pkgName: string; filterKey: FilterKey; filterLabel: string;
  count: number; accentColor: string; isHajj: boolean; onBack: () => void;
}) {
  const filterParam = filterKey === "total" ? "" : filterKey;
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever the filter changes
  useEffect(() => { setPage(1); }, [filterKey]);

  const { data, isLoading } = useQuery<{ pilgrims: PilgrimRow[]; total: number; totalPages: number }>({
    queryKey: ["pkg-pilgrims", packageId, filterParam, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (filterParam) params.set("filter", filterParam);
      const r = await fetch(`/api/admin/packages/${packageId}/pilgrims?${params}`);
      return r.json();
    },
  });

  const pilgrims    = data?.pilgrims   ?? [];
  const total       = data?.total      ?? count;
  const totalPages  = data?.totalPages ?? 1;
  const rangeStart  = (page - 1) * PAGE_SIZE + 1;
  const rangeEnd    = Math.min(page * PAGE_SIZE, total);

  const handleExcel = async () => {
    setExporting("excel");
    try {
      const all = await fetchAllPilgrims(packageId, filterKey);
      exportToExcel(all, filterLabel, pkgName);
    } finally { setExporting(null); }
  };

  const handlePDF = async () => {
    setExporting("pdf");
    try {
      const all = await fetchAllPilgrims(packageId, filterKey);
      await exportToPDF(all, filterLabel, pkgName, isHajj);
    } finally { setExporting(null); }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Sub-header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E2E8F0] bg-white shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-bold text-[#2D3199] hover:text-[#1C1F66] transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0 mx-1">
          <span className="text-sm font-black text-[#0F172A] truncate">{filterLabel}</span>
          <span className="text-xs font-black px-2 py-0.5 rounded-full text-white shrink-0"
                style={{ background: accentColor }}>{total}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={handleExcel} disabled={isLoading || total === 0 || !!exporting}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-colors disabled:opacity-40">
            {exporting === "excel" ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Download className="w-3 h-3" />}
            Excel
          </button>
          <button onClick={handlePDF} disabled={isLoading || total === 0 || !!exporting}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#FF3B00] hover:bg-[#CC2F00] text-white text-[11px] font-bold rounded-lg transition-colors disabled:opacity-40">
            {exporting === "pdf" ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Download className="w-3 h-3" />}
            PDF
          </button>
        </div>
      </div>

      {/* Paginated list */}
      {isLoading ? (
        <div className="p-4 space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
      ) : pilgrims.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-[#94A3B8]">
          <Users className="w-10 h-10 mb-3 opacity-25" />
          <p className="font-semibold text-sm">No pilgrims match this filter</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto bg-[#F8F9FF] px-4 py-2 space-y-1.5">
          {pilgrims.map((p, idx) => {
            const ps      = getPayStatus(p);
            const name    = p.fullName || p.user?.fullName || "Unknown";
            const initials = name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
            const rowNum  = rangeStart + idx;
            return (
              <div key={p.id ?? idx} className="flex items-center gap-3 bg-white rounded-xl border border-[#E2E8F0] px-3 py-2.5 hover:border-[#2D3199]/30 transition-colors">
                <span className="text-[10px] text-[#CBD5E1] font-bold w-6 shrink-0 text-right">{rowNum}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black text-white"
                     style={{ background: accentColor }}>
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#0F172A] truncate">{name}</p>
                  <p className="text-[10px] text-[#94A3B8] truncate">{p.reference ?? p.user?.email ?? "—"}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {p.gender && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${p.gender === "male" ? "bg-blue-50 text-blue-700" : "bg-pink-50 text-pink-700"}`}>
                      {p.gender === "male" ? "M" : "F"}
                    </span>
                  )}
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${p.passportNumber ? "bg-slate-100 text-slate-600" : "bg-red-50 text-red-600"}`}>
                    {p.passportNumber ? "✓ Passport" : "No Passport"}
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                    ps === "paid" ? "bg-emerald-50 text-emerald-700" : ps === "partial" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"
                  }`}>
                    {ps === "paid" ? "Paid" : ps === "partial" ? "Partial" : "Unpaid"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#E2E8F0] bg-white shrink-0">
          <span className="text-[11px] text-[#64748B]">
            Showing <span className="font-bold text-[#0F172A]">{rangeStart}–{rangeEnd}</span> of <span className="font-bold text-[#0F172A]">{total.toLocaleString()}</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 rounded-lg border border-[#E2E8F0] text-[11px] font-bold text-[#2D3199] disabled:opacity-30 hover:bg-[#F0F2FF] transition-colors"
            >← Prev</button>
            <span className="px-2 text-[11px] font-bold text-[#0F172A]">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1 rounded-lg border border-[#E2E8F0] text-[11px] font-bold text-[#2D3199] disabled:opacity-30 hover:bg-[#F0F2FF] transition-colors"
            >Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PackageStatsDialog({ pkg, onClose }: { pkg: TravelPackage; onClose: () => void }) {
  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null);
  const isHajj = pkg.type === "hajj";
  const accentColor = isHajj ? "#2D3199" : "#FF3B00";

  const { data: stats, isLoading } = useQuery<PackageStats>({
    queryKey: ["pkg-stats", pkg.id],
    queryFn: async () => {
      const r = await fetch(`/api/admin/packages/${pkg.id}/stats`);
      return r.json();
    },
  });

  type StatRow = { key: FilterKey; label: string; value: number; badge: string };
  const statRows: StatRow[] = stats ? [
    { key: "total",      label: "Total number of pilgrims",   value: stats.total,       badge: "bg-[#2D3199]"   },
    { key: "male",       label: "Number of male pilgrims",    value: stats.male,        badge: "bg-blue-500"    },
    { key: "female",     label: "Number of female pilgrims",  value: stats.female,      badge: "bg-pink-500"    },
    { key: "passport",   label: "Passport",                   value: stats.hasPassport, badge: "bg-slate-600"   },
    { key: "nopassport", label: "They don't have a passport.", value: stats.noPassport, badge: "bg-[#FF3B00]"   },
    { key: "unpaid",     label: "No payment has been made.",  value: stats.unpaid,      badge: "bg-red-500"     },
    { key: "partial",    label: "Payment is being made.",     value: stats.partial,     badge: "bg-amber-500"   },
    { key: "paid",       label: "Payment is complete.",       value: stats.paid,        badge: "bg-emerald-500" },
  ] : [];

  const [exportingRowKey, setExportingRowKey] = useState<FilterKey | null>(null);

  const handleRowExportExcel = async (row: StatRow, e: React.MouseEvent) => {
    e.stopPropagation();
    setExportingRowKey(row.key);
    try {
      const pilgrims = await fetchAllPilgrims(pkg.id, row.key);
      exportToExcel(pilgrims, row.label, pkg.name);
    } finally { setExportingRowKey(null); }
  };

  const activeRow = statRows.find(r => r.key === activeFilter);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden rounded-3xl p-0 flex flex-col">
        <DialogTitle className="sr-only">{pkg.name} — Package Stats</DialogTitle>

        {/* ── Gradient header ── */}
        <div className="relative shrink-0 overflow-hidden rounded-t-3xl"
             style={{ background: isHajj ? "linear-gradient(135deg, #12145C 0%, #2D3199 60%, #4C56B8 100%)" : "linear-gradient(135deg, #7C1B00 0%, #C23000 55%, #FF3B00 100%)" }}>
          <div className="absolute -top-4 -right-4 w-28 h-28 rounded-full opacity-[.08] bg-white" />
          <div className="absolute -bottom-8 left-1/3 w-40 h-40 rounded-full opacity-[.04] bg-white" />
          <div className="relative z-10 flex items-center justify-between gap-3 px-5 py-4">
            <div className="flex-1 min-w-0">
              <p className="text-white/55 text-[10px] font-black uppercase tracking-widest mb-1">{pkg.type} Package</p>
              <h2 className="text-lg font-black text-white leading-tight truncate">{pkg.name}</h2>
              <p className="text-white/50 text-xs mt-0.5">
                {new Date(pkg.departureDate).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })}
                {" · "}{pkg.durationDays}d · {pkg.currentBookings}/{pkg.maxCapacity} booked
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {stats && (
                <span className="text-lg font-black text-white bg-white/15 px-3 py-1 rounded-xl border border-white/20">
                  {stats.total}
                </span>
              )}
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {activeFilter && activeRow ? (
            <PilgrimFilterView
              packageId={pkg.id}
              pkgName={pkg.name}
              filterKey={activeFilter}
              filterLabel={activeRow.label}
              count={activeRow.value}
              accentColor={accentColor}
              isHajj={isHajj}
              onBack={() => setActiveFilter(null)}
            />
          ) : (
            <div className="flex-1 overflow-y-auto bg-white">
              {isLoading ? (
                <div className="p-4 space-y-1">
                  {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                </div>
              ) : (
                <div>
                  {statRows.map((row, idx) => (
                    <div key={row.key}>
                      {/* Use div+role to avoid nested-button HTML error */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setActiveFilter(row.key)}
                        onKeyDown={(e) => e.key === "Enter" && setActiveFilter(row.key)}
                        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#F8F9FF] transition-colors group cursor-pointer"
                      >
                        <span className="flex-1 text-sm font-semibold text-[#334155] group-hover:text-[#0F172A] transition-colors select-none">
                          {row.label}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Excel quick-export icon on hover */}
                          <button
                            onClick={(e) => handleRowExportExcel(row, e)}
                            title={`Quick export as Excel`}
                            disabled={exportingRowKey === row.key}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-[#CBD5E1] hover:text-emerald-600 hover:bg-emerald-50 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                          >
                            {exportingRowKey === row.key
                              ? <span className="w-2.5 h-2.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                              : <Download className="w-3 h-3" />}
                          </button>
                          <span className={`text-xs font-black text-white px-2.5 py-0.5 rounded-full min-w-[36px] text-center ${row.badge}`}>
                            {row.value}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-[#CBD5E1] group-hover:text-[#2D3199] transition-colors" />
                        </div>
                      </div>
                      {idx < statRows.length - 1 && <div className="h-px bg-[#F1F5F9] mx-5" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPackages() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useListPackages({}, { query: { queryKey: getListPackagesQueryKey() } });
  const deletePackage = useDeletePackage();
  const updatePackage = useUpdatePackage();
  const [createOpen, setCreateOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const [editing, setEditing] = useState<TravelPackage | null>(null);
  const [statsFor, setStatsFor] = useState<TravelPackage | null>(null);
  const [tab, setTab] = useState<"active" | "archived">("active");

  const allPackages = data?.packages || [];
  const packages = allPackages.filter(p => tab === "archived" ? p.status === "archived" : p.status !== "archived");

  const handleDelete = (id: string) => {
    deletePackage.mutate({ id }, {
      onSuccess: () => { toast({ title: "Package deleted" }); qc.invalidateQueries({ queryKey: getListPackagesQueryKey() }); },
      onError: () => toast({ title: "Could not delete package", variant: "destructive" }),
    });
  };

  const handleArchive = (pkg: TravelPackage) => {
    const isArchived = pkg.status === "archived";
    updatePackage.mutate({ id: pkg.id, data: { status: isArchived ? "active" : "archived", isActive: isArchived } as any }, {
      onSuccess: () => {
        toast({ title: isArchived ? "Package restored" : "Package archived" });
        qc.invalidateQueries({ queryKey: getListPackagesQueryKey() });
      },
      onError: () => toast({ title: "Error updating package", variant: "destructive" }),
    });
  };

  const activeCount   = allPackages.filter(p => p.status !== "archived").length;
  const archivedCount = allPackages.filter(p => p.status === "archived").length;

  return (
    <div className="space-y-6" data-testid="page-admin-packages">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[#2D3199] text-xs font-bold uppercase tracking-widest mb-1">Management</p>
          <h1 className="text-2xl font-black text-[#0F172A]">Packages</h1>
          <p className="text-[#64748B] text-sm mt-0.5">Manage all Hajj & Umrah packages</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={() => setDatesOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#DCE3F0] hover:bg-slate-50 text-[#0F172A] font-bold rounded-2xl transition-colors shrink-0">
            <CalendarDays className="w-4 h-4 text-[#2D3199]" /> Flight Schedules
          </button>
          <button onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#FF3B00] hover:bg-[#E03500] text-white font-bold rounded-2xl transition-colors shadow-[0_4px_16px_rgba(255,59,0,0.3)] shrink-0">
            <Plus className="w-4 h-4" /> New Package
          </button>
        </div>
      </div>

      <PackageFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <GlobalPackageDatesDialog open={datesOpen} onClose={() => setDatesOpen(false)} />
      {editing && <PackageFormDialog open={!!editing} onClose={() => setEditing(null)} initial={editing} />}
      {statsFor && <PackageStatsDialog pkg={statsFor} onClose={() => setStatsFor(null)} />}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Packages",  value: allPackages.length,                                          color: "#2D3199" },
          { label: "Active",          value: activeCount,                                                  color: "#10B981" },
          { label: "Archived",        value: archivedCount,                                                color: "#94A3B8" },
          { label: "Total Capacity",  value: allPackages.filter(p=>p.status!=="archived").reduce((s,p)=>s+p.maxCapacity,0), color: "#F59E0B" },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl border border-[#DCE3F0] p-4 shadow-[0_2px_12px_rgba(45,49,153,0.04)]">
            <p className="text-2xl font-black" style={{ color: stat.color }}>{stat.value.toLocaleString()}</p>
            <p className="text-[#94A3B8] text-xs font-semibold uppercase tracking-widest mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[#F1F5F9] p-1 rounded-2xl w-fit">
        {([
          { id: "active",   label: "Active",   count: activeCount },
          { id: "archived", label: "Archived", count: archivedCount },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
              tab === t.id ? "bg-white text-[#0F172A] shadow-sm" : "text-[#94A3B8] hover:text-[#64748B]"
            }`}>
            {t.id === "archived" && <Archive className="w-3.5 h-3.5" />}
            {t.label}
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
              tab === t.id ? "bg-[#2D3199] text-white" : "bg-[#DCE3F0] text-[#64748B]"
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Package list */}
      {isLoading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>
      ) : packages.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center bg-white rounded-2xl border border-dashed border-[#DCE3F0]">
          <div className="w-16 h-16 rounded-2xl bg-[#EEF0FF] flex items-center justify-center mb-4">
            {tab === "archived" ? <Archive className="w-7 h-7 text-[#2D3199]/40" /> : <Package className="w-7 h-7 text-[#2D3199]/40" />}
          </div>
          <p className="text-[#0F172A] font-bold mb-2">{tab === "archived" ? "No archived packages" : "No packages yet"}</p>
          <p className="text-[#94A3B8] text-sm mb-6">
            {tab === "archived" ? "Archived packages will appear here" : "Create your first Hajj or Umrah package"}
          </p>
          {tab === "active" && (
            <button onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#2D3199] text-white font-bold rounded-xl">
              <Plus className="w-4 h-4" /> Create Package
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {packages.map((pkg) => {
            const fillPct = Math.min(100, (pkg.currentBookings / pkg.maxCapacity) * 100);
            const isHajj = pkg.type === "hajj";
            const isArchived = pkg.status === "archived";
            return (
              <div key={pkg.id}
                className={`bg-white rounded-2xl border shadow-[0_2px_12px_rgba(45,49,153,0.04)] overflow-hidden transition-shadow hover:shadow-[0_4px_24px_rgba(45,49,153,0.1)] ${isArchived ? "border-[#E2E8F0] opacity-75" : "border-[#DCE3F0]"}`}>
                <div className="flex items-stretch">
                  {/* Left accent */}
                  <div className={`w-1.5 shrink-0 ${isArchived ? "bg-[#CBD5E1]" : isHajj ? "bg-[#2D3199]" : "bg-[#FF3B00]"}`} />
                  <div className="flex-1 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Badges */}
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider ${isHajj ? "bg-[#EEF0FF] text-[#2D3199]" : "bg-[#FFF0ED] text-[#FF3B00]"}`}>
                            {pkg.type}
                          </span>
                          {isArchived ? (
                            <span className="text-[10px] px-2.5 py-1 rounded-full font-bold border bg-slate-100 text-slate-500 border-slate-200 flex items-center gap-1">
                              <Archive className="w-2.5 h-2.5" /> Archived
                            </span>
                          ) : (
                            <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${pkg.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                              {pkg.isActive ? "Active" : "Inactive"}
                            </span>
                          )}
                          <div className="flex items-center gap-0.5">
                            {[...Array(pkg.starRating)].map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
                          </div>
                        </div>

                        <h3 className="font-black text-[#0F172A] text-base mb-2">{pkg.name}</h3>

                        {pkg.countdownEnabled && pkg.countdownExpiry && (
                          <div className="mb-3">
                            {pkg.isRegistrationClosed
                              ? <RegistrationClosedBanner variant="card" />
                              : <CountdownBanner expiry={pkg.countdownExpiry} variant="card" onExpired={pkg.countdownAction === "both" ? "show-closed" : "hide"} />}
                          </div>
                        )}

                        <div className="flex items-center gap-5 text-xs text-[#94A3B8] flex-wrap">
                          <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />{new Date(pkg.departureDate).toLocaleDateString("en-GB")}</span>
                          <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{pkg.currentBookings}/{pkg.maxCapacity} booked</span>
                          <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" />{pkg.durationDays} days</span>
                        </div>

                        {/* Capacity bar */}
                        {!isArchived && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <span className="text-[#94A3B8]">Capacity</span>
                              <span className="font-bold" style={{ color: fillPct >= 90 ? "#EF4444" : fillPct >= 70 ? "#F59E0B" : "#10B981" }}>{fillPct.toFixed(0)}% filled</span>
                            </div>
                            <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all"
                                style={{ width: `${fillPct}%`, background: fillPct >= 90 ? "#EF4444" : fillPct >= 70 ? "#F59E0B" : "#10B981" }} />
                            </div>
                          </div>
                        )}

                        {/* Inclusions preview */}
                        {pkg.inclusions.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap mt-3">
                            {pkg.inclusions.slice(0, 3).map((inc, i) => (
                              <span key={i} className="flex items-center gap-1 text-[10px] text-[#64748B] bg-[#F8F9FF] border border-[#DCE3F0] px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> {inc}
                              </span>
                            ))}
                            {pkg.inclusions.length > 3 && <span className="text-[10px] text-[#94A3B8]">+{pkg.inclusions.length - 3} more</span>}
                          </div>
                        )}
                      </div>

                      {/* Right side */}
                      <div className="flex flex-col items-end gap-3 shrink-0">
                        <div className="text-right">
                          <p className="font-black text-[#0F172A] text-xl">₦{Number(pkg.price).toLocaleString()}</p>
                          <p className="text-[#94A3B8] text-xs">per person</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* View stats */}
                          <button onClick={() => setStatsFor(pkg)}
                            className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#EEF0FF] hover:bg-[#E0E3FF] text-[#2D3199] text-xs font-bold transition-colors">
                            <Users className="w-3.5 h-3.5" /> Stats
                          </button>

                          {/* Edit (only non-archived) */}
                          {!isArchived && (
                            <button onClick={() => setEditing(pkg)}
                              className="w-9 h-9 rounded-xl bg-[#F0F2FF] hover:bg-[#EEF0FF] flex items-center justify-center transition-colors">
                              <Edit2 className="w-4 h-4 text-[#2D3199]" />
                            </button>
                          )}

                          {/* Archive / Unarchive */}
                          <button onClick={() => handleArchive(pkg)}
                            title={isArchived ? "Restore package" : "Archive package"}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                              isArchived ? "bg-emerald-50 hover:bg-emerald-100" : "bg-amber-50 hover:bg-amber-100"
                            }`}>
                            {isArchived
                              ? <ArchiveRestore className="w-4 h-4 text-emerald-600" />
                              : <Archive className="w-4 h-4 text-amber-600" />
                            }
                          </button>

                          {/* Delete */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button className="w-9 h-9 rounded-xl bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors">
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-3xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="font-black text-[#0F172A]">Delete package?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently delete "{pkg.name}". This cannot be undone. Consider archiving instead.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(pkg.id)} className="bg-destructive text-destructive-foreground rounded-xl">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
