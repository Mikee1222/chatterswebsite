#!/usr/bin/env tsx
/**
 * Adds `availability_windows` (multiline text JSON) on `weekly_availability_requests_models`.
 * Idempotent. Requires AIRTABLE_TOKEN and AIRTABLE_BASE_ID (or wrangler.jsonc).
 *
 * Usage: npx tsx scripts/add-model-availability-windows-field.ts
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createField, getBaseSchema, type AirtableTable } from "../lib/airtable-admin";
import type { FieldDef } from "../lib/airtable-schema";

loadEnv();
loadEnv({ path: ".env.local" });

const TABLE_NAME = "weekly_availability_requests_models";
const FIELD_NAME = "availability_windows";

const FIELD_DEF: FieldDef = { type: "multilineText" };

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

async function main(): Promise<void> {
  const { token, baseId } = getCredentials();
  const schema = await getBaseSchema(baseId, token);
  const table = schema.tables.find((x: AirtableTable) => x.name === TABLE_NAME);
  if (!table) {
    console.error(`Table "${TABLE_NAME}" not found.`);
    process.exit(1);
  }

  const existing = table.fields.find((f) => f.name === FIELD_NAME);
  if (existing) {
    console.log(`Field "${TABLE_NAME}".${FIELD_NAME} already exists. Skipping.`);
    return;
  }

  const result = await createField(baseId, token, table.id, FIELD_NAME, FIELD_DEF, false);
  if (!result.created) {
    console.error(result.error ?? "Failed to create field.");
    process.exit(1);
  }
  console.log(`Created ${TABLE_NAME}.${FIELD_NAME} (JSON array of {start,end} time strings).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
