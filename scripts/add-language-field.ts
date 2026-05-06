#!/usr/bin/env tsx
/**
 * Creates `users.language_preference` (single select: en, es) via Airtable Metadata API.
 * Idempotent: if the field already exists, logs and exits 0.
 *
 * Requires: AIRTABLE_TOKEN, AIRTABLE_BASE_ID (same as other scripts; optional wrangler.jsonc for base id)
 *
 * Usage: npm run add:language-field
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createField, getBaseSchema, type AirtableTable } from "../lib/airtable-admin";
import type { FieldDef } from "../lib/airtable-schema";

loadEnv();
loadEnv({ path: ".env.local" });

const FIELD_NAME = "language_preference";

const FIELD_DEF: FieldDef = {
  type: "singleSelect",
  options: {
    choices: [{ name: "en" }, { name: "es" }],
  },
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

function findUsersTable(schema: { tables: AirtableTable[] }): AirtableTable | null {
  const t = schema.tables.find((x) => x.name.toLowerCase() === "users");
  return t ?? null;
}

async function main(): Promise<void> {
  const { token, baseId } = getCredentials();
  const schema = await getBaseSchema(baseId, token);
  const usersTable = findUsersTable(schema);
  if (!usersTable) {
    console.error('Table "users" not found in base.');
    process.exit(1);
  }

  const existing = usersTable.fields.find((f) => f.name === FIELD_NAME);
  if (existing) {
    console.log(`Field "users".${FIELD_NAME} already exists (type: ${existing.type}). Skipping.`);
    return;
  }

  const result = await createField(baseId, token, usersTable.id, FIELD_NAME, FIELD_DEF, false);
  if (!result.created) {
    console.error(result.error ?? "Failed to create field.");
    process.exit(1);
  }
  console.log(`Created field users.${FIELD_NAME} (single select: en, es).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
