import { createClient } from "@clerk/backend";
import { db } from "@workspace/db";
import { profilesTable } from "@workspace/db";
import { isNull } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

const clerk = createClient({ secretKey: process.env.CLERK_SECRET_KEY });

async function cleanupOrphanUsers() {
  console.log("Starting Orphan User Cleanup...");
  
  // 1. Get all Clerk users
  console.log("Fetching Clerk users...");
  const { data: clerkUsers } = await clerk.users.getUserList({ limit: 500 });
  const clerkUserIds = new Set(clerkUsers.map(u => u.id));
  console.log(`Found ${clerkUsers.length} Clerk users.`);

  // 2. Get all Neon profiles
  console.log("Fetching DB profiles...");
  const dbProfiles = await db.select({
    id: profilesTable.id,
    clerkUserId: profilesTable.clerkUserId,
    email: profilesTable.email
  }).from(profilesTable);
  const dbClerkIds = new Set(dbProfiles.map(p => p.clerkUserId).filter(Boolean));
  console.log(`Found ${dbProfiles.length} DB profiles.`);

  // 3. Find DB profiles with missing Clerk accounts (Neon -> Clerk mismatch)
  const missingFromClerk = dbProfiles.filter(p => p.clerkUserId && !p.clerkUserId.startsWith('walkin-') && !clerkUserIds.has(p.clerkUserId));
  console.log(`\nFound ${missingFromClerk.length} DB profiles missing in Clerk.`);
  
  // 4. Find Clerk accounts missing in DB (Clerk -> Neon mismatch)
  const missingFromDb = clerkUsers.filter(u => !dbClerkIds.has(u.id));
  console.log(`Found ${missingFromDb.length} Clerk accounts missing in DB.`);

  // --- ACTIONS ---
  
  // Delete Clerk accounts that have no DB profile
  console.log("\n--- Cleaning up Clerk Orphans ---");
  for (const clerkUser of missingFromDb) {
    const email = clerkUser.emailAddresses[0]?.emailAddress || "no-email";
    try {
      console.log(`Deleting Clerk user ${clerkUser.id} (${email})...`);
      await clerk.users.deleteUser(clerkUser.id);
      console.log(`✓ Deleted ${email}`);
    } catch (e: any) {
      console.error(`✗ Failed to delete ${email}: ${e.message}`);
    }
  }

  // Delete DB accounts that have no Clerk profile (using standard deletion script if wanted)
  // For now we will just log them since deleting DB records safely is more complex (handled by API).
  console.log("\n--- DB Orphans (Manual action recommended) ---");
  for (const dbProfile of missingFromClerk) {
    console.log(`DB Orphan: ID ${dbProfile.id} | Email ${dbProfile.email} | Clerk ID ${dbProfile.clerkUserId}`);
    console.log(`-> Consider running DELETE /admin/users/${dbProfile.id} to safely clean this up.`);
  }

  console.log("\nCleanup complete.");
  process.exit(0);
}

cleanupOrphanUsers().catch(console.error);
