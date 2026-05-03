import { pgTable, text, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const siteSettingsTable = pgTable("site_settings", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  key: text("key").notNull().unique(),
  value: json("value"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: text("updated_by").references(() => profilesTable.id),
});

export const insertSiteSettingSchema = createInsertSchema(siteSettingsTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertSiteSetting = z.infer<typeof insertSiteSettingSchema>;
export type SiteSetting = typeof siteSettingsTable.$inferSelect;
