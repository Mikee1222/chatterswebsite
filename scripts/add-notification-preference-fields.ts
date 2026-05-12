#!/usr/bin/env npx tsx
/**
 * Idempotently add notification preference checkbox fields via the Airtable Meta API.
 *
 * Requires: AIRTABLE_TOKEN with schema.bases:read + schema.bases:write, AIRTABLE_BASE_ID.
 * Usage: npx tsx scripts/add-notification-preference-fields.ts
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnv();
loadEnv({ path: ".env.local" });

const META_BASE = "https://api.airtable.com/v0/meta/bases";
const TABLE_NAME = "notification_preferences";
const CHECKBOX_OPTIONS = { icon: "check", color: "greenBright" as const };
const FIELDS = [
  "mistake_alerts",
  "fine_bonus_alerts",
  "period_alerts",
  "marketing_alerts",
  "phase_alerts",
  "reward_alerts",
] as const;

type MetaField = { id: string; name: string; type: string };
type MetaTable = { id: string; name: string; fields?: MetaField[] };

function loadBaseIdFromWrangler(): string | null {
  const path = resolve(process.cwd(), "wrangler.jsonc");
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  const match = raw.match(/"AIRTABLE_BASE_ID"\s*:\s*"([^"]+)"/);
  return match?.[1] ?? null;
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
    if (baseId) console.log("(Using AIRTABLE_BASE_ID from wrangler.jsonc)");
  }
  if (!baseId) {
    console.error("Missing AIRTABLE_BASE_ID.");
    process.exit(1);
  }

  return { token, baseId };
}

async function metaFetch(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${META_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

async function listTables(baseId: string, token: string): Promise<MetaTable[]> {
  const res = await metaFetch(token, `/${encodeURIComponent(baseId)}/tables`, { method: "GET" });
  if (!res.ok) {
    throw new Error(`GET tables failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { tables?: MetaTable[] };
  return data.tables ?? [];
}

async function createCheckboxField(baseId: string, token: string, tableId: string, fieldName: string): Promise<void> {
  const res = await metaFetch(token, `/${encodeURIComponent(baseId)}/tables/${encodeURIComponent(tableId)}/fields`, {
    method: "POST",
    body: JSON.stringify({
      name: fieldName,
      type: "checkbox",
      options: CHECKBOX_OPTIONS,
    }),
  });
  if (!res.ok) {
    throw new Error(`Create field "${fieldName}" failed (${res.status}): ${await res.text()}`);
  }
}

async function main(): Promise<void> {
  const { token, baseId } = getCredentials();
  const tables = await listTables(baseId, token);
  const table = tables.find((t) => t.name.trim().toLowerCase() === TABLE_NAME);
  if (!table?.id) {
    console.error(`Table "${TABLE_NAME}" not found.`);
    process.exit(1);
  }

  const existing = new Set((table.fields ?? []).map((field) => field.name.trim().toLowerCase()));
  let added = 0;

  for (const fieldName of FIELDS) {
    if (existing.has(fieldName)) {
      console.log(`OK "${TABLE_NAME}.${fieldName}" already exists - skip.`);
      continue;
    }
    await createCheckboxField(baseId, token, table.id, fieldName);
    existing.add(fieldName);
    added += 1;
    console.log(`OK Added "${TABLE_NAME}.${fieldName}" (checkbox).`);
  }

  console.log(`Done. Added ${added} field(s); skipped ${FIELDS.length - added}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
