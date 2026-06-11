#!/usr/bin/env npx tsx
/**
 * One-time setup: create link_redirects Airtable table via Meta API.
 *
 * Usage:
 *   npm run setup:link-redirects-table
 *   npm run setup:link-redirects-table -- --dry-run
 *
 * Requires: AIRTABLE_TOKEN, AIRTABLE_BASE_ID (schema.bases:read + schema.bases:write)
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnv();
loadEnv({ path: ".env.local" });

type MetaTable = { id: string; name: string };

const DATETIME_TZ = "Asia/Riyadh";
const datetimeOptions = {
  dateFormat: { name: "iso" as const, format: "YYYY-MM-DD" },
  timeFormat: { name: "24hour" as const, format: "HH:mm" },
  timeZone: DATETIME_TZ,
};
const checkboxOptions = { icon: "check", color: "greenBright" as const };

const DRY_RUN = process.argv.includes("--dry-run");
const TABLE_NAME = "link_redirects";

function log(msg: string) {
  console.log(`[setup-link-redirects-table] ${msg}`);
}

function logErr(msg: string) {
  console.error(`[setup-link-redirects-table] ERROR: ${msg}`);
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

async function listTables(baseId: string, token: string): Promise<MetaTable[]> {
  const res = await metaFetch(baseId, token, "/tables", { method: "GET" });
  if (!res.ok) throw new Error(`GET tables failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { tables?: MetaTable[] };
  return data.tables ?? [];
}

function linkRedirectsFields(): Array<Record<string, unknown>> {
  return [
    { name: "redirect_id", type: "singleLineText" },
    { name: "page_id", type: "singleLineText" },
    { name: "slug", type: "singleLineText" },
    { name: "destination_url", type: "url" },
    { name: "label", type: "singleLineText" },
    { name: "click_count", type: "number", options: { precision: 0 } },
    { name: "is_active", type: "checkbox", options: { ...checkboxOptions } },
    { name: "created_at", type: "dateTime", options: { ...datetimeOptions } },
    { name: "updated_at", type: "dateTime", options: { ...datetimeOptions } },
  ];
}

async function createTableIfMissing(
  baseId: string,
  token: string,
  tables: MetaTable[],
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

  const tables = await listTables(baseId, token);
  await createTableIfMissing(
    baseId,
    token,
    tables,
    TABLE_NAME,
    linkRedirectsFields(),
    "Safe short URL redirects for link-in-bio pages"
  );

  log("Done.");
}

main().catch((err) => {
  logErr(String(err));
  process.exit(1);
});
