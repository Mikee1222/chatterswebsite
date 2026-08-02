#!/usr/bin/env tsx
/**
 * Phase 2 PoC — confirm Supabase service-role connectivity.
 *
 * Usage:
 *   npx tsx scripts/supabase-connectivity-check.ts
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * (and optionally NEXT_PUBLIC_SUPABASE_ANON_KEY — presence checked only)
 */

import { config as loadEnv } from "dotenv";
import { randomUUID } from "node:crypto";
import "./_polyfill-websocket";

loadEnv({ path: ".env.local" });
loadEnv();

function redact(value: string | undefined): string {
  if (!value) return "(missing)";
  if (value.length <= 12) return `(set, len=${value.length})`;
  return `${value.slice(0, 8)}…${value.slice(-4)} (len=${value.length})`;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  console.log("=== Supabase env (redacted) ===");
  console.log("NEXT_PUBLIC_SUPABASE_URL:", redact(url));
  console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY:", redact(anon));
  console.log("SUPABASE_SERVICE_ROLE_KEY:", redact(service));

  if (!url || !service) {
    console.error("FAIL: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const { getSupabaseServiceClient } = await import("../lib/supabase-server");
  const sb = getSupabaseServiceClient();

  const tables = ["roles", "system_settings", "_airtable_id_map"] as const;
  console.log("\n=== Row counts (expect 0 before migration) ===");
  let ok = true;
  for (const table of tables) {
    const { count, error } = await sb.from(table).select("*", { count: "exact", head: true });
    if (error) {
      console.error(`FAIL ${table}:`, error.message);
      ok = false;
    } else {
      console.log(`${table}: ${count ?? 0}`);
    }
  }

  // Lightweight write/delete smoke on a temp row in _airtable_id_map (additive, cleaned up)
  const probeId = randomUUID();
  const probeAirtableId = `recPOC_CONNECTIVITY_${Date.now()}`;
  const { error: insertErr } = await sb.from("_airtable_id_map").insert({
    airtable_id: probeAirtableId,
    table_name: "_connectivity_probe",
    supabase_id: probeId,
  });
  if (insertErr) {
    console.error("FAIL probe insert:", insertErr.message);
    ok = false;
  } else {
    const { error: delErr } = await sb
      .from("_airtable_id_map")
      .delete()
      .eq("airtable_id", probeAirtableId);
    if (delErr) {
      console.error("FAIL probe cleanup:", delErr.message);
      ok = false;
    } else {
      console.log("probe insert/delete: ok");
    }
  }

  if (!ok) {
    console.error("\nCONNECTIVITY: FAIL");
    process.exit(1);
  }
  console.log("\nCONNECTIVITY: SUCCESS");
}

main().catch((err) => {
  console.error("CONNECTIVITY: FAIL", err);
  process.exit(1);
});
