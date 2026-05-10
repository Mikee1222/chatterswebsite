#!/usr/bin/env tsx
/**
 * One-time backfill: sets `whales.created_by` when empty, using `assigned_chatter_name`.
 *
 * Requires: AIRTABLE_TOKEN, AIRTABLE_BASE_ID (.env / .env.local)
 *
 * Usage: npx tsx scripts/backfill-whale-created-by.ts
 */

import { config as loadEnv } from "dotenv";
import { listAllRecords, updateRecord } from "../lib/airtable-server";

loadEnv();
loadEnv({ path: ".env.local" });

const TABLE = "whales";

/** Empty or missing `created_by` (covers "" and blank). */
const EMPTY_CREATED_BY_FORMULA = `LEN({created_by} & "") = 0`;

type WhaleBackfillFields = {
  username?: string;
  created_by?: string;
  assigned_chatter_name?: string;
};

function trimName(value: unknown): string {
  if (value == null) return "";
  if (typeof value !== "string") return "";
  return value.trim();
}

async function run(): Promise<void> {
  const records = await listAllRecords<WhaleBackfillFields>(TABLE, {
    filterByFormula: EMPTY_CREATED_BY_FORMULA,
    _caller: "backfill-whale-created-by",
  });

  console.log(`Found ${records.length} whales with empty created_by`);

  let updated = 0;
  let skipped = 0;

  for (const rec of records) {
    const f = rec.fields;
    const chatterName = trimName(f.assigned_chatter_name);
    if (!chatterName) {
      skipped++;
      continue;
    }

    await updateRecord(TABLE, rec.id, { created_by: chatterName });
    console.log(`Updated: ${f.username ?? rec.id} → ${chatterName}`);
    updated++;

    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`Done. Updated ${updated} whales, skipped ${skipped} (no assigned chatter name).`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
