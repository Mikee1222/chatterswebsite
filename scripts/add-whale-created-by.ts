#!/usr/bin/env tsx
/**
 * Creates `whales.created_by` (single line text) via Airtable Metadata API.
 * Idempotent: skips if the field already exists.
 *
 * Requires: AIRTABLE_TOKEN, AIRTABLE_BASE_ID (.env / .env.local or wrangler.jsonc for base id)
 *
 * Usage: npx tsx scripts/add-whale-created-by.ts
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createField, getBaseSchema, type AirtableTable } from "../lib/airtable-admin";
import type { FieldDef } from "../lib/airtable-schema";

loadEnv();
loadEnv({ path: ".env.local" });

const FIELD_NAME = "created_by";
const FIELD_DEF: FieldDef = { type: "singleLineText" };

function loadBaseIdFromWrangler(): string | null {
  const path = resolve(process.cwd(), "wrangler.jsonc");
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  const m = raw.match(/"AIRTABLE_BASE_ID"\s*:\s*"([^"]+)"/);
  return m?.[1] ?? null;
}

function getCredentials(): { token: string; baseId: string } {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  if (!token) {
    console.error("Missing AIRTABLE_TOKEN (set in .env / .env.local).");
    process.exit(1);
  }
  let baseId = process.env.AIRTABLE_BASE_ID?.trim();
  if (!baseId) {
    baseId = loadBaseIdFromWrangler() ?? "";
    if (baseId) console.log("(Using AIRTABLE_BASE_ID from wrangler.jsonc)\n");
  }
  if (!baseId) {
    console.error("Missing AIRTABLE_BASE_ID.");
    process.exit(1);
  }
  return { token, baseId };
}

function findWhalesTable(schema: { tables: AirtableTable[] }): AirtableTable | null {
  return schema.tables.find((t) => t.name.toLowerCase() === "whales") ?? null;
}

async function main(): Promise<void> {
  const { token, baseId } = getCredentials();
  const schema = await getBaseSchema(baseId, token);
  const table = findWhalesTable(schema);
  if (!table) {
    console.error('Table "whales" not found in base.');
    process.exit(1);
  }

  const existing = table.fields.find((f) => f.name === FIELD_NAME);
  if (existing) {
    console.log(`Field "whales".${FIELD_NAME} already exists (type: ${existing.type}). Skipping.`);
    return;
  }

  const result = await createField(baseId, token, table.id, FIELD_NAME, FIELD_DEF, false);
  if (!result.created) {
    console.error(result.error ?? "Failed to create field.");
    process.exit(1);
  }
  console.log(`Created field whales.${FIELD_NAME} (single line text).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
