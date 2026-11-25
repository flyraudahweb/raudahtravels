import { db, profilesTable, staffPermissionsTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

type Profile = Pick<typeof profilesTable.$inferSelect, "id" | "role" | "accountStatus">;

export function activeBookingProfile(clerkUserId: string) {
  return db.query.profilesTable.findFirst({
    where: and(eq(profilesTable.clerkUserId, clerkUserId), eq(profilesTable.accountStatus, "active")),
  });
}

export async function hasStaffGrant(profile: Profile, ...permissions: string[]) {
  if (profile.accountStatus !== "active") return false;
  if (profile.role === "admin" || profile.role === "super_admin") return true;
  if (profile.role !== "staff" || !permissions.length) return false;
  return !!await db.query.staffPermissionsTable.findFirst({
    where: and(eq(staffPermissionsTable.userId, profile.id), inArray(staffPermissionsTable.permission, permissions)),
  });
}
