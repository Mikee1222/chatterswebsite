#!/usr/bin/env npx tsx
/**
 * Creates Airtable table `of_subscribers` (Metadata API).
 *
 * Usage (from repo root):
 *   npx tsx scripts/create-of-subscribers-table.ts
 *
 * Requires: AIRTABLE_TOKEN, AIRTABLE_BASE_ID (schema.bases:read + schema.bases:write)
 *
 * Idempotent: if `of_subscribers` already exists, skips table creation.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const TABLE_NAME = "of_subscribers";

type MetaTable = { id: string; name: string };

const dateTimeAthens = {
  dateFormat: { name: "iso" as const },
  timeFormat: { name: "24hour" as const },
  timeZone: "Europe/Athens",
};

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

async function listTables(): Promise<MetaTable[]> {
  const res = await metaFetch("/tables");
  const data = (await res.json()) as { tables?: MetaTable[]; error?: unknown };
  if (!res.ok) throw new Error(`GET tables failed (${res.status}): ${JSON.stringify(data)}`);
  return data.tables ?? [];
}

async function createOfSubscribersTable(): Promise<void> {
  const body = {
    name: TABLE_NAME,
    description: "Cached OnlyFans subscribers per creator account (synced from The Only API).",
    fields: [
      { name: "of_user_id", type: "number", options: { precision: 0 } },
      { name: "of_account_id", type: "singleLineText" },
      { name: "model_name", type: "singleLineText" },
      { name: "display_name", type: "singleLineText" },
      { name: "username", type: "singleLineText" },
      { name: "subscribed_at", type: "dateTime", options: dateTimeAthens },
      { name: "expires_at", type: "dateTime", options: dateTimeAthens },
      { name: "last_synced_at", type: "dateTime", options: dateTimeAthens },
      { name: "total_spent", type: "number", options: { precision: 2 } },
      {
        name: "category",
        type: "singleSelect",
        options: {
          choices: [
            { name: "whale", color: "yellowBright" },
            { name: "vip", color: "purpleLight2" },
            { name: "high_spender", color: "pinkLight2" },
            { name: "medium", color: "cyanLight2" },
            { name: "freeloader", color: "grayLight2" },
            { name: "new", color: "greenLight2" },
          ],
        },
      },
    ],
  };

  const res = await metaFetch("/tables", { method: "POST", body: JSON.stringify(body) });
  const data = (await res.json()) as { name?: string; id?: string; error?: unknown };
  if (!res.ok) {
    console.error(`Create ${TABLE_NAME} failed:`, res.status, data);
    throw new Error(JSON.stringify(data));
  }
  console.log(`Created table: ${data.name ?? TABLE_NAME} (${data.id ?? "?"})`);
}

async function main(): Promise<void> {
  const tables = await listTables();
  const existing = tables.find((t) => t.name === TABLE_NAME);
  if (existing) {
    console.log(`Table already exists: ${TABLE_NAME} (${existing.id}) — skipping creation.`);
    return;
  }
  await createOfSubscribersTable();
  console.log(`Done: ${TABLE_NAME} is ready.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
