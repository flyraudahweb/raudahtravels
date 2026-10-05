import { packagesTable, siteSettingsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { registrationDb as db } from "./database";

export async function availablePackages() {
  const setting = await db.query.siteSettingsTable.findFirst({ where: eq(siteSettingsTable.key, "ai_registration_package_allowlist") });
  let allowlist: string[] | null = null;
  if (setting?.value) {
    const value = typeof setting.value === "string" ? JSON.parse(setting.value) : setting.value;
    if (!Array.isArray(value) || value.some((id) => typeof id !== "string")) throw new Error("Invalid package allowlist");
    allowlist = value;
  }
  const rows = await db.select({ id: packagesTable.id, name: packagesTable.name }).from(packagesTable)
    .where(and(eq(packagesTable.status, "active"), eq(packagesTable.isActive, true), sql`${packagesTable.currentBookings} < ${packagesTable.capacity}`))
    .orderBy(packagesTable.departureDate).limit(100);
  return allowlist === null ? rows : rows.filter((p) => allowlist.includes(p.id));
}
