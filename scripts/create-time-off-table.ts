#!/usr/bin/env tsx

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnv();
loadEnv({ path: ".env.local" });

const META_BASE = "https://api.airtable.com/v0/meta/bases";
const TABLE_NAME = "model_time_off_requests";
const MODELS_TABLE_CANDIDATES = ["modelss", "models"];

type AirtableField = { id: string; name: string; type: string };
type AirtableTable = { id: string; name: string; fields: AirtableField[] };
type BaseSchemaResponse = { tables?: AirtableTable[] };

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
    console.error("Missing AIRTABLE_TOKEN in environment.");
    process.exit(1);
  }
  const baseId = process.env.AIRTABLE_BASE_ID?.trim() || loadBaseIdFromWrangler() || "";
  if (!baseId) {
    console.error("Missing AIRTABLE_BASE_ID in environment and wrangler.jsonc.");
    process.exit(1);
  }
  return { token, baseId };
}

async function airtableFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

async function getSchema(baseId: string, token: string): Promise<AirtableTable[]> {
  const res = await airtableFetch(`${META_BASE}/${encodeURIComponent(baseId)}/tables`, token);
  const body = await res.text();
  if (!res.ok) throw new Error(`Schema fetch failed (${res.status}): ${body}`);
  const data = JSON.parse(body) as BaseSchemaResponse;
  return data.tables ?? [];
}

async function createTableWithRequestIdField(baseId: string, token: string): Promise<void> {
  const body = {
    name: TABLE_NAME,
    fields: [
      {
        name: "request_id",
        type: "singleLineText",
      },
    ],
  };
  const res = await airtableFetch(`${META_BASE}/${encodeURIComponent(baseId)}/tables`, token, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Create table failed (${res.status}): ${text}`);
  console.log(`✅ Created table: ${TABLE_NAME}`);
}

async function createField(
  baseId: string,
  token: string,
  tableId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const res = await airtableFetch(
    `${META_BASE}/${encodeURIComponent(baseId)}/tables/${encodeURIComponent(tableId)}/fields`,
    token,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text}`);
}

async function main(): Promise<void> {
  const { token, baseId } = getCredentials();
  console.log(`Using base: ${baseId}`);

  let tables = await getSchema(baseId, token);
  let table = tables.find((t) => t.name === TABLE_NAME);

  if (!table) {
    await createTableWithRequestIdField(baseId, token);
    tables = await getSchema(baseId, token);
    table = tables.find((t) => t.name === TABLE_NAME);
    if (!table) throw new Error(`Table "${TABLE_NAME}" was created but not found in schema refresh.`);
  } else {
    console.log(`ℹ️ Table already exists: ${TABLE_NAME}`);
  }

  const modelsTable = tables.find((t) => MODELS_TABLE_CANDIDATES.includes(t.name));
  if (!modelsTable) {
    console.error(`❌ Could not find linked models table. Expected one of: ${MODELS_TABLE_CANDIDATES.join(", ")}`);
    process.exit(1);
  }
  console.log(`ℹ️ Using linked models table: ${modelsTable.name} (${modelsTable.id})`);

  const existingFieldNames = new Set(table.fields.map((f) => f.name));
  const fieldPayloads: Array<{ name: string; payload: Record<string, unknown> }> = [
    { name: "request_id", payload: { name: "request_id", type: "singleLineText" } },
    {
      name: "model",
      payload: {
        name: "model",
        type: "multipleRecordLinks",
        options: { linkedTableId: modelsTable.id },
      },
    },
    { name: "model_name", payload: { name: "model_name", type: "singleLineText" } },
    {
      name: "start_date",
      payload: {
        name: "start_date",
        type: "date",
        options: { dateFormat: { name: "iso", format: "YYYY-MM-DD" } },
      },
    },
    {
      name: "end_date",
      payload: {
        name: "end_date",
        type: "date",
        options: { dateFormat: { name: "iso", format: "YYYY-MM-DD" } },
      },
    },
    { name: "reason", payload: { name: "reason", type: "multilineText" } },
    {
      name: "status",
      payload: {
        name: "status",
        type: "singleSelect",
        options: {
          choices: [{ name: "submitted" }, { name: "approved" }, { name: "rejected" }],
        },
      },
    },
    { name: "created_at", payload: { name: "created_at", type: "createdTime" } },
  ];

  console.log("\nCreating fields (if missing):");
  for (const { name, payload } of fieldPayloads) {
    if (existingFieldNames.has(name)) {
      console.log(`- ${name}: already exists`);
      continue;
    }
    try {
      await createField(baseId, token, table.id, payload);
      console.log(`- ${name}: ✅ created`);
    } catch (error) {
      console.error(`- ${name}: ❌ failed`);
      console.error(`  ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

