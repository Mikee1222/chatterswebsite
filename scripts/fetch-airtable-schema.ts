#!/usr/bin/env tsx
/**
 * Fetch and print the live Airtable base schema (tables + fields) via the Meta API.
 *
 * Requires:
 *   - AIRTABLE_TOKEN (Personal access token with schema.bases:read)
 *   - AIRTABLE_BASE_ID (or falls back to wrangler.jsonc vars.AIRTABLE_BASE_ID)
 *
 * Usage:
 *   npm run fetch:schema
 *   npm run fetch:schema -- --counts   # paginate each table to count records (slow on large bases)
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnv();
loadEnv({ path: ".env.local" });

console.log("Environment check:");
console.log(
  "- AIRTABLE_TOKEN:",
  process.env.AIRTABLE_TOKEN ? `${process.env.AIRTABLE_TOKEN.substring(0, 10)}...` : "NOT SET"
);
console.log("- AIRTABLE_BASE_ID:", process.env.AIRTABLE_BASE_ID || "NOT SET");
console.log("- Token length:", process.env.AIRTABLE_TOKEN?.length || 0);
console.log("---");

const META_BASE = "https://api.airtable.com/v0/meta/bases";
const DATA_BASE = "https://api.airtable.com/v0";

type MetaField = {
  id: string;
  name: string;
  type: string;
  description?: string;
  options?: Record<string, unknown>;
};

type MetaTable = {
  id: string;
  name: string;
  description?: string;
  primaryFieldId?: string;
  fields: MetaField[];
};

type MetaTablesResponse = {
  tables: MetaTable[];
};

function loadBaseIdFromWrangler(): string | null {
  const path = resolve(process.cwd(), "wrangler.jsonc");
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  const m = raw.match(/"AIRTABLE_BASE_ID"\s*:\s*"([^"]+)"/);
  return m?.[1] ?? null;
}

function getToken(): string {
  const t = process.env.AIRTABLE_TOKEN?.trim();
  if (!t) {
    console.error("Error: AIRTABLE_TOKEN is not set.");
    console.error("Set it in .env / .env.local or export it before running this script.");
    process.exit(1);
  }
  return t;
}

function getBaseId(): string {
  const fromEnv = process.env.AIRTABLE_BASE_ID?.trim();
  if (fromEnv) return fromEnv;
  const fromWrangler = loadBaseIdFromWrangler();
  if (fromWrangler) {
    console.log(`(AIRTABLE_BASE_ID not in env; using value from wrangler.jsonc)\n`);
    return fromWrangler;
  }
  console.error("Error: AIRTABLE_BASE_ID is not set and could not be read from wrangler.jsonc.");
  process.exit(1);
}

function formatFieldType(field: MetaField): string {
  const { type, options } = field;
  if (!options || typeof options !== "object") return type;

  if (type === "formula" && typeof (options as { formula?: string }).formula === "string") {
    const f = (options as { formula: string }).formula;
    const short = f.length > 48 ? `${f.slice(0, 48)}…` : f;
    return `formula (${short})`;
  }
  if (type === "rollup" && typeof (options as { fieldIdInLinkedTable?: string }).fieldIdInLinkedTable === "string") {
    return `rollup (linked field: ${(options as { fieldIdInLinkedTable: string }).fieldIdInLinkedTable})`;
  }
  if (type === "count") {
    return "count";
  }
  if (type === "multipleRecordLinks" || type === "singleRecordLink") {
    const linked = (options as { linkedTableId?: string }).linkedTableId;
    if (linked) return `${type} → table ${linked}`;
  }
  if (type === "singleSelect" || type === "multipleSelects") {
    const choices = (options as { choices?: unknown[] }).choices;
    const n = Array.isArray(choices) ? choices.length : 0;
    if (n) return `${type} (${n} options)`;
  }
  if (type === "multipleLookupValues") {
    const rec = (options as { recordLinkFieldId?: string }).recordLinkFieldId;
    if (rec) return `${type} (via ${rec})`;
  }
  return type;
}

async function fetchRecordCount(
  baseId: string,
  token: string,
  tableId: string,
  maxPages: number
): Promise<string> {
  let total = 0;
  let offset: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const url = new URL(`${DATA_BASE}/${baseId}/${encodeURIComponent(tableId)}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text();
      return `unavailable (${res.status}: ${text.slice(0, 120)}${text.length > 120 ? "…" : ""})`;
    }
    const data = (await res.json()) as { records?: unknown[]; offset?: string };
    const batch = data.records?.length ?? 0;
    total += batch;
    if (!data.offset || batch === 0) return String(total);
    offset = data.offset;
  }
  return `${total}+ (stopped after ${maxPages} pages; use Airtable UI for exact total)`;
}

async function fetchSchema(token: string, baseId: string): Promise<MetaTable[]> {
  const url = `${META_BASE}/${encodeURIComponent(baseId)}/tables`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const bodyText = await res.text();
  if (!res.ok) {
    console.error(`Airtable Meta API request failed: ${res.status} ${res.statusText}`);
    if (res.status === 401) {
      console.error("Hint: check AIRTABLE_TOKEN is set correctly (e.g. in .env.local) and not expired.");
    }
    if (res.status === 403) {
      console.error(
        "Hint: ensure your personal access token includes the scope **schema.bases:read** for this base."
      );
    }
    console.error(bodyText);
    process.exit(1);
  }
  let parsed: MetaTablesResponse;
  try {
    parsed = JSON.parse(bodyText) as MetaTablesResponse;
  } catch {
    console.error("Invalid JSON from Meta API:", bodyText.slice(0, 500));
    process.exit(1);
  }
  if (!Array.isArray(parsed.tables)) {
    console.error("Unexpected Meta API shape (no tables array).");
    process.exit(1);
  }
  return parsed.tables;
}

async function main(): Promise<void> {
  const wantCounts = process.argv.includes("--counts");
  const token = getToken();
  const baseId = getBaseId();

  console.log(`Fetching schema for base ${baseId}…\n`);
  const tables = await fetchSchema(token, baseId);
  const sorted = [...tables].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  console.log(`── ${sorted.length} table(s) ──\n`);

  for (const table of sorted) {
    console.log(`TABLE: ${table.name}`);
    if (table.description?.trim()) {
      console.log(`  description: ${table.description.trim().split("\n")[0]}`);
    }
    for (const field of table.fields) {
      const typeStr = formatFieldType(field);
      console.log(`  - ${field.name} (${typeStr})`);
    }
    if (wantCounts) {
      process.stdout.write("  records: …");
      const count = await fetchRecordCount(baseId, token, table.id, 100);
      process.stdout.write("\r");
      console.log(`  records: ${count}`);
    }
    console.log("");
  }

  if (!wantCounts) {
    console.log(
      "Tip: run `npm run fetch:schema -- --counts` to paginate each table and print approximate record counts (can be slow)."
    );
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
