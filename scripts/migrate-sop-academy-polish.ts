#!/usr/bin/env tsx
/**
 * Idempotent migration for SOP Academy polish:
 * - sop_functions.estimated_minutes (number)
 * - sop_feedback table (member helpfulness + comments)
 *
 * Usage: npx tsx scripts/migrate-sop-academy-polish.ts
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createField, createTable, getBaseSchema, type AirtableTable } from "../lib/airtable-admin";
import type { FieldDef } from "../lib/airtable-schema";

loadEnv({ path: ".env.local" });
loadEnv();

const FUNCTIONS_TABLE = "sop_functions";
const FEEDBACK_TABLE = "sop_feedback";

const DATETIME_TZ = "Asia/Riyadh";
const datetimeOptions = {
  dateFormat: { name: "iso" as const, format: "YYYY-MM-DD" },
  timeFormat: { name: "24hour" as const, format: "HH:mm" },
  timeZone: DATETIME_TZ,
};

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

async function ensureField(
  table: AirtableTable,
  baseId: string,
  token: string,
  tableName: string,
  name: string,
  def: FieldDef
): Promise<void> {
  const existing = table.fields.find((f) => f.name === name);
  if (existing) {
    console.log(`${tableName}.${name} already exists (${existing.type}). Skipping.`);
    return;
  }
  const result = await createField(baseId, token, table.id, name, def, false);
  if (!result.created) {
    console.error(result.error ?? `Failed to create ${name}`);
    process.exit(1);
  }
  console.log(`Created ${tableName}.${name}.`);
}

async function ensureFeedbackTable(
  baseId: string,
  token: string,
  usersTableId: string,
  rolesTableId: string,
  functionsTableId: string
): Promise<void> {
  const schema = await getBaseSchema(baseId, token);
  const existing = schema.tables.find((t) => t.name === FEEDBACK_TABLE);
  if (existing) {
    console.log(`Table ${FEEDBACK_TABLE} already exists. Skipping.`);
    return;
  }

  const result = await createTable(
    baseId,
    token,
    {
      name: FEEDBACK_TABLE,
      fields: [
        { name: "feedback_id", def: { type: "singleLineText" } },
        {
          name: "user",
          def: {
            type: "multipleRecordLinks",
            options: { linkedTableId: usersTableId },
          },
        },
        {
          name: "sop_function",
          def: {
            type: "multipleRecordLinks",
            options: { linkedTableId: functionsTableId },
          },
        },
        {
          name: "sop_role",
          def: {
            type: "multipleRecordLinks",
            options: { linkedTableId: rolesTableId },
          },
        },
        {
          name: "helpful",
          def: {
            type: "singleSelect",
            options: { choices: [{ name: "yes" }, { name: "no" }] },
          },
        },
        { name: "comment", def: { type: "multilineText" } },
        { name: "created_at", def: { type: "dateTime", options: datetimeOptions } },
      ],
    },
    false
  );

  if (!result.created) {
    console.error(result.error ?? `Failed to create ${FEEDBACK_TABLE}`);
    process.exit(1);
  }
  console.log(`Created table ${FEEDBACK_TABLE}.`);
}

async function main(): Promise<void> {
  const { token, baseId } = getCredentials();
  const schema = await getBaseSchema(baseId, token);

  const functionsTable = schema.tables.find((t) => t.name === FUNCTIONS_TABLE);
  const rolesTable = schema.tables.find((t) => t.name === "sop_roles");
  const usersTable = schema.tables.find((t) => t.name.trim().toLowerCase() === "users");

  if (!functionsTable) {
    console.error(`Table "${FUNCTIONS_TABLE}" not found.`);
    process.exit(1);
  }
  if (!rolesTable || !usersTable) {
    console.error("Missing sop_roles or users table.");
    process.exit(1);
  }

  await ensureField(functionsTable, baseId, token, FUNCTIONS_TABLE, "estimated_minutes", {
    type: "number",
    options: { precision: 0 },
  });

  await ensureFeedbackTable(baseId, token, usersTable.id, rolesTable.id, functionsTable.id);

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
