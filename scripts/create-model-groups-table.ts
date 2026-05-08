#!/usr/bin/env tsx
/**
 * Creates `model_groups` for admin earnings grouping (multipleRecordLinks → modelss).
 *
 * Requires: AIRTABLE_TOKEN, AIRTABLE_BASE_ID (.env / .env.local / wrangler.jsonc)
 *
 * Usage: npx tsx scripts/create-model-groups-table.ts
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnv({ path: ".env.local" });
loadEnv();

type MetaTable = { id: string; name: string };

function loadBaseIdFromWrangler(): string | null {
  const path = resolve(process.cwd(), "wrangler.jsonc");
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  const m = raw.match(/"AIRTABLE_BASE_ID"\s*:\s*"([^"]+)"/);
  return m?.[1] ?? null;
}

async function metaFetch(baseId: string, token: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.airtable.com/v0/meta/bases/${baseId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

async function main(): Promise<void> {
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

  const tablesRes = await metaFetch(baseId, token, "/tables");
  const tablesJson = (await tablesRes.json()) as { tables?: MetaTable[] };
  const tables = tablesJson.tables ?? [];

  const existing = tables.find((t) => t.name === "model_groups");
  if (existing) {
    console.log(`Table already exists: model_groups (${existing.id})`);
    return;
  }

  const modelss = tables.find((t) => t.name === "modelss");
  if (!modelss) throw new Error('Could not find "modelss" table in this base.');

  const body = {
    name: "model_groups",
    fields: [
      { name: "name", type: "singleLineText" },
      {
        name: "model_ids",
        type: "multipleRecordLinks",
        options: { linkedTableId: modelss.id },
      },
      { name: "description", type: "multilineText" },
      {
        name: "created_at",
        type: "dateTime",
        options: {
          dateFormat: { name: "iso" },
          timeFormat: { name: "24hour" },
          timeZone: "Europe/Athens",
        },
      },
    ],
  };

  const createRes = await metaFetch(baseId, token, "/tables", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await createRes.json();
  console.log(createRes.ok ? "Created model_groups." : "Create failed:", JSON.stringify(data, null, 2));
  if (!createRes.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
