import { Router } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import path from "path";
import { getAuth } from "@clerk/express";
import { uploadToR2, getFromR2 } from "../lib/r2";
import { logger } from "../lib/logger";

const router = Router();

// Multer config: 2MB max, memory storage (buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const ALLOWED_TYPES = [
      "image/jpeg", "image/jpg", "image/png", "image/webp",
      "application/pdf",
    ];
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: JPG, PNG, WebP, PDF`));
    }
  },
});

const ALLOWED_FOLDERS = ["passports", "photos", "receipts", "documents"];

/**
 * POST /api/files/upload
 * Upload a file to R2. Requires authentication.
 * Body: multipart/form-data with fields:
 *   - file: the file to upload
 *   - folder: one of passports, photos, receipts, documents
 */
router.post("/files/upload", (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "File too large. Maximum size is 2MB." });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    next();
  });
}, async (req, res) => {
  try {
    // Auth check: any logged-in user can upload
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const folder = (req.body.folder as string) || "documents";
    if (!ALLOWED_FOLDERS.includes(folder)) {
      res.status(400).json({ error: `Invalid folder. Must be one of: ${ALLOWED_FOLDERS.join(", ")}` });
      return;
    }

    // Generate unique key: folder/uuid-timestamp.ext
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const key = `${folder}/${randomUUID()}-${Date.now()}${ext}`;

    await uploadToR2(key, file.buffer, file.mimetype);

    // Return the API-served URL (proxied through our backend)
    const url = `/api/files/${key}`;

    logger.info({ key, size: file.size, type: file.mimetype, userId }, "File uploaded to R2");

    res.json({ url, key });
    return;
  } catch (err) {
    logger.error({ err }, "File upload failed");
    res.status(500).json({ error: "File upload failed. Please try again." });
    return;
  }
});

/**
 * GET /api/files/:folder/:filename
 * Serve a file from R2. Public (no auth) — URLs contain random UUIDs.
 * Aggressive caching since files are immutable.
 */
router.get("/files/:folder/:filename", async (req, res) => {
  const { folder, filename } = req.params;
  const key = `${folder}/${filename}`;

  try {
    const { body, contentType, contentLength } = await getFromR2(key);

    if (!body) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    res.setHeader("Content-Type", contentType);
    if (contentLength) res.setHeader("Content-Length", contentLength);
    // Cache immutable files for 1 year
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    // Stream the response
    const stream = body as NodeJS.ReadableStream;
    stream.pipe(res);
    return;
  } catch (err: any) {
    if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    logger.error({ err, key }, "Failed to serve file from R2");
    res.status(500).json({ error: "Failed to retrieve file" });
    return;
  }
});

export default router;
