#!/usr/bin/env tsx
/**
 * Idempotent Airtable Meta API pass: merge single-select choices and create missing fields
 * for model-related tables (custom_requests.model_status, live streams, schedule types, etc.).
 *
 * Requires: AIRTABLE_TOKEN, AIRTABLE_BASE_ID (or wrangler.jsonc — same as setup-model-tables)
 * Scopes: schema.bases:read, schema.bases:write
 *
 * Usage:
 *   npm run complete:model-fields
 *   npm run complete:model-fields -- --dry-run
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createField,
  getBaseSchema,
  type AirtableField,
  type AirtableTable,
  type BaseSchema,
} from "../lib/airtable-admin";
import type { FieldDef } from "../lib/airtable-schema";
import { MODEL_LIVE_STREAM_STATUS_OPTIONS } from "../lib/airtable-options";

loadEnv();
loadEnv({ path: ".env.local" });

const META_BASE = "https://api.airtable.com/v0/meta/bases";

function normalizeChoiceName(s: string): string {
  return s.trim().toLowerCase();
}

/** custom_requests.model_status — full app set (types + services/custom-requests). */
const CUSTOM_REQUEST_MODEL_STATUS_CHOICES = [
  "waiting_schedule",
  "scheduled",
  "in_progress",
  "completed",
  "uploaded",
  "declined",
] as const;

/** model_live_streams.status: canon from lib/airtable-options plus `failed` (deduped, order preserved). */
const MODEL_LIVE_STREAM_STATUS_MERGE: string[] = (() => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const n of [...MODEL_LIVE_STREAM_STATUS_OPTIONS, "failed"] as const) {
    const k = normalizeChoiceName(n);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(n);
  }
  return out;
})();

/** types/index.ts — ModelScheduleItemType */
const MODEL_SCHEDULE_ITEM_TYPE_CHOICES = [
  "script",
  "mass_message",
  "live_stream",
  "custom",
  "content_shoot",
  "promo",
  "meeting",
  "rest",
  "time_off",
  "other",
] as const;

const VA_CONTENT_ASSIGNMENT_STATUS_CHOICES = [
  "pending",
  "pending_approval",
  "rejected",
  "scheduled",
  "completed",
  "cancelled",
] as const;

const LANGUAGE_DEFAULT_CHOICES = [{ name: "en" }, { name: "es" }];

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

/** First name in the list wins (e.g. prefer `modelss` before `models` when both exist). */
function findTable(schema: BaseSchema, ...names: string[]): AirtableTable | null {
  for (const want of names) {
    const w = want.toLowerCase();
    const t = schema.tables.find((x) => x.name.toLowerCase() === w);
    if (t) return t;
  }
  return null;
}

function findField(table: AirtableTable, fieldName: string): AirtableField | null {
  const want = fieldName.toLowerCase();
  return table.fields.find((f) => f.name.toLowerCase() === want) ?? null;
}

type ChoiceRow = { id?: string; name: string; color?: string };

function mergeSingleSelectChoices(
  existingOptions: Record<string, unknown> | undefined,
  requiredNames: readonly string[]
): { choices: ChoiceRow[]; added: string[] } {
  const raw = existingOptions?.choices;
  const existing: ChoiceRow[] = Array.isArray(raw)
    ? (raw as ChoiceRow[]).map((c) => ({ ...c }))
    : [];
  const seen = new Set(existing.map((c) => normalizeChoiceName(c.name)));
  const added: string[] = [];
  const choices = [...existing];
  for (const req of requiredNames) {
    const n = normalizeChoiceName(req);
    if (!seen.has(n)) {
      seen.add(n);
      choices.push({ name: req });
      added.push(req);
    }
  }
  return { choices, added };
}

async function patchSingleSelectField(
  baseId: string,
  token: string,
  tableId: string,
  field: AirtableField,
  mergedOptions: Record<string, unknown>,
  dryRun: boolean
): Promise<{ ok: boolean; error?: string }> {
  if (field.type !== "singleSelect") {
    return {
      ok: false,
      error: `Field "${field.name}" has type ${field.type}, expected singleSelect`,
    };
  }
  if (dryRun) return { ok: true };

  const url = `${META_BASE}/${encodeURIComponent(baseId)}/tables/${encodeURIComponent(tableId)}/fields/${encodeURIComponent(field.id)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "singleSelect",
      options: mergedOptions,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `${res.status}: ${text}` };
  }
  return { ok: true };
}

async function ensureSingleSelectChoices(
  label: string,
  baseId: string,
  token: string,
  table: AirtableTable,
  fieldName: string,
  requiredNames: readonly string[],
  dryRun: boolean
): Promise<string[]> {
  const field = findField(table, fieldName);
  if (!field) {
    console.warn(`  [${label}] Field "${fieldName}" not found — skip.`);
    return [];
  }
  const opts = (field.options ?? {}) as Record<string, unknown>;
  const { choices, added } = mergeSingleSelectChoices(opts, requiredNames);
  if (added.length === 0) {
    console.log(`  [${label}] ${table.name}.${fieldName}: all ${requiredNames.length} choice(s) already present.`);
    return [];
  }
  const nextOptions = { ...opts, choices };
  const r = await patchSingleSelectField(baseId, token, table.id, field, nextOptions, dryRun);
  if (!r.ok) {
    console.error(`  [${label}] PATCH failed ${table.name}.${fieldName}: ${r.error ?? "unknown"}`);
    return [];
  }
  const mode = dryRun ? "[dry-run] would add" : "Added choice(s)";
  console.log(`  [${label}] ${mode} on ${table.name}.${fieldName}: ${added.join(", ")}`);
  return added;
}

async function ensureFields(
  baseId: string,
  token: string,
  table: AirtableTable,
  fields: { name: string; def: FieldDef }[],
  dryRun: boolean,
  label: string
): Promise<{ created: string[]; errors: string[] }> {
  const created: string[] = [];
  const errors: string[] = [];
  const existing = new Set(table.fields.map((f) => f.name.toLowerCase()));
  for (const { name, def } of fields) {
    if (existing.has(name.toLowerCase())) continue;
    const r = await createField(baseId, token, table.id, name, def, dryRun);
    if (r.created) {
      const msg = `${table.name}.${name}`;
      created.push(msg);
      existing.add(name.toLowerCase());
      console.log(
        `  [${label}] ${dryRun ? "[dry-run] would create" : "Created"} field ${msg}`
      );
    } else if (r.error) {
      errors.push(`${table.name}.${name}: ${r.error}`);
      console.error(`  [${label}] Error creating ${table.name}.${name}: ${r.error}`);
    }
  }
  return { created, errors };
}

function defaultDateFieldDef(): FieldDef {
  return {
    type: "date",
    options: {
      dateFormat: { name: "iso", format: "YYYY-MM-DD" },
    },
  };
}

function defaultNumberFieldDef(): FieldDef {
  return { type: "number", options: { precision: 0 } };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const { token, baseId } = getCredentials();

  console.log("Completing model / schedule Airtable fields…");
  if (dryRun) console.log("(dry-run: schema reads only; PATCH/create not sent)\n");

  const schema = await getBaseSchema(baseId, token);
  const errors: string[] = [];
  const allAddedChoices: { where: string; names: string[] }[] = [];
  const allCreatedFields: string[] = [];

  const customRequests = findTable(schema, "custom_requests");
  if (customRequests) {
    console.log("\n--- custom_requests.model_status ---");
    const added = await ensureSingleSelectChoices(
      "model_status",
      baseId,
      token,
      customRequests,
      "model_status",
      CUSTOM_REQUEST_MODEL_STATUS_CHOICES,
      dryRun
    );
    if (added.length) allAddedChoices.push({ where: "custom_requests.model_status", names: added });
  } else {
    console.warn('\n--- custom_requests: table not found, skip model_status ---');
  }

  const liveStreams = findTable(schema, "model_live_streams");
  if (liveStreams) {
    console.log("\n--- model_live_streams.status ---");
    const added = await ensureSingleSelectChoices(
      "live_stream_status",
      baseId,
      token,
      liveStreams,
      "status",
      MODEL_LIVE_STREAM_STATUS_MERGE,
      dryRun
    );
    if (added.length) allAddedChoices.push({ where: "model_live_streams.status", names: added });
  } else {
    console.warn('\n--- model_live_streams: table not found ---');
  }

  const schedule = findTable(schema, "model_schedule");
  if (schedule) {
    console.log("\n--- model_schedule.item_type ---");
    const added = await ensureSingleSelectChoices(
      "item_type",
      baseId,
      token,
      schedule,
      "item_type",
      MODEL_SCHEDULE_ITEM_TYPE_CHOICES,
      dryRun
    );
    if (added.length) allAddedChoices.push({ where: "model_schedule.item_type", names: added });
  } else {
    console.warn('\n--- model_schedule: table not found ---');
  }

  const vaAssign = findTable(schema, "va_content_assignments");
  if (vaAssign) {
    console.log("\n--- va_content_assignments.status ---");
    const added = await ensureSingleSelectChoices(
      "va_status",
      baseId,
      token,
      vaAssign,
      "status",
      VA_CONTENT_ASSIGNMENT_STATUS_CHOICES,
      dryRun
    );
    if (added.length) allAddedChoices.push({ where: "va_content_assignments.status", names: added });
  } else {
    console.warn('\n--- va_content_assignments: table not found ---');
  }

  const periods = findTable(schema, "model_periods");
  if (periods) {
    console.log("\n--- model_periods (checkboxes) ---");
    const periodFields: { name: string; def: FieldDef }[] = [
      { name: "came_early", def: { type: "checkbox" } },
      { name: "missed_period", def: { type: "checkbox" } },
      { name: "tracking_enabled", def: { type: "checkbox" } },
    ];
    const r = await ensureFields(baseId, token, periods, periodFields, dryRun, "model_periods");
    allCreatedFields.push(...r.created);
    errors.push(...r.errors);
    if (r.created.length === 0 && r.errors.length === 0) {
      console.log(
        "  [model_periods] came_early, missed_period, tracking_enabled — all present."
      );
    }
  } else {
    console.warn('\n--- model_periods: table not found ---');
  }

  const usersTable = findTable(schema, "users");
  const modelsTable = findTable(schema, "modelss", "models");
  if (usersTable && modelsTable) {
    console.log("\n--- users (language_default, timezone, linked_model) ---");
    const userFields: { name: string; def: FieldDef }[] = [
      {
        name: "language_default",
        def: {
          type: "singleSelect",
          options: { choices: [...LANGUAGE_DEFAULT_CHOICES] },
        },
      },
      { name: "timezone", def: { type: "singleLineText" } },
      {
        name: "linked_model",
        def: {
          type: "multipleRecordLinks",
          options: { linkedTableId: modelsTable.id },
        },
      },
    ];
    const r = await ensureFields(baseId, token, usersTable, userFields, dryRun, "users");
    allCreatedFields.push(...r.created);
    errors.push(...r.errors);
  } else {
    if (!usersTable) console.warn("\n--- users table not found — skip users fields ---");
    if (!modelsTable) console.warn('\n--- modelss/models table not found — skip users.linked_model ---');
  }

  const modelss = findTable(schema, "modelss", "models");
  if (modelss) {
    console.log("\n--- modelss (profile / period helpers) ---");
    const modelssFields: { name: string; def: FieldDef }[] = [
      {
        name: "language_default",
        def: {
          type: "singleSelect",
          options: { choices: [...LANGUAGE_DEFAULT_CHOICES] },
        },
      },
      { name: "timezone", def: { type: "singleLineText" } },
      { name: "last_period_start", def: defaultDateFieldDef() },
      { name: "avg_cycle_length", def: defaultNumberFieldDef() },
      { name: "avg_period_length", def: defaultNumberFieldDef() },
      { name: "period_notes", def: { type: "multilineText" } },
    ];
    const r = await ensureFields(baseId, token, modelss, modelssFields, dryRun, "modelss");
    allCreatedFields.push(...r.created);
    errors.push(...r.errors);
    if (r.created.length === 0 && r.errors.length === 0) {
      console.log(
        "  [modelss] language_default, timezone, last_period_start, avg_cycle_length, avg_period_length, period_notes — all present."
      );
    }
  } else {
    console.warn('\n--- modelss: table not found ---');
  }

  console.log("\n--- summary ---");
  if (allAddedChoices.length === 0 && allCreatedFields.length === 0 && errors.length === 0) {
    console.log("Nothing to add (already complete) or only no-op reads.");
  }
  for (const a of allAddedChoices) {
    console.log(`Choices ${a.where}: ${a.names.join(", ")}`);
  }
  for (const f of allCreatedFields) {
    console.log(`Field created: ${f}`);
  }
  if (errors.length) {
    console.error(`\nCompleted with ${errors.length} error(s).`);
    process.exit(1);
  }
  console.log("\ncomplete:model-fields finished OK.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
