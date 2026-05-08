#!/usr/bin/env tsx
/**
 * Adds audit-missing columns on custom_requests:
 * - assigned_va (singleLineText) — stores VA user record id string
 * - updated_at (dateTime)
 *
 * Idempotent per field name.
 *
 * Usage: npx tsx scripts/add-custom-requests-audit-fields.ts
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createField, getBaseSchema, type AirtableTable } from "../lib/airtable-admin";
import type { FieldDef } from "../lib/airtable-schema";

loadEnv({ path: ".env.local" });
loadEnv();

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

async function ensureField(table: AirtableTable, baseId: string, token: string, name: string, def: FieldDef): Promise<void> {
  const existing = table.fields.find((f) => f.name === name);
  if (existing) {
    console.log(`custom_requests.${name} already exists (${existing.type}). Skipping.`);
    return;
  }
  const result = await createField(baseId, token, table.id, name, def, false);
  if (!result.created) {
    console.error(result.error ?? `Failed to create ${name}`);
    process.exit(1);
  }
  console.log(`Created custom_requests.${name}.`);
}

async function main(): Promise<void> {
  const { token, baseId } = getCredentials();
  const schema = await getBaseSchema(baseId, token);
  const table = schema.tables.find((t) => t.name === "custom_requests");
  if (!table) {
    console.error('Table "custom_requests" not found.');
    process.exit(1);
  }

  await ensureField(table, baseId, token, "assigned_va", { type: "singleLineText" });
  await ensureField(table, baseId, token, "updated_at", {
    type: "dateTime",
    options: {
      dateFormat: { name: "iso" },
      timeFormat: { name: "24hour" },
      timeZone: "Europe/Athens",
    },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
