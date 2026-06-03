#!/usr/bin/env node
/**
 * fix-double-counted-payments.mjs
 * 
 * SAFE repair script for the double-counted amountPaid bug.
 * 
 * ROOT CAUSE: During registration (agent & admin walk-in), the booking's
 * amount_paid was pre-populated with the initial payment amount. When that
 * payment was later verified, the verify handler accumulated it again via
 * `amount_paid = amount_paid + payment.amount`, doubling the value.
 * 
 * FIX: For each booking, the correct amount_paid is the SUM of all verified
 * payments. This script finds mismatches and corrects them.
 * 
 * USAGE:
 *   node scripts/fix-double-counted-payments.mjs              # DRY RUN (read-only)
 *   node scripts/fix-double-counted-payments.mjs --apply       # APPLY fixes
 *   node scripts/fix-double-counted-payments.mjs --apply --verbose  # APPLY with detail
 * 
 * SAFETY:
 *   - DRY RUN by default — shows what would change without modifying anything
 *   - Wraps all updates in a single transaction (all-or-nothing)
 *   - Backs up old values in a JSON log before applying
 *   - Fixes booking status if it was incorrectly set due to inflated amountPaid
 *   - Does NOT touch payments table — only corrects bookings.amount_paid
 */

import pg from "pg";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env manually (no dotenv dependency needed) ────────────────────────
function loadEnv() {
  try {
    const envPath = resolve(__dirname, "..", ".env");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (e) {
    // .env not found — rely on environment variables
  }
}

loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not set. Create a .env file or set the environment variable.");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const VERBOSE = process.argv.includes("--verbose");

// ── Connect ─────────────────────────────────────────────────────────────────
const useSSL = DATABASE_URL.includes("neon.tech") ||
               DATABASE_URL.includes("supabase.co") ||
               DATABASE_URL.includes("sslmode=require");

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 30000,
  max: 2,
});

async function main() {
  const client = await pool.connect();

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  FIX DOUBLE-COUNTED PAYMENTS");
  console.log(`  Mode: ${APPLY ? "🔧 APPLY (will modify database)" : "👀 DRY RUN (read-only)"}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  try {
    // ── Step 1: Find all mismatched bookings ───────────────────────────────
    // The correct amount_paid = SUM of all verified payments for that booking.
    // Any booking where amount_paid != that sum has the double-count bug.
    const { rows: mismatched } = await client.query(`
      SELECT
        b.id,
        b.reference,
        b.full_name,
        b.status,
        b.total_price::numeric   AS total_price,
        b.amount_paid::numeric   AS current_paid,
        COALESCE(vp.verified_sum, 0) AS correct_paid,
        b.amount_paid::numeric - COALESCE(vp.verified_sum, 0) AS overstated_by,
        b.agent_id,
        b.created_at
      FROM bookings b
      LEFT JOIN (
        SELECT
          booking_id,
          SUM(amount::numeric) AS verified_sum
        FROM payments
        WHERE status = 'verified'
        GROUP BY booking_id
      ) vp ON vp.booking_id = b.id
      WHERE b.amount_paid::numeric != COALESCE(vp.verified_sum, 0)
        AND b.status != 'cancelled'
      ORDER BY (b.amount_paid::numeric - COALESCE(vp.verified_sum, 0)) DESC
    `);

    if (mismatched.length === 0) {
      console.log("✅ No mismatched bookings found. All amount_paid values are correct!\n");
      return;
    }

    console.log(`⚠️  Found ${mismatched.length} booking(s) with mismatched amount_paid:\n`);

    // ── Step 2: Display report ────────────────────────────────────────────
    const backup = [];
    let totalOverstated = 0;

    for (const row of mismatched) {
      const currentPaid = Number(row.current_paid);
      const correctPaid = Number(row.correct_paid);
      const totalPrice = Number(row.total_price);
      const overstated = Number(row.overstated_by);
      totalOverstated += overstated;

      // Determine what the correct status should be
      const currentStatus = row.status;
      let correctStatus = currentStatus;
      if (correctPaid >= totalPrice && totalPrice > 0) {
        correctStatus = "confirmed";
      } else if (correctPaid > 0 && correctPaid < totalPrice) {
        // Was incorrectly "confirmed" due to inflated amount — should be pending
        if (currentStatus === "confirmed") {
          correctStatus = "pending";
        }
      } else if (correctPaid === 0 && currentStatus === "confirmed") {
        correctStatus = "pending";
      }

      const statusChanged = currentStatus !== correctStatus;

      console.log(`  📋 ${row.reference || row.id.slice(0, 8)}`);
      console.log(`     Name:          ${row.full_name || "—"}`);
      console.log(`     Total Price:   ₦${totalPrice.toLocaleString()}`);
      console.log(`     Current Paid:  ₦${currentPaid.toLocaleString()} ← WRONG`);
      console.log(`     Correct Paid:  ₦${correctPaid.toLocaleString()} ← FIX`);
      console.log(`     Overstated by: ₦${overstated.toLocaleString()}`);
      if (statusChanged) {
        console.log(`     Status:        ${currentStatus} → ${correctStatus}`);
      }
      console.log();

      backup.push({
        id: row.id,
        reference: row.reference,
        fullName: row.full_name,
        totalPrice,
        oldAmountPaid: currentPaid,
        newAmountPaid: correctPaid,
        overstatedBy: overstated,
        oldStatus: currentStatus,
        newStatus: correctStatus,
        statusChanged,
        agentId: row.agent_id,
        createdAt: row.created_at,
      });
    }

    console.log("─────────────────────────────────────────────────────────────");
    console.log(`  TOTAL: ${mismatched.length} booking(s), overstated by ₦${totalOverstated.toLocaleString()}`);
    console.log("─────────────────────────────────────────────────────────────\n");

    // ── Step 3: Print payments breakdown for each (verbose) ───────────────
    if (VERBOSE) {
      console.log("📄 DETAILED PAYMENT BREAKDOWN:\n");
      for (const b of backup) {
        const { rows: payments } = await client.query(
          `SELECT id, amount::numeric as amount, method, status, reference, notes, created_at
           FROM payments WHERE booking_id = $1 ORDER BY created_at`,
          [b.id]
        );
        console.log(`  ${b.reference} — ${b.fullName}:`);
        if (payments.length === 0) {
          console.log("    (no payment records)\n");
        } else {
          for (const p of payments) {
            const amt = Number(p.amount);
            const icon = p.status === "verified" ? "✅" : p.status === "pending" ? "⏳" : "❌";
            console.log(`    ${icon} ₦${amt.toLocaleString()} | ${p.method} | ${p.status} | ${p.reference || "—"} | ${p.notes || ""}`);
          }
          console.log();
        }
      }
    }

    // ── Step 4: Apply fixes ───────────────────────────────────────────────
    if (!APPLY) {
      console.log("💡 This was a DRY RUN. To apply fixes, run:");
      console.log("   node scripts/fix-double-counted-payments.mjs --apply\n");
      console.log("   Add --verbose for detailed payment breakdowns.\n");

      // Print backup JSON for safety
      console.log("📦 BACKUP (save this before applying):");
      console.log(JSON.stringify(backup, null, 2));
      return;
    }

    // Apply all fixes in a single transaction
    console.log("🔧 Applying fixes...\n");
    await client.query("BEGIN");

    try {
      let fixed = 0;
      for (const b of backup) {
        const updates = [`amount_paid = $1`, `updated_at = NOW()`];
        const params = [String(b.newAmountPaid)];
        let paramIdx = 2;

        if (b.statusChanged) {
          updates.push(`status = $${paramIdx}`);
          params.push(b.newStatus);
          paramIdx++;
        }

        params.push(b.id);
        const sql = `UPDATE bookings SET ${updates.join(", ")} WHERE id = $${paramIdx}`;

        const result = await client.query(sql, params);
        if (result.rowCount === 1) {
          fixed++;
          console.log(`  ✅ ${b.reference}: ₦${b.oldAmountPaid.toLocaleString()} → ₦${b.newAmountPaid.toLocaleString()}${b.statusChanged ? ` (${b.oldStatus} → ${b.newStatus})` : ""}`);
        } else {
          console.log(`  ⚠️  ${b.reference}: booking not found (may have been deleted)`);
        }
      }

      await client.query("COMMIT");
      console.log(`\n✅ Successfully fixed ${fixed} of ${backup.length} booking(s).\n`);

      // Print backup for audit trail
      console.log("📦 BACKUP LOG (old values before fix):");
      console.log(JSON.stringify(backup, null, 2));

    } catch (err) {
      await client.query("ROLLBACK");
      console.error("\n❌ ERROR during update — transaction ROLLED BACK. No changes were made.");
      console.error(err);
      process.exit(1);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
