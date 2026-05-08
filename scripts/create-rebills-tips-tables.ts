/**
 * Creates `rebills` and `tips` tables via Airtable Meta API.
 *
 * Run: `npx tsx scripts/create-rebills-tips-tables.ts`
 *
 * Note: Meta API dateTime requires timeFormat `{ name: "24hour" }` or `"12hour"` —
 * `"international"` is rejected (422).
 */

import dotenv from "dotenv";

dotenv.config();

type MetaTable = { id: string; name: string };

async function metaListTables(token: string, baseId: string): Promise<MetaTable[]> {
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`List tables failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { tables?: MetaTable[] };
  return json.tables ?? [];
}

async function createTable(token: string, baseId: string, body: { name: string; fields: unknown[] }): Promise<void> {
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    console.error(`Create "${body.name}" failed:`, res.status, JSON.stringify(data, null, 2));
    return;
  }
  console.log(`${body.name}:`, (data.name as string) ?? JSON.stringify(data));
}

async function createTables() {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();
  if (!token || !baseId) {
    throw new Error("Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID in environment");
  }

  const tables = await metaListTables(token, baseId);
  const byName = new Map(tables.map((t) => [t.name, t]));

  if (!byName.has("rebills")) {
    await createTable(token, baseId, {
      name: "rebills",
      fields: [
        { name: "rebill_id", type: "singleLineText" },
        { name: "chatter_id", type: "singleLineText" },
        { name: "chatter_name", type: "singleLineText" },
        { name: "model_id", type: "singleLineText" },
        { name: "model_name", type: "singleLineText" },
        { name: "sub_username", type: "singleLineText" },
        {
          name: "sub_type",
          type: "singleSelect",
          options: {
            choices: [
              { name: "paid", color: "greenLight2" },
              { name: "free", color: "blueLight2" },
              { name: "free_trial", color: "yellowLight2" },
            ],
          },
        },
        { name: "screenshot", type: "multipleAttachments" },
        {
          name: "status",
          type: "singleSelect",
          options: {
            choices: [
              { name: "pending", color: "yellowLight2" },
              { name: "verified", color: "greenLight2" },
              { name: "rejected", color: "redLight2" },
            ],
          },
        },
        { name: "admin_notes", type: "multilineText" },
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
    });
  } else {
    console.log("rebills: already exists — skip");
  }

  if (!byName.has("tips")) {
    await createTable(token, baseId, {
      name: "tips",
      fields: [
        { name: "tip_id", type: "singleLineText" },
        { name: "chatter_id", type: "singleLineText" },
        { name: "chatter_name", type: "singleLineText" },
        { name: "model_id", type: "singleLineText" },
        { name: "model_name", type: "singleLineText" },
        { name: "sub_username", type: "singleLineText" },
        { name: "amount_usd", type: "currency", options: { precision: 2, symbol: "$" } },
        { name: "screenshot", type: "multipleAttachments" },
        {
          name: "status",
          type: "singleSelect",
          options: {
            choices: [
              { name: "pending", color: "yellowLight2" },
              { name: "verified", color: "greenLight2" },
              { name: "rejected", color: "redLight2" },
            ],
          },
        },
        { name: "admin_notes", type: "multilineText" },
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
    });
  } else {
    console.log("tips: already exists — skip");
  }
}

createTables().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
