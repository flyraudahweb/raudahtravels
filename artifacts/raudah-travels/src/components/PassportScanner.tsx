import { useRef, useState } from "react";
import { ScanLine, Loader2, CheckCircle2, AlertTriangle, X, PenLine, RefreshCw, Crop as CropIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import ReactCrop, { type Crop, type PercentCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { uploadFile } from "@/lib/upload";

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

function generateCroppedImage(image: HTMLImageElement, crop: Crop): string {
  const canvas = document.createElement("canvas");
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  // ReactCrop returns percent-based crop — convert to pixel values on the displayed image
  const isPercent = (crop as PercentCrop).unit === "%";
  const pxX = isPercent ? (crop.x / 100) * image.width : crop.x;
  const pxY = isPercent ? (crop.y / 100) * image.height : crop.y;
  const pxW = isPercent ? (crop.width / 100) * image.width : crop.width;
  const pxH = isPercent ? (crop.height / 100) * image.height : crop.height;

  // Draw at the full natural resolution for quality
  canvas.width = pxW * scaleX;
  canvas.height = pxH * scaleY;
  const ctx = canvas.getContext("2d");

  if (!ctx) return "";

  ctx.drawImage(
    image,
    pxX * scaleX,
    pxY * scaleY,
    pxW * scaleX,
    pxH * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );

  // Scale down to a 400×400 profile picture
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = 400;
  finalCanvas.height = 400;
  const fCtx = finalCanvas.getContext("2d");
  if (fCtx) {
    fCtx.fillStyle = "#fff";
    fCtx.fillRect(0, 0, 400, 400);
    fCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, 400, 400);
  }
  return finalCanvas.toDataURL("image/jpeg", 0.92);
}

/**
 * Convert a data URL to a File object without using fetch() — avoids CSP
 * connect-src restrictions that block fetching data: URLs.
 */
function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
}

function calculateInitialCrop(bbox: BBox | null | undefined, W: number, H: number): PercentCrop {
  function toNorm(v: number, dim: number): number {
    if (!isFinite(v) || v < 0) return 0;
    if (v <= 1.5)   return Math.min(1, v);
    if (v <= 2)     return Math.min(1, v);
    if (v <= 100)   return v / 100;
    if (v <= 1500)  return Math.min(1, v / 1000);
    return Math.min(1, v / dim);
  }

  let xmin = 0, ymin = 0, xmax = 1, ymax = 1;
  let usingAi = false;

  if (bbox && typeof bbox.xmin === "number" && typeof bbox.xmax === "number") {
    const nx0 = toNorm(bbox.xmin, W);
    const ny0 = toNorm(bbox.ymin, H);
    const nx1 = toNorm(bbox.xmax, W);
    const ny1 = toNorm(bbox.ymax, H);
    const area = (nx1 - nx0) * (ny1 - ny0);
    if (nx1 > nx0 + 0.02 && ny1 > ny0 + 0.02 && area > 0.003 && area < 0.75) {
      xmin = nx0; ymin = ny0; xmax = nx1; ymax = ny1;
      usingAi = true;
    }
  }

  if (!usingAi) {
    xmin = 0.03; ymin = 0.07; xmax = 0.31; ymax = 0.68;
  }

  const padX = (xmax - xmin) * 0.12;
  const padY = (ymax - ymin) * 0.14;

  const cx = Math.max(0, xmin - padX) * 100;
  const cy = Math.max(0, ymin - padY) * 100;
  const cw = Math.min(100 - cx, (xmax - xmin + 2 * padX) * 100);
  const ch = Math.min(100 - cy, (ymax - ymin + 2 * padY) * 100);
  
  return {
    unit: '%',
    x: cx,
    y: cy,
    width: cw,
    height: ch,
  };
}

export default function PassportScanner({ onExtracted, onProfilePhoto, compact }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [extractedName, setExtractedName] = useState<string | null>(null);
  const [lastPassportImage, setLastPassportImage] = useState<string | null>(null);

  // Manual Crop State
  // cropOrigin tracks where the crop dialog was opened from:
  //   'ai'    – normal AI extraction flow (default)
  //   'error' – user chose "Crop Photo Manually" from the error state
  //   'recrop'– user clicked "Re-crop Photo" from the done state
  const [pendingCrop, setPendingCrop] = useState<{ imageUrl: string; result: PassportScanResult; bbox?: BBox | null } | null>(null);
  const [cropOrigin, setCropOrigin] = useState<'ai' | 'error' | 'recrop'>('ai');
  const [crop, setCrop] = useState<Crop>();
  const [isUploadingCrop, setIsUploadingCrop] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const reset = () => {
    setStatus("idle");
    setErrorInfo(null);
    setProfilePicUrl(null);
    setExtractedName(null);
    setLastPassportImage(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  /** Open the crop dialog manually (error-state or re-crop from done). */
  const openManualCrop = (origin: 'error' | 'recrop') => {
    if (!lastPassportImage) return;
    setCropOrigin(origin);
    setPendingCrop({
      imageUrl: lastPassportImage,
      result: {},                              // empty – won't overwrite existing form data
      bbox: { xmin: 0.03, ymin: 0.07, xmax: 0.31, ymax: 0.68 }, // default passport photo region
    });
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
    setLastPassportImage(null);

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

      // Save the image data URL so we can re-open the crop dialog later,
      // even if AI extraction fails.
      const passportDataUrl = `data:${file.type};base64,${base64}`;
      setLastPassportImage(passportDataUrl);

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

      // Convert file to a base64 data URL (NOT a blob URL!) so it can be safely
      // stored in the database. Blob URLs are ephemeral browser memory addresses
      // that vanish on page refresh.
      const passportImageDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      result.passportImageDataUrl = passportImageDataUrl;

      if (onProfilePhoto) {
        setCropOrigin('ai');
        setPendingCrop({
          imageUrl: passportImageDataUrl,
          result,
          bbox: data.faceBoundingBox,
        });
        // We defer calling onExtracted and setting status to 'done' until cropping completes or is skipped.
      } else {
        onExtracted(result);
        setExtractedName(`${result.firstName} ${result.lastName}`.trim() || "Passport scanned");
        setStatus("done");
      }
    } catch (err: any) {
      setStatus("error");
      setErrorInfo(classifyError(err.message || "Unknown error"));
    }
  };

  const renderCropDialog = () => (
    <Dialog open={!!pendingCrop} onOpenChange={(open) => {
      if (!open && pendingCrop) {
        if (cropOrigin === 'ai') {
          onExtracted(pendingCrop.result);
          setExtractedName(`${pendingCrop.result.firstName} ${pendingCrop.result.lastName}`.trim() || "Passport scanned");
          setStatus("done");
        } else if (cropOrigin === 'error') {
          setStatus("idle");
        }
        setPendingCrop(null);
      }
    }}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-white rounded-3xl gap-0 border-0">
        <DialogHeader className="p-5 pb-3">
          <DialogTitle className="text-lg font-black text-[#0F172A] flex items-center gap-2">
            <CropIcon className="w-5 h-5 text-[#2D3199]" />
            Crop Profile Picture
          </DialogTitle>
          <DialogDescription className="text-xs font-semibold text-[#64748B]">
            Please drag and resize the box to perfectly frame the profile face.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-[#1e293b] border-y border-[#334155] p-4 flex justify-center items-center relative min-h-[300px]">
          {pendingCrop && (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              aspect={1}
              className="max-h-[60vh]"
              keepSelection
            >
              <img
                ref={imgRef}
                src={pendingCrop.imageUrl}
                alt="Passport"
                className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-xl"
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setCrop(calculateInitialCrop(pendingCrop.bbox, img.naturalWidth, img.naturalHeight));
                }}
              />
            </ReactCrop>
          )}
        </div>

        <DialogFooter className="p-4 bg-white flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (pendingCrop) {
                if (cropOrigin === 'ai') {
                  onExtracted(pendingCrop.result);
                  setExtractedName(`${pendingCrop.result.firstName} ${pendingCrop.result.lastName}`.trim() || "Passport scanned");
                  setStatus("done");
                } else if (cropOrigin === 'error') {
                  setStatus("idle");
                }
                setPendingCrop(null);
              }
            }}
            className="rounded-xl border-[#E2E8F0] text-[#64748B] font-bold h-11 px-6"
          >
            Skip
          </Button>
          <Button
            type="button"
            disabled={isUploadingCrop}
            onClick={async () => {
              if (pendingCrop && imgRef.current && crop) {
                try {
                  setIsUploadingCrop(true);
                  const b64 = generateCroppedImage(imgRef.current, crop);
                  // Use dataUrlToFile instead of fetch(dataUrl) to avoid CSP connect-src blocking data: URLs
                  const file = dataUrlToFile(b64, "profile.jpg");
                  const url = await uploadFile(file, "photos");
                  
                  setProfilePicUrl(url);
                  onProfilePhoto?.(url);
                } catch (err) {
                  console.error("Crop/upload error", err);
                } finally {
                  setIsUploadingCrop(false);
                  if (cropOrigin === 'ai') {
                    onExtracted(pendingCrop.result);
                    setExtractedName(`${pendingCrop.result.firstName} ${pendingCrop.result.lastName}`.trim() || "Passport scanned");
                    setStatus("done");
                  } else if (cropOrigin === 'error') {
                    setStatus("idle");
                  }
                  setPendingCrop(null);
                }
              }
            }}
            className="rounded-xl bg-[#2D3199] hover:bg-[#1C1F66] text-white font-black h-11 px-6 shadow-md"
          >
            {isUploadingCrop ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</> : "Confirm Crop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ── Compact mode (used in inline toolbar contexts) ─────────────────────────
  if (compact) {
    return (
      <>
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
      {renderCropDialog()}
      </>
    );
  }

  // ── Full mode ──────────────────────────────────────────────────────────────
  return (
    <>
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
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-xs text-[#2D3199] font-semibold hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Re-scan
            </button>
            {onProfilePhoto && lastPassportImage && (
              <button
                type="button"
                onClick={() => openManualCrop('recrop')}
                className="text-xs text-[#64748B] font-semibold hover:underline flex items-center gap-1"
              >
                <CropIcon className="w-3 h-3" /> Re-crop Photo
              </button>
            )}
          </div>
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
          <div className="flex flex-wrap items-center gap-2">
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
            {onProfilePhoto && lastPassportImage && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => openManualCrop('error')}
                className="rounded-xl gap-1.5 border-[#64748B] text-[#64748B] hover:bg-[#F1F5F9] text-xs"
              >
                <CropIcon className="w-3.5 h-3.5" /> Crop Photo Manually
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

      {/* Manual Cropping Dialog moved to renderCropDialog */}
    </div>
    {renderCropDialog()}
    </>
  );
}
