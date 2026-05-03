import { type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { loginSessionsTable, profilesTable } from "@workspace/db";
import { eq, and, isNotNull, gt } from "drizzle-orm";

const ROLES_REQUIRING_2FA = ["admin", "super_admin", "agent"];

export async function require2FA(req: Request, res: Response, next: NextFunction) {
  const { userId: clerkUserId, sessionId: clerkSessionId } = getAuth(req);
  if (!clerkUserId || !clerkSessionId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const profile = await db.query.profilesTable.findFirst({
    where: eq(profilesTable.clerkUserId, clerkUserId),
  });

  if (!profile || !ROLES_REQUIRING_2FA.includes(profile.role)) {
    return next();
  }

  const session = await db.query.loginSessionsTable.findFirst({
    where: and(
      eq(loginSessionsTable.clerkUserId, clerkUserId),
      eq(loginSessionsTable.clerkSessionId, clerkSessionId),
      isNotNull(loginSessionsTable.verifiedAt),
      gt(loginSessionsTable.sessionExpiresAt, new Date()),
    ),
  });

  if (!session) {
    return res.status(403).json({
      error: "2fa_required",
      message: "Two-factor authentication is required. Please verify your identity.",
    });
  }

  return next();
}
