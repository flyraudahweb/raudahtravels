import { useRef, useState } from "react";
import { ScanLine, Loader2, CheckCircle2, AlertTriangle, X, PenLine, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface PassportScanResult {
  firstName?: string;
  lastName?: string;
  passportNumber?: string;
  passportIssueDate?: string;
  passportExpiry?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  passportImageDataUrl?: string;
}

interface Props {
  onExtracted: (data: PassportScanResult) => void;
  onProfilePhoto?: (dataUrl: string) => void;
  compact?: boolean;
}

type Status = "idle" | "loading" | "done" | "error" | "dismissed";

interface ErrorInfo {
  headline: string;
  detail: string;
  canRetry: boolean;
}

function classifyError(msg: string): ErrorInfo {
  const m = msg.toLowerCase();
  if (m.includes("admin") || m.includes("unauthorized") || m.includes("403")) {
    return {
      headline: "Access denied",
      detail: "OCR feature is available for agents and pilgrims. Please contact support if you need assistance.",
      canRetry: false,
    };
  }
  if (m.includes("quota") || m.includes("resource_exhausted") || m.includes("429") || m.includes("credits") || m.includes("rate limit")) {
    return {
      headline: "AI quota reached",
      detail: "The AI provider's quota has been reached. Ask your admin to switch providers in Settings → AI Integration, or fill in the details manually.",
      canRetry: false,
    };
  }
  if (m.includes("503") || m.includes("overload") || m.includes("unavailable") || m.includes("model unavailable")) {
    return {
      headline: "AI service temporarily unavailable",
      detail: "The AI service is busy right now. You can retry in a moment or fill in the details manually below.",
      canRetry: true,
    };
  }
  if (m.includes("not configured") || m.includes("api key")) {
    return {
      headline: "AI key not configured",
      detail: "Ask your admin to add an API key in Admin → Settings → AI Integration. Fill in the details manually for now.",
      canRetry: false,
    };
  }
  if (m.includes("invalid") && m.includes("key")) {
    return {
      headline: "Invalid AI API key",
      detail: "The stored key is invalid. Ask your admin to update it in Settings → AI Integration. Fill in the details manually.",
      canRetry: false,
    };
  }
  if (m.includes("quality") || m.includes("blurry") || m.includes("cropped") || m.includes("glare")) {
    return {
      headline: "Image quality too low",
      detail: msg,
      canRetry: true,
    };
  }
  if (m.includes("failed to fetch") || (m.includes("network") && !m.includes("gemini"))) {
    return {
      headline: "Network error",
      detail: "Check your internet connection and try again, or fill in the details manually below.",
      canRetry: true,
    };
  }
  return {
    headline: "Scan failed",
    detail: msg || "Something went wrong. You can retry or fill in the details manually below.",
    canRetry: true,
  };
}

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

async function cropFace(file: File, bbox: BBox | null | undefined): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const W = img.naturalWidth || img.width;
        const H = img.naturalHeight || img.height;
        if (!W || !H) { reject(new Error("Could not read image dimensions")); return; }

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas unavailable")); return; }

        // Normalize a single coordinate value to 0–1 range.
        // Handles: already 0-1, 0-100 percentages, 0-1000 range, or raw pixel coordinates.
        function toNorm(v: number, dim: number): number {
          if (!isFinite(v) || v < 0) return 0;
          if (v <= 1.5)   return Math.min(1, v);          // already 0-1
          if (v <= 2)     return Math.min(1, v);
          if (v <= 100)   return v / 100;                  // percentage
          if (v <= 1500)  return Math.min(1, v / 1000);    // 0-1000 notation
          return Math.min(1, v / dim);                     // pixel coordinates
        }

        let xmin = 0, ymin = 0, xmax = 1, ymax = 1;
        let usingAi = false;

        if (bbox && typeof bbox.xmin === "number" && typeof bbox.xmax === "number") {
          const nx0 = toNorm(bbox.xmin, W);
          const ny0 = toNorm(bbox.ymin, H);
          const nx1 = toNorm(bbox.xmax, W);
          const ny1 = toNorm(bbox.ymax, H);
          const area = (nx1 - nx0) * (ny1 - ny0);
          // Accept bbox only when it looks like a plausible face region
          if (nx1 > nx0 + 0.02 && ny1 > ny0 + 0.02 && area > 0.003 && area < 0.75) {
            xmin = nx0; ymin = ny0; xmax = nx1; ymax = ny1;
            usingAi = true;
          }
        }

        // Fallback: ICAO passport photo zone — always in the left ~30%, upper ~65%
        if (!usingAi) {
          xmin = 0.03; ymin = 0.07; xmax = 0.31; ymax = 0.68;
        }

        // Add generous padding so we include the full head
        const padX = (xmax - xmin) * 0.12;
        const padY = (ymax - ymin) * 0.14;
        const sx = Math.max(0, (xmin - padX) * W);
        const sy = Math.max(0, (ymin - padY) * H);
        const sw = Math.min(W - sx, (xmax - xmin + 2 * padX) * W);
        const sh = Math.min(H - sy, (ymax - ymin + 2 * padY) * H);

        if (sw < 4 || sh < 4) { reject(new Error("Crop region too small")); return; }

        const size = 400;
        canvas.width = size;
        canvas.height = size;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image load failed"));
    };
    img.src = objectUrl;
  });
}

export default function PassportScanner({ onExtracted, onProfilePhoto, compact }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [extractedName, setExtractedName] = useState<string | null>(null);

  const reset = () => {
    setStatus("idle");
    setErrorInfo(null);
    setProfilePicUrl(null);
    setExtractedName(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const dismiss = () => {
    setStatus("dismissed");
    setErrorInfo(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("loading");
    setErrorInfo(null);
    setProfilePicUrl(null);
    setExtractedName(null);

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

      const res = await fetch("/api/passport/extract", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorInfo(classifyError(data.error || "Extraction failed"));
        return;
      }

      if (!data.isAcceptableQuality) {
        setStatus("error");
        setErrorInfo(classifyError(data.rejectionReason || "Image quality too low"));
        return;
      }

      const result: PassportScanResult = {
        firstName:         data.firstName       || "",
        lastName:          data.lastName        || "",
        passportNumber:    data.documentNumber  || "",
        passportIssueDate: normalizeDateToISO(data.dateOfIssue  || ""),
        passportExpiry:    normalizeDateToISO(data.dateOfExpiry || ""),
        dateOfBirth:       normalizeDateToISO(data.dateOfBirth  || ""),
        gender:            normalizeGender(data.sex || ""),
        nationality:       data.nationality || "",
      };

      const passportImageDataUrl = URL.createObjectURL(file);
      result.passportImageDataUrl = passportImageDataUrl;

      if (data.faceBoundingBox && onProfilePhoto) {
        try {
          const cropped = await cropFace(file, data.faceBoundingBox);
          setProfilePicUrl(cropped);
          onProfilePhoto(cropped);
        } catch {
          // face crop is best-effort — manual entry still works
        }
      }

      onExtracted(result);
      setExtractedName(`${result.firstName} ${result.lastName}`.trim() || "Passport scanned");
      setStatus("done");
    } catch (err: any) {
      setStatus("error");
      setErrorInfo(classifyError(err.message || "Unknown error"));
    }
  };

  // ── Compact mode (used in inline toolbar contexts) ─────────────────────────
  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        {status === "done" ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Auto-filled from passport
            <button type="button" onClick={reset} className="ml-1 text-emerald-400 hover:text-emerald-600">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : status === "dismissed" ? (
          <button
            type="button"
            onClick={reset}
            className="text-xs text-[#94A3B8] hover:text-[#2D3199] flex items-center gap-1 underline underline-offset-2"
          >
            <ScanLine className="w-3 h-3" /> Use AI scanner
          </button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={status === "loading"}
            onClick={() => inputRef.current?.click()}
            className="rounded-xl gap-1.5 border-[#2D3199] text-[#2D3199] hover:bg-[#EEF0FF] text-xs"
          >
            {status === "loading"
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning…</>
              : <><ScanLine className="w-3.5 h-3.5" /> Scan Passport</>}
          </Button>
        )}

        {status === "error" && errorInfo && (
          <div className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>{errorInfo.headline}</span>
            {errorInfo.canRetry && (
              <button type="button" onClick={() => inputRef.current?.click()} className="font-bold hover:underline">Retry</button>
            )}
            <button type="button" onClick={dismiss} className="text-[#94A3B8] hover:text-[#64748B] font-semibold">
              · Fill manually
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Full mode ──────────────────────────────────────────────────────────────
  return (
    <div className={`rounded-2xl overflow-hidden transition-all ${status === "dismissed" ? "border border-[#E2E8F0]" : "border-2 border-dashed border-[#2D3199]/30 bg-[#F8FAFF]"}`}>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {/* Dismissed — collapsed strip */}
      {status === "dismissed" && (
        <button
          type="button"
          onClick={reset}
          className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-[#F8FAFF] transition-colors text-[#94A3B8] hover:text-[#2D3199]"
        >
          <ScanLine className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs font-medium">Use AI passport scanner</span>
          <span className="ml-auto text-[10px] bg-[#EEF0FF] text-[#2D3199] px-2 py-0.5 rounded-full font-bold">Optional</span>
        </button>
      )}

      {/* Idle */}
      {status === "idle" && (
        <div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full flex items-center justify-center gap-3 px-4 py-5 text-[#2D3199] hover:bg-[#EEF0FF] transition-colors"
          >
            <div className="w-10 h-10 rounded-2xl bg-[#EEF0FF] flex items-center justify-center shrink-0">
              <ScanLine className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-black text-[#0F172A]">Scan Passport with AI</p>
              <p className="text-xs text-[#64748B] mt-0.5">Upload passport photo — all fields auto-fill instantly</p>
            </div>
            <div className="ml-auto shrink-0 px-3 py-1.5 bg-[#2D3199] text-white text-xs font-bold rounded-xl">
              Upload
            </div>
          </button>
          <div className="flex justify-center pb-3">
            <button
              type="button"
              onClick={dismiss}
              className="text-[10px] text-[#94A3B8] hover:text-[#64748B] flex items-center gap-1 transition-colors"
            >
              <PenLine className="w-3 h-3" /> Skip — enter manually instead
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {status === "loading" && (
        <div className="flex items-center justify-center gap-3 px-4 py-5">
          <Loader2 className="w-5 h-5 text-[#2D3199] animate-spin shrink-0" />
          <div>
            <p className="text-sm font-bold text-[#0F172A]">Analyzing passport…</p>
            <p className="text-xs text-[#64748B] mt-0.5">AI is reading the document</p>
          </div>
        </div>
      )}

      {/* Done */}
      {status === "done" && (
        <div className="flex items-start gap-3 px-4 py-4">
          {profilePicUrl && (
            <img
              src={profilePicUrl}
              alt="Profile"
              className="w-14 h-14 rounded-2xl object-cover border-2 border-[#EEF0FF] shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-sm font-black text-[#0F172A] truncate">
                {extractedName ?? "Passport scanned"}
              </p>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Fields auto-filled.
              {profilePicUrl ? " Profile photo cropped from passport." : ""}
              {" "}Review and correct any details below.
            </p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="shrink-0 text-xs text-[#2D3199] font-semibold hover:underline flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Re-scan
          </button>
        </div>
      )}

      {/* Error */}
      {status === "error" && errorInfo && (
        <div className="px-4 py-4 space-y-3">
          <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-bold text-amber-800">{errorInfo.headline}</p>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">{errorInfo.detail}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {errorInfo.canRetry && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => inputRef.current?.click()}
                className="rounded-xl gap-1.5 border-[#2D3199] text-[#2D3199] hover:bg-[#EEF0FF] text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry Scan
              </Button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] transition-colors"
            >
              <PenLine className="w-3.5 h-3.5" /> Fill in manually — fields are below
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
