import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { BUCKET_NAME, r2Client } from "./r2";

const maxDocumentBytes = 15 * 1024 * 1024;
const documentTypes = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

export function documentType(bytes: Buffer) {
  const header = bytes.subarray(0, 12);
  const extension = header.subarray(0, 5).toString() === "%PDF-" ? "pdf"
    : header.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? "jpg"
    : header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? "png"
    : header.subarray(0, 4).toString() === "RIFF" && header.subarray(8, 12).toString() === "WEBP" ? "webp"
    : undefined;
  return extension ? { extension, contentType: documentTypes[extension] } : undefined;
}

export function safeDocumentContentType(contentType: string) {
  return Object.values(documentTypes).find((type) => type === contentType);
}

export function privateDocumentKey(value: unknown, folder: string) {
  if (typeof value !== "string") return undefined;
  const match = /^\/api\/files\/([a-z]+)\/([a-zA-Z0-9_-][a-zA-Z0-9._-]{0,179})$/.exec(value);
  return match?.[1] === folder ? `${folder}/${match[2]}` : undefined;
}

export async function ownsPrivateDocument(value: unknown, folder: string, ownerId: string) {
  if (value == null || value === "") return true;
  const key = privateDocumentKey(value, folder);
  if (!key) return false;
  try {
    const object = await r2Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }), {
      abortSignal: AbortSignal.timeout(10000),
    });
    return object.Metadata?.owner === ownerId && !!object.ContentType &&
      !!safeDocumentContentType(object.ContentType) && !!object.ContentLength && object.ContentLength <= maxDocumentBytes;
  } catch {
    return false;
  }
}

export function storedDocumentData(value: string) {
  if (value.length > Math.ceil(maxDocumentBytes * 4 / 3) + 100) return undefined;
  const match = /^data:(?:application\/pdf|image\/(?:jpeg|jpg|png|webp));base64,([a-z\d+/=]+)$/i.exec(value);
  if (!match) return undefined;
  const bytes = Buffer.from(match[1], "base64");
  const type = documentType(bytes);
  return type && bytes.length <= maxDocumentBytes ? { bytes, ...type } : undefined;
}

export async function canAttachTravelDocument(value: unknown, folder: "visa" | "tickets", ownerId: string) {
  if (value == null || value === "") return true;
  if (typeof value === "string" && /^\/api\/uploads\/(visa|tickets)\/[\w.-]+\.(?:pdf|jpe?g|png|webp)$/i.test(value))
    return value.startsWith(`/api/uploads/${folder}/`);
  return ownsPrivateDocument(value, "documents", ownerId);
}
