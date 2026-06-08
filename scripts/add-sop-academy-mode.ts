#!/usr/bin/env tsx
/**
 * Idempotent migration for SOP Academy mode:
 * - sop_roles.academy_mode (checkbox)
 * - sop_progress table (user + function + role completion tracking)
 *
 * Usage: npx tsx scripts/add-sop-academy-mode.ts
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createField, createTable, getBaseSchema, type AirtableTable } from "../lib/airtable-admin";
import type { FieldDef } from "../lib/airtable-schema";

loadEnv({ path: ".env.local" });
loadEnv();

const ROLES_TABLE = "sop_roles";
const PROGRESS_TABLE = "sop_progress";

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

async function ensureProgressTable(
  baseId: string,
  token: string,
  usersTableId: string,
  rolesTableId: string,
  functionsTableId: string
): Promise<void> {
  const schema = await getBaseSchema(baseId, token);
  const existing = schema.tables.find((t) => t.name === PROGRESS_TABLE);
  if (existing) {
    console.log(`Table ${PROGRESS_TABLE} already exists. Skipping.`);
    return;
  }

  const result = await createTable(
    baseId,
    token,
    {
      name: PROGRESS_TABLE,
      fields: [
        { name: "progress_id", def: { type: "singleLineText" } },
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
        { name: "completed_at", def: { type: "dateTime", options: datetimeOptions } },
        { name: "created_at", def: { type: "dateTime", options: datetimeOptions } },
      ],
    },
    false
  );

  if (!result.created) {
    console.error(result.error ?? `Failed to create ${PROGRESS_TABLE}`);
    process.exit(1);
  }
  console.log(`Created table ${PROGRESS_TABLE}.`);
}

async function main(): Promise<void> {
  const { token, baseId } = getCredentials();
  const schema = await getBaseSchema(baseId, token);

  const rolesTable = schema.tables.find((t) => t.name === ROLES_TABLE);
  if (!rolesTable) {
    console.error(`Table "${ROLES_TABLE}" not found.`);
    process.exit(1);
  }

  await ensureField(rolesTable, baseId, token, ROLES_TABLE, "academy_mode", {
    type: "checkbox",
    options: checkboxOptions,
  });

  const usersTable = schema.tables.find(
    (t) => t.name.trim().toLowerCase() === "users"
  );
  const functionsTable = schema.tables.find((t) => t.name === "sop_functions");
  if (!usersTable || !rolesTable || !functionsTable) {
    console.error(
      "Missing dependency tables:",
      !usersTable ? "users" : "",
      !functionsTable ? "sop_functions" : ""
    );
    process.exit(1);
  }

  await ensureProgressTable(
    baseId,
    token,
    usersTable.id,
    rolesTable.id,
    functionsTable.id
  );

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
