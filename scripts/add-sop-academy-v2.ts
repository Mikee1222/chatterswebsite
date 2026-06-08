#!/usr/bin/env tsx
/**
 * Idempotent migration for SOP Academy v2:
 * - sop_quiz_questions table
 * - sop_signoffs table
 * - sop_functions.content_version (number, default 1)
 * - sop_progress.completed_version + quiz_score
 *
 * Usage: npx tsx scripts/add-sop-academy-v2.ts
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createField, createTable, getBaseSchema, type AirtableTable } from "../lib/airtable-admin";
import type { FieldDef } from "../lib/airtable-schema";

loadEnv({ path: ".env.local" });
loadEnv();

const FUNCTIONS_TABLE = "sop_functions";
const PROGRESS_TABLE = "sop_progress";
const QUIZ_TABLE = "sop_quiz_questions";
const SIGNOFFS_TABLE = "sop_signoffs";

const DATETIME_TZ = "Asia/Riyadh";
const datetimeOptions = {
  dateFormat: { name: "iso" as const, format: "YYYY-MM-DD" },
  timeFormat: { name: "24hour" as const, format: "HH:mm" },
  timeZone: DATETIME_TZ,
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

async function ensureQuizTable(
  baseId: string,
  token: string,
  functionsTableId: string
): Promise<void> {
  const schema = await getBaseSchema(baseId, token);
  const existing = schema.tables.find((t) => t.name === QUIZ_TABLE);
  if (existing) {
    console.log(`Table ${QUIZ_TABLE} already exists. Skipping.`);
    return;
  }

  const result = await createTable(
    baseId,
    token,
    {
      name: QUIZ_TABLE,
      fields: [
        { name: "question_id", def: { type: "singleLineText" } },
        {
          name: "sop_function",
          def: {
            type: "multipleRecordLinks",
            options: { linkedTableId: functionsTableId },
          },
        },
        { name: "question", def: { type: "multilineText" } },
        { name: "option_a", def: { type: "singleLineText" } },
        { name: "option_b", def: { type: "singleLineText" } },
        { name: "option_c", def: { type: "singleLineText" } },
        { name: "option_d", def: { type: "singleLineText" } },
        {
          name: "correct_option",
          def: {
            type: "singleSelect",
            options: {
              choices: [{ name: "a" }, { name: "b" }, { name: "c" }, { name: "d" }],
            },
          },
        },
        { name: "sort_order", def: { type: "number", options: { precision: 0 } } },
        { name: "is_active", def: { type: "checkbox", options: checkboxOptions } },
        { name: "created_at", def: { type: "dateTime", options: datetimeOptions } },
      ],
    },
    false
  );

  if (!result.created) {
    console.error(result.error ?? `Failed to create ${QUIZ_TABLE}`);
    process.exit(1);
  }
  console.log(`Created table ${QUIZ_TABLE}.`);
}

async function ensureSignoffsTable(
  baseId: string,
  token: string,
  usersTableId: string,
  rolesTableId: string
): Promise<void> {
  const schema = await getBaseSchema(baseId, token);
  const existing = schema.tables.find((t) => t.name === SIGNOFFS_TABLE);
  if (existing) {
    console.log(`Table ${SIGNOFFS_TABLE} already exists. Skipping.`);
    return;
  }

  const result = await createTable(
    baseId,
    token,
    {
      name: SIGNOFFS_TABLE,
      fields: [
        { name: "signoff_id", def: { type: "singleLineText" } },
        {
          name: "user",
          def: {
            type: "multipleRecordLinks",
            options: { linkedTableId: usersTableId },
          },
        },
        {
          name: "sop_role",
          def: {
            type: "multipleRecordLinks",
            options: { linkedTableId: rolesTableId },
          },
        },
        { name: "signed_at", def: { type: "dateTime", options: datetimeOptions } },
        { name: "statement", def: { type: "multilineText" } },
        { name: "created_at", def: { type: "dateTime", options: datetimeOptions } },
      ],
    },
    false
  );

  if (!result.created) {
    console.error(result.error ?? `Failed to create ${SIGNOFFS_TABLE}`);
    process.exit(1);
  }
  console.log(`Created table ${SIGNOFFS_TABLE}.`);
}

async function main(): Promise<void> {
  const { token, baseId } = getCredentials();
  const schema = await getBaseSchema(baseId, token);

  const functionsTable = schema.tables.find((t) => t.name === FUNCTIONS_TABLE);
  const progressTable = schema.tables.find((t) => t.name === PROGRESS_TABLE);
  const rolesTable = schema.tables.find((t) => t.name === "sop_roles");
  const usersTable = schema.tables.find((t) => t.name.trim().toLowerCase() === "users");

  if (!functionsTable) {
    console.error(`Table "${FUNCTIONS_TABLE}" not found.`);
    process.exit(1);
  }
  if (!progressTable) {
    console.error(`Table "${PROGRESS_TABLE}" not found. Run add-sop-academy-mode.ts first.`);
    process.exit(1);
  }
  if (!rolesTable || !usersTable) {
    console.error("Missing dependency tables: users and/or sop_roles");
    process.exit(1);
  }

  await ensureField(functionsTable, baseId, token, FUNCTIONS_TABLE, "content_version", {
    type: "number",
    options: { precision: 0 },
  });

  await ensureField(progressTable, baseId, token, PROGRESS_TABLE, "completed_version", {
    type: "number",
    options: { precision: 0 },
  });

  await ensureField(progressTable, baseId, token, PROGRESS_TABLE, "quiz_score", {
    type: "number",
    options: { precision: 0 },
  });

  await ensureQuizTable(baseId, token, functionsTable.id);
  await ensureSignoffsTable(baseId, token, usersTable.id, rolesTable.id);

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
