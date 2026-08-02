#!/usr/bin/env tsx
/**
 * Phase 2 — migrate Airtable tables → Supabase (generic batch runner).
 *
 * Safety:
 * - Airtable READ-ONLY (listAllRecords / getBaseSchema only)
 * - Idempotent upserts on airtable_id + _airtable_id_map
 * - Two-pass: scalars first, then uuid[] link remap
 * - Attachments downloaded → Supabase Storage
 *
 * Usage:
 *   npx tsx scripts/migrate-airtable-to-supabase.ts
 *   npx tsx scripts/migrate-airtable-to-supabase.ts --tables roles,users
 *   npx tsx scripts/migrate-airtable-to-supabase.ts --verify-only
 *   npx tsx scripts/migrate-airtable-to-supabase.ts --pass links
 *   npx tsx scripts/migrate-airtable-to-supabase.ts --pass joins
 *   npx tsx scripts/migrate-airtable-to-supabase.ts --skip-attachments
 */

import { config as loadEnv } from "dotenv";
import "./_polyfill-websocket";

loadEnv({ path: ".env.local" });
loadEnv();

import {
  MIGRATION_ORDER,
  JOIN_TABLE_SPECS,
  attachmentBucketFor,
  buildFieldMap,
  coerceValue,
  countTable,
  loadIdMap,
  migrateAttachmentsForRow,
  newRowId,
  parseInitSchema,
  remapLinks,
  slugifyName,
  upsertBatch,
  type TableMigrationPlan,
} from "./lib/supabase-migrate";

type Args = {
  tables: string[] | null;
  verifyOnly: boolean;
  pass: "all" | "scalars" | "links" | "joins" | "attachments";
  skipAttachments: boolean;
  limit: number | null;
};

function parseArgs(argv: string[]): Args {
  const tablesIdx = argv.indexOf("--tables");
  const tables =
    tablesIdx >= 0 && argv[tablesIdx + 1]
      ? argv[tablesIdx + 1].split(",").map((s) => s.trim()).filter(Boolean)
      : null;
  const passIdx = argv.indexOf("--pass");
  const passRaw = passIdx >= 0 ? argv[passIdx + 1] : "all";
  const pass = (
    ["all", "scalars", "links", "joins", "attachments"].includes(passRaw)
      ? passRaw
      : "all"
  ) as Args["pass"];
  const limitIdx = argv.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(argv[limitIdx + 1]) : null;
  return {
    tables,
    verifyOnly: argv.includes("--verify-only"),
    pass,
    skipAttachments: argv.includes("--skip-attachments"),
    limit: Number.isFinite(limit) ? limit : null,
  };
}

type AirtableFieldMeta = { name: string; type: string };

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { listAllRecords, getBaseSchema } = await import("../lib/airtable-server");
  const { getSupabaseServiceClient } = await import("../lib/supabase-server");
  const sb = getSupabaseServiceClient();

  console.log("Loading Postgres schema + Airtable meta…");
  const pgTables = parseInitSchema();
  const atSchema = await getBaseSchema();
  const atByName = new Map(atSchema.tables.map((t) => [t.name, t]));
  // also index by slugified name
  const atBySlug = new Map<string, (typeof atSchema.tables)[0]>();
  for (const t of atSchema.tables) {
    atBySlug.set(slugifyName(t.name, "table"), t);
    atBySlug.set(t.name, t);
  }

  const wanted = args.tables ?? MIGRATION_ORDER;
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
    // Fix airtable name to exact
    pg.airtableName = atTable.name;
    const fields: AirtableFieldMeta[] = atTable.fields.map((f) => ({
      name: f.name,
      type: f.type,
    }));
    const plan = buildFieldMap(pg, fields);
    plan.airtableName = atTable.name;
    plans.push(plan);
  }

  console.log(`Plans: ${plans.length} | Skipped (pre): ${skipped.length}`);
  for (const s of skipped) console.log(`  SKIP ${s.table}: ${s.reason}`);

  if (args.verifyOnly) {
    console.log("\n=== Verify counts ===");
    let mismatches = 0;
    for (const plan of plans) {
      let atCount = 0;
      try {
        const recs = await listAllRecords(plan.airtableName, {});
        atCount = recs.length;
      } catch (e) {
        console.log(`${plan.pgName}: Airtable ERROR ${(e as Error).message}`);
        continue;
      }
      const sbCount = await countTable(sb, plan.pgName);
      const ok = atCount === sbCount;
      if (!ok) mismatches++;
      console.log(
        `${ok ? "OK" : "MISMATCH"} ${plan.pgName}: airtable=${atCount} supabase=${sbCount}`
      );
    }
    process.exit(mismatches ? 1 : 0);
  }

  const results: Array<{
    table: string;
    airtable: number;
    supabase: number;
    ok: boolean;
    error?: string;
  }> = [];

  // ---------- PASS: scalars (+ optional attachments) ----------
  if (args.pass === "all" || args.pass === "scalars" || args.pass === "attachments") {
    for (const plan of plans) {
      console.log(`\n── ${plan.pgName} ← ${plan.airtableName} (scalars) ──`);
      try {
        // Preserve existing UUIDs on re-run
        const existingMap = await loadIdMap(sb, plan.pgName);
        const records = await listAllRecords<Record<string, unknown>>(plan.airtableName, {});
        const slice = args.limit ? records.slice(0, args.limit) : records;
        console.log(`  Airtable rows: ${records.length} (migrating ${slice.length})`);

        const rows: Record<string, unknown>[] = [];
        const mapRows: { airtable_id: string; table_name: string; supabase_id: string }[] = [];

        for (const rec of slice) {
          const id = existingMap.get(rec.id) ?? newRowId();
          const row: Record<string, unknown> = {
            id,
            airtable_id: rec.id,
            created_time: rec.createdTime ?? null,
          };

          for (const f of plan.scalarFields) {
            if (f.isAttachment) {
              if (args.skipAttachments || args.pass === "scalars") {
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
                if (atts.length) {
                  row[f.pgColumn] = await migrateAttachmentsForRow(sb, {
                    bucket: attachmentBucketFor(plan.pgName, f.pgColumn),
                    table: plan.pgName,
                    airtableId: rec.id,
                    field: f.pgColumn,
                    attachments: atts,
                  });
                } else {
                  row[f.pgColumn] = null;
                }
              }
            } else {
              row[f.pgColumn] = coerceValue(
                rec.fields[f.airtableField],
                f.pgType,
                f.airtableType
              );
            }
          }

          // Leave link fields null in scalar pass (filled in links pass)
          for (const f of plan.linkFields) {
            if (!(f.pgColumn in row)) row[f.pgColumn] = null;
          }

          rows.push(row);
          mapRows.push({
            airtable_id: rec.id,
            table_name: plan.pgName,
            supabase_id: id,
          });
        }

        if (rows.length) {
          await upsertBatch(sb, plan.pgName, rows);
          await upsertBatch(sb, "_airtable_id_map", mapRows, 500);
        }

        const sbCount = await countTable(sb, plan.pgName);
        const ok = sbCount === records.length;
        console.log(`  Supabase: ${sbCount} ${ok ? "COUNT MATCH" : "COUNT MISMATCH"}`);
        // spot-check 2
        for (const rec of slice.slice(0, 2)) {
          const { data } = await sb
            .from(plan.pgName)
            .select("airtable_id")
            .eq("airtable_id", rec.id)
            .maybeSingle();
          console.log(`  spot ${rec.id}: ${data ? "OK" : "MISSING"}`);
        }
        results.push({
          table: plan.pgName,
          airtable: records.length,
          supabase: sbCount,
          ok,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  FAIL: ${msg}`);
        results.push({
          table: plan.pgName,
          airtable: 0,
          supabase: 0,
          ok: false,
          error: msg,
        });
        // Stop on integrity/schema mismatch that doesn't fit pattern
        // Continue other tables; collect blockers in summary (legacy naming quirks)
      }
    }
  }

  // ---------- PASS: links ----------
  if (args.pass === "all" || args.pass === "links") {
    console.log("\n=== Link remap pass ===");
    const globalMap = await loadIdMap(sb);
    console.log(`ID map size: ${globalMap.size}`);

    for (const plan of plans) {
      if (!plan.linkFields.length) continue;
      console.log(`\n── ${plan.pgName} links (${plan.linkFields.map((f) => f.pgColumn).join(", ")}) ──`);
      try {
        const records = await listAllRecords<Record<string, unknown>>(plan.airtableName, {});
        const slice = args.limit ? records.slice(0, args.limit) : records;
        const updates: Record<string, unknown>[] = [];
        let unresolved = 0;
        for (const rec of slice) {
          const patch: Record<string, unknown> = { airtable_id: rec.id };
          // need id for upsert — fetch from map
          const uuid = globalMap.get(rec.id);
          if (!uuid) continue;
          patch.id = uuid;
          for (const f of plan.linkFields) {
            const raw = rec.fields[f.airtableField];
            const mapped = remapLinks(raw, globalMap);
            if (Array.isArray(raw) && raw.length && (!mapped || mapped.length < raw.length)) {
              unresolved += raw.length - (mapped?.length ?? 0);
            }
            patch[f.pgColumn] = mapped;
          }
          updates.push(patch);
        }
        if (updates.length) await upsertBatch(sb, plan.pgName, updates);
        console.log(`  updated ${updates.length} rows; unresolved link refs: ${unresolved}`);
      } catch (e) {
        console.error(`  FAIL links: ${(e as Error).message}`);
      }
    }
  }

  // ---------- PASS: joins ----------
  if (args.pass === "all" || args.pass === "joins") {
    console.log("\n=== Join table pass ===");
    for (const spec of JOIN_TABLE_SPECS) {
      if (args.tables && !args.tables.includes(spec.sourceTable) && !args.tables.includes(spec.joinTable)) {
        continue;
      }
      console.log(`\n── ${spec.joinTable} from ${spec.sourceTable} ──`);
      try {
        const selectCols = spec.leftIsRowId
          ? `id, ${spec.rightSourceField}`
          : `${spec.leftSourceField}, ${spec.rightSourceField}`;
        const { data, error } = await sb.from(spec.sourceTable).select(selectCols);
        if (error) throw error;
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
        // dedupe
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
        const n = await countTable(sb, spec.joinTable);
        console.log(`  rows upserted=${unique.length} table_count=${n}`);
      } catch (e) {
        console.error(`  FAIL join: ${(e as Error).message}`);
      }
    }
  }

  printSummary(results, skipped);
}

function printSummary(
  results: Array<{ table: string; airtable: number; supabase: number; ok: boolean; error?: string }>,
  skipped: Array<{ table: string; reason: string }>
) {
  console.log("\n========== MIGRATION SUMMARY ==========");
  const ok = results.filter((r) => r.ok);
  const bad = results.filter((r) => !r.ok);
  console.log(`OK: ${ok.length} | FAIL/MISMATCH: ${bad.length} | SKIP: ${skipped.length}`);
  for (const r of ok) {
    console.log(`  ✓ ${r.table}: ${r.supabase}`);
  }
  for (const r of bad) {
    console.log(`  ✗ ${r.table}: at=${r.airtable} sb=${r.supabase} ${r.error ?? ""}`);
  }
  for (const s of skipped) {
    console.log(`  ○ ${s.table}: ${s.reason}`);
  }
}

main().catch((err) => {
  console.error("MIGRATION FAIL", err);
  process.exit(1);
});
