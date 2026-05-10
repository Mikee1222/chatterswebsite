#!/usr/bin/env npx tsx
/**
 * Creates Airtable tables for the chatter mistakes system (Meta API).
 * Usage: npx tsx scripts/create-mistakes-tables.ts
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

async function createMistakeReasonsTable(tables: MetaTable[]): Promise<void> {
  const existing = tables.find((t) => t.name === "mistake_reasons");
  if (existing) {
    console.log(`Table already exists: mistake_reasons (${existing.id})`);
    return;
  }

  const body = {
    name: "mistake_reasons",
    fields: [
      { name: "reason_id", type: "singleLineText" },
      { name: "label", type: "singleLineText" },
      {
        name: "category",
        type: "singleSelect",
        options: {
          choices: [
            { name: "Low", color: "yellowLight2" },
            { name: "Medium", color: "orangeLight2" },
            { name: "High", color: "redLight2" },
          ],
        },
      },
      { name: "points_deduction", type: "number", options: { precision: 0 } },
      { name: "active", type: "checkbox", options: { color: "greenBright", icon: "check" } },
      { name: "sort_order", type: "number", options: { precision: 0 } },
    ],
  };

  const res = await metaFetch("/tables", { method: "POST", body: JSON.stringify(body) });
  const data = (await res.json()) as { name?: string; error?: unknown };
  if (!res.ok) {
    console.error("mistake_reasons create failed:", res.status, data);
    throw new Error(String(JSON.stringify(data)));
  }
  console.log("mistake_reasons:", data.name ?? data.error);
}

async function createChatterMistakesTable(tables: MetaTable[]): Promise<void> {
  const existing = tables.find((t) => t.name === "chatter_mistakes");
  if (existing) {
    console.log(`Table already exists: chatter_mistakes (${existing.id})`);
    return;
  }

  const body = {
    name: "chatter_mistakes",
    fields: [
      { name: "mistake_id", type: "singleLineText" },
      { name: "va_id", type: "singleLineText" },
      { name: "va_name", type: "singleLineText" },
      { name: "chatter_id", type: "singleLineText" },
      { name: "chatter_name", type: "singleLineText" },
      { name: "model_id", type: "singleLineText" },
      { name: "model_name", type: "singleLineText" },
      { name: "sub_username", type: "singleLineText" },
      { name: "mistake_date", type: "dateTime", options: dateTimeAthens },
      { name: "reason_id", type: "singleLineText" },
      { name: "reason_label", type: "singleLineText" },
      {
        name: "reason_category",
        type: "singleSelect",
        options: {
          choices: [
            { name: "Low", color: "yellowLight2" },
            { name: "Medium", color: "orangeLight2" },
            { name: "High", color: "redLight2" },
          ],
        },
      },
      { name: "explanation", type: "multilineText" },
      { name: "screenshot", type: "multipleAttachments" },
      {
        name: "status",
        type: "singleSelect",
        options: {
          choices: [
            { name: "pending", color: "yellowLight2" },
            { name: "approved", color: "greenLight2" },
            { name: "rejected", color: "redLight2" },
          ],
        },
      },
      { name: "admin_notes", type: "multilineText" },
      { name: "admin_id", type: "singleLineText" },
      { name: "reviewed_at", type: "dateTime", options: dateTimeAthens },
      { name: "points_deducted", type: "number", options: { precision: 0 } },
      { name: "created_at", type: "dateTime", options: dateTimeAthens },
      { name: "updated_at", type: "dateTime", options: dateTimeAthens },
    ],
  };

  const res = await metaFetch("/tables", { method: "POST", body: JSON.stringify(body) });
  const data = (await res.json()) as { name?: string; error?: unknown };
  if (!res.ok) {
    console.error("chatter_mistakes create failed:", res.status, data);
    throw new Error(String(JSON.stringify(data)));
  }
  console.log("chatter_mistakes:", data.name ?? data.error);
}

async function main() {
  const tablesRes = await metaFetch("/tables");
  if (!tablesRes.ok) {
    const t = await tablesRes.text();
    throw new Error(`List tables failed: ${tablesRes.status} ${t}`);
  }
  const tablesJson = (await tablesRes.json()) as { tables?: MetaTable[] };
  const tables = tablesJson.tables ?? [];

  await createMistakeReasonsTable(tables);

  const tablesRes2 = await metaFetch("/tables");
  const tables2 = ((await tablesRes2.json()) as { tables?: MetaTable[] }).tables ?? [];
  await createChatterMistakesTable(tables2);

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
