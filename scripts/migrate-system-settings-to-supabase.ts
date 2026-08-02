#!/usr/bin/env tsx
/**
 * Phase 2 PoC — migrate ONE Airtable table → Supabase: system_settings.
 *
 * Why this table: smallest app-critical lookup (3 fields, no links/attachments).
 *
 * Safety:
 * - Airtable is READ-ONLY (listAllRecords only)
 * - Additive inserts into Supabase (upsert on airtable_id)
 * - Does not touch production services/*.ts
 *
 * Usage:
 *   npx tsx scripts/migrate-system-settings-to-supabase.ts
 *   npx tsx scripts/migrate-system-settings-to-supabase.ts --verify-only
 */

import { config as loadEnv } from "dotenv";
import { randomUUID } from "node:crypto";
import "./_polyfill-websocket";

loadEnv({ path: ".env.local" });
loadEnv();

const AIRTABLE_TABLE = "system_settings";
const SUPABASE_TABLE = "system_settings";
const VERIFY_ONLY = process.argv.includes("--verify-only");

type AirtableFields = {
  setting_key?: string;
  setting_value?: string;
  description?: string;
};

function asText(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

async function main() {
  const { listAllRecords } = await import("../lib/airtable-server");
  const { getSupabaseServiceClient } = await import("../lib/supabase-server");
  const sb = getSupabaseServiceClient();

  console.log(`Reading Airtable table "${AIRTABLE_TABLE}" (READ-ONLY)…`);
  const records = await listAllRecords<AirtableFields>(AIRTABLE_TABLE, {});
  console.log(`Airtable rows: ${records.length}`);

  if (VERIFY_ONLY) {
    const { count, error } = await sb
      .from(SUPABASE_TABLE)
      .select("*", { count: "exact", head: true });
    if (error) throw error;
    console.log(`Supabase rows: ${count ?? 0}`);
    console.log(count === records.length ? "COUNT MATCH" : "COUNT MISMATCH");
    return;
  }

  type Row = {
    id: string;
    airtable_id: string;
    created_time: string | null;
    setting_key: string | null;
    setting_value: string | null;
    description: string | null;
  };

  const rows: Row[] = [];
  const mapRows: { airtable_id: string; table_name: string; supabase_id: string }[] = [];

  for (const rec of records) {
    const id = randomUUID();
    rows.push({
      id,
      airtable_id: rec.id,
      created_time: rec.createdTime ?? null,
      setting_key: asText(rec.fields.setting_key),
      setting_value: asText(rec.fields.setting_value),
      description: asText(rec.fields.description),
    });
    mapRows.push({
      airtable_id: rec.id,
      table_name: SUPABASE_TABLE,
      supabase_id: id,
    });
  }

  if (rows.length === 0) {
    console.log("No Airtable rows to migrate.");
    return;
  }

  console.log(`Inserting ${rows.length} rows into public.${SUPABASE_TABLE}…`);
  const { error: upsertErr } = await sb.from(SUPABASE_TABLE).upsert(rows, {
    onConflict: "airtable_id",
  });
  if (upsertErr) throw new Error(`Upsert ${SUPABASE_TABLE}: ${upsertErr.message}`);

  console.log(`Upserting ${mapRows.length} rows into public._airtable_id_map…`);
  const { error: mapErr } = await sb.from("_airtable_id_map").upsert(mapRows, {
    onConflict: "airtable_id",
  });
  if (mapErr) throw new Error(`Upsert _airtable_id_map: ${mapErr.message}`);

  const { count, error: countErr } = await sb
    .from(SUPABASE_TABLE)
    .select("*", { count: "exact", head: true });
  if (countErr) throw countErr;

  console.log(`\n=== Result ===`);
  console.log(`Airtable: ${records.length}`);
  console.log(`Supabase: ${count ?? 0}`);
  if (count !== records.length) {
    console.error("COUNT MISMATCH");
    process.exit(1);
  }
  console.log("COUNT MATCH");

  // Spot-check up to 3 records field-by-field
  const sample = records.slice(0, Math.min(3, records.length));
  console.log(`\n=== Spot-check (${sample.length}) ===`);
  let spotOk = true;
  for (const rec of sample) {
    const { data, error } = await sb
      .from(SUPABASE_TABLE)
      .select("airtable_id, setting_key, setting_value, description")
      .eq("airtable_id", rec.id)
      .maybeSingle();
    if (error || !data) {
      console.error(`FAIL ${rec.id}:`, error?.message ?? "not found");
      spotOk = false;
      continue;
    }
    const expected = {
      setting_key: asText(rec.fields.setting_key),
      setting_value: asText(rec.fields.setting_value),
      description: asText(rec.fields.description),
    };
    const diffs: string[] = [];
    for (const field of ["setting_key", "setting_value", "description"] as const) {
      const a = expected[field] ?? null;
      const b = (data[field] as string | null) ?? null;
      if (a !== b) diffs.push(`${field}: airtable=${JSON.stringify(a)} supabase=${JSON.stringify(b)}`);
    }
    if (diffs.length) {
      console.error(`FAIL ${rec.id} (${expected.setting_key}):`, diffs.join("; "));
      spotOk = false;
    } else {
      console.log(`OK ${rec.id} key=${JSON.stringify(expected.setting_key)}`);
    }
  }

  if (!spotOk) {
    console.error("\nSPOT-CHECK: FAIL");
    process.exit(1);
  }
  console.log("\nSPOT-CHECK: PASS");
  console.log("MIGRATION PoC (system_settings only): SUCCESS");
  console.log("Stopped — awaiting confirmation before more tables.");
}

main().catch((err) => {
  console.error("MIGRATION FAIL", err);
  process.exit(1);
});
