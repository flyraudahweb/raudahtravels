import { getRegistrationConfig } from "../registration/config";
import { db } from "@workspace/db";
import { siteSettingsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import { Mistral } from "@mistralai/mistralai";

/* ── Prompt (identical to routes/ai.ts — single source of truth) ────────── */

export const PASSPORT_PROMPT = `You are a passport data extraction assistant. Analyze this passport image carefully.

First evaluate image quality:
- If the image is blurry, severely cropped (missing MRZ or photo), or has unreadable glare: set isAcceptableQuality to false and describe why in rejectionReason
- Otherwise: set isAcceptableQuality to true and leave rejectionReason as an empty string

Then extract these fields (use empty string if a field is genuinely not readable or absent):
- firstName: given names exactly as printed
- lastName: surname/family name exactly as printed
- documentNumber: passport number (alphanumeric, e.g. A12345678)
- nationality: full nationality as printed (e.g. "NIGERIAN", "BRITISH CITIZEN")
- dateOfBirth: in strict YYYY-MM-DD format
- sex: exactly "M" or "F"
- dateOfIssue: in strict YYYY-MM-DD format
- dateOfExpiry: in strict YYYY-MM-DD format
- faceBoundingBox: the bounding box around the person's photo/face on the passport page, as normalized coordinates from 0.0 to 1.0: { ymin, xmin, ymax, xmax }

Return valid JSON only — no markdown, no code fences, no extra text.`;

export interface PassportExtractionResult {
  isAcceptableQuality: boolean;
  rejectionReason: string;
  firstName: string;
  lastName: string;
  documentNumber: string;
  nationality: string;
  dateOfBirth: string;
  sex: string;
  dateOfIssue: string;
  dateOfExpiry: string;
  faceBoundingBox?: { ymin: number; xmin: number; ymax: number; xmax: number };
}

export type PassportExtractionProvider = "gemini" | "mistral";

export interface PassportExtractionOutcome {
  ok: boolean;
  data?: PassportExtractionResult;
  provider?: PassportExtractionProvider;
  /** Set when a provider failed and the chain fell through to the next one */
  fallbackTriggered: boolean;
  fallbackReason?: string;
  /** HTTP-style error for the caller to surface, only set when ok is false */
  error?: { status: number; message: string };
}

async function getAiConfig(): Promise<{
  provider: PassportExtractionProvider;
  geminiKey: string | null;
  mistralKey: string | null;
}> {
  const rows = await db.query.siteSettingsTable.findMany({
    where: inArray(siteSettingsTable.key, ["ai_provider", "gemini_api_key", "mistral_api_key"]),
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value as string]));
  const registration = await getRegistrationConfig();
  return {
    provider: (map.ai_provider as PassportExtractionProvider) || "gemini",
    geminiKey: registration.geminiKey || map.gemini_api_key || null,
    mistralKey: registration.mistralKey || map.mistral_api_key || null,
  };
}

/** A result is "usable" if quality is acceptable and the core identity fields are present. */
export function isComplete(data: PassportExtractionResult | null | undefined): boolean {
  if (!data) return false;
  if (data.isAcceptableQuality === false) return false;
  return Boolean(data.isAcceptableQuality && data.firstName && data.lastName && data.documentNumber && data.dateOfBirth && data.dateOfExpiry);
}

async function extractWithGemini(
  imageBase64: string,
  mime: string,
  apiKey: string,
): Promise<PassportExtractionResult> {
  const model = (await getRegistrationConfig()).geminiModel;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(20000),
    body: JSON.stringify({ contents: [{ parts: [{ inlineData: { data: imageBase64, mimeType: mime } }, { text: PASSPORT_PROMPT }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0 } }),
  });
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
  const result = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return parseExtraction(JSON.parse(result.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? ""));
}

async function extractWithMistral(
  imageBase64: string,
  mime: string,
  apiKey: string,
): Promise<PassportExtractionResult> {
  const client = new Mistral({ apiKey, timeoutMs: 20000 });
  const result = await client.chat.complete({
    model: (await getRegistrationConfig()).mistralModel,
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", imageUrl: `data:${mime};base64,${imageBase64}` } as any,
          { type: "text", text: PASSPORT_PROMPT },
        ],
      },
    ],
  });
  const raw = result.choices?.[0]?.message?.content ?? "";
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  return parseExtraction(JSON.parse(cleaned));
}

function classifyGeminiError(err: any): { status: number; message: string } {
  const msg = err?.message ?? "";
  if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429") || msg.includes("quota")) {
    return { status: 429, message: "Gemini quota reached. Switch to Mistral in Settings → AI Integration." };
  }
  if (msg.includes("API_KEY") || msg.includes("INVALID_ARGUMENT") || msg.includes("API key not valid")) {
    return { status: 503, message: "Invalid Gemini API key. Please update it in Settings." };
  }
  return { status: 500, message: "AI extraction failed. Please fill in the details manually." };
}

function classifyMistralError(err: any): { status: number; message: string } {
  const msg = err?.message ?? "";
  if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("API key")) {
    return { status: 503, message: "Invalid Mistral API key. Update it in Settings." };
  }
  if (msg.includes("429") || msg.includes("rate limit")) {
    return { status: 429, message: "Mistral rate limit reached. Please try again shortly." };
  }
  return { status: 500, message: "AI extraction failed. Please fill in the details manually." };
}

/**
 * Extract passport fields from a base64 image.
 *
 * `strict=true` preserves the
 * exact legacy behavior: only call the configured provider, no fallback.
 *
 * `strict=false` (used by the agent and /passport/extract) always tries Gemini first,
 * then falls back to Mistral on failure or an incomplete/low-quality result —
 * per the "Gemini primary, automatic Mistral fallback" requirement.
 */
export async function extractPassport(
  imageBase64: string,
  mimeType: string | undefined,
  options: { strict?: boolean; forceProvider?: PassportExtractionProvider } = {},
): Promise<PassportExtractionOutcome> {
  const config = await getAiConfig();
  const mime = mimeType || "image/jpeg";

  if (options.forceProvider) {
    const result = await extractStrict(imageBase64, mime, { ...config, provider: options.forceProvider });
    if (result.ok && result.data?.isAcceptableQuality && !isComplete(result.data)) return { ok: false, fallbackTriggered: false, error: { status: 422, message: "Incomplete passport data" } };
    return result;
  }
  if (options.strict || !(await getRegistrationConfig()).autoFallback) {
    return extractStrict(imageBase64, mime, config);
  }

  return extractWithFallback(imageBase64, mime, config);
}

async function extractStrict(
  imageBase64: string,
  mime: string,
  config: { provider: PassportExtractionProvider; geminiKey: string | null; mistralKey: string | null },
): Promise<PassportExtractionOutcome> {
  if (config.provider === "gemini") {
    if (!config.geminiKey) {
      return {
        ok: false,
        fallbackTriggered: false,
        error: { status: 503, message: "Gemini API key not configured. Add it in Settings → AI Integration or switch to Mistral." },
      };
    }
    try {
      const data = await extractWithGemini(imageBase64, mime, config.geminiKey);
      return { ok: true, data, provider: "gemini", fallbackTriggered: false };
    } catch (err: any) {
      return { ok: false, fallbackTriggered: false, error: classifyGeminiError(err) };
    }
  }

  if (!config.mistralKey) {
    return {
      ok: false,
      fallbackTriggered: false,
      error: { status: 503, message: "Mistral API key not configured. Add it in Settings → AI Integration." },
    };
  }
  try {
    const data = await extractWithMistral(imageBase64, mime, config.mistralKey);
    return { ok: true, data, provider: "mistral", fallbackTriggered: false };
  } catch (err: any) {
    return { ok: false, fallbackTriggered: false, error: classifyMistralError(err) };
  }
}

async function extractWithFallback(
  imageBase64: string,
  mime: string,
  config: { provider: PassportExtractionProvider; geminiKey: string | null; mistralKey: string | null },
): Promise<PassportExtractionOutcome> {
  let geminiFailure: string | undefined;
  let qualityRejected: PassportExtractionResult | undefined;

  if (config.geminiKey) {
    try {
      const data = await extractWithGemini(imageBase64, mime, config.geminiKey);
      if (isComplete(data)) {
        return { ok: true, data, provider: "gemini", fallbackTriggered: false };
      }
      if (data.isAcceptableQuality === false) qualityRejected = data;
      geminiFailure = data.rejectionReason || "Gemini result was incomplete or low quality";
    } catch (err: any) {
      geminiFailure = classifyGeminiError(err).message;
    }
  } else {
    geminiFailure = "Gemini API key not configured";
  }

  if (config.mistralKey) {
    try {
      const data = await extractWithMistral(imageBase64, mime, config.mistralKey);
      if (data.isAcceptableQuality && !isComplete(data)) throw new Error("Incomplete Mistral output");
      return {
        ok: true,
        data,
        provider: "mistral",
        fallbackTriggered: true,
        fallbackReason: geminiFailure,
      };
    } catch (err: any) {
      if (qualityRejected) return { ok: true, data: qualityRejected, provider: "gemini", fallbackTriggered: true, fallbackReason: geminiFailure };
      const mistralError = classifyMistralError(err);
      return {
        ok: false,
        fallbackTriggered: true,
        fallbackReason: geminiFailure,
        error: { status: mistralError.status, message: `Both providers failed. Gemini: ${geminiFailure}. Mistral: ${mistralError.message}` },
      };
    }
  }

  if (qualityRejected) return { ok: true, data: qualityRejected, provider: "gemini", fallbackTriggered: true, fallbackReason: geminiFailure };
  return {
    ok: false,
    fallbackTriggered: true,
    fallbackReason: geminiFailure,
    error: { status: 503, message: `Gemini failed (${geminiFailure}) and no Mistral key is configured for fallback.` },
  };
}

const field = z.string().trim().max(200).default("");
const extractionSchema = z.object({
  isAcceptableQuality: z.boolean(), rejectionReason: field,
  firstName: field, lastName: field, documentNumber: field, nationality: field,
  dateOfBirth: field, sex: z.enum(["M", "F", ""]).default(""), dateOfIssue: field, dateOfExpiry: field,
  faceBoundingBox: z.object({ ymin: z.number().min(0).max(1), xmin: z.number().min(0).max(1), ymax: z.number().min(0).max(1), xmax: z.number().min(0).max(1) }).optional(),
});
export function parseExtraction(value: unknown): PassportExtractionResult {
  const data = extractionSchema.parse(value);
  for (const key of ["dateOfBirth", "dateOfIssue", "dateOfExpiry"] as const) {
    const date = data[key];
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date).getTime()) || new Date(date).toISOString().slice(0, 10) !== date)) throw new Error("Invalid extracted date");
  }
  return data;
}
