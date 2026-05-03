import { Router } from "express";
import { db } from "@workspace/db";
import { profilesTable } from "@workspace/db";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

router.get("/auth/profile", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await db.query.profilesTable.findFirst({
    where: eq(profilesTable.clerkUserId, userId),
  });
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  return res.json({
    id: profile.id,
    clerkUserId: profile.clerkUserId,
    email: profile.email,
    fullName: profile.fullName,
    phone: profile.phone,
    avatarUrl: profile.avatarUrl,
    role: profile.role,
    ninNumber: profile.ninNumber,
    passportNumber: profile.passportNumber,
    dateOfBirth: profile.dateOfBirth,
    address: profile.address,
    createdAt: profile.createdAt,
  });
});

router.put("/auth/profile", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { fullName, phone, avatarUrl, ninNumber, passportNumber, dateOfBirth, address } = req.body;

  const [updated] = await db
    .update(profilesTable)
    .set({ fullName, phone, avatarUrl, ninNumber, passportNumber, dateOfBirth, address, updatedAt: new Date() })
    .where(eq(profilesTable.clerkUserId, userId))
    .returning();

  if (!updated) return res.status(404).json({ error: "Profile not found" });
  return res.json({
    id: updated.id,
    clerkUserId: updated.clerkUserId,
    email: updated.email,
    fullName: updated.fullName,
    phone: updated.phone,
    avatarUrl: updated.avatarUrl,
    role: updated.role,
    ninNumber: updated.ninNumber,
    passportNumber: updated.passportNumber,
    dateOfBirth: updated.dateOfBirth,
    address: updated.address,
    createdAt: updated.createdAt,
  });
});

router.post("/auth/profile/sync", async (req, res) => {
  const { clerkUserId, email, fullName, avatarUrl } = req.body;
  if (!clerkUserId || !email || !fullName) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const existing = await db.query.profilesTable.findFirst({
    where: eq(profilesTable.clerkUserId, clerkUserId),
  });

  if (existing) {
    const [updated] = await db
      .update(profilesTable)
      .set({ email, fullName, avatarUrl, updatedAt: new Date() })
      .where(eq(profilesTable.clerkUserId, clerkUserId))
      .returning();
    return res.json({
      id: updated.id,
      clerkUserId: updated.clerkUserId,
      email: updated.email,
      fullName: updated.fullName,
      phone: updated.phone,
      avatarUrl: updated.avatarUrl,
      role: updated.role,
      ninNumber: updated.ninNumber,
      passportNumber: updated.passportNumber,
      dateOfBirth: updated.dateOfBirth,
      address: updated.address,
      createdAt: updated.createdAt,
    });
  }

  const [created] = await db
    .insert(profilesTable)
    .values({ id: randomUUID(), clerkUserId, email, fullName, avatarUrl, role: "user" })
    .returning();

  return res.json({
    id: created.id,
    clerkUserId: created.clerkUserId,
    email: created.email,
    fullName: created.fullName,
    phone: created.phone,
    avatarUrl: created.avatarUrl,
    role: created.role,
    ninNumber: created.ninNumber,
    passportNumber: created.passportNumber,
    dateOfBirth: created.dateOfBirth,
    address: created.address,
    createdAt: created.createdAt,
  });
});

export default router;
