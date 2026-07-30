#!/usr/bin/env tsx
/**
 * Content Pipeline — add tier/recreate fields to existing `winner_videos` (ADDITIVE only).
 *   winner_tier     singleSelect: winner (=3 recreates) | super_winner (=10 recreates)
 *   recreate_count  number  (how many content_items to spawn on approve)
 *   content_item_ids singleLineText  (comma-separated spawned content_item slugs)
 *
 * Idempotent (skips fields that already exist). Does NOT touch any existing field.
 * Requires AIRTABLE_TOKEN, AIRTABLE_BASE_ID. APPLY scope: schema.bases:write
 *
 * Usage:
 *   npx tsx scripts/add-winner-tier-fields.ts           # DRY RUN
 *   npx tsx scripts/add-winner-tier-fields.ts --apply    # add fields
 */

import { config as loadEnv } from "dotenv";
import { getBaseSchema, createField } from "../lib/airtable-admin";
import type { FieldDef } from "../lib/airtable-schema";

loadEnv({ path: ".env.local" });
loadEnv();

const TABLE = "winner_videos";
const NEW_FIELDS: { name: string; def: FieldDef }[] = [
  { name: "winner_tier", def: { type: "singleSelect", options: { choices: [{ name: "winner" }, { name: "super_winner" }] } } },
  { name: "recreate_count", def: { type: "number", options: { precision: 0 } } },
  { name: "content_item_ids", def: { type: "singleLineText" } },
];

async function main(): Promise<void> {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();
  if (!token || !baseId) { console.error("Missing AIRTABLE_TOKEN / AIRTABLE_BASE_ID."); process.exit(1); }
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;

  const schema = await getBaseSchema(baseId, token);
  const table = schema.tables.find((t) => t.name === TABLE);
  if (!table) { console.error(`Table "${TABLE}" not found.`); process.exit(1); }
  const existing = new Set(table.fields.map((f) => f.name));

  console.log(`\n=== ${TABLE}: add tier fields — ${dryRun ? "DRY RUN" : "APPLY"} ===`);
  for (const f of NEW_FIELDS) {
    if (existing.has(f.name)) { console.log(`  = ${f.name} already exists, skipping`); continue; }
    if (dryRun) { console.log(`  + would add ${f.name} (${f.def.type})`); continue; }
    const res = await createField(baseId, token, table.id, f.name, f.def, false);
    console.log(res.created ? `  + added ${f.name}` : `  ✗ ${f.name}: ${res.error}`);
  }
  console.log(dryRun ? "\n(DRY RUN — nothing written.)\n" : "\nDone.\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
