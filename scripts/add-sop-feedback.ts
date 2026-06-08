#!/usr/bin/env tsx
/**
 * Idempotent migration: sop_feedback table for member thumbs up/down + comments.
 *
 * Usage: npx tsx scripts/add-sop-feedback.ts
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createTable, getBaseSchema } from "../lib/airtable-admin";

loadEnv({ path: ".env.local" });
loadEnv();

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

  const functionsTable = schema.tables.find((t) => t.name === "sop_functions");
  const rolesTable = schema.tables.find((t) => t.name === "sop_roles");
  const usersTable = schema.tables.find((t) => t.name.trim().toLowerCase() === "users");

  if (!functionsTable || !rolesTable || !usersTable) {
    console.error("Missing dependency tables: users, sop_roles, and/or sop_functions");
    process.exit(1);
  }

  await ensureFeedbackTable(
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
