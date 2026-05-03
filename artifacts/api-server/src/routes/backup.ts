import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db, pool } from "@workspace/db";
import { profilesTable, backupHistoryTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { createHash } from "crypto";
import { randomUUID } from "crypto";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 512 * 1024 * 1024 } });

const BACKUP_FORMAT_VERSION = "1.0";
const APP_ID = "raudah-travels-tours";

/* ── Tables to export (FK-safe order) ─────────────────────────────────────── */

const EXPORTABLE_TABLES: { key: string; label: string; group: string }[] = [
  { key: "profiles",                    label: "User Profiles",           group: "Core" },
  { key: "packages",                    label: "Packages",                group: "Core" },
  { key: "package_dates",               label: "Package Dates",           group: "Core" },
  { key: "package_accommodations",      label: "Package Accommodations",  group: "Core" },
  { key: "bank_accounts",               label: "Bank Accounts",           group: "Finance" },
  { key: "site_settings",               label: "Site Settings",           group: "System" },
  { key: "booking_form_fields",         label: "Booking Form Fields",     group: "System" },
  { key: "visa_providers",              label: "Visa Providers",          group: "Visa" },
  { key: "contact_messages",            label: "Contact Messages",        group: "Enquiries" },
  { key: "agents",                      label: "Agents",                  group: "Agents" },
  { key: "agent_applications",          label: "Agent Applications",      group: "Agents" },
  { key: "agent_clients",               label: "Agent Clients",           group: "Agents" },
  { key: "agent_wallets",               label: "Agent Wallets",           group: "Finance" },
  { key: "agent_package_discounts",     label: "Agent Package Discounts", group: "Agents" },
  { key: "admin_otp_requests",          label: "Admin OTP Requests",      group: "System" },
  { key: "chat_channels",               label: "Chat Channels",           group: "System" },
  { key: "staff_permissions",           label: "Staff Permissions",       group: "System" },
  { key: "staff_support_specialties",   label: "Staff Specialties",       group: "System" },
  { key: "bookings",                    label: "Bookings",                group: "Operations" },
  { key: "payments",                    label: "Payments",                group: "Finance" },
  { key: "commissions",                 label: "Commissions",             group: "Finance" },
  { key: "wallet_transactions",         label: "Wallet Transactions",     group: "Finance" },
  { key: "documents",                   label: "Documents",               group: "Operations" },
  { key: "notifications",               label: "Notifications",           group: "System" },
  { key: "support_tickets",             label: "Support Tickets",         group: "Support" },
  { key: "support_messages",            label: "Support Messages",        group: "Support" },
  { key: "visa_applications",           label: "Visa Applications",       group: "Visa" },
  { key: "booking_amendment_requests",  label: "Amendment Requests",      group: "Operations" },
  { key: "user_activity",               label: "User Activity",           group: "Audit" },
  { key: "staff_messages",              label: "Staff Messages",          group: "System" },
];

/* ── Auth guard (admin/super_admin only) ───────────────────────────────────── */

async function requireAdminOnly(req: Request, res: Response, next: NextFunction) {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await db.query.profilesTable.findFirst({ where: eq(profilesTable.clerkUserId, clerkUserId) });
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return res.status(403).json({ error: "Admin access required for backup operations" });
  }
  (req as any)._backupUser = profile;
  return next();
}

router.use("/admin/backup", requireAdminOnly as any);

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function computeChecksum(data: Record<string, unknown[]>): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(data));
  return `sha256:${hash.digest("hex")}`;
}

function verifyChecksum(data: Record<string, unknown[]>, checksum: string): boolean {
  return computeChecksum(data) === checksum;
}

async function exportTable(tableName: string): Promise<unknown[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`SELECT * FROM "${tableName}" ORDER BY created_at ASC NULLS LAST`);
    return result.rows;
  } catch {
    const result = await client.query(`SELECT * FROM "${tableName}"`);
    return result.rows;
  } finally {
    client.release();
  }
}

/* ── GET /api/admin/backup/tables ─────────────────────────────────────────── */

router.get("/admin/backup/tables", (_req, res) => {
  return res.json({ tables: EXPORTABLE_TABLES });
});

/* ── GET /api/admin/backup/history ───────────────────────────────────────── */

router.get("/admin/backup/history", async (_req, res) => {
  const history = await db.query.backupHistoryTable.findMany({
    orderBy: [desc(backupHistoryTable.createdAt)],
    limit: 50,
  });
  return res.json({ history });
});

/* ── POST /api/admin/backup/export ───────────────────────────────────────── */

router.post("/admin/backup/export", async (req, res) => {
  const user = (req as any)._backupUser;
  const { tables: requestedTables, label } = req.body as {
    tables?: string[];
    label?: string;
  };

  const tablesToExport = requestedTables?.length
    ? EXPORTABLE_TABLES.filter(t => requestedTables.includes(t.key))
    : EXPORTABLE_TABLES;

  const exportedAt = new Date().toISOString();
  const data: Record<string, unknown[]> = {};
  const tableStats: Record<string, number> = {};
  let totalRecords = 0;
  const errors: string[] = [];

  for (const table of tablesToExport) {
    try {
      const rows = await exportTable(table.key);
      data[table.key] = rows;
      tableStats[table.key] = rows.length;
      totalRecords += rows.length;
    } catch (err: any) {
      errors.push(`${table.key}: ${err.message}`);
      data[table.key] = [];
      tableStats[table.key] = 0;
    }
  }

  const checksum = computeChecksum(data);

  const backup = {
    meta: {
      version: BACKUP_FORMAT_VERSION,
      app: APP_ID,
      exportedAt,
      exportedBy: user.email || user.id,
      exportedByName: user.fullName || user.email || "Admin",
      label: label || `Backup ${new Date(exportedAt).toLocaleDateString()}`,
      schemaVersion: 1,
      totalTables: tablesToExport.length,
      totalRecords,
      tableStats,
      checksum,
      errors: errors.length ? errors : undefined,
    },
    data,
  };

  const json = JSON.stringify(backup, null, 2);
  const sizeBytes = Buffer.byteLength(json, "utf8");

  const safeLabel = (label || "full").replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 40);
  const datePart = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const filename = `raudah-backup-${datePart}-${safeLabel}.json`;

  await db.insert(backupHistoryTable).values({
    id: randomUUID(),
    filename,
    label: label || "Full Backup",
    type: "export",
    status: errors.length ? "partial" : "completed",
    sizeBytes,
    tablesIncluded: tablesToExport.map(t => t.key),
    totalRecords,
    tableStats,
    checksum,
    notes: errors.length ? `Errors on: ${errors.join("; ")}` : null,
    createdBy: user.id,
    createdByName: user.fullName || user.email,
  });

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", sizeBytes);
  return res.send(json);
});

/* ── POST /api/admin/backup/import ───────────────────────────────────────── */

router.post(
  "/admin/backup/import",
  upload.single("file"),
  async (req, res) => {
    const user = (req as any)._backupUser;
    const dryRun = req.body.dryRun === "true" || req.body.dryRun === true;
    const mode: "upsert" | "skip" = req.body.mode === "skip" ? "skip" : "upsert";

    if (!req.file) {
      return res.status(400).json({ error: "No backup file provided" });
    }

    /* ── Parse ── */
    let backup: any;
    try {
      backup = JSON.parse(req.file.buffer.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Invalid file: not valid JSON" });
    }

    /* ── Validate structure ── */
    if (!backup.meta || !backup.data) {
      return res.status(400).json({ error: "Invalid backup file: missing meta or data sections" });
    }
    if (backup.meta.app !== APP_ID) {
      return res.status(400).json({
        error: `Invalid backup: this file is for app '${backup.meta.app}', expected '${APP_ID}'`,
      });
    }

    /* ── Verify checksum ── */
    const checksumValid = backup.meta.checksum ? verifyChecksum(backup.data, backup.meta.checksum) : false;
    if (!checksumValid) {
      return res.status(400).json({
        error: "Backup integrity check failed: checksum mismatch. The file may be corrupted or tampered.",
      });
    }

    /* ── Dry run: return preview only ── */
    const tableSummary = Object.entries(backup.data as Record<string, unknown[]>).map(([name, rows]) => ({
      table: name,
      records: rows.length,
    }));
    const totalRecords = tableSummary.reduce((s, t) => s + t.records, 0);

    if (dryRun) {
      return res.json({
        dryRun: true,
        valid: true,
        checksumValid,
        meta: backup.meta,
        tableSummary,
        totalRecords,
        message: "Dry run successful — no changes made",
      });
    }

    /* ── Full restore ── */
    const importedTables: string[] = [];
    const tableStats: Record<string, number> = {};
    const warnings: string[] = [];
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query("SET session_replication_role = replica");

      const BATCH_SIZE = 500;

      for (const { table } of tableSummary) {
        const rows = (backup.data[table] as Record<string, unknown>[]) || [];
        if (rows.length === 0) continue;

        try {
          const cols = Object.keys(rows[0]);
          if (cols.length === 0) continue;

          const colsSql = cols.map(c => `"${c}"`).join(", ");
          const conflictCols = cols.filter(c => c !== "id");

          let totalInserted = 0;
          for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            const valuesPlaceholders = batch
              .map((_, ri) => `(${cols.map((_, ci) => `$${ri * cols.length + ci + 1}`).join(", ")})`)
              .join(", ");
            const flatValues = batch.flatMap(row => cols.map(col => {
              const v = row[col];
              if (v !== null && typeof v === "object") return JSON.stringify(v);
              return v ?? null;
            }));

            let sql: string;
            if (mode === "upsert" && conflictCols.length > 0) {
              const updateSql = conflictCols.map(c => `"${c}" = EXCLUDED."${c}"`).join(", ");
              sql = `INSERT INTO "${table}" (${colsSql}) VALUES ${valuesPlaceholders} ON CONFLICT (id) DO UPDATE SET ${updateSql}`;
            } else {
              sql = `INSERT INTO "${table}" (${colsSql}) VALUES ${valuesPlaceholders} ON CONFLICT (id) DO NOTHING`;
            }

            const result = await client.query(sql, flatValues);
            totalInserted += result.rowCount ?? 0;
          }

          importedTables.push(table);
          tableStats[table] = totalInserted;
        } catch (err: any) {
          warnings.push(`Skipped table '${table}': ${err.message}`);
        }
      }

      await client.query("SET session_replication_role = DEFAULT");
      await client.query("COMMIT");
    } catch (err: any) {
      await client.query("ROLLBACK").catch(() => {});
      await client.query("SET session_replication_role = DEFAULT").catch(() => {});
      client.release();

      await db.insert(backupHistoryTable).values({
        id: randomUUID(),
        filename: req.file.originalname,
        label: backup.meta?.label || "Restore",
        type: "import",
        status: "failed",
        sizeBytes: req.file.size,
        tablesIncluded: Object.keys(backup.data),
        totalRecords,
        notes: `Error: ${err.message}`,
        createdBy: user.id,
        createdByName: user.fullName || user.email,
      });

      return res.status(500).json({ error: `Restore failed: ${err.message}` });
    }

    client.release();

    const totalRestored = Object.values(tableStats).reduce((s, c) => s + c, 0);

    await db.insert(backupHistoryTable).values({
      id: randomUUID(),
      filename: req.file.originalname,
      label: backup.meta?.label || "Restore",
      type: "import",
      status: warnings.length > 0 ? "partial" : "completed",
      sizeBytes: req.file.size,
      tablesIncluded: importedTables,
      totalRecords: totalRestored,
      tableStats,
      checksum: backup.meta?.checksum,
      notes: warnings.length ? warnings.slice(0, 5).join("; ") : null,
      createdBy: user.id,
      createdByName: user.fullName || user.email,
    });

    return res.json({
      success: true,
      mode,
      tablesRestored: importedTables.length,
      totalRecords: totalRestored,
      tableStats,
      warnings,
      meta: backup.meta,
    });
  },
);

/* ── DELETE /api/admin/backup/history/:id ─────────────────────────────────── */

router.delete("/admin/backup/history/:id", async (req, res) => {
  await db.delete(backupHistoryTable).where(eq(backupHistoryTable.id, req.params.id));
  return res.json({ success: true });
});

export default router;
