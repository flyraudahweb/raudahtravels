import { Router } from "express";
import { db } from "@workspace/db";
import { supportTicketsTable, supportMessagesTable, profilesTable, staffSupportSpecialtiesTable } from "@workspace/db";
import { getAuth } from "@clerk/express";
import { eq, and, sql, desc, or, ilike } from "drizzle-orm";
import { randomUUID } from "crypto";
import { createNotification } from "../utils/notify.js";

const router = Router();

async function getProfileByClerkId(clerkUserId: string) {
  return db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, clerkUserId) });
}

// SECURITY FIX #15: Sanitize ilike search input to prevent wildcard injection
function sanitizeLikeInput(input: string): string {
  return input.replace(/%/g, "\\%").replace(/_/g, "\\_");
}

router.get("/support/tickets", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const {
    status,
    category,
    search,
    limit = "30",
    offset = "0",
  } = req.query as Record<string, string>;

  const isAdmin = ["admin", "super_admin", "staff"].includes(profile.role);

  const conditions: ReturnType<typeof eq>[] = [];
  if (!isAdmin) conditions.push(eq(supportTicketsTable.userId, profile.id));
  if (status && status !== "all") conditions.push(eq(supportTicketsTable.status, status as any));
  if (category && category !== "all") conditions.push(eq(supportTicketsTable.category, category));
  if (search) {
    const sanitized = sanitizeLikeInput(search);
    conditions.push(
      or(
        ilike(supportTicketsTable.subject, `%${sanitized}%`),
        ilike(profilesTable.fullName, `%${sanitized}%`),
        ilike(profilesTable.email, `%${sanitized}%`),
      ) as any,
    );
  }

  const where = conditions.length ? and(...(conditions as any[])) : undefined;

  const [rows, totalRows] = await Promise.all([
    db.select({
      ticket: supportTicketsTable,
      userName: profilesTable.fullName,
      userEmail: profilesTable.email,
      userPhone: profilesTable.phone,
    })
      .from(supportTicketsTable)
      .leftJoin(profilesTable, eq(supportTicketsTable.userId, profilesTable.id))
      .where(where)
      .orderBy(desc(supportTicketsTable.updatedAt))
      .limit(parseInt(limit))
      .offset(parseInt(offset)),
    db.select({ count: sql<number>`count(*)::int` })
      .from(supportTicketsTable)
      .leftJoin(profilesTable, eq(supportTicketsTable.userId, profilesTable.id))
      .where(where),
  ]);

  const tickets = rows.map(r => ({
    ...r.ticket,
    userName: r.userName,
    userEmail: r.userEmail,
    userPhone: r.userPhone,
  }));

  return res.json({ tickets, total: totalRows[0]?.count ?? 0 });
});

router.post("/support/tickets", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const { subject, message, priority = "medium", category } = req.body;

  let assignedTo: string | undefined;
  if (category) {
    const specialtyRow = await db.query.staffSupportSpecialtiesTable.findFirst({
      where: eq(staffSupportSpecialtiesTable.category, category),
    });
    if (specialtyRow) assignedTo = specialtyRow.userId;
  }

  const ticketId = randomUUID();
  const [ticket] = await db.insert(supportTicketsTable).values({
    id: ticketId,
    userId: profile.id,
    subject,
    status: "open",
    priority,
    category: category || null,
    assignedTo: assignedTo || null,
  }).returning();

  if (message) {
    await db.insert(supportMessagesTable).values({
      id: randomUUID(), ticketId, senderId: profile.id, message, isAdmin: false,
    });
  }

  // Notify assigned staff if any
  if (assignedTo) {
    setImmediate(() => createNotification(
      assignedTo!,
      "New Support Ticket",
      `New ${priority} priority ticket: "${subject}"`,
      "support",
    ));
  }

  return res.status(201).json(ticket);
});

router.get("/support/tickets/:id", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const ticket = await db.query.supportTicketsTable.findFirst({
    where: eq(supportTicketsTable.id, req.params.id),
  });
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });

  const isAdmin = ["admin", "super_admin", "staff"].includes(profile.role);
  if (!isAdmin && ticket.userId !== profile.id) return res.status(403).json({ error: "Forbidden" });

  const [messages, userProfile] = await Promise.all([
    db.query.supportMessagesTable.findMany({
      where: eq(supportMessagesTable.ticketId, req.params.id),
      orderBy: supportMessagesTable.createdAt,
    }),
    db.query.profilesTable.findFirst({ where: eq(profilesTable.id, ticket.userId) }),
  ]);

  return res.json({
    ...ticket,
    messages,
    userName: userProfile?.fullName,
    userEmail: userProfile?.email,
    userPhone: userProfile?.phone,
    userRole: userProfile?.role,
  });
});

// SECURITY FIX #3: Only admins/staff can change status, priority, and assignedTo.
// Regular users can only close their own tickets.
router.put("/support/tickets/:id", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const isAdmin = ["admin", "super_admin", "staff"].includes(profile.role);
  const { status, priority, assignedTo } = req.body;

  // Non-admin users: can only close their own tickets
  if (!isAdmin) {
    const ticket = await db.query.supportTicketsTable.findFirst({
      where: eq(supportTicketsTable.id, req.params.id),
    });
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (ticket.userId !== profile.id) return res.status(403).json({ error: "Forbidden" });

    // Users can only set status to "closed" — nothing else
    if (status && status !== "closed") {
      return res.status(403).json({ error: "You can only close your own tickets" });
    }
    if (priority !== undefined || assignedTo !== undefined) {
      return res.status(403).json({ error: "Only admins can change priority or assignment" });
    }

    const [updated] = await db.update(supportTicketsTable)
      .set({ status: "closed", updatedAt: new Date() })
      .where(eq(supportTicketsTable.id, req.params.id))
      .returning();
    return res.json(updated);
  }

  // Admin path — full control
  const updateData: any = { updatedAt: new Date() };
  if (status !== undefined) updateData.status = status;
  if (priority !== undefined) updateData.priority = priority;
  if (assignedTo !== undefined) updateData.assignedTo = assignedTo || null;

  const [ticket] = await db.update(supportTicketsTable)
    .set(updateData)
    .where(eq(supportTicketsTable.id, req.params.id))
    .returning();
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });

  // Notify ticket owner when ticket is resolved
  if (status === "resolved") {
    setImmediate(() => createNotification(
      ticket.userId,
      "Support Ticket Resolved",
      `Your ticket "${ticket.subject}" has been marked as resolved.`,
      "support",
    ));
  }

  return res.json(ticket);
});

// SECURITY FIX #14: Verify sender owns the ticket or is admin before allowing messages.
router.post("/support/tickets/:id/messages", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(clerkUserId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const isAdmin = ["admin", "super_admin", "staff"].includes(profile.role);

  // Verify the sender owns the ticket or is admin
  const ticket = await db.query.supportTicketsTable.findFirst({
    where: eq(supportTicketsTable.id, req.params.id),
  });
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  if (!isAdmin && ticket.userId !== profile.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { message } = req.body;

  const [msg] = await db.insert(supportMessagesTable).values({
    id: randomUUID(), ticketId: req.params.id, senderId: profile.id, message, isAdmin,
  }).returning();

  // Update lastMessageAt and unread counter
  const updateData: any = { lastMessageAt: new Date(), updatedAt: new Date() };
  if (!isAdmin) {
    // User replied — increment admin unread count
    updateData.unreadCountAdmin = sql`${supportTicketsTable.unreadCountAdmin} + 1`;
  }
  const [updatedTicket] = await db.update(supportTicketsTable)
    .set(updateData)
    .where(eq(supportTicketsTable.id, req.params.id))
    .returning();

  // Cross-party notifications
  if (updatedTicket) {
    if (isAdmin) {
      // Admin replied → notify the pilgrim
      setImmediate(() => createNotification(
        updatedTicket.userId,
        "Support Reply",
        `An update has been posted on your ticket: "${updatedTicket.subject}"`,
        "support",
      ));
    } else if (updatedTicket.assignedTo) {
      // Pilgrim replied → notify assigned staff member
      setImmediate(() => createNotification(
        updatedTicket.assignedTo!,
        "Pilgrim Replied",
        `${profile.fullName ?? "A pilgrim"} replied on ticket: "${updatedTicket.subject}"`,
        "support",
      ));
    }
  }

  return res.status(201).json(msg);
});

export default router;
