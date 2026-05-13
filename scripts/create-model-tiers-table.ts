#!/usr/bin/env npx tsx
/**
 * Creates Airtable table `model_tiers` (Metadata API) and seeds default rows (Data API).
 *
 * Usage: npx tsx scripts/create-model-tiers-table.ts
 * Requires: AIRTABLE_TOKEN, AIRTABLE_BASE_ID
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const TABLE_NAME = "model_tiers";

type MetaTable = { id: string; name: string };

const checkboxOpts = { icon: "check" as const, color: "greenBright" as const };

async function metaFetch(path: string, init?: RequestInit): Promise<Response> {
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();
  const token = process.env.AIRTABLE_TOKEN?.trim();
  if (!baseId || !token) throw new Error("Missing AIRTABLE_BASE_ID or AIRTABLE_TOKEN");
  return fetch(`https://api.airtable.com/v0/meta/bases/${baseId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

async function dataFetch(path: string, init?: RequestInit): Promise<Response> {
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();
  const token = process.env.AIRTABLE_TOKEN?.trim();
  if (!baseId || !token) throw new Error("Missing AIRTABLE_BASE_ID or AIRTABLE_TOKEN");
  return fetch(`https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

async function listTables(): Promise<MetaTable[]> {
  const res = await metaFetch("/tables");
  const data = (await res.json()) as { tables?: MetaTable[]; error?: unknown };
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data.tables ?? [];
}

async function tableHasAnyRecords(): Promise<boolean> {
  const q = new URLSearchParams({ pageSize: "1", maxRecords: "1" });
  const res = await dataFetch(`${encodeURIComponent(TABLE_NAME)}?${q.toString()}`);
  const data = (await res.json()) as { records?: unknown[]; error?: unknown };
  if (!res.ok) throw new Error(JSON.stringify(data));
  return (data.records?.length ?? 0) > 0;
}

async function createTable(): Promise<void> {
  const body = {
    name: TABLE_NAME,
    description: "Model tier groupings (high / medium / low) for internal reference.",
    fields: [
      { name: "model_name", type: "singleLineText" },
      {
        name: "tier",
        type: "singleSelect",
        options: {
          choices: [
            { name: "high", color: "yellowBright" },
            { name: "medium", color: "blueLight2" },
            { name: "low", color: "grayLight2" },
          ],
        },
      },
      { name: "is_active", type: "checkbox", options: checkboxOpts },
      { name: "sort_order", type: "number", options: { precision: 0 } },
    ],
  };
  const res = await metaFetch("/tables", { method: "POST", body: JSON.stringify(body) });
  const data = (await res.json()) as { name?: string; error?: unknown };
  if (!res.ok) {
    console.error("Create failed:", res.status, data);
    throw new Error(JSON.stringify(data));
  }
  console.log(`Created table: ${data.name ?? TABLE_NAME}`);
}

type Seed = { model_name: string; tier: "high" | "medium" | "low"; sort_order: number };

const SEED: Seed[] = [
  { model_name: "Diana", tier: "high", sort_order: 1 },
  { model_name: "Frika", tier: "medium", sort_order: 10 },
  { model_name: "Miss Frost", tier: "medium", sort_order: 11 },
  { model_name: "Eirini", tier: "medium", sort_order: 12 },
  { model_name: "Lina", tier: "medium", sort_order: 13 },
  { model_name: "Silia", tier: "medium", sort_order: 14 },
  { model_name: "Lydia Fwtiadou", tier: "medium", sort_order: 15 },
  { model_name: "Ariandi", tier: "low", sort_order: 20 },
  { model_name: "Antigoni", tier: "low", sort_order: 21 },
  { model_name: "Chrysa", tier: "low", sort_order: 22 },
  { model_name: "Erina", tier: "low", sort_order: 23 },
  { model_name: "Elisavet", tier: "low", sort_order: 24 },
  { model_name: "Stefania", tier: "low", sort_order: 25 },
  { model_name: "Marilia", tier: "low", sort_order: 26 },
  { model_name: "Sofia", tier: "low", sort_order: 27 },
  { model_name: "Eva", tier: "low", sort_order: 28 },
  { model_name: "Gavriela", tier: "low", sort_order: 29 },
  { model_name: "Katerina", tier: "low", sort_order: 30 },
  { model_name: "Stella", tier: "low", sort_order: 31 },
];

async function seed(): Promise<void> {
  for (let i = 0; i < SEED.length; i += 10) {
    const chunk = SEED.slice(i, i + 10);
    const records = chunk.map((r) => ({
      fields: {
        model_name: r.model_name,
        tier: r.tier,
        is_active: true,
        sort_order: r.sort_order,
      },
    }));
    const res = await dataFetch(encodeURIComponent(TABLE_NAME), {
      method: "POST",
      body: JSON.stringify({ records }),
    });
    const data = (await res.json()) as { error?: unknown };
    if (!res.ok) {
      console.error("Seed failed:", res.status, data);
      throw new Error(JSON.stringify(data));
    }
    console.log(`Seeded ${chunk.length} model_tiers rows (batch ${i / 10 + 1}).`);
  }
}

async function main(): Promise<void> {
  const tables = await listTables();
  if (tables.some((t) => t.name === TABLE_NAME)) {
    console.log(`Table ${TABLE_NAME} already exists — skipping creation.`);
  } else {
    await createTable();
  }
  if (await tableHasAnyRecords()) {
    console.log(`${TABLE_NAME} is not empty — skipping seed.`);
    return;
  }
  await seed();
  console.log(`Done: ${SEED.length} rows in ${TABLE_NAME}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
