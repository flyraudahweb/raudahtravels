import { useState, useRef, useCallback } from "react";
import { Upload, Loader2, X, CheckCircle2, AlertTriangle, Users, ScanLine, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { uploadFile } from "@/lib/upload";

export interface BatchPilgrim {
  id: string;
  firstName: string;
  lastName: string;
  passportNumber: string;
  passportIssueDate: string;
  passportExpiry: string;
  passportIssuingAuthority: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  passportCopyUrl: string;
  profilePhotoUrl: string;
  
  // Extra fields to match single registration
  phone: string;
  email: string;
  address: string;
  city: string;
  country: string;
  roomPreference: string;
  civility: string;
  maritalStatus: string;
  placeOfBirth: string;
  occupation: string;
  ethnicGroup: string;
  levelOfStudy: string;
  visaNumber: string;
  partner: string;
  underCover: string;
  observation: string;
  departureCity: string;
  packageDateId?: string;

  // Extraction status
  status: "pending" | "extracting" | "done" | "error";
  errorMessage?: string;
}

export type FieldCfgFn = (fieldName: string) => { visible: boolean; required: boolean };

interface Props {
  maxPilgrims?: number;
  onBatchReady: (pilgrims: BatchPilgrim[]) => void;
  onCancel: () => void;
  formConfig?: FieldCfgFn;
  packageDates?: any[];
}

const GENDERS = ["male", "female"];
const NATIONALITIES = ["Nigerian", "Burkinabe", "Nigerien", "Ghanaian", "Senegalese", "Cameroonian", "Other"];

function normalizeDateToISO(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const dmySlash = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmySlash) {
    const [, d, m, y] = dmySlash;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const monthWord = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (monthWord) {
    const [, d, mon, y] = monthWord;
    return `${y}-${months[mon.toLowerCase()] ?? "01"}-${d.padStart(2, "0")}`;
  }
  return trimmed;
}

function normalizeGender(sex: string): string {
  const s = (sex || "").trim().toUpperCase();
  if (s === "M" || s === "MALE") return "male";
  if (s === "F" || s === "FEMALE") return "female";
  return "";
}

// Base64 helper for image validation
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
function getBase64Size(base64Str: string) {
  const base64Len = base64Str.length - (base64Str.indexOf(",") + 1);
  return Math.ceil((base64Len * 3) / 4);
}

export default function BatchPassportUpload({ maxPilgrims = 10, onBatchReady, onCancel, formConfig, packageDates }: Props) {
  const [pilgrims, setPilgrims] = useState<BatchPilgrim[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPilgrim, setSelectedPilgrim] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createBlankPilgrim = (): BatchPilgrim => ({
    id: crypto.randomUUID(),
    firstName: "", lastName: "",
    passportNumber: "", passportIssueDate: "", passportExpiry: "",
    passportIssuingAuthority: "", dateOfBirth: "", gender: "",
    nationality: "Nigerian", passportCopyUrl: "", profilePhotoUrl: "",
    phone: "", email: "", address: "", city: "", country: "Nigeria",
    roomPreference: "Quad", civility: "", maritalStatus: "",
    placeOfBirth: "", occupation: "", ethnicGroup: "", levelOfStudy: "",
    visaNumber: "", partner: "", underCover: "", observation: "",
    departureCity: "",
    packageDateId: "",
    status: "pending",
  });

  const show = (field: string) => {
    if (!formConfig) return true; // Show by default if no config passed
    return formConfig(field).visible !== false;
  };

  const lbl = (field: string, defaultLabel: string) => {
    return formConfig && formConfig(field).required ? `${defaultLabel} *` : defaultLabel;
  };

  const updatePilgrim = useCallback((id: string, updates: Partial<BatchPilgrim>) => {
    setPilgrims(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const removePilgrim = useCallback((id: string) => {
    setPilgrims(prev => prev.filter(p => p.id !== id));
    if (selectedPilgrim === id) setSelectedPilgrim(null);
  }, [selectedPilgrim]);

  // Extract passport data from a single file
  const extractPassport = async (file: File, pilgrimId: string) => {
    updatePilgrim(pilgrimId, { status: "extracting" });
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") resolve(reader.result.split(",")[1]);
          else reject(new Error("Read failed"));
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const passportDataUrl = `data:${file.type};base64,${base64}`;

      // Upload passport image to R2 first — always save regardless of AI
      let passportImageUrl: string;
      try {
        const passportFile = new File([file], `passport-${Date.now()}.${file.type.split('/')[1] || 'jpg'}`, { type: file.type });
        passportImageUrl = await uploadFile(passportFile, "passports");
      } catch {
        passportImageUrl = passportDataUrl; // fallback to data URL
      }

      // Try AI extraction (non-blocking — failure still saves passport)
      let aiResult: any = null;
      let aiFailed = false;
      let aiErrorMsg = "";

      try {
        const res = await fetch("/api/passport/extract", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
        });
        const data = await res.json();
        if (!res.ok) {
          aiFailed = true;
          aiErrorMsg = data.error || "Extraction failed";
        } else if (!data.isAcceptableQuality) {
          aiFailed = true;
          aiErrorMsg = data.rejectionReason || "Image quality issue";
        } else {
          aiResult = data;
        }
      } catch (aiErr: any) {
        aiFailed = true;
        aiErrorMsg = aiErr.message || "Unknown error";
      }

      // Always update with passport URL — AI fields only if extraction succeeded
      updatePilgrim(pilgrimId, {
        status: aiFailed ? "done" : "done",
        firstName: aiResult?.firstName || "",
        lastName: aiResult?.lastName || "",
        passportNumber: aiResult?.documentNumber || "",
        passportIssueDate: normalizeDateToISO(aiResult?.dateOfIssue || ""),
        passportExpiry: normalizeDateToISO(aiResult?.dateOfExpiry || ""),
        passportIssuingAuthority: aiResult?.issuingAuthority || aiResult?.authority || aiResult?.issuingState || "",
        dateOfBirth: normalizeDateToISO(aiResult?.dateOfBirth || ""),
        gender: normalizeGender(aiResult?.sex || ""),
        nationality: aiResult?.nationality || "Nigerian",
        passportCopyUrl: passportImageUrl,
        errorMessage: aiFailed ? `AI: ${aiErrorMsg} — fill details manually` : undefined,
      });
    } catch (err: any) {
      updatePilgrim(pilgrimId, { status: "error", errorMessage: err.message || "Unknown error" });
    }
  };

  // Handle multiple file upload
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files || []);
    if (!rawFiles.length) return;

    // Filter: only images, max 5MB each
    const validFiles: File[] = [];
    const skipped: string[] = [];
    for (const f of rawFiles) {
      if (!f.type.startsWith("image/")) { skipped.push(`${f.name} (not an image)`); continue; }
      if (f.size > MAX_FILE_SIZE) { skipped.push(`${f.name} (exceeds 5MB)`); continue; }
      validFiles.push(f);
    }
    if (skipped.length > 0) {
      alert(`Skipped ${skipped.length} file(s):\n${skipped.join("\n")}`);
    }
    if (!validFiles.length) return;

    const remaining = maxPilgrims - pilgrims.length;
    const toProcess = validFiles.slice(0, remaining);

    if (validFiles.length > remaining) {
      alert(`Maximum ${maxPilgrims} pilgrims. Only the first ${remaining} passport(s) will be processed.`);
    }

    setIsProcessing(true);

    // Create pilgrim entries first
    const newPilgrims = toProcess.map(() => createBlankPilgrim());
    setPilgrims(prev => [...prev, ...newPilgrims]);

    // Process each passport sequentially (to avoid hitting API rate limits)
    for (let i = 0; i < toProcess.length; i++) {
      await extractPassport(toProcess[i], newPilgrims[i].id);
    }

    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const addManualPilgrim = () => {
    if (pilgrims.length >= maxPilgrims) return;
    const p = createBlankPilgrim();
    p.status = "done";
    setPilgrims(prev => [...prev, p]);
    setSelectedPilgrim(p.id);
  };

  const doneCount = pilgrims.filter(p => p.status === "done").length;
  const errorCount = pilgrims.filter(p => p.status === "error").length;
  const extractingCount = pilgrims.filter(p => p.status === "extracting").length;

  const selected = pilgrims.find(p => p.id === selectedPilgrim);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2D3199] to-[#4C56B8] rounded-2xl p-4 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-lg">Batch Registration</h3>
              <span className="px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-bold uppercase tracking-wider">Beta</span>
            </div>
            <p className="text-white/70 text-xs">Upload up to {maxPilgrims} passports for AI extraction</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-2xl font-black">{pilgrims.length}/{maxPilgrims}</p>
            <p className="text-[10px] text-white/70 uppercase tracking-wider">Pilgrims</p>
          </div>
        </div>
      </div>

      {/* Status summary */}
      {pilgrims.length > 0 && (
        <div className="flex gap-2 text-xs font-bold">
          {doneCount > 0 && (
            <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> {doneCount} Ready
            </span>
          )}
          {extractingCount > 0 && (
            <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> {extractingCount} Processing
            </span>
          )}
          {errorCount > 0 && (
            <span className="bg-red-50 text-red-700 px-2.5 py-1 rounded-lg flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {errorCount} Failed
            </span>
          )}
        </div>
      )}

      {/* Upload area */}
      {pilgrims.length < maxPilgrims && (
        <div className="border-2 border-dashed border-[#2D3199]/30 rounded-2xl bg-[#F8FAFF] p-6">
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />
          <div className="flex flex-col items-center gap-3">
            {isProcessing ? (
              <>
                <Loader2 className="w-8 h-8 text-[#2D3199] animate-spin" />
                <p className="text-sm font-bold text-[#0F172A]">Processing passports…</p>
                <p className="text-xs text-[#64748B]">AI is reading each passport. This may take a moment.</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-[#EEF0FF] rounded-2xl flex items-center justify-center">
                  <Upload className="w-6 h-6 text-[#2D3199]" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-black text-[#0F172A]">Upload Passports</p>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Select multiple passport images at once — AI auto-fills all details
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" onClick={() => fileInputRef.current?.click()}
                    className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl gap-2 font-bold">
                    <ScanLine className="w-4 h-4" /> Select Passports
                  </Button>
                  <Button type="button" variant="outline" onClick={addManualPilgrim}
                    className="rounded-xl gap-2 border-[#DCE3F0] text-[#64748B] font-bold">
                    <FileText className="w-4 h-4" /> Add Manually
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Pilgrim list */}
      {pilgrims.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-black text-[#64748B] uppercase tracking-wider">Pilgrims ({pilgrims.length})</Label>
          <div className="divide-y divide-[#F1F5F9] border border-[#E2E8F0] rounded-xl overflow-hidden bg-white">
            {pilgrims.map((p, i) => (
              <div key={p.id}
                onClick={() => setSelectedPilgrim(selectedPilgrim === p.id ? null : p.id)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all hover:bg-[#FAFBFF] ${
                  selectedPilgrim === p.id ? "bg-[#EEF0FF] border-l-4 border-l-[#2D3199]" : ""
                }`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white ${
                  p.status === "done" ? "bg-emerald-500" :
                  p.status === "error" ? "bg-red-500" :
                  p.status === "extracting" ? "bg-blue-500" : "bg-gray-400"
                }`}>
                  {p.status === "extracting" ? <Loader2 className="w-4 h-4 animate-spin" /> :
                   p.status === "done" ? <CheckCircle2 className="w-4 h-4" /> :
                   p.status === "error" ? <AlertTriangle className="w-4 h-4" /> :
                   i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#0F172A] truncate">
                    {p.firstName || p.lastName ? `${p.firstName} ${p.lastName}`.trim() : `Pilgrim ${i + 1}`}
                  </p>
                  <p className="text-[10px] text-[#94A3B8]">
                    {p.passportNumber ? `Passport: ${p.passportNumber}` :
                     p.status === "extracting" ? "Extracting…" :
                     p.status === "error" ? p.errorMessage : "No passport data"}
                  </p>
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); removePilgrim(p.id); }}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-[#94A3B8] hover:bg-red-50 hover:text-red-500 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inline edit panel for selected pilgrim */}
      {selected && (
        <div className="border border-[#2D3199]/20 rounded-2xl bg-[#FAFBFF] p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-[#1C1F66]">
              Edit: {selected.firstName || selected.lastName ? `${selected.firstName} ${selected.lastName}`.trim() : "Pilgrim Details"}
            </h4>
            <button type="button" onClick={() => setSelectedPilgrim(null)}
              className="text-xs text-[#94A3B8] hover:text-[#64748B] font-bold">Done</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* Personal Details */}
            <div className="col-span-2 mt-2">
              <p className="text-xs font-black text-[#2D3199] border-b border-[#2D3199]/10 pb-1 mb-3">Personal Details</p>
            </div>
            {show("civility") && (
              <div>
                <Label className="text-[10px] font-bold text-[#64748B] uppercase">{lbl("civility", "Title")}</Label>
                <Select value={selected.civility} onValueChange={v => updatePilgrim(selected.id, { civility: v })}>
                  <SelectTrigger className="rounded-xl h-10 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {["Mr", "Mrs", "Miss", "Alhaji", "Hajiya", "Imam", "Dr", "Prof"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-[10px] font-bold text-[#64748B] uppercase">First Name *</Label>
              <Input value={selected.firstName} onChange={e => updatePilgrim(selected.id, { firstName: e.target.value })}
                placeholder="First name" className="rounded-xl h-10 text-sm" />
            </div>
            <div>
              <Label className="text-[10px] font-bold text-[#64748B] uppercase">Last Name *</Label>
              <Input value={selected.lastName} onChange={e => updatePilgrim(selected.id, { lastName: e.target.value })}
                placeholder="Last name" className="rounded-xl h-10 text-sm" />
            </div>
            <div>
              <Label className="text-[10px] font-bold text-[#64748B] uppercase">Date of Birth</Label>
              <Input type="date" value={selected.dateOfBirth} onChange={e => updatePilgrim(selected.id, { dateOfBirth: e.target.value })}
                className="rounded-xl h-10 text-sm" />
            </div>
            <div>
              <Label className="text-[10px] font-bold text-[#64748B] uppercase">Gender</Label>
              <Select value={selected.gender} onValueChange={v => updatePilgrim(selected.id, { gender: v })}>
                <SelectTrigger className="rounded-xl h-10 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{GENDERS.map(g => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {show("maritalStatus") && (
              <div>
                <Label className="text-[10px] font-bold text-[#64748B] uppercase">{lbl("maritalStatus", "Marital Status")}</Label>
                <Select value={selected.maritalStatus} onValueChange={v => updatePilgrim(selected.id, { maritalStatus: v })}>
                  <SelectTrigger className="rounded-xl h-10 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {["Single", "Married", "Divorced", "Widowed"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {show("placeOfBirth") && (
              <div>
                <Label className="text-[10px] font-bold text-[#64748B] uppercase">{lbl("placeOfBirth", "Place of Birth")}</Label>
                <Input value={selected.placeOfBirth} onChange={e => updatePilgrim(selected.id, { placeOfBirth: e.target.value })}
                  placeholder="City / State" className="rounded-xl h-10 text-sm" />
              </div>
            )}
            {show("ethnicGroup") && (
              <div>
                <Label className="text-[10px] font-bold text-[#64748B] uppercase">{lbl("ethnicGroup", "Ethnic Group")}</Label>
                <Input value={selected.ethnicGroup} onChange={e => updatePilgrim(selected.id, { ethnicGroup: e.target.value })}
                  placeholder="e.g. Hausa, Yoruba…" className="rounded-xl h-10 text-sm" />
              </div>
            )}
            {show("levelOfStudy") && (
              <div>
                <Label className="text-[10px] font-bold text-[#64748B] uppercase">{lbl("levelOfStudy", "Level of Study")}</Label>
                <Input value={selected.levelOfStudy} onChange={e => updatePilgrim(selected.id, { levelOfStudy: e.target.value })}
                  placeholder="e.g. BSc, MSc…" className="rounded-xl h-10 text-sm" />
              </div>
            )}
            {show("partner") && (
              <div className="col-span-2">
                <Label className="text-[10px] font-bold text-[#64748B] uppercase">{lbl("partner", "Partner / Mahram")}</Label>
                <Input value={selected.partner} onChange={e => updatePilgrim(selected.id, { partner: e.target.value })}
                  placeholder="Partner / Mahram name" className="rounded-xl h-10 text-sm" />
              </div>
            )}
            {show("underCover") && (
              <div className="col-span-2">
                <Label className="text-[10px] font-bold text-[#64748B] uppercase">{lbl("underCover", "Under Cover")}</Label>
                <Input value={selected.underCover} onChange={e => updatePilgrim(selected.id, { underCover: e.target.value })}
                  placeholder="e.g. RAUDAH FUNTUA" className="rounded-xl h-10 text-sm" />
              </div>
            )}
            {show("observation") && (
              <div className="col-span-2">
                <Label className="text-[10px] font-bold text-[#64748B] uppercase">{lbl("observation", "Observation")}</Label>
                <Input value={selected.observation} onChange={e => updatePilgrim(selected.id, { observation: e.target.value })}
                  placeholder="Any special needs or notes" className="rounded-xl h-10 text-sm" />
              </div>
            )}
            {packageDates && packageDates.length > 0 && (
              <div className="col-span-2">
                <Label className="text-[10px] font-bold text-[#64748B] uppercase">Flight Schedule</Label>
                <Select value={selected.packageDateId} onValueChange={v => updatePilgrim(selected.id, { packageDateId: v })}>
                  <SelectTrigger className="rounded-xl h-10 text-sm"><SelectValue placeholder="Select flight schedule" /></SelectTrigger>
                  <SelectContent>
                    {[...packageDates].sort((a: any, b: any) => new Date(a.outbound).getTime() - new Date(b.outbound).getTime()).map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        {new Date(d.outbound).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} - {new Date(d.returnDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} ({d.outboundRoute} | {d.returnRoute}) via {d.airline}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Passport & Identity */}
            <div className="col-span-2 mt-4">
              <p className="text-xs font-black text-[#2D3199] border-b border-[#2D3199]/10 pb-1 mb-3">Passport & Identity</p>
            </div>
            <div>
              <Label className="text-[10px] font-bold text-[#64748B] uppercase">Passport No. *</Label>
              <Input value={selected.passportNumber} onChange={e => updatePilgrim(selected.id, { passportNumber: e.target.value })}
                placeholder="A00000000" className="rounded-xl h-10 text-sm font-mono" />
            </div>
            <div>
              <Label className="text-[10px] font-bold text-[#64748B] uppercase">Nationality</Label>
              <Select value={selected.nationality} onValueChange={v => updatePilgrim(selected.id, { nationality: v })}>
                <SelectTrigger className="rounded-xl h-10 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{NATIONALITIES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] font-bold text-[#64748B] uppercase">Passport Issue</Label>
              <Input type="date" value={selected.passportIssueDate} onChange={e => updatePilgrim(selected.id, { passportIssueDate: e.target.value })}
                className="rounded-xl h-10 text-sm" />
            </div>
            <div>
              <Label className="text-[10px] font-bold text-[#64748B] uppercase">Passport Expiry *</Label>
              <Input type="date" value={selected.passportExpiry} onChange={e => updatePilgrim(selected.id, { passportExpiry: e.target.value })}
                className="rounded-xl h-10 text-sm" />
            </div>
            <div className="col-span-2">
              <Label className="text-[10px] font-bold text-[#64748B] uppercase">Issuing Authority</Label>
              <Input value={selected.passportIssuingAuthority} onChange={e => updatePilgrim(selected.id, { passportIssuingAuthority: e.target.value })}
                placeholder="e.g. Immigration" className="rounded-xl h-10 text-sm" />
            </div>
            {show("visaNumber") && (
              <div>
                <Label className="text-[10px] font-bold text-[#64748B] uppercase">{lbl("visaNumber", "N° Visa")}</Label>
                <Input value={selected.visaNumber} onChange={e => updatePilgrim(selected.id, { visaNumber: e.target.value })}
                  placeholder="Visa number" className="rounded-xl h-10 text-sm font-mono" />
              </div>
            )}
            <div className="col-span-2 flex flex-col gap-4 mt-2 border-t border-[#F1F5F9] pt-4">
              {show("passportCopyUrl") && (
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label className="text-[10px] font-bold text-[#64748B] uppercase">{lbl("passportCopyUrl", "Passport Copy")}</Label>
                    <Input type="file" accept="image/*,.pdf" onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > MAX_FILE_SIZE) { alert("File exceeds 5MB"); return; }
                      try {
                        const url = await uploadFile(file, "passports");
                        updatePilgrim(selected.id, { passportCopyUrl: url });
                      } catch {
                        // Fallback to base64 if R2 upload fails
                        const base64 = await new Promise<string>((resolve) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve(reader.result as string);
                          reader.readAsDataURL(file);
                        });
                        updatePilgrim(selected.id, { passportCopyUrl: base64 });
                      }
                    }} className="rounded-xl text-xs cursor-pointer bg-white file:bg-[#EEF0FF] file:text-[#2D3199] file:font-bold file:border-0 file:rounded-lg file:mr-2 file:px-2 file:py-1" />
                  </div>
                  {selected.passportCopyUrl && (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden border border-[#DCE3F0]">
                      {selected.passportCopyUrl.startsWith("data:image") ? (
                        <img src={selected.passportCopyUrl} alt="Passport" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[8px] font-bold text-gray-500">PDF</span>
                      )}
                    </div>
                  )}
                </div>
              )}
              {show("profilePhotoUrl") && (
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label className="text-[10px] font-bold text-[#64748B] uppercase">{lbl("profilePhotoUrl", "Profile Photo (Passport size)")}</Label>
                    <Input type="file" accept="image/*" onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > MAX_FILE_SIZE) { alert("Photo exceeds 5MB"); return; }
                      try {
                        const url = await uploadFile(file, "photos");
                        updatePilgrim(selected.id, { profilePhotoUrl: url });
                      } catch {
                        // Fallback to base64 if R2 upload fails
                        const base64 = await new Promise<string>((resolve) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve(reader.result as string);
                          reader.readAsDataURL(file);
                        });
                        updatePilgrim(selected.id, { profilePhotoUrl: base64 });
                      }
                    }} className="rounded-xl text-xs cursor-pointer bg-white file:bg-[#EEF0FF] file:text-[#2D3199] file:font-bold file:border-0 file:rounded-lg file:mr-2 file:px-2 file:py-1" />
                  </div>
                  {selected.profilePhotoUrl && (
                    <img src={selected.profilePhotoUrl} alt="Profile" className="w-12 h-12 rounded-full object-cover border border-[#DCE3F0]" />
                  )}
                </div>
              )}
            </div>

            {/* Contacts & Address */}
            <div className="col-span-2 mt-4">
              <p className="text-xs font-black text-[#2D3199] border-b border-[#2D3199]/10 pb-1 mb-3">Contacts & Address</p>
            </div>
            {show("phone") && (
              <div>
                <Label className="text-[10px] font-bold text-[#64748B] uppercase">{lbl("phone", "Phone Number")}</Label>
                <Input value={selected.phone} onChange={e => updatePilgrim(selected.id, { phone: e.target.value })}
                  placeholder="Phone" className="rounded-xl h-10 text-sm" />
              </div>
            )}
            {show("email") && (
              <div>
                <Label className="text-[10px] font-bold text-[#64748B] uppercase">{lbl("email", "Email")}</Label>
                <Input type="email" value={selected.email} onChange={e => updatePilgrim(selected.id, { email: e.target.value })}
                  placeholder="Email address" className="rounded-xl h-10 text-sm" />
              </div>
            )}
            {show("occupation") && (
              <div className="col-span-2">
                <Label className="text-[10px] font-bold text-[#64748B] uppercase">{lbl("occupation", "Occupation")}</Label>
                <Input value={selected.occupation} onChange={e => updatePilgrim(selected.id, { occupation: e.target.value })}
                  placeholder="e.g. Teacher, Farmer…" className="rounded-xl h-10 text-sm" />
              </div>
            )}
            {show("country") && (
              <div>
                <Label className="text-[10px] font-bold text-[#64748B] uppercase">{lbl("country", "Country")}</Label>
                <Input value={selected.country} onChange={e => updatePilgrim(selected.id, { country: e.target.value })}
                  placeholder="Nigeria" className="rounded-xl h-10 text-sm" />
              </div>
            )}
            {show("city") && (
              <div>
                <Label className="text-[10px] font-bold text-[#64748B] uppercase">{lbl("city", "City")}</Label>
                <Input value={selected.city} onChange={e => updatePilgrim(selected.id, { city: e.target.value })}
                  placeholder="City of residence" className="rounded-xl h-10 text-sm" />
              </div>
            )}
            {show("address") && (
              <div className="col-span-2">
                <Label className="text-[10px] font-bold text-[#64748B] uppercase">{lbl("address", "Full Address")}</Label>
                <Input value={selected.address} onChange={e => updatePilgrim(selected.id, { address: e.target.value })}
                  placeholder="Residential address" className="rounded-xl h-10 text-sm" />
              </div>
            )}
            {show("roomPreference") && (
              <div className="col-span-2">
                <Label className="text-[10px] font-bold text-[#64748B] uppercase">{lbl("roomPreference", "Room Preference")}</Label>
                <Select value={selected.roomPreference} onValueChange={v => updatePilgrim(selected.id, { roomPreference: v })}>
                  <SelectTrigger className="rounded-xl h-10 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {["Single", "Double", "Triple", "Quad", "Quint"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {show("departureCity") && (
              <div className="col-span-2">
                <Label className="text-[10px] font-bold text-[#64748B] uppercase">{lbl("departureCity", "Departure City")}</Label>
                <Select value={selected.departureCity} onValueChange={v => updatePilgrim(selected.id, { departureCity: v })}>
                  <SelectTrigger className="rounded-xl h-10 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {["Lagos", "Abuja", "Kano", "Port Harcourt", "Ibadan", "Enugu"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {selected.status === "error" && (
            <p className="text-xs text-red-600 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {selected.errorMessage} — Please fill in the details manually.
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}
          className="rounded-xl border-[#DCE3F0] text-[#64748B] font-bold h-11 flex-1">
          Cancel
        </Button>
        <Button type="button" disabled={(doneCount + errorCount) === 0 || extractingCount > 0}
          onClick={() => {
            // Validate: each ready pilgrim needs at least first+last name
            const ready = pilgrims.filter(p => p.status === "done" || p.status === "error");
            const invalid = ready.filter(p => !p.firstName.trim() || !p.lastName.trim());
            if (invalid.length > 0) {
              setSelectedPilgrim(invalid[0].id);
              alert(`Please fill in the name for all pilgrims. ${invalid.length} pilgrim(s) are missing names.`);
              return;
            }
            // Validate passport copy
            const noPassport = ready.filter(p => !p.passportCopyUrl);
            if (noPassport.length > 0) {
              setSelectedPilgrim(noPassport[0].id);
              alert(`${noPassport.length} pilgrim(s) are missing a passport copy. Please upload passport documents for all pilgrims.`);
              return;
            }
            // Validate profile photo
            const noPhoto = ready.filter(p => !p.profilePhotoUrl);
            if (noPhoto.length > 0) {
              setSelectedPilgrim(noPhoto[0].id);
              alert(`${noPhoto.length} pilgrim(s) are missing a profile photo. Please upload profile photos for all pilgrims.`);
              return;
            }
            // Check passport expiry for each pilgrim
            const expired = ready.filter(p => {
              if (!p.passportExpiry) return false;
              return new Date(p.passportExpiry) < new Date();
            });
            if (expired.length > 0) {
              setSelectedPilgrim(expired[0].id);
              alert(`${expired.length} pilgrim(s) have expired passports. Please update before continuing.`);
              return;
            }
            onBatchReady(ready);
          }}
          className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl font-black h-11 flex-1 gap-2 shadow-md">
          <CheckCircle2 className="w-4 h-4" />
          Continue with {doneCount + errorCount} Pilgrim{doneCount + errorCount !== 1 ? "s" : ""}
        </Button>
      </div>
    </div>
  );
}
