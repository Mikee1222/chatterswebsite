#!/usr/bin/env npx tsx
/**
 * One-time setup: create `model_periods` table and add `avg_cycle_length`, `avg_period_length`,
 * `period_notes` to `modelss` if missing (Airtable Meta API).
 *
 * Usage (from repo root):
 *   npx tsx scripts/setup-period-tracking.ts
 *
 * Requires env:
 *   AIRTABLE_TOKEN — PAT with schema.bases:read + schema.bases:write
 *   AIRTABLE_BASE_ID — target base id
 *
 * Loads `.env` from cwd when present (via dotenv).
 *
 * Fields (conceptual order): model_id → modelss, start_date / end_date (ISO YYYY-MM-DD), cycle and
 * period length numbers (defaults 28 / 5 in UI only), notes, logged_by (model | admin | va), created_at.
 * Airtable requires the first field to be the primary field, so `start_date` is created first, then
 * `model_id` (links cannot be primary).
 */

import "dotenv/config";

const META_BASE = "https://api.airtable.com/v0/meta/bases";
const PERIODS_TABLE = "model_periods";
const MODELSS_TABLE = "modelss";

/** IANA zone (match other setup scripts in this repo). */
const DATETIME_TZ = "Asia/Riyadh";

const datetimeOptions = {
  dateFormat: { name: "iso" as const, format: "YYYY-MM-DD" },
  timeFormat: { name: "24hour" as const, format: "HH:mm" },
  timeZone: DATETIME_TZ,
};

const dateOptionsIso = {
  dateFormat: { name: "iso" as const, format: "YYYY-MM-DD" },
};

type MetaField = { id: string; name: string; type: string };
type MetaTable = { id: string; name: string; primaryFieldId?: string; fields?: MetaField[] };

function log(msg: string) {
  console.log(`[setup-period-tracking] ${msg}`);
}

function logErr(msg: string) {
  console.error(`[setup-period-tracking] ERROR: ${msg}`);
}

async function metaFetch(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  const url = `${META_BASE}${path}`;
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
  const res = await metaFetch(token, `/${baseId}/tables`, { method: "GET" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET tables failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { tables?: MetaTable[] };
  return data.tables ?? [];
}

function findTableByName(tables: MetaTable[], name: string): MetaTable | null {
  const lower = name.trim().toLowerCase();
  return tables.find((t) => t.name.trim().toLowerCase() === lower) ?? null;
}

function fieldNameExists(table: MetaTable, fieldName: string): boolean {
  const want = fieldName.trim().toLowerCase();
  return (table.fields ?? []).some((f) => f.name.trim().toLowerCase() === want);
}

function buildModelPeriodsFields(modelssTableId: string): Array<Record<string, unknown>> {
  return [
    {
      name: "start_date",
      type: "date",
      description: "Period start (ISO date). Primary field for this table.",
      options: { ...dateOptionsIso },
    },
    {
      name: "model_id",
      type: "multipleRecordLinks",
      description: "Linked modelss records",
      options: { linkedTableId: modelssTableId },
    },
    {
      name: "end_date",
      type: "date",
      description: "Period end (ISO date); often start_date + period_length_days",
      options: { ...dateOptionsIso },
    },
    {
      name: "cycle_length_days",
      type: "number",
      description: "Average full cycle length in days (typical default 28)",
      options: { precision: 0 },
    },
    {
      name: "period_length_days",
      type: "number",
      description: "How many days the period lasts (typical default 5)",
      options: { precision: 0 },
    },
    { name: "notes", type: "multilineText", description: "Free-form notes" },
    {
      name: "logged_by",
      type: "singleSelect",
      options: {
        choices: [{ name: "model" }, { name: "admin" }, { name: "va" }],
      },
    },
    {
      name: "created_at",
      type: "dateTime",
      options: { ...datetimeOptions },
    },
  ];
}

const MODELSS_NEW_FIELDS: Array<{ name: string; spec: Record<string, unknown> }> = [
  {
    name: "avg_cycle_length",
    spec: {
      name: "avg_cycle_length",
      type: "number",
      description: "Average cycle length in days (typical default 28)",
      options: { precision: 0 },
    },
  },
  {
    name: "avg_period_length",
    spec: {
      name: "avg_period_length",
      type: "number",
      description: "Average period length in days (typical default 5)",
      options: { precision: 0 },
    },
  },
  {
    name: "period_notes",
    spec: {
      name: "period_notes",
      type: "multilineText",
      description: "Period-related notes on the modelss row",
    },
  },
];

async function createTableField(
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
    throw new Error(`Create field "${body.name}" failed (${res.status}): ${text}`);
  }
}

async function main(): Promise<void> {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();

  if (!token || !baseId) {
    logErr("Set AIRTABLE_TOKEN and AIRTABLE_BASE_ID (e.g. in .env at repo root).");
    process.exit(1);
  }

  try {
    log(`Using base id: ${baseId.slice(0, 6)}…`);
    const tables = await listTables(baseId, token);

    const modelss = findTableByName(tables, MODELSS_TABLE);
    if (!modelss?.id) {
      logErr(
        `No table named "${MODELSS_TABLE}" (case-insensitive). Found: ${tables.map((t) => t.name).join(", ") || "(none)"}`
      );
      process.exit(1);
    }
    log(`Found "${MODELSS_TABLE}" table id: ${modelss.id}`);

    const existingPeriods = findTableByName(tables, PERIODS_TABLE);
    if (existingPeriods) {
      log(`Table "${PERIODS_TABLE}" already exists (id: ${existingPeriods.id}). Skipping table create.`);
    } else {
      const fields = buildModelPeriodsFields(modelss.id);
      const body = {
        name: PERIODS_TABLE,
        description: "Model period logs (created by setup-period-tracking.ts)",
        fields,
      };
      log(`Creating table "${PERIODS_TABLE}" with ${fields.length} fields…`);
      const res = await metaFetch(token, `/${baseId}/tables`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        logErr(`Create table failed (${res.status}): ${text}`);
        process.exit(1);
      }
      const created = (await res.json()) as { id?: string; name?: string };
      log(
        `Created table "${created.name ?? PERIODS_TABLE}" successfully (table id: ${created.id ?? "unknown"}).`
      );
    }

    // Refresh tables so `modelss` includes newly added fields from other runs (optional); re-fetch for fresh fields
    const tablesAfter = await listTables(baseId, token);
    const modelssFresh = findTableByName(tablesAfter, MODELSS_TABLE);
    if (!modelssFresh?.id) {
      logErr(`Lost reference to "${MODELSS_TABLE}" after create.`);
      process.exit(1);
    }

    let added = 0;
    for (const { name, spec } of MODELSS_NEW_FIELDS) {
      if (fieldNameExists(modelssFresh, name)) {
        log(`Field "${name}" on "${MODELSS_TABLE}" already exists — skip.`);
        continue;
      }
      log(`Adding field "${name}" to "${MODELSS_TABLE}"…`);
      await createTableField(baseId, modelssFresh.id, token, spec);
      added += 1;
      log(`Added field "${name}".`);
    }
    if (added === 0) {
      log(`All target fields already present on "${MODELSS_TABLE}".`);
    } else {
      log(`Added ${added} field(s) to "${MODELSS_TABLE}".`);
    }

    log("Success.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logErr(msg);
    process.exit(1);
  }
}

main();
