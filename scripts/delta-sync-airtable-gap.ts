#!/usr/bin/env tsx
/**
 * One-time delta sync: Airtable → Supabase for the migration→cutover gap window.
 *
 * Gap window (documented also in docs/supabase-migration/DELTA_SYNC_GAP.md):
 *   START: 2026-08-02T23:28:59.673Z  — first `_airtable_id_map.migrated_at`
 *          (bulk migration started ~02:28 EEST on 2026-08-03)
 *   END:   2026-08-03T23:37:00.000Z  — Production cutover DATA_BACKEND=supabase
 *          (~02:37 EEST on 2026-08-04; see CUTOVER_EXECUTED.md)
 *
 * Safety:
 * - Airtable is READ-ONLY (listAllRecords / getBaseSchema only)
 * - Never overwrite Supabase rows modified at/after cutover (prefer Supabase; flag)
 * - Only sync Airtable records whose LAST_MODIFIED_TIME() falls in the gap window
 *
 * Usage:
 *   npx tsx scripts/delta-sync-airtable-gap.ts --dry-run
 *   npx tsx scripts/delta-sync-airtable-gap.ts
 *   npx tsx scripts/delta-sync-airtable-gap.ts --tables va_tasks,notifications
 *   npx tsx scripts/delta-sync-airtable-gap.ts --skip-attachments
 *   npx tsx scripts/delta-sync-airtable-gap.ts --priority-only
 */

import { config as loadEnv } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import "./_polyfill-websocket";

loadEnv({ path: ".env.local" });
loadEnv();

import {
  JOIN_TABLE_SPECS,
  MIGRATION_ORDER,
  attachmentBucketFor,
  buildFieldMap,
  coerceValue,
  loadIdMap,
  migrateAttachmentsForRow,
  newRowId,
  parseInitSchema,
  remapLinks,
  slugifyName,
  upsertBatch,
  type TableMigrationPlan,
} from "./lib/supabase-migrate";

/** Bulk migration first `_airtable_id_map.migrated_at` (UTC). */
export const GAP_START_ISO = "2026-08-02T23:28:59.673Z";
/** Production cutover ~02:37 EEST = 23:37 UTC previous calendar day. */
export const GAP_END_ISO = "2026-08-03T23:37:00.000Z";

/** High-activity tables first (then remaining MIGRATION_ORDER). */
const PRIORITY_TABLES = [
  "va_tasks",
  "va_task_phase_items",
  "notifications",
  "shifts",
  "shift_models",
  "custom_requests",
  "winner_videos",
] as const;

type Args = {
  dryRun: boolean;
  tables: string[] | null;
  skipAttachments: boolean;
  priorityOnly: boolean;
  limit: number | null;
};

type SyncAction = "insert" | "update" | "skip_conflict" | "skip_unchanged" | "error";

type SyncLogEntry = {
  table: string;
  airtable_id: string;
  supabase_id: string | null;
  action: SyncAction;
  reason?: string;
  airtable_created?: string | null;
  sb_updated_at?: string | null;
};

type TableSummary = {
  table: string;
  airtableGap: number;
  inserts: number;
  updates: number;
  skipConflict: number;
  errors: number;
  errorMessage?: string;
};

function parseArgs(argv: string[]): Args {
  const tablesIdx = argv.indexOf("--tables");
  const tables =
    tablesIdx >= 0 && argv[tablesIdx + 1]
      ? argv[tablesIdx + 1].split(",").map((s) => s.trim()).filter(Boolean)
      : null;
  const limitIdx = argv.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(argv[limitIdx + 1]) : null;
  return {
    dryRun: argv.includes("--dry-run"),
    tables,
    skipAttachments: argv.includes("--skip-attachments"),
    priorityOnly: argv.includes("--priority-only"),
    limit: Number.isFinite(limit) ? limit : null,
  };
}

function gapFilterFormula(startIso: string, endIso: string): string {
  // LAST_MODIFIED_TIME() covers creates + field edits. Exclusive of cutover end.
  return `AND(IS_AFTER(LAST_MODIFIED_TIME(), '${startIso}'), IS_BEFORE(LAST_MODIFIED_TIME(), '${endIso}'))`;
}

function orderedTables(args: Args): string[] {
  if (args.tables?.length) return args.tables;
  if (args.priorityOnly) return [...PRIORITY_TABLES];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...PRIORITY_TABLES, ...MIGRATION_ORDER]) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function tsMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : null;
}

function preferSupabase(
  sbUpdatedAt: string | null | undefined,
  cutoverIso: string
): boolean {
  const sb = tsMs(sbUpdatedAt);
  const cut = tsMs(cutoverIso);
  if (sb == null || cut == null) return false;
  return sb >= cut;
}

async function tableHasColumn(
  sb: Awaited<ReturnType<typeof import("../lib/supabase-server").getSupabaseServiceClient>>,
  table: string,
  column: string
): Promise<boolean> {
  // Probe via selecting one row; PostgREST errors if column missing.
  const { error } = await sb.from(table).select(column).limit(1);
  if (!error) return true;
  if (/column .* does not exist/i.test(error.message)) return false;
  // Other errors (empty table etc.) — assume column exists if not "does not exist"
  return !/Could not find/i.test(error.message);
}

async function fetchExistingMeta(
  sb: Awaited<ReturnType<typeof import("../lib/supabase-server").getSupabaseServiceClient>>,
  table: string,
  airtableIds: string[],
  hasUpdatedAt: boolean
): Promise<Map<string, { id: string; updated_at: string | null }>> {
  const map = new Map<string, { id: string; updated_at: string | null }>();
  if (!airtableIds.length) return map;
  const cols = hasUpdatedAt ? "id, airtable_id, updated_at" : "id, airtable_id";
  const chunk = 200;
  for (let i = 0; i < airtableIds.length; i += chunk) {
    const slice = airtableIds.slice(i, i + chunk);
    const { data, error } = await sb.from(table).select(cols).in("airtable_id", slice);
    if (error) throw new Error(`fetchExistingMeta ${table}: ${error.message}`);
    for (const row of data ?? []) {
      const r = row as unknown as { id: string; airtable_id: string; updated_at?: string | null };
      map.set(r.airtable_id, {
        id: r.id,
        updated_at: hasUpdatedAt ? (r.updated_at ?? null) : null,
      });
    }
  }
  return map;
}

async function refreshJoinsFor(
  sb: Awaited<ReturnType<typeof import("../lib/supabase-server").getSupabaseServiceClient>>,
  sourceTables: Set<string>,
  dryRun: boolean
): Promise<void> {
  for (const spec of JOIN_TABLE_SPECS) {
    if (!sourceTables.has(spec.sourceTable)) continue;
    console.log(`  join refresh ${spec.joinTable} ← ${spec.sourceTable}`);
    if (dryRun) continue;
    const selectCols = spec.leftIsRowId
      ? `id, ${spec.rightSourceField}`
      : `${spec.leftSourceField}, ${spec.rightSourceField}`;
    const { data, error } = await sb.from(spec.sourceTable).select(selectCols);
    if (error) throw new Error(`join ${spec.joinTable}: ${error.message}`);
    const rows: Record<string, string>[] = [];
    for (const raw of data ?? []) {
      const r = raw as unknown as Record<string, unknown>;
      const leftVals = spec.leftIsRowId
        ? [r.id as string]
        : ((r[spec.leftSourceField] as string[] | null) ?? []);
      const rightVals = (r[spec.rightSourceField] as string[] | null) ?? [];
      for (const L of leftVals) {
        for (const R of rightVals) {
          if (L && R) rows.push({ [spec.leftCol]: L, [spec.rightCol]: R });
        }
      }
    }
    const seen = new Set<string>();
    const unique = rows.filter((row) => {
      const k = `${row[spec.leftCol]}|${row[spec.rightCol]}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (unique.length) {
      const { error: upErr } = await sb.from(spec.joinTable).upsert(unique);
      if (upErr) throw upErr;
    }
    console.log(`    upserted ${unique.length} join rows`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { listAllRecords, getBaseSchema } = await import("../lib/airtable-server");
  const { getSupabaseServiceClient } = await import("../lib/supabase-server");
  const sb = getSupabaseServiceClient();

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const auditDir = path.join(process.cwd(), "docs/supabase-migration/delta-sync-logs");
  mkdirSync(auditDir, { recursive: true });
  const auditPath = path.join(
    auditDir,
    `delta-sync-${args.dryRun ? "dryrun-" : ""}${runId}.jsonl`
  );

  console.log("═══════════════════════════════════════════════════════════");
  console.log(" Delta sync Airtable → Supabase (gap window)");
  console.log(` GAP_START: ${GAP_START_ISO}  (bulk migration start)`);
  console.log(` GAP_END:   ${GAP_END_ISO}  (production cutover)`);
  console.log(` Mode:      ${args.dryRun ? "DRY-RUN (no writes)" : "LIVE WRITE"}`);
  console.log(` Audit:     ${auditPath}`);
  console.log("═══════════════════════════════════════════════════════════");

  const formula = gapFilterFormula(GAP_START_ISO, GAP_END_ISO);
  console.log(` filterByFormula: ${formula}`);

  const pgTables = parseInitSchema();
  const atSchema = await getBaseSchema();
  const atByName = new Map(atSchema.tables.map((t) => [t.name, t]));
  const atBySlug = new Map<string, (typeof atSchema.tables)[0]>();
  for (const t of atSchema.tables) {
    atBySlug.set(slugifyName(t.name, "table"), t);
    atBySlug.set(t.name, t);
  }

  const wanted = orderedTables(args);
  const plans: TableMigrationPlan[] = [];
  const skipped: Array<{ table: string; reason: string }> = [];

  for (const pgName of wanted) {
    const pg = pgTables.get(pgName);
    if (!pg) {
      skipped.push({ table: pgName, reason: "not in init schema" });
      continue;
    }
    const atName = pg.airtableName ?? pgName;
    const atTable = atByName.get(atName) ?? atBySlug.get(atName) ?? atBySlug.get(pgName);
    if (!atTable) {
      skipped.push({ table: pgName, reason: `Airtable table missing: ${atName}` });
      continue;
    }
    pg.airtableName = atTable.name;
    const plan = buildFieldMap(
      pg,
      atTable.fields.map((f) => ({ name: f.name, type: f.type }))
    );
    plan.airtableName = atTable.name;
    plans.push(plan);
  }

  console.log(`\nPlans: ${plans.length} | Pre-skip: ${skipped.length}`);
  for (const s of skipped) console.log(`  SKIP ${s.table}: ${s.reason}`);

  // Global id map for link remapping (includes rows we insert as we go)
  const globalMap = await loadIdMap(sb);
  console.log(`ID map size: ${globalMap.size}`);

  const allLogs: SyncLogEntry[] = [];
  const summaries: TableSummary[] = [];
  const touchedForJoins = new Set<string>();

  const appendLog = (entry: SyncLogEntry) => {
    allLogs.push(entry);
    writeFileSync(auditPath, allLogs.map((e) => JSON.stringify(e)).join("\n") + "\n");
  };

  for (const plan of plans) {
    console.log(`\n── ${plan.pgName} ← ${plan.airtableName} ──`);
    const summary: TableSummary = {
      table: plan.pgName,
      airtableGap: 0,
      inserts: 0,
      updates: 0,
      skipConflict: 0,
      errors: 0,
    };

    try {
      const records = await listAllRecords<Record<string, unknown>>(plan.airtableName, {
        filterByFormula: formula,
      });
      const slice = args.limit ? records.slice(0, args.limit) : records;
      summary.airtableGap = slice.length;
      console.log(`  gap records: ${records.length}${args.limit ? ` (limited to ${slice.length})` : ""}`);

      if (!slice.length) {
        summaries.push(summary);
        continue;
      }

      const tableMap = await loadIdMap(sb, plan.pgName);
      const hasUpdatedAt = await tableHasColumn(sb, plan.pgName, "updated_at");
      const existing = await fetchExistingMeta(
        sb,
        plan.pgName,
        slice.map((r) => r.id),
        hasUpdatedAt
      );

      const upsertRows: Record<string, unknown>[] = [];
      const mapRows: { airtable_id: string; table_name: string; supabase_id: string }[] = [];

      for (const rec of slice) {
        const existingMeta = existing.get(rec.id);
        const mappedId = tableMap.get(rec.id) ?? existingMeta?.id ?? globalMap.get(rec.id);
        const isInsert = !mappedId;

        if (!isInsert && preferSupabase(existingMeta?.updated_at, GAP_END_ISO)) {
          summary.skipConflict++;
          appendLog({
            table: plan.pgName,
            airtable_id: rec.id,
            supabase_id: mappedId ?? null,
            action: "skip_conflict",
            reason: `supabase updated_at=${existingMeta?.updated_at} >= cutover ${GAP_END_ISO}`,
            airtable_created: rec.createdTime ?? null,
            sb_updated_at: existingMeta?.updated_at ?? null,
          });
          continue;
        }

        const id = mappedId ?? newRowId();
        const row: Record<string, unknown> = {
          id,
          airtable_id: rec.id,
          created_time: rec.createdTime ?? null,
        };

        for (const f of plan.scalarFields) {
          if (f.isAttachment) {
            if (args.skipAttachments) {
              row[f.pgColumn] = coerceValue(rec.fields[f.airtableField], f.pgType, f.airtableType);
            } else {
              const raw = rec.fields[f.airtableField];
              const atts = Array.isArray(raw)
                ? (raw as Array<{ url?: string; filename?: string; type?: string }>)
                    .filter((a) => a?.url)
                    .map((a) => ({
                      url: a.url!,
                      filename: a.filename,
                      type: a.type,
                    }))
                : [];
              if (!atts.length) {
                row[f.pgColumn] = null;
              } else if (args.dryRun) {
                row[f.pgColumn] = atts.map((a) => a.url);
              } else {
                // Reuse existing sb:// tokens when present and count matches
                const { data: existingRow } = await sb
                  .from(plan.pgName)
                  .select(f.pgColumn)
                  .eq("airtable_id", rec.id)
                  .maybeSingle();
                const existingUrls = (existingRow as Record<string, unknown> | null)?.[f.pgColumn];
                const alreadyMigrated =
                  Array.isArray(existingUrls) &&
                  existingUrls.length === atts.length &&
                  existingUrls.every((u) => typeof u === "string" && u.startsWith("sb://"));
                if (alreadyMigrated) {
                  row[f.pgColumn] = existingUrls;
                } else {
                  row[f.pgColumn] = await migrateAttachmentsForRow(sb, {
                    bucket: attachmentBucketFor(plan.pgName, f.pgColumn),
                    table: plan.pgName,
                    airtableId: rec.id,
                    field: f.pgColumn,
                    attachments: atts,
                  });
                }
              }
            }
          } else {
            row[f.pgColumn] = coerceValue(rec.fields[f.airtableField], f.pgType, f.airtableType);
          }
        }

        for (const f of plan.linkFields) {
          const raw = rec.fields[f.airtableField];
          // Prefer remapped UUIDs; leave null if none resolve yet (hubs may sync later)
          row[f.pgColumn] = remapLinks(raw, globalMap);
        }

        const action: SyncAction = isInsert ? "insert" : "update";
        if (isInsert) summary.inserts++;
        else summary.updates++;

        appendLog({
          table: plan.pgName,
          airtable_id: rec.id,
          supabase_id: id,
          action,
          airtable_created: rec.createdTime ?? null,
          sb_updated_at: existingMeta?.updated_at ?? null,
        });

        upsertRows.push(row);
        mapRows.push({ airtable_id: rec.id, table_name: plan.pgName, supabase_id: id });
        globalMap.set(rec.id, id);
        tableMap.set(rec.id, id);
      }

      if (upsertRows.length) {
        console.log(
          `  will ${args.dryRun ? "simulate" : "upsert"} ${upsertRows.length} ` +
            `(+${summary.inserts} / ~${summary.updates}) | conflicts skipped: ${summary.skipConflict}`
        );
        if (!args.dryRun) {
          await upsertBatch(sb, plan.pgName, upsertRows);
          await upsertBatch(sb, "_airtable_id_map", mapRows, 500);
          touchedForJoins.add(plan.pgName);
        }
      } else {
        console.log(`  nothing to write (conflicts=${summary.skipConflict})`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  FAIL: ${msg}`);
      summary.errors++;
      summary.errorMessage = msg;
      appendLog({
        table: plan.pgName,
        airtable_id: "*",
        supabase_id: null,
        action: "error",
        reason: msg,
      });
    }

    summaries.push(summary);
  }

  // Second pass: remap links for synced rows (global map now includes inserts)
  if (!args.dryRun) {
    console.log("\n=== Link remap pass (gap rows only) ===");
    for (const plan of plans) {
      if (!plan.linkFields.length) continue;
      const summary = summaries.find((s) => s.table === plan.pgName);
      if (!summary || summary.inserts + summary.updates === 0) continue;
      try {
        const records = await listAllRecords<Record<string, unknown>>(plan.airtableName, {
          filterByFormula: formula,
        });
        const updates: Record<string, unknown>[] = [];
        for (const rec of records) {
          const uuid = globalMap.get(rec.id);
          if (!uuid) continue;
          // Skip conflicted rows
          const conflicted = allLogs.some(
            (l) =>
              l.table === plan.pgName &&
              l.airtable_id === rec.id &&
              l.action === "skip_conflict"
          );
          if (conflicted) continue;
          const patch: Record<string, unknown> = { id: uuid, airtable_id: rec.id };
          for (const f of plan.linkFields) {
            patch[f.pgColumn] = remapLinks(rec.fields[f.airtableField], globalMap);
          }
          updates.push(patch);
        }
        if (updates.length) {
          await upsertBatch(sb, plan.pgName, updates);
          console.log(`  ${plan.pgName}: remapped ${updates.length} link rows`);
          touchedForJoins.add(plan.pgName);
        }
      } catch (e) {
        console.error(`  FAIL links ${plan.pgName}: ${(e as Error).message}`);
      }
    }

    console.log("\n=== Join table refresh (touched sources) ===");
    await refreshJoinsFor(sb, touchedForJoins, args.dryRun);
  }

  // Summary
  console.log("\n========== DELTA SYNC SUMMARY ==========");
  let ti = 0,
    tu = 0,
    tc = 0,
    te = 0,
    tg = 0;
  for (const s of summaries) {
    tg += s.airtableGap;
    ti += s.inserts;
    tu += s.updates;
    tc += s.skipConflict;
    te += s.errors;
    if (s.airtableGap || s.errors) {
      console.log(
        `  ${s.table}: gap=${s.airtableGap} insert=${s.inserts} update=${s.updates} ` +
          `conflict=${s.skipConflict}${s.errorMessage ? ` ERR=${s.errorMessage}` : ""}`
      );
    }
  }
  console.log(
    `\nTOTALS: gap_rows=${tg} inserts=${ti} updates=${tu} conflicts=${tc} table_errors=${te}`
  );
  console.log(`Audit log: ${auditPath}`);
  console.log(`Dry-run: ${args.dryRun}`);

  // Write machine-readable summary next to audit
  const summaryPath = auditPath.replace(/\.jsonl$/, "-summary.json");
  writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        gapStart: GAP_START_ISO,
        gapEnd: GAP_END_ISO,
        dryRun: args.dryRun,
        generatedAt: new Date().toISOString(),
        totals: {
          gapRows: tg,
          inserts: ti,
          updates: tu,
          conflicts: tc,
          tableErrors: te,
        },
        tables: summaries,
        preSkipped: skipped,
        conflicts: allLogs.filter((l) => l.action === "skip_conflict"),
      },
      null,
      2
    )
  );
  console.log(`Summary JSON: ${summaryPath}`);

  if (te > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("DELTA SYNC FAIL", err);
  process.exit(1);
});
