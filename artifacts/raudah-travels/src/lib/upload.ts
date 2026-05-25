import imageCompression from "browser-image-compression";

/**
 * Upload a file to Cloudflare R2 via the backend proxy.
 *
 * @param file - The File object to upload
 * @param folder - The R2 folder: "passports" | "photos" | "receipts" | "documents"
 * @returns The URL path to access the file (e.g. "/api/files/receipts/abc-123.jpg")
 */
export async function uploadFile(
  file: File,
  folder: "passports" | "photos" | "receipts" | "documents",
): Promise<string> {
  const MAX_UPLOAD_SELECTION = 3 * 1024 * 1024; // 3MB limit for selection
  if (file.size > MAX_UPLOAD_SELECTION) {
    throw new Error(`File too large (${(file.size / 1024).toFixed(0)}KB). Maximum size is 3MB.`);
  }

  const ALLOWED_TYPES = [
    "image/jpeg", "image/jpg", "image/png", "image/webp",
    "application/pdf",
  ];
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Invalid file type. Please upload a JPG, PNG, WebP, or PDF file.");
  }

  let finalFile = file;

  // If it's an image, apply lossless/high-quality compression before upload
  if (file.type.startsWith("image/")) {
    try {
      const options = {
        maxSizeMB: 1.5,          // Target size is < 1.5MB to ensure it passes backend 2MB limit
        maxWidthOrHeight: 1920,  // Keep high resolution
        useWebWorker: true,
        alwaysKeepResolution: true, // Try to preserve dimensions as much as possible
      };
      finalFile = await imageCompression(file, options);
    } catch (error) {
      console.warn("Image compression failed, falling back to original file", error);
      // fallback to the original file if compression fails
    }
  }

  const formData = new FormData();
  formData.append("file", finalFile);
  formData.append("folder", folder);

  const response = await fetch("/api/files/upload", {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(data.error || "File upload failed. Please try again.");
  }

  const data = await response.json();
  return data.url as string;
}
