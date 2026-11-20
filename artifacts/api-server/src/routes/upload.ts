import { Router } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import path from "path";
import { getAuth } from "@clerk/express";
import { agentsTable, bookingsTable, db, profilesTable } from "@workspace/db";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import { uploadToR2, getFromR2, isR2Configured } from "../lib/r2";
import { logger } from "../lib/logger";

const router = Router();

// Multer config: 2MB max, memory storage (buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const ALLOWED_TYPES = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type: ${file.mimetype}. Allowed: JPG, PNG, WebP, PDF`,
        ),
      );
    }
  },
});

const ALLOWED_FOLDERS = ["passports", "photos", "receipts", "documents"];

async function fileProfile(clerkUserId: string) {
  return db.query.profilesTable.findFirst({
    where: and(
      eq(profilesTable.clerkUserId, clerkUserId),
      eq(profilesTable.accountStatus, "active"),
    ),
  });
}

// Staff-issued documents follow the current booking. Customer-supplied links
// alone cannot establish ownership of an older object.
async function canReadLinkedFile(
  profileId: string,
  url: string,
  ownerId?: string,
) {
  const ownedBookings = db
    .select({ id: bookingsTable.id })
    .from(bookingsTable)
    .where(
      or(
        eq(bookingsTable.userId, profileId),
        inArray(
          bookingsTable.agentId,
          db
            .select({ id: agentsTable.id })
            .from(agentsTable)
            .where(
              and(
                eq(agentsTable.userId, profileId),
                eq(agentsTable.status, "active"),
              ),
            ),
        ),
      ),
    );
  const result = await db.execute(sql`
    SELECT 1 FROM visa_applications WHERE booking_id IN (${ownedBookings})
      AND ${url} IN (visa_document_url, ticket_document_url)
    UNION ALL
    SELECT 1 FROM bookings WHERE id IN (${ownedBookings}) AND ticket_document_url = ${url}
    ${ownerId ? sql`
    UNION ALL
    SELECT 1 FROM bookings b WHERE b.id IN (${ownedBookings})
      AND ${url} IN (b.passport_copy_url, b.profile_photo_url)
      AND (b.user_id = ${ownerId} OR b.registered_by_staff_id = ${ownerId}
        OR b.agent_id IN (SELECT id FROM agents WHERE user_id = ${ownerId}))
    ` : sql``}
    LIMIT 1
  `);
  return result.rows.length > 0;
}

function staffCanRead(profile: { role: string }) {
  return ["admin", "super_admin", "staff"].includes(profile.role);
}

/**
 * POST /api/files/upload
 * Upload a file to R2. Requires authentication.
 * Body: multipart/form-data with fields:
 *   - file: the file to upload
 *   - folder: one of passports, photos, receipts, documents
 */
router.post(
  "/files/upload",
  (req, res, next) => {
    if (!getAuth(req).userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    upload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res
            .status(400)
            .json({ error: "File too large. Maximum size is 2MB." });
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
  },
  async (req, res) => {
    try {
      // Auth check: any logged-in user can upload
      const { userId } = getAuth(req);
      if (!userId) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const profile = await fileProfile(userId);
      if (!profile)
        return res.status(403).json({ error: "Account access is unavailable" });

      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }

      const folder = (req.body.folder as string) || "documents";
      if (!ALLOWED_FOLDERS.includes(folder)) {
        res
          .status(400)
          .json({
            error: `Invalid folder. Must be one of: ${ALLOWED_FOLDERS.join(", ")}`,
          });
        return;
      }

      // Check R2 configuration before attempting upload
      if (!(await isR2Configured())) {
        logger.error(
          "R2 storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY environment variables.",
        );
        res
          .status(503)
          .json({
            error:
              "File storage is temporarily unavailable. Please contact support.",
          });
        return;
      }

      // Generate unique key: folder/uuid-timestamp.ext
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      const key = `${folder}/${randomUUID()}-${Date.now()}${ext}`;

      await uploadToR2(key, file.buffer, file.mimetype, { owner: profile.id });

      // Return the API-served URL (proxied through our backend)
      const url = `/api/files/${key}`;

      logger.info(
        { key, size: file.size, type: file.mimetype, userId },
        "File uploaded to R2",
      );

      res.json({ url, key });
      return;
    } catch (err: any) {
      logger.error(
        {
          err,
          fileSize: req.file?.size,
          fileType: req.file?.mimetype,
          folder: req.body.folder,
        },
        "File upload failed",
      );
      const message =
        err?.name === "CredentialsProviderError" ||
        err?.Code === "InvalidAccessKeyId"
          ? "File storage credentials are invalid. Please contact support."
          : "File upload failed. Please try again.";
      res.status(500).json({ error: message });
      return;
    }
  },
);

router.get("/files/:folder/:filename", async (req, res) => {
  const { folder, filename } = req.params;
  res.setHeader("Cache-Control", "private, no-store");
  if (
    !ALLOWED_FOLDERS.includes(folder) ||
    !/^[\w.-]+$/.test(filename) ||
    filename === "." ||
    filename === ".."
  )
    return res.status(404).json({ error: "File not found" });
  const { userId } = getAuth(req);
  if (!userId)
    return res.status(401).json({ error: "Authentication required" });
  const key = `${folder}/${filename}`;

  try {
    const profile = await fileProfile(userId);
    if (!profile)
      return res.status(403).json({ error: "Account access is unavailable" });
    const { body, contentType, contentLength, ownerId } = await getFromR2(key);

    if (!body) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    if (
      ownerId !== profile.id &&
      !staffCanRead(profile) &&
      !(await canReadLinkedFile(profile.id, `/api/files/${key}`, ownerId))
    ) {
      (body as Readable).destroy();
      return res.status(404).json({ error: "File not found" });
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Type", contentType);
    if (contentLength) res.setHeader("Content-Length", contentLength);
    await pipeline(body as Readable, res);
    return;
  } catch (err: any) {
    if (res.headersSent || res.destroyed) return;
    if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    logger.error({ err, key }, "Failed to serve file from R2");
    res.status(500).json({ error: "Failed to retrieve file" });
    return;
  }
});

router.get("/uploads/:folder/:filename", async (req, res) => {
  const { folder, filename } = req.params;
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (
    !["visa", "tickets"].includes(folder) ||
    !/^[\w.-]+$/.test(filename) ||
    filename === "." ||
    filename === ".."
  )
    return res.status(404).json({ error: "File not found" });
  const { userId } = getAuth(req);
  if (!userId)
    return res.status(401).json({ error: "Authentication required" });
  const profile = await fileProfile(userId);
  if (
    !profile ||
    (!staffCanRead(profile) &&
      !(await canReadLinkedFile(
        profile.id,
        `/api/uploads/${folder}/${filename}`,
      )))
  )
    return res.status(404).json({ error: "File not found" });
  return res.sendFile(filename, {
    root: path.resolve("uploads", folder),
    cacheControl: false,
  });
});

export default router;
