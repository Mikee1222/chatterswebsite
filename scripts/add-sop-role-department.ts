#!/usr/bin/env tsx
/**
 * Idempotent migration: sop_roles.department (linked → sop_departments, single, optional).
 *
 * Usage: npx tsx scripts/add-sop-role-department.ts
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createField, getBaseSchema, type AirtableTable } from "../lib/airtable-admin";
import type { FieldDef } from "../lib/airtable-schema";

loadEnv({ path: ".env.local" });
loadEnv();

const ROLES_TABLE = "sop_roles";
const DEPARTMENTS_TABLE = "sop_departments";

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

async function main(): Promise<void> {
  const { token, baseId } = getCredentials();
  const schema = await getBaseSchema(baseId, token);

  const rolesTable = schema.tables.find((t) => t.name === ROLES_TABLE);
  const departmentsTable = schema.tables.find((t) => t.name === DEPARTMENTS_TABLE);
  if (!rolesTable) {
    console.error(`Table "${ROLES_TABLE}" not found.`);
    process.exit(1);
  }
  if (!departmentsTable) {
    console.error(`Table "${DEPARTMENTS_TABLE}" not found. Run setup-sop-tables first.`);
    process.exit(1);
  }

  await ensureField(rolesTable, baseId, token, ROLES_TABLE, "department", {
    type: "multipleRecordLinks",
    options: { linkedTableId: departmentsTable.id },
  });

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
