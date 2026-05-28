import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, CheckSquare, Square, Download, Printer, Tag,
  ChevronLeft, ChevronRight, Loader2, Filter, X, Users,
  Monitor, Smartphone, Layers,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { QRCodeCanvas } from "qrcode.react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Pilgrim {
  id: string;
  idNumber?: number | null;
  reference?: string;
  fullName?: string;
  passportNumber?: string;
  gender?: string;
  nationality?: string;
  departureCity?: string;
  mahramName?: string;
  mahramRelationship?: string;
  package?: { id?: string; name: string; type: string };
  profilePhotoUrl?: string | null;
  user?: { email: string; avatarUrl?: string | null };
}

interface PackageOption { id: string; name: string; type: string; departureDate?: string; }

const SITE = "www.flyraudah.com.ng";
const CARD_W_L = 800, CARD_H_L = 450;
const CARD_W_P = 450, CARD_H_P = 640;
const PDF_BATCH = 12;
const PAGE_LIMIT = 100;

// ─── Nigerian Flag ───────────────────────────────────────────────────────────

function NigerianFlag({ w = 60, h = 40 }: { w?: number; h?: number }) {
  return (
    <svg width={w} height={h} viewBox="0 0 3 2" style={{ display: "block", borderRadius: 3 }}>
      <rect width="1" height="2" fill="#008751" />
      <rect x="1" width="1" height="2" fill="#FFFFFF" />
      <rect x="2" width="1" height="2" fill="#008751" />
    </svg>
  );
}

// ─── Landscape Card (800 × 450) ──────────────────────────────────────────────

function LandscapeCard({ pilgrim }: { pilgrim: Pilgrim }) {
  const parts = (pilgrim.fullName || "").trim().split(/\s+/);
  const firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : (parts[0] || "—");
  const lastName  = parts.length > 1 ? parts[parts.length - 1] : "—";
  const initials  = [parts[0]?.[0], parts[parts.length - 1]?.[0]].filter(Boolean).join("").toUpperCase() || "??";
  const pkgName   = (pilgrim.package?.name || "—").toUpperCase();
  const regNum    = pilgrim.idNumber ? String(pilgrim.idNumber) : (pilgrim.reference || "—");

  const f = (label: string, value: string, fs = 20) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: "#64748B", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, fontFamily: "Arial, sans-serif" }}>{label}</div>
      <div style={{ color: "#0F172A", fontSize: fs, fontWeight: 900, letterSpacing: "0.06em", lineHeight: 1.2, marginTop: 3, fontFamily: "Arial, sans-serif" }}>{value.toUpperCase()}</div>
      <div style={{ height: 1, background: "#CBD5E1", marginTop: 7 }} />
    </div>
  );

  return (
    <div data-pdf-card="landscape" style={{
      width: CARD_W_L, height: CARD_H_L, background: "#FFFFFF",
      display: "flex", flexDirection: "column",
      border: "2px solid #2D3199", borderRadius: 12,
      overflow: "hidden", flexShrink: 0, boxSizing: "border-box",
    }}>
      {/* Header */}
      <div style={{ height: 76, background: "#2D3199", display: "flex", alignItems: "center", padding: "0 18px", gap: 14, flexShrink: 0 }}>
        <div style={{ background: "#FFFFFF", borderRadius: 8, padding: "6px 10px", display: "flex", alignItems: "center", justifyContent: "center", minWidth: 130, height: 54 }}>
          <img src="/logo.png" alt="Raudah" style={{ height: 38, objectFit: "contain", display: "block" }} />
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ color: "#FFFFFF", fontSize: 21, fontWeight: 900, letterSpacing: "0.12em", fontFamily: "Arial, sans-serif", lineHeight: 1 }}>RAUDAH TRAVELS &amp; TOURS</div>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, letterSpacing: "0.2em", marginTop: 5, fontFamily: "Arial, sans-serif", textTransform: "uppercase" as const }}>PILGRIM IDENTIFICATION CARD</div>
        </div>
        <div style={{ border: "2px solid rgba(255,255,255,0.35)", borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
          <NigerianFlag w={60} h={40} />
        </div>
      </div>
      {/* Package strip */}
      <div style={{ height: 38, background: "#EEF0FF", display: "flex", alignItems: "center", justifyContent: "center", borderTop: "1.5px solid #BEC5EE", borderBottom: "1.5px solid #BEC5EE", flexShrink: 0 }}>
        <span style={{ color: "#2D3199", fontSize: 15, fontWeight: 900, letterSpacing: "0.1em", fontFamily: "Arial, sans-serif" }}>{pkgName}</span>
      </div>
      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Photo */}
        <div style={{ width: 178, background: "#F1F3FC", display: "flex", alignItems: "center", justifyContent: "center", borderRight: "1.5px solid #C7CCF0", flexShrink: 0, padding: 14 }}>
          {(pilgrim.profilePhotoUrl || pilgrim.user?.avatarUrl) ? (
            <img src={pilgrim.profilePhotoUrl || pilgrim.user?.avatarUrl || ""} alt="" style={{ width: 142, height: 168, objectFit: "cover", border: "2px solid #2D3199", borderRadius: 4 }} />
          ) : (
            <div style={{ width: 142, height: 168, border: "2px solid #2D3199", borderRadius: 4, background: "linear-gradient(160deg,#2D3199 0%,#1C1F66 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ color: "#FFFFFF", fontSize: 46, fontWeight: 900, fontFamily: "Arial, sans-serif", lineHeight: 1 }}>{initials}</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, letterSpacing: "0.15em", marginTop: 8, fontFamily: "Arial, sans-serif", textTransform: "uppercase" as const }}>NO PHOTO</div>
            </div>
          )}
        </div>
        {/* Fields */}
        <div style={{ flex: 1, padding: "18px 22px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {f("FIRST NAME / NOM", firstName)}
          {f("LAST NAME / PRENOM", lastName)}
          {f("PASSPORT / PASSEPORT", pilgrim.passportNumber || "—", 17)}
          {pilgrim.departureCity && (
            <div>
              <div style={{ color: "#64748B", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, fontFamily: "Arial, sans-serif" }}>DEPARTURE / DÉPART</div>
              <div style={{ color: "#2D3199", fontSize: 14, fontWeight: 800, letterSpacing: "0.06em", marginTop: 3, fontFamily: "Arial, sans-serif" }}>{pilgrim.departureCity.toUpperCase()}</div>
            </div>
          )}
        </div>
        {/* Ref + QR */}
        <div style={{ width: 188, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "14px 16px", borderLeft: "1.5px solid #C7CCF0", flexShrink: 0 }}>
          <div style={{ border: "2.5px solid #0F172A", borderRadius: 8, padding: "7px 16px", textAlign: "center", width: "100%", boxSizing: "border-box" as const }}>
            <div style={{ color: "#64748B", fontSize: 8, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, fontFamily: "Arial, sans-serif" }}>REG NO.</div>
            <div style={{ color: "#FF3B00", fontSize: 24, fontWeight: 900, letterSpacing: "0.06em", lineHeight: 1.1, fontFamily: "Arial, sans-serif" }}>{regNum}</div>
          </div>
          <div style={{ border: "2px solid #0F172A", borderRadius: 6, padding: 5, background: "#FFFFFF" }}>
            <QRCodeCanvas value={`https://${SITE}/verify/${regNum}`} size={118} bgColor="#FFFFFF" fgColor="#0F172A" level="M" />
          </div>
        </div>
      </div>
      {/* Footer */}
      <div style={{ height: 44, background: "#1C1F66", display: "flex", alignItems: "center", padding: "0 20px", flexShrink: 0, borderTop: "2px solid #2D3199" }}>
        <div style={{ width: 8, height: 20, background: "#FF3B00", borderRadius: 2, marginRight: 10, flexShrink: 0 }} />
        <span style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 900, letterSpacing: "0.1em", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, fontFamily: "Arial, sans-serif" }}>PACKAGE : {pkgName}</span>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.08em", fontFamily: "Arial, sans-serif" }}>{SITE}</span>
      </div>
    </div>
  );
}

// ─── Portrait Card (450 × 640) ───────────────────────────────────────────────

function PortraitCard({ pilgrim }: { pilgrim: Pilgrim }) {
  const parts = (pilgrim.fullName || "").trim().split(/\s+/);
  const firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : (parts[0] || "—");
  const lastName  = parts.length > 1 ? parts[parts.length - 1] : "—";
  const initials  = [parts[0]?.[0], parts[parts.length - 1]?.[0]].filter(Boolean).join("").toUpperCase() || "??";
  const pkgName   = (pilgrim.package?.name || "—").toUpperCase();
  const regNum    = pilgrim.idNumber ? String(pilgrim.idNumber) : (pilgrim.reference || "—");
  const partner   = pilgrim.mahramName || "";

  const pf = (label: string, value: string, fs = 16) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: "#64748B", fontSize: 8, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, fontFamily: "Arial, sans-serif" }}>{label}</div>
      <div style={{ color: "#0F172A", fontSize: fs, fontWeight: 900, letterSpacing: "0.06em", lineHeight: 1.2, marginTop: 3, fontFamily: "Arial, sans-serif" }}>{value.toUpperCase()}</div>
      <div style={{ height: 1, background: "#CBD5E1", marginTop: 6 }} />
    </div>
  );

  return (
    <div data-pdf-card="portrait" style={{
      width: CARD_W_P, height: CARD_H_P, background: "#FFFFFF",
      display: "flex", flexDirection: "column",
      border: "2px solid #2D3199", borderRadius: 12,
      overflow: "hidden", flexShrink: 0, boxSizing: "border-box",
    }}>
      {/* Header */}
      <div style={{ background: "#2D3199", padding: "12px 16px", display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{ color: "#FFFFFF", fontSize: 22, fontWeight: 900, letterSpacing: "0.15em", fontFamily: "Arial, sans-serif", lineHeight: 1 }}>RAUDAH</div>
        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 9, letterSpacing: "0.18em", marginTop: 4, fontFamily: "Arial, sans-serif", textTransform: "uppercase" as const }}>TRAVEL AND TOURS LIMITED</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginTop: 10 }}>
          <div style={{ background: "#FFFFFF", borderRadius: 6, padding: "4px 8px", display: "flex", alignItems: "center", justifyContent: "center", height: 44 }}>
            <img src="/logo.png" alt="Raudah" style={{ height: 32, objectFit: "contain", display: "block" }} />
          </div>
          <div style={{ border: "1.5px solid rgba(255,255,255,0.4)", borderRadius: 5, overflow: "hidden" }}>
            <NigerianFlag w={52} h={34} />
          </div>
        </div>
      </div>

      {/* Package name bordered box */}
      <div style={{ padding: "8px 14px", background: "#F8FAFF", borderBottom: "1.5px solid #BEC5EE", flexShrink: 0 }}>
        <div style={{ border: "2px solid #2D3199", borderRadius: 6, padding: "5px 10px", textAlign: "center" }}>
          <span style={{ color: "#2D3199", fontSize: 13, fontWeight: 900, letterSpacing: "0.1em", fontFamily: "Arial, sans-serif" }}>{pkgName}</span>
        </div>
      </div>

      {/* Main body */}
      <div style={{ flex: 1, display: "flex", padding: "14px 14px 10px 14px", gap: 12, overflow: "hidden" }}>
        {/* Left col: photo + reg + QR */}
        <div style={{ width: 128, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {/* Photo */}
          {(pilgrim.profilePhotoUrl || pilgrim.user?.avatarUrl) ? (
            <img src={pilgrim.profilePhotoUrl || pilgrim.user?.avatarUrl || ""} alt="" style={{ width: 114, height: 138, objectFit: "cover", border: "2px solid #2D3199", borderRadius: 4 }} />
          ) : (
            <div style={{ width: 114, height: 138, border: "2px solid #2D3199", borderRadius: 4, background: "linear-gradient(160deg,#2D3199 0%,#1C1F66 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ color: "#FFFFFF", fontSize: 34, fontWeight: 900, fontFamily: "Arial, sans-serif", lineHeight: 1 }}>{initials}</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, letterSpacing: "0.1em", marginTop: 6, fontFamily: "Arial, sans-serif", textTransform: "uppercase" as const }}>NO PHOTO</div>
            </div>
          )}
          {/* Reg number */}
          <div style={{ border: "2px solid #0F172A", borderRadius: 6, padding: "4px 8px", textAlign: "center", width: "100%", boxSizing: "border-box" as const }}>
            <div style={{ color: "#64748B", fontSize: 7, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, fontFamily: "Arial, sans-serif" }}>REG NO.</div>
            <div style={{ color: "#FF3B00", fontSize: 18, fontWeight: 900, letterSpacing: "0.04em", fontFamily: "Arial, sans-serif" }}>{regNum}</div>
          </div>
          {/* QR code */}
          <div style={{ border: "2px solid #0F172A", borderRadius: 5, padding: 4, background: "#FFFFFF" }}>
            <QRCodeCanvas value={`https://${SITE}/verify/${regNum}`} size={96} bgColor="#FFFFFF" fgColor="#0F172A" level="M" />
          </div>
        </div>

        {/* Right col: fields */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-start", paddingTop: 4 }}>
          {pf("FIRST NAME / NOM", firstName)}
          {pf("LAST NAME / PRENOM", lastName)}
          {pf("PASSPORT / PASSEPORT", pilgrim.passportNumber || "—", 14)}
          {pilgrim.departureCity && pf("DEPARTURE / DÉPART", pilgrim.departureCity, 12)}
        </div>
      </div>

      {/* Partner band */}
      <div style={{ background: "#2D3199", padding: "8px 14px", flexShrink: 0 }}>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 8, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, fontFamily: "Arial, sans-serif" }}>PARTNER / PARTENAIRE</div>
        <div style={{ color: "#FFFFFF", fontSize: 14, fontWeight: 900, letterSpacing: "0.06em", marginTop: 2, fontFamily: "Arial, sans-serif" }}>{partner ? partner.toUpperCase() : "—"}</div>
      </div>

      {/* Package footer */}
      <div style={{ background: "#1C1F66", padding: "8px 14px", borderTop: "2px solid #2D3199", flexShrink: 0 }}>
        <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 8, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, fontFamily: "Arial, sans-serif" }}>PACKAGE</div>
        <div style={{ color: "#FFFFFF", fontSize: 13, fontWeight: 900, letterSpacing: "0.08em", marginTop: 2, fontFamily: "Arial, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{pkgName}</div>
        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 8, marginTop: 4, fontFamily: "Arial, sans-serif" }}>{SITE}</div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type CardType = "landscape" | "portrait" | "both";

interface Filters {
  packageId: string;
  gender: string;
  packageType: string;
  departureCity: string;
  departureDateFrom: string;
  departureDateTo: string;
}

const emptyFilters: Filters = {
  packageId: "all", gender: "all", packageType: "all",
  departureCity: "", departureDateFrom: "", departureDateTo: "",
};

function activeFilterCount(f: Filters) {
  return [f.packageId !== "all", f.gender !== "all", f.packageType !== "all",
    !!f.departureCity, !!f.departureDateFrom, !!f.departureDateTo].filter(Boolean).length;
}

export default function AdminIdTags() {
  const { toast } = useToast();

  const [search, setSearch]             = useState("");
  const [filters, setFilters]           = useState<Filters>(emptyFilters);
  const [showFilters, setShowFilters]   = useState(false);
  const [cardType, setCardType]         = useState<CardType>("landscape");
  const [page, setPage]                 = useState(1);
  const [previewMode, setPreviewMode]   = useState(false);

  // Map of id → Pilgrim data (persists across page changes)
  const [selectedMap, setSelectedMap]   = useState<Map<string, Pilgrim>>(new Map());

  const [pdfState, setPdfState] = useState<{
    active: boolean; current: number; total: number; batch: Pilgrim[];
  }>({ active: false, current: 0, total: 0, batch: [] });

  const pdfAreaRef  = useRef<HTMLDivElement>(null);
  const pdfDocRef   = useRef<jsPDF | null>(null);
  const pdfQueueRef = useRef<Pilgrim[]>([]);
  const pdfPageRef  = useRef(0);

  // ── Packages for filter ──────────────────────────────────────────────────
  const { data: pkgsData } = useQuery<{ packages: PackageOption[] }>({
    queryKey: ["id-tags-packages"],
    queryFn: () => fetch("/api/packages?limit=100", { credentials: "include" }).then(r => r.json()),
  });
  const packages = pkgsData?.packages || [];

  // ── Pilgrims list ────────────────────────────────────────────────────────
  const buildParams = useCallback((overrides?: Partial<{ page: number; exportAll: boolean }>) => {
    const p = new URLSearchParams({ status: "confirmed", limit: String(PAGE_LIMIT), page: String(overrides?.page ?? page) });
    if (overrides?.exportAll) { p.set("exportAll", "true"); p.delete("limit"); p.delete("page"); }
    if (search) p.set("search", search);
    if (filters.packageId !== "all")   p.set("packageId", filters.packageId);
    if (filters.gender !== "all")      p.set("gender", filters.gender);
    if (filters.packageType !== "all") p.set("packageType", filters.packageType);
    if (filters.departureCity)         p.set("departureCity", filters.departureCity);
    if (filters.departureDateFrom)     p.set("departureDateFrom", filters.departureDateFrom);
    if (filters.departureDateTo)       p.set("departureDateTo", filters.departureDateTo);
    return p;
  }, [search, filters, page]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-id-tags-pilgrims", search, filters, page],
    queryFn: async () => {
      const r = await fetch(`/api/admin/pilgrims?${buildParams()}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{ pilgrims: Pilgrim[]; total: number; totalPages: number }>;
    },
  });

  const pilgrims   = data?.pilgrims   || [];
  const totalPages = data?.totalPages || 1;
  const total      = data?.total      || 0;

  const resetPage = () => setPage(1);

  // ── Selection ────────────────────────────────────────────────────────────
  const toggleOne = (p: Pilgrim) =>
    setSelectedMap(m => { const n = new Map(m); n.has(p.id) ? n.delete(p.id) : n.set(p.id, p); return n; });

  const togglePage = () => {
    const allOn = pilgrims.every(p => selectedMap.has(p.id));
    setSelectedMap(m => {
      const n = new Map(m);
      if (allOn) pilgrims.forEach(p => n.delete(p.id));
      else pilgrims.forEach(p => n.set(p.id, p));
      return n;
    });
  };

  const selectAllMatching = async () => {
    toast({ title: "Fetching all matching pilgrims…" });
    try {
      const r = await fetch(`/api/admin/pilgrims?${buildParams({ exportAll: true })}`, { credentials: "include" });
      const d = await r.json() as { pilgrims: Pilgrim[] };
      setSelectedMap(m => { const n = new Map(m); d.pilgrims.forEach(p => n.set(p.id, p)); return n; });
      toast({ title: `Selected all ${d.pilgrims.length} matching pilgrims` });
    } catch { toast({ title: "Failed to select all", variant: "destructive" }); }
  };

  const clearSelection = () => setSelectedMap(new Map());

  const allCurrentSelected = pilgrims.length > 0 && pilgrims.every(p => selectedMap.has(p.id));
  const selectedList       = Array.from(selectedMap.values());

  // ── Print ────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (selectedList.length === 0) { toast({ title: "Select at least one pilgrim", variant: "destructive" }); return; }
    const w = window.open("", "_blank");
    if (!w) return;
    const cardsHtml = selectedList.map(p => {
      const parts = (p.fullName || "").trim().split(/\s+/);
      const first = (parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] || "—").toUpperCase();
      const last  = (parts.length > 1 ? parts[parts.length - 1] : "—").toUpperCase();
      const ini   = [parts[0]?.[0], parts[parts.length - 1]?.[0]].filter(Boolean).join("").toUpperCase() || "??";
      const pkg   = (p.package?.name || "—").toUpperCase();
      const reg   = p.idNumber ? String(p.idNumber) : (p.reference || "—");
      const dep   = p.departureCity ? `<div><div style="color:#64748B;font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">DEPARTURE / DÉPART</div><div style="color:#2D3199;font-size:14px;font-weight:800;letter-spacing:0.06em;margin-top:3px;">${p.departureCity.toUpperCase()}</div></div>` : "";
      const depP  = p.departureCity ? `<div style="margin-top:10px;"><div style="color:#64748B;font-size:8px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">DEPARTURE / DÉPART</div><div style="color:#2D3199;font-size:12px;font-weight:800;letter-spacing:0.06em;margin-top:3px;">${p.departureCity.toUpperCase()}</div></div>` : "";
      const portrait = cardType === "portrait" || cardType === "both";
      const landscape = cardType === "landscape" || cardType === "both";
      
      const photoUrl = p.profilePhotoUrl || p.user?.avatarUrl;
      const lPhotoHtml = photoUrl
        ? `<img src="${photoUrl}" style="width:142px;height:168px;object-fit:cover;border:2px solid #2D3199;border-radius:4px;" />`
        : `<div style="width:142px;height:168px;border:2px solid #2D3199;border-radius:4px;background:linear-gradient(160deg,#2D3199,#1C1F66);display:flex;flex-direction:column;align-items:center;justify-content:center;"><div style="color:#fff;font-size:46px;font-weight:900;line-height:1;">${ini}</div><div style="color:rgba(255,255,255,0.4);font-size:9px;letter-spacing:0.15em;margin-top:8px;text-transform:uppercase;">NO PHOTO</div></div>`;
      
      const pPhotoHtml = photoUrl
        ? `<img src="${photoUrl}" style="width:114px;height:138px;object-fit:cover;border:2px solid #2D3199;border-radius:4px;" />`
        : `<div style="width:114px;height:138px;border:2px solid #2D3199;border-radius:4px;background:linear-gradient(160deg,#2D3199,#1C1F66);display:flex;flex-direction:column;align-items:center;justify-content:center;"><div style="color:#fff;font-size:34px;font-weight:900;line-height:1;">${ini}</div><div style="color:rgba(255,255,255,0.4);font-size:8px;letter-spacing:0.1em;margin-top:6px;text-transform:uppercase;">NO PHOTO</div></div>`;

      const lCard = landscape ? `<div style="width:800px;height:450px;border:2px solid #2D3199;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;background:#fff;break-inside:avoid;transform-origin:top left;transform:scale(0.85);margin-bottom:-67px;margin-right:-120px;">
  <div style="height:76px;background:#2D3199;display:flex;align-items:center;padding:0 18px;gap:14px;">
    <div style="background:#fff;border-radius:8px;padding:6px 10px;display:flex;align-items:center;justify-content:center;min-width:130px;height:54px;"><img src="/logo.png" style="height:38px;object-fit:contain;display:block;" /></div>
    <div style="flex:1;text-align:center;"><div style="color:#fff;font-size:21px;font-weight:900;letter-spacing:0.12em;line-height:1;">RAUDAH TRAVELS &amp; TOURS</div><div style="color:rgba(255,255,255,0.55);font-size:10px;letter-spacing:0.2em;margin-top:5px;text-transform:uppercase;">PILGRIM IDENTIFICATION CARD</div></div>
    <div style="border:2px solid rgba(255,255,255,0.35);border-radius:6px;overflow:hidden;"><svg width="60" height="40" viewBox="0 0 3 2" style="display:block;border-radius:3px;"><rect width="1" height="2" fill="#008751"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#008751"/></svg></div>
  </div>
  <div style="height:38px;background:#EEF0FF;display:flex;align-items:center;justify-content:center;border-top:1.5px solid #BEC5EE;border-bottom:1.5px solid #BEC5EE;"><span style="color:#2D3199;font-size:15px;font-weight:900;letter-spacing:0.1em;">${pkg}</span></div>
  <div style="flex:1;display:flex;overflow:hidden;">
    <div style="width:178px;background:#F1F3FC;display:flex;align-items:center;justify-content:center;border-right:1.5px solid #C7CCF0;padding:14px;">
      ${lPhotoHtml}
    </div>
    <div style="flex:1;padding:18px 22px;display:flex;flex-direction:column;justify-content:center;">
      <div style="margin-bottom:10px;"><div style="color:#64748B;font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">FIRST NAME / NOM</div><div style="color:#0F172A;font-size:20px;font-weight:900;margin-top:3px;letter-spacing:0.06em;line-height:1.2;">${first}</div><div style="height:1px;background:#CBD5E1;margin-top:7px;"></div></div>
      <div style="margin-bottom:10px;"><div style="color:#64748B;font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">LAST NAME / PRENOM</div><div style="color:#0F172A;font-size:20px;font-weight:900;margin-top:3px;letter-spacing:0.06em;line-height:1.2;">${last}</div><div style="height:1px;background:#CBD5E1;margin-top:7px;"></div></div>
      <div><div style="color:#64748B;font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">PASSPORT / PASSEPORT</div><div style="color:#0F172A;font-size:17px;font-weight:900;margin-top:3px;letter-spacing:0.06em;line-height:1.2;">${(p.passportNumber || "—").toUpperCase()}</div><div style="height:1px;background:#CBD5E1;margin-top:7px;"></div></div>
      ${dep}
    </div>
    <div style="width:188px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:14px 16px;border-left:1.5px solid #C7CCF0;">
      <div style="border:2.5px solid #0F172A;border-radius:8px;padding:7px 16px;text-align:center;width:100%;box-sizing:border-box;">
        <div style="color:#64748B;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;">REG NO.</div>
        <div style="color:#FF3B00;font-size:24px;font-weight:900;line-height:1.1;letter-spacing:0.06em;">${reg}</div>
      </div>
      <div style="border:2px solid #0F172A;border-radius:6px;padding:5px;background:#fff;"><img src="https://api.qrserver.com/v1/create-qr-code/?size=118x118&data=https://${SITE}/verify/${reg}" width="118" height="118" /></div>
    </div>
  </div>
  <div style="height:44px;background:#1C1F66;display:flex;align-items:center;padding:0 20px;border-top:2px solid #2D3199;">
    <div style="width:8px;height:20px;background:#FF3B00;border-radius:2px;margin-right:10px;flex-shrink:0;"></div>
    <span style="color:#fff;font-size:12px;font-weight:900;letter-spacing:0.1em;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">PACKAGE : ${pkg}</span>
    <span style="color:rgba(255,255,255,0.4);font-size:10px;letter-spacing:0.08em;">${SITE}</span>
  </div>
</div>` : "";

      const pCard = portrait ? `<div style="width:450px;height:640px;border:2px solid #2D3199;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;background:#fff;break-inside:avoid;transform-origin:top left;transform:scale(0.85);margin-bottom:-96px;margin-right:-67px;">
  <div style="background:#2D3199;padding:12px 16px;display:flex;flex-direction:column;align-items:center;">
    <div style="color:#fff;font-size:22px;font-weight:900;letter-spacing:0.15em;line-height:1;">RAUDAH</div>
    <div style="color:rgba(255,255,255,0.7);font-size:9px;letter-spacing:0.18em;margin-top:4px;text-transform:uppercase;">TRAVEL AND TOURS LIMITED</div>
    <div style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-top:10px;">
      <div style="background:#fff;border-radius:6px;padding:4px 8px;height:44px;display:flex;align-items:center;"><img src="/logo.png" style="height:32px;object-fit:contain;display:block;" /></div>
      <div style="border:1.5px solid rgba(255,255,255,0.4);border-radius:5px;overflow:hidden;"><svg width="52" height="34" viewBox="0 0 3 2" style="display:block;border-radius:3px;"><rect width="1" height="2" fill="#008751"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#008751"/></svg></div>
    </div>
  </div>
  <div style="padding:8px 14px;background:#F8FAFF;border-bottom:1.5px solid #BEC5EE;">
    <div style="border:2px solid #2D3199;border-radius:6px;padding:5px 10px;text-align:center;">
      <span style="color:#2D3199;font-size:13px;font-weight:900;letter-spacing:0.1em;">${pkg}</span>
    </div>
  </div>
  <div style="flex:1;display:flex;padding:14px 14px 10px 14px;gap:12px;overflow:hidden;">
    <div style="width:128px;display:flex;flex-direction:column;align-items:center;gap:8px;flex-shrink:0;">
      ${pPhotoHtml}
      <div style="border:2px solid #0F172A;border-radius:6px;padding:4px 8px;text-align:center;width:100%;box-sizing:border-box;">
        <div style="color:#64748B;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;">REG NO.</div>
        <div style="color:#FF3B00;font-size:18px;font-weight:900;letter-spacing:0.04em;">${reg}</div>
      </div>
      <div style="border:2px solid #0F172A;border-radius:5px;padding:4px;background:#fff;"><img src="https://api.qrserver.com/v1/create-qr-code/?size=96x96&data=https://${SITE}/verify/${reg}" width="96" height="96" /></div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:flex-start;padding-top:4px;">
      <div style="margin-bottom:10px;"><div style="color:#64748B;font-size:8px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">FIRST NAME / NOM</div><div style="color:#0F172A;font-size:16px;font-weight:900;margin-top:3px;letter-spacing:0.06em;line-height:1.2;">${first}</div><div style="height:1px;background:#CBD5E1;margin-top:6px;"></div></div>
      <div style="margin-bottom:10px;"><div style="color:#64748B;font-size:8px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">LAST NAME / PRENOM</div><div style="color:#0F172A;font-size:16px;font-weight:900;margin-top:3px;letter-spacing:0.06em;line-height:1.2;">${last}</div><div style="height:1px;background:#CBD5E1;margin-top:6px;"></div></div>
      <div><div style="color:#64748B;font-size:8px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">PASSPORT / PASSEPORT</div><div style="color:#0F172A;font-size:14px;font-weight:900;margin-top:3px;letter-spacing:0.06em;line-height:1.2;">${(p.passportNumber || "—").toUpperCase()}</div><div style="height:1px;background:#CBD5E1;margin-top:6px;"></div></div>
      ${depP}
    </div>
  </div>
  <div style="background:#2D3199;padding:8px 14px;flex-shrink:0;">
    <div style="color:rgba(255,255,255,0.6);font-size:8px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">PARTNER / PARTENAIRE</div>
    <div style="color:#fff;font-size:14px;font-weight:900;margin-top:2px;letter-spacing:0.06em;">${(p.mahramName || "—").toUpperCase()}</div>
  </div>
  <div style="background:#1C1F66;padding:8px 14px;border-top:2px solid #2D3199;flex-shrink:0;">
    <div style="color:rgba(255,255,255,0.55);font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;">PACKAGE</div>
    <div style="color:#fff;font-size:13px;font-weight:900;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:0.08em;">${pkg}</div>
    <div style="color:rgba(255,255,255,0.35);font-size:8px;margin-top:4px;">${SITE}</div>
  </div>
</div>` : "";
      return `<div style="display:flex;gap:32px;flex-wrap:wrap;margin-bottom:32px;break-inside:avoid;">${lCard}${pCard}</div>`;
    }).join("");

    w.document.write(`<!DOCTYPE html><html><head><title>Raudah Pilgrim ID Cards</title>
    <style>*{box-sizing:border-box;margin:0;padding:0;font-family:Arial,sans-serif;}body{background:#fff;padding:8mm;}
    @media print{@page{margin:5mm;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:0;}.no-print{display:none!important;}}</style>
    </head><body>
    <div class="no-print" style="padding:10px;background:#2D3199;color:white;display:flex;align-items:center;gap:12px;margin-bottom:10px;border-radius:6px;">
      <strong>Raudah ID Cards — ${selectedList.length} pilgrim${selectedList.length !== 1 ? "s" : ""} (${cardType})</strong>
      <button onclick="window.print()" style="background:#FF3B00;color:white;border:none;padding:7px 16px;border-radius:5px;font-weight:700;cursor:pointer;">Print / Save PDF</button>
    </div>
    ${cardsHtml}</body></html>`);
    w.document.close();
  };

  // ── Bulk PDF download ────────────────────────────────────────────────────
  const handleBulkPdf = useCallback(async () => {
    if (selectedList.length === 0) { toast({ title: "Select at least one pilgrim", variant: "destructive" }); return; }

    const allCards: Array<{ pilgrim: Pilgrim; type: "landscape" | "portrait" }> = [];
    for (const p of selectedList) {
      if (cardType === "landscape" || cardType === "both") allCards.push({ pilgrim: p, type: "landscape" });
      if (cardType === "portrait"  || cardType === "both") allCards.push({ pilgrim: p, type: "portrait" });
    }

    pdfDocRef.current   = new jsPDF({ orientation: "landscape", unit: "px", format: [CARD_W_L, CARD_H_L] });
    pdfQueueRef.current = selectedList;
    pdfPageRef.current  = 0;
    setPdfState({ active: true, current: 0, total: allCards.length, batch: [] });

    toast({ title: `Generating PDF — ${allCards.length} card${allCards.length !== 1 ? "s" : ""}` });

    await new Promise(r => setTimeout(r, 300));

    try {
      for (let bi = 0; bi < allCards.length; bi += PDF_BATCH) {
        const batch = allCards.slice(bi, bi + PDF_BATCH);
        setPdfState(s => ({ ...s, current: bi, batch: batch.map(b => b.pilgrim) }));
        await new Promise(r => setTimeout(r, 400));

        const cards = pdfAreaRef.current?.querySelectorAll("[data-pdf-card]");
        if (!cards) continue;

        for (let ci = 0; ci < cards.length; ci++) {
          const card     = cards[ci] as HTMLElement;
          const cardKind = card.getAttribute("data-pdf-card") as "landscape" | "portrait";
          const isP      = cardKind === "portrait";
          const W = isP ? CARD_W_P : CARD_W_L;
          const H = isP ? CARD_H_P : CARD_H_L;

          if (pdfPageRef.current > 0) {
            pdfDocRef.current!.addPage([W, H], isP ? "portrait" : "landscape");
          }
          const canvas = await html2canvas(card, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: "#FFFFFF" });
          pdfDocRef.current!.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, W, H);
          pdfPageRef.current++;
        }
        setPdfState(s => ({ ...s, current: bi + batch.length }));
      }

      pdfDocRef.current!.save(`raudah-id-cards-${cardType}.pdf`);
      toast({ title: `✓ Downloaded ${pdfPageRef.current} page${pdfPageRef.current !== 1 ? "s" : ""} as PDF` });
    } catch (e) {
      toast({ title: "PDF generation failed. Try a smaller selection.", variant: "destructive" });
    } finally {
      setPdfState({ active: false, current: 0, total: 0, batch: [] });
    }
  }, [selectedList, cardType, toast]);

  const setF = (k: keyof Filters, v: string) => { setFilters(f => ({ ...f, [k]: v })); resetPage(); };

  // ─── Render ──────────────────────────────────────────────────────────────
  const activeFilters = activeFilterCount(filters);

  return (
    <div className="space-y-5" data-testid="page-admin-id-tags">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-[#2D3199] text-xs font-bold uppercase tracking-widest mb-1">Tools</p>
          <h1 className="text-2xl font-black text-[#0F172A]">ID Tags Generator</h1>
          <p className="text-[#64748B] text-sm mt-0.5">Generate printable landscape &amp; portrait ID cards for confirmed bookings</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button variant="outline" onClick={() => setPreviewMode(v => !v)} className="rounded-xl border-[#DCE3F0] gap-2">
            <Tag className="w-4 h-4" /> {previewMode ? "List View" : "Preview Cards"}
          </Button>
          <Button variant="outline" onClick={handlePrint} disabled={selectedList.length === 0} className="rounded-xl border-[#DCE3F0] gap-2">
            <Printer className="w-4 h-4" /> Print{selectedList.length > 0 ? ` (${selectedList.length})` : ""}
          </Button>
          <Button onClick={handleBulkPdf} disabled={selectedList.length === 0 || pdfState.active}
            className="bg-[#FF3B00] hover:bg-[#D93300] text-white rounded-xl gap-2 font-bold">
            {pdfState.active ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {pdfState.active
              ? `${pdfState.current} / ${pdfState.total} cards…`
              : `Download PDF${selectedList.length > 0 ? ` (${selectedList.length})` : ""}`}
          </Button>
        </div>
      </div>

      {/* ── Card type selector ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider mr-1">Card Type:</span>
        {(["landscape", "portrait", "both"] as CardType[]).map(ct => (
          <button key={ct} onClick={() => setCardType(ct)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${cardType === ct ? "bg-[#2D3199] text-white border-[#2D3199]" : "bg-white text-[#334155] border-[#DCE3F0] hover:border-[#2D3199]"}`}>
            {ct === "landscape" && <Monitor className="w-3.5 h-3.5" />}
            {ct === "portrait"  && <Smartphone className="w-3.5 h-3.5" />}
            {ct === "both"      && <Layers className="w-3.5 h-3.5" />}
            {ct.charAt(0).toUpperCase() + ct.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Search + filter toggle ── */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <Input value={search} onChange={e => { setSearch(e.target.value); resetPage(); }}
            placeholder="Search name, passport, reference…" className="pl-9 rounded-xl border-[#DCE3F0]" />
        </div>
        <Button variant="outline" onClick={() => setShowFilters(v => !v)}
          className={`rounded-xl border-[#DCE3F0] gap-2 ${activeFilters > 0 ? "border-[#2D3199] text-[#2D3199]" : ""}`}>
          <Filter className="w-4 h-4" />
          Filters{activeFilters > 0 ? ` (${activeFilters})` : ""}
        </Button>
        {activeFilters > 0 && (
          <Button variant="outline" onClick={() => { setFilters(emptyFilters); resetPage(); }}
            className="rounded-xl border-[#DCE3F0] gap-1.5 text-[#64748B]">
            <X className="w-3.5 h-3.5" /> Clear
          </Button>
        )}
      </div>

      {/* ── Advanced filters ── */}
      {showFilters && (
        <div className="bg-white border border-[#DCE3F0] rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Package */}
          <div className="col-span-2">
            <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Package</label>
            <Select value={filters.packageId} onValueChange={v => setF("packageId", v)}>
              <SelectTrigger className="mt-1 rounded-xl border-[#DCE3F0] h-9 text-sm"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Packages</SelectItem>
                {packages.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Package Type */}
          <div>
            <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Type</label>
            <Select value={filters.packageType} onValueChange={v => setF("packageType", v)}>
              <SelectTrigger className="mt-1 rounded-xl border-[#DCE3F0] h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="hajj">Hajj</SelectItem>
                <SelectItem value="umrah">Umrah</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Gender */}
          <div>
            <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Gender</label>
            <Select value={filters.gender} onValueChange={v => setF("gender", v)}>
              <SelectTrigger className="mt-1 rounded-xl border-[#DCE3F0] h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Departure City */}
          <div>
            <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Departure City</label>
            <Input value={filters.departureCity} onChange={e => setF("departureCity", e.target.value)}
              placeholder="e.g. Lagos" className="mt-1 rounded-xl border-[#DCE3F0] h-9 text-sm" />
          </div>
          {/* Date From */}
          <div>
            <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Departs From</label>
            <Input type="date" value={filters.departureDateFrom} onChange={e => setF("departureDateFrom", e.target.value)}
              className="mt-1 rounded-xl border-[#DCE3F0] h-9 text-sm" />
          </div>
          {/* Date To */}
          <div>
            <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Departs To</label>
            <Input type="date" value={filters.departureDateTo} onChange={e => setF("departureDateTo", e.target.value)}
              className="mt-1 rounded-xl border-[#DCE3F0] h-9 text-sm" />
          </div>
        </div>
      )}

      {/* ── Count bar + pagination + select-all ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-[#64748B] flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            <span className="font-bold text-[#0F172A]">{total.toLocaleString()}</span> confirmed pilgrim{total !== 1 ? "s" : ""}
          </span>
          {selectedList.length > 0 && (
            <Badge className="bg-[#EEF0FF] text-[#2D3199] border-[#BEC5EE] font-bold hover:bg-[#EEF0FF]">
              {selectedList.length} selected
            </Badge>
          )}
          <Button variant="outline" onClick={togglePage} className="rounded-lg h-8 px-3 text-xs gap-1.5 border-[#DCE3F0]">
            {allCurrentSelected ? <CheckSquare className="w-3.5 h-3.5 text-[#2D3199]" /> : <Square className="w-3.5 h-3.5" />}
            {allCurrentSelected ? "Deselect Page" : "Select Page"}
          </Button>
          {total > PAGE_LIMIT && (
            <Button variant="outline" onClick={selectAllMatching} className="rounded-lg h-8 px-3 text-xs border-[#DCE3F0] text-[#2D3199] font-bold">
              Select All {total.toLocaleString()} Matching
            </Button>
          )}
          {selectedList.length > 0 && (
            <Button variant="ghost" onClick={clearSelection} className="rounded-lg h-8 px-3 text-xs text-[#94A3B8] gap-1">
              <X className="w-3 h-3" /> Clear
            </Button>
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-lg h-8 px-3">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-bold text-[#334155] px-1">Page {page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-lg h-8 px-3">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* ── Preview ── */}
      {previewMode ? (
        selectedList.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#DCE3F0] p-12 text-center">
            <Tag className="w-10 h-10 text-[#CBD5E1] mx-auto mb-3" />
            <p className="font-bold text-[#64748B]">No pilgrims selected</p>
            <p className="text-xs text-[#94A3B8] mt-1">Select pilgrims from the list, then switch to Preview Cards</p>
          </div>
        ) : (
          <div className="space-y-8 overflow-x-auto pb-4">
            {selectedList.map(p => (
              <div key={p.id} className="flex gap-6 flex-wrap items-start">
                {(cardType === "landscape" || cardType === "both") && (
                  <div style={{ transform: "scale(0.75)", transformOrigin: "top left", width: CARD_W_L * 0.75, height: CARD_H_L * 0.75, flexShrink: 0 }}>
                    <LandscapeCard pilgrim={p} />
                  </div>
                )}
                {(cardType === "portrait" || cardType === "both") && (
                  <div style={{ transform: "scale(0.75)", transformOrigin: "top left", width: CARD_W_P * 0.75, height: CARD_H_P * 0.75, flexShrink: 0 }}>
                    <PortraitCard pilgrim={p} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        /* ── List ── */
        <div className="bg-white rounded-2xl border border-[#DCE3F0] overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-[#F8FAFF] rounded-xl animate-pulse" />)}
            </div>
          ) : pilgrims.length === 0 ? (
            <div className="p-12 text-center">
              <Tag className="w-10 h-10 text-[#CBD5E1] mx-auto mb-3" />
              <p className="font-bold text-[#64748B]">No confirmed pilgrims found</p>
              <p className="text-xs text-[#94A3B8] mt-1">Try adjusting your filters or search term</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {pilgrims.map(p => {
                const ini = (p.fullName || "??").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                const isSelected = selectedMap.has(p.id);
                return (
                  <div key={p.id}
                    className={`flex items-center gap-4 px-5 py-3.5 hover:bg-[#F8FAFF] cursor-pointer transition-colors ${isSelected ? "bg-[#EEF0FF]" : ""}`}
                    onClick={() => toggleOne(p)}>
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleOne(p)}
                      className="data-[state=checked]:bg-[#2D3199] data-[state=checked]:border-[#2D3199]" />
                    <div className="h-9 w-9 rounded-full flex-shrink-0 flex items-center justify-center font-black text-sm text-white"
                      style={{ background: "linear-gradient(135deg,#2D3199,#1C1F66)" }}>
                      {ini}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#0F172A] text-sm truncate">{p.fullName || "—"}</p>
                      <p className="text-xs text-[#64748B]">
                        {p.passportNumber || "No passport"} · {p.departureCity || "No city"} · {p.gender || ""}
                      </p>
                    </div>
                    <div className="text-right hidden sm:flex flex-col items-end shrink-0">
                      <p className="text-xs font-bold text-[#2D3199] max-w-[200px] truncate">{p.package?.name || "—"}</p>
                      <p className="text-[10px] font-mono text-[#94A3B8]">
                        #{p.idNumber ?? p.reference ?? "—"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Hidden PDF render area ── */}
      {pdfState.active && (
        <div ref={pdfAreaRef} aria-hidden="true"
          style={{ position: "fixed", top: -19999, left: -19999, zIndex: -1, pointerEvents: "none", display: "flex", flexDirection: "column", gap: 16 }}>
          {pdfState.batch.map(p => (
            <div key={p.id}>
              {(cardType === "landscape" || cardType === "both") && <LandscapeCard pilgrim={p} />}
              {(cardType === "portrait"  || cardType === "both") && <PortraitCard  pilgrim={p} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
