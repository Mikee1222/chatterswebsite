#!/usr/bin/env tsx
/**
 * Adds `of_user_id` (single line text) on `modelss` via Airtable Metadata API, then prints
 * model_name → current of_user_id for every row.
 *
 * Requires: AIRTABLE_TOKEN (schema.bases:read + schema.bases:write + data.records:read)
 *           AIRTABLE_BASE_ID (or wrangler.jsonc)
 *
 * Usage: npx tsx scripts/add-of-user-id-field.ts
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getBaseSchema, type AirtableTable } from "../lib/airtable-admin";

loadEnv();
loadEnv({ path: ".env.local" });

const TABLE_NAME = "modelss";
const FIELD_NAME = "of_user_id";
const FIELD_DESCRIPTION = "TheOnlyAPI OF user ID for this model";
const META_FIELDS = "https://api.airtable.com/v0/meta/bases";
const DATA_BASE = "https://api.airtable.com/v0";

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

async function createSingleLineTextField(
  baseId: string,
  token: string,
  tableId: string
): Promise<{ ok: boolean; error?: string }> {
  const url = `${META_FIELDS}/${baseId}/tables/${tableId}/fields`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: FIELD_NAME,
      type: "singleLineText",
      description: FIELD_DESCRIPTION,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `${res.status}: ${text}` };
  }
  return { ok: true };
}

type ModelssFields = {
  model_name?: string;
  of_user_id?: string;
};

type DataRecord = { id: string; fields: ModelssFields };

async function listAllModelss(baseId: string, token: string): Promise<DataRecord[]> {
  const out: DataRecord[] = [];
  let offset: string | undefined;
  const tableEnc = encodeURIComponent(TABLE_NAME);
  for (;;) {
    const qs = new URLSearchParams({ pageSize: "100" });
    if (offset) qs.set("offset", offset);
    const url = `${DATA_BASE}/${baseId}/${tableEnc}?${qs}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`list ${TABLE_NAME} failed (${res.status}): ${await res.text()}`);
    const data = (await res.json()) as { records?: DataRecord[]; offset?: string };
    out.push(...(data.records ?? []));
    if (!data.offset) break;
    offset = data.offset;
  }
  return out;
}

function printMappingTable(rows: DataRecord[]): void {
  const nameW = Math.max(10, ...rows.map((r) => (r.fields.model_name ?? "").length), 12);
  const valW = Math.max(12, ...rows.map((r) => String(r.fields.of_user_id ?? "").length), 14);
  const sep = `+-${"-".repeat(nameW)}-+-${"-".repeat(valW)}-+`;
  console.log(sep);
  console.log(`| ${"model_name".padEnd(nameW)} | ${"of_user_id".padEnd(valW)} |`);
  console.log(sep);
  for (const r of rows.sort((a, b) =>
    (a.fields.model_name ?? "").localeCompare(b.fields.model_name ?? "", undefined, {
      sensitivity: "base",
    })
  )) {
    const n = (r.fields.model_name ?? "").padEnd(nameW);
    const v = String(r.fields.of_user_id ?? "").padEnd(valW);
    console.log(`| ${n} | ${v} |`);
  }
  console.log(sep);
  console.log(`Total rows: ${rows.length}`);
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
    console.log(`Field "${TABLE_NAME}".${FIELD_NAME} already exists — skipping create.`);
  } else {
    const created = await createSingleLineTextField(baseId, token, table.id);
    if (!created.ok) {
      console.error(created.error ?? "Failed to create field.");
      process.exit(1);
    }
    console.log(`Created ${TABLE_NAME}.${FIELD_NAME} (${FIELD_DESCRIPTION})`);
  }

  console.log("\nFetching all modelss records…\n");
  const rows = await listAllModelss(baseId, token);
  printMappingTable(rows);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
