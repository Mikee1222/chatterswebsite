#!/usr/bin/env tsx
/**
 * Idempotent: add missing period-tracking Airtable fields via Meta API.
 *
 * - `model_periods.predicted_next_date` (date)
 * - `modelss.period_tracking_enabled` (checkbox)
 *
 * Requires: AIRTABLE_TOKEN (schema.bases:read + schema.bases:write), AIRTABLE_BASE_ID
 * Usage: npm run complete:period-fields [--dry-run]
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnv();
loadEnv({ path: ".env.local" });

const META_BASE = "https://api.airtable.com/v0/meta/bases";
const PERIODS_TABLE = "model_periods";
const MODELSS_TABLE = "modelss";

const dateOptionsIso = {
  dateFormat: { name: "iso" as const, format: "YYYY-MM-DD" },
};

const checkboxOptions = { icon: "check", color: "greenBright" as const };

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

type MetaField = { id: string; name: string; type: string };
type MetaTable = { id: string; name: string; fields?: MetaField[] };

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
  const res = await metaFetch(token, `/${baseId}/tables`, { method: "GET" });
  if (!res.ok) {
    throw new Error(`GET tables failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { tables?: MetaTable[] };
  return data.tables ?? [];
}

function findTable(tables: MetaTable[], name: string): MetaTable | null {
  const w = name.trim().toLowerCase();
  return tables.find((t) => t.name.trim().toLowerCase() === w) ?? null;
}

function fieldExists(table: MetaTable, fieldName: string): boolean {
  const w = fieldName.trim().toLowerCase();
  return (table.fields ?? []).some((f) => f.name.trim().toLowerCase() === w);
}

async function createField(
  baseId: string,
  tableId: string,
  token: string,
  body: Record<string, unknown>
): Promise<void> {
  const res = await metaFetch(token, `/${baseId}/tables/${encodeURIComponent(tableId)}/fields`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create field "${String(body.name)}" failed (${res.status}): ${text}`);
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const { token, baseId } = getCredentials();

  const tables = await listTables(baseId, token);
  const periods = findTable(tables, PERIODS_TABLE);
  const modelss = findTable(tables, MODELSS_TABLE);

  if (!periods?.id) {
    console.error(`Table "${PERIODS_TABLE}" not found. Run scripts/setup-period-tracking.ts first.`);
    process.exit(1);
  }
  if (!modelss?.id) {
    console.error(`Table "${MODELSS_TABLE}" not found.`);
    process.exit(1);
  }

  // 1) model_periods.predicted_next_date
  if (fieldExists(periods, "predicted_next_date")) {
    console.log(`✓ "${PERIODS_TABLE}.predicted_next_date" already exists — skip.`);
  } else {
    const body = {
      name: "predicted_next_date",
      type: "date",
      description: "Predicted date of next period based on average cycle (optional row-level hint)",
      options: { ...dateOptionsIso },
    };
    if (dryRun) {
      console.log(`[dry-run] Would create field on ${PERIODS_TABLE}:`, body.name);
    } else {
      await createField(baseId, periods.id, token, body);
      console.log(`✓ Added "${PERIODS_TABLE}.predicted_next_date" (date).`);
    }
  }

  // 2) modelss.period_tracking_enabled
  if (fieldExists(modelss, "period_tracking_enabled")) {
    console.log(`✓ "${MODELSS_TABLE}.period_tracking_enabled" already exists — skip.`);
  } else {
    const body = {
      name: "period_tracking_enabled",
      type: "checkbox",
      description: "Admin controls if period tracking is enabled for this model",
      options: { ...checkboxOptions },
    };
    if (dryRun) {
      console.log(`[dry-run] Would create field on ${MODELSS_TABLE}:`, body.name);
    } else {
      await createField(baseId, modelss.id, token, body);
      console.log(`✓ Added "${MODELSS_TABLE}.period_tracking_enabled" (checkbox).`);
    }
  }

  if (dryRun) {
    console.log("\nDry run complete. Run without --dry-run to create any missing fields.");
  } else {
    console.log("\nDone.");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
