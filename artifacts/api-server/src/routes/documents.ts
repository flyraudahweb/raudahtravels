import { Router } from "express";
import { db } from "@workspace/db";
import { bookingsTable, documentsTable, profilesTable } from "@workspace/db";
import { getAuth } from "@clerk/express";
import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z } from "zod";
import { ehajjDocumentPath, openEhajjDocument } from "../services/ehajjDocuments";

const router = Router();

async function getProfileByClerkId(clerkUserId: string) {
  return db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, clerkUserId) });
}

router.get("/documents", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const { bookingId, type } = req.query as Record<string, string>;
  const conditions = [eq(documentsTable.userId, profile.id)];
  if (bookingId) conditions.push(eq(documentsTable.bookingId, bookingId));
  if (type) conditions.push(eq(documentsTable.type, type as any));

  const docs = await db.query.documentsTable.findMany({ where: and(...conditions) });
  const total = await db.select({ count: sql<number>`count(*)` }).from(documentsTable).where(and(...conditions));
  return res.json({ documents: docs, total: Number(total[0].count) });
});

router.post("/documents", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const { bookingId, type, url, fileName } = req.body;
  const [doc] = await db.insert(documentsTable).values({
    id: randomUUID(), userId: profile.id, bookingId, type, url, status: "pending", fileName,
  }).returning();

  return res.status(201).json(doc);
});

router.get("/documents/:id/ehajj-download", async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Sign in to download your document." });
  const profile = await getProfileByClerkId(userId);
  if (profile?.accountStatus !== "active") return res.status(403).json({ error: "Account access is unavailable." });
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(404).json({ error: "Document not found." });
  const document = await db.query.documentsTable.findFirst({ where: and(
    eq(documentsTable.id, id.data),
    eq(documentsTable.userId, profile.id),
    eq(documentsTable.status, "approved"),
    eq(documentsTable.url, ehajjDocumentPath(id.data)),
  ) });
  if (!document?.bookingId) return res.status(404).json({ error: "Document not found." });
  const booking = await db.query.bookingsTable.findFirst({
    columns: { id: true },
    where: and(eq(bookingsTable.id, document.bookingId), eq(bookingsTable.userId, profile.id)),
  });
  if (!booking) return res.status(404).json({ error: "Document not found." });
  try {
    const pdf = await openEhajjDocument(document.id);
    res.attachment(document.type.replaceAll("_", "-") + ".pdf");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.type("application/pdf").send(pdf);
  } catch {
    return res.status(503).json({ error: "This document is temporarily unavailable. Please contact support." });
  }
});

// Users can view their own document records. Staff access to metadata uses the existing admin policy.
router.get("/documents/:id", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const doc = await db.query.documentsTable.findFirst({ where: eq(documentsTable.id, req.params.id) });
  if (!doc) return res.status(404).json({ error: "Document not found" });

  const isAdmin = ["admin", "super_admin", "staff"].includes(profile.role);
  if (!isAdmin && doc.userId !== profile.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  return res.json(doc);
});

export default router;
