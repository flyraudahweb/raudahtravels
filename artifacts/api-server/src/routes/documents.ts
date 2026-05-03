import { Router } from "express";
import { db } from "@workspace/db";
import { documentsTable, profilesTable } from "@workspace/db";
import { getAuth } from "@clerk/express";
import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

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
  const total = await db.select({ count: sql<number>`count(*)` }).from(documentsTable);
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

// SECURITY FIX #5: Added auth + ownership check — users can only view their own documents, admins can view any.
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
