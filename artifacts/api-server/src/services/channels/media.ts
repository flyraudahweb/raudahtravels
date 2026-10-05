export class UnsupportedMediaError extends Error {}
export const MAX_MEDIA_BYTES = 8 * 1024 * 1024;

export function imageMime(buffer: Buffer): string {
  if (buffer.length > MAX_MEDIA_BYTES) throw new UnsupportedMediaError("Image exceeds 8 MB");
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  throw new UnsupportedMediaError("Please send a JPEG, PNG, or WebP image (maximum 8 MB)");
}

export async function downloadImage(response: Response) {
  if (!response.ok) throw new Error(`Media download HTTP ${response.status}`);
  if (Number(response.headers.get("content-length")) > MAX_MEDIA_BYTES) throw new UnsupportedMediaError("Image exceeds 8 MB");
  const reader = response.body?.getReader();
  if (!reader) throw new UnsupportedMediaError("Empty image");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_MEDIA_BYTES) throw new UnsupportedMediaError("Image exceeds 8 MB");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  const buffer = Buffer.concat(chunks);
  return { base64: buffer.toString("base64"), mimeType: imageMime(buffer) };
}
