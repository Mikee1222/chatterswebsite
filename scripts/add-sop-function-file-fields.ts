#!/usr/bin/env tsx
/**
 * Adds file-standard columns on sop_functions:
 * - standard_type (single select: text, file — default text)
 * - sop_file_url (url)
 * - sop_file_name (single line text)
 *
 * Idempotent per field name.
 *
 * Usage: npx tsx scripts/add-sop-function-file-fields.ts
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createField, getBaseSchema, type AirtableTable } from "../lib/airtable-admin";
import type { FieldDef } from "../lib/airtable-schema";

loadEnv({ path: ".env.local" });
loadEnv();

const TABLE_NAME = "sop_functions";

const FIELDS: Array<{ name: string; def: FieldDef }> = [
  {
    name: "standard_type",
    def: {
      type: "singleSelect",
      options: {
        choices: [{ name: "text" }, { name: "file" }],
      },
    },
  },
  { name: "sop_file_url", def: { type: "url" } },
  { name: "sop_file_name", def: { type: "singleLineText" } },
];

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
    console.error("Missing AIRTABLE_TOKEN.");
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

async function ensureField(
  table: AirtableTable,
  baseId: string,
  token: string,
  name: string,
  def: FieldDef
): Promise<void> {
  const existing = table.fields.find((f) => f.name === name);
  if (existing) {
    console.log(`${TABLE_NAME}.${name} already exists (${existing.type}). Skipping.`);
    return;
  }
  const result = await createField(baseId, token, table.id, name, def, false);
  if (!result.created) {
    console.error(result.error ?? `Failed to create ${name}`);
    process.exit(1);
  }
  console.log(`Created ${TABLE_NAME}.${name}.`);
}

async function main(): Promise<void> {
  const { token, baseId } = getCredentials();
  const schema = await getBaseSchema(baseId, token);
  const table = schema.tables.find((t) => t.name === TABLE_NAME);
  if (!table) {
    console.error(`Table "${TABLE_NAME}" not found.`);
    process.exit(1);
  }

  for (const { name, def } of FIELDS) {
    await ensureField(table, baseId, token, name, def);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
