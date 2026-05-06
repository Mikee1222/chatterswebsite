#!/usr/bin/env tsx
/**
 * Add model-related Airtable fields and the va_content_assignments table.
 *
 * Requires: AIRTABLE_TOKEN, AIRTABLE_BASE_ID (or wrangler.jsonc base id)
 * Scopes: schema.bases:read, schema.bases:write, data.records:read (for nothing extra)
 *
 * Usage:
 *   npm run setup:model-tables
 *   npm run setup:model-tables -- --dry-run
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createField,
  getBaseSchema,
  syncBase,
  type BaseSchema,
} from "../lib/airtable-admin";
import type { FieldDef, TableDef } from "../lib/airtable-schema";

loadEnv();
loadEnv({ path: ".env.local" });

const META_FIELDS = "https://api.airtable.com/v0/meta/bases";

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

function findTableId(schema: BaseSchema, ...names: string[]): string | null {
  const lower = names.map((n) => n.toLowerCase());
  for (const t of schema.tables) {
    if (lower.includes(t.name.toLowerCase())) return t.id;
  }
  return null;
}

async function ensureFields(
  baseId: string,
  token: string,
  tableName: string,
  schema: BaseSchema,
  fields: { name: string; def: FieldDef }[],
  dryRun: boolean
): Promise<{ created: string[]; skipped: string[]; errors: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];
  const table = schema.tables.find((t) => t.name === tableName);
  if (!table) {
    errors.push(`Table "${tableName}" not found — skipped ${fields.length} field(s).`);
    return { created, skipped, errors };
  }
  const existing = new Set(table.fields.map((f) => f.name));
  for (const { name, def } of fields) {
    if (existing.has(name)) {
      skipped.push(`${tableName}.${name}`);
      continue;
    }
    const r = await createField(baseId, token, table.id, name, def, dryRun);
    if (r.created) {
      created.push(`${tableName}.${name}`);
      existing.add(name);
    } else {
      errors.push(`${tableName}.${name}: ${r.error ?? "unknown error"}`);
    }
  }
  return { created, skipped, errors };
}

/** Airtable Meta API: createdTime / lastModifiedTime (not supported by fieldDefToApiPayload fallback). */
async function ensureComputedTimeFields(
  baseId: string,
  token: string,
  tableId: string,
  existing: Set<string>,
  dryRun: boolean
): Promise<void> {
  const dateTimeResult = {
    type: "dateTime",
    options: {
      dateFormat: { name: "iso", format: "YYYY-MM-DD" },
      timeFormat: { name: "24hour", format: "HH:mm" },
      timeZone: "utc",
    },
  };

  const payloads: { name: string; body: Record<string, unknown> }[] = [];
  if (!existing.has("created_at")) {
    payloads.push({
      name: "created_at",
      body: {
        name: "created_at",
        type: "createdTime",
        options: { result: dateTimeResult },
      },
    });
  }
  if (!existing.has("updated_at")) {
    payloads.push({
      name: "updated_at",
      body: {
        name: "updated_at",
        type: "lastModifiedTime",
        options: { result: dateTimeResult },
      },
    });
  }

  for (const { name, body } of payloads) {
    if (dryRun) {
      console.log(`  [dry-run] would add computed field ${name}`);
      continue;
    }
    const res = await fetch(
      `${META_FIELDS}/${encodeURIComponent(baseId)}/tables/${encodeURIComponent(tableId)}/fields`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      const msg = `va_content_assignments.${name}: ${res.status} ${text}`;
      console.warn(`  Warning: ${msg}`);
      console.warn(
        "  (Airtable often does not allow creating createdTime / lastModifiedTime via API — add these fields in the base UI if missing.)"
      );
    } else {
      console.log(`  Added computed field: va_content_assignments.${name}`);
    }
  }
}

function vaContentAssignmentsTableDef(usersTableId: string, modelsTableId: string): TableDef {
  return {
    name: "va_content_assignments",
    fields: [
      { name: "assignment_id", def: { type: "singleLineText" } },
      {
        name: "va",
        def: {
          type: "multipleRecordLinks",
          options: { linkedTableId: usersTableId },
        },
      },
      {
        name: "model",
        def: {
          type: "multipleRecordLinks",
          options: { linkedTableId: modelsTableId },
        },
      },
      { name: "title", def: { type: "singleLineText" } },
      { name: "description", def: { type: "multilineText" } },
      {
        name: "content_type",
        def: {
          type: "singleSelect",
          options: {
            choices: [
              { name: "PDF" },
              { name: "Video Script" },
              { name: "Photo Guide" },
              { name: "Other" },
            ],
          },
        },
      },
      { name: "file_url", def: { type: "url" } },
      {
        name: "file_attachment",
        def: { type: "multipleAttachments", options: { isReversed: false } },
      },
      { name: "deadline", def: { type: "dateTime" } },
      { name: "scheduled_date", def: { type: "dateTime" } },
      {
        name: "status",
        def: {
          type: "singleSelect",
          options: {
            choices: [
              { name: "pending" },
              { name: "scheduled" },
              { name: "completed" },
              { name: "cancelled" },
            ],
          },
        },
      },
      {
        name: "priority",
        def: {
          type: "singleSelect",
          options: {
            choices: [
              { name: "low" },
              { name: "normal" },
              { name: "high" },
              { name: "urgent" },
            ],
          },
        },
      },
      { name: "model_notes", def: { type: "multilineText" } },
      { name: "va_notes", def: { type: "multilineText" } },
      { name: "completed_at", def: { type: "dateTime" } },
    ],
  };
}

async function updateCustomRequests(
  baseId: string,
  token: string,
  schema: BaseSchema,
  dryRun: boolean
) {
  console.log("\n--- custom_requests ---");
  // If the app uses model_status `uploaded`, add that choice to the existing model_status single-select in Airtable (API cannot patch new options on existing fields).
  const fields: { name: string; def: FieldDef }[] = [
    { name: "decline_reason", def: { type: "multilineText" } },
    { name: "uploaded_at", def: { type: "dateTime" } },
    { name: "uploaded_by_model", def: { type: "checkbox" } },
  ];
  const r = await ensureFields(baseId, token, "custom_requests", schema, fields, dryRun);
  r.created.forEach((x) => console.log(`  Created field: ${x}`));
  r.skipped.forEach((x) => console.log(`  Already exists: ${x}`));
  r.errors.forEach((e) => console.error(`  Error: ${e}`));
}

async function updateModelPeriods(
  baseId: string,
  token: string,
  schema: BaseSchema,
  dryRun: boolean
) {
  console.log("\n--- model_periods ---");
  const fields: { name: string; def: FieldDef }[] = [
    { name: "predicted_next_date", def: { type: "date" } },
    { name: "came_early", def: { type: "checkbox" } },
    { name: "tracking_enabled", def: { type: "checkbox" } },
    { name: "missed_period", def: { type: "checkbox" } },
  ];
  const r = await ensureFields(baseId, token, "model_periods", schema, fields, dryRun);
  r.created.forEach((x) => console.log(`  Created field: ${x}`));
  r.skipped.forEach((x) => console.log(`  Already exists: ${x}`));
  r.errors.forEach((e) => console.error(`  Error: ${e}`));
}

async function createVAContentAssignments(
  baseId: string,
  token: string,
  schema: BaseSchema,
  dryRun: boolean
): Promise<string[]> {
  console.log("\n--- va_content_assignments ---");
  const errors: string[] = [];
  const usersId = findTableId(schema, "users");
  const modelsId = findTableId(schema, "modelss", "models");
  if (!usersId) {
    const msg = 'Could not resolve "users" table id (need a table named users).';
    console.error(`  Error: ${msg}`);
    errors.push(msg);
    return errors;
  }
  if (!modelsId) {
    const msg = 'Could not resolve models table id (expected name "modelss" or "models").';
    console.error(`  Error: ${msg}`);
    errors.push(msg);
    return errors;
  }
  console.log(`  Link targets: users=${usersId}, models=${modelsId}`);

  const tableDef = vaContentAssignmentsTableDef(usersId, modelsId);
  const result = await syncBase(baseId, "model-features", token, [tableDef], dryRun);

  result.tablesCreated.forEach((t) => console.log(`  Created table: ${t}`));
  result.tablesExisted.forEach((t) => console.log(`  Table already exists: ${t}`));
  result.fieldsCreated.forEach(({ table, field }) =>
    console.log(`  Created field: ${table}.${field}`)
  );
  result.fieldsExisted.forEach(({ table, field }) =>
    console.log(`  Field already exists: ${table}.${field}`)
  );
  result.fallbackFields.forEach((f) =>
    console.log(`  Fallback type: ${f.table}.${f.field} (${f.requestedType} → ${f.actualType})`)
  );
  result.errors.forEach((e) => {
    console.error(`  Error: ${e}`);
    errors.push(e);
  });

  const fresh = await getBaseSchema(baseId, token);
  const vaTable = fresh.tables.find((t) => t.name === "va_content_assignments");
  if (!vaTable) {
    errors.push("va_content_assignments table missing after sync.");
    return errors;
  }
  const names = new Set(vaTable.fields.map((f) => f.name));
  await ensureComputedTimeFields(baseId, token, vaTable.id, names, dryRun);
  return errors;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const { token, baseId } = getCredentials();

  console.log("Setting up model tables…");
  if (dryRun) console.log("(dry-run: no writes)\n");

  let schema = await getBaseSchema(baseId, token);

  await updateCustomRequests(baseId, token, schema, dryRun);
  await updateModelPeriods(baseId, token, schema, dryRun);

  schema = await getBaseSchema(baseId, token);
  const errors = await createVAContentAssignments(baseId, token, schema, dryRun);

  if (errors.length) {
    console.error("\nCompleted with errors (see above).");
    process.exit(1);
  }
  console.log("\nModel tables setup complete.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
