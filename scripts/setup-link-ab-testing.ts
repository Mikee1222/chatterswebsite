#!/usr/bin/env npx tsx
/**
 * Setup A/B testing fields on link_pages and create link_ab_results table.
 *
 * Usage:
 *   npm run setup:link-ab-testing
 *   npm run setup:link-ab-testing -- --dry-run
 *
 * Requires: AIRTABLE_TOKEN, AIRTABLE_BASE_ID (schema.bases:read + schema.bases:write)
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createField, getBaseSchema, type AirtableTable } from "../lib/airtable-admin";
import type { FieldDef } from "../lib/airtable-schema";
import {
  LINK_PAGES_TABLE,
  LINK_AB_RESULTS_TABLE,
  LINK_PAGE_AB_WINNERS,
  LINK_PAGE_AB_VARIANTS,
  LINK_PAGE_AB_EVENT_TYPES,
} from "../lib/link-pages-schema";

loadEnv();
loadEnv({ path: ".env.local" });

const DATETIME_TZ = "Asia/Riyadh";
const datetimeOptions = {
  dateFormat: { name: "iso" as const, format: "YYYY-MM-DD" },
  timeFormat: { name: "24hour" as const, format: "HH:mm" },
  timeZone: DATETIME_TZ,
};
const checkboxOptions = { icon: "check", color: "greenBright" as const };
const DRY_RUN = process.argv.includes("--dry-run");

function log(msg: string) {
  console.log(`[setup-link-ab-testing] ${msg}`);
}

function logErr(msg: string) {
  console.error(`[setup-link-ab-testing] ERROR: ${msg}`);
}

function loadBaseIdFromWrangler(): string | null {
  const path = resolve(process.cwd(), "wrangler.jsonc");
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  const m = raw.match(/"AIRTABLE_BASE_ID"\s*:\s*"([^"]+)"/);
  return m?.[1] ?? null;
}

function getCredentials(): { token: string; baseId: string } | null {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  if (!token) {
    log("Skipping — AIRTABLE_TOKEN not set.");
    return null;
  }
  let baseId = process.env.AIRTABLE_BASE_ID?.trim();
  if (!baseId) {
    baseId = loadBaseIdFromWrangler() ?? "";
    if (baseId) log("(Using AIRTABLE_BASE_ID from wrangler.jsonc)");
  }
  if (!baseId) {
    logErr("Missing AIRTABLE_BASE_ID.");
    process.exit(1);
  }
  return { token, baseId };
}

async function metaFetch(baseId: string, token: string, path: string, init: RequestInit = {}): Promise<Response> {
  const url = `https://api.airtable.com/v0/meta/bases/${baseId}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
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
    log(`Skip — ${table.name}.${fieldName} already exists (${existing.type}).`);
    return;
  }
  if (DRY_RUN) {
    log(`[dry-run] Would create ${table.name}.${fieldName}`);
    return;
  }
  const result = await createField(baseId, token, table.id, fieldName, def, false);
  if (!result.created) {
    logErr(`Failed ${table.name}.${fieldName}: ${result.error ?? "unknown error"}`);
    process.exit(1);
  }
  log(`Created ${table.name}.${fieldName}.`);
}

function linkAbResultsFields(): Array<Record<string, unknown>> {
  return [
    { name: "event_id", type: "singleLineText" },
    { name: "page_id", type: "singleLineText" },
    {
      name: "variant",
      type: "singleSelect",
      options: { choices: LINK_PAGE_AB_VARIANTS.map((v) => ({ name: v })) },
    },
    {
      name: "event_type",
      type: "singleSelect",
      options: { choices: LINK_PAGE_AB_EVENT_TYPES.map((v) => ({ name: v })) },
    },
    { name: "session_id", type: "singleLineText" },
    { name: "block_id", type: "singleLineText" },
    { name: "timestamp", type: "dateTime", options: { ...datetimeOptions } },
  ];
}

async function createTableIfMissing(
  baseId: string,
  token: string,
  tables: AirtableTable[],
  name: string,
  fields: Array<Record<string, unknown>>,
  description?: string
): Promise<void> {
  if (tables.some((t) => t.name === name)) {
    log(`Skip — table already exists: ${name}`);
    return;
  }
  if (DRY_RUN) {
    log(`[dry-run] Would create table: ${name} (${fields.length} fields)`);
    return;
  }
  const body: Record<string, unknown> = { name, fields };
  if (description) body.description = description;
  const res = await metaFetch(baseId, token, "/tables", { method: "POST", body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) {
    logErr(`Failed ${name}: ${JSON.stringify(data, null, 2)}`);
    throw new Error(`Create table ${name} failed (${res.status})`);
  }
  log(`Created table: ${(data as { name?: string }).name ?? name}`);
}

async function main(): Promise<void> {
  const creds = getCredentials();
  if (!creds) return;

  const { token, baseId } = creds;
  log(`Base: ${baseId}${DRY_RUN ? " (dry-run)" : ""}`);

  const schema = await getBaseSchema(baseId, token);
  const pagesTable = findTable(schema, LINK_PAGES_TABLE);
  if (!pagesTable) {
    logErr(`Table "${LINK_PAGES_TABLE}" not found. Run npm run setup:link-pages-tables first.`);
    process.exit(1);
  }

  const checkboxDef: FieldDef = { type: "checkbox", options: { ...checkboxOptions } };
  const textDef: FieldDef = { type: "singleLineText" };
  const winnerDef: FieldDef = {
    type: "singleSelect",
    options: { choices: LINK_PAGE_AB_WINNERS.map((w) => ({ name: w })) },
  };
  const datetimeDef: FieldDef = { type: "dateTime", options: { ...datetimeOptions } };

  await ensureField(baseId, token, pagesTable, "ab_test_enabled", checkboxDef);
  await ensureField(baseId, token, pagesTable, "ab_variant_id", textDef);
  await ensureField(baseId, token, pagesTable, "ab_test_name", textDef);
  await ensureField(baseId, token, pagesTable, "ab_winner", winnerDef);
  await ensureField(baseId, token, pagesTable, "ab_started_at", datetimeDef);

  await createTableIfMissing(
    baseId,
    token,
    schema.tables,
    LINK_AB_RESULTS_TABLE,
    linkAbResultsFields(),
    "A/B test view and click events for link pages"
  );

  log("Done.");
}

main().catch((err) => {
  logErr(String(err));
  process.exit(1);
});
