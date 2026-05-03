import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable, profilesTable } from "@workspace/db";
import { getAuth } from "@clerk/express";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

async function getProfileByClerkId(clerkUserId: string) {
  return db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, clerkUserId) });
}

router.get("/notifications", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const { unreadOnly, limit = "50" } = req.query as Record<string, string>;
  const conditions = [eq(notificationsTable.userId, profile.id)];
  if (unreadOnly === "true") conditions.push(eq(notificationsTable.isRead, false));

  const notifications = await db.query.notificationsTable.findMany({
    where: and(...conditions),
    limit: parseInt(limit),
    orderBy: desc(notificationsTable.createdAt),
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  return res.json({ notifications, unreadCount });
});

// SECURITY FIX #1: Removed unauthenticated POST /notifications endpoint.
// All notification creation is handled internally via createNotification() utility.

router.put("/notifications/read-all", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const updated = await db.update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.userId, profile.id), eq(notificationsTable.isRead, false)))
    .returning();

  return res.json({ updated: updated.length });
});

// SECURITY FIX #2: Added auth + ownership check — users can only mark their own notifications as read.
router.put("/notifications/:id/read", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const [notification] = await db.update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, req.params.id), eq(notificationsTable.userId, profile.id)))
    .returning();
  if (!notification) return res.status(404).json({ error: "Not found" });
  return res.json(notification);
});

export default router;
