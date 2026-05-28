import { pgTable, text, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { packagesTable } from "./packages";

export const packageDatesTable = pgTable("package_dates", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  packageId: text("package_id")
    .notNull()
    .references(() => packagesTable.id, { onDelete: "cascade" }),
  outbound: date("outbound").notNull(),
  outboundRoute: text("outbound_route"),
  returnDate: date("return_date").notNull(),
  returnRoute: text("return_route"),
  airline: text("airline"),
  islamicDate: text("islamic_date"),
  islamicReturnDate: text("islamic_return_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPackageDateSchema = createInsertSchema(packageDatesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPackageDate = z.infer<typeof insertPackageDateSchema>;
export type PackageDate = typeof packageDatesTable.$inferSelect;

import { relations } from "drizzle-orm";

export const packageDatesRelations = relations(packageDatesTable, ({ one }) => ({
  package: one(packagesTable, {
    fields: [packageDatesTable.packageId],
    references: [packagesTable.id],
  }),
}));
