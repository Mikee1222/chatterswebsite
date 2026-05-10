#!/usr/bin/env npx tsx
/**
 * Creates Airtable table `fines_and_bonuses` (Meta API).
 * Usage: npx tsx scripts/create-fines-bonuses-table.ts
 * Requires: AIRTABLE_TOKEN, AIRTABLE_BASE_ID (e.g. from .env.local)
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

type MetaTable = { id: string; name: string };

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

const dateTimeAthens = {
  dateFormat: { name: "iso" as const },
  timeFormat: { name: "24hour" as const },
  timeZone: "Europe/Athens",
};

async function listTables(): Promise<MetaTable[]> {
  const res = await metaFetch("/tables");
  const data = (await res.json()) as { tables?: MetaTable[] };
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data.tables ?? [];
}

async function run(): Promise<void> {
  const tables = await listTables();
  const existing = tables.find((t) => t.name === "fines_and_bonuses");
  if (existing) {
    console.log(`Table already exists: fines_and_bonuses (${existing.id})`);
    return;
  }

  const body = {
    name: "fines_and_bonuses",
    fields: [
      { name: "entry_id", type: "singleLineText" },
      { name: "user_id", type: "singleLineText" },
      { name: "user_name", type: "singleLineText" },
      {
        name: "user_role",
        type: "singleSelect",
        options: {
          choices: [
            { name: "chatter", color: "blueLight2" },
            { name: "va", color: "purpleLight2" },
          ],
        },
      },
      {
        name: "type",
        type: "singleSelect",
        options: {
          choices: [
            { name: "bonus", color: "greenLight2" },
            { name: "fine", color: "redLight2" },
          ],
        },
      },
      { name: "amount", type: "currency", options: { precision: 2, symbol: "€" } },
      { name: "reason", type: "singleLineText" },
      { name: "notes", type: "multilineText" },
      { name: "month", type: "singleLineText" },
      { name: "admin_id", type: "singleLineText" },
      { name: "admin_name", type: "singleLineText" },
      { name: "created_at", type: "dateTime", options: dateTimeAthens },
    ],
  };

  const res = await metaFetch("/tables", { method: "POST", body: JSON.stringify(body) });
  const data = (await res.json()) as { name?: string; error?: unknown };
  if (!res.ok) {
    console.error("fines_and_bonuses create failed:", res.status, data);
    throw new Error(String(JSON.stringify(data)));
  }
  console.log("fines_and_bonuses:", data.name ?? data.error);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
