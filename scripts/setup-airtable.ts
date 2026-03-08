#!/usr/bin/env node
/**
 * Airtable base setup script.
 * Usage: npm run setup:airtable [-- --dry-run] [-- --verify-only]
 * Requires: AIRTABLE_TOKEN, AIRTABLE_BASE_ID
 */

import { env } from "../lib/env.js";
import {
  syncBase,
  verifySchema,
  type SyncResult,
  type VerificationReport,
} from "../lib/airtable-admin.js";
import { AIRTABLE_TABLES } from "../lib/airtable-schema.js";

const log = (msg: string) => console.log(msg);
const logErr = (msg: string) => console.error(msg);

function printSyncResult(r: SyncResult): void {
  log(`\n--- ${r.baseLabel} (${r.baseId}) ---`);
  if (r.tablesCreated.length) {
    r.tablesCreated.forEach((t) => log(`  table created: ${t}`));
  }
  if (r.tablesExisted.length) {
    r.tablesExisted.forEach((t) => log(`  table already exists: ${t}`));
  }
  const fieldsAddedToExisting = r.fieldsCreated.filter((f) =>
    r.tablesExisted.includes(f.table)
  );
  if (fieldsAddedToExisting.length > 0) {
    const byTable = new Map<string, number>();
    for (const f of fieldsAddedToExisting) {
      byTable.set(f.table, (byTable.get(f.table) ?? 0) + 1);
    }
    for (const [table, count] of byTable) {
      log(`  existing table "${table}" updated with ${count} missing field(s) (migration)`);
    }
  }
  if (r.fieldsCreated.length) {
    r.fieldsCreated.forEach(
      ({ table, field }) => log(`  created missing field: ${table}.${field}`)
    );
  }
  if (r.fieldsExisted.length) {
    r.fieldsExisted.forEach(
      ({ table, field }) => log(`  field already exists: ${table}.${field}`)
    );
  }
  if (r.fallbackFields.length) {
    log("  Fallback (API does not support requested type; created with alternate type):");
    const byTable = new Map<string, typeof r.fallbackFields>();
    for (const e of r.fallbackFields) {
      const list = byTable.get(e.table) ?? [];
      list.push(e);
      byTable.set(e.table, list);
    }
    for (const [table, entries] of byTable) {
      for (const e of entries) {
        log(`    ${table}.${e.field}: requested ${e.requestedType} → created as ${e.actualType}`);
      }
    }
  }
  if (r.formulaFieldsToAddManually.length) {
    log("  Formula fields (number placeholder created; add formula in Airtable UI):");
    r.formulaFieldsToAddManually.forEach(({ table, field, formula }) =>
      log(`    - ${table}.${field}: ${formula.slice(0, 60)}...`)
    );
  }
  if (r.errors.length) {
    r.errors.forEach((e) => logErr(`  error: ${e}`));
  }
}

function printVerificationReport(report: VerificationReport): void {
  log(`\n--- ${report.baseLabel} (${report.baseId}) ---`);
  for (const t of report.tables) {
    log(`  Table: ${t.tableName}`);
    for (const f of t.fields) {
      const tag =
        f.status === "exact_match"
          ? "exact_match"
          : f.status === "fallback_match"
            ? `fallback_match${f.actualType ? ` (type: ${f.actualType})` : ""}`
            : "missing";
      log(`    ${f.fieldName}: ${tag}`);
    }
  }
}

async function runSetup(dryRun: boolean): Promise<void> {
  const token = env.AIRTABLE_TOKEN;
  const baseId = env.AIRTABLE_BASE_ID;

  if (dryRun) {
    log("Running in dry-run mode (no changes will be made).\n");
  }

  log("Checking base...");
  const result = await syncBase(
    baseId,
    "Airtable base",
    token,
    AIRTABLE_TABLES,
    dryRun
  );
  printSyncResult(result);

  if (result.errors.length > 0) {
    logErr("\nSetup completed with errors (see above).");
    process.exit(1);
  }

  log("\n--- Final verification (field status) ---");
  const report = await verifySchema(baseId, "Airtable base", token, AIRTABLE_TABLES);
  printVerificationReport(report);

  log("\nSetup complete.");
  log(
    "Note: The API cannot add new options to existing singleSelect fields. If schema added options (e.g. users.role → virtual_assistant, activity_logs.action_type → task_shift_started/task_shift_ended), add those choices manually in the Airtable UI."
  );
}

async function runVerify(): Promise<void> {
  const token = env.AIRTABLE_TOKEN;
  const baseId = env.AIRTABLE_BASE_ID;

  log("Fetching schema and comparing to expected (exact_match / fallback_match / missing)...\n");

  const report = await verifySchema(baseId, "Airtable base", token, AIRTABLE_TABLES);
  printVerificationReport(report);
  log("\nVerification complete.");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const verifyOnly = args.includes("--verify-only");

  try {
    if (verifyOnly) {
      await runVerify();
    } else {
      await runSetup(dryRun);
    }
  } catch (e) {
    logErr(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

main();
