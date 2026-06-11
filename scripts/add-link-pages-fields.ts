#!/usr/bin/env tsx
/**
 * Adds link_pages tracking/pixel fields and link_page_blocks.platform via Airtable Metadata API.
 * Idempotent: skips fields that already exist.
 *
 * Usage: npm run add:link-pages-fields
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createField, getBaseSchema, type AirtableTable } from "../lib/airtable-admin";
import type { FieldDef } from "../lib/airtable-schema";
import { LINK_PAGES_TABLE, LINK_PAGE_BLOCKS_TABLE } from "../lib/link-pages-schema";

loadEnv();
loadEnv({ path: ".env.local" });

const CHECKBOX_DEF: FieldDef = {
  type: "checkbox",
  options: { icon: "check", color: "greenBright" },
};

const TEXT_DEF: FieldDef = { type: "singleLineText" };

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

function findTable(schema: { tables: AirtableTable[] }, name: string): AirtableTable | null {
  return schema.tables.find((t) => t.name === name) ?? null;
}

async function ensureField(
  baseId: string,
  token: string,
  table: AirtableTable,
  fieldName: string,
  def: FieldDef
): Promise<void> {
  const existing = table.fields.find((f) => f.name === fieldName);
  if (existing) {
    console.log(`Skip — ${table.name}.${fieldName} already exists (${existing.type}).`);
    return;
  }
  const result = await createField(baseId, token, table.id, fieldName, def, false);
  if (!result.created) {
    console.error(`Failed ${table.name}.${fieldName}: ${result.error ?? "unknown error"}`);
    process.exit(1);
  }
  console.log(`Created ${table.name}.${fieldName}.`);
}

async function main(): Promise<void> {
  const { token, baseId } = getCredentials();
  const schema = await getBaseSchema(baseId, token);

  const pagesTable = findTable(schema, LINK_PAGES_TABLE);
  if (!pagesTable) {
    console.error(`Table "${LINK_PAGES_TABLE}" not found. Run npm run setup:link-pages-tables first.`);
    process.exit(1);
  }

  const blocksTable = findTable(schema, LINK_PAGE_BLOCKS_TABLE);
  if (!blocksTable) {
    console.error(`Table "${LINK_PAGE_BLOCKS_TABLE}" not found. Run npm run setup:link-pages-tables first.`);
    process.exit(1);
  }

  await ensureField(baseId, token, pagesTable, "verified", CHECKBOX_DEF);
  await ensureField(baseId, token, pagesTable, "meta_pixel_id", TEXT_DEF);
  await ensureField(baseId, token, pagesTable, "tiktok_pixel_id", TEXT_DEF);
  await ensureField(baseId, token, pagesTable, "cookie_notice_enabled", CHECKBOX_DEF);
  await ensureField(baseId, token, pagesTable, "cookie_notice_text", TEXT_DEF);
  await ensureField(baseId, token, blocksTable, "platform", TEXT_DEF);
  await ensureField(baseId, token, blocksTable, "custom_button_color", TEXT_DEF);

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
