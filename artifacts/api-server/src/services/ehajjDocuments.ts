import { getFromR2, uploadToR2 } from "../lib/r2";
import { decryptSetting, encryptSetting } from "./registration/config";

export function ehajjDocumentPath(id: string) {
  return "/api/documents/" + id + "/ehajj-download";
}

const storageKey = (id: string) => "ehajj-private/" + id + "/payload";
const encryptionContext = (id: string) => "ehajj:document:" + id;
const maxStoredBytes = 14 * 1024 * 1024;

export async function saveEhajjDocument(id: string, pdf: Buffer) {
  const encrypted = encryptSetting(
    pdf.toString("base64"),
    encryptionContext(id),
  );
  await uploadToR2(
    storageKey(id),
    Buffer.from(encrypted),
    "application/octet-stream",
  );
}

export async function openEhajjDocument(id: string) {
  const { body, contentLength } = await getFromR2(storageKey(id));
  if (!body) throw new Error("Missing travel document");
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    bytes += chunk.byteLength;
    if (bytes > maxStoredBytes)
      throw new Error("Travel document exceeds storage limit");
    chunks.push(Buffer.from(chunk));
  }
  if (contentLength !== undefined && bytes !== contentLength)
    throw new Error("Incomplete travel document");
  const encrypted = Buffer.concat(chunks).toString("utf8");
  return Buffer.from(
    decryptSetting(encrypted, encryptionContext(id)),
    "base64",
  );
}
