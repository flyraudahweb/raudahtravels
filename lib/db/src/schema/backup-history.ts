import { pgTable, text, timestamp, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const backupHistoryTable = pgTable("backup_history", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  filename: text("filename").notNull(),
  label: text("label"),
  type: text("type").notNull(),
  status: text("status").notNull().default("completed"),
  sizeBytes: integer("size_bytes"),
  tablesIncluded: json("tables_included"),
  totalRecords: integer("total_records"),
  tableStats: json("table_stats"),
  checksum: text("checksum"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: text("created_by").references(() => profilesTable.id),
  createdByName: text("created_by_name"),
});

export const insertBackupHistorySchema = createInsertSchema(backupHistoryTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBackupHistory = z.infer<typeof insertBackupHistorySchema>;
export type BackupHistory = typeof backupHistoryTable.$inferSelect;
